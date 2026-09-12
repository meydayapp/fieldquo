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
// ══ Version 2 (section 7) ═════════════════════════════════════════════════
//
// The owner's two corrections on the first live script — it must sound like
// a person, and it must be about THIS company — are executed: the voice lint
// is fired at his opener and at the model's, the prompt is read for the one
// style example and each rule, page excerpts and inferences are shown to
// reach the prompt, citations are verified against the material, and the
// handler is driven through its one retry with a scripted model.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The hash comparison, the lane gate and the screen's conditional were each
// broken on disk, confirmed to fail here, and restored from a `cp` backup —
// never `git checkout`. Section 7's lint and citation rules likewise.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CALL_SCRIPT_AI_AREA,
  CALL_SCRIPT_LIMITS,
  CALL_SCRIPT_NEXT_STEP,
  CALL_SCRIPT_STYLE_EXAMPLE,
  CALL_SCRIPT_STYLE_RULES,
  CALL_SCRIPT_SYSTEM,
  CALL_SCRIPT_VERSION,
  REGISTER,
  SCRIPT_LANGUAGES,
  callScriptCurrent,
  callScriptInputHash,
  callScriptInputs,
  callScriptPrompt,
  callScriptSchema,
  citationSources,
  defaultScriptLanguage,
  normalizeScriptLanguage,
  validateCallScript,
} from "@/lib/sales/intel/callScript";
import { MAX_CHARS_PER_PAGE, MAX_EXCERPT_CHARS, integerInWords, ratingInWords, selectPageExcerpts } from "@/lib/sales/intel/pageExcerpts";
import { ASK_TIME_GUARDS, HARD_MAX_WORDS, MAX_WORDS, askTimeGuardHit, hasFiniteVerb, lintSentence, longSentences, voiceLint, voiceRetryNote, wordCount } from "@/lib/sales/scriptVoice";
import { generateCallScript } from "@/lib/sales/pipeline/handlers/generateCallScript";
import { ON_DEMAND_PER_HOUR, ON_DEMAND_REF_PREFIX, scriptRowStale } from "@/lib/sales/scriptOnDemand";
import { rememberScriptLanguage, rememberedScriptLanguage, scriptLanguageKey } from "@/lib/sales/scriptLanguageMemory";
import { LANGUAGES } from "@/app/i18n/languages";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";
import { AI_FAILURE } from "@/lib/ai/provider";
import { estimateCostMicros, hasKnownPricing } from "@/lib/ai/usage";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/ai/platformUsage";
import { handleGenerateCallScript, loadCallScriptInputs } from "@/lib/sales/pipeline/handlers/generateCallScript";
import { loadBriefInputs } from "@/lib/sales/pipeline/handlers/generateResearchBrief";
import { HANDLER_MODULES } from "@/lib/sales/pipeline/handlers/index";
import { getHandler, isPlaceholder } from "@/lib/sales/pipeline/registry";
import { PROVIDER_BY_KIND, TASK_KINDS } from "@/lib/sales/pipeline/kinds";
import { CLAIMED_TAIL, NEXT_STAGE, advanceChain, nextStageFor } from "@/lib/sales/pipeline/chain";
import { CLAIMED_NOT_BEFORE } from "@/lib/sales/pipeline/priority";
import { RESEARCH_CHAIN, researchPlan } from "@/lib/sales/pipeline/research";
import { STAGES } from "@/lib/sales/pipeline/progress";
import { composeBrief } from "@/lib/sales/intel/brief";
import { SITE_INFERENCE_VERSION } from "@/lib/sales/intel/siteInference";

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
  // No day and no time: rule 7 in lib/sales/scriptVoice.js refuses "on
  // Thursday" now, which the first fixture said and the lint let through.
  closeAsk: "Can I show you in fifteen minutes how it works for a business like yours? What works better for you, mornings or afternoons?",
  doNotSay: ["Do not mention their reviews — nothing was looked at.", "Do not claim to know how many trucks they run."],
});

/** A scripted database: the models the handler and the meter reach for, and
 *  nothing wider. An unscripted model throws by name. */
