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
import { useSettings } from "@/context/SettingsContext";
import { useChatbot } from "@/hooks/useChatbot";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatInputArea from "@/components/chat/ChatInputArea";
import ChatMessageBubble from "@/components/chat/ChatMessageBubble";

const AiChat = () => {
  const { messages, loading, sendMessage } = useChatbot();
  const { fontScale } = useSettings();
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ChatHeader fontScale={fontScale} />

      <FlatList
        ref={flatListRef}
        data={displayMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessageBubble message={item} fontScale={fontScale} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingContainer}>
              <ActivityIndicator size="small" color="#2b5ce6" />
              <Text style={[styles.typingText, { fontSize: 13 * fontScale }]}>HealthAI is typing...</Text>
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
        fontScale={fontScale}
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
