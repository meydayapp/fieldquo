// app/api/custom-fields/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { DOCUMENT_ENTITY_TYPES } from "@/lib/customFields/validate";
import { schedulePhrases, companyWritingLanguage } from "@/lib/i18n/autoTranslateSchedule";

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

  // A document label is drafted into the other document languages (see
  // POST). Queued on every save of a flagged definition — an unchanged label
  // costs nothing — but the banner speaks only when the client-facing words
  // changed: a new label, or a box that just started printing.
  let autoTranslate = null;
  if (updated.showOnDocuments) {
    const summary = schedulePhrases({
      companyId: member.companyId,
      ns: "customFieldLabel",
      texts: [updated.label],
      sourceLanguage: await companyWritingLanguage(member.companyId),
    });
    if (updated.label !== existing.label || !existing.showOnDocuments) autoTranslate = summary;
  }

  return NextResponse.json({ ...updated, autoTranslate });
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
