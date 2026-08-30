// app/api/expenses/import/commit/route.js
//
// Writes the rows the review screen showed. Everything that decided WHAT
// gets written already happened in the browser and in the preview route —
// this route's job is to be the one place nothing gets written twice and
// nothing gets written to the wrong company.
//
// ── Multi-tenant safety, the bug the reference implementation had ─────────
//
// The reference bulk-create endpoint never verified the destination belonged
// to the caller. Every write below is scoped to `member.companyId`, taken
// from the authenticated session — never from the request body — and a
// projectId that doesn't resolve to a Job in THIS company is dropped rather
// than trusted.
//
// ── Idempotency, the bug a double-submit would otherwise cause ────────────
//
// The browser sends one `idempotencyKey` per review session (generated once,
// resubmitted unchanged on retry). If a batch with that key already exists
// for this company, this route returns it as-is instead of writing again —
// a slow response and an impatient second click must not double a
// contractor's expenses.
//
// ── Why imported rows are never `recurring: true` ──────────────────────────
//
// `recurring` + `frequency` on Expense declare a STANDING monthly/weekly/
// yearly cost — lib/analytics/burnRate.js reads exactly one such row and
// projects it forward every month. A bank statement is the opposite: twelve
// separate historical charges for twelve separate months of rent. Importing
// each one as `recurring: true` would have burnRate multiply every one of
// them by its frequency factor and count a single rent payment twelve times
// over. Every imported row is a fact about one day, not a declaration about
// every future month — `recurring: false` is the only honest value here,
// and a contractor who wants rent to feed the burn-rate KPI still adds that
// one standing line under Settings -> Overhead, same as before this feature
// existed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { naturalKey, MAX_ROWS } from "@/lib/expenses/csvImport";

const MAX_CATEGORY_LEN = 120;
const MAX_NOTES_LEN = 500;
const MAX_FILENAME_LEN = 200;

