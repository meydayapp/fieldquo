// scripts/check-client-edit-scope.mjs
//
//   npm run check:client-edit-scope
//
// ── The incident this holds shut (2026-10-09) ───────────────────────────────
//
// The owner duplicated accepted quote Q-2026-0022 (Maureen Faulkner) into
// draft Q-2026-0023 and, on the copy, "changed the client" to himself. The
// copy kept the clientId (right), and the document builder's only client
// control on an edit was a contact form that PATCHed the SHARED Client row —
// so the signed quote, its job, its invoice and its appointment all began
// printing the owner's name, email and phone.
//
// This runs the SHIPPED handlers against an in-memory tenant shaped like his:
//
//   1. POST /api/quotes/[id]/duplicate on the accepted quote → a draft copy
//      that keeps Maureen (expected).
//   2. PATCH /api/quotes/[copy] { clientId: owner } → the copy points at the
//      owner, Maureen's row is byte-identical (name, email, phone, contact,
//      address), and the original still points at her.
//   3. The old path — PATCH /api/clients/[maureen] with the owner's details
//      and no scope, exactly what the old form sent — is a 409 that names
//      the records and writes NOTHING.
//   4. The explicit "Edit this client's details everywhere": GET usage counts
//      the other records (excluding the document it was opened from), and
//      PATCH with scope "everywhere" writes.
//   5. Repoint refusals: a sent quote, a foreign client, a draft with a job.
//   6. The screens: the builder sends clientId only when it changed, and
//      the contact form sends scope "everywhere" only behind the count.
//
// Mutation-tested: each guard was removed by hand and this script went red
// (see the commit message).
import { readFileSync } from "node:fs";
import { register } from "node:module";
import {
  identityChanges,
  editScopeRefusal,
  usageLabels,
  usageSentence,
  IDENTITY_FIELDS,
} from "@/lib/clients/editScope";
import { quoteRequestBody } from "@/lib/quotes/builderRequest";

