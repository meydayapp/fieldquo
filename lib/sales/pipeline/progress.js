// lib/sales/pipeline/progress.js
//
// What the pipeline is doing, in words a person can read.
//
// ══ What was missing ══════════════════════════════════════════════════════
//
// The campaign screen could show two things: how many businesses had been
// accepted, and which stages had STOPPED. Between those two facts sat the
// entire pipeline — eight stages, thousands of tasks — and nothing said which
// one was running, which had finished, or what came next. The owner asked the
// obvious question: "how is the website crawler working.. i don't see any
// banners or status updates telling me that x step is running.. y one is
// completed z is the next one".
//
// The data was never missing. The campaign route has always grouped every task
// by (kind, status) — and then kept only the rows whose status was `failed` or
// `abandoned`, discarding the healthy ones before they reached the screen. So
// a working pipeline rendered as a blank space, which reads exactly like a
// broken one.
//
// ══ Why the stage names are translated here ═══════════════════════════════
//
// `DETECT_TECHNOLOGY` is the right name in a queue and the wrong one on a
// screen. The label says what the stage DOES to a business, in the order it
// happens, because the question being answered is "what is it doing right
// now" and "CRAWL_WEBSITE — claimed 2" does not answer it.
//
// ══ `claimed` is the only status that means "right now" ═══════════════════
//
// The runner sets `claimed` when it picks a task up and `done`, `failed` or
// `abandoned` when it puts it down. There is no `running`. A stage with a
// claimed task is a stage with a lambda inside it this second; a stage with
// only queued tasks is a stage waiting its turn. Conflating the two is what
// makes a screen say "running" for six hours and mean nothing by it.
//
// Pure over rows the caller has already read, so scripts/check-pipeline-
// progress.mjs drives every state without a database.
import { TASK_KINDS } from "./kinds";

/**
 * What each stage does, in the order it happens.
 *
 * `what` is one sentence, present tense, about a single business — the level a
 * person actually thinks at. It is deliberately not a description of the code.
 */
export const STAGES = Object.freeze([
  {
    kind: "DISCOVER_BUSINESSES",
    label: "Finding businesses",
    what: "Pages through the directory file and accepts the rows that look like contractors.",
  },
  {
    kind: "ENRICH_BUSINESS",
    label: "Checking we may contact them",
    what: "Re-reads the row against the do-not-contact and suppression lists, then sends it to the crawler — or straight past it, if the business has no website.",
  },
  {
    kind: "CRAWL_WEBSITE",
    label: "Reading their website",
    what: "Asks robots.txt, then fetches a few pages and records what they say. Skips a site crawled recently.",
  },
  {
    kind: "DETECT_TECHNOLOGY",
    label: "Working out what software they run",
    what: "Matches the pages against known signatures — the booking widget, the CMS, the competitor.",
  },
  {
    kind: "ANALYZE_CAPABILITIES",
    label: "Seeing what their site can do",
    what: "Forms, booking links, schema.org blocks — what a homeowner can actually do on the site.",
  },
  {
    kind: "DETECT_OPPORTUNITIES",
    label: "Finding what they are missing",
    what: "Turns those capabilities into the gaps worth a phone call. No quoting online, no booking, no reviews.",
  },
  {
    kind: "CALCULATE_LEAD_SCORE",
    label: "Scoring the lead",
    what: "Ranks the business against the rest of the campaign so a rep calls the best one first.",
  },
  {
    kind: "GENERATE_RESEARCH_BRIEF",
    label: "Writing the rep's brief",
    what: "The one page a rep reads before dialling. The only stage that spends money at a model.",
  },
]);

const BY_KIND = new Map(STAGES.map((s) => [s.kind, s]));

/** The stage's own copy, or an honest placeholder for a kind added without one. */
export function describeStage(kind) {
  return (
    BY_KIND.get(kind) || {
      kind,
      // Never invent a sentence for a stage nobody has described. The raw name
      // is ugly and true; a guess would be neither.
      label: kind,
      what: null,
    }
  );
}

/**
 * One stage's state, from its own counts.
 *
 * The order is the order a person cares about. A stage with a task in flight is
 * WORKING even if it also has failures, because "is it moving" outranks "has it
 * ever gone wrong" — the failures are still counted and still shown.
 */
export function stageState({ claimed = 0, queued = 0, done = 0, failed = 0, abandoned = 0 } = {}) {
  if (claimed > 0) return "working";
  if (queued > 0) return "waiting";
  // Nothing left to do and something went wrong: this is the state that used
  // to be the ONLY one the screen could show.
  if (failed + abandoned > 0) return "stopped";
  if (done > 0) return "done";
  return "not_started";
}

