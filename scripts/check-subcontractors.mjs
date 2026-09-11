// scripts/check-subcontractors.mjs
//
//   npm run check:subcontractors
//
// Subcontractor management — the companies a contractor hires per job —
// executed rather than read.
//
// ══ What is at stake ═══════════════════════════════════════════════════════
//
// Four numbers, each of which is wrong in a specific, expensive way if the
// code behind it is wrong:
//
//   * A sub's expiry badge. A null date rendered "expired" pulls a properly
//     insured roofer off tomorrow's visit; a past date rendered "unknown"
//     sends an uninsured one onto it.
//   * A job's subcontract cost. Counting the agreed amount AND the payment
//     expenses that settle it costs a $5,000 electrician at $10,000 the day
//     the last cheque clears; counting the payments alone makes every job
//     look profitable until then.
//   * A sub's year-to-date paid — the T5018 / 1099-NEC figure. A client's
//     card payment that landed in the wrong column would be reported to the
//     tax authority as money paid to a sub.
//   * Who sees any of it. The sidebar row and the API must agree, or a
//     supervisor gets a row that 403s — or a crew member gets the roster.
//
// Everything below runs the SHIPPED modules. Where a claim is about source
// text (a route imports the parser that refuses inbound methods; the costing
// route hands the rows to the pure function), it is matched as text and says
// so, and it is matched narrowly enough that removing the thing fails it.
//
// ══ Every date here is pinned ══════════════════════════════════════════════
//
// NOW is fixed and every fixture is expressed relative to it, so this passes
// in September and in January.
//
// Mutation-tested; see the session report for which break each assertion was
// confirmed to catch.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { EXPIRY_STATES } from "@/lib/expiry/window";
import {
  subcontractorExpiries,
  subcontractorAttention,
  subcontractorsDueSoon,
  subcontractorTally,
} from "@/lib/subcontractors/expiry";
import {
  SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY,
  SUBCONTRACT_IMPORT_EXPENSE_CATEGORY,
  JOB_SUBCONTRACTOR_STATUSES,
  jobSubcontractCost,
  isSubcontractExpense,
  paymentYear,
  yearToDatePaid,
  yearToDatePaidBySubcontractor,
  paymentsCover,
  requestedYear,
} from "@/lib/subcontractors/money";
import {
  OUTBOUND_PAYMENT_METHODS,
  INBOUND_ONLY_PAYMENT_METHODS,
  EXPIRY_KIND_FIELD,
  DOCUMENT_KINDS,
  parsePaymentBody,
  parseSubcontractorBody,
  parseJobSubcontractorBody,
  parseDocumentBody,
  stripJobSubcontractorMoney,
  MAX_MONEY,
} from "@/lib/subcontractors/payload";
import {
  SUBCONTRACTOR_PERMISSION,
  SUBCONTRACTOR_MONEY_TOGGLE,
  canReadSubcontractors,
  canWriteSubcontractors,
  canSeeSubcontractorMoney,
  requireSubcontractorRead,
  requireSubcontractorMoney,
} from "@/lib/subcontractors/access";
import { actualJobCost } from "@/lib/costing/actualJobCost";
import { NAV_REQUIREMENTS, navRowAllowed } from "@/lib/permissions/nav";
import { PERMISSION_PRESETS, PRESET_TO_ROLE, can } from "@/lib/permissions";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments/methodLabels";
import { OWNED_ID_FIELDS } from "@/lib/tenant/ownedIds";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { FEATURE_MATRIX } from "@/lib/marketing/featureMatrix";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const section = (title) => console.log(`\n${title}\n`);

