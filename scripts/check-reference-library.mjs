// scripts/check-reference-library.mjs
//
//   npm run check:reference-library
//
// The AI employee's reference library (lib/aiEmployee/reference.js,
// referencePages.js, referenceRuns.js, clientContext.js, and the retrieval in
// sources.js), executed against hostile input:
//
//   - real PDFs written byte by byte (scripts/fixtures/planPdf.mjs): a text
//     manual, a fully scanned one, a half-scanned one, a 300-page one, a
//     450-page one, a password-protected one, and garbage that says %PDF;
//   - private-file URLs from another company, another folder, a public
//     upload, a lookalike host;
//   - OCR batches that name pages already read, smuggle a PNG as a JPEG,
//     carry five pages, or come from a different file;
//   - the paid actions run with a SCRIPTED model and wallet — no live AI
//     call anywhere in this file;
//   - the installed-equipment card fed rows that carry money and another
//     tenant's equipment;
//   - every new sentence in all nine languages, placeholders intact.
import { readFileSync } from "node:fs";
import { buildPlanPdf } from "./fixtures/planPdf.mjs";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 400));
  }
}
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

process.env.CLOUDINARY_CLOUD_NAME = "fqcloud";
const {
  readReferenceFile, isOwnReferenceUrl, referenceKindFor, cleanTags, ocrEstimateCents, codeExtractEstimateCents,
  validateOcrBatch, cleanOcrResult, failureKeyFor, REFERENCE_FAILURE_KEYS, OCR_TOKENS_PER_PAGE,
} = await import("@/lib/aiEmployee/reference");
const { summarisePages, pageRanges, pageHasText, unreadOf, ocrBatches, MAX_REFERENCE_PAGES, OCR_PAGES_PER_BATCH } = await import("@/lib/aiEmployee/referencePages");
const { readScannedPages, restate } = await import("@/lib/aiEmployee/referenceRuns");
const { selectChunks, pageReadPlan, equipmentTier, sourceTagScore, MAX_CONTEXT_CHARS, SOURCE_FAILURE_KEYS } = await import("@/lib/aiEmployee/sources");
const { shapeClientContext, equipmentCardText, loadClientContext, warrantyPhrase } = await import("@/lib/aiEmployee/clientContext");
const { fetchOwnPrivateFile, pdfSheets } = await import("@/lib/planRead/ingest");
const { uploadScope } = await import("@/lib/media/directUpload");
const { WALLET_ESTIMATES } = await import("@/lib/ai/walletMeter");
const { PAYER_FEATURES } = await import("@/lib/ai/featurePayer");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
const { assertStrictSchema } = await import("@/lib/ai/jsonSchema");
const { OCR_SCHEMA } = await import("@/lib/aiEmployee/reference");

// ── Fixtures ───────────────────────────────────────────────────────────────
const LINE = "Error code E15 means the leak protection tripped. Turn off the water supply and call for service.";
const textPage = (n) => ({ width: 612, height: 792, texts: [{ text: `Page ${n} of the Bosch manual`, x: 72, y: 720 }, { text: LINE, x: 72, y: 690 }] });
const scanPage = () => ({ width: 612, height: 792, scanned: true });

// ── 1. Reading real PDFs ───────────────────────────────────────────────────
{
  const t0 = Date.now();
  const text = await readReferenceFile(buildPlanPdf([textPage(1), textPage(2), textPage(3)]), "pdf");
  ok("a text PDF: every page read, ready", text.ok && text.summary.status === "ready" && text.summary.pagesRead === 3 && text.pages.every((p) => p.method === "text" && /leak protection/.test(p.text)), text.summary);
  const scanned = await readReferenceFile(buildPlanPdf([scanPage(), scanPage()]), "pdf");
  ok("a scanned PDF: written, failed BY NAME, every page listed unread — never 'ready'",
    scanned.ok && scanned.summary.status === "failed" && scanned.summary.failureReason === "app.aiEmployee.source.failed.pdfScanned" && scanned.summary.unreadPages.join(",") === "1,2" && scanned.pages.every((p) => p.text === null && p.method === null), scanned.summary);
  const mixed = await readReferenceFile(buildPlanPdf([textPage(1), scanPage(), scanPage(), textPage(4), scanPage()]), "pdf");
  ok("a half-scanned PDF: partial, and the screen can say 'Couldn't read pages 2–3, 5'", mixed.ok && mixed.summary.status === "partial" && mixed.summary.pagesRead === 2 && pageRanges(mixed.summary.unreadPages) === "2–3, 5", mixed.summary);
  const big = await readReferenceFile(buildPlanPdf(Array.from({ length: 300 }, (_, i) => textPage(i + 1))), "pdf");
  ok("a 300-page manual is read whole", big.ok && big.summary.pageCount === 300 && big.summary.pagesRead === 300 && big.summary.status === "ready" && big.pages[299].page === 300, big.summary);
  const huge = await readReferenceFile(buildPlanPdf(Array.from({ length: MAX_REFERENCE_PAGES + 50 }, (_, i) => textPage(i + 1))), "pdf");
  ok(`a ${MAX_REFERENCE_PAGES + 50}-page PDF: the first ${MAX_REFERENCE_PAGES} read, the rest counted as skipped, partial — never 'ready'`,
    huge.ok && huge.pages.length === MAX_REFERENCE_PAGES && huge.summary.pageCount === MAX_REFERENCE_PAGES + 50 && huge.summary.skippedPages === 50 && huge.summary.status === "partial", huge.summary);
  ok("...in reasonable time (no per-page model call — unpdf, in code)", Date.now() - t0 < 60_000, Date.now() - t0);
  const locked = await readReferenceFile(buildPlanPdf([textPage(1)], { encrypt: true }), "pdf");
  ok("a password-protected PDF is refused by NAME", !locked.ok && locked.reason === "app.aiEmployee.source.failed.pdfPassword", locked);
  const lockedSheets = await pdfSheets(buildPlanPdf([textPage(1)], { encrypt: true }));
  ok("...and the drawing read's own vocabulary is unchanged by the shared opener", !lockedSheets.ok && lockedSheets.reason === "unreadable");
  const garbage = await readReferenceFile(Buffer.from("%PDF-1.7\nthis is not really a pdf at all\n%%EOF"), "pdf");
  ok("garbage behind a %PDF header is 'unreadable', not a crash", !garbage.ok && garbage.reason === "app.aiEmployee.source.failed.unreadable", garbage);
  const notPdf = await readReferenceFile(Buffer.from("PK\u0003\u0004 a zip"), "pdf");
  ok("a zip renamed .pdf is refused as not a PDF", !notPdf.ok && notPdf.reason === "app.aiEmployee.source.failed.binary", notPdf);
  const csv = await readReferenceFile(Buffer.from("code,meaning\nE15,leak\n"), "csv");
  ok("a CSV code list is read as text", csv.ok && /E15,leak/.test(csv.text));
  const fakeXlsx = await readReferenceFile(Buffer.from("not a workbook"), "xlsx");
  ok("a broken .xlsx is 'unreadable', recorded rather than thrown", !fakeXlsx.ok && fakeXlsx.reason === "app.aiEmployee.source.failed.unreadable", fakeXlsx);
  ok("an unknown kind is refused", !(await readReferenceFile(Buffer.from("x"), "docx")).ok);
  ok("every failure key the library writes is one the screen translates", REFERENCE_FAILURE_KEYS.every((k) => SOURCE_FAILURE_KEYS.includes(k)), REFERENCE_FAILURE_KEYS);
  ok("an unknown ingest reason still maps to a translated key", failureKeyFor("??") === "app.aiEmployee.source.failed.unreadable");
}

