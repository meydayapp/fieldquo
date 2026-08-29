// scripts/check-cost-compare.mjs
//
//   npm run check:cost-compare
//
// /cost puts five real companies' prices in one table and tells a stranger
// which one is cheapest for him. That is a different kind of claim from
// anything else on the marketing site.
//
// ══ Why this page needs its own check ══════════════════════════════════════
//
// scripts/check-competitors.mjs guards the DATA — that every figure carries a
// source, a vantage point, a verification and a coordinate on every axis its
// competitor declares. All of that is true whether or not a renderer pays any
// attention. scripts/check-compare-pages.mjs guards /compare, which PRINTS
// those figures.
//
// This page does something neither of those does: it does ARITHMETIC on them,
// across five vendors who charge for five different things, and hands the
// answer to somebody about to spend money. Three ways that goes wrong and
// nobody notices:
//
//   1. THE UNITS COLLAPSE. ServiceTitan bills per technician, Jobber by a
//      team-size band, QuoteIQ per login, Projul not at all. A calculator that
//      maps one headcount onto all of them is comparing nothing and looks
//      rigorous while doing it. The whole argument of the page — twenty
//      technicians is twenty paid logins there and two seats here — is only
//      true if the mapping is right, and it is invisible in the output.
//
//   2. THE RANGE COLLAPSES. ServiceTitan publishes NO price. What exists is a
//      band contractors report, and one careless multiplication turns "buyers
//      say $245–$300 per technician" into "ServiceTitan costs $272". Reported
//      and ScaledBand both refuse to be numbers for that reason, and this file
//      exists partly to prove the refusal still bites after the arithmetic.
//
//   3. THE PAGE ONLY EVER WINS. QuoteIQ Essentials is $29.99 for one user
//      against our $99, and at a solo operator we lose — plainly, by three
//      times. A calculator that cannot produce that answer is an advertisement,
//      and the owner will meet the objection from a real prospect if he does
//      not meet it here. Section 6 asserts we LOSE, which is the strangest
//      looking assertion in this repository and the most important one on this
//      page.
//
// ══ What is executed, and what is only read ════════════════════════════════
//
// The maths is EXECUTED against real and hostile input, and the PAGE IS
// RENDERED — the real React component, through renderToStaticMarkup, with the
// real module behind it. Nothing below reads the component's source and infers
// behaviour from it. An agent working on this repo shipped 75 passing
// assertions over a page that ignored the function they tested; the split
// between CostCalculator (state, translation) and CostReport (every claim) is
// there so this file can drive the second one directly.
//
// The only things read as SOURCE are the two structural bans — no exchange-rate
// import, and no second copy of the seat rule — because those are assertions
// about what the file cannot contain rather than about what it does.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BASIS_CAPABILITY,
  BASIS_CHEAPEST,
  CAPABILITY_SET,
  COST_ASSUMPTIONS,
  COUNTING_RULES,
  CREW_CAPABILITY,
  GatedComparison,
  LADDER_CEILING,
  ROW_PRICED,
  ROW_REPORTED,
  SEAT_VS_CREW,
  ScaledBand,
  bandEndpoints,
  cheapestOf,
  compareCosts,
  countingRuleFor,
  fieldquoCost,
  savingAgainst,
  validateCostAssumptions,
  withoutAmounts,
} from "@/lib/marketing/costCompare";
import {
  COMPARABLE_FEATURES,
  COMPETITORS,
  FEATURE_INCLUDED,
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  PRICING_UNITS,
  UNIT_PER_TECHNICIAN,
  allFigures,
  publishableReportedCosts,
  withholdReason,
} from "@/lib/marketing/competitors";
import { SEAT_LADDER, isBillableSeat, tierFor } from "@/lib/pricing/ladder";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import CostReport, { CHEAPEST_INK, DEARER_INK } from "@/app/(marketing)/cost/CostReport";
import { redactAmounts } from "@/app/(marketing)/compare/[slug]/ComparisonPage";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const ASOF = "2026-08-29";
const render = (result) => renderToStaticMarkup(createElement(CostReport, { result }));
const at = (officeSeats, fieldCrew) => compareCosts({ officeSeats, fieldCrew }, { asOf: ASOF });

/** Rows for a basis, with both disclosures consumed first — which is the only
 *  way to get them, and section 8 is where that is proved. */
