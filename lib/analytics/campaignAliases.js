// lib/analytics/campaignAliases.js
//
// One campaign, two ways of naming it: the id Meta supplies, and the name a
// human typed. This resolves the second onto the first — ONCE, for every
// surface that groups leads by campaign.
//
// ══ Why it exists ══════════════════════════════════════════════════════════
//
// TrueFinish buys its Meta ads through an agency. The agency's ad drives to
// the agency's OWN landing page, and the agency then POSTs the lead to
// /api/v1/marketing/leads with its key. Meta never sees that submission, so
// the lead arrives with no campaign id — the agency sends only the campaign
// NAME it typed into Ads Manager:
//
//   lead  attribution.ad.cn = "TFC / FMM / DA / PKG 1 / LEADS / 20.10.2026"
//   spend campaignId "120249142978690135", campaignName the same string
//
// Both halves name one campaign. Before this file, they were two rows that
// never met: lib/analytics/campaignRollup.js joined on LeadRequest
// .metaCampaignId alone (which only lib/meta/leadsImport.js fills, for Meta's
// own lead forms) and dropped the agency's leads before the join started,
// and lib/agency/channels.js's campaignKeyOf keyed the spend row "id:1202…"
// and the lead "name:tfc / fmm / …". The Spend page showed that campaign
// with $2,248.36 of spend, 0 leads and a blank cost per lead while 18 leads
// and 11 appointments sat in the database.
//
// ══ The spend rows are the authority, and nothing else is ══════════════════
//
// A name is only ever resolved to an id that the company's OWN ad account
// already stated: a MarketingSpend row carrying BOTH campaignId and
// campaignName, inside the same period the caller is already reading. A name
// with no spend row behind it resolves to nothing and its lead stays
// unattributed, exactly as before — absence of a spend row is not a campaign
// (AGENTS.md failure class 5). Nothing here invents a campaign from a lead.
//
// A name match is weaker evidence than an id match, and the surfaces that use
// it say so on screen: the agency states the campaign, the company's own ad
// account corroborates the name, and that is all. Two people typing the same
// campaign name is possible, so when ONE folded name is claimed by TWO
// campaign ids in the period it resolves to nothing rather than to a guess —
// the ambiguity is reported, not averaged.
//
// This is deliberately NOT lib/tracking/adParams.js's identityIndex(), which
// solves the same shape one level up (a landing carrying only a name joins
// the id another LANDING carried). There the evidence is other landings; here
// it is the ad account's own spend, which is a stronger statement and the
// only one a contractor's money hangs on.
//
// Pure: no db, no clock. Executed against the real row shapes by
// scripts/check-campaign-rollup.mjs and scripts/check-marketing-metrics.mjs.

/**
 * The grouping form of a campaign name: trimmed, lower-cased.
 *
 * Exactly what lib/agency/channels.js's campaignKeyOf has always folded by,
 * extracted so the alias map and the key cannot disagree about whether two
 * spellings are one campaign. Deliberately NOT adParams.js's foldName (which
 * also NFKC-normalises and collapses inner runs of whitespace): widening the
 * fold would silently merge campaign keys that are separate today, which is a
 * change to every existing per-campaign row and not this fix.
 */
export function foldCampaignName(name) {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

/**
 * Spend rows → the name↔id pairings they prove.
 *
 * @param {object[]} spendRows  MarketingSpend-shaped rows, already scoped to
 *                              the company and the period: { campaignId,
 *                              campaignName }. Rows missing either field say
 *                              nothing about the pairing and are skipped.
 * @returns {{ byName: Map<string,string> }}
 *          a folded name → the ONE campaign id that owns it. A folded name
 *          two or more ids claimed is simply ABSENT, so it resolves to
 *          nothing — the ambiguity is not reported as a separate list,
 *          because nothing would read it and a value nothing reads is the
 *          failure class this codebase keeps finding (AGENTS.md #1).
 */
export function buildCampaignAliases(spendRows) {
  const idsByName = new Map();
  for (const row of Array.isArray(spendRows) ? spendRows : []) {
    if (!row) continue;
    const id = row.campaignId ? String(row.campaignId) : null;
    const folded = foldCampaignName(row.campaignName);
    if (!id || !folded) continue;
    if (!idsByName.has(folded)) idsByName.set(folded, new Set());
    idsByName.get(folded).add(id);
  }
  const byName = new Map();
  for (const [folded, ids] of idsByName) {
    if (ids.size === 1) byName.set(folded, [...ids][0]);
  }
  return { byName };
}

/** An empty alias map — the shape a caller with no spend rows passes. */
export const NO_CAMPAIGN_ALIASES = Object.freeze({ byName: new Map() });

/**
 * The campaign a lead's attribution belongs to.
 *
 * Its OWN campaign id when it carries one: an id match is the strong evidence
 * and is never second-guessed by a name, which is also what stops one lead
 * being counted twice — a lead with BOTH an id and a name resolves by the id
 * and is never also matched by the name.
 *
 * Otherwise the id the spend rows prove owns its campaign name, when exactly
 * one does. Otherwise nothing.
 *
 * @param {object|null} attr     { campaignId?, campaignName?, utmCampaign? }
 * @param {object|null} aliases  buildCampaignAliases() result, or null for
 *                               "resolve by id only" — which is byte-for-byte
 *                               the behaviour every caller had before aliases
 *                               existed.
 * @returns {{ campaignId: string|null, matchedBy: "id"|"name"|null }}
 */
export function resolveCampaignId(attr, aliases = null) {
  if (!attr || typeof attr !== "object") return { campaignId: null, matchedBy: null };
  if (attr.campaignId) return { campaignId: String(attr.campaignId), matchedBy: "id" };
  const folded = foldCampaignName(attr.campaignName || attr.utmCampaign);
  if (!folded) return { campaignId: null, matchedBy: null };
  const byName = aliases && aliases.byName instanceof Map ? aliases.byName : null;
  const resolved = byName ? byName.get(folded) : undefined;
  return resolved ? { campaignId: String(resolved), matchedBy: "name" } : { campaignId: null, matchedBy: null };
}
