// app/api/sales/call-quality/route.js
//
// A rep's own scorecards: their calls, the number, the rubric lines, and
// the three coaching sentences the model wrote in their language. Nothing
// else — no transcript, no audio (lib/sales/calls/recordingsList.js says
// why a rep does not hear their own recordings), and never another rep's
// row: the scope is the signed-in rep's id, read from the session, not
// from the query string.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { repCallQuality } from "@/lib/sales/calls/qaQueue";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const rows = await repCallQuality({ repId: rep.id, limit: 50 });
  return NextResponse.json({ rows, serverNow: new Date().toISOString() });
}
