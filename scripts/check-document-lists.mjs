// scripts/check-document-lists.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-document-lists.mjs
//
// The quotes list and the invoices list — the two screens where a contractor
// decides what to chase today.
//
// ══ What this proves ══════════════════════════════════════════════════════
//
// Three things, in descending order of how much they matter.
//
//   1. THE ARITHMETIC, EXECUTED. Every ranking, age, expiry and balance on
//      those two screens comes from four pure functions, and this script runs
//      them against the rows a rendered page is worst at showing you: a quote
//      marked sent with no send date, a quote that never expires, a draft
//      invoice whose due date is in the past, a disputed invoice whose balance
//      says settled, an empty list, a null list. Reading that logic proves
//      nothing; the two live bugs it replaced both READ fine.
//
//   2. THE TILE AND THE ROWS RECONCILE. The invoices Outstanding tile summed
//      `amountDue` while every row printed `inv.total`, so the column could
//      never add up to the number above it. The reconciliation is asserted here
//      as an identity — Σ(row balance) === tile — against a scripted book, so
//      the next person to "simplify" one of them fails the build instead of
//      shipping two answers to one question.
//
//   3. THE LIST AGREES WITH THE INVOICE IT LINKS TO. `invoiceRowState().overdue`
//      is asserted to fire on exactly the invoices `selectInvoiceBanners()`
//      raises an "overdue" banner for. A list that calls something late and a
//      document that doesn't is the disagreement this repo keeps finding.
//
// Plus the two mechanical rules the review's findings were about: the
// follow-up queue must be CLICKABLE (a number you cannot act on is the quietest
// version of a control that appears to work and doesn't), and every colour
// these pages type is measured rather than assumed.
//
// ══ What it cannot prove ══════════════════════════════════════════════════
//
// Nothing here renders. It cannot say the layout fits a phone (check:mobile
// holds both files at its strict tier), that the rows are readable, or that the
// re-ranking is the right ranking — that was a product decision and this only
// pins it. Class lists it cannot resolve statically are COUNTED and printed,
// never silently passed.

import { readFileSync } from "node:fs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABEL_KEYS,
  QUOTE_STATUS_CLASSES,
  quoteStatusClasses,
  quoteStatusLabel,
} from "@/lib/quotes/statusLabels";
import {
  QUOTE_EXPIRY_SOON_DAYS,
  countQuotesByStatus,
  quoteAgeDays,
  quoteExpiry,
  quoteNeedsChasing,
  rankQuotes,
} from "@/lib/quotes/listRanking";
import { invoiceRowState, summariseInvoices } from "@/lib/invoices/listSummary";
import { selectInvoiceBanners, PAID_EPSILON } from "@/lib/invoices/lifecycle";

// ── ok(label, condition) ───────────────────────────────────────────────────
//
// Label FIRST. Two check scripts in this repo take the arguments the other way
// round, and calling one with the other's order gives you a truthy string as
// the condition and a silent, permanent pass. The parameter names below are the
// only defence, so they are not abbreviated.
let passes = 0;
const failures = [];
function ok(label, condition, detail = "") {
  if (condition) passes++;
  else failures.push(`${label}${detail ? `  — ${detail}` : ""}`);
}
const section = (title) => console.log(`\n${title}`);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Comments blanked, string bodies kept — for every rule about source text. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const QUOTES_PAGE = "app/app/quotes/page.js";
const INVOICES_PAGE = "app/app/invoices/page.js";
const quotesSrc = stripComments(read(QUOTES_PAGE));
const invoicesSrc = stripComments(read(INVOICES_PAGE));

// stripComments is the trap that produced a false pass in this repo before: a
// rule about literals, run over a file whose COMMENTS mention the literal,
// passes for a page that no longer renders it. Proved here rather than assumed.
section("The helper this file's source rules rest on");
ok(
  "stripComments removes a // comment's text",
  !/secretmarker/.test(stripComments("const a = 1; // secretmarker\n")),
);
ok(
  "stripComments removes a /* */ comment's text",
  !/secretmarker/.test(stripComments("/* secretmarker */ const a = 1;")),
);
ok(
  "stripComments keeps real code",
  /const a = 1/.test(stripComments("const a = 1; // x\n")),
);
ok(
  "stripComments does not eat a URL's //",
  /https:\/\/x\.test/.test(stripComments('const u = "https://x.test";')),
);

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Quote ages, expiries and ranking — executed
// ═══════════════════════════════════════════════════════════════════════════

const NOW = new Date("2026-09-03T14:00:00");
const day = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const inDays = (n) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

section("Quote age — which column it is allowed to claim");

