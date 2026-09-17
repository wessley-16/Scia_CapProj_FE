// app/_layout.tsx
//
// The AbortSignal.any polyfill must be the FIRST thing the app imports.
// lib/polyfills.ts already existed in the repo but was never imported
// anywhere, so streaming chat replies could throw on Hermes.
import "@/lib/polyfills";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

function RootLayoutNav() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <RootLayoutNav />
      </SettingsProvider>
    </AuthProvider>
  );
}
