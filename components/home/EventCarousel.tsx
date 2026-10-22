// components/home/EventCarousel.tsx
import { useSettings } from "@/context/SettingsContext";
import { Event } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "@/components/ReadAloudText";
import EventDetailModal from "./EventDetailModal";
import { formatWhen, getDate, getDescription, getLocation, getTitle } from "./eventFields";
import { Palette } from "@/constants/theme";

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

export default function EventCarousel({ events, joinedEventIds, fontScale, onJoinPress }: Props) {
  const { t, colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewEvent, setViewEvent] = useState<Event | null>(null); // the open "View" popup
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

  if (events.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="information-circle-outline" size={30} color={c.link} />
        <Text style={[styles.emptyText, { fontSize: 18 * fontScale }]}>
          {t("evNone")}
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
                {getTitle(item, t("evUntitled"))}
              </Text>

              {!!dateLabel && (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar" size={22} color={c.link} />
                  <Text style={[styles.metaText, { fontSize: 17 * fontScale }]}>{dateLabel}</Text>
                </View>
              )}
              {!!getLocation(item) && (
                <View style={styles.metaRow}>
                  <Ionicons name="location" size={22} color={c.link} />
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
                {joined && (
                  <View style={styles.joinedBadge}>
                    <Ionicons name="checkmark-circle" size={22} color={c.success} />
                    <Text style={[styles.joinedText, { fontSize: 18 * fontScale }]}>{t("evJoinedThis")}</Text>
                  </View>
                )}
                {!joined && isJoinable && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => onJoinPress(item)} activeOpacity={0.85}>
                    <Text style={[styles.actionBtnText, { fontSize: 19 * fontScale }]}>{t("evJoin")}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.viewBtn]}
                  onPress={() => setViewEvent(item)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.actionBtnText, styles.viewBtnText, { fontSize: 19 * fontScale }]}>
                    {t("evReadMore")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <EventDetailModal
        event={viewEvent}
        joined={!!viewEvent && joinedEventIds.includes(viewEvent.id)}
        onClose={() => setViewEvent(null)}
        onJoin={onJoinPress}
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

const makeStyles = (c: Palette) => StyleSheet.create({
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: c.border,
  },
  emptyText: { flex: 1, color: c.link, fontWeight: "600" },
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 20,
    minHeight: 170,
    borderWidth: 2,
    borderColor: c.border,
    elevation: 3,
  },
  cardTitle: { fontWeight: "800", color: c.text, marginBottom: 12 },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  metaText: { flex: 1, color: c.textStrong, fontWeight: "600" },
  descText: { color: c.textStrong, lineHeight: 26, marginTop: 4 },
  footerRow: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  actionBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    minHeight: 56,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: c.onColor, fontWeight: "800" },
  viewBtn: { backgroundColor: c.surfaceSoft, borderWidth: 2, borderColor: c.primary },
  viewBtnText: { color: c.primary },
  joinedBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  joinedText: { color: c.success, fontWeight: "800" },
  dotsRow: { flexDirection: "row", justifyContent: "center", marginTop: 14, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.border },
  dotActive: { backgroundColor: c.primary, width: 28 },
});
