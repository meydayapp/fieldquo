// app/api/quotes/[id]/called/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Marking a quote as followed up is a change to the quote's record, and it
  // had no check at all — a member who may not open the quote could stamp it.
  const { response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_create_edit",
    "edit quotes",
  );
  if (denied) return denied;

  const existing = await db.quote.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quote = await db.quote.update({
    where: { id: _params.id },
    data: { calledAt: new Date() },
  });

  return NextResponse.json(quote);
}
