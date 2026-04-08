import AiChat from "@/components/AiChat";
import React from "react";
import {
  StyleSheet
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Chatbot() {

  const avatarSource =
    typeof params.image === "string"
      ? { uri: params.image }
      : { uri: "https://via.placeholder.com/150" };

  return (
    <SafeAreaView >
      <AiChat />

    </SafeAreaView>
  );
}

/* 🔹 BUTTON COMPONENT */
function ActionButton({
  title,
  subtitle,
  icon,
  color,
  onPress,
}: any) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons name={icon} size={28} color="#fff" />

      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.buttonTitle}>{title}</Text>
        <Text style={styles.buttonSub}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={22} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({

});