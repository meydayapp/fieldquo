// scripts/check-fx.mjs
//
// This one guards a narrowing.
//
// lib/marketing/competitors.js banned currency conversion outright and
// check-competitors.mjs enforced the ban structurally — a `convertToCad`
// identifier failed the build, the currency codes were banned from
// identifiers, and every `amount` had to be a bare integer literal so nobody
// could multiply inside the data. Those assertions are all still there and all
// still pass; run check-competitors.mjs and count them.
//
// What has changed is that conversion is now allowed at PRESENTATION time,
// because the owner is right that a Canadian reading "$399 USD" beside "$369
// CAD" cannot compare them without doing exchange arithmetic in his head. The
// thing the old ban was actually protecting against is a STATIC CONVERTED
// NUMBER stored in the data: right the day it ships, wrong every day after, on
// a page nobody is watching.
//
// So lib/marketing/fx.js exists, and this file's whole job is to prove that
// the limits on it are structural rather than good intentions:
//
//   1. A rate with no date or no source cannot be used.
//   2. A rate past its window cannot be used, and the caller gets a sentence
//      explaining the blank rather than an old number.
//   3. A converted value carries its rate, its date and its source, and there
//      is no reachable bare number inside it to print without them.
//   4. FieldQuo's own prices are never converted. SEAT_LADDER is the same
//      number in CAD and USD by design, not a conversion; running it through
//      an exchange rate would print a price we do not charge.
//   5. A figure the module refuses to PUBLISH is a figure it refuses to
//      CONVERT. This was a real hole while the module was being written: every
//      Jobber annual figure is withheld over an unresolved question and every
//      one of them converted happily, which is a way of publishing a number we
//      had decided not to publish.
//   6. A reported band never converts, because converting one end of a range
//      is the midpoint mistake in a different hat.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-fx.mjs

import { readFileSync } from "node:fs";
import {
  Approximate,
  RATES,
  RATE_STALE_AFTER_DAYS,
  approximateAmount,
  approximateInCurrency,
  conversionRefusal,
  rateAgeDays,
  rateFor,
  rateRefusal,
} from "@/lib/marketing/fx";
import {
  PRICE_AMOUNT,
  SOURCED_OWNER_ASSERTED,
  SOURCED_PUBLISHER,
  SOURCED_USER_REPORTS,
  allAddOns,
  allFigures,
  allReportedCosts,
  competitor,
  withholdReason,
} from "@/lib/marketing/competitors";
import { SEAT_LADDER, SUPPORTED_CURRENCIES, ladderFor } from "@/lib/pricing/ladder";

let pass = 0;
const fails = [];
const warns = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const warn = (label) => warns.push(label);

const SOURCE = readFileSync("lib/marketing/fx.js", "utf8");
// A fixed clock for every assertion, same reason as check-competitors.mjs: a
// check whose result depends on the wall clock passes on Monday and fails on
// Tuesday for no reason anybody can reproduce. The wall clock is used ONCE,
// right at the end, and only to raise a warning.
const TODAY = "2026-08-29";
const RATE = RATES[0];
const FIGURES = [...allFigures(), ...allAddOns()];

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA rate is a number, a date and a source — and it is useless without all three");
ok("there is a rate to test", RATES.length > 0, RATES.length);
for (const r of RATES) {
  ok(`${r.base}->${r.quote} is a positive number`, Number.isFinite(r.rate) && r.rate > 0, r.rate);
  ok(`${r.base}->${r.quote} carries the date it is FOR`, /^\d{4}-\d{2}-\d{2}$/.test(r.rateDate || ""), r.rateDate);
  ok(`${r.base}->${r.quote} carries the date it was READ`, /^\d{4}-\d{2}-\d{2}$/.test(r.readOn || ""), r.readOn);
  ok(`${r.base}->${r.quote} names a source URL`, typeof r.source === "string" && r.source.startsWith("https://"), r.source);
  ok(`${r.base}->${r.quote} names its source in words`, typeof r.sourceName === "string" && r.sourceName.length > 10, r.sourceName);
  ok(`${r.base}->${r.quote} says HOW it was read`, typeof r.readBy === "string" && r.readBy.length > 20, r.readBy);
  // The date the rate is FOR is what staleness measures, and it must not be
  // after the day it was fetched — a rate cannot describe a day that has not
  // happened yet, and that shape of typo is how a stale rate looks fresh.
  ok(`${r.base}->${r.quote}'s rate date is not after its read date`, r.rateDate <= r.readOn, [r.rateDate, r.readOn]);
  ok(`${r.base}->${r.quote} says what kind of rate it is`, typeof r.caveat === "string" && r.caveat.length > 20, r.caveat);
  // The rate goes only between currencies FieldQuo actually prices in. Not a
  // style rule: a converted figure exists to be read beside a FieldQuo price,
  // and there is no FieldQuo price in a currency the ladder does not carry.
  ok(`${r.base} is a currency FieldQuo prices in`, SUPPORTED_CURRENCIES.includes(r.base), r.base);
  ok(`${r.quote} is a currency FieldQuo prices in`, SUPPORTED_CURRENCIES.includes(r.quote), r.quote);
}
ok("the rate we hold is usable today", rateRefusal(RATE, TODAY) === null, rateRefusal(RATE, TODAY));

