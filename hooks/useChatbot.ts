// hooks/useChatbot.ts
//
// Same public API as before (AiChat.tsx needs no changes). What changed:
//  - uses the rebuilt lib/firebaseAI.ts (GoogleAI backend, current model)
//  - reads chunk text through readText(), so it works whether the SDK
//    exposes text as a method or a property
//  - the non-streaming fallback no longer re-sends into the SAME chat
//    object, which used to push a duplicate user turn into the history
//  - errors are mapped to plain sentences a senior can act on
//  - greeting is Taglish, matching the app's default language

import {
  CHATBOT_SESSIONS_KEY_PREFIX,
  CHATBOT_STORAGE_KEY,
  MAX_CHATBOT_MESSAGES,
  MAX_CHAT_SESSIONS,
} from "@/constants/constants";
import { useAuth } from "@/context/AuthContext";
import {
  createNativeChatSession,
  friendlyAIError,
  readText,
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
  text: "Kumusta po! Ako si HealthAI, ang inyong katulong sa kalusugan. Ano po ang maitutulong ko sa inyo ngayon? 😊",
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
    .filter((m) => m.id !== "initial") // drop the static greeting — not a real turn
    .filter((m) => m.text.trim().length > 0) // drop the empty streaming placeholder
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.text }],
    }));

  // Gemini requires history to START with a "user" turn.
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
// history was per-account) into the new sessions list.
async function migrateLegacyConversation(): Promise<ChatSession | null> {
  try {
    const legacy = await AsyncStorage.getItem(CHATBOT_STORAGE_KEY);
    if (!legacy) return null;
    await AsyncStorage.removeItem(CHATBOT_STORAGE_KEY); // one-shot, never reused
    const parsed: unknown = JSON.parse(legacy);
    if (!isValidMessages(parsed) || parsed.length === 0) return null;
    const messages = parsed.map((m) => ({ ...m, id: m.id ?? generateId() }));
    if (!messages.some((m) => m.role === "user")) return null;
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

  const scopeKey = isGuest ? GUEST_SCOPE : (user?.uid ?? GUEST_SCOPE);
  const isPersistable = scopeKey !== GUEST_SCOPE;
  const storageKey = `${CHATBOT_SESSIONS_KEY_PREFIX}${scopeKey}`;

  const [sessions, setSessions] = useState<ChatSession[]>(() => [createEmptySession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<ReturnType<typeof createNativeChatSession> | null>(null);
  const loadedScopeRef = useRef<string | null>(null);

  // (Re)load whenever the signed-in identity changes.
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    chatRef.current = null;

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

  const appendToLastMessage = useCallback(
    (chunk: string) => {
      updateActiveSession((session) => {
        const msgs = session.messages;
        const last = msgs[msgs.length - 1];
        if (!last || last.role !== "assistant") return session;
        const updated = [...msgs.slice(0, -1), { ...last, text: last.text + chunk }];
        return { ...session, messages: updated, updatedAt: Date.now() };
      });
    },
    [updateActiveSession],
  );

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

    // Snapshot the history BEFORE this turn — needed if we have to rebuild
    // the session for the fallback path below.
    const historyBefore = toFirebaseHistory(messages);

    if (!chatRef.current) {
      chatRef.current = safeCreateSession(historyBefore);
    }

    if (!chatRef.current) {
      addMessage(
        "assistant",
        "Hindi ko po ma-simulan ang chat. Pakisara at buksan ulit ang app. 😊",
      );
      return;
    }

    addMessage("user", trimmed);
    setLoading(true);

    // Empty assistant bubble that every chunk fills in place.
    addMessage("assistant", "");

    try {
      const result = await chatRef.current.sendMessageStream(trimmed);
      let reply = "";
      for await (const chunk of result.stream) {
        const text = readText(chunk);
        if (!text) continue;
        reply += text;
        appendToLastMessage(text);
      }
      if (!reply.trim()) {
        setLastMessageText("Wala akong nakuhang sagot. Pakisubukan ulit po.");
      }
    } catch (streamErr) {
      console.warn("Stream failed, retrying without streaming:", streamErr);
      try {
        // IMPORTANT: build a FRESH session from the pre-turn history. Reusing
        // chatRef here would append `trimmed` a second time, because the
        // failed stream may already have recorded it internally.
        const retry = safeCreateSession(historyBefore);
        if (!retry) throw streamErr;
        const result = await retry.sendMessage(trimmed);
        const reply = readText(result.response).trim();
        setLastMessageText(reply || "Wala akong nakuhang sagot. Pakisubukan ulit po.");
        chatRef.current = retry;
      } catch (err) {
        chatRef.current = null; // drop the broken session; next send rebuilds it
        setLastMessageText(friendlyAIError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = useCallback(() => {
    const fresh = createEmptySession();
    chatRef.current = null;
    setSessions((prev) => [fresh, ...prev].slice(0, MAX_CHAT_SESSIONS));
    setActiveSessionId(fresh.id);
  }, []);

  const openSession = useCallback(
    (id: string) => {
      if (id === activeSessionId) return;
      chatRef.current = null; // rebuilt from THAT session's history on next send
      setActiveSessionId(id);
    },
    [activeSessionId],
  );

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
