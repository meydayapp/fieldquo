// lib/analytics/leadScoring.js
//
// Is a "hot" lead actually hot?
//
// ── Why this has to exist ──────────────────────────────────────────────────
//
// lib/leads/score.js is a hand-tuned weighted sum: ASAP timeline 25, emergency
// 20, a plan PDF 12, photos up to 10, phone 8, and so on, with hot at 60 and
// warm at 30. Every one of those weights is somebody's judgement about what
// predicts a sale. None of them has ever been checked against whether the sale
// happened.
//
// That is a comfortable position for a scoring model to sit in. It produces
// confident labels, staff act on them, and if the weights are wrong the only
// symptom is a sales team calling the wrong people in the wrong order —
// invisible, because nobody sees the leads they didn't call.
//
// ── What "working" means here ──────────────────────────────────────────────
//
// One thing only: hot leads convert at a higher rate than warm, and warm
// higher than cold. That is the whole claim the temperature makes. If cold
// converts as well as hot, the score is an expensive random number.
//
// ── The honest-reporting rules from tenantHealth apply here too ────────────
//
// A band with three leads has no conversion rate, it has an anecdote. Below
// the floor these report a fraction — "1 of 2" — never a percentage, and never
// a blank.

import { formatRate, MIN_SAMPLE } from "./tenantHealth";

/// Lead statuses that mean the lead turned into business. `converted` is what
/// the leads board renders as "Won" — see lib/quotes/quoteLifecycle.js, which
/// deliberately has no separate `won` value.
const WON = new Set(["converted"]);

/// Statuses that mean it is over and it did NOT convert. Anything else — new,
/// contacted — is still live and belongs in neither column.
const LOST = new Set(["lost"]);

const TEMPERATURES = ["hot", "warm", "cold"];

function rateOf(won, decided) {
  return decided >= MIN_SAMPLE && decided > 0
    ? Math.round((won / decided) * 1000) / 10
    : null;
}

/**
 * Conversion by temperature band.
 *
 * Measured against DECIDED leads, not all leads. A lead still sitting at "new"
 * has not failed to convert; it has not been worked yet. Counting it as a loss
 * would make every band look worse in a busy week and better in a quiet one,
 * which is the opposite of a useful signal.
 */
export function buildTemperatureAnalysis(leads) {
  const list = Array.isArray(leads) ? leads : [];

  const bands = TEMPERATURES.map((temp) => {
    const inBand = list.filter((l) => l.temperature === temp);
    const won = inBand.filter((l) => WON.has(l.status)).length;
    const lost = inBand.filter((l) => LOST.has(l.status)).length;
    const decided = won + lost;

    return {
      temperature: temp,
      total: inBand.length,
      open: inBand.length - decided,
      won,
      lost,
      decided,
      conversionRate: rateOf(won, decided),
      conversionLabel: formatRate(won, decided),
      medianScore: medianOf(inBand.map((l) => l.score)),
      thin: decided < MIN_SAMPLE,
    };
  });

  // ── Does the ordering actually hold? ────────────────────────────────────
  //
  // Only checked where every band has enough decided leads to have a rate. A
  // verdict drawn from two anecdotes would be worse than no verdict, because
  // it would be acted on.
  const measurable = bands.filter((b) => b.conversionRate !== null);
  const hot = bands.find((b) => b.temperature === "hot");
  const cold = bands.find((b) => b.temperature === "cold");

  let verdict = "not_enough_data";
  if (measurable.length >= 2 && hot?.conversionRate !== null && cold?.conversionRate !== null) {
    if (hot.conversionRate > cold.conversionRate * 1.5) verdict = "working";
    else if (hot.conversionRate > cold.conversionRate) verdict = "weak";
    else verdict = "not_predictive";
  }

  return {
    bands,
    verdict,
    // The one sentence the screen should lead with. Written here rather than
    // in the UI so the wording can't drift from the rule that produced it.
    summary: summaryFor(verdict, hot, cold),
  };
}

function summaryFor(verdict, hot, cold) {
  switch (verdict) {
    case "working":
      return `Hot leads convert at ${hot.conversionRate}% against ${cold.conversionRate}% for cold — the score is doing real work.`;
    case "weak":
      return `Hot converts at ${hot.conversionRate}% and cold at ${cold.conversionRate}%. The ordering holds but the gap is narrow enough that the weights are worth revisiting.`;
    case "not_predictive":
      return `Hot leads convert at ${hot.conversionRate}% and cold at ${cold.conversionRate}%. The score is not separating them — acting on temperature is currently no better than not.`;
    default:
      return "Not enough decided leads yet to say whether the score predicts anything. It needs wins and losses, not just leads.";
  }
}

