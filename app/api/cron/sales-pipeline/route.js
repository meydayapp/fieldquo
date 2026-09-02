// app/api/cron/sales-pipeline/route.js
//
// Every ten minutes: drain a batch of SalesPipelineTask.
//
// ══ The cadence, and why this minute ═══════════════════════════════════════
//
// `3-59/10` — :03, :13, :23, :33, :43, :53. Six ticks an hour.
//
// The offset is not decoration. There are nineteen other crons in vercel.json
// and they cluster: `*/5` fires on every multiple of five, `*/15` on :00 :15
// :30 :45, and the hourly ones sit on :00, :15, :35 and :50. Every one of those
// minutes is a moment when several functions are already competing for the same
// Postgres pool — and Neon scales to zero, so the first connection after idle
// can fail outright (AGENTS.md, "Environment gotchas"). Minutes 3/13/23/33/43/53
// collide with none of them. `*/10` would have collided with the `*/5` jobs on
// every other tick for no benefit.
//
// Ten minutes rather than five: this is background prospecting for FieldQuo's
// own sales team, not a customer-facing job. Nothing here is late by being ten
// minutes late, and halving the interval would double the number of
// invocations racing the crons above without halving the drain time, which is
// bounded by BATCH per tick either way.
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
// No `maxDuration` is exported anywhere in this repository, so every function
// runs at whatever the Vercel project dashboard is set to. This code cannot
// read that setting and does not guess it. What it does instead is keep the
// batch small enough that a serial drain at a couple of seconds per task
// finishes in well under a minute; if a future BATCH makes that untrue, the
// number to check is the dashboard's, not one invented in a comment.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { drainSalesPipeline } from "@/lib/sales/pipeline/runner";
import { handlerStatus } from "@/lib/sales/pipeline/registry";

// Same reasoning as grace-warning's BATCH: the query is driven by `status`,
// not a cursor, so leftovers are picked up by the next tick and nothing is
// dropped. Small because the work per row is a network call to somebody else's
// server, unlike grace-warning's, which is one email.
const BATCH = 25;

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
