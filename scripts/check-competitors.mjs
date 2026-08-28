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
  PRICE_UNKNOWN,
  STALE_AFTER_DAYS,
  TEAM_SIZES,
  UNVERIFIED,
  VERIFIED,
  allAddOns,
  allFigures,
  claims,
  comparableTier,
  competitor,
  figureAgeDays,
  isStale,
  livePromo,
  publishableFigures,
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
ok("all five kinds are distinct", new Set(PRICE_KINDS).size === PRICE_KINDS.length);

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
const synth = (price, extra = {}) => ({
  id: "synthetic",
  price,
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
ok("...and every one says the currency was not stated",
  projul.figures.every((f) => f.price.currency === CURRENCY_NOT_STATED),
  projul.figures.map((f) => f.price.currency));
// This is the assertion that stops the owner's guess from shipping.
ok("...so no Projul figure is publishable",
  projul.figures.every((f) => withholdReason(f, TODAY) === "the source states no currency"),
  projul.figures.map((f) => withholdReason(f, TODAY)));
ok("...and none of them silently became USD",
  !projul.figures.some((f) => f.price.currency === "USD"));
ok("a currency nobody checked is withheld for a different reason",
  withholdReason(synth({ kind: PRICE_AMOUNT, amount: 10, per: "month", currency: CURRENCY_UNKNOWN }), TODAY) ===
    "currency never checked");

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
console.log("\nNo currency conversion exists, and adding one fails this check");
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

// An FX rate is a decimal. There is not one non-integer number in this file,
// and there should never be: prices are whole units, ages are whole days.
// A literal like 1.37 appearing here is an exchange rate wearing a hat.
const decimals = code.match(/\b\d+\.\d+\b/g) || [];
ok("no decimal literal anywhere in the code — an FX rate is a decimal", decimals.length === 0, decimals);

// Every amount is a bare integer literal, never an expression.
//
// The last hole mutation testing found: `amount: Math.round(59 * 137 / 100)`
// converts a price with integer arithmetic, so it trips neither the stem list
// nor the decimal rule, and produces a plausible number in a real currency
// that sails through every other assertion. An amount here is a number
// somebody READ OFF A PAGE. If it is being computed, it is not that.
const amounts = [...code.matchAll(/amount:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
ok("every amount is a literal read off a page, not an expression",
  amounts.length > 0 && amounts.every((a) => /^\d+$/.test(a)),
  amounts.filter((a) => !/^\d+$/.test(a)));

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
    ok(`claim "${e.claim.slice(0, 36)}" publishes only if verified`,
      e.publishable === (e.verification === VERIFIED) &&
        (e.verification !== VERIFIED || (typeof e.verifiedBy === "string" && e.verifiedBy.length > 10)), e);
  }
}

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
