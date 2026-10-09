import SpeakButton from "@/components/SpeakButton";
import { useSettings } from "@/context/SettingsContext";
import { PRIVACY, TERMS } from "@/constants/privacyText";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import ReadAloudRoot from "@/components/ReadAloudRoot";
import { Text } from "@/components/ReadAloudText";

type Props = { checked: boolean; onChange: (v: boolean) => void; showError?: boolean };

/** Required box: "I have read and agree to the Terms and Conditions and the Data Privacy Policy". */
export default function PrivacyConsent({ checked, onChange, showError }: Props) {
  const { t, language, fontScale, colors: c } = useSettings();
  const [doc, setDoc] = useState<"terms" | "privacy" | null>(null);
  const lang = language === "tl" ? "tl" : "en";
  const sections = doc === "terms" ? TERMS[lang] : PRIVACY[lang];
  const spoken = sections.map(([h, b]) => `${h}. ${b}`).join(" ");

  return (
    <View style={[s.box, { borderColor: showError && !checked ? c.danger : c.border, backgroundColor: c.surface }]}>
      <TouchableOpacity
        style={s.row}
        onPress={() => onChange(!checked)}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${t("consentPrefix")} ${t("consentTerms")} ${t("consentAnd")} ${t("consentPrivacy")}`}
      >
        <Ionicons name={checked ? "checkbox" : "square-outline"} size={40} color={checked ? c.primary : c.textSecondary} />
        <Text style={[s.text, { fontSize: 17 * fontScale, color: c.text }]}>
          {t("consentPrefix")}{" "}
          <Text style={[s.link, { color: c.link }]} onPress={() => setDoc("terms")}>{t("consentTerms")}</Text>
          {" "}{t("consentAnd")}{" "}
          <Text style={[s.link, { color: c.link }]} onPress={() => setDoc("privacy")}>{t("consentPrivacy")}</Text>.
        </Text>
      </TouchableOpacity>
      {showError && !checked ? (
        <Text style={[s.err, { fontSize: 16 * fontScale, color: c.danger }]}>{t("consentNeededBody")}</Text>
      ) : null}

      <Modal visible={doc !== null} transparent animationType="slide" onRequestClose={() => setDoc(null)}>
<ReadAloudRoot>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <View style={s.header}>
              <Text style={[s.title, { fontSize: 22 * fontScale, color: c.textStrong }]}>
                {doc === "terms" ? t("consentTerms") : t("consentPrivacy")}
              </Text>
              <TouchableOpacity onPress={() => setDoc(null)} style={s.closeBtn} accessibilityLabel={t("close")}>
                <Ionicons name="close" size={30} color={c.textStrong} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator>
              <SpeakButton text={spoken} />
              {sections.map(([h, b]) => (
                <View key={h} style={{ marginTop: 16 }}>
                  <Text style={[s.h, { fontSize: 18 * fontScale, color: c.textStrong }]}>{h}</Text>
                  <Text style={[s.b, { fontSize: 17 * fontScale, color: c.text }]}>{b}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </ReadAloudRoot>
</Modal>
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 2, borderRadius: 14, padding: 14, marginTop: 16 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 56 },
  text: { flex: 1, lineHeight: 26 },
  link: { fontWeight: "800", textDecorationLine: "underline" },
  err: { marginTop: 8, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, maxHeight: "88%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { flex: 1, fontWeight: "800" },
  closeBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  h: { fontWeight: "800" },
  b: { lineHeight: 26, marginTop: 4 },
});
