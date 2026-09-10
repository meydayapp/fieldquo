// lib/marketing/parity.js
//
// The only price comparison that means anything: what the SAME capability
// costs on each side.
//
// ══ What these pages were doing wrong ═════════════════════════════════════
//
// /compare/fieldquo-vs-quoteiq printed all ten of their price points as a
// neutral catalogue, cheapest first, and then said in as many words: "Nobody
// has established, feature by feature, which of their tiers carries which of
// the capabilities we sell … this page makes no matched claim in either
// direction — read their list, read ours, and decide."
//
// That is a competitor's price list with our logo on it. A buyer's eye lands
// on $29.99 beside our $99 and the page is lost before a word of it is read.
// Nobody does that homework. The owner's correction was exact: "the purpose is
// not to list the plans, the purpose is to say look you get all of this from
// fieldquo for this price and the equivalent from the competitor is this much
// because all the other cheaper option don't compare."
//
// He is right, and it is also the more honest page. A price is meaningless
// except beside the capability it buys. Their $29.99 tier is not a competitor
// to FieldQuo — it cannot build a website, take a booking, or price a job
// online. Putting it in the headline is a false comparison we were making
// against OURSELVES.
//
// ══ How parity is decided, and why it can be defended ═════════════════════
//
// Only from what the competitor publishes on their own pricing page. Their
// tiers are read into competitors.js with `includedFeatures` and
// `addsOverPreviousTier` verbatim; this file maps those phrases onto our
// matrix keys and then asks, for a given capability, WHICH TIER IS THE FIRST
// ONE THAT CARRIES IT.
//
// The mapping is generous to them on purpose. Where their phrase plausibly
// covers ours, it counts as covered — "e-signatures" counts as our online
// approval even though ours also takes a deposit. A comparison that wins by
// reading a competitor uncharitably is a comparison that loses the moment a
// prospect opens their pricing page in the next tab, and a rep is the one left
// holding it.
//
// ══ The one thing never claimed ═══════════════════════════════════════════
//
// That a capability absent from their pricing page does not exist. It is
// stated as what it is — "not listed on their pricing page at any tier" —
// which is checkable, fair, and quite strong enough. A buyer choosing between
// two products reasonably expects the things they are buying to be on the page
// they are buying from.
import { FEATURE_MATRIX, matrixEntry } from "./featureMatrix";
import {
  COMPETITORS,
  STALE_AFTER_DAYS,
  figureAgeDays,
  isStale,
  reportedWithholdReason,
  withholdReason,
} from "./competitors";
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import * as jobberTiers from "./tierFeatures/jobber";
import * as housecallTiers from "./tierFeatures/housecall_pro";
import * as projulTiers from "./tierFeatures/projul";

/**
 * Tier bullets read off each company's own pricing page.
 *
 * Kept in tierFeatures/ rather than competitors.js because competitors.js was
 * read for PRICES: Jobber's thirteen figures and Housecall Pro's four carry
 * not one feature phrase between them, so this module reported that Jobber's
 * $499 Plus and Housecall Pro's $329 Max carried no capability whatsoever —
 * not a weak comparison, a visibly wrong one that would have been caught by
 * the first prospect to read it.
 *
 * A module that exports nothing yet resolves to an empty mapping rather than
 * throwing, so a competitor nobody has mapped degrades to "we have not
 * established this" instead of taking the page down.
 */
const TIER_SOURCES = Object.freeze({
  jobber: jobberTiers,
  housecall_pro: housecallTiers,
  projul: projulTiers,
});

/**
 * Their words on the left, our capability keys on the right.
 *
 * Keyed by competitor id, then by the EXACT phrase their pricing page uses, as
 * stored in competitors.js. An exact-phrase key rather than a fuzzy match, so
 * that when they reword a tier the mapping stops matching and the check fails,
 * instead of quietly drifting into a claim nobody re-read.
 */
