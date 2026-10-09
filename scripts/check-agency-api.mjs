// scripts/check-agency-api.mjs
//
//   npm run check:agency-api
//
// The marketing-agency API, webhooks and settings — executed, two companies
// deep, against an in-memory store (scripts/fixtures/memoryPrisma.mjs). Every
// handler is the real one from lib/agency/; only the database and the hook
// target are stand-ins.
//
//   1. keys: shown once, hashed at rest, revoked for good
//   2. who may manage them — owner/admin yes, crew no, a support session never
//   3. the front door: no key, a wrong key, a revoked key, a missing scope,
//      the per-key rate limit — every call logged against its key
//   4. tenancy: another company's key reaches nothing of this company's
//   5. the contact-details switch, OFF and ON, on every path — the API row,
//      a webhook delivery and the Zapier sample — and the job-values switch
//   6. postal codes: US ZIP5 (never the house number), Canadian FSA
//   7. REST hooks: subscribe → event → delivery → retry → 410 ends it; no
//      backfill; stage changes report a true "from"
//   8. the agency's own funnel: create, deduplicate by email and by phone
//   9. move-to-stage obeys the pipeline's own rules; the requested-visit
//      window never touches a booked visit; find-by-contact stays private
//  10. target URLs: https only, no localhost, no IP literal
//
// Ends with a mutation pass over the privacy boundary (cp backups only).

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// A mutant run (the pass at the bottom re-runs this file against a changed
// copy of the code) prints nothing and only exits.
const MUTANT = process.argv.includes("--mutant");

const keys = await import("@/lib/agency/keys");
const { resolveAgencyKey, runAgencyCall, RATE_LIMIT } = await import("@/lib/agency/apiAuth");
const api = await import("@/lib/agency/api");
const settings = await import("@/lib/agency/settings");
const { sweepCompanyEvents, EVENTS, EVENT_DESCRIPTIONS } = await import("@/lib/agency/events");
const { deliverDue, cleanTargetUrl, nextAttemptAfter, MAX_ATTEMPTS } = await import("@/lib/agency/delivery");
const { readPostal, postalForAgency } = await import("@/lib/agency/postal");
const { buildLeadRow, LEAD_ROW_KEYS, CONTACT_KEYS, MONEY_KEYS, firstNameOf, scrubContactDetails } = await import("@/lib/agency/leadRow");
const { newLeadRef, displayRef, resolveRefQuery, isLeadRef } = await import("@/lib/agency/leadRef");
const { channelOf, agencyBadgeOf, MARKETING_CHANNELS } = await import("@/lib/agency/channels");
const { fakeDb } = await import("./fixtures/memoryPrisma.mjs");

let pass = 0;
const fails = [];
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    if (!MUTANT) console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
    if (!MUTANT) console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => !MUTANT && console.log(`\n${s}`);
const d = (s) => new Date(s);
let clock = d("2026-10-05T12:00:00Z");
const tick = (ms) => (clock = new Date(clock.getTime() + ms));
const req = (secret, { method = "GET", path = "/api/v1/me", ip = "203.0.113.9" } = {}) => ({
  method,
  url: `https://app.fieldquo.com${path}`,
  headers: new Headers({ ...(secret ? { authorization: `Bearer ${secret}` } : {}), "x-forwarded-for": ip }),
});
const q = (obj = {}) => new URLSearchParams(obj);

// ── The store: two companies, and a guard that refuses an unscoped query ──
//
// Every read or bulk write on a tenant table must name the company (or the
// key, which was itself resolved from the company's own row). A lookup by a
// unique id is allowed — that id came out of a scoped read. The guard throws
// rather than answering, so a handler that forgot companyId fails here.
const TENANT_TABLES = new Set([
  "leadRequest", "messageThread", "quote", "appointment", "client", "job", "invoice", "marketingSpend", "messagingChannel",
  "agencyAccessKey", "agencyHookSubscription", "agencyEvent", "agencyApiCall", "activityLog",
]);
const SCOPED_READS = new Set(["findMany", "findFirst", "count", "updateMany", "deleteMany"]);
const unscoped = [];
function namesTenant(where) {
  if (!where || typeof where !== "object") return false;
  if ("companyId" in where || "keyId" in where) return true;
  // One row by its own id: the id came out of a scoped read.
  if (typeof where.id === "string") return true;
  return (Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []).some(namesTenant);
}
function guarded(inner) {
  return new Proxy(inner, {
    get(target, model) {
      const delegate = target[model];
      if (typeof model !== "string" || !TENANT_TABLES.has(model) || !delegate) return delegate;
      return new Proxy(delegate, {
        get(d, method) {
          const fn = d[method];
          if (!SCOPED_READS.has(method) || typeof fn !== "function") return fn;
          return (args = {}) => {
            if (!namesTenant(args.where)) {
              unscoped.push(`${model}.${method}`);
              throw new Error(`unscoped ${model}.${method}: ${JSON.stringify(args.where)}`);
            }
            return fn(args);
          };
        },
      });
    },
  });
}
const db = guarded(fakeDb());
const A = "co_A";
const B = "co_B";
await db.company.create({ data: { id: A, name: "Acme Painting", currency: "CAD", country: "CA", agencyShareContacts: false, agencyShareMoney: true } });
await db.company.create({ data: { id: B, name: "Beta Floors", currency: "USD", country: "US", agencyShareContacts: false, agencyShareMoney: true } });
await db.user.create({ data: { id: "u_owner", email: "owner@acme.test", name: "Olive Owner" } });
const owner = { id: "m_owner", userId: "u_owner", companyId: A, role: "owner" };
const admin = { id: "m_admin", userId: "u_owner", companyId: A, role: "admin" };
const crew = { id: "m_crew", userId: "u_crew", companyId: A, role: "employee" };
const support = { id: "m_owner", userId: "u_owner", companyId: A, role: "viewer", impersonation: true, impersonationMode: "read_only" };
const sandbox = { ...support, impersonationMode: "demo_sandbox" };
const ownerB = { id: "m_b", userId: "u_owner", companyId: B, role: "owner" };

