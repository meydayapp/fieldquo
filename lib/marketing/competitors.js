// lib/marketing/competitors.js
//
// What FieldQuo is allowed to say, in public, about four named companies.
//
// ══ Why this is a data model and not a table of numbers ════════════════════
//
// /pricing wants to show a visitor that FieldQuo costs less than Jobber,
// Housecall Pro, ServiceTitan and Projul. Those are real businesses. A number
// that is wrong here is not a rendering bug — it is a false public statement
// about a competitor's prices, sitting on a static page where nobody is
// watching it, for as long as it takes someone to notice.
//
// So the figures are not the interesting part of this file; the states around
// them are. Every one of the following is a DIFFERENT thing, and the bug this
// module exists to make impossible is any two of them collapsing:
//
//   • they charge nothing                    → PRICE_FREE
//   • they deliberately publish no price     → PRICE_ON_REQUEST
//   • the plan does not exist at this size   → PRICE_NOT_OFFERED
//   • we have not established their price    → PRICE_UNKNOWN
//   • they print "$4,788" and never say
//     which country's dollar                 → CURRENCY_NOT_STATED
//   • we never looked at what currency it is → CURRENCY_UNKNOWN
//   • somebody read it off the live page     → VERIFIED (+ verifiedBy)
//   • somebody remembered it in a chat       → UNVERIFIED
//   • somebody read it and did not fully
//     understand what they read              → `unresolved`
//
// AGENTS.md failure class 5: "Absence of a statement is not a statement." A
// blank where a currency should be, filled in with USD because most SaaS is
// priced in USD, is exactly that failure with a lawyer attached.
//
// ══ Why every figure carries COORDINATES, not just a number ════════════════
//
// Jobber taught this one expensively. Two summariser reads of their pricing
// page on the same day disagreed — Grow at $199 and at $156, Plus at $499 and
// at $490 — and both were "right". Their price depends on TWO selectors the
// visitor sets: team size (Just me / 2-5 / 6-10 / 11-15 / 16+) and billing
// (Annual, or Monthly split into a 1-year commitment and no commitment). A
// reader who ignores the selectors reports one arbitrary combination as "the"
// price, and two such readers disagree.
//
// So a figure without its coordinates is not a figure. Each competitor
// declares the `axes` its pricing turns on, and every figure must carry a
// value for each. ServiceTitan declares none because it publishes no price;
// that is a coordinate-free fact and it is allowed to be one.
//
// ══ Why there is no currency conversion in this file, and must never be ════
//
// The owner asked for "the CAD equivalent" of the USD figures. This module
// refuses, and is built so that adding it later is visibly a change rather
// than a fill-in-the-blank:
//
//   An FX rate is correct on the day you look it up and wrong the next. A
//   converted figure baked into a statically-rendered marketing page is a
//   number that was true once, is drifting continuously, and is a claim about
//   somebody else's prices. There is no maintenance schedule that fixes that,
//   because the page does not know the rate has moved and neither does anyone
//   else until a competitor's lawyer does the arithmetic.
//
// The ban is on US doing arithmetic. If a competitor themselves publishes a
// CAD price, that is a published fact and belongs here as a CAD figure with
// its own source URL — quoting what they print is not converting.
//
// The comparison stays honest without conversion because FieldQuo's own ladder
// carries the SAME NUMBER in both currencies (SEAT_LADDER in
// lib/pricing/ladder.js, and the long comment in app/(marketing)/pricing/page.js
// explaining why the marketing page never guesses a visitor's currency). $99
// CAD and $99 USD are both real FieldQuo prices, so a USD competitor is
// compared against the USD row and nothing has to be converted to line them up.
//
// check-competitors.mjs fails the build if any identifier here mentions a
// currency or a conversion. That is deliberate: the next person to think a
// currency helper is an obvious missing feature should have to delete an
// assertion that explains why they are wrong.
//
// ══ Why observations carry a VANTAGE POINT ═════════════════════════════════
//
// Every page below was read from a US egress, and Jobber is a Canadian company
// whose page says "All prices in USD". That establishes what a US visitor is
// shown. It does not establish "Jobber's price" — a Canadian visitor may be
// served CAD, and Canada is most of who FieldQuo competes for. `observedFrom`
// records the vantage so a figure cannot be quoted out of the geography it was
// true in.
//
// ══ Why FieldQuo's own numbers are imported, not restated ══════════════════
//
// Failure class 4. A comparison table with FieldQuo's prices typed into it is
// the copy that rots, because it is the one nobody looks at when the ladder
// changes. SEAT_LADDER is the price the product actually charges.
//
// ══ How a human marks a figure confirmed ═══════════════════════════════════
//
// Open the `source` URL. Set the SELECTORS to the figure's own coordinates.
// Read the figure off the page with your own eyes. Then, in this file:
//
//   1. set `checked` to today's date (ISO, YYYY-MM-DD),
//   2. set `verification: VERIFIED`,
//   3. set `verifiedBy` to who you are and HOW you looked — the method matters,
//      because "a summariser told me" and "I drove the page in a browser" are
//      not the same evidence, and the first version of the Jobber entry in
//      this file was built on the weaker one and was entirely wrong,
//   4. set `observedFrom` to the country you were browsing from,
//   5. if anything on the page did not make sense, say so in `unresolved`
//      rather than picking the reading that suits us.
//
// `verifiedBy` is required whenever `verification` is VERIFIED and the check
// enforces it, so the flag cannot be flipped without somebody signing it.

