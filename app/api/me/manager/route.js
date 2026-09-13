// app/api/me/manager/route.js — the manager's Home. ?period=today|week.
// Refuses below schedule edit_all, the level the tab set is chosen by
// (lib/me/tabs.js), so the phone tab and the payload agree on who is one.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { managerHome } from "@/lib/me/home";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const period = new URL(request.url).searchParams.get("period") === "week" ? "week" : "today";
  const result = await managerHome(member, { period, now: new Date() });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 403 });
  return NextResponse.json(result);
}
