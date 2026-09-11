// lib/sales/playbook/battlecards.js
//
// What a rep says when a contractor names Jobber, Housecall Pro, ServiceTitan,
// Projul or QuoteIQ — assembled from the SAME rows the public comparison
// pages render, never typed a second time.
//
// ══ Why not a table of competitor facts written for reps ══════════════════
//
// Because that table is AGENTS.md failure class 4 with a customer listening.
// lib/marketing/competitors.js already holds every figure, every claim and
// every provenance line, with a source URL and a verification tier on each,
// and /compare renders it. A second hand-typed copy in the sales portal would
// be the one nobody re-reads, and the day a competitor changes a price the
// marketing site would move and the rep would not — so a homeowner and a
// contractor would be quoted two different versions of the same fact by the
// same company, and the rep's would be the wrong one.
//
// So there is nothing in this file that a rep can read which is not derived
// from a row somebody sourced. Every string below is either assembled out of
// those rows or is a sentence about FieldQuo itself.
//
// ══ The publishability gate is not re-implemented, it is CALLED ═══════════
//
// competitors.js draws an asymmetry that took an argument to get right: a
// CONCESSION (they have something we do not) may rest on the owner's signed
// assertion, because a wrong concession only costs us; a CLAIM OF ADVANTAGE
// (they cannot do X) needs their own page behind it, because it is a public
// statement about somebody else's product. `claims()` encodes that.
//
// A cold call is a MORE exposed surface than a web page, not a less exposed
// one: the page can be corrected in an hour and a sentence said down a phone
// cannot. So this file uses the same gate and never a looser one, and the
// check drives an unpublishable claim through it and asserts it does not
// reach a rep.
//
// ══ Honest first, and the honesty is the useful half ══════════════════════
//
// The owner's instruction was "be honest — a rep who oversells gets caught on
// the call", and every battlecard therefore leads with what the competitor
// genuinely does well. Where the data holds nothing publishable about them, it
// does NOT go quiet: it falls through to FIELDQUO_LACKS, which is our own
// list of what we do not have and is always sayable because it is about us.
// A card whose "what they do well" section were simply empty would read as a
// competitor with no strengths, which is the brochure this whole data model
// exists to refuse. AGENTS.md failure class 5: the absence of a statement is
// not a statement, so `theyDoWellWithheld` says how many rows were held back
// and why rather than letting the count read as zero.
import {
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  FIELDQUO_PRICING_UNIT,
  FIELDQUO_REFERENCE,
  PRICING_UNITS,
  claims,
  competitor,
  publishableFigures,
  publishableReportedCosts,
  reportedCostText,
  allReportedTerms,
  COMPETITORS,
} from "@/lib/marketing/competitors";
import { biggestGateGap, neverListed, parityFor, shopMath } from "@/lib/marketing/parity";
import { comparePageForCompetitor } from "@/app/(marketing)/compare/compareCopy";

/**
 * The shop a battlecard prices against when nobody has said otherwise.
 *
 * Two people who price work and four in vans — six heads, which is the size
 * the owner's own conversations are with and the size where the seat/crew
 * split starts to matter. Named rather than inlined so a screen that lets a
 * rep type their prospect's real headcount passes the same shape in, and so
 * the check can assert the number that gets printed came from here.
 */
export const DEFAULT_SHOP = Object.freeze({ estimators: 2, crew: 4 });

/** How many of the forty-odd unlisted features a card names before it counts the rest. */
export const MAX_NEVER_LISTED = 6;

/**
 * Why a battlecard is thinner than it looks like it should be.
 *
 * Same idea as generate.js's DEGRADED_REASONS: a card with an empty section
 * has to say which of these it is, because "we hold nothing" and "we hold
 * something we may not repeat" are different facts and a rep needs to know
 * which one they are standing on.
 */
export const WITHHELD_REASONS = Object.freeze({
  unverified:
    "Recorded, but nobody has read it off their own page — so it is not something to say on a call.",
  none_recorded: "Nothing is recorded about this competitor in that direction.",
});

