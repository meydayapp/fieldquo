// scripts/check-call-script.mjs
//
//   npm run check:call-script
//
// The AI call script: generated once per claimed prospect by a pipeline
// stage, never on a page view, and rendered above the rules when it exists.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The owner: "i thought we would have a more details on the company from the
// crawler and AI revision with the Script". The rep's playbook route says in
// its header that it calls no model, and it was right to — a page view must
// not spend money. So the script is a ROW, written by GENERATE_CALL_SCRIPT at
// the end of the claimed lane, hashed over what the model was shown so a
// second claim between the same two crawls spends nothing.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// The handler runs against a scripted database and a scripted model: builds
// the prompt from fixture rows, refuses on a spent budget before asking,
// stores once, skips when the hash is unchanged, regenerates when the crawl
// changes, rejects a reply with a digit in it. The chain is asked which stage
// follows the brief on each lane. The route and the screen are read for the
// one property each must hold: the route writes nothing and calls no vendor;
// the screen draws the generated script above the stages and only when it
// was returned.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The hash comparison, the lane gate and the screen's conditional were each
// broken on disk, confirmed to fail here, and restored from a `cp` backup —
// never `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CALL_SCRIPT_AI_AREA,
  CALL_SCRIPT_LIMITS,
  CALL_SCRIPT_VERSION,
  callScriptCurrent,
  callScriptInputHash,
  callScriptInputs,
  callScriptPrompt,
  callScriptSchema,
  validateCallScript,
} from "@/lib/sales/intel/callScript";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";
import { AI_FAILURE } from "@/lib/ai/provider";
import { estimateCostMicros, hasKnownPricing } from "@/lib/ai/usage";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/ai/platformUsage";
import { handleGenerateCallScript } from "@/lib/sales/pipeline/handlers/generateCallScript";
import { HANDLER_MODULES } from "@/lib/sales/pipeline/handlers/index";
import { getHandler, isPlaceholder } from "@/lib/sales/pipeline/registry";
import { PROVIDER_BY_KIND, TASK_KINDS } from "@/lib/sales/pipeline/kinds";
import { CLAIMED_TAIL, NEXT_STAGE, advanceChain, nextStageFor } from "@/lib/sales/pipeline/chain";
import { CLAIMED_NOT_BEFORE } from "@/lib/sales/pipeline/priority";
import { RESEARCH_CHAIN, researchPlan } from "@/lib/sales/pipeline/research";
import { STAGES } from "@/lib/sales/pipeline/progress";
import { composeBrief } from "@/lib/sales/intel/brief";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)?.slice(0, 400)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-11T15:00:00Z");
const CRAWLED = new Date("2026-09-10T03:00:00Z");

// ── Fixture rows: a prospect the crawler read, as the brief composes it ────
const PROSPECT = {
  id: "p1",
  businessName: "Richmond Rolloff Container Service",
  city: "Richmond",
  province: "BC",
  phoneE164: "+16045550100",
  websiteUrl: "http://www.richmondcontainer.com/",
  tradeKey: "junk_removal",
  campaignId: "c1",
  assignedRepId: "rep-1",
  sourceProvider: "overture",
  sourceRelease: "2026-08",
  sourceUpdatedAt: new Date("2026-08-01"),
  lastCrawledAt: CRAWLED,
};
const brief = composeBrief({
  prospect: PROSPECT,
  capabilities: [
    { code: "ONLINE_BOOKING", value: false, evidenceIds: ["e1"] },
    { code: "ONLINE_QUOTE", value: false, evidenceIds: ["e2"] },
    { code: "CONTACT_FORM", value: true, evidenceIds: ["e3"] },
  ],
  technologies: [{ technologyCode: "wordpress", isCompetitor: false, evidenceIds: ["e4"] }],
  inferences: [],
  opportunities: [
    { capabilityCode: "ONLINE_BOOKING", rank: 1, reason: "The site has no way to book a bin online.", evidenceIds: ["e1"], ruleCode: "WEBSITE_NO_BOOKING" },
    { capabilityCode: "ONLINE_QUOTE", rank: 2, reason: "Quotes are by phone only.", evidenceIds: ["e2"], ruleCode: "WEBSITE_NO_QUOTE" },
  ],
  score: { score: 62, reasons: [], scoringVersion: "3" },
});
const fixtureInputs = () => ({
  prospect: PROSPECT,
  brief,
  playbook: { name: "Website, no booking", describe: "A site that cannot take a booking.", selectorLabel: "Website without online booking" },
  stages: [
    { name: "Open", say: { text: "Hi, is this the owner of {business}?" }, prompts: [] },
    { name: "Fit", say: { text: "I looked at your site before calling." }, prompts: [{ text: "How do jobs come in today?" }] },
    { name: "Close", say: { text: "Can I show you in fifteen minutes on Thursday?" }, prompts: [] },
  ],
  objections: [
    { label: "We already use Jobber", response: "That is fine — the question is whether the homeowner can book without calling." },
    { label: "Send me an email", response: "Happy to. What would make it worth opening?" },
  ],
  unchecked: ["reviews"],
  crawledAt: CRAWLED,
});

