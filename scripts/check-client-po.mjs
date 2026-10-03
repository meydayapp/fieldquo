// scripts/check-client-po.mjs
//
//   npm run check:client-po
//
// The CLIENT's purchase-order number — Quote / Job / Invoice.clientPoNumber
// and Client.requiresPo (lib/documents/clientPo.js) — executed rather than
// read wherever it can be:
//
//   1. the value: hostile input in, one clean line (or null) out
//   2. carry-forward: quote → job → invoice, run through the shipped
//      ensureJobForAcceptedQuote / ensureInvoiceForQuote / createJob against a
//      recording fake db; the job's PO onto its DRAFT invoices only; the
//      amended version, the manual invoice, the deposit email, the change order
//   3. printed only when set, in every document language: the PDF's details
//      panel (bundled with esbuild — the sections are JSX), the emailed and web
//      copies, the work order — and a document WITHOUT a PO renders exactly as
//      it did, facts deep-equal to the custom facts alone
//   4. search: the three lists match on it
//   5. "this client requires a PO": the prompt, both ways out, the screens
//   6. the generated PO-<year>-NNNN reference and its sequence
//   7. supplier purchase orders untouched — a different series, never read
//   8. the accounting export's column, escaped
//   9. "no PO, no invoice": a PO-required client's deposit request is held
//      (stage pending, invoice draft, a task for the office), released by a
//      PO on the quote/job/invoice exactly once — two racing saves, one send;
//      every other client, and every invoice already sent, unchanged
//  10. the company's reference format: prefix / year / digits, validated,
//      previewed with the generator's own function, old values untouched
//
// Judged by exit code.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLIENT_PO_MAX,
  normaliseClientPo,
  readClientPoInput,
  carriedClientPo,
  clientPoFact,
  clientPoLine,
  matchesClientPo,
  clientPoSendPrompt,
  nextGeneratedClientPo,
  allocateGeneratedClientPo,
  draftInvoicesFollowingJobPo,
  holdPaymentRequestForPo,
  poHoldTaskKey,
  readClientPoFormat,
  validateClientPoFormat,
  formatGeneratedClientPo,
} from "@/lib/documents/clientPo";
import { documentFacts, documentCustomFacts } from "@/lib/documentSections/customFacts";
import { DOCUMENT_LABELS, documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { LANGUAGES } from "@/app/i18n/languages";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { ensureJobForAcceptedQuote } from "@/lib/jobs/createJobFromQuote";
import { ensureInvoiceForQuote } from "@/lib/invoices/createInvoiceFromQuote";
import { createJob } from "@/lib/jobs/createJob";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { buildQuoteEmail } from "@/lib/email/quoteEmail";
import { buildWorkOrderModel } from "@/lib/workOrder/build";
import { workOrderPrintHtml } from "@/lib/workOrder/printSheet";
import { buildAccountingExport } from "@/lib/export/accountingExport";
import { nextPoNumber, formatPoNumber } from "@/lib/purchasing/poNumber";
import { quoteRequestBody } from "@/lib/quotes/builderRequest";
import { invoiceCreateBody, invoicePatchBody } from "@/lib/invoices/builderRequest";
import { requestStagePayment } from "@/lib/paymentSchedule/run";
import { releaseHeldPaymentRequests } from "@/lib/paymentSchedule/poHold";
import { selectInvoiceBanners } from "@/lib/invoices/lifecycle";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1 ");
let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)?.slice(0, 400)}` : ""}`);
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ══ A recording fake db ══════════════════════════════════════════════════════
//
// Enough Prisma for the three creation helpers: findFirst / findUnique /
// findMany / create / update / updateMany per model, a transaction that runs
// its callback against the same object, and $queryRaw for the row lock.
// Writes are recorded. Any model a test did not script answers empty, and the
// best-effort side effects the helpers run after a create (costs, checklists,
// waivers) find nothing to do — which is the state of a fresh job.
function fakeDb(seed = {}) {
  const rows = JSON.parse(JSON.stringify(seed));
  const writes = [];
  const touched = new Set();
  // Prisma's filter vocabulary, as far as the client-PO paths use it:
  // equality, null, { in }, { not }, { startsWith, mode }, OR, AND. Anything
  // else relational is read as "matches" (not modelled).
  const matches = (row, where = {}) =>
    Object.entries(where || {}).every(([k, v]) => {
      if (k === "OR") return v.some((w) => matches(row, w));
      if (k === "AND") return v.every((w) => matches(row, w));
      if (v === null) return row[k] === null || row[k] === undefined;
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("not" in v) return v.not === null ? row[k] !== null && row[k] !== undefined : row[k] !== v.not;
        if ("startsWith" in v) {
          const a = String(row[k] ?? "");
          return v.mode === "insensitive" ? a.toLowerCase().startsWith(v.startsWith.toLowerCase()) : a.startsWith(v.startsWith);
        }
        return true;
      }
      return row[k] === v;
    });
  // `include` / `select` of a relation, answered from the sibling table by
  // its foreign key (invoice → invoiceId, client → clientId, job → jobId).
  const withRelations = (row, spec) => {
    if (!row || !spec) return row;
    const out = { ...row };
    for (const [rel, sub] of Object.entries(spec)) {
      if (!sub || !rows[rel]) continue;
      const target = rows[rel].find((r) => r.id === row[`${rel}Id`]) || null;
      out[rel] = target ? (sub === true ? { ...target } : withRelations(target, sub.include || sub.select)) : null;
    }
    return out;
  };
  const model = (name) => {
    rows[name] = rows[name] || [];
    const list = () => rows[name];
    return {
      findFirst: async ({ where, include, select } = {}) => (touched.add(name), withRelations(list().find((r) => matches(r, where)) ?? null, include || select)),
      findUnique: async ({ where, include, select } = {}) => (touched.add(name), withRelations(list().find((r) => matches(r, where)) ?? null, include || select)),
      findMany: async ({ where } = {}) => (touched.add(name), list().filter((r) => matches(r, where))),
      count: async ({ where } = {}) => (touched.add(name), list().filter((r) => matches(r, where)).length),
      create: async ({ data }) => {
        touched.add(name);
        // The unique index on Task.sourceKey, which the hold's "one task per
        // invoice" leans on.
        if (name === "task" && data.sourceKey && list().some((r) => r.sourceKey === data.sourceKey)) {
          const err = new Error("Unique constraint failed on sourceKey");
          err.code = "P2002";
          throw err;
        }
        const row = { id: `${name}-${list().length + 1}`, status: name === "task" ? "open" : undefined, ...data };
        list().push(row);
        writes.push({ model: name, op: "create", data });
        return row;
      },
      createMany: async ({ data }) => (touched.add(name), writes.push({ model: name, op: "createMany", data }), { count: 0 }),
      // Applied synchronously, before the first await resolves, the way a
      // single UPDATE … WHERE is atomic in Postgres: two racing claims cannot
      // both see the row still matching.
      update: async ({ where, data }) => {
        touched.add(name);
        writes.push({ model: name, op: "update", where, data });
        const row = list().find((r) => matches(r, where));
        if (row) Object.assign(row, data);
        return row ? { ...row } : { id: where?.id, ...data };
      },
      updateMany: async ({ where, data }) => {
        touched.add(name);
        writes.push({ model: name, op: "updateMany", where, data });
        const hit = list().filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      },
      upsert: async ({ create }) => (touched.add(name), writes.push({ model: name, op: "upsert", data: create }), create),
      deleteMany: async () => ({ count: 0 }),
    };
  };
  const db = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "$transaction") return async (fn) => (typeof fn === "function" ? fn(db) : Promise.all(fn));
        if (prop === "$queryRaw") return async () => [];
        if (prop === "$executeRaw") return async () => 0;
        if (prop === "then") return undefined;
        if (prop === "__writes") return writes;
        if (prop === "__touched") return touched;
        if (prop === "__rows") return rows;
        if (typeof prop !== "string") return undefined;
        return model(prop);
      },
    },
  );
  return db;
}
const created = (db, model) => db.__writes.filter((w) => w.model === model && w.op === "create").map((w) => w.data);

// Silence the helpers' own best-effort error logging for the fake rows they
// cannot find (a missing waiver table is not this check's business).
const realError = console.error;
const quietly = async (fn) => {
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = realError;
  }
};