function stubDb(fixture = {}) {
  const rows = { prospectCallScript: [], platformAiUsage: [], platformAiBudget: [], ...fixture };
  const writes = [];
  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      // A compound unique — { prospectId_language: { prospectId, language } }
      // — is every one of its columns.
      if (k.includes("_") && v && typeof v === "object" && !(v instanceof Date) && !("in" in v) && !("gte" in v) && !("not" in v) && !("startsWith" in v)) {
        return match(row, v);
      }
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("gte" in v) return new Date(row[k]) >= new Date(v.gte);
        if ("not" in v) return row[k] !== v.not;
        if ("startsWith" in v) return typeof row[k] === "string" && row[k].startsWith(v.startsWith);
        return true;
      }
      if (v === null) return row[k] == null;
      // Existing rows predate the language column and read as "en".
      if (k === "language") return (row[k] || "en") === v;
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
  ok("…and the claimed lane's table is the site-inference detour plus this tail", JSON.stringify(CLAIMED_TAIL) === JSON.stringify({ CALCULATE_LEAD_SCORE: "INFER_FROM_SITE", INFER_FROM_SITE: "GENERATE_RESEARCH_BRIEF", GENERATE_RESEARCH_BRIEF: "GENERATE_CALL_SCRIPT" }), CLAIMED_TAIL);

  // Executed: the brief settling on each lane.
  const created = [];
  const fakeDb = { salesPipelineTask: { async findUnique() { return null; }, async create({ data }) { created.push(data); return { ...data, id: "x", createdAt: NOW }; } } };
  const backlog = await advanceChain({ kind: "GENERATE_RESEARCH_BRIEF", db: fakeDb, task: { id: "b", prospectId: "p", payload: { prospectId: "p", priority: "backlog", phrase: false } } });
  ok("a backlog brief queues nothing after it", backlog.reason === "end_of_chain" && created.length === 0, backlog);
  const claimed = await advanceChain({ kind: "GENERATE_RESEARCH_BRIEF", db: fakeDb, task: { id: "b", prospectId: "p", payload: { prospectId: "p", priority: "claimed" } } });
  ok("a claimed brief queues the script", claimed.queued === "GENERATE_CALL_SCRIPT" && created[0]?.kind === "GENERATE_CALL_SCRIPT", claimed);
  ok("…in the claimed lane, ahead of the backlog", created[0]?.payload?.priority === "claimed" && created[0]?.notBefore === CLAIMED_NOT_BEFORE);

  // The planner: a fully researched, claimed prospect with no script gets one.
  // The site-inference run is current in every case below, so the plan
  // reaches the script; check-site-inferences.mjs drives the inference half.
  const done = RESEARCH_CHAIN.map((k) => ({ id: k, kind: k, status: "done", createdAt: NOW }));
  const prospect = { id: "p", websiteUrl: "http://x.example/", lastCrawledAt: CRAWLED, doNotContactAt: null, campaignId: null };
  const inferenceRun = { crawledAt: CRAWLED, promptVersion: SITE_INFERENCE_VERSION };
  const plan = researchPlan({ prospect, tasks: done, priority: "claimed", script: null, inferenceRun });
  ok("ensureResearchQueued plans the script after a finished chain", plan.enqueue[0]?.kind === "GENERATE_CALL_SCRIPT", plan);
  ok("…not on the backlog lane", researchPlan({ prospect, tasks: done, priority: "backlog", script: null, inferenceRun }).skipped === "complete");
  ok("…nor when a script for this crawl exists", researchPlan({ prospect, tasks: done, priority: "claimed", script: { crawledAt: CRAWLED }, inferenceRun }).skipped === "complete");
  ok("…but again when the crawl is newer than the script",
    researchPlan({ prospect: { ...prospect, lastCrawledAt: NOW }, tasks: done, priority: "claimed", script: { crawledAt: CRAWLED }, inferenceRun: { ...inferenceRun, crawledAt: NOW } }).enqueue[0]?.kind === "GENERATE_CALL_SCRIPT");
  // The version bump reaches stored rows through the planner, not only
  // through the hash: a v1 script for the current crawl is re-queued on the
  // next claim or open, and the handler's hash check is what stops a row
  // already at v2 from being paid for twice.
  ok("…and again when the script was written by an older prompt",
    researchPlan({ prospect, tasks: done, priority: "claimed", script: { crawledAt: CRAWLED, promptVersion: "1" }, inferenceRun }).enqueue[0]?.kind === "GENERATE_CALL_SCRIPT");
  ok("…not when it is at the current version", researchPlan({ prospect, tasks: done, priority: "claimed", script: { crawledAt: CRAWLED, promptVersion: CALL_SCRIPT_VERSION }, inferenceRun }).skipped === "complete");
  // Three finished scripts are three scripts, not three failed tries: the
  // requeue bound must not count them, or the version bump never reaches a
  // prospect that has been scripted before.
  const thrice = [...done, ...[1, 2, 3].map((n) => ({ id: `s${n}`, kind: "GENERATE_CALL_SCRIPT", status: "done", createdAt: NOW }))];
  ok("…and a prospect scripted three times before is still re-queued for the new version",
    researchPlan({ prospect, tasks: thrice, priority: "claimed", script: { crawledAt: CRAWLED, promptVersion: "1" }, inferenceRun }).enqueue[0]?.kind === "GENERATE_CALL_SCRIPT");
  const failedThrice = [...done, ...[1, 2, 3].map((n) => ({ id: `f${n}`, kind: "GENERATE_CALL_SCRIPT", status: "failed", createdAt: NOW }))];
  ok("…while three failed tries still exhaust the bound", researchPlan({ prospect, tasks: failedThrice, priority: "claimed", script: null, inferenceRun }).skipped === "requeues_exhausted");
  const playbookRoute = decomment(read("app/api/sales/playbook/route.js"));
  ok("the playbook route re-queues an older-version script on open, fire-and-forget", /stored\.promptVersion !== CALL_SCRIPT_VERSION/.test(playbookRoute) && /ensureResearchQueued\(\{ db, prospectIds: \[prospectId\], priority: "claimed" \}\)/.test(playbookRoute) && !/await pipelineProgress/.test(playbookRoute));
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
  ok("…one row stored, keyed on the prospect and its default language", db.__rows.prospectCallScript.length === 1 && stored.prospectId === "p1" && stored.language === "en", stored);
  ok("…with the validated script, the model, the version, the hash and the crawl date",
    stored.script.opener === goodReply().opener && stored.model === "gpt-5-mini" && stored.promptVersion === CALL_SCRIPT_VERSION && stored.inputHash.length === 40 && stored.crawledAt === CRAWLED && stored.generatedAt === NOW, stored);
  const usage = db.__rows.platformAiUsage[0];
  ok("…and the spend is in the ledger under call_script, keyed on the task", usage?.area === CALL_SCRIPT_AI_AREA && usage.ref === "k1" && usage.prospectId === "p1" && usage.salesRepId === "rep-1", usage);
  ok("…with the language and the trigger in its meta", usage?.meta?.language === "en" && usage?.meta?.trigger === "pipeline", usage?.meta);
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

  // Every one of the first 93 stored scripts had crawledAt null: the brief's
  // prospect select never read lastCrawledAt, and the handler copied the
  // absence. Executed against a prisma that returns the column when asked.
  const asked = [];
  const readback = await loadBriefInputs({
    prospect: { async findUnique({ select }) { asked.push(select); return Object.fromEntries(Object.keys(select).map((k) => [k, k === "lastCrawledAt" ? CRAWLED : `v:${k}`])); } },
    prospectCapability: { async findMany() { return []; } },
    prospectTechnology: { async findMany() { return []; } },
    prospectInference: { async findMany() { return []; } },
    prospectOpportunity: { async findMany() { return []; } },
    prospectScore: { async findFirst() { return null; } },
  }, "p1");
  ok("the brief inputs read the prospect's lastCrawledAt", asked[0]?.lastCrawledAt === true && readback.prospect.lastCrawledAt === CRAWLED, asked[0]);
  const loader = decomment(read("lib/sales/pipeline/handlers/generateCallScript.js"));
  ok("…and the script stamps it as crawledAt", /crawledAt: rows\.prospect\.lastCrawledAt \?\? null/.test(loader));

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
  ok("the route reads the stored scripts — every language's row in one read", /db\.prospectCallScript\.findMany\(/.test(code));
  ok("…guarded on the client having the model", /typeof db\.prospectCallScript\?\.findMany === "function"/.test(code));
  ok("…returns the shown one as callScript, null when absent", /callScript: shapeScript\(shown\)/.test(code) && /return row\?\.script\s*\?/.test(code) && /: null;/.test(code));
  ok("…with the crawl date the screen prints", /crawledAt: row\.crawledAt/.test(code));
  ok("…writes nothing of its own", ![...code.matchAll(/\bdb\.(\w+)\.(create|update|upsert|delete)\w*\(/g)].length);
  ok("…and still names no vendor", !/lib\/ai\/provider|openai/i.test(code));

  const screen = read("app/components/sales/CallPlaybook.js");
  const draw = decomment(screen);
  ok("the screen has the generated block", /function AiScript\(/.test(draw));
  // Two shapes now — the stacked card and the console's numbered steps —
  // and both are drawn only inside the same `data.callScript ?` branch.
  ok("…drawn only when the route returned one", /\{data\.callScript \? \(\s*layout === "console" \? \(\s*<ConsoleScript script=\{data\.callScript\}[\s\S]{0,120}<AiScript script=\{data\.callScript\}/.test(draw));
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
  ok("the schema carries ProspectCallScript, unique per prospect AND language, with the hash", /model ProspectCallScript \{[\s\S]*?prospectId String\n[\s\S]*?language String @default\("en"\)[\s\S]*?inputHash\s+String[\s\S]*?crawledAt\s+DateTime\?[\s\S]*?@@unique\(\[prospectId, language\]\)/.test(read("prisma/schema.prisma")));
  ok("…and the old single-column unique is gone — the compound one replaces it", !/prospectId String @unique/.test(read("prisma/schema.prisma").match(/model ProspectCallScript \{[\s\S]*?\n\}/)[0]));
  ok("PlatformAiUsage carries meta for the language and the trigger", /model PlatformAiUsage \{[\s\S]*?meta Json\?/.test(read("prisma/schema.prisma")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Version 2 — it sounds like a person, and it is about THIS company");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner read the first live script for South County Electric and rewrote
// the opener by hand: "missing prepositions and sentence structure that make
// it sound natural and human. We are not pitching to robots." Then: "shouldn't
// the SCRIPT be unique to this company, based on the information found and
// what is inferred?" Two corrections, one version bump. Both are executed
// here: the lint is fired at his sentence and at the model's, the prompt is
// read for the rules and the example, and the handler is driven through the
// one retry with a scripted model.

// The two sentences, verbatim. The model's is what shipped for a real
// prospect; the owner's is the register.
const MODEL_OPENER =
  "Hi — is that South County Electric, LLC? Daniel here, from FieldQuo. I've been through your " +
  "website and it's about what happens after somebody's read it rather than about the site itself. " +
  "Is this a good time?";

{
  ok("the prompt version moved to 2", CALL_SCRIPT_VERSION === "2");
  const inputs = callScriptInputs(fixtureInputs());
  ok("…and the version is inside the hashed inputs, so every stored v1 script regenerates on its next open",
    inputs.version === "2" && callScriptInputHash(inputs) !== callScriptInputHash({ ...inputs, version: "1" }));
  ok("a stored v1 script is not current, whatever its hash",
    !callScriptCurrent({ inputHash: callScriptInputHash(inputs), promptVersion: "1" }, { inputHash: callScriptInputHash(inputs) }));

  // ── The lint, fired at the sentences it was built for ──────────────────
  const owner = voiceLint({ opener: CALL_SCRIPT_STYLE_EXAMPLE });
  ok("the owner's opener passes the voice lint", owner.ok, owner.findings);
  const model = voiceLint({ opener: MODEL_OPENER });
  ok("the model's opener fails it", !model.ok, model);
  ok("…on \"rather than\"", model.problems.includes("rather_than"));
  ok("…and on a fragment with no verb (\"Daniel here, from FieldQuo.\")", model.problems.includes("no_finite_verb"), model.findings);
  const words = (n) => `${Array.from({ length: n }, () => "word").join(" ")}.`;
  ok(`a sentence over ${HARD_MAX_WORDS} words fails`, lintSentence(words(HARD_MAX_WORDS + 1)).includes("too_long"));
  // Measured on the owner's own prospect: the first two live v2 drafts were
  // both refused, paid for, on a thirty-one-word sentence and a few verbs
  // the list did not know. Thirty is asked for and quoted back on the
  // retry; only past forty is the script thrown away.
  ok(`…but one of ${MAX_WORDS + 5} is advice on the retry, not a refusal`, !lintSentence(words(MAX_WORDS + 5)).includes("too_long") && longSentences({ whyThemNow: `I am here. ${words(MAX_WORDS + 5)}` }).length === 1);
  ok("…and the retry note quotes it", /35 words; split it/.test(voiceRetryNote({ findings: [{ field: "opener", sentence: "x rather than y", problems: ["rather_than"] }] }, { long: longSentences({ whyThemNow: words(35) }) })));
  ok("the rep's don'ts may be fragments — they are not read aloud", voiceLint({ ...goodReply(), doNotSay: ["Their crew size: unknown.", "Nothing about their reviews."] }).ok);
  ok("…but what the rep says may not", !voiceLint({ ...goodReply(), whatWeSaw: ["An enquiry form, no booking button."] }).ok);
  ok("a sentence about what the site does passes", ["The site lists residential and commercial work.", "Your site offers emergency call-outs.", "The about page names Mike Sousa as the owner."].every((x) => lintSentence(x).length === 0));
  ok("…and the owner's longest sentence is under the bound", wordCount("I'm calling because I've been through your website and we noticed a few things that are missing that could help you bring in more clients and book more jobs.") <= MAX_WORDS);
  ok("\"that's not why I called\" fails", lintSentence("That's not why I called.").includes("not_why_i_called") && lintSentence("That is not why I am calling.").includes("not_why_i_called"));
  ok("\"put that button on the site\" fails", lintSentence("Fifteen minutes and I'll put that button on the site you already have.").includes("put_that_button"));
  ok("a two-word interjection is not a fragment", lintSentence("Thanks.").length === 0 && lintSentence("Sure thing.").length === 0);
  ok("a question with a verb passes", lintSentence("Who answers when the phone rings on a Saturday?").length === 0);
  ok("the lint walks every field of a script and names where", (() => {
    const r = voiceLint({ ...goodReply(), objections: [{ they: "No.", you: "Not a compliment rather than a reason." }, goodReply().objections[1]] });
    return !r.ok && r.findings.some((f) => f.field === "objections[0].you" && f.problems.includes("rather_than"));
  })());
  ok("…but not the citations, which are quotes", voiceLint({ ...goodReply(), citations: [{ field: "opener", quote: "Family owned since 1998", sourceUrl: "x" }] }).ok);
  ok("the retry note quotes the failing sentence and the rule", /rather than/.test(voiceRetryNote(model)) && /PREVIOUS DRAFT/.test(voiceRetryNote(model)));
  ok("…and is empty when nothing failed", voiceRetryNote(owner) === "");

  // ── The prompt carries the rules the lint enforces ─────────────────────
  const prompt = callScriptPrompt(inputs);
  ok("the prompt quotes the owner's opener as the ONE example", prompt.includes(CALL_SCRIPT_STYLE_EXAMPLE) && (prompt.match(/HOW IT HAS TO SOUND/g) || []).length === 1);
  for (const rule of CALL_SCRIPT_STYLE_RULES) ok(`the prompt states: "${rule.slice(0, 48)}…"`, prompt.includes(rule));
  ok("…contractions, complete sentences, one idea per sentence, plain verbs", /contractions/i.test(prompt) && /Complete sentences/.test(prompt) && /One idea per sentence/.test(prompt) && /bring in, book, get paid/.test(prompt));
  ok("…no \"rather than\", no \"that's not why I called\"", /Never say "rather than"/.test(prompt) && /that's not why I called/.test(prompt));
  ok("…benefit before feature", /Say the benefit before any feature/.test(prompt));
  ok("…the rep's first name, from SalesRep", /The rep's first name: Dana/.test(callScriptPrompt(callScriptInputs({ ...fixtureInputs(), repName: "Dana Whitfield" }))));
  ok("…the next step is the fifteen-minute demo, never building anything", prompt.includes(CALL_SCRIPT_NEXT_STEP) && /Never offer to build, install, set up or put anything on their website/.test(prompt));
  ok("…and no day or time in the close", /No day of the week and no clock time/.test(prompt) && /mornings or afternoons/.test(prompt));
  ok("the system prompt says it is spoken, in the language the notes name", /Spoken language, as a person talks, in the language the notes name/.test(CALL_SCRIPT_SYSTEM));

  // ── The company material: pages, inferences, directory facts ───────────
  const pages = [
    { type: "page_content", sourceUrl: "https://x.example/contact", normalizedValue: "https://x.example/contact", rawValue: "Call us. Email us. " + "Contact form. ".repeat(20) },
    { type: "page_content", sourceUrl: "https://x.example/", normalizedValue: "https://x.example/", rawValue: "Welcome to Richmond Rolloff. " + "We deliver bins across Richmond and Delta. ".repeat(40) },
    { type: "page_content", sourceUrl: "https://x.example/about-us", normalizedValue: "https://x.example/about-us", rawValue: "Family owned since 1998, Richmond Rolloff is run by Mike and Dana Sousa. " + "We answer the phone ourselves. ".repeat(60) },
    { type: "page_content", sourceUrl: "https://x.example/services", normalizedValue: "https://x.example/services", rawValue: "Same-day bin delivery for renovations and roofing tear-offs. " + "Sizes from ten to forty yards. ".repeat(60) },
    { type: "link", sourceUrl: "https://x.example/", rawValue: JSON.stringify({ href: "/about-us", text: "About" }) },
  ];
  const excerpts = selectPageExcerpts(pages);
  ok("the about page is served first, then services, then home, then contact", excerpts.map((p) => p.url).join(" ") === "https://x.example/about-us https://x.example/services https://x.example/ https://x.example/contact", excerpts.map((p) => p.url));
  ok(`…each page capped at ${MAX_CHARS_PER_PAGE} and the lot under ${MAX_EXCERPT_CHARS}`, excerpts.every((p) => p.text.length <= MAX_CHARS_PER_PAGE) && excerpts.reduce((n, p) => n + p.text.length, 0) <= MAX_EXCERPT_CHARS);
  ok("…only page_content rows count", !excerpts.some((p) => /About/.test(p.text) && p.text.startsWith("{")));
  ok("…and nothing crawled is an empty list, never a placeholder", selectPageExcerpts([]).length === 0 && selectPageExcerpts(null).length === 0);
  ok("a rating is spelled out, not written as a digit", ratingInWords(4.8) === "four point eight" && ratingInWords(5) === "five" && integerInWords(37) === "thirty-seven" && integerInWords(1250) === "one thousand two hundred and fifty");

  const rich = callScriptInputs({
    ...fixtureInputs(),
    repName: "Dana Whitfield",
    pages: excerpts,
    inferences: [{ kind: "trade", value: "junk_removal" }, { kind: "crew_size", value: "two_to_five" }],
    prospect: { ...PROSPECT, googleRating: 4.8, googleReviewCount: 37 },
  });
  const richPrompt = callScriptPrompt(rich);
  ok("the prompt carries the page text under their own website", /WHAT THEIR OWN WEBSITE SAYS/.test(richPrompt) && /Mike and Dana Sousa/.test(richPrompt));
  ok("…every inference by kind, generically", /crew size: two_to_five/.test(richPrompt) && /trade: junk_removal/.test(richPrompt));
  ok("…the trade, the town, the rating in words, the source", /Trade: junk removal/.test(richPrompt) && /Where: Richmond, BC/.test(richPrompt) && /four point eight out of five, from thirty-seven reviews/.test(richPrompt) && /Listed by: overture/.test(richPrompt));
  ok("…and no digit reaches the prompt from the directory facts", !/\d/.test(JSON.stringify(rich.facts)));
  ok("…and REQUIRES a cited detail in the opener and whyThemNow", /must EACH use at least one specific detail/.test(richPrompt) && /citations: for every such detail/.test(richPrompt));
  ok("with nothing crawled the prompt says so and asks for an empty citations list", /THEIR WEBSITE TEXT: none was read/.test(prompt) && /citations: an empty list/.test(prompt));
  ok("the page text changes the hash — a new crawl regenerates", callScriptInputHash(rich) !== callScriptInputHash(callScriptInputs({ ...fixtureInputs(), repName: "Dana Whitfield" })));
  ok("the schema carries citations, still strict, still no numbers", (() => { const s = callScriptSchema(); return s.required.includes("citations") && assertStrictSchema(s).ok && !/"type":"(number|integer)"/.test(JSON.stringify(s)); })());
  ok("a citation with no quote is refused at validation", validateCallScript({ ...goodReply(), citations: [{ field: "opener", quote: "", sourceUrl: "" }] }).problems.includes("bad_citation"));
  ok("…and a quote may carry the source's digits", validateCallScript({ ...goodReply(), citations: [{ field: "opener", quote: "since 1998", sourceUrl: "x" }] }).ok);

  // ── Citations verified against the material ────────────────────────────
  const sources = citationSources(rich);
  ok("the sources are the pages and the inference lines", sources.length === excerpts.length + 2 && sources.some((s) => s.url === "inference"));
  const cited = {
    ...goodReply(),
    opener: "Hi — is that Richmond Rolloff? My name's Dana and I'm from FieldQuo. I saw on your site that it's family owned and run by Mike and Dana Sousa.",
    whyThemNow: "You do same-day bin delivery, and the site still asks people to phone for it. That's the gap I wanted to show you.",
    citations: [
      { field: "opener", quote: "Family owned since 1998, Richmond Rolloff is run by Mike and Dana Sousa", sourceUrl: "https://x.example/about-us" },
      { field: "whyThemNow", quote: "Same-day bin delivery", sourceUrl: "https://x.example/services" },
    ],
  };
  ok("a script that cites real words from the material passes", voiceLint(cited, { sources }).ok, voiceLint(cited, { sources }).findings);
  ok("a script that cites nothing, when there was material, fails on no_citation", voiceLint({ ...cited, citations: [] }, { sources }).problems.includes("no_citation"));
  ok("a quote that is not in the material fails on citation_not_in_source", voiceLint({ ...cited, citations: [{ field: "opener", quote: "twenty trucks and a yard in Surrey", sourceUrl: "x" }, cited.citations[1]] }, { sources }).problems.includes("citation_not_in_source"));
  ok("a citation attached to a field that never uses it does not count", !voiceLint({ ...cited, opener: goodReply().opener }, { sources, ignoreWords: ["Richmond Rolloff Container Service"] }).ok);
  ok("…and the business's own name, shared by every page and every opener, is not a use", !voiceLint({ ...cited, opener: "Hi — is that Richmond Rolloff? My name's Sam and I'm from FieldQuo." }, { sources, ignoreWords: ["Richmond Rolloff Container Service"] }).ok);
  ok("with no material at all, no citation is required", voiceLint({ ...cited, citations: [] }, { sources: [] }).ok);

  // ── The handler, executed: retry once, then store or refuse ────────────
  const richRows = () => ({ ...fixtureInputs(), repName: "Dana Whitfield", pages: excerpts, inferences: [{ kind: "trade", value: "junk_removal" }], prospect: { ...PROSPECT, googleRating: 4.8, googleReviewCount: 37 } });
  {
    const db = stubDb();
    const prompts = [];
    const complete = async ({ prompt: p, onUsage }) => {
      prompts.push(p);
      await onUsage({ model: "gpt-5-mini", promptTokens: 3000, completionTokens: 700 });
      // First draft: the model's robotic opener, no citations. Second: cited and human.
      return { ok: true, data: prompts.length === 1 ? { ...goodReply(), opener: MODEL_OPENER } : cited };
    };
    const res = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "v2-a", db, now: NOW, deps: { loadInputs: async () => richRows(), complete } });
    ok("a first draft that fails the lint is asked for once more", prompts.length === 2 && res.done === true, res);
    ok("…with the failing sentences quoted back", /YOUR PREVIOUS DRAFT DID NOT SOUND LIKE A PERSON/.test(prompts[1]) && /rather than/.test(prompts[1]));
    ok("…both calls metered, the retry under its own ref", db.__rows.platformAiUsage.length === 2 && db.__rows.platformAiUsage[1].ref === "v2-a:retry", db.__rows.platformAiUsage.map((u) => u.ref));
    ok("…the second draft stored, with its citations and version 2", db.__rows.prospectCallScript[0]?.script.citations.length === 2 && db.__rows.prospectCallScript[0].promptVersion === "2");
    ok("…and the note says it was the second draft and what it cites", /second draft/.test(res.note) && /cites 2 detail/.test(res.note), res.note);
  }
  {
    const db = stubDb();
    let asked = 0;
    const complete = async ({ onUsage }) => { asked++; await onUsage({ model: "gpt-5-mini", promptTokens: 3000, completionTokens: 700 }); return { ok: true, data: { ...goodReply(), opener: MODEL_OPENER } }; };
    const res = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "v2-b", db, now: NOW, deps: { loadInputs: async () => richRows(), complete } });
    ok("a second failure is terminal — not paid for a third time, nothing stored", asked === 2 && res.done === false && res.retry === false && /voice/.test(res.reason) && db.__rows.prospectCallScript.length === 0, res);
    ok("…and both spends are in the ledger", db.__rows.platformAiUsage.length === 2);
  }
  {
    const db = stubDb();
    let asked = 0;
    const complete = async ({ onUsage }) => { asked++; await onUsage({ model: "gpt-5-mini", promptTokens: 1400, completionTokens: 700 }); return { ok: true, data: goodReply() }; };
    const res = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "v2-c", db, now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
    ok("with nothing crawled a plain, uncited script is stored on the first draft and the note says generic", asked === 1 && res.done === true && /generic/.test(res.note), res);
  }
  {
    const db = stubDb();
    const complete = async ({ onUsage }) => { await onUsage({ model: "gpt-5-mini", promptTokens: 3000, completionTokens: 700 }); return { ok: true, data: cited }; };
    const res = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "v2-d", db, now: NOW, deps: { loadInputs: async () => richRows(), complete } });
    ok("a cited, human first draft is stored on the first call", res.done === true && !/second draft/.test(res.note) && db.__rows.platformAiUsage.length === 1);
  }

  // ── loadCallScriptInputs, executed against a scripted prisma ───────────
  {
    const asked = [];
    const prisma = {
      prospect: { async findUnique({ select }) { asked.push(Object.keys(select).join(",")); return Object.fromEntries(Object.keys(select).map((k) => [k, k === "lastCrawledAt" ? CRAWLED : k === "assignedRepId" ? "rep-1" : k === "googleRating" ? 4.8 : k === "googleReviewCount" ? 37 : k === "id" ? "p1" : `v:${k}`])); } },
      prospectCapability: { async findMany() { return []; } },
      prospectTechnology: { async findMany() { return []; } },
      prospectInference: { async findMany() { return [{ kind: "trade", value: "junk_removal", evidenceIds: [], source: "derived" }]; } },
      prospectOpportunity: { async findMany() { return []; } },
      prospectScore: { async findFirst() { return null; } },
      salesRep: { async findUnique({ where }) { asked.push(`salesRep:${where.id}`); return { name: "Dana Whitfield" }; } },
      prospectEvidence: { async findMany({ where }) { asked.push(`evidence:${where.type}`); return pages; } },
    };
    const rows = await loadCallScriptInputs(prisma, "p1", { assemble: async () => ({ found: true, selection: { selected: null }, script: { stages: [] }, objections: [], unchecked: [] }) });
    ok("the loader reads the rep's name by the prospect's assignedRepId", asked.includes("salesRep:rep-1") && rows.repName === "Dana Whitfield");
    ok("…the page_content evidence rows, chosen and capped", asked.includes("evidence:page_content") && rows.pages.length === 4 && rows.pages[0].url.endsWith("/about-us"));
    ok("…every inference row", rows.inferences.length === 1 && rows.inferences[0].kind === "trade");
    ok("…and the directory rating on the prospect", rows.prospect.googleRating === 4.8 && rows.prospect.googleReviewCount === 37);
    const inputs2 = callScriptInputs(rows);
    ok("…which reach the prompt", /Dana/.test(callScriptPrompt(inputs2)) && /four point eight/.test(callScriptPrompt(inputs2)) && /Mike and Dana Sousa/.test(callScriptPrompt(inputs2)));
  }

  // ── The screen prints the citations ────────────────────────────────────
  const draw = decomment(read("app/components/sales/CallPlaybook.js"));
  ok("the screen prints the citations under their own heading, only when there are any", /script\.citations\?\.length \?/.test(draw) && /aiScriptCitations/.test(draw));
  ok("…keyed in nine languages", (read("app/i18n/appMessages.js").match(/"app\.salesCall\.aiScriptCitations":/g) || []).length === 9);

  // ── What the rewrite costs ─────────────────────────────────────────────
  const promptTokens = Math.ceil((richPrompt.length + 400) / 4);
  const completionTokens = Math.ceil(JSON.stringify(cited).length / 4) + 400;
  const micros = estimateCostMicros({ model: "gpt-5-mini", promptTokens, completionTokens });
  const perScript = micros / 1_000_000;
  const plain = Math.ceil((prompt.length + 400) / 4);
  console.log(`  v2 prompt with the site read: ${richPrompt.length} chars ≈ ${promptTokens} tokens (v1-shaped prompt ≈ ${plain}; the page text adds ≈ ${promptTokens - plain}); ≈ $${perScript.toFixed(5)} per script, $${(perScript * 2).toFixed(5)} when the lint asks for a second draft`);
  console.log(`  regenerating every stored script once at the new version: 101 rows × $${perScript.toFixed(5)} ≈ $${(perScript * 101).toFixed(2)} (up to $${(perScript * 101 * 2).toFixed(2)} if every one needs the retry)`);
  ok("the v2 prompt with the site read stays under four thousand tokens", promptTokens < 4000, promptTokens);
  ok("…and a script still costs well under a cent", perScript < 0.01, perScript);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Three languages — English, French, Spanish");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner: "the script seems to be English only … but it should also have
// the option to be in English, French and Spanish. just in case we find
// ourselves with a French speaker in Quebec or a Latino contractor in the
// USA." One row per language; the pipeline writes the default; the others
// are written on demand by the route, metered and rate-limited; the lint
// holds every language to the same rules, with the day/clock guard the
// coordinator noted was missing even in English.

{
  ok("the three languages", SCRIPT_LANGUAGES.join(",") === "en,fr,es");
  ok("…each with a native name in the portal's list, for the switch", SCRIPT_LANGUAGES.every((c) => LANGUAGES.find((l) => l.code === c)?.nativeName));
  ok("normalising: fr-CA → fr, ES → es, de → null, junk → null", normalizeScriptLanguage("fr-CA") === "fr" && normalizeScriptLanguage("ES") === "es" && normalizeScriptLanguage("de") === null && normalizeScriptLanguage(42) === null);

  // ── The default rule ───────────────────────────────────────────────────
  ok("Quebec → fr, whatever the rep reads", defaultScriptLanguage({ prospect: { province: "QC" }, rep: { language: "es" } }) === "fr" && defaultScriptLanguage({ prospect: { province: "Québec" }, rep: null }) === "fr");
  ok("no province → the rep's portal language when it is one of the three", defaultScriptLanguage({ prospect: { province: null }, rep: { language: "es" } }) === "es" && defaultScriptLanguage({ prospect: {}, rep: { language: "fr" } }) === "fr");
  ok("…and en when it is not (German, null, junk)", defaultScriptLanguage({ prospect: {}, rep: { language: "de" } }) === "en" && defaultScriptLanguage({ prospect: {}, rep: { language: null } }) === "en" && defaultScriptLanguage({}) === "en");
  ok("New Brunswick has no required language, so the rep's counts", defaultScriptLanguage({ prospect: { province: "NB" }, rep: { language: "fr" } }) === "fr");
  ok("everywhere else is sold in English, so English — the lead rule outranks the rep's portal", defaultScriptLanguage({ prospect: { province: "TX" }, rep: { language: "es" } }) === "en" && defaultScriptLanguage({ prospect: { province: "ON" }, rep: { language: "fr" } }) === "en");

  // ── The prompt, per language ───────────────────────────────────────────
  const en = callScriptPrompt(callScriptInputs({ ...fixtureInputs(), language: "en" }));
  const fr = callScriptPrompt(callScriptInputs({ ...fixtureInputs(), language: "fr" }));
  const es = callScriptPrompt(callScriptInputs({ ...fixtureInputs(), language: "es" }));
  ok("the language parameter is honoured — the prompt opens with it", /^LANGUAGE: English\./.test(en) && /^LANGUAGE: Quebec French\./.test(fr) && /^LANGUAGE: Latin-American Spanish\./.test(es));
  ok("…and closes with it", en.endsWith("English.") && fr.endsWith("Quebec French.") && es.endsWith("Latin-American Spanish."));
  ok("the French prompt carries the Quebec register: vous, soumission, cellulaire, no tu, no devis", /"vous", never "tu"/.test(fr) && /"soumission", never a "devis"/.test(fr) && /cellulaire/.test(fr));
  ok("…and the Spanish one: usted, no vosotros, celular not móvil, cotización", /"Usted" throughout, never "tú" and never "vosotros"/.test(es) && /"celular"/.test(es) && /cotización/.test(es));
  ok("…the English one carries neither and is otherwise the same prompt", !/soumission|usted/i.test(en) && REGISTER.en.rules.length === 0);
  ok("every register's rules say no day and no clock time", ["fr", "es"].every((l) => REGISTER[l].rules.some((r) => /No day of the week and no clock time/.test(r))) && CALL_SCRIPT_STYLE_RULES.some((r) => /No day of the week and no clock time/.test(r)));
  ok("the owner's example stays the ONE example in every language, with the register asked for around it", [en, fr, es].every((p) => p.includes(CALL_SCRIPT_STYLE_EXAMPLE)) && /Write the SAME register in Quebec French/.test(fr) && /Write the SAME register in Latin-American Spanish/.test(es));
  ok("quotes stay in the site's language — the fr/es prompts say copy, never translate", (() => { const rich = { ...fixtureInputs(), pages: [{ url: "https://x.example/about", text: "Family owned since the nineties." }] }; return /copy it, never translate it/.test(callScriptPrompt(callScriptInputs({ ...rich, language: "fr" }))) && !/never translate/.test(callScriptPrompt(callScriptInputs({ ...rich, language: "en" }))); })());
  ok("the language is in the inputs and so in the hash — one hash per language", callScriptInputs({ ...fixtureInputs(), language: "fr" }).language === "fr" && callScriptInputHash(callScriptInputs({ ...fixtureInputs(), language: "fr" })) !== callScriptInputHash(callScriptInputs({ ...fixtureInputs(), language: "en" })));
  ok("the schema is identical across languages — same keys, no language field in the reply", JSON.stringify(callScriptSchema()) === JSON.stringify(callScriptSchema()) && !callScriptSchema().required.includes("language"));

  // ── Rule 7: no day, no clock time in the ask — by word, in all three ───
  const refused = ["tomorrow at ten", "Tuesday at 2", "demain à dix heures", "mañana a las diez", "at ten o'clock", "half past nine", "vers midi", "al mediodía", "le lundi matin", "el martes", "See you Thursday.", "à huit heures et demie", "a las ocho y media"];
  for (const ask of refused) ok(`the ask guard refuses "${ask}"`, askTimeGuardHit(ask) !== null);
  const allowed = ["What works better for you, mornings or afternoons?", "Qu'est-ce qui vous convient le mieux, le matin ou l'après-midi?", "¿Qué le conviene más, las mañanas o las tardes?", "I can show you in fifteen minutes how it works.", "Je peux vous montrer ça en quinze minutes.", "Le puedo mostrar en quince minutos.", "somebody's on your site at nine at night", "¿Le va mejor por la mañana o por la tarde?", "dans une heure"];
  for (const ask of allowed) ok(`…and lets "${ask.slice(0, 50)}" through`, askTimeGuardHit(ask) === null, askTimeGuardHit(ask));
  ok("every language has a day-name guard and an hour-word guard", Object.values(ASK_TIME_GUARDS).every((g) => g.length >= 3));
  ok("the guard is applied to the ask, and the lint names it", voiceLint({ ...goodReply(), closeAsk: "Can I show you tomorrow at ten?" }).problems.includes("day_or_time"));
  ok("…and not to whyThemNow, where nine at night is when a homeowner browses", !voiceLint({ ...goodReply(), whyThemNow: "Somebody's on your site at nine at night and they can't book. That's the gap." }).problems.includes("day_or_time"));
  ok("the old fixture's ask — on Thursday — is refused now", voiceLint({ ...goodReply(), closeAsk: "Can I show you in fifteen minutes on Thursday?" }).problems.includes("day_or_time"));
  ok("the digit lint still applies in every language", ["Il y a 3 camions.", "Tienen 3 camiones."].every((l) => validateCallScript({ ...goodReply(), whyThemNow: l }).problems.includes("digits")));

  // ── The finite-verb list, per language ─────────────────────────────────
  const frSentences = ["Bonjour — c'est bien Électricité Rive-Sud? Je m'appelle Daniel et je suis chez FieldQuo.", "On a remarqué qu'il n'y a pas de façon de demander une soumission en ligne.", "Avez-vous quelques minutes pour que je vous montre comment?", "Qui répond au cellulaire quand vous êtes sur un chantier?", "Votre site parle surtout de rénovations résidentielles."];
  const esSentences = ["Hola, ¿hablo con South County Electric? Me llamo Daniel y soy de FieldQuo.", "Vimos que no hay forma de pedir una cotización en línea.", "¿Tiene unos minutos para que le muestre cómo?", "Su sitio se enfoca en trabajos residenciales.", "Revisé su sitio web antes de llamar."];
  ok("French sentences with a verb pass the French list", frSentences.every((x) => hasFiniteVerb(x, { language: "fr" })), frSentences.filter((x) => !hasFiniteVerb(x, { language: "fr" })));
  ok("Spanish sentences with a verb pass the Spanish list", esSentences.every((x) => hasFiniteVerb(x, { language: "es" })), esSentences.filter((x) => !hasFiniteVerb(x, { language: "es" })));
  ok("…and the English list would have failed them — the lists are per language", !hasFiniteVerb(frSentences[1], { language: "en" }) && !hasFiniteVerb(esSentences[1], { language: "en" }));
  ok("a French fragment fails, a Spanish fragment fails", !hasFiniteVerb("Sur les chantiers de la Rive-Sud.", { language: "fr" }) && !hasFiniteVerb("Trabajos residenciales y comerciales.", { language: "es" }));
  ok("the phrase bans have their French and Spanish", lintSentence("Je vous appelle plutôt que d'écrire.", { language: "fr" }).includes("rather_than") && lintSentence("Lo llamo en lugar de escribir.", { language: "es" }).includes("rather_than"));
  ok("an accented word counts as a word", wordCount("à é ç") === 3);

  // ── Citations across languages: the quote is verbatim, the overlap is not pretended ─
  const material = [{ url: "https://x.example/about", text: "Family owned since 1998, Richmond Rolloff is run by Mike and Dana Sousa. We answer the phone ourselves." }];
  const frScript = { ...goodReply(), opener: "Bonjour — c'est bien Richmond Rolloff? Je m'appelle Dana et je suis chez FieldQuo. J'ai vu sur votre site que c'est une entreprise familiale.", whyThemNow: "Vous répondez au téléphone vous-mêmes, et le site demande encore aux gens d'appeler. C'est ça que je veux vous montrer.", closeAsk: "Est-ce que je peux vous montrer ça en quinze minutes? Qu'est-ce qui vous convient le mieux, le matin ou l'après-midi?", threeQuestions: ["Comment les demandes arrivent-elles aujourd'hui?", "Qui répond quand vous êtes sur un chantier?", "Est-ce que vous lisez vos avis quelque part?"], objections: [{ they: "On utilise déjà Jobber.", you: "C'est correct. La question, c'est si un client peut réserver sans vous appeler." }, { they: "Envoyez-moi un courriel.", you: "Avec plaisir. Qu'est-ce qui vaudrait la peine d'être ouvert?" }], whatWeSaw: ["Il y a un formulaire de contact sur le site.", "Il n'y a pas de façon de réserver en ligne."], doNotSay: ["Ne parlez pas de leurs avis — rien n'a été regardé."], citations: [{ field: "opener", quote: "Family owned since 1998", sourceUrl: "https://x.example/about" }, { field: "whyThemNow", quote: "We answer the phone ourselves", sourceUrl: "https://x.example/about" }] };
  const frLint = voiceLint(frScript, { sources: material, language: "fr" });
  ok("a French script citing English words verbatim passes — the quote is the site's, unchanged", frLint.ok, frLint.findings);
  ok("…a translated quote — not in the material — still fails", voiceLint({ ...frScript, citations: [{ field: "opener", quote: "entreprise familiale depuis 1998", sourceUrl: "x" }, frScript.citations[1]] }, { sources: material, language: "fr" }).problems.includes("citation_not_in_source"));
  ok("…and no citation at all still fails", voiceLint({ ...frScript, citations: [] }, { sources: material, language: "fr" }).problems.includes("no_citation"));
  ok("in English the shared-word half still applies (the French script read as English fails on it)", !voiceLint(frScript, { sources: material, language: "en" }).ok);

  const esScript = { ...goodReply(), opener: "Hola, ¿hablo con Richmond Rolloff? Me llamo Dana y soy de FieldQuo. Vi en su sitio que es un negocio familiar.", whyThemNow: "Ustedes contestan el teléfono personalmente, y el sitio todavía le pide a la gente que llame. Eso es lo que quiero mostrarle.", closeAsk: "¿Le puedo mostrar en quince minutos cómo funciona para un negocio como el suyo? ¿Qué le conviene más, las mañanas o las tardes?", threeQuestions: ["¿Cómo le llegan los pedidos hoy?", "¿Quién contesta cuando usted está en una obra?", "¿Lee sus reseñas en algún lado?"], objections: [{ they: "Ya usamos Jobber.", you: "Está bien. La pregunta es si un cliente puede reservar sin llamarle." }, { they: "Mándeme un correo.", you: "Con gusto. ¿Qué haría que valiera la pena abrirlo?" }], whatWeSaw: ["Hay un formulario de contacto en el sitio.", "No hay forma de reservar en línea."], doNotSay: ["No mencione sus reseñas: nadie las revisó."], citations: [{ field: "opener", quote: "Family owned since 1998", sourceUrl: "https://x.example/about" }, { field: "whyThemNow", quote: "We answer the phone ourselves", sourceUrl: "https://x.example/about" }] };
  const esLint = voiceLint(esScript, { sources: material, language: "es" });
  ok("a Spanish script passes the Spanish lint the same way", esLint.ok, esLint.findings);

  // ── The handler and the on-demand path, executed ───────────────────────
  const frReply = () => frScript;
  {
    // The pipeline writes the default language — Quebec → fr — and nothing else.
    const db = stubDb();
    const prompts = [];
    const complete = async ({ prompt: p, onUsage }) => { prompts.push(p); await onUsage({ model: "gpt-5-mini", promptTokens: 1500, completionTokens: 800 }); return { ok: true, data: /LANGUAGE: Quebec French/.test(p) ? frReply() : goodReply() }; };
    const quebec = () => ({ ...fixtureInputs(), prospect: { ...PROSPECT, province: "QC" }, defaultLanguage: "fr" });
    const res = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "l1", db, now: NOW, deps: { loadInputs: async () => quebec(), complete } });
    ok("a Quebec prospect's pipeline script is French", res.done === true && res.language === "fr" && /LANGUAGE: Quebec French/.test(prompts[0]), res);
    ok("…stored as the fr row, and only that row", db.__rows.prospectCallScript.length === 1 && db.__rows.prospectCallScript[0].language === "fr" && db.__rows.prospectCallScript[0].script.opener === frScript.opener);
    ok("…metered with language fr, trigger pipeline", db.__rows.platformAiUsage[0]?.meta?.language === "fr" && db.__rows.platformAiUsage[0]?.meta?.trigger === "pipeline");
    ok("…and the note names the language", /generated; fr;/.test(res.note), res.note);

    // A rep asks for Spanish: written on demand, metered as such, beside the French row.
    const complete2 = async ({ prompt: p, onUsage }) => { prompts.push(p); await onUsage({ model: "gpt-5-mini", promptTokens: 1500, completionTokens: 800 }); return { ok: true, data: /LANGUAGE: Latin-American Spanish/.test(p) ? esScript : goodReply() }; };
    const onDemand = await generateCallScript({ prisma: db, prospectId: "p1", language: "es", trigger: "on_demand", salesRepId: "rep-9", ref: "on_demand:rep-9:p1:es:1", now: NOW, deps: { loadInputs: async () => quebec(), complete: complete2 } });
    ok("the on-demand path writes the asked-for language", onDemand.done === true && onDemand.language === "es" && /LANGUAGE: Latin-American Spanish/.test(prompts[1]), onDemand);
    ok("…as a second row beside the French one", db.__rows.prospectCallScript.length === 2 && db.__rows.prospectCallScript.map((r) => r.language).sort().join(",") === "es,fr");
    ok("…metered under call_script with language es, trigger on_demand, the asking rep, an on_demand ref", (() => { const u = db.__rows.platformAiUsage[1]; return u?.area === CALL_SCRIPT_AI_AREA && u.meta?.language === "es" && u.meta?.trigger === "on_demand" && u.salesRepId === "rep-9" && u.ref.startsWith("on_demand:"); })(), db.__rows.platformAiUsage[1]);
    const again = await generateCallScript({ prisma: db, prospectId: "p1", language: "es", trigger: "on_demand", salesRepId: "rep-9", ref: "on_demand:rep-9:p1:es:2", now: NOW, deps: { loadInputs: async () => quebec(), complete: complete2 } });
    ok("asked again with nothing changed, the es row stands and nothing is spent", again.done === true && again.existing === true && prompts.length === 2 && db.__rows.platformAiUsage.length === 2, again);
    const frAgain = await handleGenerateCallScript({ task: task(), payload: task().payload, idempotencyKey: "l2", db, now: NOW, deps: { loadInputs: async () => quebec(), complete } });
    ok("…and the pipeline, re-run, finds its French row current", frAgain.done === true && /unchanged/.test(frAgain.note) && prompts.length === 2);
    const explicit = await handleGenerateCallScript({ task: task(), payload: { ...task().payload, language: "en" }, idempotencyKey: "l3", db, now: NOW, deps: { loadInputs: async () => quebec(), complete: complete2 } });
    ok("a task payload may name a language, and it is honoured", explicit.done === true && explicit.language === "en" && db.__rows.prospectCallScript.length === 3);
  }
  {
    // A refused on-demand generation is a refusal, not an empty row.
    const db = stubDb();
    const refusedGen = await generateCallScript({ prisma: db, prospectId: "p1", language: "fr", trigger: "on_demand", salesRepId: "rep-9", ref: "on_demand:x", now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete: async () => ({ ok: false, reason: AI_FAILURE.UNCONFIGURED }) } });
    ok("a failed on-demand generation says so and stores nothing", refusedGen.done === false && refusedGen.language === "fr" && db.__rows.prospectCallScript.length === 0, refusedGen);
    const budgeted = await generateCallScript({ prisma: db, prospectId: "p1", language: "fr", trigger: "on_demand", salesRepId: "rep-9", ref: "on_demand:y", now: NOW, deps: { loadInputs: async () => fixtureInputs(), checkBudget: async () => ({ allowed: false, reason: "daily_budget", capped: true }) } });
    ok("…and the platform budget gates the on-demand path exactly as the pipeline's", budgeted.done === false && /daily_budget/.test(budgeted.reason));
  }

  // ── The route: language param, on-demand only for a non-default, rate limit, fallback ─
  {
    const route = decomment(read("app/api/sales/playbook/route.js"));
    ok("the route reads ?language and refuses one that is not en/fr/es", /searchParams\.get\("language"\)/.test(route) && /normalizeScriptLanguage\(rawLanguage\)/.test(route) && /status: 400/.test(route));
    ok("…decides the default from the lead and the rep, through the one function", /defaultScriptLanguage\(\{ prospect: mine, rep: repRow \}\)/.test(route));
    ok("…generates on demand ONLY for a language other than the default, and only when stale", /language !== defaultLanguage && scriptRowStale\(shown/.test(route));
    ok("…through the shared generateCallScript, trigger on_demand, this rep, an on_demand ref", /generateCallScript\(\{[\s\S]*?trigger: "on_demand",[\s\S]*?salesRepId: rep\.id,[\s\S]*?ref: `\$\{ON_DEMAND_REF_PREFIX\}\$\{rep\.id\}/.test(route) && ON_DEMAND_REF_PREFIX === "on_demand:");
    ok(`…rate-limited at ${ON_DEMAND_PER_HOUR} an hour per rep, counted off the ledger's on_demand rows`, ON_DEMAND_PER_HOUR === 60 && /platformAiUsage\.count\(\{[\s\S]*?salesRepId: rep\.id[\s\S]*?ref: \{ startsWith: ON_DEMAND_REF_PREFIX \}/.test(route) && /recent >= ON_DEMAND_PER_HOUR/.test(route));
    ok("…a refused or failed generation falls back to the default language's script, with a reason", /reason: "rate_limited"/.test(route) && /reason: "generation_failed"/.test(route) && (route.match(/shown = stored;/g) || []).length >= 3);
    ok("…and the response carries scriptLanguage: current, default, leadLanguage, available, fallback, repId", /scriptLanguage: \{\s*current:[\s\S]*?default: defaultLanguage,[\s\S]*?leadLanguage: requiredLanguageFor\(mine\),[\s\S]*?available: SCRIPT_LANGUAGES,[\s\S]*?fallback,[\s\S]*?repId: rep\.id/.test(route));
    ok("…the shown script says which language it is in", /language: row\.language/.test(route));
    ok("the three-way staleness rule is the pipeline's: none, older than the crawl, older prompt", scriptRowStale(null) && scriptRowStale({ crawledAt: CRAWLED, promptVersion: CALL_SCRIPT_VERSION }, { lastCrawledAt: NOW }) && scriptRowStale({ crawledAt: NOW, promptVersion: "1" }, { lastCrawledAt: CRAWLED }) && !scriptRowStale({ crawledAt: NOW, promptVersion: CALL_SCRIPT_VERSION }, { lastCrawledAt: CRAWLED }));
    ok("the pipeline's staleness rule reads the DEFAULT language's row", /defaultScriptLanguage\(\{ prospect: p, rep:/.test(decomment(read("lib/sales/pipeline/research.js"))) && /\(s\.language \|\| "en"\) === wanted/.test(decomment(read("lib/sales/pipeline/research.js"))));
  }

  // ── The switch on the screen ───────────────────────────────────────────
  {
    const draw = decomment(read("app/components/sales/CallPlaybook.js"));
    ok("the screen has the switch", /function ScriptLanguageSwitch\(/.test(draw));
    ok("…labelled with each language's own name", /languageMeta\(code\)\.nativeName/.test(draw));
    ok("…one button per available language, the current one pressed", /scriptLanguage\.available\.map\(\(code\)/.test(draw) && /aria-pressed=\{active\}/.test(draw) && /data-script-language=\{code\}/.test(draw));
    ok("…drawn in both layouts, under the generated-from line", (draw.match(/\{switchProps \? <ScriptLanguageSwitch \{\.\.\.switchProps\} \/> : null\}/g) || []).length === 2 && draw.indexOf("aiScriptGeneratedNoCrawl") < draw.indexOf("{switchProps ? <ScriptLanguageSwitch"));
    ok("…and alone when there is no script yet, so pressing a language still writes one", /: switchProps \? \(\s*<ScriptLanguageSwitch/.test(draw));
    ok("…with a loading state while the other language is read", /data-script-language-loading/.test(draw) && /scriptLanguageLoading/.test(draw));
    ok("…and the fallback sentence when the route answered with the default", /data-script-language-fallback/.test(draw) && /scriptLanguageFallback/.test(draw));
    ok("…only when the panel gave it somewhere to send a choice — no dead control", /data\.scriptLanguage && onScriptLanguage/.test(draw));
    ok("the generated-from line stays", /aiScriptGenerated"/.test(draw) && /aiScriptGeneratedNoCrawl/.test(draw));
    const panel = decomment(read("app/components/sales/CallPanel.js"));
    ok("CallPanel re-reads the playbook with &language= on a choice", /&language=\$\{encodeURIComponent\(language\)\}/.test(panel) && /const changeScriptLanguage = useCallback/.test(panel));
    ok("…remembers it per rep per language-of-lead, and honours the memory on open", /rememberScriptLanguage\(next\?\.scriptLanguage, language\)/.test(panel) && /rememberedScriptLanguage\(first\?\.scriptLanguage\)/.test(panel));
    ok("…and hands the switch to both CallPlaybook renders", (panel.match(/onScriptLanguage=\{changeScriptLanguage\}/g) || []).length === 2);
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    const sl = { repId: "rep-1", leadLanguage: "fr", default: "fr" };
    ok("the memory key is per rep and per language-of-lead", scriptLanguageKey(sl) === "fieldquo-script-language:rep-1:fr" && scriptLanguageKey({ repId: "rep-1", leadLanguage: null }) === "fieldquo-script-language:rep-1:any");
    rememberScriptLanguage(sl, "en", storage);
    ok("…a choice is remembered", rememberedScriptLanguage(sl, storage) === "en");
    rememberScriptLanguage(sl, "fr", storage);
    ok("…choosing the default forgets it", rememberedScriptLanguage(sl, storage) === null);
    ok("…and a storage that throws is a null, not a crash", rememberedScriptLanguage(sl, { getItem() { throw new Error("private"); } }) === null && rememberScriptLanguage(sl, "es", { setItem() { throw new Error("private"); } }) === false);
    const catalogue = read("app/i18n/appMessages.js");
    for (const k of ["scriptLanguage", "scriptLanguageLoading", "scriptLanguageFallback"]) {
      ok(`app.salesCall.${k} is in the catalogue nine times`, (catalogue.match(new RegExp(`"app\\.salesCall\\.${k}":`, "g")) || []).length === 9);
    }
    ok("the rules-below sentence no longer says the script is English", !/aiScriptRulesBelow": "Written in English/.test(catalogue));
  }
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
