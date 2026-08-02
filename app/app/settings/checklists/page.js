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
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const blankDraft = () => ({
  id: null,
  name: "",
  categoryId: "",
  items: [""],
});

export default function ChecklistsPage() {
  const { t } = useTranslation();
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
      const [tpls, c] = await Promise.all([
        fetch("/api/settings/checklists").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/settings/service-categories").then((r) =>
          r.ok ? r.json() : [],
        ),
      ]);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      // Only offer services the company actually turned on — the rest would
      // be noise in the dropdown.
      setCategories(
        (Array.isArray(c) ? c : []).filter((x) => x.enabled !== false),
      );
    } catch {
      setError(t("app.setChecklists.loadError"));
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
    if (!draft.name.trim()) return setError(t("app.setChecklists.nameRequired"));
    if (items.length === 0) return setError(t("app.setChecklists.itemRequired"));

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
      if (!res.ok) throw new Error(d?.error || t("app.setChecklists.saveError"));
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
        throw new Error(d?.error || t("app.setChecklists.deleteError"));
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
      <div className="animate-pulse h-80 bg-accent rounded-xl max-w-3xl" />
    );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("app.settings.checklists")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.setChecklists.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setDraft(blankDraft())}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg shrink-0"
        >
          <Plus size={14} /> {t("app.setChecklists.new")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {draft && (
        <div className="bg-card border border-inverted rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">
              {draft.id ? t("app.setChecklists.edit") : t("app.setChecklists.new")}
            </h2>
            <button
              onClick={() => setDraft(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("app.action.close")}
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("app.field.name")}
              </label>
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("app.setChecklists.namePlaceholder")}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("app.setChecklists.forService")}
              </label>
              <select
                value={draft.categoryId}
                onChange={(e) =>
                  setDraft({ ...draft, categoryId: e.target.value })
                }
                className={inputClass}
              >
                <option value="">{t("app.setChecklists.anyService")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("app.setChecklists.steps")}
            </label>
            <div className="space-y-2">
              {draft.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
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
                    placeholder={t("app.setChecklists.stepN", { n: i + 1 })}
                    className={inputClass}
                  />
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        items: draft.items.filter((_, j) => j !== i),
                      })
                    }
                    className="text-muted-foreground hover:text-red-600 dark:text-red-400 p-1 shrink-0"
                    aria-label={t("app.setChecklists.removeStep")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setDraft({ ...draft, items: [...draft.items, ""] })}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Plus size={13} /> {t("app.setChecklists.addStep")}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {draft.id ? t("app.setChecklists.saveChanges") : t("app.action.create")}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {t("app.action.cancel")}
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && !draft ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ClipboardList size={30} className="text-muted-foreground mx-auto" />
          <p className="mt-3 font-medium text-foreground">
            {t("app.setChecklists.emptyTitle")}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {t("app.setChecklists.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const items = Array.isArray(tpl.items) ? tpl.items : [];
            return (
              <div
                key={tpl.id}
                className={`bg-card border border-border rounded-xl p-5 ${
                  busyId === tpl.id ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">{tpl.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {items.length} step{items.length === 1 ? "" : "s"}
                      {tpl.category?.label && ` · ${tpl.category.label}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => edit(tpl)}
                      className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(tpl)}
                      disabled={Boolean(busyId)}
                      className="text-muted-foreground hover:text-red-600 dark:text-red-400 disabled:opacity-50"
                      aria-label="Delete checklist"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {items.slice(0, 6).map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      {item?.label || item?.text || String(item)}
                    </li>
                  ))}
                  {items.length > 6 && (
                    <li className="text-muted-foreground pl-5">
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
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";
