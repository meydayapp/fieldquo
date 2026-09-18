// app/api/platform/sales/call-quality/route.js
//
// The review queue: every recorded sales call, lowest-scored and unreviewed
// first, for /platform/sales/call-quality. Superadmin only — the same bar
// as hearing the recordings, because the queue is the door to them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { callQaQueue } from "@/lib/sales/calls/qaQueue";
import { AI_MODEL } from "@/lib/ai/provider";

function dateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request) {
  const { refusal } = await requireSuperadmin(request, "review call quality");
  if (refusal) return refusal;
  const q = new URL(request.url).searchParams;
  const rows = await callQaQueue({
    repIds: null,
    from: dateOrNull(q.get("from")),
    to: dateOrNull(q.get("to")),
    repId: q.get("repId") || null,
    state: q.get("state") || null,
    limit: q.get("limit") || undefined,
  });
  return NextResponse.json({ rows, model: AI_MODEL, serverNow: new Date().toISOString() });
}
