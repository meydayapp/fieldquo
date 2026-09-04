// app/components/settings/PayCycleCard.js
//
// When the company pays, and for what stretch of work.
//
// ── Why the period end and the payday are two separate controls ─────────────
//
// A company says "we pay every second Thursday", so one control looks like
// enough. It isn't, and lib/payroll/payCycle.js has the reasoning: overtime is
// computed against a WEEKLY threshold, so a pay period has to contain whole
// weeks or somebody's week gets split across two runs and their overtime is
// computed twice, on two partial weeks, and understated both times.
//
// So the period end is the structural choice and the payday is the one the
// company is really making — how many days the office gets to approve hours
// before the money leaves. The card says that gap out loud, because "Sunday to
// Thursday" means nothing until somebody counts it.
"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const selectClass =
  "mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm";

export default function PayCycleCard() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchJson("/api/settings/pay-cycle")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const { cycle, canEdit } = data;
  const weekAligned = data.frequencies.find(
    (f) => f.key === cycle.frequency,
  )?.alignsToWeeks;

  async function save(patch) {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const next = await fetchJson("/api/settings/pay-cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle: { ...cycle, ...patch } }),
      });
      setData(next);
      setSaved(true);
    } catch (err) {
      // Was the failure this codebase gets swept for: a dropdown that changed
      // on screen, saved nothing, and reverted on reload.
      setError(err.message || "That didn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">When you pay</h2>
        {!data.configured && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            not set — using the default below
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{data.describe}</p>

      {canEdit ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            How often
            <select
              value={cycle.frequency}
              disabled={saving}
              onChange={(e) => save({ frequency: e.target.value })}
              className={selectClass}
            >
              {data.frequencies.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          {/* Hidden for calendar cadences rather than shown and ignored: a
              1st-to-15th period does not end on a weekday you get to pick. */}
          {weekAligned && (
            <label className="text-xs text-muted-foreground">
              The period closes
              <select
                value={cycle.periodEndDayOfWeek}
                disabled={saving}
                onChange={(e) =>
                  save({ periodEndDayOfWeek: Number(e.target.value) })
                }
                className={selectClass}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-xs text-muted-foreground">
            Payday
            <select
              value={cycle.payDayOfWeek}
              disabled={saving}
              onChange={(e) => save({ payDayOfWeek: Number(e.target.value) })}
              className={selectClass}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {data.reviewDays} day{data.reviewDays === 1 ? "" : "s"} to approve
              hours
            </span>
          </label>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Set by an owner or admin.
        </p>
      )}

      {/* One day between the period closing and the money leaving is a real
          arrangement and not ours to refuse — but somebody choosing it from a
          dropdown has probably not counted it. */}
      {canEdit && weekAligned && data.reviewDays <= 1 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          That leaves {data.reviewDays}{" "}
          day to approve everyone&apos;s hours
          between the period closing and payday. Workable if your hours are
          approved daily; tight if they are not.
        </p>
      )}

      {!weekAligned && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Calendar periods don&apos;t contain whole weeks, so weekly overtime is
          worked out on the partial weeks inside each period. Every-week or
          every-2-weeks avoids that.
        </p>
      )}

      {data.current && (
        <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">This period</dt>
            <dd className="text-foreground">
              {data.current.start} → {data.current.end}, paid{" "}
              {data.current.payDate}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last one closed</dt>
            <dd className="text-foreground">
              {data.previous.start} → {data.previous.end}, paid{" "}
              {data.previous.payDate}
            </dd>
          </div>
        </dl>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {saved && !error && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          Saved.
        </p>
      )}
    </div>
  );
}
