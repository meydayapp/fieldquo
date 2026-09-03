// lib/purchasing/poNumber.js
//
// PO numbers, which are per COMPANY and not global.
//
// ══ Why a collision across companies is correct ════════════════════════════
//
// Two contractors both having PO-001 is not a bug to be designed around — it
// is what a contractor expects, and the schema says so with
// `@@unique([companyId, number])` rather than `@unique` on `number`. A global
// sequence would mean a painter's first purchase order is PO-4417, which looks
// like FieldQuo's number rather than theirs, and immediately tells their
// supplier how many other companies use this software.
//
// This is the same reasoning invoice numbering already follows here.
//
// The mechanical consequence: nextNumber() is only ever handed ONE company's
// numbers. It has no way to see another tenant's, so it cannot avoid a
// collision it should not be avoiding.
//
// Pure. The caller does the query.

/** The default shape. Stored as text, so a company could adopt its own. */
export const PO_PREFIX = "PO-";
const PAD = 3;

/** 1 -> "PO-001", 1000 -> "PO-1000". Padding is a floor, never a ceiling. */
export function formatPoNumber(n, prefix = PO_PREFIX) {
  const value = Math.max(1, Math.trunc(Number(n) || 0));
  return `${prefix}${String(value).padStart(PAD, "0")}`;
}

/**
 * The numeric tail of an existing number, or null.
 *
 * Deliberately tolerant of the prefix: a company that renamed theirs to
 * "PO/2026-014" still has a 14 in it, and the next one should be 15 rather
 * than restarting at 1 and colliding with their own history. Reads the LAST
 * run of digits so a year in the middle is not mistaken for the sequence.
 */
export function poSequence(number) {
  const matches = String(number || "").match(/\d+/g);
  if (!matches) return null;
  const last = matches[matches.length - 1];
  const n = Number(last);
  return Number.isFinite(n) ? n : null;
}

/**
 * The next number for ONE company.
 *
 * @param existing  every PO number this company already has. NOT every PO
 *                  number in the database — see the header.
 * @param prefix    the company's own prefix, if it has one.
 */
export function nextPoNumber(existing, prefix = PO_PREFIX) {
  let highest = 0;
  for (const n of Array.isArray(existing) ? existing : []) {
    const seq = poSequence(n);
    if (seq !== null && seq > highest) highest = seq;
  }
  return formatPoNumber(highest + 1, prefix);
}
