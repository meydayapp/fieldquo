// lib/sales/checkin/store.js
//
// The check-in engine, wired to a conversation and to a table.
//
// ══ What was missing, and it was the whole thing ═══════════════════════════
//
// lib/sales/checkin/signals.js and lib/sales/checkin/draft.js were written,
// tested against thirty branches by scripts/check-sales-checkin.mjs — and
// imported by NOTHING. No route, no screen, no job. A rep could not have seen
// a check-in draft on any surface of this product. That is the failure mode
// this repo has hit before and written down: "every check proved code correct;
// none proved it reachable". This file is the reachability.
//
// ══ The order the two halves run in, and why the cheap one runs twice ══════
//
// A full decision needs the company's setup snapshot, which is a dozen queries
// against a CONTRACTOR's own tables. Running that on every thread open would
// make opening a conversation cost more than sending one.
//
// So the decision is taken twice with the SAME function and different
// evidence: once with `setup: null`, which is cheap and needs only the company
// row the rep can already see, and again with the snapshot only if the first
// pass did not already suppress. That is safe in one direction and it is worth
// stating why rather than trusting it: the six suppressions
// (demo / no signup date / subscription ended / too soon / recently checked in
// / milestone passed) depend on the company row, the clock and the last
// check-in, never on the setup facts. The only reason the cheap pass can raise
// that the full one might not is `unknown_state`, whose urgency is 30 — below
// PROBLEM_URGENCY, so it cannot flip `milestone_passed` either. A cheap pass
// that suppresses therefore proves the full pass would too.
//
// Two calls to one function rather than a second, cheaper predicate. A second
// predicate is the copy that rots (AGENTS.md failure class #4), and the way it
// would rot here is silent: a rep gets drafts for companies the engine would
// have refused.
//
// ══ Reading a contractor's setup is a READ, and stays one ══════════════════
//
// Non-negotiable #3 — the platform side looks, it does not touch. Nothing in
// this file writes to a tenant's tables. The only table it writes is
// SalesCheckIn, which is FieldQuo's own, and REP_CHECKIN_WRITES names it so a
// check can assert that rather than take this paragraph's word for it.
import { resolveLeadTimeZone } from "@/lib/sales/leadTimeZone";
import { db } from "@/lib/db";
import { loadSetupSnapshot } from "@/lib/setupStepsSnapshot";
import { stepsFor } from "@/lib/setupSteps";
import { assignedCompanyWhere, REP_COMPANY_SELECT } from "../scope";
import { normalisePhone } from "../suppressionRules";
// The ONE function that puts a rep's own words on a contractor's phone. A
// check-in reaches the carrier through it and through nothing else — see
// sendCheckIn() below.
import { deliverReplySms } from "../salesSms";
import { checkInSignals } from "./signals";
import { draftCheckIn, ruleDraft } from "./draft";
import { defaultScheduleFor } from "./schedule";
import { engineDedupeKey } from "./plan";
import { insertDraftRow } from "./rows";

// The daily key lives in plan.js (pure, no send path) so the backlog and the
// check can import it without this module; re-exported so the create route
// and the checks keep one import.
export { engineDedupeKey };

/**
 * The tables a rep's check-in routes write, and the complete list of them.
 *
 * Declared as data, the way lib/sales/smsGate.js declares REP_SMS_WRITES and
 * lib/sales/payoutWrite.js declares PAYOUT_WRITES_ON_SALES_REP, so
 * scripts/check-sales-messages.mjs can assert it rather than read a sentence.
 *
 * Its own constant rather than an entry appended to REP_SMS_WRITES: that list
 * is asserted to name exactly two models for exactly one route
 * (app/api/sales/sms), by scripts/check-sales-sms.mjs, and widening a
 * neighbouring route's permission by editing somebody else's fence is how a
 * narrow exception becomes a general one. Same argument smsGate's own header
 * makes about not adding a mode parameter to gate.js.
 *
 * The SEND path writes SalesSmsMessage as well — through deliverReplySms, the
 * same function the reply box uses, with every gate it carries. That is not a
 * second permission: it is the existing one, reached from a second button.
 */
