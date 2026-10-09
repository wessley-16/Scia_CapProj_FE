// lib/readAloud.ts
//
// "Read aloud on touch": when the option is on (Settings), touching any text
// reads it out loud, the way the admin dashboard reads what the pointer lands on.
// Buttons still work exactly as before; hearing the label never blocks a tap
// (important for the SOS button).
//
// How it works:
//  - Every <Text> in the app comes from components/ReadAloudText.tsx, which
//    registers itself here while it is on screen.
//  - components/ReadAloudRoot.tsx watches touches and calls handleReadAloudTouch().
//  - We find the Text that was touched (exact native view first, nearest Text
//    to the finger as a fallback) and read it with the natural voice
//    (lib/neuralVoice.ts), in Tagalog by default.

import { speakNatural, stopNatural } from "@/lib/neuralVoice";
import { findNodeHandle } from "react-native";
import { isValidElement, type MutableRefObject, type ReactNode } from "react";

export type ReadAloudLang = "tl" | "en";

// Spoken by the settings screen. Kept here (not in translations.ts) because they are
// spoken in the VOICE language, which can differ from the language the screen is shown in.
export const READ_ALOUD_MESSAGES: Record<ReadAloudLang, { on: string; test: string }> = {
  tl: {
    on: "Naka-on na po ang pagbasa. Hawakan ang kahit anong teksto para marinig ito.",
    test: "Magandang araw po! Ito po ang boses na babasa para sa inyo.",
  },
  en: {
    on: "Read aloud is on. Touch any text to hear it.",
    test: "Hello! This is the voice that will read to you.",
  },
};

const config = { enabled: false, lang: "tl" as ReadAloudLang };

export function configureReadAloud(next: Partial<typeof config>) {
  const wasEnabled = config.enabled;
  Object.assign(config, next);
  if (wasEnabled && !config.enabled) stopNatural();
}

// ── registry of on-screen <Text> elements ───────────────────────────────
type Entry = { ref: MutableRefObject<any>; props: MutableRefObject<any> };
const registry = new Set<Entry>();

export function registerReadable(entry: Entry): () => void {
  registry.add(entry);
  return () => {
    registry.delete(entry);
  };
}

function flatten(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  if (isValidElement(node)) return flatten((node.props as any)?.children);
  return "";
}

function textOf(entry: Entry): string {
  const p = entry.props.current || {};
  const label = p.accessibilityLabel ?? p["aria-label"];
  const raw = typeof label === "string" && label.trim() ? label : flatten(p.children);
  return raw.replace(/\s+/g, " ").trim();
}

// ── finding the touched text ────────────────────────────────────────────
function measure(entry: Entry): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const node = entry.ref.current;
    if (!node || typeof node.measureInWindow !== "function") { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), 120);
    try {
      node.measureInWindow((x: number, y: number, w: number, h: number) => {
        clearTimeout(timer);
        resolve(w > 0 && h > 0 ? { x, y, w, h } : null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

const NEAR_PX = 28; // touching just beside a label (inside its button's padding) still reads that label

async function findEntry(target: number | undefined, pageX: number, pageY: number): Promise<Entry | null> {
  // 1) The exact text view that received the touch. Nested <Text> shares its parent's view, so take the longest.
  if (typeof target === "number") {
    let best: Entry | null = null;
    let bestLen = 0;
    registry.forEach((e) => {
      let handle: number | null = null;
      try { handle = e.ref.current ? findNodeHandle(e.ref.current) : null; } catch { handle = null; }
      if (handle === target) {
        const len = textOf(e).length;
        if (len > bestLen) { best = e; bestLen = len; }
      }
    });
    if (best) return best;
  }

  // 2) Otherwise the closest text to the finger (covers touching a button's padding).
  const all = Array.from(registry).slice(0, 250);
  const rects = await Promise.all(all.map(measure));
  let winner: Entry | null = null;
  let winnerDist = Infinity;
  rects.forEach((r, i) => {
    if (!r) return;
    const dx = Math.max(r.x - pageX, 0, pageX - (r.x + r.w));
    const dy = Math.max(r.y - pageY, 0, pageY - (r.y + r.h));
    const dist = Math.hypot(dx, dy);
    if (dist <= NEAR_PX && dist < winnerDist && textOf(all[i]).length > 0) {
      winner = all[i];
      winnerDist = dist;
    }
  });
  return winner;
}

// ── the touch handler ───────────────────────────────────────────────────
let lastText = "";
let lastAt = 0;

export async function handleReadAloudTouch(native: { target?: number; pageX?: number; pageY?: number }) {
  if (!config.enabled) return;
  try {
    const entry = await findEntry(native.target, native.pageX ?? 0, native.pageY ?? 0);
    if (!entry || !config.enabled) return;
    const text = textOf(entry);
    if (text.length < 2) return;

    const now = Date.now();
    if (text === lastText && now - lastAt < 900) return; // a double-tap should not restart the sentence
    lastText = text;
    lastAt = now;
    speakNatural(text, config.lang);
  } catch {
    /* reading aloud must never get in the way of the app */
  }
}
