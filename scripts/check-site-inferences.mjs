// scripts/check-site-inferences.mjs
//
//   npm run check:site-inferences
//
// "What we infer" filled from the business's own pages — the INFER_FROM_SITE
// stage, on the claimed lane only, every inference pinned to a sentence.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The rep's queue drew "Nothing has been inferred about this business" for
// South County Electric and Richmond Rolloff — two crawled sites, with an
// owner's name, years and a service area written on them by the business
// itself. Two rules wrote the inference layer and neither read a page. The
// owner asked whether AI should fill it; the answer was yes, if every row
// carries the exact sentence it came from and a kind the page does not state
// is left out. This file executes that answer.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// The handler runs against a scripted database and a scripted model: builds
// the prompt from fixture evidence; a kind with no quote is omitted; a quote
// not in the material is dropped and counted; the upsert is idempotent on an
// unchanged hash; the backlog lane is refused; the brief and the script
// prompts carry the kinds. The chain is asked what follows the lead score
// on each lane, and the planner what a claimed, researched prospect with no
// run still needs.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Five rules were each broken on disk, confirmed to fail here, and restored
// from a `cp` backup — never `git checkout`: the quote check, the omit-
// without-quote rule (a filled default), the hash skip, the lane gate, and
// the brief's known line.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CONFIDENCE_WORDS,
  DROP_REASONS,
  KIND_GUIDANCE,
  SITE_INFERENCE_AI_AREA,
  SITE_INFERENCE_DETECTOR,
  SITE_INFERENCE_LIMITS,
  SITE_INFERENCE_SYSTEM,
  SITE_INFERENCE_VERSION,
  siteInferenceCurrent,
  siteInferenceInputHash,
  siteInferenceInputs,
  siteInferencePrompt,
  siteInferenceSchema,
  siteInferenceSources,
  spellDigits,
  validateSiteInferences,
  yearInWords,
} from "@/lib/sales/intel/siteInference";
import { SITE_INFERENCE_KINDS, SITE_INFERENCE_LABELS } from "@/lib/sales/inferenceKinds";
import { findQuoteSource, lintCitations, quoteMaterial } from "@/lib/sales/scriptVoice";
import { selectPageExcerpts } from "@/lib/sales/intel/pageExcerpts";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";
import { AI_FAILURE } from "@/lib/ai/provider";
import { estimateCostMicros } from "@/lib/ai/usage";
import { handleInferFromSite } from "@/lib/sales/pipeline/handlers/inferFromSite";
import { HANDLER_MODULES } from "@/lib/sales/pipeline/handlers/index";
import { getHandler, isPlaceholder } from "@/lib/sales/pipeline/registry";
import { PROVIDER_BY_KIND, TASK_KINDS } from "@/lib/sales/pipeline/kinds";
import { CLAIMED_TAIL, NEXT_STAGE, advanceChain, laneOrder, nextStageFor } from "@/lib/sales/pipeline/chain";
import { CLAIMED_NOT_BEFORE } from "@/lib/sales/pipeline/priority";
import { CLAIMED_TAIL as RESEARCH_CLAIMED_TAIL, RESEARCH_CHAIN, researchPlan } from "@/lib/sales/pipeline/research";
import { STAGES } from "@/lib/sales/pipeline/progress";
import { composeBrief } from "@/lib/sales/intel/brief";
import { callScriptInputs, callScriptPrompt } from "@/lib/sales/intel/callScript";
import { inferenceStatement } from "@/lib/sales/prospectView";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

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

const NOW = new Date("2026-09-11T20:00:00Z");
const CRAWLED = new Date("2026-09-09T15:41:10Z");

// ── Fixture evidence: what the crawler and the capability detector filed ──
const ABOUT = "About us. South County Electric was started by Mike Ellis in 1998 and is still family run. Our crew of four licensed electricians serves Kennedy, Wadena County and the towns within forty miles. Licensed and insured in Minnesota. We are hiring a journeyman electrician for the spring.";
const SERVICES = "Services. Residential and light commercial wiring, panel upgrades, generator installs. We specialise in farm and shop wiring. Se habla español.";
const HOME = "South County Electric, LLC. Kennedy, MN. Call us for an estimate. Spring and summer book up fast, so call early.";
const EVIDENCE = [
  { type: "page_content", sourceUrl: "https://www.scountyelectric.com/about", normalizedValue: "https://www.scountyelectric.com/about", rawValue: ABOUT },
  { type: "page_content", sourceUrl: "https://www.scountyelectric.com/services", normalizedValue: "https://www.scountyelectric.com/services", rawValue: SERVICES },
  { type: "page_content", sourceUrl: "https://www.scountyelectric.com/", normalizedValue: "https://www.scountyelectric.com/", rawValue: HOME },
  // The capability detector's note, filed under the same type and URL as the
  // home page. Richmond Rolloff's script was given this instead of the page.
  { type: "page_content", sourceUrl: "https://www.scountyelectric.com/", normalizedValue: "PHONE_CONTACT:phone_in_text", rawValue: "218-555-0100" },
  { type: "script_src", sourceUrl: "https://www.scountyelectric.com/", normalizedValue: "wix.com", rawValue: "https://static.wix.com/x.js" },
];
const PROSPECT = {
  id: "p1",
  businessName: "South County Electric, LLC",
  tradeKey: "electrical",
  city: "Kennedy",
  province: "MN",
  campaignId: "c1",
  assignedRepId: "rep-1",
  lastCrawledAt: CRAWLED,
};
const fixtureInputs = () => ({ prospect: PROSPECT, pages: selectPageExcerpts(EVIDENCE), crawledAt: CRAWLED });

