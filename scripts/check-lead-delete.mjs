// scripts/check-lead-delete.mjs
//
//   npm run check:lead-delete
//
// The owner, 2026-10-05: "There should be a way to delete leads… I have a few
// test ones there, and some that were imported from (I think) conversations
// that may not have been a lead. They should be able to be deleted, not just
// marked lost."
//
// Every claim lib/leads/deleteLead.js and the two DELETE routes make is
// EXECUTED here against a scripted database — the real handlers, with
// "@/lib/db", "@/lib/currentMember" and "next/server" stubbed the way
// check-lead-linking.mjs does it:
//
//   1. The pure pieces against hostile input: the id cleaner, the "not a
//      lead" mark, the conversation-source hint, the audit sentence.
//   2. DELETE /api/leads/[id]: the lead and its own children go; a quote, a
//      client, the conversation and its messages, calls, consent, funnel
//      rows, drawing reads survive with only their pointer cleared; a queued
//      speed-to-lead call is cancelled; the audit row says who, what, when.
//   3. Refusals that change NOTHING (a byte-for-byte snapshot of every
//      table): another company's lead → 404; crew → 403; an estimator
//      (edit, not delete) → 403; a read-only support session → 403, both
//      through the route's own gate and through getCurrentMember's throw.
//   4. "Don't create a lead from this conversation again": the thread is
//      marked, its earlier verdict kept, and the conversation capture makes
//      no lead on the next message — while the SAME thread deleted without
//      the mark does make one (the control, so the mark is what stops it).
//   5. DELETE /api/leads (bulk): only the selected ids within the caller's
//      company; junk and foreign ids ignored and counted; caps and empties.
//   6. The other two re-creators: a deleted Meta lead form is not imported
//      again (the audit row is the tombstone), the AI employee books no
//      callback lead on a marked thread, and call recovery will not rebuild
//      a lead it already recovered once.
//   7. The board only offers delete to the delete rung.

import { register } from "node:module";
import { readFileSync } from "node:fs";

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

// ── Stubs ───────────────────────────────────────────────────────────────────
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
      source: "export const getCurrentMember = async () => { const s = globalThis.__FQ_SESSION; if (s && s.__throw) { const e = new Error(s.__throw.message); e.status = s.__throw.status; throw e; } return s; };" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const {
  cleanLeadIds,
  withNotALeadMark,
  isMarkedNotALead,
  supportSessionRefusal,
  leadDeletedSummary,
  MAX_DELETE_BATCH,
  LEAD_DELETED_ACTION,
} = await import("@/lib/leads/deleteLead");
const { CONVERSATION_LEAD_SOURCES, looksLikeConversationLead } = await import("@/lib/leads/conversationSources");
const { SOURCE_FOR_PLATFORM } = await import("@/lib/messaging/platforms");
const oneRoute = await import("@/app/api/leads/[id]/route.js");
const listRoute = await import("@/app/api/leads/route.js");
const { captureLeadFromConversation } = await import("@/lib/leads/conversationLead");
const { importMetaLead } = await import("@/lib/meta/leadsImport");
const { runToolForCompany } = await import("@/lib/aiEmployee/tools");
const { recoverLeadFromCall, RECOVERY_REASONS } = await import("@/lib/ai/callLeadRecovery");

// ── A scripted database ─────────────────────────────────────────────────────
//
// Tables of plain rows and a matcher that understands the handful of where
// shapes the code under test uses. An operator it does not know THROWS, so a
// new query shape cannot be silently read as "matches everything".
const CO = "co_1";
const OTHER = "co_2";
const R = () => globalThis.__FQ_ROWS;

function getPath(obj, path) {
  let x = obj;
  for (const p of path) x = x && typeof x === "object" ? x[p] : undefined;
  return x;
}
function matchVal(v, cond) {
  if (cond === null) return v === null || v === undefined;
  if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    if ("path" in cond) {
      const x = getPath(v, cond.path);
      if ("equals" in cond) return x === cond.equals;
      if ("array_contains" in cond) return Array.isArray(x) && cond.array_contains.every((c) => x.includes(c));
      throw new Error(`unsupported json filter ${JSON.stringify(cond)}`);
    }
    let pass = true;
    for (const [op, val] of Object.entries(cond)) {
      if (op === "in") pass = pass && val.includes(v);
      else if (op === "not") pass = pass && (val === null ? v !== null && v !== undefined : v !== val);
      else if (op === "gte") pass = pass && v != null && new Date(v) >= new Date(val);
      else if (op === "lte") pass = pass && v != null && new Date(v) <= new Date(val);
      else throw new Error(`unsupported operator ${op}`);
    }
    return pass;
  }
  return v === cond;
}
function matches(row, where = {}) {
  for (const [k, c] of Object.entries(where || {})) {
    if (c === undefined) continue;
    if (k === "OR") {
      if (!c.some((w) => matches(row, w))) return false;
      continue;
    }
    if (k === "AND") {
      if (!c.every((w) => matches(row, w))) return false;
      continue;
    }
    if (k === "funnel") {
      const f = R().funnel.find((x) => x.id === row.funnelId);
      if (!f || !matches(f, c)) return false;
      continue;
    }
    if (!matchVal(row[k], c)) return false;
  }
  return true;
}
const clone = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));

