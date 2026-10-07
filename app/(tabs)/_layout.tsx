import { useAuth } from "@/context/AuthContext";
import { Palette } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { usePresence } from "@/hooks/usePresence";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import { Tabs, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Host } from "react-native-portalize";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CustomTabBar = ({
  state,
  navigation,
  onScanPress,
}: any) => {
  const insets = useSafeAreaInsets();
  const { t, colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const paddingBottom = insets.bottom > 0 ? insets.bottom : 15;

  const currentRouteName = state.routes[state.index].name;

  if (
    currentRouteName === "upload" ||
    currentRouteName === "scan" ||
    currentRouteName === "chatbot" ||
    currentRouteName === "voice"
  ) {
    return null;
  }

  // Four big, labeled destinations around the voice button. SOS is part of the
  // bar so emergency help is on screen at all times and never scrolls away.
  const iconMap: any = {
    home: { label: t("tabHome"), icon: "home-outline", active: "home" },
    healthcare: { label: t("tabHealth"), icon: "medkit-outline", active: "medkit" },
    emergency: { label: t("tabSos"), icon: "alert-circle-outline", active: "alert-circle", sos: true },
    account: { label: t("tabAccount"), icon: "person-outline", active: "person" },
  };

  const renderTab = (route: any) => {
    const isFocused = state.routes[state.index].name === route.name;
    const item = iconMap[route.name];
    if (!item) return null;

    if (item.sos) {
      return (
        <TouchableOpacity
          key={route.key}
          onPress={() => navigation.navigate(route.name)}
          style={styles.tabItem}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("sosTabA11y")}
        >
          <View style={[styles.sosTab, isFocused && styles.sosTabActive]}>
            <Ionicons name="alert-circle" size={26} color={c.onColor} />
            <Text style={styles.sosText}>{item.label}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tabItem}
        accessibilityRole="button"
        accessibilityLabel={item.label}
      >
        <Ionicons
          name={isFocused ? item.active : item.icon}
          size={28}
          color={isFocused ? c.onColor : c.onColorMuted}
        />
        <Text style={[styles.label, { color: isFocused ? c.onColor : c.onColorMuted }]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const byName = (names: string[]) =>
    names.map((n) => state.routes.find((r: any) => r.name === n)).filter(Boolean);
  const leftTabs = byName(["home", "healthcare"]);
  const rightTabs = byName(["emergency", "account"]);

  return (
    <View style={[styles.wrapper, { paddingBottom }]}>
      <View style={styles.tabBar}>
        {leftTabs.map(renderTab)}

        {/* Center Voice Assist button slot */}
        <View style={styles.centerSlot}>
          <Text style={styles.scanLabel}>{t("tabVoice")}</Text>
        </View>

        {rightTabs.map(renderTab)}
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onScanPress}
        style={styles.scanButton}
        hitSlop={6}
      >
        <Entypo name="mic" size={34} color={c.primary} />
      </TouchableOpacity>
    </View>
  );
};

// Shown instead of the tab navigator when a real (non-guest) account exists
// in Firestore but hasn't been approved by an admin yet. Without this check,
// `router.replace("/(tabs)/home")` after signup/login sent everyone straight
// into the app regardless of `isVerified`, so the "pending verification"
// notice on the signup screen was never actually enforced anywhere.
const PendingVerificationScreen = ({ onLogout }: { onLogout: () => void }) => {
  const insets = useSafeAreaInsets();
  const { t, colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.pendingWrapper, { paddingTop: insets.top + 24 }]}>
      <View style={styles.pendingCard}>
        <Text style={styles.pendingTitle}>{t("pendingTitle")}</Text>
        <Text style={styles.pendingBody}>
          {t("pendingBody")}
        </Text>
        <TouchableOpacity
          style={styles.pendingButton}
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.pendingButtonText}>{t("logOutBtn")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function Layout() {
  const router = useRouter();
  const { user, loading, isGuest, clearUser } = useAuth();
  const { colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  usePresence(); // Safety Monitoring heartbeat + "Are you safe?" prompt

  const onScanPress = () => {
    router.push("/voice" as any);
  };

  const handleLogout = () => {
    clearUser();
    router.replace("/");
  };

  // Auth state is still resolving (e.g. right after signup/login) — avoid a
  // flash of the pending screen or the tabs before we actually know status.
  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  // Guests never went through registration, so there's no verification
  // status to gate on. Only block real accounts that are still PENDING.
  if (user && !isGuest && !user.isVerified) {
    return <PendingVerificationScreen onLogout={handleLogout} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Host>
        <Tabs
          tabBar={(props) => (
            <CustomTabBar
              {...props}
              onScanPress={onScanPress}
            />
          )}
          screenOptions={{ headerShown: false }}
        >
          <Tabs.Screen name="home" />

          {/* Healthcare is now a hidden route, still navigable from home buttons */}
          <Tabs.Screen
            name="healthcare"
            options={{ href: null }}
          />

          <Tabs.Screen
            name="voice"
            options={{ href: null, tabBarStyle: { display: "none" } }}
          />

          <Tabs.Screen
            name="chatbot"
            options={{ href: null, tabBarStyle: { display: "none" } }}
          />

          <Tabs.Screen
            name="settings"
            options={{ href: null, tabBarStyle: { display: "none" } }}
          />

          {/* Hidden legacy screens, kept so existing links don't break */}
          <Tabs.Screen name="govdocs" options={{ href: null }} />
          <Tabs.Screen name="emergency" options={{ href: null }} />
          <Tabs.Screen name="help" options={{ href: null }} />

          <Tabs.Screen name="account" />
        </Tabs>
      </Host>
    </GestureHandlerRootView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
    backgroundColor: c.primary,
  },
  tabBar: {
    flexDirection: "row",
    height: 76,
    width: "100%",
    alignItems: "center",
    borderTopWidth: 3,
    borderColor: c.surface,
    backgroundColor: c.primary,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  label: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: "700",
  },
  sosTab: {
    minWidth: 62,
    minHeight: 58,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: c.danger,
    borderWidth: 2,
    borderColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  sosTabActive: { backgroundColor: c.danger },
  sosText: { color: c.onColor, fontSize: 15, fontWeight: "900", letterSpacing: 0.5, marginTop: -2 },
  centerSlot: {
    width: 80,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  scanLabel: {
    fontSize: 15,
    color: c.onColorMuted,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  scanButton: {
    position: "absolute",
    top: -32,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: c.primary,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  loadingWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceAlt,
  },
  pendingWrapper: {
    flex: 1,
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: 24,
  },
  pendingCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: c.warning,
    alignItems: "center",
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.text,
    textAlign: "center",
    marginBottom: 12,
  },
  pendingBody: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  pendingButton: {
    backgroundColor: c.primaryStrong,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  pendingButtonText: {
    color: c.onColor,
    fontWeight: "700",
    fontSize: 16,
  },
});
