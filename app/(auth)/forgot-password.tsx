import { useSettings } from "@/context/SettingsContext";
import { requestPasswordResetOtp, resetPasswordWithOtp } from "@/lib/firebase";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const router = useRouter();
  const { fontScale } = useSettings() as { fontScale?: number };
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
      setError("identifier", "Enter your ID number or registered mobile number.");
      return;
    }
    if (!isValidIdentifier(identifier)) {
      setError("identifier", "Enter a valid ID number or a mobile number like 09171234567.");
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
      setError("identifier", e?.message || "Could not send the code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const next: Record<string, string> = {};
    if (otp.length !== 6) next.otp = "Enter the 6-digit code from the text message.";
    if (newPassword.length < MIN_PASSWORD) {
      next.newPassword = `Password must be at least ${MIN_PASSWORD} characters.`;
    } else if (newPassword.length > MAX_PASSWORD) {
      next.newPassword = "Password is too long.";
    }
    if (!next.newPassword && confirmPassword !== newPassword) {
      next.confirmPassword = "The passwords do not match.";
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithOtp(identifier, otp, newPassword);
      Alert.alert(
        "Password Changed",
        "Your password has been reset. Please log in with your new password.",
        [{ text: "OK", onPress: () => router.replace("/") }],
      );
    } catch (e: any) {
      setError("otp", e?.message || "Could not reset the password. Please try again.");
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
          <Text style={[styles.title, { fontSize: 28 * scale }]}>Forgot Password</Text>
          <Text style={[styles.subtitle, { fontSize: 16 * scale }]}>
            {step === "request"
              ? "Enter your ID number or registered mobile number. We will text a 6-digit code to the mobile number on your account."
              : "Enter the 6-digit code we texted you, then choose a new password."}
          </Text>

          {step === "request" ? (
            <>
              <Text style={styles.label}>ID Number or Mobile Number</Text>
              <TextInput
                style={fieldStyle("identifier")}
                placeholder="e.g. 123456 or 09171234567"
                placeholderTextColor="#6B7280"
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
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.primaryText, { fontSize: 17 * scale }]}>Send Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>6-digit Code</Text>
              <TextInput
                style={[...fieldStyle("otp"), styles.otpInput]}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
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

              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={fieldStyle("newPassword")}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                placeholderTextColor="#6B7280"
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v.slice(0, MAX_PASSWORD));
                  clearError("newPassword");
                }}
                secureTextEntry
                autoCapitalize="none"
              />
              {!!errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}

              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={fieldStyle("confirmPassword")}
                placeholder="Type the new password again"
                placeholderTextColor="#6B7280"
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
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.primaryText, { fontSize: 17 * scale }]}>Reset Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={sendCode} disabled={loading || cooldown > 0}>
                <Text style={[styles.linkText, cooldown > 0 && styles.linkDisabled]}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Send a new code"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setStep("request");
                  setErrors({});
                }}
              >
                <Text style={styles.linkText}>Use a different ID or number</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.helpText}>
            No code or no registered mobile number? Visit your barangay or the OSCA office and ask
            them to reset your password.
          </Text>

          <TouchableOpacity onPress={() => router.replace("/")} style={styles.backWrap}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F3F4F6" },
  container: { padding: 24, paddingBottom: 40 },
  title: { fontWeight: "800", color: "#111827", marginTop: 8 },
  subtitle: { color: "#4B5563", marginTop: 8, marginBottom: 12, lineHeight: 23 },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1D4ED8",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    color: "#111827",
    minHeight: 52,
  },
  inputError: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
  otpInput: { letterSpacing: 8, textAlign: "center", fontWeight: "700" },
  errorText: { color: "#B91C1C", fontSize: 14, marginTop: 6, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    marginTop: 24,
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  primaryText: { color: "white", fontWeight: "800" },
  linkText: {
    color: "#1D4ED8",
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
    textAlign: "center",
    paddingVertical: 8,
  },
  linkDisabled: { color: "#6B7280", textDecorationLine: "none" },
  helpText: { color: "#4B5563", fontSize: 14, lineHeight: 21, marginTop: 20, textAlign: "center" },
  backWrap: { marginTop: 8 },
});
