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
import { useChatbot } from "@/hooks/useChatbot";

export default function ChatScreen() {
  const { messages, sendMessage, loading } = useChatbot();
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    await sendMessage(input);
    setInput("");

    // Auto scroll
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Chat Assistant</Text>
        </View>

        {/* CHAT LIST */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
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
                  item.role === "user"
                    ? styles.userBubble
                    : styles.aiBubble,
                ]}
              >
                <Text
                  style={[
                    styles.text,
                    item.role === "user"
                      ? styles.userText
                      : styles.aiText,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          )}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* TYPING */}
        {loading && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>Assistant is typing...</Text>
          </View>
        )}

        {/* INPUT */}
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
  container: { flex: 1, backgroundColor: "#F4F6F9" },

  headerContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },

  chatContainer: {
    padding: 16,
    paddingBottom: 100,
  },

  messageRow: {
    marginBottom: 12,
    flexDirection: "row",
  },
  userRow: { justifyContent: "flex-end" },
  aiRow: { justifyContent: "flex-start" },

  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
  },

  userBubble: {
    backgroundColor: "#2356E1",
    borderBottomRightRadius: 4,
  },

  aiBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  text: { fontSize: 15 },
  userText: { color: "#FFFFFF" },
  aiText: { color: "#111827" },

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
    color: "#000",
  },

  sendBtn: {
    marginLeft: 8,
    backgroundColor: "#2356E1",
    padding: 12,
    borderRadius: 12,
  },
});