// ══ 1. The value ══════════════════════════════════════════════════════════════
console.log("\n1. The value — hostile input in, one clean line out\n");
{
  ok("null / undefined → null", normaliseClientPo(null) === null && normaliseClientPo(undefined) === null);
  ok("blank and whitespace → null (absence is not a statement)", normaliseClientPo("") === null && normaliseClientPo("   \t\n ") === null);
  ok("trimmed, inner whitespace collapsed", normaliseClientPo("  PO  4471 ") === "PO 4471");
  ok("a pasted newline or tab cannot break the one-line header", normaliseClientPo("4471\r\n-A\t2") === "4471 -A 2");
  ok("a line separator is a space; a zero-width mark inside a number vanishes", normaliseClientPo("44\u202871\u200b\ufeff") === "44 71" && normaliseClientPo("44\u200b71") === "4471");
  ok("a number from a spreadsheet paste keeps its digits", normaliseClientPo(4471) === "4471");
  ok("NaN / Infinity / objects / arrays → null", [NaN, Infinity, {}, [], true].every((v) => normaliseClientPo(v) === null));
  ok(`capped at ${CLIENT_PO_MAX} characters`, normaliseClientPo("x".repeat(500)).length === CLIENT_PO_MAX);
  ok("text that is only control characters → null", normaliseClientPo("\u0000\u0007\u001f") === null);
  ok("markup is kept as text (every printer escapes it)", normaliseClientPo("<b>9</b>") === "<b>9</b>");

  ok("absent key → undefined (leave the column alone)", readClientPoInput({}) === undefined && readClientPoInput({ clientPoNumber: undefined }) === undefined);
  ok("cleared box → null", readClientPoInput({ clientPoNumber: "" }) === null && readClientPoInput({ clientPoNumber: null }) === null);
  ok("typed → normalised", readClientPoInput({ clientPoNumber: " 4471 " }) === "4471");
  ok("not an object body → undefined", readClientPoInput(null) === undefined && readClientPoInput("x") === undefined);

  ok("carry: the first source with a PO, newest first", carriedClientPo({ clientPoNumber: "JOB-9" }, { clientPoNumber: "Q-1" }) === "JOB-9");
  ok("carry: a blank job PO falls through to the quote's", carriedClientPo({ clientPoNumber: "  " }, { clientPoNumber: "Q-1" }) === "Q-1");
  ok("carry: nothing anywhere → null", carriedClientPo(null, undefined, { clientPoNumber: null }) === null);
}

