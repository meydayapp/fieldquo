// lib/agency/events.js
//
// What happened to a lead, as events an agency's Zap can trigger on — and
// the outbox that makes them reliable.
//
// ══ Derived, not hooked into twenty write paths ═══════════════════════════
//
// A lead moves forward in a dozen places: createScoredLead, the rescore, the
// quote send route, the public quote view, onQuoteAccepted / onQuoteDeclined,
// four routes that create appointments, the appointment PATCH, two payment
// writers, the job status. Emitting an event from each would be a dozen
// copies of "which lead is this, and has this been sent already" — the copy
// is the one that rots (AGENTS.md failure class 4), and a write path added
// next month would silently emit nothing.
//
// So events are DERIVED from the lead's state (lib/agency/leadFacts.js — the
// same facts the API returns) by sweepCompanyEvents, and written to the
// AgencyEvent outbox under a dedupe key that names the thing that happened
// ("quote.sent:<lead>:<quote>"). The unique index on (companyId, dedupeKey)
// makes the sweep idempotent: it can run after every write path's response
// (lib/agency/nudge.js — never blocking the user's action) AND on a cron
// backstop (app/api/cron/agency-events), and an event is written once.
//
// No backfill: an event is only owed to a subscription that existed when the
// thing happened — subscribing a Zap does not replay a company's history at
// it.
//
// ══ lead.stage_changed needs a memory ═════════════════════════════════════
//
// "from → to" is a change, and the lead's status column only holds the
// latest value. The outbox is the memory: the last stage event for a lead
// says where it was. A lead first seen by the sweep after it existed gets a
// silent baseline row ("lead.stage_baseline", never delivered), so the first
// change after subscribing is reported with a true "from".

import { stagesOf, appointmentOutcome } from "@/lib/agency/leadRow";
import { loadLeadFacts } from "@/lib/agency/leadFacts";

export const EVENTS = Object.freeze([
  "lead.created",
  "lead.qualified",
  "lead.stage_changed",
  "appointment.booked",
  "estimate.scheduled",
  "appointment.outcome",
  "quote.sent",
  "quote.viewed",
  "quote.declined",
  "quote.accepted",
  "job.completed",
  "invoice.paid",
  "payment.received",
]);

/** English, for the docs, the OpenAPI file and the Zapier trigger labels. */
export const EVENT_DESCRIPTIONS = Object.freeze({
  "lead.created": "A new lead arrived (any channel).",
  "lead.qualified": "A lead became qualified — scored warm or hot, or booked a visit, got a quote or closed.",
  "lead.stage_changed": "A lead moved on the company's pipeline (new, contacted, won, lost). Carries fromStage and toStage.",
  "appointment.booked": "A lead booked an in-person appointment.",
  "estimate.scheduled": "An on-site estimate visit was booked. FieldQuo's sales appointment is the estimate visit, so this fires with appointment.booked and carries appointmentType \"estimate\".",
  "appointment.outcome": "An appointment was marked held or cancelled. FieldQuo records no no-show status, so none is sent.",
  "quote.sent": "The lead was sent a quote.",
  "quote.viewed": "The lead opened the quote.",
  "quote.declined": "The lead declined the quote. The decline reason is included with contact details blanked unless the company shares contact details.",
  "quote.accepted": "The lead accepted the quote — they became a client.",
  "job.completed": "The job the lead bought was marked complete.",
  "invoice.paid": "An invoice for the lead's job was paid in full.",
  "payment.received": "A payment was recorded on the lead's invoice. The amount is included only when the company shares job values.",
});

const BASELINE = "lead.stage_baseline";
const DAY = 24 * 60 * 60 * 1000;
/** How far back a sweep follows leads (a quote can close long after the lead). */
export const SWEEP_LOOKBACK_DAYS = 400;

const iso = (d) => (d ? new Date(d).toISOString() : null);
const time = (d) => (d ? new Date(d).getTime() : NaN);

/**
 * Every event a lead's CURRENT state implies, except stage changes. Pure.
 * Each: { event, dedupeKey, occurredAt: Date, facts }.
 * `facts` never holds a contact detail; money in it is stripped at delivery
 * when the company does not share job values (payloadFor).
 */
