// Background location task. Must be imported once from app/_layout.tsx so it is
// registered every time the JS runtime starts (including when Android wakes the
// app headlessly for a location update).
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { auth, subscribeToAuthState, writePresence } from "./firebase";
import { PRESENCE_TASK } from "./presenceShared";

// In a headless start the persisted sign-in restores a moment after launch.
function waitForUid(timeoutMs = 8000): Promise<string | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { unsub(); resolve(null); }, timeoutMs);
    const unsub = subscribeToAuthState((u) => {
      if (u) { clearTimeout(timer); unsub(); resolve(u.uid); }
    });
  });
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  PRESENCE_TASK,
  async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const uid = await waitForUid();
    if (!uid) return;
    const { latitude, longitude, accuracy } = data.locations[data.locations.length - 1].coords;
    try {
      await writePresence(uid, { latitude, longitude, accuracy: accuracy ?? undefined });
    } catch (e) {
      console.warn("presence task write failed:", e);
    }
  },
);
