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
import { DERIVED_SITE_INFERENCE_KIND } from "@/lib/sales/inferenceKinds";
import { isCallReady, normaliseBusiness } from "./normalise";
import { shapeProblems } from "./provider";
import { campaignTradeScope, tradeForCategories } from "./trades";

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
 *        `tradeKey: null` is the all-trades campaign — every trade is banked
 *        and nothing is skipped for being the wrong one. It is derived by
 *        ingestPage() from campaignTradeScope() and is never read off the
 *        campaign row here, so "all trades" and "nobody chose a trade" cannot
 *        arrive at this function as the same value.
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
    bankedCount: 0,
  };

  for (const business of Array.isArray(businesses) ? businesses : []) {
    counters.foundCount++;

    // ── Not usable for this campaign ──────────────────────────────────────
    //
    // Two conditions that used to be one, and separating them is the whole of
    // this edit. The single-trade rule is about the QUEUE, not about the bank:
    // a rep who opens a painting script on a roofer stops trusting the queue,
    // and that is a statement about what a rep may be HANDED, not about what
    // FieldQuo may KNOW. STATUS.md already separates the two — the bank is
    // large and cheap (`status: discovered`), the worked set is what a campaign
    // promotes into crawling and analysis.
    //
    //   maps to a DIFFERENT trade   skipped outright WHEN THE CAMPAIGN NAMES A
    //                               TRADE. That row belongs to another trade's
    //                               campaign and writing it here would file it
    //                               under this campaign and its territory,
    //                               which is a claim about it that nobody made.
    //
    //                               `context.tradeKey` being null is the
    //                               all-trades campaign, and there is then no
    //                               "different" trade to be: the roofer is
    //                               written with ITS OWN trade key and counted
    //                               as ACCEPTED, not banked. `bankedCount`
    //                               stays exactly "kept without a trade" — a
    //                               roofer with a trade is a real prospect,
    //                               callable from the ROOFING queue and from
    //                               no other, because claimCandidateWhere()
    //                               filters on an exact trade key and knows
    //                               nothing about which campaign wrote a row.
    //                               ingestPage() below is the ONE place that
    //                               decides which mode this is, from
    //                               campaignTradeScope().
    //   maps to NO trade            written to the bank with `tradeKey: null`.
    //                               It is not queue-eligible and cannot become
    //                               so by accident: claimCandidateWhere() in
    //                               lib/sales/prospectView.js filters on an
    //                               exact trade key and substitutes "__none__"
    //                               when it is given nothing, so a null-trade
    //                               row matches no queue at all. A trade is
    //                               established later, from the business's own
    //                               website, by lib/sales/intel/tradeDetect.js.
    //
    // A malformed row is neither: there is nothing to bank.
    if (shapeProblems(business).length) {
      counters.unmappedCount++;
      plans.push({ action: "skip", reason: "malformed", business });
      continue;
    }

    const { tradeKey } = tradeForCategories(business.categories || {});
    if (tradeKey && context.tradeKey && tradeKey !== context.tradeKey) {
      counters.unmappedCount++;
      plans.push({ action: "skip", reason: "other_trade", business, tradeKey });
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
    else if (!prospect.tradeKey) {
      // Written, and NOT accepted. The distinction is the funnel's, and it is
      // load-bearing in two places: campaignProgress() measures a target
      // against `acceptedCount`, so counting these would let a campaign for
      // 1,000 painters report itself finished having produced no painter at
      // all; and `readyCount`/`noWebsiteCount` are declared subsets of
      // accepted, so counting a row in one without the other breaks the
      // invariant funnelProblems() checks.
      //
      // `unmappedCount` still counts it, and its label is still exactly true —
      // "not usable for THIS campaign". `bankedCount` is the subset of that
      // which was nonetheless written, so a superadmin can tell "the trade map
      // has a gap and we kept 54,000 rows" from "we threw 54,000 rows away".
      counters.unmappedCount++;
      counters.bankedCount++;
    } else {
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
      // ── The guessed website, carried as a plan and not as a column ───────
      //
      // On INSERT only, and deliberately not on the update path. An update
      // means this business is already held — very possibly from a source that
      // published a real website — and writing "we think their site is X" over
      // a record that already knows its site is X is at best noise and at
      // worst a second, staler answer to a question already settled. The
      // update path's own comment makes the same argument about `hasWebsite`.
      derivedWebsite: shaped.derivedWebsite || null,
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
  // The same name+locality lookup for the rows that have no trade. `tradeKey:
  // { in: [...] }` cannot express "and also the null ones" — Prisma's `in`
  // never matches NULL — so a second branch is the only way to keep the fuzzy
  // key working for a register import, where EVERY row is trade-less and the
  // branch above would therefore never be built at all.
  if (cities.length && prospects.some((p) => !p.tradeKey)) {
    or.push({ city: { in: cities }, tradeKey: null });
  }
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
    // No `if (!tradeKey) continue` here any more. A trade-less row is now
    // written, so it has to be in the dedupe lookup too — leaving it out would
    // make every re-run of a register import collide with the unique index and
    // roll the whole page back.
    const shaped = normaliseBusiness(business, { provider, release, tradeKey });
    if (shaped.ok) previews.push(shaped.prospect);
  }

  const existing = previews.length
    ? await loadDedupeCandidates({ prospects: previews, provider }, { deps })
    : [];
  const index = buildDedupeIndex(existing);

  // The one place a campaign's two trade columns become one answer. Not
  // `campaign.tradeKey || null`: an all-trades campaign that also carried a
  // stale trade key would have kept filtering on it, and the screen and the
  // ingest would have disagreed about what the campaign was doing.
  const scope = campaignTradeScope(campaign || {});

  const { plans, counters } = planIngest(
    businesses,
    {
      provider,
      release,
      tradeKey: scope.tradeKey,
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
    // ── The derived-website hypothesis ────────────────────────────────────
    //
    // Inside the SAME transaction as the prospect and its evidence, so an
    // inference can never cite a row that was not written — the discipline
    // analyzeCapabilities.js's writeTrade() applies for the same reason.
    //
    // A ProspectInference, never a Prospect column. `Prospect.websiteUrl` means
    // "the source published this"; the Régie published no such thing, and
    // lib/sales/discovery/rbq/derivedSite.js's header sets out the two ways
    // that distinction could quietly be lost. The evidence row carries the
    // address it was derived from, so a rep reading the screen can disagree
    // with the guess without re-deriving it.
    for (const plan of inserts) {
      const derived = plan.derivedWebsite;
      if (!derived?.domain) continue;
      const evidenceRow = await tx.prospectEvidence.create({
        data: {
          prospectId: plan.id,
          type: "derived_site",
          source: provider,
          sourceUrl: plan.business?.sourceUrl || sourceUrl || null,
          rawValue: derived.statement.slice(0, 2000),
          normalizedValue: derived.domain,
          observedAt: now,
          // NOT 1.0. The evidenceRows() above use 1.0 because "the directory
          // said this" is not a judgement; this one IS a judgement, and a
          // guess recorded at the same confidence as a published field is the
          // fact/inference boundary erased in the confidence column.
          confidence: 0.5,
          detector: `${provider}:${derived.basis}`,
          detectorVersion: release || null,
        },
        select: { id: true },
      });
      // One object for both branches, the shape analyzeCapabilities.js's
      // writeTrade() uses. Spelling the fields out twice is failure class 4
      // with a specific consequence here: the `update` branch is the one that
      // runs on a re-ingest, which is the one nobody exercises by hand, so it
      // is the copy that would rot — and a mutation test caught exactly that,
      // silently changing the update branch while every assertion about the
      // create branch stayed green.
      const inference = {
        value: derived.domain,
        // 0.5, and never null. A null confidence is not a low confidence, it
        // is no statement at all; and 0 reads as "we are certain this is
        // wrong". This is a hypothesis worth crawling and not worth acting on,
        // which is the middle of the scale.
        confidence: 0.5,
        evidenceIds: [evidenceRow.id],
        source: "derived",
        observedAt: now,
      };
      await tx.prospectInference.upsert({
        where: { prospectId_kind: { prospectId: plan.id, kind: DERIVED_SITE_INFERENCE_KIND } },
        update: inference,
        create: { prospectId: plan.id, kind: DERIVED_SITE_INFERENCE_KIND, ...inference },
      });
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
