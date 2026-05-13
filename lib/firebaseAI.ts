// lib/firebaseAI.ts
import { getApp } from "@react-native-firebase/app";
import {
  getAI,
  getGenerativeModel,
  VertexAIBackend,
} from "@react-native-firebase/ai";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ChatHistoryItem = {
  role: "user" | "model";
  parts: { text: string }[];
};

// ── System prompt for HealthAI ────────────────────────────────────────────────
const HEALTH_AI_SYSTEM_PROMPT = `You are HealthAI, a friendly and knowledgeable personal health assistant for senior citizens in the Philippines. 

Your role is to:
- Answer general health and wellness questions in a clear, simple, and reassuring way
- Provide information about common health conditions, medications, and healthy lifestyle tips
- Help seniors understand medical terms in plain language
- Remind users to consult their doctor for serious concerns
- Be empathetic, patient, and respectful

Important guidelines:
- Always recommend consulting a licensed physician for diagnosis or treatment
- Keep responses concise and easy to read for senior citizens
- Use simple language, avoid overly technical jargon
- If asked about emergencies, advise calling emergency services immediately
- You are not a substitute for professional medical advice`;

// ── Create a Vertex AI chat session ──────────────────────────────────────────
export function createNativeChatSession(history: ChatHistoryItem[] = []) {
  const app = getApp();

  // Use Vertex AI backend (backed by Google Cloud — enterprise grade)
  const ai = getAI(app, { backend: new VertexAIBackend() });

  const model = getGenerativeModel(ai, {
    model: "gemini-2.5-flash",
    systemInstruction: {
      parts: [{ text: HEALTH_AI_SYSTEM_PROMPT }],
    },
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
      topP: 0.9,
    },
  });

  // Start a chat session with existing history
  return model.startChat({
    history,
  });
}
