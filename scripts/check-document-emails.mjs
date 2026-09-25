// scripts/check-document-emails.mjs
//
// The document emails — quote, invoice, reminder, receipt, deposit — as
// originals a company can SEE and copies it can EDIT, without the original
// ever changing and without a copy ever touching the derived parts.
//
//   npm run check:document-emails
//
// Executed:
//   * the original's wording in token form is emailCopy's own sentence;
//   * an ACTIVE copy changes the five slots and nothing else — the HTML from
//     the button to the footer is byte-identical between original and copy;
//   * an inactive copy, or a copy in another language, is ignored;
//   * loadDocumentWording falls back per language against a fake db;
//   * the preview module runs the real builders against a fake db.
// Read:
//   * the wording module has no database; the copy routes can only write
//     rows with documentKind set and never write documentKind/language/type;
//   * every document-email sender passes `wording:`;
//   * the templates page mounts the group and the old subtitle is gone.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOCUMENT_EMAIL_KINDS,
  COPY_LANGUAGES,
  WORDING_SLOTS,
  originalWording,
  fillWording,
  sectionsFromSlots,
  slotsFromSections,
  chooseWording,
} from "../lib/email/documentEmailWording.js";
import { loadDocumentWording, updateDocumentEmailCopy, ensureDocumentEmailCopy } from "../lib/email/documentEmailCopies.js";
import { buildQuoteEmail } from "../lib/email/quoteEmail.js";
import { buildInvoiceEmail } from "../lib/email/invoiceEmail.js";
import { renderDocumentEmailPreview } from "../lib/email/documentEmailPreview.js";
import { emailCopy } from "../lib/i18n/emailCopy.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let failures = 0;
let checks = 0;
// Slot objects compared by value, whatever order their keys were built in.
const same = (a, b) => JSON.stringify(Object.fromEntries(Object.entries(a || {}).sort())) === JSON.stringify(Object.fromEntries(Object.entries(b || {}).sort()));
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}

const company = {
  name: "Acme Painting",
  phone: "555-0100",
  email: "hi@acme.test",
  brandColor: "#06356b",
  currency: "CAD",
  paymentMethods: ["e_transfer"],
  quoteEmailReferences: [],
  quoteEmailBeforeAfter: [],
  quoteEmailIncludeReferences: false,
  quoteEmailIncludeBeforeAfter: false,
  // Part of QUOTE_EMAIL_COMPANY_SELECT since 2026-09-22; buildQuoteEmail
  // refuses a company row that was selected without it. Null = a company that
  // has written no default "what happens next", which is a real state.
  defaultProcessNotes: null,
};
const quote = {
  quoteNumber: "Q-77",
  total: 4250,
  validUntil: null,
  // The stored line shape — description/amount — which is what the builder
  // reads. This fixture used to say name/total, so its line printed $0.00;
  // nothing below measured the figure, which is how the preview's sample
  // carried the same mistake unseen.
  lineItems: [{ description: "Doors", quantity: 2, unitPrice: 100, amount: 200 }],
  processNotes: null,
  emailReferences: null,
  emailBeforeAfter: null,
  emailIncludeReferences: null,
  emailIncludeBeforeAfter: null,
  customFields: [],
};
const client = { name: "Jane Doe", email: "jane@x.test" };

console.log("\nThe original, in token form\n");

for (const { kind } of DOCUMENT_EMAIL_KINDS) {
  for (const lang of COPY_LANGUAGES) {
    const o = originalWording(kind, lang);
    ok(`${kind}/${lang}: all five slots`, WORDING_SLOTS.every((s) => typeof o[s] === "string" && o[s].length > 0));
  }
}
{
  const c = emailCopy("fr");
  ok(
    "the original quote subject IS emailCopy's sentence with tokens in it",
    originalWording("quote", "fr").subject === c.quoteSubject("{{companyName}}", "{{quoteNumber}}"),
  );
  ok(
    "filling the tokens gives back what the original sends",
    fillWording(originalWording("quote", "fr").subject, { companyName: "Acme", quoteNumber: "Q-1" }) === c.quoteSubject("Acme", "Q-1"),
  );
  ok("an unknown token fills as nothing, not as braces", fillWording("Hi {{nope}}!", {}) === "Hi !");
  ok("sections round-trip the slots", same(slotsFromSections(sectionsFromSlots(originalWording("invoice", "en"))), originalWording("invoice", "en")));
}

