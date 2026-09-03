// lib/sales/calls/inboundMatch.js
//
// A contractor rings FieldQuo's own number back. Who is it, and what is that
// answer allowed to do?
//
// ══ What exists already, so none of it gets rebuilt ═══════════════════════
//
// Inbound voice to FieldQuo's own line is NOT missing. lib/platform/salesCall.js
// resolves FIELDQUO_SALES_NUMBER, the Retell agent answers, and recordSalesCall
// upserts a PlatformVoiceCall with the transcript, the summary, the recording
// and the duration. There is a superadmin screen over it at
// /platform/sales-agent. What is missing is smaller and sharper: that row knows
// a phone number and nothing else. Its own schema comment says so — fromE164 is
// "the only contact detail a sales call leaves behind".
//
// So this module is the match, and nothing more. It does not answer calls, does
// not route them, and does not talk to a vendor.
//
// ══ A caller ID is a HINT. It is never proof ══════════════════════════════
//
// This is the line the whole module exists to hold. SalesThread.replyToken is
// a secret FieldQuo issued, so a reply carrying it IS the thread — its header
// makes that argument and it is right. A calling number is the opposite: it is
// asserted by the network, it is spoofable, and anyone who knows a contractor's
// number can present it.
//
// Therefore a match may:
//   - put the prospect's card in front of whoever handles the call;
//   - tell the rep who already holds the claim that their prospect rang;
//   - be recorded on the call row as `matchedBy: "phone_e164"`.
//
// A match may NEVER:
//   - authenticate the caller as the business;
//   - lift or narrow a suppression entry;
//   - move, create or extend a claim on its own;
//   - credit an attribution, or touch anything a commission reads.
//
// matchOutcome() returns only facts and never an action, which is what makes
// that enforceable rather than a comment: there is no field on the result a
// caller could mistake for permission.
//
// ══ Ambiguity is reported, never resolved by picking ══════════════════════
//
// Prospect deduplication FLAGS duplicates rather than merging them — the
// schema says merging destroys provenance — so one number legitimately
// resolves to two rows. OMniLeads hits the same problem on its inbound console
// and sends the agent to a disambiguation screen rather than guessing; the same
// answer applies here. Two matches is `ambiguous`, with both candidates
// returned. Guessing the "best" one would attach a call to the wrong business
// and there is no way to notice afterwards.

import { normalisePhone } from "../suppressionRules";

export const MATCH_NONE = "none";
export const MATCH_PROSPECT = "prospect";
export const MATCH_LEAD = "lead";
export const MATCH_AMBIGUOUS = "ambiguous";
export const MATCH_UNKNOWN = "unknown";

/** How the match was made. One value today; stored so a second is legible. */
export const MATCHED_BY_PHONE = "phone_e164";

/**
 * Work out who rang, from candidate rows the caller has already read.
 *
 * Pure, and takes rows rather than querying, for the reason every other pure
 * module in this tree gives: the interesting cases — no number, a withheld
 * number, one prospect, two prospects, a lead but no prospect, a lead held by
 * a rep who has left — are then executed rather than reasoned about.
 *
 * ── Five outcomes, and `unknown` is not `none` ───────────────────────────
 *
 * `none` means we looked and this number belongs to nobody we know. `unknown`
 * means we could not look — a withheld caller ID, a number we cannot
 * normalise. The same three-state discipline the queue screen already renders
 * in three colours, for the same reason: telling a superadmin "not one of our
 * prospects" about a call that presented no number at all is a confident wrong
 * answer.
 *
 * @param fromE164   the calling number as the provider gave it.
 * @param prospects  Prospect rows whose phoneE164 equals the normalised number.
 * @param leads      SalesLead rows whose phone equals it.
 */
