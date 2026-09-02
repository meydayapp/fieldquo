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
import { hasToggle, assignedJobWhere } from "@/lib/permissions/enforce";
import { actualJobCost, compareJobCost } from "@/lib/costing/actualJobCost";
import { equipmentCostForJob } from "@/lib/costing/equipmentUsage";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";
import { unattributedLabourForJob } from "@/lib/costing/unattributedHours";
import { contractValue } from "@/lib/jobs/changeOrderValue";

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

  // Three gates now: the job's level, the job's SCOPE, then what it cost. A
  // member scoped to their own jobs cannot hold jobCosting and reach this — the
  // Crew preset has it off — but the scope belongs on the query regardless, so
  // that turning the toggle on for one crew member grants them costing on
  // THEIR jobs rather than on the company's.
  const job = await db.job.findFirst({
    where: {
      id: _params.id,
      companyId: member.companyId,
      ...assignedJobWhere(full),
    },
    select: {
      id: true,
      // `id` so quotedCostFor can be asked about it; `total` is the revenue
      // the variance is measured against. The cost itself is no longer read
      // here — see the note below.
      quote: { select: { id: true, total: true } },
      // ── Why revenue is no longer just the quote ──────────────────────────
      //
      // This route used to compute `revenue: job.quote?.total` and nothing
      // else. A job quoted at $10,000 with $4,000 of agreed change orders
      // reported $10,000, so the margin on the job page was wrong by the full
      // value of every change — silently, and always in the direction that
      // flatters the job. Only APPROVED rows count; see
      // lib/jobs/changeOrderValue.js.
      changeOrders: { select: { priceDelta: true, status: true, invoiceId: true } },
      // Returned so the panel formats in the company's billing currency. The
      // job endpoint doesn't load the company, and defaulting to CAD in the
      // component is exactly the bug that put "$2100.00" on client documents.
      company: { select: { currency: true } },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [expenses, timeEntries, assetUseLogs] = await Promise.all([
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
        // The timestamps bound the window the unattributed figure below is
        // measured over. Cheap here; the alternative is a second query for
        // dates this row already carries.
        clockIn: true,
        clockOut: true,
        worker: { select: { hourlyRate: true } },
      },
    }),
    // companyId re-checked on the row itself, not only on the job: a use log
    // is only ever created against the caller's own company (see
    // app/api/jobs/[id]/asset-use/route.js), but this is the same
    // tenant-scope discipline every other query on this route already keeps.
    db.assetUseLog.findMany({
      where: { jobId: job.id, companyId: member.companyId },
      select: {
        hours: true,
        asset: {
          select: {
            id: true,
            name: true,
            cost: true,
            salvageValue: true,
            inServiceDate: true,
            usefulLifeMonths: true,
            disposedOn: true,
            active: true,
          },
        },
      },
    }),
  ]);

  // ── Overhead, so the two margins on this screen mean the same thing ──────
  //
  // The quote's estimated cost has always carried a share of overhead
  // (estimateJobCost: material + labour + overhead). The actual never did, so
  // the job panel showed a GROSS margin and compared it against a estimate that
  // included a cost the actual was missing — a variance biased toward "under
  // budget" on every job in the product.
  //
  // Same figure, same source: calculateMinimumPrice().costPerJob is what the
  // quote was costed with, so the comparison is like for like. It stays null
  // when the company has not filled in the overhead screen — an unknown
  // overhead is absent, not zero, and a job whose margin quietly improved
  // because we invented a zero would be the worse bug.
  const overhead = await calculateMinimumPrice({ companyId: member.companyId })
    .then((r) => (r && Number.isFinite(Number(r.costPerJob)) ? Number(r.costPerJob) : null))
    .catch(() => null);

  // Raw allocation only — actualJobCost decides whether this is safe to add
  // to the total, based on whether `overhead` above already carries it. See
  // the double-count note on actualJobCost() and docs/SAFETY-AND-EQUIPMENT.md.
  const equipment =
    assetUseLogs.length > 0
      ? equipmentCostForJob({ useLogs: assetUseLogs, asOf: new Date() })
      : null;

  const actual = actualJobCost(expenses, timeEntries, {
    overheadPerJob: overhead,
    overheadBasis: overhead === null ? null : "per_job",
    equipment,
  });

  // ── The hours that reached no job at all ─────────────────────────────────
  //
  // `actual.labour` above is, by construction, only the hours somebody
  // ATTRIBUTED — the query it comes from is `where: { jobId: job.id }`. Until
  // the self-serve clock learned to set a job, that query missed every hour
  // punched from a phone, and the panel showed the shortfall as if it were the
  // figure. This is the other half of the sentence: company-wide, over the
  // window this job ran in, how many hours are recorded against NO job and are
  // therefore in nobody's costing, including this one's.
  //
  // Deliberately not folded into the labour total. Adding it would be inventing
  // an attribution; omitting it silently is the bug being fixed. It is a
  // separate figure with its own sentence — see lib/costing/unattributedHours.js
  // and the panel's own note. Null when there is no honest window to measure.
  const unattributed = await unattributedLabourForJob(db, {
    companyId: member.companyId,
    jobId: job.id,
    attributed: timeEntries,
  }).catch(() => null);

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

  // Quoted, plus what was agreed since, equals what the job is now worth —
  // returned as three separate figures, not one blended "revenue". A single
  // number would hide the thing a contractor most needs to see: that the job
  // grew, and by how much. The panel renders all three.
  //
  // currentContractValue is null when there is no quote behind the job at all,
  // even if change orders exist: unknown plus $500 is still unknown, and
  // stating $500 would put a margin on the page against a contract value
  // nobody ever agreed.
  const contract = contractValue({
    quotedTotal: job.quote?.total ?? null,
    changeOrders: job.changeOrders,
  });

  const comparison = compareJobCost({
    estimatedCost,
    actualCost: actual.total,
    revenue: contract.currentContractValue,
  });

  return NextResponse.json({
    actual,
    // Hours in this window that belong to no job. Its own key, never merged
    // into `actual.labour` — see the note where it is computed.
    unattributed,
    comparison,
    contract,
    // When the estimate was taken. A variance against a figure snapshotted
    // eight months ago is still a fair comparison, but the reader deserves to
    // know that is what they are looking at.
    estimatedAt: job.quote?.costing?.updatedAt || null,
    currency: job.company?.currency || "CAD",
  });
}
