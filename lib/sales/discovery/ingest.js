// lib/sales/discovery/ingest.js
//
// The one file here that touches the database.
//
// ══ The split, and why it is worth the extra file ══════════════════════════
//
// Everything that DECIDES anything — what trade this is, whether it is a shop,
// what its phone number normalises to, whether we already hold it — lives in
// the pure modules beside this one and is executed against hostile input by
// scripts/check-sales-discovery.mjs. This file loads rows, hands them to those
// functions, and writes what they decided. It is the shape
// lib/marketing/jobPhotoContext.js uses, for the same reason its header gives:
// the real bugs are in the decisions, and decisions wrapped in a query cannot
// be run against a hostile fixture.
//
// `db` is taken as an argument rather than imported at the call site, matching
// lib/sales/suppression.js and lib/marketing/unsubscribe.js.
//
// ══ Why the whole page is one transaction ══════════════════════════════════
//
// Prospects, their evidence and the campaign's counters are written together
// or not at all. The alternative — write rows, then update counters — drifts
// the moment an invocation dies between the two, and the drift is invisible:
// the funnel would show 400 accepted against 460 rows and nobody would know
// which number was wrong. A funnel that does not reconcile is worse than none.
//
// The unique index on (sourceProvider, sourceRecordId) is the actual dedupe
// guarantee, not the lookup below. Two overlapping cron ticks both read, both
// see nothing, and both insert — so the index refuses the second, the
// transaction rolls back, the runner retries, and the retry finds the row and
// takes the update path instead. `skipDuplicates` was rejected deliberately:
// it would have swallowed the collision and counted a row as accepted that was
// never written.
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { classifyBusiness } from "./classify";
import { buildDedupeIndex, matchExisting } from "./dedupe";
import { isCallReady, normaliseBusiness } from "./normalise";
import { shapeProblems } from "./provider";
import { tradeForCategories } from "./trades";

/** Bumped when the ingest changes what it extracts, so evidence stays honest. */
export const INGEST_VERSION = "1";

/** How many prospects a batch may collide with. Bounds the lookup. */
const MAX_DEDUPE_CANDIDATES = 5000;

/**
 * Decide what happens to each business, without writing anything.
 *
 * Pure apart from the index it is handed. Exported so the check can drive a
 * whole page of hostile rows and assert the outcomes and the counter deltas
 * together — which is the only way to catch a funnel that stops adding up.
 *
 * @param {object[]} businesses  DiscoveredBusiness rows from a provider
 * @param {{ provider:string, release:string|null, tradeKey:string|null,
 *           campaignId:string|null, territoryId:string|null }} context
 * @param {object} index         from buildDedupeIndex
 * @returns {{ plans: object[], counters: object }}
 */
export function planIngest(businesses = [], context = {}, index = null) {
  const plans = [];
  const counters = {
    foundCount: 0,
    unmappedCount: 0,
    duplicateCount: 0,
    rejectedCount: 0,
    needsReviewCount: 0,
    acceptedCount: 0,
    readyCount: 0,
    noWebsiteCount: 0,
  };

  for (const business of Array.isArray(businesses) ? businesses : []) {
    counters.foundCount++;

    // ── Not usable for this campaign ──────────────────────────────────────
    //
    // One bucket, three reasons, all of them "this row cannot go into this
    // queue": the provider handed back something malformed, the source's
    // category maps to no FieldQuo trade, or it maps to a DIFFERENT trade.
    // The third is the one that looks like over-strictness and is not: a
    // single-trade queue is the whole point of the campaign (see trades.js),
    // and one roofer in a painting queue is what makes a rep stop trusting it.
    if (shapeProblems(business).length) {
      counters.unmappedCount++;
      plans.push({ action: "skip", reason: "malformed", business });
      continue;
    }

    const { tradeKey } = tradeForCategories(business.categories || {});
    if (!tradeKey || (context.tradeKey && tradeKey !== context.tradeKey)) {
      counters.unmappedCount++;
      plans.push({ action: "skip", reason: tradeKey ? "other_trade" : "no_trade", business, tradeKey });
      continue;
    }

    // ── Contractor, shop, or a question ───────────────────────────────────
    const verdict = classifyBusiness(business);
    if (verdict.classification === "retailer") {
      counters.rejectedCount++;
      plans.push({ action: "skip", reason: "retailer", business, verdict });
      continue;
    }

    const shaped = normaliseBusiness(business, {
      provider: context.provider ?? null,
      release: context.release ?? null,
      tradeKey,
      classification: verdict.classification,
      classificationReason: verdict.reason,
    });
    if (!shaped.ok) {
      counters.unmappedCount++;
      plans.push({ action: "skip", reason: shaped.problems.join(","), business });
      continue;
    }

    const prospect = shaped.prospect;
    const match = matchExisting(prospect, index);

    if (match.action === "update") {
      counters.duplicateCount++;
      plans.push({ action: "update", id: match.matchedId, prospect, facts: shaped.facts, verdict, business });
      continue;
    }

    const id = randomUUID();
    const row = {
      id,
      ...prospect,
      campaignId: context.campaignId ?? null,
      territoryId: context.territoryId ?? null,
      // needs_review rows are written and held OUT of every rep's queue until
      // a human decides. That is what makes the third verdict a real state
      // rather than a bin — see classify.js.
      status: verdict.classification === "needs_review" ? "needs_review" : "discovered",
      possibleDuplicateOfId: match.action === "flag" ? match.matchedId : null,
    };

    if (verdict.classification === "needs_review") counters.needsReviewCount++;
    else {
      counters.acceptedCount++;
      if (isCallReady(prospect)) counters.readyCount++;
      // "The source listed no website", never "this business has no website".
      if (!prospect.websiteUrl) counters.noWebsiteCount++;
    }

    plans.push({
      action: "insert",
      id,
      row,
      facts: shaped.facts,
      verdict,
      duplicateVia: match.action === "flag" ? match.via : null,
      business,
    });

    // So a page dedupes against itself: two copies of one business inside one
    // snapshot must not both arrive as fresh inserts.
    if (index?.add) index.add(row);
  }

  return { plans, counters };
}

