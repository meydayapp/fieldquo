// app/api/payouts/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payout = await db.payout.findFirst({
    where: { id: _params.id, worker: { companyId: member.companyId } },
    include: { worker: { select: { id: true, name: true, type: true } } },
  });

  if (!payout)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payout);
}
