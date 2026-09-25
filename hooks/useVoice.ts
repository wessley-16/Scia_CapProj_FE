/**
 * useLiveVoice — Firebase AI Logic Live voice session
 *
 * Status flow:
 *   idle → connecting → connected → listening → responding → connected (loop)
 *
 * One-tap UX: tap mic once to connect + start listening.
 * Server-side VAD fires turnComplete automatically → model replies.
 */

import {
  ResponseModality,
  VertexAIBackend,
  getAI,
  getLiveGenerativeModel,
} from "@react-native-firebase/ai";
import { getApp } from "@react-native-firebase/app";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── @siteed/audio-studio (CommonJS — lazy/safe resolution) ──────────────────
let _audioStudioPkg: any = null;
try { _audioStudioPkg = require("@siteed/audio-studio"); } catch {}

const _resolve = <T>(key: string): T | null => {
  if (!_audioStudioPkg) return null;
  return (
    _audioStudioPkg[key] ??
    _audioStudioPkg.default?.[key] ??
    null
  ) as T | null;
};

type PermResult = { status: string; granted?: boolean };
type RecordConfig = {
  sampleRate: number;
  channels:   number;
  encoding:   string;
  interval:   number;
  onAudioStream: (e: { data: string }) => void;
};

const getAudioModules = () => ({
  ExpoAudioStreamModule: _resolve<{ requestPermissionsAsync: () => Promise<PermResult> }>(
    "ExpoAudioStreamModule"
  ),
  startRecording: _resolve<(config: RecordConfig) => Promise<any>>("startRecording"),
  stopRecording:  _resolve<() => Promise<any>>("stopRecording"),
});

// ─── Constants ────────────────────────────────────────────────────────────────
const MIC_SAMPLE_RATE  = 16_000;
const OUT_SAMPLE_RATE  = 24_000;
const VERTEX_REGION    = "us-central1";
const LIVE_MODEL       = "gemini-live-2.5-flash-native-audio";

