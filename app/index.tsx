import AsyncStorage from "@react-native-async-storage/async-storage";
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
// 🔥 Firebase — replaces http://10.174.101.153:3000/api/auth/login
import { loginUser } from "../lib/firebase";

const logo = require("../assets/images/Logo.png");

export default function Index() {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [idnum, setNscidNum] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!idnum || !password) {
      Alert.alert("Error", "Please enter both NSCID number and password.");
      return;
    }
    setIsLoading(true);
    try {
      // 🔥 Query Firestore "users" collection directly
      const user = await loginUser(idnum, password);

      // Persist useful fields locally for other screens
      await AsyncStorage.setItem("user", JSON.stringify(user));
      await AsyncStorage.setItem("userId", user.id);
      await AsyncStorage.setItem("userName", `${(user as any).firstName ?? ""} ${(user as any).lastName ?? ""}`.trim());
      await AsyncStorage.setItem("userBarangay", (user as any).barangay ?? (user as any).address ?? "");
      await AsyncStorage.setItem("userDistrict", (user as any).district ?? "");

      router.replace({
        pathname: "/(tabs)/home",
        params: user as any,
      });
    } catch (error: any) {
      Alert.alert("Login Failed", error?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.inner}>
        {/* LOGO */}
        <Image source={logo} style={styles.logo} />

        {/* LOGIN PANEL */}
        {showLogin && (
          <View style={styles.formContainer}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLogin(false)}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input} placeholder="Enter User ID"
              value={idnum} onChangeText={setNscidNum} keyboardType="numeric"
            />
            <TextInput
              style={styles.input} placeholder="Enter Password"
              value={password} onChangeText={setPassword} secureTextEntry
            />
            <View style={styles.extra}>
              <Text style={styles.forgot}>Forgot Password</Text>
            </View>
          </View>
        )}

        {/* Show Login toggle */}
        {!showLogin && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowLogin(true)}>
            <Text style={styles.primaryText}>Log In</Text>
          </TouchableOpacity>
        )}

        {/* SUBMIT */}
        {showLogin && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
            {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Submit</Text>}
          </TouchableOpacity>
        )}

        {/* SIGN UP */}
        <TouchableOpacity onPress={() => router.push("/(auth)/signup")} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Sign-up</Text>
        </TouchableOpacity>

        {/* GUEST */}
        <Text onPress={() => router.push("/(tabs)/home")} style={styles.guest}>Guest</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  logo: { width: 240, height: 240, borderRadius: 120, alignSelf: "center", marginBottom: 20, resizeMode: "contain" },
  formContainer: { width: "100%", backgroundColor: "#d8d7d7", padding: 15, paddingTop: 50, borderRadius: 10, marginBottom: 15 },
  closeBtn: { position: "absolute", top: 8, right: 10, zIndex: 1 },
  closeText: { fontSize: 24, fontWeight: "bold", color: "#000" },
  input: { backgroundColor: "#F7F9FC", padding: 12, fontSize: 18, borderRadius: 6, marginBottom: 10 },
  forgot: { fontSize: 16, color: "#000", marginBottom: 5 },
  extra: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 10 },
  primaryBtn: { width: "100%", paddingVertical: 14, marginBottom: 12, borderRadius: 10, backgroundColor: "#2563EB", alignItems: "center" },
  primaryText: { color: "white", fontSize: 24, fontWeight: "700" },
  secondaryBtn: { width: "100%", paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: "#2563EB", alignItems: "center" },
  secondaryText: { color: "#2563EB", fontSize: 24, fontWeight: "700" },
  guest: { marginTop: 20, textAlign: "center", color: "#2563EB", fontSize: 24 },
});
