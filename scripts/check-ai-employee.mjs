// scripts/check-ai-employee.mjs
//
//   npm run check:ai-employee
//
// An AI employee answers a homeowner in the contractor's name. Three things
// about that are worth failing a build over.
//
// It must not speak when a person is already speaking. A bot that talks over
// an estimator mid-negotiation, or that answers a thread somebody asked for a
// human on, is worse than no bot: it costs the contractor the job AND the
// credit they paid for it.
//
// It must not invent a price. The model may say which measurements it heard;
// the SERVER prices them, the same rule every other pricing surface in this
// repo obeys.
//
// And it must be metered. This is the feature the owner sells against bought
// credit, so a reply that reaches a homeowner without being priced is revenue
// FieldQuo gave away and cannot invoice.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AI_EMPLOYEE_ROLES,
  AI_EMPLOYEE_TOOLS,
  toolsForRole,
  roleFor,
  roleForbids,
  buildEmployeePrompt,
  instructionsFingerprint,
} from "../lib/aiEmployee/roles.js";
import {
  shouldReply,
  sendMode,
  MODE_SUGGEST,
  MODE_AUTO,
  SKIP,
  SKIP_REASONS,
} from "../lib/aiEmployee/decide.js";
import {
  MODES,
  RISKS,
  mayActAlone,
  modeOf,
  argsHash,
  MODE_SENTENCE_KEY,
  MODE_SENTENCE_EN,
  FLOOR_LIST_KEYS,
} from "../lib/aiEmployee/permission.js";
import { AI_EMPLOYEE_VOICES, voiceLine, disclosureLine, DISCLOSURE_LANGUAGES, switchableToolsForRole as switchableFor } from "../lib/aiEmployee/roles.js";
import { CHANNELS, pickEmployee, channelConflicts } from "../lib/aiEmployee/employees.js";
import { WEB_CHAT_LANGUAGES, webChatCopy } from "../lib/aiEmployee/webChatCopy.js";
import { AI_BEST_MODEL, tierForModel, modelForTier } from "../lib/ai/provider.js";
import { hasKnownPricing, typicalConversationCostCents, pricingFor } from "../lib/ai/usage.js";
import { MESSAGING_PLATFORMS, META_PLATFORMS, OWN_PLATFORMS, SOURCE_FOR_PLATFORM } from "../lib/messaging/platforms.js";
import { CONVERSATION_SOURCES } from "../lib/attribution/conversationOutcome.js";
import { NOTIFICATION_TYPES } from "../lib/notifications/catalog.js";
import { hrefFor } from "../lib/notifications/render.js";
import {
  attachmentTally,
  claimsMedia,
  mediaClaimRefusal,
  MEDIA_CLAIM_REASON,
} from "../lib/aiEmployee/evidence.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 200));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
// Only code may satisfy a pin — a comment describing a rule is not the rule.
const code = (p) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

const ON = { enabled: true, role: "closer", mode: "auto", maxRepliesPerThread: 3 };
const INBOUND = { direction: "in", body: "how much to paint a bedroom?" };
const OPEN = { status: "open" };
const OKQ = { allowed: true };
const say = (patch = {}) =>
  shouldReply({
    employee: ON, thread: OPEN, message: INBOUND, quota: OKQ,
    businessHoursOpen: true, aiConfigured: true, ...patch,
  });

// ── It speaks only when nobody else is ─────────────────────────────────────
ok("a live employee answers an inbound message", say().reply === true, say());
ok("no employee configured means silence", say({ employee: null }).reason === SKIP.NO_EMPLOYEE);
ok("a disabled employee is silent", say({ employee: { ...ON, enabled: false } }).reason === SKIP.DISABLED);
// The one the owner asked for by name: the contractor takes over and the AI
// stops, on that thread, without anyone switching a setting off.
ok("once a human has replied the AI stops", say({ humanReplied: true }).reason === SKIP.HUMAN_REPLIED);
ok("a thread handed to a person is never re-entered", say({ handedOff: true }).reason === SKIP.HANDED_OFF);
ok("a closed thread is not reopened by a bot", say({ thread: { status: "resolved" } }).reason === SKIP.THREAD_CLOSED);
ok("the per-thread cap stops it", say({ repliesSoFar: 3 }).reason === SKIP.CAP_REACHED);
ok("...and one below the cap does not", say({ repliesSoFar: 2 }).reply === true);
// Business hours stop it only for an employee that opted into them: a
// contractor who never set hours wants their inbox answered at 9pm, and
// inventing a closing time for them is padding absence with a default.
ok("outside business hours a business-hours employee stays quiet",
  say({ employee: { ...ON, businessHoursOnly: true }, businessHoursOpen: false }).reason === SKIP.OUTSIDE_HOURS);
ok("...while one with no hours set still answers",
  say({ businessHoursOpen: false }).reply === true);
ok("it never answers its own outbound message", say({ message: { direction: "out", body: "hi" } }).reason === SKIP.NOT_INBOUND);
ok("an empty message is not something to answer", say({ message: { direction: "in", body: "  " } }).reason === SKIP.EMPTY_MESSAGE);
ok("with no AI configured it refuses rather than pretending", say({ aiConfigured: false }).reason === SKIP.AI_UNAVAILABLE);

// ── Credit: loud, never a silent degrade ───────────────────────────────────
{
  const out = say({ quota: { allowed: false, reason: "You've used this month's allowance." } });
  ok("out of credit stops the employee", out.reply === false && out.reason === SKIP.NO_CREDIT, out);
  // Ranked above the cap and the hours on purpose: it is the one state a
  // contractor cannot diagnose from the settings screen.
  const both = shouldReply({
    employee: ON, thread: OPEN, message: INBOUND, businessHoursOpen: false,
    quota: { allowed: false }, repliesSoFar: 99,
  });
  ok("...and out-of-credit is the reason reported, not a lesser one", both.reason === SKIP.NO_CREDIT, both);
}
ok("every skip reason is a declared one", SKIP_REASONS.length === new Set(SKIP_REASONS).size && SKIP_REASONS.includes(SKIP.NO_CREDIT));

// ── Ask is the default; auto is a deliberate act ───────────────────────────
ok("an employee that never touched the switch is ASK", sendMode({ enabled: true }) === MODE_SUGGEST && MODE_SUGGEST === "ask");
ok("...and so is one whose column is null", sendMode({ enabled: true, mode: null }) === "ask");
ok("...and one whose column is a value nobody declared", sendMode({ mode: "yolo" }) === "ask");
// The OLD boolean is no longer read. A row that still says autoReplyEnabled:
// true but mode "ask" (the migration wrote mode from it once) is ASK.
ok("the superseded boolean is not consulted", sendMode({ autoReplyEnabled: true, mode: "ask" }) === "ask");
ok("only a declared value is AUTO", sendMode({ mode: "auto" }) === MODE_AUTO);
ok("the mode travels with every decision", say().mode === MODE_AUTO && say({ employee: { ...ON, mode: "ask" } }).mode === "ask");

// ══════════════════════════════════════════════════════════════════════════
// Permission modes: three words, three risks, one floor
// ══════════════════════════════════════════════════════════════════════════
ok("three modes, in order", MODES.join(",") === "ask,accept_edits,auto");
ok("three risks, in order", RISKS.join(",") === "reversible,commits,floor");
// The whole matrix, executed. Tainted (every channel turn) first.
const M = (mode, risk, tainted = true) => mayActAlone({ mode, risk, tainted });
ok("ask: nothing alone", !M("ask", "reversible") && !M("ask", "commits") && !M("ask", "floor"));
ok("accept_edits: reversible alone", M("accept_edits", "reversible"));
ok("accept_edits: a tainted commit is proposed", !M("accept_edits", "commits"));
ok("accept_edits: an untainted commit would run alone", M("accept_edits", "commits", false));
ok("accept_edits: floor never", !M("accept_edits", "floor") && !M("accept_edits", "floor", false));
ok("auto: reversible and commits alone", M("auto", "reversible") && M("auto", "commits"));
// THE row. If this ever flips, "auto" has come to mean "spend the company's money".
ok("auto: floor NEVER, tainted or not", !M("auto", "floor") && !M("auto", "floor", false));
ok("an unknown mode is ask", !M("root", "reversible"));
ok("an unknown risk is floor", !M("auto", "unclassified"));
ok("tainted defaults to true", mayActAlone({ mode: "accept_edits", risk: "commits" }) === false);
ok("modeOf refuses to invent a mode", modeOf({ mode: "sudo" }) === "ask" && modeOf(null) === "ask");

