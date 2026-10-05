// lib/pickup.ts
//
// OSCA Office pickup scheduling for physical Senior Citizen IDs (mobile app side).
// Mirrors the admin dashboard's src/lib/pickupSlots.js and functions/pickup.js,
// so the app, the dashboard and the Cloud Function all agree on what a "slot" is.
//
// Only the OSCA admin releases physical IDs, in person at the OSCA Office (which
// is located at City Hall). So every request gets ONE pickup slot (a date + a
// time) and the senior visits the OSCA Office once.
//
// Data (all written by the admin side; the app only reads, except through bookIdPickup):
//   osca_office/settings   office hours + live status (open / break / closed)
//   pickup_slots/{date}    { counts: { "08:00": 2 } } seats already taken per time
//   id_requests/{id}.pickup { date: "YYYY-MM-DD", time: "HH:MM", bookedBy }
//
// All dates/times are Philippine time, stored as plain strings, so they never
// shift with the phone's time zone.

import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";
import { auth } from "@/lib/firebase";
import { tr } from "@/lib/i18n";

const db = getFirestore();

export type OfficeState = "open" | "break" | "closed";

export interface OfficeSchedule {
  days: number[]; // 0 = Sunday ... 6 = Saturday
  start: string; // "08:00"
  end: string; // "12:00"
  slotMinutes: number;
  capacityPerSlot: number;
}

export interface OfficeSettings {
  status: OfficeState;
  statusNote: string;
  location: string;
  schedule: OfficeSchedule;
  closedDates: string[];
  advanceDays: number;
}

export interface Pickup {
  date: string;
  time: string;
  bookedBy?: "senior" | "osca" | string;
}

export const DEFAULT_OFFICE: OfficeSettings = {
  status: "open",
  statusNote: "",
  location: "OSCA Office, Valenzuela City Hall",
  schedule: { days: [1, 2, 3, 4, 5], start: "08:00", end: "12:00", slotMinutes: 30, capacityPerSlot: 3 },
  closedDates: [],
  advanceDays: 30,
};

/** How many times a senior may change their own time (the server enforces it too). */
export const MAX_SENIOR_CHANGES = 3;

const pad = (n: number) => String(n).padStart(2, "0");

export const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const toHHMM = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/** "now" as a Date whose UTC getters read as Philippine time. */
const phNow = () => new Date(Date.now() + 8 * 60 * 60 * 1000);
export const phToday = () => {
  const n = phNow();
  return `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}`;
};
const phMinutesNow = () => {
  const n = phNow();
  return n.getUTCHours() * 60 + n.getUTCMinutes();
};
export const weekdayOf = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();
export const addDays = (dateStr: string, n: number) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** Settings with defaults filled in, so a half-filled doc never breaks the screen. */
export function mergeOffice(raw: any): OfficeSettings {
  const r = raw || {};
  const s = r.schedule || {};
  const status: OfficeState = ["open", "break", "closed"].includes(r.status) ? r.status : "open";
  return {
    ...DEFAULT_OFFICE,
    ...r,
    status,
    statusNote: typeof r.statusNote === "string" ? r.statusNote : "",
    location: r.location || DEFAULT_OFFICE.location,
    schedule: {
      days: Array.isArray(s.days) && s.days.length ? s.days.map(Number) : DEFAULT_OFFICE.schedule.days,
      start: s.start || DEFAULT_OFFICE.schedule.start,
      end: s.end || DEFAULT_OFFICE.schedule.end,
      slotMinutes: Number(s.slotMinutes) > 0 ? Number(s.slotMinutes) : DEFAULT_OFFICE.schedule.slotMinutes,
      capacityPerSlot:
        Number(s.capacityPerSlot) > 0 ? Number(s.capacityPerSlot) : DEFAULT_OFFICE.schedule.capacityPerSlot,
    },
    closedDates: Array.isArray(r.closedDates) ? r.closedDates : [],
    advanceDays: Number(r.advanceDays) > 0 ? Number(r.advanceDays) : DEFAULT_OFFICE.advanceDays,
  };
}

/** Every start time offered on a normal day: ["08:00", "08:30", ... "11:30"]. */
export function slotTimes(schedule: OfficeSchedule): string[] {
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  if (start == null || end == null || end <= start) return [];
  const out: string[] = [];
  for (let t = start; t + schedule.slotMinutes <= end; t += schedule.slotMinutes) out.push(toHHMM(t));
  return out;
}

/** The next bookable dates (skips closed weekdays, closed dates and the past). */
export function bookableDates(office: OfficeSettings, maxCount = 14): string[] {
  const today = phToday();
  const times = slotTimes(office.schedule);
  const out: string[] = [];
  for (let i = 0; i <= office.advanceDays && out.length < maxCount; i += 1) {
    const d = addDays(today, i);
    if (!office.schedule.days.includes(weekdayOf(d))) continue;
    if (office.closedDates.includes(d)) continue;
    // Today only counts while there is still a slot left today.
    if (d === today && !times.some((tm) => (toMinutes(tm) as number) > phMinutesNow())) continue;
    out.push(d);
  }
  return out;
}

/** Is this time still in the future (only matters for today)? */
export const isSlotInFuture = (dateStr: string, time: string) =>
  dateStr > phToday() || (dateStr === phToday() && (toMinutes(time) as number) > phMinutesNow());

