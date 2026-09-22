// lib/workOrder/pdf.js
//
// The work order as a PDF: one section, rendered through the same
// renderDocumentPdfBuffer that produces every quote and invoice. There is no
// DocumentTemplate row for it — the layout is not a thing a company edits —
// so the list lives here and goes straight to the renderer.
//
// Server-only: this pulls @react-pdf/renderer through the registry. The page
// imports the model, never this.
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";

export const WORK_ORDER_DOCUMENT_KIND = "work_order_pdf";
export const WORK_ORDER_SECTIONS = Object.freeze([{ type: "work_order", sortOrder: 0 }]);

/**
 * @param workOrder  the model from buildWorkOrderModel()
 * @param company    the company row (brandColor, name…)
 * @param language   the QUOTE's language — a document keeps the language it
 *                   was created in (non-negotiable #6), and the work order is
 *                   the quote seen from the tools
 */
export async function renderWorkOrderPdf({ workOrder, company, language }) {
  return renderDocumentPdfBuffer({
    sections: [...WORK_ORDER_SECTIONS],
    language: language || workOrder?.job?.language || company?.defaultLanguage || "en",
    data: { workOrder },
    company,
  });
}
