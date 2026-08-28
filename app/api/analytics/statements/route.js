// app/api/analytics/statements/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  hasLevel,
  hasToggle,
  canSeeAllPay,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { buildFinancialStatements, ACCOUNTING_BASES } from "@/lib/accounting/statements";

// ══ Who may read the company's financial statements ═══════════════════════
//
// A P&L is the whole cost basis with the revenue printed next to it, so the
// gate is deliberately the SAME predicate lib/permissions/costBasis.js applies
// to `fixedCosts` — `jobCosting` AND `user:manage` — with `showPricing` and the
// company-wide expense level added on top, because this page also shows what
// clients were charged and every expense row in the business.
//
// It is composed here from the same primitives rather than added to
// COST_BASIS_RESOURCES, for one reason: that map is five hand-written entries
// whose read/write invariant scripts/check-cost-basis.mjs asserts route by
// route, and a sixth entry with `write: null` and no write handler would be a
// change to a shared, asserted contract for a report that writes nothing.
// scripts/check-statements.mjs closes the gap the other way — it EXECUTES this
// handler against every shipped preset and asserts it is never weaker than
// canReadCostBasis(member, "fixedCosts"). If somebody relaxes one of the four
// lines below, that check fails.
//
// Where that lands, against the presets as shipped:
//
//   Crew        jobCosting:false             → refused
//   Estimator   jobCosting:false             → refused
//   Dispatcher  jobCosting:false             → refused
//   Manager     holds all four               → allowed, WITHOUT payroll
//   owner/admin unrestricted                 → allowed, with payroll
//
// Payroll is a separate dial and stays separate. `payroll: view_all` is what
// governs everyone's pay (canSeeAllPay), and a Manager does not hold it — so
// the wage lines come back as a stated ABSENCE and every total containing them
// reports itself incomplete. Returning them as zero would hand a Manager an
// overhead figure quietly missing the payroll, which reads as a profitable
// month; refusing the whole page would take the P&L away from the person whose
// job it is to read it.
function statementsRefusal(full) {
  const missing = [];
  if (!hasToggle(full, "jobCosting")) missing.push("jobCosting");
  if (!hasToggle(full, "showPricing")) missing.push("showPricing");
  if (!hasLevel(full, "expenses", "view_record_edit_all")) missing.push("expenses");
  if (!full || !can(full.role, "user:manage")) missing.push("user:manage");
  if (missing.length === 0) return null;

  // The same sentence whichever half failed, for the reason costBasis.js gives:
  // "you hold user:manage but not jobCosting" is a map of the permission model
  // handed to the person probing it. The missing keys stay on the server log.
  const err = new Error(
    "You don't have access to the company's financial statements — revenue, costs, margin and what the business owes. Ask an owner or admin.",
  );
  err.status = 403;
  err.missing = missing;
  return err;
}

