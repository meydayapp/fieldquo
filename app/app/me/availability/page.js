"use client";

// app/app/me/availability/page.js
//
// "My availability": the current week as a grid, desired hours per week,
// the requests and their state, and "Request new availability" — the
// Homebase phone screen: an effective-date row, DAYS AND TIMES Sunday to
// Saturday each with a ⊕ that adds a from–to range, "All day" and
// "Unavailable" shortcuts, Cancel / Submit fixed at the bottom.
//
// One AvailabilitySchedule per person, read by the shift fit AND the
// booking engine — so the heading is honest about what the rows do: a crew
// member edits "Hours you can work"; somebody who can quote edits "Hours
// you can work and be booked for appointments", with the line that clients
// book inside them. Same rows, same request, said by role.
//
// When the company has turned approval off (Company.availabilityNeedsApproval
// false) the form still submits here and is applied on the effective date;
// the screen says no approval is needed rather than pretending one is.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { orderedWeekdayNames, formatCalendarDay } from "@/lib/format/localeDate";
import { reportResponseError } from "@/lib/clientErrors";
import { useBottomDock } from "@/app/hooks/useBottomDock";
import { normaliseDays, weeklyHours } from "@/lib/availability/days";
import MeShell from "@/app/components/me/MeShell";
import { Action, Card, CardTitle, EmptyNote, MeLoad, useMeData } from "@/app/components/me/bits";

const STATUS_TONE = {
  pending: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  approved: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  declined: "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200",
};