export const TIER_MAPPINGS = Object.freeze({
  quoteiq: Object.freeze({
    // Essentials, $29.99
    "create and send estimates": ["quotes", "quote_send", "quote_pdf"],
    "create and send invoices": ["invoices", "invoice_send"],
    "scheduling and calendar": ["scheduling", "jobs"],
    "accept online payments": ["card_payments"],
    "AI Virtual Call Team": ["voice_receptionist"],
    "consumer financing": ["financing"],
    // Beginner, $74.99
    "MapMeasure Pro": ["aerial_measure"],
    "QuoteIQ Cam": ["job_photos"],
    "Review Multiplier": ["review_requests"],
    "e-signatures": ["online_approval"],
    "advanced analytics": ["dashboard"],
    // Pro, $149.99
    "email and text automation": ["follow_ups"],
    "in-app calling and texting": ["crew_inbox"],
    "job costing": ["job_costing"],
    // No FieldQuo equivalent. Listed with an empty array rather than omitted,
    // so "we have not mapped this" and "this maps to nothing of ours" stay
    // distinguishable — the first is an oversight, the second is a real gap on
    // our side and belongs in theyHaveWeDont, where QuickBooks already is.
    "QuickBooks integration": [],
    "website contact form": ["lead_form"],
    // Elite, $299
    EmployeeHub: ["team_access"],
    "InstaQuote and InstaSchedule": ["instant_quotes", "booking_page"],
    "route optimisation": [],
    "pipelines and inventory": ["materials"],
    "mass text and email campaigns": ["email_campaigns"],
    // Max, $699
    "unlimited users": [],
    "AI Website Builder included": ["website_builder"],
    "Sales Team Tracker": [],
    "priority support": [],
    "crew management": ["crew_shifts"],
  }),

  // ── ServiceTitan, from the reported tiers rather than a published page ──
  //
  // They print no prices at all — the served pricing page contains zero dollar
  // amounts and "Request Pricing" three times. What exists is what contractors
  // report paying, and those reports come with tier INCLUDES and EXCLUDES,
  // which is the more useful half: an exclusion is the competitor's own tier
  // structure saying a capability is not in the plan.
  servicetitan: Object.freeze({
    "dispatching, on a drag-and-drop board": ["scheduling"],
    "scheduling and calendar": ["scheduling", "jobs"],
    "call booking with a caller-ID pop-up": ["voice_receptionist"],
    "basic invoicing": ["invoices", "invoice_send"],
    "a basic price book": ["price_book"],
    CRM: ["clients", "leads"],
    "a mobile app": [],
    "GPS tracking": [],
    "payment processing": ["card_payments"],
    "basic reporting": ["dashboard"],
    "mobile estimates": ["quotes"],
    "payroll management": ["payroll"],
    "advanced reporting": ["dashboard", "benchmark"],
    "commission tracking": [],
    "service agreements": ["service_plans"],
    "full price book": ["price_book", "material_costs"],
    "customisable reporting": ["dashboard"],
    "inventory management": ["materials"],
    "membership management": ["service_plans"],
    "job costing": ["job_costing"],
    "timesheets": ["timesheets"],
    "marketing automation": ["email_campaigns", "follow_ups"],
    "customer portal": ["client_portal"],
    "advanced reporting and the KPI dashboard": ["dashboard", "benchmark", "goals"],
    "advanced inventory": ["materials", "material_costs"],
    "project management": ["jobs", "tasks", "work_areas"],
  }),

  // Jobber, Housecall Pro and Projul are mapped in their own files — see
  // TIER_SOURCES above — and merged in below.
});

/** Every mapping, whether it lives here or in a tierFeatures module. */
export function mappingFor(competitorId) {
  return TIER_MAPPINGS[competitorId] || TIER_SOURCES[competitorId]?.TIER_FEATURES || {};
}

