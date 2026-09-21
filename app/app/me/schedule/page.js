"use client";

// app/app/me/schedule/page.js
//
// The worker's own next two weeks: one card per day, big and plain, for a
// phone in a van. "Tomorrow, 8:00 AM – 4:00 PM", the client and the site,
// who else is on that job, the lunch, the manager's note, and — when the
// shift is today — a Clock in button that goes to the clock (the clock owns
// the punch and its GPS stamp; a second clock-in here would be a second door
// with its own bugs). Add to calendar is a plain download of
// /api/shifts/ics; Request time off goes to /app/time-off.
//
// Data: GET /api/shifts — the worker payload (their own PUBLISHED shifts, and
// `coworkers` / `holidays` from lib/shifts/boardExtras.js). A manager opening
// this sees their OWN shifts too: the route hands them the company's rows
// and their own worker row as `self`, and the page filters. Nothing is
// written from this screen.
//
// Rendered inside app/components/me/MeShell.js — the employee home's five
// tabs, built by another agent; this page is the Schedule tab's content.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarPlus, Clock, Loader2, MapPin, TreePalm } from "lucide-react";
import MeShell from "@/app/components/me/MeShell";
import Avatar, { initialsOf } from "@/app/components/chat/Avatar";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { formatTimeOfDay, formatWeekdayDayMonth } from "@/lib/format/localeDate";
import { localYmd } from "@/lib/shifts/coverage";

