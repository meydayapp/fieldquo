// app/api/settings/document-templates/[id]/preview/route.js
//
// Renders a PDF template against sample data and streams the PDF back.
//
// Distinct from the sibling /test route, which emails a rendered *email*
// template to an address. PDFs aren't emailed to yourself to check a layout —
// you open them. This returns the buffer directly and, unlike the real
// quote/invoice PDF routes, does not upload to Cloudinary or write a pdfUrl:
// a preview is scratch output, not a document of record.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";
import { getDefaultSections } from "@/app/admin/lib/pdf/defaultSections";

// Deliberately plausible rather than "Lorem ipsum": long-ish line item names
// and realistic amounts are what expose a layout that wraps badly or a totals
// column that's too narrow.
const SAMPLE = {
  quoteNumber: "Q-1042",
  invoiceNumber: "INV-1042",
  createdAt: new Date(),
  dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  notes:
    "Colour to be confirmed on site before spraying. Homeowner to clear countertops the night before.",
  subtotal: 3900,
  discount: 150,
  tax: 500,
  total: 4250,
  amountPaid: 1275,
  amountDue: 2975,
  client: {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "(416) 555-0142",
    address: "123 Maple Street",
    city: "Toronto",
    province: "ON",
  },
  scopeGroups: [
    {
      label: "Cabinet Refinishing",
      subtotal: 3750,
      category: { label: "Cabinet Refinishing" },
      lineItems: [
        {
          description: "Cabinet doors & drawer fronts — spray refinish",
          quantity: 24,
          amount: 3000,
        },
        {
          description: "Cabinet boxes — on-site refinish",
          quantity: 1,
          amount: 750,
        },
      ],
    },
    {
      label: "Hardware",
      subtotal: 150,
      category: { label: "Hardware" },
      lineItems: [
        {
          description: "Premium hardware replacement",
          quantity: 24,
          amount: 150,
        },
      ],
    },
  ],
  payments: [
    { date: new Date(), amount: 1275, method: "e_transfer" },
  ],
};

export async function POST(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = await db.documentTemplate.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!template)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!String(template.type).endsWith("_pdf")) {
    return NextResponse.json(
      {
        error:
          "That's an email template — use Send test email to preview it instead.",
      },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  const sections =
    Array.isArray(template.sections) && template.sections.length
      ? template.sections
      : getDefaultSections(template.type);

  try {
    const pdfBuffer = await renderDocumentPdfBuffer({
      sections,
      data: SAMPLE,
      company,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // inline, not attachment — the point is to look at it, not save it.
        "Content-Disposition": `inline; filename="preview.pdf"`,
      },
    });
  } catch (err) {
    // getSectionModule throws on a section type the renderer doesn't know.
    // Surfacing which one beats a generic 500 the user can't act on.
    console.error("[template preview] render failed:", err);
    return NextResponse.json(
      { error: err.message || "Couldn't render this layout." },
      { status: 500 },
    );
  }
}
