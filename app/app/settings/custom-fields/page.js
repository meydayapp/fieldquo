// app/app/settings/custom-fields/page.js
//
// ── What this page is for ──────────────────────────────────────────────────
//
// It came up twice that nobody could tell. A custom field adds one extra box to
// a record FieldQuo doesn't ship a box for — "Gate code" on a property, "PO
// number" on an invoice, "Ticket expiry" on a team member.
//
// ── The box does not exist yet, and this page used to say it did ────────────
//
// The sentence here read "makes it appear on every record of that type, for
// everyone in the company". It appears on no record. `db.customFieldValue` has
// ZERO call sites in the whole repo, no form renders a CustomField, and
// prisma/schema.prisma says so itself above CustomFieldValue: "Not wired up to
// any of those forms yet … the model just exists so the data has somewhere to
// live once that integration happens."
//
// That was fixed once by putting a Coming-soon panel above the sentence, which
// left the SENTENCE still claiming the present tense — "adds one extra box to
// every client, property, quote, job, invoice or team record". A panel beside a
// false sentence is not a true screen. app.setCustomFields.purpose now says, in
// all nine languages, that nothing shows these yet. Reword it back to the
// present tense on the day a record form renders one, in the same commit.
//
// So this was a form that saved definitions nothing would ever show — the
// written-and-never-read defect, with an Add button on it. AGENTS.md: "If you
// can't finish it this session, don't render it — a Coming soon panel is
// honest; a dead button is not."
//
// Wiring the fields into the client, property, quote, job, invoice and team
// forms (plus a value read/write path) is a feature, not a fix, so it is NOT
// done here. What is done: the page says plainly that nothing shows these yet,
// and it stops taking new definitions. Existing ones stay listed and can still
// be removed, because a company that defined some should be able to see and
// clear them. Delete the notice and restore `canDefine` on the Add control the
// day a record form renders one.
//
// ── Read-only, not hidden ──────────────────────────────────────────────────
//
// The definitions describe fields a crew member fills in on jobs and clients,
// so knowing what "Gate code" is and whether it's required is directly useful
// to them. What isn't theirs is DEFINING one: adding a field changes every
// record in the company, and deleting one takes an answer off every record that
// had it. Both are "user:manage", the same gate /api/custom-fields enforces on
// POST, PATCH and DELETE.
//
// So the list stays and the two controls go. They were live before — the Add
// modal opened, accepted a name and a type, and collected "Only owners/admins
// can add custom fields" on submit, after the typing.
"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";

const SECTIONS = [
  {
    entityType: "client",
    label: "Client custom fields",
    empty: "Keep track of client details by adding a custom field",
  },
  {
    entityType: "property",
    label: "Property custom fields",
    empty: "Keep track of property details by adding a custom field",
  },
  {
    entityType: "quote",
    label: "Quote custom fields",
    empty: "Keep track of quote details by adding a custom field",
  },
  {
    entityType: "job",
    label: "Job custom fields",
    empty: "Keep track of job details by adding a custom field",
  },
  {
    entityType: "invoice",
    label: "Invoice custom fields",
    empty: "Keep track of invoice details by adding a custom field",
  },
  {
    entityType: "team",
    label: "Team custom fields",
    empty: "Keep track of user details by adding a custom field",
  },
];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "dropdown", label: "Dropdown" },
];

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

// No record form reads a CustomField anywhere in the product. Kept as a named
// constant rather than inlined so the day that changes, one edit re-enables the
// Add control and removes the notice together — they must never disagree.
const FIELDS_REACH_RECORDS = false;

