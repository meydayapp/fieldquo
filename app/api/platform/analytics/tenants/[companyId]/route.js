// app/api/platform/analytics/tenants/[companyId]/route.js
//
// GET — one company's numbers, and how they sit against everyone else's.
//
// Built for the phone call: a contractor asks why work has gone quiet, or you
// ring them because it has. "Your win rate is 38%" means nothing alone; "38%
// against a median of 61% across nine other companies" is a conversation.
//
// The comparison refuses to answer when it can't answer honestly — see
// lib/analytics/companyComparison.js for the three separate ways it declines.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import {
  metricsForCompany,
  compareToCohort,
  talkingPoints,
} from "@/lib/analytics/companyComparison";
import { buildFunnel, buildTradeBreakdown } from "@/lib/analytics/tenantHealth";

const NOT_DEMO = { isDemo: false };

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { companyId } = await params;

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

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, createdAt: true, isDemo: true },
  });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    // Everyone's rows in one pass, then split. Querying the subject separately
    // would let the two halves drift — a filter tightened on one and not the
    // other would compare a company against a differently-defined cohort.
    const [quotes, jobs, invoices, scopeGroups] = await Promise.all([
      db.quote.findMany({
        where: { company: NOT_DEMO },
        select: {
          companyId: true, status: true, total: true, sentAt: true,
          acceptedAt: true, composeSeconds: true, createdAt: true,
        },
      }),
      db.job.findMany({
        where: { company: NOT_DEMO },
        select: { companyId: true, status: true, quoteId: true },
      }),
      db.invoice.findMany({
        where: { company: NOT_DEMO },
        select: { companyId: true, status: true, total: true },
      }),
      db.quoteScopeGroup.findMany({
        where: { quote: { companyId } },
        select: {
          subtotal: true,
          category: { select: { key: true, label: true } },
          quote: { select: { id: true, companyId: true, status: true, sentAt: true, total: true } },
        },
      }),
    ]);

    const group = (rows) => {
      const m = new Map();
      for (const r of rows) {
        if (!m.has(r.companyId)) m.set(r.companyId, []);
        m.get(r.companyId).push(r);
      }
      return m;
    };
    const qBy = group(quotes);
    const jBy = group(jobs);
    const iBy = group(invoices);

    const rowsFor = (id) => ({
      quotes: qBy.get(id) || [],
      jobs: jBy.get(id) || [],
      invoices: iBy.get(id) || [],
    });

    const subject = metricsForCompany(rowsFor(companyId));

    // Every OTHER company. The subject is excluded from its own benchmark —
    // in a small cohort it would otherwise be a large share of the thing it is
    // being measured against.
    const otherIds = [...new Set([...qBy.keys(), ...jBy.keys(), ...iBy.keys()])]
      .filter((id) => id !== companyId);
    const others = otherIds.map((id) => metricsForCompany(rowsFor(id)));

    const comparison = compareToCohort(subject, others);

    return NextResponse.json({
      company: { id: company.id, name: company.name, createdAt: company.createdAt, isDemo: company.isDemo },
      comparison,
      talkingPoints: talkingPoints(comparison),
      // Their own funnel and trade mix, unbenchmarked — the detail behind the
      // comparison, for when the call gets specific.
      funnel: buildFunnel(rowsFor(companyId).quotes, rowsFor(companyId).jobs, rowsFor(companyId).invoices),
      trades: buildTradeBreakdown(
        scopeGroups
          .filter((g) => g.category && g.quote)
          .map((g) => ({
            companyId: g.quote.companyId,
            categoryKey: g.category.key,
            categoryLabel: g.category.label,
            status: g.quote.status,
            sentAt: g.quote.sentAt,
            scopeSubtotal: Number(g.subtotal || 0),
            quoteTotal: Number(g.quote.total || 0),
          })),
      ),
      cohortSize: otherIds.length,
    });
  } catch (err) {
    console.error("[analytics/tenants/company]", err);
    return NextResponse.json(
      { error: "Couldn't work out this company's numbers just now." },
      { status: 500 },
    );
  }
}
