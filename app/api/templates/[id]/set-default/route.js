// app/api/templates/[id]/set-default/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { ACTIVE_FLAG_TYPES } from "@/app/data/emailTemplateBlocks";

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
