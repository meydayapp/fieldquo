// app/api/sales/voicemail/[id]/audio/route.js
//
// The audio itself, served by FieldQuo rather than by Twilio.
//
// ══ Why this route exists at all ══════════════════════════════════════════
//
// `SalesCallAttempt.voicemailUrl` holds Twilio's own RecordingUrl, and the
// floor board handed it straight to an <audio src>. This repository already
// knows not to do that — lib/voice/recording.js serves a TENANT recording
// through /api/voice/calls/{id}/recording for the same reason — and it is
// wrong whichever way Twilio's account setting falls: if the media is public
// the raw link is an unauthenticated recording of a stranger's voice, and if
// it is not, the player never played. One route fixes both, so nothing here
// depends on knowing which it was.
//
// ══ Why ownership is re-checked here ══════════════════════════════════════
//
// An attempt id in a URL is a guess anybody can make. This route must not
// trust that the id came from the list route — the two ask the same question
// of the same helper, and this one asks it about the row it is actually about
// to stream.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { ownsVoicemail } from "@/lib/sales/calls/voicemail";
import { recordError } from "@/lib/platform/errorLog";

/** Twilio serves the media with an `.mp3` suffix on the recording resource. */
function mp3Url(recordingUrl) {
  const raw = String(recordingUrl || "").trim();
  if (!raw) return null;
  return /\.mp3$/i.test(raw) ? raw : `${raw}.mp3`;
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const attempt = await db.salesCallAttempt.findUnique({
    where: { id: String(id || "") },
    select: {
      id: true,
      salesRepId: true,
      direction: true,
      fromE164: true,
      voicemailUrl: true,
      voicemailSeconds: true,
    },
  });

  const assigned = await db.platformSmsNumber.findMany({
    where: { assignedRepId: rep.id, active: true },
    select: { e164: true },
  });
  const ourNumbers = assigned.map((n) => n.e164).filter(Boolean);

  // One answer for "no such message" and "not yours". A different status for
  // each would let anybody enumerate which attempt ids carry a voicemail.
  if (!ownsVoicemail({ ...attempt, ourE164: attempt?.fromE164 }, { salesRepId: rep.id, ourNumbers })) {
    return NextResponse.json({ error: "No such message." }, { status: 404 });
  }

  const url = mp3Url(attempt.voicemailUrl);
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const key = process.env.TWILIO_API_KEY_SID;
  const secret = process.env.TWILIO_API_KEY_SECRET;
  const token = process.env.TWILIO_AUTH_TOKEN;

  // API key pair first, auth token second: the key pair is what the rest of
  // this deployment authenticates with, and the auth token is empty in some
  // environments.
  const auth =
    key && secret
      ? Buffer.from(`${key}:${secret}`).toString("base64")
      : sid && token
        ? Buffer.from(`${sid}:${token}`).toString("base64")
        : null;

  if (!url || !auth) {
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
    // Recorded rather than swallowed: a message a rep cannot hear is the exact
    // failure this route was built to end, and a silent 502 recreates it.
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
      // Never cached by a shared cache: this is one caller's voice and the
      // permission that fetched it belongs to one rep.
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
