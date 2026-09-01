// app/api/cron/social-scheduled-publish/route.js
//
// Fires every SocialPublish row whose scheduled time has arrived and that
// FieldQuo itself is responsible for firing — see docs/SOCIAL-SCHEDULING.md.
// Same CRON_SECRET pattern as the other 16 crons in vercel.json.
//
// ══ Which rows this cron touches, and which it deliberately never does ═════
//
// A `scheduled` Facebook row for a REAL (non-mock) company is NOT here —
// Meta's own native scheduler (scheduled_publish_time on
// POST /{page-id}/photos, called synchronously in the publish route the
// moment the contractor hit Schedule) already holds and fires that post.
// This cron would have nothing to do for it and nothing to confirm either —
// FieldQuo does not currently poll Meta to verify a natively-scheduled post
// actually went live (see docs/SOCIAL-SCHEDULING.md, "What was not built").
//
// Everything else needs this cron, because nothing else will ever fire it:
//   - every Instagram row, real or mock — Instagram's Content Publishing API
//     has no scheduling parameter at all (re-confirmed against Meta's live
//     docs 31 Aug 2026), so "scheduled" has only ever meant "FieldQuo is
//     holding this and will call the real API itself, later."
//   - every MOCK row regardless of platform — a demo connection
//     (lib/social/metaConnection.js) has no real Meta account behind it for
//     any scheduler, native or otherwise, to act on.
//
// ══ Container timing ════════════════════════════════════════════════════
//
// An Instagram container is created HERE, at fire time, by calling the
// exact same publishToInstagram() an immediate publish uses — never at
// schedule time. Meta's containers expire 24 hours after creation; a
// container made when a post is scheduled three days out would already be
// dead by the time this cron ever looked at it, and the failure would be
// silent until someone noticed the post never went out. See the publish
// route's own comments for the schedule-time half of this — nothing is
// created there for Instagram at all.
//
// ══ Idempotency — the one thing this file cannot get wrong ═════════════════
//
// Vercel Cron does not guarantee at-most-once delivery, and this fires real,
// irreversible posts under a contractor's own name. The guard is a single
// atomic UPDATE ... WHERE status='scheduled' AND firingClaimedAt IS NULL —
// never a read-then-write — copied from app/api/cron/appointment-
// reminders.js's identical claim-before-send pattern (see fireOne() below).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { getMetaConnection } from "@/lib/social/metaConnection";
import { publishToInstagram, publishToFacebook, PublishRefusal } from "@/lib/social/publishDesign";
import * as metaGraphClient from "@/lib/social/metaGraphClient";
import * as mockMetaGraphClient from "@/lib/social/mockMetaGraphClient";
import { recordError } from "@/lib/platform/errorLog";

// Bounds one invocation. Whatever's left over is picked up by the next run —
// the interval this needs is documented in docs/SOCIAL-SCHEDULING.md; this
// worktree may not edit vercel.json itself.
const BATCH_LIMIT = 25;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();

  const due = await db.socialPublish.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: now },
      OR: [{ platform: "instagram" }, { isMock: true }],
    },
    orderBy: { scheduledFor: "asc" },
    take: BATCH_LIMIT,
  });

  let fired = 0;
  let failed = 0;
  let claimLost = 0;

  for (const row of due) {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await fireOne(row, now);
    if (outcome === "fired") fired += 1;
    else if (outcome === "claim_lost") claimLost += 1;
    else failed += 1;
  }

  return NextResponse.json({ success: true, considered: due.length, fired, failed, claimLost });
}

/**
 * @returns {"fired"|"failed"|"claim_lost"}
 */
async function fireOne(row, now) {
  // ── The double-post guard, in full ──────────────────────────────────────
  //
  // An UPDATE whose WHERE re-asserts the exact state the list query above
  // saw — status still 'scheduled', never yet claimed — is what makes this
  // safe under two overlapping cron invocations. Whichever one's UPDATE
  // lands second matches zero rows (Postgres serialises the two UPDATEs
  // against each other even without an explicit transaction) and returns
  // claim_lost immediately, touching nothing else about the row.
  const claim = await db.socialPublish.updateMany({
    where: { id: row.id, status: "scheduled", firingClaimedAt: null },
    data: { firingClaimedAt: now, status: "publishing" },
  });
  if (claim.count === 0) return "claim_lost";

  // ── Re-fetch the connection fresh — never trust what the row remembers ──
  //
  // Two hostile cases the brief names explicitly, both handled by reading
  // reality now instead of trusting anything captured at schedule time:
  const connection = await getMetaConnection(row.companyId).catch(() => null);

  // Case 1: the connection was revoked (disconnected, or a token expired)
  // between scheduling and firing.
  if (!connection?.connected) {
    await db.socialPublish.update({
      where: { id: row.id },
      data: {
        status: "failed",
        errorMessage:
          "The Meta connection was no longer active when this post's scheduled time arrived.",
      },
    });
    return "failed";
  }

  // Case 2: isMock is compared against connection.mock, RE-DERIVED from
  // Company.isDemo right now — never trusted from row.isMock, which is only
  // ever written once, at schedule time. Company.isDemo does not change on
  // its own, so this should never fire; if it ever does, refusing loudly is
  // the only acceptable answer for the one invariant this whole feature
  // depends on — a real company must never reach the mock client, and a
  // demo company must never reach the real one.
  if (Boolean(connection.mock) !== Boolean(row.isMock)) {
    await recordError({
      area: "social-scheduled-publish",
      message: `SocialPublish ${row.id}: isMock mismatch at fire time (row=${row.isMock}, connection=${connection.mock})`,
      companyId: row.companyId,
    }).catch(() => {});
    await db.socialPublish.update({
      where: { id: row.id },
      data: {
        status: "failed",
        errorMessage: "Refused: the account's demo status changed between scheduling and firing.",
      },
    });
    return "failed";
  }

  const client = connection.mock ? mockMetaGraphClient : metaGraphClient;

  try {
    // No `design` lookup anywhere in this function — deliberately. Every
    // field either call needs (imageUrl, caption, width, height) was
    // captured on THIS row at schedule time, precisely so a design deleted
    // in the meantime (MarketingDesign.socialPublishes' onDelete: SetNull —
    // see prisma/schema.prisma) changes nothing about whether this fires.
    const result =
      row.platform === "instagram"
        ? await publishToInstagram({
            connection,
            imageUrl: row.imageUrl,
            caption: row.caption,
            width: row.width,
            height: row.height,
            client,
          })
        : await publishToFacebook({
            connection,
            imageUrl: row.imageUrl,
            caption: row.caption,
            client,
            // No scheduledPublishTime: this cron IS the scheduled moment,
            // so publishToFacebook() publishes immediately, exactly the way
            // it would for any other now-publish call.
          });

    await db.socialPublish.update({
      where: { id: row.id },
      data: {
        status: "published",
        externalContainerId: result.containerId || row.externalContainerId || null,
        externalPostId: result.postId,
        publishedAt: now,
      },
    });
    return "fired";
  } catch (err) {
    if (err instanceof PublishRefusal) {
      const status = err.code === "rate_limited" ? "rate_limited" : "failed";
      await db.socialPublish.update({
        where: { id: row.id },
        data: {
          status,
          errorMessage: err.message,
          externalContainerId: err.containerId || row.externalContainerId || null,
        },
      });
      return "failed";
    }

    console.error("[cron/social-scheduled-publish]", row.id, err);
    await db.socialPublish.update({
      where: { id: row.id },
      data: { status: "failed", errorMessage: "Unexpected error while firing a scheduled post." },
    });
    return "failed";
  }
}
