// scripts/check-job-documents-autofile.mjs
//
// The documents and photos a job is born with, executed.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-job-documents-autofile.mjs
//
// ══ The owner's ask ════════════════════════════════════════════════════════
//
// "The job should have the original quote, the approved contract and invoice
// as part of the documents", and the quote's pictures "should land in the
// job too". Until this work the only writer of JobDocument was the upload
// form, and nothing copied Quote.clientPhotos anywhere.
//
// ══ What this executes ═════════════════════════════════════════════════════
//
// The REAL lib/jobs/documentAutofile.js and lib/jobs/photoAutofile.js against
// an in-memory client that enforces the two unique keys the schema adds, with
// a fake renderer and a fake uploader so no PDF engine and no Cloudinary are
// needed. Every claim below is a claim about rows written, rows refused, or
// an error row logged — none is a claim read off the source, except the
// wiring section at the end, which asserts the call sites exist because a
// helper nobody calls is the failure this repo keeps finding.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  fileAcceptanceDocuments,
  fileSentInvoiceDocument,
  hashInvoiceDocument,
  acceptanceDocumentPlan,
  pendingAcceptanceDocuments,
  AUTOFILE_SOURCES,
} from "@/lib/jobs/documentAutofile";
import { fileQuotePhotosOnJob, quotePhotosToCarry, quotePhotoCaption, QUOTE_PHOTO_STAGE } from "@/lib/jobs/photoAutofile";
import { DOCUMENT_KINDS, MONEY_KINDS, AUTOFILED_KINDS, visibleDocuments, canSeeKind, revisionChains } from "@/lib/jobs/documents";
import { hashQuote } from "@/lib/documents/signatureAudit";
import { STAGES } from "@/lib/gallery/stages";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (name, got, want = true) => {
  const good = String(got) === String(want);
  if (good) pass++;
  else fail++;
  console.log(`${good ? "  ok  " : "  FAIL"} ${name}${good ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const section = (s) => console.log(`\n${s}`);

// ═══════════════════════════════════════════════════════════════════════════
// An in-memory client with the constraints that matter
// ═══════════════════════════════════════════════════════════════════════════

const CLOUD = "fqtest";
const ours = (name) => `https://res.cloudinary.com/${CLOUD}/raw/upload/${name}`;
const ourImg = (name) => `https://res.cloudinary.com/${CLOUD}/image/upload/${name}.jpg`;

function matches(row, where) {
  for (const [k, cond] of Object.entries(where || {})) {
    if (cond === undefined) continue;
    if (k === "OR") {
      if (!cond.some((c) => matches(row, c))) return false;
      continue;
    }
    const v = row[k];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) {
        if (!cond.in.includes(v)) return false;
        continue;
      }
      throw new Error(`memdb: unsupported condition on ${k}: ${JSON.stringify(cond)}`);
    }
    if (v !== cond) return false;
  }
  return true;
}

function pick(row, select) {
  if (!select) return { ...row };
  const out = {};
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue;
    if (v === true) out[k] = row[k];
    else if (row[k] && typeof v === "object" && v.select) out[k] = pick(row[k], v.select);
    else out[k] = row[k];
  }
  return out;
}

function makeDb() {
  let seq = 0;
  const id = (p) => `${p}_${++seq}`;
  const rows = { quote: [], job: [], jobDocument: [], invoice: [], jobPhoto: [], company: [] };
  const uniques = new Set();
  const uniqueKey = (r) => [
    r.sourceQuoteId ? `q|${r.sourceQuoteId}|${r.kind}|${r.documentHash}` : null,
    r.sourceInvoiceId ? `i|${r.sourceInvoiceId}|${r.kind}|${r.documentHash}` : null,
    r.supersedesId ? `s|${r.supersedesId}` : null,
  ].filter(Boolean);

  const withRelations = (row, include) => {
    const out = { ...row };
    if (include?.client) out.client = row.client || { name: "Dana Homeowner" };
    if (include?.company) out.company = rows.company.find((c) => c.id === row.companyId) || null;
    if (include?.scopeGroups) out.scopeGroups = row.scopeGroups || [];
    if (include?.addOns) out.addOns = row.addOns || [];
    return out;
  };

  const db = {
    rows,
    calls: [],
    quote: {
      findUnique: async ({ where, select, include }) => {
        db.calls.push("quote.findUnique");
        const row = rows.quote.find((q) => q.id === where.id);
        if (!row) return null;
        const full = withRelations(row, { ...select, ...include });
        return select ? pick(full, select) : full;
      },
    },
    job: {
      findFirst: async ({ where, select }) => {
        db.calls.push("job.findFirst");
        const { orderBy, ...w } = where;
        const row = rows.job.find((j) => matches(j, w));
        return row ? pick(row, select) : null;
      },
    },
    invoice: {
      findUnique: async ({ where, select, include }) => {
        db.calls.push("invoice.findUnique");
        const row = rows.invoice.find((i) => i.id === where.id);
        if (!row) return null;
        const full = withRelations(row, include);
        return select ? pick(full, select) : full;
      },
      findMany: async ({ where, select, orderBy }) => {
        const list = rows.invoice.filter((i) => matches(i, where));
        if (orderBy?.version) list.sort((a, b) => a.version - b.version);
        return list.map((r) => pick(r, select));
      },
    },
    jobDocument: {
      findMany: async ({ where, select }) => {
        db.calls.push("jobDocument.findMany");
        return rows.jobDocument.filter((d) => matches(d, where)).map((r) => pick(r, select));
      },
      create: async ({ data, select }) => {
        db.calls.push("jobDocument.create");
        const row = { id: id("doc"), uploadedAt: new Date(Date.now() + seq), ...data };
        for (const k of uniqueKey(row)) {
          if (uniques.has(k)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        for (const k of uniqueKey(row)) uniques.add(k);
        rows.jobDocument.push(row);
        return pick(row, select);
      },
    },
    jobPhoto: {
      findMany: async ({ where, select }) => rows.jobPhoto.filter((p) => matches(p, where)).map((r) => pick(r, select)),
      createMany: async ({ data }) => {
        db.calls.push("jobPhoto.createMany");
        for (const d of data) rows.jobPhoto.push({ id: id("photo"), ...d });
        return { count: data.length };
      },
    },
    $transaction: async (fn) => fn({ ...db, $queryRaw: async () => [] }),
  };
  return db;
}

// A renderer and an uploader that record what they were asked for.
function makeDeps(db, { renderFails = [], uploadFails = false, language = "en" } = {}) {
  const renders = [];
  const uploads = [];
  const errors = [];
  return {
    renders,
    uploads,
    errors,
    deps: {
      db,
      cloudName: CLOUD,
      render: async (kind, ctx) => {
        renders.push(kind);
        if (renderFails.includes(kind)) throw new Error(`pdf engine down for ${kind}`);
        return Buffer.from(`PDF:${kind}:${ctx.quote?.id || ctx.invoice?.id}`);
      },
      upload: async (buffer, { folder, publicId }) => {
        uploads.push({ folder, publicId, bytes: buffer.length, text: buffer.toString() });
        if (uploadFails) throw new Error("cloudinary 500");
        return { url: ours(`${folder}/${publicId}.pdf`), bytes: buffer.length };
      },
      recordError: async (payload) => {
        errors.push(payload);
      },
      sentence: async (lang, key, params) => {
        const raw = (APP_MESSAGES[lang] || {})[key] ?? APP_MESSAGES.en[key];
        if (raw == null) return null;
        return Object.entries(params || {}).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), String(raw));
      },
    },
  };
}