import { SEAT_LADDER, SUPPORTED_CURRENCIES } from "@/lib/pricing/ladder";

/**
 * Frozen all the way down, not just at the top.
 *
 * `Object.freeze(array)` leaves every object inside it writable, so a renderer
 * could set `figure.price.currency = "CAD"` on the way to the screen and the
 * conversion this file refuses to do would happen anyway, one layer up, with
 * no comment explaining it. Deliberately NOT applied to SEAT_LADDER, which is
 * imported and belongs to the pricing code — freezing another module's export
 * from here is a side effect nobody would look for.
 */
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// ── Price absence, as four separate facts ──────────────────────────────────

/** They publish an amount. Carries `amount`, `per` and `currency`. */
export const PRICE_AMOUNT = "amount";
/** They publish that it costs nothing. Still carries a `currency` — "free" in
 *  a plan table is a price, and the tier it sits beside is priced in something. */
export const PRICE_FREE = "free";
/** They have a price and deliberately do not print it. Carries `ask`: the
 *  literal words on the button, because "Request Pricing" is the evidence that
 *  this is a choice and not an omission. */
export const PRICE_ON_REQUEST = "on_request";
/** The plan is not sold at this point on the axes at all — Jobber offers no
 *  Plus tier to a single user. Distinct from every other kind: they are not
 *  withholding a price and we are not missing one, the product is simply not
 *  on the shelf. Rendering this as "unknown" would invent a gap in our
 *  research; rendering it as "on request" would invent a sales call. */
export const PRICE_NOT_OFFERED = "not_offered";
/** Nobody has established this. Renders as nothing. Never renders as "free". */
export const PRICE_UNKNOWN = "unknown";

export const PRICE_KINDS = Object.freeze([
  PRICE_AMOUNT,
  PRICE_FREE,
  PRICE_ON_REQUEST,
  PRICE_NOT_OFFERED,
  PRICE_UNKNOWN,
]);

// ── Currency, as published ─────────────────────────────────────────────────

/** The page prints a bare "$" (or equivalent) and names no currency anywhere.
 *  This is a fact ABOUT THE PAGE, established by reading it. Projul is this. */
export const CURRENCY_NOT_STATED = "not_stated";
/** Nobody has looked. Distinct from NOT_STATED: one is a finding, the other is
 *  a gap. Collapsing them is how "probably USD" becomes a published claim. */
export const CURRENCY_UNKNOWN = "unknown";

// ── Verification ───────────────────────────────────────────────────────────

export const VERIFIED = "verified";
export const UNVERIFIED = "unverified";

// ── The axes a competitor's pricing turns on ───────────────────────────────
//
// A closed vocabulary, so a figure cannot carry a coordinate on an axis its
// competitor never declared, and cannot omit one it did.

export const AXIS_TEAM_SIZE = "teamSize";
export const AXIS_BILLING = "billing";

/** Jobber's own team-size selector, in its own words, with the seat count each
 *  bucket includes. `usersIncluded` is what makes a cross-vendor comparison
 *  possible at all — plan NAMES do not line up across vendors, seat counts do. */
export const TEAM_SIZES = Object.freeze({
  solo: { key: "solo", label: "Just me", usersIncluded: 1 },
  "2-5": { key: "2-5", label: "2-5 people", usersIncluded: 5 },
  "6-10": { key: "6-10", label: "6-10 people", usersIncluded: 10 },
  "11-15": { key: "11-15", label: "11-15 people", usersIncluded: 15 },
  "16-plus": { key: "16-plus", label: "16 or more", usersIncluded: null },
});

export const BILLING_MODES = Object.freeze({
  annual_prepaid: { key: "annual_prepaid", label: "Annual, prepaid" },
  monthly_1yr: { key: "monthly_1yr", label: "Monthly, 1 year commitment" },
  monthly_none: { key: "monthly_none", label: "Monthly, no commitment" },
});

// ── Feature availability, as five separate facts ───────────────────────────
//
// Same discipline as price absence, and needed for the same reason. "Does this
// tier include an AI receptionist" has more than two answers, and the wrong
// collapse costs us either a false claim or $200 of understated advantage.

/** In the plan price. */
export const FEATURE_INCLUDED = "included";
/** In the plan, but the usage is bought separately. FieldQuo's own receptionist
 *  is this and it matters enormously: the FEATURE is on every plan, the TALK
 *  TIME is prepaid credit (lib/voice/credits.js). Saying "AI included" beside
 *  our $369 would be a false claim about our own price to a visitor who then
 *  hits a credit top-up on their first call. */
