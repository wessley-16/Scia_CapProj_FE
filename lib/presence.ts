// Presence & location tracking for Safety Monitoring.
//
// While a senior has opted in, the phone keeps users/{uid}.last_active_timestamp
// and .last_known_location fresh: every 5 min while the app is open (see
// hooks/usePresence.ts) and every ~10 min in the background (lib/presenceTask.ts).
// The server (functions/inactivityMonitor.js) does the rest.
import { tr } from "@/lib/i18n";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  auth,
  updateMyUserFields,
  writePresence,
  writeSafeConfirmation,
} from "./firebase";
import {
  BACKGROUND_INTERVAL_MS,
  PRESENCE_TASK,
  SAFETY_CHANNEL_ID,
} from "./presenceShared";

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

/** Best-effort current position without waking the GPS if a recent fix exists. */
async function currentCoords() {
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return undefined;
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
  const pos =
    recent ??
    (await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      15000,
    ));
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? undefined,
  };
}

/** One heartbeat. `extra` is written in the same document update. */
export async function recordPresence(extra: Record<string, any> = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  let coords;
  try {
    coords = await currentCoords();
  } catch {
    // No fix right now: still stamp activity so the senior isn't flagged just
    // because GPS was slow. The last known location stays as it was.
  }
  await writePresence(uid, coords, extra);
  return true;
}

export async function ensureSafetyChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(SAFETY_CHANNEL_ID, {
    name: "Safety check",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    // No `sound` key on purpose: leaving it out gives the system default sound.
    // Passing "default" is read as a custom file name and fails on SDK 57
    // ("Custom sound 'default' not found in native app").
  });
}

/** FCM device token the server pushes the "Are you safe?" message to (Android). */
export async function registerPushToken(uid: string) {
  if (Platform.OS !== "android") return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const token = await Notifications.getDevicePushTokenAsync();
  await updateMyUserFields(uid, { push_token: String(token.data) });
}

export async function startBackgroundPresence() {
  if (await Location.hasStartedLocationUpdatesAsync(PRESENCE_TASK)) return;
  await Location.startLocationUpdatesAsync(PRESENCE_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: BACKGROUND_INTERVAL_MS,
    distanceInterval: 0, // time-based only, so a senior sitting at home still checks in
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: tr("safeServiceTitle"),
      notificationBody: tr("safeServiceBody"),
      notificationColor: "#2356E1",
    },
  });
}

export async function stopBackgroundPresence() {
  if (await Location.hasStartedLocationUpdatesAsync(PRESENCE_TASK)) {
    await Location.stopLocationUpdatesAsync(PRESENCE_TASK);
  }
}

export type EnableResult =
  | { ok: true; notifications: boolean }
  | { ok: false; reason: "location" | "background" };

/** Runs after the senior agreed to the disclosure: asks for permissions, then turns everything on. */
export async function enableSafetyMonitoring(uid: string): Promise<EnableResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { ok: false, reason: "location" };
  // Android 11+ requires "Allow all the time" as a separate step.
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return { ok: false, reason: "background" };

  let notifications = false;
  try {
    await ensureSafetyChannel();
    const n = await Notifications.requestPermissionsAsync();
    notifications = n.granted;
  } catch {}

  await startBackgroundPresence();
  // One write: opt-in + enabled + fresh timestamp/location.
  await recordPresence({ safety_monitoring_opt_in: true, safety_monitoring_enabled: true });
  if (notifications) await registerPushToken(uid).catch(() => {});
  return { ok: true, notifications };
}

export async function disableSafetyMonitoring(uid: string) {
  await stopBackgroundPresence().catch(() => {});
  await updateMyUserFields(uid, {
    safety_monitoring_opt_in: false,
    safety_monitoring_enabled: false,
    push_token: null,
  });
}

/**
 * Called each time an opted-in senior signs in / the app starts. Never prompts:
 * if a permission was revoked in system settings it stays off (returns false).
 */
export async function ensureMonitoringRunning(uid: string) {
  const [fg, bg] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  if (!fg.granted || !bg.granted) return false;
  await ensureSafetyChannel().catch(() => {});
  await startBackgroundPresence();
  await recordPresence({ safety_monitoring_enabled: true });
  await registerPushToken(uid).catch(() => {});
  return true;
}

export const confirmSafe = (uid: string) => writeSafeConfirmation(uid);
