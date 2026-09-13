// app/api/settings/document-templates/[id]/activate/route.js
//
// Marks one template as the active/default one for its type. Only the PDF
// types have a reader for that flag (the PDF routes pick the active
// quote_pdf / invoice_pdf); email types are refused below. Only one template
// per (company, type) can be active at a time, so this clears any previous
// isDefault=true row of the same type first.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ACTIVE_FLAG_TYPES } from "@/app/data/emailTemplateBlocks";

export async function POST(request, { params }) {
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

  const template = await db.documentTemplate.findUnique({ where: { id } });
  if (!template || template.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ── Active means nothing for an email template ───────────────────────────
  //
  // Follow-up rules and campaigns pick a template by id; the quote, receipt
  // and instructions emails read no template at all. Only the PDF routes
  // consult isDefault, for quote_pdf and invoice_pdf. Refused here rather
  // than only hidden on the screen, so a stale tab or a hand-typed request
  // cannot set a flag that would then appear on a list and be believed.
  if (!ACTIVE_FLAG_TYPES.includes(template.type)) {
    return NextResponse.json(
      {
        error:
          "Email templates have no active one — follow-up rules and campaigns choose a template by name, and the quote, receipt and instructions emails are built from the document itself.",
        code: "no_active_for_type",
      },
      { status: 409 },
    );
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
