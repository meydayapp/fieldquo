// app/api/custom-fields/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { DOCUMENT_ENTITY_TYPES } from "@/lib/customFields/validate";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit custom fields" },
      { status: 403 },
    );
  }

  const existing = await db.customField.findUnique({
    where: { id: _params.id },
  });
  if (!existing || existing.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { label, options, required, sortOrder, showOnDocuments } = body;

  const updated = await db.customField.update({
    where: { id: _params.id },
    data: {
      ...(label !== undefined && { label: String(label).trim().slice(0, 80) }),
      ...(options !== undefined && { options }),
      ...(required !== undefined && { required: !!required }),
      ...(sortOrder !== undefined && { sortOrder }),
      // Only meaningful on a quote or invoice definition — see POST.
      ...(showOnDocuments !== undefined && {
        showOnDocuments: DOCUMENT_ENTITY_TYPES.includes(existing.entityType) && showOnDocuments === true,
      }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can delete custom fields" },
      { status: 403 },
    );
  }

  const existing = await db.customField.findUnique({
    where: { id: _params.id },
  });
  if (!existing || existing.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascades to CustomFieldValue via the schema's onDelete: Cascade.
  await db.customField.delete({ where: { id: _params.id } });

  return NextResponse.json({ ok: true });
}
