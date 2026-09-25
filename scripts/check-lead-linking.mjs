// scripts/check-lead-linking.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-lead-linking.mjs
//
// The owner's report of 2026-09-24: "I moved to contacted but now not able to
// move back to won… leads should be able to see the jobs, invoice, quotes
// linked to it." Four claims, each EXECUTED:
//
//   1. The Won rule (lib/leads/pipeline.js wonCheck / canSetLeadStatus)
//      against hostile input: nothing linked, a declined quote (even one with
//      work on it), a sent quote, an approved one, counts that are strings or
//      garbage, a bare quoteId with no evidence.
//   2. POST/DELETE /api/leads/[id]/quote-link, run for real against a
//      scripted database: another company's quote id is 404 and writes
//      nothing; markWon moves the lead only when the rule agrees; a quote held
//      by another lead is 409; replacing needs `replace` and never on a Won
//      lead; unlinking a Won lead is refused; the permission gates hold.
//   3. GET /api/leads/[id]/documents: no linked docs is an honest empty, each
//      section answers to its own dial (restricted, not empty), and money is
//      neither selected nor returned without the pricing toggle.
//   4. The candidate ranking and the lead→client match, against junk.
//
// Stubs "@/lib/db", "@/lib/currentMember" and "next/server" the same way
// check-leads-drag.mjs does, so the real handlers run.

import { register } from "node:module";

import {
  wonCheck,
  canSetLeadStatus,
  quoteEvidence,
} from "@/lib/leads/pipeline";
import {
  rankQuoteCandidates,
  leadClientMatch,
  cleanQuoteSearch,
  shapeLinkedInvoice,
  shapeLinkedQuote,
} from "@/lib/leads/linkedDocuments";

