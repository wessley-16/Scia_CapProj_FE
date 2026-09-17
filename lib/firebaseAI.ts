// lib/firebaseAI.ts
//
// Single place where SCIA talks to Firebase AI Logic (Gemini).
// Used by BOTH the text chatbot (hooks/useChatbot.ts) and the voice
// assistant (hooks/useVoiceAssistant.ts).
//
// WHAT CHANGED vs the old file (why it stopped working):
//  1. Backend: VertexAIBackend -> GoogleAIBackend.
//     "Vertex AI" is now "Agent Platform Gemini API" and it requires the
//     Blaze (pay-as-you-go) plan + the API enabled in Google Cloud. The
//     Gemini Developer API (GoogleAIBackend) works on the free Spark plan,
//     which is what a capstone should be on.
//  2. Model: "gemini-2.5-flash" is deprecated (shuts down Oct 2026) and
//     already returns 404 for some projects. Now on a current 3.x model.
//  3. systemInstruction no longer passes role: "system" (that shape is
//     rejected by the API — a system instruction is just content).
//  4. Imports the AbortSignal.any polyfill, which was never imported
//     anywhere before. Without it, sendMessageStream() can throw on Hermes.

import "@/lib/polyfills";

import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
} from "@react-native-firebase/ai";
import { getApp } from "@react-native-firebase/app";

// ── Models ───────────────────────────────────────────────────────────────
// Keep these in ONE place. When Google retires a model you change 2 lines,
// not 5 files. Both are free-tier on the Gemini Developer API.
export const CHAT_MODEL = "gemini-3.5-flash-lite";
export const AUDIO_MODEL = "gemini-3.5-flash-lite";

export type ChatHistoryItem = {
  role: "user" | "model";
  parts: { text: string }[];
};

// ── Prompts ──────────────────────────────────────────────────────────────
// Shared base so the chatbot and the voice assistant behave like the same
// assistant, then a small delta for each channel.
const SENIOR_BASE = `You are HealthAI, the assistant inside SCIA, an app for senior citizens (60+) in Valenzuela City, Philippines.

Who you are talking to:
- Older Filipinos. Many did not finish school, many have poor eyesight, and many read slowly.
- They may write in English, Tagalog, or Taglish. ALWAYS reply in the same language they used. If they mix, reply in Taglish.

How to speak:
- Short sentences. One idea per sentence. Everyday words only.
- Never use medical jargon without explaining it in plain words right after.
- Be warm, patient and respectful. Address them politely (po/opo when replying in Tagalog).
- Never scold them, never rush them, never say their question is silly.
- If their message is unclear, ask ONE simple follow-up question, not several.

Safety rules (these are absolute):
- You are NOT a doctor. Never give a diagnosis. Never give medicine names, doses, or tell them to start, stop or change any medicine.
- For anything serious or persistent, tell them to see a doctor or go to the nearest health center or the 3S Center Valenzuela.
- If they describe an emergency (chest pain, trouble breathing, stroke signs, heavy bleeding, fall, thoughts of hurting themselves), tell them FIRST and immediately to call 911 or press the red SOS button in the SCIA app, and to get someone nearby to help them.
- You can help with SCIA itself: OSCA senior ID, appointments, events and ayuda announcements, health centers, and the SOS button.
- If you do not know something, say so plainly and point them to OSCA Valenzuela.`;

const CHAT_PROMPT = `${SENIOR_BASE}

Format for the chat screen:
- Keep replies under about 120 words.
- Use short paragraphs, or a short numbered list for steps.
- No tables. No headings. Keep formatting simple — it is read on a phone in large text.`;

const VOICE_PROMPT = `${SENIOR_BASE}

Format for the voice assistant — this answer will be READ ALOUD:
- Answer in 1 to 3 short sentences. Under 60 words. Nothing more.
- Plain speech only: no markdown, no asterisks, no bullet points, no emoji, no numbered lists, no URLs.
- Write numbers and times the way a person says them ("nine one one", "eight in the morning").
- If they need steps, say at most three, joined naturally in sentences.
- If the request is not clear, ask one short question back.`;