const SIGNATURE = (quote) => ({
  name: "Dana Homeowner",
  signatureDataUrl: "data:image/png;base64,AAA",
  consent: true,
  signedAt: "2026-09-18T15:00:00.000Z",
  documentHash: hashQuote(quote),
});

function seed(db, { signed = true, companyLanguage = "en", photos = null } = {}) {
  db.rows.company.push({ id: "co_a", defaultLanguage: companyLanguage }, { id: "co_b", defaultLanguage: "en" });
  const quote = {
    id: "q_1",
    companyId: "co_a",
    clientId: "cl_1",
    quoteNumber: "Q-0042",
    status: "accepted",
    // No `currency` — Quote has no such column (the company's is used), and
    // a fixture column the select cannot read would make the hash lie here.
    subtotal: "1000.00",
    tax: "130.00",
    total: "1130.00",
    acceptedSubtotal: "1200.00",
    acceptedTax: "156.00",
    acceptedTotal: "1356.00",
    lineItems: [{ description: "Paint the hall", amount: 1000 }],
    scopeGroups: [],
    addOns: [{ id: "ao_1", price: "200.00", selected: true }],
    language: "en",
    clientPhotos: photos,
  };
  quote.signature = signed ? SIGNATURE(quote) : null;
  db.rows.quote.push(quote);
  db.rows.job.push({ id: "job_1", companyId: "co_a", quoteId: "q_1" });
  // Another tenant's job, and this tenant's job for a different quote.
  db.rows.job.push({ id: "job_other_tenant", companyId: "co_b", quoteId: "q_1" });
  db.rows.job.push({ id: "job_other_quote", companyId: "co_a", quoteId: "q_9" });
  return quote;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. an acceptance files the quote as sent and the signed contract, once");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = makeDb();
  const quote = seed(db);
  const { deps, renders, uploads, errors } = makeDeps(db);

  const first = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, deps);
  ok("two rows filed", first.filed.length, 2);
  ok("nothing failed", first.failed.length, 0);
  ok("nothing refused", first.refused, null);
  const kinds = db.rows.jobDocument.map((d) => d.kind).sort().join(",");
  ok("the kinds are contract + quote", kinds, "contract,quote");

  const contract = db.rows.jobDocument.find((d) => d.kind === "contract");
  const asSent = db.rows.jobDocument.find((d) => d.kind === "quote");
  ok('the contract is titled "Signed contract — Q-0042"', contract.name, "Signed contract — Q-0042");
  ok('the quote is titled "Quote Q-0042"', asSent.name, "Quote Q-0042");
  ok("both point at the job", contract.jobId === "job_1" && asSent.jobId === "job_1");
  ok("both belong to the quote's tenant", contract.companyId === "co_a" && asSent.companyId === "co_a");
  ok('both carry source "acceptance"', contract.source === AUTOFILE_SOURCES.acceptance && asSent.source === "acceptance");
  ok("both name the quote they came from", contract.sourceQuoteId === "q_1" && asSent.sourceQuoteId === "q_1");
  ok("the contract's hash is the one the client signed", contract.documentHash, quote.signature.documentHash);
  ok("the as-sent quote's hash is the quote's content hash", asSent.documentHash, hashQuote(quote));
  ok("no uploadedById on the client's door", contract.uploadedById, null);
  ok("both urls are on our own cloud", db.rows.jobDocument.every((d) => d.url.startsWith(`https://res.cloudinary.com/${CLOUD}/`)));
  ok("both are PDFs", db.rows.jobDocument.every((d) => d.mimeType === "application/pdf"));
  ok("sizeBytes is the uploaded byte count, never 0", db.rows.jobDocument.every((d) => d.sizeBytes > 0));
  ok("the as-sent quote shares the Download-PDF archive key", uploads.some((u) => u.publicId === `Q-0042-${hashQuote(quote).slice(0, 12)}`));
  ok("the contract has its own key", uploads.some((u) => u.publicId.startsWith("Q-0042-signed-")));
  ok("the folder is the quotes folder", uploads.every((u) => u.folder === "fieldquo/co_a/quotes"));
  ok("the renderer ran once per document", renders.sort().join(","), "contract,quote");
  ok("no error was logged", errors.length, 0);

  // ── The second run ───────────────────────────────────────────────────────
  renders.length = 0;
  uploads.length = 0;
  const second = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, deps);
  ok("a second acceptance files nothing", second.filed.length, 0);
  ok("and reports both as already there", second.skipped.sort().join(","), "contract,quote");
  ok("still two rows", db.rows.jobDocument.length, 2);
  ok("nothing was rendered the second time", renders.length, 0);
  ok("nothing was uploaded the second time", uploads.length, 0);
  ok("and nothing was logged", errors.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. the signed PDF the emails carried is the one filed, unrendered");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = makeDb();
  seed(db);
  const { deps, renders, uploads } = makeDeps(db);
  const signedPdf = Buffer.from("PDF:the-very-bytes-emailed");
  const r = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1", signedPdf }, deps);
  ok("two rows filed", r.filed.length, 2);
  ok("only the quote was rendered", renders.join(","), "quote");
  ok("the contract upload carried the emailed bytes", uploads.find((u) => u.publicId.includes("signed")).text, "PDF:the-very-bytes-emailed");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. a render failure logs and does not throw — the other document still lands");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = makeDb();
  seed(db);
  const { deps, errors } = makeDeps(db, { renderFails: ["contract"] });
  let threw = false;
  let r;
  try {
    r = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, deps);
  } catch {
    threw = true;
  }
  ok("did not throw", threw, false);
  ok("the quote was still filed", r.filed.map((d) => d.kind).join(","), "quote");
  ok("the contract is reported failed", r.failed.join(","), "contract");
  ok("one error row", errors.length, 1);
  ok('area "job_documents"', errors[0].area, "job_documents");
  ok("code names the contract render", errors[0].code, "contract_render_failed");
  ok("the tenant is on the error row", errors[0].companyId, "co_a");
  ok("the message names the quote", /Q-0042/.test(errors[0].message));

  // Once the engine is back, the next look files the missing one and only it.
  const back = makeDeps(db);
  const again = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, back.deps);
  ok("the retry files the contract", again.filed.map((d) => d.kind).join(","), "contract");
  ok("and not the quote again", again.skipped.join(","), "quote");
  ok("now two rows", db.rows.jobDocument.length, 2);
}

