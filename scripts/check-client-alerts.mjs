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
//  10. mutations of the shipped code are caught.
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
  channelOn,
  viewAlertDue,
  amountForReader,
  validateAlertPatch,
} = await import("@/lib/notifications/clientAlerts.js");
const { CLIENT_ALERT_COPY, staffAlertSms, smsSegments } = await import("@/lib/i18n/clientAlertCopy.js");
const { timesOrdinal, TIMES_ORDINAL_LANGUAGES } = await import("@/lib/i18n/timesOrdinal.js");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");
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

ok(CLIENT_ALERT_EVENTS.join(",") === "quote.viewed,quote.accepted,changeOrder.approved,client_ticket.opened", "the four events the owner named", CLIENT_ALERT_EVENTS);
for (const e of CLIENT_ALERT_EVENTS) {
  ok(Boolean(NOTIFICATION_TYPES[e]), `${e} is a catalog type (the bell renders it)`);
  ok(Boolean(RULE_TYPES[CLIENT_ALERTS[e].rule]), `${e}'s company switch "${CLIENT_ALERTS[e].rule}" is a type the rules route accepts`);
  ok(channelOn(null, e, "inApp", { role: "employee" }) === true, `${e}: bell + push default ON`);
  ok(channelOn(null, e, "sms", { role: "owner" }) === false, `${e}: text default OFF, even for an owner`);
}
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
section("10. Every word, all nine languages");
// ═══════════════════════════════════════════════════════════════════════════

{
  const langs = Object.keys(APP_MESSAGES);
  ok(langs.length === 9, "the app catalogue's nine", langs);
  ok(JSON.stringify(Object.keys(CLIENT_ALERT_COPY).sort()) === JSON.stringify([...langs].sort()), "the text copy has exactly the nine", Object.keys(CLIENT_ALERT_COPY));
  ok(JSON.stringify([...TIMES_ORDINAL_LANGUAGES].sort()) === JSON.stringify([...langs].sort()), "the ordinal has exactly the nine", TIMES_ORDINAL_LANGUAGES);
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
  { file: "lib/notifications/staffTexts.js", label: "STOP ignored", from: "    const allowed = await maySms({ companyId, phone: e164 }).catch(() => false);", to: "    const allowed = true;" },
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
];

if (!process.argv.includes("--no-mutate")) {
  section("12. Mutations");
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
