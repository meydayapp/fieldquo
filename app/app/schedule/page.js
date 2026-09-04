// app/app/schedule/page.js
//
// Manager view of the whole team's schedule — who's available when, and what's
// booked. Read-only overview; each person still manages their own hours at
// Settings → Availability. API enforces the same user:view gate.
//
// ── i18n PENDING ───────────────────────────────────────────────────────────
//
// The page title and the two empty states go through t(); the intro paragraph
// and the two edit links do not. Not wired here, because a t() call on a key
// that does not exist yet turns check:translations red for every other agent
// in the tree (commit 080999e). Reported:
//
//   app.schedule.intro
//     en "Everyone's weekly availability and what's booked in the next two
//         weeks. People can set their own hours under Settings → Availability,"
//     fr "Les disponibilités hebdomadaires de chacun et ce qui est réservé dans
//         les deux prochaines semaines. Chacun peut fixer ses propres heures
//         sous Réglages → Disponibilités,"
//   app.schedule.introYouCanSet   en "and you can set anyone's from here."
//                                 fr "et vous pouvez fixer celles de n'importe qui d'ici."
//   app.schedule.introManagerCan  en "and a manager can set anyone's."
//                                 fr "et un gestionnaire peut fixer celles de n'importe qui."
//   app.schedule.editHours        en "Edit hours"   fr "Modifier les heures"
//   app.schedule.setHours         en "Set hours"    fr "Fixer les heures"
//   app.schedule.loadError        en "Couldn't load the team schedule."
//                                 fr "Impossible de charger l'horaire de l'équipe."
//
// The day-of-week abbreviations are NOT in that list on purpose: they come from
// Intl now (see weekDays below), which already has every language's, and a
// hand-maintained catalogue of seven words per language would be nine copies of
// data the platform ships.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CalendarDays, Clock } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { ROLE_LABELS, tierNote } from "@/lib/permissions/roleManagement";

// ── The week, in the reader's language and the company's order ─────────────
//
// This was `["Sun", "Mon", …]` — seven English abbreviations on a screen whose
// every other word goes through t(), and a Sunday-first week hardcoded next to
// a `weekStartsOn` preference the company can set and this page ignored. Both
// halves come from data now: Intl for the words, the provider for the offset.
//
// Built from a known Sunday (2024-01-07 was one) so the index is the JS
// dayOfWeek the availability rows are keyed by, not an off-by-one waiting to
// happen.
const SUNDAY = Date.UTC(2024, 0, 7);
function weekDays(locale, weekStartsOn) {
  const fmt = new Intl.DateTimeFormat(locale || undefined, {
    weekday: "short",
    timeZone: "UTC",
  });
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    // dow is the value stored in AvailabilitySchedule.dayOfWeek; the LABEL and
    // the POSITION move together, so a Monday-first company still lights up the
    // right column.
    const dow = (i + (weekStartsOn === 1 ? 1 : 0)) % 7;
    days.push({ dow, label: fmt.format(new Date(SUNDAY + dow * 86400000)) });
  }
  return days;
}

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

export default function TeamSchedulePage() {
  const { t, language } = useTranslation();
  // `toLocaleString(undefined, …)` read the BROWSER's locale and ignored the
  // company's dateFormat entirely — so the same appointment printed one way
  // here and another on every other /app screen, and a company set to
  // DD/MM/YYYY still got the browser's idea of a date. formatDateTime is the
  // one the rest of the back office uses.
  const { formatDateTime, weekStartsOn } = useCompanyPreferences();
  const days = weekDays(language, weekStartsOn);
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
        // Every half of this pairing carries its dark counterpart. A bare
        // `bg-red-50` is a white slab in a dark-mode van, and the only thing
        // on the screen when the load has failed.
        <p
          role="alert"
          className="text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 px-3 py-2 mb-4"
        >
          {error}
        </p>
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
                  {/* The TIER, not the person's access level. Two presets
                      share `supervisor`, so this word cannot distinguish a
                      Dispatcher from a Manager — and this payload deliberately
                      carries no permission grid (it is a schedule, not a
                      roster of access), so the tooltip is what makes the word
                      honest rather than a substitution. */}
                  <p
                    className="text-xs text-muted-foreground"
                    title={tierNote(m.role)}
                  >
                    {ROLE_LABEL[m.role] || m.role}
                  </p>
                </div>
                {/* flex-wrap, because at 375px the name, the "no availability"
                    sentence and this pill do not fit on one line — and the
                    pill was holding itself open with whitespace-nowrap, which
                    pushes the CARD wide rather than wrapping. Letting the row
                    break puts the pill on its own line instead. */}
                <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
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
                      className="inline-flex items-center min-h-[44px] text-xs font-semibold border border-border rounded-full px-3 py-1.5 hover:bg-muted"
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
                  {days.map(({ dow, label }) => {
                    const runs = byDay.get(dow);
                    return (
                      <div
                        key={dow}
                        className={`rounded-lg border px-1.5 py-2 text-center ${
                          runs ? "border-transparent bg-muted" : "border-border"
                        }`}
                      >
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</div>
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
                        <span className="tabular-nums text-muted-foreground">{formatDateTime(u.when)}</span>
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
