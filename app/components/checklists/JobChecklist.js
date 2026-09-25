// app/components/checklists/JobChecklist.js
//
// The job's own checklists (Job.checklistItems) drawn as forms — one card per
// list, its sections in order, each item answered with the control its type
// asks for. The crew fills it on the phone; the office sees the same form
// with the answers as they stand ("Refresh" re-reads them), and can switch to
// filling it in when the person doing the work is at the desk.
//
// Every string an item carries is read in the VIEWER's language
// (localizeItem): the copy on the job holds all of them, so the painter reads
// Punjabi and the office reads English off the same row.
//
// Distinct from VisitChecklist.js, which is a visit's list grouped by phase.
// Both write the same item shape through the same normaliser.
"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Circle, ClipboardList, Loader2, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { normalizeChecklistItems } from "@/lib/jobs/checklistItems";
import {
  groupByChecklist,
  isAnswered,
  itemsFromTemplate,
  localizeItem,
} from "@/lib/checklists/typedItems";
import ChecklistItemControl, { TYPED_RESPONSES } from "@/app/components/checklists/ChecklistItemControl";
import { ChecklistPicker } from "@/app/components/jobs/VisitChecklist";

export default function JobChecklist({ job, onChanged, readOnlyByDefault = false }) {
  const { t, language } = useTranslation();
  const serverItems = useMemo(
    () => normalizeChecklistItems(job.checklistItems, { keepDone: true }),
    [job.checklistItems],
  );
  // Optimistic copy while a save is in flight — dropped on failure so the
  // screen never shows an answer the database does not hold (the same rule
  // VisitChecklist.js explains at length).
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [filling, setFilling] = useState(!readOnlyByDefault);
  const [refreshing, setRefreshing] = useState(false);

  const items = pending || serverItems;
  const readOnly = !filling;

  const save = useCallback(
    async (next) => {
      setPending(next);
      setSaving(true);
      try {
        const res = await fetch(`/api/jobs/${job.id}/checklist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistItems: next }),
        });
        if (!res.ok) {
          await reportResponseError(res, t("app.checklists.saveError"));
          return false;
        }
        await onChanged?.();
        return true;
      } catch {
        showError(t("app.checklists.saveError"));
        return false;
      } finally {
        setPending(null);
        setSaving(false);
      }
    },
    [job.id, onChanged, t],
  );

  function update(index, next) {
    const { index: _drop, ...clean } = next;
    save(items.map((item, i) => (i === index ? clean : item)));
  }

  async function addTemplate(template) {
    const added = itemsFromTemplate(template, language);
    // One copy of a list per job: a second press of the same list adds only
    // what is not already there, keyed per list so two forms can both end in
    // "Client signature".
    const key = (i) => `${i.templateId || i.checklist || ""}|${i.label.toLowerCase()}`;
    const have = new Set(items.map(key));
    const ok = await save([...items, ...added.filter((i) => !have.has(key(i)))]);
    if (ok) setPicking(false);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await onChanged?.();
    } finally {
      setRefreshing(false);
    }
  }

  const forms = groupByChecklist(items);

  return (
    <div data-job-checklist className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <ClipboardList size={16} className="text-muted-foreground" />
          {t("app.checklists.jobTitle")}
        </h2>
        <div className="flex items-center gap-1.5">
          {items.length > 0 && readOnly && (
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 text-xs font-semibold border border-border rounded-lg hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> {t("app.checklists.refresh")}
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setFilling((v) => !v)}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 text-xs font-semibold border border-border rounded-lg hover:bg-muted"
            >
              {filling ? <CheckCircle2 size={12} /> : <Pencil size={12} />}
              {filling ? t("app.checklists.doneFilling") : t("app.checklists.fillIn")}
            </button>
          )}
        </div>
      </div>

      {readOnly && items.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">{t("app.checklists.readOnlyNote")}</p>
      )}

      {forms.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-2">{t("app.checklists.jobEmpty")}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {forms.map((form) => {
            const all = form.sections.flatMap((s) => s.items);
            const title = localizeItem(all[0], language).checklist;
            const left = all.filter((i) => i.required && !isAnswered(i)).length;
            const done = all.filter((i) => isAnswered(i)).length;
            return (
              <section key={form.templateId || form.checklist || "list"} className="border border-border rounded-lg">
                <header className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 flex-wrap bg-muted/40 rounded-t-lg">
                  <span className="font-semibold text-sm text-foreground">{title || t("app.checklists.jobTitle")}</span>
                  <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-2">
                    {done}/{all.length}
                    {left > 0 ? (
                      <span className="text-red-700 dark:text-red-400 font-semibold">
                        {t("app.checklists.requiredLeft", { count: left })}
                      </span>
                    ) : all.some((i) => i.required) ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        {t("app.checklists.allRequiredDone")}
                      </span>
                    ) : null}
                  </span>
                </header>
                <div className="p-3 space-y-3">
                  {form.sections.map((section, si) => (
                    <div key={section.section || `s${si}`}>
                      {section.section && (
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                          {localizeItem(section.items[0], language).section || section.section}
                        </div>
                      )}
                      <ul className="space-y-2.5">
                        {section.items.map((item) => (
                          <JobChecklistRow
                            key={item.index}
                            item={item}
                            readOnly={readOnly}
                            disabled={saving}
                            onAnswer={(next) => update(item.index, next)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!readOnly || items.length === 0 ? (
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {picking ? <X size={12} /> : <Plus size={12} />}
          {picking ? t("app.action.cancel") : t("app.checklists.add")}
        </button>
      ) : null}
      {saving && <Loader2 size={12} className="inline ml-2 animate-spin text-muted-foreground" />}
      {picking && <ChecklistPicker onPick={addTemplate} busy={saving} onClose={() => setPicking(false)} />}
    </div>
  );
}

function JobChecklistRow({ item, readOnly, disabled, onAnswer }) {
  const { t, language } = useTranslation();
  const label = localizeItem(item, language).label || item.label;
  const answered = isAnswered(item);
  const typed = TYPED_RESPONSES.includes(item.responseType);
  const mark = answered ? (
    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
  ) : (
    <Circle size={16} className="text-muted-foreground shrink-0 mt-0.5" />
  );
  const requiredFlag = item.required && !answered && (
    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
      {t("app.checklists.required")}
    </span>
  );

  if (!typed) {
    // A tick: the whole row is the control when filling, a status when not.
    return (
      <li>
        <button
          type="button"
          disabled={readOnly || disabled}
          onClick={() => onAnswer({ ...item, done: !item.done })}
          className="flex items-start gap-2 text-sm text-left w-full min-h-[32px] disabled:cursor-default"
        >
          {mark}
          <span className="min-w-0 text-foreground">
            {label}
            {requiredFlag}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li className="text-sm">
      <div className="flex items-start gap-2">
        {mark}
        <span className="min-w-0 text-foreground">
          {label}
          {requiredFlag}
        </span>
      </div>
      <div className="mt-1.5 pl-6">
        <ChecklistItemControl item={item} readOnly={readOnly} disabled={disabled} onAnswer={onAnswer} />
      </div>
    </li>
  );
}
