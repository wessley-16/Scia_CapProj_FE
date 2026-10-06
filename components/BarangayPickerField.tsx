import { useSettings } from "@/context/SettingsContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Large-button replacement for the native dropdown (Picker).
// NN/g's research with seniors 65+ found that dropdowns and other small touch
// controls are harder to use as motor skills decline, so every barangay is a
// full-width row at least 60 points tall and the text follows the font-size setting.
// https://www.nngroup.com/reports/senior-citizens-on-the-web/
type Props = {
  value: string;
  options: readonly string[];
  disabled?: boolean;
  placeholder: string;
  title: string;
  hasError?: boolean;
  onSelect: (value: string) => void;
};

export default function BarangayPickerField({ value, options, disabled, placeholder, title, hasError, onSelect }: Props) {
  const { fontScale, t } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[s.field, disabled && s.fieldDisabled, hasError && s.fieldError]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Text style={[s.fieldText, { fontSize: 18 * fontScale }, !value && s.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={24} color="#374151" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={s.sheet}>
            <View style={s.header}>
              <Text style={[s.title, { fontSize: 22 * fontScale }]}>{title}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={s.closeBtn} accessibilityLabel={t("close")}>
                <Ionicons name="close" size={30} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator>
              {options.map((b) => {
                const selected = b === value;
                return (
                  <TouchableOpacity
                    key={b}
                    style={[s.row, selected && s.rowSelected]}
                    activeOpacity={0.7}
                    onPress={() => { onSelect(b); setOpen(false); }}
                  >
                    <Text style={[s.rowText, { fontSize: 19 * fontScale }, selected && s.rowTextSelected]}>{b}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={28} color="#1D4ED8" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  field: {
    minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderColor: "#9CA3AF", borderRadius: 12, paddingHorizontal: 16, backgroundColor: "#fff",
  },
  fieldDisabled: { backgroundColor: "#F3F4F6", opacity: 0.7 },
  fieldError: { borderColor: "#DC2626" },
  fieldText: { flex: 1, color: "#111827", fontWeight: "600", marginRight: 8 },
  placeholder: { color: "#4B5563", fontWeight: "400" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, maxHeight: "85%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { flex: 1, fontWeight: "800", color: "#111827", paddingRight: 8 },
  closeBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  row: {
    minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  rowSelected: { backgroundColor: "#EBF2FF", borderRadius: 12 },
  rowText: { color: "#111827", flex: 1 },
  rowTextSelected: { fontWeight: "800", color: "#1D4ED8" },
});