/** What a competitor sells separately, on top of the tier price. */
/* ═══════════════════════════════════════════════════════════════════════════
   The gate this module did not have
   ═══════════════════════════════════════════════════════════════════════════

   competitors.js guards a figure on four axes and one of them is AGE:
   `withholdReason` refuses anything last read more than STALE_AFTER_DAYS ago,
   so a price nobody has re-checked in three months stops being printed rather
   than sitting on a static page being wrong. tierFeatures/ is a SECOND
   reading of the same companies' pricing pages — richer, because it carries
   the tier bullets the figures never had — and it arrived without that gate.
   Every tier and every add-on in there already carries `source` and `checked`;
   nothing read them. AGENTS.md failure class 1, on the one surface where the
   consequence is a false public statement about somebody else's prices.

   ══ Why `asOf` is optional here and required in competitors.js ═════════════

   figureAgeDays throws without a date, on the argument that a caller who does
   not know what day it is has no business deciding whether a price is fresh.
   That is right for a module whose only job is figures. It is not available
   here without breaking two callers that legitimately want the RESEARCH
   rather than the publishable subset: scripts/check-comparison-pages.mjs
   asserts that every tier phrase maps onto a matrix key, which is a question
   about the mapping and not about the calendar, and it must keep answering it
   on a stale ladder.

   So the date is optional and the guarantee is moved to where it can be
   enforced: every PUBLIC caller passes one, and
   scripts/check-compare-pages.mjs renders the real pages far enough forward
   that every reading behind them has aged out and asserts that not one
   competitor amount survives. A signature cannot make a caller honest; a page
   rendered at a future date and read for dollar signs can.

   lib/sales/playbook/battlecards.js is the one caller that still passes
   nothing, and that is a gap rather than a decision — see the report. It is
   an internal surface a rep reads, not a page a homeowner reads.  */

/** True when a reading carrying a `checked` date has aged past the window. */
function readingStale(entry, asOf) {
  if (!asOf) return false;
  return isStale(entry, asOf);
}

/**
 * How old the freshest reading behind this competitor is, in days.
 *
 * Exported because the check script needs to know when EVERYTHING on a page
 * has aged out, and the two sources behind a page were read on different days.
 * A hard-coded "ninety-five days on" date in a check is a date that stops
 * meaning ninety-five days the moment somebody re-reads one of the two.
 */
export function newestReading(competitorId) {
  const competitor = COMPETITORS.find((c) => c.id === competitorId);
  const dates = [
    ...(TIER_SOURCES[competitorId]?.PUBLISHED_TIERS || []).map((t) => t.checked),
    ...(TIER_SOURCES[competitorId]?.ADD_ONS || []).map((a) => a.checked),
    ...(competitor?.figures || []).map((f) => f.checked),
    ...(competitor?.reportedCosts || []).map((r) => r.checked),
    ...(competitor?.weHaveTheyDont || []).map((c) => c.checked),
    ...(competitor?.theyHaveWeDont || []).map((c) => c.checked),
  ].filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!dates.length) return null;
  return dates.sort().at(-1);
}

/**
 * Their paid add-ons, with the stale ones gone.
 *
 * caseRows sums these into the "+$177/mo" cell, which is the strongest true
 * line on the Jobber page — and was also, before this, the one amount that
 * survived on a page whose every price row had emptied.
 */
export function addOnsFor(competitorId, asOf = null) {
  const list = TIER_SOURCES[competitorId]?.ADD_ONS;
  if (!Array.isArray(list)) return [];
  return list.filter((a) => !readingStale(a, asOf));
}

/** What a page about this competitor must not get wrong. */
export function notesFor(competitorId) {
  const list = TIER_SOURCES[competitorId]?.NOTES;
  return Array.isArray(list) ? list : [];
}

