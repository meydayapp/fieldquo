// scripts/check-sub-price-requests.mjs
//
//   npm run check:sub-price-requests
//
// A general contractor asking the subs they already have to price a job
// (lib/subRequests/). The owner, 2026-10-06:
//
//   "the GC sending a request for quote to the subs they have; the sub gets
//    an email asking them to log into FieldQuo to ease the linkage between
//    the two."
//
// ══ What is EXECUTED ═══════════════════════════════════════════════════════
//
// The shipped modules, against hostile input and an in-memory database whose
// $transaction really rolls back:
//
//   1. lib/subRequests/model.js — status, the request parser, the photo and
//      address rules, the allow-list to the sub, accept/reply/decline gates,
//      the reply parser, the reminder, the signup prefill, the cookie.
//   2. The email — every language, no homeowner detail, the area not the
//      street, the three ways to answer.
//   3. The flows — no write into another tenant without that tenant's own
//      action; the homeowner never reaches a sub; linking is idempotent (one
//      Client, one roster link); a linked sub's sent quote lands as an
//      OPTION, never a line; a no-account reply sets an amount on its own
//      pending reply only and reaches the compare only when the GC confirms;
//      a confirmed reply adopted onto a job finds ITS sub, never "any
//      unlinked sub"; one reminder, never two.
//   4. Wiring — what routes and pages must do, matched against source scoped
//      to one brace-matched function, comments stripped.
//
// Then every key guarantee is broken on purpose (the mutation pass) and the
// run must fail for each. Backups are copies (cpSync), never `git checkout`.

import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import * as M from "@/lib/subRequests/model";
import * as S from "@/lib/subRequests/server";
import { buildPriceRequestEmail, PRICE_REQUEST_EMAIL_COPY, PRICE_REQUEST_EMAIL_LANGUAGES, requestLabels } from "@/lib/subRequests/email";
import { SUPPORTED_EMAIL_LANGUAGES } from "@/lib/i18n/emailCopy";
import { compareImportOptions } from "@/lib/quotes/importOptions";
import { importerOptionView } from "@/lib/quotes/importedStatus";
import { syncChangeOrderImport } from "@/lib/subcontractors/sourceLink";
import { leadSourceLabelKey } from "@/lib/leads/sourceLabel";
import { unaskedForScoring } from "@/lib/leads/qualifiers";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const fails = [];
function ok(name, condition, got) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(condition);
}
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), got);
async function rejects(name, fn, pattern) {
  try {
    await fn();
    return ok(name, false, "did not throw");
  } catch (err) {
    return ok(name, pattern ? pattern.test(String(err?.message)) : true, err?.message);
  }
}

// The homeowner — distinctive strings that must never reach a sub.
const HOMEOWNER = { name: "Hortense Q. Homeowner", email: "hortense.private@example.org", phone: "613-555-0199" };
const leaksHomeowner = (v) => /hortense|613-555-0199|private@example/i.test(JSON.stringify(v));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. Pure — lib/subRequests/model.js against hostile input\n");
// ═══════════════════════════════════════════════════════════════════════════

{
  const s = M.recipientStatus;
  eq("nothing stamped → not_sent", s({}), "not_sent");
  eq("sent", s({ sentAt: 1 }), "sent");
  eq("opened", s({ sentAt: 1, openedAt: 1 }), "opened");
  eq("accepted → quoting", s({ sentAt: 1, openedAt: 1, acceptedAt: 1 }), "quoting");
  eq("a sent quote → quoted", s({ acceptedAt: 1, sourceQuoteId: "q" }), "quoted");
  eq("a reply → quoted", s({ repliedAt: 1 }), "quoted");
  eq("declined beats everything", s({ repliedAt: 1, acceptedAt: 1, declinedAt: 1 }), "declined");
  eq("garbage → not_sent", s("x"), "not_sent");
  ok("a reply waits for the GC", M.awaitingConfirmation({ repliedAt: 1, replyAmount: 10 }));
  ok("…until it is in the compare", !M.awaitingConfirmation({ repliedAt: 1, replyAmount: 10, quoteImportId: "i" }));
}

{
  const now = new Date(Date.UTC(2026, 9, 6, 15));
  const base = { subcontractorIds: ["s1"], trade: "Painting", scope: "Two rooms" };
  eq("no subs refused", M.parseRequestInput({ ...base, subcontractorIds: [] }, { now }).error, "no_subs");
  eq("21 subs refused", M.parseRequestInput({ ...base, subcontractorIds: Array.from({ length: 21 }, (_, i) => `s${i}`) }, { now }).error, "too_many_subs");
  eq("hostile ids dropped", M.parseRequestInput({ ...base, subcontractorIds: ["s1", "s1", { $ne: 1 }, "../x", "a b"] }, { now }).data.subcontractorIds, ["s1"]);
  eq("blank trade refused", M.parseRequestInput({ ...base, trade: "   " }, { now }).error, "no_trade");
  eq("blank scope refused", M.parseRequestInput({ ...base, scope: "\u0000 " }, { now }).error, "no_scope");
  eq("Feb 30 refused", M.parseRequestInput({ ...base, wantedBy: "2027-02-30" }, { now }).error, "bad_date");
  eq("yesterday refused", M.parseRequestInput({ ...base, wantedBy: "2026-10-05" }, { now }).error, "date_past");
  eq("today accepted", M.parseRequestInput({ ...base, wantedBy: "2026-10-06" }, { now }).ok, true);
  eq("a date-ish object refused", M.parseRequestInput({ ...base, wantedBy: { toString: () => "2026-12-01" } }, { now }).error, "bad_date");
  const sneaky = M.parseRequestInput({ ...base, amount: 9999, price: 1, markupPercent: 50 }, { now });
  eq("a request carries no figure, whatever the body says", Object.keys(sneaky.data).sort(), ["photoUrls", "scope", "subcontractorIds", "trade", "wantedBy"]);
  eq("array body refused", M.parseRequestInput([base], { now }).error, "bad_body");
}

{
  const onFile = [{ url: "https://res.cloudinary.com/x/a.jpg" }, { url: "https://res.cloudinary.com/x/b.mp4", kind: "video" }];
  eq("only photos on file, deduped, in ticked order", M.pickOnFilePhotos(["https://evil.example/x.jpg", "https://res.cloudinary.com/x/b.mp4", "https://res.cloudinary.com/x/a.jpg", "https://res.cloudinary.com/x/a.jpg"], onFile), [
    { url: "https://res.cloudinary.com/x/b.mp4", kind: "video" },
    { url: "https://res.cloudinary.com/x/a.jpg", kind: "photo" },
  ]);
  eq("the site address wins", M.jobAddressFor({ siteAddress: "12 Oak St, Ottawa, ON", client: { address: "home" } }), "12 Oak St, Ottawa, ON");
  const addr = M.jobAddressFor({ client: { ...HOMEOWNER, address: "214 rue Principale", city: "Gatineau", province: "QC", postalCode: "J8X 1A1" } });
  eq("else the client's address line — and nothing else of them", addr, "214 rue Principale, Gatineau, QC, J8X 1A1");
  ok("…no homeowner name, phone or email in it", !leaksHomeowner(addr));
  eq("area drops the street and postcode", M.addressArea("214 rue Principale, Gatineau, QC J8X 1A1"), "Gatineau, QC");
  eq("a one-line address has no area (no guessing)", M.addressArea("214 rue Principale"), null);
}