function rowsOf(result, basis) {
  const c = result.bases[basis];
  void c.crewCapability;
  void c.concessions;
  return c.rows;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. The table of numbers that are ours
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n1. Three numbers are ours, and each carries its reasoning");
// A share whose printed label says 30% and whose value is 0.25 is a lie that
// survives every review, because the label is what a reader checks and the
// value is what the total uses. Same trap with a bare count.
ok("the assumption table validates itself", validateCostAssumptions().length === 0,
  validateCostAssumptions().join("; "));
ok("...and there are exactly three of them", COST_ASSUMPTIONS.length === 3, COST_ASSUMPTIONS.length);
for (const row of COST_ASSUMPTIONS) {
  // An arithmetic row needs a sentence; a JUDGEMENT needs an argument, because
  // it is the kind somebody will want to move and the reasoning is the only
  // thing standing in the way.
  ok(`${row.key} says what it represents and why`,
    row.represents.length > 20 &&
      row.reasoning.length > (row.basis === "judgement" ? 200 : 20));
  ok(`${row.key}'s printed value matches its real one`, row.display === String(row.value));
}
// The point of the table is that a coefficient cannot hide inside a formula.
const moduleSource = readFileSync("lib/marketing/costCompare.js", "utf8");
const arithmeticBody = moduleSource.slice(moduleSource.indexOf("function annualFrom"));
ok("no bare multiplier appears in the arithmetic — every coefficient is A(\"…\")",
  !/[*/]\s*\d+(?!\d*\s*\})/.test(arithmeticBody.replace(/A\("[a-z_]+"\)/g, "K")),
  (arithmeticBody.replace(/A\("[a-z_]+"\)/g, "K").match(/[*/]\s*\d+/g) || []).join(","));