const DAYS = 14;

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function MySchedulePage() {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { start, end: addDays(start, DAYS) };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchList(`/api/shifts?from=${range.start.toISOString()}&to=${range.end.toISOString()}`)
      .then((result) => {
        if (cancelled || result.aborted) return;
        if (!result.ok) {
          setData(null);
          setErrorKey(result.errorKey);
        } else {
          setErrorKey("");
          setData(result.data);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  // The worker's own shifts, whichever branch answered. A manager's payload
  // is the whole company; `self` says which rows are theirs. Published only —
  // the worker branch already filters; the manager branch does not.
  const mine = useMemo(() => {
    if (!data) return [];
    const selfId = data.self?.id;
    if (!selfId) return [];
    return (data.shifts || []).filter((s) => s.workerId === selfId && s.published);
  }, [data]);

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(range.start, i)), [range]);
  const byDay = useMemo(() => {
    const map = {};
    for (const s of mine) (map[localYmd(new Date(s.start))] ||= []).push(s);
    for (const k of Object.keys(map)) map[k].sort((a, b) => new Date(a.start) - new Date(b.start));
    return map;
  }, [mine]);
  const holidaysByDay = useMemo(() => {
    const map = {};
    for (const h of data?.holidays || []) (map[h.observed] ||= []).push(h);
    return map;
  }, [data]);

  const todayStr = localYmd(now);
  const tomorrowStr = localYmd(addDays(now, 1));
  const noWorker = data && !data.self;

  return (
    <MeShell title={t("app.mySchedule.title")}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{t("app.mySchedule.subtitle", { days: DAYS })}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {/* A plain link the browser downloads: the route names the file and
            re-downloading replaces the events by UID. */}
        <a
          href="/api/shifts/ics"
          download
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <CalendarPlus size={16} /> {t("app.mySchedule.addToCalendar")}
        </a>
        {/* The download above is one-off; this is the link that keeps itself
            current — appointments, visits and bookings, not shifts. */}
        <Link
          href="/app/settings/my-calendar"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <CalendarPlus size={16} /> {t("app.mySchedule.subscribeLink", "Subscribe to your appointments")}
        </Link>
        <Link
          href="/app/time-off"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <TreePalm size={16} /> {t("app.mySchedule.requestTimeOff")}
        </Link>
      </div>

      {errorKey ? (
        <ListState loading={false} isEmpty={false} errorKey={errorKey} onRetry={() => window.location.reload()}>
          {null}
        </ListState>
      ) : loading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : noWorker ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          {t("app.mySchedule.noWorker")}
        </p>
      ) : (
        <div className="space-y-3">
          {mine.length === 0 && (
            <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              {t("app.mySchedule.empty", { days: DAYS })}
            </p>
          )}
          {days.map((day) => {
            const key = localYmd(day);
            const list = byDay[key] || [];
            const holidays = holidaysByDay[key] || [];
            if (!list.length && !holidays.length) return null;
            const relative =
              key === todayStr ? t("app.mySchedule.today") : key === tomorrowStr ? t("app.mySchedule.tomorrow") : null;
            return (
              <section key={key} className={`rounded-2xl border bg-card p-4 ${key === todayStr ? "border-foreground/40" : "border-border"}`}>
                <h2 className="text-base font-bold text-foreground">
                  {relative ? `${relative}, ` : ""}
                  {formatWeekdayDayMonth(day, language)}
                </h2>
                {holidays.map((h) => (
                  <p key={h.key} className="mt-1 text-xs font-medium text-muted-foreground">
                    {t(`app.holiday.${h.key}`, h.name)} — {t("app.scheduler.statutoryHoliday")}
                  </p>
                ))}
                {list.map((s) => (
                  <ShiftCard
                    key={s.id}
                    shift={s}
                    coworkers={data?.coworkers?.[s.id] || []}
                    isToday={key === todayStr}
                    now={now}
                    language={language}
                    t={t}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">{t("app.scheduler.workerNote")}</p>
    </MeShell>
  );
}

function ShiftCard({ shift, coworkers, isToday, now, language, t }) {
  // The client and the job title on one line, the site on its own line
  // under the pin — not the board's block label, which folds the address in
  // and would print it twice here.
  const label = [shift.job?.client?.name, shift.job?.title].filter(Boolean).join(" · ");
  const site = [shift.job?.siteAddress, shift.job?.siteCity].filter(Boolean).join(", ");
  const ended = new Date(shift.end) < now;
  return (
    <div className="mt-3 first:mt-2">
      <div className="text-2xl font-bold tabular-nums text-foreground">
        {formatTimeOfDay(shift.start, language)} – {formatTimeOfDay(shift.end, language)}
      </div>
      {label && <div className="mt-0.5 text-sm font-semibold text-foreground">{label}</div>}
      {site && (
        <div className="mt-0.5 flex items-start gap-1 text-sm text-muted-foreground">
          <MapPin size={14} className="mt-0.5 shrink-0" />
          <span>{site}</span>
        </div>
      )}
      {shift.breaks?.length > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">
          {shift.breaks
            .map(
              (b) =>
                `${b.kind === "lunch" ? t("app.scheduler.lunch") : t("app.scheduler.break")} ${formatTimeOfDay(b.start, language)}–${formatTimeOfDay(b.end, language)}${b.paid ? ` · ${t("app.scheduler.paidBreak")}` : ""}`,
            )
            .join(" · ")}
        </div>
      )}
      {coworkers.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {coworkers.slice(0, 5).map((name) => (
              <span key={name} title={name} className="rounded-full ring-2 ring-card">
                <Avatar initials={initialsOf(name)} size="sm" tone="them" />
              </span>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {t("app.mySchedule.withNames", { names: coworkers.join(", ") })}
          </span>
        </div>
      )}
      {shift.note && (
        <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm italic text-foreground/90">“{shift.note}”</blockquote>
      )}
      {shift.availabilityOverrideAt && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            {t("app.scheduler.outsideAvailability")}
            {shift.availabilityOverrideBy?.name ? ` · ${shift.availabilityOverrideBy.name}` : ""}
            {shift.availabilityOverrideNote ? ` — ${shift.availabilityOverrideNote}` : ""}
          </span>
        </p>
      )}
      {isToday && !ended && (
        <Link
          href="/app/clock"
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Clock size={16} /> {t("app.mySchedule.clockIn")}
        </Link>
      )}
    </div>
  );
}
