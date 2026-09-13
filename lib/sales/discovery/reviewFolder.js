// lib/sales/discovery/reviewFolder.js
//
// The Review folder: every prospect that needs a human, across every campaign,
// and what each decision does to the row and to its campaign's funnel.
//
// ══ Why one folder and not a panel per campaign ════════════════════════════
//
// /platform/sales/campaigns/[id] has had a "Needs review" list since the
// classifier learned to say "I don't know". It shows twenty rows of one
// campaign. What it cannot show is the population the owner actually has to
// work through: measured 2026-09-11, 39,654 RBQ rows in needs_review, 9,505
// RBQ contractors banked with no trade, ~68,000 California licences banked
// the same way. None can be dialled — the queue claims by exact trade key —
// and a per-campaign panel of twenty is not a tool for 117,000 decisions.
//
// The owner's instruction, verbatim: "you can put it in a review folder..
// where we can manually select the trade". So: one screen, three reasons a
// row is in it, filters that carve the pile into runs a person can clear in
// one sitting ("every RBQ row in Laval whose name says toiture"), three
// suggested trades on every row with the reason for each, and a bulk assign
// for the runs where the filter itself is the decision.
//
// ══ The three reasons ══════════════════════════════════════════════════════
//
//   no_trade    classification contractor, tradeKey null, status claimable.
//               The bank. Contractors, by the register's word, that no queue
//               can reach until a trade is chosen.
//   unclear     status needs_review — the classifier could not say contractor
//               or shop. Overture rows mostly, since licence-register rows
//               now classify as contractor at ingest (licenceRegisters.js).
//   duplicate   possibleDuplicateOfId set. Flagged, never merged; a human
//               says "same business" or "keep".
//
// A row can carry two reasons at once (needs_review AND flagged). The folder
// shows it once; the reason filter narrows to rows carrying that reason.
//
// ══ What is NOT in the folder ══════════════════════════════════════════════
//
// A row a rep currently holds, and a do-not-contact row. Neither needs a
// human here: the first is with a human already, and the second was decided.
// They are excluded from the base query AND re-excluded in every write's
// where clause, because "the list didn't show it" is not a write guard.
//
// ══ The counters move with the row ════════════════════════════════════════
//
// Every decision is expressed as a delta on the campaign's funnel counters,
// computed by `decisionEffects` from the row as READ and applied in the same
// transaction as the row's update. found = unmapped + duplicates + rejected +
// needsReview + accepted has to keep holding — funnelProblems() in funnel.js
// says so on the campaign screen the moment it does not — and the only way
// it keeps holding is if every move out of one bucket is a move into
// another. A banked row (counted in unmapped AND banked) that gets a trade
// leaves both and enters accepted; a needs_review row that gets one leaves
// needsReview and enters accepted. Read the table in `decisionEffects`.
//
// ══ Pure, and why ══════════════════════════════════════════════════════════
//
// Nothing here touches the database. The route builds a where clause from
// `reviewWhereSql`, reads rows, hands each to `decisionEffects`, and writes
// what it decided. scripts/check-review-folder.mjs drives the effects table
// with fixtures and asserts the counters balance for every (bucket, decision)
// pair, which is the assertion that cannot be made from inside a route.

import { Prisma } from "@prisma/client";
import { isCallReady } from "./normalise";
import { isDiscoveryTradeKey, discoveryTradeLabel } from "./trades";
import { nameKeywordPgRegex, retailWordPgRegex } from "./tradeSuggest";
import { SUGGESTED_GROUPS } from "./suggestedGroups";
import { CLAIMABLE_STATUSES } from "@/lib/sales/prospectView";

/** Rows a screen shows at once. The same 50 as /platform/sales/prospects. */
export const REVIEW_PAGE_SIZE = 50;

/** The three reasons, with the label the filter and the row chip show. */
export const REVIEW_REASONS = Object.freeze({
  no_trade: { label: "No trade", note: "A contractor with no trade — in nobody's queue until one is chosen." },
  unclear: { label: "Unclear contractor / shop", note: "The classifier could not tell a contractor from a shop." },
  duplicate: { label: "Possible duplicate", note: "Flagged as possibly the same business as another row." },
});

export const REVIEW_DECISIONS = Object.freeze(["accept", "reject", "duplicate", "skip"]);

