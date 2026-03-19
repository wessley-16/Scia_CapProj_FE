import { useChatbot } from "@/hooks/useChatbot";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChatScreen() {
  const { messages, sendMessage, loading } = useChatbot();
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    await sendMessage(input);
    setInput("");

    // Auto scroll to the bottom when a new message is sent
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Let iOS use padding, but let Android natively handle its own keyboard
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* CHAT LIST */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          // This allows you to tap the input box even if a keyboard is already open
          keyboardShouldPersistTaps="handled" 
          contentContainerStyle={styles.chatContainer}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageRow,
                item.role === "user" ? styles.userRow : styles.aiRow,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  item.role === "user" ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text 
                  style={[
                    styles.text, 
                    item.role === "user" ? { color: "#FFFFFF" } : { color: "#111827" }
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          )}
        />

        {/* TYPING INDICATOR */}
        {loading && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>Assistant is typing...</Text>
          </View>
        )}

        {/* INPUT BAR */}
        <View style={styles.inputWrapper}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message assistant..."
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            multiline
          />

          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F9",
  },
  chatContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: "row",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  aiRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: "#2356E1", // Valenzuela Blue
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  text: {
    fontSize: 15,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingText: {
    fontSize: 13,
    color: "#6B7280",
    fontStyle: "italic",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 15,
    maxHeight: 100,
    color: "#000000", // Forces the typed text to be black so you can actually see it!
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: "#2356E1",
    padding: 12,
    borderRadius: 12,
  },
});