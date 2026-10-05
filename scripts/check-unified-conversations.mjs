// scripts/check-unified-conversations.mjs
//
//   npm run check:unified-conversations
//
// The client / job "Conversation" timeline (lib/conversations/clientTimeline.js)
// EXECUTED against a fake database holding two companies, with the fixtures
// the owner named:
//
//   · a phone written two ways ("+1 (514) 555-0101" on the client, the SMS
//     thread's "+15145550101", the WhatsApp wa_id "15145550101");
//   · an email in another case ("JANE.DOE@Example.COM");
//   · two clients sharing a phone — never folded in, shown as "possible";
//   · the family landline (one client has the number, the names disagree);
//   · a thread, a call, a ticket, a document log and a text from ANOTHER
//     company — including one whose clientId points at this company's client;
//   · a pair a person undid — stays out;
//   · the job window, at the millisecond on both ends;
//   · a crew member without the inbox — the real routes, executed, answer 403.
//
// Plus paging (every page boundary, ties included), the channel filter, the
// reply channel, the support session, "Not this client" (rejectClientMatch)
// and the tenant fence: every query the timeline makes is recorded and must
// name the company.
//
// The fake evaluates Prisma's where (AND / OR / NOT, equals + insensitive,
// in / notIn / not, lte / gte, JSON path, to-one relation filters) and the two
// $queryRaw phone pre-filters by reading their SQL — so removing a companyId
// from a where, or from the SQL, changes what comes back, and this file says
// so. That is the mutation test: delete one `companyId` from the lib and run
// this again.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phoneVariants,
  threadIdentity,
  threadVerdict,
  jobWindow,
  inJobWindow,
  isWindowed,
  mergePage,
  parseCursor,
  timelineAccess,
  replyBlockKey,
  loadClientTimeline,
  handleOf,
  JOB_WINDOW_AFTER_MS,
} from "@/lib/conversations/clientTimeline";
import { rejectClientMatch } from "@/lib/aiEmployee/webChatMatch";
import { CLIENT_MATCH_SELECT } from "@/lib/contacts/matchContact";
import { hasLevel } from "@/lib/permissions/enforce";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { rows as stubRows, resetDbStub } from "./fixtures/dbStub.mjs";
import { setCurrentMember, resetCurrentMemberStub } from "./fixtures/currentMemberStub.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ ${name}${extra !== undefined ? `  — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);
const eqSet = (a, b) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

// ═══════════════════════════════════════════════════════════════════════════
// The fake database
// ═══════════════════════════════════════════════════════════════════════════

const CO = "coA";
const OTHER = "coB";
const d = (s) => new Date(s);

function digits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function timeOf(v) {
  return v instanceof Date ? v.getTime() : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : v;
}

class FakeDb {
  constructor(tables) {
    this.t = tables;
    this.calls = [];
    this.writes = [];
    const RELATIONS = {
      messageThread: { channel: [(r) => r.channel || null, "messagingChannel"] },
      leadRequest: { quote: [(r) => this.t.quote.find((q) => q.id === r.quoteId) || null, "quote"] },
      clientTicketMessage: { ticket: [(r) => this.t.clientTicket.find((x) => x.id === r.ticketId) || null, "clientTicket"] },
      message: { email: [(r) => r.email || null, "emailMessage"] },
    };
    this.RELATIONS = RELATIONS;
    for (const model of Object.keys(tables)) {
      this[model] = this.delegate(model);
    }
  }

  cond(val, v) {
    if (v === null) return val === null || val === undefined;
    if (v instanceof Date) return timeOf(val) === v.getTime();
    if (typeof v !== "object" || Array.isArray(v)) return val === v;
    const insensitive = v.mode === "insensitive";
    for (const [op, arg] of Object.entries(v)) {
      if (op === "mode") continue;
      if (op === "path") continue;
      if (op === "equals") {
        if ("path" in v) {
          let cur = val;
          for (const p of v.path) cur = cur && typeof cur === "object" ? cur[p] : undefined;
          if (cur !== arg) return false;
        } else if (insensitive) {
          if (val == null || String(val).toLowerCase() !== String(arg).toLowerCase()) return false;
        } else if (arg === null ? val != null : val !== arg) return false;
      } else if (op === "in") {
        if (!arg.includes(val)) return false;
      } else if (op === "notIn") {
        if (arg.includes(val)) return false;
      } else if (op === "not") {
        if (arg !== null && typeof arg === "object" && !(arg instanceof Date)) {
          if (this.cond(val, arg)) return false;
        } else if (arg === null ? val == null : val === arg || val == null) return false;
      } else if (op === "lte" || op === "gte" || op === "lt" || op === "gt") {
        if (val == null) return false;
        const a = timeOf(val);
        const b = timeOf(arg);
        if (op === "lte" && !(a <= b)) return false;
        if (op === "gte" && !(a >= b)) return false;
        if (op === "lt" && !(a < b)) return false;
        if (op === "gt" && !(a > b)) return false;
      } else if (op === "contains") {
        if (val == null || !String(val).toLowerCase().includes(String(arg).toLowerCase())) return false;
      } else {
        throw new Error(`fake db: operator ${op} not modelled`);
      }
    }
    return true;
  }

  match(model, row, where = {}) {
    for (const [k, v] of Object.entries(where || {})) {
      if (k === "AND") {
        if (!(Array.isArray(v) ? v : [v]).every((w) => this.match(model, row, w))) return false;
        continue;
      }
      if (k === "OR") {
        if (!v.some((w) => this.match(model, row, w))) return false;
        continue;
      }
      if (k === "NOT") {
        if ((Array.isArray(v) ? v : [v]).some((w) => this.match(model, row, w))) return false;
        continue;
      }
      const rel = this.RELATIONS[model]?.[k];
      if (rel) {
        const related = rel[0](row);
        if (v === null) {
          if (related != null) return false;
          continue;
        }
        if (!related || !this.match(rel[1], related, v)) return false;
        continue;
      }
      if (!this.cond(row[k], v)) return false;
    }
    return true;
  }

  shape(model, row) {
    const out = { ...row };
    for (const [k, [get]] of Object.entries(this.RELATIONS[model] || {})) out[k] = get(row);
    return out;
  }

