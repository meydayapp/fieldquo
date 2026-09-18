// app/api/sales/calls/test-line/route.js
//
// "Is the number I just typed a test dial?" — answered for the SCREEN, before
// the press, so the dial pad can say "Test line — not saved on this lead" and
// the readiness beside the Call button can be judged as a test rather than
// printing "New York's rule" over a dial that is exempt from it.
//
// Read-only and advisory. The browser holds no test-line list and decides
// nothing from this: POST /api/sales/calls re-reads the list and the rep row
// in the request that dials, and POST /api/sales/calls/numbers refuses to
// store the number on its own read. A wrong or stale answer here changes a
// sentence, never what rings.
//
// Only the one number is judged, and the list itself is never returned — a
// rep learns whether the number they already typed is ours, not which ten
// numbers are.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { isTestLine } from "@/lib/sales/testLines";
import { loadTestLines } from "@/lib/sales/testLinesStore";

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const e164 = normalisePhone(new URL(request.url).searchParams.get("e164") || "");
  if (!e164) return NextResponse.json({ error: "Send ?e164= in full, with the country code." }, { status: 400 });

  return NextResponse.json({
    e164,
    testLine: isTestLine(e164, await loadTestLines()),
    // Off the rep row the gate read in THIS request — the same fact the dial
    // route reads for itself a moment later.
    testAccount: rep.testAccount === true,
  });
}
