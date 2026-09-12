// app/api/platform/sales/review/route.js
//
// The Review folder: the rows that need a human, across every campaign, and
// one decision at a time.
//
// ══ What this is for ═══════════════════════════════════════════════════════
//
// lib/sales/discovery/reviewFolder.js's header carries the numbers: 117,000
// prospects that no rep can dial until a human picks a trade, says "not a
// contractor", or says "same business". The per-campaign review panel shows
// twenty of one campaign's; this shows all of them, filtered, fifty at a time,
// each with up to three suggested trades and the reason for each.
//
// ══ GET ════════════════════════════════════════════════════════════════════
//
// Server-paginated over a raw WHERE (reviewFolder.js builds it, and the same
// fragment counts, pages and bulk-selects so the three cannot disagree). The
// page is fifty ids in decidability order, then one Prisma read for the rows
// — a raw SELECT of every column would bypass Prisma's Decimal handling and
// the campaign join for nothing. Suggestions are computed here, per row, from
// lib/sales/discovery/tradeSuggest.js; they are never stored, because a
// suggestion is not a fact about the business.
//
// ══ POST ═══════════════════════════════════════════════════════════════════
//
// One row, one decision: accept (with a trade), reject, duplicate, or skip.
// lib/sales/discovery/reviewDecide.js does the work — re-reads the row at the
// moment of the write, guards every update on the status that was read so
// two superadmins with the same page open cannot both move a campaign's
// counters for one row, and writes the counters, the ProspectCorrection and
// the audit row in one transaction. Research is queued after it, and a failed
// enqueue does not undo a decision.
//
// Superadmin only. The rows are FieldQuo's own prospect data; non-negotiable
// #3 is about a customer's tenant and does not reach here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import {
  DECISION_FIELDS,
  REVIEW_PAGE_SIZE,
  REVIEW_REASONS,
  parseReviewFilter,
  reviewOrderSql,
  reviewReasonsOf,
  reviewWhereSql,
} from "@/lib/sales/discovery/reviewFolder";
import { reviewDecide } from "@/lib/sales/discovery/reviewDecide";
import { suggestTrades, tradePickerOptions } from "@/lib/sales/discovery/tradeSuggest";
import { describeSourceCategories, licenceRegisterName } from "@/lib/sales/discovery/licenceRegisters";
import { discoveryTradeLabel } from "@/lib/sales/discovery/trades";
import { TRADE_INFERENCE_KIND } from "@/lib/sales/intel/tradeDetect";
import { getDiscoveryProvider } from "@/lib/sales/discovery/providers";

/**
 * The facets the filter bar offers: campaigns, sources and provinces that
 * actually have rows in the folder, with counts. Over the WHOLE folder rather
 * than the current filter, so narrowing to Laval does not hide Gatineau from
 * the province list.
 */
// Held for a minute per instance. Three GROUP BYs over a 250,000-row folder
// cost ~2.5 s together, and the option lists do not change between two
// keypresses; a decision moving one row does not need a fresh facet count
// to be honest to within a rounding error. The total and the page are never
// cached — those are what the reviewer is acting on.
const FACET_TTL_MS = 60 * 1000;
let facetCache = { at: 0, data: null };

async function facets(now) {
  if (facetCache.data && now.getTime() - facetCache.at < FACET_TTL_MS) return facetCache.data;
  const data = await loadFacets(now);
  facetCache = { at: now.getTime(), data };
  return data;
}

