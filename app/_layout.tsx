import { Stack } from "expo-router";
import { SettingsProvider } from "@/context/SettingsContext";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </SettingsProvider>
    </AuthProvider>
  );
}
