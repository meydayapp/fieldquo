// app/components/customFields/CustomFieldsBox.js
//
// The extra boxes a company defined under Settings > Custom fields, on the
// record they were defined for.
//
// Three exports, one contract:
//
//   useCustomFields(entityType, entityId)
//     Loads this company's definitions for the type and this record's answers
//     (empty answers when `entityId` is null — a record not created yet).
//     Returns the fields, a draft of the answers, a setter, and `save(id)`.
//     A record form renders <CustomFieldInputs> from it and calls `save`
//     AFTER its own save succeeded, with the saved row's id — that is how a
//     brand-new client gets its gate code without a second round trip the
//     person has to trigger. One route, one validator, six forms:
//     lib/customFields/values.js says why the record routes don't do this.
//
//   <CustomFieldInputs cf={...} />
//     The inputs. Nothing at all when the company has no definitions for the
//     type, so a form for a company that never opened the settings page is
//     unchanged.
//
//   <CustomFieldsPanel entityType entityId />
//     Read-only, self-loading, for a detail view. Renders nothing when there
//     are no definitions, and prints only the boxes that have an answer — an
//     empty "Gate code:" line is a question, not information.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { formatCustomValue, normaliseCustomValue, optionsOf } from "@/lib/customFields/validate";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

function valuesUrl(entityType, entityId) {
  const p = new URLSearchParams({ entityType });
  if (entityId) p.set("entityId", entityId);
  return `/api/custom-fields/values?${p}`;
}

export function useCustomFields(entityType, entityId) {
  const [fields, setFields] = useState([]);
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetchJson(valuesUrl(entityType, entityId))
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setFields(list);
        setDraft(Object.fromEntries(list.map((f) => [f.id, f.value ?? ""])));
      })
      .catch((err) => {
        if (cancelled) return;
        // A refused load (no access to the record) or a 404 leaves the form
        // without the boxes rather than blocking the record's own save. The
        // record's route enforces the same rule, so nothing is lost silently:
        // the person could not have written the answer either way.
        setFields([]);
        setLoadError(err?.message || "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  const setValue = useCallback((fieldId, value) => {
    setDraft((d) => ({ ...d, [fieldId]: value }));
    setErrors((e) => {
      if (!e[fieldId]) return e;
      const next = { ...e };
      delete next[fieldId];
      return next;
    });
  }, []);

  // Client-side pass of the SAME validator the route runs — so a required
  // box or a bad number is pointed at before the record's own save fires,
  // not after it succeeded and left the answers behind.
  const validate = useCallback(() => {
    const out = {};
    for (const f of fields) {
      const r = normaliseCustomValue(f, draft[f.id]);
      if (!r.ok) out[f.id] = r.error;
    }
    setErrors(out);
    return Object.keys(out).length === 0;
  }, [fields, draft]);

  const save = useCallback(
    async (id) => {
      const target = id || entityId;
      if (!fields.length || !target) return true;
      try {
        const rows = await fetchJson("/api/custom-fields/values", {
          method: "PUT",
          body: { entityType, entityId: target, values: draft },
        });
        const list = Array.isArray(rows) ? rows : [];
        setFields(list);
        setDraft(Object.fromEntries(list.map((f) => [f.id, f.value ?? ""])));
        setErrors({});
        return true;
      } catch (err) {
        if (err?.data?.errors && typeof err.data.errors === "object") setErrors(err.data.errors);
        throw err;
      }
    },
    [entityType, entityId, fields.length, draft],
  );

  const dirty = useMemo(
    () => fields.some((f) => String(draft[f.id] ?? "") !== String(f.value ?? "")),
    [fields, draft],
  );

  return {
    entityType,
    fields,
    values: draft,
    setValue,
    errors,
    loading,
    loadError,
    validate,
    save,
    dirty,
    hasFields: fields.length > 0,
  };
}

/**
 * The inputs for a form. `cf` is the object useCustomFields returned.
 * `columns` matches the host form's grid (1 for a narrow modal, 2 for a card).
 */
