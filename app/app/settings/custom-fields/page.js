// app/app/settings/custom-fields/page.js
//
// ── What this page is for ──────────────────────────────────────────────────
//
// A custom field adds one extra box to a record FieldQuo doesn't ship a box
// for — "Gate code" on a client, "PO number" on an invoice, "Ticket expiry" on
// a team member. This page defines the boxes; the record's own form shows
// them and the record's page prints the answers.
//
// ── Where a definition actually lands ──────────────────────────────────────
//
// Each entity type is wired to a real form and a real detail view through
// app/components/customFields/CustomFieldsBox.js, and the answers live in
// CustomFieldValue by way of /api/custom-fields/values (lib/customFields/
// values.js is the one reader and writer):
//
//   client   /app/clients/new and the Edit modal on /app/clients/[id]; the
//            answers on the client's contact card.
//   quote    the quote builder (create and edit); the quote page; and, for
//            definitions flagged "show on documents", the PDF, the covering
//            email and the /q/<token> approval page.
//   job      /app/jobs/new and /app/jobs/[id]/edit; the job page.
//   invoice  /app/invoices/new and /app/invoices/[id]/edit; the invoice
//            page; flagged ones on the PDF, the email and the client portal.
//            Answers are keyed by the invoice FAMILY, so an amended invoice
//            keeps its PO number.
//   team     the Worker edit card under Settings > Team > Workers; the
//            person file. The Worker row is the person on the books; the
//            login seat (Member) is not what a ticket expiry belongs to.
//
// This page used to say nothing rendered these and stopped taking new
// definitions (AGENTS.md: a dead button is a lie). That was true then. The
// day a form rendered one, the Add control came back and the purpose
// sentence went back to the present tense — this commit.
//
// ── Property ───────────────────────────────────────────────────────────────
//
// There is no Property model in the schema — never was. A homeowner's
// property IS the client's address (Client.address) and a job's site is
// Job.siteAddress. The enum value exists, so definitions of that type can
// exist; they can be listed and deleted here, and this page says plainly
// that they have nowhere to appear. The Add control is not offered for it.
//
// ── "Show on documents" ────────────────────────────────────────────────────
//
// Off by default and only offered on quote and invoice definitions: most
// custom boxes are the company's own (a gate code is not the homeowner's
// business) and the one that belongs on the client's copy — a PO number —
// is a deliberate choice per field. The flag can be toggled on an existing
// definition from the list below.
//
// ── Read-only, not hidden ──────────────────────────────────────────────────
//
// The definitions describe fields a crew member fills in on jobs and clients,
// so knowing what "Gate code" is and whether it's required is directly useful
// to them. What isn't theirs is DEFINING one: adding a field changes every
// record in the company, and deleting one takes an answer off every record that
// had it. Both are "user:manage", the same gate /api/custom-fields enforces on
// POST, PATCH and DELETE.
"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";

// In the order a job flows: the client, what was quoted, the work, the
// bill, the people. Property is deliberately absent — see the header — and
// is rendered below ONLY when a company already has definitions of that type.
const SECTIONS = [
  {
    entityType: "client",
    label: "Client custom fields",
    empty: "Keep track of client details by adding a custom field",
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

// The only record types that have a client-facing document.
const DOCUMENT_ENTITY_TYPES = ["quote", "invoice"];

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function CustomFieldsPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canDefine = access.canChange("user:manage");
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEntityType, setModalEntityType] = useState(null);
  const [form, setForm] = useState({
    label: "",
    fieldType: "text",
    options: "",
    required: false,
    showOnDocuments: false,
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
    setForm({ label: "", fieldType: "text", options: "", required: false, showOnDocuments: false });
  }

  // Flip "show on documents" on an existing definition. Optimistic, and put
  // back on refusal — a toggle that stays flipped after the server said no
  // is the control-that-appears-to-work AGENTS.md warns about.
  async function toggleShowOnDocuments(field) {
    const next = !field.showOnDocuments;
    setFields((prev) => prev.map((f) => (f.id === field.id ? { ...f, showOnDocuments: next } : f)));
    const res = await fetch(`/api/custom-fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnDocuments: next }),
    });
    if (!res.ok) {
      setFields((prev) =>
        prev.map((f) => (f.id === field.id ? { ...f, showOnDocuments: field.showOnDocuments } : f)),
      );
      await reportResponseError(res);
    }
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
          showOnDocuments: DOCUMENT_ENTITY_TYPES.includes(modalEntityType) && form.showOnDocuments,
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

      {!access.canChange("user:manage") && (
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
          {SECTIONS.concat(
            // Only when definitions of that type already exist — see the header.
            fields.some((f) => f.entityType === "property")
              ? [{ entityType: "property", label: "Property custom fields", empty: "", orphan: true }]
              : [],
          ).map((section) => {
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
                  {canDefine && !section.orphan && (
                    <button
                      onClick={() => openAdd(section.entityType)}
                      className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground"
                    >
                      <Plus size={14} /> {t("app.setCustomFields.addField")}
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-2">
                  {t(`app.setCustomFields.where.${section.entityType}`)}
                </p>

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
                        <div className="flex items-center gap-3">
                          {DOCUMENT_ENTITY_TYPES.includes(f.entityType) && (
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={!!f.showOnDocuments}
                                disabled={!access.canChange("user:manage")}
                                onChange={() => toggleShowOnDocuments(f)}
                              />
                              {t("app.customFields.onDocument")}
                            </label>
                          )}
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
            className="fq-dialog-card bg-card rounded-2xl w-full max-w-sm p-6"
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
              {DOCUMENT_ENTITY_TYPES.includes(modalEntityType) && (
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.showOnDocuments}
                    onChange={(e) => setForm({ ...form, showOnDocuments: e.target.checked })}
                  />
                  <span>
                    {t("app.customFields.showOnDocuments")}
                    <span className="block text-xs">{t("app.customFields.showOnDocumentsHint")}</span>
                  </span>
                </label>
              )}
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