// ── Internals ────────────────────────────────────────────────────────────
function aiInstance() {
  // Gemini Developer API backend — no Blaze plan required.
  return getAI(getApp(), { backend: new GoogleAIBackend() });
}

/**
 * Different SDK versions expose the reply either as text() or as text.
 * This survives both so a minor SDK bump does not silently break the app.
 */
export function readText(response: any): string {
  if (!response) return "";
  const t = response.text;
  const raw = typeof t === "function" ? t.call(response) : t;
  return typeof raw === "string" ? raw : "";
}

/**
 * Turns a raw SDK/network error into something a senior can act on, and
 * logs the real error for you. The mapping mirrors the failures you will
 * actually hit while setting Firebase AI Logic up.
 */
export function friendlyAIError(err: unknown): string {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  console.error("[HealthAI]", err);

  if (msg.includes("404") || msg.includes("not found") || msg.includes("no longer available")) {
    return "The assistant is being updated. Please try again later.";
  }
  if (msg.includes("app check") || msg.includes("attestation") || msg.includes("403") || msg.includes("permission")) {
    return "The assistant is not available right now. Please try again later.";
  }
  if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
    return "Many people are using the assistant right now. Please try again in a few minutes.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
    return "I cannot reach the internet. Please check your connection and try again.";
  }
  return "Sorry, something went wrong. Please try again.";
}

// ── Text chat ────────────────────────────────────────────────────────────
export function getChatModel() {
  return getGenerativeModel(aiInstance(), {
    model: CHAT_MODEL,
    systemInstruction: CHAT_PROMPT,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
      topP: 0.9,
    },
  });
}

export function createNativeChatSession(history: ChatHistoryItem[] = []) {
  return getChatModel().startChat({ history });
}

// ── Voice: speech -> text ────────────────────────────────────────────────
/**
 * Sends the recorded clip to Gemini and gets back just the words that were
 * spoken. Gemini handles Tagalog/Taglish far better than a generic STT
 * engine, which is the whole reason we transcribe here instead of on-device.
 *
 * Returns "" when nothing intelligible was said, so the caller can show
 * "I did not catch that" instead of sending noise to the model.
 */
export async function transcribeAudio(params: {
  base64: string;
  mimeType: string;
}): Promise<string> {
  const model = getGenerativeModel(aiInstance(), {
    model: AUDIO_MODEL,
    systemInstruction:
      "You are a transcription engine. You output only a transcript, never a reply, never a comment.",
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });

  const result = await model.generateContent([
    {
      inlineData: { mimeType: params.mimeType, data: params.base64 },
    },
    {
      text:
        "Transcribe exactly what the speaker says. The speaker is an elderly Filipino and may speak English, Tagalog, or a mix of both. " +
        "Keep their original language — do not translate. " +
        "Output ONLY the transcript with no quotes and no extra words. " +
        "If there is no clear speech, output exactly: NO_SPEECH",
    },
  ]);

  const text = readText(result.response).trim();
  if (!text || text.toUpperCase().includes("NO_SPEECH")) return "";
  return text;
}

// ── Voice: text -> answer ────────────────────────────────────────────────
/**
 * One-shot question for the voice assistant, with the previous turns passed
 * in so follow-ups like "ano ulit yung una?" still make sense.
 * Uses VOICE_PROMPT so the answer is short and speakable.
 */
export async function askHealthAIVoice(
  question: string,
  history: ChatHistoryItem[] = [],
): Promise<string> {
  const model = getGenerativeModel(aiInstance(), {
    model: CHAT_MODEL,
    systemInstruction: VOICE_PROMPT,
    generationConfig: {
      maxOutputTokens: 256,
      temperature: 0.6,
      topP: 0.9,
    },
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(question);
  return readText(result.response).trim();
}

/**
 * Strips anything that would sound wrong when spoken aloud. Cheap insurance
 * in case the model slips a bullet or an asterisk into a voice answer.
 */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
