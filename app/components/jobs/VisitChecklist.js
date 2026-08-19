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
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  groupChecklistByPhase,
  groupChecklistBySection,
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
                <ChecklistItems
                  items={group.items}
                  onToggle={toggle}
                  disabled={saving}
                />
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
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Debounced so typing "concrete" is one request, not eight. 250ms is short
  // enough that the list feels live and long enough to skip the intermediate
  // words nobody meant to search for.
  useEffect(() => {
    let cancelled = false;
    const term = query.trim();

    const run = async () => {
      if (term) setSearching(true);
      try {
        const url = `/api/settings/checklists?includeSystem=1${
          term ? `&q=${encodeURIComponent(term)}` : ""
        }`;
        const res = await fetch(url);
        if (!res.ok) {
          await reportResponseError(res, "Couldn't load your checklists.");
          if (!cancelled) setTemplates([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setTemplates(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't load your checklists. Check your connection.");
          setTemplates([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    const timer = setTimeout(run, term ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const searchBox = (
    <div className="relative">
      <Search
        size={13}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search all checklists — rebar, welding, drywall…"
        className="w-full pl-8 pr-8 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {searching && (
        <Loader2
          size={13}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
        />
      )}
    </div>
  );

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
      <div className="mt-2 border border-border rounded-lg p-3 space-y-2">
        {searchBox}
        <div className="text-center py-3">
          <ClipboardList size={22} className="text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">
            {error ||
              (query.trim()
                ? `Nothing matches “${query.trim()}”.`
                : "No checklists yet. Write one under Settings → Checklists, or switch on the services you offer to see the starter lists for your trades.")}
          </p>
          <button
            onClick={onClose}
            className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 border border-border rounded-lg p-3 space-y-3 max-h-80 overflow-y-auto">
      {searchBox}
      {own.length > 0 && (
        <PickerGroup heading="Your checklists" templates={own} onPick={onPick} busy={busy} />
      )}
      {suggested.length > 0 && (
        <PickerGroup
          // The heading changes with the query because the SET changes: with no
          // search these are the trades the company switched on, and with one
          // they are the whole library. Leaving it as "your trades" while
          // showing a masonry list to a painter would misdescribe the results.
          heading={
            query.trim() ? "From the checklist library" : "Starter lists for your trades"
          }
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
              {/* The standards a list is written to, when it states any. Two
                  concrete checklists can look identical by name; "ACI · ASTM"
                  under one and nothing under the other is the fastest way to
                  tell an inspection regime from a work list. */}
              {Array.isArray(tpl.meta?.standards) && tpl.meta.standards.length > 0 && (
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {tpl.meta.standards.slice(0, 4).join(" · ")}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


// One phase's items, grouped by the section they came from.
//
// ── Why sections are rendered rather than flattened ────────────────────────
//
// A residential trade list has no sections and renders exactly as it did
// before: a flat run of tickable lines. A construction inspection carries 5-9
// named sections ("Surface Preparation" before "Finish Coat Application"), and
// the order is the order the work happens in. Flattening 33 items into one
// undifferentiated column loses the only structure that makes a long list
// workable on a phone.
function ChecklistItems({ items, onToggle, disabled }) {
  const sections = groupChecklistBySection(items);

  return (
    <div className="mt-1 space-y-2">
      {sections.map((section, i) => (
        <div key={section.section || `unsectioned-${i}`}>
          {section.section && (
            <div className="text-[11px] font-medium text-muted-foreground/80 mt-1.5">
              {section.section}
            </div>
          )}
          <ul className="mt-1 space-y-1.5">
            {section.items.map((item) => (
              <ChecklistRow
                key={item.index}
                item={item}
                onToggle={onToggle}
                disabled={disabled}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Format the tolerance an item is measured against, e.g. "92–97 %Gmm".
 *
 * Returns null when there is nothing to state. An open-ended range prints as
 * "95 %+" or "up to 40 mils" rather than inventing the missing end — "95–null"
 * is not a tolerance anybody can work to.
 */
function formatRange({ expectedMin, expectedMax, unit }) {
  const u = unit ? ` ${unit}` : "";
  if (expectedMin != null && expectedMax != null)
    return `${expectedMin}–${expectedMax}${u}`;
  if (expectedMin != null) return `${expectedMin}${u} or more`;
  if (expectedMax != null) return `up to ${expectedMax}${u}`;
  return unit || null;
}

function ChecklistRow({ item, onToggle, disabled }) {
  const range = formatRange(item);

  return (
    <li>
      <button
        onClick={() => onToggle(item.index)}
        disabled={disabled}
        className="flex items-start gap-2 text-sm text-left w-full disabled:opacity-60"
      >
        {item.done ? (
          <CheckCircle2
            size={14}
            className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
          />
        ) : (
          <Circle size={14} className="text-muted-foreground shrink-0 mt-0.5" />
        )}
        <span className="min-w-0">
          <span
            className={
              item.done ? "text-muted-foreground line-through" : "text-foreground"
            }
          >
            {item.label}
          </span>

          {/* The acceptance criterion is the whole value of an inspection item:
              "verify compaction" is not actionable, "95% of maximum dry density
              per ASTM D1557" is. Shown always, not behind a tap — a crew that
              has to open something to learn what passing means will tick
              without opening it. */}
          {item.criteria && (
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              {item.criteria}
            </span>
          )}

          {(item.critical ||
            range ||
            item.reference ||
            item.photoRequired) && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              {item.critical && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={10} /> Hold point
                </span>
              )}
              {range && (
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground border border-border rounded px-1 py-px">
                  {range}
                </span>
              )}
              {/* Informational only, and deliberately not a gate yet: there is
                  no per-item photo control on this screen, so refusing to
                  accept a tick without one would be a lock with no key. The
                  gate lands with the control, in checklistItemStatus(). */}
              {item.photoRequired && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Camera size={10} /> Photo expected
                </span>
              )}
              {item.reference && (
                <span className="text-[10px] text-muted-foreground/70">
                  {item.reference}
                </span>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