let pass = 0;
const failures = [];
const check = (label, ok, detail = "") => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}${detail ? `  — ${detail}` : ""}`); }
};
const src = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
// PURE
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nidentityChanges\n");
const MAUREEN = {
  id: "c_maureen", companyId: "co_tf", type: "individual", name: "Maureen Faulkner", contactName: null,
  email: "mofaulkner@example.com", phone: "905-555-0100", address: "12 Elm St, Oakville ON",
  city: "Oakville", province: "ON", country: "CA", postalCode: "L6J 1A1", notes: "gate code 4417", language: "en",
};
check("identity is name, contactName, email, phone, address", IDENTITY_FIELDS.join(",") === "name,contactName,email,phone,address");
check("the old form's body changes four identity fields",
  identityChanges(MAUREEN, { name: "Emilio Boves", contactName: "", email: "e@x.ca", phone: "416-555-0199" }).join(",") === "name,email,phone");
check("an echo of the row is not a change (case/space-insensitive email, '' over null)",
  identityChanges(MAUREEN, { name: " Maureen Faulkner ", contactName: "", email: "MOFAULKNER@example.com", phone: "905-555-0100" }).length === 0);
check("tax place, language and notes are not identity", identityChanges(MAUREEN, { province: "QC", country: "US", language: "fr", notes: "x" }).length === 0);
check("an address change is identity", identityChanges(MAUREEN, { address: "1 Other Rd" }).join() === "address");
check("hostile body (null, array, string) → no changes, no throw",
  identityChanges(MAUREEN, null).length === 0 && identityChanges(MAUREEN, []).length === 0 && identityChanges(null, "x").length === 0);

console.log("\neditScopeRefusal\n");
const usage3 = {
  quotes: [{ quoteNumber: "Q-2026-0022" }], invoices: [{ invoiceNumber: "INV-2026-0022" }],
  jobs: [{ title: "Kitchen cabinets" }], appointments: [{ scheduledAt: "2026-10-02T14:00:00Z" }], count: 4,
};
check("labels in reading order", usageLabels(usage3).join("|") === "Q-2026-0022|INV-2026-0022|Job: Kitchen cabinets|Visit 2026-10-02");
check("sentence names the count and the records",
  usageSentence(usage3) === "This client is on 4 other records: Q-2026-0022, INV-2026-0022, Job: Kitchen cabinets, Visit 2026-10-02.");
check("refused: identity change, records exist, no scope", editScopeRefusal({ changes: ["name"], usage: usage3 })?.status === 409);
check("…with code client_in_use and the count", editScopeRefusal({ changes: ["name"], usage: usage3 }).body.code === "client_in_use" && editScopeRefusal({ changes: ["name"], usage: usage3 }).body.count === 4);
check("allowed: scope everywhere", editScopeRefusal({ changes: ["name"], usage: usage3, scope: "everywhere" }) === null);
check("a scope that is merely truthy is not everywhere", editScopeRefusal({ changes: ["name"], usage: usage3, scope: true }) !== null);
check("allowed: nothing else uses the client", editScopeRefusal({ changes: ["name"], usage: { count: 0 } }) === null);
check("allowed: no identity change", editScopeRefusal({ changes: [], usage: usage3 }) === null);

console.log("\nquoteRequestBody — the edit carries clientId only when it changed\n");
const baseReq = {
  isEdit: true, subtotal: 100, appliedDiscount: 0, tax: 13, taxEnabled: true, total: 113, notes: "", reviewNotes: "",
  processNotes: "", validUntil: null, clientPhotos: [], siteAddress: "12 Elm", groupsPayload: [], canEditScope: true,
  assignedToTouched: false, assignedToId: "", version: "v1", clientId: "c_maureen",
};
const unchanged = quoteRequestBody({ ...baseReq });
const unchangedNull = quoteRequestBody({ ...baseReq, changedClientId: null });
check("an edit that never changed the client has no clientId key", !("clientId" in unchanged));
check("…and is byte-identical with changedClientId: null", JSON.stringify(unchanged) === JSON.stringify(unchangedNull));
const changed = quoteRequestBody({ ...baseReq, changedClientId: "c_owner" });
check("a changed client is sent as clientId", changed.clientId === "c_owner");
check("…appended last (the md5-held prefix is unchanged)", JSON.stringify(changed).startsWith(JSON.stringify(unchanged).slice(0, -1)));

// ═══════════════════════════════════════════════════════════════════════════
// THE ROUTES, EXECUTED, against an in-memory tenant
// ═══════════════════════════════════════════════════════════════════════════
const HOOKS = `
const STUBS = { "@/lib/db": "fq-stub:db", "@/lib/currentMember": "fq-stub:member", "next/server": "fq-stub:next" };
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") return { format: "module", shortCircuit: true,
    source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] }); export default db;" };
  if (url === "fq-stub:member") return { format: "module", shortCircuit: true,
    source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  if (url === "fq-stub:next") return { format: "module", shortCircuit: true,
    source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const clone = (x) => JSON.parse(JSON.stringify(x));
let seq = 0;
function freshTenant() {
  return {
    client: [
      clone(MAUREEN),
      { id: "c_owner", companyId: "co_tf", type: "individual", name: "Emilio Boves", email: "owner@truefinish.example", phone: "416-555-0199", address: "1 Shop Rd" },
      { id: "c_foreign", companyId: "co_other", type: "individual", name: "Someone Else", email: "x@y.z" },
    ],
    quote: [{
      id: "q22", companyId: "co_tf", clientId: "c_maureen", quoteNumber: "Q-2026-0022", status: "accepted", language: "en",
      subtotal: "6000", discount: "0", tax: "780", total: "6780", taxEnabled: true, shareToken: "tok22",
      signature: { name: "Maureen Faulkner", signedAt: "2026-10-01T15:00:00Z", documentHash: "abc" },
      createdAt: "2026-09-20T00:00:00Z", updatedAt: "2026-10-01T15:00:00Z", siteAddress: "12 Elm St, Oakville ON",
      scopeGroups: [], addOns: [], planOffers: [], costing: null, lineItems: [],
    }],
    invoice: [{ id: "inv22", companyId: "co_tf", clientId: "c_maureen", quoteId: "q22", invoiceNumber: "INV-2026-0022", status: "sent", createdAt: "2026-10-01" }],
    job: [{ id: "job22", companyId: "co_tf", clientId: "c_maureen", quoteId: "q22", title: "Kitchen cabinets", status: "scheduled", createdAt: "2026-10-01" }],
    appointment: [{ id: "ap22", companyId: "co_tf", clientId: "c_maureen", quoteId: "q22", scheduledAt: "2026-10-02T14:00:00Z", status: "scheduled" }],
    activityLog: [],
  };
}
let T = freshTenant();

function matches(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR" || k === "AND" || k === "NOT") continue; // not needed for these assertions
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      if ("not" in v) { if (row[k] === v.not) return false; continue; }
      if ("in" in v) { if (!v.in.includes(row[k])) return false; continue; }
      if ("equals" in v) { if (row[k] !== v.equals) return false; continue; }
      continue; // gte, startsWith, nested relation filters: treated as matching
    }
    if (v === undefined) continue;
    if ((row[k] ?? null) !== v) return false;
  }
  return true;
}
function withIncludes(model, row, args) {
  if (!row) return null;
  const out = clone(row);
  const inc = args?.include || {};
  if (inc.client) out.client = clone(T.client.find((c) => c.id === row.clientId) || null);
  for (const rel of ["scopeGroups", "addOns", "planOffers"]) if (inc[rel] && !out[rel]) out[rel] = [];
  return out;
}
function table(model) {
  return {
    async findFirst(args = {}) { return withIncludes(model, (T[model] || []).find((r) => matches(r, args.where)), args); },
    async findUnique(args = {}) { return withIncludes(model, (T[model] || []).find((r) => matches(r, args.where)), args); },
    async findMany(args = {}) { return (T[model] || []).filter((r) => matches(r, args.where)).map((r) => clone(r)); },
    async count(args = {}) { return (T[model] || []).filter((r) => matches(r, args.where)).length; },
    async create({ data }) {
      const row = { id: `${model}_${++seq}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...clone(data) };
      for (const k of Object.keys(row)) if (row[k] && typeof row[k] === "object" && ("create" in row[k] || "createMany" in row[k])) delete row[k];
      (T[model] ||= []).push(row);
      return clone(row);
    },
    async update({ where, data }) {
      const row = (T[model] || []).find((r) => matches(r, { id: where.id }));
      if (!row) { const e = new Error("not found"); e.code = "P2025"; throw e; }
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && ("upsert" in v || "create" in v)) continue;
        row[k] = v;
      }
      row.updatedAt = new Date().toISOString();
      return clone(row);
    },
    async updateMany() { return { count: 0 }; },
    async aggregate() { return { _sum: {}, _count: {} }; },
    async groupBy() { return []; },
  };
}
const ENFORCEABLE = { id: "m1", userId: "u_owner", companyId: "co_tf", role: "owner", permissions: null };
const db = new Proxy({}, {
  get(_t, model) {
    if (model === "$transaction") return async (fn) => (typeof fn === "function" ? fn(db) : Promise.all(fn));
    if (model === "member") return { async findUnique() { return ENFORCEABLE; }, async findFirst() { return ENFORCEABLE; } };
    if (model === "activityLog") return { async create({ data }) { T.activityLog.push(data); return data; } };
    if (model === "user") return { async findUnique() { return { id: "u_owner", name: "Emilio", email: "owner@truefinish.example" }; } };
    if (model === "company") return { async findUnique() { return { id: "co_tf", currency: "CAD", country: "CA", timezone: "America/Toronto" }; } };
    if (["client", "quote", "invoice", "job", "appointment"].includes(model)) return table(model);
    return new Proxy({}, { get: (_x, prop) => (prop === "findMany" || prop === "groupBy" ? async () => [] : prop === "count" ? async () => 0 : async () => null) });
  },
});
globalThis.__FQ_DB = db;
globalThis.__FQ_MEMBER = async () => ({ ...ENFORCEABLE, impersonation: false });

const req = (url, body) => ({ url, method: body ? "PATCH" : "GET", json: async () => body ?? {}, headers: new Map() });
const params = (o) => ({ params: Promise.resolve(o) });

const duplicateRoute = await import("@/app/api/quotes/[id]/duplicate/route");
const quoteRoute = await import("@/app/api/quotes/[id]/route");
const clientRoute = await import("@/app/api/clients/[id]/route");
const usageRoute = await import("@/app/api/clients/[id]/usage/route");

const maureenBefore = clone(T.client.find((c) => c.id === "c_maureen"));
const ident = (c) => JSON.stringify([c.name, c.contactName ?? null, c.email, c.phone, c.address]);

console.log("\n1. Duplicate the accepted quote\n");
let res = await duplicateRoute.POST(req("http://x/api/quotes/q22/duplicate"), params({ id: "q22" }));
check("201 with a fresh number", res.status === 201 && res.body.quoteNumber === "Q-2026-0023", JSON.stringify(res.body));
const copyId = res.body.id;
const copy = () => T.quote.find((q) => q.id === copyId);
check("the copy is a draft that keeps Maureen (a duplicate keeps the client — expected)", copy()?.status === "draft" && copy()?.clientId === "c_maureen");

console.log("\n2. Change the client on the copy — the repoint\n");
res = await quoteRoute.PATCH(req(`http://x/api/quotes/${copyId}`, { clientId: "c_owner" }), params({ id: copyId }));
check("200", res.status === 200, JSON.stringify(res.body).slice(0, 200));
check("the COPY now points at the owner", copy().clientId === "c_owner");
check("the ORIGINAL still points at Maureen", T.quote.find((q) => q.id === "q22").clientId === "c_maureen");
const maureenAfter = T.client.find((c) => c.id === "c_maureen");
check("Maureen's row is untouched: name", maureenAfter.name === maureenBefore.name);
check("…email", maureenAfter.email === maureenBefore.email);
check("…phone", maureenAfter.phone === maureenBefore.phone);
check("…contactName and address", ident(maureenAfter) === ident(maureenBefore));
check("…the whole row, byte for byte", JSON.stringify(maureenAfter) === JSON.stringify(maureenBefore));
check("the owner's row is untouched too", T.client.find((c) => c.id === "c_owner").name === "Emilio Boves");
check("the response is the copy, printed for the owner", res.body.client?.id === "c_owner");
const trail = T.activityLog.find((a) => a.action === "quote.client_changed");
check("the activity trail says which quote moved, from whom, to whom",
  trail && /Q-2026-0023 is now for Emilio Boves \(was Maureen Faulkner\)/.test(trail.summary) && /no client's details were edited/.test(trail.summary));
check("…and no client.updated row exists", !T.activityLog.some((a) => a.action === "client.updated"));
res = await quoteRoute.PATCH(req(`http://x/api/quotes/${copyId}`, { clientId: "c_owner", notes: "x" }), params({ id: copyId }));
check("re-sending the same clientId is not a second repoint", res.status === 200 && T.activityLog.filter((a) => a.action === "quote.client_changed").length === 1);

console.log("\n3. The old path — the contact form PATCHing the shared row, no scope\n");
T.activityLog.length = 0;
const OLD_FORM_BODY = { name: "Emilio Boves", contactName: "", email: "owner@truefinish.example", phone: "416-555-0199" };
res = await clientRoute.PATCH(req("http://x/api/clients/c_maureen", OLD_FORM_BODY), params({ id: "c_maureen" }));
check("409 client_in_use", res.status === 409 && res.body.code === "client_in_use", JSON.stringify(res.body));
check("the refusal names the records", /Q-2026-0022/.test(res.body.error) && /INV-2026-0022/.test(res.body.error) && /Job: Kitchen cabinets/.test(res.body.error));
check("Maureen's row is untouched", JSON.stringify(T.client.find((c) => c.id === "c_maureen")) === JSON.stringify(maureenBefore));
check("nothing logged as an edit", !T.activityLog.some((a) => a.action === "client.updated"));
res = await clientRoute.PATCH(req("http://x/api/clients/c_maureen", { ...OLD_FORM_BODY, scope: "quote" }), params({ id: "c_maureen" }));
check("a scope other than 'everywhere' is refused too", res.status === 409);
res = await clientRoute.PATCH(req("http://x/api/clients/c_maureen", { language: "fr", province: "ON" }), params({ id: "c_maureen" }));
check("a non-identity edit (language, province) still goes through without scope", res.status === 200);
T.client.find((c) => c.id === "c_maureen").language = "en";

console.log("\n4. \"Edit this client's details everywhere\" — the count, then the write\n");
res = await usageRoute.GET(req("http://x/api/clients/c_maureen/usage"), params({ id: "c_maureen" }));
check("usage with no exception: the original quote, invoice, job, visit = 4", res.status === 200 && res.body.count === 4, JSON.stringify(res.body));
res = await usageRoute.GET(req("http://x/api/clients/c_maureen/usage?exceptQuote=q22"), params({ id: "c_maureen" }));
check("opened from Q-2026-0022: the OTHER records = 3 (invoice, job, visit)", res.body.count === 3 && !res.body.records.includes("Q-2026-0022"));
check("…named for the sentence", res.body.sentence === "This client is on 3 other records: INV-2026-0022, Job: Kitchen cabinets, Visit 2026-10-02.");
check("…and structured for a translated prefix", res.body.items?.[1]?.kind === "job" && res.body.items?.[1]?.text === "Kitchen cabinets");
res = await usageRoute.GET(req("http://x/api/clients/c_foreign/usage"), params({ id: "c_foreign" }));
check("another tenant's client: 404", res.status === 404);
res = await clientRoute.PATCH(req("http://x/api/clients/c_maureen", { phone: "905-555-0111", scope: "everywhere" }), params({ id: "c_maureen" }));
check("scope everywhere: 200 and the phone changes", res.status === 200 && T.client.find((c) => c.id === "c_maureen").phone === "905-555-0111");
check("…logged with scope everywhere", T.activityLog.some((a) => a.action === "client.updated" && a.metadata?.scope === "everywhere"));
T.client.find((c) => c.id === "c_maureen").phone = maureenBefore.phone;
res = await clientRoute.PATCH(req("http://x/api/clients/c_owner", { name: "Emilio B." }), params({ id: "c_owner" }));
check("a client on exactly one draft (the owner, on the copy) is refused without scope too — that draft is a record",
  res.status === 409 && res.body.count === 1);

console.log("\n5. Repoint refusals\n");
res = await quoteRoute.PATCH(req("http://x/api/quotes/q22", { clientId: "c_owner" }), params({ id: "q22" }));
check("the accepted quote: 409 client_locked", res.status === 409 && res.body.code === "client_locked");
check("…and it still points at Maureen", T.quote.find((q) => q.id === "q22").clientId === "c_maureen");
copy().status = "sent";
res = await quoteRoute.PATCH(req(`http://x/api/quotes/${copyId}`, { clientId: "c_maureen" }), params({ id: copyId }));
check("a SENT quote: 409 (the link is in the first client's inbox)", res.status === 409 && copy().clientId === "c_owner");
copy().status = "draft";
res = await quoteRoute.PATCH(req(`http://x/api/quotes/${copyId}`, { clientId: "c_foreign" }), params({ id: copyId }));
check("another tenant's client: 400 and not repointed", res.status === 400 && copy().clientId === "c_owner");
res = await quoteRoute.PATCH(req(`http://x/api/quotes/${copyId}`, { clientId: "" }), params({ id: copyId }));
check("an empty clientId: 400", res.status === 400 && copy().clientId === "c_owner");
T.invoice.push({ id: "inv_d", companyId: "co_tf", clientId: "c_owner", quoteId: copyId, invoiceNumber: "INV-2026-0099", status: "draft" });
res = await quoteRoute.PATCH(req(`http://x/api/quotes/${copyId}`, { clientId: "c_maureen" }), params({ id: copyId }));
check("a draft with an invoice hanging off it: 409", res.status === 409 && copy().clientId === "c_owner");
T.invoice.pop();
res = await quoteRoute.PATCH(req(`http://x/api/quotes/${copyId}`, { clientId: "c_maureen" }), params({ id: copyId }));
check("…and back to Maureen once it has none (a draft can be repointed again)", res.status === 200 && copy().clientId === "c_maureen");

console.log("\n6. Signed quotes keep what was signed\n");
const pdfSig = src("lib/documentSections/SignatureSection.js");
check("the PDF's signature block prints the SIGNED name (sig.name), not the live client", /\{sig\.name \|\| labels\.signatureFieldLabel\}/.test(pdfSig));
const audit = src("lib/documents/signatureAudit.js");
check("the signature hash covers clientId — a repoint of a signed quote would show as tampering, and PATCH refuses it past draft anyway",
  /\["clientId", q\.clientId \?\? null\]/.test(audit));

console.log("\n7. The screens\n");
const docB = src("app/components/quotes/builder/DocumentBuilder.js");
const qb = src("app/components/quotes/builder/QuoteBuilder.js");
check("the contact form sends scope everywhere", /jsonBody\(\{ \.\.\.form, scope: "everywhere" \}/.test(docB));
check("…and its Save is off until the count is known and, if any, confirmed",
  /const canSave = known && \(others === 0 \|\| confirmed\)/.test(docB) && /disabled=\{busy \|\| !canSave\}/.test(docB));
check("…and asks the server excluding the document it was opened from", /exceptInvoice" : "exceptQuote"/.test(docB) && /usageQuery=\{clientUsageQuery\}/.test(docB));
check("the default mode on opening is 'Use a different client'", /setClientMode\("switch"\);\s*\n\s*setEditing/.test(docB) && /useState\("switch"\)/.test(docB));
check("the picker is unlocked on a draft edit", /locked=\{isEdit && !canSwitchClient\}/.test(docB) && /locked=\{isEdit && !clientRepointable\}/.test(qb));
check("draft only", /const clientRepointable = Boolean\(isEdit\) && start\.status === "draft"/.test(qb));
check("the builder save passes changedClientId", /changedClientId: clientRepointable \? changedClientId : null/.test(qb));
check("selecting a client on an edit does not change the document's language",
  /if \(c\.language && !isEdit\) b\.setQuoteLanguage/.test(docB) && /if \(c\.language && !isEdit\) setQuoteLanguage/.test(qb) && /if \(created\.language && !isEdit\)/.test(qb));
check("the client's own page states scope everywhere", /scope: "everywhere" \}\)/.test(src("app/app/clients/[id]/page.js")));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
