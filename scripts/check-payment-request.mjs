// scripts/check-payment-request.mjs
//
//   npm run check:payment-request
//
// "Request payment should say request full amount or maybe portion amount."
// The invoice page's Request payment now offers the next scheduled payment,
// the full balance, or a different amount the office types; the client pays
// exactly the stored figure (or chooses the whole balance), and a payment
// larger than one stage covers the stages in sequence. This runs
// lib/invoices/paymentRequest.js against hostile input, runs the portal's
// charge resolver against a scripted database (another company's invoice and
// request, a spent request, a covered stage), and holds the routes to the
// wiring that makes the figures server-side. Judged by exit code.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAmountCents,
  validateCustomAmount,
  stageCoverage,
  stageRemainingCents,
  requestRemainingCents,
  requestOptions,
  clientPayChoices,
  REQUEST_CHOICES,
} from "@/lib/invoices/paymentRequest";
import { invoiceSendAsk } from "@/lib/invoices/sendAsk";
import { resolvePortalCharge, stageShareCents, requestShareCents } from "@/lib/portal/payableInvoice";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}

// ── The real case: TrueFinish INV-2026-0022, $8,927.00 on 30 / 30 / 40 ─────
const CASE = [
  { id: "dep", seq: 1, label: "Deposit", amountCents: 267810, status: "requested" },
  { id: "start", seq: 2, label: "Job start", amountCents: 267810, status: "pending" },
  { id: "end", seq: 3, label: "Job end", amountCents: 357080, status: "pending" },
];
const TOTAL = 892700;

console.log("\nThe typed amount (staff only — still held to the server's balance)\n");
{
  const bal = TOTAL;
  const v = (input) => validateCustomAmount({ input, balanceCents: bal });
  ok("6500 → 650000 cents", v(6500).ok && v(6500).cents === 650000, v(6500));
  ok('"6500.50" → 650050 cents', v("6500.50").cents === 650050, v("6500.50"));
  ok("0 → refused, not_positive", v(0).ok === false && v(0).code === "not_positive", v(0));
  ok('"0.00" → refused, not_positive', v("0.00").code === "not_positive", v("0.00"));
  ok("-500 → refused", v(-500).ok === false && v(-500).code === "not_positive", v(-500));
  ok('"-1" → refused', v("-1").ok === false, v("-1"));
  ok("above the balance ($8,927.01) → refused, over_balance", v(8927.01).code === "over_balance", v(8927.01));
  ok("exactly the balance → allowed", v(8927).ok && v(8927).cents === TOTAL, v(8927));
  ok("NaN → refused", v(NaN).code === "invalid_amount", v(NaN));
  ok("Infinity → refused", v(Infinity).code === "invalid_amount", v(Infinity));
  ok('"6,500.00" → refused (parseFloat would read 6, a German office 6.5)', v("6,500.00").code === "invalid_amount", v("6,500.00"));
  ok('"6500.005" → refused (a fraction of a cent is a typo)', v("6500.005").code === "invalid_amount", v("6500.005"));
  ok('"1e4", "", " ", null, {}, [] → refused', ["1e4", "", " ", null, undefined, {}, [], true].every((x) => v(x).ok === false));
  ok('"1e3", "0x10", "+5", " 12 " → parseAmountCents refuses the first three, trims the last', ["1e3", "0x10", "+5"].every((x) => parseAmountCents(x).ok === false) && parseAmountCents(" 12 ").cents === 1200);
  ok("6500.005 as a NUMBER → refused (sub-cent)", v(6500.005).code === "invalid_amount", v(6500.005));
  ok("nothing owed → refused whatever is typed", validateCustomAmount({ input: 10, balanceCents: 0 }).code === "nothing_owed");
  ok("parseAmountCents is float-safe (0.1 + 0.2 → 30 cents)", parseAmountCents(0.1 + 0.2).cents === 30, parseAmountCents(0.1 + 0.2));
  ok("the three choices are exactly next_stage / balance / custom", JSON.stringify(REQUEST_CHOICES) === JSON.stringify(["next_stage", "balance", "custom"]));
}

