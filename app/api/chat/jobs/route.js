// app/api/chat/jobs/route.js
//
// The jobs a member may pick in team chat — to save a photo to, or to share
// as a card. GET [?q=] → { jobs: [{ id, title, status }] }.
//
// The jobs they can SEE and nothing else (lib/company/chat/store.js
// jobsForChat): jobs at view_only, and for the crew only the jobs they are
// on (assignedJobWhere — a visit or a published shift). Ids and titles: no
// client, no address, no money.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { jobsForChat } from "@/lib/company/chat/store";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const q = new URL(request.url).searchParams.get("q") || "";
  return NextResponse.json({ jobs: await jobsForChat(member, { q }) });
}
