import { useSettings } from "@/context/SettingsContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/** What the Account tab shows to a guest ("Bisita"): a friendly explanation and two big buttons. */
export default function GuestAccount() {
  const { t, fontScale, colors: c } = useSettings();
  const router = useRouter();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={s.content}>
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.cardBorder }]}>
        <Ionicons name="person-circle-outline" size={96} color={c.primary} />
        <Text style={[s.title, { fontSize: 26 * fontScale, color: c.textStrong }]}>{t("guestAccountTitle")}</Text>
        <Text style={[s.body, { fontSize: 18 * fontScale, color: c.text }]}>{t("guestAccountBody")}</Text>
        <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={() => router.push({ pathname: "/", params: { login: "1" } })}>
          <Text style={[s.btnText, { fontSize: 20 * fontScale, color: c.onColor }]}>{t("loginPromptLogin")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { borderWidth: 2, borderColor: c.primary, backgroundColor: c.surface }]} onPress={() => router.push("/(auth)/signup")}>
          <Text style={[s.btnText, { fontSize: 20 * fontScale, color: c.primary }]}>{t("loginPromptSignup")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, flexGrow: 1, justifyContent: "center" },
  card: { borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1 },
  title: { fontWeight: "800", textAlign: "center", marginTop: 8 },
  body: { lineHeight: 28, textAlign: "center", marginTop: 10, marginBottom: 22 },
  btn: { minHeight: 60, borderRadius: 14, alignSelf: "stretch", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  btnText: { fontWeight: "800" },
}); 
