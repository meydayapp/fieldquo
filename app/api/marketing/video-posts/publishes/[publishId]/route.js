// app/api/marketing/video-posts/publishes/[publishId]/route.js
//
// The video screen's poll after "Sent — processing on Instagram…": one Meta
// read per GET, and the row moved to what Meta said. For an Instagram Reel
// this is ALSO where media_publish happens, the moment the container is
// FINISHED — so the row is claimed first (an UPDATE … WHERE status =
// 'container_created', the same claim-before-act pattern as
// SocialPublish.firingClaimedAt's cron), and only the request that wins the
// claim publishes. Two tabs polling the same post cannot publish it twice.
//
// A claim older than CLAIM_STALE_MS whose container is still FINISHED (the
// request that claimed it died before publishing) may be re-claimed — by
// compare-and-set on the old claim time, so again only one request wins.
//
// A read-only support session sees Meta's answer and writes nothing — and
// never publishes (non-negotiable #2/#3). A demo sandbox may, as everywhere.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { allowsWrites } from "@/lib/platform/impersonationToken";
import { getMetaConnection } from "@/lib/social/metaConnection";
import { advanceFacebookReel, advanceInstagramReel } from "@/lib/social/publishVideo";
import { isOpenVideoPublish, withCode } from "@/lib/marketing/videoPost";
import { publishRowShape } from "@/lib/marketing/videoPostServer";
import * as metaGraphClient from "@/lib/social/metaGraphClient";
import * as mockMetaGraphClient from "@/lib/social/mockMetaGraphClient";

const CLAIM_STALE_MS = 5 * 60 * 1000;

export async function GET(request, { params }) {
  const { publishId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const row = await db.socialPublish.findUnique({ where: { id: publishId } });
  if (!row || row.companyId !== member.companyId || !row.videoPostId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isOpenVideoPublish(row.status) || !row.externalContainerId) return NextResponse.json(publishRowShape(row));

  const readOnly = Boolean(member.impersonation) && !allowsWrites(member.impersonationMode);
  const connection = await getMetaConnection(member.companyId);
  if (!connection.connected) {
    // Not a failure of the post — Meta may well have published it.
    return NextResponse.json(publishRowShape(row, { statusUnavailable: connection.reason || "not_connected" }));
  }
  const client = row.isMock ? mockMetaGraphClient : metaGraphClient;

  let result;
  if (row.platform === "instagram") {
    result = await advanceInstagramReel({
      connection,
      containerId: row.externalContainerId,
      client,
      claim: async () => {
        if (readOnly) return false;
        const now = new Date();
        if (row.status === "container_created") {
          const won = await db.socialPublish.updateMany({
            where: { id: row.id, status: "container_created" },
            data: { status: "publishing", firingClaimedAt: now },
          });
          return won.count === 1;
        }
        if (row.status === "publishing" && row.firingClaimedAt && now - row.firingClaimedAt > CLAIM_STALE_MS) {
          const won = await db.socialPublish.updateMany({
            where: { id: row.id, status: "publishing", firingClaimedAt: row.firingClaimedAt },
            data: { firingClaimedAt: now },
          });
          return won.count === 1;
        }
        return false;
      },
    });
  } else {
    result = await advanceFacebookReel({ connection, videoId: row.externalContainerId, client });
  }

  if (result.state === "unreadable") {
    return NextResponse.json(publishRowShape(row, { statusUnavailable: result.code }));
  }
  if (result.state === "processing" || result.state === "unknown" || result.state === "claimed_elsewhere") {
    return NextResponse.json(publishRowShape(row, { stage: result.stage || null }));
  }
  if (result.state === "not_ready") {
    // Meta said FINISHED, then "not ready" at publish: hand the row back.
    if (!readOnly) {
      await db.socialPublish.updateMany({ where: { id: row.id, status: "publishing" }, data: { status: "container_created", firingClaimedAt: null } });
    }
    return NextResponse.json(publishRowShape({ ...row, status: "container_created" }));
  }

  const patch =
    result.state === "published"
      ? { status: "published", publishedAt: new Date(), ...(result.postId ? { externalPostId: result.postId } : {}) }
      : { status: result.code === "rate_limited" ? "rate_limited" : "failed", errorMessage: withCode(result.code, result.detail || "") };
  if (readOnly) return NextResponse.json(publishRowShape({ ...row, ...patch }));

  // Guarded on the row still being open, so a second poll that already
  // recorded the outcome is never overwritten.
  await db.socialPublish.updateMany({
    where: { id: row.id, status: { in: ["container_created", "publishing", "pending"] } },
    data: patch,
  });
  return NextResponse.json(publishRowShape({ ...row, ...patch }));
}
