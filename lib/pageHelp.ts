// lib/pageHelp.ts
// Maps the current route to the translation key holding that screen's
// "explain this page" text (pageHelp_* in constants/translations.ts).
const KNOWN_PAGES = new Set([
  "home",
  "account",
  "chatbot",
  "emergency",
  "govdocs",
  "healthcare",
  "help",
  "settings",
  "voice",
]);

export function pageHelpKey(pathname: string | null | undefined): string {
  // "/(tabs)/home" -> "home", "/" -> "" -> default
  const segment = (pathname ?? "").split("/").filter(Boolean).pop() ?? "";
  return KNOWN_PAGES.has(segment) ? `pageHelp_${segment}` : "pageHelp_default";
}
