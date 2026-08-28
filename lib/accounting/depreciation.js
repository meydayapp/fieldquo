// lib/accounting/depreciation.js
//
// What a capital item costs the business per month, and — the point of the
// file — how that number coexists with the loan that bought it without the
// same truck being charged twice.
//
// ══ The problem, in the owner's words ══════════════════════════════════════
//
//   "i have a truck i still pay it is an overhead but it's also an asset that
//    depreciates."
//
// Three true things about one truck:
//
//   1. a DEBT      — the payment leaving the bank each month (model Debt)
//   2. an ASSET    — $60,000 wearing out over five years, which is a real
//                    $12,000 a year whether or not the loan is still running
//   3. an OVERHEAD — that cost has to be recovered in the hourly rate
//
// Both ways of getting this wrong are expensive, and they fail in opposite
// directions:
//
//   * Count the loan payment and nothing else. The loan ends, the payment is
//     dropped, and the truck is still wearing out and still needs replacing.
//     The break-even price silently falls below the truth — the worst shape of
//     bug this codebase has, because the screen looks right.
//
//   * Count the loan payment AND the depreciation. Now the same $60,000 is
//     charged twice, because the payment is repaying capital that depreciation
//     is already charging for. The floor is too high and every quote loses.
//
// On a profit and loss you charge DEPRECIATION plus the loan INTEREST, and
// never the whole payment. The principal portion of a payment is not a cost at
// all — it is a liability being settled with money the business already has.
//
// ══ The rule this file implements, and why ═════════════════════════════════
//
//   A debt with a linked asset contributes its INTEREST only. The asset's
//   depreciation is carrying the capital cost, so charging the principal too
//   would be the double count.
//
//   A debt with NO linked asset contributes its WHOLE payment. Nothing else is
//   carrying that cost, and quietly dropping the principal would make the
//   floor fall below the truth — the first failure above, arrived at by being
//   clever.
//
// The consequence is deliberate: linking an asset to its loan is the action
// that FIXES the double count. It is never a silent behaviour change, and the
// two states are both defensible on their own. What the app must not do is
// guess — so when there are unlinked assets AND unlinked debts sitting side by
// side, assetOverhead() returns both lists and the screen says so, rather than
// inventing a pairing from a name match and moving a price floor on a hunch.
//
// ══ Cash out is not cost, and both are needed ══════════════════════════════
//
// lib/analytics/burnRate.js answers two questions with one number today:
// "how long does the cash last" (runway) and "what must a job cover"
// (the price floor). The truck is exactly where those two part company —
// runway wants the full $1,000 payment, the price floor wants $1,000 of
// depreciation plus $80 of interest. So this file computes the P&L side and
// burnRate reports both, rather than picking one and being wrong on the other
// screen.
//
// ══ Everything here is pure ════════════════════════════════════════════════
//
// No database, no `new Date()` without an argument reaching the maths. Every
// function takes `asOf`. scripts/check-depreciation.mjs executes all of it
// against hostile input — zero life, negative cost, salvage above cost, an
// asset bought today, one fully depreciated years ago, one disposed of
// mid-life — because that is how the real bugs in this repo get found.

/**
 * Decimal columns arrive as Prisma Decimal, string, number or null.
 *
 * `Number(null)` is 0 but `Number(undefined)` and `Number("")` are NaN, and a
 * single NaN propagates through every sum until the price floor serialises as
 * null and disappears from the screen with nothing saying why. That exact bug
 * is documented in lib/analytics/burnRate.js; this is the same defence.
 */
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** A Date, or null when the input cannot be one. Never an Invalid Date. */
function asDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Whole calendar months from `from` to `to`, never negative.
 *
 * Calendar months rather than days/30: a monthly charge that drifts by a day a
 * month would put a 60-month truck's last payment in month 59, and "how many
 * monthly charges have fallen due" is a calendar question, not an arithmetic
 * one. An asset put into service today has elapsed 0 — it is in service and
 * has depreciated nothing, which is the correct pair of answers.
 */
export function monthsBetween(from, to) {
  const a = asDate(from);
  const b = asDate(to);
  if (!a || !b) return 0;
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return months > 0 ? months : 0;
}

