// lib/followUps/changeOrderChaseState.js
//
// What the job page is allowed to say about the automatic chase on a change
// order that is out for signature.
//
// ── Why this exists at all ─────────────────────────────────────────────────
//
// The chase shipped on 2026-11-17 and the owner's reply was, twice, that
// there is nothing about reminders anywhere in Jobs. He was right: the panel
// said "Waiting on client approval · Sent by email and SMS · opened ·
// Resend" and not one word about whether anything would ever follow it up.
// An automation nobody can see on the screen where they work is, from the
// desk, indistinguishable from an automation that does not exist — and in
// this case it genuinely did not run (the finder threw on every pass), which
// is exactly the failure a silent feature hides.
//
// So the panel states the truth, including the uncomfortable one: when no
// rule is switched on, it says so and points at the page that switches it on,
// rather than leaving a blank that reads as "handled".
//
// ── Three states, and nothing invented ─────────────────────────────────────
//
//   sent  a FollowUpLog row exists for this change order. It HAS been chased,
//         on that date, and — this is the part a contractor must not have to
//         discover — it will not be chased again. The cron's dedupe is one
//         chase per (rule, entity) for ever, so with one rule there is
//         exactly one reminder in the life of a change order.
//   due   a rule is on and this row is not logged yet: the reminder is due at
//         sentAt + the rule's delay. A date in the past means the next cron
//         pass takes it.
//   off   no active rule. Nothing will chase this, and saying nothing here
//         would be the dead-control failure in its quietest form.
//
// Returns a Map keyed by change-order id. Rows that are not waiting on a
// client, or were never sent, get no entry: there is nothing truthful to say
// about chasing a change order the homeowner has never seen.
//
// Never throws. The chase line is a nicety; a job page that 500s because a
// follow-up rule could not be read is a real loss.

import { delayMs } from "@/lib/followUps/flow";

const CHANGE_ORDER_TRIGGER = "change_order_no_response";

/**
 * @param {object} db      Prisma client (passed, not imported, so a check
 *                         script can drive this against a scripted fake the
 *                         way the finder itself is driven).
 * @param {{companyId: string, changeOrders: Array}} input
 * @returns {Promise<Map<string, {state: "sent"|"due"|"off", at: Date|null, channel: string|null, repeats: false}>>}
 */
export async function changeOrderChaseStates(db, { companyId, changeOrders } = {}) {
  const out = new Map();
  try {
    const rows = (Array.isArray(changeOrders) ? changeOrders : []).filter(
      (co) => co && co.status === "waiting_client" && co.sentAt,
    );
    if (!companyId || rows.length === 0) return out;

    // deletedAt as well as active: a FieldQuo default the company DELETED is
    // a tombstone, not a paused rule — the same predicate the cron uses to
    // decide what runs. Reading it any other way here would promise a
    // reminder the cron will never send.
    const rules = await db.followUpRule.findMany({
      where: { companyId, triggerEvent: CHANGE_ORDER_TRIGGER, active: true, deletedAt: null },
      select: { id: true, delayValue: true, delayUnit: true, channel: true },
    });

    if (rules.length === 0) {
      for (const co of rows) out.set(co.id, { state: "off", at: null, channel: null, repeats: false });
      return out;
    }

    // The soonest rule is the one the panel talks about: with several on, the
    // first one to fire is what the client will actually receive next.
    const soonest = rules.reduce((a, b) => (delayMs(a) <= delayMs(b) ? a : b));

    const logs = await db.followUpLog.findMany({
      where: { ruleId: { in: rules.map((r) => r.id) }, entityId: { in: rows.map((co) => co.id) } },
      select: { entityId: true, sentAt: true },
    });
    const sentAtOf = new Map();
    for (const l of logs) {
      // Earliest wins: the first time this change order was chased is the
      // date that answers "has it been chased?".
      const had = sentAtOf.get(l.entityId);
      if (!had || (l.sentAt && l.sentAt < had)) sentAtOf.set(l.entityId, l.sentAt);
    }

    for (const co of rows) {
      if (sentAtOf.has(co.id)) {
        out.set(co.id, { state: "sent", at: sentAtOf.get(co.id) || null, channel: soonest.channel || "email", repeats: false });
        continue;
      }
      out.set(co.id, {
        state: "due",
        at: new Date(new Date(co.sentAt).getTime() + delayMs(soonest)),
        channel: soonest.channel || "email",
        repeats: false,
      });
    }
    return out;
  } catch {
    // A chase line nobody can compute is a chase line nobody shows.
    return out;
  }
}
