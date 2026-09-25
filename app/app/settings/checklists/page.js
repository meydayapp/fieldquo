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
  ArrowUp,
  ArrowDown,
  Download,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  CHECKLIST_PHASES,
  phaseLabelKey,
  ITEM_TYPE_TO_RESPONSE,
} from "@/lib/jobs/checklistItems";
import { localizeItem, templateName } from "@/lib/checklists/typedItems";
import { LANGUAGES } from "@/app/i18n/languages";

// ── The draft: sections of typed items ─────────────────────────────────────
//
// A template is stored as a flat item list where each item names its section
// (lib/jobs/checklistItems.js); the editor works in sections because that is
// how a person thinks about a form, and flattens on save. Everything an item
// carries that this editor does not show (a construction item's criteria,
// reference, tolerance, its other-language wording) rides along in `rest` so
// saving a list never strips what the seed or another screen put there — the
// old one-line-per-step editor did, and an edit to a seeded inspection list
// silently threw its acceptance criteria away.
const ITEM_TYPES = Object.keys(ITEM_TYPE_TO_RESPONSE);
const RESPONSE_TO_TYPE = Object.fromEntries(
  Object.entries(ITEM_TYPE_TO_RESPONSE).filter(([, r]) => r).map(([k, r]) => [r, k]),
);
const HAS_OPTIONS = new Set(["select", "multiselect"]);

const blankItem = () => ({ label: "", type: "check", required: false, options: "", rest: {} });

const blankDraft = () => ({
  id: null,
  name: "",
  categoryId: "",
  phase: "during",
  requiredToClose: false,
  autoAddFor: [],
  translations: {},
  sections: [{ title: "", items: [blankItem()] }],
});

/** A stored template → the editor's draft. */
function draftFrom(template, asNew = false) {
  const sections = [];
  const byTitle = new Map();
  for (const raw of Array.isArray(template.items) ? template.items : []) {
    const item = raw && typeof raw === "object" ? raw : { label: String(raw || "") };
    const title = item.section || "";
    if (!byTitle.has(title)) {
      const sec = { title, items: [] };
      byTitle.set(title, sec);
      sections.push(sec);
    }
    const { label, section: _s, required, options, type, done: _d, phase: _p, ...rest } = item;
    // A legacy answer type the editor has no name for (pass/fail/N-A, yes/no,
    // date) is kept as written — "__keep" — until somebody picks another.
    const typeKey = type && ITEM_TYPES.includes(type)
      ? type
      : item.responseType
        ? RESPONSE_TO_TYPE[item.responseType] || "__keep"
        : "check";
    byTitle.get(title).items.push({
      label: label || item.text || "",
      type: typeKey,
      required: required === true,
      options: Array.isArray(options) ? options.join(", ") : "",
      rest,
    });
  }
  return {
    id: asNew ? null : template.id,
    name: template.name,
    categoryId: template.categoryId || "",
    phase: template.phase || "during",
    requiredToClose: template.requiredToClose === true,
    autoAddFor: Array.isArray(template.autoAddFor) ? template.autoAddFor : [],
    translations: template.translations && typeof template.translations === "object" ? template.translations : {},
    sections: sections.length ? sections : [{ title: "", items: [blankItem()] }],
  };
}

const splitOptions = (text) =>
  String(text || "").split(",").map((o) => o.trim()).filter(Boolean);

/** The editor's draft → the items the API stores. */
function itemsFromDraft(draft) {
  return draft.sections.flatMap((sec) =>
    sec.items
      .filter((i) => i.label.trim())
      .map((i) => {
        const rest = { ...i.rest };
        // An explicit type replaces whatever answer type the item carried.
        if (i.type !== "__keep") delete rest.responseType;
        const options = HAS_OPTIONS.has(i.type) || (i.type === "__keep" && i.options)
          ? splitOptions(i.options)
          : undefined;
        return {
          ...rest,
          label: i.label.trim(),
          ...(sec.title.trim() && { section: sec.title.trim() }),
          ...(i.type !== "__keep" && { type: i.type }),
          ...(i.required && { required: true }),
          ...(options && options.length && { options }),
        };
      }),
  );
}

