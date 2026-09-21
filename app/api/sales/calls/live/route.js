// app/api/sales/calls/live/route.js
//
// What the server knows about a call that is UP, polled by the live call
// card for the first minute: the answering-machine verdict (lib/sales/calls/amd.js)
// and the pickup stamp the Mark button needs. Nothing here changes anything.
//
// Polled, not pushed: the AMD verdict arrives on Twilio's own request to
// /api/rep-dial/amd a few seconds after the pickup, and the browser has no
// channel to be told on. The card asks every three seconds while the call is
// young and stops once a verdict has landed or a minute has passed — and does
// not ask at all when `amd.enabled` says the feature is off, which the first
// answer tells it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { callStoreState } from "@/lib/sales/calls/store";
import { outcomeSettingValues } from "@/lib/sales/calls/outcomeSettingsStore";
import { amdCardKey } from "@/lib/sales/calls/amd";
import { listMarks } from "@/lib/sales/calls/recordingMarks";

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const attemptId = (new URL(request.url).searchParams.get("attemptId") || "").trim();
  if (!attemptId) return NextResponse.json({ error: "Which call?" }, { status: 400 });
  if (!callStoreState().ready) return NextResponse.json({ amd: { enabled: false, result: null, cardKey: null }, answeredAt: null, marks: [] });
  const [row, settings] = await Promise.all([
    db.salesCallAttempt.findFirst({ where: { id: attemptId, salesRepId: rep.id }, select: { id: true, answeredAt: true, amdResult: true, amdAt: true } }),
    outcomeSettingValues(),
  ]);
  if (!row) return NextResponse.json({ error: "That call is not yours." }, { status: 404 });
  return NextResponse.json({
    amd: {
      enabled: settings["sales.amd.enabled"] === true,
      result: row.amdResult || null,
      at: row.amdAt ? row.amdAt.toISOString() : null,
      cardKey: amdCardKey(row.amdResult),
    },
    answeredAt: row.answeredAt ? row.answeredAt.toISOString() : null,
    marks: await listMarks({ attemptId: row.id }),
    serverNow: new Date().toISOString(),
  });
}