export const FEATURE_INCLUDED_USAGE_EXTRA = "included_usage_extra";
/** Sold as a paid add-on on top of the plan. Carries `addOn` with its price. */
export const FEATURE_ADD_ON = "add_on";
/** Established as not available on this tier. */
export const FEATURE_ABSENT = "absent";
/** Nobody checked this tier for this feature. Never renders as "absent". */
export const FEATURE_UNKNOWN = "unknown";

export const FEATURE_AVAILABILITY = Object.freeze([
  FEATURE_INCLUDED,
  FEATURE_INCLUDED_USAGE_EXTRA,
  FEATURE_ADD_ON,
  FEATURE_ABSENT,
  FEATURE_UNKNOWN,
]);

/**
 * Features worth comparing ACROSS vendors, keyed independently of tier names.
 *
 * The whole point. Jobber's Grow and FieldQuo's Scale are not comparable
 * because they sit in similar positions in their respective tables — they are
 * comparable, or not, on what they contain. Matching by name puts FieldQuo
 * Scale beside Jobber Grow at $399 without a receptionist, which understates
 * our case by $200 AND overstates what Grow gives. `comparableTier` exists so
 * a renderer cannot make that mistake by accident.
 */
export const COMPARABLE_FEATURES = Object.freeze({
  ai_receptionist: {
    key: "ai_receptionist",
    label: "AI phone receptionist",
    fieldquo: FEATURE_INCLUDED_USAGE_EXTRA,
    fieldquoEvidence:
      "lib/features/registry.js — voice_receptionist, defaultState 'on', so every company has it unless a platform admin withdraws it. Talk time is PREPAID CREDIT at the rate in lib/voice/credits.js, not part of the subscription. That file also records, from an earlier and independent read, that Jobber bills conversations rather than minutes — corroborating the $29/mo add-on and the Plus bundling below.",
  },
});

/**
 * How old may a figure be before a renderer should stop trusting it silently?
 *
 * 90 days. Justification, not a round number: every competitor here changed
 * their page between the owner writing his notes and this file being written
 * — Housecall Pro's plan NAMES had changed, and Jobber's entire tier/selector
 * structure did not resemble his description. One quarter is the shortest
 * re-check interval a two-person team will actually keep, and short enough
 * that a price cannot drift through two of a competitor's own pricing
 * revisions unnoticed.
 *
 * The check WARNS past this and does not fail: a stale figure is a scheduling
 * problem, and a build that goes red on a calendar boundary gets bypassed
 * rather than fixed. `withholdReason` is what actually keeps it off the page.
 */
export const STALE_AFTER_DAYS = 90;

/**
 * Age of a figure in whole days.
 *
 * `asOf` is REQUIRED and there is no default. `new Date()` as a default
 * parameter would make this module's answer depend on when it happens to be
 * imported — including at build time on Vercel, which is a different moment
 * from when a visitor reads the page. A caller that does not know what day it
 * is has no business deciding whether a price is fresh, so it throws.
 */
export function figureAgeDays(figure, asOf) {
  if (!asOf) throw new Error("figureAgeDays: asOf is required — see the comment above");
  const then = Date.parse(`${figure?.checked}T00:00:00Z`);
  const now = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.floor((now - then) / 86400000);
}

export function isStale(figure, asOf) {
  const age = figureAgeDays(figure, asOf);
  // An unparseable date is treated as stale, not as fresh. The failure that
  // publishes a wrong number is the one that assumes the good case.
  return age === null || age > STALE_AFTER_DAYS;
}

/**
 * A promotional price, if one is running on the day you ask.
 *
 * ══ Why promotions never reach publishableFigures ══════════════════════════
 *
 * Jobber is running "Save up to 40%, Offer ends Aug 31" as this is written —
 * three days out. /pricing is statically rendered. A static page cannot notice
 * that a sale ended, so a promotional figure printed there is a number that is
 * true for three days and false afterwards, about somebody else's prices, with
 * nobody watching. It is also the direction that flatters THEM while live,
 * which is a strange thing to hand-build into our own comparison.
 *
 * So `publishableFigures` carries the REGULAR price only, and this function is
 * the correct API for a surface that re-renders — a dynamic page may call it
 * and get an answer that expires on its own. A statically rendered page must
 * not, and that is a renderer decision, documented here rather than enforced
 * by deleting the capability.
 */
export function livePromo(figure, asOf) {
  if (!asOf) throw new Error("livePromo: asOf is required — a promotion is only meaningful against a date");
  const promo = figure?.promo;
  if (!promo) return null;
  const ends = Date.parse(`${promo.endsAt}T23:59:59Z`);
  const now = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  // An unparseable or missing end date reads as EXPIRED, not as running
  // forever. Same argument as promotionIsLive in lib/pricing/ladder.js: the
  // failure that costs money is the one where a discount quietly never stops.
  if (!Number.isFinite(ends) || !Number.isFinite(now) || now > ends) return null;
  return promo;
}

/**
 * Why this figure must NOT be rendered as a claim — or null if it may be.
 *
 * Returns a reason string so the renderer can choose between hiding the row
 * and labelling it ("Projul does not state a currency"). Both are honest; a
 * silent fallback to a number is not, which is why there is no boolean-only
 * form of this function.
 */
