// lib/sales/playbook/talkingPoints.js
//
// The gate. Nothing reaches a rep's script without passing through here.
//
// ══ A claim with no chain back to evidence must be IMPOSSIBLE ═════════════
//
// Not discouraged, not reviewed — impossible. The chain is fixed and every
// link is a foreign key or a check in this file:
//
//   talking point → ProspectOpportunity.capabilityCode
//                 → FieldQuoCapability.code            (a real FK in the schema)
//                 → ProspectOpportunity.evidenceIds    (non-empty, or refused)
//                 → ProspectEvidence rows              (what we actually saw)
//
// A model that invents "you should get our route optimisation" cannot produce
// a point, because there is no opportunity row to cite. A model that cites a
// real opportunity but writes a sentence about something else is a risk this
// file cannot close — what it can close, and does, is the class where the
// CLAIM has no row behind it at all. Spec §11: never recommend a capability
// FieldQuo does not actually have.
//
// ══ Why `capabilityCode` is the reference and not an id ═══════════════════
//
// `@@unique([prospectId, capabilityCode])` on ProspectOpportunity makes the
// code a key, and a code is something a JSON Schema `enum` can carry. That
// matters: lib/sales/playbook/generate.js hands the model a closed enum of the
// codes that actually have an opportunity row for THIS prospect, so an invented
// citation is refused by the vendor's own strict-schema validation before it
// ever reaches this file. This file is the second gate, for the same reason the
// impersonation check lives in two places — a strict schema is a vendor
// promise, and vendor promises are not access control.
//
// ══ No numbers. At all. ═══════════════════════════════════════════════════
//
// The generation schema carries no numeric field anywhere, so a model cannot
// emit a price, a total or a percentage as DATA. `NUMERIC_CLAIM` closes the
// other door: a number written into the prose. Non-negotiable #4 and #5 are
// about client-facing pricing surfaces, and a rep quoting a figure a model
// invented is the same failure one step further from the database.
//
// The stated cost, so nobody rediscovers it as a bug: "answers 24/7", "in
// under 60 seconds" and "two thirds of homeowners" are all refused. A talking
// point does not need a number, and a rep who wants one has the pricing page
// and the feature matrix, both of which are maintained.
//
// It applies to `source: "ai"` and NOT to rule-authored text, which is a
// boundary rather than a loophole. `OpportunityRule.reasonTemplate` is written
// by a superadmin, validated by `validateRule` before it can be saved, and
// interpolates `{competitorCount}` — a digit, by construction. A superadmin may
// put a figure in a rep's mouth and answer for it; a model may not.
import { capabilityMatrix } from "@/lib/sales/intel/capabilities";
import { DEFAULT_POINT_STAGE, TALKING_POINT_STAGES } from "./stages";

/** Why a talking point was refused. Rendered verbatim on the review screen. */
export const POINT_REFUSALS = Object.freeze({
  empty: "The point has no text.",
  too_long:
    "The point is longer than a rep reads aloud in one breath. It would be skimmed, not said.",
  no_citation: "The point cites no opportunity, so there is nothing behind it.",
  unknown_opportunity:
    "The point cites a capability that has no opportunity row for this prospect — nothing was observed that supports saying it.",
  unknown_capability:
    "The cited capability is not in the FieldQuo capability matrix. FieldQuo does not have it.",
  inactive_capability:
    "The cited capability is switched off in the capability matrix, so it may not be recommended to anybody.",
  no_evidence:
    "The cited opportunity has no evidence behind it, so the point cites a citation of nothing.",
  numeric_claim:
    "The point contains a figure — a price, a percentage or a count. Nothing here may put a number in a rep's mouth.",
  unknown_stage: "The point names a stage that does not carry talking points.",
  duplicate: "The same opportunity is already covered by an earlier point.",
});

/** Longest sentence a rep says without losing the room. */
export const MAX_POINT_LENGTH = 280;

/**
 * Anything that reads as a figure.
 *
 * Digits catch "$149", "30%", "3x" and "24/7". The words catch the spelled-out
 * versions a model reaches for when it has been told not to use digits, which
 * it does — the first draft of this regex was digits only and a test prompt
 * produced "half the price of Jobber".
 *
 * `cost` is deliberately NOT here: "missed calls cost them work" is a true,
 * useful sentence with no figure in it, and banning the word would delete a
 * whole class of real talking points to catch nothing.
 */
const NUMERIC_CLAIM =
  /[\d$€£¥%]|\b(?:dollars?|cents?|percent|price[sd]?|pricing|discounts?|free|half|double|triple|thousands?|hundreds?|millions?)\b/i;

/**
 * The context a point is validated against. Built once per prospect.
 *
 * @param {object} args
 * @param {Array} args.opportunities  ProspectOpportunity rows (or the shape
 *        buildOpportunities returns — both carry capabilityCode/evidenceIds).
 * @param {Array} args.matrix         the capability matrix. Loaded from the
 *        database by the caller; defaults to the seed for pure use.
 */