function medianOf(values) {
  const s = values
    // Same trap as above: filter nulls BEFORE Number(), or every unscored lead
    // becomes a 0 and drags the median down.
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map(Number)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Which individual scoring signals actually predict a win.
 *
 * This is the part that can change the product. The model awards 25 points for
 * an ASAP timeline and 10 for photos; if photos turn out to have no
 * relationship with conversion and a plan PDF has a strong one, the weights
 * are wrong in a way no amount of staring at the code reveals.
 *
 * `lift` is the reason's conversion rate divided by the overall rate. Above 1
 * it predicts a win, below 1 it predicts the opposite, and around 1 it is
 * decoration that is currently moving people's call lists.
 */
export function buildReasonAnalysis(leads) {
  const list = Array.isArray(leads) ? leads : [];
  const decided = list.filter((l) => WON.has(l.status) || LOST.has(l.status));

  const overallWon = decided.filter((l) => WON.has(l.status)).length;
  const overallRate = decided.length ? overallWon / decided.length : null;

  const byReason = new Map();
  for (const lead of decided) {
    const reasons = Array.isArray(lead.scoreReasons) ? lead.scoreReasons : [];
    // Deduped per lead: "2 photos attached" and "3 photos attached" are the
    // same signal with different counts, and the label carries the count.
    const labels = new Set(
      reasons.map((r) => normaliseReason(r?.label)).filter(Boolean),
    );
    for (const label of labels) {
      if (!byReason.has(label)) byReason.set(label, { label, won: 0, total: 0, weight: 0 });
      const row = byReason.get(label);
      row.total += 1;
      if (WON.has(lead.status)) row.won += 1;
      const w = reasons.find((r) => normaliseReason(r?.label) === label)?.weight;
      if (Number.isFinite(Number(w))) row.weight = Number(w);
    }
  }

  return {
    overallRate: overallRate === null ? null : Math.round(overallRate * 1000) / 10,
    decidedLeads: decided.length,
    reasons: [...byReason.values()]
      .map((r) => {
        const rate = rateOf(r.won, r.total);
        return {
          ...r,
          conversionRate: rate,
          conversionLabel: formatRate(r.won, r.total),
          // Null rather than a number when either side is too thin — a lift of
          // "3.0" from two leads is the most persuasive wrong number here.
          lift:
            rate !== null && overallRate
              ? Math.round((rate / 100 / overallRate) * 100) / 100
              : null,
          thin: r.total < MIN_SAMPLE,
        };
      })
      .sort((a, b) => (b.lift ?? -1) - (a.lift ?? -1) || b.total - a.total),
  };
}

/**
 * Strip the counts out of a reason label so "2 photos attached" and "5 photos
 * attached" group as one signal.
 */
function normaliseReason(label) {
  const text = String(label || "").trim();
  if (!text) return null;
  return text
    .replace(/^\d+\s+/, "")
    .replace(/\(\d+[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/s\b/g, (m, i, str) => (i === str.length - 1 ? "" : m))
    .trim()
    .toLowerCase();
}

/**
 * Conversion by score band, to check the threshold itself.
 *
 * The cut points are 60 and 30. This says whether those are the right cut
 * points — if conversion jumps at 45, the boundary is in the wrong place and
 * every lead between 45 and 60 is being under-prioritised.
 */
export function buildScoreCalibration(leads, bandSize = 20) {
  const list = Array.isArray(leads) ? leads : [];
  const decided = list.filter(
    (l) =>
      (WON.has(l.status) || LOST.has(l.status)) &&
      // Checked as null BEFORE Number(), because Number(null) is 0 and not
      // NaN — so a Number.isFinite guard alone reads an UNSCORED lead as a
      // score of zero and files it in the 0–19 band. The chart then says
      // "leads scoring under 20 never convert" about leads that were never
      // scored at all, which is a conclusion drawn from the model's own gaps.
      //
      // This is the fourth time this exact trap has appeared in this codebase
      // (budget ceilings, booking notice hours, the settings parser). Same
      // fix each time: reject null explicitly, then convert.
      l.score !== null &&
      l.score !== undefined &&
      l.score !== "" &&
      Number.isFinite(Number(l.score)),
  );

  const buckets = new Map();
  for (const l of decided) {
    const score = Number(l.score);
    const floor = Math.min(100 - bandSize, Math.floor(score / bandSize) * bandSize);
    if (!buckets.has(floor)) buckets.set(floor, { floor, won: 0, total: 0 });
    const b = buckets.get(floor);
    b.total += 1;
    if (WON.has(l.status)) b.won += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => a.floor - b.floor)
    .map((b) => ({
      range: `${b.floor}–${b.floor + bandSize - 1}`,
      floor: b.floor,
      won: b.won,
      total: b.total,
      conversionRate: rateOf(b.won, b.total),
      conversionLabel: formatRate(b.won, b.total),
      thin: b.total < MIN_SAMPLE,
    }));
}
