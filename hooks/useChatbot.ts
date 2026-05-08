// hooks/useChatbot.ts
// Uses the Firebase Web SDK (firebase package) — consistent with lib/firebase.ts
// NO @react-native-firebase/ai native dependency needed.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { CHATBOT_STORAGE_KEY, MAX_CHATBOT_MESSAGES } from "@/constants/constants";
import { getVertexAI, getGenerativeModel } from "firebase/vertexai";
import { app } from "@/lib/firebase";

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

// ── Vertex AI model (lazy-initialized via Web SDK) ────────────────────────────
let _model: ReturnType<typeof getGenerativeModel> | null = null;

const getModel = () => {
  if (!_model) {
    const vertexAI = getVertexAI(app);
    _model = getGenerativeModel(vertexAI, {
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
    });
  }
  return _model;
};

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

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load persisted conversation
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

  // Persist on every change
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

  const addMessage = useCallback(
    (role: ChatMessage["role"], text: string) => {
      setMessages((prev) =>
        getTrimmedMessages([...prev, { id: generateId(), role, text }])
      );
    },
    []
  );

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    addMessage("user", trimmed);
    setLoading(true);

    try {
      const model = getModel();

      // Build history for multi-turn context (Gemini expects "model" not "assistant")
      type HistoryEntry = { role: "user" | "model"; parts: { text: string }[] };

      const historyMessages: HistoryEntry[] = messages
        .slice(-MAX_CONTEXT_MESSAGES)
        .filter((m) => m.id !== "initial")
        .map((m) => ({
          role: m.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: [{ text: m.text }],
        }));

      // Gemini requires history to start with a user message
      while (historyMessages.length > 0 && historyMessages[0].role === "model") {
        historyMessages.shift();
      }

      const chat = model.startChat({ history: historyMessages });
      const result = await chat.sendMessage(trimmed);
      const reply = result.response.text() ?? "No response from AI.";

      addMessage("assistant", reply);
    } catch (error: any) {
      console.log("HealthAI error:", error);
      // Fallback: friendly error message
      addMessage(
        "assistant",
        "I'm having trouble connecting right now. Please check your internet connection and try again. If the issue persists, please consult a doctor directly. 😊"
      );
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = async () => {
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
