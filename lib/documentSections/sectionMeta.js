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
  notes: {
    label: "Notes",
    description: "Whatever was typed into the notes field.",
  },
  footer: {
    label: "Footer",
    description: "Contact details and terms along the bottom.",
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
