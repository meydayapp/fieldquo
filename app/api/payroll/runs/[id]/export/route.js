// app/api/payroll/runs/[id]/export/route.js
//
// The pay run as CSV, for the bookkeeper or the payroll provider who actually
// pays it. This is the handoff: FieldQuo works out what's owed, someone else
// moves the money.
//
// ── One row per person, one column per deduction ─────────────────────────────
//
// Deduction names vary by company, so the columns are built from the union of
// every label in the run rather than hardcoded. A fixed CA/US/UK column set
// would silently drop a company's own union dues or benefit line — and a
// missing column in a payroll file is money someone doesn't get deducted.
//
// A worker with no value for a column gets an empty cell, not a zero. "We
// didn't deduct this" and "we deducted zero" look identical in a spreadsheet
// and only one of them is what happened.
//
// ── Why the CSV helpers are imported and not written here ────────────────────
//
// This file used to carry its own `cell()` and `csv()`, a copy of the pair in
// lib/export/accountingExport.js. The copy is the one that rotted, exactly as
// AGENTS.md failure class 4 predicts, and it rotted in two ways:
//
//   • Money reached the formula guard as a STRING (`Number(x).toFixed(2)`), so
//     a leading minus matched `/^[=+\-@\t\r]/` and any negative figure was
//     emitted as "\t-5.00" — text, not a number, in Excel and Sheets. The
//     column looks right and does not add up, which is worse than a wrong
//     number because nobody sees it. Nothing has been negative yet; a
//     clawback, a correction line or a negative earning is the first time it
//     bites, and payday is a bad moment to discover it.
//
//   • A guarded cell was not forced into quotes. A bare leading tab is legal
//     CSV, but Excel's import sniffs delimiters in some locales and a tab is
//     the other one it looks for, so an unquoted `\t=cmd` can split into two
//     fields and hand back the formula the tab was neutralising.
//
// `money()` marks a figure we generated as trusted (a number cannot be a
// formula) and `csvCell()` applies the guard only to strings, which are the
// only untrusted values, and always quotes what it guards. Both are already
// mutation-tested by scripts/check-accounting-export.mjs, which asserts them
// BY THE TEXT OF THAT FILE — which is why the shared implementation stays
// there rather than moving to a neutrally-named lib/export/csv.js. Two
// consumers, one implementation, one place to fix it: that is the point, and
// the file it lives in is a detail the pinned check owns.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  hasLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
// `csvCell` is not imported: `toCsv` is the only entry point this file needs,
// and importing the cell escaper beside it would invite a future edit to
// hand-roll a row again.
import { money, toCsv, dayKey } from "@/lib/export/accountingExport";

/** YYYY-MM-DD, UTC, or "" — dayKey's rule, not a fourth copy of it. */
function iso(d) {
  return dayKey(d) ?? "";
}

export async function GET(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // A whole-run export is everyone's pay. That's view_all, never "it's mine".
  let canViewAll = member.role === "owner" || member.role === "admin";
  if (!canViewAll) {
    try {
      const full = await loadEnforceableMember(db, member.id);
      canViewAll =
        hasLevel(full, "payroll", "view_all") ||
        hasLevel(full, "payroll", "run_payroll");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }
  if (!canViewAll) {
    return NextResponse.json(
      { error: "You don't have permission to export payroll." },
      { status: 403 },
    );
  }

  const run = await db.payRun.findFirst({
    where: { id, companyId: member.companyId },
    include: { lines: { orderBy: { workerName: "asc" } } },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { name: true, currency: true },
  });

  // Union of labels, in first-seen order, so the columns follow the order the
  // engine computed them rather than an alphabetical order nobody chose.
  const earningLabels = [];
  const deductionLabels = [];
  for (const l of run.lines) {
    for (const item of Array.isArray(l.items) ? l.items : []) {
      const bucket = item.kind === "deduction" ? deductionLabels : earningLabels;
      if (!bucket.includes(item.label)) bucket.push(item.label);
    }
  }

  const header = [
    "Worker",
    "Type",
    "Hourly rate",
    "Regular hours",
    "Overtime hours",
    ...earningLabels.map((l) => `Earning: ${l}`),
    "Gross",
    ...deductionLabels.map((l) => `Deduction: ${l}`),
    "Total deductions",
    "Net",
    "Paid on",
  ];

  const rows = [header];
  for (const l of run.lines) {
    const items = Array.isArray(l.items) ? l.items : [];
    const byLabel = (label, kind) => {
      const hits = items.filter(
        (i) => i.label === label && (kind === "deduction") === (i.kind === "deduction"),
      );
      // Empty, not 0 — see the header note. money(0) would print "0.00" and
      // say something this run never said, so the emptiness is returned before
      // any figure is formatted.
      if (!hits.length) return "";
      return money(hits.reduce((s, i) => s + Number(i.amount || 0), 0));
    };

    rows.push([
      l.workerName,
      l.workerType,
      // Hours are not money, but they want the same treatment: two decimals,
      // no grouping, and trusted rather than guarded — a negative correction
      // to somebody's hours must import as a number too.
      l.hourlyRate == null ? "" : money(l.hourlyRate),
      money(l.regularHours),
      money(l.overtimeHours),
      ...earningLabels.map((label) => byLabel(label, "earning")),
      money(l.gross),
      ...deductionLabels.map((label) => byLabel(label, "deduction")),
      money(l.deductions),
      money(l.net),
      iso(l.paidAt),
    ]);
  }

  // Totals row, from the RUN's stored totals rather than re-summing the lines.
  // If those two ever disagree the export must show what was approved, and the
  // disagreement is then visible instead of papered over.
  rows.push([]);
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    ...earningLabels.map(() => ""),
    money(run.grossTotal),
    ...deductionLabels.map(() => ""),
    money(run.deductionTotal),
    money(run.netTotal),
    iso(run.paidAt),
  ]);

  // Context a bookkeeper opening this file cold will need.
  //
  // The currency is stated, never guessed. Company.currency is nullable and
  // this line used to read `company?.currency || "CAD"`, which prints CAD on
  // an American contractor's payroll file — a wrong number in somebody's
  // books, on the document that says what people got paid. Same stance as
  // buildAccountingExport, which refuses to run without a currency.
  //
  // It states the absence rather than refusing the whole export, and that
  // divergence is deliberate: the accounting export is a builder whose caller
  // can turn a throw into a tidy refusal, whereas this endpoint IS the payday
  // handoff. Withholding an approved run over an unset settings field stops
  // somebody getting paid; withholding the guess costs a question the reader
  // can already answer about their own company.
  const currency =
    typeof company?.currency === "string" && company.currency.trim()
      ? company.currency.trim()
      : null;
  rows.push([]);
  rows.push([`${company?.name || "Company"} — pay run ${iso(run.periodStart)} to ${iso(run.periodEnd)}`]);
  rows.push([
    `Currency: ${currency ?? "not recorded — set it in Settings → Company"}   Status: ${run.status}   Labels: ${run.region}`,
  ]);
  rows.push([
    "Calculated by FieldQuo. No tax has been remitted or filed through this system.",
  ]);

  await recordActivity(member, {
    action: "payroll.exported",
    entityType: "payroll",
    entityId: run.id,
    summary: `Exported pay run ${iso(run.periodStart)}–${iso(run.periodEnd)} as CSV (${run.lines.length} people)`,
    metadata: { lines: run.lines.length, status: run.status },
  });

  return new NextResponse(toCsv(rows), {
    headers: {
      // charset declared: Excel mangles non-ASCII names otherwise.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-${iso(run.periodStart)}-to-${iso(run.periodEnd)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
