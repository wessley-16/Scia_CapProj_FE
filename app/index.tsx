import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function Index() {
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: "#F7F9FC",
      }}
    >
      <Text style={{ fontSize: 40, fontWeight: "800", marginBottom: 12 }}>
        WELCOME TO SCIA
      </Text>
      <Text style={{ fontSize: 20, textAlign: "center", color: "#000000", marginBottom: 32 }}>
        Your AI-powered mobile assistant for senior citizen welfare in Valenzuela City.
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/(auth)/login")}
        style={{
          width: "100%",
          paddingVertical: 14,
          marginBottom: 12,
          borderRadius: 10,
          backgroundColor: "#2563EB",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 24, fontWeight: "700" }}>
          LogIn your Account
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(auth)/signup")}
        style={{
          width: "100%",
          paddingVertical: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#2563EB",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#2563EB", fontSize: 24, fontWeight: "700" }}>
          Sign Up an Account
        </Text>
      </TouchableOpacity>

      <Text
        onPress={() => router.push("/(tabs)/home")}
        style={{ marginTop: 20, color: "#2563EB", fontSize: 24 }}
      >
        Continue as Guest
      </Text>
    </View>
  );
}
