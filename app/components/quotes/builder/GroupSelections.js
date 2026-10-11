// app/components/quotes/builder/GroupSelections.js
//
// "Colours & materials" on one quote service: as many rows as the work has —
// "Uppers: Chantilly Lace OC-65, satin, 2 coats", "Island: Hale Navy" — for
// any trade, saved on the group (QuoteScopeGroup.selections) and copied onto
// the job when the quote is accepted.
//
// ── Additive to the cabinet fields, never instead of them ──────────────────
//
// A cabinet group already has ONE Colour / Sheen / Door style (the unit
// pricing card, UnitPricingFields.js), saved in the base line's meta and
// printed on the work order. Those boxes stay exactly where they are and keep
// saving exactly as they did. When they hold anything they are shown HERE as
// the first row, read-only, with a note saying where they are edited — one
// place to change each value, so the two can never disagree. On a saved group
// the meta is not editable at all (its lines are the priced quote), and the
// first row says so.
//
// Not money and not on the client's document (the client view waits on an
// owner decision, 2026-10-10). No swatch photo here: a swatch is taken on site
// against the real door, on the job.
"use client";

import { ArrowDown, ArrowUp, Palette, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import SelectionFields, { coatsTextFor } from "@/app/components/selections/SelectionFields";
import {
  formatSelectionLine,
  legacyFinishRow,
  newQuoteSelectionRow,
  templateKeyForTrade,
  MAX_SELECTIONS_PER_GROUP,
} from "@/lib/jobs/selections";

export default function GroupSelections({ group, readOnly = false, onChange }) {
  const { t } = useTranslation();
  if (!group) return null;
  const rows = Array.isArray(group.selections) ? group.selections : [];
  const templateKey = templateKeyForTrade(group.categoryKey);
  const coatsText = coatsTextFor(t);
  const legacy = legacyFinishRow(group, {
    doorStyleText: (v) => t("app.workOrder.fact.doorStyle", "Door style: {v}", { v }),
  });

  if (readOnly && !legacy && !rows.length) return null;

  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...rows, newQuoteSelectionRow()]);

  return (
    <div className="rounded-lg border border-border p-3 space-y-2" data-group-selections={group.tempId}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Palette size={14} className="text-muted-foreground" />
          {t("app.selections.title", "Colours & materials")}
        </div>
        {!readOnly && rows.length < MAX_SELECTIONS_PER_GROUP && (
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus size={12} /> {t("app.selections.addRow", "Add a colour or material")}
          </button>
        )}
      </div>
      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          {t("app.selections.quoteHint", "Copied onto the job when the client accepts, for the crew and the work order. Not shown to the client.")}
        </p>
      )}

      {legacy && (
        <div className="rounded border border-dashed border-border px-2 py-1.5 text-sm" data-selection-legacy>
          <div className="text-foreground">{formatSelectionLine(legacy, { coatsText }).line}</div>
          {legacy.notes && <div className="text-xs text-muted-foreground">{legacy.notes}</div>}
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {group.persisted
              ? t("app.selections.legacySaved", "Saved with this service's price line.")
              : t("app.selections.legacyFields", "From the Colour, Sheen and Door style boxes above — edit it there.")}
          </div>
        </div>
      )}

      {rows.map((row, i) =>
        readOnly ? (
          <div key={row.id || i} className="text-sm">
            <div className="text-foreground">{formatSelectionLine(row, { coatsText }).line}</div>
            {row.notes && <div className="text-xs text-muted-foreground">{row.notes}</div>}
          </div>
        ) : (
          <div key={row.id || i} className="rounded border border-border p-2 space-y-1.5">
            <SelectionFields
              value={row}
              onChange={(patch) => set(i, patch)}
              templateKey={templateKey}
              idPrefix={`qsel-${group.tempId}-${row.id || i}`}
              t={t}
            />
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={t("app.selections.moveUp", "Move up")}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={t("app.selections.moveDown", "Move down")}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="inline-flex items-center gap-1 p-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={13} /> {t("app.selections.removeRow", "Remove row")}
              </button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
