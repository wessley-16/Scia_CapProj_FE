import { useState } from "react";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export const useChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Magandang araw! Ako ang iyong Valenzuela Senior Assistant. Paano kita matutulungan ngayon?"
    }
  ]);

  const [loading, setLoading] = useState(false);

  const API_URL = "http://192.168.1.100:3000/api/chat";
  //const API_URL = "http://10.174.101.153:3000/api/chat";(Old IP)
  // ⚠️ Replace with:
  // - "http://localhost:3000/api/chat" (web)
  // - "http://192.168.x.x:3000/api/chat" (real device)


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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: { reply?: string } = await response.json();

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