/** What a careful model answers: the nine kinds the three pages state, each
 *  with its sentence, and nothing for years_in_business — no page says how
 *  long they have been going, only when they started. */
const goodReply = () => ({
  inferences: [
    { kind: "owner_name", value: "Mike Ellis", quote: "started by Mike Ellis in 1998", sourceUrl: "https://www.scountyelectric.com/about", confidence: "high" },
    { kind: "founded_year", value: "nineteen ninety-eight", quote: "started by Mike Ellis in 1998", sourceUrl: "https://www.scountyelectric.com/about", confidence: "high" },
    { kind: "crew_size", value: "a crew of four", quote: "Our crew of four licensed electricians", sourceUrl: "https://www.scountyelectric.com/about", confidence: "high" },
    { kind: "service_area", value: "Kennedy, Wadena County and towns within forty miles", quote: "serves Kennedy, Wadena County and the towns within forty miles", sourceUrl: "https://www.scountyelectric.com/about", confidence: "high" },
    { kind: "licence_or_insurance_claim", value: "licensed and insured in Minnesota", quote: "Licensed and insured in Minnesota.", sourceUrl: "https://www.scountyelectric.com/about", confidence: "high" },
    { kind: "hiring", value: "hiring a journeyman electrician", quote: "We are hiring a journeyman electrician for the spring.", sourceUrl: "https://www.scountyelectric.com/about", confidence: "high" },
    { kind: "emphasis", value: "farm and shop wiring, residential and light commercial", quote: "We specialise in farm and shop wiring.", sourceUrl: "https://www.scountyelectric.com/services", confidence: "medium" },
    { kind: "languages_spoken", value: "Spanish", quote: "Se habla español.", sourceUrl: "https://www.scountyelectric.com/services", confidence: "high" },
    { kind: "busy_season", value: "spring and summer", quote: "Spring and summer book up fast", sourceUrl: "https://www.scountyelectric.com/", confidence: "medium" },
  ],
});

/** A scripted database: the models the handler and the meter reach for.
 *  `$transaction` hands back the same stub — every write lands in the same
 *  rows, which is what an atomic write looks like from the outside. */
function stubDb(fixture = {}) {
  const rows = { prospectInference: [], prospectInferenceRun: [], prospectEvidence: [], platformAiUsage: [], platformAiBudget: [], ...fixture };
  const writes = [];
  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "prospectId_kind") return row.prospectId === v.prospectId && row.kind === v.kind;
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
    findFirst: async ({ where }) => rows[name].find((r) => match(r, where)) || null,
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
  const stub = new Proxy({ __rows: rows, __writes: writes }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "$transaction") return async (fn) => fn(stub);
      if (typeof prop !== "string") return undefined;
      if (!(prop in rows)) throw new Error(`dbStub: unscripted model ${prop}`);
      return model(prop);
    },
  });
  return stub;
}

const task = (extra = {}) => ({
  id: "task-infer",
  kind: "INFER_FROM_SITE",
  prospectId: "p1",
  campaignId: "c1",
  payload: { prospectId: "p1", priority: "claimed" },
  claimToken: "tok",
  attempts: 1,
  idempotencyKey: "research:INFER_FROM_SITE:p1:0",
  ...extra,
});