async function loadFacets(now) {
  const base = reviewWhereSql({}, { now });
  const [sources, provinces, campaigns] = await Promise.all([
    db.$queryRaw`SELECT "sourceProvider" AS key, COUNT(*)::int AS n FROM "Prospect" WHERE ${base} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw`SELECT "province" AS key, COUNT(*)::int AS n FROM "Prospect" WHERE ${base} GROUP BY 1 ORDER BY 2 DESC LIMIT 60`,
    db.$queryRaw`SELECT "campaignId" AS key, COUNT(*)::int AS n FROM "Prospect" WHERE ${base} GROUP BY 1 ORDER BY 2 DESC LIMIT 100`,
  ]);
  const campaignIds = campaigns.map((c) => c.key).filter(Boolean);
  const named = campaignIds.length
    ? await db.prospectCampaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(named.map((c) => [c.id, c.name]));
  return {
    sources: sources
      .filter((s) => s.key)
      .map((s) => ({ key: s.key, label: getDiscoveryProvider(s.key)?.label || s.key, count: Number(s.n) })),
    provinces: provinces.filter((p) => p.key).map((p) => ({ key: p.key, count: Number(p.n) })),
    campaigns: campaigns
      .filter((c) => c.key)
      .map((c) => ({ id: c.key, name: nameOf.get(c.key) || "(campaign no longer exists)", count: Number(c.n) })),
  };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const filter = parseReviewFilter(url.searchParams);
  const page = Math.max(0, Math.floor(Number(url.searchParams.get("page")) || 0));
  const now = new Date();
  const where = reviewWhereSql(filter, { now });

  const [[{ n: total }], idRows, facetData] = await Promise.all([
    db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Prospect" WHERE ${where}`,
    db.$queryRaw`SELECT id FROM "Prospect" WHERE ${where} ORDER BY ${reviewOrderSql()} LIMIT ${REVIEW_PAGE_SIZE} OFFSET ${page * REVIEW_PAGE_SIZE}`,
    facets(now),
  ]);
  const ids = idRows.map((r) => r.id);

  const rows = ids.length
    ? await db.prospect.findMany({
        where: { id: { in: ids } },
        select: {
          ...DECISION_FIELDS,
          tradingNames: true,
          city: true,
          province: true,
          domain: true,
          hasWebsite: true,
          sourceProvider: true,
          sourceRecordId: true,
          licenceNumber: true,
          sourceCategories: true,
          reviewDeferredAt: true,
          campaign: { select: { id: true, name: true } },
          inferences: { where: { kind: TRADE_INFERENCE_KIND }, select: { kind: true, value: true } },
        },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  const dupIds = [...new Set(ordered.map((r) => r.possibleDuplicateOfId).filter(Boolean))];
  const dups = dupIds.length
    ? await db.prospect.findMany({
        where: { id: { in: dupIds } },
        select: { id: true, businessName: true, city: true, status: true, tradeKey: true },
      })
    : [];
  const dupOf = new Map(dups.map((d) => [d.id, d]));

  return NextResponse.json({
    total: Number(total),
    page,
    pageSize: REVIEW_PAGE_SIZE,
    filter,
    reasons: Object.entries(REVIEW_REASONS).map(([key, r]) => ({ key, ...r })),
    trades: tradePickerOptions(),
    ...facetData,
    rows: ordered.map((p) => {
      const { suggestions, retailWord } = suggestTrades(p);
      const other = p.possibleDuplicateOfId ? dupOf.get(p.possibleDuplicateOfId) || null : null;
      return {
        id: p.id,
        businessName: p.businessName,
        tradingNames: p.tradingNames,
        city: p.city,
        province: p.province,
        phoneE164: p.phoneE164,
        websiteUrl: p.websiteUrl,
        hasWebsite: p.hasWebsite,
        sourceProvider: p.sourceProvider,
        sourceLabel: getDiscoveryProvider(p.sourceProvider)?.label || p.sourceProvider,
        register: licenceRegisterName(p.sourceProvider),
        licenceNumber: p.licenceNumber || p.sourceRecordId,
        // The licence's authorisations in words, not codes.
        categories: describeSourceCategories(p.sourceProvider, p.sourceCategories),
        classificationReason: p.classificationReason,
        status: p.status,
        classification: p.classification,
        tradeKey: p.tradeKey,
        tradeLabel: p.tradeKey ? discoveryTradeLabel(p.tradeKey) : null,
        reasons: reviewReasonsOf(p),
        deferred: Boolean(p.reviewDeferredAt),
        campaign: p.campaign,
        suggestions,
        retailWord,
        duplicateOf: other
          ? { id: other.id, businessName: other.businessName, city: other.city, status: other.status, tradeKey: other.tradeKey }
          : p.possibleDuplicateOfId
            ? { id: p.possibleDuplicateOfId, businessName: null, city: null, status: null, tradeKey: null }
            : null,
      };
    }),
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const result = await reviewDecide({
    db,
    prospectId: body?.prospectId,
    decision: String(body?.decision ?? "").trim(),
    tradeKey: typeof body?.tradeKey === "string" ? body.tradeKey.trim() : null,
    adminId: admin.id,
    now: new Date(),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, ...result });
}
