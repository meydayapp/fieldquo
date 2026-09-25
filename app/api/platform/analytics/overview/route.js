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
import {
  loadSubscriberBook,
  outlookSubscriptions,
} from "@/lib/platform/trialCounting";
import { ON_PLAN_BUCKETS, isCustomerBucket } from "@/lib/platform/subscriberBuckets";
import { stripeMirrorFreshness } from "@/lib/platform/webhookHealth";

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
    book,
    stripeMirror,
    quotesThisMonth,
    jobsThisMonth,
    recentQuotes,
    recentPayments,
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
    // ── And an abandoned checkout is not a company either ──────────────────
    //
    // Same argument as the demo filter above, one step further. Ten non-demo
    // companies have no Subscription row at all: they were created by
    // app/api/companies/route.js at line ~271 and never reached
    // createTrialCheckoutSession at line ~493, so nobody ever gave a card. The
    // owner's ruling is that they "should not have been signed up yet", and
    // this tile is the one number that claims how many businesses are on
    // FieldQuo — with them in it, the claim was overstated by a third.
    //
    // Excluded, never deleted, and never merged: every row stays exactly where
    // it is and gets its own screen (/platform/signups). See
    // lib/signup/abandoned.js for why the Subscription row is the whole test
    // and onboardingStatus cannot be.
    //
    // ── Every company number on this page is one book ──────────────────────
    //
    // "Companies", "incomplete signups", "trialing", "paying", "churned this
    // month", the plan mix and the revenue outlook's subscriptions used to be
    // five separate queries with five separate where-clauses. On 2026-09-25
    // the tile read "Trialing subscriptions: 2" while the banner under it
    // said 5 and the owner counted 4 — each query right about its own rule,
    // none about the question. Now every company is classified ONCE into one
    // bucket (lib/platform/trialCounting.js subscriberBucket; the names in
    // lib/platform/subscriberBuckets.js) and each number below is the length
    // of a bucket's list. Demos are their own bucket, so the demo exclusion
    // the comment above argues for is applied by construction.
    //
    // Live on every request: nothing here is a rollup or a snapshot. The one
    // thing that can be stale is the Subscription mirror of Stripe, so how
    // fresh it is ships beside the numbers (stripeMirror).
    loadSubscriberBook(db, { now }),
    stripeMirrorFreshness().catch((err) => {
      console.error("[platform/overview] mirror freshness unavailable:", err?.message);
      return null;
    }),
    db.quote.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.job.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Daily and monthly series inputs. The company series come from the book
    // below, not a query: "New companies" counted every Company row created,
    // an abandoned signup included, beside a "companies" total that excludes
    // them. The quote and payment series now leave out demo companies too —
    // a rep seeding a demo wrote a burst of fixture quotes into "Quotes
    // created" every time.
    db.quote.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, company: NOT_DEMO },
      select: { createdAt: true, total: true },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, invoice: { company: NOT_DEMO } },
      select: { createdAt: true, amount: true },
    }),
    db.quote.findMany({
      where: { createdAt: { gte: twelveMonthsAgo }, company: NOT_DEMO },
      select: { createdAt: true, total: true },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: twelveMonthsAgo }, invoice: { company: NOT_DEMO } },
      select: { createdAt: true, amount: true },
    }),

    // ── Scoped to real companies, which they were not ─────────────────────
    //
    // These three had no `where` clause at all while every company COUNT on
    // the same dashboard used NOT_DEMO. So the numerators came from one
    // population and the denominators from another, and the money was mostly
    // fiction: of $473,558 "invoiced", $470,562 belonged to the ten seeded
    // demo companies. 99.4%. Quoted value was worse — $2,300,456 of which
    // $2,253,040 was seed data.
    //
    // A demo company is a sales fixture with invented invoices to Sarah
    // Mitchell. Counting its $168,562 roofing invoice as product volume makes
    // the dashboard describe a business that does not exist.
    // Payment has no companyId of its own — it hangs off the invoice it paid,
    // so the demo filter has to travel through that relation. Caught by
    // running it: the direct `company` filter is a validation error, not a
    // silent no-op, but only if somebody executes the query.
    db.payment.aggregate({
      _sum: { amount: true },
      where: { invoice: { company: NOT_DEMO } },
    }),
    db.quote.aggregate({
      _sum: { total: true },
      _count: true,
      where: { company: NOT_DEMO },
    }),
    db.invoice.aggregate({
      _sum: { total: true },
      _count: true,
      where: { company: NOT_DEMO },
    }),
  ]);

  const { tally } = book;
  const inBucket = (...buckets) => book.companies.filter((c) => buckets.includes(c.bucket));
  // Companies that finished signing up — the population "companies" means on
  // every tile — dated by their own creation, for the growth series.
  const customers = book.companies.filter((c) => isCustomerBucket(c.bucket));
  const recentCompanies = customers.filter((c) => new Date(c.createdAt) >= thirtyDaysAgo);
  const yearCompanies = customers.filter((c) => new Date(c.createdAt) >= twelveMonthsAgo);

  // The subscriptions the outlook prices: the Paying and Trialing-with-a-plan
  // buckets only. A card-free trial has no plan and no price, so it can never
  // reach MRR — it is counted in `trialing`, never in money.
  const priced = outlookSubscriptions(book.companies);
  const activeOnly = priced.filter((s) => s.status === "active");

  const mrr = activeOnly.reduce(
    (sum, s) => sum + Number(s.plan?.priceMonthly || 0),
    0,
  );

  // The same subscriptions, asked the harder question: which of these can
  // actually raise a charge next cycle?
  const revenueOutlook = buildRevenueOutlook(priced, now);

  // Churned this month: the Cancelled bucket, dated by the subscription's own
  // canceledAt. It was onboardingStatus "churned" + Company.updatedAt, which
  // any edit to a churned company moved into the window (and which the
  // console's own suspend button writes without anyone leaving).
  const monthStartMs = startOfMonth.getTime();
  const churned = inBucket("cancelled").filter(
    (c) => c.subscription?.canceledAt && new Date(c.subscription.canceledAt).getTime() >= monthStartMs,
  );
  // Still paying, already booked to leave — Stripe's cancel_at_period_end.
  // Not churn yet; named so the Paying tile does not read as a promise.
  const cancelling = inBucket("paying").filter((c) => c.subscription?.cancelAtPeriodEnd);

  // Who is on each plan, by plan ID — the plans page's subscriber counts.
  // It looked these up by plan NAME in `planMix`, whose keys became
  // "Solo (CAD)" when the currency split landed, so every plan card read
  // "0 companies" (and a price-change warning never fired) while two
  // companies were trialing on Solo. Counted over every bucket holding a
  // live plan — paying, past due and trialing with a plan — because a price
  // change touches all three.
  const planUsage = {};
  for (const c of inBucket(...ON_PLAN_BUCKETS)) {
    const id = c.subscription?.planId;
    if (!id) continue;
    const row = (planUsage[id] ||= { paying: 0, pastDue: 0, trialing: 0, total: 0 });
    if (c.bucket === "paying") row.paying++;
    else if (c.bucket === "past_due") row.pastDue++;
    else row.trialing++;
    row.total++;
  }

  // Plan mix — which plans people actually buy.
  const planMix = {};
  for (const s of activeOnly) {
    // Name AND currency. The ladder exists once per currency and both rows are
    // called "Solo" — keying on the name alone merged them into one bucket and
    // hid the CAD/USD split, which is the one thing this breakdown is for.
    const key = s.plan.currency ? `${s.plan.name} (${s.plan.currency})` : s.plan.name;
    planMix[key] = (planMix[key] || 0) + 1;
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

    // Counts — every one a bucket length from the same book.
    activeSubscriptionCount: activeOnly.length,
    // Companies that finished signing up (a subscription, or the card-free
    // trial). NOT every Company row: `incompleteSignups` ships beside it
    // rather than being subtracted silently, so a reader can take the number
    // apart.
    totalCompanies: tally.customers,
    incompleteSignups: tally.counts.incomplete,
    // The Paying bucket: a subscription Stripe calls active. How many of
    // those can actually be CHARGED is outlook.collectableCount, printed
    // beside it rather than instead of it.
    payingCompanies: tally.counts.paying,
    pastDueCompanies: tally.counts.past_due,
    cancellingAtPeriodEnd: cancelling.map((c) => c.name),
    // Companies inside a free month, and the two ways to be in one: a Stripe
    // trial on a chosen plan, or the card-free trial with no plan yet.
    trialCompanies: tally.trialing.total,
    trialBreakdown: {
      withPlan: tally.trialing.withPlan,
      noPlan: tally.trialing.noPlan,
    },
    churnedThisMonth: churned.length,
    // The whole book: every bucket's count AND the companies in it, so the
    // page can print the names under each number and nobody has to take a
    // tile on trust. Demos are listed as their own bucket and counted nowhere.
    book: { at: tally.at, counts: tally.counts, members: tally.members },
    // How fresh the Subscription rows (Stripe's mirror) are.
    stripeMirror,
    planUsage,
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
