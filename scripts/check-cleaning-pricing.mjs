// scripts/check-cleaning-pricing.mjs
//
//   npm run check:cleaning
//
// The cleaning pricing engine, executed.
//
// It exists because the cleaning intake form asked five questions and priced
// from NONE of them — bedrooms, bathrooms and isFirstClean were read by nothing
// at all. The "was collected and IGNORED" assertions below are the regression
// guard for exactly that: each one proves a field the form asks for actually
// moves the number.
//
// The benchmark assertion pins a 2,000 sqft / 3 bed / 2 bath standard clean
// inside the $200-$400 per-visit band the trade publishes. If the rate card
// drifts out of that, the defaults have stopped being a sane starting point.
//
// The ordering assertions matter commercially rather than arithmetically:
//   * commit to more visits, pay less PER visit
//   * the FIRST visit of a recurring plan costs more than a one-off, because
//     the house has never been done to standard — that surcharge is what lets
//     the ongoing price stay low, which is what wins the contract
//   * a multiplier hits the WORK, not the flat add-ons: a deep clean must not
//     charge 1.6x for a load of laundry

import { priceCleaning, priceCleaningHourly, normaliseCleaningRates, cleaningLineItems,
         DEFAULT_CLEANING_RATES, CLEANING_ADDONS } from "@/lib/cleaning/pricing";
let fail=0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};
const $ = c => `$${(c/100).toFixed(2)}`;

// ── The benchmark HCP publishes: a 2,000 sqft standard clean ────────────
const std = priceCleaning({ squareFootage:2000, bedrooms:3, bathrooms:2, frequency:"one_time" });
ok(std.total >= 20000 && std.total <= 40000,
   `2,000 sqft / 3 bed / 2 bath standard = ${$(std.total)} — inside the $200–$400 per-visit band`);

// ── Every field now MOVES the price. This is the bug being fixed. ───────
const base = { squareFootage:2000, bedrooms:3, bathrooms:2, frequency:"one_time" };
const moves = (patch, label) => {
  const a = priceCleaning(base).total, b = priceCleaning({ ...base, ...patch }).total;
  ok(a !== b, `${label}: ${$(a)} → ${$(b)}`);
};
moves({ bathrooms:4 }, "two more bathrooms changes the price (was collected and IGNORED)");
moves({ bedrooms:5 }, "two more bedrooms changes the price (was collected and IGNORED)");
moves({ frequency:"weekly" }, "weekly changes the price (was collected and IGNORED)");
moves({ pets:2 }, "two pets changes the price (was never even asked)");
moves({ cleaningType:"deep" }, "a deep clean changes the price (was never asked)");
moves({ condition:"neglected" }, "condition changes the price (was never asked)");
moves({ addOns:["inside_oven","interior_windows"] }, "add-ons change the price (were never asked)");

// ── Direction and ordering ──────────────────────────────────────────────
const weekly = priceCleaning({ ...base, frequency:"weekly" }).total;
const monthly = priceCleaning({ ...base, frequency:"monthly" }).total;
const once = priceCleaning({ ...base, frequency:"one_time" }).total;
ok(weekly < monthly && monthly < once,
   `commit more, pay less per visit: weekly ${$(weekly)} < monthly ${$(monthly)} < one-off ${$(once)}`);

const first = priceCleaning({ ...base, frequency:"weekly", isFirstClean:true }).total;
ok(first > weekly, `the FIRST weekly visit costs more (${$(first)}) than the ongoing ones (${$(weekly)})`);
ok(first > once, "…and more than a one-off, because the house has never been done to standard");

const deep = priceCleaning({ ...base, cleaningType:"deep" }).total;
const post = priceCleaning({ ...base, cleaningType:"post_construction" }).total;
ok(once < deep && deep < post, `standard ${$(once)} < deep ${$(deep)} < post-construction ${$(post)}`);

// A multiplier must not inflate a flat add-on.
const addonOnly = priceCleaning({ ...base, addOns:["laundry"] }).total - once;
const addonOnDeep = priceCleaning({ ...base, cleaningType:"deep", addOns:["laundry"] }).total - deep;
ok(addonOnly === addonOnDeep,
   `a load of laundry costs the same (${$(addonOnly)}) on a deep clean — multipliers hit the WORK, not the flat extras`);

// ── The floor ───────────────────────────────────────────────────────────
const tiny = priceCleaning({ squareFootage:200, bedrooms:1, bathrooms:1 });
ok(tiny.total === DEFAULT_CLEANING_RATES.minimumCents,
   `a tiny job floors at the minimum ${$(tiny.total)} — below it the job doesn't cover the drive`);