console.log("\n$6,500 against the schedule — covered in sequence\n");
{
  const cov = stageCoverage({ stages: CASE, paidCents: 650000 });
  const by = Object.fromEntries(cov.map((c) => [c.id, c]));
  ok("Deposit $2,678.10 → paid", by.dep.state === "paid" && by.dep.remainingCents === 0, by.dep);
  ok("Job start $2,678.10 → paid (blocked on its date, pre-paid, never requested)", by.start.state === "paid" && by.start.status === "pending", by.start);
  ok("Job end → $1,143.80 covered, $2,427.00 still due", by.end.state === "part_paid" && by.end.coveredCents === 114380 && by.end.remainingCents === 242700, by.end);
  ok("…and $2,427.00 is exactly the invoice balance", by.end.remainingCents === TOTAL - 650000);
  const o = requestOptions({ totalCents: TOTAL, paidCents: 650000, stages: CASE });
  ok("next scheduled payment after $6,500 is Job end for $2,427.00 (3 of 3)", o.nextStage?.id === "end" && o.nextStage.requestCents === 242700 && o.nextStage.index === 3 && o.nextStage.count === 3, o.nextStage);
  ok("a paid stage is never asked for again", stageRemainingCents({ stages: CASE, paidCents: 650000, stageId: "dep", balanceCents: TOTAL - 650000 }) === 0 && stageRemainingCents({ stages: CASE, paidCents: 650000, stageId: "start", balanceCents: TOTAL - 650000 }) === 0);
  ok("the part-paid stage asks for its remainder only", stageRemainingCents({ stages: CASE, paidCents: 650000, stageId: "end", balanceCents: TOTAL - 650000 }) === 242700);
  ok("an unknown stage id → null (caller falls back to the balance)", stageRemainingCents({ stages: CASE, paidCents: 0, stageId: "nope", balanceCents: TOTAL }) === null);
  const none = requestOptions({ totalCents: TOTAL, paidCents: 0, stages: CASE });
  ok("nothing paid → next scheduled payment is the deposit, $2,678.10 (1 of 3)", none.nextStage?.id === "dep" && none.nextStage.requestCents === 267810 && none.nextStage.index === 1, none.nextStage);
  ok("…and the full balance is $8,927.00", none.balanceCents === TOTAL);
  const full = requestOptions({ totalCents: TOTAL, paidCents: TOTAL, stages: CASE });
  ok("the full balance paid → every stage paid, nothing left to ask", full.nextStage === null && full.balanceCents === 0 && full.stages.every((s) => s.state === "paid"), full);
  const co = requestOptions({ totalCents: TOTAL + 50000, paidCents: TOTAL, stages: CASE });
  ok("every stage covered but a change order owing → no 'next stage', the balance stays askable", co.nextStage === null && co.balanceCents === 50000, co);
  const waived = stageCoverage({ stages: [{ id: "w", seq: 1, amountCents: 0, status: "waived" }, ...CASE], paidCents: 267810 });
  ok("a waived stage takes nothing", waived[0].state === "waived" && waived[1].state === "paid");
  ok("hostile stage lists don't throw", stageCoverage({ stages: "x" }).length === 0 && stageCoverage({ stages: [null, 5, {}] }).length === 1);
}

console.log("\nThe same allocation as Send (lib/invoices/sendAsk.js)\n");
{
  let agree = true;
  let seed = 7;
  const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
  for (let i = 0; i < 2000; i++) {
    const count = 1 + rnd(4);
    const stages = Array.from({ length: count }, (_, k) => ({
      id: `s${k}`, seq: rnd(10), label: `S${k}`, amountCents: rnd(5) === 0 ? 0 : rnd(300000), status: rnd(6) === 0 ? "waived" : "pending",
    }));
    const total = stages.reduce((a, s) => a + s.amountCents, 0) + rnd(3) * 1000;
    const paid = rnd(total + 2000);
    const a = invoiceSendAsk({ totalCents: total, paidCents: paid, stages });
    const o = requestOptions({ totalCents: total, paidCents: paid, stages });
    const sendStage = a.kind === "stage" ? a.stage.id : null;
    const sendCents = a.kind === "stage" ? a.requestCents : null;
    if (sendStage !== (o.nextStage?.id ?? null) || (sendStage && sendCents !== o.nextStage.requestCents)) {
      agree = false;
      console.log("   disagree", { stages, total, paid, a, n: o.nextStage });
      break;
    }
  }
  ok("2,000 random schedules: requestOptions' next stage === Send's stage, same cents", agree);
}

