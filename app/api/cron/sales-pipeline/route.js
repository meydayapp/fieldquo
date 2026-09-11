// app/api/cron/sales-pipeline/route.js
//
// Every minute: drain a batch of SalesPipelineTask.
//
// ══ The cadence, and why it changed ════════════════════════════════════════
//
// This ran at `3-59/10` — six ticks an hour, on minutes chosen to collide with
// none of the nineteen other crons, because background prospecting for
// FieldQuo's own team is not late by being ten minutes late. That was true
// while the pipeline fed a handful of reps. It is not the plan any more: the
// owner is staffing 10–20 closers at up to 200 calls a day each, which is
// 4,000 fully-processed prospects a day, and at 144 ticks × BATCH 25 the
// ceiling was 3,600 TASKS a day — about 500 prospects. The interval, not the
// batch, was the lever: 1,440 ticks × 25 is 36,000 task-slots, 28,800 crawls
// and 14,400 briefs a day, which clears 4,000 with room. Decided by the owner
// on 2026-09-06 with the AI cost in front of them (~$3–4/day at gpt-5-mini for
// 4,000 phrased briefs, per lib/ai/usage.js's table).
//
// Every minute DOES land on the other crons' minutes. That is acceptable now
// for a reason it was not before: the runner claims each task with a lease and
// an idempotency key (see runner.js), so two invocations draining at once
// cannot double-run a task, and a drain that dies mid-handler is reclaimed by
// the next tick. The remaining cost is pool pressure on the shared minutes, and
// BATCH stays at 25 precisely so each drain is short. Neon's cold-start P1001
// is retried once, as everywhere (AGENTS.md, "Environment gotchas").
//
// The next lever, when 8,000 a day is wanted, is BATCH 50 — which is a decision
// about how long one invocation may run (see below), not a schedule edit.
//
// ══ How long a campaign actually takes — say it plainly ════════════════════
//
// 6 ticks/hour × 24 = 144 invocations a day. At BATCH = 25 that is a ceiling of
// 3,600 tasks a day, and the per-provider budgets in limits.js pull the real
// figure below that for any run that is mostly one provider.
//
// A 1,000-prospect campaign is roughly seven tasks per prospect (enrich, crawl,
// detect technology, analyse capabilities, detect opportunities, score, brief)
// plus discovery paging: call it 7,000-7,100 tasks. At 3,600/day that is a
// little under TWO DAYS, not "overnight" — and the sequential stages add a
// small tail on top, since a prospect's seventh stage cannot be queued until
// its sixth finished. docs/sales-intel/STATUS.md estimates "about a day"; that
// figure needs BATCH = 50, which is a real decision about how long one
// invocation may run rather than a tuning knob, and it is not taken here.
//
// ── The duration decision this comment used to defer ──────────────────────
//
// It said BATCH = 50 "is a real decision about how long one invocation may run
// rather than a tuning knob, and it is not taken here", and that no
// `maxDuration` was exported so every function ran at whatever the dashboard
// said — which this code could not read and would not guess.
//
// The decision is taken now, and the guess is removed rather than replaced by
// a better guess: the limit is DECLARED here, so it no longer depends on a
// dashboard setting nobody can see from the source. 300 seconds is the ceiling
// for a Node function on this project's plan — the per-minute cron schedule in
// vercel.json only runs at all on that plan, so it is not an assumption about
// billing, it is implied by a schedule that is already working.
//
// At a couple of seconds per task a drain of 50 is ~100s, comfortably inside
// 300 and still finishing long before the next tick. If a future BATCH makes
// that untrue the number to check is this one, which is now in the file.
export const maxDuration = 300;

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { drainSalesPipeline } from "@/lib/sales/pipeline/runner";
import { handlerStatus } from "@/lib/sales/pipeline/registry";
import { topUpResearchBacklog } from "@/lib/sales/pipeline/research";

// Same reasoning as grace-warning's BATCH: the query is driven by `status`,
// not a cursor, so leftovers are picked up by the next tick and nothing is
// dropped. Small because the work per row is a network call to somebody else's
// server, unlike grace-warning's, which is one email.
// ── 25 -> 50, the lever this file's own header names as "the next one" ────
//
// Every task waits its turn in one FIFO queue, so the drain rate IS the wait.
// Measured: ~1,000 tasks/hour completing and an average wait of about
// twenty-three minutes, which is the queue depth divided by this number.
// Doubling it roughly halves the wait for everything, including the discovery
// page that is the head of the funnel.
//
// The caution above still holds and is why this is 50 and not 200: the work per
// row is a network call to somebody else's server. Fifty keeps each drain short
// enough to finish well inside a function's lifetime, and the per-provider
// budgets in limits.js still cap what any one stage may spend in a run — this
// raises the floor on throughput, not the ceiling on politeness.
// Raised from 50 with the provider ceilings, not instead of them.
//
// The loop in drainSalesPipeline is SEQUENTIAL — `for (const candidate of
// candidates)` — so this is the number of tasks one invocation may walk, and
// the invocation has `maxDuration = 300` against a cron that fires every 60
// seconds. At 50 the run was finishing early and idle: measured completions
// averaged 28 a minute with 1,414 tasks queued and ready, because most of the
// batch was deferred on a provider ceiling rather than executed.
//
// 100 is the largest value the pipeline's own rule allows: scripts/
// check-sales-pipeline.mjs asserts `maxDuration >= BATCH x 2 x 1.5`, which is
// two seconds a task with half again for margin, and 300 / 3 is 100. I reached
// for 250 first; the check refused it, and the check was right — it reasons
// from the declared limit where I had reasoned from a peak-minute measurement
// that conflated several invocations. Five of the eight stages are `local` —
// enrich, technology, capabilities, opportunities, lead score — and cost
// nothing outside the process, so a run that is mostly local finishes in
// seconds and a run that is mostly provider-backed is bound by
// lib/sales/pipeline/limits.js, which is where that decision belongs.
//
// 1,440 ticks x 100 is 144,000 tasks a day, roughly 20,000 prospects — well
// past the 12,000 asked for, and deliberately so: the ceiling that should bind
// is a provider budget somebody costed, not an arbitrary loop bound.
const BATCH = 100;

