// lib/documents/templateKind.js
//
// Which vocabulary a DocumentTemplate's `sections` array is written in.
//
// ── The bug this exists to make impossible ──────────────────────────────────
//
// DocumentTemplateType covers two genuinely different things that happen to
// share one table and one JSON column:
//
//   *_email  → free content BLOCKS: heading, text, image, button, lineItems…
//              rendered by lib/email/renderTemplateSections.js
//   *_pdf    → domain SECTIONS: header, client_info, scope_groups, totals…
//              rendered by lib/documentSections/registry.js
//
// The create route seeded every type from `defaultSectionsFor()`, which only
// knows the email vocabulary and falls through to `[heading, text]` for
// anything it doesn't recognise. So creating a PDF layout produced a template
// whose first section was `heading` — a type the PDF registry has never heard
// of — and the next download threw `Unknown section type: "heading"`.
//
// Nothing caught it because the read paths fall back to getDefaultSections()
// when NO template exists, which is the common case. The failure only appears
// once somebody uses the feature.
//
// The two vocabularies must never mix, so the decision of which one applies
// lives here rather than being re-derived at each call site by whoever
// remembers.

// SECTION_TYPES from sectionMeta, NOT the keys of SECTION_REGISTRY. Every
// module in the registry imports @react-pdf/renderer at the top, and this file
// is imported by app/api/public/quotes/[token] — a route whose own comment
// refuses to load a PDF engine for a stranger on a phone. sectionMeta exists
// for exactly this, and assertSectionMetaInSync keeps the two lists identical.
import { getDefaultSections } from "@/app/admin/lib/pdf/defaultSections";
import { defaultSectionsFor, BLOCK_TYPES } from "@/app/data/emailTemplateBlocks";
import { SECTION_TYPES } from "@/lib/documentSections/sectionMeta";

/** PDF layouts are section-based; everything else is block-based. */
export function isPdfTemplate(type) {
  return type === "quote_pdf" || type === "invoice_pdf";
}

/** The vocabulary a type is allowed to use, as a Set of section/block types. */
export function allowedTypesFor(templateType) {
  return isPdfTemplate(templateType)
    ? new Set(SECTION_TYPES)
    : new Set(BLOCK_TYPES.map((b) => b.type));
}

/** The starter layout for a new template, in the right vocabulary. */
export function starterSectionsFor(templateType) {
  return isPdfTemplate(templateType)
    ? getDefaultSections(templateType)
    : defaultSectionsFor(templateType);
}

/**
 * Section types in `sections` that this template type cannot render.
 *
 * Returned rather than thrown so a caller can decide: the write path rejects,
 * and the editor offers a repair. Throwing here would turn an existing broken
 * row into a 500 on a page whose whole job is to fix it.
 */
export function invalidSectionTypes(templateType, sections) {
  if (!Array.isArray(sections)) return [];
  const allowed = allowedTypesFor(templateType);
  const bad = new Set();
  for (const s of sections) {
    const t = s?.type;
    if (!t || !allowed.has(t)) bad.add(String(t));
  }
  return [...bad];
}

/**
 * A renderable version of `sections`, with anything this type can't render
 * removed — plus what was removed, so the caller can SAY SO rather than
 * quietly shipping a shorter document.
 *
 * Used on the read path only. A company whose template was seeded with the
 * wrong vocabulary before this module existed gets a working PDF and a warning,
 * instead of a download that 500s with no way back.
 */
export function usableSections(templateType, sections) {
  const dropped = invalidSectionTypes(templateType, sections);
  if (dropped.length === 0) return { sections, dropped };
  const allowed = allowedTypesFor(templateType);
  const kept = (sections || []).filter((s) => allowed.has(s?.type));
  return {
    // An empty result is worse than the default layout: it produces a blank
    // page from a template the company believes they configured.
    sections: kept.length ? kept : starterSectionsFor(templateType),
    dropped,
  };
}