{
  const db = makeDb();
  seed(db);
  const { deps, errors } = makeDeps(db, { uploadFails: true });
  const r = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, deps);
  ok("an uploader outage files nothing", db.rows.jobDocument.length, 0);
  ok("both reported failed", r.failed.sort().join(","), "contract,quote");
  ok("two error rows, one per document", errors.length, 2);
  ok("both in the job_documents area", errors.every((e) => e.area === "job_documents"));
}

{
  // The uploader answers with a URL that is not on our cloud.
  const db = makeDb();
  seed(db);
  const { deps, errors } = makeDeps(db);
  deps.upload = async () => ({ url: "https://evil.example/contract.pdf", bytes: 10 });
  await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, deps);
  ok("a foreign URL is never filed", db.rows.jobDocument.length, 0);
  ok("and is logged", errors.length, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. two acceptances at once: the unique key decides, and it is not an error");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = makeDb();
  seed(db);
  const a = makeDeps(db);
  const b = makeDeps(db);
  const [ra, rb] = await Promise.all([
    fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, a.deps),
    fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, b.deps),
  ]);
  ok("exactly two rows between the two", db.rows.jobDocument.length, 2);
  ok("four filings attempted, two won", ra.filed.length + rb.filed.length, 2);
  ok("the losers are skipped, not failed", ra.failed.length + rb.failed.length, 0);
  ok("no error logged for the race", a.errors.length + b.errors.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. the back-office door: no signature, still a contract, honestly titled");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = makeDb();
  seed(db, { signed: false });
  const { deps } = makeDeps(db);
  const r = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1", byUserId: "user_dana" }, deps);
  ok("two rows", r.filed.length, 2);
  const contract = db.rows.jobDocument.find((d) => d.kind === "contract");
  ok('titled "Approved contract — Q-0042", not "Signed"', contract.name, "Approved contract — Q-0042");
  ok("attributed to the staff member who recorded it", contract.uploadedById, "user_dana");
  ok("its hash is the quote's content", contract.documentHash, hashQuote(db.rows.quote[0]));
}

