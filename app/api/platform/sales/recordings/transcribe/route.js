// app/api/platform/sales/recordings/transcribe/route.js
//
// "Transcribe the ones that are missing" — the reconcile for recordings
// whose status callback ran but whose transcription did not finish, and
// "transcribe this one again" for a single row. Spends FieldQuo's own model
// budget, so superadmin only, and it says how many it did.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { transcribeAttempt, transcribeMissing } from "@/lib/sales/calls/transcribe";

export async function POST(request) {
  const { refusal } = await requireSuperadmin(request, "transcribe sales recordings");
  if (refusal) return refusal;
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (typeof body?.attemptId === "string" && body.attemptId) {
    const r = await transcribeAttempt(body.attemptId, { force: Boolean(body.force) });
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  }
  const r = await transcribeMissing({ limit: body?.limit, retryFailed: Boolean(body?.retryFailed) });
  return NextResponse.json(r);
}
