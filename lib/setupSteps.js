// lib/setupSteps.js
//
// The dashboard's "Additional set-up steps" — the ten things a company should
// get round to AFTER the onboarding checklist (lib/onboarding.js) is done.
//
// ══ How this differs from onboarding, and why it is a second list ══════════
//
// Onboarding is the five things without which the product cannot work at all:
// a logo, an address, a service, a price, a way to be paid. Every one of them
// is a fact the product reads on the next quote, so every one of them is
// measured and none can be waved away.
//
// These ten are the things the product works WITHOUT but works worse without:
// no overhead means job costing shows margin against nothing; no payment
// schedule means one invoice on acceptance; no availability means the booking
// page has nothing to offer. A company can legitimately decide any of them
// does not apply to it — a one-van painter has no add-ons to review — so, per
// the owner's ask of 2026-09-08, each row can be hidden by hand as well as by
// being done.
//
// ══ The rule every row obeys ═══════════════════════════════════════════════
//
// A step is REMOVED, never ticked, the moment the database says the company
// did it. `doneWhen` reads the same rows the feature itself reads: the
// overhead step looks at the same Expense/Salary/Debt/Asset rows the burn-rate
// calculation sums, the payment-schedule step at the same PaymentScheduleStage
// rows lib/paymentSchedule/run.js fires. So a row vanishing from the card means
// the thing is genuinely on the next quote, not that a flag was set.
//
// Where nothing in the schema can distinguish "reviewed and kept as shipped"
// from "never looked at" — a company that opened its add-ons, agreed with all
// of them and changed nothing — the step stays until dismissed, and its
// comment says so. That is honest; auto-removing it on a page view would be a
// control that appears to measure something and doesn't.
//
// ══ Pure on purpose ════════════════════════════════════════════════════════
//
// This file never touches the database. The route builds a `snapshot` (one
// tenant-scoped query per signal — lib/setupStepsSnapshot.js) and hands it
// here, so scripts/check-setup-steps.mjs can execute every `doneWhen` against
// fixtures and prove each signal flips exactly one step. Absent signals are
// treated as NOT done, never as done: a snapshot with a field missing means
// the query did not run, and a step must not disappear because of a bug in
// the thing that decides whether it disappears.

import { STANDARD_ADDONS } from "@/app/data/standardAddOns";

/** `from=setup` is what tells the target page to show its "Back to home" link. */
export const SETUP_FROM_PARAM = "setup";

const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const list = (value) => (Array.isArray(value) ? value : []);

/**
 * Standard add-on prices by name, across every trade's catalogue. Used to tell
 * a product the company typed (or repriced) from one FieldQuo seeded and the
 * company never touched. Product has no updatedAt, so "touched" has to be
 * inferred from the row disagreeing with the catalogue it came from.
 */
const STANDARD_PRICES_BY_NAME = (() => {
  const map = new Map();
  for (const items of Object.values(STANDARD_ADDONS || {})) {
    for (const item of items || []) {
      if (!item?.name) continue;
      const set = map.get(item.name) || new Set();
      set.add(Number(item.unitPrice));
      map.set(item.name, set);
    }
  }
  return map;
})();

/** True when this product is byte-for-byte a seeded standard add-on. */
export function isUntouchedStandardAddOn(product) {
  if (!product || typeof product.name !== "string") return false;
  const prices = STANDARD_PRICES_BY_NAME.get(product.name.trim());
  if (!prices) return false;
  const price = product.unitPrice == null ? NaN : Number(product.unitPrice);
  return prices.has(price) && product.active !== false;
}

/**
 * The wording overrides on a service category. Any of the three columns
 * QuoteWording.js writes, non-empty, means somebody opened that panel and
 * changed something — the same test that component uses for its "customised"
 * badge, so the card and the badge agree.
 */
function wordingCustomised(row) {
  if (!row) return false;
  return Boolean(
    (Array.isArray(row.processSteps) && row.processSteps.length) ||
      (Array.isArray(row.includedItems) && row.includedItems.length) ||
      (typeof row.scopeDescription === "string" && row.scopeDescription.trim()),
  );
}

/**
 * The ten steps, in the order the owner listed them. `href` carries the
 * anchor or query that lands the reader on the right card of the right
 * page; every id named here exists in the target page's source and
 * scripts/check-setup-steps.mjs greps for each one.
 *
 * `titleKey` + `title`: the key the client renders through t(), and the
 * English that survives if the catalogue entry is ever missing.
 */
