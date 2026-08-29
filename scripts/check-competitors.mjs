// scripts/check-competitors.mjs
//
// This one guards a public page that names four real companies and says they
// cost more than we do.
//
// Every other check in this directory protects a customer from a control that
// does not work. This protects FieldQuo from publishing a false statement
// about somebody else's prices — a different failure with a different blast
// radius, because a wrong number on /pricing is not a bug report, it is a
// letter. The figures in lib/marketing/competitors.js therefore matter less
// than the states around them, and that is what almost everything below tests.
//
// ══ What the owner supplied, and what it turned out to be ══════════════════
//
// He gave four sets of figures from memory and asked for "the CAD equivalent"
// of the USD ones. Checking them against the live pages on 2026-08-28 found:
//
//   • Housecall Pro's plans are Basic / Essentials / Max, and their own page
//     ends with "All prices are in USD and are exclusive of sales tax." His
//     uncertainty about the currency was answerable and is now answered.
//   • Projul's three annual figures are exactly right — and the page never
//     names a currency at all. His guess ("i'm pressyre that's also a USD
//     figure") is a guess, so those figures carry CURRENCY_NOT_STATED and are
//     unpublishable until a human settles it.
//   • ServiceTitan's page contains zero dollar amounts and "Request Pricing"
//     three times. That is a deliberate withholding, not a hole in our notes.
//   • Jobber's page has TWO selectors, and every earlier read of it was wrong
//     because of that. See below.
//
// ══ Jobber, and why a figure needs coordinates ═════════════════════════════
//
// A bare fetch of Jobber's pricing page 403s, and two summariser reads of it
// on the same day disagreed with each other — Grow at $199 and at $156, Plus
// at $499 and at $490. Driving the real page in a browser explained it: the
// price depends on a team-size selector (Just me / 2-5 / 6-10 / 11-15 / 16+)
// AND a billing selector (Annual, or Monthly split into 1-year-commitment and
// no-commitment). A reader who ignores them reports one arbitrary combination
// as "the" price, and two such readers disagree. So this check refuses any
// figure that does not carry a value on every axis its competitor declares.
//
// Three things everyone believed turned out to be false, and each has an
// assertion below so the belief cannot come back:
//
//   1. Plus publishes no price. It does, at 2-5 and 6-10 — while its button
//      says "Contact Sales". Having a price and wanting a phone call are not
//      opposites, so `cta` is its own field and is never inferred from the
//      price kind.
//   2. "Recommended" lives on Grow. It moves: Connect at one user, Plus at
//      five and ten. A badge quoted without its team size is a false claim.
//   3. The AI receptionist is in Grow. It is not — a $29/mo add-on at one
//      user, and otherwise inside the $599/mo Plus tier. This is the single
//      most valuable fact on the page for us, and matching tiers by NAME
//      would have hidden it.
//
// ══ Why the conversion assertions are the load-bearing ones ════════════════
//
// An FX rate is right on the day you pick it and wrong the next, and a
// converted number baked into a static page is a claim about a competitor that
// silently rots. The module refuses to convert. The point of asserting it here
// is that the refusal survives the next person who thinks a currency helper is
// an obvious missing feature — they have to delete an assertion whose failure
// message explains why they are wrong.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-competitors.mjs

import { readFileSync } from "node:fs";
import {
  BILLING_MODES,
  CLAIM_ADVANTAGE,
  CLAIM_CONCESSION,
  COMPARABLE_FEATURES,
  COMPETITORS,
  CURRENCY_NOT_STATED,
  CURRENCY_UNKNOWN,
  FEATURE_ABSENT,
  FEATURE_ADD_ON,
  FEATURE_AVAILABILITY,
  FEATURE_INCLUDED,
  FEATURE_INCLUDED_USAGE_EXTRA,
  FEATURE_UNKNOWN,
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  FIELDQUO_REFERENCE,
  PRICE_AMOUNT,
  PRICE_FREE,
  PRICE_KINDS,
  PRICE_NOT_OFFERED,
  PRICE_ON_REQUEST,
  PRICE_REPORTED_RANGE,
  PRICE_UNKNOWN,
  PRICING_UNITS,
  FIELDQUO_PRICING_UNIT,
  Reported,
  SOURCED_OWNER_ASSERTED,
  SOURCED_OWNER_RELAYED,
  SOURCED_PUBLISHER,
  SOURCED_USER_REPORTS,
  SOURCING_TIERS,
  STALE_AFTER_DAYS,
  TEAM_SIZES,
  UNVERIFIED,
  VERIFIED,
  allAddOns,
  allFigures,
  allReportedCosts,
  allReportedTerms,
  claimPublishable,
  claims,
  comparableTier,
  competitor,
  figureAgeDays,
  isSignedAssertion,
  isStale,
  livePromo,
  provenanceLabel,
  publishableFigures,
  publishableReportedCosts,
  reportedCostText,
  reportedWithholdReason,
  withholdReason,
} from "@/lib/marketing/competitors";
import { SEAT_LADDER, SUPPORTED_CURRENCIES } from "@/lib/pricing/ladder";

let pass = 0;
const fails = [];
const warns = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const warn = (label) => warns.push(label);

const SOURCE = readFileSync("lib/marketing/competitors.js", "utf8");
const FIGURES = allFigures();
const ADD_ONS = allAddOns();
const OBSERVATIONS = [...FIGURES, ...ADD_ONS];
// A fixed clock. The module refuses to invent one (figureAgeDays throws
// without an asOf) and so does this script — a check whose result depends on
// the wall clock passes on Monday and fails on Tuesday for no reason anybody
// can reproduce. TODAY is the day the figures were gathered.
const TODAY = "2026-08-28";

// ══════════════════════════════════════════════════════════════════════════
console.log("\nEvery observation carries a source, a currency, a date and a vantage point");
// Rule one, and the reason it is structural rather than a lint: a price with
// no source is not a price, it is a rumour with a dollar sign. Add-ons are
// held to the same bar as plan figures — $29/mo is a claim about Jobber
// whether or not it sits in a plan table.
ok("there are figures to check at all", FIGURES.length > 0, FIGURES.length);
ok("...and add-ons too", ADD_ONS.length > 0, ADD_ONS.length);
for (const f of OBSERVATIONS) {
  ok(`${f.id} names a source URL`, typeof f.source === "string" && f.source.startsWith("https://"), f.source);
  ok(`${f.id} carries an ISO checked date`, /^\d{4}-\d{2}-\d{2}$/.test(f.checked || ""), f.checked);
  ok(`${f.id} parses as a real date`, Number.isFinite(Date.parse(`${f.checked}T00:00:00Z`)), f.checked);
  // The vantage point. A price read from a US egress is "what a US visitor is
  // shown", and for a Canadian vendor that is not the same as "their price".
  ok(`${f.id} records where it was observed from`, ["US", "CA"].includes(f.observedFrom), f.observedFrom);
  ok(`${f.id} declares a known price kind`, PRICE_KINDS.includes(f.price?.kind), f.price?.kind);
  if (f.price?.kind === PRICE_AMOUNT || f.price?.kind === PRICE_FREE) {
    ok(`${f.id} states a currency`, typeof f.price.currency === "string" && f.price.currency.length > 0, f.price.currency);
  }
  if (f.price?.kind === PRICE_AMOUNT) {
    ok(`${f.id} has a finite amount`, Number.isFinite(f.price.amount), f.price.amount);
    ok(`${f.id} says what the amount is per`, ["month", "year"].includes(f.price.per), f.price.per);
  }
  // PRICE_ON_REQUEST has to carry the words on the button. Without them the
  // entry is indistinguishable from someone typing "on request" because they
  // could not find a number.
  if (f.price?.kind === PRICE_ON_REQUEST) {
    ok(`${f.id} quotes the ask verbatim`, typeof f.price.ask === "string" && f.price.ask.length > 0, f.price.ask);
  }
}

