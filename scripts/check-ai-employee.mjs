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
import { AI_EMPLOYEE_VOICES, voiceLine, disclosureLine, DISCLOSURE_LANGUAGES } from "../lib/aiEmployee/roles.js";
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
  ok("1. executeFor injects companyId AFTER the model's args", /impl\(\{ \.\.\.args, companyId, source, language, threadId, employeeId, prisma \}\)/.test(tools));
  ok("1b. runToolForCompany injects it the same way", (tools.match(/\{ \.\.\.args, companyId, source, language \}/g) || []).length === 1);
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
  ok("4. the material is read under companyId", /aiEmployeeSource\.findMany\(\{\s*where: \{ companyId, status: "ready" \}/.test(respond));
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
ok("the troubleshooter neither books nor quotes", !toolsForRole("troubleshooter").includes("book_appointment") && !toolsForRole("troubleshooter").includes("send_instant_quote_link"));
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
  ok("...hands that count to the prompt", /buildEmployeePrompt\([^)]*tally/s.test(respond));
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
  const { respondToMessage } = await import("../lib/aiEmployee/respond.js");

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

  // ── Hand-off moves the assignee and introduces once ──────────────────────
  {
    const db = makeDb({ aiEmployee: employees(), messageThread: [thread()], message: [inbound("m1", "Hi, can someone come out to look at my kitchen?", 0)], company: [company] });
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

  // ── The responder's structure ────────────────────────────────────────────
  {
    const respond = code("lib/aiEmployee/respond.js");
    ok("the assignee gate sits before the credit check and the prompt", respond.indexOf("assignThread(") > -1 && respond.indexOf("assignThread(") < respond.indexOf("meter.check()") && respond.indexOf("burstGate(") < respond.indexOf("assignThread("));
    ok("a non-assignee returns NOT_ASSIGNEE without generating", /reason: SKIP\.NOT_ASSIGNEE/.test(respond) && respond.indexOf("SKIP.NOT_ASSIGNEE") < respond.indexOf("runLoop("));
    ok("the take-over stamp is handed to shouldReply as a fact", /humanTookOver: Boolean\(thread\?\.humanTookOverAt\)/.test(respond));
    ok("the colleague's turn is the same function at depth 1", /handOffDepth: handOffDepth \+ 1/.test(respond));
    ok("the introduction is prepended at depth 1 only", /if \(text && afterHandOff\)/.test(respond) && /introductionLine\(/.test(respond));
    ok("the composed-then-superseded reply is recorded, not sent", /suppressedReason: SKIP\.BURST_MERGED/.test(respond));
    ok("disabledTools reach both the definitions and the executor", /definitionsForRole\(employee\.role, \{\s*disabledTools: employee\.disabledTools,\s*afterHandOff,\s*\}\)/.test(respond) && /disabledTools: employee\.disabledTools,\s*threadId,\s*employeeId: employee\.id,\s*afterHandOff,\s*prisma,/.test(respond));
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

console.log(`\ncheck-ai-employee: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
