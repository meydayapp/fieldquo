// lib/email/preferences.js
//
// What a contractor user has said about FieldQuo's own email — the pure half.
// The store (preferencesStore.js) reads and writes EmailPreference; this file
// decides, so scripts/check-lifecycle-emails.mjs executes every rule without
// a database.
//
// ══ Three optional categories, and the mail that is not optional ═════════
//
//   tips     product tips and setup help — the trial sequence's feature
//            nudges, milestone letters, the personal day-3 note and the
//            help-articles letter (lib/lifecycle/).
//   updates  product news / newsletter.
//   offers   discounts and promotions on FieldQuo plans.
//
// Billing, security and the trial ending are TRANSACTIONAL: always sent, never
// a row here, never a switch on the page (a switch on mail that cannot be
// switched off is a control that appears to work and doesn't).
//
// ══ Absent is not "yes" for everything ════════════════════════════════════
//
// A null column means the person never chose. tips defaults ON: they started
// a trial of the product the tips are about, which is the relationship CASL's
// implied consent covers. updates and offers default to what they said at
// signup — User.marketingConsentAt, the "Send me product news and offers" box
// (app/api/companies/route.js) — and are OFF when they never ticked it.
// Inventing a yes for promotional mail out of silence is exactly the padding
// AGENTS.md failure class 5 forbids. A stored false always wins.
//
// FieldQuo's own do-not-contact list (SalesSuppression) is not consulted here
// on purpose: it is read in the request that sends (lib/sales/suppression.js
// refuses to be cached), and it wins over any "on" this file returns.

export const PREFERENCE_CATEGORIES = Object.freeze(["tips", "updates", "offers"]);
export const TRANSACTIONAL = "transactional";

/** How a change was made, stored on the row. */
export const CHANGE_VIA = Object.freeze(["email_link", "one_click", "app"]);

/**
 * The effective answer per category.
 *
 * @param row   the EmailPreference row, or null when none exists yet
 * @param user  { marketingConsentAt } — only that column is read
 */
export function resolvePreferences(row, user) {
  const consented = Boolean(user?.marketingConsentAt);
  const pick = (stored, fallback) => (stored === true ? true : stored === false ? false : fallback);
  return {
    tips: pick(row?.tips, true),
    updates: pick(row?.updates, consented),
    offers: pick(row?.offers, consented),
  };
}

/** May FieldQuo send this category to this person? Transactional is always yes. */
export function categoryAllowed(category, row, user) {
  if (category === TRANSACTIONAL) return true;
  if (!PREFERENCE_CATEGORIES.includes(category)) {
    // An unknown category is a caller's bug. Refusing is the safe direction:
    // a letter that cannot say what it is does not go out.
    return false;
  }
  return resolvePreferences(row, user)[category] === true;
}

/**
 * A body from the page or the app → { ok, data } or { ok: false, error }.
 * Only the three categories, only real booleans; nothing else is written.
 */
export function validatePreferencePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Expected an object." };
  const data = {};
  for (const key of PREFERENCE_CATEGORIES) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") return { ok: false, error: `\`${key}\` must be true or false.` };
    data[key] = body[key];
  }
  if (!Object.keys(data).length) return { ok: false, error: "Nothing to change." };
  return { ok: true, data };
}

/** The ?c= a one-click link names, or null. */
export function oneClickCategory(value) {
  const v = String(value || "").trim();
  return PREFERENCE_CATEGORIES.includes(v) ? v : null;
}

/** "e***@gmail.com" — enough for the page to say whose preferences these are, no more. */
export function maskEmail(email) {
  const s = String(email || "").trim();
  const at = s.lastIndexOf("@");
  if (at < 1) return "";
  return `${s[0]}***${s.slice(at)}`;
}

/** A token as the routes accept it: 32+ url-safe characters, nothing else. */
export function plausibleToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

/** The page a person manages their preferences on, and the one-click endpoint. */
export function preferencesUrls(origin, token, category = null) {
  const base = String(origin || "").replace(/\/+$/, "");
  const t = encodeURIComponent(token);
  const c = category ? `?c=${encodeURIComponent(category)}` : "";
  return {
    page: `${base}/email-preferences/${t}`,
    unsubscribe: `${base}/email-preferences/${t}${c}`,
    oneClick: `${base}/api/email-preferences/${t}/unsubscribe${c}`,
  };
}
