"use client";

// app/components/dashboard/CrewMyDay.js
//
// "My day" — what a crew member sees on /app (who: isCrewHome in
// lib/dashboard/crewHome.js). Where to be next, when, and how to get there;
// today and the rest of the week; the clock; each visit's photos and
// checklist. No money and no company numbers: the payload is built from a
// whitelist on the server (shapeMyDay), and this file reads nothing that
// could carry either — scripts/check-dashboard-home.mjs holds it to that.
//
// The heavy lifting stays where it already lives: the clock is /app/clock,
// the fuller week is /app/me/schedule, and a job's photos and checklist are
// on the job page the crew member is already scoped to. This screen links to
// them rather than rebuilding them.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Camera, ClipboardCheck, Clock, MapPin, Navigation } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import { formatTimeOfDay, formatWeekdayDayMonth } from "@/lib/format/localeDate";
import ListState from "@/app/components/ListState";
import { KindChip } from "@/app/components/me/bits";
import { CARD, CARD_CLIPPED } from "./surface";
import WeekHoursCard from "@/app/components/timeclock/WeekHoursCard";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { clockOffered } from "@/lib/timeclock/access";

function timeRange(item, language) {
  const s = formatTimeOfDay(new Date(item.start), language);
  return item.end ? `${s} – ${formatTimeOfDay(new Date(item.end), language)}` : s;
}

function VisitProgress({ item, t }) {
  if (item.kind !== "visit" || item.checklistTotal == null) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
      <span className="inline-flex items-center gap-1">
        <Camera size={12} aria-hidden="true" />
        {t("app.dash.myDay.photos", "{n} photos", { n: item.photos })}
      </span>
      {item.checklistTotal > 0 && (
        <span className="inline-flex items-center gap-1">
          <ClipboardCheck size={12} aria-hidden="true" />
          {t("app.dash.myDay.checklist", "{done} of {total} checklist items", { done: item.checklistDone, total: item.checklistTotal })}
        </span>
      )}
    </p>
  );
}

function Row({ item, t, language, showDay = false }) {
  return (
    <li className="flex items-start gap-3 px-4 sm:px-5 py-3">
      <div className="w-20 shrink-0 text-xs font-semibold text-foreground tabular-nums">
        {showDay && <div className="text-muted-foreground font-normal">{formatWeekdayDayMonth(new Date(item.start), language)}</div>}
        {timeRange(item, language)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <KindChip kind={item.kind} t={t} />
          <span className="truncate text-sm font-semibold text-foreground">{item.title || item.subtitle || t(`app.me.kind.${item.kind}`)}</span>
        </div>
        {item.address && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.address}</p>}
        <VisitProgress item={item} t={t} />
      </div>
      {item.jobHref && (
        <Link href={item.jobHref} className="shrink-0 inline-flex min-h-10 items-center rounded-full border border-foreground/25 px-3 text-xs font-semibold text-foreground">
          {t("app.dash.myDay.openJob", "Open job")}
        </Link>
      )}
    </li>
  );
}