let checks = 0;
let failures = 0;
function ok(name, pass, detail) {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${!pass && detail !== undefined ? `  — ${JSON.stringify(detail)}` : ""}`);
}
function section(s) {
  console.log(`\n${s}\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. The Won rule, executed against hostile input");
// ═══════════════════════════════════════════════════════════════════════════

const q = (status, extra = {}) => ({ id: "q_1", quoteNumber: "Q-0012", status, ...extra });

ok("no lead at all → no_quote", wonCheck(null).code === "no_quote");
ok("empty lead → no_quote", wonCheck({}).code === "no_quote");
ok("quote: null → no_quote", wonCheck({ quote: null, quoteId: null }).code === "no_quote");
ok("quote with an empty id → no_quote (an empty string is not a link)", wonCheck({ quote: { id: "" } }).code === "no_quote");
ok("a bare quoteId with no evidence → quote_unverified, not allowed and not 'nothing linked'",
  wonCheck({ quoteId: "q_1" }).code === "quote_unverified");
ok("draft quote → quote_not_approved", wonCheck({ quote: q("draft") }).code === "quote_not_approved");
ok("sent quote → quote_not_approved", wonCheck({ quote: q("sent") }).code === "quote_not_approved");
ok("…and the sentence names the quote", wonCheck({ quote: q("sent") }).reason.includes("Q-0012"));
ok("…and carries the number for the translated sentence", wonCheck({ quote: q("sent") }).quoteNumber === "Q-0012");
ok("declined quote → quote_declined", wonCheck({ quote: q("declined") }).code === "quote_declined");
ok("declined quote WITH a job on it is still refused — declined is the more specific fact",
  wonCheck({ quote: q("declined", { _count: { jobs: 2, invoices: 1 } }) }).ok === false);
ok("accepted quote → allowed, basis accepted", wonCheck({ quote: q("accepted") }).ok === true &&
  wonCheck({ quote: q("accepted") }).basis === "accepted");
ok("sent quote with a live job → allowed, basis work",
  wonCheck({ quote: q("sent", { _count: { jobs: 1, invoices: 0 } }) }).basis === "work");
ok("sent quote with an invoice → allowed",
  wonCheck({ quote: q("sent", { _count: { jobs: 0, invoices: 1 } }) }).ok === true);
ok("sent quote whose job count is 0 (cancelled/archived jobs are filtered in the select) → refused",
  wonCheck({ quote: q("sent", { _count: { jobs: 0, invoices: 0 } }) }).ok === false);
ok("_count values that are garbage strings are not work",
  wonCheck({ quote: q("draft", { _count: { jobs: "lots", invoices: "NaN" } }) }).ok === false);
ok("_count as a string is not work", wonCheck({ quote: q("draft", { _count: "3" }) }).ok === false);
ok("hasWork: 'true' (a string, not the boolean) is not work", wonCheck({ quote: q("draft", { hasWork: "true" }) }).ok === false);
ok("an unknown quote status with no work → refused", wonCheck({ quote: q("approved_by_phone") }).ok === false);
ok("quoteEvidence folds _count into hasWork and drops _count",
  (() => {
    const e = quoteEvidence(q("sent", { _count: { jobs: 1, invoices: 0 } }));
    return e.hasWork === true && !("_count" in e) && e.id === "q_1";
  })());
ok("quoteEvidence is idempotent", quoteEvidence(quoteEvidence(q("sent", { _count: { jobs: 1 } }))).hasWork === true);
ok("quoteEvidence(null) / (no id) → null", quoteEvidence(null) === null && quoteEvidence({ status: "accepted" }) === null);

ok("canSetLeadStatus(…, 'converted') returns the Won code on refusal",
  canSetLeadStatus({ quote: q("declined") }, "converted").code === "quote_declined");
ok("canSetLeadStatus(…, 'converted') allows an approved quote", canSetLeadStatus({ quote: q("accepted") }, "converted").ok === true);
ok("the Won rule does not touch other statuses — Contacted with a declined quote is fine",
  canSetLeadStatus({ quote: q("declined") }, "contacted").ok === true);
ok("…nor Lost (with a reason)", canSetLeadStatus({ quote: q("accepted") }, "lost", { lostReason: "other" }).ok === true);
ok("…and an invalid status is still refused first", canSetLeadStatus({ quote: q("accepted") }, "won").ok === false);

// ═══════════════════════════════════════════════════════════════════════════
section("2. /api/leads/[id]/quote-link, executed against a scripted database");
// ═══════════════════════════════════════════════════════════════════════════

const COMPANY = "co_1";
const OTHER = "co_2";

function matches(row, where = {}) {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (v && typeof v === "object") continue; // relation / operator filters: the handler's own tenant keys are scalars
    if (row[k] !== v) return false;
  }
  return true;
}

function makeDb() {
  const writes = [];
  const R = () => globalThis.__FQ_ROWS;
  const withQuoteEvidence = (lead) => {
    if (!lead) return null;
    const quote = lead.quoteId ? R().quote.find((x) => x.id === lead.quoteId) || null : null;
    return { ...lead, quote: quote ? { ...quote } : null };
  };
  const db = {
    member: {
      async findUnique({ where }) {
        return R().member.find((m) => m.id === where.id) || null;
      },
    },
    leadRequest: {
      async findFirst({ where }) {
        return withQuoteEvidence(R().leadRequest.find((l) => matches(l, where)) || null);
      },
      async update({ where, data }) {
        const row = R().leadRequest.find((l) => l.id === where.id);
        writes.push({ model: "leadRequest", where, data });
        Object.assign(row, data);
        return { id: row.id, status: row.status, quoteId: row.quoteId, lostReason: row.lostReason ?? null };
      },
    },
    quote: {
      async findFirst({ where, select }) {
        const row = R().quote.find((x) => matches(x, where));
        if (!row) return null;
        const holder = R().leadRequest.find((l) => l.quoteId === row.id) || null;
        const out = { ...row };
        if (select?.lead) out.lead = holder ? { id: holder.id } : null;
        // Money only when the handler asked for it — the assertion in section
        // 3 is that it doesn't ask without the toggle.
        if (!select?.total) delete out.total;
        if (!select?.acceptedTotal) delete out.acceptedTotal;
        globalThis.__FQ_LAST_QUOTE_SELECT = select;
        return out;
      },
      async findMany() {
        return [];
      },
    },
    job: {
      async findMany({ where }) {
        globalThis.__FQ_LAST_JOB_WHERE = where;
        return R().job.filter((j) => j.quoteId === where.quoteId && j.companyId === where.companyId);
      },
    },
    invoice: {
      async findMany({ where }) {
        return R().invoice.filter((i) => i.quoteId === where.quoteId && i.companyId === where.companyId);
      },
    },
    user: { async findUnique() { return { name: "Tester" }; } },
    activityLog: {
      async create({ data }) {
        writes.push({ model: "activityLog", data });
        return data;
      },
    },
  };
  return { db, writes };
}

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = async () => globalThis.__FQ_SESSION;" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const linkRoute = await import("@/app/api/leads/[id]/quote-link/route.js");
const docsRoute = await import("@/app/api/leads/[id]/documents/route.js");

