// app/api/platform/sales/prospects/route.js
//
// What discovery actually found, filtered — the owner's own answer to "is the
// pipeline working".
//
// ══ Why the filters are the product and not decoration ════════════════════
//
// Discovery writes Prospect rows at volume and nothing rendered them. The
// questions this screen exists to answer are all comparisons: is the Ottawa
// territory producing more retailers than Gatineau, is the crawler reaching
// anything (has-website), how many of these are already on Jobber. Each is a
// filter, and a list with no filters answers none of them.
//
// ══ Three-valued filters stay three-valued ════════════════════════════════
//
// `hasWebsite` is true / false / null on the row for the reason its schema
// comment gives, so the filter offers three values and never two. Folding
// "unknown" into "no" here would undo the schema decision one layer from the
// screen — the same failure presentCapability's header describes.
//
// The competitor filter has the same shape and it is easier to get wrong:
// "no competitor rows" is NOT "no competitor". A prospect nothing has crawled
// has no rows either. So the three options are DETECTED, NOT DETECTED AND
// CRAWLED, and NOT CRAWLED, and the last is not silently merged into the
// middle one.
//
// ══ Read-only ═════════════════════════════════════════════════════════════
//
// There is no PATCH here and there should not be. The needs-review decision
// already has a route of its own (campaigns/[id]/review), the rep's claim is
// written through /api/sales/queue, and a superadmin editing a discovered fact
// in place would destroy the provenance ProspectCorrection exists to keep.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { discoveryTradeKeys, DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";
import {
  PROSPECT_STATUS_LABELS,
  claimState,
  contactability,
} from "@/lib/sales/prospectView";

const PAGE_SIZE = 50;

function trimmed(value, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const q = trimmed(url.searchParams.get("q"));
  const territoryId = trimmed(url.searchParams.get("territoryId"), 40);
  const campaignId = trimmed(url.searchParams.get("campaignId"), 40);
  const tradeKey = trimmed(url.searchParams.get("tradeKey"), 40);
  const status = trimmed(url.searchParams.get("status"), 40);
  const website = trimmed(url.searchParams.get("website"), 20);
  const competitor = trimmed(url.searchParams.get("competitor"), 20);
  const claim = trimmed(url.searchParams.get("claim"), 20);
  const contact = trimmed(url.searchParams.get("contact"), 20);
  const minScoreRaw = Number(url.searchParams.get("minScore"));
  const minScore = Number.isFinite(minScoreRaw) ? Math.floor(minScoreRaw) : null;
  const page = Math.max(0, Math.floor(Number(url.searchParams.get("page")) || 0));

  const now = new Date();
  const where = {};

  if (territoryId) where.territoryId = territoryId;
  if (campaignId) where.campaignId = campaignId;
  if (tradeKey && DISCOVERY_TRADES[tradeKey]) where.tradeKey = tradeKey;
  if (status && PROSPECT_STATUS_LABELS[status]) where.status = status;

  // Three values, not two. `unknown` is its own branch and never falls through
  // to `false`.
  if (website === "yes") where.hasWebsite = true;
  else if (website === "no") where.hasWebsite = false;
  else if (website === "unknown") where.hasWebsite = null;

  if (competitor === "yes") where.technologies = { some: { isCompetitor: true } };
  else if (competitor === "no") {
    // "We looked and found none" — which requires that we looked at all.
    where.technologies = { none: { isCompetitor: true } };
    where.lastCrawledAt = { not: null };
  } else if (competitor === "uncrawled") where.lastCrawledAt = null;

  if (claim === "unclaimed") where.assignedRepId = null;
  else if (claim === "claimed") {
    where.assignedRepId = { not: null };
    where.OR = [{ claimExpiresAt: null }, { claimExpiresAt: { gt: now } }];
  } else if (claim === "lapsed") {
    where.assignedRepId = { not: null };
    where.claimExpiresAt = { lt: now };
  }

  if (contact === "dnc") where.doNotContactAt = { not: null };
  else if (contact === "callable") where.doNotContactAt = null;

  if (minScore !== null && minScore > 0) where.scores = { some: { score: { gte: minScore } } };

  if (q) {
    // AND-ed with everything above rather than spread into it: an OR at the
    // top level next to the claim filter's own OR would silently replace it.
    where.AND = [
      {
        OR: [
          { businessName: { contains: q, mode: "insensitive" } },
          { domain: { contains: q.toLowerCase() } },
          { phoneE164: { contains: q } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [rows, total, territories, campaigns, scoredCount, statusCounts] = await Promise.all([
    db.prospect.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        businessName: true,
        city: true,
        province: true,
        tradeKey: true,
        status: true,
        classification: true,
        hasWebsite: true,
        websiteUrl: true,
        googleRating: true,
        googleReviewCount: true,
        phoneE164: true,
        lastCrawledAt: true,
        assignedRepId: true,
        claimExpiresAt: true,
        doNotContactAt: true,
        doNotContactReason: true,
        territory: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
        technologies: { where: { isCompetitor: true }, select: { technologyCode: true } },
        scores: { orderBy: { computedAt: "desc" }, take: 1, select: { score: true } },
      },
    }),
    db.prospect.count({ where }),
    db.salesTerritory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.prospectCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true },
    }),
    // Nothing writes ProspectScore in this build. The screen needs to KNOW
    // that rather than render a score filter that silently empties the list.
    db.prospectScore.count(),
    db.prospect.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return NextResponse.json({
    prospects: rows.map((p) => ({
      id: p.id,
      businessName: p.businessName,
      where: [p.city, p.province].filter(Boolean).join(", ") || null,
      tradeKey: p.tradeKey,
      tradeLabel: p.tradeKey ? DISCOVERY_TRADES[p.tradeKey]?.label || p.tradeKey : null,
      status: p.status,
      statusLabel: PROSPECT_STATUS_LABELS[p.status] || p.status,
      classification: p.classification,
      // Three-valued all the way out. The list badge for `null` says "not
      // checked", never "no".
      hasWebsite: p.hasWebsite,
      websiteUrl: p.websiteUrl,
      rating: p.googleRating === null ? null : Number(p.googleRating),
      reviewCount: p.googleReviewCount,
      crawled: Boolean(p.lastCrawledAt),
      competitors: p.technologies.map((t) => t.technologyCode),
      score: p.scores[0]?.score ?? null,
      territory: p.territory,
      campaign: p.campaign,
      claim: claimState(p, { repId: null, now }),
      contact: contactability(p),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    territories,
    campaigns,
    trades: discoveryTradeKeys().map((key) => ({ key, label: DISCOVERY_TRADES[key].label })),
    statuses: Object.entries(PROSPECT_STATUS_LABELS).map(([key, label]) => ({ key, label })),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    // Reported so the screen can disable the score filter and SAY why, rather
    // than offering a control that filters everything out.
    scoredCount,
  });
}
