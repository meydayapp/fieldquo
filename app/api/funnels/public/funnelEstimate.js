// app/api/funnels/public/funnelEstimate.js
//
// Server-side glue for the funnel's instant-estimate step. Not a route — shared
// by the three public funnel endpoints that need it (the funnel GET, the
// estimate POST, and submit).
//
// ══ Non-negotiable #4, and why this step is not an exception to it ══════════
//
// "Public endpoints never return prices" is about the RATE CARD: a public list
// of what a company charges per square foot is a gift to every competitor in
// the city. That rule is kept here in full — nothing in these responses carries
// a rate, a minimum, a surcharge percentage, a material's price, or the
// measurement behind a band. What crosses is one finished range for one job the
// visitor described, which is the same thing /instant-quote has always
// returned, under the same per-trade gate the owner sets.
//
// Three properties keep it that way:
//
//   1. One band at a time. The whole band→price table would BE a rate card, so
//      the funnel GET ships band LABELS only, and a price is computed only for
//      the band the visitor actually taps.
//   2. Nothing numeric comes from the browser. It posts a band id; the
//      measurement is read out of the company's stored step here.
//   3. The owner's per-trade visibility setting is obeyed exactly as the
//      instant-quote flow obeys it. A company that said "don't show a price"
//      does not start showing one because a funnel asked.
//
// ══ Every step served here has been priced here ════════════════════════════
//
// The bands are dry-run through the SHIPPED pricer before they are served, the
// way instantQuoteReadiness dry-runs a trade before the settings screen calls it
// ready. A band that can't produce a number is not offered, and a step with no
// priceable band is removed from the funnel entirely — a tap that leads to an
// apology is the dead control this codebase is swept for.

import { db } from "@/lib/db";
import {
  funnelEstimateSteps,
  resolveEstimateBand,
  bandIntake,
} from "@/app/data/funnelBlocks";
import { measureForTrade, tradeLabel } from "@/lib/estimate/instantQuoteServer";
import { formatMoney } from "@/lib/currency";
import { priceOptionsFor, sanitiseInstantConfig } from "@/lib/estimate/instantQuoteReadiness";
import {
  visibilityFor,
  effectiveVisibility,
  publicEstimate,
  lockedEstimateMessage,
  gatedMessage,
} from "@/lib/estimate/visibility";

/**
 * The enabled, shape-normalised instant-quote config for each trade a funnel
 * names. One query for the whole funnel; trades the company hasn't enabled are
 * simply absent from the map.
 */
export async function loadFunnelTradeConfigs(companyId, trades) {
  const wanted = [...new Set((trades || []).filter(Boolean))];
  if (!wanted.length) return new Map();

  const rows = await db.instantQuoteConfig.findMany({
    where: { companyId, trade: { in: wanted }, enabled: true },
  });

  const out = new Map();
  for (const row of rows) {
    // `enabled: true` is re-asserted because computeInstantEstimate treats
    // `enabled === false` as "not configured" — the row was already filtered on
    // it, and dropping the flag here would silently unprice every trade.
    const config = sanitiseInstantConfig({ ...(row.config || {}), enabled: true });
    if (config) out.set(row.trade, config);
  }
  return out;
}

/**
 * Price ONE band of ONE step. Pure of gating — the caller decides what the
 * visitor may see, because that depends on which side of the contact form they
 * are on.
 *
 * @returns {{ok:true, options:Array, visibility:string}} | {{ok:false, reason:string}}
 */
export async function priceFunnelBand({ step, band, config }) {
  if (!config) return { ok: false, reason: "not_configured" };

  // The same measurement code the instant-quote form runs, fed the band's own
  // stored numbers. Reusing it rather than building a measurement object here
  // is the point: a trade whose intake changes changes in one place.
  const measured = await measureForTrade(step.trade, { intake: bandIntake(step, band) });
  if (!measured.ok) return { ok: false, reason: measured.reason };

  const priced = priceOptionsFor({ trade: step.trade, config, measurement: measured.measurement });
  if (!priced.ok) return { ok: false, reason: priced.reason };

  return { ok: true, options: priced.options, visibility: visibilityFor(config) };
}

/**
 * Collapse priced options down to what the browser may receive at this point in
 * the flow. Returns a render-ready payload in every case — gated, unpriceable
 * and priced all produce something the runner can put on screen, because a
 * blank card mid-funnel reads as broken.
 *
 * @param stage "prompt" (before contact details) | "confirmed" (after submit)
 */
export function publicFunnelEstimate({ priced, stage, language, tradeKey }) {
  // Two different silences, and using the wrong one costs leads. "We don't show
  // prices online for this service" is true for a gated trade and a lie for a
  // trade that reveals after the form — and a homeowner told there is no number
  // stops filling the form in, which is the opposite of what that mode is for.
  const willUnlock = priced?.visibility === "after_submit" && stage === "prompt";
  const gatedBody = {
    gated: true,
    message: willUnlock ? lockedEstimateMessage(language).body : gatedMessage(language, stage),
  };

  if (!priced?.ok) {
    // The visitor is told the estimate isn't available, never why: which band
    // is unpriced is the company's configuration (#4). Support gets the reason
    // from the caller's log line.
    return gatedBody;
  }

  const mode = effectiveVisibility(priced.visibility, stage);
  if (mode !== "range") return gatedBody;

  const options = priced.options
    .map((o) => {
      const pub = publicEstimate(
        { low: o.low, high: o.high, minimumApplied: o.minimumApplied },
        "range",
      );
      return pub.show
        ? {
            label: o.label,
            low: pub.low,
            high: pub.high,
            unit: o.unit || null,
            minimumApplied: pub.minimumApplied,
          }
        : null;
    })
    .filter(Boolean);

  // Every material fell out — gated rather than an empty list the runner would
  // render as a blank price.
  if (!options.length) return gatedBody;

  return { gated: false, options, tradeLabel: tradeLabel(tradeKey) };
}

