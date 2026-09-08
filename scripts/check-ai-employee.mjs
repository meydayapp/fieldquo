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

const ON = { enabled: true, role: "closer", autoReplyEnabled: true, maxRepliesPerThread: 3 };
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

// ── Suggest is the default; auto is a deliberate act ───────────────────────
ok("an employee that never touched the switch is SUGGEST", sendMode({ enabled: true }) === MODE_SUGGEST);
ok("...and so is one whose column is null", sendMode({ enabled: true, autoReplyEnabled: null }) === MODE_SUGGEST);
ok("...and one whose column is a truthy non-true value", sendMode({ autoReplyEnabled: 1 }) === MODE_SUGGEST);
ok("only an explicit true is AUTO", sendMode({ autoReplyEnabled: true }) === MODE_AUTO);
ok("the mode travels with every decision", say().mode === MODE_AUTO && say({ employee: { ...ON, autoReplyEnabled: false } }).mode === MODE_SUGGEST);

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

// ── The settings screen tells the truth about auto-send ────────────────────
{
  const page = code("app/app/settings/ai-employee/page.js");
  ok("the screen offers the test box that proves what it would say", /test/i.test(page));
  ok("...and names the two modes", /suggest/i.test(page) && /auto/i.test(page));
}

console.log(`\ncheck-ai-employee: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