function model(name) {
  const rows = () => R()[name];
  return {
    async findFirst({ where } = {}) {
      return clone(rows().find((r) => matches(r, where)) || null);
    },
    async findUnique({ where } = {}) {
      return clone(rows().find((r) => matches(r, where)) || null);
    },
    async findMany({ where } = {}) {
      return clone(rows().filter((r) => matches(r, where)));
    },
    async count({ where } = {}) {
      return rows().filter((r) => matches(r, where)).length;
    },
    async create({ data }) {
      const row = { id: `${name}_${rows().length + 1}`, createdAt: new Date().toISOString(), ...clone(data) };
      rows().push(row);
      globalThis.__FQ_WRITES.push([`${name}.create`, data]);
      return clone(row);
    },
    async update({ where, data }) {
      const row = rows().find((r) => matches(r, where));
      if (!row) throw new Error(`${name}.update: no row`);
      Object.assign(row, clone(data));
      globalThis.__FQ_WRITES.push([`${name}.update`, where]);
      return clone(row);
    },
    async updateMany({ where, data }) {
      const hit = rows().filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, clone(data));
      globalThis.__FQ_WRITES.push([`${name}.updateMany`, where]);
      return { count: hit.length };
    },
    async deleteMany({ where }) {
      const hit = rows().filter((r) => matches(r, where));
      const ids = new Set(hit.map((r) => r.id));
      R()[name] = rows().filter((r) => !ids.has(r.id));
      // The schema's declared cascades from LeadRequest — and only those.
      if (name === "leadRequest") {
        R().leadNote = R().leadNote.filter((n) => !ids.has(n.leadId));
        R().leadIdentityLink = R().leadIdentityLink.filter((l) => !ids.has(l.leadId));
      }
      globalThis.__FQ_WRITES.push([`${name}.deleteMany`, where]);
      return { count: hit.length };
    },
  };
}
const MODELS = [
  "member", "user", "leadRequest", "leadNote", "leadIdentityLink", "messageThread", "message", "voiceCall",
  "callConsent", "voiceCallTask", "funnel", "funnelResponse", "funnelVisit", "quoteDocument", "planRead",
  "quote", "client", "job", "invoice", "activityLog", "companyServiceCategory",
];
function makeDb() {
  const db = {};
  for (const m of MODELS) db[m] = model(m);
  db.$transaction = async (fn) => fn(db);
  return db;
}

const day = (n) => new Date(Date.UTC(2026, 8, 1) + n * 86400000).toISOString();

