// scripts/check-void-manual-payment.mjs
//
//   npm run check:void-manual-payment
//
// Voiding a payment recorded by hand — the owner's 2026-10-05 report: he could
// not delete his TEST jobs and clients because he had pressed Record Payment
// on a test invoice, and the only way out on offer was a refund of money that
// never moved. lib/payments/voidPayment.js, POST /api/invoices/[id]/void-payment.
//
// ══ Why the REAL handlers run ══════════════════════════════════════════════
//
// "A card payment can never be voided" and "the invoice goes back to unpaid"
// are claims about a query, a transaction and a ledger recompute, not about a
// line of source. So the void route and the invoice / client DELETE routes are
// imported and called against a scripted database — the way
// scripts/check-invoice-delete.mjs does it — with "@/lib/db",
// "@/lib/currentMember", "@/lib/stripe", "@/lib/commissions/hook" and
// "next/server" swapped for stubs. Every write is recorded.
//
//   1. a hand-recorded payment voids, and the ledger recomputes (paid → sent)
//   2. a card / Stripe payment is refused — and every other kind of evidence
//      that the processor touched it
//   3. crew, estimator, manager refused; owner and admin allowed
//   4. impersonation refused
//   5. another company's invoice → 404; a payment on another invoice → 404
//   6. the audit row: who, when, amount, method, reason — and it is atomic
//   7. delete works after the void; refusals say what to do
//   8. every PaymentMethod is classified; the page and the strings are wired
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
  if (!ok) console.log(`  FAIL ${name}  got=${got} want=${want}`);
};

// ═══════════════════════════════════════════════════════════════════════════
// The scripted database
// ═══════════════════════════════════════════════════════════════════════════

globalThis.__FQ_ROWS = {};
globalThis.__FQ_WRITES = [];
globalThis.__FQ_COMMISSION_SYNCS = [];

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
      const row = { id: `${name}_${all().length + 1}`, createdAt: new Date(), ...args.data };
      all().push(row);
      return row;
    },
    async update(args = {}) {
      note("update", args);
      const hit = all().find((r) => matchWhere(r, args.where));
      if (!hit) throw new Error(`dbStub: ${name}.update matched nothing`);
      Object.assign(hit, args.data);
      return { ...hit };
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
  "member", "company", "invoice", "payment", "user", "activityLog", "task", "client", "quote", "job", "timeEntry",
  "jobPaymentStage", "changeOrder", "appointment", "servicePlanOccurrence",
];
const stubDb = Object.fromEntries(MODELS.map((m) => [m, stubModel(m)]));
// A transaction that THROWS rolls back: the check snapshots the rows and
// restores them, so "atomic" is something this file can observe.
stubDb.$transaction = async (fn) => {
  const snapshot = structuredClone(globalThis.__FQ_ROWS);
  const writes = globalThis.__FQ_WRITES.length;
  try {
    return await fn(globalThis.__FQ_DB);
  } catch (err) {
    globalThis.__FQ_ROWS = snapshot;
    globalThis.__FQ_WRITES.length = writes;
    throw err;
  }
};
stubDb.$executeRaw = async () => 1;
globalThis.__FQ_DB = new Proxy(stubDb, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (typeof prop === "symbol" || prop === "then") return undefined;
    throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
  },
});

globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "@/lib/stripe": "fq-stub:stripe",
  "@/lib/commissions/hook": "fq-stub:commissions",
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
      source: "export const stripe = { checkout: { sessions: { expire: async () => ({}) } }, refunds: { create: async () => { throw new Error('a void must never call Stripe'); } } };" };
  }
  if (url === "fq-stub:commissions") {
    return { format: "module", shortCircuit: true,
      source: "export async function syncCommissionsForInvoice(db, id) { globalThis.__FQ_COMMISSION_SYNCS.push(id); return {}; }" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true, source: \`
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; }
  static json(body, init) { const r = new NextResponse(body, init); r.json = async () => body; r.clone = () => r; return r; }
}\` };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const voidRoute = await import("@/app/api/invoices/[id]/void-payment/route.js");
const invoiceRoute = await import("@/app/api/invoices/[id]/route.js");
const clientRoute = await import("@/app/api/clients/[id]/route.js");
const jobRoute = await import("@/app/api/jobs/[id]/route.js");
const { PAYMENT_METHOD_VOIDABLE, voidRefusal } = await import("@/lib/payments/voidPayment.js");

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const CO = "co";
const SENT = new Date("2026-09-20T12:00:00Z");
const inv = (id, extra = {}) => ({
  id, companyId: CO, clientId: "client_test", invoiceNumber: `INV-${id}`, status: "paid", version: 1, parentInvoiceId: null,
  total: 1000, amountPaid: 1000, amountDue: 0, amountRefunded: 0, paidDate: new Date("2026-09-21"), paidVia: null, refundedAt: null,
  sentAt: SENT, historicalImportedAt: null, stripeCheckoutUrl: null, pendingPaymentIntentId: null, ...extra,
});
const pay = (id, invoiceId, amount, method, extra = {}) => ({
  id, invoiceId, amount, method, kind: "payment", notes: null, date: new Date("2026-09-21"), createdAt: new Date("2026-09-21T15:00:00Z"),
  stripePaymentIntentId: null, stripeRefundId: null, refundOfPaymentId: null, refundedAmount: 0, disputeStatus: null,
  processingFeeCents: null, netCents: null, stripeFeeCents: null, ...extra,
});

function reset() {
  globalThis.__FQ_ROWS = {
    company: [{ id: CO, currency: "CAD" }, { id: "other", currency: "USD" }],
    user: [{ id: "u1", name: "Dana Owner", email: "d@x.com" }, { id: "u2", name: "Ari Admin", email: "a@x.com" }],
    client: [{ id: "client_test", companyId: CO, name: "Test Client" }, { id: "client_empty", companyId: CO, name: "Empty Client" }],
    quote: [], job: [],
    invoice: [
      inv("cash1"),                                                     // one cash payment, paid
      inv("half", { status: "paid" }),                                  // two cash halves
      inv("stripe1"),                                                   // card through FieldQuo
      inv("mixed"),                                                     // cash + card
      inv("refunded1", { status: "refunded", amountPaid: 0, amountDue: 1000, amountRefunded: 1000, refundedAt: new Date() }),
      inv("draftpaid", { status: "paid", sentAt: null }),               // paid before it was ever sent
      inv("fam_v1", { status: "paid" }),
      inv("fam_v2", { status: "paid", version: 2, parentInvoiceId: "fam_v1" }),
      { ...inv("foreign1"), companyId: "other", clientId: "client_foreign" },
    ],
    payment: [
      pay("p_cash", "cash1", 1000, "cash", { notes: "test" }),
      pay("p_half1", "half", 500, "e_transfer"),
      pay("p_half2", "half", 500, "cheque"),
      pay("p_stripe", "stripe1", 1000, "stripe", { stripePaymentIntentId: "pi_123", processingFeeCents: 3030, netCents: 96970 }),
      pay("p_mcash", "mixed", 400, "cash"),
      pay("p_mcard", "mixed", 600, "stripe", { stripePaymentIntentId: "pi_456" }),
      // A cash payment someone then "refunded" by hand — both rows are the same mistake.
      pay("p_rcash", "refunded1", 1000, "cash"),
      { ...pay("p_rback", "refunded1", -1000, "cash"), kind: "refund", refundOfPaymentId: "p_rcash", refundReason: "oops" },
      pay("p_draft", "draftpaid", 1000, "zelle"),
      // The money landed on v1 of an amended invoice; the void is asked on v2.
      pay("p_fam", "fam_v1", 1000, "e_transfer"),
      pay("p_foreign", "foreign1", 1000, "cash"),
    ],
    activityLog: [],
    task: [], timeEntry: [], jobPaymentStage: [], changeOrder: [], appointment: [], servicePlanOccurrence: [],
    member: [],
  };
  globalThis.__FQ_WRITES = [];
  globalThis.__FQ_COMMISSION_SYNCS = [];
}

const PEOPLE = {
  owner: { id: "m_owner", userId: "u1", companyId: CO, role: "owner", permissions: null },
  admin: { id: "m_admin", userId: "u2", companyId: CO, role: "admin", permissions: null },
  manager: { id: "m_manager", userId: "u1", companyId: CO, role: "employee", permissions: { ...PERMISSION_PRESETS.manager.values } },
  crew: { id: "m_crew", userId: "u1", companyId: CO, role: "employee", permissions: { ...PERMISSION_PRESETS.worker.values } },
  estimator: { id: "m_est", userId: "u1", companyId: CO, role: "employee", permissions: { ...PERMISSION_PRESETS.estimator.values } },
  // A read-only support session resolves to the OWNER's membership.
  support: { id: "m_owner", userId: "u1", companyId: CO, role: "owner", permissions: null, impersonation: true, impersonationMode: "read_only" },
  foreign: { id: "m_foreign", userId: "u1", companyId: "other", role: "owner", permissions: null },
};

function as(who) {
  const row = PEOPLE[who];
  globalThis.__FQ_ROWS.member = Object.values(PEOPLE).filter((p) => !p.impersonation);
  globalThis.__FQ_SESSION = { ...row };
}
async function voidIt(who, invoiceId, body) {
  as(who);
  const req = { url: `http://local/api/invoices/${invoiceId}/void-payment`, method: "POST", headers: new Map(), json: async () => body };
  const res = await voidRoute.POST(req, { params: Promise.resolve({ id: invoiceId }) });
  return { status: res.status, body: await res.json() };
}
async function del(who, route, id) {
  as(who);
  const req = { url: `http://local/x/${id}`, method: "DELETE", headers: new Map() };
  const res = await route.DELETE(req, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}
const rows = (m) => globalThis.__FQ_ROWS[m];
const invRow = (id) => rows("invoice").find((i) => i.id === id);
const has = (m, id) => rows(m).some((r) => r.id === id);
const REASON = "Test payment — no money was received";

// ═══════════════════════════════════════════════════════════════════════════
// 1. A hand-recorded payment voids, and the ledger recomputes
// ═══════════════════════════════════════════════════════════════════════════
{
  reset();
  const r = await voidIt("owner", "cash1", { paymentId: "p_cash", reason: REASON });
  t("owner voids a cash payment → 200", r.status, 200);
  t("...the payment row is gone", has("payment", "p_cash"), false);
  t("...the invoice is back to sent (it had been sent)", invRow("cash1").status, "sent");
  t("...nothing paid", Number(invRow("cash1").amountPaid), 0);
  t("...the whole total due again", Number(invRow("cash1").amountDue), 1000);
  t("...no paid date left behind", invRow("cash1").paidDate, null);
  t("...the response reports the new state", r.body.invoice?.status === "sent" && r.body.invoice?.amountDue === 1000);
  t("...the commission ledger is resynced for that invoice", globalThis.__FQ_COMMISSION_SYNCS.join(), "cash1");

  reset();
  await voidIt("admin", "half", { paymentId: "p_half1", reason: REASON });
  t("admin voids one of two halves → the other stays", has("payment", "p_half2") && !has("payment", "p_half1"));
  t("...and the invoice is part-paid, not paid", invRow("half").status === "sent" && Number(invRow("half").amountPaid) === 500 && Number(invRow("half").amountDue) === 500);

  reset();
  await voidIt("owner", "draftpaid", { paymentId: "p_draft", reason: REASON });
  t("an invoice never sent goes back to draft, not sent", invRow("draftpaid").status, "draft");

  reset();
  const rr = await voidIt("owner", "refunded1", { paymentId: "p_rcash", reason: REASON });
  t("a hand payment with a hand refund voids → 200", rr.status, 200);
  t("...both rows go — the refund of money never received is the same mistake", !has("payment", "p_rcash") && !has("payment", "p_rback"));
  t("...and the invoice is no longer 'refunded'", invRow("refunded1").status === "sent" && Number(invRow("refunded1").amountRefunded) === 0 && invRow("refunded1").refundedAt === null);

  reset();
  const fam = await voidIt("owner", "fam_v2", { paymentId: "p_fam", reason: REASON });
  t("a payment on v1, voided from v2 → 200", fam.status, 200);
  t("...the LATEST version's ledger is the one recomputed", invRow("fam_v2").status === "sent" && Number(invRow("fam_v2").amountDue) === 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Money the processor moved is never voidable
// ═══════════════════════════════════════════════════════════════════════════
{
  reset();
  const r = await voidIt("owner", "stripe1", { paymentId: "p_stripe", reason: REASON });
  t("a Stripe payment is refused → 409", r.status, 409);
  t("...with the code the page translates", r.body.code, "card_payment");
  t("...and the sentence says refund instead", /Refund it instead/.test(r.body.error));
  t("...the row stays", has("payment", "p_stripe"));
  t("...nothing was written", globalThis.__FQ_WRITES.length, 0);
  t("...no commission resync", globalThis.__FQ_COMMISSION_SYNCS.length, 0);

  reset();
  t("a card payment on a mixed invoice is refused", (await voidIt("owner", "mixed", { paymentId: "p_mcard", reason: REASON })).status, 409);
  reset();
  t("...while the cash beside it voids", (await voidIt("owner", "mixed", { paymentId: "p_mcash", reason: REASON })).status, 200);
  t("...leaving the card money on the ledger", invRow("mixed").status === "sent" && Number(invRow("mixed").amountPaid) === 600);

  // Evidence beyond the method label: a row's method is the one thing a person typed.
  const base = { id: "x", kind: "payment", method: "e_transfer", amount: 10 };
  for (const [label, extra] of [
    ["a payment intent", { stripePaymentIntentId: "pi_x" }],
    ["a processing fee", { processingFeeCents: 30 }],
    ["a net figure", { netCents: 970 }],
    ["a Stripe fee", { stripeFeeCents: 30 }],
    ["a dispute", { disputeStatus: "needs_response" }],
    ["a Stripe-side refund", { refundedAmount: 5 }],
  ]) {
    t(`"e_transfer" carrying ${label} is refused as card money`, voidRefusal({ ...base, ...extra }, [])?.code, "card_payment");
  }
  t("a bare \"stripe\" row with no intent id (an old import) is still card money, said as such",
    voidRefusal({ ...base, method: "stripe" }, [])?.code, "card_payment");
  t("a booking fee credited from a card is refused", voidRefusal({ ...base, method: "visit_credit" }, [])?.code, "visit_credit");
  t("a refund row on its own is refused (void its payment)", voidRefusal({ ...base, kind: "refund" }, [])?.code, "is_refund");
  t("a hand payment with a STRIPE refund against it is refused",
    voidRefusal(base, [{ id: "r", kind: "refund", refundOfPaymentId: "x", stripeRefundId: "re_1", method: "e_transfer" }])?.code, "card_payment");
  t("a plain hand payment is voidable", voidRefusal(base, []), null);
  t("a method nobody classified is not voidable by default", voidRefusal({ ...base, method: "barter" }, [])?.code, "unknown_method");
}

// ═══════════════════════════════════════════════════════════════════════════
// 3–5. Who may, and whose
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const who of ["crew", "estimator", "manager"]) {
    reset();
    const r = await voidIt(who, "cash1", { paymentId: "p_cash", reason: REASON });
    t(`${who} is refused → 403`, r.status, 403);
    t(`...${who}: the row stays and nothing is written`, has("payment", "p_cash") && globalThis.__FQ_WRITES.length === 0);
  }
  reset();
  const sup = await voidIt("support", "cash1", { paymentId: "p_cash", reason: REASON });
  t("a read-only support session is refused → 403, even as the owner's membership", sup.status, 403);
  t("...the row stays and nothing is written", has("payment", "p_cash") && globalThis.__FQ_WRITES.length === 0);

  reset();
  const foreign = await voidIt("foreign", "cash1", { paymentId: "p_cash", reason: REASON });
  t("another company's owner → 404, not 403", foreign.status, 404);
  t("...and the payment stays", has("payment", "p_cash"));
  reset();
  const theirs = await voidIt("owner", "foreign1", { paymentId: "p_foreign", reason: REASON });
  t("this owner on another company's invoice → 404", theirs.status, 404);
  reset();
  const wrongInvoice = await voidIt("owner", "cash1", { paymentId: "p_half1", reason: REASON });
  t("a payment that is not on this invoice → 404", wrongInvoice.status, 404);
  t("...and it stays where it is", has("payment", "p_half1"));
  reset();
  const crossTenant = await voidIt("owner", "cash1", { paymentId: "p_foreign", reason: REASON });
  t("another company's payment id through this invoice → 404", crossTenant.status, 404);
  t("...untouched", has("payment", "p_foreign"));

  reset();
  for (const reason of ["", "   ", null, undefined]) {
    const r = await voidIt("owner", "cash1", { paymentId: "p_cash", reason });
    t(`no reason (${JSON.stringify(reason)}) → 400`, r.status, 400);
  }
  t("...and nothing was written for any of them", has("payment", "p_cash") && globalThis.__FQ_WRITES.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. The audit row
// ═══════════════════════════════════════════════════════════════════════════
{
  reset();
  await voidIt("admin", "cash1", { paymentId: "p_cash", reason: `  ${REASON}  ` });
  const a = rows("activityLog").find((x) => x.action === "payment.voided");
  t("an audit row is written", Boolean(a));
  t("...who: the member and the user", a?.actorMemberId === "m_admin" && a?.actorUserId === "u2");
  t("...by name, stored at write time", a?.actorName, "Ari Admin");
  t("...in their role", a?.actorRole, "admin");
  t("...when", a?.createdAt instanceof Date);
  t("...the amount", a?.metadata?.amount, 1000);
  t("...the method", a?.metadata?.method, "cash");
  t("...the reason, trimmed", a?.metadata?.reason, REASON);
  t("...the payment's own date and note", a?.metadata?.date?.startsWith("2026-09-21") && a?.metadata?.notes === "test");
  t("...against the invoice", a?.entityType === "invoice" && a?.entityId === "cash1");
  t("...in this company", a?.companyId, CO);
  t("...renderable in the reader's language", a?.metadata?.i18n?.key, "app.activity.event.paymentVoided");
  t("...never marked as an impersonated write", a?.viaImpersonation, false);

  // Atomic: if the audit row cannot be written, the payment comes back.
  reset();
  const realCreate = globalThis.__FQ_DB.activityLog.create;
  globalThis.__FQ_DB.activityLog.create = async () => { throw new Error("log down"); };
  let threw = false;
  try {
    await voidIt("owner", "cash1", { paymentId: "p_cash", reason: REASON });
  } catch {
    threw = true;
  }
  globalThis.__FQ_DB.activityLog.create = realCreate;
  t("a failed audit write fails the void", threw);
  t("...and the payment is still on the invoice (one transaction)", has("payment", "p_cash"));
  t("...which is still paid", invRow("cash1").status, "paid");
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Delete works after the void; the refusals say what to do
// ═══════════════════════════════════════════════════════════════════════════
{
  reset();
  const before = await del("owner", invoiceRoute, "cash1");
  t("deleting an invoice with a hand payment is still refused → 409", before.status, 409);
  t("...with the code the page turns into 'void it under Payment History'", before.body.code, "hand_recorded_payment");
  t("...and the English sentence names the void", /void it under Payment History/.test(before.body.error));
  await voidIt("owner", "cash1", { paymentId: "p_cash", reason: REASON });
  const after = await del("owner", invoiceRoute, "cash1");
  t("after the void, the invoice deletes → 200", after.status, 200);
  t("...and is gone", has("invoice", "cash1"), false);

  reset();
  const card = await del("owner", invoiceRoute, "stripe1");
  t("an invoice with card money is refused as before → 409", card.status, 409);
  t("...as a record of money, refund the only way out", card.body.code === "money_recorded" && /refund it instead/.test(card.body.error));
  reset();
  const mixed = await del("owner", invoiceRoute, "mixed");
  t("an invoice with card AND cash money says refund, not void", mixed.body.code, "money_recorded");

  // The client, once its invoice is gone.
  reset();
  const blocked = await del("owner", clientRoute, "client_test");
  t("a client with invoices is refused → 409", blocked.status, 409);
  t("...naming what is in the way", blocked.body.code === "client_has_records" && blocked.body.counts.invoices > 0);
  t("...and the order to clear it", /invoices first, then jobs, then quotes/.test(blocked.body.error));
  rows("invoice").splice(0, rows("invoice").length, ...rows("invoice").filter((i) => i.clientId !== "client_test"));
  globalThis.__FQ_ROWS.job = [{ id: "j1", companyId: CO, clientId: "client_test" }];
  const jobOnly = await del("owner", clientRoute, "client_test");
  t("a client with only a job is refused in words, not a foreign-key 500", jobOnly.status === 409 && jobOnly.body.counts.jobs === 1);
  globalThis.__FQ_ROWS.job = [];
  const ok = await del("owner", clientRoute, "client_test");
  t("with nothing left, the client deletes → 200", ok.status, 200);

  // The test job: a task on it says how to clear it, not only "cancel".
  reset();
  globalThis.__FQ_ROWS.job = [{ id: "job_test", companyId: CO, clientId: "client_test", title: "Test job", quoteId: null }];
  globalThis.__FQ_ROWS.task = [{ id: "t1", jobId: "job_test", status: "open" }];
  globalThis.__FQ_ROWS.timeEntry = [{ id: "te1", jobId: "job_test", status: "approved" }];
  const job = await del("owner", jobRoute, "job_test");
  t("a job with a task and a time entry is refused → 409", job.status, 409);
  t("...naming both ways out: cancel if real, clear if a test", /Set it to Cancelled instead/.test(job.body.error) && /If it was only a test, first delete its task from To-do and delete its time entry from Timesheets/.test(job.body.error));
  t("...with the counts", job.body.code === "job_has_records" && job.body.counts.tasks === 1 && job.body.counts.timeEntries === 1);
  globalThis.__FQ_ROWS.task = [];
  globalThis.__FQ_ROWS.timeEntry = [];
  const jobOk = await del("owner", jobRoute, "job_test");
  t("cleared, the test job deletes → 200", jobOk.status, 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Every method classified; the page, the strings and the help are wired
// ═══════════════════════════════════════════════════════════════════════════
{
  const schema = read("prisma/schema.prisma");
  const block = schema.split("enum PaymentMethod {")[1].split("}")[0];
  const values = block.split("\n").map((l) => l.replace(/\/\/.*$/, "").trim()).filter(Boolean);
  t("the schema has payment methods to classify", values.length >= 10);
  for (const v of values) t(`PaymentMethod "${v}" is classified for voiding`, Object.hasOwn(PAYMENT_METHOD_VOIDABLE, v));
  t("stripe is never voidable", PAYMENT_METHOD_VOIDABLE.stripe, false);
  t("visit_credit is never voidable", PAYMENT_METHOD_VOIDABLE.visit_credit, false);

  const PAGE = read("app/app/invoices/[id]/page.js");
  t("the page draws Void only for owner/admin", /const canVoid = caller\?\.role === "owner" \|\| caller\?\.role === "admin"/.test(PAGE));
  t("...only on a row voidRefusal allows", /canVoid &&[\s\S]{0,80}voidRefusal\(p, invoice\.payments\) === null/.test(PAGE));
  t("...says card payments are refunded instead", /app\.invoiceDetail\.voidCardHint/.test(PAGE));
  t("...and turns the delete refusal into the translated void-first sentence", /code === "hand_recorded_payment"[\s\S]{0,200}app\.invoiceDetail\.deleteVoidFirst/.test(PAGE));
  const DIALOG = read("app/app/invoices/[id]/VoidPaymentDialog.js");
  t("the dialog posts to the void route", /\/api\/invoices\/\$\{invoiceId\}\/void-payment/.test(DIALOG));
  t("...asks for a reason", /required/.test(DIALOG) && /voidReason/.test(DIALOG));
  t("...and says card payments can't be voided", /voidCardNote/.test(DIALOG));
  const CLIENT = read("app/app/clients/[id]/page.js");
  t("the client page has a delete control, gated on full_edit_delete", /useHasLevel\("clientsProperties", "full_edit_delete"\)/.test(CLIENT) && /method: "DELETE"/.test(CLIENT));

  const MSGS = read("app/i18n/appMessages.js");
  for (const key of [
    "app.invoiceDetail.voidAction", "app.invoiceDetail.voidTitle", "app.invoiceDetail.voidIntro", "app.invoiceDetail.voidReason",
    "app.invoiceDetail.voidAfter", "app.invoiceDetail.voidCardNote", "app.invoiceDetail.voidConfirm", "app.invoiceDetail.voidCardHint",
    "app.invoiceDetail.deleteVoidFirst", "app.invoiceDetail.voidRefused.card_payment", "app.clientDetail.deleteTitle",
    "app.clientDetail.deleteBlocked", "app.activity.event.paymentVoided",
  ]) {
    t(`${key} in all nine languages`, (MSGS.match(new RegExp(`"${key.replace(/\./g, "\\.")}":`, "g")) || []).length, 9);
  }
  for (const lang of ["en", "fr", "es"]) {
    const help = read(`content/help/${lang}/invoices-and-payments-2.js`);
    t(`help (${lang}) explains voiding a hand-recorded payment`, /id: "void-a-payment"/.test(help));
  }
}

console.log(`check-void-manual-payment: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