// ── 2. Page arithmetic ─────────────────────────────────────────────────────
ok("a page number alone is not text", !pageHasText("12") && !pageHasText("   \n  ") && !pageHasText(null) && pageHasText("Turn the water off at the valve."));
ok("an empty PDF is failed, not ready", summarisePages([], 0).status === "failed");
ok("page ranges collapse runs and drop junk", pageRanges([14, 12, 13, 20, "x", -1, 12]) === "12–14, 20" && pageRanges([]) === "");
ok("stored unread pages are cleaned (no junk, no duplicates, no page past the cap)", unreadOf({ unreadPages: [3, "3", 2, "x", null, 9999] }).join(",") === "2,3" && unreadOf({}).length === 0);
ok("OCR batches hold at most four pages", ocrBatches([1, 2, 3, 4, 5, 6, 7, 8, 9]).map((b) => b.length).join(",") === "4,4,1" && OCR_PAGES_PER_BATCH === 4);
ok("restate: a page AI found blank is no longer unread, and is not counted read",
  JSON.stringify(restate([{ page: 1, text: LINE, method: "text" }, { page: 2, text: null, method: "ocr" }, { page: 3, text: null, method: null }], 3)) ===
    JSON.stringify({ pagesRead: 1, unreadPages: [3], status: "partial", failureReason: null }));

// ── 3. Storage: private, this company's, this folder ───────────────────────
{
  const own = "https://res.cloudinary.com/fqcloud/raw/authenticated/v1700000000/fieldquo/companies/co1/reference/0b6a3c1e-1111-4222-8333-944455556666.pdf";
  ok("the company's own private reference file is accepted", isOwnReferenceUrl(own, { companyId: "co1" }));
  ok("another company's is refused", !isOwnReferenceUrl(own, { companyId: "co2" }));
  ok("a PUBLIC upload of the same path is refused", !isOwnReferenceUrl(own.replace("/authenticated/", "/upload/"), { companyId: "co1" }));
  ok("another purpose's folder (hr) is refused", !isOwnReferenceUrl(own.replace("/reference/", "/hr/"), { companyId: "co1" }));
  ok("a lookalike host, http, a query or '..' are refused",
    [own.replace("res.cloudinary.com", "res.cloudinary.com.evil.io"), own.replace("https:", "http:"), `${own}?x=1`, own.replace("/reference/", "/reference/../hr/")].every((u) => !isOwnReferenceUrl(u, { companyId: "co1" })));
  ok("junk is refused, never a throw", !isOwnReferenceUrl(null, { companyId: "co1" }) && !isOwnReferenceUrl(own, {}) && !isOwnReferenceUrl(42, { companyId: "co1" }));
  const scope = uploadScope("member", { companyId: "co1", purpose: "reference" });
  ok("the upload purpose is private (authenticated) and takes PDFs, .xlsx and .csv", scope.ok && scope.deliveryType === "authenticated" && scope.allowPlanDocuments === true && scope.folder === "fieldquo/companies/co1/reference");

  const signs = [];
  const sign = (publicId, format, options) => { signs.push({ publicId, options }); return `https://api.cloudinary.com/v1_1/fqcloud/raw/download?public_id=${encodeURIComponent(publicId)}&expires_at=${options.expires_at}&signature=x`; };
  const okFetch = async (url) => ({ ok: true, url, headers: { get: () => "12" }, arrayBuffer: async () => new TextEncoder().encode("%PDF-1.4 hi").buffer });
  const got = await fetchOwnPrivateFile(own, { companyId: "co1", folder: "reference", sign, fetchImpl: okFetch });
  ok("the private file is read through a five-minute signed link", got.ok && signs.length === 1 && signs[0].options.type === "authenticated" && signs[0].options.expires_at - Math.floor(Date.now() / 1000) <= 300);
  ok("...never signed for another company", !(await fetchOwnPrivateFile(own, { companyId: "co2", folder: "reference", sign, fetchImpl: okFetch })).ok && signs.length === 1);
  ok("...or another folder", !(await fetchOwnPrivateFile(own.replace("/reference/", "/hr/"), { companyId: "co1", folder: "reference", sign, fetchImpl: okFetch })).ok);
  ok("...or without a signer", (await fetchOwnPrivateFile(own, { companyId: "co1", folder: "reference", fetchImpl: okFetch })).reason === "unsigned");
  ok("a signer that returns a foreign host is refused before any fetch", (await fetchOwnPrivateFile(own, { companyId: "co1", folder: "reference", sign: () => "https://evil.io/x", fetchImpl: async () => { throw new Error("fetched"); } })).reason === "not_ours");
  ok("a redirect that ends off Cloudinary is refused", (await fetchOwnPrivateFile(own, { companyId: "co1", folder: "reference", sign, fetchImpl: async () => ({ ok: true, url: "https://evil.io/stolen", headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(1) }) })).reason === "not_ours");
  ok("a body over the ceiling is refused", (await fetchOwnPrivateFile(own, { companyId: "co1", folder: "reference", sign, maxBytes: 5, fetchImpl: okFetch })).reason === "too_large");
}

