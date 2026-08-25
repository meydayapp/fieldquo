// scripts/check-quote-totals.mjs
//
// Discount + tax is where money bugs live, so the arithmetic is asserted to
// the cent rather than eyeballed on screen.
//
// What this guards:
//
//   1. Tax is charged on subtotal MINUS discount. Charging it on the gross
//      subtotal bills the client tax on money they were never charged, and it
//      is the state the quote builder shipped in: it had no discount field at
//      all, while the edit page and the API costed against the net. The moment
//      the builder gained a discount the two had to agree, which is why they
//      now share lib/quotes/totals.js.
//   2. A discount bigger than the job cannot produce a negative total, a
//      negative tax, or a credit note dressed up as a quote. An extra zero on
//      "500" is one keystroke.
//   3. Nothing reaches a Decimal column as NaN. "", null, undefined, "abc"
//      and a bare "-" (what an empty number input holds mid-typing) are all
//      absent, and absent is 0 here — the field is optional.
//   4. Money is rounded to the cent, not left as an IEEE 754 tail. 22.22 at
//      14.975% is 3.3274449999999995 as a bare float, and an amount like that
//      cannot be reconciled against a bank statement by anybody.
//   5. The 30-day expiry default lands on the right calendar day across month
//      ends, leap days and year ends — and is built from LOCAL components, so
//      an estimator quoting at 8pm in Toronto doesn't get a date a day further
//      out than the field claims.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-quote-totals.mjs

import {
  quoteTotals,
  discountAmountFromPercent,
  discountPercentOfSubtotal,
} from "@/lib/quotes/totals";
import {
  defaultValidUntil,
  toDateInputValue,
  DEFAULT_VALID_DAYS,
} from "@/lib/quotes/validUntil";

let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"} ${name}${
      ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`
    }`,
  );
};

// ───────────────────────────────────────────────────────────────────────────
// 1. The worked example, to the cent
// ───────────────────────────────────────────────────────────────────────────
//
// A kitchen refinish quoted at $4,850.00, $500.00 knocked off, Ontario HST at
// 13%. Done by hand:
//
//   subtotal      4850.00
//   discount      -500.00
//   taxable base  4350.00
//   tax           4350.00 x 0.13 = 565.50
//   total         4350.00 + 565.50 = 4915.50
//
// The wrong answer — the one taxing the gross subtotal — is 4850 x 0.13 =
// 630.50, giving 4980.50. $65.00 of tax on a discount, on every discounted
// quote the product would ever send.

console.log("\nSubtotal 4850, discount 500, tax 13%");
const worked = quoteTotals({
  subtotal: 4850,
  discount: 500,
  taxRate: 13,
  taxEnabled: true,
});
t("taxable base is subtotal minus discount", worked.taxableBase, 4350);
t("tax is charged on the net, not the gross", worked.tax, 565.5);
t("total", worked.total, 4915.5);
t("the discount that gets saved", worked.discount, 500);
t(
  "and is NOT the gross-taxed answer",
  worked.total === 4980.5,
  false,
);

// Same quote with tax switched off — the "apply taxes or not" control.
console.log("\nThe same quote with tax switched off");
const untaxed = quoteTotals({
  subtotal: 4850,
  discount: 500,
  taxRate: 13,
  taxEnabled: false,
});
t("no tax", untaxed.tax, 0);
t("total is the discounted subtotal", untaxed.total, 4350);
t("the rate is ignored, not zeroed", untaxed.taxableBase, 4350);

// ───────────────────────────────────────────────────────────────────────────
// 2. A discount larger than the job
// ───────────────────────────────────────────────────────────────────────────

console.log("\nA discount bigger than the subtotal");
const over = quoteTotals({
  subtotal: 4850,
  discount: 50000, // an extra zero on 5000
  taxRate: 13,
  taxEnabled: true,
});
t("discount is capped at the subtotal", over.discount, 4850);
t("base cannot go negative", over.taxableBase, 0);
t("no negative tax", over.tax, 0);
t("total is zero, never negative", over.total, 0);
t("total is not NaN", Number.isFinite(over.total), true);

console.log("\nA discount exactly equal to the subtotal");
const exact = quoteTotals({ subtotal: 1200, discount: 1200, taxRate: 13 });
t("free job, no tax on nothing", exact, {
  subtotal: 1200,
  discount: 1200,
  taxableBase: 0,
  tax: 0,
  total: 0,
});

console.log("\nA negative discount (a minus sign typed into the box)");
const negative = quoteTotals({ subtotal: 1000, discount: -250, taxRate: 13 });
t("treated as no discount, never as an increase", negative.discount, 0);
t("total is the taxed subtotal", negative.total, 1130);

// ───────────────────────────────────────────────────────────────────────────
// 3. Absent, half-typed and hostile input
// ───────────────────────────────────────────────────────────────────────────

console.log("\nAbsent and unparseable input is 0, never NaN");
for (const bad of ["", null, undefined, "abc", "-", "1.2.3", NaN, {}, []]) {
  const r = quoteTotals({ subtotal: 100, discount: bad, taxRate: 13 });
  t(
    `discount ${JSON.stringify(bad)} -> total 113`,
    [r.discount, r.tax, r.total],
    [0, 13, 113],
  );
}

