// app/components/jobs/VisitChecklist.js
//
// A visit's checklist: grouped by phase, and actually tickable.
//
// ── What was here before ───────────────────────────────────────────────────
//
// The job page rendered `checklistItems` as a static list with a tick icon
// that never changed. `done` was in the schema, the visit PATCH route accepted
// it, and no surface in the app could set it — so a crew could read the list
// and had no way to work through it. That's the dead-control failure in its
// quietest form: it looks finished because the icons are there.
//
// ── Applying a template is a choice, never a default ───────────────────────
//
// Nothing here stamps a checklist onto a visit on its own, and the seeded
// per-trade library is offered under a heading that says where it came from.
// A company that hasn't chosen a process hasn't stated one; putting eight
// invented steps on a real work order under their name would be inventing it
// for them.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, ClipboardList, Loader2, Plus, X } from "lucide-react";
import {
  groupChecklistByPhase,
  normalizeChecklistItems,
  PHASE_LABELS,
} from "@/lib/jobs/checklistItems";
import { reportResponseError, showError } from "@/lib/clientErrors";

// Cheap structural compare, enough to answer "has the server caught up with
// what we drew optimistically?". Label/phase/done is the whole item.
function sameItems(a, b) {
  if (a.length !== b.length) return false;
  return a.every(
    (item, i) =>
      item.label === b[i].label &&
      item.done === b[i].done &&
      item.phase === b[i].phase,
  );
}

export default function VisitChecklist({ jobId, visit, onChanged }) {
  const serverItems = useMemo(
    () => normalizeChecklistItems(visit.checklistItems, { keepDone: true }),
    [visit.checklistItems],
  );

  // Optimistic overlay so a tick lands instantly on a phone in a driveway.
  //
  // Held rather than copied into state on every prop change: the naive
  // "mirror the prop in an effect" version cascades a render on each parent
  // reload, and clearing it the moment the PATCH resolves makes the tick flick
  // back to its old position until the parent's refetch lands. Instead it
  // simply stops being used once the server agrees, and is dropped outright on
  // failure — so the screen never shows a state the database doesn't hold.
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const items = pending && !sameItems(pending, serverItems) ? pending : serverItems;

  const save = useCallback(
    async (next) => {
      setPending(next);
      setSaving(true);
      try {
        const res = await fetch(`/api/jobs/${jobId}/visits/${visit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistItems: next }),
        });
        if (!res.ok) {
          setPending(null);
          await reportResponseError(res, "Couldn't save the checklist.");
          return false;
        }
        // Refresh the parent so the "3/8 checklist items" summary above agrees
        // with what's ticked below.
        onChanged?.();
        return true;
      } catch {
        setPending(null);
        showError("Couldn't save the checklist. Check your connection.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [jobId, visit.id, onChanged],
  );

  function toggle(index) {
    save(
      items.map((item, i) => (i === index ? { ...item, done: !item.done } : item)),
    );
  }

  async function applyTemplate(template) {
    const added = normalizeChecklistItems(template.items, {
      phase: template.phase,
    });
    // Appended, not replaced. A visit often needs two lists — the trade's and
    // the company's own — and replacing would silently drop whatever the crew
    // had already ticked.
    const existing = new Set(items.map((i) => i.label.toLowerCase()));
    const merged = [
      ...items,
      ...added.filter((item) => !existing.has(item.label.toLowerCase())),
    ];
    const ok = await save(merged);
    if (ok) setPicking(false);
  }

  const groups = groupChecklistByPhase(items);

  return (
    <div className="mt-3">
      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No checklist on this visit.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const done = group.items.filter((i) => i.done).length;
            return (
              <div key={group.phase}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  {group.label}
                  <span className="font-normal tabular-nums">
                    {done}/{group.items.length}
                  </span>
                </div>
                <ul className="mt-1 space-y-1">
                  {group.items.map((item) => (
                    <li key={item.index}>
                      <button
                        onClick={() => toggle(item.index)}
                        disabled={saving}
                        className="flex items-start gap-2 text-sm text-left w-full disabled:opacity-60"
                      >
                        {item.done ? (
                          <CheckCircle2
                            size={14}
                            className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                          />
                        ) : (
                          <Circle
                            size={14}
                            className="text-muted-foreground shrink-0 mt-0.5"
                          />
                        )}
                        <span
                          className={
                            item.done
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }
                        >
                          {item.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setPicking((v) => !v)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {picking ? <X size={12} /> : <Plus size={12} />}
        {picking ? "Cancel" : "Add a checklist"}
      </button>

      {picking && (
        <ChecklistPicker
          onPick={applyTemplate}
          busy={saving}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

// The picker loads templates on open, not with the page — a job with six
// visits would otherwise fetch the same list six times to render six buttons
// nobody pressed.
function ChecklistPicker({ onPick, busy, onClose }) {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/checklists?includeSystem=1");
        if (!res.ok) {
          await reportResponseError(res, "Couldn't load your checklists.");
          if (!cancelled) setTemplates([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setTemplates(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setError("Couldn't load your checklists. Check your connection.");
          setTemplates([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (templates === null) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" /> Loading checklists…
      </div>
    );
  }

  const own = templates.filter((tpl) => !tpl.isSystem);
  const suggested = templates.filter((tpl) => tpl.isSystem);

  if (own.length === 0 && suggested.length === 0) {
    return (
      <div className="mt-2 border border-border rounded-lg p-4 text-center">
        <ClipboardList size={22} className="text-muted-foreground mx-auto" />
        <p className="text-xs text-muted-foreground mt-2">
          {error ||
            "No checklists yet. Write one under Settings → Checklists, or switch on the services you offer to see the starter lists for your trades."}
        </p>
        <button
          onClick={onClose}
          className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 border border-border rounded-lg p-3 space-y-3 max-h-80 overflow-y-auto">
      {own.length > 0 && (
        <PickerGroup heading="Your checklists" templates={own} onPick={onPick} busy={busy} />
      )}
      {suggested.length > 0 && (
        <PickerGroup
          heading="Starter lists for your trades"
          note="Suggestions — nothing is added until you pick one."
          templates={suggested}
          onPick={onPick}
          busy={busy}
        />
      )}
    </div>
  );
}

function PickerGroup({ heading, note, templates, onPick, busy }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      <div className="mt-1.5 space-y-1">
        {templates.map((tpl) => {
          const count = Array.isArray(tpl.items) ? tpl.items.length : 0;
          return (
            <button
              key={tpl.id}
              onClick={() => onPick(tpl)}
              disabled={busy}
              className="w-full text-left border border-border rounded-lg px-3 py-2 hover:bg-muted disabled:opacity-60"
            >
              <div className="text-sm font-medium text-foreground">{tpl.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {PHASE_LABELS[tpl.phase] || PHASE_LABELS.during} · {count} step
                {count === 1 ? "" : "s"}
                {tpl.category?.label && ` · ${tpl.category.label}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
