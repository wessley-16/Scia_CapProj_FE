import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function Index() {
  const router = useRouter(); // Renamed to 'router' (common convention)

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TouchableOpacity
        onPress={() => router.push("/home")}
        style={{ padding: 10, backgroundColor: "#eee", marginBottom: 10 }}
      >
        <Text>Go to Home Tab</Text>
      </TouchableOpacity>

      <Text>Edit app/index.tsx to edit this screen.</Text>
    </View>
  );
}
