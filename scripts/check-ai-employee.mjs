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
  ok("1. executeFor injects companyId AFTER the model's args", /impl\(\{ \.\.\.args, companyId, source, language \}\)/.test(tools));
  ok("1b. runToolForCompany injects it the same way", (tools.match(/\{ \.\.\.args, companyId, source, language \}/g) || []).length === 2);
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
  ok("6f. the settings route refuses a channel conflict", /channel_conflict/.test(code("app/api/ai-employee/route.js")));
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
  ok("the inbound hook sends only when the mode lets a reply go alone", /mayActAlone\(\{ mode: sendMode\(employee\), risk: RISK_REVERSIBLE, tainted: true \}\)/.test(inbound));
  ok("...and picks the employee by the channel's platform", /employeeForChannel\(companyId, channel\)/.test(inbound) && /platform === "web" \? "web" : platform === "sms" \? "sms" : "meta"/.test(inbound));
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
  ok("the mount renders nothing when no employee answers the web channel", /if \(!config\?\.enabled\) return null/.test(code("app/components/chat/SiteChatMount.js")));
  ok("the site page mounts it with the page's own language", /<SiteChatMount companySlug=\{company\.bookingSlug \|\| company\.slug\} language=\{language\}/.test(code("app/site/[subdomain]/page.js")));
  ok("the embed serves it as the 'chat' widget", /"chat"/.test(code("app/embed/[companySlug]/[widget]/page.js")));
  ok("the send router carries web and sms before the WhatsApp branch", /platform === "web" \|\| platform === "sms"/.test(code("lib/messaging/send.js")));
  ok("the web send never leaves the building", /web:\$\{crypto\.randomUUID\(\)\}/.test(code("lib/messaging/ownSend.js")));
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
  ok("the settings route refuses to switch SMS on without a number", /no_system_number/.test(settings));
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
ok("five platforms, Meta's three plus FieldQuo's two", MESSAGING_PLATFORMS.join(",") === "facebook,instagram,whatsapp,web,sms" && META_PLATFORMS.join(",") === "facebook,instagram,whatsapp" && OWN_PLATFORMS.join(",") === "web,sms");
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

console.log(`\ncheck-ai-employee: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