const SYSTEM_INSTRUCTION = {
  role: "system" as const,
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
  | "connected"
  | "listening"
  | "responding"
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
  const soundRef       = useRef<AudioPlayer | null>(null);
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

  const safe = {
    status:      (v: LiveStatus) => { if (!deadRef.current) setStatus(v);           },
    recording:   (v: boolean)    => { if (!deadRef.current) setIsRecording(v);      },
    inTx:        (v: string)     => { if (!deadRef.current) setInputTranscript(v);  },
    outTx:       (v: string)     => { if (!deadRef.current) setOutputTranscript(v); },
    error:       (v: string)     => { if (!deadRef.current) setLastError(v);        },
    diag:        (v: string)     => { if (!deadRef.current) setDiagnostic(v);       },
    interrupted: (v: boolean)    => { if (!deadRef.current) setInterrupted(v);      },
  };

  // ── Tear down all audio I/O ───────────────────────────────────────────────
  const clearAudio = useCallback(async () => {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      await getAudioModules().stopRecording?.().catch(() => {});
    }
    safe.recording(false);
    isPlayingRef.current  = false;
    audioQueueRef.current = [];
    pcmChunksRef.current  = [];
    if (soundRef.current) {
      try { soundRef.current.pause();  } catch {}
      try { soundRef.current.remove(); } catch {}
      soundRef.current = null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drain WAV playback queue sequentially ────────────────────────────────
  const drainQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    try {
      while (audioQueueRef.current.length > 0) {
        const uri = audioQueueRef.current.shift()!;
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording:   false,
        });
        const player = createAudioPlayer({ uri });
        soundRef.current = player;
        player.play();

        await new Promise<void>((resolve) => {
          let resolved = false;
          const finish = () => {
            if (resolved) return;
            resolved = true;
            clearInterval(intervalId);
            clearTimeout(safetyTimeout);
            resolve();
          };
          const intervalId = setInterval(() => {
            const p = soundRef.current;
            if (!p) return finish();
            if (p.isLoaded && p.duration > 0 && p.currentTime >= p.duration - 0.05) {
              finish();
            }
          }, 100);
          const safetyTimeout = setTimeout(finish, 15000);
        });

        try { player.remove(); } catch {}
        soundRef.current = null;
      }
    } finally {
      isPlayingRef.current = false;
    }
  }, []);

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

    if (sc.interrupted === true) {
      safe.interrupted(true);
      pcmChunksRef.current  = [];
      audioQueueRef.current = [];
      isPlayingRef.current  = false;
      try { soundRef.current?.pause();  } catch {}
      try { soundRef.current?.remove(); } catch {}
      soundRef.current = null;
      safe.status(isRecordingRef.current ? "listening" : "connected");
      return;
    }

    for (const part of (sc.modelTurn?.parts ?? []) as any[]) {
      const id = part?.inlineData;
      if (id?.data && id.mimeType?.startsWith("audio/pcm")) {
        pcmRateRef.current = parseSampleRate(id.mimeType);
        pcmChunksRef.current.push(b64ToU8(id.data));
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
  }, [flushTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open Gemini Live session ─────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (sessionRef.current) return;
    safe.error(""); safe.diag(""); safe.interrupted(false);
    safe.status("connecting");

    try {
      const ai = getAI(getApp(), { backend: new VertexAIBackend(VERTEX_REGION) });
      const liveModel = getLiveGenerativeModel(ai, {
        model: LIVE_MODEL,
        generationConfig: {
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

      (async () => {
        for await (const message of session.receive()) {
          if (deadRef.current || !sessionRef.current) break;
          await handleMessage(message);
        }
        if (!deadRef.current && sessionRef.current) {
          sessionRef.current = null;
          safe.status("idle");
          safe.diag("Session ended.");
        }
      })().catch((err: Error) => {
        if (!deadRef.current && sessionRef.current) {
          sessionRef.current = null;
          safe.error(err.message);
          safe.status("error");
          safe.diag("Tap Connect to try again.");
        }
      });
    } catch (err: any) {
      sessionRef.current = null;
      safe.error(err?.message ?? "Failed to connect.");
      safe.status("error");
      safe.diag("Connection failed. Tap Connect to retry.");
    }
  }, [handleMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null;
    s?.close();
    void clearAudio();
    safe.status("idle");
    safe.diag("");
  }, [clearAudio]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    deadRef.current = false;
    return () => {
      deadRef.current = true;
      const s = sessionRef.current;
      sessionRef.current = null;
      s?.close();
      isRecordingRef.current = false;
      getAudioModules().stopRecording?.().catch(() => {});
      try { soundRef.current?.pause();  } catch {}
      try { soundRef.current?.remove(); } catch {}
    };
  }, []);

  const startMicRecording = useCallback(async () => {
    if (!sessionRef.current) {
      safe.error("Not connected — tap Connect first.");
      return;
    }
    if (isRecordingRef.current) return;

    const { ExpoAudioStreamModule, startRecording: _start } = getAudioModules();

    if (typeof _start !== "function" || !ExpoAudioStreamModule) {
      safe.error(
        "Microphone module not ready. Run `npx expo run:android` to rebuild, then restart."
      );
      return;
    }

    const perm    = await ExpoAudioStreamModule.requestPermissionsAsync();
    const granted = perm.status === "granted" || perm.granted === true;
    if (!granted) {
      safe.error("Microphone permission denied. Enable it in device Settings.");
      return;
    }

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording:   true,
    });

    await _start({
      sampleRate: MIC_SAMPLE_RATE,
      channels:   1,
      encoding:   "pcm_16bit",
      interval:   100,
      onAudioStream: (event: { data: string }) => {
        const session = sessionRef.current;
        if (!session || !event?.data) return;
        session.sendRealtimeAudio({
          data:     event.data,
          mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`,
        });
      },
    });

    isRecordingRef.current = true;
    safe.recording(true);
    safe.interrupted(false);
    safe.status("listening");
    safe.diag("Listening… speak now. I'll reply when you stop.");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopMicRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    await getAudioModules().stopRecording?.().catch(() => {});
    safe.recording(false);
    safe.status(sessionRef.current ? "connected" : "idle");
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording:   false,
    });
    safe.diag("Mic off. Waiting for response…");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = useCallback(async () => {
    if (!isConnected) {
      await connect();
      setTimeout(() => { void startMicRecording(); }, 700);
      return;
    }
    if (isRecordingRef.current) await stopMicRecording();
    else await startMicRecording();
  }, [isConnected, connect, startMicRecording, stopMicRecording]);

  const resetTranscripts = useCallback(() => {
    safe.inTx(""); safe.outTx("");
    safe.interrupted(false); safe.error(""); safe.diag("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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