/**
 * useLiveVoice — Real-time voice session with Gemini Live via Firebase AI Logic + Vertex AI
 *
 * How it works:
 *  1. connect()  → Opens a Gemini Live WebSocket session via Firebase AI Logic (Vertex AI backend)
 *  2. startMicRecording() → Streams raw 16-bit PCM @ 16 kHz → session.sendRealtimeAudio()
 *  3. Server VAD fires when user stops talking → model sends back PCM audio chunks
 *  4. On turnComplete we assemble the chunks into a WAV and play it via expo-av
 *
 * Supports both @siteed/expo-audio-studio and @siteed/audio-studio (tries both)
 * Playback: expo-av (falls back gracefully if unavailable)
 */

import {
  ResponseModality,
  VertexAIBackend,
  getAI,
  getLiveGenerativeModel,
} from "@react-native-firebase/ai";
import { getApp } from "@react-native-firebase/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Audio recording — try both package names; fallback to no-op so app still boots
// ─────────────────────────────────────────────────────────────────────────────
let _startRecording: ((cfg: any) => Promise<any>) | null = null;
let _stopRecording: (() => Promise<any>) | null = null;
let _requestMicPerm: (() => Promise<any>) | null = null;

const AUDIO_PKG_NAMES = ["@siteed/expo-audio-studio", "@siteed/audio-studio"];

for (const pkgName of AUDIO_PKG_NAMES) {
  try {
    const pkg = require(pkgName);
    _startRecording =
      pkg.startRecording ??
      pkg.default?.startRecording ??
      null;
    _stopRecording =
      pkg.stopRecording ??
      pkg.default?.stopRecording ??
      null;

    // Permissions: ExpoAudioStreamModule.requestPermissionsAsync()
    const streamMod =
      pkg.ExpoAudioStreamModule ??
      pkg.default?.ExpoAudioStreamModule ??
      null;
    if (streamMod?.requestPermissionsAsync) {
      _requestMicPerm = () => streamMod.requestPermissionsAsync();
    }

    if (_startRecording) break; // found a working package
  } catch {
    // try next
  }
}

// Fallback: expo-av mic permissions
if (!_requestMicPerm) {
  try {
    const { Audio } = require("expo-av");
    _requestMicPerm = () => Audio.requestPermissionsAsync();
  } catch {}
}

