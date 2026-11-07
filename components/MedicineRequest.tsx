import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
  Switch, TextInput, TouchableOpacity, View,
} from "react-native";
import { Text } from "@/components/ReadAloudText";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import { Palette } from "@/constants/theme";
import {
  cancelMedicineRequest, submitMedicineRequest, subscribeToMyMedicineRequests,
} from "@/lib/firebase";

const STATUS_KEY: Record<string, string> = {
  pending: "mrStPending", approved: "mrStApproved", rejected: "mrStRejected",
  released: "mrStReleased", cancelled: "mrStCancelled",
};

export default function MedicineRequest() {
  const { colors: c, fontScale, t } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { user } = useAuth();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [hasRx, setHasRx] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const seen = useRef<Record<string, string>>({});
  const firstLoad = useRef(true);

  useEffect(() => {
    return subscribeToMyMedicineRequests(
      (list) => {
        // Local notification when the barangay office decides on a request.
        if (!firstLoad.current) {
          list.forEach((r) => {
            const prev = seen.current[r.id];
            if (prev && prev !== r.status && ["approved", "rejected", "released"].includes(r.status)) {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: t("mrNotifTitle"),
                  body: t("mrNotifBody", { medicine: r.medicineName, status: t(STATUS_KEY[r.status]) }),
                },
                trigger: null,
              }).catch(() => {});
            }
          });
        }
        list.forEach((r) => { seen.current[r.id] = r.status; });
        firstLoad.current = false;
        setRequests(list);
        setLoading(false);
        setLoadError(false);
      },
      () => { setLoading(false); setLoadError(true); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = (status: string) => {
    switch (status) {
      case "approved": return { bg: c.successSoft, fg: c.success };
      case "rejected": return { bg: c.dangerSoft, fg: c.danger };
      case "released": return { bg: c.surfaceSoft, fg: c.primary };
      case "cancelled": return { bg: c.surfaceAlt, fg: c.textMuted };
      default: return { bg: c.warningSoft, fg: c.warningText };
    }
  };

  const resetForm = () => { setName(""); setQty(""); setReason(""); setHasRx(false); setError(""); };

  const openForm = () => {
    if (!user) { Alert.alert(t("mrLoginNeeded")); return; }
    setOpen(true);
  };

  const submit = async () => {
    const q = parseInt(qty, 10);
    if (!name.trim()) return setError(t("mrErrName"));
    if (isNaN(q) || q < 1 || q > 999) return setError(t("mrErrQty"));
    if (!reason.trim()) return setError(t("mrErrReason"));
    setSaving(true);
    setError("");
    try {
      const seniorName = (await AsyncStorage.getItem("userName")) || "Senior";
      const seniorId = (await AsyncStorage.getItem("userId")) || "N/A";
      await submitMedicineRequest({
        seniorName, seniorId, medicineName: name.trim(),
        quantity: q, reason: reason.trim(), hasPrescription: hasRx,
      });
      setOpen(false);
      resetForm();
      Alert.alert(t("mrSubmittedTitle"), t("mrSubmittedBody"));
    } catch {
      setError(t("mrErrSubmit"));
    } finally {
      setSaving(false);
    }
  };

  const cancel = (id: string) =>
    Alert.alert(t("mrCancelReq"), t("mrCancelConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("mrCancelReq"), style: "destructive", onPress: () => cancelMedicineRequest(id).catch(() => {}) },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.primaryBtn} onPress={openForm}>
          <MaterialCommunityIcons name="plus" size={22} color={c.onColor} />
          <Text style={[styles.primaryBtnText, { fontSize: 17 * fontScale }]}>{t("mrRequestBtn")}</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 30 }} />
        ) : loadError ? (
          <Text style={[styles.empty, { fontSize: 16 * fontScale }]}>{t("mrLoadFail")}</Text>
        ) : requests.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="pill" size={60} color={c.border} />
            <Text style={[styles.empty, { fontSize: 18 * fontScale }]}>{t("mrEmpty")}</Text>
            <Text style={[styles.emptySub, { fontSize: 15 * fontScale }]}>{t("mrEmptySub")}</Text>
          </View>
        ) : (
          requests.map((r) => {
            const b = badge(r.status);
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, { fontSize: 19 * fontScale }]}>{r.medicineName}</Text>
                  <View style={[styles.badge, { backgroundColor: b.bg }]}>
                    <Text style={[styles.badgeText, { color: b.fg, fontSize: 13 * fontScale }]}>
                      {t(STATUS_KEY[r.status] ?? "mrStPending")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardSub, { fontSize: 15 * fontScale }]}>{t("mrQtyLabel", { n: r.quantity })}</Text>
                <Text style={[styles.cardSub, { fontSize: 14 * fontScale }]}>{r.reason}</Text>
                {!!r.adminRemarks && (
                  <Text style={[styles.remarks, { fontSize: 14 * fontScale }]}>
                    {t("mrOfficeNote")}: {r.adminRemarks}
                  </Text>
                )}
                {r.status === "approved" && r.hasPrescription && (
                  <Text style={[styles.cardSub, { fontSize: 14 * fontScale }]}>{t("mrRxNote")}</Text>
                )}
                {r.status === "pending" && (
                  <TouchableOpacity onPress={() => cancel(r.id)} style={{ marginTop: 8 }}>
                    <Text style={{ color: c.danger, fontWeight: "600", fontSize: 15 * fontScale }}>
                      {t("mrCancelReq")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={[styles.sheetTitle, { fontSize: 21 * fontScale }]}>{t("mrFormTitle")}</Text>

            <Text style={[styles.label, { fontSize: 15 * fontScale }]}>{t("mrName")}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder={t("mrNamePh")} placeholderTextColor={c.textMuted} />

            <Text style={[styles.label, { fontSize: 15 * fontScale }]}>{t("mrQty")}</Text>
            <TextInput style={styles.input} value={qty} onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad" maxLength={3} placeholder="10" placeholderTextColor={c.textMuted} />

            <Text style={[styles.label, { fontSize: 15 * fontScale }]}>{t("mrReason")}</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} value={reason}
              onChangeText={setReason} multiline placeholder={t("mrReasonPh")} placeholderTextColor={c.textMuted} />

            <View style={styles.switchRow}>
              <Text style={[styles.label, { flex: 1, marginTop: 0, fontSize: 15 * fontScale }]}>{t("mrHasRx")}</Text>
              <Switch value={hasRx} onValueChange={setHasRx} />
            </View>

            {!!error && <Text style={{ color: c.danger, marginTop: 8, fontSize: 14 * fontScale }}>{error}</Text>}

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.secondaryBtn]} onPress={() => { setOpen(false); resetForm(); }}>
                <Text style={{ color: c.text, fontWeight: "600", fontSize: 16 * fontScale }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginBottom: 0 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color={c.onColor} /> : (
                  <Text style={[styles.primaryBtnText, { fontSize: 16 * fontScale }]}>{t("mrSubmit")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 120 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, marginBottom: 16,
  },
  primaryBtnText: { color: c.onColor, fontWeight: "700" },
  secondaryBtn: {
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, backgroundColor: c.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  emptyBox: { alignItems: "center", marginTop: 40, gap: 8 },
  empty: { color: c.text, fontWeight: "600", textAlign: "center", marginTop: 20 },
  emptySub: { color: c.textMuted, textAlign: "center" },
  card: {
    backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: c.cardBorder,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { color: c.text, fontWeight: "700", flex: 1 },
  cardSub: { color: c.textMuted, marginTop: 4 },
  remarks: { color: c.text, marginTop: 6, fontStyle: "italic" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetTitle: { color: c.text, fontWeight: "700", marginBottom: 8 },
  label: { color: c.text, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, color: c.text, backgroundColor: c.bg, fontSize: 16,
  },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 18 },
});