let current;
function reset() {
  current = makeDb();
  globalThis.__FQ_DB = current.db;
  globalThis.__FQ_ROWS = {
    member: [
      { id: "m_owner", userId: "u_owner", role: "owner", companyId: COMPANY, permissions: null },
      { id: "m_edit", userId: "u_edit", role: "employee", companyId: COMPANY,
        permissions: { requests: "view_create_edit", quotes: "view_only", jobs: "view_only", invoices: "view_only", showPricing: true } },
      { id: "m_view", userId: "u_view", role: "employee", companyId: COMPANY,
        permissions: { requests: "view_only", quotes: "view_only" } },
      { id: "m_noquotes", userId: "u_nq", role: "employee", companyId: COMPANY,
        permissions: { requests: "view_create_edit", quotes: "none" } },
      { id: "m_nomoney", userId: "u_nm", role: "employee", companyId: COMPANY,
        permissions: { requests: "view_only", quotes: "view_only", jobs: "view_only", invoices: "none", showPricing: false } },
    ],
    leadRequest: [
      { id: "lead_bare", companyId: COMPANY, name: "Ana", status: "contacted", quoteId: null, lostReason: null },
      { id: "lead_won", companyId: COMPANY, name: "Won Lead", status: "converted", quoteId: "q_acc2", lostReason: null },
      { id: "lead_sent", companyId: COMPANY, name: "Sent Lead", status: "contacted", quoteId: "q_sent", lostReason: null },
      { id: "lead_holder", companyId: COMPANY, name: "Holder", status: "new", quoteId: "q_held", lostReason: null },
      { id: "lead_foreign", companyId: OTHER, name: "Foreign", status: "new", quoteId: null, lostReason: null },
    ],
    quote: [
      { id: "q_acc", companyId: COMPANY, quoteNumber: "Q-1", status: "accepted", total: 5000, acceptedTotal: 5200, client: { id: "c1", name: "Ana" }, _count: { jobs: 1, invoices: 1 } },
      { id: "q_acc2", companyId: COMPANY, quoteNumber: "Q-2", status: "accepted", total: 100, client: { id: "c2", name: "Bo" }, _count: { jobs: 0, invoices: 0 } },
      { id: "q_dec", companyId: COMPANY, quoteNumber: "Q-3", status: "declined", total: 900, client: { id: "c1", name: "Ana" }, _count: { jobs: 0, invoices: 0 } },
      { id: "q_sent", companyId: COMPANY, quoteNumber: "Q-4", status: "sent", total: 700, client: { id: "c3", name: "Cy" }, _count: { jobs: 0, invoices: 0 } },
      { id: "q_held", companyId: COMPANY, quoteNumber: "Q-5", status: "accepted", total: 1, client: { id: "c4", name: "Di" }, _count: { jobs: 0, invoices: 0 } },
      { id: "q_foreign", companyId: OTHER, quoteNumber: "X-1", status: "accepted", total: 99999, client: { id: "cx", name: "Stranger" }, _count: { jobs: 1, invoices: 1 } },
    ],
    job: [
      { id: "j1", companyId: COMPANY, quoteId: "q_acc", title: "Kitchen repaint", status: "scheduled", startDate: null },
    ],
    invoice: [
      { id: "i1", companyId: COMPANY, quoteId: "q_acc", invoiceNumber: "INV-1", status: "sent", total: 5200, amountDue: 2600, versions: [] },
    ],
  };
}
const as = (id) => { globalThis.__FQ_SESSION = globalThis.__FQ_ROWS.member.find((m) => m.id === id); };
const leadRow = (id) => globalThis.__FQ_ROWS.leadRequest.find((l) => l.id === id);
const leadWrites = () => current.writes.filter((w) => w.model === "leadRequest");
const req = (body, url = "http://x/api") => ({ json: async () => body, url });
const ctx = (id) => ({ params: Promise.resolve({ id }) });