/**
 * The estimate for every estimate step the visitor answered, priced again at
 * submit time.
 *
 * Two outputs, deliberately different:
 *
 *   `byStep`  what the visitor may now see. This is the post-submit side, so a
 *             trade set to "show the range after they submit" unlocks here —
 *             and it unlocks because a lead row exists, not because the browser
 *             said so.
 *   `notes`   what the CONTRACTOR is told, on their own lead. It carries the
 *             figure even for a gated trade: the owner hid the number from a
 *             stranger, not from themselves, and a homeowner who saw
 *             "$3,400 – $4,600" on screen will hold them to it. A lead that
 *             doesn't say what was promised is a lead the contractor walks into
 *             blind.
 */
export async function confirmedFunnelEstimates({ companyId, steps, answers, language = "en", currency }) {
  const estimateSteps = funnelEstimateSteps(steps).filter((s) =>
    resolveEstimateBand(s, answers?.[s.id]),
  );
  if (!estimateSteps.length) return { byStep: {}, notes: [], intake: {} };

  const configs = await loadFunnelTradeConfigs(
    companyId,
    estimateSteps.map((s) => s.trade),
  );

  const byStep = {};
  const notes = [];
  const intake = {};

  for (const step of estimateSteps) {
    const band = resolveEstimateBand(step, answers[step.id]);
    const priced = await priceFunnelBand({ step, band, config: configs.get(step.trade) });
    const shown = publicFunnelEstimate({ priced, stage: "confirmed", language, tradeKey: step.trade });
    byStep[step.id] = shown;

    const label = `${tradeLabel(step.trade)} estimate`;
    if (!priced.ok) {
      notes.push(`${label}: ${band.label || band.id} — no price could be computed.`);
      intake[label] = band.label || band.id;
      continue;
    }
    const ranges = priced.options
      .map((o) => {
        const money = `${formatMoney(o.low, currency)} – ${formatMoney(o.high, currency)}`;
        return o.label ? `${o.label} ${money}` : money;
      })
      .join(", ");
    const seen = shown.gated ? " (not shown to them)" : " (shown on screen)";
    notes.push(`${label}: ${band.label || band.id} — ${ranges}${seen}`);
    intake[label] = `${band.label || band.id}: ${ranges}`;
  }

  return { byStep, notes, intake };
}

// A branch target that no longer exists would silently strand a visitor on the
// last step, so removing a step rewires the answers that pointed at it back to
// "just go forward".
function withoutSteps(steps, removed) {
  if (!removed.size) return steps;
  return steps
    .filter((s) => !removed.has(s.id))
    .map((s) => {
      if (!Array.isArray(s.answers)) return s;
      return {
        ...s,
        answers: s.answers.map((a) => (a.next && removed.has(a.next) ? { ...a, next: null } : a)),
      };
    });
}

/**
 * Turn stored steps into the steps a visitor is served: estimate steps gain the
 * facts the runner needs (band labels, the visibility mode, the wording for a
 * locked or gated trade) and lose everything it must not have (measurements).
 * Steps that cannot price anything are removed.
 *
 * @returns {Promise<{steps:Array, dropped:Array<{id:string,trade:string,reason:string}>}>}
 */
export async function serveFunnelSteps({ companyId, steps, language = "en" }) {
  const estimateSteps = funnelEstimateSteps(steps);
  if (!estimateSteps.length) return { steps, dropped: [] };

  const configs = await loadFunnelTradeConfigs(
    companyId,
    estimateSteps.map((s) => s.trade),
  );

  const dropped = [];
  const replaced = new Map();

  for (const step of estimateSteps) {
    const config = step.trade ? configs.get(step.trade) : null;
    if (!config) {
      dropped.push({ id: step.id, trade: step.trade, reason: step.trade ? "trade_not_enabled" : "no_trade" });
      continue;
    }

    // Dry-run every band through the real pricer. Only the ones that produce a
    // number are offered.
    const bands = [];
    for (const band of step.bands || []) {
      const usable = resolveEstimateBand(step, band.id);
      if (!usable) continue;
      const priced = await priceFunnelBand({ step, band: usable, config });
      if (priced.ok) bands.push({ id: band.id, label: band.label });
    }

    if (!bands.length) {
      dropped.push({ id: step.id, trade: step.trade, reason: "no_priceable_band" });
      continue;
    }

    const visibility = visibilityFor(config);
    replaced.set(step.id, {
      id: step.id,
      kind: step.kind,
      order: step.order,
      headline: step.headline,
      subhead: step.subhead,
      sizeQuestion: step.sizeQuestion,
      buttonText: step.buttonText,
      // Labels only. No values, no rates — see the header.
      bands,
      tradeLabel: tradeLabel(step.trade),
      // A mode name, not a price: "we reveal after you submit" tells a
      // competitor nothing they couldn't learn by filling the form in.
      estimateDisplay: visibility,
      ...(visibility === "after_submit" && { lockedMessage: lockedEstimateMessage(language) }),
      ...(visibility === "gated" && { gatedMessage: gatedMessage(language, "prompt") }),
    });
  }

  const removed = new Set(dropped.map((d) => d.id));
  const served = withoutSteps(steps, removed).map((s) => replaced.get(s.id) || s);
  return { steps: served, dropped };
}
