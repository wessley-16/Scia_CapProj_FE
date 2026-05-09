// hooks/useChatbot.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { CHATBOT_STORAGE_KEY, MAX_CHATBOT_MESSAGES } from "@/constants/constants";

const GEMINI_API_KEY = "AIzaSyCc99gQYUA-JqX-nlsF3yp6PCikbOOJ2fc";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are HealthAI, a caring health assistant for senior citizens 
in Valenzuela City, Philippines (SCIA app). Answer health questions simply and warmly. 
Never diagnose — always recommend seeing a doctor for serious concerns. 
If someone describes an emergency, tell them to call 911 or use the SOS button immediately.`;

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

const getTrimmedMessages = (msgs: ChatMessage[]) => msgs.slice(-MAX_CHATBOT_MESSAGES);

type StoredMsg = Omit<ChatMessage, "id"> & { id?: string };
const isValidArray = (v: unknown): v is StoredMsg[] =>
  Array.isArray(v) &&
  v.every((i) => i && (i.role === "user" || i.role === "assistant") && typeof i.text === "string");

export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHATBOT_STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isValidArray(parsed) && parsed.length > 0) {
            setMessages(
              getTrimmedMessages(parsed.map((m) => ({ ...m, id: m.id ?? generateId() })))
            );
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      CHATBOT_STORAGE_KEY,
      JSON.stringify(getTrimmedMessages(messages))
    ).catch(() => {});
  }, [hydrated, messages]);

  const addMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) => getTrimmedMessages([...prev, { id: generateId(), role, text }]));
  }, []);

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    addMessage("user", trimmed);
    setLoading(true);

    try {
      type GeminiPart = { text: string };
      type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

      const history: GeminiContent[] = messages
        .slice(-MAX_CONTEXT_MESSAGES)
        .filter((m) => m.id !== "initial")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        }));

      // Gemini requires history to start with a user turn
      while (history.length > 0 && history[0].role === "model") history.shift();

      // Append the new user message
      history.push({ role: "user", parts: [{ text: trimmed }] });

      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: history,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message ?? `HTTP ${response.status}`);
      }

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response.";

      addMessage("assistant", reply);
    } catch (err: unknown) {
      console.error("HealthAI error:", err);
      addMessage(
        "assistant",
        "I'm having trouble connecting. Please check your internet and try again. 😊"
      );
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = async () => {
    setMessages([INITIAL_MESSAGE]);
    await AsyncStorage.removeItem(CHATBOT_STORAGE_KEY).catch(() => {});
  };

  return { messages, loading, sendMessage, clearConversation };
};
