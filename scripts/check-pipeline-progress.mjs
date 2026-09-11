// scripts/check-pipeline-progress.mjs
//
//   npm run check:pipeline-progress
//
// "how is the website crawler working.. i don't see any banners or status
// updates telling me that x step is running.. y one is completed z is the next
// one etc.."
//
// ══ What was wrong ════════════════════════════════════════════════════════
//
// Nothing, in the crawler. It was working the whole time — 922 sites read, two
// in flight at the moment the question was asked. What was missing was any way
// to see it. The campaign screen showed businesses accepted, and stages that
// had STOPPED, and nothing in between, so a healthy pipeline rendered as blank
// space — which is indistinguishable from a dead one.
//
// The route had grouped every task by (kind, status) for weeks and then kept
// only the `failed` and `abandoned` rows, discarding the healthy ones one line
// later. Written and never read, in its reporting form.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// Every assertion runs the shipped functions over the count shapes Prisma
// actually returns. The percentage rule gets its own section because rounding
// is where a progress bar learns to lie.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The 99% cap, the claimed-outranks-queued rule, and the route's `stages:` key
// were each broken on disk, confirmed to fail here, and restored from a `cp`
// backup — never `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  STAGES,
  stageBoard,
  stageState,
  settledPercent,
  boardSummary,
  describeStage,
} from "@/lib/sales/pipeline/progress";
import { TASK_KINDS } from "@/lib/sales/pipeline/kinds";
import { CLAIMED_TAIL, NEXT_STAGE, advanceChain, nextStageFor } from "@/lib/sales/pipeline/chain";
import {
  CLAIMED_NOT_BEFORE,
  inheritedPayload,
  notBeforeFor,
  taskPriority,
} from "@/lib/sales/pipeline/priority";
import {
  MAX_REQUEUES,
  RESEARCH_CHAIN,
  RESEARCH_CHAIN_NO_WEBSITE,
  crawlRetryable,
  ensureResearchQueued,
  researchKey,
  researchPlan,
} from "@/lib/sales/pipeline/research";
import { ensureResearchQueued as viaProgress } from "@/lib/sales/pipeline/progress";
import {
  BACKLOG_PENDING_CEILING,
  BACKLOG_TOPUP_PER_RUN,
  backlogRoom,
  topUpResearchBacklog,
} from "@/lib/sales/pipeline/research";
import { PROVIDER_LIMITS } from "@/lib/sales/pipeline/limits";
import { BACKOFF_MAX_MS, backoffMs, failureOutcome } from "@/lib/sales/pipeline/schedule";
import {
  DNS_BACKOFF_BASE_MS,
  DNS_BACKOFF_MAX_MS,
  dnsBackoffDecision,
  nextDnsBackoff,
  resolverBusy,
} from "@/lib/sales/crawl/policy";
import { HOST_POLICY_SELECT, recordDnsFailure } from "@/lib/sales/crawl/hostPolicy";
import { crawlProspectSite } from "@/lib/sales/crawl/crawlSite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

