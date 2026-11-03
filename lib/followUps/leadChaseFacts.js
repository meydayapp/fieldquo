// lib/followUps/leadChaseFacts.js
//
// The one piece of I/O the enquiry chase needs: has anything already happened
// to this lead?
//
// ── Why this is a separate file from stopConditions.js ────────────────────
//
// Because that one is in the browser bundle. lib/dashboard/workPanel.js
// imports quoteChaseBlocker from it and app/components/dashboard/WorkPanel.js
// is a client component, so every import stopConditions.js can reach has to
// be downloadable by a browser.
//
// This gatherer reaches lib/agency/leadFacts.js, which reaches the analytics
// rollup, which reaches lib/db.js, which is pg. Putting it in stopConditions
// — even behind `await import()`, which does NOT keep a module out of the
// bundle, whatever it looks like — failed `npm run build` with seven
// "Module not found: Can't resolve 'dns'" errors tracing the Postgres driver
// into a client component. The dynamic import was a guess that read as a
// precaution; the build was the thing that knew.
//
// Only the cron imports this.

import { loadLeadFacts } from "@/lib/agency/leadFacts";
import { loadLeadAppointments } from "@/lib/leads/linkedDocuments";

/**
 * The facts leadChaseBlocker needs that are not on the LeadRequest row, for a
 * batch of candidate leads.
 *
 * ── Two existing matchers, no third one ───────────────────────────────────
 *
 * Both of these already exist, both are already trusted by a screen, and they
 * answer deliberately different questions — so the union of the two is the
 * honest "has anything happened to this lead":
 *
 *   · lib/agency/leadFacts.js loadLeadFacts — the client/quote matching.
 *     A lead becomes a client by certain email or phone match
 *     (lib/contacts/matchContact.js, never a name alone), a quote by
 *     LeadRequest.quoteId or the CONFIRMED inferred link the Leads board
 *     already prints on the card, and a job through the won quote. This is
 *     the matcher that correctly reported a booked visit to the marketing
 *     agency while the owner's own dashboard showed nothing, which is why it
 *     is the one reused rather than re-derived.
 *   · lib/leads/linkedDocuments.js loadLeadAppointments — every appointment
 *     on the lead itself, ANY mode. Its own docblock says why it is not
 *     leadFacts' rule: that one narrows to the single in-person estimate
 *     visit an agency counts as the conversion, and narrowing would hide a
 *     phone consult and a reschedule. For a STOP condition, hiding a phone
 *     consult means texting "we haven't been able to reach you" at somebody
 *     who has a call booked for Thursday.
 *
 * ── Cost ──────────────────────────────────────────────────────────────────
 *
 * Called once per rule per cron run, and only when the finder returned
 * anything — which on most runs is nothing, because the finder already
 * excludes leads this rule has chased. loadLeadFacts scans the company's
 * client book to do its matching, so the caller must not invoke this per
 * lead.
 *
 * `assignRefs: false` is not optional: loadLeadFacts writes an agency
 * reference onto leads that have none by default, and a cron that is deciding
 * whether to send must not leave rows behind as a side effect of asking.
 *
 * @returns {Promise<Map<string, {hasAppointment:boolean,hasQuote:boolean,hasJob:boolean,repliedAt:Date|null}>>}
 */
export async function gatherLeadChaseFacts(db, { companyId, leads = [] } = {}) {
  const out = new Map();
  const ids = [...new Set((Array.isArray(leads) ? leads : []).map((l) => l?.id).filter(Boolean))];
  if (!db || !companyId || !ids.length) return out;

  const [factsResult, threads] = await Promise.all([
    loadLeadFacts({ db, companyId, where: { id: { in: ids } }, assignRefs: false, take: ids.length }),
    // The lead's own conversation. lastInboundAt is the newest message FROM
    // the homeowner; leadFacts selects firstInboundAt, which is the one that
    // created the lead and can never be a reply to it.
    db.messageThread.findMany({
      where: { companyId, leadId: { in: ids } },
      select: { leadId: true, lastInboundAt: true },
    }),
  ]);

  const factOf = new Map((factsResult?.facts || []).map((f) => [f.id, f]));
  const repliedOf = new Map();
  for (const t of threads) {
    if (!t.lastInboundAt) continue;
    const seen = repliedOf.get(t.leadId);
    if (!seen || new Date(t.lastInboundAt).getTime() > new Date(seen).getTime()) {
      repliedOf.set(t.leadId, t.lastInboundAt);
    }
  }

  for (const lead of leads) {
    if (!lead?.id) continue;
    const fact = factOf.get(lead.id) || null;
    const appts = await loadLeadAppointments(db, {
      leadId: lead.id,
      quoteId: lead.quoteId || fact?.quote?.id || null,
      companyId,
    }).catch(() => []);
    // A CANCELLED appointment does not stop the chase, and that is the whole
    // point of this line: they cancelled, nobody has rebooked, and getting
    // them back on the calendar is exactly what the chase is for. A
    // "rescheduled" one does stop it — the row it was moved to is in this
    // list as well, so the lead has a time.
    const booked =
      (Array.isArray(appts) ? appts : []).some((a) => a && a.status !== "cancelled") ||
      Boolean(fact?.appointment && fact.appointment.status !== "cancelled");

    out.set(lead.id, {
      hasAppointment: booked,
      hasQuote: Boolean(fact?.quote),
      hasJob: Boolean(fact?.jobs?.length),
      repliedAt: repliedOf.get(lead.id) || null,
    });
  }
  return out;
}
