/**
 * app/(tabs)/voice.tsx
 *
 * Voice Assistant Screen — Gemini Live via Firebase AI Logic (Vertex AI).
 *
 * Status matrix:
 *   idle       → not connected
 *   connecting → opening session
 *   connected  → session open, mic idle
 *   listening  → mic streaming to model (red pulse)
 *   responding → model speaking (purple ring)
 *   error      → something failed
 */

import { useLiveVoice } from "@/hooks/useLiveVoice";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Animated pulse rings shown while listening ───────────────────────────────
function PulseRings({ active }: { active: boolean }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      ring1.setValue(0);
      ring2.setValue(0);
      return;
    }
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ]),
      );
    const a1 = pulse(ring1, 0);
    const a2 = pulse(ring2, 500);
    a1.start();
    a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, [active, ring1, ring2]);

  if (!active) return null;

  return (
    <>
      {[ring1, ring2].map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.pulseRing,
            {
              opacity: anim.interpolate({
                inputRange:  [0, 0.3, 1],
                outputRange: [0, 0.4,  0],
              }),
              transform: [{
                scale: anim.interpolate({
                  inputRange:  [0,   1  ],
                  outputRange: [1,   2.2],
                }),
              }],
            },
          ]}
        />
      ))}
    </>
  );
}

// ─── Animated responding ring ─────────────────────────────────────────────────
function RespondingRing({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { pulse.setValue(0); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900,  useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900,  useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, pulse]);

  if (!active) return null;

  return (
    <Animated.View
      style={[
        styles.respondingRing,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
          transform: [{
            scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }),
          }],
        },
      ]}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function VoiceScreen() {
  const router = useRouter();

  const {
    status,
    isConnected,
    isRecording,
    inputTranscript,
    outputTranscript,
    interrupted,
    lastError,
    diagnostic,
    connect,
    disconnect,
    toggleMic,
    resetTranscripts,
  } = useLiveVoice();

  const isListening  = status === "listening";
  const isResponding = status === "responding";
  const isConnecting = status === "connecting";
  const hasError     = status === "error";

  // ── Labels ────────────────────────────────────────────────────────────────
  const statusLabel =
    isListening  ? "Listening…"        :
    isConnecting ? "Connecting…"       :
    isResponding ? "Responding…"       :
    isConnected  ? "Connected"         :
    hasError     ? "Connection error"  :
                   "Not connected";

  const greetingText =
    isListening  ? "I'm listening…"    :
    isResponding ? "Let me answer…"    :
    isConnected  ? "How can I help?"   :
                   "HealthAI Assistant";

  const micHintText =
    isConnecting ? "Opening session…"      :
    isListening  ? "Tap to stop mic"       :
    isResponding ? "Speaking…"             :
    isConnected  ? "Tap to speak"          :
                   "Tap to connect & speak";

  // ── Mic icon & colour ────────────────────────────────────────────────────
  const micIcon =
    isConnecting ? "timer-sand"          :
    isListening  ? "stop-circle-outline" :
    isConnected  ? "microphone"          :
                   "microphone-plus";

  const micColor =
    isListening  ? "#DC2626" :
    isResponding ? "#7C3AED" :
    isConnected  ? "#2563EB" :
                   "#6B7280";

  // ── Status dot colour ─────────────────────────────────────────────────────
  const dotColor =
    hasError ? "#DC2626" :
    isConnected
      ? (isListening  ? "#DC2626"
       : isResponding ? "#7C3AED"
       :                "#16A34A")
      : "#9CA3AF";

  const hasTranscripts = !!(inputTranscript || outputTranscript);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            disconnect(); // close session before navigating away
            router.back();
          }}
          style={styles.iconBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Voice Assistant</Text>

        {hasTranscripts ? (
          <TouchableOpacity
            onPress={resetTranscripts}
            style={styles.iconBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="refresh" size={22} color="#6B7280" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <View style={styles.body}>

        {/* ── AI avatar + status ───────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={[
            styles.avatarRing,
            isListening  && styles.avatarRingListening,
            isResponding && styles.avatarRingResponding,
          ]}>
            <MaterialCommunityIcons
              name="robot-outline"
              size={44}
              color={isConnected ? "#2356E1" : "#9CA3AF"}
            />
          </View>

          <Text style={styles.greeting}>{greetingText}</Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>

          {/* Connect / Disconnect button */}
          <View style={styles.ctrlRow}>
            <TouchableOpacity
              style={[
                styles.ctrlBtn,
                isConnected  ? styles.ctrlBtnRed  : styles.ctrlBtnBlue,
                isConnecting && styles.ctrlBtnGray,
              ]}
              onPress={isConnected ? disconnect : connect}
              disabled={isConnecting}
              activeOpacity={0.8}
            >
              <Text style={styles.ctrlBtnText}>
                {isConnected  ? "Disconnect" :
                 isConnecting ? "Connecting…" :
                                "Connect"}
              </Text>
            </TouchableOpacity>
          </View>

          {interrupted && (
            <Text style={styles.interruptedText}>↩ Response interrupted</Text>
          )}

          {/* Error message (shown in red) */}
          {!!lastError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color="#B91C1C" />
              <Text style={styles.errorText}>{lastError}</Text>
            </View>
          )}

          {/* Diagnostic hint (shown in gray, only when no error) */}
          {!!diagnostic && !lastError && (
            <Text style={styles.diagText}>{diagnostic}</Text>
          )}
        </View>

        {/* ── Transcript card ───────────────────────────────────────────── */}
        <ScrollView
          style={styles.transcriptCard}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.txLabel, styles.txLabelUser]}>
            YOU SAID
          </Text>
          <Text style={[styles.txText, isListening && styles.txTextActive]}>
            {inputTranscript || "Connect and start speaking…"}
          </Text>

          <View style={styles.txDivider} />

          <Text style={[styles.txLabel, styles.txLabelModel]}>
            HEALTHAI
          </Text>
          <Text style={[styles.txText, styles.txTextModel]}>
            {outputTranscript || "Response will appear here."}
          </Text>
        </ScrollView>

        {/* ── Mic button ───────────────────────────────────────────────── */}
        <View style={styles.micSection}>
          <PulseRings     active={isListening} />
          <RespondingRing active={isResponding} />

          <TouchableOpacity
            style={[
              styles.micBtn,
              { backgroundColor: micColor, shadowColor: micColor },
            ]}
            onPress={toggleMic}
            activeOpacity={0.82}
            disabled={isConnecting}
          >
            <MaterialCommunityIcons
              name={micIcon as any}
              size={44}
              color="#fff"
            />
          </TouchableOpacity>

          <Text style={styles.micHint}>{micHintText}</Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const MIC_SIZE = 90;

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: "#F4F6F9",
  },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    elevation:         2,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.06,
    shadowRadius:      3,
  },
  iconBtn: {
    padding:    4,
    width:      38,
    alignItems: "center",
  },
  headerTitle: {
    fontSize:   17,
    fontWeight: "700",
    color:      "#111827",
  },

  // Body
  body: {
    flex:              1,
    paddingHorizontal: 20,
    paddingBottom:     24,
    justifyContent:    "space-between",
  },

  // Avatar
  avatarSection: {
    alignItems: "center",
    paddingTop: 28,
    gap:        8,
  },
  avatarRing: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: "#EFF6FF",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
    borderColor:     "#BFDBFE",
  },
  avatarRingListening: {
    borderColor:     "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  avatarRingResponding: {
    borderColor:     "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  greeting: {
    fontSize:   22,
    fontWeight: "700",
    color:      "#111827",
    textAlign:  "center",
    marginTop:  8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    marginTop:     4,
  },
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color:    "#4B5563",
  },

  // Connect / Disconnect
  ctrlRow: {
    flexDirection:  "row",
    justifyContent: "center",
    marginTop:      10,
  },
  ctrlBtn: {
    paddingHorizontal: 24,
    paddingVertical:    9,
    borderRadius:      999,
  },
  ctrlBtnBlue: { backgroundColor: "#2563EB" },
  ctrlBtnRed:  { backgroundColor: "#DC2626" },
  ctrlBtnGray: { backgroundColor: "#9CA3AF" },
  ctrlBtnText: {
    color:      "#fff",
    fontWeight: "700",
    fontSize:   13,
  },

  interruptedText: {
    fontSize:  13,
    color:     "#B45309",
    marginTop: 4,
  },
  errorBox: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    gap:               6,
    backgroundColor:   "#FEF2F2",
    borderRadius:      10,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginTop:         6,
    maxWidth:          "90%",
  },
  errorText: {
    flex:       1,
    fontSize:   13,
    color:      "#B91C1C",
    lineHeight: 18,
  },
  diagText: {
    fontSize:          12,
    color:             "#6B7280",
    textAlign:         "center",
    marginTop:         4,
    paddingHorizontal: 20,
  },

  // Transcript
  transcriptCard: {
    flex:            1,
    backgroundColor: "#fff",
    borderRadius:    20,
    marginVertical:  18,
    elevation:       2,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.08,
    shadowRadius:    4,
  },
  transcriptContent: {
    padding: 20,
  },
  txLabel: {
    fontSize:      11,
    fontWeight:    "700",
    letterSpacing: 0.6,
    marginBottom:  6,
  },
  txLabelUser:  { color: "#1D4ED8" },
  txLabelModel: { color: "#047857" },
  txText: {
    fontSize:   15,
    color:      "#9CA3AF",
    lineHeight: 22,
  },
  txTextActive: {
    color:      "#111827",
    fontWeight: "500",
  },
  txTextModel: {
    color: "#111827",
  },
  txDivider: {
    height:          1,
    backgroundColor: "#F3F4F6",
    marginVertical:  14,
  },

  // Mic
  micSection: {
    alignItems:     "center",
    justifyContent: "center",
    height:         MIC_SIZE + 64,
  },
  pulseRing: {
    position:        "absolute",
    width:           MIC_SIZE,
    height:          MIC_SIZE,
    borderRadius:    MIC_SIZE / 2,
    backgroundColor: "#DC2626",
  },
  respondingRing: {
    position:        "absolute",
    width:           MIC_SIZE,
    height:          MIC_SIZE,
    borderRadius:    MIC_SIZE / 2,
    backgroundColor: "#7C3AED",
  },
  micBtn: {
    width:          MIC_SIZE,
    height:         MIC_SIZE,
    borderRadius:   MIC_SIZE / 2,
    alignItems:     "center",
    justifyContent: "center",
    elevation:      10,
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.35,
    shadowRadius:   10,
  },
  micHint: {
    marginTop: 12,
    fontSize:  13,
    color:     "#6B7280",
  },
});
