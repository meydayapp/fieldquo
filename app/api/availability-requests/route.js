// app/api/availability-requests/route.js
//
// "My availability": the caller's current week, their requests, and — for a
// manager — the ones waiting with a diff against each person's current
// rows. POST submits a new request (or applies it outright when the company
// has turned approval off). The rows written on approval are the same
// AvailabilitySchedule rows /api/availability PATCH writes; see
// lib/availability/requests.js for why there is no second table.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { createRequest, listFor } from "@/lib/availability/requests";

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
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ ok: true, request: result.request });
}
