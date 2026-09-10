// app/api/platform/sales/voicemail/[id]/audio/route.js
//
// The superadmin's copy of the voicemail proxy.
//
// ══ Why a second route and not a shared one ═══════════════════════════════
//
// The rep route gates on requireOutreachRep and answers "is this YOUR
// message". A superadmin is not a rep and owns none of them, so making one
// route serve both would mean a gate with two ways to pass — and a gate with
// two ways to pass is the shape that eventually lets the wrong one through.
// Two routes, one question each. The streaming half is small enough that
// duplicating it costs less than the branch would.
//
// ══ What it fixes ═════════════════════════════════════════════════════════
//
// /platform/sales/floor put `voicemailUrl` — Twilio's own RecordingUrl —
// straight into an <audio src>. Wrong whichever way the provider's account
// setting falls: if the media is public, that is an unauthenticated recording
// of a stranger's voice sitting behind a guessable link; if it is not, the
// player on that board has never played anything. Both end here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { recordError } from "@/lib/platform/errorLog";

function mp3Url(recordingUrl) {
  const raw = String(recordingUrl || "").trim();
  if (!raw) return null;
  return /\.mp3$/i.test(raw) ? raw : `${raw}.mp3`;
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  // The same two-step the floor board's own route uses, and tested directly
  // rather than through a helper: this hands over a contractor's recorded
  // voice, so the role check is written where it can be read.
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmins can play a sales voicemail" }, { status: 403 });
  }

  const attempt = await db.salesCallAttempt.findUnique({
    where: { id: String(id || "") },
    select: { id: true, voicemailUrl: true },
  });
  if (!attempt?.voicemailUrl) {
    return NextResponse.json({ error: "No such message." }, { status: 404 });
  }

  const url = mp3Url(attempt.voicemailUrl);
  const key = process.env.TWILIO_API_KEY_SID;
  const secret = process.env.TWILIO_API_KEY_SECRET;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const auth =
    key && secret
      ? Buffer.from(`${key}:${secret}`).toString("base64")
      : sid && token
        ? Buffer.from(`${sid}:${token}`).toString("base64")
        : null;

  if (!auth) {
    return NextResponse.json(
      { error: "This message cannot be played: FieldQuo's recording credentials are not set." },
      { status: 503 },
    );
  }

  let upstream = null;
  try {
    upstream = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  } catch (err) {
    await recordError({
      area: "sales_inbound",
      code: "voicemail_fetch_failed",
      message: `Could not fetch a sales voicemail from the provider: ${err?.message}`,
      detail: { attemptId: attempt.id },
    }).catch(() => {});
    return NextResponse.json({ error: "The recording could not be reached." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    await recordError({
      area: "sales_inbound",
      code: "voicemail_upstream_refused",
      message: `The provider refused a sales voicemail with ${upstream.status}.`,
      detail: { attemptId: attempt.id, status: upstream.status },
    }).catch(() => {});
    return NextResponse.json({ error: "The recording could not be reached." }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
