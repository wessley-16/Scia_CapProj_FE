import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// SCIA opens as a guest ("Bisita"). A login/sign-up prompt appears ONLY when a guest taps something
// that really needs an account (booking an appointment, joining an event, ...).
//   const { requireLogin } = useRequireLogin();
//   if (!requireLogin(t("featAppointment"))) return;   // shows the prompt and stops for guests
type Ctx = { requireLogin: (featureLabel: string) => boolean };
const LoginPromptContext = createContext<Ctx>({ requireLogin: () => true });
export const useRequireLogin = () => useContext(LoginPromptContext);

export function LoginPromptProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  const { t, fontScale, colors: c } = useSettings();
  const router = useRouter();
  const [feature, setFeature] = useState<string | null>(null);

  const requireLogin = useCallback(
    (label: string) => {
      if (user && !isGuest) return true;
      setFeature(label);
      return false;
    },
    [user, isGuest],
  );

  const close = () => setFeature(null);

  return (
    <LoginPromptContext.Provider value={{ requireLogin }}>
      {children}
      <Modal visible={feature !== null} transparent animationType="fade" onRequestClose={close}>
        <View style={s.overlay}>
          <View style={[s.card, { backgroundColor: c.surface }]}>
            <Text style={[s.title, { fontSize: 24 * fontScale, color: c.textStrong }]}>{t("loginPromptTitle")}</Text>
            <Text style={[s.body, { fontSize: 18 * fontScale, color: c.text }]}>
              {t("loginPromptBody", { feature: feature ?? "" })}
            </Text>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: c.primary }]}
              onPress={() => { close(); router.push({ pathname: "/", params: { login: "1" } }); }}
              accessibilityRole="button"
            >
              <Text style={[s.btnText, { fontSize: 20 * fontScale, color: c.onColor }]}>{t("loginPromptLogin")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: c.surface, borderWidth: 2, borderColor: c.primary }]}
              onPress={() => { close(); router.push("/(auth)/signup"); }}
              accessibilityRole="button"
            >
              <Text style={[s.btnText, { fontSize: 20 * fontScale, color: c.primary }]}>{t("loginPromptSignup")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.later} onPress={close} accessibilityRole="button">
              <Text style={[s.laterText, { fontSize: 18 * fontScale, color: c.link }]}>{t("loginPromptLater")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LoginPromptContext.Provider>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
  card: { borderRadius: 20, padding: 22 },
  title: { fontWeight: "800", marginBottom: 10 },
  body: { lineHeight: 28, marginBottom: 18 },
  btn: { minHeight: 60, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 12, paddingHorizontal: 12 },
  btnText: { fontWeight: "800", textAlign: "center" },
  later: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  laterText: { fontWeight: "700", textDecorationLine: "underline" },
});
