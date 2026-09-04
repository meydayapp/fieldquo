// app/api/analytics/finance-overview/route.js
//
// The owner's ask, verbatim: "we have all the information from expenses,
// payroll, jobs etc. to use most of it [before a bank statement is
// uploaded]." lib/analytics/moneyFlow.js already covers the Payment/Expense
// half (income, expenses, remaining). This route adds the three pieces that
// were sitting in the product with no money screen of their own: what the
// crew was paid, what the business costs to run regardless of this period,
// and what money is already spoken for.
//
// ══ Three figures, three different shapes of "true," never one fake total ═══
//
//   payroll      lib/analytics/payrollCost.js — approved TimeEntry hours ×
//                each worker's own rate, THIS PERIOD. A real cash-transaction
//                figure, same shape as moneyFlow's income/expenses.
//   fixedCosts   lib/analytics/burnRate.js's totalMonthlyCost, reused
//                UNCHANGED from Settings → Overhead — not recomputed, not
//                scaled to the selected period. It is a MONTHLY projection
//                (rent, overhead salaries, debt/depreciation), not a sum of
//                what happened between `from` and `to`; prorating it to an
//                arbitrary period would invent a proration rule nobody asked
//                for. Shown labelled "per month" for exactly that reason.
//   marketing    lib/analytics/marketingRollup.js's totals.spend for the
//                period, unchanged.
//   backlog      NOT fetched here. lib/analytics/kpis.js's buildBacklogWeeks
//                already computes it and the page already has the payload —
//                fetching it twice would be the exact duplication AGENTS.md
//                warns against (failure class 4).
//
// These are NEVER summed into one "total money out" figure. `payroll` and
// `marketing` are both real spending that MAY already be double-counted if a
// contractor also logs the same cost by hand as an Expense (a Facebook ad
// invoice entered in Settings → Expense Tracking AND on the marketing-spend
// screen; a payroll transfer entered as both a wage line here and a manual
// Expense). Nothing in this codebase links those two tables to detect that,
// so a combined total would look precise and sometimes be wrong — exactly
// the trap AGENTS.md's "never ship a control that appears to work and
// doesn't" exists to catch. Each figure is shown separately, honestly
// labelled with what it does and does not include; see
// docs/FINANCE-DASHBOARD.md for the full accounting of what this does and
// does not solve.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  hasToggle,
  hasLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { can } from "@/lib/permissions";
import { canReadCostBasis } from "@/lib/permissions/costBasis";
import { calculateBurnRate } from "@/lib/analytics/burnRate";
import { getMarketingRollup } from "@/lib/analytics/marketingRollup";
import { buildPayrollCost } from "@/lib/analytics/payrollCost";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const startOfDay = (key) => new Date(`${key}T00:00:00.000Z`);
const endOfDay = (key) => new Date(`${key}T23:59:59.999Z`);

