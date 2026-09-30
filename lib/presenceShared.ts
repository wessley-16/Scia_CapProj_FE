// Shared by lib/firebase.ts (logout), lib/presence.ts and lib/presenceTask.ts.
export const PRESENCE_TASK = "scia-presence-location";
export const SAFETY_CHANNEL_ID = "safety-check"; // must match functions/inactivityMonitor.js
export const PING_INTERVAL_MS = 5 * 60 * 1000;   // foreground heartbeat
export const BACKGROUND_INTERVAL_MS = 10 * 60 * 1000; // background location updates
