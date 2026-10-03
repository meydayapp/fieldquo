// app/components/quotes/builder/IntakeFields.js
//
// The structured questions a trade needs before it can price anything.
//
// Two sources feed this and they're deliberately the same shape: the static
// per-category definitions in app/data/quoteIntakeFields.js, and the fields a
// company picked from the shared library when creating a custom quote type
// (stored on ServiceCategory.customFields). The builder resolves which applies
// and hands the resolved array here, so this component never has to know the
// difference.
//
// Two optional keys on a select, both from app/data/quoteIntakeFields.js and
// so far only on the drywall finish level:
//   optionLabels  a plain line per value, translated through the app
//                 catalogue as app.intake.<field key>.<value>. A select
//                 without them prints its values as it always did.
//   legacyValues  a value the select used to offer, shown as the option it
//                 meant (shownSelectValue). The stored answer is not
//                 rewritten until the estimator picks a different one.
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import { shownSelectValue } from "@/app/data/quoteIntakeFields";

const inputClass =
  "w-full mt-1 border border-border rounded px-2 py-1.5 text-sm";

export default function IntakeFields({ fields = [], values = {}, onChange }) {
  const { t } = useTranslation();
  if (!fields.length) return null;

  const optionText = (field, opt) => {
    const own = field.optionLabels;
    if (own && Object.prototype.hasOwnProperty.call(own, opt)) {
      return t(`app.intake.${field.key}.${opt}`, own[opt]);
    }
    return opt.replace(/_/g, " ");
  };

  return (
    <div className="grid grid-cols-2 gap-3 pb-4 border-b border-border">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="text-xs text-muted-foreground">{field.label}</label>

          {field.type === "select" ? (
            <select
              value={shownSelectValue(field, values[field.key]) || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={`${inputClass} bg-card`}
            >
              <option value="">—</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {optionText(field, opt)}
                </option>
              ))}
            </select>
          ) : field.type === "boolean" ? (
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={!!values[field.key]}
                onChange={(e) => onChange(field.key, e.target.checked)}
              />
              Yes
            </label>
          ) : (
            <input
              type="number"
              value={values[field.key] || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={inputClass}
            />
          )}
        </div>
      ))}
    </div>
  );
}
