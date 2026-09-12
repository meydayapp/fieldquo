// lib/platform/signupFlags.js
//
// Where a signup came from, and whether that is worth a second look.
//
// ══ The question ═══════════════════════════════════════════════════════════
//
// The owner: "check if the IP of the company or person that signed up is from
// Canada or USA, and flag when it isn't" — above all for signups that arrived
// on a sales rep's link, since a rep is paid per signup and a link that brings
// accounts from outside the market is the first thing to look at when a
// commission looks wrong.
//
// ══ Pure, on purpose ═══════════════════════════════════════════════════════
//
// Nothing here touches a database, a request object or the clock. The header
// reader takes a Headers-like `get`; the decision takes plain values that the
// db half (lib/platform/signupOrigin.js) has already loaded. Same split as
// lib/sales/attribution.js and for the same reason: every interesting input
// is hostile or absent — a missing country header, a city with a percent-
// encoded "ã", an IP that is the string "unknown" — and
// scripts/check-signup-origin.mjs executes every branch rather than reading
// it.
//
// ══ Absence is not a statement ═════════════════════════════════════════════
//
// Vercel's edge sets the geo headers from its own GeoIP; local dev, a proxy
// that strips them, or an address GeoIP cannot place leave them absent. An
// absent country is UNKNOWN and produces NO flag. The console prints
// "unknown", never "suspicious" — flagging every request the edge could not
// place would bury the real signal under the deployment's own gaps
// (AGENTS.md failure class #5).
//
// ══ What is deliberately not here ══════════════════════════════════════════
//
//   - No VPN / hosting detection. "vpn_or_hosting" is in the vocabulary so a
//     later signal has a name, but no request header on Vercel carries one
//     (the geo set is country / region / city / lat / long / timezone) and the
//     brief refused a paid lookup. It is never produced, and the check asserts
//     that.
//   - No rep "market". SalesRep carries `sellsIn` (languages) and no territory
//     column, so a country mismatch is decided against the country the company
//     STATED at signup only.

/** Which door the signup walked in. */
export const SIGNUP_VIAS = ["sales_link", "referral", "direct", "other"];

/**
 * The complete flag vocabulary. Order is severity, highest first — when more
 * than one signal fires, the first in this list is the one stored in `flag`
 * and the rest are named in `flagReason`.
 */
export const SIGNUP_FLAGS = [
  "outside_ca_us",
  "country_mismatch",
  "repeat_ip",
  "vpn_or_hosting",
  "none",
];

/** What the console prints for each. Never the raw enum. */
export const SIGNUP_FLAG_LABELS = {
  none: "No flag",
  outside_ca_us: "Outside CA/US",
  country_mismatch: "Country mismatch",
  repeat_ip: "Repeat IP",
  vpn_or_hosting: "VPN or hosting",
};

export const SIGNUP_VIA_LABELS = {
  sales_link: "Rep link",
  referral: "Referral",
  direct: "Direct",
  other: "Promo code",
};

/** The market. Anything else, when KNOWN, is the owner's first-level flag. */
export const HOME_COUNTRIES = ["CA", "US"];

/** Two signups from one address inside this window is a repeat. */
export const REPEAT_IP_WINDOW_DAYS = 30;

/** The Vercel geo headers read, spelled once so docs/VERCEL.md and the check
 *  name the same three. Set by Vercel's edge on every request; absent locally. */
export const VERCEL_GEO_HEADERS = {
  country: "x-vercel-ip-country",
  region: "x-vercel-ip-country-region",
  city: "x-vercel-ip-city",
};

const MAX_HEADER = 512;

function text(v, max = MAX_HEADER) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** ISO alpha-2, upper-cased, or null. "XX" and "T1" (Tor) are not countries. */
export function normaliseCountry(v) {
  const t = text(v, 8);
  if (!t) return null;
  const up = t.toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return null;
  if (up === "XX" || up === "T1") return null;
  return up;
}

/** Vercel percent-encodes the city ("S%C3%A3o%20Paulo"). Decode, tolerate junk. */
export function decodeCity(v) {
  const t = text(v, 128);
  if (!t) return null;
  try {
    return decodeURIComponent(t).trim() || null;
  } catch {
    return t;
  }
}

/** Null for the string the rate limiter uses when nothing identified the caller. */
export function normaliseIp(v) {
  const t = text(v, 64);
  if (!t || t.toLowerCase() === "unknown") return null;
  return t;
}

/**
 * Read everything the request itself says about where it came from.
 *
 * @param {{ get: (name: string) => string|null }} headers  a Headers-like
 * @param {string|null} ip  already read through lib/rateLimit.js's clientIp()
 *   — the one IP reader in the codebase; this function does not grow a second.
 */
