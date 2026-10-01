// app/api/cron/video-archive/route.js
//
// Moves video posts out of Cloudinary into Cloudflare R2, 30 days after their
// publishing finished (owner-approved 2026-09-29). The why — Cloudinary bills
// storage every month for ever, R2 at a fortieth of the price — and every
// rule are in lib/marketing/videoArchive.js; the copy → verify → remove order
// is in lib/marketing/videoArchiveServer.js.
//
// ══ Declared and authenticated like every other cron ══════════════════════
//
// Listed in vercel.json, gated by requireCronSecret — the one mechanism this
// repo uses for deferred work (see /api/cron/messaging-media's header for
// why a queue or waitUntil would be a second, unmonitored one).
//
// ══ Not configured = do nothing ═══════════════════════════════════════════
//
// Without all four R2_* variables the run returns at once, before a single
// database read: nothing is claimed, stamped, copied or removed, and
// /platform/costs names the missing variables.
//
// ══ Hourly, a few clips at a time ═════════════════════════════════════════
//
// Each clip is a stream of up to a few hundred MB, so a run takes at most
// ARCHIVE_MAX_PER_RUN and starts none after ARCHIVE_TIME_BUDGET_MS. Hourly
// gives ~100 a day of headroom, well past what the video packs can produce;
// nothing about a clip that waits an extra hour at day 30 costs anything
// noticeable.
export const runtime = "nodejs";
// A large clip streamed Cloudinary → R2 takes longer than the default limit.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { archiveDeps, runArchiveBatch } from "@/lib/marketing/videoArchiveServer";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const deps = archiveDeps();
  if (!deps.configured) {
    return NextResponse.json({ ok: true, skipped: "not_configured", missing: deps.missing });
  }

  const run = await runArchiveBatch(deps);
  const failed = run.results.filter((r) => r.outcome === "failed");
  if (failed.length) {
    // Nothing was removed for any of these — the error is on the row and the
    // next run retries. Logged so /platform/errors shows a copy that keeps
    // failing rather than it being found by looking at a bill.
    await recordError({
      area: "video-archive",
      code: "archive_failed",
      message: `${failed.length} video post(s) could not be archived this run; nothing was removed from Cloudinary for them.`,
      detail: { failed: failed.slice(0, 10) },
    }).catch(() => {});
  }
  return NextResponse.json({
    ok: true,
    // Looked at, due, and what happened to each — "nothing was due" and
    // "everything failed" must never read the same in the cron log.
    looked: run.looked,
    due: run.due,
    archived: run.results.filter((r) => r.outcome === "archived").length,
    failed: failed.length,
    results: run.results.slice(0, 10),
  });
}
