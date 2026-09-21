// lib/sales/intel/bbbBatch.js
//
// Which prospects a BBB browser run visits, and in what order. Shared by
// the route (for a file-based run) and the script (direct).
import { db as defaultDb } from "@/lib/db";
import { ENRICHMENT_TIERS, loadEnrichmentOrder } from "./enrichmentOrder";
import { BBB_RECHECK_DAYS } from "./listingMatch";
import { bbbSearchUrlFor } from "./bbbProfile";
import { registerLicenceNumber } from "./registerPeople";

export const BBB_BATCH_SELECT = Object.freeze({
  id: true,
  businessName: true,
  tradingNames: true,
  city: true,
  province: true,
  country: true,
  postalCode: true,
  addressLine: true,
  phoneE164: true,
  domain: true,
  websiteUrl: true,
  licenceNumber: true,
  sourceRecordId: true,
  sourceProvider: true,
  tradeKey: true,
  bbbCheckedAt: true,
  bbbProfileUrl: true,
  assignedRepId: true,
  latitude: true,
  longitude: true,
});

function shape(p) {
  return {
    id: p.id,
    businessName: p.businessName,
    tradingNames: p.tradingNames || [],
    city: p.city,
    province: p.province,
    country: p.country,
    postalCode: p.postalCode,
    addressLine: p.addressLine,
    phoneE164: p.phoneE164,
    domain: p.domain,
    websiteUrl: p.websiteUrl,
    licenceNumber: registerLicenceNumber(p),
    sourceProvider: p.sourceProvider,
    tradeKey: p.tradeKey,
    latitude: p.latitude === null ? null : Number(p.latitude),
    longitude: p.longitude === null ? null : Number(p.longitude),
    bbbCheckedAt: p.bbbCheckedAt,
    bbbProfileUrl: p.bbbProfileUrl,
    searchUrl: bbbSearchUrlFor({ businessName: p.businessName, city: p.city, province: p.province }),
  };
}

/**
 * @param scope   "claimed" — every open claim; "next" — the trades being
 *                worked in dispatch order (tier 2 after tier 1); "ids" — the
 *                given ids, in the given order, whatever their state
 * @param regions two-letter states/provinces to keep the batch inside, or
 *                null for everywhere — enrichmentOrder.js's regional pass.
 *                Ignored for "ids": a person naming a row gets that row.
 * @returns { rows, tier counts, skippedRecent, regions, outsideRegions }
 */
export async function bbbBatch({ db = defaultDb, scope = "claimed", limit = 60, ids = [], now = new Date(), regions = null } = {}) {
  const since = new Date(now.getTime() - BBB_RECHECK_DAYS * 24 * 60 * 60 * 1000);
  if (scope === "ids") {
    const rows = await db.prospect.findMany({ where: { id: { in: ids } }, select: BBB_BATCH_SELECT });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return { scope, rows: ids.map((id) => byId.get(id)).filter(Boolean).map(shape), skippedRecent: 0 };
  }
  const order = await loadEnrichmentOrder({ db, now, stampField: "bbbCheckedAt", since, regions });
  const wanted = order.rows.filter((r) => (scope === "claimed" ? r.tier === ENRICHMENT_TIERS.CLAIMED : true));
  const fresh = wanted.filter((r) => !r.done);
  const take = fresh.slice(0, limit);
  const rows = take.length ? await db.prospect.findMany({ where: { id: { in: take.map((r) => r.id) } }, select: BBB_BATCH_SELECT }) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    scope,
    rows: take.map((r) => ({ ...shape(byId.get(r.id) || { id: r.id }), tier: r.tier, rank: r.rank, reason: r.reason })).filter((r) => r.businessName),
    skippedRecent: wanted.length - fresh.length,
    remaining: Math.max(0, fresh.length - take.length),
    claimed: order.claimed,
    regions: order.regions || null,
    outsideRegions: order.outsideRegions || { claimed: 0, candidates: 0 },
  };
}