ok(tiny.lines.some(l=>l.key==="minimum"), "…and the quote SAYS it's a minimum rather than showing a mystery number");
ok(priceCleaning({}).total === 0, "an empty enquiry prices at 0, not at the minimum — there's no job yet");

// ── Itemised, because one number gets haggled with ─────────────────────
const rich = priceCleaning({ ...base, cleaningType:"deep", condition:"needs_work", pets:1,
                             addOns:["inside_oven"], frequency:"biweekly" });
ok(rich.lines.length >= 6, `${rich.lines.length} itemised lines, not one total`);
ok(rich.lines.some(l=>l.cents < 0), "the recurring discount shows as a negative line the customer can see");
console.log("     " + rich.lines.map(l=>`${l.label} ${$(l.cents)}`).join("\n     "));

// ── Hostile input ───────────────────────────────────────────────────────
for (const [label, input] of [
  ["negative sqft", { squareFootage:-5000, bedrooms:2, bathrooms:1 }],
  ["NaN bathrooms", { squareFootage:1500, bathrooms:NaN }],
  ["absurd bedrooms", { squareFootage:1500, bedrooms:1e9 }],
  ["unknown type", { squareFootage:1500, cleaningType:"../etc/passwd" }],
  ["unknown frequency", { squareFootage:1500, frequency:"hourly-ish" }],
  ["unknown add-on", { squareFootage:1500, addOns:["free_please"] }],
  ["addOns not an array", { squareFootage:1500, addOns:"oven" }],
  ["null input", null],
]) {
  const r = priceCleaning(input);
  ok(Number.isFinite(r.total) && r.total >= 0, `${label} → ${$(r.total)}, finite and non-negative`);
}

// A tampered rate card can't invert the sign.
const evil = priceCleaning(base, { frequencyDiscount:{ one_time: 5 }, centsPerSqft:-100 });
ok(evil.total >= 0, `a rate card with a 500% discount and a negative rate still yields ${$(evil.total)}`);
ok(normaliseCleaningRates({ typeMultiplier:{ deep: 0 } }).typeMultiplier.deep >= 0.1,
   "a zero multiplier clamps — it would otherwise make a deep clean free");

// ── The FieldQuo line shape ─────────────────────────────────────────────
const items = cleaningLineItems({ ...base, cleaningType:"deep" });
ok(items.every(i => ["description","quantity","unit","rate","amount"].every(k => k in i)),
   "line items come out in the shape QuoteScopeGroup reads");
const sum = Math.round(items.reduce((s,i)=>s+i.amount,0) * 100);
ok(Math.abs(sum - deep) <= 1, `the itemised lines add up to the total (${$(sum)})`);

ok(CLEANING_ADDONS.every(a=>a.key && a.label && a.cents>0), `${CLEANING_ADDONS.length} add-ons, all priced and labelled`);


// ── Hourly: the model for jobs nobody has seen yet ──────────────────────
const hr = priceCleaningHourly({ crewSize:2, hours:2 });
ok(hr.total === 22000, `2 cleaners × 2 hours = ${$(hr.total)} — inside the $100–$300 first-visit band`);
ok(/2 cleaners × 2 hours at \$55\.00\/hr/.test(hr.lines[0].label),
   `the working is spelled out: "${hr.lines[0].label}" — "$220" invites haggling, this doesn't`);
ok(priceCleaningHourly({ crewSize:3, hours:2 }).total > hr.total, "a third cleaner costs more");
ok(priceCleaningHourly({ crewSize:2, hours:4 }).total > hr.total, "twice the hours costs more");
ok(priceCleaningHourly({}).total > 0, "no arguments falls back to a typical 2×2 visit");
ok(priceCleaningHourly(null).total > 0, "null doesn't throw");
ok(priceCleaningHourly({ crewSize:-5, hours:1e9 }).total > 0, "hostile crew/hours still finite");

// ── Per-unit add-ons ────────────────────────────────────────────────────
const w = (n) => priceCleaning({ squareFootage:1500, bedrooms:2, bathrooms:1,
                                 addOns:[{ key:"interior_windows", quantity:n }] }).total;
ok(w(40) > w(8), `40 windows costs more than 8 (${$(w(8))} → ${$(w(40))}) — a bungalow and a big house are not the same job`);
ok(priceCleaning({ squareFootage:1500, addOns:["interior_windows"] }).total > 0,
   "a bare string add-on still works — callers don't all have a quantity");
const many = priceCleaning({ squareFootage:1500, addOns:[{ key:"interior_windows", quantity:1e9 }] });
ok(Number.isFinite(many.total), "an absurd window count is clamped rather than overflowing");

console.log(`\n${fail===0?"ALL PASS":fail+" FAILED"}`);
process.exit(fail?1:0);
