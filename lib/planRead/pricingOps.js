// lib/planRead/pricingOps.js
//
// A person's pricing choices on a drawing read — never the model's:
//
//   add_margin_adjustment     the one-click answer to "your rates miss your
//                             target": a visible line on the draft for the
//                             GAP, worked out on the server from the current
//                             pricing (lib/planRead/recommendation.js). The
//                             browser sends no amount (AGENTS.md rule 5's
//                             spirit, and the recommendation is the only
//                             source of the figure).
//   remove_margin_adjustment
//   use_suggestions           put a trade's FieldQuo-suggested lines on the
//                             draft quote — flagged on every line
//                             (meta.aiSuggested) — or take them off.
//   set_pricing_assumptions   the figures the estimator stated in the chat,
//                             accepted from the diff — RE-VERIFIED here
//                             against the read's stored messages
//                             (lib/planRead/pricingChat.js verifyProposals),
//                             never trusted from the browser.
//   remove_pricing_assumption
//
// Pure: returns a new model and the sentences the history logs.

import { verifyProposals, mergeAssumptions } from "./pricingChat";
import { TRADE_LABELS } from "./tradeCatalogue";

export const PRICING_PERSON_OPS = Object.freeze(["add_margin_adjustment", "remove_margin_adjustment", "use_suggestions", "set_pricing_assumptions", "remove_pricing_assumption"]);

const KIND_WORDS = {
  production_rate: "production rate",
  labour_rate: "labour cost rate",
  material_cost: "material cost",
  waste: "waste",
  target_margin: "target margin (what-if)",
};

export function applyPricingOps(model, ops, { recommendation = null, messages = [], trades = [], userId = null, now = Date.now() } = {}) {
  const m = JSON.parse(JSON.stringify(model || {}));
  m.pricing = m.pricing && typeof m.pricing === "object" ? m.pricing : {};
  const changes = [];
  const dropped = [];
  for (const op of Array.isArray(ops) ? ops.slice(0, 10) : []) {
    if (op?.op === "add_margin_adjustment") {
      if (!recommendation || recommendation.meetsTarget || !(recommendation.gap > 0)) {
        dropped.push("Your rates already hold your target margin — no adjustment needed");
        continue;
      }
      m.pricing.marginAdjustment = { amount: recommendation.gap, targetPct: recommendation.targetPct, at: new Date(now).toISOString(), userId };
      changes.push(`Added a margin adjustment line to hold your ${recommendation.targetPct}% target`);
    } else if (op?.op === "remove_margin_adjustment") {
      if (m.pricing.marginAdjustment) {
        m.pricing.marginAdjustment = null;
        changes.push("Removed the margin adjustment line");
      }
    } else if (op?.op === "use_suggestions") {
      if (!trades.includes(op.tradeKey)) {
        dropped.push("No such trade on this read");
        continue;
      }
      m.pricing.useSuggestions = { ...(m.pricing.useSuggestions || {}), [op.tradeKey]: op.on === true };
      changes.push(`${op.on === true ? "Put" : "Took"} FieldQuo's suggested ${TRADE_LABELS[op.tradeKey]} lines ${op.on === true ? "on" : "off"} the draft quote (flagged as suggestions)`);
    } else if (op?.op === "set_pricing_assumptions") {
      const { accepted, rejected } = verifyProposals(Array.isArray(op.assumptions) ? op.assumptions.map((a) => ({ ...a, value: a.said ?? a.value })) : [], messages, { trades });
      for (const r of rejected) dropped.push(`Not applied: a figure that isn't in your messages (${r.reason})`);
      if (!accepted.length) continue;
      m.pricingAssumptions = mergeAssumptions(m.pricingAssumptions, accepted.map((a) => ({ ...a, acceptedAt: new Date(now).toISOString(), userId })));
      for (const a of accepted) changes.push(`Pricing from the conversation: ${KIND_WORDS[a.kind]}${a.tradeKey ? ` (${TRADE_LABELS[a.tradeKey]}${a.itemKey ? ` · ${a.itemKey}` : ""})` : ""} = ${a.said}${a.basis === "percent" ? "%" : ""} — “${a.quote}”`);
    } else if (op?.op === "remove_pricing_assumption") {
      const before = (m.pricingAssumptions || []).length;
      m.pricingAssumptions = (m.pricingAssumptions || []).filter((a) => a.id !== op.id);
      if (m.pricingAssumptions.length < before) changes.push("Removed a pricing figure from the conversation");
    } else {
      dropped.push(`Unknown change "${String(op?.op).slice(0, 30)}"`);
    }
  }
  return { model: m, changes, dropped };
}
