// components/AccessibilityPanel.tsx
//
// The Accessibility sheet: the same options as the admin website's Accessibility panel,
// reachable from the floating button on every screen (see AccessibilityFab) and listed in Settings:
//   colour mode (high contrast, red / green / blue-blind friendly, grayscale),
//   read aloud on touch + voice language, "Explain this page", text size, app language.
import ExplainPageButton from "@/components/ExplainPageButton";
import { Text } from "@/components/ReadAloudText";
import { COLOUR_MODE_OPTIONS } from "@/constants/a11yModes";
import { useSettings } from "@/context/SettingsContext";
import { speakNatural, stopNatural } from "@/lib/neuralVoice";
import { READ_ALOUD_MESSAGES, type ReadAloudLang } from "@/lib/readAloud";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FONT_OPTIONS = [
  { labelKey: "medium", value: 1 },
  { labelKey: "large", value: 1.25 },
  { labelKey: "extraLarge", value: 1.5 },
] as const;

export default function AccessibilityPanel({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    t,
    fontScale,
    setFontScale,
    language,
    setLanguage,
    contrast,
    setContrast,
    readAloud,
    setReadAloud,
    readAloudLang,
    setReadAloudLang,
    colors: c,
  } = useSettings();

  const toggleReadAloud = (on: boolean) => {
    setReadAloud(on);
    if (on) speakNatural(READ_ALOUD_MESSAGES[readAloudLang].on, readAloudLang);
    else stopNatural();
  };
  const pickVoiceLang = (lang: ReadAloudLang) => {
    setReadAloudLang(lang);
    speakNatural(READ_ALOUD_MESSAGES[lang].test, lang);
  };

  const Choice = ({
    selected,
    onPress,
    label,
    hint,
  }: {
    selected: boolean;
    onPress: () => void;
    label: string;
    hint?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        s.choice,
        {
          borderColor: selected ? c.primary : c.border,
          backgroundColor: selected ? c.surfaceSoft : c.surface,
          borderWidth: selected ? 3 : 1.5,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[s.choiceLabel, { color: c.text, fontSize: 17 * fontScale }]}
        >
          {label}
        </Text>
        {!!hint && (
          <Text
            style={[
              s.choiceHint,
              { color: c.textSecondary, fontSize: 14 * fontScale },
            ]}
          >
            {hint}
          </Text>
        )}
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={26} color={c.primary} />
      )}
    </TouchableOpacity>
  );

  const Heading = ({ children }: { children: string }) => (
    <Text
      style={[s.heading, { color: c.textStrong, fontSize: 14 * fontScale }]}
    >
      {children.toUpperCase()}
    </Text>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View
          style={[
            s.header,
            { borderBottomColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[s.title, { color: c.text, fontSize: 24 * fontScale }]}>
            {t("a11yTitle")}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("a11yClose")}
            style={s.close}
            hitSlop={12}
          >
            <Ionicons name="close" size={30} color={c.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content}>
          <Heading>{t("a11yColorMode")}</Heading>
          <View style={{ gap: 8 }}>
            {COLOUR_MODE_OPTIONS.map((o) => (
              <Choice
                key={o.value}
                selected={contrast === o.value}
                onPress={() => setContrast(o.value)}
                label={t(o.labelKey)}
                hint={t(o.hintKey)}
              />
            ))}
          </View>
          <Text
            style={[
              s.note,
              { color: c.textSecondary, fontSize: 14 * fontScale },
            ]}
          >
            {t("a11yColorNote")}
          </Text>

          <Heading>{t("raTitle")}</Heading>
          <View
            style={[
              s.row,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Ionicons name="volume-high" size={26} color={c.text} />
            <Text
              style={[s.rowLabel, { color: c.text, fontSize: 17 * fontScale }]}
            >
              {t("raToggleLabel")}
            </Text>
            <Switch
              value={readAloud}
              onValueChange={toggleReadAloud}
              trackColor={{ false: c.border, true: c.primary }}
              accessibilityLabel={t("raToggleLabel")}
            />
          </View>
          <View style={s.pair}>
            {(["tl", "en"] as const).map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => pickVoiceLang(v)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: readAloudLang === v }}
                style={[
                  s.pairBtn,
                  {
                    borderColor: readAloudLang === v ? c.primary : c.border,
                    borderWidth: readAloudLang === v ? 3 : 1.5,
                    backgroundColor: c.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    s.choiceLabel,
                    { color: c.text, fontSize: 17 * fontScale },
                  ]}
                >
                  {t(v === "tl" ? "tagalog" : "english")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ExplainPageButton onStart={onClose} />

          <Heading>{t("fontSize")}</Heading>
          <View style={s.pair}>
            {FONT_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.value}
                onPress={() => setFontScale(o.value)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: fontScale === o.value }}
                style={[
                  s.pairBtn,
                  {
                    borderColor: fontScale === o.value ? c.primary : c.border,
                    borderWidth: fontScale === o.value ? 3 : 1.5,
                    backgroundColor: c.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    s.choiceLabel,
                    { color: c.text, fontSize: 15 * fontScale },
                  ]}
                >
                  {t(o.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Heading>{t("language")}</Heading>
          <View style={s.pair}>
            {(["tl", "en"] as const).map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => setLanguage(v)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: language === v }}
                style={[
                  s.pairBtn,
                  {
                    borderColor: language === v ? c.primary : c.border,
                    borderWidth: language === v ? 3 : 1.5,
                    backgroundColor: c.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    s.choiceLabel,
                    { color: c.text, fontSize: 17 * fontScale },
                  ]}
                >
                  {t(v === "tl" ? "tagalog" : "english")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontWeight: "800" },
  close: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 16, paddingBottom: 40 },
  heading: {
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 62,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  choiceLabel: { fontWeight: "700" },
  choiceHint: { marginTop: 2 },
  note: { marginTop: 10, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  rowLabel: { flex: 1, fontWeight: "700" },
  pair: { flexDirection: "row", gap: 8, marginTop: 8 },
  pairBtn: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
});
