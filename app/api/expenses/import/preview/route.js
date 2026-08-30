// app/api/expenses/import/preview/route.js
//
// Server-authoritative half of "map columns -> see what will be created".
// The browser parses the CSV into headers/rows (nothing to trust there — it
// hasn't written anything yet) and posts them here with a column mapping and
// a confirmed date format / sign convention. This route re-runs the same
// pure pipeline (lib/expenses/csvImport.js) the check script exercises
// directly, and is the one place that knows what this COMPANY already has on
// file, because duplicate detection has to be scoped to a tenant and a pure
// function can't reach the database itself.
//
// Nothing is written here. Review-then-commit is the point: AGENTS.md is
// explicit that N expense rows must never be written straight from a file.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import {
  buildImportPreview,
  parseDateWithFormat,
  MAX_ROWS,
} from "@/lib/expenses/csvImport";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same floor as recording a single expense (POST /api/expenses) — "record
  // their own" is the lowest rung on this ladder and everyone with a seat on
  // Expense Tracking already holds it. Bulk-imported rows are stamped with
  // this member's own createdById below, exactly like a hand-typed one, so
  // there is no bigger permission to ask for.
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

  const { headers, rows, mapping, dateFormat, signMode, defaultCategory } = body || {};

  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    return NextResponse.json(
      { error: "headers and rows are required." },
      { status: 400 },
    );
  }
  if (!mapping || typeof mapping !== "object") {
    return NextResponse.json({ error: "mapping is required." }, { status: 400 });
  }
  if (!dateFormat || typeof dateFormat !== "object" || dateFormat.status !== "detected") {
    // The client is expected to have already called detectDateFormat (or
    // resolved an "ambiguous" one by attaching dayFirst) before reaching this
    // step. A route that accepted "ambiguous" here would be the coin-flip
    // AGENTS.md says not to build.
    return NextResponse.json(
      { error: "A confirmed date format is required before previewing." },
      { status: 400 },
    );
  }
  if (signMode !== "negative_is_expense" && signMode !== "positive_is_expense") {
    return NextResponse.json(
      { error: "signMode must be confirmed (negative_is_expense or positive_is_expense)." },
      { status: 400 },
    );
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `This file has more than ${MAX_ROWS.toLocaleString()} rows. Split it and import in parts.` },
      { status: 400 },
    );
  }

  // Duplicate detection has to be source-blind AND scoped to this company —
  // every expense in the date range this file covers, regardless of
  // importSource, is fair game to match against. The date range is derived
  // from the file itself (with a week of slack on each side) rather than
  // loading the company's whole expense history, which would not scale.
  const parseableDates = rows
    .map((r) => (mapping.date !== null && mapping.date !== undefined ? r?.[mapping.date] : null))
    .filter(Boolean);
  const { rangeStart, rangeEnd } = dateRangeWithSlack(parseableDates, dateFormat);

  const existingExpenses = await db.expense.findMany({
    where: {
      companyId: member.companyId,
      ...(rangeStart && rangeEnd ? { date: { gte: rangeStart, lte: rangeEnd } } : {}),
    },
    select: { id: true, date: true, amount: true, notes: true, importSource: true },
  });

  const preview = buildImportPreview({
    headers,
    rows,
    mapping,
    dateFormat,
    signMode,
    defaultCategory: typeof defaultCategory === "string" && defaultCategory.trim() ? defaultCategory.trim().slice(0, 60) : "Bank Import",
    existingExpenses,
  });

  return NextResponse.json(preview);
}

// A quick, best-effort scan so the duplicate-detection query doesn't have to
// load a company's entire expense history. Uses the SAME date-format
// descriptor the caller confirmed — a row this can't parse just widens
// nothing, since detectDuplicates only ever compares rows that DID parse.
function dateRangeWithSlack(rawDateValues, dateFormat) {
  let min = null;
  let max = null;
  for (const raw of rawDateValues) {
    const d = parseDateWithFormat(raw, dateFormat);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  if (!min || !max) return { rangeStart: null, rangeEnd: null };
  const SLACK_DAYS = 7;
  const rangeStart = new Date(min.getTime() - SLACK_DAYS * 86400000);
  const rangeEnd = new Date(max.getTime() + SLACK_DAYS * 86400000);
  return { rangeStart, rangeEnd };
}
