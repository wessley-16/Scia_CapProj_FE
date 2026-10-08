import "@/lib/presenceTask"; // registers the background location task
import { AuthProvider } from "@/context/AuthContext";
import { LoginPromptProvider } from "@/context/LoginPromptContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Slot } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

export default function _layout() {
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

const styles = StyleSheet.create({});