export function talkingPointContext({ opportunities = [], matrix = capabilityMatrix() } = {}) {
  const byCode = new Map();
  for (const o of Array.isArray(opportunities) ? opportunities : []) {
    const code = typeof o?.capabilityCode === "string" ? o.capabilityCode : null;
    if (!code || byCode.has(code)) continue;
    byCode.set(code, {
      capabilityCode: code,
      reason: typeof o.reason === "string" ? o.reason : null,
      evidenceIds: (Array.isArray(o.evidenceIds) ? o.evidenceIds : []).filter(
        (id) => typeof id === "string" && id,
      ),
      ruleCode: o.ruleCode ?? null,
      ruleVersion: o.ruleVersion ?? null,
      rank: Number(o.rank) || 0,
      id: o.id ?? null,
    });
  }

  return {
    byCode,
    matrix: Array.isArray(matrix) ? matrix : [],
    /**
     * The closed list a model may cite. Empty means the model gets no schema
     * at all and is never called — see generate.js. That is correct: a
     * prospect with no opportunities has nothing that could be said about
     * them, and asking a model to write something anyway is asking it to
     * invent.
     */
    citableCodes: [...byCode.keys()].sort(),
  };
}

/**
 * One point, against one context.
 *
 * @param {{capabilityCode?:string, stageKey?:string, text?:string}} point
 * @param {object} ctx  from talkingPointContext()
 * @param {Set<string>} [seen]  codes already accepted, for duplicate detection
 * @returns {{ ok: boolean, refusal: string|null, refusalText: string|null, value: object|null }}
 */
export function validateTalkingPoint(point, ctx, seen) {
  const refuse = (refusal) => ({
    ok: false,
    refusal,
    refusalText: POINT_REFUSALS[refusal] || refusal,
    value: null,
  });

  const source = point?.source === "ai" ? "ai" : "rule";

  const text = typeof point?.text === "string" ? point.text.trim() : "";
  if (!text) return refuse("empty");
  if (text.length > MAX_POINT_LENGTH) return refuse("too_long");
  if (source === "ai" && NUMERIC_CLAIM.test(text)) return refuse("numeric_claim");

  const stageKey =
    typeof point?.stageKey === "string" && point.stageKey ? point.stageKey : DEFAULT_POINT_STAGE;
  if (!TALKING_POINT_STAGES.includes(stageKey)) return refuse("unknown_stage");

  const code = typeof point?.capabilityCode === "string" ? point.capabilityCode : "";
  if (!code) return refuse("no_citation");

  const opportunity = ctx?.byCode?.get(code);
  if (!opportunity) return refuse("unknown_opportunity");

  // The capability matrix is checked even though ProspectOpportunity has a
  // real foreign key to it. The FK guarantees the row exists; it says nothing
  // about whether the capability is still switched on, and a capability
  // switched off on the matrix screen must stop being said out loud on the
  // next call rather than the next deploy.
  const cap = (ctx.matrix || []).find((c) => c.code === code);
  if (!cap) return refuse("unknown_capability");
  if (cap.active !== true) return refuse("inactive_capability");

  if (opportunity.evidenceIds.length === 0) return refuse("no_evidence");

  if (seen instanceof Set && seen.has(code)) return refuse("duplicate");

  return {
    ok: true,
    refusal: null,
    refusalText: null,
    value: {
      capabilityCode: code,
      capabilityName: cap.name,
      stageKey,
      text,
      source,
      // The chain, carried with the point so a screen never has to re-derive
      // it and a stored row stays explainable after the rule changes.
      evidenceIds: [...opportunity.evidenceIds],
      ruleCode: opportunity.ruleCode,
      ruleVersion: opportunity.ruleVersion,
      opportunityId: opportunity.id,
    },
  };
}

/**
 * A list of points, in order, with everything that was refused and why.
 *
 * Order is preserved rather than re-ranked: a model asked for three sentences
 * writes them as an argument, and re-sorting them by our own opportunity rank
 * would break the argument while looking like it improved it.
 */
export function assembleTalkingPoints(points, ctx) {
  const accepted = [];
  const refused = [];
  const seen = new Set();

  for (const p of Array.isArray(points) ? points : []) {
    const result = validateTalkingPoint(p, ctx, seen);
    if (!result.ok) {
      refused.push({
        capabilityCode: typeof p?.capabilityCode === "string" ? p.capabilityCode : null,
        text: typeof p?.text === "string" ? p.text.slice(0, MAX_POINT_LENGTH) : null,
        refusal: result.refusal,
        refusalText: result.refusalText,
      });
      continue;
    }
    seen.add(result.value.capabilityCode);
    accepted.push(result.value);
  }

  return { accepted, refused };
}

/**
 * The script with no model: the rule's own sentence, unchanged.
 *
 * `ProspectOpportunity.reason` was rendered from `OpportunityRule.reasonTemplate`
 * against variables the evaluator supplied, and refused outright if any of them
 * was missing. It is already evidence-cited, already free of invented claims,
 * and already a sentence. So "AI unavailable" produces plainer copy and never a
 * blank screen — the same property lib/site/generateSite.js holds, argued in
 * its header.
 *
 * It runs through the same gate as a generated point. Not as a formality: an
 * opportunity whose capability was switched off after the row was written must
 * stop being read out, and that is exactly the case a shortcut here would miss.
 */
export function deterministicTalkingPoints(ctx, { limit = 3 } = {}) {
  const rows = [...(ctx?.byCode?.values?.() || [])]
    .filter((o) => o.reason)
    .sort((a, b) => a.rank - b.rank || a.capabilityCode.localeCompare(b.capabilityCode))
    .slice(0, Math.max(0, limit));

  return assembleTalkingPoints(
    rows.map((o) => ({
      capabilityCode: o.capabilityCode,
      stageKey: DEFAULT_POINT_STAGE,
      text: o.reason,
      source: "rule",
    })),
    ctx,
  );
}