// How many discovery pages one invocation may take before anything else runs.
// Deliberately small: each spends a paid directory call and yields up to
// PROMOTE_LIMIT prospects, so six a minute is 360 pages an hour — 36,000
// prospects an hour of headroom, far past what the enrichment side can absorb.
// The point is priority, not volume.
const DISCOVERY_SLICE = 6;

export async function GET(request) {
  // First, before any work — this header is the entire authentication boundary
  // for a job that spends a directory API quota and a model vendor's budget.
  const denied = requireCronSecret(request);
  if (denied) return denied;

  // ── Discovery gets its own slice, taken FIRST ──────────────────────────
  //
  // The queue is one FIFO ordered by `notBefore asc, createdAt asc`, and
  // discovery is a SERIAL CHAIN: one page per task, the next page enqueued only
  // when that one finishes. So every page of 100 prospects enqueues roughly 700
  // enrichment tasks — enrich, crawl, technology, capabilities, opportunities,
  // score, brief — and the NEXT discovery page is created after all of them and
  // sorts behind all of them.
  //
  // The pipeline therefore ate its own tail: the more it discovered, the longer
  // the next discovery waited. Measured with 1,414 tasks queued — discovery
  // completions were 4, 9, 7, 13, 13 and 2 an hour, and prospects arrived in
  // bursts of exactly PROMOTE_LIMIT with nothing in between. Raising the
  // discovery budget could not touch it: only six discovery tasks existed to
  // spend it on. Starvation, not a ceiling.
  //
  // Draining discovery on its own first is the whole fix, and it is why the
  // runner takes `kinds`. The slice is small because each task is expensive at
  // the provider and produces a hundred prospects: what matters is that the
  // next page is never behind an enrichment backlog, not that many run at once.
  const now = new Date();
  const discovery = await drainSalesPipeline({
    now,
    limit: DISCOVERY_SLICE,
    kinds: ["DISCOVER_BUSINESSES"],
  });

  // Then everything else, with the batch reduced by what discovery just spent,
  // so the invocation's serial-time budget is unchanged — the check asserts
  // maxDuration against BATCH, and this must not quietly exceed it.
  const result = await drainSalesPipeline({
    now,
    limit: Math.max(0, BATCH - discovery.considered),
  });
  result.discovery = discovery;

  // ── Then the backlog: websites nobody has read, a slice per run ──────────
  //
  // 42,383 prospects had a website and no crawl when this was added, and only
  // a discovery page had ever queued research — so a board-imported row could
  // sit for ever with a URL nothing read. This adds up to
  // BACKLOG_TOPUP_PER_RUN of them a run, oldest claimable first, and stops
  // while BACKLOG_PENDING_CEILING enrich-or-crawl tasks are already waiting;
  // the arithmetic (2,400 crawls an hour at the provider ceiling, ~840 at the
  // run's wall clock — 18 to 50 hours for the lot) is printed above the
  // function in lib/sales/pipeline/research.js. It runs AFTER the drains so a
  // slow drain shortens this rather than the other way round, and it is two
  // reads plus at most sixty small writes — a second, against the 100 s the
  // duration rule budgets for the batch. Nothing in it calls a model: the
  // backlog lane phrases nothing.
  //
  // Its own try/catch, because a failure here — Neon cold, a slow scan — must
  // not turn a drain that already happened into a 500 the cron log reads as
  // "the pipeline did not run".
  let backlog;
  try {
    backlog = await topUpResearchBacklog({ db, now });
  } catch (err) {
    backlog = { error: err?.message || String(err) };
  }
  result.backlog = backlog;

  // handlers is in the response on purpose: until the eight stages are written,
  // the truthful answer to "did the pipeline run?" includes which stages exist.
  // A success body that hid that would be the dead-control failure in JSON.
  return NextResponse.json({ success: true, batch: BATCH, ...result, handlers: handlerStatus() });
}
