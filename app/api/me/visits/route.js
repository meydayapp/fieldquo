// app/api/me/visits/route.js
//
// GET ?from=<ISO>&to=<ISO> — the job visits assigned to the caller in that
// window, for My schedule (app/app/me/schedule/page.js). The same read the
// employee home and My day make (lib/me/timeline.js visitItemsFor), so the
// three screens cannot disagree about which visits are yours: the live test
// (2026-10-04) found a visit on My day that My schedule did not show, because
// My schedule read shifts only.
//
// Every member may ask; it is only ever their own visits (assignedToId is the
// caller's User), so no grid level is involved — the same rule /api/me/home
// and /api/dashboard/my-day follow. Read-only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { visitItemsFor } from "@/lib/me/timeline";

// Longer than My schedule's fourteen days, short enough that a hand-typed
// range cannot turn one request into a year of rows.
const MAX_DAYS = 62;
const DAY = 86_400_000;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const from = new Date(searchParams.get("from") || "");
  const to = new Date(searchParams.get("to") || "");
  if (isNaN(from) || isNaN(to) || to < from) {
    return NextResponse.json({ error: "from and to must be dates, from before to." }, { status: 400 });
  }
  if (to - from > MAX_DAYS * DAY) {
    return NextResponse.json({ error: `Ask for at most ${MAX_DAYS} days at a time.` }, { status: 400 });
  }
  const visits = await visitItemsFor(member, from, to);
  return NextResponse.json({ visits });
}