const goodReply = () => ({
  opener: "Hi — is this the owner of Richmond Rolloff Container Service? I had a look at your website before calling.",
  whatWeSaw: ["There is a contact form on the site.", "There is no way to book a bin online.", "Quotes are by phone only."],
  whyThemNow: "Homeowners who want a bin this weekend book with whoever lets them do it without a call. Your site asks them to phone. That is the gap worth a conversation.",
  threeQuestions: ["How do most bin requests reach you today?", "Who answers when the phone rings on a Saturday?", "Do you read your reviews anywhere?"],
  objections: [
    { they: "We already use Jobber.", you: "That is fine — the question is whether a homeowner can book without calling you." },
    { they: "Send me an email.", you: "Happy to. What would make it worth opening?" },
  ],
  closeAsk: "Can I show you in fifteen minutes on Thursday?",
  doNotSay: ["Do not mention their reviews — nothing was looked at.", "Do not claim to know how many trucks they run."],
});

/** A scripted database: the models the handler and the meter reach for, and
 *  nothing wider. An unscripted model throws by name. */
function stubDb(fixture = {}) {
  const rows = { prospectCallScript: [], platformAiUsage: [], platformAiBudget: [], ...fixture };
  const writes = [];
  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("gte" in v) return new Date(row[k]) >= new Date(v.gte);
        if ("not" in v) return row[k] !== v.not;
        return true;
      }
      if (v === null) return row[k] == null;
      return row[k] === v;
    });
  const model = (name) => ({
    findUnique: async ({ where }) => rows[name].find((r) => match(r, where)) || null,
    findMany: async ({ where = {} } = {}) => rows[name].filter((r) => match(r, where)),
    count: async ({ where = {} } = {}) => rows[name].filter((r) => match(r, where)).length,
    aggregate: async ({ where = {}, _sum } = {}) => {
      const found = rows[name].filter((r) => match(r, where));
      const out = { _sum: {} };
      for (const k of Object.keys(_sum || {})) out._sum[k] = found.reduce((n, r) => n + (Number(r[k]) || 0), 0);
      return out;
    },
    create: async ({ data }) => {
      if (data.ref && rows[name].some((r) => r.ref === data.ref)) { const e = new Error("dup"); e.code = "P2002"; throw e; }
      const row = { id: `${name}-${rows[name].length + 1}`, createdAt: NOW, ...data };
      rows[name].push(row);
      writes.push({ model: name, action: "create", data });
      return row;
    },
    upsert: async ({ where, create, update }) => {
      const existing = rows[name].find((r) => match(r, where));
      if (existing) { Object.assign(existing, update); writes.push({ model: name, action: "upsert:update", data: update }); return existing; }
      const row = { id: `${name}-${rows[name].length + 1}`, ...create };
      rows[name].push(row);
      writes.push({ model: name, action: "upsert:create", data: create });
      return row;
    },
  });
  return new Proxy({ __rows: rows, __writes: writes }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop !== "string") return undefined;
      if (!(prop in rows)) throw new Error(`dbStub: unscripted model ${prop}`);
      return model(prop);
    },
  });
}

