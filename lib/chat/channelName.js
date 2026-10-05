// lib/chat/channelName.js
//
// What a channel may be called — ONE helper for both chats.
//
// FieldQuo's own staff chat (lib/staff/channels.js) settled these rules
// first; a contractor company's crew chat (lib/company/chat/rules.js) now has
// channels too. The two must agree on what "#Sales West!" becomes, so the
// rule lives here and each chat passes its own reserved names. A copy would
// be the one that rots (AGENTS.md failure class 4).
//
// Pure. No imports, no I/O — scripts/check-staff-chat.mjs and
// scripts/check-company-chat.mjs drive it with hostile names, and the create
// dialogs import slugify to show what a name is about to become before the
// person presses Create.

/** Rocket.Chat's channel-name ceiling, near enough. Longer is a sentence. */
export const CHANNEL_NAME_MAX = 40;

/**
 * The stored key for a channel name.
 *
 * Lowercase, spaces and runs of punctuation to one dash, nothing but
 * [a-z0-9-_] survives. "Sales West" and "sales-west" and "SALES  WEST!" are
 * the same channel, which is the whole point: a unique index is what stops a
 * second one, and an index can only compare what it is given.
 *
 * Accented letters are stripped to their base (é → e) rather than dropped, so
 * "#Équipe Québec" becomes "equipe-quebec" and not "quipe-qubec".
 *
 * `unicode: true` keeps letters, marks and digits of ANY script — the
 * company chat's mode. A contractor company works in eight languages,
 * Ukrainian and Punjabi among them, and an ASCII-only rule turns "бригада"
 * and "ਟੀਮ" into nothing and refuses the name. Latin accents are still
 * folded first (so "Équipe" and "equipe" stay one channel); marks are kept
 * because in Gurmukhi or Devanagari a vowel sign IS part of the word. The
 * staff chat keeps the ASCII rule its existing slugs were made under.
 */
export function slugify(name, { unicode = false } = {}) {
  const decomposed = String(name || "").normalize("NFKD");
  if (!unicode) {
    // Byte-for-byte the staff chat's original rule: its stored slugs were
    // made by it.
    return decomposed
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, CHANNEL_NAME_MAX);
  }
  // Accents are folded off LATIN letters only: the same combining marks are
  // how Unicode spells Ukrainian й and ї, and folding those would rename
  // "мій" to "мии". Sliced by code point, not UTF-16 unit, so a cut never
  // halves a letter; and a cut that lands on a dash leaves no "#crew-".
  const folded = decomposed.replace(/([A-Za-z])[\u0300-\u036f]+/g, "$1").normalize("NFC").toLowerCase();
  return [...folded.replace(/[^\p{L}\p{M}\p{N}_]+/gu, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-")]
    .slice(0, CHANNEL_NAME_MAX)
    .join("")
    .replace(/-+$/, "");
}

/**
 * Is this a name a channel may have? Returns { ok, slug, reason }.
 *
 * `reason` is a CODE — the route puts the sentence in `error` and the code in
 * `code`, so the screen can say it in the reader's language.
 *
 * @param reserved  slugs this chat keeps for itself — the staff chat's team
 *                  keys, the company chat's "general". A user must not be able
 *                  to make a second "#general" beside the real one.
 */
export function validateChannelName(name, { reserved = [], unicode = false } = {}) {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw) return { ok: false, slug: null, reason: "name_missing" };
  if (raw.length > CHANNEL_NAME_MAX) return { ok: false, slug: null, reason: "name_too_long" };
  const slug = slugify(raw, { unicode });
  // "!!!" slugs to nothing, and a channel called "" is not a channel. So
  // does a name in a script with no Latin base letters ("общий") — refused
  // with the same code rather than stored as "", which the unique key would
  // then hand to exactly one such channel per company.
  if (!slug) return { ok: false, slug: null, reason: "name_missing" };
  if ((Array.isArray(reserved) ? reserved : []).includes(slug)) return { ok: false, slug, reason: "name_reserved" };
  return { ok: true, slug, reason: null };
}