export const REP_CHECKIN_WRITES = ["salesCheckIn"];

/** The complete status vocabulary. There is no "scheduled" — see the schema. */
export const CHECKIN_STATUSES = Object.freeze(["draft", "sent", "dismissed"]);

/** How much of the rep's lead book to scan for a phone match. */
const LEAD_SCAN_LIMIT = 500;

/**
 * The lead behind a phone number, matched on the NORMALISED number.
 *
 * ══ What this replaces, which was a real bug ═══════════════════════════════
 *
 * app/api/sales/messages/route.js used to ask for "this rep's most recently
 * updated lead that has a phone at all", then throw it away if the phone did
 * not match. For any rep with more than one lead that is almost always a miss,
 * so `thread.lead` was almost always null — and the lead is where the
 * prospect's TIME ZONE lives. A null lead meant a null zone, and a null zone
 * means lib/sales/smsWindow.js refuses the send, correctly, with "we don't
 * know what time it is where this prospect is". The reply box was refusing
 * nearly every reply for a reason that had nothing to do with the clock.
 *
 * Matching in JavaScript rather than in the WHERE because `phone` is stored as
 * the rep typed it — "(514) 555-0134" and "+15145550134" are the same prospect
 * and no SQL equality sees that. normalisePhone is the one function that
 * decides what two numbers being equal means, and it already exists.
 */
