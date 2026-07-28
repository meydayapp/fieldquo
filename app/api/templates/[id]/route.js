// app/api/templates/[id]/route.js
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

  const template = await db.documentTemplate.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });

  if (!template)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

// Saves section order/content from the drag-and-drop builder
export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.documentTemplate.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, sections } = body;

  const updated = await db.documentTemplate.update({
    where: { id: _params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(sections !== undefined && { sections }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.documentTemplate.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.isDefault) {
    return NextResponse.json(
      {
        error:
          "Can't delete the active default template — set another as default first",
      },
      { status: 400 },
    );
  }

  await db.documentTemplate.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
