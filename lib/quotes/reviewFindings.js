// lib/quotes/reviewFindings.js
//
// The three cost-and-price findings of the quote review, computed in code.
//
// ── What each one answers ──────────────────────────────────────────────────
//
//   priceFinding    "Is this price what you usually win at?" — per unit of
//                   measured work when the quote and the history both carry
//                   one (lib/quotes/primaryMeasure.js), on the total only
//                   when they don't, and it always says which.
//   marginFinding   "Does this quote hit your target margin?" — off the SAME
//                   costing object the Cost & margin block shows, never a
//                   second calculation, and naming in plain words why not.
//   actualsFinding  "What did jobs like this really cost you?" — the measured
//                   overrun on the company's closed jobs in this trade
//                   (lib/analytics/estimateAccuracy.js), applied to this
//                   quote's estimate to say what the margin becomes.
//
// The second and third are INTERNAL. They contain cost figures, and cost
// figures never reach a client-facing surface (AGENTS.md non-negotiables
// #4/#5). Two guarantees enforce that outside this file: the review route
// strips them for a viewer without the jobCosting toggle (lib/quotes/
// reviewRedaction.js), and the writing pass's output schema has no field a
// number could travel in (lib/ai/quoteReview.js WRITING_SCHEMA, pinned by
// scripts/check-quote-price-check.mjs).
//
// PURE. Every function takes rows already loaded and returns a finding. The
// loading lives in lib/ai/quoteReview.js; the sentences live in
// app/i18n/appMessages.js under app.quoteReview.f.*, and every finding
// carries both the English rendering (`detail`) and the template reference
// (`i18n`) — see lib/quotes/reviewSentence.js for why.

import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { formatAppMoney } from "@/lib/format/money";
import { pricePerUnit } from "@/lib/quotes/primaryMeasure";
import { TOLERANCE_PCT } from "@/lib/analytics/estimateAccuracy";
import { labourCalibration } from "@/lib/costing/labourCalibration";
import { materialCalibration } from "@/lib/costing/materialCalibration";
import { resolveParams, fillTemplate } from "@/lib/quotes/reviewSentence";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round1 = (v) => Math.round(num(v) * 10) / 10;
// Sentences carry whole percents — "8% against 25%" is what a contractor
// reads; the finding's data keeps a decimal for anything that graphs it.
const pct0 = (v) => Math.round(num(v));

/**
 * Below this there isn't a pattern, there's a coincidence. Telling someone
 * their price is high based on two past quotes is worse than saying nothing,
 * because they might act on it. Shared with the actuals finding, which reads
 * the roll-up's own floor (the same 5) rather than this constant — see
 * lib/analytics/estimateAccuracy.js MIN_SAMPLE.
 */
export const MIN_SAMPLE = 5;

/** Above this ratio to the usual, a price is "high"; below `LOW_RATIO`, "low". */
export const HIGH_RATIO = 1.25;
export const LOW_RATIO = 0.7;

/** Median rather than mean — one $40k outlier shouldn't move the yardstick. */
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const K = "app.quoteReview.f.";
const money = (amount, digits = 0) => ({ money: num(amount), digits });
const unitParam = (unit) => ({ t: `app.quoteReview.unit_${unit}` });

/**
 * Render a template in English with the company's currency — the `detail`
 * that is STORED. The panel re-renders the same `i18n` in the reader's
 * language; both go through resolveParams, so a money param formats the
 * same way in both places.
 */
export function renderEnglish(i18n, { currency } = {}) {
  if (!i18n?.key) return "";
  const values = resolveParams(i18n.params, {
    translate: (k) => APP_MESSAGES.en[k] ?? k,
    money: (amount, digits) => moneyEn(amount, digits, currency),
  });
  return fillTemplate(APP_MESSAGES.en[i18n.key], values);
}

