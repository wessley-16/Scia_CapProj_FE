import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ChatHeader({ fontScale }: { fontScale: number }) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
        <Ionicons name="arrow-back" size={24} color="#2b5ce6" />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <MaterialCommunityIcons
          name="robot-outline"
          size={24}
          color="#2b5ce6"
        />
        <Text style={[styles.title, { fontSize: 18 * fontScale }]}>HealthAI Assistant</Text>
      </View>

      <TouchableOpacity style={styles.iconButton}>
        <Ionicons name="settings-sharp" size={24} color="#6b7280" />
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
    borderBottomColor: "#f3f4f6",
  },
  iconButton: {
    padding: 4,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2b5ce6",
  },
});
