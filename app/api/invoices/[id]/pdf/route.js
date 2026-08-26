// app/api/invoices/[id]/pdf/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";
import { getDefaultSections } from "@/app/admin/lib/pdf/defaultSections";
import { usableSections } from "@/lib/documents/templateKind";
import { resolveDocumentLanguage } from "@/lib/i18n/resolveLanguage";
import { uploadBuffer } from "@/lib/cloudinary";
import {
  loadEnforceableMember,
  requireMoney,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── A rendered document is money and nothing else ────────────────────────
  //
  // The redactors elsewhere shape a payload because `quotes: view_only` is a
  // real grant and a quote minus its totals is still a useful record of the
  // work. There is no such shape for this: a priced PDF with the prices taken
  // out is not a smaller PDF, it is a broken one. So this refuses.
  //
  // It was reachable by direct URL with nothing but a session and a company
  // match — no category level, no toggle — which made every other pricing
  // restriction in the product one POST away from irrelevant.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireMoney(full, "download priced documents");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const invoice = await db.invoice.findFirst({
    where: { id: _params.id, companyId: member.companyId },
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
  const sections = usableSections(
    "invoice_pdf",
    template?.sections || getDefaultSections("invoice_pdf"),
  ).sections;

  const pdfBuffer = await renderDocumentPdfBuffer({
    sections,
    // Written-in language, fixed at creation. Falls back to the
    // company default for records created before this existed.
    language: resolveDocumentLanguage(invoice, invoice.client, company),
    // scopeGroups was [], so ScopeGroupsSection fell to the flat lineItems
    // path and rendered an unlabelled card. Invoices genuinely are one flat
    // list — they're not grouped by service — so give that list a heading
    // rather than pretending it has structure it doesn't.
    data: {
      ...invoice,
      client: invoice.client,
      scopeGroups:
        Array.isArray(invoice.lineItems) && invoice.lineItems.length
          ? [
              {
                label: "Work completed",
                lineItems: invoice.lineItems,
                subtotal: invoice.subtotal,
              },
            ]
          : [],
    },
    company,
  });

  // ── The archive copy must never cost you the download ────────────────────
  //
  // The PDF is already rendered and is what the caller asked for. Uploading a
  // copy to Cloudinary is a side effect, and until this was wrapped it ran
  // BEFORE the response with nothing catching it: a Cloudinary outage, a rate
  // limit, or an account whose PDF delivery is restricted would throw here and
  // 500 the route — so an estimator could not download a quote that had
  // already been built successfully in memory.
  //
  // Nothing currently READS `pdfUrl` (grep it). The upload is kept because an
  // archived copy of what was sent is worth having and removing it is a product
  // decision, not a cleanup — but it is now demoted to what it is: best
  // effort, logged when it fails, never in the way of the document.
  let uploaded = null;
  try {
    uploaded = await uploadBuffer(pdfBuffer, {
      folder: `fieldquo/${member.companyId}/invoices`,
      // An invoice already versions itself — editing a sent one writes a new
      // row with version + 1 rather than mutating history — so the version IS
      // the document identity here, and no hash is needed. Keyed on the number
      // alone, revising an invoice overwrote the copy of the one the client had
      // already been sent.
      publicId: `${invoice.invoiceNumber}-v${invoice.version ?? 1}`,
      resourceType: "raw",
    });
    await db.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl: uploaded.secure_url },
    });
  } catch (err) {
    console.error("[invoices/pdf] archive copy failed:", err?.message);
  }

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