/** YYYY-MM-DD → the instant that day ends, so a range is inclusive of its last day. */
function endOfDay(key) {
  return new Date(`${key}T23:59:59.999Z`);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const denied = statementsRefusal(full);
  if (denied) {
    const { body, status } = permissionErrorResponse(denied);
    return NextResponse.json(body, { status });
  }

  // Route handlers get a real URL; `searchParams` is a Promise only on a PAGE's
  // props in Next 16, which is a distinction worth stating because getting it
  // backwards here silently yields `[object Promise]` as a date.
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const basis = searchParams.get("basis") || "cash";

  // Shape-checked before they reach a Date constructor. `new Date("banana")` is
  // an Invalid Date, and an Invalid Date in a Prisma `gte` is a query error with
  // a stack trace in it rather than a sentence the caller can act on.
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    return NextResponse.json(
      { error: "Give a start and end date as from=YYYY-MM-DD&to=YYYY-MM-DD." },
      { status: 400 },
    );
  }
  if (!ACCOUNTING_BASES.includes(basis)) {
    return NextResponse.json(
      { error: `Unknown accounting basis "${basis}". Use "cash" or "accrual".` },
      { status: 400 },
    );
  }
  // Refused here as well as inside the builder. The builder throws because it is
  // pure and cannot answer, and this returns a 400 because a backwards range is
  // a caller mistake and not a server fault — three empty statements would look
  // exactly like a quiet quarter, and somebody would file them.
  if (from > to) {
    return NextResponse.json(
      { error: `The period runs backwards (${from} to ${to}).` },
      { status: 400 },
    );
  }

  const companyId = member.companyId;
  const until = endOfDay(to);
  const payrollVisible = canSeeAllPay(full);

  const [company, taxRates, invoices, payments, expenses, timeEntries, payRuns, debts] =
    await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          currency: true,
          country: true,
          province: true,
          vatRegistered: true,
          taxRate: true,
        },
      }),
      db.taxRate.findMany({ where: { companyId } }),
      // Every version of every invoice raised on or before the end of the
      // period, NOT just those inside it. Two reasons, both load-bearing:
      // receivables are a running balance as at the statement date, and an
      // amendment cannot be reduced to one document without its siblings —
      // invoiceFamilies needs the family, not the slice.
      db.invoice.findMany({
        where: { companyId, createdAt: { lte: until } },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          parentInvoiceId: true,
          version: true,
          subtotal: true,
          discount: true,
          tax: true,
          taxEnabled: true,
          total: true,
          sentAt: true,
          createdAt: true,
          client: { select: { id: true, name: true, province: true, country: true } },
        },
      }),
      // Likewise every payment up to the statement date: the ones inside the
      // period are revenue and cash, the earlier ones are what has already been
      // knocked off the receivable.
      db.payment.findMany({
        where: { invoice: { companyId }, date: { lte: until } },
        select: { id: true, invoiceId: true, amount: true, date: true, method: true },
      }),
      db.expense.findMany({
        where: { companyId, date: { lte: until } },
        select: {
          id: true,
          category: true,
          amount: true,
          date: true,
          isOverhead: true,
          recurring: true,
          frequency: true,
          projectId: true,
        },
      }),
      // TimeEntry carries no companyId — it is scoped through the worker, which
      // is where the rate lives too. Filtered to the period here rather than in
      // the builder because, unlike invoices, nothing outside the period is
      // needed: an hour worked last year is not part of this year's balance.
      db.timeEntry.findMany({
        where: {
          worker: { companyId },
          clockIn: { gte: new Date(`${from}T00:00:00.000Z`), lte: until },
        },
        select: {
          id: true,
          jobId: true,
          hours: true,
          status: true,
          clockIn: true,
          worker: { select: { id: true, hourlyRate: true } },
        },
      }),
      db.payRun.findMany({
        where: { companyId, periodEnd: { lte: until } },
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          grossTotal: true,
          deductionTotal: true,
          netTotal: true,
          paidAt: true,
        },
      }),
      db.debt.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, principal: true, interestRate: true, monthlyPayment: true, startDate: true },
      }),
    ]);

  // Never defaulted to CAD. Company.currency is nullable, and printing the
  // wrong currency symbol on a document a lender reads is worse than refusing
  // to draw it — the builder throws on this too, and this is the friendlier
  // half of the same rule.
  if (!company?.currency) {
    return NextResponse.json(
      {
        error:
          "Your company has no billing currency set, and a financial statement will not assume one. Set it in Settings → Company.",
        code: "no_currency",
      },
      { status: 409 },
    );
  }

  // Payroll rows are dropped BEFORE the builder rather than redacted after it.
  // A figure that was computed and then blanked has still been computed, and
  // the totals derived from it would carry the number the caller may not see.
  const visiblePayRuns = payrollVisible ? payRuns : [];

  let statements;
  try {
    statements = buildFinancialStatements({
      from,
      to,
      basis,
      currency: company.currency,
      invoices,
      payments,
      expenses,
      timeEntries,
      payRuns: visiblePayRuns,
      debts,
      payrollVisible,
      company,
      taxRates,
    });
  } catch (err) {
    if (err?.status === 400) {
      return NextResponse.json({ error: err.message, code: err.code || "bad_request" }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json({
    ...statements,
    companyName: company.name || null,
    payrollVisible,
  });
}
