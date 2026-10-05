import { useAuth } from "@/context/AuthContext";
import { updateMyUserFields } from "@/lib/firebase";
import { confirmSafe, ensureMonitoringRunning, recordPresence } from "@/lib/presence";
import { PING_INTERVAL_MS } from "@/lib/presenceShared";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { tr } from "@/lib/i18n";
import { useEffect } from "react";
import { Alert, AppState } from "react-native";

// A notification response can be replayed on re-mount; only ever prompt once per notification.
const handled = new Set<string>();

/**
 * Mount once inside the signed-in area. For seniors who opted in to Safety
 * Monitoring it: keeps the background tracker running, sends a heartbeat every
 * few minutes while the app is open, and answers the server's 50-minute
 * "Are you safe?" push.
 */
export function usePresence() {
  const { user, isGuest } = useAuth();
  const router = useRouter();
  const uid = user?.uid;
  const optedIn = !!user?.safety_monitoring_opt_in && !isGuest;

  useEffect(() => {
    if (!uid || !optedIn) return;
    ensureMonitoringRunning(uid).catch((e) => console.warn("safety monitoring start failed:", e));
  }, [uid, optedIn]);

  useEffect(() => {
    if (!uid || !optedIn) return;
    const beat = () => { recordPresence().catch(() => {}); };
    const timer = setInterval(() => { if (AppState.currentState === "active") beat(); }, PING_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") beat(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [uid, optedIn]);

  useEffect(() => {
    if (!uid || !optedIn) return;
    const sub = Notifications.addPushTokenListener((t) => {
      updateMyUserFields(uid, { push_token: String(t.data) }).catch(() => {});
    });
    return () => sub.remove();
  }, [uid, optedIn]);

  useEffect(() => {
    if (!uid) return;

    const ask = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      if (response.notification.request.content.data?.type !== "safety_check") return;
      handled.add(id);
      Alert.alert(
        tr("safeTitle"),
        tr("safeBody"),
        [
          { text: tr("safeNeedHelp"), style: "destructive", onPress: () => router.push("/(tabs)/emergency") },
          {
            text: tr("safeImSafe"),
            onPress: () => {
              confirmSafe(uid).catch(() =>
                Alert.alert(tr("safeConfirmFailTitle"), tr("safeConfirmFailBody")),
              );
            },
          },
        ],
        { cancelable: false },
      );
    };

    const sub = Notifications.addNotificationResponseReceivedListener(ask);
    // Also covers a tap that launched the app from a closed state.
    Notifications.getLastNotificationResponseAsync().then(ask).catch(() => {});
    return () => sub.remove();
  }, [uid, router]);
}
