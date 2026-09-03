#!/usr/bin/env node
//
// scripts/check-purchasing.mjs
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs scripts/check-purchasing.mjs
//   npm run check:purchasing
//
// Purchasing, stock and the receipt scan — EXECUTED, not read.
//
// ══ Why every rule here runs the real function ═════════════════════════════
//
// AGENTS.md: "Execute pure functions against hostile input. Sanitisers,
// parsers, pricing, colour maths. Most of the real bugs in this repo were
// found that way, not by reading." Every arithmetic claim below imports the
// shipped module and runs it. A regex over the source would pass just as
// happily against a version that returns the wrong number.
//
// ══ The four string rules, and why they are scoped ═════════════════════════
//
// Four properties are about ORDER and ABSENCE in a route handler, and no
// amount of executing a pure function can see them: that the demo guard runs
// before the vendor call, that the demo branch never reaches the vendor at
// all, that the quota is checked before the spend, and that a PO number is
// only ever looked up within one company.
//
// Each of those is checked against ONE brace-matched function body, never the
// whole file. scripts/check-demo-spend.mjs learned this the hard way — its
// first version searched whole files and passed while purchaseCrewLine's guard
// was deleted outright, because a DIFFERENT function a few hundred lines away
// matched the same string. A check that cannot fail is worse than no check.
//
// ══ Mutation-tested ════════════════════════════════════════════════════════
//
// Every assertion below was confirmed to FAIL with the property broken and to
// pass again with it restored. The breaks are named in the session report.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { toMilli, fromMilli, formatMilli, sumMilli } from "@/lib/purchasing/quantity";
import { stockLevel, stockLevels, belowThreshold, lowStock, normaliseMovement } from "@/lib/purchasing/stock";
import { nextPoNumber, formatPoNumber, poSequence } from "@/lib/purchasing/poNumber";
import { applyDelivery, derivedStatus, outstandingMilli, progressSummary } from "@/lib/purchasing/receiving";
import { toCents, centsToText, centsToAmount } from "@/lib/receipts/money";
import { reconcileReceipt, suggestedCostCents } from "@/lib/receipts/reconcile";
import { prefillMaterial, refuseOverwrites, isConfirmed } from "@/lib/receipts/prefill";
import { receiptImageOrRefusal, REFUSAL } from "@/lib/receipts/media";
import { simulatedExtraction, simulatedReceiptScan } from "@/lib/receipts/demoReceipt";
import { RECEIPT_SCHEMA, normaliseExtraction } from "@/lib/receipts/extract";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks += 1;
  if (!pass) failures += 1;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (title) => console.log(`\n${title}\n`);

// ── The brace matcher the string rules use ────────────────────────────────
//
// Returns the body of the FIRST function whose signature matches, from the
// brace that opens the BODY to the one that closes it. Naive about braces
// inside string literals, which is fine for the route handlers it is pointed
// at and is the reason it is not offered as a general tool.
//
// The parameter list is skipped explicitly rather than by finding the next
// "{". `export async function POST(request, { params })` destructures, so the
// first brace after the signature belongs to the PARAMETERS — and the first
// version of this helper matched it, returned "{ params }", and every rule
// scoped to a handler with destructured params silently checked a two-word
// string. That is a check that cannot fail, which is worse than no check;
// it was caught by the assertions going red rather than by reading.
function functionBody(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) return null;

  let open = source.indexOf("{", start);
  const paren = source.indexOf("(", start);
  if (paren !== -1 && (open === -1 || paren < open)) {
    let parens = 0;
    let i = paren;
    for (; i < source.length; i += 1) {
      if (source[i] === "(") parens += 1;
      else if (source[i] === ")") {
        parens -= 1;
        if (parens === 0) break;
      }
    }
    open = source.indexOf("{", i);
  }
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Quantities are integers, and an unreadable one is not zero");
// ═══════════════════════════════════════════════════════════════════════════

ok("12.345 -> 12345 thousandths", toMilli("12.345") === 12345, String(toMilli("12.345")));
ok("a bare integer scales", toMilli("40") === 40000, String(toMilli("40")));
ok("more precision than the column holds is truncated", toMilli("1.23456") === 1234, String(toMilli("1.23456")));
ok("a negative parses", toMilli("-3") === -3000, String(toMilli("-3")));
ok("unreadable text is null, NOT 0", toMilli("about a dozen") === null, JSON.stringify(toMilli("about a dozen")));
ok("empty is null, NOT 0", toMilli("") === null && toMilli(null) === null);
ok('"." alone is null', toMilli(".") === null, JSON.stringify(toMilli(".")));
ok("NaN is null", toMilli(NaN) === null && toMilli(Infinity) === null);
// The float trap this module exists for. 0.1 + 0.2 as numbers is
// 0.30000000000000004; through toMilli it is exactly 300 thousandths.
ok(
  "0.1 + 0.2 sums exactly",
  sumMilli([toMilli("0.1"), toMilli("0.2")]) === 300,
  String(sumMilli([toMilli("0.1"), toMilli("0.2")])),
);
ok("one unreadable value poisons the whole sum", sumMilli([1000, null, 2000]) === null);
ok("formatting trims trailing zeros", formatMilli(12000) === "12" && formatMilli(500) === "0.5", `${formatMilli(12000)} / ${formatMilli(500)}`);
ok("fromMilli round-trips", fromMilli(toMilli("7.25")) === 7.25);

