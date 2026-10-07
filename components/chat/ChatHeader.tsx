import { useSettings } from "@/context/SettingsContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ChatHeader({
  fontScale,
  onHistoryPress,
}: {
  fontScale: number;
  onHistoryPress: () => void;
}) {
  const router = useRouter();
  const { t } = useSettings();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.iconButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={t("chatGoBack")}
      >
        <Ionicons name="arrow-back" size={26} color="#2b5ce6" />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <MaterialCommunityIcons
          name="robot-outline"
          size={26}
          color="#2b5ce6"
        />
        <Text style={[styles.title, { fontSize: 18 * fontScale }]}>{t("chatHeader")}</Text>
      </View>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={onHistoryPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={t("a11yChatHistory")}
      >
        <Ionicons name="time-outline" size={26} color="#4B5563" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  iconButton: {
    padding: 10,
    minWidth: 52,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontWeight: "700",
    color: "#2b5ce6",
  },
});
