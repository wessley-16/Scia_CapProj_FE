// hooks/useVoiceAssistant.ts
//
// Push-to-talk voice assistant:
//   mic press -> record -> speech-to-text -> AI answer (text) -> spoken aloud
//
// The ANSWER language comes from the app's language setting, not from what
// the person said. Pass the setting in:  useVoiceAssistant(language)
// ("en" / "tl" / "English" / "Tagalog" / "fil-PH" ... all understood).
//
// Every AI call is charged to the same per-user cap as the chatbot
// (lib/aiUsage.ts). Speaking the answer uses the phone's own text-to-speech
// (expo-speech), which is free and does not count toward the cap.

import { useAuth } from "@/context/AuthContext";
import {
  assertWithinBudget,
  isBudgetError,
  recordUsage,
} from "@/lib/aiUsage";
import {
  cleanForSpeech,
  friendlyAIError,
  type ChatHistoryItem,
} from "@/lib/firebaseAI";
import {
  askHealthAIVoiceWithUsage,
  normalizeVoiceLanguage,
  transcribeAudioWithUsage,
  type VoiceLang,
} from "@/lib/voiceAI";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking";

const GUEST_SCOPE = "guest";
const MAX_RECORD_MS = 30_000; // auto-stop; 30 s of audio is only ~1k tokens
const MIN_RECORD_MS = 700; // shorter than this is a mis-tap, don't send it
const MAX_HISTORY_ITEMS = 8; // last 4 question/answer pairs

// Small, mono, 16 kHz AAC (.m4a). Speech does not need more, and smaller
// files upload faster on a weak connection.
const HQ = Audio.RecordingOptionsPresets.HIGH_QUALITY;
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...HQ,
  android: { ...HQ.android, sampleRate: 16000, numberOfChannels: 1, bitRate: 32000 },
  ios: { ...HQ.ios, sampleRate: 16000, numberOfChannels: 1, bitRate: 32000 },
};

const SPEECH_LOCALE: Record<VoiceLang, string> = { en: "en-US", tl: "fil-PH" };

// Messages shown/spoken by the assistant itself (not by the AI model).
const TEXT: Record<VoiceLang, Record<string, string>> = {
  en: {
    limit:
      "You have reached the limit for using the AI assistant. For more help, please visit OSCA Valenzuela or your nearest health center.",
    noMic: "Please allow the microphone so I can hear you.",
    tooShort: "That was too short. Please tap the mic and speak again.",
    noSpeech: "I did not catch that. Please try again.",
    noAnswer: "Sorry, I have no answer right now. Please try again.",
    error: "Sorry, something went wrong. Please try again.",
  },
  tl: {
    limit:
      "Naabot na po ninyo ang limitasyon sa paggamit ng AI assistant. Para sa iba pang tulong, pumunta po sa OSCA Valenzuela o sa pinakamalapit na health center.",
    noMic: "Pakipayagan po ang microphone para marinig ko kayo.",
    tooShort: "Masyadong maikli po. Pindutin ulit ang mic at magsalita.",
    noSpeech: "Hindi ko po narinig. Pakisubukan ulit.",
    noAnswer: "Pasensya na po, wala akong maisagot ngayon. Pakisubukan ulit.",
    error: "Pasensya na po, may problema. Pakisubukan ulit.",
  },
};

// ── Text-to-speech helpers ───────────────────────────────────────────────
let voiceCache: Speech.Voice[] | null = null;
let warnedMissingTagalog = false;

// Prefer a real Filipino voice when the phone has one installed.
async function pickVoiceId(lang: VoiceLang): Promise<string | undefined> {
  try {
    if (!voiceCache) voiceCache = await Speech.getAvailableVoicesAsync();
    const prefixes = lang === "tl" ? ["fil", "tl"] : ["en-us", "en"];
    for (const prefix of prefixes) {
      const match = voiceCache.find((v) =>
        v.language.toLowerCase().replace("_", "-").startsWith(prefix),
      );
      if (match) return match.identifier;
    }
    if (lang === "tl" && !warnedMissingTagalog) {
      warnedMissingTagalog = true;
      console.warn(
        "[voice] No Filipino text-to-speech voice found on this phone. " +
          "Install Filipino voice data in the phone's Text-to-speech settings, " +
          "otherwise Tagalog will be read with an English voice.",
      );
    }
  } catch (e) {
    console.warn("[voice] Could not list voices:", e);
  }
  return undefined;
}

