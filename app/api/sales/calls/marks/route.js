// app/api/sales/calls/marks/route.js
//
// A rep's bookmarks on their own calls (lib/sales/calls/recordingMarks.js).
//
// GET  ?attemptId=   the marks on one of the rep's calls
// POST { attemptId, note, atSeconds? }
//      A live mark sends no atSeconds and the server stamps now − answeredAt
//      from the row — the browser's clock started at the press and counted
//      the ringing, so it is never trusted for the offset.
//
// Scoped in the WHERE (`salesRepId: rep.id`): a rep cannot read or mark a
// call that is not theirs, and the refusal is the same 404 a missing row gets.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { callStoreState } from "@/lib/sales/calls/store";
import { MARK_AUTHOR_REP, addMark, listMarks } from "@/lib/sales/calls/recordingMarks";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const attemptId = (new URL(request.url).searchParams.get("attemptId") || "").trim();
  if (!attemptId) return bad("Which call?");
  if (!callStoreState().ready) return NextResponse.json({ marks: [] });
  const own = await db.salesCallAttempt.findFirst({ where: { id: attemptId, salesRepId: rep.id }, select: { id: true } });
  if (!own) return bad("That call is not yours.", 404);
  return NextResponse.json({ marks: await listMarks({ attemptId }) });
}

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!callStoreState().ready) return bad("Calling is not finished being set up.", 503);
  const body = await request.json().catch(() => null);
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId.trim() : "";
  if (!attemptId) return bad("Which call?");
  const r = await addMark({ where: { id: attemptId, salesRepId: rep.id }, author: { kind: MARK_AUTHOR_REP, id: rep.id, name: rep.name || null }, body: body || {} });
  if (!r.ok) return bad(r.error, r.status);
  return NextResponse.json({ ok: true, mark: r.mark });
}
