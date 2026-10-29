// components/AccessibilityFab.tsx
//
// THE one accessibility button (it replaces the "Wika at Font" pill on the welcome screen
// and the old eye button). It shows an eye icon AND a word ("Wika at Font" / "Language & Font"),
// so a senior can tell what it does without guessing. It opens the Accessibility panel:
// language, text size, colour mode, read aloud and "explain this page".
//
// Staying out of the way:
//  - It starts in a spot chosen per screen (see SPOTS) so it does not sit on that screen's own
//    buttons: top-right on the welcome screen, bottom-left on Healthcare (camera button is on
//    the right), bottom-right everywhere else.
//  - After a few seconds the word folds away and only the round icon is left. The word comes
//    back whenever you open another screen.
//  - It can be dragged anywhere along the screen and snaps to the nearest side. The place the
//    person picks is remembered and used on every screen.
//  - A small speaker badge shows when "read aloud" is on.
// Hidden on the two AI screens, which have their own controls at the bottom.
import AccessibilityPanel from "@/components/AccessibilityPanel";
import { Text } from "@/components/ReadAloudText";
import { useSettings } from "@/context/SettingsContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Tuning (change these, nothing else) ──────────────────────────────────
const HIDE_ON = ["voice", "chatbot"];
const HEIGHT = 56;
const MARGIN = 14; // distance from the screen edge
const COLLAPSE_AFTER_MS = 8000; // word folds away after this long; set 0 to always show the word
const STORAGE_KEY = "a11yFabPos_v1";

type Side = "left" | "right";
type Spot = { side: Side; top?: number; bottom?: number }; // top: px below the status bar, bottom: px above the nav bar

// Where the button starts, per screen (last part of the route). Anything not listed uses DEFAULT_SPOT.
const SPOTS: Record<string, Spot> = {
  index: { side: "right", top: 10 }, // welcome screen: where the old "Wika at Font" pill was
  healthcare: { side: "left", bottom: 100 }, // the camera button is bottom-right on this screen
};
const DEFAULT_SPOT: Spot = { side: "right", bottom: 92 };

type Saved = { side: Side; yFrac: number };

