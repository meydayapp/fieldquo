// app/api/marketing/video-posts/[id]/restore/route.js
//
// POST — "Restore to post again" on an archived video post
// (lib/marketing/videoArchive.js). The verified copy in Cloudflare R2 is
// handed to Cloudinary server-side (a time-limited R2 URL Cloudinary fetches
// itself — the bytes never pass through this function), into the SAME public
// id, and the post goes back to "processing". From there it is exactly a new
// upload's arrival: cloudinary-notify or the video screen's own lookup
// settles it, and the normal flow — shape, cover, caption, approval, Post —
// continues.
//
// ══ It costs one of this month's videos ═══════════════════════════════════
//
// Bringing a clip back into Cloudinary is paid for again (it is stored and
// processed there again), and the monthly allowance is how that cost is
// carried (lib/marketing/videoAllowance.js: "a video is COUNTED when it
// arrives prepared"). So a restore is refused when the month is used up —
// before anything is fetched — and settleArrival counts it when it lands.
// The screen says so in plain words before the button is pressed.
//
// Same gate as every other video post write: user:manage. A read-only
// support session never gets here (middleware refuses the POST).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { getAppOrigin } from "@/lib/appUrl";
import { allowanceBody, loadOwnedVideoPost, loadVideoAllowance, shapeVideoPost } from "@/lib/marketing/videoPostServer";
import { archiveDeps, restoreFromArchive } from "@/lib/marketing/videoArchiveServer";
import { db } from "@/lib/db";

/** The same notification route a new upload reports to. */
const NOTIFY_PATH = "/api/marketing/video-posts/cloudinary-notify";

const MESSAGES = {
  not_archived: "This video isn't archived.",
  already_restoring: "This video is already being restored.",
  archive_unavailable: "Restoring isn't available right now.",
  archive_copy_missing: "The archived copy couldn't be found, so this video can't be restored.",
  cloudinary_unavailable: "Couldn't start the restore just now. Try again in a minute.",
};

function refuse(status, code, error, extra) {
  return NextResponse.json({ error, code, ...(extra || {}) }, { status });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return refuse(err.status || 403, "forbidden", "Only owners, admins, or supervisors can manage marketing");
  }

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return refuse(404, "not_found", "Not found");
  if (!post.archivedAt) return refuse(409, "not_archived", MESSAGES.not_archived);

  const allowance = await loadVideoAllowance(member.companyId);
  if (!allowance.decision.ok) {
    return refuse(409, "allowance_used", "You've used all of this month's videos.", { allowance: allowanceBody(allowance, member) });
  }

  const result = await restoreFromArchive(post, archiveDeps(), { notificationUrl: `${getAppOrigin(request)}${NOTIFY_PATH}` });
  if (!result.ok) return refuse(result.status, result.code, MESSAGES[result.code] || "Couldn't restore this video.");

  await recordActivity(member, {
    action: "marketing.video_restored",
    entityType: "settings",
    entityId: post.id,
    summary: `Restored the video "${post.name}" from the archive to post it again`,
    metadata: { archiveKey: post.archiveKey },
  }).catch(() => {});

  const fresh = await db.videoPost.findUnique({ where: { id: post.id } });
  return NextResponse.json(shapeVideoPost(fresh));
}