export function readSignupRequest(headers, ip) {
  const get = (name) => (headers && typeof headers.get === "function" ? headers.get(name) : null);
  return {
    ip: normaliseIp(ip),
    ipCountry: normaliseCountry(get(VERCEL_GEO_HEADERS.country)),
    ipRegion: text(get(VERCEL_GEO_HEADERS.region), 16)?.toUpperCase() || null,
    ipCity: decodeCity(get(VERCEL_GEO_HEADERS.city)),
    userAgent: text(get("user-agent")),
    acceptLanguage: text(get("accept-language"), 128),
  };
}

/**
 * Which door, from what the signup route already knows. A rep link wins over
 * a referral when both are present: the rep-link population is the one the
 * owner asked to watch, and `referralCode` is still stored beside it.
 */
export function deriveVia({ salesCodePresented = false, referralApplied = false, promoApplied = false } = {}) {
  if (salesCodePresented) return "sales_link";
  if (referralApplied) return "referral";
  if (promoApplied) return "other";
  return "direct";
}

/** The start of the repeat-IP window, from a caller-supplied `now`. */
export function repeatIpWindowStart(now = new Date()) {
  return new Date(now.getTime() - REPEAT_IP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * How many OTHER signups the same address made inside the window. The db half
 * runs this as a query; the check runs it here against fixture rows so the
 * window and the exclusions are executed once, in one place.
 *
 * An unknown IP never repeats: "unknown" matching "unknown" would flag every
 * local signup as the same person.
 */
export function countRecentFromIp(rows, { ip, now = new Date(), excludeCompanyId = null }) {
  const address = normaliseIp(ip);
  if (!address) return 0;
  const since = repeatIpWindowStart(now).getTime();
  let n = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || normaliseIp(r.ip) !== address) continue;
    if (excludeCompanyId && r.companyId === excludeCompanyId) continue;
    const at = r.createdAt instanceof Date ? r.createdAt.getTime() : Date.parse(r.createdAt);
    if (!Number.isFinite(at) || at < since) continue;
    n += 1;
  }
  return n;
}

/**
 * The decision.
 *
 * @param {object} args
 * @param {string|null} args.ipCountry     from the edge; null = unknown
 * @param {string|null} args.statedCountry what the company said it was
 * @param {number} args.priorSignupsFromIp other signups from this IP in the
 *   window (countRecentFromIp)
 * @param {boolean} args.hostingSignal     a VPN/hosting signal, if a header
 *   ever carries one. Nothing sets it today — see the header.
 * @returns {{ flag: string, signals: string[], reason: string|null,
 *            countryKnown: boolean }}
 */
export function decideSignupFlag({
  ipCountry = null,
  statedCountry = null,
  priorSignupsFromIp = 0,
  hostingSignal = false,
} = {}) {
  const ipc = normaliseCountry(ipCountry);
  const stated = normaliseCountry(statedCountry);
  const signals = [];
  const notes = [];

  if (ipc && !HOME_COUNTRIES.includes(ipc)) {
    signals.push("outside_ca_us");
    notes.push(`request from ${ipc}, outside CA/US`);
  }
  // A mismatch is a signal on its own only when the IP is inside the market —
  // a French IP stating Canada is already the outside_ca_us row, and naming
  // the mismatch beside it is the note, not a second flag.
  if (ipc && stated && ipc !== stated) {
    if (HOME_COUNTRIES.includes(ipc)) signals.push("country_mismatch");
    notes.push(`stated ${stated}, request from ${ipc}`);
  }
  if (Number.isFinite(priorSignupsFromIp) && priorSignupsFromIp >= 1) {
    signals.push("repeat_ip");
    notes.push(
      `same IP as ${priorSignupsFromIp} other signup${priorSignupsFromIp === 1 ? "" : "s"} in ${REPEAT_IP_WINDOW_DAYS} days`,
    );
  }
  if (hostingSignal === true) {
    signals.push("vpn_or_hosting");
    notes.push("hosting or VPN signal on the request");
  }
  if (!ipc) notes.push("country unknown — no geo header on the request");

  const ordered = SIGNUP_FLAGS.filter((f) => signals.includes(f));
  return {
    flag: ordered[0] || "none",
    signals: ordered,
    reason: notes.length ? notes.join("; ") : null,
    countryKnown: Boolean(ipc),
  };
}

/** True for a row that needs somebody to look: flagged and not yet reviewed. */
export function needsReview(row) {
  return Boolean(row) && row.flag !== "none" && !row.reviewedAt;
}

/**
 * The push sent to superadmins when a flag fires. English: the console is
 * English and PlatformAdmin carries no language column (lib/notify/push.js).
 * No IP in the push — it sits on a lock screen; the row has it.
 */
export function flagPushPayload({ companyName, flag, ipCountry, via, repName = null }) {
  const where = ipCountry || "unknown country";
  const door = via === "sales_link" ? (repName ? `${repName}'s link` : "a rep link") : SIGNUP_VIA_LABELS[via] || via;
  return {
    title: `Flagged signup: ${SIGNUP_FLAG_LABELS[flag] || flag}`,
    body: `${companyName || "New company"} · ${where} · via ${door}`,
    tag: "platform-signup-flag",
    url: "/platform/signup-origins?flagged=1",
  };
}