/** Statuses a folder row may be in. Anything else has left the funnel. */
export const REVIEW_STATUSES = Object.freeze([...CLAIMABLE_STATUSES, "needs_review"]);

const CLAIMABLE = new Set(CLAIMABLE_STATUSES);

// ── The filter ────────────────────────────────────────────────────────────

function trimmed(value, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * A filter, from a URLSearchParams-like `get(name)` or a plain object.
 *
 * Unknown values fall to "no filter" rather than to an error: the folder is
 * navigated by URL and a stale bookmark should show the folder, not a 400.
 */
export function parseReviewFilter(source = {}) {
  const get = (k) => (typeof source?.get === "function" ? source.get(k) : source?.[k]);
  const reason = trimmed(get("reason"), 20);
  const website = trimmed(get("website"), 10);
  const retail = trimmed(get("retail"), 10);
  const suggested = trimmed(get("suggested"), 40);
  // Explicit ids arrive only in a POST body (the By-suggestion page's
  // checked rows); a URL never carries them. At most a page's worth, so a
  // bulk over ids is a bulk over what one screen showed.
  const rawIds = get("ids");
  const ids = Array.isArray(rawIds)
    ? [...new Set(rawIds.filter((v) => typeof v === "string").map((v) => v.trim()).filter((v) => v && v.length <= 40))].slice(0, REVIEW_PAGE_SIZE)
    : [];
  return {
    campaignId: trimmed(get("campaignId"), 40) || null,
    source: trimmed(get("source"), 40) || null,
    province: trimmed(get("province"), 10).toUpperCase() || null,
    reason: Object.prototype.hasOwnProperty.call(REVIEW_REASONS, reason) ? reason : null,
    q: trimmed(get("q"), 80) || null,
    website: website === "yes" || website === "no" ? website : null,
    // "yes" narrows to names carrying a shop word — the filter behind
    // "Reject all matching". Nothing else is accepted, so a typo cannot
    // widen a bulk reject.
    retail: retail === "yes" ? "yes" : null,
    // A By-suggestion group: a trade key ("hvac"), or one of the fixed
    // groups in suggestedGroups.js. Anything else is no filter.
    suggested: isSuggestedGroupKey(suggested) ? suggested : null,
    ids: ids.length ? ids : null,
  };
}

function isSuggestedGroupKey(key) {
  return Boolean(key) && (isDiscoveryTradeKey(key) || Object.prototype.hasOwnProperty.call(SUGGESTED_GROUPS, key));
}

/**
 * The reason clauses, as SQL. Exported so the check can read them, and so
 * suggestTradesBatch.js selects the folder's own population without the
 * untouchable guard (a suggestion is not a decision; see its header).
 */
export function reviewReasonSql(reason) {
  const claimable = Prisma.join(CLAIMABLE_STATUSES);
  const noTrade = Prisma.sql`("classification" = 'contractor' AND "tradeKey" IS NULL AND "status" IN (${claimable}))`;
  const unclear = Prisma.sql`("status" = 'needs_review')`;
  const duplicate = Prisma.sql`("possibleDuplicateOfId" IS NOT NULL AND "status" IN (${Prisma.join(REVIEW_STATUSES)}))`;
  if (reason === "no_trade") return noTrade;
  if (reason === "unclear") return unclear;
  if (reason === "duplicate") return duplicate;
  return Prisma.sql`(${noTrade} OR ${unclear} OR ${duplicate})`;
}

/**
 * The guard every folder query and every folder WRITE carries: not
 * do-not-contact, not held by a rep right now. A lapsed claim is not a
 * claim — lib/sales/prospectView.js's claimCandidateWhere draws the same
 * line, and a folder that disagreed with the queue about who holds a row
 * would let two humans act on it at once.
 */
export function untouchableGuardSql(now = new Date()) {
  return Prisma.sql`"doNotContactAt" IS NULL AND ("assignedRepId" IS NULL OR "claimExpiresAt" < ${now})`;
}

/** The same guard as a Prisma where, for the writes. */
export function untouchableGuardWhere(now = new Date()) {
  return { doNotContactAt: null, OR: [{ assignedRepId: null }, { claimExpiresAt: { lt: now } }] };
}

/**
 * WHERE for the folder, as one SQL fragment used by the count, the page and
 * the bulk select — so the three cannot disagree about what "matching this
 * filter" means. Raw rather than a Prisma where because two of the clauses
 * are regexes (the shop-word filter, and the decidability sort in
 * `reviewOrderSql`) and Prisma's query API cannot express a regex.
 */
export function reviewWhereSql(filter = {}, { now = new Date() } = {}) {
  const f = { ...parseReviewFilter({}), ...filter };
  const parts = [untouchableGuardSql(now), reviewReasonSql(f.reason)];
  if (f.campaignId) parts.push(Prisma.sql`"campaignId" = ${f.campaignId}`);
  if (f.source) parts.push(Prisma.sql`"sourceProvider" = ${f.source}`);
  if (f.province) parts.push(Prisma.sql`"province" = ${f.province}`);
  if (f.website === "yes") parts.push(Prisma.sql`"websiteUrl" IS NOT NULL`);
  if (f.website === "no") parts.push(Prisma.sql`"websiteUrl" IS NULL`);
  if (f.retail === "yes") parts.push(Prisma.sql`"businessName" ~* ${retailWordPgRegex()}`);
  if (f.suggested) parts.push(suggestedGroupSql(f.suggested));
  if (f.ids) parts.push(Prisma.sql`"id" IN (${Prisma.join(f.ids)})`);
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    parts.push(
      Prisma.sql`("businessName" ILIKE ${like} OR "phoneE164" LIKE ${like} OR "licenceNumber" ILIKE ${like} OR EXISTS (SELECT 1 FROM unnest("tradingNames") tn WHERE tn ILIKE ${like}))`,
    );
  }
  return Prisma.join(parts, " AND ");
}

