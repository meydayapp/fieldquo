// app/app/schedule/page.js
//
// Manager view of the whole team's schedule — who's available when, and what's
// booked. Read-only overview; each person still manages their own hours at
// Settings → Availability. API enforces the same user:view gate.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CalendarDays, Clock } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

import { useTranslation } from "@/app/hooks/useTranslation";
import { ROLE_LABELS } from "@/lib/permissions/roleManagement";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function initials(name) {
  return (
    String(name || "")
      .replace(/[^a-zA-Z ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

// Was a private copy saying Admin/Supervisor/Employee while Manage Team said
// Administrator/Manager/Worker for the same people — the third copy of this
// map, and the one that survived the last sweep. roleManagement.js claims to
// be "the ONLY definition"; it is now.
const ROLE_LABEL = ROLE_LABELS;

function when(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TeamSchedulePage() {
  const { t } = useTranslation();
  const [team, setTeam] = useState(null);
  // Comes from the server rather than being inferred from a role here, so the
  // edit links can't appear where the save would be refused.
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson("/api/team/schedules")
      .then((d) => {
        setTeam(d.team);
        setCanManage(Boolean(d.canManage));
      })
      .catch((e) => setError(e.message || "Could not load the team schedule"));
  }, []);

  return (
    <div className="max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <div data-tour="schedule-header" className="flex items-center gap-2 mb-1">
        <CalendarDays size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{t("app.schedule.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        Everyone&apos;s weekly availability and what&apos;s booked in the next two
        weeks. People can set their own hours under Settings → Availability, and
        {" "}
        {canManage
          ? "you can set anyone's from here."
          : "a manager can set anyone's."}
      </p>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">{error}</p>
      )}

      {!team && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {team && team.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("app.schedule.noMembers")}
        </div>
      )}

      <div className="space-y-3">
        {team?.map((m, i) => {
          const byDay = new Map();
          for (const a of m.availability) {
            if (!byDay.has(a.dayOfWeek)) byDay.set(a.dayOfWeek, []);
            byDay.get(a.dayOfWeek).push(`${a.startTime}–${a.endTime}`);
          }
          return (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="grid w-10 h-10 rounded-full place-items-center text-sm font-bold bg-muted text-foreground">
                  {initials(m.name)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABEL[m.role] || m.role}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {!m.hasAvailability && (
                    <span className="text-xs text-muted-foreground">{t("app.schedule.noAvailability")}</span>
                  )}
                  {/* The thing that was missing entirely: a way to get from
                      "this person has no availability" to setting it. Shown only
                      when the server said this caller may manage users, so it
                      can't be a link that 403s. */}
                  {canManage && m.userId && (
                    <Link
                      href={`/app/settings/availability?userId=${encodeURIComponent(m.userId)}`}
                      className="text-xs font-semibold border border-border rounded-full px-3 py-1.5 hover:bg-muted whitespace-nowrap"
                    >
                      {m.hasAvailability ? "Edit hours" : "Set hours"}
                    </Link>
                  )}
                </div>
              </div>

              {m.hasAvailability && (
                // Seven days across a 375px phone is 45px per column, which can't hold
                // "08:00-16:00". Scroll it sideways instead of crushing it: the week
                // stays one readable row and you swipe, which is how every calendar
                // on a phone behaves.
                <div className="mt-4 -mx-1 px-1 overflow-x-auto">
                <div className="grid grid-cols-7 gap-1.5 min-w-[520px] sm:min-w-0">
                  {DAYS.map((d, dow) => {
                    const runs = byDay.get(dow);
                    return (
                      <div
                        key={dow}
                        className={`rounded-lg border px-1.5 py-2 text-center ${
                          runs ? "border-transparent bg-muted" : "border-border"
                        }`}
                      >
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase">{d}</div>
                        {runs ? (
                          runs.map((r, j) => (
                            <div key={j} className="text-[10px] text-foreground mt-1 tabular-nums leading-tight">{r}</div>
                          ))
                        ) : (
                          <div className="text-[10px] text-muted-foreground/50 mt-1">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
              )}

              {m.upcoming.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {t("app.schedule.nextTwoWeeks")}
                  </p>
                  <ul className="space-y-1">
                    {m.upcoming.slice(0, 8).map((u, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-foreground">
                        <Clock size={13} className="text-muted-foreground shrink-0" />
                        <span className="tabular-nums text-muted-foreground">{when(u.when)}</span>
                        <span className="truncate">· {u.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
