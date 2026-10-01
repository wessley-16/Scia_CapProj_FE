// components/home/EventCarousel.tsx
import { Event } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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
const AUTO_ADVANCE_MS = 10000;

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

export default function EventCarousel({ events, joinedEventIds, fontScale, onJoinPress }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_SPACING));
    if (index !== activeIndex) setActiveIndex(index);
  };

  // Auto-advances to the next announcement every 10 seconds so seniors
  // don't have to swipe to see what else is posted.
  useEffect(() => {
    if (events.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % events.length;
        listRef.current?.scrollToOffset({
          offset: next * (CARD_WIDTH + CARD_SPACING),
          animated: true,
        });
        return next;
      });
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(timer);
  }, [events.length]);

  const showDetails = (event: Event) => {
    const dateLabel = getDate(event) ? new Date(getDate(event)).toLocaleString() : "";
    const lines = [
      dateLabel && `When: ${dateLabel}`,
      getLocation(event) && `Where: ${getLocation(event)}`,
      getDescription(event),
    ].filter(Boolean);

    Alert.alert(getTitle(event), lines.join("\n\n") || "No further details.");
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
          // Only editorial_health docs the admin flagged carry isJoinable.
          // Plain announcements never do, so they get a "View" button instead.
          const isJoinable = !!item.isJoinable;
          const dateLabel = getDate(item) ? new Date(getDate(item)).toLocaleString() : "";

          return (
            <View style={[styles.card, { width: CARD_WIDTH, marginRight: CARD_SPACING }]}>
              <Text style={[styles.cardTitle, { fontSize: 20 * fontScale }]} numberOfLines={2}>
                {getTitle(item)}
              </Text>

              {!!dateLabel && (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={17} color="#4B5563" />
                  <Text style={[styles.metaText, { fontSize: 15 * fontScale }]}>{dateLabel}</Text>
                </View>
              )}
              {!!getLocation(item) && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={17} color="#4B5563" />
                  <Text style={[styles.metaText, { fontSize: 15 * fontScale }]} numberOfLines={1}>
                    {getLocation(item)}
                  </Text>
                </View>
              )}

              <View style={styles.footerRow}>
                {joined ? (
                  <View style={styles.joinedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={[styles.joinedText, { fontSize: 16 * fontScale }]}>Joined</Text>
                  </View>
                ) : isJoinable ? (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => onJoinPress(item)} activeOpacity={0.85}>
                    <Text style={[styles.actionBtnText, { fontSize: 16 * fontScale }]}>Join</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.viewBtn]}
                    onPress={() => showDetails(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.actionBtnText, styles.viewBtnText, { fontSize: 16 * fontScale }]}>
                      View
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
  emptyText: { color: "#ffffff", opacity: 0.9 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    minHeight: 150,
  },
  cardTitle: { fontWeight: "800", color: "#111827", marginBottom: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  metaText: { color: "#374151" },
  footerRow: { marginTop: 12, alignItems: "flex-start" },
  actionBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 48,
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "700" },
  viewBtn: { backgroundColor: "#EEF2FF" },
  viewBtnText: { color: "#2563EB" },
  joinedBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  joinedText: { color: "#16A34A", fontWeight: "700" },
  dotsRow: { flexDirection: "row", justifyContent: "center", marginTop: 14, gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: "#ffffff", width: 20 },
});
