import { useSettings } from "@/context/SettingsContext";
import { pickDocumentImage } from "@/lib/idImage";
import type { SeniorDocInput, SeniorDocKind } from "@/lib/firebase";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Up to MAX photos: a valid government ID and/or the birth certificate. Take a photo or choose
// one from the gallery. The senior says what each photo is; OSCA checks it later.
export const MAX_DOCS = 3;

interface Props {
  value: SeniorDocInput[];
  onChange: (next: SeniorDocInput[]) => void;
}

export default function DocumentUploader({ value, onChange }: Props) {
  const { colors: c, t } = useSettings();
  const s = useMemo(() => makeStyles(c), [c]);
  const [kind, setKind] = useState<SeniorDocKind>("id");
  const [busy, setBusy] = useState(false);
  const full = value.length >= MAX_DOCS;

  const add = async (source: "camera" | "library") => {
    setBusy(true);
    try {
      const picked = await pickDocumentImage(source);
      if (picked) onChange([...value, { kind, imageBase64: picked.base64 }]);
    } catch (e: any) {
      Alert.alert(t("errorTitle"), e?.message || t("suDocsFail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={s.label}>{t("suDocWhat")}</Text>
      <View style={s.row}>
        {([["id", t("suDocId")], ["birth_certificate", t("suDocBirth")], ["barangay_certificate", t("suDocBrgy")]] as [SeniorDocKind, string][]).map(([k, label]) => (
          <TouchableOpacity key={k} style={[s.chip, kind === k && s.chipOn]} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: kind === k }}>
            <Text style={[s.chipText, kind === k && s.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.row}>
        <TouchableOpacity style={[s.action, (full || busy) && s.disabled]} disabled={full || busy} onPress={() => add("camera")} accessibilityRole="button">
          <Text style={s.actionText}>{t("suDocCamera")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.action, s.actionAlt, (full || busy) && s.disabled]} disabled={full || busy} onPress={() => add("library")} accessibilityRole="button">
          <Text style={[s.actionText, s.actionAltText]}>{t("suDocGallery")}</Text>
        </TouchableOpacity>
      </View>
      {busy && <ActivityIndicator color={c.primary} style={{ marginTop: 10 }} />}
      {full && <Text style={s.hint}>{t("suDocMax", { n: MAX_DOCS })}</Text>}

      {value.map((d, i) => (
        <View key={i} style={s.item}>
          <Image source={{ uri: `data:image/jpeg;base64,${d.imageBase64}` }} style={s.thumb} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle}>{d.kind === "id" ? t("suDocId") : d.kind === "birth_certificate" ? t("suDocBirth") : t("suDocBrgy")}</Text>
            <TouchableOpacity onPress={() => onChange(value.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t("suDocRemove")}>
              <Text style={s.remove}>{t("suDocRemove")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    label: { fontSize: 17, fontWeight: "700", color: c.text, marginBottom: 8 },
    row: { flexDirection: "row", gap: 10, marginBottom: 12, flexWrap: "wrap" },
    chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
    chipOn: { borderColor: c.primary, backgroundColor: c.primary },
    chipText: { fontSize: 17, fontWeight: "700", color: c.text },
    chipTextOn: { color: c.onColor },
    action: { flex: 1, minHeight: 56, borderRadius: 14, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    actionAlt: { backgroundColor: c.surface, borderWidth: 2, borderColor: c.primary },
    actionText: { fontSize: 18, fontWeight: "800", color: c.onColor, textAlign: "center" },
    actionAltText: { color: c.primary },
    disabled: { opacity: 0.5 },
    hint: { fontSize: 15, color: c.textMuted, marginBottom: 8 },
    item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 14, padding: 10, marginTop: 10 },
    thumb: { width: 84, height: 64, borderRadius: 8, backgroundColor: c.border },
    itemTitle: { fontSize: 17, fontWeight: "700", color: c.text },
    remove: { fontSize: 16, fontWeight: "700", color: "#b91c1c", marginTop: 4 },
  });
  