// ═══════════════════════════════════════════════════════════════════════════
section("2. A stock level is SUMMED from movements, including a negative correction");
// ═══════════════════════════════════════════════════════════════════════════

// 40 bags delivered, 10 used on a job, then a Friday count comes up 3 short.
// The correction is a MOVEMENT, not an edit — the wrong count and the fix both
// survive, which is the whole reason StockMovement is signed.
const movements = [
  { materialId: "m1", quantity: "40", kind: "received" },
  { materialId: "m1", quantity: "-10", kind: "used" },
  { materialId: "m1", quantity: "-3", kind: "adjustment" },
];

const level = stockLevel(movements);
ok("40 in, 10 out, 3 corrected away = 27", level.quantity === 27, String(level.quantity));
ok("the movement count comes back too", level.movements === 3);

ok(
  "removing the correction changes the answer (the sum is real, not hardcoded)",
  stockLevel(movements.slice(0, 2)).quantity === 30,
  String(stockLevel(movements.slice(0, 2)).quantity),
);

ok(
  "a movement nobody can read makes the level null, not a smaller number",
  stockLevel([...movements, { materialId: "m1", quantity: "?" }]).quantity === null,
);

// The sign is derived from the kind, so "used: +40" cannot enter the ledger
// as a delivery.
const usedPositive = normaliseMovement({ kind: "used", quantity: "40" });
ok("used is forced negative whatever sign was typed", usedPositive.ok && usedPositive.quantity === -40, String(usedPositive.quantity));
const usedNegative = normaliseMovement({ kind: "used", quantity: "-40" });
ok("...and typing the minus yourself gives the same answer", usedNegative.ok && usedNegative.quantity === -40);
const received = normaliseMovement({ kind: "received", quantity: "-40" });
ok("received is forced positive", received.ok && received.quantity === 40, String(received.quantity));

// adjustment is the ONE kind allowed to go either way. That exception is the
// entire reason the column is signed rather than a magnitude plus a direction.
const correction = normaliseMovement({ kind: "adjustment", quantity: "-3" });
ok("a correction keeps its negative sign", correction.ok && correction.quantity === -3, String(correction.quantity));
const positiveCorrection = normaliseMovement({ kind: "adjustment", quantity: "3" });
ok("...and a positive correction stays positive", positiveCorrection.ok && positiveCorrection.quantity === 3);

ok("zero is refused — a movement of nothing says nothing", normaliseMovement({ kind: "used", quantity: "0" }).ok === false);
ok("an unknown kind is refused by name", normaliseMovement({ kind: "shrinkage", quantity: "1" }).ok === false);
ok("an unreadable quantity is refused, not stored as 0", normaliseMovement({ kind: "used", quantity: "some" }).ok === false);

// ═══════════════════════════════════════════════════════════════════════════
section("3. A level crossing reorderThreshold — the one thing this feature is for");
// ═══════════════════════════════════════════════════════════════════════════

const materials = [
  { id: "m1", name: "Primer 3.78 L", unit: "tin", reorderThreshold: "30" },
  { id: "m2", name: "Painter's tape", unit: "roll", reorderThreshold: null },
];

// Before the correction the level is exactly 30 — NOT below. After it, 27 is.
// That is the crossing, and it is asserted from both sides so an off-by-one in
// either direction fails.
const atThreshold = stockLevels(materials, movements.slice(0, 2));
ok("exactly at the threshold is NOT low", atThreshold[0].belowThreshold === false, JSON.stringify(atThreshold[0].belowThreshold));

const crossed = stockLevels(materials, movements);
ok("one below the threshold IS low", crossed[0].belowThreshold === true);
ok("the low list carries it", lowStock(crossed).length === 1 && lowStock(crossed)[0].materialId === "m1");

// A material with no threshold has made NO statement about running low.
// Answering "false" there would be inventing one — AGENTS.md failure class #5.
ok("no threshold set answers null, not false", crossed[1].belowThreshold === null, JSON.stringify(crossed[1].belowThreshold));
ok("...and it is therefore not in the low list", lowStock(crossed).every((l) => l.materialId !== "m2"));