{
  const db = makeDb();
  seed(db, { companyLanguage: "fr" });
  const { deps } = makeDeps(db);
  await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, deps);
  ok("titles are in the office's language", db.rows.jobDocument.map((d) => d.name).sort().join(" | "), "Contrat signé — Q-0042 | Soumission Q-0042");
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. the backfill: signed contracts only, and never a duplicate of a hand upload");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = makeDb();
  seed(db, { signed: false });
  const { deps, renders } = makeDeps(db);
  const r = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1", source: AUTOFILE_SOURCES.backfill, contractRequiresSignature: true }, deps);
  ok("an unsigned acceptance backfills the quote only", r.filed.map((d) => d.kind).join(","), "quote");
  ok("the contract is skipped, not failed", r.skipped.includes("contract") && !r.failed.length);
  ok("the contract was never rendered", renders.includes("contract"), false);
  ok('the row says "backfill"', db.rows.jobDocument[0].source, "backfill");
}

{
  const db = makeDb();
  seed(db);
  // The office already uploaded the signed contract by hand last month.
  db.rows.jobDocument.push({ id: "hand_1", companyId: "co_a", jobId: "job_1", kind: "contract", url: ours("hand.pdf"), source: null, sourceQuoteId: null, documentHash: null });
  const { deps } = makeDeps(db);
  const r = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1", source: AUTOFILE_SOURCES.backfill, contractRequiresSignature: true }, deps);
  ok("the backfill does not file a second contract beside the hand-uploaded one", r.filed.map((d) => d.kind).join(","), "quote");
  ok("still one contract on the job", db.rows.jobDocument.filter((d) => d.kind === "contract").length, 1);

  // But a LIVE acceptance keys on content, so a hand upload does not stop it.
  const db2 = makeDb();
  seed(db2);
  db2.rows.jobDocument.push({ id: "hand_1", companyId: "co_a", jobId: "job_1", kind: "contract", url: ours("hand.pdf"), source: null, sourceQuoteId: null, documentHash: null });
  const r2 = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, makeDeps(db2).deps);
  ok("a live acceptance files its own contract regardless", r2.filed.map((d) => d.kind).sort().join(","), "contract,quote");
}

{
  const db = makeDb();
  seed(db);
  const { deps, renders } = makeDeps(db);
  await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, deps);
  renders.length = 0;
  const r = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1", source: AUTOFILE_SOURCES.backfill, contractRequiresSignature: true }, deps);
  ok("a backfill after a live acceptance is a no-op", r.filed.length === 0 && renders.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. a job that is not this quote's own is refused, in either direction");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = makeDb();
  seed(db);
  const { deps, renders, errors } = makeDeps(db);
  const r1 = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_other_tenant" }, deps);
  ok("another tenant's job is refused", r1.refused, "job_not_for_quote");
  const r2 = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_other_quote" }, deps);
  ok("this tenant's job for another quote is refused", r2.refused, "job_not_for_quote");
  const r3 = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_nope" }, deps);
  ok("an unknown job is refused", r3.refused, "job_not_for_quote");
  ok("nothing rendered", renders.length, 0);
  ok("nothing filed", db.rows.jobDocument.length, 0);
  ok("a refusal is not an error row", errors.length, 0);

  db.rows.quote[0].status = "sent";
  const r4 = await fileAcceptanceDocuments({ quoteId: "q_1", jobId: "job_1" }, deps);
  ok("a quote that is not accepted files nothing", r4.refused, "not_accepted");
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. an invoice send files the invoice; a re-send supersedes; a retry no-ops");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = makeDb();
  seed(db);
  const sentAt = new Date("2026-09-19T10:00:00Z");
  db.rows.invoice.push({
    id: "inv_1",
    companyId: "co_a",
    invoiceNumber: "INV-0007",
    version: 1,
    parentInvoiceId: null,
    quoteId: "q_1",
    jobId: null,
    subtotal: "1200.00",
    tax: "156.00",
    total: "1356.00",
    amountPaid: "0.00",
    lineItems: [{ description: "Paint the hall", amount: 1200 }],
    sentAt,
  });
  const { deps, renders, uploads, errors } = makeDeps(db);

  const first = await fileSentInvoiceDocument({ invoiceId: "inv_1", byUserId: "user_dana" }, deps);
  ok("a row was filed", Boolean(first.row));
  ok("kind invoice", first.row.kind, "invoice");
  ok('titled "Invoice INV-0007"', first.row.name, "Invoice INV-0007");
  ok("the job was found through the quote (no Invoice.jobId)", db.rows.jobDocument[0].jobId, "job_1");
  ok('source "invoice_send"', db.rows.jobDocument[0].source, AUTOFILE_SOURCES.invoiceSend);
  ok("names the invoice", db.rows.jobDocument[0].sourceInvoiceId, "inv_1");
  ok("first send supersedes nothing", first.row.supersedesId, null);
  ok("attributed to the sender", db.rows.jobDocument[0].uploadedById, "user_dana");
  ok("in the invoices folder", uploads[0].folder, "fieldquo/co_a/invoices");
  ok("rendered as an invoice", renders.join(","), "invoice");

  // The same send, filed again (a retried request): nothing.
  const retry = await fileSentInvoiceDocument({ invoiceId: "inv_1" }, deps);
  ok("a retry of the same send files nothing", retry.row, null);
  ok("and says why", retry.reason, "already_filed");
  ok("still one row", db.rows.jobDocument.length, 1);

  // A re-send a day later: a NEW row superseding the first.
  db.rows.invoice[0].sentAt = new Date("2026-09-20T10:00:00Z");
  const resend = await fileSentInvoiceDocument({ invoiceId: "inv_1" }, deps);
  ok("a re-send files a new row", Boolean(resend.row));
  ok("which supersedes the first", resend.row.supersedesId, first.row.id);
  ok("two rows now", db.rows.jobDocument.length, 2);
  const chains = revisionChains(db.rows.jobDocument);
  ok("one chain, two revisions", chains.length === 1 && chains[0].history.length === 1);
  ok("the head is the re-send", chains[0].current.id, resend.row.id);

  // An amended invoice — v2, its own row — supersedes the document v1 was sent as.
  db.rows.invoice.push({ ...db.rows.invoice[0], id: "inv_2", version: 2, parentInvoiceId: "inv_1", total: "1400.00", sentAt: new Date("2026-09-21T10:00:00Z") });
  const v2 = await fileSentInvoiceDocument({ invoiceId: "inv_2" }, deps);
  ok("the amended invoice's send files a row", Boolean(v2.row));
  ok("superseding the previous version's document", v2.row.supersedesId, resend.row.id);
  ok("three rows, one chain", revisionChains(db.rows.jobDocument).length, 1);
  ok("no error logged across sends", errors.length, 0);
}

