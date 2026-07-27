// app/api/quotes/tier-group/[tierGroupId]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotes = await db.quote.findMany({
    where: { tierGroupId: params.tierGroupId, companyId: member.companyId },
    include: { scopeGroups: true, client: true },
    orderBy: { tierLabel: "asc" }, // best, better, good — alphabetical happens to work here; fine either way
  });

  return NextResponse.json(quotes);
}
