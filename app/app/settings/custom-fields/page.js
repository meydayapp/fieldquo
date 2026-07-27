// app/app/settings/custom-fields/page.js
"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";

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
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

export default function CustomFieldsPage() {
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
      .then((r) => r.json())
      .then((data) => setFields(Array.isArray(data) ? data : []))
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
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const res = await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom Fields</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track additional information specific to your business with custom
          fields.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          This is unrelated to emails — for that, see{" "}
          <a href="/app/settings/email-templates" className="underline">
            Email Templates
          </a>
          .
        </p>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
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
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-semibold text-gray-900">
                    {section.label}
                  </h2>
                  <button
                    onClick={() => openAdd(section.entityType)}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <Plus size={14} /> Add Field
                  </button>
                </div>

                {sectionFields.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-2">{section.empty}</p>
                ) : (
                  <div className="divide-y divide-gray-100 mt-2">
                    {sectionFields.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between py-2"
                      >
                        <div>
                          <span className="text-sm text-gray-900">
                            {f.label}
                          </span>
                          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                            {f.fieldType}
                          </span>
                          {f.required && (
                            <span className="ml-2 text-xs text-amber-600">
                              Required
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`Delete ${f.label}`}
                        >
                          <Trash2 size={14} />
                        </button>
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
            className="bg-white rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Add{" "}
                {SECTIONS.find((s) => s.entityType === modalEntityType)?.label}
              </h2>
              <button onClick={() => setModalEntityType(null)}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder="Field name"
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
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {form.fieldType === "dropdown" && (
                <input
                  placeholder="Options, comma separated"
                  value={form.options}
                  onChange={(e) =>
                    setForm({ ...form, options: e.target.value })
                  }
                  className={inputClass}
                />
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) =>
                    setForm({ ...form, required: e.target.checked })
                  }
                />
                Required
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add Field"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
