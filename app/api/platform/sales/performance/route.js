// app/api/platform/sales/performance/route.js
//
// Every number on the sales dashboard, read once.
//
// ══ Read-only, and superadmin-only ════════════════════════════════════════
//
// There is no POST, PATCH or DELETE in this file and there will not be one. A
// rep must never gain a write path to attribution or commission — the whole
// integrity of the ledger rests on a rep being unable to assert a relationship
// that did not happen (lib/sales/repStats.js's header makes the argument), and
// a dashboard is exactly the kind of screen where an "adjust" button gets added
// because it seemed convenient.
//
// Superadmin rather than canPlatform(), matching POST /api/platform/sales/reps'
// own bar and for the reason its header gives: there is no sales permission in
// PLATFORM_PERMISSIONS, and adding one would imply the permission map has a
// scoping concept it does not have. What is on this page is what FieldQuo pays
// its own staff.
//
// ══ Why every row is loaded and the arithmetic happens in a pure module ═══
//
// lib/sales/performance.js does all of it and imports no database. That is what
// lets scripts/check-sales-admin.mjs execute a reversal in the ledger, a rep
// under the rate floor and a departed rep with history — offline, against
// hostile input, which is where the real bugs in this repo have been found.
//
// The volumes are FieldQuo's own: reps, the companies FieldQuo has sold to, and
// the ledger rows behind them. That is not tenant-scale data and does not need
// aggregate queries — and a groupBy would have to be re-derived per panel,
// which is how two panels on one screen come to disagree.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { presetRange, PERIOD_PRESETS } from "@/lib/analytics/periodPresets";
import { buildSalesPerformance } from "@/lib/sales/performance";

/** Inclusive YYYY-MM-DD bounds to instants, UTC — the same convention presetRange builds in. */
function boundsFor(preset) {
  const { from, to } = presetRange(preset);
  return {
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
    key: from && to ? preset : "thisMonth",
  };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can see sales performance" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const wanted = url.searchParams.get("preset") || "thisMonth";
  // An unknown preset falls back to this month rather than 400ing — presetRange
  // already has that default, and this reads the same fallback rather than a
  // second opinion about which key is valid.
  const known = PERIOD_PRESETS.some(([key]) => key === wanted);
  const { from, to } = boundsFor(known ? wanted : "thisMonth");

  const [reps, attributions, entries, batches, leads] = await Promise.all([
    db.salesRep.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        active: true,
        acceptedAt: true,
        endedAt: true,
        // Loaded because a rep with no plan earns no ledger rows at all
        // (earnMilestone refuses to invent an amount), which makes their
        // companies invisible to the payment stages of the funnel. The funnel
        // reports that as a named caveat rather than a smaller number.
        commissionPlanId: true,
      },
    }),
    // No date filter. "This week" and "total" are both on the screen, the
    // period bounds are applied in the pure module, and filtering here would
    // make the lifetime figures silently mean "in the selected period".
    db.salesAttribution.findMany({
      select: { salesRepId: true, companyId: true, capturedAt: true, source: true },
    }),
    db.salesCommissionEntry.findMany({
      select: {
        salesRepId: true,
        companyId: true,
        milestone: true,
        amountCents: true,
        status: true,
        payoutBatchId: true,
        occurredAt: true,
      },
    }),
    db.salesPayoutBatch.findMany({
      select: { id: true, salesRepId: true, status: true, paidAt: true, periodStart: true },
    }),
    db.salesLead.findMany({
      select: {
        salesRepId: true,
        status: true,
        createdAt: true,
        convertedCompanyId: true,
        convertedAt: true,
      },
    }),
  ]);

  // Only the companies a rep actually brought in. Not every tenant: this page
  // is about attributed acquisition, and loading the rest would put companies
  // on it that no rep can be credited or debited for.
  const companyIds = [...new Set(attributions.map((a) => a.companyId).filter(Boolean))];
  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        select: {
          id: true,
          name: true,
          createdAt: true,
          stripeChargesEnabled: true,
          onboardingStatus: true,
          isDemo: true,
          subscription: {
            select: {
              status: true,
              createdAt: true,
              canceledAt: true,
              currentPeriodEnd: true,
              plan: { select: { name: true } },
            },
          },
        },
      })
    : [];

  const report = buildSalesPerformance({
    reps,
    attributions,
    entries,
    batches,
    leads,
    companies,
    from,
    to,
  });

  const byRep = new Map(reps.map((r) => [r.id, r]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // Note what is NOT in this body: the preset key and the list of presets. The
  // screen owns the picker and validates against the same PERIOD_PRESETS this
  // route does, so echoing either back would be a field written and never read
  // — AGENTS.md failure class 1. `period` IS returned, and IS rendered, because
  // the dates the numbers actually cover are a fact the reader needs and cannot
  // derive from a key alone.
  return NextResponse.json({
    ...report,
    // "Which companies did a rep bring in, and what are they doing now" — the
    // question the funnel counts answer in aggregate, listed so a name can be
    // clicked through to the company itself.
    acquisitions: attributions
      .map((a) => {
        const company = companyById.get(a.companyId);
        const rep = byRep.get(a.salesRepId);
        return {
          companyId: a.companyId,
          companyName: company?.name || null,
          repId: a.salesRepId,
          repName: rep?.name || null,
          capturedAt: a.capturedAt,
          source: a.source,
          isDemo: Boolean(company?.isDemo),
          chargesEnabled: Boolean(company?.stripeChargesEnabled),
          onboardingStatus: company?.onboardingStatus || null,
          subscriptionStatus: company?.subscription?.status || null,
          planName: company?.subscription?.plan?.name || null,
          canceledAt: company?.subscription?.canceledAt || null,
        };
      })
      .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt)),
  });
}
