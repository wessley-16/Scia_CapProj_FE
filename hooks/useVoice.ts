/**
 * useLiveVoice — Firebase AI Logic Live voice session
 *
 * Status flow:
 *   idle → connecting → connected → listening → responding → connected (loop)
 *
 * One-tap UX: tap mic once to connect + start listening.
 * Server-side VAD fires turnComplete automatically → model replies.
 *
 * REQUIREMENTS (must native-build, not Expo Go):
 *   yarn add @siteed/audio-studio
 *   npx expo run:android   (or run:ios)
 */

import {
  ResponseModality,
  VertexAIBackend,
  getAI,
  getLiveGenerativeModel,
} from "@react-native-firebase/ai";
import { getApp } from "@react-native-firebase/app";
import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── @siteed/audio-studio — resolved once at module load ─────────────────────
// We resolve at load time so errors surface immediately on mount,
// not buried inside an async callback.
const _pkg = (() => {
  try {
    return require("@siteed/audio-studio");
  } catch {
    return null;
  }
})();

const ExpoAudioStreamModule = _pkg?.ExpoAudioStreamModule ?? _pkg?.default?.ExpoAudioStreamModule ?? null;
const _startRecording       = _pkg?.startRecording       ?? _pkg?.default?.startRecording       ?? null;
const _stopRecording        = _pkg?.stopRecording        ?? _pkg?.default?.stopRecording        ?? null;

// ─── Constants ────────────────────────────────────────────────────────────────
const MIC_SAMPLE_RATE = 16_000;   // Gemini Live API requires 16 kHz input
const OUT_SAMPLE_RATE = 24_000;   // Gemini Live API outputs 24 kHz
const VERTEX_REGION   = "us-central1";
const LIVE_MODEL      = "gemini-live-2.5-flash-native-audio";