// Executed against each missing field. A gate that has never been closed is a
// gate that appears to work.
ok("a rate with NO DATE is refused",
  rateRefusal({ ...RATE, rateDate: undefined }, TODAY) === "the rate carries no date");
ok("...and so is one with a date that is not a date",
  rateRefusal({ ...RATE, rateDate: "last Tuesday" }, TODAY) === "the rate carries no date");
ok("a rate with NO SOURCE is refused",
  rateRefusal({ ...RATE, source: undefined }, TODAY) === "the rate names no source");
ok("...and one whose source is not a URL",
  rateRefusal({ ...RATE, source: "somebody told me" }, TODAY) === "the rate names no source");
ok("...and one whose source is a URL nobody can name",
  rateRefusal({ ...RATE, sourceName: "" }, TODAY) === "the rate's source is not named in words");
ok("a rate that is not a number is refused",
  rateRefusal({ ...RATE, rate: "about 1.4" }, TODAY) === "the rate is not a positive number");
ok("a zero rate is refused", rateRefusal({ ...RATE, rate: 0 }, TODAY) === "the rate is not a positive number");
ok("a negative rate is refused", rateRefusal({ ...RATE, rate: -1.4 }, TODAY) === "the rate is not a positive number");
ok("no rate at all is refused", rateRefusal(null, TODAY) === "no rate for this pair");
ok("a rate dated in the FUTURE is refused, not treated as maximally fresh",
  rateRefusal({ ...RATE, rateDate: "2027-01-01" }, TODAY) === "the rate is dated in the future");
ok("the module refuses to guess what day it is",
  (() => { try { rateRefusal(RATE); return false; } catch { return true; } })());
ok("...and so does rateAgeDays",
  (() => { try { rateAgeDays(RATE); return false; } catch { return true; } })());

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA stale rate refuses, and says how to fix itself");
// The staleness window is what makes a checked-in rate self-limiting. Without
// it, a hardcoded number is exactly the static-converted-figure failure the
// original ban existed to prevent — it just moved one file across.
ok(`the window is a justified ${RATE_STALE_AFTER_DAYS} days`,
  RATE_STALE_AFTER_DAYS >= 14 && RATE_STALE_AFTER_DAYS <= 60, RATE_STALE_AFTER_DAYS);
ok("...and is SHORTER than the 90 days a competitor figure gets",
  RATE_STALE_AFTER_DAYS < 90, RATE_STALE_AFTER_DAYS);
ok("...and longer than a calendar month, so a monthly re-read has slack",
  RATE_STALE_AFTER_DAYS > 31, RATE_STALE_AFTER_DAYS);
