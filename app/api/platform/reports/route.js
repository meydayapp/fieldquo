// app/api/platform/reports/route.js
//
// CSV exports for the numbers you'd put in a board update or work in a
// spreadsheet.
//
// CSV rather than a charting endpoint on purpose: growth analysis is
// exploratory, and whatever chart I build won't be the cut you want next
// month. A file you can pivot beats a dashboard you can't change.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { METRICS_COMPANY_WHERE } from "@/lib/platform/metricsScope";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { subscriberBucket } from "@/lib/platform/trialCounting";
import { BUCKETS } from "@/lib/platform/subscriberBuckets";
import { normaliseCurrency, UNKNOWN_CURRENCY } from "@/lib/platform/metricFormat";

/**
 * Minimal RFC-4180 escaping. Company names contain commas and apostrophes
 * routinely, and an unescaped one silently shifts every later column — the
 * kind of corruption you only notice after building a chart on it.
 */
function csvCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // BOM so Excel opens UTF-8 correctly — without it, accented company names
  // arrive mangled on Windows, which is most of the people you'd send this to.
  return "﻿" + lines.join("\r\n");
}

function isoDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "analytics:view");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const report = searchParams.get("report") || "companies";

  let headers = [];
  let rows = [];
  let filename = "fieldquo-export";

  if (report === "companies") {
    const companies = await db.company.findMany({
      include: {
        // priceMonthly and currency: the "Monthly" column read
        // plan.priceMonthly while only `name` was selected, so it exported
        // NaN; and a price with no currency beside it is a CAD-or-USD guess
        // for whoever totals the column (owner decision 2026-10-03).
        subscription: { include: { plan: { select: { name: true, priceMonthly: true, currency: true } } } },
        _count: {
          select: { members: true, clients: true, quotes: true, invoices: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    filename = "fieldquo-companies";
    const standingAt = new Date();
    headers = [
      "Company",
      "Slug",
      "Email",
      "Status",
      // A column of its own rather than something a reader is expected to
      // infer from "Subscription status" being blank. Ten rows in this export
      // are people who never reached the end of Stripe Checkout, and every
      // count on the console now excludes them — an export that did not say
      // which ones would be the copy somebody totals up and gets a different
      // answer from the dashboard.
      "Finished checkout",
      // The dashboard's bucket (lib/platform/trialCounting.js), so an export
      // totalled by this column gives the /platform tiles' numbers exactly —
      // "Status" beside it is onboardingStatus, which says "active" about a
      // Stripe trial and "pending" about every card-free one.
      "Standing",
      "Signed up",
      "Plan",
      "Subscription status",
      "Monthly",
      "Currency",
      "Trial ends",
      "Members",
      "Clients",
      "Quotes",
      "Invoices",
      "Stripe connected",
      "Sending domain",
    ];
    rows = companies.map((c) => [
      c.name,
      c.slug,
      c.email,
      c.onboardingStatus,
      c.subscription ? "yes" : "no",
      BUCKETS[subscriberBucket(c, standingAt)]?.label || "",
      isoDate(c.createdAt),
      c.subscription?.plan?.name || "",
      c.subscription?.status || "",
      c.subscription?.plan ? Number(c.subscription.plan.priceMonthly) : "",
      c.subscription?.plan?.currency || "",
      isoDate(c.trialEndsAt),
      c._count.members,
      c._count.clients,
      c._count.quotes,
      c._count.invoices,
      c.stripeChargesEnabled ? "yes" : "no",
      c.emailDomain || "",
    ]);
  } else if (report === "growth") {
    // One row per month with the counts that describe the shape of growth.
    // Assembled in JS rather than SQL so it stays provider-agnostic and
    // readable; at platform scale the row counts are small.
    //
    // Demos and test companies out (lib/platform/metricsScope.js, 2026-10-03)
    // — the population the dashboard's own series count. Unscoped, a seeded
    // demo's invented invoices were most of "Payment value" here while the
    // dashboard beside it left them out.
    // Money is split per currency — one "Quoted value (CAD)" column per
    // currency in the book — never summed across them (owner decision
    // 2026-10-03). A quote and a payment are in their company's currency.
    const [companies, quotes, payments] = await Promise.all([
      db.company.findMany({ where: METRICS_COMPANY_WHERE, select: { createdAt: true } }),
      db.quote.findMany({ where: { company: METRICS_COMPANY_WHERE }, select: { createdAt: true, total: true, company: { select: { currency: true } } } }),
      db.payment.findMany({
        where: { invoice: { company: METRICS_COMPANY_WHERE } },
        select: { createdAt: true, amount: true, invoice: { select: { company: { select: { currency: true } } } } },
      }),
    ]);
    const currencies = new Set();
    const codeOf = (c) => normaliseCurrency(c) || UNKNOWN_CURRENCY;

    const buckets = new Map();
    const bucket = (key) => {
      if (!buckets.has(key)) {
        buckets.set(key, {
          companies: 0,
          quotes: 0,
          quotedValue: {},
          payments: 0,
          paymentValue: {},
        });
      }
      return buckets.get(key);
    };

    for (const c of companies) bucket(isoDate(c.createdAt).slice(0, 7)).companies++;
    for (const q of quotes) {
      const b = bucket(isoDate(q.createdAt).slice(0, 7));
      b.quotes++;
      const code = codeOf(q.company?.currency);
      currencies.add(code);
      b.quotedValue[code] = (b.quotedValue[code] || 0) + Number(q.total || 0);
    }
    for (const p of payments) {
      const b = bucket(isoDate(p.createdAt).slice(0, 7));
      b.payments++;
      const code = codeOf(p.invoice?.company?.currency);
      currencies.add(code);
      b.paymentValue[code] = (b.paymentValue[code] || 0) + Number(p.amount || 0);
    }

    filename = "fieldquo-growth";
    const codes = [...currencies].sort();
    headers = [
      "Month",
      "New companies",
      "Cumulative companies",
      "Quotes created",
      ...codes.map((c) => `Quoted value (${c})`),
      "Payments",
      ...codes.map((c) => `Payment value (${c})`),
    ];

    let cumulative = 0;
    rows = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, b]) => {
        cumulative += b.companies;
        return [
          month,
          b.companies,
          cumulative,
          b.quotes,
          ...codes.map((c) => (b.quotedValue[c] || 0).toFixed(2)),
          b.payments,
          ...codes.map((c) => (b.paymentValue[c] || 0).toFixed(2)),
        ];
      });
  } else if (report === "subscriptions") {
    const subs = await db.subscription.findMany({
      include: {
        plan: { select: { name: true, priceMonthly: true, currency: true } },
        company: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    filename = "fieldquo-subscriptions";
    headers = [
      "Company",
      "Email",
      "Plan",
      "Monthly",
      "Currency",
      "Status",
      "Started",
      "Trial ends",
      "Renews",
      "Stripe linked",
    ];
    rows = subs.map((s) => [
      s.company?.name,
      s.company?.email,
      s.plan?.name,
      Number(s.plan?.priceMonthly || 0),
      s.plan?.currency || "",
      s.status,
      isoDate(s.createdAt),
      isoDate(s.trialEndsAt),
      isoDate(s.currentPeriodEnd),
      s.stripeSubscriptionId ? "yes" : "no",
    ]);
  } else {
    return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  }

  const csv = toCsv(headers, rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"`,
      // These contain customer data — never let a proxy or CDN hold a copy.
      "Cache-Control": "no-store, private",
    },
  });
}