function seed() {
  globalThis.__FQ_WRITES = [];
  globalThis.__FQ_ROWS = {
    member: [
      { id: "m_owner", userId: "u_owner", role: "owner", companyId: CO, permissions: null },
      { id: "m_manager", userId: "u_manager", role: "supervisor", companyId: CO,
        permissions: { requests: "view_create_edit_delete", quotes: "view_create_edit_delete" } },
      { id: "m_estimator", userId: "u_est", role: "employee", companyId: CO,
        permissions: { requests: "view_create_edit", quotes: "view_create_edit" } },
      { id: "m_crew", userId: "u_crew", role: "employee", companyId: CO,
        permissions: { requests: "none", quotes: "none", jobs: "view_only" } },
      { id: "m_other_owner", userId: "u_oo", role: "owner", companyId: OTHER, permissions: null },
    ],
    user: [
      { id: "u_owner", name: "Olive Owner", email: "o@x" },
      { id: "u_manager", name: "Manny Manager", email: "m@x" },
    ],
    leadRequest: [
      // Linked to a quote, a thread, calls, consent, funnel rows, a drawing read.
      { id: "lead_quoted", companyId: CO, name: "Quinn Quoted", source: "self_quote", status: "contacted",
        createdAt: day(-3), quoteId: "q_1", metaLeadId: null, conversationEvidence: null },
      // From a Facebook conversation — the owner's "imported from conversations".
      { id: "lead_chat", companyId: CO, name: "Chatty Cathy", source: "meta_messenger", status: "new",
        createdAt: day(-2), quoteId: null, metaLeadId: null, conversationEvidence: { threadId: "T_chat", platform: "facebook" } },
      // Same shape, for the control that is deleted WITHOUT the mark.
      { id: "lead_chat2", companyId: CO, name: "Second Chat", source: "meta_messenger", status: "new",
        createdAt: day(-2), quoteId: null, metaLeadId: null, conversationEvidence: { threadId: "T_chat2", platform: "facebook" } },
      // A Meta lead form, with a second submission folded into it.
      { id: "lead_form", companyId: CO, name: "Form Fran", source: "meta_lead_form", status: "new",
        createdAt: day(-1), quoteId: null, metaLeadId: "LG_100", conversationEvidence: null },
      // A plain test lead.
      { id: "lead_test", companyId: CO, name: "Test Test", source: "manual", status: "new",
        createdAt: day(0), quoteId: null, metaLeadId: null, conversationEvidence: null },
      { id: "lead_test2", companyId: CO, name: "Test Two", source: "manual", status: "lost",
        createdAt: day(0), quoteId: null, metaLeadId: null, conversationEvidence: null },
      // Another company's.
      { id: "lead_foreign", companyId: OTHER, name: "Foreign Fiona", source: "self_quote", status: "new",
        createdAt: day(-5), quoteId: "q_foreign", metaLeadId: null, conversationEvidence: null },
    ],
    leadNote: [
      { id: "n1", leadId: "lead_quoted", body: "called, left vm" },
      { id: "n2", leadId: "lead_quoted", body: "wants Tuesday" },
      { id: "n_foreign", leadId: "lead_foreign", body: "foreign note" },
    ],
    leadIdentityLink: [
      { id: "il_fold", companyId: CO, leadId: "lead_form", kind: "meta_lead_form", metaLeadId: "LG_101", status: "linked", splitLeadId: null },
      // Another lead's link whose undo created lead_test.
      { id: "il_split", companyId: CO, leadId: "lead_test2", kind: "thread", metaLeadId: null, status: "undone", splitLeadId: "lead_test" },
    ],
    messageThread: [
      { id: "T_quoted", companyId: CO, leadId: "lead_quoted", clientId: "c_1", participantName: "Quinn Quoted",
        participantExternalId: "PSID_Q", routingIntent: null, adReferral: null, leadCapture: null, createdAt: day(-3),
        channel: { platform: "facebook" }, messages: [] },
      { id: "T_chat", companyId: CO, leadId: "lead_chat", clientId: null, participantName: "Chatty Cathy",
        participantExternalId: "PSID_C", routingIntent: null, adReferral: null, createdAt: day(-2),
        leadCapture: { kind: "work_request", kindMethod: "ai", reason: "asked for a deck stain", aiRuns: 1, inboundAtRun: 1, contactsSeen: [], leadId: "lead_chat" },
        channel: { platform: "facebook" },
        messages: [{ id: "mc1", direction: "in", body: "hi can you stain my deck this summer?", sentAt: day(-2), attachments: null, private: false, imported: false }] },
      { id: "T_chat2", companyId: CO, leadId: "lead_chat2", clientId: null, participantName: "Second Chat",
        participantExternalId: "PSID_C2", routingIntent: null, adReferral: null, createdAt: day(-2),
        leadCapture: { kind: "work_request", kindMethod: "ai", reason: "asked for a deck stain", aiRuns: 1, inboundAtRun: 1, contactsSeen: [], leadId: "lead_chat2" },
        channel: { platform: "facebook" },
        messages: [{ id: "mc2", direction: "in", body: "hi can you stain my deck this summer?", sentAt: day(-2), attachments: null, private: false, imported: false }] },
      { id: "T_foreign", companyId: OTHER, leadId: "lead_foreign", clientId: null, participantName: "F", leadCapture: null, channel: { platform: "facebook" }, messages: [] },
    ],
    message: [
      { id: "msg_1", threadId: "T_quoted", body: "hello" },
      { id: "msg_2", threadId: "T_chat", body: "hi can you stain my deck this summer?" },
    ],
    voiceCall: [
      { id: "vc_1", companyId: CO, leadId: "lead_quoted", transcript: "…" },
      { id: "vc_foreign", companyId: OTHER, leadId: "lead_foreign" },
    ],
    callConsent: [{ id: "cc_1", companyId: CO, leadId: "lead_quoted", e164: "+16135550100" }],
    voiceCallTask: [
      { id: "vt_q", companyId: CO, leadId: "lead_test", status: "queued", lastError: null },
      { id: "vt_done", companyId: CO, leadId: "lead_quoted", status: "done", lastError: null },
    ],
    funnel: [{ id: "f_1", companyId: CO }, { id: "f_2", companyId: OTHER }],
    funnelResponse: [
      { id: "fr_1", funnelId: "f_1", leadId: "lead_quoted" },
      { id: "fr_foreign", funnelId: "f_2", leadId: "lead_foreign" },
    ],
    funnelVisit: [{ id: "fv_1", companyId: CO, leadId: "lead_quoted" }],
    quoteDocument: [{ id: "qd_1", companyId: CO, leadId: "lead_quoted", quoteId: null, planReadId: "pr_1" }],
    planRead: [{ id: "pr_1", companyId: CO, leadId: "lead_quoted", quoteId: null }],
    quote: [
      { id: "q_1", companyId: CO, clientId: "c_1", quoteNumber: "Q-0001", status: "sent", total: 4200 },
      { id: "q_foreign", companyId: OTHER, clientId: "c_x", quoteNumber: "X-1", status: "sent", total: 1 },
    ],
    client: [{ id: "c_1", companyId: CO, name: "Quinn Quoted" }],
    job: [{ id: "j_1", companyId: CO, quoteId: "q_1" }],
    invoice: [{ id: "i_1", companyId: CO, quoteId: "q_1" }],
    activityLog: [],
    companyServiceCategory: [],
  };
  globalThis.__FQ_DB = makeDb();
}
const snapshot = () => JSON.stringify(R());
const as = (memberId, extra = {}) => {
  const m = R().member.find((x) => x.id === memberId);
  globalThis.__FQ_SESSION = { ...m, ...extra };
};
const del = (id, body) =>
  oneRoute.DELETE({ method: "DELETE", url: `http://x/api/leads/${id}`, json: async () => (body === undefined ? (() => { throw new Error("no body"); })() : body) }, { params: Promise.resolve({ id }) });
