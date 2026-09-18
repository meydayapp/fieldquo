// app/api/platform/sales/recording/[id]/audio/route.js
//
// The recording of a sales call, streamed through FieldQuo with the
// provider's credentials — never Twilio's own URL in an <audio src>, for the
// reason the voicemail proxy beside this one gives. Superadmin only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { twilioMediaAuth } from "@/lib/sales/calls/recording";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { refusal } = await requireSuperadmin(request, "play a sales recording");
  if (refusal) return refusal;

  const attempt = await db.salesCallAttempt.findUnique({
    where: { id: String(id || "") },
    select: { id: true, recordingUrl: true },
  });
  if (!attempt?.recordingUrl) return NextResponse.json({ error: "No such recording." }, { status: 404 });

  const auth = twilioMediaAuth();
  if (!auth) {
    return NextResponse.json({ error: "This recording cannot be played: FieldQuo's recording credentials are not set." }, { status: 503 });
  }

  let upstream;
  try {
    upstream = await fetch(`${attempt.recordingUrl}.mp3`, { headers: { Authorization: auth } });
  } catch (err) {
    await recordError({
      area: "sales_dial",
      code: "recording_fetch_failed",
      message: `Could not fetch a sales recording from the provider: ${err?.message}`,
    }).catch(() => {});
    return NextResponse.json({ error: "The recording could not be fetched." }, { status: 502 });
  }
  if (!upstream.ok) return NextResponse.json({ error: `The provider answered ${upstream.status}.` }, { status: 502 });

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
