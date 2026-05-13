/**
 * useLiveVoice — Firebase AI Logic Live voice session
 *
 * Architecture: stream raw PCM chunks → session.sendRealtimeAudio() in real-time
 * so the server's built-in VAD detects when the user stops talking and auto-responds.
 *
 * NO manual "tap to stop" needed — just tap once to start, speak, and the model
 * replies automatically when it detects silence.
 *
 * Uses @siteed/audio-studio (formerly expo-audio-stream).
 * Correct API:
 *   - ExpoAudioStreamModule.requestPermissionsAsync() → { status: 'granted' | ... }
 *   - startRecording({ ..., onAudioStream: (event) => {} }) — callback is in the config
 *   - stopRecording()
 *   All imported from '@siteed/audio-studio'
 */

import {
  ResponseModality,
  VertexAIBackend,
  getAI,
  getLiveGenerativeModel,
} from "@react-native-firebase/ai";
import { getApp } from "@react-native-firebase/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── @siteed/audio-studio ──────────────────────────────────────────────────────
// The package exports:
//   ExpoAudioStreamModule  — native module (has requestPermissionsAsync)
//   startRecording         — standalone function (config includes onAudioStream callback)
//   stopRecording          — standalone function
let AudioStudioModule: any = null;
let audioStudioStartRecording: ((config: any) => Promise<any>) | null = null;
let audioStudioStopRecording: (() => Promise<any>) | null = null;

try {
  const AudioStudio = require("@siteed/audio-studio");
  // The native module is the correct place for permissions
  AudioStudioModule =
    AudioStudio.ExpoAudioStreamModule ??
    AudioStudio.default?.ExpoAudioStreamModule ??
    null;
  audioStudioStartRecording =
    AudioStudio.startRecording ??
    AudioStudio.default?.startRecording ??
    null;
  audioStudioStopRecording =
    AudioStudio.stopRecording ??
    AudioStudio.default?.stopRecording ??
    null;
} catch (e) {
  console.warn("@siteed/audio-studio not available:", e);
}

// ── Playback: prefer expo-audio (SDK 54+), fall back to expo-av ───────────────
let AudioModule: any = null;
try {
  AudioModule = require("expo-audio");
} catch {
  try {
    AudioModule = require("expo-av").Audio;
  } catch {
    console.warn("No audio playback module available.");
  }
}
const Audio = AudioModule;

// ── Types ─────────────────────────────────────────────────────────────────────
type LiveStatus = "idle" | "connecting" | "connected" | "responding" | "error";

// ── Constants ─────────────────────────────────────────────────────────────────
const MIC_SAMPLE_RATE = 16000;   // Live API input: 16kHz mono PCM
const OUTPUT_SAMPLE_RATE = 24000; // Live API output: 24kHz mono PCM

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseSampleRate = (mimeType?: string): number => {
  if (!mimeType) return OUTPUT_SAMPLE_RATE;
  const match = mimeType.match(/rate=(\d+)/i);
  if (!match) return OUTPUT_SAMPLE_RATE;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : OUTPUT_SAMPLE_RATE;
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return globalThis.btoa(binary);
};

const pcmToWavDataUri = (chunks: Uint8Array[], sampleRate: number): string => {
  const pcmByteLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const wavBytes = new Uint8Array(44 + pcmByteLength);
  const view = new DataView(wavBytes.buffer);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmByteLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcmByteLength, true);
  let offset = 44;
  for (const chunk of chunks) {
    wavBytes.set(chunk, offset);
    offset += chunk.length;
  }
  return `data:audio/wav;base64,${bytesToBase64(wavBytes)}`;
};

