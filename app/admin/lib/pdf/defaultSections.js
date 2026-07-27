// app/admin/lib/pdf/defaultSections.js
export function getDefaultSections(documentType) {
  const base = [
    { type: "header", sortOrder: 0 },
    { type: "client_info", sortOrder: 1 },
    { type: "scope_groups", sortOrder: 2 },
    { type: "totals", sortOrder: 3 },
    { type: "notes", sortOrder: 4 },
    { type: "footer", sortOrder: 5 },
  ];

  if (documentType === "invoice_pdf" || documentType === "invoice_email") {
    return [
      ...base.slice(0, 4), // header, client_info, scope_groups, totals
      { type: "payment_summary", sortOrder: 3.5 },
      ...base.slice(4), // notes, footer
    ];
  }

  return base;
}