// Another company's quote id → 404, nothing written, nothing confirmed.
reset(); as("m_edit");
let res = await linkRoute.POST(req({ quoteId: "q_foreign" }), ctx("lead_bare"));
ok("another company's quote id → 404", res.status === 404, res);
ok("…and nothing was written", leadWrites().length === 0, current.writes);
ok("…and the refusal does not echo the foreign quote's number", !JSON.stringify(res.body).includes("X-1"));

reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_acc" }), ctx("lead_foreign"));
ok("a lead in another company → 404 (tenant checked before anything)", res.status === 404 && leadWrites().length === 0, res);

reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "" }), ctx("lead_bare"));
ok("empty quoteId → 400", res.status === 400);
res = await linkRoute.POST(req({ quoteId: { $ne: null } }), ctx("lead_bare"));
ok("an object for quoteId → 400, not passed into a where", res.status === 400);
res = await linkRoute.POST({ json: async () => { throw new Error("bad json"); } }, ctx("lead_bare"));
ok("unparseable body → 400", res.status === 400);

// Permission gates.
reset(); as("m_view");
res = await linkRoute.POST(req({ quoteId: "q_acc" }), ctx("lead_bare"));
ok("requests:view_only cannot link (403)", res.status === 403 && leadWrites().length === 0, res);
reset(); as("m_noquotes");
res = await linkRoute.POST(req({ quoteId: "q_acc" }), ctx("lead_bare"));
ok("quotes:none cannot link even with requests edit (403)", res.status === 403 && leadWrites().length === 0, res);
reset(); as("m_noquotes");
res = await linkRoute.GET(req(null, "http://x/api?q=Q"), ctx("lead_bare"));
ok("quotes:none cannot search quotes (403)", res.status === 403, res);

// Plain link — no status change.
reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_dec" }), ctx("lead_bare"));
ok("linking a declined quote without markWon links it (200)", res.status === 200 && leadRow("lead_bare").quoteId === "q_dec", res);
ok("…and leaves the status alone", leadRow("lead_bare").status === "contacted");
ok("…and reports the Won verdict (declined)", res.body.won?.code === "quote_declined", res.body);
ok("…and logs the link", current.writes.some((w) => w.model === "activityLog" && w.data.action === "lead.quote_linked"));

// "Link the quote that won it" with a declined quote: linked, NOT won.
reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_dec", markWon: true }), ctx("lead_bare"));
ok("markWon + declined quote → linked but NOT Won", res.status === 200 && leadRow("lead_bare").status === "contacted" && res.body.markedWon === false, res.body);
ok("…with the declined reason for the drawer", res.body.won?.code === "quote_declined");

// …with an approved quote: linked AND Won, one write.
reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_acc", markWon: true }), ctx("lead_bare"));
ok("markWon + approved quote → Won", res.status === 200 && leadRow("lead_bare").status === "converted" && res.body.markedWon === true, res.body);
ok("…in ONE lead write carrying both the link and the status",
  leadWrites().length === 1 && leadWrites()[0].data.quoteId === "q_acc" && leadWrites()[0].data.status === "converted", leadWrites());
ok("…and the response carries the quote evidence for the board (hasWork)", res.body.lead?.quote?.hasWork === true, res.body);

// markWon: "true" (a string) is not a request to move.
reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_acc", markWon: "true" }), ctx("lead_bare"));
ok("markWon as the STRING 'true' does not move the lead", leadRow("lead_bare").status === "contacted", leadRow("lead_bare"));

