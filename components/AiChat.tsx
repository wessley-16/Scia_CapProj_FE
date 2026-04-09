import React, { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useChatbot } from "../hooks/useChatbot";
import ChatHeader from "./chat/ChatHeader";
import ChatInputArea from "./chat/ChatInputArea";
import ChatMessageBubble from "./chat/ChatMessageBubble";

const AiChat = () => {
  const { messages, loading, sendMessage } = useChatbot();
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 120);
    });
  }, []);

  const displayMessages = messages.map((msg, index) => {
    if (msg.role === "assistant" && msg.text.includes("prescription list")) {
      return {
        ...msg,
        actions: [
          {
            label: "View My\nPrescription",
            icon: "script-text-outline",
            color: "#fcd34d",
            textColor: "#92400e",
          },
          {
            label: "Add New\nMedication",
            icon: "plus-circle-outline",
            color: "#f3f4f6",
            textColor: "#374151",
          },
        ],
      };
    }
    return msg;
  });

  return (
    // We remove the outer <View> and make KeyboardAvoidingView the absolute root
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0} // Set to 0 because the Header is now inside
    >
      {/* Header is now inside the KeyboardAvoidingView */}
      <ChatHeader />

      <FlatList
        ref={flatListRef}
        data={displayMessages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => <ChatMessageBubble message={item} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingContainer}>
              <ActivityIndicator size="small" color="#2b5ce6" />
              <Text style={styles.typingText}>HealthAI is typing...</Text>
            </View>
          ) : null
        }
        onContentSizeChange={() => scrollToBottom()}
        onLayout={() => scrollToBottom(false)}
      />

      <ChatInputArea
        onSend={sendMessage}
        loading={loading}
        onInputFocus={() => scrollToBottom()}
      />
    </KeyboardAvoidingView>
  );
};

export default AiChat;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  listContent: {
    paddingVertical: 16,
  },
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  typingText: {
    fontSize: 13,
    color: "#4b5563",
    fontWeight: "500",
  },
});
