// hooks/useChatbot.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { CHATBOT_STORAGE_KEY, MAX_CHATBOT_MESSAGES } from "@/constants/constants";
import { getVertexAI, getGenerativeModel } from "firebase/vertexai";
import { app } from "@/lib/firebase"; // ← make sure firebase.ts exports app

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

// Lazy model — created once
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

type StoredMsg = Omit<ChatMessage, "id"> & { id?: string };
const isValidArray = (v: unknown): v is StoredMsg[] =>
  Array.isArray(v) &&
  v.every((i) => i && (i.role === "user" || i.role === "assistant") && typeof i.text === "string");

export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHATBOT_STORAGE_KEY).then((stored) => {
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isValidArray(parsed) && parsed.length > 0) {
          setMessages(getTrimmedMessages(parsed.map((m) => ({ ...m, id: m.id ?? generateId() }))));
        }
      }
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(CHATBOT_STORAGE_KEY, JSON.stringify(getTrimmedMessages(messages))).catch(() => {});
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
      const model = getModel();

      type H = { role: "user" | "model"; parts: { text: string }[] };
      const history: H[] = messages
        .slice(-MAX_CONTEXT_MESSAGES)
        .filter((m) => m.id !== "initial")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        }));

      // Gemini requires history to start with user turn
      while (history.length > 0 && history[0].role === "model") history.shift();

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(trimmed);
      addMessage("assistant", result.response.text() ?? "No response.");
    } catch (err: any) {
      console.log("HealthAI error:", err);
      addMessage("assistant", "I'm having trouble connecting. Please check your internet and try again. 😊");
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