console.log("\nCopy vs original — only the five slots move\n");

// The derived middle: from the first button to the footer's closing line
// (the closing and the signature are two of the five slots, so the footer
// is where the derived part ends).
function derivedPart(html) {
  const start = html.indexOf('<a href="https://x.test/q/1"');
  const end = html.lastIndexOf('<div style="padding-bottom:8px;">');
  return start > -1 && end > start ? html.slice(start, end) : null;
}
{
  const original = buildQuoteEmail({ quote, client, company, url: "https://x.test/q/1", language: "en" });
  const slots = { ...originalWording("quote", "en"), subject: "Here's your quote, {{clientName}} — {{quoteNumber}}", greeting: "Hello {{clientName}},", intro: "Custom intro for {{amount}}.", closing: "Ring {{companyPhone}} any time.", signature: "The Acme crew" };
  const copyRow = { isDefault: true, sections: sectionsFromSlots(slots), sentMode: "blocks", canvas: null };
  const withCopy = buildQuoteEmail({ quote, client, company, url: "https://x.test/q/1", language: "en", wording: chooseWording({ copy: copyRow }) });
  ok("copy changes the subject", withCopy.subject === "Here's your quote, Jane — Q-77", withCopy.subject);
  ok("copy changes greeting, intro, closing and signature", ["Hello Jane,", "Custom intro for", "Ring 555-0100 any time.", "The Acme crew"].every((s) => withCopy.html.includes(s)));
  ok("the intro shows the formatted amount, never a raw number the browser sent", /Custom intro for (CA)?\$4,250\.00/.test(withCopy.text), withCopy.text.split("\n")[2]);
  ok("the derived middle is byte-identical between original and copy", derivedPart(original.html) !== null && derivedPart(original.html) === derivedPart(withCopy.html));
  ok("a copy's wording is HTML-escaped", buildQuoteEmail({ quote, client, company, url: "https://x.test/q/1", language: "en", wording: chooseWording({ copy: { ...copyRow, sections: sectionsFromSlots({ ...slots, intro: "<script>x</script>" }) } }) }).html.includes("&lt;script&gt;"));

  const inactive = buildQuoteEmail({ quote, client, company, url: "https://x.test/q/1", language: "en", wording: chooseWording({ copy: { ...copyRow, isDefault: false } }) });
  ok("an inactive copy is ignored (Back to original)", inactive.subject === original.subject && inactive.html === original.html);
  const followUp = buildQuoteEmail({ quote: { ...quote, sentAt: new Date() }, client, company, url: "https://x.test/q/1", language: "en", kind: "follow_up", wording: chooseWording({ copy: copyRow }) });
  ok("the hand-sent follow-up keeps the original wording (the copy is of the quote email)", !followUp.html.includes("The Acme crew"));
}
{
  const invoice = { invoiceNumber: "INV-3", total: 1000, amountPaid: 250, dueDate: new Date("2026-10-01"), lineItems: [], customFields: [] };
  const base = { invoice, client, company, url: "https://x.test/p/1", canTakeCard: true, language: "fr" };
  const original = buildInvoiceEmail({ ...base, kind: "reminder" });
  const slots = { ...originalWording("reminder", "fr"), intro: "Petit rappel pour {{invoiceNumber}} : {{amount}}." };
  const withCopy = buildInvoiceEmail({ ...base, kind: "reminder", wording: chooseWording({ copy: { isDefault: true, sections: sectionsFromSlots(slots), sentMode: "blocks" } }) });
  ok("reminder copy changes the intro and keeps the subject", withCopy.html.includes("Petit rappel pour INV-3") && withCopy.subject === original.subject);
  const start = (h) => h.indexOf('<a href="https://x.test/p/1"');
  ok("reminder: amount block onwards identical", original.html.slice(start(original.html)).replace(/Acme Painting<\/div>/, "") === withCopy.html.slice(start(withCopy.html)).replace(/Acme Painting<\/div>/, ""));
  const receipt = buildInvoiceEmail({ ...base, invoice: { ...invoice, amountPaid: 1000 }, kind: "paid", wording: chooseWording({ copy: { isDefault: true, sections: sectionsFromSlots({ ...originalWording("receipt", "fr"), signature: "Merci — Acme" }), sentMode: "blocks" } }) });
  ok("receipt copy signs the footer", receipt.html.includes("Merci — Acme") && /Reçu/i.test(receipt.subject));
}

