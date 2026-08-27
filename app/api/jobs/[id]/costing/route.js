// app/api/jobs/[id]/costing/route.js
//
// What this job cost, against what the quote estimated.
//
// Gated on the SAME granular toggle as the quote's Cost & margin block —
// jobCosting. Someone who may not see the margin on a quote must not see it on
// the job either, or the gate is decorative.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quotedCostFor } from "@/lib/costing/quoteCostEstimate";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { actualJobCost, compareJobCost } from "@/lib/costing/actualJobCost";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Two gates: the job first, then what it cost. jobCosting on its own would
  // answer for somebody not allowed the record the costing belongs to.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  if (!hasToggle(full, "jobCosting")) {
    return NextResponse.json(
      { error: "You don't have access to job costing." },
      { status: 403 },
    );
  }

  const job = await db.job.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: {
      id: true,
      // `id` so quotedCostFor can be asked about it; `total` is the revenue
      // the variance is measured against. The cost itself is no longer read
      // here — see the note below.
      quote: { select: { id: true, total: true } },
      // Returned so the panel formats in the company's billing currency. The
      // job endpoint doesn't load the company, and defaulting to CAD in the
      // component is exactly the bug that put "$2100.00" on client documents.
      company: { select: { currency: true } },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [expenses, timeEntries] = await Promise.all([
    db.expense.findMany({
      where: { projectId: job.id, companyId: member.companyId },
      select: { category: true, amount: true },
    }),
    db.timeEntry.findMany({
      where: { jobId: job.id, worker: { companyId: member.companyId } },
      select: {
        hours: true,
        status: true,
        workerId: true,
        worker: { select: { hourlyRate: true } },
      },
    }),
  ]);

  const actual = actualJobCost(expenses, timeEntries);

  // ── The estimate IS stored now ───────────────────────────────────────────
  //
  // This used to pass `estimatedCost: null` with a long comment explaining that
  // the quote's estimate lived only in the browser, was recomputed on every
  // render from the company's CURRENT price book, and that comparing against it
  // would answer "what would we think today" rather than "what did we think
  // then" — a variance that moves when nobody touched the job.
  //
  // That reasoning was right and the premise has changed: QuoteCosting is the
  // server-side snapshot it asked for, written when the quote is saved and
  // computed from the quote's own scope groups rather than accepted from the
  // browser. So the variance is now a real one, measured against the figures
  // the estimator actually committed to.
  //
  // Still null when the quote was never costed, or when there is no quote
  // behind the job at all. compareJobCost returns null for variance in that
  // case rather than a fake 0%, and the panel says nothing rather than
  // reporting a job as on budget when no budget was ever set.
  //
  // And null is not the same as "no row". A quote costed from its door counts
  // and never opened in the crew panel has no QuoteCosting row and a perfectly
  // real cost; reading the row alone reported those jobs as having no budget.
  // quotedCostFor is the same saved-then-derived rule the quote page and the
  // invoice use, so the three cannot disagree about one quote.
  const quotedCost = await quotedCostFor({
    companyId: member.companyId,
    quoteId: job.quote?.id || null,
  });
  const estimatedCost = quotedCost ? quotedCost.totalCost : null;

  const comparison = compareJobCost({
    estimatedCost,
    actualCost: actual.total,
    revenue: job.quote?.total == null ? null : Number(job.quote.total),
  });

  return NextResponse.json({
    actual,
    comparison,
    // When the estimate was taken. A variance against a figure snapshotted
    // eight months ago is still a fair comparison, but the reader deserves to
    // know that is what they are looking at.
    estimatedAt: job.quote?.costing?.updatedAt || null,
    currency: job.company?.currency || "CAD",
  });
}
