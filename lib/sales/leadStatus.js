// lib/sales/leadStatus.js
//
// A lead's status is driven by what happened, not by a rep remembering to
// change a dropdown.
//
// ══ 2026-09-21: 13 leads against 148 dispositions ═════════════════════════
//
// The Leads box on /platform/sales/performance read 13 leads — 9 new, 2
// contacted, 2 demoed — beside 148 call outcomes, 11 callbacks and 9 demo
// bookings. The reps do not hand-update a lead's status, and nothing else
// did either except a signup (lib/sales/leadLink.js writes "signed") and,
// when an attempt already carried a leadId, the disposition's leadStatus.
// Most attempts carry a prospectId and no leadId — the rep dials from the
// claimed prospect, and a SalesLead only existed if somebody had made one
// — so the box counted a different world from the one the calls table
// counted.
//
// ══ The transitions ═══════════════════════════════════════════════════════
//
//   reached / callback / reached_not_interested / reached_interested /
//   agreed_link_sent / text_instead / gatekeeper …   → contacted
//       every disposition whose catalogue entry carries `leadStatus:
//       "contacted"` (lib/sales/calls/dispositions.js) — the rep spoke to
//       somebody at the business
//   a demo booked (SalesEvent type "demo", however it was booked) → demoed
//   a signup attributed to the rep (leadLink.js)                → signed
//   not_a_fit / do_not_call                                     → lost,
//       with the reason appended to the lead's notes
//
// ══ Never backwards, and a no-op the second time ══════════════════════════
//
// The order is new < contacted < demoed < lost < signed. A move is a
// compare-and-set — UPDATE … WHERE status IN (the ranks below the target)
// — so a "contacted" landing after "demoed" changes nothing, a second
// delivery of the same event changes nothing, and two writes a moment
// apart cannot both win. "lost" sits below "signed" on purpose: a business
// the rep marked not-a-fit that signs up anyway has signed, and a signed
// company cannot be lost by a phone call.
//
// ══ The lead is created when there is none ════════════════════════════════
//
// An attempt on a claimed prospect with no SalesLead gets one — through
// lib/sales/leadCreate.js createSalesLead, the one place leads are made —
// and the attempt is linked to it, so the next outcome finds it by
// leadId. Only for a transition that means something: a `no_answer` on a
// prospect with no lead creates nothing, because "new" is what a lead
// would say and there is nothing to say it about.
import { createSalesLead } from "./leadCreate";
import { dispositionFor } from "./calls/dispositions";

export const LEAD_STATUS_RANK = Object.freeze({ new: 0, contacted: 1, demoed: 2, lost: 3, signed: 4 });

/** Statuses a move to `to` may overwrite — everything ranked below it. */
export function statusesBelow(to) {
  const rank = LEAD_STATUS_RANK[to];
  if (rank === undefined) return [];
  return Object.entries(LEAD_STATUS_RANK)
    .filter(([, r]) => r < rank)
    .map(([s]) => s);
}

/**
 * The status a disposition drives the lead to, or null. Pure.
 * `not_a_fit` and `do_not_call` are "lost"; the rest follow the catalogue.
 */
export function leadStatusForDisposition(code) {
  const d = dispositionFor(code);
  if (!d) return null;
  if (code === "not_a_fit" || code === "do_not_call") return "lost";
  return d.leadStatus || null;
}

/**
 * Move one lead forward. Compare-and-set; returns how many rows moved
 * (0 when already at or past `to`, or not this rep's).
 *
 * @param tx       Prisma client or transaction
 * @param reason   one line, kept on the lead's notes for a move to "lost"
 */
export async function advanceLeadStatus(tx, { leadId, salesRepId, to, reason = null, now = new Date() } = {}) {
  const below = statusesBelow(to);
  if (!leadId || !salesRepId || below.length === 0) return { moved: 0 };
  const data = { status: to };
  if (to === "lost" && reason) {
    // Appended, never replacing: the notes are the rep's, and the line
    // says what closed the lead and when.
    const row = await tx.salesLead.findFirst({ where: { id: leadId, salesRepId }, select: { notes: true } });
    const line = `Lost (${now.toISOString().slice(0, 10)}): ${String(reason).slice(0, 300)}`;
    data.notes = row?.notes ? `${row.notes}\n${line}`.slice(0, 5000) : line;
  }
  const res = await tx.salesLead.updateMany({ where: { id: leadId, salesRepId, status: { in: below } }, data });
  return { moved: res.count };
}