export default function ChecklistsPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  // "The server answered." Empty is only a real statement once this is true.
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      // ── `r.ok ? r.json() : []` is a lie with a fallback ─────────────────
      //
      // A 401/403/500 resolved to an empty array, so the catch below never
      // fired and setError was never called. The page then rendered its empty
      // state — "No checklists yet / Write down the steps your crew repeats" —
      // to a company with a dozen of them, with nothing on screen saying the
      // request had failed. lib/loadState.js was written about exactly this.
      //
      // Failing the whole load on either leg is deliberate: the service list
      // feeds the "For which service" select, and a silently short one saves a
      // template against the wrong category.
      const [tpls, c] = await Promise.all([
        // includeSystem: the starter library is only fetched where it's
        // offered, so the settings list isn't padded with rows the company
        // never wrote.
        fetch("/api/settings/checklists?includeSystem=1").then((r) =>
          r.ok ? r.json() : Promise.reject(r),
        ),
        fetch("/api/settings/service-categories").then((r) =>
          r.ok ? r.json() : Promise.reject(r),
        ),
      ]);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      // Only offer services the company actually turned on — the rest would
      // be noise in the dropdown.
      setCategories(
        (Array.isArray(c) ? c : []).filter((x) => x.enabled !== false),
      );
      setLoaded(true);
    } catch (err) {
      setError(
        err instanceof Response
          ? await reportResponseError(err, t("app.setChecklists.loadError"))
          : t("app.setChecklists.loadError"),
      );
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

  const [tab, setTab] = useState("items");
  const [installing, setInstalling] = useState(false);
  const [notice, setNotice] = useState("");

  function edit(template) {
    setTab("items");
    setDraft(draftFrom(template));
  }

  // "Add the starter checklists for my trades": the same installer signup
  // and switching a trade on run (lib/checklists/seedTemplates.js), for a
  // company whose trades predate the per-trade lists. Idempotent — the
  // result says how many were new, including "none".
  async function installStarters() {
    setInstalling(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/settings/checklists/seed", { method: "POST" });
      if (!res.ok) {
        setError(await reportResponseError(res, t("app.setChecklists.saveError")));
        return;
      }
      const d = await res.json();
      setNotice(
        d.created > 0
          ? t("app.checklists.installed", { count: d.created })
          : t("app.checklists.installedNone"),
      );
      await load();
    } catch {
      setError(t("app.setChecklists.saveError"));
    } finally {
      setInstalling(false);
    }
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
    setTab("items");
    setDraft(draftFrom(template, true));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    const items = itemsFromDraft(draft);
    if (!draft.name.trim()) return setError(t("app.setChecklists.nameRequired"));
    if (items.length === 0) return setError(t("app.setChecklists.itemRequired"));
    const noOptions = draft.sections
      .flatMap((s) => s.items)
      .find((i) => i.label.trim() && HAS_OPTIONS.has(i.type) && splitOptions(i.options).length === 0);
    if (noOptions) return setError(t("app.checklists.optionsRequired", { item: noOptions.label.trim() }));

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
          requiredToClose: draft.requiredToClose,
          autoAddFor: draft.autoAddFor,
          translations: draft.translations,
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={installStarters}
            disabled={installing}
            className="inline-flex items-center gap-2 border border-border text-sm font-semibold px-4 py-2 rounded-lg hover:bg-muted disabled:opacity-60"
          >
            {installing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {t("app.checklists.installStarters")}
          </button>
          <button
            onClick={() => {
              setTab("items");
              setDraft(blankDraft());
            }}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg shrink-0"
          >
            <Plus size={14} /> {t("app.setChecklists.new")}
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

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
              {t("app.checklists.phaseLabel")}
            </label>
            <select
              value={draft.phase}
              onChange={(e) => setDraft({ ...draft, phase: e.target.value })}
              className={inputClass}
            >
              {CHECKLIST_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {t(phaseLabelKey(phase))}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {t("app.checklists.phaseHint")}
            </p>
          </div>

          <div className="flex gap-1 border-b border-border" role="tablist">
            {["items", "translations"].map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`px-3 py-2 text-sm font-semibold -mb-px border-b-2 ${
                  tab === key
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {key === "items" ? t("app.checklists.tabItems") : t("app.checklists.tabTranslations")}
              </button>
            ))}
          </div>

          {tab === "items" ? (
            <SectionsEditor draft={draft} setDraft={setDraft} />
          ) : (
            <TranslationsEditor draft={draft} setDraft={setDraft} />
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.requiredToClose}
                onChange={(e) => setDraft({ ...draft, requiredToClose: e.target.checked })}
              />
              <span>
                {t("app.checklists.requiredToClose")}
                <span className="block text-xs text-muted-foreground">{t("app.checklists.requiredHint")}</span>
              </span>
            </label>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">{t("app.checklists.autoAdd")}</legend>
              <p className="text-xs text-muted-foreground mb-2">{t("app.checklists.autoAddHint")}</p>
              {categories.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("app.checklists.autoAddNone")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => {
                    const on = draft.autoAddFor.includes(c.key);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            autoAddFor: on
                              ? draft.autoAddFor.filter((k) => k !== c.key)
                              : [...draft.autoAddFor, c.key],
                          })
                        }
                        className={`min-h-[36px] px-3 rounded-full border text-sm font-medium ${
                          on
                            ? "border-inverted bg-inverted text-inverted-foreground"
                            : "border-border text-foreground bg-card hover:bg-muted"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
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

      {/* `loaded` and not merely `own.length === 0`: the empty panel is the
          loudest thing on this screen and it makes a claim about the company.
          It may only appear once the server has actually said "none". */}
      {loaded && own.length === 0 && !draft ? (
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
              categories={categories}
              dimmed={busyId === tpl.id}
              actions={
                <>
                  <button
                    onClick={() => edit(tpl)}
                    data-edit-checklist={tpl.seedKey || tpl.id}
                    className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {t("app.action.edit")}
                  </button>
                  <button
                    onClick={() => remove(tpl)}
                    disabled={Boolean(busyId)}
                    className="text-muted-foreground hover:text-red-600 dark:text-red-400 disabled:opacity-50"
                    aria-label={t("app.checklists.deleteLabel")}
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
              {t("app.checklists.starterTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("app.checklists.starterBody")}
            </p>
          </div>

          {suggested.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              categories={categories}
              actions={
                <button
                  onClick={() => copySuggestion(tpl)}
                  className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
                >
                  <Plus size={13} /> {t("app.checklists.useThis")}
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
function TemplateCard({ template, actions, dimmed = false, categories = [] }) {
  const { t, language } = useTranslation();
  const autoLabels = (template.autoAddFor || []).map(
    (key) => categories.find((c) => c.key === key)?.label || key,
  );
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
          <div className="font-semibold text-foreground">{templateName(template, language)}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-full border border-border">
              {t(phaseLabelKey(phase))}
            </span>
            <span>
              {/* countedNoun, not `step${n === 1 ? "" : "s"}`: French and
                  Punjabi treat ZERO as singular and Ukrainian has three forms.
                  The English ternary was right for English and wrong for four
                  of the nine languages this renders in. */}
              {t("app.checklists.stepCount", { value: items.length })}
              {template.category?.label && ` · ${template.category.label}`}
            </span>
            {template.requiredToClose && (
              <span className="px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
                {t("app.checklists.requiredBadge")}
              </span>
            )}
            {autoLabels.length > 0 && (
              <span className="px-2 py-0.5 rounded-full border border-border">
                {t("app.checklists.autoBadge", { trades: autoLabels.join(", ") })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>

      <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
        {items.slice(0, 6).map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
            {(item && typeof item === "object" && localizeItem(item, language).label) || item?.label || item?.text || String(item)}
          </li>
        ))}
        {items.length > 6 && (
          <li className="text-muted-foreground pl-5">
            {t("app.checklists.andMore", { count: items.length - 6 })}
          </li>
        )}
      </ol>
    </div>
  );
}

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

// ── Items tab: sections, each an ordered list of typed items ───────────────
function SectionsEditor({ draft, setDraft }) {
  const { t } = useTranslation();
  const setSections = (sections) => setDraft({ ...draft, sections });
  const setSection = (si, patch) =>
    setSections(draft.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setItem = (si, ii, patch) =>
    setSection(si, {
      items: draft.sections[si].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)),
    });
  const move = (list, from, to) => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    return next;
  };
  const typeLabel = (type) =>
    type === "__keep" ? t("app.checklists.type.keep") : t(`app.checklists.type.${type}`);

  return (
    <div className="space-y-4">
      {draft.sections.map((sec, si) => (
        <div key={si} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={sec.title}
              onChange={(e) => setSection(si, { title: e.target.value })}
              placeholder={t("app.checklists.sectionTitle")}
              className={`${inputClass} font-semibold`}
            />
            <button
              type="button"
              onClick={() => setSections(move(draft.sections, si, si - 1))}
              disabled={si === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 min-h-[40px] min-w-[32px] flex items-center justify-center"
              aria-label={t("app.checklists.moveUp")}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => setSections(move(draft.sections, si, si + 1))}
              disabled={si === draft.sections.length - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 min-h-[40px] min-w-[32px] flex items-center justify-center"
              aria-label={t("app.checklists.moveDown")}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              onClick={() => setSections(draft.sections.filter((_, j) => j !== si))}
              disabled={draft.sections.length === 1}
              className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 min-h-[40px] min-w-[32px] flex items-center justify-center"
              aria-label={t("app.checklists.removeSection")}
            >
              <Trash2 size={14} />
            </button>
          </div>

          {sec.items.map((item, ii) => (
            <div key={ii} className="grid gap-2 sm:grid-cols-[1fr_11rem_auto] items-start border-t border-border pt-2">
              <div className="space-y-1.5">
                <input
                  value={item.label}
                  onChange={(e) => setItem(si, ii, { label: e.target.value })}
                  onKeyDown={(e) => {
                    // Enter adds the next item — typing a list shouldn't mean
                    // a trip to the mouse per line (the old editor's rule).
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const items = [...sec.items];
                      items.splice(ii + 1, 0, blankItem());
                      setSection(si, { items });
                    }
                  }}
                  placeholder={t("app.setChecklists.stepN", { n: ii + 1 })}
                  className={inputClass}
                />
                {(HAS_OPTIONS.has(item.type) || (item.type === "__keep" && item.options)) && (
                  <input
                    value={item.options}
                    onChange={(e) => setItem(si, ii, { options: e.target.value })}
                    placeholder={t("app.checklists.options")}
                    className={inputClass}
                  />
                )}
              </div>
              <select
                value={item.type}
                onChange={(e) => setItem(si, ii, { type: e.target.value })}
                aria-label={t("app.checklists.itemType")}
                className={inputClass}
              >
                {item.type === "__keep" && <option value="__keep">{typeLabel("__keep")}</option>}
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <label className="inline-flex items-center gap-1.5 text-xs text-foreground min-h-[40px] px-1">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) => setItem(si, ii, { required: e.target.checked })}
                  />
                  {t("app.checklists.required")}
                </label>
                <button
                  type="button"
                  onClick={() => setSection(si, { items: move(sec.items, ii, ii - 1) })}
                  disabled={ii === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 min-h-[40px] min-w-[28px] flex items-center justify-center"
                  aria-label={t("app.checklists.moveUp")}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setSection(si, { items: move(sec.items, ii, ii + 1) })}
                  disabled={ii === sec.items.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 min-h-[40px] min-w-[28px] flex items-center justify-center"
                  aria-label={t("app.checklists.moveDown")}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setSection(si, { items: sec.items.filter((_, j) => j !== ii) })}
                  className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 min-h-[40px] min-w-[28px] flex items-center justify-center"
                  aria-label={t("app.setChecklists.removeStep")}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSection(si, { items: [...sec.items, blankItem()] })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Plus size={13} /> {t("app.setChecklists.addStep")}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setSections([...draft.sections, { title: "", items: [blankItem()] }])}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <Plus size={13} /> {t("app.checklists.addSection")}
      </button>
    </div>
  );
}

// ── Translations tab ───────────────────────────────────────────────────────
//
// How the list reads for a crew member working in another language. Written
// onto the template (`translations` for the name, each item's `i18n` for its
// wording, section and options) and carried onto every job it is put on, where
// the crew screen reads the viewer's language, then English, then the wording
// on the Items tab (lib/checklists/typedItems.js localizeItem). A blank field
// means "use the wording as written", never an empty label.
function TranslationsEditor({ draft, setDraft }) {
  const { t, language } = useTranslation();
  const [lang, setLang] = useState(LANGUAGES.find((l) => l.code !== language)?.code || "fr");

  const trOf = (item) => (item.rest.i18n && item.rest.i18n[lang]) || {};
  const setTr = (si, ii, patch) =>
    setDraft({
      ...draft,
      sections: draft.sections.map((sec, i) =>
        i !== si
          ? sec
          : {
              ...sec,
              items: sec.items.map((it, j) => {
                if (ii !== null && j !== ii) return it;
                const i18n = { ...(it.rest.i18n || {}) };
                const next = { ...(i18n[lang] || {}), ...patch };
                for (const k of Object.keys(next)) if (next[k] === "" || next[k] == null) delete next[k];
                if (Object.keys(next).length) i18n[lang] = next;
                else delete i18n[lang];
                return { ...it, rest: { ...it.rest, i18n } };
              }),
            },
      ),
    });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("app.checklists.translationsHint")}</p>
      <label className="block text-sm font-medium text-foreground">
        {t("app.checklists.language")}
        <select value={lang} onChange={(e) => setLang(e.target.value)} className={`${inputClass} mt-1 max-w-xs`}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName}
            </option>
          ))}
        </select>
      </label>
      <input
        value={draft.translations?.[lang]?.name || ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            translations: { ...draft.translations, [lang]: { name: e.target.value } },
          })
        }
        placeholder={draft.name}
        aria-label={t("app.field.name")}
        className={`${inputClass} font-semibold`}
      />
      {draft.sections.map((sec, si) => (
        <div key={si} className="border border-border rounded-lg p-3 space-y-2">
          {sec.title && (
            <input
              value={trOf(sec.items[0] || { rest: {} }).section || ""}
              onChange={(e) => setTr(si, null, { section: e.target.value })}
              placeholder={sec.title}
              aria-label={t("app.checklists.sectionTitle")}
              className={`${inputClass} font-semibold`}
            />
          )}
          {sec.items.map((item, ii) =>
            item.label.trim() ? (
              <div key={ii} className="space-y-1.5">
                <input
                  value={trOf(item).label || ""}
                  onChange={(e) => setTr(si, ii, { label: e.target.value })}
                  placeholder={item.label}
                  className={inputClass}
                />
                {HAS_OPTIONS.has(item.type) && (
                  // Committed on blur: split on every keystroke would eat the
                  // comma being typed. Keyed by language so switching tabs
                  // shows that language's options, not the last one typed.
                  <input
                    key={`${lang}-${si}-${ii}`}
                    defaultValue={(trOf(item).options || []).join(", ")}
                    onBlur={(e) => setTr(si, ii, { options: splitOptions(e.target.value) })}
                    placeholder={item.options}
                    className={inputClass}
                  />
                )}
              </div>
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
}
