// app/api/templates/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── This route has no UI and no permission check ────────────────────────
  //
  // It reads and writes `documentTemplate` — the same rows
  // /api/settings/document-templates guards with user:manage — while requiring
  // nothing but a session. Nothing in app/, components/ or lib/ calls it: the
  // PDF Templates page uses the guarded route. So any employee could curl this
  // and destroy the company's quote and invoice templates.
  //
  // Gated rather than deleted: an orphan in this repo is not proof nothing
  // reaches it, and a 403 is safe whether or not something does. It should be
  // removed once that is confirmed.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can change document templates." },
      { status: 403 },
    );
  }

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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── This route has no UI and no permission check ────────────────────────
  //
  // It reads and writes `documentTemplate` — the same rows
  // /api/settings/document-templates guards with user:manage — while requiring
  // nothing but a session. Nothing in app/, components/ or lib/ calls it: the
  // PDF Templates page uses the guarded route. So any employee could curl this
  // and destroy the company's quote and invoice templates.
  //
  // Gated rather than deleted: an orphan in this repo is not proof nothing
  // reaches it, and a 403 is safe whether or not something does. It should be
  // removed once that is confirmed.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can change document templates." },
      { status: 403 },
    );
  }

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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── This route has no UI and no permission check ────────────────────────
  //
  // It reads and writes `documentTemplate` — the same rows
  // /api/settings/document-templates guards with user:manage — while requiring
  // nothing but a session. Nothing in app/, components/ or lib/ calls it: the
  // PDF Templates page uses the guarded route. So any employee could curl this
  // and destroy the company's quote and invoice templates.
  //
  // Gated rather than deleted: an orphan in this repo is not proof nothing
  // reaches it, and a 403 is safe whether or not something does. It should be
  // removed once that is confirmed.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can change document templates." },
      { status: 403 },
    );
  }

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
