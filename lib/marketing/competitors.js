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
// ══ And WHERE a statement came from: three tiers, never collapsed ══════════
//
// `verification` answers "did anyone check this against the source". It does
// not answer "what KIND of source". Those are different questions, and the
// second one got answered by accident, because there was only ever one kind of
// source: the vendor's own page. There are now three, and a reader is owed the
// difference:
//
//   SOURCED_PUBLISHER       the company printed it themselves. Housecall Pro's
//                           "$59 /mo" and its "All prices are in USD" footer.
//                           The strongest tier, and the only one that may
//                           carry a comparative claim against a competitor.
//
//   SOURCED_OWNER_ASSERTED  FieldQuo's owner says so, on stated grounds, and
//                           signs it. Projul's currency is this: their page
//                           names no currency at all, and he has twice stated
//                           the figures are US dollars, reasoning that Projul
//                           is a US company. That is a legitimate business
//                           judgement he is entitled to make, and it is NOT a
//                           reading of their page — so it is recorded as what
//                           it is, with who asserted it, when, and on what
//                           grounds. Collapsing it into VERIFIED would put his
//                           reasoning in their mouth.
//
//   SOURCED_USER_REPORTS    third-hand. ServiceTitan publishes nothing, and
//                           what circulates is a video summary and a forum
//                           thread of contractors saying what they pay. This
//                           may never be rendered the way a publisher figure
//                           is, may never be stated as a fact about
//                           ServiceTitan's pricing, and is always a RANGE that
//                           never collapses to a midpoint.
//
// The tiers gate different things, and the asymmetry is deliberate. A
// CONCESSION (theyHaveWeDont — something a competitor has and we do not) may
// publish on an owner assertion, because the only party a wrong concession
// harms is us. A CLAIM OF ADVANTAGE (weHaveTheyDont) may not: it is a
// statement about somebody else's product and it needs their own page behind
// it. `claims()` encodes that; it is not left to a renderer.
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
// ══ The STORED figure is never converted, and never will be ════════════════
//
// This file used to ban currency conversion outright, anywhere, forever. That
// was too blunt and the owner was right to push back: a Canadian reading
// "$399 USD" beside "$369 CAD" cannot compare them without doing the exchange
// arithmetic in his head, and asking a visitor to do arithmetic we could do
// for him is a worse page, not a safer one.
//
// So the rule has been NARROWED, not lifted, and the narrowing is precise:
//
//   • The DATA stays unconverted forever. Every `amount` below is the figure
//     as published, in the currency as published. The check enforces this
//     structurally — no decimal literal may appear in this file's code (an FX
//     rate is a decimal), no identifier may name a currency or a conversion,
//     and every `amount` must be a bare integer literal so that nobody can
//     multiply on the way in. A stored converted number is one that was true
//     the day it shipped and is wrong every day after, on a statically
//     rendered page, unwatched. That was always the real danger and it is
//     still banned.
//
//   • CONVERSION FOR DISPLAY lives in lib/marketing/fx.js, a separate module
//     this one does not import and must never import. It carries a rate, the
//     date that rate was read and the source it was read from; it goes stale
//     and refuses past its window; and everything it returns is an
//     `Approximate` that holds no reachable bare number, so a renderer cannot
//     print a converted figure without the rate and the date beside it.
//
// The one-way dependency is the whole safeguard. fx.js imports this file to
// find out what a competitor published; this file cannot reach fx.js, so no
// figure here can arrive pre-converted. check-competitors.mjs asserts the
// import does not exist and that no decimal ever appears here, which means the
// rate physically cannot be stored in this file even by accident.
//
// FX never touches OUR prices. SEAT_LADDER carries the SAME NUMBER in both
// currencies (lib/pricing/ladder.js) — 99 CAD and 99 USD are both real
// FieldQuo prices, not a conversion of one another. Running our own ladder
// through an exchange rate would invent a price we do not charge, so fx.js
// converts only observations recorded in COMPETITORS below, by id.
//
// If a competitor themselves publishes a CAD price, that is a published fact
// and belongs here as a CAD figure with its own source URL. Quoting what they
// print has never been converting.
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
/** Not a price at all: a band of figures buyers say they were quoted, for a
 *  vendor that publishes nothing. Carries a `Reported`, never an `amount` —
 *  see the class below for why the numbers are unreachable on purpose. */
export const PRICE_REPORTED_RANGE = "reported_range";

export const PRICE_KINDS = Object.freeze([
  PRICE_AMOUNT,
  PRICE_FREE,
  PRICE_ON_REQUEST,
  PRICE_NOT_OFFERED,
  PRICE_UNKNOWN,
  PRICE_REPORTED_RANGE,
]);

// ── Where a statement came from ────────────────────────────────────────────
//
// See the header. Three tiers, and the vocabulary is closed so a fourth cannot
// be invented in a data literal.

/** The company published it themselves, and WE read it off their site. */
export const SOURCED_PUBLISHER = "publisher";
/** The owner read their page and told us what it says; we did not read it.
 *  A report OF the publisher, at one remove — which is a different thing from
 *  reading it, and the difference is not academic: the first Jobber entry in
 *  this file was built on a relay and was entirely wrong. Distinct from
 *  OWNER_ASSERTED, which is an inference their page does not support. */
export const SOURCED_OWNER_RELAYED = "owner_relayed";
/** FieldQuo's owner asserts it, on stated grounds, and signs it. Their page
 *  does not say it and would not, however carefully you read it. */
export const SOURCED_OWNER_ASSERTED = "owner_asserted";
/** Buyers say so. Third-hand, never a fact about the vendor's price list. */
export const SOURCED_USER_REPORTS = "user_reports";

/** Strongest first. The order is meaningful and is what `claimPublishable`
 *  and `withholdReason` cut against; it is not alphabetical by accident. */
export const SOURCING_TIERS = Object.freeze([
  SOURCED_PUBLISHER,
  SOURCED_OWNER_RELAYED,
  SOURCED_OWNER_ASSERTED,
  SOURCED_USER_REPORTS,
]);

/**
 * Is this a signed assertion, or somebody typing `SOURCED_OWNER_ASSERTED`?
 *
 * The tier is worth nothing without the three fields, for the same reason
 * `verifiedBy` is required beside VERIFIED: a flag anyone can set is not
 * evidence. WHO said it, WHEN, and on WHAT GROUNDS — the grounds especially,
 * because "Projul is a US company" is a reason a reader can weigh, and "it's
 * USD" is not.
 */
export function isSignedAssertion(a) {
  return Boolean(
    a &&
      typeof a.who === "string" && a.who.length > 3 &&
      /^\d{4}-\d{2}-\d{2}$/.test(a.on || "") &&
      typeof a.grounds === "string" && a.grounds.length > 15,
  );
}

/**
 * How a reader should be told where this came from — never blank.
 *
 * A renderer that wants to print an owner-asserted figure has to print this
 * beside it, and there is nothing else to print: the tier alone is a machine
 * token and "owner_asserted" on a marketing page means nothing to anybody.
 */
