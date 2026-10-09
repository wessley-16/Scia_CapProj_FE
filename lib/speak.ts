// lib/speak.ts
//
// Read-aloud for the whole app (voice assistant replies and the "Speak"
// buttons). Uses the phone's own text-to-speech (expo-speech): free, works
// offline, and does not count toward the AI spending cap.
//
// For Tagalog this does three things that make it sound much more natural:
//  1. prepareForSpeech() rewrites things a speech engine reads badly
//     ("911", "SOS", "8:00 AM", "%") into how a Filipino would say them.
//  2. It picks the best Filipino voice installed (Enhanced/network first).
//  3. It speaks sentence by sentence, so the voice resets its intonation at
//     every full stop instead of droning through a long paragraph.

import * as Speech from "expo-speech";

export type SpeechLang = "en" | "tl";

const LOCALE: Record<SpeechLang, string> = { en: "en-US", tl: "fil-PH" };
const RATE: Record<SpeechLang, number> = { en: 0.9, tl: 0.85 }; // a little slower for older listeners

// ── Text -> something a speech engine says well ─────────────────────────
const HOUR_WORDS = [
  "alas-dose", "ala-una", "alas-dos", "alas-tres", "alas-kuwatro", "alas-singko",
  "alas-sais", "alas-siyete", "alas-otso", "alas-nuwebe", "alas-diyes", "alas-onse",
];

function tagalogTime(h: number, m: number, suffix: string): string {
  const hour12 = h % 12;
  const p = suffix.toLowerCase().replace(/\./g, "");
  let period: string;
  if (p === "am") period = h === 12 ? "ng hatinggabi" : "ng umaga";
  else period = h === 12 ? "ng tanghali" : h <= 5 ? "ng hapon" : "ng gabi";
  const base = HOUR_WORDS[hour12];
  if (m === 0) return `${base} ${period}`;
  if (m === 30) return `${base} y medya ${period}`;
  return `${base} ${m} ${period}`;
}

export function prepareForSpeech(input: string, lang: SpeechLang = "tl"): string {
  let s = input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`~]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  // "p.m." / "a.m." -> "pm" / "am" (keeps a sentence-ending full stop intact)
  s = s.replace(/\b([apAP])\.[mM]\.(?=\s+[A-Z]|\s*$)/g, "$1m."); // "p.m. Next" keeps its full stop
  s = s.replace(/\b([ap])\.m\b\.?/gi, "$1m");
  // A spaced dash is a pause when spoken
  s = s.replace(/\s[-–—]\s/g, ", ").replace(/([:;]),\s/g, "$1 ");

  // Emergency numbers are said in English digits by Filipinos.
  s = s.replace(/\b911\b/g, "nine one one");
  s = s.replace(/\bSOS\b/g, "S-O-S");
  s = s.replace(/\b3S\b/g, "three S");

  if (lang === "tl") {
    s = s.replace(/\b(\d{1,2})(?::(\d{2}))?\s*([ap]m)\b/gi, (_m, h, mm, suf) =>
      tagalogTime(Number(h), mm ? Number(mm) : 0, suf),
    );
    s = s.replace(/\bBrgy\.?\s/gi, "Barangay ");
    s = s.replace(/\bGen\.\s/g, "Heneral ");
    s = s.replace(/\bDr\.?\s/g, "Doktor ");
    s = s.replace(/(\d)\s?%/g, "$1 porsyento");
    s = s.replace(/₱\s?(\d[\d,]*)/g, (_m, n) => `${String(n).replace(/,/g, "")} piso`);
    s = s.replace(/\s&\s/g, " at ");
  } else {
    s = s.replace(/\bBrgy\.?\s/gi, "Barangay ");
    s = s.replace(/\bGen\.\s/g, "General ");
    s = s.replace(/(\d)\s?%/g, "$1 percent");
    s = s.replace(/\s&\s/g, " and ");
  }
  return s.replace(/\s+/g, " ").trim();
}

// ── Voice choice ────────────────────────────────────────────────────────
let voiceCache: Speech.Voice[] | null = null;

async function voices(): Promise<Speech.Voice[]> {
  if (!voiceCache) {
    try {
      voiceCache = await Speech.getAvailableVoicesAsync();
    } catch {
      voiceCache = [];
    }
  }
  return voiceCache;
}

const norm = (l: string) => l.toLowerCase().replace("_", "-");

function score(v: Speech.Voice): number {
  let n = 0;
  if (v.quality === Speech.VoiceQuality.Enhanced) n += 4;
  if (/network|neural|enhanced|premium|wavenet/i.test(`${v.name} ${v.identifier}`)) n += 2;
  if (/-ph$/.test(norm(v.language))) n += 1;
  return n;
}

async function bestVoice(lang: SpeechLang): Promise<string | undefined> {
  const all = await voices();
  const prefixes = lang === "tl" ? ["fil", "tl"] : ["en-ph", "en-us", "en"];
  for (const prefix of prefixes) {
    const matches = all.filter((v) => norm(v.language).startsWith(prefix));
    if (matches.length) return matches.sort((a, b) => score(b) - score(a))[0].identifier;
  }
  return undefined;
}

/** True when the phone has a Filipino text-to-speech voice installed. */
export async function hasFilipinoVoice(): Promise<boolean> {
  const all = await voices();
  return all.some((v) => /^(fil|tl)([-_]|$)/i.test(v.language));
}

// ── Speaking ────────────────────────────────────────────────────────────
let generation = 0; // bumps on every stop, so a queued sentence knows it was cancelled

const ABBREVIATIONS = /^(gen|dr|sr|jr|st|mr|mrs|ms|no|bldg|blk|lot|ave|brgy)$/i;

function sentences(text: string): string[] {
  // Split after . ! ? … followed by a space, but not after "T." / "Dr." style abbreviations.
  const out: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    current = current ? `${current} ${word}` : word;
    const m = word.match(/^(.*?)([.!?…]+)$/);
    if (!m) continue;
    const bare = m[1].replace(/^[("']+/, "");
    const isAbbreviation = (bare.length === 1 && /[A-Za-z]/.test(bare) && m[2] === ".") || ABBREVIATIONS.test(bare);
    if (!isAbbreviation) {
      out.push(current);
      current = "";
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Speak `text` in the given language. Resolves when it has finished or was
 * stopped. Safe to call again while speaking: the new text replaces the old.
 */
export async function speakText(text: string, lang: SpeechLang = "tl"): Promise<void> {
  const clean = prepareForSpeech(text, lang);
  if (!clean) return;

  try {
    await Speech.stop();
  } catch {
    /* nothing was speaking */
  }
  const myGeneration = ++generation;
  const voice = await bestVoice(lang);
  if (myGeneration !== generation) return;

  for (const sentence of sentences(clean)) {
    if (myGeneration !== generation) return;
    await new Promise<void>((resolve) => {
      Speech.speak(sentence, {
        language: LOCALE[lang],
        voice,
        rate: RATE[lang],
        pitch: 1.0,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  }
}

export function stopSpeaking(): void {
  generation += 1;
  Speech.stop().catch(() => {});
}

/** Older call used by components/SpeakButton.tsx. */
export async function speak(text: string, preferFilipino = true, onDone?: () => void): Promise<void> {
  try {
    await speakText(text, preferFilipino ? "tl" : "en");
  } finally {
    onDone?.();
  }
}