// ── 1. Keys ─────────────────────────────────────────────────────────────────
section("1. Keys: shown once, hashed at rest");
{
  const s = keys.generateAgencySecret();
  ok("a secret looks like fqa_ + 43 characters", keys.looksLikeAgencySecret(s) && s.length === 47, s.length);
  ok("two secrets differ", s !== keys.generateAgencySecret());
  ok("the hash is sha256 hex, not the secret", /^[0-9a-f]{64}$/.test(keys.hashAgencySecret(s)) && !keys.hashAgencySecret(s).includes(s.slice(4)));
  ok("the hint is the last four", keys.keyHintOf(s) === s.slice(-4));
  ok("a bearer header is read", keys.secretFromHeaders(new Headers({ authorization: `Bearer ${s}` })) === s);
  ok("X-Api-Key is read too", keys.secretFromHeaders(new Headers({ "x-api-key": s })) === s);
  ok("garbage is not a key", keys.secretFromHeaders(new Headers({ authorization: "Bearer hello" })) === null);
  ok("read-only by default", JSON.stringify(keys.cleanScopes({})) === '["marketing:read"]');
  ok("write only when asked in so many words", keys.cleanScopes({ writeLeads: "yes" }).length === 1 && keys.cleanScopes({ writeLeads: true }).includes("marketing:write_leads"));
  ok("a revoked key holds no scope", !keys.keyHasScope({ scopes: ["marketing:read"], revokedAt: new Date() }, "marketing:read"));
}

// ── 2. Who may manage keys ─────────────────────────────────────────────────
section("2. Settings: owner/admin create, crew and support never");
const created = await settings.createAgencyKey(db, owner, { name: "  Pulse <b>Marketing</b>  " }, { now: clock });
ok("the owner creates a key (201)", created.status === 201);
const SECRET_A = created.body.secret;
const KEY_A = created.body.key;
ok("the answer carries the secret once", keys.looksLikeAgencySecret(SECRET_A));
const stored = (await db.agencyAccessKey.findMany({ where: { companyId: A } }))[0];
ok("the row stores the hash, never the secret", stored.keyHash === keys.hashAgencySecret(SECRET_A) && !JSON.stringify(stored).includes(SECRET_A));
ok("the name is cleaned of markup", stored.name === "Pulse bMarketing/b" || !/[<>]/.test(stored.name), stored.name);
ok("created by is recorded", stored.createdByName === "Olive Owner");
ok("the public view has no hash", !("keyHash" in KEY_A) && KEY_A.hint === SECRET_A.slice(-4));
const writer = await settings.createAgencyKey(db, admin, { name: "Pulse funnel", writeLeads: true }, { now: clock });
ok("an admin creates a write key", writer.status === 201 && writer.body.key.scopes.includes("marketing:write_leads"));
const SECRET_W = writer.body.secret;
ok("crew are refused", (await settings.createAgencyKey(db, crew, { name: "x" })).status === 403);
ok("a support session is refused key creation", (await settings.createAgencyKey(db, support, { name: "x" })).body.code === "read_only");
ok("a demo-sandbox support session is refused too", (await settings.createAgencyKey(db, sandbox, { name: "x" })).status === 403);
ok("a support session cannot flip sharing", (await settings.setAgencySharing(db, support, { contactDetails: true })).status === 403);
ok("a support session cannot revoke", (await settings.revokeAgencyKey(db, support, KEY_A.id)).status === 403);
const view = await settings.readAgencyAccess(db, support, { now: clock });
ok("a support session may READ the screen", view.status === 200 && view.body.canManage === false && view.body.keys.length === 2);
ok("the screen never shows a hash or a secret", !JSON.stringify(view.body).includes(stored.keyHash) && !JSON.stringify(view.body).includes(SECRET_A));
ok("crew cannot read it", (await settings.readAgencyAccess(db, crew)).status === 403);
ok("a nameless key is refused", (await settings.createAgencyKey(db, owner, { name: "  " })).status === 400);
const keyB = await settings.createAgencyKey(db, ownerB, { name: "Other agency", writeLeads: true }, { now: clock });
const SECRET_B = keyB.body.secret;

// ── 3. The front door ──────────────────────────────────────────────────────
section("3. The front door: refusals in the standard shape, every call logged");
{
  const none = await resolveAgencyKey(db, req(null));
  ok("no key → 401 unauthorized", none.refusal?.status === 401 && none.refusal.body.code === "unauthorized" && typeof none.refusal.body.error === "string");
  const wrong = await resolveAgencyKey(db, req(keys.generateAgencySecret(), { ip: "198.51.100.1" }));
  ok("an unknown key → 401", wrong.refusal?.status === 401);
  const okA = await resolveAgencyKey(db, req(SECRET_A), { scope: "marketing:read", now: clock });
  ok("a good key resolves to ITS company", okA.companyId === A);
  const noWrite = await resolveAgencyKey(db, req(SECRET_A), { scope: "marketing:write_leads", now: clock });
  ok("a read key on a write route → 403 scope_missing", noWrite.refusal?.status === 403 && noWrite.refusal.body.code === "scope_missing");
  const logged = await runAgencyCall(db, req(SECRET_A, { method: "POST", path: "/api/v1/marketing/leads?x=secret-campaign" }), { scope: "marketing:write_leads", now: clock }, async () => ({ status: 201, body: {} }));
  ok("a refused call answers 403", logged.status === 403);
  const callRows = await db.agencyApiCall.findMany({ where: { keyId: KEY_A.id } });
  ok("… and is logged against the key, without the query string", callRows.some((c) => c.status === 403 && c.path === "/api/v1/marketing/leads"));
  const me = await runAgencyCall(db, req(SECRET_A), { scope: "marketing:read", now: clock }, (ctx) => api.getMe({ ...ctx, db }));
  ok("/me names the key's company", me.status === 200 && me.body.company.name === "Acme Painting" && me.body.key.name === stored.name);
  ok("lastUsedAt is stamped", (await db.agencyAccessKey.findFirst({ where: { id: KEY_A.id } })).lastUsedAt !== null);
  // Rate limit: RATE_LIMIT calls in the window → 429.
  const many = Array.from({ length: RATE_LIMIT }, () => ({ companyId: A, keyId: writer.body.key.id, method: "GET", path: "/x", status: 200, at: clock }));
  await db.agencyApiCall.createMany({ data: many });
  const limited = await resolveAgencyKey(db, req(SECRET_W), { scope: "marketing:read", now: clock });
  ok(`the ${RATE_LIMIT + 1}th call in a minute → 429 with retryAfter`, limited.refusal?.status === 429 && limited.refusal.body.retryAfter > 0);
  const later = await resolveAgencyKey(db, req(SECRET_W), { scope: "marketing:read", now: new Date(clock.getTime() + 61_000) });
  ok("a minute later it is let through", later.companyId === A);
  ok("the limit is per key — another key is unaffected", (await resolveAgencyKey(db, req(SECRET_A), { scope: "marketing:read", now: clock })).companyId === A);
}