console.log("\nAn unparseable tax rate charges no tax rather than NaN");
t(
  'taxRate "" ',
  quoteTotals({ subtotal: 100, taxRate: "" }).total,
  100,
);
t(
  "no arguments at all",
  quoteTotals(),
  { subtotal: 0, discount: 0, taxableBase: 0, tax: 0, total: 0 },
);

console.log("\nForm fields arrive as strings");
t(
  '"4850" / "500" / "13" reads the same as the numbers',
  quoteTotals({ subtotal: "4850", discount: "500", taxRate: "13" }),
  quoteTotals({ subtotal: 4850, discount: 500, taxRate: 13 }),
);

// ───────────────────────────────────────────────────────────────────────────
// 4. Rounding — cents, not floating-point tails
// ───────────────────────────────────────────────────────────────────────────

console.log("\nEvery figure is rounded to the cent");
const tail = quoteTotals({ subtotal: 100.1, discount: 0.05, taxRate: 13 });
t("base", tail.taxableBase, 100.05);
t("tax rounds 13.0065 to 13.01", tail.tax, 13.01);
t("total", tail.total, 113.06);

// The raw float, for contrast. 22.22 x 14.975% is 3.3274449999999995 in IEEE
// 754; a bare multiply puts that in the column, and $3.3274449999999995 of QST
// is not a number anyone can reconcile against a bank statement.
t(
  "the unrounded product really does have a tail",
  22.22 * 0.14975 === 3.327445,
  false,
);
t(
  "and quoteTotals rounds it to the cent",
  quoteTotals({ subtotal: 22.22, taxRate: 14.975 }).tax,
  3.33,
);

// A third of a dollar three ways — the classic split that drifts.
console.log("\nA subtotal that does not divide evenly");
const thirds = quoteTotals({ subtotal: 33.33, discount: 11.11, taxRate: 14.975 });
t("base", thirds.taxableBase, 22.22);
t("tax", thirds.tax, 3.33);
t("total", thirds.total, 25.55);

// ───────────────────────────────────────────────────────────────────────────
// 5. Percent entry converts to the stored amount
// ───────────────────────────────────────────────────────────────────────────

console.log("\nPercent is an entry mode, the amount is what is stored");
t("10% of 4850", discountAmountFromPercent(4850, 10), 485);
t("12.5% of 999.99 rounds to the cent", discountAmountFromPercent(999.99, 12.5), 125);
t("over 100% is capped at the whole job", discountAmountFromPercent(4850, 150), 4850);
t("a negative percent is no discount", discountAmountFromPercent(4850, -10), 0);
t("nonsense is no discount", discountAmountFromPercent(4850, "abc"), 0);
t("a percent of nothing is nothing", discountAmountFromPercent(0, 25), 0);

console.log("\nAnd back the other way, for the '(about 10%)' hint");
t("485 off 4850", discountPercentOfSubtotal(4850, 485), 10);
t("no subtotal means no percentage, not 0%", discountPercentOfSubtotal(0, 100), null);
t("a negative subtotal too", discountPercentOfSubtotal(-50, 10), null);

// Worked by hand first, so the expected figures are not simply whatever the
// code returned:
//   discount      4850 x 0.10 = 485.00
//   taxable base  4850 - 485  = 4365.00
//   tax           4365 x 0.13 = 567.45
//   total                       4932.45
console.log("\nA percentage entered and then applied agrees with the maths");
const pct = discountAmountFromPercent(4850, 10);
const pctTotals = quoteTotals({ subtotal: 4850, discount: pct, taxRate: 13 });
t("discount", pctTotals.discount, 485);
t("taxable base", pctTotals.taxableBase, 4365);
t("tax", pctTotals.tax, 567.45);
t("total", pctTotals.total, 4932.45);

// ───────────────────────────────────────────────────────────────────────────
// 6. The 30-day expiry default
// ───────────────────────────────────────────────────────────────────────────

console.log("\nValid until defaults to 30 days out");
t("the constant is 30", DEFAULT_VALID_DAYS, 30);
t(
  "24 Aug 2026 + 30 days",
  defaultValidUntil(new Date(2026, 7, 24)),
  "2026-09-23",
);
t(
  "month end rolls over",
  defaultValidUntil(new Date(2026, 11, 15)),
  "2027-01-14",
);
t(
  "a leap day is counted",
  defaultValidUntil(new Date(2028, 1, 3)),
  "2028-03-04",
);
t(
  "late in the evening is still today's date + 30",
  // 8pm local. toISOString() here would already be tomorrow anywhere west of
  // UTC, which is the whole reason this is built from local components.
  defaultValidUntil(new Date(2026, 7, 24, 20, 30)),
  "2026-09-23",
);
t("an unparseable date yields an empty field, not Invalid Date", defaultValidUntil("nope"), "");
t("no date at all", toDateInputValue(null), "");
t("single digits are padded", toDateInputValue(new Date(2026, 0, 5)), "2026-01-05");

console.log(
  fail === 0
    ? "\nAll quote totals checks passed.\n"
    : `\n${fail} failure(s).\n`,
);
process.exitCode = fail === 0 ? 0 : 1;