ok(
  "a sent quote is aged from sentAt",
  quoteAgeDays({ status: "sent", sentAt: day(12), createdAt: day(40) }, NOW).days === 12,
);
ok(
  "…and says so",
  quoteAgeDays({ status: "sent", sentAt: day(12), createdAt: day(40) }, NOW).from === "sentAt",
);
// The finding that matters most here. sentAt is written only after Resend
// accepts the message, so a price agreed on the phone and marked sent by hand
// has status "sent" and no send date. Falling back to createdAt would make the
// row claim a send that never happened.
ok(
  "a quote marked sent by hand — no sentAt — is NOT aged from createdAt",
  quoteAgeDays({ status: "sent", sentAt: null, createdAt: day(40) }, NOW).days === null,
);
ok(
  "…and names no column rather than the wrong one",
  quoteAgeDays({ status: "sent", sentAt: null, createdAt: day(40) }, NOW).from === null,
);
ok(
  "a draft is aged from createdAt",
  quoteAgeDays({ status: "draft", createdAt: day(2) }, NOW).days === 2,
);
ok(
  "an accepted quote is aged from createdAt, not sentAt",
  quoteAgeDays({ status: "accepted", sentAt: day(30), createdAt: day(4) }, NOW).from ===
    "createdAt",
);
ok("today is 0, not 1", quoteAgeDays({ status: "draft", createdAt: NOW }, NOW).days === 0);
ok(
  "a future date is not an age",
  quoteAgeDays({ status: "draft", createdAt: inDays(3) }, NOW).days === null,
);
ok(
  "an unparseable date yields null, never NaN",
  quoteAgeDays({ status: "draft", createdAt: "not a date" }, NOW).days === null,
);
ok("a missing quote does not throw", quoteAgeDays(null, NOW).days === null);

section("Quote expiry — absence stays absence");

ok(
  "no validUntil returns null, not 'expires soon'",
  quoteExpiry({ status: "sent", validUntil: null }, NOW) === null,
);
ok(
  "an unparseable validUntil returns null",
  quoteExpiry({ validUntil: "whenever" }, NOW) === null,
);
{
  const far = quoteExpiry({ validUntil: inDays(18) }, NOW);
  ok("18 days out is neither expired nor soon", far && !far.expired && !far.soon);
  const soon = quoteExpiry({ validUntil: inDays(QUOTE_EXPIRY_SOON_DAYS) }, NOW);
  ok(`${QUOTE_EXPIRY_SOON_DAYS} days out is soon`, soon && soon.soon && !soon.expired);
  const edge = quoteExpiry({ validUntil: inDays(QUOTE_EXPIRY_SOON_DAYS + 1) }, NOW);
  ok("one day past the threshold is not soon", edge && !edge.soon);
  const today = quoteExpiry({ validUntil: NOW }, NOW);
  // "Expires today" is the most urgent version of soon, not a boundary to round
  // away — and it is emphatically not expired yet.
  ok("expiring today is soon and not expired", today && today.soon && !today.expired);
  const gone = quoteExpiry({ validUntil: day(1) }, NOW);
  ok("yesterday is expired", gone && gone.expired && !gone.soon);
  ok("…and carries a negative daysLeft", gone && gone.daysLeft === -1);
}

section("Which rows earn the accent bar");

ok(
  "a sent quote expiring tomorrow does",
  quoteNeedsChasing({ status: "sent", validUntil: inDays(1) }, NOW),
);
ok(
  "an EXPIRED sent quote does",
  quoteNeedsChasing({ status: "sent", validUntil: day(9) }, NOW),
);
ok(
  "a sent quote with a month left does not",
  !quoteNeedsChasing({ status: "sent", validUntil: inDays(30) }, NOW),
);
// A quote with no expiry never expires. That is a real state the builder offers
// (clear the box), and turning it into an urgent row would be the screen making
// up a deadline nobody set.
ok(
  "a sent quote with no expiry does not",
  !quoteNeedsChasing({ status: "sent", validUntil: null }, NOW),
);
ok(
  "an ACCEPTED quote past its expiry does not — it is signed work, not a chase",
  !quoteNeedsChasing({ status: "accepted", validUntil: day(9) }, NOW),
);
ok(
  "a draft past its expiry does not",
  !quoteNeedsChasing({ status: "draft", validUntil: day(9) }, NOW),
);

section("The ranking");

const QUOTES = [
  { id: "d1", status: "draft", createdAt: day(2), total: "2180" },
  { id: "s-new", status: "sent", sentAt: day(12), createdAt: day(13), total: "8450" },
  { id: "a1", status: "accepted", createdAt: day(4), total: "14900" },
  { id: "s-old", status: "sent", sentAt: day(31), createdAt: day(32), total: "960.5" },
  { id: "s-undated", status: "sent", sentAt: null, createdAt: day(5), total: "300" },
  { id: "x1", status: "declined", createdAt: day(8), total: "70" },
];

