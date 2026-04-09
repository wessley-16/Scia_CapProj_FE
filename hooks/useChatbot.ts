import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  CHATBOT_API_URL,
  CHATBOT_STORAGE_KEY,
  MAX_CHATBOT_MESSAGES,
} from "../constants/constants";

//  Consistent message type
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

const MAX_CONTEXT_MESSAGES = 10;
const MAX_CONTEXT_PER_ROLE = 5;

const INITIAL_MESSAGE: ChatMessage = {
  id: "initial",
  role: "assistant",
  text: "Hello! How can I help you today?",
};

const getTrimmedMessages = (messages: ChatMessage[]) =>
  messages.slice(-MAX_CHATBOT_MESSAGES);

const getBalancedContextMessages = (messages: ChatMessage[]) => {
  const contextMessages: ChatMessage[] = [];
  let userCount = 0;
  let assistantCount = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];

    if (message.role === "user" && userCount < MAX_CONTEXT_PER_ROLE) {
      contextMessages.push(message);
      userCount += 1;
    }

    if (message.role === "assistant" && assistantCount < MAX_CONTEXT_PER_ROLE) {
      contextMessages.push(message);
      assistantCount += 1;
    }

    if (
      contextMessages.length >= MAX_CONTEXT_MESSAGES ||
      (userCount >= MAX_CONTEXT_PER_ROLE &&
        assistantCount >= MAX_CONTEXT_PER_ROLE)
    ) {
      break;
    }
  }

  return contextMessages.reverse();
};

const buildContextualPrompt = (
  messages: ChatMessage[],
  currentMessage: string,
) => {
  const contextMessages = getBalancedContextMessages(messages);

  if (contextMessages.length === 0) {
    return currentMessage;
  }

  const contextText = contextMessages
    .map(
      (message, index) =>
        `${index + 1}. ${message.role.toUpperCase()}: ${message.text}`,
    )
    .join("\n");

  return [
    "Use the following recent conversation context to answer naturally.",
    "Conversation context:",
    contextText,
    `Current user message: ${currentMessage}`,
  ].join("\n\n");
};

type StoredChatMessage = Omit<ChatMessage, "id"> & { id?: string };

const isValidMessagesArray = (
  value: unknown,
): value is StoredChatMessage[] => {
  if (!Array.isArray(value)) return false;

  return value.every(
    (item) =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.text === "string",
  );
};

export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [lastContextPrompt, setLastContextPrompt] = useState("");

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const stored = await AsyncStorage.getItem(CHATBOT_STORAGE_KEY);

        if (!stored) {
          setHydrated(true);
          return;
        }

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

  useEffect(() => {
    if (!hydrated) return;

    const persistMessages = async () => {
      try {
        await AsyncStorage.setItem(
          CHATBOT_STORAGE_KEY,
          JSON.stringify(getTrimmedMessages(messages)),
        );
      } catch (error) {
        console.log("Failed to persist chatbot conversation:", error);
      }
    };

    persistMessages();
  }, [hydrated, messages]);

  const addMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((prev) =>
      getTrimmedMessages([...prev, { id: generateId(), role, text }]),
    );
  }, []);

  const sendMessage = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || loading) return;

    const contextualMessage = buildContextualPrompt(messages, trimmedMessage);
    setLastContextPrompt(contextualMessage);

    addMessage("user", trimmedMessage);
    setLoading(true);

    try {
      const response = await fetch(CHATBOT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: contextualMessage }),
      });

      let data: { reply?: string; error?: string } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        addMessage(
          "assistant",
          data.error || "Server error. Please try again.",
        );
        return;
      }

      const reply = data?.reply ?? "No response from AI.";
      addMessage("assistant", reply);
    } catch (error) {
      console.log("Chatbot error:", error);
      addMessage("assistant", "Connection error. Please try again.");
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
    lastContextPrompt,
  };
};