/**
 * Most decidable first.
 *
 *   1. rows nobody has passed on yet, before the ones a reviewer skipped
 *   2. names carrying a trade word (the same keyword table tradeSuggest.js
 *      suggests from, compiled to a Postgres regex) — a suggestion exists
 *   3. rows with a website, because a crawl may have read a trade off it
 *   4. oldest first, then id, so paging is stable
 */
export function reviewOrderSql(filter = {}) {
  // A By-suggestion group is already "the rows with a suggestion"; the
  // keyword regex would re-derive that over a 160,000-row "no suggestion"
  // group at ~9 s a page. Name order instead: a reviewer reading fifty
  // names to confirm a trade reads them faster alphabetised.
  if (filter?.suggested) return Prisma.sql`("reviewDeferredAt" IS NOT NULL) ASC, "businessName" ASC, "id" ASC`;
  return Prisma.sql`("reviewDeferredAt" IS NOT NULL) ASC, ("businessName" ~* ${nameKeywordPgRegex()}) DESC, ("websiteUrl" IS NOT NULL) DESC, "createdAt" ASC, "id" ASC`;
}

// ── The By-suggestion groups ──────────────────────────────────────────────

/**
 * WHERE for one By-suggestion group. The groups are disjoint and, with the
 * pending and current-only remainders, cover every non-duplicate folder row —
 * the check asserts both, because a row in two groups would be accepted
 * twice and a row in none would be invisible.
 *
 * Flagged duplicates are in NO group. "Same business or not" is a different
 * question from "which trade", and a bulk accept clears the flag (the accept
 * effects say "keep it, it is a real prospect"), so a name-based batch must
 * not be the thing that answers it. They stay in the row-by-row mode with
 * their duplicate panel.
 */
