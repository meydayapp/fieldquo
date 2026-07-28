// app/app/settings/checklists/page.js
//
// Reusable checklists that get stamped onto a job visit — "mask the counters,
// photograph before, photograph after". Kept here rather than on the job
// itself because the whole point is not retyping them per job.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  ClipboardList,
  AlertCircle,
  X,
  GripVertical,
} from "lucide-react";

const blankDraft = () => ({
  id: null,
  name: "",
  categoryId: "",
  items: [""],
});

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [t, c] = await Promise.all([
        fetch("/api/settings/checklists").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/settings/service-categories").then((r) =>
          r.ok ? r.json() : [],
        ),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      // Only offer services the company actually turned on — the rest would
      // be noise in the dropdown.
      setCategories(
        (Array.isArray(c) ? c : []).filter((x) => x.enabled !== false),
      );
    } catch {
      setError("Couldn't load checklists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function edit(template) {
    setDraft({
      id: template.id,
      name: template.name,
      categoryId: template.categoryId || "",
      items: (Array.isArray(template.items) ? template.items : []).map(
        (i) => i?.label || i?.text || String(i || ""),
      ),
    });
  }

  async function save() {
    const items = draft.items.map((i) => i.trim()).filter(Boolean);
    if (!draft.name.trim()) return setError("Give it a name.");
    if (items.length === 0) return setError("Add at least one item.");

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/checklists", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name.trim(),
          categoryId: draft.categoryId || null,
          items,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "Couldn't save.");
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(template) {
    setBusyId(template.id);
    setError("");
    try {
      const res = await fetch(
        `/api/settings/checklists?id=${encodeURIComponent(template.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't delete.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  if (loading)
    return (
      <div className="animate-pulse h-80 bg-gray-200 rounded-xl max-w-3xl" />
    );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checklists</h1>
          <p className="text-sm text-gray-500 mt-1">
            Standard steps your crew works through on site. Attach one to a job
            visit and it comes across as a fresh, tickable copy.
          </p>
        </div>
        <button
          onClick={() => setDraft(blankDraft())}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg shrink-0"
        >
          <Plus size={14} /> New checklist
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {draft && (
        <div className="bg-white border border-gray-900 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {draft.id ? "Edit checklist" : "New checklist"}
            </h2>
            <button
              onClick={() => setDraft(null)}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Kitchen refinish — day one"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                For which service
              </label>
              <select
                value={draft.categoryId}
                onChange={(e) =>
                  setDraft({ ...draft, categoryId: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Any service</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Steps
            </label>
            <div className="space-y-2">
              {draft.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical size={14} className="text-gray-300 shrink-0" />
                  <input
                    value={item}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((x, j) =>
                          j === i ? e.target.value : x,
                        ),
                      })
                    }
                    onKeyDown={(e) => {
                      // Enter adds the next step. Typing ten items shouldn't
                      // mean ten trips to the mouse.
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setDraft({
                          ...draft,
                          items: [
                            ...draft.items.slice(0, i + 1),
                            "",
                            ...draft.items.slice(i + 1),
                          ],
                        });
                      }
                    }}
                    placeholder={`Step ${i + 1}`}
                    className={inputClass}
                  />
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        items: draft.items.filter((_, j) => j !== i),
                      })
                    }
                    className="text-gray-400 hover:text-red-600 p-1 shrink-0"
                    aria-label="Remove step"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setDraft({ ...draft, items: [...draft.items, ""] })}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <Plus size={13} /> Add step
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {draft.id ? "Save changes" : "Create"}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && !draft ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <ClipboardList size={30} className="text-gray-300 mx-auto" />
          <p className="mt-3 font-medium text-gray-900">No checklists yet</p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Write down the steps your crew repeats on every job once, and stop
            relying on people remembering them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const items = Array.isArray(t.items) ? t.items : [];
            return (
              <div
                key={t.id}
                className={`bg-white border border-gray-200 rounded-xl p-5 ${
                  busyId === t.id ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {items.length} step{items.length === 1 ? "" : "s"}
                      {t.category?.label && ` · ${t.category.label}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => edit(t)}
                      className="text-sm font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(t)}
                      disabled={Boolean(busyId)}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                      aria-label="Delete checklist"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <ol className="mt-3 space-y-1 text-sm text-gray-600">
                  {items.slice(0, 6).map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gray-300 tabular-nums">
                        {i + 1}.
                      </span>
                      {item?.label || item?.text || String(item)}
                    </li>
                  ))}
                  {items.length > 6 && (
                    <li className="text-gray-400 pl-5">
                      and {items.length - 6} more
                    </li>
                  )}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";
