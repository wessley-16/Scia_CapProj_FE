// hooks/useChatbot.ts
// Real-time STREAMING chatbot using Google Gemini API directly.
// ✅ No Firebase Vertex AI billing required
// ✅ Streams tokens live so the reply appears word-by-word
// ✅ Persists conversation in AsyncStorage

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { CHATBOT_STORAGE_KEY, MAX_CHATBOT_MESSAGES } from "@/constants/constants";

// ─────────────────────────────────────────────────────────────────────────────
// 🔑  PASTE YOUR GEMINI API KEY HERE
//     Get one free at: https://aistudio.google.com/app/apikey
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = "PASTE_YOUR_GEMINI_API_KEY_HERE";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

// ── SCIA Health AI system prompt ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are HealthAI, a caring and knowledgeable health assistant for senior citizens in Valenzuela City, Philippines. You are part of the SCIA (Senior Citizens Information and Assistance) mobile app.

Your role:
- Answer health questions in a clear, simple, and warm manner suitable for elderly users
- Provide general health information, wellness tips, and medication reminders guidance
- Remind seniors about the importance of regular check-ups, hydration, and exercise
- Never diagnose illnesses or replace a real doctor — always recommend consulting a physician for serious concerns
- You may mention local health services in Valenzuela City when relevant
- Keep responses concise and easy to read on a mobile screen
- Use simple language; avoid complex medical jargon
- Be encouraging, patient, and respectful at all times

Important: You are NOT a substitute for emergency services. If someone describes an emergency, always tell them to call 911 or use the SOS button in the app immediately.`;

// ── Types ─────────────────────────────────────────────────────────────────────
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

const getTrimmedMessages = (messages: ChatMessage[]) =>
  messages.slice(-MAX_CHATBOT_MESSAGES);

// ── Storage helpers ───────────────────────────────────────────────────────────
type StoredChatMessage = Omit<ChatMessage, "id"> & { id?: string };

const isValidMessagesArray = (value: unknown): value is StoredChatMessage[] => {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.text === "string"
  );
};

// ── Build Gemini request body ─────────────────────────────────────────────────
function buildRequestBody(history: ChatMessage[], userMessage: string) {
  // Map history to Gemini "contents" format (role: "user" | "model")
  const contents = history
    .slice(-MAX_CONTEXT_MESSAGES)
    .filter((m) => m.id !== "initial")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

  // Gemini requires history to start with a user turn
  while (contents.length > 0 && contents[0].role === "model") {
    contents.shift();
  }

  // Append the new user message
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  return {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load persisted conversation ────────────────────────────────────────────
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const stored = await AsyncStorage.getItem(CHATBOT_STORAGE_KEY);
        if (!stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (isValidMessagesArray(parsed) && parsed.length > 0) {
          const withIds: ChatMessage[] = parsed.map((msg) => ({
            ...msg,
            id: msg.id ?? generateId(),
          }));
          setMessages(getTrimmedMessages(withIds));
        }
      } catch (error) {
        console.log("Failed to load chatbot conversation:", error);
      } finally {
        setHydrated(true);
      }
    };
    loadMessages();
  }, []);

  // ── Persist on every change ────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    const persist = async () => {
      try {
        await AsyncStorage.setItem(
          CHATBOT_STORAGE_KEY,
          JSON.stringify(getTrimmedMessages(messages))
        );
      } catch (error) {
        console.log("Failed to persist chatbot conversation:", error);
      }
    };
    persist();
  }, [hydrated, messages]);

  const addMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) =>
      getTrimmedMessages([...prev, { id: generateId(), role, text }])
    );
  }, []);

  // ── Send with real-time streaming ──────────────────────────────────────────
  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    // Cancel any ongoing stream
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    addMessage("user", trimmed);
    setLoading(true);

    // Create a placeholder bot message that we'll stream into
    const botId = generateId();
    setMessages((prev) =>
      getTrimmedMessages([
        ...prev,
        { id: botId, role: "assistant", text: "" },
      ])
    );

    try {
      const body = buildRequestBody(
        // capture current messages snapshot before the user msg was added
        messages,
        trimmed
      );

      const response = await fetch(GEMINI_STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
      }

      // ── SSE stream reader ────────────────────────────────────────────────
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const chunk = JSON.parse(jsonStr);
            const token: string =
              chunk?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (token) {
              accumulated += token;
              // Update the placeholder message live
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botId ? { ...m, text: accumulated } : m
                )
              );
            }
          } catch (_) {
            // malformed SSE chunk — skip
          }
        }
      }

      // If nothing came back, show a fallback
      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId
              ? {
                  ...m,
                  text: "I received your message but got an empty response. Please try again.",
                }
              : m
          )
        );
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        // User cancelled — leave the partial message as-is
        return;
      }
      console.log("HealthAI streaming error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? {
                ...m,
                text: "I'm having trouble connecting right now. Please check your internet connection and try again. If the issue persists, please consult a doctor directly. 😊",
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = async () => {
    abortRef.current?.abort();
    setMessages([INITIAL_MESSAGE]);
    try {
      await AsyncStorage.removeItem(CHATBOT_STORAGE_KEY);
    } catch (error) {
      console.log("Failed to clear chatbot conversation:", error);
    }
  };

  return {
    messages,
    loading,
    sendMessage,
    clearConversation,
  };
};
