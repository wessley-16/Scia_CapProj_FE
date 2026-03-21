import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const [idnum, setNscidNum] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // 1. Basic validation
    if (!idnum || !password) {
      Alert.alert("Error", "Please enter both NSCID number and password.");
      return;
    }

    setIsLoading(true);

    try {
      // ⚠️ CRITICAL: Replace "192.168.1.XXX" with your laptop's actual IPv4 address!
      const BACKEND_URL = "http://10.174.101.153:3000/api/auth/login";

      // 2. Send the login request to your Node.js server
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idnum, password }),
      });

      const data = await response.json();

      // 3. Handle the server's response
      if (response.ok) {
        // Save the user's details to the phone's memory so other screens can use them
        await AsyncStorage.setItem("userName", data.user.fullName);
        await AsyncStorage.setItem("userBarangay", data.user.barangay);
        await AsyncStorage.setItem("userId", data.user.id);
        
        // Push the user to the main app!
        router.replace("/home"); 
      } else {
        // If password is wrong or email doesn't exist
        Alert.alert("Login Failed", data.error || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login Error:", error);
      Alert.alert("Network Error", "Could not connect to the Valenzuela Senior Server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.formContainer}>
        <Text style={styles.title}>Welcome Back</Text>

        <TextInput
          style={styles.input}
          placeholder="NSCID Number"
          value={idnum}
          onChangeText={setNscidNum}
          keyboardType="numeric"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    padding: 20,
  },
  formContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, 
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 15,
    fontSize: 20,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#fafafa",
  },
  button: {
    backgroundColor: "#2563EB", // Updated to match your Valenzuela Blue!
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: "#93C5FD", // Lighter blue when loading
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 20,
  },
});