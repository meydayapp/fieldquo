// lib/sales/transferNumbers.js
//
// The phones a live caller may be handed to that are not a rep's browser.
//
// ══ Why a list, and why a superadmin keeps it ═════════════════════════════
//
// The owner, 2026-09-17, 23:20 ET, on a live call with every other rep
// offline: pressed Transfer and was told "Nobody else is free right now".
// True, and useless — a caller must still be hand-off-able to a phone
// FieldQuo trusts: the owner's own mobile, the office desk line.
//
// The obvious build is a number field on the picker. It was rejected before
// it was written, for the reason docs/sales-intel/OMNILEADS-STUDY.md §1
// records: nothing in a rep's request may choose a destination. A transfer
// leg is an outbound call placed on FieldQuo's account, and a typed number is
// toll fraud with a friendlier name — one compromised rep cookie and the
// dialler rings premium numbers all night. So the destinations are a LIST,
// kept by a superadmin on /platform/sales/windows beside the test lines,
// audited on every change, and the rep sees LABELS. The browser sends back
// the entry's id; the server looks the number up in its own copy of the list
// and dials that. The number never makes the round trip.
//
// ══ Where the list lives ══════════════════════════════════════════════════
//
// One PlatformSetting row, key TRANSFER_NUMBERS_SETTING_KEY, holding a JSON
// array of `{ e164, label }`. The same arrangement as lib/sales/testLines.js
// and for the same reason: ten entries is a list, not a table, and the
// console already has the card pattern. lib/sales/transferNumbersStore.js is
// the database half; this file is pure so lib/sales/calls/transfer.js and
// scripts/check-call-transfer.mjs can run it under bare node.
//
// ══ FIELDQUO_SALES_TRANSFER_TO is one entry of this list ══════════════════
//
// The env var predates the list and is the number the inbound router rings
// when the floor is empty. It keeps working: `standingTransferEntry` turns it
// into an entry with the label the picker always gave it, and
// `transferNumberEntries` merges it behind the list, de-duplicated on the
// number. A deployment with the env set and no list behaves exactly as
// before this file existed.
import { normalisePhone } from "./suppressionRules";

/** The PlatformSetting key. */
export const TRANSFER_NUMBERS_SETTING_KEY = "sales.transferNumbers";

/** More than this is not a hand-off list; it is a phone book. */
export const MAX_TRANSFER_NUMBERS = 10;

/** A label is a name on a button. Longer than this wraps into two. */
export const MAX_TRANSFER_LABEL_CHARS = 40;

/** What the env var's entry is called on the picker. */
export const STANDING_TRANSFER_LABEL = "the standing transfer number";

/**
 * An opaque, stable id for one number.
 *
 * The picker's key for a phone target is `number:<id>`, never
 * `number:<e164>`, so that what the browser echoes back carries no number in
 * it — the server resolves the id against the list it read in the same
 * request. Derived rather than stored so the list needs no id column and an
 * entry keeps its id across a relabel: FNV-1a over the E.164, which is not
 * secret and not security, only a handle that is not the number.
 */
export function transferNumberId(e164) {
  const phone = normalisePhone(e164);
  if (!phone) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < phone.length; i++) {
    h ^= phone.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `n${h.toString(16).padStart(8, "0")}`;
}

/** The label as stored: trimmed, single-spaced, capped. Empty when unusable. */
function cleanLabel(label) {
  if (typeof label !== "string") return "";
  return label.replace(/\s+/g, " ").trim().slice(0, MAX_TRANSFER_LABEL_CHARS).trim();
}

/**
 * The list as stored, read defensively.
 *
 * Accepts the array itself or `{ numbers: [...] }`; anything else is an
 * empty list. Every entry goes through normalisePhone (so "+1 (416) 555-0100"
 * and "+14165550100" are one number); an entry without a dialable number or
 * without a label is DROPPED rather than kept — a button with no name, or a
 * name with no phone behind it, is the dead control AGENTS.md forbids;
 * duplicates collapse on the number, first label wins; and the list is cut
 * at MAX_TRANSFER_NUMBERS. A setting that cannot be read yields NO phone
 * targets, which the picker says in words.
 *
 * @returns `[{ id, e164, label }]`
 */
export function normaliseTransferNumbers(value) {
  const raw = Array.isArray(value) ? value : Array.isArray(value?.numbers) ? value.numbers : [];
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e164 = normalisePhone(entry.e164);
    const label = cleanLabel(entry.label);
    if (!e164 || !label) continue;
    if (out.some((x) => x.e164 === e164)) continue;
    out.push({ id: transferNumberId(e164), e164, label });
    if (out.length >= MAX_TRANSFER_NUMBERS) break;
  }
  return out;
}

/**
 * Which entries of a submitted list the normaliser would drop, and why —
 * so the console can refuse a save naming the entry rather than save short.
 */
export function rejectedTransferNumbers(value) {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set();
  const rejected = [];
  raw.forEach((entry, i) => {
    const e164 = entry && typeof entry === "object" ? normalisePhone(entry.e164) : null;
    const label = entry && typeof entry === "object" ? cleanLabel(entry.label) : "";
    if (!e164) rejected.push({ index: i, entry, reason: "not a number that can be dialled" });
    else if (!label) rejected.push({ index: i, entry, reason: "needs a label" });
    else if (seen.has(e164)) rejected.push({ index: i, entry, reason: "already on the list" });
    else seen.add(e164);
  });
  return rejected;
}

/** The env var, as one entry, or null when it is unset or not E.164. */
export function standingTransferEntry(transferTo) {
  const e164 = normalisePhone(transferTo);
  if (!e164) return null;
  return { id: transferNumberId(e164), e164, label: STANDING_TRANSFER_LABEL, standing: true };
}

/**
 * The phones a rep may hand a caller to: the list, then the standing number
 * when it is not already on the list.
 *
 * @param list      normaliseTransferNumbers() output.
 * @param standing  standingTransferEntry() output, or null.
 */
export function transferNumberEntries({ list = [], standing = null } = {}) {
  const out = (Array.isArray(list) ? list : []).filter((e) => e?.e164 && e?.label);
  if (standing?.e164 && !out.some((e) => e.e164 === standing.e164)) out.push(standing);
  return out;
}
