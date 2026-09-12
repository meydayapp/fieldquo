// app/api/platform/sales/review/bulk/route.js
//
// "Assign trade X to every row matching this filter" — and "reject every row
// matching this filter" — as ONE act.
//
// ══ Why bulk exists, and what it must never do ═════════════════════════════
//
// A filter like "RBQ · Laval · name contains 'toiture'" IS the decision: every
// row in it is a roofer, and pressing 1 four hundred times is a person doing
// a query's job. So the server re-runs the filter — the same reviewWhereSql
// the list and the count use, so the rows written are the rows the screen
// counted — and applies one decision to all of them, inside one transaction,
// with the counters adjusted per campaign by the same effects table a single
// decision uses.
//
// What it must never touch: a row a rep holds, or a do-not-contact row. Both
// are outside the folder's WHERE already (reviewFolder.js says why), and both
// are re-asserted on the updateMany's own where, so the guard does not depend
// on the list being right. The check drives this route's writer with a fake
// client whose selection deliberately includes a claimed and a suppressed
// row, and asserts neither is written.
//
// ══ One audit row, not forty thousand ══════════════════════════════════════
//
// The audit log gets one `sales_prospects_bulk_reviewed` row carrying the
// filter, the decision, the count and three sample names. Corrections are
// still one per prospect — ProspectCorrection is the per-row record of who
// changed what — written with createMany in batches.
//
// ══ Research is NOT queued here ════════════════════════════════════════════
//
// Forty thousand ensureResearchQueued calls in a request is forty thousand
// task inserts. The backlog cron (lib/sales/pipeline/research.js's
// topUpResearchBacklog) picks up discovered rows with a website, rows with a
// trade first, and the claim path queues the rest the moment a rep takes
// one. The response says so.
//
// ══ Confirmation is the client's job, the count is not ═════════════════════
//
// The screen shows "Assign Roofing to 412 rows — e.g. A, B, C" and asks. But
// the count it shows was true when the page loaded; this route recounts, and
// if the number moved by more than the caller's `expectedCount` allows it
// refuses and reports the new count rather than assigning to rows nobody
// looked at.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { isDiscoveryTradeKey, discoveryTradeLabel } from "@/lib/sales/discovery/trades";
import { parseReviewFilter } from "@/lib/sales/discovery/reviewFolder";
import { bulkReview } from "@/lib/sales/discovery/reviewBulk";

/** A bulk request is refused when nothing narrows it: "every row" is not a decision. */
function filterIsNarrow(filter) {
  return Boolean(filter.campaignId || filter.source || filter.province || filter.q || filter.retail || filter.reason);
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const filter = parseReviewFilter(body?.filter && typeof body.filter === "object" ? body.filter : {});
  const decision = body?.decision === "reject" ? "reject" : body?.decision === "accept" ? "accept" : null;
  const tradeKey = typeof body?.tradeKey === "string" ? body.tradeKey.trim() : null;
  const expectedCount = Number.isInteger(body?.expectedCount) ? body.expectedCount : null;

  if (!decision) return bad('A bulk review is "accept" (with a trade) or "reject".');
  if (decision === "accept" && !isDiscoveryTradeKey(tradeKey)) return bad("Assigning needs a trade from the catalogue.");
  if (!filterIsNarrow(filter)) return bad("Narrow the folder first — a bulk decision over every row is not a decision.");
  if (expectedCount === null) return bad("Say how many rows you expect to change, so a moved count is refused rather than applied.");

  try {
    const result = await bulkReview({
      db,
      filter,
      decision,
      tradeKey,
      expectedCount,
      adminId: admin.id,
      now: new Date(),
    });
    if (!result.ok) return NextResponse.json(result, { status: 409 });
    return NextResponse.json({
      ...result,
      tradeLabel: decision === "accept" ? discoveryTradeLabel(tradeKey) : null,
      research: "Not queued here. The backlog cron researches rows with a website, trade first; a claim queues the rest.",
    });
  } catch (err) {
    console.error("[platform/sales/review/bulk]", err);
    return NextResponse.json({ error: err?.message || "The bulk decision did not apply." }, { status: 500 });
  }
}

function bad(error) {
  return NextResponse.json({ error }, { status: 400 });
}