{
  const before = QUOTES.map((q) => q.id).join(",");
  const { chase, rest } = rankQuotes(QUOTES, NOW);
  ok(
    "the chase group is every quote at status sent, and only those",
    chase.every((q) => q.status === "sent") && chase.length === 3,
    `got ${chase.map((q) => q.id).join(",")}`,
  );
  ok(
    "oldest sent first — the one whose client has had longest to forget it",
    chase[0].id === "s-old" && chase[1].id === "s-new",
    `got ${chase.map((q) => q.id).join(",")}`,
  );
  // An unknown date is not "the oldest". A row that cannot be placed in time
  // must not be promoted to the top of a queue built out of time.
  ok(
    "a sent quote with no sentAt falls back to createdAt rather than jumping the queue",
    chase[2].id === "s-undated",
    `got ${chase.map((q) => q.id).join(",")}`,
  );
  ok(
    "everything else keeps the order the API sent",
    rest.map((q) => q.id).join(",") === "d1,a1,x1",
    `got ${rest.map((q) => q.id).join(",")}`,
  );
  ok("nothing is lost between the two groups", chase.length + rest.length === QUOTES.length);
  ok("the caller's array is not re-ordered in place", QUOTES.map((q) => q.id).join(",") === before);
}
ok("a null list ranks to two empty groups, not a throw", rankQuotes(null, NOW).chase.length === 0);
ok("…and an empty rest", rankQuotes(undefined, NOW).rest.length === 0);

section("The chip counts");

// The whole reason the tiles it replaced rendered an em dash. "Approved 0" on a
// transient 401 tells a contractor their won work vanished.
ok("a null list counts to null, NEVER to zero", countQuotesByStatus(null) === null);
ok("…and so does a non-array", countQuotesByStatus("nope") === null);
{
  const c = countQuotesByStatus(QUOTES);
  ok("all counts every row", c.all === 6);
  ok("draft", c.draft === 1);
  ok("sent counts the follow-up queue", c.sent === 3);
  ok("accepted", c.accepted === 1);
  ok("declined", c.declined === 1);
  ok(
    "the chip counts and the chase group agree about how many are sent",
    c.sent === rankQuotes(QUOTES, NOW).chase.length,
  );
  ok("an empty list is zeros, which is a real answer", countQuotesByStatus([]).all === 0);
  const junk = countQuotesByStatus([{ status: "on_hold" }, { status: null }, {}]);
  ok("a status nobody added does not throw", junk.all === 3);
  ok("…and does not inflate a real bucket", junk.draft === 0 && junk.sent === 0);
}

section("Quote status labels — the raw enum never reaches a French office");

ok("every QuoteStatus has a label key", QUOTE_STATUSES.every((s) => QUOTE_STATUS_LABEL_KEYS[s]));
ok(
  "…and a chip class",
  QUOTE_STATUSES.every((s) => typeof QUOTE_STATUS_CLASSES[s] === "string"),
);
ok(
  "accepted borrows app.status.approved — one word for one meaning, shared with the detail page",
  QUOTE_STATUS_LABEL_KEYS.accepted[0] === "app.status.approved",
);
ok(
  "an unknown status still yields clean classes",
  typeof quoteStatusClasses("on_hold") === "string" &&
    !/undefined|null/.test(quoteStatusClasses("on_hold")),
);
ok("…and for null", !/undefined|null/.test(quoteStatusClasses(null)));
ok(
  "an unknown status renders the tidied value, not a blank badge",
  quoteStatusLabel("on_hold", null) === "on hold",
);
ok("quoteStatusLabel works without a t()", quoteStatusLabel("draft", null) === "Draft");
ok(
  "…and prefers t() when given one",
  quoteStatusLabel("draft", (k) => `T:${k}`) === "T:app.status.draft",
);