// ── Fixture leads ──────────────────────────────────────────────────────────
const t0 = d("2026-09-10T15:00:00Z");
const clientA = await db.client.create({ data: { companyId: A, name: "Ana Lopez", email: "ana@example.com", phone: "+16135550142", address: "12 Elm St", city: "Ottawa", province: "ON", postalCode: "K1A 0B1", createdAt: t0 } });
const quoteA = await db.quote.create({ data: { companyId: A, clientId: clientA.id, quoteNumber: "Q-1", status: "sent", total: 4200, sentAt: d("2026-09-12T10:00:00Z"), createdAt: d("2026-09-11T10:00:00Z") } });
const leadA = await db.leadRequest.create({
  data: {
    companyId: A, name: "Ana Maria Lopez", email: "ana@example.com", phone: "613-555-0142", source: "meta_lead_form", metaLeadId: "ml_1",
    metaCampaignId: "120200000000000001", metaCampaignName: "Fall kitchens", temperature: "hot", qualifiedAt: t0, quoteId: quoteA.id,
    intake: { address: "12 Elm St, Ottawa ON K1A 0B1", service: "Cabinet painting" }, createdAt: t0, updatedAt: t0,
  },
});
await db.appointment.create({ data: { companyId: A, clientId: clientA.id, scheduledAt: d("2026-09-11T14:00:00Z"), status: "completed", createdAt: d("2026-09-10T16:00:00Z"), updatedAt: d("2026-09-11T18:00:00Z") } });
const leadB = await db.leadRequest.create({ data: { companyId: B, name: "Zed Zulu", email: "zed@example.com", phone: "+12175550199", source: "self_quote", intake: { address: "12345 Main St, Springfield, IL 62704-1234" }, temperature: "warm", createdAt: t0, updatedAt: t0 } });

// ── 4. Tenancy ─────────────────────────────────────────────────────────────
section("4. Tenancy: the key is the only thing that names a company");
const listA = await api.listLeads({ db, companyId: A, query: q(), now: clock });
const rowA = listA.body.leads[0];
ok("company A's list holds A's lead only", listA.body.leads.length === 1 && rowA.firstName === "Ana");
ok("every lead got a stable reference", isLeadRef(rowA.ref) && rowA.displayRef === `L-${rowA.ref.slice(-4)}`);
const again = await api.listLeads({ db, companyId: A, query: q(), now: clock });
ok("the reference does not change between reads", again.body.leads[0].ref === rowA.ref);
const listB = await api.listLeads({ db, companyId: B, query: q(), now: clock });
const refB = listB.body.leads[0].ref;
ok("company B's list holds B's lead only", listB.body.leads.length === 1 && listB.body.leads[0].firstName === "Zed");
ok("B's key asking for A's lead by ref → 404", (await api.getLead({ db, companyId: B, ref: rowA.ref, now: clock })).status === 404);
ok("A's key asking for B's lead → 404", (await api.getLead({ db, companyId: A, ref: refB, now: clock })).status === 404);
ok("by display form within the company", (await api.getLead({ db, companyId: A, ref: rowA.displayRef, now: clock })).body.lead.ref === rowA.ref);
ok("the ref is random, not the row id", !rowA.ref.includes(leadA.id));
const resolvedB = await resolveAgencyKey(db, req(SECRET_B), { scope: "marketing:read", now: clock });
ok("B's key resolves to B, whatever the URL says", resolvedB.companyId === B);
const metricsB = await api.getMetrics({ db, companyId: B, query: q({ period: "custom", from: "2026-09-01", to: "2026-09-30" }), now: clock, deps: { rates: [], loadAdFunnel: async () => null } });
ok("B's metrics count B's one lead, not A's", metricsB.body.metrics.leads.value === 1);

// ── 5. The switches, on every path ─────────────────────────────────────────
section("5. Contact details OFF by default, on every path");
const hasNoPii = (row) =>
  row.fullName === null && row.phone === null && row.email === null && !JSON.stringify(row).includes("Lopez") &&
  !JSON.stringify(row).includes("555-0142") && !JSON.stringify(row).includes("ana@example.com") && !JSON.stringify(row).includes("Elm");
ok("API row: first name only, no surname/phone/email/street", hasNoPii(rowA), rowA);
ok("API row: partial postal (FSA)", rowA.postalCode === "K1A" && rowA.postalCountry === "CA", rowA.postalCode);
ok("API row: the shape is stable — contact keys present, null", CONTACT_KEYS.every((k) => k in rowA));
ok("API row: money shared by default", rowA.quoteAmount === 4200 && rowA.currency === "CAD");
ok("API row: channel and campaign", rowA.channel === "facebook_ad" && rowA.campaignId === "120200000000000001");
ok("API row: appointment held, stage quote_sent", rowA.appointmentOutcome === "held" && rowA.stage === "quote_sent");
ok("API row: the service asked for", rowA.serviceRequested === "Cabinet painting");
ok("every key the docs list is on the row", LEAD_ROW_KEYS.every((k) => k in rowA));
const zedRow = listB.body.leads[0];
ok("US: ZIP5 — never the house number, never ZIP+4", zedRow.postalCode === "62704" && zedRow.postalCountry === "US", zedRow.postalCode);

