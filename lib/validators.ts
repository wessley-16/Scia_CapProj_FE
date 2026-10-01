// lib/validators.ts
//
// "What characters may go in this field", shared by the sign-up screen. These
// are the same rules as the admin website (src/lib/validators.js), so a value
// accepted in one place is accepted in the other.
//
//   strip    characters NOT allowed; removed as the person types, and the field
//            shows `hint` so they know why nothing appeared
//   check    final validity test, run on submit
//   message  shown when `check` fails
//   max      maximum length
//
// Letters are matched with explicit Latin ranges (including accented letters
// such as Ñ) rather than \p{L}, so this does not depend on the JS engine
// supporting Unicode property escapes.

const L = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF\\u0100-\\u017F"; // letters
const M = "\\u0300-\\u036F"; // combining accents

export type RuleKind = "name" | "phone" | "address" | "idNumber" | "relation";

interface Rule {
  strip: RegExp;
  check: RegExp;
  max: number;
  hint: string;
  message: string;
}

export const RULES: Record<RuleKind, Rule> = {
  name: {
    strip: new RegExp(`[^${L}${M}\\s.'-]`, "g"),
    check: new RegExp(`^[${L}][${L}${M}\\s.'-]*$`),
    max: 50,
    hint: "Letters only. Numbers and symbols are not allowed.",
    message: "Enter a valid name (letters, spaces, . ' - only).",
  },
  // Mobile numbers: digits, with an optional leading +.
  phone: {
    strip: /[^\d+]/g,
    check: /^(09\d{9}|\+639\d{9})$/,
    max: 13,
    hint: "Numbers only.",
    message: "Enter a valid PH mobile number, e.g. 09171234567.",
  },
  // House / block / street lines.
  address: {
    strip: new RegExp(`[^${L}0-9\\s.,#'/-]`, "g"),
    check: new RegExp(`^[${L}0-9][${L}0-9\\s.,#'/-]*$`),
    max: 80,
    hint: "Letters, numbers and . , # - / only.",
    message: "Enter a valid address (letters, numbers and . , # - / only).",
  },
  // Senior Citizen / OSCA ID numbers, including TEMP###### ones.
  idNumber: {
    strip: /[^A-Za-z0-9-]/g,
    check: /^[A-Za-z0-9-]{4,20}$/,
    max: 20,
    hint: "Letters, numbers and dashes only.",
    message: "Enter a valid ID number (4 to 20 letters or numbers).",
  },
  // Free relationship text such as "Daughter" or "Neighbor".
  relation: {
    strip: new RegExp(`[^${L}${M}\\s.'-]`, "g"),
    check: new RegExp(`^[${L}][${L}${M}\\s.'-]*$`),
    max: 30,
    hint: "Letters only.",
    message: "Enter a valid relationship (letters only).",
  },
};

export const GENDERS = ["Male", "Female"];
export const DISTRICTS = ["District 1", "District 2"];
export const MIN_SENIOR_AGE = 60;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 64;

/** Removes disallowed characters. `rejected` is true when something was dropped
 *  (or the value was cut to the max length) so the UI can flag it. */
export function sanitize(kind: RuleKind, raw: string): { value: string; rejected: boolean } {
  const rule = RULES[kind];
  const input = String(raw ?? "");
  let value = input.replace(rule.strip, "");
  if (kind === "phone") value = value.replace(/(?!^)\+/g, ""); // "+" only at the start
  value = value.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
  if (value.length > rule.max) value = value.slice(0, rule.max);
  const normalizedInput = input.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
  return { value, rejected: value !== normalizedInput };
}

/** Returns an error string, or "" when the value is fine. */
export function validate(kind: RuleKind, raw: string, opts: { required?: boolean } = {}): string {
  const required = opts.required ?? true;
  const rule = RULES[kind];
  const v = String(raw ?? "").trim();
  if (!v) return required ? "This field is required." : "";
  return rule.check.test(v) ? "" : rule.message;
}

export function validateGender(value: string): string {
  return GENDERS.includes(value) ? "" : "Choose Male or Female.";
}

/** A select must hold one of its real options. */
export function validateOption(value: string, options: readonly string[], label = "option"): string {
  return options.includes(value) ? "" : `Choose a valid ${label} from the list.`;
}

export function validatePassword(value: string): string {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) return "Password is too long.";
  return "";
}

/** Latest birth date that still makes someone a senior (60 years ago today). */
export function latestSeniorBirthDate(now: Date = new Date()): Date {
  return new Date(now.getFullYear() - MIN_SENIOR_AGE, now.getMonth(), now.getDate());
}
