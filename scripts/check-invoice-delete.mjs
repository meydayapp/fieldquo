// scripts/check-invoice-delete.mjs
//
// Deleting an invoice, "just like jobs".
//
//   node --import ./scripts/alias-loader.mjs scripts/check-invoice-delete.mjs
//
// ══ What the owner asked for ════════════════════════════════════════════════
//
// DELETE /api/invoices/[id] refused anything but `draft`. The owner: "the
// other ones should also be able to be deleted but a pop up confirm if they
// really want to have it delete should open making sure that the person is
// certain — just like jobs." Jobs delete any status and refuse only a job
// carrying records of work (logged hours, tasks). Invoices now delete any
// status and refuse only an invoice carrying a record of MONEY: a Payment row
// of any kind, or a bank debit the client has authorised and that has not
// cleared yet.
//
// ══ Why the REAL handler runs ═══════════════════════════════════════════════
//
// "Paid invoices are refused" is a claim about a query over Payment rows
// across the invoice FAMILY, and "the checkout link stops working" is a claim
// about a Stripe call that reads the session id out of a URL. Neither can be
// read off the source with confidence — the previous version of this route
// was one `if (status !== "draft")`, and a regex would have passed it. So
// the handler is imported and called against a scripted database, the way
// scripts/check-accounting-route.mjs does it, with "@/lib/db",
// "@/lib/currentMember", "@/lib/stripe" and "next/server" swapped for stubs.
// Every write is recorded, every Stripe call is recorded, and the assertions
// are made against what came back and what was written.
//
// The page half — the confirmation dialog — is JSX, which an alias-loader run
// cannot parse, so it is asserted as text: the same DeleteConfirmModal Jobs
// uses, named by the invoice number, with the server's own sentence surfaced
// when the delete is refused.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

import { PERMISSION_PRESETS } from "@/lib/permissions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let fail = 0;
let pass = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};

// ═══════════════════════════════════════════════════════════════════════════
// The scripted database
// ═══════════════════════════════════════════════════════════════════════════

globalThis.__FQ_ROWS = {};
globalThis.__FQ_WRITES = [];

function matchWhere(row, where) {
  if (!where) return true;
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") {
      if (!(Array.isArray(cond) ? cond : [cond]).every((c) => matchWhere(row, c))) return false;
      continue;
    }
    if (key === "OR") {
      if (!(Array.isArray(cond) ? cond : [cond]).some((c) => matchWhere(row, c))) return false;
      continue;
    }
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function project(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) {
      if (sub === true) out[key] = row[key];
      else if (Array.isArray(row[key])) out[key] = row[key].map((v) => project(v, sub));
      else out[key] = project(row[key], sub);
    }
    return out;
  }
  return { ...row };
}

function stubModel(name) {
  const all = () => (globalThis.__FQ_ROWS[name] ||= []);
  const note = (op, args) => globalThis.__FQ_WRITES.push({ model: name, op, args });
  return {
    async findMany(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).map((r) => project(r, args));
    },
    async findFirst(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? project(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? project(hit, args) : null;
    },
    async count(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).length;
    },
    async create(args = {}) {
      note("create", args);
      const row = { id: `${name}_${all().length + 1}`, ...args.data };
      all().push(row);
      return row;
    },
    async update(args = {}) {
      note("update", args);
      const hit = all().find((r) => matchWhere(r, args.where));
      if (!hit) throw new Error(`dbStub: ${name}.update matched nothing`);
      Object.assign(hit, args.data);
      return hit;
    },
    async updateMany(args = {}) {
      note("updateMany", args);
      const hits = all().filter((r) => matchWhere(r, args.where));
      for (const h of hits) Object.assign(h, args.data);
      return { count: hits.length };
    },
    async delete(args = {}) {
      note("delete", args);
      const idx = all().findIndex((r) => matchWhere(r, args.where));
      if (idx < 0) throw new Error(`dbStub: ${name}.delete matched nothing`);
      return all().splice(idx, 1)[0];
    },
    async deleteMany(args = {}) {
      note("deleteMany", args);
      const keep = all().filter((r) => !matchWhere(r, args.where));
      const count = all().length - keep.length;
      globalThis.__FQ_ROWS[name] = keep;
      return { count };
    },
  };
}

