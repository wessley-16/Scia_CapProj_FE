// hooks/useVoiceAssistant.ts
//
// The voice assistant, rebuilt as the four-step pipeline you described:
//
//   1. RECORD    user holds/taps the big button, we capture a clip
//   2. TRANSCRIBE the clip goes to Gemini, which returns the words spoken
//   3. ANSWER     the transcript goes to HealthAI, which returns short text
//   4. SPEAK      the device reads that answer out loud
//
// Why not the old Gemini Live API hook (useLiveVoice.ts):
//  - it needs a bidirectional websocket, which the JS SDK only officially
//    supports in modern browsers and Node 22+, not React Native
//  - it needs @siteed/audio-studio, a native module that cannot run in
//    Expo Go, so the feature was dead on every device you tested with
//  - the model name it used ("gemini-live-2.5-flash-native-audio") only
//    exists on the Vertex/Agent Platform backend, which needs Blaze billing
//  - there was no text of the question or answer on screen, and seniors
//    need to SEE what the app heard
//
// This pipeline is slower by a second or two, but it works on Expo Go and
// on a dev build, shows text for both sides, and can be replayed.
//
// NEW DEPENDENCY — run this once:
//   npx expo install expo-speech

import { useSettings } from "@/context/SettingsContext";
import {
  askHealthAIVoice,
  cleanForSpeech,
  friendlyAIError,
  transcribeAudio,
  type ChatHistoryItem,
} from "@/lib/firebaseAI";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

export type VoiceStatus =
  | "idle"        // ready, waiting for a tap
  | "recording"   // mic is open
  | "transcribing"// clip is being turned into text
  | "thinking"    // HealthAI is writing the answer
  | "speaking"    // answer is being read out loud
  | "error";

export type VoiceTurn = {
  id: string;
  question: string;
  answer: string;
};

// Keep the last few exchanges so follow-ups ("ano po ulit yung pangalawa?")
// still make sense to the model.
const MAX_CONTEXT_TURNS = 4;

// Anything shorter than this is almost always an accidental tap.
const MIN_RECORDING_MS = 700;
// Hard stop, so a senior who forgets to tap again does not upload 10 minutes.
const MAX_RECORDING_MS = 60_000;

let _turnCounter = 0;
const newId = () => `turn_${Date.now()}_${(_turnCounter += 1)}`;

// ── Recording format ─────────────────────────────────────────────────────
// Both of these are MIME types Gemini officially accepts as inline audio.
// Android writes raw AAC (.aac), iOS writes linear PCM in a WAV container.
// 16 kHz mono is plenty for speech and keeps the upload small — the whole
// request has to stay under 20 MB.
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: ".aac",
    outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: ".wav",
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 64000,
  },
};

function mimeTypeForUri(uri: string): string {
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "wav": return "audio/wav";
    case "aac": return "audio/aac";
    case "m4a": return "audio/mp4";
    case "mp3": return "audio/mp3";
    case "ogg": return "audio/ogg";
    case "webm": return "audio/webm";
    default: return "audio/aac";
  }
}

/**
 * expo-file-system changed API in SDK 54: the old readAsStringAsync moved to
 * the /legacy entry point and a File class took its place. This tries the
 * new one first and falls back, so it keeps working through the migration.
 */
async function readFileAsBase64(uri: string): Promise<string> {
  try {
    const FS: any = require("expo-file-system");
    if (FS?.File) {
      const file = new FS.File(uri);
      const data = await file.base64();
      if (typeof data === "string" && data.length > 0) return data;
    }
    if (typeof FS?.readAsStringAsync === "function") {
      return await FS.readAsStringAsync(uri, { encoding: "base64" });
    }
  } catch {
    // fall through to legacy
  }
  const Legacy: any = require("expo-file-system/legacy");
  return await Legacy.readAsStringAsync(uri, { encoding: "base64" });
}

// Map the app's language setting onto a TTS locale. "fil-PH" is what
// Android's speech engine registers Filipino under; iOS is happy with it too.
function ttsLocale(language: string): string {
  return language?.startsWith("tl") || language?.startsWith("fil")
    ? "fil-PH"
    : "en-US";
}

