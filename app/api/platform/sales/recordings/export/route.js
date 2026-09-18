// app/api/platform/sales/recordings/export/route.js
//
// Every recorded call with its transcript, as JSON or CSV, for the owner's
// own analysis of what reps say against the script. `?format=csv` for a
// spreadsheet; JSON otherwise. Same query and same rows as the page
// (lib/sales/calls/recordingsList.js) so the two cannot disagree.
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { recordedCalls, recordingsCsv } from "@/lib/sales/calls/recordingsList";

function dateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request) {
  const { refusal } = await requireSuperadmin(request, "export sales recordings");
  if (refusal) return refusal;
  const q = new URL(request.url).searchParams;
  const rows = await recordedCalls({
    from: dateOrNull(q.get("from")),
    to: dateOrNull(q.get("to")),
    repId: q.get("repId") || null,
    transcribed: q.get("transcribed") || null,
    limit: q.get("limit") || 2000,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  if (q.get("format") === "csv") {
    return new NextResponse(recordingsCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fieldquo-sales-recordings-${stamp}.csv"`,
      },
    });
  }
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, calls: rows }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fieldquo-sales-recordings-${stamp}.json"`,
    },
  });
}
