// lib/sales/registrations.js
//
// Which telemarketer registrations FieldQuo actually holds, laid over the law.
//
// ══ Two different kinds of fact, kept apart ═══════════════════════════════
//
// lib/sales/callingRules.js says what each jurisdiction REQUIRES. That is
// research — statute numbers, exemptions read and rejected, the citation a rep
// can be shown — and it belongs in a file somebody reviews in a diff.
//
// Whether the certificate is in hand is not research. It is a fact about this
// company today, and it used to live as `registration.done: true` in that same
// table. Three things were wrong with that: it took a deploy to record a
// filing, it recorded no certificate number and no author, and a constant
// cannot expire. Utah, New Jersey and Wisconsin all renew annually. A hardcoded
// `true` goes on saying "registered" for as long as nobody re-reads the file.
//
// So the law stays in the table, the certificates are rows, and this module is
// the one place they are combined.
//
// ══ Absent means NOT registered, always ═══════════════════════════════════
//
// Every function here defaults to the gated answer. No certificate, an expired
// certificate, a revoked one, a row for a jurisdiction the table has never
// heard of — all of them leave `registration.done` exactly as the law file left
// it, which is `false`. There is no path through this file that opens a
// jurisdiction by accident, and check-telemarketer-registration.mjs walks each
// one.
//
// ══ Pure, so both sides can run it ════════════════════════════════════════
//
// The queue screen re-evaluates the calling window on a thirty-second timer
// with the client's own copy of the table, so the overlay has to reach the
// browser too. It travels as a list of jurisdiction KEYS — never as rows, which
// carry a certificate number nobody outside the platform console needs — and
// both sides apply it with the same function.
import { CALLING_JURISDICTIONS, jurisdictionKey } from "./callingRules";

/**
 * Is this certificate live right now?
 *
 * Revoked outranks everything, then expiry. `expiresAt: null` means it does not
 * expire — the recording screen makes a superadmin say so explicitly rather
 * than leaving the field blank by omission, because "no expiry" and "we did not
 * ask" are different facts and only one of them is safe.
 */
export function certificateIsLive(row = {}, now = new Date()) {
  if (!row || typeof row.jurisdictionKey !== "string" || !row.jurisdictionKey) return false;
  if (!row.certificateNumber) return false;
  if (row.revokedAt) return false;
  const registered = row.registeredAt ? new Date(row.registeredAt) : null;
  // A certificate dated in the future has not taken effect. This is not
  // hypothetical: several of these registrations are filed weeks ahead of the
  // date they run from, and Alaska requires notice thirty days before the
  // campaign.
  if (!registered || Number.isNaN(registered.getTime()) || registered > now) return false;
  if (!row.expiresAt) return true;
  const expires = new Date(row.expiresAt);
  if (Number.isNaN(expires.getTime())) return false;
  return expires > now;
}

/**
 * The jurisdiction keys FieldQuo is registered in, from a set of rows.
 *
 * This is the whole of what crosses the wire to a browser. A key is public
 * information — the law file that lists it ships to the client already — where
 * a certificate number and a bond are not.
 */
export function registeredKeys(rows = [], now = new Date()) {
  const keys = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (certificateIsLive(row, now)) keys.add(row.jurisdictionKey);
  }
  return [...keys].sort();
}

/**
 * The calling-rules table with the certificates FieldQuo holds applied to it.
 *
 * Returns a NEW table. Mutating CALLING_JURISDICTIONS would make the answer
 * depend on which request ran first on a warm serverless instance, which is the
 * worst possible bug to have in a compliance gate: correct in every test, wrong
 * in production, and only under load.
 *
 * A key that names no row in the table is ignored rather than added. The table
 * is the list of jurisdictions anybody has read; a certificate for a place
 * nobody has read the law of does not make that place callable, and inventing a
 * row for it would manufacture a verified jurisdiction out of a text field.
 */
export function withRegistrations(keys = [], { jurisdictions = CALLING_JURISDICTIONS } = {}) {
  const held = new Set(Array.isArray(keys) ? keys : []);
  if (!held.size) return jurisdictions;

  const next = {};
  for (const [code, row] of Object.entries(jurisdictions)) {
    // Only rows that REQUIRE registration are touched. Setting `done` on a row
    // with no requirement would be meaningless, and setting it on `null` would
    // fabricate a requirement that does not exist.
    if (held.has(code) && row?.registration?.required === true) {
      next[code] = { ...row, registration: { ...row.registration, done: true } };
    } else {
      next[code] = row;
    }
  }
  return next;
}

/**
 * One jurisdiction, as the platform console shows it: what the law wants, what
 * we hold, and what is wrong with what we hold.
 *
 * `state` is the single word a screen renders, and the four are deliberately
 * distinct rather than a boolean. "Never filed" and "lapsed last month" call
 * for different actions, and a screen that painted both as "not registered"
 * would hide a renewal that is one form away from being current.
 */
export function registrationStatus(code, rows = [], { jurisdictions = CALLING_JURISDICTIONS, now = new Date() } = {}) {
  const law = jurisdictions[code] || null;
  const required = law?.registration?.required === true;
  const row = (Array.isArray(rows) ? rows : []).find((r) => r?.jurisdictionKey === code) || null;

  if (!required) return { code, required: false, state: "not_required", certificate: null };
  if (!row) return { code, required: true, state: "outstanding", certificate: null };

  const certificate = {
    certificateNumber: row.certificateNumber,
    registeredAt: row.registeredAt,
    expiresAt: row.expiresAt ?? null,
    note: row.note ?? null,
  };
  if (row.revokedAt) {
    return { code, required: true, state: "revoked", certificate, revokedReason: row.revokedReason ?? null };
  }
  if (!certificateIsLive(row, now)) {
    // Distinguished from "outstanding" on purpose: a lapsed certificate is a
    // renewal, and the number to renew against is right there.
    const registered = row.registeredAt ? new Date(row.registeredAt) : null;
    const notYet = registered && registered > now;
    return { code, required: true, state: notYet ? "not_yet_effective" : "expired", certificate };
  }
  return { code, required: true, state: "registered", certificate };
}

/**
 * Certificates that are live now but will not be in `withinDays`.
 *
 * The thing the old boolean could not do at all. Ordered soonest first, so the
 * console can say which renewal is next rather than which jurisdiction happens
 * to sort first alphabetically.
 */
export function expiringSoon(rows = [], { now = new Date(), withinDays = 60 } = {}) {
  const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => certificateIsLive(r, now) && r.expiresAt && new Date(r.expiresAt) <= horizon)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
}

/**
 * Is this a jurisdiction key the law file has actually read?
 *
 * The write path's guard. A free-text key would let somebody record a
 * certificate against "Washington" or "WA " or a typo, and the overlay would
 * silently never match it — a filing that looks recorded and gates nothing.
 */
export function isKnownJurisdictionKey(key, { jurisdictions = CALLING_JURISDICTIONS } = {}) {
  return typeof key === "string" && Object.hasOwn(jurisdictions, key);
}

/** The key for a country/region pair, so a caller never spells one by hand. */
export { jurisdictionKey };
