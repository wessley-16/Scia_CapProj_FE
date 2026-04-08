import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
const AiChat = () => {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <View style={styles.botBg}>
          <MaterialCommunityIcons
            name="robot-excited"
            size={24}
            color="white"
          />
        </View>
        <Text style={{ fontSize: 20 }}>Bading</Text>
      </View>
      <View style={styles.bubble}>
       <Text>Hello po</Text>
      </View>
    </View>
  );
};

export default AiChat;

const styles = StyleSheet.create({
  botBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#858fd3",
  },
  bubble:{
    backgroundColor: "#e0e0e0",
    shadowColor: "#000",
  }
});
