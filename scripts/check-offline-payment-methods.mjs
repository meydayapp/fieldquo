// scripts/check-offline-payment-methods.mjs
//
//   npm run check:offline-payment-methods
//
// The offline payment methods — e-transfer, Zelle, cheque and the rest — from
// the switch in Settings → Payments to the "How to pay" block a homeowner
// reads on the invoice PDF, in the invoice email and in the client portal.
//
// Executed, not read:
//   * the catalogue is closed and country-bound: a US company is never
//     offered Interac, a Canadian one never Zelle, a UK one neither;
//   * the Settings PATCH (the real route, against the scripted db and
//     session) refuses "E-transfer is on but has no address" in a sentence,
//     keeps a save that carries one, rewrites a US company's Canadian
//     default (`e_transfer` dropped, `cheque` → `check`), strips @ and $
//     from handles, refuses a routing number whose check digit fails, and
//     logs field NAMES only — never an account number;
//   * buildHowToPay prints only what is switched on, with the address the
//     company typed, in all eight document languages, and prints a bare
//     label (never an invented address) for a method switched on before
//     details existed;
//   * the block an invoice stores at send time wins over the company's
//     later settings — on the PDF section, in the email and in the portal;
//   * the invoice email carries the Zelle number and NOT the ACH routing or
//     account number, which the PDF and the portal do carry;
//   * a real PDF is rendered through renderDocumentPdfBuffer with the
//     default invoice sections, its text decoded, and the block found on it
//     — and, with HOWTOPAY_PDF=<path>, written out for a screenshot;
//   * the portal route ships each invoice's rendered block and never the
//     company's paymentMethodDetails;
//   * every text/background pair the block uses clears 4.5:1 across the
//     brand colours contractors actually pick.
//
// Bundled with esbuild (see package.json) because it renders through the
// real @react-pdf sections, with `@/lib/db` and `@/lib/apiMember` aliased to
// the scripted fixtures so the routes can run.