// The union of every gate the three pieces below already carry on their own
// screens — same reasoning app/api/analytics/kpis/route.js and
// money-flow/route.js each give for their own unions. An owner/admin passes
// all three without a single toggle (costBasis.js's own note: "an owner or
// admin bypasses the grid entirely, as everywhere else").
function financeOverviewRefusal(full, role) {
  const missing = [];
  if (!canReadCostBasis(full, "burnRate")) missing.push("fixedCosts");
  if (!(hasToggle(full, "jobCosting") && hasLevel(full, "payroll", "view_all"))) missing.push("payroll");
  if (!can(role, "user:manage")) missing.push("marketing");
  if (missing.length === 0) return null;

  const err = new Error(
    "You don't have access to the business-costs dashboard — it combines payroll, fixed costs and marketing spend, and needs everything each of those needs on its own. Ask an owner or admin.",
  );
  err.status = 403;
  err.missing = missing;
  return err;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const denied = financeOverviewRefusal(full, member.role);
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
  // money-flow's route makes for the same reason.
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

  const gte = startOfDay(from);
  const lte = endOfDay(to);

  const [workers, members, approvedGrouped, pendingGrouped, everApproved, burnRate, marketingRollup, everMarketingSpend] =
    await Promise.all([
      db.worker.findMany({
        where: { companyId, active: true },
        select: { id: true, userId: true, hourlyRate: true },
      }),
      // Members' labour cost, as a FALLBACK pay rate — the identical query
      // buildPayRun.js runs, reused rather than re-derived.
      db.member.findMany({
        where: { companyId, laborCostPerHour: { not: null } },
        select: { userId: true, laborCostPerHour: true },
      }),
      // TimeEntry carries no companyId — scoped through the worker, the same
      // pattern app/api/analytics/kpis/route.js already uses. Unlike that
      // route's jobHoursGrouped, this is NOT filtered to jobId — payroll pays
      // for every approved hour a worker clocked, on a job or not.
      db.timeEntry.groupBy({
        by: ["workerId"],
        where: { worker: { companyId }, status: "approved", clockIn: { gte, lte } },
        _sum: { hours: true },
      }),
      db.timeEntry.groupBy({
        by: ["workerId"],
        where: { worker: { companyId }, status: "pending", clockIn: { gte, lte } },
        _sum: { hours: true },
      }),
      // Has this company EVER had an approved TimeEntry, at any date? One
      // cheap existence query, same shape as money-flow's everPayment/
      // everExpense checks.
      db.timeEntry.findFirst({
        where: { worker: { companyId }, status: "approved" },
        select: { id: true },
      }),
      // Reused unchanged from Settings → Overhead / /api/analytics/burn-rate
      // — see the file header on why this is a monthly figure, not a
      // period-scoped one.
      calculateBurnRate({ companyId, cashOnHand: null }),
      getMarketingRollup({ companyId, from: gte, to: lte }),
      db.marketingSpend.findFirst({ where: { companyId }, select: { id: true } }),
    ]);

  const laborCostByUser = new Map(
    members.filter((m) => m.userId).map((m) => [m.userId, Number(m.laborCostPerHour)]),
  );
  const approvedHoursByWorker = {};
  for (const g of approvedGrouped) approvedHoursByWorker[g.workerId] = Number(g._sum.hours || 0);
  const pendingHoursByWorker = {};
  for (const g of pendingGrouped) pendingHoursByWorker[g.workerId] = Number(g._sum.hours || 0);

  const payroll = buildPayrollCost({
    workers,
    laborCostByUser,
    approvedHoursByWorker,
    pendingHoursByWorker,
    everRecordedTime: Boolean(everApproved),
  });

  return NextResponse.json({
    currency: company.currency,
    range: { from, to },
    payroll,
    // Same figure() envelope as `marketing` below, and for the same reason.
    // Every one of rent, overhead salaries, loans and assets is empty for a
    // company that has never opened Settings → Overhead, and the four empty
    // sums make a confident $0.00 — a statement that this business has no
    // fixed costs, printed to a contractor who pays rent. `sourcesRecorded`
    // (lib/analytics/burnRate.js) counts the rows the total was built from,
    // so absence and a genuine zero stay two different screens.
    fixedCosts: {
      value: burnRate.sourcesRecorded > 0 ? burnRate.totalMonthlyCost : null,
      available: burnRate.sourcesRecorded > 0,
      reason: burnRate.sourcesRecorded > 0 ? null : "no_fixed_costs_recorded",
      reasonText:
        burnRate.sourcesRecorded > 0
          ? null
          : "No rent, overhead pay, loans or assets have been recorded yet, so there is no monthly figure to give.",
      incomplete: false,
      // `breakdown` used to ride along here and nothing ever read it — the
      // card's "See the breakdown →" link goes to Settings → Overhead, which
      // computes its own. A payload field with no consumer is the first
      // failure class in AGENTS.md; dropped rather than left to rot.
    },
    // Shaped like moneyFlow.js's figure() envelope on purpose, so the page's
    // MoneyTile can render it without a third shape to special-case: `value`
    // null and a `reasonText` when this company has never logged a dollar of
    // marketing spend (a real absence, not a $0 that would read as "your
    // marketing costs nothing"), a real figure — including a real $0 for a
    // quiet period — once it has.
    marketing: {
      value: everMarketingSpend ? marketingRollup.totals.spend : null,
      available: Boolean(everMarketingSpend),
      reason: everMarketingSpend ? null : "no_marketing_spend_recorded",
      reasonText: everMarketingSpend
        ? null
        : "No marketing spend has ever been logged for this company.",
      incomplete: false,
      channels: everMarketingSpend ? marketingRollup.channels : [],
    },
  });
}
