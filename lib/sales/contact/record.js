// lib/sales/contact/record.js
//
// Writing a number a rep was given onto the record they hold — the ONE
// write, shared by the numbers route (a typed dial number, "call him on his
// cell") and by the text-thread opener (a "Text them" press on a number the
// lead does not carry yet).
//
// ══ Why this left app/api/sales/calls/numbers/route.js ════════════════════
//
// The route's POST held the whole rule inline: normalise through the
// suppression list's own function, refuse a do-not-contact business, refuse
// FieldQuo's own test lines and test accounts, fold a duplicate into the row
// it already has, survive the unique-constraint race. When "Text them" needed
// the same write from a second door, the choice was a copy or a function.
// AGENTS.md's fourth failure class says which: the copy is the one that
// rots, because it is the one nobody looks at. The route now calls this;
// nothing about what it writes changed.
//
// ══ What it never does ════════════════════════════════════════════════════
//
// Same as the route's header: it never touches Prospect.phoneE164 or
// SalesLead.phone — those are identity — and it deletes nothing.
import { db } from "@/lib/db";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { isTestLine } from "@/lib/sales/testLines";
import { loadTestLines } from "@/lib/sales/testLinesStore";
import { KIND_UNKNOWN, isKind } from "@/lib/sales/contact/numbers";
import { loadContactNumbers } from "@/lib/sales/contact/resolve";
import { bareAddress, isPlausibleEmail } from "@/lib/sales/outreach";

export const MAX_LABEL = 80;
export const MAX_NOTE = 500;

/**
 * A three-valued flag off the wire.
 *
 * `undefined` and `null` both mean "nobody said", and that is NOT false —
 * AGENTS.md failure class #5. Only a real boolean becomes a real boolean, so a
 * form that leaves the question blank stores a null and lib/sales/contact/
 * numbers.js falls back to what the KIND implies.
 */
export function tristate(value) {
  if (value === true || value === false) return value;
  return null;
}

/** The refusals, so both doors say the same sentence and a check can hold them to it. */
export const RECORD_REFUSALS = Object.freeze({
  do_not_contact: "This business asked not to be contacted, so no further numbers are recorded for them.",
  unreadable:
    "That isn't a number we can dial. Put it in full, with the country code — nothing here " +
    "guesses the missing digits.",
  test_line: "That is one of FieldQuo's own test lines. It is not saved on this record — a test dial rings it as it is.",
  test_account: "This is a test account. A number it types is not saved on the record — a test dial rings it as it is.",
});

/**
 * Record one number on a record the caller has ALREADY scoped to the rep.
 *
 * @param owner  `{ prospectId, salesLeadId, doNotContactAt }` — the numbers
 *               route's ownerFor() shape; the caller has verified it is the
 *               rep's own record.
 * @param rep    the gate's fresh rep row (testAccount is read off it).
 * @returns { ok: true, e164, id, updated }
 *        | { ok: false, status, code, error, e164? }
 *
 * `test_line` / `test_account` carry the normalised e164 with the refusal —
 * the dial pad rings it UNSAVED as `typedE164`, and the text opener keys the
 * thread on it without writing it onto anybody's record.
 */
