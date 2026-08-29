// app/api/voice/calls/[id]/recording/route.js
//
// Listening to one call, from inside the app.
//
// ── Why this exists rather than an <a href={call.recordingUrl}> ────────────
//
// The provider's recording URL is a bearer link — see lib/voice/recording.js.
// The owner asked for the audio to be reachable from the quote, and a quote is
// the one document in this product that gets forwarded, printed and emailed to
// a stranger. Putting the URL anywhere near it means one careless `select`
// away from handing a homeowner's phone call to whoever has the share link.
//
// So the audio is fetched here and STREAMED back, rather than redirected to.
// A 302 would be simpler and would still require a session to obtain — but it
// hands the bearer URL to the browser, where it lands in history, in a referrer
// and in a right-click "copy link address" that works forever afterwards. The
// upstream URL never leaves the server, which is what makes "it cannot leak" a
// statement rather than a hope.
//
// ── Scoped in the WHERE, like every other read on this resource ───────────
//
// A call id from another tenant resolves to nothing rather than to their
// customer's audio.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { CALL_AUDIO_LEVEL, isFetchableRecording } from "@/lib/voice/recording";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Non-negotiable #3, the same opt-out the calls list makes and for the same
  // reason: loadEnforceableMember returns null for a support session, hasLevel
  // denies a null member, and the platform console could read this screen
  // yesterday. Listening is a read; nothing here writes.
  if (!member.impersonation) {
    const { response: denied } = await levelOrRefusal(
      member,
      ...CALL_AUDIO_LEVEL,
      "listen to a call",
    );
    if (denied) return denied;
  }

  const call = await db.voiceCall.findFirst({
    where: { id, companyId: member.companyId },
    select: { recordingUrl: true },
  });

  // One 404 for three different situations — wrong tenant, no such call, no
  // recording kept. The difference is only useful to someone probing, and a
  // member who genuinely has the call open sees the link absent rather than
  // broken, because the panel only renders it when a recording exists.
  if (!call?.recordingUrl || !isFetchableRecording(call.recordingUrl)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Range forwarded so an audio element can seek. Without it a browser
  // downloads the whole WAV before it will play a second of it.
  const range = request.headers.get("range");

  let upstream;
  try {
    upstream = await fetch(call.recordingUrl, {
      headers: range ? { range } : {},
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    // The provider's status is not repeated. A 403 from Retell means our own
    // credentials or their retention window, and neither is the member's
    // problem to interpret.
    return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
  }

  const passthrough = {};
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(header);
    if (value) passthrough[header] = value;
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": "audio/wav",
      ...passthrough,
      // One customer's phone call. Never in a shared cache, never on disk.
      "cache-control": "private, no-store",
      // Inline so it plays in the page. Never `attachment` — a downloaded copy
      // of a call recording is a copy nobody can revoke.
      "content-disposition": "inline",
      "referrer-policy": "no-referrer",
    },
  });
}
