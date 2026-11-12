import BackBar from "@/components/BackBar";
import { Text } from "@/components/ReadAloudText";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import {
  subscribeToMyMissingRequirements,
  submitSeniorDocuments,
  type MissingRequirementItem,
  type MissingRequirements,
} from "@/lib/firebase";
import { pickDocumentImage } from "@/lib/idImage";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// "Missing requirements": what OSCA / the barangay still needs from this senior, and how to
// give it (send a photo here, bring it in person, or either). Opened from the home bell.
const TEXT = {
  tl: {
    title: "Kulang na requirements",
    intro: "Ito ang kailangan pa ng OSCA para ma-verify ang iyong account.",
    note: "Paalala mula sa OSCA",
    app: "Ipadala sa app",
    person: "Dalhin nang personal sa OSCA office",
    either: "Ipadala sa app o dalhin nang personal",
    camera: "Kunan ng litrato",
    gallery: "Pumili sa gallery",
    sent: "Naipadala na. Susuriin ito ng OSCA.",
    ok: "Maraming salamat! Natanggap na ang iyong dokumento.",
    fail: "Hindi maipadala. Subukan ulit.",
    empty: "Wala nang kulang na requirements. Salamat!",
    errorTitle: "May problema",
    doc: { id: "Valid ID", birth_certificate: "Birth certificate", barangay_certificate: "Barangay certificate" } as Record<string, string>,
  },
  en: {
    title: "Missing requirements",
    intro: "This is what OSCA still needs to verify your account.",
    note: "Note from OSCA",
    app: "Send in the app",
    person: "Bring in person to the OSCA office",
    either: "Send in the app or bring in person",
    camera: "Take a photo",
    gallery: "Choose from gallery",
    sent: "Sent. OSCA will review it.",
    ok: "Thank you! Your document was received.",
    fail: "Could not send it. Please try again.",
    empty: "Nothing is missing anymore. Thank you!",
    errorTitle: "Something went wrong",
    doc: { id: "Valid ID", birth_certificate: "Birth certificate", barangay_certificate: "Barangay certificate" } as Record<string, string>,
  },
};

export default function MissingDocsScreen() {
  const { colors: c, language } = useSettings();
  const { user } = useAuth();
  const L = language === "en" ? TEXT.en : TEXT.tl;
  const s = useMemo(() => makeStyles(c), [c]);
  const [data, setData] = useState<MissingRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return undefined;
    }
    return subscribeToMyMissingRequirements(user.uid, (v) => {
      setData(v);
      setLoading(false);
    });
  }, [user?.uid]);

  const upload = async (item: MissingRequirementItem, source: "camera" | "library") => {
    if (item.kind === "other") return;
    setBusyKind(item.kind);
    try {
      const picked = await pickDocumentImage(source);
      if (!picked) return;
      await submitSeniorDocuments([{ kind: item.kind, imageBase64: picked.base64 }]);
      Alert.alert(L.title, L.ok);
    } catch (e: any) {
      Alert.alert(L.errorTitle, e?.message || L.fail);
    } finally {
      setBusyKind(null);
    }
  };

  const nameOf = (it: MissingRequirementItem) => (it.kind === "other" ? it.label || "" : L.doc[it.kind]);
  const howOf = (it: MissingRequirementItem) => (it.method === "app" ? L.app : it.method === "in_person" ? L.person : L.either);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      <BackBar />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.title}>{L.title}</Text>
        {loading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
        ) : !data || data.items.length === 0 ? (
          <Text style={s.body}>{L.empty}</Text>
        ) : (
          <>
            <Text style={s.body}>{L.intro}</Text>
            {data.note ? (
              <View style={s.noteBox}>
                <Text style={s.noteLabel}>{L.note}</Text>
                <Text style={s.body}>{data.note}</Text>
              </View>
            ) : null}
            {data.items.map((it, i) => {
              const canSend = it.kind !== "other" && it.method !== "in_person" && !it.submitted;
              const busy = busyKind === it.kind;
              return (
                <View key={`${it.kind}-${i}`} style={s.card}>
                  <Text style={s.cardTitle}>{nameOf(it)}</Text>
                  <Text style={s.how}>{it.submitted ? L.sent : howOf(it)}</Text>
                  {canSend && (
                    <View style={s.row}>
                      <TouchableOpacity style={[s.btn, busy && s.disabled]} disabled={busy} onPress={() => upload(it, "camera")} accessibilityRole="button">
                        <Text style={s.btnText}>{L.camera}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.btn, s.btnAlt, busy && s.disabled]} disabled={busy} onPress={() => upload(it, "library")} accessibilityRole="button">
                        <Text style={[s.btnText, s.btnAltText]}>{L.gallery}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {busy && <ActivityIndicator color={c.primary} style={{ marginTop: 10 }} />}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    title: { fontSize: 26, fontWeight: "800", color: c.text, marginBottom: 8 },
    body: { fontSize: 18, color: c.text, lineHeight: 26, marginBottom: 12 },
    noteBox: { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 14, padding: 14, marginBottom: 12 },
    noteLabel: { fontSize: 15, fontWeight: "800", color: c.textMuted, marginBottom: 4 },
    card: { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 12 },
    cardTitle: { fontSize: 20, fontWeight: "800", color: c.text },
    how: { fontSize: 17, color: c.textMuted, marginTop: 4 },
    row: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
    btn: { flex: 1, minHeight: 56, borderRadius: 14, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    btnAlt: { backgroundColor: c.surface, borderWidth: 2, borderColor: c.primary },
    btnText: { fontSize: 18, fontWeight: "800", color: c.onColor, textAlign: "center" },
    btnAltText: { color: c.primary },
    disabled: { opacity: 0.5 },
  });
  