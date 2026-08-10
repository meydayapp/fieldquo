// app/app/settings/checklists/page.js
//
// Reusable checklists that get stamped onto a job visit — "mask the counters,
// photograph before, photograph after". Kept here rather than on the job
// itself because the whole point is not retyping them per job.
//
// Two lists on this page, and the split is deliberate. The top one is what the
// company wrote; the bottom is FieldQuo's per-trade starter library. Taking a
// suggestion COPIES it into the company's own list rather than linking to it,
// because the first thing anyone does with a starter list is change a line of
// it — and an edit to a shared row would rewrite it for every other tenant.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  ClipboardList,
  AlertCircle,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { CHECKLIST_PHASES, PHASE_LABELS } from "@/lib/jobs/checklistItems";

const blankDraft = () => ({
  id: null,
  name: "",
  categoryId: "",
  phase: "during",
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
        // includeSystem: the starter library is only fetched where it's
        // offered, so the settings list isn't padded with rows the company
        // never wrote.
        fetch("/api/settings/checklists?includeSystem=1").then((r) =>
          r.ok ? r.json() : [],
        ),
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

  // System rows are suggestions, not the company's list. Split once here so no
  // rendering path below can accidentally show an Edit button on a row this
  // company doesn't own — the API would 404 it, which is a dead control.
  const own = useMemo(
    () => templates.filter((tpl) => !tpl.isSystem),
    [templates],
  );
  const suggested = useMemo(
    () => templates.filter((tpl) => tpl.isSystem),
    [templates],
  );

  function edit(template) {
    setDraft({
      id: template.id,
      name: template.name,
      categoryId: template.categoryId || "",
      phase: template.phase || "during",
      items: (Array.isArray(template.items) ? template.items : []).map(
        (i) => i?.label || i?.text || String(i || ""),
      ),
    });
  }

  // "Use this" opens the suggestion as an unsaved NEW draft rather than
  // creating it behind the scenes. The company sees exactly what they're about
  // to own, and can cut the two lines that don't apply to them before it lands
  // in their list — the same reason nothing here auto-applies to a visit.
  //
  // Named copySuggestion, not useSuggestion: a `use` prefix makes React's
  // rules-of-hooks lint treat it as a hook and reject the call from inside the
  // onClick below.
  function copySuggestion(template) {
    setDraft({
      id: null,
      name: template.name,
      categoryId: template.categoryId || "",
      phase: template.phase || "during",
      items: (Array.isArray(template.items) ? template.items : []).map(
        (i) => i?.label || i?.text || String(i || ""),
      ),
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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
          phase: draft.phase,
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
            <label className="block text-sm font-medium text-foreground mb-1">
              When in the visit
            </label>
            <select
              value={draft.phase}
              onChange={(e) => setDraft({ ...draft, phase: e.target.value })}
              className={inputClass}
            >
              {CHECKLIST_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {PHASE_LABELS[phase]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Site prep and materials before, the work itself during, cleanup
              and the client walkthrough after. A visit groups its checklist
              under these headings.
            </p>
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

      {own.length === 0 && !draft ? (
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
          {own.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              dimmed={busyId === tpl.id}
              actions={
                <>
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
                </>
              }
            />
          ))}
        </div>
      )}

      {suggested.length > 0 && (
        <div className="space-y-3 pt-2">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Sparkles size={15} className="text-muted-foreground" />
              Starter checklists for your trades
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Written for the services you have switched on. Nothing here is
              applied to a job on its own — take a copy, cut what doesn&apos;t
              suit you, and it becomes yours to edit.
            </p>
          </div>

          {suggested.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              actions={
                <button
                  onClick={() => copySuggestion(tpl)}
                  className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
                >
                  <Plus size={13} /> Use this
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Shared card for both lists. The Edit/Delete vs "Use this" difference is
// passed in, so a suggestion can never pick up an Edit button by copy-paste
// drift between two near-identical blocks.
function TemplateCard({ template, actions, dimmed = false }) {
  const items = Array.isArray(template.items) ? template.items : [];
  const phase = template.phase || "during";

  return (
    <div
      className={`bg-card border border-border rounded-xl p-5 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{template.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-full border border-border">
              {PHASE_LABELS[phase] || PHASE_LABELS.during}
            </span>
            <span>
              {items.length} step{items.length === 1 ? "" : "s"}
              {template.category?.label && ` · ${template.category.label}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>

      <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
        {items.slice(0, 6).map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
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
}

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";
