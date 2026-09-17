import { Event, EventFormField } from "@/lib/firebase";
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

const getTitle = (e: Event) => e.title ?? e.Title ?? "Untitled event";
const getDescription = (e: Event) => e.description ?? e.Body ?? "";
const getLocation = (e: Event) => e.location ?? e.Location ?? "";
const getDate = (e: Event) => e.date ?? e.Date ?? "";

interface Props {
  visible: boolean;
  event: Event | null;
  submitting: boolean;
  fontScale: number;
  onClose: () => void;
  onSubmit: (responses: Record<string, string>) => void;
}

export default function EventJoinFormModal({
  visible,
  event,
  submitting,
  fontScale,
  onClose,
  onSubmit,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [displayEvent, setDisplayEvent] = useState<Event | null>(null);

  // Keeps rendering the last event's content while the sheet slides shut,
  // so the modal doesn't go blank mid-animation.
  useEffect(() => {
    if (event) setDisplayEvent(event);
  }, [event]);

  const fields: EventFormField[] = displayEvent ? (displayEvent.formFields ?? displayEvent.FormFields ?? []) : [];
  const dateLabel = displayEvent && getDate(displayEvent) ? new Date(getDate(displayEvent)).toLocaleString() : "";

  // Reset the form whenever a new event's modal opens.
  useEffect(() => {
    if (visible) setAnswers({});
  }, [visible, event?.id]);

  const setAnswer = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const requiredFields = fields.filter((f) => f.required);
  const readyToJoin = requiredFields.every((f) => answers[f.id]?.trim());

  const handleSubmit = () => {
    if (!readyToJoin) {
      const missing = requiredFields.filter((f) => !answers[f.id]?.trim());
      Alert.alert(
        "Missing Information",
        `Please fill in: ${missing.map((f) => f.label).join(", ")}`,
      );
      return;
    }
    onSubmit(answers);
  };

  if (!displayEvent) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: 20 * fontScale }]} numberOfLines={2}>
              {getTitle(displayEvent)}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.fieldsScroll} keyboardShouldPersistTaps="handled">
            {/* Everything the admin posted for this event, exactly as they set it up */}
            <View style={styles.detailsBlock}>
              {!!dateLabel && (
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color="#4B5563" />
                  <Text style={[styles.detailText, { fontSize: 15 * fontScale }]}>{dateLabel}</Text>
                </View>
              )}
              {!!getLocation(displayEvent) && (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={18} color="#4B5563" />
                  <Text style={[styles.detailText, { fontSize: 15 * fontScale }]}>{getLocation(displayEvent)}</Text>
                </View>
              )}
              {!!getDescription(displayEvent) && (
                <Text style={[styles.description, { fontSize: 15 * fontScale }]}>
                  {getDescription(displayEvent)}
                </Text>
              )}
            </View>

            {fields.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={[styles.subtitle, { fontSize: 15 * fontScale }]}>
                  Fill in the information below to join.
                </Text>

                {fields.map((field) => (
                  <View key={field.id} style={styles.fieldBlock}>
                    <Text style={[styles.fieldLabel, { fontSize: 16 * fontScale }]}>
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
                                  { fontSize: 15 * fontScale },
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
                          { fontSize: 16 * fontScale },
                        ]}
                        value={answers[field.id] ?? ""}
                        onChangeText={(v) => setAnswer(field.id, v)}
                        placeholder={field.label}
                        placeholderTextColor="#6B7280"
                        keyboardType={field.type === "number" ? "numeric" : "default"}
                        multiline={field.type === "textarea"}
                        numberOfLines={field.type === "textarea" ? 3 : 1}
                      />
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          {!readyToJoin && requiredFields.length > 0 && (
            <Text style={[styles.progressHint, { fontSize: 14 * fontScale }]}>
              {requiredFields.length - requiredFields.filter((f) => answers[f.id]?.trim()).length} of{" "}
              {requiredFields.length} required field
              {requiredFields.length === 1 ? "" : "s"} left
            </Text>
          )}

          <TouchableOpacity
            style={[styles.joinBtn, !readyToJoin && styles.joinBtnDisabled]}
            onPress={handleSubmit}
            disabled={!readyToJoin || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.joinBtnText, { fontSize: 17 * fontScale }]}>Join</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  title: { fontWeight: "800", color: "#111827", flex: 1, marginRight: 12 },
  detailsBlock: { marginBottom: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  detailText: { color: "#4B5563" },
  description: { color: "#374151", lineHeight: 20, marginTop: 4 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 },
  subtitle: { color: "#4B5563", marginBottom: 16 },
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
  progressHint: { color: "#4B5563", textAlign: "center", marginBottom: 8 },
  joinBtn: {
    backgroundColor: "#2356E1",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  // Grey while required fields are empty, blue once all are filled in.
  joinBtnDisabled: { backgroundColor: "#D1D5DB" },
  joinBtnText: { color: "#fff", fontWeight: "700" },
});
