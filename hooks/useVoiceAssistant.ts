// hooks/useVoiceAssistant.ts
//
// Sequential (non-live) voice pipeline: record -> transcribe -> ask -> speak.
// Replaces the old Live API hook (hooks/useVoice.ts, deleted) with something
// that needs no native module / no dev build — just expo-av + expo-speech.
//
// Flow per tap:
//   idle --(tap)--> recording --(tap)--> transcribing --> thinking --> speaking --> idle

import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system";
import {
  askHealthAIVoice,
  cleanForSpeech,
  friendlyAIError,
  transcribeAudio,
  type ChatHistoryItem,
} from "@/lib/firebaseAI";


export type VoiceStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export function useVoiceAssistant() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const historyRef = useRef<ChatHistoryItem[]>([]);

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lastQuestion, setLastQuestion] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const [lastError, setLastError] = useState("");

  // ── Start recording ──────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setLastError("");
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setLastError("Microphone permission denied. Enable it in Settings.");
        setStatus("error");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setStatus("recording");
    } catch (err) {
      console.error("[useVoiceAssistant] startRecording", err);
      setLastError(friendlyAIError(err));
      setStatus("error");
    }
  }, []);

  // ── Stop recording -> transcribe -> ask -> speak ────────────────────
  const stopRecordingAndRespond = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;

    try {
      setStatus("transcribing");
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      if (!uri) throw new Error("No recording URI");

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const question = await transcribeAudio({
        base64,
        mimeType: "audio/m4a",
      });

      if (!question) {
        setLastError("I did not catch that. Please try again.");
        setStatus("error");
        return;
      }
      setLastQuestion(question);

      setStatus("thinking");
      const answer = await askHealthAIVoice(question, historyRef.current);

      historyRef.current = [
        ...historyRef.current,
        { role: "user", parts: [{ text: question }] },
        { role: "model", parts: [{ text: answer }] },
      ];
      setLastAnswer(answer);

      setStatus("speaking");
      const spoken = cleanForSpeech(answer);
      await new Promise<void>((resolve) => {
        Speech.speak(spoken, {
          language: "fil-PH", // adjust or detect per-question if you mix en/tl
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => resolve(),
        });
      });

      setStatus("idle");
    } catch (err) {
      console.error("[useVoiceAssistant] pipeline", err);
      setLastError(friendlyAIError(err));
      setStatus("error");
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) {
      try { await recording.stopAndUnloadAsync(); } catch {}
    }
    Speech.stop();
    setStatus("idle");
  }, []);

  const resetConversation = useCallback(() => {
    historyRef.current = [];
    setLastQuestion("");
    setLastAnswer("");
    setLastError("");
  }, []);

  return {
    status,
    lastQuestion,
    lastAnswer,
    lastError,
    startRecording,
    stopRecordingAndRespond,
    cancelRecording,
    resetConversation,
  };
}