const dayAfter = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const lastGoodDay = dayAfter(RATE.rateDate, RATE_STALE_AFTER_DAYS);
const firstStaleDay = dayAfter(RATE.rateDate, RATE_STALE_AFTER_DAYS + 1);
ok("the rate is still good on the last day of the window", rateRefusal(RATE, lastGoodDay) === null, lastGoodDay);
ok("...and refuses on the next day", rateRefusal(RATE, firstStaleDay) !== null, rateRefusal(RATE, firstStaleDay));
ok("...naming its age", /is \d+ days old/.test(rateRefusal(RATE, firstStaleDay)), rateRefusal(RATE, firstStaleDay));
ok("...and the URL to go and re-read", rateRefusal(RATE, firstStaleDay).includes(RATE.source));
ok("a badly stale rate refuses too", rateRefusal(RATE, "2027-06-01") !== null);
// And the refusal reaches the caller as a REFUSAL, never as an old number.
{
  const fig = FIGURES.find((f) => f.id === "housecall_pro.basic.annual");
  const fresh = approximateInCurrency(fig, { to: "CAD", asOf: TODAY });
  const stale = approximateInCurrency(fig, { to: "CAD", asOf: firstStaleDay });
  ok("a figure converts while the rate is fresh", fresh.approx instanceof Approximate);
  ok("...and stops converting the day the rate goes stale", stale.approx === null, stale.approx);
  ok("...returning a sentence the caller can print instead", /days old/.test(stale.refusedBecause || ""), stale.refusedBecause);
  ok("...and never a bare number in place of the conversion",
    typeof stale.approx !== "number" && stale.approx === null);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA converted value cannot be printed without its rate and date");
// ══ Why this is a class with private fields ════════════════════════════════
//
// The whole risk of conversion is a converted number reaching a page without
// the rate and the date that make it meaningful. "Return an object and ask the
// renderer to print all of it" is a convention, and a template in a hurry
// drops conventions. So there is no number to drop: the amount lives in a
// private field and everything reachable is a string that carries its own
// caveat. Same idea as the `Safe` wrapper in lib/export/accountingExport.js,
// run in the other direction — Safe marks a value as vouched for, this marks
// one as never to be shown alone.
const converted = FIGURES.map((f) => [f, approximateInCurrency(f, { to: "CAD", asOf: TODAY })])
  .filter(([, r]) => r.approx);
ok("something converts — this check must not pass by converting nothing", converted.length > 0, converted.length);
for (const [f, { approx }] of converted) {
  ok(`${f.id} converts to an Approximate, not a number`, approx instanceof Approximate);
  ok(`${f.id} exposes no bare amount`, approx.amount === undefined && approx.value === undefined);
  ok(`${f.id} refuses to be used as a number`,
    (() => { try { Number(approx); return false; } catch { return true; } })());
  ok(`${f.id} refuses to be added to`,
    (() => { try { void (approx + 1); return false; } catch { return true; } })());
  ok(`${f.id} refuses to be compared`,
    (() => { try { void (approx < 100); return false; } catch { return true; } })());
  ok(`${f.id} announces that it is approximate`, approx.approximate === true);
  const p = approx.parts;
  ok(`${f.id}'s converted figure begins with the approximation mark`, p.converted.startsWith("≈ "), p.converted);
  ok(`${f.id} carries the rate it used`, /converted at 1 .+ = [\d.]+ /.test(p.rate), p.rate);
  ok(`${f.id} carries the date that rate is for`, p.rateDate.includes(RATE.rateDate), p.rateDate);
  ok(`${f.id} carries the source that rate came from`, p.rateSource.includes(RATE.sourceName), p.rateSource);
  ok(`${f.id} carries the source URL`, p.rateSourceUrl === RATE.source);
  ok(`${f.id} carries the original, unconverted figure`, /published as /.test(p.original), p.original);
  ok(`${f.id} says how it was rounded`, /significant figures/.test(p.rounding), p.rounding);
  ok(`${f.id} says where the ORIGINAL currency came from`, typeof p.currencyProvenance === "string" && p.currencyProvenance.length > 20, p.currencyProvenance);
  // Nothing reachable is a number. Not "no number we happen to print" — no
  // number at all, so there is nothing for a renderer to reach past the text.
  ok(`${f.id} exposes only strings`,
    Object.values(p).every((v) => typeof v === "string"),
    Object.entries(p).filter(([, v]) => typeof v !== "string"));
  // Whatever a renderer does with it, the disclosure comes along.
  const s = String(approx);
  ok(`${f.id} stringifies with its rate, date and source attached`,
    s.includes("≈") && s.includes(RATE.rateDate) && s.includes(RATE.sourceName) && /converted at/.test(s), s);
  const j = approx.toJSON();
  ok(`${f.id} serialises marked approximate`, j.approximate === true && j.converted.startsWith("≈ "));
  ok(`${f.id} serialises with the rate and date`, j.rate.length > 5 && j.rateDate.includes(RATE.rateDate));
}
// Interpolating one into a template — the single most likely way a renderer
// touches it — cannot produce a bare figure.
{
  const [, { approx }] = converted[0];
  ok("interpolating an Approximate yields the full disclosure, never just the number",
    !/^≈ CA\$[\d,]+ a (month|year)$/.test(`${approx}`), `${approx}`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nRounding is honest: no precision the rate cannot support");
// $4,788 at 1.3888 is $6,648.66. Printing that claims a precision nothing here
// has — the rate is one daily snapshot, up to 45 days old, of a pair that moves
// a couple of percent inside that window, and it is a mid-market average
// nobody transacts at. Two significant figures is the shape of a statement
// somebody actually believes.
ok("two significant figures, at four digits", approximateAmount(6648.66) === 6600, approximateAmount(6648.66));
ok("...at five digits", approximateAmount(19983.9) === 20000, approximateAmount(19983.9));
ok("...at three", approximateAmount(206.9) === 210, approximateAmount(206.9));
ok("...at two", approximateAmount(81.9) === 82, approximateAmount(81.9));
ok("...and never finer than a dollar", approximateAmount(9.94) === 10, approximateAmount(9.94));
ok("...never a decimal", Number.isInteger(approximateAmount(3.3)), approximateAmount(3.3));
ok("zero and nonsense round to nothing at all",
  approximateAmount(0) === null && approximateAmount(-5) === null && approximateAmount(NaN) === null);
// A price with cents in it — QuoteIQ publishes $29.99 — converts and comes out
// with no cents on the other side. Cents on a published price are a fact about
// their page; cents on an approximation are invented precision.
{
  const cents = allFigures().find((f) => f.id === "quoteiq.essentials.monthly");
  ok("a competitor's cents survive in the DATA", cents.price.amount === 29.99, cents.price.amount);
  const out = approximateInCurrency(cents, { to: "CAD", asOf: TODAY });
  ok("...and do not survive the conversion", /^≈ CA\$\d+ a month$/.test(out.approx.parts.converted),
    out.approx.parts.converted);
  ok("...while the original is quoted back WITH its cents",
    /29\.99/.test(out.approx.parts.original), out.approx.parts.original);
}
for (const [f, { approx }] of converted) {
  const digits = approx.parts.converted.match(/[\d,]+/)[0].replace(/,/g, "");
  const n = Number(digits);
  ok(`${f.id} prints no more precision than it has`, approximateAmount(n) === n, digits);
  ok(`${f.id} prints no cents on an approximation`, !/\.\d/.test(approx.parts.converted), approx.parts.converted);
  // Still the right ballpark: rounding may not quietly become a different
  // number. Within 5% of the raw arithmetic, which two significant figures
  // guarantees and a bug would not.
  const raw = f.price.amount * RATE.rate;
  ok(`${f.id} is within rounding distance of the arithmetic`, Math.abs(n - raw) / raw < 0.05, { n, raw });
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nOur own prices are never converted");
// ══ Why this is the assertion the whole module hangs on ════════════════════
//
// SEAT_LADDER carries the SAME NUMBER in CAD and USD by design — 99 CAD and 99
// USD are both real FieldQuo prices, not conversions of one another. That is
// the fact that made the comparison work without any conversion in the first
// place. Running our own ladder through an exchange rate would print $137
// beside a plan we sell for $99: not a stale number, not a rounding argument,
// a price we do not charge, on our own pricing page.
//
// The guard is IDENTITY, not shape. A shape check ("has an amount and a
// currency") would wave a ladder tier straight through.
for (const tier of SEAT_LADDER) {
  const r = approximateInCurrency(tier, { to: "USD", asOf: TODAY });
  ok(`${tier.tierKey} cannot be converted`, r.approx === null, r.approx);
  ok(`...and the refusal names the reason`, /never converted|not a competitor observation/.test(r.refusedBecause), r.refusedBecause);
}
// The ladder as a renderer actually holds it — priced, currency attached,
// which is the closest a FieldQuo price ever comes to looking like a figure.
for (const row of ladderFor({ currency: "CAD" })) {
  ok(`the priced ${row.tierKey} row cannot be converted either`,
    approximateInCurrency(row, { to: "USD", asOf: TODAY }).approx === null);
}
// Dressed up to look exactly like a competitor figure, short of stealing an id.
ok("a FieldQuo price wearing a figure's shape is refused",
  approximateInCurrency(
    {
      id: "fieldquo.scale",
      price: { kind: PRICE_AMOUNT, amount: 369, per: "month", currency: "CAD", currencySourcing: SOURCED_PUBLISHER },
      source: "https://fieldquo.com/pricing",
      checked: TODAY,
      observedFrom: "CA",
      verification: "verified",
      verifiedBy: "our own pricing page, which is not somebody else's",
    },
    { to: "USD", asOf: TODAY },
  ).approx === null);
// ...and stealing a competitor's id does not work either, because the source
// host has to match that competitor's own domain.
ok("a FieldQuo price wearing a competitor's ID is still refused",
  /source is not/.test(
    approximateInCurrency(
      {
        id: "projul.core",
        price: { kind: PRICE_AMOUNT, amount: 369, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: "https://fieldquo.com/pricing",
        checked: "2026-08-28",
        observedFrom: "US",
        verification: "verified",
        verifiedBy: "a fabricated line inside check-fx.mjs",
      },
      { to: "CAD", asOf: TODAY },
    ).refusedBecause || ""));
ok("a number with no provenance at all is refused",
  approximateInCurrency({ price: { kind: PRICE_AMOUNT, amount: 100, per: "month", currency: "USD" } }, { to: "CAD", asOf: TODAY })
    .approx === null);
ok("nothing at all is refused", approximateInCurrency(null, { to: "CAD", asOf: TODAY }).approx === null);
// The module has no way to reach our ladder in the first place. "We simply
// won't" is not a guarantee; not importing it is.
// Scoped to the IMPORT STATEMENTS, not to the file text. The module's own
// comments argue about SEAT_LADDER at length — as they should, it is the
// reason the guard exists — and a substring test over the whole file would
// match those and then get weakened until it matched nothing. That is exactly
// how the \b-anchored stem regex in check-competitors.mjs let `convertToCad`
// through. A module can only obtain SEAT_LADDER by importing it, so the import
// statements are the complete surface.
const IMPORT_STATEMENTS = (SOURCE.match(/^import\b[^;]*;/gm) || []).join("\n");
ok("there are import statements to inspect", IMPORT_STATEMENTS.length > 50, IMPORT_STATEMENTS.length);
ok("fx.js never imports SEAT_LADDER", !/SEAT_LADDER/.test(IMPORT_STATEMENTS), IMPORT_STATEMENTS);
ok("...and the detector fires on an import that does",
  /SEAT_LADDER/.test('import { SEAT_LADDER } from "@/lib/pricing/ladder";'));
ok("...and imports only the one formatter it needs from the pricing module",
  (SOURCE.match(/from "@\/lib\/pricing\/ladder"/g) || []).length === 1 &&
    /import \{ currencyLabel \} from "@\/lib\/pricing\/ladder"/.test(SOURCE));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA figure we will not publish is a figure we will not convert");
// The hole this closes was live while the module was being written. Every gate
// in competitors.js — unverified, unresolved, stale, no vantage point, a
// currency nobody established — lives in withholdReason, and none of them were
// being asked here. So all eight Jobber annual figures, withheld because
// nobody settled what their $49 is relative to their $29, converted happily.
// An approximate CAD figure derived from a number we refuse to print is a way
// of printing it.
const withheldFigures = FIGURES.filter((f) => withholdReason(f, TODAY) !== null);
ok("there are withheld figures to test", withheldFigures.length > 0, withheldFigures.length);
for (const f of withheldFigures) {
  const r = approximateInCurrency(f, { to: "CAD", asOf: TODAY });
  ok(`${f.id} is withheld, so it does not convert`, r.approx === null, r.approx);
}
ok("...including Jobber's unresolved annual rows specifically",
  ["jobber.grow.6-10.annual", "jobber.plus.2-5.annual"].every(
    (id) => /withheld/.test(approximateInCurrency(FIGURES.find((f) => f.id === id), { to: "CAD", asOf: TODAY }).refusedBecause || "")));
// The converse: the rows that DO publish are the rows that convert, so this
// gate did not simply switch everything off.
const publishable = FIGURES.filter((f) => withholdReason(f, TODAY) === null);
ok("every publishable USD figure converts",
  publishable.filter((f) => f.price.kind === PRICE_AMOUNT && f.price.currency === "USD")
    .every((f) => approximateInCurrency(f, { to: "CAD", asOf: TODAY }).approx instanceof Approximate));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nProvenance survives the conversion");
// Projul's currency is the owner's assertion, not a reading of their page.
// Converting it is allowed — but a converted figure that dropped that on the
// floor would launder his judgement into a fact twice over: once into a
// currency, once into Canadian dollars.
{
  const projul = approximateInCurrency(FIGURES.find((f) => f.id === "projul.core"), { to: "CAD", asOf: TODAY });
  ok("Projul's asserted figure converts", projul.approx instanceof Approximate);
  ok("...and says the currency was asserted, not published",
    /asserted by/.test(projul.approx.parts.currencyProvenance), projul.approx.parts.currencyProvenance);
  ok("...naming who and when", /Emilio Boves/.test(projul.approx.parts.currencyProvenance) &&
    /\d{4}-\d{2}-\d{2}/.test(projul.approx.parts.currencyProvenance));
  ok("...and that Projul's own page does not state it",
    /not stated on Projul's page/.test(projul.approx.parts.currencyProvenance), projul.approx.parts.currencyProvenance);

  const hcp = approximateInCurrency(FIGURES.find((f) => f.id === "housecall_pro.basic.annual"), { to: "CAD", asOf: TODAY });
  ok("Housecall Pro's figure says its currency IS on their page",
    /stated on Housecall Pro's own page/.test(hcp.approx.parts.currencyProvenance), hcp.approx.parts.currencyProvenance);
  ok("...so the two provenances are different sentences",
    hcp.approx.parts.currencyProvenance !== projul.approx.parts.currencyProvenance);
}
// A currency provenance that was never recorded does not convert — the same
// rule withholdReason applies, enforced again here rather than assumed, because
// a figure could in principle reach this module by another road.
ok("an unrecorded currency provenance refuses",
  /provenance is not recorded|withheld/.test(
    conversionRefusal(
      { ...FIGURES.find((f) => f.id === "projul.core"), price: { kind: PRICE_AMOUNT, amount: 4788, per: "year", currency: "USD" } },
      { to: "CAD", asOf: TODAY },
    ) || ""));
ok("a third-hand currency refuses",
  /third-hand|withheld/.test(
    conversionRefusal(
      {
        ...FIGURES.find((f) => f.id === "projul.core"),
        price: { kind: PRICE_AMOUNT, amount: 4788, per: "year", currency: "USD", currencySourcing: SOURCED_USER_REPORTS },
      },
      { to: "CAD", asOf: TODAY },
    ) || ""));
ok("an owner-asserted currency with no signed assertion refuses",
  /signed assertion|withheld/.test(
    conversionRefusal(
      {
        ...FIGURES.find((f) => f.id === "projul.core"),
        price: { kind: PRICE_AMOUNT, amount: 4788, per: "year", currency: "USD", currencySourcing: SOURCED_OWNER_ASSERTED },
      },
      { to: "CAD", asOf: TODAY },
    ) || ""));

// ══════════════════════════════════════════════════════════════════════════
console.log("\nA reported band never converts, because it never collapses");
// ServiceTitan's bands are third-hand, in a currency nobody established, and
// they are RANGES. Converting one would have to pick an end or a midpoint, and
// both are the mistake the Reported class exists to make impossible. The
// refusal is asserted here as well as there, because a range reaching an FX
// helper is exactly where somebody would reach for an average.
for (const r of allReportedCosts()) {
  const out = approximateInCurrency(r, { to: "CAD", asOf: TODAY });
  ok(`${r.id} does not convert`, out.approx === null, out.approx);
  ok(`...and the refusal says why`, typeof out.refusedBecause === "string" && out.refusedBecause.length > 10, out.refusedBecause);
}
// ServiceTitan's own on-request tiers have no number to convert either.
// ServiceTitan's own on-request tiers have no number to convert either, and
// the refusal is asserted VERBATIM. Mutation testing found the loose version
// of this: deleting the "only a published amount converts" gate changed
// nothing observable, because a price with no amount falls through to the next
// refusal anyway. Pinning the sentence is what makes that gate load-bearing.
for (const f of competitor("servicetitan").figures) {
  const out = approximateInCurrency(f, { to: "CAD", asOf: TODAY });
  ok(`${f.id} has no amount to convert`, out.approx === null);
  ok(`...refused as "not a published amount", by the gate that exists for it`,
    out.refusedBecause === "only a published amount converts, and this is not one", out.refusedBecause);
}
ok("a not-offered tier is refused by the same gate",
  approximateInCurrency(
    allFigures().find((f) => f.id === "jobber.plus.solo.annual"), { to: "CAD", asOf: TODAY }).refusedBecause ===
    "only a published amount converts, and this is not one");

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe rest of the refusals, exercised rather than described");
const good = FIGURES.find((f) => f.id === "housecall_pro.basic.annual");
ok("converting to the currency it is already in is refused",
  approximateInCurrency(good, { to: "USD", asOf: TODAY }).refusedBecause === "already in that currency");
ok("converting with no target currency is refused",
  approximateInCurrency(good, { asOf: TODAY }).approx === null);
ok("converting to a currency we hold no rate for is refused",
  /no rate for this pair/.test(approximateInCurrency(good, { to: "EUR", asOf: TODAY }).refusedBecause || ""));
ok("...and there is no FieldQuo price in that currency either, which is the real reason",
  !SUPPORTED_CURRENCIES.includes("EUR"));
ok("conversion refuses to guess what day it is",
  (() => { try { approximateInCurrency(good, { to: "CAD" }); return false; } catch { return true; } })());
ok("every call returns BOTH fields, so an ignored refusal still renders nothing",
  [good, SEAT_LADDER[0], allReportedCosts()[0]]
    .map((x) => approximateInCurrency(x, { to: "CAD", asOf: TODAY }))
    .every((r) => "approx" in r && "refusedBecause" in r && (r.approx === null) === (r.refusedBecause !== null)));
// The inverse direction, derived from the one recorded rate.
ok("the rate is found in the direction it is recorded", rateFor("USD", "CAD") === RATE);
ok("...and in reverse", rateFor("CAD", "USD") === RATE);
ok("...and not for a pair we hold nothing for", rateFor("USD", "EUR") === null);
{
  // A synthetic CAD-published competitor figure, to exercise the inverse arm.
  // No competitor publishes CAD today, so without this the branch never runs.
  const cadFigure = { ...good, price: { ...good.price, currency: "CAD" } };
  const back = approximateInCurrency(cadFigure, { to: "USD", asOf: TODAY });
  ok("a CAD figure converts to USD through the inverse rate", back.approx instanceof Approximate);
  ok("...saying the rate was applied in reverse", /applied in reverse/.test(back.approx.parts.rate), back.approx.parts.rate);
  ok("...and lands lower than it started, as an inverse must",
    Number(back.approx.parts.converted.match(/[\d,]+/)[0].replace(/,/g, "")) < good.price.amount);
}

// ══════════════════════════════════════════════════════════════════════════
// The one thing measured against the real clock, and it only WARNS.
//
// Assertions run on a fixed date so this check is reproducible. But a
// checked-in rate is only self-limiting if somebody hears about it before the
// conversions vanish, so the warning fires 15 days ahead of the window closing
// and every day after. Non-failing on purpose, same argument as
// STALE_AFTER_DAYS in competitors.js: a build that goes red on a calendar
// boundary gets bypassed rather than fixed, and the refusal in rateRefusal is
// what actually keeps an old rate off the page.
const REALLY_TODAY = new Date().toISOString().slice(0, 10);
for (const r of RATES) {
  const age = rateAgeDays(r, REALLY_TODAY);
  if (age === null) continue;
  if (age > RATE_STALE_AFTER_DAYS) {
    warn(`${r.base}/${r.quote} is ${age} days old and NO LONGER CONVERTS — re-read ${r.source} and update rate, rateDate, readOn and readBy in lib/marketing/fx.js`);
  } else if (age > RATE_STALE_AFTER_DAYS - 15) {
    warn(`${r.base}/${r.quote} is ${age} days old and stops converting in ${RATE_STALE_AFTER_DAYS - age} days — re-read ${r.source}`);
  }
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