export function eventsForFact(fact, now = new Date()) {
  const out = [];
  const id = fact.id;
  const push = (event, key, at, facts = {}) => {
    if (!Number.isFinite(time(at))) return;
    out.push({ event, dedupeKey: `${event}:${id}${key ? `:${key}` : ""}`, occurredAt: new Date(at), facts });
  };
  const stages = stagesOf(fact);
  push("lead.created", "", fact.createdAt, { channel: fact.channel || null });
  if (stages.qualified) {
    const at = fact.qualifiedAt || fact.appointment?.bookedAt || fact.quote?.sentAt || fact.wonAt || fact.createdAt;
    push("lead.qualified", "", at, { temperature: fact.temperature || null });
  }
  const appt = fact.appointment;
  if (appt) {
    const f = { appointmentAt: iso(appt.scheduledAt), appointmentType: appt.type || "estimate", mode: appt.mode || "visit" };
    push("appointment.booked", appt.id, appt.bookedAt, f);
    if ((appt.type || "estimate") === "estimate") push("estimate.scheduled", appt.id, appt.bookedAt, f);
    const outcome = appointmentOutcome(appt, now);
    if (outcome === "held" || outcome === "cancelled") push("appointment.outcome", `${appt.id}:${outcome}`, appt.updatedAt || appt.scheduledAt, { outcome, appointmentAt: iso(appt.scheduledAt) });
  }
  const q = fact.quote;
  if (q) {
    if (q.sentAt) push("quote.sent", q.id, q.sentAt, { quoteAmount: q.amount ?? null });
    if (q.viewedAt) push("quote.viewed", q.id, q.viewedAt, {});
    if (q.declinedAt) push("quote.declined", q.id, q.declinedAt, {});
  }
  if (fact.won && fact.wonAt) push("quote.accepted", q?.id || "", fact.wonAt, { wonAmount: fact.wonAmount ?? null, closedWithoutVisit: !stages.appointment });
  for (const j of fact.jobs || []) {
    if (j.status === "completed" && j.completedAt) push("job.completed", j.id, j.completedAt, {});
  }
  for (const inv of fact.invoices || []) {
    if (inv.status === "paid" && inv.paidDate) push("invoice.paid", inv.id, inv.paidDate, {});
  }
  for (const p of fact.payments || []) {
    if (p.amount > 0) push("payment.received", p.id, p.at, { amount: p.amount });
  }
  return out;
}

/** The money keys an event's facts may carry. */
const MONEY_FACTS = new Set(["quoteAmount", "wonAmount", "amount"]);

/** An event's facts as they may leave: money dropped unless shared. */
export function shareableFacts(facts, { shareMoney = true } = {}) {
  const out = {};
  for (const [k, v] of Object.entries(facts && typeof facts === "object" ? facts : {})) {
    out[k] = MONEY_FACTS.has(k) && !shareMoney ? null : v;
  }
  return out;
}

/**
 * One delivery's body: the event, its shareable facts, and the lead row —
 * the SAME row the API returns (lib/agency/leadRow.js), built under the
 * switches as they are at delivery time.
 */
export function payloadFor(event, row, { shareMoney = true } = {}) {
  return {
    id: event.id,
    event: event.event,
    occurredAt: iso(event.occurredAt),
    data: shareableFacts(event.facts, { shareMoney }),
    lead: row,
  };
}

/** Active subscriptions of a company, by event: { event → earliest createdAt }. */
async function activeStarts(db, companyId) {
  const subs = await db.agencyHookSubscription.findMany({
    where: { companyId, endedAt: null, key: { revokedAt: null } },
    select: { id: true, event: true, createdAt: true },
  });
  const starts = new Map();
  for (const s of subs) {
    const t = new Date(s.createdAt);
    if (!starts.has(s.event) || t < starts.get(s.event)) starts.set(s.event, t);
  }
  return starts;
}

/**
 * Write every event a company owes its subscriptions into the outbox, then
 * fan each new one out to the subscriptions that existed when it happened.
 * Idempotent. Returns { written, fannedOut }.
 */
