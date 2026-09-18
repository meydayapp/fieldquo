// lib/estimate/report/pdf.js
//
// The report as a PDF: the fixed section list, rendered through the same
// renderDocumentPdfBuffer that produces every quote and invoice. There is no
// DocumentTemplate row for it — the report's layout is not a thing a company
// edits — so the list lives here and goes straight to the renderer.
//
// Server-only: this pulls @react-pdf/renderer through the registry. The
// public page imports the model, never this.

import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";
import { ESTIMATE_REPORT_SECTIONS } from "./sections";

export { ESTIMATE_REPORT_SECTIONS, ESTIMATE_REPORT_DOCUMENT_KIND } from "./sections";

/**
 * Render the report PDF.
 *
 * @param report   the model from buildEstimateReportModel()
 * @param company  the company row (brandColor, name, email, phone, taxId…)
 * @returns Buffer
 */
export async function renderEstimateReportPdf({ report, company }) {
  return renderDocumentPdfBuffer({
    sections: [...ESTIMATE_REPORT_SECTIONS],
    // The document's language is the report's — the homeowner's choice,
    // fixed on the draft. Not the company default.
    language: report.language,
    data: { report },
    company,
  });
}