// The enum is the authority, not a list typed here.
{
  const schema = read("prisma/schema.prisma");
  const m = schema.match(/enum QuoteStatus\s*\{([\s\S]*?)\n\}/);
  ok("enum QuoteStatus is present in the schema", !!m);
  const statuses = (m ? m[1] : "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => /^[a-z_]+$/.test(l));
  // If this ever parses as fewer than the four that have always existed, the
  // regex has stopped matching and every assertion below would vacuously pass.
  ok(`parsed a plausible enum (got ${statuses.length})`, statuses.length >= 4);
  for (const s of statuses) {
    ok(`the label map covers "${s}"`, Boolean(QUOTE_STATUS_LABEL_KEYS[s]));
  }
  for (const k of Object.keys(QUOTE_STATUS_LABEL_KEYS)) {
    ok(`"${k}" is a real QuoteStatus, not a stale key`, statuses.includes(k));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Invoice rows and tiles — executed, and reconciled
// ═══════════════════════════════════════════════════════════════════════════

section("One invoice row at a time");

{
  const r = invoiceRowState(
    { status: "sent", total: "1000", amountPaid: "600", amountDue: "400", dueDate: day(21) },
    NOW,
  );
  ok("the balance is what the API wrote in amountDue", r.due === 400);
  ok("…and the row is 21 days past due", r.daysLate === 21 && r.overdue);
  ok("…and is not treated as paid off", !r.paidOff);
}
{
  // Rows written before amountDue was seeded. total − paid, never total.
  const r = invoiceRowState({ status: "sent", total: "1000", amountPaid: "600" }, NOW);
  ok("a null amountDue falls back to total − paid, not to total", r.due === 400);
}
{
  const r = invoiceRowState(
    { status: "draft", total: "500", amountPaid: "0", amountDue: "500", dueDate: day(60) },
    NOW,
  );
  // A draft was never billed to anybody, so nobody is late. That is the
  // office's own backlog, and lifecycle.js says the same thing.
  ok("a DRAFT with a due date two months past is not overdue", !r.overdue);
  ok("…and reports no day count at all rather than 60", r.daysLate === null);
}
{
  const r = invoiceRowState({ status: "sent", total: "500", amountDue: "500" }, NOW);
  ok("an invoice with no due date is not overdue", !r.overdue);
  ok("…and it is 'no date', not 'zero days'", r.daysLate === null);
}
{
  const r = invoiceRowState(
    { status: "paid", total: "800", amountPaid: "800", amountDue: "0", dueDate: day(30) },
    NOW,
  );
  ok("a settled invoice is never called late", !r.overdue && r.daysLate === null);
  ok("…and is flagged paid off", r.paidOff);
}
{
  // A $0 invoice owes nothing and has never been paid. lifecycle.js draws this
  // distinction deliberately and the row has to keep it: "Paid in full" over a
  // document nobody paid is an invented payment.
  const r = invoiceRowState({ status: "sent", total: "0", amountPaid: "0", amountDue: "0" }, NOW);
  ok("a $0 invoice is settled but NOT paid off", r.settled && !r.paidOff);
}
{
  // A chargeback leaves amountPaid/amountDue alone while the bank decides, so
  // the money reads exactly as it did before. lifecycle.js excludes disputed
  // from "paid in full" for that reason; the row must not re-introduce it.
  const r = invoiceRowState(
    { status: "disputed", total: "5900", amountPaid: "5900", amountDue: "0", dueDate: day(6) },
    NOW,
  );
  ok("a DISPUTED invoice whose balance says settled is not 'paid off'", !r.paidOff);
}
ok("a missing invoice does not throw", invoiceRowState(null, NOW).total === 0);
ok(
  "an unparseable dueDate is 'no due date', not day zero",
  invoiceRowState({ status: "sent", total: "1", dueDate: "soonish" }, NOW).daysLate === null,
);

section("The list agrees with the invoice it links to");

// The strongest assertion here: the row's overdue flag must fire on exactly the
// invoices lib/invoices/lifecycle.js raises an "overdue" banner for. A list that
// calls something late and a document that doesn't is the disagreement this
// codebase keeps finding.
const BOOK = [
  { id: "i1", status: "overdue", total: "14900", amountPaid: "10000", amountDue: "4900", dueDate: day(21) },
  { id: "i2", status: "sent", total: "8450", amountPaid: "0", amountDue: "8450", dueDate: inDays(7) },
  { id: "i3", status: "partially_refunded", total: "3200", amountPaid: "3200", amountDue: "0", amountRefunded: "800", dueDate: day(14) },
  { id: "i4", status: "disputed", total: "5900", amountPaid: "5900", amountDue: "0", dueDate: day(6) },
  { id: "i5", status: "paid", total: "2000", amountPaid: "2000", amountDue: "0", dueDate: day(40) },
  { id: "i6", status: "draft", total: "700", amountPaid: "0", amountDue: "700", dueDate: day(3) },
  { id: "i7", status: "sent", total: "1200", amountPaid: "0", amountDue: "1200" },
];

for (const invoice of BOOK) {
  const row = invoiceRowState(invoice, NOW);
  const banners = selectInvoiceBanners({ invoice, job: {}, now: NOW });
  const banner = banners.find((b) => b.id === "overdue");
  ok(
    `${invoice.id}: the row and the invoice's own banner agree on "overdue"`,
    Boolean(banner) === row.overdue,
    `row=${row.overdue} banner=${Boolean(banner)}`,
  );
  if (banner) {
    ok(`${invoice.id}: …and on how many days`, banner.data.days === row.daysLate);
    ok(`${invoice.id}: …and on how much is still owing`, banner.data.due === row.due);
  }
}

section("The tiles and the rows add up");

{
  const s = summariseInvoices(BOOK, NOW);
  const rows = BOOK.map((i) => invoiceRowState(i, NOW));

  // THE identity. Finding 3.3 was that this could not hold: the tile summed
  // balances and the rows printed face values.
  const rowSum = rows
    .filter((r) => r.due > PAID_EPSILON)
    .reduce((a, r) => a + r.due, 0);
  ok(
    "Outstanding === the sum of the balances the rows print",
    Math.abs(s.money.outstanding - rowSum) < 0.005,
    `tile ${s.money.outstanding} vs rows ${rowSum}`,
  );
  ok("…and it is not the sum of face values", s.money.outstanding !== s.money.totalBilled);
  ok(
    "the overdue figure is a SUBSET of outstanding, never larger",
    s.money.overdueAmount <= s.money.outstanding && s.money.overdueAmount > 0,
  );
  ok(
    "the overdue figure is the sum of the balances the rows flag red",
    Math.abs(
      s.money.overdueAmount - rows.filter((r) => r.overdue).reduce((a, r) => a + r.due, 0),
    ) < 0.005,
  );
  ok("total billed is every face value", Math.abs(s.money.totalBilled - 36350) < 0.005);
  ok("paid is every amountPaid", Math.abs(s.money.paidAmount - 21100) < 0.005);

  // i1, i2, i6 (a draft — unbilled, but still money not yet collected) and i7.
  ok("the outstanding COUNT matches the rows with a balance", s.counts.outstanding === 4);
  ok("the overdue count matches the rows flagged red", s.counts.overdue === 1);
  ok("every row is counted once", s.counts.total === BOOK.length);
}

section("A summary is never invented");

ok("a null list summarises to null, not to $0.00", summariseInvoices(null, NOW) === null);
ok("…and so does a non-array", summariseInvoices("nope", NOW) === null);
{
  const empty = summariseInvoices([], NOW);
  ok("an empty book IS zero, and says so rather than null", empty.money.totalBilled === 0);
  ok("…with a count of zero", empty.counts.total === 0);
}
{
  // A member without showPricing gets the money columns REMOVED, not zeroed.
  // Summing them would print "$0.00 billed" over a book full of invoices.
  const hidden = summariseInvoices(
    [{ id: "h1", status: "sent", pricingHidden: true, dueDate: day(4) }],
    NOW,
  );
  ok("a redacted payload declares pricingHidden", hidden.pricingHidden);
  ok("…and yields NO money object to render", hidden.money === null);
  ok("…while the counts still work, because how many is not a price", hidden.counts.total === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · The screens themselves
// ═══════════════════════════════════════════════════════════════════════════

section("The follow-up queue is reachable");

// Finding 2.3, and the reason this whole redesign exists. "Awaiting reply: 7"
// and then no way to see those seven. A number nobody can act on is the
// quietest version of a control that appears to work and doesn't — nothing is
// broken, it just leads nowhere.
ok(
  "the quotes list has a filter control at all",
  /onClick=\{\(\)\s*=>\s*setFilter\(/.test(quotesSrc),
);
ok("…driven by real state", /useState\("all"\)/.test(quotesSrc));
ok("…and the list actually narrows on it", /filter !== "all" && q\.status !== filter/.test(quotesSrc));
ok(
  "…on a chip big enough to hit on a phone",
  /min-h-\[44px\]/.test(quotesSrc),
);
ok(
  "the counts still render, so nothing was lost turning tiles into filters",
  /counts \? counts\[key\]/.test(quotesSrc),
);
ok(
  "…and a failed load still shows an em dash rather than a confident zero",
  /counts \? counts\[key\] : "—"/.test(quotesSrc),
);

section("Dates reach the rows");

// Naming the whole expression, not the identifier. `quoteExpiry` still appears
// in a file whose row does `const expiry = null` — mutation-tested, and it
// survived a bare-identifier rule.
ok("the quotes list computes each row's age", /quoteAgeDays\(q, now\)/.test(quotesSrc));
ok("…and each row's expiry", /quoteExpiry\(q, now\)/.test(quotesSrc));
ok("…and ranks with the shared function", /rankQuotes\(filtered, now\)/.test(quotesSrc));
ok("…and prints the expiry date it computed", /formatDate\(expiry\.date\)/.test(quotesSrc));
// The age is a translated string with a number in it, never a sentence this
// page builds. `${n} days ago` in a template literal is English in a French
// office, and check:translations cannot see it because it has no app.* key.
ok(
  "the age goes through the catalogue",
  /t\("app\.quoteDetail\.daysAgo", \{ days: age\.days \}\)/.test(quotesSrc),
);
ok("…and the page writes no age sentence of its own", !/days ago/.test(quotesSrc));

// Finding 3.2: an "overdue" badge with no due date anywhere on the page.
ok(
  "the invoices list prints the due date",
  /t\("app\.dash\.owed\.dueOn", \{ date: formatDate\(row\.dueDate\) \}\)/.test(invoicesSrc),
);
ok(
  "…and how late it is, from the shared row state",
  /t\("app\.dash\.owed\.daysPastDue", \{ days: row\.daysLate \}\)/.test(invoicesSrc),
);

section("The row prints what the tile counts");

// Finding 3.3. `Number(inv.total)` on the row was the whole defect.
ok("the invoice row renders the BALANCE", /money\(row\.due\)/.test(invoicesSrc));
ok(
  "…and never re-derives money from a raw column",
  !/Number\(inv\.(total|amountDue|amountPaid)\)/.test(invoicesSrc),
);
ok("…through the shared row state", /invoiceRowState/.test(invoicesSrc));
ok("the tiles go through the same module", /summariseInvoices/.test(invoicesSrc));
ok(
  "…and no longer carry a private reduce over the rows",
  !/invoices\.reduce\(/.test(invoicesSrc),
);

section("No raw enum, no hand-typed currency");

// Finding 2.5: line 201 rendered `{q.status}` — lowercase English, in every
// office in the world.
ok("the quotes list does not render {q.status} raw", !/\{q\.status\}/.test(quotesSrc));
ok("…it goes through the shared label", /quoteStatusLabel\(q\.status, t\)/.test(quotesSrc));
ok("…and the shared chip classes", /quoteStatusClasses\(/.test(quotesSrc));
ok("no page-local STATUS_STYLES on the quotes list", !/const STATUS_STYLES/.test(quotesSrc));
ok("…nor on the invoices list", !/const STATUS_STYLES/.test(invoicesSrc));
for (const [name, src] of [
  [QUOTES_PAGE, quotesSrc],
  [INVOICES_PAGE, invoicesSrc],
]) {
  // `$${…}` is a dollar sign followed by an interpolation, and it reads as one
  // construct. FieldQuo bills in seven currencies.
  ok(`${name} types no currency symbol of its own`, !/\$\$\{/.test(src));
  ok(`${name} formats through the company's currency`, /useCompanyMoney/.test(src));
  // Finding 2.4 / 3.5: forty rows of proportional digits whose decimals do not
  // line up, on the pages whose whole job is a column of money.
  ok(`${name} aligns its figures`, /tabular-nums/.test(src));
}

section("Every key these screens ask for exists, in English AND French");

// check:translations already gates "the key exists"; this adds the half that
// matters for a bilingual product — an app.* key present in English only puts
// an English word in the middle of a French screen.
const LANGS = Object.keys(APP_MESSAGES);
ok(`found the language catalogue (got ${LANGS.length})`, LANGS.length >= 6);
{
  const keys = new Set();
  for (const src of [
    quotesSrc,
    invoicesSrc,
    stripComments(read("lib/quotes/statusLabels.js")),
    stripComments(read("lib/quotes/listRanking.js")),
    stripComments(read("lib/invoices/listSummary.js")),
  ]) {
    for (const m of src.matchAll(/["'](app\.[A-Za-z0-9_.]+)["']/g)) keys.add(m[1]);
  }
  ok(`the two screens reference a plausible number of keys (${keys.size})`, keys.size >= 15);
  for (const key of [...keys].sort()) {
    ok(`"${key}" has an English string`, APP_MESSAGES.en?.[key] !== undefined);
    ok(`"${key}" has a French string`, APP_MESSAGES.fr?.[key] !== undefined);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Colour, measured
// ═══════════════════════════════════════════════════════════════════════════
//
// check-mobile-surfaces.mjs measures THEME TOKENS on theme surfaces and says in
// its own header that it does not read Tailwind palette classes. Both of these
// pages now carry palette colours that carry meaning — red for money somebody
// is late paying, amber for a quote about to expire — so the pairs are measured
// here, from the palette's own definition file and the app's own globals.css.
// Neither hex is typed into this script.

section("The colour maths itself");

/** oklch(L C H) → sRGB hex. Tailwind v4 ships its palette in oklch only. */
function oklchToHex(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    lin
      .map((v) => {
        const c = Math.min(1, Math.max(0, v));
        const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(srgb * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

function relativeLuminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a, b) => {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// A converter that silently produced grey would make every pair below pass. So
// it is checked against values Tailwind publishes as its own hex fallbacks.
ok("oklch→hex: white", oklchToHex(1, 0, 0) === "#ffffff");
ok("oklch→hex: black", oklchToHex(0, 0, 0) === "#000000");
ok("oklch→hex: red-500 is #fb2c36", oklchToHex(0.637, 0.237, 25.331) === "#fb2c36");
ok("oklch→hex: blue-500 is #2b7fff", oklchToHex(0.623, 0.214, 259.815) === "#2b7fff");
ok("contrast: white on black is 21:1", Math.round(contrast("#ffffff", "#000000")) === 21);
ok("contrast: a colour on itself is 1:1", contrast("#123456", "#123456") === 1);

/** `--color-red-700: oklch(50.5% 0.213 27.518);` → hex, from the real palette. */
const PALETTE = (() => {
  const css = readFileSync(
    new URL("../node_modules/tailwindcss/theme.css", import.meta.url),
    "utf8",
  );
  const out = new Map();
  for (const m of css.matchAll(
    /--color-([a-z]+-\d{2,3}):\s*oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\)/g,
  )) {
    const L = m[2].includes(".") && Number(m[2]) > 1 ? Number(m[2]) / 100 : Number(m[2]);
    out.set(m[1], oklchToHex(L, Number(m[3]), Number(m[4])));
  }
  return out;
})();
ok(`parsed the Tailwind palette (${PALETTE.size} colours)`, PALETTE.size >= 200);
ok("…and it is the real one", PALETTE.get("red-500") === "#fb2c36");

/** `--card: #fff;` inside one block of app/globals.css. */
function cssTokens(css, selector) {
  const at = css.search(new RegExp(`(^|\\n)\\s*${selector}\\s*\\{`));
  if (at === -1) return new Map();
  const open = css.indexOf("{", at);
  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const out = new Map();
  for (const m of css.slice(open, end).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}
const THEME = read("app/globals.css");
const LIGHT = cssTokens(THEME, ":root");
const DARK = new Map([...LIGHT, ...cssTokens(THEME, "\\.dark")]);
ok("read the light theme from globals.css", LIGHT.get("card") !== undefined);
ok("read the dark theme too", DARK.get("card") !== LIGHT.get("card"));

section("Every palette colour these two screens type, measured");

// A row sits on --card and turns --muted on hover; both are real surfaces the
// text has to survive. Backgrounds a class list names for itself are measured
// against that instead.
const SURFACES = ["card", "muted"];
const FLOOR = 4.5;
let unreadable = 0;

/**
 * One class list split into the branches that can be on screen AT ONCE.
 *
 * Concatenating a ternary's branches is right for a rule that forbids a string
 * and catastrophic for one that PAIRS two: the selected/unselected chip in this
 * repo is `bg-inverted text-inverted-foreground : text-muted-foreground`, and
 * reading it as one list reports muted-foreground on inverted at 1.88:1 on a
 * dozen screens that are correct.
 */
// Every quoted literal inside every ${…}, each paired with the classes that are
// always present. NOT a `? "a" : "b"` pattern: the expiry colour on the quotes
// list is a NESTED ternary — `expired ? A : soon ? B : C` — and a two-branch
// regex matches only the inner pair, so the urgent branch was silently never
// measured. That is the mutation this file's own harness caught surviving, and
// it is the exact failure shape AGENTS.md warns about: a check that reads the
// attribute rather than what renders out of it.
function branches(raw) {
  const stat = raw.replace(/\$\{[\s\S]*?\}/g, " ");
  const out = [stat];
  for (const block of raw.matchAll(/\$\{([\s\S]*?)\}/g)) {
    for (const literal of block[1].matchAll(/["'`]([^"'`]*)["'`]/g)) {
      out.push(`${stat} ${literal[1]}`);
    }
  }
  return out;
}

for (const [file, src] of [
  [QUOTES_PAGE, quotesSrc],
  [INVOICES_PAGE, invoicesSrc],
]) {
  const measured = new Set();
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{"([^"]*)"\})/g)) {
    for (const branch of branches(m[1] ?? m[2] ?? m[3] ?? "")) {
      const words = branch.split(/\s+/).filter(Boolean);
      for (const theme of ["light", "dark"]) {
        const table = theme === "light" ? LIGHT : DARK;
        // In dark, a `dark:` class overrides its light counterpart; in light,
        // `dark:` classes are not on screen at all.
        //
        // The COLOUR class specifically, not the first `text-` class in the
        // list. `text-xl font-bold text-green-600` starts with a SIZE, and a
        // first-match pick silently skipped every element whose size was typed
        // before its colour — which is most of them. That mistake makes a
        // contrast check pass by measuring nothing, so the filter is on the
        // palette, not on the position.
        const pick = (prefix, wanted) => {
          const dark = words.find(
            (w) => w.startsWith(`dark:${prefix}`) && wanted(w.slice(5 + prefix.length)),
          );
          const light = words.find(
            (w) => w.startsWith(prefix) && !w.includes(":") && wanted(w.slice(prefix.length)),
          );
          return theme === "dark" ? (dark ? dark.slice(5) : light) : light;
        };
        // A theme token (text-muted-foreground) is check:mobile's job; an alpha
        // modifier composites to something no static file can know.
        const isColour = (v) => PALETTE.has(v.split("/")[0]);
        const textClass = pick("text-", isColour);
        if (!textClass) continue;
        if (textClass.includes("/")) {
          unreadable++;
          continue;
        }
        const fg = PALETTE.get(textClass.slice(5));

        const bgClass = pick("bg-", (v) => PALETTE.has(v.split("/")[0]) || table.has(v.split("/")[0]));
        let grounds;
        if (bgClass && bgClass.includes("/")) {
          unreadable++;
          continue;
        } else if (bgClass && PALETTE.has(bgClass.slice(3))) {
          grounds = [[bgClass, PALETTE.get(bgClass.slice(3))]];
        } else if (bgClass && table.has(bgClass.slice(3))) {
          grounds = [[bgClass, table.get(bgClass.slice(3))]];
        } else if (bgClass) {
          unreadable++;
          continue;
        } else {
          grounds = SURFACES.map((s) => [`bg-${s}`, table.get(s)]);
        }

        for (const [bgName, bg] of grounds) {
          const id = `${theme}:${textClass} on ${bgName}`;
          if (measured.has(id)) continue;
          measured.add(id);
          const ratio = contrast(fg, bg);
          ok(
            `${file}: ${id}`,
            ratio >= FLOOR,
            `${ratio.toFixed(2)}:1 (${fg} on ${bg}) — under ${FLOOR}:1`,
          );
        }
      }
    }
  }
  // A run that measured nothing would pass in silence, which is the shape of
  // the false confidence this whole section exists to avoid. Naming the colours
  // that MUST have been reached is the stronger version: a count alone stayed
  // green while the nested-ternary bug above hid the urgent branch entirely.
  ok(`${file}: something was actually measured (${measured.size} pairs)`, measured.size >= 6);
  for (const expected of ["light:text-red-", "dark:text-red-"]) {
    ok(
      `${file}: the urgent colour was reached (${expected}…)`,
      [...measured].some((id) => id.startsWith(expected)),
      `measured: ${[...measured].join(" | ")}`,
    );
  }
}

section("The quote status chips, which moved out of the page and out of the scan above");

// Moving the map into lib/ took it out of reach of the className scan, so it is
// measured directly. Otherwise the refactor would quietly have deleted the only
// check on four of the badges on the screen.
for (const [status, classes] of Object.entries(QUOTE_STATUS_CLASSES)) {
  const words = classes.split(/\s+/);
  const fgClass = words.find((w) => w.startsWith("text-") && PALETTE.has(w.slice(5)));
  const bgClass = words.find(
    (w) => w.startsWith("bg-") && !w.includes(":") && PALETTE.has(w.slice(3)),
  );
  if (!fgClass || !bgClass) {
    // draft is `bg-muted text-muted-foreground` — theme tokens, which
    // check-mobile-surfaces.mjs measures. Not a silent skip: it is named.
    ok(
      `the "${status}" chip is theme tokens, measured by check:mobile`,
      /text-muted-foreground/.test(classes),
      classes,
    );
    continue;
  }
  const ratio = contrast(PALETTE.get(fgClass.slice(5)), PALETTE.get(bgClass.slice(3)));
  ok(
    `the "${status}" chip: ${fgClass} on ${bgClass}`,
    ratio >= FLOOR,
    `${ratio.toFixed(2)}:1 — under ${FLOOR}:1`,
  );
  // The dark half of every chip is `bg-*-950/40` — 40% alpha over whatever is
  // behind it, which no static file can composite. Counted, never passed.
  ok(`…and its dark background declares an alpha this file cannot read`, /950\/40/.test(classes));
  unreadable++;
}

section("The accent bar is visible as a graphic, not just as a colour name");

// A 3px bar carries no text, so 4.5:1 is the wrong bar; WCAG's non-text floor
// is 3:1. It is still measured rather than eyeballed — it is the only thing
// marking the row somebody is meant to act on.
for (const [file, src] of [
  [QUOTES_PAGE, quotesSrc],
  [INVOICES_PAGE, invoicesSrc],
]) {
  const light = /bg-(red-\d{3}) dark:bg-red-\d{3}/.exec(src);
  const dark = /dark:bg-(red-\d{3})/.exec(src);
  ok(`${file} paints an accent bar`, Boolean(light && dark));
  if (light && dark) {
    const l = contrast(PALETTE.get(light[1]), LIGHT.get("card"));
    const d = contrast(PALETTE.get(dark[1]), DARK.get("card"));
    ok(`${file}: the bar is ${l.toFixed(2)}:1 on light card`, l >= 3);
    ok(`${file}: …and ${d.toFixed(2)}:1 on dark card`, d >= 3);
  }
}

// The Outstanding tile's left edge, same rule: a graphic that ranks one tile
// above two others has to be visible against the tile.
{
  const light = /border-l-(amber-\d{3})/.exec(invoicesSrc);
  const dark = /dark:border-l-(amber-\d{3})/.exec(invoicesSrc);
  ok("the Outstanding tile carries an accent edge", Boolean(light && dark));
  if (light && dark) {
    const l = contrast(PALETTE.get(light[1]), LIGHT.get("card"));
    const d = contrast(PALETTE.get(dark[1]), DARK.get("card"));
    ok(`the tile edge is ${l.toFixed(2)}:1 on light card`, l >= 3);
    ok(`…and ${d.toFixed(2)}:1 on dark card`, d >= 3);
  }
}

// ═══════════════════════════════════════════════════════════════════════════

if (unreadable) {
  console.log(
    `\n${unreadable} class pairing(s) could not be read statically (alpha modifier or ` +
      `a background this script has no hex for) and were SKIPPED, not passed.`,
  );
}

if (failures.length) {
  console.error(`\ncheck:document-lists FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `\ncheck:document-lists passed — ${passes} assertions over the quotes and invoices lists.`,
);