{
  const request = {
    trade: "Painting",
    scope: "Two bedrooms",
    siteAddress: "12 Oak St, Ottawa, ON K1A 0B1",
    photos: [{ url: "https://res.cloudinary.com/x/a.jpg" }, { url: "javascript:alert(1)" }],
    wantedBy: new Date(Date.UTC(2026, 10, 1, 12)),
    // Hostile: a row (or a future column) carrying the homeowner.
    clientName: HOMEOWNER.name,
    client: HOMEOWNER,
    quote: { client: HOMEOWNER },
  };
  const gc = { name: "Northline GC", email: "office@northline.example", phone: "819-555-0100", stripeAccountId: "acct_secret", taxRate: 13, currency: "CAD" };
  const v = M.subFacingRequest({ request, gc, recipient: { sentAt: 1, replyAmount: "4250.5", repliedAt: 1 } });
  ok("the sub's view never carries the homeowner", !leaksHomeowner(v), v);
  eq("…its keys are the allow-list", Object.keys(v).sort(), ["address", "area", "gc", "photos", "reply", "scope", "status", "trade", "wantedBy"]);
  eq("…the GC's keys too (no Stripe, no tax)", Object.keys(v.gc).sort(), ["brandColor", "currency", "email", "logoUrl", "name", "phone"]);
  eq("…a non-https photo is dropped", v.photos.length, 1);
  eq("…wanted-by as a calendar day", v.wantedBy, "2026-11-01");
  eq("…their own reply comes back to them", v.reply.amount, 4250.5);
  const msg = M.leadMessageFor(v, requestLabels("fr"));
  ok("the lead message is the allow-list as text", /Métier: Painting/.test(msg) && /Two bedrooms/.test(msg) && !leaksHomeowner(msg), msg);
}

{
  const r = { id: "r1" };
  const m = { companyId: "SUB", userId: "u1" };
  eq("signed out → no_session", M.canAccept({ recipient: r, member: null, gcCompanyId: "GC" }).reason, "no_session");
  eq("support session → read_only", M.canAccept({ recipient: r, member: { companyId: "SUB", userId: null }, gcCompanyId: "GC" }).reason, "read_only");
  eq("impersonation flag → read_only", M.canAccept({ recipient: r, member: { ...m, impersonation: true }, gcCompanyId: "GC" }).reason, "read_only");
  eq("the GC's own staff → own", M.canAccept({ recipient: r, member: { companyId: "GC", userId: "u" }, gcCompanyId: "GC" }).reason, "own");
  eq("declined → declined", M.canAccept({ recipient: { declinedAt: 1 }, member: m, gcCompanyId: "GC" }).reason, "declined");
  eq("linked to another company → refused", M.canAccept({ recipient: { linkedCompanyId: "OTHER" }, member: m, gcCompanyId: "GC" }).reason, "linked_elsewhere");
  eq("the GC's roster row linked elsewhere → refused", M.canAccept({ recipient: r, member: m, gcCompanyId: "GC", rosterLinkedCompanyId: "OTHER" }).reason, "linked_elsewhere");
  eq("same company again → ok, again", M.canAccept({ recipient: { linkedCompanyId: "SUB", acceptedAt: 1 }, member: m, gcCompanyId: "GC" }), { ok: true, again: true });
  eq("reply after decline refused", M.canReply({ declinedAt: 1 }).reason, "declined");
  eq("reply after linking refused", M.canReply({ acceptedAt: 1 }).reason, "linked");
  eq("reply after the GC confirmed refused", M.canReply({ quoteImportId: "i" }).reason, "confirmed");
  eq("decline after a price landed refused", M.canDecline({ quoteImportId: "i" }).reason, "quoted");
}

{
  const opts = { gcCompanyId: "GC1", cloudName: "fq" };
  for (const bad of ["-5", "0", "abc", "1e9", "12.345", "", "NaN", "Infinity", "10000000.01", "1,23,456", "4.250,50", "4 25,50", "1,234 567", null, {}, [1]]) {
    eq(`reply amount ${JSON.stringify(bad)} refused`, M.parseReplyInput({ amount: bad }, opts).error, "bad_amount");
  }
  eq("'$4,250.50' read as 4250.5", M.parseReplyInput({ amount: "$4,250.50" }, opts).data.amount, 4250.5);
  eq("a number is fine", M.parseReplyInput({ amount: 1200 }, opts).data.amount, 1200);
  eq("'4 250,50' (decimal comma) is 4250.5 — not 425,050", M.parseReplyInput({ amount: "4 250,50" }, opts).data.amount, 4250.5);
  eq("'4250,5' is 4250.5", M.parseReplyInput({ amount: "4250,5" }, opts).data.amount, 4250.5);
  eq("'1,234' groups to 1234", M.parseReplyInput({ amount: "1,234" }, opts).data.amount, 1234);
  const own = "https://res.cloudinary.com/fq/raw/upload/v1/fieldquo/companies/GC1/price-replies/q.pdf";
  eq("a file in the GC's reply folder is kept", M.parseReplyInput({ amount: 1, file: { url: own, filename: "q.pdf" } }, opts).data.file, { url: own, filename: "q.pdf" });
  eq("another company's folder refused", M.parseReplyInput({ amount: 1, file: { url: own.replace("GC1", "GC2") } }, opts).error, "bad_file");
  eq("another host refused", M.parseReplyInput({ amount: 1, file: { url: "https://evil.example/fieldquo/companies/GC1/price-replies/q.pdf" } }, opts).error, "bad_file");
  eq("the portal folder refused", M.parseReplyInput({ amount: 1, file: { url: own.replace("price-replies", "portal") } }, opts).error, "bad_file");
  eq("a quote character in the URL refused", M.parseReplyInput({ amount: 1, file: { url: `${own}"onload=x` } }, opts).error, "bad_file");
}

{
  const now = new Date(Date.UTC(2026, 9, 10, 12));
  const sent = new Date(Date.UTC(2026, 9, 6, 12));
  ok("due after 3 days", M.reminderDue({ sentAt: sent }, { days: 3, now }));
  ok("not before", !M.reminderDue({ sentAt: sent }, { days: 5, now }));
  ok("never twice", !M.reminderDue({ sentAt: sent, remindedAt: now }, { days: 3, now }));
  ok("off at 0", !M.reminderDue({ sentAt: sent }, { days: 0, now }));
  ok("not to someone quoting", !M.reminderDue({ sentAt: sent, acceptedAt: sent }, { days: 3, now }));
  ok("not to someone who replied", !M.reminderDue({ sentAt: sent, repliedAt: sent }, { days: 3, now }));
  ok("not to someone who declined", !M.reminderDue({ sentAt: sent, declinedAt: sent }, { days: 3, now }));
  ok("not after the wanted-by date", !M.reminderDue({ sentAt: sent }, { days: 3, now, wantedBy: new Date(Date.UTC(2026, 9, 8, 12)) }));
  ok("not when never sent", !M.reminderDue({}, { days: 3, now }));
  eq("reminder days: 31 / -1 / 1.5 / true / '' refused", [31, -1, 1.5, true, ""].map(M.parseReminderDays), [null, null, null, null, null]);
  eq("reminder days: 0 and '7' accepted", [0, "7"].map(M.parseReminderDays), [0, 7]);
}

