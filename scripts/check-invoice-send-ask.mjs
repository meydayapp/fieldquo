// scripts/check-invoice-send-ask.mjs
//
//   npm run check:invoice-send-ask
//
// The manual invoice Send asks for the stage that is due, the balance when
// there is no schedule, and never for money already collected — the three
// schedules the brief named (none / deposit + balance / three stages), run
// through lib/invoices/sendAsk.js, and the wiring that carries the answer
// into the email, the stage row, the GET and the screen. Judged by exit code.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { invoiceSendAsk, invoiceSendAskFor } from "@/lib/invoices/sendAsk";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

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

// ── No schedule ────────────────────────────────────────────────────────────
{
  const a = invoiceSendAsk({ totalCents: 500000, paidCents: 0, stages: [] });
  ok("no schedule, nothing paid → the full balance", a.kind === "balance" && a.requestCents === 500000, a);
  const b = invoiceSendAsk({ totalCents: 500000, paidCents: 120000, stages: [] });
  ok("no schedule, part paid → what is left, never the total", b.kind === "balance" && b.requestCents === 380000 && b.collectedCents === 120000, b);
  const c = invoiceSendAsk({ totalCents: 500000, paidCents: 500000, stages: [] });
  ok("no schedule, all paid → refused", c.kind === "nothing_owed" && c.requestCents === 0, c);
  const d = invoiceSendAsk({ totalCents: 500000, paidCents: 520000, stages: [] });
  ok("overpaid is refused too, not a negative ask", d.kind === "nothing_owed", d);
  ok("garbage in → balance of zero is refused", invoiceSendAsk({}).kind === "nothing_owed" && invoiceSendAsk({ totalCents: "x", paidCents: null, stages: "no" }).kind === "nothing_owed");
}

// ── Deposit + balance ──────────────────────────────────────────────────────
{
  const stages = [
    { id: "s2", seq: 2, label: "Balance on completion", amountCents: 350000, status: "pending" },
    { id: "s1", seq: 1, label: "Deposit", amountCents: 150000, status: "requested" },
  ];
  const a = invoiceSendAsk({ totalCents: 500000, paidCents: 0, stages });
  ok("deposit + balance, nothing paid → the deposit, by seq not by array order", a.kind === "stage" && a.stage.id === "s1" && a.requestCents === 150000 && a.stage.index === 1 && a.stage.count === 2, a);
  const b = invoiceSendAsk({ totalCents: 500000, paidCents: 150000, stages });
  ok("deposit paid → the balance stage, never the deposit again", b.kind === "stage" && b.stage.id === "s2" && b.requestCents === 350000 && b.collectedCents === 150000, b);
  const c = invoiceSendAsk({ totalCents: 500000, paidCents: 100000, stages });
  ok("deposit part paid → the rest of the deposit only", c.kind === "stage" && c.stage.id === "s1" && c.requestCents === 50000, c);
  const d = invoiceSendAsk({ totalCents: 500000, paidCents: 500000, stages });
  ok("all paid → refused", d.kind === "nothing_owed", d);
  const e = invoiceSendAsk({ totalCents: 500000, paidCents: 0, stages: [{ ...stages[1], status: "waived", amountCents: 0 }, stages[0]] });
  ok("a waived stage is skipped", e.kind === "stage" && e.stage.id === "s2", e);
}