/**
 * cost − salvage, floored at zero.
 *
 * Three hostile inputs collapse to the same answer, and zero is the honest one
 * in all three: a negative cost (there is no such asset), a salvage value
 * above cost (it appreciates — that is not depreciation and this file must not
 * pretend to price it), and a negative salvage. Returning a negative base
 * would produce NEGATIVE depreciation, which subtracts from the company's
 * overhead and lowers its price floor. A typo must never be able to do that.
 */
export function depreciableBase(asset) {
  const cost = Math.max(0, num(asset?.cost));
  const salvage = Math.max(0, num(asset?.salvageValue));
  return Math.max(0, cost - salvage);
}

/** Useful life as a whole number of months, or 0 when unusable. */
function lifeMonths(asset) {
  const life = Math.floor(num(asset?.usefulLifeMonths));
  return life > 0 ? life : 0;
}

/**
 * The straight-line monthly charge — base ÷ life — ignoring dates entirely.
 *
 * A life of zero returns 0, not Infinity. "Wears out instantly" is not a
 * statement about a truck, it is a missing field, and Infinity in an overhead
 * total makes every downstream price Infinity or NaN.
 */
export function monthlyDepreciation(asset) {
  const life = lifeMonths(asset);
  if (!life) return 0;
  return depreciableBase(asset) / life;
}

/**
 * Everything about one asset at one moment.
 *
 * Returns a `reason` alongside the numbers rather than only the numbers,
 * because a $0 charge has four different causes and a screen that shows $0
 * without saying which is a screen that looks broken:
 *
 *   not_in_service   — the in-service date is in the future
 *   fully_depreciated— the whole base has been charged
 *   disposed         — sold, traded in or written off
 *   inactive         — retired from the register without a disposal date
 *   incomplete       — cost, life or in-service date is missing or unusable
 *
 * @param asset  { cost, salvageValue, inServiceDate, usefulLifeMonths,
 *                 disposedOn, active }
 * @param asOf   the moment to value it at — always passed, never defaulted
 *               inside the maths, so the check script can pin the clock
 */
export function assetCharge(asset, asOf) {
  const now = asDate(asOf) || new Date(0);
  const base = depreciableBase(asset);
  const life = lifeMonths(asset);
  const inService = asDate(asset?.inServiceDate);
  const disposedOn = asDate(asset?.disposedOn);
  const perMonth = monthlyDepreciation(asset);

  const empty = (reason) => ({
    monthly: 0,
    accumulated: 0,
    bookValue: Math.max(0, num(asset?.cost)),
    chargeable: false,
    reason,
  });

  // Unusable inputs charge nothing and SAY so. The alternative — inventing a
  // five-year life for an asset whose life is blank — is padding absent data
  // with a default, and the output here is a price floor.
  if (!life || !inService || base <= 0) {
    if (!life || !inService) return empty("incomplete");
    // base === 0 with a good life and date is legitimate: a fully-salvaged
    // item genuinely costs nothing to use up.
    return { ...empty("fully_depreciated"), bookValue: Math.max(0, num(asset?.salvageValue)) };
  }

  // The clock stops at disposal. Charging a truck that was sold in March for
  // April would be charging for something the business does not have.
  const stopsAt = disposedOn && disposedOn < now ? disposedOn : now;
  const elapsed = Math.min(monthsBetween(inService, stopsAt), life);
  // ── Two clamps, and they are deliberately redundant ──────────────────────
  //
  // Capping `elapsed` at the life already makes `perMonth * elapsed` equal to
  // `base` at worst, so the Math.min below can never fire. Mutation testing
  // says so out loud: breaking either clamp on its own is undetectable,
  // because the other one covers it (recorded in the mutation results rather
  // than hidden).
  //
  // Both are kept anyway. The invariant "never write down more than the thing
  // cost" is the one that must survive whatever the elapsed-months line
  // becomes next — a disposal rule, a mid-life revaluation — and the cost of
  // holding it twice is one Math.min.
  const accumulated = Math.min(base, perMonth * elapsed);
  const bookValue = Math.max(0, num(asset?.cost) - accumulated);

  if (inService > now) return { ...empty("not_in_service"), bookValue: Math.max(0, num(asset?.cost)) };
  if (disposedOn && disposedOn <= now)
    return { monthly: 0, accumulated, bookValue, chargeable: false, reason: "disposed" };
  // `active === false` is the register's own retirement flag. Treated as a
  // disposal with no date rather than as a live asset, because a row somebody
  // switched off must not keep raising the price floor.
  if (asset?.active === false)
    return { monthly: 0, accumulated, bookValue, chargeable: false, reason: "inactive" };
  if (elapsed >= life)
    return { monthly: 0, accumulated, bookValue, chargeable: false, reason: "fully_depreciated" };

  return { monthly: perMonth, accumulated, bookValue, chargeable: true, reason: "in_service" };
}