/** Our own list of what we do not have, in the words competitors.js uses. */
function ourOwnLimits() {
  return FIELDQUO_LACKS.map((key) => ({
    capability: key,
    label: FIELDQUO_CAPABILITIES[key]?.label || null,
    evidence: FIELDQUO_CAPABILITIES[key]?.evidence || null,
  })).filter((l) => l.label);
}

/**
 * The price half.
 *
 * Deliberately returns THREE separate things rather than one number:
 *
 *   figures    what they publish, each with its coordinates. A figure without
 *              its team-size and billing selectors is not a figure —
 *              competitors.js paid for that lesson on Jobber twice in one day.
 *   reported   third-hand material (ServiceTitan), which is a RANGE that never
 *              collapses to a midpoint and may never be stated as a fact about
 *              their pricing. Kept in its own field so a rep cannot read it as
 *              the same kind of thing as a published price.
 *   unit       how they count people, and the caveat that goes with mapping
 *              their count onto ours. The caveat travels with the mapping
 *              because a rep who maps twenty technicians onto free crew
 *              without saying it is making a comparison we cannot defend.
 */
function priceSection(id, asOf) {
  const co = competitor(id);
  const unit = PRICING_UNITS[co.pricingUnit] || null;
  const figures = publishableFigures(asOf)
    .filter((f) => f.competitorId === id)
    .map((f) => ({
      id: f.id,
      label: f.label,
      axis: f.axis || null,
      seatsIncluded: f.seatsIncluded ?? null,
      amount: f.price?.amount ?? null,
      currency: f.price?.currency ?? null,
      per: f.price?.per ?? null,
      source: f.source,
      checked: f.checked,
    }));

  const reported = publishableReportedCosts(asOf)
    .filter((r) => r.competitorId === id)
    .map((r) => ({ id: r.id, text: reportedCostText(r, { subject: co.name }) }));

  const terms = allReportedTerms()
    .filter((t) => t.competitorId === id)
    .map((t) => ({ id: t.id, statement: t.statement, whyItMatters: t.whyItMatters }));

  return {
    unitKey: co.pricingUnit,
    unitLabel: unit?.label || null,
    countsWhom: unit?.countsWhom || null,
    caveat: unit?.caveat || null,
    ourUnitLabel: PRICING_UNITS[FIELDQUO_PRICING_UNIT]?.label || null,
    entryTier: {
      label: FIELDQUO_REFERENCE.entryTier.label,
      price: FIELDQUO_REFERENCE.entryTier.price,
      seats: FIELDQUO_REFERENCE.entryTier.seats,
      crewSeats: FIELDQUO_REFERENCE.entryTier.crewSeats,
    },
    figures,
    reported,
    terms,
  };
}

/**
 * The two or three lines a rep says when a prospect names them — ASSEMBLED.
 *
 * ══ Why these are built rather than written ═══════════════════════════════
 *
 * A written line is a fourth copy of the competitor facts (the data, the
 * comparison page, the objection library, and then this) and it is the copy
 * that rots, because it is the one nobody diffs against the source. Built from
 * the rows, the worst that can happen when a figure changes is that the
 * sentence changes with it.
 *
 * ══ The shape, and where it comes from ════════════════════════════════════
 *
 * The same four beats as an objection response (objections.js): restate →
 * concede → the one true difference → a small next step. Saylor ch.11's own
 * order, and his rule that you never knock the competition is what decides the
 * SECOND line: it is a fact about their published pricing or about our own
 * ladder, never a claim about how their product behaves.
 *
 * ══ What is never assembled ═══════════════════════════════════════════════
 *
 * A saving. shopMath returns null rather than zero when either side is
 * unknown, and a null never becomes a sentence — an invented saving is the one
 * number on a call a contractor can disprove with a calculator while you are
 * still talking.
 */