/**
 * Their monthly tiers, cheapest first, with our keys attached cumulatively.
 *
 * Pass `asOf` from any surface a stranger can read. Every one of the three
 * sources below is then put through the gate that source has: a tier we read
 * off their page ages out at STALE_AFTER_DAYS, a stored figure goes through
 * withholdReason, and a reported band goes through reportedWithholdReason,
 * which is a different gate for a different kind of claim and is deliberately
 * not the same function.
 */
export function tierLadder(competitorId, asOf = null) {
  const competitor = COMPETITORS.find((c) => c.id === competitorId);
  if (!competitor) return [];
  const map = mappingFor(competitorId);

  // A page we read ourselves beats a figure read for its price alone. Where a
  // tierFeatures module carries the bullets, they ARE the ladder — the stored
  // figures have no features to attach and would report an empty product.
  const published = TIER_SOURCES[competitorId]?.PUBLISHED_TIERS;
  if (Array.isArray(published) && published.length) {
    // The whole ladder goes when the reading goes, not tier by tier. A ladder
    // missing its middle rungs is worse than no ladder: "their cheapest plan
    // with what we include" would silently point at a different tier, and
    // nothing on the page would say a rung had dropped out.
    const fresh = published.filter((t) => !readingStale(t, asOf));
    if (fresh.length !== published.length) return [];
    return publishedLadder(fresh, map);
  }

  const monthly = competitor.figures
    .filter((f) => f.axis?.billing !== "annual_prepaid" && f.price?.kind === "amount")
    .filter((f) => (asOf ? withholdReason(f, asOf) === null : true))
    .sort((a, b) => a.price.amount - b.price.amount);

  // A company that publishes no prices still has tiers, and what contractors
  // report about them carries INCLUDES and EXCLUDES. Used only when the
  // published figures gave nothing — never mixed with them, because one is
  // read off their own page and the other is a forum thread, and a table that
  // blends the two is exactly the dishonest version of a true argument.
  if (!monthly.length && Array.isArray(competitor.reportedCosts) && competitor.reportedCosts.length) {
    return reportedLadder(competitor, map, asOf);
  }

  const carried = new Set();
  return monthly.map((f) => {
    // A tier list is written as "adds over the tier below", so the set is
    // cumulative by construction. Reading each tier's line in isolation would
    // say Elite cannot send an invoice.
    const phrases = [...(f.includedFeatures || []), ...(f.addsOverPreviousTier || [])];
    const added = [];
    for (const phrase of phrases) {
      for (const key of map[phrase] || []) {
        if (!carried.has(key)) {
          carried.add(key);
          added.push(key);
        }
      }
    }
    return {
      id: f.id,
      label: f.label,
      price: f.price.amount,
      currency: f.price.currency,
      seats: f.seatsIncluded ?? null,
      phrases,
      // Unmapped phrases are surfaced, not swallowed: a phrase this file has
      // never seen is a tier they reworded, and the check turns it into a
      // failure rather than a silently weaker comparison.
      unmapped: phrases.filter((p) => !Object.hasOwn(map, p)),
      adds: added,
      covers: new Set(carried),
      source: f.source || null,
      checked: f.checked || null,
    };
  });
}

/**
 * The ladder, from tier bullets we read off their own pricing page.
 *
 * Cumulative in price order, because a pricing page's bullets are written as
 * "and everything below" even when the page does not say so — reading each
 * tier in isolation claims their top plan cannot send an invoice.
 *
 * Jobber sells the same tier at different prices by TEAM-SIZE BAND, so the
 * same label appears more than once. Deduplicated on label, keeping the
 * cheapest, because a comparison table with "Core" twice at two prices reads
 * as an error even though both figures are true; the band caveat is carried in
 * notesFor() and printed by the page.
 */
