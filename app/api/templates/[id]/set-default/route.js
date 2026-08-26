// app/api/templates/[id]/set-default/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

// Marks this template as the active one for its type — unsets any other default
// of the same type for this company, so exactly one default exists per type at a time.
export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const template = await db.documentTemplate.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!template)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction([
    db.documentTemplate.updateMany({
      where: { companyId: member.companyId, type: template.type },
      data: { isDefault: false },
    }),
    db.documentTemplate.update({
      where: { id: _params.id },
      data: { isDefault: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}
