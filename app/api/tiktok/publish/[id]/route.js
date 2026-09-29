// app/api/tiktok/publish/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { fetchPublishStatus } from "@/lib/tiktok/client";
import { getTikTokAccess } from "@/lib/tiktok/connection";
import { classifyTikTokError, isTerminalStatus, mapTikTokStatus, statusPatch } from "@/lib/tiktok/specs";

// The composer's poll after "Sent to TikTok — processing": every ~5 seconds
// for a few minutes (TikTok's status endpoint allows 30 requests a minute per
// token — content-posting-api-reference-get-video-status). Each GET asks
// TikTok once, writes what it learned through the SAME statusPatch() the
// webhook uses, and answers with the row. A row already final is answered from
// the database without calling TikTok at all.
//
// A GET that writes: it records TikTok's answer about a post this company
// already made — the same fact the webhook would record — and never changes
// anything the person chose. Under a read-only support session it is still a
// read of TikTok; the write is skipped (member.impersonation) so a support
// session never touches a customer's rows, per non-negotiable #3.
function shape(row) {
  const failure = row.status === "failed" ? classifyTikTokError({ code: row.failReason }) : null;
  return {
    id: row.id,
    status: row.status,
    privacyLevel: row.privacyLevel,
    publicPostId: row.publicPostId,
    publishedAt: row.publishedAt,
    ...(failure ? { failure } : {}),
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const row = await db.tikTokPublish.findUnique({ where: { id } });
  if (!row || row.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isTerminalStatus(row.status) || !row.publishId) return NextResponse.json(shape(row));

  const access = await getTikTokAccess(member.companyId);
  if (!access.connected) {
    // Not a failure of the post — TikTok may well have published it. Say the
    // status can't be read, and keep the row as it is.
    return NextResponse.json({ ...shape(row), statusUnavailable: access.reason });
  }

  const r = await fetchPublishStatus({ accessToken: access.accessToken, publishId: row.publishId });
  if (!r.ok) {
    return NextResponse.json({ ...shape(row), statusUnavailable: classifyTikTokError(r).code });
  }

  const patch = statusPatch(row, {
    status: mapTikTokStatus(r.data.status),
    failReason: r.data.failReason,
    publicPostId: r.data.publicPostId,
  });
  if (!patch || member.impersonation) return NextResponse.json(shape(patch ? { ...row, ...patch } : row));

  // Guarded on the status we read, so a webhook that landed a terminal state
  // between our read and this write is never overwritten.
  await db.tikTokPublish.updateMany({ where: { id: row.id, status: row.status }, data: patch });
  return NextResponse.json(shape({ ...row, ...patch }));
}
