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
}

const suggestions = ["When is my next dose?", "Side effects of Metformin"];

export default function ChatInputArea({
  onSend,
  loading,
  onInputFocus,
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
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type your health concern..."
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          editable={!loading}
          onSubmitEditing={handleSend}
          onFocus={onInputFocus}
        />
        <TouchableOpacity style={styles.micButton}>
          <MaterialCommunityIcons
            name="microphone-outline"
            size={24}
            color="#6b7280"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() || loading) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name="send"
              size={18}
              color="#fff"
              style={styles.sendIcon}
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestionsContainer}
      >
        {suggestions.map((sugg, i) => (
          <TouchableOpacity
            key={i}
            style={styles.suggestionBadge}
            onPress={() => {
              if (!loading) {
                onSend(sugg);
              }
            }}
            disabled={loading}
          >
            <Text style={styles.suggestionText}>"{sugg}"</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
    paddingVertical: 8,
  },
  micButton: {
    padding: 8,
  },
  sendButton: {
    backgroundColor: "#2b5ce6",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  sendButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  sendIcon: {
    marginLeft: 2,
    marginTop: 2,
  },
  suggestionsContainer: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  suggestionBadge: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  suggestionText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
});
