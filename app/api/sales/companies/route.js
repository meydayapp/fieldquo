// app/api/sales/companies/route.js
//
// The rep's own book: the companies attributed to them, and nothing else.
//
// ══ This route IS the tenant boundary ═════════════════════════════════════
//
// Every other cross-company read in this codebase belongs to a platform admin,
// who sees all of them. Every scoped read belongs to a Member, who sees exactly
// one. This is the first route that sees a SUBSET, and there is no outer
// companyId filter sitting in front of it — assignedCompanyWhere() is the only
// thing between this rep and 31 other contractors' businesses.
//
// Which is why the `where` is not written inline here. It comes from
// lib/sales/scope.js, it fails closed rather than open, and it is executed
// against a fixture rep in scripts/check-sales-auth.mjs rather than reviewed by
// eye. A comment claiming a filter is correct is not evidence.
//
// ══ Read-only, twice ══════════════════════════════════════════════════════
//
// There is no POST/PATCH/DELETE in this file, and there could not usefully be
// one: requireSalesRep refuses any method that is not a read, before a handler
// sees it, and middleware.js's /api/sales gate stands in front of that. The
// reason is in lib/sales/gate.js — commission-on-influence means a rep who can
// write their own ledger can pay themselves.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import {
  REP_COMPANY_SELECT,
  REP_MILESTONE_SELECT,
  assignedCompanyWhere,
} from "@/lib/sales/scope";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) {
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const companies = await db.company.findMany({
    where: assignedCompanyWhere(rep.id),
    select: REP_COMPANY_SELECT,
    orderBy: { createdAt: "desc" },
  });

  // Milestones are read in one query keyed on the rep, not per company, and
  // scoped by salesRepId as well as by the company list — a ledger row written
  // against another rep for a company this rep is attributed to would be that
  // other rep's earning, and it is not this rep's to see.
  const milestones = companies.length
    ? await db.salesCommissionEntry.findMany({
        where: {
          salesRepId: rep.id,
          companyId: { in: companies.map((c) => c.id) },
        },
        select: REP_MILESTONE_SELECT,
        orderBy: { occurredAt: "asc" },
      })
    : [];

  const byCompany = new Map();
  for (const entry of milestones) {
    if (!byCompany.has(entry.companyId)) byCompany.set(entry.companyId, []);
    byCompany.get(entry.companyId).push({
      milestone: entry.milestone,
      status: entry.status,
      occurredAt: entry.occurredAt,
    });
  }

  return NextResponse.json({
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      signedUpAt: c.createdAt,
      isDemo: c.isDemo,
      chargesEnabled: c.stripeChargesEnabled,
      onboardingCompletedAt: c.onboardingCompletedAt,
      subscriptionStatus: c.subscription?.status || null,
      attributedAt: c.salesAttribution?.capturedAt || null,
      attributionSource: c.salesAttribution?.source || null,
      // An empty array is the truthful answer for a company with no recorded
      // milestone, and the screen renders it as "none recorded" rather than as
      // three "not yet" pills. Absence of a statement is not a statement —
      // AGENTS.md failure class #5 — and inventing a milestone timeline for a
      // ledger nothing has written to yet is exactly that.
      milestones: byCompany.get(c.id) || [],
    })),
  });
}
