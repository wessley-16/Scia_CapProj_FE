import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Voice() {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("Tap the microphone and start speaking...");

  const toggleListening = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setTranscript("Listening...");
      // Simulate stopping after a few seconds
      setTimeout(() => {
        setIsListening(false);
        setTranscript("I need to schedule an appointment with Dr. Reyes.");
      }, 3000);
    } else {
      setTranscript("Tap the microphone and start speaking...");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Assistant</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.container}>
        {/* AI RESPONSE AREA */}
        <View style={styles.responseContainer}>
          <MaterialCommunityIcons name="robot-outline" size={40} color="#2356E1" />
          <Text style={styles.aiGreeting}>
            {isListening ? "I'm listening..." : "How can I help you today?"}
          </Text>
        </View>

        {/* TRANSCRIPT CARD */}
        <View style={styles.transcriptCard}>
          <Text style={[styles.transcriptText, isListening && styles.activeText]}>
            {transcript}
          </Text>
        </View>

        {/* MICROPHONE BUTTON */}
        <View style={styles.micContainer}>
          {isListening && (
            <View style={styles.rippleEffect} />
          )}
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={toggleListening}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons 
              name={isListening ? "microphone" : "microphone-outline"} 
              size={48} 
              color="#fff" 
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F6F9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "space-between",
  },
  responseContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  aiGreeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 16,
    textAlign: "center",
  },
  transcriptCard: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 120,
    justifyContent: "center",
  },
  transcriptText: {
    fontSize: 18,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 26,
  },
  activeText: {
    color: "#111827",
    fontWeight: "500",
  },
  micContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    height: 120,
  },
  micButton: {
    backgroundColor: "#2563EB",
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 2,
  },
  micButtonActive: {
    backgroundColor: "#CE2029", // Red when recording
    shadowColor: "#CE2029",
  },
  rippleEffect: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(206, 32, 41, 0.2)",
    zIndex: 1,
  },
});