export function suggestedGroupSql(key) {
  const noDup = Prisma.sql`"possibleDuplicateOfId" IS NULL`;
  const notShop = Prisma.sql`"suggestedNotContractor" IS NOT TRUE`;
  const shop = Prisma.sql`"suggestedNotContractor" = TRUE`;
  const computed = Prisma.sql`"suggestedAt" IS NOT NULL`;
  const tradeless = Prisma.sql`"tradeKey" IS NULL`;
  const hasTrade = Prisma.sql`"tradeKey" IS NOT NULL`;
  if (isDiscoveryTradeKey(key)) {
    return Prisma.sql`(${noDup} AND ${tradeless} AND ${notShop} AND "suggestedTradeKey" = ${key})`;
  }
  switch (key) {
    case "agree":
      return Prisma.sql`(${noDup} AND ${hasTrade} AND ${notShop} AND "tradeKey" = ANY("suggestedTradeKeys"))`;
    case "conflict":
      return Prisma.sql`(${noDup} AND ${hasTrade} AND ${notShop} AND "suggestedTradeKey" IS NOT NULL AND NOT ("tradeKey" = ANY("suggestedTradeKeys")))`;
    case "mixed":
      return Prisma.sql`(${noDup} AND ${shop} AND cardinality("suggestedTradeKeys") > 0)`;
    case "not_contractor":
      return Prisma.sql`(${noDup} AND ${shop} AND cardinality("suggestedTradeKeys") = 0)`;
    case "none":
      return Prisma.sql`(${noDup} AND ${tradeless} AND ${computed} AND ${notShop} AND "suggestedTradeKey" IS NULL)`;
    case "current_only":
      return Prisma.sql`(${noDup} AND ${hasTrade} AND ${computed} AND ${notShop} AND "suggestedTradeKey" IS NULL)`;
    case "pending":
      return Prisma.sql`(${noDup} AND "suggestedAt" IS NULL)`;
    default:
      throw new Error(`suggestedGroupSql: "${key}" is not a group`);
  }
}

// ── What a decision does ──────────────────────────────────────────────────

/**
 * Which funnel bucket the row as READ sits in.
 *
 *   needs_review   counted in needsReviewCount
 *   banked         contractor, no trade, claimable — counted in unmappedCount
 *                  AND bankedCount (ingest.js's planIngest counts it in both)
 *   accepted       has a trade, claimable — counted in acceptedCount, and in
 *                  readyCount / noWebsiteCount when it qualifies
 *   other          not in the funnel's live buckets (rejected, converted…);
 *                  no decision here may touch it
 */
export function reviewBucket(prospect = {}) {
  if (prospect?.status === "needs_review") return "needs_review";
  if (!CLAIMABLE.has(prospect?.status)) return "other";
  if (prospect.tradeKey) return "accepted";
  if (prospect.classification === "contractor") return "banked";
  return "other";
}

/** The reasons a row is in the folder, for its chips. */
export function reviewReasonsOf(prospect = {}) {
  const out = [];
  if (reviewBucket(prospect) === "banked") out.push("no_trade");
  if (prospect?.status === "needs_review") out.push("unclear");
  if (prospect?.possibleDuplicateOfId && REVIEW_STATUSES.includes(prospect?.status)) out.push("duplicate");
  return out;
}

/** The delta to leave a bucket: the negative of what entering it added. */
function leaving(bucket, prospect) {
  if (bucket === "needs_review") return { needsReviewCount: -1 };
  if (bucket === "banked") return { unmappedCount: -1, bankedCount: -1 };
  if (bucket === "accepted") {
    return {
      acceptedCount: -1,
      ...(isCallReady(prospect) ? { readyCount: -1 } : {}),
      ...(prospect.websiteUrl ? {} : { noWebsiteCount: -1 }),
    };
  }
  return {};
}

/** The delta to enter accepted, with its two subsets. */
function enteringAccepted(prospect) {
  return {
    acceptedCount: 1,
    ...(isCallReady(prospect) ? { readyCount: 1 } : {}),
    ...(prospect.websiteUrl ? {} : { noWebsiteCount: 1 }),
  };
}

function merge(...deltas) {
  const out = {};
  for (const d of deltas) {
    for (const [k, v] of Object.entries(d)) {
      const next = (out[k] || 0) + v;
      if (next === 0) delete out[k];
      else out[k] = next;
    }
  }
  return out;
}

/**
 * What one decision does to one row, decided from the row as READ.
 *
 * @param {object} prospect   the row, with status / classification / tradeKey /
 *                            phoneE164 / addressLine / websiteUrl /
 *                            possibleDuplicateOfId
 * @param {"accept"|"reject"|"duplicate"|"skip"} decision
 * @param {{ tradeKey?:string, now?:Date }} opts
 * @returns {{ ok:true, data:object, counters:object, correction:object|null, research:boolean, bucket:string }
 *         | { ok:false, error:string }}
 *          `counters` are signed deltas on the campaign row; the route turns
 *          them into increment / decrement. `correction` is the
 *          ProspectCorrection row minus prospectId and the admin.
 */
