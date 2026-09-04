// app/api/analytics/money-flow/route.js
//
// Money in, money out, what's left — the plumbing for
// lib/analytics/moneyFlow.js. This file's only job is loading the rows the
// pure builder needs, in the shapes it expects, twice (this period and the
// preceding one), and refusing a caller who can't see all of what it draws
// from. See that file for what every figure means and why it can refuse to
// print one.
//
// ══ Who may read it ══════════════════════════════════════════════════════════
//
// The union of every gate the two halves of this report already carry on
// their own screens, same reasoning app/api/analytics/kpis/route.js gives for
// its own union:
//
//   invoices: view_only               Payment rows are read through their
//                                      invoice — the same gate
//                                      lib/analytics/receivables.js's route
//                                      uses for "what clients owe".
//   expenses: view_record_edit_all    company-WIDE expenses, not "my own" —
//                                      app/api/expenses/summary/route.js's
//                                      own gate, for the identical reason: an
//                                      aggregate total leaks every employee's
//                                      spending to someone confined to their
//                                      own.
//   showPricing                       every figure on this page is money.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  hasLevel,
  hasToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { detectMaterialsBuyListTrap } from "@/lib/analytics/kpis";
import { buildMoneyFlow, priorWindow, elapsedRange } from "@/lib/analytics/moneyFlow";
import { dayKey } from "@/lib/export/accountingExport";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const startOfDay = (key) => new Date(`${key}T00:00:00.000Z`);
const endOfDay = (key) => new Date(`${key}T23:59:59.999Z`);

function moneyFlowRefusal(full) {
  const missing = [];
  if (!hasLevel(full, "invoices", "view_only")) missing.push("invoices");
  if (!hasLevel(full, "expenses", "view_record_edit_all")) missing.push("expenses");
  if (!hasToggle(full, "showPricing")) missing.push("showPricing");
  if (missing.length === 0) return null;

  // One sentence whichever half failed — kpis.js route's own reasoning for
  // not naming which key in the response body, just in the log.
  const err = new Error(
    "You don't have access to the money flow dashboard — it combines company-wide invoices and expenses, and needs everything both of those reports need on their own. Ask an owner or admin.",
  );
  err.status = 403;
  err.missing = missing;
  return err;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const denied = moneyFlowRefusal(full);
  if (denied) {
    const { body, status } = permissionErrorResponse(denied);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    return NextResponse.json(
      { error: "Give a start and end date as from=YYYY-MM-DD&to=YYYY-MM-DD." },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: `The period runs backwards (${from} to ${to}).` },
      { status: 400 },
    );
  }

  const companyId = member.companyId;

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  });
  // Never defaulted — every figure on this page is money. Same refusal
  // kpis.js's and statements' routes make, for the same reason.
  if (!company?.currency) {
    return NextResponse.json(
      {
        error:
          "Your company has no billing currency set, and this report will not assume one. Set it in Settings → Company.",
        code: "no_currency",
      },
      { status: 409 },
    );
  }

  // The prior window is sized to what has ELAPSED, not to the whole selected
  // range — "This month" runs to the 30th, and on the 3rd a full 30-day prior
  // month is not something three days can be measured against. See
  // lib/analytics/moneyFlow.js's elapsedRange for the bug this closes; the
  // headline totals still cover the whole range, only the comparison is
  // clamped. A range entirely in the future has no prior window at all.
  const today = dayKey(new Date());
  let prior;
  let elapsed;
  try {
    elapsed = elapsedRange(from, to, today);
    prior = elapsed ? priorWindow(elapsed.from, elapsed.to) : null;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 400 });
  }

  const gte = startOfDay(from);
  const lte = endOfDay(to);
  const priorGte = prior ? startOfDay(prior.from) : null;
  const priorLte = prior ? endOfDay(prior.to) : null;

  const PAYMENT_SELECT = { amount: true, date: true };
  const EXPENSE_SELECT = { amount: true, date: true, category: true, projectId: true };

  const [
    payments,
    expenses,
    priorPayments,
    priorExpenses,
    everPayment,
    everExpense,
    buyListAgg,
  ] = await Promise.all([
    db.payment.findMany({
      where: { invoice: { companyId }, date: { gte, lte } },
      select: PAYMENT_SELECT,
    }),
    db.expense.findMany({
      where: { companyId, date: { gte, lte } },
      select: EXPENSE_SELECT,
    }),
    prior
      ? db.payment.findMany({
          where: { invoice: { companyId }, date: { gte: priorGte, lte: priorLte } },
          select: PAYMENT_SELECT,
        })
      : [],
    prior
      ? db.expense.findMany({
          where: { companyId, date: { gte: priorGte, lte: priorLte } },
          select: EXPENSE_SELECT,
        })
      : [],
    // Has this company EVER received a payment, at any date? Answered
    // unbounded, once, cheaply (findFirst can stop at the first row an index
    // gives it) — see lib/analytics/moneyFlow.js's header for why this can't
    // be inferred from the period alone.
    db.payment.findFirst({ where: { invoice: { companyId } }, select: { id: true } }),
    db.expense.findFirst({ where: { companyId }, select: { id: true } }),
    // The materials buy-list trap, scoped to THIS period rather than to
    // completed jobs the way app/api/analytics/kpis/route.js scopes it — this
    // dashboard is about the period's cash movement, not job costing, so the
    // relevant comparison is "materials ticked off the buy-list this period"
    // against "job-linked expenses logged this period", both drawn from the
    // same window the rest of the page uses. The detector itself is reused
    // unchanged from lib/analytics/kpis.js — not rebuilt, see its header.
    db.jobMaterial.aggregate({
      where: { purchasedAt: { gte, lte }, job: { companyId } },
      _sum: { actualCost: true },
    }),
  ]);

  const expenseTotalOnJobs = expenses
    .filter((e) => e.projectId)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const materialsTrap = detectMaterialsBuyListTrap({
    buyListTotal: Number(buyListAgg._sum.actualCost || 0),
    expenseTotal: expenseTotalOnJobs,
  });

  let payload;
  try {
    payload = buildMoneyFlow({
      from,
      to,
      payments,
      expenses,
      priorPayments,
      priorExpenses,
      everRecordedIncome: Boolean(everPayment),
      everRecordedExpense: Boolean(everExpense),
      materialsTrap,
      today,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }

  return NextResponse.json({ currency: company.currency, ...payload });
}
