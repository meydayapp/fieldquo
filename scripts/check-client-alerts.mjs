// scripts/check-client-alerts.mjs
//
// "Tell me when the client acts" — the owner, 2026-10-14: "is there a way for
// a company to be notified when the client has opened the quote?", then "yes
// and as a text message as optional in the notifications (send me a text when
// the client has opened / approved a quote / change order / request)".
//
// EXECUTES every event path with stubs — the real route handlers, the real
// notifyEvent, the real resolver, the real channel plan and the real text
// builder — against an in-memory database of two companies, with Twilio,
// Resend and Web Push replaced by recorders (nothing is ever sent). Proves:
//
//   1. the first client open alerts; a staff preview, a prefetch, a bot and a
//      support session do not; a re-open inside 24 h does not; after 24 h it
//      does, with the right count ("3rd time");
//   2. a quote approval, a change-order approval and a new portal request
//      alert, through their real public routes;
//   3. a text goes only to somebody who opted in, has a number, has not
//      replied STOP, and is under the daily cap — and every one is recorded;
//   4. no amount reaches a member without showPricing, by fan-out AND by the
//      text builder on its own;
//   5. another company's member is never alerted, whatever they opted into;
//   6. the company switch silences every channel; a person's bell switch
//      silences only their bell;
//   7. the settings route refuses a switch that could never fire, a text
//      with no number, and a support session;
//   8. a STOP from a staff phone is recorded for that company;
//   9. every word is in all nine app languages;
//  10. a new enquiry (2026-11-03) texts the person who asked for one with the
//      name, phone, email, what they want and a link to THAT lead — read
//      fresh at send time, never stored on the feed row; the company switch
//      silences every channel; a lead holding nothing but a name produces a
//      text with no holes in it; and the enricher survives a 300-character
//      name, an email with no "@" and null everything;
//  11. the company's named enquiry owner is assigned every new lead and
//      alerted about it, adds a recipient and removes none, is offered only
//      from people the alert can reach, and degrades to nobody when they
//      leave — with no history import and no booking-made lead assigned;
//  12. mutations of the shipped code are caught.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-client-alerts.mjs

import { register } from "node:module";
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