{
  const db = makeDb();
  seed(db);
  db.rows.invoice.push({ id: "inv_lonely", companyId: "co_a", invoiceNumber: "INV-0008", version: 1, quoteId: null, jobId: null, total: "10.00", sentAt: new Date() });
  const { deps, renders } = makeDeps(db);
  const r = await fileSentInvoiceDocument({ invoiceId: "inv_lonely" }, deps);
  ok("an invoice with no job files nothing", r.row, null);
  ok("and says so", r.reason, "no_job");
  ok("without rendering", renders.length, 0);

  db.rows.invoice.push({ id: "inv_unsent", companyId: "co_a", invoiceNumber: "INV-0009", version: 1, quoteId: "q_1", jobId: null, total: "10.00", sentAt: null });
  const r2 = await fileSentInvoiceDocument({ invoiceId: "inv_unsent" }, deps);
  ok("an invoice that was never sent files nothing", r2.reason, "not_sent");

  // Invoice.jobId pointing at another tenant's job is not trusted.
  db.rows.invoice.push({ id: "inv_x", companyId: "co_a", invoiceNumber: "INV-0010", version: 1, quoteId: null, jobId: "job_other_tenant", total: "10.00", sentAt: new Date() });
  const r3 = await fileSentInvoiceDocument({ invoiceId: "inv_x" }, deps);
  ok("a jobId in another tenant resolves to no job", r3.reason, "no_job");
}

{
  const db = makeDb();
  seed(db);
  db.rows.invoice.push({ id: "inv_1", companyId: "co_a", invoiceNumber: "INV-0007", version: 1, quoteId: "q_1", total: "10.00", sentAt: new Date() });
  const { deps, errors } = makeDeps(db, { renderFails: ["invoice"] });
  let threw = false;
  let r;
  try {
    r = await fileSentInvoiceDocument({ invoiceId: "inv_1" }, deps);
  } catch {
    threw = true;
  }
  ok("an invoice render failure does not throw", threw, false);
  ok("it is reported", r.reason, "render_failed");
  ok("and logged in job_documents", errors.length === 1 && errors[0].area === "job_documents" && errors[0].code === "invoice_render_failed");
}