/** Prisma's groupBy shape, which is the shape the route passes in. */
const g = (kind, status, n) => ({ kind, status, _count: { _all: n } });

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every stage is described, and the order is the chain's own");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("every task kind has a label", TASK_KINDS.every((k) => STAGES.some((s) => s.kind === k)),
    TASK_KINDS.filter((k) => !STAGES.some((s) => s.kind === k)));
  ok("…and no label describes a stage that does not exist",
    STAGES.every((s) => TASK_KINDS.includes(s.kind)),
    STAGES.filter((s) => !TASK_KINDS.includes(s.kind)).map((s) => s.kind));

  // The board is read top to bottom as "what happens to a business". If it is
  // not the chain's order, it is a lie told in the most convincing possible
  // format.
  const boardOrder = stageBoard([]).map((s) => s.kind);
  ok("the board is in chain order", JSON.stringify(boardOrder) === JSON.stringify(TASK_KINDS), boardOrder);
  // NEXT_STAGE only covers the LINEAR tail. The first two stages map to null
  // on purpose — discovery fans out (one page becomes many prospects) and
  // enrichment branches (no website means no crawl) — so the walk starts where
  // the chain becomes a line. Asserting a single walk from the top would be
  // asserting a pipeline shape this one deliberately does not have.
  // …and the claimed tail (CLAIMED_TAIL) continues past where NEXT_STAGE ends,
  // so the board's order is the backlog walk followed by the claimed walk.
  let walked = ["CRAWL_WEBSITE"];
  while (NEXT_STAGE[walked.at(-1)]) walked.push(NEXT_STAGE[walked.at(-1)]);
  while (CLAIMED_TAIL[walked.at(-1)]) walked.push(CLAIMED_TAIL[walked.at(-1)]);
  ok("the linear tail is in NEXT_STAGE's own order, then the claimed tail's",
    JSON.stringify(walked) === JSON.stringify(TASK_KINDS.slice(TASK_KINDS.indexOf("CRAWL_WEBSITE"))), walked);
  ok("…and the two fan-out stages come before it",
    TASK_KINDS.slice(0, 2).join() === "DISCOVER_BUSINESSES,ENRICH_BUSINESS");
  ok("…and every kind has a declared place in the chain",
    TASK_KINDS.every((k) => Object.hasOwn(NEXT_STAGE, k)),
    TASK_KINDS.filter((k) => !Object.hasOwn(NEXT_STAGE, k)));

  ok("no label is just the enum name", STAGES.every((s) => s.label !== s.kind));
  ok("every stage says what it does", STAGES.every((s) => typeof s.what === "string" && s.what.length > 20));
  // A kind added without copy gets its raw name, never an invented sentence.
  ok("an undescribed kind keeps its raw name", describeStage("NEW_THING").label === "NEW_THING");
  ok("…and claims no description", describeStage("NEW_THING").what === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. What the states mean, and which one wins");
// ═══════════════════════════════════════════════════════════════════════════

{
  // `claimed` is the ONLY status meaning "this second". There is no `running`.
  ok("a claimed task means working", stageState({ claimed: 1, queued: 40 }) === "working");
  ok("queued with nothing claimed is waiting, not working", stageState({ queued: 40 }) === "waiting");
  ok("…which is the normal state between runs, so it is not `stopped`",
    stageState({ queued: 40, failed: 3 }) === "waiting");
  // Is it moving outranks has it ever gone wrong. Failures are still counted.
  ok("a stage that is moving reads as working even with failures",
    stageState({ claimed: 2, failed: 245 }) === "working");
  ok("failures with nothing left to do read as stopped", stageState({ done: 10, failed: 245 }) === "stopped");
  ok("abandoned counts as stopped too", stageState({ abandoned: 394 }) === "stopped");
  ok("only done is finished", stageState({ done: 922 }) === "done");
  ok("nothing at all has not started", stageState({}) === "not_started");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The percentage, which is where a bar learns to lie");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The real numbers off production the day this was built.
  ok("922 done + 245 failed with 2 still in flight is 99, not 100",
    settledPercent({ done: 922, failed: 245, claimed: 2 }) === 99,
    settledPercent({ done: 922, failed: 245, claimed: 2 }));
  ok("…and one queued task also holds it at 99",
    settledPercent({ done: 9999, queued: 1 }) === 99);
  ok("100 is reserved for a stage with nothing left",
    settledPercent({ done: 922, failed: 245 }) === 100);
  ok("a stage with nothing has no percentage at all", settledPercent({}) === null);
  ok("…which is not the same as zero", settledPercent({ queued: 1 }) === 0);
  ok("half is half", settledPercent({ done: 50, queued: 50 }) === 50);
  ok("abandoned counts as settled", settledPercent({ abandoned: 10 }) === 100);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The board over the shapes Prisma really returns");
// ═══════════════════════════════════════════════════════════════════════════

{
  const rows = [
    g("CRAWL_WEBSITE", "claimed", 2),
    g("CRAWL_WEBSITE", "done", 922),
    g("CRAWL_WEBSITE", "failed", 245),
    g("CRAWL_WEBSITE", "abandoned", 33),
    g("DETECT_TECHNOLOGY", "queued", 45),
    g("DETECT_TECHNOLOGY", "abandoned", 394),
  ];
  const board = stageBoard(rows);
  const crawl = board.find((s) => s.kind === "CRAWL_WEBSITE");
  ok("counts land on the right stage", crawl.done === 922 && crawl.failed === 245 && crawl.claimed === 2, crawl);
  ok("…and total is every status added up", crawl.total === 2 + 922 + 245 + 33, crawl.total);
  ok("…and the crawler reads as working", crawl.state === "working", crawl.state);
  ok("a stage with no rows is still drawn", board.length === TASK_KINDS.length, board.length);
  ok("…as not_started, with a null percentage",
    board.find((s) => s.kind === "GENERATE_RESEARCH_BRIEF").state === "not_started" &&
      board.find((s) => s.kind === "GENERATE_RESEARCH_BRIEF").settled === null);

  // The flattened shape appears elsewhere in this codebase. Reading only one
  // of the two is how a board silently renders every zero.
  const flat = stageBoard([{ kind: "CRAWL_WEBSITE", status: "done", count: 5 }]);
  ok("the flattened { count } shape is read too",
    flat.find((s) => s.kind === "CRAWL_WEBSITE").done === 5);
  ok("a row with neither count shape is skipped rather than counted as NaN",
    stageBoard([{ kind: "CRAWL_WEBSITE", status: "done" }]).find((s) => s.kind === "CRAWL_WEBSITE").done === 0);
  ok("junk rows do not throw", stageBoard([null, {}, { kind: "X" }, 7]).length >= TASK_KINDS.length);
  ok("a non-array does not throw", stageBoard(null).length === TASK_KINDS.length);

  // A kind in the table that nobody lists must not vanish silently — a task
  // counted by nobody is the bug the whole screen exists to prevent.
  const withUnknown = stageBoard([g("SOMETHING_NEW", "queued", 3)]);
  ok("an unknown kind is still shown", withUnknown.some((s) => s.kind === "SOMETHING_NEW"));
  ok("…flagged as unlisted", withUnknown.find((s) => s.kind === "SOMETHING_NEW").known === false);
  ok("…and after the known ones", withUnknown.at(-1).kind === "SOMETHING_NEW");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The sentence, which must not read as a fault when nothing is wrong");
// ═══════════════════════════════════════════════════════════════════════════

{
  const working = boardSummary(stageBoard([g("CRAWL_WEBSITE", "claimed", 2)]));
  ok("a claimed stage is named as running now", working.running?.[0] === "Reading their website", working.running);
  ok("…with the count in flight", working.inFlight === 2);
  ok("…and says so in words", /right now/.test(working.sentence), working.sentence);

  // The state the pipeline is in most of the time. It must not sound broken.
  const waiting = boardSummary(stageBoard([g("DETECT_TECHNOLOGY", "queued", 45)]));
  ok("queued with nothing in flight names nothing as running", waiting.running === null);
  ok("…names what is next", waiting.next === "Working out what software they run", waiting.next);
  ok("…and explains the wait rather than implying a fault",
    /waiting for the next run/.test(waiting.sentence), waiting.sentence);
  ok("…and counts what is outstanding", waiting.outstanding === 45);

  const idle = boardSummary(stageBoard([g("CRAWL_WEBSITE", "done", 100)]));
  ok("an empty queue says finished, not stalled", /Every stage has finished/.test(idle.sentence), idle.sentence);
  ok("…and has nothing outstanding", idle.outstanding === 0);

  ok("failures are counted even while the stage still moves",
    boardSummary(stageBoard([g("CRAWL_WEBSITE", "claimed", 1), g("CRAWL_WEBSITE", "failed", 245)])).stoppedCount === 245);
  ok("no sentence ever prints undefined",
    [working, waiting, idle].every((b) => !/undefined/.test(b.sentence)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. It reaches the screen — the half that was missing");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = read("app/api/platform/sales/campaigns/[id]/route.js");
  // The data was always fetched. Only the failed rows were ever passed on.
  ok("the route groups every kind", /by: \["kind", "status"\]/.test(route));
  ok("…and now passes the whole board on", /stages: stageBoard\(allTasks\)/.test(route));
  ok("…with the summary sentence", /pipeline: boardSummary\(/.test(route));
  ok("…and still reports what has stopped", /stalled:/.test(route));

  const page = read("app/platform/sales/campaigns/[id]/page.js");
  ok("the campaign screen renders the board", /<StageBoard/.test(page));
  ok("…and feeds it what the route sends", /stages=\{data\.stages/.test(page));

  // The freeze this would otherwise have shipped with: the campaign's own
  // status goes false when DISCOVERY stops, while crawling runs for hours
  // after. Polling on that alone stops the board at its most useful moment.
  ok("polling continues while any stage still has work",
    /const shouldPoll = isRunning \|\| outstanding > 0/.test(page), "shouldPoll");
  ok("…driven by the summary's own count", /data\?\.pipeline\?\.outstanding/.test(page));

  const board = read("app/components/sales/StageBoard.js");
  ok("the board states the state in words, not only colour", /tone\.word/.test(board));
  ok("…and every stage is drawn, including the empty ones", !/filter\(\(s\) => s\.total/.test(board));
  ok("…and the progress bar is labelled for a screen reader", /role="progressbar"/.test(board));
  // The three sentences below moved out of the component and into the
  // catalogue when the sales portal was keyed (cf099363), and this check went
  // on reading the component for them — red at HEAD for a day. It now reads
  // the English catalogue entry the board renders, through the key the board
  // names, so a sentence dropped from either side is still caught.
  const catalogue = read("app/i18n/appMessages.js");
  const english = (key) => {
    const m = new RegExp(`^  "${key.replace(/\./g, "\\.")}": "((?:[^"\\\\]|\\\\.)*)",$`, "m").exec(catalogue);
    return m ? m[1] : "";
  };
  ok("the board renders its reading guide through the catalogue",
    /t\("app\.salesQueue\.stageBoardHowItReads"\)/.test(board) && /t\("app\.salesQueue\.stageBoardDownstream"\)/.test(board));
  ok("…and says queued is normal rather than broken",
    /normal state most of the time, not a fault/.test(english("app.salesQueue.stageBoardHowItReads")));
  // A business with no website never enters the crawler, so a crawl count
  // lower than the prospect count is correct rather than missing work.
  ok("…and says why a business can skip the crawler", /no website/i.test(english("app.salesQueue.stageBoardHowItReads")));
  // 402 detections declined because the crawl before them had nothing to hand
  // over. That is shouldAdvance working as documented — "a failure does not
  // strand the prospect" — and a screen that presents it as a fault sends
  // somebody hunting a bug that is not there.
  ok("…and says a declined stage does not strand the business", /not stranded/i.test(english("app.salesQueue.stageBoardDownstream")));

  const stalled = read("app/platform/sales/campaigns/[id]/page.js");
  ok("abandoned is no longer described as nearly always configuration",
    !/nearly always configuration/.test(stalled));
  ok("…and says to read the reason first", /Read\s+the reason before treating it as a fault/.test(stalled));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:pipeline-progress is a script", typeof pkg.scripts?.["check:pipeline-progress"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:pipeline-progress"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Research on claim — the lane, and what rides in it");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("the claim route imports the function from progress.js", viaProgress === ensureResearchQueued);

  // The runner orders `notBefore asc, createdAt asc`. A claimed task's notBefore
  // is fixed before any row this table ever held, so it sorts first; among
  // claimed tasks, createdAt still decides.
  const runner = read("lib/sales/pipeline/runner.js");
  ok("the runner still orders by notBefore first", /orderBy: \[\{ notBefore: "asc" \}, \{ createdAt: "asc" \}\]/.test(runner));
  ok("the claimed notBefore is fixed, in the past", CLAIMED_NOT_BEFORE.getTime() < Date.parse("2025-01-01"));
  ok("…and is what the claimed lane gets", notBeforeFor("claimed") === CLAIMED_NOT_BEFORE);
  ok("…while the backlog lane takes the column default", notBeforeFor("backlog") === null);

  const rows = [
    { id: "backlog-old", notBefore: new Date("2026-09-01"), createdAt: new Date("2026-09-01") },
    { id: "claimed-2", notBefore: CLAIMED_NOT_BEFORE, createdAt: new Date("2026-09-11T10:00:01Z") },
    { id: "backlog-new", notBefore: new Date("2026-09-11"), createdAt: new Date("2026-09-11") },
    { id: "claimed-1", notBefore: CLAIMED_NOT_BEFORE, createdAt: new Date("2026-09-11T10:00:00Z") },
  ];
  const order = [...rows]
    .sort((a, b) => a.notBefore - b.notBefore || a.createdAt - b.createdAt)
    .map((r) => r.id);
  ok("claimed tasks drain before every backlog row, oldest claim first",
    JSON.stringify(order) === JSON.stringify(["claimed-1", "claimed-2", "backlog-old", "backlog-new"]), order);

  ok("a task queued with no lane has none", taskPriority({ payload: { prospectId: "p" } }) === null);
  ok("…and an invented lane is not one", taskPriority({ payload: { priority: "urgent" } }) === null);
  ok("the lane rides in the payload", taskPriority({ payload: { priority: "claimed" } }) === "claimed");

  // The brief stage caches its output under payload.brief. A successor that
  // inherited it would carry a stale brief onto every downstream row.
  const inherited = inheritedPayload({ payload: { priority: "claimed", phrase: false, brief: { x: 1 }, force: true } });
  ok("a successor inherits the lane and the no-phrase flag only",
    JSON.stringify(inherited) === JSON.stringify({ priority: "claimed", phrase: false }), inherited);
  ok("…and nothing when the task had neither", JSON.stringify(inheritedPayload({ payload: { prospectId: "p" } })) === "{}");

  // Executed: advanceChain queues the successor in the same lane.
  const created = [];
  const fakeDb = {
    salesPipelineTask: {
      async findUnique() { return null; },
      async create({ data }) { created.push(data); return { ...data, id: `t${created.length}`, createdAt: new Date() }; },
    },
  };
  await advanceChain({ kind: "CRAWL_WEBSITE", db: fakeDb,
    task: { id: "crawl-1", prospectId: "p1", campaignId: null, payload: { prospectId: "p1", priority: "claimed" } } });
  ok("a claimed crawl's successor is DETECT_TECHNOLOGY", created[0]?.kind === "DETECT_TECHNOLOGY", created[0]);
  ok("…in the claimed lane", created[0]?.payload?.priority === "claimed");
  ok("…with the claimed notBefore", created[0]?.notBefore === CLAIMED_NOT_BEFORE);
  await advanceChain({ kind: "CRAWL_WEBSITE", db: fakeDb,
    task: { id: "crawl-2", prospectId: "p2", campaignId: null, payload: { prospectId: "p2", priority: "backlog", phrase: false } } });
  ok("a backlog crawl's successor keeps phrase:false", created[1]?.payload?.phrase === false);
  ok("…and no notBefore, so the column default applies", created[1]?.notBefore === undefined);
  await advanceChain({ kind: "CRAWL_WEBSITE", db: fakeDb,
    task: { id: "crawl-3", prospectId: "p3", campaignId: null, payload: { prospectId: "p3" } } });
  ok("a discovery-queued crawl's successor is unchanged: no lane, no flag",
    JSON.stringify(created[2]?.payload) === JSON.stringify({ prospectId: "p3" }) && created[2]?.notBefore === undefined, created[2]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Which crawl failures are ours, and get another go");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The top failure in production, verbatim from lastError.
  ok("EBUSY out of the resolver is retryable",
    crawlRetryable("gave up after 5 attempts: robots_error:unsafe_host:dns_error:EBUSY"));
  ok("EAI_AGAIN likewise", crawlRetryable("gave up after 5 attempts: robots_error:unsafe_host:dns_error:EAI_AGAIN"));
  ok("undici's TypeError likewise", crawlRetryable("gave up after 5 attempts: robots_error:TypeError"));
  ok("a host slot another lambda held likewise", crawlRetryable("gave up after 5 attempts: host_slot:defer"));
  ok("our own DNS backoff likewise", crawlRetryable("dns_backoff — held until 2026-09-11T12:00:00.000Z"));
  ok("…and without the runner's prefix too", crawlRetryable("robots_error:unsafe_host:dns_error:EBUSY"));

  // Real refusals. A sixth try is a sixth copy of the same sentence.
  ok("a robots.txt that redirects is not", !crawlRetryable("gave up after 5 attempts: robots_unreachable_301"));
  ok("a 500 on robots.txt is not", !crawlRetryable("gave up after 5 attempts: robots_unreachable_500"));
  ok("a name resolving to a private address is not",
    !crawlRetryable("gave up after 5 attempts: robots_error:unsafe_host:resolves_private"));
  ok("robots.txt saying no is not", !crawlRetryable("robots_disallowed — www.facebook.com robots.txt disallows / (cached)"));
  ok("five timeouts are not", !crawlRetryable("gave up after 5 attempts: robots_error:timeout"));
  ok("a redirect loop is not", !crawlRetryable("too_many_redirects — home page: too_many_redirects"));
  ok("a database error that threw is not", !crawlRetryable("gave up after 5 attempts: threw: could not extend file"));
  ok("nothing is not", !crawlRetryable(null) && !crawlRetryable(""));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The plan — what one prospect still needs, from its rows alone");
// ═══════════════════════════════════════════════════════════════════════════

{
  const site = { id: "p", websiteUrl: "http://www.richmondcontainer.com/", lastCrawledAt: null, doNotContactAt: null, campaignId: "c" };
  const t = (kind, status, extra = {}) => ({ id: `${kind}-${status}-${Math.random().toString(36).slice(2, 6)}`, kind, status, lastError: null, payload: null, createdAt: new Date("2026-09-01"), ...extra });

  ok("the chain is the chain's own order",
    JSON.stringify(RESEARCH_CHAIN) === JSON.stringify(["ENRICH_BUSINESS", "CRAWL_WEBSITE", ...(() => { const w = ["CRAWL_WEBSITE"]; while (NEXT_STAGE[w.at(-1)]) w.push(NEXT_STAGE[w.at(-1)]); return w.slice(1); })()]), RESEARCH_CHAIN);
  ok("…and the no-website chain skips exactly the three page-reading stages",
    JSON.stringify(RESEARCH_CHAIN_NO_WEBSITE) === JSON.stringify(RESEARCH_CHAIN.filter((k) => !["CRAWL_WEBSITE", "DETECT_TECHNOLOGY", "ANALYZE_CAPABILITIES"].includes(k))));

  // Richmond Rolloff, as found: website, URL, never enriched, never crawled.
  const untouched = researchPlan({ prospect: site, tasks: [], priority: "claimed" });
  ok("an untouched prospect gets ENRICH_BUSINESS first, and only that",
    untouched.enqueue.length === 1 && untouched.enqueue[0].kind === "ENRICH_BUSINESS", untouched);
  ok("…in the claimed lane", untouched.enqueue[0]?.payload?.priority === "claimed");
  ok("…ahead of the backlog", untouched.enqueue[0]?.notBefore === CLAIMED_NOT_BEFORE);
  ok("…without moving it out of the claim pool", untouched.enqueue[0]?.payload?.promote === false);
  ok("…phrased, because a rep is waiting", untouched.enqueue[0]?.payload?.phrase === undefined);
  ok("…under a key per prospect and kind", untouched.enqueue[0]?.idempotencyKey === researchKey({ kind: "ENRICH_BUSINESS", prospectId: "p", existing: 0 }));

  const backlog = researchPlan({ prospect: site, tasks: [], priority: "backlog" });
  ok("the backlog lane phrases nothing", backlog.enqueue[0]?.payload?.phrase === false);
  ok("…and takes the column default position", backlog.enqueue[0]?.notBefore === null);
  ok("…and also stays claimable", backlog.enqueue[0]?.payload?.promote === false);

  const enriched = [t("ENRICH_BUSINESS", "done")];
  const crawlNext = researchPlan({ prospect: site, tasks: enriched, priority: "claimed" });
  ok("enriched with a website and no crawl gets CRAWL_WEBSITE", crawlNext.enqueue[0]?.kind === "CRAWL_WEBSITE", crawlNext);

  const ebusy = t("CRAWL_WEBSITE", "failed", { lastError: "gave up after 5 attempts: robots_error:unsafe_host:dns_error:EBUSY" });
  const requeued = researchPlan({ prospect: site, tasks: [...enriched, ebusy], priority: "claimed" });
  ok("an EBUSY crawl is queued again", requeued.enqueue[0]?.kind === "CRAWL_WEBSITE", requeued);
  ok("…under the NEXT key, beside the one that failed",
    requeued.enqueue[0]?.idempotencyKey === researchKey({ kind: "CRAWL_WEBSITE", prospectId: "p", existing: 1 }));

  const exhausted = researchPlan({ prospect: site, tasks: [...enriched, ebusy, { ...ebusy, id: "e2" }, { ...ebusy, id: "e3" }], priority: "claimed" });
  ok(`…but not more than ${MAX_REQUEUES} times`, exhausted.enqueue.length === 0 && exhausted.skipped === "requeues_exhausted", exhausted);

  const refused = t("CRAWL_WEBSITE", "abandoned", { lastError: "robots_error:unsafe_host:resolves_private" });
  const past = researchPlan({ prospect: site, tasks: [...enriched, refused], priority: "claimed" });
  ok("a refused crawl is NOT queued again", !past.enqueue.some((s) => s.kind === "CRAWL_WEBSITE"), past);
  ok("…and the chain continues past it to DETECT_TECHNOLOGY", past.enqueue[0]?.kind === "DETECT_TECHNOLOGY", past);

  const redirected = t("CRAWL_WEBSITE", "failed", { lastError: "gave up after 5 attempts: robots_unreachable_301" });
  ok("a robots redirect is a statement about the site, not re-crawled",
    !researchPlan({ prospect: site, tasks: [...enriched, redirected], priority: "claimed" }).enqueue.some((s) => s.kind === "CRAWL_WEBSITE"));

  const crawled = { ...site, lastCrawledAt: new Date("2026-09-10") };
  const done = RESEARCH_CHAIN.map((k) => t(k, "done"));
  ok("a fully researched prospect needs nothing on the backlog lane",
    researchPlan({ prospect: crawled, tasks: done, priority: "backlog" }).skipped === "complete");

  const half = RESEARCH_CHAIN.slice(0, 4).map((k) => t(k, "done"));
  const resume = researchPlan({ prospect: crawled, tasks: half, priority: "claimed" });
  ok("a chain that stopped resumes at the first missing stage",
    resume.enqueue[0]?.kind === RESEARCH_CHAIN[4], resume);

  const waiting = t("DETECT_TECHNOLOGY", "queued", { payload: { prospectId: "p" } });
  const promote = researchPlan({ prospect: crawled, tasks: [...half.slice(0, 2), waiting], priority: "claimed" });
  ok("a stage already waiting is promoted, not duplicated",
    promote.enqueue.length === 0 && promote.promote[0] === waiting.id, promote);
  ok("…and on the backlog lane it is left where it is",
    researchPlan({ prospect: crawled, tasks: [...half.slice(0, 2), waiting], priority: "backlog" }).skipped === "already_queued");
  const inFlight = t("DETECT_TECHNOLOGY", "claimed");
  ok("a stage in flight this second is left alone",
    researchPlan({ prospect: crawled, tasks: [...half.slice(0, 2), inFlight], priority: "claimed" }).skipped === "in_flight");

  ok("do-not-contact queues nothing", researchPlan({ prospect: { ...site, doNotContactAt: new Date() }, tasks: [], priority: "claimed" }).skipped === "do_not_contact");
  ok("an enrich that refused ends the plan",
    researchPlan({ prospect: site, tasks: [t("ENRICH_BUSINESS", "abandoned")], priority: "claimed" }).skipped === "enrich_refused");
  ok("a missing prospect is a reason, not a throw", researchPlan({ prospect: null }).skipped === "prospect_not_found");
  ok("an invented lane is refused", researchPlan({ prospect: site, priority: "urgent" }).skipped === "unknown_priority");

  const noSite = { ...site, websiteUrl: null };
  const straight = researchPlan({ prospect: noSite, tasks: enriched, priority: "claimed" });
  ok("no website: enriched goes straight to DETECT_OPPORTUNITIES", straight.enqueue[0]?.kind === "DETECT_OPPORTUNITIES", straight);
  const derived = researchPlan({ prospect: noSite, tasks: [...enriched, ebusy], priority: "claimed" });
  ok("…unless enrich already routed it to a crawl (a derived RBQ domain), which is then retried",
    derived.enqueue[0]?.kind === "CRAWL_WEBSITE", derived);
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. ensureResearchQueued, executed — idempotent, and it moves the lane");
// ═══════════════════════════════════════════════════════════════════════════

{
  const store = { prospects: new Map(), tasks: [] };
  let seq = 0;
  const db = {
    prospect: { async findMany({ where }) { return where.id.in.map((id) => store.prospects.get(id)).filter(Boolean); } },
    salesPipelineTask: {
      async findMany({ where }) {
        return store.tasks.filter((t) => where.prospectId.in.includes(t.prospectId) && where.kind.in.includes(t.kind));
      },
      async findUnique({ where }) { return store.tasks.find((t) => t.idempotencyKey === where.idempotencyKey) || null; },
      async create({ data }) {
        if (store.tasks.some((t) => t.idempotencyKey === data.idempotencyKey)) { const e = new Error("dup"); e.code = "P2002"; throw e; }
        const row = { id: `t${++seq}`, status: "queued", attempts: 0, createdAt: new Date(2026, 8, 11, 0, 0, seq), notBefore: data.notBefore ?? new Date(2026, 8, 11, 0, 0, seq), ...data };
        store.tasks.push(row);
        return row;
      },
      async updateMany({ where, data }) {
        let n = 0;
        for (const t of store.tasks) if (t.id === where.id && t.status === where.status) { Object.assign(t, data); n++; }
        return { count: n };
      },
    },
  };
  store.prospects.set("rich", { id: "rich", websiteUrl: "http://www.richmondcontainer.com/", lastCrawledAt: null, doNotContactAt: null, campaignId: null });
  store.prospects.set("gone", { id: "gone", websiteUrl: "http://x.example/", lastCrawledAt: null, doNotContactAt: new Date(), campaignId: null });
  // A backlog crawl already waiting, queued the ordinary way.
  store.tasks.push({ id: "b1", prospectId: "other", kind: "CRAWL_WEBSITE", status: "queued", idempotencyKey: "x", payload: { prospectId: "other" }, createdAt: new Date(2026, 8, 1), notBefore: new Date(2026, 8, 1) });

  const first = await ensureResearchQueued({ db, prospectIds: ["rich", "gone", "missing"], priority: "claimed" });
  ok("the untouched prospect got one task", first.queued === 1 && first.prospects[0].queued[0] === "ENRICH_BUSINESS", first);
  ok("the do-not-contact prospect got none, with the reason", first.prospects[1].skipped === "do_not_contact" && first.prospects[1].queued.length === 0);
  ok("the missing prospect got none, with the reason", first.prospects[2].skipped === "prospect_not_found");
  const enrich = store.tasks.find((t) => t.prospectId === "rich");
  ok("…the row carries the claimed lane and promote:false",
    enrich?.payload?.priority === "claimed" && enrich?.payload?.promote === false, enrich?.payload);
  ok("…and sorts ahead of the backlog crawl that was already waiting",
    [...store.tasks].sort((a, b) => a.notBefore - b.notBefore || a.createdAt - b.createdAt)[0]?.id === enrich?.id);

  const second = await ensureResearchQueued({ db, prospectIds: ["rich"], priority: "claimed" });
  ok("a second call queues nothing", second.queued === 0 && second.promoted === 0, second);
  ok("…and says the stage is already waiting", second.prospects[0].skipped === "already_queued", second.prospects[0]);

  // The enrich settles and the chain queues a crawl in the backlog lane (a
  // stage that was in flight at claim time loses the lane — priority.js says
  // so). The next call promotes it.
  enrich.status = "done";
  store.tasks.push({ id: "c1", prospectId: "rich", kind: "CRAWL_WEBSITE", status: "queued", idempotencyKey: "CRAWL_WEBSITE:rich:t1", payload: { prospectId: "rich" }, createdAt: new Date(2026, 8, 12), notBefore: new Date(2026, 8, 12) });
  const third = await ensureResearchQueued({ db, prospectIds: ["rich"], priority: "claimed" });
  ok("a waiting backlog stage is promoted into the lane", third.promoted === 1 && third.queued === 0, third);
  const crawl = store.tasks.find((t) => t.id === "c1");
  ok("…its notBefore moved to the front", crawl.notBefore === CLAIMED_NOT_BEFORE);
  ok("…and its payload carries the lane for the chain to inherit", crawl.payload.priority === "claimed" && crawl.payload.prospectId === "rich");

  ok("no ids is a no-op, not a throw", (await ensureResearchQueued({ db, prospectIds: [], priority: "claimed" })).queued === 0);
  let threw = null;
  try { await ensureResearchQueued({ db, prospectIds: ["rich"], priority: "urgent" }); } catch (e) { threw = e; }
  ok("an invented lane throws at the caller, before any write", threw instanceof Error);
  threw = null;
  try { await ensureResearchQueued({ prospectIds: ["rich"] }); } catch (e) { threw = e; }
  ok("no db throws", threw instanceof Error);
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. The enrich stage honours promote:false, and says so");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = read("lib/sales/pipeline/handlers/enrichBusiness.js");
  ok("promotion is gated on the payload", /payload\.promote !== false && prospect\.status === RESEARCHABLE_STATUS/.test(src));
  ok("…and the status write uses that gate", /\.\.\.\(mayPromote \? \{ status: RESEARCHING_STATUS \}/.test(src));
  ok("…and the note says the row stayed claimable", /left claimable \(promote: false\)/.test(src));
  // The measured reason, kept in the file: research made a business unclaimable.
  ok("the file records why", /claimCandidateWhere\(\)/.test(src) && /admits[\s*]+`discovered` and nothing else/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. The backlog — bounded, and the arithmetic is in the file");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("the ceiling is five thousand pending", BACKLOG_PENDING_CEILING === 5000);
  ok("a run adds a little more than the crawl budget, so the pool fills and holds",
    BACKLOG_TOPUP_PER_RUN > PROVIDER_LIMITS.http_crawl.maxPerRun && BACKLOG_TOPUP_PER_RUN <= 2 * PROVIDER_LIMITS.http_crawl.maxPerRun,
    { perRun: BACKLOG_TOPUP_PER_RUN, crawl: PROVIDER_LIMITS.http_crawl.maxPerRun });
  ok("an empty queue takes a full slice", backlogRoom({ pending: 0 }) === BACKLOG_TOPUP_PER_RUN);
  ok("a queue at the ceiling takes nothing", backlogRoom({ pending: 5000 }) === 0);
  ok("…nor one past it", backlogRoom({ pending: 9000 }) === 0);
  ok("a queue just under the ceiling takes only the gap", backlogRoom({ pending: 4990 }) === 10);
  ok("garbage is nothing, not NaN", backlogRoom({ pending: "x", ceiling: null, perRun: undefined }) === 0);

  // The arithmetic the comment prints, re-derived from the constants it cites
  // so the sentence and the numbers cannot drift apart.
  const src = read("lib/sales/pipeline/research.js");
  const perHour = PROVIDER_LIMITS.http_crawl.maxPerRun * 60;
  ok("the comment states crawls per hour from limits.js × 60 runs", new RegExp(`${perHour.toLocaleString("en-US")} crawls an hour`).test(src), perHour);
  ok("…and the hours for the measured 42,383", /42,383 \/ 2,400 = 17\.7/.test(src));
  ok("…and the wall-clock bound beside it", /about 14 crawls a run, 840 an hour/.test(src) && /about 50 hours/.test(src));
  ok("…and does not raise a provider budget", PROVIDER_LIMITS.http_crawl.maxPerRun === 40 && PROVIDER_LIMITS.openai.maxPerRun === 40);
  ok("the backlog lane phrases nothing — the comment says free and the plan says phrase:false",
    /phrase: false/.test(src) && /Free by construction/.test(src));

  // Executed: the pending count decides; the picker asks for `room` rows; the
  // rows go to the backlog lane.
  const calls = [];
  let pendingNow = 0;
  const picked = ["a", "b"];
  const db = {
    salesPipelineTask: {
      async count() { return pendingNow; },
      async findMany() { return []; },
      async findUnique() { return null; },
      async create({ data }) { calls.push(data); return { ...data, id: `t${calls.length}`, createdAt: new Date() }; },
      async updateMany() { return { count: 0 }; },
    },
    prospect: { async findMany({ where }) { return where.id.in.map((id) => ({ id, websiteUrl: `http://${id}.example/`, lastCrawledAt: null, doNotContactAt: null, campaignId: null })); } },
    async $queryRaw(strings, ...values) { calls.push({ raw: strings.join("?"), values }); return picked.map((id) => ({ id })); },
  };
  const full = await topUpResearchBacklog({ db, ceiling: 5000, perRun: 60 });
  ok("an empty queue is topped up", full.considered === 2 && full.queued === 2 && full.room === 60, full);
  const raw = calls.find((c) => c.raw);
  ok("…asking for exactly `room` rows", raw && raw.values.includes(60), raw?.values);
  ok("…oldest claimable first: discovered, a URL, no crawl, no task, trade first",
    raw && /status = 'discovered'/.test(raw.raw) && /"lastCrawledAt" IS NULL/.test(raw.raw) && /NOT EXISTS/.test(raw.raw) && /"tradeKey" IS NULL\), p\."createdAt" ASC/.test(raw.raw));
  ok("…and every row queued is in the backlog lane", calls.filter((c) => c.kind).every((c) => c.payload.priority === "backlog" && c.payload.phrase === false && !c.notBefore));
  pendingNow = 5000;
  calls.length = 0;
  const held = await topUpResearchBacklog({ db, ceiling: 5000, perRun: 60 });
  ok("a full queue is left alone — no scan, no writes", held.room === 0 && held.queued === 0 && calls.length === 0, held);

  const route = read("app/api/cron/sales-pipeline/route.js");
  ok("the cron calls it after both drains", route.indexOf("topUpResearchBacklog({ db, now })") > route.lastIndexOf("drainSalesPipeline({"));
  ok("…inside its own try, so a slow scan cannot fail a drain that happened", /try \{\s*backlog = await topUpResearchBacklog/.test(route));
  ok("…and reports it in the body", /result\.backlog = backlog/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. DNS backoff per host — a busy resolver stops burning attempts");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("EBUSY on the lookup is the resolver", resolverBusy("unsafe_host:dns_error:EBUSY"));
  ok("EAI_AGAIN likewise", resolverBusy("robots_error:unsafe_host:dns_error:EAI_AGAIN"));
  ok("out of descriptors likewise", resolverBusy("unsafe_host:dns_error:EMFILE"));
  ok("ENOTFOUND is the name, not the resolver", !resolverBusy("unsafe_host:dns_error:ENOTFOUND"));
  ok("a private address is the name", !resolverBusy("unsafe_host:resolves_private"));
  ok("a timeout is not a lookup", !resolverBusy("timeout") && !resolverBusy(null));

  const t0 = new Date("2026-09-11T12:00:00Z");
  const first = nextDnsBackoff({ failures: 0, now: t0 });
  ok("the first hold is half an hour", first.waitMs === DNS_BACKOFF_BASE_MS && first.failures === 1 && first.until.getTime() === t0.getTime() + DNS_BACKOFF_BASE_MS, first);
  const ladder = [0, 1, 2, 3, 4, 5, 9].map((f) => nextDnsBackoff({ failures: f, now: t0 }).waitMs);
  ok("…doubles per busy answer", ladder[1] === 2 * ladder[0] && ladder[2] === 4 * ladder[0] && ladder[3] === 8 * ladder[0], ladder);
  ok("…and is capped at six hours", ladder[4] === DNS_BACKOFF_MAX_MS && ladder[5] === DNS_BACKOFF_MAX_MS && ladder[6] === DNS_BACKOFF_MAX_MS && DNS_BACKOFF_MAX_MS === BACKOFF_MAX_MS);
  ok("a wild count cannot overflow into an Invalid Date", !Number.isNaN(nextDnsBackoff({ failures: 1e9, now: t0 }).until.getTime()));

  ok("no hold is go", dnsBackoffDecision({ policy: { dnsBackoffUntil: null }, now: t0 }).act === "go");
  ok("a hold in the past is go", dnsBackoffDecision({ policy: { dnsBackoffUntil: new Date(t0 - 1) }, now: t0 }).act === "go");
  const hold = dnsBackoffDecision({ policy: { dnsBackoffUntil: new Date(t0.getTime() + 60_000) }, now: t0 });
  ok("a hold in the future holds, with the wait", hold.act === "hold" && hold.waitMs === 60_000, hold);
  ok("the policy select reads both columns", HOST_POLICY_SELECT.dnsFailures === true && HOST_POLICY_SELECT.dnsBackoffUntil === true);

  // The runner: a handler may lengthen its wait, never shorten it.
  const ladderMs = backoffMs(1);
  ok("the ladder alone, when nothing was asked", failureOutcome({ attempts: 1, minDelayMs: 0 }).delayMs === ladderMs);
  ok("a longer hold wins", failureOutcome({ attempts: 1, minDelayMs: 30 * 60_000 }).delayMs === 30 * 60_000);
  ok("a shorter hold changes nothing", failureOutcome({ attempts: 3, minDelayMs: 1 }).delayMs === backoffMs(3));
  ok("a hold past six hours is cut to six", failureOutcome({ attempts: 1, minDelayMs: 99 * 3600_000 }).delayMs === BACKOFF_MAX_MS);
  ok("garbage is the ladder", failureOutcome({ attempts: 1, minDelayMs: "soon" }).delayMs === ladderMs);
  ok("the ceiling still ends the task", failureOutcome({ attempts: 5, minDelayMs: 60_000 }).status === "failed");
  const runner = read("lib/sales/pipeline/runner.js");
  ok("the runner hands the handler's retryAfterMs to the ladder", /minDelayMs: Number\(result\?\.retryAfterMs\) \|\| 0/.test(runner));
  const handler = read("lib/sales/pipeline/handlers/crawlWebsite.js");
  ok("…and the crawl handler passes the crawler's through", /retryAfterMs: result\.retryAfterMs/.test(handler));

  // Executed: a crawl of a held host returns before any packet leaves, and a
  // busy lookup on robots.txt writes the hold. The fake database answers the
  // exact reads crawlProspectSite makes and nothing wider.
  const hosts = new Map();
  let fetches = 0;
  const fakeDb = {
    prospect: { async findUnique() { return { id: "p", businessName: "Acme", domain: "acme-plumbing.com", websiteUrl: "https://acme-plumbing.com/", hasWebsite: true, lastCrawledAt: null, contentHash: null, doNotContactAt: null, doNotContactReason: null }; } },
    salesSuppression: { async findMany() { return []; } },
    crawlHostPolicy: {
      async findUnique({ where }) { return hosts.get(where.host) || null; },
      async create({ data }) { const row = { id: "h", robotsAllowed: null, robotsFetchedAt: null, crawlDelayMs: null, lastRequestAt: null, requestCount: 0, blockedUntil: null, blockReason: null, dnsFailures: 0, dnsBackoffUntil: null, ...data }; hosts.set(data.host, row); return row; },
      async update({ where, data }) { const row = hosts.get(where.host); Object.assign(row, data); return row; },
      async updateMany({ where, data }) { const row = hosts.get(where.host); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    },
  };
  const busyLookup = async () => { const e = new Error("busy"); e.code = "EBUSY"; throw e; };
  const net = async () => { fetches++; throw new Error("must not be reached"); };
  const clock = () => t0;
  const busy = await crawlProspectSite({ prospectId: "p", deps: { db: fakeDb, clock, lookup: busyLookup, fetchImpl: net } });
  ok("a busy lookup on robots.txt is a retryable failure", busy.outcome === "failed" && busy.retry === true && /EBUSY/.test(busy.reason), busy);
  ok("…that carries the hold as retryAfterMs", busy.retryAfterMs === DNS_BACKOFF_BASE_MS, busy.retryAfterMs);
  ok("…and wrote it on the host", hosts.get("acme-plumbing.com")?.dnsFailures === 1 && hosts.get("acme-plumbing.com")?.dnsBackoffUntil?.getTime() === t0.getTime() + DNS_BACKOFF_BASE_MS, hosts.get("acme-plumbing.com"));
  ok("…without a single fetch", fetches === 0);
  const again = await crawlProspectSite({ prospectId: "p", deps: { db: fakeDb, clock, lookup: busyLookup, fetchImpl: net } });
  ok("the next crawl finds the hold and returns before the lookup", again.reason === "dns_backoff" && again.retry === true && again.retryAfterMs === DNS_BACKOFF_BASE_MS, again);
  ok("…and does not count it as another busy answer", hosts.get("acme-plumbing.com")?.dnsFailures === 1);
  const later = () => new Date(t0.getTime() + DNS_BACKOFF_BASE_MS + 1);
  const second = await crawlProspectSite({ prospectId: "p", deps: { db: fakeDb, clock: later, lookup: busyLookup, fetchImpl: net } });
  ok("after the hold, a second busy answer doubles it", second.retryAfterMs === 2 * DNS_BACKOFF_BASE_MS && hosts.get("acme-plumbing.com")?.dnsFailures === 2, second);
  const cleared = await recordDnsFailure(fakeDb, { host: "acme-plumbing.com", deps: { clock: later } });
  ok("recordDnsFailure returns what it wrote", cleared.failures === 3);
  const src = read("lib/sales/crawl/hostPolicy.js");
  ok("a fetched robots.txt clears the hold and the count", /dnsFailures: 0,\s*dnsBackoffUntil: null,/.test(src));
  ok("the schema carries both columns", /dnsFailures\s+Int\s+@default\(0\)/.test(read("prisma/schema.prisma")) && /dnsBackoffUntil DateTime\?/.test(read("prisma/schema.prisma")));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