export function provenanceLabel(entry, { subject } = {}) {
  const who = subject || "them";
  switch (entry?.sourcing) {
    case SOURCED_PUBLISHER:
      return entry?.checked
        ? `read off their own page on ${entry.checked}`
        : "read off their own page";
    case SOURCED_OWNER_RELAYED: {
      const a = entry.relayedBy;
      return isSignedAssertion(a)
        ? `relayed from their page by ${a.who} on ${a.on}, not read by us — ${a.grounds}`
        : "relayed with no record of who relayed it";
    }
    case SOURCED_OWNER_ASSERTED: {
      const a = entry.assertedBy;
      return isSignedAssertion(a)
        ? `asserted by ${a.who} on ${a.on}, not stated on their page — ${a.grounds}`
        : "asserted with no assertion on record";
    }
    case SOURCED_USER_REPORTS:
      return `reported by buyers, not published by ${who}`;
    default:
      return "provenance not recorded";
  }
}

/**
 * A band of figures buyers report, which must never become one number.
 *
 * ══ Why this is a class and not `{ low, high }` ════════════════════════════
 *
 * ServiceTitan publishes nothing. What we have is a video summary and a forum
 * thread — contractors saying what they were quoted. That is worth printing,
 * because "what do people actually pay for ServiceTitan" is the question the
 * visitor arrived with, but it is one careless template away from becoming
 * "ServiceTitan costs $272 per technician". The two ways it goes wrong are
 * printing an endpoint on its own, and averaging.
 *
 * Plain data cannot stop either: `{f.price.low}` renders, and `(low+high)/2`
 * is one line. So the endpoints live in PRIVATE fields. There is no `.low`,
 * no `.high`, no `.amount` — reading them returns undefined, and arithmetic
 * throws, because `valueOf` refuses. The only ways out are `toString()` and
 * `toJSON()`, and both emit the full band with its "reported" label attached.
 *
 * Same idea as the `Safe` wrapper in lib/export/accountingExport.js: the type
 * carries the guarantee, so a caller cannot forget it. Inverted, though —
 * `Safe` marks a value as trusted, this marks one as never to be trusted bare.
 */
export class Reported {
  #low;
  #high;
  #unit;
  #label;

  constructor({ low, high, unit, label }) {
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      throw new Error("Reported: both ends of the band are required");
    }
    // A band whose ends are equal is a number wearing a range's clothes, and
    // it would render as "$300–300". If somebody reports one figure, that is
    // a single report and belongs in a note, not here.
    if (!(low < high)) throw new Error("Reported: low must be below high — a band with one end is a number");
    this.#low = low;
    this.#high = high;
    this.#unit = unit || "";
    this.#label = label || "reported";
    Object.freeze(this);
  }

  /** Always true. A renderer can branch on it without unwrapping anything. */
  get isReported() {
    return true;
  }

  /** The band, as text, with its label — the only rendering there is. */
  toString() {
    const money = (n) => `$${n.toLocaleString("en-CA")}`;
    const unit = this.#unit ? ` ${this.#unit}` : "";
    return `${this.#label} ${money(this.#low)}–${money(this.#high)}${unit}`;
  }

  toJSON() {
    return { reported: this.toString() };
  }

  /**
   * Refuses to be a number.
   *
   * This is what stops the midpoint. `(range + 0) / 2`, `Number(range)`,
   * `Math.round(range)` and `range < 400` all route through here and all
   * throw, so an averaging line cannot be written by accident — only by
   * deleting this method, which is an act somebody has to explain.
   */
  valueOf() {
    throw new Error(
      "Reported: refuses to be used as a number. A band of what buyers say they paid has no midpoint — render it with toString(), which carries its label.",
    );
  }
}

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

// ── What each company charges PER ──────────────────────────────────────────
//
// ══ Why this is data and not a sentence in a paragraph ═════════════════════
//
// Five companies, five different units. ServiceTitan is reported to charge per
// TECHNICIAN, Jobber by a team-size BAND, Housecall Pro per SEAT with extras
// priced individually, QuoteIQ per USER, Projul a FLAT ANNUAL fee with no
// per-user charge at all. FieldQuo charges for SEATS and includes CREW free.
//
// A comparison that puts those numbers in one table without saying so is
// comparing different things and looks rigorous while doing it. The specific
// error waiting to happen: a twenty-technician company is twenty billable
// people to ServiceTitan and perhaps two or three SEATS to us, because a
// technician is a field worker and a field worker is crew. That is the
// strongest true claim in this whole comparison and it is only true if
// somebody maps the units deliberately.
//
// So the unit is a first-class field with a `countsWhom` that says who is
// billed, and a `mapsTo` that says what that headcount is in our
// model — WITH the caveat, because the caveat is what keeps the argument
// honest. Our crew see their schedule, their assigned jobs and what to buy;
// they do not see prices and cannot write a quote (PERMISSION_PRESETS.worker
// in lib/permissions.js says so in those words). A ServiceTitan technician
// reportedly has mobile estimates on the Essentials tier. Counting heads
// without that caveat is the dishonest version of a true argument, and it is
// the version a prospect will catch.

export const UNIT_PER_TECHNICIAN = "per_technician";
export const UNIT_PER_USER = "per_user";
export const UNIT_PER_SEAT = "per_seat";
export const UNIT_TEAM_SIZE_BAND = "team_size_band";
export const UNIT_FLAT = "flat";
export const UNIT_SEATS_PLUS_FREE_CREW = "seats_plus_free_crew";

export const PRICING_UNITS = Object.freeze({
  [UNIT_PER_TECHNICIAN]: Object.freeze({
    key: UNIT_PER_TECHNICIAN,
    label: "Per technician, per month",
    countsWhom: "Every field technician on the payroll.",
    mapsTo: "crew",
    // The caveat is part of the mapping, not a footnote under it. A caller
    // that maps twenty technicians onto free crew without printing this is
    // making a comparison we cannot defend.
    caveat:
      "A technician is a field worker, and in FieldQuo a field worker is CREW and costs nothing. That is a real and large difference — and it is only a fair comparison where the technician does not need to quote on site. Their technicians reportedly get mobile estimates from the middle tier up; FieldQuo crew cannot write a quote at all (PERMISSION_PRESETS.worker: quotes 'none'). Somebody who needs every van to price work needs a SEAT here, not crew.",
  }),
  [UNIT_PER_USER]: Object.freeze({
    key: UNIT_PER_USER,
    label: "Per user, in fixed bands per tier",
    countsWhom: "Anybody with a login, whatever they do with it.",
    mapsTo: "seats_and_crew_together",
    caveat:
      "Their tiers include a fixed number of users and every one of them is paid, whether that person writes estimates or only reads a schedule. FieldQuo splits the same headcount in two: seats are billed, crew are not. So they are CHEAPER at one person and we pull ahead as soon as there is a van crew — and the crossover is a real number a calculator should compute rather than a claim to make.",
  }),
  [UNIT_PER_SEAT]: Object.freeze({
    key: UNIT_PER_SEAT,
    label: "Per seat, with extra seats individually priced",
    countsWhom: "Each included user, plus a stated price per additional user.",
    mapsTo: "seats_and_crew_together",
    caveat:
      "Their additional-user prices are per person with no free tier below them, so a crew of eight is eight charges. FieldQuo's crew are free but cannot originate money.",
  }),
  [UNIT_TEAM_SIZE_BAND]: Object.freeze({
    key: UNIT_TEAM_SIZE_BAND,
    label: "By team-size band, chosen on their own page",
    countsWhom: "Everyone in the business, selected as a bracket rather than a count.",
    mapsTo: "seats_and_crew_together",
    caveat:
      "The band is picked from a selector and covers everybody, so there is no per-head arithmetic to do and no free category either. See the `axes` on that competitor: a figure quoted without its band is not a figure.",
  }),
  [UNIT_FLAT]: Object.freeze({
    key: UNIT_FLAT,
    label: "Flat fee, no per-person charge",
    countsWhom: "Nobody — headcount does not enter the price.",
    mapsTo: "none",
    caveat:
      "A flat fee is the one unit that gets cheaper per head as a company grows, and past some headcount it beats us. That crossover is a point in THEIR favour and a calculator should be willing to print it.",
  }),
  [UNIT_SEATS_PLUS_FREE_CREW]: Object.freeze({
    key: UNIT_SEATS_PLUS_FREE_CREW,
    label: "Per seat, with field crew included free",
    countsWhom:
      "Only people whose permissions let them originate money — quotes, jobs, invoices, requests. Everybody else is crew and costs nothing.",
    mapsTo: "self",
    caveat:
      "A seat is read off the permission GRID, not off a job title (lib/pricing/ladder.js isBillableSeat), so promoting somebody to write quotes adds a seat whatever their row is called.",
  }),
});

