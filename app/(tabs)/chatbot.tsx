import AiChat from "@/components/AiChat";
import React from "react";
import {
  StyleSheet
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Chatbot() {

  return (
    <SafeAreaView >
      <AiChat />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

});