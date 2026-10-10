// app/components/selections/SelectionFields.js
//
// The boxes of one colour / material row — area, product, colour name and
// code, finish, coats, notes — shared by the job's "Colours & materials" card
// and the quote builder's per-service colour rows, so the two cannot ask for
// a colour in two different shapes.
//
// The trade template (lib/jobs/selections.js SELECTION_TEMPLATES) only offers
// SUGGESTIONS: a datalist under the area and finish boxes, a placeholder in
// the product box. Nothing is filled in on the person's behalf.
"use client";

import { SELECTION_TEMPLATES, SELECTION_TEXT_LIMITS, MAX_COATS } from "@/lib/jobs/selections";

const inputClass = "w-full mt-1 border border-border rounded px-2 py-1.5 text-sm bg-card text-foreground";

function Box({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/**
 * @param value       the row ({ area, product, colourName, colourCode, finish, coats, notes })
 * @param onChange    (patch) => void
 * @param templateKey which trade's suggestions to offer
 * @param idPrefix    unique per row — the datalists need document-unique ids
 * @param t           the translator
 */
export default function SelectionFields({ value, onChange, templateKey = "generic", idPrefix, t }) {
  const row = value || {};
  const tpl = SELECTION_TEMPLATES[templateKey] || SELECTION_TEMPLATES.generic;
  const areaList = `${idPrefix}-areas`;
  const finishList = `${idPrefix}-finishes`;
  const text = (field) => ({
    value: row[field] ?? "",
    maxLength: SELECTION_TEXT_LIMITS[field],
    onChange: (e) => onChange({ [field]: e.target.value }),
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
      <Box label={t("app.selections.field.area", "Area / surface")} className="col-span-2 sm:col-span-2">
        <input {...text("area")} list={tpl.areas.length ? areaList : undefined} className={inputClass} />
        {tpl.areas.length > 0 && (
          <datalist id={areaList}>
            {tpl.areas.map(([k, en]) => (
              <option key={k} value={t(k, en)} />
            ))}
          </datalist>
        )}
      </Box>
      <Box label={t("app.selections.field.product", "Product / brand")} className="col-span-2 sm:col-span-4">
        <input {...text("product")} placeholder={t(tpl.productHint[0], tpl.productHint[1])} className={inputClass} />
      </Box>
      <Box label={t("app.selections.field.colourName", "Colour")} className="col-span-1 sm:col-span-2">
        <input {...text("colourName")} placeholder={t("app.selections.hint.colourName", "e.g. Chantilly Lace")} className={inputClass} />
      </Box>
      <Box label={t("app.selections.field.colourCode", "Colour code")} className="col-span-1 sm:col-span-1">
        <input {...text("colourCode")} placeholder={t("app.selections.hint.colourCode", "e.g. OC-65")} className={inputClass} />
      </Box>
      <Box label={t("app.selections.field.finish", "Finish / sheen")} className="col-span-1 sm:col-span-2">
        <input {...text("finish")} list={tpl.finishes.length ? finishList : undefined} className={inputClass} />
        {tpl.finishes.length > 0 && (
          <datalist id={finishList}>
            {tpl.finishes.map(([k, en]) => (
              <option key={k} value={t(k, en)} />
            ))}
          </datalist>
        )}
      </Box>
      <Box label={t("app.selections.field.coats", "Coats")} className="col-span-1 sm:col-span-1">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_COATS}
          step={1}
          value={row.coats ?? ""}
          onChange={(e) => onChange({ coats: e.target.value })}
          className={inputClass}
        />
      </Box>
      <Box label={t("app.selections.field.notes", "Notes")} className="col-span-2 sm:col-span-6">
        <textarea
          {...text("notes")}
          rows={2}
          className={`${inputClass} resize-y`}
        />
      </Box>
    </div>
  );
}

/** "2 coats" in the reader's language. */
export function coatsTextFor(t) {
  return (n) =>
    n === 1
      ? t("app.selections.coatsOne", "1 coat")
      : t("app.selections.coatsMany", "{n} coats", { n });
}