ok("an unsummable level answers null rather than firing an alert", belowThreshold(null, "30") === null);
ok("belowThreshold handles an unreadable threshold", belowThreshold(1000, "soon") === null);
ok("reorderThreshold is actually read by the route", read("app/api/stock/route.js").includes("reorderThreshold"));

// ═══════════════════════════════════════════════════════════════════════════
section("4. A partial delivery — received is a quantity, never a boolean");
// ═══════════════════════════════════════════════════════════════════════════

const poLines = [
  { id: "l1", description: "OSB 7/16 4x8", quantity: "40", quantityReceived: "0" },
  { id: "l2", description: "Screws 2 1/2in, 5 lb", quantity: "6", quantityReceived: "0" },
];

const firstVan = applyDelivery({ lines: poLines, received: { l1: "12" }, current: "sent" });
ok("a delivery of 12 of 40 succeeds", firstVan.ok);
ok("the line records 12 received", firstVan.lines[0].quantityReceived === 12, String(firstVan.lines[0].quantityReceived));
ok("28 stays outstanding", firstVan.lines[0].outstandingMilli === 28000, String(firstVan.lines[0].outstandingMilli));
ok("the order is PARTIAL, not received", firstVan.status === "partial", firstVan.status);
// A line the note did not mention is untouched. "Not in this van" is not
// "zero of these will ever arrive".
ok("the unmentioned line is left alone", firstVan.lines[1].quantityReceived === 0 && firstVan.lines[1].appliedMilli === 0);

const afterFirst = [
  { id: "l1", description: "OSB 7/16 4x8", quantity: "40", quantityReceived: "12" },
  { id: "l2", description: "Screws 2 1/2in, 5 lb", quantity: "6", quantityReceived: "0" },
];
const secondVan = applyDelivery({ lines: afterFirst, received: { l1: "28", l2: "6" }, current: "partial" });
ok("the rest turning up completes the order", secondVan.status === "received", secondVan.status);
ok("...and the line totals 40, not 28", secondVan.lines[0].quantityReceived === 40, String(secondVan.lines[0].quantityReceived));

// Over-delivery is REPORTED, not clamped: the stock movement has to match the
// physical shelf, and somebody has to decide whether the extra gets paid for.
const overVan = applyDelivery({ lines: poLines, received: { l1: "42" }, current: "sent" });
ok("42 of 40 is accepted", overVan.ok && overVan.lines[0].quantityReceived === 42, String(overVan.lines[0].quantityReceived));
ok("...and flagged as over-delivered by 2", overVan.overDelivered.length === 1 && overVan.overDelivered[0].byText === "2", JSON.stringify(overVan.overDelivered));

ok("a negative delivery is refused (a return is its own movement)", applyDelivery({ lines: poLines, received: { l1: "-5" }, current: "sent" }).ok === false);
ok("an unreadable delivery quantity is refused, not stored as 0", applyDelivery({ lines: poLines, received: { l1: "a few" }, current: "sent" }).ok === false);

ok("a cancelled order stays cancelled however much turns up", derivedStatus(afterFirst, "cancelled") === "cancelled");
ok("nothing received keeps a sent order sent", derivedStatus(poLines, "sent") === "sent");
ok("outstanding never goes negative", outstandingMilli({ quantity: "40", quantityReceived: "42" }) === 0);
ok("progress counts complete lines", progressSummary(afterFirst).complete === 0 && progressSummary(afterFirst).lines === 2);

// The status is DERIVED. An endpoint that let someone type it would let the
// badge disagree with the lines under it.
const poPatch = functionBody(read("app/api/purchase-orders/[id]/route.js"), "export async function PATCH");
ok("PATCH cannot set a status by hand beyond sent/cancelled", poPatch !== null && !/status\s*=\s*"received"/.test(poPatch) && poPatch.includes("SETTABLE"));

// ═══════════════════════════════════════════════════════════════════════════
section("5. PO numbers collide across companies — and that is CORRECT");
// ═══════════════════════════════════════════════════════════════════════════

const companyA = [];
const companyB = [];
ok("two companies with no orders both get PO-001", nextPoNumber(companyA) === "PO-001" && nextPoNumber(companyB) === "PO-001");