/** FieldQuo's own unit, so a calculator never has to name it as a string. */
export const FIELDQUO_PRICING_UNIT = UNIT_SEATS_PLUS_FREE_CREW;

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
    // ── Where the currency came from, which is a separate question ─────────
    //
    // Projul is the case that forced this. Their page prints "$4,788" and
    // names no currency anywhere; the owner asserts it is US dollars because
    // Projul is a US company. Writing `currency: "USD"` and stopping there
    // would put his reasoning in their mouth, and nothing downstream could
    // tell it apart from Housecall Pro's, which their own footer states.
    //
    // So a named currency must say WHERE IT CAME FROM, and absence is NOT
    // read as "off the page". Defaulting the missing case to SOURCED_PUBLISHER
    // is failure class 5 with a lawyer attached: it would turn every future
    // unlabelled guess into a claim that the vendor printed it.
    const from = figure.price.currencySourcing;
    if (!from) return "currency provenance not recorded";
    if (!SOURCING_TIERS.includes(from)) return `currency provenance ${from} is not a known sourcing tier`;
    if (from === SOURCED_USER_REPORTS) return "currency is third-hand, not published";
    if (from === SOURCED_OWNER_ASSERTED && !isSignedAssertion(figure.price.assertedBy)) {
      return "currency asserted with no signed assertion on record";
    }
  }
  // A reported band is never a price and never publishes down this path — it
  // has its own gate, `reportedWithholdReason`, because the questions are
  // different: a price asks "may we state this as their price", a band asks
  // "may we state that buyers said this".
  if (kind === PRICE_REPORTED_RANGE) return "a reported band is not a price — see reportedWithholdReason";
  if (isStale(figure, asOf)) return `last checked ${figureAgeDays(figure, asOf)} days ago`;
  return null;
}

/**
 * Why this REPORTED cost must not be rendered — or null if it may be.
 *
 * Deliberately a second function rather than a branch inside withholdReason.
 * The two gates answer different questions and a renderer that confuses them
 * has already made the mistake this file exists to prevent: `withholdReason`
 * clears something to be printed as a competitor's price, and nothing here
 * may ever be printed as a competitor's price. Sharing one function would
 * make that a matter of reading the code carefully.
 */
export function reportedWithholdReason(entry, asOf) {
  if (!entry) return "no entry";
  if (entry.sourcing !== SOURCED_USER_REPORTS) return "a reported cost must be sourced to user reports";
  if (entry.price?.kind !== PRICE_REPORTED_RANGE) return "a reported cost must carry a band, not an amount";
  if (!(entry.price.band instanceof Reported)) return "the band is not a Reported — a bare number could be printed";
  // Third-hand needs its sources NAMED BY KIND. "somewhere online" is how a
  // rumour launders itself into a citation; "a video summary" and "a forum
  // thread" are both weak, and saying which lets the reader weigh them.
  const via = entry.reportedVia;
  if (!Array.isArray(via) || via.length === 0) return "no reported source named";
  if (!via.every((v) => typeof v?.kind === "string" && v.kind.length > 2 && typeof v?.what === "string" && v.what.length > 10)) {
    return "a reported source does not say what kind of source it is";
  }
  if (!entry.checked) return "no checked date";
  if (entry.verification !== UNVERIFIED) {
    // Not a typo. A third-hand figure can never be VERIFIED, because there is
    // nothing to verify it against — ServiceTitan publishes no page that could
    // confirm or deny it. Marking one VERIFIED is somebody promoting hearsay.
    return "third-hand cannot be verified — there is no publisher page to check it against";
  }
  if (isStale(entry, asOf)) return `last checked ${figureAgeDays(entry, asOf)} days ago`;
  return null;
}

/**
 * The sentence a renderer prints for a reported cost. There is no other one.
 *
 * Always names the band, always names that it is reported and by whom, always
 * names that the vendor publishes nothing. A template that wanted to print
 * just the number would have to reach into a private field, and cannot.
 */
