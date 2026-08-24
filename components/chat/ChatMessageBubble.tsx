// components/chat/ChatMessageBubble.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChatMessage } from "@/hooks/useChatbot";
import MarkdownText from "@/components/chat/Markdowntext";

interface ActionProps {
  label: string;
  icon: any;
  color: string;
  textColor?: string;
}

interface ChatMessageBubbleProps {
  message: ChatMessage & { time?: string; actions?: ActionProps[] };
  fontScale: number;
}

function ChatMessageBubble({ message, fontScale }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerBot]}>

      {/* ── Bot header ── */}
      {!isUser && (
        <View style={styles.header}>
          <View style={styles.botAvatar}>
            <MaterialCommunityIcons name="shield-star" size={18} color="white" />
          </View>
          <Text style={[styles.headerText, { fontSize: 11 * fontScale }]}>
            HEALTHAI ASSISTANT • {message.time || "NOW"}
          </Text>
        </View>
      )}

      {/* ── User header ── */}
      {isUser && (
        <View style={[styles.header, styles.headerUser]}>
          <Text style={[styles.headerText, { fontSize: 11 * fontScale }]}>
            YOU • {message.time || "JUST NOW"}
          </Text>
        </View>
      )}

      {/* ── Bubble ── */}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
        {isUser ? (
          <Text style={[styles.userText, { fontSize: 16 * fontScale, lineHeight: 25 * fontScale }]}>
            {message.text}
          </Text>
        ) : (
          <MarkdownText text={message.text} fontScale={fontScale} />
        )}

        {/* ── Action buttons ── */}
        {!isUser && message.actions && message.actions.length > 0 && (
          <View style={styles.actionsContainer}>
            {message.actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionBtn, { backgroundColor: action.color }]}
              >
                <MaterialCommunityIcons
                  name={action.icon}
                  size={22}
                  color={action.textColor || "#000"}
                />
                <Text style={[styles.actionBtnText, { color: action.textColor || "#000", fontSize: 13 * fontScale }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// Memoized so FlatList only re-renders bubbles whose actual content
// changed — without this, every state update anywhere in the chat (a new
// streamed chunk, a session swap, etc.) re-renders EVERY bubble in the
// list, which is what was causing the visible lag/jank.
export default memo(ChatMessageBubble, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.text === next.message.text &&
  prev.fontScale === next.fontScale,
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    marginHorizontal: 16,
    maxWidth: "88%",
  },
  containerUser: {
    alignSelf: "flex-end",
  },
  containerBot: {
    alignSelf: "flex-start",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  headerUser: {
    justifyContent: "flex-end",
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7b8fed",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  bubble: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  botBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  userBubble: {
    backgroundColor: "#1d4ed8",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  userText: {
    color: "#ffffff",
    fontWeight: "500",
  },
  actionsContainer: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionBtnText: {
    fontWeight: "600",
    textAlign: "center",
  },
});
