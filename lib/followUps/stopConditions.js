// lib/followUps/stopConditions.js
//
// When a quote — or an enquiry — must NOT be chased, decided in one place.
//
// ── Why this is not just the cron's `where` clause ──────────────────────────
//
// findQuoteNoResponse() in app/api/cron/follow-ups/route.js selects quotes
// whose status is still "sent". That is the one condition a Prisma `where`
// can state cheaply. The others — the quote has expired, the client wrote
// back, the company has since quoted the same client again — each need a
// second read, and a cron that inlines four of them is a cron whose stop
// conditions nobody can list. The settings page prints these conditions to
// the company in words, and the words have to be derived from the same
// decision the cron makes, so the decision is a pure function here and the
// cron only gathers the facts it takes.
//
// quoteChaseBlocker() is pure and executed by scripts/check-follow-up-
// defaults.mjs against every combination. gatherQuoteChaseFacts() is the
// only I/O.

/**
 * The reasons a quote is left alone. Each maps to a sentence the page prints
 * (app.followFlow.stop*), so a reason cannot exist without its explanation.
 */
export const QUOTE_STOP_REASONS = Object.freeze([
  "answered", // accepted or declined — status is no longer "sent"
  "expired", // validUntil is in the past
  "replied", // the client wrote back on a thread tied to the quote or to them
  "superseded", // a newer quote to the same client exists
  "before_rule", // the quote went out before a FieldQuo default was switched on
]);

/**
 * @param quote          needs status, sentAt, validUntil
 * @param rule           needs builtInKey, createdAt
 * @param facts          { laterQuoteExists: boolean, clientRepliedAt: Date|null }
 * @param now            injectable clock
 * @returns {string|null} the reason to stop, or null to chase
 */
export function quoteChaseBlocker({ quote, rule, facts = {}, now = new Date() } = {}) {
  if (!quote) return "answered";
  if (quote.status !== "sent") return "answered";

  if (quote.validUntil && new Date(quote.validUntil).getTime() < now.getTime()) {
    return "expired";
  }

  // A reply AFTER the quote went out. A message from before the send is the
  // conversation that produced the quote, not a response to it.
  if (facts.clientRepliedAt && quote.sentAt) {
    if (new Date(facts.clientRepliedAt).getTime() > new Date(quote.sentAt).getTime()) {
      return "replied";
    }
  }

  if (facts.laterQuoteExists) return "superseded";

  // ── The defaults start from the day they were switched on ─────────────────
  //
  // The finders deliberately have no time floor — a hand-made rule created
  // today catches up on last month, and the cron comment says so. A FieldQuo
  // default is different: it was seeded onto every company at once, over
  // quotes that had been sitting at "sent" for months. Without this line the
  // first cron run after the backfill would send day-1, day-7 AND day-14 in
  // the same minute to every one of those clients, each saying "the quote we
  // sent yesterday". So a built-in only chases a quote sent after the rule
  // existed. Hand-made rules keep their catch-up behaviour.
  if (rule?.builtInKey && quote.sentAt) {
    const floor = chaseFloor(rule);
    if (floor && new Date(quote.sentAt).getTime() < floor.getTime()) {
      return "before_rule";
    }
  }

  return null;
}

/**
 * The moment a built-in started chasing — what "before the rule existed"
 * actually means.
 *
 * `activatedAt` when the rule has been switched on at some point, else
 * `createdAt`. See the column's own comment in prisma/schema.prisma: the
 * three QUOTE defaults are seeded active, so activatedAt is null and the
 * floor is createdAt exactly as it always was. The three ENQUIRY defaults are
 * seeded OFF and may be switched on a month later, and createdAt would then
 * be a month before the decision — so every lead that arrived in between
 * would read as "after the rule" and all of them would be chased in the first
 * run after the switch. Measured on one live tenant: 28 leads still at "new".
 *
 * Deliberately not updatedAt: renaming a rule or re-timing it must not reset
 * the clock, which is the mistake Job.completedAt was added to fix.
 */
