import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Slot } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

export default function _layout() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({});
