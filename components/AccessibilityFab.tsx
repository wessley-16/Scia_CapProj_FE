// components/AccessibilityFab.tsx
// A round "Accessibility" button that floats on every screen (like the admin website's pill), so
// colour modes, read-aloud, text size and language are never more than one tap away.
// Hidden on the two AI screens, which have their own controls at the bottom.
import AccessibilityPanel from "@/components/AccessibilityPanel";
import { useSettings } from "@/context/SettingsContext";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HIDE_ON = ["voice", "chatbot"];

export default function AccessibilityFab() {
  const { t, colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const last = String(pathname || "").split("/").filter(Boolean).pop() || "";
  if (HIDE_ON.includes(last)) return null;

  return (
    <>
      <TouchableOpacity
        style={[s.fab, { backgroundColor: c.primary, borderColor: c.surface, bottom: insets.bottom + 92 }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("a11yOpen")}
      >
        <Ionicons name="eye" size={28} color={c.onColor} />
      </TouchableOpacity>
      <AccessibilityPanel visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  fab: { position: "absolute", right: 14, width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: "center", justifyContent: "center", elevation: 8, zIndex: 50 },
});
