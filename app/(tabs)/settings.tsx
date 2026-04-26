import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "../../context/SettingsContext";

const fontOptions = [
  { labelKey: "small", value: 0.75 },
  { labelKey: "medium", value: 1 },
  { labelKey: "large", value: 1.25 },
];

const languageOptions = [
  { labelKey: "english", value: "en" },
  { labelKey: "tagalog", value: "tl" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { fontScale, language, setFontScale, setLanguage, t } = useSettings();

  const handleSaveChanges = () => {
    // All changes are automatically persisted via AsyncStorage
    // Just navigate back to account page
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { fontSize: 28 * fontScale }]}>{t("accountSettings")}</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 20 * fontScale }]}>{t("fontSize")}</Text>
          <Text style={[styles.sectionDescription, { fontSize: 14 * fontScale }]}>
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
                  <Text style={[styles.optionLabel, selected && styles.selectedOptionLabel, { fontSize: 16 * fontScale }]}>
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 20 * fontScale }]}>{t("language")}</Text>
          <Text style={[styles.sectionDescription, { fontSize: 14 * fontScale }]}>
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
                  <Text style={[styles.optionLabel, selected && styles.selectedOptionLabel, { fontSize: 16 * fontScale }]}>
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.previewBox}>
          <Text style={[styles.previewText, { fontSize: 16 * fontScale }]}>{t("exampleTextPreview")}</Text>
          <Text style={[styles.previewText, { fontSize: 18 * fontScale, fontWeight: "bold" }]}>{t("preview")}</Text>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
          <Text style={[styles.saveButtonText, { fontSize: 16 * fontScale }]}>{t("saveChanges")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F9",
  },
  container: {
    padding: 20,
    paddingBottom: 70,
  },
  title: {
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 24,
  },
  section: {
    backgroundColor: "#fff",
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
    color: "#111827",
    marginBottom: 8,
  },
  sectionDescription: {
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  optionCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedOption: {
    backgroundColor: "#2356E1",
  },
  optionLabel: {
    color: "#1F2937",
    fontWeight: "600",
  },
  selectedOptionLabel: {
    color: "#fff",
  },
  previewBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  previewText: {
    color: "#111827",
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#2356E1",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
    marginBottom: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