export function withholdReason(figure, asOf) {
  if (!figure) return "no figure";
  if (!figure.source) return "no source URL";
  if (!figure.checked) return "no checked date";
  if (!figure.observedFrom) return "no vantage point recorded";
  if (figure.verification !== VERIFIED) return "not verified against the source";
  // Read, but not understood. A figure whose own reader flagged an open
  // question is not a figure anybody should publish a number from — and this
  // is deliberately NOT the same as unverified, because somebody did look.
  if (Array.isArray(figure.unresolved) && figure.unresolved.length > 0) {
    return `unresolved: ${figure.unresolved[0]}`;
  }
  const kind = figure.price?.kind;
  if (kind === PRICE_UNKNOWN) return "price not established";
  if (kind === PRICE_AMOUNT || kind === PRICE_FREE) {
    const c = figure.price.currency;
    if (c === CURRENCY_UNKNOWN) return "currency never checked";
    if (c === CURRENCY_NOT_STATED) return "the source states no currency";
    if (!SUPPORTED_CURRENCIES.includes(c)) return `currency ${c} has no FieldQuo row to compare against`;
  }
  if (isStale(figure, asOf)) return `last checked ${figureAgeDays(figure, asOf)} days ago`;
  return null;
}

// ── The FieldQuo capability ledger ─────────────────────────────────────────
//
// One vocabulary for both directions of the comparison. A claim in either
// direction must name a key in here, so "FieldQuo has a mobile app" cannot be
// written as free text and slip past a check that only knows about structure.
//
// `has: false` entries are the ones that matter. A comparison table that lists
// only our wins is an advertisement; a visitor who buys on it, drives to a job
// and finds there is no app to open is a refund and a bad review. Housecall
// Pro's mobile app is the clearest case and it is theirs, not ours.
//
// `evidence` is how the value was established, so a later reader can re-run it
// rather than trusting this line.

export const FIELDQUO_CAPABILITIES = deepFreeze({
  mobile_app: {
    label: "Native mobile app (iOS / Android)",
    has: false,
    evidence:
      "No react-native, capacitor or expo dependency in package.json; no app manifest; no store listing. FieldQuo is a responsive web app.",
  },
  offline_use: {
    label: "Works offline",
    has: false,
    evidence: "No service worker anywhere in app/ or public/. Every screen needs the network.",
  },
  self_serve_demo: {
    label: "Book a guided demo with a salesperson",
    has: false,
    evidence:
      "app/(marketing) has no demo route. The seeded 'demo' industries in lib/demo/industries.js are sample DATA for a sales call, not a bookable slot for a prospect. Conflating them would put a button on /pricing that goes nowhere.",
  },
  published_price: {
    label: "Price published openly, no sales call",
    has: true,
    evidence: "app/(marketing)/pricing renders SEAT_LADDER to anyone, signed out.",
  },
  self_serve_signup: {
    label: "Sign up and start without talking to anyone",
    has: true,
    evidence: "AGENTS.md non-negotiable #1: company signup is open at /signup, first month free.",
  },
  white_label_documents: {
    label: "Quotes, invoices and emails carry the contractor's brand, not ours",
    has: true,
    evidence: "lib/documents/theme.js + lib/documentSections/ — the whole point of the product.",
  },
  monthly_billing: {
    label: "Pay monthly, no annual commitment required",
    has: true,
    evidence: "lib/pricing/ladder.js — monthly is the default rung; annual is an optional discount.",
  },
  ai_receptionist_no_monthly_floor: {
    label: "AI phone receptionist on every plan, with no monthly minimum",
    has: true,
    // Scoped deliberately narrowly. "AI included" would be FALSE — see
    // COMPARABLE_FEATURES.ai_receptionist. What is true, and is the stronger
    // claim anyway, is that there is no monthly floor: a one-van painter who
    // takes no calls in February pays nothing for the receptionist that month.
    evidence:
      "lib/features/registry.js voice_receptionist defaultState 'on'; lib/voice/credits.js — prepaid credit, explicitly 'Not bundled as N conversations included', and no monthly minimum. Jobber's entry point for the same feature is a $29/mo add-on whether or not it takes a call.",
  },
});

/** The honest half of the comparison, derived rather than restated. */
export const FIELDQUO_LACKS = Object.freeze(
  Object.keys(FIELDQUO_CAPABILITIES).filter((k) => FIELDQUO_CAPABILITIES[k].has === false),
);

// ── FieldQuo's own side of the table ───────────────────────────────────────
//
// Imported, not typed. `sameNumberBothCurrencies` is the fact that makes a
// conversion unnecessary: the CAD and USD Plan rows carry identical numbers,
// so a USD competitor is compared against the USD row directly.

export const FIELDQUO_REFERENCE = Object.freeze({
  ladder: SEAT_LADDER,
  currencies: SUPPORTED_CURRENCIES,
  sameNumberBothCurrencies: true,
  entryTier: SEAT_LADDER[0],
});

// ── The competitors ────────────────────────────────────────────────────────
//
// Everything below was established on 2026-08-28 from a US vantage point. Read
// the `verifiedBy` line on each figure before trusting it.