function publishedLadder(tiers, map) {
  // Price from the cheapest band, features from whichever band prints them.
  // Taking both from one row put Connect and Grow on the table at $199 each —
  // both figures true, and the table reads as a mistake. A buyer comparing
  // ladders needs each rung named once, at the lowest price it is sold for.
  // Projul sells a flat ANNUAL fee and no monthly option at all, so a ladder
  // that reads only `monthly` skipped every tier and reported that Projul
  // sells nothing. The annual figure is divided for ORDERING and for a
  // like-for-like column, and the fact that it cannot actually be paid monthly
  // is carried alongside — it is one of the strongest true lines about them,
  // not a footnote: you buy a year to find out whether it suits you.
  const byLabel = new Map();
  for (const t of tiers) {
    const annualOnly = typeof t.monthly !== "number" && typeof t.annual === "number";
    const price = annualOnly ? Math.round(t.annual / 12) : (t.monthly ?? t.price ?? null);
    // Whether that division was EXACT, kept beside the number rather than
    // inferred from it. All three Projul tiers divide clean today —
    // $14,388 ÷ 12 is $1,199 with nothing left over — and the page says
    // "a month equivalent" beside them, which is a true sentence about an
    // exact figure. It stops being one the day their annual price is not a
    // multiple of twelve: Math.round would hand the page an amount nobody
    // charges, labelled with the one word this site is not allowed to attach
    // to money it did not read. The renderer prints the monthly only when
    // this is true; scripts/check-compare-pages.mjs enforces the pairing.
    const monthlyExact = annualOnly ? t.annual % MONTHS_PER_YEAR === 0 : true;
    if (typeof price !== "number") continue;
    const existing = byLabel.get(t.label);
    if (!existing) {
      byLabel.set(t.label, {
        ...t,
        monthly: price,
        annualOnly,
        annualTotal: t.annual ?? null,
        monthlyExact,
      });
      continue;
    }
    if (price < (existing.monthly ?? Infinity)) {
      existing.monthly = price;
      existing.annualPrepaid = t.annualPrepaid ?? existing.annualPrepaid ?? null;
      existing.seatsIncluded = t.seatsIncluded ?? existing.seatsIncluded ?? null;
    }
    if ((t.includedFeatures || []).length > (existing.includedFeatures || []).length) {
      existing.includedFeatures = t.includedFeatures;
      existing.addsOverPreviousTier = t.addsOverPreviousTier;
    }
  }

  const ordered = [...byLabel.values()].sort((a, b) => a.monthly - b.monthly);

  const carried = new Set();
  return ordered.map((t) => {
    const phrases = [...(t.includedFeatures || []), ...(t.addsOverPreviousTier || [])];
    const added = [];
    for (const phrase of phrases) {
      for (const key of map[phrase] || []) {
        if (!carried.has(key)) {
          carried.add(key);
          added.push(key);
        }
      }
    }
    return {
      id: t.id,
      label: t.label,
      price: t.monthly ?? t.price,
      annualPrepaid: t.annualPrepaid ?? null,
      // True when the company sells no monthly plan at all.
      annualOnly: Boolean(t.annualOnly),
      annualTotal: t.annualTotal ?? null,
      monthlyExact: t.monthlyExact !== false,
      currency: t.currency || "USD",
      seats: t.seatsIncluded ?? null,
      phrases,
      unmapped: phrases.filter((p) => !Object.hasOwn(map, p)),
      adds: added,
      covers: new Set(carried),
      source: t.source || null,
      checked: t.checked || null,
    };
  });
}

/**
 * The same ladder, built from reported tiers.
 *
 * `excludes` is the valuable half and is applied AFTER the cumulative include:
 * a tier that reports excluding mobile estimates does not carry them, whatever
 * a lower tier's prose implied.
 */
