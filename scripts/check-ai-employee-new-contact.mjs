// scripts/check-ai-employee-new-contact.mjs
//
//   npm run check:ai-employee-new-contact
//
// The owner, 2026-10-10: "for new leads, new chats with no history, the sales
// closer AI agent should handle those. Its goal is to use the reverse selling
// skill learned to book an in-person visit for the free quote."
//
// Two things, executed rather than described:
//
//   1. ROUTING (lib/aiEmployee/routing.js). A brand-new contact goes to the
//      company's enabled closer whatever the front desk called it — except a
//      problem (troubleshooter, when there is one) and anything the urgent
//      matcher flags. Returning contacts, existing clients and companies with
//      no closer route exactly as before.
//   2. THE CLOSER'S GOAL (AiEmployee.closerGoal). `in_person_visit` adds one
//      block to the closer's prompt; `next_step` (every company's default)
//      leaves every prompt byte-identical.
import { respondToMessage } from "../lib/aiEmployee/respond.js";
import {
  assignThread,
  isNewContact,
  newContactAssignee,
  NEW_CONTACT_REASON,
  NEW_CONTACT_GAP_MS,
} from "../lib/aiEmployee/routing.js";
import { buildEmployeePrompt, instructionsFingerprint } from "../lib/aiEmployee/roles.js";
import { CLOSER_GOALS, DEFAULT_CLOSER_GOAL, closerGoalBlock, closerGoalOf } from "../lib/aiEmployee/closerTechnique.js";
import { planEmployeeSave, EDITABLE_FIELDS } from "../lib/aiEmployee/settings.js";
import fs from "node:fs";
import { createHash } from "node:crypto";

let passed = 0;
let failed = 0;
const ok = (name, cond, extra) => {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 300));
  }
};

