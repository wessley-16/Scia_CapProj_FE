import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import { Tabs, useRouter } from "expo-router";
import React, { useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Modalize } from "react-native-modalize";
import { Host } from "react-native-portalize";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const CustomTabBar = ({
  state,
  navigation,
  onScanPress,
  onUploadPress,
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

  const iconMap: any = {
    home: { label: "Home", icon: "home-outline", active: "home" },
    account: { label: "Account", icon: "person-outline", active: "person" },
  };

  const renderTab = (route: any) => {
    const isFocused = state.routes[state.index].name === route.name;
    const item = iconMap[route.name];
    if (!item) return null;

    const onPress = () => {
      if (route.name === "upload") {
        onUploadPress();
        navigation.navigate("upload");
        return;
      }

      navigation.navigate(route.name);
    };

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        style={styles.tabItem}
      >
        <Ionicons
          name={isFocused ? item.active : item.icon}
          size={28}
          color={isFocused ? "white" : "#e4e4e4"}
        />
        <Text
          style={[styles.label, { color: isFocused ? "white" : "#e4e4e4" }]}
        >
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

        <View style={styles.centerSlot}>
          <Text style={styles.scanLabel}>Voice Assist</Text>
        </View>

        {rightTabs.map(renderTab)}
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onScanPress}
        style={styles.scanButton}
      >
        <Entypo name="mic" size={32} color="#2356E1" />
      </TouchableOpacity>
    </View>
  );
};

export default function Layout() {
  const addEventRef = useRef<Modalize>(null);
  const router = useRouter();

  const onScanPress = () => {
    router.push("/voice");
  };

  const onUploadPress = () => {
    addEventRef.current?.open();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Host>
        <Tabs
          tabBar={(props) => (
            <CustomTabBar
              {...props}
              onScanPress={onScanPress}
              onUploadPress={onUploadPress}
            />
          )}
          screenOptions={{ headerShown: false }}
        >
          <Tabs.Screen name="home" />

          <Tabs.Screen
            name="voice"
            options={{ href: null, tabBarStyle: { display: "none" } }}
          />

          <Tabs.Screen
            name="chatbot"
            options={{ href: null, tabBarStyle: { display: "none" } }}
          />

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
    backgroundColor: "#2356E1", // Matched with Tab Bar Color to cover Safe Area
  },
  tabBar: {
    flexDirection: "row",
    height: 70,
    width: "100%",
    alignItems: "center", // Align items to center vertically, centerSlot will handle its own alignment
    borderTopWidth: 1,
    borderColor: "#4672ec",
    backgroundColor: "#2356E1",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter-Medium",
    fontWeight: "600",
  },
  centerSlot: {
    width: 80,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  scanLabel: {
    fontSize: 12,
    color: "#e4e4e4",
    fontFamily: "Inter-Medium",
    textAlign: "center",
    width: "100%",
  },
  scanButton: {
    position: "absolute",
    top: -30, // Adjusted to float better
    width: 64, // Slightly smaller for better proportion
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: "#2356E1", // Matches background so it looks like a cutout if using white
    // Actually, user had white bg and blue border.
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
