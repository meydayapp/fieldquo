// lib/templateRenderer.js
import { getSectionModule } from "@/lib/documentSections/registry";

export function renderTemplateToHtml({ sections, data, company }) {
  const ordered = [...sections].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
  );

  const body = ordered
    .map((section) => {
      try {
        const mod = getSectionModule(section.type);
        return mod.renderEmailHtml({ data, company, section });
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
