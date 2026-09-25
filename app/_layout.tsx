import { AuthProvider } from "@/context/AuthContext";
import { Slot } from "expo-router";
import React from 'react';
import { StyleSheet } from 'react-native';

export default function _layout() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({})