/**
 * The whole board, in chain order.
 *
 * @param rows  what `groupBy({ by: ["kind", "status"] })` returns — either
 *              Prisma's `{ kind, status, _count: { _all } }` or a flattened
 *              `{ kind, status, count }`. Both shapes appear in this codebase
 *              and reading only one of them is how a board silently zeroes.
 */
export function stageBoard(rows = []) {
  const counts = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.kind || !r?.status) continue;
    if (!counts.has(r.kind)) counts.set(r.kind, {});
    const n = typeof r.count === "number" ? r.count : r?._count?._all;
    if (typeof n !== "number" || !Number.isFinite(n)) continue;
    counts.get(r.kind)[r.status] = (counts.get(r.kind)[r.status] || 0) + n;
  }

  // TASK_KINDS is the chain order and the closed set. A kind in the table that
  // is not in it is still shown, at the end, rather than silently dropped —
  // a task nobody counts is exactly the bug this screen exists to prevent.
  const extra = [...counts.keys()].filter((k) => !TASK_KINDS.includes(k)).sort();

  return [...TASK_KINDS, ...extra].map((kind) => {
    const c = counts.get(kind) || {};
    const queued = c.queued || 0;
    const claimed = c.claimed || 0;
    const done = c.done || 0;
    const failed = c.failed || 0;
    const abandoned = c.abandoned || 0;
    const stage = describeStage(kind);
    return {
      kind,
      label: stage.label,
      what: stage.what,
      queued,
      claimed,
      done,
      failed,
      abandoned,
      total: queued + claimed + done + failed + abandoned,
      // How much of what was queued has been dealt with, one way or another.
      // Null rather than 0 when there is nothing: an empty stage has no
      // percentage, and printing 0% for "has not started" says the wrong thing.
      settled: settledPercent({ queued, claimed, done, failed, abandoned }),
      state: stageState({ claimed, queued, done, failed, abandoned }),
      known: TASK_KINDS.includes(kind),
    };
  });
}

/**
 * How much of the stage is dealt with, as a percentage that never lies.
 *
 * Rounding is capped at 99 while anything is still queued or in flight. 922
 * done and 245 failed out of 1,169 is 99.83%, which rounds to 100 — and a bar
 * reading 100% beside two crawls still running is the exact shape of "a
 * control that appears to work and doesn't". 100 is reserved for a stage with
 * nothing left.
 */
export function settledPercent({ queued = 0, claimed = 0, done = 0, failed = 0, abandoned = 0 } = {}) {
  const total = queued + claimed + done + failed + abandoned;
  if (total === 0) return null;
  const settled = done + failed + abandoned;
  const pct = Math.round((settled / total) * 100);
  if (queued + claimed > 0) return Math.min(pct, 99);
  return pct;
}

/**
 * The one-line answer: what is running, what is next, is anything stuck.
 *
 * Written as a sentence rather than a set of counters because the question it
 * answers is asked in a sentence. `null` for `running` is a real answer and
 * says so — an idle pipeline with work queued is a different problem from an
 * idle pipeline with nothing left, and the two must not read the same.
 */
export function boardSummary(board = []) {
  const rows = Array.isArray(board) ? board : [];
  const working = rows.filter((s) => s.state === "working");
  const waiting = rows.filter((s) => s.state === "waiting");
  const stopped = rows.filter((s) => s.state === "stopped" || s.failed + s.abandoned > 0);
  const inFlight = rows.reduce((n, s) => n + s.claimed, 0);
  const outstanding = rows.reduce((n, s) => n + s.queued + s.claimed, 0);

  return {
    running: working.length ? working.map((s) => s.label) : null,
    next: waiting.length ? waiting[0].label : null,
    // Every stage with something wrong, whether or not it is also moving.
    stoppedCount: stopped.reduce((n, s) => n + s.failed + s.abandoned, 0),
    inFlight,
    outstanding,
    // The sentence itself, composed here so the screen and any future digest
    // cannot word the same state two different ways.
    sentence: sentenceFor({ working, waiting, inFlight, outstanding }),
  };
}

function sentenceFor({ working, waiting, inFlight, outstanding }) {
  if (working.length) {
    const names = working.map((s) => s.label.toLowerCase());
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    return `Working on ${list} right now — ${inFlight} ${inFlight === 1 ? "task" : "tasks"} in flight.`;
  }
  if (waiting.length) {
    // The honest description of a queue between ticks. The runner drains on a
    // schedule, so "queued, nothing in flight" is the NORMAL state most of the
    // time and must not read as a fault.
    return `${outstanding} ${outstanding === 1 ? "task is" : "tasks are"} queued, waiting for the next run. Next up: ${waiting[0].label.toLowerCase()}.`;
  }
  return "Nothing queued. Every stage has finished what it was given.";
}