// Webhook + sample with the switch OFF.
const posted = [];
let answer = 200;
const fetchImpl = async (url, init) => {
  posted.push({ url, body: JSON.parse(init.body), headers: init.headers });
  return { status: typeof answer === "function" ? answer() : answer };
};
const sub = await api.subscribeHook({ db, companyId: A, key: { id: KEY_A.id }, body: { event: "lead.created", targetUrl: "https://hooks.zapier.com/hooks/standard/1/abc" }, now: clock });
ok("subscribe → 201 with an id", sub.status === 201 && sub.body.id);
tick(60_000);
const leadNew = await db.leadRequest.create({ data: { companyId: A, name: "Carla Diaz", email: "carla@example.com", phone: "+1 613 555 0177", source: "self_quote", temperature: "cold", intake: { postalCode: "K2P 1L4" }, createdAt: clock, updatedAt: clock } });
const sw1 = await sweepCompanyEvents({ db, companyId: A, now: clock });
ok("the sweep writes lead.created for the new lead only — no backfill of Ana", sw1.written === 1 && sw1.fannedOut === 1, sw1);
const sw1b = await sweepCompanyEvents({ db, companyId: A, now: clock });
ok("a second sweep writes nothing (idempotent)", sw1b.written === 0 && sw1b.fannedOut === 0, sw1b);
const t1 = await deliverDue({ db, companyId: A, now: clock, fetchImpl });
ok("delivered once", t1.delivered === 1 && posted.length === 1, t1);
const p1 = posted[0].body;
ok("webhook payload: event, id, occurredAt, lead", p1.event === "lead.created" && p1.id && p1.occurredAt && p1.lead?.ref);
ok("webhook payload: no PII with the switch off", hasNoPii(p1.lead) && !JSON.stringify(p1).includes("Diaz") && !JSON.stringify(p1).includes("carla@") && !JSON.stringify(p1).includes("0177"), p1.lead);
ok("webhook payload: FSA only", p1.lead.postalCode === "K2P");
ok("webhook payload: the same row the API returns", JSON.stringify(Object.keys(p1.lead)) === JSON.stringify(LEAD_ROW_KEYS));
const sample = await api.hookSamples({ db, companyId: A, event: "lead.created", query: q(), now: clock });
ok("sample: the stored event, built the same way", sample.status === 200 && sample.body.length === 1 && sample.body[0].lead.firstName === "Carla");
ok("sample: no PII with the switch off", hasNoPii(sample.body[0].lead));
const sampleQ = await api.hookSamples({ db, companyId: A, event: "quote.sent", query: q(), now: clock });
ok("sample for an event never stored yet: built from real leads", sampleQ.body.length === 1 && sampleQ.body[0].event === "quote.sent" && sampleQ.body[0].lead.firstName === "Ana");
ok("sample of an unknown event → 404", (await api.hookSamples({ db, companyId: A, event: "lead.deleted", query: q() })).status === 404);

section("5b. Contact details ON — the full set, on every path; logged");
ok("the owner turns it on", (await settings.setAgencySharing(db, owner, { contactDetails: true })).body.sharing.contactDetails === true);
const log = await db.activityLog.findMany({ where: { companyId: A, action: "agency_sharing.changed" } });
ok("the change is in the activity log", log.length === 1 && /contact details/.test(log[0].summary));
const rowOn = (await api.getLead({ db, companyId: A, ref: rowA.ref, now: clock })).body.lead;
ok("API row: full name, phone, email", rowOn.fullName === "Ana Maria Lopez" && rowOn.phone === "613-555-0142" && rowOn.email === "ana@example.com");
ok("API row: full postal code", rowOn.postalCode === "K1A 0B1");
ok("API row: still never the street address", !JSON.stringify(rowOn).includes("Elm"));
tick(60_000);
await db.leadRequest.create({ data: { companyId: A, name: "Dev Patel", email: "dev@example.com", phone: "+16135550188", source: "self_quote", temperature: "warm", createdAt: clock, updatedAt: clock } });
await sweepCompanyEvents({ db, companyId: A, now: clock });
await deliverDue({ db, companyId: A, now: clock, fetchImpl });
const p2 = posted[posted.length - 1].body;
ok("webhook payload: contact details with the switch on", p2.lead.fullName === "Dev Patel" && p2.lead.email === "dev@example.com" && p2.lead.contactsShared === true);
const sampleOn = await api.hookSamples({ db, companyId: A, event: "lead.created", query: q({ limit: "5" }), now: clock });
ok("sample: contact details with the switch on", sampleOn.body.some((s) => s.lead.email === "dev@example.com"));
await settings.setAgencySharing(db, owner, { contactDetails: false });
const sampleOff = await api.hookSamples({ db, companyId: A, event: "lead.created", query: q({ limit: "5" }), now: clock });
ok("switched off again: the SAME stored events now carry no PII", sampleOff.body.every((s) => hasNoPii(s.lead)));

section("5c. Job values OFF");
await settings.setAgencySharing(db, owner, { jobValues: false });
const rowNoMoney = (await api.getLead({ db, companyId: A, ref: rowA.ref, now: clock })).body.lead;
ok("API row: every money field null", MONEY_KEYS.every((k) => rowNoMoney[k] === null) && rowNoMoney.moneyShared === false);
const metricsNoMoney = await api.getMetrics({ db, companyId: A, query: q({ period: "custom", from: "2026-09-01", to: "2026-10-05" }), now: clock, deps: { rates: [], loadAdFunnel: async () => null } });
ok("metrics: revenue and ROAS null with the reason", metricsNoMoney.body.metrics.revenue.value === null && metricsNoMoney.body.metrics.revenue.reason === "money_not_shared" && metricsNoMoney.body.currency === null);
await settings.setAgencySharing(db, owner, { jobValues: true });

// ── 6. Postal codes, hostile ───────────────────────────────────────────────
section("6. Postal codes");
const pc = (value, field = false, country = null) => readPostal(value, { field, country });
ok("ZIP+4 → ZIP5", pc("62704-1234", true)?.partial === "62704");
ok("a house number is not a ZIP", pc("12345 Main St, Springfield")?.partial === undefined);
ok("state then ZIP", pc("1 Main St, Springfield, IL 62704")?.partial === "62704");
ok("ZIP at the end", pc("1 Main St, Springfield 62704, USA")?.partial === "62704");
ok("FSA from a full Canadian code, any spacing/case", pc("k1a0b1", true)?.partial === "K1A" && pc("Ottawa ON K1A 0B1")?.full === "K1A 0B1");
ok("an FSA-only field is an FSA", pc("K2P", true)?.partial === "K2P");
ok("an FSA-looking word in an address is not", pc("Apt K2P please") === null);
ok("a UK postcode is not shared at all", postalForAgency({ candidates: [{ value: "SW1A 1AA", field: true }] }).postalCode === null);
ok("full only when the switch is on", postalForAgency({ candidates: [{ value: "K1A 0B1", field: true }], full: true }).postalCode === "K1A 0B1");