export function decisionEffects(prospect = {}, decision, { tradeKey = null, now = new Date() } = {}) {
  if (!REVIEW_DECISIONS.includes(decision)) return { ok: false, error: `"${decision}" is not a review decision.` };
  const bucket = reviewBucket(prospect);
  if (bucket === "other") return { ok: false, error: "This row is not waiting on a review any more." };
  if (prospect.doNotContactAt) return { ok: false, error: "This business is do-not-contact; nothing here may change that." };

  if (decision === "skip") {
    return { ok: true, bucket, data: { reviewDeferredAt: now }, counters: {}, correction: null, research: false };
  }

  if (decision === "accept") {
    if (!isDiscoveryTradeKey(tradeKey)) return { ok: false, error: "Accepting needs a trade from the catalogue." };
    const label = discoveryTradeLabel(tradeKey);
    const data = {
      tradeKey,
      classification: "contractor",
      classificationReason: `A superadmin reviewed this and chose ${label}.`,
      // The flag has been acted on: "keep it, it is a real prospect" clears
      // it, or it sits in the duplicate bucket for ever with a trade.
      possibleDuplicateOfId: null,
      reviewDeferredAt: null,
      ...(bucket === "needs_review" ? { status: "discovered" } : {}),
    };
    // Already accepted (a flagged row with a trade, or a trade being
    // changed): the funnel does not move, only the row.
    const counters = bucket === "accepted" ? {} : merge(leaving(bucket, prospect), enteringAccepted(prospect));
    return {
      ok: true,
      bucket,
      data,
      counters,
      correction: {
        target: "field:tradeKey",
        originalValue: prospect.tradeKey ?? null,
        correctedValue: tradeKey,
        reason: "A superadmin chose this trade in the Review folder.",
      },
      research: true,
    };
  }

  if (decision === "reject") {
    return {
      ok: true,
      bucket,
      data: {
        status: "rejected",
        classification: "retailer",
        classificationReason: "A superadmin reviewed this and said it is not a contractor.",
        doNotContactAt: now,
        doNotContactReason: "Reviewed as a shop or supplier, not a contractor.",
        possibleDuplicateOfId: null,
        reviewDeferredAt: null,
      },
      counters: merge(leaving(bucket, prospect), { rejectedCount: 1 }),
      correction: {
        target: "field:classification",
        originalValue: prospect.classification ?? null,
        correctedValue: "retailer",
        reason: "A superadmin said this is not a contractor, in the Review folder.",
      },
      research: false,
    };
  }

  // duplicate — the row is redundant, the business is fine. No doNotContact,
  // no retailer: the semantics campaigns/[id]/review/route.js set out.
  return {
    ok: true,
    bucket,
    data: {
      status: "rejected",
      classification: "duplicate",
      classificationReason: prospect.possibleDuplicateOfId
        ? `A superadmin reviewed this and said it is the same business as ${prospect.possibleDuplicateOfId}.`
        : "A superadmin reviewed this and said this business is already in the bank.",
      possibleDuplicateOfId: null,
      reviewDeferredAt: null,
    },
    counters: merge(leaving(bucket, prospect), { rejectedCount: 1 }),
    correction: {
      target: "field:classification",
      originalValue: prospect.classification ?? null,
      correctedValue: "duplicate",
      reason: "A superadmin said this row duplicates a business already held, in the Review folder.",
    },
    research: false,
  };
}

/** Signed deltas → Prisma's { increment } / { decrement }. */
export function counterUpdates(counters = {}) {
  const data = {};
  for (const [key, value] of Object.entries(counters)) {
    if (!value) continue;
    data[key] = value > 0 ? { increment: value } : { decrement: -value };
  }
  return data;
}

/**
 * Sum the counter deltas of many rows, per campaign, for a bulk write.
 * Rows with no campaign contribute nothing — there is no funnel to keep.
 */
export function countersByCampaign(effects = []) {
  const byCampaign = new Map();
  for (const { campaignId, counters } of effects) {
    if (!campaignId) continue;
    byCampaign.set(campaignId, merge(byCampaign.get(campaignId) || {}, counters || {}));
  }
  return byCampaign;
}

/** The fields the effects table reads. One list, so every reader selects it. */
export const DECISION_FIELDS = Object.freeze({
  id: true,
  status: true,
  classification: true,
  tradeKey: true,
  phoneE164: true,
  addressLine: true,
  websiteUrl: true,
  possibleDuplicateOfId: true,
  doNotContactAt: true,
  campaignId: true,
  businessName: true,
  classificationReason: true,
});
