// scripts/check-dashboard.mjs
//
//   npm run check:dashboard
//
// The dashboard's money panels: what you are owed, how old it is, and what has
// actually come in.
//
// ══ Why this file executes rather than reads ═══════════════════════════════
//
// Three of the guarantees below cannot be established by reading source.
//
//   1. AMENDMENTS. app/api/invoices/[id]/route.js does not update a sent
//      invoice — it writes a NEW row with the same invoiceNumber, a
//      parentInvoiceId and a higher version. Every naive sum over the invoice
//      table therefore counts one job twice, at two different totals, and the
//      contractor is told they are owed money that does not exist. A regex can
//      confirm `invoiceFamilies` is imported; only running it can confirm the
//      answer is one document.
//
//   2. THE REFUSAL. "$0 revenue this month" was a 403 wearing a number on this
//      exact page. The fix is a state shape (lib/loadState.js) plus a gate in
//      the route, and the only way to prove the pair works is to call the
//      handler as a member who is refused and look at what comes back.
//
//   3. THE REDACTION. clientsProperties `name_address_only` has to shape the
//      payload of every route that carries a client, and the one that gets
//      missed is always the new one. A chase list is a phone book with amounts
//      on it, so it is exactly the payload that must not leak.
//
// So the real GET handler is imported and called with "@/lib/db",
// "@/lib/currentMember" and "next/server" swapped for stubs — the same
// technique scripts/check-crew-access.mjs section 10 uses, against the same
// kind of small Prisma evaluator.
//
// ══ And why it reconciles against the balance sheet ════════════════════════
//
// lib/accounting/statements.js already computes RECEIVABLES as at a date. Two
// answers to "how much am I owed" that differ by a dollar is worse than one, so
// section 1 runs BOTH modules over one dataset and asserts they agree exactly.
// That assertion is the reason lib/analytics/receivables.js is allowed to
// exist: it adds age, cards and a chase action to a definition it does not get
// to restate.
//
// Verified by mutation when it was written — every guarantee below was broken
// in the source, confirmed to FAIL here, and restored. The mutations are listed
// in the report that accompanied this file.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-dashboard.mjs

import { readFileSync } from "node:fs";
import {
  buildReceivables,
  buildRevenueTrend,
  agingBucket,
  AGING_BUCKETS,
  TREND_PERIODS,
} from "@/lib/analytics/receivables";
import { buildFinancialStatements } from "@/lib/accounting/statements";

let pass = 0;
const failures = [];
const ok = (label, condition, detail) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
  }
};

// Noon UTC everywhere. Both halves of a day-count shift by the same local
// offset, so a difference stays exact wherever this runs — and a date pinned at
// midnight would land on the previous day west of Greenwich and quietly change
// every age in this file by one.
const AS_OF = new Date("2026-08-29T12:00:00Z");
const at = (iso) => new Date(`${iso}T12:00:00Z`);

const COMPANY = "co_1";

/** An invoice row, with the money columns statements also reads. */
const inv = (over = {}) => ({
  id: over.id,
  companyId: COMPANY,
  parentInvoiceId: null,
  version: 1,
  invoiceNumber: over.invoiceNumber || "INV-1",
  status: "sent",
  subtotal: over.total ?? 0,
  discount: 0,
  tax: 0,
  total: 0,
  dueDate: null,
  sentAt: at("2026-06-01"),
  createdAt: at("2026-06-01"),
  clientId: "cl_1",
  client: { id: "cl_1", name: "Tremblay", email: "t@example.com", phone: "555-0100", address: "12 Maple St", city: "Laval", province: "QC" },
  ...over,
});

const pay = (id, invoiceId, amount, date) => ({
  id,
  invoiceId,
  amount,
  date: at(date),
  invoice: { companyId: COMPANY },
});

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. One definition of what you are owed, not two\n");
//
// The balance sheet's receivable and this panel's total are the same figure by
// construction: same families, same latest version, same payments-on-or-before
// rule. The one presentation split is an OVERPAID document, which a balance
// sheet nets and a chase list lists separately — so the identity asserted here
// is `total - creditsTotal`, not `total`.