// ── 7. REST hooks: retries, 410, stage changes ─────────────────────────────
section("7. REST hooks: retry with backoff, 410 ends the subscription");
const subQ = await api.subscribeHook({ db, companyId: A, key: { id: KEY_A.id }, body: { event: "quote.accepted", targetUrl: "https://hooks.zapier.com/hooks/standard/1/def" }, now: clock });
tick(60_000);
await db.quote.update({ where: { id: quoteA.id }, data: { status: "accepted", acceptedAt: clock, acceptedTotal: 4000 } });
await sweepCompanyEvents({ db, companyId: A, now: clock });
answer = 500;
const r1 = await deliverDue({ db, companyId: A, now: clock, fetchImpl });
ok("a 500 is retried, not dropped", r1.retried === 1, r1);
const dlv = (await db.agencyHookDelivery.findMany({ where: { subscriptionId: subQ.body.id } }))[0];
ok("… attempts 1, next attempt a minute later, the status logged", dlv.attempts === 1 && dlv.status === "pending" && dlv.lastStatusCode === 500 && dlv.nextAttemptAt.getTime() === clock.getTime() + 60_000);
ok("nothing is sent before it is due", (await deliverDue({ db, companyId: A, now: clock, fetchImpl })).due === 0);
ok("the backoff ends: no attempt after the last", nextAttemptAfter(MAX_ATTEMPTS) === null && nextAttemptAfter(1) instanceof Date);
tick(61_000);
answer = 200;
const r2 = await deliverDue({ db, companyId: A, now: clock, fetchImpl });
const accepted = posted[posted.length - 1].body;
ok("the retry delivers quote.accepted", r2.delivered === 1 && accepted.event === "quote.accepted");
ok("… with the won amount (job values shared)", accepted.data.wonAmount === 4000 && accepted.lead.wonAmount === 4000);
tick(60_000);
await db.leadRequest.create({ data: { companyId: A, name: "Eve Ng", email: "eve@example.com", source: "self_quote", createdAt: clock, updatedAt: clock } });
await db.leadRequest.create({ data: { companyId: A, name: "Fay Ho", email: "fay@example.com", source: "self_quote", createdAt: clock, updatedAt: clock } });
await sweepCompanyEvents({ db, companyId: A, now: clock });
answer = 410;
const r3 = await deliverDue({ db, companyId: A, now: clock, fetchImpl });
ok("Zapier's 410 → gone", r3.gone === 1, r3);
const ended = await db.agencyHookSubscription.findFirst({ where: { id: sub.body.id } });
ok("… the subscription is ended (gone_410)", ended.endedAt && ended.endedReason === "gone_410");
ok("… and its other pending delivery cancelled, never sent", r3.cancelled === 1 && (await db.agencyHookDelivery.findMany({ where: { subscriptionId: sub.body.id, status: "pending" } })).length === 0, r3);
answer = 200;

section("7b. lead.stage_changed reports a true from → to");
const subS = await api.subscribeHook({ db, companyId: A, key: { id: KEY_A.id }, body: { event: "lead.stage_changed", targetUrl: "https://hooks.zapier.com/hooks/standard/1/ghi" }, now: clock });
tick(60_000);
await sweepCompanyEvents({ db, companyId: A, now: clock });
ok("existing leads get a silent baseline, nothing sent", (await deliverDue({ db, companyId: A, now: clock, fetchImpl })).delivered === 0);
await db.leadRequest.update({ where: { id: leadNew.id }, data: { status: "contacted" } });
tick(60_000);
await sweepCompanyEvents({ db, companyId: A, now: clock });
await deliverDue({ db, companyId: A, now: clock, fetchImpl });
const stageMsg = posted[posted.length - 1].body;
ok("new → contacted delivered", stageMsg.event === "lead.stage_changed" && stageMsg.data.fromStage === "new" && stageMsg.data.toStage === "contacted", stageMsg.data);
await db.leadRequest.update({ where: { id: leadNew.id }, data: { status: "lost", lostReason: "price_too_high" } });
tick(60_000);
await sweepCompanyEvents({ db, companyId: A, now: clock });
await deliverDue({ db, companyId: A, now: clock, fetchImpl });
ok("contacted → lost, from the outbox's memory", posted[posted.length - 1].body.data.fromStage === "contacted" && posted[posted.length - 1].body.lead.lostReason === "price_too_high");
ok("unsubscribe by another company's key → 404", (await api.unsubscribeHook({ db, companyId: B, key: { id: keyB.body.key.id }, id: subS.body.id, now: clock })).status === 404);
ok("unsubscribe by another key at the same company → 404", (await api.unsubscribeHook({ db, companyId: A, key: { id: writer.body.key.id }, id: subS.body.id, now: clock })).status === 404);
ok("unsubscribe by its own key → ended", (await api.unsubscribeHook({ db, companyId: A, key: { id: KEY_A.id }, id: subS.body.id, now: clock })).body.ended === true);
ok("an unknown event is refused", (await api.subscribeHook({ db, companyId: A, key: { id: KEY_A.id }, body: { event: "lead.deleted", targetUrl: "https://hooks.zapier.com/x" } })).status === 400);
ok("every event is described for the docs", EVENTS.every((e) => EVENT_DESCRIPTIONS[e]));
ok("there is no messaging event or action", !EVENTS.some((e) => /message|sms|text|email/.test(e)));

// ── 8. The agency's own funnel ─────────────────────────────────────────────
section("8. Inbound leads: created through the lead path, deduplicated");
const createLead = async (input) =>
  db.leadRequest.create({ data: { companyId: input.companyId, name: input.name, email: input.email, phone: input.phone, source: input.source, message: input.message, intake: input.intake, attribution: input.attribution, temperature: "warm", createdAt: clock, updatedAt: clock } });
const keyW = { id: writer.body.key.id, name: "Pulse funnel" };
const in1 = await api.createAgencyLead({
  db, companyId: A, key: keyW, now: clock, deps: { createLead },
  body: { firstName: "Gus", lastName: "Hill", email: "Gus@Example.com", phone: "(613) 555-0199", service: "Deck staining", utmSource: "facebook", utmCampaign: "Spring decks", campaignId: "120200000000000009", fbclid: "IwAR0abcdefgh", postalCode: "K1S 5B6" },
});
ok("created (201) as an agency_funnel lead", in1.status === 201 && in1.body.created && in1.body.lead.channel === "agency_funnel", in1.body);
ok("its attribution is kept: campaign id, fbclid", in1.body.lead.campaignId === "120200000000000009" && in1.body.lead.fbclid === "IwAR0abcdefgh");
ok("its answer is privacy-safe too", hasNoPii(in1.body.lead) && in1.body.lead.firstName === "Gus" && in1.body.lead.postalCode === "K1S");
const logged = await db.activityLog.findMany({ where: { companyId: A, action: "lead.created_by_agency" } });
ok("the company's activity log names the agency", logged.length === 1 && /Pulse funnel/.test(logged[0].actorName));
// 2026-10-09: the key is stamped on the lead itself, for the board's badge.
const gusStored = (await db.leadRequest.findMany({ where: { companyId: A, source: "agency_funnel" } }))[0];
ok("the lead records WHICH key sent it: intake.agencyKey { id, name }",
  gusStored?.intake?.agencyKey?.id === keyW.id && gusStored.intake.agencyKey.name === "Pulse funnel", gusStored?.intake);