export async function recordContactNumber({
  owner,
  rep,
  e164: raw,
  kind = KIND_UNKNOWN,
  label = null,
  canCall,
  canText,
  preferred = false,
  note = null,
  client = db,
} = {}) {
  // Refused rather than stored. A business that asked us to stop must not
  // acquire a new dialable number on our side — offering their cell because it
  // arrived later would be the same call they refused.
  if (owner?.doNotContactAt) {
    return { ok: false, status: 409, code: "do_not_contact", error: RECORD_REFUSALS.do_not_contact };
  }

  // Normalised through the SAME function the suppression list, the calling gate
  // and Twilio key on. A number stored in any other shape is a number no
  // suppression row can ever match — it would look clean forever.
  const e164 = normalisePhone(raw);
  if (!e164) return { ok: false, status: 400, code: "unreadable", error: RECORD_REFUSALS.unreadable };

  // ── Our own phone, or our own tester: not written onto their record ───
  //
  // A number on the test-line list is FieldQuo's (lib/sales/testLines.js),
  // and a test account (SalesRep.testAccount) is FieldQuo testing. Neither
  // belongs in a business's contact list: the owner rang his own mobile
  // from DRAIN KINGS's card on 2026-09-17 and the console offered to file
  // it as theirs, which would have polluted that record, its suppression
  // history and every future pick.
  const testLineHit = isTestLine(e164, await loadTestLines({ client }));
  if (testLineHit || rep?.testAccount === true) {
    const code = testLineHit ? "test_line" : "test_account";
    return { ok: false, status: 409, code, error: RECORD_REFUSALS[code], e164 };
  }

  const data = {
    prospectId: owner.prospectId || null,
    salesLeadId: owner.salesLeadId || null,
    e164,
    kind: isKind(kind) ? kind : KIND_UNKNOWN,
    label: typeof label === "string" ? label.trim().slice(0, MAX_LABEL) || null : null,
    canCall: tristate(canCall),
    canText: tristate(canText),
    preferred: preferred === true,
    addedBySalesRepId: rep.id,
    note: typeof note === "string" ? note.trim().slice(0, MAX_NOTE) || null : null,
  };

  const scope = { prospectId: owner.prospectId || null, salesLeadId: owner.salesLeadId || null, client };
  // ── The same number twice, which is the ordinary case ───────────────────
  //
  // A rep is on the phone while typing. They will re-enter a number that is
  // already on the record — because they forgot, or because they are
  // correcting what they were told the first time. Two identical rows would be
  // two indistinguishable entries in the dial picker, so the second write
  // UPDATES the first rather than adding to it, and the response says which
  // happened. The database's own unique constraint is the backstop for the
  // race, not the read below.
  const existing = (await loadContactNumbers(scope)).find((r) => normalisePhone(r.e164) === e164);
  if (existing) {
    await client.salesContactNumber.updateMany({
      where: { id: existing.id },
      data: { ...data, prospectId: undefined, salesLeadId: undefined },
    });
    return { ok: true, e164, id: existing.id, updated: true };
  }
  try {
    const row = await client.salesContactNumber.create({ data, select: { id: true } });
    return { ok: true, e164, id: row.id, updated: false };
  } catch (err) {
    // P2002 means another tab won the race a moment ago. That is the same
    // outcome the rep asked for, so it is a success with the second write
    // folded into the first rather than an error they cannot act on.
    if (err?.code !== "P2002") throw err;
    const race = (await loadContactNumbers(scope)).find((r) => normalisePhone(r.e164) === e164);
    if (!race) throw err;
    await client.salesContactNumber.updateMany({
      where: { id: race.id },
      data: { ...data, prospectId: undefined, salesLeadId: undefined },
    });
    return { ok: true, e164, id: race.id, updated: true };
  }
}

// ── An email address, the same way ──────────────────────────────────────
//
// The intro email's pop-up (lib/sales/outreach/introSend.js) lets a rep
// type "send it to my other address". That address has to be ON THE RECORD
// before anything goes to it — lib/sales/emailRecipients.js's closed set is
// the rule — so this is the one write, mirroring recordContactNumber: the
// same refusal for a do-not-contact business, the same refusal for a test
// account (FieldQuo's own tester must not put an address on a business's
// record), the duplicate folded into the row it already has, the race
// survived. The lead's own `email` column is not touched here — it is the
// lead's identity, and a rep who wants it changed edits the lead.

export const EMAIL_REFUSALS = Object.freeze({
  unreadable: "That doesn't look like an email address.",
  do_not_contact: RECORD_REFUSALS.do_not_contact,
  test_account: "This is a test account. An address it types is not saved on the record.",
});

/**
 * Record one address on a lead the caller has ALREADY scoped to the rep.
 *
 * @param lead   `{ id, email, prospect?: { doNotContactAt } }`
 * @param rep    the gate's fresh rep row.
 * @returns { ok: true, email, id: string|null, updated: boolean, onLead: boolean }
 *        | { ok: false, status, code, error }
 *
 * `onLead: true` with `id: null` means the address IS the lead's own column
 * already, so nothing was written.
 */
export async function recordContactEmail({ lead, rep, email: raw, client = db } = {}) {
  if (!lead?.id) throw new Error("recordContactEmail needs the lead");
  if (lead.prospect?.doNotContactAt) {
    return { ok: false, status: 409, code: "do_not_contact", error: EMAIL_REFUSALS.do_not_contact };
  }
  const email = bareAddress(raw);
  if (!email || !isPlausibleEmail(email)) {
    return { ok: false, status: 400, code: "unreadable", error: EMAIL_REFUSALS.unreadable };
  }
  if (rep?.testAccount === true) {
    return { ok: false, status: 409, code: "test_account", error: EMAIL_REFUSALS.test_account, email };
  }
  if (bareAddress(lead.email) === email) return { ok: true, email, id: null, updated: false, onLead: true };

  const data = { salesLeadId: lead.id, email, addedBySalesRepId: rep.id };
  const existing = await client.salesContactEmail.findFirst({ where: { salesLeadId: lead.id, email }, select: { id: true } });
  if (existing) return { ok: true, email, id: existing.id, updated: true, onLead: false };
  try {
    const row = await client.salesContactEmail.create({ data, select: { id: true } });
    return { ok: true, email, id: row.id, updated: false, onLead: false };
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    const race = await client.salesContactEmail.findFirst({ where: { salesLeadId: lead.id, email }, select: { id: true } });
    if (!race) throw err;
    return { ok: true, email, id: race.id, updated: true, onLead: false };
  }
}