export async function sweepCompanyEvents({ db, companyId, now = new Date(), load = loadLeadFacts }) {
  const starts = await activeStarts(db, companyId);
  if (!starts.size) return { written: 0, fannedOut: 0 };
  const earliest = Math.min(...[...starts.values()].map((d) => d.getTime()));
  const { facts } = await load({ db, companyId, where: { createdAt: { gte: new Date(earliest - SWEEP_LOOKBACK_DAYS * DAY) } }, now });

  const rows = [];
  for (const fact of facts) {
    for (const e of eventsForFact(fact, now)) {
      const start = starts.get(e.event);
      if (!start || e.occurredAt < start) continue;
      rows.push({ companyId, event: e.event, leadId: fact.id, dedupeKey: e.dedupeKey, occurredAt: e.occurredAt, facts: e.facts });
    }
  }

  // ── Stage changes, against the outbox's memory ───────────────────────────
  const stageStart = starts.get("lead.stage_changed");
  if (stageStart && facts.length) {
    const history = await db.agencyEvent.findMany({
      where: { companyId, leadId: { in: facts.map((f) => f.id) }, event: { in: ["lead.stage_changed", BASELINE] } },
      select: { leadId: true, facts: true, createdAt: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    });
    const last = new Map();
    const seq = new Map();
    for (const h of history) {
      last.set(h.leadId, h.facts?.toStage || null);
      seq.set(h.leadId, (seq.get(h.leadId) || 0) + 1);
    }
    for (const fact of facts) {
      const current = fact.status || "new";
      const n = seq.get(fact.id) || 0;
      if (!last.has(fact.id)) {
        // Never seen. A lead born after the subscription began started as
        // "new" (createScoredLead's default); an older one is a baseline.
        if (fact.createdAt >= stageStart) {
          if (current !== "new") rows.push({ companyId, event: "lead.stage_changed", leadId: fact.id, dedupeKey: `lead.stage_changed:${fact.id}:1`, occurredAt: now, facts: { fromStage: "new", toStage: current } });
        } else {
          rows.push({ companyId, event: BASELINE, leadId: fact.id, dedupeKey: `${BASELINE}:${fact.id}`, occurredAt: now, facts: { toStage: current }, fannedOutAt: now });
        }
        continue;
      }
      const from = last.get(fact.id);
      if (from !== current) {
        rows.push({ companyId, event: "lead.stage_changed", leadId: fact.id, dedupeKey: `lead.stage_changed:${fact.id}:${n + 1}`, occurredAt: now, facts: { fromStage: from, toStage: current } });
      }
    }
  }

  let written = 0;
  if (rows.length) {
    const res = await db.agencyEvent.createMany({ data: rows, skipDuplicates: true });
    written = res?.count ?? 0;
  }
  const fannedOut = await fanOut({ db, companyId, now });
  return { written, fannedOut };
}

/** Create a delivery for every un-fanned event, owed to each subscription that existed when it happened. */
export async function fanOut({ db, companyId, now = new Date() }) {
  const pending = await db.agencyEvent.findMany({
    where: { companyId, fannedOutAt: null },
    select: { id: true, event: true, occurredAt: true },
    take: 2000,
  });
  if (!pending.length) return 0;
  const subs = await db.agencyHookSubscription.findMany({
    where: { companyId, endedAt: null, key: { revokedAt: null } },
    select: { id: true, event: true, createdAt: true },
  });
  const deliveries = [];
  for (const e of pending) {
    for (const s of subs) {
      if (s.event === e.event && new Date(s.createdAt) <= new Date(e.occurredAt)) {
        deliveries.push({ eventId: e.id, subscriptionId: s.id, nextAttemptAt: now });
      }
    }
  }
  if (deliveries.length) await db.agencyHookDelivery.createMany({ data: deliveries, skipDuplicates: true });
  await db.agencyEvent.updateMany({ where: { companyId, id: { in: pending.map((e) => e.id) } }, data: { fannedOutAt: now } });
  return deliveries.length;
}