ok("…and only those two — never the secret, never the hash",
  JSON.stringify(Object.keys(gusStored?.intake?.agencyKey || {})) === '["id","name"]' && !JSON.stringify(gusStored).includes(SECRET_W));
ok("…and the board's badge reads the name back", agencyBadgeOf(gusStored)?.name === "Pulse funnel");
ok("…while the rest of the intake is what the agency sent", gusStored?.intake?.service === "Deck staining" && gusStored.intake.capturedBy === "agency_funnel");
const dupEmail = await api.createAgencyLead({ db, companyId: A, key: keyW, now: clock, deps: { createLead }, body: { name: "Gus H", email: "gus@example.com" } });
ok("same email → duplicate, no second lead", dupEmail.status === 200 && dupEmail.body.duplicate === true && dupEmail.body.lead.ref === in1.body.lead.ref);
const dupPhone = await api.createAgencyLead({ db, companyId: A, key: keyW, now: clock, deps: { createLead }, body: { name: "G Hill", phone: "+1 613-555-0199" } });
ok("same phone, other formatting → duplicate", dupPhone.body.duplicate === true && dupPhone.body.matchedOn.includes("phone"), dupPhone.body);
const known = await api.createAgencyLead({ db, companyId: B, key: { id: keyB.body.key.id, name: "Other agency" }, now: clock, deps: { createLead }, body: { name: "Gus Hill", email: "gus@example.com" } });
ok("another company's identical lead is NOT a duplicate here", known.status === 201);
ok("no email and no phone → 400", (await api.createAgencyLead({ db, companyId: A, key: keyW, now: clock, deps: { createLead }, body: { name: "Nobody" } })).status === 400);
ok("a read-only key cannot create (scope)", (await resolveAgencyKey(db, req(SECRET_A), { scope: "marketing:write_leads", now: clock })).refusal.status === 403);

// ── 9. Move stage, requested visit, find by contact ────────────────────────
section("9. Write actions obey the pipeline; find-by-contact stays private");
const gusRef = in1.body.lead.ref;
const nudge = () => {};
ok("won with no accepted quote → 409", (await api.moveLeadStage({ db, companyId: A, key: keyW, ref: gusRef, body: { stage: "won" }, now: clock, deps: { nudge } })).status === 409);
ok("lost without a reason → 409", (await api.moveLeadStage({ db, companyId: A, key: keyW, ref: gusRef, body: { stage: "lost" }, now: clock, deps: { nudge } })).status === 409);
ok("an invented lost reason → 400", (await api.moveLeadStage({ db, companyId: A, key: keyW, ref: gusRef, body: { stage: "lost", lostReason: "ghosted" }, now: clock, deps: { nudge } })).status === 400);
const moved = await api.moveLeadStage({ db, companyId: A, key: keyW, ref: gusRef, body: { stage: "contacted" }, now: clock, deps: { nudge } });
ok("new → contacted allowed", moved.status === 200 && moved.body.lead.pipelineStatus === "contacted");
ok("Ana (accepted quote) may be moved to won", (await api.moveLeadStage({ db, companyId: A, key: keyW, ref: rowA.ref, body: { stage: "won" }, now: clock, deps: { nudge } })).body.lead.pipelineStatus === "converted");
ok("another company's lead → 404", (await api.moveLeadStage({ db, companyId: B, key: keyW, ref: gusRef, body: { stage: "contacted" }, now: clock, deps: { nudge } })).status === 404);
const win = { from: new Date(clock.getTime() + 2 * 86400000).toISOString(), to: new Date(clock.getTime() + 3 * 86400000).toISOString() };
const vis = await api.updateRequestedVisit({ db, companyId: A, key: keyW, ref: gusRef, body: win, now: clock, deps: { nudge } });
ok("the requested window is stored and returned", vis.status === 200 && vis.body.lead.requestedVisitFrom === win.from);
ok("a window in the past is refused", (await api.updateRequestedVisit({ db, companyId: A, key: keyW, ref: gusRef, body: { from: "2020-01-01T10:00:00Z", to: "2020-01-02T10:00:00Z" }, now: clock, deps: { nudge } })).status === 400);
ok("a booked visit is never changed → 409", (await api.updateRequestedVisit({ db, companyId: A, key: keyW, ref: rowA.ref, body: win, now: clock, deps: { nudge } })).status === 409);
const found = await api.findLeadsByContact({ db, companyId: A, query: q({ phone: "613.555.0199" }), now: clock });
ok("find by phone (any formatting) → the lead", found.body.leads.length === 1 && found.body.leads[0].ref === gusRef);
ok("… privacy-safe", hasNoPii(found.body.leads[0]));
ok("find by email across companies → only this company's", (await api.findLeadsByContact({ db, companyId: A, query: q({ email: "zed@example.com" }), now: clock })).body.leads.length === 0);
ok("find with nothing to search by → 400", (await api.findLeadsByContact({ db, companyId: A, query: q({}), now: clock })).status === 400);

