// scripts/check-document-money.mjs
//
// The client-facing quote and invoice rendered "$2100.00" — no thousands
// separator — on line items, subtotal and total, while every internal screen
// showed "$2,100.00". Two formats for the same number, and the wrong one was
// on the document the homeowner keeps.
//
// The cause was a default parameter doing less than it looked like it did:
//
//   documentFormatters(language, currency = "CAD")
//
// A default only fires for `undefined`. Company.currency is String?, so a
// company that never opened the setting stores NULL — which survived the
// default, made Intl throw RangeError, and dropped into a catch that returned
// toFixed(2) with no grouping.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-document-money.mjs

import { documentFormatters } from "@/lib/i18n/documentLabels";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
const money = (cur, n = 2100) => documentFormatters("en", cur).money(n);

console.log("\nEvery way a currency can be absent still groups");
// null is the one that shipped broken. The others are the same class.
t("null (the real stored value)", money(null), "$2,100.00");
t("undefined", money(undefined), "$2,100.00");
t("empty string", money(""), "$2,100.00");
t("explicit CAD", money("CAD"), "$2,100.00");

console.log("\nThe company's currency is honoured, not overwritten with CAD");
t("USD keeps its own symbol", money("USD"), "US$2,100.00");
t("EUR keeps its own symbol", money("EUR"), "€2,100.00");
t("an unknown code does not throw", /2,100/.test(money("ZZZ")));

console.log("\nThe numbers from the QA report specifically");
t("the quote total", money("CAD"), "$2,100.00");
t("the estimated cost", money("CAD", 1113.11), "$1,113.11");
t("zero is not blank", money("CAD", 0), "$0.00");
t("cents are never dropped", money("CAD", 125.5), "$125.50");
t("a non-number is not NaN on a document", money("CAD", "abc"), "$0.00");
t("null amount reads as zero", money("CAD", null), "$0.00");

console.log("\nLanguage changes the formatting, never the money");
// A francophone homeowner buying from a Toronto contractor is still billed in
// Canadian dollars — the separator and symbol placement move, the currency
// does not.
const fr = documentFormatters("fr", "CAD").money(2100);
t("French groups with its own conventions", /2\s?100/.test(fr));
t("...and is still dollars", /\$/.test(fr));
t("French is NOT the same string as English", fr !== money("CAD"));

console.log("\nThe degraded path looks like the good one");
// If Intl currency data is ever missing, the fallback must still group —
// otherwise the broken render is visually distinct from the correct one on
// the same page, which is exactly the bug being fixed.
const src = read("../lib/i18n/documentLabels.js");
t("the fallback groups rather than using bare toFixed",
  /minimumFractionDigits: 2,\s*\n\s*maximumFractionDigits: 2,/.test(src));
t("the coalesce exists and is used", /const code = currency \|\| "CAD";/.test(src));
t("...and money() reads the coalesced code", /currency: code,/.test(src));

console.log("\nEvery money-rendering document section receives the currency");
for (const f of [
  "TotalsSection", "ScopeGroupsSection", "PaymentSummarySection", "SignatureSection",
]) {
  const s = read(`../lib/documentSections/${f}.js`);
  t(`${f} passes company currency`, !/documentFormatters\(language\)/.test(s));
}
for (const f of ["quoteEmail", "invoiceEmail"]) {
  const s = read(`../lib/email/${f}.js`);
  t(`${f} passes company currency`, !/documentFormatters\(language\)/.test(s));
}
// Date-only callers legitimately pass no currency; asserted so a later sweep
// doesn't "fix" them into needing a company they don't have.
for (const f of ["HeaderSection", "ClientInfoSection"]) {
  const s = read(`../lib/documentSections/${f}.js`);
  t(`${f} is date-only and needs no currency`, !/\bmoney\(/.test(s));
}

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — one money format, in the company's own currency\n");
process.exit(fail ? 1 : 0);
