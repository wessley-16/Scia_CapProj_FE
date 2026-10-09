// app/(tabs)/help.tsx
//
// "Gabay" (Guide) screen: a big tap-to-call button for the OSCA office and a short,
// read-aloud guide for the five things seniors do most. One idea per card, big
// type, and everything can be read aloud.
import BackBar from "@/components/BackBar";
import SpeakButton from "@/components/SpeakButton";
import { Palette } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { useOffice } from "@/hooks/useOffice";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Alert, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "@/components/ReadAloudText";
import { SafeAreaView } from "react-native-safe-area-context";

const STEP_KEYS = ["helpS1", "helpS2", "helpS3", "helpS4", "helpS5"] as const;
const STEP_ICONS = ["alarm-light-outline", "medical-bag", "microphone-outline", "card-account-details-outline", "format-size"] as const;

export default function HelpScreen() {
  const { t, fontScale, colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const office = useOffice();

  const callOffice = () => {
    const digits = (office.phone || "").replace(/[^0-9+]/g, "");
    if (!digits) {
      Alert.alert(t("helpNoPhoneTitle"), t("helpNoPhoneBody"));
      return;
    }
    Linking.openURL(`tel:${digits}`).catch(() => Alert.alert(t("helpNoPhoneTitle"), t("helpNoPhoneBody")));
  };

  const allSteps = `${t("helpTitle")}. ${STEP_KEYS.map((k, i) => `${i + 1}. ${t(k)}`).join(" ")}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <BackBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { fontSize: 28 * fontScale }]}>{t("tileHelp")}</Text>

        <TouchableOpacity
          style={styles.callBtn}
          onPress={callOffice}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("helpCall")}
        >
          <Ionicons name="call" size={38} color={c.onColor} />
          <View style={styles.callText}>
            <Text style={[styles.callTitle, { fontSize: 24 * fontScale }]}>{t("helpCall")}</Text>
            <Text style={[styles.callSub, { fontSize: 16 * fontScale }]}>
              {office.phone ? office.phone : t("helpCallSub")}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.office, { fontSize: 16 * fontScale }]}>
          {t("helpOffice")}: {office.location}
        </Text>

        <Text style={[styles.sectionTitle, { fontSize: 24 * fontScale }]}>{t("helpTitle")}</Text>
        <SpeakButton text={allSteps} style={styles.speakAll} />

        {STEP_KEYS.map((key, i) => (
          <View key={key} style={styles.stepCard}>
            <View style={styles.stepIcon}>
              <Ionicons name={STEP_ICONS[i] as any} size={30} color={c.onColor} />
            </View>
            <Text style={[styles.stepText, { fontSize: 19 * fontScale }]}>{t(key)}</Text>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40 },
    title: { fontWeight: "800", color: c.text, marginBottom: 16 },
    callBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      minHeight: 96,
      borderRadius: 20,
      backgroundColor: c.primary,
      paddingHorizontal: 22,
      paddingVertical: 18,
    },
    callText: { flex: 1 },
    callTitle: { fontWeight: "800", color: c.onColor },
    callSub: { color: c.onColor, marginTop: 2 },
    office: { color: c.textSecondary, marginTop: 10, marginBottom: 24, lineHeight: 22 },
    sectionTitle: { fontWeight: "800", color: c.text, marginBottom: 12 },
    speakAll: { marginBottom: 16 },
    stepCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    stepIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepText: { flex: 1, color: c.text, lineHeight: 28, fontWeight: "600" },
  });
  