// A source has to belong to the company it is a source for. Citing a review
// site or a blog for a competitor's own price is how a stale third-party
// number becomes our published claim about them.
console.log("\n...and the source is the competitor's own site");
for (const c of COMPETITORS) {
  const home = new URL(c.homepage).hostname.replace(/^www\./, "");
  for (const f of [...c.figures, ...(c.addOns || [])]) {
    const host = new URL(f.source).hostname.replace(/^www\./, "");
    ok(`${f.id} is sourced from ${home}`, host === home, host);
  }
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nEvery figure carries a coordinate on every axis its competitor declares");
// The Jobber lesson, made structural. A price without its selectors is not a
// price — it is one arbitrary combination, and that is precisely how two
// honest reads of the same page produced different numbers.
for (const c of COMPETITORS) {
  ok(`${c.id} declares its axes`, Array.isArray(c.axes), c.axes);
  const wanted = JSON.stringify([...c.axes].sort());
  // Plan figures must match the declared axes EXACTLY — no missing coordinate
  // and no extra one. Add-ons are allowed to be located more precisely than
  // the plan table requires, so they only have to cover the declared axes.
  //
  // The first version of this collapsed both cases into one ternary whose
  // condition was always true for plan figures, so the exact-match branch
  // never ran and the assertion passed by never testing anything. Two
  // explicit loops instead of one clever predicate.
  for (const f of c.figures) {
    const keys = Object.keys(f.axis || {}).sort();
    ok(`${f.id} carries exactly the declared axes`, JSON.stringify(keys) === wanted, keys);
  }
  for (const a of c.addOns || []) {
    const keys = Object.keys(a.axis || {});
    ok(`${a.id} covers the declared axes`, c.axes.every((ax) => keys.includes(ax)), keys);
  }
  for (const f of [...c.figures, ...(c.addOns || [])]) {
    if (f.axis?.teamSize !== undefined) {
      ok(`${f.id} names a real team size`, Object.hasOwn(TEAM_SIZES, f.axis.teamSize), f.axis.teamSize);
    }
    if (f.axis?.billing !== undefined) {
      ok(`${f.id} names a real billing mode`, Object.hasOwn(BILLING_MODES, f.axis.billing), f.axis.billing);
    }
  }
}
const jobber = competitor("jobber");
ok("Jobber declares both selectors as axes",
  JSON.stringify([...jobber.axes].sort()) === JSON.stringify(["billing", "teamSize"]), jobber.axes);
// The same plan name at two team sizes is two different prices. If the model
// could not hold that, it could not hold Jobber at all.
const grows = jobber.figures.filter((f) => f.label === "Grow" && f.price.kind === PRICE_AMOUNT);
ok("Grow exists at more than one team size", new Set(grows.map((f) => f.axis.teamSize)).size > 1);
ok("...at more than one price", new Set(grows.map((f) => f.price.amount)).size > 1,
  grows.map((f) => `${f.axis.teamSize}=${f.price.amount}`));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA figure marked verified names who looked, and how");
// The flag alone is worthless — anyone can set a string. Requiring a signature
// makes flipping it an act rather than a typo, and the METHOD is the part that
// mattered here: a summariser and a driven browser are not the same evidence,
// and the first Jobber entry in this file was built on the weaker one and was
// entirely wrong.
for (const f of OBSERVATIONS) {
  ok(`${f.id} has a known verification state`, [VERIFIED, UNVERIFIED].includes(f.verification), f.verification);
  if (f.verification === VERIFIED) {
    ok(`${f.id} says who verified it`, typeof f.verifiedBy === "string" && f.verifiedBy.length > 10, f.verifiedBy);
  }
}
ok("verified and unverified are different values", VERIFIED !== UNVERIFIED);
// Every Jobber figure that publishes must have been read in a browser, not
// summarised. This is the assertion that stops the old, wrong data returning.
for (const f of jobber.figures.filter((f) => withholdReason(f, TODAY) === null)) {
  ok(`${f.id} was read by driving the page's own selectors`, /drove the live page/.test(f.verifiedBy || ""), f.verifiedBy);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe four ways a price can be absent stay four different things");
// Failure class 5, in its most expensive form. "They charge nothing", "they
// won't tell you", "they don't sell it at this size" and "we never checked"
// render as four different sentences and only one of them is ServiceTitan.
ok("free ≠ on-request", PRICE_FREE !== PRICE_ON_REQUEST);
ok("on-request ≠ unknown", PRICE_ON_REQUEST !== PRICE_UNKNOWN);
ok("not-offered ≠ unknown", PRICE_NOT_OFFERED !== PRICE_UNKNOWN);
ok("not-offered ≠ on-request", PRICE_NOT_OFFERED !== PRICE_ON_REQUEST);
ok("free ≠ unknown", PRICE_FREE !== PRICE_UNKNOWN);
ok("all six kinds are distinct", new Set(PRICE_KINDS).size === PRICE_KINDS.length);
// The sixth, added with ServiceTitan's third-hand bands. It is not a price and
// must never be mistaken for one of the five that are.
ok("a reported band is its own kind", PRICE_REPORTED_RANGE !== PRICE_AMOUNT && PRICE_REPORTED_RANGE !== PRICE_ON_REQUEST);
ok("...and is not 'unknown' — somebody did establish something", PRICE_REPORTED_RANGE !== PRICE_UNKNOWN);

const stKinds = competitor("servicetitan").figures.map((f) => f.price.kind);
ok("ServiceTitan is on-request on every tier", stKinds.every((k) => k === PRICE_ON_REQUEST), stKinds);
ok("...and never unknown — withholding is a choice they made", !stKinds.includes(PRICE_UNKNOWN));
ok("...and never free", !stKinds.includes(PRICE_FREE));

// Jobber offers no Plus tier to a one-person shop. That is a fact about their
// product, not a gap in ours, and it is not a sales call either.
const plusSolo = jobber.figures.find((f) => f.id === "jobber.plus.solo.annual");
ok("Jobber's Plus at one user is NOT OFFERED", plusSolo.price.kind === PRICE_NOT_OFFERED, plusSolo.price.kind);
ok("...not 'on request' — nobody is being asked to call", plusSolo.price.kind !== PRICE_ON_REQUEST);
ok("...and not 'unknown' — we did look", plusSolo.price.kind !== PRICE_UNKNOWN);
// And the two selector positions nobody opened stay unknown.
for (const id of ["jobber.all.11-15", "jobber.all.16-plus"]) {
  const f = jobber.figures.find((x) => x.id === id);
  ok(`${id} is unknown, not extrapolated`, f.price.kind === PRICE_UNKNOWN && f.verification === UNVERIFIED);
}

// Executed, not read: the kinds produce different outcomes.
//
// A priced fixture declares its currency's provenance the way a real figure
// must. Merged in rather than demanded of every call site, so the assertions
// written before the three sourcing tiers existed still read as they did —
// but merged UNDER the caller's price, so a test that wants to say "no
// provenance recorded" can still say it by passing the field explicitly.
const synth = (price, extra = {}) => ({
  id: "synthetic",
  price: price?.currency ? { currencySourcing: SOURCED_PUBLISHER, ...price } : price,
  source: "https://example.com/pricing",
  checked: TODAY,
  observedFrom: "US",
  verification: VERIFIED,
  verifiedBy: "synthetic fixture inside check-competitors.mjs",
  ...extra,
});
ok("a genuinely free plan IS publishable",
  withholdReason(synth({ kind: PRICE_FREE, currency: "USD" }), TODAY) === null);
ok("an on-request tier is publishable as 'ask them'",
  withholdReason(synth({ kind: PRICE_ON_REQUEST, ask: "Request Pricing" }), TODAY) === null);
ok("a not-offered tier is publishable as 'they don't sell it'",
  withholdReason(synth({ kind: PRICE_NOT_OFFERED }), TODAY) === null);
ok("an unknown price is NOT publishable",
  withholdReason(synth({ kind: PRICE_UNKNOWN }), TODAY) === "price not established");
ok("a figure with no vantage point is NOT publishable",
  withholdReason({ ...synth({ kind: PRICE_FREE, currency: "USD" }), observedFrom: undefined }, TODAY) ===
    "no vantage point recorded");

// ══════════════════════════════════════════════════════════════════════════
console.log("\n'Read but not understood' is its own state, and it withholds");
// Jobber's annual rows show a regular /mo, a promotional /mo and a different
// 'then' rate. What $49 is relative to $29 was not established, and picking
// the reading that flatters the comparison is exactly the failure this file
// exists to prevent. So the reader records the open question and the figure
// does not publish — which is NOT the same as unverified, because somebody
// did look.
const unresolved = FIGURES.filter((f) => Array.isArray(f.unresolved) && f.unresolved.length > 0);
ok("some figures carry an open question", unresolved.length > 0, unresolved.length);
ok("...all of them are verified — this is not a synonym for unverified",
  unresolved.every((f) => f.verification === VERIFIED));
ok("...and every one is withheld, naming the question",
  unresolved.every((f) => (withholdReason(f, TODAY) || "").startsWith("unresolved: ")),
  unresolved.map((f) => withholdReason(f, TODAY)));
ok("...so no Jobber annual figure publishes a number",
  !publishableFigures(TODAY).some((f) => f.competitorId === "jobber" && f.axis.billing === "annual_prepaid" && f.price.kind === PRICE_AMOUNT));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nPromotions are recorded, dated, and never published");
// "Save up to 40%, Offer ends Aug 31" is live as this is written — three days
// out. /pricing is statically rendered and cannot notice a sale ending, so a
// promotional number printed there is true for three days and false after,
// about somebody else's prices, with nobody watching.
const promoted = FIGURES.filter((f) => f.promo);
ok("promotional figures exist to be tested", promoted.length > 0, promoted.length);
for (const f of promoted) {
  ok(`${f.id}'s promotion carries an end date`, /^\d{4}-\d{2}-\d{2}$/.test(f.promo.endsAt || ""), f.promo.endsAt);
  ok(`${f.id}'s promotion is cheaper than the regular price`, f.promo.amount < f.price.amount, f.promo);
  ok(`${f.id} keeps the regular price as the headline amount`, Number.isFinite(f.price.amount));
}
// The headline number a renderer sees is always the regular one.
ok("no publishable figure exposes a promotional amount as its price",
  publishableFigures(TODAY).every((f) => !f.promo || f.price.amount !== f.promo.amount));
// livePromo is a real function with two real outcomes, exercised in both.
const promoFig = promoted[0];
ok("livePromo returns the promotion while it is running", livePromo(promoFig, TODAY) !== null);
ok("...and null the day after it ends", livePromo(promoFig, "2026-09-01") === null);
ok("...and null when the end date is missing — never 'runs forever'",
  livePromo(synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: "USD" }, { promo: { amount: 5 } }), TODAY) === null);
ok("...and refuses to guess what day it is", (() => { try { livePromo(promoFig); return false; } catch { return true; } })());

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA price and a sales call are not opposites");
// Correction 1. The owner believed Plus published no price because its button
// says "Contact Sales". Both are true at once, and the model has to hold that
// or it will keep mis-recording tiers as on-request.
const contactSales = FIGURES.filter((f) => f.cta === "Contact Sales");
ok("a tier with a Contact Sales button exists", contactSales.length > 0, contactSales.length);
ok("...and it publishes a real amount",
  contactSales.every((f) => f.price.kind === PRICE_AMOUNT && Number.isFinite(f.price.amount)),
  contactSales.map((f) => f.price));
ok("...so cta is never inferred from the price kind",
  FIGURES.some((f) => f.price.kind === PRICE_ON_REQUEST) && contactSales.some((f) => f.price.kind === PRICE_AMOUNT));
// Housecall Pro has the same shape at its top tier: Book Demo, price shown.
ok("Housecall Pro's Max shows a price beside a Book Demo button",
  competitor("housecall_pro").figures.some((f) => f.cta === "Book Demo" && f.price.kind === PRICE_AMOUNT));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA 'Recommended' badge is meaningless without its team size");
// Correction 2. The owner believed Grow was the permanent "most popular". The
// badge is on Connect at one user and on Plus at five and ten. Quoting it
// without the size is a false claim about what Jobber recommends to whom.
const badged = jobber.figures.filter((f) => f.badge);
ok("Jobber has badged tiers", badged.length > 0, badged.length);
ok("...on more than one plan — the badge is not fixed",
  new Set(badged.map((f) => f.label)).size > 1, badged.map((f) => `${f.axis.teamSize}:${f.label}`));
ok("...and it is NOT on Grow, whatever anyone remembers",
  !badged.some((f) => f.label === "Grow"), badged.map((f) => f.label));
