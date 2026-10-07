// constants/theme.ts
//
// Two palettes for the contrast setting: "standard" (the existing look) and "high"
// (darker text, darker blues, no light-blue cards for important items).
// Screens read the active palette from useSettings().colors and build their
// styles from it, so switching in Settings updates every screen at once.

export type ContrastMode = "standard" | "high";

export interface Palette {
  // surfaces
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceSoft: string; // light-blue card background
  border: string;
  cardBorder: string; // outline for white cards: invisible in standard, strong in high contrast
  // text
  text: string;
  textSecondary: string;
  textStrong: string;
  textMuted: string;
  onColor: string; // text/icons on any solid colored button or tile
  onColorMuted: string; // secondary text on the blue tab bar
  // brand and status
  primary: string;
  primaryStrong: string;
  primaryDark: string;
  link: string;
  danger: string;
  dangerStrong: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  info: string;
  infoSoft: string;
  // tiles
  tileHealth: string;
  tileInfo: string;
  tileNeutral: string;
}

export const standardPalette: Palette = {
  bg: "#F4F6F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F4F6",
  surfaceSoft: "#EFF6FF",
  border: "#D1D5DB",
  cardBorder: "transparent",
  text: "#111827",
  textSecondary: "#4B5563",
  textStrong: "#374151",
  textMuted: "#6B7280",
  onColor: "#FFFFFF",
  onColorMuted: "#E5E7EB",
  primary: "#2356E1",
  primaryStrong: "#1D4ED8",
  primaryDark: "#1E3A8A",
  link: "#1D4ED8",
  danger: "#C81E1E",
  dangerStrong: "#C0181F",
  dangerSoft: "#FEE2E2",
  success: "#065F46",
  successSoft: "#D1FAE5",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  warningText: "#78350F",
  info: "#1A56C4",
  infoSoft: "#E0F2FE",
  tileHealth: "#0F766E",
  tileInfo: "#1A56C4",
  tileNeutral: "#374151",
};

export const highContrastPalette: Palette = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F4F6",
  surfaceSoft: "#FFFFFF",
  border: "#374151",
  cardBorder: "#374151",
  text: "#111827",
  textSecondary: "#111827",
  textStrong: "#111827",
  textMuted: "#374151",
  onColor: "#FFFFFF",
  onColorMuted: "#FFFFFF",
  primary: "#0B3D91",
  primaryStrong: "#0B3D91",
  primaryDark: "#0B3D91",
  link: "#0B3D91",
  danger: "#9B1111",
  dangerStrong: "#8F0F14",
  dangerSoft: "#FFFFFF",
  success: "#064E3B",
  successSoft: "#FFFFFF",
  warning: "#7C2D12",
  warningSoft: "#FFFFFF",
  warningText: "#451A03",
  info: "#0B3D91",
  infoSoft: "#FFFFFF",
  tileHealth: "#04594F",
  tileInfo: "#0B3D91",
  tileNeutral: "#1F2937",
};

export const getPalette = (mode: ContrastMode): Palette =>
  mode === "high" ? highContrastPalette : standardPalette;
