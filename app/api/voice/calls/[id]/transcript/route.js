// app/api/voice/calls/[id]/transcript/route.js
//
// The whole call, in words.
//
// ── It was already ours, and nothing could open it ────────────────────────
//
// `VoiceCall.transcript` holds the provider's structured turns and has since
// the webhook was written — 28 of them on the call that prompted this. Nothing
// in the app ever showed one. The calls list deliberately returns only
// `hasTranscript` (a hundred call transcripts to render a button is the wrong
// trade), the draft panel showed the model's reading of it, and the turns
// themselves had no door at all. So the estimator read a 400-character summary
// of a five-minute conversation and had no way to check it.
//
// This is that door. It is fetched on demand, by one call id, when somebody
// opens the panel — which is the shape the list could not afford.
//
// ── Same gate as the recording, because it is the same information ────────
//
// A transcript is what the caller said. That is the client book arriving by
// another door just as much as the audio is, so it asks the identical question
// the recording route asks — see CALL_AUDIO_LEVEL.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { CALL_AUDIO_LEVEL } from "@/lib/voice/recording";
import { transcriptTurns } from "@/lib/voice/transcript";

/** Long enough for a long call, short enough that nothing is unbounded. */
const MAX_TURNS = 400;
const MAX_CHARS = 2000;

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same opt-out the calls list makes, for the same reason: the platform
  // console has no Member row, and this is a read.
  if (!member.impersonation) {
    const { response: denied } = await levelOrRefusal(
      member,
      ...CALL_AUDIO_LEVEL,
      "read what was said on a call",
    );
    if (denied) return denied;
  }

  const call = await db.voiceCall.findFirst({
    // Scoped in the WHERE. A call id from another tenant resolves to nothing
    // rather than to their customer's words.
    where: { id, companyId: member.companyId },
    select: { transcript: true, summary: true },
  });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    // Parsed here rather than handed over raw, so the browser never has to know
    // that the provider stores this in two different shapes.
    turns: transcriptTurns(call.transcript)
      .slice(0, MAX_TURNS)
      .map((t) => ({ role: t.role, text: String(t.text).slice(0, MAX_CHARS) })),
    // The provider's own compression, beside the thing it compressed. Both, so
    // a reader can see what the summary left out — which is the reason this
    // endpoint exists.
    summary: call.summary || null,
  });
}
