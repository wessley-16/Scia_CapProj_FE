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
const CARD_WIDTH = SCREEN_WIDTH - 20; // same 10px side margins as the ID card and other Home blocks
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

// "Saturday, October 3, 2026 · 2:00 PM". If the admin typed something that is
// not a real date, show it as written instead of "Invalid Date".
const formatWhen = (raw: string) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const day = d.toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const hasTime = /\d{1,2}:\d{2}/.test(raw) || raw.includes("T");
  const time = hasTime
    ? d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })
    : "";
  return time ? `${day} · ${time}` : day;
};

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
    const dateLabel = formatWhen(getDate(event));
    const lines = [
      dateLabel && `When: ${dateLabel}`,
      getLocation(event) && `Where: ${getLocation(event)}`,
      getDescription(event),
    ].filter(Boolean);

    Alert.alert(getTitle(event), lines.join("\n\n") || "No further details.");
  };

  if (events.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="information-circle-outline" size={30} color="#12307A" />
        <Text style={[styles.emptyText, { fontSize: 18 * fontScale }]}>
          No announcements right now.
        </Text>
      </View>
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
          const dateLabel = formatWhen(getDate(item));
          const description = getDescription(item);

          return (
            <View style={[styles.card, { width: CARD_WIDTH, marginRight: CARD_SPACING }]}>
              <Text style={[styles.cardTitle, { fontSize: 22 * fontScale }]} numberOfLines={3}>
                {getTitle(item)}
              </Text>

              {!!dateLabel && (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar" size={22} color="#1D4ED8" />
                  <Text style={[styles.metaText, { fontSize: 17 * fontScale }]}>{dateLabel}</Text>
                </View>
              )}
              {!!getLocation(item) && (
                <View style={styles.metaRow}>
                  <Ionicons name="location" size={22} color="#1D4ED8" />
                  <Text style={[styles.metaText, { fontSize: 17 * fontScale }]} numberOfLines={2}>
                    {getLocation(item)}
                  </Text>
                </View>
              )}
              {!!description && (
                <Text style={[styles.descText, { fontSize: 17 * fontScale }]} numberOfLines={3}>
                  {description}
                </Text>
              )}

              <View style={styles.footerRow}>
                {joined ? (
                  <View style={styles.joinedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={[styles.joinedText, { fontSize: 18 * fontScale }]}>You joined this</Text>
                  </View>
                ) : isJoinable ? (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => onJoinPress(item)} activeOpacity={0.85}>
                    <Text style={[styles.actionBtnText, { fontSize: 19 * fontScale }]}>Join</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.viewBtn]}
                    onPress={() => showDetails(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.actionBtnText, styles.viewBtnText, { fontSize: 19 * fontScale }]}>
                      Read more
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
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: "#BFD3FF",
  },
  emptyText: { flex: 1, color: "#12307A", fontWeight: "600" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    minHeight: 170,
    borderWidth: 2,
    borderColor: "#BFD3FF",
    elevation: 3,
  },
  cardTitle: { fontWeight: "800", color: "#111827", marginBottom: 12 },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  metaText: { flex: 1, color: "#1F2937", fontWeight: "600" },
  descText: { color: "#374151", lineHeight: 26, marginTop: 4 },
  footerRow: { marginTop: 16, alignItems: "flex-start" },
  actionBtn: {
    backgroundColor: "#1D4ED8",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    minHeight: 56,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "800" },
  viewBtn: { backgroundColor: "#E0E9FF", borderWidth: 2, borderColor: "#1D4ED8" },
  viewBtnText: { color: "#1D4ED8" },
  joinedBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  joinedText: { color: "#15803D", fontWeight: "800" },
  dotsRow: { flexDirection: "row", justifyContent: "center", marginTop: 14, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#9DB5EA" },
  dotActive: { backgroundColor: "#1D4ED8", width: 28 },
});
