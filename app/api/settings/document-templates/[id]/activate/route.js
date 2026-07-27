// app/api/settings/document-templates/[id]/activate/route.js
//
// Marks one template as the active/default one for its type — the one an
// automated send (quote/instructions/receipt/follow-up) uses. Only one
// template per (company, type) can be active at a time, so this clears any
// previous isDefault=true row of the same type first.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function POST(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage email templates" },
      { status: 403 },
    );
  }

  const template = await db.documentTemplate.findUnique({ where: { id } });
  if (!template || template.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.$transaction([
    db.documentTemplate.updateMany({
      where: { companyId: member.companyId, type: template.type, isDefault: true },
      data: { isDefault: false },
    }),
    db.documentTemplate.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