for (const f of badged) {
  ok(`${f.label}'s badge carries the team size it was seen at`, typeof f.axis.teamSize === "string", f.axis);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nTiers are compared on what they CONTAIN, not on what they are called");
// Correction 3, and the reason the whole feature vocabulary exists. Jobber's
// receptionist is a $29/mo add-on at one user and otherwise lives in Plus.
// Name-matching FieldQuo Scale against "Jobber Grow" compares us to $399 for a
// plan without it — understating our case by $200 while crediting Grow with a
// feature it does not have.
ok("the feature vocabulary has five states", new Set(FEATURE_AVAILABILITY).size === 5);
ok("...absent and unknown are different", FEATURE_ABSENT !== FEATURE_UNKNOWN);
ok("...and 'included' is different from 'included, usage billed separately'",
  FEATURE_INCLUDED !== FEATURE_INCLUDED_USAGE_EXTRA);
for (const f of FIGURES) {
  for (const [key, availability] of Object.entries(f.features || {})) {
    ok(`${f.id}.${key} is a known availability`, FEATURE_AVAILABILITY.includes(availability), availability);
    ok(`${f.id}.${key} is a comparable feature`, Object.hasOwn(COMPARABLE_FEATURES, key), key);
  }
}
const match = comparableTier("jobber", { feature: "ai_receptionist", teamSize: "6-10", billing: "monthly_none" }, TODAY);
ok("the comparable tier at ten users is found", match !== null);
ok("...and it is Plus, not Grow", match.label === "Plus", match?.label);
ok("...at $599, not $399", match.price.amount === 599, match?.price?.amount);
ok("...which is $200 more than the name-matched tier would have said",
  match.price.amount - jobber.figures.find((f) => f.id === "jobber.grow.6-10.monthly_none").price.amount === 200);
ok("Grow at ten users is recorded as NOT having the receptionist",
  jobber.figures.find((f) => f.id === "jobber.grow.6-10.monthly_none").features.ai_receptionist === FEATURE_ABSENT);
ok("at one user it is an add-on, not a tier feature",
  jobber.figures.find((f) => f.id === "jobber.core.solo.annual").features.ai_receptionist === FEATURE_ADD_ON);
const aiAddOn = ADD_ONS.find((a) => a.feature === "ai_receptionist");
ok("...and the add-on's own price is recorded", aiAddOn?.price?.amount === 29, aiAddOn?.price);
// A tier nobody inspected must never win by default.
ok("an unchecked tier is not treated as lacking the feature",
  comparableTier("jobber", { feature: "ai_receptionist", teamSize: "2-5", billing: "annual_prepaid" }, TODAY) === null);
ok("an unknown feature key returns null rather than a near-miss",
  comparableTier("jobber", { feature: "teleportation" }, TODAY) === null);

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA currency the source never stated is not the same as one nobody checked");
ok("not-stated ≠ unknown", CURRENCY_NOT_STATED !== CURRENCY_UNKNOWN);
const projul = competitor("projul");
ok("Projul's amounts are recorded", projul.figures.every((f) => Number.isFinite(f.price.amount)));
ok("a currency nobody checked is withheld",
  withholdReason(synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: CURRENCY_UNKNOWN }), TODAY) ===
    "currency never checked");
ok("a currency the source never stated is withheld for a DIFFERENT reason",
  withholdReason(synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: CURRENCY_NOT_STATED }), TODAY) ===
    "the source states no currency");

// ══════════════════════════════════════════════════════════════════════════
console.log("\nProjul: their amount, HIS currency, and the page says which is which");
// ══ An assertion this file used to make, and no longer does ════════════════
//
// It read: "...and none of them silently became USD". All three Projul figures
// were withheld with "the source states no currency", their page's own finding,
// and the check enforced that they could never carry a currency code.
//
// The owner has now twice stated they are USD, reasoning that Projul is a US
// company. That is not a reading of their page — their page still names no
// currency, and re-reading it would still find none — but it is a business
// judgement he is entitled to make, and an empty price column serves nobody.
//
// The word doing the work in the old assertion was SILENTLY. What is banned is
// a currency appearing with no account of where it came from. That ban is
// intact and is now stronger, because it applies to every competitor rather
// than to Projul specifically: withholdReason refuses any priced figure whose
// `currencySourcing` is missing, and refuses an owner-asserted one whose
// assertion is not signed with a who, a date and grounds.
const projulPrices = projul.figures.map((f) => f.price);
ok("Projul's figures now carry a currency", projulPrices.every((p) => p.currency === "USD"),
  projulPrices.map((p) => p.currency));
ok("...marked as the owner's assertion, not as a page reading",
  projulPrices.every((p) => p.currencySourcing === SOURCED_OWNER_ASSERTED),
  projulPrices.map((p) => p.currencySourcing));
ok("...which is a DIFFERENT value from a publisher-stated currency",
  SOURCED_OWNER_ASSERTED !== SOURCED_PUBLISHER);
ok("...and Housecall Pro's USD, which their own footer states, is the other one",
  competitor("housecall_pro").figures.every((f) => f.price.currencySourcing === SOURCED_PUBLISHER));
ok("...so the two are distinguishable from the data alone, with no note to read",
  new Set([...projul.figures, ...competitor("housecall_pro").figures].map((f) => f.price.currencySourcing)).size === 2);
// The assertion is signed. A tier anyone can type is not evidence — same
// argument as `verifiedBy` beside VERIFIED.
for (const p of projulPrices) {
  ok(`Projul's currency assertion names who, when and why`, isSignedAssertion(p.assertedBy), p.assertedBy);
  ok(`...and the grounds are a reason a reader can weigh`, /US company/.test(p.assertedBy.grounds), p.assertedBy.grounds);
}
ok("...they all point at ONE assertion object, so retracting it is one edit",
  new Set(projulPrices.map((p) => p.assertedBy)).size === 1);
// And it publishes — which is the change. An empty column was the old
// behaviour and it was not more honest, it was just quieter.
ok("...so all three Projul figures now publish",
  projul.figures.every((f) => withholdReason(f, TODAY) === null),
  projul.figures.map((f) => withholdReason(f, TODAY)));
// The renderer is handed the sentence, not left to write one.
for (const f of projul.figures) {
  const label = provenanceLabel({ ...f, sourcing: f.price.currencySourcing, assertedBy: f.price.assertedBy });
  ok(`${f.id}'s currency provenance renders as words`, /asserted by .+ on \d{4}-\d{2}-\d{2}/.test(label), label);
  ok(`...and says plainly it is not on their page`, /not stated on their page/.test(label), label);
}

// ══ The ban that replaced the old one, tested where it bites ═══════════════
//
// The real failure mode was never "Projul's figures say USD". It was a
// currency code appearing with nothing behind it. These four exercise that
// directly, on synthetic figures, because no real figure can reach them.
ok("a priced figure with NO currency provenance is withheld",
  withholdReason(
    synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: "USD", currencySourcing: undefined }), TODAY) ===
    "currency provenance not recorded");
ok("...and absence is NOT read as 'the publisher said so'",
  withholdReason(
    synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: "USD", currencySourcing: undefined }), TODAY) !== null);
ok("an owner-asserted currency with no signed assertion is withheld",
  withholdReason(
    synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: "USD", currencySourcing: SOURCED_OWNER_ASSERTED }), TODAY) ===
    "currency asserted with no signed assertion on record");
ok("...and a half-signed one too — grounds are not optional",
  withholdReason(
    synth({
      kind: PRICE_AMOUNT, amount: 10, per: "month", currency: "USD",
      currencySourcing: SOURCED_OWNER_ASSERTED,
      assertedBy: { who: "somebody", on: "2026-08-29" },
    }), TODAY) === "currency asserted with no signed assertion on record");
ok("a made-up sourcing tier is withheld, not trusted",
  /is not a known sourcing tier/.test(
    withholdReason(
      synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: "USD", currencySourcing: "probably" }), TODAY) || ""));
ok("a third-hand currency never publishes as a price",
  withholdReason(
    synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: "USD", currencySourcing: SOURCED_USER_REPORTS }), TODAY) ===
    "currency is third-hand, not published");
// isSignedAssertion is the gate; exercise it directly on each missing field.
ok("an assertion with no author is not signed", !isSignedAssertion({ on: "2026-08-29", grounds: "a long enough reason here" }));
ok("an assertion with no date is not signed", !isSignedAssertion({ who: "someone", grounds: "a long enough reason here" }));
ok("an assertion with no grounds is not signed", !isSignedAssertion({ who: "someone", on: "2026-08-29" }));
ok("an assertion with a bad date is not signed", !isSignedAssertion({ who: "someone", on: "last Tuesday", grounds: "a long enough reason here" }));
ok("a complete assertion IS signed", isSignedAssertion({ who: "someone", on: "2026-08-29", grounds: "a long enough reason here" }));

const hcp = competitor("housecall_pro");
ok("Housecall Pro is recorded as USD", hcp.figures.every((f) => f.price.currency === "USD"));
ok("...and every Housecall Pro figure is publishable",
  hcp.figures.every((f) => withholdReason(f, TODAY) === null),
  hcp.figures.map((f) => withholdReason(f, TODAY)));

// The geography limit is recorded, not papered over.
ok("Jobber carries a geographic caveat",
  typeof jobber.geoCaveat === "string" && /CAD/.test(jobber.geoCaveat), jobber.geoCaveat);
ok("...and every Jobber observation says it was read from the US",
  [...jobber.figures, ...jobber.addOns].every((f) => f.observedFrom === "US"));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nUnverified figures are identifiable, and never reach the page");
const notVerified = FIGURES.filter((f) => f.verification !== VERIFIED);
ok("there is at least one unverified figure to catch", notVerified.length > 0, notVerified.length);
ok("...every one is withheld, and says why",
  notVerified.every((f) => withholdReason(f, TODAY) === "not verified against the source"),
  notVerified.map((f) => withholdReason(f, TODAY)));
const publishable = publishableFigures(TODAY);
ok("...and none of them are in publishableFigures",
  !publishable.some((f) => f.verification !== VERIFIED));
ok("something IS publishable — this check must not pass by publishing nothing",
  publishable.length > 0, publishable.length);
// The rows the useful comparison needs must actually publish, or the whole
// exercise produced a page with nothing on it.
for (const id of ["jobber.grow.6-10.monthly_none", "jobber.plus.6-10.monthly_none"]) {
  ok(`${id} publishes`, publishable.some((f) => f.id === id), withholdReason(FIGURES.find((f) => f.id === id), TODAY));
}
// Every publishable price is in a currency FieldQuo actually has a row in.
// Without this the page could put a EUR figure next to a CAD one and let the
// reader do the conversion we refused to do.
ok("every publishable amount is in a currency FieldQuo also prices in",
  publishable
    .filter((f) => f.price.kind === PRICE_AMOUNT || f.price.kind === PRICE_FREE)
    .every((f) => SUPPORTED_CURRENCIES.includes(f.price.currency)));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe DATA never converts, and the rate cannot even be stored here");
