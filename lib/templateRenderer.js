// lib/templateRenderer.js
import { getSectionModule } from "@/lib/documentSections/registry";

// `language` mirrors renderDocumentPdfBuffer: the language the record was
// written in, so the emailed copy and the attached PDF say the same thing.
// An email in French with an English PDF attached is worse than either alone.
export function renderTemplateToHtml({ sections, data, company, language }) {
  const lang = language || company?.defaultLanguage || "en";

  const ordered = [...sections].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
  );

  const body = ordered
    .map((section) => {
      try {
        const mod = getSectionModule(section.type);
        return mod.renderEmailHtml({ data, company, section, language: lang });
      } catch (err) {
        console.error(
          `Failed to render email section "${section.type}":`,
          err.message,
        );
        return "";
      }
    })
    .join("\n");

  return `<div style="max-width:600px;margin:0 auto;">${body}</div>`;
}