// ── 10. Target URLs; revoking ──────────────────────────────────────────────
section("10. Target URLs, and revoking a key");
ok("https Zapier hook accepted", cleanTargetUrl("https://hooks.zapier.com/hooks/standard/1/abc") !== null);
for (const bad of ["http://hooks.zapier.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://[::1]/x", "https://10.0.0.5/x", "https://169.254.169.254/latest", "https://intranet/x", "https://metadata.google.internal/x", "https://user:pw@hooks.zapier.com/x", "https://hooks.zapier.com:8443/x", "javascript:alert(1)"]) {
  ok(`refused: ${bad}`, cleanTargetUrl(bad) === null);
}
const subLive = await api.subscribeHook({ db, companyId: A, key: { id: KEY_A.id }, body: { event: "quote.sent", targetUrl: "https://hooks.zapier.com/hooks/standard/1/jkl" }, now: clock });
ok("a private target is refused at subscribe", (await api.subscribeHook({ db, companyId: A, key: { id: KEY_A.id }, body: { event: "quote.sent", targetUrl: "https://192.168.1.1/x" } })).status === 400);
const rev = await settings.revokeAgencyKey(db, owner, KEY_A.id, { now: clock });
ok("the owner revokes the key", rev.status === 200 && rev.body.key.revokedAt);
const afterRevoke = await resolveAgencyKey(db, req(SECRET_A), { scope: "marketing:read", now: clock });
ok("a revoked key → 401 key_revoked", afterRevoke.refusal?.status === 401 && afterRevoke.refusal.body.code === "key_revoked");
ok("its subscriptions ended (key_revoked)", (await db.agencyHookSubscription.findFirst({ where: { id: subLive.body.id } })).endedReason === "key_revoked");
ok("the row stays — revoked, not deleted", (await db.agencyAccessKey.findMany({ where: { companyId: A } })).length === 2);
ok("B's owner cannot revoke A's key", (await settings.revokeAgencyKey(db, ownerB, writer.body.key.id)).status === 404);

// ── 10b. The agency as a TEAM MEMBER: Marketing › Leads ───────────────────
//
// GET /api/marketing/leads answers from memberLeadRows: the same buildLeadRow
// rows, the same two switches, narrowed to the leads marketing brought in.
section("10b. Marketing › Leads for the agency team member (memberLeadRows)");
{
  await db.leadRequest.create({ data: { companyId: A, name: "Hal Organic", email: "hal@example.com", phone: "+16135550101", source: "manual", createdAt: clock, updatedAt: clock } });
  await db.leadRequest.create({ data: { companyId: A, name: "Ivy Referral", email: "ivy@example.com", source: "referral", createdAt: clock, updatedAt: clock } });
  await db.leadRequest.create({ data: { companyId: A, name: "Jo Phone", phone: "+16135550102", source: "phone_agent", createdAt: clock, updatedAt: clock } });
  const off = await api.memberLeadRows({ db, companyId: A, now: clock });
  const names = off.body.leads.map((r) => r.firstName);
  ok("200, with the sharing switches stated", off.status === 200 && off.body.sharing.contactDetails === false && off.body.sharing.jobValues === true, off.body.sharing);
  ok("only the leads marketing brought in", off.body.leads.length > 0 && off.body.leads.every((r) => MARKETING_CHANNELS.includes(r.channel)), off.body.leads.map((r) => r.channel));
  ok("…the Meta lead form and the agency's funnel among them", names.includes("Ana") && names.includes("Gus"), names);
  ok("…never a phone call, a staff-typed lead or a referral", !names.some((n) => ["Hal", "Ivy", "Jo"].includes(n)), names);
  ok("…and never another company's", !names.includes("Zed"));
  ok("contact sharing off: first name only, no surname/phone/email/street on any row", off.body.leads.every(hasNoPii));
  ok("the row is buildLeadRow's, key for key", off.body.leads.every((r) => JSON.stringify(Object.keys(r)) === JSON.stringify(LEAD_ROW_KEYS)));
  await settings.setAgencySharing(db, owner, { contactDetails: true });
  const on = await api.memberLeadRows({ db, companyId: A, now: clock });
  const ana = on.body.leads.find((r) => r.firstName === "Ana");
  ok("contact sharing on: the phone and email arrive", ana?.phone === "613-555-0142" && ana?.email === "ana@example.com" && on.body.sharing.contactDetails === true);
  await settings.setAgencySharing(db, owner, { contactDetails: false, jobValues: false });
  const noMoney = await api.memberLeadRows({ db, companyId: A, now: clock });
  ok("job values off: every money field null", noMoney.body.leads.every((r) => MONEY_KEYS.every((k) => r[k] === null)));
  await settings.setAgencySharing(db, owner, { jobValues: true });
  const rowsB = await api.memberLeadRows({ db, companyId: B, now: clock });
  const refsA = new Set(off.body.leads.map((r) => r.ref));
  ok("company B's member sees B's marketing leads only (Zed, never one of A's refs)",
    rowsB.body.leads.some((r) => r.firstName === "Zed") && rowsB.body.leads.every((r) => !refsA.has(r.ref)), rowsB.body.leads.map((r) => r.firstName));
}

// ── Pure helpers ───────────────────────────────────────────────────────────
section("Pure helpers");
ok("first name only", firstNameOf("Ana Maria Lopez") === "Ana" && firstNameOf("ana@example.com") === null && firstNameOf("+1 613 555 0142") === null);
ok("a decline reason is scrubbed of contact details", scrubContactDetails("Call me at 613-555-0142 or ana@example.com") === "Call me at [phone] or [email]", scrubContactDetails("Call me at 613-555-0142 or ana@example.com"));
ok("refs are Crockford, display is L-XXXX", isLeadRef(newLeadRef()) && displayRef("lr_0123456789ABCDEF") === "L-CDEF" && resolveRefQuery("l-cdef").suffix === "CDEF");
ok("a thread that began on an Instagram ad is instagram_ad", channelOf({ source: "meta_instagram" }, { platform: "instagram", origin: "ad" }) === "instagram_ad");
ok("a gclid landing is google_ads", channelOf({ source: "self_quote", attribution: { clickNetwork: "google_ads" } }) === "google_ads");
ok("a plain website form is website", channelOf({ source: "self_quote", attribution: { source: "direct" } }) === "website");
ok("a phone call is organic", channelOf({ source: "phone_agent" }) === "organic");
const rowShape = buildLeadRow({ id: "x", ref: newLeadRef(), name: "Kim Lee", email: "k@x.com", phone: "1", createdAt: new Date() }, { shareContacts: false });
ok("buildLeadRow defaults to private", rowShape.fullName === null && rowShape.email === null && rowShape.phone === null);

ok("no handler ran an unscoped query on a tenant table", unscoped.length === 0, unscoped);