function nextMondayIso() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MeAvailabilityPage() {
  const { t, language } = useTranslation();
  const { weekStartsOn } = useCompanyPreferences();
  const { data, errorKey, loading, reload } = useMeData("/api/availability-requests");
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const dayNames = useMemo(() => orderedWeekdayNames(weekStartsOn, language), [weekStartsOn, language]);

  async function decide(id, action) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/availability-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!res.ok) return reportResponseError(res, t("app.me.availability.decideError"));
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <MeShell title={t("app.me.availability.title")}>
      <MeLoad loading={loading} errorKey={errorKey} reload={reload}>
        {data && editing ? (
          <RequestForm data={data} dayNames={dayNames} t={t} language={language} onClose={() => setEditing(false)} onDone={async () => { setEditing(false); await reload(); }} />
        ) : data ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {data.bookable ? t("app.me.availability.introQuoter") : t("app.me.availability.introCrew")}
              {data.bookable ? (
                <>
                  {" "}
                  <Link href="/app/settings/booking-page" className="font-semibold text-foreground underline">{t("app.me.availability.bookingLink")}</Link>
                </>
              ) : null}
            </p>

            {/* ── Current week grid ───────────────────────────────── */}
            <Card>
              <CardTitle action={<span className="text-xs text-muted-foreground tabular-nums">{t("app.me.availability.hoursPerWeek", { n: weeklyHours(data.current).toFixed(1) })}</span>}>
                {data.bookable ? t("app.me.availability.labelQuoter") : t("app.me.availability.labelCrew")}
              </CardTitle>
              <WeekGrid rows={data.current} dayNames={dayNames} t={t} />
            </Card>

            {data.me ? (
              <Action onClick={() => setEditing(true)} className="w-full">
                {t("app.me.availability.requestNew")}
              </Action>
            ) : (
              <EmptyNote>{t("app.me.notOnRoster")}</EmptyNote>
            )}
            {!data.needsApproval ? <p className="text-xs text-muted-foreground">{t("app.me.availability.noApprovalNote")}</p> : null}

            {/* ── My requests ─────────────────────────────────────── */}
            <Card>
              <CardTitle>{t("app.me.availability.yourRequests")}</CardTitle>
              {data.mine.length === 0 ? (
                <EmptyNote>{t("app.me.availability.noRequests")}</EmptyNote>
              ) : (
                <ul className="divide-y divide-border">
                  {data.mine.map((r) => (
                    <li key={r.id} className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-foreground">{t("app.me.availability.effective", { date: formatCalendarDay(r.effectiveFrom, language) })}</div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[r.status]}`}>{t(`app.me.availability.status.${r.status}`)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("app.me.availability.hoursPerWeek", { n: weeklyHours(r.days).toFixed(1) })}
                        {r.desiredHoursPerWeek != null ? ` · ${t("app.me.availability.desiredShort", { n: Number(r.desiredHoursPerWeek) })}` : ""}
                        {r.status === "approved" && !r.appliedAt ? ` · ${t("app.me.availability.appliesOn", { date: formatCalendarDay(r.effectiveFrom, language) })}` : ""}
                        {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                      </div>
                      {r.status === "pending" ? (
                        <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, "withdraw")} className="mt-1 min-h-[36px] text-xs font-semibold text-muted-foreground underline">
                          {t("app.me.requests.withdraw")}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* ── Manager: waiting on you, with the diff ──────────── */}
            {data.manager ? (
              <Card>
                <CardTitle>{t("app.me.manager.availabilityRequests")}</CardTitle>
                {data.approvals.length === 0 ? (
                  <EmptyNote>{t("app.me.requests.noneToApprove")}</EmptyNote>
                ) : (
                  <ul className="space-y-3">
                    {data.approvals.map((r) => (
                      <li key={r.id} className="rounded-xl border border-border p-3">
                        <div className="text-sm font-semibold text-foreground">{r.worker?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("app.me.availability.effective", { date: formatCalendarDay(r.effectiveFrom, language) })} · {t("app.me.availability.hoursPerWeek", { n: r.hours.toFixed(1) })}
                          {r.desiredHoursPerWeek != null ? ` · ${t("app.me.availability.desiredShort", { n: Number(r.desiredHoursPerWeek) })}` : ""}
                        </div>
                        {r.note ? <div className="mt-1 text-xs text-muted-foreground">“{r.note}”</div> : null}
                        <table className="mt-2 w-full text-xs">
                          <tbody>
                            {r.diff.map((d) => (
                              <tr key={d.dayOfWeek} className={d.changed ? "font-semibold text-foreground" : "text-muted-foreground"}>
                                <td className="py-0.5 pr-2">{dayNames.find((n) => n.index === d.dayOfWeek)?.label}</td>
                                <td className="py-0.5 pr-2 tabular-nums">{d.before.join(", ") || "—"}</td>
                                <td className="py-0.5 pr-1">→</td>
                                <td className="py-0.5 tabular-nums">{d.after.join(", ") || t("app.me.availability.unavailable")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 flex gap-2">
                          <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, "approve")} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60">
                            {busyId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t("app.me.action.approve")}
                          </button>
                          <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, "decline")} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl border border-border text-sm font-semibold text-foreground disabled:opacity-60">
                            <X size={14} /> {t("app.me.action.decline")}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : null}
          </div>
        ) : null}
      </MeLoad>
    </MeShell>
  );
}

/** Seven rows × the ranges on each. */
function WeekGrid({ rows, dayNames, t }) {
  return (
    <ul className="divide-y divide-border">
      {dayNames.map(({ label, index }) => {
        const ranges = (rows || []).filter((r) => Number(r.dayOfWeek) === index);
        return (
          <li key={index} className="flex items-center gap-3 py-2">
            <span className="w-24 shrink-0 text-sm font-medium text-foreground">{label}</span>
            <span className="flex flex-wrap gap-1.5">
              {ranges.length === 0 ? (
                <span className="text-sm text-muted-foreground">{t("app.me.availability.unavailable")}</span>
              ) : (
                ranges.map((r, i) => (
                  <span key={i} className="rounded-lg bg-muted px-2 py-1 text-sm tabular-nums text-foreground">
                    {r.startTime === "00:00" && r.endTime === "23:59" ? t("app.me.availability.allDay") : `${r.startTime} – ${r.endTime}`}
                  </span>
                ))
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The request form: the Homebase screen. */
function RequestForm({ data, dayNames, t, language, onClose, onDone }) {
  const dockRef = useBottomDock();
  const [effectiveFrom, setEffectiveFrom] = useState(nextMondayIso());
  const [days, setDays] = useState([]);
  const [desired, setDesired] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Copy from current: the rows they have now, editable.
  function copyCurrent() {
    setDays((data.current || []).map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, timezone: r.timezone })));
  }
  useEffect(() => {
    if (data.current?.length) copyCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byDay = (dow) => days.map((r, i) => ({ ...r, i })).filter((r) => r.dayOfWeek === dow);
  const add = (dow, start = "08:00", end = "16:00") => setDays((d) => [...d, { dayOfWeek: dow, startTime: start, endTime: end }]);
  const allDay = (dow) => setDays((d) => [...d.filter((r) => r.dayOfWeek !== dow), { dayOfWeek: dow, startTime: "00:00", endTime: "23:59" }]);
  const clearDay = (dow) => setDays((d) => d.filter((r) => r.dayOfWeek !== dow));
  const update = (i, patch) => setDays((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => setDays((d) => d.filter((_, j) => j !== i));

  const check = normaliseDays(days);
  const hours = check.ok ? weeklyHours(check.days) : 0;

  async function submit() {
    setError("");
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/availability-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effectiveFrom, days: check.days, desiredHoursPerWeek: desired === "" ? null : Number(desired), note: note.trim() || undefined }),
      });
      if (!res.ok) return reportResponseError(res, t("app.me.availability.sendError"));
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-lg border border-border bg-background px-2 py-2 text-base tabular-nums";

  return (
    <div className="space-y-4">
      <label className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{t("app.me.availability.takesEffect")}</span>
        <input type="date" value={effectiveFrom} onChange={(e) => e.target.value && setEffectiveFrom(e.target.value)} className={input} />
      </label>
      <p className="text-xs text-muted-foreground">{t("app.me.availability.takesEffectNote", { date: formatCalendarDay(effectiveFrom, language) })}</p>

      <Card>
        <CardTitle
          action={
            <button type="button" onClick={copyCurrent} className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-foreground underline">
              <Copy size={13} /> {t("app.me.availability.copyCurrent")}
            </button>
          }
        >
          {t("app.me.availability.daysAndTimes")}
        </CardTitle>
        <ul className="divide-y divide-border">
          {dayNames.map(({ label, index }) => {
            const ranges = byDay(index);
            return (
              <li key={index} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-foreground">{label}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => allDay(index)} className="min-h-[36px] rounded-lg border border-border px-2 text-xs font-semibold text-foreground">
                      {t("app.me.availability.allDay")}
                    </button>
                    <button type="button" onClick={() => clearDay(index)} className="min-h-[36px] rounded-lg border border-border px-2 text-xs font-semibold text-muted-foreground">
                      {t("app.me.availability.unavailable")}
                    </button>
                    <button type="button" onClick={() => add(index)} aria-label={t("app.me.availability.addRange", { day: label })} className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                {ranges.length === 0 ? (
                  <div className="mt-1 text-sm text-muted-foreground">{t("app.me.availability.unavailable")}</div>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {ranges.map((r) => (
                      <li key={r.i} className="flex items-center gap-2">
                        <input type="time" value={r.startTime} onChange={(e) => update(r.i, { startTime: e.target.value })} aria-label={t("app.scheduler.start")} className={`${input} min-w-0 flex-1`} />
                        <span className="text-muted-foreground">–</span>
                        <input type="time" value={r.endTime} onChange={(e) => update(r.i, { endTime: e.target.value })} aria-label={t("app.scheduler.end")} className={`${input} min-w-0 flex-1`} />
                        <button type="button" onClick={() => remove(r.i)} aria-label={t("app.me.availability.removeRange")} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 text-right text-xs text-muted-foreground tabular-nums">{t("app.me.availability.hoursPerWeek", { n: hours.toFixed(1) })}</div>
      </Card>

      <Card>
        <label className="block">
          <span className="text-sm font-semibold text-foreground">{t("app.me.availability.desiredHours")}</span>
          <input type="number" inputMode="decimal" min="0" max="168" step="0.5" value={desired} onChange={(e) => setDesired(e.target.value)} placeholder="40" className={`${input} mt-1 w-full`} />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-semibold text-foreground">{t("app.me.requests.noteOptional")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base" />
        </label>
      </Card>

      {error || (!check.ok && days.length > 0) ? <p className="text-sm text-red-700 dark:text-red-300">{error || check.error}</p> : null}
      <p className="text-xs text-muted-foreground">{data.needsApproval ? t("app.me.availability.needsApprovalNote") : t("app.me.availability.noApprovalNote")}</p>

      {/* Fixed at the bottom, above the tab bar; the dock hook reserves the space. */}
      <div ref={dockRef} className="fixed inset-x-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur" style={{ bottom: "var(--fq-tab-bar-height)" }}>
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 lg:max-w-2xl">
          <Action variant="secondary" onClick={onClose}>{t("app.action.cancel")}</Action>
          <Action onClick={submit} disabled={busy || !check.ok}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : null} {t("app.me.availability.submit")}
          </Action>
        </div>
      </div>
    </div>
  );
}