{
  const sub = { name: "Sparky Electric", contactName: "Sam  Sparks Jr", email: " Sam@Sparky.CA ", phone: "613-555-0123", trade: "Electrical", notes: "pays late", insuranceExpiresAt: new Date(), companyId: "GC", client: HOMEOWNER };
  const p = M.signupPrefill(sub);
  eq("signup prefill is what the GC entered about THIS sub, and only that", p, { companyName: "Sparky Electric", firstName: "Sam", lastName: "Sparks Jr", email: "sam@sparky.ca", phone: "613-555-0123", trade: "Electrical" });
  ok("…never the GC's notes or the homeowner", !/pays late/.test(JSON.stringify(p)) && !leaksHomeowner(p));
  const typed = { user: { firstName: "Alex", lastName: "", phone: "" }, company: { name: "My Own Co", industry: "" } };
  const groups = [{ options: [{ value: "trades:electrical", tradeKey: "electrical", label: "Electrical" }] }];
  const merged = M.mergeWelcomePrefill(typed, p, { groups });
  eq("…fills blanks only: a typed name and company stay", [merged.user.firstName, merged.company.name, merged.user.phone, merged.company.industry], ["Alex", "My Own Co", "613-555-0123", "trades:electrical"]);
  eq("…a near-miss trade is not guessed", M.industryForTrade("Electric", groups), "");
}

