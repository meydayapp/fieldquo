// app/api/calendar/feed/route.js
//
// The signed-in member's own feed link — what Settings → My calendar reads
// and rotates. The FEED itself is the sibling [token] route, which has no
// session; this route is the one that does, and it is the only writer of
// Member.calendarFeedToken.
//
//   GET                       → { token, urls }  (minting a token on first read)
//   POST { action: "rotate" } → the same shape, with a fresh token
//
// Minted lazily rather than at signup: a token that exists only once somebody
// opened the page is one fewer live credential per member who never will.
// Rotation is the only revocation a webcal URL has — a phone keeps polling the
// old address and gets an empty 404 — so it is logged to the activity trail
// like any other credential change.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { recordActivity } from "@/lib/activity/log";
import { mintFeedToken, feedUrls } from "@/lib/calendar/feedToken";

function answer(request, token) {
  return NextResponse.json({ token, urls: feedUrls(getAppOrigin(request), token) });
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const row = await db.member.findUnique({
    where: { id: member.id },
    select: { calendarFeedToken: true },
  });
  let token = row?.calendarFeedToken || null;
  if (!token) {
    token = mintFeedToken();
    await db.member.update({ where: { id: member.id }, data: { calendarFeedToken: token } });
  }
  return answer(request, token);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  if (body?.action !== "rotate") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const token = mintFeedToken();
  await db.member.update({ where: { id: member.id }, data: { calendarFeedToken: token } });
  await recordActivity(member, {
    action: "calendar_feed.rotated",
    entityType: "member",
    entityId: member.id,
    summary: "Calendar feed link regenerated",
    summaryKey: "app.activity.event.calendarFeedRotated",
  });
  return answer(request, token);
}
