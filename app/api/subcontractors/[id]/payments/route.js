// app/api/subcontractors/[id]/payments/route.js
//
// Money paid TO a sub — recorded, not sent. Cash, e-transfer or cheque that
// already left the company's account, written down so the job's cost, the
// P&L and the year-end contractor form all know about it.
//
// ══ What this route is not ═════════════════════════════════════════════════
//
// Not a Stripe Connect transfer. `stripeTransferId` on SubcontractorPayment
// is written by nothing here and stays null on every row this route creates;
// paying a linked FieldQuo company through Connect is a separate piece of
// work that belongs to lib/stripe.js and the payout route, not to this file.
//
// ══ One transaction, three rows ════════════════════════════════════════════
//
// A payment writes the SubcontractorPayment, an Expense against the job (so
// the P&L and the expense ledger see the money leave), and — when the
// payments now cover the agreed amount — advances the JobSubcontractor to
// `paid`. All three or none: a payment with no expense is money that left
// and never reached the books; an expense with no payment is a cost the
// T5018 export cannot see. `expenseId` on the payment is the link that keeps
// the two from drifting.
//
// ══ The expense is NOT a second copy of the cost ═══════════════════════════
//
// Job costing does not read these expense rows — it reads the agreed amount
// and drops rows in this category, so a sub is costed once. See
// lib/subcontractors/money.js for the whole argument, and one refinement
// handled here: a JobSubcontractor adopted from an imported quote already
// has an Expense in the ledger (lib/quotes/importQuote.js materialised it
// when the job was created). For that row the payment LINKS to the existing
// expense instead of writing another, because two expense rows for one
// $5,000 sub is a P&L that reports $10,000 — the exact drift `expenseId`
// exists to stop.
//
// ══ Inbound methods are refused ════════════════════════════════════════════
//
// The PaymentMethod enum is shared with client payments, and `stripe`,
// `visit_credit`, `card_elsewhere` and `shop` all mean money coming IN.
// parsePaymentBody refuses them with a sentence that says so; the T5018
// total must never include a client's card payment that landed in the wrong
// column.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, permissionErrorResponse } from "@/lib/permissions/enforce";
import { requireSubcontractorMoney } from "@/lib/subcontractors/access";
import { parsePaymentBody, PAYMENT_SELECT, JOB_SUBCONTRACTOR_SELECT } from "@/lib/subcontractors/payload";
import { paymentsCover, SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY } from "@/lib/subcontractors/money";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { recordActivity } from "@/lib/activity/log";

async function ownSub(id, companyId) {
  return db.subcontractor.findFirst({ where: { id, companyId }, select: { id: true, name: true } });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorMoney(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const sub = await ownSub(id, member.companyId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payments = await db.subcontractorPayment.findMany({
    where: { subcontractorId: sub.id, companyId: member.companyId },
    select: PAYMENT_SELECT,
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ payments });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Money out is the money gate, not the roster gate: a supervisor without
  // jobCosting can see the sub but not what they are owed, and must not be
  // the one writing what they were paid.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorMoney(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const sub = await ownSub(id, member.companyId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parsePaymentBody(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { amount, method, date, notes, jobSubcontractorId } = parsed.data;

  // The assignment has to be ours AND this sub's. ownedIds proves the tenant;
  // the findFirst below proves it belongs to the sub in the URL, so a payment
  // cannot be booked to the roofer's job row under the electrician's name.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { jobSubcontractorId });
  if (notOurs) return notOurs;

  let assignment = null;
  if (jobSubcontractorId) {
    assignment = await db.jobSubcontractor.findFirst({
      where: { id: jobSubcontractorId, companyId: member.companyId, subcontractorId: sub.id },
      select: {
        id: true,
        jobId: true,
        agreedAmount: true,
        status: true,
        quoteImportId: true,
        payments: { select: { amount: true } },
        job: { select: { title: true } },
      },
    });
    if (!assignment)
      return NextResponse.json({ error: "That job assignment isn't this subcontractor's." }, { status: 404 });
  }

  // An adopted import's accrual expense, if it exists — see the header.
  let accrualExpenseId = null;
  if (assignment?.quoteImportId) {
    const imp = await db.quoteImport.findFirst({
      where: { id: assignment.quoteImportId, targetCompanyId: member.companyId },
      select: { expenseId: true },
    });
    if (imp?.expenseId) {
      const accrual = await db.expense.findFirst({
        where: { id: imp.expenseId, companyId: member.companyId },
        select: { id: true },
      });
      if (accrual) accrualExpenseId = accrual.id;
    }
  }

  const cover = assignment
    ? paymentsCover(assignment.agreedAmount, [...assignment.payments, { amount }])
    : null;
  const nextStatus = !assignment
    ? null
    : cover.covered && assignment.status !== "paid"
      ? "paid"
      : assignment.status === "quoted"
        ? "agreed"
        : null;

  const result = await db.$transaction(async (tx) => {
    const payment = await tx.subcontractorPayment.create({
      data: {
        companyId: member.companyId,
        subcontractorId: sub.id,
        jobSubcontractorId: assignment?.id ?? null,
        amount,
        method,
        date,
        notes,
        createdById: member.userId ?? null,
      },
      select: PAYMENT_SELECT,
    });

    let expenseId = accrualExpenseId;
    if (!expenseId) {
      const expense = await tx.expense.create({
        data: {
          companyId: member.companyId,
          createdById: member.userId ?? null,
          category: SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY,
          amount,
          date,
          notes: `Paid ${sub.name}${assignment?.job?.title ? ` — ${assignment.job.title}` : ""}${notes ? `: ${notes}` : ""}`,
          // Expense.projectId IS the job id — see app/api/expenses/route.js.
          projectId: assignment?.jobId ?? null,
          isOverhead: false,
        },
        select: { id: true },
      });
      expenseId = expense.id;
    }

    const linked = await tx.subcontractorPayment.update({
      where: { id: payment.id },
      data: { expenseId },
      select: PAYMENT_SELECT,
    });

    let jobSubcontractor = null;
    if (assignment) {
      jobSubcontractor = await tx.jobSubcontractor.update({
        where: { id: assignment.id, companyId: member.companyId },
        data: nextStatus ? { status: nextStatus } : {},
        select: JOB_SUBCONTRACTOR_SELECT,
      });
    }

    return { payment: linked, jobSubcontractor, expenseId, reusedAccrual: !!accrualExpenseId };
  });

  await recordActivity(member, {
    action: "subcontractor.payment_recorded",
    entityType: "subcontractor",
    entityId: sub.id,
    summary: `Recorded ${method} payment of ${amount} to ${sub.name}${assignment?.job?.title ? ` for ${assignment.job.title}` : ""}${nextStatus === "paid" ? " — paid in full" : ""}`,
    metadata: {
      subcontractorId: sub.id,
      paymentId: result.payment.id,
      jobSubcontractorId: assignment?.id ?? null,
      jobId: assignment?.jobId ?? null,
      expenseId: result.expenseId,
      amount,
      method,
      status: nextStatus,
    },
  });

  return NextResponse.json(
    {
      payment: result.payment,
      jobSubcontractor: result.jobSubcontractor,
      cover,
      // True when the expense was the imported quote's own row rather than a
      // new one — the panel can then say the ledger was not written twice.
      reusedAccrual: result.reusedAccrual,
    },
    { status: 201 },
  );
}
