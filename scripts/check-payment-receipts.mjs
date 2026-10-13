// scripts/check-payment-receipts.mjs
//
//   npm run check:payment-receipts
//
// The client's receipt for each payment (owner, 2026-10-12): lib/payments/
// sendReceipt.js, receiptEmail.js, receiptState.js; POST /api/payments (the
// "Email a receipt" box), lib/invoices/recordStripePayment.js (Stripe), POST
// /api/payments/[id]/receipt (Send / Resend), the retry cron's pass.
//
// ══ Why the REAL handlers run ══════════════════════════════════════════════
//
// "Exactly one email per payment", "a double press sends once", "the retry
// stops after five" are claims about a conditional update, a transaction and
// a ledger — not about a line of source. So the routes and the sender are
// imported and called against a scripted database, with the mail provider
// swapped for a recorder. Nothing here can reach Resend: "@/lib/email/resend"
// is replaced before anything imports it, and every send lands in SENT.
//
//   1. Record payment with the box on → one receipt; off → none; no box →
//      the company setting decides
//   2. Maureen's shape: 8,927 total, 2,500 then 3,000 → two separate emails,
//      paid 2,500 / balance 6,427, then paid 5,500 / balance 3,427 — the
//      second figures checked against computeInvoiceState, and a resend of
//      the FIRST still states its own moment
//   3. Stripe: one receipt; replay sends none; setting off sends none; a
//      caller that sends its own (service plans) sends none
//   4. a failed send is retried by the cron after the backoff and succeeds
//      once; one nobody ever tried is never picked up; five failures stop
//   5. a double press sends once; a resend needs `resend` and is refused
//      inside a minute
//   6. a refund sends none; no email is an honest state, not "sent"
//   7. French and Punjabi clients get their language; the client's language
//      beats the invoice's
//   8. another company's payment is refused, and nothing is written
//   9. the job's and the client's email history list each receipt
//  10. no "FieldQuo" in what the client reads; contrast ≥ 4.5:1 on hostile
//      brand colours
//  11. the copy is complete in every client language; the wiring is there
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let fail = 0;
let pass = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  FAIL ${name}${detail ? `  — ${detail}` : ""}`);
  }
};
const eq = (name, got, want) => ok(name, String(got) === String(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// ═══════════════════════════════════════════════════════════════════════════
// The scripted database
// ═══════════════════════════════════════════════════════════════════════════

globalThis.__FQ_ROWS = {};
globalThis.__FQ_WRITES = [];
globalThis.__SENT = [];
globalThis.__SEND_PLAN = []; // queued answers for the next sends; empty = success

const RELATIONS = {
  payment: { invoice: { table: "invoice", key: "invoiceId" } },
  invoice: { company: { table: "company", key: "companyId" }, client: { table: "client", key: "clientId" } },
};
const rowsOf = (name) => (globalThis.__FQ_ROWS[name] ||= []);
const isDate = (v) => v instanceof Date;
const cmp = (a, b) => (isDate(a) || isDate(b) ? new Date(a).getTime() - new Date(b).getTime() : a < b ? -1 : a > b ? 1 : 0);
const same = (a, b) => (isDate(a) || isDate(b) ? a != null && b != null && new Date(a).getTime() === new Date(b).getTime() : a === b);

function matchWhere(model, row, where) {
  if (!where) return true;
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") {
      if (!(Array.isArray(cond) ? cond : [cond]).every((c) => matchWhere(model, row, c))) return false;
      continue;
    }
    if (key === "OR") {
      if (!(Array.isArray(cond) ? cond : [cond]).some((c) => matchWhere(model, row, c))) return false;
      continue;
    }
    const rel = RELATIONS[model]?.[key];
    if (rel) {
      const target = rowsOf(rel.table).find((r) => r.id === row[rel.key]);
      if (!matchWhere(rel.table, target, cond)) return false;
      continue;
    }
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !isDate(cond)) {
      if ("in" in cond && !cond.in.includes(value)) return false;
      if ("not" in cond && (cond.not === null ? value == null : same(value, cond.not))) return false;
      if ("lt" in cond && !(value != null && cmp(value, cond.lt) < 0)) return false;
      if ("lte" in cond && !(value != null && cmp(value, cond.lte) <= 0)) return false;
      if ("gt" in cond && !(value != null && cmp(value, cond.gt) > 0)) return false;
      if ("gte" in cond && !(value != null && cmp(value, cond.gte) >= 0)) return false;
      continue;
    }
    if (!same(value, cond)) return false;
  }
  return true;
}

function project(model, row, spec = {}) {
  if (!row) return row;
  const pick = spec.select || null;
  const inc = spec.include || null;
  const out = pick ? {} : { ...row };
  for (const [key, sub] of Object.entries(pick || inc || {})) {
    if (!sub) continue;
    const rel = RELATIONS[model]?.[key];
    if (rel) {
      const target = rowsOf(rel.table).find((r) => r.id === row[rel.key]) || null;
      out[key] = sub === true ? (target ? { ...target } : null) : project(rel.table, target, sub);
    } else if (sub === true) out[key] = row[key];
  }
  return out;
}

function stubModel(name) {
  const all = () => rowsOf(name);
  const note = (op, args) => globalThis.__FQ_WRITES.push({ model: name, op, args });
  const order = (rows, orderBy) => {
    const list = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    return [...rows].sort((a, b) => {
      for (const o of list) {
        const [k, dir] = Object.entries(o)[0];
        const c = cmp(a[k] ?? 0, b[k] ?? 0);
        if (c) return dir === "desc" ? -c : c;
      }
      return 0;
    });
  };
  return {
    async findMany(args = {}) {
      const hits = order(all().filter((r) => matchWhere(name, r, args.where)), args.orderBy);
      return hits.slice(0, args.take ?? hits.length).map((r) => project(name, r, args));
    },
    async findFirst(args = {}) {
      const hit = order(all().filter((r) => matchWhere(name, r, args.where)), args.orderBy)[0];
      return hit ? project(name, hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(name, r, args.where));
      return hit ? project(name, hit, args) : null;
    },
    async count(args = {}) {
      return all().filter((r) => matchWhere(name, r, args.where)).length;
    },
    async create(args = {}) {
      note("create", args);
      const row = { id: `${name}_${all().length + 1}`, createdAt: new Date(), ...(DEFAULTS[name] || {}), ...args.data };
      all().push(row);
      return { ...row };
    },
    async update(args = {}) {
      note("update", args);
      const hit = all().find((r) => matchWhere(name, r, args.where));
      if (!hit) throw new Error(`dbStub: ${name}.update matched nothing`);
      Object.assign(hit, args.data);
      return { ...hit };
    },
    async updateMany(args = {}) {
      note("updateMany", args);
      const hits = all().filter((r) => matchWhere(name, r, args.where));
      for (const h of hits) Object.assign(h, args.data);
      return { count: hits.length };
    },
  };
}

const DEFAULTS = {
  payment: { kind: "payment", refundOfPaymentId: null, refundedAmount: 0, disputeStatus: null, receiptAttempts: 0, receiptSentAt: null, receiptClaimedAt: null, receiptFirstAttemptAt: null, receiptLastAttemptAt: null, receiptLastError: null, receiptSentTo: null, receiptSentEmailId: null, stripePaymentIntentId: null, feeRateLabel: null },
};

const MODELS = ["member", "user", "company", "client", "invoice", "payment", "job", "quote", "sentEmail", "activityLog", "changeOrder"];
const stubDb = Object.fromEntries(MODELS.map((m) => [m, stubModel(m)]));
stubDb.$transaction = async (fn) => {
  const snapshot = structuredClone(globalThis.__FQ_ROWS);
  try {
    return await fn(globalThis.__FQ_DB);
  } catch (err) {
    globalThis.__FQ_ROWS = snapshot;
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

// The mail provider. Records every send; answers with the next queued answer
// (an { error } to simulate a failure), else a Resend-shaped success.
globalThis.__FQ_SEND = async (msg) => {
  globalThis.__SENT.push(msg);
  const planned = globalThis.__SEND_PLAN.shift();
  if (planned) return planned;
  return { id: `re_${globalThis.__SENT.length}` };
};

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "@/lib/email/resend": "fq-stub:resend",
  "@/lib/email/companySender": "fq-stub:sender",
  "@/lib/commissions/hook": "fq-stub:noop-commissions",
  "@/lib/analytics/product/server": "fq-stub:noop-analytics",
  "@/lib/agency/nudge": "fq-stub:noop-agency",
  "@/lib/tasks/autoCreate": "fq-stub:noop-tasks",
  "@/lib/activity/log": "fq-stub:noop-activity",
  "@/lib/notifications/invoicePaymentNotice": "fq-stub:noop-notice",
  "@/lib/notifications/notify": "fq-stub:noop-notify",
  "@/lib/signup/planGate": "fq-stub:plan",
  "next/server": "fq-stub:next",
};
const SOURCES = {
  "fq-stub:db": "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
  "fq-stub:member": "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);",
  "fq-stub:resend": "export const SENDER_SELECT = { name: true, email: true, emailDomain: true, emailDomainStatus: true, emailFromLocal: true }; export async function sendEmail(m) { return globalThis.__FQ_SEND(m); }",
  "fq-stub:sender": "export async function resolveSender(c) { return { from: (c && c.name ? c.name : 'Co') + ' <billing@contractor.example>', replyTo: 'owner@contractor.example' }; }",
  "fq-stub:noop-commissions": "export async function syncCommissionsForInvoice() { return {}; }",
  "fq-stub:noop-analytics": "export async function recordFeatureUse() {}",
  "fq-stub:noop-agency": "export function nudgeAgencyEvents() {}",
  "fq-stub:noop-tasks": "export async function resolveInvoiceChaseTask() {}",
  "fq-stub:noop-activity": "export async function recordActivity() {}",
  "fq-stub:noop-notice": "export async function notifyInvoicePayment() {}",
  "fq-stub:noop-notify": "export async function notifyEvent() {}",
  "fq-stub:plan": "export async function planOrRefusal() { return {}; }",
  "fq-stub:next": "export class NextResponse { constructor(body, init) { this.body = body; this.status = init?.status ?? 200; } static json(body, init) { const r = new NextResponse(body, init); r.json = async () => body; return r; } }",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (SOURCES[url]) return { format: "module", shortCircuit: true, source: SOURCES[url] };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

process.env.NEXT_PUBLIC_APP_URL = "https://portal.example";

const paymentsRoute = await import("@/app/api/payments/route.js");
const receiptRoute = await import("@/app/api/payments/[id]/receipt/route.js");
const { recordStripePayment } = await import("@/lib/invoices/recordStripePayment.js");
const { sendPaymentReceipt, retryFailedReceipts } = await import("@/lib/payments/sendReceipt.js");
const { receiptStatus, RECEIPT_MAX_ATTEMPTS } = await import("@/lib/payments/receiptState.js");
const { buildReceiptEmail, receiptFigures } = await import("@/lib/payments/receiptEmail.js");
const { computeInvoiceState } = await import("@/lib/invoices/computeInvoiceState.js");
const { loadEmailHistory } = await import("@/lib/email/sentEmailHistory.js");
const { sentEmailEntry } = await import("@/lib/conversations/clientTimeline.js");
const { RECEIPT_EMAIL_COPY } = await import("@/lib/i18n/receiptEmailCopy.js");
const { LANGUAGES } = await import("@/app/i18n/languages.js");
const { resolveReceiptLanguage } = await import("@/lib/i18n/clientLanguage.js");
const { documentTheme, fillPair } = await import("@/lib/documents/theme.js");
const { contrastRatio, ensureContrast } = await import("@/lib/brand/colour.js");

const db = globalThis.__FQ_DB;

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures — Maureen's shape, plus a French, a Punjabi and an address-less client
// ═══════════════════════════════════════════════════════════════════════════

const CO = "co_tf";
function reset({ receipts = true } = {}) {
  globalThis.__FQ_ROWS = {
    company: [
      { id: CO, name: "TrueFinish Cabinets", email: "office@truefinish.example", phone: "613-555-0100", website: null, currency: "CAD", brandColor: "#1f4e79", logoUrl: null, defaultLanguage: "en", emailPaymentReceipts: receipts, taxIdName: "HST", taxIdNumber: "123456789RT0001", emailDomain: null, emailDomainStatus: null, emailFromLocal: null },
      { id: "co_other", name: "Other Co", currency: "CAD", brandColor: "#ff0000", defaultLanguage: "en", emailPaymentReceipts: true },
    ],
    user: [{ id: "u1", name: "Emilio Owner", email: "e@x.example" }],
    member: [
      { id: "m_owner", userId: "u1", companyId: CO, role: "owner", permissions: null },
      { id: "m_other", userId: "u1", companyId: "co_other", role: "owner", permissions: null },
    ],
    client: [
      { id: "cl_maureen", companyId: CO, name: "Maureen Faulkner", email: "maureen@client.example", language: null, portalToken: "tok_m" },
      { id: "cl_fr", companyId: CO, name: "Jean Tremblay", email: "jean@client.example", language: "fr", portalToken: "tok_fr" },
      { id: "cl_pa", companyId: CO, name: "Harpreet Singh", email: "harpreet@client.example", language: "pa", portalToken: "tok_pa" },
      { id: "cl_none", companyId: CO, name: "No Mail", email: "", language: null, portalToken: "tok_n" },
      { id: "cl_foreign", companyId: "co_other", name: "Foreign", email: "f@client.example", language: null, portalToken: "tok_x" },
    ],
    quote: [{ id: "q_m", companyId: CO, clientId: "cl_maureen", quoteNumber: "Q-2026-0040" }],
    job: [{ id: "j_m", companyId: CO, clientId: "cl_maureen", quoteId: "q_m", createdAt: new Date("2026-09-01") }],
    invoice: [
      inv("inv_m", "cl_maureen", 8927, { invoiceNumber: "INV-2026-0022", quoteId: "q_m" }),
      inv("inv_fr", "cl_fr", 1000, { language: "en" }),
      inv("inv_pa", "cl_pa", 1000),
      inv("inv_none", "cl_none", 1000),
      inv("inv_hist", "cl_maureen", 1000, { historicalImportedAt: new Date("2026-09-01") }),
      { ...inv("inv_foreign", "cl_foreign", 1000), companyId: "co_other" },
    ],
    payment: [],
    sentEmail: [],
    activityLog: [],
    changeOrder: [],
  };
  globalThis.__FQ_WRITES = [];
  globalThis.__SENT = [];
  globalThis.__SEND_PLAN = [];
}
function inv(id, clientId, total, extra = {}) {
  return {
    id, companyId: CO, clientId, invoiceNumber: `INV-${id}`, total, status: "sent", version: 1, parentInvoiceId: null,
    amountPaid: 0, amountDue: total, amountRefunded: 0, paidDate: null, language: "en", jobId: null, quoteId: null,
    historicalImportedAt: null, createdAt: new Date("2026-10-01"), ...extra,
  };
}
const as = (memberId) => {
  globalThis.__FQ_SESSION = { ...rowsOf("member").find((m) => m.id === memberId) };
};
const req = (body) => ({ json: async () => body, headers: new Map(), url: "https://portal.example/api/payments" });
const visible = (html) =>
  html
    .replace(/<head>[\s\S]*?<\/head>/i, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ");
const pay = (id) => rowsOf("payment").find((p) => p.id === id);
const sleepTick = () => new Promise((r) => setTimeout(r, 2));

// ═══════════════════════════════════════════════════════════════════════════
// 1–2. Record payment: the box, and Maureen's two e-transfers
// ═══════════════════════════════════════════════════════════════════════════
reset();
as("m_owner");
{
  const r1 = await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 2500, method: "e_transfer", sendReceipt: true }));
  eq("1. box on: payment recorded (201)", r1.status, 201);
  eq("1. box on: exactly one email", globalThis.__SENT.length, 1);
  eq("1. box on: to the client", globalThis.__SENT[0]?.to, "maureen@client.example");
  eq("1. box on: the response says it was sent", r1.body.receipt?.sent, true);
  const p1 = pay(r1.body.id);
  ok("1. the payment row records the send", p1?.receiptSentAt && p1.receiptSentTo === "maureen@client.example" && p1.receiptAttempts === 1 && !p1.receiptClaimedAt);
  const t1 = globalThis.__SENT[0]?.text || "";
  ok("2. first receipt: amount 2,500", /\$2,500\.00/.test(t1), t1);
  ok("2. first receipt: paid so far 2,500", /Total paid so far: \$2,500\.00/.test(t1), t1);
  ok("2. first receipt: balance 6,427", /Balance remaining: \$6,427\.00/.test(t1), t1);
  ok("2. first receipt: method is the translated label", /Payment method: Interac e-Transfer/.test(t1), t1);
  ok("2. first receipt: invoice number", /INV-2026-0022/.test(globalThis.__SENT[0].subject), globalThis.__SENT[0].subject);
  ok("2. first receipt: a portal link to the invoice", t1.includes("https://portal.example/portal/tok_m/invoices/inv_m"), t1);

  await sleepTick();
  const r2 = await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 3000, method: "e_transfer", notes: "October 12", sendReceipt: true }));
  eq("2. second payment recorded", r2.status, 201);
  eq("2. two payments → two separate emails", globalThis.__SENT.length, 2);
  const t2 = globalThis.__SENT[1]?.text || "";
  ok("2. second receipt: amount 3,000", /Payment received: \$3,000\.00/.test(t2), t2);
  ok("2. second receipt: paid so far 5,500", /Total paid so far: \$5,500\.00/.test(t2), t2);
  ok("2. second receipt: balance 3,427", /Balance remaining: \$3,427\.00/.test(t2), t2);
  ok("2. the second email does not restate the first payment as its own", !/Payment received: \$2,500/.test(t2));
  ok("2. staff notes never reach the client", !t2.includes("October 12"));
  // Against the product's own balance maths, not this note.
  const ledger = computeInvoiceState({ total: 8927, payments: rowsOf("payment"), priorStatus: "sent" });
  eq("2. computeInvoiceState agrees: paid", ledger.amountPaid, 5500);
  eq("2. computeInvoiceState agrees: due", ledger.amountDue, 3427);
  eq("2. the invoice cache says the same", rowsOf("invoice").find((i) => i.id === "inv_m").amountDue, 3427);
  eq("2. two SentEmail rows of kind receipt", rowsOf("sentEmail").filter((s) => s.kind === "receipt").length, 2);
  const se = rowsOf("sentEmail")[0];
  ok("2. kept with invoice, client and the job (found through the quote)", se.invoiceId === "inv_m" && se.clientId === "cl_maureen" && se.jobId === "j_m" && se.quoteId === "q_m", JSON.stringify(se));
  ok("2. an activity row per send, marked as a kept send", rowsOf("activityLog").filter((a) => a.action === "payment.receipt_sent" && a.metadata?.sentEmailId).length === 2);

  // A resend of the FIRST receipt, after the second payment: still its own moment.
  const firstId = r1.body.id;
  pay(firstId).receiptSentAt = new Date(Date.now() - 5 * 60_000);
  const again = await sendPaymentReceipt(db, { companyId: CO, paymentId: firstId, trigger: "manual", resend: true });
  eq("2. resend of the first receipt sends", again.sent, true);
  const t3 = globalThis.__SENT[2]?.text || "";
  ok("2. …and still says paid 2,500 / balance 6,427", /Total paid so far: \$2,500\.00/.test(t3) && /Balance remaining: \$6,427\.00/.test(t3), t3);
}

// Box off, and no box at all
reset();
as("m_owner");
{
  const r = await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 100, method: "cash", sendReceipt: false }));
  eq("1. box off: recorded", r.status, 201);
  eq("1. box off: no email", globalThis.__SENT.length, 0);
  eq("1. box off: nothing attempted (the cron will never pick it up)", pay(r.body.id).receiptAttempts, 0);
  eq("1. box off: the row reads Not sent", receiptStatus(pay(r.body.id)).state, "not_sent");
  eq("1. box off: the response carries no receipt", r.body.receipt, null);
  await sleepTick();
  const r2 = await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 101, method: "cash" }));
  eq("1. no box + setting ON → sends", globalThis.__SENT.length, 1);
  eq("1. no box + setting ON → response says sent", r2.body.receipt?.sent, true);
}
reset({ receipts: false });
as("m_owner");
{
  await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 100, method: "cash" }));
  eq("1. no box + setting OFF → none", globalThis.__SENT.length, 0);
  await sleepTick();
  await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 102, method: "cash", sendReceipt: true }));
  eq("1. setting OFF but the box ticked by hand → sends", globalThis.__SENT.length, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Stripe
// ═══════════════════════════════════════════════════════════════════════════
const quiet = { notify: async () => {}, notifyEvent: async () => {} };
reset();
{
  const r = await recordStripePayment(db, { invoiceId: "inv_m", paymentIntentId: "pi_1", amountCents: 150000, fee: { processingFeeCents: 4380, netCents: 145620, feeRateLabel: "klarna" } }, quiet);
  eq("3. Stripe payment recorded", r.recorded, true);
  eq("3. Stripe: one receipt", globalThis.__SENT.length, 1);
  eq("3. Stripe: reported", r.receiptSent, true);
  ok("3. Stripe: method named from the intent (Klarna)", /Payment method: Klarna/.test(globalThis.__SENT[0]?.text || ""), globalThis.__SENT[0]?.text);
  const replay = await recordStripePayment(db, { invoiceId: "inv_m", paymentIntentId: "pi_1", amountCents: 150000 }, quiet);
  eq("3. a replayed delivery records nothing", replay.recorded, false);
  eq("3. …and sends nothing", globalThis.__SENT.length, 1);
  await recordStripePayment(db, { invoiceId: "inv_m", paymentIntentId: "pi_2", amountCents: 1000, clientReceipt: false }, quiet);
  eq("3. a caller that sends its own receipt (service plans) → none", globalThis.__SENT.length, 1);
  await recordStripePayment(db, { invoiceId: "inv_m", paymentIntentId: "pi_card", amountCents: 1000, selectedPaymentMethod: "card" }, quiet);
  ok("3. a card payment says Card", /Payment method: Card/.test(globalThis.__SENT[1]?.text || ""), globalThis.__SENT[1]?.text);
}
reset({ receipts: false });
{
  await recordStripePayment(db, { invoiceId: "inv_m", paymentIntentId: "pi_3", amountCents: 1000 }, quiet);
  eq("3. setting OFF → Stripe sends none", globalThis.__SENT.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Failure, retry, backoff, the cap — and the payments nobody tried
// ═══════════════════════════════════════════════════════════════════════════
reset();
as("m_owner");
{
  globalThis.__SEND_PLAN.push({ error: { message: "rate limited" } });
  const r = await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 2500, method: "e_transfer", sendReceipt: true }));
  eq("4. a failed send never fails the payment", r.status, 201);
  eq("4. the response says it did not send", r.body.receipt?.sent, false);
  const p = pay(r.body.id);
  ok("4. the failure is on the row", p.receiptAttempts === 1 && !p.receiptSentAt && /rate limited/.test(p.receiptLastError || "") && !p.receiptClaimedAt, JSON.stringify(p));
  eq("4. the row reads Retrying", receiptStatus(p).state, "retrying");

  // A payment recorded before receipts existed: attempts 0. Never automatic.
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_old", invoiceId: "inv_m", amount: 1, method: "cash", date: new Date("2026-10-11"), createdAt: new Date("2026-10-11T03:25:00Z") });

  const t0 = new Date(p.receiptLastAttemptAt);
  let tally = await retryFailedReceipts(db, { now: new Date(t0.getTime() + 60_000) });
  eq("4. inside the backoff: nothing sent", globalThis.__SENT.length, 1);
  tally = await retryFailedReceipts(db, { now: new Date(t0.getTime() + 31 * 60_000) });
  eq("4. after the backoff: retried once and sent", tally.sent, 1);
  eq("4. two calls to the provider in all (the failure, the success)", globalThis.__SENT.length, 2);
  ok("4. the row reads Sent", receiptStatus(pay(r.body.id)).state === "sent" && pay(r.body.id).receiptLastError === null);
  tally = await retryFailedReceipts(db, { now: new Date(t0.getTime() + 5 * 3_600_000) });
  eq("4. a sent receipt is never retried", globalThis.__SENT.length, 2);
  eq("4. the payment nobody tried was never sent", pay("p_old").receiptAttempts, 0);
  eq("4. …and the cron did not count it", tally.considered, 0);

  // Always failing: five attempts, then it stops and says Failed.
  for (let i = 0; i < 20; i++) globalThis.__SEND_PLAN.push({ error: { message: "down" } });
  await sleepTick();
  const r2 = await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 10, method: "cash", sendReceipt: true }));
  const start = new Date(pay(r2.body.id).receiptLastAttemptAt).getTime();
  const before = globalThis.__SENT.length;
  for (let h = 1; h <= 60; h++) await retryFailedReceipts(db, { now: new Date(start + h * 3_600_000) });
  eq(`4. a receipt that keeps failing is attempted ${RECEIPT_MAX_ATTEMPTS} times in all`, pay(r2.body.id).receiptAttempts, RECEIPT_MAX_ATTEMPTS);
  eq("4. …four of them by the cron", globalThis.__SENT.length - before, RECEIPT_MAX_ATTEMPTS - 1);
  ok("4. …all inside 48 hours", new Date(pay(r2.body.id).receiptLastAttemptAt).getTime() - start <= 48 * 3_600_000);
  eq("4. …and then reads Failed", receiptStatus(pay(r2.body.id)).state, "failed");
  globalThis.__SEND_PLAN.length = 0;
  // Outside the 48-hour window (the cron was down for two days): never
  // retried, and the row says Failed rather than promising a retry.
  const nowT = Date.now();
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_stale", invoiceId: "inv_m", amount: 5, method: "cash", createdAt: new Date(nowT - 50 * 3_600_000), receiptAttempts: 2, receiptFirstAttemptAt: new Date(nowT - 50 * 3_600_000), receiptLastAttemptAt: new Date(nowT - 47 * 3_600_000), receiptLastError: "send_failed: down" });
  const sentBefore = globalThis.__SENT.length;
  await retryFailedReceipts(db, { now: new Date(nowT) });
  eq("4. past the 48-hour window: not retried", globalThis.__SENT.length, sentBefore);
  eq("4. …and reads Failed", receiptStatus(pay("p_stale"), new Date(nowT)).state, "failed");
  // A person can still send it.
  const manual = await sendPaymentReceipt(db, { companyId: CO, paymentId: r2.body.id, trigger: "manual" });
  eq("4. Send receipt still works after the cron gave up", manual.sent, true);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Double press, resend
// ═══════════════════════════════════════════════════════════════════════════
reset();
as("m_owner");
{
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_m1", invoiceId: "inv_m", amount: 2500, method: "e_transfer", date: new Date("2026-10-11T03:25:00Z"), createdAt: new Date("2026-10-11T03:25:00Z") });
  const [a, b] = await Promise.all([
    receiptRoute.POST(req({}), { params: Promise.resolve({ id: "p_m1" }) }),
    receiptRoute.POST(req({}), { params: Promise.resolve({ id: "p_m1" }) }),
  ]);
  eq("5. two simultaneous presses send ONE email", globalThis.__SENT.length, 1);
  ok("5. …one says sent, the other says why not", [a.body, b.body].filter((x) => x.sent === true).length === 1, JSON.stringify([a.body, b.body]));
  ok("5. …the loser lost the CLAIM (both had read the row before either wrote)", [a.body, b.body].some((x) => x.code === "in_flight"), JSON.stringify([a.body, b.body]));
  // A live claim held by another sender: refused, nothing sent.
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_busy", invoiceId: "inv_m", amount: 10, method: "cash", createdAt: new Date(), receiptAttempts: 1, receiptClaimedAt: new Date() });
  const busy = await sendPaymentReceipt(db, { companyId: CO, paymentId: "p_busy", trigger: "retry" });
  eq("5. a receipt another sender is sending right now is not sent twice", busy.reason, "in_flight");
  eq("5. …no email", globalThis.__SENT.length, 1);
  eq("5. the row reads Sending", receiptStatus(pay("p_busy")).state, "sending");
  const c = await receiptRoute.POST(req({}), { params: Promise.resolve({ id: "p_m1" }) });
  eq("5. a later plain press sends nothing more", globalThis.__SENT.length, 1);
  eq("5. …and says it was already sent", c.body.alreadySent, true);
  const d = await receiptRoute.POST(req({ resend: true }), { params: Promise.resolve({ id: "p_m1" }) });
  eq("5. a resend inside a minute is refused", d.status, 409);
  eq("5. …and sends nothing", globalThis.__SENT.length, 1);
  pay("p_m1").receiptSentAt = new Date(Date.now() - 5 * 60_000);
  const e = await receiptRoute.POST(req({ resend: true }), { params: Promise.resolve({ id: "p_m1" }) });
  eq("5. a confirmed resend later sends again", e.body.sent, true);
  eq("5. …exactly one more", globalThis.__SENT.length, 2);
  eq("5. each send is kept", rowsOf("sentEmail").length, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Refunds, no email, past jobs
// ═══════════════════════════════════════════════════════════════════════════
reset();
as("m_owner");
{
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_paid", invoiceId: "inv_m", amount: 500, method: "cash", createdAt: new Date("2026-10-10") });
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_ref", invoiceId: "inv_m", amount: -500, kind: "refund", refundOfPaymentId: "p_paid", method: "cash", createdAt: new Date("2026-10-11") });
  const writes = globalThis.__FQ_WRITES.length;
  const r = await receiptRoute.POST(req({}), { params: Promise.resolve({ id: "p_ref" }) });
  eq("6. a refund row: refused", r.status, 409);
  eq("6. …no email", globalThis.__SENT.length, 0);
  eq("6. …no write", globalThis.__FQ_WRITES.length, writes);
  eq("6. a refund row reads as a refund, never Not sent", receiptStatus(pay("p_ref")).state, "refund");

  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_none", invoiceId: "inv_none", amount: 100, method: "cash", createdAt: new Date() });
  const n = await sendPaymentReceipt(db, { companyId: CO, paymentId: "p_none", trigger: "record" });
  eq("6. no email: not sent", n.sent, false);
  eq("6. no email: says why", n.reason, "no_client_email");
  eq("6. no email: nothing went to the provider", globalThis.__SENT.length, 0);
  eq("6. no email: the row reads No email, never Sent", receiptStatus(pay("p_none")).state, "no_email");
  await retryFailedReceipts(db, { now: new Date(Date.now() + 3 * 3_600_000) });
  eq("6. no email: the cron does not retry what retrying cannot fix", pay("p_none").receiptAttempts, 1);
  const viaRoute = await receiptRoute.POST(req({}), { params: Promise.resolve({ id: "p_none" }) });
  eq("6. no email via the button: 400 with a sentence", viaRoute.status, 400);
  ok("6. …that names the fix", /no email address/i.test(viaRoute.body.error || ""), viaRoute.body.error);

  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_hist", invoiceId: "inv_hist", amount: 100, method: "cash", createdAt: new Date() });
  const h = await sendPaymentReceipt(db, { companyId: CO, paymentId: "p_hist", trigger: "manual" });
  eq("6. a past job entered after the fact: nothing is sent", h.reason, "historical");
  eq("6. …no email", globalThis.__SENT.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Language
// ═══════════════════════════════════════════════════════════════════════════
reset();
{
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_fr", invoiceId: "inv_fr", amount: 400, method: "e_transfer", createdAt: new Date() });
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_pa", invoiceId: "inv_pa", amount: 400, method: "cheque", createdAt: new Date() });
  await sendPaymentReceipt(db, { companyId: CO, paymentId: "p_fr", trigger: "manual" });
  await sendPaymentReceipt(db, { companyId: CO, paymentId: "p_pa", trigger: "manual" });
  const fr = globalThis.__SENT[0];
  const pa = globalThis.__SENT[1];
  ok("7. French client: French subject", /^Reçu de TrueFinish Cabinets/.test(fr?.subject || ""), fr?.subject);
  ok("7. French client: French body", /Total payé à ce jour/.test(fr?.text || "") && /Virement Interac/.test(fr?.text || ""), fr?.text);
  ok("7. French client: French money format", /400,00\s?\$/.test(fr?.text || ""), fr?.text);
  ok("7. the client's language beats the invoice's (invoice is en)", !/Total paid so far/.test(fr?.text || ""));
  ok("7. Punjabi client: Punjabi subject", /ਰਸੀਦ/.test(pa?.subject || ""), pa?.subject);
  ok("7. Punjabi client: Punjabi body", /ਹੁਣ ਤੱਕ ਅਦਾ ਕੀਤੀ ਕੁੱਲ ਰਕਮ/.test(pa?.text || "") && /ਚੈੱਕ/.test(pa?.text || ""), pa?.text);
  eq("7. kept with its language", rowsOf("sentEmail").map((s) => s.language).join(","), "fr,pa");
  eq("7. rule: client first", resolveReceiptLanguage({ client: { language: "pa" }, invoice: { language: "fr" }, company: { defaultLanguage: "es" } }), "pa");
  eq("7. rule: then the invoice", resolveReceiptLanguage({ client: { language: null }, invoice: { language: "fr" }, company: { defaultLanguage: "es" } }), "fr");
  eq("7. rule: then the company", resolveReceiptLanguage({ client: {}, invoice: {}, company: { defaultLanguage: "es" } }), "es");
  eq("7. rule: then English", resolveReceiptLanguage({}), "en");
  eq("7. rule: an unsupported code is skipped", resolveReceiptLanguage({ client: { language: "zh" }, invoice: { language: "de" } }), "de");
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Tenancy
// ═══════════════════════════════════════════════════════════════════════════
reset();
{
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_foreign", invoiceId: "inv_foreign", amount: 100, method: "cash", createdAt: new Date() });
  as("m_owner");
  const writes = globalThis.__FQ_WRITES.length;
  const r = await receiptRoute.POST(req({}), { params: Promise.resolve({ id: "p_foreign" }) });
  eq("8. another company's payment: 404", r.status, 404);
  eq("8. …no email", globalThis.__SENT.length, 0);
  eq("8. …no write", globalThis.__FQ_WRITES.length, writes);
  const direct = await sendPaymentReceipt(db, { companyId: CO, paymentId: "p_foreign", trigger: "manual" });
  eq("8. the sender itself refuses it too", direct.reason, "not_found");
  // A support session is read-only.
  globalThis.__FQ_SESSION = { ...rowsOf("member")[0], impersonation: true, impersonationMode: "read_only" };
  rowsOf("payment").push({ ...DEFAULTS.payment, id: "p_mine", invoiceId: "inv_m", amount: 100, method: "cash", createdAt: new Date() });
  const sup = await receiptRoute.POST(req({}), { params: Promise.resolve({ id: "p_mine" }) });
  eq("8. a support session is refused", sup.status, 403);
  eq("8. …no email", globalThis.__SENT.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. History
// ═══════════════════════════════════════════════════════════════════════════
reset();
as("m_owner");
{
  await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 2500, method: "e_transfer", sendReceipt: true }));
  await sleepTick();
  await paymentsRoute.POST(req({ invoiceId: "inv_m", amount: 3000, method: "e_transfer", sendReceipt: true }));
  const access = { read: true, office: true, quotes: true, invoices: true, jobs: true, money: true, contacts: true };
  const jobHist = await loadEmailHistory(db, { companyId: CO, clientId: "cl_maureen", job: { id: "j_m", clientId: "cl_maureen", quoteId: "q_m" }, access });
  eq("9. the JOB's email history lists both receipts", jobHist?.entries.filter((e) => e.kind === "receipt").length, 2);
  ok("9. …named by the invoice number", jobHist?.entries.every((e) => e.kind !== "receipt" || e.number === "INV-2026-0022"));
  const clientHist = await loadEmailHistory(db, { companyId: CO, clientId: "cl_maureen", access });
  eq("9. the CLIENT's email history lists both", clientHist?.entries.filter((e) => e.kind === "receipt").length, 2);
  const entry = sentEmailEntry(rowsOf("sentEmail")[0], { numbers: new Map([["inv_m", "INV-2026-0022"]]) });
  eq("9. the conversation timeline labels it a receipt", entry.labelKey, "app.conversation.doc.receiptSent");
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. White-label and contrast
// ═══════════════════════════════════════════════════════════════════════════
{
  const HOSTILE = ["#ffff00", "#ffffff", "#000000", "#808080", "#7f7f7f", "#00ff00", "#ff0000", "#f5f5dc", "#1f4e79", "#bd9d60", null]; // #bd9d60 is TrueFinish's own
  const payment = { id: "p", amount: 2500, method: "e_transfer", date: new Date("2026-10-11"), createdAt: new Date("2026-10-11") };
  let worst = 99;
  let worstWhat = "";
  for (const brandColor of HOSTILE) {
    for (const language of LANGUAGES.map((l) => l.code)) {
      const company = { name: "TrueFinish Cabinets", phone: "613-555-0100", email: "office@truefinish.example", currency: "CAD", brandColor };
      const figures = receiptFigures({ payment, payments: [payment], total: 8927 });
      const { subject, html, text } = buildReceiptEmail({ payment, figures, invoice: { invoiceNumber: "INV-2026-0022" }, client: { name: "Maureen Faulkner" }, company, url: "https://portal.example/portal/t/invoices/i", language });
      ok(`10. no FieldQuo in the subject (${language}, ${brandColor})`, !/fieldquo/i.test(subject));
      ok(`10. no FieldQuo in the visible HTML (${language}, ${brandColor})`, !/fieldquo/i.test(visible(html)));
      ok(`10. no FieldQuo in the text (${language}, ${brandColor})`, !/fieldquo/i.test(text.replace(/https?:\/\/\S+/g, "")));
      ok(`10. the company's name is on it (${language})`, html.includes("TrueFinish Cabinets"));
      ok(`10. no "undefined" reaches a client (${language}, ${brandColor})`, !/undefined|NaN/.test(html + text + subject));
    }
    const t = documentTheme({ brandColor });
    const fill = fillPair(t);
    const pairs = [
      ["ink on card", t.ink, "#ffffff"],
      ["muted on card", t.inkMuted, "#ffffff"],
      ["paid-in-full on card", ensureContrast(t.positive, "#ffffff", 4.5), "#ffffff"],
      ["button", fill.fg, fill.bg],
      ["band text", fill.fg, fill.bg],
      ["figure on wash", ensureContrast(t.accentText, t.accentWash, 4.5), t.accentWash],
      ["label on wash", t.inkMutedOnWash, t.accentWash],
      ["footer name on wash", t.inkOnWash, t.accentWash],
    ];
    for (const [what, fg, bg] of pairs) {
      const r = contrastRatio(fg, bg);
      if (r < worst) {
        worst = r;
        worstWhat = `${what} on ${brandColor}`;
      }
    }
  }
  ok(`10. every text/background pair ≥ 4.5:1 on hostile brands (worst ${worst.toFixed(2)}: ${worstWhat})`, worst >= 4.5);
  // The colours the builder actually printed are those pairs.
  const sample = buildReceiptEmail({
    payment: { id: "p", amount: 1, method: "cash", date: new Date(), createdAt: new Date() },
    figures: { amount: 1, total: 1, paidSoFar: 1, balance: 0, paidInFull: true },
    invoice: { invoiceNumber: "X" },
    client: { name: "" },
    company: { name: "Yellow Co", brandColor: "#ffff00" },
    url: "https://portal.example/x",
  });
  const yt = documentTheme({ brandColor: "#ffff00" });
  ok("10. the paid-in-full line uses the measured green", sample.html.includes(ensureContrast(yt.positive, "#ffffff", 4.5)));
  ok("10. paid in full: no balance line", !/Balance remaining/.test(sample.text));
  ok("10. a client with no first name is greeted without a dangling comma", /^Hello,/.test(sample.text), sample.text.slice(0, 40));
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. Copy completeness and wiring
// ═══════════════════════════════════════════════════════════════════════════
{
  const shape = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? shape(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = shape(RECEIPT_EMAIL_COPY.en);
  for (const { code } of LANGUAGES) {
    const here = RECEIPT_EMAIL_COPY[code];
    ok(`11. receipt copy has every client language: ${code}`, Boolean(here));
    if (here) eq(`11. ${code} is key-for-key with English`, shape(here).join(","), base.join(","));
  }
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const page = strip(read("app/app/invoices/[id]/page.js"));
  ok("11. the page posts the box", /sendReceipt:\s*receiptChecked/.test(page));
  ok("11. the page calls the receipt route", page.includes("/api/payments/${encodeURIComponent(p.id)}/receipt"));
  ok("11. the page reads the company setting for the default", /company\?\.emailPaymentReceipts === true/.test(page));
  ok("11. a resend is confirmed before it is sent", /sendReceipt\(p, true\)/.test(page) && /setReceiptConfirm\(p\.id\)/.test(page));
  const info = strip(read("app/api/settings/business-info/route.js"));
  ok("11. the setting is read by GET", /emailPaymentReceipts: true/.test(info));
  ok("11. the setting is written by PATCH", /typeof emailPaymentReceipts === "boolean" && \{ emailPaymentReceipts \}/.test(info));
  const card = strip(read("app/app/settings/payments/ReceiptEmailsCard.js"));
  ok("11. the settings card PATCHes it", /emailPaymentReceipts: next/.test(card));
  ok("11. the settings page renders the card", /<ReceiptEmailsCard /.test(read("app/app/settings/payments/page.js")));
  const vercel = JSON.parse(read("vercel.json"));
  ok("11. the retry cron is scheduled", vercel.crons.some((c) => c.path === "/api/cron/payment-receipts"));
  const plans = strip(read("lib/servicePlans/run.js"));
  eq("11. service plans opt out at both charge sites (they send their own receipt)", (plans.match(/clientReceipt: false/g) || []).length, 2);
}

console.log(`\ncheck-payment-receipts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