export const SETUP_STEPS = [
  {
    key: "overhead",
    titleKey: "app.setup.step.overhead",
    title: "Enter your overhead",
    href: "/app/settings/overhead#fixed-costs",
    // The four tables lib/analytics/burnRate.js sums. A recurring overhead
    // expense, a salary, a loan or an asset — any one of them is overhead
    // entered. The capacity figure (ForecastSettings) is deliberately NOT a
    // signal: it defaults to 3 on the row, so a row's existence says nothing.
    doneWhen: (s) =>
      count(s.overheadFixedCosts) +
        count(s.overheadSalaries) +
        count(s.overheadDebts) +
        count(s.overheadAssets) >
      0,
  },
  {
    key: "payment_schedule",
    titleKey: "app.setup.step.payment_schedule",
    title: "Set up your payment schedule",
    href: "/app/settings/company#payment-schedule",
    // One PaymentScheduleStage row is a schedule: validate.js refuses a set
    // that does not sum to 100, so a company with any row has a whole one.
    doneWhen: (s) => count(s.paymentScheduleStages) > 0,
  },
  {
    key: "quote_process",
    titleKey: "app.setup.step.quote_process",
    title: "Review the job process on your quotes",
    href: "/app/settings/services#quote-wording",
    // An enabled category whose wording the company overrode. A company that
    // read the default steps and liked them leaves no trace — that is what
    // the hide control is for.
    doneWhen: (s) => list(s.enabledCategories).some(wordingCustomised),
  },
  {
    key: "ai_credits",
    titleKey: "app.setup.step.ai_credits",
    title: "Add AI credits",
    href: "/app/settings/ai-credit#ai-credit",
    // A positive AI-pool balance (lib/voice/credits.js balanceFor, pool "ai")
    // or a monthly bundle subscription — either is credit to spend.
    doneWhen: (s) => count(s.aiCreditCents) > 0 || Boolean(s.aiCreditBundle),
  },
  {
    key: "instant_quotes",
    titleKey: "app.setup.step.instant_quotes",
    title: "Enable instant quotes",
    href: "/app/settings/instant-quotes#trades",
    doneWhen: (s) => count(s.instantQuotesEnabled) > 0,
  },
  {
    key: "availability",
    titleKey: "app.setup.step.availability",
    title: "Check your availability for bookings",
    href: "/app/settings/availability#bookable",
    // Bookable hours (AvailabilitySchedule — the PUBLIC window, not
    // WorkingHours) for at least one active member. An EventType on its own
    // is not enough: with no hours behind it the booking page offers nothing.
    doneWhen: (s) => count(s.bookableScheduleRows) > 0,
  },
  {
    key: "materials",
    titleKey: "app.setup.step.materials",
    title: "Review cost and material recipes",
    href: "/app/settings/material-costs#recipes",
    // A saved recipe override, or a rate card the company edited (the `rates`
    // column on a category is written only by RateCard's save).
    doneWhen: (s) =>
      count(s.materialRecipeSettings) > 0 ||
      list(s.enabledCategories).some(
        (row) => row?.rates != null && typeof row.rates === "object",
      ),
  },
  {
    key: "add_ons",
    titleKey: "app.setup.step.add_ons",
    title: "Review your add-ons",
    href: "/app/settings/products#catalogue",
    // Done when the catalogue holds anything that is not a seeded standard
    // add-on exactly as shipped: an item the company added, repriced, renamed
    // or switched off. All-standard-and-untouched, or empty, stays on the
    // card — "reviewed and agreed" is indistinguishable from "never opened",
    // and the hide control is the honest answer for that case.
    doneWhen: (s) => {
      const products = list(s.products);
      return products.length > 0 && products.some((p) => !isUntouchedStandardAddOn(p));
    },
  },
  {
    key: "emails",
    titleKey: "app.setup.step.emails",
    title: "Review your emails",
    href: "/app/settings/email-templates#templates",
    // Any of: a verified sending domain, a template the company edited after
    // it was seeded (seedDefaultTemplates writes every company a starter set,
    // so a template's existence proves nothing — its updatedAt moving does),
    // or a quote-email section switched on. Company.email is set at signup
    // for everyone, so reply-to is NOT a signal — it would tick itself.
    doneWhen: (s) =>
      s.emailDomainVerified === true ||
      count(s.editedEmailTemplates) > 0 ||
      s.quoteEmailSectionsOn === true,
  },
  {
    key: "import_jobs",
    titleKey: "app.setup.step.import_jobs",
    title: "Import older jobs",
    href: "/app/jobs/import",
    // Invoice.historicalImportedAt is stamped by the import at /app/jobs/import.
    // The snapshot reports null (not 0) while that column is not yet in the
    // generated client, and null is "not done" here — see the snapshot.
    doneWhen: (s) => count(s.historicalImports) > 0,
  },
];

export const SETUP_STEP_KEYS = SETUP_STEPS.map((s) => s.key);

/** Keep only known keys, deduplicated, in catalogue order. */
export function normaliseDismissed(value) {
  const wanted = new Set(list(value).filter((k) => typeof k === "string"));
  return SETUP_STEP_KEYS.filter((k) => wanted.has(k));
}

/**
 * `?from=setup` spliced in BEFORE the `#anchor`. Appending it to the end would
 * make the browser read "fixed-costs?from=setup" as the fragment: no element
 * has that id, so the page would not scroll, and the target page would not
 * see the param, so no "Back to home" link either — both halves of the link
 * dead at once.
 */
export function withSetupParam(href) {
  const hashAt = href.indexOf("#");
  const base = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}from=${SETUP_FROM_PARAM}${hash}`;
}

/**
 * Every step with its measured `done` and stored `dismissed`. The client hides
 * anything done OR dismissed; both are returned so the check script (and a
 * support screen, one day) can see WHY a row is absent.
 */
export function stepsFor(snapshot = {}) {
  const dismissed = new Set(normaliseDismissed(snapshot.dismissed));
  return SETUP_STEPS.map((step) => {
    let done = false;
    try {
      done = step.doneWhen(snapshot) === true;
    } catch {
      // A malformed signal is "not measured", and not measured is not done.
      done = false;
    }
    return {
      key: step.key,
      titleKey: step.titleKey,
      title: step.title,
      href: withSetupParam(step.href),
      done,
      dismissed: dismissed.has(step.key),
    };
  });
}

/** The rows the card actually shows: not done, not hidden. */
export function remainingSteps(steps) {
  return list(steps).filter((s) => !s.done && !s.dismissed);
}
