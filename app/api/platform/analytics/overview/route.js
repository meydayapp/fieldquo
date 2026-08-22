// app/api/platform/analytics/overview/route.js
//
// Everything the platform dashboard needs, in one round trip: point-in-time
// counts, money, and daily/monthly time series for growth.
//
// A note on what the money numbers mean, because they're easy to misread:
//
//   mrr           — sum of priceMonthly across ACTIVE subscriptions. Forward
//                   looking; what you'd bill next month if nothing changed.
//   totalBilled   — sum of Payment.amount actually recorded. This is money
//                   your CUSTOMERS' clients paid THEM, not revenue you earned.
//                   It measures volume flowing through FieldQuo, which is a
//                   product-health signal, not your income.
//   quotedValue   — total face value of quotes created. Aspirational, not
//                   earned: most quotes never convert.
//
// Conflating the second with your own revenue would badly overstate the
// business, so they're named and labelled separately in the UI.
//
// ── That warning was not enough ────────────────────────────────────────────
//
// It was accurate and it was invisible. The dashboard printed "$473,558
// invoiced" next to FieldQuo's MRR, and both the owner and an external QA pass
// read it as FieldQuo's revenue — the QA report opened with it as evidence of
// a billing failure. A caveat only the author reads is not a caveat.
//
// So `outlook` is now returned alongside, and it is deliberately narrow: it
// contains ONLY money FieldQuo can charge for its own subscriptions, and it
// separates what can actually be collected from what is merely claimed.
//
// The gap is the point. Nominal MRR is $1,335 across five active
// subscriptions. Collectable MRR is $0, because every plan is missing its
// Stripe price. That difference is the most useful number on the page: it is
// precisely the revenue that is one configuration fix away.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { buildRevenueOutlook } from "@/lib/platform/revenueOutlook";

/** Sales demo companies are not customers. See lib/demo/seedDemo.js. */
const NOT_DEMO = { isDemo: false };

// Groups rows into buckets by date key without pulling the whole table into
// memory twice. Raw SQL would be faster, but keeping it in Prisma means this
// works identically on any provider and stays readable.
function bucketByDay(rows, dateField = "createdAt", valueField) {
  const out = new Map();
  for (const row of rows) {
    const key = new Date(row[dateField]).toISOString().slice(0, 10);
    const prev = out.get(key) || { count: 0, value: 0 };
    out.set(key, {
      count: prev.count + 1,
      value: prev.value + (valueField ? Number(row[valueField] || 0) : 0),
    });
  }
  return out;
}

function seriesFrom(map, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key) || { count: 0, value: 0 };
    out.push({ date: key, count: entry.count, value: entry.value });
  }
  return out;
}