// ── wording (English / Tagalog follow the app language) ──────────────────────
export function formatTime12(hhmm: string): string {
  const mins = toMinutes(hhmm);
  if (mins == null) return hhmm || "";
  const h24 = Math.floor(mins / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(mins % 60)} ${h24 >= 12 ? "PM" : "AM"}`;
}

const ymd = (dateStr: string) => dateStr.split("-").map(Number) as [number, number, number];

/** "Lunes, Oktubre 12, 2026" / "Monday, October 12, 2026" */
export function formatDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const [y, mo, d] = ymd(dateStr);
  return `${tr("pkDow" + weekdayOf(dateStr))}, ${tr("pkMonL" + (mo - 1))} ${d}, ${y}`;
}

/** "Lun Okt 12" / "Mon Oct 12" (for the day buttons) */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const [, mo, d] = ymd(dateStr);
  return `${tr("pkDowS" + weekdayOf(dateStr))} ${tr("pkMonS" + (mo - 1))} ${d}`;
}

/** "Lunes, Oktubre 12, 2026 · 8:30 AM" */
export const formatPickup = (p?: Pickup | null): string =>
  p && p.date && p.time ? `${formatDateLong(p.date)} · ${formatTime12(p.time)}` : "";

/** "Lun–Biy" for contiguous days, otherwise "Lun, Miy, Biy". */
export function formatOfficeDays(days: number[]): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (!d.length) return "";
  const contiguous = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
  if (d.length > 2 && contiguous) return `${tr("pkDowS" + d[0])}–${tr("pkDowS" + d[d.length - 1])}`;
  return d.map((v) => tr("pkDowS" + v)).join(", ");
}

/** "Lun–Biy · 8:00 AM – 12:00 PM" */
export const formatOfficeHours = (office: OfficeSettings): string =>
  `${formatOfficeDays(office.schedule.days)} · ${formatTime12(office.schedule.start)} – ${formatTime12(
    office.schedule.end,
  )}`;

export type EffectiveOffice = { state: OfficeState | "outside"; note: string };

/**
 * What seniors should see right now. The manual status (open / break / closed)
 * wins when it says break or closed; "open" is only shown during office hours,
 * so a forgotten toggle at 5 PM does not tell seniors the office is open.
 */
export function effectiveOfficeStatus(office: OfficeSettings): EffectiveOffice {
  const today = phToday();
  if (office.status === "break") return { state: "break", note: office.statusNote };
  if (office.status === "closed") return { state: "closed", note: office.statusNote };
  const now = phMinutesNow();
  const inHours =
    office.schedule.days.includes(weekdayOf(today)) &&
    !office.closedDates.includes(today) &&
    now >= (toMinutes(office.schedule.start) ?? 0) &&
    now < (toMinutes(office.schedule.end) ?? 0);
  return inHours ? { state: "open", note: office.statusNote } : { state: "outside", note: "" };
}

// ── live data ────────────────────────────────────────────────────────────────
/** Live office settings (hours + open/break/closed). Falls back to the defaults. */
export function subscribeToOffice(callback: (office: OfficeSettings) => void) {
  return onSnapshot(
    doc(db, "osca_office", "settings"),
    (snap: any) => callback(mergeOffice(snap && snap.exists() ? snap.data() : null)),
    (error: any) => {
      console.warn("subscribeToOffice error:", error);
      callback(mergeOffice(null));
    },
  );
}

/** Live seats already taken per time for one day: { "08:00": 2 }. */
export function subscribeToPickupCounts(date: string, callback: (counts: Record<string, number>) => void) {
  return onSnapshot(
    doc(db, "pickup_slots", date),
    (snap: any) => callback((snap && snap.exists() && snap.data().counts) || {}),
    () => callback({}),
  );
}

// ── booking (Cloud Function) ─────────────────────────────────────────────────
// bookIdPickup lives in the admin project (functions/pickup.js, asia-southeast1).
// The app has no Functions SDK, so it is called over HTTPS with the standard
// callable protocol: POST { data } + the user's ID token -> { result } or
// { error: { message, status } }. The server checks the capacity again, so a
// stale screen can never overbook a time.
const FUNCTIONS_BASE = "https://asia-southeast1-scia-b5440.cloudfunctions.net";

export class PickupError extends Error {
  /** Which translated message to show. */
  messageKey: string;
  constructor(messageKey: string) {
    super(messageKey);
    this.messageKey = messageKey;
  }
}

function errorKey(status?: string, message?: string): string {
  const msg = String(message || "").toLowerCase();
  if (status === "RESOURCE_EXHAUSTED" || msg.includes("already full")) return "pkErrFull";
  if (msg.includes("changed your schedule")) return "pkErrLimit";
  if (msg.includes("already finished")) return "pkErrFinished";
  if (status === "UNAUTHENTICATED") return "pkErrSignIn";
  if (status === "INVALID_ARGUMENT") return "pkErrInvalid";
  return "pkErrGeneric";
}

/** Pick (or change) the City Hall pickup day + time for one of my ID requests. */
export async function bookIdPickup(
  requestId: string,
  date: string,
  time: string,
): Promise<{ ok: boolean; unchanged?: boolean; pickup: { date: string; time: string } }> {
  const user = auth.currentUser;
  if (!user) throw new PickupError("pkErrSignIn");

  let res: Response;
  try {
    const token = await user.getIdToken();
    res = await fetch(`${FUNCTIONS_BASE}/bookIdPickup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: { requestId, date, time } }),
    });
  } catch {
    throw new PickupError("pkErrNet");
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response, handled below */
  }
  if (!res.ok || body?.error) {
    throw new PickupError(errorKey(body?.error?.status, body?.error?.message));
  }
  return body?.result;
}