console.log("\nA stored request's remaining amount\n");
{
  ok("nothing paid since → the full request", requestRemainingCents({ amountCents: 650000, paidCentsAtRequest: 0, paidCents: 0, balanceCents: TOTAL }) === 650000);
  ok("$6,500 paid since → spent (0)", requestRemainingCents({ amountCents: 650000, paidCentsAtRequest: 0, paidCents: 650000, balanceCents: TOTAL - 650000 }) === 0);
  ok("$1,000 by cheque since → $5,500", requestRemainingCents({ amountCents: 650000, paidCentsAtRequest: 0, paidCents: 100000, balanceCents: TOTAL - 100000 }) === 550000);
  ok("money before the request doesn't count against it", requestRemainingCents({ amountCents: 300000, paidCentsAtRequest: 267810, paidCents: 267810, balanceCents: TOTAL - 267810 }) === 300000);
  ok("capped at the balance (an amended, smaller invoice)", requestRemainingCents({ amountCents: 650000, paidCentsAtRequest: 0, paidCents: 0, balanceCents: 400000 }) === 400000);
  ok("never negative", requestRemainingCents({ amountCents: 100, paidCentsAtRequest: 0, paidCents: 999999, balanceCents: 0 }) === 0);
}

console.log("\nThe client's choice: the figure asked, or everything owed\n");
{
  const c = clientPayChoices({ requestedCents: 650000, balanceCents: TOTAL });
  ok("$6,500 of $8,927 → two choices, both server figures", c.length === 2 && c[0].choice === "requested" && c[0].cents === 650000 && c[1].choice === "balance" && c[1].cents === TOTAL, c);
  ok("asked === balance → one choice (no identical buttons)", clientPayChoices({ requestedCents: TOTAL, balanceCents: TOTAL }).length === 1);
  ok("asked > balance → capped, one choice", clientPayChoices({ requestedCents: 999999999, balanceCents: TOTAL })[0].cents === TOTAL);
  ok("spent request → the balance only", JSON.stringify(clientPayChoices({ requestedCents: 0, balanceCents: 242700 })) === JSON.stringify([{ choice: "balance", cents: 242700 }]));
  ok("nothing owed → no choice at all", clientPayChoices({ requestedCents: 100, balanceCents: 0 }).length === 0);
}

// ── A scripted database for the portal's charge resolver ───────────────────
function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return cond.some((w) => matches(row, w));
    if (k === "AND") return cond.every((w) => matches(row, w));
    const v = row[k];
    if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ("in" in cond) return cond.in.includes(v);
      if ("not" in cond) return cond.not === null ? v != null : v !== cond.not;
      return false;
    }
    return v === cond;
  });
}
function fakeDb(tables) {
  const t = (name) => tables[name] || (tables[name] = []);
  const withInclude = (row, include) => (row && include?.client ? { ...row, client: t("client").find((c) => c.id === row.clientId) } : row);
  const model = (name) => ({
    findUnique: async ({ where, include }) => withInclude(t(name).find((r) => matches(r, where)) || null, include),
    findFirst: async ({ where, include }) => withInclude(t(name).find((r) => matches(r, where)) || null, include),
    findMany: async ({ where } = {}) => t(name).filter((r) => matches(r, where)),
    update: async ({ where, data }) => {
      const r = t(name).find((x) => matches(x, where));
      Object.assign(r, data);
      return r;
    },
  });
  return new Proxy({}, { get: (_, name) => model(name) });
}
const tables = () => ({
  client: [
    { id: "cl_a", companyId: "co_a", portalToken: "tok_a" },
    { id: "cl_b", companyId: "co_b", portalToken: "tok_b" },
  ],
  company: [
    { id: "co_a", stripeAccountId: "acct_a", stripeChargesEnabled: true },
    { id: "co_b", stripeAccountId: "acct_b", stripeChargesEnabled: true },
  ],
  invoice: [
    { id: "inv_a", companyId: "co_a", clientId: "cl_a", total: 8927, amountPaid: 0, status: "sent", sentAt: new Date(), version: 1, parentInvoiceId: null },
    { id: "inv_b", companyId: "co_b", clientId: "cl_b", total: 500, amountPaid: 0, status: "sent", sentAt: new Date(), version: 1, parentInvoiceId: null },
  ],
  payment: [],
  jobPaymentStage: CASE.map((s) => ({ ...s, companyId: "co_a", invoiceId: "inv_a" })).concat([
    { id: "stage_b", seq: 1, label: "Deposit", amountCents: 10000, status: "requested", companyId: "co_b", invoiceId: "inv_b" },
  ]),
  invoicePaymentRequest: [
    { id: "req_a", companyId: "co_a", invoiceId: "inv_a", amountCents: 650000, paidCentsAtRequest: 0, status: "open" },
    { id: "req_old", companyId: "co_a", invoiceId: "inv_a", amountCents: 100000, paidCentsAtRequest: 0, status: "superseded" },
    { id: "req_unsent", companyId: "co_a", invoiceId: "inv_a", amountCents: 100000, paidCentsAtRequest: 0, status: "unsent" },
    { id: "req_b", companyId: "co_b", invoiceId: "inv_b", amountCents: 20000, paidCentsAtRequest: 0, status: "open" },
  ],
});

