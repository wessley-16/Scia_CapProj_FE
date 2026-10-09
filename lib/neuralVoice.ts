// lib/neuralVoice.ts
//
// Natural Tagalog / English voice for the read-aloud feature.
//
// The phone's own text-to-speech sounds robotic in Tagalog, so this asks the
// `synthesizeSpeech` Cloud Function (Google neural / Chirp 3 HD voices, the
// kind of voice you hear in navigation apps) for an MP3 and plays it. Every
// sentence is saved on the phone after the first time, so repeated labels play
// instantly, offline, and are only generated (and billed) once.
//
// If anything goes wrong (no internet, not signed in, daily limit, function not
// deployed) it quietly falls back to the phone's built-in voice from lib/speak.ts,
// so touching something never results in silence.

import { auth } from "@/lib/firebase";
import { prepareForSpeech, speakText, stopSpeaking as stopDeviceVoice, type SpeechLang } from "@/lib/speak";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

const FUNCTIONS_BASE = "https://asia-southeast1-scia-b5440.cloudfunctions.net";
const CACHE_DIR = `${FileSystem.cacheDirectory}tts-v1/`;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_CHUNK_CHARS = 300;

let generation = 0;                 // bumps on every new request / stop, so stale audio never plays
let player: AudioPlayer | null = null;
let dirReady = false;
let unavailableUntil = 0;           // after a failure, use the phone voice for a while instead of waiting on timeouts

// ── cache ───────────────────────────────────────────────────────────────
function hash(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const cachePath = (lang: SpeechLang, text: string) =>
  `${CACHE_DIR}${lang}-${hash(text, 2166136261)}${hash(text, 84696351)}-${text.length}.mp3`;

async function ensureDir() {
  if (dirReady) return;
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  } catch {
    /* already exists */
  }
  dirReady = true;
}

// ── server ──────────────────────────────────────────────────────────────
async function fetchFromServer(text: string, lang: SpeechLang): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null; // the function requires a signed-in account

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${FUNCTIONS_BASE}/synthesizeSpeech`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: { text, lang } }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error) {
      const status = body?.error?.status;
      // Daily allowance used up: stay on the phone voice for a long while. Other errors: try again soon.
      unavailableUntil = Date.now() + (status === "RESOURCE_EXHAUSTED" ? 30 * 60 * 1000 : 90 * 1000);
      return null;
    }
    return body?.result?.audioBase64 ?? null;
  } catch {
    unavailableUntil = Date.now() + 90 * 1000;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Local file for this sentence: from the cache if we have it, otherwise generated now. null = not available. */
async function audioFor(text: string, lang: SpeechLang): Promise<string | null> {
  await ensureDir();
  const path = cachePath(lang, text);
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return path;
  } catch {
    /* fall through to the server */
  }
  if (Date.now() < unavailableUntil) return null;
  const base64 = await fetchFromServer(text, lang);
  if (!base64) return null;
  try {
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
    return path;
  } catch {
    return null;
  }
}

// ── playback ────────────────────────────────────────────────────────────
function releasePlayer() {
  if (!player) return;
  try { player.pause(); } catch { /* already stopped */ }
  try { player.remove(); } catch { /* already removed */ }
  player = null;
}

function playFile(uri: string, mine: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (mine !== generation) { resolve(); return; }
    releasePlayer();
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    const p = createAudioPlayer({ uri });
    player = p;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      try { (sub as any)?.remove?.(); } catch { /* ignore */ }
      resolve();
    };
    const sub = (p as any).addListener("playbackStatusUpdate", (s: any) => {
      if (s?.didJustFinish) finish();
    });
    const safety = setTimeout(finish, 20000); // in case the "finished" event never arrives
    p.play();
  });
}

// ── public API ──────────────────────────────────────────────────────────
function chunks(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    let rest = sentence.trim();
    while (rest.length > MAX_CHUNK_CHARS) {
      const cut = rest.lastIndexOf(" ", MAX_CHUNK_CHARS);
      out.push(rest.slice(0, cut > 0 ? cut : MAX_CHUNK_CHARS));
      rest = rest.slice(cut > 0 ? cut + 1 : MAX_CHUNK_CHARS).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

/**
 * Read `text` aloud in `lang`, replacing anything already being read.
 * Resolves when it has finished or was cancelled. Never throws.
 */
export async function speakNatural(text: string, lang: SpeechLang = "tl"): Promise<void> {
  const clean = prepareForSpeech(text, lang);
  if (!clean) return;

  const mine = ++generation;
  releasePlayer();
  stopDeviceVoice();

  const parts = chunks(clean);
  try {
    // Start fetching the next sentence while the current one plays.
    let next: Promise<string | null> = audioFor(parts[0], lang);
    for (let i = 0; i < parts.length; i++) {
      const uri = await next;
      if (mine !== generation) return;
      if (i + 1 < parts.length) next = audioFor(parts[i + 1], lang);
      if (!uri) {
        // Neural voice not available: finish the rest with the phone's voice.
        await speakText(parts.slice(i).join(" "), lang);
        return;
      }
      await playFile(uri, mine);
      if (mine !== generation) return;
    }
  } catch {
    if (mine === generation) await speakText(clean, lang).catch(() => {});
  }
}

export function stopNatural(): void {
  generation += 1;
  releasePlayer();
  stopDeviceVoice();
}
