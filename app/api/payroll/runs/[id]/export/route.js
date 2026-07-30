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
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  hasLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";

/**
 * RFC 4180 escaping.
 *
 * A leading =, +, - or @ is prefixed with a tab: Excel and Sheets treat those
 * as formulas, so a worker named "=cmd" becomes executable content in someone
 * else's spreadsheet. Payroll files get opened by bookkeepers on Windows.
 */
function cell(value) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `\t${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csv(rows) {
  // CRLF: what Excel expects, and harmless everywhere else.
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

function iso(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export async function GET(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      // Empty, not 0 — see the header note.
      if (!hits.length) return "";
      return hits.reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2);
    };

    rows.push([
      l.workerName,
      l.workerType,
      l.hourlyRate == null ? "" : Number(l.hourlyRate).toFixed(2),
      Number(l.regularHours).toFixed(2),
      Number(l.overtimeHours).toFixed(2),
      ...earningLabels.map((label) => byLabel(label, "earning")),
      Number(l.gross).toFixed(2),
      ...deductionLabels.map((label) => byLabel(label, "deduction")),
      Number(l.deductions).toFixed(2),
      Number(l.net).toFixed(2),
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
    Number(run.grossTotal).toFixed(2),
    ...deductionLabels.map(() => ""),
    Number(run.deductionTotal).toFixed(2),
    Number(run.netTotal).toFixed(2),
    iso(run.paidAt),
  ]);

  // Context a bookkeeper opening this file cold will need.
  rows.push([]);
  rows.push([`${company?.name || "Company"} — pay run ${iso(run.periodStart)} to ${iso(run.periodEnd)}`]);
  rows.push([`Currency: ${company?.currency || "CAD"}   Status: ${run.status}   Labels: ${run.region}`]);
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

  return new NextResponse(csv(rows), {
    headers: {
      // charset declared: Excel mangles non-ASCII names otherwise.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-${iso(run.periodStart)}-to-${iso(run.periodEnd)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
