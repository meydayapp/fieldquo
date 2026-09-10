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
import { NEXT_STAGE } from "@/lib/sales/pipeline/chain";

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
  let walked = ["CRAWL_WEBSITE"];
  while (NEXT_STAGE[walked.at(-1)]) walked.push(NEXT_STAGE[walked.at(-1)]);
  ok("the linear tail is in NEXT_STAGE's own order",
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
  ok("…and says queued is normal rather than broken", /normal state most of the time, not a fault/.test(board));
  // A business with no website never enters the crawler, so a crawl count
  // lower than the prospect count is correct rather than missing work.
  ok("…and says why a business can skip the crawler", /no website/i.test(board));
  // 402 detections declined because the crawl before them had nothing to hand
  // over. That is shouldAdvance working as documented — "a failure does not
  // strand the prospect" — and a screen that presents it as a fault sends
  // somebody hunting a bug that is not there.
  ok("…and says a declined stage does not strand the business", /not stranded/i.test(board));

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

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