export default function CrewMyDay() {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  // Switchable per person in Edit access (lib/timeclock/access.js): off, and
  // the clock card and the week card are not offered.
  const clockOn = clockOffered(usePermissions());

  const load = useCallback(async () => {
    const result = await fetchList("/api/dashboard/my-day", { cache: "no-store" });
    if (result.aborted) return;
    if (result.ok) {
      setData(result.data);
      setErrorKey("");
    } else {
      setData(null);
      setErrorKey(result.errorKey);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const next = data?.next || null;
  const clock = data?.clock || null;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.dash.myDay.title", "My day")}</h1>
        {data?.name && <p className="text-sm text-muted-foreground mt-1">{data.name}</p>}
      </div>

      <ListState loading={loading} errorKey={errorKey} onRetry={load} isEmpty={false}>
        {data && (
          <>
            {/* ── Next up ─────────────────────────────────────────────── */}
            <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="myday-next">
              <h2 id="myday-next" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("app.dash.myDay.next", "Next up")}
              </h2>
              {next ? (
                <div className="mt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <KindChip kind={next.kind} t={t} />
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {formatWeekdayDayMonth(new Date(next.start), language)} · {timeRange(next, language)}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-foreground">{next.title || next.subtitle || t(`app.me.kind.${next.kind}`)}</p>
                  {next.subtitle && next.subtitle !== next.title && <p className="text-sm text-muted-foreground">{next.subtitle}</p>}
                  {next.address && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground">
                      <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {next.address}
                    </p>
                  )}
                  <VisitProgress item={next} t={t} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {next.directions && (
                      <a
                        href={next.directions}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-inverted px-5 text-sm font-semibold text-inverted-foreground"
                      >
                        <Navigation size={15} aria-hidden="true" />
                        {t("app.dash.myDay.directions", "Directions")}
                      </a>
                    )}
                    {next.jobHref && (
                      <Link href={next.jobHref} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-foreground/25 px-5 text-sm font-semibold text-foreground">
                        <ClipboardCheck size={15} aria-hidden="true" />
                        {t("app.dash.myDay.photosChecklist", "Photos & checklist")}
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t("app.dash.myDay.nothingNext", "Nothing else on your schedule this week.")}</p>
              )}
            </section>

            {/* ── The clock ───────────────────────────────────────────── */}
            {clockOn && clock?.onRoster && (
              <section className={`${CARD} flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5`}>
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <Clock size={16} aria-hidden="true" />
                  {clock.open
                    ? clock.open.onBreak
                      ? t("app.dash.myDay.onBreak", "On a break")
                      : t("app.dash.myDay.clockedIn", "Clocked in since {time}", { time: formatTimeOfDay(new Date(clock.open.since), language) })
                    : t("app.dash.myDay.notClockedIn", "You're not clocked in.")}
                </p>
                <Link href="/app/clock" className="inline-flex min-h-11 items-center rounded-full bg-inverted px-5 text-sm font-semibold text-inverted-foreground">
                  {clock.open ? t("app.me.action.clockOut", "Clock out") : t("app.me.action.clockIn", "Clock in")}
                </Link>
              </section>
            )}

            {/* ── This week's time, and the way to the log ────────────── */}
            {clockOn && clock?.onRoster && <WeekHoursCard t={t} />}

            {/* ── Today ───────────────────────────────────────────────── */}
            <section className={CARD_CLIPPED} aria-labelledby="myday-today">
              <h2 id="myday-today" className="px-4 sm:px-5 py-3 border-b border-foreground/15 font-semibold text-foreground">
                {t("app.dash.myDay.today", "Today")}
              </h2>
              {data.today.length ? (
                <ul className="divide-y divide-foreground/10">
                  {data.today.map((item) => (
                    <Row key={`${item.kind}:${item.id}`} item={item} t={t} language={language} />
                  ))}
                </ul>
              ) : (
                <p className="px-4 sm:px-5 py-5 text-sm text-muted-foreground">{t("app.dash.myDay.nothingToday", "Nothing scheduled for you today.")}</p>
              )}
            </section>

            {/* ── The rest of the week ───────────────────────────────── */}
            <section className={CARD_CLIPPED} aria-labelledby="myday-week">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-foreground/15">
                <h2 id="myday-week" className="font-semibold text-foreground">
                  {t("app.dash.myDay.week", "This week")}
                </h2>
                <Link href="/app/me/schedule" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-foreground underline">
                  <CalendarDays size={13} aria-hidden="true" />
                  {t("app.me.seeSchedule", "See schedule")}
                </Link>
              </div>
              {data.week.length ? (
                <ul className="divide-y divide-foreground/10">
                  {data.week.map((item) => (
                    <Row key={`${item.kind}:${item.id}`} item={item} t={t} language={language} showDay />
                  ))}
                </ul>
              ) : (
                <p className="px-4 sm:px-5 py-5 text-sm text-muted-foreground">{t("app.dash.myDay.nothingWeek", "Nothing else scheduled for you in the next seven days.")}</p>
              )}
            </section>
          </>
        )}
      </ListState>
    </div>
  );
}
