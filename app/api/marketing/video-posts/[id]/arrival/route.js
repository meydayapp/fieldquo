// app/api/marketing/video-posts/[id]/arrival/route.js
//
// POST — the browser has sent the last chunk. Moves the post from
// "uploading" to "processing" (Cloudinary is converting it) and asks
// Cloudinary once whether it is already there — a short clip usually is.
// Nothing the browser says here is a fact about the clip: the post becomes
// "ready" only on Cloudinary's own answer (checkArrival / the notification).
//
// A body of { failed: true, reason } records that the browser's upload
// failed, so the slot it was holding is released at once rather than after
// UPLOAD_RESERVATION_HOURS.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { approverName, checkArrival, loadOwnedVideoPost, shapeVideoPost } from "@/lib/marketing/videoPostServer";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json({ error: "Only owners, admins, or supervisors can manage marketing", code: "forbidden" }, { status: err.status || 403 });
  }

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (body?.failed === true) {
    await db.videoPost.updateMany({
      where: { id: post.id, uploadState: "uploading" },
      data: { uploadState: "failed", uploadError: "upload_failed" },
    });
  } else {
    await db.videoPost.updateMany({ where: { id: post.id, uploadState: "uploading" }, data: { uploadState: "processing" } });
  }
  const fresh = await db.videoPost.findUnique({ where: { id: post.id } });
  const checked = body?.failed === true ? fresh : (await checkArrival({ ...fresh, uploadCheckedAt: null })) || fresh;
  return NextResponse.json(shapeVideoPost(checked, { approvedByName: await approverName(checked) }));
}