/**
 * The lead an attempt belongs to — by its leadId, else the rep's lead on
 * the same prospect, else a new one from the claimed prospect (and the
 * attempt is linked to it). Null when there is no prospect to make one
 * from.
 */
export async function leadForAttempt(tx, { attempt, salesRepId } = {}) {
  if (!attempt || !salesRepId) return null;
  if (attempt.leadId) {
    const own = await tx.salesLead.findFirst({ where: { id: attempt.leadId, salesRepId }, select: { id: true, status: true } });
    if (own) return { ...own, created: false };
  }
  if (!attempt.prospectId) return null;
  const existing = await tx.salesLead.findFirst({
    where: { prospectId: attempt.prospectId, salesRepId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (existing) {
    if (!attempt.leadId) await tx.salesCallAttempt.updateMany({ where: { id: attempt.id, leadId: null }, data: { leadId: existing.id } });
    return { ...existing, created: false };
  }
  const prospect = await tx.prospect.findFirst({
    where: { id: attempt.prospectId, assignedRepId: salesRepId },
    select: { id: true, businessName: true, email: true, phoneE164: true, country: true, province: true },
  });
  if (!prospect) return null;
  const created = await createSalesLead(tx, { salesRepId, source: prospect, status: "new" });
  await tx.salesCallAttempt.updateMany({ where: { id: attempt.id, leadId: null }, data: { leadId: created.id } });
  return { id: created.id, status: created.status, created: true };
}

/**
 * Apply a disposition to the attempt's lead: find or create the lead,
 * then move it. Returns what happened, for the caller's response and for
 * the backfill's count.
 */
export async function applyDispositionToLead(tx, { attempt, salesRepId, code, note = "", now = new Date() } = {}) {
  const to = leadStatusForDisposition(code);
  if (!to) return { to: null, moved: 0, leadId: attempt?.leadId || null, created: false };
  const lead = await leadForAttempt(tx, { attempt, salesRepId });
  if (!lead) return { to, moved: 0, leadId: null, created: false };
  const d = dispositionFor(code);
  const reason = to === "lost" ? `${d?.label || code}${note ? ` — ${String(note).trim()}` : ""}` : null;
  const { moved } = await advanceLeadStatus(tx, { leadId: lead.id, salesRepId, to, reason, now });
  return { to, moved, leadId: lead.id, created: Boolean(lead.created) };
}

/**
 * Everything that already happened, replayed: dispositions on attempts
 * since `since` and demo events since `since`. Idempotent — every move is
 * a compare-and-set — so it runs from the every-minute cron over a rolling
 * fortnight as the net for anything written by an older path, and the
 * first run is the backfill.
 *
 * @returns {{ attempts, moved, created, demos, demoMoved, byStatus }}
 */
export async function backfillLeadStatuses({ client, since, now = new Date(), limit = 500 } = {}) {
  const out = { attempts: 0, moved: 0, created: 0, demos: 0, demoMoved: 0 };
  const attempts = await client.salesCallAttempt.findMany({
    where: { dialledAt: { gte: since }, disposition: { not: null }, salesRepId: { not: null } },
    orderBy: { dialledAt: "asc" },
    take: Math.max(1, Math.min(2000, Number(limit) || 500)),
    select: { id: true, salesRepId: true, prospectId: true, leadId: true, disposition: true, dispositionNote: true, dispositionAt: true },
  });
  for (const a of attempts) {
    if (!leadStatusForDisposition(a.disposition)) continue;
    out.attempts += 1;
    // eslint-disable-next-line no-await-in-loop
    const r = await client.$transaction((tx) =>
      applyDispositionToLead(tx, { attempt: a, salesRepId: a.salesRepId, code: a.disposition, note: a.dispositionNote || "", now: a.dispositionAt || now }),
    );
    out.moved += r.moved;
    if (r.created) out.created += 1;
  }
  const demos = await client.salesEvent.findMany({
    where: { type: "demo", createdAt: { gte: since }, leadId: { not: null } },
    select: { leadId: true, salesRepId: true },
    take: 500,
  });
  for (const e of demos) {
    out.demos += 1;
    // eslint-disable-next-line no-await-in-loop
    const r = await advanceLeadStatus(client, { leadId: e.leadId, salesRepId: e.salesRepId, to: "demoed", now });
    out.demoMoved += r.moved;
  }
  const grouped = await client.salesLead.groupBy({ by: ["status"], _count: { _all: true } });
  out.byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  return out;
}