console.log("\nPer-language fallback (fake db)\n");

{
  const rows = [
    { id: "fr1", companyId: "c1", documentKind: "quote", language: "fr", isDefault: true, sections: sectionsFromSlots({ ...originalWording("quote", "fr"), greeting: "Salut {{clientName}}," }), sentMode: "blocks", canvas: null },
  ];
  const db = {
    documentTemplate: {
      async findFirst({ where }) {
        return rows.find((r) => r.companyId === where.companyId && r.documentKind === where.documentKind && r.language === where.language) || null;
      },
    },
  };
  const fr = await loadDocumentWording(db, { companyId: "c1", kind: "quote", language: "fr" });
  const en = await loadDocumentWording(db, { companyId: "c1", kind: "quote", language: "en" });
  const other = await loadDocumentWording(db, { companyId: "c2", kind: "quote", language: "fr" });
  ok("French quote reads the French copy", fr.source === "copy" && fr.slots.greeting === "Salut {{clientName}},");
  ok("English quote, no English copy → original", en.source === "original" && en.slots === null);
  ok("another company never sees it", other.source === "original");
  ok("a failing read falls back to the original", (await loadDocumentWording({ documentTemplate: { findFirst: async () => { throw new Error("boom"); } } }, { companyId: "c1", kind: "quote", language: "fr" })).source === "original");
  ok("an unknown kind is the original", (await loadDocumentWording(db, { companyId: "c1", kind: "nope", language: "fr" })).source === "original");
}

console.log("\nThe original is never written\n");