// ══ What changed, and what did not ═════════════════════════════════════════
//
// This section used to be titled "No currency conversion exists, and adding
// one fails this check", and the ban was total: no conversion anywhere, ever.
// It has been NARROWED, and the narrowing is the point of every assertion
// below staying exactly as it was.
//
// A converted number STORED in this module is still banned, for the original
// reason, unchanged: it would be right the day it shipped, drifting every day
// after, on a statically rendered page, about somebody else's prices, with
// nobody watching. Every assertion in this block enforces that and none of
// them has been weakened.
//
// What is now allowed is conversion at PRESENTATION time, in
// lib/marketing/fx.js, where the rate travels with its date and its source and
// refuses when stale. Two new assertions at the end of this block are what
// keep the two apart: this module must not import fx.js, and — because a rate
// is a decimal and no decimal may appear here — the rate physically cannot be
// stored in this file even by somebody trying.
// Identifiers first — but over the CODE only. The file's own comments argue at
// length about conversion, and a regex over raw text would either match those
// or be weakened until it matched nothing. Stripping comments and strings
// properly is the difference between an assertion and a decoration.
//
// Matched as SUBSTRINGS of the lowercased code, deliberately, and this is not
// a style choice. The first version of this assertion anchored each stem with
// \b and mutation testing walked straight through it: `convertToCad` has no
// word boundary after "convert" or before "toCad", so a regex that looks
// rigorous matched nothing at all and the check passed while exporting a
// conversion helper. camelCase has no word boundaries in the middle.
//
// "cad" and "usd" are in the list as bare stems, which looks aggressive until
// you try to defeat the rest of it: `cadEquivalent(amount)` — the owner's own
// phrase, "the CAD equivalent" — contains no "convert", no "toCad", and needs
// no decimal literal if you multiply by 137 and divide by 100. Banning the
// currency codes from IDENTIFIERS closes that whole family at once, and states
// the real rule: in this module a currency is DATA, never something code is
// named after. Strings and comments are already stripped, so the codes are
// free to appear in the figures themselves, which is where they belong.
const code = stripCommentsAndStrings(SOURCE).toLowerCase();
const BANNED_STEMS = [
  "convert", "conversion", "exchange", "forex", "fxrate",
  "tocad", "tousd", "cadto", "usdto", "incad", "inusd",
  "currencyrate", "ratecad", "rateusd", "exchangerate",
  "cad", "usd", "equivalent",
];
const hitsIn = (text) => BANNED_STEMS.filter((s) => text.toLowerCase().includes(s));
ok("no conversion identifier in the module's code", hitsIn(code).length === 0, hitsIn(code));
const exportedNames = Object.keys(await import("@/lib/marketing/competitors"));
ok("...and none of it is exported either",
  exportedNames.every((k) => hitsIn(k).length === 0),
  exportedNames.filter((k) => hitsIn(k).length > 0));
// Proof the detector is alive rather than matching nothing by construction —
// the exact identifier that defeated the previous version of this assertion.
ok("...and the detector actually fires on `convertToCad`", hitsIn("export function convertToCad").length > 0);

// ══ The decimal rule, narrowed exactly as far as QuoteIQ forced it ═════════
//
// An FX rate is a decimal, so this file used to permit no decimal literal at
// all: prices were whole units, ages whole days, and a literal like 1.37
// appearing here was an exchange rate wearing a hat.
//
// QuoteIQ prices in cents — $29.99, $74.99, $62.50 — and those are published
// figures read off their own page. Refusing to store them would have meant
// rounding a competitor's price, which is inventing a number about somebody
// else, or holding it in some minor-unit field that every consumer then has to
// know about. Both are worse than narrowing the rule.
//
// So the rule is now POSITIONAL, and it is still structural: a decimal may
// appear ONLY as the value of `amount:`, and only with exactly two decimal
// places, which is what cents are. `const rate = 1.39` fails because it is not
// an amount. `amount: 1.3888` fails because four places are not cents. There
// is nowhere in this file a rate can be written down.
const decimals = [...code.matchAll(/\d+\.\d+/g)];
const strayDecimals = decimals
  .filter((m) => !(/amount:\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index)) && /^\d+\.\d{2}$/.test(m[0])))
  .map((m) => m[0]);
ok("the only decimals in the code are cents on a published amount", strayDecimals.length === 0, strayDecimals);
ok("...and there are some, so the rule was tested against real data",
  decimals.length > 0, decimals.length);
// The detector, on the two shapes it exists to catch.
const decimalStrays = (src) =>
  [...src.matchAll(/\d+\.\d+/g)]
    .filter((m) => !(/amount:\s*$/.test(src.slice(Math.max(0, m.index - 12), m.index)) && /^\d+\.\d{2}$/.test(m[0])))
    .map((m) => m[0]);
ok("...a bare rate constant would be caught", decimalStrays("const dailyRate = 1.3888;").length === 1);
ok("...and a rate hidden in an amount would be caught too", decimalStrays("amount: 1.3888,").length === 1);
ok("...while cents on an amount pass", decimalStrays("amount: 29.99,").length === 0);

// Every amount is a bare integer literal, never an expression.
//
// The last hole mutation testing found: `amount: Math.round(59 * 137 / 100)`
// converts a price with integer arithmetic, so it trips neither the stem list
// nor the decimal rule, and produces a plausible number in a real currency
// that sails through every other assertion. An amount here is a number
// somebody READ OFF A PAGE. If it is being computed, it is not that.
//
// `low` and `high` are held to the same bar. ServiceTitan's reported bands
// arrived with these, and a band is exactly where the temptation to compute
// lives — `high: low * 1.2` would be an invented upper end of a range nobody
// reported. Same rule, same reason: if it is being computed, it is not
// something somebody said.
const amounts = [...code.matchAll(/(?:amount|low|high|thenAmount):\s*([^,\n}]+)/g)].map((m) => m[1].trim());
const literal = (a) => /^\d+$/.test(a) || /^\d+\.\d{2}$/.test(a);
ok("every amount and band endpoint is a literal, not an expression",
  amounts.length > 0 && amounts.every(literal), amounts.filter((a) => !literal(a)));
ok("...and there are band endpoints among them to have tested",
  [...code.matchAll(/low:\s*\d+/g)].length >= 3, [...code.matchAll(/low:\s*\d+/g)].length);