// ══ 2. Carry-forward ══════════════════════════════════════════════════════════
console.log("\n2. Carry-forward — quote → job → invoice, executed\n");
{
  // Quote accepted → job.
  const db = fakeDb({
    quote: [{ id: "q1", companyId: "c1", clientId: "cl1", quoteNumber: "Q-2026-0042", quoteType: null, status: "accepted", siteAddress: null, clientPoNumber: "NPM-77812", client: { name: "Northline Property Management" } }],
    job: [],
  });
  await quietly(() => ensureJobForAcceptedQuote("q1", { db }));
  const jobs = created(db, "job");
  ok("acceptance creates the job carrying the quote's PO", jobs.length === 1 && jobs[0].clientPoNumber === "NPM-77812", jobs[0]);

  const dbNone = fakeDb({ quote: [{ id: "q2", companyId: "c1", clientId: "cl1", quoteNumber: "Q-2026-0043", status: "accepted", siteAddress: null, clientPoNumber: null, client: { name: "A" } }], job: [] });
  await quietly(() => ensureJobForAcceptedQuote("q2", { db: dbNone }));
  ok("a quote with no PO gives a job with none (null, not an empty string)", created(dbNone, "job")[0]?.clientPoNumber === null, created(dbNone, "job")[0]);
}
{
  // Accepted quote → invoice. The JOB's PO wins: it is usually issued after
  // approval and typed onto the job.
  const quoteRow = {
    id: "q1", companyId: "c1", clientId: "cl1", quoteNumber: "Q-2026-0042", status: "accepted",
    clientPoNumber: "NPM-77812", scopeGroups: [], addOns: [], lineItems: [],
    subtotal: 1000, discount: 0, tax: 130, total: 1130, acceptedTotal: null, taxEnabled: true, taxResolution: null, language: "en",
  };
  const withJob = fakeDb({ quote: [quoteRow], invoice: [], job: [{ id: "j1", quoteId: "q1", companyId: "c1", clientPoNumber: "NPM-77812-REV" }] });
  await quietly(() => ensureInvoiceForQuote("q1", { db: withJob }));
  ok("the invoice takes the job's PO when the job has one", created(withJob, "invoice")[0]?.clientPoNumber === "NPM-77812-REV", created(withJob, "invoice")[0]?.clientPoNumber);

  const noJob = fakeDb({ quote: [quoteRow], invoice: [], job: [] });
  await quietly(() => ensureInvoiceForQuote("q1", { db: noJob }));
  ok("…else the quote's", created(noJob, "invoice")[0]?.clientPoNumber === "NPM-77812", created(noJob, "invoice")[0]?.clientPoNumber);

  const blankJob = fakeDb({ quote: [quoteRow], invoice: [], job: [{ id: "j1", quoteId: "q1", companyId: "c1", clientPoNumber: null }] });
  await quietly(() => ensureInvoiceForQuote("q1", { db: blankJob }));
  ok("…and a job with none does not blank the quote's", created(blankJob, "invoice")[0]?.clientPoNumber === "NPM-77812");

  const neither = fakeDb({ quote: [{ ...quoteRow, clientPoNumber: null }], invoice: [], job: [] });
  await quietly(() => ensureInvoiceForQuote("q1", { db: neither }));
  ok("no PO anywhere → the invoice's is null", created(neither, "invoice")[0]?.clientPoNumber === null);
}
{
  // A job raised by hand from a quote (POST /api/jobs, the invoice page).
  const seed = { client: [{ id: "cl1", companyId: "c1" }], quote: [{ id: "q1", companyId: "c1", clientPoNumber: "Q-PO-1" }], job: [] };
  const a = fakeDb(seed);
  await quietly(() => createJob(a, { companyId: "c1", clientId: "cl1", quoteId: "q1", title: "Phase 2" }));
  ok("a hand-raised job from a quote carries the quote's PO", created(a, "job")[0]?.clientPoNumber === "Q-PO-1", created(a, "job")[0]);
  const b = fakeDb(seed);
  await quietly(() => createJob(b, { companyId: "c1", clientId: "cl1", quoteId: "q1", title: "Phase 2", clientPoNumber: " PH2-500 " }));
  ok("…a typed PO wins (a client that issues one per phase)", created(b, "job")[0]?.clientPoNumber === "PH2-500");
  const c = fakeDb(seed);
  await quietly(() => createJob(c, { companyId: "c1", clientId: "cl1", quoteId: "q1", title: "Phase 2", clientPoNumber: "" }));
  ok("…a cleared box is a deliberate none", created(c, "job")[0]?.clientPoNumber === null);
  const d = fakeDb({ client: [{ id: "cl1", companyId: "c1" }], job: [] });
  await quietly(() => createJob(d, { companyId: "c1", clientId: "cl1", title: "Walk-in" }));
  ok("a job with no quote and no PO → null", created(d, "job")[0]?.clientPoNumber === null);
}
{
  // The job's PO onto its draft invoices.
  const w = draftInvoicesFollowingJobPo({ job: { id: "j1", companyId: "c1", quoteId: "q1" }, previousPo: "OLD-1" });
  ok("only DRAFT invoices follow a job's PO change", w.status === "draft");
  ok("only family roots (a version is never rewritten)", w.parentInvoiceId === null);
  ok("never a past job typed in after the fact", w.historicalImportedAt === null);
  ok("scoped to the job's company", w.companyId === "c1");
  ok("linked to the job, or raised from its quote with no job link", same(w.AND[0], { OR: [{ jobId: "j1" }, { jobId: null, quoteId: "q1" }] }), w.AND[0]);
  ok("only drafts holding no PO or the job's OLD one — a draft's own phase PO is kept", same(w.AND[1], { OR: [{ clientPoNumber: null }, { clientPoNumber: "OLD-1" }] }), w.AND[1]);
  const w2 = draftInvoicesFollowingJobPo({ job: { id: "j2", companyId: "c1", quoteId: null }, previousPo: null });
  ok("a job with no quote and no previous PO: its own drafts with none", same(w2.AND, [{ OR: [{ jobId: "j2" }] }, { OR: [{ clientPoNumber: null }] }]), w2.AND);

  const jobRoute = decomment(read("app/api/jobs/[id]/route.js"));
  ok("PATCH /api/jobs/[id] reads the PO three-way", /const clientPoNumber = readClientPoInput\(body\)/.test(jobRoute));
  ok("…writes it only when it changed", /\.\.\.\(poChanging && \{ clientPoNumber \}\)/.test(jobRoute));
  ok("…and copies it onto the following drafts AFTER the guarded write settles", /settleGuardedWrite[\s\S]*if \(poChanging\) \{\s*await db\.invoice\.updateMany\(\{\s*where: draftInvoicesFollowingJobPo\(\{ job: existing, previousPo: existing\.clientPoNumber \}\)/.test(jobRoute));
}
{
  // The other doors an invoice comes through.
  const post = decomment(read("app/api/invoices/route.js"));
  ok("POST /api/invoices: a posted PO wins, silence carries the job's then the quote's", /const postedPo = readClientPoInput\(body\);[\s\S]*if \(postedPo === undefined\)[\s\S]*clientPoNumber = carriedClientPo\(sourceJob, sourceQuote\)/.test(post));
  ok("…the job read is company-scoped", /db\.job\.findFirst\(\{\s*where: \{ id: jobId, companyId: member\.companyId \}/.test(post));
  ok("…and the value reaches the create", /invoice\.create\(\{\s*data: \{[\s\S]*?clientPoNumber,\s*\n/.test(post));
  ok("GET /api/invoices shows the version that stands's PO", /clientPoNumber: latest\.clientPoNumber/.test(post));

  const patch = decomment(read("app/api/invoices/[id]/route.js"));
  ok("a draft edit writes the PO in place", /\.\.\.\(clientPoNumber !== undefined && \{ clientPoNumber \}\)/.test(patch));
  ok("an amended (sent) invoice's new version carries the PO unless the edit changed it", /clientPoNumber: clientPoNumber !== undefined \? clientPoNumber : existing\.clientPoNumber/.test(patch));

  const lifecycle = decomment(read("app/api/invoices/[id]/lifecycle/route.js"));
  ok("a job raised from an invoice takes the invoice's PO", /clientPoNumber: invoice\.clientPoNumber \|\| undefined/.test(lifecycle) && /INVOICE_SELECT = \{[\s\S]*?clientPoNumber: true/.test(lifecycle));

  // Deposit / progress requests are emails about THE job's one invoice (one
  // invoice per job, requested in stages) — so they print what that invoice
  // carries, read whole.
  const stages = decomment(read("lib/paymentSchedule/run.js"));
  ok("deposit/progress stage emails read the whole invoice row (its PO included)", /invoice: \{ include: \{ client: true \} \}/.test(stages) && /buildInvoiceEmail\(\{\s*invoice: stage\.invoice/.test(stages));
  const email = buildInvoiceEmail({
    invoice: { invoiceNumber: "INV-2026-0042", total: 10000, amountPaid: 0, dueDate: null, lineItems: [], customFields: [], clientPoNumber: "NPM-77812" },
    client: { name: "Northline Property Management", email: "ap@northline.test" },
    company: { name: "Acme", currency: "CAD", brandColor: "#06356b" },
    url: "https://x.test/p/1",
    canTakeCard: false,
    requestAmount: 3000,
    note: "Deposit",
    language: "en",
  });
  ok("…and a deposit request prints it", email.html.includes("NPM-77812") && email.text.includes("PO #: NPM-77812"), email.text);

  const co = decomment(read("app/api/public/change-orders/[token]/route.js"));
  ok("a change order's page is handed the job's PO", /clientPoNumber: true/.test(co) && /clientPoNumber: job\.clientPoNumber \|\| null/.test(co));
  const coPage = decomment(read("app/co/[token]/ChangeOrderApproval.js"));
  ok("…and prints it in the document's language, only when set", /clientPoLine\(data, documentLabels\(data\.language\)\) && \(/.test(coPage));

  const quoteRoute = decomment(read("app/api/quotes/[id]/route.js"));
  ok("a quote's PO is editable while open; once decided it can only be added, not changed", /if \(poChanging && !\["draft", "sent"\]\.includes\(existing\.status\) && !poAddedAfterDecision\)/.test(quoteRoute) && /\.\.\.\(poChanging && \{ clientPoNumber \}\)/.test(quoteRoute));
  ok("a new quote stores what the builder sent", /clientPoNumber: readClientPoInput\(body\) \?\? null/.test(decomment(read("app/api/quotes/route.js"))));
}

// ══ 3. Printed only when set, in every language ══════════════════════════════
console.log("\n3. Printed only when set — every document language\n");
const codes = LANGUAGES.map((l) => l.code);
{
  for (const code of codes) {
    const label = DOCUMENT_LABELS[code]?.poNumber;
    ok(`${code}: the label is written in the language, not inherited`, typeof label === "string" && label.trim() !== "" && (code === "en" || label !== DOCUMENT_LABELS.en.poNumber), label);
    const fact = clientPoFact({ clientPoNumber: "4471" }, documentLabels(code));
    ok(`${code}: the fact is [label, number]`, same(fact, [label, "4471"]), fact);
    ok(`${code}: no PO → no fact, no line`, clientPoFact({ clientPoNumber: null }, documentLabels(code)) === null && clientPoLine({ clientPoNumber: "  " }, documentLabels(code)) === null);
  }

  // The emailed and web copies: no PO → exactly the custom facts, nothing new.
  const custom = [{ label: "Site contact", fieldType: "text", value: "Dana" }];
  const fmt = { date: (d) => String(d), labels: documentLabels("en") };
  for (const po of [undefined, null, "", "   "]) {
    ok(`facts with clientPoNumber=${JSON.stringify(po)} equal the custom facts alone`, same(documentFacts({ clientPoNumber: po, customFields: custom }, fmt), documentCustomFacts(custom, fmt)));
  }
  ok("with a PO it leads the facts", same(documentFacts({ clientPoNumber: "4471", customFields: custom }, fmt), [["PO #", "4471"], ["Site contact", "Dana"]]));
  const legacy = [{ label: "PO number", fieldType: "text", value: "4471" }, ...custom];
  ok("a company's old custom 'PO number' box with the same value is not printed twice", same(documentFacts({ clientPoNumber: "4471", customFields: legacy }, fmt), [["PO #", "4471"], ["Site contact", "Dana"]]));
  ok("…but a custom box holding something else still prints", documentFacts({ clientPoNumber: "4471", customFields: [{ label: "Job ref", fieldType: "text", value: "A-9" }] }, fmt).length === 2);

  // The emails, in every language.
  const company = { name: "Acme Painting", phone: "555-0100", email: "hi@acme.test", brandColor: "#06356b", currency: "CAD", paymentMethods: ["e_transfer"], quoteEmailReferences: [], quoteEmailBeforeAfter: [], quoteEmailIncludeReferences: false, quoteEmailIncludeBeforeAfter: false, defaultProcessNotes: null };
  const quote = { quoteNumber: "Q-77", total: 4250, validUntil: null, lineItems: [{ description: "Doors", quantity: 2, unit: "each", rate: 100, amount: 200 }], processNotes: null, emailReferences: null, emailBeforeAfter: null, emailIncludeReferences: null, emailIncludeBeforeAfter: null, customFields: [] };
  const client = { name: "Jane Doe", email: "jane@x.test" };
  const invoice = { invoiceNumber: "INV-3", total: 1000, amountPaid: 0, dueDate: null, lineItems: [], customFields: [] };
  for (const code of codes) {
    const label = DOCUMENT_LABELS[code].poNumber;
    const q = buildQuoteEmail({ quote: { ...quote, clientPoNumber: "NPM-77812" }, client, company, url: "https://x.test/q/1", language: code });
    ok(`${code}: the quote email prints "${label}" and the number`, q.html.includes("NPM-77812") && q.text.includes(`${label}: NPM-77812`));
    const i = buildInvoiceEmail({ invoice: { ...invoice, clientPoNumber: "NPM-77812" }, client, company, url: "https://x.test/p/1", canTakeCard: false, language: code });
    ok(`${code}: the invoice email prints it`, i.html.includes("NPM-77812") && i.text.includes(`${label}: NPM-77812`));
    const qNone = buildQuoteEmail({ quote: { ...quote, clientPoNumber: null }, client, company, url: "https://x.test/q/1", language: code });
    const qAbsent = buildQuoteEmail({ quote, client, company, url: "https://x.test/q/1", language: code });
    ok(`${code}: a quote without one is byte-identical to one that never had the field`, qNone.html === qAbsent.html && qNone.text === qAbsent.text && !qAbsent.html.includes(label.replace(/&/g, "&amp;")) );
    const iNone = buildInvoiceEmail({ invoice: { ...invoice, clientPoNumber: "" }, client, company, url: "https://x.test/p/1", canTakeCard: false, language: code });
    const iAbsent = buildInvoiceEmail({ invoice, client, company, url: "https://x.test/p/1", canTakeCard: false, language: code });
    ok(`${code}: an invoice without one likewise`, iNone.html === iAbsent.html && iNone.text === iAbsent.text);
  }
  ok("the PO is HTML-escaped in the email", buildInvoiceEmail({ invoice: { ...invoice, clientPoNumber: "<b>9</b>" }, client, company, url: "https://x.test/p/1", canTakeCard: false, language: "en" }).html.includes("&lt;b&gt;9&lt;/b&gt;"));

  // The web copies print what the facts say, from payloads that carry it.
  ok("the client's quote page prints the facts with the PO", /documentFacts\(quote, \{ date: fmt\.date, labels \}\)/.test(read("app/q/[token]/QuoteApproval.js")));
  ok("…and GET /api/public/quotes/[token] sends it", /clientPoNumber: quote\.clientPoNumber \|\| null/.test(read("app/api/public/quotes/[token]/route.js")));
  ok("the portal invoice prints the facts with the PO", /documentFacts\(invoice, \{ date, labels \}\)/.test(read("app/portal/[token]/invoices/[id]/PortalInvoice.js")));
  const portal = decomment(read("app/api/portal/[token]/route.js"));
  ok("…and the portal route selects and forwards it (allow-list)", /invoiceNumber: true,\s*clientPoNumber: true/.test(portal) && /clientPoNumber: invoice\.clientPoNumber \|\| null/.test(portal));

  // The work order.
  const model = (po) =>
    buildWorkOrderModel({ job: { id: "j1", title: "Unit 4 repaint", clientPoNumber: po, siteAddress: "12 King St", quote: { quoteNumber: "Q-1", language: "fr", scopeGroups: [] } }, client: { name: "Northline" } });
  ok("the work-order model carries the job's PO, cleaned", model("  NPM-77812 ").job.clientPoNumber === "NPM-77812");
  ok("…and null when there is none", model(null).job.clientPoNumber === null);
  const sheetWith = workOrderPrintHtml({ company: { name: "Acme" }, workOrder: model("NPM-77812"), language: "fr" });
  ok("the printed work order says it, in the document's language", sheetWith.includes(`${DOCUMENT_LABELS.fr.poNumber} NPM-77812`));
  const sheetNone = workOrderPrintHtml({ company: { name: "Acme" }, workOrder: model(null), language: "fr" });
  const withoutKey = model(null);
  delete withoutKey.job.clientPoNumber;
  ok("…and without one the sheet is byte-identical to a model that never had the key", sheetNone === workOrderPrintHtml({ company: { name: "Acme" }, workOrder: withoutKey, language: "fr" }) && !sheetNone.includes(DOCUMENT_LABELS.fr.poNumber));
}
{
  // The PDF. The sections are JSX, so they are bundled with esbuild (the
  // same tool check:invoice-builder uses) into a tiny program that renders
  // ClientInfoSection's and WorkOrderSection's element trees and prints them.
  const dir = mkdtempSync(join(tmpdir(), "client-po-"));
  try {
    const entry = join(dir, "entry.jsx");
    writeFileSync(
      entry,
      `import * as Info from "@/lib/documentSections/ClientInfoSection";
import * as WorkOrder from "@/lib/documentSections/WorkOrderSection";
import { LANGUAGES } from "@/app/i18n/languages";
const strip = (el) => JSON.stringify(el, (k, v) => (k === "_owner" || k === "_store" ? undefined : v));
const out = {};
const base = { invoiceNumber: "INV-2026-0042", client: { name: "Northline Property Management" }, createdAt: "2026-10-01T12:00:00Z", customFields: [{ label: "Site contact", fieldType: "text", value: "Dana" }] };
for (const { code } of LANGUAGES) {
  out[code] = {
    withPo: strip(Info.PdfSection({ data: { ...base, clientPoNumber: "NPM-77812" }, company: {}, language: code })),
    nullPo: strip(Info.PdfSection({ data: { ...base, clientPoNumber: null }, company: {}, language: code })),
    absent: strip(Info.PdfSection({ data: base, company: {}, language: code })),
  };
}
const wo = (po) => ({ job: { id: "j1", title: "Unit 4", siteAddress: "12 King St", clientPoNumber: po }, client: { name: "Northline" }, areas: [], crew: [], displayHours: 0, hiddenCount: 0 });
out.workOrder = {
  withPo: strip(WorkOrder.PdfSection({ company: { name: "Acme" }, data: { workOrder: wo("NPM-77812") }, language: "de" })),
  absent: strip(WorkOrder.PdfSection({ company: { name: "Acme" }, data: { workOrder: (() => { const w = wo(null); delete w.job.clientPoNumber; return w; })() }, language: "de" })),
  nullPo: strip(WorkOrder.PdfSection({ company: { name: "Acme" }, data: { workOrder: wo(null) }, language: "de" })),
};
console.log(JSON.stringify(out));
`,
    );
    const bundle = join(dir, "bundle.cjs");
    execFileSync(
      "npx",
      ["esbuild", entry, "--bundle", "--platform=node", "--format=cjs", "--jsx=automatic", "--loader:.js=jsx", `--alias:@=${ROOT}`, "--log-level=error", `--outfile=${bundle}`],
      { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] },
    );
    const trees = JSON.parse(execFileSync("node", [bundle], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
    for (const code of codes) {
      const t = trees[code];
      ok(`${code}: the PDF details panel prints "${DOCUMENT_LABELS[code].poNumber}" and the number`, t.withPo.includes("NPM-77812") && t.withPo.includes(JSON.stringify(DOCUMENT_LABELS[code].poNumber).slice(1, -1)));
      ok(`${code}: a PDF without a PO is identical to one that never had the field — no empty label`, t.nullPo === t.absent && !t.absent.includes(JSON.stringify(DOCUMENT_LABELS[code].poNumber).slice(1, -1)));
    }
    ok("the work-order PDF prints it in the document's language", trees.workOrder.withPo.includes(`${DOCUMENT_LABELS.de.poNumber} NPM-77812`));
    ok("…and without one the work-order PDF is unchanged", trees.workOrder.nullPo === trees.workOrder.absent && !trees.workOrder.absent.includes(DOCUMENT_LABELS.de.poNumber));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ══ 4. Search ═════════════════════════════════════════════════════════════════
console.log("\n4. Search — the three lists match on it\n");
{
  const row = { clientPoNumber: "PO-4471/A" };
  ok("exact", matchesClientPo(row, "PO-4471/A"));
  ok("case-insensitive", matchesClientPo(row, "po-4471/a"));
  ok("blind to spaces, dashes, slashes, dots and #", matchesClientPo(row, "po 4471 a") && matchesClientPo(row, "#4471") && matchesClientPo(row, "4471a"));
  ok("a partial number finds it", matchesClientPo(row, "447"));
  ok("an empty search matches nothing here (the other fields cover it)", !matchesClientPo(row, "") && !matchesClientPo(row, "  -- "));
  ok("a row with no PO never matches", !matchesClientPo({ clientPoNumber: null }, "4471") && !matchesClientPo({}, "x"));
  ok("a different number does not", !matchesClientPo(row, "4472"));
  for (const [file, rowVar] of [["app/app/quotes/page.js", "q"], ["app/app/jobs/page.js", "j"], ["app/app/invoices/page.js", "inv"]]) {
    ok(`${file}: the search box ORs the PO in`, new RegExp(`\\|\\|\\s*matchesClientPo\\(${rowVar}, s\\)`).test(decomment(read(file))));
  }
  ok("the quote, job and invoice rows show it as a chip", [
    ["app/app/quotes/QuoteListRow.js", "q.clientPoNumber"],
    ["app/app/jobs/JobListRow.js", "job.clientPoNumber"],
    ["app/app/invoices/page.js", "inv.clientPoNumber"],
  ].every(([f, expr]) => read(f).includes(`<ClientPoChip value={${expr}} />`)));
}

// ══ 5. "This client requires a PO" ══════════════════════════════════════════
console.log("\n5. The client-requires-PO prompt\n");
{
  const northline = { name: "Northline Property Management", requiresPo: true };
  ok("a client that does not require one: no prompt", clientPoSendPrompt({ client: { name: "Jane", requiresPo: false }, invoice: { status: "draft" } }) === null);
  ok("an invoice that has one: no prompt", clientPoSendPrompt({ client: northline, invoice: { status: "draft", clientPoNumber: "4471" } }) === null);
  ok("a whitespace PO is no PO", clientPoSendPrompt({ client: northline, invoice: { status: "draft", clientPoNumber: "   " } }) !== null);
  ok("'send anyway' sends", clientPoSendPrompt({ client: northline, invoice: { status: "draft" }, sendWithoutPo: true }) === null);
  ok("only a literal true is 'send anyway'", clientPoSendPrompt({ client: northline, invoice: { status: "draft" }, sendWithoutPo: "true" }) !== null);
  const p = clientPoSendPrompt({ client: northline, invoice: { status: "draft", clientPoNumber: null } });
  ok("required and missing → the question, naming the client", p?.code === "po_required" && p.clientName === "Northline Property Management" && p.error === "Northline Property Management requires a PO number on invoices. Add it, or send without one.", p);
  ok("…a draft can take the PO in place", p.editable === true);
  ok("…a sent one only by amendment", clientPoSendPrompt({ client: northline, invoice: { status: "sent" } }).editable === false);
  ok("…a nameless client still reads as a sentence", clientPoSendPrompt({ client: { requiresPo: true }, invoice: {} }).clientName === "This client");

  const send = decomment(read("app/api/invoices/[id]/send/route.js"));
  const at = (re) => send.search(re);
  ok("the send asks AFTER the hard refusals (tax, nothing owed) — a prompt, not a block", at(/taxSendRefusal\(/) > -1 && at(/clientPoSendPrompt\(/) > at(/taxSendRefusal\(/) && at(/clientPoSendPrompt\(/) > at(/code: "nothing_owed"/));
  ok("…and BEFORE anything is minted or sent", at(/clientPoSendPrompt\(/) < at(/ensurePortalToken\(/) && at(/clientPoSendPrompt\(/) < at(/sendEmail\(/));
  ok("…answering 409 with the question", /if \(poPrompt\) return NextResponse\.json\(poPrompt, \{ status: 409 \}\)/.test(send));
  ok("…'send anyway' is a literal true from the body", /sendWithoutPo: sendBody\?\.sendWithoutPo === true/.test(send));
  ok("…a typed PO is written onto a DRAFT only, company-scoped", /if \(invoice\.status !== "draft"\) \{[\s\S]*code: "po_locked"[\s\S]*await db\.invoice\.update\(\{\s*where: \{ id: invoice\.id, companyId: member\.companyId \},\s*data: \{ clientPoNumber: typedPo \}/.test(send));
  ok("…and an empty body (every older caller) still parses", /await request\.json\(\)\.catch\(\(\) => \(\{\}\)\)/.test(send));

  const page = decomment(read("app/app/invoices/[id]/page.js"));
  ok("the invoice page opens the dialog on po_required", /data\?\.code === "po_required"\) \{\s*setPoPrompt\(data\)/.test(page));
  ok("…both answers go back through the same send", /<ClientPoRequiredModal[\s\S]*?onSend=\{\(answer\) => sendInvoice\(answer\)\}/.test(page));
  ok("…and the plain Send button never posts its click event as an answer", !/onClick=\{sendInvoice\}/.test(page) && !/send: sendInvoice,/.test(page));
  const modal = read("app/components/documents/ClientPoRequiredModal.js");
  ok("the dialog offers 'add it and send' and 'send without'", /onSend\(\{ clientPoNumber: typed \}\)/.test(modal) && /onSend\(\{ sendWithoutPo: true \}\)/.test(modal));
  const builder = decomment(read("app/components/invoices/builder/InvoiceBuilder.js"));
  ok("Save & send asks in its confirm dialog, then posts sendWithoutPo only when it asked", /poMissing\s*\?\s*`\$\{t\("app\.clientPo\.sendWarning"/.test(builder) && /\.\.\.\(poMissing \? \{ headers: \{ "Content-Type": "application\/json" \}, body: JSON\.stringify\(\{ sendWithoutPo: true \}\) \} : \{\}\)/.test(builder));

  const clientPatch = decomment(read("app/api/clients/[id]/route.js"));
  ok("the client record's switch is written (boolean only)", /\.\.\.\(typeof requiresPo === "boolean" && \{ requiresPo \}\)/.test(clientPatch));
  ok("…on create too, true only when said", /requiresPo: requiresPo === true/.test(decomment(read("app/api/clients/route.js"))));
  const clientPage = read("app/app/clients/[id]/page.js");
  ok("…the client page edits it and shows it", /requiresPo: client\.requiresPo === true/.test(clientPage) && /checked=\{Boolean\(form\.requiresPo\)\}/.test(clientPage) && /\{client\.requiresPo && \(/.test(clientPage));

  for (const k of ["app.clientPo.promptTitle", "app.clientPo.promptBody", "app.clientPo.promptEnter", "app.clientPo.promptAnyway", "app.clientPo.sendWarning", "app.clientDetail.requiresPo"]) {
    ok(`${k} exists in every app language`, Object.values(APP_MESSAGES).every((m) => typeof m[k] === "string" && m[k].trim()));
  }
  ok("the prompt's body names the client in every language", Object.values(APP_MESSAGES).every((m) => m["app.clientPo.promptBody"].includes("{client}")));
}

// ══ 6. The generated reference ════════════════════════════════════════════════
console.log("\n6. Generated PO-<year>-NNNN — the sequence\n");
{
  ok("the first of the year", nextGeneratedClientPo([], 2026) === "PO-2026-0001");
  ok("one more than the highest of THIS year", nextGeneratedClientPo(["PO-2026-0041", "PO-2026-0007"], 2026) === "PO-2026-0042");
  ok("case-blind: a hand-typed po-2026-0050 counts", nextGeneratedClientPo(["po-2026-0050", "PO-2026-0042"], 2026) === "PO-2026-0051");
  ok("last year's references do not move this year's sequence", nextGeneratedClientPo(["PO-2025-0900"], 2026) === "PO-2026-0001");
  ok("client-issued numbers are not part of the series", nextGeneratedClientPo(["4471", "NPM-77812", "PO 2026 0099"], 2026) === "PO-2026-0001");
  ok("padding is a floor: 9999 → 10000", nextGeneratedClientPo(["PO-2026-9999"], 2026) === "PO-2026-10000");
  ok("junk in the list is ignored", nextGeneratedClientPo([null, undefined, 42, {}, "", "PO-2026-0003"], 2026) === "PO-2026-0004");
  ok("a non-list is an empty list", nextGeneratedClientPo(null, 2026) === "PO-2026-0001");
  let threw = false;
  try { nextGeneratedClientPo([], "twenty"); } catch { threw = true; }
  ok("a year that is not a year throws rather than inventing one", threw);

  // The allocator reads the three client-PO columns, this company, this year —
  // and never a supplier purchase order.
  const db = fakeDb({
    quote: [{ companyId: "c1", clientPoNumber: "PO-2026-0012" }],
    job: [{ companyId: "c1", clientPoNumber: "PO-2026-0012" }],
    invoice: [{ companyId: "c1", clientPoNumber: "PO-2026-0013" }],
  });
  const value = await allocateGeneratedClientPo(db, { companyId: "c1", year: 2026 });
  ok("the allocator counts quotes, jobs and invoices together", value === "PO-2026-0014", value);
  ok("…and never reads the supplier purchaseOrder table", !db.__touched.has("purchaseOrder"));
  const src = decomment(read("lib/documents/clientPo.js"));
  ok("…company-scoped and shape-scoped, case-insensitive", /where = \{ companyId, clientPoNumber: \{ startsWith: clientPoStem\(f, year\), mode: "insensitive" \} \}/.test(src));

  const route = decomment(read("app/api/client-po/next/route.js"));
  ok("GET /api/client-po/next writes nothing", !/\.(create|update|upsert|delete)(Many)?\(/.test(route));
  ok("…and is gated on the document the button sits beside", /levelOrRefusal\(member, category, "view_create_edit"/.test(route) && /quote: "quotes", job: "jobs", invoice: "invoices"/.test(route));
  ok("the Generate button fills the box and saves nothing", /fetch\(`\/api\/client-po\/next\?for=\$\{encodeURIComponent\(kind\)\}`\)/.test(read("app/components/documents/ClientPoField.js")) && !/method: "(POST|PATCH)"/.test(read("app/components/documents/ClientPoField.js")));
}

// ══ 7. Supplier POs untouched ═════════════════════════════════════════════════
console.log("\n7. Supplier purchase orders — a different series, untouched\n");
{
  ok("the supplier series still counts up its own numbers", nextPoNumber(["PO-001", "PO-014"]) === "PO-015" && formatPoNumber(1) === "PO-001");
  ok("a supplier number is never mistaken for a generated client reference", nextGeneratedClientPo(["PO-001", "PO-2026"], 2026) === "PO-2026-0001");
  const schema = read("prisma/schema.prisma");
  const block = (name) => schema.slice(schema.indexOf(`model ${name} {`), schema.indexOf("\n}", schema.indexOf(`model ${name} {`)));
  ok("PurchaseOrder carries no client PO column", !/clientPoNumber/.test(block("PurchaseOrder")) && !/clientPoNumber/.test(block("PurchaseOrderLine")));
  ok("the client PO lives on Quote, Job and Invoice, and the rule on Client", ["Quote", "Job", "Invoice"].every((m) => /\n  clientPoNumber String\?\n/.test(block(m))) && /\n  requiresPo\s+Boolean\s+@default\(false\)(\n|$)/.test(block("Client")));
  const clientPoFiles = [
    "lib/documents/clientPo.js",
    "app/api/client-po/next/route.js",
    "app/components/documents/ClientPoField.js",
    "app/components/documents/ClientPoRequiredModal.js",
    "app/components/documents/ClientPoChip.js",
    "app/components/jobs/JobClientPo.js",
  ];
  ok("nothing in the client-PO code touches purchaseOrder / supplier rows", clientPoFiles.every((f) => !/purchaseOrder|purchase-orders|supplier/i.test(decomment(read(f)))));
  ok("the purchasing routes are not wired to the client PO", ["app/api/purchase-orders/route.js", "lib/purchasing/poNumber.js"].every((f) => !read(f).includes("clientPo")));
}

// ══ 8. The accounting export ═════════════════════════════════════════════════
console.log("\n8. The accounting export\n");
{
  const invoices = [
    { id: "i1", invoiceNumber: "INV-2026-0042", version: 1, parentInvoiceId: null, status: "sent", sentAt: "2026-01-10T12:00:00Z", createdAt: "2026-01-09T12:00:00Z", total: 1130, subtotal: 1000, tax: 130, discount: 0, taxEnabled: true, client: { name: "Northline" }, clientPoNumber: "=HYPERLINK(\"x\")" },
    { id: "i2", invoiceNumber: "INV-2026-0043", version: 1, parentInvoiceId: null, status: "sent", sentAt: "2026-01-11T12:00:00Z", createdAt: "2026-01-11T12:00:00Z", total: 500, subtotal: 500, tax: 0, discount: 0, taxEnabled: false, client: { name: "Jane" }, clientPoNumber: null },
  ];
  const result = buildAccountingExport({ invoices, payments: [], expenses: [], from: "2026-01-01", to: "2026-01-31", currency: "CAD" });
  const csv = result?.files?.find((f) => f.kind === "invoices")?.csv ?? "";
  const lines = String(csv).split("\r\n");
  ok("the invoice file has a Client PO column beside the invoice number", lines[0]?.startsWith("Invoice number,Client PO,Issued"), lines[0]);
  ok("the PO is in it, escaped against formula injection", lines.some((l) => l.startsWith("INV-2026-0042,") && l.includes("\t=HYPERLINK")), lines[1]);
  ok("an invoice with none has an empty cell, not a word", lines.some((l) => l.startsWith("INV-2026-0043,,")), lines[2]);
}

// ══ The request bodies: no PO, no key ═════════════════════════════════════════
console.log("\nThe builders' request bodies — untouched when no PO is involved\n");
{
  const q = { isEdit: true, subtotal: 1, appliedDiscount: 0, tax: 0, taxEnabled: true, total: 1, notes: "", reviewNotes: "", processNotes: "", validUntil: null, clientPhotos: [], siteAddress: "", groupsPayload: [], canEditScope: true, assignedToTouched: false, version: "v" };
  ok("quote: an untouched box adds no key (the doc-builder md5 holds)", same(quoteRequestBody(q), quoteRequestBody({ ...q, clientPoNumber: undefined })) && !("clientPoNumber" in quoteRequestBody(q)));
  ok("quote: a typed PO is sent, last", Object.keys(quoteRequestBody({ ...q, clientPoNumber: "4471" })).at(-1) === "clientPoNumber");
  ok("quote: the builder decides — a locked PO is passed as undefined and adds no key", !("clientPoNumber" in quoteRequestBody({ ...q, canEditScope: false, clientPoNumber: undefined })));
  ok("quote: a decided quote that never had a PO can be given one", quoteRequestBody({ ...q, canEditScope: false, clientPoNumber: "4471" }).clientPoNumber === "4471");
  const builder = read("app/components/quotes/builder/QuoteBuilder.js");
  ok("quote builder: locked only when decided AND already carrying a PO", /const clientPoLocked = Boolean\(isEdit\) && !OPEN_STATUSES\.includes\(start\.status\) && Boolean\(start\.clientPoNumber\);/.test(builder) && /clientPoNumber: \(clientPoTouched \|\| start\.clientPoNumber\) && !clientPoLocked \? clientPoNumber : undefined/.test(builder));
  ok("quote create: sent when typed", quoteRequestBody({ ...q, isEdit: false, clientPoNumber: "4471" }).clientPoNumber === "4471");
  const i = { clientId: "c", lineItems: [], subtotal: 1, tax: 0, taxEnabled: true, total: 1, notes: "", clientPhotos: [], dueDate: "", status: "draft" };
  ok("invoice create: no key unless given", !("clientPoNumber" in invoiceCreateBody(i)) && invoiceCreateBody({ ...i, clientPoNumber: "" }).clientPoNumber === "");
  ok("invoice edit: no key unless given", !("clientPoNumber" in invoicePatchBody({ lineItems: [], isDraft: true })) && invoicePatchBody({ lineItems: [], isDraft: true, clientPoNumber: "4471" }).clientPoNumber === "4471");
}

// ══ 9. "No PO, no invoice" — the held deposit ════════════════════════════════
console.log("\n9. The held deposit — held, prompted, released once\n");
{
  const northline = { id: "cl1", companyId: "c1", name: "Northline Property Management", email: "ap@northline.test", requiresPo: true };
  ok("hold: PO-required client, no PO, never sent", holdPaymentRequestForPo({ client: northline, invoice: { clientPoNumber: null, sentAt: null } }));
  ok("no hold: the invoice has a PO", !holdPaymentRequestForPo({ client: northline, invoice: { clientPoNumber: "NPM-1", sentAt: null } }));
  ok("no hold: a whitespace PO is no PO", holdPaymentRequestForPo({ client: northline, invoice: { clientPoNumber: "  ", sentAt: null } }));
  ok("no hold: a client without the rule (unchanged — sent immediately)", !holdPaymentRequestForPo({ client: { ...northline, requiresPo: false }, invoice: { clientPoNumber: null, sentAt: null } }));
  ok("no hold: an invoice ALREADY sent keeps being asked for (owner's rule 2)", !holdPaymentRequestForPo({ client: northline, invoice: { clientPoNumber: null, sentAt: "2026-10-01T00:00:00Z" } }));

  const seed = (over = {}) => ({
    company: [{ id: "c1", defaultLanguage: "en" }],
    member: [{ id: "m1", companyId: "c1", active: true, role: "owner", userId: "u-owner" }],
    client: [{ ...northline, ...(over.client || {}) }],
    invoice: [{ id: "inv1", companyId: "c1", clientId: "cl1", invoiceNumber: "INV-2026-0042", status: "draft", sentAt: null, clientPoNumber: null, ...(over.invoice || {}) }],
    job: [{ id: "j1", companyId: "c1" }],
    jobPaymentStage: [
      { id: "s1", companyId: "c1", jobId: "j1", invoiceId: "inv1", seq: 1, label: "Deposit", trigger: "on_invoice_created", status: "pending", amountCents: 150000, heldForPoAt: null, dueDate: null },
      { id: "s2", companyId: "c1", jobId: "j1", invoiceId: "inv1", seq: 2, label: "Balance", trigger: "job_end", status: "pending", amountCents: 350000, heldForPoAt: null, dueDate: "2027-01-01T00:00:00Z" },
    ],
    task: [],
  });

  // The automatic deposit request, through the shipped requestStagePayment.
  const db = fakeDb(seed());
  const first = await quietly(() => requestStagePayment("s1", { db }));
  ok("the deposit request is HELD, not sent", first.fired === false && first.reason === "po_required", first);
  const s1 = db.__rows.jobPaymentStage.find((s) => s.id === "s1");
  ok("…the stage stays pending, stamped held", s1.status === "pending" && Boolean(s1.heldForPoAt));
  ok("…the invoice stays a draft, never sent", db.__rows.invoice[0].status === "draft" && db.__rows.invoice[0].sentAt === null);
  ok("…nothing was minted on the way (no portal token written)", !db.__writes.some((w) => w.model === "client"));
  const task = db.__rows.task.find((t) => t.sourceKey === poHoldTaskKey("inv1"));
  ok("…the office gets a prompt naming the client and the request", Boolean(task) && task.title === "Northline Property Management requires a PO — add it to send the Deposit request" && task.priority === "high" && task.invoiceId === "inv1", task);
  const stamp = s1.heldForPoAt;
  const again = await quietly(() => requestStagePayment("s1", { db }));
  ok("the cron finding it again re-holds — same first stamp, still one task", again.reason === "po_required" && db.__rows.jobPaymentStage.find((s) => s.id === "s1").heldForPoAt === stamp && db.__rows.task.length === 1);

  // Release: two PO saves racing, then a third.
  let sends = 0;
  const fire = async (stageId) => {
    sends++;
    const s = db.__rows.jobPaymentStage.find((x) => x.id === stageId);
    s.status = "requested";
    return { fired: true, outcome: "requested" };
  };
  const [a, b] = await Promise.all([
    releaseHeldPaymentRequests(db, { invoiceIds: ["inv1"], fire }),
    releaseHeldPaymentRequests(db, { invoiceIds: ["inv1"], fire }),
  ]);
  ok("two PO saves racing send the held deposit exactly ONCE", sends === 1 && a.length + b.length === 1, { sends, a, b });
  const c = await releaseHeldPaymentRequests(db, { invoiceIds: ["inv1"], fire });
  ok("…a third save sends nothing", sends === 1 && c.length === 0);
  ok("…the stage is requested and no longer held", db.__rows.jobPaymentStage.find((s) => s.id === "s1").status === "requested" && db.__rows.jobPaymentStage.find((s) => s.id === "s1").heldForPoAt === null);
  ok("…and the prompt is answered", db.__rows.task.find((t) => t.sourceKey === poHoldTaskKey("inv1")).status === "done");

  // A later stage held by the cron and not yet due waits for its date.
  const later = fakeDb(seed());
  later.__rows.jobPaymentStage[1].heldForPoAt = "2026-10-02T00:00:00Z";
  let laterSends = 0;
  const r = await releaseHeldPaymentRequests(later, { invoiceIds: ["inv1"], fire: async () => (laterSends++, { fired: true }), now: new Date("2026-10-03T00:00:00Z") });
  ok("a held stage that is not yet due is unheld but not sent early", laterSends === 0 && r[0]?.result?.reason === "not_due" && later.__rows.jobPaymentStage[1].heldForPoAt === null);
  ok("release touches only the invoices it is given", (await releaseHeldPaymentRequests(fakeDb(seed()), { invoiceIds: ["other"], fire })).length === 0);

  // The other clients: unchanged. No company row in these fixtures, so a
  // request that is NOT held stops at "no_company" — past the hold, short of
  // the real email — which is exactly the line being tested.
  const plain = fakeDb({ ...seed({ client: { requiresPo: false } }), company: [] });
  const p = await quietly(() => requestStagePayment("s1", { db: plain }));
  ok("a client without the rule is not held (the request carries on to the send)", p.reason === "no_company" && plain.__rows.jobPaymentStage[0].heldForPoAt === null && plain.__rows.task.length === 0, p);
  const sent = fakeDb({ ...seed({ invoice: { sentAt: "2026-10-01T00:00:00Z", status: "sent" } }), company: [] });
  const q = await quietly(() => requestStagePayment("s1", { db: sent }));
  ok("an invoice already sent is not held (rule 2)", q.reason === "no_company" && sent.__rows.jobPaymentStage[0].heldForPoAt === null, q);
  const withPo = fakeDb({ ...seed({ invoice: { clientPoNumber: "NPM-77812" } }), company: [] });
  const w = await quietly(() => requestStagePayment("s1", { db: withPo }));
  ok("a PO-required client whose invoice carries the PO is sent immediately", w.reason === "no_company" && withPo.__rows.task.length === 0, w);

  // Where the hold and the release are wired.
  const run = decomment(read("lib/paymentSchedule/run.js"));
  ok("requestStagePayment holds after the $0 waiver and before anything is minted or sent", (() => {
    const at = (re) => run.search(re);
    return at(/outcome: "waived"/) < at(/holdStageIfPoMissing\(prisma, stage\)/) && at(/holdStageIfPoMissing\(prisma, stage\)/) < at(/ensurePortalToken\(prisma/) && at(/holdStageIfPoMissing\(prisma, stage\)/) < at(/sendEmail\(\{/);
  })());
  ok("…a stage sent by any path is no longer held", /status: "requested", requestedAt: new Date\(\), heldForPoAt: null/.test(run));
  ok("…and releaseHeldForPo sends through requestStagePayment, never throwing", /fire: \(stageId\) => requestStagePayment\(stageId, \{ db: prisma \}\)/.test(run) && /export async function releaseHeldForPo[\s\S]*?catch \(err\)/.test(run));
  ok("entering the PO on the JOB releases it (after the drafts carry it)", /data: \{ clientPoNumber \},\s*\}\);[\s\S]{0,400}if \(clientPoNumber\) await releaseHeldForPo\(\{ job: existing \}\)/.test(decomment(read("app/api/jobs/[id]/route.js"))));
  ok("entering it on the INVOICE (a draft) releases it", /if \(clientPoNumber\) await releaseHeldForPo\(\{ invoiceIds: \[existing\.parentInvoiceId \|\| id\] \}\)/.test(decomment(read("app/api/invoices/[id]/route.js"))));
  const quoteRoute = decomment(read("app/api/quotes/[id]/route.js"));
  ok("entering it on the accepted QUOTE carries it to the job and its drafts, then releases", /poAddedAfterDecision && existing\.status === "accepted"/.test(quoteRoute) && /clientPoNumber: null \},[\s\S]*?db\.job\.update[\s\S]*?draftInvoicesFollowingJobPo\(\{ job, previousPo: null \}\)[\s\S]*?releaseHeldForPo\(\{ job \}\)/.test(quoteRoute));
  ok("…a decided quote may be GIVEN a PO it never had, but not have one changed", /const poAddedAfterDecision =\s*poChanging && !\["draft", "sent"\]\.includes\(existing\.status\) && !normaliseClientPo\(existing\.clientPoNumber\) && Boolean\(clientPoNumber\)/.test(quoteRoute) && /if \(poChanging && !\["draft", "sent"\]\.includes\(existing\.status\) && !poAddedAfterDecision\)/.test(quoteRoute));
  const sendRoute = decomment(read("app/api/invoices/[id]/send/route.js"));
  ok("a person sending the invoice answers the hold (with the PO or deliberately without)", /heldForPoAt: \{ not: null \} \},\s*data: \{ heldForPoAt: null \}/.test(sendRoute) && /resolveTaskBySource\(poHoldTaskKey\(invoice\.id\)\)/.test(sendRoute));

  // The prompt on the invoice page.
  const inv = { id: "inv1", status: "draft", sentAt: null, total: 5000, amountDue: 5000, amountPaid: 0, clientPoNumber: null, client: { name: "Northline Property Management", email: "ap@n.test" } };
  const banners = selectInvoiceBanners({ invoice: inv, job: null, poHold: { label: "Deposit", heldForPoAt: "2026-10-03T00:00:00Z" } });
  const held = banners.find((x) => x.id === "heldForPo");
  ok("the invoice page says the request is held, and offers to add the PO", held?.action === "addPo" && held.data.clientName === "Northline Property Management" && held.data.stageLabel === "Deposit" && held.data.invoiceId === "inv1", held);
  ok("…it reads before 'not sent' — it is the reason", banners.findIndex((x) => x.id === "heldForPo") < banners.findIndex((x) => x.id === "unsent"));
  ok("…and goes once the invoice has a PO or has been sent", !selectInvoiceBanners({ invoice: { ...inv, clientPoNumber: "N-1" }, poHold: { label: "Deposit" } }).some((x) => x.id === "heldForPo") && !selectInvoiceBanners({ invoice: { ...inv, status: "sent", sentAt: "2026-10-03" }, poHold: { label: "Deposit" } }).some((x) => x.id === "heldForPo"));
  ok("…no hold, no banner", !selectInvoiceBanners({ invoice: inv }).some((x) => x.id === "heldForPo"));
  const renderer = read("app/app/invoices/[id]/LifecycleBanners.js");
  ok("…the renderer has its sentence and a working action (a link to the PO box)", /case "heldForPo":/.test(renderer) && /addPo: "app\.invoiceLifecycle\.actionAddPo"/.test(renderer) && /banner\.action === "addPo" && d\.invoiceId/.test(renderer));
  ok("…the lifecycle route finds the held stage on the family root", /invoiceId: rootId, status: "pending", heldForPoAt: \{ not: null \}/.test(decomment(read("app/api/invoices/[id]/lifecycle/route.js"))));
  ok("the job's payment schedule says the stage is held", /stage\.status === "pending" && stage\.heldForPoAt &&\s*t\("app\.job\.paymentSchedule\.heldForPo"\)/.test(read("app/app/jobs/[id]/PaymentScheduleCard.js")));
  for (const k of ["app.autoTask.poHold.title", "app.autoTask.poHold.desc", "app.invoiceLifecycle.heldForPo", "app.invoiceLifecycle.actionAddPo", "app.job.paymentSchedule.heldForPo"]) {
    ok(`${k} in every app language`, Object.values(APP_MESSAGES).every((m) => typeof m[k] === "string" && m[k].trim()));
  }
  ok("the task and the banner name the client and the request in every language", Object.values(APP_MESSAGES).every((m) => ["app.autoTask.poHold.title", "app.invoiceLifecycle.heldForPo"].every((k) => m[k].includes("{client}") && m[k].includes("{stage}"))));
}

// ══ 10. The reference format ══════════════════════════════════════════════════
console.log("\n10. The generated reference's format — the company's setting\n");
{
  ok("defaults: PO-, the year, 4 digits", same(readClientPoFormat(null), { prefix: "PO-", includeYear: true, digits: 4 }));
  ok("a Company row is read", same(readClientPoFormat({ clientPoPrefix: "REF-", clientPoIncludeYear: false, clientPoDigits: 3 }), { prefix: "REF-", includeYear: false, digits: 3 }));
  ok("a broken row generates the default shape, never nothing", same(readClientPoFormat({ clientPoPrefix: "x".repeat(40), clientPoIncludeYear: "yes", clientPoDigits: 99 }), { prefix: "PO-", includeYear: true, digits: 4 }));
  ok("format: PO-2026-0042", formatGeneratedClientPo(null, 2026, 42) === "PO-2026-0042");
  ok("format: REF-007 (no year, 3 digits)", formatGeneratedClientPo({ prefix: "REF-", includeYear: false, digits: 3 }, 2026, 7) === "REF-007");
  ok("format: no prefix, the year — 2026-00042", formatGeneratedClientPo({ prefix: "", includeYear: true, digits: 5 }, 2026, 42) === "2026-00042");
  ok("padding is a floor, never a ceiling", formatGeneratedClientPo({ prefix: "J", includeYear: false, digits: 2 }, 2026, 1234) === "J1234");

  ok("validate: a good format passes", validateClientPoFormat({ prefix: "REF-", includeYear: false, digits: 3 }).ok);
  ok("validate: partial input keeps the rest", same(validateClientPoFormat({ digits: 6 }, { prefix: "WO/", includeYear: false, digits: 4 }).format, { prefix: "WO/", includeYear: false, digits: 6 }));
  ok("validate: prefix trimmed", validateClientPoFormat({ prefix: "  ABC-  " }).format?.prefix === "ABC-");
  ok("validate: a prefix too long, or with markup / quotes / newlines, is refused", ["x".repeat(13), "<b>", 'P"O', "P\nO"].every((v) => !validateClientPoFormat({ prefix: v }).ok));
  ok("validate: digits outside 1–8 or not whole are refused", [0, 9, 2.5, "x", null].every((v) => !validateClientPoFormat({ digits: v }).ok));
  ok("validate: includeYear must be a boolean", !validateClientPoFormat({ includeYear: "yes" }).ok);
  ok("validate: no prefix AND no year is refused (it would read a client's '4471' as ours)", !validateClientPoFormat({ prefix: "", includeYear: false }).ok);

  const ref = { prefix: "REF-", includeYear: false, digits: 3 };
  ok("the sequence counts only its own shape", nextGeneratedClientPo(["REF-007", "REF-003", "PO-2026-0042", "4471", "REF-9A"], 2026, ref) === "REF-008");
  ok("existing values never change: after a switch, the old shape is left alone and the new one starts at 1", nextGeneratedClientPo(["PO-2026-0042", "PO-2026-0043"], 2026, ref) === "REF-001");
  ok("a prefix with regex characters is matched literally", nextGeneratedClientPo(["P.O#2026-0009", "PXO#2026-0050"], 2026, { prefix: "P.O#", includeYear: true, digits: 4 }) === "P.O#2026-0010");
  ok("the default format behaves exactly as before", nextGeneratedClientPo(["PO-2026-0041"], 2026) === "PO-2026-0042");

  const db = fakeDb({
    company: [{ id: "c1", clientPoPrefix: "REF-", clientPoIncludeYear: false, clientPoDigits: 3 }],
    quote: [{ companyId: "c1", clientPoNumber: "REF-011" }, { companyId: "c1", clientPoNumber: "PO-2026-0090" }],
    job: [{ companyId: "c1", clientPoNumber: "ref-012" }],
    invoice: [{ companyId: "c2", clientPoNumber: "REF-500" }],
  });
  const next = await allocateGeneratedClientPo(db, { companyId: "c1", year: 2026 });
  ok("Generate uses the company's format, counts its own references only (not another company's)", next === "REF-013", next);
  ok("…and still never reads supplier purchase orders", !db.__touched.has("purchaseOrder"));

  const route = decomment(read("app/api/settings/client-po-format/route.js"));
  ok("PATCH /api/settings/client-po-format is owners/admins, validated, and writes only the three columns", /requirePermission\(member\.role, "user:manage"\)/.test(route) && /validateClientPoFormat\(body, readClientPoFormat\(current\)\)/.test(route) && /data: \{ clientPoPrefix: prefix, clientPoIncludeYear: includeYear, clientPoDigits: digits \}/.test(route));
  ok("…it rewrites no document (no quote/job/invoice write)", !/db\.(quote|job|invoice)\.(update|updateMany|create)/.test(route));
  const editor = read("app/app/settings/company/ClientPoFormatEditor.js");
  ok("the settings card previews with the SAME function the server generates with", /formatGeneratedClientPo\(verdict\.format, year, 1\)/.test(editor) && /validateClientPoFormat\(form, CLIENT_PO_FORMAT_DEFAULT\)/.test(editor));
  ok("…and is on the company settings page", /<ClientPoFormatEditor canEdit=\{canEdit\} \/>/.test(read("app/app/settings/company/page.js")));
  ok("the Generate route reads the company's format (no format passed)", /allocateGeneratedClientPo\(db, \{ companyId: member\.companyId \}\)/.test(decomment(read("app/api/client-po/next/route.js"))));
  for (const k of ["app.clientPoFormat.title", "app.clientPoFormat.desc", "app.clientPoFormat.prefix", "app.clientPoFormat.digits", "app.clientPoFormat.includeYear", "app.clientPoFormat.preview", "app.clientPoFormat.next", "app.clientPoFormat.existingNote", "app.clientPoFormat.loadError", "app.clientPoFormat.saveError"]) {
    ok(`${k} in every app language`, Object.values(APP_MESSAGES).every((m) => typeof m[k] === "string" && m[k].trim()));
  }
  const schema = read("prisma/schema.prisma");
  ok("the format and the hold are additive columns with the stated defaults", /clientPoPrefix\s+String\s+@default\("PO-"\)/.test(schema) && /clientPoIncludeYear Boolean @default\(true\)/.test(schema) && /clientPoDigits\s+Int\s+@default\(4\)/.test(schema) && /\n  heldForPoAt DateTime\?\n/.test(schema));
}

// ══ White-label ═══════════════════════════════════════════════════════════════
{
  const printed = Object.values(DOCUMENT_LABELS).map((l) => l.poNumber).join(" ");
  ok("no client-facing PO label says FieldQuo", !/fieldquo/i.test(printed));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
