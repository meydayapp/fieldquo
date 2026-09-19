// app/api/settings/document-emails/[id]/route.js
//
// One copy of a document email.
//
//   PATCH { slots?, active?, reset?, sentMode?, canvas? }
//     slots     any of the five wording slots (lib/email/documentEmailWording.js)
//     active    "Use this" (true) / "Back to original" (false)
//     reset     true → the original's wording is copied into the slots again
//     sentMode  "blocks" | "canvas" — which body a send renders; the other
//               body is kept
//     canvas    the designer's fabric document for canvas mode
//   DELETE → the copy is removed and the original is what sends. The
//            original itself cannot be deleted because it is not a row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { updateDocumentEmailCopy } from "@/lib/email/documentEmailCopies";

async function loadOwnedCopy(id, companyId) {
  const row = await db.documentTemplate.findFirst({
    where: { id, companyId, documentKind: { not: null } },
  });
  return row || null;
}

function refuseUnlessManager(member) {
  try {
    requirePermission(member.role, "user:manage");
    return null;
  } catch {
    return NextResponse.json({ error: "Only owners/admins can manage email templates" }, { status: 403 });
  }
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refused = refuseUnlessManager(member);
  if (refused) return refused;

  const copy = await loadOwnedCopy(id, member.companyId);
  if (!copy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (body.sentMode !== undefined && !["blocks", "canvas"].includes(body.sentMode)) {
    return NextResponse.json({ error: "sentMode must be blocks or canvas" }, { status: 400 });
  }
  if (body.canvas !== undefined && body.canvas !== null && typeof body.canvas !== "object") {
    return NextResponse.json({ error: "canvas must be the designer's document" }, { status: 400 });
  }
  // A copy switched to canvas with nothing drawn would send an email with no
  // letter in it. Refused here, where the person can see it, not at send time.
  if (body.sentMode === "canvas") {
    const canvas = body.canvas !== undefined ? body.canvas : copy.canvas;
    const objects = Array.isArray(canvas?.objects) ? canvas.objects.filter((o) => o?.name !== "clip") : [];
    if (objects.length === 0) {
      return NextResponse.json({ error: "Draw the letter on the canvas before switching to it." }, { status: 409 });
    }
  }

  const updated = await updateDocumentEmailCopy(db, copy, body);
  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refused = refuseUnlessManager(member);
  if (refused) return refused;

  const copy = await loadOwnedCopy(id, member.companyId);
  if (!copy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.documentTemplate.delete({ where: { id: copy.id } });
  return NextResponse.json({ ok: true });
}
