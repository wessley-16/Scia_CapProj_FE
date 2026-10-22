// components/home/EventDetailModal.tsx
//
// The "View" popup for an announcement or event. A senior sees the whole text in big letters,
// can have it read aloud, and only then decides to join. Join is never one accidental tap away:
// it is a separate big button inside this popup (or on the card).
import SpeakButton from "@/components/SpeakButton";
import { Text } from "@/components/ReadAloudText";
import { Palette } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { Event } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { formatWhen, getDate, getDescription, getLocation, getTitle } from "./eventFields";

interface Props {
  event: Event | null;
  joined: boolean;
  onClose: () => void;
  onJoin: (event: Event) => void;
}

export default function EventDetailModal({ event, joined, onClose, onJoin }: Props) {
  const { t, fontScale, colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!event) return null;

  const title = getTitle(event, t("evUntitled"));
  const when = formatWhen(getDate(event));
  const where = getLocation(event);
  const description = getDescription(event);
  const canJoin = !!event.isJoinable && !joined;

  // The same words that are on screen, so what is heard matches what is read.
  const spoken = [title, when && t("evWhen", { value: when }), where && t("evWhere", { value: where }), description]
    .filter(Boolean)
    .join(". ");

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel={t("close")} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: 24 * fontScale }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel={t("close")}>
              <Ionicons name="close" size={30} color={c.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator>
            {!!when && (
              <View style={styles.metaRow}>
                <Ionicons name="calendar" size={24} color={c.link} />
                <Text style={[styles.metaText, { fontSize: 18 * fontScale }]}>{when}</Text>
              </View>
            )}
            {!!where && (
              <View style={styles.metaRow}>
                <Ionicons name="location" size={24} color={c.link} />
                <Text style={[styles.metaText, { fontSize: 18 * fontScale }]}>{where}</Text>
              </View>
            )}
            <Text style={[styles.body, { fontSize: 18 * fontScale }]}>{description || t("evNoDetails")}</Text>
            <View style={{ marginTop: 16 }}>
              <SpeakButton text={spoken} />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {joined ? (
              <View style={styles.joinedRow}>
                <Ionicons name="checkmark-circle" size={26} color={c.success} />
                <Text style={[styles.joinedText, { fontSize: 19 * fontScale }]}>{t("evJoinedThis")}</Text>
              </View>
            ) : canJoin ? (
              <TouchableOpacity
                style={styles.joinBtn}
                activeOpacity={0.85}
                onPress={() => { onClose(); onJoin(event); }}
                accessibilityRole="button"
              >
                <Text style={[styles.joinBtnText, { fontSize: 21 * fontScale }]}>{t("evJoin")}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.closeBig} activeOpacity={0.85} onPress={onClose} accessibilityRole="button">
              <Text style={[styles.closeBigText, { fontSize: 19 * fontScale }]}>{t("close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22, maxHeight: "90%",
      borderTopWidth: 2, borderColor: c.border,
    },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
    title: { flex: 1, fontWeight: "800", color: c.text, paddingRight: 8 },
    closeBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
    metaText: { flex: 1, color: c.textStrong, fontWeight: "600" },
    body: { color: c.textStrong, lineHeight: 28, marginTop: 6 },
    footer: { marginTop: 14, gap: 10 },
    joinBtn: { minHeight: 60, borderRadius: 16, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
    joinBtnText: { color: c.onColor, fontWeight: "800" },
    closeBig: {
      minHeight: 56, borderRadius: 16, borderWidth: 2, borderColor: c.primary,
      backgroundColor: c.surface, alignItems: "center", justifyContent: "center",
    },
    closeBigText: { color: c.link, fontWeight: "800" },
    joinedRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
    joinedText: { color: c.success, fontWeight: "800" },
  });
  