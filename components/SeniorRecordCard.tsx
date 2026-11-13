// "My Record": the senior's OSCA Valenzuela registry status.
//   no record + PENDING  -> "Waiting for OSCA verification"
//   record active        -> record number + large QR (the admin Scan tab reads it)
//   record revoked       -> clear invalid notice
import { Text } from "@/components/ReadAloudText";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useSeniorRecord } from "@/hooks/useSeniorRecord";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

function fmtDate(ts: any): string {
  const ms = ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : 0;
  return ms ? new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
}

export default function SeniorRecordCard() {
  const { colors: c, t } = useSettings();
  const { user } = useAuth();
  const { record, loading, error } = useSeniorRecord();
  const s = useMemo(() => makeStyles(c), [c]);

  if (loading) {
    return (
      <View style={s.card}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.card}>
        <Text style={s.title}>{t("srTitle")}</Text>
        <Text style={s.body}>{t("srLoadError")}</Text>
      </View>
    );
  }

  // Not verified yet.
  if (!record) {
    const rejected = String(user?.status || "").toUpperCase() === "REJECTED";
    return (
      <View style={s.card}>
        <View style={s.row}>
          <Ionicons name={rejected ? "alert-circle" : "time-outline"} size={30} color={rejected ? c.danger : c.warning} />
          <Text style={s.title}>{rejected ? t("srRejectedTitle") : t("srPendingTitle")}</Text>
        </View>
        <Text style={s.body}>{rejected ? t("srRejectedBody") : t("srPendingBody")}</Text>
        {!rejected && <Text style={s.hint}>{t("srBringDocs")}</Text>}
      </View>
    );
  }

  const revoked = record.status === "revoked";
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Ionicons name={revoked ? "close-circle" : "shield-checkmark"} size={30} color={revoked ? c.danger : c.success} />
        <Text style={s.title}>{t("srTitle")}</Text>
      </View>

      {revoked ? (
        <Text style={[s.body, { color: c.danger }]}>{t("srRevoked")}</Text>
      ) : (
        <View style={s.qrWrap} accessible accessibilityLabel={`${t("srRecordNo")}: ${record.recordNo}`}>
          {/* White quiet zone is required for scanners, even in dark / high-contrast modes. */}
          <View style={s.qrBox}>
            <QRCode value={record.qrValue || record.recordNo} size={200} backgroundColor="#FFFFFF" color="#000000" />
          </View>
        </View>
      )}

      <Text style={s.label}>{t("srRecordNo")}</Text>
      <Text style={s.recordNo} selectable>{record.recordNo}</Text>

      <Text style={s.label}>{t("srName")}</Text>
      <Text style={s.value}>{record.fullName}</Text>
      {!!record.barangay && (
        <>
          <Text style={s.label}>{t("srBarangay")}</Text>
          <Text style={s.value}>{record.barangay}</Text>
        </>
      )}
      {!!fmtDate(record.issuedAt) && (
        <>
          <Text style={s.label}>{t("srIssued")}</Text>
          <Text style={s.value}>{fmtDate(record.issuedAt)}</Text>
        </>
      )}
      {!revoked && <Text style={s.hint}>{t("srShowQr")}</Text>}
    </View>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface, borderRadius: 16, padding: 20, marginBottom: 16,
      borderWidth: 1, borderColor: c.cardBorder,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    title: { fontSize: 22, fontWeight: "700", color: c.textStrong, flexShrink: 1 },
    body: { fontSize: 18, lineHeight: 26, color: c.text },
    hint: { fontSize: 16, lineHeight: 23, color: c.textSecondary, marginTop: 12 },
    qrWrap: { alignItems: "center", marginVertical: 14 },
    qrBox: { backgroundColor: "#FFFFFF", padding: 14, borderRadius: 12 },
    label: { fontSize: 15, color: c.textSecondary, marginTop: 10 },
    recordNo: { fontSize: 24, fontWeight: "800", color: c.primaryDark, letterSpacing: 0.5, fontVariant: ["tabular-nums"] },
    value: { fontSize: 19, fontWeight: "600", color: c.text },
  });
  