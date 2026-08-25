// scripts/check-money-and-address.mjs
//
// Two client-facing defects that survived a fix each, for the same reason: the
// fix went into a SHARED helper the broken screens were not calling.
//
// FQ-014: "$2100.00" on the quote a client opens. documentFormatters was
// repaired and the number stayed wrong, because six pages had grown a private
//   const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;
// plus a scattering of inline `${x.toFixed(2)}`. toFixed does not group.
//
// FQ-104: "…, Canada, Toronto, ON" on the same document — a regression from
// fixing FQ-006. `address` is Google's FORMATTED string and already contains
// the locality; joining city and province onto it was always wrong, and only
// looked fine while those columns were null.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-money-and-address.mjs

import { formatAppMoney } from "@/lib/format/money";
import { formatAddress, formatPlace } from "@/lib/format/address";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
/// The comments explaining these very fixes name `toFixed(2)` and
/// `window.confirm` in prose, so a naive source scan flags its own
/// documentation. Stripping comments first was the obvious answer and a bad
/// one — a `/*` inside a string literal makes the block regex swallow real
/// code, which it silently did here.
///
/// So match on SHAPES that only occur in executing code instead: a template
/// interpolation ending in toFixed(2), and a window.confirm CALL. Prose
/// mentions neither `${…toFixed(2)}` nor `window.confirm(`.
const usesToFixedMoney = (r) =>
  /\$\{[^}]*\.toFixed\(2\)\}|const money = [^\n]*toFixed\(2\)/.test(read(r));
const callsWindowConfirm = (r) => /window\.confirm\s*\(/.test(read(r));

console.log("\nMoney groups, in every currency shape");
t("the reported number", formatAppMoney(2100, "CAD", "en"), "$2,100.00");
t("the reported cost", formatAppMoney(1113.11, "CAD", "en"), "$1,113.11");
t("null currency still groups", formatAppMoney(2100, null, "en"), "$2,100.00");
t("USD keeps its own mark", formatAppMoney(2100, "USD", "en"), "US$2,100.00");
// Intl uses a NO-BREAK space (U+00A0) as the French group separator, not a
// plain one — comparing against a typed " " fails on a correct result.
t("French groups its own way", /2\u00a02100,00|2\u00a0100,00/.test(formatAppMoney(2100, "CAD", "fr")));
t("...and is still dollars", /\$/.test(formatAppMoney(2100, "CAD", "fr")));
t("cents are never dropped", formatAppMoney(125.5, "CAD", "en"), "$125.50");
t("junk is not NaN", formatAppMoney("abc", "CAD", "en"), "$0.00");
t("null is zero, not blank", formatAppMoney(null, "CAD", "en"), "$0.00");

console.log("\nNo screen keeps a private toFixed money helper");
// The specific shape that caused this. A new one appearing means the same bug
// has been reintroduced somewhere the shared fix cannot reach.
for (const f of [
  "../app/app/quotes/[id]/page.js",
  "../app/components/quotes/builder/CostMarginPanel.js",
  "../app/components/quotes/builder/UnitPricingFields.js",
  "../app/components/quotes/builder/LineItemsTable.js",
  "../app/app/invoices/[id]/page.js",
  "../app/app/invoices/new/page.js",
]) {
  t(`${f.split("/").pop()} has no toFixed money`, !usesToFixedMoney(f));
  t(`${f.split("/").pop()} uses the shared formatter`,
    /@\/lib\/format\/money/.test(read(f)));
}

console.log("\nAddress says the city once");
const google = { address: "123 Queen St W, Toronto, ON M5H 3M9, Canada", city: "Toronto", province: "ON" };
t("a formatted address is left alone", formatAddress(google), "123 Queen St W, Toronto, ON M5H 3M9, Canada");
t("a hand-typed street still gets its parts",
  formatAddress({ address: "123 Queen St", city: "Toronto", province: "ON" }),
  "123 Queen St, Toronto, ON");
t("parts alone still work", formatAddress({ city: "Toronto", province: "ON" }), "Toronto, ON");
t("case and punctuation don't defeat the check",
  formatAddress({ address: "123 QUEEN ST W, TORONTO, ON.", city: "Toronto", province: "ON" }),
  "123 QUEEN ST W, TORONTO, ON.");
t("accents match", formatAddress({ address: "5 Rue Principale, Québec, QC", city: "Québec", province: "QC" }),
  "5 Rue Principale, Québec, QC");
t("a city that is not in the address IS appended",
  formatAddress({ address: "123 Queen St W, Canada", city: "Toronto", province: "ON" }),
  "123 Queen St W, Canada, Toronto, ON");

console.log("\nAddress, hostile input");
for (const bad of [null, undefined, "junk", 42, [], {}])
  t(`${JSON.stringify(bad)} → empty string`, formatAddress(bad), "");
t("all-empty fields → empty, not a stray comma",
  formatAddress({ address: "", city: "", province: "" }), "");
t("whitespace-only fields → empty",
  formatAddress({ address: "  ", city: " ", province: "" }), "");
t("formatPlace on nothing", formatPlace(null), "");
t("formatPlace normal", formatPlace({ city: "Toronto", province: "ON" }), "Toronto, ON");

console.log("\nThe screens that duplicated it no longer join by hand");
for (const f of [
  "../app/app/quotes/[id]/page.js",
  "../app/app/clients/[id]/page.js",
  "../app/app/jobs/[id]/JobDetail.js",
]) {
  const s = read(f);
  t(`${f.split("/").pop()} uses formatAddress`, /formatAddress\(/.test(s));
  t(`${f.split("/").pop()} no longer joins address+city`,
    !/\[\s*\w+(\.\w+|\?\.\w+)*\.address,\s*\w+(\.\w+|\?\.\w+)*\.city/.test(s));
}

console.log("\nSending asks first, with a real modal");
// window.confirm was the first attempt and QA reported no confirmation at all
// — an automated browser auto-accepts native dialogs, so it was invisible to
// both the tester and, arguably, to a distracted human.
for (const f of [
  "../app/app/quotes/[id]/page.js",
  // The builder, not the route: /app/quotes/new and /app/quotes/[id]/edit are
  // both thin wrappers around this one component now.
  "../app/components/quotes/builder/QuoteBuilder.js",
]) {
  t(`${f.split("/").pop()} does not CALL window.confirm`, !callsWindowConfirm(f));
  t(`${f.split("/").pop()} renders SendConfirmModal`, /<SendConfirmModal/.test(read(f)));
}
t("the builder confirms via a parameter, not racing state",
  /confirmed = false/.test(read("../app/components/quotes/builder/QuoteBuilder.js")));

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — one money format, one address, and send asks first\n");
process.exit(fail ? 1 : 0);
