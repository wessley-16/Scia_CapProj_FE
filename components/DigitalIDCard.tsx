import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { buildUserQRPayload, DigitalId, subscribeToDigitalId } from "@/lib/firebase";
import { UserProfile } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";

const C = {
  primary: "#1A56C4",
  primaryLight: "#EBF2FF",
  success: "#059669",
  successLight: "#ECFDF5",
  warning: "#D97706",
  warningLight: "#FFFBEB",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
  card: "#FFFFFF",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
};

interface Props {
  user: UserProfile | null;
  fontScale: number;
}

const fmtDate = (ts?: { toDate?: () => Date } | null) => {
  try {
    return ts?.toDate?.()?.toLocaleDateString("en-PH") ?? null;
  } catch {
    return null;
  }
};

/**
 * Shows the senior's Digital ID — but ONLY once the admin has actually
 * released one for them.
 *
 * Source of truth: the `digital_ids/{uid}` Firestore doc, written by the
 * admin app (SCIA_Admin_Firebase → src/pages/DigitalID.jsx) only after
 * OSCA approves that senior's ID Verification and an admin clicks
 * "Release Digital ID". No doc = the admin hasn't confirmed a physical
 * card yet. A doc with status "invalidated"/"suspended" = the admin has
 * revoked it. Anything else (active/released/valid) = good to show.
 *
 * This mirrors the mobile app's own firestore.rules, which already let a
 * signed-in user read their own /digital_ids/{uid} doc.
 */
export default function DigitalIdCard({ user, fontScale }: Props) {
  const { t } = useSettings();
  const [digitalId, setDigitalId] = useState<DigitalId | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToDigitalId(user?.uid, (result) => {
      setDigitalId(result);
      setLoading(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  if (!user) return null;

  const isRevoked = digitalId?.status === "invalidated" || digitalId?.status === "suspended";
  const isActive = !!digitalId && !isRevoked;

  const displayName =
    digitalId?.fullName ||
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    "Senior Citizen";
  const controlNo = digitalId?.controlNumber || digitalId?.idNumber || user.idNumber || "—";
  const releasedDate = fmtDate(digitalId?.releasedAt);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="card-outline" size={22} color={C.primary} />
        <Text style={[s.title, { fontSize: 17 * fontScale }]}>{t("digitalId")}</Text>
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : isActive ? (
        <>
          <Text style={[s.description, { fontSize: 14 * fontScale }]}>
            {t("digitalIdDescription")}
          </Text>

          {digitalId?.idImageUrl ? (
            <Image source={{ uri: digitalId.idImageUrl }} style={s.idPhoto} />
          ) : null}

          <View style={s.qrWrapper}>
            <QRCode
              value={buildUserQRPayload({ uid: user.uid, idNumber: controlNo })}
              size={160}
              backgroundColor="#ffffff"
              color={C.text}
            />
          </View>

          <View style={[s.badge, s.badgeVerified]}>
            <Ionicons name="checkmark-circle" size={16} color={C.success} />
            <Text style={[s.badgeText, { color: C.success, fontSize: 13 * fontScale }]}>
              {t("digitalIdVerifiedBadge")}
            </Text>
          </View>

          <Text style={[s.idName, { fontSize: 15 * fontScale }]}>{displayName}</Text>
          <Text style={[s.idLabel, { fontSize: 14 * fontScale }]}>
            {t("digitalIdControlNo")} {controlNo}
          </Text>
          {releasedDate ? (
            <Text style={[s.idLabel, { fontSize: 12 * fontScale }]}>
              {t("digitalIdReleasedOn")} {releasedDate}
            </Text>
          ) : null}
        </>
      ) : isRevoked ? (
        <View style={s.revokedBox}>
          <Ionicons name="close-circle-outline" size={26} color={C.danger} />
          <Text style={[s.revokedTitle, { fontSize: 15 * fontScale }]}>
            {t("digitalIdRevokedTitle")}
          </Text>
          <Text style={[s.pendingMessage, { fontSize: 13 * fontScale }]}>
            {digitalId?.invalidatedReason || t("digitalIdRevokedMessage")}
          </Text>
        </View>
      ) : (
        <View style={s.pendingBox}>
          <Ionicons name="lock-closed-outline" size={26} color={C.warning} />
          <Text style={[s.pendingTitle, { fontSize: 15 * fontScale }]}>
            {t("digitalIdPendingTitle")}
          </Text>
          <Text style={[s.pendingMessage, { fontSize: 13 * fontScale }]}>
            {t("digitalIdPendingMessage")}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontWeight: "700",
    color: C.text,
  },
  description: {
    color: C.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  idPhoto: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignSelf: "center",
    marginBottom: 12,
    backgroundColor: C.primaryLight,
  },
  qrWrapper: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    alignSelf: "center",
    marginBottom: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  badgeVerified: { backgroundColor: C.successLight },
  badgeText: { fontWeight: "700" },
  idName: {
    textAlign: "center",
    color: C.text,
    fontWeight: "700",
    marginBottom: 2,
  },
  idLabel: {
    textAlign: "center",
    color: C.textMuted,
    fontWeight: "600",
  },
  pendingBox: {
    alignItems: "center",
    backgroundColor: C.warningLight,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  pendingTitle: {
    fontWeight: "700",
    color: C.warning,
    marginTop: 8,
    marginBottom: 6,
    textAlign: "center",
  },
  pendingMessage: {
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  revokedBox: {
    alignItems: "center",
    backgroundColor: C.dangerLight,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  revokedTitle: {
    fontWeight: "700",
    color: C.danger,
    marginTop: 8,
    marginBottom: 6,
    textAlign: "center",
  },
});