const HOUSECALL_PRO_PRICING = "https://www.housecallpro.com/pricing/";
const JOBBER_PRICING = "https://www.getjobber.com/pricing/";
const SERVICETITAN_PRICING = "https://www.servicetitan.com/pricing";
const PROJUL_PRICING = "https://projul.com/pricing/";

const SERVED_HTML =
  "claude/opus-5 — fetched the page and read the figure out of the served HTML, not out of a summary";
const IN_BROWSER =
  "claude/opus-5 — drove the live page in a browser, JS rendered and cookie banner rejected, setting the page's own team-size and billing selectors to this figure's coordinates";

// The sale Jobber is running as this is written. Named once so that when it
// ends, one edit retires every promotional figure below.
const JOBBER_PROMO_ENDS = "2026-08-31";

export const COMPETITORS = deepFreeze([
  {
    id: "housecall_pro",
    name: "Housecall Pro",
    homepage: "https://www.housecallpro.com/",
    axes: [AXIS_BILLING],
    figures: [
      {
        id: "housecall_pro.basic.annual",
        label: "Basic",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 59, per: "month", currency: "USD" },
        cta: "Get Started",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Served HTML reads "Save $20/mo $59 /mo (Billed annually)" and "1 user included". The currency is stated on the page itself: "All prices are in USD and are exclusive of sales tax."',
      },
      {
        id: "housecall_pro.basic.monthly",
        label: "Basic",
        axis: { billing: "monthly_none" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 79, per: "month", currency: "USD" },
        cta: "Get Started",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: 'Comparison table row: "$59 /mo $79 /mo" — the second figure is the no-commitment monthly rate.',
      },
      {
        id: "housecall_pro.essentials.annual",
        label: "Essentials",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 5,
        price: { kind: PRICE_AMOUNT, amount: 149, per: "month", currency: "USD" },
        badge: "Recommended",
        cta: "Get Started",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: '"5 users included *Additional users $100/mo each".',
      },
      {
        id: "housecall_pro.max.annual",
        label: "Max",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 8,
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD" },
        cta: "Book Demo",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: '"8 user included *Additional users $75/mo each". Its CTA is "Book Demo", not a self-serve trial — and it still publishes its price.',
      },
    ],
    // Their own "Included in every plan" list, quoted as printed. Three of the
    // eight are things FieldQuo does not have, and they are the three a
    // contractor notices on day one.
    theyHaveWeDont: [
      {
        capability: "mobile_app",
        claim: "Free mobile app for iOS and Android",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: 'Verbatim from their "Included in every Housecall Pro plan" list.',
      },
      {
        capability: "offline_use",
        claim: "Offline viewing",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: "Verbatim from the same list. FieldQuo needs the network for every screen.",
      },
      {
        capability: "self_serve_demo",
        claim: "Get a free demo and tailored pricing information for your business",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: 'Verbatim, beside a "BOOK A DEMO" button.',
      },
    ],
    weHaveTheyDont: [
      {
        capability: "self_serve_signup",
        claim: "Their top tier's call to action is Book Demo, not a trial",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Basic and Essentials say "Get Started"; Max says "Book Demo" four times in the served markup. Scope the claim to the top tier — the lower two ARE self-serve and saying otherwise would be false.',
      },
    ],
  },

  {
    id: "servicetitan",
    name: "ServiceTitan",
    homepage: "https://www.servicetitan.com/",
    // No axes: there is nothing for a coordinate to locate on a page that
    // publishes no price. An empty axis list is a statement, not an oversight.
    axes: [],
    figures: [
      {
        id: "servicetitan.starter",
        label: "Starter",
        axis: {},
        price: { kind: PRICE_ON_REQUEST, ask: "Request Pricing" },
        cta: "Request Pricing",
        source: SERVICETITAN_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'The served HTML contains ZERO dollar amounts anywhere on the pricing page and the string "Request Pricing" exactly three times, once per tier. This is a deliberate choice, not a gap in our research — which is the whole reason PRICE_ON_REQUEST is not PRICE_UNKNOWN.',
      },
      {
        id: "servicetitan.essentials",
        label: "Essentials",
        axis: {},
        price: { kind: PRICE_ON_REQUEST, ask: "Request Pricing" },
        cta: "Request Pricing",
        source: SERVICETITAN_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: "Same page, same finding.",
      },
      {
        id: "servicetitan.the_works",
        label: "The Works",
        axis: {},
        price: { kind: PRICE_ON_REQUEST, ask: "Request Pricing" },
        cta: "Request Pricing",
        source: SERVICETITAN_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: "Same page, same finding.",
      },
    ],
    theyHaveWeDont: [],
    weHaveTheyDont: [
      {
        capability: "published_price",
        claim: "ServiceTitan publishes no price; every tier says Request Pricing",
        source: SERVICETITAN_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          "The strongest and safest comparative claim on this page, because it is about the presence of text rather than about a number, and it is trivially checkable by the reader.",
      },
    ],
  },

  {
    id: "projul",
    name: "Projul",
    homepage: "https://projul.com/",
    axes: [AXIS_BILLING],
    figures: [
      {
        id: "projul.core",
        label: "Core",
        axis: { billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 4788, per: "year", currency: CURRENCY_NOT_STATED },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Amount confirmed verbatim: "Core $4,788 Annually Schedule a demo". The CURRENCY is a separate question and the answer is that the page never gives one — the strings "USD", "CAD" and "dollars" appear zero times in the served HTML. The owner guessed USD ("i\'m pressyre that\'s also a USD figure"); a guess is not a source. Until somebody establishes it, withholdReason keeps this off the page.',
      },
      {
        id: "projul.core_plus",
        label: "Core+",
        axis: { billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 7188, per: "year", currency: CURRENCY_NOT_STATED },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: '"Core+ $7,188 Annually Schedule a demo". Currency not stated — see projul.core.',
      },
      {
        id: "projul.pro",
        label: "Pro",
        axis: { billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 14388, per: "year", currency: CURRENCY_NOT_STATED },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: '"Pro $14,388 Annually Schedule a demo". Currency not stated — see projul.core.',
      },
    ],
    theyHaveWeDont: [
      {
        capability: "self_serve_demo",
        claim: "Every Projul tier offers a scheduled demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'All three tiers carry "Schedule a demo". A prospect who wants to be walked through the software can be, and with FieldQuo they cannot.',
      },
    ],
    weHaveTheyDont: [
      {
        capability: "monthly_billing",
        claim: "Projul is annual only — all three tiers are priced Annually",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Their own page argues the point for us: "Why annual plans?" and "Projul starts at $4,788/year with no per-user fees and unlimited projects." Note the second half of that sentence is a point in THEIR favour and an honest renderer should not quote the first half without it.',
      },
    ],
  },

  {
    id: "jobber",
    name: "Jobber",
    homepage: "https://www.getjobber.com/",
    axes: [AXIS_TEAM_SIZE, AXIS_BILLING],
    // ══ The vantage point, which is a limit and not a footnote ═════════════
    //
    // Read from a US egress. The page's own footer says "All prices in USD.
    // Subscription plan prices exclude sales tax where applicable. Pricing
    // displayed is Annual prepaid, other billing options are available see the
    // FAQ below. More conditions apply". That establishes what a US visitor is
    // shown. Jobber is a Canadian company and may serve CAD to a Canadian
    // visitor — and Canada is most of who FieldQuo competes for. Somebody
    // browsing from Canada needs to re-read this before any of it is quoted as
    // "Jobber's price" rather than "Jobber's US price".
    geoCaveat:
      "Verified as what a US visitor is shown. Jobber is Canadian and may serve CAD in Canada; a Canadian reader must re-check before these are quoted as Jobber's price generally.",
    figures: [
      // ── Just me (1 user), Annual prepaid ──────────────────────────────
      //
      // These three carry an `unresolved` question and therefore do not
      // publish. The page shows a regular /mo, a promotional /mo for 12
      // months, and a different "then" rate — $49, $21, $29 for Core. What
      // $49 is RELATIVE to $29 was not established: it may be the
      // no-commitment monthly list price shown for contrast, or a pre-promo
      // annual rate. Both readings are plausible and they headline different
      // numbers, so the honest answer is to say we do not know rather than to
      // pick the one that flatters the comparison.
      {
        id: "jobber.core.solo.annual",
        label: "Core",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 49, per: "month", currency: "USD" },
        promo: { amount: 21, forMonths: 12, thenAmount: 29, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_ADD_ON },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: [
          "the relationship between the $49/mo regular rate and the $29/mo post-promotion rate was not established — is $49 the no-commitment monthly list price shown for contrast, or the pre-promotion annual rate?",
        ],
        note: 'Regular $49/mo; promotion $21/mo for 12 months, then $29/mo billed annually.',
      },
      {
        id: "jobber.connect.solo.annual",
        label: "Connect",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 139, per: "month", currency: "USD" },
        promo: { amount: 70, forMonths: 12, thenAmount: 99, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        // The badge moves with team size, so it is recorded ON the figure that
        // carries the size. See the correction note below.
        badge: "Recommended",
        features: { ai_receptionist: FEATURE_ADD_ON },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $139 regular versus $99 post-promotion"],
        note: "Regular $139/mo; promotion $70/mo for 12 months, then $99/mo billed annually.",
      },
      {
        id: "jobber.grow.solo.annual",
        label: "Grow",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 199, per: "month", currency: "USD" },
        promo: { amount: 105, forMonths: 12, thenAmount: 149, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_ADD_ON },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $199 regular versus $149 post-promotion"],
        note: "Regular $199/mo; promotion $105/mo for 12 months, then $149/mo billed annually.",
      },
      {
        id: "jobber.plus.solo.annual",
        label: "Plus",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        price: { kind: PRICE_NOT_OFFERED },
        features: { ai_receptionist: FEATURE_UNKNOWN },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "No Plus tier is offered at this team size. Recorded rather than omitted: a missing row reads as an oversight, and 'they do not sell it to a one-person shop' is a fact about their product worth having.",
      },

      // ── 2-5 people (5 users), Annual prepaid ──────────────────────────
      {
        id: "jobber.connect.2-5.annual",
        label: "Connect",
        axis: { teamSize: "2-5", billing: "annual_prepaid" },
        seatsIncluded: 5,
        price: { kind: PRICE_AMOUNT, amount: 199, per: "month", currency: "USD" },
        promo: { amount: 105, forMonths: 12, thenAmount: 149, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_UNKNOWN },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $199 regular versus $149 post-promotion"],
        note: "Regular $199/mo; promotion $105/mo, then $149/mo.",
      },
      {
        id: "jobber.grow.2-5.annual",
        label: "Grow",
        axis: { teamSize: "2-5", billing: "annual_prepaid" },
        seatsIncluded: 5,
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD" },
        promo: { amount: 161, forMonths: 12, thenAmount: 229, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_ABSENT },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $299 regular versus $229 post-promotion"],
        note: "Regular $299/mo; promotion $161/mo, then $229/mo.",
      },
      {
        id: "jobber.plus.2-5.annual",
        label: "Plus",
        axis: { teamSize: "2-5", billing: "annual_prepaid" },
        seatsIncluded: 5,
        price: { kind: PRICE_AMOUNT, amount: 499, per: "month", currency: "USD" },
        promo: { amount: 280, forMonths: 12, thenAmount: 399, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        badge: "Recommended",
        // The CTA asks you to call AND the price is printed. Those are not
        // opposites, which is why `cta` is its own field rather than something
        // inferred from the price kind. The owner believed Plus published no
        // price precisely because of this button.
        cta: "Contact Sales",
        features: { ai_receptionist: FEATURE_INCLUDED },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $499 regular versus $399 post-promotion"],
        note:
          'Regular $499/mo; promotion $280/mo, then $399/mo. Receptionist marked included from the tier\'s own bullet "Never miss a lead with an AI-powered Receptionist".',
      },

      // ── 6-10 people (10 users), Annual prepaid ────────────────────────
      {
        id: "jobber.grow.6-10.annual",
        label: "Grow",
        axis: { teamSize: "6-10", billing: "annual_prepaid" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 399, per: "month", currency: "USD" },
        promo: { amount: 210, forMonths: 12, thenAmount: 299, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_ABSENT },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $399 regular versus $299 post-promotion"],
        note: "Regular $399/mo; promotion $210/mo, then $299/mo.",
      },
      {
        id: "jobber.plus.6-10.annual",
        label: "Plus",
        axis: { teamSize: "6-10", billing: "annual_prepaid" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 599, per: "month", currency: "USD" },
        promo: { amount: 315, forMonths: 12, thenAmount: 449, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        badge: "Recommended",
        features: { ai_receptionist: FEATURE_INCLUDED },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $599 regular versus $449 post-promotion"],
        note: "Regular $599/mo; promotion $315/mo, then $449/mo.",
      },

      // ── 6-10 people, Monthly with no commitment ───────────────────────
      //
      // The only Jobber rows with NO open question, and therefore the only
      // ones that publish. Regular and post-promotion agree at $599, so there
      // is nothing to interpret. These are also exactly the rows the useful
      // comparison needs — ten users, no commitment, receptionist or not.
      {
        id: "jobber.grow.6-10.monthly_none",
        label: "Grow",
        axis: { teamSize: "6-10", billing: "monthly_none" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 399, per: "month", currency: "USD" },
        features: { ai_receptionist: FEATURE_ABSENT },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note: "$399/mo, no promotion shown on this combination.",
      },
      {
        id: "jobber.plus.6-10.monthly_none",
        label: "Plus",
        axis: { teamSize: "6-10", billing: "monthly_none" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 599, per: "month", currency: "USD" },
        promo: { amount: 420, forMonths: 3, thenAmount: 599, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_INCLUDED },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "Regular $599/mo; promotion $420/mo for 3 months, then back to $599/mo. Regular and post-promotion agree, so unlike the annual rows there is nothing unresolved here.",
      },

      // ── The two team sizes nobody captured ────────────────────────────
      //
      // Recorded as unknown rather than extrapolated from the curve below
      // them. Straight-lining 6-10 into 11-15 would produce a confident number
      // that no Jobber page has ever shown anyone.
      {
        id: "jobber.all.11-15",
        label: "All plans, 11-15 people",
        axis: { teamSize: "11-15", billing: "annual_prepaid" },
        price: { kind: PRICE_UNKNOWN },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: UNVERIFIED,
        note: "This team-size selector was not opened during the browser read. Not extrapolated.",
      },
      {
        id: "jobber.all.16-plus",
        label: "All plans, 16 or more people",
        axis: { teamSize: "16-plus", billing: "annual_prepaid" },
        price: { kind: PRICE_UNKNOWN },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: UNVERIFIED,
        note: "This team-size selector was not opened during the browser read. Not extrapolated.",
      },
    ],
    // Priced on top of a plan, not inside it. Observed at the "Just me" size;
    // no claim is made about their price at other sizes.
    addOns: [
      {
        id: "jobber.addon.marketing_suite",
        label: "Marketing Suite",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 99, per: "month", currency: "USD" },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note: "Add-on, priced separately from the plan.",
      },
      {
        id: "jobber.addon.ai_receptionist",
        label: "Jobber AI Receptionist",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 29, per: "month", currency: "USD" },
        feature: "ai_receptionist",
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "The single most useful figure on this page for us. It is a $29/mo floor a contractor pays whether or not a call comes in. lib/voice/credits.js records the same $29/mo from an earlier, independent read and adds that it buys 30 conversations with $0.79 each after — corroboration, not a second source, since both describe Jobber's own published terms.",
      },
      {
        id: "jobber.addon.sales_pipeline",
        label: "Sales Pipeline",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 49, per: "month", currency: "USD" },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note: "Add-on, priced separately from the plan.",
      },
    ],
    theyHaveWeDont: [
      {
        capability: "mobile_app",
        claim: "Jobber ships mobile apps for iOS and Android",
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        verification: UNVERIFIED,
        note:
          "Widely true and almost certainly correct, but it was not read off the pricing page during the browser session, so it is not verified and does not publish. Listed anyway so the concession is not quietly missing from the one competitor where we now have real numbers.",
      },
    ],
    weHaveTheyDont: [
      {
        capability: "ai_receptionist_no_monthly_floor",
        claim:
          "Jobber's AI receptionist is a $29/mo add-on at one user, and otherwise sits in the $599/mo Plus tier",
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "Both halves read from the page: the add-on price at Just me, and the receptionist bullet appearing only on Plus at 5 and 10 users. The FieldQuo half of this claim is deliberately narrow — no monthly floor, not 'included' — because our talk time is prepaid credit and 'included' would be false.",
      },
    ],
  },
]);