const MODELS = [
  "member", "company", "invoice", "payment", "user", "activityLog", "task",
  "jobPaymentStage", "changeOrder", "appointment", "servicePlanOccurrence",
];
const stubDb = Object.fromEntries(MODELS.map((m) => [m, stubModel(m)]));
stubDb.$transaction = async (fn) => fn(globalThis.__FQ_DB);
globalThis.__FQ_DB = new Proxy(stubDb, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (typeof prop === "symbol" || prop === "then") return undefined;
    // Loud, never quiet: a check must not pass because a query it failed to
    // model answered "nothing".
    throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
  },
});

globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;
globalThis.__FQ_STRIPE_CALLS = [];
globalThis.__FQ_STRIPE_EXPIRE = async (id) => {
  globalThis.__FQ_STRIPE_CALLS.push(id);
  // Stripe throws on a session that already completed or expired; the route
  // must swallow that, so one of the fixtures does exactly this.
  if (id.endsWith("done")) throw new Error("This Checkout Session is already complete");
  return { id, status: "expired" };
};

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "@/lib/stripe": "fq-stub:stripe",
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
  if (url === "fq-stub:stripe") {
    return { format: "module", shortCircuit: true,
      source: "export const stripe = { checkout: { sessions: { expire: (...a) => globalThis.__FQ_STRIPE_EXPIRE(...a) } } };" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true, source: \`
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; }
  static json(body, init) { const r = new NextResponse(body, init); r.json = async () => body; return r; }
}\` };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const route = await import("@/app/api/invoices/[id]/route.js");

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const CO = "co";
const inv = (id, status, extra = {}) => ({
  id,
  companyId: CO,
  invoiceNumber: `INV-${id}`,
  status,
  version: 1,
  parentInvoiceId: null,
  total: 1000,
  amountDue: 1000,
  stripeCheckoutUrl: null,
  pendingPaymentIntentId: null,
  ...extra,
});

function reset() {
  globalThis.__FQ_ROWS = {
    company: [{ id: CO, currency: "CAD" }, { id: "other", currency: "USD" }],
    user: [{ id: "u1", name: "Dana", email: "d@x.com" }],
    invoice: [
      inv("draft1", "draft"),
      inv("sent1", "sent", {
        stripeCheckoutUrl: "https://checkout.stripe.com/c/pay/cs_live_a1B2c3D4#fidkdWxOYHwnPyd1blpxYHZxWjA0",
      }),
      inv("over1", "overdue", {
        stripeCheckoutUrl: "https://checkout.stripe.com/c/pay/cs_test_zzdone#x",
      }),
      inv("paid1", "paid", { amountDue: 0 }),
      inv("part1", "sent", { amountDue: 600 }),
      inv("refund1", "refunded"),
      inv("bank1", "sent", { pendingPaymentIntentId: "pi_pending", amountDue: 850 }),
      // An amended family: v2 is the current document, the money landed on v1.
      inv("fam_v1", "sent"),
      inv("fam_v2", "sent", { version: 2, parentInvoiceId: "fam_v1" }),
      // Somebody else's.
      { ...inv("foreign1", "sent"), companyId: "other" },
    ],
    payment: [
      { id: "p1", invoiceId: "paid1", amount: 1000, kind: "payment" },
      { id: "p2", invoiceId: "part1", amount: 400, kind: "payment" },
      { id: "p3", invoiceId: "refund1", amount: 1000, kind: "payment" },
      { id: "p4", invoiceId: "refund1", amount: -1000, kind: "refund", refundOfPaymentId: "p3" },
      { id: "p5", invoiceId: "fam_v1", amount: 250, kind: "payment" },
    ],
    task: [
      { id: "t1", invoiceId: "sent1", sourceKey: "invoice_sent:sent1", status: "open" },
      { id: "t2", invoiceId: "draft1", sourceKey: "something_else", status: "open" },
    ],
    jobPaymentStage: [
      { id: "s1", invoiceId: "sent1", status: "pending" },
      { id: "s2", invoiceId: "paid1", status: "requested" },
    ],
    changeOrder: [{ id: "co1", invoiceId: "sent1" }],
    appointment: [{ id: "a1", invoiceId: "sent1" }],
    servicePlanOccurrence: [{ id: "o1", invoiceId: "sent1" }],
    activityLog: [],
    member: [],
  };
  globalThis.__FQ_WRITES = [];
  globalThis.__FQ_STRIPE_CALLS = [];
}

const PEOPLE = {
  owner: { id: "m_owner", userId: "u1", companyId: CO, role: "owner", permissions: null },
  // Invoices capped one level short of delete.
  editor: {
    id: "m_editor",
    userId: "u1",
    companyId: CO,
    role: "employee",
    permissions: { ...PERMISSION_PRESETS.estimator.values, invoices: "view_create_edit" },
  },
  deleter: {
    id: "m_deleter",
    userId: "u1",
    companyId: CO,
    role: "employee",
    permissions: { ...PERMISSION_PRESETS.estimator.values, invoices: "view_create_edit_delete" },
  },
  foreign: { id: "m_foreign", userId: "u1", companyId: "other", role: "owner", permissions: null },
};

async function del(who, id) {
  const row = PEOPLE[who];
  globalThis.__FQ_ROWS.member = Object.values(PEOPLE);
  globalThis.__FQ_SESSION = { id: row.id, userId: row.userId, companyId: row.companyId, role: row.role };
  const req = { url: `http://local/api/invoices/${id}`, method: "DELETE", headers: new Map() };
  const res = await route.DELETE(req, { params: Promise.resolve({ id }) });
  const body = await res.json();
  return { status: res.status, body };
}

const rowsOf = (model) => globalThis.__FQ_ROWS[model];
const has = (model, id) => rowsOf(model).some((r) => r.id === id);

// ═══════════════════════════════════════════════════════════════════════════
// 1. Any status without money is deletable
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n1. Draft, sent and overdue invoices with no money recorded are deleted");
for (const id of ["draft1", "sent1", "over1"]) {
  reset();
  const r = await del("owner", id);
  t(`${id} → 200`, r.status, 200);
  t(`${id} row is gone`, has("invoice", id), false);
}

console.log("\n2. What a deleted invoice leaves behind");
reset();
await del("owner", "sent1");
t("the payment-schedule stage survives with no invoice", rowsOf("jobPaymentStage").find((s) => s.id === "s1")?.invoiceId, null);
t("...and the other stage is untouched", rowsOf("jobPaymentStage").find((s) => s.id === "s2")?.invoiceId, "paid1");
t("the change order goes back to unbilled", rowsOf("changeOrder")[0].invoiceId, null);
t("the appointment stays, unlinked", rowsOf("appointment")[0].invoiceId, null);
t("the plan occurrence stays, unlinked", rowsOf("servicePlanOccurrence")[0].invoiceId, null);
t("the chase task is closed", rowsOf("task").find((x) => x.id === "t1")?.status, "done");
t("an unrelated open task is left open", rowsOf("task").find((x) => x.id === "t2")?.status, "open");
t("the deletion is recorded", rowsOf("activityLog").some((a) => a.action === "invoice.deleted"));
t("the open Checkout session is expired by its cs_ id", globalThis.__FQ_STRIPE_CALLS.join(","), "cs_live_a1B2c3D4");

reset();
const overdue = await del("owner", "over1");
t("a Checkout Stripe refuses to expire does not block the delete", overdue.status, 200);
t("...though it was asked", globalThis.__FQ_STRIPE_CALLS.join(","), "cs_test_zzdone");

// ═══════════════════════════════════════════════════════════════════════════
// 3. Money is a record — refused in words, with the amount
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n3. An invoice with money recorded is refused, and the sentence says how much");
const CASES = [
  ["paid1", "$1,000.00"],
  ["part1", "$400.00"],
  ["refund1", "$1,000.00"],
];
for (const [id, amount] of CASES) {
  reset();
  const r = await del("owner", id);
  t(`${id} → 409`, r.status, 409);
  t(`${id} names the amount ${amount}`, r.body.error.includes(amount));
  t(`${id} says why in words`, /record of money/.test(r.body.error));
  t(`${id} row still exists`, has("invoice", id));
  t(`${id} payments untouched`, rowsOf("payment").filter((p) => p.invoiceId === id).length >= 1);
  t(`${id} nothing was written`, globalThis.__FQ_WRITES.length, 0);
}
reset();
const bank = await del("owner", "bank1");
t("a bank debit on its way is refused", bank.status, 409);
t("...naming the amount in flight", bank.body.error.includes("$850.00"));
t("...as a payment on its way", /on its way/.test(bank.body.error));

console.log("\n4. The money is counted across the family, not the row");
reset();
const v2 = await del("owner", "fam_v2");
t("deleting v2 of an invoice paid on v1 is refused", v2.status, 409);
t("...with v1's amount", v2.body.error.includes("$250.00"));
t("both versions remain", has("invoice", "fam_v1") && has("invoice", "fam_v2"));

reset();
rowsOf("payment").splice(rowsOf("payment").findIndex((p) => p.id === "p5"), 1);
const fam = await del("owner", "fam_v2");
t("with no money, deleting the family removes every version", fam.status === 200 && !has("invoice", "fam_v1") && !has("invoice", "fam_v2"));

console.log("\n5. The currency is the company's, not a hardcoded dollar");
reset();
rowsOf("company")[0].currency = "EUR";
const eur = await del("owner", "paid1");
t("a EUR company reads a euro figure", /€/.test(eur.body.error));

// ═══════════════════════════════════════════════════════════════════════════
// 6. Who may, and whose
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n6. Gated on the grid's delete level, scoped to the tenant");
reset();
const editor = await del("editor", "draft1");
t("view_create_edit is refused", editor.status, 403);
t("...and the row stays", has("invoice", "draft1"));
reset();
const deleter = await del("deleter", "draft1");
t("view_create_edit_delete may delete", deleter.status, 200);
reset();
const foreign = await del("foreign", "sent1");
t("another company's invoice is a 404, not a 403", foreign.status, 404);
t("...and stays", has("invoice", "sent1"));
reset();
const missing = await del("owner", "nope");
t("an unknown id is a 404", missing.status, 404);

// ═══════════════════════════════════════════════════════════════════════════
// 7. The page: the same dialog Jobs uses, and the refusal surfaced verbatim
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n7. The invoice page confirms the way the job page does");
const PAGE = read("app/app/invoices/[id]/page.js");
const JOB_PAGE = read("app/app/jobs/[id]/JobDetail.js");
const MSGS = read("app/i18n/appMessages.js");
t("the invoice page uses DeleteConfirmModal", /<DeleteConfirmModal/.test(PAGE));
t("...the same component as jobs", /DeleteConfirmModal/.test(JOB_PAGE) && /components\/admin\/DeleteConfirmModal/.test(PAGE));
t("the dialog names the invoice number", /itemName=\{invoice\.invoiceNumber\}/.test(PAGE));
t("the body carries the invoice number", /deleteMessage", \{ number: invoice\.invoiceNumber \}/.test(PAGE));
t("the trash icon is gated on the delete level", /hasLevel\(\s*caller,\s*"invoices",\s*"view_create_edit_delete"/.test(PAGE));
t("a refusal is surfaced through reportResponseError (server sentence first)", /reportResponseError\(\s*res,\s*setError/.test(PAGE));
t("the English body no longer claims payment records are removed", !/"app.invoiceDetail.deleteMessage": "This invoice and its payment records/.test(MSGS));
const bodies = MSGS.match(/"app\.invoiceDetail\.deleteMessage": "[^"]*\{number\}[^"]*"/g) || [];
t("the dialog body carries {number} in all nine languages", bodies.length, 9);

const ROUTE = read("app/api/invoices/[id]/route.js");
t("the route no longer refuses on status", !/status !== "draft"/.test(ROUTE));
t("the cleanup is one transaction", /\$transaction\(async \(tx\)/.test(ROUTE));
t("the portal already answers a missing invoice in words", /invoiceNotFound/.test(read("app/portal/[token]/invoices/[id]/PortalInvoice.js")));
t("the payment-schedule cron skips a stage with no invoice", /reason: "no_invoice"/.test(read("lib/paymentSchedule/run.js")));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
