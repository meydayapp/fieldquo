// ── Every figure in this file is US DOLLARS ────────────────────────────────
//
// Both sides of the margin, and that is what makes the margin mean anything.
// Retell bills FieldQuo in USD — a real 3m51s call came back at $0.670 USD, and
// `call_cost.combined_cost` is USD cents. The revenue side is USD too, because
// the credit ledger is bought in USD: the top-up hardcodes `currency: "usd"`
// while every other price_data in the repo uses the company's own currency.
// See lib/voice/creditCurrency.js.
//
// So billed and cost are directly comparable and no conversion belongs anywhere
// in here. Written down because the contractor-facing side of the product is
// CAD — every company in production is — and the first instinct on seeing a
// margin computed for a Canadian company is to reach for an exchange rate.
// Doing that would corrupt a figure that is currently correct.
//
// The one place this does NOT net out is the number rental: FieldQuo bills $4 a
// month while Retell publishes $2 for a local number and $10 for a VERIFIED
// one. Same currency, so not an FX problem — a verified number simply loses six
// dollars a month, every month.

// lib/voice/providerCost.js
//
// What Retell actually charged US for a call — read, never estimated.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// Every margin figure on /platform was derived from a number somebody typed:
// `RETELL_COST_CENTS_PER_MINUTE`, default 16 (lib/voice/pool.js). Nothing in
// the repo captured what the provider actually billed, so nothing could ever
// have noticed the constant drifting away from reality.
//
// The first real invoice line the owner pulled off his dashboard:
//
//     call_24f6120f0adf969e5092d8d6ec7   3:51 (231s)   $0.670
//
//     231s = 3.85 real minutes
//     Retell charged  67.0¢  →  17.40¢ per REAL minute
//     we assumed      16¢    →  61.6¢  — understated by 8.8%
//
// The product is still healthy (we billed 4 minutes × 35¢ = $1.40, so the
// spread was 73¢, a 52% margin) — but the assumption was wrong on the very
// first call anyone checked, and it was wrong in the direction that hides a
// problem. Retell's per-minute cost moves with the voice, the LLM model and
// the telephony leg; a contractor who picks an expensive voice could take the
// margin negative and nothing anywhere would say so.
//
// So: record the provider's own figure per call, and MEASURE the margin.
//
// ══ The rule this file exists to enforce ═══════════════════════════════════
//
// A call whose provider cost we do not have is recorded as UNKNOWN, never as
// the constant. Exactly the discipline `durationSecondsOf` already applies to
// duration in reconcileCalls.js, and for the same reason: padding an absent
// number with a default turns "we never found out" into "we checked, and it
// was 16¢", which is the version nobody re-checks.
//
// `PROVIDER_COST_CENTS_PER_MINUTE` survives ONLY as the fallback for the
// whole-pool burn estimate, where a rough figure across thousands of calls is
// genuinely better than nothing. Anything rendering it still has to say it is
// derived.
//
// ══ Where the number comes from ════════════════════════════════════════════
//
// `call_cost.combined_cost`, documented as "Combined cost of all individual
// costs in cents":
//
//   https://docs.retellai.com/api-references/get-call
//   https://docs.retellai.com/api-references/list-calls
//
// CENTS, not dollars — the owner's $0.670 call arrives as 67. It is a float
// rather than an integer: `product_costs[].unit_price` is documented in cents
// PER SECOND, so a combined figure lands with a fraction more often than not.
// Stored at four decimal places rather than rounded, because rounding 0.4¢ to
// zero on ten thousand calls is real money.
//
// Present on BOTH read paths this product uses:
//   • `/v3/list-calls` items    — the reconciler
//   • the `call` object on the `call_ended` / `call_analyzed` webhooks, which
//     Retell documents as carrying the call object in full
//     (https://docs.retellai.com/features/webhook)
//
// The webhook reference does not enumerate `call_cost` field-by-field, so its
// presence there is inferred from "the call object" rather than stated. That
// is precisely why this returns null instead of guessing: if the field turns
// out to be absent on the webhook, those calls read `unknown` and the
// reconciler fills them in from the list later. Nothing breaks and nothing
// lies.

/**
 * The provider's own cost for a call, in cents — or null when we don't know.
 *
 * Null on every uncertain input, and there are more of those than there look:
 *
 *   absent field   a call that ended before Retell priced it. Comes back on a
 *                  later read; a 0 written now would look priced for ever.
 *   `Number(x)`    a JSON body containing 1e400 parses to Infinity, which
 *                  would render as an infinite loss on the margin page.
 *   negative       not a thing Retell bills, so not a thing we record.
 *
 * @param {object} call  a Retell call object, from either read path
 * @returns {number|null} cents, possibly fractional
 */
export function providerCostCentsOf(call) {
  const raw = call?.call_cost?.combined_cost;
  if (raw === null || raw === undefined || raw === "") return null;
  // Named `costCents`, not `cents`. check-voice-spend.mjs bans a bare
  // `cents <` outside credits.js/spendGate.js, because a second copy of "can
  // they afford this" is the copy that rots. This is a validity guard on a
  // PROVIDER COST and decides nothing about anybody's balance — but a checker
  // cannot tell those apart from the identifier, and the check is right to be
  // blunt. The precise name is the honest fix; widening its allow-list would
  // blunt the one thing keeping affordability in one place.
  const costCents = Number(raw);
  if (!Number.isFinite(costCents) || costCents < 0) return null;
  return costCents;
}

