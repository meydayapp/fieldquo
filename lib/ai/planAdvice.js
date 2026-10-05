// lib/ai/planAdvice.js
//
// "Which plan fits the AI we'll use?" — the arithmetic, with no database and
// no vendor price table in it, so the plan pickers (a "use client" screen and
// the public /pricing page) can run it as the reader types. The unit costs it
// works from are computed on the server from the metered prices
// (lib/ai/planAdviceUnits.js) and handed in.
//
// ══ The owner's ask (2026-10-04) ═══════════════════════════════════════════
//
// "Every plan keeps a cap (no unlimited — like Claude Max or SuperGrok, all
// capped). Add a recommendation in the plan picker: based on what the company
// says it will use (AI employees answering messages; commercial deep reads of
// drawings; quote reviews), recommend the plan whose AI allowance fits, with a
// short 'about N conversations / N drawing reads a month' estimate computed
// from real metered costs."
//
// ══ Two allowances, said apart — because they are paid apart ═════════════
//
// The three uses are NOT drawn from one place, and a recommendation that
// pretended they were would be the dead control AGENTS.md forbids:
//
//   * QUOTE REVIEWS spend the PLAN's monthly AI allowance (checkAiQuota,
//     lib/ai/usage.js resolveAiCap: the plan's dollar allowance, else its token
//     cap, else 750,000 tokens — never unlimited). So the plan is recommended
//     on reviews, and each plan card says about how many it covers.
//   * The AI EMPLOYEE's conversations and DRAWING READS are paid from the
//     company's AI CREDIT (the "ai" wallet — lib/ai/walletMeter.js,
//     lib/planRead/billing.js), whatever the plan. So those are answered with
//     the AI credit plan (lib/ai/imageEconomics.js BUNDLES) whose monthly
//     credit covers them — also capped: a bundle grants a fixed amount, and
//     past it the employee pauses rather than running up a bill.
//
// Every figure is an ESTIMATE from stated typical sizes (a 9,000-token
// conversation, a 20-sheet set, a ~6,000-token review) at today's vendor
// prices, rounded DOWN for "about N" so it never promises more than the
// allowance buys. The screens say "about".

/** Whole, non-negative count from a typed box; junk reads as 0. PURE. */
export function usageCount(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000) : 0;
}

/**
 * How many quote reviews a plan's allowance covers a month. PURE.
 *
 * @param allowance { cap, unit } — resolveAiCap's answer for the plan
 * @param units     { quoteReview: { tokens, micros } }
 * @returns number, or null when the allowance or the unit is unknown
 */
export function reviewsPerMonth(allowance, units) {
  // Number(null) is 0, and 0 here means "no AI" — an absent cap must read as
  // unknown, never as a statement (AGENTS.md: absence is not a statement).
  if (allowance?.cap === null || allowance?.cap === undefined || allowance?.cap === "") return null;
  const cap = Number(allowance.cap);
  if (!Number.isFinite(cap) || cap < 0) return null;
  const per = allowance.unit === "dollars" ? Number(units?.quoteReview?.micros) : Number(units?.quoteReview?.tokens);
  if (!Number.isFinite(per) || per <= 0) return null;
  return Math.floor(cap / per);
}

/** About how many of each a bundle's monthly credit buys. PURE. */
export function bundleCovers(bundle, units) {
  const credits = Number(bundle?.credits);
  const conv = Number(units?.conversationCents);
  const read = Number(units?.drawingReadCents);
  return {
    conversations: Number.isFinite(credits) && conv > 0 ? Math.floor(credits / conv) : null,
    drawingReads: Number.isFinite(credits) && read > 0 ? Math.floor(credits / read) : null,
  };
}

/**
 * The recommendation. PURE.
 *
 * @param input   { conversations, drawingReads, quoteReviews } a month
 * @param units   { conversationCents, drawingReadCents, quoteReview: { tokens, micros } }
 * @param plans   [{ id, name, priceMonthly, allowance: { cap, unit } }]
 * @param bundles [{ key, priceCents, credits }]
 */
export function recommendAiPlan({ input: rawInput, units: rawUnits, plans = [], bundles = [] } = {}) {
  // null is not "absent" to a default parameter — read both defensively.
  const input = rawInput && typeof rawInput === "object" ? rawInput : {};
  const units = rawUnits && typeof rawUnits === "object" ? rawUnits : {};
  const conversations = usageCount(input.conversations);
  const drawingReads = usageCount(input.drawingReads);
  const quoteReviews = usageCount(input.quoteReviews);

  // ── AI credit: the employee and the drawing reads ─────────────────────────
  const convCents = Number(units.conversationCents) || 0;
  const readCents = Number(units.drawingReadCents) || 0;
  const walletCents = conversations * convCents + drawingReads * readCents;
  const sorted = [...(Array.isArray(bundles) ? bundles : [])]
    .filter((b) => Number(b?.credits) > 0)
    .sort((a, b) => a.credits - b.credits);
  let credit = null;
  if (walletCents > 0 && sorted.length) {
    const fit = sorted.find((b) => b.credits >= walletCents) || null;
    const bundle = fit || sorted[sorted.length - 1];
    credit = {
      walletCents,
      bundle,
      fits: Boolean(fit),
      // Past the biggest plan: the rest is a one-time top-up, said as money.
      topUpCents: fit ? 0 : walletCents - bundle.credits,
      covers: bundleCovers(bundle, units),
    };
  }

  // ── The plan's own allowance: quote reviews ───────────────────────────────
  const rows = (Array.isArray(plans) ? plans : []).map((p) => ({
    ...p,
    reviews: reviewsPerMonth(p.allowance, units),
  }));
  let plan = null;
  if (quoteReviews > 0) {
    const fitting = rows
      .filter((p) => p.reviews !== null && p.reviews >= quoteReviews)
      .sort((a, b) => Number(a.priceMonthly) - Number(b.priceMonthly));
    const most = rows.filter((p) => p.reviews !== null).sort((a, b) => b.reviews - a.reviews)[0] || null;
    plan = fitting[0]
      ? { id: fitting[0].id, name: fitting[0].name, reviews: fitting[0].reviews, fits: true }
      : most
        ? { id: most.id, name: most.name, reviews: most.reviews, fits: false }
        : null;
  }

  return {
    input: { conversations, drawingReads, quoteReviews },
    credit,
    plan,
    reviewsByPlanId: Object.fromEntries(rows.map((p) => [p.id, p.reviews])),
  };
}