// ── A scripted Prisma ────────────────────────────────────────────────────────
function matches(row, where = {}) {
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") { if (!v.some((w) => matches(row, w))) return false; continue; }
    const val = row[k];
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      const ops = ["in", "not", "gte", "gt", "lte", "lt", "equals"];
      if ("in" in v && !v.in.includes(val)) return false;
      if ("not" in v && (v.not === null ? val == null : val === v.not)) return false;
      if ("gte" in v && !(new Date(val) >= new Date(v.gte))) return false;
      if ("gt" in v && !(new Date(val) > new Date(v.gt))) return false;
      if ("lte" in v && !(new Date(val) <= new Date(v.lte))) return false;
      if ("lt" in v && !(new Date(val) < new Date(v.lt))) return false;
      if ("equals" in v) {
        const a = v.mode === "insensitive" ? String(val || "").toLowerCase() : val;
        const b = v.mode === "insensitive" ? String(v.equals || "").toLowerCase() : v.equals;
        if (a !== b) return false;
      }
      if (!ops.some((o) => o in v) && !matches(val || {}, v)) return false;
      continue;
    }
    if (val !== v) return false;
  }
  return true;
}
function sortBy(rows, orderBy) {
  if (!orderBy || Array.isArray(orderBy)) return rows;
  const [[k, dir]] = Object.entries(orderBy);
  return [...rows].sort((a, b) => (new Date(a[k]) - new Date(b[k])) * (dir === "desc" ? -1 : 1));
}
let seq = 0;
function makeDb(seed) {
  const store = {
    aiEmployee: [], messageThread: [], message: [], aiEmployeeReply: [], aiEmployeeRoutingEvent: [], aiEmployeeSource: [],
    aiEmployeeProposal: [], company: [], aiFeaturePayer: [], leadRequest: [], client: [], clientEquipment: [], job: [],
    voiceCreditEntry: [{ id: "credit", companyId: "C1", pool: "ai", kind: "ai_topup", cents: 10_000 }],
    ...seed,
  };
  const model = (name) => ({
    findMany: async ({ where, orderBy, take } = {}) => { const r = sortBy(store[name].filter((x) => matches(x, where)), orderBy); return take ? r.slice(0, take) : r; },
    findFirst: async ({ where, orderBy } = {}) => sortBy(store[name].filter((x) => matches(x, where)), orderBy)[0] || null,
    findUnique: async ({ where } = {}) => store[name].find((x) => matches(x, where)) || null,
    count: async ({ where } = {}) => store[name].filter((x) => matches(x, where)).length,
    create: async ({ data }) => { const row = { id: `${name}_${++seq}`, createdAt: new Date(), ...data }; store[name].push(row); return row; },
    update: async ({ where, data }) => { const row = store[name].find((x) => matches(x, where)); if (!row) throw new Error(`no ${name}`); Object.assign(row, data); return row; },
    updateMany: async ({ where, data }) => { const rows = store[name].filter((x) => matches(x, where)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    aggregate: async ({ where, _sum = {} } = {}) => {
      const rows = store[name].filter((x) => matches(x, where));
      return { _sum: Object.fromEntries(Object.keys(_sum).map((k) => [k, rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)])) };
    },
  });
  const db = { $store: store };
  for (const name of Object.keys(store)) db[name] = model(name);
  // The phone-tail pre-filter (lib/conversations/clientTimeline.js) is raw
  // SQL; scripted here as the same digits-suffix match.
  db.$queryRaw = async (strings, ...values) => {
    const sql = strings.join("?");
    if (!/FROM "Client"/.test(sql)) return [];
    const [companyId, like] = values;
    const tail = String(like).replace(/%/g, "");
    return store.client.filter((c) => c.companyId === companyId && String(c.phone || "").replace(/\D/g, "").endsWith(tail)).map((c) => ({ id: c.id }));
  };
  return db;
}

const T0 = new Date("2026-10-10T15:00:00Z");
const at = (s) => new Date(T0.getTime() + s * 1000);
const company = { id: "C1", name: "Acme Cabinets", businessHours: null, timezone: "America/Toronto", defaultLanguage: "en" };
const emp = (id, role, over = {}) => ({
  id, companyId: "C1", role, name: id, displayName: id, enabled: true, mode: "auto", maxRepliesPerThread: 4, businessHoursOnly: false,
  disabledTools: [], intents: [], metaEnabled: role === "receptionist", webChatEnabled: false, smsEnabled: false,
  instructionsFingerprint: "f", createdAt: new Date(`2026-01-0${id.length}`), closerGoal: "next_step", ...over,
});
// TrueFinish's shape: Jessica the receptionist holds Messenger, John the
// closer, Sam the troubleshooter.
const team = (over = {}) => [
  emp("Jessica", "receptionist", over.Jessica),
  emp("John", "closer", over.John),
  emp("Sam", "troubleshooter", over.Sam),
];
const thread = (over = {}) => ({
  id: "th1", companyId: "C1", status: "open", participantName: "Pat New", participantExternalId: "psid-1", channel: { platform: "facebook" },
  lastInboundAt: T0, assignedEmployeeId: null, routingIntent: null, routingReason: null, humanTookOverAt: null,
  clientId: null, leadId: null, leadCapture: null, createdAt: T0, ...over,
});
const msg = (id, direction, body, sentAt, extra = {}) => ({ id, threadId: "th1", direction, private: false, body, sentAt, attachments: null, failedReason: null, sentByUserId: null, imported: false, ...extra });

/** The front desk, scripted: the intent a keyword implies. */
const frontDesk = async (args) => {
  args.onUsage?.({ model: "gpt-s", promptTokens: 5, completionTokens: 1 });
  const p = args.prompt;
  const intent = /leak|broken|not working|flood/i.test(p) ? "problem" : /how much|price|cost/i.test(p) ? "price" : /come out|book|visit|free tomorrow/i.test(p) ? "book" : "other";
  return { ok: true, data: { intent, reason: `scripted ${intent}` } };
};
const deps = (db, log = []) => ({
  db, now: new Date("2026-10-15T12:00:00Z"),
  checkAiQuota: async () => ({ allowed: true }), recordAiUsage: async () => {}, isAiConfigured: () => true,
  notify: async () => {}, sleep: async () => {}, recordError: async () => {}, raiseUrgentAlert: async () => ({ alerted: "bell" }),
  complete: frontDesk,
  runToolLoop: async ({ system, onUsage }) => { log.push(system); onUsage?.({ model: "gpt-b", promptTokens: 50, completionTokens: 10 }); return { text: "Happy to help." }; },
});

/** Route one inbound on a fresh thread through the real responder. */
async function route(seed, body, { messages = [], threadOver = {} } = {}) {
  const db = makeDb({ company: [company], aiEmployee: team(seed.over || {}), messageThread: [thread(threadOver)], message: [...messages, msg("mNew", "in", body, T0)], ...(seed.rows || {}) });
  const log = [];
  const out = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "mNew", channel: "meta", send: async () => ({ ok: true, externalId: "x" }), deps: deps(db, log) });
  const t = db.$store.messageThread[0];
  const ev = db.$store.aiEmployeeRoutingEvent.find((e) => e.kind === "assigned");
  return { out, holder: t.assignedEmployeeId, reason: t.routingReason, event: ev, log, db };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("1. Routing a new contact");
