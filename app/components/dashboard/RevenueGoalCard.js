"use client";

// app/components/dashboard/RevenueGoalCard.js
//
// The yearly revenue goal, and whether the company is keeping up with it.
//
// ── It leads with pace, not the raw bar ────────────────────────────────────
//
// "$180k of $500k" is meaningless without the date — 36% is triumphant in
// April and a disaster in November. So the headline is ahead/behind pace in
// dollars, and the bar carries a second marker for "where you should be by
// now", not just a fill creeping toward the year-end number.
//
// ── Setting the goal lives here ────────────────────────────────────────────
//
// No goal set → the card IS the prompt to set one, rather than a separate
// buried setting. Owners/admins get the input; everyone else sees progress.

import { useState } from "react";
import { Target, Loader2, Check, Pencil } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

const money = (n) =>
  `$${Math.round(Number(n) || 0).toLocaleString()}`;
const short = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
};

export default function RevenueGoalCard({ goal, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(goal?.targets?.annual ? String(goal.targets.annual) : "");
  const [saving, setSaving] = useState(false);

  async function save(annual) {
    setSaving(true);
    try {
      const res = await fetch("/api/analytics/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annual }),
      });
      if (!res.ok) {
        await reportResponseError(res, "Couldn't save the goal.");
        return;
      }
      setEditing(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  // ── No goal yet ──────────────────────────────────────────────────────────
  if (!goal) {
    if (!canEdit) return null; // nothing to show a non-admin, and no dead prompt
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
          <Target size={16} /> Revenue goal
        </div>
        {editing ? (
          <GoalInput value={value} setValue={setValue} saving={saving} onSave={() => save(value)} />
        ) : (
          <div>
            <p className="text-sm text-foreground">
              Set a target for the year and the dashboard will track your pace toward it.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold"
            >
              <Target size={14} /> Set a revenue goal
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── With a goal ──────────────────────────────────────────────────────────
  const pctOfGoal = Math.min(100, Math.max(0, goal.percentOfGoal * 100));
  const pacePct = Math.min(100, Math.max(0, goal.fractionOfYearElapsed * 100));
  const behind = goal.aheadBy < 0;
  const paceColor = goal.onPace
    ? "text-emerald-600 dark:text-emerald-400"
    : behind
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Target size={16} /> Revenue goal · {money(goal.targets.annual)}/yr
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => { setValue(String(goal.targets.annual)); setEditing(true); }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Change goal"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <GoalInput value={value} setValue={setValue} saving={saving} onSave={() => save(value)} allowClear onClear={() => save("")} />
      ) : (
        <>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground">{money(goal.revenueYtd)}</span>
            <span className="text-sm text-muted-foreground">this year</span>
          </div>

          <p className={`text-sm font-medium mt-1 ${paceColor}`}>
            {goal.onPace
              ? "On pace"
              : behind
                ? `${money(-goal.aheadBy)} behind pace`
                : `${money(goal.aheadBy)} ahead of pace`}
          </p>

          {/* The bar carries TWO facts: the fill is progress to goal, and the
              tick is where a steady pace would have you by today. A fill short
              of the tick is behind; past it, ahead. */}
          <div className="relative mt-3 h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${behind && !goal.onPace ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${pctOfGoal}%` }}
            />
          </div>
          <div className="relative h-3">
            {/* "you should be here by now" marker, positioned by fraction of year */}
            <div
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${pacePct}%` }}
            >
              <div className="w-px h-2 bg-foreground/40" />
            </div>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(goal.percentOfGoal * 100)}% of goal</span>
            <span>
              {money(goal.targets.monthly)}/mo · projecting {short(goal.projectedYearEnd)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function GoalInput({ value, setValue, saving, onSave, allowClear, onClear }) {
  return (
    <div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-muted-foreground">$</span>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="500000"
          autoFocus
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
        />
        <span className="text-sm text-muted-foreground">/ year</span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
        </button>
        {allowClear && (
          <button
            type="button"
            disabled={saving}
            onClick={onClear}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          >
            Clear goal
          </button>
        )}
      </div>
      {value && Number(value) > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          That's about {money(Number(value) / 12)}/month, {money(Number(value) / 52)}/week.
        </p>
      )}
    </div>
  );
}
