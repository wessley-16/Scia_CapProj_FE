import "@/lib/presenceTask"; // registers the background location task
import { AuthProvider } from "@/context/AuthContext";
import { LoginPromptProvider } from "@/context/LoginPromptContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { initMonitoring, wrapRoot } from "@/lib/monitoring";
import { Slot } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

// Starts crash reporting before anything renders (no-op without a DSN / in dev).
initMonitoring();

function RootLayout() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <LoginPromptProvider>
          <Slot />
        </LoginPromptProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({});
