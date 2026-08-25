// scripts/check-invoice-numbering.mjs
//
// Q-2026-0008 used to bill as INV-2026-0014 and nothing on either document
// said they were the same job. An invoice raised against a quote now takes
// that quote's number; one raised on its own continues the sequence.
//
// Executed against a fake `tx` rather than the database, because the thing
// worth proving is the allocation rule and the collision behaviour — a number
// handed out twice is a client dispute, and invoiceNumber has no unique
// constraint to catch it.

import {
  invoiceNumberFromQuote,
  getNextInvoiceNumber,
  allocateInvoiceNumber,
} from "../lib/invoices/invoiceNumber.js";

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fail++; console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`); }
  else console.log(`pass  ${name}`);
};
const YEAR = new Date().getFullYear();
const tx = (numbers) => ({
  invoice: { findMany: async () => numbers.map((invoiceNumber) => ({ invoiceNumber })) },
});

// ── Mirroring ─────────────────────────────────────────────────────────────
ok("Q-2026-0008 → INV-2026-0008", invoiceNumberFromQuote("Q-2026-0008") === "INV-2026-0008");
ok("the year travels with it", invoiceNumberFromQuote("Q-2019-0142") === "INV-2019-0142");
for (const junk of ["", null, undefined, "QUOTE-8", "Q-8", "Q-2026", "INV-2026-0008", "  ", "Q-26-0008", 8, {}])
  ok(`unrecognised quote number yields null: ${JSON.stringify(junk)}`, invoiceNumberFromQuote(junk) === null);
ok("surrounding whitespace is tolerated", invoiceNumberFromQuote("  Q-2026-0008  ") === "INV-2026-0008");

// ── Allocation ────────────────────────────────────────────────────────────
ok("an invoice from a quote borrows its number",
   (await allocateInvoiceNumber(tx(["INV-2026-0001", "INV-2026-0002"]), {
     companyId: "c", quoteNumber: "Q-2026-0008" })) === "INV-2026-0008");

ok("no quote → the sequence continues from the HIGHEST issued, not the newest",
   (await allocateInvoiceNumber(tx([`INV-${YEAR}-0009`, `INV-${YEAR}-0002`]), {
     companyId: "c" })) === `INV-${YEAR}-0010`);

ok("first invoice ever",
   (await allocateInvoiceNumber(tx([]), { companyId: "c" })) === `INV-${YEAR}-0001`);

// The whole reason the free-check exists: the borrowed number is already out.
ok("a borrowed number that is taken falls back to the sequence",
   (await allocateInvoiceNumber(tx([`INV-${YEAR}-0008`]), {
     companyId: "c", quoteNumber: `Q-${YEAR}-0008` })) === `INV-${YEAR}-0009`);

// Mirroring leaves holes — quotes that were never accepted. The sequence must
// not try to fill them, or two invoices end up sharing a number.
ok("holes left by unaccepted quotes are not back-filled",
   (await allocateInvoiceNumber(tx([`INV-${YEAR}-0001`, `INV-${YEAR}-0005`]), {
     companyId: "c" })) === `INV-${YEAR}-0006`);

ok("preferQuoteNumber:false keeps the plain sequence (EU gapless VAT rules)",
   (await allocateInvoiceNumber(tx([`INV-${YEAR}-0003`]), {
     companyId: "c", quoteNumber: `Q-${YEAR}-0008`, preferQuoteNumber: false })) === `INV-${YEAR}-0004`);

// ── A revised invoice keeps its number ───────────────────────────────────
//
// There is no allocation for one, deliberately: `parentInvoiceId` is
// versioning, and v2 of INV-2026-0008 is still INV-2026-0008. This asserts the
// sequence isn't confused by a number that has been through that path, and
// that no unused "follow-up" branch has crept back in.
ok("allocate takes no parentNumber argument",
   !/parentNumber/.test(allocateInvoiceNumber.toString()));
ok("a suffixed number does not hijack the sequence",
   (await allocateInvoiceNumber(tx([`INV-${YEAR}-0008`, `INV-${YEAR}-0008-2`]), {
     companyId: "c" })) === `INV-${YEAR}-0009`);

// ── Nothing is ever issued twice ──────────────────────────────────────────
const issued = new Set([`INV-${YEAR}-0001`]);
for (let i = 0; i < 50; i++) {
  const n = await allocateInvoiceNumber(tx([...issued]), {
    companyId: "c",
    // Every other one tries to borrow the SAME quote number, which is the
    // worst case: the borrow must lose after the first.
    quoteNumber: i % 2 === 0 ? `Q-${YEAR}-0002` : null,
  });
  if (issued.has(n)) { fail++; console.log(`FAIL  duplicate issued on round ${i}: ${n}`); break; }
  issued.add(n);
}
ok("50 allocations, no repeats", issued.size === 51, String(issued.size));

// ── The old helper still behaves for callers that only want "+1" ──────────
ok("getNextInvoiceNumber unchanged", getNextInvoiceNumber("INV-2020-0007", 2020) === "INV-2020-0008");
ok("getNextInvoiceNumber from nothing", getNextInvoiceNumber(null, 2020) === "INV-2020-0001");

console.log(fail === 0 ? "\nALL PASS — a quote and its invoice share a number, and no number is issued twice" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
