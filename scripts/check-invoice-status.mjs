// scripts/check-invoice-status.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-invoice-status.mjs
//
// Every InvoiceStatus renders as a coloured chip with a translated label, in
// all six languages, on both pages that show one.
//
// ── What this is guarding against, concretely ──────────────────────────────
//
// The invoices list and the invoice detail page each held a STATUS_STYLES map
// with four keys, copied from the quotes list where four is right. InvoiceStatus
// has seven. `STATUS_STYLES[status]` on the three it never learned about
// returned undefined, the template literal rendered the word, and the chip came
// out as class="… rounded-full undefined" — no colour at all — beside the raw
// column name `partially_refunded`.
//
// The important part is that nothing failed. No error, no blank page. The badge
// for a live chargeback was simply the least visible thing on the money screen.
//
// ── Why it reads the schema instead of a list of seven strings ─────────────
//
// A hardcoded list here would pass forever the day someone adds an eighth
// status — the check would agree with itself while the pages fell behind, which
// is the exact shape of the bug it exists to catch. So the enum is parsed out
// of prisma/schema.prisma and treated as the only authority.

import { readFileSync } from "node:fs";
import {
  INVOICE_STATUS_PRESENTATION,
  INVOICE_TONE_CLASSES,
  invoiceStatusClasses,
  invoiceStatusPresentation,
} from "@/lib/invoices/statusPresentation";

let pass = 0;
const failures = [];
function ok(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── 1. The enum, from the schema itself ────────────────────────────────────
const schema = read("prisma/schema.prisma");
const enumMatch = schema.match(/enum InvoiceStatus\s*\{([\s\S]*?)\n\}/);
ok(!!enumMatch, "enum InvoiceStatus is present in prisma/schema.prisma");
const STATUSES = (enumMatch ? enumMatch[1] : "")
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, "").trim())
  .filter((l) => /^[a-z_]+$/.test(l));

// If this ever reads as fewer than the five that predate refunds, the regex has
// silently stopped matching and every assertion below would vacuously pass.
ok(STATUSES.length >= 5, `parsed a plausible enum (got ${STATUSES.length})`);
ok(STATUSES.includes("disputed"), "the parse reaches the end of the enum");

// ── 2. Exhaustive both ways ────────────────────────────────────────────────
for (const s of STATUSES) {
  ok(
    Object.prototype.hasOwnProperty.call(INVOICE_STATUS_PRESENTATION, s),
    `presentation covers "${s}"`,
  );
}
for (const k of Object.keys(INVOICE_STATUS_PRESENTATION)) {
  ok(STATUSES.includes(k), `"${k}" is a real InvoiceStatus, not a stale key`);
}

// ── 3. Every status resolves to a real chip ────────────────────────────────
for (const s of STATUSES) {
  const cls = invoiceStatusClasses(s);
  ok(typeof cls === "string" && cls.length > 0, `"${s}" yields classes`);
  ok(!/undefined|null/.test(cls), `"${s}" classes contain no undefined/null`);
  ok(/bg-/.test(cls), `"${s}" actually paints a background`);
  const { tone, labelKey } = invoiceStatusPresentation(s);
  ok(!!INVOICE_TONE_CLASSES[tone], `"${s}" tone "${tone}" is defined`);
  ok(
    typeof labelKey === "string" && labelKey.startsWith("app.status."),
    `"${s}" has an app.status.* label key`,
  );
}

// ── 4. The labels exist, in every language ─────────────────────────────────
//
// appMessages.js is six dictionaries in one file. Counting occurrences across
// the whole file is the assertion that catches a key added to English only —
// the failure that ships an English word into a Punjabi office.
const messages = read("app/i18n/appMessages.js");
const LANGS = (messages.match(/^const (en|fr|es|uk|pa|tl) = \{$/gm) || []).length;
ok(LANGS === 6, `found all six language blocks (got ${LANGS})`);
for (const s of STATUSES) {
  const { labelKey } = invoiceStatusPresentation(s);
  const n = messages.split(`"${labelKey}":`).length - 1;
  ok(n === LANGS, `"${labelKey}" is translated ${LANGS}× (found ${n})`);
}

// ── 5. Neither page kept a private copy ────────────────────────────────────
//
// The whole point was to stop two maps drifting from one enum. A page that
// re-declares STATUS_STYLES has restarted the bug, so it fails here even if it
// happens to be complete on the day it is written.
for (const p of ["app/app/invoices/page.js", "app/app/invoices/[id]/page.js"]) {
  const src = read(p);
  ok(!/const STATUS_STYLES/.test(src), `${p} declares no local STATUS_STYLES`);
  ok(
    src.includes("invoiceStatusClasses"),
    `${p} takes its chip classes from the shared module`,
  );
  ok(
    !/t\(`app\.status\.\$\{/.test(src),
    `${p} builds no runtime translation key (check:translations cannot see one)`,
  );
}

// ── 6. An unknown status degrades honestly ─────────────────────────────────
//
// Not decoration: a status added to the schema and deployed before the UI
// catches up must not borrow another status's colour or, worse, its WORD.
// "Draft" on a disputed invoice is a false statement about money.
for (const junk of ["", null, undefined, "void_where_prohibited", "PAID"]) {
  const cls = invoiceStatusClasses(junk);
  ok(
    typeof cls === "string" && !/undefined|null/.test(cls),
    `unknown status ${JSON.stringify(junk)} still yields clean classes`,
  );
  ok(
    invoiceStatusPresentation(junk).labelKey === null,
    `unknown status ${JSON.stringify(junk)} claims no label of its own`,
  );
}

// ── 7. Red stays scarce ────────────────────────────────────────────────────
//
// The tone assignment is a judgement, so this pins the judgement rather than
// re-deriving it: red means "act on this today". A refund the contractor issued
// themselves is settled, and colouring settled money like an emergency is how a
// screen teaches people to stop seeing red.
ok(
  invoiceStatusPresentation("overdue").tone === "urgent" &&
    invoiceStatusPresentation("disputed").tone === "urgent",
  "overdue and disputed are the urgent pair",
);
ok(
  invoiceStatusPresentation("refunded").tone === "reversed" &&
    invoiceStatusPresentation("partially_refunded").tone === "reversed",
  "refunds are reversed, not urgent",
);
ok(
  invoiceStatusPresentation("paid").tone !== "urgent",
  "paid is never urgent",
);

if (failures.length) {
  console.error(`check:invoice-status FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check:invoice-status passed — ${STATUSES.length} statuses × ${LANGS} languages, ` +
    `2 pages, ${pass} assertions.`,
);