  sort(list, orderBy) {
    const keys = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o) => Object.entries(o));
    return [...list].sort((a, b) => {
      for (const [f, dir] of keys) {
        const x = timeOf(a[f]);
        const y = timeOf(b[f]);
        if (x === y) continue;
        const c = x < y ? -1 : 1;
        return dir === "desc" ? -c : c;
      }
      return 0;
    });
  }

  delegate(model) {
    const self = this;
    const read = (op, args = {}) => {
      self.calls.push({ model, op, where: args.where || {} });
      const hits = self.t[model].filter((r) => self.match(model, r, args.where));
      const sorted = self.sort(hits, args.orderBy);
      const taken = args.take ? sorted.slice(0, args.take) : sorted;
      return taken.map((r) => self.shape(model, r));
    };
    return {
      findMany: async (args) => read("findMany", args),
      findFirst: async (args) => read("findFirst", { ...args, take: 1 })[0] || null,
      findUnique: async (args) => read("findUnique", { ...args, take: 1 })[0] || null,
      count: async (args = {}) => read("count", args).length,
      create: async ({ data }) => {
        const row = { id: `${model}_${self.t[model].length + 1}`, createdAt: new Date(), ...data };
        self.t[model].push(row);
        self.writes.push({ model, op: "create", data });
        return row;
      },
      update: async ({ where, data }) => {
        const row = self.t[model].find((r) => self.match(model, r, where));
        if (!row) throw new Error(`fake db: ${model}.update found nothing`);
        Object.assign(row, data);
        self.writes.push({ model, op: "update", where, data });
        return row;
      },
      updateMany: async ({ where, data }) => {
        const hit = self.t[model].filter((r) => self.match(model, r, where));
        for (const r of hit) Object.assign(r, data);
        self.writes.push({ model, op: "updateMany", where, data });
        return { count: hit.length };
      },
    };
  }

  async $queryRaw(strings, ...values) {
    const sql = strings.join("$");
    const table = /FROM "(\w+)"/.exec(sql)?.[1];
    const model = table === "Client" ? "client" : table === "LeadRequest" ? "leadRequest" : null;
    if (!model) throw new Error(`fake db: raw query on ${table} not modelled`);
    const fenced = /"companyId" = \$/.test(sql);
    this.calls.push({ model, op: "$queryRaw", where: fenced ? { companyId: values[0] } : {}, raw: true });
    const like = String(values[values.length - 1] || "");
    const tail = like.replace(/^%/, "");
    return this.t[model]
      .filter((r) => (fenced ? r.companyId === values[0] : true))
      .filter((r) => r.phone && digits(r.phone).endsWith(tail))
      .map((r) => ({ id: r.id }));
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────

function fixtures() {
  const client = (id, companyId, name, phone = null, email = null) => ({ id, companyId, name, phone, email, address: null, city: null, province: null, country: null, language: null, createdAt: d("2025-01-01") });
  const ch = (platform) => ({ platform, name: platform });
  const thread = (id, companyId, platform, pe, extra = {}) => ({
    id, companyId, channel: ch(platform), participantExternalId: pe, participantName: null, clientId: null, jobId: null, quoteId: null, leadId: null,
    threadNumber: null, lastInboundAt: null, lastMessageAt: d("2026-06-01"), ...extra,
  });
  const msg = (id, threadId, direction, at, extra = {}) => ({ id, threadId, direction, private: direction === "note", body: `body ${id}`, sentAt: d(at), attachments: null, failedReason: null, activity: null, email: null, ...extra });

  return {
    client: [
      client("cJane", CO, "Jane Doe", "+1 (514) 555-0101", "Jane.Doe@Example.com"),
      client("cBob", CO, "Bob Smith", "514-555-0202", "bob@example.com"),
      client("cAnn", CO, "Ann Lee", "5145550303"),
      client("cMark", CO, "Mark Lee", "(514) 555-0303"),
      client("cMary", CO, "Mary Smith", "514-555-0404"),
      client("cJaneB", OTHER, "Jane Doe", "5145550101", "jane.doe@example.com"),
    ],
    job: [
      { id: "jJ1", companyId: CO, clientId: "cJane", quoteId: "qJ1", createdAt: d("2026-01-15T00:00:00Z"), completedAt: d("2026-02-01T00:00:00Z") },
      { id: "jJ2", companyId: CO, clientId: "cJane", quoteId: "qJ2", createdAt: d("2026-06-05T00:00:00Z"), completedAt: null },
      { id: "jB1", companyId: CO, clientId: "cBob", quoteId: null, createdAt: d("2026-03-01T00:00:00Z"), completedAt: null },
      { id: "jOther", companyId: OTHER, clientId: "cJaneB", quoteId: null, createdAt: d("2026-01-01T00:00:00Z"), completedAt: null },
    ],
    quote: [
      { id: "qJ1", companyId: CO, clientId: "cJane", quoteNumber: "Q-2026-0001", createdAt: d("2026-01-10T00:00:00.000Z") },
      { id: "qJ2", companyId: CO, clientId: "cJane", quoteNumber: "Q-2026-0002", createdAt: d("2026-06-01T00:00:00.000Z") },
    ],
    invoice: [{ id: "iJ1", companyId: CO, clientId: "cJane", invoiceNumber: "INV-1", jobId: "jJ1", quoteId: "qJ1" }],
    leadRequest: [
      { id: "lJane", companyId: CO, name: "Jane", email: "JANE.doe@example.com", phone: null, quoteId: null },
      { id: "lJane2", companyId: CO, name: null, email: null, phone: "514 555 0101", quoteId: null },
      { id: "lB", companyId: OTHER, name: "Jane", email: "jane.doe@example.com", phone: "5145550101", quoteId: null },
    ],
    messageThread: [
      thread("tSms", CO, "sms", "+15145550101", { lastInboundAt: d("2026-06-10") }),
      thread("tWa", CO, "whatsapp", "15145550101", { participantName: "Jane Doe" }),
      thread("tEmail", CO, "email", "JANE.DOE@Example.COM", { participantName: "Jane Doe" }),
      thread("tFb", CO, "facebook", "psid_1", { clientId: "cJane", participantName: "Jane Doe", lastInboundAt: d("2026-06-20") }),
      thread("tIg", CO, "instagram", "psid_2", { jobId: "jJ1" }),
      thread("tWebUndone", CO, "web", "visitor_1", { leadId: "lJane" }),
      thread("tWebLead", CO, "web", "visitor_2", { leadId: "lJane2" }),
      thread("tLinkedOther", CO, "sms", "+15145550202", { clientId: "cBob" }),
      thread("tShared", CO, "sms", "+15145550303"),
      thread("tFamily", CO, "whatsapp", "15145550404", { participantName: "John Smith" }),
      thread("tB", OTHER, "sms", "+15145550101"),
      thread("tB2", OTHER, "sms", "+15145550199", { clientId: "cJane" }),
    ],
    message: [
      msg("s0", "tSms", "in", "2026-01-09T23:59:59.999Z"),
      msg("s1", "tSms", "in", "2026-01-10T00:00:00.000Z"),
      msg("note", "tSms", "note", "2026-01-20T00:00:00Z"),
      msg("actCall", "tSms", "activity", "2026-01-21T00:00:00Z", { activity: { type: "call", direction: "in", outcome: "missed" } }),
      msg("actAssigned", "tSms", "activity", "2026-01-22T00:00:00Z", { activity: { type: "assigned", to: "Dave", by: "Ann" } }),
      msg("s5", "tSms", "out", "2026-01-30T00:00:00.000Z"),
      msg("s2", "tSms", "out", "2026-03-03T00:00:00.000Z"),
      msg("s3", "tSms", "in", "2026-03-03T00:00:00.001Z"),
      msg("s4", "tSms", "in", "2026-06-10T00:00:00Z"),
      msg("w1", "tWa", "in", "2026-06-12T00:00:00Z"),
      msg("e1", "tEmail", "in", "2026-06-15T00:00:00Z", { email: { subject: "Kitchen cabinets", fromAddress: "jane.doe@example.com", toAddresses: "quotes@co.test", sentVia: null, mailboxId: "mb1", mailbox: { provider: "google" } } }),
      msg("f1", "tFb", "in", "2026-06-20T00:00:00Z"),
      msg("i1", "tIg", "in", "2025-12-01T00:00:00Z"),
      msg("wu1", "tWebUndone", "in", "2026-06-18T00:00:00Z"),
      msg("wl1", "tWebLead", "in", "2026-06-19T00:00:00Z"),
      msg("o1", "tLinkedOther", "in", "2026-03-05T00:00:00Z"),
      msg("sh1", "tShared", "in", "2026-05-01T00:00:00Z"),
      msg("fam1", "tFamily", "in", "2026-05-02T00:00:00Z"),
      msg("b1", "tB", "in", "2026-06-21T00:00:00Z"),
      msg("b2", "tB2", "in", "2026-06-21T00:00:01Z"),
    ],
    threadClientMatch: [{ id: "tcm1", companyId: CO, threadId: "tWebUndone", clientId: "cJane", status: "undone", confidence: "certain", matchedOn: ["email"], createdAt: d("2026-06-18") }],
    voiceCall: [
      { id: "vc1", companyId: CO, clientId: "cJane", direction: "inbound", fromE164: "+15145550101", toE164: "+15145559999", createdAt: d("2026-01-25T00:00:00Z"), durationSec: 95, summary: "Asked about the deposit.", transcript: [{ role: "agent", content: "Hello" }, { role: "user", content: "About my deposit" }], archivedAt: null },
      { id: "vc2", companyId: CO, clientId: null, direction: "inbound", fromE164: "+15145550101", toE164: "+15145559999", createdAt: d("2026-06-22T00:00:00Z"), durationSec: 30, summary: null, transcript: null, archivedAt: null },
      { id: "vcArch", companyId: CO, clientId: "cJane", direction: "inbound", fromE164: "+15145550101", createdAt: d("2026-06-23T00:00:00Z"), durationSec: 1, summary: null, transcript: null, archivedAt: d("2026-06-24") },
      { id: "vcAnn", companyId: CO, clientId: null, direction: "inbound", fromE164: "+15145550303", createdAt: d("2026-05-03T00:00:00Z"), durationSec: 10, summary: null, transcript: null, archivedAt: null },
      { id: "vcB", companyId: OTHER, clientId: "cJane", direction: "inbound", fromE164: "+15145550101", createdAt: d("2026-06-25T00:00:00Z"), durationSec: 10, summary: "other company", transcript: null, archivedAt: null },
    ],
    clientTicket: [
      { id: "tk1", companyId: CO, clientId: "cJane", jobId: "jJ1", quoteId: null, subject: "Paint touch-up", body: "There is a scuff.", createdAt: d("2026-04-01T00:00:00Z") },
      { id: "tkB", companyId: OTHER, clientId: "cJane", jobId: null, quoteId: null, subject: "x", body: "other company", createdAt: d("2026-04-01T00:00:00Z") },
    ],
    clientTicketMessage: [
      { id: "tkm1", ticketId: "tk1", author: "member", authorName: "Dave", body: "Booked Tuesday.", createdAt: d("2026-04-02T00:00:00Z") },
      { id: "tkmB", ticketId: "tkB", author: "client", authorName: null, body: "other", createdAt: d("2026-04-02T00:00:00Z") },
    ],
    activityLog: [
      { id: "al1", companyId: CO, action: "quote.sent", entityType: "quote", entityId: "qJ1", actorName: "Dave", metadata: { to: "jane.doe@example.com" }, createdAt: d("2026-01-11T00:00:00Z") },
      { id: "al2", companyId: CO, action: "invoice.sent", entityType: "invoice", entityId: "iJ1", actorName: "Dave", metadata: { to: "jane.doe@example.com" }, createdAt: d("2026-02-02T00:00:00Z") },
      { id: "alOther", companyId: CO, action: "quote.viewed", entityType: "quote", entityId: "qJ1", actorName: null, metadata: null, createdAt: d("2026-01-12T00:00:00Z") },
      { id: "alB", companyId: OTHER, action: "quote.sent", entityType: "quote", entityId: "qJ1", actorName: "x", metadata: null, createdAt: d("2026-01-13T00:00:00Z") },
    ],
    smsDelivery: [
      { id: "sd1", companyId: CO, clientId: "cJane", purpose: "appointment_reminder", status: "delivered", errorCode: null, sentAt: d("2026-01-30T00:00:00.000Z") },
      { id: "sd2", companyId: CO, clientId: "cJane", purpose: "thread_reply", status: "delivered", errorCode: null, sentAt: d("2026-01-31T00:00:00Z") },
      { id: "sdB", companyId: OTHER, clientId: "cJane", purpose: "on_my_way", status: "delivered", errorCode: null, sentAt: d("2026-01-31T00:00:00Z") },
    ],
  };
}

const TENANT_MODELS = new Set(["client", "job", "quote", "invoice", "leadRequest", "messageThread", "threadClientMatch", "voiceCall", "clientTicket", "activityLog", "smsDelivery"]);

/** Every query names the company, or reads through something that did. */
function fenceViolations(db, companyId = CO) {
  const own = new Set(db.t.messageThread.filter((t) => t.companyId === companyId).map((t) => t.id));
  const bad = [];
  for (const c of db.calls) {
    if (TENANT_MODELS.has(c.model)) {
      if (c.where.companyId !== companyId) bad.push(`${c.model}.${c.op} without companyId`);
    } else if (c.model === "clientTicketMessage") {
      if (c.where.ticket?.companyId !== companyId) bad.push("clientTicketMessage without ticket.companyId");
    } else if (c.model === "message") {
      const ids = c.where.threadId?.in || (typeof c.where.threadId === "string" ? [c.where.threadId] : null);
      if (!ids) bad.push("message read without a thread set");
      else for (const id of ids) if (!own.has(id)) bad.push(`message read through foreign thread ${id}`);
    }
  }
  return bad;
}

const ALL_ACCESS = { contacts: true, calls: true, support: false, reply: true, link: true, read: true };
const AWAITING = { connected: false, mock: false, reason: "awaiting_meta_approval", channels: [] };

async function timeline(db, args) {
  return loadClientTimeline(db, { companyId: CO, access: ALL_ACCESS, connection: AWAITING, limit: 100, ...args });
}
const keysOf = (t) => (t?.entries || []).map((e) => e.key);

// ═══════════════════════════════════════════════════════════════════════════
section("1. Identity — phone formats and email case");
// ═══════════════════════════════════════════════════════════════════════════
ok("+1 (514) 555-0101 → E.164 and wa_id", eqSet(phoneVariants("+1 (514) 555-0101"), ["+15145550101", "15145550101"]));
ok("5145550101 → the same two", eqSet(phoneVariants("5145550101"), ["+15145550101", "15145550101"]));
ok("garbage phone → nothing", phoneVariants("call me").length === 0);
{
  const sms = threadIdentity({ channel: { platform: "sms" }, participantExternalId: "+15145550101" });
  const wa = threadIdentity({ channel: { platform: "whatsapp" }, participantExternalId: "15145550101" });
  const em = threadIdentity({ channel: { platform: "email" }, participantExternalId: "JANE.DOE@Example.COM" });
  const fb = threadIdentity({ channel: { platform: "facebook" }, participantExternalId: "1234567890123" });
  ok("SMS thread phone normalised", sms.phone === "+15145550101");
  ok("WhatsApp wa_id normalised to the same E.164", wa.phone === "+15145550101");
  ok("email thread address lower-cased", em.email === "jane.doe@example.com");
  ok("a Messenger PSID is NOT read as a phone number", fb.phone === null && fb.email === null);
  const fbLead = threadIdentity({ channel: { platform: "facebook" }, participantExternalId: "psid" }, { phone: "514.555.0101", email: "J@X.COM" });
  ok("a Messenger thread takes its lead's phone and email", fbLead.phone === "+15145550101" && fbLead.email === "j@x.com");
  ok("handleOf hides a PSID", handleOf({ channel: { platform: "facebook" }, participantExternalId: "psid" }) === null);
  ok("handleOf withholds a phone without contact access", handleOf({ channel: { platform: "sms" }, participantExternalId: "+15145550101" }, false) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The one rule — threadVerdict");
// ═══════════════════════════════════════════════════════════════════════════
{
  const F = fixtures();
  const C = (id) => F.client.find((c) => c.id === id);
  const T = (id) => F.messageThread.find((t) => t.id === id);
  const jane = C("cJane");
  const v = (thread, extra = {}) => threadVerdict({ companyId: CO, client: jane, thread, candidateClients: [jane], jobIds: ["jJ1", "jJ2"], quoteIds: ["qJ1", "qJ2"], ...extra });

  ok("SMS +15145550101 ↔ client '+1 (514) 555-0101' → matched", v(T("tSms")).state === "matched", v(T("tSms")));
  ok("WhatsApp 15145550101 → matched", v(T("tWa")).state === "matched");
  ok("email in another case → matched", v(T("tEmail")).state === "matched" && v(T("tEmail")).matchedOn.includes("email"));
  ok("explicitly linked → linked", v(T("tFb")).state === "linked");
  ok("filed to the client's job → linked via job", v(T("tIg")).state === "linked" && v(T("tIg")).via === "job");
  ok("linked to ANOTHER client → other (a person's link stands)", v(T("tLinkedOther")).state === "other");
  ok("a thread of another company → none", v(T("tB")).state === "none" && v(T("tB")).why === "thread_not_in_company");
  ok("a thread of another company pointing at this client's id → none", v(T("tB2")).state === "none");
  ok("a client of another company → none", threadVerdict({ companyId: CO, client: C("cJaneB"), thread: T("tSms") }).state === "none");
  ok(
    "a same-identity client in ANOTHER company does not make it ambiguous",
    v(T("tSms"), { candidateClients: [jane, C("cJaneB")] }).state === "matched",
  );
  const undone = [{ threadId: "tSms", clientId: "cJane", status: "undone" }];
  ok("an undone pair → none, never matched again", v(T("tSms"), { history: undone }).state === "none" && v(T("tSms"), { history: undone }).why === "undone");
  const stale = [{ threadId: "tSms", clientId: "cJane", status: "linked" }];
  ok("a live match whose link a person removed reads as rejected", v(T("tSms"), { history: stale }).state === "none");
  const ann = C("cAnn");
  const shared = threadVerdict({ companyId: CO, client: ann, thread: T("tShared"), candidateClients: [ann, C("cMark")] });
  ok("two clients sharing a phone → possible, never matched", shared.state === "possible", shared);
  const mary = C("cMary");
  const fam = threadVerdict({ companyId: CO, client: mary, thread: T("tFamily"), candidateClients: [mary] });
  ok("the family landline (names disagree) → possible", fam.state === "possible", fam);
  // The shared matcher's rule, inherited on purpose: a WhatsApp profile name
  // that disagrees with the client's is the landline case too, so it waits
  // for a person's "Link" rather than being folded in.
  const nick = v({ ...T("tWa"), participantName: "J. D." });
  ok("a disagreeing profile name on the client's own number → possible, one tap to link", nick.state === "possible", nick);
  const unnamed = v({ ...T("tWa"), participantName: null });
  ok("an unnamed sender on the client's number → matched", unnamed.state === "matched");
  ok("companyId is required", (() => { try { threadVerdict({ client: jane, thread: T("tSms") }); return false; } catch { return true; } })());
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The job window — at the millisecond");
// ═══════════════════════════════════════════════════════════════════════════
{
  const job = { createdAt: d("2026-01-15T00:00:00Z"), completedAt: d("2026-02-01T00:00:00Z") };
  const w = jobWindow({ job, quoteCreatedAt: d("2026-01-10T00:00:00.000Z") });
  ok("from = the quote's creation", w.from.toISOString() === "2026-01-10T00:00:00.000Z");
  ok("to = completion + 30 days", w.to.getTime() === d("2026-02-01T00:00:00Z").getTime() + JOB_WINDOW_AFTER_MS && w.to.toISOString() === "2026-03-03T00:00:00.000Z");
  ok("the first millisecond is in", inJobWindow("2026-01-10T00:00:00.000Z", w));
  ok("one millisecond before is out", !inJobWindow("2026-01-09T23:59:59.999Z", w));
  ok("the last millisecond is in", inJobWindow("2026-03-03T00:00:00.000Z", w));
  ok("one millisecond after is out", !inJobWindow("2026-03-03T00:00:00.001Z", w));
  ok("no quote → from the job's creation", jobWindow({ job }).from.toISOString() === "2026-01-15T00:00:00.000Z");
  ok("not complete → open-ended", jobWindow({ job: { createdAt: d("2026-01-15") } }).to === null);
  ok("one job → not windowed", !isWindowed({ scope: "job", job: {}, clientJobCount: 1 }));
  ok("two jobs → windowed", isWindowed({ scope: "job", job: {}, clientJobCount: 2 }));
  ok("'All of this client's messages' lifts it", !isWindowed({ scope: "all", job: {}, clientJobCount: 2 }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Jane's whole timeline (client page)");
// ═══════════════════════════════════════════════════════════════════════════
const JANE_ALL = [
  "m:s0", "m:s1", "m:actCall", "m:s5", "m:s2", "m:s3", "m:s4", "m:w1", "m:e1", "m:f1", "m:i1", "m:wl1",
  "call:vc1", "call:vc2", "tk:tk1", "tm:tkm1", "doc:al1", "doc:al2", "sms:sd1",
];
{
  const db = new FakeDb(fixtures());
  const t = await timeline(db, { clientId: "cJane" });
  const keys = keysOf(t);
  ok("every channel's entry is there, nothing else", eqSet(keys, JANE_ALL), { missing: JANE_ALL.filter((k) => !keys.includes(k)), extra: keys.filter((k) => !JANE_ALL.includes(k)) });
  for (const k of ["m:b1", "m:b2", "call:vcB", "tk:tkB", "tm:tkmB", "doc:alB", "sms:sdB"]) ok(`another company's ${k} never appears`, !keys.includes(k));
  ok("private notes stay out", !keys.includes("m:note"));
  ok("non-call activity rows stay out", !keys.includes("m:actAssigned"));
  ok("the undone pair stays out", !keys.includes("m:wu1"));
  ok("another client's linked thread stays out", !keys.includes("m:o1"));
  ok("the shared-phone thread stays out", !keys.includes("m:sh1"));
  ok("an archived call stays out", !keys.includes("call:vcArch"));
  ok("thread_reply receipts are not listed twice", !keys.includes("sms:sd2"));
  ok("a document log that is not a send stays out", !keys.includes("doc:alOther"));
  ok("newest first from the server", keys[0] === "call:vc2", keys.slice(0, 3));
  const byKey = new Map(t.entries.map((e) => [e.key, e]));
  ok("channel badges: SMS, WhatsApp, email, Facebook, Instagram, web, call, portal", ["sms", "whatsapp", "email", "facebook", "instagram", "web", "call", "portal"].every((c) => t.entries.some((e) => e.channel === c)));
  ok("each message links back to its thread", byKey.get("m:w1").href === "/app/messages?thread=tWa");
  ok("a brought-number call row is a call entry", byKey.get("m:actCall").channel === "call" && byKey.get("m:actCall").labelKey === "app.messages.activity.call.in.missed");
  ok("the quote email names its number", byKey.get("doc:al1").labelParams.number === "Q-2026-0001" && byKey.get("doc:al1").href === "/app/quotes/qJ1");
  ok("the call carries its summary and transcript", byKey.get("call:vc1").summary === "Asked about the deposit." && byKey.get("call:vc1").transcript.length === 2);
  ok("chips: only channels with something behind them", eqSet(t.channels, ["facebook", "instagram", "whatsapp", "web", "sms", "email", "call", "portal"]), t.channels);
  ok("sources list how each thread got here", t.sources.find((s) => s.threadId === "tSms")?.state === "matched" && t.sources.find((s) => s.threadId === "tIg")?.via === "job");
  ok("the web thread matched through its lead's phone", t.sources.find((s) => s.threadId === "tWebLead")?.state === "matched");
  ok("no possible matches for Jane", t.possible.length === 0);
  ok("reply goes to the newest INBOUND message's channel (Facebook)", t.reply?.platform === "facebook" && t.reply.threadId === "tFb", t.reply);
  ok("…and says why it cannot send while Meta has not approved", t.reply?.blockKey === "app.messages.compose.disabled.awaitingApproval");
  const fence = fenceViolations(db);
  ok("TENANT FENCE: every query names the company", fence.length === 0, fence);
  ok("no write on a read", db.writes.length === 0);

  // Belt and braces: a thread query that forgot the company (simulated here by
  // a fake that ignores it) still surfaces nothing foreign, because every
  // thread is re-checked in JS and again by threadVerdict.
  const leaky = new FakeDb(fixtures());
  const realMatch = leaky.match.bind(leaky);
  leaky.match = (model, row, where) => {
    if (model !== "messageThread" || !where) return realMatch(model, row, where);
    const { companyId: _ignored, ...rest } = where;
    return realMatch(model, row, rest);
  };
  const lt = await timeline(leaky, { clientId: "cJane" });
  ok("a leaky thread query still shows nothing from another company", !keysOf(lt).includes("m:b1") && !keysOf(lt).includes("m:b2"), keysOf(lt));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The job page — window, explicit ties, the toggle");
// ═══════════════════════════════════════════════════════════════════════════
{
  const F = fixtures();
  const db = new FakeDb(F);
  const jJ1 = F.job.find((j) => j.id === "jJ1");
  const t = await timeline(db, { clientId: "cJane", job: jJ1 });
  const keys = keysOf(t);
  const expect = ["m:s1", "m:actCall", "m:s5", "m:s2", "m:i1", "call:vc1", "tk:tk1", "tm:tkm1", "doc:al1", "doc:al2", "sms:sd1"];
  ok("windowed to quote → completion + 30 days, explicit ties kept", eqSet(keys, expect), { missing: expect.filter((k) => !keys.includes(k)), extra: keys.filter((k) => !expect.includes(k)) });
  ok("1 ms before the quote: out", !keys.includes("m:s0"));
  ok("the quote's own millisecond: in", keys.includes("m:s1"));
  ok("completion + 30 days exactly: in", keys.includes("m:s2"));
  ok("1 ms after: out", !keys.includes("m:s3"));
  ok("filed to this job but dated before it: in", keys.includes("m:i1"));
  ok("a ticket on this job after the window: in", keys.includes("tk:tk1") && keys.includes("tm:tkm1"));
  ok("the window is reported", t.window.windowed === true && t.window.jobCount === 2 && new Date(t.window.to).toISOString() === "2026-03-03T00:00:00.000Z");
  ok("TENANT FENCE (job view)", fenceViolations(db).length === 0, fenceViolations(db));

  const all = await timeline(new FakeDb(fixtures()), { clientId: "cJane", job: jJ1, scope: "all" });
  ok("'All of this client's messages' = the client page", eqSet(keysOf(all), JANE_ALL));
  ok("…and says it is not windowed", all.window.windowed === false);

  const jB1 = F.job.find((j) => j.id === "jB1");
  const bob = await timeline(new FakeDb(fixtures()), { clientId: "cBob", job: jB1 });
  ok("a client with one job: no window, the linked thread shows", bob.window.windowed === false && keysOf(bob).includes("m:o1"));
  ok("a job of another client is refused", (await timeline(new FakeDb(fixtures()), { clientId: "cJane", job: jB1 })) === null);
  ok("another company's client is not found", (await timeline(new FakeDb(fixtures()), { clientId: "cJaneB" })) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Possible matches — never in the timeline");
// ═══════════════════════════════════════════════════════════════════════════
{
  const ann = await timeline(new FakeDb(fixtures()), { clientId: "cAnn" });
  ok("Ann: the shared-phone thread is a possible match", ann.possible.some((p) => p.threadId === "tShared" && p.why === "shared_identifier"), ann.possible);
  ok("Ann: and not in her timeline", !keysOf(ann).includes("m:sh1"));
  ok("Ann: the unlinked call on the shared phone is not hers either", !keysOf(ann).includes("call:vcAnn"));
  const mark = await timeline(new FakeDb(fixtures()), { clientId: "cMark" });
  ok("Mark: the same thread is possible for him too", mark.possible.some((p) => p.threadId === "tShared"));
  const mary = await timeline(new FakeDb(fixtures()), { clientId: "cMary" });
  ok("Mary: the family landline is possible, not hers", mary.possible.some((p) => p.threadId === "tFamily") && !keysOf(mary).includes("m:fam1"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Paging — every boundary, ties included");
// ═══════════════════════════════════════════════════════════════════════════
{
  const full = keysOf(await timeline(new FakeDb(fixtures()), { clientId: "cJane" }));
  for (const size of [1, 2, 3, 5, 7]) {
    const db = new FakeDb(fixtures());
    const seen = [];
    let cursor = null;
    let guard = 0;
    do {
      const page = await loadClientTimeline(db, { companyId: CO, clientId: "cJane", access: ALL_ACCESS, connection: AWAITING, limit: size, cursor });
      seen.push(...keysOf(page));
      cursor = page.nextCursor;
      guard++;
    } while (cursor && guard < 100);
    ok(`pages of ${size}: same entries, same order, no repeats`, seen.join("|") === full.join("|"), { seen: seen.length, full: full.length });
    ok(`pages of ${size}: fence holds on every page`, fenceViolations(db).length === 0);
  }
  ok("a nonsense cursor is no cursor", parseCursor("not-a-cursor") === null && parseCursor("2026-01-01T00:00:00Z|") === null);
  const merged = mergePage([{ entries: [{ key: "a", at: "2026-01-02" }, { key: "b", at: "2026-01-01" }], take: 2, fetched: 2, oldestAt: d("2026-01-01").getTime() }, { entries: [{ key: "c", at: "2025-12-01" }], take: 2, fetched: 1, oldestAt: d("2025-12-01").getTime() }], { limit: 5 });
  ok("a full source holds back older entries from the others", merged.entries.map((e) => e.key).join() === "a,b" && merged.hasMore);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The channel filter and the reply channel");
// ═══════════════════════════════════════════════════════════════════════════
{
  const email = await timeline(new FakeDb(fixtures()), { clientId: "cJane", channel: "email" });
  ok("email: the filed email and the document emails only", eqSet(keysOf(email), ["m:e1", "doc:al1", "doc:al2"]), keysOf(email));
  const calls = await timeline(new FakeDb(fixtures()), { clientId: "cJane", channel: "call" });
  ok("call: receptionist calls and business-number call rows", eqSet(keysOf(calls), ["call:vc1", "call:vc2", "m:actCall"]), keysOf(calls));
  ok("call chip: the reply still goes to the newest inbound message (no reply channel is a call)", calls.reply?.platform === "facebook", calls.reply);
  const portal = await timeline(new FakeDb(fixtures()), { clientId: "cJane", channel: "portal" });
  ok("portal: the request and its reply", eqSet(keysOf(portal), ["tk:tk1", "tm:tkm1"]));
  const sms = await timeline(new FakeDb(fixtures()), { clientId: "cJane", channel: "sms" });
  ok("sms: texts and automatic texts, no call rows", eqSet(keysOf(sms), ["m:s0", "m:s1", "m:s5", "m:s2", "m:s3", "m:s4", "sms:sd1"]), keysOf(sms));
  ok("sms: reply goes out as a text, nothing blocks it", sms.reply?.platform === "sms" && sms.reply.blockKey === null, sms.reply);
  const bogus = await timeline(new FakeDb(fixtures()), { clientId: "cJane", channel: "carrier-pigeon" });
  ok("an unknown channel is no filter, never an empty timeline", eqSet(keysOf(bogus), JANE_ALL));

  ok("reply block: email never waits on Meta", replyBlockKey({ platform: "email", connection: AWAITING }) === null);
  ok("reply block: web chat never waits on Meta", replyBlockKey({ platform: "web", connection: AWAITING }) === null);
  ok("reply block: demo company sends nothing", replyBlockKey({ platform: "sms", connection: { mock: true, connected: true } }) === "app.messages.compose.disabled.demo");
  const connected = { connected: true, mock: false, reason: null };
  ok("reply block: WhatsApp past 24 h is closed", replyBlockKey({ platform: "whatsapp", connection: connected, lastInboundAt: d("2026-01-01"), now: d("2026-01-03") }) === "app.messages.window.closed");
  ok("reply block: WhatsApp inside 24 h is open", replyBlockKey({ platform: "whatsapp", connection: connected, lastInboundAt: d("2026-01-01T00:00:00Z"), now: d("2026-01-01T05:00:00Z") }) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Who may see what — crew, contacts, support");
// ═══════════════════════════════════════════════════════════════════════════
{
  const crew = { id: "m_crew", role: "employee", permissions: { ...PERMISSION_PRESETS.worker.values } };
  const a = timelineAccess({ member: crew, full: crew, hasLevel });
  ok("crew (requests: none) cannot read client conversations", a.read === false && a.reply === false);
  const est = { id: "m_est", role: "employee", permissions: { ...PERMISSION_PRESETS.estimator.values } };
  const e = timelineAccess({ member: est, full: est, hasLevel });
  ok("an estimator reads and replies", e.read && e.reply);
  const support = { impersonation: true, role: "owner" };
  const s = timelineAccess({ member: support, full: support, hasLevel });
  ok("a support session reads everything and replies to nothing", s.read && s.contacts && s.calls && !s.reply && !s.link);

  const db = new FakeDb(fixtures());
  const t = await loadClientTimeline(db, { companyId: CO, clientId: "cJane", access: { ...s }, connection: AWAITING, limit: 100 });
  const e1 = t.entries.find((x) => x.key === "m:e1");
  ok("support session: a Gmail message's words are hidden", e1.hiddenInSupportView === true && e1.body !== "body e1" && e1.subject === "Email from client");
  ok("support session: the server says no reply", t.can.reply === false && t.can.link === false);

  const noContacts = await loadClientTimeline(new FakeDb(fixtures()), { companyId: CO, clientId: "cJane", access: { ...ALL_ACCESS, contacts: false, calls: false }, connection: AWAITING, limit: 100 });
  ok("without contact access: no phone numbers or addresses", noContacts.entries.every((x) => !x.number && !x.to && !x.from) && noContacts.sources.every((x) => x.handle === null));
  ok("without call access: no receptionist calls", !keysOf(noContacts).some((k) => k.startsWith("call:")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The routes, executed — crew gets 403 before any read");
// ═══════════════════════════════════════════════════════════════════════════
{
  resetDbStub();
  resetCurrentMemberStub();
  stubRows.member = [
    { id: "m_crew", userId: "u_crew", role: "employee", companyId: CO, permissions: { ...PERMISSION_PRESETS.worker.values } },
    { id: "m_namesonly", userId: "u_n", role: "employee", companyId: CO, permissions: { ...PERMISSION_PRESETS.estimator.values, clientsProperties: "name_address_only" } },
  ];
  const jobRoute = await import("../app/api/jobs/[id]/conversation/route.js");
  const clientRoute = await import("../app/api/clients/[id]/conversation/route.js");
  const call = async (route, id) => route.GET(new Request(`http://x.test/api/x/${id}/conversation`), { params: Promise.resolve({ id }) });

  setCurrentMember({ id: "m_crew", userId: "u_crew", role: "employee", companyId: CO });
  const r1 = await call(jobRoute, "jJ1");
  const b1 = await r1.json();
  ok("crew → job conversation: 403", r1.status === 403 && b1.reason === "no_inbox_access", { status: r1.status, b1 });
  const r2 = await call(clientRoute, "cJane");
  ok("crew → client conversation: 403", r2.status === 403);

  setCurrentMember({ id: "m_namesonly", userId: "u_n", role: "employee", companyId: CO });
  const r3 = await call(clientRoute, "cJane");
  const b3 = await r3.json();
  ok("inbox but no client contact access → client page 403", r3.status === 403 && b3.reason === "no_contact_access", b3);

  setCurrentMember(null);
  const r4 = await call(jobRoute, "jJ1");
  ok("nobody signed in → 401", r4.status === 401);

  const src = (p) => readFileSync(join(ROOT, p), "utf8");
  for (const p of ["app/api/jobs/[id]/conversation/route.js", "app/api/clients/[id]/conversation/route.js"]) {
    const s = src(p);
    ok(`${p}: refuses before it loads`, s.indexOf("!access.read") > -1 && s.indexOf("!access.read") < s.indexOf("loadClientTimeline(db"));
  }
  ok("job route: scoped to the member's own jobs", /assignedJobWhere\(full\)/.test(src("app/api/jobs/[id]/conversation/route.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. 'Not this client' — rejectClientMatch");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = new FakeDb(fixtures());
  const res = await rejectClientMatch({ prisma: db, companyId: CO, threadId: "tSms", clientId: "cJane", userId: "u1" });
  ok("a matched thread can be refused", res.ok && res.rejected);
  const row = db.t.threadClientMatch.find((r) => r.threadId === "tSms" && r.clientId === "cJane");
  ok("…as an 'undone' ThreadClientMatch row", row?.status === "undone" && row.companyId === CO && row.undoneByUserId === "u1");
  db.calls.length = 0;
  const after = await timeline(db, { clientId: "cJane" });
  ok("…and the thread leaves the timeline for good", !keysOf(after).some((k) => ["m:s0", "m:s1", "m:s4"].includes(k)));
  ok("…without touching the thread's clientId", db.t.messageThread.find((t) => t.id === "tSms").clientId === null);
  const again = await rejectClientMatch({ prisma: db, companyId: CO, threadId: "tSms", clientId: "cJane" });
  ok("refusing twice writes once", again.already === true && db.t.threadClientMatch.filter((r) => r.threadId === "tSms").length === 1);
  const person = await rejectClientMatch({ prisma: db, companyId: CO, threadId: "tFb", clientId: "cJane" });
  ok("a thread a PERSON linked is not unlinked from here (409)", !person.ok && person.status === 409 && person.reason === "linked_by_person");
  const foreignThread = await rejectClientMatch({ prisma: db, companyId: CO, threadId: "tB", clientId: "cJane" });
  ok("another company's thread → 404", !foreignThread.ok && foreignThread.status === 404);
  const foreignClient = await rejectClientMatch({ prisma: db, companyId: CO, threadId: "tWa", clientId: "cJaneB" });
  ok("another company's client → 404", !foreignClient.ok && foreignClient.status === 404);
  // The web-chat matcher's own live link is undone through its own path.
  db.t.messageThread.find((t) => t.id === "tWa").clientId = "cJane";
  db.t.threadClientMatch.push({ id: "live1", companyId: CO, threadId: "tWa", clientId: "cJane", status: "linked", confidence: "certain", matchedOn: ["phone"], createdAt: d("2026-06-12") });
  const live = await rejectClientMatch({ prisma: db, companyId: CO, threadId: "tWa", clientId: "cJane" });
  ok("a machine-made link is undone (clientId cleared)", live.ok && live.unlinked && db.t.messageThread.find((t) => t.id === "tWa").clientId === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. No new sender, no dead control, every string in nine languages");
// ═══════════════════════════════════════════════════════════════════════════
{
  const comp = readFileSync(join(ROOT, "app/components/conversations/ClientConversation.js"), "utf8");
  const posts = [...comp.matchAll(/fetchJson\(`([^`]+)`/g)].map((m) => m[1]);
  const ALLOWED = /^\/api\/messaging\/threads\/\$\{encodeURIComponent\([\w.]+\)\}(\/reply|\/client-match|\/attachments)?$/;
  ok("the component reaches only the inbox's existing routes", posts.length === 4 && posts.every((p) => ALLOWED.test(p)), posts);
  ok("the timeline itself is read through its own GET", comp.includes("/conversation`") && comp.includes("fetchJson(urlFor("));
  ok("replies go through the inbox's reply route", comp.includes("/reply`") && comp.includes('method: "POST", body: { text: body }'));
  ok("a support session gets no reply box (useViewOnly)", comp.includes("useViewOnly()") && /canReply = canAct && Boolean\(data\?\.can\?\.reply\)/.test(comp));
  ok("a refused read draws nothing", /err\.status === 403 \|\| err\.status === 404\) setHidden\(true\)/.test(comp));
  const buttons = comp.split("<button").slice(1).map((chunk) => chunk.slice(0, 700));
  const BTN_44 = /const BTN = "[^"]*min-h-\[44px\]/.test(comp) && /const BTN_PRIMARY = "[^"]*min-h-\[44px\]/.test(comp) && /const LINK = "[^"]*min-h-\[44px\]/.test(comp);
  ok("the shared button and link styles are 44px tall", BTN_44);
  ok("every <button> is 44px tall", buttons.length >= 8 && buttons.every((b) => /className=\{BTN(_PRIMARY)?\}/.test(b) || b.includes("min-h-[44px]")), buttons.filter((b) => !(/className=\{BTN(_PRIMARY)?\}/.test(b) || b.includes("min-h-[44px]"))).map((b) => b.slice(0, 80)));

  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
  const libSrc = readFileSync(join(ROOT, "lib/conversations/clientTimeline.js"), "utf8");
  const used = [...new Set([...comp.matchAll(/"(app\.conversation\.[A-Za-z.]+)"/g), ...libSrc.matchAll(/"(app\.conversation\.[A-Za-z.]+)"/g)].map((m) => m[1]))];
  ok("the component's keys were found", used.length > 40, used.length);
  for (const [lang, table] of Object.entries(APP_MESSAGES)) {
    const missing = used.filter((k) => typeof table[k] !== "string" || !table[k].trim());
    ok(`${lang}: every app.conversation key`, missing.length === 0, missing);
  }
  ok("nine languages", Object.keys(APP_MESSAGES).length === 9);

  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  ok("package.json: check:unified-conversations exists", Boolean(pkg.scripts["check:unified-conversations"]));
  ok("package.json: check:all runs it", pkg.scripts["check:all"].includes("check:unified-conversations"));
  const client = readFileSync(join(ROOT, "app/app/clients/[id]/page.js"), "utf8");
  const job = readFileSync(join(ROOT, "app/app/jobs/[id]/JobDetail.js"), "utf8");
  ok("the client page renders it", client.includes("<ClientConversation clientId={client.id} />"));
  ok("the job page renders it", job.includes("<ClientConversation jobId={job.id} />"));
  ok("CLIENT_MATCH_SELECT carries companyId (the matcher's tenancy proof)", CLIENT_MATCH_SELECT.companyId === true);
}

console.log(`\ncheck-unified-conversations: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
