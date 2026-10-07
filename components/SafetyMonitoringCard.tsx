import { Palette } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { Guardian, updateMyUserFields } from "@/lib/firebase";
import { RULES, RuleKind, sanitize, validate } from "@/lib/validators";
import { disableSafetyMonitoring, enableSafetyMonitoring } from "@/lib/presence";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const MAX_GUARDIANS = 3;

// The texts a guardian can opt in to. Both are sent by Cloud Functions
// (functions/guardianAlerts.js and idRequestNotifications.js in the admin repo).
const NOTIFY_OPTIONS = [
  { flag: "idReady", labelKey: "smNotifyId" },
  { flag: "appointmentConfirmed", labelKey: "smNotifyAppt" },
] as const;

export default function SafetyMonitoringCard({ fontScale = 1 }: { fontScale?: number }) {
  const { colors: c } = useSettings();
  const s = useMemo(() => makeStyles(c), [c]);
  const { user, refreshUser } = useAuth();
  const { t } = useSettings();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  // Red message under the form: why a typed character was removed, or why Save was refused.
  const [formError, setFormError] = useState("");

  // Strips characters the field does not allow and says why (e.g. digits in a name).
  const typed = (kind: RuleKind, setter: (v: string) => void) => (raw: string) => {
    const { value, rejected } = sanitize(kind, raw);
    setter(value);
    setFormError(rejected ? RULES[kind].hint : "");
  };

  const uid = user?.uid;
  const on = !!user?.safety_monitoring_opt_in;
  const guardians: Guardian[] = user?.guardians ?? [];
  if (!uid) return null;

  const turnOn = () => {
    Alert.alert(
      t("smTurnOnTitle"),
      t("smTurnOnBody"),
      [
        { text: t("smNotNow"), style: "cancel" },
        {
          text: t("smAgree"),
          onPress: async () => {
            setBusy(true);
            try {
              const res = await enableSafetyMonitoring(uid);
              if (!res.ok) {
                Alert.alert(
                  res.reason === "background" ? t("smBgTitle") : t("smLocTitle"),
                  res.reason === "background" ? t("smBgBody") : t("smLocBody"),
                  [{ text: t("cancel"), style: "cancel" }, { text: t("emOpenSettings"), onPress: () => Linking.openSettings() }],
                );
              } else {
                await refreshUser();
                if (!res.notifications) {
                  Alert.alert(
                    t("smNotifOffTitle"),
                    t("smNotifOffBody"),
                  );
                }
              }
            } catch (e: any) {
              Alert.alert(t("errorTitle"), t("smOnFail"));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disableSafetyMonitoring(uid);
      await refreshUser();
    } catch (e: any) {
      Alert.alert(t("errorTitle"), t("smOffFail"));
    } finally {
      setBusy(false);
    }
  };

  const saveGuardians = async (next: Guardian[]) => {
    await updateMyUserFields(uid, { guardians: next });
    await refreshUser();
  };

  const addGuardian = async () => {
    if (!name.trim() || !phone.trim()) {
      setFormError(t("smNeedNamePhone"));
      return;
    }
    const err =
      validate("name", name) ||
      validate("phone", phone) ||
      validate("relation", relationship, { required: false });
    if (err) {
      setFormError(err);
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      await saveGuardians([
        ...guardians,
        { name: name.trim(), phone: phone.replace(/[\s-]/g, ""), relationship: relationship.trim() || undefined },
      ]);
      setEditing(false);
      setName(""); setPhone(""); setRelationship(""); setFormError("");
    } catch {
      Alert.alert(t("errorTitle"), t("smSaveFail"));
    } finally {
      setBusy(false);
    }
  };

  const setNotify = async (index: number, flag: "idReady" | "appointmentConfirmed", value: boolean) => {
    setBusy(true);
    try {
      await saveGuardians(
        guardians.map((g, i) => (i === index ? { ...g, notify: { ...g.notify, [flag]: value } } : g)),
      );
    } catch {
      Alert.alert(t("errorTitle"), t("smSaveFail"));
    } finally {
      setBusy(false);
    }
  };

  const removeGuardian = (index: number) =>
    Alert.alert(t("smRemoveTitle"), guardians[index]?.name, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("smRemove"),
        style: "destructive",
        onPress: () => saveGuardians(guardians.filter((_, i) => i !== index)).catch(() =>
          Alert.alert(t("errorTitle"), t("smSaveFail"))),
      },
    ]);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Ionicons name="shield-checkmark" size={26} color={c.primary} />
        <Text style={[s.title, { fontSize: 18 * fontScale }]}>{t("smTitle")}</Text>
        {busy ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <Switch value={on} onValueChange={(v) => (v ? turnOn() : turnOff())} />
        )}
      </View>
      <Text style={[s.body, { fontSize: 14 * fontScale }]}>
        {on
          ? t("smOnBody")
          : t("smOffBody")}
      </Text>

      <Text style={[s.sub, { fontSize: 15 * fontScale }]}>{t("smGuardians", { count: guardians.length, max: MAX_GUARDIANS })}</Text>
      {guardians.length === 0 && (
        <Text style={[s.hint, { fontSize: 14 * fontScale }]}>
          {t("smNoGuardian")}
        </Text>
      )}
      {guardians.map((g, i) => (
        <View key={`${g.phone}-${i}`} style={s.guardianCard}>
        <View style={s.guardianRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.gName, { fontSize: 16 * fontScale }]}>{g.name}</Text>
            <Text style={[s.hint, { fontSize: 14 * fontScale }]}>
              {g.phone}{g.relationship ? ` · ${g.relationship}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => removeGuardian(i)}
            style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel={t("smRemoveGuardian")}
          >
            <Ionicons name="trash-outline" size={26} color={c.danger} />
          </TouchableOpacity>
        </View>

        <Text style={[s.notifyTitle, { fontSize: 15 * fontScale }]}>{t("smNotifyTitle")}</Text>
        {NOTIFY_OPTIONS.map((opt) => (
          <View key={opt.flag} style={s.notifyRow}>
            <Text style={[s.notifyLabel, { fontSize: 16 * fontScale }]}>{t(opt.labelKey)}</Text>
            <Switch
              value={!!g.notify?.[opt.flag]}
              onValueChange={(v) => setNotify(i, opt.flag, v)}
              disabled={busy}
              trackColor={{ false: c.border, true: c.primary }}
              thumbColor={c.surface}
              accessibilityLabel={`${g.name}: ${t(opt.labelKey)}`}
              style={{ transform: [{ scale: 1.2 }] }}
            />
          </View>
        ))}
        </View>
      ))}
      {guardians.length < MAX_GUARDIANS && (
        <TouchableOpacity style={s.addBtn} onPress={() => setEditing(true)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={20} color={c.primary} />
          <Text style={[s.addText, { fontSize: 15 * fontScale }]}>{t("smAddGuardian")}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
          <View style={s.modal}>
            <Text style={[s.title, { fontSize: 20 * fontScale, marginBottom: 12 }]}>{t("smAddGuardian")}</Text>
            <TextInput style={[s.input, !!formError && s.inputError]} placeholder={t("smFullName")} value={name} onChangeText={typed("name", setName)} maxLength={RULES.name.max} />
            <TextInput
              style={s.input}
              placeholder={t("smMobilePh")}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={typed("phone", setPhone)}
              maxLength={RULES.phone.max}
            />
            <TextInput
              style={s.input}
              placeholder={t("smRelationPh")}
              value={relationship}
              onChangeText={typed("relation", setRelationship)}
              maxLength={RULES.relation.max}
            />
            {!!formError && <Text style={s.errorText}>{formError}</Text>}
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setEditing(false)}>
                <Text style={s.btnGhostText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={addGuardian} disabled={busy}>
                <Text style={s.btnPrimaryText}>{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontWeight: "800", color: c.text },
  body: { color: c.textSecondary, lineHeight: 20, marginTop: 8 },
  sub: { fontWeight: "700", color: c.text, marginTop: 14, marginBottom: 6 },
  hint: { color: c.textMuted },
  inputError: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  errorText: { color: c.danger, fontSize: 14, fontWeight: "600", marginBottom: 8 },
  guardianCard: { backgroundColor: c.surfaceSoft, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, padding: 12, marginTop: 8 },
  guardianRow: { flexDirection: "row", alignItems: "center" },
  notifyTitle: { fontWeight: "700", color: c.textStrong, marginTop: 6, marginBottom: 2 },
  notifyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 56 },
  notifyLabel: { flex: 1, color: c.text, fontWeight: "600" },
  gName: { fontWeight: "700", color: c.text },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  addText: { color: c.primary, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: c.surface, borderRadius: 16, padding: 20 },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 10 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnGhost: { backgroundColor: c.surfaceAlt },
  btnGhostText: { fontWeight: "700", color: c.textStrong },
  btnPrimary: { backgroundColor: c.primary },
  btnPrimaryText: { fontWeight: "800", color: c.onColor },
});
