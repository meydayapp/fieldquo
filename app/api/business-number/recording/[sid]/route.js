// app/api/business-number/recording/[sid]/route.js
//
// GET — play a voicemail left on the company's business number.
//
// The recording id is only served when one of THIS company's conversation
// lines carries it (the call's activity row, written by
// app/api/business-number/call-status). A recording id from another company
// — or one that is merely a valid Twilio id — finds no row and is a 404, so
// knowing an id is not a way into another tenant's voicemail.
//
// Same gate as the receptionist's call recordings (lib/voice/recording.js
// CALL_AUDIO_LEVEL): a voicemail is client contact data.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { CALL_AUDIO_LEVEL } from "@/lib/voice/recording";
import { fetchRecordingAudio } from "@/lib/businessNumber/provider";

export async function GET(request, { params }) {
  const { sid } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation) {
    const { response: denied } = await levelOrRefusal(member, ...CALL_AUDIO_LEVEL, "hear a voicemail");
    if (denied) return denied;
  }
  const recordingSid = String(sid || "");
  if (!/^RE[0-9a-f]{32}$/i.test(recordingSid)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const row = await db.message.findFirst({
    where: {
      direction: "activity",
      thread: { companyId: member.companyId },
      activity: { path: ["recordingSid"], equals: recordingSid },
    },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let res;
  try {
    res = await fetchRecordingAudio(recordingSid);
  } catch {
    return NextResponse.json({ error: "The voicemail couldn't be fetched just now." }, { status: 502 });
  }
  if (!res.ok || !res.body) return NextResponse.json({ error: "The voicemail couldn't be fetched just now." }, { status: 502 });
  return new NextResponse(res.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=300" },
  });
}
