// lib/sales/repIdentity.js
//
// Who a FieldQuo rep IS to a stranger, and what their link looks like.
// Pure, no imports — the settings screens validate as somebody types, and
// scripts/check-sales-work-name.mjs executes every branch without a database.
//
// ══ Two names, on purpose ═════════════════════════════════════════════════
//
// The owner, 2026-09-22: "Jesus… go as Daniel." A rep may sell under a work
// name. Prospects, signups and customer companies see that name — outreach
// signatures, intro emails, texts, calendar invites, the demo page, the call
// script the rep reads aloud, the voice prompts a caller hears. The REAL name
// stays on /platform and on every money record, shown beside the work name
// ("Jesus Pérez — works as Daniel"), because a payout, a contract and a tax
// form are made out to a person, not to a persona.
//
// So there are exactly two readers, and each gets one function:
//
//   repPublicName(rep)  — anything a person outside FieldQuo can read or hear.
//   repStaffLabel(rep)  — FieldQuo's own screens, where both names matter.
//
// A surface that reaches for `rep.name` directly is the bug this file exists
// to prevent; scripts/check-sales-work-name.mjs greps the outsider-facing
// files for exactly that.
//
// ══ The fallback is the FIRST name, never the full one ════════════════════
//
// A rep who has not chosen a work name is shown by the first word of their
// real name. Not the whole name: before this file, intro emails went out
// signed with a rep's full legal name, which is more than a cold prospect
// needs and more than some reps want a stranger to hold. First names are how
// every call script in lib/sales/playbook already introduces the rep ("Morning
// — it's {repName} from FieldQuo"), so the fallback matches what the prospect
// heard on the phone.

/**
 * Letters (any script, with their combining marks), spaces and hyphens;
 * starting and ending on a letter. 2–30 characters after whitespace is
 * collapsed. The owner's rule, 2026-09-22.
 *
 * Deliberately no apostrophes, digits or dots: this value lands in an email
 * From display name, an SMS, an .ics ORGANIZER and a text-to-speech prompt,
 * and every one of those has its own idea of what a quote character means.
 * Restricting the alphabet at the door is cheaper than escaping it in six
 * places — and makes the "cannot inject a header" property structural.
 */
const WORK_NAME_RE = /^\p{L}[\p{L}\p{M} -]*[\p{L}\p{M}]$/u;
export const WORK_NAME_MIN = 2;
export const WORK_NAME_MAX = 30;

/**
 * Validate a work name typed by a rep or an admin.
 *
 * Returns `{ ok, value, error }`. `value` is the cleaned name, or null when
 * the input was empty — empty is a legitimate answer ("clear my work name,
 * use my first name") and is NOT an error. Callers write `value` as-is.
 *
 * `error` is a stable code, never prose, so the /sales and /platform screens
 * can each say it in their own words and language.
 *
 * @param {unknown} raw
 * @returns {{ ok: boolean, value: string|null, error: null|"type"|"length"|"characters" }}
 */
export function validateWorkName(raw) {
  if (raw === null || raw === undefined) return { ok: true, value: null, error: null };
  if (typeof raw !== "string") return { ok: false, value: null, error: "type" };
  const cleaned = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!cleaned) return { ok: true, value: null, error: null };
  // Length in code points, not UTF-16 units: "Zoë" is three letters.
  const len = [...cleaned].length;
  if (len < WORK_NAME_MIN || len > WORK_NAME_MAX) return { ok: false, value: null, error: "length" };
  if (!WORK_NAME_RE.test(cleaned)) return { ok: false, value: null, error: "characters" };
  // "Da--niel" and "Dan - iel" pass the character class and read as typos.
  if (/--|- | -/.test(cleaned)) return { ok: false, value: null, error: "characters" };
  return { ok: true, value: cleaned, error: null };
}

/** The stored work name, if it still passes the rules. Read-side guard. */
export function workNameOf(rep) {
  const v = validateWorkName(rep?.workName);
  return v.ok ? v.value : null;
}

/** First whitespace-separated word of the real name, or null. */
export function realFirstName(rep) {
  const first = String(rep?.name || "").trim().split(/\s+/)[0] || "";
  return first || null;
}

/**
 * The name a prospect, a signup or a customer company sees.
 *
 * Work name when one is set and valid; else the first word of the real name;
 * else null — and null is returned rather than a placeholder, because every
 * caller already has its own honest fallback ("FieldQuo", "your rep", a
 * refusal to send) and a function that invented "Rep" would override them.
 *
 * Re-validates the stored work name on read: a value that got into the
 * column some other way (a hand edit, a future rule change) must not reach
 * an email header just because it is in the database.
 */
export function repPublicName(rep) {
  return workNameOf(rep) || realFirstName(rep);
}

/**
 * The label on FieldQuo's own screens: the real name, plus the work name
 * when there is one that differs from what the first name would have been.
 *
 *   { name: "Jesus Pérez", workName: "Daniel" }  → "Jesus Pérez — works as Daniel"
 *   { name: "Jesus Pérez", workName: null }      → "Jesus Pérez"
 *   { name: "Jesus Pérez", workName: "Jesus" }   → "Jesus Pérez"
 */
export function repStaffLabel(rep) {
  const real = String(rep?.name || "").trim();
  const work = workNameOf(rep);
  if (!work) return real || null;
  if (!real) return `works as ${work}`;
  if (work.toLowerCase() === (realFirstName(rep) || "").toLowerCase()) return real;
  return `${real} — works as ${work}`;
}

// ══ Opaque referral tokens ═════════════════════════════════════════════════
//
// A rep's link used to carry SalesRep.code, which is their real name slugged
// ("jesus-perez"). That handed every prospect the rep's real name in the URL
// bar, and let anyone who had one link guess a colleague's. The token is
// eight Crockford base32 characters: 40 random bits, lower case (links get
// retyped off a phone screen and attribution already matches codes
// case-insensitively), no i/l/o/u so nobody reads a 1 as an l.

export const REFERRAL_TOKEN_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
export const REFERRAL_TOKEN_LENGTH = 8;
const TOKEN_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{8}$/;

/**
 * A fresh token. Uses the platform CSPRNG (globalThis.crypto, present in
 * Node 19+ and every browser) rather than Math.random: a guessable token is a
 * guessable commission. 256 is a multiple of 32, so `byte % 32` is unbiased.
 *
 * Uniqueness is the caller's job — SalesRep.referralToken is @unique and
 * lib/sales/repLink.js retries.
 */
export function mintReferralToken(randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = randomBytes(REFERRAL_TOKEN_LENGTH);
  let out = "";
  for (let i = 0; i < REFERRAL_TOKEN_LENGTH; i++) out += REFERRAL_TOKEN_ALPHABET[bytes[i] % 32];
  return out;
}

/** Could this string be a referral token? Case-insensitive, like the lookup. */
export function isReferralTokenShape(value) {
  return TOKEN_RE.test(String(value || "").trim().toLowerCase());
}
