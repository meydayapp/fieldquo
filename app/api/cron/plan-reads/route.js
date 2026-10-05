// app/api/cron/plan-reads/route.js
//
// Every two minutes: resume paid drawing reads that stopped between slices
// because nobody had the page open (lib/planRead/backstop.js says why, and why
// it can neither double-run a slice nor charge twice).
//
// ══ The cadence ════════════════════════════════════════════════════════════
//
// A read that pauses releases its lease at once, so the wait a closed tab
// costs is up to one tick. Two minutes keeps that wait small against a read
// that takes three to nine, and the tick that finds nothing is one indexed
// query. Overlapping ticks are harmless: a slice runs up to 270 seconds, and
// the next tick finds that read's lease held and moves on.
export const runtime = "nodejs";
// One slice per read, side by side — advanceRead's own 270-second budget plus
// the lease slack is what this has to fit.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { resumeStalledReads } from "@/lib/planRead/backstop";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  let out;
  try {
    out = await resumeStalledReads({ now: new Date() });
  } catch (err) {
    // Neon scales to zero: the first query after idle can fail with P1001.
    // Once more before believing it (AGENTS.md, "Environment gotchas").
    if (err?.code !== "P1001") throw err;
    out = await resumeStalledReads({ now: new Date() });
  }
  return NextResponse.json({ ok: true, ...out });
}