function saidOutLoud({ name, theyDoWell, weWin, gateGap, price, math, limits }) {
  const lines = [];

  // 1. Concede, and concede something real. Their strength if we hold one we
  //    can stand behind; ours if we do not. Never nothing.
  const conceded = theyDoWell[0];
  if (conceded) {
    // The claim is QUOTED rather than folded into our own sentence. Their
    // wording is sometimes a noun phrase ("Free mobile app for iOS and
    // Android") and sometimes a whole sentence about their price, and a
    // template that assumed one shape produced a line a rep would read out
    // ungrammatically — which is worse than a plainer one, because it is the
    // sentence that makes the honest half sound rehearsed. So the label out of
    // our own capability ledger carries the grammar, and their words stand as
    // a quotation behind it.
    lines.push({
      beat: "concede",
      text: `Start with what ${name} has that we do not: ${lowerFirst(conceded.label || conceded.claim)}. Their own page says: "${conceded.claim}". If that is what decides it for you, they are the better buy and I would rather say so now.`,
      from: `${name}'s own page — ${conceded.provenance}`,
    });
  } else if (limits[0]) {
    lines.push({
      beat: "concede",
      text: `Before anything else, what we do not have: ${lowerFirst(limits[0].label)}. That is true whoever you compare us with, and if it decides it for you then it decides it.`,
      from: "FIELDQUO_CAPABILITIES — our own ledger, checked against this codebase",
    });
  }

  // 2. The one true difference. A gate gap if there is one (it is the
  //    strongest line available and it is arithmetic), otherwise the pricing
  //    UNIT, which is a structural fact about their own page rather than a
  //    claim about their software.
  if (gateGap) {
    lines.push({
      beat: "difference",
      text: `The narrow thing worth knowing: ${lowerFirst(gateGap.name)} is on their ${gateGap.tier.label} plan at ${money(gateGap.tier.price)} a month. It is on every plan of ours, and ours starts at ${money(gateGap.ours.price)}.`,
      from: `${name}'s published tiers, against lib/pricing/ladder.js`,
    });
  } else if (price.terms[0]) {
    lines.push({
      beat: "difference",
      text: `The thing to know about the price: ${lowerFirst(price.terms[0].statement)}. That is what contractors report rather than anything they publish, so take it as that — but it is the term that decides the bill.`,
      from: "reported terms — third-hand, and labelled as such",
    });
  } else if (price.countsWhom) {
    lines.push({
      beat: "difference",
      text: `They count people differently to us: ${lowerFirst(price.countsWhom)} We bill the people who price work and carry field crew at no charge, so the same shop can be two very different bills.`,
      from: `${name}'s published pricing unit`,
    });
  }

  // 3. Their shop's arithmetic, only when BOTH sides are known.
  if (math?.savesPerMonth !== null && math?.fieldquo && math?.competitor) {
    lines.push({
      beat: "arithmetic",
      text: `For ${math.heads} of you — say ${DEFAULT_SHOP.estimators} pricing work and ${DEFAULT_SHOP.crew} in vans — their ${math.competitor.label} is ${money(math.competitor.price)} and our ${math.fieldquo.label} is ${money(math.fieldquo.price)}. Tell me your real numbers and I will do it again with yours.`,
      from: "shopMath — their published tier against our ladder",
    });
  }

  // 4. The ask. The same one the playbook's next_step makes, deliberately: a
  //    rep who ends a competitor conversation with a different ask has just
  //    run a different call.
  lines.push({
    beat: "ask",
    text: weWin[0]
      ? `Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent out of ${name} — and you tell me what is wrong with it.`
      : `Give me fifteen minutes and I will show you how it works for a business like yours — a quote with your name on it next to the last one you sent — and you tell me what is wrong with it.`,
    from: "the next_step stage in lib/sales/playbook/defaults.js",
  });

  return lines;
}

