"use client";

// app/app/clock/page.js
//
// The time clock — the one screen an hourly worker touches every shift. Kept
// deliberately spare: a big live clock, one primary action, today's total.
// Everything writes plain TimeEntry rows through /api/time-clock, which resolves
// the worker from the session, so this is pure record-keeping — no pay maths,
// no money movement.

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, LogIn, LogOut, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";

function fmtClock(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TimeClockPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const tick = useRef(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/time-clock");
    if (!res.ok) {
      await reportResponseError(res, t("app.clock.loadError", "Couldn't load the time clock."));
      return;
    }
    setData(await res.json());
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // One-second heartbeat drives both the wall clock and the elapsed timer.
  useEffect(() => {
    tick.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick.current);
  }, []);

  async function punch(action) {
    setBusy(true);
    try {
      const res = await fetch("/api/time-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.clock.punchError", "Couldn't record that."));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not linked to a worker record — say so plainly instead of a dead button.
  if (data && data.worker === null) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <Clock className="mx-auto mb-3 text-muted-foreground" size={28} />
          <h1 className="text-lg font-bold text-foreground">{t("app.clock.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("app.clock.notWorker")}</p>
        </div>
      </div>
    );
  }

  const open = data?.open;
  const clockedIn = Boolean(open);
  const elapsedMs = open ? now.getTime() - new Date(open.clockIn).getTime() : 0;
  const liveToday = clockedIn
    ? Math.round(((data.todayHours || 0) + 0) * 100) / 100
    : data?.todayHours || 0;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{t("app.clock.title")}</h1>
      </div>

      {/* The clock face */}
      <div className="rounded-2xl border border-border bg-card p-6 text-center overflow-hidden">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-foreground">{fmtClock(now)}</div>

        {clockedIn ? (
          <div className="mt-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {t("app.clock.onTheClock")}
            </div>
            <div className="mt-3 text-5xl font-bold tabular-nums text-foreground">{fmtElapsed(elapsedMs)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("app.clock.since", { time: fmtTime(open.clockIn) })}
            </div>
          </div>
        ) : (
          <div className="mt-5 text-sm text-muted-foreground">{t("app.clock.notClockedIn")}</div>
        )}

        <button
          type="button"
          onClick={() => punch(clockedIn ? "out" : "in")}
          disabled={busy}
          className={`mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-semibold text-white transition-colors disabled:opacity-60 ${
            clockedIn ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : clockedIn ? (
            <LogOut size={18} />
          ) : (
            <LogIn size={18} />
          )}
          {clockedIn ? t("app.clock.clockOut") : t("app.clock.clockIn")}
        </button>
      </div>

      {/* Today */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{t("app.clock.today")}</h2>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {t("app.clock.hoursValue", { hours: (liveToday || 0).toFixed(2) })}
          </span>
        </div>
        {!data?.today?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("app.clock.noneToday")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.today.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">
                  {fmtTime(e.clockIn)} – {e.clockOut ? fmtTime(e.clockOut) : t("app.clock.open")}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {e.clockOut && e.hours != null ? t("app.clock.hoursValue", { hours: Number(e.hours).toFixed(2) }) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("app.clock.reviewNote")}</p>
      </div>
    </div>
  );
}
