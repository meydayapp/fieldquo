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
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { invalidSectionTypes } from "@/lib/documents/templateKind";

async function loadOwned(id, companyId) {
  const template = await db.documentTemplate.findUnique({ where: { id } });
  if (!template || template.companyId !== companyId) return null;
  return template;
}

export async function GET(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const existing = await loadOwned(id, member.companyId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, subject, sections, theme } = await request.json();

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
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
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

  const existing = await loadOwned(id, member.companyId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.documentTemplate.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
