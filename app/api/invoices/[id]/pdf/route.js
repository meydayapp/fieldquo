// app/api/invoices/[id]/pdf/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";
import { getDefaultSections } from "@/app/admin/lib/pdf/defaultSections";
import { uploadBuffer } from "@/lib/cloudinary";

export async function POST(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await db.invoice.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: { client: true, payments: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  const template = await db.documentTemplate.findFirst({
    where: {
      companyId: member.companyId,
      type: "invoice_pdf",
      isDefault: true,
    },
  });
  const sections = template?.sections || getDefaultSections("invoice_pdf");

  const pdfBuffer = await renderDocumentPdfBuffer({
    sections,
    data: { client: invoice.client, scopeGroups: [], ...invoice },
    company,
  });

  const uploaded = await uploadBuffer(pdfBuffer, {
    folder: `fieldquo/${member.companyId}/invoices`,
    publicId: invoice.invoiceNumber,
    resourceType: "raw",
  });

  await db.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl: uploaded.secure_url },
  });

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
