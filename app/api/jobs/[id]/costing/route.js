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
import { getCurrentMember } from "@/lib/currentMember";
import { loadEnforceableMember, hasToggle } from "@/lib/permissions/enforce";
import { actualJobCost, compareJobCost } from "@/lib/costing/actualJobCost";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const full = await loadEnforceableMember(db, member.id);
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
      // costing is QuoteCosting — the estimate as it was when the quote was
      // saved, not as it would be recomputed today. See the note below.
      quote: {
        select: {
          total: true,
          costing: { select: { totalCost: true, updatedAt: true } },
        },
      },
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
  const estimatedCost =
    job.quote?.costing?.totalCost == null
      ? null
      : Number(job.quote.costing.totalCost);

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
