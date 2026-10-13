// components/ExplainPageButton.tsx
// "Explain this page": reads aloud a short, plain-language description of the screen the
// person is on (what it is for and what the buttons do), in the voice language they chose.
// Same idea as the admin website's button. The texts are written by hand per screen
// (constants/translations.ts, pageHelp_*), so it works offline and never says anything odd.
import { Text } from "@/components/ReadAloudText";
import { useSettings } from "@/context/SettingsContext";
import { pageHelpKey } from "@/lib/pageHelp";
import { speakNatural, stopNatural } from "@/lib/neuralVoice";
import { en, tl } from "@/constants/translations";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

export default function ExplainPageButton({ onStart }: { onStart?: () => void }) {
  const { t, fontScale, colors: c, readAloudLang } = useSettings();
  const pathname = usePathname();
  const [speaking, setSpeaking] = useState(false);

  const press = async () => {
    if (speaking) {
      stopNatural();
      setSpeaking(false);
      return;
    }
    onStart?.();
    // Spoken in the VOICE language (which can differ from the screen language).
    const key = pageHelpKey(pathname);
    const text = (readAloudLang === "tl" ? tl : en)[key] || t(key);
    setSpeaking(true);
    try {
      await speakNatural(text, readAloudLang);
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <TouchableOpacity
      style={[s.btn, { backgroundColor: c.surface, borderColor: c.primary }]}
      onPress={press}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={speaking ? t("a11yExplainStop") : t("a11yExplain")}
    >
      <Ionicons name={speaking ? "stop-circle" : "sparkles"} size={26} color={c.primary} />
      <Text style={[s.text, { color: c.primary, fontSize: 17 * fontScale }]}>
        {speaking ? t("a11yExplainStop") : t("a11yExplain")}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 56, borderRadius: 14, borderWidth: 2, paddingHorizontal: 16, marginTop: 8 },
  text: { fontWeight: "800", flexShrink: 1, textAlign: "center" },
});
