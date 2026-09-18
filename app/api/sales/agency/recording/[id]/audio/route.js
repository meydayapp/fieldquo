// app/api/sales/agency/recording/[id]/audio/route.js
//
// An agency plays a recording of one of ITS employees' calls — streamed
// through FieldQuo with the provider's credentials, exactly as the
// platform's proxy does, and gated by team membership read fresh on this
// request (lib/sales/calls/qaQueue.js agencyCanHear). A call by a rep who
// has left the team, a call by anybody else's rep, or a call with no
// recording all answer 404 — never a 403 that confirms the row.
//
// A rep never reaches this: lib/sales/calls/recordingsList.js's decision
// that a rep does not hear their own recordings stands. The agency is the
// employer, and the owner's brief seats it where he sits for its team.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { agencyTeamIds, isAgency } from "@/lib/sales/agency";
import { repViewer, visibleRepIds } from "@/lib/sales/team";
import { agencyCanHear } from "@/lib/sales/calls/qaQueue";
import { twilioMediaAuth } from "@/lib/sales/calls/recording";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) return NextResponse.json({ error: "No such recording." }, { status: 404 });

  const teamIds = await agencyTeamIds(rep.id);
  const allowed = await agencyCanHear({ attemptId: id, teamRepIds: visibleRepIds(repViewer(rep.id, teamIds)) });
  if (!allowed.ok) return NextResponse.json({ error: "No such recording." }, { status: 404 });

  const auth = twilioMediaAuth();
  if (!auth) {
    return NextResponse.json({ error: "This recording cannot be played: FieldQuo's recording credentials are not set." }, { status: 503 });
  }

  let upstream;
  try {
    upstream = await fetch(`${allowed.recordingUrl}.mp3`, { headers: { Authorization: auth } });
  } catch (err) {
    await recordError({
      area: "sales_dial",
      code: "recording_fetch_failed",
      message: `Could not fetch a sales recording from the provider for an agency: ${err?.message}`,
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
