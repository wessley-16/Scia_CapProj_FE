// lib/voiceAI.ts
//
// Voice-assistant AI calls. Sits next to lib/firebaseAI.ts and reuses its
// Vertex AI setup. Differences from the older helpers in firebaseAI.ts:
//  - the reply language is FORCED by the app setting ("en" or "tl"), no
//    matter which language the person spoke
//  - both calls also return the token usage, so hooks/useVoiceAssistant.ts
//    can charge it to the user's spending cap (lib/aiUsage.ts)
//
// Needs two tiny edits in lib/firebaseAI.ts — add the word `export` to:
//    function aiInstance()   ->   export function aiInstance()
//    const VOICE_PROMPT      ->   export const VOICE_PROMPT

import type { UsageLike } from "@/lib/aiUsage";
import {
  AUDIO_MODEL,
  CHAT_MODEL,
  VOICE_PROMPT,
  aiInstance,
  readText,
  type ChatHistoryItem,
} from "@/lib/firebaseAI";
import { getGenerativeModel } from "@react-native-firebase/ai";

export type VoiceLang = "en" | "tl";

/**
 * Turns whatever your settings store into "en" or "tl".
 * Accepts "en", "en-US", "English", "tl", "fil", "fil-PH", "Tagalog",
 * "Filipino"... anything else falls back to English.
 */
export function normalizeVoiceLanguage(value: unknown): VoiceLang {
  const s = String(value ?? "").trim().toLowerCase();
  if (
    s.startsWith("tl") ||
    s.startsWith("fil") ||
    s.includes("tagalog") ||
    s.includes("filipino")
  ) {
    return "tl";
  }
  return "en";
}

// The base prompt (SENIOR_BASE) says "reply in the language they used".
// These rules are appended AFTER it and explicitly override that.
const LANGUAGE_RULE: Record<VoiceLang, string> = {
  en:
    "LANGUAGE (this overrides any earlier rule about language): Reply ONLY in English, " +
    "in simple everyday words, even if the person spoke Tagalog or Taglish.",
  tl:
    "WIKA (mas mataas ito kaysa sa anumang naunang tuntunin tungkol sa wika): Sumagot LAMANG sa Tagalog (Filipino), " +
    "sa simple at pang-araw-araw na salita, kahit English o Taglish ang tanong. Gumamit ng \"po\" at \"opo\". " +
    "Huwag sumagot sa English, maliban sa mga pangalan gaya ng OSCA o SOS, at sa mga numerong bibigkasin " +
    "(halimbawa \"nine one one\").",
};

const LANGUAGE_NUDGE: Record<VoiceLang, string> = {
  en: "(Answer in English only.)",
  tl: "(Sagot sa Tagalog lamang.)",
};

export type VoiceResult = { text: string; usage: UsageLike };

// ── Speech -> text ───────────────────────────────────────────────────────
/**
 * Sends the recorded clip to Gemini and gets back only the words spoken, in
 * the ORIGINAL language (no translation — the reply language is decided
 * separately by the app setting). Returns text "" when nothing was said.
 */
export async function transcribeAudioWithUsage(params: {
  base64: string;
  mimeType: string;
}): Promise<VoiceResult> {
  const model = getGenerativeModel(aiInstance(), {
    model: AUDIO_MODEL,
    systemInstruction:
      "You are a transcription engine. You output only a transcript, never a reply, never a comment.",
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });

  const result = await model.generateContent([
    { inlineData: { mimeType: params.mimeType, data: params.base64 } },
    {
      text:
        "Transcribe exactly what the speaker says. The speaker is an elderly Filipino and may speak English, Tagalog, or a mix of both. " +
        "Keep their original language — do not translate. " +
        "Output ONLY the transcript with no quotes and no extra words. " +
        "If there is no clear speech, output exactly: NO_SPEECH",
    },
  ]);

  const usage = (result.response as any)?.usageMetadata ?? null;
  const text = readText(result.response).trim();
  if (!text || text.toUpperCase().includes("NO_SPEECH")) return { text: "", usage };
  return { text, usage };
}

// ── Text -> answer (in the language from settings) ───────────────────────
/**
 * One question for the voice assistant, with previous turns so follow-ups
 * make sense. The answer is short, speakable, and ALWAYS in `language`.
 */
export async function askHealthAIVoiceWithUsage(
  question: string,
  history: ChatHistoryItem[],
  language: VoiceLang,
): Promise<VoiceResult> {
  const model = getGenerativeModel(aiInstance(), {
    model: CHAT_MODEL,
    systemInstruction: `${VOICE_PROMPT}\n\n${LANGUAGE_RULE[language]}`,
    generationConfig: {
      // Roomy on purpose: if the model "thinks" first, those tokens can
      // count against this limit and cut the spoken answer short.
      maxOutputTokens: 512,
      temperature: 0.6,
      topP: 0.9,
    },
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(`${LANGUAGE_NUDGE[language]}\n${question}`);

  return {
    text: readText(result.response).trim(),
    usage: (result.response as any)?.usageMetadata ?? null,
  };
}