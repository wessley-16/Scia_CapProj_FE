import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import { Tabs, useRouter } from "expo-router";
import React from "react";
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

  // Only Home and Account appear as tappable tab items
  const iconMap: any = {
    home: { label: "Home", icon: "home-outline", active: "home" },
    account: { label: "Account", icon: "person-outline", active: "person" },
  };

  const renderTab = (route: any) => {
    const isFocused = state.routes[state.index].name === route.name;
    const item = iconMap[route.name];
    if (!item) return null;

    return (
      <TouchableOpacity
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tabItem}
      >
        <Ionicons
          name={isFocused ? item.active : item.icon}
          size={28}
          color={isFocused ? "white" : "#E5E7EB"}
        />
        <Text style={[styles.label, { color: isFocused ? "white" : "#E5E7EB" }]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const leftTabs = state.routes.filter((r: any) => r.name === "home");
  const rightTabs = state.routes.filter((r: any) => r.name === "account");

  return (
    <View style={[styles.wrapper, { paddingBottom }]}>
      <View style={styles.tabBar}>
        {leftTabs.map(renderTab)}

        {/* Center Voice Assist button slot */}
        <View style={styles.centerSlot}>
          <Text style={styles.scanLabel}>Voice Assist</Text>
        </View>

        {rightTabs.map(renderTab)}
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onScanPress}
        style={styles.scanButton}
        hitSlop={6}
      >
        <Entypo name="mic" size={34} color="#2356E1" />
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
  return (
    <View style={[styles.pendingWrapper, { paddingTop: insets.top + 24 }]}>
      <View style={styles.pendingCard}>
        <Text style={styles.pendingTitle}>Account Pending Verification</Text>
        <Text style={styles.pendingBody}>
          Your account has been created but is still awaiting review by an
          OSCA admin. You'll be able to access the app once it's approved.
        </Text>
        <TouchableOpacity
          style={styles.pendingButton}
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.pendingButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function Layout() {
  const router = useRouter();
  const { user, loading, isGuest, clearUser } = useAuth();

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
        <ActivityIndicator size="large" color="#2356E1" />
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

          <Tabs.Screen name="account" />
        </Tabs>
      </Host>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
    backgroundColor: "#2356E1",
  },
  tabBar: {
    flexDirection: "row",
    height: 76,
    width: "100%",
    alignItems: "center",
    borderTopWidth: 3,
    borderColor: "white",
    backgroundColor: "#2356E1",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  label: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "700",
  },
  centerSlot: {
    width: 80,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  scanLabel: {
    fontSize: 13,
    color: "#E5E7EB",
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
    borderColor: "#2356E1",
    backgroundColor: "white",
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
    backgroundColor: "#F3F4F6",
  },
  pendingWrapper: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 24,
  },
  pendingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#F59E0B",
    alignItems: "center",
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  pendingBody: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  pendingButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  pendingButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
