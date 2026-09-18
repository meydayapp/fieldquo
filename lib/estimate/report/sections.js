// lib/estimate/report/sections.js
//
// The report's PDF section list, with no renderer import — so the check
// script and anything on the browser side can read WHAT the report is made
// of without loading @react-pdf/renderer. pdf.js renders it.

/** The document kind the report's sections are registered under. */
export const ESTIMATE_REPORT_DOCUMENT_KIND = "estimate_report_pdf";

/** The report's sections, in reading order. */
export const ESTIMATE_REPORT_SECTIONS = Object.freeze([
  { type: "report_header", sortOrder: 0 },
  { type: "report_options", sortOrder: 1 },
  { type: "report_questions", sortOrder: 2 },
  { type: "report_measurement", sortOrder: 3 },
  { type: "report_property", sortOrder: 4 },
  { type: "report_notes", sortOrder: 5 },
  { type: "footer", sortOrder: 6 },
]);