const wordingSrc = code(read("lib/email/documentEmailWording.js"));
ok("the wording module imports no database", !/lib\/db|prisma|\bdb\./.test(wordingSrc));
const copies = code(read("lib/email/documentEmailCopies.js"));
ok("copies are rows with documentKind set — the original is code", /documentKind: kind/.test(copies) && /originalWording\(/.test(copies));
{
  // updateDocumentEmailCopy never writes the identity of a copy.
  const writes = [];
  const db = { documentTemplate: { async update({ data }) { writes.push(data); return { id: "x", documentKind: "quote", language: "en", isDefault: true, sections: data.sections || sectionsFromSlots(originalWording("quote", "en")), sentMode: data.sentMode || "blocks", canvas: null, updatedAt: new Date() }; } } };
  const row = { id: "x", documentKind: "quote", language: "en", sections: sectionsFromSlots(originalWording("quote", "en")), canvas: { objects: [{ type: "textbox", text: "hi" }] } };
  await updateDocumentEmailCopy(db, row, { slots: { subject: "New", documentKind: "invoice" }, active: true, sentMode: "canvas", language: "fr", type: "quote_pdf" });
  const d = writes[0];
  ok("an edit writes slots, the switch and the mode only", "sections" in d && d.isDefault === true && d.sentMode === "canvas" && !("documentKind" in d) && !("language" in d) && !("type" in d));
  ok("switching mode does not clear the other body", !("canvas" in d) || d.canvas !== null);
  await updateDocumentEmailCopy(db, row, { reset: true });
  ok("reset re-copies the original's wording", same(slotsFromSections(writes[1].sections), originalWording("quote", "en")));
  ok("reset leaves the switch and the canvas alone", !("isDefault" in writes[1]) && !("canvas" in writes[1]));
  ok("a slot is capped so a copy can't be a novel", slotsFromSections(writes[0].sections).subject === "New");
}
{
  // ensureDocumentEmailCopy: seeded from the original, not switched on, idempotent.
  const created = [];
  const db = {
    documentTemplate: {
      async findFirst() { return created[0] || null; },
      async create({ data }) { const row = { id: "n", ...data, updatedAt: new Date() }; created.push(row); return row; },
    },
  };
  const a = await ensureDocumentEmailCopy(db, { companyId: "c1", kind: "receipt", language: "es" });
  const b = await ensureDocumentEmailCopy(db, { companyId: "c1", kind: "receipt", language: "es" });
  ok("Customise seeds a copy from the original, switched OFF", a.active === false && a.slots.subject === originalWording("receipt", "es").subject && created[0].type === "receipt_email");
  ok("Customise twice returns the same copy", created.length === 1 && b.id === a.id);
  let refused = false;
  try { await ensureDocumentEmailCopy(db, { companyId: "c1", kind: "receipt", language: "uk" }); } catch { refused = true; }
  ok("a copy can only be written in EN, FR or ES", refused);
}
const itemRoute = code(read("app/api/settings/document-emails/[id]/route.js"));
ok("the copy route can only reach rows with documentKind set", /documentKind: \{ not: null \}/.test(itemRoute));
ok("the copy route refuses a canvas switch with nothing drawn", /Draw the letter on the canvas/.test(itemRoute));
ok("no route deletes or updates an original (there is no original row to reach)", !/originalWording[\s\S]*update\(/.test(itemRoute));

console.log("\nThe senders pass wording\n");

for (const [file, kinds] of [
  ["app/api/quotes/[id]/send/route.js", ['kind: "quote"']],
  ["app/api/invoices/[id]/send/route.js", ['ask.stage ? "deposit" : "invoice"']],
  ["app/api/invoices/[id]/request-payment/route.js", ['kind: "reminder"']],
  ["lib/invoices/lifecycle.js", []],
  ["lib/servicePlans/run.js", ['kind === "paid" ? "receipt" : "invoice"']],
  ["lib/paymentSchedule/run.js", ['kind: "deposit"']],
]) {
  const src = code(read(file));
  if (kinds.length === 0) continue;
  ok(`${file} loads the company's wording`, /loadDocumentWording\(db, \{/.test(src) && kinds.every((k) => src.includes(k)));
}
ok("no document-email builder is called without a wording decision", (() => {
  const files = ["app/api/quotes/[id]/send/route.js", "app/api/invoices/[id]/send/route.js", "app/api/invoices/[id]/request-payment/route.js", "lib/servicePlans/run.js", "lib/paymentSchedule/run.js"];
  return files.every((f) => { const s = code(read(f)); const calls = (s.match(/build(Quote|Invoice)Email\(\{/g) || []).length; const wordings = (s.match(/wording: await loadDocumentWording/g) || []).length; return calls > 0 && calls === wordings; });
})());

console.log("\nThe preview runs the real builder\n");

{
  const previewSrc = code(read("lib/email/documentEmailPreview.js"));
  ok("preview imports the real builders", /buildQuoteEmail\(/.test(previewSrc) && /buildInvoiceEmail\(/.test(previewSrc));
  ok("preview never writes", !/\.(create|update|delete|upsert)\(/.test(previewSrc));
  const db = {
    company: { async findUnique() { return { id: "c1", ...company, stripeAccountId: null }; } },
    quote: { async findFirst() { return null; } },
    invoice: { async findFirst() { return null; } },
  };
  const out = await renderDocumentEmailPreview(db, { companyId: "c1", kind: "quote", language: "es", copy: null });
  ok("quote preview on the sample document, in the asked language", out.document.sample === true && /presupuesto/i.test(out.subject) && out.html.includes("Q-1042"));
  // The sample quote's lines must carry their own figures. Rows in the wrong
  // shape (name/total instead of description/amount) render every line as
  // $0.00 and the card subtotal as nothing — the preview a company with no
  // quote yet sees of its own email. Measured in English so the figures are
  // literal: each line's amount, the lines' subtotal, and no zero anywhere.
  const enQuote = await renderDocumentEmailPreview(db, { companyId: "c1", kind: "quote", language: "en", copy: null });
  const lineFigures = ["$3,000.00", "$750.00", "$150.00"];
  ok(
    "sample quote prints each line's amount and the subtotal, never $0.00",
    enQuote.document.sample === true &&
      lineFigures.every((f) => enQuote.html.includes(f) && enQuote.text.includes(f)) &&
      enQuote.html.includes("$3,900.00") &&
      ["Cabinet doors & drawer fronts", "Cabinet boxes", "Premium hardware"].every((d) => enQuote.text.includes(d)) &&
      !enQuote.html.includes("$0.00") &&
      !enQuote.text.includes("$0.00"),
    lineFigures.filter((f) => !enQuote.html.includes(f)).join(", ") || (enQuote.html.includes("$0.00") ? "$0.00 in the HTML" : ""),
  );
  const withCopy = await renderDocumentEmailPreview(db, { companyId: "c1", kind: "invoice", language: "en", copy: { slots: { ...originalWording("invoice", "en"), greeting: "Yo {{clientName}}," }, sentMode: "blocks", canvas: null } });
  ok("preview shows the unsaved draft", withCopy.html.includes("Yo Jane,"));
  const receipt = await renderDocumentEmailPreview(db, { companyId: "c1", kind: "receipt", language: "fr", copy: null });
  ok("receipt preview is a receipt", /Reçu/i.test(receipt.subject));
  const deposit = await renderDocumentEmailPreview(db, { companyId: "c1", kind: "deposit", language: "en", copy: null });
  ok("deposit preview asks for a share, not the whole balance", /2,125\.00/.test(deposit.html));
}

console.log("\nThe page\n");

const page = code(read("app/app/settings/email-templates/EmailTemplatesManager.js"));
ok("the templates page mounts the Document emails group", /<DocumentEmails/.test(page));
ok("the old 'don't use a template' subtitle is gone", !/don't use a template/.test(page) && !/don't use a template/.test(APP_MESSAGES.en["app.emailTemplates.whatSends"]));
ok("the new subtitle says what is customisable and what is derived", /customise its wording/i.test(APP_MESSAGES.en["app.emailTemplates.whatSends"]) && /always come from the document/i.test(APP_MESSAGES.en["app.emailTemplates.whatSends"]));
const group = code(read("app/app/settings/email-templates/DocumentEmails.js"));
ok("Customise, Use this, Back to original, Reset to original", ["app.docEmails.customise", "app.docEmails.useThis", "app.docEmails.backToOriginal", "app.docEmails.resetToOriginal"].every((k) => group.includes(k)));
ok("language tabs per copy", /languages\.map\(\(l\)/.test(group));
ok("the preview is fetched from the real-builder route", /\/api\/settings\/document-emails\/preview/.test(group));
ok("the generic template list hides copies", /documentKind: null/.test(code(read("app/api/settings/document-templates/route.js"))));
for (const key of ["app.docEmails.explainer", "app.docEmails.customise", "app.docEmails.useThis", "app.docEmails.backToOriginal", "app.docEmails.resetToOriginal", "app.emailTemplates.whatSends"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in every language`, missing.length === 0, missing.join(","));
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
