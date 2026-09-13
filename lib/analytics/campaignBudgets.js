// lib/analytics/campaignBudgets.js
//
// What a campaign was BUDGETED, laid beside what was SPENT — on the Marketing
// → Spend screen, per channel.
//
// ── The field was written and never read ───────────────────────────────────
//
// MarketingCampaign.budget has been on the "New campaign" form since the
// campaign hub existed. It printed on the card ("Budget $500") and reached
// nothing else: not the Spend page, not the by-channel table, not cost per
// lead. A number the product asks for and never uses is the class of dead
// control AGENTS.md lists first, and the honest choices were to remove the
// field or to make it mean something. This is the second.
//
// ── Budgeted is not spent, and neither one pretends ────────────────────────
//
// Spend rows (MarketingSpend) are money that LEFT: a receipt somebody typed,
// or a day Meta reported. A budget is money somebody INTENDS to spend on a
// campaign, over the campaign's whole life. So a budget is never a spend row
// — it does not enter the totals, the blended cost per lead or any rate —
// and the Spend page shows it in its own column, labelled "Budgeted", beside
// the "Spent" the channel already showed. What the pair tells a contractor is
// the thing the two numbers were separately failing to: "I set aside $1,200
// for pamphlets and have logged $340 against them", or "the Meta sync says
// $2,100 has gone out of a campaign I budgeted at $1,500".
//
// ── One campaign type → one channel ────────────────────────────────────────
//
// The Spend page groups by MarketingPlatform; the campaign hub groups by
// MarketingCampaignType. They are different enums with an obvious overlap and
// the map below is the whole of it. `email` lands on "other" because the
// platform enum has no email channel and inventing one on a dashboard would
// mean a row nothing else ever writes to.
//
// Archived campaigns are excluded: archiving is "this is over", and a budget
// for something that is over is not a budget any more. Spend already logged
// against the channel stays — money that left is still money that left.
//
// Pure. The summary route fetches; scripts/check-campaign-budgets.mjs runs
// this against fixtures.

export const CAMPAIGN_TYPE_TO_PLATFORM = Object.freeze({
  pamphlet: "pamphlet",
  meta_ads: "facebook",
  email: "other",
  other: "other",
});

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {object[]} campaigns  MarketingCampaign rows: { id, name, type,
 *                              status, budget } — Decimal budgets are fine
 * @returns {{ byPlatform: Record<string,{budgeted:number, campaigns:number}>,
 *             campaigns: object[], total: number }}
 */
export function campaignBudgets(campaigns) {
  const rows = (Array.isArray(campaigns) ? campaigns : []).filter(
    (c) => c && c.status !== "archived" && c.budget !== null && c.budget !== undefined,
  );
  const byPlatform = {};
  const listed = [];
  for (const c of rows) {
    const budget = Number(c.budget);
    if (!Number.isFinite(budget) || budget < 0) continue;
    const platform = CAMPAIGN_TYPE_TO_PLATFORM[c.type] || "other";
    if (!byPlatform[platform]) byPlatform[platform] = { budgeted: 0, campaigns: 0 };
    byPlatform[platform].budgeted = round2(byPlatform[platform].budgeted + budget);
    byPlatform[platform].campaigns += 1;
    listed.push({
      id: c.id,
      name: c.name,
      type: c.type,
      platform,
      status: c.status,
      budget: round2(budget),
    });
  }
  return {
    byPlatform,
    campaigns: listed,
    total: round2(listed.reduce((s, c) => s + c.budget, 0)),
  };
}

/**
 * Lay the budgets over the by-channel rollup. Every existing channel gains
 * `budgeted` (null when no live campaign of that kind has a budget — absence,
 * not zero); a channel with a budget and no spend yet gets its own row with
 * spend 0, so "$1,200 set aside for pamphlets, nothing logged" is on the
 * table rather than missing from it. Nothing about `spend`, `leads` or any
 * rate on the existing rows is touched.
 */
export function channelsWithBudgets(channels, budgets) {
  const byPlatform = budgets?.byPlatform || {};
  const seen = new Set();
  const out = (Array.isArray(channels) ? channels : []).map((c) => {
    seen.add(c.platform);
    const b = byPlatform[c.platform];
    return { ...c, budgeted: b ? b.budgeted : null, budgetedCampaigns: b ? b.campaigns : 0 };
  });
  for (const [platform, b] of Object.entries(byPlatform)) {
    if (seen.has(platform)) continue;
    out.push({
      platform,
      spend: 0,
      leads: 0,
      conversions: 0,
      clicks: 0,
      impressions: 0,
      approximate: false,
      convertedFrom: [],
      costPerLead: null,
      costPerConversion: null,
      clickThroughRate: null,
      leadConversionRate: null,
      budgeted: b.budgeted,
      budgetedCampaigns: b.campaigns,
      // Says why the row exists with no spend behind it.
      budgetOnly: true,
    });
  }
  return out;
}