const RECON = [
  inv({ id: "a", invoiceNumber: "INV-100", total: 1000, dueDate: at("2026-07-30") }),
  inv({ id: "b", invoiceNumber: "INV-101", total: 500, dueDate: at("2026-09-30") }),
  // Amended: v1 root at 800, v2 child at 1200. One document, worth 1200.
  inv({ id: "c1", invoiceNumber: "INV-102", total: 800, sentAt: at("2026-05-02"), createdAt: at("2026-05-02") }),
  inv({ id: "c2", invoiceNumber: "INV-102", total: 1200, parentInvoiceId: "c1", version: 2, sentAt: null, createdAt: at("2026-06-20") }),
  // Overpaid — the client sent 700 against a 600 invoice.
  inv({ id: "d", invoiceNumber: "INV-103", total: 600 }),
  // Settled in full.
  inv({ id: "e", invoiceNumber: "INV-104", total: 300, status: "paid" }),
  // A draft, which nobody has been asked to pay.
  inv({ id: "f", invoiceNumber: "INV-105", total: 900, status: "draft" }),
];
const RECON_PAYMENTS = [
  pay("p1", "c1", 200, "2026-05-20"),
  pay("p2", "d", 700, "2026-07-01"),
  pay("p3", "e", 300, "2026-07-02"),
];

const recon = buildReceivables({ invoices: RECON, payments: RECON_PAYMENTS, asOf: AS_OF });
const statements = buildFinancialStatements({
  from: "2025-01-01",
  to: "2026-08-29",
  currency: "CAD",
  invoices: RECON,
  payments: RECON_PAYMENTS,
});
const sheetReceivable = statements.balanceSheet.assets.available[0];

