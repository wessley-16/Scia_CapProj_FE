// hooks/useChatbot.ts
import {
  CHATBOT_SESSIONS_KEY_PREFIX,
  CHATBOT_STORAGE_KEY,
  MAX_CHATBOT_MESSAGES,
  MAX_CHAT_SESSIONS,
} from "@/constants/constants";
import { useAuth } from "@/context/AuthContext";
import {
  createNativeChatSession,
  type ChatHistoryItem,
} from "@/lib/firebaseAI";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

let _msgCounter = 0;
const generateId = () => `msg_${Date.now()}_${(_msgCounter += 1)}`;
const MAX_CONTEXT_MESSAGES = 10;

// Guest mode never touches AsyncStorage — its sessions live only in React
// state for the lifetime of the JS process, so they can never survive an
// app exit and can never leak into whichever account signs in next.
const GUEST_SCOPE = "guest";

const INITIAL_MESSAGE: ChatMessage = {
  id: "initial",
  role: "assistant",
  text: "Hello! I'm HealthAI, your personal health assistant. How can I help you today? 😊",
};

const getTrimmedMessages = (msgs: ChatMessage[]) =>
  msgs.slice(-MAX_CHATBOT_MESSAGES);

const deriveTitle = (msgs: ChatMessage[]): string => {
  const firstUserMsg = msgs.find((m) => m.role === "user");
  if (!firstUserMsg) return "New conversation";
  const clean = firstUserMsg.text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42).trimEnd()}…` : clean;
};

const createEmptySession = (): ChatSession => ({
  id: generateId(),
  title: "New conversation",
  messages: [INITIAL_MESSAGE],
  updatedAt: Date.now(),
});

type StoredMsg = Omit<ChatMessage, "id"> & { id?: string };

const isValidMessages = (v: unknown): v is StoredMsg[] =>
  Array.isArray(v) &&
  v.every(
    (i) =>
      i &&
      (i.role === "user" || i.role === "assistant") &&
      typeof i.text === "string",
  );

const isValidSessions = (v: unknown): v is ChatSession[] =>
  Array.isArray(v) &&
  v.every(
    (s) =>
      s &&
      typeof s.id === "string" &&
      typeof s.title === "string" &&
      typeof s.updatedAt === "number" &&
      isValidMessages(s.messages),
  );

function toFirebaseHistory(messages: ChatMessage[]): ChatHistoryItem[] {
  const mapped: ChatHistoryItem[] = messages
    .filter((m) => m.id !== "initial") // drop the static greeting — it's not a real turn
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.text }],
    }));

  // Firebase requires history to START with a "user" turn.
  const firstUserIndex = mapped.findIndex((m) => m.role === "user");
  if (firstUserIndex === -1) return [];
  return mapped.slice(firstUserIndex);
}

// Safe session creator — never throws, returns null on failure
function safeCreateSession(history: ChatHistoryItem[]) {
  try {
    return createNativeChatSession(history);
  } catch (e) {
    console.warn("Chat session creation failed:", e);
    return null;
  }
}

// One-time migration of the old single global conversation (from before chat
// history was per-account) into the new sessions list, so an existing
// account doesn't just lose what it already had. Only ever runs for a real,
// persistable account — guests always start clean.
async function migrateLegacyConversation(): Promise<ChatSession | null> {
  try {
    const legacy = await AsyncStorage.getItem(CHATBOT_STORAGE_KEY);
    if (!legacy) return null;
    await AsyncStorage.removeItem(CHATBOT_STORAGE_KEY); // one-shot, never reused
    const parsed: unknown = JSON.parse(legacy);
    if (!isValidMessages(parsed) || parsed.length === 0) return null;
    const messages = parsed.map((m) => ({ ...m, id: m.id ?? generateId() }));
    if (!messages.some((m) => m.role === "user")) return null; // nothing real to keep
    return {
      id: generateId(),
      title: deriveTitle(messages),
      messages: getTrimmedMessages(messages),
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export const useChatbot = () => {
  const { user, isGuest } = useAuth();

  // Real accounts get their own persisted history, keyed by Firebase uid, so
  // one account never sees another's conversations. Guest gets a clean,
  // in-memory-only slate that is NEVER written to disk — that's what
  // guarantees it disappears on app exit or when a real account signs in.
  const scopeKey = isGuest ? GUEST_SCOPE : (user?.uid ?? GUEST_SCOPE);
  const isPersistable = scopeKey !== GUEST_SCOPE;
  const storageKey = `${CHATBOT_SESSIONS_KEY_PREFIX}${scopeKey}`;

  const [sessions, setSessions] = useState<ChatSession[]>(() => [createEmptySession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<ReturnType<typeof createNativeChatSession> | null>(null);
  const loadedScopeRef = useRef<string | null>(null);

  // (Re)load whenever the signed-in identity changes — a different account,
  // a logout, or entering/leaving Guest mode. This is what makes account
  // switching (without an app restart) show the right person's history
  // instead of whoever was signed in a moment ago.
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    chatRef.current = null;

    // Clear immediately (not just after the async load resolves) so a scope
    // switch never flashes the PREVIOUS account's messages, even briefly.
    const placeholder = createEmptySession();
    setSessions([placeholder]);
    setActiveSessionId(placeholder.id);

    (async () => {
      let loaded: ChatSession[] | null = null;

      if (isPersistable) {
        try {
          const stored = await AsyncStorage.getItem(storageKey);
          if (stored) {
            const parsed: unknown = JSON.parse(stored);
            if (isValidSessions(parsed) && parsed.length > 0) {
              loaded = parsed;
            }
          }
          if (!loaded) {
            const migrated = await migrateLegacyConversation();
            if (migrated) loaded = [migrated];
          }
        } catch {
          loaded = null;
        }
      }
      // Guest mode never reads from disk — always starts fresh.

      if (cancelled) return;
      const finalSessions = loaded && loaded.length > 0 ? loaded : [createEmptySession()];
      setSessions(finalSessions);
      setActiveSessionId(finalSessions[0].id);
      loadedScopeRef.current = scopeKey;
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [scopeKey, isPersistable, storageKey]);

  // Persist on every change — real accounts only, and only once the load for
  // THIS scope has actually finished (otherwise we could briefly overwrite
  // storage with placeholder data while switching accounts).
  useEffect(() => {
    if (!hydrated || !isPersistable || loadedScopeRef.current !== scopeKey) return;
    const trimmed = sessions
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CHAT_SESSIONS);
    AsyncStorage.setItem(storageKey, JSON.stringify(trimmed)).catch(() => {});
  }, [sessions, hydrated, isPersistable, scopeKey, storageKey]);

  const messages = useMemo(
    () => sessions.find((s) => s.id === activeSessionId)?.messages ?? [],
    [sessions, activeSessionId],
  );

  const updateActiveSession = useCallback(
    (updater: (session: ChatSession) => ChatSession) => {
      setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? updater(s) : s)));
    },
    [activeSessionId],
  );

  const addMessage = useCallback(
    (role: ChatMessage["role"], text: string) => {
      updateActiveSession((session) => {
        const nextMessages = getTrimmedMessages([
          ...session.messages,
          { id: generateId(), role, text },
        ]);
        return {
          ...session,
          messages: nextMessages,
          updatedAt: Date.now(),
          title:
            session.title === "New conversation" ? deriveTitle(nextMessages) : session.title,
        };
      });
    },
    [updateActiveSession],
  );

  // Appends a chunk of text to the LAST message in place (same id, same
  // position) instead of adding a new message — this is what lets a
  // streamed reply grow smoothly in the UI instead of appearing as one
  // big block once the whole response has arrived.
  const appendToLastMessage = useCallback(
    (chunk: string) => {
      updateActiveSession((session) => {
        const msgs = session.messages;
        const last = msgs[msgs.length - 1];
        if (!last || last.role !== "assistant") return session; // safety guard
        const updated = [
          ...msgs.slice(0, -1),
          { ...last, text: last.text + chunk },
        ];
        return { ...session, messages: updated, updatedAt: Date.now() };
      });
    },
    [updateActiveSession],
  );

  // Replaces the LAST message's text outright — used for the "No
  // response." / error fallback so we fill the already-visible empty
  // bubble instead of leaving it stranded and adding a second one.
  const setLastMessageText = useCallback(
    (text: string) => {
      updateActiveSession((session) => {
        const msgs = session.messages;
        const last = msgs[msgs.length - 1];
        if (!last || last.role !== "assistant") return session;
        const updated = [...msgs.slice(0, -1), { ...last, text }];
        return { ...session, messages: updated, updatedAt: Date.now() };
      });
    },
    [updateActiveSession],
  );

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    // Create session lazily on first send, seeded from the ACTIVE
    // conversation's own history (not whichever one was open before).
    if (!chatRef.current) {
      chatRef.current = safeCreateSession(toFirebaseHistory(messages));
    }

    if (!chatRef.current) {
      addMessage(
        "assistant",
        "Could not connect to HealthAI. Please restart the app and try again. 😊",
      );
      return;
    }

    addMessage("user", trimmed);
    setLoading(true);

    // Seed an empty assistant bubble right away — every chunk that arrives
    // (streaming path) or the eventual full reply (fallback paths) fills
    // THIS SAME bubble instead of appending a new one each time.
    addMessage("assistant", "");

    try {
      const result = await chatRef.current.sendMessageStream(trimmed);
      let reply = "";
      for await (const chunk of result.stream) {
        const text = chunk.text();
        reply += text;
        appendToLastMessage(text);
      }
      if (!reply.trim()) {
        setLastMessageText("No response.");
      }
    } catch (streamErr) {
      console.warn("Stream failed, trying non-stream:", streamErr);
      try {
        const result = await chatRef.current.sendMessage(trimmed);
        const reply = result.response.text();
        setLastMessageText(reply.trim() || "No response.");
      } catch (err) {
        console.error("HealthAI error:", err);
        chatRef.current = null; // reset broken session — fresh one on next send
        setLastMessageText(
          "I'm having trouble connecting. Please check your internet and try again. 😊",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Starts a brand-new conversation and switches to it, keeping the old one
  // in history.
  const startNewChat = useCallback(() => {
    const fresh = createEmptySession();
    chatRef.current = null;
    setSessions((prev) => [fresh, ...prev].slice(0, MAX_CHAT_SESSIONS));
    setActiveSessionId(fresh.id);
  }, []);

  // Opens a past conversation from history.
  const openSession = useCallback(
    (id: string) => {
      if (id === activeSessionId) return;
      chatRef.current = null; // lazily rebuilt from THAT session's own history on next send
      setActiveSessionId(id);
    },
    [activeSessionId],
  );

  // Deletes a conversation from history. If it was the active one, falls
  // back to the next most recent, or a fresh new chat if none are left.
  const deleteSession = useCallback(
    (id: string) => {
      const remaining = sessions.filter((s) => s.id !== id);
      const nextSessions = remaining.length > 0 ? remaining : [createEmptySession()];
      setSessions(nextSessions);
      if (id === activeSessionId) {
        chatRef.current = null;
        setActiveSessionId(nextSessions[0].id);
      }
    },
    [sessions, activeSessionId],
  );

  // Newest-first for the history list.
  const sortedSessions = useMemo(
    () => sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  return {
    messages,
    loading,
    sendMessage,
    sessions: sortedSessions,
    activeSessionId,
    startNewChat,
    openSession,
    deleteSession,
  };
};
