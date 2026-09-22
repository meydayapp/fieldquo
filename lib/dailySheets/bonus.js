// lib/dailySheets/bonus.js
//
// Performance pay: the company's rule, and what it yields for one day.
//
// ── No rule, no bonus ─────────────────────────────────────────────────────
//
// The mockup printed "+$20 / +$17" as a placeholder. The owner has not chosen
// figures, so Company.performancePayRule is NULL by default and everything
// here answers null for it: the sheet shows "No performance-pay rule — set
// one under Settings → Field work", and the pay run adds no line. A default
// of $0 would be a rule ("we pay nothing") wearing the clothes of "not
// decided"; a default of $20 would be FieldQuo deciding a contractor's
// wages. Neither is ours to make. scripts/check-daily-objectives.mjs
// asserts the null.
//
// ── The rule ──────────────────────────────────────────────────────────────
//
//   perObjectiveCents  paid for each objective marked done that day
//   allDoneCents       paid once when every objective on the sheet is done
//                      (a sheet with no objectives earns nothing here —
//                      "all of nothing" is not an achievement)
//   upsellPct          percentage of the upsells credited to the person
//   minScore           the evaluation score (1–5) below which no bonus is
//                      paid at all; 0 or null = no floor
//
// Cents and integers everywhere: a bonus is money on a payslip, and float
// arithmetic on a payslip is how someone is paid $19.999999.

const int = (v, { min = 0, max = 10_000_000 } = {}) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};

/**
 * A rule as stored, from whatever the settings screen sent. Returns null
 * for "no rule" — an empty object, every field zero, or garbage — so the
 * column holds either a rule that pays something or nothing at all.
 */
export function normalisePayRule(input) {
  if (!input || typeof input !== "object") return null;
  const rule = {
    perObjectiveCents: int(input.perObjectiveCents) ?? 0,
    allDoneCents: int(input.allDoneCents) ?? 0,
    upsellPct: (() => {
      const n = Number(input.upsellPct);
      return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : 0;
    })(),
    minScore: int(input.minScore, { min: 0, max: 5 }) ?? 0,
  };
  if (rule.perObjectiveCents === 0 && rule.allDoneCents === 0 && rule.upsellPct === 0) return null;
  return rule;
}

/**
 * The bonus for one sheet under one rule.
 *
 * @param {object|null} rule      as normalisePayRule returns it
 * @param {object} sheet          { objectives: [{status}], upsells: [{amountCents}], evaluationScore }
 * @returns {null | { cents: number, lines: Array<{ key: string, cents: number, count?: number, pct?: number, base?: number }> }}
 *   null when there is no rule. With a rule, always an object — a rule that
 *   yields nothing yields { cents: 0, lines: [] }, which the sheet prints as
 *   "$0 under the rule", a different sentence from "no rule".
 */
export function computeBonus(rule, sheet) {
  const r = normalisePayRule(rule);
  if (!r) return null;
  const objectives = Array.isArray(sheet?.objectives) ? sheet.objectives : [];
  const upsells = Array.isArray(sheet?.upsells) ? sheet.upsells : [];
  const score = Number(sheet?.evaluationScore);

  // The floor. A sheet not yet evaluated has no score; with a floor set,
  // that is "not yet", not "failed" — the bonus waits for the evaluation.
  if (r.minScore > 0) {
    if (!Number.isFinite(score)) return { cents: 0, lines: [], waitingForScore: true };
    if (score < r.minScore) return { cents: 0, lines: [{ key: "below_min_score", cents: 0, score, minScore: r.minScore }] };
  }

  const lines = [];
  const done = objectives.filter((o) => o && o.status === "done").length;
  if (r.perObjectiveCents > 0 && done > 0) {
    lines.push({ key: "per_objective", cents: r.perObjectiveCents * done, count: done });
  }
  if (r.allDoneCents > 0 && objectives.length > 0 && done === objectives.length) {
    lines.push({ key: "all_done", cents: r.allDoneCents, count: objectives.length });
  }
  if (r.upsellPct > 0) {
    const base = upsells.reduce((s, u) => {
      const c = Math.round(Number(u?.amountCents));
      return s + (Number.isFinite(c) && c > 0 ? c : 0);
    }, 0);
    if (base > 0) {
      lines.push({ key: "upsell", cents: Math.round((base * r.upsellPct) / 100), pct: r.upsellPct, base });
    }
  }
  return { cents: lines.reduce((s, l) => s + l.cents, 0), lines };
}
