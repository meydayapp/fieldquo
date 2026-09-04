// lib/billing/loadDisputeEvidence.js
//
// The database half of lib/billing/disputeEvidence.js, kept in its own file so
// the assembler stays importable with no Prisma anywhere near it — which is
// what lets scripts/check-subscription-refunds.mjs execute it against hundreds
// of rows and none.
//
// Read-only, like everything else the platform console does to a tenant
// (non-negotiable #3).

import { db } from "@/lib/db";
import { networkOf } from "@/lib/security/deviceGuard";
import { assembleDisputeEvidence } from "@/lib/billing/disputeEvidence";

// Enough rows to make a case, few enough to stay inside Stripe's 20,000
// character field. The TOTALS are counted separately and in full, so a company
// with four hundred quotes says four hundred and lists the most recent hundred
// rather than claiming a hundred.
const SAMPLE = 100;

/**
 * @param companyId
 * @param servicePeriod  { start, end } for the disputed charge, when the caller
 *                       knows it. Omitted evidence beats a guessed date.
 * @returns the assembler's output, or null when the company does not exist.
 */
export async function loadDisputeEvidence(companyId, { servicePeriod = null } = {}) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      province: true,
      country: true,
      createdAt: true,
    },
  });
  if (!company) return null;

  const [
    subscription,
    ownerMember,
    quotesSent,
    invoicesSent,
    jobs,
    payments,
    devices,
    activity,
    quotesSentTotal,
    invoicesSentTotal,
    jobsTotal,
    paymentsTotal,
    devicesTotal,
    activityTotal,
  ] = await Promise.all([
    db.subscription.findUnique({
      where: { companyId },
      select: {
        status: true,
        billingInterval: true,
        createdAt: true,
        currentPeriodEnd: true,
        canceledAt: true,
        refundedAt: true,
        refundedAmountCents: true,
        disputeStatus: true,
        disputedAt: true,
        // currency as well as name: the refunded figure is cents in the
        // plan's own currency, and the console was printing it with a
        // hardcoded "$". A USD plan refunded US$129 read as CA$129.
        plan: { select: { name: true, currency: true } },
      },
    }),
    db.member.findFirst({
      where: { companyId, role: "owner" },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { name: true, email: true } } },
    }),
    db.quote.findMany({
      where: { companyId, sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      take: SAMPLE,
      select: { sentAt: true, quoteNumber: true, sentToEmail: true },
    }),
    db.invoice.findMany({
      where: { companyId, sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      take: SAMPLE,
      select: { sentAt: true, invoiceNumber: true, sentToEmail: true },
    }),
    db.job.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: SAMPLE,
      select: { createdAt: true, title: true, completedAt: true },
    }),
    db.payment.findMany({
      where: { invoice: { companyId } },
      orderBy: { date: "desc" },
      take: SAMPLE,
      select: { date: true, amount: true, method: true },
    }),
    db.accountDevice.findMany({
      where: { companyId },
      orderBy: { lastSeenAt: "desc" },
      take: SAMPLE,
      select: { userId: true, userAgent: true, lastIp: true, firstSeenAt: true, lastSeenAt: true },
    }),
    db.activityLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: SAMPLE,
      select: { createdAt: true, action: true, summary: true, actorName: true },
    }),
    db.quote.count({ where: { companyId, sentAt: { not: null } } }),
    db.invoice.count({ where: { companyId, sentAt: { not: null } } }),
    db.job.count({ where: { companyId } }),
    db.payment.count({ where: { invoice: { companyId } } }),
    db.accountDevice.count({ where: { companyId } }),
    db.activityLog.count({ where: { companyId } }),
  ]);

  // Who each device belongs to, resolved in one query rather than per row.
  const userIds = [...new Set(devices.map((d) => d.userId))];
  const names = new Map(
    (
      await db.member.findMany({
        where: { companyId, userId: { in: userIds } },
        select: { userId: true, user: { select: { name: true, email: true } } },
      })
    ).map((m) => [m.userId, m.user?.name || m.user?.email || null]),
  );

  const assembled = assembleDisputeEvidence({
    company,
    subscription: subscription
      ? { ...subscription, planName: subscription.plan?.name || null }
      : null,
    owner: ownerMember?.user || null,
    quotesSent,
    invoicesSent,
    jobs,
    payments,
    // The /16 ONLY. The full address never reaches this screen, the same rule
    // companyHealth.js applies to the device list beside it.
    devices: devices.map((d) => ({
      firstSeenAt: d.firstSeenAt,
      lastSeenAt: d.lastSeenAt,
      network: networkOf(d.lastIp),
      userAgent: d.userAgent,
      who: names.get(d.userId) || null,
    })),
    activity,
    totals: {
      quotesSent: quotesSentTotal,
      invoicesSent: invoicesSentTotal,
      jobsCreated: jobsTotal,
      paymentsCollected: paymentsTotal,
      devicesSeen: devicesTotal,
      activityEvents: activityTotal,
    },
    servicePeriod,
  });

  return {
    ...assembled,
    // What the webhook actually recorded, shown beside the evidence so staff
    // can see WHY they are looking at this page. Null on every healthy account.
    standing: subscription
      ? {
          refundedAt: subscription.refundedAt,
          refundedAmountCents: subscription.refundedAmountCents,
          // Null when the subscription carries no plan row. The console says
          // which currency it could not determine rather than assuming CAD.
          currency: subscription.plan?.currency || null,
          disputeStatus: subscription.disputeStatus,
          disputedAt: subscription.disputedAt,
        }
      : null,
  };
}