/**
 * The ProspectEvidence rows one ingested business produces.
 *
 * ══ What makes this answerable a year later ═══════════════════════════════
 *
 * `source` is the provider. `detector` is the CONTRIBUTING DATASET inside it —
 * meta, Microsoft, Foursquare — and `detectorVersion` is the release. Together
 * with `sourceUrl`, which is the release's actual places path, that is enough
 * to go back to the file the value came from and find the record. The schema
 * comment asks for exactly this: without the version, an improvement to a
 * detector silently rewrites history, and for a directory source the "detector
 * version" that matters is which month's data was read.
 */
export function evidenceRows({ prospectId, facts = [], provider, release, dataset, sourceUrl, observedAt }) {
  return facts.map((fact) => ({
    prospectId,
    type: "source_field",
    source: provider,
    sourceUrl: sourceUrl || null,
    rawValue: fact.raw ?? null,
    normalizedValue: fact.normalized ?? null,
    observedAt: observedAt || new Date(),
    // 1.0 because this is not a judgement: the directory said this. Whether
    // the directory is RIGHT is a different question, answered by
    // Prospect.sourceConfidence and Prospect.sourceUpdatedAt, neither of which
    // belongs in a per-fact confidence.
    confidence: 1.0,
    detector: dataset ? `${provider}:${dataset}` : provider,
    detectorVersion: release || null,
  }));
}

/**
 * Load the rows this page could collide with.
 *
 * Four lookups in one query, matching dedupe.js's four keys. The fuzzy one is
 * scoped to the same trade AND the same set of localities, because an
 * unscoped name lookup would load every prospect FieldQuo has ever held.
 */
export async function loadDedupeCandidates({ prospects, provider }, { deps = {} } = {}) {
  const prisma = deps.db || db;
  const recordIds = [...new Set(prospects.map((p) => p.sourceRecordId).filter(Boolean))];
  const phones = [...new Set(prospects.map((p) => p.phoneE164).filter(Boolean))];
  const domains = [...new Set(prospects.map((p) => p.domain).filter(Boolean))];
  const cities = [...new Set(prospects.map((p) => p.city).filter(Boolean))];
  const trades = [...new Set(prospects.map((p) => p.tradeKey).filter(Boolean))];

  const or = [];
  if (recordIds.length) or.push({ sourceProvider: provider, sourceRecordId: { in: recordIds } });
  if (phones.length) or.push({ phoneE164: { in: phones } });
  if (domains.length) or.push({ domain: { in: domains } });
  if (cities.length && trades.length) or.push({ city: { in: cities }, tradeKey: { in: trades } });
  if (!or.length) return [];

  return prisma.prospect.findMany({
    where: { OR: or },
    select: {
      id: true,
      sourceProvider: true,
      sourceRecordId: true,
      phoneE164: true,
      domain: true,
      businessName: true,
      city: true,
    },
    // Oldest first, so the row everything else flags as its possible duplicate
    // is the original rather than whichever copy the database happened to
    // return first.
    orderBy: { createdAt: "asc" },
    take: MAX_DEDUPE_CANDIDATES,
  });
}