/** "$4,140", not "CA$4,140": the English rendering is the company's own. */
const EN_LOCALE = { CAD: "en-CA", USD: "en-US", GBP: "en-GB", AUD: "en-AU", NZD: "en-NZ" };

function moneyEn(amount, digits, currency) {
  // formatAppMoney fixes the digits to the currency's minor unit; a per-unit
  // rate wants "$2.95" and a total wants "$4,200", so the digits are ours.
  try {
    return Number(amount).toLocaleString(EN_LOCALE[currency] || "en", {
      style: "currency",
      currency: currency || "CAD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return formatAppMoney(amount, currency || "CAD", "en");
  }
}

const finish = (finding, currency) => ({
  ...finding,
  detail: renderEnglish(finding.i18n, { currency }),
  ...(finding.titleI18n ? { title: renderEnglish(finding.titleI18n, { currency }) } : {}),
});

// ───────────────────────────────────────────────────────────────────────────
// Price — per unit when both sides carry one, on the total otherwise
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param quote    { total, scopeGroups: [{ categoryKey, categoryLabel,
 *                   takeoff, intakeValues, subtotal }] }
 * @param history  accepted and declined quotes in the same categories:
 *                 [{ status, total, scopeGroups: [{ categoryKey, takeoff,
 *                   intakeValues, subtotal }] }]
 * @param currency the company's billing currency
 */
export function priceFinding({ quote, history = [], currency } = {}) {
  const groups = Array.isArray(quote?.scopeGroups) ? quote.scopeGroups : [];

  // The group this quote is mostly about: the biggest measured one. A
  // two-trade quote is compared on its main trade's rate, and the sentence
  // names the trade so nobody reads a painting rate as the whole quote.
  const measured = groups
    .map((g) => ({ g, m: pricePerUnit(g) }))
    .filter((x) => x.m)
    .sort((a, b) => num(b.g.subtotal) - num(a.g.subtotal))[0] || null;

  const accepted = history.filter((h) => h.status === "accepted");
  const declined = history.filter((h) => h.status === "declined");

  if (measured) {
    const { g, m } = measured;
    const rates = accepted
      .flatMap((h) => (Array.isArray(h.scopeGroups) ? h.scopeGroups : []))
      .filter((hg) => hg.categoryKey === g.categoryKey)
      .map((hg) => pricePerUnit(hg))
      .filter((r) => r && r.unit === m.unit)
      .map((r) => r.perUnit);

    if (rates.length >= MIN_SAMPLE) {
      const usual = median(rates);
      const ratio = usual > 0 ? m.perUnit / usual : 1;
      const base = {
        basis: "per_unit",
        categoryKey: g.categoryKey,
        categoryLabel: g.categoryLabel || null,
        unit: m.unit,
        quantity: m.quantity,
        perUnit: m.perUnit,
        usualPerUnit: Math.round(usual * 100) / 100,
        sampleSize: rates.length,
      };
      const params = {
        perUnit: money(m.perUnit, 2),
        usual: money(usual, 2),
        unit: unitParam(m.unit),
        count: rates.length,
        trade: g.categoryLabel || g.categoryKey,
      };
      if (ratio > HIGH_RATIO) {
        return finish(
          {
            ...base,
            verdict: "high",
            i18n: { key: `${K}price.unit.high`, params: { ...params, pct: Math.round((ratio - 1) * 100) } },
          },
          currency,
        );
      }
      if (ratio < LOW_RATIO) {
        return finish(
          {
            ...base,
            verdict: "low",
            i18n: { key: `${K}price.unit.low`, params: { ...params, pct: Math.round((1 - ratio) * 100) } },
          },
          currency,
        );
      }
      return finish(
        { ...base, verdict: "in_range", i18n: { key: `${K}price.unit.inRange`, params } },
        currency,
      );
    }

    // The quote is measured and the history is not (or barely). Compared on
    // the total, and the sentence says so and says why — the old hedge about
    // a bigger job then applies again, because on a total it is true.
    return totalPath({
      quote,
      accepted,
      declined,
      currency,
      why: {
        key: `${K}price.total.whyFewMeasured`,
        params: {
          n: rates.length,
          trade: g.categoryLabel || g.categoryKey,
          unit: unitParam(m.unit),
        },
      },
    });
  }

  return totalPath({
    quote,
    accepted,
    declined,
    currency,
    why: { key: `${K}price.total.whyNoMeasure`, params: {} },
  });
}

function totalPath({ quote, accepted, declined, currency, why }) {
  const acceptedTotals = accepted.map((h) => num(h.total)).filter((t) => t > 0);
  const declinedTotals = declined.map((h) => num(h.total)).filter((t) => t > 0);
  const base = { basis: "total", sampleSize: acceptedTotals.length, why: why?.key ? why : null };

  // The "why" prefix and the verdict sentence are two templates joined by a
  // space, so a translator can reorder each without the other.
  const withWhy = (i18n) => ({
    ...i18n,
    // Rendered by joining: the panel and renderEnglish both read `parts`.
    parts: why?.key ? [why, { key: i18n.key, params: i18n.params }] : undefined,
  });

  if (acceptedTotals.length < MIN_SAMPLE) {
    return finishParts(
      {
        ...base,
        verdict: "insufficient_data",
        i18n: withWhy({ key: `${K}price.total.insufficient`, params: { count: acceptedTotals.length } }),
      },
      currency,
    );
  }

  const total = num(quote.total);
  const medianAccepted = median(acceptedTotals);
  const medianDeclined = declinedTotals.length >= MIN_SAMPLE ? median(declinedTotals) : null;
  const sorted = [...acceptedTotals].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const ratio = medianAccepted > 0 ? total / medianAccepted : 1;
  const shared = { ...base, medianAccepted, medianDeclined };
  const params = { median: money(medianAccepted), count: acceptedTotals.length };

  if (total > p75 && ratio > HIGH_RATIO) {
    const alsoDeclined = medianDeclined && total > medianDeclined;
    return finishParts(
      {
        ...shared,
        verdict: "high",
        i18n: withWhy({
          key: alsoDeclined ? `${K}price.total.highAlsoDeclined` : `${K}price.total.high`,
          params: {
            ...params,
            pct: Math.round((ratio - 1) * 100),
            ...(alsoDeclined ? { declined: money(medianDeclined) } : {}),
          },
        }),
      },
      currency,
    );
  }
  if (ratio < LOW_RATIO) {
    return finishParts(
      {
        ...shared,
        verdict: "low",
        i18n: withWhy({ key: `${K}price.total.low`, params: { ...params, pct: Math.round((1 - ratio) * 100) } }),
      },
      currency,
    );
  }
  return finishParts(
    { ...shared, verdict: "in_range", i18n: withWhy({ key: `${K}price.total.inRange`, params }) },
    currency,
  );
}

/** A finding whose sentence is several templates joined by a space. */
function finishParts(finding, currency) {
  const parts = finding.i18n.parts || [finding.i18n];
  return {
    ...finding,
    detail: parts.map((p) => renderEnglish(p, { currency })).join(" "),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Margin against the company's target
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param costing     the object GET /api/quotes/[id]/costing serves — saved
 *                    or derived (lib/costing/quoteCostEstimate.js
 *                    loadQuoteCosting) — or null when the quote is unknown
 * @param target      { pct, isDefault } from lib/costing/marginTarget.js
 * @param scopeGroups [{ categoryKey, label, subtotal }] — the quote's own
 *                    groups, so a costing group can be held against the
 *                    price it carries
 * @returns a finding, or null when costing is null (nothing to say)
 */
export function marginFinding({ costing, target, scopeGroups = [], currency } = {}) {
  if (!costing) return null;
  const targetPct = num(target?.pct);
  const isDefault = Boolean(target?.isDefault);
  const tail = isDefault ? { key: `${K}margin.setYours`, params: {} } : null;

  // Nothing was costed at save, or nothing CAN be costed. Said instead of a
  // margin: the derived figures are today's rates against an assumed wage,
  // and holding those to a target would be holding a guess to a promise.
  if (costing.costBasisMissing || !costing.saved || costing.marginPct == null) {
    return withTitle(
      {
        id: "margin_not_costed",
        severity: "medium",
        verdict: "not_costed",
        targetPct,
        targetIsDefault: isDefault,
        titleI18n: { key: `${K}margin.notCostedTitle`, params: {} },
        i18n: {
          key: `${K}margin.notCosted`,
          params: {},
          parts: [{ key: `${K}margin.notCosted`, params: {} }, ...(tail ? [tail] : [])],
        },
      },
      currency,
    );
  }

  const marginPct = round1(costing.marginPct);
  // "against your 25% target" and "against the 20% default" are their own
  // templates, rendered first and handed to the title as text, so each
  // translates independently of the title around it.
  const against = isDefault
    ? { key: `${K}margin.againstDefault`, params: { pct: targetPct } }
    : { key: `${K}margin.againstTarget`, params: { pct: targetPct } };

  const rate = num(costing.blendedRate) > 0 ? num(costing.blendedRate) : num(costing.labourRate);
  const incomplete = costing.costIncomplete ? { key: `${K}margin.incomplete`, params: {} } : null;
  const unpriced =
    num(costing.unpricedMaterials) > 0
      ? { key: `${K}margin.unpriced`, params: { n: Math.trunc(num(costing.unpricedMaterials)) } }
      : null;

  if (marginPct >= targetPct) {
    return withTitle(
      {
        id: "margin_on_target",
        severity: null,
        verdict: "on_target",
        marginPct,
        targetPct,
        targetIsDefault: isDefault,
        titleI18n: { key: `${K}margin.onTargetTitle`, params: { margin: pct0(marginPct), against } },
        i18n: {
          key: `${K}margin.onTarget`,
          params: { cost: money(costing.estimatedCost), price: money(costing.price) },
          parts: [
            { key: `${K}margin.onTarget`, params: { cost: money(costing.estimatedCost), price: money(costing.price) } },
            ...(unpriced ? [unpriced] : []),
            ...(incomplete ? [incomplete] : []),
            ...(tail ? [tail] : []),
          ],
        },
      },
      currency,
    );
  }

  // Which lines carry the gap. Each costing group's own hours and materials
  // against the price its scope group carries; a group under the target is
  // named with its numbers, up to three. This is the "why" in plain words:
  // not "your margin is low" but "the painting is 41 hours and $620 of
  // materials against $2,100".
  const priced = groupGaps({ costing, scopeGroups, rate, targetPct });
  const gapParts = priced.slice(0, 3).map((g) => ({
    key: `${K}margin.groupGap`,
    params: {
      label: g.label,
      hours: g.hours,
      materials: money(g.materials),
      price: money(g.price),
      margin: pct0(g.marginPct),
    },
  }));

  const severity = marginPct < 0 || marginPct < targetPct / 2 ? "high" : "medium";
  const lead = {
    key: `${K}margin.below`,
    params: {
      cost: money(costing.estimatedCost),
      price: money(costing.price),
      hours: round1(costing.labourHours),
      rate: money(rate, 0),
      labour: money(costing.labourCost),
      materials: money(costing.materialTotal),
      overhead: money(costing.overhead),
    },
  };
  return withTitle(
    {
      id: "margin_below_target",
      severity,
      verdict: "below",
      marginPct,
      targetPct,
      targetIsDefault: isDefault,
      thinLines: priced.map((g) => ({ label: g.label, categoryKey: g.categoryKey, marginPct: g.marginPct })),
      titleI18n: { key: `${K}margin.belowTitle`, params: { margin: pct0(marginPct), against } },
      i18n: {
        key: `${K}margin.below`,
        params: lead.params,
        parts: [lead, ...gapParts, ...(unpriced ? [unpriced] : []), ...(incomplete ? [incomplete] : []), ...(tail ? [tail] : [])],
      },
    },
    currency,
  );
}

function groupGaps({ costing, scopeGroups, rate, targetPct }) {
  const groups = Array.isArray(costing.groups) ? costing.groups : [];
  const stored = Array.isArray(scopeGroups) ? scopeGroups : [];
  const out = [];
  for (const g of groups) {
    const match =
      stored.find((s) => s.categoryKey === g.categoryKey && (s.label ?? null) === (g.label ?? null)) ||
      stored.find((s) => s.categoryKey === g.categoryKey);
    const price = num(match?.subtotal);
    if (price <= 0) continue;
    const hours = num(g.labourHours);
    const materials = num(g.materialTotal);
    const cost = hours * rate + materials;
    const marginPct = round1(((price - cost) / price) * 100);
    if (marginPct >= targetPct) continue;
    out.push({
      label: g.label || match?.label || g.categoryKey,
      categoryKey: g.categoryKey,
      hours: round1(hours),
      materials,
      price,
      marginPct,
    });
  }
  return out.sort((a, b) => a.marginPct - b.marginPct);
}

/**
 * Titles with a nested "against" phrase: the phrase is rendered first (it is
 * a template of its own so "against your 25% target" and "against the 20%
 * default" translate independently), then handed to the title as text. The
 * panel does the same two-step in the reader's language.
 */
function withTitle(finding, currency) {
  const t = finding.titleI18n;
  const againstText = t?.params?.against ? renderEnglish(t.params.against, { currency }) : null;
  const title = t
    ? fillTemplate(
        APP_MESSAGES.en[t.key],
        resolveParams({ ...t.params, against: againstText }, {
          translate: (k) => APP_MESSAGES.en[k] ?? k,
          money: (a, d) => moneyEn(a, d, currency),
        }),
      )
    : undefined;
  const parts = finding.i18n.parts || [finding.i18n];
  return {
    ...finding,
    title,
    detail: parts.map((p) => renderEnglish(p, { currency })).join(" "),
  };
}
// ───────────────────────────────────────────────────────────────────────────
// Actuals — what jobs like this really cost, applied to this quote
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param costing      as for marginFinding (may be null / not saved)
 * @param accuracy     buildEstimateAccuracy's result over the company's
 *                     closed jobs, or null when none were loaded
 * @param categoryKey  the quote's main trade, categoryLabel its name
 * @returns a finding, never null: the "too few" sentence is itself a finding,
 *          so the panel always says whether history was consulted
 */
export function actualsFinding({ costing, accuracy, categoryKey, categoryLabel, currency } = {}) {
  const trade = categoryLabel || categoryKey || "";
  const segment = (dim) => {
    const d = accuracy?.dimensions?.[dim];
    if (!d) return { reported: null, sample: 0 };
    const hit = d.segments?.trade?.reported?.find((s) => s.key === categoryKey) || null;
    const sup = d.segments?.trade?.suppressed?.find((s) => s.key === categoryKey) || null;
    return { reported: hit, sample: hit?.sample ?? sup?.sample ?? 0 };
  };
  const labour = segment("labourHours");
  const materials = segment("materials");
  const minSample = num(accuracy?.minSample) || MIN_SAMPLE;

  const signal = (seg) =>
    seg.reported && seg.reported.reportable && seg.reported.medianPct != null
      ? { pct: round1(seg.reported.medianPct), sample: seg.reported.sample, tone: seg.reported.tone }
      : null;
  const l = signal(labour);
  const m = signal(materials);
  const abs = (pct) => pct0(Math.abs(pct));

  if (!l && !m) {
    return finishParts(
      {
        id: "actuals_too_few",
        severity: null,
        verdict: "too_few",
        categoryKey,
        sample: labour.sample,
        needed: minSample,
        i18n: { key: `${K}actuals.tooFew`, params: { n: labour.sample, needed: minSample, trade } },
      },
      currency,
    );
  }

  const costed = Boolean(costing && costing.saved && costing.marginPct != null && !costing.costBasisMissing);
  const dir = (pct) => ({ t: `${K}${pct >= 0 ? "over" : "under"}` });

  // Both within tolerance: the costing holds, and that is worth a sentence
  // too — silence would read as "history was not checked".
  // Which dimension(s) the sentence may claim: only one that was reportable.
  // "Within 5% on hours and materials" when only materials were recorded is
  // the padding-absent-data failure, so the labour-only and materials-only
  // sentences say what was NOT recorded.
  const onTarget = (s) => s && s.tone === "on_target";
  if ((l ? onTarget(l) : true) && (m ? onTarget(m) : true)) {
    const key = l && m ? "onTarget" : l ? "onTargetLabour" : "onTargetMaterials";
    return finishParts(
      {
        id: "actuals_on_target",
        severity: null,
        verdict: "on_target",
        categoryKey,
        labour: l,
        materials: m,
        i18n: {
          key: `${K}actuals.${key}`,
          params: { n: (l || m).sample, trade, tolerance: TOLERANCE_PCT },
        },
      },
      currency,
    );
  }

  // The adjusted margin: each dimension's median overrun applied to this
  // quote's own estimate of that dimension. Labour by hours — the roll-up's
  // hours dimension is the cleanest signal (a rate change is not an
  // estimating error) — and materials by money.
  let adjustedMarginPct = null;
  if (costed) {
    const price = num(costing.price);
    const extraLabour = l && !onTarget(l) ? num(costing.labourCost) * (l.pct / 100) : 0;
    const extraMaterials = m && !onTarget(m) ? num(costing.materialTotal) * (m.pct / 100) : 0;
    const adjustedCost = num(costing.estimatedCost) + extraLabour + extraMaterials;
    adjustedMarginPct = price > 0 ? round1(((price - adjustedCost) / price) * 100) : null;
  }
  const marginPct = costed ? round1(costing.marginPct) : null;

  const useL = l && !onTarget(l);
  const useM = m && !onTarget(m);
  let lead;
  if (useL && useM) {
    lead = {
      key: `${K}actuals.both`,
      params: {
        trade,
        lp: abs(l.pct),
        ldir: dir(l.pct),
        nl: l.sample,
        mp: abs(m.pct),
        mdir: dir(m.pct),
        nm: m.sample,
      },
    };
  } else if (useL) {
    lead = { key: `${K}actuals.labour`, params: { n: l.sample, trade, pct: abs(l.pct), dir: dir(l.pct) } };
  } else {
    lead = { key: `${K}actuals.materials`, params: { n: m.sample, trade, pct: abs(m.pct), dir: dir(m.pct) } };
  }

  const worse = adjustedMarginPct != null && marginPct != null && adjustedMarginPct < marginPct;
  const consequence = !costed
    ? { key: `${K}actuals.notCosted`, params: {} }
    : {
        key: `${K}actuals.${useL && useM ? "atThoseRates" : "atThatRate"}${worse ? "" : "Better"}`,
        params: { adjusted: pct0(adjustedMarginPct), margin: pct0(marginPct) },
      };

  // Severity follows what the adjusted margin does to the target: only a
  // costed quote pushed under its target by history is a thing to fix.
  const targetPct = costed ? num(costing.marginTargetPct) : null;
  const severity =
    costed && worse && adjustedMarginPct < targetPct
      ? adjustedMarginPct < 0 || adjustedMarginPct < targetPct / 2
        ? "high"
        : "medium"
      : null;

  return finishParts(
    {
      id: "actuals_adjusted",
      severity,
      verdict: costed ? "adjusted" : "history_only",
      categoryKey,
      labour: useL ? l : null,
      materials: useM ? m : null,
      marginPct,
      adjustedMarginPct,
      i18n: { key: lead.key, params: lead.params, parts: [lead, consequence] },
    },
    currency,
  );
}

// ───────────────────────────────────────────────────────────────────────────
// "Update my costing" — which saved rate could absorb the measured overrun
// ───────────────────────────────────────────────────────────────────────────

/**
 * The close-out's calibration, fed the history's overrun instead of one
 * job's timesheet.
 *
 * Exactly the two modules the close-out uses, exactly their rules: a
 * suggestion only where a saved rate has a path to change, never for
 * hand-added hours, never for a rate that has nowhere to go. The "actual"
 * handed to them is this quote's own estimate scaled by the measured
 * factor — what the job would record if it ran the way the last eight did.
 *
 * @param labourPct    median overrun on hours (+18 = 18% over), or null
 * @param materialsPct median overrun on materials, or null
 * @param inputs       lib/costing/calibrationInputs.js's result
 * @param estimatedHours  this quote's costed hours (QuoteCosting.labourHours)
 * @returns [{ id, kind, store, categoryKey, path, from, to, deltaPct, label,
 *             unitLabel, name? }] — only offers that CAN be applied
 */
export function calibrationOffers({ labourPct, materialsPct, inputs, estimatedHours } = {}) {
  const offers = [];
  if (!inputs) return offers;
  const factorL = labourPct == null ? null : 1 + num(labourPct) / 100;
  const factorM = materialsPct == null ? null : 1 + num(materialsPct) / 100;

  if (factorL != null && num(estimatedHours) > 0) {
    const line = labourCalibration({
      estimatedHours: num(estimatedHours),
      approvedHours: num(estimatedHours) * factorL,
      groups: inputs.labourGroups,
    });
    if (line?.canApply && line.currentRate?.path) {
      offers.push({
        id: `labour:${line.categoryKey}:${line.currentRate.path}`,
        kind: "labour",
        store: line.currentRate.store,
        categoryKey: line.categoryKey,
        categoryId: inputs.keyToCategoryId?.get?.(line.categoryKey) || null,
        path: line.currentRate.path,
        from: line.currentRate.value,
        to: line.suggestedRate,
        deltaPct: line.suggestedDeltaPct,
        label: line.label || line.categoryKey,
        unitLabel: line.unitLabel || null,
        rateLabel: line.currentRate.label || null,
      });
    }
  }

  if (factorM != null) {
    const rows = (Array.isArray(inputs.groups) ? inputs.groups : []).flatMap((g) =>
      (Array.isArray(g.materials) ? g.materials : [])
        .filter((mat) => mat && num(mat.qty) > 0 && mat.basis?.path)
        .map((mat) => ({
          id: null,
          materialKey: mat.materialKey ?? null,
          categoryKey: g.categoryKey,
          name: mat.name,
          unit: mat.unit,
          qty: num(mat.qty),
          actualQty: Math.ceil(num(mat.qty) * factorM),
        })),
    );
    const lines = rows.length
      ? materialCalibration({ materials: rows, groups: inputs.groups, currentRates: inputs.currentRates })
      : [];
    for (const l of lines) {
      if (!l.canApply || !l.currentRate?.path) continue;
      offers.push({
        id: `material:${l.categoryKey}:${l.currentRate.path}`,
        kind: "material",
        store: l.currentRate.store,
        categoryKey: l.categoryKey,
        categoryId: inputs.keyToCategoryId?.get?.(l.categoryKey) || null,
        path: l.currentRate.path,
        from: l.currentRate.value,
        to: l.suggestedRate,
        deltaPct: l.deltaPct,
        label: l.categoryKey,
        name: l.name,
        unitLabel: l.unitLabel || null,
        rateLabel: l.currentRate.label || null,
      });
    }
  }
  return offers;
}
