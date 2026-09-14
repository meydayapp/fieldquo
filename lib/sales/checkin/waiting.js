// lib/sales/checkin/waiting.js
//
// The drafts waiting for a rep to press Send — counted ONCE, for every
// surface that shows the number.
//
// ══ Why one function ══════════════════════════════════════════════════════
//
// The owner: "there should be a little banner on the side that calls the
// rep's attention that a check-in or follow-up text has been created waiting
// to be sent". Three places answer that — the sidebar's badge on Texts, the
// card on Today, the banner above the texts list — and three counts written
// three times would be three definitions of "waiting" that drift apart the
// week one of them is edited (AGENTS.md failure class #4). So the definition
// lives here, the badge route, the waiting route and the texts list all call
// it, and scripts/check-sales-checkin.mjs asserts that each of them does.
//
// ══ What "waiting" means, exactly ═════════════════════════════════════════
//
// A SalesCheckIn row in status "draft" — not sent, not put away — of ANY
// origin: the engine's day-1 / day-7 / milestone rows, an unfinished-signup
// nudge on a lead, the thread's own adopted suggestion, a follow-up the rep
// parked by hand, and the rows on the rep's demo company. A draft the rep
// wrote themselves is still a text waiting to go. The demo's are counted in
// the total AND reported separately (`demoCount`), so a screen can say
// "3 waiting, 1 of them on your demo" rather than either hiding the demo
// (the rep would never learn the feature there) or passing it off as a
// customer. A row with no number on file (`toE164` null) is waiting too —
// it is the companies screen's "no number on file — add one" — and is
// reported as `noNumberCount` so the banner can send the rep there.
//
// A row mid-send (`sendingStartedAt` set, status still "draft") is a send we
// lost track of; it stays counted, because the honest reading is that it has
// not gone, and the thread says so in words.
//
// ══ Nothing here writes, sends, or imports the send path ══════════════════
//
// Read-only over FieldQuo's own table. It does not import store.js: a count
// that could reach the carrier is a count nobody should have to audit.
import { db } from "@/lib/db";
import { describeDraftKey } from "./plan";

/** The most a screen is handed. The count is over all rows; the list is not. */
export const WAITING_LIST_LIMIT = 50;

/**
 * @param salesRepId  the rep. Re-read by the caller's gate; trusted from nobody.
 * @param client      injectable, so the check can run it against memory.
 *
 * @returns {{
 *   count: number,          every draft of every origin, demo included
 *   demoCount: number,      the subset on the rep's demo company
 *   noNumberCount: number,  the subset with no number on file (no thread)
 *   items: Array<{
 *     id, companyId, companyName, leadId, toE164, isDemo, noNumber,
 *     kind, touchpoint, reasonCode, scheduledFor, createdAt, sendingStartedAt
 *   }>                      oldest first, at most WAITING_LIST_LIMIT
 * }}
 */
export async function waitingDraftsFor(salesRepId, { client = db } = {}) {
  if (!salesRepId) return { count: 0, demoCount: 0, noNumberCount: 0, items: [] };

  const rows = await client.salesCheckIn.findMany({
    where: { salesRepId, status: "draft" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      companyId: true,
      leadId: true,
      toE164: true,
      origin: true,
      reasonCode: true,
      dedupeKey: true,
      scheduledFor: true,
      createdAt: true,
      sendingStartedAt: true,
      company: { select: { name: true, isDemo: true } },
      lead: { select: { businessName: true, contactName: true } },
    },
  });

  let demoCount = 0;
  let noNumberCount = 0;
  const items = [];
  for (const r of rows) {
    const isDemo = r.origin === "demo" || r.company?.isDemo === true;
    const noNumber = !r.toE164;
    if (isDemo) demoCount += 1;
    if (noNumber) noNumberCount += 1;
    if (items.length >= WAITING_LIST_LIMIT) continue;
    const { kind, touchpoint } = describeDraftKey(r.dedupeKey);
    items.push({
      id: r.id,
      companyId: r.companyId || null,
      // The company's name when the draft is about one; else the lead's —
      // an unfinished-signup nudge or a parked follow-up has no company.
      companyName: r.company?.name || r.lead?.businessName || r.lead?.contactName || null,
      leadId: r.leadId || null,
      toE164: r.toE164 || null,
      isDemo,
      noNumber,
      kind,
      touchpoint,
      reasonCode: r.reasonCode || null,
      scheduledFor: r.scheduledFor || null,
      createdAt: r.createdAt,
      sendingStartedAt: r.sendingStartedAt || null,
    });
  }

  return { count: rows.length, demoCount, noNumberCount, items };
}