export default function CustomFieldsPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canDefine = access.canChange("user:manage") && FIELDS_REACH_RECORDS;
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEntityType, setModalEntityType] = useState(null);
  const [form, setForm] = useState({
    label: "",
    fieldType: "text",
    options: "",
    required: false,
  });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    return fetch("/api/custom-fields")
      .then(async (res) => {
        // Was silent: a failed load left an empty page with no error at all.
        if (!res.ok) {
          await reportResponseError(res);
          return;
        }
        const data = await res.json();
        setFields(Array.isArray(data) ? data : []);
      })
      .catch(() => showError("Couldn't load custom fields. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd(entityType) {
    setModalEntityType(entityType);
    setForm({ label: "", fieldType: "text", options: "", required: false });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: modalEntityType,
          label: form.label,
          fieldType: form.fieldType,
          options:
            form.fieldType === "dropdown"
              ? form.options
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean)
              : undefined,
          required: form.required,
        }),
      });
      if (res.ok) {
        setModalEntityType(null);
        load();
      } else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const res = await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    if (res.ok) load(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.customFields")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setCustomFields.subtitle")}
        </p>
        {/* The missing sentence. "Track additional information" doesn't say
            where the box appears or who fills it in, which is why the page read
            as unexplained. */}
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setCustomFields.purpose")}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.setCustomFields.emailNote")}{" "}
          <a href="/app/settings/email-templates" className="underline">
            {t("app.settings.emailTemplates")}
          </a>
          .
        </p>
      </div>

      {/* One coherent block, not a reason floating above a greyed-out form:
          the form is gone, and this says why. */}
      {!FIELDS_REACH_RECORDS && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {/* AGENTS.md, verbatim: "a Coming soon panel is honest; a dead
                button is not". Sitting directly above the existing
                app.setCustomFields.purpose sentence, which describes what a
                custom field WILL do, this reads as the future tense that
                sentence needed and could not have without a new key. The
                fuller explanation is in the report as a key to add. */}
            {t("app.state.comingSoon")}
          </p>
        </div>
      )}

      {FIELDS_REACH_RECORDS && !access.canChange("user:manage") && (
        <ReadOnlyNotice
          capability="user:manage"
          what={t("app.setCustomFields.readOnlyWhat")}
        />
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-accent rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const sectionFields = fields.filter(
              (f) => f.entityType === section.entityType,
            );
            return (
              <div
                key={section.entityType}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-semibold text-foreground">
                    {t(`app.setCustomFields.label.${section.entityType}`, section.label)}
                  </h2>
                  {canDefine && (
                    <button
                      onClick={() => openAdd(section.entityType)}
                      className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground"
                    >
                      <Plus size={14} /> {t("app.setCustomFields.addField")}
                    </button>
                  )}
                </div>

                {sectionFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    {t(`app.setCustomFields.empty.${section.entityType}`, section.empty)}
                  </p>
                ) : (
                  <div className="divide-y divide-border mt-2">
                    {sectionFields.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between py-2"
                      >
                        <div>
                          <span className="text-sm text-foreground">
                            {f.label}
                          </span>
                          {/* Was `{f.fieldType}` with a CSS capitalize — the
                              raw CustomFieldType enum value, untranslated. */}
                          <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            {t(
                              `app.setCustomFields.type.${f.fieldType}`,
                              FIELD_TYPES.find((ft) => ft.value === f.fieldType)?.label ||
                                f.fieldType,
                            )}
                          </span>
                          {f.required && (
                            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                              {t("app.state.required")}
                            </span>
                          )}
                        </div>
                        {access.canChange("user:manage") && (
                          <button
                            onClick={() => handleDelete(f.id)}
                            className="text-muted-foreground hover:text-red-500"
                            aria-label={t("app.setCustomFields.deleteAria", { label: f.label })}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalEntityType && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setModalEntityType(null)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {t("app.setCustomFields.addTitle", {
                  label: t(
                    `app.setCustomFields.label.${modalEntityType}`,
                    SECTIONS.find((s) => s.entityType === modalEntityType)?.label,
                  ),
                })}
              </h2>
              <button onClick={() => setModalEntityType(null)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder={t("app.setCustomFields.fieldNamePlaceholder")}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className={inputClass}
              />
              <select
                value={form.fieldType}
                onChange={(e) =>
                  setForm({ ...form, fieldType: e.target.value })
                }
                className={inputClass}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {form.fieldType === "dropdown" && (
                <input
                  placeholder={t("app.setCustomFields.optionsPlaceholder")}
                  value={form.options}
                  onChange={(e) =>
                    setForm({ ...form, options: e.target.value })
                  }
                  className={inputClass}
                />
              )}
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) =>
                    setForm({ ...form, required: e.target.checked })
                  }
                />
                {t("app.state.required")}
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving ? t("app.action.saving") : t("app.setCustomFields.addField")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
