import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChatMessage } from "../../hooks/useChatbot";

interface ActionProps {
  label: string;
  icon: any;
  color: string;
  textColor?: string;
}

interface ChatMessageBubbleProps {
  message: ChatMessage & { time?: string; actions?: ActionProps[] };
}

export default function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.containerUser : styles.containerBot,
      ]}
    >
      {!isUser && (
        <View style={styles.header}>
          <View style={styles.botAvatar}>
            <MaterialCommunityIcons
              name="shield-star"
              size={16}
              color="white"
            />
          </View>
          <Text style={styles.headerText}>
            HEALTHAI ASSISTANT • {message.time || "NOW"}
          </Text>
        </View>
      )}

      {isUser && (
        <View style={[styles.header, styles.headerUser]}>
          <Text style={styles.headerText}>
            YOU • {message.time || "2 MIN AGO"}
          </Text>
        </View>
      )}

      <View
        style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}
      >
        <Text style={[styles.text, isUser ? styles.userText : styles.botText]}>
          {message.text}
        </Text>

        {/* Action Buttons (Mockup for bot messages like the design) */}
        {!isUser && message.actions && message.actions.length > 0 && (
          <View style={styles.actionsContainer}>
            {message.actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionBtn, { backgroundColor: action.color }]}
              >
                <MaterialCommunityIcons
                  name={action.icon}
                  size={20}
                  color={action.textColor || "#000"}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: action.textColor || "#000" },
                  ]}
                >
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

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    marginHorizontal: 16,
    maxWidth: "85%",
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#7b8fed",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
  },
  bubble: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  botBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: "#1d4ed8",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  botText: {
    color: "#374151",
  },
  userText: {
    color: "#ffffff",
  },
  actionsContainer: {
    flexDirection: "row",
    marginTop: 16,
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
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
