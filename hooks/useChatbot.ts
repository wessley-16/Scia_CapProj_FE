import { useState } from "react";

interface Message {
  role: "user" | "ai";
  text: string;
}

export const useChatbot = () => {
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

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { role: "user", text };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();

      const aiMessage: Message = {
        role: "ai",
        text: data.reply || "No response from AI",
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "⚠️ Failed to connect to server",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return {
    messages,
    loading,
    sendMessage,
    clearChat,
  };
};