const task = (extra = {}) => ({
  id: "task-script",
  kind: "GENERATE_CALL_SCRIPT",
  prospectId: "p1",
  campaignId: "c1",
  payload: { prospectId: "p1", priority: "claimed" },
  claimToken: "tok",
  attempts: 1,
  idempotencyKey: "research:GENERATE_CALL_SCRIPT:p1:0",
  ...extra,
});

// ═══════════════════════════════════════════════════════════════════════════
section("1. The stage exists, is real, and is on the claimed lane only");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("GENERATE_CALL_SCRIPT is a task kind", TASK_KINDS.includes("GENERATE_CALL_SCRIPT"));
  ok("…last, after the brief", TASK_KINDS.at(-1) === "GENERATE_CALL_SCRIPT" && TASK_KINDS.at(-2) === "GENERATE_RESEARCH_BRIEF");
  ok("…on the openai budget, because it is one model call", PROVIDER_BY_KIND.GENERATE_CALL_SCRIPT === "openai");
  ok("…with a real handler registered", !isPlaceholder("GENERATE_CALL_SCRIPT") && typeof getHandler("GENERATE_CALL_SCRIPT") === "function");
  ok("…named in HANDLER_MODULES", HANDLER_MODULES.includes("GENERATE_CALL_SCRIPT"));
  ok("…described on the board", STAGES.some((s) => s.kind === "GENERATE_CALL_SCRIPT" && /claimed/i.test(s.what)));
  ok("…and it ends the chain", NEXT_STAGE.GENERATE_CALL_SCRIPT === null);

  ok("the backlog's chain ends at the brief", nextStageFor("GENERATE_RESEARCH_BRIEF") === null && nextStageFor("GENERATE_RESEARCH_BRIEF", { priority: "backlog" }) === null);
  ok("the claimed lane continues into the script", nextStageFor("GENERATE_RESEARCH_BRIEF", { priority: "claimed" }) === "GENERATE_CALL_SCRIPT");
  ok("…and that is the whole claimed tail", JSON.stringify(CLAIMED_TAIL) === JSON.stringify({ GENERATE_RESEARCH_BRIEF: "GENERATE_CALL_SCRIPT" }));

  // Executed: the brief settling on each lane.
  const created = [];
  const fakeDb = { salesPipelineTask: { async findUnique() { return null; }, async create({ data }) { created.push(data); return { ...data, id: "x", createdAt: NOW }; } } };
  const backlog = await advanceChain({ kind: "GENERATE_RESEARCH_BRIEF", db: fakeDb, task: { id: "b", prospectId: "p", payload: { prospectId: "p", priority: "backlog", phrase: false } } });
  ok("a backlog brief queues nothing after it", backlog.reason === "end_of_chain" && created.length === 0, backlog);
  const claimed = await advanceChain({ kind: "GENERATE_RESEARCH_BRIEF", db: fakeDb, task: { id: "b", prospectId: "p", payload: { prospectId: "p", priority: "claimed" } } });
  ok("a claimed brief queues the script", claimed.queued === "GENERATE_CALL_SCRIPT" && created[0]?.kind === "GENERATE_CALL_SCRIPT", claimed);
  ok("…in the claimed lane, ahead of the backlog", created[0]?.payload?.priority === "claimed" && created[0]?.notBefore === CLAIMED_NOT_BEFORE);

  // The planner: a fully researched, claimed prospect with no script gets one.
  const done = RESEARCH_CHAIN.map((k) => ({ id: k, kind: k, status: "done", createdAt: NOW }));
  const prospect = { id: "p", websiteUrl: "http://x.example/", lastCrawledAt: CRAWLED, doNotContactAt: null, campaignId: null };
  const plan = researchPlan({ prospect, tasks: done, priority: "claimed", script: null });
  ok("ensureResearchQueued plans the script after a finished chain", plan.enqueue[0]?.kind === "GENERATE_CALL_SCRIPT", plan);
  ok("…not on the backlog lane", researchPlan({ prospect, tasks: done, priority: "backlog", script: null }).skipped === "complete");
  ok("…nor when a script for this crawl exists", researchPlan({ prospect, tasks: done, priority: "claimed", script: { crawledAt: CRAWLED } }).skipped === "complete");
  ok("…but again when the crawl is newer than the script",
    researchPlan({ prospect: { ...prospect, lastCrawledAt: NOW }, tasks: done, priority: "claimed", script: { crawledAt: CRAWLED } }).enqueue[0]?.kind === "GENERATE_CALL_SCRIPT");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. What the model is shown, and what it may answer");
