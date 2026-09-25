import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useDigitalId } from "@/hooks/useDigitalID";

interface Props {
  /** Optional. Defaults to the currently signed-in user. */
  uid?: string;
}

const DEFAULT_THEME = "#1E3A8A";
const DEFAULT_ACCENT = "#FACC15";

function formatDate(value: any): string {
  if (!value) return "—";
  const date: Date =
    typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export default function DigitalIDCard({ uid }: Props) {
  const { data, loading, error } = useDigitalId(uid);

  if (loading) {
    return (
      <View style={[styles.card, styles.center, { backgroundColor: DEFAULT_THEME }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.card, styles.center, { backgroundColor: "#E5E7EB" }]}>
        <Text style={styles.emptyTitle}>No digital ID yet</Text>
        <Text style={styles.emptySub}>
          {error ? "Couldn't load your ID." : "Your ID hasn't been issued by the admin."}
        </Text>
      </View>
    );
  }

  const theme = data.themeColor || DEFAULT_THEME;
  const accent = data.accentColor || DEFAULT_ACCENT;
  const status = data.status ?? "active";
  const statusColor =
    status === "active" ? "#22C55E" : status === "suspended" ? "#F59E0B" : "#EF4444";

  return (
    <View style={[styles.card, { backgroundColor: theme }]}>
      <View style={[styles.stripe, { backgroundColor: accent }]} />

      <View style={styles.header}>
        <Text style={styles.org}>{data.organization ?? "SCIA"}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {data.photoUrl ? (
          <Image source={{ uri: data.photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.initials}>{initials(data.fullName)}</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {data.fullName}
          </Text>
          {!!data.role && <Text style={[styles.role, { color: accent }]}>{data.role}</Text>}
          <Text style={styles.label}>ID NO.</Text>
          <Text style={styles.value}>{data.idNumber}</Text>
          <Text style={styles.label}>VALID UNTIL</Text>
          <Text style={styles.value}>{formatDate(data.validUntil)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    aspectRatio: 1.586, // standard ID card ratio
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  center: { alignItems: "center", justifyContent: "center" },
  stripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 6 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  org: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  body: { flex: 1, flexDirection: "row", gap: 14 },
  photo: { width: 90, height: 110, borderRadius: 10, backgroundColor: "#fff" },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  initials: { fontSize: 28, fontWeight: "700", color: "#6B7280" },
  info: { flex: 1, justifyContent: "center" },
  name: { color: "#fff", fontSize: 18, fontWeight: "700" },
  role: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  label: { color: "rgba(255,255,255,0.65)", fontSize: 9, letterSpacing: 1, marginTop: 4 },
  value: { color: "#fff", fontSize: 13, fontWeight: "600" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  emptySub: { fontSize: 12, color: "#6B7280", marginTop: 4, textAlign: "center" },
});
