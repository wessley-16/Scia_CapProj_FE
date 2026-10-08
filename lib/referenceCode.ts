// Reference code shown to staff instead of a senior's full name (Data Privacy Act: show only the
// personal data a task needs). Derived from the account id, so it is the same in the dashboard
// and on the senior's own screen. It is a display alias, not encryption.
// Keep identical to src/lib/referenceCode.js in the admin dashboard.
const ALPHABET = "23456789CDFGHJKMNPQRSTVWXZ"; // no vowels or look-alike characters

function hash53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** e.g. "SC-7K3F-92HM". The same input always gives the same code. */
export function referenceCode(id: string | null | undefined): string {
  const key = String(id || "").trim();
  if (!key) return "SC-----";
  let n = hash53(key);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out = ALPHABET[n % ALPHABET.length] + out;
    n = Math.floor(n / ALPHABET.length);
  }
  return `SC-${out.slice(0, 4)}-${out.slice(4)}`;
}