const acme = ["PO-001", "PO-002", "PO-003"];
const beta = ["PO-001"];
ok("each company counts only its own", nextPoNumber(acme) === "PO-004" && nextPoNumber(beta) === "PO-002", `${nextPoNumber(acme)} / ${nextPoNumber(beta)}`);
ok("padding is a floor, not a ceiling", formatPoNumber(1000) === "PO-1000" && formatPoNumber(7) === "PO-007");
ok("a renamed prefix still finds the sequence", poSequence("PO/2026-014") === 14, String(poSequence("PO/2026-014")));
ok("...so a company that renamed theirs does not restart at 1", nextPoNumber(["PO/2026-014"], "PO/2026-") === "PO/2026-015", nextPoNumber(["PO/2026-014"], "PO/2026-"));
ok("junk in the list is skipped rather than crashing", nextPoNumber(["", null, "draft", "PO-009"]) === "PO-010", nextPoNumber(["", null, "draft", "PO-009"]));

// The mechanical guarantee behind all of the above: the lookup is scoped to
// one company, so it CANNOT see another tenant's numbers and therefore cannot
// avoid a collision it should not be avoiding.
const poPost = functionBody(read("app/api/purchase-orders/route.js"), "export async function POST");
ok("the number lookup is scoped to one company", poPost !== null && /purchaseOrder\.findMany\(\{\s*where:\s*\{\s*companyId:\s*member\.companyId/.test(poPost));
ok("...and a unique-index collision is retried rather than swallowed", poPost !== null && poPost.includes('err?.code !== "P2002"'));

// ═══════════════════════════════════════════════════════════════════════════
section("6. Money off a receipt, in cents, from hostile printing");
// ═══════════════════════════════════════════════════════════════════════════

ok('"$1,234.56" -> 123456', toCents("$1,234.56") === 123456, String(toCents("$1,234.56")));
ok('"1.234,56" (European) -> 123456', toCents("1.234,56") === 123456, String(toCents("1.234,56")));
ok('"1 234,56 $" -> 123456', toCents("1 234,56 $") === 123456, String(toCents("1 234,56 $")));
ok('"12,34" -> 1234', toCents("12,34") === 1234, String(toCents("12,34")));
ok('"1,234" is twelve hundred, not one and a bit', toCents("1,234") === 123400, String(toCents("1,234")));
ok('a trailing minus is a refund', toCents("4.50-") === -450, String(toCents("4.50-")));
ok('"(4.50)" is negative', toCents("(4.50)") === -450, String(toCents("(4.50)")));
ok('"9.5" pads to 950', toCents("9.5") === 950, String(toCents("9.5")));
// The whole point. A faded total is not a receipt for nothing.
ok("unreadable is null, NOT 0", toCents("—") === null && toCents("TOTAL") === null && toCents("") === null);
ok("null in, null out", toCents(null) === null && toCents(undefined) === null);
ok("centsToText round-trips", centsToText(toCents("$1,234.56")) === "1234.56", centsToText(toCents("$1,234.56")));
ok("centsToAmount of null stays null", centsToAmount(null) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("7. A receipt whose items do not sum to its printed total — SURFACED, not corrected");
// ═══════════════════════════════════════════════════════════════════════════

// A real till receipt: three lines, a discount applied at the till and never
// itemised. The lines come to $135.55; the paper says $125.55.
const mismatched = {
  items: [
    { description: "Primer, 3.78 L", quantity: "2", unitPrice: "42.50", lineTotal: "85.00" },
    { description: "Sandpaper 180 grit", quantity: "1", unitPrice: "18.75", lineTotal: "18.75" },
    { description: "Painter's tape", quantity: "4", unitPrice: "7.95", lineTotal: "31.80" },
  ],
  printedSubtotal: "125.55",
  printedTax: null,
  printedTotal: "125.55",
};

const bad = reconcileReceipt(mismatched);
ok("the lines are summed in code", bad.itemsTotalCents === 13555, String(bad.itemsTotalCents));
ok("the printed total is carried through UNCHANGED", bad.printedTotalCents === 12555, String(bad.printedTotalCents));
ok("the gap is reported as a number", bad.discrepancyCents === 1000, String(bad.discrepancyCents));
ok("agrees is false", bad.agrees === false);
ok("the verdict is a mismatch", bad.verdict === "mismatch", bad.verdict);
// The rule that matters: nothing is rewritten to make the two agree.
ok("no line was dropped to make it balance", bad.lines.length === 3);
ok("the printed total was NOT replaced by the computed one", bad.printedTotalCents !== bad.itemsTotalCents);
// And nothing is offered as a one-tap cost while the two disagree — a figure
// nobody can reconcile is exactly the figure that should not flow into a job.
ok("no cost is suggested while they disagree", suggestedCostCents(bad) === null, JSON.stringify(suggestedCostCents(bad)));

const good = reconcileReceipt({ ...mismatched, printedSubtotal: "135.55", printedTotal: "135.55" });
ok("a receipt that DOES add up says so", good.agrees === true && good.verdict === "agrees");
ok("...and offers the PRINTED total, not the computed sum", suggestedCostCents(good) === 13555, String(suggestedCostCents(good)));

// Three-valued on purpose: an unreadable side is not a mismatch.
const partial = reconcileReceipt({
  items: [
    { description: "Primer", lineTotal: "85.00" },
    { description: "Tape", lineTotal: "smudged" },
  ],
  printedTotal: "116.80",
});
ok("one unreadable line makes agrees null, not false", partial.agrees === null, JSON.stringify(partial.agrees));
ok("...and the sum is null rather than a partial total", partial.itemsTotalCents === null);
ok("...with a verdict that says which", partial.verdict === "someLinesUnreadable", partial.verdict);
ok("...and the unreadable line still appears", partial.lines.length === 2 && partial.lines[1].readable === false);

// ── Tax: the case that would have made this feature cry wolf ──────────────
//
// On almost every till receipt the line items sum to the PRE-TAX subtotal.
// Comparing them to the total would report a mismatch of exactly the tax on
// every receipt in the country, and a banner that fires every time is a banner
// nobody reads. Found by running this script against the canned demo receipt,
// which is exactly why it is canned.
const withTax = reconcileReceipt({
  items: mismatched.items,
  printedSubtotal: "135.55",
  printedTax: "20.30",
  printedTotal: "155.85",
});
ok("items are compared to the SUBTOTAL when one is printed", withTax.comparedTo === "subtotal", withTax.comparedTo);
ok("...so tax does not read as a mismatch", withTax.agrees === true && withTax.verdict === "agrees", withTax.verdict);
ok("...and the paper is checked against itself, separately", withTax.printedTotalsAgree === true);
ok("...with the TOTAL offered as the cost, not the subtotal", suggestedCostCents(withTax) === 15585, String(suggestedCostCents(withTax)));

const wonky = reconcileReceipt({ items: mismatched.items, printedSubtotal: "135.55", printedTax: "20.30", printedTotal: "160.00" });
ok("a receipt that disagrees with ITSELF is reported", wonky.printedTotalsAgree === false);
ok("...and offers no one-tap cost", suggestedCostCents(wonky) === null);
ok("...while the printed total is still carried through untouched", wonky.printedTotalCents === 16000);

const noTotal = reconcileReceipt({ items: [{ description: "Primer", lineTotal: "85.00" }], printedTotal: null });
ok("a torn total is not replaced by the sum of the lines", noTotal.printedTotalCents === null && noTotal.verdict === "noPrintedTotal");
ok("...and nothing is suggested from it", suggestedCostCents(noTotal) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("8. A receipt NEVER overwrites a figure a person typed");
// ═══════════════════════════════════════════════════════════════════════════

const typed = { actualCost: 412.9, supplier: "Northline", purchasedAt: null };
const scanned = { actualCost: 409.55, supplier: "NORTHLINE BUILDING SUPPLY", purchasedAt: "2026-08-14" };

const merged = prefillMaterial(typed, scanned);
ok("the typed cost survives", merged.values.actualCost === 412.9, String(merged.values.actualCost));
ok("the typed supplier survives", merged.values.supplier === "Northline", merged.values.supplier);
ok("the empty date IS filled in", merged.values.purchasedAt === "2026-08-14" && merged.filled.includes("purchasedAt"));
ok("the refused fields are named, not swallowed", merged.kept.includes("actualCost") && merged.kept.includes("supplier"), JSON.stringify(merged.kept));
ok("...and the scan's figure is still offered for a person to choose", merged.offered.actualCost === 409.55);

const empty = prefillMaterial({ actualCost: null, supplier: "" }, scanned);
ok("an empty row IS prefilled", empty.values.actualCost === 409.55 && empty.values.supplier === "NORTHLINE BUILDING SUPPLY");
ok('"" counts as absence, not a statement', empty.filled.includes("supplier"));

// Zero is a statement. Somebody who typed 0.00 is saying the line was free —
// a warranty replacement, an offcut — and a receipt must not overwrite it.
const free = prefillMaterial({ actualCost: 0 }, scanned);
ok("a typed 0.00 is NOT overwritten", free.values.actualCost === 0 && free.kept.includes("actualCost"), String(free.values.actualCost));
ok("isConfirmed treats 0 as stated and null as absent", isConfirmed(0) === true && isConfirmed(null) === false && isConfirmed("  ") === false);

// The server-side half. A browser posting a cost for a line that already has
// one is REFUSED by name, never obeyed and never silently dropped.
const refusal = refuseOverwrites({ existing: typed, incoming: { actualCost: 409.55, purchasedAt: "2026-08-14" } });
ok("the overwrite is refused", refusal.refused.includes("actualCost") && !("actualCost" in refusal.write));
ok("the empty field is still written", refusal.write.purchasedAt === "2026-08-14");
ok("...with a sentence that says why", typeof refusal.error === "string" && refusal.error.includes("actualCost"));
ok("nothing to refuse means no error", refuseOverwrites({ existing: {}, incoming: { actualCost: 1 } }).error === null);

// The scan route computes the prefill against the STORED row, and it writes
// nothing at all — the person confirms and the existing materials PATCH does
// the write.
const scanPost = functionBody(read("app/api/receipts/scan/route.js"), "export async function POST");
ok("the scan route uses prefillMaterial", scanPost !== null && scanPost.includes("prefillMaterial("));
ok("...and never writes to jobMaterial", scanPost !== null && !/jobMaterial\.(update|create|upsert)/.test(scanPost));

// ═══════════════════════════════════════════════════════════════════════════
section("9. A PDF is refused, with a reason and with what to do instead");
// ═══════════════════════════════════════════════════════════════════════════

const pdfByKind = receiptImageOrRefusal({ url: "https://res.cloudinary.com/x/raw/upload/v1/plan", kind: "document", filename: "receipt.pdf" });
ok("a PDF is refused", pdfByKind.ok === false);
ok("...with the pdf reason code", pdfByKind.code === REFUSAL.PDF, pdfByKind.code);
ok("...naming the format", /pdf/i.test(pdfByKind.error));
// A refusal that does not say what to do instead is a wall. The whole reason
// photos-only is acceptable is that photographing it is what people do anyway.
ok("...and telling them to photograph it", /photo|picture/i.test(pdfByKind.error), pdfByKind.error);

ok("a .pdf URL is caught even when the kind is wrong", receiptImageOrRefusal({ url: "https://x/y.PDF", kind: "photo" }).code === REFUSAL.PDF);
ok("an application/pdf mime is caught", receiptImageOrRefusal({ url: "https://x/y", mimeType: "application/pdf" }).code === REFUSAL.PDF);
ok("a video is refused separately", receiptImageOrRefusal({ url: "https://x/y.mov", kind: "video" }).code === REFUSAL.VIDEO);
ok("a blob: URL is refused — the vendor fetches this itself", receiptImageOrRefusal({ url: "blob:http://localhost/abc", kind: "photo" }).code === REFUSAL.NOT_HTTP);
ok("nothing attached is refused", receiptImageOrRefusal({}).code === REFUSAL.MISSING);
ok("a real photo passes", receiptImageOrRefusal({ url: "https://res.cloudinary.com/x/image/upload/v1/r.jpg", kind: "photo" }).ok === true);

// Stated BEFORE a file is chosen, in both catalogues — a limit announced up
// front is how the feature works; the same limit announced afterwards is a
// dead control.
const messages = read("app/i18n/appMessages.js");
ok("the photos-only hint exists in English and French", (messages.match(/"app\.receipt\.photosOnly":/g) || []).length >= 2);
ok("the scanner prints it before the uploader", (() => {
  const src = read("app/components/purchasing/ReceiptScanner.js");
  const hint = src.indexOf("app.receipt.photosOnly");
  const uploader = src.indexOf("<MediaUploader");
  return hint !== -1 && uploader !== -1 && hint < uploader;
})());

// The route refuses before anything is spent.
ok("the route checks the file before the quota", scanPost !== null && scanPost.indexOf("receiptImageOrRefusal(") < scanPost.indexOf("checkAiQuota("));
ok("...and before the vendor call", scanPost !== null && scanPost.indexOf("receiptImageOrRefusal(") < scanPost.indexOf("extractReceipt("));

// ═══════════════════════════════════════════════════════════════════════════
section("10. A demo company never reaches the vendor");
// ═══════════════════════════════════════════════════════════════════════════

// Executed: the simulated branch returns the SAME shape a real scan returns,
// so a demo shows the whole walkthrough rather than a refusal — the
// substitution posture lib/email/demoMail.js and lib/sms/demoSms.js
// established. `member: null` keeps recordActivity's own guard from touching
// the stubbed database; the return value is what is under test here.
const demo = await simulatedReceiptScan({ member: null, imageUrl: "https://x/y.jpg" });
ok("the demo branch answers ok, not a refusal", demo.ok === true && demo.simulated === true);
ok("...with a receipt that reconciles", reconcileReceipt(demo.data).agrees === true);
ok("...and the canned lines really do add up", reconcileReceipt(simulatedExtraction()).discrepancyCents === 0);

// The module itself cannot call a model: it does not import the one file
// permitted to.
const demoSrc = read("lib/receipts/demoReceipt.js");
ok("lib/receipts/demoReceipt.js never imports the AI provider", !demoSrc.includes("lib/ai/provider"));

// ORDER, scoped to one function. The guard has to run BEFORE the spend, and
// the demo branch must not contain the vendor call at all.
ok("the demo guard runs before the vendor call", scanPost !== null && scanPost.indexOf("isDemoCompany(") < scanPost.indexOf("extractReceipt("));
ok("...and before the quota check", scanPost !== null && scanPost.indexOf("isDemoCompany(") < scanPost.indexOf("checkAiQuota("));

const demoBranch = scanPost ? functionBody(scanPost, "if (demo)") : null;
ok("the demo branch calls the simulator", demoBranch !== null && demoBranch.includes("simulatedReceiptScan("));
ok("the demo branch never calls the vendor", demoBranch !== null && !demoBranch.includes("extractReceipt("));
ok("the demo branch never meters a spend", demoBranch !== null && !demoBranch.includes("recordAiUsage("));

// ═══════════════════════════════════════════════════════════════════════════
section("11. The metering the AI path is required to do");
// ═══════════════════════════════════════════════════════════════════════════

ok("quota is checked before the vendor call", scanPost !== null && scanPost.indexOf("checkAiQuota(") < scanPost.indexOf("extractReceipt("));
ok("usage is recorded after it", scanPost !== null && scanPost.indexOf("extractReceipt(") < scanPost.indexOf("recordAiUsage("));
// Metered on every outcome, because the vendor bills on every outcome —
// provider.js meters before it decides anything about the content and this
// mirrors it. A `if (extraction.ok)` around the recording would understate a
// company whose photos keep coming back unreadable.
ok("usage is recorded before the failure branch, not inside the success one", scanPost !== null && scanPost.indexOf("recordAiUsage(") < scanPost.indexOf("if (!extraction.ok)"));
// Position alone is not enough — `if (usage && extraction.ok)` would still sit
// above the failure branch and still under-count. The GUARD is asserted too:
// the only condition on recording is that the vendor reported usage at all.
ok("...and the only condition on recording is that the vendor reported usage", scanPost !== null && /if \(usage\) \{\s*await recordAiUsage\(/.test(scanPost));

// ═══════════════════════════════════════════════════════════════════════════
section("12. The model transcribes; it never calculates");
// ═══════════════════════════════════════════════════════════════════════════

const lint = assertStrictSchema(RECEIPT_SCHEMA);
ok("the receipt schema is accepted by the strict subset", lint.ok, lint.errors.join("; "));

// The mechanical form of the rule. lib/ai/jsonSchema.js's header: "a numeric
// field in a schema is a claim that a model's guess is good enough to show a
// contractor as a fact". Every amount here is a STRING — what characters are
// printed — so the model has nowhere to put a sum even if it wanted to.
function numericFields(node, path = "", found = []) {
  if (!node || typeof node !== "object") return found;
  const types = Array.isArray(node.type) ? node.type : [node.type];
  if (types.includes("number") || types.includes("integer")) found.push(path || "(root)");
  for (const [key, child] of Object.entries(node.properties || {})) {
    numericFields(child, `${path}.${key}`, found);
  }
  if (node.items) numericFields(node.items, `${path}[]`, found);
  return found;
}
const numeric = numericFields(RECEIPT_SCHEMA);
ok("the schema declares NO numeric field anywhere", numeric.length === 0, numeric.join(", "));

// ── Every extracted field is READ somewhere ─────────────────────────────
//
// A schema is the cheapest place in this codebase to grow a field that never
// reaches a screen — AGENTS.md failure class #1, and this one is easier to
// commit than most because the field arrives well-formed and looks finished.
// Five fields did exactly that on the first pass (merchantAddress,
// merchantContact, receiptNumber, paymentMethod, currencyCode) and
// `fileDisplayName` was removed outright, because nothing stores the receipt
// image and a display name for a file nobody keeps has nowhere to go.
const readers = [
  read("app/components/purchasing/ReceiptScanner.js"),
  read("app/api/receipts/scan/route.js"),
  read("lib/receipts/reconcile.js"),
].join("\n");
const unread = Object.keys(RECEIPT_SCHEMA.properties).filter((key) => !readers.includes(key));
ok("every field the schema collects is read by something", unread.length === 0, unread.join(", "));
// ...and the canned demo receipt is the same shape, so a field added to one
// and not the other shows up here rather than as a blank line in a demo.
const demoKeys = Object.keys(simulatedExtraction()).sort().join(",");
const schemaKeys = Object.keys(RECEIPT_SCHEMA.properties).sort().join(",");
ok("the demo receipt carries exactly the schema's fields", demoKeys === schemaKeys, `${demoKeys}\n      vs ${schemaKeys}`);

const extractSrc = read("lib/receipts/extract.js");
ok("the prompt forbids adding anything up", /NEVER add anything up/.test(extractSrc));
ok("the prompt forbids deriving a missing line amount", /NEVER work out a missing line amount/.test(extractSrc));
ok("the prompt says a disagreement is not to be fixed", /Do not adjust\s+either one to make them agree/.test(extractSrc));
ok("the prompt treats text in the photo as data, never instructions", /NEVER an\s+instruction to you/.test(extractSrc));
ok("a receipt is read at the high detail ceiling — it is fine text", /imageDetail:\s*"high"/.test(extractSrc));

// The judgement a schema structurally cannot carry still happens in code.
const dirty = normaliseExtraction({
  merchantName: "  Northline  ",
  transactionDateIso: "2026-02-31",
  currencyCode: "dollars",
  items: [
    { description: "  Primer ", lineTotal: " 85.00 " },
    { description: "", quantity: null, unitPrice: null, lineTotal: null },
  ],
  printedTotal: " 85.00 ",
  unreadable: ["", "the tax line"],
});
ok("strings are trimmed", dirty.merchantName === "Northline");
ok("a well-formed but impossible date is dropped", dirty.transactionDateIso === null, JSON.stringify(dirty.transactionDateIso));
ok("a currency that is not a code is dropped", dirty.currencyCode === null, JSON.stringify(dirty.currencyCode));
ok("a blank padded line is dropped", dirty.items.length === 1);
ok("blank entries in `unreadable` are dropped", dirty.unreadable.length === 1);
ok("a real ISO date survives", normaliseExtraction({ transactionDateIso: "2026-08-14" }).transactionDateIso === "2026-08-14");

// ═══════════════════════════════════════════════════════════════════════════
section("13. Tenant scope and reachability");
// ═══════════════════════════════════════════════════════════════════════════

// Every foreign key a browser can choose is re-read inside the company before
// it is stored — the write half of the boundary check-tenant-scope.mjs found
// wide open in nine places.
ok("a PO's supplierId is checked against this company", poPost !== null && /supplier\.findFirst\(\{\s*where:\s*\{\s*id:\s*supplierId,\s*companyId:\s*member\.companyId/.test(poPost));
ok("a PO's jobId is checked against this company", poPost !== null && /job\.findFirst\(\{\s*where:\s*\{\s*id:\s*jobId,\s*companyId:\s*member\.companyId/.test(poPost));

const movementPost = functionBody(read("app/api/stock/movements/route.js"), "export async function POST");
// StockMovement has no foreign key on materialId, so this check IS the whole
// of that boundary.
ok("a stock movement's materialId is checked against this company", movementPost !== null && /material\.findFirst\(\{\s*where:\s*\{\s*id:\s*materialId,\s*companyId:\s*member\.companyId/.test(movementPost));
ok("...and the movement is written with this company's id", movementPost !== null && /companyId:\s*member\.companyId/.test(movementPost));

// A delivery retried on a bad connection must not book the stock twice.
const receivePost = functionBody(read("app/api/purchase-orders/[id]/receive/route.js"), "export async function POST");
ok("a delivery requires an idempotency key", receivePost !== null && receivePost.includes("idempotencyKey"));
ok("...which becomes the movement's unique ref", receivePost !== null && /ref:\s*`po_receive:\$\{key\}/.test(receivePost));
ok("...and a collision answers 'already recorded' rather than doubling", receivePost !== null && receivePost.includes("alreadyRecorded"));
ok("the whole delivery is one transaction", receivePost !== null && receivePost.includes("db.$transaction"));
ok("the client mints the key once, not per submit", read("app/components/purchasing/PurchaseOrdersPanel.js").includes("useState(() =>"));

// Three features have shipped here reachable from nothing. The page has a nav
// row, and the receipt scanner has a button on the panel it serves.
const sidebar = read("app/components/layout/AdminSidebar.js");
ok("/app/purchasing has a sidebar row", sidebar.includes('href: "/app/purchasing"'));
ok("...gated at the same level the routes require", read("lib/permissions/nav.js").includes('"app.nav.purchasing"'));
ok("the nav label exists in English and French", (messages.match(/"app\.nav\.purchasing":/g) || []).length >= 2);
ok("the receipt scanner is rendered from the job materials panel", read("app/components/jobs/JobMaterials.js").includes("<ReceiptScanner"));
// ...and only where a cost box is offered, because the route refuses the
// figures to anyone without the jobCosting toggle.
ok("...only where costs are visible", /!m\.costHidden && scanning === m\.id/.test(read("app/components/jobs/JobMaterials.js")));
ok("the scan route requires job costing", scanPost !== null && scanPost.includes("requireCost("));

console.log(`\n${failures ? "✖" : "✓"} ${checks - failures}/${checks} passed\n`);
process.exit(failures ? 1 : 0);