const safeSetAudioMode = async (opts: Record<string, unknown>) => {
  if (!Audio) return;
  try {
    if (typeof Audio.setAudioModeAsync === "function") {
      await Audio.setAudioModeAsync(opts);
    }
  } catch {
    /* noop */
  }
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useLiveVoice = () => {
  const sessionRef       = useRef<any>(null);
  const soundRef         = useRef<any>(null);
  const isRecordingRef   = useRef(false); // tracks native recording state
  const pcmChunksRef     = useRef<Uint8Array[]>([]);
  const pcmSampleRateRef = useRef(OUTPUT_SAMPLE_RATE);
  const audioQueueRef    = useRef<string[]>([]);
  const isPlayingRef     = useRef(false);

  const [status, setStatus]                     = useState<LiveStatus>("idle");
  const [inputTranscript, setInputTranscript]   = useState("");
  const [outputTranscript, setOutputTranscript] = useState("");
  const [lastError, setLastError]               = useState("");
  const [diagnostic, setDiagnostic]             = useState("");
  const [interrupted, setInterrupted]           = useState(false);
  const [isRecording, setIsRecording]           = useState(false);

  const isConnected = status === "connected" || status === "responding";

  // ── Teardown ───────────────────────────────────────────────────────────────
  const clearAudioState = useCallback(async () => {
    if (isRecordingRef.current) {
      try { await audioStudioStopRecording?.(); } catch {}
      isRecordingRef.current = false;
    }
    pcmChunksRef.current = [];
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // ── Playback queue ─────────────────────────────────────────────────────────
  const playQueue = useCallback(async () => {
    if (isPlayingRef.current || !Audio) return;
    isPlayingRef.current = true;
    try {
      while (audioQueueRef.current.length > 0) {
        const uri = audioQueueRef.current.shift();
        if (!uri) continue;
        await safeSetAudioMode({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
        );
        soundRef.current = sound;
        await new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((s: any) => {
            if (s.isLoaded && s.didJustFinish) resolve();
          });
        });
        await sound.unloadAsync();
        soundRef.current = null;
      }
    } catch (err) {
      setLastError("Audio playback failed.");
      setDiagnostic(err instanceof Error ? err.message : "Unknown audio error.");
    } finally {
      isPlayingRef.current = false;
    }
  }, []);

  const flushAudioTurn = useCallback(async () => {
    if (pcmChunksRef.current.length === 0) return;
    try {
      const uri = pcmToWavDataUri(pcmChunksRef.current, pcmSampleRateRef.current);
      pcmChunksRef.current = [];
      audioQueueRef.current.push(uri);
      await playQueue();
    } catch {
      setLastError("Failed to decode model audio.");
      pcmChunksRef.current = [];
    }
  }, [playQueue]);

  // ── Session message handler ────────────────────────────────────────────────
  const handleMessage = useCallback(async (message: any) => {
    if (!message) return;

    if (message.serverContent?.interrupted === true) {
      setInterrupted(true);
      pcmChunksRef.current = [];
      setStatus("connected");
    }

    const parts = message.serverContent?.modelTurn?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        const inlineData = part?.inlineData;
        if (!inlineData?.data || !inlineData.mimeType?.startsWith("audio/pcm"))
          continue;
        pcmSampleRateRef.current = parseSampleRate(inlineData.mimeType);
        try { pcmChunksRef.current.push(base64ToBytes(inlineData.data)); } catch {}
      }
    }

    if (message.serverContent?.inputTranscription?.text) {
      setInputTranscript(message.serverContent.inputTranscription.text);
    }
    if (message.serverContent?.outputTranscription?.text) {
      setOutputTranscript(message.serverContent.outputTranscription.text);
      setStatus("responding");
    }

    if (message.serverContent?.turnComplete === true) {
      await flushAudioTurn();
      setStatus("connected");
    }
  }, [flushAudioTurn]);

  // ── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (sessionRef.current) return;
    setLastError("");
    setDiagnostic("");
    setInterrupted(false);
    setStatus("connecting");

    try {
      const app = getApp();
      const ai = getAI(app, { backend: new VertexAIBackend("us-central1") });

      const liveModel = getLiveGenerativeModel(ai, {
        model: "gemini-live-2.5-flash-native-audio",
        liveGenerationConfig: {
          responseModalities: [ResponseModality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        systemInstruction: {
          parts: [{
            text: `You are HealthAI, a caring voice assistant for senior citizens 
in Valenzuela City, Philippines (SCIA app). Speak simply and warmly. 
Never diagnose — always recommend seeing a doctor for serious concerns. 
If someone describes an emergency, tell them to call 911 or use the SOS button immediately.`,
          }],
        },
      });

      setDiagnostic("Connecting to Gemini Live...");
      const session = await liveModel.connect();
      sessionRef.current = session;
      setStatus("connected");
      setDiagnostic("Connected. Tap mic to speak.");

      (async () => {
        try {
          for await (const message of session.receive()) {
            await handleMessage(message);
          }
          if (sessionRef.current) {
            sessionRef.current = null;
            setStatus("idle");
            setDiagnostic("Session ended.");
          }
        } catch (err) {
          if (sessionRef.current) {
            sessionRef.current = null;
            setLastError(err instanceof Error ? err.message : "Session error.");
            setStatus("error");
          }
        }
      })();
    } catch (err) {
      sessionRef.current = null;
      setLastError(err instanceof Error ? err.message : "Failed to connect.");
      setDiagnostic("Connection failed.");
      setStatus("error");
    }
  }, [handleMessage]);

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    try { session?.close(); } catch {}
    void clearAudioState();
    setDiagnostic("");
    setStatus("idle");
  }, [clearAudioState]);

  useEffect(() => {
    return () => {
      const session = sessionRef.current;
      sessionRef.current = null;
      try { session?.close(); } catch {}
      void clearAudioState();
    };
  }, [clearAudioState]);

  // ── Start streaming mic → sendRealtimeAudio ────────────────────────────────
  //
  // KEY FIX: @siteed/audio-studio API
  //   - Permissions: ExpoAudioStreamModule.requestPermissionsAsync()
  //     returns { status: 'granted' | 'denied' | 'undetermined' }
  //     (NOT { granted: boolean } like expo-av)
  //   - Recording: startRecording({ ..., onAudioStream: callback })
  //     The PCM stream callback goes INSIDE the config object, not via addAudioEventListener
  //
  const startMicRecording = useCallback(async (): Promise<boolean> => {
    if (!sessionRef.current) {
      setLastError("Connect first before recording.");
      return false;
    }
    if (isRecordingRef.current) return true;

    if (!AudioStudioModule || !audioStudioStartRecording) {
      setLastError(
        "@siteed/audio-studio not available. Run: yarn add @siteed/audio-studio"
      );
      return false;
    }

    try {
      // ── Request permissions ────────────────────────────────────────────────
      // ExpoAudioStreamModule.requestPermissionsAsync() returns { status: string }
      const permResult = await AudioStudioModule.requestPermissionsAsync();
      const granted =
        permResult?.status === "granted" ||
        permResult?.granted === true; // fallback for older versions
      if (!granted) {
        setLastError("Microphone permission is required.");
        return false;
      }

      await safeSetAudioMode({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // ── Start recording with inline onAudioStream callback ─────────────────
      // @siteed/audio-studio delivers PCM chunks via onAudioStream in the config.
      // event.data is a base64-encoded PCM string, same format the Live API expects.
      await audioStudioStartRecording({
        sampleRate: MIC_SAMPLE_RATE,  // 16kHz — required by Gemini Live API
        channels: 1,                  // mono
        encoding: "pcm_16bit",        // 16-bit PCM
        interval: 100,                // fire onAudioStream every 100ms
        onAudioStream: async (event: { data: string; position?: number }) => {
          const session = sessionRef.current;
          if (!session || !event?.data) return;
          try {
            session.sendRealtimeAudio({
              data: event.data,
              mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`,
            });
          } catch {
            // Ignore individual chunk send errors — network hiccups are recoverable
          }
        },
      });

      isRecordingRef.current = true;
      setIsRecording(true);
      setInterrupted(false);
      setDiagnostic("Listening… speak now. I'll respond automatically.");
      return true;
    } catch (err) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setLastError("Failed to start microphone.");
      setDiagnostic(
        err instanceof Error ? err.message : "Unknown recording error."
      );
      return false;
    }
  }, []);

  // ── Stop streaming mic ─────────────────────────────────────────────────────
  const stopMicRecording = useCallback(async (): Promise<boolean> => {
    if (!isRecordingRef.current) return false;
    try {
      await audioStudioStopRecording?.();
      isRecordingRef.current = false;
      setIsRecording(false);
      await safeSetAudioMode({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      setDiagnostic("Mic off.");
      return true;
    } catch (err) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setLastError("Failed to stop microphone.");
      return false;
    }
  }, []);

  // ── Toggle (mic button in Voice.tsx) ──────────────────────────────────────
  const toggleMic = useCallback(async () => {
    if (!isConnected) {
      await connect();
      setTimeout(() => startMicRecording(), 600);
      return;
    }
    if (isRecording) {
      await stopMicRecording();
    } else {
      await startMicRecording();
    }
  }, [isConnected, isRecording, connect, startMicRecording, stopMicRecording]);

  const resetSession = useCallback(() => {
    setInputTranscript("");
    setOutputTranscript("");
    setInterrupted(false);
    setLastError("");
    setDiagnostic("");
    void clearAudioState();
  }, [clearAudioState]);

  return useMemo(
    () => ({
      status,
      isConnected,
      isRecording,
      inputTranscript,
      outputTranscript,
      interrupted,
      lastError,
      diagnostic,
      connect,
      disconnect,
      resetSession,
      toggleMic,
      startMicRecording,
      stopMicRecording,
    }),
    [
      status,
      isConnected,
      isRecording,
      inputTranscript,
      outputTranscript,
      interrupted,
      lastError,
      diagnostic,
      connect,
      disconnect,
      resetSession,
      toggleMic,
      startMicRecording,
      stopMicRecording,
    ],
  );
};