console.log("\nThe client pays the stored figure — resolved server-side\n");
{
  const db = fakeDb(tables());
  const r = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", requestId: "req_a" });
  ok("the $6,500 request → charge 650000 cents", r.ok && r.chargeCents === 650000 && r.requestAmountCents === 650000, r.chargeCents);
  const plain = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a" });
  ok("no request named → the full balance, $8,927.00", plain.chargeCents === TOTAL, plain.chargeCents);
  const dep = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", stageId: "dep" });
  ok("the deposit link, nothing paid → $2,678.10", dep.chargeCents === 267810, dep.chargeCents);
  const otherInvoice = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_b" });
  ok("another company's invoice through this token → 404", otherInvoice.ok === false && otherInvoice.status === 404, otherInvoice);
  const otherReq = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", requestId: "req_b" });
  ok("another company's request id → ignored, the balance", otherReq.chargeCents === TOTAL && otherReq.requestAmountCents === undefined, otherReq.chargeCents);
  const otherStage = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", stageId: "stage_b" });
  ok("another company's stage id → ignored, the balance", otherStage.chargeCents === TOTAL, otherStage.chargeCents);
  for (const id of ["req_old", "req_unsent"]) {
    const x = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", requestId: id });
    ok(`a ${id === "req_old" ? "superseded" : "never-sent"} request → the balance`, x.chargeCents === TOTAL, x.chargeCents);
  }
  const objId = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", requestId: { in: ["req_a"] } });
  ok("a Prisma-shaped requestId → ignored, the balance", objId.chargeCents === TOTAL, objId.chargeCents);
}
{
  const tb = tables();
  tb.payment.push({ id: "p1", invoiceId: "inv_a", amount: 6500, kind: "payment" });
  const db = fakeDb(tb);
  const dep = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", stageId: "dep" });
  ok("after $6,500, the deposit link no longer asks for the deposit → the balance $2,427.00", dep.stageAmountCents === undefined && dep.chargeCents === 242700, dep);
  const req = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", requestId: "req_a" });
  ok("after $6,500, the $6,500 request is spent → the balance $2,427.00", req.requestAmountCents === undefined && req.chargeCents === 242700, req);
  tb.jobPaymentStage.find((s) => s.id === "end").status = "requested";
  const end = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", stageId: "end" });
  ok("the Job end link then asks for its remainder, $2,427.00, not $3,570.80", end.stageAmountCents === 242700 && end.chargeCents === 242700, end);
  ok("stageShareCents with no stage row → undefined", (await stageShareCents(db, { companyId: "co_a", current: tb.invoice[0], stageId: "x", stage: null })) === undefined);
  ok("requestShareCents with no id → undefined", (await requestShareCents(db, { companyId: "co_a", current: tb.invoice[0], requestId: "" })) === undefined);
}
{
  const tb = tables();
  tb.payment.push({ id: "p1", invoiceId: "inv_a", amount: 1000, kind: "payment" });
  const db = fakeDb(tb);
  const req = await resolvePortalCharge(db, { token: "tok_a", invoiceId: "inv_a", requestId: "req_a" });
  ok("$1,000 by cheque after the request → the request asks for $5,500", req.chargeCents === 550000, req.chargeCents);
}

