// components/chat/MarkdownText.tsx
// Lightweight markdown renderer using only React Native Text.
// Supports: bold, italic, bullet lists, numbered lists, headings, inline code, horizontal rules.
// No external library — zero dark-mode bleed.

import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  text: string;
  fontScale: number;
}

// ── Inline renderer: bold, italic, inline code ────────────────────────────────
function renderInline(raw: string, fontScale: number, baseColor: string, key: string) {
  // Split on **bold**, *italic*, `code`
  const parts = raw.split(/(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|`[^`]+`)/g);
  return (
    <Text key={key} style={{ fontSize: 15 * fontScale, color: baseColor, lineHeight: 24 * fontScale }}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={i} style={styles.bold}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <Text key={i} style={styles.italic}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <Text key={i} style={[styles.inlineCode, { fontSize: 13 * fontScale }]}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export default function MarkdownText({ text, fontScale }: Props) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Blank line ─────────────────────────────────────────────────────────
    if (line.trim() === "") {
      elements.push(<View key={`gap-${i}`} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // ── Horizontal rule ────────────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(<View key={`hr-${i}`} style={styles.hr} />);
      i++;
      continue;
    }

    // ── Headings ───────────────────────────────────────────────────────────
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      elements.push(
        <Text key={`h1-${i}`} style={[styles.h1, { fontSize: 22 * fontScale }]}>
          {h1[1]}
        </Text>
      );
      i++;
      continue;
    }
    if (h2) {
      elements.push(
        <Text key={`h2-${i}`} style={[styles.h2, { fontSize: 19 * fontScale }]}>
          {h2[1]}
        </Text>
      );
      i++;
      continue;
    }
    if (h3) {
      elements.push(
        <Text key={`h3-${i}`} style={[styles.h3, { fontSize: 17 * fontScale }]}>
          {h3[1]}
        </Text>
      );
      i++;
      continue;
    }

    // ── Bullet list ────────────────────────────────────────────────────────
    if (/^[-*+] /.test(line)) {
      const bullet = line.replace(/^[-*+] /, "");
      elements.push(
        <View key={`bullet-${i}`} style={styles.listRow}>
          <Text style={[styles.bullet, { fontSize: 17 * fontScale, lineHeight: 24 * fontScale }]}>•</Text>
          <View style={{ flex: 1 }}>
            {renderInline(bullet, fontScale, "#374151", `bi-${i}`)}
          </View>
        </View>
      );
      i++;
      continue;
    }

    // ── Numbered list ──────────────────────────────────────────────────────
    const numMatch = line.match(/^(\d+)\. (.+)/);
    if (numMatch) {
      elements.push(
        <View key={`num-${i}`} style={styles.listRow}>
          <Text style={[styles.bullet, { fontSize: 15 * fontScale, lineHeight: 24 * fontScale }]}>
            {numMatch[1]}.
          </Text>
          <View style={{ flex: 1 }}>
            {renderInline(numMatch[2], fontScale, "#374151", `ni-${i}`)}
          </View>
        </View>
      );
      i++;
      continue;
    }

    // ── Plain paragraph ────────────────────────────────────────────────────
    elements.push(
      <View key={`p-${i}`} style={styles.paragraph}>
        {renderInline(line, fontScale, "#374151", `pi-${i}`)}
      </View>
    );
    i++;
  }

  return <View style={styles.root}>{elements}</View>;
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#ffffff",
  },
  paragraph: {
    marginBottom: 2,
    backgroundColor: "#ffffff",
  },
  bold: {
    fontWeight: "700",
    color: "#111827",
  },
  italic: {
    fontStyle: "italic",
    color: "#374151",
  },
  inlineCode: {
    fontFamily: "monospace",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  h1: {
    fontWeight: "800",
    color: "#111827",
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: "#ffffff",
  },
  h2: {
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "#ffffff",
  },
  h3: {
    fontWeight: "700",
    color: "#374151",
    marginTop: 6,
    marginBottom: 3,
    backgroundColor: "#ffffff",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    backgroundColor: "#ffffff",
    gap: 8,
  },
  bullet: {
    color: "#2356E1",
    fontWeight: "700",
    width: 18,
    textAlign: "center",
    backgroundColor: "#ffffff",
  },
  hr: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 10,
  },
});
