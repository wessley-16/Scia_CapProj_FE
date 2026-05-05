import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { CHATBOT_STORAGE_KEY, MAX_CHATBOT_MESSAGES } from "@/constants/constants";

// ── YOUR ANTHROPIC API KEY ───────────────────────────────────────────────────
// Get one free at https://console.anthropic.com
// ⚠️  For production, move this to a backend proxy so it stays secret.
const ANTHROPIC_API_KEY = "YOUR_ANTHROPIC_API_KEY_HERE";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

// ── SCIA Health AI system prompt ─────────────────────────────────────────────
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

// ── Types ────────────────────────────────────────────────────────────────────
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

// ── Build Anthropic messages array from chat history ─────────────────────────
const buildAnthropicMessages = (
  history: ChatMessage[],
  currentMessage: string
) => {
  // Take last N messages for context (must alternate user/assistant)
  const context = history
    .slice(-MAX_CONTEXT_MESSAGES)
    .filter((m) => m.id !== "initial") // skip the greeting
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.text,
    }));

  // Anthropic requires the messages array to start with a user turn
  // and strictly alternate. Remove leading assistant messages if any.
  while (context.length > 0 && context[0].role === "assistant") {
    context.shift();
  }

  // Append the current user message
  context.push({ role: "user", content: currentMessage });

  return context;
};

// ── Storage helpers ──────────────────────────────────────────────────────────
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

// ── Hook ─────────────────────────────────────────────────────────────────────
export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load persisted conversation on mount
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

  // Persist conversation whenever it changes
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
      // Call Anthropic Claude API directly ─────────────────────────────────
      const anthropicMessages = buildAnthropicMessages(messages, trimmed);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          // Required for direct browser/RN calls (bypasses CORS preflight check):
          "anthropic-dangerous-request-from-browser": "true",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: anthropicMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg =
          data?.error?.message || "AI service error. Please try again.";
        addMessage("assistant", errMsg);
        return;
      }

      // Extract text from Anthropic response content blocks
      const reply: string =
        data?.content
          ?.filter((block: any) => block.type === "text")
          .map((block: any) => block.text)
          .join("\n") ?? "No response from AI.";

      addMessage("assistant", reply);
    } catch (error) {
      console.log("HealthAI error:", error);
      addMessage(
        "assistant",
        "Connection error. Please check your internet and try again."
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