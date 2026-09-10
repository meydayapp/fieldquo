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
//
// ── Everything on this card is written here, not on the server ─────────────
//
// GET /api/settings/pay-cycle returns `describe` and `frequencies[].label` as
// finished English sentences, and this card printed them. On a Spanish account
// that produced the report that started this work: a Spanish heading over
// "Every 2 weeks. The period closes Sunday and everyone is paid the Thursday
// after — 4 days to approve hours."
//
// The route still returns those fields — other callers and the API's own
// consumers may use them, and removing a field from a public shape is not this
// change's business — but the CARD builds the sentence from the structured
// values beside them (frequency, the two weekday numbers, reviewDays). One key
// holds the whole sentence; the weekday names come from Intl; the day count
// goes through CLDR plural rules. Nothing here is assembled out of English
// word order.
"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  formatCalendarDay,
  orderedWeekdayNames,
  weekdayNames,
} from "@/lib/format/localeDate";

const selectClass =
  "mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm";

export default function PayCycleCard() {
  const { t, language } = useTranslation();
  // Two lists of the same seven words, on purpose. The explainer puts the day
  // inside a sentence ("El periodo cierra el domingo"), where Spanish, French
  // and Italian want CLDR's lowercase form; the <option>s are labels and want
  // the capital. See lib/format/localeDate.js.
  const days = weekdayNames(language);
  const dayLabels = orderedWeekdayNames(0, language).map((d) => d.label);
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
      setError(err.message || t("app.payroll.cycle.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.payroll.cycle.title")}
        </h2>
        {!data.configured && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            {t("app.payroll.cycle.notSet")}
            {/* "using the default below" named a place and pointed at nothing.
                The controls ARE below — for someone who may edit them — so the
                link focuses the first one rather than navigating anywhere. For
                someone who may not, there is no link, because there is nothing
                for them to do; the "Set by an owner or admin." line below says
                who can. */}
            {canEdit && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("pay-cycle-frequency")?.focus()
                  }
                  className="font-semibold underline"
                >
                  {t("app.payroll.cycle.setItUp")}
                </button>
              </>
            )}
          </span>
        )}
      </div>

      {/* Built here rather than printed from data.describe — see the note at
          the top of this file. */}
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          weekAligned
            ? "app.payroll.cycle.describeWeekAligned"
            : "app.payroll.cycle.describeCalendar",
          {
            frequency: t(`app.payroll.cycle.frequency.${cycle.frequency}`),
            closeDay: days[cycle.periodEndDayOfWeek],
            payDay: days[cycle.payDayOfWeek],
            days: data.reviewDays,
          },
        )}
      </p>

      {canEdit ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            {t("app.payroll.cycle.howOften")}
            <select
              id="pay-cycle-frequency"
              value={cycle.frequency}
              disabled={saving}
              onChange={(e) => save({ frequency: e.target.value })}
              className={selectClass}
            >
              {data.frequencies.map((f) => (
                <option key={f.key} value={f.key}>
                  {t(`app.payroll.cycle.frequency.${f.key}`, f.label)}
                </option>
              ))}
            </select>
          </label>

          {/* Hidden for calendar cadences rather than shown and ignored: a
              1st-to-15th period does not end on a weekday you get to pick. */}
          {weekAligned && (
            <label className="text-xs text-muted-foreground">
              {t("app.payroll.cycle.periodCloses")}
              <select
                value={cycle.periodEndDayOfWeek}
                disabled={saving}
                onChange={(e) =>
                  save({ periodEndDayOfWeek: Number(e.target.value) })
                }
                className={selectClass}
              >
                {dayLabels.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-xs text-muted-foreground">
            {t("app.payroll.cycle.payday")}
            <select
              value={cycle.payDayOfWeek}
              disabled={saving}
              onChange={(e) => save({ payDayOfWeek: Number(e.target.value) })}
              className={selectClass}
            >
              {dayLabels.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
            {/* `day{n === 1 ? "" : "s"}` is an English plural rule spelled out
                in JSX. Ukrainian has three forms; the key asks CLDR. */}
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {t("app.payroll.cycle.reviewDays", { days: data.reviewDays })}
            </span>
          </label>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("app.payroll.cycle.setByOwner")}
        </p>
      )}

      {/* One day between the period closing and the money leaving is a real
          arrangement and not ours to refuse — but somebody choosing it from a
          dropdown has probably not counted it. */}
      {canEdit && weekAligned && data.reviewDays <= 1 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {t("app.payroll.cycle.tightGap", { days: data.reviewDays })}
        </p>
      )}

      {!weekAligned && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {t("app.payroll.cycle.calendarOvertime")}
        </p>
      )}

      {data.current && (
        <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-2">
          {/* These arrive as ISO calendar days ("2026-09-06") and were
              printed raw. formatCalendarDay pins UTC — a period boundary is a
              calendar day, and a browser west of Greenwich renders midnight
              UTC as the day before. */}
          <div>
            <dt className="text-muted-foreground">
              {t("app.payroll.cycle.thisPeriod")}
            </dt>
            <dd className="text-foreground">
              {t("app.payroll.cycle.periodRange", {
                start: formatCalendarDay(data.current.start, language),
                end: formatCalendarDay(data.current.end, language),
                payDate: formatCalendarDay(data.current.payDate, language),
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("app.payroll.cycle.lastClosed")}
            </dt>
            <dd className="text-foreground">
              {t("app.payroll.cycle.periodRange", {
                start: formatCalendarDay(data.previous.start, language),
                end: formatCalendarDay(data.previous.end, language),
                payDate: formatCalendarDay(data.previous.payDate, language),
              })}
            </dd>
          </div>
        </dl>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {saved && !error && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          {t("app.payroll.cycle.saved")}
        </p>
      )}
    </div>
  );
}
