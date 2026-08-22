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
      quote: { select: { total: true } },
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

  // ── Why estimatedCost is null rather than computed ─────────────────────
  //
  // The quote's cost estimate is not stored. The quote screen recomputes it on
  // every render from the company's CURRENT price book, labour rate and
  // overhead. Recomputing it here would therefore not answer "what did we
  // think this would cost" — it would answer "what would we think today",
  // against rates that may have changed since. A variance measured that way
  // moves when nobody touched the job, which is worse than no variance.
  //
  // Doing it properly means snapshotting the estimate when the quote is saved,
  // and that has to happen SERVER-side: non-negotiable #5 says the browser
  // never sends money amounts, so the client's figure cannot simply be posted.
  // That is a real piece of work and a decision about when the snapshot is
  // taken; it is not smuggled in here.
  //
  // So this endpoint answers the question it can answer completely — what the
  // job actually cost, and what it made against the price the client agreed.
  // estimatedCost stays null, and compareJobCost returns null for variance
  // rather than a fake 0%.
  const comparison = compareJobCost({
    estimatedCost: null,
    actualCost: actual.total,
    revenue: job.quote?.total == null ? null : Number(job.quote.total),
  });

  return NextResponse.json({
    actual,
    comparison,
    currency: job.company?.currency || "CAD",
  });
}