// ── Lookups ────────────────────────────────────────────────────────────────

export function competitor(id) {
  return COMPETITORS.find((c) => c.id === id) || null;
}

export function allFigures() {
  return COMPETITORS.flatMap((c) => c.figures.map((f) => ({ ...f, competitorId: c.id })));
}

/** Add-ons are priced separately and are not plan figures, but they carry the
 *  same guarantees and the same check applies to them. */
export function allAddOns() {
  return COMPETITORS.flatMap((c) => (c.addOns || []).map((a) => ({ ...a, competitorId: c.id })));
}

/**
 * Everything a renderer is allowed to print as a price, right now.
 *
 * Regular prices only — see `livePromo` for why a promotional figure never
 * appears here. The renderer should still call `withholdReason` on what it
 * excludes if it wants to say WHY a competitor's row is blank. Showing
 * "Projul — currency not stated" is better comparative advertising than
 * showing nothing, and much better than showing a number.
 */
export function publishableFigures(asOf) {
  return allFigures().filter((f) => withholdReason(f, asOf) === null);
}

/**
 * The competitor tier that actually includes a given feature, at a given point
 * on their axes — NOT the tier whose name sounds like ours.
 *
 * This function is the reason COMPARABLE_FEATURES exists. Matching FieldQuo
 * Scale against "Jobber Grow" because both sit third in their tables compares
 * us against $399 for a plan with no receptionist, which understates our case
 * by $200 and simultaneously credits Grow with a feature it does not have. The
 * comparison a visitor can act on is the one against the cheapest tier that
 * does what ours does.
 *
 * Returns null rather than a near-miss. A feature nobody has checked for on a
 * tier is FEATURE_UNKNOWN and is never treated as absent, so an uninspected
 * cheaper tier cannot win this by default.
 */
