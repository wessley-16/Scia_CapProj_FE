// components/AnimatedSplash.tsx
//
// Animated opening screen. The native splash (a still image, set in app.json) stays up until this
// view has drawn its first frame, so there is no white flash. This view starts with the logo at the
// same size and spot as the native splash, then:
//   1. the logo "breathes" and soft rings ripple outward behind it, while the app finishes loading
//   2. once loading is done (and it has played for at least MIN_SHOW_MS) the logo zooms up a little
//      and the whole screen fades out, revealing the app
// Turned down automatically when the phone has "Remove animations" / Reduce Motion switched on.

import { useAuth } from "@/context/AuthContext";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const logo = require("../assets/images/splash-logo.png");

// Keep LOGO_SIZE equal to "imageWidth" of the expo-splash-screen plugin in app.json,
// so the hand-over from the native splash to this view does not jump.
const LOGO_SIZE = 200;
const MIN_SHOW_MS = 1800; // shortest time the animation is on screen
const MAX_SHOW_MS = 6000; // never block the app longer than this, even if loading hangs
const EXIT_MS = 500;

export default function AnimatedSplash() {
  const { loading } = useAuth();
  const reduceMotion = useReducedMotion();

  const [visible, setVisible] = useState(true);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const overlayOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const logoOpacity = useSharedValue(1);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);

  // Start the idle animation, and make sure the overlay can't get stuck forever.
  useEffect(() => {
    if (!reduceMotion) {
      logoScale.value = withRepeat(
        withSequence(
          withTiming(1.07, { duration: 750, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
      ring1.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false);
      ring2.value = withDelay(
        750,
        withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false),
      );
    }
    const minTimer = setTimeout(() => setMinTimePassed(true), MIN_SHOW_MS);
    const maxTimer = setTimeout(() => setLeaving(true), MAX_SHOW_MS);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Leave once the app is ready and the animation has played long enough.
  useEffect(() => {
    if (!loading && minTimePassed) setLeaving(true);
  }, [loading, minTimePassed]);

  useEffect(() => {
    if (!leaving) return;
    if (reduceMotion) {
      overlayOpacity.value = withTiming(0, { duration: 200 });
    } else {
      logoScale.value = withTiming(1.3, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
      logoOpacity.value = withTiming(0, { duration: EXIT_MS - 100 });
      overlayOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.out(Easing.quad) });
    }
    const done = setTimeout(() => setVisible(false), (reduceMotion ? 200 : EXIT_MS) + 50);
    return () => clearTimeout(done);
  }, [leaving]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const ring1Style = useAnimatedStyle(() => ({
    opacity: (1 - ring1.value) * 0.35,
    transform: [{ scale: 0.7 + ring1.value * 1.1 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: (1 - ring2.value) * 0.35,
    transform: [{ scale: 0.7 + ring2.value * 1.1 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle]}
      pointerEvents={leaving ? "none" : "auto"}
      // Hide the native splash only after this view has been laid out, so there is no blank flash.
      onLayout={() => {
        setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 60);
      }}
      accessible
      accessibilityLabel="SCIA"
    >
      <View style={styles.center}>
        {!reduceMotion && (
          <>
            <Animated.View style={[styles.ring, ring1Style]} />
            <Animated.View style={[styles.ring, ring2Style]} />
          </>
        )}
        <Animated.Image source={logo} style={[styles.logo, logoStyle]} resizeMode="contain" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#ffffff", // same as the native splash background in app.json
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  center: { width: LOGO_SIZE, height: LOGO_SIZE, alignItems: "center", justifyContent: "center" },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  ring: {
    position: "absolute",
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 3,
    borderColor: "#2356E1",
  },
});