function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    "expenses",
    "view_record_edit_own",
    "import expenses",
  );
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const { idempotencyKey, filename, rows } = body || {};

  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    return NextResponse.json(
      { error: "A valid idempotencyKey is required." },
      { status: 400 },
    );
  }
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "rows must be an array." }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `This batch has more than ${MAX_ROWS.toLocaleString()} rows.` },
      { status: 400 },
    );
  }

  // Idempotency check #1: the common case, a clean re-request.
  const existingBatch = await db.expenseImportBatch.findUnique({
    where: { companyId_idempotencyKey: { companyId: member.companyId, idempotencyKey } },
  });
  if (existingBatch) {
    return NextResponse.json({ batch: existingBatch, alreadyImported: true });
  }

  // Only rows the review screen still marks included. Excluding a row is a
  // decision the human made on the review screen; this route doesn't
  // second-guess it.
  const included = rows.filter((r) => r && r.include !== false);

  if (!included.length) {
    return NextResponse.json(
      { error: "No rows to import — every row was excluded or none were included." },
      { status: 400 },
    );
  }

  // Re-validate every field server-side. The review screen already showed
  // these values, but nothing here is trusted just because a browser sent
  // it back looking well-formed — the same discipline
  // lib/costing/actualJobCost.js applies at its own browser boundary.
  const validJobIds = new Set(
    (await db.job.findMany({ where: { companyId: member.companyId }, select: { id: true } })).map((j) => j.id),
  );

  const rejected = [];
  const candidates = [];
  let clearedProjectIds = 0;

  for (const r of included) {
    const date = r?.date ? new Date(r.date) : null;
    const amount = Number(r?.amount);
    const category = String(r?.category ?? "").trim().slice(0, MAX_CATEGORY_LEN) || "Bank Import";
    const notes = String(r?.description ?? r?.notes ?? "").trim().slice(0, MAX_NOTES_LEN) || null;

    if (!date || Number.isNaN(date.getTime())) {
      rejected.push({ row: r, reason: "Invalid date" });
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      rejected.push({ row: r, reason: "Invalid amount" });
      continue;
    }

    let projectId = typeof r?.projectId === "string" && r.projectId ? r.projectId : null;
    if (projectId && !validJobIds.has(projectId)) {
      projectId = null;
      clearedProjectIds++;
    }

    candidates.push({ date, amount: round2(amount), category, notes, projectId });
  }

  if (!candidates.length) {
    return NextResponse.json(
      { error: "None of the included rows were valid.", rejected },
      { status: 400 },
    );
  }

  // Idempotency check #2, the race a second tab or a second bank sync could
  // cause: re-check against the company's CURRENT rows (any source) right
  // before writing, not just what the review screen saw when it loaded. This
  // is the same source-blind naturalKey the preview route and
  // lib/expenses/csvImport.js's own duplicate detection use — nothing here
  // re-derives a different notion of "the same transaction".
  const dates = candidates.map((c) => c.date.getTime());
  const rangeStart = new Date(Math.min(...dates) - 7 * 86400000);
  const rangeEnd = new Date(Math.max(...dates) + 7 * 86400000);
  const recentExpenses = await db.expense.findMany({
    where: { companyId: member.companyId, date: { gte: rangeStart, lte: rangeEnd } },
    select: { date: true, amount: true, notes: true },
  });
  const recentKeys = new Set(
    recentExpenses.map((e) => naturalKey({ date: e.date, amount: Number(e.amount), description: e.notes || "" })),
  );

  const toCreate = [];
  const skippedAsRaceDuplicate = [];
  for (const c of candidates) {
    const key = naturalKey({ date: c.date, amount: c.amount, description: c.notes || "" });
    if (recentKeys.has(key)) {
      skippedAsRaceDuplicate.push(c);
      continue;
    }
    toCreate.push(c);
  }

  if (!toCreate.length) {
    return NextResponse.json(
      {
        error: "Every included row matched a transaction already recorded for this company since the review screen loaded.",
        skippedAsRaceDuplicate: skippedAsRaceDuplicate.length,
      },
      { status: 409 },
    );
  }

  const source = "csv_upload";
  const safeFilename = typeof filename === "string" ? filename.trim().slice(0, MAX_FILENAME_LEN) || null : null;

  let batch;
  try {
    batch = await db.$transaction(async (tx) => {
      const created = await tx.expenseImportBatch.create({
        data: {
          companyId: member.companyId,
          createdById: member.userId || null,
          source,
          filename: safeFilename,
          idempotencyKey,
          rowCount: toCreate.length,
          duplicateCount: skippedAsRaceDuplicate.length,
        },
      });

      await tx.expense.createMany({
        data: toCreate.map((c) => ({
          companyId: member.companyId,
          createdById: member.userId || null,
          category: c.category,
          amount: c.amount,
          date: c.date,
          notes: c.notes,
          projectId: c.projectId,
          isOverhead: false,
          recurring: false,
          frequency: "one_time",
          importSource: source,
          importBatchId: created.id,
        })),
      });

      return created;
    });
  } catch (err) {
    // Two requests racing past the findUnique check above with the SAME
    // idempotencyKey land here as a unique-constraint violation rather than
    // a double write — the second one to reach Postgres loses the race and
    // is told what actually happened instead of erroring.
    if (err?.code === "P2002") {
      const existing = await db.expenseImportBatch.findUnique({
        where: { companyId_idempotencyKey: { companyId: member.companyId, idempotencyKey } },
      });
      if (existing) {
        return NextResponse.json({ batch: existing, alreadyImported: true });
      }
    }
    throw err;
  }

  // One activity entry for the whole batch, not one per row — thousands of
  // "expense.created" rows from a single statement would drown the trail the
  // rest of the app relies on to say who did what.
  await recordActivity(member, {
    action: "expense.imported",
    entityType: "expense",
    entityId: batch.id,
    summary: `Imported ${toCreate.length} expense${toCreate.length === 1 ? "" : "s"} from a bank statement CSV${safeFilename ? ` (${safeFilename})` : ""}`,
    metadata: {
      batchId: batch.id,
      rowCount: toCreate.length,
      skippedAsDuplicate: skippedAsRaceDuplicate.length,
      clearedProjectIds,
    },
  });

  return NextResponse.json({
    batch,
    imported: toCreate.length,
    rejected: rejected.length,
    skippedAsRaceDuplicate: skippedAsRaceDuplicate.length,
    clearedProjectIds,
  });
}
