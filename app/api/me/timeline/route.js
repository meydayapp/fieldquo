// app/api/me/timeline/route.js — the caller's own timeline between ?from
// and ?to: shifts, open shifts, visits, appointments (quoters only), tasks
// and company events, as one sorted list. See lib/me/timeline.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { timelineFor } from "@/lib/me/timeline";
import { can } from "@/lib/permissions";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const from = new Date(searchParams.get("from") || "");
  const to = new Date(searchParams.get("to") || "");
  if (isNaN(from) || isNaN(to) || to <= from || to - from > 62 * 86_400_000) {
    return NextResponse.json({ error: "from and to are required (at most 62 days apart)." }, { status: 400 });
  }
  const items = await timelineFor(member, from, to);
  return NextResponse.json({ items, quoter: can(member.role, "quote:create") });
}