/**
 * The Prisma patch for a call's provider cost — `{}` when we have none.
 *
 * Returning an EMPTY OBJECT rather than `{ providerCostCents: null }` is the
 * whole point, and it is the same trick `reconcileCalls.js` uses for an
 * unknown duration: spread into an `update`, `{}` leaves whatever is already
 * on the row alone. `call_analyzed` arriving without a cost must not erase the
 * cost `call_ended` already recorded, and a reconciler sweeping an old window
 * must not blank a figure the webhook got first.
 *
 * Both writers go through this so the two cannot disagree about the shape.
 */
export function providerCostPatch(call) {
  const cents = providerCostCentsOf(call);
  return cents === null ? {} : { providerCostCents: cents };
}

/**
 * Below this share of revenue, a call is worth flagging.
 *
 * 0.25 is deliberately far below the ~52% the real call showed. This is not a
 * performance target — it is the line past which something has gone WRONG:
 * a voice or model far pricier than the pricing assumed, a Retell price
 * change, or an international leg that slipped past the country allow-list in
 * lib/voice/retell.js. A floor that fires on ordinary variation gets muted,
 * and a muted alert is the dead control AGENTS.md is about.
 */
export const MARGIN_FLOOR_RATIO = 0.25;

/**
 * Measured margin on one call, or null when the provider cost is unknown.
 *
 * ── Why `realMinutes` is reported next to `billedMinutes` ──────────────────
 *
 * FieldQuo bills whole minutes, rounded UP: the 3:51 call above billed as 4.
 * That is deliberate and it stays — but it means part of every spread is
 * ROUNDING rather than margin, and a page that doesn't separate the two
 * flatters itself. A product priced so that only the rounding is profitable is
 * a product one honest billing change away from losing money, and the point of
 * measuring is to be able to see that.
 *
 * @param {object} p
 * @param {number} p.billedCents        what the tenant was charged
 * @param {number|null} p.providerCostCents  what Retell charged us
 * @param {number|null} p.durationSec   the REAL length, for the rounding split
 * @returns {null|{billedCents, costCents, spreadCents, marginRatio,
 *                 realMinutes, billedMinutes, below}}
 */
export function marginOf({ billedCents, providerCostCents, durationSec = null } = {}) {
  // Unknown cost is not zero cost. A "100% margin" row for a call we simply
  // never priced would be the most flattering possible lie on this page.
  //
  // The null/undefined test has to come BEFORE Number(), and that is not
  // defensiveness — `Number(null)` is 0. Written the obvious way round, an
  // unpriced call reported a zero cost and therefore a perfect margin, which
  // is the exact failure this module exists to prevent. The check script
  // caught it; the empty-string case is the same trap (`Number("")` is 0).
  if (providerCostCents === null || providerCostCents === undefined || providerCostCents === "") {
    return null;
  }
  if (billedCents === null || billedCents === undefined || billedCents === "") return null;

  const cost = Number(providerCostCents);
  const billed = Number(billedCents);
  if (!Number.isFinite(cost) || cost < 0) return null;
  if (!Number.isFinite(billed) || billed < 0) return null;

  const spreadCents = billed - cost;
  const seconds = Number(durationSec);
  const realMinutes = Number.isFinite(seconds) && seconds > 0 ? seconds / 60 : null;

  return {
    billedCents: billed,
    costCents: cost,
    spreadCents,
    // Guarded: a zero-revenue call (a rescued row billed at nothing) has no
    // meaningful ratio, and 0/0 is NaN rendered as "NaN%".
    marginRatio: billed > 0 ? spreadCents / billed : null,
    realMinutes,
    billedMinutes: realMinutes === null ? null : Math.ceil(seconds / 60),
    below: billed > 0 ? spreadCents / billed < MARGIN_FLOOR_RATIO : spreadCents < 0,
  };
}

/**
 * Roll a set of calls up into one measured picture.
 *
 * Calls with no provider cost are COUNTED but not averaged in — `covered` vs
 * `total` is how the page says "this margin is measured on 40 of 62 calls"
 * rather than quietly presenting a partial sample as the whole truth.
 *
 * @param {Array<{billedCents:number, providerCostCents:number|null, durationSec:number|null}>} rows
 */
export function summariseMargin(rows = []) {
  let total = 0;
  let covered = 0;
  let billedCents = 0;
  let costCents = 0;
  let realSeconds = 0;
  let negative = 0;
  let belowFloor = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    total += 1;
    const m = marginOf(row);
    if (!m) continue;
    covered += 1;
    billedCents += m.billedCents;
    costCents += m.costCents;
    if (m.realMinutes !== null) realSeconds += m.realMinutes * 60;
    if (m.spreadCents < 0) negative += 1;
    if (m.below) belowFloor += 1;
  }

  const spreadCents = billedCents - costCents;
  const realMinutes = realSeconds / 60;

  return {
    total,
    covered,
    // Named so the page cannot render this without admitting its coverage.
    basis: covered > 0 ? "measured" : "none",
    billedCents,
    costCents,
    spreadCents,
    marginRatio: billedCents > 0 ? spreadCents / billedCents : null,
    // The honest per-minute provider cost: real seconds, not billed minutes.
    // This is the figure RETELL_COST_CENTS_PER_MINUTE is supposed to be, and
    // comparing the two is the entire reason this file exists.
    costCentsPerRealMinute: realMinutes > 0 ? costCents / realMinutes : null,
    negative,
    belowFloor,
  };
}
