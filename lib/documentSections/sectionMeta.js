// lib/documentSections/sectionMeta.js
//
// Labels and descriptions for PDF document sections, with NO React-PDF import.
//
// The reason this file exists rather than reusing registry.js: every section
// module imports "@react-pdf/renderer" at the top. A client component that
// imports the registry to get a list of section names drags the whole PDF
// renderer into the browser bundle — hundreds of kilobytes to render a
// dropdown. So the presentation metadata lives here, and the rendering code
// stays server-side.
//
// Keys MUST match SECTION_REGISTRY in registry.js. getSectionModule() throws
// on an unknown type, so a key here that isn't there produces a 500 at PDF
// generation time rather than a build error. assertSectionMetaInSync() below
// is called from the registry to catch that on the server at import time.

export const SECTION_META = {
  header: {
    label: "Header",
    description: "Your logo and company name across the top.",
    // Some sections would produce a broken-looking document if removed, so the
    // editor warns rather than silently letting someone ship a nameless quote.
    recommended: true,
  },
  client_info: {
    label: "Client details",
    description: "Who the document is for, and the job address.",
    recommended: true,
  },
  scope_groups: {
    label: "Line items",
    description: "The work itself, grouped by service.",
    recommended: true,
  },
  kitchen_plan: {
    label: "Kitchen drawing",
    description:
      "The plan and elevations from the kitchen designer. Renders nothing on a document that has no kitchen design.",
  },
  totals: {
    label: "Totals",
    description: "Subtotal, discount, tax and the amount owing.",
    recommended: true,
  },
  payment_summary: {
    label: "Payments received",
    description:
      "Deposits and part-payments already made, and the remaining balance.",
    // Only meaningful on an invoice — a quote has no payments against it yet.
    types: ["invoice_pdf"],
  },
  payment_terms: {
    label: "Payment terms",
    description:
      "When money changes hands, as percentage cards. Reads your Settings → Business payment terms; hidden entirely if you haven't set any.",
  },
  how_to_pay: {
    label: "How to pay",
    description:
      "Pay online, and every other way you accept — e-transfer address, who to make a cheque out to — from Settings → Payments, with the invoice number as the reference. Prints nothing on a paid invoice or when nothing is switched on.",
    // An invoice asks for money; a quote's deposit instructions live inside
    // its payment-terms cards instead, so the section is not offered there.
    types: ["invoice_pdf"],
    recommended: true,
  },
  process_steps: {
    label: "How the work runs",
    description:
      "Numbered steps explaining what happens after they approve. Defaults are written per trade — the most common reason a fairly-priced quote goes unanswered is not knowing what they're agreeing to.",
    recommended: true,
  },
  signature: {
    label: "Signature block",
    description:
      "Ruled lines for a printed signature, for clients who'd rather sign than click. Quotes only.",
    types: ["quote_pdf"],
  },
  notes: {
    label: "Notes",
    description: "Whatever was typed into the notes field.",
  },
  footer: {
    label: "Footer",
    description: "Contact details and terms along the bottom.",
  },

  // ── The instant-estimate report ──────────────────────────────────────────
  //
  // Six sections, one document kind. `types` names a kind no DocumentTemplate
  // row can have ("estimate_report_pdf"), so sectionsForType() never offers
  // them in the quote or invoice template editor — the report has a fixed
  // layout (lib/estimate/report/pdf.js) and nothing in it is a template
  // decision. They live in this registry so the report is rendered by the
  // same PDF engine as a quote rather than by a second one. Placed on a
  // document with no `data.report` they print nothing.
  report_header: {
    label: "Estimate report header",
    description: "Logo, contact tiles and the report title.",
    types: ["estimate_report_pdf"],
  },
  report_options: {
    label: "Estimate report options",
    description: "The cheapest and premium option with a starting-at figure.",
    types: ["estimate_report_pdf"],
  },
  report_questions: {
    label: "Estimate report questions",
    description: "Book a visit, request a call back, back to the website.",
    types: ["estimate_report_pdf"],
  },
  report_measurement: {
    label: "Estimate report measurement",
    description: "The measured figures, imagery date and source.",
    types: ["estimate_report_pdf"],
  },
  report_property: {
    label: "Estimate report property",
    description: "Address, contact and the property map with its outline.",
    types: ["estimate_report_pdf"],
  },
  report_notes: {
    label: "Estimate report notes",
    description: "What happens next, the disclaimers and the report ID.",
    types: ["estimate_report_pdf"],
  },
  // The crew work order — its own kind, one section. Never offered on a quote
  // or invoice template; lib/workOrder/pdf.js renders it directly.
  work_order: {
    label: "Work order",
    description: "Per area: scope, hours, the crew note and a tick. No prices.",
    types: ["work_order_pdf"],
  },
};

export const SECTION_TYPES = Object.keys(SECTION_META);

/** Sections that make sense for a given document type. */
export function sectionsForType(documentType) {
  return SECTION_TYPES.filter((type) => {
    const allowed = SECTION_META[type].types;
    return !allowed || allowed.includes(documentType);
  });
}

/**
 * Server-side guard: fails loudly at import if this file and the registry have
 * drifted apart. A missing entry here is only a cosmetic gap in the editor,
 * but an *extra* one lets someone add a section that blows up PDF generation.
 */
export function assertSectionMetaInSync(registryKeys) {
  const extra = SECTION_TYPES.filter((t) => !registryKeys.includes(t));
  if (extra.length) {
    throw new Error(
      `sectionMeta.js lists section type(s) the renderer can't handle: ${extra.join(", ")}. ` +
        `Add them to SECTION_REGISTRY or remove them here.`,
    );
  }
}