export function useVoiceAssistant() {
  const { language } = useSettings();

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [partialQuestion, setPartialQuestion] = useState(""); // shown while thinking
  const [errorMessage, setErrorMessage] = useState("");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const startedAtRef = useRef<number>(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadRef = useRef(false);
  // Lets the max-length timeout (set inside startRecording) call the finish
  // handler, which is defined further down. Assigned in an effect below.
  const finishRef = useRef<() => Promise<void>>(async () => {});

  const isBusy =
    status === "transcribing" || status === "thinking";

  const set = useMemo(
    () => ({
      status: (v: VoiceStatus) => { if (!deadRef.current) setStatus(v); },
      error: (v: string) => { if (!deadRef.current) setErrorMessage(v); },
      partial: (v: string) => { if (!deadRef.current) setPartialQuestion(v); },
    }),
    [],
  );

  // ── Cleanup ────────────────────────────────────────────────────────────
  useEffect(() => {
    deadRef.current = false;
    return () => {
      deadRef.current = true;
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      Speech.stop();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      const spoken = cleanForSpeech(text);
      if (!spoken) return;
      Speech.stop();
      set.status("speaking");
      Speech.speak(spoken, {
        language: ttsLocale(language),
        // Deliberately slower than default — this is the single biggest
        // usability win for elderly listeners.
        rate: Platform.OS === "ios" ? 0.45 : 0.85,
        pitch: 1.0,
        onDone: () => set.status("idle"),
        onStopped: () => set.status("idle"),
        onError: () => set.status("idle"),
      });
    },
    [language, set],
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    set.status("idle");
  }, [set]);

  // ── Step 1: record ─────────────────────────────────────────────────────
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (recordingRef.current || isBusy) return false;

    set.error("");
    Speech.stop();

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        set.error(
          "Kailangan po ng pahintulot sa mikropono. Pumunta sa Settings > Apps > SCIA > Permissions at buksan ang Microphone.",
        );
        set.status("error");
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();

      recordingRef.current = recording;
      startedAtRef.current = Date.now();
      set.status("recording");

      // Safety net so the mic never stays open forever.
      autoStopRef.current = setTimeout(() => {
        void finishRef.current();
      }, MAX_RECORDING_MS);

      return true;
    } catch (err) {
      console.error("[Voice] startRecording", err);
      recordingRef.current = null;
      set.error("Hindi ma-buksan ang mikropono. Pakisubukan ulit.");
      set.status("error");
      return false;
    }
  }, [isBusy, set]);

  // ── Steps 2-4: transcribe, answer, speak ───────────────────────────────
  const stopRecordingAndAsk = useCallback(async () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }

    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;

    const elapsed = Date.now() - startedAtRef.current;

    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
    } catch (err) {
      console.error("[Voice] stopRecording", err);
    }

    // Hand the audio route back to playback, otherwise iOS keeps the output
    // routed to the tiny earpiece speaker and the answer sounds broken.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    if (!uri || elapsed < MIN_RECORDING_MS) {
      set.error("Masyadong maikli po. Pindutin ang butones, magsalita, tapos pindutin ulit.");
      set.status("error");
      return;
    }

    try {
      // Step 2 — speech to text
      set.status("transcribing");
      const base64 = await readFileAsBase64(uri);
      const question = await transcribeAudio({
        base64,
        mimeType: mimeTypeForUri(uri),
      });

      if (!question) {
        set.error("Hindi ko po naintindihan. Pakiulit po nang malakas at malapit sa telepono.");
        set.status("error");
        return;
      }

      set.partial(question);

      // Step 3 — HealthAI answers
      set.status("thinking");
      const history: ChatHistoryItem[] = turns
        .slice(-MAX_CONTEXT_TURNS)
        .flatMap((t) => [
          { role: "user" as const, parts: [{ text: t.question }] },
          { role: "model" as const, parts: [{ text: t.answer }] },
        ]);

      const answer = await askHealthAIVoice(question, history);
      const finalAnswer =
        answer || "Pasensya po, wala akong nakuhang sagot. Pakisubukan ulit.";

      if (deadRef.current) return;

      setTurns((prev) => [...prev, { id: newId(), question, answer: finalAnswer }]);
      set.partial("");

      // Step 4 — read it out loud
      speak(finalAnswer);
    } catch (err) {
      set.partial("");
      set.error(friendlyAIError(err));
      set.status("error");
    }
  }, [set, speak, turns]);

  useEffect(() => {
    finishRef.current = stopRecordingAndAsk;
  }, [stopRecordingAndAsk]);

  /** One button, two meanings: start if idle, finish if recording. */
  const toggleRecording = useCallback(async () => {
    if (status === "speaking") {
      stopSpeaking();
      return;
    }
    if (recordingRef.current) {
      await stopRecordingAndAsk();
      return;
    }
    if (isBusy) return;
    await startRecording();
  }, [status, isBusy, startRecording, stopRecordingAndAsk, stopSpeaking]);

  /** Cancels a recording without sending it anywhere. */
  const cancelRecording = useCallback(async () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) {
      await recording.stopAndUnloadAsync().catch(() => {});
    }
    set.status("idle");
  }, [set]);

  const replayLast = useCallback(() => {
    const last = turns[turns.length - 1];
    if (last) speak(last.answer);
  }, [turns, speak]);

  const clearConversation = useCallback(() => {
    Speech.stop();
    setTurns([]);
    set.partial("");
    set.error("");
    set.status("idle");
  }, [set]);

  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  return {
    status,
    turns,
    lastTurn,
    partialQuestion,
    errorMessage,
    isRecording: status === "recording",
    isBusy,
    isSpeaking: status === "speaking",
    toggleRecording,
    cancelRecording,
    stopSpeaking,
    replayLast,
    clearConversation,
  };
}