/**
 * Write one page.
 *
 * @returns {{ inserted:number, updated:number, skipped:number, counters:object }}
 */
export async function ingestPage(
  { campaign, territory = null, businesses = [], provider, release, sourceUrl = null, now = new Date() },
  { deps = {} } = {},
) {
  const prisma = deps.db || db;

  // Shape everything first so the dedupe lookup can be built from normalised
  // keys. Deduplicating on raw strings would miss 45% of the sample outright:
  // that is the share of phones Overture spells as bare digits.
  const previews = [];
  for (const business of Array.isArray(businesses) ? businesses : []) {
    if (shapeProblems(business).length) continue;
    const { tradeKey } = tradeForCategories(business.categories || {});
    if (!tradeKey) continue;
    const shaped = normaliseBusiness(business, { provider, release, tradeKey });
    if (shaped.ok) previews.push(shaped.prospect);
  }

  const existing = previews.length
    ? await loadDedupeCandidates({ prospects: previews, provider }, { deps })
    : [];
  const index = buildDedupeIndex(existing);

  const { plans, counters } = planIngest(
    businesses,
    {
      provider,
      release,
      tradeKey: campaign?.tradeKey || null,
      campaignId: campaign?.id || null,
      territoryId: campaign?.territoryId || territory?.id || null,
    },
    index,
  );

  const inserts = plans.filter((p) => p.action === "insert");
  const updates = plans.filter((p) => p.action === "update");

  if (!inserts.length && !updates.length) {
    // Still record what the page found. A page that was all shops is a real
    // finding and the funnel has to show it, or a campaign that rejects
    // everything looks like a campaign that is not running.
    if (campaign?.id && counters.foundCount) {
      await prisma.prospectCampaign.update({
        where: { id: campaign.id },
        data: incrementsFrom(counters),
      });
    }
    return { inserted: 0, updated: 0, skipped: plans.length, counters };
  }

  const evidence = [];
  for (const plan of inserts) {
    evidence.push(
      ...evidenceRows({
        prospectId: plan.id,
        facts: plan.facts,
        provider,
        release,
        dataset: plan.row.sourceDataset,
        sourceUrl: plan.business?.sourceUrl || sourceUrl,
        observedAt: now,
      }),
    );
  }

  await prisma.$transaction(async (tx) => {
    if (inserts.length) {
      await tx.prospect.createMany({ data: inserts.map((p) => p.row) });
    }
    if (evidence.length) {
      await tx.prospectEvidence.createMany({ data: evidence });
    }
    for (const plan of updates) {
      // A re-run REFRESHES the source's own fields and touches nothing a human
      // or a later stage owns. Not `...plan.prospect`: that would reset
      // `classification` after a superadmin had corrected it, and would clear
      // `hasWebsite` back to null after the crawler had answered it.
      await tx.prospect.update({
        where: { id: plan.id },
        data: {
          businessName: plan.prospect.businessName,
          rawName: plan.prospect.rawName,
          phoneE164: plan.prospect.phoneE164,
          domain: plan.prospect.domain,
          websiteUrl: plan.prospect.websiteUrl,
          addressLine: plan.prospect.addressLine,
          city: plan.prospect.city,
          province: plan.prospect.province,
          postalCode: plan.prospect.postalCode,
          country: plan.prospect.country,
          latitude: plan.prospect.latitude,
          longitude: plan.prospect.longitude,
          sourceCategories: plan.prospect.sourceCategories,
          businessStatus: plan.prospect.businessStatus,
          sourceRelease: plan.prospect.sourceRelease,
          sourceDataset: plan.prospect.sourceDataset,
          sourceConfidence: plan.prospect.sourceConfidence,
          sourceUpdatedAt: plan.prospect.sourceUpdatedAt,
        },
      });
    }
    if (campaign?.id) {
      await tx.prospectCampaign.update({
        where: { id: campaign.id },
        data: incrementsFrom(counters),
      });
    }
  });

  return {
    inserted: inserts.length,
    updated: updates.length,
    skipped: plans.length - inserts.length - updates.length,
    counters,
  };
}

/**
 * Counter deltas as Prisma increments.
 *
 * `{ increment: n }` rather than a read and a write. Two discovery tasks for
 * one campaign can run in the same tick, and a read-modify-write would lose
 * one of them — the same reason lib/voice/autoTopup.js does not read a balance
 * before changing it.
 */
function incrementsFrom(counters) {
  const data = {};
  for (const [key, value] of Object.entries(counters)) {
    if (value) data[key] = { increment: value };
  }
  return data;
}
