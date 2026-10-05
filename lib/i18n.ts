/**
 * lib/i18n.ts
 *
 * Translation helper for code that is NOT a React component (validators,
 * notifications, helpers). Components should keep using `useSettings().t`.
 * SettingsContext keeps `current` in sync with the language the user picked.
 */
import { en, tl } from "@/constants/translations";

let current = "tl"; // Tagalog by default

export const setCurrentLanguage = (lang: string) => {
  current = lang === "en" ? "en" : "tl";
};

export const getCurrentLanguage = () => current;

export function tr(key: string, vars?: Record<string, string | number>): string {
  const dict = current === "en" ? en : tl;
  let text = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const k of Object.keys(vars)) text = text.split("{" + k + "}").join(String(vars[k]));
  }
  return text;
}
