// components/ReadAloudText.tsx
//
// Drop-in replacement for React Native's <Text>. It looks and behaves the same,
// and also lets "Read aloud on touch" (Settings) find the words under a finger.
//
//   import { Text } from "@/components/ReadAloudText";
//
// Use this instead of Text from "react-native" in every screen and component.
import { registerReadable } from "@/lib/readAloud";
import React, { useCallback, useEffect, useRef } from "react";
import { Text as RNText, type TextProps } from "react-native";

export const Text = React.forwardRef<RNText, TextProps>(function Text(props, forwardedRef) {
  const innerRef = useRef<RNText | null>(null);
  const propsRef = useRef<TextProps>(props);
  propsRef.current = props;

  useEffect(() => registerReadable({ ref: innerRef, props: propsRef }), []);

  const setRef = useCallback(
    (node: RNText | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<RNText | null>).current = node;
    },
    [forwardedRef],
  );

  return <RNText {...props} ref={setRef} />;
});

export type { TextProps };
export default Text;
