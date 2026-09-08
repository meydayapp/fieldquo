// app/api/jobs/import/route.js
//
// POST — write past jobs (quote + job + invoice + payment each), one
// transaction per job, no client contact. The "Past jobs" screen at
// /app/jobs/import posts here: a single typed job as a one-row batch, and a
// reviewed CSV as a many-row batch. See lib/jobs/importPastJob.js for what is
// written and, more to the point, what is not sent.
//
// ── Data entry, not a pricing surface ──────────────────────────────────────
//
// The body carries money amounts, which AGENTS.md non-negotiable #5 forbids
// on client-facing pricing surfaces. This is neither client-facing nor
// pricing: a signed-in member of the company is recording what the company
// charged for work already done and paid, exactly as POST /api/expenses
// records what it spent. The server still owns everything derived from the
// figure — tax, totals, numbering, the ledger — and refuses anything that
// cannot be a past job (future payment, paid before it started).
//
// ── Permission ─────────────────────────────────────────────────────────────
//
// The level each of quote, invoice and job creation asks for on its own, plus
// client creation when a row needs one — see lib/jobs/pastJobsGate.js.
//
// ── Idempotent, all-or-nothing per row, never partial across a row ─────────
//
// Every row is validated before anything is written; an invalid row fails
// the whole request with per-row reasons, so a CSV never lands half-imported
// on a typo. Within the batch each job is its own transaction (see
// importPastJob.js) and a re-run skips what already landed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { buildPastJobsPreview, MAX_PAST_JOB_ROWS } from "@/lib/jobs/pastJobImport";
import { createPastJob, loadPastJobContext } from "@/lib/jobs/importPastJob";
import { pastJobsGate, clientCreateRefusal } from "@/lib/jobs/pastJobsGate";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await pastJobsGate(member);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || !rows.length) {
    return NextResponse.json({ error: "rows must be a non-empty array." }, { status: 400 });
  }
  if (rows.length > MAX_PAST_JOB_ROWS) {
    return NextResponse.json(
      { error: `A batch is at most ${MAX_PAST_JOB_ROWS} past jobs. Split the file and import it in parts.` },
      { status: 400 },
    );
  }

  const context = await loadPastJobContext(db, member.companyId);
  if (!context.company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const today = new Date();
  const preview = buildPastJobsPreview({
    rows,
    today,
    defaultTaxApplied: context.defaultTaxApplied,
    categories: context.categories,
    existingKeys: context.existingKeys,
    existingInvoiceNumbers: context.existingInvoiceNumbers,
    existingQuoteNumbers: context.existingQuoteNumbers,
  });

  // Nothing is written while any row is refused. The page showed the same
  // preview a moment ago; a row that fails here was edited on the way back
  // or is a race with another tab, and both deserve the row-level answer.
  const errored = preview.rows.filter((r) => r.status === "error");
  if (errored.length) {
    return NextResponse.json(
      {
        error: "Some rows can't be entered as past jobs.",
        rows: errored.map((r) => ({ index: r.index, errors: r.errors })),
      },
      { status: 400 },
    );
  }

  // A row the client-side review already knew was a duplicate is not sent;
  // one that arrives anyway is skipped here, not refused — it IS on file.
  const toWrite = preview.rows.filter((r) => r.status === "ok");

  const clientDenied = clientCreateRefusal(full, toWrite);
  if (clientDenied) return clientDenied;

  const results = [];
  for (const r of preview.rows) {
    if (r.status === "duplicate") {
      results.push({ index: r.index, status: "skipped", reason: r.duplicateOf });
      continue;
    }
    let outcome;
    try {
      outcome = await createPastJob(db, {
        companyId: member.companyId,
        createdByUserId: member.userId || null,
        row: r.value,
        category: r.category ? context.categories.find((c) => c.id === r.category.id) || null : null,
        context,
        now: today,
      });
    } catch (err) {
      console.error("[jobs/import] row", r.index, err?.message);
      outcome = { status: "error", error: "write_failed" };
    }
    results.push({ index: r.index, ...outcome });
  }

  const created = results.filter((r) => r.status === "created");
  const skipped = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "error");

  // One activity row for the batch. Internal — the activity log is the
  // office's own trail, never a client contact — and one line rather than
  // four per job, for the reason the expense import gives.
  if (created.length) {
    await recordActivity(member, {
      action: "job.past_imported",
      entityType: "job",
      entityId: created.length === 1 ? created[0].jobId : null,
      summary: `Entered ${created.length} past job${created.length === 1 ? "" : "s"}${created.length === 1 ? ` — ${created[0].jobTitle}` : ""}`,
      metadata: {
        created: created.length,
        skipped: skipped.length,
        failed: failed.length,
        clientsCreated: created.filter((r) => r.clientCreated).length,
        jobIds: created.map((r) => r.jobId),
      },
    });
  }

  return NextResponse.json(
    {
      imported: created.length,
      skipped: skipped.length,
      failed: failed.length,
      results,
    },
    // 207 is the honest code for a batch where some rows failed to write and
    // others landed; nothing here is an "all succeeded" if `failed` is not 0.
    { status: failed.length && !created.length ? 500 : failed.length ? 207 : 200 },
  );
}
