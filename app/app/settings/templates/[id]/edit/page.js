// app/app/settings/templates/[id]/edit/page.js
//
// Section editor for a PDF layout.
//
// A PDF has a fixed page frame and no interactivity, so the only real choices
// are which sections appear and in what order. That's what this edits — no
// drag-and-drop canvas, no rich text. Up/down buttons instead of drag because
// they work on a phone, work with a keyboard, and the list is never longer
// than seven items.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";
import { SECTION_META, sectionsForType } from "@/lib/documentSections/sectionMeta";

export default function EditPdfTemplatePage() {
  const { id } = useParams();
  const router = useRouter();

  const [template, setTemplate] = useState(null);
  const [name, setName] = useState("");
  const [sections, setSections] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings/document-templates/${id}`);
      if (!res.ok) throw new Error("Couldn't load this template.");
      const t = await res.json();
      setTemplate(t);
      setName(t.name || "");
      setSections(
        (Array.isArray(t.sections) ? t.sections : [])
          .slice()
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function move(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/settings/document-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          // sortOrder is what the renderer sorts by, so it's rewritten from
          // array position on every save. Storing the array order alone would
          // leave stale sortOrders that silently win at render time.
          sections: sections.map((s, i) => ({ ...s, sortOrder: i })),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "Couldn't save.");
      router.push("/app/settings/templates");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  // Renders the current layout against sample data so you can see the result
  // before a client does.
  async function preview() {
    setTesting(true);
    setError("");
    try {
      const res = await fetch(`/api/settings/document-templates/${id}/preview`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't generate a preview.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Give the new tab a moment to claim the blob before revoking it.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  if (loading)
    return <div className="animate-pulse h-80 bg-gray-200 rounded-xl max-w-2xl" />;

  if (!template)
    return (
      <div className="max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
          {error || "Template not found."}
        </div>
      </div>
    );

  const used = new Set(sections.map((s) => s.type));
  const addable = sectionsForType(template.type).filter((t) => !used.has(t));
  const missingRecommended = sectionsForType(template.type).filter(
    (t) => SECTION_META[t].recommended && !used.has(t),
  );

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/app/settings/templates"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> PDF Templates
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit layout</h1>
        <p className="text-sm text-gray-500 mt-1">
          {template.type === "invoice_pdf" ? "Invoice" : "Quote"} PDF
          {template.isDefault && " · currently in use"}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          For your reference only — clients never see this.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900">Sections, top to bottom</h2>

        {missingRecommended.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
            You&apos;ve removed{" "}
            {missingRecommended
              .map((t) => SECTION_META[t].label.toLowerCase())
              .join(" and ")}
            . The PDF will still generate, but it won&apos;t look like a
            finished document.
          </div>
        )}

        {sections.length === 0 ? (
          <p className="text-sm text-gray-500 mt-3">
            No sections. Add at least one below, or this template produces a
            blank page.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {sections.map((s, i) => {
              const meta = SECTION_META[s.type];
              return (
                <div
                  key={`${s.type}-${i}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="text-xs text-gray-300 tabular-nums w-4 shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {meta?.label || s.type}
                    </div>
                    {meta?.description && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {meta.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-25"
                      aria-label="Move up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === sections.length - 1}
                      className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-25"
                      aria-label="Move down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() =>
                        setSections(sections.filter((_, j) => j !== i))
                      }
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      aria-label="Remove section"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {addable.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Add a section
            </div>
            <div className="flex flex-wrap gap-2">
              {addable.map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    setSections([
                      ...sections,
                      { type, sortOrder: sections.length },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  <Plus size={12} /> {SECTION_META[type].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save
        </button>
        <button
          onClick={preview}
          disabled={testing || sections.length === 0}
          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60"
        >
          {testing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          Preview with sample data
        </button>
        <Link
          href="/app/settings/templates"
          className="text-sm font-semibold text-gray-500 px-2 py-2.5"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