async function speakText(text: string, lang: VoiceLang): Promise<void> {
  const voice = await pickVoiceId(lang);
  await new Promise<void>((resolve) => {
    Speech.speak(text, {
      language: SPEECH_LOCALE[lang],
      voice,
      rate: 0.9, // a little slower — easier for older listeners
      pitch: 1.0,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

// ── The hook ─────────────────────────────────────────────────────────────
export function useVoiceAssistant(languageSetting?: string | null) {
  const { user, isGuest } = useAuth();
  const scopeKey = isGuest ? GUEST_SCOPE : (user?.uid ?? GUEST_SCOPE);
  const language = normalizeVoiceLanguage(languageSetting);

  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState(""); // what the person said
  const [reply, setReply] = useState(""); // what the assistant answered (text)
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const historyRef = useRef<ChatHistoryItem[]>([]);
  const runIdRef = useRef(0); // bumped on cancel so stale results are ignored
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always read the latest values inside async work / timers.
  const languageRef = useRef<VoiceLang>(language);
  languageRef.current = language;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const stopAndSendRef = useRef<() => Promise<void>>(async () => {});

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetAudioMode = () =>
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false, // otherwise iOS plays speech from the earpiece
      playsInSilentModeIOS: true,
    }).catch(() => {});

  // ── Start recording ────────────────────────────────────────────────────
  const startListening = async () => {
    if (state !== "idle" || recordingRef.current) return;

    const lang = languageRef.current;
    setError(null);
    setTranscript("");
    setReply("");
    Speech.stop();

    // Refuse BEFORE recording if the user's allowance is used up.
    try {
      await assertWithinBudget(scopeRef.current);
    } catch (e) {
      if (isBudgetError(e)) {
        const runId = ++runIdRef.current;
        setReply(TEXT[lang].limit);
        setState("speaking");
        await speakText(TEXT[lang].limit, lang);
        if (runId === runIdRef.current) setState("idle");
      } else {
        friendlyAIError(e); // logs the real reason
        setError(TEXT[lang].error);
      }
      return;
    }

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setError(TEXT[lang].noMic);
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      setState("listening");

      clearTimer();
      timerRef.current = setTimeout(() => {
        void stopAndSendRef.current();
      }, MAX_RECORD_MS);
    } catch (e) {
      console.warn("[voice] Could not start recording:", e);
      recordingRef.current = null;
      await resetAudioMode();
      setError(TEXT[lang].error);
      setState("idle");
    }
  };

  // ── Stop recording, then transcribe -> answer -> speak ─────────────────
  const stopAndSend = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    clearTimer();

    const runId = ++runIdRef.current;
    const lang = languageRef.current;
    const scope = scopeRef.current;

    let uri: string | null = null;
    let durationMs = 0;
    try {
      const status = await rec.getStatusAsync();
      durationMs = status.durationMillis ?? 0;
      await rec.stopAndUnloadAsync();
      uri = rec.getURI();
    } catch (e) {
      console.warn("[voice] Could not stop recording:", e);
    }
    await resetAudioMode();

    const deleteClip = () =>
      uri
        ? FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
        : Promise.resolve();

    if (!uri || durationMs < MIN_RECORD_MS) {
      await deleteClip();
      setError(TEXT[lang].tooShort);
      setState("idle");
      return;
    }

    try {
      // 1. Speech -> text
      setState("transcribing");
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const heard = await transcribeAudioWithUsage({ base64, mimeType: "audio/mp4" });
      void recordUsage(scope, heard.usage);
      if (runId !== runIdRef.current) return;

      if (!heard.text) {
        setError(TEXT[lang].noSpeech);
        setState("idle");
        return;
      }
      setTranscript(heard.text);

      // 2. Text -> answer, in the language from settings
      setState("thinking");
      const answer = await askHealthAIVoiceWithUsage(heard.text, historyRef.current, lang);
      void recordUsage(scope, answer.usage, answer.text.length);
      if (runId !== runIdRef.current) return;

      const spoken = cleanForSpeech(answer.text) || TEXT[lang].noAnswer;
      setReply(spoken);
      historyRef.current = [
        ...historyRef.current,
        { role: "user" as const, parts: [{ text: heard.text }] },
        { role: "model" as const, parts: [{ text: spoken }] },
      ].slice(-MAX_HISTORY_ITEMS);

      // 3. Answer -> voice
      setState("speaking");
      await speakText(spoken, lang);
    } catch (e) {
      friendlyAIError(e); // logs the real error as "[HealthAI] ..."
      if (runId === runIdRef.current) setError(TEXT[lang].error);
    } finally {
      await deleteClip();
      if (runId === runIdRef.current) setState("idle");
    }
  };
  stopAndSendRef.current = stopAndSend;

  // ── Cancel / replay / mic button ───────────────────────────────────────
  const cancel = useCallback(async () => {
    runIdRef.current += 1; // any request still in flight is now ignored
    clearTimer();
    Speech.stop();
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        /* already stopped */
      }
    }
    await resetAudioMode();
    setState("idle");
  }, []);

  /** Speak the last answer again (nice for people who missed it). */
  const replay = async () => {
    if (state !== "idle" || !reply) return;
    const runId = ++runIdRef.current;
    setState("speaking");
    await speakText(reply, languageRef.current);
    if (runId === runIdRef.current) setState("idle");
  };

  /** One button does it all: tap to talk, tap to send, tap to stop/cancel. */
  const toggleMic = async () => {
    if (state === "idle") await startListening();
    else if (state === "listening") await stopAndSend();
    else await cancel(); // transcribing / thinking / speaking
  };

  // Stop everything when the screen closes.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      Speech.stop();
      const rec = recordingRef.current;
      recordingRef.current = null;
      rec?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  return {
    state,
    isListening: state === "listening",
    isBusy: state !== "idle",
    transcript,
    reply,
    error,
    language,
    toggleMic,
    startListening,
    stopAndSend,
    cancel,
    replay,
  };
}
