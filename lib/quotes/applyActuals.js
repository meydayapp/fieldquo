// lib/quotes/applyActuals.js
//
// "Apply 18% more hours to this quote" — the one-press adjustment the
// review's actuals finding offers, as arithmetic over the builder's own
// state.
//
// ── What it changes, and through what ──────────────────────────────────────
//
// The builder holds two things the finding is about: the estimator's ADDED
// labour hours and ADDED material cost (the two boxes on the Cost & margin
// panel — "I think this needs N hours more than the book says"), and the
// line items the client will read. This adjusts both, the way the estimator
// would by hand:
//
//   cost side   the measured overrun on this quote's own estimated hours is
//               added to the added-hours box (fewer hours, subtracted); same
//               for materials in money. The builder's estimate then re-runs
//               over the new inputs, exactly as if the boxes had been typed.
//   price side  the extra cost is spread across the affected trade's line
//               items pro rata by amount, through the same line edit the
//               table uses (applyLineItemEdit), so the totals bar, the tax
//               and the client document follow without a second path.
//
// Both, not one: raising the cost alone would make the margin honest and the
// price unchanged, which is a finding, not an adjustment; raising the price
// alone would hide the cost. The estimator sees the new price on screen
// before anything is sent, and nothing is saved until they press Save.
//
// ── Drafts only ────────────────────────────────────────────────────────────
//
// A sent quote is a document a homeowner may be reading; an accepted one is
// a contract. Refused here, by status, as well as hidden in the panel —
// hiding a button is not a rule.
//
// PURE. State in, new state out, or a refusal with a reason.

import { applyLineItemEdit } from "@/lib/quotes/builderPayload";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;

/**
 * @param p.status            the quote's status — only "draft" is adjusted
 * @param p.scopeGroups       the builder's groups: [{ categoryKey, lineItems:
 *                            [{ description, quantity, unit, rate, amount }] }]
 * @param p.manualLabourHours the added-hours box
 * @param p.manualMaterialCost the added-materials box
 * @param p.estimate          the builder's live estimate: { labourHours,
 *                            labourCost, materialTotal, groups: [{
 *                            categoryKey, labourHours, materialTotal }] }
 * @param p.categoryKey       the trade the finding measured
 * @param p.labourPct         +18 for 18% over, -6 for 6% under, or null
 * @param p.materialsPct      same for materials, or null
 * @returns { ok: true, scopeGroups, manualLabourHours, manualMaterialCost,
 *            addedHours, addedMaterials, priceDelta }
 *        | { ok: false, reason: "not_draft" | "nothing_to_apply" }
 */
export function applyActualsToDraft({
  status,
  scopeGroups = [],
  manualLabourHours = 0,
  manualMaterialCost = 0,
  estimate = {},
  categoryKey,
  labourPct = null,
  materialsPct = null,
} = {}) {
  if (status !== "draft") return { ok: false, reason: "not_draft" };

  // The measured trade's own hours and materials when the estimate breaks
  // them out per group; the whole quote's otherwise. An 18% overrun on
  // painting jobs is applied to the painting, not to the flooring beside it.
  const own = (Array.isArray(estimate.groups) ? estimate.groups : []).filter(
    (g) => g && g.categoryKey === categoryKey,
  );
  //
  // A takeoff trade's hours are not on its group row in the builder's live
  // estimate (estimateQuoteCost pools them; quoteCostSummary folds them back
  // only on the server), so a group summing to zero falls back to the
  // quote's own total rather than concluding the painting takes no time.
  const ownHours = own.reduce((s, g) => s + num(g.labourHours), 0);
  const ownMaterials = own.reduce((s, g) => s + num(g.materialTotal), 0);
  const hours = ownHours > 0 ? ownHours : num(estimate.labourHours);
  const materials = ownMaterials > 0 ? ownMaterials : num(estimate.materialTotal);
  // An hour costs what the estimate already prices one at — the crew's
  // blended rate, or the fallback — read off the quote-wide figures.
  const labourCost = num(estimate.labourCost);
  const allHours = num(estimate.labourHours);

  const addedHours = labourPct == null || hours <= 0 ? 0 : round2(hours * (num(labourPct) / 100));
  const addedMaterials =
    materialsPct == null || materials <= 0 ? 0 : round2(materials * (num(materialsPct) / 100));
  if (!addedHours && !addedMaterials) return { ok: false, reason: "nothing_to_apply" };

  // The money the extra hours cost, at the rate the estimate already
  // prices an hour at. No rate (nothing costed) means no price change: the
  // cost side still moves, and the panel shows the margin that results.
  const ratePerHour = allHours > 0 ? labourCost / allHours : 0;
  const priceDelta = round2(addedHours * ratePerHour + addedMaterials);

  // The affected trade's lines, pro rata by amount. Lines priced at nothing
  // (a heading, an included item) stay at nothing.
  const groups = Array.isArray(scopeGroups) ? scopeGroups : [];
  const targets = groups.filter((g) => g && g.categoryKey === categoryKey);
  const pool = targets.flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : []));
  const poolTotal = pool.reduce((s, li) => s + num(li?.amount), 0);

  let spread = 0;
  const nextGroups = groups.map((g) => {
    if (!g || g.categoryKey !== categoryKey || poolTotal <= 0 || !priceDelta) return g;
    const lineItems = (g.lineItems || []).map((li) => {
      const amount = num(li?.amount);
      if (amount <= 0) return li;
      const share = round2(priceDelta * (amount / poolTotal));
      spread = round2(spread + share);
      // Through the table's own edit so the amount is recomputed one way.
      // A line with no quantity (an older flat line) multiplies as one —
      // applyLineItemEdit would otherwise price it at quantity 0 × rate.
      const qty = num(li.quantity) > 0 ? num(li.quantity) : 1;
      return applyLineItemEdit({ ...li, quantity: qty }, "rate", round2((amount + share) / qty));
    });
    return { ...g, lineItems };
  });

  return {
    ok: true,
    scopeGroups: nextGroups,
    manualLabourHours: round2(num(manualLabourHours) + addedHours),
    manualMaterialCost: round2(num(manualMaterialCost) + addedMaterials),
    addedHours,
    addedMaterials,
    priceDelta: spread,
  };
}
