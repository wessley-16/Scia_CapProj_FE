// hooks/useChatbot.ts
import {
  CHATBOT_STORAGE_KEY,
  MAX_CHATBOT_MESSAGES,
} from "@/constants/constants";
import {
  createNativeChatSession,
  type ChatHistoryItem,
} from "@/lib/firebaseAI";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

let _msgCounter = 0;
const generateId = () => `msg_${Date.now()}_${(_msgCounter += 1)}`;
const MAX_CONTEXT_MESSAGES = 10;

const INITIAL_MESSAGE: ChatMessage = {
  id: "initial",
  role: "assistant",
  text: "Hello! I'm HealthAI, your personal health assistant. How can I help you today? 😊",
};

const getTrimmedMessages = (msgs: ChatMessage[]) =>
  msgs.slice(-MAX_CHATBOT_MESSAGES);

type StoredMsg = Omit<ChatMessage, "id"> & { id?: string };
const isValidArray = (v: unknown): v is StoredMsg[] =>
  Array.isArray(v) &&
  v.every(
    (i) =>
      i &&
      (i.role === "user" || i.role === "assistant") &&
      typeof i.text === "string",
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
  // Slice off any leading "model" entries to avoid the invalid-content error.
  const firstUserIndex = mapped.findIndex((m) => m.role === "user");
  if (firstUserIndex === -1) return []; // no real user messages yet — pass empty history
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

export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<ReturnType<typeof createNativeChatSession> | null>(null);

  // Hydrate from storage on mount — session created lazily on first send
  useEffect(() => {
    AsyncStorage.getItem(CHATBOT_STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isValidArray(parsed) && parsed.length > 0) {
            const restored = getTrimmedMessages(
              parsed.map((m) => ({ ...m, id: m.id ?? generateId() })),
            );
            setMessages(restored);
          }
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  // Persist messages to storage whenever they change
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      CHATBOT_STORAGE_KEY,
      JSON.stringify(getTrimmedMessages(messages)),
    ).catch(() => {});
  }, [hydrated, messages]);

  const addMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) =>
      getTrimmedMessages([...prev, { id: generateId(), role, text }]),
    );
  }, []);

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    // Create session lazily on first send
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

    try {
      // Try streaming first for a responsive feel
      const result = await chatRef.current.sendMessageStream(trimmed);

      let reply = "";
      for await (const chunk of result.stream) {
        reply += chunk.text();
      }

      addMessage("assistant", reply.trim() || "No response.");
    } catch (streamErr) {
      console.warn("Stream failed, trying non-stream:", streamErr);

      // Fallback to non-streaming
      try {
        const result = await chatRef.current.sendMessage(trimmed);
        const reply = result.response.text();
        addMessage("assistant", reply.trim() || "No response.");
      } catch (err) {
        console.error("HealthAI error:", err);
        // Reset broken session — fresh one on next send
        chatRef.current = null;
        addMessage(
          "assistant",
          "I'm having trouble connecting. Please check your internet and try again. 😊",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = async () => {
    setMessages([INITIAL_MESSAGE]);
    chatRef.current = null;
    await AsyncStorage.removeItem(CHATBOT_STORAGE_KEY).catch(() => {});
  };

  return { messages, loading, sendMessage, clearConversation };
};
