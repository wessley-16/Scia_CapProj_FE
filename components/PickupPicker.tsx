// components/PickupPicker.tsx
//
// Two pieces used by the physical-ID flow:
//   <OfficeStatusBanner/>  live OSCA office status: Open now / On break / Closed,
//                          the office hours and the staff's note (e.g. "Back at 1 PM").
//   <PickupPicker/>        the senior picks ONE day and time at City Hall. Each time
//                          shows how many seats are left (live). Full or past times are
//                          greyed out. The server checks the capacity again on booking.
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSettings } from "@/context/SettingsContext";
import {
  bookableDates,
  effectiveOfficeStatus,
  formatDateShort,
  formatOfficeHours,
  formatPickup,
  formatTime12,
  isSlotInFuture,
  OfficeSettings,
  Pickup,
  slotTimes,
  subscribeToPickupCounts,
} from "@/lib/pickup";

const C = {
  primary: "#1A56C4",
  primaryLight: "#EBF2FF",
  text: "#111827",
  textSub: "#4B5563",
  textMuted: "#6B7280",
  border: "#D1D5DB",
  card: "#FFFFFF",
};

const STATE_STYLE = {
  open: { bg: "#ECFDF5", fg: "#047857", icon: "checkmark-circle" },
  break: { bg: "#FFFBEB", fg: "#B45309", icon: "cafe" },
  closed: { bg: "#FEF2F2", fg: "#B91C1C", icon: "close-circle" },
  outside: { bg: "#F3F4F6", fg: "#4B5563", icon: "time" },
} as const;

export function OfficeStatusBanner({ office, fontScale = 1 }: { office: OfficeSettings; fontScale?: number }) {
  const { t } = useSettings();
  const { state, note } = effectiveOfficeStatus(office);
  const st = STATE_STYLE[state];
  const label =
    state === "open" ? t("pkOpen") : state === "break" ? t("pkBreak") : state === "closed" ? t("pkClosed") : t("pkOutside");

  return (
    <View style={[s.banner, { backgroundColor: st.bg }]}>
      <Ionicons name={st.icon as any} size={26} color={st.fg} />
      <View style={s.bannerText}>
        <Text style={[s.bannerTitle, { color: st.fg, fontSize: 16 * fontScale }]}>
          {t("pkOfficeLabel")}: {label}
        </Text>
        {!!note && <Text style={[s.bannerNote, { fontSize: 14 * fontScale }]}>{note}</Text>}
        <Text style={[s.bannerNote, { fontSize: 14 * fontScale }]}>{formatOfficeHours(office)}</Text>
        <Text style={[s.bannerNote, { fontSize: 14 * fontScale }]}>{office.location}</Text>
      </View>
    </View>
  );
}

export default function PickupPicker({
  office,
  value,
  onChange,
  ownSlot,
  fontScale = 1,
}: {
  office: OfficeSettings;
  value: { date: string; time: string } | null;
  onChange: (v: { date: string; time: string }) => void;
  /** The seat this request already holds, so it is not shown as taken. */
  ownSlot?: Pickup | null;
  fontScale?: number;
}) {
  const { t } = useSettings();
  const dates = bookableDates(office, 14);
  const times = slotTimes(office.schedule);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const selectedDate = value?.date || "";

  useEffect(() => {
    if (!selectedDate) {
      setCounts({});
      return undefined;
    }
    return subscribeToPickupCounts(selectedDate, setCounts);
  }, [selectedDate]);

  if (!dates.length) {
    return (
      <View style={[s.banner, { backgroundColor: "#FFFBEB" }]}>
        <Ionicons name="alert-circle" size={24} color="#B45309" />
        <Text style={[s.bannerNote, { flex: 1, fontSize: 15 * fontScale, color: "#92400E" }]}>{t("pkNoDays")}</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[s.heading, { fontSize: 15 * fontScale }]}>{t("pkDay")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayRow}>
        {dates.map((d) => {
          const active = selectedDate === d;
          return (
            <TouchableOpacity
              key={d}
              activeOpacity={0.85}
              onPress={() => onChange({ date: d, time: value?.date === d ? value.time : "" })}
              style={[s.dayBtn, active && s.activeBtn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.dayText, { fontSize: 15 * fontScale }, active && s.activeText]}>{formatDateShort(d)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!!selectedDate && (
        <>
          <Text style={[s.heading, { fontSize: 15 * fontScale, marginTop: 14 }]}>{t("pkTime")}</Text>
          <View style={s.timeGrid}>
            {times.map((tm) => {
              const isOwn = !!ownSlot && ownSlot.date === selectedDate && ownSlot.time === tm;
              const left = office.schedule.capacityPerSlot - (counts[tm] || 0) + (isOwn ? 1 : 0);
              const disabled = left <= 0 || !isSlotInFuture(selectedDate, tm);
              const active = value?.time === tm;
              return (
                <TouchableOpacity
                  key={tm}
                  disabled={disabled}
                  activeOpacity={0.85}
                  onPress={() => onChange({ date: selectedDate, time: tm })}
                  style={[s.timeBtn, active && s.activeBtn, disabled && s.disabledBtn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled }}
                >
                  <Text style={[s.timeText, { fontSize: 16 * fontScale }, active && s.activeText, disabled && s.disabledText]}>
                    {formatTime12(tm)}
                  </Text>
                  <Text style={[s.seatText, { fontSize: 14 * fontScale }, active && { color: "#DBEAFE" }, disabled && s.disabledText]}>
                    {left <= 0 ? t("pkFull") : t("pkSeatsLeft", { n: left })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {!!value?.date && !!value?.time && (
        <View style={s.selectedBox}>
          <Ionicons name="calendar" size={20} color={C.primary} />
          <Text style={[s.selectedText, { fontSize: 15 * fontScale }]}>
            {t("pkSelected", { when: formatPickup(value) })}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 14, marginBottom: 14 },
  bannerText: { flex: 1 },
  bannerTitle: { fontWeight: "800" },
  bannerNote: { color: C.textSub, marginTop: 3, lineHeight: 20 },
  heading: { fontWeight: "800", color: C.text, marginBottom: 8 },
  dayRow: { gap: 8, paddingRight: 8 },
  dayBtn: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontWeight: "700", color: C.text },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeBtn: {
    width: "31.5%",
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  timeText: { fontWeight: "800", color: C.text },
  seatText: { color: C.textMuted, marginTop: 2 },
  activeBtn: { backgroundColor: C.primary, borderColor: C.primary },
  activeText: { color: "#fff" },
  disabledBtn: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
  disabledText: { color: "#6B7280" },
  selectedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
  },
  selectedText: { flex: 1, fontWeight: "700", color: C.primary },
});