export function comparableTier(competitorId, { feature, teamSize, billing }, asOf) {
  const c = competitor(competitorId);
  if (!c || !COMPARABLE_FEATURES[feature]) return null;
  const candidates = c.figures.filter(
    (f) =>
      f.features?.[feature] === FEATURE_INCLUDED &&
      (teamSize === undefined || f.axis?.teamSize === teamSize) &&
      (billing === undefined || f.axis?.billing === billing) &&
      f.price?.kind === PRICE_AMOUNT &&
      withholdReason(f, asOf) === null,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, f) => (f.price.amount < best.price.amount ? f : best));
}

/** Every claim, both directions, for one competitor — already resolved against
 *  the capability ledger so a renderer never has to look a key up itself. */
export function claims(competitorId) {
  const c = competitor(competitorId);
  if (!c) return null;
  const resolve = (list, expectHas) =>
    list.map((entry) => {
      const cap = FIELDQUO_CAPABILITIES[entry.capability];
      return {
        ...entry,
        fieldquoHas: cap ? cap.has : null,
        // A claim whose ledger entry points the wrong way is a claim about
        // ourselves that is false. Surfaced rather than silently dropped so a
        // renderer that ignores it still fails the check, not the visitor.
        consistent: Boolean(cap) && cap.has === expectHas,
        // A claim about a competitor is held to the same bar as a price.
        publishable: entry.verification === VERIFIED,
      };
    });
  return {
    theyHaveWeDont: resolve(c.theyHaveWeDont, false),
    weHaveTheyDont: resolve(c.weHaveTheyDont, true),
  };
}