// ── Loan interest ──────────────────────────────────────────────────────────
//
// `Debt` records the ORIGINAL principal, an annual rate, a monthly payment and
// a start date. It does not record the balance, and nothing updates one, so
// the balance is amortised from those four rather than stored — a stored
// balance would be wrong the month after it was written, and wrong quietly.
//
// ── The rate is a PERCENT ──────────────────────────────────────────────────
//
// 6.9 means 6.9% a year, not 690%. Decimal(6,3) and the way every lender
// quotes a rate both point that way, and — decisively — the debt form never
// rendered an input for this column, so every existing row holds the default
// 0 and there is no legacy data in the other convention to be broken by
// saying so out loud. The form now has the input; the unit is in the label.
//
// Anything above 100% a year is refused rather than divided by 100 on a
// hunch: guessing the unit from the magnitude is how "0.5" comes to mean two
// different rates in the same column.
const MAX_ANNUAL_RATE_PCT = 100;

// 100 years. `(1 + i) ** n` overflows to Infinity for absurd n, and an
// Infinity here becomes an Infinity in the price floor.
const MAX_AMORTISED_MONTHS = 1200;

/**
 * What is still owed on a loan, amortised from its own terms.
 *
 * Clamped to [0, principal] on purpose. Above the original principal means the
 * payment does not cover the interest, which is a data-entry error rather than
 * a business plan; letting the balance grow would raise the price floor on the
 * strength of a typo. Below zero means it is paid off, and a paid-off loan
 * costs nothing.
 */
export function outstandingBalance(debt, asOf) {
  const principal = Math.max(0, num(debt?.principal));
  if (principal <= 0) return 0;

  const payment = Math.max(0, num(debt?.monthlyPayment));
  const annualPct = Math.min(Math.max(0, num(debt?.interestRate)), MAX_ANNUAL_RATE_PCT);
  const i = annualPct / 100 / 12;

  const start = asDate(debt?.startDate);
  // No start date means we cannot say how much has been repaid. The full
  // principal is the conservative answer and it is also the honest one — it is
  // what the row actually tells us.
  const n = start ? Math.min(monthsBetween(start, asOf), MAX_AMORTISED_MONTHS) : 0;

  let balance;
  if (i === 0) {
    balance = principal - payment * n;
  } else {
    const growth = (1 + i) ** n;
    balance = principal * growth - (payment * (growth - 1)) / i;
  }

  if (!Number.isFinite(balance)) return principal;
  return Math.min(principal, Math.max(0, balance));
}

/**
 * This month's interest — the only part of a loan payment that is a cost.
 *
 * Capped at the monthly payment. Negative amortisation is a real phenomenon,
 * but a P&L charge larger than the cash actually leaving the bank would make
 * the "interest instead of the payment" substitution RAISE the price floor
 * above the naive double count, which defeats the entire point of making it.
 * A loan whose interest exceeds its payment is a mis-typed rate.
 */
export function monthlyInterest(debt, asOf) {
  const annualPct = Math.min(Math.max(0, num(debt?.interestRate)), MAX_ANNUAL_RATE_PCT);
  if (annualPct <= 0) return 0;
  const payment = Math.max(0, num(debt?.monthlyPayment));
  const interest = outstandingBalance(debt, asOf) * (annualPct / 100 / 12);
  if (!Number.isFinite(interest) || interest <= 0) return 0;
  return payment > 0 ? Math.min(interest, payment) : interest;
}

