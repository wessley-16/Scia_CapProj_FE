import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MyIdRequest } from "@/lib/firebase";

const C = {
  primary: "#1A56C4",
  primaryLight: "#EBF2FF",
  success: "#059669",
  successLight: "#ECFDF5",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
  text: "#111827",
  textSub: "#4B5563",
  textMuted: "#6B7280",
  line: "#D1D5DB",
};

type Step = {
  key: string;
  label: string;
  stamp: keyof MyIdRequest;
  hint: string;
};

// Same order as the admin dashboard's lifecycle (src/lib/idRequestStatus.js).
const STEPS: Step[] = [
  { key: "pending", label: "Request sent", stamp: "createdAt", hint: "Waiting for OSCA to review your request." },
  { key: "processing", label: "Being processed", stamp: "processedAt", hint: "OSCA is preparing your ID." },
  { key: "delivered", label: "Delivered to your barangay", stamp: "deliveredAt", hint: "OSCA sent your ID to your barangay hall." },
  { key: "received", label: "Ready for pick-up", stamp: "receivedAt", hint: "Your barangay has your ID. You can claim it there." },
  { key: "done", label: "Claimed", stamp: "claimedAt", hint: "You have picked up your ID." },
];

// Legacy "approved" (reviewed, not yet processing) sits on the first step.
const STEP_INDEX: Record<string, number> = {
  pending: 0,
  approved: 0,
  processing: 1,
  delivered: 2,
  received: 3,
  done: 4,
};

function formatStamp(value: any): string {
  const date: Date | null =
    typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : value
          ? new Date(value)
          : null;
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** True when the request is over (claimed, cancelled or rejected). */
export const isFinishedIdRequest = (status?: string) =>
  status === "done" || status === "cancelled" || status === "rejected";

export default function IdRequestTracker({
  request,
  fontScale = 1,
}: {
  request: MyIdRequest;
  fontScale?: number;
}) {
  const status = request.status;

  if (status === "cancelled" || status === "rejected") {
    return (
      <View style={[s.banner, { backgroundColor: C.dangerLight }]}>
        <Ionicons name="close-circle" size={24} color={C.danger} />
        <View style={s.bannerText}>
          <Text style={[s.bannerTitle, { color: C.danger, fontSize: 16 * fontScale }]}>
            {status === "rejected" ? "Request not approved" : "Request cancelled"}
          </Text>
          <Text style={[s.bannerBody, { fontSize: 14 * fontScale }]}>
            {request.cancelReason
              ? `Reason: ${request.cancelReason}`
              : "Please contact OSCA for details, or send a new request."}
          </Text>
        </View>
      </View>
    );
  }

  const current = STEP_INDEX[status] ?? 0;

  return (
    <View>
      {STEPS.map((step, i) => {
        const complete = i < current || status === "done";
        const active = i === current && status !== "done";
        const stamp = complete || active ? formatStamp(request[step.stamp]) : "";
        const isLast = i === STEPS.length - 1;
        const hint =
          active && status === "approved" ? "Approved by OSCA. Waiting to be processed." : step.hint;

        return (
          <View key={step.key} style={s.row}>
            <View style={s.rail}>
              <View
                style={[
                  s.dot,
                  complete && { backgroundColor: C.success, borderColor: C.success },
                  active && { backgroundColor: C.primary, borderColor: C.primary },
                ]}
              >
                {complete ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : active ? (
                  <View style={s.activeInner} />
                ) : null}
              </View>
              {!isLast && <View style={[s.connector, complete && { backgroundColor: C.success }]} />}
            </View>

            <View style={s.content}>
              <Text
                style={[
                  s.label,
                  { fontSize: 16 * fontScale },
                  !complete && !active && { color: C.textMuted, fontWeight: "600" },
                  active && { color: C.primary },
                ]}
              >
                {step.label}
              </Text>
              {(active || (complete && !!stamp)) && (
                <Text style={[s.hint, { fontSize: 14 * fontScale }]}>
                  {active ? hint : ""}
                  {active && stamp ? "\n" : ""}
                  {stamp}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row" },
  rail: { alignItems: "center", width: 32, marginRight: 12 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  activeInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  connector: { flex: 1, width: 3, backgroundColor: C.line, marginVertical: 2, minHeight: 22 },
  content: { flex: 1, paddingBottom: 18 },
  label: { fontWeight: "700", color: C.text, lineHeight: 26 },
  hint: { color: C.textSub, lineHeight: 20, marginTop: 2 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontWeight: "800" },
  bannerBody: { color: C.textSub, marginTop: 4, lineHeight: 20 },
});
