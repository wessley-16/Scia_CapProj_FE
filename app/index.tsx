import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { loginByIdentifier, logoutUser } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { Image as ExpoImage } from "expo-image";
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const logo = require("../assets/images/Logo.png");
const background = require("../assets/images/Background.png");
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

// After this many wrong passwords in a row, offer the Forgot Password flow.
const FORGOT_PROMPT_AFTER = 3;

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, clearUser, enterGuestMode } = useAuth();
  const { fontScale, language, setFontScale, setLanguage, t } = useSettings();

  const [showLogin, setShowLogin] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // Wrong-password tries on this screen; after a few we point to Forgot Password.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // --- Opening-screen animation values ---
  const bgOpacity = useSharedValue(0);
  const bgScale = useSharedValue(1.15);
  const overlayOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.55);

  useEffect(() => {
    // Background fades in and gently zooms out to its resting size...
    bgOpacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) });
    bgScale.value = withTiming(
      1.05,
      { duration: 1800, easing: Easing.out(Easing.cubic) },
      (finished) => {
        // ...then keeps a slow, subtle "breathing" zoom loop for as long as the screen is open.
        if (finished) {
          bgScale.value = withRepeat(
            withSequence(
              withTiming(1.12, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
              withTiming(1.05, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        }
      },
    );

    // Soft frosted overlay fades in shortly after so the illustration is visible first.
    overlayOpacity.value = withDelay(150, withTiming(1, { duration: 700 }));

    // Logo pops in after the background has started animating.
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    logoScale.value = withDelay(300, withSpring(1, { damping: 9, stiffness: 110 }));
  }, []);

  const bgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    transform: [{ scale: bgScale.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

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

  const goToForgotPassword = () => {
    if (blockIfSignedIn()) return;
    router.push({
      pathname: "/(auth)/forgot-password",
      params: { identifier: /^[A-Za-z0-9+]{4,20}$/.test(identifier.trim()) ? identifier.trim() : "" },
    });
  };

  // lib/firebase.ts throws English text; show the Tagalog version of the known one.
  const loginErrorText = (error: any) =>
    /no account found/i.test(error?.message ?? "") ? t("loginNoAccount") : t("loginInvalid");

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert(
        t("loginErrorTitle"),
        t("loginEnterBoth"),
      );
      return;
    }
    setIsLoading(true);
    try {
      await loginByIdentifier(identifier, password);
      setFailedAttempts(0);
      await refreshUser();
      router.replace("/(tabs)/home");
    } catch (error: any) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= FORGOT_PROMPT_AFTER) {
        Alert.alert(
          t("loginFailedTitle"),
          `${loginErrorText(error)}\n\n${t("loginForgotHint")}`,
          [
            { text: t("loginTryAgain"), style: "cancel" },
            { text: t("loginResetPassword"), onPress: goToForgotPassword },
          ],
        );
      } else {
        Alert.alert(t("loginFailedTitle"), loginErrorText(error));
      }
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
      {/* Animated opening background */}
      <Animated.View
        style={[StyleSheet.absoluteFill, bgAnimatedStyle]}
        pointerEvents="none"
      >
        <ExpoImage
          source={background}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, overlayAnimatedStyle]}
        pointerEvents="none"
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.backgroundTint} />
      </Animated.View>

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
        <Animated.View style={[styles.logoShadowWrapper, logoAnimatedStyle]}>
          <View style={styles.logoBorder}>
            <Image source={logo} style={styles.logo} />
          </View>
        </Animated.View>

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

                {failedAttempts >= FORGOT_PROMPT_AFTER && (
                  <View style={styles.attemptBox}>
                    <Text style={[styles.attemptText, { fontSize: 15 * fontScale }]}>
                      {t("loginTrouble")}
                    </Text>
                  </View>
                )}
                <TouchableOpacity onPress={goToForgotPassword} style={styles.forgotWrap}>
                  <Text style={[styles.forgotText, { fontSize: 15 * fontScale }]}>
                    {t("loginForgot")}
                  </Text>
                </TouchableOpacity>

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
  backgroundTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  logoShadowWrapper: {
    alignSelf: "center",
    marginBottom: 22,
    borderRadius: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 14,
  },
  logoBorder: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 5,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
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
  forgotWrap: { alignSelf: "flex-end", paddingVertical: 6, marginBottom: 4 },
  forgotText: { color: "#1D4ED8", fontWeight: "700", textDecorationLine: "underline" },
  attemptBox: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  attemptText: { color: "#7A3B00", lineHeight: 21 },
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
