import { useState } from "react";

// Define the message type
export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const addMessage = (role: ChatMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { role, text }]);
  };

  const sendMessage = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    // Add user's message
    addMessage("user", trimmedMessage);
    setLoading(true);

    try {
      const response = await fetch("http://192.168.1.100:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: { reply?: string } = await response.json();

      // Safely append AI reply
      const reply = data?.reply ?? "No reply from AI.";
      addMessage("assistant", reply);
    } catch (err) {
      console.error("Chatbot error:", err);
      addMessage("assistant", "Error connecting to AI.");
    } finally {
      setLoading(false);
    }
  };

  return { messages, loading, sendMessage };
};