{
  const base = { invoiceNumber: "INV-1", version: 1, subtotal: "1", tax: "0", total: "1", amountPaid: "0", lineItems: [], sentAt: new Date("2026-01-01T00:00:00Z") };
  ok("hashInvoiceDocument is stable", hashInvoiceDocument(base), hashInvoiceDocument({ ...base }));
  ok("Decimal-or-string totals hash alike", hashInvoiceDocument({ ...base, total: 1 }), hashInvoiceDocument({ ...base, total: "1" }));
  ok("a different sentAt is a different document", hashInvoiceDocument(base) !== hashInvoiceDocument({ ...base, sentAt: new Date("2026-01-02T00:00:00Z") }));
  ok("a different total is a different document", hashInvoiceDocument(base) !== hashInvoiceDocument({ ...base, total: "2" }));
  ok("a Date and its ISO string hash alike", hashInvoiceDocument(base), hashInvoiceDocument({ ...base, sentAt: "2026-01-01T00:00:00.000Z" }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. a crew member without showPricing sees none of the money kinds");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("quote is a document kind", DOCUMENT_KINDS.includes("quote"));
  ok("every autofiled kind is a real kind", [...AUTOFILED_KINDS].every((k) => DOCUMENT_KINDS.includes(k)));
  ok("every autofiled kind is a money kind", [...AUTOFILED_KINDS].every((k) => MONEY_KINDS.has(k)));
  const filed = [
    { id: "1", kind: "quote" },
    { id: "2", kind: "contract" },
    { id: "3", kind: "invoice" },
    { id: "4", kind: "plan" },
  ];
  const crew = visibleDocuments(filed, { canSeeMoney: false });
  ok("the crew sees only the plan", crew.documents.map((d) => d.kind).join(","), "plan");
  ok("and is told three are withheld", crew.hiddenCount, 3);
  const office = visibleDocuments(filed, { canSeeMoney: true });
  ok("the office sees all four", office.documents.length, 4);
  ok("canSeeKind refuses the quote to the crew", canSeeKind("quote", { canSeeMoney: false }), false);

  const strip = read("app/components/jobs/LinkedJobDocuments.js");
  ok("the strip draws nothing without canSeeMoney", /if \(!data\.canSeeMoney\) return null/.test(strip));
  ok("the strip lists only the autofiled kinds", /AUTOFILED_KINDS\.has\(c\.current\?\.kind\)/.test(strip));
  ok("the strip reads the job's own documents route", /\/api\/jobs\/\$\{jobId\}\/documents/.test(strip));
  ok("the strip has no upload and no delete", !/method:\s*"(POST|DELETE|PATCH)"/.test(strip));
  ok("the strip links to the job's Documents", /\/app\/jobs\/\$\{jobId\}#documents/.test(strip));
  const panel = read("app/components/jobs/JobDocuments.js");
  ok("the job panel carries the anchor the strip links to", /id="documents"/.test(panel));
  ok("the job panel says when a row was filed by the system", /app\.jobDocuments\.source\.acceptance/.test(panel) && /app\.jobDocuments\.source\.invoiceSend/.test(panel));
  const route = read("app/api/jobs/[id]/documents/route.js");
  ok("the documents route sends `source` with each row", /source: true/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. the quote's photos land on the job, in the before group, once");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok('the stage is the feed\'s own "start"', QUOTE_PHOTO_STAGE, "start");
  ok("which is the before/pre-work stage", STAGES.start.order === 0 && /Before/.test(STAGES.start.label));

  const photos = [
    { url: ourImg("hall"), kind: "photo", caption: "north wall" },
    { url: ourImg("hall"), kind: "photo", caption: "duplicate of the first" },
    { url: ourImg("ceiling"), kind: "photo", caption: "" },
    { url: ourImg("walkthrough"), kind: "video" },
    { url: ourImg("plan"), kind: "document", filename: "plan.pdf" },
    { url: "https://images.example.com/not-ours.jpg", kind: "photo" },
    { url: "http://res.cloudinary.com/fqtest/image/upload/http-only.jpg", kind: "photo" },
    null,
    "garbage",
  ];
  const carry = quotePhotosToCarry(photos, { cloudName: CLOUD });
  ok("two photos survive: ours, photos, de-duplicated", carry.map((p) => p.url.split("/").pop()).join(","), "hall.jpg,ceiling.jpg");
  ok("a video is refused", carry.some((p) => p.url.includes("walkthrough")), false);
  ok("a document is refused", carry.some((p) => p.url.includes("plan")), false);
  ok("another host is refused", carry.some((p) => p.url.includes("example.com")), false);
  ok("another cloud is refused", quotePhotosToCarry([{ url: "https://res.cloudinary.com/othercloud/image/upload/x.jpg", kind: "photo" }], { cloudName: CLOUD }).length, 0);
  ok("nothing from nothing", quotePhotosToCarry(null).length + quotePhotosToCarry([]).length + quotePhotosToCarry("x").length, 0);
  ok("the caption carries the homeowner's own words", quotePhotoCaption("From the quote Q-1", "north wall"), "From the quote Q-1 — north wall");
  ok("and is just the base without them", quotePhotoCaption("From the quote Q-1", "  "), "From the quote Q-1");
  ok("and is capped at 200", quotePhotoCaption("From the quote Q-1", "x".repeat(500)).length, 200);

  const db = makeDb();
  seed(db, { photos });
  const { deps, errors } = makeDeps(db);
  const r = await fileQuotePhotosOnJob({ quoteId: "q_1", jobId: "job_1" }, deps);
  ok("two photos filed", r.filed, 2);
  ok("none were already there", r.present, 0);
  ok("two JobPhoto rows", db.rows.jobPhoto.length, 2);
  ok('both at stage "start"', db.rows.jobPhoto.every((p) => p.stage === "start"));
  ok("both on the job, in the tenant", db.rows.jobPhoto.every((p) => p.jobId === "job_1" && p.companyId === "co_a"));
  ok("captioned from the quote", db.rows.jobPhoto[0].caption, "From the quote Q-0042 — north wall");
  ok("a photo with no caption gets the base", db.rows.jobPhoto[1].caption, "From the quote Q-0042");
  ok("ordered as the homeowner had them", db.rows.jobPhoto.map((p) => p.sortOrder).join(","), "0,1");
  ok("not featured — a homeowner's kitchen is not marketing", db.rows.jobPhoto.every((p) => !p.featured));

  const again = await fileQuotePhotosOnJob({ quoteId: "q_1", jobId: "job_1" }, deps);
  ok("a re-run files nothing", again.filed, 0);
  ok("and reports both present", again.present, 2);
  ok("still two rows", db.rows.jobPhoto.length, 2);

  // The crew filed one of the same urls themselves first: only the other lands.
  const db2 = makeDb();
  seed(db2, { photos });
  db2.rows.jobPhoto.push({ id: "crew_1", companyId: "co_a", jobId: "job_1", url: ourImg("hall"), stage: "progress", caption: "crew's own" });
  const partial = await fileQuotePhotosOnJob({ quoteId: "q_1", jobId: "job_1" }, makeDeps(db2).deps);
  ok("only the missing photo is filed beside the crew's", partial.filed === 1 && partial.present === 1);
  ok("the crew's row is untouched", db2.rows.jobPhoto.find((p) => p.id === "crew_1").stage, "progress");

  const r2 = await fileQuotePhotosOnJob({ quoteId: "q_1", jobId: "job_other_tenant" }, deps);
  ok("another tenant's job is refused", r2.refused, "job_not_for_quote");
  const r3 = await fileQuotePhotosOnJob({ quoteId: "q_1", jobId: "job_other_quote" }, deps);
  ok("another quote's job is refused", r3.refused, "job_not_for_quote");
  ok("nothing logged for a refusal", errors.length, 0);

  const db3 = makeDb();
  seed(db3, { photos: null });
  const r4 = await fileQuotePhotosOnJob({ quoteId: "q_1", jobId: "job_1" }, makeDeps(db3).deps);
  ok("a quote with no photos files nothing", r4.filed === 0 && db3.rows.jobPhoto.length === 0 && r4.refused === null);

  const db4 = makeDb();
  seed(db4, { photos, companyLanguage: "fr" });
  await fileQuotePhotosOnJob({ quoteId: "q_1", jobId: "job_1" }, makeDeps(db4).deps);
  ok("the caption is in the office's language", db4.rows.jobPhoto[1].caption, "De la soumission Q-0042");

  const db5 = makeDb();
  seed(db5, { photos });
  const broken = makeDeps(db5);
  db5.jobPhoto.createMany = async () => {
    throw new Error("neon asleep");
  };
  let threw = false;
  try {
    await fileQuotePhotosOnJob({ quoteId: "q_1", jobId: "job_1" }, broken.deps);
  } catch {
    threw = true;
  }
  ok("a database failure does not throw", threw, false);
  ok("and is logged in job_documents", broken.errors.length === 1 && broken.errors[0].area === "job_documents");
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. the plan helpers, on their own");
// ═══════════════════════════════════════════════════════════════════════════

{
  const q = { quoteNumber: "Q-1", total: "5", signature: { documentHash: "abc" } };
  const plan = acceptanceDocumentPlan(q);
  ok("the contract keys on the signed hash", plan.contract.documentHash, "abc");
  ok("the quote keys on the content hash", plan.quote.documentHash, hashQuote(q));
  ok("signed is read off the record", plan.contract.signed, true);
  ok("an unsigned quote's contract keys on content", acceptanceDocumentPlan({ ...q, signature: null }).contract.documentHash, hashQuote(q));

  const both = pendingAcceptanceDocuments(plan, [], { source: "acceptance" });
  ok("nothing filed → both pending", both.map((e) => e.kind).join(","), "quote,contract");
  const one = pendingAcceptanceDocuments(plan, [{ kind: "quote", documentHash: hashQuote(q) }], { source: "acceptance" });
  ok("the quote filed → the contract pending", one.map((e) => e.kind).join(","), "contract");
  const stale = pendingAcceptanceDocuments(plan, [{ kind: "quote", documentHash: "old" }], { source: "acceptance" });
  ok("a row with a different hash does not count", stale.map((e) => e.kind).join(","), "quote,contract");
  const bf = pendingAcceptanceDocuments(plan, [], { source: "backfill", contractRequiresSignature: true, anyOfKind: new Set(["contract"]) });
  ok("a backfill skips a kind the job already holds from any source", bf.map((e) => e.kind).join(","), "quote");
  const unsigned = pendingAcceptanceDocuments(acceptanceDocumentPlan({ ...q, signature: null }), [], { source: "backfill", contractRequiresSignature: true });
  ok("a backfill skips an unsigned contract", unsigned.map((e) => e.kind).join(","), "quote");
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. the wiring — a helper nobody calls is the failure this repo keeps finding");
// ═══════════════════════════════════════════════════════════════════════════

{
  const life = read("lib/quotes/quoteLifecycle.js");
  ok("onQuoteAccepted files the documents", /fileAcceptanceDocuments\(\{ quoteId, jobId: job\.id/.test(life));
  ok("and carries the photos", /fileQuotePhotosOnJob\(\{ quoteId, jobId: job\.id \}\)/.test(life));
  ok("only once the job exists", /if \(job\) \{[\s\S]*fileAcceptanceDocuments/.test(life));
  ok("after the job and invoice, before the task", life.indexOf("ensureJobForAcceptedQuote(quoteId)") < life.indexOf("fileAcceptanceDocuments({") && life.indexOf("fileAcceptanceDocuments({") < life.indexOf("taskForAcceptedQuote(quoteId)"));
  ok("wrapped so a failure cannot fail the acceptance", /try \{\s*await fileAcceptanceDocuments[\s\S]*?\} catch/.test(life));
  ok("the staff member's id rides along on the back-office door", /byUserId: createdById/.test(life));
  ok("the signed PDF rides along", /signedPdf/.test(life));

  const pub = read("app/api/public/quotes/[token]/route.js");
  ok("the public route keeps the rendered PDF", /signedPdf = await dispatchDecisionEmails/.test(pub));
  ok("and hands it to onQuoteAccepted", /onQuoteAccepted\(updated\.id, \{ signedPdf \}\)/.test(pub));
  ok("dispatchDecisionEmails returns the buffer", /return pdfBuffer;\s*\}/.test(pub));

  const patch = read("app/api/quotes/[id]/route.js");
  ok("the back-office door goes through the same onQuoteAccepted", /onQuoteAccepted\(id, \{\s*createdById: member\.userId,?\s*\}\)/.test(patch));

  const send = read("app/api/invoices/[id]/send/route.js");
  ok("the invoice send files the invoice", /fileSentInvoiceDocument\(\{ invoiceId: invoice\.id, byUserId: member\.userId \}\)/.test(send));
  ok("after sentAt is stamped", send.indexOf("sentAt: new Date()") < send.indexOf("fileSentInvoiceDocument({"));
  ok("and before the response", send.indexOf("fileSentInvoiceDocument({") < send.lastIndexOf("return NextResponse.json({"));
  ok("wrapped", /try \{\s*await fileSentInvoiceDocument[\s\S]*?\} catch/.test(send));

  const docsRoute = read("app/api/jobs/[id]/documents/route.js");
  ok("the documents GET backfills lazily", /source: AUTOFILE_SOURCES\.backfill/.test(docsRoute));
  ok("signed contracts only", /contractRequiresSignature: true/.test(docsRoute));
  ok("only for a job with a quote", /if \(job\.quoteId\) \{/.test(docsRoute));
  ok("the GET still refuses a job outside the tenant first", docsRoute.indexOf("ownJob(id, member.companyId, full)") < docsRoute.indexOf("fileAcceptanceDocuments({"));
  ok("the backfill runs before the rows are read", docsRoute.indexOf("fileAcceptanceDocuments({") < docsRoute.indexOf("db.jobDocument.findMany({"));
  ok("the POST is untouched: no autofile on upload", (docsRoute.match(/fileAcceptanceDocuments\(/g) || []).length, 1);

  const photosRoute = read("app/api/jobs/[id]/photos/route.js");
  ok("the photos GET carries the quote's photos lazily", /fileQuotePhotosOnJob\(\{ quoteId: job\.quoteId, jobId: job\.id \}\)/.test(photosRoute));
  ok("before the rows are read", photosRoute.indexOf("fileQuotePhotosOnJob({") < photosRoute.indexOf("db.jobPhoto.findMany({"));

  const quotePage = read("app/app/quotes/[id]/page.js");
  ok("the quote page renders the strip for its job", /<LinkedJobDocuments jobId=\{quote\.jobs\[0\]\.id\} \/>/.test(quotePage));
  ok("only when there is a job", /quote\.jobs\?\.\[0\]\?\.id && <LinkedJobDocuments/.test(quotePage));
  const invoicePage = read("app/app/invoices/[id]/page.js");
  ok("the invoice page renders the strip for its job", /<LinkedJobDocuments jobId=\{life\.job\.id\} \/>/.test(invoicePage));
  ok("only when there is a job", /life\?\.job\?\.id && <LinkedJobDocuments/.test(invoicePage));

  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model JobDocument {"), schema.indexOf("model JobDailyLog {"));
  ok("JobDocument.source is nullable", /\n\s+source String\?/.test(model));
  ok("sourceQuoteId / sourceInvoiceId are nullable, not relations", /sourceQuoteId\s+String\?\n/.test(model) && /sourceInvoiceId String\?\n/.test(model) && !/sourceQuote\s+Quote/.test(model));
  ok("documentHash is nullable", /documentHash String\?/.test(model));
  ok("the quote key is unique", /@@unique\(\[sourceQuoteId, kind, documentHash\]\)/.test(model));
  ok("the invoice key is unique", /@@unique\(\[sourceInvoiceId, kind, documentHash\]\)/.test(model));

  const autofile = read("lib/jobs/documentAutofile.js");
  // Prisma-shaped writes only — `createHash().update(` is the digest, not a row.
  const prismaWrite = /\b(db|tx|d\.db)\.\w+\.(delete|update|upsert)(Many)?\(/;
  ok("no delete or update on any model in the autofile", !prismaWrite.test(autofile));
  const photoFile = read("lib/jobs/photoAutofile.js");
  ok("no delete or update on any model in the photo carry", !prismaWrite.test(photoFile));
  ok("both write with create only", /\.jobDocument\.create\(/.test(autofile) && /\.jobPhoto\.createMany\(/.test(photoFile));
  ok("the renderer is imported lazily, never at module top", !/^import .*documentRenderers/m.test(autofile) && /await import\("@\/lib\/jobs\/documentRenderers"\)/.test(autofile));
  ok("cloudinary is imported lazily too", /await import\("@\/lib\/cloudinary"\)/.test(autofile));

  const renderers = read("lib/jobs/documentRenderers.js");
  ok("the signed variant prints the accepted totals", /subtotal: quote\.acceptedSubtotal \?\? quote\.subtotal/.test(renderers) && /total: quote\.acceptedTotal \?\? quote\.total/.test(renderers));
  ok("and the signature", /signature: quote\.signature \|\| null/.test(renderers));
  ok("the as-sent variant has no signature", /\{ signature: null \}/.test(renderers));
  ok("the invoice render folds in the family ledger", /refreshFamilyLedger\(db, invoice\.id\)/.test(renderers));
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. nine languages");
// ═══════════════════════════════════════════════════════════════════════════

{
  const keys = [
    "app.jobDocuments.kind.quote",
    "app.jobDocuments.source.acceptance",
    "app.jobDocuments.source.invoiceSend",
    "app.jobDocuments.source.backfill",
    "app.jobDocuments.autofile.signedContract",
    "app.jobDocuments.autofile.approvedContract",
    "app.jobDocuments.autofile.quote",
    "app.jobDocuments.autofile.invoice",
    "app.jobPhotos.fromQuote",
    "app.linkedDocuments.title",
    "app.linkedDocuments.open",
    "app.linkedDocuments.empty",
  ];
  const langs = Object.keys(APP_MESSAGES);
  ok("the catalogue has nine languages", langs.length, 9);
  for (const lang of langs) {
    const missing = keys.filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || !APP_MESSAGES[lang][k].trim());
    ok(`${lang} carries every key`, missing.join(","), "");
    const numbered = keys.filter((k) => /number/.test(k) || /autofile|fromQuote/.test(k));
    ok(`${lang} keeps {number} where a number goes`, numbered.every((k) => /\{number\}/.test(APP_MESSAGES[lang][k])));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
