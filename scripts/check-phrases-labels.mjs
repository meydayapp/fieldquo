// scripts/check-phrases-labels.mjs
//
// Payment-stage names and document custom-field labels, drafted on save and
// printed in the document's language (lib/i18n/phrases.js namespaces
// paymentStage and customFieldLabel).
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-phrases-labels.mjs
//
// Two halves. The helper that swaps the labels is EXECUTED against hostile
// input — no rows, a row for other words, a stale row, a row in the text's
// own language, a broken connection — because a lookup that returns "" or
// another company's words is the failure that matters. The wiring is read
// from source: every save route queues its namespace, every client-facing
// reader looks the text up, and the staff-only lines keep the company's own
// words.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { phraseKey, phraseLookup, loadPhrases } from "@/lib/i18n/phrases";
import { sourceHash } from "@/lib/i18n/sourceHash";
import { loadDocumentCustomFields, translateCustomFieldLabels } from "@/lib/customFields/values";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("FAIL:", name);
  }
}

const row = (ns, text, language, translated, extra = {}) => ({
  key: phraseKey(ns, text),
  language,
  text: translated,
  sourceHash: sourceHash(text),
  sourceLanguage: "en",
  status: "drafted",
  ...extra,
});

// ── translateCustomFieldLabels ──────────────────────────────────────────────
{
  const facts = [
    { label: "PO number", fieldType: "text", value: "PO number" },
    { label: "", fieldType: "text", value: "x" },
    { label: "Gate code", fieldType: "text", value: "1234" },
    null,
  ];
  const tr = phraseLookup([
    row("customFieldLabel", "PO number", "fr", "Numéro de bon de commande"),
    // A row for OTHER words — must not land on "Gate code".
    { ...row("customFieldLabel", "Gate", "fr", "Portail"), key: phraseKey("customFieldLabel", "Gate") },
  ]);
  const out = translateCustomFieldLabels(facts, tr);
  ok(out[0].label === "Numéro de bon de commande", "a drafted label is swapped in");
  ok(out[0].value === "PO number", "the answer is never translated, even when it equals the label");
  ok(out[1].label === "", "an empty label stays empty (no invented text)");
  ok(out[2].label === "Gate code", "a row for other words does not land on this label");
  ok(out[3] === null, "a null entry passes through untouched");
  ok(Array.isArray(translateCustomFieldLabels(null, tr)) && translateCustomFieldLabels(null, tr).length === 0, "non-array input → []");
  ok(translateCustomFieldLabels(facts, null) === facts, "no lookup → the facts as they were");
  ok(translateCustomFieldLabels([{ label: "PO number" }], () => "")[0].label === "PO number", "a lookup answering '' never blanks a label");
}

// ── phraseLookup, the reader both fields rely on ────────────────────────────
{
  const stale = { ...row("paymentStage", "Deposit", "fr", "Acompte"), sourceHash: sourceHash("Old deposit") };
  ok(phraseLookup([stale])("paymentStage", "Deposit") === "Deposit", "a row drafted from other words (stale hash) is not printed");
  const selfLang = row("paymentStage", "Acompte", "fr", "Acompte (fr)", { sourceLanguage: "fr" });
  ok(phraseLookup([selfLang])("paymentStage", "Acompte") === "Acompte", "a row in the language the text is written in is not printed");
  const pending = row("paymentStage", "Deposit", "fr", "Acompte", { status: "pending" });
  ok(phraseLookup([pending])("paymentStage", "Deposit") === "Deposit", "a pending row is not printed");
  const good = row("paymentStage", "Deposit", "fr", "Acompte");
  ok(phraseLookup([good])("paymentStage", " Deposit ") === "Acompte", "the job's copy of a label finds the draft by its text (trimmed)");
  ok(phraseLookup([good])("customFieldLabel", "Deposit") === "Deposit", "a stage draft never answers for a custom-field label (namespaces are separate)");
  ok(phraseLookup([])("paymentStage", "Deposit") === "Deposit", "no rows → the company's own words");
  ok(phraseLookup([good])("paymentStage", "") === "", "empty text → empty, no lookup");
}

