import { useAuth } from "@/context/AuthContext";
import { Guardian, updateMyUserFields } from "@/lib/firebase";
import { disableSafetyMonitoring, enableSafetyMonitoring } from "@/lib/presence";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
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
// 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX
const isPhMobile = (v: string) => /^(09|\+?639)\d{9}$/.test(v.replace(/[\s-]/g, ""));

export default function SafetyMonitoringCard({ fontScale = 1 }: { fontScale?: number }) {
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");

  const uid = user?.uid;
  const on = !!user?.safety_monitoring_opt_in;
  const guardians: Guardian[] = user?.guardians ?? [];
  if (!uid) return null;

  const turnOn = () => {
    Alert.alert(
      "Turn on Safety Monitoring?",
      "SCIA will record your phone's location in the background, even when the app is closed. " +
        "If your phone shows no activity for 60 minutes and you don't answer an \"Are you safe?\" " +
        "message at the 50-minute mark, we send a text with your last known location to your " +
        "guardians and to your barangay office.\n\nYou can turn this off any time.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "I agree",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await enableSafetyMonitoring(uid);
              if (!res.ok) {
                Alert.alert(
                  res.reason === "background" ? "Allow location \"all the time\"" : "Location needed",
                  res.reason === "background"
                    ? "Safety Monitoring needs location access all the time so it works when the app is closed. Open Settings > Location and choose \"Allow all the time\"."
                    : "Please allow location access to use Safety Monitoring.",
                  [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }],
                );
              } else {
                await refreshUser();
                if (!res.notifications) {
                  Alert.alert(
                    "Notifications are off",
                    "Without notifications we can't ask \"Are you safe?\" before alerting your guardians. Turn them on in Settings.",
                  );
                }
              }
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not turn on Safety Monitoring.");
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
      Alert.alert("Error", e?.message || "Could not turn off Safety Monitoring.");
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
      Alert.alert("Missing information", "Please enter the guardian's name and mobile number.");
      return;
    }
    if (!isPhMobile(phone)) {
      Alert.alert("Check the number", "Enter a Philippine mobile number like 09171234567.");
      return;
    }
    setBusy(true);
    try {
      await saveGuardians([
        ...guardians,
        { name: name.trim(), phone: phone.replace(/[\s-]/g, ""), relationship: relationship.trim() || undefined },
      ]);
      setEditing(false);
      setName(""); setPhone(""); setRelationship("");
    } catch {
      Alert.alert("Error", "Could not save. Please check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const removeGuardian = (index: number) =>
    Alert.alert("Remove guardian?", guardians[index]?.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => saveGuardians(guardians.filter((_, i) => i !== index)).catch(() =>
          Alert.alert("Error", "Could not save. Please check your connection.")),
      },
    ]);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Ionicons name="shield-checkmark" size={26} color="#2356E1" />
        <Text style={[s.title, { fontSize: 18 * fontScale }]}>Safety Monitoring</Text>
        {busy ? (
          <ActivityIndicator color="#2356E1" />
        ) : (
          <Switch value={on} onValueChange={(v) => (v ? turnOn() : turnOff())} />
        )}
      </View>
      <Text style={[s.body, { fontSize: 14 * fontScale }]}>
        {on
          ? "On. If we can't reach your phone for 60 minutes, your guardians and barangay office get a text with your last location. We ask \"Are you safe?\" first, at 50 minutes."
          : "Turn on to let your guardians and barangay office be alerted if your phone shows no activity for an hour."}
      </Text>

      <Text style={[s.sub, { fontSize: 15 * fontScale }]}>Guardians ({guardians.length}/{MAX_GUARDIANS})</Text>
      {guardians.length === 0 && (
        <Text style={[s.hint, { fontSize: 14 * fontScale }]}>
          No guardian added yet. Only your barangay office would be texted.
        </Text>
      )}
      {guardians.map((g, i) => (
        <View key={`${g.phone}-${i}`} style={s.guardianRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.gName, { fontSize: 16 * fontScale }]}>{g.name}</Text>
            <Text style={[s.hint, { fontSize: 14 * fontScale }]}>
              {g.phone}{g.relationship ? ` · ${g.relationship}` : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={() => removeGuardian(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={22} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ))}
      {guardians.length < MAX_GUARDIANS && (
        <TouchableOpacity style={s.addBtn} onPress={() => setEditing(true)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={20} color="#2356E1" />
          <Text style={[s.addText, { fontSize: 15 * fontScale }]}>Add guardian</Text>
        </TouchableOpacity>
      )}

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.overlay}>
          <View style={s.modal}>
            <Text style={[s.title, { fontSize: 20 * fontScale, marginBottom: 12 }]}>Add guardian</Text>
            <TextInput style={s.input} placeholder="Full name" value={name} onChangeText={setName} />
            <TextInput
              style={s.input}
              placeholder="Mobile number (09XXXXXXXXX)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <TextInput
              style={s.input}
              placeholder="Relationship (optional)"
              value={relationship}
              onChangeText={setRelationship}
            />
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setEditing(false)}>
                <Text style={s.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={addGuardian} disabled={busy}>
                <Text style={s.btnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontWeight: "800", color: "#111827" },
  body: { color: "#4B5563", lineHeight: 20, marginTop: 8 },
  sub: { fontWeight: "700", color: "#111827", marginTop: 14, marginBottom: 6 },
  hint: { color: "#6B7280" },
  guardianRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F6FF", borderRadius: 12, padding: 12, marginTop: 8 },
  gName: { fontWeight: "700", color: "#111827" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  addText: { color: "#2356E1", fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  input: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 10 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnGhost: { backgroundColor: "#F3F4F6" },
  btnGhostText: { fontWeight: "700", color: "#374151" },
  btnPrimary: { backgroundColor: "#2356E1" },
  btnPrimaryText: { fontWeight: "800", color: "#fff" },
});
