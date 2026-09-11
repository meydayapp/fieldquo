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
  callScriptCurrent,
  callScriptInputHash,
  callScriptInputs,
  callScriptPrompt,
  callScriptSchema,
  citationSources,
  validateCallScript,
} from "@/lib/sales/intel/callScript";
import { MAX_CHARS_PER_PAGE, MAX_EXCERPT_CHARS, integerInWords, ratingInWords, selectPageExcerpts } from "@/lib/sales/intel/pageExcerpts";
import { HARD_MAX_WORDS, MAX_WORDS, lintSentence, longSentences, voiceLint, voiceRetryNote, wordCount } from "@/lib/sales/scriptVoice";
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
  // The version bump reaches stored rows through the planner, not only
  // through the hash: a v1 script for the current crawl is re-queued on the
  // next claim or open, and the handler's hash check is what stops a row
  // already at v2 from being paid for twice.
  ok("…and again when the script was written by an older prompt",
    researchPlan({ prospect, tasks: done, priority: "claimed", script: { crawledAt: CRAWLED, promptVersion: "1" } }).enqueue[0]?.kind === "GENERATE_CALL_SCRIPT");
  ok("…not when it is at the current version", researchPlan({ prospect, tasks: done, priority: "claimed", script: { crawledAt: CRAWLED, promptVersion: CALL_SCRIPT_VERSION } }).skipped === "complete");
  // Three finished scripts are three scripts, not three failed tries: the
  // requeue bound must not count them, or the version bump never reaches a
  // prospect that has been scripted before.
  const thrice = [...done, ...[1, 2, 3].map((n) => ({ id: `s${n}`, kind: "GENERATE_CALL_SCRIPT", status: "done", createdAt: NOW }))];
  ok("…and a prospect scripted three times before is still re-queued for the new version",
    researchPlan({ prospect, tasks: thrice, priority: "claimed", script: { crawledAt: CRAWLED, promptVersion: "1" } }).enqueue[0]?.kind === "GENERATE_CALL_SCRIPT");
  const failedThrice = [...done, ...[1, 2, 3].map((n) => ({ id: `f${n}`, kind: "GENERATE_CALL_SCRIPT", status: "failed", createdAt: NOW }))];
  ok("…while three failed tries still exhaust the bound", researchPlan({ prospect, tasks: failedThrice, priority: "claimed", script: null }).skipped === "requeues_exhausted");
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
  ok("the system prompt says it is spoken", /Spoken English, as a person talks/.test(CALL_SCRIPT_SYSTEM));

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
    ok("…both calls metered, the retry under its own ref", db.__rows.platformAiUsage.length === 2 && db.__rows.platformAiUsage[1].ref === "v2-a:retry");
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

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
