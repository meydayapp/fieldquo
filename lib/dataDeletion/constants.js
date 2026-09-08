// lib/dataDeletion/constants.js
//
// The browser-safe half of lib/dataDeletion/requests.js: constants and pure
// string helpers with no Node import. The public form and the platform page
// are client components, and requests.js pulls in node:crypto to mint codes,
// which a client bundle cannot carry. Server code imports requests.js, which
// re-exports everything here, so there is one name for each thing.
//
// No deletion lives in either file — see requests.js for why that is the
// design and not a gap.

/**
 * How long the OWNER has to carry out a deletion once it is received, in
 * BUSINESS days. This is the number the owner gave (2026-09-08), and it is a
 * different promise from lib/legal/deletionRequests.js's DELETION_RESPONSE_DAYS
 * — that one is how long we take to ANSWER (the acknowledgement goes out the
 * moment the request lands; see app/api/data-deletion/route.js), this one is
 * how long the deletion itself may take.
 *
 * Both are published on /data-deletion and both are promises to strangers,
 * so both live as named constants rather than numbers in prose.
 */
export const DELETION_BUSINESS_DAYS = 30;

export const DATA_DELETION_STATUSES = ["received", "completed"];
export const DATA_DELETION_SOURCES = ["form", "meta_callback", "email"];

/**
 * The honeypot field's name. Rendered on the form as a visually hidden input
 * a person never sees and a form-filling bot fills anyway. Named for what a
 * bot expects to find, not for what it is. Lives here rather than in the route
 * because a route.js may only export handlers — Next refuses the build
 * otherwise — and the form and the route have to agree on the string.
 */
export const HONEYPOT_FIELD = "website";

/**
 * The address a Meta-callback request is filed under when there is none.
 * Meta's signed_request carries an app-scoped user id and nothing else, and
 * `email` is required on the row (the form path depends on it). Not an inbox —
 * nothing is ever sent to it; the console shows the row as "no address, from
 * Meta" and the owner finds the person through `metaUserId` instead. The
 * .invalid TLD is reserved (RFC 2606) precisely so a value like this can never
 * be delivered anywhere by mistake.
 */
export const META_CALLBACK_PLACEHOLDER_EMAIL = "meta-callback@unknown.invalid";

// Crockford-ish alphabet: no 0/O, 1/I/L, so a code read out over the phone or
// typed off a screenshot cannot be mis-keyed. Six characters over thirty
// symbols is ~730 million codes; collisions are handled by the @unique
// constraint and one retry in the route, not by making the code longer than a
// person wants to type.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 6;
export const CODE_PREFIX = "FQ-DEL-";

/**
 * Canonical form of a code somebody typed or pasted: trims, upper-cases, and
 * tolerates the prefix being left off. Returns null for anything that could
 * not be a code, so the status route can 400 rather than query on garbage.
 */
export function normaliseConfirmationCode(raw) {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  const body = s.startsWith(CODE_PREFIX) ? s.slice(CODE_PREFIX.length) : s;
  if (body.length !== CODE_LENGTH) return null;
  for (const ch of body) if (!CODE_ALPHABET.includes(ch)) return null;
  return `${CODE_PREFIX}${body}`;
}

/**
 * Good enough for "can we send an acknowledgement here". Deliberately not the
 * RFC grammar: the failure this guards is a phone number or a sentence typed
 * into the email box, and one @ with something either side catches that.
 * Length-capped because the value goes into a Resend `to` header and a
 * database column.
 */
export function isPlausibleEmail(value) {
  const s = String(value ?? "").trim();
  if (!s || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Free text from a stranger, bounded. Null for blank. */
export function cleanText(value, max = 2000) {
  const s = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * The public view of a request — what /api/data-deletion/status returns and
 * what the page shows beside a `?code=`. Status and dates ONLY. The row holds
 * an email, a name and free text, and a code is a six-character string that
 * anybody can type, so this is the boundary that keeps a guessed code from
 * returning who asked.
 */
export function publicStatus(row) {
  if (!row) return null;
  return {
    status: row.status,
    receivedAt: row.receivedAt,
    completedAt: row.completedAt ?? null,
  };
}
