// app/api/platform/sales/recordings/qa/route.js
//
// "Score the ones that are missing" — the reconcile for transcripts whose
// scorecard never ran — and "score this one again" for a single call.
// Spends FieldQuo's own model budget (about a tenth of a cent a call), so
// superadmin only, and it says how many it did and what each cost.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { scoreAttempt, scoreMissing } from "@/lib/sales/calls/qa";

export async function POST(request) {
  const { refusal } = await requireSuperadmin(request, "score sales recordings");
  if (refusal) return refusal;
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (typeof body?.attemptId === "string" && body.attemptId) {
    // A named call from the platform is on demand: the sample is not consulted.
    const r = await scoreAttempt(body.attemptId, { force: Boolean(body.force), sample: false });
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  }
  const r = await scoreMissing({ limit: body?.limit, retryFailed: Boolean(body?.retryFailed) });
  return NextResponse.json(r);
}