function reportedLadder(competitor, map, asOf = null) {
  const carried = new Set();
  const entries = asOf
    ? competitor.reportedCosts.filter((r) => reportedWithholdReason(r, asOf) === null)
    : competitor.reportedCosts;
  return entries.map((r) => {
    const added = [];
    for (const phrase of r.includes || []) {
      for (const key of map[phrase] || []) {
        if (!carried.has(key)) {
          carried.add(key);
          added.push(key);
        }
      }
    }
    const excluded = new Set();
    for (const phrase of r.excludes || []) for (const key of map[phrase] || []) excluded.add(key);
    const covers = new Set([...carried].filter((k) => !excluded.has(k)));
    return {
      id: r.id,
      label: r.label,
      // No amount: a reported band is a sentence, not a number, and giving it
      // a `price` would let it be summed, averaged or compared like a figure
      // read off a page.
      price: null,
      // `Reported` is a CLASS with toString()/toJSON() and NO enumerable
      // properties — `.reported` reads undefined, which is how this rendered a
      // blank cost section on a page whose whole subject is cost. String() is
      // the only reader there is.
      reportedBand: r.price?.band ? String(r.price.band) : null,
      alsoReported: r.alsoReported ? String(r.alsoReported) : null,
      // The rest of what competitors.js says a reported band may never be
      // printed without: which KINDS of source said it, when it was last
      // checked, and — the one a Canadian reader most needs — that neither
      // source states which dollar. reportedCostText() assembles the sentence;
      // the id is carried so a renderer can find the entry rather than
      // re-deriving it, and so the check can hold the two together.
      reportedId: r.id,
      reportedVia: (r.reportedVia || []).map((v) => v.kind),
      currencyStated: r.price?.currency !== "not_stated",
      minimum: r.minimumTechnicians ? String(r.minimumTechnicians) : null,
      currency: null,
      seats: null,
      phrases: [...(r.includes || []), ...(r.excludes || [])],
      unmapped: [...(r.includes || []), ...(r.excludes || [])].filter((p) => !Object.hasOwn(map, p)),
      adds: added,
      excludes: [...excluded],
      covers,
      reported: true,
      source: null,
      checked: r.checked || null,
    };
  });
}

/** The cheapest tier of theirs that carries this capability, or null. */
export function firstTierWith(competitorId, key, asOf = null) {
  for (const tier of tierLadder(competitorId, asOf)) {
    if (tier.covers.has(key)) return tier;
  }
  return null;
}

/**
 * What a FieldQuo plan's capability list costs on their side.
 *
 * The headline of the whole page: everything in this list is included at our
 * price; the cheapest tier of theirs that carries MOST of it is that one; and
 * these are the ones no tier of theirs lists at any price.
 *
 * `keys` defaults to every shipped capability, because that is what our price
 * actually includes — every plan carries every feature. Our ladder sells
 * PEOPLE, not features, which is itself the argument.
 */
export function parityFor(competitorId, { keys = null, asOf = null } = {}) {
  const wanted = keys || shippedKeys();
  const ladder = tierLadder(competitorId, asOf);
  if (!ladder.length) {
    return { known: false, tier: null, covered: [], missing: [...wanted], ladder: [] };
  }

  const top = ladder.at(-1);
  const covered = wanted.filter((k) => top.covers.has(k));
  const missing = wanted.filter((k) => !top.covers.has(k));

  // The tier a buyer actually has to reach: the cheapest one carrying
  // everything of ours that they carry AT ALL. Anything below it is a tier
  // that cannot do something they themselves sell higher up, which is the
  // cleanest possible way to say "the cheaper plans do not compare" — in their
  // own product's terms rather than ours.
  const needed = ladder.find((t) => covered.every((k) => t.covers.has(k))) || top;

  return { known: true, tier: needed, top, covered, missing, ladder };
}

/** Everything we ship, in matrix order. */
export function shippedKeys() {
  return FEATURE_MATRIX.filter((e) => e.readiness === "shipped").map((e) => e.key);
}

/**
 * Ours that no tier of theirs lists, grouped the way the matrix groups them.
 *
 * The section a prospect reads twice. Worded as "not listed on their pricing
 * page" everywhere it renders — see the header.
 */
