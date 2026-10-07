// scripts/check-gc-onramp.mjs
//
// The GC on-ramp (owner 2026-10-06): a general contractor who received a
// subcontractor's quote signs up fast, adds the price to their own quote from
// the approved screen or the portal, the sub is asked once whether a
// company-sounding client is a business, and a sub who is NOT on FieldQuo can
// be uploaded as a PDF or photo and compared.
//
//   npm run check:gc-onramp
//
// Executed, against hostile input, wherever a function can be run:
//
//   1. Prefill exposure — the signup/welcome prefill carries nothing the
//      quote page does not already show the token holder.
//   2. An existing account is offered a login (carrying the way back), never
//      a second account.
//   3. A homeowner (an individual client) never sees a FieldQuo-branded line.
//   4. An AI-read amount is never used unconfirmed.
//   5. A malformed or hostile file is refused with a plain sentence and
//      nothing is charged — the meter is never even asked.
//   6. The markup — the client price — is derived on the server.
//
// Plus the short welcome list for a GC, and the parts that can only be read
// (a page renders a line under a server boolean) are asserted on the source.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { quotePageClientFacts, gcSignupPrefill, addPathToken } from "@/lib/quotes/gcSignup";
import { addToQuoteTokenFromCookies, gcWelcomeContext } from "@/lib/signup/gcWelcome";
import {
  GC_WELCOME_STEPS,
  WELCOME_STEPS,
  allowedWelcomeStep,
  nextWelcomeStep,
  previousWelcomeStep,
  resumeWelcomeStep,
} from "@/lib/signup/welcome";
import { isBusinessClient } from "@/lib/quotes/addToQuoteLink";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { looksLikeBusinessName, shouldAskIfBusiness, businessAnswerUpdate } from "@/lib/clients/businessQuestion";
import {
  readConfirmation,
  usableCost,
  uploadClientPrice,
  uploadView,
  clientFacingLabel,
  matchSubcontractor,
  normaliseSubQuoteReading,
  isoDateOrNull,
} from "@/lib/quotes/subQuoteUpload";
import { parseMoneyInput } from "@/lib/quotes/moneyInput";
import { confirmUpload, materializeUploadedSubCosts, placeUploadLine } from "@/lib/quotes/subQuoteUploadWrite";
import { meteredRead, uploadFilesOrRefusal, UPLOAD_FAILED_SENTENCE } from "@/lib/quotes/subQuoteUploadServer";
import { PAYER_FEATURES } from "@/lib/ai/featurePayer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

let passed = 0;
const failed = [];
function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed.push(name);
    console.log(`  ✗    ${name}${detail !== undefined ? `  — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
}
async function throwsAsync(fn) {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
}

// Our own Cloudinary, for isOurCloudinaryUrl. No API secret: the signer is
// null, so the PDF fetch goes through the injected fetch below.
process.env.CLOUDINARY_CLOUD_NAME = "fqcheck";
delete process.env.CLOUDINARY_API_SECRET;
const OURS = (p) => `https://res.cloudinary.com/fqcheck/${p}`;

const TOKEN = "A".repeat(43);

