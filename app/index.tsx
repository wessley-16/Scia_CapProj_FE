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
      <Text style={{ fontSize: 32, fontWeight: "800", marginBottom: 12 }}>
        Welcome to SciaCare
      </Text>
      <Text style={{ fontSize: 16, textAlign: "center", color: "#546e7a", marginBottom: 32 }}>
        Your health assistant for appointments, medicine management, and voice commands.
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/(auth)/login")}
        style={{
          width: "100%",
          paddingVertical: 14,
          marginBottom: 12,
          borderRadius: 10,
          backgroundColor: "#1fcc79",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
          Get Started
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(auth)/signup")}
        style={{
          width: "100%",
          paddingVertical: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#1fcc79",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#1fcc79", fontSize: 16, fontWeight: "700" }}>
          Create an Account
        </Text>
      </TouchableOpacity>

      <Text
        onPress={() => router.push("/(tabs)/home")}
        style={{ marginTop: 20, color: "#1fcc79", fontSize: 15 }}
      >
        Continue as Guest
      </Text>
    </View>
  );
}