import zlib from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  OFFLINE_METHODS,
  OFFLINE_METHOD_KEYS,
  OFFLINE_METHOD_LANGUAGES,
  OFFLINE_METHOD_COPY,
  methodsForCountry,
  enabledMethods,
  sanitiseMethods,
  validateDetails,
  validateAllDetails,
  validRoutingNumber,
  buildHowToPay,
  howToPayFor,
  depositHowToPay,
  emailLinesFor,
  onlineOptions,
  HOW_TO_PAY_COMPANY_SELECT,
} from "@/lib/payments/offlineMethods";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments/methodLabels";
import { OUTBOUND_PAYMENT_METHODS, INBOUND_ONLY_PAYMENT_METHODS } from "@/lib/subcontractors/payload";
import { PAST_JOB_PAYMENT_METHODS } from "@/lib/jobs/pastJobImport";
import { howToPayBlock } from "@/lib/documentSections/HowToPaySection";
import { howToPayEmailHtml, howToPayEmailText } from "@/lib/payments/howToPayEmail";
import { SECTION_REGISTRY } from "@/lib/documentSections/registry";
import { SECTION_META, sectionsForType } from "@/lib/documentSections/sectionMeta";
import { getDefaultSections } from "@/app/admin/lib/pdf/defaultSections";
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { documentTheme, washPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { parsePaymentSchedule } from "@/lib/documents/paymentSchedule";
import { PATCH as settingsPatch } from "@/app/api/settings/business-info/route";
import { GET as portalGet } from "@/app/api/portal/[token]/route";
import { rows, writes, reads, resetDbStub } from "@/lib/db";
import { session } from "@/lib/apiMember";

// esbuild's cjs output has no top-level await, so the sections run inside
// one async main.
async function main() {
const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${!cond && detail !== undefined ? `  — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}
const section = (t) => console.log(`\n${t}`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. A closed catalogue, by country");
// ═══════════════════════════════════════════════════════════════════════════
{
  const ca = methodsForCountry("CA");
  const us = methodsForCountry("US");
  const gb = methodsForCountry("GB");
  ok("Canada: e-transfer, PayPal, cheque, cash", JSON.stringify(ca) === JSON.stringify(["e_transfer", "paypal", "cheque", "cash"]), ca);
  ok("United States: Zelle, Venmo, Cash App, ACH, PayPal, check, cash", JSON.stringify(us) === JSON.stringify(["zelle", "venmo", "cash_app", "ach", "paypal", "check", "cash"]), us);
  ok("a Canadian company is never offered Zelle, Venmo, Cash App, ACH or check", !ca.some((m) => ["zelle", "venmo", "cash_app", "ach", "check"].includes(m)));
  ok("a US company is never offered e-transfer or cheque", !us.includes("e_transfer") && !us.includes("cheque"));
  ok("anywhere else: PayPal, cheque, cash — neither Interac nor Zelle exists there", JSON.stringify(gb) === JSON.stringify(["paypal", "cheque", "cash"]), gb);
  const KINDS = new Set(["email_or_phone", "handle", "cashtag", "routing", "account", "text", "address", "bool"]);
  ok("every method names its countries and fields", OFFLINE_METHOD_KEYS.every((m) => Array.isArray(OFFLINE_METHODS[m].countries) && Array.isArray(OFFLINE_METHODS[m].fields)));
  ok("every field has a known kind", OFFLINE_METHOD_KEYS.every((m) => OFFLINE_METHODS[m].fields.every((f) => KINDS.has(f.kind))));
  ok("only ACH carries secret fields, and only ACH is document-only", OFFLINE_METHOD_KEYS.every((m) => (m === "ach") === OFFLINE_METHODS[m].fields.some((f) => f.secret) && (m === "ach") === Boolean(OFFLINE_METHODS[m].documentOnly)));
  ok("e-transfer needs an address; cash needs nothing; cheque needs nothing (the payee is the company)", OFFLINE_METHODS.e_transfer.fields.some((f) => f.key === "address" && f.required) && OFFLINE_METHODS.cash.fields.length === 0 && !OFFLINE_METHODS.cheque.fields.some((f) => f.required));
  ok("every catalogue method is a PaymentMethod enum value with a label (Record payment → Zelle prints Zelle)", OFFLINE_METHOD_KEYS.every((m) => typeof PAYMENT_METHOD_LABELS[m] === "string"));
  ok("every enum value is classified for subcontractor payments", Object.keys(PAYMENT_METHOD_LABELS).every((m) => OUTBOUND_PAYMENT_METHODS.includes(m) || INBOUND_ONLY_PAYMENT_METHODS.includes(m)));
  ok("past-job import accepts every offline method", OFFLINE_METHOD_KEYS.every((m) => PAST_JOB_PAYMENT_METHODS.includes(m)));
  const schema = read("prisma/schema.prisma");
  const enumBody = schema.slice(schema.indexOf("enum PaymentMethod {"), schema.indexOf("}", schema.indexOf("enum PaymentMethod {")));
  ok("the schema enum carries zelle, venmo, cash_app, check, ach and paypal", ["zelle", "venmo", "cash_app", "check", "ach", "paypal"].every((v) => new RegExp(`^\\s*${v}\\s*$`, "m").test(enumBody)));
  ok("Company.paymentMethodDetails and Invoice.howToPay exist", /paymentMethodDetails\s+Json\?/.test(schema) && /howToPay\s+Json\?/.test(schema));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Every label and sentence, in every document language");
// ═══════════════════════════════════════════════════════════════════════════
{
  const en = OFFLINE_METHOD_COPY.en;
  const keys = Object.keys(en);
  for (const lang of OFFLINE_METHOD_LANGUAGES) {
    const t = OFFLINE_METHOD_COPY[lang];
    const missing = keys.filter((k) => !(k in (t || {})));
    ok(`${lang}: every copy key present`, t && missing.length === 0, missing);
    ok(`${lang}: a label for every method`, t && OFFLINE_METHOD_KEYS.every((m) => typeof t.labels[m] === "string" && t.labels[m].trim()));
    ok(`${lang}: same shape as English (function ↔ function)`, t && keys.every((k) => typeof t[k] === typeof en[k]));
    ok(`${lang}: the reference sentence carries the reference`, t && t.reference("INV-42").includes("INV-42"));
    ok(`${lang}: the e-transfer sentence carries the address`, t && t.e_transfer("pay@x.ca").includes("pay@x.ca"));
    ok(`${lang}: the ACH sentence carries bank, routing and account`, t && ["Chase", "021000021", "12345"].every((v) => t.ach("Chase", "021000021", "12345").includes(v)));
  }
  ok("the eight document languages are the eight the catalogue covers", JSON.stringify(OFFLINE_METHOD_LANGUAGES) === JSON.stringify(Object.keys(OFFLINE_METHOD_COPY)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The US default is read as the US list; the demo spelling is read as the catalogue's");
// ═══════════════════════════════════════════════════════════════════════════
{
  const usDefault = enabledMethods({ country: "US", paymentMethods: ["cash", "e_transfer", "cheque"] });
  ok("US + schema default → check, cash (e_transfer dropped, cheque → check)", JSON.stringify(usDefault) === JSON.stringify(["check", "cash"]), usDefault);
  const caDefault = enabledMethods({ country: "CA", paymentMethods: ["cash", "e_transfer", "cheque"] });
  ok("CA + schema default → e_transfer, cheque, cash, in display order", JSON.stringify(caDefault) === JSON.stringify(["e_transfer", "cheque", "cash"]), caDefault);
  const demo = enabledMethods({ country: "CA", paymentMethods: ["card", "etransfer", "cheque"] });
  ok("the demo seed's old spelling: card dropped, etransfer → e_transfer", JSON.stringify(demo) === JSON.stringify(["e_transfer", "cheque"]), demo);
  const noCol = enabledMethods({ country: null, address: "1 Main St, Ottawa, ON K1A 0B1, Canada", paymentMethods: ["e_transfer"] });
  ok("no country column: the address decides (Canada keeps e-transfer)", JSON.stringify(noCol) === JSON.stringify(["e_transfer"]), noCol);
  const usNoCol = enabledMethods({ country: null, address: "1 Main St, Austin, TX 78701, USA", paymentMethods: ["e_transfer", "cheque"] });
  ok("no country column, US address: e-transfer gone, cheque read as check", JSON.stringify(usNoCol) === JSON.stringify(["check"]), usNoCol);
  ok("sanitiseMethods: not a list → null; empty list → []; a foreign method → dropped", sanitiseMethods("x", "CA") === null && sanitiseMethods([], "CA").length === 0 && JSON.stringify(sanitiseMethods(["zelle", "cash", "cash"], "CA")) === JSON.stringify(["cash"]));
  ok("the demo seed no longer writes the old spelling", !/\["card",\s*"etransfer",\s*"cheque"\]/.test(code(read("lib/demo/seedContent.js"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Details: required when on, cleaned, refused in a sentence");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("e-transfer on, no address → the sentence", validateDetails("e_transfer", {}, { enabled: true }).error === "E-transfer is on but has no address.");
  ok("e-transfer off, no address → fine (an old address may stay on file)", !validateDetails("e_transfer", {}, { enabled: false }).error);
  ok("e-transfer with a phone number is accepted", validateDetails("e_transfer", { address: "(613) 555-0100" }).details.address === "(613) 555-0100");
  ok("e-transfer with neither an email nor a phone is refused", /email address or a phone number/.test(validateDetails("e_transfer", { address: "my cousin" }).error || ""));
  ok("Venmo @ is stripped; Cash App $ is stripped", validateDetails("venmo", { handle: "@acme-paint" }).details.handle === "acme-paint" && validateDetails("cash_app", { cashtag: "$Acme" }).details.cashtag === "Acme");
  ok("a Venmo handle with spaces is refused", Boolean(validateDetails("venmo", { handle: "acme paint" }).error));
  ok("routing number checksum: 021000021 passes, 021000012 fails", validRoutingNumber("021000021") && !validRoutingNumber("021000012"));
  ok("ACH with a bad routing number is refused", /routing number/.test(validateDetails("ach", { bankName: "Chase", routingNumber: "021000012", accountNumber: "1234" }).error || ""));
  ok("ACH missing the account number is refused by name", validateDetails("ach", { bankName: "Chase", routingNumber: "021000021" }).error === "Bank transfer (ACH) is on but has no account number.");
  ok("PayPal accepts an email or a PayPal.Me link and nothing else", !validateDetails("paypal", { address: "paypal.me/acme" }).error && !validateDetails("paypal", { address: "pay@acme.ca" }).error && Boolean(validateDetails("paypal", { address: "acme" }).error));
  ok("unknown keys are dropped; autoDeposit is a boolean", JSON.stringify(validateDetails("e_transfer", { address: "pay@acme.ca", autoDeposit: "true", junk: "x" }).details) === JSON.stringify({ address: "pay@acme.ca", autoDeposit: true }));
  ok("the whole object: a method the country lacks is dropped silently", !("zelle" in validateAllDetails({ e_transfer: { address: "pay@acme.ca" }, zelle: { address: "x" } }, { country: "CA", enabled: ["e_transfer"] }).details));
  ok("the whole object: an ON method's missing detail refuses the save", /is on but has no/.test(validateAllDetails({}, { country: "US", enabled: ["zelle"] }).error || ""));
  ok("the whole object: nothing on, nothing typed → ok, empty", JSON.stringify(validateAllDetails(undefined, { country: "US", enabled: [] })) === JSON.stringify({ details: {} }));
  ok("no error sentence ever echoes a secret value", !/021000012|1234/.test(validateDetails("ach", { bankName: "Chase", routingNumber: "021000012", accountNumber: "1234" }).error || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Settings → Payments, the real PATCH route");
// ═══════════════════════════════════════════════════════════════════════════
const OWNER = { id: "m_1", userId: "u_1", companyId: "co_1", role: "owner" };
function seedCompany(over = {}) {
  resetDbStub();
  rows.user = [{ id: "u_1", name: "Owner", email: "owner@acme.test" }];
  rows.member = [OWNER];
  rows.company = [{ id: "co_1", name: "Acme Painting", country: "CA", currency: "CAD", paymentMethods: ["cash", "e_transfer", "cheque"], paymentMethodDetails: null, servesAbroad: false, latitude: 1, longitude: 1, ...over }];
  session.member = OWNER;
}
async function patch(body) {
  const res = await settingsPatch({ json: async () => body, headers: { get: () => null } });
  return { status: res.status, body: await res.json() };
}
{
  seedCompany();
  let r = await patch({ paymentMethods: ["cash", "e_transfer"], paymentMethodDetails: {} });
  ok("e-transfer on without an address → 400 with the sentence", r.status === 400 && r.body.error === "E-transfer is on but has no address.", r);
  ok("…and nothing was written", !writes.some((w) => w.model === "company"));

  seedCompany();
  r = await patch({ paymentMethods: ["cash", "e_transfer"] });
  ok("details left out of the body: the stored (empty) ones are judged → still refused", r.status === 400 && /E-transfer is on but has no address/.test(r.body.error), r);

  seedCompany();
  r = await patch({ paymentMethods: ["e_transfer", "cash"], paymentMethodDetails: { e_transfer: { address: " pay@acme.ca ", securityQuestion: "Invoice?", securityAnswer: "paint" } } });
  let w = writes.find((x) => x.model === "company" && x.action === "update");
  ok("with an address → 200 and the write carries methods + trimmed details", r.status === 200 && w && JSON.stringify(w.data.paymentMethods) === JSON.stringify(["e_transfer", "cash"]) && w.data.paymentMethodDetails.e_transfer.address === "pay@acme.ca", w?.data);
  const log = writes.find((x) => x.model === "activityLog");
  ok("the activity log records field names only, never the address", log && !JSON.stringify(log.data).includes("pay@acme.ca") && JSON.stringify(log.data.metadata.fields).includes("paymentMethodDetails"), log?.data);

  seedCompany({ country: "US" });
  r = await patch({ paymentMethods: ["cash", "e_transfer", "cheque"] });
  w = writes.find((x) => x.model === "company" && x.action === "update");
  ok("a US company saving the Canadian default stores check + cash", r.status === 200 && w && JSON.stringify(w.data.paymentMethods) === JSON.stringify(["check", "cash"]), w?.data || r);

  seedCompany({ country: "US" });
  r = await patch({ paymentMethods: ["zelle", "venmo"], paymentMethodDetails: { zelle: { address: "512-555-0100" }, venmo: { handle: "@acme" } } });
  w = writes.find((x) => x.model === "company" && x.action === "update");
  ok("US: Zelle by phone + Venmo → stored, @ stripped", r.status === 200 && w?.data.paymentMethodDetails.venmo.handle === "acme" && w?.data.paymentMethodDetails.zelle.address === "512-555-0100", w?.data || r);

  seedCompany({ country: "US" });
  r = await patch({ paymentMethods: ["ach"], paymentMethodDetails: { ach: { bankName: "Chase", routingNumber: "021000012", accountNumber: "12345678" } } });
  ok("US: a routing number with a bad check digit → 400, and the number is not echoed", r.status === 400 && /routing number/.test(r.body.error) && !r.body.error.includes("021000012"), r);

  seedCompany({ country: "US" });
  r = await patch({ paymentMethods: ["e_transfer", "zelle"], paymentMethodDetails: { zelle: { address: "pay@acme.com" } } });
  w = writes.find((x) => x.model === "company" && x.action === "update");
  ok("US: e_transfer in the body is dropped, not stored", r.status === 200 && JSON.stringify(w?.data.paymentMethods) === JSON.stringify(["zelle"]), w?.data || r);

  seedCompany();
  r = await patch({ paymentMethods: "cash" });
  ok("a non-list is refused, not treated as 'clear'", r.status === 400, r);

  seedCompany();
  r = await patch({ paymentMethods: [] , paymentMethodDetails: {} });
  w = writes.find((x) => x.model === "company" && x.action === "update");
  ok("an empty list is a real answer: nothing on", r.status === 200 && Array.isArray(w?.data.paymentMethods) && w.data.paymentMethods.length === 0, w?.data || r);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. buildHowToPay: only what is on, with what was typed, in the document's language");
// ═══════════════════════════════════════════════════════════════════════════
const CA_CO = {
  name: "Acme Painting", country: "CA", currency: "CAD", brandColor: "#06356b",
  paymentMethods: ["e_transfer", "cheque", "cash", "paypal"],
  paymentMethodDetails: { e_transfer: { address: "pay@acme.ca", autoDeposit: true }, cheque: { mailingAddress: "12 Rue X\nMontréal QC" } },
  stripeAccountId: "acct_1", stripeChargesEnabled: true, stripeBankDebitEnabled: true, offerFinancing: true, stripeAffirmStatus: "active",
};
const US_CO = {
  name: "Lone Star Roofing", country: "US", currency: "USD", brandColor: "#b91c1c",
  paymentMethods: ["zelle", "ach", "check", "cash"],
  paymentMethodDetails: { zelle: { address: "512-555-0100" }, ach: { bankName: "Chase", routingNumber: "021000021", accountNumber: "12345678" }, check: { payee: "Lone Star Roofing LLC" } },
  stripeAccountId: "acct_2", stripeChargesEnabled: true, stripeBankDebitEnabled: false, offerFinancing: false, stripeAffirmStatus: null,
};
{
  const b = buildHowToPay({ company: CA_CO, language: "en", reference: "INV-1001", online: onlineOptions(CA_CO, "https://app.fieldquo.com/portal/t/invoices/i1") });
  ok("methods rendered = methods on, minus PayPal (on but no address → still listed, label only)", JSON.stringify(b.methods.map((m) => m.method)) === JSON.stringify(["e_transfer", "paypal", "cheque", "cash"]), b.methods.map((m) => m.method));
  ok("PayPal without an address prints its label and NO invented address", b.methods.find((m) => m.method === "paypal").lines.length === 0);
  ok("e-transfer: the address, the auto-deposit note, the reference", JSON.stringify(b.methods[0].lines) === JSON.stringify(["Send an Interac e-Transfer to pay@acme.ca.", "Auto-deposit is on — no security question needed.", "Use INV-1001 as the reference."]), b.methods[0].lines);
  ok("cheque: payable to the company name, mailed to the typed address (newlines folded)", JSON.stringify(b.methods.find((m) => m.method === "cheque").lines) === JSON.stringify(["Make cheques payable to Acme Painting.", "Mail to 12 Rue X, Montréal QC."]), b.methods.find((m) => m.method === "cheque").lines);
  ok("online: card, bank debit and Affirm named, with the URL", b.online.line === "Pay online by card, bank debit or Affirm (pay over time)" && b.online.at.includes("https://app.fieldquo.com/portal/t/invoices/i1"));
  ok("the security question prints only without auto-deposit", buildHowToPay({ company: { ...CA_CO, paymentMethodDetails: { e_transfer: { address: "pay@acme.ca", securityQuestion: "Colour?", securityAnswer: "blue" } } }, language: "en", reference: "INV-1" }).methods[0].lines[1] === "Security question: Colour? · Answer: blue");
  const off = buildHowToPay({ company: { ...CA_CO, paymentMethods: ["cash"] }, language: "en", reference: "INV-1" });
  ok("a method switched off does not print even though its details are on file", off.methods.length === 1 && off.methods[0].method === "cash");
  ok("nothing on and no link → null (no heading over an empty list)", buildHowToPay({ company: { ...CA_CO, paymentMethods: [] }, language: "en" }) === null);
  const us = buildHowToPay({ company: US_CO, language: "en", reference: "INV-7", online: onlineOptions(US_CO, "https://x/pay") });
  ok("US: Zelle, ACH, check, cash — no Interac anywhere", JSON.stringify(us.methods.map((m) => m.method)) === JSON.stringify(["zelle", "ach", "check", "cash"]) && !JSON.stringify(us).includes("Interac"));
  ok("US: check made out to the typed payee", us.methods.find((m) => m.method === "check").lines[0] === "Make checks payable to Lone Star Roofing LLC.");
  ok("US: ACH is document-only and carries the numbers", us.methods.find((m) => m.method === "ach").documentOnly && us.methods.find((m) => m.method === "ach").lines[0].includes("021000021"));
  ok("US: the online line names card only (no bank debit, no Affirm) ", us.online.line === "Pay online by card");
  for (const lang of OFFLINE_METHOD_LANGUAGES) {
    const x = buildHowToPay({ company: CA_CO, language: lang, reference: "INV-1001", online: onlineOptions(CA_CO, "https://x/p") });
    ok(`${lang}: title, online line and every method line render with the address and reference`, x.language === lang && x.title && x.online.line && x.methods[0].lines.some((l) => l.includes("pay@acme.ca")) && x.methods[0].lines.some((l) => l.includes("INV-1001")));
  }
  ok("an unknown language falls back to English but says so", buildHowToPay({ company: CA_CO, language: "zz" }).language === "en");
  const dep = depositHowToPay({ data: { quoteNumber: "Q-9" }, company: CA_CO, language: "fr", schedule: parsePaymentSchedule("50% deposit, 50% on completion") });
  ok("a quote with a schedule gets the deposit block: quote number as reference, online line without a URL", dep && dep.reference === "Q-9" && dep.online.line.startsWith("Payez en ligne") && dep.online.at === "" && dep.methods[0].lines.some((l) => l.includes("Q-9")));
  ok("a quote with no schedule gets none; an invoice never gets one here", depositHowToPay({ data: { quoteNumber: "Q-9" }, company: CA_CO, language: "fr", schedule: null }) === null && depositHowToPay({ data: { invoiceNumber: "INV-1" }, company: CA_CO, language: "fr", schedule: [{}] }) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Stored at send, immutable after");
// ═══════════════════════════════════════════════════════════════════════════
{
  const stored = buildHowToPay({ company: CA_CO, language: "fr", reference: "INV-2", online: onlineOptions(CA_CO, "https://x/p") });
  const changed = { ...CA_CO, paymentMethods: ["cash"], paymentMethodDetails: { e_transfer: { address: "new@acme.ca" } } };
  const later = howToPayFor({ invoiceNumber: "INV-2", howToPay: stored }, { company: changed, language: "en" });
  ok("howToPayFor: the stored block wins over changed settings and a different language", later === stored && later.language === "fr" && later.methods[0].lines[0].includes("pay@acme.ca"));
  ok("howToPayFor: no stored block → built live", howToPayFor({ invoiceNumber: "INV-3" }, { company: changed, language: "en" }).methods.length === 1);
  const pdfBlock = howToPayBlock({ data: { invoiceNumber: "INV-2", total: 100, amountPaid: 0, howToPay: stored }, company: changed, language: "en" });
  ok("the PDF section prints the stored block", pdfBlock === stored);
  ok("the PDF section prints nothing on a paid invoice", howToPayBlock({ data: { invoiceNumber: "INV-2", total: 100, amountPaid: 100, howToPay: stored }, company: CA_CO, language: "en" }) === null);
  const send = code(read("app/api/invoices/[id]/send/route.js"));
  ok("the send route builds the block from the company at send time…", /buildHowToPay\(\{/.test(send) && /paymentMethodDetails:\s*true/.test(send));
  ok("…hands it to the email…", /howToPay,\s*\n/.test(send) || /howToPay,\s*$/m.test(send));
  ok("…and writes it on the FIRST send only", /!invoice\.howToPay && howToPay \? \{ howToPay \}/.test(send));
  ok("…keeping a stored block when one exists", /invoice\.howToPay && typeof invoice\.howToPay === "object"/.test(send));
  ok("the send route stores the plain invoice link, not the stage link", /plainInvoiceUrl\)/.test(send) && /reference: invoice\.invoiceNumber/.test(send));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The invoice email: the address, never the bank account");
// ═══════════════════════════════════════════════════════════════════════════
{
  const invoice = { invoiceNumber: "INV-7", total: 1200, amountPaid: 0, dueDate: null, lineItems: [], customFields: [] };
  const client = { name: "Jane Doe", email: "jane@x.test" };
  const url = "https://app.fieldquo.com/portal/t/invoices/i7";
  const { html, text } = buildInvoiceEmail({ invoice, client, company: US_CO, url, canTakeCard: true, language: "en" });
  ok("the email carries the How to pay heading and the Zelle number", html.includes("HOW TO PAY") && html.includes("512-555-0100") && text.includes("512-555-0100"));
  ok("the email never carries the ACH routing or account number", !html.includes("021000021") && !html.includes("12345678") && !text.includes("021000021") && !text.includes("12345678"));
  ok("…and says the bank details are on the invoice instead", html.includes("Bank transfer details are on the invoice.") && text.includes("Bank transfer details are on the invoice."));
  ok("the check line names the payee", html.includes("Make checks payable to Lone Star Roofing LLC."));
  const paid = buildInvoiceEmail({ invoice: { ...invoice, amountPaid: 1200 }, client, company: US_CO, url, canTakeCard: true, language: "en", kind: "paid" });
  ok("a receipt (kind: paid) carries no How to pay block", !paid.html.includes("HOW TO PAY") && !paid.text.includes("HOW TO PAY"));
  const fr = buildInvoiceEmail({ invoice: { ...invoice, howToPay: buildHowToPay({ company: CA_CO, language: "fr", reference: "INV-7", online: onlineOptions(CA_CO, url) }) }, client, company: US_CO, url, canTakeCard: true, language: "en" });
  ok("a stored block is printed as stored (French, Canadian) even when the caller's company and language differ", fr.html.includes("COMMENT PAYER") && fr.html.includes("pay@acme.ca") && !fr.html.includes("Zelle"));
  const passed = buildInvoiceEmail({ invoice, client, company: US_CO, url, canTakeCard: true, language: "en", howToPay: null });
  ok("howToPay: null from the caller → no block", !passed.html.includes("HOW TO PAY"));
  const emailSrc = code(read("lib/email/invoiceEmail.js"));
  ok("the old bare 'Accepted:' sentence is gone from the email", !/c\.accepted\(/.test(emailSrc) && !/methodsSentence/.test(emailSrc));
  ok("…and from the payment-terms section", !/Accepted:/.test(code(read("lib/documentSections/PaymentTermsSection.js"))));
  ok("emailLinesFor: a document-only method becomes the on-the-invoice sentence in the block's own language", emailLinesFor({ language: "es" }, { documentOnly: true, lines: ["x"] })[0] === "Los datos bancarios están en la factura.");
  const h = howToPayEmailHtml(buildHowToPay({ company: { ...CA_CO, name: "A <b>&</b> Co" }, language: "en", reference: "INV-<1>" }), { theme: documentTheme(CA_CO) });
  ok("the email HTML escapes what the company typed", !h.includes("<b>") && h.includes("&lt;b&gt;") && h.includes("INV-&lt;1&gt;"));
  ok("the plain-text twin lists every method", howToPayEmailText(buildHowToPay({ company: US_CO, language: "en", reference: "INV-7" })).some((l) => l.startsWith("Zelle:")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The PDF: rendered, decoded, the block is on the page");
// ═══════════════════════════════════════════════════════════════════════════
function pdfText(buf) {
  const raw = buf.toString("latin1");
  const objs = new Map();
  for (const m of raw.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objs.set(Number(m[1]), m[2]);
  const streamOf = (body) => {
    const m = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
    if (!m) return null;
    const bytes = Buffer.from(m[1], "latin1");
    try { return zlib.inflateSync(bytes).toString("latin1"); } catch { return m[1]; }
  };
  // bfchar AND bfrange, as check-pdf-fonts.mjs reads them: a ligature glyph
  // (ffi in "Affirm", fi in "fieldquo") is one bfchar mapping to three
  // code points, and a pair-only scan mis-reads a bfrange as two chars.
  const parseCMap = (t) => {
    const map = new Map();
    const chars = (hex) => {
      let out = "";
      for (let i = 0; i + 3 < hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
      return out;
    };
    for (const block of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(m[1].toLowerCase(), chars(m[2]));
    }
    for (const block of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        const lo = parseInt(m[1], 16);
        const hi = parseInt(m[2], 16);
        const dst = parseInt(m[3], 16);
        for (let c = lo; c <= hi; c++) map.set(c.toString(16).padStart(4, "0"), String.fromCodePoint(dst + (c - lo)));
      }
    }
    return map;
  };
  const fonts = new Map();
  for (const [, body] of objs) {
    const fd = body.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (!fd) continue;
    for (const e of fd[1].matchAll(/\/(\w+)\s+(\d+) 0 R/g)) {
      const type0 = objs.get(Number(e[2])) || "";
      const toUni = type0.match(/\/ToUnicode\s+(\d+) 0 R/)?.[1];
      const cmap = toUni ? streamOf(objs.get(Number(toUni)) || "") : null;
      fonts.set(e[1], cmap ? parseCMap(cmap) : null);
    }
  }
  let out = "";
  for (const [, body] of objs) {
    const content = streamOf(body);
    if (!content || !/\bBT\b/.test(content)) continue;
    let current = null;
    for (const tok of content.matchAll(/\/(\w+)\s+[\d.]+\s+Tf|\[([\s\S]*?)\]\s*TJ|<([0-9A-Fa-f]+)>\s*Tj/g)) {
      if (tok[1] !== undefined) { current = fonts.get(tok[1]) || null; continue; }
      const hexes = [...(tok[2] ?? tok[3] ?? "").matchAll(/<([0-9A-Fa-f]+)>/g)].map((h) => h[1]);
      for (const hex of hexes) {
        for (const g of hex.match(/.{4}/g) || []) out += current?.get(g.toLowerCase()) ?? "";
      }
      out += " ";
    }
  }
  return out.replace(/\s+/g, " ");
}
// Noto Sans ligates ffi/ffl/ff/fi/fl into glyphs that have no ToUnicode
// entry (see check-pdf-fonts.mjs), so "Affirm" reads back as "Arm" and
// "fieldquo" as "eldquo". Both sides of a comparison drop those clusters.
const unlig = (s) => String(s).replace(/ffi|ffl|ff|fi|fl/g, "");
const onPage = (txt, needle) => txt.includes(needle) || txt.includes(unlig(needle));
{
  const sections = getDefaultSections("invoice_pdf");
  ok("the default invoice layout carries how_to_pay after the payments received", sections.findIndex((s) => s.type === "how_to_pay") === sections.findIndex((s) => s.type === "payment_summary") + 1);
  ok("the registry renders how_to_pay; the editor offers it for invoices only", Boolean(SECTION_REGISTRY.how_to_pay?.PdfSection) && SECTION_META.how_to_pay?.types?.join() === "invoice_pdf" && sectionsForType("invoice_pdf").includes("how_to_pay") && !sectionsForType("quote_pdf").includes("how_to_pay"));
  const invoice = { invoiceNumber: "INV-2026-0042", total: 4250, subtotal: 4000, tax: 250, amountPaid: 0, lineItems: [{ description: "Exterior repaint — front elevation", quantity: 1, amount: 4000 }], scopeGroups: [{ label: "Work completed", lineItems: [{ description: "Exterior repaint — front elevation", quantity: 1, unitPrice: 4000, amount: 4000, total: 4000 }], subtotal: 4000 }], notes: "Thank you for choosing us.", dueDate: new Date("2026-10-15"), createdAt: new Date("2026-09-20"), sentAt: new Date("2026-09-20"), client: { name: "Jane Doe", address: "42 Maple St, Ottawa ON" }, customFields: [], payments: [] };
  const stored = buildHowToPay({ company: CA_CO, language: "en", reference: "INV-2026-0042", online: onlineOptions(CA_CO, "https://app.fieldquo.com/portal/tok/invoices/inv1") });
  const buf = await renderDocumentPdfBuffer({ sections, data: { ...invoice, howToPay: stored }, company: { ...CA_CO, address: "1 Main St", city: "Ottawa", province: "ON", phone: "613-555-0100", email: "hi@acme.ca" }, language: "en" });
  const txt = pdfText(buf);
  ok("a PDF renders", buf?.length > 1000);
  ok("HOW TO PAY is on the page", txt.includes("HOW TO PAY"), txt.slice(0, 400));
  ok("the e-transfer address and the reference are on the page", txt.includes("pay@acme.ca") && txt.includes("INV-2026-0042 as the reference"));
  ok("the online line and its URL are on the page", onPage(txt, "Pay online by card, bank debit or Affirm") && onPage(txt, "app.fieldquo.com/portal/tok/invoices/inv1"), txt.slice(txt.indexOf("HOW TO PAY"), txt.indexOf("HOW TO PAY") + 500));
  ok("cheque and cash rows are on the page", txt.includes("Make cheques payable to Acme Painting") && txt.includes("Cash, in person"));
  if (process.env.HOWTOPAY_PDF) {
    writeFileSync(process.env.HOWTOPAY_PDF, buf);
    console.log(`  wrote ${process.env.HOWTOPAY_PDF}`);
  }
  const usBuf = await renderDocumentPdfBuffer({ sections, data: { ...invoice, howToPay: null }, company: US_CO, language: "en" });
  const usTxt = pdfText(usBuf);
  ok("a US invoice with no stored block builds one live: ACH numbers ARE on the PDF", usTxt.includes("021000021") && usTxt.includes("12345678") && usTxt.includes("Zelle"));
  const paidBuf = await renderDocumentPdfBuffer({ sections, data: { ...invoice, amountPaid: 4250, howToPay: stored }, company: CA_CO, language: "en" });
  ok("a paid invoice's PDF has no HOW TO PAY", !pdfText(paidBuf).includes("HOW TO PAY"));
  const frBuf = await renderDocumentPdfBuffer({ sections, data: { ...invoice, howToPay: buildHowToPay({ company: CA_CO, language: "fr", reference: "INV-2026-0042" }) }, company: CA_CO, language: "fr" });
  ok("a French invoice prints COMMENT PAYER and the French sentence", pdfText(frBuf).includes("COMMENT PAYER") && pdfText(frBuf).includes("Envoyez un virement Interac"));
  // The quote: a schedule under payment_terms carries the deposit block.
  const qSections = getDefaultSections("quote_pdf");
  const qBuf = await renderDocumentPdfBuffer({ sections: qSections, data: { quoteNumber: "Q-2026-0011", total: 8000, subtotal: 8000, tax: 0, lineItems: [], scopeGroups: [], client: { name: "Jane Doe" }, customFields: [], createdAt: new Date(), validUntil: null }, company: { ...CA_CO, paymentTerms: "50% deposit, 50% on completion" }, language: "en" });
  const qTxt = pdfText(qBuf);
  ok("a quote with a deposit schedule prints how to pay it, with the quote number", qTxt.includes("HOW TO PAY") && qTxt.includes("pay@acme.ca") && qTxt.includes("Q-2026-0011"));
  const qBuf2 = await renderDocumentPdfBuffer({ sections: qSections, data: { quoteNumber: "Q-2", total: 8000, subtotal: 8000, tax: 0, lineItems: [], scopeGroups: [], client: { name: "Jane" }, customFields: [], createdAt: new Date() }, company: { ...CA_CO, paymentTerms: "Net 30" }, language: "en" });
  ok("a quote with no schedule prints the terms as written and no block", !pdfText(qBuf2).includes("HOW TO PAY") && pdfText(qBuf2).includes("Net 30"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The client portal: the rendered block ships, the settings do not");
// ═══════════════════════════════════════════════════════════════════════════
{
  resetDbStub();
  const stored = buildHowToPay({ company: US_CO, language: "es", reference: "INV-9", online: onlineOptions(US_CO, "https://x/p") });
  rows.client = [{
    portalToken: "tok-1", name: "Jane", language: "en", country: "US", province: "TX", companyId: "co_2",
    company: { ...US_CO, logoUrl: null, phone: "", email: "", taxIdName: null, taxIdNumber: null, defaultLanguage: "en", province: "TX", taxRate: 0, autoApplyLocalTax: false, vatRegistered: null, usTaxOverrides: null, address: "1 Main St, Austin, TX" },
    quotes: [],
    invoices: [
      { id: "inv_a", parentInvoiceId: null, version: 1, invoiceNumber: "INV-9", total: 100, amountPaid: 0, dueDate: null, lineItems: [], notes: null, subtotal: 100, discount: 0, tax: 0, taxEnabled: false, taxResolution: null, createdAt: new Date(), pendingPaymentMethod: null, pendingPaymentAt: null, pendingPaymentFailedAt: null, pendingPaymentFailure: null, howToPay: stored, language: "es", jobPaymentStages: [] },
      { id: "inv_b", parentInvoiceId: null, version: 1, invoiceNumber: "INV-10", total: 100, amountPaid: 0, dueDate: null, lineItems: [], notes: null, subtotal: 100, discount: 0, tax: 0, taxEnabled: false, taxResolution: null, createdAt: new Date(), pendingPaymentMethod: null, pendingPaymentAt: null, pendingPaymentFailedAt: null, pendingPaymentFailure: null, howToPay: null, language: null, jobPaymentStages: [] },
    ],
  }];
  rows.invoice = [{ id: "inv_a", parentInvoiceId: null, version: 1 }, { id: "inv_b", parentInvoiceId: null, version: 1 }];
  rows.payment = [];
  let res;
  try {
    res = await portalGet({ headers: { get: () => null } }, { params: Promise.resolve({ token: "tok-1" }) });
  } catch (err) {
    res = { status: 500, json: async () => ({ error: String(err?.message || err) }) };
  }
  const body = await res.json();
  ok("the portal route executes", res.status === 200, body);
  const a = body?.invoices?.find((i) => i.id === "inv_a");
  const b = body?.invoices?.find((i) => i.id === "inv_b");
  ok("a sent invoice ships its STORED block (Spanish, as sent)", a?.howToPay === undefined ? false : a.howToPay.language === "es" && a.howToPay.reference === "INV-9", a?.howToPay);
  ok("an invoice with none ships one built live in the client's language", b?.howToPay?.language === "en" && b.howToPay.methods.some((m) => m.method === "zelle"), b?.howToPay);
  ok("the company payload carries no paymentMethods, paymentMethodDetails, offerFinancing, stripeAffirmStatus or address", body?.company && ["paymentMethods", "paymentMethodDetails", "offerFinancing", "stripeAffirmStatus", "stripeAccountId", "address"].every((k) => !(k in body.company)), Object.keys(body?.company || {}));
  ok("the select spreads HOW_TO_PAY_COMPANY_SELECT rather than a hand-listed copy", /\.\.\.HOW_TO_PAY_COMPANY_SELECT/.test(code(read("app/api/portal/[token]/route.js"))));
  const quoteRoute = code(read("app/api/public/quotes/[token]/route.js"));
  ok("the public quote route builds the deposit block server-side and strips the settings", /howToPay: depositHowToPay\(/.test(quoteRoute) && /paymentMethodDetails: _paymentMethodDetails/.test(quoteRoute) && /\.\.\.HOW_TO_PAY_COMPANY_SELECT/.test(quoteRoute));
  ok("the public quote route does not load the PDF engine for the block", !/from "@\/lib\/documentSections\/PaymentTermsSection"/.test(quoteRoute));
  ok("the invoice email does not import a JSX module (plain-node checks read it)", !/documentSections\/HowToPaySection/.test(code(read("lib/email/invoiceEmail.js"))));
  ok("QuoteApproval and PortalInvoice paint HowToPayBlock", /HowToPayBlock/.test(read("app/q/[token]/QuoteApproval.js")) && /HowToPayBlock/.test(read("app/portal/[token]/invoices/[id]/PortalInvoice.js")));
  ok("every company select that emails an invoice spreads the shared select", ["app/api/invoices/[id]/request-payment/route.js", "lib/paymentSchedule/run.js", "lib/servicePlans/run.js"].every((f) => /\.\.\.HOW_TO_PAY_COMPANY_SELECT/.test(code(read(f)))));
  ok("the shared select names every column buildHowToPay reads", ["paymentMethods", "paymentMethodDetails", "country", "address", "name", "currency", "stripeBankDebitEnabled", "offerFinancing", "stripeAffirmStatus", "stripeAccountId", "stripeChargesEnabled"].every((k) => HOW_TO_PAY_COMPANY_SELECT[k] === true));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. Contrast, measured across hostile brand colours");
// ═══════════════════════════════════════════════════════════════════════════
{
  const BRANDS = ["#ffff00", "#ffffff", "#000000", "#808080", "#ff0000", "#00ff00", "#f5f5dc", "#06356b", "#e11d48", "#cccccc"];
  let worst = 21;
  for (const brandColor of BRANDS) {
    const t = documentTheme({ brandColor });
    const wash = washPair(t);
    const pairs = [
      ["online line on wash", wash.accent, wash.bg],
      ["online url on wash", wash.muted, wash.bg],
      ["method label on paper", t.ink, t.paper],
      ["method line on paper", t.inkMuted, t.paper],
      ["section label on paper", t.accentText, t.paper],
    ];
    for (const [name, fg, bg] of pairs) {
      const r = contrastRatio(fg, bg);
      worst = Math.min(worst, r);
      if (r < 4.5) ok(`${brandColor} ${name} ≥ 4.5:1`, false, r.toFixed(2));
    }
  }
  ok(`every pair the block paints clears 4.5:1 on ${BRANDS.length} brands (worst ${worst.toFixed(2)}:1)`, worst >= 4.5);
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. Settings card and help centre");
// ═══════════════════════════════════════════════════════════════════════════
{
  const card = code(read("app/app/settings/payments/PaymentMethodsCard.js"));
  ok("the card lists methodsForCountry(paymentCountry(company)) — never a fixed three", /methodsForCountry\(country\)/.test(card) && /paymentCountry\(company/.test(card) && !/\["cash",\s*"e_transfer",\s*"cheque"\]/.test(card));
  ok("each method is a switch, and its fields appear when on", /role="switch"/.test(card) && /on && spec\.fields\.length > 0/.test(card));
  ok("the card refuses before the route does, with the same sentence", /validateAllDetails\(state\.details/.test(card) && /disabled=\{saving \|\| !company \|\| !dirty \|\| Boolean\(problem\)\}/.test(card));
  ok("the card sends both columns in one save", /paymentMethods: state\.on, paymentMethodDetails: state\.details/.test(card));
  ok("the old options module is gone", (() => { try { readFileSync(join(ROOT, "lib/payments/paymentMethodOptions.js")); return false; } catch { return true; } })());
  for (const lang of ["en", "fr", "es"]) {
    const mod = read(`content/help/${lang}/invoices-and-payments-1.js`);
    const at = mod.indexOf('"offline-payment-methods": {');
    ok(`help centre ${lang}: the article exists and names the country rule`, at > 0 && /Zelle/.test(mod.slice(at)) && /Interac/.test(mod.slice(at)));
  }
  ok("the help tree lists the article against Settings → Payments and the matrix row", /A\("offline-payment-methods",[^)]*screen: "settings-payments"[^)]*feature: "offline_payment_methods"/.test(read("lib/help/tree.js")));
  ok("the feature matrix has the row, proved by the catalogue and the section", /key: "offline_payment_methods"/.test(read("lib/marketing/featureMatrix.js")) && /lib\/payments\/offlineMethods\.js/.test(read("lib/marketing/featureMatrix.js")));
  const recordPage = code(read("app/app/invoices/[id]/page.js"));
  ok("Record payment offers the country's methods, not a fixed three", /methodsForCountry\(paymentCountry\(company/.test(recordPage) && !/value="e_transfer"/.test(recordPage));
}

console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