/* ═══ 1. Prefill exposure ═══════════════════════════════════════════════════ */
console.log("\n1. The prefill shows nothing the quote page does not");
{
  const privateRow = {
    name: "Northline Builders Ltd",
    type: "company",
    contactName: "Jane Private",
    email: "jane@northline.example",
    phone: "416-555-0100",
    address: "1 Office Rd, Toronto",
    notes: "pays late",
    portalToken: "secret-portal",
    language: "en",
  };
  const facts = quotePageClientFacts(privateRow);
  ok("the quote page's client object is the name and nothing else", JSON.stringify(Object.keys(facts)) === '["name"]', Object.keys(facts));
  const prefill = gcSignupPrefill(facts);
  const pageValues = new Set(Object.values(facts));
  ok("every prefilled value is one the page shows", Object.values(prefill).every((v) => pageValues.has(v)), prefill);
  ok("...the business name is prefilled", prefill.companyName === "Northline Builders Ltd", prefill);
  for (const secret of ["jane@northline.example", "416-555-0100", "1 Office Rd, Toronto", "Jane Private", "pays late", "secret-portal"]) {
    ok(`...and "${secret}" is not`, !JSON.stringify(prefill).includes(secret));
  }
  ok("a name carrying markup is not prefilled", gcSignupPrefill(quotePageClientFacts({ name: "<img src=x onerror=alert(1)>" })).companyName === undefined);
  ok("control characters are flattened, not carried", gcSignupPrefill({ name: "Acme\u0000\u0007 Ltd" }).companyName === "Acme Ltd");
  ok("a facts object with an inherited key leaks nothing", Object.keys(gcSignupPrefill(Object.create({ email: "x@y.z" }))).length === 0);
  ok("null facts prefill nothing", Object.keys(gcSignupPrefill(null)).length === 0);

  // The server helper: what it ASKS the database for, and what it returns
  // even when the database answers with more.
  const asked = [];
  const fakePrisma = (row) => ({
    quote: {
      findFirst: async (args) => {
        asked.push(args);
        return row;
      },
    },
  });
  const gc = await gcWelcomeContext(`a=1; fq_add_quote=${TOKEN}; b=2`, {
    prisma: fakePrisma({ status: "sent", client: privateRow, company: { name: "Sparky Electric" } }),
  });
  ok("gcWelcomeContext selects only the client's NAME", JSON.stringify(asked[0]?.select?.client) === '{"select":{"name":true}}', asked[0]?.select);
  ok("...and returns only the page fact even when handed the whole row", JSON.stringify(gc.prefill) === '{"companyName":"Northline Builders Ltd"}', gc.prefill);
  ok("...with the short welcome list", gc.gc === true && JSON.stringify(gc.steps) === JSON.stringify(GC_WELCOME_STEPS));
  const draft = await gcWelcomeContext(`fq_add_quote=${TOKEN}`, { prisma: fakePrisma({ status: "draft", client: privateRow }) });
  ok("a DRAFT quote's token is no hand-off (the page 404s it)", draft.gc === false && Object.keys(draft.prefill).length === 0);
  const unknown = await gcWelcomeContext(`fq_add_quote=${TOKEN}`, { prisma: fakePrisma(null) });
  ok("an unknown token is no hand-off", unknown.gc === false && unknown.steps === WELCOME_STEPS);
  for (const [hostile, why] of [
    ["fq_add_quote=../../etc/passwd", "a path"],
    ["fq_add_quote=<script>alert(1)</script>", "markup"],
    ["fq_add_quote=", "an empty value"],
    ["", "no cookie"],
    [`xfq_add_quote=${TOKEN}`, "a look-alike cookie name"],
  ]) {
    ok(`a cookie with ${why} names no token`, addToQuoteTokenFromCookies(hostile) === null);
  }
  const before = asked.length;
  await gcWelcomeContext("fq_add_quote=<script>", { prisma: fakePrisma({ status: "sent", client: privateRow }) });
  ok("...and a malformed cookie never reaches the database", asked.length === before);

  ok("addPathToken reads /q/<token>/add", addPathToken(`/q/${TOKEN}/add`) === TOKEN);
  for (const p of ["//evil.com/q/x/add", `/q/${TOKEN}`, `https://evil.com/q/${TOKEN}/add`, `/q/${TOKEN}/add?x=1`, "/q/short/add"]) {
    ok(`addPathToken refuses ${p.slice(0, 40)}`, addPathToken(p) === null);
  }

  const pub = code("app/api/public/quotes/[token]/route.js");
  ok("the public quote page builds its client object with quotePageClientFacts", /client: quotePageClientFacts\(quote\.client\),/.test(pub));
  ok("...and never forwards the client's type, only a boolean", !/type: quote\.client/.test(pub) && /addToQuote: isBusinessClient\(quote\.client\),/.test(pub));
  const signup = code("app/signup/page.js");
  ok("the signup page reads nothing about the CLIENT from the token (only the sender name)", /setGcSender\(d\?\.sourceCompanyName \|\| ""\)/.test(signup) && !/d\?\.(clientEmail|client\b|email)/.test(signup.slice(signup.indexOf("const [gcSender"), signup.indexOf("const [gcSender") + 1500)));
  const received = code("app/api/quotes/received/[token]/route.js");
  const sourceQuery = received.slice(received.indexOf("const source = await"), received.indexOf("if (!source"));
  ok("the received-quote route still loads no client relation on the SOURCE quote", sourceQuery.length > 50 && !/client:\s*\{/.test(sourceQuery.replace(/\/\/.*$/gm, "")));
}

/* ═══ The short welcome list ════════════════════════════════════════════════ */
console.log("\nThe welcome questions, cut to what a GC needs");
{
  const answered = {
    user: { name: "Jane Doe", phone: "416-555-0100" },
    company: { name: "Northline", country: "CA", address: "1 Office Rd" },
    tradeKeys: ["general_contracting"],
  };
  ok("with the GC list, profile + business answered → setup", resumeWelcomeStep(answered, { steps: GC_WELCOME_STEPS }) === "setup");
  ok("...with the full list, the same answers → size (unchanged behaviour)", resumeWelcomeStep(answered) === "size");
  ok("the GC list sends /welcome/size to setup, never shows it", allowedWelcomeStep("size", answered, { steps: GC_WELCOME_STEPS }) === "setup");
  ok("...and the full list still allows size", allowedWelcomeStep("size", answered) === "size");
  ok("business → setup on the GC list", nextWelcomeStep("business", { steps: GC_WELCOME_STEPS }) === "setup");
  ok("Back from setup is business on the GC list", previousWelcomeStep("setup", { steps: GC_WELCOME_STEPS }) === "business");
  ok("an unanswered profile still comes first", resumeWelcomeStep({ user: {}, company: {}, tradeKeys: [] }, { steps: GC_WELCOME_STEPS }) === "profile");
  for (const [steps, why] of [
    [["setup"], "a list that skips the questions entirely"],
    [["business", "setup"], "a list that skips who they are"],
    [["profile", "business"], "a list with no setup"],
    [["profile", "hack", "setup"], "a list naming an unknown step"],
    ["profile,setup", "a string"],
  ]) {
    const got = resumeWelcomeStep({ user: {}, company: {}, tradeKeys: [] }, { steps });
    ok(`${why}: still asks who they are, on the full list`, got === "profile" && nextWelcomeStep("business", { steps }) === "size", got);
  }
  const page = code("app/welcome/[step]/page.js");
  ok("the welcome page prefills the business name only into an EMPTY field", /if \(gc\.gc && !prefill\.company\.name && gc\.prefill\.companyName\)/.test(page));
  const setup = code("app/api/signup/setup/route.js");
  const pers = code("app/api/signup/personalize/route.js");
  ok("page, personalize and setup all take the list from gcWelcomeContext", /gcWelcomeContext\(h\.get\("cookie"\)\)/.test(page) && /gcWelcomeContext\(request\.headers\.get\("cookie"\)\)/.test(pers) && /gcWelcomeContext\(request\.headers\.get\("cookie"\)\)/.test(setup));
}

/* ═══ 2. An existing account gets a login ═══════════════════════════════════ */
console.log("\n2. An existing login is offered Sign in, not a second account");
{
  const signup = code("app/signup/page.js");
  const fn = signup.slice(signup.indexOf("async function handleAccountSubmit"), signup.indexOf("async function handleStartSignedIn"));
  const exists = fn.indexOf("USER_ALREADY_EXISTS");
  const ret = fn.indexOf("return;", exists);
  const create = fn.indexOf("createCompany()");
  ok("USER_ALREADY_EXISTS returns BEFORE the company is created", exists > 0 && ret > exists && create > ret);
  ok("...and marks the address as an existing login", /setExistingLogin\(form\.email\.trim\(\)\.toLowerCase\(\)\)/.test(fn.slice(exists, ret)));
  ok("the Sign in link carries the way back to the add page (internal paths only)", /isInternalPath\(loginNext\) \? `&next=\$\{encodeURIComponent\(loginNext\)\}` : ""/.test(signup));
  ok("...and the signup page hands it nextPath", /loginNext=\{nextPath\}/.test(signup));
  const login = code("app/login/page.js");
  ok("/login honours ?next= and ?email=", /safeNext\(params\.get\("next"\)\)/.test(login) && /params\.get\("email"\)/.test(login));
}

/* ═══ 3. A homeowner never sees a FieldQuo line ═════════════════════════════ */
console.log("\n3. Homeowners never see a FieldQuo-branded line");
{
  for (const [client, want, why] of [
    [{ type: "company" }, true, "a company"],
    [{ type: "individual" }, false, "an individual"],
    [{}, false, "a client with no type (the default is a homeowner)"],
    [null, false, "no client"],
    [{ type: "Company" }, false, "a mis-cased type"],
    [{ type: ["company"] }, false, "an array"],
    [{ type: { toString: () => "company" } }, false, "an object that stringifies"],
  ]) {
    ok(`isBusinessClient: ${why} → ${want}`, isBusinessClient(client) === want);
  }
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl", "de", "it"]) {
    const line = clientDocCopy(lang).addToOwnQuote;
    ok(`the ${lang} line exists and does not say FieldQuo`, typeof line === "string" && line.length > 5 && !/fieldquo/i.test(line), line);
  }
  const approval = code("app/q/[token]/QuoteApproval.js");
  ok("the approved screen draws the line only when the server says business", /\{quote\.addToQuote === true && !sample && \(/.test(approval));
  const portalApi = code("app/api/portal/[token]/route.js");
  ok("the portal's flag starts false and is set only from isBusinessClient", /let businessClient = false;/.test(portalApi) && /businessClient = isBusinessClient\(home\);/.test(portalApi) && /addToQuote: businessClient,/.test(portalApi));
  const portal = code("app/portal/[token]/ClientPortal.js");
  ok("the portal draws it only when the server says business", /\{data\.addToQuote === true && q\.shareToken && \(/.test(portal));

  // The sub-side question decides whether to ASK, never what the client is.
  for (const name of ["John Smith", "Marie-Ève Tremblay", "Coates", "Homesley Park", "Gurpreet Singh", "", null]) {
    ok(`"${name}" is not asked about`, shouldAskIfBusiness({ type: "individual", name }) === false);
  }
  for (const name of ["Northline Builders Ltd", "Sparky Electric Inc.", "Tremblay & Fils", "Rénovations Gagnon ltée", "Bob's Construction"]) {
    ok(`"${name}" (an individual) is asked about once`, shouldAskIfBusiness({ type: "individual", name }) === true);
  }
  ok("...not once answered", shouldAskIfBusiness({ type: "individual", name: "Northline Builders Ltd", businessAskedAt: new Date() }) === false);
  ok("...and never a company", shouldAskIfBusiness({ type: "company", name: "Northline Builders Ltd" }) === false);
  ok("looksLikeBusinessName is word-bounded (co ≠ Coates)", looksLikeBusinessName("Coates") === false && looksLikeBusinessName("Acme Co") === true);
  ok("'business' makes the client a company and stamps the question", (() => { const u = businessAnswerUpdate("business"); return u.type === "company" && u.businessAskedAt instanceof Date; })());
  ok("'individual' stamps the question and leaves the type alone", (() => { const u = businessAnswerUpdate("individual"); return !("type" in u) && u.businessAskedAt instanceof Date; })());
  for (const hostile of ["company", "__proto__", "BUSINESS", undefined, null, 1, { answer: "business" }]) {
    ok(`an answer of ${JSON.stringify(hostile)} is refused`, businessAnswerUpdate(hostile) === null);
  }
  const route = code("app/api/clients/[id]/business-answer/route.js");
  ok("the answer route asks the client-edit level before answering or asking", (route.match(/hasLevel\(full, "clientsProperties", "full_edit"\)/g) || []).length === 2);
  ok("...and is tenant-scoped", (route.match(/companyId: member\.companyId/g) || []).length === 2);
}

/* ═══ 4. An AI-read amount is never used unconfirmed ════════════════════════ */
console.log("\n4. Nothing read by the AI is used until the GC confirms it");
const unconfirmed = {
  id: "u1",
  companyId: "gc",
  quoteId: "q1",
  status: "needs_review",
  files: [{ url: OURS("raw/upload/q.pdf"), kind: "document", filename: "q.pdf" }],
  reading: normaliseSubQuoteReading({ subName: "Sparky Electric", trade: "Electrical", printedTotal: "$9,999.00", unreadable: [] }),
  // A cost column populated by something other than Confirm must still not count.
  costAmount: 9999,
  confirmedAt: null,
  markupPercent: 20,
  placement: "line",
  targetLineId: "",
  subName: "Sparky Electric",
  trade: "Electrical",
};
{
  ok("usableCost is null without a confirmation, even with a cost on the row", usableCost(unconfirmed) === null);
  ok("...and so is the client price", uploadClientPrice(unconfirmed) === null);
  const view = uploadView(unconfirmed);
  ok("an unconfirmed upload's view carries no cost, price or compare key", !["costAmount", "clientPrice", "comparisonKey", "markupPercent"].some((k) => k in view), Object.keys(view));
  ok("...only its reading, as printed strings", view.reading?.printedTotal === "$9,999.00");
  ok("the reading keeps every figure a string", Object.entries(normaliseSubQuoteReading({ printedTotal: 1234, printedTax: 5 })).every(([k, v]) => !["printedTotal", "printedTax"].includes(k) || v === null));
  ok("an impossible valid-until is dropped, not rolled over", isoDateOrNull("2026-02-31") === null && isoDateOrNull("2026-02-28") === "2026-02-28");

  // Confirm reads the figures from the BODY the GC posted, never from the reading.
  const r = readConfirmation({ subName: "Sparky Electric", trade: "Electrical" });
  ok("Confirm without a total is refused, even though the reading has one", !r.ok && r.field === "total", r);

  // Booking to the job: only the confirmed line.
  const exp = [];
  const fakeDb = {
    subQuoteUpload: {
      findMany: async ({ where }) =>
        [
          { id: "a", companyId: "gc", quoteId: "q1", placement: "line", expenseId: null, costAmount: 500, confirmedAt: new Date(), trade: "Drywall", subName: "Dry Co" },
          { ...unconfirmed, id: "b", expenseId: null },
        ].filter((u) => u.placement === where.placement && u.expenseId === where.expenseId),
      update: async () => ({}),
    },
    expense: { create: async ({ data }) => (exp.push(data), { id: `e${exp.length}` }) },
  };
  const made = await materializeUploadedSubCosts(fakeDb, { quoteId: "q1", jobId: "j1", companyId: "gc" });
  ok("job costing books the confirmed line and skips the unconfirmed one", made === 1 && exp.length === 1 && Number(exp[0].amount) === 500, exp);

  const err = await throwsAsync(() =>
    placeUploadLine({
      db: { subQuoteUpload: { findFirst: async () => ({ ...unconfirmed, placement: "option", quote: { id: "q1", status: "draft" } }) } },
      member: { companyId: "gc" },
      quoteId: "q1",
      uploadId: "u1",
      targetCompany: {},
    }),
  );
  ok("'Use this one' on an unconfirmed upload is refused", err && err.status === 400, err?.message);

  const ui = code("app/app/quotes/[id]/SubQuoteUploads.js");
  ok("the confirm form posts only once the GC ticks that they checked", /if \(busy \|\| !checked\) return;/.test(ui) && /disabled=\{!checked \|\| Boolean\(busy\)\}/.test(ui));
  ok("...and editing any figure un-ticks it", /setChecked\(false\);/.test(ui.slice(ui.indexOf("const set = (k, v)"), ui.indexOf("const set = (k, v)") + 200)));
}

/* ═══ 5. A hostile file is refused, nothing charged ═════════════════════════ */
console.log("\n5. A malformed or hostile file: a plain sentence, nothing charged");
{
  for (const [files, why] of [
    [[], "no file"],
    [[{ url: "http://res.cloudinary.com/fqcheck/x.pdf", kind: "document" }], "plain http"],
    [[{ url: "https://evil.example/q.pdf", kind: "document" }], "another host"],
    [[{ url: "https://res.cloudinary.com/othercloud/q.pdf", kind: "document" }], "another Cloudinary account"],
    [[{ url: "https://res.cloudinary.com@evil.example/fqcheck/q.pdf", kind: "document" }], "a userinfo trick"],
    [[{ url: "https://res.cloudinary.com:8443/fqcheck/q.pdf", kind: "document" }], "a port"],
    [[{ url: OURS("v.mp4"), kind: "video" }], "a video"],
    [[1, 2, 3, 4, 5].map((i) => ({ url: OURS(`p${i}.jpg`), kind: "photo" })), "five photos"],
    [[{ url: OURS("a.pdf"), kind: "document" }, { url: OURS("b.jpg"), kind: "photo" }], "a PDF with a photo"],
    ["not-an-array", "a string"],
  ]) {
    const r = uploadFilesOrRefusal(files);
    ok(`refused: ${why}`, !r.ok && typeof UPLOAD_FAILED_SENTENCE[r.code] === "string", r);
  }
  ok("every refusal sentence is plain words (no stack, no vendor)", Object.values(UPLOAD_FAILED_SENTENCE).every((s) => !/error:|undefined|stack|openai|prisma/i.test(s)));

  // The order: a bad PDF never reaches the meter.
  let meterAsked = 0;
  let modelCalled = 0;
  const meter = async () => {
    meterAsked++;
    return { check: async () => ({ allowed: true }), record: async () => ({}) };
  };
  const read = async () => {
    modelCalled++;
    return { ok: true, data: {} };
  };
  const body = (text, headers = {}) => async () => ({
    ok: true,
    headers: { get: (h) => headers[h.toLowerCase()] ?? null },
    arrayBuffer: async () => Buffer.from(text, "latin1"),
  });
  const member = { companyId: "gc", userId: "u" };
  const pdfUpload = { files: [{ url: OURS("raw/upload/q.pdf"), kind: "document", filename: "q.pdf" }] };
  for (const [fetchImpl, why, code_] of [
    [body("<html><script>alert(1)</script></html>"), "HTML renamed .pdf", "not_pdf"],
    [body("\u0089PNG\r\n"), "a PNG renamed .pdf", "not_pdf"],
    [body(`%PDF-1.7 ${"/Type /Page ".repeat(9)}`), "a 9-page 'quote'", "too_many_pages"],
    [body("%PDF-1.7", { "content-length": String(50 * 1024 * 1024) }), "a declared 50 MB file", "too_large"],
    [async () => ({ ok: false, headers: { get: () => null } }), "a file that will not open", "fetch_failed"],
    [async () => {
      throw new Error("ECONNRESET");
    }, "a dropped connection", "fetch_failed"],
  ]) {
    const before = meterAsked;
    const res = await meteredRead({ feature: "sub_quote_read", member, upload: pdfUpload, read, ref: "x", deps: { meter, isDemo: async () => false, fetchImpl } });
    ok(`${why}: refused as ${code_}, nothing charged, meter never asked`, !res.ok && res.code === code_ && res.charged === false && meterAsked === before, res);
  }
  ok("...and the model was never called for any of them", modelCalled === 0);

  // No credit: the meter refuses, the model is not called, nothing charged.
  const empty = async () => ({ check: async () => ({ allowed: false, code: "no_credit" }), record: async () => { throw new Error("recorded"); } });
  const goodPdf = body("%PDF-1.7 /Type /Page /Type /Pages");
  const nc = await meteredRead({ feature: "sub_quote_read", member, upload: pdfUpload, read, ref: "x", deps: { meter: empty, isDemo: async () => false, fetchImpl: goodPdf } });
  ok("an empty AI credit: refused before the model, nothing charged", !nc.ok && nc.code === "no_credit" && nc.charged === false && modelCalled === 0, nc);
  const demo = await meteredRead({ feature: "sub_quote_read", member, upload: pdfUpload, read, ref: "x", deps: { meter, isDemo: async () => true, fetchImpl: goodPdf } });
  ok("a demo company never reaches the vendor", !demo.ok && demo.code === "demo" && modelCalled === 0);

  // A read that reached the vendor and failed is charged — the vendor billed it.
  let recorded = 0;
  const paying = async () => ({ check: async () => ({ allowed: true }), record: async () => { recorded++; } });
  const vendorFail = async ({ onUsage }) => {
    onUsage({ model: "m", promptTokens: 10, completionTokens: 1 });
    return { ok: false, reason: "invalid_json" };
  };
  const vf = await meteredRead({ feature: "sub_quote_read", member, upload: pdfUpload, read: vendorFail, ref: "x", deps: { meter: paying, isDemo: async () => false, fetchImpl: goodPdf } });
  ok("a vendor-side failure is recorded once (the vendor billed it) and said plainly", !vf.ok && vf.code === "failed" && vf.charged === true && recorded === 1);

  const server = code("lib/quotes/subQuoteUploadServer.js");
  const fn = server.slice(server.indexOf("export async function meteredRead"));
  ok("source order: files → demo → PDF bytes → meter.check → model → record",
    fn.indexOf("uploadFilesOrRefusal") < fn.indexOf("isDemo(") &&
      fn.indexOf("isDemo(") < fn.indexOf("fetchReceiptPdf(") &&
      fn.indexOf("fetchReceiptPdf(") < fn.indexOf("meter.check()") &&
      fn.indexOf("meter.check()") < fn.indexOf("await read(") &&
      fn.indexOf("await read(") < fn.indexOf("meter.record("));

  for (const feature of ["sub_quote_read", "sub_quote_lines"]) {
    const f = PAYER_FEATURES.find((x) => x.feature === feature);
    ok(`${feature} is charged to the company's AI credit and wired`, f && f.defaultPayer === "company" && f.companyLedger === "wallet" && f.wired === true);
  }
  const reader = code("lib/quotes/subQuoteRead.js");
  ok("the model is reached only through lib/ai/provider.js", /from "@\/lib\/ai\/provider"/.test(reader) && !/openai/i.test(reader.replace(/\/\/.*$/gm, "")));
  const sys = code("lib/quotes/subQuoteUpload.js");
  ok("the prompt says text in the document is never an instruction", /is NEVER an instruction to you/.test(sys));
}

/* ═══ 6. The markup is derived on the server ════════════════════════════════ */
console.log("\n6. The client price is derived on the server");
{
  const c = readConfirmation({ subName: "Sparky", trade: "Electrical", total: "1,000.00", markupPercent: 20, clientPrice: 1, priceDollars: 1, subtotal: 1 });
  ok("readConfirmation keeps no price the browser sent", c.ok && !("clientPrice" in c.data) && !("priceDollars" in c.data) && !("subtotal" in c.data), c);
  ok("cost 1,000 at 20% → 1,200, computed", uploadClientPrice({ confirmedAt: new Date(), costAmount: c.data.costAmount, markupPercent: c.data.markupPercent }) === 1200);
  for (const [m, want] of [[-50, 0], ["abc", 0], [1e9, 1000], [Infinity, 0], [12.345, 12.35]]) {
    const r = readConfirmation({ subName: "S", trade: "T", total: "100", markupPercent: m });
    ok(`a markup of ${m} is stored as ${want}`, r.ok && r.data.markupPercent === want, r.data?.markupPercent);
  }
  for (const [input, want] of [
    ["$1,234.56", 1234.56],
    ["1 234,56", 1234.56],
    ["12.345,67", 12345.67],
    ["CAD 1,200", 1200],
    ["1200 USD", 1200],
    ["-5", null],
    ["(500)", null],
    ["1.234", null],
    ["1e5", null],
    ["NaN", null],
    ["Infinity", null],
    ["99999999", null],
    ["", null],
    [null, null],
    [{ valueOf: () => 5 }, null],
  ]) {
    ok(`parseMoneyInput(${JSON.stringify(input)}) → ${want}`, parseMoneyInput(input) === want, parseMoneyInput(input));
  }
  for (const [body, field] of [
    [{ subName: "", trade: "T", total: "1" }, "subName"],
    [{ subName: "S", trade: " ", total: "1" }, "trade"],
    [{ subName: "S", trade: "T", total: "0" }, "total"],
    [{ subName: "S", trade: "T", total: "100", tax: "150" }, "tax"],
    [{ subName: "S", trade: "T", total: "100", validUntil: "2026-13-01" }, "validUntil"],
    [{ subName: "S", trade: "T", total: "100", lines: [{ description: "", amount: "5" }] }, "lines"],
    [{ subName: "S", trade: "T", total: "100", lines: [{ description: "x", amount: "-5" }] }, "lines"],
  ]) {
    const r = readConfirmation(body);
    ok(`Confirm refuses a bad ${field}`, !r.ok && r.field === field, r);
  }

  // confirmUpload against an in-memory database: the line the client sees.
  const groups = [];
  const quoteUpdates = [];
  const uploadsTable = [{ ...unconfirmed, placement: "option", quote: { id: "q1", status: "draft", discount: 0, taxEnabled: false } }];
  const tx = {
    subQuoteUpload: {
      findFirst: async () => uploadsTable[0],
      findMany: async () => [],
      update: async ({ data }) => Object.assign(uploadsTable[0], data),
    },
    quoteImport: { findMany: async () => [] },
    subcontractor: { findFirst: async () => null, create: async ({ data }) => ({ id: "sub1", ...data }) },
    serviceCategory: { upsert: async () => ({ id: "cat1" }) },
    quoteScopeGroup: {
      findMany: async () => groups.map((g) => ({ id: g.id, subtotal: g.subtotal })),
      create: async ({ data }) => {
        const g = { id: `g${groups.length + 1}`, ...data };
        groups.push(g);
        return g;
      },
      deleteMany: async () => ({}),
    },
    quote: { update: async ({ data }) => (quoteUpdates.push(data), data) },
  };
  tx.$transaction = async (fn) => fn(tx);
  const result = await confirmUpload({
    db: tx,
    member: { companyId: "gc", userId: "u" },
    quoteId: "q1",
    uploadId: "u1",
    body: {
      confirm: true,
      subName: "Sparky Electric",
      trade: "Sparky Electric electrical",
      total: "1000",
      markupPercent: 25,
      placement: "line",
      display: "itemized",
      lines: [
        { description: "Sparky Electric — panel upgrade", amount: "600" },
        { description: "Rough-in", amount: "400" },
      ],
      clientPrice: 1,
      priceDollars: 1,
    },
    targetCompany: { taxRate: 13 },
  });
  const g = groups[0];
  ok("the quote line is cost × (1 + markup), whatever the body said", g && Number(g.subtotal) === 1250, g?.subtotal);
  ok("...the itemised lines add up to it to the penny", g && Math.round(g.lineItems.reduce((s, l) => s + l.amount, 0) * 100) === 125000, g?.lineItems);
  ok("...and the quote total was recomputed from the groups", quoteUpdates.at(-1)?.subtotal === 1250 && quoteUpdates.at(-1)?.total === 1250, quoteUpdates.at(-1));
  ok("the sub's name never reaches the client's label", g && !/sparky/i.test(g.label), g?.label);
  ok("...or a client-facing line description", g && g.lineItems.every((l) => !/sparky/i.test(l.description)), g?.lineItems);
  ok("clientFacingLabel falls back to a neutral label when the trade was only the name", clientFacingLabel({ trade: "Sparky Electric", subName: "Sparky Electric" }) === "Subcontracted work");
  ok("confirming stamped confirmedAt and the confirmed cost", uploadsTable[0].confirmedAt instanceof Date && uploadsTable[0].costAmount === 1000 && result.targetTotal === 1250);

  ok("roster match: legal form and case ignored", matchSubcontractor("SPARKY ELECTRIC LTD.", [{ id: "s1", name: "Sparky Electric" }])?.id === "s1");
  ok("...a near miss is NOT a match (no wrong insurance beside a price)", matchSubcontractor("Sparky", [{ id: "s1", name: "Sparky Electric" }]) === null);
  ok("...an empty name matches nothing", matchSubcontractor("", [{ id: "s1", name: "" }]) === null);

  const routeConfirm = code("app/api/quotes/[id]/sub-uploads/[uploadId]/route.js");
  ok("the confirm route hands the body to confirmUpload and computes no price itself", /confirmUpload\(\{ db, member, quoteId: id, uploadId, body, targetCompany \}\)/.test(routeConfirm) && !/clientPrice\s*[:=]/.test(routeConfirm));
  const writer = code("lib/quotes/subQuoteUploadWrite.js");
  ok("every writer prices from uploadClientPrice / usableCost only", !/body\.(total|clientPrice|price)/.test(writer));
}

/* ═══ The compare and the parallel RFQ work ═════════════════════════════════ */
console.log("\nThe compare screen");
{
  const panel = code("app/app/quotes/[id]/ImportedCostsPanel.js");
  ok("uploads join the SAME trade groups as FieldQuo subs", /for \(const r of \[\.\.\.rows, \.\.\.confirmedUploads\]\)/.test(panel));
  ok("the upload button is reachable on a quote with no imports yet", /if \(rows\.length === 0 && uploads\.length === 0 && !uploadCtx\?\.canEdit\) return null;/.test(panel));
  const imp = code("lib/quotes/importQuote.js");
  ok("'Use this one' on an import steps an uploaded line of the same trade back too", /await tx\.subQuoteUpload\.update\(\{ where: \{ id: other\.id \}, data: \{ placement: "option", targetLineId: NO_LINE \} \}\);/.test(imp) && /stepBackTradeLines\(tx, \{/.test(imp));
  const quoteRoute = code("app/api/quotes/[id]/route.js");
  ok("the quote editor's save reconciles uploads like imports", /await reconcileSubUploadsForQuote\(tx, id\);/.test(quoteRoute));
  const job = code("lib/jobs/createJobFromQuote.js");
  ok("a new job books uploaded lines to job costing", /materializeUploadedSubCosts\(prisma, \{ quoteId, jobId: job\.id, companyId: job\.companyId \}\)/.test(job));
}

console.log(`\n${failed.length ? `FAILED — ${failed.length} of ${passed + failed.length}` : `PASSED — ${passed}/${passed} assertions`}`);
if (failed.length) {
  for (const f of failed) console.log(`  ✗ ${f}`);
  process.exit(1);
}
