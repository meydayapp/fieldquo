// app/api/quotes/[id]/pdf/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";
import { getDefaultSections } from "@/app/admin/lib/pdf/defaultSections";
import { usableSections } from "@/lib/documents/templateKind";
import { attachServiceSettings } from "@/lib/documents/loadServiceSettings";
import { resolveDocumentLanguage } from "@/lib/i18n/resolveLanguage";
import { uploadBuffer } from "@/lib/cloudinary";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await db.quote.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    include: {
      client: true,
      scopeGroups: {
        include: { category: true },
        // Was unordered, so the groups could come back in a different sequence
        // than the builder showed — the PDF and the screen disagreeing about
        // what order the work is in.
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  const template = await db.documentTemplate.findFirst({
    where: { companyId: member.companyId, type: "quote_pdf", isDefault: true },
  });
  const sections = usableSections(
    "quote_pdf",
    template?.sections || getDefaultSections("quote_pdf"),
  ).sections;

  // Per-service wording this company has customised, if any. Without it every
  // scope card falls back to the shipped defaults — which is fine, and is what
  // most companies will see.
  const scopeGroups = await attachServiceSettings(
    db,
    member.companyId,
    quote.scopeGroups,
  );

  const pdfBuffer = await renderDocumentPdfBuffer({
    sections,
    // Client-aware precedence: the quote's own language if set, else the
    // client's language, else the company default. Reading quote.language alone
    // gave a French client an English PDF when the quote wasn't stamped.
    language: resolveDocumentLanguage(quote, quote.client, company),
    // `...quote` last would overwrite the enriched scopeGroups with the raw
    // ones — spread first, then the keys that matter.
    data: { ...quote, client: quote.client, scopeGroups },
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
      folder: `fieldquo/${member.companyId}/quotes`,
      publicId: quote.quoteNumber,
      resourceType: "raw",
    });
    await db.quote.update({
      where: { id: quote.id },
      data: { pdfUrl: uploaded.secure_url },
    });
  } catch (err) {
    console.error("[quotes/pdf] archive copy failed:", err?.message);
  }

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quote-${quote.quoteNumber}.pdf"`,
    },
  });
}