const NOW = new Date("2026-09-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (n) => new Date(NOW.getTime() + n * DAY);

// ═══════════════════════════════════════════════════════════════════════════
section("1. Expiry — a missing date is unknown, a past date is expired, never the other way");
// ═══════════════════════════════════════════════════════════════════════════
{
  const blank = subcontractorAttention({ name: "Blank Co" }, { asOf: NOW });
  ok("no dates at all → unknown, not expired", blank.state === EXPIRY_STATES.UNKNOWN, blank.state);
  ok("…and nothing is raised as a reason", blank.reasons.length === 0, blank.reasons);
  ok("…but both expiries are still listed for the detail panel", blank.expiries.length === 2 && blank.expiries.every((e) => e.state === "unknown"));

  const nulls = subcontractorAttention({ insuranceExpiresAt: null, clearanceExpiresAt: "" }, { asOf: NOW });
  ok("explicit null and empty string are unknown too", nulls.state === EXPIRY_STATES.UNKNOWN, nulls.state);
  const zero = subcontractorAttention({ insuranceExpiresAt: 0 }, { asOf: NOW });
  ok("a numeric 0 is refused, not read as 1970 and forty years expired", zero.state === EXPIRY_STATES.UNKNOWN, zero.state);
  const junk = subcontractorAttention({ insuranceExpiresAt: "not a date" }, { asOf: NOW });
  ok("an unparseable date is unknown", junk.state === EXPIRY_STATES.UNKNOWN, junk.state);

  const lapsed = subcontractorAttention({ insuranceExpiresAt: at(-1), clearanceExpiresAt: null }, { asOf: NOW });
  ok("insurance a day ago → expired, and the unknown clearance does not soften it", lapsed.state === EXPIRY_STATES.EXPIRED, lapsed.state);
  ok("…with insurance named as the reason", lapsed.reasons.length === 1 && lapsed.reasons[0].kind === "insurance", lapsed.reasons);

  const soon = subcontractorAttention({ insuranceExpiresAt: at(400), clearanceExpiresAt: at(10) }, { asOf: NOW });
  ok("clearance in 10 days → due soon", soon.state === EXPIRY_STATES.DUE_SOON, soon.state);
  ok("…with clearance the only reason", soon.reasons.map((r) => r.kind).join() === "clearance", soon.reasons);

  const fine = subcontractorAttention({ insuranceExpiresAt: at(200), clearanceExpiresAt: at(90) }, { asOf: NOW });
  ok("both far off → ok", fine.state === EXPIRY_STATES.OK, fine.state);

  const today = subcontractorAttention({ insuranceExpiresAt: at(0) }, { asOf: NOW });
  ok("expiring today is still covered today (due soon, not expired)", today.state === EXPIRY_STATES.DUE_SOON, today.state);

  const order = subcontractorExpiries({}).map((e) => e.kind);
  ok("insurance is listed before clearance — the one with the same-day consequence first", order.join() === "insurance,clearance", order);

  const roster = [
    { id: "a", name: "Fine", active: true, insuranceExpiresAt: at(300) },
    { id: "b", name: "Soon", active: true, insuranceExpiresAt: at(5) },
    { id: "c", name: "Lapsed", active: true, insuranceExpiresAt: at(-30) },
    { id: "d", name: "Lapsed earlier", active: true, clearanceExpiresAt: at(-60) },
    { id: "e", name: "Unknown", active: true },
    { id: "f", name: "Inactive lapsed", active: false, insuranceExpiresAt: at(-5) },
    null,
  ];
  const due = subcontractorsDueSoon(roster, { asOf: NOW });
  ok("the call list holds only expired and due-soon", due.map((r) => r.sub.id).join() === "d,c,b", due.map((r) => r.sub.id));
  ok("…most urgent first, earliest lapse first within a rank", due[0].sub.id === "d" && due[1].sub.id === "c");
  ok("…an unknown sub is not on the call list", !due.some((r) => r.sub.id === "e"));
  ok("…and an inactive sub's lapse is not chased", !due.some((r) => r.sub.id === "f"));
  const tally = subcontractorTally(roster, { asOf: NOW });
  ok("tally: 2 expired, 1 due soon, 1 ok, 1 unknown, 5 active total", JSON.stringify(tally) === JSON.stringify({ expired: 2, dueSoon: 1, ok: 1, unknown: 1, total: 5 }), tally);
  ok("empty / junk roster → empty list and zero tally", subcontractorsDueSoon(null).length === 0 && subcontractorTally("x").total === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. jobSubcontractCost — agreed/done/paid count, quoted does not");
// ═══════════════════════════════════════════════════════════════════════════
{
  const rows = [
    { agreedAmount: "5000", status: "agreed" },
    { agreedAmount: 1200.5, status: "done" },
    { agreedAmount: 800, status: "paid", importExpenseId: "exp-import-1" },
    { agreedAmount: 3000, status: "quoted", importExpenseId: "exp-import-quoted" },
    { agreedAmount: "abc", status: "agreed" },
    { agreedAmount: 99, status: "made_up" },
    null,
    "junk",
  ];
  const c = jobSubcontractCost(rows);
  ok("total is the sum of agreed + done + paid", c.total === 7000.5, c.total);
  // Four, not three: the "abc" row is in a costed status and is a real
  // assignment whose amount cannot be read. It contributes 0 to the total and
  // still counts as a row, so the panel says "4 subs" and shows one at $0
  // rather than making the unreadable one vanish.
  ok("…four rows in a costed status are counted, the unreadable one at 0", c.count === 4, c.count);
  ok("quoted is reported by status and NOT in the total", c.byStatus.quoted === 3000 && c.total < 10000, c.byStatus);
  ok("an unrecognised status is skipped, not counted as agreed", c.byStatus.agreed === 5000, c.byStatus);
  ok("a non-numeric amount is 0, not NaN", Number.isFinite(c.total));
  ok("only a COUNTED row's import expense is excluded", c.excludedExpenseIds.join() === "exp-import-1", c.excludedExpenseIds);
  ok("no rows → nothing", jobSubcontractCost(undefined).total === 0 && jobSubcontractCost([]).count === 0);
  ok("the status vocabulary is the schema's four, in order", JOB_SUBCONTRACTOR_STATUSES.join() === "quoted,agreed,done,paid");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. actualJobCost — a sub is costed ONCE, at the agreed amount");
// ═══════════════════════════════════════════════════════════════════════════
{
  const expenses = [
    { id: "e1", category: "materials", amount: 300 },
    { id: "e2", category: SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY, amount: 2000 },
    { id: "e3", category: SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY, amount: 3000 },
    { id: "e-import", category: SUBCONTRACT_IMPORT_EXPENSE_CATEGORY, amount: 1500 },
    { id: "e-import-orphan", category: SUBCONTRACT_IMPORT_EXPENSE_CATEGORY, amount: 700 },
  ];
  const subcontracts = [
    { agreedAmount: 5000, status: "paid" },
    { agreedAmount: 1500, status: "agreed", importExpenseId: "e-import" },
  ];
  const withSubs = actualJobCost(expenses, [], { subcontracts });
  ok("subcontract line = 5000 + 1500", withSubs.subcontracts?.total === 6500, withSubs.subcontracts);
  ok("payment expenses are NOT in the expense total", withSubs.expenses.total === 300 + 700, withSubs.expenses.total);
  ok("the adopted import's expense is NOT in the expense total either", !withSubs.expenses.byCategory.some((c) => c.category === SUBCONTRACT_IMPORT_EXPENSE_CATEGORY && c.amount === 1500 + 700));
  ok("…but an import nobody adopted still counts, as it always did", withSubs.expenses.byCategory.find((c) => c.category === SUBCONTRACT_IMPORT_EXPENSE_CATEGORY)?.amount === 700, withSubs.expenses.byCategory);
  ok("total = materials + orphan import + agreed subcontracts, counted once", withSubs.total === 300 + 700 + 6500, withSubs.total);
  ok("the excluded figure is reported so the panel can explain it", withSubs.subcontracts.expensesExcluded === 2000 + 3000 + 1500, withSubs.subcontracts.expensesExcluded);

  const withoutSubs = actualJobCost([{ category: "materials", amount: 300 }], []);
  ok("a job with no subs says nothing (null), not $0", withoutSubs.subcontracts === null && withoutSubs.total === 300, withoutSubs.subcontracts);

  const quotedOnly = actualJobCost([], [], { subcontracts: [{ agreedAmount: 4000, status: "quoted" }] });
  ok("a quoted-only sub is reported but adds nothing to the total", quotedOnly.subcontracts?.byStatus.quoted === 4000 && quotedOnly.total === 0, quotedOnly);

  // The double count, demonstrated: without the exclusion the same job would
  // report the electrician twice.
  const naive = 300 + 700 + 2000 + 3000 + 1500 + 6500;
  ok("…and the naive sum would have been higher by exactly the excluded expenses", naive - withSubs.total === withSubs.subcontracts.expensesExcluded);

  ok("isSubcontractExpense: payment category, always", isSubcontractExpense({ category: SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY }, new Set()));
  ok("isSubcontractExpense: import category only when adopted", !isSubcontractExpense({ id: "x", category: SUBCONTRACT_IMPORT_EXPENSE_CATEGORY }, new Set()) && isSubcontractExpense({ id: "x", category: SUBCONTRACT_IMPORT_EXPENSE_CATEGORY }, new Set(["x"])));
  ok("the two categories are different strings", SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY !== SUBCONTRACT_IMPORT_EXPENSE_CATEGORY);

  const costingRoute = stripComments(read("app/api/jobs/[id]/costing/route.js"));
  ok("the costing route hands JobSubcontractor rows to actualJobCost", /db\.jobSubcontractor\.findMany/.test(costingRoute) && /subcontracts,\s*\}\)/.test(costingRoute));
  ok("…and selects expense ids so an adopted import can be dropped by id", /select:\s*\{\s*id:\s*true,\s*category:\s*true,\s*amount:\s*true\s*\}/.test(costingRoute));
  const importQuote = stripComments(read("lib/quotes/importQuote.js"));
  ok("importQuote.js writes the import category by the shared constant, not a literal", /category:\s*SUBCONTRACT_IMPORT_EXPENSE_CATEGORY/.test(importQuote) && !/category:\s*"Subcontractor"/.test(importQuote));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Year-to-date paid — the T5018 figure");
// ═══════════════════════════════════════════════════════════════════════════
{
  const payments = [
    { subcontractorId: "s1", amount: 1000, date: "2026-03-05", method: "cheque" },
    { subcontractorId: "s1", amount: "250.25", date: new Date("2026-12-31T23:59:00Z"), method: "e_transfer" },
    { subcontractorId: "s1", amount: 999, date: "2025-12-31", method: "cash" },
    { subcontractorId: "s1", amount: 5, date: null },
    { subcontractorId: "s1", amount: 5, date: "garbage" },
    { subcontractorId: "s1", amount: "NaN", date: "2026-06-01" },
    { subcontractorId: "s1", amount: -100, date: "2026-06-02", method: "cash" },
    { subcontractorId: "s2", amount: 40, date: "2026-01-01" },
    null,
  ];
  const y = yearToDatePaid(payments.filter((p) => !p || p.subcontractorId === "s1"), 2026);
  ok("2026 total is the two 2026 rows plus the stored negative, and nothing else", y.total === 1000 + 250.25 - 100, y.total);
  ok("…three rows made it", y.count === 3, y.count);
  ok("a null date belongs to no year", yearToDatePaid([{ amount: 5, date: null }], 2026).count === 0);
  ok("an unparseable date belongs to no year", yearToDatePaid([{ amount: 5, date: "garbage" }], 2026).count === 0);
  ok("a non-numeric amount is skipped, and the total is not NaN", Number.isFinite(y.total));
  ok("31 December 23:59 UTC is still that year", paymentYear(new Date("2026-12-31T23:59:00Z")) === 2026);
  ok("a date-only string is read as UTC midnight of that day", paymentYear("2026-01-01") === 2026);
  ok("by method: cheque 1000, e_transfer 250.25, cash -100", y.byMethod.cheque === 1000 && y.byMethod.e_transfer === 250.25 && y.byMethod.cash === -100, y.byMethod);
  ok("a bad year → null year and nothing", yearToDatePaid(payments, "abc").year === null && yearToDatePaid(payments, 2026.5).count === 0);

  const bySub = yearToDatePaidBySubcontractor(payments, 2026);
  ok("per sub: s1 and s2, nothing else", [...bySub.keys()].sort().join() === "s1,s2");
  ok("…s2 has its one payment", bySub.get("s2").total === 40 && bySub.get("s2").count === 1);
  ok("…and s1 matches the single-sub figure", bySub.get("s1").total === y.total);

  const sp = (v) => ({ get: () => v });
  ok("requestedYear reads ?year=", requestedYear(sp("2024"), NOW) === 2024);
  ok("…defaults to the current UTC year", requestedYear(sp(null), NOW) === 2026);
  ok("…refuses a typo year (1999, 3000, abc)", requestedYear(sp("1999"), NOW) === 2026 && requestedYear(sp("3000"), NOW) === 2026 && requestedYear(sp("abc"), NOW) === 2026);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. paymentsCover — when a row becomes paid");
// ═══════════════════════════════════════════════════════════════════════════
{
  const short = paymentsCover(5000, [{ amount: 2000 }, { amount: 1000 }]);
  ok("2000 + 1000 against 5000: not covered, 2000 to go", !short.covered && short.remaining === 2000, short);
  const exact = paymentsCover(5000, [{ amount: 2000 }, { amount: 3000 }]);
  ok("exactly covered → paid", exact.covered && exact.remaining === 0, exact);
  const over = paymentsCover(5000, [{ amount: 6000 }]);
  ok("a payment exceeding the agreed amount is covered AND shows a negative remainder, not a clamped zero", over.covered && over.remaining === -1000, over);
  const nothing = paymentsCover(0, [{ amount: 100 }]);
  ok("an agreed amount of 0 is never 'paid in full' — there is nothing to cover", !nothing.covered, nothing);
  const junk = paymentsCover("abc", [{ amount: "x" }, null]);
  ok("junk in → zeros out, not NaN", junk.paid === 0 && junk.agreed === 0 && !junk.covered, junk);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The payment route refuses money-IN methods");
// ═══════════════════════════════════════════════════════════════════════════
{
  const enumValues = Object.keys(PAYMENT_METHOD_LABELS);
  const covered = new Set([...OUTBOUND_PAYMENT_METHODS, ...INBOUND_ONLY_PAYMENT_METHODS]);
  ok("every PaymentMethod value is classified as outbound or inbound-only", enumValues.every((m) => covered.has(m)), enumValues.filter((m) => !covered.has(m)));
  ok("no value is in both lists", OUTBOUND_PAYMENT_METHODS.every((m) => !INBOUND_ONLY_PAYMENT_METHODS.includes(m)));
  for (const m of ["stripe", "visit_credit", "card_elsewhere", "shop"]) {
    const r = parsePaymentBody({ amount: 100, method: m });
    ok(`${m} is refused with a sentence that says why`, !!r.error && /client pays you/.test(r.error), r);
  }
  for (const m of OUTBOUND_PAYMENT_METHODS) {
    const r = parsePaymentBody({ amount: 100, method: m, date: "2026-03-05" });
    ok(`${m} is accepted`, !r.error && r.data.method === m && r.data.amount === 100, r);
  }
  ok("an unknown method is refused", !!parsePaymentBody({ amount: 100, method: "bitcoin" }).error);
  ok("no method is refused", !!parsePaymentBody({ amount: 100 }).error);
  ok("a negative amount is refused", /negative/.test(parsePaymentBody({ amount: -50, method: "cash" }).error || ""));
  ok("a zero amount is refused", !!parsePaymentBody({ amount: 0, method: "cash" }).error);
  ok("an amount past the column is refused, not clamped", !!parsePaymentBody({ amount: MAX_MONEY + 1, method: "cash" }).error && !parsePaymentBody({ amount: MAX_MONEY, method: "cash" }).error);
  ok("a non-numeric amount is refused", !!parsePaymentBody({ amount: "lots", method: "cash" }).error);
  ok("a typed amount with a thousands separator is read", parsePaymentBody({ amount: "1,250.50", method: "cash" }).data?.amount === 1250.5);
  ok("a bad date is refused; a blank one means today", !!parsePaymentBody({ amount: 1, method: "cash", date: "yesterday-ish" }).error && parsePaymentBody({ amount: 1, method: "cash", date: "" }).data.date instanceof Date);

  const route = stripComments(read("app/api/subcontractors/[id]/payments/route.js"));
  const postBody = route.slice(route.indexOf("export async function POST"));
  ok("the POST handler parses the body through parsePaymentBody before any write", /parsePaymentBody\(/.test(postBody) && postBody.indexOf("parsePaymentBody(") < postBody.indexOf("$transaction"));
  ok("the payment, the expense and the status change are one transaction", /\$transaction\(async \(tx\) =>/.test(postBody) && /tx\.subcontractorPayment\.create/.test(postBody) && /tx\.expense\.create/.test(postBody) && /tx\.jobSubcontractor\.update/.test(postBody));
  ok("the expense is written under the payment category constant", /category:\s*SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY/.test(postBody));
  ok("stripeTransferId is written by nothing in this route", !/stripeTransferId\s*:/.test(route));
  ok("the write is behind the MONEY gate, not just the roster gate", /requireSubcontractorMoney\(full\)/.test(postBody));
  ok("the assignment id is proved against the tenant table", /ownedIdsRefusal\([^)]*jobSubcontractorId/.test(postBody) && !!OWNED_ID_FIELDS.jobSubcontractorId && !!OWNED_ID_FIELDS.subcontractorId);
  ok("the status flips to paid only when payments cover the amount", /cover\.covered/.test(postBody) && /"paid"/.test(postBody));

  const rowRoute = stripComments(read("app/api/jobs/[id]/subcontractors/[rowId]/route.js"));
  ok("PATCH refuses a hand-typed `paid`", /data\.status === "paid" && row\.status !== "paid"/.test(rowRoute));
  ok("DELETE refuses a row with payments", /row\.payments\.length > 0/.test(rowRoute.slice(rowRoute.indexOf("export async function DELETE"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The other parsers — blank is null, never a default");
// ═══════════════════════════════════════════════════════════════════════════
{
  const created = parseSubcontractorBody({ name: "  Volt Electric  ", trade: "electrical", email: "Bob@Volt.CA", insuranceExpiresAt: "", clearanceExpiresAt: "2027-01-01" }, { creating: true });
  ok("create: name trimmed, email lowercased, blank insurance → null, clearance → Date", created.data.name === "Volt Electric" && created.data.email === "bob@volt.ca" && created.data.insuranceExpiresAt === null && created.data.clearanceExpiresAt instanceof Date, created);
  ok("create without a name is refused", !!parseSubcontractorBody({ trade: "x" }, { creating: true }).error);
  ok("update with nothing to change is refused", !!parseSubcontractorBody({}, { creating: false }).error);
  ok("update leaves absent keys alone", !("insuranceExpiresAt" in parseSubcontractorBody({ phone: "613" }, { creating: false }).data));
  ok("a bad expiry date is refused", !!parseSubcontractorBody({ insuranceExpiresAt: "soon" }, { creating: false }).error);
  ok("a bad email is refused", !!parseSubcontractorBody({ email: "nope" }, { creating: false }).error);
  ok("taxFormRequired must be a boolean", !!parseSubcontractorBody({ taxFormRequired: "yes" }, { creating: false }).error && parseSubcontractorBody({ taxFormRequired: false }, { creating: false }).data.taxFormRequired === false);

  const js = parseJobSubcontractorBody({ subcontractorId: "s1", agreedAmount: "4,500", description: "panel swap" }, { creating: true });
  ok("job row: an amount on create means agreed", js.data.status === "agreed" && js.data.agreedAmount === 4500, js);
  const noAmount = parseJobSubcontractorBody({ subcontractorId: "s1" }, { creating: true });
  ok("job row: no amount on create → quoted at 0, not refused", !noAmount.error && noAmount.data.status === "quoted" && noAmount.data.agreedAmount === 0, noAmount);
  ok("job row: agreed with no amount is refused", !!parseJobSubcontractorBody({ subcontractorId: "s1", status: "agreed" }, { creating: true }).error);
  ok("job row: a negative amount is refused", !!parseJobSubcontractorBody({ subcontractorId: "s1", agreedAmount: -1 }, { creating: true }).error);
  ok("job row: zero on UPDATE is refused", !!parseJobSubcontractorBody({ agreedAmount: 0 }, { creating: false }).error);
  ok("job row: an invented status is refused", !!parseJobSubcontractorBody({ status: "invoiced" }, { creating: false }).error);
  ok("job row: no subcontractor on create is refused", !!parseJobSubcontractorBody({ agreedAmount: 5 }, { creating: true }).error);

  const doc = parseDocumentBody({ kind: "coi", url: "https://res.cloudinary.com/x/y.pdf", expiresAt: "2027-06-30", sizeBytes: 0 });
  ok("document: coi with expiry parses; sizeBytes 0 → null, never zero", !doc.error && doc.data.expiresAt instanceof Date && doc.data.sizeBytes === null, doc);
  ok("document: a coi with no expiry is accepted and carries null", parseDocumentBody({ kind: "coi", url: "https://x/y" }).data.expiresAt === null);
  ok("document: an unknown kind is refused", !!parseDocumentBody({ kind: "selfie", url: "https://x/y" }).error);
  ok("document: no url is refused", !!parseDocumentBody({ kind: "coi" }).error);
  ok("the expiry table maps coi → insurance and clearance → clearance, and nothing else", EXPIRY_KIND_FIELD.coi === "insuranceExpiresAt" && EXPIRY_KIND_FIELD.clearance === "clearanceExpiresAt" && Object.keys(EXPIRY_KIND_FIELD).length === 2);
  ok("every expiry kind is a document kind", Object.keys(EXPIRY_KIND_FIELD).every((k) => DOCUMENT_KINDS.includes(k)));

  const docRoute = stripComments(read("app/api/subcontractors/[id]/documents/route.js"));
  ok("filing a coi/clearance writes the sub's expiry column in the same transaction", /\$transaction/.test(docRoute) && /tx\.subcontractor\.update/.test(docRoute) && /\[expiryField\]:\s*expiresAt/.test(docRoute));
  ok("…and only when the paper states a date", /if \(expiryField && expiresAt\)/.test(docRoute));
  ok("the file bytes never reach the route — the URL is checked against our own cloud", /isUploadedUrl\(/.test(docRoute));

  const stripped = stripJobSubcontractorMoney({ id: "r", agreedAmount: 5000, paid: 1, remaining: 4999, payments: [{}], status: "agreed", hasPayments: true });
  ok("the money strip removes amount, paid, remaining and payments, keeps status and hasPayments", !("agreedAmount" in stripped) && !("paid" in stripped) && !("payments" in stripped) && stripped.status === "agreed" && stripped.hasPayments === true && stripped.restricted === true, stripped);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The sidebar row and the API share one permission");
// ═══════════════════════════════════════════════════════════════════════════
{
  const rule = NAV_REQUIREMENTS["app.nav.subcontractors"];
  ok("the nav row has a rule", !!rule && Array.isArray(rule.role), rule);
  ok("the API's coarse gate is user:manage", SUBCONTRACTOR_PERMISSION === "user:manage");

  // Every role the product has, as a member with no grid and with each preset.
  const roles = ["owner", "admin", "supervisor", "employee"];
  let agree = true;
  const disagreements = [];
  for (const role of roles) {
    const member = { role, permissions: null };
    const nav = navRowAllowed("app.nav.subcontractors", member);
    const api = canReadSubcontractors(member);
    if (nav !== api) { agree = false; disagreements.push({ role, nav, api }); }
  }
  for (const [preset, def] of Object.entries(PERMISSION_PRESETS)) {
    const role = PRESET_TO_ROLE[preset];
    if (!role) continue;
    const member = { role, permissions: def.permissions || def };
    const nav = navRowAllowed("app.nav.subcontractors", member);
    const api = canReadSubcontractors(member);
    if (nav !== api) { agree = false; disagreements.push({ preset, role, nav, api }); }
  }
  ok("for every role and every preset, the row shows exactly when the API answers", agree, disagreements);
  ok("…and that is the same set of roles user:manage resolves to", roles.every((r) => rule.role.includes(r) === can(r, "user:manage")));
  ok("an employee gets neither the row nor the roster", !navRowAllowed("app.nav.subcontractors", { role: "employee" }) && !canReadSubcontractors({ role: "employee" }));
  ok("a supervisor gets both", navRowAllowed("app.nav.subcontractors", { role: "supervisor" }) && canReadSubcontractors({ role: "supervisor" }));
  ok("a null member is refused by the API", !canReadSubcontractors(null) && !canWriteSubcontractors(undefined));

  // The money is a second gate on top.
  const supNoCost = { role: "supervisor", permissions: { jobCosting: false } };
  const supCost = { role: "supervisor", permissions: { jobCosting: true } };
  ok("a supervisor without jobCosting opens the roster and sees no money", canReadSubcontractors(supNoCost) && !canSeeSubcontractorMoney(supNoCost));
  ok("a supervisor with jobCosting sees the money", canSeeSubcontractorMoney(supCost));
  ok("an employee with jobCosting still does not — the roster gate comes first", !canSeeSubcontractorMoney({ role: "employee", permissions: { jobCosting: true } }));
  ok("the money toggle is the costing route's toggle", SUBCONTRACTOR_MONEY_TOGGLE === "jobCosting" && /hasToggle\(full, "jobCosting"\)/.test(read("app/api/jobs/[id]/costing/route.js")));
  let threw = null;
  try { requireSubcontractorRead({ role: "employee" }); } catch (e) { threw = e; }
  ok("requireSubcontractorRead throws a 403-shaped error", threw?.status === 403 && /owner, admin or supervisor/.test(threw.message));
  threw = null;
  try { requireSubcontractorMoney(supNoCost); } catch (e) { threw = e; }
  ok("requireSubcontractorMoney names job costing in its refusal", threw?.status === 403 && /job costing/.test(threw.message));

  const sidebar = read("app/components/layout/AdminSidebar.js");
  ok("AdminSidebar carries the row under People, pointing at /app/subcontractors", /key:\s*"app\.nav\.subcontractors",\s*href:\s*"\/app\/subcontractors"/.test(sidebar));
  const listRoute = stripComments(read("app/api/subcontractors/route.js"));
  ok("GET /api/subcontractors asks requireSubcontractorRead", /requireSubcontractorRead\(full\)/.test(listRoute.slice(listRoute.indexOf("export async function GET"), listRoute.indexOf("export async function POST"))));
  const exportRoute = stripComments(read("app/api/subcontractors/export/route.js"));
  ok("the T5018 export is behind the money gate", /requireSubcontractorMoney\(full\)/.test(exportRoute));
  ok("the roster and the export pick the year by the same function", /requestedYear\(searchParams\)/.test(listRoute) && /requestedYear\(searchParams\)/.test(exportRoute));
  ok("the export and the roster total by the same function", /yearToDatePaidBySubcontractor\(/.test(listRoute) && /yearToDatePaidBySubcontractor\(/.test(exportRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Every string on the screens is in all nine languages");
// ═══════════════════════════════════════════════════════════════════════════
{
  const files = [
    "app/app/subcontractors/page.js",
    "app/app/subcontractors/new/page.js",
    "app/app/subcontractors/[id]/SubcontractorDetail.js",
    "app/components/subcontractors/SubcontractorForm.js",
    "app/components/subcontractors/SubcontractorDocuments.js",
    "app/components/subcontractors/RecordPaymentForm.js",
    "app/components/jobs/JobSubcontractors.js",
    "app/components/jobs/JobCosting.js",
  ];
  const keys = new Set(["app.nav.subcontractors", ...OUTBOUND_PAYMENT_METHODS.map((m) => `app.subcontractors.method.${m}`)]);
  for (const f of files) {
    for (const m of read(f).matchAll(/t\(\s*"(app\.(?:subcontractors|jobCosting\.subcontracts)[^"]*)"/g)) keys.add(m[1]);
  }
  ok(`the screens ask for a real set of keys (${keys.size})`, keys.size > 100, keys.size);
  const codes = Object.keys(APP_MESSAGES);
  ok("nine languages", codes.length === 9, codes);
  const missing = [];
  const english = [];
  for (const code of codes) {
    for (const k of keys) {
      if (!(k in APP_MESSAGES[code])) missing.push(`${code}:${k}`);
      else if (code !== "en" && APP_MESSAGES[code][k] === APP_MESSAGES.en[k] && APP_MESSAGES.en[k].length > 12) english.push(`${code}:${k}`);
    }
  }
  ok("every key exists in every language", missing.length === 0, missing.slice(0, 8));
  // Short labels ("Email", "Notes") legitimately coincide; sentences do not.
  ok("no sentence is English in nine slots", english.length === 0, english.slice(0, 8));
  ok("Québec register: French says sous-traitant and chantier", /sous-traitant/i.test(APP_MESSAGES.fr["app.subcontractors.title"]) && /chantier/.test(APP_MESSAGES.fr["app.subcontractors.onJobTitle"]));
  ok("LatAm register: Spanish says subcontratista", /subcontratista/i.test(APP_MESSAGES.es["app.subcontractors.title"]));
  const placeholders = [];
  for (const code of codes) {
    for (const k of keys) {
      const want = (APP_MESSAGES.en[k]?.match(/\{\w+\}/g) || []).sort().join();
      const got = (APP_MESSAGES[code][k]?.match(/\{\w+\}/g) || []).sort().join();
      if (want !== got) placeholders.push(`${code}:${k}`);
    }
  }
  ok("every placeholder survives translation", placeholders.length === 0, placeholders);
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The matrix says shipped, and the caveat is gone");
// ═══════════════════════════════════════════════════════════════════════════
{
  const entry = FEATURE_MATRIX.find((e) => e.key === "subcontractor_bids");
  ok("the entry exists under its old key", !!entry);
  ok("readiness is shipped", entry?.readiness === "shipped", entry?.readiness);
  ok("limits is null", entry?.limits === null);
  ok("the name no longer describes only the bid", entry?.name === "Subcontractors", entry?.name);
  const proofPaths = (entry?.proof || []).map((p) => p.path);
  for (const p of ["lib/subcontractors/money.js", "app/api/subcontractors/[id]/payments/route.js", "app/api/subcontractors/export/route.js", "app/components/jobs/JobSubcontractors.js"]) {
    ok(`proof names ${p}`, proofPaths.includes(p));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