// A quote already held by another lead.
reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_held" }), ctx("lead_bare"));
ok("a quote linked to another lead → 409 quote_taken", res.status === 409 && res.body.code === "quote_taken" && leadWrites().length === 0, res);

// Replacing.
reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_acc" }), ctx("lead_sent"));
ok("a lead that already has a different quote → 409 lead_has_quote without replace", res.status === 409 && res.body.code === "lead_has_quote", res);
reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_acc", replace: true, markWon: true }), ctx("lead_sent"));
ok("…replace + markWon swaps to the approved quote and moves to Won", res.status === 200 && leadRow("lead_sent").quoteId === "q_acc" && leadRow("lead_sent").status === "converted", res.body);
ok("…and the log remembers what it replaced",
  current.writes.some((w) => w.model === "activityLog" && w.data.metadata?.replacedQuoteId === "q_sent"));
reset(); as("m_edit");
res = await linkRoute.POST(req({ quoteId: "q_acc", replace: true }), ctx("lead_won"));
ok("replacing the quote under a WON lead → 409", res.status === 409 && res.body.code === "unlink_won" && leadWrites().length === 0, res);

// Re-linking the same quote is idempotent (and markWon then works — the owner's "move back").
reset(); as("m_edit");
leadRow("lead_won").status = "contacted";
res = await linkRoute.POST(req({ quoteId: "q_acc2", markWon: true }), ctx("lead_won"));
ok("the owner's case: Won → Contacted → back to Won through its own approved quote",
  res.status === 200 && leadRow("lead_won").status === "converted", res.body);

// Unlink.
reset(); as("m_edit");
res = await linkRoute.DELETE(req(null), ctx("lead_won"));
ok("unlinking a Won lead → 409, nothing written", res.status === 409 && res.body.code === "unlink_won" && leadWrites().length === 0, res);
reset(); as("m_edit");
res = await linkRoute.DELETE(req(null), ctx("lead_sent"));
ok("unlinking a Contacted lead clears only the pointer", res.status === 200 && leadRow("lead_sent").quoteId === null && leadRow("lead_sent").status === "contacted", res);
ok("…the write touches quoteId and nothing else", JSON.stringify(leadWrites()[0]?.data) === JSON.stringify({ quoteId: null }), leadWrites());
reset(); as("m_view");
res = await linkRoute.DELETE(req(null), ctx("lead_sent"));
ok("requests:view_only cannot unlink (403)", res.status === 403 && leadWrites().length === 0, res);
reset(); as("m_edit");
res = await linkRoute.DELETE(req(null), ctx("lead_foreign"));
ok("unlinking another company's lead → 404", res.status === 404);

// ═══════════════════════════════════════════════════════════════════════════
section("3. GET /api/leads/[id]/documents — each section on its own dial");
// ═══════════════════════════════════════════════════════════════════════════

reset(); as("m_edit");
res = await docsRoute.GET(req(null), ctx("lead_bare"));
ok("a lead with no linked docs → quote null, empty lists, Won says no_quote",
  res.status === 200 && res.body.quote === null && Array.isArray(res.body.jobs) && res.body.jobs.length === 0 &&
    Array.isArray(res.body.invoices) && res.body.invoices.length === 0 && res.body.won?.code === "no_quote", res.body);

reset(); as("m_edit");
leadRow("lead_bare").quoteId = "q_acc";
res = await docsRoute.GET(req(null), ctx("lead_bare"));
ok("linked approved quote → the quote, its job, its invoice", res.body.quote?.id === "q_acc" && res.body.jobs.length === 1 && res.body.invoices.length === 1, res.body);
ok("…with money for a member whose pricing toggle is on", res.body.quote.total === 5200 && res.body.invoices[0].amountDue === 2600, res.body);
ok("…and Won is allowed", res.body.won?.ok === true);

