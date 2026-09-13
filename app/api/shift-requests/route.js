// app/api/shift-requests/route.js
//
// Trades, covers and claims. GET lists what the caller may see (their own,
// open covers they could take, and — for a manager — what is waiting on
// them); POST creates one. Every decision is lib/shiftRequests/state.js's;
// this route only carries the request to lib/shiftRequests/store.js.
//
// No money anywhere in the payload: a shift's times, job and site, never a
// rate. Who is eligible is decided server-side from the roster, never from
// a list the browser sends.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { createRequest, listFor } from "@/lib/shiftRequests/store";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json(await listFor(member));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const result = await createRequest(member, body);
  if (result.error) {
    return NextResponse.json(
      { error: result.error, refused: result.refused || undefined, request: result.request || undefined },
      { status: result.status || 400 },
    );
  }
  return NextResponse.json({ ok: true, request: result.request });
}