// ═══════════════════════════════════════════════════════════════════════════

{
  const inputs = callScriptInputs(fixtureInputs());
  ok("the inputs are sentences", inputs.known.every((k) => typeof k === "string") && inputs.known.length > 3, inputs.known);
  ok("…with the business named", inputs.business === PROSPECT.businessName);
  ok("…the gaps named as gaps", inputs.unknown.some((u) => /has not been read|could not be decided|not listed|lawfully/i.test(u)), inputs.unknown);
  ok("…without the phone number or the directory's refresh date", !inputs.known.some((k) => /^Phone:|^Record last refreshed:/.test(k)), inputs.known);
  ok("…the rule's own reason as the talking point", inputs.talkingPoints[0] === "Online booking: The site has no way to book a bin online.", inputs.talkingPoints);
  ok("…the tier playbook and its lines", /Website, no booking/.test(inputs.playbook) && inputs.stages.length === 3, inputs);
  ok("…the objection library", inputs.objections.length === 2 && /Jobber/.test(inputs.objections[0]));
  ok("…and what was not looked at", inputs.unchecked.includes("reviews"));
  const prompt = callScriptPrompt(inputs);
  ok("the prompt carries no ids, no evidence, no scores, no phone", !/evidenceIds|prospectId|\be[1-9]\b|\+1604|score/i.test(prompt), prompt.match(/evidenceIds|prospectId|\+1604|score/i)?.[0]);
  ok("…says the crawler read the site", /The crawler read their website/.test(prompt));
  ok("…tells the model to ask about the unknowns rather than assert", /ask, never assert/.test(prompt));
  ok("…and forbids digits", /No digits anywhere/.test(prompt));
  const noCrawl = callScriptPrompt(callScriptInputs({ ...fixtureInputs(), brief: composeBrief({ prospect: { ...PROSPECT, lastCrawledAt: null } }) }));
  ok("an uncrawled prospect's prompt says so", /has NOT read their website/.test(noCrawl));

  const schema = callScriptSchema();
  ok("the schema passes the vendor's strict lint", assertStrictSchema(schema).ok, assertStrictSchema(schema).errors);
  ok("…and has no numeric field anywhere", !/"type":"(number|integer)"/.test(JSON.stringify(schema)));

  const h1 = callScriptInputHash(inputs);
  ok("the hash is stable for the same inputs", h1 === callScriptInputHash(callScriptInputs(fixtureInputs())));
  const changed = fixtureInputs();
  changed.objections = [changed.objections[0]];
  ok("…and changes when an objection is edited", h1 !== callScriptInputHash(callScriptInputs(changed)));
  const recrawled = fixtureInputs();
  recrawled.brief = composeBrief({ prospect: PROSPECT, capabilities: [{ code: "ONLINE_BOOKING", value: true, evidenceIds: ["e9"] }], opportunities: [] });
  ok("…and when a new crawl changes a capability", h1 !== callScriptInputHash(callScriptInputs(recrawled)));
  ok("…and when the prompt version changes", h1 !== callScriptInputHash({ ...inputs, version: "999" }));

  const good = validateCallScript(goodReply());
  ok("a well-formed reply is accepted", good.ok && good.script.threeQuestions.length === 3, good.problems);
  ok("a digit anywhere rejects the whole script", !validateCallScript({ ...goodReply(), whyThemNow: "They have 42 reviews." }).ok);
  ok("…named as such", validateCallScript({ ...goodReply(), closeAsk: "Thursday at 3?" }).problems.includes("digits"));
  ok("two questions are not three", validateCallScript({ ...goodReply(), threeQuestions: ["a?", "b?"] }).problems.includes("list_short"));
  ok("one objection is too few", validateCallScript({ ...goodReply(), objections: [goodReply().objections[0]] }).problems.includes("list_short"));
  // The first script ever generated, in production, was rejected for eight
  // whatWeSaw lines over a bound of six. Paid for and thrown away.
  const generous = validateCallScript({ ...goodReply(), whatWeSaw: Array.from({ length: 9 }, (_, i) => `Fact ${"abcdefghi"[i]}.`), doNotSay: Array.from({ length: 8 }, (_, i) => `Skip ${"abcdefgh"[i]}.`) });
  ok("a list past its bound is trimmed, not rejected", generous.ok && generous.script.whatWeSaw.length === CALL_SCRIPT_LIMITS.whatWeSaw.max && generous.script.doNotSay.length === CALL_SCRIPT_LIMITS.doNotSay.max, generous);
  ok("…and the trim is reported by field", JSON.stringify(generous.trimmed) === JSON.stringify(["whatWeSaw", "doNotSay"]), generous.trimmed);
  ok("…while four questions become three", validateCallScript({ ...goodReply(), threeQuestions: ["a?", "b?", "c?", "d?"] }).script?.threeQuestions.length === 3);
  ok("the prompt states the bounds it will be held to", new RegExp(`the ${CALL_SCRIPT_LIMITS.whatWeSaw.max} or fewer things`).test(prompt) && new RegExp(`up to ${CALL_SCRIPT_LIMITS.doNotSay.max} things`).test(prompt), prompt.slice(-900));
  ok("an empty opener is refused", validateCallScript({ ...goodReply(), opener: "  " }).problems.includes("empty_field"));
  ok(`a list line past ${CALL_SCRIPT_LIMITS.sentence} characters is refused`, validateCallScript({ ...goodReply(), whatWeSaw: ["x".repeat(400)] }).problems.includes("too_long"));
  // 17 of the first 73 paid scripts were thrown away here: a three-sentence
  // whyThemNow is longer than one line, and the prompt asked for three.
  ok(`a spoken paragraph may run to ${CALL_SCRIPT_LIMITS.paragraph}`, validateCallScript({ ...goodReply(), whyThemNow: "Word ".repeat(120).trim() }).ok);
  ok("…but not past it", validateCallScript({ ...goodReply(), whyThemNow: "x".repeat(CALL_SCRIPT_LIMITS.paragraph + 1) }).problems.includes("too_long"));
  ok("an objection's answer is a paragraph; what they say is a line",
    validateCallScript({ ...goodReply(), objections: [{ they: "No.", you: "Word ".repeat(100).trim() }, goodReply().objections[1]] }).ok &&
    !validateCallScript({ ...goodReply(), objections: [{ they: "Word ".repeat(100).trim(), you: "Fine." }, goodReply().objections[1]] }).ok);
  ok("not an object is refused", !validateCallScript("hello").ok && !validateCallScript(null).ok);
  ok("a rejected script is null, never patched", validateCallScript({ ...goodReply(), opener: "" }).script === null);

  ok("a stored script with the same hash and version is current", callScriptCurrent({ inputHash: h1, promptVersion: CALL_SCRIPT_VERSION }, { inputHash: h1 }));
  ok("…a different hash is not", !callScriptCurrent({ inputHash: "other", promptVersion: CALL_SCRIPT_VERSION }, { inputHash: h1 }));
  ok("…an older version is not", !callScriptCurrent({ inputHash: h1, promptVersion: "0" }, { inputHash: h1 }));
  ok("…and nothing is not", !callScriptCurrent(null, { inputHash: h1 }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The handler, executed: builds, refuses, stores once, skips, regenerates");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Builds the prompt from fixture rows and stores the script.
  const db = stubDb();
  let prompts = [];
  const complete = async ({ prompt, schema, onUsage, system }) => {
    prompts.push({ prompt, schema, system });
    await onUsage({ model: "gpt-5-mini", promptTokens: 1400, completionTokens: 700 });
    return { ok: true, data: goodReply(), raw: "" };
  };
  const first = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "k1", db, now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("the stage completes", first.done === true, first);
  ok("…and says it generated", /generated/.test(first.note) && !/regenerated/.test(first.note), first.note);
  ok("…the model was asked once, with the prompt built from the rows", prompts.length === 1 && /Richmond Rolloff/.test(prompts[0].prompt) && /Jobber/.test(prompts[0].prompt));
  ok("…under the strict schema", prompts[0].schema && assertStrictSchema(prompts[0].schema).ok);
  const stored = db.__rows.prospectCallScript[0];
  ok("…one row stored, keyed on the prospect", db.__rows.prospectCallScript.length === 1 && stored.prospectId === "p1", stored);
  ok("…with the validated script, the model, the version, the hash and the crawl date",
    stored.script.opener === goodReply().opener && stored.model === "gpt-5-mini" && stored.promptVersion === CALL_SCRIPT_VERSION && stored.inputHash.length === 40 && stored.crawledAt === CRAWLED && stored.generatedAt === NOW, stored);
  const usage = db.__rows.platformAiUsage[0];
  ok("…and the spend is in the ledger under call_script, keyed on the task", usage?.area === CALL_SCRIPT_AI_AREA && usage.ref === "k1" && usage.prospectId === "p1" && usage.salesRepId === "rep-1", usage);
  ok("…priced from the model's table", usage?.costMicros === estimateCostMicros({ model: "gpt-5-mini", promptTokens: 1400, completionTokens: 700 }));

  // Skips when the hash is unchanged.
  const second = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "k2", db, now: new Date(NOW.getTime() + 60_000), deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("the same inputs a minute later spend nothing", second.done === true && /unchanged/.test(second.note) && prompts.length === 1, second);
  ok("…and write nothing", db.__rows.prospectCallScript.length === 1 && db.__writes.filter((w) => w.model === "prospectCallScript").length === 1);

  // Regenerates when the crawl changed the inputs.
  const recrawled = fixtureInputs();
  recrawled.brief = composeBrief({ prospect: PROSPECT, capabilities: [{ code: "ONLINE_BOOKING", value: true, evidenceIds: ["e9"] }], opportunities: [] });
  recrawled.crawledAt = NOW;
  const third = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "k3", db, now: NOW, deps: { loadInputs: async () => recrawled, complete } });
  ok("a new crawl regenerates", third.done === true && /regenerated/.test(third.note) && prompts.length === 2, third);
  ok("…in place: still one row, new hash, new crawl date", db.__rows.prospectCallScript.length === 1 && stored.inputHash !== callScriptInputHash(callScriptInputs(fixtureInputs())) && stored.crawledAt === NOW);
}

