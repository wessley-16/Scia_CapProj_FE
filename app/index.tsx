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
      const response = await fetch(
        "http://10.174.101.153:3000/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idnum, password }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem("userName", data.user.fullName);
        await AsyncStorage.setItem("userBarangay", data.user.barangay);
        await AsyncStorage.setItem("userId", data.user.id);

        router.replace("/home");
      } else {
        Alert.alert("Login Failed", data.error || "Invalid credentials");
      }
    } catch (error) {
      Alert.alert("Network Error", "Cannot connect to server.");
    } finally {
      setIsLoading(false);
    }
  };

  /* Admin login function */
  const ADMIN_CREDENTIALS = [
    { username: "001", password: "osca111" },
    { username: "023", password: "ling123" },
    { username: "024", password: "gent124" },
  ];

  const handleAdminLogin = () => {
    if (!idnum || !password) {
      Alert.alert("Error", "Enter admin username and password.");
      return;
    }

    const match = ADMIN_CREDENTIALS.find(
      (admin) =>
        admin.username === idnum && admin.password === password
    );

    if (match) {
      Alert.alert("Success", "Admin login successful!");
      router.replace("/(admin)/dashboard");
    } else {
      Alert.alert("Error", "Invalid admin credentials.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>

      {/* LOGO */}
      <Image source={logo} style={styles.logo} />

      {/* LOGIN PANEL */}
      {showLogin && (
      <View style={styles.formContainer}>

        {/* CLOSE BUTTON */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => setShowLogin(false)}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Enter User ID"
          value={idnum}
          onChangeText={setNscidNum}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder="Enter Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View style={styles.extra}>
          <Text style={styles.forgot}>Forgot Password</Text>

          <TouchableOpacity onPress={handleAdminLogin}>
            <Text style={styles.adminLogin}>Log in as Admin</Text>
          </TouchableOpacity>
        </View>

      </View>
    )}

      {/* LOGIN BUTTON */}
      <TouchableOpacity
        onPress={() => {
          if (showLogin) {
            handleLogin(); // if already open → submit
          } else {
            setShowLogin(true); // if closed → open form
          }
        }}
        style={styles.primaryBtn}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.primaryText}>Log-in</Text>
        )}
      </TouchableOpacity>

      {/* SIGN UP */}
      <TouchableOpacity
        onPress={() => router.push("/(auth)/signup")}
        style={styles.secondaryBtn}
      >
        <Text style={styles.secondaryText}>Sign-up</Text>
      </TouchableOpacity>

      {/* GUEST */}
      <Text
        onPress={() => router.push("/(tabs)/home")}
        style={styles.guest}
      >
        Guest
      </Text>

    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },

  logo: {
    width: 240,
    height: 240,
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

  closeBtn: {
    position: "absolute",
    top: 8,
    right: 10,
    zIndex: 1,
  },

  closeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },

  input: {
    backgroundColor: "#F7F9FC",
    padding: 12,
    fontSize: 18,
    borderRadius: 6,
    marginBottom: 10,
  },
  
  adminLogin: {
    fontSize: 16,
    color: "#2563EB",
    textAlign: "right",
    marginTop: 5,
    fontWeight: "600",
  },

  forgot: {
    fontSize: 16,
    color: "#000",
    marginBottom: 5,
  },

  extra: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },

  button: {
    backgroundColor: "#2563EB",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonDisabled: {
    backgroundColor: "#93C5FD",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 24,
  },

  primaryBtn: {
    width: "100%",
    paddingVertical: 14,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
  },

  primaryText: {
    color: "white",
    fontSize: 24,
    fontWeight: "700",
  },

  secondaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
  },

  secondaryText: {
    color: "#2563EB",
    fontSize: 24,
    fontWeight: "700",
  },

  guest: {
    marginTop: 20,
    textAlign: "center",
    color: "#2563EB",
    fontSize: 24,
  },
});