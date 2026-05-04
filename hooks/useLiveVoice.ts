import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LIVE_MODEL,
  LIVE_TOKEN_API_URL,
  LIVE_WS_BASE_URL,
} from "@/constants/constants";

type LiveStatus = "idle" | "connecting" | "connected" | "responding" | "error";

type LiveTokenResponse = {
  token?: string;
  expireTime?: string;
  newSessionExpireTime?: string;
  model?: string;
  code?: string;
  error?: string;
  details?: string;
};

const TOKEN_TIMEOUT_MS = 12000;
const SOCKET_TIMEOUT_MS = 25000;
const DEFAULT_PCM_SAMPLE_RATE = 24000;

const parseSampleRate = (mimeType?: string) => {
  if (!mimeType) return DEFAULT_PCM_SAMPLE_RATE;
  const match = mimeType.match(/rate=(\d+)/i);
  if (!match) return DEFAULT_PCM_SAMPLE_RATE;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PCM_SAMPLE_RATE;
};

const base64ToBytes = (base64: string) => {
  if (typeof globalThis.atob !== "function") {
    throw new Error("atob is not available in this runtime.");
  }

  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  if (typeof globalThis.btoa !== "function") {
    throw new Error("btoa is not available in this runtime.");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return globalThis.btoa(binary);
};

const pcmToWavDataUri = (chunks: Uint8Array[], sampleRate: number) => {
  const pcmByteLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const wavByteLength = 44 + pcmByteLength;
  const wavBytes = new Uint8Array(wavByteLength);
  const view = new DataView(wavBytes.buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmByteLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
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

  const wavBase64 = bytesToBase64(wavBytes);
  return `data:audio/wav;base64,${wavBase64}`;
};

const wsStateLabel = (state: number) => {
  switch (state) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return `UNKNOWN(${state})`;
  }
};

const closeHint = (code: number) => {
  if (code === 1006)
    return "Network/SSL interruption while reaching Gemini Live.";
  if (code === 1008)
    return "Policy/auth rejection (token or setup not accepted).";
  if (code === 1011) return "Gemini Live internal server error; retry shortly.";
  return "";
};

const parseServerMessage = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const decodeSocketMessageData = async (data: unknown) => {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    try {
      return new TextDecoder("utf-8").decode(new Uint8Array(data));
    } catch {
      return null;
    }
  }

  if (
    data &&
    typeof data === "object" &&
    "text" in data &&
    typeof (data as { text?: () => Promise<string> }).text === "function"
  ) {
    try {
      return await (data as { text: () => Promise<string> }).text();
    } catch {
      return null;
    }
  }

  return null;
};