// ── 4. What a request may carry ───────────────────────────────────────────
{
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]).toString("base64");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8]).toString("base64");
  const unread = [2, 3, 5];
  ok("a batch of unread pages, real JPEGs, is accepted", validateOcrBatch({ pages: [{ page: 2, mimeType: "image/jpeg", base64: jpeg }, { page: 5, mimeType: "image/png", base64: png }] }, { unread }).ok);
  ok("a page that was already read is refused (no paying to overwrite a text layer)", validateOcrBatch({ pages: [{ page: 1, mimeType: "image/jpeg", base64: jpeg }] }, { unread }).error === "page_not_unread");
  ok("five pages in one request are refused", validateOcrBatch({ pages: [2, 3, 5, 2, 3].map((page) => ({ page, mimeType: "image/jpeg", base64: jpeg })) }, { unread }).error === "too_many_pages");
  ok("the same page twice is refused", validateOcrBatch({ pages: [{ page: 2, mimeType: "image/jpeg", base64: jpeg }, { page: 2, mimeType: "image/jpeg", base64: jpeg }] }, { unread }).error === "page_not_unread");
  ok("a PNG claiming to be a JPEG is refused", validateOcrBatch({ pages: [{ page: 2, mimeType: "image/jpeg", base64: png }] }, { unread }).error === "bad_image");
  ok("not-base64, an empty image, a GIF, an oversize image — refused",
    [{ page: 2, mimeType: "image/jpeg", base64: "not base64!" }, { page: 2, mimeType: "image/jpeg", base64: "" }, { page: 2, mimeType: "image/gif", base64: jpeg }, { page: 2, mimeType: "image/jpeg", base64: "A".repeat(2_800_004) }]
      .every((p) => !validateOcrBatch({ pages: [p] }, { unread }).ok));
  ok("no pages, or junk, is refused, never a throw", !validateOcrBatch(null).ok && !validateOcrBatch({ pages: "x" }).ok);
  const cleaned = cleanOcrResult({ pages: [{ page: 2, text: "  Hello\r\n\r\n\r\nworld " }, { page: 9, text: "smuggled" }, { page: 2, text: "again" }] }, [2, 3]);
  ok("a transcription keeps only pages that were sent, once", cleaned.get(2) === "Hello\n\nworld" && !cleaned.has(9) && !cleaned.has(3));
  ok("the OCR schema is strict-mode valid", assertStrictSchema(OCR_SCHEMA).ok);
  ok("tags are cleaned to strings or null — never a value nothing reads", JSON.stringify(cleanTags({ brand: "  Bosch  ", modelPattern: 42, category: "", trade: "x".repeat(200) })) === JSON.stringify({ trade: "x".repeat(60), brand: "Bosch", modelPattern: null, category: null }));
  ok("the reader is chosen by type, then extension", referenceKindFor("application/pdf") === "pdf" && referenceKindFor("", "Manual.PDF") === "pdf" && referenceKindFor("", "codes.xlsx") === "xlsx" && referenceKindFor("text/csv") === "csv" && referenceKindFor("application/msword", "x.doc") === null);
}