export async function leadForThread({ salesRepId, toE164, client = db } = {}) {
  const other = normalisePhone(toE164);
  if (!other || !salesRepId) return null;

  const candidates = await client.salesLead.findMany({
    where: { salesRepId, phone: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: LEAD_SCAN_LIMIT,
    select: {
      id: true,
      businessName: true,
      contactName: true,
      phone: true,
      timeZone: true,
      status: true,
      convertedCompanyId: true,
      salesRepId: true,
      // For the conversation's context bar: where they are, how to reach
      // them otherwise, and the prospect row their trade and score hang off.
      email: true,
      province: true,
      country: true,
      prospectId: true,
      prospect: { select: { country: true, province: true } },
    },
  });

  // Newest-first, so when a contractor holds two lead rows the current one
  // wins. Both are the same conversation either way — with one exception: a
  // lead that CONVERTED into a company is the current one whatever its
  // updatedAt says. The owner's own test number sits on two older leads
  // ("Loop INc", "truefinish cabinets") and on the company that actually
  // signed up; a thread named after the lead somebody last edited would show
  // the wrong business above the company's check-in.
  const matches = candidates.filter((lead) => normalisePhone(lead.phone) === other);
  return matches.find((lead) => lead.convertedCompanyId) || matches[0] || null;
}

/**
 * Everything a thread needs to know about who it is with.
 *
 * @returns `{ lead, company, timeZone }` — any of which may be null, and null
 *   means "not known", never a default. A company is only ever returned when
 *   the rep's own attribution predicate says it is theirs: the lead's
 *   `convertedCompanyId` is a pointer, not a grant, and the read re-checks it
 *   through assignedCompanyWhere the same way every other rep-facing company
 *   read does.
 */
export async function threadContext({ salesRepId, toE164, client = db } = {}) {
  const lead = await leadForThread({ salesRepId, toE164, client });
  let company = null;

  if (lead?.convertedCompanyId) {
    company = await client.company.findFirst({
      where: { id: lead.convertedCompanyId, ...assignedCompanyWhere(salesRepId) },
      select: REP_COMPANY_SELECT,
    });
  }

  return {
    lead,
    company: company
      ? {
          id: company.id,
          name: company.name,
          signedUpAt: company.createdAt,
          isDemo: company.isDemo,
          chargesEnabled: company.stripeChargesEnabled,
          onboardingCompletedAt: company.onboardingCompletedAt,
          subscriptionStatus: company.subscription?.status || null,
        }
      : null,
    // Stated by a rep, else derived from the province — one rule with the
    // signup-link text and the call region (lib/sales/leadTimeZone.js).
    timeZone: lead ? resolveLeadTimeZone(lead).timeZone : null,
  };
}

/**
 * The retention window this rep is actually on, or null.
 *
 * Null rather than 60. signals.js refuses to default it and says why: "a wrong
 * window silently misdates every milestone calculation on the screen". A rep
 * with no plan gets a decision with no milestone in it, which is true.
 */
async function retentionDaysFor(salesRepId, client) {
  const rep = await client.salesRep.findUnique({
    where: { id: salesRepId },
    select: { commissionPlan: { select: { retentionDays: true } } },
  });
  const days = rep?.commissionPlan?.retentionDays;
  return Number.isFinite(days) && days > 0 ? days : null;
}

/** When this rep last actually SENT a check-in to this company. Null is never. */
async function lastSentCheckInAt({ salesRepId, companyId, client }) {
  if (!companyId) return null;
  const row = await client.salesCheckIn.findFirst({
    where: { salesRepId, companyId, status: "sent" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  return row?.sentAt || null;
}

/**
 * Should this company be checked in on, and what would the text say?
 *
 * @returns `{ decision, suggestion }` where `suggestion` is null unless the
 *   engine says due AND no draft is already open on the thread. The suggestion
 *   carries the DETERMINISTIC wording — ruleDraft, no model, no spend.
 *
 * ══ Why the AI wording is not produced here ═══════════════════════════════
 *
 * draftCheckIn() bills a model. Calling it while merely RENDERING a screen
 * would spend on every page view, every refresh, every back button — the
 * invisible spend lib/ai/provider.js's metering exists to make visible. So the
 * screen shows the rule wording, which is free and deterministic, and the
 * model is asked once, on a press, when the rep materialises the draft. The
 * rep sees the wording change and the row records `draftSource` so they can
 * see which they got.
 */
export async function suggestionForThread({
  salesRepId,
  company,
  timeZone = null,
  repName = null,
  client = db,
  now = new Date(),
} = {}) {
  if (!company) return { decision: null, suggestion: null };

  const [retentionDays, lastCheckInAt] = await Promise.all([
    retentionDaysFor(salesRepId, client),
    lastSentCheckInAt({ salesRepId, companyId: company.id, client }),
  ]);

  // Pass one: cheap. See the header for why a suppression here is final.
  const cheap = checkInSignals({ company, setup: null, lastCheckInAt, retentionDays, now });
  if (cheap.suppressed || !cheap.contactable) return { decision: cheap, suggestion: null };

  // Pass two: the same function, with the setup evidence. A snapshot that
  // fails to load stays null — `setupFacts(null)` is "not measured", and
  // stepsFor({}) would report a thriving company as neglected.
  let setup = null;
  try {
    setup = stepsFor(await loadSetupSnapshot(company.id));
  } catch (err) {
    console.warn("[sales check-in] setup snapshot unreadable:", err?.message);
  }

  const decision = checkInSignals({ company, setup, lastCheckInAt, retentionDays, now });
  if (!decision.due) return { decision, suggestion: null };

  return {
    decision,
    suggestion: {
      companyId: company.id,
      companyName: decision.companyName,
      reasonCode: decision.primary?.code || null,
      headline: decision.primary?.headline || null,
      urgency: decision.urgency,
      scheduledDay: decision.scheduledDay ?? null,
      text: ruleDraft(decision, { repName }),
      // Null when the zone is unknown. The screen says so rather than showing
      // a time it cannot honour.
      scheduledFor: defaultScheduleFor({ timeZone, now }),
      dedupeKey: engineDedupeKey({ companyId: company.id, now }),
    },
  };
}

/**
 * Every open draft this rep has, counted per contact — for the list, which
 * needs "does this thread have a draft due" for fifty threads without fifty
 * queries.
 *
 * @returns `Map<e164, { count, nextDue }>` — `nextDue` the earliest
 *   scheduledFor, or null when none of the drafts is aimed at a time.
 */
export async function openCheckInsByThread({ salesRepId, client = db } = {}) {
  const rows = await client.salesCheckIn.findMany({
    where: { salesRepId, status: "draft" },
    select: {
      toE164: true,
      scheduledFor: true,
      createdAt: true,
      draftText: true,
      origin: true,
      // For a thread that exists ONLY as a draft — a company that signed up
      // through the link and was never texted — the list has no message row
      // to take a name from, so the draft carries the company's and the
      // lead's. A demo draft says it is one, in data, so the list can say so
      // in words.
      companyId: true,
      company: { select: { name: true, isDemo: true } },
      lead: { select: { businessName: true, contactName: true } },
    },
  });
  const byThread = new Map();
  for (const r of rows) {
    // A draft with no number has no thread. It is the companies screen's to
    // show ("no number on file"), not the list's — keying it on null would
    // draw a conversation with nobody at the other end.
    if (!r.toE164) continue;
    const entry = byThread.get(r.toE164) || {
      count: 0,
      nextDue: null,
      name: null,
      companyId: null,
      isDemo: false,
      firstCreatedAt: null,
      draftText: null,
      origin: null,
    };
    entry.count += 1;
    if (r.scheduledFor && (!entry.nextDue || r.scheduledFor < entry.nextDue)) entry.nextDue = r.scheduledFor;
    if (!entry.name) entry.name = r.lead?.businessName || r.company?.name || r.lead?.contactName || null;
    if (!entry.companyId && r.companyId) entry.companyId = r.companyId;
    if (r.company?.isDemo) entry.isDemo = true;
    if (!entry.firstCreatedAt || r.createdAt < entry.firstCreatedAt) {
      entry.firstCreatedAt = r.createdAt;
      entry.draftText = r.draftText;
      entry.origin = r.origin;
    }
    byThread.set(r.toE164, entry);
  }
  return byThread;
}

export async function openCheckIns({ salesRepId, toE164, client = db } = {}) {
  const other = normalisePhone(toE164);
  if (!other || !salesRepId) return [];
  return client.salesCheckIn.findMany({
    where: { salesRepId, toE164: other, status: "draft" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      companyId: true,
      leadId: true,
      toE164: true,
      draftText: true,
      origin: true,
      reasonCode: true,
      draftSource: true,
      degraded: true,
      scheduledFor: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * Write a draft down.
 *
 * @param text  the rep's own words, when they typed them. Omitted for an
 *   engine draft, in which case draftCheckIn() is asked — with `db`, so the
 *   spend is metered, and with the decision, so the model is rewriting a
 *   sentence rather than inventing one.
 *
 * @returns `{ ok: true, checkIn }` | `{ ok: false, status, error }`
 *
 * A duplicate dedupeKey is not an error the rep should see: it means the draft
 * they asked for already exists, so the existing one is returned. Racing two
 * tabs must not produce two identical drafts, and must not produce a scary
 * sentence either.
 */
export async function createCheckIn({
  rep,
  toE164,
  lead = null,
  company = null,
  decision = null,
  text = null,
  scheduledFor = null,
  origin = "manual",
  dedupeKey = null,
  client = db,
  now = new Date(),
} = {}) {
  const other = normalisePhone(toE164);
  if (!other) return { ok: false, status: 400, error: "That is not a number we can text." };

  let draftText = String(text ?? "").trim();
  let draftSource = "rule";
  let degraded = true;

  if (!draftText) {
    if (!decision) {
      return {
        ok: false,
        status: 400,
        error:
          "There is nothing to say yet. Type the follow-up you want to send — this contractor " +
          "has not signed up, so there is nothing for FieldQuo to draft from.",
      };
    }
    const drafted = await draftCheckIn({
      decision,
      repName: rep?.name || null,
      db: client,
      salesRepId: rep.id,
      now,
    });
    if (drafted.refused || !drafted.text) {
      return { ok: false, status: 409, error: drafted.reasonText || "No check-in could be drafted." };
    }
    draftText = drafted.text;
    draftSource = drafted.source || "rule";
    degraded = Boolean(drafted.degraded);
  }

  const data = {
    salesRepId: rep.id,
    companyId: company?.id || null,
    leadId: lead?.id || null,
    toE164: other,
    draftText,
    origin,
    reasonCode: decision?.primary?.code || null,
    draftSource,
    degraded,
    scheduledFor,
    status: "draft",
    dedupeKey,
  };

  // P2002 is the unique index doing its job — the draft is already there,
  // and rows.js hands it back rather than a scary sentence.
  const { checkIn, existed } = await insertDraftRow(client, data);
  return existed ? { ok: true, checkIn, existed: true } : { ok: true, checkIn };
}

/** The row, read fresh, scoped to the rep. Never trust an id from a request. */
export async function readCheckIn({ salesRepId, id, client = db } = {}) {
  if (!salesRepId || !id) return null;
  return client.salesCheckIn.findFirst({ where: { id, salesRepId } });
}

/**
 * Edit the wording, move the moment, or put a draft away.
 *
 * Every field is optional and only what is present is written — a screen that
 * sends the whole row back would overwrite a reschedule made in another tab
 * with a stale time.
 *
 * @returns `{ ok: true, checkIn }` | `{ ok: false, status, error }`
 */
export async function updateCheckIn({
  salesRepId,
  id,
  text = undefined,
  scheduledFor = undefined,
  dismiss = false,
  client = db,
  now = new Date(),
} = {}) {
  const row = await readCheckIn({ salesRepId, id, client });
  if (!row) return { ok: false, status: 404, error: "That draft is not one of yours." };
  if (row.status !== "draft") {
    return {
      ok: false,
      status: 409,
      error:
        row.status === "sent"
          ? "That check-in has already gone out. Nothing about a sent message can be changed."
          : "That draft was put away.",
    };
  }

  const data = {};
  if (text !== undefined) {
    const words = String(text ?? "").trim();
    if (!words) return { ok: false, status: 400, error: "A draft with nothing in it is not a draft." };
    data.draftText = words;
    // The rep's own words, so the provenance changes with them. Leaving
    // `draftSource: "ai"` on a sentence the rep rewrote would credit the model
    // for their work and, worse, would make the "degraded" flag meaningless.
    data.draftSource = "rep";
    data.degraded = false;
  }
  if (scheduledFor !== undefined) data.scheduledFor = scheduledFor;
  if (dismiss) {
    data.status = "dismissed";
    data.dismissedAt = now;
  }

  if (!Object.keys(data).length) {
    return { ok: false, status: 400, error: "Nothing was changed." };
  }

  const checkIn = await client.salesCheckIn.update({ where: { id: row.id }, data });
  return { ok: true, checkIn };
}

/**
 * Send one drafted check-in, now, because a rep pressed send.
 *
 * ══ This is the ONLY path from a draft to a text ═══════════════════════════
 *
 * It is called from exactly one place — POST /api/sales/checkins/[id]/send —
 * and that route is behind a button. No cron reads this table, no effect calls
 * this function, and scripts/check-sales-messages.mjs asserts both by scanning
 * every route, job and client component for a reference to it. `scheduledFor`
 * is the rep's intention, not a trigger.
 *
 * ══ Every gate the reply box passes ════════════════════════════════════════
 *
 * deliverReplySms is reused whole rather than re-derived, which is the point:
 * the suppression list read fresh at the moment of the send, the texting
 * window judged in the CONTRACTOR's zone, the mailing address, the +1
 * restriction, and the CASL footer appended to what actually goes out. A
 * second send path with its own copy of those rules is how a check-in goes out
 * at two in the morning to somebody who said STOP.
 *
 * The lead is re-read here rather than taken from the row's `leadId`, because
 * the zone is what the window is judged in and the rep may have corrected it
 * since the draft was written.
 *
 * @param deliver injectable ONLY so the check can prove the claim and the
 *   revert without a carrier. Production never passes it.
 */
export async function sendCheckIn({
  rep,
  id,
  origin: appOrigin,
  client = db,
  now = new Date(),
  deliver = null,
} = {}) {
  const row = await readCheckIn({ salesRepId: rep?.id, id, client });
  if (!row) return { ok: false, status: 404, error: "That draft is not one of yours." };
  if (row.status !== "draft") {
    return {
      ok: false,
      status: 409,
      error:
        row.status === "sent"
          ? "That check-in has already gone out."
          : "That draft was put away. Nothing was sent.",
    };
  }

  // ── A draft with nobody at the other end ────────────────────────────────
  //
  // Two rows the backlog writes on purpose and the carrier must never see.
  // A draft with no number exists so the companies screen can say "no number
  // on file"; a demo draft exists so a new rep sees what a day-1 check-in
  // looks like on their walkthrough account. deliverReplySms would refuse
  // the first (lead_no_phone) but not the second — a fictional 555 number is
  // North American and on nobody's do-not-contact list — so the demo is
  // refused HERE, on the company row re-read now, before the claim below can
  // mark anything as under way. Hiding the button is not access control.
  if (!row.toE164) {
    return {
      ok: false,
      status: 409,
      error: "There is no number on file for this company. Add one to the lead, and the draft can go.",
    };
  }
  if (row.companyId) {
    const owner = await client.company.findUnique({ where: { id: row.companyId }, select: { isDemo: true } });
    if (owner?.isDemo === true || row.origin === "demo") {
      return {
        ok: false,
        status: 409,
        error: "This is your demo company. Nothing is ever sent from a demo, so this draft is only there to show what a check-in looks like.",
        demo: true,
      };
    }
  }

  // ── Claim it, before anything leaves the building ───────────────────────
  //
  // A compare-and-set on `sendingStartedAt: null`, the same discipline
  // lib/sales/demoAssign.js uses to stop two reps taking one demo. Two presses
  // on a slow connection are the ordinary case, not the exotic one.
  const claim = await client.salesCheckIn.updateMany({
    where: { id: row.id, salesRepId: rep.id, status: "draft", sendingStartedAt: null },
    data: { sendingStartedAt: now },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      status: 409,
      error:
        "A send of this draft is already under way. Check the conversation before trying again — " +
        "nothing here will send a second copy.",
    };
  }

  const lead = await leadForThread({ salesRepId: rep.id, toE164: row.toE164, client });
  const send = deliver || deliverReplySms;

  const result = await send({
    rep,
    // A lead when the phone matches one, otherwise the bare number with a null
    // zone — which the window check refuses, in words, rather than guessing.
    lead: lead || { phone: row.toE164, timeZone: null },
    text: row.draftText,
    origin: appOrigin,
    now,
    client,
  }).catch((err) => ({ ok: false, status: 502, error: err?.message || "The send failed." }));

  if (!result?.ok) {
    // Hand the claim back so the rep can fix the blocker and try again. If
    // THIS write fails the row stays claimed and the screen says a send was
    // started and lost — which is the honest reading, and is safer than a
    // button that might send a second copy.
    await client.salesCheckIn
      .updateMany({ where: { id: row.id, status: "draft" }, data: { sendingStartedAt: null } })
      .catch(() => {});
    return {
      ok: false,
      status: result?.status || 502,
      error: result?.error || "That did not send.",
      blockers: result?.blockers || null,
      suppressed: Boolean(result?.suppressed),
    };
  }

  const checkIn = await client.salesCheckIn.update({
    where: { id: row.id },
    data: { status: "sent", sentAt: result.sentAt || now, sentMessageId: result.messageId || null },
  });

  return { ok: true, checkIn, messageId: result.messageId };
}