// ═══════════════════════════════════════════════════════════════════════════
section("1. The stage exists, is real, and sits on the claimed lane between the score and the brief");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("INFER_FROM_SITE is a task kind", TASK_KINDS.includes("INFER_FROM_SITE"));
  ok("…after the lead score and before the brief", TASK_KINDS.indexOf("INFER_FROM_SITE") === TASK_KINDS.indexOf("CALCULATE_LEAD_SCORE") + 1 && TASK_KINDS.indexOf("GENERATE_RESEARCH_BRIEF") === TASK_KINDS.indexOf("INFER_FROM_SITE") + 1, TASK_KINDS);
  ok("…on the openai budget, because it is one model call", PROVIDER_BY_KIND.INFER_FROM_SITE === "openai");
  ok("…with a real handler registered", !isPlaceholder("INFER_FROM_SITE") && typeof getHandler("INFER_FROM_SITE") === "function");
  ok("…named in HANDLER_MODULES", HANDLER_MODULES.includes("INFER_FROM_SITE"));
  ok("…described on the board, as claimed-only", STAGES.some((s) => s.kind === "INFER_FROM_SITE" && /claimed/i.test(s.what) && /sentence/i.test(s.what)));
  ok("…and declares a successor in NEXT_STAGE so a lane-less task cannot end the chain", NEXT_STAGE.INFER_FROM_SITE === "GENERATE_RESEARCH_BRIEF");

  ok("the backlog goes from the score straight to the brief", nextStageFor("CALCULATE_LEAD_SCORE") === "GENERATE_RESEARCH_BRIEF" && nextStageFor("CALCULATE_LEAD_SCORE", { priority: "backlog" }) === "GENERATE_RESEARCH_BRIEF");
  ok("the claimed lane detours through the inference stage", nextStageFor("CALCULATE_LEAD_SCORE", { priority: "claimed" }) === "INFER_FROM_SITE");
  ok("…and from there to the brief, then the script", nextStageFor("INFER_FROM_SITE", { priority: "claimed" }) === "GENERATE_RESEARCH_BRIEF" && nextStageFor("GENERATE_RESEARCH_BRIEF", { priority: "claimed" }) === "GENERATE_CALL_SCRIPT");
  ok("CLAIMED_TAIL names exactly those three hand-offs", JSON.stringify(CLAIMED_TAIL) === JSON.stringify({ CALCULATE_LEAD_SCORE: "INFER_FROM_SITE", INFER_FROM_SITE: "GENERATE_RESEARCH_BRIEF", GENERATE_RESEARCH_BRIEF: "GENERATE_CALL_SCRIPT" }), CLAIMED_TAIL);
  const claimedWalk = laneOrder("claimed");
  const backlogWalk = laneOrder("backlog");
  ok("the claimed walk visits every stage the backlog walk does, in order, plus the two claimed-only ones",
    JSON.stringify(claimedWalk.filter((k) => backlogWalk.includes(k))) === JSON.stringify(backlogWalk) &&
    JSON.stringify(claimedWalk.filter((k) => !backlogWalk.includes(k))) === JSON.stringify(["INFER_FROM_SITE", "GENERATE_CALL_SCRIPT"]), { claimedWalk, backlogWalk });
  ok("research.js derives the same two claimed-only stages, in that order", JSON.stringify(RESEARCH_CLAIMED_TAIL) === JSON.stringify(["INFER_FROM_SITE", "GENERATE_CALL_SCRIPT"]), RESEARCH_CLAIMED_TAIL);
  ok("…and the backlog research chain never names it", !RESEARCH_CHAIN.includes("INFER_FROM_SITE"), RESEARCH_CHAIN);

  // Executed: the score settling on each lane.
  const created = [];
  const fakeDb = { salesPipelineTask: { async findUnique() { return null; }, async create({ data }) { created.push(data); return { ...data, id: "x", createdAt: NOW }; } } };
  const backlog = await advanceChain({ kind: "CALCULATE_LEAD_SCORE", db: fakeDb, task: { id: "s", prospectId: "p", payload: { prospectId: "p", priority: "backlog", phrase: false } } });
  ok("a backlog score queues the brief", backlog.queued === "GENERATE_RESEARCH_BRIEF" && created[0]?.kind === "GENERATE_RESEARCH_BRIEF", backlog);
  const claimed = await advanceChain({ kind: "CALCULATE_LEAD_SCORE", db: fakeDb, task: { id: "s", prospectId: "p", payload: { prospectId: "p", priority: "claimed" } } });
  ok("a claimed score queues the inference stage", claimed.queued === "INFER_FROM_SITE" && created[1]?.kind === "INFER_FROM_SITE", claimed);
  ok("…in the claimed lane, ahead of the backlog", created[1]?.payload?.priority === "claimed" && created[1]?.notBefore === CLAIMED_NOT_BEFORE);

  // The planner: a researched, claimed prospect with no run gets one — and
  // only that, because the stage chains into the brief and the script.
  const done = RESEARCH_CHAIN.map((k) => ({ id: k, kind: k, status: "done", createdAt: NOW }));
  const prospect = { id: "p", websiteUrl: "http://x.example/", lastCrawledAt: CRAWLED, doNotContactAt: null, campaignId: null };
  const plan = researchPlan({ prospect, tasks: done, priority: "claimed", script: null, inferenceRun: null });
  ok("ensureResearchQueued plans the inference stage first for a claimed prospect with no run", plan.enqueue.length === 1 && plan.enqueue[0].kind === "INFER_FROM_SITE", plan);
  ok("…in the claimed lane", plan.enqueue[0]?.payload?.priority === "claimed" && plan.enqueue[0]?.notBefore === CLAIMED_NOT_BEFORE);
  ok("…never on the backlog lane", researchPlan({ prospect, tasks: done, priority: "backlog", inferenceRun: null }).skipped === "complete");
  const run = { crawledAt: CRAWLED, promptVersion: SITE_INFERENCE_VERSION };
  ok("a current run moves the plan on to the script", researchPlan({ prospect, tasks: done, priority: "claimed", script: null, inferenceRun: run }).enqueue[0]?.kind === "GENERATE_CALL_SCRIPT");
  ok("…a run older than the crawl is redone", researchPlan({ prospect: { ...prospect, lastCrawledAt: NOW }, tasks: done, priority: "claimed", inferenceRun: run }).enqueue[0]?.kind === "INFER_FROM_SITE");
  ok("…and so is one written by an older prompt", researchPlan({ prospect, tasks: done, priority: "claimed", inferenceRun: { ...run, promptVersion: "0" } }).enqueue[0]?.kind === "INFER_FROM_SITE");
  const failedThrice = [...done, ...[1, 2, 3].map((n) => ({ id: `f${n}`, kind: "INFER_FROM_SITE", status: "failed", createdAt: NOW }))];
  ok("three failed tries exhaust the bound", researchPlan({ prospect, tasks: failedThrice, priority: "claimed", inferenceRun: null }).skipped === "requeues_exhausted");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The material: the same excerpts the script reads, the page and not a note about it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pages = selectPageExcerpts(EVIDENCE);
  ok("about first, then services, then home", pages.map((p) => p.url.replace("https://www.scountyelectric.com", "")).join(" ") === "/about /services /", pages.map((p) => p.url));
  ok("the home page is the page, not the capability detector's phone note under the same URL", pages[2].text === HOME, pages[2].text);
  ok("…and the fingerprint row is not a page", !pages.some((p) => /wix/.test(p.text)));

  const inputs = siteInferenceInputs(fixtureInputs());
  ok("the inputs carry the business, the trade, the town and the pages", inputs.business === PROSPECT.businessName && inputs.trade === "electrical" && inputs.place === "Kennedy, MN" && inputs.pages.length === 3, inputs);
  const prompt = siteInferencePrompt(inputs);
  ok("the prompt prints every page under its URL", /\[https:\/\/www\.scountyelectric\.com\/about\]\n/.test(prompt) && prompt.includes(ABOUT) && prompt.includes(SERVICES) && prompt.includes(HOME));
  ok("…lists every kind, with its guidance", SITE_INFERENCE_KINDS.every((k) => prompt.includes(`- ${k}: ${KIND_GUIDANCE[k]}`)));
  ok("…tells the model a kind the pages do not state is LEFT OUT and an empty list is correct", /LEFT OUT/.test(prompt) && /empty list is a correct answer/.test(prompt));
  ok("…demands the quote verbatim and says it is checked", /copied verbatim/.test(prompt) && /checked character for character/.test(prompt));
  ok("…and words, no digits, in the value", /no digits anywhere/.test(prompt) && /nineteen ninety-eight/.test(prompt));
  ok("…and carries no ids, no evidence, no scores", !/evidenceIds|prospectId|score|rep-1|\bc1\b/.test(prompt));
  ok("the system turn forbids guessing and filling from the trade's habits", /never guess/.test(SITE_INFERENCE_SYSTEM) && /businesses like this usually say/.test(SITE_INFERENCE_SYSTEM));

  const schema = siteInferenceSchema();
  ok("the schema passes the vendor's strict lint", assertStrictSchema(schema).ok, assertStrictSchema(schema).errors);
  ok("…has no numeric field anywhere — confidence is a word, mapped in code", !/"type":"(number|integer)"/.test(JSON.stringify(schema)) && JSON.stringify(schema.properties.inferences.items.properties.confidence.enum) === JSON.stringify(Object.keys(CONFIDENCE_WORDS)));
  ok("…and the kind is an enum over the closed list", JSON.stringify(schema.properties.inferences.items.properties.kind.enum) === JSON.stringify([...SITE_INFERENCE_KINDS]));
  ok("the closed list is the ten kinds the owner was promised", SITE_INFERENCE_KINDS.length === 10 && ["crew_size", "years_in_business", "founded_year", "owner_name", "service_area", "emphasis", "hiring", "licence_or_insurance_claim", "languages_spoken", "busy_season"].every((k) => SITE_INFERENCE_KINDS.includes(k)));
  ok("…each with a label", SITE_INFERENCE_KINDS.every((k) => SITE_INFERENCE_LABELS[k]));

  const h1 = siteInferenceInputHash(inputs);
  ok("the hash is stable", h1 === siteInferenceInputHash(siteInferenceInputs(fixtureInputs())));
  ok("…changes when a page changes", h1 !== siteInferenceInputHash(siteInferenceInputs({ ...fixtureInputs(), pages: selectPageExcerpts([EVIDENCE[0], EVIDENCE[1], { ...EVIDENCE[2], rawValue: `${HOME} Now open Sundays.` }]) })));
  ok("…and when the version changes", h1 !== siteInferenceInputHash({ ...inputs, version: "999" }));
  ok("a run with the same hash and version is current", siteInferenceCurrent({ inputHash: h1, promptVersion: SITE_INFERENCE_VERSION }, { inputHash: h1 }));
  ok("…another hash is not, an older version is not, nothing is not", !siteInferenceCurrent({ inputHash: "x", promptVersion: SITE_INFERENCE_VERSION }, { inputHash: h1 }) && !siteInferenceCurrent({ inputHash: h1, promptVersion: "0" }, { inputHash: h1 }) && !siteInferenceCurrent(null, { inputHash: h1 }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The verifier: a quote, verbatim, or the row is dropped — the script's own verifier, reused");
// ═══════════════════════════════════════════════════════════════════════════

{
  const sources = siteInferenceSources(siteInferenceInputs(fixtureInputs()));
  ok("findQuoteSource is the one primitive lintCitations and this stage share",
    typeof findQuoteSource === "function" && typeof quoteMaterial === "function" &&
    /findQuoteSource\(quote, material\)/.test(decomment(read("lib/sales/scriptVoice.js")).split("export function lintCitations")[1]) &&
    /findQuoteSource\(quote, sources\)/.test(decomment(read("lib/sales/intel/siteInference.js"))) &&
    !/\.text\.includes\(/.test(decomment(read("lib/sales/intel/siteInference.js"))));
  ok("a verbatim quote is found, with its page", findQuoteSource("started by Mike Ellis in 1998", sources)?.url === "https://www.scountyelectric.com/about");
  ok("…case and curly quotes do not matter", findQuoteSource("STARTED BY MIKE ELLIS", sources) !== null);
  ok("…a paraphrase is not found", findQuoteSource("founded by Mike Ellis in 1998", sources) === null);
  ok("…nor an empty quote", findQuoteSource("", sources) === null && findQuoteSource("x", []) === null);
  // The script lint agrees with the stage on the same quote — one verifier.
  const lint = lintCitations({ opener: "Mike Ellis started it.", whyThemNow: "Mike Ellis started it.", citations: [{ field: "opener", quote: "founded by Mike Ellis", sourceUrl: "x" }, { field: "whyThemNow", quote: "started by Mike Ellis", sourceUrl: "x" }] }, sources);
  ok("the script lint rejects the same paraphrase and accepts the same quote", lint.problems.includes("citation_not_in_source") && !lint.findings.some((f) => f.field === "whyThemNow"), lint);

  const all = validateSiteInferences(goodReply(), sources);
  ok("a careful reply keeps every entry", all.kept.length === 9 && all.dropped.length === 0, all.dropped);
  ok("…the sourceUrl stored is where the quote was FOUND", all.kept.every((k) => k.sourceUrl.startsWith("https://www.scountyelectric.com/")));
  const wrongUrl = validateSiteInferences({ inferences: [{ ...goodReply().inferences[0], sourceUrl: "https://elsewhere.example/" }] }, sources);
  ok("…even when the model named the wrong page", wrongUrl.kept[0]?.sourceUrl === "https://www.scountyelectric.com/about", wrongUrl);
  ok("…and confidence is the number for the word", all.kept.find((k) => k.kind === "owner_name").confidence === CONFIDENCE_WORDS.high && all.kept.find((k) => k.kind === "emphasis").confidence === CONFIDENCE_WORDS.medium);

  // A quote not in the material is dropped and counted.
  const invented = validateSiteInferences({ inferences: [...goodReply().inferences, { kind: "years_in_business", value: "twenty-six years", quote: "serving the county for twenty-six years", sourceUrl: "https://www.scountyelectric.com/about", confidence: "high" }] }, sources);
  ok("a quote the pages do not contain drops the entry", !invented.kept.some((k) => k.kind === "years_in_business"), invented.kept.map((k) => k.kind));
  ok("…counted, by kind and reason", invented.dropped.length === 1 && invented.dropped[0].kind === "years_in_business" && invented.dropped[0].reason === "quote_not_in_material", invented.dropped);
  ok("…and the nine real ones survive", invented.kept.length === 9);
  ok("the reason is on the closed list", Object.hasOwn(DROP_REASONS, "quote_not_in_material"));

  // A kind with no quote is omitted, never filled.
  const partial = validateSiteInferences({ inferences: goodReply().inferences.slice(0, 2) }, sources);
  ok("a reply that states two kinds yields two rows and no default for the other eight", partial.kept.length === 2 && partial.dropped.length === 0 && !partial.kept.some((k) => ["crew_size", "hiring", "busy_season"].includes(k.kind)));
  const empty = validateSiteInferences({ inferences: [] }, sources);
  ok("an empty reply is zero rows, zero drops — a correct answer", empty.kept.length === 0 && empty.dropped.length === 0);
  ok("an entry with an empty quote is dropped", validateSiteInferences({ inferences: [{ ...goodReply().inferences[0], quote: " " }] }, sources).dropped[0]?.reason === "empty");
  ok("an unknown kind is dropped, even though the enum should have stopped it", validateSiteInferences({ inferences: [{ ...goodReply().inferences[0], kind: "revenue" }] }, sources).dropped[0]?.reason === "unknown_kind");
  ok("a second entry for a kind is dropped", validateSiteInferences({ inferences: [goodReply().inferences[0], goodReply().inferences[0]] }, sources).dropped[0]?.reason === "duplicate_kind");
  ok(`a quote past ${SITE_INFERENCE_LIMITS.quote} characters is dropped`, validateSiteInferences({ inferences: [{ ...goodReply().inferences[0], quote: ABOUT.repeat(2) }] }, sources).dropped[0]?.reason === "quote_too_long");

  // Words, not digits.
  ok("1998 is nineteen ninety-eight", yearInWords(1998) === "nineteen ninety-eight" && yearInWords(2005) === "two thousand and five" && yearInWords(2015) === "twenty fifteen" && yearInWords(2000) === "two thousand" && yearInWords(1900) === "nineteen hundred" && yearInWords(1907) === "nineteen oh seven");
  ok("a value with a year in it is spelled out", spellDigits("since 1998") === "since nineteen ninety-eight" && spellDigits("4 trucks") === "four trucks");
  const digits = validateSiteInferences({ inferences: [{ ...goodReply().inferences[1], value: "1998" }] }, sources);
  ok("…so the model's \"1998\" is stored as words", digits.kept[0]?.value === "nineteen ninety-eight", digits);
  const decimal = validateSiteInferences({ inferences: [{ ...goodReply().inferences[2], value: "4.5 people" }] }, sources);
  ok("…and a value still carrying a digit after that is dropped and counted", decimal.kept.length === 0 && decimal.dropped[0]?.reason === "digit_value", decimal);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The handler, executed: reads, writes with evidence, skips on the same hash, re-reads on a new crawl");
// ═══════════════════════════════════════════════════════════════════════════

{
  const db = stubDb();
  const prompts = [];
  const complete = async ({ prompt, schema, onUsage }) => {
    prompts.push({ prompt, schema });
    await onUsage({ model: "gpt-5-mini", promptTokens: 1100, completionTokens: 450 });
    return { ok: true, data: goodReply(), raw: "" };
  };
  const first = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k1", db, now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("the stage completes", first.done === true, first);
  ok("…and says what it kept", /kept 9: owner_name/.test(first.note) && !/dropped/.test(first.note), first.note);
  ok("…the model was asked once, with the prompt built from the fixture evidence", prompts.length === 1 && prompts[0].prompt.includes(ABOUT) && assertStrictSchema(prompts[0].schema).ok);
  const inferences = db.__rows.prospectInference;
  ok("nine ProspectInference rows, one per kind, keyed on the prospect", inferences.length === 9 && new Set(inferences.map((r) => r.kind)).size === 9 && inferences.every((r) => r.prospectId === "p1"), inferences.map((r) => r.kind));
  const owner = inferences.find((r) => r.kind === "owner_name");
  ok("…the row shape ANALYZE_CAPABILITIES writes: kind, value, confidence, evidenceIds, source, observedAt, modelVersion",
    owner.value === "Mike Ellis" && owner.confidence === CONFIDENCE_WORDS.high && owner.evidenceIds.length === 1 && owner.source === "derived" && owner.observedAt === NOW && owner.modelVersion === `${SITE_INFERENCE_DETECTOR}/${SITE_INFERENCE_VERSION}`, owner);
  const evidence = db.__rows.prospectEvidence;
  ok("each cites a page_content evidence row holding the exact sentence, on its page — eight rows for nine kinds, because two share a sentence",
    evidence.length === 8 && inferences.every((r) => { const e = evidence.find((x) => x.id === r.evidenceIds[0]); return e && e.type === "page_content" && e.detector === SITE_INFERENCE_DETECTOR && e.sourceUrl.startsWith("https://www.scountyelectric.com/") && ABOUT.concat(SERVICES, HOME).includes(e.rawValue); }), evidence[0]);
  ok("…the owner's row quotes the owner's sentence", evidence.find((x) => x.id === owner.evidenceIds[0]).rawValue === "started by Mike Ellis in 1998");
  ok("the same sentence quoted for two kinds is one evidence row", evidence.filter((e) => e.rawValue === "started by Mike Ellis in 1998").length === 1 && /1 sentence\(s\) already on file/.test(first.note), first.note);
  const run = db.__rows.prospectInferenceRun[0];
  ok("one run row: model, version, hash, counts, crawl date", db.__rows.prospectInferenceRun.length === 1 && run.model === "gpt-5-mini" && run.promptVersion === SITE_INFERENCE_VERSION && run.inputHash.length === 40 && run.kept === 9 && run.dropped === 0 && run.pages === 3 && run.crawledAt === CRAWLED && run.generatedAt === NOW, run);
  const usage = db.__rows.platformAiUsage[0];
  ok("the spend is in the ledger under site_inference, keyed on the task", usage?.area === SITE_INFERENCE_AI_AREA && usage.ref === "k1" && usage.prospectId === "p1" && usage.salesRepId === "rep-1" && usage.campaignId === "c1", usage);
  ok("…priced from the model's table", usage?.costMicros === estimateCostMicros({ model: "gpt-5-mini", promptTokens: 1100, completionTokens: 450 }));
  ok("…and says no budget caps it", /no platform AI budget configured/.test(first.note));

  // The queue renders them with no change to the screen: a page_content
  // signal scores, and a value in words carries no digit.
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const statements = inferences.map((r) => inferenceStatement(r, { evidenceById: byId }));
  ok("every row renders in \"What we infer\"", statements.every((s) => s.renderable === true), statements.filter((s) => !s.renderable));
  ok("…with a confidence figure from the page_content signal", statements.every((s) => s.confidencePercent > 0 && s.confidencePercent < 100), statements[0]);
  ok("…the owner's name keeps its case", statements.find((s) => s.kind === "owner_name").text === "Mike Ellis");
  ok("…and the kind label falls back to English and is translated in every language", statements.every((s) => s.kindTextKey === `app.salesIntel.kind.${s.kind}`) && Object.values(APP_MESSAGES).every((block) => SITE_INFERENCE_KINDS.every((k) => typeof block[`app.salesIntel.kind.${k}`] === "string" && block[`app.salesIntel.kind.${k}`].trim())), Object.keys(APP_MESSAGES));

  // Idempotent on the unchanged hash.
  const before = db.__writes.length;
  const second = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k2", db, now: new Date(NOW.getTime() + 60_000), deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("the same pages a minute later spend nothing", second.done === true && /unchanged/.test(second.note) && prompts.length === 1, second);
  ok("…and write nothing", db.__writes.length === before && db.__rows.prospectInference.length === 9 && db.__rows.prospectEvidence.length === 8);

  // A new crawl re-reads, upserts in place, reuses the sentences still there.
  const recrawled = { ...fixtureInputs(), pages: selectPageExcerpts([EVIDENCE[0], EVIDENCE[1], { ...EVIDENCE[2], rawValue: `${HOME} Now open Sundays.` }]), crawledAt: NOW };
  const third = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k3", db, now: NOW, deps: { loadInputs: async () => recrawled, complete } });
  ok("a new crawl re-reads", third.done === true && /re-read/.test(third.note) && prompts.length === 2, third);
  ok("…in place: still nine inference rows, still one run row with the new hash", db.__rows.prospectInference.length === 9 && db.__rows.prospectInferenceRun.length === 1 && run.inputHash !== siteInferenceInputHash(siteInferenceInputs(fixtureInputs())) && run.crawledAt === NOW);
  ok("…and the sentences already on file are reused, not duplicated", db.__rows.prospectEvidence.length === 8 && /8 sentence\(s\) already on file/.test(third.note) && !/recorded as evidence/.test(third.note), third.note);
}

{
  // A dropped quote is counted in the note and on the run row; the kept ones land.
  const db = stubDb();
  const complete = async ({ onUsage }) => {
    await onUsage({ model: "gpt-5-mini", promptTokens: 1100, completionTokens: 450 });
    return { ok: true, data: { inferences: [goodReply().inferences[0], { kind: "years_in_business", value: "twenty-six years", quote: "serving the county for twenty-six years", sourceUrl: "https://www.scountyelectric.com/about", confidence: "high" }] } };
  };
  const res = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k4", db, now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("one kept, one dropped: the note says which and why", res.done === true && /kept 1: owner_name/.test(res.note) && /dropped 1: years_in_business \(quote_not_in_material\)/.test(res.note), res.note);
  ok("…the run row counts both", db.__rows.prospectInferenceRun[0].kept === 1 && db.__rows.prospectInferenceRun[0].dropped === 1);
  ok("…and only the kept one is a row", db.__rows.prospectInference.length === 1 && db.__rows.prospectInference[0].kind === "owner_name");

  // Nothing crawled: no model, a run row, an honest note.
  const empty = stubDb();
  let asked = 0;
  const bare = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k5", db: empty, now: NOW, deps: { loadInputs: async () => ({ prospect: PROSPECT, pages: [], crawledAt: null }), complete: async () => { asked++; return { ok: true, data: goodReply() }; } } });
  ok("no page text: done, nothing asked, nothing inferred, the run recorded", bare.done === true && asked === 0 && /nothing to infer/.test(bare.note) && empty.__rows.prospectInference.length === 0 && empty.__rows.prospectInferenceRun.length === 1 && empty.__rows.prospectInferenceRun[0].model === null, bare);
}

{
  // The lane gate, the budget, the vendor outcomes.
  const complete = async ({ onUsage }) => { await onUsage({ model: "gpt-5-mini", promptTokens: 10, completionTokens: 10 }); return { ok: true, data: goodReply() }; };
  const backlogDb = stubDb();
  const backlog = await handleInferFromSite({ task: task({ payload: { prospectId: "p1", priority: "backlog" } }), payload: { prospectId: "p1", priority: "backlog" }, db: backlogDb, now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("the backlog lane is refused, terminally, before any read", backlog.done === false && backlog.retry === false && /claimed lane/.test(backlog.reason) && backlogDb.__writes.length === 0, backlog);
  const noLane = await handleInferFromSite({ task: task({ payload: { prospectId: "p1" } }), payload: { prospectId: "p1" }, db: stubDb(), now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete } });
  ok("…and so is a task with no lane at all", noLane.done === false && noLane.retry === false);

  const spentDb = stubDb({
    platformAiBudget: [{ scope: "daily", scopeId: null, limitMicros: 1000, active: true }],
    platformAiUsage: [{ area: "research_brief", model: "gpt-5-mini", costMicros: 1000, createdAt: NOW, ref: "old" }],
  });
  let asked = 0;
  const spent = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k6", db: spentDb, now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete: async () => { asked++; return { ok: true, data: goodReply() }; } } });
  ok("a spent daily budget refuses, terminally, before the model is asked", spent.done === false && spent.retry === false && /daily_budget/.test(spent.reason) && asked === 0 && spentDb.__rows.prospectInference.length === 0, spent);

  const vendorDown = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k7", db: stubDb(), now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete: async () => ({ ok: false, reason: AI_FAILURE.VENDOR_ERROR, message: "502" }) } });
  ok("a vendor outage is retried on the ladder", vendorDown.done === false && vendorDown.retry === true, vendorDown);
  const refused = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k8", db: stubDb(), now: NOW, deps: { loadInputs: async () => fixtureInputs(), complete: async () => ({ ok: false, reason: AI_FAILURE.REFUSED, message: "no" }) } });
  ok("…a refusal is terminal, with the reason in the row", refused.done === false && refused.retry === false && /refused/.test(refused.reason), refused);
  const missing = await handleInferFromSite({ task: task(), payload: task().payload, idempotencyKey: "k9", db: stubDb(), now: NOW, deps: { loadInputs: async () => ({ prospect: null }), complete } });
  ok("a prospect that is not there is terminal", missing.done === false && missing.retry === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The brief and the script both carry the kinds");
// ═══════════════════════════════════════════════════════════════════════════

{
  const rows = SITE_INFERENCE_KINDS.map((kind, i) => ({ kind, value: `value for ${kind.replace(/_/g, " ")}`, evidenceIds: [`e${i}`], source: "derived" }));
  const brief = composeBrief({ prospect: { id: "p1", businessName: PROSPECT.businessName, city: "Kennedy", province: "MN", tradeKey: "electrical" }, inferences: rows });
  ok("composeBrief puts every kind on the card as a known line in the inference layer, citing its evidence",
    SITE_INFERENCE_KINDS.every((k) => brief.known.some((line) => line.id === k && line.layer === "inference" && line.label === SITE_INFERENCE_LABELS[k] && line.detail === `value for ${k.replace(/_/g, " ")}` && line.evidenceIds.length === 1)), brief.known.map((l) => l.id));
  ok("…and adds no gap for a kind that was not written", composeBrief({ prospect: { id: "p1", businessName: "X" }, inferences: [] }).unknown.every((u) => !SITE_INFERENCE_KINDS.includes(u.id)));
  ok("the brief's phrasing prompt is slots only, by design — no fact reaches that model", !/SITE_INFERENCE|inferences/.test(decomment(read("lib/sales/intel/brief.js")).split("export function phrasingPrompt")[1].split("\n}")[0]));

  const inputs = callScriptInputs({ brief, inferences: rows, pages: [{ url: "https://www.scountyelectric.com/about", text: ABOUT }], prospect: PROSPECT });
  const prompt = callScriptPrompt(inputs);
  ok("the script prompt prints every kind under WHAT WE INFERRED", /WHAT WE INFERRED ABOUT THEM/.test(prompt) && SITE_INFERENCE_KINDS.every((k) => prompt.includes(`- ${k.replace(/_/g, " ")}: value for ${k.replace(/_/g, " ")}`)), inputs.inferences);
  ok("…once — not again as a fact under WHAT WE KNOW", !inputs.known.some((line) => /^(Owner|Crew size|Founded|Years in business):/.test(line)), inputs.known);
  ok(`…within the ${12} the prompt is bounded to, so ten kinds plus trade and derived_site fit`, inputs.inferences.length === 10);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Cost, as measured");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The five researched prospects the script agent measured produced
  // 1,100–1,600 prompt tokens from the same excerpts; ten short entries with
  // one-sentence quotes are about 450 completion tokens. At gpt-5-mini's
  // checked price that is a tenth of a cent a prospect.
  const micros = estimateCostMicros({ model: "gpt-5-mini", promptTokens: 1600, completionTokens: 450 });
  ok("a read of the fullest prospect costs under a fifth of a cent", micros > 0 && micros < 2_000, micros);
  ok("…and four thousand claims a day cost under eight dollars", (micros * 4000) / 1_000_000 < 8, (micros * 4000) / 1_000_000);
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  console.log(`FAILURES:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
