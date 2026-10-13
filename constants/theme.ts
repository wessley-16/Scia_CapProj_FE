// constants/theme.ts
//
// Two palettes for the contrast setting: "standard" (the existing look) and "high"
// (darker text, darker blues, no light-blue cards for important items).
// Screens read the active palette from useSettings().colors and build their
// styles from it, so switching in Settings updates every screen at once.

// Same six colour modes as the admin website's Accessibility panel.
// ("colorblind" was the old single mode; it is now saved as "deuteranopia".)
export type ContrastMode = "standard" | "high" | "protanopia" | "deuteranopia" | "tritanopia" | "grayscale";

export const CONTRAST_MODES: ContrastMode[] = ["standard", "high", "protanopia", "deuteranopia", "tritanopia", "grayscale"];

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

// Colour-blind friendly: the standard look, but status colours no longer rely on red versus green.
// Danger is a dark vermilion and "ok" is blue (the blue/orange axis stays visible with red-green and
// most other colour-vision differences, after the Okabe-Ito palette). The health tile moves from
// teal to purple. Meaning is also carried by icons and words, never by colour alone.
// All pairs below keep at least 4.5:1 against white text/backgrounds.
export const colorblindPalette: Palette = {
  ...standardPalette,
  danger: "#A33F00",
  dangerStrong: "#8F3500",
  dangerSoft: "#FFE8D6",
  success: "#0072B2",
  successSoft: "#DCEEFB",
  // Very dark brown: with a burnt-orange danger colour, the old amber warning looked the same
  // as danger to red-green colour-blind users (checked with a colour-vision simulation).
  warning: "#3B2F00",
  warningSoft: "#FEF3C7",
  warningText: "#3B2F00",
  tileHealth: "#7A2E6B",
};

// Blue-yellow colour blindness: plum + red + green stay distinct; no blue/green or
// yellow/pink pair carries meaning.
export const tritanopiaPalette: Palette = {
  ...standardPalette,
  surfaceSoft: "#F3F4F6",
  primary: "#7A1F5C",
  primaryStrong: "#651A4C",
  primaryDark: "#4F143B",
  link: "#651A4C",
  info: "#7A1F5C",
  infoSoft: "#F3F4F6",
  danger: "#B91C1C",
  dangerStrong: "#991B1B",
  dangerSoft: "#FEE2E2",
  success: "#166534",
  successSoft: "#DCFCE7",
  warning: "#9A3412",
  warningSoft: "#FFEDD5",
  warningText: "#5A1F0A",
  tileHealth: "#166534",
  tileInfo: "#7A1F5C",
  tileNeutral: "#374151",
};

// Grayscale: every colour in the standard palette replaced by the grey of the same brightness,
// so text contrast is unchanged and all colour is removed.
const toGray = (hex: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex; // "transparent" etc.
  const n = parseInt(m[1], 16);
  const g = Math.round(0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
  const h = g.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
};
export const grayscalePalette: Palette = Object.fromEntries(
  Object.entries(standardPalette).map(([k, v]) => [k, toGray(v as string)]),
) as unknown as Palette;

export const getPalette = (mode: ContrastMode): Palette => {
  switch (mode) {
    case "high":
      return highContrastPalette;
    case "protanopia":
    case "deuteranopia":
      return colorblindPalette;
    case "tritanopia":
      return tritanopiaPalette;
    case "grayscale":
      return grayscalePalette;
    default:
      return standardPalette;
  }
};