// ── 5. The price shown is the price held ───────────────────────────────────
{
  ok("reading scanned pages has a price, rising with the pages, never free", ocrEstimateCents(1) >= 1 && ocrEstimateCents(60) > ocrEstimateCents(10) && ocrEstimateCents(0) === 0 && ocrEstimateCents("junk") === 0);
  const e = WALLET_ESTIMATES.reference_ocr;
  ok("the wallet's pre-call estimate is one batch of the same per-page tokens", e.prompt === OCR_PAGES_PER_BATCH * (OCR_TOKENS_PER_PAGE.image + OCR_TOKENS_PER_PAGE.text) && e.completion === OCR_PAGES_PER_BATCH * OCR_TOKENS_PER_PAGE.completion && e.tier === "standard", e);
  ok("extracting codes has a price from the pages it will read, zero when there are none", codeExtractEstimateCents([{ text: "x".repeat(4000) }]) >= 1 && codeExtractEstimateCents([]) === 0);
  ok("both paid actions are registered, wired, and charged to the company's AI credit",
    ["reference_ocr", "reference_code_extract"].every((f) => PAYER_FEATURES.some((p) => p.feature === f && p.wired && p.defaultPayer === "company" && p.companyLedger === "wallet")));
  ok("...and both are metered through meterFor by that exact name", /meter\("reference_ocr"/.test(read("lib/aiEmployee/referenceRuns.js")) && /meter\("reference_code_extract"/.test(read("lib/aiEmployee/referenceRuns.js")));
}

// ── 6. Read scanned pages: the run, with a scripted model and wallet ───────
function scriptedDb(seed) {
  const store = { aiEmployeeSource: [], aiEmployeeSourcePage: [], referenceCode: [], ...seed };
  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("not" in v) return v.not === null ? row[k] != null : row[k] !== v.not;
        return true;
      }
      return row[k] === v;
    });
  const model = (name) => ({
    findFirst: async ({ where }) => store[name].find((r) => matches(r, where)) || null,
    findMany: async ({ where } = {}) => store[name].filter((r) => matches(r, where)),
    updateMany: async ({ where, data }) => { const rows = store[name].filter((r) => matches(r, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    createMany: async ({ data }) => { store[name].push(...data); return { count: data.length }; },
  });
  const db = { $store: store };
  for (const n of Object.keys(store)) db[n] = model(n);
  return db;
}
{
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9, 9, 9, 9, 9, 9]).toString("base64");
  const source = { id: "s1", companyId: "co1", title: "Rinnai manual", fileHash: "abc123", pageCount: 3, pagesRead: 1, unreadPages: [2, 3], status: "partial" };
  const pages = [
    { companyId: "co1", sourceId: "s1", page: 1, text: LINE, method: "text" },
    { companyId: "co1", sourceId: "s1", page: 2, text: null, method: null },
    { companyId: "co1", sourceId: "s1", page: 3, text: null, method: null },
  ];
  const other = { id: "s9", companyId: "co2", title: "Theirs", fileHash: "abc123", pageCount: 1, unreadPages: [1] };
  const calls = [];
  const recorded = [];
  const meter = (allowed) => async (feature) => ({ check: async () => ({ allowed, needCents: 3 }), record: async (u, meta) => { recorded.push({ feature, u, meta }); } });
  const model = async (args) => { calls.push(args); args.onUsage?.({ model: "gpt-5-mini", promptTokens: 9000, completionTokens: 900 }); return { ok: true, data: { pages: [{ page: 2, text: "Code 79: water leak detected inside the cabinet. Turn the heater off." }, { page: 3, text: "" }] } }; };
  const body = { fileHash: "ABC123", pages: [{ page: 2, mimeType: "image/jpeg", base64: jpeg }, { page: 3, mimeType: "image/jpeg", base64: jpeg }] };

  let db = scriptedDb({ aiEmployeeSource: [{ ...source }, other], aiEmployeeSourcePage: pages.map((p) => ({ ...p })) });
  const wrong = await readScannedPages({ prisma: db, companyId: "co1", sourceId: "s1", body: { ...body, fileHash: "nope" } }, { complete: model, meterFor: meter(true) });
  ok("a different file is refused before anything is sent", wrong.status === 409 && calls.length === 0);
  const foreign = await readScannedPages({ prisma: db, companyId: "co1", sourceId: "s9", body }, { complete: model, meterFor: meter(true) });
  ok("another tenant's manual is not found", foreign.status === 404 && calls.length === 0);
  const broke = await readScannedPages({ prisma: db, companyId: "co1", sourceId: "s1", body }, { complete: model, meterFor: meter(false) });
  ok("no AI credit → 402, and no page reaches the model", broke.status === 402 && broke.error === "no_credit" && calls.length === 0);
  const done = await readScannedPages({ prisma: db, companyId: "co1", sourceId: "s1", body }, { complete: model, meterFor: meter(true) });
  ok("a batch is read on the standard tier at high detail, the images inline, the pages named in order",
    done.ok && calls.length === 1 && !calls[0].tier && calls[0].imageDetail === "high" && calls[0].imageData.length === 2 && /page 2, page 3/.test(calls[0].prompt) && calls[0].schema, calls[0]?.prompt);
  ok("...metered to the company once, with a ref and a statement line", recorded.length === 1 && recorded[0].feature === "reference_ocr" && /^reference_ocr:s1:2-3:/.test(recorded[0].meta.ref) && /scanned pages 2, 3/.test(recorded[0].meta.note));
  const p2 = db.$store.aiEmployeeSourcePage.find((p) => p.page === 2);
  const p3 = db.$store.aiEmployeeSourcePage.find((p) => p.page === 3);
  ok("a page with text is filled, marked 'ocr'; a blank one is marked looked-at, not padded", p2.method === "ocr" && /Code 79/.test(p2.text) && p3.method === "ocr" && p3.text === null);
  const s1 = db.$store.aiEmployeeSource.find((s) => s.id === "s1");
  ok("the source now says what is true: 2 of 3 read, nothing left to offer, ready to use", s1.pagesRead === 2 && s1.unreadPages.length === 0 && s1.status === "ready", s1);
  ok("the other tenant's row was never touched", db.$store.aiEmployeeSource.find((s) => s.id === "s9").pagesRead === undefined);
  const again = await readScannedPages({ prisma: db, companyId: "co1", sourceId: "s1", body }, { complete: model, meterFor: meter(true) });
  ok("asking again for the same pages is refused — they are no longer unread, so nobody pays twice", again.status === 400 && calls.length === 1);
  // A vendor failure still records what it cost.
  db = scriptedDb({ aiEmployeeSource: [{ ...source }], aiEmployeeSourcePage: pages.map((p) => ({ ...p })) });
  const fail = await readScannedPages({ prisma: db, companyId: "co1", sourceId: "s1", body }, { complete: async (a) => { a.onUsage?.({ model: "gpt-5-mini", promptTokens: 9000, completionTokens: 0 }); return { ok: false, reason: "refused" }; }, meterFor: meter(true) });
  ok("a refused read is a 502 that was still metered, and writes no page", fail.status === 502 && fail.charged === true && db.$store.aiEmployeeSourcePage.every((p) => p.page === 1 || p.method === null));
}

