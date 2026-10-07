// components/SpeakButton.tsx
//
// A large "Basahin nang malakas" (Read aloud) button. Tap once to hear the text,
// tap again to stop. Reading aloud helps seniors with low vision or low literacy,
// and it should never depend on a tiny speaker icon, so the button is labeled
// and at least 52 pt tall.
import { Palette } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { speak, stopSpeaking } from "@/lib/speak";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";

interface Props {
  /** The text to read. Pass the same words that are shown on screen. */
  text: string;
  style?: StyleProp<ViewStyle>;
}

export default function SpeakButton({ text, style }: Props) {
  const { t, fontScale, language, colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [playing, setPlaying] = useState(false);

  // Stop talking if the screen goes away while reading.
  useEffect(() => () => stopSpeaking(), []);

  const onPress = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    speak(text, language === "tl", () => setPlaying(false));
  };

  const label = playing ? t("spkStop") : t("spkRead");

  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={playing ? "stop-circle-outline" : "volume-high-outline"} size={26} color={c.primary} />
      <Text style={[styles.text, { fontSize: 17 * fontScale }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 18,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: c.primary,
      backgroundColor: c.surface,
      alignSelf: "flex-start",
    },
    text: { fontWeight: "800", color: c.primary },
  });
  