// ── The boundary between this module and the FX helper ────────────────────
//
// One-way dependency, asserted rather than assumed. fx.js imports this file to
// find out what a competitor published; if this file could import fx.js, a
// figure here could arrive already converted and every assertion above it
// would be looking at the wrong number.
// Matched against IMPORT SYNTAX rather than the text "marketing/fx", because
// the module's own comments discuss fx.js at length and a substring test would
// either match those or get weakened until it matched nothing — the same trap
// the \b-anchored stem regex fell into. Module specifiers are strings, so they
// are gone from `code`; the shape has to be found in SOURCE.
const IMPORTS_FX = [
  /^\s*import[^;]*from\s+["'][^"']*marketing\/fx/m,
  /^\s*import\s+["'][^"']*marketing\/fx/m,
  /\bimport\s*\(\s*["'][^"']*marketing\/fx/,
  /\brequire\s*\(\s*["'][^"']*marketing\/fx/,
];
ok("this module does not import the FX helper", IMPORTS_FX.every((re) => !re.test(SOURCE)));
// And the detector is alive, on all four shapes it has to catch.
ok("...and the import detector actually fires",
  IMPORTS_FX[0].test('import { x } from "@/lib/marketing/fx";') &&
    IMPORTS_FX[1].test('import "@/lib/marketing/fx";') &&
    IMPORTS_FX[2].test('const x = await import("@/lib/marketing/fx");') &&
    IMPORTS_FX[3].test('const x = require("@/lib/marketing/fx");'));
ok("...and holds no rate-shaped decimal, so a rate cannot be stored here at all",
  strayDecimals.length === 0, strayDecimals);
ok("a conversion helper would be caught by the stem rule", hitsIn("function toCadFromUsd").length > 0);

// And functionally: nothing the module can produce names a currency that is
// not already written down in it. Identifier bans stop the obvious version;
// this stops the clever one.
const declared = new Set(SUPPORTED_CURRENCIES);
for (const f of OBSERVATIONS) if (f.price?.currency) declared.add(f.price.currency);
const produced = new Set();
for (const f of publishableFigures(TODAY)) if (f.price?.currency) produced.add(f.price.currency);
for (const f of [...allFigures(), ...allAddOns()]) if (f.price?.currency) produced.add(f.price.currency);
for (const c of COMPETITORS) claims(c.id);
for (const cur of FIELDQUO_REFERENCE.currencies) produced.add(cur);
ok("the public surface produces no currency the data does not contain",
  [...produced].every((c) => declared.has(c)), [...produced].filter((c) => !declared.has(c)));

// The data cannot be edited on the way to the screen either. A shallow freeze
// would leave `figure.price.currency = "CAD"` working, which is the conversion
// happening one layer up with no comment to explain it.
const target = COMPETITORS[0].figures[0].price;
const before = target.currency;
try { target.currency = "CAD"; } catch { /* strict mode throws; either is fine */ }
ok("a figure's currency cannot be reassigned in place", target.currency === before, target.currency);

// ══════════════════════════════════════════════════════════════════════════
console.log("\nStaleness is visible, and the clock is never invented");
// The module refusing to default `asOf` is the point. A default of new Date()
// makes freshness depend on when the module happened to be imported — build
// time on Vercel, not read time in a driveway.
let threw = false;
try { figureAgeDays(FIGURES[0]); } catch { threw = true; }
ok("figureAgeDays refuses to guess what day it is", threw);
ok("age is measured in whole days", figureAgeDays({ checked: "2026-08-01" }, TODAY) === 27,
  figureAgeDays({ checked: "2026-08-01" }, TODAY));
ok("an unparseable date reads as stale, not as fresh", isStale({ checked: "whenever" }, TODAY) === true);
ok("a figure checked today is fresh", isStale({ checked: TODAY }, TODAY) === false);
ok(`the threshold is a justified ${STALE_AFTER_DAYS} days, not zero`, STALE_AFTER_DAYS >= 30 && STALE_AFTER_DAYS <= 180, STALE_AFTER_DAYS);
// Exercise the withholding path with a synthetic old figure, because every
// real figure was gathered today and would never reach it. An untested branch
// in a gate is a gate that appears to work.
const old = { ...synth({ kind: PRICE_AMOUNT, amount: 59, per: "month", currency: "USD" }), checked: "2025-01-01" };
ok("a figure past the threshold is withheld with its age",
  /^last checked \d+ days ago$/.test(withholdReason(old, TODAY) || ""), withholdReason(old, TODAY));

// The warning half. Non-failing on purpose: a build that goes red on a
// calendar boundary gets bypassed rather than fixed, and withholdReason is
// what actually keeps a stale price off the page. Jobber's promotion gets its
// own warning, because it expires far sooner than any figure goes stale.
for (const f of OBSERVATIONS) {
  const age = figureAgeDays(f, TODAY);
  if (age === null || age > STALE_AFTER_DAYS) warn(`${f.id} last checked ${f.checked} (${age} days) — re-read ${f.source}`);
}
for (const f of promoted) {
  if (livePromo(f, TODAY) === null) warn(`${f.id} carries a promotion that ended ${f.promo.endsAt} — delete it or re-read the page`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe module never claims FieldQuo has something it does not");
// A comparison listing only our wins is an advertisement. A visitor who buys
// on it, drives to a job and finds there is no app to open is a refund.
ok("the ledger knows FieldQuo has no mobile app", FIELDQUO_CAPABILITIES.mobile_app.has === false);
ok("...and does not work offline", FIELDQUO_CAPABILITIES.offline_use.has === false);
ok("...and has no demo a prospect can book", FIELDQUO_CAPABILITIES.self_serve_demo.has === false);
ok("FIELDQUO_LACKS is derived from the ledger, not listed twice",
  FIELDQUO_LACKS.every((k) => FIELDQUO_CAPABILITIES[k].has === false) &&
    Object.keys(FIELDQUO_CAPABILITIES).filter((k) => !FIELDQUO_CAPABILITIES[k].has).length === FIELDQUO_LACKS.length);
ok("every capability says how it was established",
  Object.values(FIELDQUO_CAPABILITIES).every((c) => typeof c.evidence === "string" && c.evidence.length > 20));

// The subtlest overclaim available on this page, and the one that was offered.
// "FieldQuo Scale is $369 with AI included" reads well and is FALSE: the
// receptionist feature is on every plan, the talk time is prepaid credit
// (lib/voice/credits.js). A visitor who buys on "included" and hits a top-up
// on their first call is a refund, exactly like the missing mobile app.
ok("FieldQuo's receptionist is NOT recorded as simply 'included'",
  COMPARABLE_FEATURES.ai_receptionist.fieldquo !== FEATURE_INCLUDED,
  COMPARABLE_FEATURES.ai_receptionist.fieldquo);
ok("...it is 'included, usage billed separately'",
  COMPARABLE_FEATURES.ai_receptionist.fieldquo === FEATURE_INCLUDED_USAGE_EXTRA);
// The ledger entry has to make the NARROW claim. "no monthly minimum" is true
// and is the stronger point anyway; "included" would be the false one.
ok("...and the ledger claim is scoped to the monthly floor",
  /no monthly minimum/i.test(FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor.label),
  FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor.label);
ok("...and never says our AI is simply 'included'",
  !/\bincluded\b/i.test(FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor.label),
  FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor.label);
ok("...and its evidence points at the prepaid-credit module",
  /credits\.js/.test(FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor.evidence));

// One vocabulary in both directions is what makes this checkable at all. A
// free-text claim reading "FieldQuo has a mobile app" would sail past any
// structural check; a claim that must name a ledger key cannot.
for (const c of COMPETITORS) {
  const resolved = claims(c.id);
  for (const entry of [...resolved.theyHaveWeDont, ...resolved.weHaveTheyDont]) {
    ok(`${c.id}: "${entry.claim.slice(0, 44)}" names a real capability`,
      Object.hasOwn(FIELDQUO_CAPABILITIES, entry.capability), entry.capability);
  }
  for (const entry of resolved.weHaveTheyDont) {
    ok(`${c.id}: we only claim to beat them on things we HAVE (${entry.capability})`,
      entry.fieldquoHas === true && entry.consistent === true, entry);
  }
  for (const entry of resolved.theyHaveWeDont) {
    ok(`${c.id}: we only concede things we genuinely LACK (${entry.capability})`,
      entry.fieldquoHas === false && entry.consistent === true, entry);
  }
}

// The comparison must run in both directions somewhere, or it is a brochure.
const conceded = COMPETITORS.flatMap((c) => c.theyHaveWeDont);
ok("at least one competitor advantage is conceded", conceded.length > 0, conceded.length);
ok("...including Housecall Pro's mobile app, the clearest one",
  hcp.theyHaveWeDont.some((e) => e.capability === "mobile_app"));
ok("...and the competitor we know most about concedes something too",
  jobber.theyHaveWeDont.length > 0, jobber.theyHaveWeDont.length);
// A concession is a claim about them too, so it is sourced like any figure —
// and an unverified one is marked unpublishable rather than quietly shown.
for (const c of COMPETITORS) {
  const resolved = claims(c.id);
  for (const e of [...resolved.theyHaveWeDont, ...resolved.weHaveTheyDont]) {
    ok(`claim "${e.claim.slice(0, 36)}" is sourced and dated`,
      typeof e.source === "string" && e.source.startsWith("https://") && /^\d{4}-\d{2}-\d{2}$/.test(e.checked || ""), e);
    ok(`claim "${e.claim.slice(0, 36)}" names a sourcing tier`, SOURCING_TIERS.includes(e.sourcing), e.sourcing);
    ok(`claim "${e.claim.slice(0, 36)}" renders its provenance in words`,
      typeof e.provenance === "string" && e.provenance.length > 10 && e.provenance !== "provenance not recorded",
      e.provenance);
    ok(`claim "${e.claim.slice(0, 36)}" signs its VERIFIED flag`,
      e.verification !== VERIFIED || (typeof e.verifiedBy === "string" && e.verifiedBy.length > 10), e);
  }
  // ══ An assertion that used to read `publishable === (verification === VERIFIED)`
  //
  // It was one rule for both directions, and it broke on the owner's Projul
  // feature lists. Those name five things we do not have — a mobile app,
  // QuickBooks, Gantt charts, purchase orders, daily logs — and nobody re-read
  // Projul's page for them, so under the old rule none of them published and
  // the page quietly conceded only the cheap one.
  //
  // The bar is now asymmetric, because the RISK is:
  //
  //   a wrong CONCESSION harms only FieldQuo — we understate ourselves and
  //   lose a sale. The owner's signed assertion is enough.
  //
  //   a wrong CLAIM OF ADVANTAGE is a false public statement about somebody
  //   else's product. Only their own page will do.
  //
  // Both halves are asserted, and the second is the one that must never slip.
  for (const e of resolved.weHaveTheyDont) {
    ok(`advantage "${e.claim.slice(0, 36)}" publishes ONLY on their own page`,
      e.publishable === (e.verification === VERIFIED), e);
  }
  for (const e of resolved.theyHaveWeDont) {
    const signed =
      (e.sourcing === SOURCED_OWNER_ASSERTED && isSignedAssertion(e.assertedBy)) ||
      (e.sourcing === SOURCED_OWNER_RELAYED && isSignedAssertion(e.relayedBy));
    ok(`concession "${e.claim.slice(0, 36)}" publishes on a page read, a signed relay or a signed assertion`,
      e.publishable === (e.verification === VERIFIED || signed), e);
  }
}

// ══ Executed on the RULE, not only on the data that exists today ═══════════
//
// Mutation testing found this assertion toothless in its first form. Relaxing
// the advantage bar to accept an owner assertion changed nothing anybody could
// observe, because every advantage claim in the file today happens to be
// publisher-sourced — so the check passed while the rule was gone. A rule that
// only bites on data that does not exist yet is a rule nothing tests.
//
// `claimPublishable` was pulled out of claims() for exactly this, and it is
// driven here with the SAME entry pointed in both directions, which is the
// only way to see the asymmetry at all.
{
  const signedEntry = {
    capability: "mobile_app",
    claim: "synthetic",
    sourcing: SOURCED_OWNER_ASSERTED,
    assertedBy: { who: "the owner", on: "2026-08-29", grounds: "a reason long enough to count" },
    source: "https://example.com/pricing",
    checked: TODAY,
    verification: UNVERIFIED,
  };
  ok("one signed assertion, pointed as a concession, publishes",
    claimPublishable(signedEntry, CLAIM_CONCESSION) === true);
  ok("...and the SAME entry, pointed as an advantage, does NOT",
    claimPublishable(signedEntry, CLAIM_ADVANTAGE) === false);
  ok("...which is the whole asymmetry, in one entry",
    claimPublishable(signedEntry, CLAIM_CONCESSION) !== claimPublishable(signedEntry, CLAIM_ADVANTAGE));
  const verifiedEntry = { ...signedEntry, verification: VERIFIED, sourcing: SOURCED_PUBLISHER, assertedBy: undefined };
  ok("a page-read claim publishes in both directions",
    claimPublishable(verifiedEntry, CLAIM_CONCESSION) && claimPublishable(verifiedEntry, CLAIM_ADVANTAGE));
  ok("an UNSIGNED assertion publishes in neither",
    !claimPublishable({ ...signedEntry, assertedBy: { who: "x" } }, CLAIM_CONCESSION) &&
      !claimPublishable({ ...signedEntry, assertedBy: { who: "x" } }, CLAIM_ADVANTAGE));
  ok("a third-hand claim publishes in neither",
    !claimPublishable({ ...signedEntry, sourcing: SOURCED_USER_REPORTS }, CLAIM_CONCESSION) &&
      !claimPublishable({ ...signedEntry, sourcing: SOURCED_USER_REPORTS }, CLAIM_ADVANTAGE));
  ok("a claim with nothing behind it publishes in neither",
    !claimPublishable({}, CLAIM_CONCESSION) && !claimPublishable({}, CLAIM_ADVANTAGE));
  ok("nothing at all publishes in neither",
    !claimPublishable(null, CLAIM_CONCESSION) && !claimPublishable(null, CLAIM_ADVANTAGE));
  ok("an unrecognised direction is treated as the STRICT one",
    claimPublishable(signedEntry, "sideways") === false);
  ok("the two directions are distinct values", CLAIM_CONCESSION !== CLAIM_ADVANTAGE);
  const projulClaims = claims("projul");
  const asserted = projulClaims.theyHaveWeDont.filter((e) => e.sourcing === SOURCED_OWNER_RELAYED);
  ok("Projul's owner-relayed concessions exist", asserted.length >= 5, asserted.length);
  ok("...and every one of them publishes", asserted.every((e) => e.publishable === true));
  ok("...while none of them claims to be verified",
    asserted.every((e) => e.verification === UNVERIFIED), asserted.map((e) => e.verification));
  ok("...and each carries a provenance saying it was relayed, not read by us",
    asserted.every((e) => /relayed from their page by/.test(e.provenance) && /not read by us/.test(e.provenance)));
  ok("no advantage anywhere rests on an assertion",
    COMPETITORS.every((c) => claims(c.id).weHaveTheyDont.every((e) => e.verification === VERIFIED || e.publishable === false)));
  ok("an unsigned assertion does NOT publish, even as a concession",
    provenanceLabel({ sourcing: SOURCED_OWNER_ASSERTED, assertedBy: { who: "x" } }) ===
      "asserted with no assertion on record");
  ok("...and the signed fixture would", isSignedAssertion(signedEntry.assertedBy));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe inconvenient half of Projul's feature lists reaches the page");
// The owner supplied Projul's tiers feature by feature. Five of those features
// are things FieldQuo does not have, and the failure mode on a comparison page
// is not getting them wrong — it is leaving them out. Each is asserted against
// the capability ledger, which carries evidence read out of this repository.
for (const key of ["mobile_app", "accounting_sync", "gantt_charts", "purchase_orders", "daily_logs", "geofencing"]) {
  ok(`the ledger records that FieldQuo has no ${key}`, FIELDQUO_CAPABILITIES[key]?.has === false, FIELDQUO_CAPABILITIES[key]);
  ok(`...with evidence from this repo, not an opinion`,
    /schema\.prisma|node_modules|repo|identifier|INTEGRATIONS|occurrence|No /.test(FIELDQUO_CAPABILITIES[key].evidence),
    FIELDQUO_CAPABILITIES[key].evidence);
  ok(`...and ${key} is in FIELDQUO_LACKS`, FIELDQUO_LACKS.includes(key));
  ok(`...and Projul's page concedes it`,
    claims("projul").theyHaveWeDont.some((e) => e.capability === key && e.publishable === true), key);
}
// The lists themselves are recorded, in Projul's words, and marked as his.
const projulTiers = competitor("projul").figures;
ok("Projul's entry tier carries its own feature list",
  Array.isArray(projulTiers[0].includedFeatures) && projulTiers[0].includedFeatures.length >= 15,
  projulTiers[0].includedFeatures?.length);
ok("...and the upper tiers record what they ADD, not a flattened list",
  projulTiers.slice(1).every((f) => Array.isArray(f.addsOverPreviousTier) && f.addsOverPreviousTier.length > 0));
ok("...so a tier's advantage over the one below it survives in the data",
  projulTiers[2].addsOverPreviousTier.some((s) => /purchase orders/i.test(s)) &&
    projulTiers[1].addsOverPreviousTier.some((s) => /Gantt/i.test(s)));
ok("...and every list says it came from the owner, not from a page read",
  projulTiers.every((f) => f.featuresSourcing === SOURCED_OWNER_RELAYED && isSignedAssertion(f.featuresRelayedBy)));
ok("...pointing at one relay record, so retracting it is one edit",
  new Set(projulTiers.map((f) => f.featuresRelayedBy)).size === 1);
// The features are not silently mapped onto our own vocabulary. Renaming a
// competitor's feature into ours is how a comparison becomes a straw man.
ok("Projul's features stay in Projul's words",
  projulTiers[0].includedFeatures.includes("full-featured mobile app"));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nFieldQuo's own side is imported from the ladder, not typed in beside it");
// Failure class 4. A comparison table carrying its own copy of our prices is
// the copy that rots, because it is the one nobody looks at when the ladder
// moves.
ok("FIELDQUO_REFERENCE.ladder IS SEAT_LADDER, the same array",
  FIELDQUO_REFERENCE.ladder === SEAT_LADDER);
ok("...and the currencies are the pricing module's list",
  FIELDQUO_REFERENCE.currencies === SUPPORTED_CURRENCIES);
ok("the module imports them rather than restating them",
  /import \{[^}]*SEAT_LADDER[^}]*\} from "@\/lib\/pricing\/ladder"/.test(SOURCE));
// The fact that removes the need for a conversion in the first place.
ok("the same-number-in-both-currencies fact is recorded",
  FIELDQUO_REFERENCE.sameNumberBothCurrencies === true);
ok("...and it is true of the ladder as shipped — one price list, two currencies",
  SUPPORTED_CURRENCIES.length === 2 && SEAT_LADDER.every((t) => Number.isFinite(t.price)));
ok("the entry tier is the cheapest rung, not a hand-picked one",
  FIELDQUO_REFERENCE.entryTier.price === Math.min(...SEAT_LADDER.map((t) => t.price)),
  FIELDQUO_REFERENCE.entryTier);
// The comparison the coordinator asked for, computed rather than asserted, so
// it moves when either side's price moves.
const scale = SEAT_LADDER.find((t) => t.tierKey === "scale");
ok("FieldQuo's top rung is cheaper than Jobber's receptionist tier at ten users",
  scale.price < match.price.amount, { fieldquo: scale.price, jobber: match.price.amount });

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThree sourcing tiers, and no two of them collapse");
// The reason this module grew a third axis. `verification` says whether anyone
// checked; `sourcing` says against WHAT. There was only ever one kind of
// source — the vendor's own page — until an owner assertion and a forum thread
// turned up on the same afternoon, and a reader is owed the difference.
ok("there are exactly four tiers", SOURCING_TIERS.length === 4, SOURCING_TIERS);
ok("...and they are distinct values", new Set(SOURCING_TIERS).size === 4);
ok("...ordered strongest first, which is what the gates cut against",
  SOURCING_TIERS[0] === SOURCED_PUBLISHER && SOURCING_TIERS[SOURCING_TIERS.length - 1] === SOURCED_USER_REPORTS);
for (const [a, b] of [
  [SOURCED_PUBLISHER, SOURCED_OWNER_RELAYED],
  [SOURCED_PUBLISHER, SOURCED_OWNER_ASSERTED],
  [SOURCED_PUBLISHER, SOURCED_USER_REPORTS],
  [SOURCED_OWNER_RELAYED, SOURCED_OWNER_ASSERTED],
  [SOURCED_OWNER_RELAYED, SOURCED_USER_REPORTS],
  [SOURCED_OWNER_ASSERTED, SOURCED_USER_REPORTS],
]) ok(`${a} ≠ ${b}`, a !== b);
// The fourth tier, and the distinction that earned it. RELAYED is somebody
// reporting what the vendor's page says; ASSERTED is somebody inferring
// something it does not say. Projul's feature lists are the first, Projul's
// currency is the second, and collapsing them would put the owner's inference
// and the owner's reading at the same standard of proof.
ok("Projul's feature lists are RELAYED — a report of their page",
  competitor("projul").figures.every((f) => f.featuresSourcing === SOURCED_OWNER_RELAYED));
ok("...while Projul's currency is ASSERTED — an inference their page does not support",
  competitor("projul").figures.every((f) => f.price.currencySourcing === SOURCED_OWNER_ASSERTED));
ok("...so one competitor carries both, and they are not the same field",
  SOURCED_OWNER_RELAYED !== SOURCED_OWNER_ASSERTED);
ok("...and none of them is a verification state",
  !SOURCING_TIERS.includes(VERIFIED) && !SOURCING_TIERS.includes(UNVERIFIED));
// All three are actually in use, or the vocabulary is decoration.
const tiersInUse = new Set([
  ...OBSERVATIONS.filter((f) => f.price?.currencySourcing).map((f) => f.price.currencySourcing),
  ...COMPETITORS.flatMap((c) => [...c.theyHaveWeDont, ...c.weHaveTheyDont]).map((e) => e.sourcing),
  ...allReportedCosts().map((r) => r.sourcing),
]);
ok("every tier is used by real data", SOURCING_TIERS.every((t) => tiersInUse.has(t)), [...tiersInUse]);
// Each renders as a DIFFERENT sentence. Two tiers that print the same words
// are one tier with extra steps.
const signature = { who: "someone", on: TODAY, grounds: "a reason long enough to count" };
const labels = SOURCING_TIERS.map((t) =>
  provenanceLabel({ sourcing: t, checked: TODAY, assertedBy: signature, relayedBy: signature }, { subject: "Them" }));
ok("each tier renders as its own sentence", new Set(labels).size === 4, labels);
ok("...and a relay with nobody's name on it says so",
  provenanceLabel({ sourcing: SOURCED_OWNER_RELAYED }) === "relayed with no record of who relayed it");
ok("...and an unrecorded tier says so rather than guessing",
  provenanceLabel({}) === "provenance not recorded");

// ══════════════════════════════════════════════════════════════════════════
console.log("\nServiceTitan's reported costs are third-hand, and cannot pass as anything else");
// ══ Why these are not in `figures` ═════════════════════════════════════════
//
// ServiceTitan publishes nothing. The bands below come from a video summary
// and a forum thread. Putting them in `figures` would have failed the
// "sourced from the competitor's own site" assertion near the top of this
// file — correctly, because they are not ServiceTitan speaking — so they live
// in their own array with their own gate, and a renderer walking `figures`
// cannot pick one up by accident.
const reported = allReportedCosts();
ok("there are reported costs to check", reported.length === 3, reported.length);
ok("...all on ServiceTitan, the one competitor that publishes nothing",
  reported.every((r) => r.competitorId === "servicetitan"));
ok("...and NONE of them is in allFigures()",
  !allFigures().some((f) => reported.some((r) => r.id === f.id)));
ok("...nor in publishableFigures()",
  !publishableFigures(TODAY).some((f) => f.id.includes("reported")));
// ServiceTitan's own three tiers are untouched: their page still publishes no
// price and the reported bands did not quietly become one.
ok("ServiceTitan's own tiers still say Request Pricing",
  competitor("servicetitan").figures.every((f) => f.price.kind === PRICE_ON_REQUEST));
ok("...and none of them acquired an amount",
  competitor("servicetitan").figures.every((f) => f.price.amount === undefined));

for (const r of reported) {
  ok(`${r.id} is sourced to user reports`, r.sourcing === SOURCED_USER_REPORTS, r.sourcing);
  ok(`${r.id} carries a band, not an amount`, r.price.kind === PRICE_REPORTED_RANGE, r.price.kind);
  ok(`${r.id} publishes`, reportedWithholdReason(r, TODAY) === null, reportedWithholdReason(r, TODAY));
  ok(`${r.id} names its sources by KIND`,
    r.reportedVia.length >= 2 && r.reportedVia.every((v) => /^a /.test(v.kind)), r.reportedVia?.map((v) => v.kind));
  // ── The band never collapses ────────────────────────────────────────────
  //
  // Two ways it goes wrong: printing one end alone, and averaging. Both are
  // closed by the endpoints being PRIVATE fields on a class rather than
  // properties on an object. There is nothing to print and nothing to add.
  ok(`${r.id}'s band is a Reported`, r.price.band instanceof Reported);
  ok(`${r.id} exposes no low endpoint`, r.price.band.low === undefined, r.price.band.low);
  ok(`${r.id} exposes no high endpoint`, r.price.band.high === undefined, r.price.band.high);
  ok(`${r.id} exposes no amount`, r.price.band.amount === undefined && r.price.amount === undefined);
  ok(`${r.id}'s band refuses to be a number`,
    (() => { try { Number(r.price.band); return false; } catch { return true; } })());
  ok(`${r.id}'s band refuses to be averaged`,
    (() => { try { return Number.isFinite((r.price.band + r.price.band) / 2) ? false : true; } catch { return true; } })());
  ok(`${r.id}'s band refuses to be compared`,
    (() => { try { void (r.price.band < 400); return false; } catch { return true; } })());
  // What it DOES produce always carries both ends and the word "reported".
  const text = reportedCostText(r, { subject: "ServiceTitan" });
  ok(`${r.id} renders both ends of the band`, (text.match(/\$[\d,]+/g) || []).length >= 4, text);
  ok(`${r.id} renders as "reported"`, /[Rr]eport/.test(text), text);
  ok(`${r.id} says ServiceTitan did not publish it`, /not published by ServiceTitan/.test(text), text);
  ok(`${r.id} names the kinds of source in the sentence itself`,
    /video summary/.test(text) && /forum thread/.test(text), text);
  ok(`${r.id} carries the separate implementation fee`, /implementation fee/.test(text), text);
  ok(`${r.id} states nobody established the currency`, /states a currency/.test(text), text);
  // Never a bare number: every dollar figure in the rendered sentence sits
  // inside a band or beside the word reported. Checked by the absence of a
  // lone figure with nothing else on its line.
  ok(`${r.id} never renders one figure alone`, !/^\$[\d,]+$/.test(text.trim()), text);
}
// The class refuses to be built wrong in the first place.
ok("a band with equal ends is refused — that is a number, not a range",
  (() => { try { new Reported({ low: 300, high: 300, unit: "x", label: "y" }); return false; } catch { return true; } })());
ok("a band with a missing end is refused",
  (() => { try { new Reported({ low: 300, unit: "x", label: "y" }); return false; } catch { return true; } })());
ok("an inverted band is refused",
  (() => { try { new Reported({ low: 400, high: 300, unit: "x", label: "y" }); return false; } catch { return true; } })());
ok("a Reported serialises with its label, never as a number",
  /report/i.test(JSON.stringify(reported[0].price.band)));

// The gate is a SECOND function on purpose, and it refuses the things the
// price gate would have waved through.
ok("no reported cost is ever cleared by the PRICE gate",
  reported.every((r) => withholdReason(r, TODAY) !== null), reported.map((r) => withholdReason(r, TODAY)));
// The band branch inside withholdReason, exercised directly. A real reported
// cost never reaches it — it has no `source`, because its sources are the
// forum thread and the video, not a page — so without a synthetic fixture this
// branch would be a gate that has never been opened.
ok("...and a band dressed up with a source URL is still refused as a price",
  withholdReason(
    synth({ kind: PRICE_REPORTED_RANGE, band: reported[0].price.band }), TODAY) ===
    "a reported band is not a price — see reportedWithholdReason");
ok("...and the two gates are not the same function", withholdReason !== reportedWithholdReason);
const synthReported = { ...reported[0] };
ok("a reported cost claiming to be VERIFIED is refused",
  /cannot be verified/.test(reportedWithholdReason({ ...synthReported, verification: VERIFIED }, TODAY) || ""));
ok("a reported cost with no named source is refused",
  reportedWithholdReason({ ...synthReported, reportedVia: [] }, TODAY) === "no reported source named");
ok("a reported cost whose source does not say what KIND it is, is refused",
  reportedWithholdReason({ ...synthReported, reportedVia: [{ what: "somewhere online, honestly" }] }, TODAY) ===
    "a reported source does not say what kind of source it is");
ok("a reported cost with a bare object instead of a band is refused",
  reportedWithholdReason(
    { ...synthReported, price: { kind: PRICE_REPORTED_RANGE, band: { low: 245, high: 300 } } }, TODAY) ===
    "the band is not a Reported — a bare number could be printed");
ok("a reported cost claiming publisher sourcing is refused",
  reportedWithholdReason({ ...synthReported, sourcing: SOURCED_PUBLISHER }, TODAY) ===
    "a reported cost must be sourced to user reports");
ok("a stale reported cost is refused with its age",
  /^last checked \d+ days ago$/.test(reportedWithholdReason({ ...synthReported, checked: "2025-01-01" }, TODAY) || ""));

// ── The structural terms, which are the part worth leaning on ──────────────
//
// Per-technician pricing, a separate implementation fee, an annual contract
// with no monthly option. These change what a twelve-technician shop pays by
// far more than the gap between $245 and $300, and a reader can test them in
// one sales call. They carry NO NUMBERS, which is what makes them safe: a
// sentence with no figure in it cannot be misquoted as a price.
const terms = allReportedTerms();
ok("the structural terms are recorded", terms.length >= 6, terms.length);
ok("...every one sourced to user reports", terms.every((t) => t.sourcing === SOURCED_USER_REPORTS));
ok("...every one saying it is reported, in its own words",
  terms.every((t) => /report/i.test(t.statement)), terms.filter((t) => !/report/i.test(t.statement)).map((t) => t.id));
ok("...and none of them states a dollar figure",
  terms.every((t) => !/\$|\d{3,}/.test(t.statement)), terms.filter((t) => /\$|\d{3,}/.test(t.statement)).map((t) => t.statement));
ok("...each says why it matters, or it is trivia", terms.every((t) => typeof t.whyItMatters === "string" && t.whyItMatters.length > 40));
ok("...none is marked verified — there is no page to verify against",
  terms.every((t) => t.verification === UNVERIFIED));
for (const key of ["per_technician", "implementation_fee", "annual_only"]) {
  ok(`the ${key} term is recorded`, terms.some((t) => t.id.endsWith(key)), key);
}
// ── Reported tiers are linked to published tiers by NAME, or not at all ────
//
// The first pass called the third tier "Enterprise", because that is the word
// the earlier summary used, and left it unlinked — correctly, since
// ServiceTitan's own page names Starter, Essentials and The Works, and
// matching "Enterprise" to "The Works" because both sit third is the
// name-matching mistake comparableTier exists to prevent.
//
// A fuller pass of the same two sources names The Works explicitly, so the
// link is now made. What must never come back is a link made by POSITION, so
// the assertion is that every link names a tier that actually exists on their
// page under that name.
const stTiers = competitor("servicetitan").figures;
for (const r of reported) {
  ok(`${r.id} either names a real published tier or names none`,
    r.tierPublishes === null || stTiers.some((f) => f.id === r.tierPublishes), r.tierPublishes);
  if (r.tierPublishes) {
    ok(`...and ${r.id} links to the tier with the SAME NAME, not the same position`,
      stTiers.find((f) => f.id === r.tierPublishes).label === r.label,
      [r.label, stTiers.find((f) => f.id === r.tierPublishes)?.label]);
  }
}
ok("no reported tier is called Enterprise any more — their page has no such tier",
  !reported.some((r) => r.label === "Enterprise"), reported.map((r) => r.label));
ok("...and the earlier reading is recorded rather than deleted",
  reported.some((r) => /Enterprise/.test(r.note || "")));

// ── The per-tier detail, and why the EXCLUDES are the valuable half ────────
//
// "Everything is in every FieldQuo plan" is a slogan until it sits beside a
// named list of what a competitor's entry tier withholds. These are the things
// a contractor discovers after signing an annual contract.
for (const r of reported) {
  const added = r.includes || r.addsOverPreviousTier;
  ok(`${r.id} records what the tier contains`, Array.isArray(added) && added.length >= 5, added?.length);
  // `excludes: []` is a STATEMENT — the top tier withholds nothing reported —
  // and it is not the same as never having asked. So the field must exist.
  ok(`${r.id} records what the tier withholds, even when that is nothing`,
    Array.isArray(r.excludes), r.excludes);
  ok(`${r.id}'s lists carry no dollar figures`,
    [...added, ...r.excludes].every((x) => !/\$/.test(x)));
}
const starter = reported.find((r) => r.label === "Starter");
ok("the entry tier's exclusions are recorded, and they are the interesting ones",
  starter.excludes.length >= 5, starter.excludes);
for (const missing of ["mobile estimates", "payroll", "commission", "service agreements"]) {
  ok(`...including ${missing}`, starter.excludes.some((x) => x.includes(missing)), starter.excludes);
}
ok("only the ENTRY tier carries a headcount floor",
  reported.filter((r) => r.minimumTechnicians).length === 1);
ok("...and it is a band, so it cannot be quoted as one number",
  starter.minimumTechnicians instanceof Reported);
ok("...which refuses to be averaged into 4",
  (() => { try { void (starter.minimumTechnicians + 0); return false; } catch { return true; } })());
ok("...and renders both ends", /3.+5/.test(String(starter.minimumTechnicians)), String(starter.minimumTechnicians));
ok("...saying it is a reported minimum", /minimum/.test(String(starter.minimumTechnicians)));
// The exclusion that bounds OUR strongest argument. Mobile estimates arriving
// only at their middle tier is a point for us; our crew not being able to
// quote at all is the point against, and both are in the ledger.
ok("their entry tier withholds mobile estimates",
  starter.excludes.some((x) => /mobile estimates/.test(x)));
ok("...and we concede that our own crew cannot quote either",
  FIELDQUO_CAPABILITIES.field_worker_quotes.has === false);
ok("...with evidence naming the permission preset that says so",
  /PERMISSION_PRESETS\.worker/.test(FIELDQUO_CAPABILITIES.field_worker_quotes.evidence));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nFive companies, five units, and none of them is a seat by accident");
// ══ The mistake this section exists to make impossible ═════════════════════
//
// ServiceTitan is reported to charge per TECHNICIAN, Jobber by a team-size
// BAND, Housecall Pro per SEAT, QuoteIQ per USER, Projul a FLAT annual fee.
// FieldQuo charges for seats and includes crew free. Put those numbers in one
// table without saying so and you are comparing different things while looking
// rigorous.
//
// The specific error: a twenty-technician company is twenty billable people to
// ServiceTitan and perhaps two or three SEATS here, because a technician is a
// field worker and a field worker is crew. That is the strongest true claim in
// this comparison, and it is only true if somebody maps the units on purpose.
ok("every competitor declares what it charges per",
  COMPETITORS.every((c) => Object.hasOwn(PRICING_UNITS, c.pricingUnit)),
  COMPETITORS.map((c) => [c.id, c.pricingUnit]));
ok("...and where that was established", COMPETITORS.every((c) => SOURCING_TIERS.includes(c.pricingUnitSourcing)),
  COMPETITORS.map((c) => [c.id, c.pricingUnitSourcing]));
ok("no two of the five charge in the same way, so the units are not decoration",
  new Set(COMPETITORS.map((c) => c.pricingUnit)).size === COMPETITORS.length,
  COMPETITORS.map((c) => c.pricingUnit));
ok("FieldQuo's own unit is declared, not left for a caller to name",
  Object.hasOwn(PRICING_UNITS, FIELDQUO_PRICING_UNIT));
ok("...and it is not any competitor's unit",
  !COMPETITORS.some((c) => c.pricingUnit === FIELDQUO_PRICING_UNIT));
for (const [key, unit] of Object.entries(PRICING_UNITS)) {
  ok(`${key} says who is counted`, typeof unit.countsWhom === "string" && unit.countsWhom.length > 20, unit.countsWhom);
  ok(`${key} says what it maps to in our model`, typeof unit.mapsTo === "string" && unit.mapsTo.length > 2, unit.mapsTo);
  // ── The caveat is part of the mapping, not a footnote under it ───────────
  //
  // A caller that maps twenty technicians onto free crew without printing this
  // is making a comparison we cannot defend. So there is no unit without one.
  ok(`${key} carries the caveat on that mapping`, typeof unit.caveat === "string" && unit.caveat.length > 60, unit.caveat);
  ok(`${key}'s key matches its own entry`, unit.key === key);
}
// The technician mapping specifically, because it is the one that carries the
// argument and the one most easily overstated.
const techUnit = PRICING_UNITS[competitor("servicetitan").pricingUnit];
ok("the per-technician unit maps onto CREW", techUnit.mapsTo === "crew");
ok("...and its caveat names the limit — our crew cannot quote",
  /cannot write a quote/.test(techUnit.caveat), techUnit.caveat);
ok("...pointing at the permission preset rather than asserting it",
  /PERMISSION_PRESETS\.worker/.test(techUnit.caveat));
// Both halves of the argument are in the ledger, and they are a pair.
ok("free crew is recorded as something we HAVE", FIELDQUO_CAPABILITIES.free_crew_seats.has === true);
ok("...with evidence read out of the ladder, not asserted",
  /crewSeats/.test(FIELDQUO_CAPABILITIES.free_crew_seats.evidence) &&
    /isBillableSeat/.test(FIELDQUO_CAPABILITIES.free_crew_seats.evidence));
ok("...and its own scope names what crew cannot do",
  /field_worker_quotes/.test(FIELDQUO_CAPABILITIES.free_crew_seats.evidence));
ok("crew not being able to quote is recorded as something we LACK",
  FIELDQUO_CAPABILITIES.field_worker_quotes.has === false &&
    FIELDQUO_LACKS.includes("field_worker_quotes"));
// The ladder actually says what the evidence claims. Executed, not trusted.
ok("every rung really does include free crew", SEAT_LADDER.every((t) => t.crewSeats > 0),
  SEAT_LADDER.map((t) => [t.tierKey, t.crewSeats]));
ok("...and the top rung really is 25 people for one price",
  SEAT_LADDER[3].seats + SEAT_LADDER[3].crewSeats === 25);

// ══════════════════════════════════════════════════════════════════════════
console.log("\nQuoteIQ beats us at one user, and the data says so first");
const quoteiq = competitor("quoteiq");
ok("QuoteIQ is in the comparison at all", quoteiq !== null);
ok("...with both billing modes on every tier",
  new Set(quoteiq.figures.map((f) => f.axis.billing)).size === 2);
ok("...and five tiers, not four", new Set(quoteiq.figures.map((f) => f.label)).size === 5,
  [...new Set(quoteiq.figures.map((f) => f.label))]);
ok("...including the Max tier the owner's list did not have",
  quoteiq.figures.some((f) => f.label === "Max"));
ok("...and the module records that the read found it",
  /fifth tier/.test(quoteiq.relayNote || ""), quoteiq.relayNote);
ok("every QuoteIQ figure was read off their page, not relayed",
  quoteiq.figures.every((f) => f.verification === VERIFIED && f.price.currencySourcing === SOURCED_PUBLISHER));
ok("...and every one publishes", quoteiq.figures.every((f) => withholdReason(f, "2026-08-29") === null),
  quoteiq.figures.map((f) => withholdReason(f, "2026-08-29")));
ok("...with the currency read from their own structured data",
  quoteiq.figures.every((f) => /priceCurrency/.test(f.verifiedBy)));
// Cents survive. Rounding a competitor's price is inventing a number about
// somebody else, which is the thing this whole file is against.
const essentials = quoteiq.figures.find((f) => f.id === "quoteiq.essentials.monthly");
ok("their price keeps its cents", essentials.price.amount === 29.99, essentials.price.amount);
ok("...and is not rounded to 30 anywhere", !quoteiq.figures.some((f) => f.price.amount === 30));
// ── The concession, computed rather than typed ────────────────────────────
//
// $29.99 against our $99. There is no reading of a single-user comparison that
// favours us, and a page that fudges its cheapest claim is a page that gets
// caught on it. Both numbers are read: theirs off their Offer markup, ours out
// of SEAT_LADDER, so this assertion moves if either side moves.
ok("QuoteIQ's entry price really is below FieldQuo's cheapest rung",
  essentials.price.amount < Math.min(...SEAT_LADDER.map((t) => t.price)),
  { quoteiq: essentials.price.amount, fieldquo: Math.min(...SEAT_LADDER.map((t) => t.price)) });
ok("...and it is conceded, in the ledger, as something we lack",
  FIELDQUO_CAPABILITIES.entry_price_below_our_floor.has === false);
ok("...on QuoteIQ's own page as the claim's source",
  claims("quoteiq").theyHaveWeDont.some(
    (e) => e.capability === "entry_price_below_our_floor" && e.publishable === true && e.verification === VERIFIED));
ok("...and the claim names both numbers so a reader can check it",
  claims("quoteiq").theyHaveWeDont.some((e) => /29\.99/.test(e.claim) && /\$99/.test(e.claim)));
// The other direction, which is where it turns.
ok("their users are all paid, and that is our claim of advantage",
  claims("quoteiq").weHaveTheyDont.some((e) => e.capability === "free_crew_seats" && e.publishable === true));
ok("...verified off their page, not asserted — an advantage needs their own words",
  quoteiq.weHaveTheyDont.every((e) => e.verification === VERIFIED && e.sourcing === SOURCED_PUBLISHER));
ok("...and its note scopes the claim to what crew actually cannot do",
  quoteiq.weHaveTheyDont.some((e) => /crew cannot price a job/.test(e.note || "")));
ok("QuoteIQ concedes MORE to them than we claim over them",
  quoteiq.theyHaveWeDont.length > quoteiq.weHaveTheyDont.length,
  [quoteiq.theyHaveWeDont.length, quoteiq.weHaveTheyDont.length]);
// The AI metering difference, held as numbers rather than flattened into a
// slogan. Ours is a plan quota on spend (lib/ai/usage.js); theirs is a fixed
// monthly credit allowance per tier. Neither is "unmetered", and claiming ours
// was would be the same overclaim as "AI included".
const credits = quoteiq.figures.map((f) => f.aiCreditsPerMonth).filter(Boolean);
ok("their AI credit allowance is recorded per tier", credits.length === quoteiq.figures.length, credits.length);
ok("...and rises with the tier, which is the shape of the meter",
  new Set(credits).size >= 5, [...new Set(credits)]);
ok("...and no claim anywhere says FieldQuo's AI is unmetered",
  !COMPETITORS.flatMap((c) => c.weHaveTheyDont).some((e) => /unmetered|unlimited AI/i.test(e.claim)));
// Unlimited is not a large number.
const max = quoteiq.figures.find((f) => f.id === "quoteiq.max.monthly");
ok("their unlimited tier records no seat count", max.seatsIncluded === null && max.unlimitedSeats === true);
ok("...so nothing can divide by an invented ceiling",
  !quoteiq.figures.some((f) => f.unlimitedSeats && Number.isFinite(f.seatsIncluded)));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nLookups behave when asked about something that is not there");
ok("an unknown competitor is null, not undefined-shaped", competitor("nope") === null);
ok("claims() for an unknown competitor is null", claims("nope") === null);
ok("comparableTier for an unknown competitor is null", comparableTier("nope", { feature: "ai_receptionist" }, TODAY) === null);
ok("withholdReason(null) is a reason, not a crash", withholdReason(null, TODAY) === "no figure");
ok("a figure with no source is withheld",
  withholdReason({ ...synth({ kind: PRICE_AMOUNT, amount: 1, per: "month", currency: "USD" }), source: undefined }, TODAY) ===
    "no source URL");
ok("a figure with no checked date is withheld",
  withholdReason({ ...synth({ kind: PRICE_AMOUNT, amount: 1, per: "month", currency: "USD" }), checked: undefined }, TODAY) ===
    "no checked date");

// ── The comment stripper ───────────────────────────────────────────────────
//
// Written out rather than regexed because the strings in this module contain
// "https://" and the comments contain the word "convert" — a naive line-comment
// regex mangles the first and a naive identifier regex trips on the second.
// Walking the source once, tracking which of {code, string, template, comment}
// we are in, is the only version that gets both right.
function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      // Replaced by a space rather than dropped, so identifiers either side of
      // a string cannot be glued into a word that was never written.
      out += " ";
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

if (warns.length) {
  console.log(`\nWARNINGS (not failures) — ${warns.length}`);
  for (const w of warns) console.log(`  ! ${w}`);
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
