// components/ReadAloudRoot.tsx
//
// Watches touches for "Read aloud on touch" without taking them away from the
// screen: scrolling and button presses work exactly as usual. It is mounted once
// around the whole app (app/_layout.tsx). A native <Modal> is a separate window,
// so wrap the content of every <Modal> in it too.
import { handleReadAloudTouch } from "@/lib/readAloud";
import React, { useCallback } from "react";
import { type GestureResponderEvent, StyleSheet, View, type ViewStyle, type StyleProp } from "react-native";

export default function ReadAloudRoot({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const onTouchStartCapture = useCallback((e: GestureResponderEvent) => {
    const n = e.nativeEvent as any;
    handleReadAloudTouch({ target: n.target, pageX: n.pageX, pageY: n.pageY });
  }, []);

  return (
    <View style={[styles.fill, style]} onTouchStartCapture={onTouchStartCapture}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
