// components/home/eventFields.ts
// Shared by the event carousel and the event popup: the admin dashboard saved events with two
// different field spellings over time, so every read goes through these helpers.
import { Event } from "@/lib/firebase";

export const getTitle = (e: Event, fallback = "Untitled event") => e.title ?? e.Title ?? fallback;
export const getDescription = (e: Event) => e.description ?? e.Body ?? "";
export const getLocation = (e: Event) => e.location ?? e.Location ?? "";
export const getDate = (e: Event) => e.date ?? e.Date ?? "";

// "Saturday, October 3, 2026 · 2:00 PM". If the admin typed something that is
// not a real date, show it as written instead of "Invalid Date".
export const formatWhen = (raw: string) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const day = d.toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const hasTime = /\d{1,2}:\d{2}/.test(raw) || raw.includes("T");
  const time = hasTime
    ? d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })
    : "";
  return time ? `${day} · ${time}` : day;
};