{
  // Refuses on a spent budget, before asking. Two ways: the real meter over
  // a scripted ledger, and an injected refusal.
  const db = stubDb({
    platformAiBudget: [{ scope: "daily", scopeId: null, limitMicros: 1000, active: true }],
    platformAiUsage: [{ area: "research_brief", model: "gpt-5-mini", costMicros: 1000, createdAt: NOW, ref: "old" }],
  });
  let asked = 0;
  const complete = async () => { asked++; return { ok: true, data: goodReply() }; };
  const spent = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "k4", db, now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("a spent daily budget refuses", spent.done === false && /daily_budget/.test(spent.reason), spent);
  ok("…terminally — not retried against the same budget five times", spent.retry === false);
  ok("…before the model was asked", asked === 0);
  ok("…and nothing was stored", db.__rows.prospectCallScript.length === 0);
  const budget = await checkPlatformAiBudget(db, { now: NOW });
  ok("(the meter itself agrees)", budget.allowed === false && budget.reason === "daily_budget", budget);

  const injected = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "k5", db: stubDb(), now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete, checkBudget: async () => ({ allowed: false, reason: "global_budget", capped: true }) } });
  ok("an injected refusal is honoured the same way", injected.done === false && injected.retry === false && asked === 0, injected);
}

{
  // The lane gate, the vendor outcomes, and a reply with a digit.
  const complete = async ({ onUsage }) => { await onUsage({ model: "gpt-5-mini", promptTokens: 10, completionTokens: 10 }); return { ok: true, data: { ...goodReply(), whyThemNow: "They run 3 trucks." } }; };
  const backlog = await handleGenerateCallScript({ task: task({ payload: { prospectId: "p1", priority: "backlog" } }), payload: { prospectId: "p1", priority: "backlog" }, db: stubDb(), now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("the backlog lane is refused, terminally, before any read", backlog.done === false && backlog.retry === false && /claimed lane/.test(backlog.reason), backlog);
  const noLane = await handleGenerateCallScript({ task: task({ payload: { prospectId: "p1" } }), payload: { prospectId: "p1" }, db: stubDb(), now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("…and so is a task with no lane at all", noLane.done === false && noLane.retry === false);

  const db = stubDb();
  const digits = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "k6", db, now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("a reply with a digit is rejected and not stored", digits.done === false && /digits/.test(digits.reason) && db.__rows.prospectCallScript.length === 0, digits);
  ok("…but the spend is still recorded — the vendor generated it", db.__rows.platformAiUsage.length === 1);

  const vendorDown = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "k7", db: stubDb(), now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete: async () => ({ ok: false, reason: AI_FAILURE.VENDOR_ERROR, message: "502" }) } });
  ok("a vendor outage is retried on the ladder", vendorDown.done === false && vendorDown.retry === true, vendorDown);
  const unconfigured = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "k8", db: stubDb(), now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete: async () => ({ ok: false, reason: AI_FAILURE.UNCONFIGURED }) } });
  ok("no key is terminal — the same answer tomorrow", unconfigured.done === false && unconfigured.retry === false && /unconfigured/.test(unconfigured.reason));
  const missing = await handleGenerateCallScript({ task: task(), payload: task().payload, db: stubDb(), now: NOW, deps: { loadInputs: async () => ({ prospect: null }) } });
  ok("a missing prospect is terminal", missing.done === false && missing.retry === false);

  const src = decomment(read("lib/sales/pipeline/handlers/generateCallScript.js"));
  ok("the handler meters through platformUsage — checkPlatformAiBudget before, recordPlatformAiUsage after",
    /checkPlatformAiBudget/.test(src) && /recordPlatformAiUsage/.test(src) && src.indexOf("checkBudget(prisma") < src.indexOf("askModel({"));
  ok("…and talks to the model only through lib/ai/provider", /from "@\/lib\/ai\/provider"/.test(src) && !/new OpenAI/.test(src));
  ok("…and loads the playbook exactly as the rep's route does", /useAi: false,\s*persist: false,\s*assignVariant: false/.test(src));
  ok("recordPlatformAiUsage is the real meter", typeof recordPlatformAiUsage === "function");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The route reads it and the screen draws it above the rules — only when present");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = read("app/api/sales/playbook/route.js");
  const code = decomment(route);
  ok("the route reads the stored script", /db\.prospectCallScript\.findUnique\(/.test(code));
  ok("…guarded on the client having the model", /typeof db\.prospectCallScript\?\.findUnique === "function"/.test(code));
  ok("…returns it as callScript, null when absent", /callScript: stored\?\.script\s*\?/.test(code) && /: null,/.test(code));
  ok("…with the crawl date the screen prints", /crawledAt: stored\.crawledAt/.test(code));
  ok("…still writes nothing", ![...code.matchAll(/\bdb\.(\w+)\.(create|update|upsert|delete)\w*\(/g)].length);
  ok("…and still names no vendor", !/lib\/ai\/provider|openai/i.test(code));

  const screen = read("app/components/sales/CallPlaybook.js");
  const draw = decomment(screen);
  ok("the screen has the generated block", /function AiScript\(/.test(draw));
  ok("…drawn only when the route returned one", /\{data\.callScript \? <AiScript script=\{data\.callScript\}/.test(draw));
  ok("…above the stages", draw.indexOf("<AiScript") < draw.indexOf("{stage ? ("));
  ok("…and the stages and the objection rail still render below", draw.indexOf("{stage ? (") > 0 && /ifTheyPushBack/.test(draw) && /objectionsToShow/.test(draw));
  ok("…every section of the shape is printed", ["opener", "whatWeSaw", "whyThemNow", "threeQuestions", "objections", "closeAsk", "doNotSay"].every((k) => new RegExp(`script\\.${k}`).test(draw)));
  ok("…the crawl date sentence, and the no-crawl sentence", /aiScriptGenerated"/.test(draw) && /aiScriptGeneratedNoCrawl/.test(draw));
  ok("…headings are keyed, sentences are not", /t\("app\.salesCall\.aiScriptOpener"\)/.test(draw) && /\{script\.opener\}/.test(draw));
  ok("…and the block says the rules below are the same on every call", /aiScriptRulesBelow/.test(draw));

  const catalogue = read("app/i18n/appMessages.js");
  const keys = ["aiScriptHeading", "aiScriptGenerated", "aiScriptGeneratedNoCrawl", "aiScriptOpener", "aiScriptWhatWeSaw", "aiScriptWhyNow", "aiScriptQuestions", "aiScriptObjections", "aiScriptClose", "aiScriptDoNotSay", "aiScriptRulesBelow"];
  ok("every heading is in the catalogue nine times — one per language",
    keys.every((k) => (catalogue.match(new RegExp(`"app\\.salesCall\\.${k}":`, "g")) || []).length === 9),
    keys.map((k) => [k, (catalogue.match(new RegExp(`"app\\.salesCall\\.${k}":`, "g")) || []).length]));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. What it costs — from a real prompt, at the model's price");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Tokens are estimated at four characters each, which for English prose
  // with a JSON envelope is within ten percent of the vendor's count. The
  // completion is the script itself plus a reasoning model's thinking on
  // `low` effort. The daily figure is what the owner decides the claim
  // ceiling against, so it is printed rather than only asserted.
  const inputs = callScriptInputs(fixtureInputs());
  const prompt = callScriptPrompt(inputs);
  const promptTokens = Math.ceil((prompt.length + 400) / 4); // + the system line
  const completionTokens = Math.ceil(JSON.stringify(goodReply()).length / 4) + 400; // + reasoning at low effort
  const model = "gpt-5-mini";
  const micros = estimateCostMicros({ model, promptTokens, completionTokens });
  const perScript = micros / 1_000_000;
  const perDay = perScript * 4000;
  // The per-million prices, read back off the estimator so the line prints
  // the table's numbers and not a copy of them.
  const perM = (kind) => (estimateCostMicros({ model, promptTokens: kind === "in" ? 1_000_000 : 0, completionTokens: kind === "out" ? 1_000_000 : 0 }) / 1_000_000).toFixed(2);
  ok("the model has a checked price", hasKnownPricing(model));
  console.log(`  prompt ${prompt.length} chars ≈ ${promptTokens} tokens; completion ≈ ${completionTokens} tokens; ${model} at $${perM("in")}/M in, $${perM("out")}/M out`);
  console.log(`  ≈ $${perScript.toFixed(5)} per script; × 4,000 claims a day (100 per rep × 40 reps) ≈ $${perDay.toFixed(2)} a day`);
  ok("the prompt stays under two thousand tokens", promptTokens < 2000, promptTokens);
  ok("a script costs well under a cent", perScript < 0.01, perScript);
  ok("four thousand a day is under ten dollars", perDay < 10, perDay);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:call-script is a script", typeof pkg.scripts?.["check:call-script"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:call-script"));
  ok("the schema carries ProspectCallScript with a unique prospectId and the hash", /model ProspectCallScript \{[\s\S]*prospectId String @unique[\s\S]*inputHash\s+String[\s\S]*crawledAt\s+DateTime\?/.test(read("prisma/schema.prisma")));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
