import SpeakButton from "@/components/SpeakButton";
import { Palette } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "@/components/ReadAloudText";
import { MyIdRequest } from "@/lib/firebase";
import { DEFAULT_OFFICE, formatPickup, MAX_SENIOR_CHANGES, OfficeSettings } from "@/lib/pickup";
import { useSettings } from "@/context/SettingsContext";

const makeColors = (p: Palette) => ({
  primary: p.info,
  primaryLight: p.surfaceSoft,
  success: p.success,
  successLight: p.successSoft,
  danger: p.danger,
  dangerLight: p.dangerSoft,
  text: p.text,
  textSub: p.textSecondary,
  textMuted: p.textMuted,
  line: p.border,
});
type Colors = ReturnType<typeof makeColors>;

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
  { key: "ready", label: "Ready to claim at OSCA", stamp: "readyAt", hint: "Go to the OSCA Office at City Hall on your pickup day." },
  { key: "done", label: "Claimed", stamp: "claimedAt", hint: "You have picked up your ID." },
];

// Legacy "approved" (reviewed, not yet processing) sits on the first step.
// The old barangay steps (delivered / received / released) no longer exist:
// only OSCA at City Hall releases IDs, so those requests show as "ready".
const STEP_INDEX: Record<string, number> = {
  pending: 0,
  approved: 0,
  processing: 1,
  ready: 2,
  delivered: 2,
  received: 2,
  released: 2,
  done: 3,
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
  office = DEFAULT_OFFICE,
  onEditPickup,
}: {
  request: MyIdRequest;
  fontScale?: number;
  /** Live OSCA office settings (for the City Hall address in the pickup card). */
  office?: OfficeSettings;
  /** Opens the "choose / change pickup time" sheet. */
  onEditPickup?: () => void;
}) {
  const { colors: palette } = useSettings();
  const C = useMemo(() => makeColors(palette), [palette]);
  const s = useMemo(() => makeS(C), [C]);
  const { t } = useSettings();
  const status = request.status;

  if (status === "cancelled" || status === "rejected") {
    return (
      <View style={[s.banner, { backgroundColor: C.dangerLight }]}>
        <Ionicons name="close-circle" size={24} color={C.danger} />
        <View style={s.bannerText}>
          <Text style={[s.bannerTitle, { color: C.danger, fontSize: 16 * fontScale }]}>
            {status === "rejected" ? t("idrRejected") : t("idrCancelled")}
          </Text>
          <Text style={[s.bannerBody, { fontSize: 14 * fontScale }]}>
            {request.cancelReason
              ? t("idrReason", { reason: request.cancelReason })
              : t("idrContact")}
          </Text>
        </View>
      </View>
    );
  }

  const current = STEP_INDEX[status] ?? 0;
  const isReady = current === 2;
  const pickup = request.pickup?.date && request.pickup?.time ? request.pickup : null;
  const canChange = (request.pickupChanges || 0) < MAX_SENIOR_CHANGES || request.pickup?.bookedBy === "osca";
  // What the read-aloud button says: where the request is now, then the pickup.
  const currentKey = STEPS[Math.min(current, STEPS.length - 1)].key;
  const spokenHint = status === "approved" ? t("idrApproved") : t("idrHint_" + currentKey);
  const spokenText = [
    t("idrStep_" + currentKey) + ".",
    status === "done" ? "" : spokenHint,
    pickup && status !== "done" ? t("pkGoTo", { place: office.location, when: formatPickup(pickup) }) : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View>
      {STEPS.map((step, i) => {
        const complete = i < current || status === "done";
        const active = i === current && status !== "done";
        const stamp = complete || active ? formatStamp(request[step.stamp]) : "";
        const isLast = i === STEPS.length - 1;
        const hint =
          active && status === "approved" ? t("idrApproved") : t("idrHint_" + step.key);

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
                {t("idrStep_" + step.key)}
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

      {status !== "done" && (
        <View style={[s.pickupCard, isReady && { backgroundColor: C.successLight, borderColor: C.success }]}>
          <View style={s.pickupHead}>
            <Ionicons name="calendar" size={22} color={isReady ? C.success : C.primary} />
            <Text style={[s.pickupTitle, { fontSize: 16 * fontScale }]}>{t("pkYourPickup")}</Text>
          </View>

          {pickup ? (
            <>
              <Text style={[s.pickupWhen, { fontSize: 17 * fontScale }]}>{formatPickup(pickup)}</Text>
              <Text style={[s.pickupBody, { fontSize: 14 * fontScale }]}>
                {t("pkGoTo", { place: office.location, when: formatPickup(pickup) })}
              </Text>
              {pickup.bookedBy === "osca" && (
                <Text style={[s.pickupBody, { fontSize: 14 * fontScale, fontWeight: "700" }]}>{t("pkSetByOsca")}</Text>
              )}
            </>
          ) : (
            <Text style={[s.pickupBody, { fontSize: 15 * fontScale }]}>
              {isReady ? t("idrReadyNoTime") : t("pkNotSet")}
            </Text>
          )}

          {!!onEditPickup && (pickup ? canChange : true) && (
            <TouchableOpacity style={s.pickupBtn} onPress={onEditPickup} activeOpacity={0.85}>
              <Ionicons name={pickup ? "create-outline" : "calendar-outline"} size={20} color="#fff" />
              <Text style={[s.pickupBtnText, { fontSize: 16 * fontScale }]}>
                {pickup ? t("pkChange") : t("pkChoose")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <SpeakButton text={spokenText} style={{ marginTop: 12 }} />
    </View>
  );
}

const makeS = (C: Colors) => StyleSheet.create({
  pickupCard: {
    marginTop: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.primaryLight,
  },
  pickupHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  pickupTitle: { fontWeight: "800", color: C.text },
  pickupWhen: { fontWeight: "800", color: C.primary, lineHeight: 24 },
  pickupBody: { color: C.textSub, lineHeight: 21, marginTop: 4 },
  pickupBtn: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: C.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pickupBtnText: { color: "#fff", fontWeight: "800" },
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