if (!_startRecording) {
  console.warn(
    "[useLiveVoice] No audio recording package found.\n" +
    "Install one: npx expo install @siteed/expo-audio-studio"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio playback — expo-av (expo-audio as fallback)
// ─────────────────────────────────────────────────────────────────────────────
let AudioLib: any = null;
try {
  AudioLib = require("expo-av").Audio;
} catch {
  try {
    AudioLib = require("expo-audio");
  } catch {
    console.warn("[useLiveVoice] No audio playback module available.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MIC_SAMPLE_RATE = 16_000;    // Gemini Live input  — 16 kHz PCM16 mono
const OUT_SAMPLE_RATE = 24_000;    // Gemini Live output — 24 kHz PCM16 mono
const VERTEX_REGION   = "us-central1";
const LIVE_MODEL      = "gemini-live-2.5-flash-native-audio";
// Fallback if the above model is unavailable:
// const LIVE_MODEL   = "gemini-2.0-flash-live-001";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type LiveStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"   // mic is hot
  | "responding"  // model is speaking
  | "error";

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────
function parseSampleRate(mime?: string): number {
  const m = mime?.match(/rate=(\d+)/i);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : OUT_SAMPLE_RATE;
}

function b64ToU8(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function u8ToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return globalThis.btoa(bin);
}

/** Pack raw PCM chunks into a WAV data-URI playable by expo-av */
function buildWavUri(chunks: Uint8Array[], sampleRate: number): string {
  const pcmLen = chunks.reduce((s, c) => s + c.length, 0);
  const buf = new Uint8Array(44 + pcmLen);
  const dv  = new DataView(buf.buffer);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");  dv.setUint32(4, 36 + pcmLen, true);
  str(8, "WAVE");  str(12, "fmt ");
  dv.setUint32(16, 16, true);           // chunk size
  dv.setUint16(20,  1, true);           // PCM
  dv.setUint16(22,  1, true);           // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32,  2, true);
  dv.setUint16(34, 16, true);
  str(36, "data"); dv.setUint32(40, pcmLen, true);
  let off = 44;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return `data:audio/wav;base64,${u8ToB64(buf)}`;
}

async function setAudioMode(opts: Record<string, unknown>) {
  if (!AudioLib) return;
  try {
    if (typeof AudioLib.setAudioModeAsync === "function")
      await AudioLib.setAudioModeAsync(opts);
  } catch { /* noop — some platforms don't support all keys */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// System instruction
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = {
  parts: [
    {
      text:
        "You are HealthAI, a warm and caring voice assistant for senior citizens " +
        "in Valenzuela City, Philippines (the SCIA app). " +
        "Speak simply, patiently, and in a friendly tone. " +
        "Keep responses short — one to three sentences unless more detail is asked for. " +
        "Never diagnose; always recommend seeing a doctor for serious concerns. " +
        "If someone describes an emergency, immediately tell them to call 911 " +
        "or tap the SOS button in the app.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useLiveVoice() {
  // Session / recording refs — not state because we don't want re-renders on change
  const sessionRef       = useRef<any>(null);
  const soundRef         = useRef<any>(null);
  const isRecordingRef   = useRef(false);
  const isDestroyedRef   = useRef(false);   // unmount guard
  const audioQueueRef    = useRef<string[]>([]);
  const isPlayingRef     = useRef(false);
  const pcmChunksRef     = useRef<Uint8Array[]>([]);
  const pcmRateRef       = useRef(OUT_SAMPLE_RATE);

  // Reactive state
  const [status,          setStatus]          = useState<LiveStatus>("idle");
  const [isRecording,     setIsRecording]     = useState(false);
  const [inputTranscript, setInputTranscript] = useState("");
  const [outputTranscript,setOutputTranscript]= useState("");
  const [lastError,       setLastError]       = useState("");
  const [diagnostic,      setDiagnostic]      = useState("");
  const [interrupted,     setInterrupted]     = useState(false);

  const isConnected = status === "connected" || status === "listening" || status === "responding";

  // ── safe state setters (no-op after unmount) ──────────────────────────────
  const safeSet = useCallback(<T>(setter: (v: T) => void) => (v: T) => {
    if (!isDestroyedRef.current) setter(v);
  }, []);

  const setStatusSafe          = safeSet(setStatus);
  const setIsRecordingSafe     = safeSet(setIsRecording);
  const setInputTranscriptSafe = safeSet(setInputTranscript);
  const setOutputTranscriptSafe= safeSet(setOutputTranscript);
  const setLastErrorSafe       = safeSet(setLastError);
  const setDiagnosticSafe      = safeSet(setDiagnostic);
  const setInterruptedSafe     = safeSet(setInterrupted);

  // ── Teardown audio state ──────────────────────────────────────────────────
  const clearAudio = useCallback(async () => {
    // Stop recording
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      try { await _stopRecording?.(); } catch {}
    }
    setIsRecordingSafe(false);

    // Stop playback
    isPlayingRef.current = false;
    audioQueueRef.current = [];
    pcmChunksRef.current  = [];
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, [setIsRecordingSafe]);

  // ── Playback queue ────────────────────────────────────────────────────────
  const drainPlayQueue = useCallback(async () => {
    if (isPlayingRef.current || !AudioLib) return;
    isPlayingRef.current = true;
    try {
      while (audioQueueRef.current.length > 0) {
        const uri = audioQueueRef.current.shift();
        if (!uri) continue;

        // Switch audio session to playback mode
        await setAudioMode({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });

        const { sound } = await AudioLib.Sound.createAsync(
          { uri },
          { shouldPlay: true, volume: 1.0 }
        );
        soundRef.current = sound;

        // Wait for the clip to finish
        await new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((s: any) => {
            if (s.isLoaded && (s.didJustFinish || s.error)) resolve();
          });
        });

        try { await sound.unloadAsync(); } catch {}
        soundRef.current = null;
      }
    } catch (err) {
      setLastErrorSafe("Audio playback failed: " + (err instanceof Error ? err.message : "?"));
    } finally {
      isPlayingRef.current = false;
    }
  }, [setLastErrorSafe]);

  /** Assemble buffered PCM chunks → WAV → enqueue for playback */
  const flushTurn = useCallback(async () => {
    if (pcmChunksRef.current.length === 0) return;
    try {
      const uri = buildWavUri(pcmChunksRef.current, pcmRateRef.current);
      pcmChunksRef.current = [];
      audioQueueRef.current.push(uri);
      await drainPlayQueue();
    } catch (err) {
      setLastErrorSafe("Failed to build audio: " + (err instanceof Error ? err.message : "?"));
      pcmChunksRef.current = [];
    }
  }, [drainPlayQueue, setLastErrorSafe]);

  // ── Receive-loop message handler ──────────────────────────────────────────
  const handleMessage = useCallback(
    async (msg: any) => {
      if (!msg?.serverContent) return;
      const sc = msg.serverContent;

      // Model was interrupted by new user speech
      if (sc.interrupted === true) {
        setInterruptedSafe(true);
        pcmChunksRef.current = [];
        audioQueueRef.current = [];
        // Stop current playback immediately
        try {
          await soundRef.current?.stopAsync();
          await soundRef.current?.unloadAsync();
        } catch {}
        soundRef.current = null;
        isPlayingRef.current = false;
        setStatusSafe("listening");
        return;
      }

      // Collect incoming PCM audio chunks from the model
      const parts = sc.modelTurn?.parts ?? [];
      for (const part of parts) {
        const id = part?.inlineData;
        if (id?.data && id.mimeType?.startsWith("audio/pcm")) {
          pcmRateRef.current = parseSampleRate(id.mimeType);
          try { pcmChunksRef.current.push(b64ToU8(id.data)); } catch {}
        }
      }

      // Live input transcription (what the user said)
      if (sc.inputTranscription?.text) {
        setInputTranscriptSafe(sc.inputTranscription.text);
      }

      // Live output transcription (what the model is saying)
      if (sc.outputTranscription?.text) {
        setOutputTranscriptSafe(sc.outputTranscription.text);
        setStatusSafe("responding");
      }

      // Model finished its turn — play everything we buffered
      if (sc.turnComplete === true) {
        await flushTurn();
        setStatusSafe(isRecordingRef.current ? "listening" : "connected");
      }
    },
    [flushTurn, setInterruptedSafe, setStatusSafe, setInputTranscriptSafe, setOutputTranscriptSafe]
  );

  // ── Connect to Gemini Live ────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (sessionRef.current || isDestroyedRef.current) return;
    setLastErrorSafe("");
    setDiagnosticSafe("");
    setInterruptedSafe(false);
    setStatusSafe("connecting");

    try {
      const app  = getApp();
      const ai   = getAI(app, { backend: new VertexAIBackend(VERTEX_REGION) });
      const liveModel = getLiveGenerativeModel(ai, {
        model: LIVE_MODEL,
        liveGenerationConfig: {
          responseModalities: [ResponseModality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      setDiagnosticSafe("Opening Gemini Live session…");
      const session = await liveModel.connect();
      if (isDestroyedRef.current) { session.close?.(); return; }

      sessionRef.current = session;
      setStatusSafe("connected");
      setDiagnosticSafe("Connected — tap the mic to start speaking.");

      // Background receive loop — runs for the lifetime of the session
      (async () => {
        try {
          for await (const message of session.receive()) {
            if (isDestroyedRef.current || !sessionRef.current) break;
            await handleMessage(message);
          }
          // Session closed cleanly
          if (!isDestroyedRef.current && sessionRef.current) {
            sessionRef.current = null;
            setStatusSafe("idle");
            setDiagnosticSafe("Session ended.");
          }
        } catch (err) {
          if (!isDestroyedRef.current && sessionRef.current) {
            sessionRef.current = null;
            const msg = err instanceof Error ? err.message : "Session error.";
            setLastErrorSafe(msg);
            setDiagnosticSafe("Connection lost.");
            setStatusSafe("error");
          }
        }
      })();
    } catch (err) {
      sessionRef.current = null;
      const msg = err instanceof Error ? err.message : "Could not connect.";
      setLastErrorSafe(msg);
      setDiagnosticSafe("Failed to connect. Check Firebase setup and internet.");
      setStatusSafe("error");
    }
  }, [handleMessage, setLastErrorSafe, setDiagnosticSafe, setInterruptedSafe, setStatusSafe]);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null;
    try { s?.close(); } catch {}
    void clearAudio();
    setStatusSafe("idle");
    setDiagnosticSafe("");
  }, [clearAudio, setStatusSafe, setDiagnosticSafe]);

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    isDestroyedRef.current = false;
    return () => {
      isDestroyedRef.current = true;
      const s = sessionRef.current;
      sessionRef.current = null;
      try { s?.close(); } catch {}
      // clearAudio can't be awaited in useEffect cleanup — fire and forget
      void (async () => {
        isRecordingRef.current = false;
        try { await _stopRecording?.(); } catch {}
        try { await soundRef.current?.stopAsync(); } catch {}
        try { await soundRef.current?.unloadAsync(); } catch {}
      })();
    };
  }, []);

  // ── Start streaming mic PCM → Gemini Live ─────────────────────────────────
  const startMicRecording = useCallback(async (): Promise<boolean> => {
    if (!sessionRef.current) {
      setLastErrorSafe("Not connected. Tap Connect first.");
      return false;
    }
    if (isRecordingRef.current) return true; // already recording

    if (!_startRecording || !_requestMicPerm) {
      setLastErrorSafe(
        "Audio recording unavailable. Run: npx expo install @siteed/expo-audio-studio"
      );
      return false;
    }

    try {
      // Request microphone permission
      const perm = await _requestMicPerm();
      const granted = perm?.granted === true || perm?.status === "granted";
      if (!granted) {
        setLastErrorSafe("Microphone permission is required.");
        return false;
      }

      // Set iOS audio session to recording mode
      await setAudioMode({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // Start recording — onAudioStream fires every `interval` ms with base64 PCM
      await _startRecording({
        sampleRate: MIC_SAMPLE_RATE,  // 16 kHz — required by Gemini Live
        channels: 1,                  // mono
        encoding: "pcm_16bit",        // signed 16-bit little-endian
        interval: 100,                // chunk every 100 ms
        onAudioStream: (event: { data?: string; audioData?: string }) => {
          const session = sessionRef.current;
          if (!session) return;
          const data = event.data ?? (event as any).audioData;
          if (!data) return;
          try {
            session.sendRealtimeAudio({
              data,
              mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`,
            });
          } catch {
            // Individual chunk errors are non-fatal — ignore
          }
        },
      });

      isRecordingRef.current = true;
      setIsRecordingSafe(true);
      setInterruptedSafe(false);
      setStatusSafe("listening");
      setDiagnosticSafe("Listening… speak now. I'll respond when you stop.");
      return true;
    } catch (err) {
      isRecordingRef.current = false;
      setIsRecordingSafe(false);
      const msg = err instanceof Error ? err.message : "Unknown recording error.";
      setLastErrorSafe("Mic error: " + msg);
      setDiagnosticSafe(msg);
      return false;
    }
  }, [setLastErrorSafe, setIsRecordingSafe, setInterruptedSafe, setStatusSafe, setDiagnosticSafe]);

  // ── Stop mic streaming ────────────────────────────────────────────────────
  const stopMicRecording = useCallback(async (): Promise<boolean> => {
    if (!isRecordingRef.current) return false;
    isRecordingRef.current = false;
    try {
      await _stopRecording?.();
    } catch {}
    setIsRecordingSafe(false);
    setStatusSafe(sessionRef.current ? "connected" : "idle");
    await setAudioMode({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    setDiagnosticSafe("Mic stopped.");
    return true;
  }, [setIsRecordingSafe, setStatusSafe, setDiagnosticSafe]);

  // ── Toggle mic (main button in Voice.tsx) ─────────────────────────────────
  const toggleMic = useCallback(async () => {
    if (!isConnected) {
      // Auto-connect then start mic
      await connect();
      // Wait briefly for the session to open, then start mic
      setTimeout(() => { void startMicRecording(); }, 800);
      return;
    }
    if (isRecordingRef.current) {
      await stopMicRecording();
    } else {
      await startMicRecording();
    }
  }, [isConnected, connect, startMicRecording, stopMicRecording]);

  // ── Reset transcript display ──────────────────────────────────────────────
  const resetTranscripts = useCallback(() => {
    setInputTranscriptSafe("");
    setOutputTranscriptSafe("");
    setInterruptedSafe(false);
    setLastErrorSafe("");
    setDiagnosticSafe("");
  }, [setInputTranscriptSafe, setOutputTranscriptSafe, setInterruptedSafe, setLastErrorSafe, setDiagnosticSafe]);

  // ─────────────────────────────────────────────────────────────────────────
  return useMemo(
    () => ({
      // State
      status,
      isConnected,
      isRecording,
      inputTranscript,
      outputTranscript,
      interrupted,
      lastError,
      diagnostic,
      // Actions
      connect,
      disconnect,
      toggleMic,
      startMicRecording,
      stopMicRecording,
      resetTranscripts,
    }),
    [
      status, isConnected, isRecording,
      inputTranscript, outputTranscript,
      interrupted, lastError, diagnostic,
      connect, disconnect, toggleMic,
      startMicRecording, stopMicRecording, resetTranscripts,
    ]
  );
}
