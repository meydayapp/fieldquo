// app/api/platform/sales/recordings/route.js
//
// The recorded sales calls, for /platform/sales/recordings. Superadmin
// only — this is a contractor's voice and a rep's, and the owner reviews
// them; nobody else does, and no rep hears their own (the rep is told the
// call is recorded, which is the disclosure, not a listening right).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { recordedCalls } from "@/lib/sales/calls/recordingsList";
import { AI_TRANSCRIBE_MODEL } from "@/lib/ai/provider";

function dateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request) {
  const { refusal } = await requireSuperadmin(request, "hear sales recordings");
  if (refusal) return refusal;
  const q = new URL(request.url).searchParams;
  const rows = await recordedCalls({
    from: dateOrNull(q.get("from")),
    to: dateOrNull(q.get("to")),
    repId: q.get("repId") || null,
    transcribed: q.get("transcribed") || null,
    limit: q.get("limit") || undefined,
  });
  return NextResponse.json({
    rows,
    transcribeModel: AI_TRANSCRIBE_MODEL,
    // Said on the page rather than assumed: the export is what the owner
    // feeds his own analysis, and the page names where it is.
    exportHref: `/api/platform/sales/recordings/export?${q.toString()}`,
    serverNow: new Date().toISOString(),
  });
}
