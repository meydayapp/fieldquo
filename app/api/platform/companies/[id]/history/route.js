// app/api/platform/companies/[id]/history/route.js
//
// Financial history for one company, in two distinct senses that must not be
// conflated:
//
//   billing.*  — what this company pays FIELDQUO (their subscription)
//   activity.* — what this company's own clients pay THEM
//
// Support gets asked both — "why was I charged this?" and "my customer says
// they paid, where is it?" — and they're completely different money. The
// response keeps them in separate objects so a UI can't accidentally add them
// together.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function GET(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const company = await db.company.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [subscription, planChanges, invoices, payments, invoiceTotals] =
    await Promise.all([
      db.subscription.findUnique({
        where: { companyId: id },
        include: { plan: true },
      }),

      // Subscription history is reconstructed from the audit log rather than
      // stored separately — Subscription is a single mutable row, so the only
      // record of "they were on Starter until March" is what got logged at
      // the time. Imperfect, but honest about where the data comes from.
      db.platformAuditLog.findMany({
        where: {
          targetCompanyId: id,
          action: { in: ["plan_updated", "company_updated", "subscription_changed"] },
        },
        include: { platformAdmin: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // The company's own invoices to THEIR clients.
      db.invoice.findMany({
        where: { companyId: id },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          dueDate: true,
          createdAt: true,
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      db.payment.findMany({
        where: { invoice: { companyId: id } },
        select: {
          id: true,
          amount: true,
          method: true,
          date: true,
          invoice: {
            select: {
              invoiceNumber: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: { date: "desc" },
        take: 50,
      }),

      db.invoice.aggregate({
        where: { companyId: id },
        _sum: { total: true },
        _count: true,
      }),
    ]);

  const paidTotal = await db.payment.aggregate({
    where: { invoice: { companyId: id } },
    _sum: { amount: true },
  });

  return NextResponse.json({
    billing: {
      subscription: subscription
        ? {
            status: subscription.status,
            planName: subscription.plan?.name,
            priceMonthly: subscription.plan?.priceMonthly,
            currentPeriodEnd: subscription.currentPeriodEnd,
            trialEndsAt: subscription.trialEndsAt,
            stripeCustomerId: subscription.stripeCustomerId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            since: subscription.createdAt,
          }
        : null,
      // Reconstructed, not authoritative — see the note above.
      changes: planChanges.map((c) => ({
        id: c.id,
        action: c.action,
        at: c.createdAt,
        by: c.platformAdmin?.email || "system",
        details: c.details,
      })),
    },

    activity: {
      invoicedTotal: Number(invoiceTotals._sum.total || 0),
      invoiceCount: invoiceTotals._count,
      collectedTotal: Number(paidTotal._sum.amount || 0),
      invoices: invoices.map((i) => ({
        ...i,
        total: Number(i.total),
        clientName: i.client?.name || "—",
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        date: p.date,
        invoiceNumber: p.invoice?.invoiceNumber,
        clientName: p.invoice?.client?.name || "—",
      })),
    },
  });
}
