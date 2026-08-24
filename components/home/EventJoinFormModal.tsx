// components/home/EventJoinFormModal.tsx
import { EventFormField } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  eventTitle: string;
  fields: EventFormField[];
  submitting: boolean;
  fontScale: number;
  onClose: () => void;
  onSubmit: (responses: Record<string, string>) => void;
}

export default function EventJoinFormModal({
  visible,
  eventTitle,
  fields,
  submitting,
  fontScale,
  onClose,
  onSubmit,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Reset the form whenever a new event's modal opens.
  useEffect(() => {
    if (visible) setAnswers({});
  }, [visible, eventTitle]);

  const setAnswer = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = () => {
    const missing = fields.filter((f) => f.required && !answers[f.id]?.trim());
    if (missing.length > 0) {
      Alert.alert(
        "Missing Information",
        `Please fill in: ${missing.map((f) => f.label).join(", ")}`,
      );
      return;
    }
    onSubmit(answers);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: 19 * fontScale }]} numberOfLines={2}>
              Join: {eventTitle}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#374151" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { fontSize: 14 * fontScale }]}>
            Please fill in the information below to register for this event.
          </Text>

          <ScrollView style={styles.fieldsScroll} keyboardShouldPersistTaps="handled">
            {fields.map((field) => (
              <View key={field.id} style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { fontSize: 15 * fontScale }]}>
                  {field.label}
                  {field.required && <Text style={styles.required}> *</Text>}
                </Text>

                {field.type === "select" ? (
                  <View style={styles.optionsRow}>
                    {(field.options ?? []).map((option) => {
                      const selected = answers[field.id] === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, selected && styles.optionChipSelected]}
                          onPress={() => setAnswer(field.id, option)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              { fontSize: 14 * fontScale },
                              selected && styles.optionChipTextSelected,
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    style={[
                      styles.input,
                      field.type === "textarea" && styles.inputMultiline,
                      { fontSize: 15 * fontScale },
                    ]}
                    value={answers[field.id] ?? ""}
                    onChangeText={(v) => setAnswer(field.id, v)}
                    placeholder={field.label}
                    placeholderTextColor="#9CA3AF"
                    keyboardType={field.type === "number" ? "numeric" : "default"}
                    multiline={field.type === "textarea"}
                    numberOfLines={field.type === "textarea" ? 3 : 1}
                  />
                )}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.submitText, { fontSize: 17 * fontScale }]}>Submit & Join</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  title: { fontWeight: "800", color: "#111827", flex: 1, marginRight: 12 },
  subtitle: { color: "#6B7280", marginBottom: 16 },
  fieldsScroll: { marginBottom: 8 },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontWeight: "700", color: "#111827", marginBottom: 8 },
  required: { color: "#DC2626" },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  optionChipSelected: { backgroundColor: "#EEF2FF", borderColor: "#2356E1" },
  optionChipText: { color: "#374151", fontWeight: "600" },
  optionChipTextSelected: { color: "#2356E1" },
  submitBtn: {
    backgroundColor: "#2356E1",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "700" },
});
