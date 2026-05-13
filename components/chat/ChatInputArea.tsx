// components/chat/ChatInputArea.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface ChatInputAreaProps {
  onSend: (message: string) => void;
  loading: boolean;
  onInputFocus?: () => void;
  fontScale: number;
}

const suggestions = [
  "What are common side effects?",
  "When is my next dose?",
  "Tips for healthy eating",
  "What is blood pressure?",
];

export default function ChatInputArea({
  onSend,
  loading,
  onInputFocus,
  fontScale,
}: ChatInputAreaProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim() && !loading) {
      onSend(text);
      setText("");
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Suggestion chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestionsContainer}
      >
        {suggestions.map((sugg, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.suggestionBadge, loading && styles.suggestionDisabled]}
            onPress={() => { if (!loading) onSend(sugg); }}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={[styles.suggestionText, { fontSize: 13 * fontScale }]}>
              {sugg}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Input row ── */}
      <View style={styles.inputRow}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, { fontSize: 16 * fontScale }]}
            placeholder="Type your health concern..."
            placeholderTextColor="#9ca3af"
            value={text}
            onChangeText={setText}
            editable={!loading}
            onSubmitEditing={handleSend}
            onFocus={onInputFocus}
            multiline
            maxLength={500}
          />
        </View>

        <TouchableOpacity
          style={styles.micButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="microphone-outline" size={26} color="#6b7280" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" style={styles.sendIcon} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  suggestionsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  suggestionBadge: {
    borderWidth: 1.5,
    borderColor: "#2356E1",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#EEF2FF",
  },
  suggestionDisabled: {
    opacity: 0.5,
  },
  suggestionText: {
    color: "#2356E1",
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 50,
    justifyContent: "center",
  },
  input: {
    color: "#1f2937",
    maxHeight: 120,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2356E1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2356E1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: "#9ca3af",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    marginLeft: 2,
  },
});
