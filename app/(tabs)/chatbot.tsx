import AiChat from "@/components/AiChat";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Chatbot() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <AiChat />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
