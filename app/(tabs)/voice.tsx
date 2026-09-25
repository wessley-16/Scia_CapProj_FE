/**
 * app/(tabs)/voice.tsx
 *
 * Voice Assistant — record, transcribe, answer, speak.
 *
 * Design rules for this screen (all deliberate, all for elderly users):
 *  - ONE control does the main job. The big circle is start/stop/interrupt.
 *  - Everything the app heard and everything it said is ALSO on screen as
 *    large text, because hearing loss is common and audio-only fails.
 *  - Status is written in words, not just colour or animation.
 *  - Touch targets are 64px+ and never rely on a long-press.
 *  - Replay is one tap, because "ulitin mo nga" is the most common request.
 *
 * NOTE: useVoiceAssistant is a single-turn hook — it only tracks the
 * current transcript/reply, not a running conversation. This screen builds
 * its own local `turns` history by watching state/transcript/reply and
 * folding each completed exchange in once the hook returns to "idle".
 */

import { useSettings } from "@/context/SettingsContext";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Turn = { id: string; question: string; answer: string };

function PulseRing({ active, color }: { active: boolean; color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, pulse]);

  if (!active) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          borderColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.45, 0] }),
          transform: [
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) },
          ],
        },
      ]}
    />
  );
}

export default function VoiceScreen() {
  const router = useRouter();
  const { fontScale } = useSettings();

  const {
    state,
    isListening,
    isBusy,
    transcript,
    reply,
    error,
    toggleMic,
    cancel,
    replay,
  } = useVoiceAssistant();

  // ── Local conversation history ──────────────────────────────────────────
  // The hook only exposes the current exchange (transcript/reply). We
  // accumulate completed turns here so the screen can show a scrollback,
  // same as the original design intent.
  const [turns, setTurns] = useState<Turn[]>([]);
  const lastRecordedRef = useRef<string>("");

  useEffect(() => {
    // A turn is "done" once we're back to idle and have both a transcript
    // and a reply that hasn't already been folded into history.
    if (state === "idle" && transcript && reply) {
      const key = `${transcript}::${reply}`;
      if (lastRecordedRef.current !== key) {
        lastRecordedRef.current = key;
        setTurns((prev) => [
          ...prev,
          { id: `${Date.now()}`, question: transcript, answer: reply },
        ]);
      }
    }
  }, [state, transcript, reply]);

  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  // Show the live transcript as a "partial" bubble while a turn is still in
  // progress (i.e. hasn't yet been folded into `turns`).
  const currentKey = `${transcript}::${reply}`;
  const partialQuestion =
    !!transcript && lastRecordedRef.current !== currentKey ? transcript : "";

  const errorMessage = error;
  const isRecording = isListening;
  const isSpeaking = state === "speaking";

  const clearConversation = () => {
    setTurns([]);
    lastRecordedRef.current = "";
    void cancel();
  };

  const toggleRecording = toggleMic;
  const cancelRecording = cancel;
  const replayLast = replay;

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Always keep the newest answer in view.
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [turns.length, partialQuestion, errorMessage]);

  const fs = (n: number) => n * fontScale;

  // ── Words, not just colours ──────────────────────────────────────────
  const statusText =
    isRecording               ? "Nakikinig po ako…"        :
    state === "transcribing"  ? "Naiintindihan ko pa po…"   :
    state === "thinking"      ? "Sandali po, iniisip ko…"   :
    isSpeaking                ? "Sinasagot ko po…"          :
    errorMessage              ? "May problema po"           :
                                 "Handa na po ako";

  const hintText =
    isRecording        ? "Pindutin ulit kapag tapos na kayong magsalita" :
    isBusy             ? "Sandali lang po…"                              :
    isSpeaking         ? "Pindutin para itigil ang pagsasalita"          :
                         "Pindutin ang butones, tapos magsalita";

  const buttonColor =
    isRecording ? "#DC2626" :
    isBusy      ? "#6B7280" :
    isSpeaking  ? "#7C3AED" :
                  "#2563EB";

  const buttonIcon =
    isRecording ? "stop"           :
    isBusy      ? "dots-horizontal":
    isSpeaking  ? "volume-high"    :
                  "microphone";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Isara"
        >
          <Ionicons name="close" size={30} color="#111827" />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { fontSize: fs(20) }]}>HealthAI</Text>

        <TouchableOpacity
          onPress={clearConversation}
          style={styles.iconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Bagong tanong"
          disabled={isBusy}
        >
          <Ionicons name="refresh" size={26} color={isBusy ? "#D1D5DB" : "#111827"} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {turns.length === 0 && !partialQuestion && !errorMessage && (
          <View style={styles.emptyCard}>
            <Text style={[styles.emptyTitle, { fontSize: fs(22) }]}>
              Magtanong po kayo sa akin
            </Text>
            <Text style={[styles.emptyBody, { fontSize: fs(17) }]}>
              Pindutin ang asul na butones sa ibaba, tapos magsalita nang normal.
              Pindutin ulit kapag tapos na kayo. Babasahin ko po ang sagot.
            </Text>
            <Text style={[styles.emptyHint, { fontSize: fs(15) }]}>
              Halimbawa: “Ano po ang gamot sa sipon?” o “Paano mag-book ng
              appointment sa health center?”
            </Text>
          </View>
        )}

        {turns.map((turn: Turn) => (
          <View key={turn.id} style={styles.turnBlock}>
            <Text style={[styles.label, { fontSize: fs(14) }]}>SINABI NINYO</Text>
            <View style={styles.questionCard}>
              <Text style={[styles.questionText, { fontSize: fs(18) }]}>
                {turn.question}
              </Text>
            </View>

            <Text style={[styles.label, { fontSize: fs(14) }]}>SAGOT NI HEALTHAI</Text>
            <View style={styles.answerCard}>
              <Text style={[styles.answerText, { fontSize: fs(19) }]}>
                {turn.answer}
              </Text>
            </View>
          </View>
        ))}

        {!!partialQuestion && (
          <View style={styles.turnBlock}>
            <Text style={[styles.label, { fontSize: fs(14) }]}>SINABI NINYO</Text>
            <View style={styles.questionCard}>
              <Text style={[styles.questionText, { fontSize: fs(18) }]}>
                {partialQuestion}
              </Text>
            </View>
          </View>
        )}

        {!!errorMessage && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={fs(24)} color="#B91C1C" />
            <Text style={[styles.errorText, { fontSize: fs(17) }]}>{errorMessage}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <View style={styles.controls}>
        <Text style={[styles.statusText, { fontSize: fs(19) }]}>{statusText}</Text>

        <View style={styles.micWrap}>
          <PulseRing active={isRecording} color="#DC2626" />
          <PulseRing active={isSpeaking} color="#7C3AED" />
          <TouchableOpacity
            onPress={toggleRecording}
            activeOpacity={0.85}
            disabled={isBusy && !isRecording}
            style={[styles.micButton, { backgroundColor: buttonColor }]}
            accessibilityLabel={isRecording ? "Itigil ang pagrekord" : "Magsalita"}
          >
            <MaterialCommunityIcons name={buttonIcon as any} size={58} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.hintText, { fontSize: fs(16) }]}>{hintText}</Text>

        <View style={styles.secondaryRow}>
          {isRecording ? (
            <TouchableOpacity
              onPress={cancelRecording}
              style={[styles.secondaryBtn, styles.cancelBtn]}
              accessibilityLabel="Kanselahin"
            >
              <Ionicons name="close-circle-outline" size={fs(22)} color="#B91C1C" />
              <Text style={[styles.cancelLabel, { fontSize: fs(16) }]}>Kanselahin</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={replayLast}
              disabled={!lastTurn || isBusy}
              style={[
                styles.secondaryBtn,
                (!lastTurn || isBusy) && styles.secondaryBtnDisabled,
              ]}
              accessibilityLabel="Ulitin ang sagot"
            >
              <Ionicons
                name="volume-high-outline"
                size={fs(22)}
                color={!lastTurn || isBusy ? "#9CA3AF" : "#1D4ED8"}
              />
              <Text
                style={[
                  styles.secondaryLabel,
                  { fontSize: fs(16) },
                  (!lastTurn || isBusy) && { color: "#9CA3AF" },
                ]}
              >
                Ulitin ang sagot
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerTitle: { fontWeight: "700", color: "#111827" },
  iconBtn: { padding: 8, minWidth: 46, minHeight: 46, alignItems: "center", justifyContent: "center" },

  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 24 },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  emptyTitle: { fontWeight: "700", color: "#111827" },
  emptyBody: { color: "#374151", lineHeight: 26 },
  emptyHint: { color: "#6B7280", fontStyle: "italic", lineHeight: 22 },

  turnBlock: { marginBottom: 20, gap: 6 },
  label: { fontWeight: "700", color: "#6B7280", letterSpacing: 0.6, marginTop: 6 },

  questionCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  questionText: { color: "#1E3A8A", lineHeight: 26 },

  answerCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  answerText: { color: "#111827", lineHeight: 30 },

  errorCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { color: "#991B1B", flex: 1, lineHeight: 24 },

  controls: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 22,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 10,
  },
  statusText: { fontWeight: "700", color: "#111827" },

  micWrap: { alignItems: "center", justifyContent: "center", height: 150, width: 150 },
  micButton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pulseRing: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
  },

  hintText: { color: "#4B5563", textAlign: "center" },

  secondaryRow: { flexDirection: "row", justifyContent: "center", marginTop: 4 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    minHeight: 52,
  },
  secondaryBtnDisabled: { backgroundColor: "#F3F4F6" },
  secondaryLabel: { color: "#1D4ED8", fontWeight: "600" },
  cancelBtn: { backgroundColor: "#FEF2F2" },
  cancelLabel: { color: "#B91C1C", fontWeight: "600" },
});
