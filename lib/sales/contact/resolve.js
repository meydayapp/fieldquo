// lib/sales/contact/resolve.js
//
// Turning "the rep pressed the second number in the list" into a number the
// server is willing to ring or text — and refusing everything else.
//
// ══ The browser never names a phone number ════════════════════════════════
//
// This is the whole security shape of free dial, and it is why this file
// exists rather than the routes each doing it. A request that carried
// `{ to: "+19005551234" }` would be a toll-fraud vector: one compromised rep
// session, one premium-rate number, and FieldQuo's Twilio account pays for
// every minute. There is no amount of validation on a caller-supplied number
// that fixes that — a well-formed E.164 is exactly what an attacker sends.
//
// So the wire carries an ID of a row we already stored, and the number comes
// out of the database in the request that dials. Nothing in this module's
// signature accepts a phone number from a caller, on purpose: a parameter that
// does not exist cannot be trusted by mistake.
//
// ══ How "does this number belong to this prospect" is answered ════════════
//
// NOT by reading the row by id and then comparing its prospectId to the one
// being dialled. That is two steps, and the window between them is where every
// scoping bug in this codebase has lived — the same argument
// app/api/sales/leads/[id] makes for updateMany over update.
//
// Instead the candidate rows are loaded with the prospect and the lead IN THE
// WHERE, and the chosen id is looked up inside that already-scoped set. A
// number id belonging to a different prospect is not in the set, so it is not
// found, so it is refused — by the same code path that refuses a typo. There
// is no branch to forget.
//
// The target itself was read through the rep's own scope by the caller
// (targetFor() / queueWhere()), so the chain is: rep → their claim → that
// record's numbers → the one they picked. No step trusts the step before it
// for identity.
//
// ══ Reach is decided by contactChoices, never re-implemented here ═════════
//
// lib/sales/contact/numbers.js owns "can this number carry this channel", and
// the reason it is one function is stated in its header: texting a landline is
// a SILENT SUCCESS. This module asks it and obeys the answer, including for
// the explicitly chosen number — a rep who picks the shop line for a text is
// refused with `landline_cannot_receive_text` rather than being told the
// message went.
import { db } from "@/lib/db";
import { normalisePhone } from "../suppressionRules";
import {
  CHANNEL_TEXT,
  CHANNEL_VOICE,
  contactChoices,
  defaultChoice,
  noNumberSay,
} from "./numbers";

/** The Prisma delegate this module needs, by the name that can be probed. */
export const CONTACT_NUMBER_MODEL = "salesContactNumber";

/** Is SalesContactNumber in the generated client on this deployment? */
export function contactNumberStoreReady(client = db) {
  return Boolean(client?.[CONTACT_NUMBER_MODEL]);
}

/**
 * The WHERE that finds the numbers belonging to one record, or null.
 *
 * NULL when neither id is known, and every caller must treat that as "there
 * are no alternates" rather than as "no filter". `{ OR: [{ prospectId: null },
 * { salesLeadId: null }] }` would match every hand-typed number in the
 * database — the exact shape lib/sales/scope.js warns about when it says a
 * scope fragment must never collapse to `{}`.
 */
export function contactNumberScope({ prospectId = null, salesLeadId = null } = {}) {
  const or = [];
  if (prospectId) or.push({ prospectId });
  if (salesLeadId) or.push({ salesLeadId });
  return or.length ? { OR: or } : null;
}

/** The row shape contactChoices() reads, from a Prisma row. */
function asAlternate(row) {
  return {
    id: row.id,
    e164: row.e164,
    kind: row.kind,
    label: row.label,
    // Passed through as they are stored — three-valued. Coercing a null to
    // false here would undo the whole point of the column.
    canCall: row.canCall,
    canText: row.canText,
    preferred: row.preferred,
    addedAt: row.createdAt,
    note: row.note,
  };
}

/**
 * Every number stored against a prospect and/or a lead, oldest first.
 *
 * Returns [] rather than throwing when the table is not in the client yet, so
 * a deployment behind on `prisma db push` shows the listed number and no
 * picker instead of a screen that will not render.
 */
export async function loadContactNumbers({
  prospectId = null,
  salesLeadId = null,
  client = db,
} = {}) {
  const where = contactNumberScope({ prospectId, salesLeadId });
  if (!where) return [];
  if (!contactNumberStoreReady(client)) return [];
  return client[CONTACT_NUMBER_MODEL]
    .findMany({ where, orderBy: { createdAt: "asc" } })
    .catch(() => []);
}

/**
 * Which number will actually be used, decided over rows already in hand.
 *
 * Pure, so scripts/check-free-dial.mjs drives it against every hostile shape
 * without a database: an id from another prospect, a malformed id, a landline
 * chosen for a text, one of FieldQuo's own numbers, a suppressed contractor,
 * no numbers at all, the same number twice.
 *
 * @param target          what targetFor() returned — `phoneE164` is the number
 *                        already on the record. Read, never written.
 * @param rows            SalesContactNumber rows loaded through
 *                        contactNumberScope(). This function does NOT re-check
 *                        which record they belong to, because they were loaded
 *                        by it; that is why loadContactNumbers is the only
 *                        supported way to get them.
 * @param contactNumberId the row the rep picked, or null for "you choose".
 * @param channel         CHANNEL_VOICE or CHANNEL_TEXT.
 * @param ourNumbers      FieldQuo's own numbers, from ownNumbers().
 * @param blocked         true when the business is do-not-contact or opted
 *                        out — every number of theirs is refused, not just the
 *                        listed one.
 *
 * @returns {{ok:boolean, e164:string|null, choice:object|null,
 *            numberId:string|null, choices:Array, refused:Array,
 *            code:string|null, error:string|null}}
 */