export function chaseFloor(rule) {
  const at = rule?.activatedAt || rule?.createdAt || null;
  if (!at) return null;
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The two facts the decision needs that are not on the quote row.
 *
 * "Replied" is the latest INBOUND message on any of the company's threads
 * that name this quote (MessageThread.quoteId) or this client
 * (MessageThread.clientId). Email replies to the quote go straight to the
 * company's own inbox (resolveSender sets Reply-To to it), so FieldQuo can only
 * see replies that arrived through channels it carries — SMS, WhatsApp, Meta.
 * That is the honest limit and the page says so.
 *
 * "Superseded" is any newer, non-historical quote to the same client.
 */
export async function gatherQuoteChaseFacts(db, quote) {
  const [laterQuote, reply] = await Promise.all([
    db.quote.findFirst({
      where: {
        companyId: quote.companyId,
        clientId: quote.clientId,
        id: { not: quote.id },
        createdAt: { gt: quote.createdAt },
        historicalImportedAt: null,
      },
      select: { id: true },
    }),
    db.message.findFirst({
      where: {
        direction: "in",
        thread: {
          companyId: quote.companyId,
          OR: [{ quoteId: quote.id }, { clientId: quote.clientId }],
        },
        ...(quote.sentAt && { createdAt: { gt: quote.sentAt } }),
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    laterQuoteExists: Boolean(laterQuote),
    clientRepliedAt: reply?.createdAt || null,
  };
}

// ══ The enquiry chase ══════════════════════════════════════════════════════
//
// The owner, 2026-11-03: "those sms follow ups for leads for appointment
// setting should only be active if they don't have an appointment set up. and
// they also don't have a quote. or job. because the purpose is to get them to
// schedule."
//
// The cron's findLeadNoResponse() already narrows to status "new" with
// quoteId null — the two conditions a Prisma `where` can state cheaply. Every
// other one needs a second read, and each is a way to chase somebody who has
// already done the thing the chase is asking for:
//
//   · an appointment EXISTS but no quote does yet — which is the normal
//     state of a lead that booked an estimate visit. `status: "new"` does not
//     move when a booking is made, so the finder happily returns it.
//   · a quote exists that is not on LeadRequest.quoteId — the INFERRED link
//     (same client, after the lead) that the Leads board already shows on the
//     card. Measured live: nine leads with a booked estimate visit, only one
//     reachable through a quote.
//   · a job exists.
//   · the lead has written back. A human mid-conversation is the strongest
//     possible reason to stop: an automated "someone will be in touch" landing
//     in the middle of a thread somebody is already answering is worse than
//     silence, and it is sent under the contractor's name.
//   · somebody said so. The owner, on the reply rule: "it might be manually
//     because the system isn't able to see if they answered the call. or reply
//     back to a text from the company's number." Both halves are built,
//     because the automatic one is blind to every conversation that did not
//     pass through FieldQuo — which for a contractor with a mobile is most of
//     them. LeadRequest.reachedAt is the statement; the lead page is where a
//     person makes it, and unmakes it.

/**
 * The reasons an enquiry is left alone. Every one of them is named in the one
 * sentence the settings page prints for this trigger
 * (app.followFlow.stopLeadAnswered), and scripts/check-lead-chase.mjs fails if
 * a reason exists that the sentence does not mention — a stop condition
 * nobody was told about is a company wondering why its automation is quiet.
 */
export const LEAD_STOP_REASONS = Object.freeze([
  "answered", // somebody moved it off "new" by hand, or the lifecycle did
  "appointment", // a visit, call or video consult is already booked
  "job", // the work is already sold
  "quoted", // a quote exists — recorded on the lead or inferred from the client
  "replied", // the lead wrote back after they enquired, through FieldQuo
  "reached", // a person marked them as spoken to, which FieldQuo cannot see
  "before_rule", // the enquiry arrived before this rule was switched on
]);

/**
 * @param lead   needs status, createdAt, quoteId
 * @param rule   needs builtInKey, createdAt, activatedAt
 * @param facts  { hasAppointment, hasQuote, hasJob, repliedAt, reachedAt } —
 *               from gatherLeadChaseFacts, which does the matching. `reachedAt`
 *               is the lead's OWN column; it travels as a fact rather than
 *               being read off `lead` so this function keeps one input shape
 *               and the check can execute every combination of the five.
 * @param now    injectable clock
 * @returns {string|null} the reason to stop, or null to chase
 */
export function leadChaseBlocker({ lead, rule, facts = {}, now = new Date() } = {}) {
  if (!lead) return "answered";
  // Belt and braces with the finder's own `status: "new"`. A lead whose status
  // moved between the query and the send — somebody picking it up while the
  // cron runs — is a person already being dealt with.
  if (lead.status && lead.status !== "new") return "answered";

  // The owner's three, in the order he said them. Appointment first because
  // it is the one the chase is actually asking for: a homeowner who has booked
  // and is then told "we haven't been able to reach you" has been told
  // something false by the company they just booked with.
  if (facts.hasAppointment) return "appointment";
  // Job before quote, though the owner said "quote. or job.": a job only
  // exists behind a quote, so checking the quote first would make "job" a
  // reason nothing could ever return — a branch in a frozen list that never
  // fires, which is its own small lie about what the automation does. This
  // way both are reachable and the reason reported is the furthest the lead
  // actually got.
  if (facts.hasJob) return "job";
  if (lead.quoteId || facts.hasQuote) return "quoted";

  // A reply AFTER they enquired. The message that CREATED a conversation lead
  // arrives at or before the lead row exists (lib/conversations/ingest.js
  // makes the lead from it), so anything strictly later is a response — the
  // same rule quoteChaseBlocker applies to a message from before the send.
  if (facts.repliedAt && lead.createdAt) {
    if (new Date(facts.repliedAt).getTime() > new Date(lead.createdAt).getTime()) {
      return "replied";
    }
  }

  // ── And the half FieldQuo cannot see ──────────────────────────────────
  //
  // LeadRequest.reachedAt — somebody pressed "I've spoken to them" on the
  // lead. The automatic signal above only sees messages that came THROUGH
  // FieldQuo, so it is blind to a call the homeowner answered on the
  // contractor's own mobile and to a text reply to the company's own number,
  // which are the two ordinary cases. Without this, the software keeps
  // chasing somebody the company has already talked to.
  //
  // No date comparison, deliberately. A reply has to be shown to have come
  // after the enquiry, because an inbound message can be the one that CREATED
  // the lead. A human mark cannot be: the control does not exist until the
  // lead does, and somebody pressing it is saying "now", about this lead. A
  // floor here would only ever discard a true statement.
  //
  // Clearing the column puts the lead back in the chase, which is why this
  // reads the value rather than a boolean somebody computed: a wrong mark has
  // to be undoable.
  if (facts.reachedAt) return "reached";

  // The enquiry defaults are seeded OFF, so this guard is load-bearing in a
  // way the quote one is not: without it, switching one on chases every lead
  // that has been sitting at "new" since the row was created. See chaseFloor.
  if (rule?.builtInKey && lead.createdAt) {
    const floor = chaseFloor(rule);
    if (floor && new Date(lead.createdAt).getTime() < floor.getTime()) {
      return "before_rule";
    }
  }

  // `now` is taken for symmetry with quoteChaseBlocker and so a check can
  // pin the clock; nothing above reads it, because an enquiry has no expiry
  // of its own. An invented one would be FieldQuo deciding when a homeowner's
  // request stops counting.
  void now;
  return null;
}

// ── gatherLeadChaseFacts is NOT here, and that is the whole point ─────────
//
// It lives in lib/followUps/leadChaseFacts.js. This module is in the BROWSER
// bundle — lib/dashboard/workPanel.js imports quoteChaseBlocker and
// app/components/dashboard/WorkPanel.js is a client component — so anything
// this file can reach, a browser has to download.
//
// The first cut put the gatherer here with `await import("@/lib/agency/
// leadFacts")` inside the function, on the theory that a dynamic import keeps
// a module out of the bundle. It does not: Turbopack traces it statically all
// the same, and `npm run build` failed with seven "Can't resolve 'dns' / 'fs'"
// errors down a chain that ended at pg — the Postgres driver, pulled into a
// client component, because leadFacts reaches the analytics rollup which
// reaches lib/db.js.
//
// So the rule this file already stated in its header is now enforced by
// construction: the decisions are pure and live here, and every byte of I/O
// lives next door where only the server imports it.
