// app/api/availability-requests/[id]/route.js
//
// POST { action: approve | decline | withdraw, note? }. Approve applies the
// week now when the effective date is today or past, else leaves it for the
// daily cron — the row says which (appliedAt).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { decide } from "@/lib/availability/requests";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const result = await decide(member, id, typeof body.action === "string" ? body.action : "", body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ ok: true, request: result.request });
}
