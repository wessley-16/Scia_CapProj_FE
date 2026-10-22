// constants/a11yModes.ts
// The colour/contrast modes offered in the Accessibility panel and Settings.
// `value` is a ContrastMode from constants/theme.ts; the label/hint keys are
// translation keys that already exist in constants/translations.ts.
import { ContrastMode } from "@/constants/theme";

export interface ColourModeOption {
  value: ContrastMode;
  labelKey: string;
  hintKey: string;
}

export const COLOUR_MODE_OPTIONS: ColourModeOption[] = [
  { value: "standard",     labelKey: "contrastStandard",     hintKey: "contrastHintStandard" },
  { value: "high",         labelKey: "contrastHigh",         hintKey: "contrastHintHigh" },
  { value: "protanopia",   labelKey: "contrastProtanopia",   hintKey: "contrastHintProtanopia" },
  { value: "deuteranopia", labelKey: "contrastDeuteranopia", hintKey: "contrastHintDeuteranopia" },
  { value: "tritanopia",   labelKey: "contrastTritanopia",   hintKey: "contrastHintTritanopia" },
  { value: "grayscale",    labelKey: "contrastGrayscale",    hintKey: "contrastHintGrayscale" },
];