ok(
  "the balance sheet and the dashboard agree to the cent",
  Math.abs(recon.total + recon.creditsTotal - sheetReceivable.amount) < 0.005,
  `${recon.total} + ${recon.creditsTotal} vs ${sheetReceivable.amount}`,
);
ok(
  "...and the overpayment is the only thing held apart",
  recon.creditsTotal === -100 && recon.credits.length === 1,
  `${recon.creditsTotal} over ${recon.credits.length} row(s)`,
);
ok(
  "...so the chase list never shows a negative amount owed",
  recon.invoices.every((r) => r.owed > 0),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. An amended invoice is ONE document, at its latest version\n");
//
// The trap this whole file is built around. INV-102 exists as two rows; a sum
// over the table says 2000 and a sum over the roots says 800. Neither is what
// the client owes, which is 1200 less the 200 already paid.

const amended = recon.invoices.filter((r) => r.invoiceNumber === "INV-102");
ok("it appears exactly once", amended.length === 1, amended.length);
ok(
  "...priced at the LATEST version, not the original",
  amended[0]?.total === 1200,
  amended[0]?.total,
);
ok(
  "...less the payment taken against the version it was recorded on",
  amended[0]?.owed === 1000,
  amended[0]?.owed,
);
ok("...and it is flagged as amended", amended[0]?.amended === true);
ok(
  "...with the LATEST row's id, because that is the one a reminder may chase",
  amended[0]?.id === "c2",
  amended[0]?.id,
);
// A superseded version must not be chased, and the id above is what stops it.
ok(
  "...never the superseded row's id",
  !recon.invoices.some((r) => r.id === "c1"),
);
// The whole point of the sort: work the oldest debt first.
ok(
  "the list is oldest-debt-first",
  recon.invoices[0]?.invoiceNumber === "INV-100",
  recon.invoices[0]?.invoiceNumber,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Paid, cancelled and draft are not receivable; part-paid is\n");

ok("a settled invoice is not owed", !recon.invoices.some((r) => r.invoiceNumber === "INV-104"));
ok("a draft is not owed — nobody has been asked", !recon.invoices.some((r) => r.invoiceNumber === "INV-105"));

const CANCELLED = [inv({ id: "x", invoiceNumber: "INV-200", total: 400, status: "cancelled" })];
ok(
  "a cancelled invoice is not owed",
  buildReceivables({ invoices: CANCELLED, payments: [], asOf: AS_OF }).count === 0,
);
// And it is not silently an absence either — there IS an invoice, it is simply
// not receivable, which is "nothing outstanding" rather than "no invoices".
ok(
  "...and that reads as 'nothing outstanding', not 'no invoices'",
  buildReceivables({ invoices: CANCELLED, payments: [], asOf: AS_OF }).nothingOutstanding === true,
);

const PART = [inv({ id: "y", invoiceNumber: "INV-201", total: 1000, dueDate: at("2026-08-01") })];
const part = buildReceivables({
  invoices: PART,
  payments: [pay("p9", "y", 400, "2026-08-05")],
  asOf: AS_OF,
}).invoices[0];
ok("a part-paid invoice is receivable for the REMAINDER", part?.owed === 600, part?.owed);
ok("...and says it is part paid rather than showing its face value", part?.partiallyPaid === true);
ok("...while keeping the face value beside it", part?.total === 1000, part?.total);

// A payment dated AFTER the as-at date has not happened yet.
const future = buildReceivables({
  invoices: PART,
  payments: [pay("p10", "y", 400, "2026-12-01")],
  asOf: AS_OF,
}).invoices[0];
ok("a payment dated in the future is not deducted", future?.owed === 1000, future?.owed);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. No due date is NOT overdue — it is undated\n");
//
// The alternative — counting from createdAt — invents a debt age. "45 days past
// due" on an invoice that never carried a due date is a number the contractor
// cannot defend when the client asks where it came from.

const UNDATED = [
  inv({ id: "u", invoiceNumber: "INV-300", total: 700, dueDate: null, sentAt: at("2026-01-05"), createdAt: at("2026-01-05") }),
];
const undated = buildReceivables({ invoices: UNDATED, payments: [], asOf: AS_OF });
const u = undated.invoices[0];
ok("it is still owed", u?.owed === 700, u?.owed);
ok("...but carries NO day count", u?.daysPastDue === null, String(u?.daysPastDue));
ok("...and says so by name", u?.dueState === "undated", u?.dueState);
ok("...it lands in no aging bucket", u?.bucket === null, String(u?.bucket));
ok("...it is not in the overdue total", undated.overdueTotal === 0 && undated.overdueCount === 0);
ok("...it has its own total instead", undated.undatedTotal === 700 && undated.undatedCount === 1);
// Nearly eight months old. Anything that quietly aged from createdAt would put
// it in the 90+ bucket, which is the exact failure being excluded.
ok(
  "...no aging bucket claims it",
  undated.aging.every((b) => b.count === 0),
);
// A due date that will not parse is as much of a deadline as no date at all.
const BAD_DUE = [inv({ id: "bd", invoiceNumber: "INV-301", total: 100, dueDate: "not-a-date" })];
ok(
  "an unparseable due date is treated as undated, not as overdue",
  buildReceivables({ invoices: BAD_DUE, payments: [], asOf: AS_OF }).invoices[0]?.dueState === "undated",
);

// A due date in the FUTURE is not late either.
const NOT_DUE = [inv({ id: "n", invoiceNumber: "INV-302", total: 100, dueDate: at("2026-09-30") })];
const notDue = buildReceivables({ invoices: NOT_DUE, payments: [], asOf: AS_OF });
ok("an invoice due next month is not overdue", notDue.invoices[0]?.dueState === "not_due");
ok("...and contributes nothing to the past-due figure", notDue.overdueTotal === 0);

// The ladder itself, at its boundaries. Off-by-one here moves real money
// between the columns a contractor reads to decide who to ring.
ok("day 0 is not yet due", agingBucket(0) === "not_due");
ok("day 1 opens the first overdue rung", agingBucket(1) === "days_1_30");
ok("day 30 is still in it", agingBucket(30) === "days_1_30");
ok("day 31 moves on", agingBucket(31) === "days_31_60");
ok("day 91 is the last rung", agingBucket(91) === "days_90_plus");
ok("a null day count belongs to no rung", agingBucket(null) === null);
ok("...and neither does a nonsense one", agingBucket("soon") === null);
ok(
  "every overdue rung is marked as overdue, and not_due is not",
  AGING_BUCKETS.filter((b) => b.overdue).length === 4 &&
    AGING_BUCKETS.find((b) => b.id === "not_due").overdue === false,
);

// The 30-day debt from section 1 lands where a contractor would put it.
ok(
  "a 30-day-old debt sits on the 1–30 rung",
  recon.invoices.find((r) => r.invoiceNumber === "INV-100")?.bucket === "days_1_30",
  recon.invoices.find((r) => r.invoiceNumber === "INV-100")?.bucket,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. Absence is not zero\n");

const nothingAtAll = buildReceivables({ invoices: [], payments: [], asOf: AS_OF });
ok("no invoices at all is its own state", nothingAtAll.noInvoices === true);
ok("...and is NOT reported as 'everything is paid'", nothingAtAll.nothingOutstanding === false);

const allSettled = buildReceivables({
  invoices: [inv({ id: "s", invoiceNumber: "INV-400", total: 200 })],
  payments: [pay("p11", "s", 200, "2026-07-01")],
  asOf: AS_OF,
});
ok("everything paid is a different state again", allSettled.nothingOutstanding === true);
ok("...and it knows invoices exist", allSettled.noInvoices === false);

// An invoice that cannot be placed in time is counted and named, never dropped
// into silence — the same thing statements.js warns about.
const NO_DATE = [inv({ id: "z", invoiceNumber: "INV-401", total: 500, sentAt: null, createdAt: null })];
const noDate = buildReceivables({ invoices: NO_DATE, payments: [], asOf: AS_OF });
ok("an invoice with no date at all is excluded", noDate.count === 0);
ok("...and reported rather than hidden", noDate.notPlaced === 1, noDate.notPlaced);

// The trend's absence, which is the one that would otherwise draw a confident
// flat line along the axis of a company that has never been paid.
const neverPaid = buildRevenueTrend({ payments: [], months: 6, everRecorded: false, asOf: AS_OF });
ok("a company that has never been paid gets no chart", neverPaid.available === false);
ok("...it is told why", neverPaid.reason === "no_payments_recorded", neverPaid.reason);
ok("...and no series of zeros is handed to the screen", neverPaid.series.length === 0);

// Quiet months are NOT absence: the company has been paid before, so a run of
// zeros is a real answer and gets a real chart.
const quiet = buildRevenueTrend({ payments: [], months: 6, everRecorded: true, asOf: AS_OF });
ok("a quiet stretch IS a chart — those zeros are known", quiet.available === true);
ok("...with a bar slot for every month asked for", quiet.series.length === 6, quiet.series.length);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The trend, and the sentence it is allowed to say\n");

const TREND_PAYMENTS = [
  pay("t1", "a", 4000, "2026-06-10"),
  pay("t2", "a", 2000, "2026-06-20"),
  pay("t3", "a", 5040, "2026-07-05"),
  pay("t4", "a", 900, "2026-08-03"), // the current, unfinished month
];
const trend = buildRevenueTrend({ payments: TREND_PAYMENTS, months: 6, everRecorded: true, asOf: AS_OF });
ok("the window is the length asked for", trend.series.length === 6, trend.series.length);
ok("the current month is marked partial", trend.series.at(-1)?.partial === true);
ok("...and no earlier month is", trend.series.slice(0, -1).every((s) => !s.partial));
ok("June totals both of its payments", trend.series.find((s) => s.month === "2026-06")?.amount === 6000);

// The headline compares the last two COMPLETE months. Including August — four
// weeks short — would manufacture a collapse on the 2nd of every month.
ok("the headline is July against June", trend.headline?.month === "2026-07" && trend.headline?.priorMonth === "2026-06");
ok("...never the unfinished month", trend.headline?.month !== "2026-08");
ok("...and it states the direction", trend.headline?.direction === "down", trend.headline?.direction);
ok("...with the percentage, rounded and unsigned", trend.headline?.deltaPct === 16, trend.headline?.deltaPct);

// "Up from nothing" has no percentage. ∞% or 100% would both be inventions.
const fromZero = buildRevenueTrend({
  payments: [pay("t5", "a", 1200, "2026-07-11")],
  months: 6,
  everRecorded: true,
  asOf: AS_OF,
});
ok("a rise from a month of nothing carries no percentage", fromZero.headline?.deltaPct === null);
ok("...but still names the direction", fromZero.headline?.direction === "up");

// One complete month is not a comparison.
const oneMonth = buildRevenueTrend({ payments: TREND_PAYMENTS, months: 3, everRecorded: true, asOf: AS_OF });
ok("a shorter window is honoured", oneMonth.series.length === 3, oneMonth.series.length);
ok("the period selector offers 3, 6 and 12 months", TREND_PERIODS.join(",") === "3,6,12", TREND_PERIODS.join(","));
ok("an unsupported period falls back rather than throwing", buildRevenueTrend({ payments: [], months: 99, everRecorded: true, asOf: AS_OF }).months === 6);

// ── The commentary must not become a horoscope ─────────────────────────────
//
// The competitor's panel reads "revenue declined 16%, focus on new sales
// opportunities". The number is worth having; the advice is a template that
// fires whatever the figure, and one sentence of it makes the whole panel less
// believable. This asserts the advice is not in the source at all.
const page = readFileSync("app/app/page.js", "utf8");
// Comments stripped first: the file explains at length why this advice is not
// there, and a scan that read its own explanation as the offence would fail
// forever and teach the next person to delete the explanation.
const pageCopy = page
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ")
  .toLowerCase();
for (const phrase of ["focus on new sales", "opportunities", "you should", "try to"]) {
  ok(`the panel never says "${phrase}"`, !pageCopy.includes(phrase));
}
ok(
  "the change is stated plainly instead — key AND English fallback, so it reads before the catalogue lands",
  /app\.dash\.revenue\.down/.test(page) && /down \{pct\}% on \{priorMonth\}/.test(page),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The endpoint, EXECUTED — a refusal is ABSENT, never zero\n");

const { register } = await import("node:module");

globalThis.__FQ_ROWS = { member: [], invoice: [], payment: [], company: [], followUpRule: [] };

const RELATIONS = new Set(["client", "invoice", "template"]);

/** A small Prisma `where` evaluator — enough for the queries this route makes. */
function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      // A to-one relation filter, e.g. payment.invoice: { companyId }.
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function projectRelation(value, spec) {
  if (spec === true) return value;
  if (Array.isArray(value)) return value.map((v) => projectRow(v, spec));
  if (value == null) return null;
  return projectRow(value, spec);
}

/** `select` builds up, `include` starts from the row — same as Prisma. */
function projectRow(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) {
      out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
    }
    return out;
  }
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (!RELATIONS.has(key)) out[key] = value;
  }
  for (const [key, sub] of Object.entries(spec.include || {})) {
    out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
  }
  return out;
}

/**
 * `orderBy`, honoured rather than ignored.
 *
 * findFirst without it returns whatever row happens to sit first in the
 * fixture array, which makes "the OLDEST matching rule wins" untestable — and
 * that is exactly the assertion that has to fail when the template filter is
 * removed. A stub that quietly agreed with insertion order would pass a route
 * that had lost its filter.
 */
function applyOrder(rows, orderBy) {
  if (!orderBy) return rows;
  const [key, dir] = Object.entries(orderBy)[0] || [];
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const cmp = av === bv ? 0 : av > bv ? 1 : -1;
    return dir === "desc" ? -cmp : cmp;
  });
}