const delMany = (body) =>
  listRoute.DELETE({ method: "DELETE", url: "http://x/api/leads", json: async () => body });
const row = (table, id) => R()[table].find((r) => r.id === id);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The pure pieces, against hostile input");
// ═══════════════════════════════════════════════════════════════════════════
{
  const c = cleanLeadIds([" a ", "a", "", "   ", 5, null, { $ne: null }, ["b"], "x".repeat(65), "b"]);
  ok("ids: trimmed, de-duplicated; numbers, objects, arrays, blanks and over-long strings dropped", JSON.stringify(c.ids) === '["a","b"]' && c.tooMany === false, c);
  ok("ids: a non-array is nothing, not a crash", cleanLeadIds("lead_1").ids.length === 0 && cleanLeadIds({ 0: "x" }).ids.length === 0 && cleanLeadIds(undefined).ids.length === 0);
  const many = cleanLeadIds(Array.from({ length: MAX_DELETE_BATCH + 1 }, (_, i) => `id_${i}`));
  ok(`ids: more than ${MAX_DELETE_BATCH} is reported as tooMany`, many.tooMany === true && many.ids.length === MAX_DELETE_BATCH);

  const before = { kind: "work_request", kindMethod: "ai", aiRuns: 2, contactsSeen: ["phone:+1613"], leadId: "L" };
  const marked = withNotALeadMark(before, { at: day(0), byUserId: "u", byName: "Olive", leadId: "L", leadName: "Cathy" });
  ok("mark: the capture's verdict, AI-run count and contacts are kept", marked.kind === "work_request" && marked.aiRuns === 2 && marked.contactsSeen[0] === "phone:+1613");
  ok("mark: says who and when", marked.notALead.byName === "Olive" && marked.notALead.at === day(0) && marked.notALead.leadName === "Cathy");
  ok("mark: the input object is not mutated", before.notALead === undefined);
  ok("mark: a null or array capture becomes a mark alone", isMarkedNotALead(withNotALeadMark(null, { at: day(0) })) && !Array.isArray(withNotALeadMark([1], { at: day(0) })));
  ok("isMarkedNotALead: junk is not a mark", ![null, undefined, "x", {}, { notALead: true }, { notALead: {} }].some(isMarkedNotALead));

  ok("every messaging platform's lead source counts as a conversation source", Object.values(SOURCE_FOR_PLATFORM).every((s) => CONVERSATION_LEAD_SOURCES.includes(s)));
  ok("…and the AI employee's own", CONVERSATION_LEAD_SOURCES.includes("ai_employee"));
  ok("conversation hint: a lead with conversation evidence", looksLikeConversationLead({ source: "manual", conversationEvidence: { threadId: "T" } }));
  ok("conversation hint: a Messenger lead", looksLikeConversationLead({ source: "meta_messenger" }));
  ok("conversation hint: NOT a form, a manual lead, a Meta lead FORM, or junk",
    ![{ source: "self_quote" }, { source: "manual" }, { source: "meta_lead_form" }, null, "x", { conversationEvidence: { threadId: "" } }].some(looksLikeConversationLead));

  ok("support refusal: a read-only support session is refused", supportSessionRefusal({ impersonation: true, impersonationMode: "read_only" })?.status === 403);
  ok("support refusal: an impersonation with no mode is refused (fail closed)", supportSessionRefusal({ impersonation: true })?.status === 403);
  ok("support refusal: the demo sandbox and a real member pass", supportSessionRefusal({ impersonation: true, impersonationMode: "demo_sandbox" }) === null && supportSessionRefusal({ role: "owner" }) === null && supportSessionRefusal(null) === null);

  const s = leadDeletedSummary({ name: "Cathy", source: "meta_messenger", createdAt: day(-2) });
  ok("audit sentence: name, source as words, received date", s.includes("Cathy") && s.includes("Facebook") && s.includes("2026-08-30") && !s.includes("meta_messenger"), s);
  ok("audit sentence: survives a lead with nothing", typeof leadDeletedSummary({}) === "string");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. DELETE /api/leads/[id] — what goes, what survives");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed();
  as("m_owner");
  const quoteBefore = JSON.stringify(row("quote", "q_1"));
  const otherTables = ["client", "job", "invoice", "message"].map((t) => JSON.stringify(R()[t]));
  const res = await del("lead_quoted");
  ok("owner deletes a lead → 200", res.status === 200 && res.body.ok === true, res);
  ok("…the lead is gone", !row("leadRequest", "lead_quoted"));
  ok("…its notes went with it (cascade)", !R().leadNote.some((n) => n.leadId === "lead_quoted"));
  ok("…another company's note is untouched", Boolean(row("leadNote", "n_foreign")));
  ok("a lead linked to a quote → the quote survives, byte for byte", JSON.stringify(row("quote", "q_1")) === quoteBefore);
  ok("…and nothing points at it from a lead any more", !R().leadRequest.some((l) => l.quoteId === "q_1"));
  ok("client, job, invoice and messages are untouched", ["client", "job", "invoice", "message"].every((t, i) => JSON.stringify(R()[t]) === otherTables[i]));
  ok("the conversation survives with leadId null", row("messageThread", "T_quoted") && row("messageThread", "T_quoted").leadId === null);
  ok("…and is not marked not-a-lead when nobody asked", !isMarkedNotALead(row("messageThread", "T_quoted").leadCapture));
  ok("the call survives with leadId null", row("voiceCall", "vc_1")?.leadId === null);
  ok("the consent row survives with leadId null", row("callConsent", "cc_1")?.leadId === null);
  ok("a finished call task survives with leadId null, status unchanged", row("voiceCallTask", "vt_done")?.leadId === null && row("voiceCallTask", "vt_done").status === "done");
  ok("funnel response and visit survive with leadId null", row("funnelResponse", "fr_1")?.leadId === null && row("funnelVisit", "fv_1")?.leadId === null);
  ok("the drawing read and its document survive with leadId null", row("planRead", "pr_1")?.leadId === null && row("quoteDocument", "qd_1")?.leadId === null);
  ok("another company's rows pointing at THEIR lead are untouched",
    row("voiceCall", "vc_foreign").leadId === "lead_foreign" && row("funnelResponse", "fr_foreign").leadId === "lead_foreign" && row("messageThread", "T_foreign").leadId === "lead_foreign");

  const log = R().activityLog.filter((a) => a.action === LEAD_DELETED_ACTION);
  ok("the audit entry is written — one row", log.length === 1, log);
  const a = log[0] || {};
  ok("…who: the actor's user, member, name and role", a.actorUserId === "u_owner" && a.actorMemberId === "m_owner" && a.actorName === "Olive Owner" && a.actorRole === "owner", a);
  ok("…what: the lead, by id and by name, with its source and received date", a.entityType === "lead" && a.entityId === "lead_quoted" && a.metadata?.name === "Quinn Quoted" && a.metadata?.source === "self_quote" && a.metadata?.receivedAt === day(-3), a.metadata);
  ok("…when: the row's own createdAt", Boolean(a.createdAt));
  ok("…in the company's own trail", a.companyId === CO);
  ok("…with a sentence in English and a key for the reader's language", /Deleted lead Quinn Quoted/.test(a.summary) && a.metadata?.i18n?.key === "app.activity.event.leadDeleted" && a.metadata.i18n.params.name === "Quinn Quoted", a);
  ok("…recording the quote it had been linked to", a.metadata?.quoteId === "q_1");

  // A queued speed-to-lead call, and another lead's undo pointer.
  const r2 = await del("lead_test");
  ok("a QUEUED call to the deleted lead is cancelled, not left to ring a test number", r2.status === 200 && row("voiceCallTask", "vt_q").status === "cancelled" && row("voiceCallTask", "vt_q").leadId === null, row("voiceCallTask", "vt_q"));
  ok("another lead's link that named this one as its split loses only that pointer", row("leadIdentityLink", "il_split")?.splitLeadId === null && row("leadIdentityLink", "il_split").leadId === "lead_test2");

  const r3 = await del("lead_quoted");
  ok("deleting it again → 404, and no second audit row", r3.status === 404 && R().activityLog.filter((x) => x.entityId === "lead_quoted").length === 1, r3);

  // The manager preset holds the delete rung.
  as("m_manager");
  const r4 = await del("lead_test2");
  ok("the Manager preset (requests: view_create_edit_delete) may delete", r4.status === 200, r4);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Refusals change nothing");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed();
  let before = snapshot();
  as("m_owner");
  let res = await del("lead_foreign");
  ok("another company's lead → 404", res.status === 404, res);
  ok("…untouched: every table byte for byte, no audit row", snapshot() === before);
  ok("…and the refusal does not echo the foreign lead", !JSON.stringify(res.body).includes("Fiona"));

  res = await del("does_not_exist");
  ok("an unknown id → 404, nothing written", res.status === 404 && snapshot() === before);

  as("m_crew");
  res = await del("lead_test");
  ok("crew (requests: none) → 403", res.status === 403, res);
  ok("…nothing changed", snapshot() === before);

  as("m_estimator");
  res = await del("lead_test");
  ok("an estimator (view, create, edit — not delete) → 403", res.status === 403, res);
  ok("…nothing changed", snapshot() === before);

  // Support: the route's own gate, with a session getCurrentMember let through.
  as("m_owner", { impersonation: true, impersonationMode: "read_only" });
  res = await del("lead_test");
  ok("a read-only support session → 403, at the route itself", res.status === 403 && /read-only/.test(res.body.error || ""), res);
  ok("…nothing changed, no audit row", snapshot() === before);
  res = await delMany({ ids: ["lead_test", "lead_test2"] });
  ok("…bulk too", res.status === 403 && snapshot() === before, res);

  // And the throw assertReadOnly makes, shaped by memberOrRefusal.
  globalThis.__FQ_SESSION = { __throw: { status: 403, message: "You're viewing this account read-only." } };
  res = await del("lead_test");
  ok("getCurrentMember's impersonation throw → 403 (refusal shape), not a 500", res.status === 403 && typeof res.body.error === "string", res);
  ok("…nothing changed", snapshot() === before);

  globalThis.__FQ_SESSION = null;
  res = await del("lead_test");
  ok("no session → 401", res.status === 401 && snapshot() === before, res);

  as("m_crew");
  res = await delMany({ ids: ["lead_test"] });
  ok("crew bulk → 403, nothing changed", res.status === 403 && snapshot() === before, res);

  as("m_estimator");
  res = await delMany({ ids: ["lead_test"] });
  ok("estimator bulk (edit, not delete) → 403, nothing changed", res.status === 403 && snapshot() === before, res);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. \"Don't create a lead from this conversation again\"");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed();
  as("m_owner");
  const res = await del("lead_chat", { notALead: true });
  ok("delete with notALead → 200, one thread marked", res.status === 200 && res.body.markedThreads === 1, res.body);
  const t = row("messageThread", "T_chat");
  ok("the thread survives with leadId null", t && t.leadId === null);
  ok("…its messages survive", Boolean(row("message", "msg_2")));
  ok("…marked not-a-lead, by whom, naming the lead", isMarkedNotALead(t.leadCapture) && t.leadCapture.notALead.byName === "Olive Owner" && t.leadCapture.notALead.leadName === "Chatty Cathy", t.leadCapture);
  ok("…the earlier verdict and AI-run count kept (no paid re-read)", t.leadCapture.kind === "work_request" && t.leadCapture.aiRuns === 1);
  ok("the audit row records that the conversation was marked", R().activityLog.find((a) => a.entityId === "lead_chat")?.metadata?.notALead === true);

  const deps = (created) => ({
    aiConfigured: () => false,
    rescore: async () => null,
    resolveCampaign: async () => null,
    extract: async () => ({ ok: false, reason: "unconfigured", metered: false }),
    reviewRecords: async () => null,
    rejected: async () => new Set(),
    linkThread: async () => null,
    linkClient: async () => null,
    createLead: async (input) => {
      created.push(input);
      const r = { id: `lead_new_${created.length}`, companyId: input.companyId, name: input.name, email: null, phone: null, categoryId: null, timeline: null, intake: null, source: input.source, status: "new", createdAt: day(0), metaCampaignId: null, conversationEvidence: null };
      R().leadRequest.push(r);
      return r;
    },
  });

  // The next message arrives on the marked thread.
  row("messageThread", "T_chat").messages.push({ id: "mc1b", direction: "in", body: "thanks! any update on my deck?", sentAt: day(0), attachments: null, private: false, imported: false });
  const created = [];
  const cap = await captureLeadFromConversation({ companyId: CO, threadId: "T_chat", prisma: globalThis.__FQ_DB, deps: deps(created), now: new Date(day(0)) });
  ok("the next message on a marked thread makes NO lead", created.length === 0 && cap.acted === false && cap.reason === "marked_not_a_lead", { cap, created });
  ok("…and the thread is still unlinked and still marked", row("messageThread", "T_chat").leadId === null && isMarkedNotALead(row("messageThread", "T_chat").leadCapture));

  // The control: the same thread shape, deleted WITHOUT the mark.
  const r2 = await del("lead_chat2", { notALead: false });
  ok("control: deleted without the mark → not marked", r2.status === 200 && r2.body.markedThreads === 0 && !isMarkedNotALead(row("messageThread", "T_chat2").leadCapture));
  row("messageThread", "T_chat2").messages.push({ id: "mc2b", direction: "in", body: "thanks! any update on my deck?", sentAt: day(0), attachments: null, private: false, imported: false });
  const created2 = [];
  await captureLeadFromConversation({ companyId: CO, threadId: "T_chat2", prisma: globalThis.__FQ_DB, deps: deps(created2), now: new Date(day(0)) });
  ok("control: …and the next message DOES make a new lead (so the mark is what stops it)", created2.length === 1, created2);

  // A person links a lead by hand afterwards: their link overrules the mark.
  R().leadRequest.push({ id: "lead_manual", companyId: CO, name: "Chatty Cathy", email: null, phone: null, categoryId: null, timeline: null, intake: null, source: "manual", status: "new", createdAt: day(0), metaCampaignId: null, conversationEvidence: null });
  row("messageThread", "T_chat").leadId = "lead_manual";
  const created3 = [];
  const cap3 = await captureLeadFromConversation({ companyId: CO, threadId: "T_chat", prisma: globalThis.__FQ_DB, deps: deps(created3), now: new Date(day(0)) });
  ok("a lead a PERSON links afterwards is enriched, not blocked — and no new lead", cap3.reason !== "marked_not_a_lead" && created3.length === 0 && cap3.leadId === "lead_manual", cap3);
  ok("…and the mark is carried, not dropped, by that pass", isMarkedNotALead(row("messageThread", "T_chat").leadCapture), row("messageThread", "T_chat").leadCapture);

  // Asked to mark a lead with no conversation: said back, not claimed.
  const r4 = await del("lead_test", { notALead: true });
  ok("notALead on a lead with no conversation → deleted, and reported as having none", r4.status === 200 && r4.body.markedThreads === 0 && JSON.stringify(r4.body.noConversation) === '["lead_test"]', r4.body);
  ok("…and a body that is not JSON is an ordinary delete", (await del("lead_test2")).status === 200);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. DELETE /api/leads — bulk");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed();
  as("m_owner");
  const before = snapshot();
  let res = await delMany({ ids: [] });
  ok("no ids → 400, nothing written", res.status === 400 && snapshot() === before, res);
  res = await delMany(null);
  ok("no body → 400", res.status === 400 && snapshot() === before);
  res = await delMany({ ids: Array.from({ length: MAX_DELETE_BATCH + 1 }, (_, i) => `x_${i}`) });
  ok(`more than ${MAX_DELETE_BATCH} → 400, nothing written`, res.status === 400 && snapshot() === before, res);
  res = await delMany({ ids: ["lead_foreign"] });
  ok("only another company's ids → 404, nothing written", res.status === 404 && snapshot() === before, res);

  const keep = R().leadRequest.filter((l) => !["lead_test", "lead_test2"].includes(l.id)).map((l) => JSON.stringify(l));
  res = await delMany({ ids: ["lead_test", "lead_test2", "lead_foreign", " lead_test ", { id: "lead_form" }, 7, "nope"] });
  ok("bulk → 200, exactly the two selected own leads deleted", res.status === 200 && JSON.stringify(res.body.deleted.sort()) === '["lead_test","lead_test2"]', res.body);
  ok("…every other lead is byte for byte as it was (the foreign one, and own leads not selected)",
    JSON.stringify(R().leadRequest.map((l) => JSON.stringify(l))) === JSON.stringify(keep));
  ok("…an object smuggled into ids did not reach a where (lead_form untouched)", Boolean(row("leadRequest", "lead_form")));
  ok("…ids not in the company are counted back, not claimed", res.body.notFound === 2, res.body);
  const logs = R().activityLog.filter((a) => a.action === LEAD_DELETED_ACTION);
  ok("…one audit row per deleted lead, each marked bulk", logs.length === 2 && logs.every((a) => a.metadata.bulk === true && a.companyId === CO), logs);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The other re-creators respect the delete");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed();
  as("m_owner");
  await del("lead_form");
  const tomb = R().activityLog.find((a) => a.entityId === "lead_form");
  ok("the Meta lead's leadgen id AND the folded submission's are on the audit row", JSON.stringify(tomb?.metadata?.metaLeadIds) === '["LG_100","LG_101"]', tomb?.metadata);
  ok("…the folded link went with the lead (cascade)", !row("leadIdentityLink", "il_fold"));

  const db = globalThis.__FQ_DB;
  const lead = (id) => ({ id, field_data: [{ name: "full_name", values: ["Form Fran"] }, { name: "email", values: ["fran@example.com"] }] });
  let r = await importMetaLead({ companyId: CO, lead: lead("LG_100"), formId: "F1", prisma: db, path: "cron" });
  ok("Meta re-delivers the deleted lead → skipped, not re-created", r.status === "skipped" && r.reason === "deleted_by_company" && !R().leadRequest.some((l) => l.metaLeadId === "LG_100"), r);
  r = await importMetaLead({ companyId: CO, lead: lead("LG_101"), formId: "F1", prisma: db, path: "webhook" });
  ok("…and the submission that had been folded into it → skipped too", r.status === "skipped" && r.reason === "deleted_by_company", r);
  const tombCount = R().activityLog.length;
  r = await importMetaLead({ companyId: OTHER, lead: lead("LG_100"), formId: "F1", prisma: {
    leadRequest: { findFirst: async () => null },
    leadIdentityLink: { findFirst: async () => null },
    activityLog: { findFirst: async ({ where }) => (where.companyId === OTHER ? null : { id: "x" }) },
  }, path: "cron" }).catch((e) => ({ status: "threw", reason: e.message }));
  ok("…the tombstone is per company: another company's lookup is asked under ITS id", r.reason !== "deleted_by_company" && R().activityLog.length === tombCount, r);

  // The AI employee's callback on a marked thread.
  seed();
  as("m_owner");
  await del("lead_chat", { notALead: true });
  const leadsBefore = R().leadRequest.length;
  const cb = await runToolForCompany({ companyId: CO, name: "book_callback", args: { name: "Chatty Cathy", summary: "deck stain", phone: "613-555-0142" }, threadId: "T_chat" });
  ok("book_callback on a marked conversation → no lead, and says nothing was recorded", cb.ok === false && cb.reason === "conversation_marked_not_a_lead" && R().leadRequest.length === leadsBefore, cb);

  // Call recovery.
  const callDb = (row) => ({ voiceCall: { findFirst: async () => row } });
  const rec = await recoverLeadFromCall({ companyId: CO, voiceCallId: "vc", prisma: callDb({ id: "vc", leadId: null, leadRecoveredAt: day(-1), transcript: "Agent: hi\nUser: I'm Bo, 613 555 0100", fromE164: "+16135550100", direction: "inbound" }), createLead: async () => { throw new Error("must not create"); } });
  ok("call recovery will not rebuild a lead it recovered once and the company deleted", rec.ok === false && rec.reason === RECOVERY_REASONS.LEAD_DELETED, rec);
  const rec2 = await recoverLeadFromCall({ companyId: CO, voiceCallId: "vc", prisma: callDb({ id: "vc", leadId: "L", leadRecoveredAt: null, transcript: "x" }) });
  ok("…while a call that still has its lead says so, as before", rec2.reason === RECOVERY_REASONS.ALREADY_HAS_LEAD, rec2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The board offers delete only to the delete rung");
// ═══════════════════════════════════════════════════════════════════════════
{
  const page = readFileSync(new URL("../app/app/leads/page.js", import.meta.url), "utf8");
  ok("the page reads the delete rung", /useHasLevel\("requests", "view_create_edit_delete"\)/.test(page));
  ok("the card menu, Select and the panel's button are all gated on it",
    /onDelete=\{canDelete \?/.test(page) && /\{canDelete && \(leads \?\? \[\]\)\.length > 0 &&/.test(page) && (page.match(/onDelete=\{canDelete \?/g) || []).length === 2, (page.match(/onDelete=\{canDelete \?/g) || []).length);
  const dialog = readFileSync(new URL("../app/components/leads/LeadDeleteDialog.js", import.meta.url), "utf8");
  ok("the dialog calls both routes it relies on", dialog.includes('fetch("/api/leads", {') && dialog.includes("fetch(`/api/leads/${list[0].id}`"));
  ok("the dialog never offers an Undo", !/undo/i.test(dialog.replace(/\/\/.*$/gm, "")));
}

console.log(`\n${checks - failures}/${checks} passed${failures ? `, ${failures} FAILED` : ""}`);
process.exit(failures ? 1 : 0);
