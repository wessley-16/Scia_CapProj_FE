// components/home/EventCarousel.tsx
import { Event } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 64; // matches the app's horizontal content padding
const CARD_SPACING = 12;

interface Props {
  events: Event[];
  joinedEventIds: string[];
  fontScale: number;
  onJoinPress: (event: Event) => void;
}

const getTitle = (e: Event) => e.title ?? e.Title ?? "Untitled event";
const getDescription = (e: Event) => e.description ?? e.Body ?? "";
const getLocation = (e: Event) => e.location ?? e.Location ?? "";
const getDate = (e: Event) => e.date ?? e.Date ?? "";
const getFormFields = (e: Event) => e.formFields ?? e.FormFields ?? [];

export default function EventCarousel({ events, joinedEventIds, fontScale, onJoinPress }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_SPACING));
    if (index !== activeIndex) setActiveIndex(index);
  };

  if (events.length === 0) {
    return (
      <Text style={[styles.emptyText, { fontSize: 16 * fontScale }]}>No events available</Text>
    );
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        data={events}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={100}
        contentContainerStyle={{ paddingRight: CARD_SPACING }}
        renderItem={({ item }) => {
          const joined = joinedEventIds.includes(item.id);
          const hasForm = getFormFields(item).length > 0;
          const dateLabel = getDate(item) ? new Date(getDate(item)).toLocaleString() : "";

          return (
            <View style={[styles.card, { width: CARD_WIDTH, marginRight: CARD_SPACING }]}>
              <Text style={[styles.cardTitle, { fontSize: 19 * fontScale }]} numberOfLines={2}>
                {getTitle(item)}
              </Text>

              {!!dateLabel && (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={15} color="#6B7280" />
                  <Text style={[styles.metaText, { fontSize: 13 * fontScale }]}>{dateLabel}</Text>
                </View>
              )}
              {!!getLocation(item) && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={15} color="#6B7280" />
                  <Text style={[styles.metaText, { fontSize: 13 * fontScale }]} numberOfLines={1}>
                    {getLocation(item)}
                  </Text>
                </View>
              )}

              {!!getDescription(item) && (
                <Text style={[styles.cardDescription, { fontSize: 14 * fontScale }]} numberOfLines={3}>
                  {getDescription(item)}
                </Text>
              )}

              <View style={styles.footerRow}>
                {joined ? (
                  <View style={styles.joinedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={[styles.joinedText, { fontSize: 14 * fontScale }]}>Joined</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.joinBtn} onPress={() => onJoinPress(item)} activeOpacity={0.85}>
                    <Text style={[styles.joinBtnText, { fontSize: 15 * fontScale }]}>
                      {hasForm ? "Join — Fill Form" : "Join"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {events.length > 1 && (
        <View style={styles.dotsRow}>
          {events.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: { color: "#ffffff", opacity: 0.85 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    minHeight: 190,
  },
  cardTitle: { fontWeight: "800", color: "#111827", marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  metaText: { color: "#6B7280" },
  cardDescription: { color: "#374151", marginTop: 8, lineHeight: 20 },
  footerRow: { marginTop: 14, alignItems: "flex-start" },
  joinBtn: { backgroundColor: "#2563EB", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  joinBtnText: { color: "#fff", fontWeight: "700" },
  joinedBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  joinedText: { color: "#16A34A", fontWeight: "700" },
  dotsRow: { flexDirection: "row", justifyContent: "center", marginTop: 12, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: "#ffffff", width: 18 },
});