export function pickContactNumber({
  target = null,
  rows = [],
  contactNumberId = null,
  channel = CHANNEL_VOICE,
  ourNumbers = [],
  blocked = false,
  blockedReason = null,
} = {}) {
  const alternates = (Array.isArray(rows) ? rows : []).map(asAlternate);
  const result = contactChoices(
    {
      primary: target?.phoneE164 || null,
      alternates,
      ourNumbers,
      blocked,
      blockedReason,
    },
    { channel },
  );

  const shape = (extra) => ({
    e164: null,
    choice: null,
    numberId: null,
    choices: result.choices,
    refused: result.refused,
    code: null,
    error: null,
    ...extra,
  });

  const wanted = typeof contactNumberId === "string" ? contactNumberId.trim() : "";

  // A whole-business refusal carries its OWN sentence — "they replied STOP on
  // 2 September" — and that sentence is the one a rep needs. contactChoices()
  // puts it in `reason`, so it must not be run through the generic mapping
  // below, which would replace a specific fact with a category.
  const blockedSay = blocked ? blockedReason || sayRefusal("blocked", channel) : null;

  if (!wanted) {
    const pick = defaultChoice(result);
    if (!pick) {
      return shape({
        ok: false,
        code: result.reason || "no_number",
        // noNumberSay() answers `no_number` and `all_refused`; a whole-business
        // block is not one of those and gets sayRefusal's sentence instead. The
        // fallback matters — an empty refusal reads to a rep as a broken screen.
        error:
          blockedSay ||
          noNumberSay(result, channel) ||
          sayRefusal(result.reason || "no_number", channel),
      });
    }
    return shape({ ok: true, e164: pick.e164, choice: pick, numberId: pick.id || null });
  }

  // ── The membership check, and there is only one ─────────────────────────
  //
  // `rows` came out of contactNumberScope(), so an id belonging to somebody
  // else's prospect is simply not here. A malformed id is not here either, and
  // both get the same refusal, which is correct: telling a caller apart from a
  // typo which ids exist is how an id becomes an oracle.
  const row = alternates.find((r) => r.id === wanted);
  if (!row) {
    return shape({
      ok: false,
      code: "not_on_this_record",
      error:
        "That number is not one of the numbers stored against this record. Nothing was dialled. " +
        "Reload the screen — if it was just added, this list is older than it is.",
    });
  }

  const e164 = normalisePhone(row.e164);
  const pick = result.choices.find((c) => c.e164 === e164) || null;
  if (!pick) {
    // Refused, and the reason is the one contactChoices already worked out.
    // Re-deriving it here would be a second opinion, and a second opinion that
    // disagreed is how a landline gets texted.
    const why = result.refused.find((r) => r.e164 === e164)?.why || result.reason || "refused";
    return shape({ ok: false, code: why, error: blockedSay || sayRefusal(why, channel) });
  }

  return shape({ ok: true, e164: pick.e164, choice: pick, numberId: row.id });
}

/** The sentence for each refusal code, written for the rep on the phone. */
export function sayRefusal(why, channel = CHANNEL_VOICE) {
  if (why === "landline_cannot_receive_text") {
    return (
      "That one is recorded as a landline, and a text to a landline is accepted by the carrier " +
      "and delivered to nobody — there is no bounce and no error, so nothing would ever tell you " +
      "it failed. Ring it instead, or ask them where to text."
    );
  }
  if (why === "one_of_ours") {
    return (
      "That is one of FieldQuo's own numbers, so there is nothing to reach. If it really is this " +
      "business's number, it is on one of our number lists by mistake."
    );
  }
  if (why === "not_a_number") {
    return "That row does not hold a number we can use. Add it again in full, with the country code.";
  }
  if (why === "not_callable") {
    return "Somebody recorded that this number must not be called, so no call is placed to it.";
  }
  if (why === "blocked" || why === "do_not_contact" || why === "opted_out") {
    return (
      "This business asked us to stop, and that covers every number of theirs — including one " +
      "they gave us later. Only a superadmin can lift it, and it needs a written reason."
    );
  }
  return channel === CHANNEL_TEXT
    ? "That number cannot be texted."
    : "That number cannot be called.";
}

/**
 * Load, then pick — the one call a route makes.
 *
 * Two steps rather than one function so the deciding half stays pure and
 * executable; this is the thin async wrapper the routes actually use, so
 * neither of them writes its own version of the query.
 */
export async function chooseContactNumber({
  target = null,
  contactNumberId = null,
  channel = CHANNEL_VOICE,
  ourNumbers = [],
  blocked = false,
  blockedReason = null,
  client = db,
} = {}) {
  const rows = await loadContactNumbers({
    prospectId: target?.prospectId || null,
    salesLeadId: target?.leadId || null,
    client,
  });
  return pickContactNumber({
    target,
    rows,
    contactNumberId,
    channel,
    ourNumbers,
    blocked,
    blockedReason,
  });
}
