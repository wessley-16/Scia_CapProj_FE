// components/BackBar.tsx
//
// One big, always-visible "Bumalik" (Back) button for the sub-screens (Healthcare,
// Government sites, Emergency, Settings). Seniors should never have to guess how to
// leave a screen, and a tiny arrow icon is easy to miss. Apple's Assistive Access and
// GrandPad both keep a large, labeled way back on every screen.
//
// Goes back to the previous screen, or to Home if there is nothing to go back to.
import { useSettings } from "@/context/SettingsContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function BackBar({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  const { t, fontScale } = useSettings();

  const goBack = () => {
    if (onPress) return onPress();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home" as any);
  };

  return (
    <View style={s.wrap}>
      <TouchableOpacity
        style={s.btn}
        onPress={goBack}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t("backA11y")}
      >
        <Ionicons name="chevron-back" size={30} color="#1A56C4" />
        <Text style={[s.text, { fontSize: 20 * fontScale }]}>{t("backBtn")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, backgroundColor: "transparent" },
  btn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingLeft: 8,
    paddingRight: 20,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#1A56C4",
    backgroundColor: "#FFFFFF",
  },
  text: { color: "#1A56C4", fontWeight: "800", marginLeft: 2 },
});