let pass = 0;
const fails = [];
const ok = (cond, label, got) => {
  if (cond) pass++;
  else fails.push(`${label}${got !== undefined ? `  got: ${JSON.stringify(got)?.slice(0, 400)}` : ""}`);
};
const section = (t) => console.log(`\n${t}`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
// The in-memory database
// ═══════════════════════════════════════════════════════════════════════════

const ROWS = {};
const table = (name) => (ROWS[name] ||= []);
let seq = 0;
const UNIQUE = { notificationDelivery: ["eventId", "memberId"], memberAlertPreference: ["memberId", "event"] };

function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where || {})) {
    if (cond === undefined) continue;
    if (key === "OR") {
      if (!cond.some((w) => matchWhere(row, w))) return false;
      continue;
    }
    if (key === "NOT") {
      if (matchWhere(row, cond)) return false;
      continue;
    }
    let value = row[key];
    // A compound unique key (companyId_e164, memberId_event).
    if (value === undefined && key.includes("_") && cond && typeof cond === "object" && !(cond instanceof Date)) {
      if (!matchWhere(row, cond)) return false;
      continue;
    }
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("gte" in cond || "lt" in cond || "lte" in cond || "gt" in cond) {
        const v = new Date(value).getTime();
        if ("gte" in cond && !(v >= new Date(cond.gte).getTime())) return false;
        if ("gt" in cond && !(v > new Date(cond.gt).getTime())) return false;
        if ("lt" in cond && !(v < new Date(cond.lt).getTime())) return false;
        if ("lte" in cond && !(v <= new Date(cond.lte).getTime())) return false;
        continue;
      }
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

const WRITES = [];
function model(name) {
  const rows = () => table(name);
  return {
    async findMany(a = {}) {
      let list = rows().filter((r) => matchWhere(r, a.where));
      if (a.distinct) {
        const seen = new Set();
        list = list.filter((r) => {
          const k = a.distinct.map((d) => r[d]).join("|");
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
      if (a.take) list = list.slice(0, a.take);
      return list;
    },
    async findFirst(a = {}) {
      return rows().find((r) => matchWhere(r, a.where)) || null;
    },
    async findUnique(a = {}) {
      return rows().find((r) => matchWhere(r, a.where)) || null;
    },
    async count(a = {}) {
      return rows().filter((r) => matchWhere(r, a.where)).length;
    },
    async create(a = {}) {
      WRITES.push({ model: name, action: "create", data: a.data });
      const row = { id: `${name}_${++seq}`, createdAt: new Date(), ...a.data };
      rows().push(row);
      return row;
    },
    async createMany(a = {}) {
      WRITES.push({ model: name, action: "createMany", data: a.data });
      let count = 0;
      for (const d of a.data || []) {
        const keys = UNIQUE[name];
        if (keys && rows().some((r) => keys.every((k) => r[k] === d[k]))) {
          if (a.skipDuplicates) continue;
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        rows().push({ id: `${name}_${++seq}`, createdAt: new Date(), ...d });
        count++;
      }
      return { count };
    },
    async update(a = {}) {
      const row = rows().find((r) => matchWhere(r, a.where));
      if (!row) throw Object.assign(new Error(`${name}: no row to update`), { code: "P2025" });
      WRITES.push({ model: name, action: "update", where: a.where, data: a.data });
      Object.assign(row, a.data);
      return row;
    },
    async updateMany(a = {}) {
      const hits = rows().filter((r) => matchWhere(r, a.where));
      WRITES.push({ model: name, action: "updateMany", where: a.where, data: a.data });
      for (const r of hits) Object.assign(r, a.data);
      return { count: hits.length };
    },
    async upsert(a = {}) {
      const row = rows().find((r) => matchWhere(r, a.where));
      WRITES.push({ model: name, action: "upsert", where: a.where, data: row ? a.update : a.create });
      if (row) {
        Object.assign(row, a.update);
        return row;
      }
      const created = { id: `${name}_${++seq}`, createdAt: new Date(), ...a.create };
      rows().push(created);
      return created;
    },
  };
}

const RAW = [];
async function raw(strings, ...values) {
  const sql = strings.join("?");
  RAW.push({ sql, values });
  // The view counter (POST /api/public/quotes/[token]/viewed).
  if (sql.includes(`"viewCount" = "viewCount" + 1`)) {
    const q = table("quote").find((r) => r.id === values[0]);
    if (!q || q.status === "draft") return [];
    q.viewCount = (q.viewCount || 0) + 1;
    q.viewedAt = q.viewedAt || new Date();
    return [{ viewCount: q.viewCount }];
  }
  // The alert claim (lib/quotes/viewAlert.js claimViewAlert): the SQL's own
  // predicate, with the GAP the product passed — so a product change to the
  // window is a change to what this executes.
  if (sql.includes(`SET "viewAlertedAt" = NOW()`)) {
    const [id, hours] = values;
    const q = table("quote").find((r) => r.id === id);
    if (!q) return 0;
    const cutoff = Date.now() - Number(hours) * 3600 * 1000;
    if (q.viewAlertedAt == null || new Date(q.viewAlertedAt).getTime() <= cutoff) {
      q.viewAlertedAt = new Date();
      return 1;
    }
    return 0;
  }
  // The staff-phone holders for an inbound STOP (lib/sms/clientLine.js).
  if (sql.includes(`FROM "Member" m`)) {
    const digits = String(values[0]).replace(/^%/, "");
    return [...new Set(table("member").filter((m) => m.active !== false && m.phone && m.phone.replace(/\D/g, "").endsWith(digits)).map((m) => m.companyId))].map((id) => ({ id }));
  }
  if (sql.includes(`FROM "Client" c`)) {
    const digits = String(values[0]).replace(/^%/, "");
    return [...new Set(table("client").filter((c) => c.phone && c.phone.replace(/\D/g, "").endsWith(digits)).map((c) => c.companyId))].map((id) => ({ id, name: id }));
  }
  throw new Error(`raw SQL not scripted: ${sql.slice(0, 120)}`);
}

globalThis.__DB = new Proxy(
  { $queryRaw: raw, $executeRaw: raw, $transaction: async (fn) => (typeof fn === "function" ? fn(globalThis.__DB) : Promise.all(fn)) },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop !== "string" || prop === "then") return undefined;
      return (target[prop] = model(prop));
    },
  },
);

// ── The recorders ──────────────────────────────────────────────────────────
globalThis.__SMS = [];
globalThis.__SMS_PLAN = [];
globalThis.__SEND_SMS = async (m) => {
  globalThis.__SMS.push(m);
  const planned = globalThis.__SMS_PLAN.shift();
  return planned || { success: true, sid: `SM${globalThis.__SMS.length}` };
};
globalThis.__MAIL = [];
globalThis.__SEND_MAIL = async (m) => (globalThis.__MAIL.push(m), { id: `re_${globalThis.__MAIL.length}` });
globalThis.__PUSHES = [];
globalThis.__AFTER = [];
globalThis.__ERRORS = [];
globalThis.__SESSION = null;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq:db",
  "@/lib/currentMember": "fq:member",
  "@/lib/apiMember": "fq:apimember",
  "next/server": "fq:next",
};
// Real modules with ONE export replaced — everything else they export stays
// the shipped code, so a sibling importer never finds a name missing.
const WRAP = {
  "/lib/sms/twilioClient.js": "fq:twilio",
  "/lib/notify/push.js": "fq:push",
  "/lib/email/resend.js": "fq:resend",
  "/lib/quotes/quoteLifecycle.js": "fq:lifecycle",
  "/lib/waivers/service.js": "fq:waivers",
  "/lib/jobs/changeOrderDecision.js": "fq:codecision",
  "/lib/subcontractors/sourceLink.js": "fq:sourcelink",
  "/lib/agency/nudge.js": "fq:nudge",
  "/lib/platform/errorLog.js": "fq:errlog",
  "/lib/activity/log.js": "fq:activity",
  "/lib/email/companySender.js": "fq:sender",
  "/lib/sms/verifyTwilioWebhook.js": "fq:twsig",
  "/lib/sales/salesSms.js": "fq:sales",
  "/lib/aiEmployee/smsChannel.js": "fq:smschannel",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  const r = await nextResolve(specifier, context);
  if (String(context.parentURL || "").startsWith("fq:") || r.url.includes("?real")) return r;
  for (const [suffix, id] of Object.entries(WRAP)) {
    if (r.url.endsWith(suffix)) return { url: id + ":" + encodeURIComponent(r.url), shortCircuit: true };
  }
  return r;
}
const mod = (source) => ({ format: "module", shortCircuit: true, source });
const real = (url) => JSON.stringify(decodeURIComponent(url.slice(url.indexOf(":", 3) + 1)) + "?real");
export async function load(url, context, nextLoad) {
  if (url === "fq:db") return mod("export const db = new Proxy({}, { get: (_t, p) => globalThis.__DB[p] });");
  if (url === "fq:member") return mod("export const getCurrentMember = async () => globalThis.__SESSION; export function assertMarketingAgencyScope() {}");
  if (url === "fq:apimember") return mod("export const memberOrRefusal = async () => globalThis.__SESSION ? { member: globalThis.__SESSION } : { response: { status: 401, body: { error: 'Unauthorized' }, json: async () => ({ error: 'Unauthorized' }) } }; export const memberOrRefusalPlain = async () => globalThis.__SESSION ? { member: globalThis.__SESSION } : { refusal: { error: 'Unauthorized', status: 401 } }; export const refusalBody = (e) => ({ error: e?.message });");
  if (url.startsWith("fq:nudge:")) return mod("export * from " + real(url) + "; export function nudgeAgencyEvents() {} export function nudgeAgencyEventsFor() {}");
  if (url.startsWith("fq:errlog:")) return mod("export * from " + real(url) + "; export async function recordError(e) { globalThis.__ERRORS.push(e); }");
  if (url.startsWith("fq:activity:")) return mod("export * from " + real(url) + "; export async function recordActivity() {}");
  if (url.startsWith("fq:lifecycle:")) return mod("export * from " + real(url) + "; export async function onQuoteAccepted() { return { job: null, invoice: null }; } export async function onQuoteDeclined() {}");
  if (url.startsWith("fq:waivers:")) return mod("export * from " + real(url) + "; export async function pendingWaiversForQuote() { return []; } export async function fileSignedWaiversForJob() {}");
  if (url.startsWith("fq:codecision:")) return mod("export * from " + real(url) + "; export async function applyChangeOrderDecision() {}");
  if (url.startsWith("fq:sourcelink:")) return mod("export * from " + real(url) + "; export async function syncForSourceJob() {}");
  if (url.startsWith("fq:twsig:")) return mod("export * from " + real(url) + "; export async function verifyTwilioWebhook(req) { return { ok: true, params: await req.formParams() }; }");
  if (url.startsWith("fq:sales:")) return mod("export * from " + real(url) + "; export async function handleSalesInboundSms() { return { handled: false }; }");
  if (url.startsWith("fq:smschannel:")) return mod("export * from " + real(url) + "; export async function handleInboundClientSms() {}");
  if (url.startsWith("fq:sender:")) return mod("export * from " + real(url) + "; export async function resolveSender(c) { return { from: 'Co <x@co.test>', replyTo: null }; } export async function ownerEmailFor() { return null; }");
  if (url === "fq:next") return mod("export class NextResponse { constructor(body, init) { this.body = body; this.status = init?.status ?? 200; } static json(body, init) { const r = new NextResponse(body, init); r.json = async () => body; return r; } } export function after(fn) { globalThis.__AFTER.push(Promise.resolve().then(fn)); }");
  if (url.startsWith("fq:twilio:")) return mod("export * from " + real(url) + "; export async function sendSms(a) { return globalThis.__SEND_SMS(a); }");
  if (url.startsWith("fq:push:")) return mod("export * from " + real(url) + "; export async function pushToUsers(a) { globalThis.__PUSHES.push(a); }");
  if (url.startsWith("fq:resend:")) return mod("export * from " + real(url) + "; export async function sendEmail(m) { return globalThis.__SEND_MAIL(m); }");
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

process.env.NEXT_PUBLIC_APP_URL = "https://app.fieldquo.test";

const viewedRoute = await import("@/app/api/public/quotes/[token]/viewed/route.js");
const quoteRoute = await import("@/app/api/public/quotes/[token]/route.js");
const changeOrderRoute = await import("@/app/api/public/change-orders/[token]/route.js");
const prefsRoute = await import("@/app/api/settings/alert-preferences/route.js");
const inboundRoute = await import("@/app/api/sms/inbound/route.js");
const { openTicket, emailOffice } = await import("@/lib/clientTickets/service.js");
const { sendStaffTexts } = await import("@/lib/notifications/staffTexts.js");
const {
  CLIENT_ALERTS,
  CLIENT_ALERT_EVENTS,
  STAFF_TEXT_DAILY_CAP,
  VIEW_ALERT_GAP_HOURS,
  channelAvailable,
  channelOn,
  viewAlertDue,
  amountForReader,
  validateAlertPatch,
} = await import("@/lib/notifications/clientAlerts.js");
const leadOwnerRoute = await import("@/app/api/settings/lead-owner/route.js");
const { createScoredLead } = await import("@/lib/leads/createLead.js");
const { leadOwnerMember, leadOwnerCandidates, withLeadOwner, mayOwnLeads } = await import("@/lib/notifications/leadOwner.js");
const { factsForReader, leadWant, leadPhoneLine, leadEmailLine } = await import("@/lib/notifications/alertFacts.js");
const { hrefFor } = await import("@/lib/notifications/render.js");
const { CLIENT_ALERT_COPY, staffAlertSms, smsSegments } = await import("@/lib/i18n/clientAlertCopy.js");
const { timesOrdinal, TIMES_ORDINAL_LANGUAGES } = await import("@/lib/i18n/timesOrdinal.js");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
const { LANGUAGE_CODES } = await import("@/app/i18n/languages.js");
const { TEAM_NOTICE_COPY } = await import("@/lib/i18n/teamNoticeCopy.js");
const { NOTIFICATION_TYPES } = await import("@/lib/notifications/catalog.js");
const { RULE_TYPES } = await import("@/app/api/settings/notification-rules/route.js");

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures — two companies
// ═══════════════════════════════════════════════════════════════════════════

const A = "co_a";
const B = "co_b";
const FULL = { quotes: "view_create_edit", jobs: "view_create_edit", requests: "view_create_edit", showPricing: true };
const NO_PRICES = { quotes: "view_create_edit", jobs: "view_create_edit", requests: "view_create_edit", showPricing: false };
const user = (id, name, language = null) => ({ id, name, email: `${id}@a.test`, language });

const PEOPLE = {
  olivia: { id: "m_olivia", userId: "u_olivia", companyId: A, role: "owner", active: true, permissions: null, phone: "(514) 555-0101", user: user("u_olivia", "Olivia Owner") },
  adam: { id: "m_adam", userId: "u_adam", companyId: A, role: "admin", active: true, permissions: null, phone: null, user: user("u_adam", "Adam Admin", "fr") },
  esme: { id: "m_esme", userId: "u_esme", companyId: A, role: "employee", active: true, permissions: FULL, phone: "514-555-0102", user: user("u_esme", "Esme Estimator", "es") },
  ned: { id: "m_ned", userId: "u_ned", companyId: A, role: "employee", active: true, permissions: NO_PRICES, phone: "514 555 0103", user: user("u_ned", "Ned NoPrices") },
  mia: { id: "m_mia", userId: "u_mia", companyId: A, role: "supervisor", active: true, permissions: { ...FULL, quotes: "view_only" }, phone: "514 555 0104", user: user("u_mia", "Mia Manager") },
  carl: { id: "m_carl", userId: "u_carl", companyId: A, role: "employee", active: true, permissions: { quotes: "none", jobs: "none", requests: "none", showPricing: false, schedule: "view_own" }, phone: "514 555 0105", user: user("u_carl", "Carl Crew") },
  // Company B's owner: phone, every text switched on. Must never hear a word
  // about company A.
  bob: { id: "m_bob", userId: "u_bob", companyId: B, role: "owner", active: true, permissions: null, phone: "416 555 0199", user: user("u_bob", "Bob OtherCo") },
};

const SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function reset() {
  for (const k of Object.keys(ROWS)) delete ROWS[k];
  WRITES.length = 0;
  RAW.length = 0;
  globalThis.__SMS.length = 0;
  globalThis.__SMS_PLAN.length = 0;
  globalThis.__MAIL.length = 0;
  globalThis.__PUSHES.length = 0;
  globalThis.__AFTER.length = 0;
  globalThis.__ERRORS.length = 0;
  globalThis.__SESSION = null;
  table("company").push(
    { id: A, name: "Northline Painting", defaultLanguage: "en", currency: "CAD", timezone: "America/Toronto" },
    { id: B, name: "OtherCo", defaultLanguage: "en", currency: "CAD", timezone: "America/Toronto" },
  );
  for (const p of Object.values(PEOPLE)) table("member").push(structuredClone(p));
  table("client").push({ id: "cl_1", companyId: A, name: "Maureen Faulkner", phone: "613 555 0177", email: "maureen@home.test", language: "en" });
  table("quote").push({
    id: "q_1",
    companyId: A,
    clientId: "cl_1",
    shareToken: "tok_q1",
    status: "sent",
    quoteNumber: "Q-2026-0022",
    createdById: "u_esme",
    assignedToId: "u_ned",
    viewCount: 0,
    viewedAt: null,
    viewAlertedAt: null,
    currency: "CAD",
    subtotal: 7900,
    tax: 1027,
    total: 8927,
    taxRate: 13,
    discount: 0,
    validUntil: null,
    language: "en",
    lineItems: [],
    scopeGroups: [],
    addOns: [],
    planOffers: [],
    client: { name: "Maureen Faulkner", email: "maureen@home.test", address: null, language: "en", type: "residential" },
    company: { id: A, name: "Northline Painting", currency: "CAD", defaultLanguage: "en" },
  });
}

/** Switch on a channel the way a person would — through the real settings route. */
async function choose(person, event, channel, on) {
  globalThis.__SESSION = { id: person.id, userId: person.userId, companyId: person.companyId, role: person.role };
  const res = await prefsRoute.PUT(jsonRequest({ event, channel, on }));
  globalThis.__SESSION = null;
  return res;
}
function jsonRequest(body, headers = {}) {
  return { headers: { get: (n) => headers[String(n).toLowerCase()] ?? null }, json: async () => body, url: "https://app.fieldquo.test/api/x" };
}
function viewRequest(headers = {}) {
  const h = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1", ...headers };
  return { headers: { get: (n) => h[String(n).toLowerCase()] ?? null } };
}
async function settle() {
  while (globalThis.__AFTER.length) await globalThis.__AFTER.shift();
}
const deliveriesFor = (type) => {
  const events = table("notificationEvent").filter((e) => e.type === type).map((e) => e.id);
  return table("notificationDelivery").filter((d) => events.includes(d.eventId));
};
const textsTo = (person) => globalThis.__SMS.filter((s) => s.to === `+1${person.phone.replace(/\D/g, "").slice(-10)}`);
const view = (headers) => viewedRoute.POST(viewRequest(headers), { params: Promise.resolve({ token: "tok_q1" }) });

// ═══════════════════════════════════════════════════════════════════════════
section("1. The tables are sound");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  CLIENT_ALERT_EVENTS.join(",") === "quote.viewed,quote.accepted,changeOrder.approved,client_ticket.opened,lead.created",
  "the five events: the four the owner named, and a new enquiry arriving",
  CLIENT_ALERT_EVENTS,
);
for (const e of CLIENT_ALERT_EVENTS) {
  ok(Boolean(NOTIFICATION_TYPES[e]), `${e} is a catalog type (the bell renders it)`);
  ok(Boolean(RULE_TYPES[CLIENT_ALERTS[e].rule]), `${e}'s company switch "${CLIENT_ALERTS[e].rule}" is a type the rules route accepts`);
  ok(channelOn(null, e, "inApp", { role: "employee" }) === true, `${e}: bell + push default ON`);
  ok(channelOn(null, e, "sms", { role: "owner" }) === false, `${e}: text default OFF, even for an owner`);
  ok(channelAvailable(e, "inApp") && channelAvailable(e, "sms"), `${e}: the bell and the text both exist`);
  // An email channel is offered only where something sends one. A tick box
  // for a message nobody sends is this repo's first failure class.
  ok(channelAvailable(e, "email") === Boolean(CLIENT_ALERTS[e].emailVia), `${e}: an email channel exactly when it has a sender`, CLIENT_ALERTS[e].emailVia);
}
ok(channelAvailable("lead.created", "email") === false, "a new enquiry has no email channel (nothing emails about one)");
ok(channelOn({ email: true }, "lead.created", "email", { role: "owner" }) === false, "…and a stored true cannot switch on a channel that does not exist");
ok(!validateAlertPatch({ event: "lead.created", channel: "email", on: true }).ok, "…the settings PUT refuses it by name", validateAlertPatch({ event: "lead.created", channel: "email", on: true }));
ok(validateAlertPatch({ event: "lead.created", channel: "sms", on: true }).ok, "…while the text it DOES have validates");
ok(channelOn(null, "quote.viewed", "email", { role: "owner" }) === false, "opened: email default OFF (noise)");
ok(channelOn(null, "quote.accepted", "email", { role: "owner" }) === true && channelOn(null, "quote.accepted", "email", { role: "admin" }) === true, "approved: email default ON for owners and admins — the email that already went");
ok(channelOn(null, "quote.accepted", "email", { role: "employee" }) === false, "…and OFF for anybody it never went to");
ok(channelOn({ email: false }, "quote.accepted", "email", { role: "owner" }) === false, "a stored false beats the default");
ok(channelOn({ sms: true }, "quote.viewed", "sms", { role: "employee" }) === true, "a stored true beats the default");
ok(channelOn({ sms: null }, "quote.viewed", "sms", { role: "owner" }) === false, "null is 'never chosen', not a choice");
ok(channelOn({ sms: true }, "quote.teleported", "sms", { role: "owner" }) === false && channelOn({ fax: true }, "quote.viewed", "fax", {}) === false, "an unknown event or channel is OFF");
ok(VIEW_ALERT_GAP_HOURS === 24 && STAFF_TEXT_DAILY_CAP === 20, "a day between re-open alerts; twenty texts a day", { VIEW_ALERT_GAP_HOURS, STAFF_TEXT_DAILY_CAP });
{
  const now = new Date("2026-10-14T12:00:00Z");
  ok(viewAlertDue({ lastAlertAt: null, now }), "never alerted → due");
  ok(!viewAlertDue({ lastAlertAt: new Date(now - 23.9 * 3600e3), now }), "23.9 h ago → not due");
  ok(viewAlertDue({ lastAlertAt: new Date(now - 24 * 3600e3), now }), "exactly 24 h → due");
  ok(viewAlertDue({ lastAlertAt: "garbage", now }), "an unreadable stamp does not block forever");
}
ok(validateAlertPatch({ event: "quote.viewed", channel: "sms", on: true }).ok, "a switch body validates");
ok(!validateAlertPatch({ event: "quote.viewed", channel: "sms", on: "yes" }).ok, "…'on' must be a boolean");
ok(!validateAlertPatch({ event: "quote.nope", channel: "sms", on: true }).ok && !validateAlertPatch({ event: "quote.viewed", channel: "pigeon", on: true }).ok, "…unknown event / channel refused by name");
ok(!validateAlertPatch(null).ok && !validateAlertPatch([]).ok, "…no body refused");

// ═══════════════════════════════════════════════════════════════════════════
section("2. The settings route — what a person can switch on");
// ═══════════════════════════════════════════════════════════════════════════

reset();
{
  globalThis.__SESSION = { id: PEOPLE.carl.id, userId: PEOPLE.carl.userId, companyId: A, role: "employee" };
  const g = await prefsRoute.GET(jsonRequest(null));
  const carlView = g.body.events.find((e) => e.event === "quote.viewed");
  ok(carlView && carlView.eligible === false, "crew with quotes: none sees 'opened' as not available — never a live box", carlView);
  const r = await choose(PEOPLE.carl, "quote.viewed", "sms", true);
  ok(r.status === 403, "…and the PUT refuses it", r.status);

  globalThis.__SESSION = { id: PEOPLE.ned.id, userId: PEOPLE.ned.userId, companyId: A, role: "employee" };
  const n = await prefsRoute.GET(jsonRequest(null));
  ok(n.body.events.find((e) => e.event === "quote.accepted").eligible === false, "an estimator without prices cannot switch on approval alerts (they carry an amount)");
  ok(n.body.events.find((e) => e.event === "quote.viewed").eligible === true && n.body.events.find((e) => e.event === "quote.viewed").ownOnly === true, "…but can for 'opened', marked 'only your own'");
  ok(n.body.canManageCompany === false, "…and sees no company switches");

  const adamNoPhone = await choose(PEOPLE.adam, "quote.viewed", "sms", true);
  ok(adamNoPhone.status === 400 && adamNoPhone.body.code === "phone_needed", "a text cannot be switched on with no number", adamNoPhone.body);

  globalThis.__SESSION = { id: PEOPLE.adam.id, userId: PEOPLE.adam.userId, companyId: A, role: "admin" };
  const bad = await prefsRoute.PUT(jsonRequest({ phone: "12" }));
  ok(bad.status === 400, "a phone that is not a phone is refused", bad.status);
  const good = await prefsRoute.PUT(jsonRequest({ phone: "(613) 555-0110" }));
  ok(good.status === 200 && table("member").find((m) => m.id === "m_adam").phone === "+16135550110", "a person sets their OWN number, stored as E.164", table("member").find((m) => m.id === "m_adam").phone);
  ok(table("member").filter((m) => m.phone === "+16135550110").length === 1, "…and only their own row moved");

  globalThis.__SESSION = { id: PEOPLE.olivia.id, userId: PEOPLE.olivia.userId, companyId: A, role: "owner", impersonation: { by: "support" } };
  const imp = await prefsRoute.PUT(jsonRequest({ event: "quote.viewed", channel: "sms", on: true }));
  ok(imp.status === 403, "a support session cannot switch anything", imp.status);
  globalThis.__SESSION = null;
  const owner = await choose(PEOPLE.olivia, "quote.viewed", "sms", true);
  ok(owner.status === 200 && owner.body.events.find((e) => e.event === "quote.viewed").channels.sms === true, "the owner switches on 'text me when a client opens a quote'");
  const pref = table("memberAlertPreference").find((p) => p.memberId === "m_olivia");
  ok(pref && pref.companyId === A && pref.sms === true && pref.email === undefined && pref.inApp === undefined, "…one channel written, the rest left unsaid (null = default)", pref);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The client opens the quote");
// ═══════════════════════════════════════════════════════════════════════════

async function optIns() {
  for (const e of CLIENT_ALERT_EVENTS) {
    await choose(PEOPLE.olivia, e, "sms", true);
    await choose(PEOPLE.bob, e, "sms", true);
  }
  await choose(PEOPLE.esme, "quote.viewed", "sms", true);
  await choose(PEOPLE.esme, "quote.accepted", "sms", true);
  await choose(PEOPLE.ned, "quote.viewed", "sms", true);
  await choose(PEOPLE.mia, "quote.viewed", "sms", true);
}

reset();
await optIns();
{
  // A staff member checking their own link: not recorded, not alerted.
  globalThis.__SESSION = { id: "m_esme", userId: "u_esme", companyId: A, role: "employee" };
  const staff = await view();
  globalThis.__SESSION = null;
  await settle();
  ok(staff.body.recorded === false && staff.body.reason === "staff", "staff preview: not recorded", staff.body);
  ok(table("notificationEvent").length === 0 && globalThis.__SMS.length === 0, "staff preview: no bell, no text");

  const pre = await view({ purpose: "prefetch" });
  await settle();
  ok(pre.body.recorded === false && pre.body.reason === "prefetch" && table("notificationEvent").length === 0 && globalThis.__SMS.length === 0, "prefetch: not recorded, nobody alerted", pre.body);

  const bot = await view({ "user-agent": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" });
  await settle();
  ok(bot.body.recorded === false && globalThis.__SMS.length === 0, "a link unfurler: not recorded, nobody alerted", bot.body);

  globalThis.__SESSION = { id: "m_x", userId: "u_x", companyId: B, role: "owner", impersonation: { by: "support" } };
  const imp = await view();
  globalThis.__SESSION = null;
  await settle();
  ok(imp.body.recorded === false && globalThis.__SMS.length === 0, "a support session: not recorded, nobody alerted", imp.body);

  // ── The client, the first time ──
  const first = await view();
  await settle();
  ok(first.body.recorded === true, "the client's first open is recorded", first.body);
  const ev = table("notificationEvent").filter((e) => e.type === "quote.viewed");
  ok(ev.length === 1 && ev[0].companyId === A && ev[0].entityId === "q_1" && ev[0].params.count === 1, "ONE alert, in company A, about the quote, count 1", ev);
  const to = deliveriesFor("quote.viewed").map((d) => d.memberId).sort();
  ok(JSON.stringify(to) === JSON.stringify(["m_adam", "m_esme", "m_ned", "m_olivia"]), "bell: the owner, the admin, the estimator who WROTE it and the one ASSIGNED — not the manager, not crew", to);
  ok(!to.includes("m_bob"), "never company B's owner");
  ok(globalThis.__PUSHES.length === 1 && globalThis.__PUSHES[0].userIds.sort().join(",") === "u_adam,u_esme,u_ned,u_olivia", "push: the same four people", globalThis.__PUSHES[0]?.userIds);
  const sentTo = globalThis.__SMS.map((s) => s.to).sort();
  ok(JSON.stringify(sentTo) === JSON.stringify(["+15145550101", "+15145550102", "+15145550103"]), "texts: exactly the three who opted in AND are on the quote or run the company (Mia opted in but did not write it)", sentTo);
  ok(!textsTo(PEOPLE.bob).length, "company B's owner, opted into everything, got nothing");
  const o = textsTo(PEOPLE.olivia)[0];
  ok(o && o.body.startsWith("FieldQuo: Maureen Faulkner opened quote Q-2026-0022.") && o.body.includes("https://app.fieldquo.test/app/quotes/q_1") && /Reply STOP/.test(o.body), "the owner's text says who, which quote, links to it, and how to stop", o?.body);
  ok(o && o.companyId === A && o.purpose === "staff_alert", "…sent on company A's behalf (demo + trial gates apply), filed as staff_alert", o);
  const e = textsTo(PEOPLE.esme)[0];
  ok(e && e.body.includes("abrió el presupuesto Q-2026-0022"), "the estimator reads it in HER language (es)", e?.body);
  const logged = table("staffAlertText").filter((r) => r.event === "quote.viewed" && r.status === "sent");
  ok(logged.length === 3 && logged.every((r) => r.companyId === A && r.sid && r.segments >= 1), "every text sent is recorded, with its SID and segments", logged);
  ok(table("quote")[0].viewAlertedAt instanceof Date, "the alert is stamped on the quote");
  ok(!globalThis.__MAIL.length, "nobody ticked email for 'opened' — no email (default OFF)");

  // ── Again, ten minutes later ──
  const before = globalThis.__SMS.length;
  const again = await view();
  await settle();
  ok(again.body.recorded === true && table("quote")[0].viewCount === 2, "a re-open is still COUNTED", table("quote")[0].viewCount);
  ok(table("notificationEvent").filter((x) => x.type === "quote.viewed").length === 1 && globalThis.__SMS.length === before, "…but inside 24 h it alerts nobody");

  // ── The next evening ──
  table("quote")[0].viewAlertedAt = new Date(Date.now() - 25 * 3600e3);
  const later = await view();
  await settle();
  const ev2 = table("notificationEvent").filter((x) => x.type === "quote.viewed");
  ok(ev2.length === 2 && ev2[1].params.count === 3, "after 24 h it alerts again, with the running count (3)", ev2.map((x) => x.params));
  const o2 = textsTo(PEOPLE.olivia).at(-1);
  ok(o2 && o2.body.includes("opened quote Q-2026-0022 (3rd time)"), "…'(3rd time)'", o2?.body);
  ok(later.body.recorded === true, "…and the open is recorded");

  // A quote taken back to draft between the read and the write: nothing moves.
  table("quote")[0].status = "draft";
  const drafted = await view();
  ok(drafted.body.recorded === false, "a draft is never counted or alerted", drafted.body);
  table("quote")[0].status = "sent";
}

// Two tabs at the same instant: one alert.
reset();
await optIns();
{
  const [x, y] = await Promise.all([view(), view()]);
  await settle();
  ok(x.body.recorded && y.body.recorded && table("notificationEvent").filter((e) => e.type === "quote.viewed").length === 1, "two simultaneous opens: both counted, ONE alert");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Channels: the company switch, a person's bell, the cap, STOP, no number");
// ═══════════════════════════════════════════════════════════════════════════

reset();
await optIns();
table("notificationRule").push({ id: "r1", companyId: A, type: "quote_viewed", active: false });
// Company B switching it off must not touch company A, and vice versa.
table("notificationRule").push({ id: "r2", companyId: B, type: "quote_accepted", active: false });
{
  await view();
  await settle();
  ok(table("notificationEvent").length === 0 && globalThis.__SMS.length === 0 && globalThis.__PUSHES.length === 0, "company switch OFF: no bell, no push, no text for anybody");
  ok(table("quote")[0].viewCount === 1, "…the open is still recorded (the switch is about alerts, not facts)");
}

reset();
await optIns();
await choose(PEOPLE.olivia, "quote.viewed", "inApp", false);
await choose(PEOPLE.adam, "quote.viewed", "email", true);
// Esme's phone replied STOP last week.
table("smsOptOut").push({ id: "so1", companyId: A, e164: "+15145550102", optedOut: true });
// Olivia has had nineteen texts today and one yesterday: one more fits.
for (let i = 0; i < 19; i++) table("staffAlertText").push({ id: `old${i}`, companyId: A, memberId: "m_olivia", userId: "u_olivia", event: "quote.viewed", status: "sent", createdAt: new Date(Date.now() - 3600e3) });
table("staffAlertText").push({ id: "older", companyId: A, memberId: "m_olivia", userId: "u_olivia", event: "quote.viewed", status: "sent", createdAt: new Date(Date.now() - 25 * 3600e3) });
{
  await view();
  await settle();
  const to = deliveriesFor("quote.viewed").map((d) => d.memberId).sort();
  ok(!to.includes("m_olivia") && to.includes("m_adam"), "the owner switched her bell off: no bell for her, the others keep theirs", to);
  ok(textsTo(PEOPLE.olivia).length === 1, "…but her text still goes — the twentieth today (yesterday's does not count)");
  ok(!textsTo(PEOPLE.esme).length, "STOP: the estimator's opted-out phone is not texted");
  ok(table("staffAlertText").some((r) => r.memberId === "m_esme" && r.status === "refused" && r.reason === "opted_out"), "…and the refusal is recorded as opted_out");
  const mail = globalThis.__MAIL.find((m) => String(m.to).includes("u_adam@a.test"));
  ok(mail && /a ouvert la soumission Q-2026-0022/.test(mail.subject) && mail.from.includes("notifications@fieldquo.com"), "the admin ticked email: a team notice, in French, from FieldQuo's notifications address", mail?.subject);
  ok(globalThis.__MAIL.length === 1, "…and nobody else was emailed");

  // The 21st: refused, recorded, the bell still rings.
  table("quote")[0].viewAlertedAt = new Date(Date.now() - 25 * 3600e3);
  const sentBefore = textsTo(PEOPLE.olivia).length;
  await view();
  await settle();
  ok(textsTo(PEOPLE.olivia).length === sentBefore, "over the cap: no 21st text");
  ok(table("staffAlertText").some((r) => r.memberId === "m_olivia" && r.reason === "rate_limited"), "…recorded as rate_limited");
  ok(deliveriesFor("quote.viewed").length >= 2, "…while the bell still rings for the others");
}

reset();
await optIns();
{
  // A preference row filed under ANOTHER company, naming a company-A member
  // (corrupt or forged — no route writes one): it must switch nothing on.
  table("member").find((m) => m.id === "m_adam").phone = "+16135550110";
  table("memberAlertPreference").push({ id: "forged", companyId: B, memberId: "m_adam", event: "quote.viewed", sms: true, email: true });
  await view();
  await settle();
  ok(!globalThis.__SMS.some((s) => s.to === "+16135550110"), "a preference row from another company switches on no text here");
  ok(!globalThis.__MAIL.some((m) => [].concat(m.to).includes("u_adam@a.test")), "…and no email");
}

reset();
await optIns();
{
  // The switches cannot be read (a blip, or the tables not yet applied on a
  // deploy): the bell still rings for everybody resolved, no text is sent on
  // a guess, and the failure is reported.
  const realModel = globalThis.__DB.memberAlertPreference;
  globalThis.__DB.memberAlertPreference = { ...realModel, findMany: async () => { throw new Error("relation \"MemberAlertPreference\" does not exist"); } };
  await view();
  await settle();
  globalThis.__DB.memberAlertPreference = realModel;
  ok(deliveriesFor("quote.viewed").length === 4, "preferences unreadable: the bell still rings for the four resolved", deliveriesFor("quote.viewed").length);
  ok(globalThis.__SMS.length === 0, "…and nobody is texted on a guess");
  ok(globalThis.__ERRORS.some((e) => /switches unreadable/.test(e.message)), "…and it is reported to /platform/errors");
}

reset();
await optIns();
{
  // The number was cleared after the text was switched on.
  table("member").find((m) => m.id === "m_olivia").phone = null;
  await view();
  await settle();
  ok(!globalThis.__SMS.some((s) => s.to === "+15145550101"), "no number: no text");
  ok(table("staffAlertText").some((r) => r.memberId === "m_olivia" && r.reason === "no_phone" && r.status === "refused"), "…recorded as no_phone");
}

reset();
await optIns();
{
  // The carrier refuses; the trial gate refuses; the demo simulates.
  globalThis.__SMS_PLAN.push({ success: false, error: "21610 unsubscribed" }, { success: false, code: "phone_required", phoneVerification: { feature: "sms" } }, { success: true, sid: "demo_1", simulated: true });
  await view();
  await settle();
  const reasons = table("staffAlertText").filter((r) => r.status === "refused").map((r) => r.reason).sort();
  ok(JSON.stringify(reasons) === JSON.stringify(["send_failed", "simulated", "trial_phone_gate"]), "a refused send, the trial gate and a demo are each recorded for what they were, never as sent", reasons);
  ok(table("staffAlertText").filter((r) => r.status === "sent").length === 0, "…and none of them counts against the cap");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The client approves the quote (the real public route)");
// ═══════════════════════════════════════════════════════════════════════════

reset();
await optIns();
{
  const res = await quoteRoute.POST(
    {
      headers: { get: (n) => ({ "user-agent": "Mozilla/5.0 iPhone" })[String(n).toLowerCase()] ?? null },
      json: async () => ({ decision: "accepted", signature: { name: "Maureen Faulkner", dataUrl: SIG, consent: true } }),
    },
    { params: Promise.resolve({ token: "tok_q1" }) },
  );
  await settle();
  ok(res.status === 200 && res.body.status === "accepted", "the approval commits", res.body);
  const ev = table("notificationEvent").filter((e) => e.type === "quote.accepted");
  ok(ev.length === 1 && ev[0].companyId === A && Number(ev[0].amount) === 8927, "one 'approved' alert in company A, the amount stored structurally", ev);
  const to = deliveriesFor("quote.accepted").map((d) => d.memberId).sort();
  ok(to.includes("m_olivia") && to.includes("m_esme") && !to.includes("m_ned") && !to.includes("m_carl") && !to.includes("m_bob"), "bell: the owner and the estimator with prices; NOT the estimator without prices, not crew, not company B", to);
  const o = textsTo(PEOPLE.olivia).find((s) => s.body.includes("approved quote"));
  ok(o && o.body.startsWith("FieldQuo: Maureen Faulkner approved quote Q-2026-0022 ($8,927.00).") && o.body.includes("/app/quotes/q_1"), "the owner's text: who, which quote, the amount, the link", o?.body);
  const es = textsTo(PEOPLE.esme).find((s) => s.body.includes("aprobó"));
  ok(es && /8927|8 927|8\.927|8,927/.test(es.body), "the estimator WITH prices reads the amount", es?.body);
  ok(!textsTo(PEOPLE.ned).some((s) => /aprob|approved/.test(s.body)), "the estimator WITHOUT prices gets no approval text at all");
  ok(!textsTo(PEOPLE.bob).length, "company B: nothing");
  const team = globalThis.__MAIL.filter((m) => /approved Q-2026-0022/.test(m.subject));
  ok(team.length >= 1 && team.every((m) => [].concat(m.to).every((a) => /u_(olivia|adam)@a\.test/.test(a))), "the approval email still goes to the owner and the admin (default ON) — and to nobody else", team.map((m) => m.to));
}

reset();
await optIns();
await choose(PEOPLE.olivia, "quote.accepted", "email", false);
await choose(PEOPLE.esme, "quote.accepted", "email", true);
{
  await quoteRoute.POST(
    { headers: { get: () => null }, json: async () => ({ decision: "accepted", signature: { name: "M F", dataUrl: SIG, consent: true } }) },
    { params: Promise.resolve({ token: "tok_q1" }) },
  );
  await settle();
  const to = globalThis.__MAIL.filter((m) => /Q-2026-0022/.test(m.subject) && !/maureen/.test([].concat(m.to).join())).flatMap((m) => [].concat(m.to)).sort();
  ok(JSON.stringify(to) === JSON.stringify(["u_adam@a.test", "u_esme@a.test"]), "the owner switched her approval email off; the estimator switched hers on — the email follows each choice", to);
}

reset();
await optIns();
table("notificationRule").push({ id: "r3", companyId: A, type: "quote_accepted", active: false });
{
  await quoteRoute.POST(
    { headers: { get: () => null }, json: async () => ({ decision: "accepted", signature: { name: "M F", dataUrl: SIG, consent: true } }) },
    { params: Promise.resolve({ token: "tok_q1" }) },
  );
  await settle();
  ok(table("quote")[0].status === "accepted", "company switch OFF: the approval itself still commits");
  ok(table("notificationEvent").length === 0 && globalThis.__SMS.length === 0, "…no bell, no text");
  ok(!globalThis.__MAIL.some((m) => [].concat(m.to).some((a) => /@a\.test/.test(a))), "…no team email");
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The client approves a change order (the real public route)");
// ═══════════════════════════════════════════════════════════════════════════

function seedChangeOrder() {
  table("job").push({ id: "job_1", companyId: A, clientId: "cl_1", quoteId: "q_1" });
  table("changeOrder").push({
    id: "co_1",
    jobId: "job_1",
    seq: 2,
    createdAt: new Date(),
    description: "Add the hallway",
    bodyHtml: "<p>Hallway</p>",
    priceDelta: 1200,
    scheduleDeltaDays: 1,
    photos: [],
    status: "waiting_client",
    shareToken: "tok_co1",
    createdById: "u_mia",
    viewedAt: new Date(),
    signature: null,
    invoiceId: null,
    invoice: null,
    job: {
      id: "job_1",
      companyId: A,
      endDate: null,
      clientPoNumber: null,
      client: { name: "Maureen Faulkner", address: null, city: null, language: "en" },
      quote: { id: "q_1", quoteNumber: "Q-2026-0022", language: "en", acceptedAt: new Date(), total: 8927, acceptedTotal: 8927, subtotal: 7900, acceptedSubtotal: 7900, tax: 1027, acceptedTax: 1027, discount: 0, createdById: "u_esme", assignedToId: "u_ned" },
      company: { name: "Northline Painting", currency: "CAD", defaultLanguage: "en", stripeAccountId: null, stripeChargesEnabled: false, isDemo: false },
    },
  });
}
reset();
await optIns();
await choose(PEOPLE.esme, "changeOrder.approved", "sms", true);
await choose(PEOPLE.adam, "changeOrder.approved", "email", true);
seedChangeOrder();
{
  const res = await changeOrderRoute.POST(
    { headers: { get: () => null }, json: async () => ({ signature: { name: "Maureen Faulkner", dataUrl: SIG, consent: true } }) },
    { params: Promise.resolve({ token: "tok_co1" }) },
  );
  await settle();
  ok(res.status === 200, "the change order approval commits", res.status);
  const ev = table("notificationEvent").filter((e) => e.type === "changeOrder.approved");
  ok(ev.length === 1 && ev[0].companyId === A && ev[0].entityId === "job_1" && Number(ev[0].amount) === 1200 && ev[0].params.label === "CO-2", "one 'change order approved' alert, on the job, CO-2, +1200 stored structurally", ev);
  const to = deliveriesFor("changeOrder.approved").map((d) => d.memberId).sort();
  ok(JSON.stringify(to) === JSON.stringify(["m_adam", "m_esme", "m_olivia"]), "bell: owner, admin, and the estimator with prices who wrote the quote — not the estimator without prices, not the manager (money, supervisors excluded), not crew, not company B", to);
  const o = textsTo(PEOPLE.olivia).find((s) => s.body.includes("change order"));
  ok(o && o.body.startsWith("FieldQuo: Maureen Faulkner approved change order CO-2 ($1,200.00).") && o.body.includes("/app/jobs/job_1"), "the owner's text: change order, amount, the job link", o?.body);
  ok(textsTo(PEOPLE.esme).some((s) => s.body.includes("CO-2")), "the estimator who opted in is texted");
  ok(!textsTo(PEOPLE.bob).length, "company B: nothing");
  const mail = globalThis.__MAIL.find((m) => [].concat(m.to).includes("u_adam@a.test"));
  ok(mail && /l’avenant CO-2/.test(mail.subject) && /1\s?200,00/.test(mail.text), "the admin's email: French, with the amount (an admin sees money)", mail?.subject);
}
reset();
await optIns();
seedChangeOrder();
table("changeOrder")[0].status = "approved";
{
  const res = await changeOrderRoute.POST(
    { headers: { get: () => null }, json: async () => ({ signature: { name: "M F", dataUrl: SIG, consent: true } }) },
    { params: Promise.resolve({ token: "tok_co1" }) },
  );
  await settle();
  ok(res.status === 409 && table("notificationEvent").length === 0 && globalThis.__SMS.length === 0, "a second tap on an already-approved change order alerts nobody", res.status);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The client sends a request (portal ticket)");
// ═══════════════════════════════════════════════════════════════════════════

reset();
await optIns();
{
  const client = { id: "cl_1", companyId: A, name: "Maureen Faulkner" };
  const r = await openTicket({ client, input: { type: "question", subject: "Can you also do the trim?", body: "And the doors." }, db: globalThis.__DB });
  await settle();
  ok(r.ok, "the ticket is opened", r);
  const to = deliveriesFor("client_ticket.opened").map((d) => d.memberId);
  ok(to.includes("m_olivia") && !to.includes("m_bob") && !to.includes("m_carl"), "bell: the request rung of company A; never company B, never crew", to);
  const o = textsTo(PEOPLE.olivia).find((s) => s.body.includes("sent a request"));
  ok(o && o.body.includes('"Can you also do the trim?"') && o.body.includes("/app/tickets/"), "the owner's text quotes the subject and links the ticket — awaited, not cut off", o?.body);
  ok(!textsTo(PEOPLE.bob).length, "company B: nothing");

  // The ticket email honours the holder's switch and the company switch.
  const ticket = { id: r.ticket.id, companyId: A, subject: "Trim", assignedToId: null };
  table("member").find((m) => m.id === "m_olivia").user.email = "u_olivia@a.test";
  const sent = [];
  const send = async (m) => (sent.push(m), { id: "re" });
  await emailOffice({ ticket, client, kind: "opened", text: "x", db: globalThis.__DB, send });
  ok(sent.length === 1 && /Settings › Notifications/.test(sent[0].text), "the new-request email goes (default ON) and says where to switch it off");
  await choose(PEOPLE.olivia, "client_ticket.opened", "email", false);
  const off = await emailOffice({ ticket, client, kind: "opened", text: "x", db: globalThis.__DB, send });
  ok(off.reason === "switched_off" && sent.length === 1, "the owner switched it off: no email", off);
  const reply = await emailOffice({ ticket, client, kind: "replied", text: "x", db: globalThis.__DB, send });
  ok(reply.sent === true && sent.length === 2, "a client's REPLY on a ticket is the conversation, not an alert — still emailed", reply);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. No amount for a member without prices — the text builder on its own");
// ═══════════════════════════════════════════════════════════════════════════

reset();
{
  // Force a no-prices member into a money event's text list — the fan-out
  // would never do this; the builder must still print no figure.
  const out = await sendStaffTexts({
    prisma: globalThis.__DB,
    companyId: A,
    type: "quote.accepted",
    entityId: "q_1",
    params: { clientName: "Maureen Faulkner", quoteNumber: "Q-2026-0022" },
    amount: 8927,
    members: [{ id: "m_ned" }, { id: "m_esme" }],
    company: table("company")[0],
  });
  const ned = out.find((x) => x.memberId === "m_ned");
  const esme = out.find((x) => x.memberId === "m_esme");
  ok(ned && ned.sent && !/8[\s,. ]?927/.test(ned.body), "no-prices reader: the text has no amount", ned?.body);
  ok(esme && esme.sent && /8[\s,. ]?927/.test(esme.body), "a reader with prices: the amount is there", esme?.body);
  ok(amountForReader({ role: "employee", permissions: { showPricing: false } }, 100) === null && amountForReader({ role: "owner", permissions: null }, 100) === 100, "amountForReader: null without showPricing, the figure with it");
  // A company-B member handed to a company-A send is not even loaded.
  const cross = await sendStaffTexts({ prisma: globalThis.__DB, companyId: A, type: "quote.viewed", entityId: "q_1", params: {}, members: [{ id: "m_bob" }], company: table("company")[0] });
  ok(cross.length === 0 && !textsTo(PEOPLE.bob).length, "a member of another company named for company A's text is never loaded, never texted");
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. STOP from a staff phone");
// ═══════════════════════════════════════════════════════════════════════════

reset();
table("platformSmsNumber").push({ id: "psn", e164: "+15550001111", purpose: "system", active: true, createdAt: new Date() });
{
  const req = (body) => ({ formParams: async () => ({ To: "+15550001111", From: "+15145550104", Body: body, MessageSid: "SMx" }), headers: { get: () => null } });
  await inboundRoute.POST(req("STOP"));
  const row = table("smsOptOut").find((r) => r.companyId === A && r.e164 === "+15145550104");
  ok(row && row.optedOut === true, "a STOP from Mia's phone (a member, no client record) is recorded for her company", table("smsOptOut"));
  ok(!table("smsOptOut").some((r) => r.companyId === B), "…and for no other company");
  await inboundRoute.POST(req("START"));
  ok(table("smsOptOut").find((r) => r.companyId === A && r.e164 === "+15145550104")?.optedOut === false, "START reverses it");
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Every word, every language the picker offers");
// ═══════════════════════════════════════════════════════════════════════════

{
  const langs = Object.keys(APP_MESSAGES);
  // ── Stated against the PICKER, not against the app catalogue ───────────
  //
  // This read `=== Object.keys(APP_MESSAGES)` until 2026-11-08, which was the
  // right invariant while the two lists moved together and the wrong one the
  // moment they stopped. ko/pt/ru were offered on 2026-10-24 and given
  // client-alert copy; app/i18n/appMessages.js (19,070 keys a language) has
  // not followed. Equality then failed on the copy being READY — the state
  // this project wants — while saying nothing about the gap that matters.
  //
  // So: every language the picker offers must have alert copy and an
  // ordinal, and nothing may have copy that the picker does not offer. The
  // missing app catalogue is asserted where it belongs, by
  // check:language-completeness, which fails on exactly those three today.
  const offered = [...LANGUAGE_CODES].sort();
  const copyLangs = Object.keys(CLIENT_ALERT_COPY).sort();
  // One direction only. A language may legitimately have copy and a full
  // catalogue WITHOUT being offered — zh is held back deliberately, because
  // no CJK face is registered in lib/documents/pdfFont.js and a Mandarin
  // quote PDF would render as mojibake (CATALOGUE_ONLY in
  // scripts/check-language-completeness.mjs, which owns that question and
  // asserts the font claim rather than trusting it). Asserting the reverse
  // here would make a deliberate hold-back look like a defect.
  ok(offered.every((l) => copyLangs.includes(l)), "every offered language has client-alert copy", offered.filter((l) => !copyLangs.includes(l)));
  ok(offered.every((l) => TIMES_ORDINAL_LANGUAGES.includes(l)), "every offered language has an ordinal ('3rd time')", offered.filter((l) => !TIMES_ORDINAL_LANGUAGES.includes(l)));
  const appKeys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.clientAlerts.") || k === "app.notif.type.quote.viewed" || k === "app.notif.type.changeOrder.approved");
  ok(appKeys.length >= 24, "the screen and bell keys exist in English", appKeys.length);
  for (const l of langs) {
    const missing = appKeys.filter((k) => APP_MESSAGES[l][k] === undefined);
    ok(missing.length === 0, `${l}: every screen and bell key`, missing);
    for (const k of appKeys) {
      if (l !== "en" && typeof APP_MESSAGES[l][k] === "string" && APP_MESSAGES[l][k] === APP_MESSAGES.en[k] && !/^(Email|SMS|Text)$/.test(APP_MESSAGES.en[k])) ok(false, `${l}: ${k} is not just the English`);
    }
    const v1 = APP_MESSAGES[l]["app.notif.type.quote.viewed"]({ clientName: "Ann", quoteNumber: "Q-9", count: 1 });
    const v2 = APP_MESSAGES[l]["app.notif.type.quote.viewed"]({ clientName: "Ann", quoteNumber: "Q-9", count: 2 });
    ok(v1.includes("Ann") && v1.includes("Q-9") && v2 !== v1 && v2.includes(timesOrdinal(l, 2)), `${l}: the bell says 'opened', and '(2nd time)' on a re-open`, { v1, v2 });
    for (const event of CLIENT_ALERT_EVENTS) {
      const body = staffAlertSms({ event, language: l, params: { clientName: "Ann", quoteNumber: "Q-9", count: 2, label: "CO-1", subject: "Trim" }, amountText: null, link: "https://x.test/app/quotes/q" });
      ok(body && body.startsWith("FieldQuo: ") && body.includes("https://x.test/app/quotes/q") && body.includes("STOP") && !/undefined|NaN/.test(body), `${l}: the ${event} text builds`, body);
      if (l !== "en") ok(body !== staffAlertSms({ event, language: "en", params: { clientName: "Ann", quoteNumber: "Q-9", count: 2, label: "CO-1", subject: "Trim" }, link: "https://x.test/app/quotes/q" }), `${l}: the ${event} text is not the English`);
    }
    const tc = TEAM_NOTICE_COPY[l];
    ok(tc && tc.viewed && tc.changeOrderApproved && tc.labels.timesOpened && tc.labels.changeAmount, `${l}: the two new emails' copy`);
  }
  // What a text costs, in segments — printed so the report can say.
  const sample = staffAlertSms({ event: "quote.viewed", language: "en", params: { clientName: "Maureen Faulkner", quoteNumber: "Q-2026-0022", count: 2 }, link: "https://fieldquo.com/app/quotes/cmg1abcdefghijklmnopqrstu" });
  console.log(`  [cost] English 'opened again' text: ${sample.length} chars, ${smsSegments(sample)} segment(s)`);
  for (const l of Object.keys(CLIENT_ALERT_COPY)) {
    const s = staffAlertSms({ event: "quote.accepted", language: l, params: { clientName: "Maureen Faulkner", quoteNumber: "Q-2026-0022" }, amountText: "$8,927.00", link: "https://fieldquo.com/app/quotes/cmg1abcdefghijklmnopqrstu" });
    console.log(`  [cost] ${l} 'approved' text: ${s.length} chars, ${smsSegments(s)} segment(s)`);
  }
  ok(smsSegments(sample) <= 2, "an English alert is at most two segments", smsSegments(sample));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. Wiring that only reading can show");
// ═══════════════════════════════════════════════════════════════════════════

{
  const viewed = read("app/api/public/quotes/[token]/viewed/route.js");
  const i = viewed.indexOf("if (!verdict.record)");
  const j = viewed.indexOf("claimViewAlert(");
  ok(i > 0 && j > i, "the open alert is claimed only AFTER the verdict refused staff/prefetch/bot");
  ok(/RETURNING "viewCount"/.test(viewed) && /COALESCE\("viewedAt", NOW\(\)\)/.test(viewed), "the counter is still raw and still keeps the first view");
  const page = read("app/app/settings/notifications/page.js");
  ok(/<ClientAlertsPanel readOnly=\{readOnly\} \/>/.test(page), "the panel is on Settings › Notifications, read-only for a support session");
  ok(/"app\.settings\.notifications": "everyone"/.test(read("lib/permissions/settingsAccess.js")), "…and the screen opens for every member (it holds their OWN alerts)");
  ok(/\{companyCards && \(/.test(page), "…while the company-wide cards are drawn only for owners and admins");
  const panel = read("app/app/settings/notifications/ClientAlertsPanel.js");
  ok(panel.includes("/api/settings/alert-preferences") && panel.includes("/api/settings/notification-rules"), "the panel calls both routes");
  ok(panel.includes("/api/settings/lead-owner"), "…and the enquiry-owner route, so the picker is not a control with no wire");
  ok(/available\[c\] === false/.test(panel), "a channel with no sender is drawn as a dash, never as a live box");
  // ONE creator, every inbound channel: the alert and the assignment both
  // hang off createScoredLead rather than off the eight routes that call it.
  const creator = read("lib/leads/createLead.js");
  ok(/leadOwnerMember\(db, input\.companyId\)/.test(creator), "the default assignee is read in the one creator");
  ok(creator.indexOf("const assignedToId") < creator.indexOf("await db.leadRequest.create({"), "…before the lead is written, so it lands assigned rather than being updated after");
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. A new enquiry arrives — the real creator, every inbound channel");
// ═══════════════════════════════════════════════════════════════════════════

/**
 * createScoredLead fires notifyEvent fire-and-forget (the lead is captured
 * whatever happens next), so the check waits for the effect rather than for a
 * fixed sleep — and waits a BOUNDED time, never open-endedly.
 */
async function drain(done, ms = 1000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (done()) return true;
    await new Promise((r) => setTimeout(r, 5));
  }
  return done();
}

/** The leads board, with this lead's own drawer open. */
const leadLink = (id) => `https://app.fieldquo.test/app/leads?lead=${id}`;

reset();
await optIns();
{
  const lead = await createScoredLead({
    companyId: A,
    name: "Jonathan Vandermeer",
    email: "jon@vandermeer.test",
    phone: "613 555 0188",
    message: "Kitchen cabinets need refinishing before Christmas",
    source: "self_quote",
    intake: { address: "12 Elm St", serviceType: "Cabinet refinishing" },
  });
  ok(Boolean(lead?.id), "the lead is created");
  await drain(() => globalThis.__SMS.length > 0 && deliveriesFor("lead.created").length >= 5);

  const to = deliveriesFor("lead.created").map((d) => d.memberId).sort();
  ok(JSON.stringify(to) === JSON.stringify(["m_adam", "m_esme", "m_mia", "m_ned", "m_olivia"]), "the bell rings for everybody who can see Requests, the manager included", to);
  ok(!to.includes("m_carl"), "…and never for crew with Requests off");
  ok(globalThis.__PUSHES.length === 1, "…one push batch, same people", globalThis.__PUSHES.length);

  const text = textsTo(PEOPLE.olivia)[0];
  ok(Boolean(text), "the owner who asked for a text gets one");
  ok(text && /Jonathan Vandermeer/.test(text.body), "…with their name", text?.body);
  ok(text && /613 555 0188/.test(text.body), "…their phone — the whole point of a text to somebody in a van");
  ok(text && /jon@vandermeer\.test/.test(text.body), "…their email");
  ok(text && /Cabinet refinishing/.test(text.body), "…what they want, from the intake");
  ok(text && text.body.includes(leadLink(lead.id)), "…and a link that opens THAT lead, not the bare board", text?.body);
  ok(hrefFor({ entityType: "lead", entityId: lead.id }) === `/app/leads?lead=${lead.id}`, "the bell row opens the same place");
  ok(!textsTo(PEOPLE.bob).length, "company B's owner, with every text switched on, hears nothing about company A's lead");
  // The homeowner's phone and email are in the TEXT and nowhere near the
  // stored feed row — see lib/notifications/alertFacts.js's header.
  const row = table("notificationEvent").find((e) => e.type === "lead.created");
  ok(row && JSON.stringify(Object.keys(row.params || {}).sort()) === JSON.stringify(["leadName", "temperature"]), "the stored feed row still carries only leadName and temperature", row?.params);
  ok(!JSON.stringify(row?.params || {}).includes("613 555 0188"), "…no homeowner phone number is stored on a row every member can read");
}

reset();
await optIns();
table("notificationRule").push({ id: "rl", companyId: A, type: "new_lead", active: false });
{
  const lead = await createScoredLead({ companyId: A, name: "Switched Off", phone: "613 555 0001", source: "funnel" });
  await drain(() => table("notificationEvent").length > 0, 150);
  ok(Boolean(lead?.id) && table("leadRequest").length === 1, "company switch OFF: the lead is still captured (the switch is about alerts, not facts)");
  ok(table("notificationEvent").length === 0, "…no bell");
  ok(globalThis.__PUSHES.length === 0, "…no push");
  ok(globalThis.__SMS.length === 0, "…no text");
  ok(table("notificationDelivery").length === 0, "…and no delivery row for anybody");
}

reset();
await optIns();
{
  // A lead holding nothing but a name: no phone, no email, no category, no
  // intake, no message. The text must read as a sentence, not as a form with
  // blanks in it.
  const lead = await createScoredLead({ companyId: A, name: "Just A Name", source: "phone_agent" });
  await drain(() => globalThis.__SMS.length > 0);
  const body = textsTo(PEOPLE.olivia)[0]?.body || "";
  ok(/Just A Name/.test(body), "a bare lead still texts the name", body);
  ok(!/Tel:/.test(body) && !/Email:/.test(body) && !/Wants:/.test(body), "…and omits the lines it has nothing for, rather than printing a placeholder", body);
  ok(!/undefined|null|NaN|: *$/m.test(body), "…with no holes in it", body);
  ok(body.includes(leadLink(lead.id)) && body.includes("STOP"), "…and still carries the link and the opt-out");
}

reset();
await optIns();
{
  // The service CATEGORY wins over the intake — a trade name in the reader's
  // own language. Pushed directly because createScoredLead stores categoryId,
  // not the joined row.
  table("leadRequest").push({
    id: "ld_cat",
    companyId: A,
    name: "Priya Raman",
    phone: "613 555 0150",
    email: "priya@home.test",
    temperature: "hot",
    message: "Anything you can do",
    intake: { serviceType: "Something else" },
    category: { label: "Cabinet refinishing", labelTranslations: { fr: "Vernissage d'armoires" } },
  });
  const out = await sendStaffTexts({
    prisma: globalThis.__DB,
    companyId: A,
    type: "lead.created",
    entityId: "ld_cat",
    params: { leadName: "Stale Name", temperature: "cold" },
    members: [{ id: "m_olivia" }, { id: "m_adam" }],
    company: table("company")[0],
  });
  const olivia = out.find((x) => x.memberId === "m_olivia");
  const adam = out.find((x) => x.memberId === "m_adam");
  ok(olivia && /Cabinet refinishing/.test(olivia.body), "the category beats the intake answer", olivia?.body);
  ok(olivia && /Priya Raman/.test(olivia.body) && !/Stale Name/.test(olivia.body), "the FRESH name beats the one stored on the feed row", olivia?.body);
  ok(olivia && /\(Hot\)/.test(olivia.body) && !/cold/i.test(olivia.body), "…and the fresh temperature too", olivia?.body);
  // Adam has no phone in this fixture, so his text is refused — the French
  // wording is checked against the builder directly below.
  ok(adam && !adam.sent && adam.reason === "no_phone", "a reader with no number is recorded, not sent", adam);
  const fr = staffAlertSms({
    event: "lead.created",
    language: "fr",
    params: { leadName: "Priya Raman", leadWant: "Vernissage d'armoires", temperature: "hot" },
    link: "https://x.test/app/leads?lead=ld_cat",
  });
  ok(/Nouvelle demande/.test(fr) && /Vernissage d'armoires/.test(fr) && /chaude/.test(fr), "a French reader gets the French trade name and the French wording", fr);
}

reset();
{
  // Company B's lead, named in a company-A send. The enricher must read
  // nothing: the entityId is passed in by the caller, and a wrong one must
  // not become a window into another tenant's homeowner.
  table("leadRequest").push({
    id: "ld_b",
    companyId: B,
    name: "Bob's Homeowner",
    phone: "416 555 0333",
    email: "theirs@otherco.test",
    temperature: "hot",
  });
  const out = await sendStaffTexts({
    prisma: globalThis.__DB,
    companyId: A,
    type: "lead.created",
    entityId: "ld_b",
    params: { leadName: "Only What A Stored", temperature: "cold" },
    members: [{ id: "m_olivia" }],
    company: table("company")[0],
  });
  const body = out[0]?.body || "";
  ok(/Only What A Stored/.test(body), "a lead from another company enriches nothing — the feed row's own params stand", body);
  ok(!/416 555 0333/.test(body) && !/theirs@otherco\.test/.test(body) && !/Homeowner/.test(body), "…and not one detail of theirs reaches company A's text", body);
}

// ── The enricher, executed against hostile input ──────────────────────────
{
  const hostile = factsForReader(
    { event: "lead.created", lead: { name: "x".repeat(300), email: "not-an-email", phone: "----", message: null, temperature: null, intake: null, category: null } },
    "en",
  );
  ok(hostile.leadName.length === 40, "a 300-character name is clipped to 40", hostile.leadName.length);
  ok(!("leadEmail" in hostile), "an address with no @ is omitted, not printed as a typo", hostile);
  ok(!("leadPhone" in hostile), "a phone with no digits in it is omitted");
  ok(!("leadWant" in hostile) && !("temperature" in hostile), "nothing is invented for what the lead does not hold", hostile);
  const bodyFromHostile = staffAlertSms({ event: "lead.created", language: "en", params: hostile, link: "https://x.test/app/leads?lead=x" });
  ok(!/undefined|null|NaN/.test(bodyFromHostile), "…and the text built from it has no holes", bodyFromHostile);

  ok(factsForReader(null) === null && factsForReader({ event: "quote.viewed" }) === null, "no facts, or another event's facts, enrich nothing");
  ok(factsForReader({ event: "lead.created", lead: {} }, "en") && Object.keys(factsForReader({ event: "lead.created", lead: {} }, "en")).length === 0, "an empty lead adds no params at all");
  ok(leadWant({ category: null, intake: null, message: "  " }, "en") === null, "whitespace is not a statement");
  ok(leadWant({ intake: { workType: "Repaint" } }, "en") === "Repaint", "workType is read");
  ok(leadWant({ intake: { "What service do you need?": "Deck staining" } }, "en") === "Deck staining", "…and so is a funnel's own question, keyed by its words");
  ok(leadWant({ intake: { address: "12 Elm St", city: "Ottawa" } }, "en") === null, "the address is never mistaken for what they want");
  ok(leadWant({ intake: { scope: { doors: 37 } }, message: "37 doors" }, "en") === "37 doors", "a nested answer with a panel of its own is not printed as an object");
  ok(leadWant({ message: "y".repeat(400) }, "en").length === 60, "a long message is clipped");
  ok(leadPhoneLine({ phone: null }) === null && leadEmailLine({ email: undefined }) === null, "null everything is null, not a crash");
  ok(leadEmailLine({ email: " Bob@Example.com " }) === "Bob@Example.com", "a real address survives, trimmed");
}

// ── The segment count the owner is billed for ─────────────────────────────
{
  // A realistic lead: a 20-character name, a 10-digit phone, a 25-character
  // email, a 20-character service.
  const realistic = {
    leadName: "Jonathan Vandermee",
    leadPhone: "6135550188",
    leadEmail: "jonathan@vandermeer.ca",
    leadWant: "Cabinet refinishing",
    temperature: "hot",
  };
  const link = "https://fieldquo.com/app/leads?lead=cmg1abcdefghijklmnopqrstu";
  const en = staffAlertSms({ event: "lead.created", language: "en", params: realistic, link });
  ok(smsSegments(en) <= 2, "an English new-enquiry text is at most two segments", { chars: en.length, segments: smsSegments(en) });
  for (const l of Object.keys(CLIENT_ALERT_COPY)) {
    const s = staffAlertSms({ event: "lead.created", language: l, params: realistic, link });
    console.log(`  [cost] ${l} 'new enquiry' text: ${s.length} chars, ${smsSegments(s)} segment(s)`);
  }
}

// ── Every language the copy file itself carries ───────────────────────────
{
  // Iterated from the file's own table, never from a list typed here: a
  // closed list folds an unknown language into English with no error, which
  // is a failure this repo has already been bitten by.
  for (const l of Object.keys(CLIENT_ALERT_COPY)) {
    const body = staffAlertSms({
      event: "lead.created",
      language: l,
      params: { leadName: "Ann", leadPhone: "613 555 0100", leadEmail: "ann@home.test", leadWant: "Repaint", temperature: "warm" },
      link: "https://x.test/app/leads?lead=l1",
    });
    ok(body && body.startsWith("FieldQuo: ") && body.includes("Ann") && body.includes("613 555 0100") && body.includes("ann@home.test") && body.includes("Repaint") && body.includes("https://x.test/app/leads?lead=l1") && body.includes("STOP"), `${l}: the new-enquiry text carries every fact`, body);
    ok(body && !/undefined|NaN/.test(body), `${l}: …and no holes`, body);
    const c = CLIENT_ALERT_COPY[l];
    ok(c.temp && c.temp.hot && c.temp.warm && c.temp.cold, `${l}: hot / warm / cold are written`, c.temp);
    ok(body.includes(c.temp.warm), `${l}: …and the lead's own band is the one printed`);
    if (l !== "en") {
      const enBody = staffAlertSms({
        event: "lead.created",
        language: "en",
        params: { leadName: "Ann", leadPhone: "613 555 0100", leadEmail: "ann@home.test", leadWant: "Repaint", temperature: "warm" },
        link: "https://x.test/app/leads?lead=l1",
      });
      ok(body !== enBody, `${l}: the new-enquiry text is not the English`);
    }
  }
  // Every offered language can build this text — read off the picker, for
  // the reason given in section 10.
  ok([...LANGUAGE_CODES].every((l) => Object.keys(CLIENT_ALERT_COPY).includes(l)), "every offered language can build the new-enquiry text", [...LANGUAGE_CODES].filter((l) => !Object.keys(CLIENT_ALERT_COPY).includes(l)));
  for (const l of Object.keys(APP_MESSAGES)) {
    const missing = ["app.clientAlerts.event.lead.created", "app.clientAlerts.hint.lead.created", "app.clientAlerts.noChannel", "app.clientAlerts.leadOwnerLabel", "app.clientAlerts.leadOwnerDesc", "app.clientAlerts.leadOwnerNobody", "app.clientAlerts.leadOwnerNone"].filter((k) => APP_MESSAGES[l][k] === undefined);
    ok(missing.length === 0, `${l}: the new-enquiry screen keys`, missing);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. Who new enquiries go to");
// ═══════════════════════════════════════════════════════════════════════════

/** Set the company's enquiry owner the way an owner would — the real route. */
async function pickOwner(actor, memberId) {
  globalThis.__SESSION = { id: actor.id, userId: actor.userId, companyId: actor.companyId, role: actor.role };
  const res = await leadOwnerRoute.PUT(jsonRequest({ memberId }));
  globalThis.__SESSION = null;
  return res;
}

reset();
{
  globalThis.__SESSION = { id: PEOPLE.esme.id, userId: PEOPLE.esme.userId, companyId: A, role: "employee" };
  const denied = await leadOwnerRoute.GET(jsonRequest(null));
  globalThis.__SESSION = null;
  ok(denied.status === 403, "an estimator cannot read who enquiries go to — it is a company setting", denied.status);

  globalThis.__SESSION = { id: PEOPLE.olivia.id, userId: PEOPLE.olivia.userId, companyId: A, role: "owner" };
  const list = await leadOwnerRoute.GET(jsonRequest(null));
  globalThis.__SESSION = null;
  const offered = list.body.options.map((o) => o.memberId).sort();
  ok(JSON.stringify(offered) === JSON.stringify(["m_adam", "m_esme", "m_mia", "m_ned", "m_olivia"]), "the picker offers exactly the people the alert can reach", offered);
  ok(!offered.includes("m_carl"), "…never crew with Requests off: assigning them a lead they cannot open is the dead control");
  ok(list.body.memberId === null, "…and nobody is chosen until somebody chooses");

  const no = await pickOwner(PEOPLE.olivia, "m_carl");
  ok(no.status === 400 && no.body.code === "not_eligible", "choosing somebody the alert cannot reach is refused by name", no.body);
  const cross = await pickOwner(PEOPLE.olivia, "m_bob");
  ok(cross.status === 400, "…and so is another company's member", cross.status);

  globalThis.__SESSION = { id: PEOPLE.olivia.id, userId: PEOPLE.olivia.userId, companyId: A, role: "owner", impersonation: { by: "support" } };
  const imp = await leadOwnerRoute.PUT(jsonRequest({ memberId: "m_mia" }));
  globalThis.__SESSION = null;
  ok(imp.status === 403, "a support session cannot choose one (non-negotiable #2)", imp.status);

  const yes = await pickOwner(PEOPLE.olivia, "m_mia");
  ok(yes.status === 200 && yes.body.memberId === "m_mia", "the owner picks the appointment setter", yes.body);
  ok(table("company").find((c) => c.id === A).leadOwnerId === "m_mia", "…stored on the company");
  ok(table("company").find((c) => c.id === B).leadOwnerId === undefined, "…and company B is untouched");
}

reset();
await optIns();
{
  // The recipients WITHOUT the setting, then WITH it: the list may only grow.
  const before = await createScoredLead({ companyId: A, name: "Before Setting", source: "funnel" });
  await drain(() => deliveriesFor("lead.created").length >= 5);
  const baseline = new Set(deliveriesFor("lead.created").map((d) => d.memberId));
  ok(before.assignedToId == null, "with no setting a lead arrives unassigned, exactly as before this existed", before.assignedToId);

  await pickOwner(PEOPLE.olivia, "m_mia");
  const after = await createScoredLead({ companyId: A, name: "After Setting", phone: "613 555 0199", source: "self_quote" });
  await drain(() => table("notificationEvent").filter((e) => e.type === "lead.created").length >= 2);
  const second = table("notificationEvent").filter((e) => e.type === "lead.created").slice(-1)[0];
  const now = new Set(table("notificationDelivery").filter((d) => d.eventId === second.id).map((d) => d.memberId));
  ok([...baseline].every((id) => now.has(id)), "naming a setter removes nobody — everybody who got the bell still gets it", { baseline: [...baseline], now: [...now] });
  ok(after.assignedToId === PEOPLE.mia.userId, "…and the lead is assigned to them, so the board and the follow-up task are theirs", after.assignedToId);
}

reset();
await optIns();
await pickOwner(PEOPLE.olivia, "m_mia");
{
  const imported = await createScoredLead({ companyId: A, name: "July Enquiry", source: "meta_lead_ads", importedAt: new Date("2026-07-02T10:00:00Z") });
  const booked = await createScoredLead({ companyId: A, name: "From A Booking", source: "booking", notify: false });
  const stated = await createScoredLead({ companyId: A, name: "Already Owned", source: "manual", assignedToId: PEOPLE.esme.userId });
  await drain(() => table("notificationEvent").length > 0, 150);
  ok(imported.assignedToId == null, "a history backfill is assigned to nobody — a hundred July leads are not today's work", imported.assignedToId);
  ok(booked.assignedToId == null, "a lead made from a booking keeps the booking's own answer", booked.assignedToId);
  ok(stated.assignedToId === PEOPLE.esme.userId, "a caller that already decided is never overwritten by the default", stated.assignedToId);
  ok(table("notificationEvent").filter((e) => e.type === "lead.created").length === 1, "…and only the one that notifies alerted anybody", table("notificationEvent").length);
}

reset();
await optIns();
await pickOwner(PEOPLE.olivia, "m_mia");
{
  // The setter leaves on a Friday. Monday's enquiry must land on nobody, not
  // on a dead account — decided where it is READ, with no cleanup job.
  table("member").find((m) => m.id === "m_mia").active = false;
  ok((await leadOwnerMember(globalThis.__DB, A)) === null, "a deactivated setter reads as nobody");
  const lead = await createScoredLead({ companyId: A, name: "Monday Morning", source: "self_quote" });
  await drain(() => deliveriesFor("lead.created").length > 0);
  ok(lead.assignedToId == null, "…so the lead arrives unassigned rather than on a dead account", lead.assignedToId);
  ok(deliveriesFor("lead.created").length === 4, "…and the remaining four are still told", deliveriesFor("lead.created").length);
}

reset();
{
  // Access narrowed after the choice: still nobody, same reasoning.
  table("company").find((c) => c.id === A).leadOwnerId = "m_esme";
  table("member").find((m) => m.id === "m_esme").permissions = { ...NO_PRICES, requests: "none" };
  ok((await leadOwnerMember(globalThis.__DB, A)) === null, "a setter whose Requests access was taken away reads as nobody");
  ok(mayOwnLeads(PEOPLE.carl) === false && mayOwnLeads(PEOPLE.mia) === true, "mayOwnLeads is the catalog's own answer, not a second rule");
  ok((await leadOwnerCandidates(globalThis.__DB, A)).every((m) => m.companyId === A), "the candidates are this company's own members");

  // A company-B setting naming a company-A member: tenant-scoped, so nobody.
  table("company").find((c) => c.id === B).leadOwnerId = "m_olivia";
  ok((await leadOwnerMember(globalThis.__DB, B)) === null, "a member id from another company reads as nobody");
}

reset();
await optIns();
await pickOwner(PEOPLE.olivia, "m_olivia");
{
  // The setter types the lead in herself. The feed never tells somebody what
  // they just did, and naming them the enquiry owner must not undo that.
  const typed = await createScoredLead({ companyId: A, name: "Walk In", phone: "613 555 0123", source: "manual", actorUserId: PEOPLE.olivia.userId });
  await drain(() => deliveriesFor("lead.created").length > 0);
  const to = deliveriesFor("lead.created").map((d) => d.memberId);
  ok(!to.includes("m_olivia"), "the setter is not told about the lead she just typed in", to);
  ok(!textsTo(PEOPLE.olivia).length, "…and is not texted about her own keystrokes");
  ok(typed.assignedToId === PEOPLE.olivia.userId, "…but it is still hers on the board");
  const withOwner = await withLeadOwner({ prisma: globalThis.__DB, companyId: A, type: "quote.viewed", actorUserId: null, recipients: [{ id: "m_adam" }] });
  ok(withOwner.length === 1 && withOwner[0].id === "m_adam", "every other event is handed back untouched");
}

// ═══════════════════════════════════════════════════════════════════════════
// Mutations — each must make this check fail
// ═══════════════════════════════════════════════════════════════════════════

const MUTATIONS = [
  { file: "app/api/public/quotes/[token]/viewed/route.js", label: "alert on every open (no claim)", from: "  if (claimed) {", to: "  if (true) {" },
  { file: "lib/notifications/clientAlerts.js", label: "texts default ON", from: '  if (channel === "sms") return false;', to: '  if (channel === "sms") return true;' },
  { file: "lib/notifications/clientAlerts.js", label: "the 24 h window shrunk to 1 h", from: "export const VIEW_ALERT_GAP_HOURS = 24;", to: "export const VIEW_ALERT_GAP_HOURS = 1;" },
  { file: "lib/notifications/clientAlerts.js", label: "no daily cap", from: "  return Number(sentInLastDay || 0) < cap;", to: "  return true;" },
  { file: "lib/notifications/clientAlerts.js", label: "amount shown to everyone", from: "  return canSeeMoney(member || null) ? n : null;", to: "  return n;" },
  { file: "lib/notifications/clientAlerts.js", label: "the company switch ignored", from: "  return !ruleRow || ruleRow.active !== false;", to: "  return true;" },
  { file: "lib/notifications/recipients.js", label: "people scoping dropped", from: "    if (people && !UNRESTRICTED_ROLES.has(member.role) && !(member.userId && people.has(String(member.userId)))) return false;\n", to: "" },
  { file: "lib/notifications/staffTexts.js", label: "STOP ignored", from: "    const allowed = await mayText({ companyId, phone: e164 }).catch(() => false);", to: "    const allowed = true;" },
  { file: "lib/notifications/staffTexts.js", label: "texts not scoped to the company", from: "    where: { companyId, id: { in: ids }, active: true },", to: "    where: { id: { in: ids }, active: true }," },
  { file: "lib/notifications/staffTexts.js", label: "a refused send recorded as sent", from: '    } else if (!result?.success) {\n      status = "refused";', to: '    } else if (!result?.success) {\n      status = "sent";' },
  { file: "lib/notifications/notify.js", label: "the bell ignores a person's switch", from: "    const bell = plan ? plan.inApp : recipients;", to: "    const bell = recipients;" },
  { file: "lib/notifications/alertPlan.js", label: "preferences read across companies", from: "    where: { companyId, event: type, memberId: { in: ids } },", to: "    where: { event: type, memberId: { in: ids } }," },
  { file: "app/api/public/change-orders/[token]/route.js", label: "change order approval not alerted", from: "    alertChangeOrderApproved(db, { changeOrderId: co.id, label, signedBy: signature.name }).catch((err) =>", to: "    Promise.resolve().catch((err) =>" },
  { file: "app/api/public/quotes/[token]/route.js", label: "approval email ignores the choice", from: '      ? import("@/lib/notifications/alertPlan").then(({ emailMembersFor }) =>', to: '      ? false ? null : db.member.findMany({ where: { companyId: updated.companyId, active: true, role: { in: ["owner", "admin"] } }, select: READER_MEMBER_SELECT }) : (0) ? import("@/lib/notifications/alertPlan").then(({ emailMembersFor }) =>' },
  { file: "lib/clientTickets/service.js", label: "ticket text cut off (not awaited)", from: '  await notifyOffice({ ticket, client, type: "client_ticket.opened" });', to: '  void Promise.resolve().then(() => new Promise((r) => setTimeout(r, 50))).then(() => notifyOffice({ ticket, client, type: "client_ticket.opened" }));' },
  { file: "app/api/sms/inbound/route.js", label: "staff STOP not recorded", from: "        if (keyword === \"opt_out\") await recordSmsOptOut({ companyId: staff.id, phone: from, body });", to: "        if (keyword === \"opt_out\") void 0;" },
  { file: "lib/i18n/clientAlertCopy.js", label: "the amount dropped from every text", from: '  const money = amountText ? ` (${amountText})` : "";', to: '  const money = "";' },
  { file: "lib/i18n/timesOrdinal.js", label: "French ordinal falls back to English", from: '  fr: (n) => (n === 1 ? "1re fois" : `${n}e fois`),\n', to: "" },
  // ── The number it leaves from (owner, 2026-11-08) ───────────────────────
  { file: "lib/notifications/staffTexts.js", label: "alerts always leave from FieldQuo's line", from: "  const from = clientSmsFrom(company);", to: "  const from = undefined;" },
  { file: "lib/notifications/staffTexts.js", label: "FieldQuo's cap applied to the company's own spend", from: "    if (fieldquoPays) {", to: "    if (true) {" },
  { file: "lib/notifications/staffTexts.js", label: "the number FieldQuo already holds ignored", from: "    const { e164, source: phoneSource } = staffPhoneFor(m, verified);", to: "    const { e164, source: phoneSource } = { e164: m.phone ? m.phone.replace(/\\D/g, \"\").slice(-10) && \"+1\" + m.phone.replace(/\\D/g, \"\").slice(-10) : null, source: \"member\" };" },
  // ── The new enquiry ─────────────────────────────────────────────────────
  {
    file: "lib/notifications/clientAlerts.js",
    label: "a new enquiry is not an alert event at all",
    from: '  "lead.created": Object.freeze({ rule: "new_lead", email: "off", emailVia: null, peopleScoped: false }),\n',
    to: "",
  },
  {
    file: "lib/notifications/clientAlerts.js",
    label: "a channel with no sender can be switched on",
    from: "  if (!channelAvailable(type, channel)) return false;\n  const stored = pref ? pref[channel] : null;",
    to: "  const stored = pref ? pref[channel] : null;",
  },
  {
    file: "lib/notifications/render.js",
    label: "the enquiry link opens the bare board",
    from: "      return `/app/leads?lead=${encodeURIComponent(entityId)}`;",
    to: "      return `/app/leads`;",
  },
  {
    file: "lib/notifications/alertFacts.js",
    label: "a malformed email is printed anyway",
    from: "  return /^[^\\s@]+@[^\\s@]+$/.test(email) ? email : null;",
    to: "  return email || null;",
  },
  {
    file: "lib/notifications/alertFacts.js",
    label: "the enquiry's details are not read fresh",
    from: '  "lead.created": async (prisma, companyId, entityId) => {',
    to: '  "lead.created.disabled": async (prisma, companyId, entityId) => {',
  },
  {
    file: "lib/notifications/alertFacts.js",
    label: "a lead is read without its company",
    from: 'const lead = await prisma.leadRequest.findFirst({ where: { id: entityId, companyId }, select: LEAD_SELECT });',
    to: 'const lead = await prisma.leadRequest.findFirst({ where: { id: entityId }, select: LEAD_SELECT });',
  },
  {
    file: "lib/i18n/clientAlertCopy.js",
    label: "the phone line is printed even when there is none",
    from: "        params.leadPhone ? `${c.tel}: ${clip(params.leadPhone, 24)}` : null,",
    to: "        `${c.tel}: ${clip(params.leadPhone, 24)}`,",
  },
  {
    file: "lib/notifications/leadOwner.js",
    label: "a setter who left still collects leads",
    from: "    if (!member || !mayOwnLeads(member)) return null;",
    to: "    if (!member) return null;",
  },
  {
    file: "lib/notifications/leadOwner.js",
    label: "the setter is told about the lead they typed in themselves",
    from: "  if (actorUserId && owner.userId === actorUserId) return list;\n",
    to: "",
  },
  {
    file: "lib/notifications/leadOwner.js",
    label: "the setting is read across companies",
    from: "    const member = await prisma.member.findFirst({ where: { id, companyId, active: true }, select: MEMBER_SELECT });",
    to: "    const member = await prisma.member.findFirst({ where: { id, active: true }, select: MEMBER_SELECT });",
  },
  {
    file: "lib/leads/createLead.js",
    label: "a history import is assigned to the enquiry owner",
    from: "  const wantsDefaultOwner = !stated && !importedAt && input.notify !== false;",
    to: "  const wantsDefaultOwner = !stated;",
  },
  {
    file: "lib/leads/createLead.js",
    label: "the enquiry owner is never assigned the lead",
    from: "      ...(assignedToId ? { assignedToId } : {}),\n",
    to: "",
  },
  {
    file: "app/api/settings/lead-owner/route.js",
    label: "anybody can be named the enquiry owner",
    from: "    if (!candidates.some((m) => m.id === memberId)) {",
    to: "    if (false) {",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
section("14. The number an alert leaves from, and who pays (owner, 2026-11-08)");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner: "the notification to the company should leave from the company's
// text number too." The `from` is not in the return value — it is an argument
// to sendSms — so these read it off the recorder, which is the reason
// sendStaffTexts takes an injectable `send` at all.

const { staffPhoneFor, verifiedPhonesFor } = await import("@/lib/notifications/staffPhone.js");
const { isStaffOnlyPhone } = await import("@/lib/sms/clientLine.js");

const alertOnce = async (member, companyRow) =>
  sendStaffTexts({
    prisma: globalThis.__DB,
    companyId: A,
    type: "quote.viewed",
    entityId: "q_1",
    params: { quoteNumber: "Q-2026-0022", clientName: "Maureen Faulkner", count: 1 },
    members: [member],
    company: companyRow,
  });

const stuffCap = (n) => {
  for (let i = 0; i < n; i++) {
    table("staffAlertText").push({ id: `cap${i}`, companyId: A, memberId: "m_olivia", userId: "u_olivia", event: "quote.viewed", status: "sent", createdAt: new Date(Date.now() - 3600e3) });
  }
};

// ── (a) Its own number, and no cap on its own spend ───────────────────────
reset();
{
  const co = table("company")[0];
  co.smsFromNumber = "+16135550100";
  stuffCap(25); // well past the cap that guards FieldQuo's bill
  const out = await alertOnce(PEOPLE.olivia, co);
  const sent = globalThis.__SMS.at(-1);
  ok(out[0]?.sent === true, "its own number: the 26th text today still sends — the company's balance is the limit, not FieldQuo's cap", out[0]?.reason);
  ok(sent?.from === "+16135550100", "…and it leaves FROM that number, which is what makes meterOutboundIfBrought bill the company", sent?.from);
  ok(!table("staffAlertText").some((r) => r.reason === "rate_limited"), "…and nothing was recorded as rate_limited");
}

// ── (b) No number of its own: FieldQuo's line, FieldQuo's cap ─────────────
reset();
{
  const co = table("company")[0];
  stuffCap(25);
  const out = await alertOnce(PEOPLE.olivia, co);
  ok(out[0]?.sent === false && out[0]?.reason === "rate_limited", "no number of its own: FieldQuo is paying, so the cap still bites", out[0]);
}
reset();
{
  const co = table("company")[0];
  await alertOnce(PEOPLE.olivia, co);
  const sent = globalThis.__SMS.at(-1);
  ok(sent?.from === undefined, "…and the `from` is left undefined, which is how sendSms falls back to the system number", sent?.from);
}

// ── (c) The number FieldQuo already holds ─────────────────────────────────
//
// "The system should know the employees number and the owners number" — the
// owner, 2026-11-08. Adam has no Member.phone; a card-free trial verified one
// by SMS code, which is proof a text reaches it.
reset();
{
  const co = table("company")[0];
  table("phoneVerification").push({ id: "pv1", companyId: A, userId: "u_adam", e164: "+15145559999", status: "approved", verifiedAt: new Date(Date.now() - 86400e3), lineType: "unknown" });
  const out = await alertOnce(PEOPLE.adam, co);
  const sent = globalThis.__SMS.at(-1);
  ok(out[0]?.sent === true && out[0]?.phoneSource === "verified", "a member with no Member.phone is texted at the number they verified at signup", out[0]);
  ok(sent?.to === "+15145559999", "…at that number", sent?.to);
}
reset();
{
  const co = table("company")[0];
  table("phoneVerification").push({ id: "pv2", companyId: A, userId: "u_adam", e164: "+15145559999", status: "pending", expiresAt: new Date() });
  const out = await alertOnce(PEOPLE.adam, co);
  ok(out[0]?.sent === false && out[0]?.reason === "no_phone", "a verification that was never completed is not a number", out[0]);
}
reset();
{
  const co = table("company")[0];
  // Olivia's verified phone must never stand in for Adam's.
  table("phoneVerification").push({ id: "pv3", companyId: A, userId: "u_olivia", e164: "+15145558888", status: "approved", verifiedAt: new Date() });
  const out = await alertOnce(PEOPLE.adam, co);
  ok(out[0]?.sent === false && out[0]?.reason === "no_phone", "one person's verified mobile is never used to alert another", out[0]);
}
reset();
{
  const co = table("company")[0];
  table("phoneVerification").push({ id: "pv4", companyId: B, userId: "u_adam", e164: "+15145557777", status: "approved", verifiedAt: new Date() });
  const out = await alertOnce(PEOPLE.adam, co);
  ok(out[0]?.sent === false && out[0]?.reason === "no_phone", "a number verified at ANOTHER company is not this company's to text", out[0]);
}

// ── (d) staffPhoneFor, every branch, pure ─────────────────────────────────
{
  const v = new Map([["u1", "+15145551111"]]);
  ok(staffPhoneFor({ userId: "u1", phone: "(514) 555-0101" }, v).source === "member", "a typed phone wins over the verified one");
  ok(staffPhoneFor({ userId: "u1", phone: "(514) 555-0101" }, v).e164 === "+15145550101", "…normalised");
  ok(staffPhoneFor({ userId: "u1", phone: null }, v).e164 === "+15145551111", "no typed phone: the verified one");
  ok(staffPhoneFor({ userId: "u1", phone: "   " }, v).source === "verified", "whitespace is not a phone");
  ok(staffPhoneFor({ userId: "u1", phone: "nonsense" }, v).source === "verified", "an unparseable phone falls through rather than being sent");
  ok(staffPhoneFor({ userId: "u2", phone: null }, v).e164 === null, "a user with no verification: nothing");
  ok(staffPhoneFor({ userId: null, phone: null }, v).e164 === null, "no userId: nothing, and no throw");
  ok(staffPhoneFor({}, v).e164 === null, "an empty member: nothing, and no throw");
  ok(staffPhoneFor(null, v).e164 === null, "a null member: nothing, and no throw");
  ok(staffPhoneFor({ userId: "u1", phone: null }).e164 === null, "no map supplied: nothing, and no throw");
}

// ── (e) verifiedPhonesFor: newest wins, junk dropped ─────────────────────
{
  const stub = (rows) => ({ phoneVerification: { findMany: async () => rows } });
  const newest = await verifiedPhonesFor(stub([
    { userId: "u1", e164: "+15145552222", verifiedAt: new Date("2026-11-01") },
    { userId: "u1", e164: "+15145551111", verifiedAt: new Date("2026-01-01") },
  ]), { companyId: A, userIds: ["u1"] });
  ok(newest.get("u1") === "+15145552222", "two verifications: the newest is the one used", newest.get("u1"));

  const junk = await verifiedPhonesFor(stub([
    { userId: null, e164: "+15145553333", verifiedAt: new Date() },
    { userId: "u2", e164: "not a phone", verifiedAt: new Date() },
    { userId: "u3", e164: null, verifiedAt: new Date() },
  ]), { companyId: A, userIds: ["u2", "u3"] });
  ok(junk.size === 0, "a row with no user, an unparseable number and a null number are all dropped", [...junk]);

  const none = await verifiedPhonesFor(stub([]), { companyId: A, userIds: [] });
  ok(none.size === 0, "no userIds: nothing, no throw");
  const broken = await verifiedPhonesFor({ phoneVerification: { findMany: async () => { throw new Error("db down"); } } }, { companyId: A, userIds: ["u1"] });
  ok(broken.size === 0, "the database refusing does not throw out of an alert send");
}

// ── (f) isStaffOnlyPhone: the guard that keeps the owner out of his own pipeline
{
  const stub = (staff, client) => ({ $queryRaw: async () => [{ staff, client }] });
  ok((await isStaffOnlyPhone(A, "514-555-0101", stub(true, false))) === true, "staff and not a client: not a client message");
  ok((await isStaffOnlyPhone(A, "514-555-0101", stub(true, true))) === false, "an employee who is ALSO a client of their own company: still a client message");
  ok((await isStaffOnlyPhone(A, "514-555-0101", stub(false, true))) === false, "a plain client: a client message");
  ok((await isStaffOnlyPhone(A, "514-555-0101", stub(false, false))) === false, "a stranger: a client message, so a real new lead is never dropped");
  ok((await isStaffOnlyPhone(A, "", stub(true, false))) === false, "no phone: false, and no query");
  ok((await isStaffOnlyPhone(null, "514-555-0101", stub(true, false))) === false, "no company: false, and no query");
  ok((await isStaffOnlyPhone(A, "514-555-0101", { $queryRaw: async () => [] })) === false, "an empty result is not a yes");
}

if (!process.argv.includes("--no-mutate")) {
  section("15. Mutations");
  const dir = mkdtempSync(join(tmpdir(), "fq-client-alerts-mut-"));
  for (const [i, m] of MUTATIONS.entries()) {
    const path = new URL(`../${m.file}`, import.meta.url);
    const src = readFileSync(path, "utf8");
    if (!src.includes(m.from)) {
      ok(false, `mutation anchor still exists — ${m.label}`);
      continue;
    }
    // Backed up by copy and restored by copy — never by git, which restores
    // the commit rather than the working file.
    const backup = join(dir, `${i}.bak`);
    copyFileSync(path, backup);
    try {
      writeFileSync(path, src.replace(m.from, m.to));
      const run = spawnSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "scripts/check-client-alerts.mjs", "--no-mutate"], { encoding: "utf8" });
      ok(run.status !== 0, `caught: ${m.label}`);
    } finally {
      copyFileSync(backup, path);
    }
  }
}

for (const f of fails) console.log(`  FAIL ${f}`);
console.log(`\ncheck:client-alerts — ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
