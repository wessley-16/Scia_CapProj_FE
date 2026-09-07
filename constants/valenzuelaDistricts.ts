    
export const DISTRICT_1_BARANGAYS = [
  "Arkong Bato",
  "Balangkas",
  "Bignay",
  "Bisig",
  "Canumay East",
  "Canumay West",
  "Coloong",
  "Dalandanan",
  "Isla",
  "Lawang Bato",
  "Lingunan",
  "Mabolo",
  "Malanday",
  "Malinta",
  "Palasan",
  "Pariancillo Villa",
  "Pasolo",
  "Poblacion",
  "Polo", // aka "Pulo"
  "Punturin",
  "Rincon",
  "Tagalag",
  "Veinte Reales", // aka "Viente Reales"
  "Wawang Pulo",
];

export const DISTRICT_2_BARANGAYS = [
  "Bagbaguin",
  "Gen. T. de Leon", // aka "Hen. T. de Leon", "General T. de Leon"
  "Karuhatan",
  "Mapulang Lupa",
  "Marulas",
  "Maysan",
  "Parada",
  "Paso de Blas",
  "Ugong",
];

// A few well-known alternate spellings map to their canonical entry above,
// so minor formatting differences between what a senior typed at signup and
// the official name don't silently break the match.
const ALIASES: Record<string, string> = {
  "pulo": "polo",
  "viente reales": "veinte reales",
  "hen. t. de leon": "gen. t. de leon",
  "hen t de leon": "gen. t. de leon",
  "general t. de leon": "gen. t. de leon",
  "general t de leon": "gen. t. de leon",
  "gen t de leon": "gen. t. de leon",
  "canumay": "canumay east", // pre-split records — best-effort guess
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^brgy\.?\s+/, "")
    .replace(/^barangay\s+/, "");

const DISTRICT_1_SET = new Set(DISTRICT_1_BARANGAYS.map(normalize));
const DISTRICT_2_SET = new Set(DISTRICT_2_BARANGAYS.map(normalize));

/**
 * Returns "DISTRICT_1" or "DISTRICT_2" for a Valenzuela barangay name, or
 * null if it doesn't match anything known (unrecognized spelling, blank,
 * or a resident outside Valenzuela).
 */
export function getDistrictForBarangay(barangay: string | null | undefined): "DISTRICT_1" | "DISTRICT_2" | null {
  if (!barangay) return null;
  let key = normalize(barangay);
  key = ALIASES[key] ?? key;

  if (DISTRICT_1_SET.has(key)) return "DISTRICT_1";
  if (DISTRICT_2_SET.has(key)) return "DISTRICT_2";
  return null;
}