export function neverListed(competitorId, asOf = null) {
  const ladder = tierLadder(competitorId, asOf);
  if (!ladder.length) return [];
  const top = ladder.at(-1).covers;
  return FEATURE_MATRIX.filter((e) => e.readiness === "shipped" && !top.has(e.key));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Amounts this page WORKS OUT rather than reads
   ═══════════════════════════════════════════════════════════════════════════

   "$4,800/yr" is not a price anybody publishes. It is $499 minus $99, twelve
   times, and it is the sentence the owner asked these pages to make: you get
   all of this from FieldQuo for this price and the equivalent from the
   competitor is this much. Refusing it because no vendor prints "4800" would
   gut the page; printing it as a bare number puts an unsourced amount on a
   public comparison, which is the thing every other rule here exists to stop.

   So a derived amount is legitimate under three conditions, and it carries
   them with it rather than being trusted:

     1. every INPUT is a figure that publishes in its own right — theirs
        through competitors.js's or this module's gate, ours out of
        SEAT_LADDER;
     2. the operation is DECLARED, and re-running it reproduces the printed
        number exactly, with no rounding standing in for a claim;
     3. the page SHOWS THE WORKING. A reader sees $99, sees $499 and sees
        $4,800/yr in the same block, and can check us with a phone.

   The record below is what makes all three checkable from the markup:
   scripts/check-compare-pages.mjs finds every element carrying
   `data-derived-value`, re-runs the declared operation against the published
   set, and requires each input to be printed inside that same element. A
   derived figure with no record, or a record whose inputs are not on the
   page, fails — which is what makes this a RULE rather than an allow-list
   that the next derived number gets appended to.  */

/** A definition, not a judgement. Named so the arithmetic reads as English. */
export const MONTHS_PER_YEAR = 12;

export const DERIVED_SAVING = "annual_saving";
export const DERIVED_MONTHLY_FROM_ANNUAL = "monthly_from_annual";

/**
 * What a year on their tier costs over a year on ours.
 *
 * `exact` is not decoration. A saving that needed rounding to be printed is a
 * saving we are asserting to the cent and cannot support to the cent; QuoteIQ
 * Pro against our Solo is $50.99 a month, and $611.88 is that number twelve
 * times with nothing left over. Anything that does not divide clean is
 * refused rather than rounded.
 */
export function derivedSaving({ theirs, ours }) {
  if (typeof theirs !== "number" || typeof ours !== "number") return null;
  const raw = (theirs - ours) * MONTHS_PER_YEAR;
  const value = Math.round(raw * 100) / 100;
  return {
    op: DERIVED_SAVING,
    inputs: [theirs, ours],
    months: MONTHS_PER_YEAR,
    value,
    exact: Math.abs(raw - value) < 1e-9,
  };
}

/** Their annual-only price, said per month. Exact division or nothing. */
export function derivedMonthlyFromAnnual(annual) {
  if (typeof annual !== "number" || annual % MONTHS_PER_YEAR !== 0) return null;
  return {
    op: DERIVED_MONTHLY_FROM_ANNUAL,
    inputs: [annual],
    months: MONTHS_PER_YEAR,
    value: annual / MONTHS_PER_YEAR,
    exact: true,
  };
}

/**
 * Re-runs a derivation from its own record. The check's second opinion.
 *
 * Deliberately does NOT read `value`: it recomputes from `inputs` and `op` and
 * hands back what the page should have printed. A record that disagrees with
 * its own arithmetic is caught by comparing the two, which is impossible if
 * the recomputation trusts the stored answer.
 */
export function recomputeDerived({ op, inputs = [], months = MONTHS_PER_YEAR } = {}) {
  if (op === DERIVED_SAVING) {
    if (inputs.length !== 2) return null;
    return Math.round((inputs[0] - inputs[1]) * months * 100) / 100;
  }
  if (op === DERIVED_MONTHLY_FROM_ANNUAL) {
    if (inputs.length !== 1 || inputs[0] % months !== 0) return null;
    return inputs[0] / months;
  }
  return null;
}

/** The record, as data attributes. One shape, so the check has one to read. */
export function derivationProps(d) {
  if (!d || !d.exact) return {};
  return {
    "data-derived-op": d.op,
    "data-derived-inputs": d.inputs.join(","),
    "data-derived-months": String(d.months),
    "data-derived-value": String(d.value),
  };
}

/**
 * The comparison a buyer is actually making: what it costs for THEIR shop.
 *
 * The axis we win on, and the one a sticker price hides. They bill every
 * login. We bill the people who price work and carry field crew free, so a
 * six-person outfit with two estimators is three seats to us and six users to
 * them — and their six-user answer is a ten-user tier, because they do not
 * sell a six.
 *
 * @param estimators people who price work, quote, invoice — billable both sides
 * @param crew       people in vans, who see the schedule and the job
 */
export function shopMath({ estimators = 1, crew = 0 } = {}, competitorId, asOf = null) {
  const heads = Math.max(1, Math.round(estimators)) + Math.max(0, Math.round(crew));
  const seatsNeeded = Math.max(1, Math.round(estimators));
  const crewNeeded = Math.max(0, Math.round(crew));

  const plan =
    SEAT_LADDER.find((p) => p.seats >= seatsNeeded && p.crewSeats >= crewNeeded) ||
    SEAT_LADDER.at(-1);

  const ladder = tierLadder(competitorId, asOf);
  // Every head is a login on a per-user product, so the tier has to seat all
  // of them — not just the ones who write quotes.
  const priced = ladder.filter((t) => typeof t.price === "number");
  const tier =
    priced.find((t) => t.seats === null || t.seats >= heads) || priced.at(-1) || null;

  return {
    heads,
    fieldquo: plan
      ? { label: plan.label, price: plan.price, seats: plan.seats, crew: plan.crewSeats }
      : null,
    competitor: tier
      ? { label: tier.label, price: tier.price, seats: tier.seats, currency: tier.currency }
      : null,
    // Null rather than 0 when either side is unknown: an invented saving is
    // the one number on this page a prospect can disprove with a calculator.
    savesPerMonth: plan && tier ? Math.round((tier.price - plan.price) * 100) / 100 : null,
    savesPerYear:
      plan && tier ? Math.round((tier.price - plan.price) * MONTHS_PER_YEAR * 100) / 100 : null,
    // The same number again, with its working attached. See DERIVED_SAVING.
    saving: plan && tier ? derivedSaving({ theirs: tier.price, ours: plan.price }) : null,
  };
}

/**
 * The single strongest true line on the page, computed rather than written.
 *
 * Finds a capability that we include on EVERY plan and that they gate behind
 * their most expensive tier, and returns both prices. On QuoteIQ this is the
 * website builder: ours at $99, theirs at $699.
 */
export function biggestGateGap(competitorId, asOf = null) {
  const ladder = tierLadder(competitorId, asOf);
  if (ladder.length < 2) return null;
  const cheapestOfOurs = SEAT_LADDER[0];

  let best = null;
  for (const entry of FEATURE_MATRIX) {
    if (entry.readiness !== "shipped" || entry.availability !== "every_plan") continue;
    const tier = firstTierWith(competitorId, entry.key, asOf);
    if (!tier || typeof tier.price !== "number") continue;
    const gap = tier.price - cheapestOfOurs.price;
    if (!best || gap > best.gap) {
      best = { key: entry.key, name: entry.name, tier, gap, ours: cheapestOfOurs };
    }
  }
  return best && best.gap > 0 ? best : null;
}

/** Matrix entries for a list of keys, in matrix order, skipping unknowns. */
export function entriesFor(keys = []) {
  const wanted = new Set(keys);
  return FEATURE_MATRIX.filter((e) => wanted.has(e.key));
}

export { matrixEntry };
