import { Ionicons } from "@expo/vector-icons";
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

  if (currentRouteName === "upload" || currentRouteName === "scan") {
    return null;
  }

  const iconMap: any = {
    home: { label: "Home", icon: "home-outline", active: "home" },
    appointment: {
      label: "Appt",
      icon: "calendar-outline",
      active: "calendar",
    },
    medicine: { label: "Meds", icon: "medkit-outline", active: "medkit" },
    account: { label: "Account", icon: "person-outline", active: "person" }, // <-- Changed here
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
          size={24}
          color={isFocused ? "#1fcc79" : "#6B7280"}
        />
        <Text
          style={[styles.label, { color: isFocused ? "#1fcc79" : "#6B7280" }]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };
  const leftTabs = state.routes.filter(
    (r: any) => r.name === "home" || r.name === "appointment",
  );

  const rightTabs = state.routes.filter(
    (r: any) => r.name === "medicine" || r.name === "account", // <-- Changed here
  );

  return (
    <View style={[styles.wrapper, { paddingBottom }]}>
      <View style={styles.tabBar}>
        {leftTabs.map(renderTab)}

        <View style={styles.centerSlot}>
          <Text style={styles.scanLabel}>Voice assisst</Text>
        </View>

        {rightTabs.map(renderTab)}
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onScanPress}
        style={styles.scanButton}
      >
        <Ionicons name="scan-outline" size={28} color="white" />
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

          <Tabs.Screen name="appointment" options={{}} />

          <Tabs.Screen
            name="voice"
            options={{ href: null, tabBarStyle: { display: "none" } }}
          />
          <Tabs.Screen name="medicine" />
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
    backgroundColor: "white",
  },
  tabBar: {
    flexDirection: "row",
    height: 75,
    width: "100%",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
    paddingBottom: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: "Inter-Medium",
  },
  centerSlot: {
    width: 80,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  scanLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 40,
    fontFamily: "Inter-Medium",
  },
  scanButton: {
    position: "absolute",
    top: -22,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1fcc79",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