// ── loadPhrases / loadDocumentCustomFields against a fake db ────────────────
function fakeDb({ translations = [], throwOnTranslations = false, fields, values } = {}) {
  const calls = { translations: 0 };
  return {
    calls,
    quote: { findFirst: async ({ where }) => (where.companyId === "co1" ? { id: where.id } : null) },
    invoice: { findFirst: async ({ where }) => (where.companyId === "co1" ? { id: where.id, parentInvoiceId: null } : null) },
    customField: { findMany: async ({ where }) => (where.companyId === "co1" ? fields : []) },
    customFieldValue: { findMany: async () => values },
    companyTextTranslation: {
      findMany: async ({ where }) => {
        calls.translations++;
        if (throwOnTranslations) throw new Error("P1001 connection");
        return translations.filter((r) => r.language === where.language && where.key.in.includes(r.key));
      },
    },
  };
}
{
  const fields = [
    { id: "f1", entityType: "quote", label: "PO number", fieldType: "text", options: null, required: false, showOnDocuments: true },
    { id: "f2", entityType: "quote", label: "Gate code", fieldType: "text", options: null, required: false, showOnDocuments: false },
    { id: "f3", entityType: "quote", label: "Colour", fieldType: "text", options: null, required: false, showOnDocuments: true },
  ];
  const values = [
    { customFieldId: "f1", value: "4471" },
    { customFieldId: "f2", value: "1234" },
    { customFieldId: "f3", value: "" },
  ];
  const translations = [
    row("customFieldLabel", "PO number", "fr", "N° de bon de commande"),
    row("customFieldLabel", "Gate code", "fr", "Code du portail"),
  ];

  const db1 = fakeDb({ translations, fields, values });
  const fr = await loadDocumentCustomFields(db1, "co1", "quote", "q1", { language: "fr" });
  ok(fr.length === 1, "only flagged fields with an answer reach the document (staff-only 'Gate code' and empty 'Colour' excluded)");
  ok(fr[0]?.label === "N° de bon de commande", "French document gets the French label");
  ok(fr[0]?.value === "4471", "the answer is untouched");

  const db2 = fakeDb({ translations, fields, values });
  const plain = await loadDocumentCustomFields(db2, "co1", "quote", "q1");
  ok(plain[0]?.label === "PO number" && db2.calls.translations === 0, "no language → label as written, no translation query");

  const db3 = fakeDb({ translations, fields, values });
  const unknown = await loadDocumentCustomFields(db3, "co1", "quote", "q1", { language: "xx" });
  ok(unknown[0]?.label === "PO number", "an unknown language → label as written");

  const db4 = fakeDb({ throwOnTranslations: true, fields, values });
  const broken = await loadDocumentCustomFields(db4, "co1", "quote", "q1", { language: "fr" });
  ok(broken[0]?.label === "PO number", "a failed translation read → label as written, not a 500");

  const db5 = fakeDb({ translations: [], fields, values });
  const none = await loadDocumentCustomFields(db5, "co1", "quote", "q1", { language: "fr" });
  ok(none[0]?.label === "PO number", "no rows yet → label as written");

  const db6 = fakeDb({ translations, fields: [], values: [] });
  const empty = await loadDocumentCustomFields(db6, "co1", "quote", "q1", { language: "fr" });
  ok(Array.isArray(empty) && empty.length === 0 && db6.calls.translations === 0, "nothing flagged → [] and no translation query");

  const db7 = fakeDb({ translations, fields, values });
  const foreign = await loadDocumentCustomFields(db7, "other-co", "quote", "q1", { language: "fr" });
  ok(foreign.length === 0, "another company's id reads nothing");

  const job = await loadDocumentCustomFields(fakeDb({ translations, fields, values }), "co1", "job", "j1", { language: "fr" });
  ok(job.length === 0, "a non-document entity type prints nothing");

  const trStage = await loadPhrases(fakeDb({ translations: [row("paymentStage", "Halfway", "es", "A mitad de obra")] }), "co1", "es", [{ ns: "paymentStage", text: "Halfway" }]);
  ok(trStage("paymentStage", "Halfway") === "A mitad de obra", "loadPhrases finds a stage draft in the reader's language");
  ok(trStage("paymentStage", "On completion") === "On completion", "a stage with no draft prints as written");
}

// ── Wiring, read from source ────────────────────────────────────────────────
const ROOT = process.cwd();
const code = (path) =>
  readFileSync(join(ROOT, path), "utf8")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

