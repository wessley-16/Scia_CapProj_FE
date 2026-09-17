import ChatHeader from "@/components/chat/ChatHeader";
import ChatHistoryDrawer from "@/components/chat/ChatHistoryDrawer";
import ChatInputArea from "@/components/chat/ChatInputArea";
import ChatMessageBubble from "@/components/chat/ChatMessageBubble";
import { useSettings } from "@/context/SettingsContext";
import { useChatbot } from "@/hooks/useChatbot";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

// How close to the bottom (in px) still counts as "following along".
const NEAR_BOTTOM_THRESHOLD = 120;

const AiChat = () => {
  const {
    messages,
    loading,
    sendMessage,
    sessions,
    activeSessionId,
    startNewChat,
    openSession,
    deleteSession,
  } = useChatbot();
  const { fontScale } = useSettings();
  const flatListRef = useRef<FlatList>(null);
  const [historyVisible, setHistoryVisible] = useState(false);

  // Whether the user is currently near the bottom of the list. Only then
  // do we auto-follow new content, so scrolling up to reread something
  // doesn't get yanked back down.
  const isNearBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousSessionIdRef = useRef<string | null>(null);
  // Set right before we scroll, so onContentSizeChange knows whether to
  // give it a follow-up nudge once the new bubble finishes measuring.
  const pendingScrollRef = useRef(false);

  const scrollToBottom = useCallback((animated: boolean) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  }, []);

  // Runs only when messages change or a different conversation opens,
  // never on every layout or keyboard event.
  useEffect(() => {
    const sessionChanged = activeSessionId !== previousSessionIdRef.current;
    previousSessionIdRef.current = activeSessionId;

    const priorCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (sessionChanged) {
      // Opened a different conversation (or the initial load, or a
      // brand-new chat): jump straight to its latest point, silently.
      isNearBottomRef.current = true;
      pendingScrollRef.current = true;
      scrollToBottom(false);
      return;
    }

    const grew = messages.length > priorCount;
    if (!grew) return;

    const lastMessage = messages[messages.length - 1];
    const isOwnMessage = lastMessage?.role === "user";

    if (isOwnMessage || isNearBottomRef.current) {
      pendingScrollRef.current = true;
      scrollToBottom(true);
    }
  }, [messages, activeSessionId, scrollToBottom]);

  // Follow the "typing..." indicator too, same near-bottom rule.
  useEffect(() => {
    if (loading && isNearBottomRef.current) {
      pendingScrollRef.current = true;
      scrollToBottom(true);
    }
  }, [loading, scrollToBottom]);

  // A newly-added bubble can still be mid-measurement when the effect
  // above fires. If we decided to auto-scroll, give it one silent
  // follow-up nudge once its real size is in.
  const handleContentSizeChange = useCallback(() => {
    if (pendingScrollRef.current) {
      pendingScrollRef.current = false;
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ChatHeader fontScale={fontScale} onHistoryPress={() => setHistoryVisible(true)} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatMessageBubble message={item} fontScale={fontScale} />
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingContainer}>
              <ActivityIndicator size="small" color="#2b5ce6" />
              <Text style={[styles.typingText, { fontSize: 14 * fontScale }]}>
                HealthAI is typing...
              </Text>
            </View>
          ) : null
        }
        onScroll={handleScroll}
        scrollEventThrottle={100}
        onContentSizeChange={handleContentSizeChange}
      />

      <ChatInputArea
        onSend={sendMessage}
        loading={loading}
        onInputFocus={() => scrollToBottom(true)}
        fontScale={fontScale}
      />

      <ChatHistoryDrawer
        visible={historyVisible}
        sessions={sessions}
        activeSessionId={activeSessionId}
        fontScale={fontScale}
        onClose={() => setHistoryVisible(false)}
        onNewChat={startNewChat}
        onOpenSession={openSession}
        onDeleteSession={deleteSession}
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
    color: "#4b5563",
    fontWeight: "500",
  },
});