/* ═══════════════════════════════════════════════════════════════════════════
   2. Every unit is mapped, deliberately, and none is guessed
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n2. Five companies, five units, and a mapping for each");
// The unit vocabulary lives in competitors.js. A second copy beside the
// arithmetic is the copy that rots (AGENTS.md failure class 4), and it would
// rot into a false statement about somebody's price list.
// Read as source deliberately: this is an assertion about what the file CANNOT
// contain. `countsWhom` and the unit LABELS belong to competitors.js; a copy
// here would be the one that rots, into a false statement about a price list.
ok("the unit vocabulary is not restated here", !/countsWhom:/.test(moduleSource));
ok("...it is imported from competitors.js and read",
  /PRICING_UNITS/.test(moduleSource) && /PRICING_UNITS\[comp\.pricingUnit\]/.test(moduleSource));
ok("...and no unit label is typed beside the arithmetic",
  Object.values(PRICING_UNITS).every((u) => !moduleSource.includes(`"${u.label}"`)));
for (const comp of COMPETITORS) {
  ok(`${comp.name} declares a pricing unit`, Boolean(PRICING_UNITS[comp.pricingUnit]), comp.pricingUnit);
  ok(`...and this page knows how to count for it`, countingRuleFor(comp.pricingUnit) !== null);
  ok(`...and its unit carries the caveat that has to travel with a headcount`,
    (PRICING_UNITS[comp.pricingUnit]?.caveat || "").length > 60);
}
// The four counting rules must be genuinely different functions of the two
// answers, or the page is asking two questions and using one.
const probe = { officeSeats: 3, fieldCrew: 17, total: 20 };
ok("per-technician counts the field only", COUNTING_RULES.crew.count(probe) === 17);
ok("per-login counts everybody", COUNTING_RULES.seats_and_crew_together.count(probe) === 20);
ok("a flat fee counts nobody", COUNTING_RULES.none.count(probe) === 0);
ok("FieldQuo counts the people who originate money", COUNTING_RULES.self.count(probe) === 3);

/* ═══════════════════════════════════════════════════════════════════════════
   3. Our own price comes from the product's rule, not a second copy of it
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n3. A seat is whatever isBillableSeat says a seat is");
// A marketing page with its own simpler definition of a seat quotes a price the
// product does not charge — the same failure as retyping 99 into a template,
// one level of indirection up. So the roster is built and COUNTED.
const crewMember = { role: "employee", permissions: PERMISSION_PRESETS.worker.values, active: true };
ok("the crew preset is free under the product's own rule", isBillableSeat(crewMember) === false);
ok("...and an admin is not", isBillableSeat({ role: "admin", permissions: null }) === true);
for (const [seats, crew] of [[1, 0], [2, 6], [3, 15], [10, 15], [0, 0]]) {
  const q = fieldquoCost({ officeSeats: seats, fieldCrew: crew });
  ok(`${seats} office + ${crew} field counts as ${seats} seats`, q.countedSeats === seats, q.countedSeats);
  ok(`...and ${crew} crew`, q.countedCrew === crew, q.countedCrew);
  const tier = tierFor({ seats, crew });
  ok(`...and lands on the tier the ladder itself picks`,
    q.tierKey === (tier ? tier.tierKey : null), q.tierKey);
  if (tier) {
    // Not retyped. A repricing in ladder.js has to move this page on its own.
    ok(`...priced at SEAT_LADDER's own ${tier.price}`, q.monthly === tier.price, q.monthly);
    ok(`...and a year is twelve of them, not the committed ten`,
      q.annualAtMonthly === tier.price * 12 && q.annualCommitted < q.annualAtMonthly);
  }
}
// ── And the count is PRODUCED by that rule, not merely equal to it ────────
//
// Read as source, deliberately, and this is the assertion mutation testing
// forced. Replacing countSeats(roster) with the visitor's own two numbers
// passes every behavioural check above, because the two agree by construction
// today: an admin is always billable and the Crew preset never is. They would
// stop agreeing the moment isBillableSeat changed — which is the whole reason
// the page defers to it — and by then a marketing page quoting a tier the
// product does not charge for is exactly the failure nobody would notice.
// There is no input that can separate the two from outside, so the guarantee
// is asserted where it lives.
ok("fieldquoCost builds a roster and counts it with the product's own function",
  /const counted = countSeats\(roster\);/.test(moduleSource));
ok("...and never assigns the visitor's numbers straight into the count",
  !/counted\s*=\s*\{\s*seats:\s*officeSeats/.test(moduleSource));
ok("...seating admins for the office half", /role: "admin"/.test(moduleSource));
ok("...and the real Crew preset grid for the field half",
  /CREW_PRESET\.values/.test(moduleSource));
ok("...and the tier comes from tierFor, not from a table here",
  /tierFor\(\{ seats: counted\.seats, crew: counted\.crew \}\)/.test(moduleSource));

// A roster that fits no rung is a conversation, not the top tier. The ladder's
// own comment: seating twelve people on a plan for ten bills them for ten and
// locks two out.
ok("a business past the ladder gets no price at all",
  fieldquoCost({ officeSeats: 2, fieldCrew: 20 }).fits === false);
ok("...and the ceiling it names is read off SEAT_LADDER",
  LADDER_CEILING.crew === Math.max(...SEAT_LADDER.map((t) => t.crewSeats)));

/* ═══════════════════════════════════════════════════════════════════════════
   4. The twenty-technician case the owner described
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n4. Twenty technicians: the comparison this page was asked for");
const twenty = at(2, 20);
const twentyRows = rowsOf(twenty, BASIS_CHEAPEST);
const st = twentyRows.find((r) => r.key === "servicetitan");

ok("ServiceTitan is priced from what buyers report, not from a published price",
  st.status === ROW_REPORTED, st.status);
ok("...counting the twenty in the field, not the twenty-two people",
  st.countedHere === 20, st.countedHere);
// The band scaled by twenty. Endpoints checked against the source band so a
// silent change of tier or of arithmetic is caught, not just "some band".
const starter = publishableReportedCosts(ASOF).find((r) => r.id === "servicetitan.reported.starter");
const perTech = bandEndpoints(starter.price.band);
const impl = bandEndpoints(starter.alsoReported);
const expectedOngoing = { low: perTech.low * 20 * 12, high: perTech.high * 20 * 12 };
ok("...the ongoing year is the reported band times twenty technicians times twelve",
  String(st.ongoingBand).includes(expectedOngoing.low.toLocaleString("en-CA")) &&
    String(st.ongoingBand).includes(expectedOngoing.high.toLocaleString("en-CA")),
  String(st.ongoingBand));
// The implementation fee is in the total. A monthly figure that ignores a
// $15,000 setup fee is not the cost.
ok("...and the first year adds the reported implementation fee on top",
  String(st.band).includes((expectedOngoing.low + impl.low).toLocaleString("en-CA")) &&
    String(st.band).includes((expectedOngoing.high + impl.high).toLocaleString("en-CA")),
  String(st.band));
ok("...the first year is dearer than the year after it", String(st.band) !== String(st.ongoingBand));
ok("...and it says out loud that the fee is in there",
  /implementation fee/i.test(String(st.band)));
// Every structural term travels with the figure. These are the part a reader
// can test in one sales call instead of taking our word for a number.
for (const term of COMPETITORS.find((c) => c.id === "servicetitan").reportedTerms) {
  ok(`...carries the reported term "${term.id.split(".").pop()}"`,
    st.caveats.some((c) => c.includes(term.statement)));
}
ok("...and says the figures are reported rather than published",
  st.caveats.some((c) => /reported/i.test(c) && /not published by ServiceTitan/i.test(c)));

// And the half of this the owner has not seen: at twenty technicians our own
// ladder has no price. Twenty crew is past Scale's fifteen.
ok("FieldQuo has NO published price for twenty in the field", twenty.fieldquo.fits === false);
ok("...so no saving is computed against a plan we do not sell",
  savingAgainst(st, twenty.fieldquo.annualAtMonthly) === null);
const twentyHtml = render(twenty);
ok("...and the page says so rather than showing a figure",
  /data-cost-row="fieldquo"[^>]*data-cost-status="not_established"/.test(twentyHtml));
ok("...naming the ceiling it read off the ladder",
  twentyHtml.includes(`${LADDER_CEILING.people} people in total`), "ceiling sentence missing");

/* ═══════════════════════════════════════════════════════════════════════════
   5. A reported band never becomes one number
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n5. The band stays a band, through every layer");
ok("ScaledBand refuses to be a number", (() => {
  try { Number(st.band); return false; } catch { return true; }
})());
ok("...so it cannot be averaged", (() => {
  try { return Number.isNaN((st.band + 0) / 2); } catch { return true; }
})());
ok("...or compared", (() => {
  try { void (st.band < 5); return false; } catch { return true; }
})());
ok("...and rendering it always carries both ends", /\$[\d,]+–\$[\d,]+/.test(String(st.band)));
ok("...and always carries the label saying who said it",
  /Contractors report paying/.test(String(st.band)));
// A band with equal ends is a number wearing a range's clothes.
ok("a band cannot be constructed with one end", (() => {
  try { new ScaledBand({ low: 5, high: 5 }); return false; } catch { return true; }
})());
ok("...and scaling by zero returns nothing rather than a point",
  new ScaledBand({ low: 1, high: 2 }).times(0) === null);
// The page. A rendered band must never appear as a lone figure in a
// data-annual attribute, which is what the sortable/colourable figures use.
ok("no reported row is rendered as a sortable single figure",
  !/data-cost-status="reported"[\s\S]{0,3000}?data-annual=/.test(twentyHtml));
ok("...it is rendered through data-band, whole", /data-band="[^"]*–[^"]*"/.test(twentyHtml));
// The saving against a band is a band too, and never wider than it.
const sixSaving = savingAgainst(rowsOf(at(2, 6), BASIS_CHEAPEST).find((r) => r.key === "servicetitan"),
  at(2, 6).fieldquo.annualAtMonthly);
ok("a saving against a band is itself a band", sixSaving.band?.isBand === true);
ok("...and there is no single-number saving beside it", sixSaving.fixed === null);
// A band that straddles our price has no winner, and saying it does is the
// midpoint mistake with an extra step.
const straddle = new ScaledBand({ low: 100, high: 300 });
ok("a straddling band is 'overlapping', not a win", straddle.compareToFixed(200) === "overlapping");
ok("...below is below", straddle.compareToFixed(50) === "below");
ok("...above is above", straddle.compareToFixed(400) === "above");
// The endpoint parser is the one place a band's numbers exist loose. It must
// refuse rather than improvise.
ok("an unparseable band yields nothing, not one end", bandEndpoints({ isReported: true, toString: () => "about $300" }) === null);
ok("...and a non-Reported yields nothing", bandEndpoints({ toString: () => "$1–$2" }) === null);
ok("...and a reversed band yields nothing", bandEndpoints({ isReported: true, toString: () => "$9–$2" }) === null);

/* ═══════════════════════════════════════════════════════════════════════════
   6. Where we lose, and the page says so
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n6. A solo operator: somebody is cheaper than we are, and we say it");
const solo = at(1, 0);
const soloRows = rowsOf(solo, BASIS_CHEAPEST);
const soloCheapest = cheapestOf(soloRows, solo.fieldquo);

ok("FieldQuo is priced at a solo operator", solo.fieldquo.fits === true);
// The assertion this whole file exists to make possible. If it ever fails
// because the answer flipped, that is a real finding and not a broken test.
ok("...and FieldQuo is NOT the cheapest", soloCheapest.key !== "fieldquo", soloCheapest.key);
ok("...a real competitor is", soloCheapest.competitorsRanked > 0, soloCheapest.competitorsRanked);
const soloLoss = soloRows
  .map((r) => savingAgainst(r, solo.fieldquo.annualAtMonthly))
  .filter((s) => s && s.direction === "competitor");
ok("...at least one row comes out in their favour", soloLoss.length > 0, soloLoss.length);

const soloHtml = render(solo);
ok("...and the page prints that verdict in words",
  /data-verdict-direction="competitor"/.test(soloHtml));
ok("...saying they are the better buy if that is all you need",
  /better buy/.test(soloHtml));
ok("...with the cheapest row marked cheapest and not us",
  /data-cost-row="(?!fieldquo)[a-z_]+"[^>]*data-cost-cheapest="true"/.test(soloHtml));
ok("...and our own row marked dearer",
  /data-cost-row="fieldquo"[^>]*data-cost-cheapest="false"/.test(soloHtml));
// The concession is structural, not prose: competitors.js records a cheaper
// entry price as a capability we LACK, so it cannot be quietly dropped.
ok("the cheaper entry price is a capability we concede in the ledger",
  FIELDQUO_LACKS.includes("entry_price_below_our_floor"));
ok("...and it renders on the page", /data-lacks="entry_price_below_our_floor"/.test(soloHtml));

/* ═══════════════════════════════════════════════════════════════════════════
   7. Capability, not table position
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n7. Tiers are matched on what they contain");
// The owner's correction: "quoteIQ starter package doesn't have the features.
// its not just the price." Matching cheapest-to-cheapest compares a four
// feature product with a nine feature one and calls it a price difference.
const eight = at(2, 6);
const capRows = rowsOf(eight, BASIS_CAPABILITY);
const cheapRows = rowsOf(eight, BASIS_CHEAPEST);
const capJobber = capRows.find((r) => r.key === "jobber");
const cheapJobber = cheapRows.find((r) => r.key === "jobber");

// Derived, not typed: a capability added to COMPARABLE_FEATURES widens this
// comparison on its own, and one removed narrows it.
ok("the capability set is drawn from COMPARABLE_FEATURES",
  CAPABILITY_SET.length === Object.keys(COMPARABLE_FEATURES).length && CAPABILITY_SET.length > 0,
  CAPABILITY_SET.length);
ok("...and every member names a feature that module knows about",
  CAPABILITY_SET.every((c) => COMPARABLE_FEATURES[c.key]?.label === c.label));
// Their feature PROSE is never text-matched into our vocabulary. Renaming a
// competitor's feature is how a comparison quietly becomes a straw man, which
// is why competitors.js keeps those lists in their words.
ok("...and no tier is matched by reading their prose feature lists",
  !/includedFeatures|addsOverPreviousTier/.test(
    moduleSource.slice(moduleSource.indexOf("function carriesCapabilities")),
  ));
ok("the two bases can disagree about which of their tiers applies",
  capJobber.tier.id !== cheapJobber.tier.id, `${capJobber.tier.id} vs ${cheapJobber.tier.id}`);
ok("...and the capability-matched one is the dearer of the two",
  capJobber.annualFirstYear > cheapJobber.annualFirstYear);
// The rule: every figure used on the capability basis actually carries every
// capability, established as INCLUDED. FEATURE_UNKNOWN never counts.
for (const row of capRows.filter((r) => r.status === ROW_PRICED)) {
  const figure = allFigures().find((f) => f.id === row.tier.id);
  ok(`${row.name} ${row.tier.label} really carries every capability`,
    CAPABILITY_SET.every((c) => figure.features?.[c.key] === FEATURE_INCLUDED));
}
// An uninspected tier is not a cheaper tier. Where nobody established it, the
// row says so rather than crediting or denying them a feature.
const capUnknown = capRows.filter((r) => r.status !== ROW_PRICED && r.status !== ROW_REPORTED);
ok("...and every unmatched row carries a reason instead of a blank",
  capUnknown.every((r) => typeof r.reason === "string" && r.reason.length > 40));
const eightHtml = render(eight);
ok("...which the page prints", (eightHtml.match(/data-cost-reason="true"/g) || []).length >= capUnknown.length);
ok("both bases are rendered, so neither half of the argument can be shown alone",
  /data-cost-basis="capability_matched"/.test(eightHtml) &&
    /data-cost-basis="cheapest_published"/.test(eightHtml));
// A basis where nobody else could be priced is a walkover, and announcing a
// win on one would be the most flattering thing this page could do.
const soloCap = cheapestOf(rowsOf(solo, BASIS_CAPABILITY), solo.fieldquo);
if (soloCap && soloCap.competitorsRanked === 0) {
  ok("a basis with no rivals priced says so rather than declaring a win",
    /no comparison to draw here/.test(soloHtml));
} else {
  ok("a basis with rivals priced draws the comparison", soloCap.competitorsRanked > 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The crew caveat cannot be omitted
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n8. A headcount comparison cannot be rendered without its caveat");
// "Twenty technicians costs $6,000 a month there and $369 here" is true and
// incomplete. Our crew cannot write a quote. competitors.js records
// free_crew_seats and field_worker_quotes as a deliberate PAIR, and this is
// the renderer refusing to take the first without the second.
const bare = new GatedComparison({ rows: [{ key: "x" }], crewCapability: CREW_CAPABILITY, concessions: [] });
let threw = null;
try { void bare.rows; } catch (e) { threw = e.message; }
ok("reading rows before either disclosure throws", threw !== null);
ok("...and the message names both", /crewCapability/.test(threw) && /concessions/.test(threw), threw);
const half = new GatedComparison({ rows: [{ key: "x" }], crewCapability: CREW_CAPABILITY, concessions: [] });
void half.crewCapability;
let threwHalf = null;
try { void half.rows; } catch (e) { threwHalf = e.message; }
ok("...reading only the crew caveat is still not enough", threwHalf !== null);
const full = new GatedComparison({ rows: [{ key: "x" }], crewCapability: CREW_CAPABILITY, concessions: [] });
void full.crewCapability;
void full.concessions;
ok("...and both together open it", full.rows.length === 1);
ok("the row count is readable without the gate, so an empty section can be skipped",
  bare.count === 1);

// Both halves of the caveat are read out of the capability ledger rather than
// written in the calculator, so the day the preset changes the page moves.
ok("the caveat's advantage half is the ledger's own label",
  CREW_CAPABILITY.advantage === FIELDQUO_CAPABILITIES.free_crew_seats.label);
ok("...and its limit half is the ledger's own label",
  CREW_CAPABILITY.limit === FIELDQUO_CAPABILITIES.field_worker_quotes.label);
ok("...and what crew CAN do is the permission preset's own sentence",
  CREW_CAPABILITY.can === PERMISSION_PRESETS.worker.description);
ok("...which says in those words that they get no prices or quotes",
  /No prices, quotes, invoices or requests/.test(CREW_CAPABILITY.can));

// And on the page itself, once per basis, beside the rows.
for (const basis of [BASIS_CAPABILITY, BASIS_CHEAPEST]) {
  ok(`the crew caveat renders on the ${basis} table`,
    eightHtml.includes(`data-crew-caveat="${basis}"`));
  ok(`...and so do the things we do not do`, eightHtml.includes(`data-concessions="${basis}"`));
}
for (const capability of FIELDQUO_LACKS) {
  ok(`the concession "${capability}" is on the page`,
    eightHtml.includes(`data-lacks="${capability}"`));
}
// The unit's own caveat travels on every row, priced or not — it is the
// sentence that keeps a headcount comparison honest.
for (const row of cheapRows) {
  ok(`${row.name}'s row carries its unit caveat`,
    eightHtml.includes(`data-cost-unit-caveat="${row.key}"`));
}
ok("the seat-and-crew explainer exists and says what a crew member cannot do",
  /cannot price a job/.test(SEAT_VS_CREW.body) && SEAT_VS_CREW.body.length > 500);

/* ═══════════════════════════════════════════════════════════════════════════
   9. Nothing is printed that the data module refuses
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n9. Every figure on the page is one competitors.js allows");
for (const shape of [[1, 0], [1, 2], [2, 6], [3, 15], [2, 20], [0, 0], [10, 15]]) {
  const r = at(shape[0], shape[1]);
  for (const basis of [BASIS_CAPABILITY, BASIS_CHEAPEST]) {
    for (const row of rowsOf(r, basis)) {
      if (row.status !== ROW_PRICED) continue;
      const figure = allFigures().find((f) => f.id === row.tier.id);
      ok(`${shape}/${basis}: ${row.tier.id} is publishable`,
        withholdReason(figure, ASOF) === null, withholdReason(figure, ASOF));
      // Never a promotional price against a regular one.
      ok(`...and the amount is their REGULAR one, not a promotion`,
        row.annualFirstYear === (figure.price.per === "year" ? figure.price.amount : figure.price.amount * 12));
    }
  }
}
// A withheld figure shows its reason — and the reason must not quote the
// amount it is refusing. "the relationship between the $49/mo regular rate…"
// publishes $49 on a page whose whole argument is that we do not know what $49
// means.
const soloJobber = soloRows.find((r) => r.key === "jobber");
ok("a withheld figure renders its reason", typeof soloJobber.reason === "string" && soloJobber.reason.length > 40);
ok("...with the amount taken out of it", !/\$\s?\d/.test(soloJobber.reason), soloJobber.reason);
ok("...and the page prints it", soloHtml.includes("data-cost-reason=\"true\""));
// The redaction rule is deliberately the same as /compare's, and this binds
// the copy to the original rather than trusting them to stay in step.
for (const figure of allFigures()) {
  const reason = withholdReason(figure, ASOF);
  if (!reason) continue;
  ok(`redaction agrees with /compare on ${figure.id}`,
    withoutAmounts(reason) === redactAmounts(reason));
}
// No amount of a withheld figure may reach the DOM through any path.
const jobberWithheld = allFigures().filter(
  (f) => f.competitorId === "jobber" && withholdReason(f, ASOF) && f.price?.amount,
);
ok("Jobber has withheld figures with real amounts in them", jobberWithheld.length > 0);
for (const f of jobberWithheld) {
  const inSolo = soloRows.some((r) => r.tier?.id === f.id);
  ok(`...and ${f.id} is not the tier any row was priced from`, inSolo === false);
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. No conversion, and least of all of ours
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n10. Nothing on this page has been through an exchange rate");
// fx.js exists and is correct; the guarantee here is that this page never
// reaches it. SEAT_LADDER carries the same NUMBER in CAD and USD by design, so
// running our ladder through a rate would print a price we do not charge.
// Matched on the IMPORT, not on the words: the header of costCompare.js says
// "does not import lib/marketing/fx.js" in prose, and an assertion that a
// filename never appears would be satisfied by deleting the explanation.
const importsFx = (src) => /from\s+["']@?\/?(lib\/)?marketing\/fx["']/.test(src);
ok("costCompare.js does not import fx.js", !importsFx(moduleSource));
const reportSource = readFileSync("app/(marketing)/cost/CostReport.js", "utf8");
const calcSource = readFileSync("app/(marketing)/cost/CostCalculator.js", "utf8");
ok("...and neither does the report", !importsFx(reportSource));
ok("...nor the calculator", !importsFx(calcSource));
ok("...and no approximation mark reaches the page", !eightHtml.includes("≈"));
// Our own figure is SEAT_LADDER's number, untouched.
for (const tier of SEAT_LADDER) {
  const q = fieldquoCost({ officeSeats: tier.seats, fieldCrew: tier.crewSeats });
  ok(`${tier.label} renders at exactly ${tier.price}`, q.monthly === tier.price, q.monthly);
}
ok("every competitor figure keeps the currency it was published in",
  cheapRows.filter((r) => r.status === ROW_PRICED).every((r) => {
    const figure = allFigures().find((f) => f.id === r.tier.id);
    return r.currency === figure.price.currency;
  }));
ok("...and the page prints that currency beside the amount",
  /\$[\d,.]+ USD/.test(eightHtml));

/* ═══════════════════════════════════════════════════════════════════════════
   11. Hostile input produces no figure rather than a wrong one
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n11. Nothing a stranger can type produces a NaN or a negative");
const hostile = [
  {}, null, undefined, { officeSeats: "", fieldCrew: "" },
  { officeSeats: "abc", fieldCrew: "2" }, { officeSeats: true, fieldCrew: {} },
  { officeSeats: "-1", fieldCrew: "3" }, { officeSeats: "1e9", fieldCrew: "2" },
  { officeSeats: "2.7", fieldCrew: "3.2" }, { officeSeats: "0", fieldCrew: "0" },
  { officeSeats: "500", fieldCrew: "2000" }, { officeSeats: "501", fieldCrew: "0" },
  { officeSeats: "Infinity", fieldCrew: "1" }, { officeSeats: "NaN", fieldCrew: "1" },
];
let hostileProblems = 0;
for (const input of hostile) {
  let r;
  try { r = compareCosts(input, { asOf: ASOF }); } catch { hostileProblems += 1; continue; }
  if (!r.ready) {
    // Absence is refused, not defaulted. A blank must not become a zero.
    if (r.missing.length === 0 && r.outOfRange.length === 0) hostileProblems += 1;
    continue;
  }
  for (const basis of [BASIS_CAPABILITY, BASIS_CHEAPEST]) {
    for (const row of rowsOf(r, basis)) {
      if (row.status === ROW_PRICED && !(Number.isFinite(row.annualFirstYear) && row.annualFirstYear > 0)) {
        hostileProblems += 1;
      }
      if (row.status !== ROW_PRICED && row.status !== ROW_REPORTED && !row.reason) hostileProblems += 1;
      const s = savingAgainst(row, r.fieldquo.annualAtMonthly);
      if (s && s.fixed !== null && !(Number.isFinite(s.fixed) && s.fixed >= 0)) hostileProblems += 1;
    }
  }
}
ok("every hostile input either refuses or produces sound figures", hostileProblems === 0, hostileProblems);
ok("a fractional headcount rounds down rather than inventing a person",
  compareCosts({ officeSeats: "2.9", fieldCrew: "0" }, { asOf: ASOF }).people.officeSeats === 2);
ok("an out-of-range answer is REFUSED, not clamped",
  compareCosts({ officeSeats: "501", fieldCrew: "0" }, { asOf: ASOF }).outOfRange.includes("officeSeats"));
ok("...and a blank is missing, not zero",
  compareCosts({ officeSeats: "", fieldCrew: "3" }, { asOf: ASOF }).missing.includes("officeSeats"));
ok("compareCosts refuses to guess what day it is", (() => {
  try { compareCosts({ officeSeats: 1, fieldCrew: 1 }); return false; } catch { return true; }
})());

// A saving is never larger than the larger of the two figures, over the whole
// grid a real business could be.
let savingProblems = 0;
for (let seats = 0; seats <= 12; seats += 1) {
  for (let crew = 0; crew <= 20; crew += 1) {
    const r = at(seats, crew);
    if (!r.fieldquo.fits) continue;
    for (const row of rowsOf(r, BASIS_CHEAPEST)) {
      const s = savingAgainst(row, r.fieldquo.annualAtMonthly);
      if (!s || s.fixed === null) continue;
      const larger = Math.max(row.annualFirstYear ?? 0, r.fieldquo.annualAtMonthly);
      if (!(s.fixed >= 0 && s.fixed <= larger)) savingProblems += 1;
      if (!Number.isFinite(s.fixedMonthly) || s.fixedMonthly < 0) savingProblems += 1;
    }
  }
}
ok("across 273 shapes of business, no saving exceeds the larger figure", savingProblems === 0, savingProblems);
ok("...and a plan we do not sell produces no saving at all",
  savingAgainst({ status: ROW_PRICED, annualFirstYear: 5000 }, 0) === null);

/* ═══════════════════════════════════════════════════════════════════════════
   12. The reported minimum, which is part of what a small shop pays
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n12. A reported technician minimum is billed, not ignored");
const stEntry = publishableReportedCosts(ASOF).find((r) => r.competitorId === "servicetitan" && r.minimumTechnicians);
if (stEntry) {
  const min = bandEndpoints(stEntry.minimumTechnicians);
  const twoVans = rowsOf(at(1, 2), BASIS_CHEAPEST).find((r) => r.key === "servicetitan");
  const many = rowsOf(at(1, 20), BASIS_CHEAPEST).find((r) => r.key === "servicetitan");
  // Below the minimum, the minimum IS the entry price. Multiplying by two
  // would understate what a two-van shop is actually quoted.
  const floor = perTech.low * min.low * 12 + impl.low;
  ok("a two-technician shop is billed at their reported minimum",
    String(twoVans.band).includes(floor.toLocaleString("en-CA")), String(twoVans.band));
  ok("...and the row says the minimum is why", twoVans.caveats.some((c) => /minimum/i.test(c)));
  ok("...while a twenty-technician shop is billed at twenty",
    !many.caveats.some((c) => /billed at that minimum/i.test(c)));
  // The minimum is itself a band, so the count it produces is a band, and the
  // midpoint of a minimum is as invented as the midpoint of a price.
  ok("...and the uncertain minimum widens the figure rather than picking a number",
    String(twoVans.band).includes((perTech.high * min.high * 12 + impl.high).toLocaleString("en-CA")),
    String(twoVans.band));
} else {
  ok("no reported minimum is recorded, so none is invented",
    !/minimum/i.test(String(rowsOf(at(1, 2), BASIS_CHEAPEST).find((r) => r.key === "servicetitan").band)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   13. Terms, colour and the things a reader is owed
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n13. The colours are measured, and never carry a meaning alone");
// AGENTS.md failure class 6: contrast assumed rather than measured. The tokens
// are read out of globals.css so a theme change is caught here rather than by
// somebody squinting at a screenshot.
const css = readFileSync("app/globals.css", "utf8");
const token = (name, from) => {
  const scope = from === "dark" ? css.slice(css.indexOf(".dark {")) : css.slice(0, css.indexOf(".dark {"));
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(scope);
  return m ? m[1] : null;
};
const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};
const SHADES = {
  "emerald-700": "#047857", "emerald-400": "#34d399",
  "red-700": "#b91c1c", "red-400": "#f87171",
};
// The pairs the component actually uses, parsed out of it rather than retyped.
const inkPairs = [
  ["cheapest", CHEAPEST_INK, "emerald"],
  ["dearer", DEARER_INK, "red"],
];
for (const [name, classes, family] of inkPairs) {
  const light = /^text-([a-z]+-\d+)/.exec(classes)?.[1];
  const dark = /dark:text-([a-z]+-\d+)/.exec(classes)?.[1];
  ok(`the ${name} colour is a light/dark PAIR, because no single shade clears both`,
    Boolean(light && dark) && light !== dark, classes);
  ok(`...and both are ${family}`, Boolean(light?.startsWith(family) && dark?.startsWith(family)));
  for (const [scope, shade] of [["light", light], ["dark", dark]]) {
    // An unmeasured shade is a failure, not a crash. A single-shade class list
    // leaves `dark` undefined, and this is the assertion that has to say so.
    if (!shade || !SHADES[shade]) {
      ok(`...${scope} shade for ${name} is one this file has measured`, false, String(shade));
      continue;
    }
    for (const bg of ["card", "muted"]) {
      const r = ratio(SHADES[shade], token(bg, scope));
      ok(`...${shade} on the ${scope} --${bg} is ${r.toFixed(2)}:1`, r >= 4.5, r.toFixed(2));
    }
  }
}
// A red number and a green number are the same number to somebody who cannot
// tell them apart.
ok("cheapest is also said in a word, not only in a colour", /cheapest<\/span>/.test(eightHtml));
ok("...and so is dearer", /dearer<\/span>/.test(eightHtml));

console.log("\n14. What the page owes a reader beside every figure");
ok("every priced row names where and when it was read",
  cheapRows.filter((r) => r.status === ROW_PRICED).every((r) => /Read from a \w+ connection on \d{4}-\d{2}-\d{2}/.test(r.provenance)));
ok("...and links their own page", cheapRows.filter((r) => r.status === ROW_PRICED).every((r) => Boolean(r.source)));
ok("the reported row names its provenance instead", /reported by buyers/i.test(st.provenance), st.provenance);
// Jobber is a Canadian company read from a US connection, and Canada is most of
// who FieldQuo competes for.
const jobberRow = cheapRows.find((r) => r.key === "jobber");
ok("Jobber's vantage-point caveat travels with its figure", Boolean(jobberRow.geoCaveat));
ok("...and renders", eightHtml.includes('data-cost-geo-caveat="jobber"'));
// A competitor shown at their committed rate against our uncommitted one is
// being shown at their best price. That leans against us, and it is said.
const committed = cheapRows.filter(
  (r) => r.status === ROW_PRICED && r.coordinate.includes("Annual"),
);
ok("a competitor shown at a committed rate says so", committed.length > 0 &&
  committed.every((r) => r.caveats.some((c) => /their discount for committing/.test(c))),
  committed.map((r) => r.key).join(","));
ok("the page states the date it speaks as of", eightHtml.includes(`data-as-of="${ASOF}"`));
ok("...and that our own price is not a conversion",
  /not a conversion of the other/.test(eightHtml));
ok("...and prints the counting table so the mapping is visible",
  Object.values(COUNTING_RULES).every((r) => eightHtml.includes(r.mapsTo)));
ok("...and the three assumptions",
  COST_ASSUMPTIONS.every((a) => eightHtml.includes(`data-assumption="${a.key}"`)));

/* ═══════════════════════════════════════════════════════════════════════════
   15. Every competitor appears, whatever we know about them
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n15. Nobody is silently missing");
// An absent row on a comparison page reads as an admission we could not beat
// them. Every competitor in the data gets a row on every basis, priced or with
// the reason it is not.
for (const basis of [BASIS_CAPABILITY, BASIS_CHEAPEST]) {
  const rows = rowsOf(eight, basis);
  ok(`${basis} has a row for every competitor in the data`,
    rows.length === COMPETITORS.length, `${rows.length} vs ${COMPETITORS.length}`);
  for (const comp of COMPETITORS) {
    const row = rows.find((r) => r.key === comp.id);
    ok(`...${comp.name} is on it`, Boolean(row));
    ok(`...with either a figure or a reason`,
      row.status === ROW_PRICED || row.status === ROW_REPORTED
        ? true
        : typeof row.reason === "string" && row.reason.length > 40);
    ok(`...and renders`, eightHtml.includes(`data-cost-row="${comp.id}"`));
  }
}
// The technician mapping is the strongest true claim on the page, so it is
// asserted by name rather than left to the loop above.
ok("exactly one competitor prices per technician, and it counts the field only",
  COMPETITORS.filter((c) => c.pricingUnit === UNIT_PER_TECHNICIAN).length === 1 &&
    PRICING_UNITS[UNIT_PER_TECHNICIAN].mapsTo === "crew");

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
