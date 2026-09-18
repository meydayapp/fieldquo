// app/api/sales/intro-email/requests/route.js
//
// What the intro emails asked for, for the rep's Today and lead pages.
//
//   GET                       the unhandled call-back and demo requests —
//                             two counts and the rows behind them
//                             (lib/sales/outreach/introRequests.js says what
//                             "unhandled" means and why it is read, not stored).
//   POST { introEmailId }     "handled" — the rep dealt with it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { introRequestsForRep, markIntroHandled } from "@/lib/sales/outreach/introRequests";

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  return NextResponse.json(await introRequestsForRep({ salesRepId: rep.id }));
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  const result = await markIntroHandled({ salesRepId: rep.id, introEmailId: typeof body.introEmailId === "string" ? body.introEmailId.slice(0, 64) : "" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json(result);
}
