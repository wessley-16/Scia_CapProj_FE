// lib/aiUsage.ts
//
// Per-user AI spending cap, shared by the text chatbot AND the voice
// assistant (both must call assertWithinBudget() before a request and
// recordUsage() after it, so they draw from the SAME total).
//
// How it works
//  - Every Gemini response reports how many tokens it used (usageMetadata).
//    We turn that into dollars and add it to the user's running total.
//  - Signed-in users: the total lives in Firestore at ai_usage/{uid}
//    (field: spentUsd). Firestore rules let a user only RAISE it, never
//    lower or delete it — see the rules block that goes with this file.
//  - Guests have no account, so their total is kept on the device only.
//    That is weaker (reinstalling resets it) — fine for a demo.
//  - Once spentUsd >= AI_LIMIT_USD the next request is refused. A single
//    reply can overshoot by a fraction of a cent, since the cost is only
//    known after the reply arrives.
//
// IMPORTANT: this is enforced in the app. It stops normal users and stops
// them editing the number in Firestore, but it cannot stop someone running
// a modified copy of the app that skips these calls. A hard guarantee needs
// a backend (e.g. a Cloud Function that calls Gemini and does this check).

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  doc,
  getDoc,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

// Flip to false while debugging the chatbot itself, then back to true.
export const BUDGET_ENABLED = true;

// Max combined chatbot + voice spend per user, in US dollars.
export const AI_LIMIT_USD = 0.2;

// USD per 1 million tokens for CHAT_MODEL / AUDIO_MODEL in lib/firebaseAI.ts.
// Update these two numbers whenever you change the model — check Google's
// current Gemini pricing page, do not trust these blindly.
// (gemini-3.5-flash-lite on Vertex AI: $0.30 in / $2.50 out.)
const INPUT_USD_PER_M = 0.3;
const OUTPUT_USD_PER_M = 2.5;

// Used only when the response has no token counts at all: assume a fairly
// large prompt (system prompt + history) so we never under-count.
const FALLBACK_INPUT_TOKENS = 1500;

export const AI_LIMIT_MESSAGE =
  "Naabot na po ninyo ang limitasyon sa paggamit ng AI assistant. Para sa iba pang tulong, pumunta po sa OSCA Valenzuela o sa pinakamalapit na health center. 🙏";

const BUDGET_ERROR_CODE = "ai_budget_exceeded";
const GUEST_SCOPE = "guest";
const GUEST_STORAGE_KEY = "ai_usage_guest";
const USAGE_COLLECTION = "ai_usage";

function budgetError() {
  return Object.assign(new Error("AI budget exceeded"), {
    code: BUDGET_ERROR_CODE,
  });
}

// (Checked by code, not `instanceof`, which is unreliable for Error
// subclasses under some React Native/Hermes builds.)
export function isBudgetError(e: unknown): boolean {
  return (e as any)?.code === BUDGET_ERROR_CODE;
}

// The parts of response.usageMetadata we use. All optional on purpose.
export type UsageLike =
  | {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
      totalTokenCount?: number;
    }
  | null
  | undefined;

export function estimateCostUsd(usage: UsageLike, fallbackOutputChars = 0): number {
  const prompt = usage?.promptTokenCount;

  let inTokens: number;
  let outTokens: number;

  if (typeof prompt === "number") {
    inTokens = prompt;
    // "Thinking" tokens are billed as output, so count them too. Taking the
    // larger of the two ways of computing output can only over-count a hair.
    const counted =
      (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
    const viaTotal =
      typeof usage?.totalTokenCount === "number" ? usage.totalTokenCount - prompt : 0;
    outTokens = Math.max(counted, viaTotal);
  } else {
    inTokens = FALLBACK_INPUT_TOKENS;
    outTokens = Math.ceil(fallbackOutputChars / 4); // ~4 characters per token
  }

  return (inTokens * INPUT_USD_PER_M + outTokens * OUTPUT_USD_PER_M) / 1_000_000;
}

// ── Storage ──────────────────────────────────────────────────────────────
const db = getFirestore();

// Remember the total in memory so we do not hit Firestore on every message.
let cache: { key: string; spent: number } | null = null;

async function readSpent(key: string): Promise<number> {
  if (cache?.key === key) return cache.spent;

  let spent = 0;
  if (key === GUEST_SCOPE) {
    spent = Number(await AsyncStorage.getItem(GUEST_STORAGE_KEY)) || 0;
  } else {
    const snap = await getDoc(doc(db, USAGE_COLLECTION, key));
    spent = snap.exists() ? Number(snap.data()?.spentUsd) || 0 : 0;
  }

  cache = { key, spent };
  return spent;
}

/**
 * Call BEFORE every AI request. `key` is the user's uid, or "guest".
 * Throws a budget error (check with isBudgetError) when the limit is
 * reached. Any other error (e.g. Firestore unreachable) also throws, so the
 * cap fails closed instead of silently letting requests through.
 */
export async function assertWithinBudget(key: string): Promise<void> {
  if (!BUDGET_ENABLED) return;
  const spent = await readSpent(key);
  if (spent >= AI_LIMIT_USD) throw budgetError();
}

/**
 * Call AFTER every successful AI request with response.usageMetadata.
 * Never throws — a failed save must not break the chat.
 */
export async function recordUsage(
  key: string,
  usage: UsageLike,
  fallbackOutputChars = 0,
): Promise<void> {
  if (!BUDGET_ENABLED) return;

  const cost = Number(estimateCostUsd(usage, fallbackOutputChars).toFixed(6));
  if (!(cost > 0)) return;

  const before = cache?.key === key ? cache.spent : 0;
  cache = { key, spent: before + cost };

  try {
    if (key === GUEST_SCOPE) {
      await AsyncStorage.setItem(GUEST_STORAGE_KEY, String(cache.spent));
    } else {
      await setDoc(
        doc(db, USAGE_COLLECTION, key),
        { spentUsd: increment(cost), updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  } catch (e) {
    console.warn("[aiUsage] could not save usage:", e);
  }
}

/** Dollars left for this user (0 when the limit is reached). */
export async function getRemainingUsd(key: string): Promise<number> {
  const spent = await readSpent(key);
  return Math.max(0, AI_LIMIT_USD - spent);
}