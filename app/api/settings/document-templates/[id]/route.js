// app/api/settings/document-templates/[id]/route.js
//
// Next 16: `params` on a dynamic route handler is a Promise and must be
// awaited before reading its properties — reading `params.id` synchronously
// either logs a deprecation error or (as seen here) resolves to `undefined`,
// which then blew up the Prisma call with "needs at least one of `id`
// arguments". Every handler below awaits params first.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { invalidSectionTypes } from "@/lib/documents/templateKind";

async function loadOwned(id, companyId) {
  const template = await db.documentTemplate.findUnique({ where: { id } });
  if (!template || template.companyId !== companyId) return null;
  return template;
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const template = await loadOwned(id, member.companyId);
  if (!template)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(template);
}

// PATCH { name?, subject?, sections?, theme? } — the block editor saves the
// full sections array each time (simplest correct approach: no partial-block
// patching). `theme` is a small settings object of per-template overrides;
// omitting it (or sending null) means the email inherits Company branding.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage email templates" },
      { status: 403 },
    );
  }

  const existing = await loadOwned(id, member.companyId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, subject, sections, theme, sentMode, canvas } = await request.json();

  // ── Blocks or canvas ──────────────────────────────────────────────────────
  //
  // `sentMode` is the statement of which body a send renders; `canvas` is the
  // designer's document. Both are optional and independent: saving a canvas
  // does not switch to it, and switching never clears the other body —
  // "go back to blocks" must be a way out, not a way of losing the drawing.
  if (sentMode !== undefined && !["blocks", "canvas"].includes(sentMode)) {
    return NextResponse.json({ error: "sentMode must be blocks or canvas" }, { status: 400 });
  }
  if (canvas !== undefined && canvas !== null && (typeof canvas !== "object" || !Array.isArray(canvas.objects))) {
    return NextResponse.json({ error: "canvas must be the designer's document" }, { status: 400 });
  }
  // Switching to a canvas with nothing on it would make the template send an
  // empty email. Refused here, in front of the person, rather than at 8am by
  // the cron.
  if (sentMode === "canvas") {
    const doc = canvas !== undefined ? canvas : existing.canvas;
    const drawn = Array.isArray(doc?.objects) ? doc.objects.filter((o) => o?.name !== "clip") : [];
    if (drawn.length === 0) {
      return NextResponse.json(
        { error: "Draw something on the canvas before making it the email — or stay on blocks." },
        { status: 409 },
      );
    }
  }

  // A PDF layout and an email body are two different vocabularies sharing one
  // JSON column. Saving a `heading` block into a quote_pdf produced a template
  // that threw on the next download, with nothing between the editor and the
  // renderer to notice. Rejecting here is the boundary — see
  // lib/documents/templateKind.js.
  if (sections !== undefined) {
    const bad = invalidSectionTypes(existing.type, sections);
    if (bad.length) {
      return NextResponse.json(
        {
          error: `This layout can't contain: ${bad.join(", ")}. A PDF layout uses document sections; an email uses content blocks.`,
          invalidTypes: bad,
        },
        { status: 400 },
      );
    }
  }

  const updated = await db.documentTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(subject !== undefined && { subject }),
      ...(sections !== undefined && { sections }),
      ...(theme !== undefined && { theme }),
      ...(sentMode !== undefined && { sentMode }),
      ...(canvas !== undefined && { canvas }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage email templates" },
      { status: 403 },
    );
  }

  const existing = await loadOwned(id, member.companyId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.documentTemplate.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
