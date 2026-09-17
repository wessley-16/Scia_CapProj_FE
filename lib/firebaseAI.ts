import { getApp } from "@react-native-firebase/app";
import {
  getAI,
  getGenerativeModel,
  VertexAIBackend,
} from "@react-native-firebase/ai";

export type ChatHistoryItem = {
  role: "user" | "model";
  parts: { text: string }[];
};

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

export function createNativeChatSession(history: ChatHistoryItem[] = []) {
  const app = getApp();

  // Vertex AI backend (Google Cloud, enterprise grade)
  const ai = getAI(app, { backend: new VertexAIBackend() });

  const model = getGenerativeModel(ai, {
    model: "gemini-2.5-flash",
    systemInstruction: {
      role: "system" as const,
      parts: [{ text: HEALTH_AI_SYSTEM_PROMPT }],
    },
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
      topP: 0.9,
    },
  });

  return model.startChat({
    history,
  });
}