export function CustomFieldInputs({ cf, columns = 1, title }) {
  const { t } = useTranslation();
  if (!cf || !cf.hasFields) return null;
  const heading = title === undefined ? t("app.customFields.title") : title;
  return (
    <div className="space-y-3" data-tour="custom-fields">
      {heading && (
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
        </div>
      )}
      <div className={columns === 2 ? "grid sm:grid-cols-2 gap-3" : "space-y-3"}>
        {cf.fields.map((f) => (
          <CustomFieldInput
            key={f.id}
            field={f}
            value={cf.values[f.id]}
            error={cf.errors[f.id]}
            onChange={(v) => cf.setValue(f.id, v)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function CustomFieldInput({ field, value, error, onChange, t }) {
  const id = `cf-${field.id}`;
  const label = (
    <label htmlFor={id} className="block text-sm font-medium text-foreground">
      {field.label}
      {field.required && <span className="text-amber-600 dark:text-amber-400"> *</span>}
      {field.showOnDocuments && (
        <span className="ml-2 text-[11px] font-normal text-muted-foreground">
          {t("app.customFields.onDocument")}
        </span>
      )}
    </label>
  );
  const err = error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>;

  if (field.fieldType === "checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            id={id}
            type="checkbox"
            checked={value === true || value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          />
          {field.label}
          {field.showOnDocuments && (
            <span className="text-[11px] text-muted-foreground">{t("app.customFields.onDocument")}</span>
          )}
        </label>
        {err}
      </div>
    );
  }
  if (field.fieldType === "dropdown") {
    return (
      <div>
        {label}
        <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-1`}>
          <option value="">{t("app.customFields.select")}</option>
          {optionsOf(field).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {err}
      </div>
    );
  }
  return (
    <div>
      {label}
      <input
        id={id}
        type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
        step={field.fieldType === "number" ? "any" : undefined}
        maxLength={field.fieldType === "text" ? 500 : undefined}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-1`}
      />
      {err}
    </div>
  );
}

/**
 * Read-only answers for a detail view. `variant="rows"` prints plain
 * label/value rows for embedding in an existing card; the default is its
 * own card with a heading.
 */
export function CustomFieldsPanel({ entityType, entityId, fields: given, variant = "card", className = "" }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [loaded, setLoaded] = useState(null);
  // A page that already holds the hook (because it also edits the record)
  // passes `fields` and the panel follows every save; a page that only
  // reads loads its own copy once.
  const fields = given ?? loaded;

  useEffect(() => {
    if (!entityId || given) return undefined;
    let cancelled = false;
    fetchJson(valuesUrl(entityType, entityId))
      .then((rows) => {
        if (!cancelled) setLoaded(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        // No access, or nothing there: the panel stays absent. It is a
        // read-only extra on a page whose own load already told the person
        // what they may see.
        if (!cancelled) setLoaded([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, given]);

  const answered = (fields || []).filter((f) => f.value !== null && f.value !== "");
  if (answered.length === 0) return null;

  const rows = answered.map((f) => (
    <div key={f.id} className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">
        {f.label}
        {/* Said on the staff view so nobody is surprised by what the client
            sees: only definitions flagged for the document are printed. */}
        {f.showOnDocuments && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide">{t("app.customFields.onDocument")}</span>
        )}
      </span>
      <span className="text-foreground text-right break-words min-w-0">
        {formatCustomValue(f, f.value, {
          formatDate,
          yes: t("app.customFields.yes"),
          no: t("app.customFields.no"),
        })}
      </span>
    </div>
  ));

  if (variant === "rows") return <div className={`space-y-1.5 ${className}`}>{rows}</div>;
  // A section inside a document-shaped card (the quote and invoice detail
  // pages' own Block markup, copied so the two cannot drift apart visually).
  if (variant === "section") {
    return (
      <section className={`px-5 sm:px-7 py-5 border-t border-border ${className}`}>
        <h3 className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2">
          {t("app.customFields.title")}
        </h3>
        <div className="space-y-1.5 max-w-md">{rows}</div>
      </section>
    );
  }
  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-foreground mb-3">{t("app.customFields.title")}</h2>
      <div className="space-y-1.5">{rows}</div>
    </div>
  );
}