reset(); as("m_nomoney");
leadRow("lead_bare").quoteId = "q_acc";
res = await docsRoute.GET(req(null), ctx("lead_bare"));
ok("no pricing toggle → the quote has no total and says pricingHidden", res.body.quote && !("total" in res.body.quote) && res.body.quote.pricingHidden === true, res.body.quote);
ok("…and the money columns were not even SELECTED", !globalThis.__FQ_LAST_QUOTE_SELECT?.total && !globalThis.__FQ_LAST_QUOTE_SELECT?.acceptedTotal, globalThis.__FQ_LAST_QUOTE_SELECT);
ok("invoices:none → invoices restricted, not an empty list", res.body.invoices?.restricted === true, res.body.invoices);
ok("…jobs still listed (jobs:view_only)", Array.isArray(res.body.jobs) && res.body.jobs.length === 1);
ok("nothing in the payload carries the invoice's amounts", !JSON.stringify(res.body).includes("2600"));

reset(); as("m_edit");
res = await docsRoute.GET(req(null), ctx("lead_foreign"));
ok("documents for another company's lead → 404", res.status === 404);

// A crew-shaped member: jobs view_only, no client book, no job editing →
// assignedJobWhere narrows the job query.
reset();
globalThis.__FQ_ROWS.member.push({ id: "m_crew", userId: "u_crew", role: "employee", companyId: COMPANY,
  permissions: { requests: "view_only", quotes: "view_only", jobs: "view_only", clientsProperties: "name_address_only", invoices: "none" } });
as("m_crew");
leadRow("lead_bare").quoteId = "q_acc";
await docsRoute.GET(req(null), ctx("lead_bare"));
ok("a crew member's job query is narrowed to their own visits (assignedJobWhere)",
  globalThis.__FQ_LAST_JOB_WHERE?.visits?.some?.assignedToId === "u_crew", globalThis.__FQ_LAST_JOB_WHERE);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Candidates and client matching against junk");
// ═══════════════════════════════════════════════════════════════════════════

const ranked = rankQuoteCandidates([
  { id: "a", status: "draft", createdAt: "2026-09-01", matchesLead: false },
  { id: "b", status: "accepted", createdAt: "2026-08-01", matchesLead: false },
  { id: "c", status: "sent", createdAt: "2026-09-10", matchesLead: true },
  { id: "d", status: "accepted", createdAt: "2026-07-01", matchesLead: true },
  null,
  { status: "accepted" },
]);
ok("ranking: this lead's client first, the ones that would win first within that",
  ranked.map((r) => r.id).join(",") === "d,c,b,a", ranked.map((r) => r.id));
ok("ranking drops null and id-less rows", ranked.length === 4);
ok("rankQuoteCandidates(non-array) → []", Array.isArray(rankQuoteCandidates("x")) && rankQuoteCandidates("x").length === 0);

ok("leadClientMatch: email lowercased, phone kept", JSON.stringify(leadClientMatch({ email: " Ana@X.COM ", phone: "613-555-0199" })) ===
  JSON.stringify([{ email: { equals: "ana@x.com", mode: "insensitive" } }, { phone: "613-555-0199" }]));
ok("leadClientMatch: a non-email and a 3-digit 'phone' match nothing", leadClientMatch({ email: "n/a", phone: "123" }).length === 0);
ok("leadClientMatch: objects in place of strings match nothing", leadClientMatch({ email: { $ne: 1 }, phone: ["1"] }).length === 0);
ok("leadClientMatch(null) → []", leadClientMatch(null).length === 0);
ok("cleanQuoteSearch trims and bounds", cleanQuoteSearch("  Q-1  ") === "Q-1" && cleanQuoteSearch("x".repeat(500)).length === 80);
ok("cleanQuoteSearch(non-string) → ''", cleanQuoteSearch({}) === "" && cleanQuoteSearch(null) === "");
ok("shapeLinkedInvoice shows the LATEST version of a family",
  shapeLinkedInvoice({ id: "root", invoiceNumber: "INV-1", status: "sent", versions: [{ id: "v3", invoiceNumber: "INV-1", status: "paid" }] }).id === "v3");
ok("shapeLinkedQuote without money has no total even if the row had one",
  !("total" in shapeLinkedQuote({ id: "q", total: 5, acceptedTotal: 6 }, { money: false })));
ok("shapeLinkedQuote with money prefers acceptedTotal", shapeLinkedQuote({ id: "q", total: 5, acceptedTotal: 6 }, { money: true }).total === 6);

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
