import { useSettings } from "@/context/SettingsContext";
import { useLiveVoice } from "@/hooks/useLiveVoice";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Voice() {
  const router = useRouter();
  const { t } = useSettings();

  const {
    status,
    isConnected,
    inputTranscript,
    outputTranscript,
    interrupted,
    lastError,
    diagnostic,
    isRecording,
    connect,
    disconnect,
    toggleMic,
  } = useLiveVoice();

  const isBusy = status === "connecting";
  const isListening =
    status === "connected" || status === "responding" || isRecording;

  const liveStatusLabel = isRecording
    ? t("liveRecording")
    : status === "connecting"
      ? t("connectingStatus")
      : status === "connected"
        ? t("connectedStatus")
        : status === "responding"
          ? t("respondingStatus")
          : status === "error"
            ? t("connectionErrorStatus")
            : t("notConnectedStatus");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="close" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("voiceAssistant")}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.container}>
        {/* AI RESPONSE AREA */}
        <View style={styles.responseContainer}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={40}
            color="#2356E1"
          />
          <Text style={styles.aiGreeting}>
            {isListening ? t("liveSessionActive") : t("howCanIHelp")}
          </Text>
          <Text style={styles.statusText}>{liveStatusLabel}</Text>

          <View style={styles.connectionButtonsRow}>
            <TouchableOpacity
              style={[
                styles.connectionButton,
                isConnected
                  ? styles.connectionButtonConnected
                  : styles.connectionButtonDisconnected,
              ]}
              onPress={isConnected ? disconnect : connect}
            >
              <Text style={styles.connectionButtonText}>
                {isConnected ? t("disconnect") : t("connect")}
              </Text>
            </TouchableOpacity>
          </View>

          {interrupted && (
            <Text style={styles.interruptedText}>
              Response interrupted by new activity.
            </Text>
          )}
          {!!lastError && <Text style={styles.errorText}>{lastError}</Text>}
          {!!diagnostic && <Text style={styles.debugText}>{diagnostic}</Text>}
        </View>

        {/* TRANSCRIPT CARD */}
        <View style={styles.transcriptCard}>
          <Text style={[styles.transcriptLabel, styles.transcriptLabelUser]}>
            {t("inputTranscriptLabel")}
          </Text>
          <Text
            style={[styles.transcriptText, isListening && styles.activeText]}
          >
            {inputTranscript || t("connectAndSpeak")}
          </Text>

          <Text style={[styles.transcriptLabel, styles.transcriptLabelModel]}>
            {t("modelTranscriptLabel")}
          </Text>
          <Text style={[styles.transcriptText, styles.modelTranscriptText]}>
            {outputTranscript || t("geminiResponses")}
          </Text>
        </View>

        {/* MICROPHONE BUTTON */}
        <View style={styles.micContainer}>
          {isListening && <View style={styles.rippleEffect} />}
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={toggleMic}
            activeOpacity={0.8}
          >
            {isBusy ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <MaterialCommunityIcons
                name={
                  isRecording
                    ? "stop-circle-outline"
                    : isConnected
                      ? "microphone"
                      : "microphone-plus"
                }
                size={48}
                color="#fff"
              />
            )}
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
  statusText: {
    marginTop: 8,
    fontSize: 14,
    color: "#4B5563",
  },
  connectionButtonsRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  connectionButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  connectionButtonConnected: {
    backgroundColor: "#DC2626",
  },
  connectionButtonDisconnected: {
    backgroundColor: "#2563EB",
  },
  connectionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  interruptedText: {
    marginTop: 6,
    fontSize: 13,
    color: "#B45309",
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    color: "#B91C1C",
    textAlign: "center",
  },
  debugText: {
    marginTop: 6,
    fontSize: 12,
    color: "#374151",
    textAlign: "center",
    paddingHorizontal: 12,
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
    minHeight: 170,
    justifyContent: "flex-start",
  },
  transcriptLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  transcriptLabelUser: {
    color: "#1D4ED8",
  },
  transcriptLabelModel: {
    color: "#047857",
    marginTop: 12,
  },
  transcriptText: {
    fontSize: 16,
    color: "#6B7280",
    lineHeight: 24,
  },
  modelTranscriptText: {
    color: "#111827",
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
    backgroundColor: "#CE2029",
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
