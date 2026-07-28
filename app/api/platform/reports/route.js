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
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

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
        subscription: { include: { plan: { select: { name: true } } } },
        _count: {
          select: { members: true, clients: true, quotes: true, invoices: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    filename = "fieldquo-companies";
    headers = [
      "Company",
      "Slug",
      "Email",
      "Status",
      "Signed up",
      "Plan",
      "Subscription status",
      "Monthly",
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
      isoDate(c.createdAt),
      c.subscription?.plan?.name || "",
      c.subscription?.status || "",
      c.subscription?.plan ? Number(c.subscription.plan.priceMonthly) : "",
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
    const [companies, quotes, payments] = await Promise.all([
      db.company.findMany({ select: { createdAt: true } }),
      db.quote.findMany({ select: { createdAt: true, total: true } }),
      db.payment.findMany({ select: { createdAt: true, amount: true } }),
    ]);

    const buckets = new Map();
    const bucket = (key) => {
      if (!buckets.has(key)) {
        buckets.set(key, {
          companies: 0,
          quotes: 0,
          quotedValue: 0,
          payments: 0,
          paymentValue: 0,
        });
      }
      return buckets.get(key);
    };

    for (const c of companies) bucket(isoDate(c.createdAt).slice(0, 7)).companies++;
    for (const q of quotes) {
      const b = bucket(isoDate(q.createdAt).slice(0, 7));
      b.quotes++;
      b.quotedValue += Number(q.total || 0);
    }
    for (const p of payments) {
      const b = bucket(isoDate(p.createdAt).slice(0, 7));
      b.payments++;
      b.paymentValue += Number(p.amount || 0);
    }

    filename = "fieldquo-growth";
    headers = [
      "Month",
      "New companies",
      "Cumulative companies",
      "Quotes created",
      "Quoted value",
      "Payments",
      "Payment value",
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
          b.quotedValue.toFixed(2),
          b.payments,
          b.paymentValue.toFixed(2),
        ];
      });
  } else if (report === "subscriptions") {
    const subs = await db.subscription.findMany({
      include: {
        plan: { select: { name: true, priceMonthly: true } },
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
