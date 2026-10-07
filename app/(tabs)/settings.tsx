import BackBar from "@/components/BackBar";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import { logoutUser } from "@/lib/firebase";
import DigitalIDCard from "@/components/DigitalIDCard";



const fontOptions = [
  { labelKey: "medium", value: 1 },
  { labelKey: "large", value: 1.25 },
  { labelKey: "extraLarge", value: 1.5 },
];

const contrastOptions = [
  { labelKey: "contrastStandard", value: "standard" },
  { labelKey: "contrastHigh", value: "high" },
] as const;

const languageOptions = [
  { labelKey: "english", value: "en" },
  { labelKey: "tagalog", value: "tl" },
];

export default function SettingsScreen() {
  const { colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { fontScale, language, contrast, setFontScale, setLanguage, setContrast, t } = useSettings();
  const { user, clearUser, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 60; // 60 ≈ typical tab bar height, adjust if yours differs

  // Re-pull the profile whenever Settings gains focus so a status the admin
  // just flipped (isVerified) shows up here without needing a full re-login.
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser]),
  );

  const handleSaveChanges = () => {
    // Changes are already persisted via AsyncStorage as they're made.
    router.back();
  };

  const handleLogout = () => {
    Alert.alert(t("setLogoutTitle"), t("setLogoutBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("setLogoutTitle"),
        style: "destructive",
        onPress: async () => {
          try {
            await logoutUser();
            clearUser();
            router.replace("/");
          } catch (error) {
            console.log("Logout error:", error);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackBar />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: tabBarHeight + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { fontSize: 28 * fontScale }]}>{t("accountSettings")}</Text>

        {/* Digital ID — locked behind admin verification (physical Senior
            Citizen ID confirmed); DigitalIdCard handles both states. */}
        <DigitalIDCard uid={user?.uid} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 20 * fontScale }]}>{t("fontSize")}</Text>
          <Text style={[styles.sectionDescription, { fontSize: 15 * fontScale }]}>
            {t("adjustFontSize")}
          </Text>
          <View style={styles.optionsRow}>
            {fontOptions.map((option) => {
              const selected = fontScale === option.value;
              return (
                <TouchableOpacity
                  key={option.labelKey}
                  style={[
                    styles.optionCard,
                    selected && styles.selectedOption,
                  ]}
                  onPress={() => setFontScale(option.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.optionLabel, selected && styles.selectedOptionLabel, { fontSize: 17 * fontScale }]}>
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 20 * fontScale }]}>{t("contrast")}</Text>
          <Text style={[styles.sectionDescription, { fontSize: 15 * fontScale }]}>
            {t("contrastDescription")}
          </Text>
          <View style={styles.optionsRow}>
            {contrastOptions.map((option) => {
              const selected = contrast === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionCard,
                    selected && styles.selectedOption,
                  ]}
                  onPress={() => setContrast(option.value)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.optionLabel, selected && styles.selectedOptionLabel, { fontSize: 17 * fontScale }]}>
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 20 * fontScale }]}>{t("language")}</Text>
          <Text style={[styles.sectionDescription, { fontSize: 15 * fontScale }]}>
            {t("changeLanguage")}
          </Text>
          <View style={styles.optionsRow}>
            {languageOptions.map((option) => {
              const selected = language === option.value;
              return (
                <TouchableOpacity
                  key={option.labelKey}
                  style={[
                    styles.optionCard,
                    selected && styles.selectedOption,
                  ]}
                  onPress={() => setLanguage(option.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.optionLabel, selected && styles.selectedOptionLabel, { fontSize: 17 * fontScale }]}>
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.previewBox}>
          <Text style={[styles.previewText, { fontSize: 17 * fontScale }]}>{t("exampleTextPreview")}</Text>
          <Text style={[styles.previewText, { fontSize: 18 * fontScale, fontWeight: "bold" }]}>{t("preview")}</Text>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
          <Text style={[styles.saveButtonText, { fontSize: 17 * fontScale }]}>{t("saveChanges")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={[styles.logoutText, { fontSize: 17 * fontScale }]}>
            {t("logout")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.bg,
  },
  container: {
    padding: 20,
  },
  title: {
    fontWeight: "700",
    color: c.text,
    marginBottom: 24,
  },
  section: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.cardBorder,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontWeight: "700",
    color: c.text,
    marginBottom: 8,
  },
  sectionDescription: {
    color: c.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  optionCard: {
    backgroundColor: c.surfaceSoft,
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginRight: 10,
    marginBottom: 10,
    minHeight: 52,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedOption: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  optionLabel: {
    color: c.text,
    fontWeight: "600",
  },
  selectedOptionLabel: {
    color: c.onColor,
  },
  previewBox: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.cardBorder,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  previewText: {
    color: c.text,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: c.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: c.onColor,
    fontWeight: "700",
  },

  logoutButton: {
    backgroundColor: c.danger,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 40,
  },

  logoutText: {
    color: "white",
    fontWeight: "700",
  },
});