{
  const tok = "A".repeat(43);
  eq("cookie → the request page", M.pendingPriceRequestPath(`x=1; fq_price_request=${tok}`), `/price-request/${tok}`);
  eq("junk in the cookie is not a URL", M.pendingPriceRequestPath("fq_price_request=//evil.example/x"), null);
  eq("no cookie for a junk token", M.priceRequestCookie("../x"), null);
  const c = M.gcClientData({ gc: { id: "GC", name: "Northline", email: " OFFICE@N.CA ", country: "canada" }, subCompanyId: "SUB" });
  eq("the GC as a business client, in the SUB's company", [c.companyId, c.type, c.linkedCompanyId, c.email, c.country], ["SUB", "company", "GC", "office@n.ca", null]);
  eq("gc_request has a source label", leadSourceLabelKey("gc_request"), "app.leads.source.gc_request");
  eq("…and is not scored on a budget nobody asked", unaskedForScoring("gc_request"), ["budget", "timeline"]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. The email — every language, no homeowner, the area not the street\n");
// ═══════════════════════════════════════════════════════════════════════════

{
  eq("the email's languages are the email copy's languages", [...PRICE_REQUEST_EMAIL_LANGUAGES].sort(), [...SUPPORTED_EMAIL_LANGUAGES].sort());
  const keys = Object.keys(PRICE_REQUEST_EMAIL_COPY.en).sort();
  for (const lang of PRICE_REQUEST_EMAIL_LANGUAGES) {
    eq(`${lang}: every sentence`, Object.keys(PRICE_REQUEST_EMAIL_COPY[lang]).sort(), keys);
  }
  const view = M.subFacingRequest({
    request: { trade: "Painting", scope: "Two <b>bedrooms</b>", siteAddress: "12 Oak St, Ottawa, ON K1A 0B1", photos: [{ url: "https://res.cloudinary.com/x/a.jpg" }], wantedBy: "2026-11-01T12:00:00Z", client: HOMEOWNER },
    gc: { name: "Northline GC", brandColor: "#ffeb3b" },
  });
  const urls = { page: "https://app.example/price-request/T", login: "https://app.example/login?next=%2Fprice-request%2FT", signup: "https://app.example/price-request/T/signup", reply: "https://app.example/price-request/T#reply" };
  for (const lang of PRICE_REQUEST_EMAIL_LANGUAGES) {
    const mail = buildPriceRequestEmail({ view, gcCompany: { name: "Northline GC", brandColor: "#ffeb3b" }, subName: "Sam", urls, language: lang });
    const all = mail.subject + mail.html + mail.text;
    ok(`${lang}: no homeowner, no street line, the area, three ways to answer`, !leaksHomeowner(all) && !/12 Oak St/.test(all) && /Ottawa, ON/.test(all) && mail.html.includes(urls.login.replace(/&/g, "&amp;")) && mail.html.includes(urls.signup) && mail.html.includes(urls.reply));
  }
  const en = buildPriceRequestEmail({ view, gcCompany: { name: "Northline GC" }, urls, language: "en", reminder: true });
  ok("the scope is escaped, not rendered", !/<b>bedrooms<\/b>/.test(en.html) && /&lt;b&gt;bedrooms/.test(en.html));
  ok("the reminder says it is one", /^Reminder:/.test(en.subject));
  ok("an unknown language falls back to English", /is asking for your price/.test(buildPriceRequestEmail({ view, gcCompany: {}, urls, language: "xx" }).subject));
}

// ═══════════════════════════════════════════════════════════════════════════
// The in-memory database. Equality, { in }, { not }, OR, relation filters;
// select and include with relations; uniques the schema declares; and a
// $transaction that ROLLS BACK when its function throws.
// ═══════════════════════════════════════════════════════════════════════════

function makeDb() {
  let T = {
    company: [], quote: [], quoteScopeGroup: [], serviceCategory: [], quoteImport: [], job: [], jobPhoto: [],
    changeOrder: [], invoice: [], expense: [], subcontractor: [], jobSubcontractor: [], subcontractorBill: [],
    subPriceRequest: [], subPriceRequestRecipient: [], client: [], leadRequest: [], leadIdentityLink: [],
  };
  let seq = 0;
  const writes = [];
  const id = (p) => `${p}_${++seq}`;
  const REL = {
    quoteImport: {
      sourceCompany: (r) => T.company.find((c) => c.id === r.sourceCompanyId) || null,
      targetCompany: (r) => T.company.find((c) => c.id === r.targetCompanyId) || null,
      targetQuote: (r) => T.quote.find((q) => q.id === r.targetQuoteId) || null,
      sourceQuote: (r) => T.quote.find((q) => q.id === r.sourceQuoteId) || null,
    },
    quote: {
      jobs: (r) => T.job.filter((j) => j.quoteId === r.id).sort((a, b) => a.createdAt - b.createdAt),
      scopeGroups: (r) => T.quoteScopeGroup.filter((g) => g.quoteId === r.id),
      company: (r) => T.company.find((c) => c.id === r.companyId) || null,
      client: (r) => T.client.find((c) => c.id === r.clientId) || null,
      lead: (r) => T.leadRequest.find((l) => l.quoteId === r.id) || null,
    },
    changeOrder: { job: (r) => T.job.find((j) => j.id === r.jobId) || null },
    job: { quote: (r) => T.quote.find((q) => q.id === r.quoteId) || null },
    invoice: { versions: (r) => T.invoice.filter((i) => i.parentInvoiceId === r.id) },
    subPriceRequest: {
      company: (r) => T.company.find((c) => c.id === r.companyId) || null,
      recipients: (r) => T.subPriceRequestRecipient.filter((x) => x.requestId === r.id),
    },
    subPriceRequestRecipient: {
      request: (r) => T.subPriceRequest.find((q) => q.id === r.requestId) || null,
      subcontractor: (r) => T.subcontractor.find((s) => s.id === r.subcontractorId) || null,
    },
  };
  const modelOf = {
    sourceCompany: "company", targetCompany: "company", targetQuote: "quote", sourceQuote: "quote", jobs: "job", scopeGroups: "quoteScopeGroup",
    company: "company", job: "job", quote: "quote", invoice: "invoice", versions: "invoice", client: "client", lead: "leadRequest",
    recipients: "subPriceRequestRecipient", request: "subPriceRequest", subcontractor: "subcontractor",
  };
  const matches = (model, row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((w) => matches(model, row, w));
      if (k === "NOT") return !matches(model, row, v);
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("notIn" in v) return !v.notIn.includes(row[k]);
        if ("not" in v) return (row[k] ?? null) !== (v.not ?? null);
        if ("lte" in v) return row[k] != null && row[k] <= v.lte;
        const rel = REL[model]?.[k];
        if (rel) {
          const got = rel(row);
          return got && !Array.isArray(got) && matches(modelOf[k], got, v);
        }
        throw new Error(`fake db: unsupported filter on ${model}.${k}`);
      }
      return (row[k] ?? null) === (v ?? null);
    });
  const shape = (model, row, { select, include } = {}) => {
    if (!row) return null;
    const out = select ? {} : { ...row };
    const spec = { ...(select || {}), ...(include || {}) };
    for (const [k, v] of Object.entries(spec)) {
      if (!v) continue;
      const rel = REL[model]?.[k];
      if (!rel) {
        if (v === true) out[k] = row[k];
        continue;
      }
      const got = rel(row);
      const sub = v === true ? {} : v;
      if (Array.isArray(got)) {
        let list = got;
        if (sub.where) list = list.filter((x) => matches(modelOf[k], x, sub.where));
        if (sub.take) list = list.slice(0, sub.take);
        out[k] = list.map((x) => shape(modelOf[k], x, sub));
      } else out[k] = shape(modelOf[k], got, sub);
    }
    return out;
  };
  const UNIQUE = {
    quoteImport: (d) => d.sourceQuoteId != null && T.quoteImport.some((r) => r.targetQuoteId === d.targetQuoteId && r.sourceQuoteId === d.sourceQuoteId),
    client: (d) => d.linkedCompanyId != null && T.client.some((r) => r.companyId === d.companyId && r.linkedCompanyId === d.linkedCompanyId),
    subPriceRequestRecipient: (d, self) =>
      T.subPriceRequestRecipient.some(
        (r) => r !== self && ((d.token && r.token === d.token) || (d.quoteImportId && r.quoteImportId === d.quoteImportId) || (d.requestId && r.requestId === d.requestId && r.subcontractorId === d.subcontractorId)),
      ),
  };
  const model = (name) => ({
    findMany: async ({ where = {}, select, include, orderBy, take } = {}) => {
      let rows = T[name].filter((r) => matches(name, r, where));
      if (orderBy?.createdAt) rows = [...rows].sort((a, b) => (orderBy.createdAt === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
      if (take) rows = rows.slice(0, take);
      return rows.map((r) => shape(name, r, { select, include }));
    },
    findFirst: async ({ where = {}, select, include } = {}) => shape(name, T[name].find((r) => matches(name, r, where)), { select, include }),
    findUnique: async ({ where = {}, select, include } = {}) => shape(name, T[name].find((r) => matches(name, r, where)), { select, include }),
    count: async ({ where = {} } = {}) => T[name].filter((r) => matches(name, r, where)).length,
    create: async ({ data, select, include }) => {
      if (UNIQUE[name]?.(data)) throw Object.assign(new Error("unique"), { code: "P2002" });
      const row = { id: id(name), createdAt: new Date(2026, 9, 6, 0, 0, ++seq), ...data };
      if (name === "quoteImport" && row.placement === undefined) row.placement = "line";
      if (name === "changeOrder" && row.status === undefined) row.status = "approved";
      T[name].push(row);
      writes.push({ model: name, op: "create", companyId: row.companyId ?? row.targetCompanyId ?? null });
      return shape(name, row, { select, include });
    },
    update: async ({ where, data, select }) => {
      const row = T[name].find((r) => matches(name, r, where));
      if (!row) throw new Error(`${name}.update: no row`);
      if (UNIQUE[name]?.({ ...row, ...data }, row) && name === "subPriceRequestRecipient") throw Object.assign(new Error("unique"), { code: "P2002" });
      Object.assign(row, data);
      writes.push({ model: name, op: "update", companyId: row.companyId ?? row.targetCompanyId ?? null });
      return shape(name, row, { select });
    },
    updateMany: async ({ where, data }) => {
      const rows = T[name].filter((r) => matches(name, r, where));
      for (const r of rows) {
        Object.assign(r, data);
        writes.push({ model: name, op: "update", companyId: r.companyId ?? r.targetCompanyId ?? null });
      }
      return { count: rows.length };
    },
    delete: async ({ where }) => {
      const i = T[name].findIndex((r) => matches(name, r, where));
      if (i < 0) throw new Error(`${name}.delete: no row`);
      return T[name].splice(i, 1)[0];
    },
    deleteMany: async ({ where }) => {
      const before = T[name].length;
      T[name] = T[name].filter((r) => !matches(name, r, where));
      return { count: before - T[name].length };
    },
    upsert: async ({ where, create, update }) => {
      const key = Object.values(where)[0];
      const row = T[name].find((r) => r.key === key);
      if (row) return Object.assign(row, update);
      const made = { id: id(name), ...create };
      T[name].push(made);
      return made;
    },
  });
  const db = {};
  for (const n of Object.keys(T)) db[n] = model(n);
  db.$queryRaw = async () => [];
  db.$executeRaw = async () => 0;
  let depth = 0;
  db.$transaction = async (fn) => {
    if (depth > 0) return fn(db);
    const snapshot = structuredClone(T);
    depth++;
    try {
      return await fn(db);
    } catch (err) {
      T = snapshot;
      for (const n of Object.keys(T)) db[n] = model(n);
      throw err;
    } finally {
      depth--;
    }
  };
  return { db, writes, get T() { return T; } };
}

function world() {
  const w = makeDb();
  const T = w.T;
  T.company.push(
    { id: "GC", name: "Northline GC", email: "office@northline.example", phone: "819-555-0100", city: "Gatineau", country: "CA", subRequestReminderDays: 3, defaultLanguage: "en" },
    { id: "SUB", name: "Sparky Electric", email: "sam@sparky.example", subRequestReminderDays: 3 },
    { id: "SUB2", name: "Volt Brothers", subRequestReminderDays: 3 },
    { id: "RIVAL", name: "Rival Co", subRequestReminderDays: 3 },
  );
  T.client.push({ id: "home", companyId: "GC", type: "individual", ...HOMEOWNER, address: "12 Oak St", city: "Ottawa", province: "ON", postalCode: "K1A 0B1" });
  T.quote.push({
    id: "gcq", companyId: "GC", clientId: "home", status: "sent", quoteNumber: "Q-1001", siteAddress: null, total: 10000, subtotal: 10000, taxEnabled: false, discount: 0,
    clientPhotos: [{ url: "https://res.cloudinary.com/fq/a.jpg", kind: "photo" }], createdAt: new Date(2026, 9, 1),
  });
  T.subcontractor.push(
    // An UNLINKED sub on the GC's roster that has nothing to do with any
    // request — first in the table, so a "linkedCompanyId: null" lookup
    // would land on it.
    { id: "sAaaUnrelated", companyId: "GC", name: "Aaa Unrelated", email: "u@u.example", linkedCompanyId: null, active: true, createdAt: new Date(2025, 0, 1) },
    { id: "sSparky", companyId: "GC", name: "Sparky Electric", contactName: "Sam Sparks", email: "sam@sparky.example", phone: "613-555-0123", trade: "Electrical", linkedCompanyId: null, active: true, insuranceExpiresAt: null, clearanceExpiresAt: null, createdAt: new Date(2026, 0, 1) },
    { id: "sVolt", companyId: "GC", name: "Volt Brothers", email: "volt@volt.example", trade: "Electrical", linkedCompanyId: null, active: true, createdAt: new Date(2026, 0, 2) },
    { id: "sNoMail", companyId: "GC", name: "No Mail Ltd", email: null, linkedCompanyId: null, active: true, createdAt: new Date(2026, 0, 3) },
    // Another tenant's roster row — never sendable from the GC.
    { id: "sForeign", companyId: "RIVAL", name: "Foreign Sub", email: "f@f.example", linkedCompanyId: null, active: true, createdAt: new Date(2026, 0, 4) },
  );
  return w;
}

const GC_MEMBER = { companyId: "GC", userId: "uGC", id: "mGC" };
const SUB_MEMBER = { companyId: "SUB", userId: "uSub", id: "mSub" };
let mintN = 0;
const mint = () => `tok${String(++mintN).padStart(40, "x")}`;
const createLead = (db) => async (data) => db.leadRequest.create({ data: { ...data, quoteId: null } });
const linkLeadToClient = async (db, { companyId, leadId, clientId }) =>
  db.leadIdentityLink.create({ data: { companyId, leadId, clientId, kind: "client", status: "linked" } });

async function sendRequest(w, ids = ["sSparky", "sVolt"], extra = {}) {
  const input = M.parseRequestInput({ subcontractorIds: ids, trade: "Electrical", scope: "Panel upgrade, 200A", photoUrls: ["https://res.cloudinary.com/fq/a.jpg", "https://evil.example/x.jpg"], ...extra }).data;
  const context = await S.loadRequestContext(w.db, { companyId: "GC", quoteId: "gcq" });
  const photos = M.pickOnFilePhotos(input.photoUrls, context.photosOnFile);
  const out = await S.createPriceRequest(w.db, { member: GC_MEMBER, input, context, photos, siteAddress: M.jobAddressFor(context.quote), mint });
  for (const r of out.recipients) await S.markSent(w.db, { recipientId: r.id, email: "x@y", now: new Date(Date.UTC(2026, 9, 6, 12)) });
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Flows — tenants, the homeowner, linking, the compare, the reply\n");
// ═══════════════════════════════════════════════════════════════════════════

{
  const w = world();
  await rejects("a sub from another tenant cannot be asked (not found)", () => sendRequest(w, ["sSparky", "sForeign"]), /isn't on your list/);
  await rejects("a sub with no email is refused by name", () => sendRequest(w, ["sNoMail"]), /No Mail Ltd/);
  eq("…and neither wrote anything", w.T.subPriceRequest.length + w.T.subPriceRequestRecipient.length, 0);

  const { request, recipients } = await sendRequest(w);
  eq("one request, one recipient per sub", [w.T.subPriceRequest.length, recipients.length], [1, 2]);
  ok("the GC's send wrote only the GC's tenant", w.writes.every((x) => x.companyId === "GC" || x.companyId === null), w.writes);
  ok("the request row holds no homeowner detail", !leaksHomeowner(w.T.subPriceRequest[0]), w.T.subPriceRequest[0]);
  eq("…the job address is the client's address line", request.siteAddress, "12 Oak St, Ottawa, ON, K1A 0B1");
  eq("…an invented photo URL was dropped", request.photos, [{ url: "https://res.cloudinary.com/fq/a.jpg", kind: "photo" }]);
  await rejects("asking the same sub for the same trade again is refused", () => sendRequest(w, ["sSparky"], { trade: " electrical " }), /Already asked/);

  const [rSparky, rVolt] = recipients;
  const before = w.writes.length;
  const loaded = await S.loadRecipientByToken(w.db, rSparky.token);
  ok("the sub's view has no homeowner", !leaksHomeowner(S.viewForRecipient(loaded)));
  eq("a junk token loads nothing", await S.loadRecipientByToken(w.db, "short"), null);
  await S.markOpened(w.db, { recipientId: rSparky.id, now: new Date(Date.UTC(2026, 9, 7)) });
  await S.markOpened(w.db, { recipientId: rSparky.id, now: new Date(Date.UTC(2026, 9, 9)) });
  eq("opened once, the first time", w.T.subPriceRequestRecipient.find((r) => r.id === rSparky.id).openedAt.toISOString(), "2026-10-07T00:00:00.000Z");
  ok("opening wrote nothing outside the recipient row", w.writes.slice(before).every((x) => x.model === "subPriceRequestRecipient"));

  // ── Accept — the SUB's own action ──────────────────────────────────────
  await rejects("the GC's own staff cannot accept", () => S.acceptRequest(w.db, { token: rSparky.token, member: GC_MEMBER, createLead: createLead(w.db), linkLeadToClient }), /own company/);
  await rejects("a support session cannot accept", () => S.acceptRequest(w.db, { token: rSparky.token, member: { companyId: "SUB", userId: null }, createLead: createLead(w.db), linkLeadToClient }), /read-only/);
  eq("…and nothing was written in the sub's tenant", w.writes.filter((x) => x.companyId === "SUB").length, 0);

  const acc = await S.acceptRequest(w.db, { token: rSparky.token, member: SUB_MEMBER, createLead: createLead(w.db), linkLeadToClient, leadLabels: requestLabels("en") });
  const subClients = w.T.client.filter((c) => c.companyId === "SUB");
  eq("accepting made ONE business client for the GC in the sub's company", subClients.map((c) => [c.type, c.linkedCompanyId, c.name]), [["company", "GC", "Northline GC"]]);
  const lead = w.T.leadRequest.find((l) => l.id === acc.leadId);
  eq("…and one lead there, source gc_request", [lead.companyId, lead.source], ["SUB", "gc_request"]);
  ok("…the lead carries no homeowner name, phone or email", !leaksHomeowner(lead), lead);
  eq("…its contact is the GC's business, its address the job's", [lead.name, lead.email, lead.intake?.address], ["Northline GC", "office@northline.example", "12 Oak St, Ottawa, ON, K1A 0B1"]);
  eq("…tied to the GC's client row, so converting quotes the GC", w.T.leadIdentityLink.map((l) => [l.companyId, l.clientId]), [["SUB", subClients[0].id]]);
  const rowS = w.T.subPriceRequestRecipient.find((r) => r.id === rSparky.id);
  eq("…the recipient is linked to the sub", [rowS.linkedCompanyId, rowS.leadId, M.recipientStatus(rowS)], ["SUB", acc.leadId, "quoting"]);
  eq("…and the GC's roster row learned who they are", w.T.subcontractor.find((s) => s.id === "sSparky").linkedCompanyId, "SUB");

  const again = await S.acceptRequest(w.db, { token: rSparky.token, member: SUB_MEMBER, createLead: createLead(w.db), linkLeadToClient });
  eq("accepting again is the same lead, no new rows", [again.leadId, again.again, w.T.leadRequest.length, w.T.client.filter((c) => c.companyId === "SUB").length], [acc.leadId, true, 1, 1]);
  await rejects("a rival company holding the link is refused", () => S.acceptRequest(w.db, { token: rSparky.token, member: { companyId: "RIVAL", userId: "uR" }, createLead: createLead(w.db), linkLeadToClient }), /another FieldQuo account/);
  eq("…and wrote nothing in its tenant", w.writes.filter((x) => x.companyId === "RIVAL").length, 0);

  // A second request from the same GC, accepted by the same sub: still one client.
  const second = await sendRequest(w, ["sSparky"], { trade: "Low voltage" });
  await S.acceptRequest(w.db, { token: second.recipients[0].token, member: SUB_MEMBER, createLead: createLead(w.db), linkLeadToClient });
  eq("a second request from the same GC reuses the one client", w.T.client.filter((c) => c.companyId === "SUB" && c.linkedCompanyId === "GC").length, 1);
  eq("…and the roster still has ONE Sparky row", w.T.subcontractor.filter((s) => s.companyId === "GC" && s.name === "Sparky Electric").length, 1);
  // A unique race: the create loses, the winner is read.
  {
    const w2 = world();
    const real = w2.db.client.findFirst;
    let calls = 0;
    w2.db.client.findFirst = async (a) => (++calls === 1 ? null : real(a));
    w2.T.client.push({ id: "winner", companyId: "SUB", linkedCompanyId: "GC", name: "Northline GC", type: "company" });
    const c = await S.findOrCreateGcClient(w2.db, { gc: { id: "GC", name: "Northline GC" }, subCompanyId: "SUB" });
    eq("a lost unique race reads the winner, no duplicate", [c.id, w2.T.client.filter((x) => x.companyId === "SUB").length], ["winner", 1]);
  }

  // ── The sub sends their quote → an OPTION in the GC's compare ───────────
  w.T.quote.push({ id: "subq", companyId: "SUB", clientId: subClients[0].id, status: "sent", total: 4200, acceptedTotal: null, lineItems: [], quoteNumber: "S-1", createdAt: new Date() });
  w.T.leadRequest.find((l) => l.id === acc.leadId).quoteId = "subq";
  const gcTotal = w.T.quote.find((q) => q.id === "gcq").total;
  const landed = await S.landRequestedQuote(w.db, { quoteId: "subq" });
  const imp = w.T.quoteImport.find((i) => i.sourceQuoteId === "subq");
  eq("the sent quote landed once", landed.landed, 1);
  eq("…as an OPTION at the sub's price, markup 0, naming the roster row", [imp.placement, Number(imp.snapshotAmount), Number(imp.markupPercent), imp.subcontractorId, imp.targetCompanyId, imp.label], ["option", 4200, 0, "sSparky", "GC", "Electrical"]);
  eq("…never a line: the GC's quote and total are untouched", [w.T.quoteScopeGroup.filter((g) => g.quoteId === "gcq").length, w.T.quote.find((q) => q.id === "gcq").total], [0, gcTotal]);
  eq("…and the recipient reads quoted, in the compare", [M.recipientStatus(w.T.subPriceRequestRecipient.find((r) => r.id === rSparky.id)), Boolean(w.T.subPriceRequestRecipient.find((r) => r.id === rSparky.id).quoteImportId)], ["quoted", true]);
  const groups = compareImportOptions({ imports: w.T.quoteImport.map((i) => ({ ...i, sourceCompany: w.T.company.find((c) => c.id === i.sourceCompanyId) })), subsById: { sSparky: w.T.subcontractor.find((s) => s.id === "sSparky") } });
  eq("…the compare shows it, not chosen", [groups[0].options[0].placement, groups[0].chosenId], ["option", null]);
  await S.landRequestedQuote(w.db, { quoteId: "subq" });
  eq("a re-send lands nothing twice", w.T.quoteImport.filter((i) => i.sourceQuoteId === "subq").length, 1);
  // A quote from a lead that is not a request, and one from the wrong company.
  w.T.leadRequest.push({ id: "otherLead", companyId: "SUB", quoteId: "subq2", source: "self_quote" });
  w.T.quote.push({ id: "subq2", companyId: "SUB", status: "sent", total: 10, lineItems: [], createdAt: new Date() });
  eq("an ordinary quote lands nowhere", (await S.landRequestedQuote(w.db, { quoteId: "subq2" })).landed, 0);
  w.T.quote.push({ id: "rivalq", companyId: "RIVAL", status: "sent", total: 10, lineItems: [], createdAt: new Date() });
  w.T.leadRequest.push({ id: "rivalLead", companyId: "RIVAL", quoteId: "rivalq" });
  w.T.subPriceRequestRecipient.find((r) => r.id === rVolt.id).leadId = "rivalLead"; // hostile: a lead id pointing across
  eq("a quote from a company that never accepted lands nowhere", (await S.landRequestedQuote(w.db, { quoteId: "rivalq" })).landed, 0);
  w.T.subPriceRequestRecipient.find((r) => r.id === rVolt.id).leadId = null;

  // ── The no-account reply ────────────────────────────────────────────────
  // A bystander: another sub asked on another request, untouched by anything
  // below except its own token.
  const bystander = (await sendRequest(w, ["sAaaUnrelated"], { trade: "Painting" })).recipients[0];
  const replyBefore = structuredClone(w.T.subPriceRequestRecipient.find((r) => r.id === rSparky.id));
  await rejects("a linked sub cannot use the reply form", () => S.submitReply(w.db, { token: rSparky.token, input: { amount: 1, note: "" } }), /FieldQuo account/);
  eq("…and its row did not move", JSON.stringify(w.T.subPriceRequestRecipient.find((r) => r.id === rSparky.id)), JSON.stringify(replyBefore));
  await S.submitReply(w.db, { token: rVolt.token, input: M.parseReplyInput({ amount: "3,900", note: "Includes permit" }, {}).data });
  const v1 = w.T.subPriceRequestRecipient.find((r) => r.id === rVolt.id);
  eq("the reply lands on its OWN recipient only", [Number(v1.replyAmount), v1.replyNote, w.T.subPriceRequestRecipient.find((r) => r.id === rSparky.id).replyAmount ?? null], [3900, "Includes permit", null]);
  eq("…and nothing reached the compare yet", w.T.quoteImport.filter((i) => i.subcontractorId === "sVolt").length, 0);
  eq("…a bystander's row is untouched", [w.T.subPriceRequestRecipient.find((r) => r.id === bystander.id).replyAmount ?? null, w.T.subPriceRequestRecipient.find((r) => r.id === bystander.id).repliedAt ?? null], [null, null]);
  await S.submitReply(w.db, { token: rVolt.token, input: { amount: 3800, note: "" } });
  eq("they can change it while the GC hasn't confirmed", Number(w.T.subPriceRequestRecipient.find((r) => r.id === rVolt.id).replyAmount), 3800);
  await rejects("another company cannot confirm the GC's reply", () => S.confirmReply(w.db, { member: { companyId: "RIVAL", userId: "u" }, recipientId: rVolt.id }), /wasn't found/);
  const conf = await S.confirmReply(w.db, { member: GC_MEMBER, recipientId: rVolt.id });
  const rImp = w.T.quoteImport.find((i) => i.id === conf.import.id);
  eq("the GC's confirm makes an OPTION at the STORED reply, no source quote", [rImp.placement, Number(rImp.snapshotAmount), rImp.sourceQuoteId, rImp.sourceCompanyId, rImp.subcontractorId, rImp.label], ["option", 3800, null, null, "sVolt", "Electrical"]);
  await rejects("confirming twice is refused", () => S.confirmReply(w.db, { member: GC_MEMBER, recipientId: rVolt.id }), /already in your compare/);
  eq("…no second option", w.T.quoteImport.filter((i) => i.subcontractorId === "sVolt").length, 1);
  await rejects("the reply form cannot move a confirmed figure", () => S.submitReply(w.db, { token: rVolt.token, input: { amount: 1, note: "" } }), /already added/);
  eq("…it is still the confirmed 3800", [Number(w.T.subPriceRequestRecipient.find((r) => r.id === rVolt.id).replyAmount), Number(rImp.snapshotAmount)], [3800, 3800]);
  await rejects("a price in the compare cannot be declined from the link", () => S.declineRequest(w.db, { token: rVolt.token }), /already with them/);

  // The compare and its view name the roster row for a reply.
  const imports = w.T.quoteImport.map((i) => ({ ...i, sourceCompany: w.T.company.find((c) => c.id === i.sourceCompanyId) || null }));
  const subsById = Object.fromEntries(w.T.subcontractor.map((s) => [s.id, s]));
  const opts = compareImportOptions({ imports, subsById })[0].options;
  const replyOpt = opts.find((o) => o.id === rImp.id);
  eq("a confirmed reply sits beside the quote, named from the roster, flagged as a reply, unchosen", [replyOpt.sourceCompanyName, replyOpt.viaReply, replyOpt.placement, replyOpt.credentials.onRoster], ["Volt Brothers", true, "option", true]);
  eq("…the panel's row says the same", importerOptionView(rImp, replyOpt, {}).sourceCompanyName, "Volt Brothers");

  // The panel list: the reply's figure is cost — off without jobCosting.
  const listed = await S.listRequestsForQuote(w.db, { companyId: "GC", quoteId: "gcq", mayCost: false });
  const volt = listed.flatMap((x) => x.recipients).find((r) => r.id === rVolt.id);
  eq("below jobCosting the reply's figure is withheld, said as such", [volt.reply.amount, volt.reply.amountHidden], [undefined, true]);
  eq("…another company's quote lists nothing", (await S.listRequestsForQuote(w.db, { companyId: "RIVAL", quoteId: "gcq" })).length, 0);

  // ── A confirmed reply adopted onto a job finds ITS sub ──────────────────
  w.T.job.push({ id: "job1", companyId: "GC", quoteId: "gcq", createdAt: new Date() });
  w.T.changeOrder.push({ id: "co1", jobId: "job1", status: "approved", quoteImportId: rImp.id, createdAt: new Date(), seq: 1 });
  await syncChangeOrderImport(w.db, { changeOrderId: "co1" });
  const js = w.T.jobSubcontractor.filter((r) => r.quoteImportId === rImp.id);
  eq("an approved change order carrying a reply puts THAT sub on the job — never 'any unlinked sub'", js.map((r) => r.subcontractorId), ["sVolt"]);
  eq("…and creates no roster row", w.T.subcontractor.filter((s) => s.companyId === "GC").length, 4);

  // ── Decline ─────────────────────────────────────────────────────────────
  const third = await sendRequest(w, ["sVolt"], { trade: "Roofing" });
  await S.declineRequest(w.db, { token: third.recipients[0].token, reason: M.parseDeclineInput({ reason: "Booked solid\u0000 until May" }).reason });
  const d = w.T.subPriceRequestRecipient.find((r) => r.id === third.recipients[0].id);
  eq("a decline records the cleaned reason", [M.recipientStatus(d), d.declineReason], ["declined", "Booked solid  until May"]);
  await rejects("…and the reply form is closed after it", () => S.submitReply(w.db, { token: d.token, input: { amount: 5, note: "" } }), /declined/);

  // ── One reminder ────────────────────────────────────────────────────────
  const fourth = await sendRequest(w, ["sSparky"], { trade: "Plumbing" });
  const sentLog = [];
  const run = (now, okSend = true) => S.runPriceRequestReminders(w.db, { now, send: async (id) => (sentLog.push(id), { ok: okSend }) });
  await run(new Date(Date.UTC(2026, 9, 7)));
  eq("no reminder before the delay", sentLog.length, 0);
  await run(new Date(Date.UTC(2026, 9, 10)), false);
  eq("a failed reminder is released for tomorrow", w.T.subPriceRequestRecipient.find((r) => r.id === fourth.recipients[0].id).remindedAt ?? null, null);
  sentLog.length = 0;
  await run(new Date(Date.UTC(2026, 9, 10)));
  await run(new Date(Date.UTC(2026, 9, 12)));
  eq("one reminder each, only to the subs who haven't answered — never two", [...sentLog].sort(), [bystander.id, fourth.recipients[0].id].sort());
  w.T.company.find((c) => c.id === "GC").subRequestReminderDays = 0;
  const fifth = await sendRequest(w, ["sVolt"], { trade: "Drywall" });
  sentLog.length = 0;
  await run(new Date(Date.UTC(2026, 9, 20)));
  ok("reminders off (0) sends none", !sentLog.includes(fifth.recipients[0].id), sentLog);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Wiring — what the routes and pages must do\n");
// ═══════════════════════════════════════════════════════════════════════════

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}
function fnBody(file, name) {
  const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
  const start = src.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) return null;
  const open = src.indexOf("{", src.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}
{
  const confirm = fnBody("app/api/price-requests/recipients/[id]/confirm/route.js", "POST");
  ok("'Add to compare' reads no request body — no amount can arrive", confirm && !/request\.json\(|request\.formData\(|request\.text\(/.test(confirm));
  ok("…and asks quotes edit + showPricing", confirm && /requireLevel\(full,\s*"quotes",\s*"view_create_edit"/.test(confirm) && /requireToggle\(full,\s*"showPricing"/.test(confirm));
  const post = fnBody("app/api/price-requests/route.js", "POST");
  ok("sending refuses a read-only session and asks the roster's write gate", post && /!member\.userId/.test(post) && /gate\(member,\s*\{\s*write:\s*true\s*\}\)/.test(post));
  ok("…stamps sent only through the sender (after the provider accepted)", post && /sendPriceRequestEmail\(/.test(post) && !/sentAt/.test(post));
  const accept = fnBody("app/api/price-requests/received/[token]/accept/route.js", "POST");
  ok("accepting asks 'requests' create in the SUB's company and refuses a support session", accept && /levelOrRefusal\(member,\s*"requests",\s*"view_create_edit"/.test(accept) && /!member\.userId/.test(accept));
  const reply = fnBody("app/api/public/price-request/[token]/reply/route.js", "POST");
  ok("the reply route checks the file against the GC's own folder", reply && /parseReplyInput\(body,\s*\{\s*gcCompanyId:\s*r\.request\.companyId/.test(reply));
  const sent = fnBody("lib/quotes/quoteLifecycle.js", "onQuoteSent");
  ok("every send door lands a requested quote (onQuoteSent → landRequestedQuote)", sent && /landRequestedQuote\(/.test(sent));
  const land = fnBody("lib/subRequests/server.js", "landRequestedQuote");
  ok("…as an option, through the shared import writer", land && /asOption:\s*true/.test(land) && /performImport\(/.test(land));
  const cron = fnBody("app/api/cron/follow-ups/route.js", "GET");
  ok("the daily cron runs the reminder pass", cron && /runPriceRequestReminders\(/.test(cron));
  const welcome = readFileSync(join(ROOT, "app/welcome/[step]/page.js"), "utf8");
  ok("the welcome questions open prefilled from the request (blanks only)", /mergeWelcomePrefill\(/.test(welcome) && /prefillForToken\(/.test(welcome));
  const after = fnBody("app/welcome/WelcomeFlow.js", "afterSetupUrl");
  ok("a finished signup returns to the request", after && /pendingPriceRequestPath\(/.test(after));
  const qp = readFileSync(join(ROOT, "app/app/quotes/[id]/page.js"), "utf8");
  ok("the quote page mounts the panel", /<PriceRequestsPanel[\s\S]{0,40}quoteId=\{id\}/.test(qp));
  const jp = readFileSync(join(ROOT, "app/app/jobs/[id]/JobDetail.js"), "utf8");
  ok("the job page mounts it for a job with a quote", /job\.quoteId && <PriceRequestsPanel jobId=\{job\.id\}/.test(jp));
  const conv = fnBody("lib/leads/convertLead.js", "convertLeadToQuote");
  ok("converting a gc_request lead quotes the job address as the site", conv && /GC_REQUEST_LEAD_SOURCE/.test(conv) && /siteAddress/.test(conv));
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  ok("this check runs in check:all", /check:sub-price-requests/.test(pkg.scripts["check:all"] || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Mutation pass — every guarantee above must be load-bearing
// ═══════════════════════════════════════════════════════════════════════════

const MUTATING = !process.argv.includes("--no-mutate");
if (!MUTATING) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

console.log("\n5. Mutation pass — break each guarantee, confirm it is caught\n");

const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));

const MUTATIONS = [
  ["lib/subRequests/model.js", "the sub's view spreads the request row (homeowner leaks)", (s) => s.replace("  return {\n    trade: cleanLine(request?.trade, LIMITS.trade),", "  return {\n    ...request,\n    trade: cleanLine(request?.trade, LIMITS.trade),")],
  ["lib/subRequests/model.js", "accept ignores a link to another company", (s) => s.replace('if (bound && bound !== member.companyId) return { ok: false, reason: "linked_elsewhere" };', "")],
  ["lib/subRequests/model.js", "the GC can accept its own request", (s) => s.replace('if (member.companyId === gcCompanyId) return { ok: false, reason: "own" };', "")],
  ["lib/subRequests/model.js", "a support session can accept", (s) => s.replace('if (!member.userId || member.impersonation) return { ok: false, reason: "read_only" };', "")],
  ["lib/subRequests/model.js", "the reply form can move a confirmed figure", (s) => s.replace('if (recipient.quoteImportId) return { ok: false, reason: "confirmed" };', "")],
  ["lib/subRequests/model.js", "a reply file from any folder is accepted", (s) => s.replace("if (!url.includes(`/${replyUploadFolder(gcCompanyId)}/`)) return null;", "")],
  ["lib/subRequests/model.js", "a negative or absurd reply amount passes", (s) => s.replace("if (!(amount > 0) || amount > LIMITS.amount) return { ok: false, error: \"bad_amount\" };", "")],
  ["lib/subRequests/model.js", "signup prefill hands over everything on the roster row", (s) => s.replace("  return {\n    companyName: cleanLine(s.name, 120),", "  return {\n    ...s,\n    companyName: cleanLine(s.name, 120),")],
  ["lib/subRequests/model.js", "a second reminder goes out", (s) => s.replace("if (!recipient || !recipient.sentAt || recipient.remindedAt) return false;", "if (!recipient || !recipient.sentAt) return false;")],
  ["lib/subRequests/model.js", "an invented photo URL is carried", (s) => s.replace("if (seen.has(u) || !byUrl.has(u)) continue;\n    seen.add(u);\n    out.push(byUrl.get(u));", "if (seen.has(u)) continue;\n    seen.add(u);\n    out.push(byUrl.get(u) || { url: u, kind: \"photo\" });")],
  ["lib/subRequests/server.js", "a confirmed reply goes straight onto the quote as a line", (s) => s.replace('        targetLineId: NO_LINE,\n        placement: "option",', '        targetLineId: NO_LINE,\n        placement: "line",')],
  ["lib/subRequests/server.js", "confirming twice makes two options", (s) => s.replace("if (r.quoteImportId) throw new RequestError(\"That price is already in your compare.\", 409);", "").replace("if (claimed.count !== 1) throw new RequestError(\"That price is already in your compare.\", 409);", "")],
  ["lib/subRequests/server.js", "a linked sub's quote is put on the GC's quote (not an option)", (s) => s.replace("            asOption: true,\n            subcontractorId: r.subcontractorId,", "            asOption: false,\n            subcontractorId: r.subcontractorId,")],
  ["lib/subRequests/server.js", "every accept makes a new client for the GC", (s) => s.replace("  const existing = await db.client.findFirst({ where: { companyId: subCompanyId, linkedCompanyId: gc.id }, select });\n  if (existing) return existing;", "")],
  ["lib/subRequests/server.js", "a sub can be asked from another tenant's roster", (s) => s.replace("where: { companyId: member.companyId, id: { in: input.subcontractorIds }, active: true },", "where: { id: { in: input.subcontractorIds }, active: true },")],
  ["lib/subRequests/server.js", "a reply-form write lands on every recipient", (s) => s.replace("where: { id: r.id, declinedAt: null, acceptedAt: null, sourceQuoteId: null, quoteImportId: null },", "where: { declinedAt: null, acceptedAt: null, sourceQuoteId: null, quoteImportId: null },")],
  ["lib/subRequests/server.js", "the reply figure is shown without jobCosting", (s) => s.replace("...(mayCost ? { amount: x.replyAmount == null ? null : Number(x.replyAmount) } : { amountHidden: true }),", "amount: Number(x.replyAmount),")],
  ["lib/subcontractors/sourceLink.js", "adoption ignores the named roster row (matches 'any unlinked sub')", (s) => s.replace("    let sub = imp.subcontractorId\n      ? await tx.subcontractor.findFirst({\n          where: { id: imp.subcontractorId, companyId },\n          select: ROSTER_FILL_SELECT,\n        })\n      : null;\n    if (!sub && imp.sourceCompanyId) {", "    let sub = null;\n    if (!sub) {")],
  ["lib/quotes/importOptions.js", "the compare loses a reply's sub (no name, no paperwork)", (s) => s.replace("const named = imp.subcontractorId ? subsById?.[imp.subcontractorId] || null : null;", "const named = null;")],
  ["lib/subRequests/email.js", "the email prints the full job address", (s) => s.replace("view.area ? [c.area, view.area] : null,", "view.address ? [c.area, view.address] : null,")],
];

const backupDir = mkdtempSync(join(tmpdir(), "check-sub-price-requests-"));
const files = [...new Set(MUTATIONS.map(([f]) => f))];
const ORIGINALS = {};
for (const f of files) {
  ORIGINALS[f] = readFileSync(join(ROOT, f), "utf8");
  cpSync(join(ROOT, f), join(backupDir, f.replace(/\//g, "__")));
}
const restore = (f) => cpSync(join(backupDir, f.replace(/\//g, "__")), join(ROOT, f));

let caught = 0;
const escaped = [];
try {
  for (const [file, label, mutate] of MUTATIONS) {
    const mutated = mutate(ORIGINALS[file]);
    if (mutated === ORIGINALS[file]) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(join(ROOT, file), mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], { stdio: ["ignore", "pipe", "pipe"] });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught, which is the point */
    }
    restore(file);
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  for (const f of files) restore(f);
  rmSync(backupDir, { recursive: true, force: true });
}
for (const f of files) ok(`${f} restored byte-for-byte`, readFileSync(join(ROOT, f), "utf8") === ORIGINALS[f]);
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions — a GC's subs price the job, and nothing crosses a tenant on someone else's say-so`,
);
process.exit(fails.length ? 1 : 0);