{
  const src = code("app/api/settings/payment-schedule/route.js");
  ok(/schedulePhrases\(\{[^}]*ns: "paymentStage"/.test(src), "payment-schedule save queues the stage labels (paymentStage)");
  ok(/texts: labels/.test(src) && /const labels = stages\.map\(\(s\) => s\.label\)/.test(src), "…every current label of the saved schedule");
  ok(/sourceLanguage/.test(src) && /defaultLanguage/.test(src), "…with the company's default language as the source");
  ok(/changed \? oneSummary\(terms, stageLabels\) : null/.test(src), "…and answers autoTranslate only when the wording changed");
  ok(/paymentTerms: generatedText/.test(src), "the generated terms sentence is still drafted too");
}
{
  const post = code("app/api/custom-fields/route.js");
  ok(/field\.showOnDocuments\s*\?\s*schedulePhrases\(\{[^}]*ns: "customFieldLabel"/s.test(post), "custom-field POST queues the label only for a document field");
  ok(/companyWritingLanguage\(member\.companyId\)/.test(post), "…in the company's writing language");
  const patch = code("app/api/custom-fields/[id]/route.js");
  ok(/if \(updated\.showOnDocuments\)[\s\S]*ns: "customFieldLabel"/.test(patch), "custom-field PATCH queues the label only for a document field");
  ok(/updated\.label !== existing\.label \|\| !existing\.showOnDocuments/.test(patch), "…and the banner speaks only on new client-facing words");
}
{
  const vals = code("lib/customFields/values.js");
  ok(/loadPhrases\(db, companyId, language, shown\.map\(\(f\) => \(\{ ns: "customFieldLabel", text: f\.label \}\)\)\)/.test(vals), "loadDocumentCustomFields looks the labels up in the document's language");

  // Every caller of loadDocumentCustomFields prints a client-facing document
  // and knows its language: none may call it without one.
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const p = join(dir, name);
      if (name === "node_modules" || name.startsWith(".")) continue;
      if (statSync(join(ROOT, p)).isDirectory()) walk(p);
      else if (p.endsWith(".js")) files.push(p);
    }
  };
  walk("app");
  walk("lib");
  let calls = 0;
  for (const f of files) {
    if (f === "lib/customFields/values.js") continue;
    const src = code(f);
    for (const m of src.matchAll(/loadDocumentCustomFields\(/g)) {
      if (/import \{[^}]*loadDocumentCustomFields/.test(src.slice(Math.max(0, m.index - 80), m.index + 30))) continue;
      calls++;
      const tail = src.slice(m.index, m.index + 260);
      ok(/\{\s*language(\s*:|\s*\})/.test(tail), `${f}: loadDocumentCustomFields is called with the document's language`);
    }
  }
  ok(calls >= 10, `every document caller found (${calls})`);
}
{
  const portal = code("app/api/portal/[token]/route.js");
  ok(/loadPhrases\([\s\S]{0,120}portalLanguage[\s\S]{0,200}ns: "paymentStage"/.test(portal), "portal route looks the stage names up in the portal's language");
  ok(/label: trStage\("paymentStage", stage\.label\)/.test(portal), "…and sends the translated name to PortalInvoice");
  ok(/language: resolveClientLanguage\(client, client\.company\)/.test(portal) && /const portalLanguage = resolveClientLanguage\(client, client\.company\)/.test(portal), "…the same language the page frames itself in");
  const page = code("app/portal/[token]/invoices/[id]/PortalInvoice.js");
  ok(/\? stage\.label/.test(page) && !/loadPhrases/.test(page), "PortalInvoice prints the label the route already translated (no lookup in the browser)");

  const run = code("lib/paymentSchedule/run.js");
  ok(/loadPhrases\(prisma, stage\.companyId, stageLanguage, \[\{ ns: "paymentStage", text: stage\.label \}\]\)/.test(run), "the stage-request email looks the stage name up in its language");
  ok(/note: trStage\("paymentStage", stage\.label\)/.test(run), "…and prints the translation");
  ok(/label: stage\.label,/.test(run), "the job's copy of the label is still the company's own words (translation happens on read)");

  const send = code("app/api/invoices/[id]/send/route.js");
  ok(/loadPhrases\(db, member\.companyId, invoiceLanguage, ask\.stage\?\.label/.test(send), "invoice send looks the asked stage up in the invoice's language");
  ok(/note: ask\.stage \? trStage\("paymentStage", ask\.stage\.label\) : null/.test(send), "…and the email's note prints the translation");
  ok(/asking for \$\{ask\.stage\.label\}/.test(send), "the staff activity line keeps the company's own words");
}
{
  const editor = code("app/app/settings/company/PaymentScheduleEditor.js");
  ok(/<AutoTranslateBanner result=\{autoTranslate\} \/>/.test(editor) && /setAutoTranslate\(d\?\.autoTranslate \|\| null\)/.test(editor), "the payment schedule editor shows the banner from its save");
  const page = code("app/app/settings/custom-fields/page.js");
  ok(/<AutoTranslateBanner result=\{autoTranslate\} \/>/.test(page) && (page.match(/setAutoTranslate\(d\?\.autoTranslate \|\| null\)/g) || []).length === 2, "the custom-fields page shows the banner from add and from flagging");
}

console.log(`check-phrases-labels: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
