// app/api/invoices/costing/route.js
//
// Everything the invoice Cost & margin panel needs to open, in one request.
//
// ── Why a static sibling of [id] rather than [id]/costing ───────────────────
//
// The panel appears on /app/invoices/new as well, where there is no invoice id
// yet — the crew and hours are typed before the row exists and are saved with
// the POST that creates it. An [id]-scoped endpoint could not serve that page
// at all, and two endpoints returning the same five things is the copy that
// rots. `?invoiceId=` is optional: without it you get the company-level part
// (team, overhead, currency); with it you also get what was saved against that
// invoice and, if nothing was, what its timesheets would seed.
//
// Next resolves the static segment ahead of [id], so this does not shadow
// /api/invoices/<cuid>.
//
// ── Saving is not here ─────────────────────────────────────────────────────
//
// The costing is written by POST /api/invoices and PATCH /api/invoices/[id],
// in the same transaction as the invoice itself. A separate save button would
// let someone edit the hours, press Save on the invoice, and lose them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  hasToggle,
  redactPayList,
} from "@/lib/permissions/enforce";
import { crewFromTimeEntries } from "@/lib/costing/actualJobCost";
import { resolveInvoiceJob } from "@/lib/invoices/jobLink";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  // Same gate as the job's cost panel. Someone who may not see what a job cost
  // must not see it on the invoice for the same job, or the gate is decorative.
  if (!hasToggle(full, "jobCosting")) {
    return NextResponse.json(
      { error: "You don't have access to job costing." },
      { status: 403 },
    );
  }

  const invoiceId = new URL(request.url).searchParams.get("invoiceId");

  const [company, workers] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { currency: true },
    }),
    db.worker.findMany({
      where: { companyId: member.companyId },
      // userId is selected only so redactPay can recognise "this is you" and
      // leave your own rate alone; without it the caller's own wage would be
      // stripped from a list they are entitled to see it in.
      select: { id: true, name: true, hourlyRate: true, userId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Pay rates are payroll data wherever they are read from — the same
  // redaction /api/workers applies. A supervisor who may cost a job is not
  // automatically someone who may read everyone's wage.
  const teamView = redactPayList(full, workers, { ownUserId: member.userId });

  // Real overhead per job, when the company has told us their capacity.
  // `needsCapacity` is a legitimate "we don't know", not an error: the panel
  // falls back to a percentage of the price and says so.
  let overheadPerJob = null;
  let overheadSource = null;
  try {
    const min = await calculateMinimumPrice({ companyId: member.companyId });
    if (!min?.error && Number.isFinite(Number(min?.costPerJob))) {
      overheadPerJob = Number(min.costPerJob);
      overheadSource = {
        monthlyFixedCosts: min.monthlyFixedCosts,
        jobsPerMonth: min.jobsPerMonth,
      };
    }
  } catch {
    // An overhead figure we couldn't work out is absent, not zero. Leaving
    // both null makes the panel show the percentage fallback and label it.
  }

  const base = {
    currency: company?.currency || null,
    workers: teamView,
    overheadPerJob,
    overheadSource,
    saved: null,
    seed: null,
  };

  if (!invoiceId) return NextResponse.json(base);

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, companyId: member.companyId },
    // jobId joins the explicit link resolveInvoiceJob needs below.
    select: { id: true, quoteId: true, jobId: true, costing: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invoice.costing) {
    // ── Saved wins, always, and no seed is even computed ──────────────────
    //
    // Re-seeding here would quietly replace a corrected 6.5 with the
    // timesheet's 8 on the next page load, which is exactly the class of
    // control that appears to work and doesn't. The row's existence is the
    // flag: once someone has saved a cost panel for this invoice, the
    // timesheets stop having an opinion about it.
    return NextResponse.json({
      ...base,
      saved: {
        crew: Array.isArray(invoice.costing.crew) ? invoice.costing.crew : [],
        materialCost: Number(invoice.costing.materialCost),
        overheadPct: Number(invoice.costing.overheadPct),
        note: invoice.costing.note || "",
        // What it came to when it was saved, computed server-side then. The
        // read-only card on the invoice page shows THESE rather than
        // recomputing, because the company's overhead per job moves and a
        // figure that changes when nobody touched the invoice is worse than a
        // stale one. The editor recomputes live from the inputs above; both
        // agree because both run invoiceCostSummary over the same rows.
        totals: {
          labourHours: Number(invoice.costing.labourHours),
          labourCost: Number(invoice.costing.labourCost),
          materialCost: Number(invoice.costing.materialCost),
          overhead: Number(invoice.costing.overhead),
          totalCost: Number(invoice.costing.totalCost),
        },
      },
    });
  }

  // Nothing saved yet — offer the timesheets. The path to them used to be
  // written out here as invoice → quote → job and nowhere else, which meant a
  // manually-raised invoice could never seed from anything even after somebody
  // linked its job by hand. resolveInvoiceJob is now the single rule (explicit
  // link first, the quote's job as the fallback), shared with the lifecycle
  // route so the two screens agree about which job this invoice bills for.
  //
  // Still null for an invoice with neither, and it starts blank rather than
  // inventing a crew.
  const job = await resolveInvoiceJob(db, invoice, member.companyId);
  if (!job) return NextResponse.json(base);

  const timeEntries = await db.timeEntry.findMany({
    where: { jobId: job.id, worker: { companyId: member.companyId } },
    select: {
      hours: true,
      status: true,
      workerId: true,
      worker: { select: { name: true, hourlyRate: true } },
    },
  });

  const seeded = crewFromTimeEntries(
    timeEntries.map((t) => ({
      hours: t.hours == null ? 0 : Number(t.hours),
      status: t.status,
      workerId: t.workerId,
      worker: {
        name: t.worker?.name,
        hourlyRate:
          t.worker?.hourlyRate == null ? null : Number(t.worker.hourlyRate),
      },
    })),
  );

  if (seeded.crew.length === 0 && seeded.pendingHours === 0)
    return NextResponse.json(base);

  return NextResponse.json({
    ...base,
    seed: { ...seeded, jobId: job.id },
  });
}
