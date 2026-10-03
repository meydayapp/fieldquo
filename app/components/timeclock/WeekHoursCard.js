"use client";

// app/components/timeclock/WeekHoursCard.js
//
// "This week" on a crew member's home: time on the clock since the
// company's week began, the paid part beside it when the two differ, and the
// way into the Time log. Hours only, never money — it sits on My day, whose
// payload is held to no money (lib/dashboard/crewHome.js), and it adds none.
//
// Its own read (GET /api/time-clock/week) so a failure here never costs the
// rest of the home, and so nothing is drawn rather than a zero when the
// figure is not known: a failed load, or a login with no Worker row behind
// it, renders no card — "0 h this week" would be a statement about a week
// nobody measured.
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { fmtDuration } from "./activityUi";

export default function WeekHoursCard({ t, className = "" }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    fetchList("/api/time-clock/week").then((result) => {
      if (live && result.ok && !result.aborted) setData(result.data);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!data?.hasWorker || !Number.isFinite(data.trackedMs) || !Number.isFinite(data.hours)) return null;
  const paidMs = Math.round(data.hours * 3_600_000);
  // Differs by more than the two-decimal rounding of `hours` — i.e. an
  // unpaid break or activity is in the week.
  const showPaid = Math.abs(paidMs - data.trackedMs) > 60_000;
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <CalendarClock size={13} />
            {t("app.clock.week.title")}
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">{fmtDuration(data.trackedMs, t)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {t("app.clock.week.onClock")}
            {showPaid ? ` · ${t("app.clock.week.paid", { hours: data.hours.toFixed(2) })}` : ""}
          </div>
        </div>
        <Link
          href="/app/clock?tab=log"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-foreground/25 px-4 text-sm font-semibold text-foreground"
        >
          {t("app.clock.week.view")}
        </Link>
      </div>
    </section>
  );
}
