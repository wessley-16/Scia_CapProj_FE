import { useState } from "react";

// Define the message type
export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export const useChatbot = () => {
<<<<<<< HEAD
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const addMessage = (role: ChatMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { role, text }]);
  };
=======
  // Change your useState to look like this:
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "ai", 
      text: "Magandang araw! Ako ang iyong Valenzuela Senior Assistant. Paano kita matutulungan ngayon?" 
    }
  ]);
  const [loading, setLoading] = useState(false);

  const API_URL = "http://192.168.254.125:3000/api/chat";
  // ⚠️ Replace with:
  // - "http://localhost:3000/api/chat" (web)
  // - "http://192.168.x.x:3000/api/chat" (real device)
>>>>>>> 3a89d1da1650712fb307ca3a8f0d98f7b049b4a5

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