// ── The Zapier app and the OpenAPI file stay in step with the API ─────────
section("11. The Zapier app (integrations/zapier) and the OpenAPI file");
{
  const { createRequire } = await import("node:module");
  // CommonJS files of the Zapier project, loaded by absolute path (they are
  // not part of the app's import graph — scripts/check-imports.mjs reads
  // literal specifiers, and these resolve against integrations/zapier).
  const zapier = (rel) => createRequire(import.meta.url)(join(ROOT, "integrations/zapier", rel));
  const zEvents = zapier("triggers/events.js").EVENTS.map((e) => e[0]);
  const zFields = zapier("lib.js").LEAD_FIELDS.map((f) => f[0]);
  const zCreates = zapier("creates/leads.js").creates.map((c) => c.key);
  const zSearches = zapier("searches/leads.js").searches.map((s) => s.key);
  ok("the Zapier triggers are exactly the API's events", JSON.stringify([...zEvents].sort()) === JSON.stringify([...EVENTS].sort()), zEvents);
  ok("the Zapier lead fields are exactly the API's lead row", JSON.stringify(zFields) === JSON.stringify(LEAD_ROW_KEYS), zFields.filter((k) => !LEAD_ROW_KEYS.includes(k)));
  ok("actions: Create Lead, Move Lead to Stage, Update Appointment Request", JSON.stringify(zCreates) === JSON.stringify(["create_lead", "move_lead_stage", "update_appointment_request"]));
  ok("searches: by reference, by email or phone", JSON.stringify(zSearches) === JSON.stringify(["find_lead_by_ref", "find_lead_by_contact"]));
  ok("no Zapier action messages a client", ![...zCreates, ...zSearches].some((k) => /message|sms|text|email_client|notify/.test(k)));
  ok("the Zapier auth test calls /me", /path: "\/me"/.test(readFileSync(join(ROOT, "integrations/zapier/index.js"), "utf8")));
  const { buildOpenApi, LEAD_FIELD_DOCS } = await import("@/lib/agency/openapi");
  const spec = buildOpenApi();
  ok("OpenAPI lists every event", JSON.stringify(spec["x-events"].map((e) => e.event)) === JSON.stringify(EVENTS));
  ok("OpenAPI documents every lead field", LEAD_ROW_KEYS.every((k) => LEAD_FIELD_DOCS[k] && spec.components.schemas.Lead.properties[k]));
  ok("OpenAPI has every route the app serves", ["/me", "/marketing/metrics", "/marketing/funnel", "/marketing/leads", "/marketing/leads/search", "/marketing/leads/{ref}", "/marketing/leads/{ref}/stage", "/marketing/leads/{ref}/requested-visit", "/hooks/subscribe", "/hooks/{id}", "/hooks/samples/{event}"].every((p) => spec.paths[p]));
}

// ── Mutation pass — the privacy boundary ───────────────────────────────────
if (!MUTANT && fails.length) console.log("\nMutation pass skipped: the baseline fails.");
if (!MUTANT && !fails.length) {
  console.log("\nMutation pass — each change must fail this check");
  const MUTATIONS = [
    ["lib/agency/leadRow.js", "contact switch ignored", "const contacts = shareContacts === true;", "const contacts = true;"],
    ["lib/agency/leadRow.js", "full surname leaks", "firstName: firstNameOf(fact.name),", "firstName: fact.name,"],
    ["lib/agency/leadRow.js", "money switch ignored", "const withMoney = shareMoney !== false;", "const withMoney = true;"],
    ["lib/agency/postal.js", "full postal code always", "postalCode: full ? hit.full : hit.partial", "postalCode: hit.full"],
    ["lib/agency/apiAuth.js", "scope not checked", "if (scope && !keyHasScope(key, scope)) {", "if (false) {"],
    ["lib/agency/apiAuth.js", "revoked key accepted", "  if (key.revokedAt) {", "  if (false) {"],
    ["lib/agency/api.js", "lead lookup not tenant-scoped", "lead = await db.leadRequest.findFirst({ where: { companyId, agencyRef: q.ref }, select: { id: true } });", "lead = await db.leadRequest.findFirst({ where: { agencyRef: q.ref }, select: { id: true } });"],
    ["lib/agency/delivery.js", "410 not honoured", 'if (status === 410) return "gone";', ""],
    ["lib/agency/events.js", "history backfilled at subscribe", "if (!start || e.occurredAt < start) continue;", "if (!start) continue;"],
    ["lib/agency/settings.js", "support session may create keys", "  if (member?.impersonation) return SUPPORT_READ_ONLY;\n  if (!canManageAgencyAccess(member)) return NOT_ALLOWED;", "  if (!member) return NOT_ALLOWED;"],
    ["lib/agency/delivery.js", "private targets allowed", 'if (u.protocol !== "https:") return null;', ""],
    // 2026-10-09: the key stamp, and the team member's lead list.
    ["lib/agency/api.js", "agency key not stamped on the lead", "intake: stamp ? { ...lead.intake, agencyKey: stamp } : lead.intake", "intake: lead.intake"],
    ["lib/agency/api.js", "member rows not narrowed to marketing", "facts.filter((f) => MARKETING_CHANNELS.includes(f.channel))", "facts.filter(() => true)"],
    ["lib/agency/api.js", "member rows ignore the sharing switches", "leads: list.slice(0, MEMBER_ROWS).map((f) => rowOf(f, sharing, now)),", "leads: list.slice(0, MEMBER_ROWS).map((f) => rowOf(f, { ...sharing, shareContacts: true }, now)),"],
  ];
  const backupDir = join(ROOT, ".mutation-backup-agency-api");
  mkdirSync(backupDir, { recursive: true });
  const escaped = [];
  let caught = 0;
  try {
    for (const [file, label, from, to] of MUTATIONS) {
      const path = join(ROOT, file);
      const backup = join(backupDir, file.replace(/\//g, "__"));
      copyFileSync(path, backup);
      const original = readFileSync(path, "utf8");
      if (!original.includes(from)) {
        escaped.push(`${label} — mutation target not found`);
        continue;
      }
      writeFileSync(path, original.replace(from, to));
      let survived = false;
      try {
        execFileSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "--import", "./scripts/db-stub-loader.mjs", "scripts/check-agency-api.mjs", "--mutant"], { cwd: ROOT, stdio: "pipe" });
        survived = true;
      } catch {
        survived = false;
      } finally {
        copyFileSync(backup, path);
      }
      if (survived) escaped.push(`${label} — NOT caught`);
      else {
        caught++;
        console.log(`  ✓ caught: ${label}`);
      }
    }
  } finally {
    rmSync(backupDir, { recursive: true, force: true });
  }
  ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
}

if (!MUTANT) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
}
process.exit(fails.length ? 1 : 0);
