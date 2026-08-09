// components/chat/ChatHistoryDrawer.tsx
import { ChatSession } from "@/hooks/useChatbot";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  sessions: ChatSession[];
  activeSessionId: string;
  fontScale: number;
  onClose: () => void;
  onNewChat: () => void;
  onOpenSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ChatHistoryDrawer({
  visible,
  sessions,
  activeSessionId,
  fontScale,
  onClose,
  onNewChat,
  onOpenSession,
  onDeleteSession,
}: Props) {
  const handleDelete = (session: ChatSession) => {
    Alert.alert(
      "Delete Conversation",
      `Delete "${session.title}"? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDeleteSession(session.id),
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontSize: 20 * fontScale }]}>
            Chat History
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color="#374151" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={() => {
            onNewChat();
            onClose();
          }}
          activeOpacity={0.85}
        >
          <View style={styles.newChatIcon}>
            <Ionicons name="add" size={20} color="#fff" />
          </View>
          <Text style={[styles.newChatText, { fontSize: 16 * fontScale }]}>
            New Chat
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { fontSize: 12 * fontScale }]}>
          RECENT CONVERSATIONS
        </Text>

        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isActive = item.id === activeSessionId;
            return (
              <TouchableOpacity
                style={[styles.sessionRow, isActive && styles.sessionRowActive]}
                onPress={() => {
                  onOpenSession(item.id);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={20}
                  color={isActive ? "#2356E1" : "#9ca3af"}
                  style={styles.sessionIcon}
                />
                <View style={styles.sessionTextBlock}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.sessionTitle,
                      { fontSize: 15 * fontScale },
                      isActive && styles.sessionTitleActive,
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.sessionTime, { fontSize: 12 * fontScale }]}>
                    {formatRelativeTime(item.updatedAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Delete conversation"
                >
                  <Ionicons name="trash-outline" size={18} color="#d1d5db" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontWeight: "800", color: "#111827" },
  closeBtn: { padding: 6 },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "#2356E1",
  },
  newChatIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2356E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  newChatText: { color: "#2356E1", fontWeight: "700" },
  sectionLabel: {
    color: "#9ca3af",
    fontWeight: "700",
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
  },
  sessionRowActive: { backgroundColor: "#EEF2FF" },
  sessionIcon: { marginRight: 12 },
  sessionTextBlock: { flex: 1 },
  sessionTitle: { color: "#374151", fontWeight: "500" },
  sessionTitleActive: { color: "#111827", fontWeight: "700" },
  sessionTime: { color: "#9ca3af", marginTop: 2 },
  deleteBtn: { padding: 6, marginLeft: 8 },
});
