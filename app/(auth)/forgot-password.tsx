import { Palette } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { requestPasswordResetOtp, resetPasswordWithOtp } from "@/lib/firebase";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RESEND_SECONDS = 60;
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 64;

// ID number (e.g. 123456 or TEMP123456) or a PH mobile number. Letters, digits
// and a leading + only; everything else is dropped as the person types.
const cleanIdentifier = (v: string) => v.replace(/[^A-Za-z0-9+]/g, "").slice(0, 20);
const isValidIdentifier = (v: string) => /^(\+?639\d{9}|09\d{9}|[A-Za-z0-9]{4,20})$/.test(v);
const cleanOtp = (v: string) => v.replace(/\D/g, "").slice(0, 6);

type Step = "request" | "verify";

export default function ForgotPassword() {
  const { colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { fontScale, t } = useSettings() as { fontScale?: number; t: (k: string, v?: Record<string, string | number>) => string };
  // The server sends English error text; show the Tagalog version of the known ones.
  const serverMsg = (e: any, fallbackKey: string) => {
    const m: string = e?.message ?? "";
    if (/wait a minute/i.test(m)) return t("fpSrvWait");
    if (/too many code requests/i.test(m)) return t("fpSrvTooMany");
    if (/could not send the code/i.test(m)) return t("fpSrvUnavailable");
    if (/not valid or has expired/i.test(m)) return t("fpSrvBadCode");
    if (/too many wrong codes/i.test(m)) return t("fpSrvTooManyWrong");
    return t(fallbackKey);
  };
  const scale = fontScale ?? 1;
  const params = useLocalSearchParams<{ identifier?: string }>();

  const [step, setStep] = useState<Step>("request");
  const [identifier, setIdentifier] = useState(cleanIdentifier(params.identifier ?? ""));
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const setError = (field: string, message: string) =>
    setErrors((prev) => ({ ...prev, [field]: message }));
  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const sendCode = async () => {
    if (!identifier) {
      setError("identifier", t("fpEnterId"));
      return;
    }
    if (!isValidIdentifier(identifier)) {
      setError("identifier", t("fpBadId"));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordResetOtp(identifier);
      setStep("verify");
      setCooldown(RESEND_SECONDS);
      setOtp("");
      setErrors({});
    } catch (e: any) {
      setError("identifier", serverMsg(e, "fpSendFail"));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const next: Record<string, string> = {};
    if (otp.length !== 6) next.otp = t("fpBadOtp");
    if (newPassword.length < MIN_PASSWORD) {
      next.newPassword = t("vPwShort", { n: MIN_PASSWORD });
    } else if (newPassword.length > MAX_PASSWORD) {
      next.newPassword = t("vPwLong");
    }
    if (!next.newPassword && confirmPassword !== newPassword) {
      next.confirmPassword = t("fpNoMatch");
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithOtp(identifier, otp, newPassword);
      Alert.alert(
        t("fpChangedTitle"),
        t("fpChangedBody"),
        [{ text: t("ok"), onPress: () => router.replace("/") }],
      );
    } catch (e: any) {
      setError("otp", serverMsg(e, "fpResetFail"));
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = (field: string) => [
    styles.input,
    { fontSize: 17 * scale },
    errors[field] ? styles.inputError : null,
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { fontSize: 28 * scale }]}>{t("fpTitle")}</Text>
          <Text style={[styles.subtitle, { fontSize: 16 * scale }]}>
            {step === "request"
              ? t("fpIntroRequest")
              : t("fpIntroVerify")}
          </Text>

          {step === "request" ? (
            <>
              <Text style={styles.label}>{t("fpIdLabel")}</Text>
              <TextInput
                style={fieldStyle("identifier")}
                placeholder={t("fpIdPh")}
                placeholderTextColor={c.textMuted}
                value={identifier}
                onChangeText={(v) => {
                  setIdentifier(cleanIdentifier(v));
                  clearError("identifier");
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
              />
              {!!errors.identifier && <Text style={styles.errorText}>{errors.identifier}</Text>}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={sendCode}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={c.onColor} />
                ) : (
                  <Text style={[styles.primaryText, { fontSize: 17 * scale }]}>{t("fpSendCode")}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>{t("fpCodeLabel")}</Text>
              <TextInput
                style={[...fieldStyle("otp"), styles.otpInput]}
                placeholder="000000"
                placeholderTextColor={c.textMuted}
                value={otp}
                onChangeText={(v) => {
                  setOtp(cleanOtp(v));
                  clearError("otp");
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
              />
              {!!errors.otp && <Text style={styles.errorText}>{errors.otp}</Text>}

              <Text style={styles.label}>{t("fpNewPassword")}</Text>
              <TextInput
                style={fieldStyle("newPassword")}
                placeholder={t("fpPasswordPh", { n: MIN_PASSWORD })}
                placeholderTextColor={c.textMuted}
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v.slice(0, MAX_PASSWORD));
                  clearError("newPassword");
                }}
                secureTextEntry
                autoCapitalize="none"
              />
              {!!errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}

              <Text style={styles.label}>{t("fpConfirmPassword")}</Text>
              <TextInput
                style={fieldStyle("confirmPassword")}
                placeholder={t("fpConfirmPh")}
                placeholderTextColor={c.textMuted}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v.slice(0, MAX_PASSWORD));
                  clearError("confirmPassword");
                }}
                secureTextEntry
                autoCapitalize="none"
              />
              {!!errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={resetPassword}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={c.onColor} />
                ) : (
                  <Text style={[styles.primaryText, { fontSize: 17 * scale }]}>{t("fpReset")}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={sendCode} disabled={loading || cooldown > 0}>
                <Text style={[styles.linkText, cooldown > 0 && styles.linkDisabled]}>
                  {cooldown > 0 ? t("fpResendIn", { s: cooldown }) : t("fpSendNew")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setStep("request");
                  setErrors({});
                }}
              >
                <Text style={styles.linkText}>{t("fpDifferentId")}</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.helpText}>
            {t("fpHelp")}
          </Text>

          <TouchableOpacity onPress={() => router.replace("/")} style={styles.backWrap}>
            <Text style={styles.linkText}>{t("fpBackToLogin")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.surfaceAlt },
  container: { padding: 24, paddingBottom: 40 },
  title: { fontWeight: "800", color: c.text, marginTop: 8 },
  subtitle: { color: c.textSecondary, marginTop: 8, marginBottom: 12, lineHeight: 23 },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: c.primaryStrong,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    color: c.text,
    minHeight: 52,
  },
  inputError: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  otpInput: { letterSpacing: 8, textAlign: "center", fontWeight: "700" },
  errorText: { color: c.danger, fontSize: 14, marginTop: 6, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: c.primaryStrong,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    marginTop: 24,
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  primaryText: { color: c.onColor, fontWeight: "800" },
  linkText: {
    color: c.primaryStrong,
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
    textAlign: "center",
    paddingVertical: 8,
  },
  linkDisabled: { color: c.textMuted, textDecorationLine: "none" },
  helpText: { color: c.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 20, textAlign: "center" },
  backWrap: { marginTop: 8 },
});
