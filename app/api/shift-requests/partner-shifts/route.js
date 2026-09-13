// app/api/shift-requests/partner-shifts/route.js
//
// The published, upcoming shifts of ONE colleague, for the "trade for their
// shift" picker: times, job and site — never a rate, never a note. Only a
// colleague the caller could actually trade with (lib/shiftRequests/
// eligibility.js tradePartners: active, with a login, in this company), so
// the roster is not browsable through this by anyone it was not meant for.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { workerFor } from "@/lib/shiftRequests/store";
import { tradePartners } from "@/lib/shiftRequests/eligibility";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const workerId = new URL(request.url).searchParams.get("workerId") || "";
  const me = await workerFor(member);
  if (!me) return NextResponse.json({ error: "You're not on the roster." }, { status: 403 });
  const workers = await db.worker.findMany({
    where: { companyId: member.companyId, active: true },
    select: { id: true, name: true, userId: true, active: true },
  });
  if (!tradePartners(me, workers).some((w) => w.id === workerId)) {
    return NextResponse.json({ error: "You can't trade with that person." }, { status: 403 });
  }
  const shifts = await db.shift.findMany({
    where: { companyId: member.companyId, workerId, published: true, start: { gt: new Date() } },
    orderBy: { start: "asc" },
    take: 30,
    select: {
      id: true, start: true, end: true, label: true,
      job: { select: { id: true, title: true, siteAddress: true, siteCity: true, client: { select: { name: true } } } },
    },
  });
  return NextResponse.json({ shifts });
}
