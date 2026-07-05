// app/admin/lib/pdf/defaultSections.js
// Also used by the email side — same section order works for both since both
// renderers read the same registry.
export function getDefaultSections(documentType) {
  const base = [
    { type: "header", sortOrder: 0 },
    { type: "client_info", sortOrder: 1 },
    { type: "scope_groups", sortOrder: 2 },
    { type: "totals", sortOrder: 3 },
    { type: "notes", sortOrder: 4 },
    { type: "footer", sortOrder: 5 },
  ];
  return base; // same structure for quote_pdf/invoice_pdf/quote_email/etc. today —
  // diverge per documentType here later if a type needs a different default
}
