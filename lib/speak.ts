// lib/speak.ts
//
// Read-aloud for seniors who find small text hard to read. Uses the phone's
// own voice (expo-speech): Filipino first, falling back to Philippine English
// when the phone has no Filipino voice installed.

import * as Speech from "expo-speech";

const FIL = "fil-PH";
const EN = "en-PH";

let filipinoOk: boolean | null = null;

async function pickLanguage(preferFilipino: boolean): Promise<string> {
  if (!preferFilipino) return EN;
  if (filipinoOk === null) {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      filipinoOk = voices.some((v) => /^(fil|tl)([-_]|$)/i.test(v.language));
    } catch {
      filipinoOk = false;
    }
  }
  return filipinoOk ? FIL : EN;
}

export async function speak(text: string, preferFilipino = true, onDone?: () => void): Promise<void> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  try {
    await Speech.stop();
    const language = await pickLanguage(preferFilipino);
    Speech.speak(clean, {
      language,
      rate: 0.85, // slightly slower than normal, easier to follow
      onDone,
      onStopped: onDone,
      onError: onDone,
    });
  } catch {
    onDone?.();
  }
}

export function stopSpeaking(): void {
  Speech.stop().catch(() => {});
}
