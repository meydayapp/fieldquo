// app/data/intakeFieldLibrary.js
//
// Flat, deduplicated pool of every intake field already defined across
// app/data/quoteIntakeFields.js's INTAKE_FIELDS map. This is the picker
// source for custom quote types (Settings > Services > "+ Add custom quote
// type") — a company assembles a new quote type by choosing from fields
// that already exist and already render correctly in the quote builder
// (number / boolean / select / multiselect / text / textarea / photo),
// instead of inventing a form-builder from scratch.
//
// Dedup key is the field's own `key` — many categories reuse the same field
// with the same meaning (squareFootage, material, frequency, estimatedHours,
// etc.), so the first definition encountered wins and later duplicates are
// skipped. This list is derived at import time, not hand-maintained, so it
// stays in sync automatically as quoteIntakeFields.js changes.

import { INTAKE_FIELDS } from "./quoteIntakeFields";

function buildLibrary() {
  const seen = new Map();

  for (const categoryKey of Object.keys(INTAKE_FIELDS)) {
    for (const field of INTAKE_FIELDS[categoryKey]) {
      if (!seen.has(field.key)) {
        seen.set(field.key, { ...field, usedBy: [categoryKey] });
      } else {
        seen.get(field.key).usedBy.push(categoryKey);
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export const INTAKE_FIELD_LIBRARY = buildLibrary();

// Fields a custom quote type actually stores (ServiceCategory.customFields)
// should NOT include `usedBy` — that's picker-UI-only context. Strip it
// before saving.
export function toStoredFields(fieldKeys) {
  return INTAKE_FIELD_LIBRARY.filter((f) => fieldKeys.includes(f.key)).map(
    ({ key, label, type, options }) => ({
      key,
      label,
      type,
      ...(options ? { options } : {}),
    }),
  );
}