// ── 7. Retrieval: the owner's order, inside the same budget ────────────────
{
  const equipment = [{ id: "e1", name: "Furnace", manufacturer: "Carrier", modelNumber: "59SC5A080" }];
  const carrier = { id: "m1", title: "Carrier furnace manual", kind: "manual", brand: "Carrier", modelPattern: "59SC5", pageCount: 40, pages: [{ page: 15, text: "Status code 13: limit circuit lockout. Check the filter." }, { page: 2, text: "Contents" }] };
  const lennox = { id: "m2", title: "Lennox furnace manual", kind: "manual", brand: "Lennox", pageCount: 30, pages: [{ page: 9, text: "Status code 13 on a Lennox means something else entirely. filter filter filter" }] };
  const policy = { id: "p1", title: "Warranty policy", kind: "policy", extractedText: "Our labour warranty is two years. Furnace filter changes are the owner's job." };
  const picked = selectChunks({ sources: [lennox, policy, carrier], query: "furnace showing code 13, checked filter", role: "troubleshooter", equipment });
  ok("the manual for THIS client's equipment comes first", picked[0]?.id === "m1" && picked[0]?.page === 15, picked.map((p) => [p.id, p.page]));
  ok("...its chunk carries the page for the citation", picked.find((p) => p.id === "m1")?.page === 15);
  ok("...a page matching none of the words never outranks one that does", picked.findIndex((p) => p.id === "m1" && p.page === 2) === -1 || picked.findIndex((p) => p.id === "m1" && p.page === 2) > picked.findIndex((p) => p.id === "m2"));
  ok("an untagged source is never 'for this equipment'", equipmentTier({ brand: null }, equipment) === 1 && equipmentTier(carrier, equipment) === 0 && equipmentTier({ brand: "Carrier", modelPattern: "ZZZ" }, equipment) === 1);
  ok("a tag is matched as a whole word run ('lg' is not in 'bulging')", sourceTagScore({ brand: "LG" }, { query: "the ceiling is bulging" }) === 0 && sourceTagScore({ brand: "LG" }, { query: "my LG washer" }) === 2);
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, title: `Doc ${i}`, kind: "manual", extractedText: `furnace code 13 ${"x".repeat(1100)}` }));
  ok("the budget is unchanged: never more than MAX_CONTEXT_CHARS", selectChunks({ sources: many, query: "furnace code 13" }).reduce((n, c) => n + c.text.length, 0) <= MAX_CONTEXT_CHARS && MAX_CONTEXT_CHARS === 8000);
  const legacy = [{ id: "a", title: "A", kind: "policy", extractedText: "deck staining policy" }, { id: "b", title: "B", kind: "manual", extractedText: "furnace manual furnace" }];
  ok("with no tags and no equipment the order is the old keyword order, chunks unchanged in shape", JSON.stringify(selectChunks({ sources: legacy, query: "furnace" })) === JSON.stringify([{ id: "b", title: "B", kind: "manual", text: "furnace manual furnace" }, { id: "a", title: "A", kind: "policy", text: "deck staining policy" }]));
  const plan = pageReadPlan([carrier, lennox, policy, ...Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, pageCount: 10, brand: "Carrier" }))], { query: "furnace code 13", equipment });
  ok("the page read: signalled manuals first, at most four; every other PDF second; never the text sources", plan.signalled.length === 4 && plan.signalled[0] === "m1" && plan.others.includes("m2") && !plan.others.includes("p1") && !plan.signalled.includes("p1") && plan.terms.includes("furnace"));
  ok("'hi?' reads two first pages of two manuals, not every page", pageReadPlan([carrier, lennox], { query: "hi?" }).firstPagesOnly === true && pageReadPlan([carrier, lennox], { query: "hi?" }).firstPageSources.length === 2);
  ok("the respond read is bounded by PAGES_PER_READ and filtered on the words", /take,\s*select: \{ sourceId: true, page: true, text: true \}/.test(read("lib/aiEmployee/respond.js")) && /contains: t, mode: "insensitive"/.test(read("lib/aiEmployee/respond.js")));
}