export default function AccessibilityFab() {
  const { t, colors: c, fontScale, readAloud } = useSettings();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const pathname = usePathname();
  const routeKey = String(pathname || "").split("/").filter(Boolean).pop() || "index";

  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // ── where the button should sit ────────────────────────────────────────
  const minTop = insets.top + 6;
  const maxTop = H - insets.bottom - HEIGHT - 6;
  const clampTop = useCallback((y: number) => Math.min(Math.max(y, minTop), maxTop), [minTop, maxTop]);

  const spot = SPOTS[routeKey] ?? DEFAULT_SPOT;
  const side: Side = saved?.side ?? spot.side;
  const targetTop = clampTop(
    saved
      ? saved.yFrac * H
      : spot.top != null
        ? insets.top + spot.top
        : H - insets.bottom - (spot.bottom ?? 92) - HEIGHT,
  );

  // ── animated values ────────────────────────────────────────────────────
  const topAnim = useRef(new Animated.Value(targetTop)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const labelAnim = useRef(new Animated.Value(1)).current;
  const topNow = useRef(targetTop);
  const widthNow = useRef(HEIGHT);

  // remembered position
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw);
        if ((p?.side === "left" || p?.side === "right") && typeof p?.yFrac === "number") setSaved(p);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // glide to the new spot when the screen (or the remembered position) changes
  useEffect(() => {
    topNow.current = targetTop;
    Animated.timing(topAnim, { toValue: targetTop, duration: 250, useNativeDriver: false }).start();
  }, [targetTop, topAnim]);

  // ── the word: shown on every new screen, then folds away ───────────────
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = useCallback(() => {
    setExpanded(true);
    if (timer.current) clearTimeout(timer.current);
    if (COLLAPSE_AFTER_MS > 0) timer.current = setTimeout(() => setExpanded(false), COLLAPSE_AFTER_MS);
  }, []);
  useEffect(() => {
    wake();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [routeKey, wake]);
  useEffect(() => {
    Animated.timing(labelAnim, { toValue: expanded ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [expanded, labelAnim]);

  // ── dragging ───────────────────────────────────────────────────────────
  const latest = useRef({ side, W, minTop, maxTop });
  latest.current = { side, W, minTop, maxTop };

  const finishDrag = useCallback(
    (dx: number, dy: number) => {
      const { side: s0, W: w, minTop: lo, maxTop: hi } = latest.current;
      const newTop = Math.min(Math.max(topNow.current + dy, lo), hi);
      const width = widthNow.current;
      const left = s0 === "left" ? MARGIN : w - width - MARGIN;
      const nextSide: Side = left + dx + width / 2 < w / 2 ? "left" : "right";
      const next: Saved = { side: nextSide, yFrac: newTop / H };

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});

      // The vertical move becomes the new resting top, so nothing jumps.
      topNow.current = newTop;
      topAnim.setValue(newTop);
      dragY.setValue(0);

      if (nextSide === s0) {
        setSaved(next);
        Animated.spring(dragX, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
      } else {
        const travel = s0 === "right" ? -(w - width - 2 * MARGIN) : w - width - 2 * MARGIN;
        Animated.timing(dragX, { toValue: travel, duration: 180, useNativeDriver: false }).start(() => {
          setSaved(next);
          dragX.setValue(0);
        });
      }
      wake();
    },
    [H, dragX, dragY, topAnim, wake],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Only take over once the finger has really moved, so a plain tap still opens the panel.
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
        onPanResponderGrant: () => wake(),
        onPanResponderMove: (_, g) => {
          dragX.setValue(g.dx);
          dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => finishDrag(g.dx, g.dy),
        onPanResponderTerminate: (_, g) => finishDrag(g.dx, g.dy),
      }),
    [dragX, dragY, finishDrag, wake],
  );

  if (HIDE_ON.includes(routeKey) || !loaded) return null;

  const labelSize = 16 * Math.min(fontScale, 1.3);

  return (
    <>
      <Animated.View
        {...pan.panHandlers}
        onLayout={(e) => {
          widthNow.current = e.nativeEvent.layout.width;
        }}
        style={[
          s.wrap,
          side === "left" ? { left: MARGIN } : { right: MARGIN },
          { top: topAnim, transform: [{ translateX: dragX }, { translateY: dragY }] },
        ]}
      >
        <TouchableOpacity
          style={[s.pill, { backgroundColor: c.primary, borderColor: c.surface }]}
          onPress={() => {
            setOpen(true);
            wake();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${t("languageAndFont")}. ${t("a11yOpen")}`}
        >
          <View style={s.iconBox}>
            <Ionicons name="eye" size={26} color={c.onColor} />
          </View>
          <Animated.View
            style={{
              maxWidth: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }),
              opacity: labelAnim,
              overflow: "hidden",
            }}
          >
            <Text numberOfLines={1} style={[s.label, { color: c.onColor, fontSize: labelSize }]}>
              {t("languageAndFont")}
            </Text>
          </Animated.View>
        </TouchableOpacity>

        {readAloud && (
          <View style={[s.badge, { borderColor: c.surface }]} pointerEvents="none">
            <Ionicons name="volume-high" size={13} color="#FFFFFF" />
          </View>
        )}
      </Animated.View>

      <AccessibilityPanel
        visible={open}
        onClose={() => {
          setOpen(false);
          wake();
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", zIndex: 50, elevation: 8 },
  pill: {
    height: HEIGHT,
    minWidth: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  iconBox: { width: HEIGHT - 6, height: HEIGHT - 6, alignItems: "center", justifyContent: "center" },
  label: { fontWeight: "800", paddingRight: 18 },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
});