// The sentences: one per mode, in every language, and English equal to the file's.
{
  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
  const LANGS = Object.keys(APP_MESSAGES);
  ok("nine languages in the catalogue", LANGS.length === 9, LANGS);
  for (const mode of MODES) {
    const key = MODE_SENTENCE_KEY[mode];
    ok(`${mode}: has a sentence key`, typeof key === "string");
    ok(`${mode}: English sentence is the permission file's`, APP_MESSAGES.en[key] === MODE_SENTENCE_EN[mode]);
    for (const lang of LANGS) {
      ok(`${lang}: ${mode} sentence present`, typeof APP_MESSAGES[lang][key] === "string" && APP_MESSAGES[lang][key].length > 20);
      ok(`${lang}: ${mode} label present`, typeof APP_MESSAGES[lang][`app.aiEmployee.mode.${mode}`] === "string");
    }
  }
  // The auto sentence says, in words, that customers' messages can book.
  ok("auto sentence says customers' messages can book the calendar", /Customers' messages can book your calendar directly/.test(MODE_SENTENCE_EN.auto));
  ok("every sentence says money is never spent without you", MODES.every((m) => /Money is never spent/.test(MODE_SENTENCE_EN[m])));
  ok("five floor items, each with a word in every language",
    FLOOR_LIST_KEYS.length === 5 && LANGS.every((lang) => FLOOR_LIST_KEYS.every((k) => typeof APP_MESSAGES[lang][k] === "string")));
  for (const lang of LANGS) {
    ok(`${lang}: the on/off switch states its consequence`,
      typeof APP_MESSAGES[lang]["app.aiEmployee.enabledOffSentence"] === "string" && typeof APP_MESSAGES[lang]["app.aiEmployee.enabledOnSentence"] === "string");
    ok(`${lang}: the SMS channel has its no-number sentence`, typeof APP_MESSAGES[lang]["app.aiEmployee.smsUnavailable"] === "string");
    for (const c of CHANNELS) ok(`${lang}: channel ${c} has a label`, typeof APP_MESSAGES[lang][`app.aiEmployee.channel.${c}`] === "string");
    for (const v of AI_EMPLOYEE_VOICES) ok(`${lang}: voice ${v} has a label`, typeof APP_MESSAGES[lang][`app.aiEmployee.voice.${v}`] === "string");
  }
}

// ── Every tool has a risk, declared beside the tool ────────────────────────
{
  const { TOOL_RISK, riskOf, proposalExpiry } = await import("../lib/aiEmployee/tools.js");
  for (const t of AI_EMPLOYEE_TOOLS) ok(`${t}: has a risk class`, RISKS.includes(TOOL_RISK[t]), TOOL_RISK[t]);
  ok("no risk is declared for a tool that does not exist", Object.keys(TOOL_RISK).every((t) => AI_EMPLOYEE_TOOLS.includes(t)));
  ok("book_appointment commits", TOOL_RISK.book_appointment === "commits");
  ok("a reply-shaped tool is reversible", TOOL_RISK.book_callback === "reversible" && TOOL_RISK.send_instant_quote_link === "reversible");
  ok("an unknown tool's risk is floor", riskOf("delete_everything") === "floor");
  // Stale: a booking's expiry is its slot; nothing else expires on its own.
  const soon = Date.now() + 60_000;
  ok("a booking proposal expires at its slot", proposalExpiry("book_appointment", { slot_id: `abc123_${soon}` })?.getTime() === soon);
  ok("a callback proposal never goes stale on its own", proposalExpiry("book_callback", {}) === null);
  ok("a mangled slot id has no expiry rather than a NaN date", proposalExpiry("book_appointment", { slot_id: "nonsense" }) === null);

  const tools = code("lib/aiEmployee/tools.js");
  ok("executeFor asks mayActAlone before any tool runs", /mayActAlone\(\{ mode, risk, tainted \}\)/.test(tools));
  ok("...and a refused write becomes a proposal, not a run", /onProposal\(\{ name, args, risk \}\)/.test(tools) && /proposed: true/.test(tools));
  ok("...and a dry run reports would_propose", /would_propose/.test(tools));
  ok("book_appointment reaches the SAME bookSlot the phone receptionist uses", /bookSlot\(\{/.test(tools) && /from "@\/lib\/voice\/availability"/.test(tools));
  ok("check_availability reaches the same reader", /bookableSlots\(companyId/.test(tools));
  ok("a visit fee returns the booking link rather than booking", /reason === "fee_due"/.test(tools) && /bookingUrl: policy\.bookingUrl/.test(tools));
  ok("a taken slot is told to the model by name", /result\.reason === "taken"/.test(tools));
  ok("the instant-quote link carries no price", /instant-quote\/\$\{encodeURIComponent\(slug\)\}/.test(tools) && !/unitPrice[^\n]*sendInstantQuoteLink/.test(tools));
  ok("the proposal executor is the only other door onto the implementations", /export async function runToolForCompany/.test(tools) && (tools.match(/IMPLEMENTATIONS\[name\]/g) || []).length === 2);
  ok("bookSlot takes a source so the calendar can say who booked", /source = "phone_assistant"/.test(code("lib/voice/availability.js")) && /\n\s+source,\n/.test(code("lib/voice/availability.js")));
}

// ── Tenant isolation, restated by the owner: one executed check per statement ──
{
  const tools = code("lib/aiEmployee/tools.js");
  // 1. companyId is injected by executeFor, never taken from the model or the visitor.
  // The thread and the calling employee ride in the same way, for the
  // hand-off: the model names a ROLE, and the executor supplies which thread
  // moves and who let go of it.
  // `context` (2026-10-04) is the known client's record and the waiting
  // troubleshooting attempt — injected after the args like the rest.
  ok("1. executeFor injects companyId AFTER the model's args", /impl\(\{ \.\.\.args, companyId, source, language, threadId, employeeId, prisma, context \}\)/.test(tools));
  // The proposal executor now passes the PROPOSAL ROW's threadId, so an
  // approved callback on a known client's thread becomes their ticket.
  ok("1b. runToolForCompany injects it the same way", (tools.match(/\{ \.\.\.args, companyId, source, language, threadId \}/g) || []).length === 1);
  ok("1c. the visitor's companyId is not in the args hash, so it cannot be smuggled through an edit",
    argsHash({ name: "a", companyId: "X" }) === argsHash({ name: "a", companyId: "Y" }) && argsHash({ name: "a" }) === argsHash({ name: "a", companyId: "Z" }));
  // 2. Web-chat and SMS threads resolve to exactly one company before any tool runs.
  const web = code("lib/aiEmployee/webChat.js");
  ok("2a. the web chat resolves the company from the slug and nothing else", /findBookingCompany\(companySlug/.test(web) && !/companyId: body|body\.companyId|searchParams\.get\("companyId"\)/.test(web));
  ok("2b. ...and refuses a thread whose company disagrees", /tenant_mismatch/.test(web));
  const sms = code("lib/aiEmployee/smsChannel.js");
  ok("2c. a phone held by two companies gets no automatic reply", /const shared = companies\.length > 1/.test(sms) && /noAutoReply: shared/.test(sms));
  ok("2d. ...and the ingest honours that flag before the employee hook", /!event\.noAutoReply/.test(code("lib/messaging/ingest.js")));
  ok("2e. ...and the shared line is written to the thread for a person to read", /type: "shared_line"/.test(sms));
  ok("2f. the acknowledgement is never sent on a shared line", /\} else if \(result\.created && !result\.ai\?\.replied\)/.test(sms));
  // 3. A proposal can only be approved by a member of its own company.
  const proposals = code("lib/aiEmployee/proposals.js");
  ok("3a. the proposal is read under the member's companyId", /findFirst\(\{ where: \{ id, companyId \} \}\)/.test(proposals));
  ok("3b. ...and executed with the ROW's companyId, never the request's", /runTool\(\{ companyId: row\.companyId/.test(proposals));
  const approveRoute = code("app/api/ai-employee/proposals/[id]/route.js");
  ok("3c. the route passes the session's companyId", /companyId: member\.companyId/.test(approveRoute) && !/body\.companyId/.test(approveRoute));
  ok("3d. a support session cannot approve", /member\.impersonation/.test(approveRoute));
  // 4. sources.js reads only that company's documents.
  const respond = code("lib/aiEmployee/respond.js");
  // "partial" (2026-10-04): a manual with scanned pages unread — its read
  // pages are material. Still one company, still the only read.
  ok("4. the material is read under companyId", /aiEmployeeSource\.findMany\(\{\s*where: \{ companyId, status: \{ in: \["ready", "partial"\] \} \}/.test(respond));
  ok("4b. a manual's pages are read under companyId too", /aiEmployeeSourcePage\.findMany\(\{\s*where: \{ companyId, sourceId: \{ in: ids \}/.test(respond));
  // 5. The prompt never carries another tenant's data — roles.js is pure assembly,
  //    so a foreign source handed in is the CALLER's fault and the query above is
  //    the only caller. Executed: a prompt built with no sources says none.
  const foreign = buildEmployeePrompt({ employee: ON, company: { name: "Mine" }, sources: [] });
  ok("5. a prompt built from an empty read carries no material", /None uploaded/.test(foreign));
  // 6. The employee is picked under companyId, and an employee switched off is invisible.
  const employees = code("lib/aiEmployee/employees.js");
  ok("6a. employeeForChannel reads under companyId", /where: \{ companyId, enabled: true \}/.test(employees));
  ok("6b. an off employee is never picked", pickEmployee([{ id: "a", enabled: false, webChatEnabled: true, createdAt: 1 }], "web") === null);
  ok("6c. the oldest enabled holder of a channel wins", pickEmployee([
    { id: "new", enabled: true, webChatEnabled: true, createdAt: 2 },
    { id: "old", enabled: true, webChatEnabled: true, createdAt: 1 },
  ], "web")?.id === "old");
  ok("6d. an unknown channel picks nobody", pickEmployee([{ id: "a", enabled: true, metaEnabled: true }], "carrier_pigeon") === null);
  ok("6e. two employees cannot both claim a channel",
    channelConflicts([{ id: "a", enabled: true, smsEnabled: true }], { id: "b", enabled: true, smsEnabled: true }).join(",") === "sms" &&
    channelConflicts([{ id: "a", enabled: true, smsEnabled: true }], { id: "b", enabled: false, smsEnabled: true }).length === 0);
  ok("6f. the settings route refuses a channel conflict", /channel_conflict/.test(code("lib/aiEmployee/settings.js")) && /planEmployeeSave\(/.test(code("app/api/ai-employee/route.js")));
}

// ── Proposals: approve runs the same tool, bound to what was read, never stale ──
{
  const { executeProposal, isStale, publicProposal } = await import("../lib/aiEmployee/proposals.js");
  const now = new Date("2026-09-19T12:00:00Z");
  const mkDb = (row) => {
    const updates = [];
    return {
      updates,
      aiEmployeeProposal: {
        findFirst: async ({ where }) => (row && where.id === row.id && where.companyId === row.companyId ? row : null),
        update: async ({ data }) => { updates.push(data); return { ...row, ...data }; },
      },
    };
  };
  const args = { slot_id: `abc123_${now.getTime() + 3600_000}`, name: "Ana", phone: "6135551234" };
  const row = { id: "p1", companyId: "C1", tool: "book_appointment", args, status: "pending", expiresAt: new Date(now.getTime() + 3600_000) };
  const ran = [];
  const runTool = async (x) => { ran.push(x); return { ok: true, bookingId: "b1" }; };

  const foreign = await executeProposal({ companyId: "C2", id: "p1", expectedHash: argsHash(args) }, { db: mkDb(row), runTool, now: () => now });
  ok("a member of another company cannot approve", foreign.reason === "unknown_proposal" && ran.length === 0);

  const wrongHash = await executeProposal({ companyId: "C1", id: "p1", expectedHash: "deadbeef" }, { db: mkDb(row), runTool, now: () => now });
  ok("an approval whose hash is not what was read is refused", wrongHash.reason === "hash_mismatch" && ran.length === 0);

  const edited = { ...args, name: "Ana Lopez" };
  const editedWrong = await executeProposal({ companyId: "C1", id: "p1", args: edited, expectedHash: argsHash(args) }, { db: mkDb(row), runTool, now: () => now });
  ok("an edit must carry the hash of the EDITED arguments", editedWrong.reason === "hash_mismatch" && ran.length === 0);

  const db1 = mkDb(row);
  const good = await executeProposal({ companyId: "C1", id: "p1", expectedHash: argsHash(args), userId: "u1" }, { db: db1, runTool, now: () => now });
  ok("a matching approval runs the tool", good.ok && good.status === "approved" && ran.length === 1);
  ok("...with the ROW's companyId injected", ran[0].companyId === "C1" && ran[0].name === "book_appointment");
  ok("...and records who and when", db1.updates.at(-1).decidedByUserId === "u1" && db1.updates.at(-1).status === "approved");

  const db2 = mkDb(row);
  const editedGood = await executeProposal({ companyId: "C1", id: "p1", args: edited, expectedHash: argsHash(edited) }, { db: db2, runTool, now: () => now });
  ok("an edit with its own hash runs the edited arguments", editedGood.ok && ran.at(-1).args.name === "Ana Lopez");

  // Stale: the slot itself has started. The stored expiry AND the slot in the
  // arguments agree, as they do for every row createProposal writes.
  const pastArgs = { ...args, slot_id: `abc123_${now.getTime() - 1}` };
  const stale = { ...row, args: pastArgs, expiresAt: new Date(now.getTime() - 1) };
  const before = ran.length;
  const db3 = mkDb(stale);
  const late = await executeProposal({ companyId: "C1", id: "p1", expectedHash: argsHash(pastArgs) }, { db: db3, runTool, now: () => now });
  ok("a stale proposal is marked stale and NEVER executed", late.reason === "stale" && ran.length === before && db3.updates.at(-1).status === "stale");
  ok("an edit that moves a booking into the past is stale too", (await executeProposal(
    { companyId: "C1", id: "p1", args: { ...args, slot_id: `abc123_${now.getTime() - 5}` }, expectedHash: argsHash({ ...args, slot_id: `abc123_${now.getTime() - 5}` }) },
    { db: mkDb(row), runTool, now: () => now },
  )).reason === "stale" && ran.length === before);

  const decided = { ...row, status: "approved" };
  ok("a decided proposal cannot be run twice", (await executeProposal({ companyId: "C1", id: "p1", expectedHash: argsHash(args) }, { db: mkDb(decided), runTool, now: () => now })).reason === "already_decided" && ran.length === before);
  ok("isStale is from the clock, not the status", isStale({ expiresAt: new Date(now.getTime() - 1) }, now) && !isStale({ expiresAt: null }, now));
  ok("the public shape carries the hash the approve must echo", publicProposal({ ...row, createdAt: now }).argsHash === argsHash(args));

  const routeSrc = code("app/api/ai-employee/proposals/[id]/route.js");
  ok("the approve route requires a hash", /no_hash/.test(routeSrc));
  ok("nothing else executes a proposal", !/runToolForCompany/.test(routeSrc) && /executeProposal\(/.test(routeSrc));
  const others = ["app/api/ai-employee/route.js", "app/api/ai-employee/suggestions/route.js", "app/api/ai-employee/test/route.js", "lib/aiEmployee/respond.js", "lib/aiEmployee/inbound.js", "lib/aiEmployee/webChat.js", "lib/aiEmployee/smsChannel.js"];
  ok("runToolForCompany is imported only by proposals.js", others.every((f) => !/runToolForCompany/.test(code(f))) && /runToolForCompany/.test(code("lib/aiEmployee/proposals.js")));
}

// ── The responder: mode applied to the reply, proposals written, best tier ──
{
  const respond = code("lib/aiEmployee/respond.js");
  ok("a reply is a reversible act and goes out only when the mode allows", /mayActAlone\(\{ mode: verdict\.mode, risk: RISK_REVERSIBLE, tainted: true \}\)/.test(respond));
  ok("proposals are written after the reply row exists, with its id", /createProposal\(/.test(respond) && /replyId,\s*channel: chan/.test(respond));
  ok("every employee conversation runs on the best tier", /tier: AI_EMPLOYEE_TIER/.test(respond) && /AI_EMPLOYEE_TIER = "best"/.test(respond));
  ok("the best tier resolves to the best model", modelForTier("best") === AI_BEST_MODEL && tierForModel(AI_BEST_MODEL) === "best" && tierForModel("gpt-5-mini") === "standard");
  ok("the best model's default has a rate in the price table", hasKnownPricing(AI_BEST_MODEL), AI_BEST_MODEL);
  ok("...so a conversation's typical cost is a number, never null", Number.isInteger(typicalConversationCostCents(AI_BEST_MODEL)) && typicalConversationCostCents(AI_BEST_MODEL) > 0);
  ok("...and an unknown model's cost is null, never zero", typicalConversationCostCents("gpt-imaginary") === null && pricingFor("gpt-imaginary") === null);
  ok("the disclosure line opens the first reply on a thread", /state\.repliesSoFar === 0/.test(respond) && /disclosureLine\(/.test(respond));
  ok("out of credit fetches a person by name", /type: "ai_employee\.handoff"/.test(respond) && /reason: SKIP\.NO_CREDIT/.test(respond));
  ok("the employee is picked per channel, under companyId", /employeeForChannel\(companyId, chan, prisma\)/.test(respond) && /findFirst\(\{ where: \{ id: employeeId, companyId \} \}\)/.test(respond));
  ok("the runToolLoop honours the tier it is handed", /const model = modelForTier\(tier\)/.test(code("lib/ai/provider.js")) && !/model: MODEL,\s*\.\.\.reasoningParams\(MODEL\)/.test(code("lib/ai/provider.js")));
  // The disclosure, nine languages, always names the employee and the company.
  ok("the disclosure covers nine languages", DISCLOSURE_LANGUAGES.length === 9);
  for (const lang of DISCLOSURE_LANGUAGES) {
    const line = disclosureLine({ displayName: "Sam", companyName: "Northline", language: lang });
    ok(`${lang}: disclosure names Sam and Northline`, /Sam/.test(line) && /Northline/.test(line) && !/\{name\}|\{company\}/.test(line));
  }
  ok("a nameless employee is still disclosed", /assistant/.test(disclosureLine({ displayName: "", companyName: "X" })));
  // The voice is a paragraph, never a tool.
  for (const v of AI_EMPLOYEE_VOICES) ok(`voice ${v} is a style paragraph`, typeof voiceLine(v) === "string" && voiceLine(v).length > 20);
  ok("an unknown voice adds nothing", voiceLine("shouty") === null);
  ok("the voice reaches the prompt", /friendly colleague/.test(buildEmployeePrompt({ employee: { role: "closer", voice: "friendly" }, company: {}, sources: [] })));
  ok("the prompt no longer forbids saying it is an assistant", !/NEVER say you are an AI/.test(buildEmployeePrompt({ employee: ON, company: {}, sources: [] })));
  ok("...and still forbids claiming to be human", /NEVER claim to be a human being/.test(buildEmployeePrompt({ employee: ON, company: {}, sources: [] })));
}

// ── Web chat: draft in ask, send in auto, someone-will-reply otherwise ──────
{
  const inbound = code("lib/aiEmployee/inbound.js");
  // The sender re-reads the SENDING employee's mode at the moment of sending
  // — the second, independent copy of the gate respond.js applies first.
  // Keyed on the employee respond.js names, because after a hand-off the
  // thread already belongs to the colleague while the first employee's
  // one-liner is going out.
  ok("the inbound hook sends only when the mode lets a reply go alone", /mayActAlone\(\{ mode: sendMode\(employee\), risk: RISK_REVERSIBLE, tainted: true \}\)/.test(inbound) && /guardedDeliver\(\{ companyId, threadId, employeeId, text \}\)/.test(inbound));
  ok("...and no longer picks the employee by channel — routing does", !/employeeForChannel\(/.test(inbound) && /platform === "web" \? "web" : platform === "sms" \? "sms" : "meta"/.test(inbound));
  ok("...with one cheap count as the door for companies with nothing on", /aiEmployee\.count\(\{ where: \{ companyId, enabled: true \} \}\)/.test(inbound));
  const web = code("lib/aiEmployee/webChat.js");
  ok("a web message goes through the one ingest", /ingest\(\{\s*platform: "web"/.test(web));
  ok("the widget is told replied or waiting, nothing else", /result\.ai\?\.replied \? "replied" : "waiting"/.test(web));
  ok("the visitor is burst-limited per token", /VISITOR_BURST_LIMIT/.test(web) && /rate_limited/.test(web));
  const widget = code("app/components/chat/SiteChatWidget.js");
  ok("the widget prints 'someone will reply shortly' on waiting", /copy\.waiting/.test(widget));
  ok("the widget stores only the token in the browser", (widget.match(/localStorage\.(setItem|getItem)/g) || []).length === 2 && !/localStorage\.setItem\([^)]*(phone|email|name)/i.test(widget));
  ok("'talk to a person' is a message the employee hands off on", /copy\.personMessage/.test(widget));
  ok("nothing on the widget names FieldQuo", !/FieldQuo/i.test(widget));
  ok("the widget's copy covers nine languages", WEB_CHAT_LANGUAGES.length === 9 && WEB_CHAT_LANGUAGES.every((l) => /\S/.test(webChatCopy(l, "X").waiting)));
  ok("the mount renders nothing when no employee answers the web channel", /if \(!config\?\.enabled\) return hosted \? <ChatDisabledSignal \/> : null;/.test(code("app/components/chat/SiteChatMount.js")));
  ok("...and under the loader that nothing is SAID, so the loader removes its frame", /export function ChatDisabledSignal\(\)[\s\S]{0,200}postToHost\(\{ state: "disabled" \}\)[\s\S]{0,40}return null;/.test(widget));
  ok("the site page mounts it with the page's own language", /<SiteChatMount companySlug=\{company\.bookingSlug \|\| company\.slug\} language=\{language\}/.test(code("app/site/[subdomain]/page.js")));
  ok("the embed serves it as the 'chat' widget", /"chat"/.test(code("app/embed/[companySlug]/[widget]/page.js")));
  ok("the send router carries web and sms before the WhatsApp branch", /platform === "web" \|\| platform === "sms"/.test(code("lib/messaging/send.js")));
  ok("the web send never leaves the building", /web:\$\{crypto\.randomUUID\(\)\}/.test(code("lib/messaging/ownSend.js")));
}

// ── The chat.js loader: one line on a site we did not build ─────────────────
// Executed, not grepped, where it can be: the loader is a string handed to
// every browser that visits a contractor's site, with no build step between.
{
  const acorn = await import("acorn");
  const { chatLoaderScript, isLoaderSlug, FRAME_PAD } = await import("../lib/embed/chatLoader.js");
  const src = chatLoaderScript({ origin: "https://www.fieldquo.com", slug: "demo5" });
  let es5 = true;
  try {
    acorn.parse(src, { ecmaVersion: 5 });
  } catch {
    es5 = false;
  }
  ok("the loader parses as ES5", es5);
  ok("...uses no eval, innerHTML or document.write (CSP-friendly)", !/\beval\b|innerHTML|new Function|insertAdjacentHTML|document\.write|cssText/.test(src));
  ok("...defines one global, window.fqChat", (src.match(/\bw\.[A-Za-z_$]+\s*=/g) || []).every((m) => /w\.fqChat/.test(m)));
  ok("...checks BOTH the origin and its own frame on every message", /e\.origin !== ORIGIN \|\| e\.source !== frame\.contentWindow/.test(src));
  ok("...names FieldQuo nowhere but the origin", !/fieldquo/i.test(src.replace("https://www.fieldquo.com", "")));
  ok("...starts hidden and removes itself when the frame says disabled", /visibility: "hidden"/.test(src) && /m\.state === "disabled"[\s\S]{0,40}destroy\(\)/.test(src));
  ok("...refuses a slug or origin that could break out of the string", ["a/b", 'x"y', "</script>", "", "é"].every((s) => !isLoaderSlug(s) && chatLoaderScript({ origin: "https://x.com", slug: s }) === "") && chatLoaderScript({ origin: "javascript:alert(1)", slug: "a" }) === "");
  const widget = code("app/components/chat/SiteChatWidget.js");
  ok("the widget's FRAME_PAD matches the loader's", new RegExp(`const FRAME_PAD = ${FRAME_PAD};`).test(widget));
  ok("the widget posts sizes only when hosted, and hears only its parent", /if \(!hosted\) return undefined;[\s\S]{0,40}if \(open\) \{\s*postToHost/.test(widget) && /e\.source !== window\.parent/.test(widget));
  ok("the embed asks for hosted mode only on ?host=loader", /const hosted = sp\.host === "loader";/.test(code("app/embed/[companySlug]/[widget]/page.js")));
  ok("the settings snippet is the loader", /<script src="\$\{origin\}\/embed\/\$\{slug\}\/chat\.js" async><\/script>/.test(code("app/api/ai-employee/route.js")));
}

// ── SMS: greyed without a number, STOP untouched, from the system number ───
{
  const own = code("lib/messaging/ownSend.js");
  ok("an SMS send refuses by name when FieldQuo holds no system number", /no_system_number/.test(own) && /systemSmsNumber\(\)/.test(own));
  ok("...and checks the opt-out before every send", /maySms\(\{ companyId, phone: to \}\)/.test(own));
  const route = code("app/api/sms/inbound/route.js");
  ok("STOP/START are classified before the inbox sees the text", route.indexOf("classifyInboundSms(body)") < route.indexOf("handleInboundClientSms("));
  ok("the inbox is reached only for a non-keyword text", /if \(!verdict\) \{[\s\S]*handleInboundClientSms\(/.test(route));
  const settings = code("app/api/ai-employee/route.js");
  ok("the settings route refuses to switch SMS on without a number", /no_system_number/.test(code("lib/aiEmployee/settings.js")) && /smsAvailable/.test(settings));
  ok("...and tells the screen whether one exists", /sms: \{ available: Boolean\(smsNumber\)/.test(settings));
  const page = code("app/app/settings/ai-employee/page.js");
  ok("the screen greys the SMS switch out", /disabled=\{!data\.sms\?\.available\}/.test(page));
  ok("the screen never renders the old boolean switch", !/autoReplyEnabled/.test(page));
  ok("the screen offers all three channels in the test box", /\["meta", MessageSquare/.test(page) && /\["web", Globe/.test(page) && /\["sms", Smartphone/.test(page));
  ok("...and prints would-send against would-wait", /wouldSend/.test(page) && /wouldWait/.test(page) && /wouldPropose/.test(page));
  ok("the test route takes the channel and the employee", /isChannel\(body\.channel\)/.test(code("app/api/ai-employee/test/route.js")));
  ok("the screen warns when the mode moves up", /modeMovesUp/.test(page) && /MODE_RANK/.test(page));
  ok("the screen shows the model and the typical cost as an estimate", /typicalConversationCents/.test(page) && /estimate/.test(page));
  ok("the on/off switch prints its consequence", /enabledOffSentence/.test(page) && /enabledOnSentence/.test(page));
  ok("mode and on/off changes are audited with a name", /ai_employee\.mode_changed/.test(settings) && /ai_employee\.enabled/.test(settings) && /recordActivity\(member/.test(settings));
}

// ── Roles: disjoint and complete, booking where it belongs ─────────────────
for (const role of AI_EMPLOYEE_ROLES) {
  const r = roleFor(role);
  const both = r.allowed.filter((t) => r.forbidden.includes(t));
  ok(`${role}: allowed and forbidden are disjoint`, both.length === 0, both);
  const union = new Set([...r.allowed, ...r.forbidden]);
  ok(`${role}: together they cover every tool`, AI_EMPLOYEE_TOOLS.every((t) => union.has(t)) && union.size === AI_EMPLOYEE_TOOLS.length, [...union]);
}
ok("the closer books and quotes", toolsForRole("closer").includes("book_appointment") && toolsForRole("closer").includes("send_instant_quote_link"));
ok("the receptionist books but never quotes", toolsForRole("receptionist").includes("book_appointment") && !toolsForRole("receptionist").includes("send_instant_quote_link") && !toolsForRole("receptionist").includes("create_instant_quote"));
// Owner, 2026-10-04: "book a call with a tech" is a REAL time — the
// troubleshooter reads the calendar and books, and still never quotes.
ok("the troubleshooter books a real time with a tech but never quotes", toolsForRole("troubleshooter").includes("book_appointment") && toolsForRole("troubleshooter").includes("check_availability") && !toolsForRole("troubleshooter").includes("send_instant_quote_link") && !toolsForRole("troubleshooter").includes("create_instant_quote"));
ok("...and the company can switch the calendar off for it (they are switchable, not fixed)", switchableFor("troubleshooter").includes("book_appointment") && !toolsForRole("troubleshooter", { disabledTools: ["check_availability", "book_appointment"] }).includes("book_appointment"));
ok("custom is as narrow as the troubleshooter", !toolsForRole("custom").includes("book_appointment"));

// ── The platform list and the inbox ────────────────────────────────────────
ok("six platforms: Meta's three, FieldQuo's two, and email — which is in neither list the employee answers on", MESSAGING_PLATFORMS.join(",") === "facebook,instagram,whatsapp,web,sms,email" && META_PLATFORMS.join(",") === "facebook,instagram,whatsapp" && OWN_PLATFORMS.join(",") === "web,sms");
ok("each own platform has a conversation source the rollup knows", OWN_PLATFORMS.every((p) => CONVERSATION_SOURCES.includes(SOURCE_FOR_PLATFORM[p])));
ok("Meta connection reads only Meta's three", /platform: \{ in: \[\.\.\.META_PLATFORMS\] \}/.test(code("lib/messaging/channels.js")));
ok("the notification types exist and land somewhere", Boolean(NOTIFICATION_TYPES["ai_employee.proposal"]) && Boolean(NOTIFICATION_TYPES["ai_employee.handoff"]) && hrefFor({ entityType: "aiEmployeeProposal", entityId: "x" }) === "/app/settings/ai-employee#proposals");
ok("the appointments screen badges an AI-employee booking", /source === "ai_employee"/.test(code("app/app/appointments/page.js")));

// ── Schema ─────────────────────────────────────────────────────────────────
{
  const schema = read("prisma/schema.prisma");
  ok("AiEmployeeProposal exists", /model AiEmployeeProposal \{/.test(schema));
  const emp = schema.split("model AiEmployee {")[1]?.split("\nmodel ")[0] || "";
  ok("the mode column defaults to ask", /mode String @default\("ask"\)/.test(emp));
  ok("one employee per company AND role", /@@unique\(\[companyId, role\]\)/.test(emp));
  ok("the three channel switches exist", /metaEnabled/.test(emp) && /webChatEnabled/.test(emp) && /smsEnabled/.test(emp));
  ok("the face, the name and the voice exist", /displayName/.test(emp) && /avatarUrl/.test(emp) && /voice String\?/.test(emp));
  const prop = schema.split("model AiEmployeeProposal {")[1]?.split("\nmodel ")[0] || "";
  ok("a proposal records tool, args, risk, expiry and who decided", ["tool", "args", "risk", "expiresAt", "decidedByUserId", "status"].every((c) => new RegExp(`\\n\\s+${c}\\s`).test(prop)));
}

// ── Roles are capability sets ──────────────────────────────────────────────
for (const role of AI_EMPLOYEE_ROLES) {
  const tools = toolsForRole(role);
  ok(`${role}: every tool it may call is a declared one`, tools.every((t) => AI_EMPLOYEE_TOOLS.includes(t)), tools);
  ok(`${role}: it can always hand off to a person`, tools.includes("hand_off_to_human"), tools);
}
// The closer sells; the other two must not be able to, because a receptionist
// quoting a price is the product inventing a number nobody authorised.
ok("only the closer may create a quote",
  toolsForRole("closer").includes("create_instant_quote") &&
    !toolsForRole("receptionist").includes("create_instant_quote") &&
    !toolsForRole("troubleshooter").includes("create_instant_quote"));
ok("only the closer may read the price book",
  toolsForRole("closer").includes("look_up_service_prices") &&
    !toolsForRole("troubleshooter").includes("look_up_service_prices"));
ok("an unknown role does not fall through to the most powerful one",
  !toolsForRole("nonsense").includes("create_instant_quote"), toolsForRole("nonsense"));
ok("roleFor refuses to invent a role", Boolean(roleFor("closer")) && !AI_EMPLOYEE_ROLES.includes("nonsense"));

// ── The prompt carries the company's own material, and only theirs ─────────
{
  const prompt = buildEmployeePrompt({
    employee: { ...ON, name: "Sam", instructions: "Always mention the winter discount." },
    company: { name: "Northline Painting" },
    sources: [{ title: "Policy", kind: "policy", text: "We guarantee our work for two years." }],
  });
  const text = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
  ok("the prompt carries the company's name", /Northline Painting/.test(text));
  ok("...the contractor's own instructions", /winter discount/.test(text));
  ok("...and their uploaded material", /two years/.test(text));
  const other = buildEmployeePrompt({
    employee: ON, company: { name: "Northline Painting" }, sources: [],
  });
  ok("...and nothing from a company that supplied none", !/two years/.test(JSON.stringify(other)));
}
ok("the instructions fingerprint moves when the instructions do",
  instructionsFingerprint({ role: "closer", instructions: "a" }) !==
    instructionsFingerprint({ role: "closer", instructions: "b" }));
ok("...and is stable when nothing changed",
  instructionsFingerprint({ role: "closer", instructions: "a" }) ===
    instructionsFingerprint({ role: "closer", instructions: "a" }));

// ── The model never prices ─────────────────────────────────────────────────
{
  const tools = code("lib/aiEmployee/tools.js");
  ok("the quote tool reaches the server's own pricer", /instantQuoteServer|priceOneMaterial|priceAllMaterials/.test(tools));
  // A tool schema that accepted an amount would let the model name the price.
  ok("...and its schema takes measurements, never an amount",
    !/\b(amount|price|total|unitPrice)\b\s*:\s*\{\s*type:\s*["']number/.test(tools));
  ok("every tool execution is tenant-scoped", /companyId/.test(tools));
  ok("a tool run records what it did", /onTool/.test(tools));
}

// ── Metered, on the way out, every time ────────────────────────────────────
{
  const respond = code("lib/aiEmployee/respond.js");
  ok("the quota is checked before the model is called", /checkAiQuota/.test(respond));
  ok("...and the spend is recorded after", /recordAiUsage/.test(respond));
  ok("the model is reached only through the one provider", /from "@\/lib\/ai\/provider"/.test(respond));
  ok("...never by constructing a vendor client here", !/new OpenAI|openai\.chat|from "openai"/.test(respond));
  ok("a reply is written down with what it cost", /AiEmployeeReply|aiEmployeeReply/.test(respond));
}
{
  const inbound = code("lib/aiEmployee/inbound.js");
  // The guard lives in ONE place. inbound.js delegates to respondToMessage
  // rather than re-deciding, so there is no second copy to drift from the
  // first — which is how a bot ends up replying on a thread one of the two
  // copies thought was handed off.
  ok("the inbound hook delegates to the one responder", /respondToMessage\(/.test(inbound));
  ok("...and does not re-implement the decision", !/shouldReply\(/.test(inbound));
  ok("the responder is the thing that asks shouldReply", /shouldReply\(/.test(code("lib/aiEmployee/respond.js")));
}

// ── Schema ─────────────────────────────────────────────────────────────────
{
  const schema = read("prisma/schema.prisma");
  for (const model of ["AiEmployee", "AiEmployeeSource", "AiEmployeeReply"]) {
    ok(`${model} exists`, new RegExp(`model ${model} \\{`).test(schema));
  }
  const emp = schema.split("model AiEmployee {")[1]?.split("\nmodel ")[0] || "";
  ok("auto-reply is nullable so an untouched row is SUGGEST",
    /autoReplyEnabled\s+Boolean\?/.test(emp) || /autoReplyEnabled\s+Boolean\s+@default\(false\)/.test(emp), emp.slice(0, 0));
  const reply = schema.split("model AiEmployeeReply {")[1]?.split("\nmodel ")[0] || "";
  ok("every reply records its token cost", /promptTokens/.test(reply) && /completionTokens/.test(reply));
  ok("...and why it stayed silent when it did", /suppressedReason/.test(reply));
}

// ══════════════════════════════════════════════════════════════════════════
// It never invents a photograph — the job Cathy Monaghan Jardine put on hold
// ══════════════════════════════════════════════════════════════════════════
//
// "I've received your photo, thank you." — "What photo have you received?" —
// "I received the photo of your white kitchen cabinets that you just shared!
// It shows the area around your sink and stove very clearly." — "I never
// shared any photos." — "I'll have to put this project on hold."
//
// Three things are pinned here, because the rule is only real if all three
// hold: the RULE is in every role's prompt, the FACT the rule is applied to is
// in every role's prompt, and a draft that breaks it is refused with a named
// reason rather than sent.

// The words that lost the job, and the words that must still be allowed.
const HALLUCINATION = "I've received your photo, thank you. It shows your white kitchen cabinets around the sink and stove very clearly.";
const ASKING_FOR_ONE = "Could you send a photo of the kitchen when you get a chance?";

for (const role of AI_EMPLOYEE_ROLES) {
  const prompt = buildEmployeePrompt({
    employee: { role, tone: "warm" },
    company: { name: "TrueFinish Cabinets" },
    sources: [],
    tally: attachmentTally([]),
  });
  ok(`${role}: the prompt forbids inventing an attachment`,
    /NEVER say you have received, seen, opened or looked at/i.test(prompt), role);
  ok(`${role}: ...and states the count as a fact, not a rule`,
    /This conversation contains 0 attachments/.test(prompt), role);
  // Bug 3: the twelve-question wall. Tracey Leroux went silent on receiving it;
  // Lyne and Ayse got a conversation and both bought.
  ok(`${role}: at most two questions per message`,
    /At most TWO questions in any one message/.test(prompt), role);
  ok(`${role}: ...and never re-asks what the thread already answers`,
    /Never ask for something they have already told you/i.test(prompt), role);
}

// The fact moves with the rows. A prompt that said "0 attachments" on a thread
// carrying two would be worse than saying nothing.
{
  const two = attachmentTally([
    { direction: "in", attachments: [{ type: "image", mediaId: "m1" }, { type: "image", mediaId: "m2" }] },
  ]);
  ok("two inbound photos are counted as two", two.total === 2 && two.pictures === 2, two);
  const prompt = buildEmployeePrompt({ employee: { role: "closer" }, company: {}, sources: [], tally: two });
  ok("...and the prompt says so", /contains 2 attachments/.test(prompt));
  ok("...while still refusing to let it describe them", /never describe what is in one/i.test(prompt));

  // What the CONTRACTOR sent is not what the customer sent.
  ok("an outbound attachment is not the customer's",
    attachmentTally([{ direction: "out", attachments: [{ type: "image", mediaId: "m" }] }]).total === 0);
  // A dropped pin is not a photograph. Counting it would let the prompt tell
  // the model a picture exists.
  ok("a shared location is not an attachment a reply can look at",
    attachmentTally([{ direction: "in", attachments: [{ type: "location", location: { latitude: 45, longitude: -75 } }] }]).total === 0);
  // A photo whose bytes have not been fetched yet HAS been sent.
  ok("a pending photo still counts as received",
    attachmentTally([{ direction: "in", attachments: [{ type: "image", mediaId: "m" }] }]).total === 1);
  ok("a garbage column is zero, never a throw", attachmentTally(null).total === 0);
}

// ── The post-check refuses the draft, and only the drafts it should ────────
{
  const none = attachmentTally([]);
  const one = attachmentTally([{ direction: "in", attachments: [{ type: "image", mediaId: "m" }] }]);

  ok("the sentence that lost the job is a claim", claimsMedia(HALLUCINATION));
  ok("...and is REFUSED when the thread has nothing",
    mediaClaimRefusal({ text: HALLUCINATION, tally: none }) === MEDIA_CLAIM_REASON);
  ok("...with a named reason, not a bare false",
    typeof MEDIA_CLAIM_REASON === "string" && MEDIA_CLAIM_REASON.length > 0);
  ok("...and is allowed once a photo actually exists",
    mediaClaimRefusal({ text: HALLUCINATION, tally: one }) === null);

  // The other half, and the more important one: asking for a photo is the
  // correct behaviour and must never be refused, or the guard would make the
  // employee unable to request the thing it needs.
  ok("asking for a photo is not a claim to have one", !claimsMedia(ASKING_FOR_ONE));
  ok("...and is never refused", mediaClaimRefusal({ text: ASKING_FOR_ONE, tally: none }) === null);
  for (const innocent of [
    "How many doors and drawers are there?",
    "If you can share a couple of pictures I can get you a number.",
    "Pourriez-vous m'envoyer une photo de la cuisine ?",
    "A picture helps a lot — whenever you're ready.",
    "We can book someone to come and take photos if that's easier.",
  ]) {
    ok(`not refused: "${innocent.slice(0, 40)}…"`, mediaClaimRefusal({ text: innocent, tally: none }) === null);
  }
  for (const claim of [
    "Thanks for the pictures!",
    "Based on the photos, we'd refinish rather than reface.",
    "The photo shows about 26 doors.",
    "Looking at the images, the doors look like solid maple.",
    "J'ai bien reçu vos photos, merci.",
    "Gracias por las fotos.",
  ]) {
    ok(`refused: "${claim.slice(0, 40)}…"`, mediaClaimRefusal({ text: claim, tally: none }) === MEDIA_CLAIM_REASON);
  }
  ok("an empty draft claims nothing", !claimsMedia("") && !claimsMedia(null));
}

// ── And the responder actually applies it ──────────────────────────────────
{
  const respond = code("lib/aiEmployee/respond.js");
  ok("the responder counts what the customer actually sent", /attachmentTally/.test(respond));
  // buildPrompt is respond.js's injectable name for buildEmployeePrompt, defaulting to it.
  ok("...hands that count to the prompt", /buildPrompt\([^)]*tally/s.test(respond) && /buildEmployeePrompt: buildPrompt = buildEmployeePrompt/.test(respond));
  ok("...checks the finished draft against it", /mediaClaimRefusal\(/.test(respond));
  ok("...and records the refusal rather than sending", /suppressedReason:\s*mediaRefusal/.test(respond));
  // In SUGGEST mode a refused draft must not even be offered. The suggestion
  // list is where that is true, so it is asserted there rather than here.
  const list = code("app/api/ai-employee/suggestions/route.js");
  ok("a suppressed draft is never offered as a suggestion", /suppressedReason:\s*null/.test(list));

  // The test box prints `app.aiEmployee.skip.<reason>` with the raw reason as
  // its fallback, so a refusal with no sentence behind it shows a contractor
  // the token `claimed_media_not_received`. This is the one reason they most
  // need explained — it is the model having just made something up.
  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
  const key = `app.aiEmployee.skip.${MEDIA_CLAIM_REASON}`;
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`${lang}: the refusal has a sentence, not a raw token`,
      typeof APP_MESSAGES[lang][key] === "string" && APP_MESSAGES[lang][key].length > 10, lang);
  }
}

// ── The settings screen tells the truth about the modes ────────────────────
{
  const page = code("app/app/settings/ai-employee/page.js");
  ok("the screen offers the test box that proves what it would say", /test/i.test(page));
  ok("...and lists the modes from the server's own list with their sentences", /data\.modes\.map/.test(page) && /m\.sentenceKey/.test(page));
  ok("...and prints the floor in words", /data\.floorKeys\.map/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Routing: one employee per conversation ─────────────────────────────────
//
// The owner's rule — "you don't want all the employees answering at the same
// time — there's got to be a process for handling chats" — executed, not
// described. The pure functions are driven directly; respondToMessage is run
// against a scripted database for two employees on one thread, and exactly
// one of them composes.
// ═══════════════════════════════════════════════════════════════════════════
{
  const {
    INTENTS, ROLE_FOR_INTENT, ROUTING_EVENT_KINDS, HAND_OFF_TOOL,
    PING_PONG_WINDOW_MS, BURST_COUNT, BURST_WINDOW_MS, BURST_DEBOUNCE_MS, BURST_HOLD_MS,
    FRONT_DESK_FEATURE, FRONT_DESK_TIER,
    pickAssignee, needsClassification, classifyOutcome, classifyIntent, assignThread,
    pingPongVerdict, handOffToEmployee, burstVerdict, superseded, burstGate,
    humanTookOver, resumeCandidate, resumeEmployee, summariseRouting,
    introductionLine, INTRODUCTION_LANGUAGES,
  } = await import("../lib/aiEmployee/routing.js");
  const { definitionsForRole, executeFor, TOOL_RISK } = await import("../lib/aiEmployee/tools.js");
  const { switchableToolsForRole, cleanDisabledTools, ALWAYS_ON_TOOLS } = await import("../lib/aiEmployee/roles.js");
  const { respondToMessage, PROMPT_ERROR } = await import("../lib/aiEmployee/respond.js");

  // ── The vocabulary ───────────────────────────────────────────────────────
  ok("four intents, closed", INTENTS.length === 4 && ["book", "price", "problem", "other"].every((i) => INTENTS.includes(i)));
  ok("three of them have a default role; `other` has none", Object.keys(ROLE_FOR_INTENT).length === 3 && !("other" in ROLE_FOR_INTENT));
  ok("every default role is a real preset", Object.values(ROLE_FOR_INTENT).every((r) => AI_EMPLOYEE_ROLES.includes(r)));
  ok("the routing skips are declared reasons", [SKIP.NOT_ASSIGNEE, SKIP.HUMAN_TOOK_OVER, SKIP.BURST_MERGED].every((r) => SKIP_REASONS.includes(r)));
  ok("the hand-off tool is in the closed tool list", AI_EMPLOYEE_TOOLS.includes(HAND_OFF_TOOL));
  ok("...allowed for EVERY role", AI_EMPLOYEE_ROLES.every((r) => toolsForRole(r).includes(HAND_OFF_TOOL)));
  ok("...classified reversible", TOOL_RISK[HAND_OFF_TOOL] === "reversible");
  ok("...and never switchable off, nor is the human hand-off", AI_EMPLOYEE_ROLES.every((r) => !switchableToolsForRole(r).includes(HAND_OFF_TOOL) && !switchableToolsForRole(r).includes("hand_off_to_human")) && ALWAYS_ON_TOOLS.length === 2);
  ok("the front desk runs on the standard tier under its own feature name", FRONT_DESK_TIER === "standard" && FRONT_DESK_FEATURE === "ai_employee_front_desk" && FRONT_DESK_FEATURE !== "ai_employee_reply");
  ok("ten-minute ping-pong window, three-in-ten burst", PING_PONG_WINDOW_MS === 600_000 && BURST_COUNT === 3 && BURST_WINDOW_MS === 10_000 && BURST_HOLD_MS > BURST_DEBOUNCE_MS);
  ok("six routing event kinds", ROUTING_EVENT_KINDS.length === 6 && new Set(ROUTING_EVENT_KINDS).size === 6);

  // ── Classification → assignment table ────────────────────────────────────
  const R = { id: "R", role: "receptionist", enabled: true, createdAt: "2026-01-01", metaEnabled: true, webChatEnabled: true, smsEnabled: false, intents: [], displayName: "Rosa" };
  const C = { id: "C", role: "closer", enabled: true, createdAt: "2026-01-02", metaEnabled: false, webChatEnabled: false, smsEnabled: true, intents: [], displayName: "Cal" };
  const T = { id: "T", role: "troubleshooter", enabled: true, createdAt: "2026-01-03", metaEnabled: false, webChatEnabled: false, smsEnabled: false, intents: [], displayName: "Tam" };
  const team = [R, C, T];
  const table = [
    ["book", "web", "R"], ["price", "web", "C"], ["problem", "web", "T"],
    // `other` → the employee bound to the channel today
    ["other", "web", "R"], ["other", "sms", "C"],
    // `other` on a channel nobody holds → the receptionist
    ["other", "meta", "R"],
    // garbage → other
    ["yolo", "sms", "C"],
  ];
  for (const [intent, channel, want] of table) {
    ok(`table: ${intent} on ${channel} → ${want}`, pickAssignee({ rows: team, intent, channel })?.id === want);
  }
  ok("the company's own mapping beats the role default", pickAssignee({ rows: [R, { ...C, intents: ["book"] }, T], intent: "book", channel: "web" })?.id === "C");
  ok("a disabled employee is never picked", pickAssignee({ rows: [{ ...R, enabled: false }, C, T], intent: "book", channel: "web" })?.id !== "R");
  ok("an intent nobody's role handles falls to the channel holder", pickAssignee({ rows: [R, C], intent: "problem", channel: "sms" })?.id === "C");
  ok("one employee takes everything, whatever the intent", ["book", "price", "problem", "other"].every((i) => pickAssignee({ rows: [C], intent: i, channel: "meta" })?.id === "C"));
  ok("...and needs no classification call", !needsClassification([C]) && !needsClassification([C, { ...R, enabled: false }]) && needsClassification([C, R]));
  ok("nobody enabled → null, never a throw", pickAssignee({ rows: [{ ...R, enabled: false }], intent: "book", channel: "web" }) === null && pickAssignee({ rows: null, intent: "book" }) === null);
  ok("the model's answer is made safe", classifyOutcome({ intent: "book", reason: " a  visit " }).intent === "book" && classifyOutcome({ intent: "buy" }).intent === "other" && classifyOutcome(null).intent === "other" && classifyOutcome({ intent: "price", reason: "x".repeat(500) }).reason.length === 200);

  // The front desk: metered, standard tier, structured, never throws. Paid
  // from the company's AI credit (lib/ai/walletMeter.js), so each run is
  // handed a scripted wallet and a clock past the switch-over grace.
  {
    const wallet = (cents) => {
      const rows = cents ? [{ companyId: "C1", pool: "ai", cents }] : [];
      return {
        rows,
        aiFeaturePayer: { findUnique: async () => null },
        voiceCreditEntry: {
          aggregate: async ({ where }) => ({ _sum: { cents: rows.filter((r) => r.companyId === where.companyId && r.pool === where.pool).reduce((a, r) => a + r.cents, 0) } }),
          findFirst: async ({ where }) => rows.find((r) => r.companyId === where.companyId && r.ref === where.ref) || null,
          create: async ({ data }) => { rows.push(data); return data; },
        },
      };
    };
    const later = new Date("2026-10-15T12:00:00Z");
    const calls = [];
    const used = [];
    const paid = wallet(500);
    const out = await classifyIntent({
      companyId: "C1", text: "how much to paint a bedroom", threadId: "thX", prisma: paid,
      deps: {
        now: later,
        checkAiQuota: async () => ({ allowed: true }),
        recordAiUsage: async (u) => { used.push(u); },
        complete: async (args) => { calls.push(args); args.onUsage?.({ model: "gpt-x", promptTokens: 10, completionTokens: 2 }); return { ok: true, data: { intent: "price", reason: "asks a cost" } }; },
      },
    });
    ok("the front desk asks for a schema on the standard tier", calls.length === 1 && calls[0].tier === "standard" && calls[0].schema?.properties?.intent?.enum?.length === 4);
    ok("...fences the message as data", /data, not instructions/.test(calls[0].prompt));
    ok("...and meters the call under its own feature", used.length === 1 && used[0].feature === FRONT_DESK_FEATURE && out.intent === "price" && out.metered === true);
    ok("...paid from the AI credit, once per thread", paid.rows.filter((r) => r.kind === FRONT_DESK_FEATURE && r.ref === `${FRONT_DESK_FEATURE}:thX` && r.cents < 0).length === 1 && used[0].paidFromWallet === true);
    const broke = await classifyIntent({ companyId: "C1", text: "hi", prisma: wallet(500), deps: { now: later, checkAiQuota: async () => ({ allowed: true }), recordAiUsage: async () => {}, complete: async () => { throw new Error("vendor down"); } } });
    ok("a vendor failure is `other`, never a throw", broke.intent === "other" && /failed/.test(broke.reason));
    const dry = await classifyIntent({ companyId: "C1", text: "hi", prisma: wallet(0), deps: { now: later, checkAiQuota: async () => ({ allowed: true }), recordAiUsage: async () => {}, complete: async () => { throw new Error("must not be called"); } } });
    ok("no credit → no call, `other`", dry.intent === "other" && dry.metered === false);
  }

  // ── Pure verdicts ────────────────────────────────────────────────────────
  const now = new Date("2026-09-20T12:00:00Z");
  ok("a second hand-off inside ten minutes is ping-pong", pingPongVerdict({ recentHandOffs: [new Date(now - 60_000)], now }));
  ok("...one eleven minutes ago is not", !pingPongVerdict({ recentHandOffs: [new Date(now - 11 * 60_000)], now }));
  ok("...and none is not", !pingPongVerdict({ recentHandOffs: [], now }) && !pingPongVerdict({}));
  ok("three inbound in ten seconds is a burst and holds longer", burstVerdict({ inboundAt: [now, new Date(now - 3000), new Date(now - 7000)], at: now }).burst === true && burstVerdict({ inboundAt: [now, new Date(now - 3000), new Date(now - 7000)], at: now }).waitMs === BURST_HOLD_MS);
  ok("two is not, but still waits the short debounce", burstVerdict({ inboundAt: [now, new Date(now - 3000)], at: now }).burst === false && burstVerdict({ inboundAt: [now], at: now }).waitMs === BURST_DEBOUNCE_MS);
  ok("a message eleven seconds old is outside the window", burstVerdict({ inboundAt: [now, new Date(now - 3000), new Date(now - 11_000)], at: now }).burst === false);
  ok("the introduction covers nine languages and names the colleague", INTRODUCTION_LANGUAGES.length === 9 && INTRODUCTION_LANGUAGES.every((l) => introductionLine({ displayName: "Cal", language: l }).includes("Cal")));
  ok("...and falls back to English on an unknown one", introductionLine({ displayName: "Cal", language: "xx" }) === introductionLine({ displayName: "Cal", language: "en" }));

  // ── disabledTools ────────────────────────────────────────────────────────
  ok("a disabled tool leaves the role's list", !toolsForRole("closer", { disabledTools: ["look_up_service_prices"] }).includes("look_up_service_prices") && toolsForRole("closer").includes("look_up_service_prices"));
  ok("...and its definition", !definitionsForRole("closer", { disabledTools: ["look_up_service_prices"] }).some((d) => d.name === "look_up_service_prices"));
  ok("...but a hand-off cannot be disabled", ["hand_off_to_human", HAND_OFF_TOOL].every((t) => toolsForRole("closer", { disabledTools: ["hand_off_to_human", HAND_OFF_TOOL] }).includes(t)));
  ok("cleanDisabledTools drops forbidden, unknown and always-on names", cleanDisabledTools("receptionist", ["look_up_service_prices", "nope", "hand_off_to_human", "book_callback", "book_callback"]).join(",") === "book_callback");
  ok("garbage disabledTools narrows nothing", toolsForRole("closer", { disabledTools: "x" }).length === toolsForRole("closer").length && toolsForRole("closer", { disabledTools: [42] }).length === toolsForRole("closer").length);
  {
    let threw = null;
    const run = executeFor({ companyId: "C1", role: "closer", mode: "auto", disabledTools: ["look_up_service_prices"], onTool: () => {} });
    try { await run("look_up_service_prices", {}); } catch (e) { threw = e.message; }
    ok("executeFor refuses a disabled tool exactly like an unknown one", threw === "Unknown tool: look_up_service_prices");
    let threw2 = null;
    const run2 = executeFor({ companyId: "C1", role: "closer", mode: "auto", afterHandOff: true, onTool: () => {} });
    try { await run2(HAND_OFF_TOOL, { role: "receptionist", reason: "x" }); } catch (e) { threw2 = e.message; }
    ok("...and the hand-off on the turn after a hand-off", threw2 === `Unknown tool: ${HAND_OFF_TOOL}` && !definitionsForRole("closer", { afterHandOff: true }).some((d) => d.name === HAND_OFF_TOOL));
    // In `ask` a hand-off RUNS (simulated here); it is never a proposal.
    const seen = [];
    const run3 = executeFor({ companyId: "C1", role: "closer", mode: "ask", dryRun: true, onTool: (x) => seen.push(x), onProposal: async () => "p" });
    const r3 = await run3(HAND_OFF_TOOL, { role: "receptionist", reason: "x" });
    ok("a hand-off in ask mode is simulated on a dry run, never proposed", r3.simulated === true && seen[0].summary === "simulated" && !r3.proposed);
  }

  // ── A scripted database ──────────────────────────────────────────────────
  //
  // Just enough Prisma for the routing reads and writes: equality, in, not,
  // and the date comparisons the burst and ping-pong reads make.
  function matches(row, where = {}) {
    for (const [k, v] of Object.entries(where)) {
      if (k === "OR") { if (!v.some((w) => matches(row, w))) return false; continue; }
      const val = row[k];
      if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
        if ("in" in v && !v.in.includes(val)) return false;
        if ("not" in v) {
          if (v.not === null ? val == null : val === v.not) return false;
        }
        if ("gte" in v && !(new Date(val) >= new Date(v.gte))) return false;
        if ("gt" in v && !(new Date(val) > new Date(v.gt))) return false;
        if ("lte" in v && !(new Date(val) <= new Date(v.lte))) return false;
        if ("lt" in v && !(new Date(val) < new Date(v.lt))) return false;
        if (!("in" in v) && !("not" in v) && !("gte" in v) && !("gt" in v) && !("lte" in v) && !("lt" in v)) {
          // a relation filter such as channel: { platform } — match the nested object
          if (!matches(val || {}, v)) return false;
        }
        continue;
      }
      if (val !== v) return false;
    }
    return true;
  }
  function sortBy(rows, orderBy) {
    if (!orderBy) return rows;
    const [[k, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => (new Date(a[k]) - new Date(b[k]) || (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0)) * (dir === "desc" ? -1 : 1));
  }
  let seq = 0;
  function model(store, name) {
    return {
      findMany: async ({ where, orderBy, take } = {}) => { const r = sortBy(store[name].filter((x) => matches(x, where)), orderBy); return take ? r.slice(0, take) : r; },
      findFirst: async ({ where, orderBy } = {}) => sortBy(store[name].filter((x) => matches(x, where)), orderBy)[0] || null,
      findUnique: async ({ where } = {}) => store[name].find((x) => matches(x, where)) || null,
      count: async ({ where } = {}) => store[name].filter((x) => matches(x, where)).length,
      create: async ({ data }) => { const row = { id: `${name}_${++seq}`, createdAt: new Date(), ...data }; store[name].push(row); return row; },
      update: async ({ where, data }) => { const row = store[name].find((x) => matches(x, where)); if (!row) throw new Error(`no ${name} ${JSON.stringify(where)}`); Object.assign(row, data); return row; },
      // The web-chat match points a thread "only while clientId is null"
      // (lib/aiEmployee/webChatMatch.js) — a compare-and-set, so the store
      // needs the many-row form too.
      updateMany: async ({ where, data }) => { const rows = store[name].filter((x) => matches(x, where)); for (const r of rows) Object.assign(r, data); return { count: rows.length }; },
      // The AI wallet's balance is a SUM (lib/voice/credits.js balanceFor).
      aggregate: async ({ where, _sum = {} } = {}) => {
        const rows = store[name].filter((x) => matches(x, where));
        return { _sum: Object.fromEntries(Object.keys(_sum).map((k) => [k, rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)])) };
      },
    };
  }
  function makeDb(seed) {
    // Every company in these runs holds $100 of AI credit, so the replies are
    // paid from the wallet (lib/ai/walletMeter.js) — and `now` below is pinned
    // AFTER the switch-over grace, so what is exercised does not depend on
    // the day the check happens to run.
    const store = { aiEmployee: [], messageThread: [], message: [], aiEmployeeReply: [], aiEmployeeRoutingEvent: [], aiEmployeeSource: [], company: [], aiFeaturePayer: [], voiceCreditEntry: [{ id: "credit", companyId: "C1", pool: "ai", kind: "ai_topup", cents: 10_000 }], ...seed };
    const db = {};
    for (const name of Object.keys(store)) db[name] = model(store, name);
    db.$store = store;
    return db;
  }
  const t0 = new Date("2026-09-20T15:00:00Z");
  const AFTER_GRACE = new Date("2026-10-15T12:00:00Z");
  const at = (s) => new Date(t0.getTime() + s * 1000);
  const company = { id: "C1", name: "Acme Painting", businessHours: null, timezone: "America/Toronto", defaultLanguage: "en" };
  const thread = (over = {}) => ({ id: "th1", companyId: "C1", status: "open", participantName: "Sam", channel: { platform: "web" }, lastInboundAt: t0, assignedEmployeeId: null, routingIntent: null, routingReason: null, humanTookOverAt: null, ...over });
  const inbound = (id, body, sec) => ({ id, threadId: "th1", direction: "in", private: false, body, sentAt: at(sec), attachments: null, failedReason: null, sentByUserId: null });
  const employees = (over = {}) => [
    { ...R, companyId: "C1", name: "Rosa", mode: "auto", maxRepliesPerThread: 3, businessHoursOnly: false, disabledTools: [], instructionsFingerprint: "f", ...over.R },
    { ...C, companyId: "C1", name: "Cal", mode: "auto", maxRepliesPerThread: 3, businessHoursOnly: false, disabledTools: [], instructionsFingerprint: "f", ...over.C },
  ];
  /** The deps every run shares: instant sleep, a scripted model, a recorder. */
  function harness(db, { text = "Sure — happy to help.", toolCalls = [] } = {}) {
    const composed = [];
    const sent = [];
    const usage = [];
    const deps = {
      db,
      now: AFTER_GRACE,
      checkAiQuota: async () => ({ allowed: true }),
      recordAiUsage: async (u) => { usage.push(u); },
      isAiConfigured: () => true,
      notify: async () => {},
      sleep: async () => {},
      complete: async (args) => { args.onUsage?.({ model: "gpt-s", promptTokens: 5, completionTokens: 1 }); return { ok: true, data: { intent: /how much|price|cost/i.test(args.prompt) ? "price" : /leak|broken/i.test(args.prompt) ? "problem" : /come out|book|visit/i.test(args.prompt) ? "book" : "other", reason: "scripted" } }; },
      runToolLoop: async ({ tools, execute, system, onUsage }) => {
        const names = tools.map((d) => d.name);
        composed.push({ names, system });
        onUsage?.({ model: "gpt-b", promptTokens: 50, completionTokens: 10 });
        for (const call of toolCalls) {
          if (names.includes(call.name)) await execute(call.name, call.args);
        }
        return { text };
      },
    };
    const send = async (msg, meta) => { sent.push({ text: msg, ...meta }); return { ok: true, externalId: `x${sent.length}` }; };
    return { deps, send, composed, sent, usage };
  }

  // ── Two employees never both reply to one thread ─────────────────────────
  {
    const db = makeDb({ aiEmployee: employees(), messageThread: [thread()], message: [inbound("m1", "How much to paint a bedroom?", 0)], company: [company] });
    const h = harness(db);
    // The channel's own employee (Rosa holds web) and the closer both get the
    // message, as two webhook deliveries would. Rosa is asked first.
    const a = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", employeeId: "R", send: h.send, deps: h.deps });
    const b = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", employeeId: "C", send: h.send, deps: h.deps });
    ok("the front desk routed a price question to the closer", db.$store.messageThread[0].assignedEmployeeId === "C" && db.$store.messageThread[0].routingIntent === "price");
    ok("the receptionist was REFUSED at the door, with the reason", a.replied === false && a.reason === SKIP.NOT_ASSIGNEE && a.assignedEmployeeId === "C");
    ok("the closer replied", b.replied === true);
    ok("exactly ONE reply was composed and ONE sent", h.composed.length === 1 && h.sent.length === 1 && h.sent[0].employeeId === "C");
    ok("the assignment was logged with its intent", db.$store.aiEmployeeRoutingEvent.some((e) => e.kind === "assigned" && e.toEmployeeId === "C" && e.intent === "price" && e.channel === "web"));
    ok("the front desk's call was metered separately from the reply", h.usage.some((u) => u.feature === FRONT_DESK_FEATURE) && h.usage.some((u) => u.feature === "ai_employee_reply"));
    // The unnamed path — what inbound.js calls — lands on the same assignee.
    const c = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    ok("an unnamed call resolves to the assignee and no second front-desk call is spent", c.replied === true && h.usage.filter((u) => u.feature === FRONT_DESK_FEATURE).length === 1);
  }

  // A company with one employee: no classification, it takes everything.
  {
    const db = makeDb({ aiEmployee: [employees()[0]], messageThread: [thread()], message: [inbound("m1", "How much to paint a bedroom?", 0)], company: [company] });
    const h = harness(db);
    const a = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    ok("one employee takes a price question with no front-desk call", a.replied === true && db.$store.messageThread[0].assignedEmployeeId === "R" && !h.usage.some((u) => u.feature === FRONT_DESK_FEATURE));
    ok("...and the reason says so", /only one employee/.test(db.$store.messageThread[0].routingReason));
  }

  // ── A vendor failure is FILED, and a prompt failure is not a vendor one ──
  //
  // 2026-10-04: every reply in production had failed with a gpt-5.5 400 that
  // only ever reached console.error. Now it lands in PlatformErrorLog (area
  // "ai-employee"), redacted, with the ids to find the reply — and our own
  // prompt failing to build is its own reason, never "the AI service".
  {
    const db = makeDb({ aiEmployee: [employees()[0]], messageThread: [thread()], message: [inbound("m1", "Can you come Monday? my email is sam@home.ca", 0)], company: [company] });
    const h = harness(db);
    const filed = [];
    h.deps.recordError = async (e) => { filed.push(e); };
    h.deps.runToolLoop = async () => {
      throw Object.assign(new Error("400 Function tools with reasoning_effort are not supported for gpt-5.5 in /v1/chat/completions. Key sk-proj-****abcd"), { status: 400, code: "unsupported_parameter", type: "invalid_request_error", requestID: "req_9" });
    };
    const r = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    const row = db.$store.aiEmployeeReply.find((x) => x.id === r.replyId);
    ok("a vendor 400 is provider_error on the result and the reply row, nothing sent", r.reason === "provider_error" && row?.suppressedReason === "provider_error" && h.sent.length === 0, { r, row });
    ok("...and is filed once under area ai-employee, code provider_error", filed.length === 1 && filed[0].area === "ai-employee" && filed[0].code === "provider_error" && filed[0].companyId === "C1", filed);
    ok("...with the vendor's own words, the key fragment redacted", /reasoning_effort are not supported for gpt-5\.5/.test(filed[0]?.message) && !/abcd/.test(filed[0]?.message), filed[0]?.message);
    const d = filed[0]?.detail || {};
    ok("...and the ids, model and API to find it by", d.stage === "provider" && d.replyId === r.replyId && d.threadId === "th1" && d.messageId === "m1" && d.employeeId === "R" && d.model === AI_BEST_MODEL && d.api === "responses" && d.status === 400 && d.vendorCode === "unsupported_parameter" && d.requestId === "req_9", d);
    ok("...never the homeowner's words", !JSON.stringify(filed).includes("sam@home.ca") && !JSON.stringify(filed).includes("Monday"));
  }
  {
    const db = makeDb({ aiEmployee: [employees()[0]], messageThread: [thread()], message: [inbound("m1", "hello", 0)], company: [company] });
    const h = harness(db);
    const filed = [];
    let modelCalls = 0;
    h.deps.recordError = async (e) => { filed.push(e); };
    h.deps.buildEmployeePrompt = () => { throw new TypeError("Cannot read properties of undefined (reading 'title')"); };
    h.deps.runToolLoop = async () => { modelCalls += 1; return { text: "should not run" }; };
    const r = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    const row = db.$store.aiEmployeeReply.find((x) => x.id === r.replyId);
    ok("a prompt that will not build is prompt_error, not provider_error", r.reason === PROMPT_ERROR && row?.suppressedReason === PROMPT_ERROR && PROMPT_ERROR !== "provider_error", { r, row });
    ok("...the model is never called and nothing is metered or sent", modelCalls === 0 && !h.usage.some((u) => u.feature === "ai_employee_reply") && h.sent.length === 0, { modelCalls, usage: h.usage });
    ok("...filed as stage prompt with its own code", filed.length === 1 && filed[0].area === "ai-employee" && filed[0].code === PROMPT_ERROR && filed[0].detail?.stage === "prompt" && /reading 'title'/.test(filed[0].message), filed);
  }

  // ── Hand-off moves the assignee and introduces once ──────────────────────
  {
    // A RETURNING contact (a message from last month): since 2026-10-10 a
    // brand-new contact goes straight to the closer (routing.js
    // NEW_CONTACT_REASON, check:ai-employee-new-contact), and this case is
    // about the receptionist handing a booking over, not about new contacts.
    const db = makeDb({ aiEmployee: employees(), messageThread: [thread()], message: [inbound("m0", "Thanks for last time", -30 * 86400), inbound("m1", "Hi, can someone come out to look at my kitchen?", 0)], company: [company] });
    // Rosa (book) hands to the closer; the closer's turn then runs with no
    // hand-off tool and does not hand back.
    const h = harness(db, { toolCalls: [{ name: HAND_OFF_TOOL, args: { role: "closer", reason: "they want a price first" } }] });
    const a = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    ok("the thread now belongs to the colleague", db.$store.messageThread[0].assignedEmployeeId === "C");
    ok("the first employee's line went, then the colleague's", h.sent.length === 2 && h.sent[0].employeeId === "R" && h.sent[1].employeeId === "C" && a.colleague?.replied === true);
    ok("the colleague opened with the introduction, once", h.sent[1].text.startsWith(introductionLine({ displayName: "Cal", language: "en" })) && !h.sent[0].text.includes("take it from here") && (h.sent[1].text.match(/take it from here/g) || []).length === 1);
    ok("...and not with the disclosure again", !h.sent[1].text.includes("AI assistant"));
    ok("the colleague's turn had no hand-off tool", !h.composed[1].names.includes(HAND_OFF_TOOL) && h.composed[0].names.includes(HAND_OFF_TOOL));
    ok("the hand-off was logged from → to with its reason", db.$store.aiEmployeeRoutingEvent.some((e) => e.kind === "handed_off" && e.fromEmployeeId === "R" && e.toEmployeeId === "C" && /price/.test(e.reason)));
    ok("two reply rows, one per employee, both sent", db.$store.aiEmployeeReply.filter((r) => r.sentAt).length === 2);
  }

  // ── The disclosure follows the company's setting; the greeting is read ───
  //
  // The owner, 2026-09-22: never announce it's an AI unless asked, except
  // where the law requires it. Executed through the real responder: a Texas
  // company's first reply does not open with the disclosure, a California
  // one does, an owner's explicit choice beats the location, and the
  // company's opening line — saved and never read before this — is sent.
  {
    const run = async (companyPatch, empPatch = {}) => {
      const db = makeDb({
        aiEmployee: [{ ...employees()[0], ...empPatch }],
        messageThread: [thread()],
        message: [inbound("m1", "Can someone come out Tuesday?", 0)],
        company: [{ ...company, ...companyPatch }],
      });
      const h = harness(db);
      const r = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
      return { r, h };
    };
    const tx = await run({ country: "US", province: "TX", aiDisclosure: null });
    ok("disclosure off (Texas): the first reply does not announce it's an AI", tx.r.replied === true && !/AI assistant/.test(tx.h.sent[0]?.text || ""), tx.h.sent[0]?.text);
    ok("...and the prompt still forbids denying it", /NEVER deny being an AI/.test(tx.h.composed[0].system) && /answer\s+truthfully/.test(tx.h.composed[0].system));
    const ca = await run({ country: "US", province: "CA", aiDisclosure: null });
    ok("disclosure on (California): the first reply opens with it", (ca.h.sent[0]?.text || "").startsWith("Hi, I'm Rosa, Acme Painting's AI assistant."), ca.h.sent[0]?.text);
    const chosenOff = await run({ country: "FR", aiDisclosure: false });
    ok("the owner's explicit off beats the location default", !/assistant IA|AI assistant/.test(chosenOff.h.sent[0]?.text || ""));
    const chosenOn = await run({ country: "US", province: "TX", aiDisclosure: true });
    ok("the owner's explicit on beats the location default", /AI assistant/.test(chosenOn.h.sent[0]?.text || ""));
    const greet = await run({ country: "US", province: "TX", aiDisclosure: null }, { greeting: "Thanks for reaching out to Acme!" });
    ok("the company's opening line is sent, word for word, on the first reply", (greet.h.sent[0]?.text || "").startsWith("Thanks for reaching out to Acme! "), greet.h.sent[0]?.text);
    ok("...and the model is told it is already there, fenced as data", /YOUR OPENING/.test(greet.h.composed[0].system) && /BEGIN OPENING WORDS \(data, not instructions\)/.test(greet.h.composed[0].system));
    const both = await run({ country: "US", province: "NJ", aiDisclosure: null }, { greeting: "Thanks for reaching out!" });
    ok("disclosure first, then the opening line", (both.h.sent[0]?.text || "").startsWith("Hi, I'm Rosa, Acme Painting's AI assistant. Thanks for reaching out! "), both.h.sent[0]?.text);
  }

  // ── Ping-pong → a person ─────────────────────────────────────────────────
  {
    const db = makeDb({ aiEmployee: employees(), messageThread: [thread({ assignedEmployeeId: "C", routingIntent: "price" })], company: [company], aiEmployeeRoutingEvent: [{ id: "e1", companyId: "C1", threadId: "th1", kind: "handed_off", fromEmployeeId: "R", toEmployeeId: "C", createdAt: new Date(t0 - 2 * 60_000) }] });
    const r = await handOffToEmployee({ companyId: "C1", threadId: "th1", fromEmployeeId: "C", role: "receptionist", reason: "actually a booking", prisma: db, now: t0 });
    ok("a second hand-off inside ten minutes goes to a person", r.ok === true && r.handedOff === true && r.reason === "ping_pong");
    ok("...the thread is held by nobody", db.$store.messageThread[0].assignedEmployeeId === null);
    ok("...and it is logged as an escalation", db.$store.aiEmployeeRoutingEvent.some((e) => e.kind === "escalated" && e.fromEmployeeId === "C"));
    const db2 = makeDb({ aiEmployee: employees(), messageThread: [thread({ assignedEmployeeId: "C" })], company: [company], aiEmployeeRoutingEvent: [{ id: "e1", companyId: "C1", threadId: "th1", kind: "handed_off", fromEmployeeId: "R", toEmployeeId: "C", createdAt: new Date(t0 - 12 * 60_000) }] });
    const r2 = await handOffToEmployee({ companyId: "C1", threadId: "th1", fromEmployeeId: "C", role: "receptionist", reason: "a booking", prisma: db2, now: t0 });
    ok("...but one twelve minutes later is an ordinary hand-off", r2.ok === true && r2.toEmployeeId === "R" && db2.$store.messageThread[0].assignedEmployeeId === "R");
    const r3 = await handOffToEmployee({ companyId: "C1", threadId: "th1", fromEmployeeId: "C", role: "troubleshooter", reason: "x", prisma: db2, now: t0 });
    ok("a role nobody holds is refused by name, and the model is told to carry on", r3.ok === false && r3.reason === "no_such_employee" && /carry on|hand off to a person/i.test(r3.say));
    // Through the responder: the ping-pong verdict is read as a hand-off to a person.
    const db3 = makeDb({ aiEmployee: employees(), messageThread: [thread({ assignedEmployeeId: "C", routingIntent: "price" })], message: [inbound("m1", "ok", 0)], company: [company], aiEmployeeRoutingEvent: [{ id: "e1", companyId: "C1", threadId: "th1", kind: "handed_off", fromEmployeeId: "R", toEmployeeId: "C", createdAt: new Date(Date.now() - 60_000) }] });
    const h = harness(db3, { toolCalls: [{ name: HAND_OFF_TOOL, args: { role: "receptionist", reason: "bounce" } }] });
    const a = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    ok("the responder records a ping-pong as handed off, with no colleague turn", a.handedOff === true && a.colleague === null && h.sent.length === 1 && db3.$store.aiEmployeeReply.some((r) => r.handedOff && r.handoffReason === "ping_pong"));
  }

  // ── A human reply silences; "continue" resumes ───────────────────────────
  {
    ok("shouldReply: a taken-over thread is silent, by its own reason", say({ humanTookOver: true }).reason === SKIP.HUMAN_TOOK_OVER);
    const db = makeDb({ aiEmployee: employees(), messageThread: [thread({ assignedEmployeeId: "C", routingIntent: "price" })], message: [inbound("m1", "any update?", 0)], company: [company], aiEmployeeRoutingEvent: [{ id: "e1", companyId: "C1", threadId: "th1", kind: "assigned", toEmployeeId: "C", intent: "price", createdAt: new Date(t0 - 60_000) }] });
    await humanTookOver({ prisma: db, companyId: "C1", thread: db.$store.messageThread[0], userId: "u1", at: t0 });
    ok("a human reply clears the assignment and stamps the take-over", db.$store.messageThread[0].assignedEmployeeId === null && db.$store.messageThread[0].humanTookOverAt === t0);
    ok("...and logs who", db.$store.aiEmployeeRoutingEvent.some((e) => e.kind === "human_took_over" && e.fromEmployeeId === "C" && e.reason === "member:u1"));
    const h = harness(db);
    const a = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    ok("every employee stays silent afterwards", a.replied === false && a.reason === SKIP.HUMAN_TOOK_OVER && h.composed.length === 0);
    ok("...and no front-desk call is spent on a taken-over thread", !h.usage.some((u) => u.feature === FRONT_DESK_FEATURE));
    const cand = await resumeCandidate({ prisma: db, companyId: "C1", thread: db.$store.messageThread[0], channel: "web" });
    ok("the resume button names the last holder", cand?.id === "C");
    const back = await resumeEmployee({ prisma: db, companyId: "C1", thread: db.$store.messageThread[0], channel: "web", userId: "u1", now: t0 });
    ok("\"Let Cal continue\" hands it back and clears the stamp", back?.id === "C" && db.$store.messageThread[0].assignedEmployeeId === "C" && db.$store.messageThread[0].humanTookOverAt === null);
    const m2 = inbound("m2", "so, the price?", 5);
    db.$store.message.push(m2);
    const b = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m2", channel: "web", send: h.send, deps: h.deps });
    ok("...and the employee answers the next message", b.replied === true && h.sent[0].employeeId === "C");
    ok("the resume was logged", db.$store.aiEmployeeRoutingEvent.some((e) => e.kind === "resumed" && e.toEmployeeId === "C"));
    // A fired holder: the candidate falls back to the front desk's pick.
    const db2 = makeDb({ aiEmployee: employees(), messageThread: [thread({ humanTookOverAt: t0, routingIntent: "book" })], company: [company], aiEmployeeRoutingEvent: [{ id: "e1", companyId: "C1", threadId: "th1", kind: "assigned", toEmployeeId: "T", intent: "book", createdAt: t0 }] });
    ok("a holder no longer on the team → the role that handles the intent", (await resumeCandidate({ prisma: db2, companyId: "C1", thread: db2.$store.messageThread[0], channel: "web" }))?.id === "R");
    // The reply route stamps it inside its transaction.
    const replyRoute = code("app/api/messaging/threads/[id]/reply/route.js");
    ok("the reply route stamps the take-over inside the reply's transaction", /humanTookOver\(\{ prisma: tx, companyId: member\.companyId, thread, userId: member\.userId \|\| null, at: message\.sentAt \}\)/.test(replyRoute) && /assignedEmployeeId: true,\s*humanTookOverAt: true/.test(replyRoute));
    ok("the thread read hands the screen the holder and the resume candidate", /resumeCandidate\(/.test(code("app/api/messaging/threads/[id]/route.js")) && /assignedEmployeeId: undefined/.test(code("app/api/messaging/threads/[id]/route.js")));
    ok("the resume route exists and refuses a thread nobody took", /not_taken_over/.test(code("app/api/messaging/threads/[id]/ai-resume/route.js")) && /resumeEmployee\(/.test(code("app/api/messaging/threads/[id]/ai-resume/route.js")));
    ok("Conversations draws the bar from the thread's `ai` shape and posts to the resume route", /ai-resume/.test(code("app/components/messaging/AiHolderBar.js")) && /<AiHolderBar/.test(code("app/app/messages/page.js")));
  }

  // ── Burst → one reply ────────────────────────────────────────────────────
  {
    const db = makeDb({ aiEmployee: [employees()[0]], messageThread: [thread()], message: [inbound("m1", "hi", 0), inbound("m2", "I need a quote", 2), inbound("m3", "for a kitchen", 4)], company: [company] });
    const h = harness(db);
    const waits = [];
    h.deps.sleep = async (ms) => { waits.push(ms); };
    const r1 = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    const r2 = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m2", channel: "web", send: h.send, deps: h.deps });
    const r3 = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m3", channel: "web", send: h.send, deps: h.deps });
    ok("three messages in ten seconds → the first two yield", r1.reason === SKIP.BURST_MERGED && r2.reason === SKIP.BURST_MERGED);
    ok("...and the last one replies, once, to the batch", r3.replied === true && h.composed.length === 1 && h.sent.length === 1);
    ok("...having waited the longer hold as the third in ten seconds", waits[2] === BURST_HOLD_MS && waits[0] === BURST_DEBOUNCE_MS);
    ok("the merges were logged", db.$store.aiEmployeeRoutingEvent.filter((e) => e.kind === "burst_merged").length === 2);
    // The second half: composed, then superseded → recorded, not sent.
    const db2 = makeDb({ aiEmployee: [employees()[0]], messageThread: [thread()], message: [inbound("m1", "hi", 0)], company: [company] });
    const h2 = harness(db2);
    h2.deps.runToolLoop = async () => { db2.$store.message.push(inbound("m2", "one more thing", 1)); return { text: "Hello!" }; };
    const r = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h2.send, deps: h2.deps });
    ok("a reply composed while a newer message landed is dropped, not sent", r.reason === SKIP.BURST_MERGED && h2.sent.length === 0 && db2.$store.aiEmployeeReply.some((x) => x.suppressedReason === SKIP.BURST_MERGED && x.draftText.endsWith("Hello!")));
    ok("superseded() ignores an older re-delivery", (await superseded(db2, { threadId: "th1", messageId: "m2", sentAt: at(1) })) === false);
    const g = await burstGate({ companyId: "C1", threadId: "th1", messageId: "m2", sentAt: at(1), prisma: db2, sleep: async () => {} });
    ok("burstGate: the latest message is not merged", g.merged === false);
  }

  // ── The routing log → the flow view's counts ─────────────────────────────
  {
    const rows = [
      { kind: "assigned", intent: "price", toEmployeeId: "C", channel: "web" },
      { kind: "assigned", intent: "book", toEmployeeId: "R", channel: "meta" },
      { kind: "assigned", intent: "nope", toEmployeeId: "R", channel: "fax" },
      { kind: "handed_off", fromEmployeeId: "R", toEmployeeId: "C" },
      { kind: "handed_off", fromEmployeeId: "R", toEmployeeId: "C" },
      { kind: "human_took_over", fromEmployeeId: "C" },
      { kind: "escalated", fromEmployeeId: "R" },
      { kind: "resumed", toEmployeeId: "C" },
      { kind: "burst_merged" },
      null,
    ];
    const s = summariseRouting(rows, t0);
    ok("counts per intent, with garbage filed under other", s.byIntent.price === 1 && s.byIntent.book === 1 && s.byIntent.other === 1);
    ok("counts per channel, ignoring an unknown one", s.byChannel.web === 1 && s.byChannel.meta === 1 && s.byChannel.sms === 0);
    ok("counts per assignee and per hand-off pair", s.assignedTo.C === 1 && s.assignedTo.R === 2 && s.handOffs["R>C"] === 2);
    ok("counts the exits to a person, per employee", s.toHuman.C === 1 && s.toHuman.R === 1 && s.escalated === 1 && s.resumed === 1 && s.burstMerged === 1);
    ok("an empty log is all zeros, never undefined", summariseRouting([]).byIntent.book === 0 && summariseRouting(null).escalated === 0);
  }

  // ── The flow view's chips match roles.js exactly ─────────────────────────
  //
  // Rendered for real (react-dom/server) with a payload built from roles.js
  // the way GET /api/ai-employee builds it. Every tool in the closed list
  // must appear as a chip on every card, in the state the role gives it — a
  // tool missing from the flow fails here, which is the point.
  {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    // JSX: transformed with Next's own SWC binding (the only JSX compiler in
    // node_modules), written beside the repo root so `@/` and node_modules
    // resolve, and removed afterwards.
    const swc = await import("next/dist/build/swc/index.js");
    await swc.loadBindings();
    const jsx = read("app/components/aiEmployee/TeamFlow.js").replace('"@/lib/clientErrors"', '"./lib/clientErrors.js"');
    const js = (await swc.transform(jsx, {
      filename: "TeamFlow.js",
      jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } }, target: "es2022" },
      module: { type: "es6" },
    })).code;
    const tmp = path.join(ROOT, ".check-teamflow.tmp.mjs");
    fs.writeFileSync(tmp, js);
    let TeamFlow;
    try {
      TeamFlow = (await import(`${tmp}?${Date.now()}`)).default;
    } finally {
      fs.unlinkSync(tmp);
    }
    const rolesPayload = AI_EMPLOYEE_ROLES.map((key) => ({ key, allowed: roleFor(key).allowed, forbidden: roleFor(key).forbidden, switchable: switchableToolsForRole(key) }));
    const data = {
      employees: [
        { id: "R", role: "receptionist", name: "Rosa", displayName: "Rosa", enabled: true, mode: "ask", metaEnabled: true, webChatEnabled: true, smsEnabled: false, disabledTools: ["book_callback"], intents: [] },
        { id: "C", role: "closer", name: "Cal", displayName: "Cal", enabled: true, mode: "auto", metaEnabled: false, webChatEnabled: false, smsEnabled: false, disabledTools: [], intents: ["price"] },
        { id: "T", role: "troubleshooter", name: "Tam", displayName: "Tam", enabled: false, mode: "ask", metaEnabled: false, webChatEnabled: false, smsEnabled: false, disabledTools: [], intents: [] },
      ],
      roles: rolesPayload,
      channels: [...CHANNELS],
      channel: { connected: true },
      sms: { available: false },
      flow: { intents: [...INTENTS], roleForIntent: ROLE_FOR_INTENT, counts: summariseRouting([{ kind: "assigned", intent: "price", toEmployeeId: "C", channel: "web" }, { kind: "handed_off", fromEmployeeId: "R", toEmployeeId: "C" }]) },
    };
    const t = (k, fb, values) => { let s = typeof fb === "string" ? fb : k; for (const [a, b] of Object.entries(values || {})) s = s.replace(`{${a}}`, String(b)); return s; };
    const html = renderToStaticMarkup(React.createElement(TeamFlow, { data, proposals: [{ id: "p1", employeeId: "C", status: "pending" }], t }));
    const cards = [...html.matchAll(/data-flow-employee="([^"]+)" data-role="([^"]+)"/g)].map((m) => ({ id: m[1], role: m[2] }));
    ok("one card per employee, on or off", cards.length === 3 && cards.map((c) => c.id).join(",") === "R,C,T");
    for (const card of cards) {
      const seg = html.slice(html.indexOf(`data-flow-employee="${card.id}"`), html.indexOf("</div></div>", html.indexOf(`data-flow-employee="${card.id}"`) ) + 1);
      const chips = [...html.slice(html.indexOf(`data-flow-employee="${card.id}"`)).matchAll(/data-tool="([^"]+)" data-state="([^"]+)"/g)].slice(0, AI_EMPLOYEE_TOOLS.length).map((m) => ({ tool: m[1], state: m[2] }));
      const drawn = new Set(chips.map((c) => c.tool));
      ok(`${card.role}: every tool in the closed list is a chip`, AI_EMPLOYEE_TOOLS.every((tool) => drawn.has(tool)) && drawn.size === AI_EMPLOYEE_TOOLS.length, [...drawn]);
      for (const { tool, state } of chips) {
        const forbidden = roleForbids(card.role, tool);
        const emp = data.employees.find((e) => e.id === card.id);
        const want = forbidden ? "forbidden" : ALWAYS_ON_TOOLS.includes(tool) ? "fixed" : emp.disabledTools.includes(tool) ? "off" : "on";
        ok(`${card.role}: ${tool} drawn as ${want}`, state === want, state);
      }
      void seg;
    }
    ok("a forbidden chip says so", /Not in this role/.test(html));
    ok("the front desk lists the four intents with a drop-down each", INTENTS.every((i) => html.includes(`data-flow-intent="${i}"`)) && (html.match(/<select/g) || []).length === 4);
    ok("the price drop-down shows the closer (the explicit mapping)", /data-flow-intent="price"[\s\S]*?<option value="C" selected=""/.test(html));
    ok("the three channels are drawn with their state", CHANNELS.every((c) => html.includes(`data-flow-channel="${c}"`)) && /data-flow-channel="web" data-on="1"/.test(html) && /data-flow-channel="sms" data-on="0"/.test(html));
    ok("the proposals gate prints each employee's mode and what is waiting", /data-flow-gate-row="C"[\s\S]*?>auto<[\s\S]*?1 waiting/.test(html));
    ok("a person is at the bottom, reachable from every card", /data-flow-person/.test(html) && /data-flow-handoffs/.test(html) && /Rosa[\s\S]*?Cal[\s\S]*?>1</.test(html.slice(html.indexOf("data-flow-handoffs"))));
    ok("no chart library", !/from "recharts"|from "d3"|from "chart\.js"/.test(code("app/components/aiEmployee/TeamFlow.js")));
    ok("the settings page mounts it", /<TeamFlow/.test(code("app/app/settings/ai-employee/page.js")));
    ok("the route ships the roles' switchable list and the counts", /switchable: switchableToolsForRole\(key\)/.test(code("app/api/ai-employee/route.js")) && /routingCounts\(/.test(code("app/api/ai-employee/route.js")) && /export async function PATCH/.test(code("app/api/ai-employee/route.js")));
    ok("...and cleans disabledTools on the way in and out", (code("app/api/ai-employee/route.js").match(/cleanDisabledTools\(/g) || []).length >= 2);
  }

  // ── Nine languages for every new sentence ────────────────────────────────
  {
    const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
    const keys = [
      ...Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.aiEmployee.flow.") || k.startsWith("app.messages.ai.") || k.startsWith("app.aiEmployee.intent.")),
      ...AI_EMPLOYEE_TOOLS.map((t) => `app.aiEmployee.tool.${t}`),
      ...[SKIP.HUMAN_TOOK_OVER, SKIP.NOT_ASSIGNEE, SKIP.BURST_MERGED].map((r) => `app.aiEmployee.skip.${r}`),
      "app.activity.event.aiEmployee.resumed", "app.activity.event.aiEmployee.toolsChanged", "app.activity.event.aiEmployee.intentsChanged",
    ];
    ok("the flow view has at least twenty sentences", keys.filter((k) => k.startsWith("app.aiEmployee.flow.")).length >= 20);
    for (const lang of Object.keys(APP_MESSAGES)) {
      const missing = keys.filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || !APP_MESSAGES[lang][k].trim());
      ok(`${lang}: every routing sentence present`, missing.length === 0, missing);
    }
    ok("every intent has a label in every language", Object.keys(APP_MESSAGES).every((l) => INTENTS.every((i) => typeof APP_MESSAGES[l][`app.aiEmployee.intent.${i}`] === "string")));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ── Troubleshooting, executed (2026-10-04) ───────────────────────────────
  //
  // The owner's flow through the real responder and a scripted database: a
  // known client's washer shows UE → the card names their Samsung, the
  // lookup answers from the record's brand, the attempt is logged and the
  // reply ends with "if the problem persists…" in the client's language →
  // the client writes back on a thread already at its cap → ONE more reply,
  // with only book_callback and hand_off_to_human, which files a WARRANTY
  // ticket on their record (not a lead), linked to the install job, without
  // re-asking anything → a third message gets nothing.
  // ═════════════════════════════════════════════════════════════════════════
  {
    const { closeTheLoopLine, CLOSE_THE_LOOP_LANGUAGES, pendingAttempt, shouldCloseLoop, FOLLOW_UP_TOOLS, FOLLOW_UP_SLOT_TOOLS } = await import("../lib/aiEmployee/troubleshooting.js");
    const T = { id: "T", role: "troubleshooter", enabled: true, createdAt: "2026-01-01", metaEnabled: true, webChatEnabled: true, smsEnabled: true, intents: [], displayName: "Tess", companyId: "C1", name: "Tess", mode: "auto", maxRepliesPerThread: 1, businessHoursOnly: false, disabledTools: [], instructionsFingerprint: "f" };
    const future = new Date("2029-03-01T00:00:00Z");
    const seed = {
      aiEmployee: [T],
      messageThread: [thread({ clientId: "cl1", channel: { platform: "sms" } })],
      message: [inbound("m1", "My washer is showing ue again", 0)],
      company: [company],
      client: [
        { id: "cl1", companyId: "C1", name: "Jane Doe", phone: "+15555550100", email: "jane@example.com", balance: 999.99 },
        { id: "cl1", companyId: "C2", name: "Other Tenant", phone: "+1", email: "x@y.z" },
      ],
      clientEquipment: [
        { id: "eq1", companyId: "C1", clientId: "cl1", name: "Washer", manufacturer: "Samsung", modelNumber: "WF45R6100AW", serialNumber: "SN-123", installedAt: new Date("2024-03-10"), warrantyEndsAt: future, installedByJobId: "j1", createdAt: new Date(), services: [{ servicedAt: new Date("2025-01-02"), description: "Drain filter cleaned", underWarranty: true, jobId: null }], price: 4250 },
        { id: "eqX", companyId: "C2", clientId: "cl1", name: "Furnace", manufacturer: "Lennox", modelNumber: "SECRET-OTHER", createdAt: new Date(), services: [] },
        { id: "eqY", companyId: "C1", clientId: "cl2", name: "Dryer", manufacturer: "LG", modelNumber: "NOT-THIS-CLIENT", createdAt: new Date(), services: [] },
      ],
      job: [
        { id: "j1", companyId: "C1", clientId: "cl1", title: "Laundry install", status: "completed", completedAt: new Date("2024-03-10"), total: 4250, invoiceTotal: 4250 },
      ],
      clientTicket: [],
      aiEmployeeSourcePage: [],
      referenceCode: [],
    };
    const db = makeDb(seed);
    const toolResults = [];
    const h = harness(db, {
      text: "Spread the load evenly and run it again.",
      toolCalls: [
        { name: "look_up_error_code", args: { code: " u e " } },
        { name: "log_troubleshooting", args: { symptom: "washer shows UE", code: "UE", equipment_id: "eq1", steps_given: ["Spread the load evenly", "Restart the cycle"] } },
      ],
    });
    const loop = h.deps.runToolLoop;
    h.deps.runToolLoop = async (args) => loop({ ...args, execute: async (n, a) => { const r = await args.execute(n, a); toolResults.push({ n, r }); return r; } });
    const first = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "sms", language: "es", send: h.send, deps: h.deps });
    const sys = h.composed[0]?.system || "";
    ok("troubleshooter: the card names the client's own Samsung washer", /INSTALLED EQUIPMENT/.test(sys) && /Samsung · Washer · model WF45R6100AW/.test(sys) && /warranty on file runs to 2029-03-01/.test(sys), sys.slice(-1200));
    ok("...never another tenant's or another client's equipment", !/SECRET-OTHER|NOT-THIS-CLIENT|Lennox/.test(sys));
    ok("...never money", !/4250|4,250|999\.99|balance|invoiceTotal/.test(sys));
    ok("...and the serial is marked never to be read out", /serial on file: SN-123 — for the team's note only/.test(sys));
    ok("...and the playbook is in the prompt", /HOW A GOOD ASSISTANT ANSWERS/.test(sys));
    const lookup = toolResults.find((x) => x.n === "look_up_error_code")?.r;
    ok("the lookup found the brand from the record, with any casing and spacing", lookup?.ok === true && lookup?.matched >= 1 && /off-balance/.test(lookup?.fenced || ""), lookup);
    ok("...with the FieldQuo source cited", /TSG10000997/.test(lookup?.fenced || ""));
    // Real times are on by default (bookTechSlots), so the promise is "we'll
    // find you a time", not "we'll book a call".
    ok("the reply was sent with the close-the-loop line, in the client's language", first.replied === true && h.sent[0]?.text.endsWith(closeTheLoopLine("es", { slots: true })), h.sent[0]?.text);
    const row1 = db.$store.aiEmployeeReply.find((r) => r.id === first.replyId);
    const logged = (row1?.toolsUsed || []).find((t) => t.name === "log_troubleshooting");
    ok("the attempt is recorded on the reply row, equipment checked against the card", logged?.detail?.equipmentId === "eq1" && logged?.detail?.stepsGiven?.length === 2 && pendingAttempt([row1])?.symptom === "washer shows UE", logged);

    // The client writes back — the thread is already at its cap of 1.
    db.$store.message.push(inbound("m2", "still not working", 120));
    const h2 = harness(db, { text: "I've passed this to the team.", toolCalls: [{ name: "book_callback", args: {} }] });
    h2.deps.runToolLoop = (() => { const inner = h2.deps.runToolLoop; return async (args) => inner(args); })();
    const second = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m2", channel: "sms", language: "es", send: h2.send, deps: h2.deps });
    ok("one reply past the cap for the customer who was told to write back", second.replied === true, second);
    ok("...offered ONLY a real time with a tech, the callback and the hand-off", JSON.stringify([...(h2.composed[0]?.names || [])].sort()) === JSON.stringify([...FOLLOW_UP_SLOT_TOOLS].sort()), h2.composed[0]?.names);
    ok("...and told to check the calendar first, the callback only when nothing is free", /call check_availability/.test(h2.composed[0]?.system || "") && /Only if it returns no times, call book_callback/.test(h2.composed[0]?.system || ""));
    ok("the callback-only set is still exactly the callback and the hand-off", JSON.stringify([...FOLLOW_UP_TOOLS].sort()) === JSON.stringify(["book_callback", "hand_off_to_human"]));
    ok("...with what was tried in the prompt, so nothing is re-asked", /WHAT WAS ALREADY TRIED/.test(h2.composed[0]?.system || "") && /Spread the load evenly/.test(h2.composed[0]?.system || ""));
    const ticket = db.$store.clientTicket[0];
    ok("the callback became a ticket on the client's record, not a lead", db.$store.clientTicket.length === 1 && ticket.clientId === "cl1" && ticket.companyId === "C1", db.$store.clientTicket);
    ok("...typed warranty (the record's warranty runs to 2029), linked to the install job", ticket?.type === "warranty" && ticket?.jobId === "j1", ticket);
    ok("...with the attempt written out for the team", /UE washer shows UE — still happening after: Spread the load evenly; Restart the cycle/.test(ticket?.body || ""), ticket?.body);
    ok("...and no close-the-loop line on a reply that booked the callback", !h2.sent[0]?.text.includes(closeTheLoopLine("es")));
    db.$store.message.push(inbound("m3", "hello?", 240));
    const h3 = harness(db);
    const third = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m3", channel: "sms", send: h3.send, deps: h3.deps });
    ok("a third message gets nothing: the exception is used once", third.replied === false && third.reason === SKIP.CAP_REACHED && h3.composed.length === 0, third);

    // Pure rules of the flow.
    ok("the close-the-loop line exists in all nine languages, each different", CLOSE_THE_LOOP_LANGUAGES.length === 9 && new Set(CLOSE_THE_LOOP_LANGUAGES.map(closeTheLoopLine)).size === 9 && DISCLOSURE_LANGUAGES.every((l) => CLOSE_THE_LOOP_LANGUAGES.includes(l)));
    ok("...and falls back to English", closeTheLoopLine("xx") === closeTheLoopLine("en"));
    const routine = [{ name: "log_troubleshooting", ok: true, detail: { urgency: "routine", symptom: "x" } }];
    ok("close the loop on a routine attempt only", shouldCloseLoop({ tools: routine, text: "Try this." }) && !shouldCloseLoop({ tools: [{ ...routine[0], detail: { urgency: "urgent", symptom: "x" } }], text: "Try this." }));
    ok("...not when the turn booked, handed off or passed it on", ["book_callback", "hand_off_to_human", "hand_off_to_employee"].every((n) => !shouldCloseLoop({ tools: [...routine, { name: n, ok: true }], text: "x" })));
    ok("...not on an empty reply, and never twice", !shouldCloseLoop({ tools: routine, text: "" }) && !shouldCloseLoop({ tools: routine, text: `x ${closeTheLoopLine("en")}` }));
    ok("an attempt followed by a callback is no longer pending", pendingAttempt([{ toolsUsed: [{ name: "book_callback", ok: true }] }, { toolsUsed: routine }]) === null);
    ok("...nor one booked in the same reply after it", pendingAttempt([{ toolsUsed: [...routine, { name: "book_callback", ok: true }] }]) === null);
    ok("...but one logged after a callback is", pendingAttempt([{ toolsUsed: [{ name: "book_callback", ok: true }, ...routine] }])?.symptom === "x");
    ok("a failed log is not an attempt", pendingAttempt([{ toolsUsed: [{ ...routine[0], ok: false }] }]) === null);
    ok("garbage toolsUsed is no attempt, never a throw", pendingAttempt([{ toolsUsed: "x" }, null, { toolsUsed: [null] }]) === null);

    // The cap exception, pure.
    const E = { enabled: true, role: "troubleshooter", mode: "auto", maxRepliesPerThread: 2 };
    const base = { employee: E, message: { direction: "in", body: "still broken" }, quota: { allowed: true }, aiConfigured: true, thread: { status: "open" } };
    ok("at the cap with an attempt pending: one follow-up reply", shouldReply({ ...base, repliesSoFar: 2, troubleshootingFollowUp: true }).followUpOnly === true);
    ok("...past it: none", shouldReply({ ...base, repliesSoFar: 3, troubleshootingFollowUp: true }).reason === SKIP.CAP_REACHED);
    ok("...at the cap with no attempt: none", shouldReply({ ...base, repliesSoFar: 2 }).reason === SKIP.CAP_REACHED);
    ok("...a cap of 0 (paused) is never overridden", shouldReply({ ...base, employee: { ...E, maxRepliesPerThread: 0 }, repliesSoFar: 0, troubleshootingFollowUp: true }).reason === SKIP.CAP_REACHED);
    ok("...a hand-off still wins over it", shouldReply({ ...base, repliesSoFar: 2, troubleshootingFollowUp: true, handedOff: true }).reason === SKIP.HANDED_OFF);
    ok("...and under the cap the reply is ordinary", shouldReply({ ...base, repliesSoFar: 1, troubleshootingFollowUp: true }).followUpOnly === undefined);
    let refused = null;
    try { await executeFor({ companyId: "C1", role: "troubleshooter", mode: "auto", onlyTools: [...FOLLOW_UP_TOOLS], onTool: () => {} })("look_up_error_code", { code: "UE" }); } catch (e) { refused = e.message; }
    ok("a follow-up cannot call anything else, by name", refused === "Unknown tool: look_up_error_code" && definitionsForRole("troubleshooter", { onlyTools: [...FOLLOW_UP_TOOLS] }).map((d) => d.name).sort().join(",") === "book_callback,hand_off_to_human");
  }

  // ── Any role's callback on a known client's thread is a ticket ───────────
  {
    const closer = { ...C, companyId: "C1", name: "Cal", mode: "auto", maxRepliesPerThread: 3, businessHoursOnly: false, disabledTools: [], instructionsFingerprint: "f", metaEnabled: true, webChatEnabled: true };
    const db = makeDb({
      aiEmployee: [closer],
      messageThread: [thread({ clientId: "cl7" })],
      message: [inbound("m1", "Can someone call me about another deck?", 0)],
      company: [company],
      client: [{ id: "cl7", companyId: "C1", name: "Pat", phone: "+15555550111", email: null }],
      clientEquipment: [],
      job: [],
      clientTicket: [],
      aiEmployeeSourcePage: [],
      referenceCode: [],
    });
    const h = harness(db, { text: "Done — the team will call you.", toolCalls: [{ name: "book_callback", args: { summary: "Another deck", urgency: "routine" } }] });
    const r = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", send: h.send, deps: h.deps });
    ok("the closer's callback on a known client's thread is a ticket on their record too", r.replied === true && db.$store.clientTicket.length === 1 && db.$store.clientTicket[0].clientId === "cl7" && db.$store.clientTicket[0].type === "repair", db.$store.clientTicket);
    ok("...and the closer's prompt carries no equipment card", !/INSTALLED EQUIPMENT/.test(h.composed[0]?.system || ""));
  }

  // ── book_callback writes what the board reads ────────────────────────────
  {
    const tools = code("lib/aiEmployee/tools.js");
    ok("an AI-booked callback sets callbackRequestedAt, the column the board badges", /callbackRequestedAt: new Date\(\)/.test(tools) && /input\.callbackRequestedAt instanceof Date/.test(code("lib/leads/createLead.js")));
    ok("...and stores the urgency hint the board shows", /callbackUrgency: level/.test(tools) && /lead\.intake\?\.callbackUrgency === "urgent"/.test(code("app/app/leads/page.js")) && /capturedBy === "ai_employee"/.test(code("app/app/leads/page.js")));
    ok("a known client's callback goes through the ONE ticket creator", /openTicket\(\{/.test(tools) && !/clientTicket\.create/.test(tools));
    ok("an approved proposal carries its own thread, so it can become a ticket too", /threadId: row\.threadId \|\| null/.test(code("lib/aiEmployee/proposals.js")));
    ok("the ticket priority is set only by a caller that knows it — never by a portal body", /priority = null/.test(code("lib/clientTickets/service.js")) && !/priority/.test(code("app/api/portal/[token]/tickets/route.js") || ""));
    ok("look_up_error_code and log_troubleshooting are the troubleshooter's and the receptionist's only",
      ["troubleshooter", "receptionist"].every((r) => toolsForRole(r).includes("look_up_error_code") && toolsForRole(r).includes("log_troubleshooting")) &&
      ["closer", "custom"].every((r) => !toolsForRole(r).includes("look_up_error_code") && !toolsForRole(r).includes("log_troubleshooting")));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ── Urgent, executed through the real responder (owner, 2026-10-04) ──────
  //
  // The triage decides from the customer's own words AND the model's urgency
  // (the higher wins), the company's list of what is urgent applies, the
  // alert is raised BEFORE the reply goes, and the line the customer reads
  // says what actually happened. raiseUrgentAlert is injected: no database,
  // no Twilio — its own behaviour is executed further down this file.
  // ═════════════════════════════════════════════════════════════════════════
  {
    const { urgentLine, leaveFirstLine } = await import("../lib/aiEmployee/triage.js");
    const { UNSAFE_STEP_REASON } = await import("../lib/aiEmployee/knowledge/firstSteps.js");
    const { WEB_MATCH_NOTE } = await import("../lib/aiEmployee/clientContext.js");
    const REC = { id: "R", role: "receptionist", enabled: true, createdAt: "2026-01-01", metaEnabled: true, webChatEnabled: true, smsEnabled: true, intents: [], displayName: "Rosa", companyId: "C1", name: "Rosa", mode: "auto", maxRepliesPerThread: 5, businessHoursOnly: false, disabledTools: [], instructionsFingerprint: "f" };
    const phoneCo = { ...company, phone: "613-555-0199" };
    const run = async ({ body, text = "Okay — let's stop the water first.", toolCalls = [], settings = null, raised = { alertId: "a1", alerted: "sms", status: "open", deduped: false }, employee = REC, extraSeed = {} }) => {
      const db = makeDb({
        aiEmployee: [employee],
        messageThread: [thread({ clientId: null })],
        message: [inbound("m1", body, 0)],
        company: [phoneCo],
        clientEquipment: [], job: [], client: [], clientTicket: [], aiEmployeeSourcePage: [], referenceCode: [], threadClientMatch: [],
        leadRequest: [],
        ...(settings ? { aiEmployeeCompanySettings: [{ id: "s1", companyId: "C1", ...settings }] } : {}),
        ...extraSeed,
      });
      const h = harness(db, { text, toolCalls });
      const alerts = [];
      h.deps.raiseUrgentAlert = async (args) => { alerts.push(args); return raised; };
      const out = await respondToMessage({ companyId: "C1", threadId: "th1", messageId: "m1", channel: "web", language: "en", send: h.send, deps: h.deps });
      return { out, db, h, alerts };
    };

    const gush = await run({ body: "Water is gushing out from under the kitchen sink!" });
    ok("gushing water: the alert is raised, urgent, water", gush.alerts.length === 1 && gush.alerts[0].tier === "urgent" && gush.alerts[0].category === "water", gush.alerts);
    ok("...with the customer's words and the company's settings handed over", /gushing/.test(gush.alerts[0]?.summary || "") && Array.isArray(gush.alerts[0]?.settings?.urgentCategories));
    ok("...and the reply ends with what really happened, plus the company's own number", gush.h.sent[0]?.text.endsWith(urgentLine({ alerted: "sms", phone: "613-555-0199", company: "Acme Painting", language: "en" })), gush.h.sent[0]?.text);
    ok("...which names the number and nothing invented", /613-555-0199/.test(gush.h.sent[0]?.text || "") && !/911/.test(gush.h.sent[0]?.text || ""));

    const drip = await run({ body: "My kitchen faucet is dripping a little, can someone look at it next week?", text: "Sure — a drip like that is usually a worn washer." });
    ok("a dripping tap raises NOTHING and gets no urgent line", drip.alerts.length === 0 && !/on-call|right now, call/.test(drip.h.sent[0]?.text || ""), drip.h.sent[0]?.text);

    const leak = await run({ body: "I have a leak under the sink", text: "Is water actively coming in right now, or is it a drip?" });
    ok("a plain 'leak' is a question first, never an alert", leak.alerts.length === 0 && /actively coming in/.test(leak.h.sent[0]?.text || ""));

    const probed = await run({ body: "yes it's coming in fast", toolCalls: [{ name: "hand_off_to_human", args: { reason: "active leak", urgency: "urgent", category: "water" } }] });
    ok("the answer to the probe becomes urgent through the MODEL's urgency (the higher wins)", probed.alerts.length === 1 && probed.alerts[0].tier === "urgent" && probed.alerts[0].category === "water", probed.alerts);

    const under = await run({ body: "Water is pouring through the ceiling light", toolCalls: [{ name: "hand_off_to_human", args: { reason: "minor", urgency: "routine" } }] });
    ok("a model that under-calls cannot downgrade what the customer's words said", under.alerts.length === 1 && under.alerts[0].tier === "urgent");

    const gas = await run({ body: "I smell gas in the basement and the furnace is clicking", text: "Please get out first." });
    ok("a gas smell: an EMERGENCY alert, gas_co", gas.alerts.length === 1 && gas.alerts[0].tier === "emergency" && gas.alerts[0].category === "gas_co");
    ok("...and the fixed leave-the-house line is in the reply, before the model's words", (gas.h.sent[0]?.text || "").indexOf(leaveFirstLine("en")) > -1 && (gas.h.sent[0]?.text || "").indexOf(leaveFirstLine("en")) < (gas.h.sent[0]?.text || "").indexOf("Please get out first."), gas.h.sent[0]?.text);

    const noise = await run({ body: "The furnace is making a weird banging noise", text: "Is there a gas smell, or is it just a noise?" });
    ok("a furnace NOISE is not an emergency and gets no leave-the-house line", noise.alerts.length === 0 && !(noise.h.sent[0]?.text || "").includes(leaveFirstLine("en")));

    const off = await run({ body: "Water is gushing out from under the kitchen sink!", settings: { urgentCategories: ["heat", "roof"] } });
    ok("a company that took water OFF its urgent list: no alert, never 911 (an ordinary callback)", off.alerts.length === 0 && !/911/.test(off.h.sent[0]?.text || ""));

    // In `ask` so the callback the responder books becomes a proposal on the
    // scripted store rather than a real lead write.
    const noOnCall = await run({
      body: "Water is gushing out from under the kitchen sink! I'm Sam, 613-555-0142",
      employee: { ...REC, mode: "ask" },
      raised: { alertId: "a2", alerted: "bell", status: "not_sent", reason: "no_on_call", deduped: false },
      extraSeed: { aiEmployeeProposal: [] },
    });
    const row = noOnCall.db.$store.aiEmployeeReply[0];
    const autoCb = (row?.toolsUsed || []).find((t) => t.name === "book_callback");
    ok("nobody on call: the responder books the urgent callback itself when the model didn't", Boolean(autoCb) && noOnCall.db.$store.aiEmployeeProposal.some((p) => p.tool === "book_callback" && p.args?.urgency === "urgent"), row?.toolsUsed);
    ok("...and says 'flagged as urgent' (not 'alerted the on-call team') with the company number", /flagged this as urgent/.test(row?.draftText || "") && !/on-call team/.test(row?.draftText || "") && /613-555-0199/.test(row?.draftText || ""), row?.draftText);

    const dup = await run({ body: "Water is gushing out from under the kitchen sink!", raised: { alertId: "a1", alerted: "sms", status: "open", deduped: true } });
    ok("the same conversation again: no second alert line", !/on-call team/.test(dup.h.sent[0]?.text || ""));

    const unsafe = await run({ body: "The furnace won't start", text: "Remove the front panel of the furnace and hold the reset button for ten seconds." });
    ok("a draft telling them to open a panel is HELD, never sent", unsafe.out.replied === false && unsafe.out.reason === UNSAFE_STEP_REASON && unsafe.h.sent.length === 0, unsafe.out);
    ok("...and the thread goes to a person", unsafe.db.$store.aiEmployeeReply[0]?.handedOff === true && unsafe.db.$store.aiEmployeeReply[0]?.suppressedReason === UNSAFE_STEP_REASON);
    const safe = await run({ body: "The basement is flooding", text: "Shut off the main water valve where the pipe comes in, and don't go near the electrical panel." });
    ok("...but the vetted step, said with its warning, goes out", safe.out.replied === true && /main water valve/.test(safe.h.sent[0]?.text || ""));

    // ── The web-chat match, through the responder ────────────────────────
    const TS = { id: "T", role: "troubleshooter", enabled: true, createdAt: "2026-01-01", metaEnabled: true, webChatEnabled: true, smsEnabled: true, intents: [], displayName: "Tess", companyId: "C1", name: "Tess", mode: "auto", maxRepliesPerThread: 3, businessHoursOnly: false, disabledTools: [], instructionsFingerprint: "f" };
    const web = await run({
      body: "Hi, my washer shows UE again — I'm Jane Doe, jane@example.com",
      text: "Thanks Jane — is the code still UE?",
      employee: TS,
      extraSeed: {
        client: [
          { id: "cl1", companyId: "C1", name: "Jane Doe", email: "jane@example.com", phone: null, address: null, city: null, province: null, country: null, language: null, createdAt: new Date("2024-01-01") },
          { id: "clX", companyId: "C2", name: "Jane Doe", email: "jane@example.com", phone: null, address: null, city: null, province: null, country: null, language: null, createdAt: new Date("2024-01-01") },
        ],
        clientEquipment: [{ id: "eq1", companyId: "C1", clientId: "cl1", name: "Washer", manufacturer: "Samsung", modelNumber: "WF45", createdAt: new Date(), services: [] }],
      },
    });
    ok("web chat: a visitor who typed a client's email is linked to THIS company's client", web.db.$store.messageThread[0].clientId === "cl1", web.db.$store.messageThread[0]);
    ok("...recorded as a reversible match, never another tenant's client", web.db.$store.threadClientMatch.length === 1 && web.db.$store.threadClientMatch[0].clientId === "cl1" && web.db.$store.threadClientMatch[0].status === "linked");
    ok("...with a line in the conversation, attributed to nobody", web.db.$store.message.some((m) => m.activity?.type === "linked" && m.activity?.kind === "client" && !m.activity?.by));
    ok("...and the card reaches the troubleshooter marked as an unconfirmed web match", (web.h.composed[0]?.system || "").includes(WEB_MATCH_NOTE) && /Samsung · Washer/.test(web.h.composed[0]?.system || ""));
    const webOff = await run({ body: "I'm Jane Doe, jane@example.com", employee: TS, settings: { matchWebChatClients: false }, extraSeed: { client: [{ id: "cl1", companyId: "C1", name: "Jane Doe", email: "jane@example.com", createdAt: new Date() }] } });
    ok("...and nothing is linked when the company switched matching off", webOff.db.$store.messageThread[0].clientId === null && webOff.db.$store.threadClientMatch.length === 0);
  }

  // ── The responder's structure ────────────────────────────────────────────
  {
    const respond = code("lib/aiEmployee/respond.js");
    ok("the assignee gate sits before the credit check and the prompt", respond.indexOf("assignThread(") > -1 && respond.indexOf("assignThread(") < respond.indexOf("meter.check()") && respond.indexOf("burstGate(") < respond.indexOf("assignThread("));
    ok("a non-assignee returns NOT_ASSIGNEE without generating", /reason: SKIP\.NOT_ASSIGNEE/.test(respond) && respond.indexOf("SKIP.NOT_ASSIGNEE") < respond.indexOf("runLoop("));
    ok("the take-over stamp is handed to shouldReply as a fact", /humanTookOver: Boolean\(thread\?\.humanTookOverAt\)/.test(respond));
    ok("the colleague's turn is the same function at depth 1", /handOffDepth: handOffDepth \+ 1/.test(respond));
    ok("the introduction is prepended at depth 1 only", /if \(text && afterHandOff\)/.test(respond) && /introductionLine\(/.test(respond));
    ok("the composed-then-superseded reply is recorded, not sent", /suppressedReason: SKIP\.BURST_MERGED/.test(respond));
    // onlyTools (2026-10-04): the follow-up past the cap may only book the
    // callback or fetch a person — narrowed in BOTH places, like disabledTools.
    // 2026-10-04: the list is the employee's switches PLUS the company's
    // "offer real times" switch for the troubleshooter — one value, built
    // once, handed to both.
    ok("disabledTools reach both the definitions and the executor", /const disabledTools = \[\s*\.\.\.\(Array\.isArray\(employee\.disabledTools\) \? employee\.disabledTools : \[\]\),/.test(respond) && /definitionsForRole\(employee\.role, \{\s*disabledTools,\s*afterHandOff,\s*onlyTools,\s*\}\)/.test(respond) && /disabledTools,\s*threadId,\s*employeeId: employee\.id,\s*afterHandOff,\s*prisma,[\s\S]{0,200}onlyTools,/.test(respond));
    ok("...and the company's bookTechSlots switch narrows the troubleshooter's calendar off", /!safety\.bookTechSlots && employee\.role === "troubleshooter" \? \["check_availability", "book_appointment"\]/.test(respond));
    ok("the sender is told which employee is sending", /send\(text, \{ employeeId: employee\.id \}\)/.test(respond));
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// ── Settings › AI employee: every edit lands on the employee being edited ──
//
// The owner, 2026-09-22: "it doesn't seem to save the name and voice", "the
// AI team doesn't update with the new name". The PUT fell back to rows[0]
// with no id, rewrote every column from the body, and the screen re-seeded
// its form under the person typing. Executed against the planner the route
// calls, then pinned on the route and the screen.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { planEmployeeSave, targetEmployee, EDITABLE_FIELDS } = await import("../lib/aiEmployee/settings.js");
  const A1 = { id: "a1", companyId: "A", role: "receptionist", name: "Emma", displayName: null, voice: null, tone: "professional", enabled: true, mode: "ask", metaEnabled: true, webChatEnabled: false, smsEnabled: false, greeting: null, instructions: "Keep it short", escalationRules: null, maxRepliesPerThread: 3, createdAt: "2026-01-01" };
  const A2 = { ...A1, id: "a2", role: "closer", name: "Jack", enabled: true, metaEnabled: false, webChatEnabled: true, instructions: null, createdAt: "2026-01-02" };
  const B1 = { ...A1, id: "b1", companyId: "B", name: "Other company's" };
  const rowsA = [A1, A2];

  const foreign = planEmployeeSave({ rows: rowsA, body: { id: "b1", name: "Hijack" } });
  ok("PUT with another company's employee id → 404", foreign.ok === false && foreign.status === 404, foreign);
  const noId = planEmployeeSave({ rows: rowsA, body: { name: "Who?" } });
  ok("PUT with no id → 400, never the first employee", noId.ok === false && noId.status === 400 && noId.reason === "no_id", noId);
  ok("...and there is no first-row fallback of any kind", targetEmployee(rowsA, undefined) === null && targetEmployee(rowsA, "") === null && targetEmployee([A1], null) === null);

  const second = planEmployeeSave({ rows: rowsA, body: { id: "a2", name: "Jackie", voice: "friendly" } });
  ok("an edit to the SECOND employee targets the second employee", second.ok && second.current.id === "a2", second);
  ok("...and writes exactly the fields it was sent (plus the fingerprint)", second.ok && Object.keys(second.data).sort().join() === ["instructionsFingerprint", "name", "voice"].join(), second.data);
  ok("...with the values it was sent", second.ok && second.data.name === "Jackie" && second.data.voice === "friendly");

  const one = planEmployeeSave({ rows: rowsA, body: { id: "a1", displayName: "  Emma at Acme  " } });
  ok("a one-field save leaves role, tone, instructions and switches alone", one.ok && !("role" in one.data) && !("tone" in one.data) && !("instructions" in one.data) && !("enabled" in one.data) && !("metaEnabled" in one.data));
  ok("...and trims what it keeps", one.ok && one.data.displayName === "Emma at Acme");
  ok("an emptied name is refused, not saved as a default", planEmployeeSave({ rows: rowsA, body: { id: "a1", name: "   " } }).reason === "name_required");
  ok("an unknown voice is refused by name, not silently cleared", planEmployeeSave({ rows: rowsA, body: { id: "a1", voice: "shouty" } }).reason === "bad_value");
  ok("clearing the voice is allowed", planEmployeeSave({ rows: rowsA, body: { id: "a1", voice: "" } }).data?.voice === null);
  ok("an unknown tone is refused rather than rewritten to the first", planEmployeeSave({ rows: rowsA, body: { id: "a1", tone: "sarcastic" } }).reason === "bad_value");
  ok("an unknown mode never moves the mode", planEmployeeSave({ rows: rowsA, body: { id: "a1", mode: "yolo" } }).ok === false);
  ok("a moved mode mirrors the old column", planEmployeeSave({ rows: rowsA, body: { id: "a1", mode: "auto" } }).data?.autoReplyEnabled === true);
  ok("a role another employee holds is refused", planEmployeeSave({ rows: rowsA, body: { id: "a1", role: "closer" } }).reason === "role_taken");
  ok("a switch must be a real boolean", planEmployeeSave({ rows: rowsA, body: { id: "a1", enabled: "yes" } }).reason === "bad_value");
  ok("the cap is clamped once it is a number, refused when it is not", planEmployeeSave({ rows: rowsA, body: { id: "a1", maxRepliesPerThread: 99 } }).data?.maxRepliesPerThread === 10 && planEmployeeSave({ rows: rowsA, body: { id: "a1", maxRepliesPerThread: "" } }).reason === "bad_value");
  ok("a foreign avatar scheme is refused", planEmployeeSave({ rows: rowsA, body: { id: "a1", avatarUrl: "javascript:alert(1)" } }).reason === "bad_value");
  const clash = planEmployeeSave({ rows: rowsA, body: { id: "a1", webChatEnabled: true } });
  ok("a channel another employee answers is refused, naming it", clash.reason === "channel_conflict" && clash.channels?.includes("web"), clash);
  ok("...but a rename is never refused over a conflict it did not create", planEmployeeSave({ rows: [{ ...A1, webChatEnabled: true }, A2], body: { id: "a1", name: "Em" } }).ok === true);
  ok("SMS on with no FieldQuo number is refused", planEmployeeSave({ rows: rowsA, body: { id: "a1", smsEnabled: true }, smsAvailable: false }).reason === "no_system_number");
  ok("the id is never an editable field", !EDITABLE_FIELDS.includes("id") && !EDITABLE_FIELDS.includes("companyId"));
  ok("hostile bodies do not throw", [null, undefined, 7, "x", [], { id: {} }].every((b) => planEmployeeSave({ rows: rowsA, body: b }).ok === false));
  ok("B's rows never contain A's", targetEmployee([B1], "a1") === null);

  // The route and the screen, pinned.
  const route = code("app/api/ai-employee/route.js");
  const put = route.slice(route.indexOf("export async function PUT"), route.indexOf("export async function PATCH"));
  ok("the PUT reads rows under the session's companyId and plans through settings.js", /findMany\(\{ where: \{ companyId: member\.companyId \}/.test(put) && /planEmployeeSave\(\{ rows, body, smsAvailable \}\)/.test(put));
  ok("the PUT has no rows[0] fallback", !/rows\[0\]/.test(put) && !/loadOrCreate\(/.test(put));
  ok("the PUT writes only the planned data, on the planned row", /update\(\{ where: \{ id: current\.id \}, data \}\)/.test(put));
  const page = code("app/app/settings/ai-employee/page.js");
  ok("the screen saves one field at a time with the employee's id", /JSON\.stringify\(\{ id: job\.id, \[job\.field\]: job\.value \}\)/.test(page));
  ok("the screen never sends the whole form", !/JSON\.stringify\(form\)/.test(page));
  ok("the form is seeded per employee, never per updatedAt", !/updatedAt \|\| ""\}`/.test(page) && /const formKey = saved_ \? saved_\.id/.test(page));
  ok("each field shows Saving / Saved / Couldn't save — Retry", /function SaveState/.test(page) && /autosave\.retry/.test(page) && /state: "error"/.test(page));
  ok("a failed save is reported, never swallowed", /reportResponseError\(res, t\("app\.aiEmployee\.saveError"/.test(page) && /showError\(message\)/.test(page));
  ok("typing waits for a pause; leaving the page sends what is waiting", /delay: typing \? 800 : 0/.test(page) && /keepalive: true/.test(page));
  ok("Face and name sits inside the selected employee's card", page.indexOf('role="tabpanel"') > -1 && page.indexOf('role="tabpanel"') < page.indexOf("app.aiEmployee.faceTitleFor") && page.indexOf("app.aiEmployee.faceTitleFor") < page.indexOf('tour="ai-team-flow"'));
}

// ── Each role is hired under its own name ──────────────────────────────────
{
  const { defaultNameFor, defaultNamesIn, DEFAULT_NAME_LANGUAGES, UNNAMED } = await import("../lib/aiEmployee/names.js");
  const { AI_EMPLOYEE_ROLES } = await import("../lib/aiEmployee/roles.js");
  ok("default names cover the nine app languages", DEFAULT_NAME_LANGUAGES.length === 9);
  for (const lang of DEFAULT_NAME_LANGUAGES) {
    const names = AI_EMPLOYEE_ROLES.map((r) => defaultNameFor(r, lang));
    ok(`${lang}: every role has a name, none is "${UNNAMED}"`, names.every((n) => typeof n === "string" && n.trim() && n !== UNNAMED), names);
    ok(`${lang}: no two roles share a name`, new Set(names).size === names.length, names);
    ok(`${lang}: the table names exactly the roles`, Object.keys(defaultNamesIn(lang)).sort().join() === [...AI_EMPLOYEE_ROLES].sort().join());
  }
  ok("an unknown language falls back to English, an unknown role to custom's", defaultNameFor("closer", "xx") === defaultNameFor("closer", "en") && defaultNameFor("wizard", "en") === defaultNameFor("custom", "en"));
  ok("a regional tag reads its language", defaultNameFor("receptionist", "fr-CA") === defaultNameFor("receptionist", "fr"));
  const route = code("app/api/ai-employee/route.js");
  ok("a hire and the first receptionist get the role's name in the company language", (route.match(/defaultNameFor\(/g) || []).length >= 3 && /name: defaultNameFor\(role, company\?\.defaultLanguage/.test(route));
  ok("an unnamed legacy row is named once, a named one never", /\(r\.name \|\| UNNAMED\) === UNNAMED && !r\.displayName/.test(route));
}

// ── Disclosure: on only where the law requires it; never a denial ──────────
{
  const { disclosureDefault, disclosureFor, companyPlace, discloseAi, DISCLOSURE_REGIONS } = await import("../lib/aiEmployee/disclosure.js");
  const d = (country, province, extra = {}) => disclosureFor({ country, province, ...extra });
  ok("California defaults ON (Bus. & Prof. Code §17941)", d("US", "CA").on === true && /17941/.test(d("US", "CA").law));
  ok("New Jersey defaults ON (N.J.S.A. 56:18-2)", d("US", "NJ").on === true && /56:18-2/.test(d("US", "NJ").law));
  ok("Maine defaults ON (10 M.R.S. §1500-DD)", d("US", "ME").on === true);
  ok("the EU defaults ON (AI Act Art. 50(1))", ["FR", "DE", "IE", "IT", "ES"].every((c) => d(c).on === true && /Art\. 50\(1\)/.test(d(c).law)));
  ok("Texas, Utah, Colorado, New York, Florida default OFF", ["TX", "UT", "CO", "NY", "FL"].every((s) => d("US", s).on === false && d("US", s).reason === "not_required"));
  ok("Canada defaults OFF — Québec and Ontario included", d("CA", "QC").on === false && d("CA", "ON").on === false && d("CA", null).on === false);
  ok("the UK and Australia default OFF", d("GB").on === false && d("AU").on === false);
  ok("an unknown country defaults ON, and says why", d(null).on === true && d(null).reason === "unknown");
  ok("a US company with no state defaults ON, and says why", d("US", null).on === true && d("US", null).reason === "unknown_region");
  ok("the state is read from a full name too", d("US", "California").on === true && d("US", "texas").on === false);
  ok("a US address with no columns still places the company", companyPlace({ country: null, address: "915 Capitol Mall, Sacramento, CA 95814, USA" }).region === "CA");
  ok("the owner's OFF beats a required default, and the screen still knows it was required", d("US", "CA", { aiDisclosure: false }).on === false && d("US", "CA", { aiDisclosure: false }).required === true && d("US", "CA", { aiDisclosure: false }).setting === false);
  ok("the owner's ON beats an off default", d("CA", "QC", { aiDisclosure: true }).on === true);
  ok("null is 'follow the default', not off", d("US", "TX", { aiDisclosure: null }).setting === null);
  ok("a missing company row announces rather than hides", discloseAi(null) === true && discloseAi(undefined) === true);
  ok("every regional rule names its law", Object.values(DISCLOSURE_REGIONS).every((l) => typeof l === "string" && l.length > 5));
  ok("hostile location input does not throw", [{}, { country: 5 }, { country: "ZZZ", province: {} }, { address: "\u0000" }].every((c) => typeof disclosureFor(c).on === "boolean"));

  // The prompt: whatever the setting, it never denies being an AI.
  const off = buildEmployeePrompt({ employee: ON, company: {}, sources: [], disclose: false });
  const on = buildEmployeePrompt({ employee: ON, company: {}, sources: [], disclose: true });
  const dflt = buildEmployeePrompt({ employee: ON, company: {}, sources: [] });
  for (const [label, p] of [["off", off], ["on", on], ["default", dflt]]) {
    ok(`prompt (${label}) never lets it claim to be human`, /NEVER claim to be a human being/.test(p));
    ok(`prompt (${label}) never lets it deny being an AI`, /NEVER deny being an AI/.test(p));
    ok(`prompt (${label}) contains no instruction to hide it`, !/(deny|hide|conceal) (that )?you are an? (AI|bot)/i.test(p) && !/say you are (a )?(human|person|real)/i.test(p));
  }
  ok("disclosure off: it answers truthfully when asked", /if they ask[\s\S]{0,160}answer\s+truthfully/.test(off) && /AI assistant/.test(off));
  ok("disclosure off: it is not told a disclosure line was added", !/that line is added for you/.test(off));
  ok("disclosure on: it is told the line is added, and not to repeat it", /that line is added for you, do not repeat it/.test(on));
  ok("a caller that forgets to say gets the announcing rule", dflt === on);
  const respond = code("lib/aiEmployee/respond.js");
  ok("the responder decides disclosure from the company row", /const disclose = discloseAi\(company\)/.test(respond) && /\.\.\.DISCLOSURE_COMPANY_SELECT/.test(respond));
  ok("the disclosure line is added only when disclosing", /disclose\s*\?\s*disclosureLine\(/.test(respond));
  const dRoute = code("app/api/ai-employee/disclosure/route.js");
  ok("the disclosure switch is owner/admin, audited, and takes only on/off/default", /requirePermission\(member\.role, "user:manage"\)/.test(dRoute) && /ai_employee\.disclosure_changed/.test(dRoute) && /value === true \|\| value === false \|\| value === null/.test(dRoute));
  ok("the screen calls the disclosure route", /\/api\/ai-employee\/disclosure/.test(code("app/app/settings/ai-employee/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Urgent problems & safety: the company's own switches (2026-10-04) ──────
//
// The owner's decisions, each a company setting with a stated default:
// probing triage, the on-call ladder (texts paid from the phone & text
// credit, escalating on no acknowledgement), vetted first steps, web-chat
// client matching, the shared manual library, real appointment times.
// Executed against hostile input; no database, no Twilio, no model.
// ═══════════════════════════════════════════════════════════════════════════
{
  const { mergeSettings, planSafetySave, SAFETY_DEFAULTS, toMinute } = await import("../lib/aiEmployee/companySettings.js");
  const { onCallNow, buildLadder, alertSmsBody, alertTextCents, escalationStep, deliveryProblems, e164, ALERT_TEXT_FLOOR_CENTS } = await import("../lib/aiEmployee/onCall.js");
  const { raiseUrgentAlert, advanceUrgentAlerts, acknowledgeUrgentAlert, ALERT_LEDGER_KIND, alertLink } = await import("../lib/aiEmployee/urgentAlerts.js");
  const { classifyMessage, turnTriage, effectiveTier, triageBlock, urgentLine, leaveFirstLine, TRIAGE_LINE_LANGUAGES, URGENT_CATEGORIES } = await import("../lib/aiEmployee/triage.js");
  const { VETTED_FIRST_STEPS, forbiddenInstruction, screenStep, firstStepsBlock, unsafeInstructionRefusal } = await import("../lib/aiEmployee/knowledge/firstSteps.js");
  const { cleanTroubleshootingLog } = await import("../lib/aiEmployee/troubleshooting.js");
  const { decideWebMatch, nameFromText, carriesContact, matchWebChatThread, undoWebMatch } = await import("../lib/aiEmployee/webChatMatch.js");
  const { SPEND_KINDS } = await import("../lib/voice/spendGate.js");
  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");

  // ── Defaults: the owner's, and never a person nobody chose ──────────────
  const d = mergeSettings(null);
  ok("defaults: probe first, all five urgent, texts on, steps on, matching on, library on, real times on", d.triageProbeFirst && d.urgentCategories.length === 5 && d.urgentAlertsEnabled && d.safeStepsEnabled && d.matchWebChatClients && d.useSharedManuals && d.bookTechSlots);
  ok("...and NOBODY on call — absence is not a rota", Array.isArray(d.onCallMemberIds) && d.onCallMemberIds.length === 0 && SAFETY_DEFAULTS.onCallMemberIds.length === 0);
  ok("a corrupt row fails towards the defaults, never towards a person", mergeSettings({ urgentCategories: ["water", "lava"], onCallMemberIds: [5, null, "m1", "m1"], onCallHours: "sometimes", ackTimeoutMinutes: "x" }).urgentCategories.join() === "water" && mergeSettings({ onCallMemberIds: [5, null, "m1", "m1"] }).onCallMemberIds.join() === "m1" && mergeSettings({ onCallHours: "sometimes" }).onCallHours === "always" && mergeSettings({ ackTimeoutMinutes: "x" }).ackTimeoutMinutes === 10);
  ok("the wait is clamped to 2–120 minutes", mergeSettings({ ackTimeoutMinutes: 0 }).ackTimeoutMinutes === 2 && mergeSettings({ ackTimeoutMinutes: 9999 }).ackTimeoutMinutes === 120);

  // ── One save: only the keys sent, refused by name ────────────────────────
  const mine = ["m1", "m2", "m3"];
  ok("a save touches only the fields in the body", JSON.stringify(planSafetySave({ current: d, body: { safeStepsEnabled: false }, memberIds: mine }).data) === JSON.stringify({ safeStepsEnabled: false }));
  ok("an on-call id from another company is refused, never kept", planSafetySave({ current: d, body: { onCallMemberIds: ["m1", "other-tenant"] }, memberIds: mine }).ok === false);
  ok("an unknown category is refused", planSafetySave({ current: d, body: { urgentCategories: ["water", "gas_co"] }, memberIds: mine }).field === "urgentCategories");
  ok("the emergency tier is NOT a company switch (no field for it)", !Object.keys(SAFETY_DEFAULTS).some((k) => /emergency|gas|crisis/i.test(k)) && !URGENT_CATEGORIES.includes("gas_co"));
  ok("a custom window with no times is refused rather than stored as a trap", planSafetySave({ current: d, body: { onCallHours: "custom", onCallDays: [1] }, memberIds: mine }).ok === false);
  ok("…and a whole one saves, times read as HH:MM", planSafetySave({ current: d, body: { onCallHours: "custom", onCallDays: [1, 2], onCallStartMinute: "18:00", onCallEndMinute: "08:00" }, memberIds: mine }).data.onCallStartMinute === 1080 && toMinute("24:00") === null && toMinute("7:5") === null);
  ok("a non-boolean switch is refused", planSafetySave({ current: d, body: { bookTechSlots: "yes" }, memberIds: mine }).ok === false);

  // ── Who is on call right now — timezones, midnight, missing hours ───────
  const custom = { onCallHours: "custom", onCallDays: [1, 2, 3, 4, 5], onCallStartMinute: 18 * 60, onCallEndMinute: 8 * 60 };
  // 2026-10-05 is a Monday. 23:00 Toronto (EDT, UTC-4) = 03:00Z Tuesday.
  ok("custom night shift: Monday 23:00 Toronto is on call", onCallNow({ settings: custom, timezone: "America/Toronto", now: new Date("2026-10-06T03:00:00Z") }).on === true);
  ok("...Tuesday 07:30 (the morning half of Monday's shift) is on call", onCallNow({ settings: custom, timezone: "America/Toronto", now: new Date("2026-10-06T11:30:00Z") }).on === true);
  ok("...Tuesday noon is not", onCallNow({ settings: custom, timezone: "America/Toronto", now: new Date("2026-10-06T16:00:00Z") }).on === false);
  ok("...Saturday 07:00 (Friday's shift ran over) is on call, Sunday 07:00 is not", onCallNow({ settings: custom, timezone: "America/Toronto", now: new Date("2026-10-10T11:00:00Z") }).on === true && onCallNow({ settings: custom, timezone: "America/Toronto", now: new Date("2026-10-11T11:00:00Z") }).on === false);
  ok("...and the same UTC instant in Vancouver is a different local hour", onCallNow({ settings: { ...custom, onCallDays: [1] }, timezone: "America/Vancouver", now: new Date("2026-10-06T03:00:00Z") }).on === true);
  ok("after hours with NO business hours saved: on call, with a warning — never silence for a leak", onCallNow({ settings: { onCallHours: "after_hours" }, businessHoursOpen: null }).on === true && onCallNow({ settings: { onCallHours: "after_hours" }, businessHoursOpen: null }).warning === "no_business_hours");
  ok("after hours while the office is open: off hours", onCallNow({ settings: { onCallHours: "after_hours" }, businessHoursOpen: true }).reason === "off_hours");
  ok("a corrupt custom window is named, never guessed", onCallNow({ settings: { onCallHours: "custom", onCallDays: [], onCallStartMinute: null } }).reason === "custom_incomplete");

  // ── The ladder ───────────────────────────────────────────────────────────
  const members = [
    { id: "m1", userId: "u1", name: "Sam", phone: null, active: true },
    { id: "m2", userId: "u2", name: "Lee", phone: "(613) 555-0101", active: true },
    { id: "m3", userId: "u3", name: "Kim", phone: "+16135550102", active: true },
    { id: "m4", userId: "u4", name: "Gone", phone: "+16135550103", active: false },
  ];
  const lad = buildLadder({ onCallMemberIds: ["m1", "m2", "m3", "m4", "stranger"] }, members);
  ok("the ladder keeps the owner's order and skips — by name — who can't be texted", lad.ladder.map((p) => p.memberId).join() === "m2,m3" && lad.skipped.map((s) => `${s.memberId}:${s.reason}`).join() === "m1:no_phone,m4:not_on_team,stranger:not_on_team");
  ok("phones are normalised to E.164", lad.ladder[0].phone === "+16135550101" && e164("555-0101") === null);

  // ── The text and its price ───────────────────────────────────────────────
  const body = alertSmsBody({ companyName: "Acme Plumbing", tier: "urgent", category: "water", customerName: "Jane D.", summary: "x".repeat(500), link: alertLink("https://app.fieldquo.com/", "a1") });
  ok("the text names the company, says urgent and what, clips the customer's words, carries the link", body.startsWith("Acme Plumbing: URGENT (water leak)") && body.includes("https://app.fieldquo.com/app/urgent/a1") && body.length < 320, body);
  ok("a short alert text costs the floor (2¢) — cost × 2 is settled later", alertTextCents("short") === ALERT_TEXT_FLOOR_CENTS && ALERT_TEXT_FLOOR_CENTS === 2);
  ok("a two-segment text costs two floors", alertTextCents("y".repeat(200)) === 4);
  ok("the spend is a declared kind on the phone balance", Boolean(SPEND_KINDS[ALERT_LEDGER_KIND]));
  ok("…and the French text is French", alertSmsBody({ companyName: "Acme", category: "water", language: "fr" }).includes("fuite d'eau"));

  // ── Escalation decisions ─────────────────────────────────────────────────
  const t0x = new Date("2026-10-04T10:00:00Z");
  const open = { status: "open", step: 0, ladder: ["m2", "m3"], nextAt: new Date(t0x.getTime() + 10 * 60_000), acknowledgedAt: null };
  ok("before the wait runs out: wait", escalationStep(open, { now: new Date(t0x.getTime() + 9 * 60_000) }).action === "wait");
  ok("no acknowledgement within the wait: text the next person", escalationStep(open, { now: new Date(t0x.getTime() + 10 * 60_000) }).action === "text_next" && escalationStep(open, { now: new Date(t0x.getTime() + 11 * 60_000) }).nextIndex === 1);
  ok("after the last person: exhausted", escalationStep({ ...open, step: 1 }, { now: new Date(t0x.getTime() + 60 * 60_000) }).action === "exhausted");
  ok("acknowledged: nothing more", escalationStep({ ...open, acknowledgedAt: t0x }, { now: new Date(t0x.getTime() + 60 * 60_000) }).action === "done");

  // ── Why texts aren't going — every reason named ──────────────────────────
  const probs = deliveryProblems({ settings: { urgentAlertsEnabled: true, onCallMemberIds: [] }, ladder: [], skipped: [], balanceCents: 0, smsNumber: false, onCall: { on: false, reason: "off_hours" } });
  ok("no on-call person, no credit, no SMS number and off hours are all named", ["no_on_call", "no_credit", "no_sms_number", "off_hours"].every((r) => probs.some((p) => p.reason === r)), probs);
  ok("every reason the screen can show has a sentence in all nine languages", Object.keys(APP_MESSAGES).length === 9 && ["alerts_off", "no_on_call", "no_phone", "member_no_phone", "member_not_on_team", "no_credit", "no_sms_number", "off_hours", "custom_incomplete", "bad_timezone", "no_business_hours", "send_failed", "opted_out", "nobody_acknowledged", "error"].every((r) => Object.keys(APP_MESSAGES).every((l) => typeof APP_MESSAGES[l][`app.aiEmployee.safety.problem.${r}`] === "string")));

  // ── The ladder, EXECUTED against a scripted store ────────────────────────
  function store() {
    const s = { member: members.map((m) => ({ ...m, companyId: "C1", user: { name: m.name } })), urgentAlert: [], urgentAlertStep: [], company: [{ id: "C1", name: "Acme Plumbing", defaultLanguage: "en", timezone: "America/Toronto", businessHours: null }] };
    let n = 0;
    const where = (row, w = {}) => Object.entries(w).every(([k, v]) => {
      if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
        if ("gte" in v) return new Date(row[k]) >= new Date(v.gte);
        if ("lte" in v) return row[k] && new Date(row[k]) <= new Date(v.lte);
        if ("in" in v) return v.in.includes(row[k]);
        return true;
      }
      // Prisma reads an unset column as null.
      return v === null ? row[k] == null : row[k] === v;
    });
    const model = (name) => ({
      findMany: async ({ where: w, take } = {}) => s[name].filter((r) => where(r, w)).slice(0, take || 1e9),
      findFirst: async ({ where: w, select } = {}) => {
        const r = s[name].filter((x) => where(x, w)).at(-1);
        if (!r) return null;
        if (name === "urgentAlert" && (select?.steps || true)) return { ...r, steps: s.urgentAlertStep.filter((st) => st.alertId === r.id && st.channel === "sms" && st.ok) };
        return r;
      },
      findUnique: async ({ where: w }) => s[name].find((r) => where(r, w)) || null,
      create: async ({ data }) => { const row = { id: `${name}${++n}`, createdAt: new Date(), ...data }; s[name].push(row); return row; },
      update: async ({ where: w, data }) => { const r = s[name].find((x) => where(x, w)); Object.assign(r, data); return r; },
      updateMany: async ({ where: w, data }) => { const rows = s[name].filter((x) => where(x, w)); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    });
    const prisma = { $s: s };
    for (const k of Object.keys(s)) prisma[k] = model(k);
    return prisma;
  }
  function deps({ balance = 500, optedOut = [], noNumber = false } = {}) {
    const log = { sms: [], debits: [], usage: [], notes: [] };
    return {
      log,
      deps: {
        sendSms: async ({ to, body }) => {
          if (noNumber) throw new Error("No SMS 'from' number: FieldQuo holds no system number and TWILIO_PHONE_NUMBER is unset");
          log.sms.push({ to, body });
          return { success: true, sid: `SM${log.sms.length}` };
        },
        maySms: async ({ phone }) => !optedOut.includes(phone),
        balanceFor: async () => balance,
        debitCredit: async (e) => { log.debits.push(e); return { id: "d" }; },
        enqueueUsage: async (e) => { log.usage.push(e); return null; },
        notify: async (e) => { log.notes.push(e); return {}; },
        origin: () => "https://app.example.test",
        businessHoursOpen: () => null,
      },
    };
  }
  const S = { ...mergeSettings(null), onCallMemberIds: ["m1", "m2", "m3"], ackTimeoutMinutes: 10 };
  const T0 = new Date("2026-10-04T10:00:00Z");
  {
    const prisma = store();
    const { log, deps: dp } = deps();
    const r = await raiseUrgentAlert({ companyId: "C1", threadId: "th1", tier: "urgent", category: "water", summary: "water everywhere", customerName: "Jane", settings: S, company: prisma.$s.company[0], now: T0, prisma, deps: dp });
    const a = prisma.$s.urgentAlert[0];
    ok("raised: Sam has no phone, so Lee is texted first — at once, not after a wait", r.alerted === "sms" && log.sms.length === 1 && log.sms[0].to === "+16135550101" && a.step === 1, { r, sms: log.sms });
    ok("...the skip is logged by name", prisma.$s.urgentAlertStep.some((st) => st.memberId === "m1" && st.reason === "no_phone"));
    ok("...charged to the phone & text credit as its own kind, idempotent on the SID", log.debits.length === 1 && log.debits[0].kind === ALERT_LEDGER_KIND && log.debits[0].ref === "urgent_out:SM1" && log.debits[0].cents === 2);
    ok("...queued to settle at cost × 2", log.usage.length === 1 && log.usage[0].ledgerKind === ALERT_LEDGER_KIND && log.usage[0].direction === "out");
    ok("...Lee also gets the bell and a push, named", log.notes.some((n) => n.type === "ai_employee.urgent" && n.recipientUserIds?.join() === "u2"));
    ok("...and the next step is due when the company's wait runs out", a.nextAt.getTime() === T0.getTime() + 10 * 60_000);
    const again = await raiseUrgentAlert({ companyId: "C1", threadId: "th1", tier: "urgent", category: "water", settings: S, company: prisma.$s.company[0], now: new Date(T0.getTime() + 60_000), prisma, deps: dp });
    ok("the same conversation again inside the window: one alert, one text", again.deduped === true && prisma.$s.urgentAlert.length === 1 && log.sms.length === 1);
    const early = await advanceUrgentAlerts({ prisma, now: new Date(T0.getTime() + 5 * 60_000), loadSettings: async () => S, deps: dp });
    ok("the cron before the wait is up: nobody else is texted", early.checked === 0 && log.sms.length === 1);
    await advanceUrgentAlerts({ prisma, now: new Date(T0.getTime() + 10 * 60_000), loadSettings: async () => S, deps: dp });
    ok("no acknowledgement in 10 minutes: Kim (next on the list) is texted", log.sms.length === 2 && log.sms[1].to === "+16135550102" && a.step === 2);
    await advanceUrgentAlerts({ prisma, now: new Date(T0.getTime() + 20 * 60_000), loadSettings: async () => S, deps: dp });
    ok("nobody after the last: exhausted, and the owner gets the bell", a.status === "exhausted" && log.notes.some((n) => n.type === "ai_employee.urgent_unrouted" && n.params?.reason === "nobody_acknowledged") && log.sms.length === 2);
  }
  {
    const prisma = store();
    const { log, deps: dp } = deps();
    const r = await raiseUrgentAlert({ companyId: "C1", threadId: "th2", tier: "urgent", category: "heat", settings: S, company: prisma.$s.company[0], now: T0, prisma, deps: dp });
    const ack = await acknowledgeUrgentAlert({ prisma, companyId: "C1", alertId: r.alertId, memberId: "m2", now: new Date(T0.getTime() + 60_000) });
    await advanceUrgentAlerts({ prisma, now: new Date(T0.getTime() + 30 * 60_000), loadSettings: async () => S, deps: dp });
    ok("'I've got it' stops the ladder — nobody else is texted", ack.ok && log.sms.length === 1 && prisma.$s.urgentAlert[0].status === "acknowledged" && prisma.$s.urgentAlert[0].acknowledgedByMemberId === "m2");
    const twice = await acknowledgeUrgentAlert({ prisma, companyId: "C1", alertId: r.alertId, memberId: "m3" });
    ok("...a second press keeps the first name", twice.already === true && prisma.$s.urgentAlert[0].acknowledgedByMemberId === "m2");
    const foreign = await acknowledgeUrgentAlert({ prisma, companyId: "C2", alertId: r.alertId, memberId: "x" });
    ok("...and another company can't acknowledge it", foreign.ok === false && foreign.status === 404);
  }
  for (const [label, opts, settings, reason] of [
    ["no phone & text credit", { balance: 0 }, S, "no_credit"],
    ["nobody on call", {}, { ...S, onCallMemberIds: [] }, "no_on_call"],
    ["alerts switched off", {}, { ...S, urgentAlertsEnabled: false }, "alerts_off"],
    ["outside the custom on-call hours", {}, { ...S, onCallHours: "custom", onCallDays: [0], onCallStartMinute: 600, onCallEndMinute: 660 }, "off_hours"],
    ["no system SMS number", { noNumber: true }, S, "no_sms_number"],
  ]) {
    const prisma = store();
    const { log, deps: dp } = deps(opts);
    const r = await raiseUrgentAlert({ companyId: "C1", threadId: "th3", tier: "urgent", category: "water", settings, company: prisma.$s.company[0], now: T0, prisma, deps: dp });
    ok(`${label}: no text, nothing charged, the alert says why and the owner gets the bell`, r.alerted === "bell" && r.reason === reason && log.sms.length === 0 && log.debits.length === 0 && prisma.$s.urgentAlert[0].status === "not_sent" && log.notes.some((n) => n.type === "ai_employee.urgent_unrouted"), { r, sms: log.sms.length });
  }
  {
    const prisma = store();
    const { log, deps: dp } = deps({ optedOut: ["+16135550101"] });
    await raiseUrgentAlert({ companyId: "C1", threadId: "th4", tier: "urgent", category: "water", settings: S, company: prisma.$s.company[0], now: T0, prisma, deps: dp });
    ok("a person who replied STOP is skipped at once and the next one texted — no ten-minute wait on a dead number", log.sms.length === 1 && log.sms[0].to === "+16135550102" && prisma.$s.urgentAlertStep.some((st) => st.reason === "opted_out"));
  }

  // ── Triage, pure: the probing cases ──────────────────────────────────────
  const tierOf = (t) => classifyMessage(t).tier;
  ok("dripping vs gushing: a drip is routine, gushing is urgent", tierOf("the bathroom tap keeps dripping") === "routine" && tierOf("water is gushing from the pipe under the sink") === "urgent");
  ok("a bare 'leak' is a question (unclear), with the probing questions", tierOf("there's a leak in the basement") === "unclear" && classifyMessage("there's a leak in the basement").probes.includes("water_active"));
  ok("a gas SMELL is an emergency to leave; a furnace NOISE is not", classifyMessage("I can smell gas near the stove").leaveFirst === true && tierOf("the furnace makes a loud banging noise") === "routine" && classifyMessage("the furnace makes a loud banging noise").probes.includes("gas_or_noise"));
  ok("an odd smell near the furnace is asked about, not escalated", tierOf("there's a weird smell by the furnace") === "unclear");
  ok("a CO alarm is leave-first", classifyMessage("our carbon monoxide alarm is going off").leaveFirst === true);
  ok("no heat alone is a question; no heat at minus 20 is urgent", tierOf("we have no heat") === "unclear" && tierOf("we have no heat and it's minus 20") === "urgent");
  ok("a roof leaking in a storm is urgent; a roof leak on its own is a question", classifyMessage("the roof is leaking and it's raining hard").category === "roof" && tierOf("the roof is leaking and it's raining hard") === "urgent" && tierOf("I think the roof leaks") === "unclear");
  ok("past-tense trouble is not an emergency today", tierOf("we had a small fire in the garage last week") === "none" && tierOf("my basement flooded last year, can you redo the drywall") === "none");
  ok("a wet day is not a flood", tierOf("it's pouring outside, can you quote new gutters?") === "none");
  ok("French and Spanish", classifyMessage("ça sent le gaz dans la cuisine").leaveFirst && tierOf("le tuyau a éclaté") === "urgent" && classifyMessage("hay una fuga de gas").leaveFirst && tierOf("se rompió la tubería") === "urgent");
  ok("the company's list applies: water switched off → routine; the emergency tier never moves", effectiveTier({ tier: "urgent", category: "water" }, { urgentCategories: ["heat"] }) === "routine" && effectiveTier({ tier: "emergency", category: "gas_co" }, { urgentCategories: [] }) === "emergency");
  ok("the higher signal wins: the model cannot downgrade the words, the words cannot hide the model's call", turnTriage({ text: "water is pouring through the ceiling", tools: [{ name: "hand_off_to_human", ok: true, urgency: "routine" }] }).tier === "urgent" && turnTriage({ text: "ok yes", tools: [{ name: "book_callback", ok: true, urgency: "urgent" }] }).tier === "urgent");
  ok("triage block: probing on by default, decisive when switched off", /ask one or two of the short questions/.test(triageBlock(d)) && /Decide from what they have said/.test(triageBlock({ ...d, triageProbeFirst: false })));
  ok("triage block: a switched-off category is named as an ordinary callback, never 911", /Not urgent for this business[\s\S]*never 911[\s\S]*roof/.test(triageBlock({ ...d, urgentCategories: ["water"] })));
  ok("the customer-facing lines exist in nine languages, and the urgent line never invents a number", TRIAGE_LINE_LANGUAGES.length === 9 && !/\d/.test(urgentLine({ alerted: "sms", phone: null, company: "X" })) && leaveFirstLine("xx") === leaveFirstLine("en"));
  ok("the urgent line only claims a text when a text went", /alerted/.test(urgentLine({ alerted: "sms", company: "X" })) && !/alerted/.test(urgentLine({ alerted: "bell", company: "X" })) && urgentLine({ alerted: null, phone: null }) === "");

  // ── Vetted steps: the whitelist and the guard ────────────────────────────
  ok("every vetted step passes the guard it is held to", VETTED_FIRST_STEPS.every((s) => forbiddenInstruction(s.text) === null), VETTED_FIRST_STEPS.filter((s) => forbiddenInstruction(s.text)).map((s) => s.id));
  ok("every vetted step names its public source", VETTED_FIRST_STEPS.every((s) => typeof s.source === "string" && s.source.length > 5));
  ok("the owner's three examples are vetted: main valve, one breaker once, thermostat off", ["water.main_shutoff", "electrical.breaker_once", "heat.thermostat_off"].every((id) => VETTED_FIRST_STEPS.some((s) => s.id === id)) && /once/.test(VETTED_FIRST_STEPS.find((s) => s.id === "electrical.breaker_once").text) && /Never reset it over and over/.test(VETTED_FIRST_STEPS.find((s) => s.id === "electrical.breaker_once").text));
  for (const bad of ["Remove the access panel and check the flame sensor", "Relight the pilot light", "Turn the gas valve off behind the dryer", "Climb onto the roof and clear the ice", "Grab a ladder and clean the gutter", "Reset the breaker a few times until it holds", "Touch the two wires together to test it", "Use a torch to thaw the pipe", "Enlevez le couvercle du panneau", "Suba al techo"]) {
    ok(`not vetted: "${bad}"`, unsafeInstructionRefusal(bad) !== null && screenStep(bad).ok === false);
  }
  ok("a negated warning is what a safe step SAYS, and passes", forbiddenInstruction("Don't go up a ladder or onto the roof.") === null && forbiddenInstruction("Never take the cover off the panel.") === null);
  ok("…but a negation in another clause does not excuse the instruction", forbiddenInstruction("Don't worry, just climb onto the roof") !== null);
  const cleaned = cleanTroubleshootingLog({ symptom: "no heat", steps_given: ["Turn the thermostat to OFF.", "Remove the front panel of the furnace"] });
  ok("log_troubleshooting records only the vetted step and reports the other", cleaned.stepsGiven.join() === "Turn the thermostat to OFF." && cleaned.refusedSteps.length === 1);
  ok("steps switched off: the prompt says to give none", /not to give any steps yourself/.test(firstStepsBlock({ enabled: false, canStep: true })) && !/main water valve/.test(firstStepsBlock({ enabled: false, canStep: true })));
  ok("…on: the steps are named, worded as given, with the never-list", /Shut off the main water valve/.test(firstStepsBlock({ enabled: true, canStep: true })) && /panel or cover opened, a gas valve or pilot light touched, a ladder or the roof/.test(firstStepsBlock({ enabled: true, canStep: true })));
  ok("the closer and a custom employee give no steps and pass it on", /Do not walk anyone through/.test(firstStepsBlock({ canStep: false })));
  const tsPrompt = buildEmployeePrompt({ employee: { role: "troubleshooter" }, company: { name: "Acme" } });
  const tsOff = buildEmployeePrompt({ employee: { role: "troubleshooter" }, company: { name: "Acme" }, safety: { ...d, safeStepsEnabled: false } });
  ok("the troubleshooter's old 'do not talk them through it' is gone; vetted steps replace it", !/do not talk them through it/.test(tsPrompt) && /SAFE FIRST STEPS/.test(tsPrompt) && /only ever one from SAFE FIRST STEPS/.test(tsPrompt.replace(/\s+/g, " ")));
  ok("…and the company's switch reaches the built prompt", /not to give any steps yourself/.test(tsOff) && !/- \[water\] Shut off the main water valve/.test(tsOff));
  ok("every role's prompt carries the company's urgent block after the shared rule", AI_EMPLOYEE_ROLES.every((r) => { const p = buildEmployeePrompt({ employee: { role: r }, company: {} }); return p.indexOf("URGENT PROBLEMS — HOW THIS BUSINESS HANDLES THEM") > p.indexOf("LEAVE FIRST"); }));
  ok("the troubleshooter is told to book a REAL time, and to fall back to a callback only when none", /BOOKING A TECH[\s\S]*check_availability[\s\S]*book_appointment[\s\S]*If it returns no times, or you have no\s+check_availability tool, call book_callback/.test(tsPrompt));

  // ── Web-chat matching, pure: the Facebook matcher's rules ────────────────
  const cl = (over) => ({ id: "c1", companyId: "C1", name: "Jane Doe", email: "jane@example.com", phone: "+16135550100", address: null, city: null, province: null, createdAt: new Date("2024-01-01"), ...over });
  ok("an exact email links", decideWebMatch({ companyId: "C1", contacts: { email: "JANE@example.com" }, clients: [cl()] }).link === true);
  ok("the family landline — same phone, a different name — does NOT link", decideWebMatch({ companyId: "C1", contacts: { name: "John Smith", phone: "613-555-0100" }, clients: [cl()] }).link === false);
  ok("a name alone does not link (nothing to match without an email or phone)", decideWebMatch({ companyId: "C1", contacts: { name: "Jane Doe" }, clients: [cl()] }).link === false);
  ok("two clients tied: neither", decideWebMatch({ companyId: "C1", contacts: { phone: "613-555-0100" }, clients: [cl({ id: "a", name: null }), cl({ id: "b", name: null, email: "b@x.y" })] }).link === false);
  ok("another tenant's client is never a match, even if a query returned it", decideWebMatch({ companyId: "C1", contacts: { email: "jane@example.com" }, clients: [cl({ companyId: "C2" })] }).link === false);
  ok("a pair a person undid is never proposed again", decideWebMatch({ companyId: "C1", contacts: { email: "jane@example.com" }, clients: [cl()], rejectedClientIds: ["c1"] }).link === false);
  ok("names are read from what they typed", nameFromText("hi, I'm Jane Doe and my sink leaks") === "Jane Doe" && nameFromText("my name is jane doe") === "jane doe" && nameFromText("je m'appelle Marie Tremblay") === "Marie Tremblay" && nameFromText("im fine thanks") === null);
  ok("a message with no email or phone costs no client scan", carriesContact("my sink leaks") === false && carriesContact("reach me at 613-555-0100") === true);
  {
    // The undo, against a scripted store.
    const rows = { messageThread: [{ id: "th9", companyId: "C1", clientId: "c1" }], threadClientMatch: [{ id: "tm1", companyId: "C1", threadId: "th9", clientId: "c1", status: "linked" }], message: [] };
    const w = (r, q) => Object.entries(q).every(([k, v]) => r[k] === v);
    const p = {};
    for (const k of Object.keys(rows)) p[k] = {
      findFirst: async ({ where }) => rows[k].find((r) => w(r, where)) || null,
      findMany: async ({ where }) => rows[k].filter((r) => w(r, where)),
      update: async ({ where, data }) => Object.assign(rows[k].find((r) => w(r, where)), data),
      updateMany: async ({ where, data }) => { const m = rows[k].filter((r) => w(r, where)); m.forEach((r) => Object.assign(r, data)); return { count: m.length }; },
      create: async ({ data }) => { rows[k].push({ id: `${k}${rows[k].length}`, ...data }); return data; },
    };
    const u = await undoWebMatch({ prisma: p, companyId: "C1", threadId: "th9", matchId: "tm1", userId: "u1", actorName: "Owner" });
    ok("'Not this client' removes the link and marks the match undone", u.ok && u.unlinked && rows.messageThread[0].clientId === null && rows.threadClientMatch[0].status === "undone" && rows.message.some((m) => m.activity?.type === "unlinked"));
    const other = await undoWebMatch({ prisma: p, companyId: "C2", threadId: "th9", matchId: "tm1" });
    ok("…and another company cannot undo it", other.ok === false);
    // Re-run the matcher on the same thread: the undone pair stays rejected.
    rows.client = [cl()];
    p.client = { findMany: async ({ where }) => rows.client.filter((r) => r.companyId === where.companyId) };
    rows.message.push({ threadId: "th9", direction: "in", private: false, body: "it's jane@example.com" });
    p.message.findMany = async () => rows.message.filter((m) => m.direction === "in");
    const re = await matchWebChatThread({ prisma: p, companyId: "C1", thread: { id: "th9", clientId: null, channel: { platform: "web" } }, inboundText: "it's jane@example.com", settings: d });
    ok("…and the matcher never links that pair again", re.linked === false && rows.messageThread[0].clientId === null, re);
  }

  // ── The wiring: routes, the screen, the cron ─────────────────────────────
  const route = code("app/api/ai-employee/safety/route.js");
  ok("the settings route plans every save through planSafetySave, owner/admin only, read-only for support", /planSafetySave\(/.test(route) && /requirePermission\(member\.role, "user:manage"\)/.test(route) && /member\.impersonation\)\s*\{?\s*return \{ response: NextResponse\.json\(\{ error: "Support sessions are read-only\." \}/.test(route));
  ok("…and the screen's status is the server's own verdict (deliveryProblems)", /deliveryProblems\(/.test(route) && /problems/.test(code("app/components/aiEmployee/UrgentSafety.js")));
  ok("the settings page mounts the card, and the card saves through the route", /<UrgentSafety/.test(code("app/app/settings/ai-employee/page.js")) && /\/api\/ai-employee\/safety/.test(code("app/components/aiEmployee/UrgentSafety.js")));
  const alertRoute = code("app/api/ai-employee/alerts/[id]/route.js");
  ok("'I've got it' is a POST behind a button — a GET (a link preview) never acknowledges", /export async function POST/.test(alertRoute) && alertRoute.indexOf("acknowledgeUrgentAlert(") > alertRoute.indexOf("export async function POST") && /onClick=\{acknowledge\}/.test(code("app/app/urgent/[id]/page.js")));
  const vercel = JSON.parse(read("vercel.json"));
  ok("the escalation cron is scheduled every two minutes, behind the cron secret", vercel.crons.some((c) => c.path === "/api/cron/urgent-alerts" && c.schedule === "*/2 * * * *") && /requireCronSecret\(request\)/.test(code("app/api/cron/urgent-alerts/route.js")));
  ok("the undo route exists and the conversation shows the bar", /undoWebMatch\(/.test(code("app/api/messaging/threads/[id]/client-match/route.js")) && /<WebMatchBar/.test(code("app/app/messages/page.js")));
  ok("the two urgent notification types are in the catalog, the on-call one on the floor every preset holds", NOTIFICATION_TYPES["ai_employee.urgent"]?.audience?.category === "schedule" && NOTIFICATION_TYPES["ai_employee.urgent_unrouted"]?.audience?.capability === "user:manage");
  for (const lang of Object.keys(APP_MESSAGES)) {
    const need = [
      "app.notif.type.ai_employee.urgent", "app.notif.type.ai_employee.urgent_unrouted", "app.aiEmployee.skip.unsafe_step",
      ...URGENT_CATEGORIES.map((c) => `app.aiEmployee.safety.cat.${c}`), "app.aiEmployee.safety.cat.gas_co",
      ...["open", "acknowledged", "exhausted", "not_sent"].map((s) => `app.aiEmployee.safety.status.${s}`),
      "app.urgent.ack", "app.messages.webMatch.undo", "app.aiEmployee.reference.share.offer",
    ];
    ok(`${lang}: the urgent & safety sentences are present`, need.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].trim()), need.filter((k) => !APP_MESSAGES[lang][k]));
  }
}

console.log(`\ncheck-ai-employee: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