// ═══════════════════════════════════════════════════════════════════════════
{
  const r = await route({}, "Hi, are you free tomorrow to come out and look at my kitchen cabinets?");
  ok("a NEW contact asking to book goes to the closer, not the receptionist", r.holder === "John", { holder: r.holder, reason: r.reason });
  ok("…the reason is on the thread", r.reason?.startsWith(NEW_CONTACT_REASON), r.reason);
  ok("…and on the routing event", r.event?.toEmployeeId === "John" && r.event?.reason?.startsWith(NEW_CONTACT_REASON), r.event);
  ok("…and the closer composes the reply", r.out.replied === true && r.log.length === 1 && /HOW TO HAVE THE CONVERSATION/.test(r.log[0]));

  const p = await route({}, "How much to refinish 20 cabinet doors?");
  ok("a new contact asking a price goes to the closer", p.holder === "John" && p.reason?.startsWith(NEW_CONTACT_REASON), p.reason);

  const prob = await route({}, "My dishwasher is broken and not working since your install");
  ok("a new contact with a PROBLEM still goes to the troubleshooter", prob.holder === "Sam", { holder: prob.holder, reason: prob.reason });
  ok("…and that is not recorded as the new-contact rule", !String(prob.reason || "").startsWith(NEW_CONTACT_REASON));

  const urgent = await route({}, "Water is pouring through the ceiling, can someone come out?");
  ok("an URGENT message never goes to the closer, whatever the front desk said", urgent.holder !== "John", { holder: urgent.holder, reason: urgent.reason });

  const urgentNoTroubleshooter = await route({ over: { Sam: { enabled: false } } }, "Water is pouring through the ceiling, can someone come out?");
  ok("…even with no troubleshooter (today's routing: the receptionist)", urgentNoTroubleshooter.holder === "Jessica", { holder: urgentNoTroubleshooter.holder });

  const probNoTs = await route({ over: { Sam: { enabled: false } } }, "My dishwasher is broken and not working");
  ok("a routine problem with no troubleshooter goes to the closer as a new contact", probNoTs.holder === "John", probNoTs.reason);

  // A burst: the same person typed two pieces seconds apart — still new.
  const burst = await route({}, "for my kitchen, can you come out?", { messages: [msg("m0", "in", "hi", at(-20))] });
  ok("a burst of pieces seconds apart is still a new contact", burst.holder === "John", burst.reason);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("2. Returning contacts keep today's routing");
// ═══════════════════════════════════════════════════════════════════════════
{
  const book = "Hi, are you free tomorrow to come out?";
  const old = new Date("2026-07-16T23:21:27Z");
  const hist = await route({}, book, { messages: [msg("m0", "in", "29 Rialto way", old, { imported: true }), msg("m1", "out", "See you Monday", old, { imported: true })] });
  ok("earlier IMPORTED history makes it a returning contact → the receptionist, as today", hist.holder === "Jessica", { holder: hist.holder, reason: hist.reason });

  const linkedClient = await route({ rows: { client: [{ id: "K1", companyId: "C1", name: "Pat", type: "individual", phone: "613-555-0100", email: null }] } }, book, { threadOver: { clientId: "K1" } });
  ok("a thread linked to a client → the receptionist", linkedClient.holder === "Jessica", linkedClient.reason);

  const sms = await route({ rows: { client: [{ id: "K1", companyId: "C1", name: "Pat", type: "individual", phone: "(613) 555-0100", email: null }] } }, book, { threadOver: { channel: { platform: "sms" }, participantExternalId: "+16135550100" } });
  ok("an SMS from a client's number (not yet linked) → the receptionist", sms.holder === "Jessica", sms.reason);

  const byEmail = await route({ rows: { leadRequest: [{ id: "L1", companyId: "C1", name: "Pat", email: "pat@example.com", phone: null, createdAt: T0 }], client: [{ id: "K1", companyId: "C1", name: "Pat", type: "individual", phone: null, email: "PAT@example.com" }] } }, book, { threadOver: { leadId: "L1" } });
  ok("a lead whose email belongs to a client → the receptionist", byEmail.holder === "Jessica", byEmail.reason);

  const oldLead = await route({ rows: { leadRequest: [{ id: "L1", companyId: "C1", name: "Pat", email: null, phone: null, createdAt: new Date("2026-05-01") }] } }, book, { threadOver: { leadId: "L1" } });
  ok("a linked lead created BEFORE this thread → the receptionist", oldLead.holder === "Jessica", oldLead.reason);

  const freshLead = await route({ rows: { leadRequest: [{ id: "L1", companyId: "C1", name: "Pat", email: null, phone: null, createdAt: at(30) }] } }, book, { threadOver: { leadId: "L1" } });
  ok("a lead captured from THIS conversation does not make it returning", freshLead.holder === "John", freshLead.reason);

  const foreignClient = await route({ rows: { client: [{ id: "K9", companyId: "C2", name: "Other", type: "individual", phone: "613-555-0100", email: null }] } }, book, { threadOver: { channel: { platform: "sms" }, participantExternalId: "+16135550100" } });
  ok("ANOTHER company's client with the same number does not make it returning", foreignClient.holder === "John", foreignClient.reason);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("3. No closer enabled: exactly today's behaviour");
// ═══════════════════════════════════════════════════════════════════════════
{
  const book = await route({ over: { John: { enabled: false } } }, "Hi, are you free tomorrow to come out?");
  ok("book → the receptionist", book.holder === "Jessica" && !String(book.reason || "").startsWith(NEW_CONTACT_REASON), book.reason);
  ok("…with the front desk's own reason, unchanged", book.reason === "scripted book", book.reason);
  const other = await route({ over: { John: { enabled: false } } }, "hello there");
  ok("other → the channel holder", other.holder === "Jessica" && other.reason === "scripted other", other.reason);
  // TrueFinish today: only Jessica on. One employee: no front desk call, Jessica.
  const solo = await route({ over: { John: { enabled: false }, Sam: { enabled: false } } }, "Hi, are you free tomorrow?");
  ok("one employee: that employee, no classification", solo.holder === "Jessica" && solo.reason === "only one employee on the team", solo.reason);
  // A company mapping is honoured for a returning contact.
  const mapped = await route({ over: { Jessica: { intents: ["price"] } } }, "How much for doors?", { messages: [msg("m0", "in", "hi from spring", new Date("2026-04-01"))] });
  ok("a returning contact still follows the company's own intent mapping", mapped.holder === "Jessica", mapped.reason);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("4. The pure verdicts");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("isNewContact: no facts → new", isNewContact({ thread: { createdAt: T0 } }) === true);
  ok("…earlier messages → not", isNewContact({ thread: { createdAt: T0 }, earlierMessages: 1 }) === false);
  ok("…a client → not", isNewContact({ thread: { clientId: "K" } }) === false && isNewContact({ thread: {}, clientMatches: 1 }) === false);
  ok("…an older lead → not; a newer one → new", isNewContact({ thread: { createdAt: T0 }, lead: { createdAt: at(-60) } }) === false && isNewContact({ thread: { createdAt: T0 }, lead: { createdAt: at(60) } }) === true);
  ok("the burst gap is thirty minutes", NEW_CONTACT_GAP_MS === 30 * 60 * 1000);
  const live = team();
  ok("newContactAssignee: book → closer", newContactAssignee({ team: live, intent: "book", text: "come out?" })?.id === "John");
  ok("…problem with a troubleshooter → null (today's routing)", newContactAssignee({ team: live, intent: "problem", text: "broken" }) === null);
  ok("…an emergency → null", newContactAssignee({ team: live, intent: "book", text: "I smell gas in the kitchen" }) === null);
  ok("…no closer → null", newContactAssignee({ team: live.filter((e) => e.role !== "closer"), intent: "book", text: "x" }) === null);
  ok("…a disabled closer → null", newContactAssignee({ team: team({ John: { enabled: false } }), intent: "book", text: "x" }) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("5. The closer's goal");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("two goals, next_step the default", CLOSER_GOALS.join() === "next_step,in_person_visit" && DEFAULT_CLOSER_GOAL === "next_step");
  ok("an unknown or missing goal reads as next_step", closerGoalOf(undefined) === "next_step" && closerGoalOf("yolo") === "next_step" && closerGoalOf("in_person_visit") === "in_person_visit");
  const base = { company: { name: "Acme" }, trades: [{ key: "cabinet_refinishing", label: "Cabinet refinishing" }] };
  const closer = (goal) => buildEmployeePrompt({ ...base, employee: { role: "closer", tone: "friendly", ...(goal === undefined ? {} : { closerGoal: goal }) } });
  const block = closerGoalBlock("in_person_visit");
  ok("next_step adds nothing — byte-identical to a row with no goal at all", closer("next_step") === closer(undefined) && closer(null) === closer(undefined));
  ok("in_person_visit adds the goal block to the closer's prompt", closer("in_person_visit") === closer(undefined).replace(/(\n\nHOW YOU WRITE)/, `\n\n${block}$1`) && closer("in_person_visit").includes(block));
  ok("…and nothing else changes", closer("in_person_visit").replace(`\n\n${block}`, "") === closer(undefined));
  for (const role of ["receptionist", "troubleshooter", "custom"]) {
    const a = buildEmployeePrompt({ ...base, employee: { role, tone: "friendly" } });
    const b = buildEmployeePrompt({ ...base, employee: { role, tone: "friendly", closerGoal: "in_person_visit" } });
    ok(`the goal never reaches the ${role}'s prompt`, a === b && !b.includes(block));
  }
  ok("the block names the free in-person estimate visit as the objective", /in-person/i.test(block) && /free quote/i.test(block) && /OBJECTIVE/.test(block));
  ok("…two times from check_availability, agree and redirect, give control", /TWO of the times\s+check_availability returned/.test(block) && /agree/i.test(block) && /control/i.test(block));
  ok("…it does not volunteer a price, and a tool's figure only as the money rules allow", /Do not volunteer a price/.test(block) && /HOW YOU\s+HANDLE MONEY/.test(block));
  ok("…and every rule above it still wins", /Every rule above still\s+wins/.test(block));
  ok("…below the absolute rules in the prompt", closer("in_person_visit").indexOf(block) > closer("in_person_visit").indexOf("WHAT YOU NEVER DO"));
  ok("no digit, currency mark or weekday in the block", !/[0-9$€£¥]/.test(block) && !/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(block));
  ok("the default goal keeps every existing fingerprint", instructionsFingerprint({ role: "closer", tone: "friendly" }) === instructionsFingerprint({ role: "closer", tone: "friendly", closerGoal: "next_step" }));
  // Pinned to the formula from before the goal existed: the eight fields,
  // NUL-joined, sha256, first 32 hex — so a saved fingerprint does not move.
  const legacy = createHash("sha256").update(["closer", "friendly", "", "", "", "", "", ""].join(String.fromCharCode(0))).digest("hex").slice(0, 32);
  ok("…byte-for-byte the pre-goal fingerprint", instructionsFingerprint({ role: "closer", tone: "friendly", closerGoal: "next_step" }) === legacy);
  ok("…and changing it marks drafts stale", instructionsFingerprint({ role: "closer", tone: "friendly" }) !== instructionsFingerprint({ role: "closer", tone: "friendly", closerGoal: "in_person_visit" }));

  // The save path: only the two values, refusing anything else.
  const rows = [{ id: "John", role: "closer", name: "John", tone: "friendly", closerGoal: "next_step" }];
  ok("closerGoal is an editable field", EDITABLE_FIELDS.includes("closerGoal"));
  const saved = planEmployeeSave({ rows, body: { id: "John", closerGoal: "in_person_visit" } });
  ok("in_person_visit saves", saved.ok && saved.data.closerGoal === "in_person_visit" && saved.fields.join() === "closerGoal", saved);
  const bad = planEmployeeSave({ rows, body: { id: "John", closerGoal: "close_hard" } });
  ok("an unknown goal is refused by name", bad.ok === false && bad.status === 400 && bad.field === "closerGoal", bad);

  // End to end: the real responder hands the closer's prompt the block.
  const log = [];
  const db = makeDb({ company: [company], aiEmployee: team({ John: { closerGoal: "in_person_visit" } }), messageThread: [thread()], message: [msg("mNew", "in", "How much to refinish my cabinets?", T0)] });
  await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "mNew", channel: "meta", send: async () => ({ ok: true }), deps: deps(db, log) });
  ok("the live closer reply carries the goal block", log.length === 1 && log[0].includes(block));

  // Wiring: the screen offers it, the API returns it, every app locale has it.
  const page = fs.readFileSync(new URL("../app/app/settings/ai-employee/page.js", import.meta.url), "utf8");
  const route = fs.readFileSync(new URL("../app/api/ai-employee/route.js", import.meta.url), "utf8");
  ok("the settings screen edits closerGoal, for the closer", /closerGoal/.test(page) && /role === "closer"/.test(page));
  ok("the API returns the employee's closerGoal", /closerGoal: closerGoalOf\(row\.closerGoal\)/.test(route));
  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js").catch(() => ({}));
  const catalogue = APP_MESSAGES || (await import("../app/i18n/appMessages.js")).default;
  const keys = ["app.aiEmployee.closerGoalLabel", "app.aiEmployee.closerGoalHint", "app.aiEmployee.closerGoal.next_step", "app.aiEmployee.closerGoal.in_person_visit"];
  const langs = catalogue ? Object.keys(catalogue) : [];
  ok("every app locale carries the four strings", langs.length >= 9 && langs.every((l) => keys.every((k) => typeof catalogue[l][k] === "string" && catalogue[l][k].trim())), langs.filter((l) => !keys.every((k) => catalogue[l]?.[k])));
}

console.log(`\ncheck-ai-employee-new-contact: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