// ── Three stages ───────────────────────────────────────────────────────────
{
  const stages = [
    { id: "s1", seq: 1, label: "Deposit", amountCents: 300000, status: "requested" },
    { id: "s2", seq: 2, label: "Halfway", amountCents: 400000, status: "pending" },
    { id: "s3", seq: 3, label: "Completion", amountCents: 300000, status: "pending" },
  ];
  const a = invoiceSendAsk({ totalCents: 1000000, paidCents: 300000, stages });
  ok("three stages, deposit paid → halfway", a.kind === "stage" && a.stage.id === "s2" && a.requestCents === 400000 && a.stage.index === 2 && a.stage.count === 3, a);
  const b = invoiceSendAsk({ totalCents: 1000000, paidCents: 700000, stages });
  ok("two paid → completion", b.kind === "stage" && b.stage.id === "s3" && b.requestCents === 300000, b);
  const c = invoiceSendAsk({ totalCents: 1000000, paidCents: 350000, stages });
  ok("paid past the deposit → the uncovered part of halfway", c.kind === "stage" && c.stage.id === "s2" && c.requestCents === 350000, c);
  const d = invoiceSendAsk({ totalCents: 900000, paidCents: 700000, stages });
  ok("a total shrunk by a change order → never more than is owed on the invoice", d.kind === "stage" && d.stage.id === "s3" && d.requestCents === 200000, d);
  const e = invoiceSendAsk({ totalCents: 1200000, paidCents: 1000000, stages });
  ok("every stage covered and a change order added work → the balance, not a stage", e.kind === "balance" && e.requestCents === 200000 && e.stage === null, e);
  const f = invoiceSendAskFor({ total: "10000.00", amountPaid: 3000 }, stages);
  ok("the dollar form rounds to cents and agrees", f.kind === "stage" && f.stage.id === "s2" && f.requestCents === 400000, f);
}

// ── Wiring ─────────────────────────────────────────────────────────────────
{
  const route = decomment(read("app/api/invoices/[id]/send/route.js"));
  ok("the send route decides by invoiceSendAsk from family payments and the invoice's stage rows", /invoiceSendAsk\(/.test(route) && /familyPayments\(db, invoice\.id\)/.test(route) && /jobPaymentStage\.findMany/.test(route));
  ok("…refuses when everything is collected, before the portal token is minted", route.indexOf('code: "nothing_owed"') > 0 && route.indexOf('code: "nothing_owed"') < route.indexOf("ensurePortalToken("));
  // The label is printed in the invoice's language since 2026-09-25 (drafted
  // on save as a paymentStage phrase — scripts/check-phrases-labels.mjs).
  ok("…hands the email the ask as requestAmount with the stage's label", /requestAmount: ask\.requestCents \/ 100/.test(route) && /note: ask\.stage \? trStage\("paymentStage", ask\.stage\.label\) : null/.test(route));
  ok("…links the portal to the stage so its Pay button takes that amount", /\?stage=\$\{ask\.stage\.id\}/.test(route));
  ok("…marks a pending stage requested after the send, scoped to the company", /jobPaymentStage\.updateMany\(\{\s*where: \{ id: ask\.stage\.id, companyId: member\.companyId, status: "pending" \}/.test(route));
  ok("…and the stamp comes after the send is accepted", route.indexOf("jobPaymentStage.updateMany") > route.indexOf("await sendEmail("));
  ok("…and answers what it asked for", /ask: \{ kind: ask\.kind, requested: ask\.requestCents \/ 100/.test(route));
  const get = decomment(read("app/api/invoices/[id]/route.js"));
  ok("the GET says what Send would ask for, by the same function", /invoice\.sendAsk = \{ kind: ask\.kind/.test(get) && /invoiceSendAsk\(/.test(get));
  const enforce = decomment(read("lib/permissions/enforce.js"));
  const moneyFieldsAt = enforce.indexOf("INVOICE_MONEY_FIELDS = [");
  const moneyFields = enforce.slice(moneyFieldsAt, enforce.indexOf("]", moneyFieldsAt));
  ok("…and a money-hidden role does not see it", /"sendAsk",/.test(moneyFields));
  const page = decomment(read("app/app/invoices/[id]/page.js"));
  ok("the screen says which stage Send asks for before the press", /app\.invoiceDetail\.sendAskStage/.test(page) && /invoice\.sendAsk\?\.kind === "stage"/.test(page));
  ok("…and what it asked for after", /app\.invoiceDetail\.sentAskedFor/.test(page) && /setJustSentAsk\(data\.ask/.test(page));
  ok("…and the nothing-owed refusal in words", /app\.invoiceDetail\.sendNothingOwed/.test(page));
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = ["app.invoiceDetail.sendAskStage", "app.invoiceDetail.sendAskBalance", "app.invoiceDetail.sentAskedFor", "app.invoiceDetail.sendNothingOwed"].filter((k) => !(k in APP_MESSAGES[lang]));
    ok(`${lang} carries the send-ask keys`, missing.length === 0, missing);
  }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