function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  return {
    async findMany(args = {}) {
      return applyOrder(all().filter((r) => matchWhere(r, args.where)), args.orderBy).map((r) =>
        projectRow(r, args),
      );
    },
    async findFirst(args = {}) {
      const hit = applyOrder(all().filter((r) => matchWhere(r, args.where)), args.orderBy)[0];
      return hit ? projectRow(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  {
    member: stubModel("member"),
    invoice: stubModel("invoice"),
    payment: stubModel("payment"),
    company: stubModel("company"),
    followUpRule: stubModel("followUpRule"),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Loud, not quiet: a check must never pass because a query it did not
      // model answered "nothing".
      throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
    },
  },
);

globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const receivablesRoute = await import("@/app/api/analytics/receivables/route.js");

globalThis.__FQ_ROWS.company = [{ id: COMPANY, currency: "CAD" }];
globalThis.__FQ_ROWS.invoice = RECON.map((r) => ({ ...r }));
globalThis.__FQ_ROWS.payment = RECON_PAYMENTS.map((p) => ({ ...p }));
globalThis.__FQ_ROWS.followUpRule = [];

const OWNER = { id: "m_owner", userId: "u_owner", role: "owner", permissions: null, companyId: COMPANY };
// A dispatcher who may read invoices but whose grid hides prices — the exact
// shape that used to be told the company had billed nothing this month.
const NO_PRICES = {
  id: "m_noprice",
  userId: "u_noprice",
  role: "employee",
  companyId: COMPANY,
  permissions: { invoices: "view_only", clientsProperties: "full_view", showPricing: false },
};
// A member at invoices:none — refused the list, and refused this.
const NO_INVOICES = {
  id: "m_noinv",
  userId: "u_noinv",
  role: "employee",
  companyId: COMPANY,
  permissions: { invoices: "none", clientsProperties: "full_view", showPricing: true },
};
// Sees prices and invoices, but only names and addresses of clients.
const NAME_ADDRESS = {
  id: "m_na",
  userId: "u_na",
  role: "employee",
  companyId: COMPANY,
  permissions: { invoices: "view_only", clientsProperties: "name_address_only", showPricing: true },
};
// Same, but allowed to create and edit invoices — which is what
// request-payment enforces, and therefore what the chase button needs.
const CHASER = {
  id: "m_chase",
  userId: "u_chase",
  role: "employee",
  companyId: COMPANY,
  permissions: { invoices: "view_create_edit", clientsProperties: "name_address_only", showPricing: true },
};
globalThis.__FQ_ROWS.member = [OWNER, NO_PRICES, NO_INVOICES, NAME_ADDRESS, CHASER];

const call = async (member, url = "http://x/api/analytics/receivables") => {
  globalThis.__FQ_SESSION = member;
  return receivablesRoute.GET({ url, headers: { get: () => null } });
};

const asOwner = await call(OWNER);
ok("an owner gets the panel", asOwner.status === 200, asOwner.status);
ok("...with a real total", asOwner.body.receivables.total > 0, asOwner.body.receivables.total);
ok(
  "...counting the amended invoice once, through the route",
  asOwner.body.receivables.invoices.filter((r) => r.invoiceNumber === "INV-102").length === 1,
);

const refusedPricing = await call(NO_PRICES);
ok("a member without showPricing is REFUSED", refusedPricing.status === 403, refusedPricing.status);
ok("...and is handed no figure at all", refusedPricing.body.receivables === undefined);
ok("...not a zero", JSON.stringify(refusedPricing.body).includes("total") === false);

const refusedInvoices = await call(NO_INVOICES);
ok("a member at invoices:none is REFUSED", refusedInvoices.status === 403, refusedInvoices.status);
ok("...and is handed no figure at all", refusedInvoices.body.receivables === undefined);

// The other half of the pair: the page must turn that 403 into absence rather
// than into a rendered zero. This is the bug that shipped once already.
ok(
  "the page keeps `money` null when the request fails",
  /setMoney\(null\);/.test(page),
);
ok(
  "...and a 403 leaves no error banner, because nothing went wrong",
  /setMoneyErrorKey\(result\.status === 403 \? "" : result\.errorKey\)/.test(page),
);
ok(
  "...so both panels render only from a body the server actually sent",
  /\{money\?\.receivables && \(/.test(page) && /\{money\?\.revenue && \(/.test(page),
);
// The tell-tale of the original bug, in the shape it took: `|| 0` on a figure
// that may be a refusal. None of the new figures may carry one.
ok(
  "no new money figure is defaulted to 0",
  !/receivables\.\w+ \|\| 0/.test(page) && !/revenue\.\w+ \|\| 0/.test(page),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. Client details, EXECUTED — the dial shapes the payload\n");
//
// A chase list is a phone book with amounts against it. `name_address_only`
// exists precisely to stop that leaving with somebody, and the route that gets
// missed is always the new one.

const asOwnerCard = asOwner.body.receivables.invoices[0];
ok("an owner sees the client's email", Boolean(asOwnerCard.client?.email));
ok("...and their phone", Boolean(asOwnerCard.client?.phone));

const restricted = await call(NAME_ADDRESS);
ok("a restricted member still gets the panel", restricted.status === 200, restricted.status);
const cards = restricted.body.receivables.invoices;
ok("...and still sees the client's NAME", cards.every((c) => Boolean(c.client?.name)));
ok("...and the address, which is what the level grants", cards.some((c) => Boolean(c.client?.address)));
ok("...but not one email address", cards.every((c) => c.client?.email === undefined));
ok("...and not one phone number", cards.every((c) => c.client?.phone === undefined));
ok("...each card marked restricted, so the screen says hidden rather than blank", cards.every((c) => c.client?.restricted === true));
// The credits list carries the same client rows and must not be the way out.
const restrictedCredits = restricted.body.receivables.credits;
ok(
  "the overpaid list is redacted too — it carries the same rows",
  restrictedCredits.every((c) => c.client?.email === undefined && c.client?.phone === undefined),
);
// The blunt version of the same assertion: the address is nowhere in the wire
// format, not merely absent from the field the check happened to look at.
ok(
  "no restricted contact detail survives anywhere in the payload",
  !JSON.stringify(restricted.body).includes("t@example.com") &&
    !JSON.stringify(restricted.body).includes("555-0100"),
);
ok("...while the owner's payload does carry them", JSON.stringify(asOwner.body).includes("t@example.com"));
// And the screen has somewhere to say so.
ok("the page renders 'hidden by your access level' rather than an empty line", /app\.access\.restricted/.test(page));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The reminder button, and the thing that actually sends\n");
//
// AGENTS.md's rule that matters most: never ship a control that appears to work
// and doesn't. Three separate Send buttons in this codebase set a status and
// emailed nobody. So the button is only allowed to exist because a route
// behind it really posts an email.

const chaseRoute = readFileSync("app/api/invoices/[id]/request-payment/route.js", "utf8");
ok("the route it calls really sends an email", /resend\.emails\.send\(/.test(chaseRoute));
ok("...through the company's own sender, not FieldQuo's", /resolveSender\(/.test(chaseRoute));
ok("...and records that it happened only after Resend accepts", /db\.invoice\.update\(/.test(chaseRoute));
ok(
  "...it enforces invoices at view_create_edit",
  /requireLevel\(full, "invoices", "view_create_edit"/.test(chaseRoute),
);

const routeSrc = readFileSync("app/api/analytics/receivables/route.js", "utf8");
ok(
  "canRemind is decided by the SAME level, server-side",
  /hasLevel\(full, "invoices", "view_create_edit"\)/.test(routeSrc),
);
ok(
  "the button is gated on it, so the server can never 403 a button it drew",
  /money\.canRemind &&/.test(page),
);
ok(
  "the button POSTs to the route that sends",
  /\/api\/invoices\/\$\{invoice\.id\}\/request-payment/.test(page),
);
ok(
  "a failed send is reported, never swallowed into a silent no-op",
  /reportResponseError\(/.test(page),
);

const noChase = await call(NAME_ADDRESS);
ok("a view-only member is told they may not chase", noChase.body.canRemind === false);
const canChase = await call(CHASER);
ok("...and an editor is told they may", canChase.body.canRemind === true);
ok("an owner may chase", asOwner.body.canRemind === true);

// What the automation will do, which is true whether or not a rule exists —
// and a rule with no template is not a rule that sends.
ok("no active rule means the panel says nothing chases these on its own", asOwner.body.automaticReminder === null);
globalThis.__FQ_ROWS.followUpRule = [
  { id: "r1", companyId: COMPANY, triggerEvent: "invoice_overdue", active: true, templateId: "tpl", name: "Chase", delayValue: 5, delayUnit: "days", createdAt: at("2026-01-01") },
  { id: "r2", companyId: COMPANY, triggerEvent: "invoice_overdue", active: true, templateId: null, name: "Broken", delayValue: 1, delayUnit: "days", createdAt: at("2025-01-01") },
];
const withRule = await call(OWNER);
ok("a live rule is reported with its delay", withRule.body.automaticReminder?.delayValue === 5, withRule.body.automaticReminder?.delayValue);
ok(
  "...and a rule with no template is skipped, because the cron skips it too",
  withRule.body.automaticReminder?.name === "Chase",
  withRule.body.automaticReminder?.name,
);
const cron = readFileSync("app/api/cron/follow-ups/route.js", "utf8");
ok("...which is what the cron actually does", /if \(!finder \|\| !rule\.template\)/.test(cron));
globalThis.__FQ_ROWS.followUpRule = [];

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n10. The period selector is real, and the route honours it\n");

const sixMonths = await call(OWNER, "http://x/api/analytics/receivables?months=6");
const twelve = await call(OWNER, "http://x/api/analytics/receivables?months=12");
ok("asking for 12 months returns 12", twelve.body.revenue.series.length === 12, twelve.body.revenue.series.length);
ok("...and 6 returns 6", sixMonths.body.revenue.series.length === 6, sixMonths.body.revenue.series.length);
const nonsense = await call(OWNER, "http://x/api/analytics/receivables?months=999");
ok("a nonsense period falls back rather than 500ing", nonsense.body.revenue.series.length === 6);
ok("the options are sent to the screen rather than hardcoded in it", Array.isArray(sixMonths.body.periods));
ok("...and the selector refetches on change", /setTrendMonths\(p\)/.test(page) && /months=\$\{trendMonths\}/.test(page));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n11. The diary panel — an empty week and an unread week\n");
//
// The last panel on this page still holding lib/loadState.js's founding bug.
// `upcomingAppointments` started at `useState([])` behind a bare
// `fetch(...).then((r) => (r.ok ? r.json() : null))`, and the failure branch
// simply returned — leaving the initial empty array in place. So a transient
// 500 on GET /api/appointments rendered, on the panel that says what happens
// tomorrow, "Nothing scheduled yet — book an appointment" at a contractor with
// a full week. The count tile one section up had already been fixed for exactly
// this; the list beside it had not.
//
// Asserted against the SOURCE, with comments stripped. The file explains this
// bug at length, and a scan reading its own explanation as the offence is the
// false pass this repo has already been burnt by twice.

const pageCode = page
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

ok(
  "the diary is fetched through fetchArray, not a bare r.ok ternary",
  /fetchArray\("\/api\/appointments"\)/.test(pageCode) &&
    !/\/api\/appointments"\)[\s\S]{0,120}?r\.ok \? r\.json\(\)/.test(pageCode),
);
ok(
  "the list starts as null — an empty array is a claim of zero made before the server answered",
  /const \[upcomingAppointments, setUpcomingAppointments\] = useState\(null\)/.test(
    pageCode,
  ),
);
ok(
  "a failed load puts the list BACK to null rather than leaving a stale or empty one",
  /setUpcomingAppointments\(null\);/.test(pageCode),
);
ok(
  "...and drops the count with it, so an error panel never sits beside a live number",
  /setUpcomingAppointments\(null\);\s*setUpcomingCount\(null\);/.test(pageCode),
);

// The empty state and the error state must be mutually exclusive BY
// STRUCTURE. Locating the <ListState> that actually encloses the CTA is the
// point: asserting that the file contains both strings somewhere would pass on
// a page where the CTA had been moved back outside the guard.
const ctaAt = pageCode.indexOf("app.dash.nothingScheduledCta");
const guardAt = pageCode.lastIndexOf("<ListState", ctaAt);
const guard = ctaAt > -1 && guardAt > -1 ? pageCode.slice(guardAt, ctaAt) : "";
ok(
  "the 'nothing scheduled' CTA is inside a <ListState>",
  ctaAt > -1 && guardAt > -1,
);
ok(
  "...and it is the diary's own guard, holding the diary's error key",
  /errorKey=\{appointmentsErrorKey\}/.test(guard),
  guard.slice(0, 120),
);
ok(
  "...which offers a retry that reloads the diary",
  /onRetry=\{loadAppointments\}/.test(guard),
);
ok(
  "...and decides 'empty' from an array the server sent, never from .length on a null",
  /isEmpty=\{\s*Array\.isArray\(upcomingAppointments\)/.test(guard),
);

console.log(
  failures.length
    ? `\nFAILED — ${failures.length} of ${pass + failures.length}\n${failures.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(failures.length ? 1 : 0);