export function reportedCostText(entry, { subject } = {}) {
  if (!entry || !(entry.price?.band instanceof Reported)) return "";
  const who = subject || "the vendor";
  const kinds = (entry.reportedVia || []).map((v) => v.kind).join(" and ");
  const extra = entry.alsoReported instanceof Reported ? `, plus ${entry.alsoReported}` : "";
  // The currency caveat is not optional dressing. These bands come off US
  // forums in bare dollar signs; nobody established which dollar, and a
  // Canadian reader who assumes his own is reading a number ~38% too small.
  const cur = entry.price.currency === CURRENCY_NOT_STATED ? " Neither source states a currency." : "";
  return `${entry.price.band}${extra}. ${kinds ? `Reported in ${kinds}` : "Reported"}, not published by ${who}.${cur}`;
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
  // ── The five Projul lists him a feature for, that we do not have ─────────
  //
  // Added when the owner supplied Projul's per-tier feature lists. Every one
  // of these was checked against this repository rather than assumed, because
  // the temptation on a comparison page is to concede the cheap ones and go
  // quiet on the rest, and a visitor who buys on a page that went quiet is a
  // refund. Four of the five are in Projul's TOP tier, which is the honest
  // shape of the comparison: they sell more software than we do, for more.
  accounting_sync: {
    label: "Two-way sync with QuickBooks or Xero",
    has: false,
    evidence:
      "docs/INTEGRATIONS-ASSESSMENT.md, written against this repo: the strings quickbooks, zapier and xero appear in no integration code, only in prose. What exists is lib/export/accountingExport.js — a bookkeeping CSV a human imports, which is not a sync. QuickBooks Desktop is recorded there as refused outright: it needs a Windows connector we cannot ship.",
  },
  gantt_charts: {
    label: "Gantt charts and linked project timelines",
    has: false,
    evidence:
      "No occurrence of 'gantt' anywhere outside node_modules. FieldQuo schedules VISITS on a calendar; it has no dependency graph between tasks, so there is nothing for a Gantt bar to be drawn from.",
  },
  purchase_orders: {
    label: "Purchase orders to suppliers",
    has: false,
    evidence:
      "No PurchaseOrder model in prisma/schema.prisma and no purchaseOrder identifier in the codebase. 'Purchase order' occurs only as a line item in app/data/tradePriceBooks.js and as a checklist row — neither is the document.",
  },
  daily_logs: {
    label: "Daily site logs",
    has: false,
    evidence:
      "No DailyLog model and no dailyLog identifier anywhere. 'Daily log' occurs once, as a construction checklist row in prisma/data/construction-checklists.json, which is a task somebody ticks rather than a log they file.",
  },
  geofencing: {
    label: "Geolocation and geofenced clock-in",
    has: false,
    evidence:
      "No occurrence of 'geofenc' anywhere outside node_modules. Crew clock in from a screen; nothing checks where the phone is.",
  },
  // ── The two halves of the unit argument, both written down ──────────────
  //
  // `free_crew_seats` is the strongest thing we have and `field_worker_quotes`
  // is what it costs. They are recorded as a PAIR deliberately: a renderer
  // that reaches for the first without the second is making the argument a
  // prospect will take apart in one question ("so can my guys quote on site?").
  field_worker_quotes: {
    label: "Field crew can price and send a quote from the van",
    has: false,
    evidence:
      "PERMISSION_PRESETS.worker in lib/permissions.js: quotes 'none', requests 'none', clientsProperties 'name_address_only', and its own description reads \"No prices, quotes, invoices or requests.\" A crew member who needs to quote must be given a grid above the Crew ceiling, at which point lib/pricing/ladder.js isBillableSeat counts them as a SEAT and they are billed. That is the honest limit on the free-crew argument.",
  },
  entry_price_below_our_floor: {
    label: "A paid plan below FieldQuo's cheapest rung",
    has: false,
    evidence:
      "SEAT_LADDER[0] in lib/pricing/ladder.js is Solo at 99 a month and there is nothing under it — the first month is free (TRIAL_PRICE) and then it is 99. Recorded as a capability we lack so that a competitor who starts lower is conceded structurally, rather than left to a paragraph somebody can quietly drop.",
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
  free_crew_seats: {
    label: "Field crew included free — only people who originate money are billed",
    has: true,
    evidence:
      "SEAT_LADDER in lib/pricing/ladder.js carries a `crewSeats` count on every rung (5 / 8 / 11 / 15) alongside its billable `seats` (1 / 3 / 6 / 10), and isBillableSeat bills a member only when their permission grid rises above the Crew ceiling. A twenty-technician shop is therefore a handful of seats here and twenty billable people almost everywhere else. Scoped by field_worker_quotes, which is what the crew tier cannot do.",
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
const QUOTEIQ_PRICING = "https://myquoteiq.com/pricing/";

const SERVED_HTML =
  "claude/opus-5 — fetched the page and read the figure out of the served HTML, not out of a summary";
// A third method, and stronger than either for the one question that keeps
// going wrong. QuoteIQ's visible page prints "$29.99/mo" with no currency
// beside it — the same shape as Projul, which forced the owner-asserted tier.
// Their served HTML also carries schema.org Offer markup, and every one of the
// ten offers in it names `"priceCurrency": "USD"` explicitly. That is the
// publisher stating the currency in machine-readable form: not a guess, not an
// inference from where the company is registered, their own statement.
const STRUCTURED_DATA =
  "claude/opus-5 — fetched the page and read the figure out of the schema.org Offer markup in the served HTML, where each tier carries its own price and an explicit priceCurrency";

const IN_BROWSER =
  "claude/opus-5 — drove the live page in a browser, JS rendered and cookie banner rejected, setting the page's own team-size and billing selectors to this figure's coordinates";

// The sale Jobber is running as this is written. Named once so that when it
// ends, one edit retires every promotional figure below.
const JOBBER_PROMO_ENDS = "2026-08-31";

// ── The owner's two assertions about Projul ────────────────────────────────
//
// Both are SOURCED_OWNER_ASSERTED and neither is a reading of Projul's page.
// Written out in full, once, and referenced — so that if he changes his mind
// one edit retires every figure that leans on it, and so that a reader can see
// the reasoning rather than a flag.

const OWNER = "Emilio Boves, FieldQuo's owner";

// ── Where the ServiceTitan numbers actually come from ──────────────────────
//
// Named by KIND, not just cited. "Widely reported" is how a rumour launders
// itself into a citation; "a video summary" and "a forum thread" are both
// weak, and saying WHICH is what lets a reader weigh them. Neither is
// ServiceTitan, and neither is a URL we can send somebody to and stand behind,
// which is itself part of the disclosure.
//
// One shared list, because both bands and all six structural terms rest on the
// same two sources — and if a third turns up, or one of these is discredited,
// it is one edit rather than nine.
const REPORTED_VIA = Object.freeze([
  Object.freeze({
    kind: "a video summary",
    what: "A summary of a video walking through ServiceTitan's pricing, supplied by the owner. Not ServiceTitan's own material, and no transcript was read.",
  }),
  Object.freeze({
    kind: "a forum thread",
    what: "A Reddit thread of contractors stating what they were quoted and what they pay. Self-reported, unaudited, and skewed by who chooses to post about their software bill.",
  }),
]);

const PROJUL_CURRENCY_ASSERTION = Object.freeze({
  who: OWNER,
  on: "2026-08-29",
  grounds:
    "Projul is a US company, so its published annual figures are US dollars.",
  // What this is NOT, stated so nobody has to reconstruct it later.
  contradicts: null,
  note:
    'Stated twice, in chat, as a business judgement he is entitled to make. It is not a reading of their page: the served HTML at projul.com/pricing contains the two dollar-code strings and the word "dollars" zero times, which is the finding recorded against these figures on 2026-08-28 and is unchanged. Earlier versions of this file withheld all three amounts for exactly that reason. They now publish, on his assertion, labelled as his assertion — which is a different and more useful thing than an empty column, and a strictly more honest thing than a bare number.',
});

const PROJUL_FEATURES_RELAY = Object.freeze({
  who: OWNER,
  on: "2026-08-29",
  grounds:
    "He supplied Projul's per-tier feature lists directly, tier by tier, in the shape their pricing page presents them.",
  note:
    "SOURCED_OWNER_RELAYED, not SOURCED_OWNER_ASSERTED, and the difference is why there are four tiers rather than three. Here he is REPORTING what their page says; about the currency he is INFERRING something their page does not say. A relay is stronger than an inference and weaker than a read, and it sits between them.\n\nWeaker than a read is not a formality. The QuoteIQ entry in this file began as a relay of four tiers, and reading their page found a fifth above them and an annual option on every one — nothing he gave was wrong, it was incomplete in a direction that changed the shape of the ladder. Somebody should re-read projul.com/pricing for exactly that reason.",
});

export const COMPETITORS = deepFreeze([
  {
    id: "housecall_pro",
    name: "Housecall Pro",
    homepage: "https://www.housecallpro.com/",
    pricingUnit: UNIT_PER_SEAT,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_BILLING],
    figures: [
      {
        id: "housecall_pro.basic.annual",
        label: "Basic",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 59, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 79, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 149, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        sourcing: SOURCED_PUBLISHER,
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: 'Verbatim from their "Included in every Housecall Pro plan" list.',
      },
      {
        capability: "offline_use",
        claim: "Offline viewing",
        sourcing: SOURCED_PUBLISHER,
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: "Verbatim from the same list. FieldQuo needs the network for every screen.",
      },
      {
        capability: "self_serve_demo",
        claim: "Get a free demo and tailored pricing information for your business",
        sourcing: SOURCED_PUBLISHER,
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
        sourcing: SOURCED_PUBLISHER,
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
    // Reported, like everything else numeric about them. The UNIT is the part
    // a reader can check in one sales call, and it is the part that matters:
    // per technician is what turns a twenty-van shop into a $9,000 month.
    pricingUnit: UNIT_PER_TECHNICIAN,
    pricingUnitSourcing: SOURCED_USER_REPORTS,
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
    // ══ What contractors report paying, which is not ServiceTitan's price ══
    //
    // A THIRD sourcing tier, and it is deliberately kept out of `figures`.
    //
    // `figures` means "what their own page shows", and the assertion that
    // every figure's source host matches the competitor's own domain is one of
    // the load-bearing ones in check-competitors.mjs — it is what stops a
    // review site's stale number becoming our published claim about them. The
    // sources below are a video summary and a forum thread. They would FAIL
    // that assertion, and they should: they are not ServiceTitan speaking.
    //
    // So they live in their own array, under their own gate
    // (`reportedWithholdReason`), rendered only through `reportedCostText`,
    // which cannot produce a sentence that omits the word "reported". The
    // separation is the safeguard. A renderer walking `figures` cannot pick
    // one up by accident, because it is not in there.
    //
    // The claim being made is "contractors report paying this", not
    // "ServiceTitan charges this". Those are different sentences with
    // different truth conditions, and only the first one is ours to make.
    //
    // Every band is a `Reported`, so there is no `.low` to print on its own
    // and no midpoint to compute — `valueOf` throws. See the class.
    reportedCosts: [
      {
        id: "servicetitan.reported.starter",
        label: "Starter",
        tierPublishes: "servicetitan.starter",
        sourcing: SOURCED_USER_REPORTS,
        price: {
          kind: PRICE_REPORTED_RANGE,
          band: new Reported({
            low: 245,
            high: 300,
            unit: "per technician per month",
            label: "Contractors report paying",
          }),
          // Nobody established which dollar. Both sources are American, which
          // is a reason to suspect and not a reason to state — the same trap
          // Projul's currency sat in, and there is no owner assertion here.
          currency: CURRENCY_NOT_STATED,
        },
        alsoReported: new Reported({
          low: 5000,
          high: 15000,
          unit: "one-time",
          label: "an implementation fee of",
        }),
        // ── A floor on headcount, which is a price for a small shop ────────
        //
        // Reported as a minimum of three to five technicians. A three-person
        // shop therefore cannot buy the cheapest thing on their list at the
        // price on the list — the minimum IS the entry price. Held as a
        // Reported like every other band, so it cannot be quoted as "minimum
        // 3" or averaged into 4.
        minimumTechnicians: new Reported({
          low: 3,
          high: 5,
          unit: "technicians",
          label: "a reported minimum of",
        }),
        includes: [
          "dispatching, on a drag-and-drop board",
          "scheduling and calendar",
          "call booking with a caller-ID pop-up",
          "basic invoicing",
          "a basic price book",
          "CRM",
          "a mobile app",
          "GPS tracking",
          "payment processing",
          "basic reporting",
        ],
        // ── The excludes are the more valuable half ────────────────────────
        //
        // "Everything is in every FieldQuo plan" is a slogan until it is set
        // beside a named list of what a competitor's entry tier withholds.
        // These are the five a contractor discovers after signing an annual
        // contract, which is the shape of complaint the reports are full of.
        excludes: [
          "mobile estimates",
          "payroll management",
          "advanced reporting",
          "commission tracking",
          "service agreements",
        ],
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: UNVERIFIED,
        note:
          "Not verifiable, and marked so permanently: ServiceTitan publishes no page any of this could be checked against, which is why reportedWithholdReason refuses a reported cost that claims to be VERIFIED. The exclusion list is reported at the same standard as the price and carries the same label.",
      },
      {
        id: "servicetitan.reported.essentials",
        label: "Essentials",
        tierPublishes: "servicetitan.essentials",
        sourcing: SOURCED_USER_REPORTS,
        price: {
          kind: PRICE_REPORTED_RANGE,
          band: new Reported({
            low: 300,
            high: 400,
            unit: "per technician per month",
            label: "Contractors report paying",
          }),
          currency: CURRENCY_NOT_STATED,
        },
        alsoReported: new Reported({
          low: 10000,
          high: 30000,
          unit: "one-time",
          label: "an implementation fee of",
        }),
        minimumTechnicians: null,
        // Recorded as what it ADDS, like Projul's upper tiers, because
        // "Essentials has payroll" loses the fact that Starter does not.
        addsOverPreviousTier: [
          "mobile estimates, on site",
          "payroll management",
          "service agreements and memberships",
          "equipment tracking",
          "an enhanced customer portal",
        ],
        excludes: [
          "advanced reporting and the KPI dashboard",
          "commission tracking",
          "advanced inventory",
          "project management",
        ],
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: UNVERIFIED,
        note:
          "Same two sources as the Starter band. Mobile estimates arriving only here is the fact that bounds our own free-crew argument — see FIELDQUO_CAPABILITIES.field_worker_quotes, which concedes that our crew cannot quote either.",
      },
      {
        id: "servicetitan.reported.the_works",
        label: "The Works",
        // ── A correction, kept visible ─────────────────────────────────────
        //
        // The first pass at this entry called the tier "Enterprise", because
        // that is the word the earlier summary used, and it was linked to no
        // published tier at all: ServiceTitan's own page names Starter,
        // Essentials and The Works, and matching "Enterprise" to "The Works"
        // because both sit third is the name-matching mistake comparableTier
        // exists to prevent.
        //
        // A fuller pass of the same sources names The Works explicitly and
        // describes what it adds over Essentials, so the tiers DO line up and
        // the link is now made. The earlier reading is recorded in the note
        // rather than deleted — a correction nobody can see is a correction
        // that gets made again.
        tierPublishes: "servicetitan.the_works",
        sourcing: SOURCED_USER_REPORTS,
        price: {
          kind: PRICE_REPORTED_RANGE,
          band: new Reported({
            low: 400,
            high: 500,
            unit: "per technician per month",
            label: "Contractors report paying",
          }),
          currency: CURRENCY_NOT_STATED,
        },
        alsoReported: new Reported({
          low: 15000,
          high: 50000,
          unit: "one-time",
          label: "an implementation fee of",
        }),
        minimumTechnicians: null,
        addsOverPreviousTier: [
          "configurable payroll",
          "advanced KPI dashboards",
          "commission tracking",
          "customisable memberships",
          "full service-agreement management",
          "advanced inventory",
          "project management",
        ],
        // Nothing recorded as excluded: the reports describe this as the tier
        // that has everything. An empty list is a statement here, and it is
        // NOT the same as never having asked — which is why it is [] rather
        // than absent, and why the check requires the field to exist.
        excludes: [],
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: UNVERIFIED,
        note:
          'An earlier summary of the same sources called this tier "Enterprise" and put the top of the band at "$500+", open-ended. The fuller reading names The Works and closes the band at $500. Both readings are of the same two third-hand sources, so this is a correction rather than a second source — and the open-ended top is worth remembering the day somebody reports paying more.',
      },
    ],
    // ══ The part of this a reader can actually check ═══════════════════════
    //
    // The dollar bands are the weakest thing here and the most quotable, which
    // is a bad combination. The STRUCTURE is the story: pricing per technician
    // rather than per company, a separate five-figure implementation fee, and
    // an annual contract with no monthly option. Those change what a twelve-
    // technician shop pays by an order of magnitude more than the difference
    // between $245 and $300, and a reader can test them in one sales call
    // instead of taking our word for a number.
    //
    // Same third-hand sourcing, so they carry no numbers at all — a statement
    // with no figure in it cannot be misquoted as a price.
    reportedTerms: [
      {
        id: "servicetitan.term.per_technician",
        statement: "ServiceTitan is reported to price per technician, not per company",
        whyItMatters:
          "It is the term that decides the bill. A shop that grows from six technicians to twelve reportedly doubles what it pays; FieldQuo's ladder charges for seats that originate money and includes crew free, so the same growth may not move the rung at all.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.implementation_fee",
        statement: "A separate one-time implementation fee is reported, on top of the subscription",
        whyItMatters:
          "A cost that does not appear in any monthly comparison, ours included. Reported as five figures, which is more than a small shop's first year of software.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.annual_only",
        statement: "An annual contract is reported to be required, with no month-to-month option",
        whyItMatters:
          "The one structural term that lines up directly against something we do have and publish — lib/pricing/ladder.js bills monthly by default and treats annual as an optional discount.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.early_termination",
        statement: "Early-termination penalties are reported for leaving inside the term",
        whyItMatters: "The cost of being wrong about the choice, which is the risk a first-time buyer is actually weighing.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.add_on_modules",
        statement: "Add-on modules are reported to cost a further fraction of the base subscription",
        whyItMatters:
          "It means a quoted per-technician figure is a floor rather than a total. Recorded without the reported percentage, because a percentage of an unpublished number is arithmetic on a rumour.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.onboarding_months",
        statement: "Onboarding is reported to take months rather than days",
        whyItMatters:
          "Time, not money, and it is the fairest comparison on the page: FieldQuo's non-negotiable is that a company signs up at /signup and starts, with nobody to talk to.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
    ],
    theyHaveWeDont: [],
    weHaveTheyDont: [
      {
        capability: "published_price",
        claim: "ServiceTitan publishes no price; every tier says Request Pricing",
        sourcing: SOURCED_PUBLISHER,
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
    // Their own page: "no per-user fees and unlimited projects". A flat fee is
    // the one unit that beats us at scale, and that is recorded rather than
    // left out.
    pricingUnit: UNIT_FLAT,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_BILLING],
    // ══ Two different provenances inside one figure ════════════════════════
    //
    // The AMOUNTS were read off their served HTML on 2026-08-28 and are
    // SOURCED_PUBLISHER. The CURRENCY was not on the page at all and is the
    // owner's assertion. The `includedFeatures` lists are his too — he
    // supplied them, nobody re-read the page for them this session.
    //
    // Splitting the provenance per-field rather than per-figure is the whole
    // point. Marking the figure "verified" would claim their page said USD;
    // marking it "unverified" would throw away a verbatim amount read from
    // their own HTML. Neither is true, and the page can now say exactly what
    // happened: their number, his currency.
    figures: [
      {
        id: "projul.core",
        label: "Core",
        axis: { billing: "annual_prepaid" },
        price: {
          kind: PRICE_AMOUNT,
          amount: 4788,
          per: "year",
          currency: "USD",
          currencySourcing: SOURCED_OWNER_ASSERTED,
          assertedBy: PROJUL_CURRENCY_ASSERTION,
        },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        // Their own list, tier by tier, as the owner supplied it. Recorded as
        // his assertion rather than as a page read — see
        // PROJUL_FEATURES_RELAY. Kept in their words, not translated into
        // our feature vocabulary, because renaming a competitor's feature is
        // how a comparison quietly becomes a straw man.
        includedFeatures: [
          "unlimited projects",
          "CRM",
          "eSignatures",
          "full-featured mobile app",
          "estimating",
          "invoicing and payment processing",
          "lead capture form",
          "mobile notifications",
          "photo capture and markup",
          "project management",
          "reporting",
          "scheduling",
          "task management",
          "templates",
          "premium support",
        ],
        featuresSourcing: SOURCED_OWNER_RELAYED,
        featuresRelayedBy: PROJUL_FEATURES_RELAY,
        note:
          'Amount confirmed verbatim from the served HTML: "Core $4,788 Annually Schedule a demo". The CURRENCY is a separate question and their page does not answer it — the two dollar-code strings and the word "dollars" appear zero times. It is here as the owner\'s assertion, which is what PROJUL_CURRENCY_ASSERTION records.',
      },
      {
        id: "projul.core_plus",
        label: "Core+",
        axis: { billing: "annual_prepaid" },
        price: {
          kind: PRICE_AMOUNT,
          amount: 7188,
          per: "year",
          currency: "USD",
          currencySourcing: SOURCED_OWNER_ASSERTED,
          assertedBy: PROJUL_CURRENCY_ASSERTION,
        },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        // Their list says Core+ ADDS these to Core. Stored as the delta rather
        // than as a flattened list, because "Core+ adds a client portal" is
        // the fact a reader is buying and "Core+ has a client portal" loses it.
        addsOverPreviousTier: [
          "unlimited subcontractors",
          "change orders",
          "client portal",
          "construction financials, job costing and budgeting",
          "convert estimates to tasks",
          "Gantt charts",
          "linear project timelines",
          "messaging",
          "progress billing",
          "time tracking",
          "QuickBooks Online",
        ],
        featuresSourcing: SOURCED_OWNER_RELAYED,
        featuresRelayedBy: PROJUL_FEATURES_RELAY,
        note: '"Core+ $7,188 Annually Schedule a demo". Currency asserted, not stated — see projul.core.',
      },
      {
        id: "projul.pro",
        label: "Pro",
        axis: { billing: "annual_prepaid" },
        price: {
          kind: PRICE_AMOUNT,
          amount: 14388,
          per: "year",
          currency: "USD",
          currencySourcing: SOURCED_OWNER_ASSERTED,
          assertedBy: PROJUL_CURRENCY_ASSERTION,
        },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        addsOverPreviousTier: [
          "unlimited users",
          "assemblies",
          "automated client reminders",
          "daily logs",
          "geolocation and geofencing",
          "photo reports",
          "purchase orders",
          "QuickBooks Desktop",
          "schedule conflicts",
          "selections",
          "service invoicing",
          "Spanish app translation",
        ],
        featuresSourcing: SOURCED_OWNER_RELAYED,
        featuresRelayedBy: PROJUL_FEATURES_RELAY,
        note: '"Pro $14,388 Annually Schedule a demo". Currency asserted, not stated — see projul.core.',
      },
    ],
    // ══ Six concessions, five of them new, none of them comfortable ════════
    //
    // The owner's feature lists name a lot of software we do not have. The
    // temptation is to record the cheap concession (a demo) and go quiet on
    // the expensive ones, which is how a comparison page becomes a brochure.
    // Every capability below was checked against this repository — the
    // evidence is on the FIELDQUO_CAPABILITIES entry, not asserted here — and
    // each one is labelled as coming from his lists rather than from a page
    // read, so a reader knows the standard of proof.
    //
    // They publish anyway, and that asymmetry is deliberate: a concession we
    // get wrong understates us and costs us a sale. A claim of advantage we
    // get wrong is a false statement about somebody else's product. Different
    // risks, different bars — enforced in claims(), not left to a renderer.
    theyHaveWeDont: [
      {
        capability: "self_serve_demo",
        claim: "Every Projul tier offers a scheduled demo",
        sourcing: SOURCED_PUBLISHER,
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'All three tiers carry "Schedule a demo". A prospect who wants to be walked through the software can be, and with FieldQuo they cannot.',
      },
      {
        capability: "mobile_app",
        claim: "Projul lists a full-featured mobile app on its entry tier, with mobile notifications",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note:
          "From the Core list the owner supplied. It is on their CHEAPEST tier, which makes it the concession that matters most: a contractor comparing entry tiers gets an app from them and a web page from us.",
      },
      {
        capability: "gantt_charts",
        claim: "Projul's Core+ tier adds Gantt charts and linear project timelines",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note:
          "FieldQuo schedules visits on a calendar and holds no dependencies between tasks, so this is not a missing screen — it is a missing model. Worth conceding plainly rather than answering with our calendar.",
      },
      {
        capability: "accounting_sync",
        claim: "Projul syncs with QuickBooks Online at Core+ and QuickBooks Desktop at Pro",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note:
          "The one an established shop asks about first. docs/INTEGRATIONS-ASSESSMENT.md, written after reading their own integration page on 2026-08-28, is the honest counterweight and belongs beside this rather than replacing it: what they describe is a one-way push, and our bookkeeping CSV covers much of the same ground. Desktop we have refused outright.",
      },
      {
        capability: "purchase_orders",
        claim: "Projul's Pro tier adds purchase orders",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note: "We have materials and expenses on a job; we have no document you send a supplier.",
      },
      {
        capability: "daily_logs",
        claim: "Projul's Pro tier adds daily site logs and photo reports",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note: "General-contracting features. Less relevant to a one-van painter, which is an argument about fit and not a reason to leave them off the page.",
      },
      {
        capability: "geofencing",
        claim: "Projul's Pro tier adds geolocation and geofencing",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note: "Crew clock in from a screen in FieldQuo and nothing checks where the phone is.",
      },
    ],
    weHaveTheyDont: [
      {
        capability: "monthly_billing",
        claim: "Projul is annual only — all three tiers are priced Annually",
        sourcing: SOURCED_PUBLISHER,
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
    pricingUnit: UNIT_TEAM_SIZE_BAND,
    pricingUnitSourcing: SOURCED_PUBLISHER,
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
        price: { kind: PRICE_AMOUNT, amount: 49, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 139, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 199, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 199, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 499, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 399, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 599, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 399, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 599, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 29, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        price: { kind: PRICE_AMOUNT, amount: 49, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
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
        sourcing: SOURCED_PUBLISHER,
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
        sourcing: SOURCED_PUBLISHER,
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "Both halves read from the page: the add-on price at Just me, and the receptionist bullet appearing only on Plus at 5 and 10 users. The FieldQuo half of this claim is deliberately narrow — no monthly floor, not 'included' — because our talk time is prepaid credit and 'included' would be false.",
      },
    ],
  },

  {
    id: "quoteiq",
    name: "QuoteIQ",
    homepage: "https://myquoteiq.com/",
    // ══ The competitor that beats us where a visitor starts looking ════════
    //
    // $29.99 a month at one user against our $99. That is not a rounding
    // difference and there is no reading of it that favours us at a headcount
    // of one, so it is recorded as a capability we lack
    // (entry_price_below_our_floor) rather than as prose somebody can drop.
    //
    // Where it turns is the CREW. Their users are all paid — every one of the
    // 1 / 2 / 4 / 10 in their tiers is a login somebody bought — and ours are
    // not. A one-van painter is cheaper on QuoteIQ. A shop with two estimators
    // and eight people in vans is ten paid users there and a Crew rung here.
    // Both halves are in the data below, in both directions, because a
    // comparison that only shows our wins is the advertisement this module was
    // written to prevent, and this is the objection a real prospect brings.
    pricingUnit: UNIT_PER_USER,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_BILLING],
    // ── What the owner supplied, and what the page turned out to say ───────
    //
    // He gave four tiers and their monthly prices, and asked for them to be
    // recorded as owner-supplied. Reading the page instead found two things
    // his list did not have, and this is exactly why the page gets read:
    //
    //   • a FIFTH tier, Max at $699/mo with unlimited users, above Elite;
    //   • an annual option on every tier, printed as its own per-month figure
    //     and its own yearly total — so there are ten figures here, not four.
    //
    // Nothing he gave was wrong. It was incomplete in a direction that
    // mattered: a comparison that stops at Elite implies their ladder stops at
    // ten users, and it does not.
    relayNote:
      "Supplied by the owner as four tiers with monthly prices, then read off their served HTML on 2026-08-29. The read added a fifth tier (Max, $699/mo, unlimited users) and the annual option on every tier. His four figures all matched.",
    figures: [
      {
        id: "quoteiq.essentials.monthly",
        label: "Essentials",
        axis: { billing: "monthly_none" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 29.99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        // Their AI is metered as a monthly credit allowance per tier. Recorded
        // as a number rather than described, because "they have AI limits" is
        // not comparable to anything and "500 credits a month" is.
        aiCreditsPerMonth: 500,
        includedFeatures: [
          "create and send estimates",
          "create and send invoices",
          "scheduling and calendar",
          "accept online payments",
          "AI Virtual Call Team",
          "consumer financing",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          'Visible page: "$29.99/mo", "1 User included", "500 AI Credits/mo". The currency is not printed beside the figure, but the page\'s Offer markup states "priceCurrency": "USD" for this tier. This is the cheapest entry price of the five competitors and it is a third of ours.',
      },
      {
        id: "quoteiq.essentials.annual",
        label: "Essentials",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 25, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 500,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          'Their page prints both halves itself — "$25/mo" and "Billed annually at $299.99/year" — so the per-month figure is read, not divided. Their own banner: "Save 2 months with yearly billing", which is the same deal shape as ANNUAL_FREE_MONTHS in lib/pricing/ladder.js.',
      },
      {
        id: "quoteiq.beginner.monthly",
        label: "Beginner",
        axis: { billing: "monthly_none" },
        seatsIncluded: 2,
        price: { kind: PRICE_AMOUNT, amount: 74.99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 1500,
        addsOverPreviousTier: [
          "MapMeasure Pro",
          "QuoteIQ Cam",
          "Review Multiplier",
          "e-signatures",
          "advanced analytics",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$74.99/mo", "2 Users included", "1,500 AI Credits/mo".',
      },
      {
        id: "quoteiq.beginner.annual",
        label: "Beginner",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 2,
        price: { kind: PRICE_AMOUNT, amount: 62.50, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 1500,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$62.50/mo", "Billed annually at $749.99/year".',
      },
      {
        id: "quoteiq.pro.monthly",
        label: "Pro",
        axis: { billing: "monthly_none" },
        seatsIncluded: 4,
        price: { kind: PRICE_AMOUNT, amount: 149.99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        badge: "Most Popular",
        cta: "Start Free Trial",
        aiCreditsPerMonth: 3000,
        addsOverPreviousTier: [
          "email and text automation",
          "in-app calling and texting",
          "job costing",
          "QuickBooks integration",
          "website contact form",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          '"$149.99/mo", "4 Users included", "3,000 AI Credits/mo", badged "Most Popular". Unlike Jobber\'s, this badge does not move with a selector — there is only one, on one tier — but it is still recorded ON the figure rather than on the competitor, so the two cannot be conflated later.',
      },
      {
        id: "quoteiq.pro.annual",
        label: "Pro",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 4,
        price: { kind: PRICE_AMOUNT, amount: 125, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        badge: "Most Popular",
        cta: "Start Free Trial",
        aiCreditsPerMonth: 3000,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$125/mo", "Billed annually at $1,499.99/year".',
      },
      {
        id: "quoteiq.elite.monthly",
        label: "Elite",
        axis: { billing: "monthly_none" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 5000,
        addsOverPreviousTier: [
          "EmployeeHub",
          "InstaQuote and InstaSchedule",
          "route optimisation",
          "pipelines and inventory",
          "mass text and email campaigns",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          '"$299/mo", "10 Users included", "5,000 AI Credits/mo". Ten PAID users against FieldQuo Scale at $369 for ten seats and fifteen free crew — twenty-five people. This is the row where the unit difference stops being an abstraction.',
      },
      {
        id: "quoteiq.elite.annual",
        label: "Elite",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 249, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 5000,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$249/mo", "Billed annually at $2,990/year".',
      },
      {
        id: "quoteiq.max.monthly",
        label: "Max",
        axis: { billing: "monthly_none" },
        // Unlimited, so there is no seat COUNT. null rather than a large
        // number: "unlimited" and "999" are different facts and a calculator
        // that divides by a made-up ceiling produces a made-up per-head price.
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 699, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 8000,
        addsOverPreviousTier: [
          "unlimited users",
          "AI Website Builder included",
          "Sales Team Tracker",
          "priority support",
          "crew management",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          '"$699/mo", "Unlimited Users", "8,000 AI Credits/mo". The tier the owner\'s list did not have. It matters to the comparison: above about twenty-five people their ladder goes flat and FieldQuo\'s does not — tierFor() in lib/pricing/ladder.js returns null past ten seats, which is a conversation rather than a price.',
      },
      {
        id: "quoteiq.max.annual",
        label: "Max",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 582.50, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 8000,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$582.50/mo", "Billed annually at $6,990/year".',
      },
    ],
    theyHaveWeDont: [
      {
        capability: "entry_price_below_our_floor",
        claim: "QuoteIQ starts at $29.99 a month for one user; FieldQuo's cheapest rung is $99",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          "The clearest loss in the whole comparison and it is at the top of the funnel, where a solo operator starts looking. Both numbers are read rather than typed: theirs off their Offer markup, ours out of SEAT_LADDER. There is no reading of a single-user comparison that favours us, and a page that fudges this is a page that gets caught on its cheapest claim.",
      },
      {
        capability: "mobile_app",
        claim: "QuoteIQ ships iOS and Android apps and tells you to download one during signup",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Their own getting-started steps read "Download the app on iOS or Android and log in immediately." FieldQuo is a responsive web app.',
      },
      {
        capability: "accounting_sync",
        claim: "QuoteIQ includes a QuickBooks integration from its Pro tier",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Listed on Pro as "QuickBooks Integration". docs/INTEGRATIONS-ASSESSMENT.md records that we have no sync at all, only a bookkeeping CSV.',
      },
      {
        capability: "self_serve_demo",
        claim: "QuoteIQ offers a scheduled demo and a phone number",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: '"Schedule A Demo — Book a personalized walkthrough with our team", beside a support telephone number.',
      },
    ],
    weHaveTheyDont: [
      {
        capability: "free_crew_seats",
        claim:
          "Every QuoteIQ user is a paid user; FieldQuo bills only the people who originate money and includes field crew free",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Their tiers are "1 User", "2 Users", "4 Users", "10 Users", "Unlimited Users" and every one is a login you pay for. FieldQuo Scale is ten seats AND fifteen crew — twenty-five people — for $369. The honest scope: this is why they win at one person and we win at ten, and the claim must be made with FIELDQUO_CAPABILITIES.field_worker_quotes beside it, because our crew cannot price a job.',
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
/** The two directions a comparative claim can point. */
export const CLAIM_CONCESSION = "concession";
export const CLAIM_ADVANTAGE = "advantage";

/**
 * May this claim be printed? Two directions, two evidentiary bars.
 *
 * ══ Why the bar is asymmetric ══════════════════════════════════════════════
 *
 * A CONCESSION ("Projul ships a mobile app and we do not") may rest on the
 * owner's signed assertion. The only party a wrong concession can harm is
 * FieldQuo: we understate ourselves and lose a sale. Holding it to a page read
 * would mean the five inconvenient things his Projul lists named — an app,
 * QuickBooks, Gantt charts, purchase orders, daily logs — quietly do not reach
 * the page, and a comparison that concedes only the cheap point is a brochure.
 *
 * A CLAIM OF ADVANTAGE ("they cannot do X and we can") may not. It is a
 * statement about somebody else's product, published under our name, and it
 * needs their own page behind it. An assertion, however well reasoned, is not
 * their page.
 *
 * ══ Why this is its own exported function ══════════════════════════════════
 *
 * It was a closure inside claims(), and mutation testing walked through it:
 * relaxing the advantage bar to accept an assertion changed nothing anybody
 * could observe, because every advantage claim in the data today happens to be
 * publisher-sourced. A rule that only bites on data that does not exist yet is
 * a rule nothing tests. Pulled out so the check can drive both directions
 * directly with synthetic entries.
 */
export function claimPublishable(entry, direction) {
  if (entry?.verification === VERIFIED) return true;
  if (direction !== CLAIM_CONCESSION) return false;
  // A concession may rest on the owner having asserted it, OR on his having
  // relayed it from their page. Both are signed records with grounds; neither
  // is a page WE read, which is why neither can back an advantage.
  if (entry?.sourcing === SOURCED_OWNER_ASSERTED) return isSignedAssertion(entry.assertedBy);
  if (entry?.sourcing === SOURCED_OWNER_RELAYED) return isSignedAssertion(entry.relayedBy);
  return false;
}

export function claims(competitorId) {
  const c = competitor(competitorId);
  if (!c) return null;
  const resolve = (list, expectHas, direction) =>
    list.map((entry) => {
      const cap = FIELDQUO_CAPABILITIES[entry.capability];
      const publishable = claimPublishable(entry, direction);
      return {
        ...entry,
        fieldquoHas: cap ? cap.has : null,
        // A claim whose ledger entry points the wrong way is a claim about
        // ourselves that is false. Surfaced rather than silently dropped so a
        // renderer that ignores it still fails the check, not the visitor.
        consistent: Boolean(cap) && cap.has === expectHas,
        publishable,
        sourcing: entry.sourcing || null,
        // Never blank, so a renderer has no excuse for printing an asserted
        // claim as though it came off their page.
        provenance: provenanceLabel(entry, { subject: c.name }),
      };
    });
  return {
    theyHaveWeDont: resolve(c.theyHaveWeDont, false, CLAIM_CONCESSION),
    weHaveTheyDont: resolve(c.weHaveTheyDont, true, CLAIM_ADVANTAGE),
  };
}

// ── The third tier's own lookups ───────────────────────────────────────────
//
// Deliberately parallel to allFigures/publishableFigures rather than folded
// into them. A caller has to ASK for third-hand material by name; there is no
// call that returns publisher figures and user reports mixed together, because
// the first thing such a list loses is which is which.

export function allReportedCosts() {
  return COMPETITORS.flatMap((c) =>
    (c.reportedCosts || []).map((r) => ({ ...r, competitorId: c.id, competitorName: c.name })),
  );
}

export function publishableReportedCosts(asOf) {
  return allReportedCosts().filter((r) => reportedWithholdReason(r, asOf) === null);
}

/** The structural terms — per-technician, implementation fee, annual contract.
 *  Carry no numbers at all, which is why they are the part of the third-hand
 *  material that can be leaned on. */
export function allReportedTerms() {
  return COMPETITORS.flatMap((c) =>
    (c.reportedTerms || []).map((t) => ({ ...t, competitorId: c.id, competitorName: c.name })),
  );
}
