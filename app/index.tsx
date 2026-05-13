import { useAuth } from "@/context/AuthContext";
import { loginByIdentifier } from "@/lib/firebase";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const logo = require("../assets/images/Logo.png");

export default function Index() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert(
        "Error",
        "Please enter your ID number, full name, or phone number and password.",
      );
      return;
    }
    setIsLoading(true);
    try {
      await loginByIdentifier(identifier, password);
      await refreshUser();
      router.replace("/(tabs)/home");
    } catch (error: any) {
      Alert.alert("Login Failed", error?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Image source={logo} style={styles.logo} />

        {showLogin && (
          <View style={styles.formContainer}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowLogin(false)}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="ID Number, Full Name, or Phone Number"
              placeholderTextColor="#888"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                💡 You can log in using your:
              </Text>
              <Text style={styles.hintItem}>• 6-digit OSCA ID number</Text>
              <Text style={styles.hintItem}>• Phone number (e.g. 09955015206)</Text>
              <Text style={styles.hintItem}>• Full name (e.g. Juan Santos Cruz)</Text>
              <Text style={styles.hintItem}>• First + Last name (e.g. Juan Cruz)</Text>
            </View>
          </View>
        )}

        {!showLogin && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setShowLogin(true)}
          >
            <Text style={styles.primaryText}>Log In</Text>
          </TouchableOpacity>
        )}

        {showLogin && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryText}>Submit</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.push("/(auth)/signup")}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryText}>Sign-up</Text>
        </TouchableOpacity>

        <Text onPress={() => router.push("/(tabs)/home")} style={styles.guest}>
          Guest
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  logo: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignSelf: "center",
    marginBottom: 20,
    resizeMode: "contain",
  },
  formContainer: {
    width: "100%",
    backgroundColor: "#d8d7d7",
    padding: 15,
    paddingTop: 50,
    borderRadius: 10,
    marginBottom: 15,
  },
  closeBtn: { position: "absolute", top: 8, right: 10, zIndex: 1 },
  closeText: { fontSize: 24, fontWeight: "bold", color: "#000" },
  input: {
    backgroundColor: "#F7F9FC",
    padding: 12,
    fontSize: 16,
    borderRadius: 6,
    marginBottom: 10,
    color: "#111",
  },
  hintBox: { marginTop: 4, marginBottom: 6, gap: 3 },
  hintText: { fontSize: 13, color: "#555", lineHeight: 20, fontWeight: "600" },
  hintItem: { fontSize: 12, color: "#666", lineHeight: 18, paddingLeft: 4 },
  primaryBtn: {
    width: "100%",
    paddingVertical: 14,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
  },
  primaryText: { color: "white", fontSize: 24, fontWeight: "700" },
  secondaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
  },
  secondaryText: { color: "#2563EB", fontSize: 24, fontWeight: "700" },
  guest: { marginTop: 20, textAlign: "center", color: "#2563EB", fontSize: 24 },
});