console.log("\nThe wiring\n");
{
  const pay = decomment(read("app/api/portal/[token]/pay/route.js"));
  ok("pay route: the body names invoiceId / stageId / requestId / method only", /const \{ invoiceId, stageId, requestId, method: requestedMethod = "card" \} = body;/.test(pay));
  ok("pay route: a tampered body.amount is never read", !/body\.(amount|total|cents|price)/.test(pay) && !/\bamount\b\s*[:=]\s*body/.test(pay));
  ok("pay route: the request's figure comes from requestShareCents (the row + the ledger)", /amountCents = await requestShareCents\(db, \{ companyId: client\.companyId, current, requestId \}\)/.test(pay));
  ok("pay route: a stage's figure is its uncovered share", /amountCents = await stageShareCents\(db,/.test(pay));
  const lib = decomment(read("lib/portal/payableInvoice.js"));
  ok("payableInvoice: a request is scoped to company + THIS invoice + open", /where: \{ id: requestId, companyId, invoiceId: current\.id, status: "open" \}/.test(lib));
  const card = decomment(read("app/api/portal/[token]/card-pay/route.js"));
  ok("card-pay passes requestId as a string hint only", /requestId: typeof body\.requestId === "string" \? body\.requestId : null/.test(card));
  const rp = decomment(read("app/api/invoices/[id]/request-payment/route.js"));
  ok("request-payment: the office's figure goes through validateCustomAmount against the server's balance", /validateCustomAmount\(\{ input: body\?\.amount, balanceCents: options\.balanceCents \}\)/.test(rp));
  ok("request-payment: the request row is written unsent, and opened only after the email is accepted",
    /status: "unsent"/.test(rp) && rp.indexOf('status: "open", sentToEmail') > rp.indexOf("const result = await sendEmail("));
  ok("request-payment: a newer request supersedes the older open ones", /data: \{ status: "superseded" \}/.test(rp));
  ok("request-payment: no mode keeps the old chase exactly (reminder, plain link)", /mode === "balance"\s*\?\s*buildInvoiceEmail\(\{\s*invoice,\s*client: invoice\.client,\s*company: companyText \|\| \{\},\s*url,\s*canTakeCard,\s*note,\s*kind: "reminder",/.test(rp));
  ok("request-payment: the next stage marks the stage requested, like Send", /mode === "next_stage" && options\.nextStage\.status === "pending"/.test(rp));
  const run = decomment(read("lib/paymentSchedule/run.js"));
  ok("the cron asks only for a stage's uncovered share, and nothing for a covered one", /if \(left === 0\) return \{ fired: false, reason: "covered" \};/.test(run) && /requestAmount: askCents \/ 100,/.test(run));
  const portal = decomment(read("app/api/portal/[token]/route.js"));
  ok("portal GET ships requested stages at their remaining share, and open requests", /\.filter\(\(stage\) => stage\.status === "requested"\)/.test(portal) && /paymentRequests: openRequests/.test(portal));
  const page = decomment(read("app/portal/[token]/invoices/[id]/PortalInvoice.js"));
  ok("the client's page offers server figures only — radio buttons, no amount input", /clientPayChoices\(/.test(page) && !/type="number"/.test(page) && !/amount:/.test(page.match(/jsonBody\([\s\S]*?"payment"\)/)?.[0] || ""));
  const inv = decomment(read("app/app/invoices/[id]/page.js"));
  ok("invoice page: the three choices are rendered", /optionNextStage/.test(inv) && /optionBalance/.test(inv) && /optionCustom/.test(inv));
  ok("invoice GET withholds requestOptions from a role that may not see money", /"requestOptions",/.test(read("lib/permissions/enforce.js")));
}

console.log("\nEvery string, in every language\n");
{
  const keys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.invoiceChase.") || k === "app.job.paymentSchedule.paid" || k === "app.job.paymentSchedule.partPaid");
  for (const [code, dict] of Object.entries(APP_MESSAGES)) {
    const missing = keys.filter((k) => !(k in dict));
    ok(`app strings in ${code}`, missing.length === 0, missing);
  }
  for (const [code, copy] of Object.entries(CLIENT_DOC_COPY)) {
    ok(`client pay-choice copy in ${code}`, Boolean(copy.payChoice?.title && copy.payChoice?.requested && copy.payChoice?.balance));
  }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
