import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ReadAloudText";
import SpeakButton from "@/components/SpeakButton";
import { Palette } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";

/**
 * Appointment lifecycle, as written by the Barangay dashboard
 * (SCIA_Admin_Firebase -> src/pages/HealthCenters.jsx):
 *
 *   pending  ->  confirmed  ->  completed
 *       \-------------\--------> cancelled   (declined / cancelled by the 3S Center)
 *
 * Keep in sync with APPOINTMENT_STATUSES in HealthCenters.jsx.
 */
export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

/** Maps any spelling the data might carry onto the four real statuses. */
export function normalizeAppointmentStatus(raw: unknown): AppointmentStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "confirmed" || s === "approved") return "confirmed";
  if (s === "completed" || s === "done") return "completed";
  if (s === "cancelled" || s === "canceled" || s === "declined" || s === "rejected") {
    return "cancelled";
  }
  return "pending";
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STEPS: { key: Exclude<AppointmentStatus, "cancelled">; label: string }[] = [
  { key: "pending", label: "Submitted" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
];

const STEP_INDEX: Record<Exclude<AppointmentStatus, "cancelled">, number> = {
  pending: 0,
  confirmed: 1,
  completed: 2,
};


type Props = {
  status: unknown;
  fontScale?: number;
};

export default function AppointmentStatusTracker({ status, fontScale = 1 }: Props) {
  const { colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const BLUE = c.primary;
  const GREEN = c.success;
  const RED = c.danger;
  const GRAY = c.border;
  const { t } = useSettings();
  const current = normalizeAppointmentStatus(status);

  if (current === "cancelled") {
    return (
      <View style={styles.cancelledRow}>
        <Ionicons name="close-circle" size={20} color={RED} />
        <Text style={[styles.cancelledText, { fontSize: 14 * fontScale }]}>
          {t("apptCancelledMsg")}
        </Text>
      </View>
    );
  }

  const reached = STEP_INDEX[current];

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {STEPS.map((step, i) => {
          const done = i <= reached;
          const isCurrent = i === reached;
          const color = done ? (current === "completed" ? GREEN : BLUE) : GRAY;
          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepCol}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: done ? color : "white", borderColor: color },
                    isCurrent && styles.dotCurrent,
                  ]}
                >
                  {done && <Ionicons name="checkmark" size={12} color="white" />}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    { fontSize: 14 * fontScale },
                    done && { color: "#1F2937", fontWeight: "700" },
                  ]}
                  numberOfLines={1}
                >
                  {t("apptStep_" + step.key)}
                </Text>
              </View>
              {i < STEPS.length - 1 && (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: i < reached ? (current === "completed" ? GREEN : BLUE) : GRAY },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <Text style={[styles.hint, { fontSize: 14 * fontScale }]}>
        {current === "pending" && t("apptHintPending")}
        {current === "confirmed" && t("apptHintConfirmed")}
        {current === "completed" && t("apptHintCompleted")}
      </Text>
      <SpeakButton
        style={{ marginTop: 10 }}
        text={
          current === "pending" ? t("apptHintPending") : current === "confirmed" ? t("apptHintConfirmed") : t("apptHintCompleted")
        }
      />
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: { marginTop: 10 },
  track: { flexDirection: "row", alignItems: "flex-start" },
  stepCol: { alignItems: "center", width: 64 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotCurrent: { transform: [{ scale: 1.15 }] },
  line: { flex: 1, height: 3, marginTop: 10, marginHorizontal: -6, borderRadius: 2 },
  stepLabel: { marginTop: 4, color: c.textMuted, textAlign: "center" },
  hint: { marginTop: 8, color: c.textMuted, fontStyle: "italic" },
  cancelledRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 },
  cancelledText: { flex: 1, color: c.danger },
});
