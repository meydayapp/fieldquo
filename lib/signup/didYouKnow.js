// lib/signup/didYouKnow.js
//
// The "Did you know…" line beside every signup and welcome screen — ONE list,
// every entry carrying where its claim comes from.
//
// ══ What may go on it ══════════════════════════════════════════════════════
//
// The owner's rule for this panel (2026-09-29): no borrowed or invented
// performance statistics — no "contractors who use us win 30% more jobs",
// which is the line every competitor's signup carries and none can back.
// Two kinds of source are allowed, and `source` says which:
//
//   product      a fact about FieldQuo that is true in this codebase today —
//                `ref` names the file that makes it true, so a check can
//                confirm the file still exists and a reader can go and look.
//   arithmetic   a sum, stated with its inputs. The sentence's figure is
//                COMPUTED from the constants below by `compute`, never typed:
//                change an input and the sentence changes with it.
//
// A fact with any other source, or a product fact whose `ref` is gone, fails
// scripts/check-welcome-flow.mjs.

/** The inputs of the admin-time sum. Named, so the sentence cannot drift. */
export const ADMIN_HOURS_SAVED_PER_WEEK = 5;
export const ADMIN_HOURLY_VALUE = 25;
export const WORKING_WEEKS_PER_YEAR = 52;

/** 5 h × $25 × 52 weeks. */
export function yearlyAdminValue({
  hours = ADMIN_HOURS_SAVED_PER_WEEK,
  rate = ADMIN_HOURLY_VALUE,
  weeks = WORKING_WEEKS_PER_YEAR,
} = {}) {
  return hours * rate * weeks;
}

/**
 * The sum's inputs and result are US dollars as the owner stated them
 * ("$25 an hour … $6,500 a year") — an illustration, not the company's own
 * money (on /signup there is no company currency yet). Formatted here, with
 * the currency named, rather than a "$" typed into eight catalogues
 * (check:app-currency). A fixed locale, because this renders on the server too.
 */
export const ADMIN_SUM_CURRENCY = "USD";
function dollars(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: ADMIN_SUM_CURRENCY, maximumFractionDigits: 0 }).format(n);
}

export const DID_YOU_KNOW = Object.freeze([
  Object.freeze({
    key: "every_feature",
    source: "product",
    // Features are gated per company only by what the platform console
    // withholds (lib/features/), never by the plan a company is on; the
    // seat ladder prices people, not features.
    ref: "app/(marketing)/pricing/PricingPlans.js",
    textKey: "app.welcome.fact.everyFeature",
    text: "Every feature, on every plan.",
  }),
  Object.freeze({
    key: "admin_hours",
    source: "arithmetic",
    textKey: "app.welcome.fact.adminHours",
    // The figure, large, on the panel over the photo; the sentence under it
    // says where it comes from. Filled from the same compute().
    headlineKey: "app.welcome.fact.adminHours.headline",
    headline: "{total} a year",
    text: "If FieldQuo saves you {hours} hours of admin a week, at {rate} an hour that's {total} a year.",
    inputs: Object.freeze({
      hours: ADMIN_HOURS_SAVED_PER_WEEK,
      rate: ADMIN_HOURLY_VALUE,
      weeks: WORKING_WEEKS_PER_YEAR,
    }),
    compute: () => ({
      hours: ADMIN_HOURS_SAVED_PER_WEEK,
      rate: dollars(ADMIN_HOURLY_VALUE),
      total: dollars(yearlyAdminValue()),
    }),
  }),
  Object.freeze({
    key: "pay_by_card",
    source: "product",
    // The client pays from the quote's deposit link or the invoice's pay
    // button through the contractor's own Stripe Connect account.
    ref: "lib/stripe.js",
    textKey: "app.welcome.fact.payByCard",
    headlineKey: "app.welcome.fact.payByCard.headline",
    headline: "Get paid by card",
    text: "Clients can pay by card right from your quote or invoice link.",
  }),
]);

/** The values a fact's sentence is filled with — {} for a product fact. */
export function factValues(fact) {
  return typeof fact?.compute === "function" ? fact.compute() : {};
}

/** Which fact a step shows: one per screen, in turn, so each is seen. */
export function factForStep(step, steps = []) {
  const i = Math.max(0, (Array.isArray(steps) ? steps : []).indexOf(step));
  return DID_YOU_KNOW[i % DID_YOU_KNOW.length];
}
