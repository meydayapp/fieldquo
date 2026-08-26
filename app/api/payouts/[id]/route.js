// app/api/payouts/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const payout = await db.payout.findFirst({
    where: { id: _params.id, worker: { companyId: member.companyId } },
    include: { worker: { select: { id: true, name: true, type: true } } },
  });

  if (!payout)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payout);
}
