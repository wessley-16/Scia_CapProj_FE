import { useState } from "react";

// ✅ Consistent message type
export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const API_URL = "http://192.168.1.100:3000/api/chat"; // 👈 change if needed

export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Magandang araw! Ako ang iyong Valenzuela Senior Assistant. Paano kita matutulungan ngayon?",
    },
  ]);

  const [loading, setLoading] = useState(false);

  // ✅ reusable message adder
  const addMessage = (role: ChatMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { role, text }]);
  };

  const sendMessage = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    addMessage("user", trimmedMessage);
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      if (!response.ok) {
        addMessage("assistant", "Server error. Please try again.");
        setLoading(false);
        return;
      }

      const data: { reply?: string } = await response.json();

      const reply = data?.reply ?? "No response from AI.";
      addMessage("assistant", reply);
    } catch (error) {
      console.log("Chatbot error:", error);
      addMessage("assistant", "Connection error. Please try again.");
    }

    setLoading(false);
  };

  return { messages, loading, sendMessage };
};