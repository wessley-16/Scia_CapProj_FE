// components/PickupModal.tsx
//
// Bottom sheet where a senior picks or changes the City Hall pickup day + time
// for a request that already exists (used from the ID tracker).
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import ReadAloudRoot from "@/components/ReadAloudRoot";
import { Text } from "@/components/ReadAloudText";
import { useSettings } from "@/context/SettingsContext";
import PickupPicker, { OfficeStatusBanner } from "@/components/PickupPicker";
import { bookIdPickup, formatPickup, OfficeSettings, Pickup, PickupError } from "@/lib/pickup";

const C = { primary: "#1A56C4", text: "#111827", textSub: "#4B5563", border: "#D1D5DB", card: "#FFFFFF" };

export default function PickupModal({
  visible,
  onClose,
  requestId,
  current,
  office,
  fontScale = 1,
}: {
  visible: boolean;
  onClose: () => void;
  requestId: string;
  current?: Pickup | null;
  office: OfficeSettings;
  fontScale?: number;
}) {
  const { t } = useSettings();
  const [value, setValue] = useState<{ date: string; time: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Start from the senior's current slot each time the sheet opens.
  useEffect(() => {
    if (visible) setValue(current?.date && current?.time ? { date: current.date, time: current.time } : null);
  }, [visible, current?.date, current?.time]);

  const unchanged = !!value && value.date === current?.date && value.time === current?.time;

  const save = async () => {
    if (!value?.date || !value?.time) {
      Alert.alert(t("pkChoose"), t("pkPickFirst"));
      return;
    }
    setSaving(true);
    try {
      await bookIdPickup(requestId, value.date, value.time);
      onClose();
      Alert.alert(t("pkSavedTitle"), t("pkSavedBody", { when: formatPickup(value) }));
    } catch (e: any) {
      const key = e instanceof PickupError ? e.messageKey : "pkErrGeneric";
      Alert.alert(t("errorTitle"), t(key));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
<ReadAloudRoot>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[s.title, { fontSize: 22 * fontScale }]}>{t("pkChooseTitle")}</Text>
            <Text style={[s.sub, { fontSize: 15 * fontScale }]}>{t("pkChooseSub")}</Text>

            <OfficeStatusBanner office={office} fontScale={fontScale} />
            <PickupPicker office={office} value={value} onChange={setValue} ownSlot={current} fontScale={fontScale} />

            <TouchableOpacity
              style={[s.submitBtn, (saving || !value?.time || unchanged) && { opacity: 0.55 }]}
              onPress={save}
              disabled={saving || !value?.time || unchanged}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[s.submitText, { fontSize: 17 * fontScale }]}>{t("pkConfirm")}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={[s.cancelText, { fontSize: 16 * fontScale }]}>{t("cancel")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </ReadAloudRoot>
</Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  box: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 32,
    maxHeight: "92%",
  },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title: { fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 6 },
  sub: { color: C.textSub, textAlign: "center", marginBottom: 16, lineHeight: 22 },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  submitText: { color: "#fff", fontWeight: "800" },
  cancelBtn: { paddingVertical: 14, alignItems: "center" },
  cancelText: { color: C.textSub, fontWeight: "700" },
});