export function matchInboundCaller({ fromE164 = null, prospects = [], leads = [] } = {}) {
  const phone = normalisePhone(fromE164);
  if (!phone) {
    return {
      outcome: MATCH_UNKNOWN,
      phone: null,
      prospectId: null,
      salesLeadId: null,
      salesRepId: null,
      matchedBy: null,
      candidates: [],
      text: "The caller withheld their number, or it arrived in a shape we cannot read. Nothing was matched — that is different from matching nobody.",
    };
  }

  const p = Array.isArray(prospects) ? prospects.filter((r) => r && r.id) : [];
  const l = Array.isArray(leads) ? leads.filter((r) => r && r.id) : [];

  if (p.length > 1) {
    return {
      outcome: MATCH_AMBIGUOUS,
      phone,
      prospectId: null,
      salesLeadId: null,
      salesRepId: null,
      matchedBy: null,
      candidates: p.map((r) => ({ id: r.id, businessName: r.businessName || null })),
      text: `${p.length} discovered businesses carry this number. Duplicates are flagged rather than merged, so picking one would attach this call to the wrong company with no way to notice. Somebody has to choose.`,
    };
  }

  if (p.length === 1) {
    const row = p[0];
    return {
      outcome: MATCH_PROSPECT,
      phone,
      prospectId: row.id,
      // The lead is reported when there is exactly one, for the same reason.
      salesLeadId: l.length === 1 ? l[0].id : null,
      // Who to tell. The CURRENT claim holder, read from the row the caller
      // passed in — not a rep chosen by this module, and not authority to give
      // them anything. A lapsed claim is still the last person who spoke to
      // this business, and telling them their prospect rang back is the whole
      // point; whether they may still work it is queueGate's question, asked
      // separately.
      salesRepId: row.assignedRepId || null,
      matchedBy: MATCHED_BY_PHONE,
      candidates: [{ id: row.id, businessName: row.businessName || null }],
      text: row.businessName
        ? `${row.businessName} is ringing back on the number we hold for them.`
        : "A discovered business is ringing back on the number we hold for them.",
    };
  }

  if (l.length === 1) {
    const row = l[0];
    return {
      outcome: MATCH_LEAD,
      phone,
      prospectId: row.prospectId || null,
      salesLeadId: row.id,
      salesRepId: row.salesRepId || null,
      matchedBy: MATCHED_BY_PHONE,
      candidates: [{ id: row.id, businessName: row.businessName || null }],
      text: row.businessName
        ? `${row.businessName} — a lead ${row.salesRepId ? "one of the reps" : "somebody"} typed in.`
        : "A lead a rep typed in is ringing back.",
    };
  }

  if (l.length > 1) {
    return {
      outcome: MATCH_AMBIGUOUS,
      phone,
      prospectId: null,
      salesLeadId: null,
      salesRepId: null,
      matchedBy: null,
      candidates: l.map((r) => ({ id: r.id, businessName: r.businessName || null })),
      text: `${l.length} reps hold a lead on this number. SalesLead has no unique constraint on phone, so two reps holding one business is normal and picking one is not.`,
    };
  }

  return {
    outcome: MATCH_NONE,
    phone,
    prospectId: null,
    salesLeadId: null,
    salesRepId: null,
    matchedBy: null,
    candidates: [],
    text: "Nobody we hold carries this number. It is a cold caller, a wrong number, or a business discovery has not reached yet.",
  };
}

/**
 * Where an inbound call goes when nobody is on the floor.
 *
 * ══ There is no such thing as "outside hours" for taking a call ═══════════
 *
 * Worth stating plainly because the instinct is to build one. The calling
 * window in lib/sales/callingRules.js governs when FieldQuo may RING a
 * business; it says nothing about when a business may ring FieldQuo, and
 * refusing an inbound call at 21:00 because Oklahoma's solicitation statute
 * closes at 20:00 would be reading a rule backwards. A contractor who calls
 * the number a rep gave them is answered.
 *
 * What DOES change out of hours is who answers. The agent already answers
 * every hour of the day; the only question is whether a human is reachable
 * behind it, and that is FIELDQUO_SALES_TRANSFER_TO plus somebody being there.
 *
 * ── Why this returns a description and not a routing decision ────────────
 *
 * Because the routing is Retell's, configured in lib/platform/salesAgent.js,
 * and a second opinion here that disagreed with it would be worse than none —
 * the same argument /platform/sales-agent makes for reusing the tenant
 * readiness chain rather than writing its own. This says what will happen so a
 * screen can print it honestly. It does not make it happen.
 *
 * @param anyRepLive whether any rep in scope is in a live presence state.
 *                   `null` when the presence tables are absent — which is not
 *                   "nobody is there".
 */
export function inboundHandling({ agentEnabled = false, canTransfer = false, anyRepLive = null } = {}) {
  if (!agentEnabled) {
    return {
      answeredBy: "nobody",
      text: "FieldQuo's own phone agent is switched off, so a contractor ringing the number a rep gave them reaches nothing. Nothing records the call either.",
      tone: "gap",
    };
  }
  if (!canTransfer) {
    return {
      answeredBy: "agent",
      text: "The agent answers, takes what they say, and records it. There is no transfer destination configured, so nobody can be put through to a person — FIELDQUO_SALES_TRANSFER_TO is unset.",
      tone: "gap",
    };
  }
  if (anyRepLive === null) {
    return {
      answeredBy: "agent",
      text: "The agent answers and can put a caller through. Whether anyone is actually at their desk is not recorded yet, so this cannot say.",
      tone: "unknown",
    };
  }
  if (anyRepLive) {
    return {
      answeredBy: "agent_then_human",
      text: "The agent answers and can put the caller through to whoever is on the floor.",
      tone: "has",
    };
  }
  return {
    answeredBy: "agent",
    text: "Nobody is on the floor right now. The agent answers, takes the call and records it; the transfer will not find anybody.",
    tone: "gap",
  };
}
