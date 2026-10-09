import { Palette } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "@/components/ReadAloudText";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import {
  isTempIdNumber,
  MyIdVerification,
  submitIdVerification,
  subscribeToMyIdVerification,
} from "@/lib/firebase";
import { pickIdImage, PickedIdImage } from "@/lib/idImage";

const makeColors = (p: Palette) => ({
  primary: p.info,
  primaryLight: p.surfaceSoft,
  danger: p.danger,
  dangerLight: p.dangerSoft,
  warning: p.warning,
  warningLight: p.warningSoft,
  card: p.surface,
  text: p.text,
  textSub: p.textSecondary,
  border: p.border,
});
type Colors = ReturnType<typeof makeColors>;

function formatDate(value: any): string {
  const date: Date | null =
    typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Lets a senior send OSCA a photo of their physical ID (mostly seniors who
 * signed up with a temporary TEMP###### ID). The admin verifies it manually;
 * on approval the account gets the real OSCA ID and a digital ID automatically,
 * so this card disappears once the account is verified with a real ID number.
 */
export default function IdVerificationCard() {
  const { colors: palette } = useSettings();
  const C = useMemo(() => makeColors(palette), [palette]);
  const s = useMemo(() => makeS(C), [C]);
  const { user, refreshUser } = useAuth();
  const { fontScale, t } = useSettings();

  const [latest, setLatest] = useState<MyIdVerification | null>(null);
  // null = the senior hasn't typed anything yet, so show the number they gave at
  // sign-up (never a TEMP one).
  const [typedId, setTypedId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PickedIdImage | null>(null);
  const [sending, setSending] = useState(false);
  const refreshedFor = useRef<string | null>(null);

  useEffect(() => subscribeToMyIdVerification(user?.uid, setLatest), [user?.uid]);

  // OSCA verified it: pull the new OSCA ID / verified status into the app.
  useEffect(() => {
    if (latest?.status === "approved" && refreshedFor.current !== latest.id) {
      refreshedFor.current = latest.id;
      refreshUser();
    }
  }, [latest?.id, latest?.status, refreshUser]);

  if (!user) return null;
  const done = user.isVerified === true && !isTempIdNumber(user.idNumber);
  if (done) return null;

  const idNumber =
    typedId ?? (user.idNumber && !isTempIdNumber(user.idNumber) ? user.idNumber : "");
  const pending = latest?.status === "pending";
  const rejected = latest?.status === "rejected";

  const choosePhoto = async () => {
    try {
      const picked = await pickIdImage();
      if (picked) setPhoto(picked);
    } catch (e: any) {
      Alert.alert(
        t("ivPhotoTitle"),
        e?.code === "photo-permission"
          ? t("ivPhotoPermission")
          : e?.code === "photo-too-large"
            ? t("ivPhotoTooLarge")
            : t("ivPhotoFail"),
      );
    }
  };

  const send = async () => {
    if (!photo) {
      Alert.alert(t("ivPhotoRequiredTitle"), t("ivPhotoRequiredBody"));
      return;
    }
    setSending(true);
    try {
      await submitIdVerification({ idNumber, imageBase64: photo.base64 });
      setPhoto(null);
      Alert.alert(t("ivSentTitle"), t("ivSentBody"));
    } catch (e: any) {
      Alert.alert(t("ivSendFailTitle"), t("tryAgain"));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="card-outline" size={22} color={C.primary} />
        <Text style={[s.title, { fontSize: 17 * fontScale }]}>{t("ivTitle")}</Text>
      </View>

      {pending ? (
        <View style={[s.notice, { backgroundColor: C.warningLight }]}>
          <Ionicons name="time-outline" size={20} color={C.warning} />
          <Text style={[s.noticeText, { fontSize: 15 * fontScale }]}>
            {t("ivPending", {
              idPart: latest?.idNumber ? ` (${latest.idNumber})` : "",
              datePart: formatDate(latest?.submittedAt)
                ? t("ivDatePart", { date: formatDate(latest?.submittedAt) })
                : "",
            })}
          </Text>
        </View>
      ) : (
        <>
          {rejected && (
            <View style={[s.notice, { backgroundColor: C.dangerLight }]}>
              <Ionicons name="alert-circle-outline" size={20} color={C.danger} />
              <Text style={[s.noticeText, { fontSize: 15 * fontScale }]}>
                {t("ivRejected")}
              </Text>
            </View>
          )}

          <Text style={[s.help, { fontSize: 15 * fontScale }]}>
            {isTempIdNumber(user.idNumber)
              ? t("ivHelpTemp")
              : t("ivHelp")}
          </Text>

          <TextInput
            placeholder={t("ivIdPh")}
            placeholderTextColor={C.textSub}
            style={[s.input, { fontSize: 16 * fontScale }]}
            value={idNumber}
            onChangeText={setTypedId}
            autoCapitalize="characters"
          />

          <TouchableOpacity style={s.photoBox} onPress={choosePhoto} activeOpacity={0.7}>
            {photo ? (
              <>
                <Image source={{ uri: photo.uri }} style={s.preview} resizeMode="contain" />
                <Text style={[s.photoHint, { fontSize: 14 * fontScale }]}>{t("ivChangePhoto")}</Text>
              </>
            ) : (
              <>
                <Ionicons name="camera-outline" size={30} color={C.primary} />
                <Text style={[s.photoHint, { fontSize: 15 * fontScale }]}>{t("ivAddPhoto")}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.button, sending && { opacity: 0.6 }]}
            onPress={send}
            disabled={sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[s.buttonText, { fontSize: 16 * fontScale }]}>{t("ivSend")}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const makeS = (C: Colors) => StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontWeight: "700", color: C.text },
  help: { color: C.textSub, lineHeight: 22 },
  notice: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, alignItems: "flex-start" },
  noticeText: { flex: 1, color: C.text, lineHeight: 22 },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    backgroundColor: "#fff",
  },
  photoBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
    borderRadius: 14,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 6,
  },
  preview: { width: "100%", height: 170 },
  photoHint: { color: C.primary, fontWeight: "600" },
  button: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
