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
import { drainSalesPipeline } from "@/lib/sales/pipeline/runner";
import { handlerStatus } from "@/lib/sales/pipeline/registry";

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
const BATCH = 50;

export async function GET(request) {
  // First, before any work — this header is the entire authentication boundary
  // for a job that spends a directory API quota and a model vendor's budget.
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const result = await drainSalesPipeline({ now: new Date(), limit: BATCH });

  // handlers is in the response on purpose: until the eight stages are written,
  // the truthful answer to "did the pipeline run?" includes which stages exist.
  // A success body that hid that would be the dead-control failure in JSON.
  return NextResponse.json({ success: true, batch: BATCH, ...result, handlers: handlerStatus() });
}
