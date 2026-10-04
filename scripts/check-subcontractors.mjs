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
import {
  PROFILE_COMPANY_SELECT,
  documentProfileOf,
  profileFillPatch,
  fieldSources,
} from "@/lib/subcontractors/profileFill";
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
const eq2 = (label, got, want) => ok(label, JSON.stringify(got) === JSON.stringify(want), got);

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
  // The query moved to lib/costing/jobCostInputs.js when the gross-profit
  // commission basis became its second caller; the route must still use it.
  const costInputs = stripComments(read("lib/costing/jobCostInputs.js"));
  ok("the costing route hands JobSubcontractor rows to actualJobCost", /loadJobSubcontracts\(db,/.test(costingRoute) && /db\.jobSubcontractor\.findMany/.test(costInputs) && /importExpenseId/.test(costInputs) && /subcontracts,\s*\}\)/.test(costingRoute));
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
  // The year-end CSV is OFF by the owner's decision of 2026-09-24 (companies
  // can import but not export). The route is kept, and refuses as the very
  // first thing GET does — before memberOrRefusal, so before the session or
  // the database is read. The screen no longer links to it.
  const getBody = exportRoute.slice(exportRoute.indexOf("export async function GET"));
  ok(
    "the export refuses before anything else runs",
    /^export async function GET\(request\) \{\s*const exportOff = companyDataExportRefusal\(NextResponse\);\s*if \(exportOff\) return exportOff;/.test(getBody),
  );
  const screen = stripComments(read("app/app/subcontractors/page.js"));
  ok("the Subcontractors screen no longer links to the export", !/\/api\/subcontractors\/export/.test(screen) && !/exportYear/.test(screen));
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
  // The year-end totals are proven by the roster route that shows them on
  // screen, not by the CSV route: that one is off by decision (2026-09-24,
  // import yes, export no), and a route that answers 403 to everyone is not
  // evidence that a customer can use a feature.
  for (const p of ["lib/subcontractors/money.js", "app/api/subcontractors/[id]/payments/route.js", "app/api/subcontractors/route.js", "app/components/jobs/JobSubcontractors.js"]) {
    ok(`proof names ${p}`, proofPaths.includes(p));
  }
  ok(
    "…and the year-end totals are proven by the roster route's yearToDatePaidBySubcontractor",
    (entry?.proof || []).some((p) => p.path === "app/api/subcontractors/route.js" && (p.holds || []).includes("yearToDatePaidBySubcontractor")),
  );
  ok("no proof cites the refused export route", !proofPaths.includes("app/api/subcontractors/export/route.js"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. Imported quote → the GC's job: the owner's worked example (2026-09-29)");
// ═══════════════════════════════════════════════════════════════════════════
//
// Sub quotes $3,000. GC imports it at 20% → $3,600 on the GC's quote. GC's
// client accepts → the GC's job carries a $3,000 subcontract, counted ONCE.
// Sub's +$250 change order, approved AND signed by the GC → $3,250. The GC's
// price to their own client stays $3,600. An unsigned change order moves
// nothing. The sub's invoice lands on the GC's job; a mismatch is flagged,
// never adopted. Everything below runs the shipped modules against an
// in-memory database, so every write is counted rather than assumed.
{
  const { performImport, materializeImportedCosts } = await import("@/lib/quotes/importQuote");
  const {
    adoptImportsOnJob,
    syncForSourceJob,
    syncForSourceInvoice,
    subcontractBillState,
    approvedSubcontractTotal,
    isSignedApproval,
    latestSentVersion,
  } = await import("@/lib/subcontractors/sourceLink");
  const { loadJobSubcontracts } = await import("@/lib/costing/jobCostInputs");
  const { actualJobCost } = await import("@/lib/costing/actualJobCost");

  // ── A tiny Prisma stand-in: equality, { in }, { not }, OR, nested select ──
  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((w) => matches(row, w));
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("not" in v) return row[k] !== v.not;
        if ("notIn" in v) return !v.notIn.includes(row[k]);
        return false;
      }
      return (row[k] ?? null) === (v ?? null);
    });
  let seq = 0;
  const id = (p) => `${p}_${++seq}`;
  function makeDb() {
    const T = {
      company: [], quote: [], quoteScopeGroup: [], serviceCategory: [], quoteImport: [], job: [],
      changeOrder: [], invoice: [], expense: [], subcontractor: [], jobSubcontractor: [], subcontractorBill: [],
    };
    const writes = [];
    const shape = (table, row, select, include) => {
      if (!row) return null;
      const out = select ? {} : { ...row };
      const rel = { ...(select || {}), ...(include || {}) };
      for (const [k, v] of Object.entries(rel)) {
        if (!v) continue;
        if (k === "sourceCompany") out[k] = shape("company", T.company.find((c) => c.id === row.sourceCompanyId), v.select);
        else if (k === "company") out[k] = shape("company", T.company.find((c) => c.id === row.companyId), v.select);
        else if (k === "scopeGroups") out[k] = T.quoteScopeGroup.filter((g) => g.quoteId === row.id);
        else if (k === "versions") out[k] = T.invoice.filter((i) => i.parentInvoiceId === row.id).map((i) => shape("invoice", i, v.select));
        else if (k === "targetQuote") out[k] = shape("quote", T.quote.find((q) => q.id === row.targetQuoteId), v.select);
        else out[k] = row[k];
      }
      return out;
    };
    const model = (name) => ({
      findMany: async ({ where = {}, select, include } = {}) => T[name].filter((r) => matches(r, where)).map((r) => shape(name, r, select, include)),
      findFirst: async ({ where = {}, select, include } = {}) => shape(name, T[name].find((r) => matches(r, where)), select, include),
      findUnique: async ({ where = {}, select, include } = {}) => shape(name, T[name].find((r) => matches(r, where)), select, include),
      create: async ({ data, select, include }) => {
        if (name === "quoteImport" && T.quoteImport.some((r) => r.targetQuoteId === data.targetQuoteId && r.sourceQuoteId === data.sourceQuoteId))
          throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { id: id(name), createdAt: new Date(2026, 8, ++seq), ...data };
        T[name].push(row);
        writes.push(`${name}.create`);
        return shape(name, row, select, include);
      },
      update: async ({ where, data, select }) => {
        const row = T[name].find((r) => matches(r, where));
        if (!row) throw new Error(`${name}.update: no row`);
        Object.assign(row, data);
        writes.push(`${name}.update`);
        return shape(name, row, select);
      },
      updateMany: async ({ where, data }) => {
        const rows = T[name].filter((r) => matches(r, where));
        for (const r of rows) Object.assign(r, data);
        writes.push(`${name}.updateMany`);
        return { count: rows.length };
      },
      upsert: async ({ where, create, update }) => {
        const key = Object.values(where)[0];
        const row = T[name].find((r) => (typeof key === "object" ? matches(r, key) : r.key === key));
        if (row) {
          Object.assign(row, update);
          writes.push(`${name}.upsert:update`);
          return row;
        }
        const made = { id: id(name), ...create };
        T[name].push(made);
        writes.push(`${name}.upsert:create`);
        return made;
      },
    });
    const db = Object.fromEntries(Object.keys(T).map((n) => [n, model(n)]));
    db.$transaction = async (fn) => fn(db);
    db.$executeRaw = async () => 0;
    return { db, T, writes };
  }

  const { db, T, writes } = makeDb();
  T.company.push(
    // What Sparky prints on its own quotes — and two things it does not:
    // its Stripe account and a billing note, which must never cross.
    { id: "SUB", name: "Sparky Electric", email: "office@sparky.test", phone: "555-0199", address: "12 Volt Rd", city: "Ottawa", province: "ON", postalCode: "K1A 0B1", stripeAccountId: "acct_PRIVATE", billingEmail: "owner-private@sparky.test" },
    { id: "GC", name: "Build Right" },
    { id: "OTHER", name: "Unrelated Co" },
  );
  // The sub's quote to the GC, sent; its share link is what the GC holds.
  T.quote.push({ id: "SQ", companyId: "SUB", status: "sent", total: 3000, acceptedTotal: null, quoteNumber: "Q-S-1" });
  // The GC's own quote to their homeowner, open.
  T.quote.push({ id: "GQ", companyId: "GC", status: "draft", total: 0, discount: 0, taxEnabled: false, quoteNumber: "Q-G-1" });

  const member = { companyId: "GC", userId: "u_gc" };
  const load = (qid) => ({ ...T.quote.find((q) => q.id === qid), scopeGroups: T.quoteScopeGroup.filter((g) => g.quoteId === qid) });
  const res = await performImport({
    db, member, sourceQuote: load("SQ"), targetQuote: load("GQ"), targetCompany: { taxRate: 0 }, markupPercent: 20, display: "blended",
  });
  ok("$3,000 at 20% puts $3,600 on the GC's quote", res.clientPrice === 3600 && T.quote.find((q) => q.id === "GQ").total === 3600, [res.clientPrice, T.quote.find((q) => q.id === "GQ").total]);
  ok("…and the import books the GC's cost at $3,000", Number(T.quoteImport[0].snapshotAmount) === 3000);

  // The GC's homeowner accepts; the GC's quote becomes a job.
  T.quote.find((q) => q.id === "GQ").status = "accepted";
  T.job.push({ id: "GJ", companyId: "GC", quoteId: "GQ" });
  await materializeImportedCosts(db, { quoteId: "GQ", jobId: "GJ", companyId: "GC" });
  const adopted = await adoptImportsOnJob(db, { quoteId: "GQ", jobId: "GJ", companyId: "GC" });
  ok("acceptance puts the sender on the GC's job", adopted.adopted === 1 && T.jobSubcontractor.length === 1, adopted);
  const sub = T.subcontractor[0];
  ok("…as a new roster entry in the GC's company, linked to the sender", sub?.companyId === "GC" && sub?.linkedCompanyId === "SUB");
  ok("…carrying only what the sub's quote shows: name, email, phone", sub?.name === "Sparky Electric" && sub?.email === "office@sparky.test" && sub?.phone === "555-0199");
  ok("…and the business address their documents print, as one line (owner, 2026-10-03)", sub?.address === "12 Volt Rd, Ottawa, ON, K1A 0B1", sub?.address);
  ok("…recorded as filled from their profile, field by field", JSON.stringify(sub?.profileFilled) === JSON.stringify({ email: "office@sparky.test", phone: "555-0199", address: "12 Volt Rd, Ottawa, ON, K1A 0B1" }), sub?.profileFilled);
  ok("…and nothing private crosses: no Stripe account, no billing email", !JSON.stringify(sub).includes("acct_PRIVATE") && !JSON.stringify(sub).includes("owner-private"), sub);
  ok("…and nothing invented: no contact name, no trade from the neutral default label", sub?.contactName == null && sub?.trade === null, sub);
  const js = T.jobSubcontractor[0];
  ok("the job row is `agreed` at $3,000 and ADOPTS the import", js.status === "agreed" && Number(js.agreedAmount) === 3000 && js.quoteImportId === T.quoteImport[0].id && js.companyId === "GC");

  const costJob = async () => {
    const subcontracts = await loadJobSubcontracts(db, { companyId: "GC", jobId: "GJ" });
    const expenses = T.expense.filter((e) => e.projectId === "GJ" && e.companyId === "GC");
    return actualJobCost(expenses, [], { subcontracts });
  };
  let cost = await costJob();
  ok("job costing: $3,000 — the import expense AND the sub row describe it, counted once", cost.total === 3000 && cost.subcontracts.total === 3000 && cost.expenses.total === 0 && cost.subcontracts.expensesExcluded === 3000, cost.total);

  // ── Idempotency ─────────────────────────────────────────────────────────
  await materializeImportedCosts(db, { quoteId: "GQ", jobId: "GJ", companyId: "GC" });
  const again = await adoptImportsOnJob(db, { quoteId: "GQ", jobId: "GJ", companyId: "GC" });
  ok("a retried acceptance adds nothing: one expense, one sub, one job row", again.adopted === 0 && T.expense.length === 1 && T.subcontractor.length === 1 && T.jobSubcontractor.length === 1, [again, T.expense.length, T.subcontractor.length, T.jobSubcontractor.length]);
  ok("…and costs the same $3,000", (await costJob()).total === 3000);

  // ── Change orders on the SUB's job ──────────────────────────────────────
  T.quote.find((q) => q.id === "SQ").status = "accepted";
  T.job.push({ id: "SJ", companyId: "SUB", quoteId: "SQ" });
  const co = { id: "co1", jobId: "SJ", status: "waiting_client", priceDelta: 250, signature: null };
  T.changeOrder.push(co);
  await syncForSourceJob(db, { jobId: "SJ" });
  ok("a change order out for signature moves nothing", Number(js.agreedAmount) === 3000 && (await costJob()).total === 3000);
  co.status = "approved"; // staff marked it approved, no signature
  await syncForSourceJob(db, { jobId: "SJ" });
  ok("…nor one a staff member marked approved without the GC's signature", Number(js.agreedAmount) === 3000);
  co.signature = { name: "Pat GC", signatureDataUrl: "data:image/png;base64,x", signedAt: "2026-09-29T12:00:00Z" };
  await syncForSourceJob(db, { jobId: "SJ" });
  ok("approved AND signed by the GC: the job's subcontract becomes $3,250", Number(js.agreedAmount) === 3250, js.agreedAmount);
  cost = await costJob();
  ok("job costing: $3,250, still counted once", cost.total === 3250 && cost.subcontracts.total === 3250 && cost.expenses.total === 0, cost.total);
  ok("…the unadopted road agrees: the import's expense is $3,250 too", Number(T.expense[0].amount) === 3250);
  ok("the GC's price to their own client stays $3,600", T.quote.find((q) => q.id === "GQ").total === 3600);
  await syncForSourceJob(db, { jobId: "SJ" });
  await syncForSourceJob(db, { jobId: "SJ" });
  ok("the same signature synced three times is still $3,250 — replaced, never added", Number(js.agreedAmount) === 3250);
  co.status = "rejected";
  await syncForSourceJob(db, { jobId: "SJ" });
  ok("a signed change order taken back returns the cost to $3,000", Number(js.agreedAmount) === 3000);
  co.status = "approved";
  await syncForSourceJob(db, { jobId: "SJ" });

  // ── The sub's invoice ───────────────────────────────────────────────────
  T.invoice.push({ id: "INVD", companyId: "SUB", quoteId: "SQ", jobId: "SJ", parentInvoiceId: null, invoiceNumber: "INV-9", total: 9999, version: 1, sentAt: null });
  await syncForSourceInvoice(db, { invoiceId: "INVD" });
  ok("a draft invoice the GC never received is not a bill", T.subcontractorBill.length === 0);
  T.invoice.push({ id: "INV1", companyId: "SUB", quoteId: null, jobId: "SJ", parentInvoiceId: null, invoiceNumber: "INV-10", total: 3250, version: 1, sentAt: new Date("2026-09-30") });
  await syncForSourceInvoice(db, { invoiceId: "INV1" });
  let bills = T.subcontractorBill.filter((b) => b.jobSubcontractorId === js.id);
  ok("the sent invoice lands on the GC's job, owned by the GC", bills.length === 1 && bills[0].companyId === "GC" && Number(bills[0].total) === 3250 && bills[0].invoiceNumber === "INV-10");
  ok("…and matches the approved amount", subcontractBillState({ agreedAmount: js.agreedAmount, bills }).state === "matches");
  T.invoice.push({ id: "INV1v2", companyId: "SUB", quoteId: null, jobId: "SJ", parentInvoiceId: "INV1", invoiceNumber: "INV-10", total: 3400, version: 2, sentAt: new Date("2026-10-02") });
  await syncForSourceInvoice(db, { invoiceId: "INV1v2" });
  bills = T.subcontractorBill.filter((b) => b.jobSubcontractorId === js.id);
  const verdict = subcontractBillState({ agreedAmount: js.agreedAmount, bills });
  ok("an amended, re-sent invoice updates the ONE bill, not a second", bills.length === 1 && Number(bills[0].total) === 3400 && bills[0].version === 2);
  ok("…is flagged: Invoice $3,400 differs from approved $3,250", verdict.state === "differs" && verdict.billed === 3400 && verdict.approved === 3250, verdict);
  ok("…and the cost stays the approved $3,250", Number(js.agreedAmount) === 3250 && (await costJob()).total === 3250);

  // ── Tenant isolation ────────────────────────────────────────────────────
  // A row in ANOTHER company pointing at the same import id, and a job in
  // another company that claims the sub's quote as its own.
  T.jobSubcontractor.push({ id: "forged", companyId: "OTHER", jobId: "OJ", quoteImportId: T.quoteImport[0].id, agreedAmount: 1, status: "agreed" });
  T.job.push({ id: "OJX", companyId: "OTHER", quoteId: "SQ" });
  T.changeOrder.push({ id: "co_forged", jobId: "OJX", status: "approved", priceDelta: 100000, signature: { name: "Mallory" } });
  const before = writes.length;
  await syncForSourceJob(db, { jobId: "OJX" });
  ok("another company's job naming the sub's quote syncs nothing", writes.length === before, writes.slice(before));
  await syncForSourceJob(db, { jobId: "SJ" });
  ok("…its change order never reaches the GC's figure", Number(js.agreedAmount) === 3250);
  ok("a row in another company carrying the import id is never written", Number(T.jobSubcontractor.find((r) => r.id === "forged").agreedAmount) === 1);
  ok("…and gets no copy of the sub's bill", !T.subcontractorBill.some((b) => b.jobSubcontractorId === "forged"));
  const adoptOther = await adoptImportsOnJob(db, { quoteId: "GQ", jobId: "OJ", companyId: "OTHER" });
  ok("adoption for another company finds none of the GC's imports", adoptOther.adopted === 0);

  // ── The pure pieces, against hostile input ──────────────────────────────
  ok("isSignedApproval: a blank name is no signature", !isSignedApproval({ status: "approved", signature: { name: "  " } }));
  ok("isSignedApproval: a string is no signature", !isSignedApproval({ status: "approved", signature: "yes" }));
  ok("isSignedApproval: signed but pending is not approval", !isSignedApproval({ status: "pending", signature: { name: "A" } }));
  ok("approvedSubcontractTotal: junk deltas and nulls are skipped, cents exact", approvedSubcontractTotal({ snapshotAmount: "3000.10", changeOrders: [null, { status: "approved", signature: { name: "A" }, priceDelta: "0.2" }, { status: "approved", priceDelta: 50 }] }) === 3000.3);
  ok("approvedSubcontractTotal: a signed credit lowers it", approvedSubcontractTotal({ snapshotAmount: 3000, changeOrders: [{ status: "approved", signature: { name: "A" }, priceDelta: -400 }] }) === 2600);
  ok("subcontractBillState: 3250.1 + 0.2 matches 3250.3 in cents", subcontractBillState({ agreedAmount: 3250.3, bills: [{ total: 3250.1 }, { total: 0.2 }] }).state === "matches");
  ok("subcontractBillState: no bills is `none`, not a match", subcontractBillState({ agreedAmount: 0, bills: [] }).state === "none");
  ok("latestSentVersion: unsent root and unsent amendment is nothing", latestSentVersion({ id: "r", versions: [{ version: 2, sentAt: null }], sentAt: null }) === null);

  // ── Wired where the events happen ───────────────────────────────────────
  const codeOf = (p) => stripComments(read(p));
  ok("the acceptance path adopts after materialising", /materializeImportedCosts[\s\S]*adoptImportsOnJob/.test(codeOf("lib/jobs/createJobFromQuote.js")));
  ok("a job created from a quote by hand adopts too", /materializeImportedCosts[\s\S]*adoptImportsOnJob/.test(codeOf("lib/jobs/createJob.js")));
  ok("the client's signature syncs the GC's side", /syncForSourceJob\(db, \{ jobId: co\.jobId \}\)/.test(codeOf("app/api/public/change-orders/[token]/route.js")));
  ok("a staff decision re-syncs (a signed one can be taken back)", /syncForSourceJob\(db, \{ jobId: job\.id \}\)/.test(codeOf("app/api/jobs/[id]/change-orders/[changeOrderId]/route.js")));
  ok("sending an invoice syncs the GC's bill", /syncForSourceInvoice\(db, \{ invoiceId: invoice\.id \}\)/.test(codeOf("app/api/invoices/[id]/send/route.js")));
  ok("the job panel shows the bills and the verdict", /subcontractBillState/.test(codeOf("app/api/jobs/[id]/subcontractors/route.js")) && /billDiffers/.test(codeOf("app/components/jobs/JobSubcontractors.js")));
  ok("the money strip takes the bills off too", (() => { const r = stripJobSubcontractorMoney({ id: "x", agreedAmount: 1, bills: [{ total: 1 }], billing: { billed: 1 } }); return !("bills" in r) && !("billing" in r); })());

  // ── Already on the GC's roster: blanks filled, typed values kept ────────
  // (owner, 2026-10-03: "Never overwrite a value the GC already typed; fill
  // blanks only, and say on the roster where each came from.")
  {
    const { db: db2, T: T2 } = makeDb();
    T2.company.push(
      { id: "SUB", name: "Sparky Electric", email: "office@sparky.test", phone: "555-0199", address: "12 Volt Rd", city: "Ottawa", province: "ON", postalCode: "K1A 0B1" },
      { id: "GC", name: "Build Right" },
    );
    T2.quote.push({ id: "SQ", companyId: "SUB", status: "sent", total: 3000, acceptedTotal: null, quoteNumber: "Q-S-1" });
    T2.quote.push({ id: "GQ", companyId: "GC", status: "draft", total: 0, discount: 0, taxEnabled: false, quoteNumber: "Q-G-1" });
    // The GC listed Sparky by hand months ago: their own email for the
    // estimator they deal with, their own contact, no phone, no address.
    T2.subcontractor.push({ id: "mine", companyId: "GC", name: "Sparky (Dave)", contactName: "Dave", email: "dave@sparky.test", phone: "  ", address: null, linkedCompanyId: "SUB", createdAt: new Date(2026, 0, 1) });
    const load2 = (qid) => ({ ...T2.quote.find((q) => q.id === qid), scopeGroups: T2.quoteScopeGroup.filter((g) => g.quoteId === qid) });
    await performImport({ db: db2, member: { companyId: "GC", userId: "u" }, sourceQuote: load2("SQ"), targetQuote: load2("GQ"), targetCompany: { taxRate: 0 }, markupPercent: 0, display: "blended" });
    T2.quote.find((q) => q.id === "GQ").status = "accepted";
    T2.job.push({ id: "GJ", companyId: "GC", quoteId: "GQ" });
    await materializeImportedCosts(db2, { quoteId: "GQ", jobId: "GJ", companyId: "GC" });
    await adoptImportsOnJob(db2, { quoteId: "GQ", jobId: "GJ", companyId: "GC" });
    const mine = T2.subcontractor.find((s) => s.id === "mine");
    ok("an existing linked entry is used, not a second one made", T2.subcontractor.length === 1 && T2.jobSubcontractor[0]?.subcontractorId === "mine");
    ok("…the GC's typed email, name and contact stay exactly as typed", mine.email === "dave@sparky.test" && mine.name === "Sparky (Dave)" && mine.contactName === "Dave", mine);
    ok("…the blank phone (whitespace) and the missing address are filled from the profile", mine.phone === "555-0199" && mine.address === "12 Volt Rd, Ottawa, ON, K1A 0B1", mine);
    ok("…and only those two are recorded as from the profile", JSON.stringify(mine.profileFilled) === JSON.stringify({ phone: "555-0199", address: "12 Volt Rd, Ottawa, ON, K1A 0B1" }), mine.profileFilled);
    const s = fieldSources(mine);
    ok("the roster reads: email typed, phone and address from their profile, contact typed", s.email === "typed" && s.phone === "profile" && s.address === "profile" && s.contactName === "typed", s);
    // The sub changes its phone afterwards; a later adoption must not
    // overwrite what is now on the roster — it is no longer blank.
    T2.company[0].phone = "555-9999";
    await adoptImportsOnJob(db2, { quoteId: "GQ", jobId: "GJ2", companyId: "GC" });
    ok("a second adoption overwrites nothing (no longer blank)", mine.phone === "555-0199");
    // The GC edits the filled phone: it becomes theirs.
    mine.phone = "555-1234";
    ok("an edited filled value reads as typed — derived, nothing to keep in step", fieldSources(mine).phone === "typed" && fieldSources(mine).address === "profile");
  }

  // ── The pure fill, against hostile input ────────────────────────────────
  {
    eq2("documentProfileOf: only what a document prints", documentProfileOf({ name: " Sparky ", email: "Office@Sparky.TEST", phone: "555", address: "1 A St", city: "Ottawa", stripeAccountId: "acct_x", ownerName: "Pat" }), { name: "Sparky", email: "office@sparky.test", phone: "555", address: "1 A St, Ottawa" });
    eq2("…a malformed email is not copied", documentProfileOf({ name: "X", email: "not-an-email" }), { name: "X" });
    eq2("…blank and junk are absent, never ''", documentProfileOf({ name: "  ", email: "", phone: "\u0000\t", address: null }), {});
    eq2("…null / a string → {}", [documentProfileOf(null), documentProfileOf("x")], [{}, {}]);
    ok("…control characters are stripped and lengths capped", (() => { const p = documentProfileOf({ name: "A\u0007B", phone: "1".repeat(99), address: "x".repeat(999) }); return p.name === "A B" && p.phone.length === 40 && p.address.length === 300; })());
    ok("…the city is never printed twice (Google's formatted line already has it)", documentProfileOf({ name: "X", address: "5 Main St, Toronto, ON M5H 3M9, Canada", city: "Toronto", province: "ON" }).address === "5 Main St, Toronto, ON M5H 3M9, Canada");
    eq2("profileFillPatch: a new entry gets every printed field", profileFillPatch(null, { email: "a@b.co", phone: "1", address: "x" }).filled, ["email", "phone", "address"]);
    eq2("profileFillPatch: nothing blank → no write at all", profileFillPatch({ email: "mine@b.co", phone: "2", address: "y" }, { email: "a@b.co", phone: "1", address: "x" }), { data: {}, filled: [] });
    eq2("profileFillPatch: an empty profile fills nothing", profileFillPatch({}, {}), { data: {}, filled: [] });
    eq2("profileFillPatch: the earlier record is kept when another blank is filled later", profileFillPatch({ email: "a@b.co", phone: null, profileFilled: { email: "a@b.co" } }, { phone: "1" }).data, { phone: "1", profileFilled: { email: "a@b.co", phone: "1" } });
    ok("profileFillPatch: a junk profileFilled (array) is not trusted", JSON.stringify(profileFillPatch({ phone: null, profileFilled: ["x"] }, { phone: "1" }).data.profileFilled) === JSON.stringify({ phone: "1" }));
    ok("profileFillPatch never writes contactName or name", (() => { const p = profileFillPatch({}, { name: "N", contactName: "C", email: "a@b.co" }).data; return !("contactName" in p) && !("name" in p); })());
    eq2("fieldSources: junk → all null", fieldSources(null), { email: null, phone: null, address: null, contactName: null });
    ok("fieldSources: a contactName is never 'profile', even if a record claims it", fieldSources({ contactName: "Pat", profileFilled: { contactName: "Pat" } }).contactName === "typed");
    eq2("the Company columns read are the document identity, nothing else", Object.keys(PROFILE_COMPANY_SELECT).sort(), ["address", "city", "email", "name", "phone", "postalCode", "province"]);

    const parsedAddr = parseSubcontractorBody({ address: "  " + "y".repeat(400) + "  " }, { creating: false });
    ok("the roster form takes an address, trimmed and capped at 300", parsedAddr.data?.address?.length === 300, parsedAddr);
  }

  // ── Wired: both roads to the roster fill the same way; the screen says it ──
  {
    const panel = codeOf("app/api/jobs/[id]/subcontractors/route.js");
    ok("the job panel's 'from an import' reads the profile through the import", /sourceCompany: \{ select: PROFILE_COMPANY_SELECT \}/.test(panel));
    ok("…creates with the profile fill", /\.\.\.profileFillPatch\(null, profile\)\.data/.test(panel));
    ok("…and fills an existing entry's blanks only", /profileFillPatch\(matched, profile\)/.test(panel));
    const link = codeOf("lib/subcontractors/sourceLink.js");
    ok("acceptance reads the same select and the same fill", /sourceCompany: \{ select: PROFILE_COMPANY_SELECT \}/.test(link) && /profileFillPatch\(null, profile\)/.test(link) && /profileFillPatch\(sub, profile\)/.test(link));
    const detail = codeOf("app/api/subcontractors/[id]/route.js");
    ok("the detail route sends the verdict (sources), not the raw record", /sources: fieldSources\(sub\)/.test(detail) && /const \{ profileFilled: _filled, \.\.\.subOut \} = sub;/.test(detail));
    ok("the roster screen names what came from the profile", /app\.subcontractors\.filledFromProfile/.test(read("app/app/subcontractors/[id]/SubcontractorDetail.js")) && /app\.subcontractors\.fromProfile/.test(read("app/components/subcontractors/SubcontractorForm.js")));
    ok("the form reads and writes the address", /address: sub\?\.address \|\| ""/.test(read("app/components/subcontractors/SubcontractorForm.js")) && /field\("address"/.test(read("app/components/subcontractors/SubcontractorForm.js")));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
