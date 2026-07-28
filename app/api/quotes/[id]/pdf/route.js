// app/api/quotes/[id]/pdf/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";
import { getDefaultSections } from "@/app/admin/lib/pdf/defaultSections";
import { uploadBuffer } from "@/lib/cloudinary";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await db.quote.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    include: { client: true, scopeGroups: { include: { category: true } } },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  const template = await db.documentTemplate.findFirst({
    where: { companyId: member.companyId, type: "quote_pdf", isDefault: true },
  });
  const sections = template?.sections || getDefaultSections("quote_pdf");

  const pdfBuffer = await renderDocumentPdfBuffer({
    sections,
    // Written-in language, fixed at creation. Falls back to the
    // company default for records created before this existed.
    language: quote.language || company?.defaultLanguage || "en",
    data: { client: quote.client, scopeGroups: quote.scopeGroups, ...quote },
    company,
  });

  const uploaded = await uploadBuffer(pdfBuffer, {
    folder: `fieldquo/${member.companyId}/quotes`,
    publicId: quote.quoteNumber,
    resourceType: "raw",
  });

  await db.quote.update({
    where: { id: quote.id },
    data: { pdfUrl: uploaded.secure_url },
  });

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quote-${quote.quoteNumber}.pdf"`,
    },
  });
}