function lowerFirst(s) {
  const t = String(s || "").trim();
  if (!t) return t;
  // Only when the first word is not a proper noun we would be lower-casing —
  // an all-caps or CamelCase first character is left alone, because "jobber"
  // in the middle of a sentence a rep reads out loud is a typo they will
  // notice and we would rather they did not have to.
  return /^[A-Z][a-z]/.test(t) && !/^[A-Z][a-z]+[A-Z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
}

function money(n) {
  return typeof n === "number" ? `$${n}` : null;
}

/**
 * One battlecard.
 *
 * @param competitorId one of lib/marketing/competitors.js's ids
 * @param asOf         the date staleness is judged against. Passed in rather
 *                     than read from the clock so the check can pin it — a
 *                     figure goes stale at 90 days and a card built "now"
 *                     would quietly change contents between two test runs.
 * @returns null when there is no such competitor. Never a shell.
 */
export function battlecard(competitorId, { asOf = new Date(), shop = DEFAULT_SHOP } = {}) {
  const co = competitor(competitorId);
  if (!co) return null;

  const all = claims(competitorId);
  const theyDoWell = all.theyHaveWeDont
    .filter((c) => c.publishable && c.consistent)
    .map((c) => ({
      capability: c.capability,
      // Our own ledger's noun for the thing, so a spoken sentence has grammar
      // to hang off. Null when the capability is not in the ledger, and the
      // renderer falls back to their words rather than inventing a label.
      label: FIELDQUO_CAPABILITIES[c.capability]?.label || null,
      claim: c.claim,
      provenance: c.provenance,
    }));
  const weWin = all.weHaveTheyDont
    .filter((c) => c.publishable && c.consistent)
    .map((c) => ({ capability: c.capability, claim: c.claim, provenance: c.provenance }));

  const withheldThey = all.theyHaveWeDont.filter((c) => !c.publishable || !c.consistent);
  const withheldWe = all.weHaveTheyDont.filter((c) => !c.publishable || !c.consistent);

  const unlisted = neverListed(competitorId);
  const parity = parityFor(competitorId);
  const gateGap = biggestGateGap(competitorId);
  const price = priceSection(competitorId, asOf);
  const math = shopMath(shop, competitorId);
  const limits = ourOwnLimits();
  const page = comparePageForCompetitor(competitorId);

  return {
    competitorId,
    name: co.name,
    homepage: co.homepage,
    // The public page, by its own slug rather than a second spelling of it.
    // A rep sending a prospect a link and a rep reading this card must be
    // pointing at the same page.
    comparePath: page ? `/compare/${page.slug}` : null,

    theyDoWell,
    theyDoWellWithheld: withheldThey.length
      ? { count: withheldThey.length, reason: WITHHELD_REASONS.unverified }
      : null,
    ourOwnLimits: limits,

    weWin,
    weWinWithheld: withheldWe.length
      ? { count: withheldWe.length, reason: WITHHELD_REASONS.unverified }
      : null,

    // "Not listed on their pricing page" is the wording parity.js insists on
    // everywhere this renders, and it is the honest one: it is a statement
    // about what their page says, not about what their product can do.
    neverListed: unlisted.slice(0, MAX_NEVER_LISTED).map((e) => ({ key: e.key, name: e.name })),
    neverListedTotal: unlisted.length,
    parityTier: parity.known && parity.tier ? { label: parity.tier.label, price: parity.tier.price ?? null } : null,

    gateGap: gateGap
      ? {
          feature: gateGap.name,
          theirTier: gateGap.tier.label,
          theirPrice: gateGap.tier.price,
          ourTier: gateGap.ours.label,
          ourPrice: gateGap.ours.price,
        }
      : null,

    price,
    shop: { ...shop, ...math },

    saidOutLoud: saidOutLoud({ name: co.name, theyDoWell, weWin, gateGap, price, math, limits }),
  };
}

/** Every battlecard, in the order the comparison pages are ordered. */
export function battlecards({ asOf = new Date(), shop = DEFAULT_SHOP } = {}) {
  return COMPETITORS.map((c) => battlecard(c.id, { asOf, shop })).filter(Boolean);
}

/**
 * The words a contractor actually says, mapped to a card.
 *
 * Matched as lower-cased substrings and nothing cleverer, for the reason
 * objections.js gives for the same decision: a near-match that opens the wrong
 * card is worse than no match, because the rep reads it out. "We're on
 * Jobber" has to find Jobber; "we've got a job board" must not.
 */
export function matchBattlecard(text) {
  const hay = String(text || "").toLowerCase();
  if (!hay.trim()) return [];
  return COMPETITORS.filter((c) => {
    const spellings = [c.name.toLowerCase(), c.name.toLowerCase().replace(/\s+/g, "")];
    return spellings.some((s) => hay.includes(s));
  }).map((c) => c.id);
}
