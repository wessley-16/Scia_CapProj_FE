import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { loginByIdentifier, logoutUser } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const logo = require("../assets/images/Logo.png");
const defaultAvatar = require("../assets/images/default-profile.png");

const fontOptions = [
  { labelKey: "small", value: 0.75 },
  { labelKey: "medium", value: 1 },
  { labelKey: "large", value: 1.25 },
];

const languageOptions = [
  { labelKey: "english", value: "en" },
  { labelKey: "tagalog", value: "tl" },
];

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, clearUser, enterGuestMode } = useAuth();
  const { fontScale, language, setFontScale, setLanguage, t } = useSettings();

  const [showLogin, setShowLogin] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // user is populated only for a real, current Firebase session
  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.idNumber
    : "";

  useEffect(() => {
    if (user) {
      AsyncStorage.getItem("profileImage").then((img) => {
        if (img) setAvatarUri(img);
      });
    } else {
      setAvatarUri(null);
    }
  }, [user]);

  const avatarSource = avatarUri ? { uri: avatarUri } : defaultAvatar;

  // Prevents guest mode or signup from running while already signed in
  const blockIfSignedIn = () => {
    if (!user) return false;
    Alert.alert(
      t("alreadySignedInTitle"),
      `${t("alreadySignedInPrefix")} ${displayName}. ${t("pleaseLogOutFirst")}`,
    );
    return true;
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert(
        "Error",
        "Please enter your ID number, full name, or phone number and password.",
      );
      return;
    }
    setIsLoading(true);
    try {
      await loginByIdentifier(identifier, password);
      await refreshUser();
      router.replace("/(tabs)/home");
    } catch (error: any) {
      Alert.alert("Login Failed", error?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    if (blockIfSignedIn()) return;
    await enterGuestMode();
    router.replace("/(tabs)/home");
  };

  const handleGoToSignup = () => {
    if (blockIfSignedIn()) return;
    router.push("/(auth)/signup");
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await refreshUser();
      router.replace("/(tabs)/home");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutFromWelcome = () => {
    Alert.alert(t("logOutConfirmTitle"), t("logOutConfirmMessage"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("logOutConfirmTitle"),
        style: "destructive",
        onPress: async () => {
          await logoutUser();
          clearUser();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity
        style={[styles.settingsBtn, { top: insets.top + 10 }]}
        onPress={() => setSettingsVisible(true)}
        accessibilityLabel={t("languageAndFont")}
      >
        <Ionicons name="globe-outline" size={18} color="#2563EB" style={styles.settingsBtnIcon} />
        <Text style={[styles.settingsBtnText, { fontSize: 15 * fontScale }]}>
          {t("languageAndFont")}
        </Text>
      </TouchableOpacity>

      <View style={styles.inner}>
        <Image source={logo} style={styles.logo} />

        {user ? (
          <View style={styles.welcomeCard}>
            <Image source={avatarSource} style={styles.welcomeAvatar} />
            <Text style={[styles.welcomeTitle, { fontSize: 22 * fontScale }]}>
              {t("welcomeBack")}
            </Text>
            <Text style={[styles.welcomeName, { fontSize: 17 * fontScale }]}>
              {t("continueAs")} {displayName}
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleContinue}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={[styles.primaryText, { fontSize: 24 * fontScale }]}>
                  {t("continueButton")}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogoutFromWelcome} style={styles.notYouBtn}>
              <Text style={[styles.notYouText, { fontSize: 16 * fontScale }]}>
                {t("notYouLogOut")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {showLogin && (
              <View style={styles.formContainer}>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setShowLogin(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={26} color="#111827" />
                </TouchableOpacity>

                <TextInput
                  style={[styles.input, { fontSize: 17 * fontScale }]}
                  placeholder={t("idOrNamePlaceholder")}
                  placeholderTextColor="#6B7280"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TextInput
                  style={[styles.input, { fontSize: 17 * fontScale }]}
                  placeholder={t("passwordPlaceholder")}
                  placeholderTextColor="#6B7280"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <View style={styles.hintBox}>
                  <Text style={[styles.hintText, { fontSize: 15 * fontScale }]}>
                    {t("loginHintTitle")}
                  </Text>
                  <Text style={[styles.hintItem, { fontSize: 14 * fontScale }]}>
                    {t("loginHintId")}
                  </Text>
                  <Text style={[styles.hintItem, { fontSize: 14 * fontScale }]}>
                    {t("loginHintPhone")}
                  </Text>
                  <Text style={[styles.hintItem, { fontSize: 14 * fontScale }]}>
                    {t("loginHintFullName")}
                  </Text>
                  <Text style={[styles.hintItem, { fontSize: 14 * fontScale }]}>
                    {t("loginHintFirstLast")}
                  </Text>
                </View>
              </View>
            )}

            {!showLogin && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setShowLogin(true)}
              >
                <Text style={[styles.primaryText, { fontSize: 24 * fontScale }]}>
                  {t("logIn")}
                </Text>
              </TouchableOpacity>
            )}

            {showLogin && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.primaryText, { fontSize: 24 * fontScale }]}>
                    {t("submit")}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleGoToSignup} style={styles.secondaryBtn}>
              <Text style={[styles.secondaryText, { fontSize: 24 * fontScale }]}>
                {t("signUp")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGuest}>
              <Text style={[styles.guest, { fontSize: 24 * fontScale }]}>
                {t("guest")}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSettingsVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={26} color="#111827" />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { fontSize: 20 * fontScale }]}>
              {t("fontSize")}
            </Text>
            <View style={styles.optionsRow}>
              {fontOptions.map((option) => {
                const selected = fontScale === option.value;
                return (
                  <TouchableOpacity
                    key={option.labelKey}
                    style={[styles.optionCard, selected && styles.selectedOption]}
                    onPress={() => setFontScale(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.selectedOptionLabel,
                        { fontSize: 16 * fontScale },
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.modalTitle, { fontSize: 20 * fontScale, marginTop: 20 }]}>
              {t("language")}
            </Text>
            <View style={styles.optionsRow}>
              {languageOptions.map((option) => {
                const selected = language === option.value;
                return (
                  <TouchableOpacity
                    key={option.labelKey}
                    style={[styles.optionCard, selected && styles.selectedOption]}
                    onPress={() => setLanguage(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.selectedOptionLabel,
                        { fontSize: 16 * fontScale },
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setSettingsVisible(false)}
            >
              <Text style={[styles.modalDoneText, { fontSize: 16 * fontScale }]}>
                {t("done")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  logo: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignSelf: "center",
    marginBottom: 20,
    resizeMode: "contain",
  },
  settingsBtn: {
    position: "absolute",
    right: 16,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 22,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  settingsBtnIcon: { marginRight: 6 },
  settingsBtnText: { color: "#2563EB", fontWeight: "700" },
  formContainer: {
    width: "100%",
    backgroundColor: "#d8d7d7",
    padding: 15,
    paddingTop: 50,
    borderRadius: 10,
    marginBottom: 15,
  },
  closeBtn: { position: "absolute", top: 8, right: 10, zIndex: 1 },
  input: {
    backgroundColor: "#F7F9FC",
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    color: "#111",
  },
  hintBox: { marginTop: 4, marginBottom: 6, gap: 4 },
  hintText: { color: "#374151", lineHeight: 22, fontWeight: "700" },
  hintItem: { color: "#4B5563", lineHeight: 20, paddingLeft: 4 },
  primaryBtn: {
    width: "100%",
    paddingVertical: 14,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
  },
  primaryText: { color: "white", fontWeight: "700" },
  secondaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
    marginBottom: 20,
  },
  secondaryText: { color: "#2563EB", fontWeight: "700" },
  guest: { textAlign: "center", color: "#2563EB", fontWeight: "600" },

  welcomeCard: { width: "100%", alignItems: "center" },
  welcomeAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  welcomeTitle: {
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    textAlign: "center",
  },
  welcomeName: {
    color: "#374151",
    marginBottom: 22,
    textAlign: "center",
    fontWeight: "600",
  },
  notYouBtn: { marginTop: 6, padding: 10 },
  notYouText: {
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // Language & Font modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    paddingTop: 40,
  },
  modalCloseBtn: { position: "absolute", top: 12, right: 14 },
  modalTitle: { fontWeight: "700", color: "#111827", marginBottom: 10 },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  optionCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedOption: { backgroundColor: "#2356E1" },
  optionLabel: { color: "#1F2937", fontWeight: "600" },
  selectedOptionLabel: { color: "#fff" },
  modalDoneBtn: {
    backgroundColor: "#2356E1",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  modalDoneText: { color: "white", fontWeight: "700" },
});