function round2(n) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/**
 * The whole picture: what the asset register and the loan book together cost
 * the business in a month, on a P&L basis, with the double count removed.
 *
 * @param assets  Asset rows (companyId already applied by the caller)
 * @param debts   Debt rows — pass ALL of them; `active` is honoured here so
 *                the linkage can be judged against the same set the caller sees
 * @param asOf    the moment to value everything at
 *
 * @returns {{
 *   depreciation: number,        straight-line charge on assets in service
 *   debtInterest: number,        interest on the asset-backed loans
 *   debtPrincipalCharged: number the payments still charged in full, because
 *                                no asset is carrying their capital cost
 *   debtCash: number,            every active payment, in full — the runway number
 *   monthlyCost: number,         depreciation + interest + full-charged payments
 *   interestOnlyDebtIds: string[]
 *   fullPaymentDebtIds: string[]
 *   unlinkedAssetIds: string[]
 *   assets: [{ id, name, monthly, accumulated, bookValue, chargeable, reason,
 *              debtId, interestOnly }]
 * }}
 */
export function assetOverhead({ assets = [], debts = [], asOf } = {}) {
  const now = asDate(asOf) || new Date(0);
  const assetRows = Array.isArray(assets) ? assets : [];
  const debtRows = Array.isArray(debts) ? debts : [];

  const activeDebts = debtRows.filter((d) => d && d.active !== false);
  const debtById = new Map(activeDebts.map((d) => [d.id, d]));

  // Which loans have an asset behind them that is charging depreciation RIGHT
  // NOW. "Linked" is not enough on its own: a truck that is fully depreciated
  // or has been sold while its loan runs on is charging nothing, and swapping
  // that loan to interest-only would drop the capital cost out of the floor
  // altogether — the first failure in this file's header, reached by being
  // clever. Those loans go back to their full payment, which is the direction
  // that cannot bankrupt anybody.
  const carriedDebtIds = new Set();
  const detail = [];
  let depreciation = 0;

  for (const asset of assetRows) {
    if (!asset) continue;
    const charge = assetCharge(asset, now);
    depreciation += charge.monthly;
    const linked = asset.debtId && debtById.has(asset.debtId);
    if (charge.chargeable && linked) carriedDebtIds.add(asset.debtId);
    detail.push({
      id: asset.id,
      name: asset.name,
      monthly: round2(charge.monthly),
      accumulated: round2(charge.accumulated),
      bookValue: round2(charge.bookValue),
      chargeable: charge.chargeable,
      reason: charge.reason,
      debtId: asset.debtId || null,
      interestOnly: !!(charge.chargeable && linked),
    });
  }

  let debtInterest = 0;
  let debtPrincipalCharged = 0;
  let debtCash = 0;
  const interestOnlyDebtIds = [];
  const fullPaymentDebtIds = [];

  for (const debt of activeDebts) {
    const payment = Math.max(0, num(debt.monthlyPayment));
    debtCash += payment;
    if (carriedDebtIds.has(debt.id)) {
      debtInterest += monthlyInterest(debt, now);
      interestOnlyDebtIds.push(debt.id);
    } else {
      debtPrincipalCharged += payment;
      fullPaymentDebtIds.push(debt.id);
    }
  }

  // The pair the screen warns about. Not a guess at which asset goes with
  // which loan — a statement that the two lists exist, which is the most the
  // data supports. Pairing them by name or by amount would move a price floor
  // on a string match.
  const unlinkedAssetIds = detail
    .filter((a) => a.chargeable && !a.debtId)
    .map((a) => a.id);

  const monthlyCost = depreciation + debtInterest + debtPrincipalCharged;

  return {
    depreciation: round2(depreciation),
    debtInterest: round2(debtInterest),
    debtPrincipalCharged: round2(debtPrincipalCharged),
    debtCash: round2(debtCash),
    monthlyCost: round2(monthlyCost),
    interestOnlyDebtIds,
    fullPaymentDebtIds,
    unlinkedAssetIds,
    assets: detail,
  };
}

/**
 * "You may be counting the same truck twice."
 *
 * True only when BOTH lists are non-empty — a depreciating asset with no loan
 * behind it and a loan with no asset behind it. Either alone is ordinary (a
 * paid-off ladder rack; a working-capital loan), and warning about either
 * alone is how a warning gets switched off before the day it matters.
 */
export function doubleCountWarning(summary, debts = []) {
  if (!summary) return null;
  const unlinkedDebtIds = (summary.fullPaymentDebtIds || []).filter((id) =>
    (Array.isArray(debts) ? debts : []).some((d) => d?.id === id),
  );
  if (!summary.unlinkedAssetIds?.length || !unlinkedDebtIds.length) return null;
  return { unlinkedAssetIds: summary.unlinkedAssetIds, unlinkedDebtIds };
}