// ── 8. The installed-equipment card: the record, never money, one tenant ───
{
  const rows = {
    client: { id: "cl1", name: "Jane", phone: "+15555550100", email: "j@x.io", balance: 1234.56, totalSpent: 9999 },
    equipment: [
      { id: "e1", name: "Furnace", manufacturer: "Lennox", modelNumber: "SL280", serialNumber: "5810K", installedAt: new Date("2024-03-01"), warrantyEndsAt: null, installedByJobId: "j1", price: 7800, cost: 5000, services: [{ servicedAt: new Date("2025-10-01"), description: "Annual tune-up", underWarranty: false, amount: 189 }] },
      { id: "e2", name: "Water heater", manufacturer: "Rheem", warrantyEndsAt: new Date("2020-01-01") },
    ],
    jobs: [{ id: "j1", title: "Furnace replacement", status: "completed", completedAt: new Date("2024-03-01"), total: 7800, invoices: [{ amount: 7800 }], depositCents: 100000 }],
  };
  const ctx = shapeClientContext({ client: rows.client, equipment: rows.equipment, jobs: rows.jobs });
  const json = JSON.stringify(ctx);
  ok("no money-shaped key or value survives into the card's data", !/balance|totalSpent|price|cost|amount|total|invoice|deposit|1234|9999|7800|5000|189\b/.test(json), json);
  const card = equipmentCardText(ctx, { now: new Date("2026-10-04") });
  ok("...nor into the card's text", !/\$|1234|7800|189\b|total|invoice/i.test(card), card);
  ok("an unknown warranty is said as unknown — never 'out of warranty'", /warranty end: not on file \(unknown/.test(card) && !/out of warranty/i.test(card));
  ok("a past warranty date is a fact from the record, not a verdict", /warranty date on file was 2020-01-01/.test(card) && warrantyPhrase({ warrantyEndsOn: "2030-01-01" }, new Date("2026-10-04")).startsWith("warranty on file runs to"));
  ok("the serial is there for the team and marked never to be said", /serial on file: 5810K — for the team's note only, never say it to the customer/.test(card));
  ok("each piece carries the id log_troubleshooting may name", /\[equipment_id: e1\]/.test(card));
  ok("no client → no card", shapeClientContext({ client: null }) === null && equipmentCardText(null) === null);

  // Tenant fence, executed: a database that would hand back another
  // company's rows if the WHERE ever dropped companyId or clientId.
  const seen = [];
  const all = {
    client: [{ id: "cl1", companyId: "co2", name: "Not yours" }, { id: "cl1", companyId: "co1", name: "Jane" }],
    clientEquipment: [{ id: "x", companyId: "co2", clientId: "cl1", name: "THEIRS" }, { id: "y", companyId: "co1", clientId: "cl9", name: "OTHER CLIENT" }, { id: "e1", companyId: "co1", clientId: "cl1", name: "Furnace", services: [] }],
    job: [{ id: "jx", companyId: "co2", clientId: "cl1", title: "THEIR JOB", completedAt: new Date() }],
  };
  const fence = (name) => async ({ where }) => {
    seen.push({ name, where });
    return all[name].filter((r) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? true : r[k] === v)));
  };
  const prisma = {
    client: { findFirst: async (a) => (await fence("client")(a))[0] || null },
    clientEquipment: { findMany: fence("clientEquipment") },
    job: { findMany: fence("job") },
  };
  const loaded = await loadClientContext(prisma, { companyId: "co1", clientId: "cl1" });
  ok("every read names the company AND the client", seen.every((s) => s.where.companyId === "co1" && (s.name === "client" ? s.where.id === "cl1" : s.where.clientId === "cl1")), seen);
  ok("...so another tenant's equipment, client or job never appears", loaded && loaded.contact.name === "Jane" && !/THEIRS|OTHER CLIENT|THEIR JOB|Not yours/.test(JSON.stringify(loaded)), loaded);
  ok("no company or no client → nothing read", (await loadClientContext(prisma, { companyId: "co1" })) === null && (await loadClientContext(prisma, { clientId: "cl1" })) === null);
  const broken = await loadClientContext({ client: { findFirst: async () => { throw new Error("db down"); } } }, { companyId: "co1", clientId: "cl1" });
  ok("a failed read is no card, never a throw", broken === null);
  ok("the troubleshooter's prompt carries the card, other roles' never do", /role\.key === "troubleshooter" && String\(equipmentCard/.test(read("lib/aiEmployee/roles.js")));
}

// ── 9. The screen's sentences, in every language ───────────────────────────
{
  const src = read("app/components/aiEmployee/ReferenceLibrary.js") + read("app/app/settings/ai-employee/page.js") + read("app/app/leads/page.js");
  const keys = [...new Set([...src.matchAll(/"(app\.(?:aiEmployee\.reference|aiEmployee\.source|leads\.callback)[A-Za-z0-9_.]*)"/g)].map((m) => m[1]))];
  keys.push("app.aiEmployee.tool.look_up_error_code", "app.aiEmployee.tool.log_troubleshooting", "app.aiEmployee.reference.urgency.routine", "app.aiEmployee.reference.urgency.urgent", "app.aiEmployee.reference.urgency.emergency", ...SOURCE_FAILURE_KEYS);
  ok("the screen uses at least forty reference-library sentences", keys.length >= 40, keys.length);
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = keys.filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || !APP_MESSAGES[lang][k].trim());
    ok(`${lang}: every reference-library sentence present`, missing.length === 0, missing);
    const broken = keys.filter((k) => APP_MESSAGES[lang][k] && vars(APP_MESSAGES[lang][k]) !== vars(APP_MESSAGES.en[k]));
    ok(`${lang}: placeholders match English`, broken.length === 0, broken);
  }
  ok("the old 'we can't read a PDF yet' sentence is gone from every language", Object.keys(APP_MESSAGES).every((l) => !/can't read one yet|ne savons pas encore en lire|todavía no podemos leer uno/.test(APP_MESSAGES[l]["app.aiEmployee.source.failed.pdf"])));
  ok("the stale 'no PDF reader' header is gone", !/package\.json has no PDF or DOCX reader/.test(read("lib/aiEmployee/sources.js")) && !/FieldQuo has no\s*\/\/\/ PDF or DOCX reader/.test(read("prisma/schema.prisma")));
}

// ── 10. Every new route has its caller ─────────────────────────────────────
{
  const ui = read("app/components/aiEmployee/ReferenceLibrary.js");
  ok("the screen calls every reference route it relies on",
    ["/api/ai-employee/sources", "/api/ai-employee/codes", "/ocr", "/codes`", "/file`", "method: \"PATCH\""].every((s) => ui.includes(s)));
  ok("PDFs and .xlsx go to PRIVATE storage through the one uploader", /uploadFile\(file, \{ purpose: "reference" \}\)/.test(ui) && !/fetch\("\/api\/upload"/.test(ui));
  ok("the page images for OCR are rendered from the person's copy and never uploaded", /renderPagesAsJpeg\(file, batch/.test(ui) && !/uploadFile\([^)]*\.jpg/.test(ui));
  ok("…and a re-picked PDF is checked against the stored hash before a page is rendered", ui.indexOf("fileSha256(file)") < ui.indexOf("renderPagesAsJpeg(file") && /hash !== s\.fileHash/.test(ui));
}

// ── 11. FieldQuo's shared manual library (owner, 2026-10-04) ──────────────
//
// Manufacturer manuals shared across companies as READ-ONLY defaults,
// deduplicated by file hash — and a company's private upload NEVER crosses
// a tenant without its own tick. Executed against a scripted store holding
// two companies' rows.
{
  const SL = await import("@/lib/aiEmployee/sharedLibrary");
  const { canShare, shareSource, withdrawShare, liveSharedManuals, sharedPagesFor, asSource, canMove, SHARED_LIBRARY_SCOPE, LIBRARY_LABEL } = SL;

  const src = (over = {}) => ({ id: "s1", companyId: "A", kind: "manual", title: "Rheem power vent manual", status: "ready", fileHash: "h-rheem", storageKey: "https://x/fieldquo/companies/A/reference/r.pdf", pageCount: 2, pagesRead: 2, unreadPages: [], brand: "Rheem", modelPattern: "PROG", category: "water heater", trade: "plumbing", originalFilename: "r.pdf", bytes: 1000, sharedManualId: null, sharedAt: null, ...over });
  ok("only a read, brand-tagged PDF filed as a manual can be shared", canShare(src()).ok && canShare(src({ kind: "policy" })).reason === "not_a_manual" && canShare(src({ kind: "troubleshooting" })).ok === false && canShare(src({ brand: null })).reason === "no_brand" && canShare(src({ pageCount: null })).reason === "not_a_pdf" && canShare(src({ status: "failed" })).reason === "not_read" && canShare(src({ fileHash: null })).reason === "no_file");

  function store() {
    const s = {
      aiEmployeeSource: [src(), src({ id: "s2", companyId: "A", kind: "policy", title: "Our warranty SOP", fileHash: "h-sop", brand: null }), src({ id: "sB", companyId: "B", title: "B's private Carrier manual", fileHash: "h-carrier", brand: "Carrier" })],
      aiEmployeeSourcePage: [
        { companyId: "A", sourceId: "s1", page: 1, text: "Rheem manual page one: 4 flashes means excessive temperature.", method: "text" },
        { companyId: "A", sourceId: "s1", page: 2, text: "Rheem manual page two.", method: "text" },
        { companyId: "B", sourceId: "sB", page: 1, text: "SECRET B PAGE: Carrier code 33", method: "text" },
      ],
      sharedManual: [],
      sharedManualPage: [],
    };
    let n = 0;
    const m = (row, w = {}) => Object.entries(w).every(([k, v]) => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("notIn" in v) return !v.notIn.includes(row[k]);
        if ("not" in v) return v.not === null ? row[k] != null : row[k] !== v.not;
        if ("lte" in v) return row[k] <= v.lte;
        return true;
      }
      return v === null ? row[k] == null : row[k] === v;
    });
    const reads = [];
    const model = (name) => ({
      findFirst: async ({ where }) => { reads.push({ name, where }); return s[name].find((r) => m(r, where)) || null; },
      findUnique: async ({ where }) => { reads.push({ name, where }); return s[name].find((r) => m(r, where)) || null; },
      findMany: async ({ where = {}, take } = {}) => {
        reads.push({ name, where });
        const { OR, ...rest } = where;
        let rows = s[name].filter((r) => m(r, rest));
        if (OR) rows = rows.filter((r) => OR.some((o) => Object.entries(o).every(([k, v]) => String(r[k] || "").toLowerCase().includes(String(v.contains).toLowerCase()))));
        return rows.slice(0, take || 1e9);
      },
      create: async ({ data }) => { const row = { id: `${name}${++n}`, ...data }; s[name].push(row); return row; },
      createMany: async ({ data }) => { for (const d of data) s[name].push({ id: `${name}${++n}`, ...d }); return { count: data.length }; },
      update: async ({ where, data }) => Object.assign(s[name].find((r) => m(r, where)), data),
      updateMany: async ({ where, data }) => { const rows = s[name].filter((r) => m(r, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    });
    const prisma = { $s: s, $reads: reads };
    for (const k of Object.keys(s)) prisma[k] = model(k);
    prisma.$transaction = async (fn) => fn(prisma);
    return prisma;
  }

  {
    const p = store();
    const refused = await shareSource({ prisma: p, companyId: "A", sourceId: "s1", confirmed: false });
    ok("sharing needs the company to confirm it is the manufacturer's own manual", refused.ok === false && refused.reason === "not_confirmed" && p.$s.sharedManual.length === 0);
    const sop = await shareSource({ prisma: p, companyId: "A", sourceId: "s2", confirmed: true });
    ok("a company SOP can never be shared", sop.ok === false && sop.reason === "not_a_manual" && p.$s.sharedManual.length === 0);
    const foreign = await shareSource({ prisma: p, companyId: "A", sourceId: "sB", confirmed: true });
    ok("company A cannot share company B's manual — it is not even found", foreign.ok === false && foreign.status === 404 && p.$s.sharedManual.length === 0);
    const shared = await shareSource({ prisma: p, companyId: "A", sourceId: "s1", confirmed: true });
    const lib = p.$s.sharedManual[0];
    ok("a confirmed share writes ONE library row, PENDING review, attributed to the company", shared.ok && p.$s.sharedManual.length === 1 && lib.status === "pending" && lib.origin === "company_share" && lib.sharedByCompanyId === "A" && lib.fileHash === "h-rheem");
    ok("…its page TEXT is copied — the company's file is not (storageKey null)", p.$s.sharedManualPage.length === 2 && lib.storageKey === null && p.$s.sharedManualPage.every((x) => x.manualId === lib.id));
    ok("…only company A's pages were read, never company B's", !p.$s.sharedManualPage.some((x) => /SECRET B/.test(x.text)) && p.$reads.filter((r) => r.name === "aiEmployeeSourcePage").every((r) => r.where.companyId === "A"));
    ok("…and the company's source is marked shared", p.$s.aiEmployeeSource[0].sharedAt instanceof Date && p.$s.aiEmployeeSource[0].sharedManualId === lib.id);

    const none = await liveSharedManuals(p, {});
    ok("PENDING is visible to nobody — no other company reads it until FieldQuo approves", none.length === 0);
    ok("only a platform admin's move can make it live, and a withdrawn share stays withdrawn", canMove("pending", "live") && canMove("live", "retired") && canMove("retired", "live") && !canMove("withdrawn", "live") && !canMove("pending", "pending"));
    lib.status = "live";
    const live = await liveSharedManuals(p, {});
    ok("live: every company's assistant can read it, labelled as FieldQuo's library", live.length === 1 && live[0].shared === true && live[0].title.includes(LIBRARY_LABEL) && live[0].kind === "manual");
    ok("…but a company that uploaded the same file reads its OWN copy, never both", (await liveSharedManuals(p, { ownHashes: ["h-rheem"] })).length === 0);
    ok("…the library read touches only the library tables, never a company's sources", p.$reads.filter((r) => r.name === "sharedManual").length > 0 && !p.$reads.some((r) => r.name === "aiEmployeeSource" && !r.where.companyId));

    // Dedupe: B uploads the SAME PDF and shares it — one library row.
    p.$s.aiEmployeeSource.push(src({ id: "sB2", companyId: "B", fileHash: "h-rheem" }));
    const dup = await shareSource({ prisma: p, companyId: "B", sourceId: "sB2", confirmed: true });
    ok("the same file shared by a second company is deduplicated by its hash — nothing stored twice", dup.ok && dup.deduplicated === true && p.$s.sharedManual.length === 1 && p.$s.sharedManualPage.length === 2);

    // Retrieval reads pages only for manuals the plan signalled.
    const libSrc = live.map((x) => x);
    const plan = pageReadPlan(libSrc, { query: "my Rheem water heater flashes 4 times", equipment: [] });
    const pages = await sharedPagesFor(p, { manuals: libSrc, plan });
    ok("a reply reads library pages only for a manual the message or the equipment names", pages.get(libSrc[0].id)?.length >= 1);
    const quiet = await sharedPagesFor(p, { manuals: libSrc, plan: pageReadPlan(libSrc, { query: "do you paint decks?", equipment: [] }) });
    ok("…and none for a message that names nothing in it (never a scan of the whole library)", quiet.size === 0);
    const chunks = selectChunks({
      sources: [
        { id: "own", title: "Our Rheem notes", kind: "manual", brand: "Rheem", pageCount: 1, pages: [{ page: 1, text: "Rheem flashes: call us." }] },
        { ...libSrc[0], pages: pages.get(libSrc[0].id) },
      ],
      query: "Rheem flashes",
      role: "troubleshooter",
    });
    ok("the company's own material comes before FieldQuo's library at the same tier", chunks[0]?.id === "own" && chunks.some((c) => String(c.id).startsWith("shared:")));

    // Withdraw while pending; a live one stays (it's the manufacturer's).
    lib.status = "pending";
    const w = await withdrawShare({ prisma: p, companyId: "A", sourceId: "s1" });
    ok("withdrawing a pending share withdraws the library copy, never deletes it", w.ok && w.manualStatus === "withdrawn" && p.$s.sharedManual.length === 1 && p.$s.aiEmployeeSource[0].sharedAt === null);
    const wB = await withdrawShare({ prisma: p, companyId: "B", sourceId: "s1" });
    ok("another company cannot withdraw it", wB.ok === false && wB.status === 404);
  }

  // The platform side: its own folder, its own permission, audited.
  const libRoute = read("app/api/platform/manuals/route.js");
  ok("FieldQuo's uploads live in a folder no company id can name", SHARED_LIBRARY_SCOPE === "fieldquo-library" && !/^c[a-z0-9]{20,}$/.test(SHARED_LIBRARY_SCOPE) && uploadScope("member", { companyId: SHARED_LIBRARY_SCOPE, purpose: "reference" }).deliveryType === "authenticated");
  ok("the platform routes need manual_library:manage, and every write is on the audit log", /requirePlatformPermission\(admin\.role, "manual_library:manage"\)/.test(libRoute) && /platformAuditLog\.create/.test(libRoute) && /requirePlatformPermission\(admin\.role, "manual_library:manage"\)/.test(read("app/api/platform/manuals/[id]/route.js")) && /requirePlatformPermission\(admin\.role, "manual_library:manage"\)/.test(read("app/api/platform/manuals/upload/sign/route.js")));
  ok("the platform upload is deduplicated by SHA-256 and refuses an untagged manual", /sharedManual\.findUnique\(\{ where: \{ fileHash \}/.test(libRoute) && /Tag the brand/.test(libRoute));
  ok("the platform never reads or writes a company's sources", !/aiEmployeeSource\b|aiEmployeeSourcePage/.test(libRoute.replace(/\/\/.*$/gm, "")) && !/aiEmployeeSource\b|aiEmployeeSourcePage/.test(read("app/api/platform/manuals/[id]/route.js").replace(/\/\/.*$/gm, "")));
  ok("support can see the page but not the buttons", (await import("@/lib/platform/permissions")).canPlatform("support", "manual_library:manage") === false && (await import("@/lib/platform/permissions")).canPlatform("admin", "manual_library:manage") === true);
  const share = read("app/api/ai-employee/sources/[id]/share/route.js");
  ok("the share route is owner/admin, refuses a support session, and is audited", /requirePermission\(member\.role, "user:manage"\)/.test(share) && /member\.impersonation/.test(share) && /ai_employee\.manual_shared/.test(share));
  ok("the screen offers the share only behind a confirmation, and calls the route", /\/share`/.test(read("app/components/aiEmployee/ReferenceLibrary.js")) && /share\.confirm/.test(read("app/components/aiEmployee/ReferenceLibrary.js")) && /disabled=\{!shareAsk\[s\.id\]\?\.confirmed/.test(read("app/components/aiEmployee/ReferenceLibrary.js")));
  ok("the platform page uploads through its own sign/verify pair", /endpoint: "\/api\/platform\/manuals\/upload"/.test(read("app/platform/manuals/page.js")));
}

console.log(`\ncheck-reference-library: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