function monthlySeriesFrom(rows, months, dateField = "createdAt", valueField) {
  const buckets = new Map();
  for (const row of rows) {
    const key = new Date(row[dateField]).toISOString().slice(0, 7);
    const prev = buckets.get(key) || { count: 0, value: 0 };
    buckets.set(key, {
      count: prev.count + 1,
      value: prev.value + (valueField ? Number(row[valueField] || 0) : 0),
    });
  }

  const out = [];
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const entry = buckets.get(key) || { count: 0, value: 0 };
    out.push({ month: key, count: entry.count, value: entry.value });
  }
  return out;
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "analytics:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11);
  twelveMonthsAgo.setUTCDate(1);

  const [
    totalCompanies,
    activeCompanies,
    trialCompanies,
    churnedThisMonth,
    activeSubscriptions,
    quotesThisMonth,
    jobsThisMonth,
    recentCompanies,
    recentQuotes,
    recentPayments,
    yearCompanies,
    yearQuotes,
    yearPayments,
    paymentTotal,
    quoteTotal,
    invoiceTotal,
  ] = await Promise.all([
    // ── Demo accounts are excluded from every company count ────────────────
    //
    // Ten seeded sales demos would otherwise read as ten signups, and the one
    // number this page exists to report — how many real businesses are on
    // FieldQuo — would be wrong by ten from the day they were created. Applied
    // at every count rather than subtracted at the end, because a percentage
    // computed from a padded denominator is wrong in a way nobody spots.
    db.company.count({ where: NOT_DEMO }),
    db.company.count({ where: { ...NOT_DEMO, onboardingStatus: "active" } }),
    db.company.count({
      where: { ...NOT_DEMO, onboardingStatus: "pending", trialEndsAt: { gte: now } },
    }),
    // Approximate — see the note on Company.updatedAt. Any edit to a churned
    // company pulls it back into this window.
    db.company.count({
      where: { ...NOT_DEMO, onboardingStatus: "churned", updatedAt: { gte: startOfMonth } },
    }),
    // Widened from active-only to every live subscription, and from the plan's
    // name+price to the fields that decide whether it can actually be
    // CHARGED. The old shape could only produce a nominal MRR — it had no way
    // to know that none of these can raise a payment.
    db.subscription.findMany({
      where: { status: { in: ["active", "trialing"] }, company: NOT_DEMO },
      select: {
        status: true,
        trialEndsAt: true,
        stripeSubscriptionId: true,
        company: { select: { name: true } },
        plan: {
          select: { name: true, priceMonthly: true, stripePriceId: true },
        },
      },
    }),
    db.quote.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.job.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Daily series inputs — 30 days.
    db.company.findMany({
      where: { ...NOT_DEMO, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    db.quote.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, total: true },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, amount: true },
    }),

    // Monthly series inputs — 12 months.
    db.company.findMany({
      where: { ...NOT_DEMO, createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    }),
    db.quote.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true, total: true },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true, amount: true },
    }),

    db.payment.aggregate({ _sum: { amount: true } }),
    db.quote.aggregate({ _sum: { total: true }, _count: true }),
    db.invoice.aggregate({ _sum: { total: true }, _count: true }),
  ]);

  // `activeSubscriptions` now also carries trialing rows, so anything that
  // means "currently paying" has to say so.
  const activeOnly = activeSubscriptions.filter((s) => s.status === "active");

  const mrr = activeOnly.reduce(
    (sum, s) => sum + Number(s.plan.priceMonthly),
    0,
  );

  // The same subscriptions, asked the harder question: which of these can
  // actually raise a charge next cycle?
  const revenueOutlook = buildRevenueOutlook(activeSubscriptions);

  // Plan mix — which plans people actually buy.
  const planMix = {};
  for (const s of activeOnly) {
    planMix[s.plan.name] = (planMix[s.plan.name] || 0) + 1;
  }

  return NextResponse.json({
    // Money
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    totalBilled: Number(paymentTotal._sum.amount || 0),
    // FieldQuo's own subscription revenue, kept structurally apart from every
    // tenant figure above it. See the header.
    outlook: revenueOutlook,
    quotedValue: Number(quoteTotal._sum.total || 0),
    invoicedValue: Number(invoiceTotal._sum.total || 0),

    // Counts
    activeSubscriptionCount: activeOnly.length,
    totalCompanies,
    activeCompanies,
    trialCompanies,
    churnedThisMonth,
    quotesThisMonth,
    jobsThisMonth,
    totalQuotes: quoteTotal._count,
    totalInvoices: invoiceTotal._count,

    planMix,

    // Series
    daily: {
      companies: seriesFrom(bucketByDay(recentCompanies), 30),
      quotes: seriesFrom(bucketByDay(recentQuotes, "createdAt", "total"), 30),
      payments: seriesFrom(
        bucketByDay(recentPayments, "createdAt", "amount"),
        30,
      ),
    },
    monthly: {
      companies: monthlySeriesFrom(yearCompanies, 12),
      quotes: monthlySeriesFrom(yearQuotes, 12, "createdAt", "total"),
      payments: monthlySeriesFrom(yearPayments, 12, "createdAt", "amount"),
    },
  });
}