const SYSTEM_INSTRUCTION = {
  parts: [{
    text:
      "You are HealthAI, a warm and caring voice assistant for senior citizens " +
      "in Valenzuela City, Philippines (the SCIA app). " +
      "Speak simply, patiently, and in a friendly tone. " +
      "Keep responses short — one to three sentences unless more detail is requested. " +
      "Never diagnose; always recommend seeing a doctor for serious health concerns. " +
      "If someone describes an emergency, immediately tell them to call 911 " +
      "or tap the SOS button in the app.",
  }],
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type LiveStatus =
  | "idle"
  | "connecting"
  | "connected"   // session open, mic idle
  | "listening"   // mic streaming to model
  | "responding"  // model sending audio back
  | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseSampleRate(mimeType?: string): number {
  const m = mimeType?.match(/rate=(\d+)/i);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : OUT_SAMPLE_RATE;
}

function b64ToU8(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const u8  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function u8ToB64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return globalThis.btoa(out);
}

function buildWavUri(chunks: Uint8Array[], sampleRate: number): string {
  const pcmLen = chunks.reduce((s, c) => s + c.length, 0);
  const wav    = new Uint8Array(44 + pcmLen);
  const dv     = new DataView(wav.buffer);
  const str    = (o: number, s: string) =>
    s.split("").forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));

  str(0, "RIFF"); dv.setUint32(4,  36 + pcmLen,    true);
  str(8, "WAVE"); str(12, "fmt ");
  dv.setUint32(16, 16,             true);
  dv.setUint16(20,  1,             true); // PCM
  dv.setUint16(22,  1,             true); // mono
  dv.setUint32(24, sampleRate,     true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32,  2,             true);
  dv.setUint16(34, 16,             true);
  str(36, "data"); dv.setUint32(40, pcmLen, true);

  let off = 44;
  for (const c of chunks) { wav.set(c, off); off += c.length; }
  return `data:audio/wav;base64,${u8ToB64(wav)}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLiveVoice() {
  const sessionRef     = useRef<any>(null);
  const soundRef       = useRef<Audio.Sound | null>(null);
  const isRecordingRef = useRef(false);
  const deadRef        = useRef(false);
  const pcmChunksRef   = useRef<Uint8Array[]>([]);
  const pcmRateRef     = useRef(OUT_SAMPLE_RATE);
  const audioQueueRef  = useRef<string[]>([]);
  const isPlayingRef   = useRef(false);

  const [status,           setStatus]           = useState<LiveStatus>("idle");
  const [isRecording,      setIsRecording]      = useState(false);
  const [inputTranscript,  setInputTranscript]  = useState("");
  const [outputTranscript, setOutputTranscript] = useState("");
  const [lastError,        setLastError]        = useState("");
  const [diagnostic,       setDiagnostic]       = useState("");
  const [interrupted,      setInterrupted]      = useState(false);

  const isConnected =
    status === "connected" || status === "listening" || status === "responding";

  // ── Safe setters (no-op after component unmounts) ────────────────────────
  const safe = useMemo(() => ({
    status:      (v: LiveStatus) => { if (!deadRef.current) setStatus(v);           },
    recording:   (v: boolean)    => { if (!deadRef.current) setIsRecording(v);      },
    inTx:        (v: string)     => { if (!deadRef.current) setInputTranscript(v);  },
    outTx:       (v: string)     => { if (!deadRef.current) setOutputTranscript(v); },
    error:       (v: string)     => { if (!deadRef.current) setLastError(v);        },
    diag:        (v: string)     => { if (!deadRef.current) setDiagnostic(v);       },
    interrupted: (v: boolean)    => { if (!deadRef.current) setInterrupted(v);      },
  }), []);

  // ── Tear down all audio I/O ──────────────────────────────────────────────
  const clearAudio = useCallback(async () => {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      try { await _stopRecording?.(); } catch {}
    }
    safe.recording(false);
    isPlayingRef.current  = false;
    audioQueueRef.current = [];
    pcmChunksRef.current  = [];
    if (soundRef.current) {
      try { await soundRef.current.stopAsync();   } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, [safe]);

  // ── Drain WAV playback queue sequentially ────────────────────────────────
  const drainQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    try {
      while (audioQueueRef.current.length > 0) {
        const uri = audioQueueRef.current.shift()!;
        await Audio.setAudioModeAsync({
          allowsRecordingIOS:         false,
          playsInSilentModeIOS:       true,
          shouldDuckAndroid:          true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, volume: 1.0 },
        );
        soundRef.current = sound;
        await new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((s) => {
            if (s.isLoaded && (s.didJustFinish || ("error" in s && s.error)))
              resolve();
          });
        });
        try { await sound.unloadAsync(); } catch {}
        soundRef.current = null;
      }
    } catch (err) {
      safe.error("Audio playback error. Please try again.");
    } finally {
      isPlayingRef.current = false;
    }
  }, [safe]);

  const flushTurn = useCallback(async () => {
    if (pcmChunksRef.current.length === 0) return;
    const uri = buildWavUri(pcmChunksRef.current, pcmRateRef.current);
    pcmChunksRef.current = [];
    audioQueueRef.current.push(uri);
    await drainQueue();
  }, [drainQueue]);

  // ── Handle server messages ───────────────────────────────────────────────
  const handleMessage = useCallback(async (msg: any) => {
    const sc = msg?.serverContent;
    if (!sc) return;

    // Model was interrupted by user speaking
    if (sc.interrupted === true) {
      safe.interrupted(true);
      pcmChunksRef.current  = [];
      audioQueueRef.current = [];
      isPlayingRef.current  = false;
      try { await soundRef.current?.stopAsync();   } catch {}
      try { await soundRef.current?.unloadAsync(); } catch {}
      soundRef.current = null;
      safe.status(isRecordingRef.current ? "listening" : "connected");
      return;
    }

    // Buffer incoming PCM audio from the model
    for (const part of (sc.modelTurn?.parts ?? []) as any[]) {
      const id = part?.inlineData;
      if (id?.data && id.mimeType?.startsWith("audio/pcm")) {
        pcmRateRef.current = parseSampleRate(id.mimeType);
        try { pcmChunksRef.current.push(b64ToU8(id.data)); } catch {}
      }
    }

    if (sc.inputTranscription?.text)  safe.inTx(sc.inputTranscription.text);
    if (sc.outputTranscription?.text) {
      safe.outTx(sc.outputTranscription.text);
      safe.status("responding");
    }

    if (sc.turnComplete === true) {
      await flushTurn();
      safe.status(isRecordingRef.current ? "listening" : "connected");
    }
  }, [flushTurn, safe]);

  // ── Open Gemini Live session ─────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (sessionRef.current) return;
    safe.error(""); safe.diag(""); safe.interrupted(false);
    safe.status("connecting");

    try {
      const ai = getAI(getApp(), { backend: new VertexAIBackend(VERTEX_REGION) });
      const liveModel = getLiveGenerativeModel(ai, {
        model: LIVE_MODEL,
        liveGenerationConfig: {
          responseModalities:       [ResponseModality.AUDIO],
          inputAudioTranscription:  {},
          outputAudioTranscription: {},
        },
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      safe.diag("Connecting to Gemini Live…");
      const session = await liveModel.connect();
      if (deadRef.current) { session.close(); return; }

      sessionRef.current = session;
      safe.status("connected");
      safe.diag("Connected — tap the mic to speak.");

      // Async receive loop — runs until session closes
      (async () => {
        try {
          for await (const message of session.receive()) {
            if (deadRef.current || !sessionRef.current) break;
            await handleMessage(message);
          }
          // Session ended gracefully
          if (!deadRef.current && sessionRef.current) {
            sessionRef.current = null;
            safe.status("idle");
            safe.diag("Session ended.");
          }
        } catch (err: any) {
          if (!deadRef.current && sessionRef.current) {
            sessionRef.current = null;
            safe.error(err?.message ?? "Session error.");
            safe.status("error");
            safe.diag("Tap the mic to reconnect.");
          }
        }
      })();

    } catch (err: any) {
      sessionRef.current = null;
      safe.error(err?.message ?? "Failed to connect to Gemini Live.");
      safe.status("error");
      safe.diag("Connection failed. Tap the mic to retry.");
    }
  }, [handleMessage, safe]);

  // ── Close session ────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null;
    try { s?.close(); } catch {}
    void clearAudio();
    safe.status("idle");
    safe.diag("");
  }, [clearAudio, safe]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    deadRef.current = false;
    return () => {
      deadRef.current = true;
      const s = sessionRef.current;
      sessionRef.current = null;
      try { s?.close(); } catch {}
      isRecordingRef.current = false;
      try { _stopRecording?.(); } catch {}
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Start mic → stream PCM to Gemini Live ────────────────────────────────
  const startMicRecording = useCallback(async (): Promise<boolean> => {
    if (!sessionRef.current) {
      safe.error("Not connected — tap the mic button to connect first.");
      return false;
    }
    if (isRecordingRef.current) return true; // already recording

    // ── Check that the native module is available ──────────────────────────
    // If this error appears, the app needs a native rebuild:
    //   npx expo run:android
    // @siteed/audio-studio is a native module and won't work in Expo Go.
    if (!ExpoAudioStreamModule || typeof _startRecording !== "function") {
      safe.error(
        "Microphone module not ready.\n\n" +
        "Run: npx expo run:android\n" +
        "Then restart the app.",
      );
      safe.diag("Native rebuild required for microphone support.");
      return false;
    }

    // ── Request microphone permission ──────────────────────────────────────
    let granted = false;
    try {
      const perm = await ExpoAudioStreamModule.requestPermissionsAsync();
      granted = perm?.status === "granted" || perm?.granted === true;
    } catch (err) {
      safe.error("Failed to request microphone permission.");
      return false;
    }

    if (!granted) {
      safe.error("Microphone permission denied. Enable it in device Settings → Apps → SCIA → Permissions.");
      return false;
    }

    // ── Set audio mode for recording ───────────────────────────────────────
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:         true,
        playsInSilentModeIOS:       true,
        shouldDuckAndroid:          true,
        playThroughEarpieceAndroid: false,
      });
    } catch {
      // Non-fatal — continue anyway
    }

    // ── Begin streaming mic PCM to the session ─────────────────────────────
    try {
      await _startRecording({
        sampleRate: MIC_SAMPLE_RATE,  // 16 kHz — required by Gemini Live
        channels:   1,                // mono
        encoding:   "pcm_16bit",
        interval:   100,              // emit chunk every 100 ms
        onAudioStream: (event: { data: string }) => {
          const session = sessionRef.current;
          if (!session || !event?.data) return;
          try {
            session.sendRealtimeAudio({
              data:     event.data,
              mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`,
            });
          } catch {
            // Ignore individual chunk errors — transient network blip
          }
        },
      });
    } catch (err: any) {
      safe.error("Failed to start microphone recording.");
      safe.diag(err?.message ?? "Unknown recording error.");
      return false;
    }

    isRecordingRef.current = true;
    safe.recording(true);
    safe.interrupted(false);
    safe.status("listening");
    safe.diag("Listening… speak now. I'll reply when you stop.");
    return true;
  }, [safe]);

  // ── Stop mic ─────────────────────────────────────────────────────────────
  const stopMicRecording = useCallback(async (): Promise<boolean> => {
    if (!isRecordingRef.current) return false;
    isRecordingRef.current = false;
    try { await _stopRecording?.(); } catch {}
    safe.recording(false);
    safe.status(sessionRef.current ? "connected" : "idle");
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:   false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid:    true,
      });
    } catch {}
    safe.diag("Mic off — waiting for response…");
    return true;
  }, [safe]);

  // ── Main tap handler ─────────────────────────────────────────────────────
  // Behavior:
  //   • Not connected → connect, then start mic once session is ready
  //   • Recording     → stop mic
  //   • Connected     → start mic
  const toggleMic = useCallback(async () => {
    if (!isConnected) {
      // Connect first, then wait for the session ref to be populated before
      // starting the mic. Polling is safer than a fixed setTimeout.
      await connect();

      // Wait up to 8 s for the session to open
      let waited = 0;
      const POLL_MS  = 100;
      const LIMIT_MS = 8_000;
      await new Promise<void>((resolve) => {
        const check = () => {
          if (sessionRef.current || deadRef.current || waited >= LIMIT_MS) {
            resolve();
          } else {
            waited += POLL_MS;
            setTimeout(check, POLL_MS);
          }
        };
        setTimeout(check, POLL_MS);
      });

      if (sessionRef.current) {
        await startMicRecording();
      }
      return;
    }

    if (isRecordingRef.current) {
      await stopMicRecording();
    } else {
      await startMicRecording();
    }
  }, [isConnected, connect, startMicRecording, stopMicRecording]);

  // ── Reset transcripts / errors (for the header refresh button) ───────────
  const resetTranscripts = useCallback(() => {
    safe.inTx(""); safe.outTx("");
    safe.interrupted(false); safe.error(""); safe.diag("");
  }, [safe]);

  return useMemo(() => ({
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
    toggleMic,
    startMicRecording,
    stopMicRecording,
    resetTranscripts,
  }), [
    status, isConnected, isRecording,
    inputTranscript, outputTranscript,
    interrupted, lastError, diagnostic,
    connect, disconnect, toggleMic,
    startMicRecording, stopMicRecording, resetTranscripts,
  ]);
}