export const useLiveVoice = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const socketTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcmChunksRef = useRef<Uint8Array[]>([]);
  const pcmSampleRateRef = useRef(DEFAULT_PCM_SAMPLE_RATE);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const clearSocketTimeout = () => {
    if (socketTimeoutRef.current) {
      clearTimeout(socketTimeoutRef.current);
      socketTimeoutRef.current = null;
    }
  };

  const [status, setStatus] = useState<LiveStatus>("idle");
  const [inputTranscript, setInputTranscript] = useState("");
  const [outputTranscript, setOutputTranscript] = useState("");
  const [lastError, setLastError] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [interrupted, setInterrupted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const isConnected = status === "connected" || status === "responding";

  const clearAudioState = useCallback(async () => {
    pcmChunksRef.current = [];
    audioQueueRef.current = [];

    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
      } catch {
        // Ignore stop failures during teardown.
      }
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore unload failures during teardown.
      }
      soundRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Ignore stop failures if recording has not fully started.
      }
      recordingRef.current = null;
    }

    setIsRecording(false);

    isPlayingRef.current = false;
  }, []);

  const getMimeTypeFromUri = (uri: string) => {
    const clean = uri.split("?")[0].toLowerCase();
    if (clean.endsWith(".wav")) return "audio/wav";
    if (clean.endsWith(".aac")) return "audio/aac";
    if (clean.endsWith(".caf")) return "audio/x-caf";
    if (clean.endsWith(".mp3")) return "audio/mpeg";
    return "audio/mp4";
  };

  const sendRecordedAudioTurn = useCallback(async (uri: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setLastError("Live session is not connected.");
      return false;
    }

    try {
      const data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!data) {
        setLastError("Recorded audio file is empty.");
        return false;
      }

      const mimeType = getMimeTypeFromUri(uri);

      ws.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data,
                    },
                  },
                ],
              },
            ],
            turnComplete: true,
          },
        }),
      );

      setInterrupted(false);
      setStatus("responding");
      setDiagnostic("Voice sent. Waiting for Gemini response...");
      return true;
    } catch (error) {
      setLastError("Failed to send recorded voice.");
      setDiagnostic(
        error instanceof Error ? error.message : "Unknown upload error.",
      );
      return false;
    }
  }, []);

  const startMicRecording = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setLastError("Connect to Live first before recording.");
      return false;
    }

    if (recordingRef.current || isRecording) {
      return true;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setLastError("Microphone permission is required.");
        setDiagnostic("Allow microphone permission and try again.");
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setInterrupted(false);
      setDiagnostic("Recording... tap mic again to send voice.");
      return true;
    } catch (error) {
      setIsRecording(false);
      setLastError("Failed to start microphone recording.");
      setDiagnostic(
        error instanceof Error ? error.message : "Unknown recording error.",
      );
      return false;
    }
  }, [isRecording]);

  const stopMicRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) {
      setIsRecording(false);
      return false;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      if (!uri) {
        setLastError("Could not read recorded audio file.");
        return false;
      }

      return await sendRecordedAudioTurn(uri);
    } catch (error) {
      recordingRef.current = null;
      setIsRecording(false);
      setLastError("Failed to stop microphone recording.");
      setDiagnostic(
        error instanceof Error ? error.message : "Unknown stop error.",
      );
      return false;
    }
  }, [sendRecordedAudioTurn]);

  const playQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    try {
      while (audioQueueRef.current.length > 0) {
        const uri = audioQueueRef.current.shift();
        if (!uri) continue;

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
        );
        soundRef.current = sound;

        await new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((playbackStatus) => {
            if (!playbackStatus.isLoaded) return;
            if (playbackStatus.didJustFinish) {
              resolve();
            }
          });
        });

        await sound.unloadAsync();
        soundRef.current = null;
      }
    } catch (error) {
      setLastError("Live audio playback failed.");
      setDiagnostic(
        error instanceof Error ? error.message : "Unknown audio error.",
      );
    } finally {
      isPlayingRef.current = false;
    }
  }, []);

  const queueTurnAudio = useCallback(async () => {
    if (pcmChunksRef.current.length === 0) return;

    try {
      const uri = pcmToWavDataUri(
        pcmChunksRef.current,
        pcmSampleRateRef.current,
      );
      audioQueueRef.current.push(uri);
      pcmChunksRef.current = [];
      await playQueue();
    } catch (error) {
      setLastError("Failed to decode Gemini audio.");
      setDiagnostic(
        error instanceof Error ? error.message : "Unknown decode error.",
      );
      pcmChunksRef.current = [];
    }
  }, [playQueue]);

  const disconnect = useCallback(() => {
    clearSocketTimeout();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    void clearAudioState();

    setDiagnostic("");
    setStatus("idle");
  }, [clearAudioState]);

  useEffect(() => {
    return () => {
      clearSocketTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      void clearAudioState();
    };
  }, [clearAudioState]);

  const connect = useCallback(async () => {
    if (wsRef.current) return;

    setLastError("");
    setDiagnostic("");
    setInterrupted(false);
    setStatus("connecting");

    try {
      const abortController = new AbortController();
      const tokenTimeout = setTimeout(() => {
        abortController.abort();
      }, TOKEN_TIMEOUT_MS);

      const tokenResponse = await fetch(LIVE_TOKEN_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
      });

      clearTimeout(tokenTimeout);

      let tokenData: LiveTokenResponse = {};
      try {
        tokenData = await tokenResponse.json();
      } catch {
        tokenData = {
          error: `Live token endpoint returned invalid JSON (${tokenResponse.status}).`,
        };
      }

      if (!tokenResponse.ok || !tokenData?.token) {
        const details = tokenData?.details ? ` (${tokenData.details})` : "";
        throw new Error(
          tokenData?.error ||
            `Failed to get live token (${tokenResponse.status})${details}.`,
        );
      }

      const ws = new WebSocket(
        `${LIVE_WS_BASE_URL}?access_token=${encodeURIComponent(tokenData.token)}`,
      );
      wsRef.current = ws;

      socketTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          setLastError("Live WebSocket handshake timeout.");
          setDiagnostic(
            "Socket never left CONNECTING. Check internet/firewall and allow generativelanguage.googleapis.com.",
          );
          setStatus("error");
          ws.close();
          return;
        }

        if (ws.readyState === WebSocket.OPEN) {
          setLastError("Live setup timeout (no setupComplete). Please retry.");
          setDiagnostic(
            "Socket opened but Gemini did not acknowledge setup within timeout.",
          );
          setStatus("error");
          ws.close();
        }
      }, SOCKET_TIMEOUT_MS);

      ws.onopen = () => {
        const setupModelRaw = tokenData.model || LIVE_MODEL;
        const setupModel = setupModelRaw.startsWith("models/")
          ? setupModelRaw
          : `models/${setupModelRaw}`;

        setDiagnostic(`Socket opened. Sending setup for ${setupModel}...`);

        const setupMessage = {
          setup: {
            model: setupModel,
            generationConfig: {
              responseModalities: ["AUDIO"],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        };

        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        const raw = await decodeSocketMessageData(event.data);
        const message = raw ? parseServerMessage(raw) : null;

        if (!message) {
          if (raw && raw.includes("setupComplete")) {
            clearSocketTimeout();
            setDiagnostic("setupComplete detected from raw socket payload.");
            setStatus("connected");
            return;
          }

          if (raw) {
            setDiagnostic(`Unparsed socket payload: ${raw.slice(0, 180)}`);
          } else {
            setDiagnostic(
              "Received non-text socket message that could not be decoded.",
            );
          }
          return;
        }

        if (message.setupComplete) {
          clearSocketTimeout();
          setDiagnostic("setupComplete received.");
          setStatus("connected");
          return;
        }

        if (message.error) {
          clearSocketTimeout();
          setLastError(
            message.error?.message ||
              "Live API setup failed. Please reconnect.",
          );
          setDiagnostic(JSON.stringify(message).slice(0, 260));
          setStatus("error");
          ws.close();
          return;
        }

        if (message.goAway) {
          setDiagnostic(
            `Server goAway: ${JSON.stringify(message.goAway).slice(0, 180)}`,
          );
        }

        const serverContent = message.serverContent;

        if (!serverContent) return;

        if (serverContent.interrupted === true) {
          setInterrupted(true);
          setStatus("connected");
        }

        const modelParts = serverContent.modelTurn?.parts;
        if (Array.isArray(modelParts)) {
          for (const part of modelParts) {
            const inlineData = part?.inlineData;
            const base64Audio = inlineData?.data;
            const mimeType = inlineData?.mimeType;

            if (!base64Audio || typeof base64Audio !== "string") continue;
            if (!mimeType?.startsWith("audio/pcm")) continue;

            pcmSampleRateRef.current = parseSampleRate(mimeType);
            try {
              pcmChunksRef.current.push(base64ToBytes(base64Audio));
            } catch (error) {
              setLastError("Failed to decode Gemini audio chunk.");
              setDiagnostic(
                error instanceof Error
                  ? error.message
                  : "Unknown chunk decode error.",
              );
            }
          }
        }

        if (serverContent.inputTranscription?.text) {
          setInputTranscript(serverContent.inputTranscription.text);
        }

        if (serverContent.outputTranscription?.text) {
          setOutputTranscript(serverContent.outputTranscription.text);
          setStatus("responding");
        }

        if (serverContent.turnComplete === true) {
          void queueTurnAudio();
          setStatus("connected");
        }
      };

      ws.onerror = () => {
        clearSocketTimeout();
        setLastError(`Live socket error (${wsStateLabel(ws.readyState)}).`);
        setDiagnostic(
          "React Native onerror has limited detail; see close code detail below.",
        );
        setStatus("error");
      };

      ws.onclose = (event) => {
        clearSocketTimeout();

        wsRef.current = null;

        if (event.code !== 1000) {
          const reason = event.reason ? ` (${event.reason})` : "";
          setLastError(`Live socket closed [${event.code}]${reason}`);
          const hint = closeHint(event.code);
          if (hint) {
            setDiagnostic(hint);
          }
        }

        setStatus((prev) => (prev === "error" ? "error" : "idle"));
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setLastError("Token request timeout. Make sure backend is reachable.");
        setDiagnostic("Token request aborted after timeout.");
      } else {
        setLastError(
          error instanceof Error ? error.message : "Failed to connect.",
        );
        setDiagnostic("Connection failed before setup completed.");
      }
      setStatus("error");
    }
  }, []);

  const sendRealtimeText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    setInterrupted(false);
    setStatus("responding");

    ws.send(
      JSON.stringify({
        realtimeInput: {
          text: trimmed,
        },
      }),
    );

    return true;
  }, []);

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
      inputTranscript,
      outputTranscript,
      interrupted,
      lastError,
      diagnostic,
      isRecording,
      connect,
      disconnect,
      resetSession,
      sendRealtimeText,
      startMicRecording,
      stopMicRecording,
    }),
    [
      connect,
      disconnect,
      inputTranscript,
      interrupted,
      isConnected,
      isRecording,
      lastError,
      diagnostic,
      outputTranscript,
      resetSession,
      sendRealtimeText,
      startMicRecording,
      stopMicRecording,
      status,
    ],
  );
};
