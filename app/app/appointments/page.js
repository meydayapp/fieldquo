// app/(app)/appointments/page.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  MapPin,
  User as UserIcon,
  ShieldAlert,
  X,
  Car,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Headset,
  Phone,
  Mail,
  Video,
  FileText,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchJson } from "@/lib/fetchJson";
import { dayKey, monthGrid, localeFormat, localeDateTime } from "@/lib/calendar/monthGrid";
import { travelLegs, describeTravel } from "@/lib/booking/travel";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { can } from "@/lib/permissions";
import { navRowAllowed } from "@/lib/permissions/nav";
import { useSession } from "@/lib/auth-client";

import { useTranslation } from "@/app/hooks/useTranslation";
// The four-key STATUS_STYLES that used to sit here is now
// lib/appointments/statusLabels.js, exhaustive over all THREE vocabularies this
// calendar merges. It was only ever keyed on AppointmentStatus, so every
// unconverted booking fell through to grey with the word "pending payment"
// printed beside it — see that file's header.
import {
  APPOINTMENT_FILTERS,
  appointmentFilterLabel,
  appointmentStatusClasses,
  appointmentStatusLabel,
} from "@/lib/appointments/statusLabels";

// dayKey, monthGrid, localeFormat, localeDateTime now live in
// lib/calendar/monthGrid.js — extracted from here so
// app/app/marketing/designer/calendar/page.js (the scheduled social-post
// calendar, docs/SOCIAL-SCHEDULING.md) could reuse the exact same date math
// instead of a second hand-copied version. See that file's own header for
// why the grid JSX itself was NOT extracted alongside it.

/**
 * Which KIND of appointment this is — the fact the owner asked for by name.
 *
 * A callback and a site visit are a name and a time on this list, and they mean
 * opposite things: one is "ring this person", the other is "drive to their
 * house". A callback has no address by design, so the row for one carries
 * nothing that distinguishes it at all.
 *
 * The three modes are MODE_WORDS in lib/voice/visitPath.js, and the labels are
 * the receptionist screen's, not new ones: the same call shows "Callback
 * booked" on /app/receptionist, and one fact should not have two vocabularies.
 *
 * There is deliberately NO default. `mode` is null on an appointment nobody
 * booked through a booking page and on rows predating the column, and guessing
 * "visit" there sends somebody to a driveway.
 */
const MODE_BADGES = {
  call: { key: "app.receptionist.bookedCall", icon: Phone },
  visit: { key: "app.receptionist.bookedVisit", icon: MapPin },
  video: { key: "app.receptionist.bookedVideo", icon: Video },
};

/**
 * The device's maps app, from an address.
 *
 * Same affordance and same URL shape as the job page's — the calendar and the
 * job detail must not disagree about what "directions" opens.
 */
function mapsHref(address) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

/**
 * Does this entry's client row actually CARRY contact details?
 *
 * Only an appointment's does. GET /api/appointments loads the whole Client row
 * for an appointment (then redacts it), while VISIT_INCLUDE narrows a visit's
 * client to { id, name, address } and a booking's client is synthesised from
 * the booking's own columns. So `phone` is undefined on those two whatever the
 * customer's record says — and printing "not set" there would be a lie about a
 * customer whose number we hold. The panel says nothing instead.
 */
function carriesContact(entry) {
  return entry?.kind === "appointment";
}

/**
 * The drive between each appointment and the one before it.
 *
 * Grouped BY ASSIGNEE first. The list is one chronological stream across the
 * whole company, so pairing neighbours blind would show a painter the drive
 * from a plumber's last job — a number that is not merely useless but actively
 * misleading, because it looks exactly like a real one.
 *
 * Unassigned appointments are skipped rather than lumped together: "nobody" is
 * not a person with a van.
 */
function legsByAppointment(appointments) {
  const byPerson = new Map();
  for (const a of appointments) {
    if (!a.assignedToId) continue;
    if (!byPerson.has(a.assignedToId)) byPerson.set(a.assignedToId, []);
    byPerson.get(a.assignedToId).push(a);
  }

  const out = new Map();
  for (const list of byPerson.values()) {
    const stops = list
      .slice()
      .sort((x, y) => new Date(x.scheduledAt) - new Date(y.scheduledAt))
      .map((a) => ({
        id: a.id,
        at: a.scheduledAt,
        endAt: a.booking?.endTime || null,
        latitude: a.latitude,
        longitude: a.longitude,
      }));
    for (const leg of travelLegs(stops)) out.set(leg.id, leg);
  }
  return out;
}

export default function AppointmentsPage() {
  const { t, language } = useTranslation();
  const { weekStartsOn, formatDate } = useCompanyPreferences();
  // ── What the assign control is allowed to offer ──────────────────────────
  //
  // The row below used to render a select of the WHOLE team on every
  // appointment, for everybody. PATCH /api/appointments/[id] allows an
  // employee exactly one assignment: putting their own name on an unassigned
  // row. Every other name in that list answered 403, so a crew member got a
  // dropdown whose entries all failed — the dead control AGENTS.md names.
  //
  // The coarse role is the right question because it is the one the server
  // asks: `can(role, "appointment:assign")`, not a schedule level. Asking a
  // different question here is how a UI ends up offering what the API refuses.
  //
  // Unresolved provider falls OPEN, which is PermissionProvider's own rule —
  // an owner must not be shown a crew-shaped control because a lookup was
  // slow, and the server refuses regardless of what this renders.
  const caller = usePermissions();
  const canAssign = !caller?.role || can(caller.role, "appointment:assign");
  // Whether "Open client" is worth offering. Asked of navRowAllowed rather than
  // hasLevel directly, so this link and the sidebar row it duplicates answer
  // the same question of the same grid — including its failure posture, which
  // is to fall OPEN when no provider resolved. A member on name_address_only
  // has no /app/clients at all (see lib/permissions/nav.js on why the client
  // BOOK is gated above the address on their own work), and a link into a
  // screen that is hidden from them is the dead control AGENTS.md opens with.
  const canOpenClient = navRowAllowed("app.nav.clients", caller);
  // Claiming needs the caller's own USER id — Member.userId server-side, which
  // is the session user's id. Nothing else on this page knows it: the roster
  // from /api/settings/members does not say which row is you.
  const { data: session } = useSession();
  const myUserId = session?.user?.id || null;
  // `null` until the fetch answers, and NOT `[]`. The filter chips carry
  // counts, and a count is a claim: rendering "Scheduled 0" while the request
  // is still in flight — or after it failed — states as fact the one thing the
  // page does not yet know. Same null-versus-empty rule `team` below already
  // follows, applied to the list the whole screen is built from.
  const [appointments, setAppointments] = useState(null);
  const [members, setMembers] = useState([]);
  // List 2. `null` means "not yours to see" — the server's answer, not a
  // guess made here — and TeamSchedule renders nothing for it.
  const [team, setTeam] = useState(null);
  const [teamBasis, setTeamBasis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  // The month on screen, anchored to its 1st. Separate from the selected day so
  // paging away from a selection doesn't silently drop the filter under the
  // list — the list keeps saying which day it's showing.
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(""); // "" = the whole list
  const listRef = useRef(null);
  // Which rows are expanded. A Set rather than one open id: a dispatcher
  // comparing two mornings should not have the first one snap shut when they
  // open the second. Keyed by kind+id because an Appointment id and a JobVisit
  // id come from different tables and are only accidentally distinct.
  const [openRows, setOpenRows] = useState(() => new Set());
  const toggleRow = (key) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ── One loader, called on mount AND by the error banner's button ─────────
  //
  // A named function rather than an inline effect body so the retry can call
  // the same thing the page loaded with. Neon scales to zero and the first
  // request after an idle period can fail with P1001 — a genuinely transient
  // failure whose only cure was reloading the whole route, which throws away
  // the month, the day selection and every open row. See AGENTS.md's
  // environment note; this is the page that names it.
  //
  // `useCallback` with no dependencies: it reads nothing from render scope, so
  // it is stable, and the mount effect below can depend on it honestly rather
  // than carrying an eslint-disable.
  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    // Was a bare Promise.all(...).then(): if either request 500'd, r.json()
    // threw, the .then never ran, and setLoading(false) never fired — the page
    // sat on its skeleton forever with nothing to report.
    try {
      const [appts, mem] = await Promise.all([
        fetchJson("/api/appointments"),
        fetchJson("/api/settings/members"),
      ]);
      setAppointments(appts);
      setMembers(mem);
    } catch (err) {
      setError(err.message || "Could not load appointments");
    } finally {
      setLoading(false);
    }

    // Fetched separately, and deliberately so: the crew list is secondary, and
    // a failure fetching it must not blank the calendar the person actually
    // came for.
    //
    // The endpoint answers 200 with `team: null` for a caller without the
    // permission — that is not an error and gets no banner. A genuine failure
    // does get one, worded so it says nothing about whether this person has a
    // team: telling an employee their "team schedule" failed would imply an
    // entitlement they do not have, which is the same lie as rendering the
    // empty heading.
    //
    // Not awaited, for the same reason it is a second request: the calendar
    // must render as soon as its own data lands.
    fetchJson("/api/schedule/team")
      .then((d) => {
        setTeam(d.canSeeTeam ? d.team : null);
        setTeamBasis(d.basis || null);
      })
      .catch(() => setError("Part of the calendar couldn't be loaded."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // `appointments` is null until the fetch answers. Everything downstream of
  // this line wants a list, and every one of them treats "nothing yet" and
  // "nothing at all" identically — correctly, because both render an empty
  // calendar. The ONE place the difference matters is the chip counts below,
  // which read `appointments` itself rather than this.
  const entries = appointments || [];

  // Status-filtered, and the source for BOTH surfaces. A calendar showing
  // cancelled visits the list below has hidden would have the two disagreeing
  // about what's booked, on the same screen.
  const filtered =
    filter === "all" ? entries : entries.filter((a) => a.status === filter);

  // How many rows each chip would show — counted over the SAME list the chip
  // would filter, so the number and the result cannot disagree. Null while the
  // list has never loaded: `0` is a statement, and "Cancelled 0" printed over a
  // failed request is a confident lie about a calendar nobody has read yet.
  const filterCounts = useMemo(() => {
    if (!appointments) return null;
    const counts = { all: appointments.length };
    for (const s of APPOINTMENT_FILTERS) {
      if (s === "all") continue;
      counts[s] = appointments.filter((a) => a.status === s).length;
    }
    return counts;
  }, [appointments]);

  const legs = useMemo(() => legsByAppointment(appointments || []), [appointments]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const a of filtered) {
      const d = new Date(a.scheduledAt);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(a);
    }
    for (const list of map.values()) {
      list.sort((x, y) => new Date(x.scheduledAt) - new Date(y.scheduledAt));
    }
    return map;
  }, [filtered]);

  const cells = useMemo(
    () => monthGrid(monthAnchor, weekStartsOn),
    [monthAnchor, weekStartsOn],
  );

  // Header names come from Intl rather than a hardcoded list, so a Monday-start
  // company in French gets "lun." without a seventh translated array to keep in
  // step. Built off a known Sunday (2024-01-07) plus the company's offset.
  const weekdayNames = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        localeFormat(new Date(2024, 0, 7 + ((weekStartsOn + i) % 7)), language, {
          weekday: "short",
        }),
      ),
    [weekStartsOn, language],
  );

  const todayKey = dayKey(new Date());
  const shown = selectedDay
    ? filtered.filter((a) => dayKey(new Date(a.scheduledAt)) === selectedDay)
    : filtered;

  function pickDay(key) {
    // Clicking the selected day again clears it. A day filter you can enter and
    // not leave is the sort of control people learn to avoid using.
    setSelectedDay((prev) => (prev === key ? "" : key));
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const assign = async (id, assignedToId) => {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">{t("app.appts.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.appts.subtitle")}
          </p>
        </div>
        <button
          data-tour="appts-new"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60 shrink-0"
        >
          <Plus size={16} />{t("app.appts.new")}</button>
      </div>

      {/* Above the calendar, not below it, because it governs both surfaces —
          a filter row sitting under the grid it controls reads as belonging to
          the list alone. */}
      <div data-tour="appts-filters" className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {APPOINTMENT_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`shrink-0 inline-flex items-center gap-2 min-h-[44px] rounded-full px-4 text-sm border ${
              filter === s
                ? "bg-inverted text-inverted-foreground border-inverted"
                : "border-border"
            }`}
          >
            {/* Was `s.replace("_", " ")` — "needs supervisor", lowercase and
                English on a French screen. See lib/appointments/statusLabels.js
                for why this is a shared module and not a map in this file. */}
            {appointmentFilterLabel(s, t)}
            {/* The count, only once there is one. `filterCounts` is null until
                the list loads, and a chip reading "0" over a request that never
                answered is the confident-zero failure — so the chip simply
                carries no number until it has one to carry. */}
            {filterCounts && (
              <span
                className={`tabular-nums text-xs font-semibold rounded-full px-1.5 py-0.5 ${
                  filter === s ? "bg-inverted-foreground/15" : "bg-muted text-muted-foreground"
                }`}
              >
                {filterCounts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* The `dark:` half was missing on all three classes, so in a dark cab
          this was a bright light-red slab — byte-identical to the team
          schedule's, which is how it got here. The button is the point: Neon
          scales to zero and the first request after idle can fail with P1001,
          and the only cure on offer was reloading the route and losing the
          month, the selected day and every open row. */}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 px-3 py-2 mb-4">
          <p className="min-w-0">{error}</p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="shrink-0 inline-flex items-center min-h-[44px] px-3 rounded-lg border border-red-300 dark:border-red-800 font-medium disabled:opacity-50"
          >
            {t("app.action.retry", "Try again")}
          </button>
        </div>
      )}

      {/* ── The month ─────────────────────────────────────────────────────
          Rendered whether or not anything is booked. An empty month with its
          weekday columns and a highlighted today reads as "nothing scheduled";
          the sentence that used to stand here alone read as a page that had
          failed to load. That's the whole reason this grid exists. */}
      <section className="rounded-xl border border-border bg-card overflow-hidden mb-5">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground capitalize truncate">
            {localeFormat(monthAnchor, language, {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                setMonthAnchor(
                  (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                )
              }
              aria-label={t("app.action.previous")}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setMonthAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="inline-flex items-center min-h-[44px] px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted"
            >
              {t("app.time.today")}
            </button>
            <button
              onClick={() =>
                setMonthAnchor(
                  (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                )
              }
              aria-label={t("app.action.next")}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {weekdayNames.map((name, i) => (
            <div
              key={i}
              className="px-1 py-1.5 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Seven equal columns at every width. The alternative — collapsing to
            an agenda on a phone — loses the shape of the month, which is the
            one thing a grid is for. Instead the cells get denser: chips carry
            the time and the client above sm, and become dots below it, so
            nothing has to scroll sideways at 375px. */}
        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const key = dayKey(day);
            const items = byDay.get(key) || [];
            const outside = day.getMonth() !== monthAnchor.getMonth();
            const isToday = key === todayKey;
            const isPicked = key === selectedDay;

            // An aria-label REPLACES a button's contents for a screen reader,
            // so the chips have to be folded into it — a label of the date
            // alone would announce a day as empty when it has three visits on
            // it. Built from the same values the chips render.
            const cellLabel = [
              localeFormat(day, language, {
                weekday: "long",
                day: "numeric",
                month: "long",
              }),
              ...items.map(
                (a) =>
                  `${new Date(a.scheduledAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })} ${a.client?.name || ""}`.trim(),
              ),
            ].join(", ");

            return (
              <button
                key={key}
                type="button"
                onClick={() => pickDay(key)}
                aria-pressed={isPicked}
                aria-label={cellLabel}
                // The right border is dropped on every 7th cell so the column
                // rules stop at the grid edge instead of doubling up with the
                // card's own border.
                className={`min-h-[62px] sm:min-h-[92px] text-left align-top p-1 sm:p-1.5 border-b border-r border-border [&:nth-child(7n)]:border-r-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset ${
                  isPicked ? "bg-muted" : "hover:bg-muted/60"
                } ${outside ? "opacity-45" : ""}`}
              >
                <span
                  className={`inline-flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full text-[11px] sm:text-xs tabular-nums ${
                    isToday
                      ? "bg-inverted text-inverted-foreground font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>

                {items.length > 0 && (
                  <>
                    <span className="hidden sm:block mt-0.5 space-y-0.5">
                      {items.slice(0, 2).map((a) => (
                        <span
                          key={a.id}
                          className={`block truncate rounded px-1 py-0.5 text-[10px] leading-tight ${appointmentStatusClasses(
                            a.status,
                          )}`}
                        >
                          {new Date(a.scheduledAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          {a.client?.name}
                        </span>
                      ))}
                      {items.length > 2 && (
                        <span className="block px-1 text-[10px] text-muted-foreground">
                          +{items.length - 2}
                        </span>
                      )}
                    </span>

                    {/* Below sm a chip can't carry a name legibly, and a
                        truncated one ("Mar…") is worse than an honest dot. */}
                    <span className="sm:hidden mt-1 flex flex-wrap gap-0.5 items-center">
                      {items.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            a.status === "cancelled"
                              ? "bg-muted-foreground"
                              : "bg-inverted"
                          }`}
                        />
                      ))}
                      {items.length > 3 && (
                        <span className="text-[9px] text-muted-foreground leading-none">
                          +{items.length - 3}
                        </span>
                      )}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {selectedDay && (
        <div className="flex items-center justify-between gap-3 mb-3 text-sm">
          <span className="text-foreground font-medium">
            {formatDate(`${selectedDay}T12:00:00`)}
          </span>
          <button
            onClick={() => setSelectedDay("")}
            className="inline-flex items-center gap-1 min-h-[44px] px-2 -mx-2 text-muted-foreground hover:text-foreground"
          >
            <X size={13} /> {t("app.action.clear")}
          </button>
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-accent rounded-lg" />
          <div className="h-20 bg-accent rounded-lg" />
        </div>
      )}

      {/* `appointments &&`, not just `!loading`. "No appointments in this view"
          is a statement about the calendar, and a request that never answered
          entitles nobody to make it — the banner above already says what
          happened and offers the retry. This is the same restricted-versus-
          empty-versus-never-loaded split AppointmentDetails further down makes
          by hand; the list itself had been collapsing two of the three. */}
      {!loading && appointments && shown.length === 0 && (
        <div className="glass-effect rounded-lg p-6 text-center text-sm text-muted-foreground">
          {t("app.appts.empty")}
        </div>
      )}

      <div ref={listRef} className="space-y-3 scroll-mt-4">
        {shown.map((appt) => {
          // Read from the FULL list, not `filtered`. A drive is measured from
          // the previous stop, and that stop may be filtered off screen —
          // computing legs over the visible subset would quietly invent a
          // drive from whatever happened to be above it.
          const leg = legs.get(appt.id);

          const rowKey = `${appt.kind || "appointment"}-${appt.id}`;
          const isOpen = openRows.has(rowKey);
          const panelId = `appt-details-${rowKey}`;

          // The start, and — when we actually know it — the finish. An
          // Appointment has no duration column, so a row created from a booking
          // is the only kind that can say when it ends. Nothing is assumed for
          // the rest: an invented hour on a kitchen survey is the sort of
          // number people plan a second job around.
          const startAt = new Date(appt.scheduledAt);
          const endAt = appt.booking?.endTime ? new Date(appt.booking.endTime) : null;
          const whenText = Number.isNaN(startAt.getTime())
            ? ""
            : localeDateTime(startAt, language, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }) +
              (endAt && !Number.isNaN(endAt.getTime())
                ? ` – ${localeDateTime(endAt, language, { hour: "numeric", minute: "2-digit" })}`
                : "");

          // What the person acts on from the row itself: a number to ring and a
          // place to drive to. `location` is where the van goes and is the right
          // one to lead with; the client's own address is a fallback and is
          // shown separately in the panel when the two disagree.
          const phone = appt.client?.phone || null;
          const rowAddress = appt.location || appt.client?.address || null;

          // Bookings carry `notes` too, but bookingToCalendarEntry fills it with
          // the booking's MODE — the word "visit" — which now has its own badge
          // on the row. Repeating it under a "Notes" heading would dress a badge
          // up as something the customer said.
          const notesText = appt.kind === "booking" ? null : appt.notes || null;
          const notePreview = (notesText || "")
            .split("\n")
            .map((line) => line.trim())
            .find(Boolean);

          const mode = MODE_BADGES[appt.booking?.mode] || null;
          const ModeIcon = mode?.icon;

          return (
          <div key={rowKey}>
          {leg?.travel && (
            <div
              className={`flex items-center gap-1.5 text-xs px-1 pb-1.5 ${
                leg.tight
                  ? "text-amber-700 dark:text-amber-400 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {leg.tight ? <AlertTriangle size={12} /> : <Car size={12} />}
              <span>
                {describeTravel(leg.travel)}
                {leg.gapMinutes != null && ` · ${leg.gapMinutes} min gap`}
                {leg.tight && ` · ${leg.shortBy} min short`}
              </span>
            </div>
          )}
          <div className="glass-effect card-hover rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* ── The row opens ─────────────────────────────────────────
                    A button rather than a click handler on the card, because
                    the card also holds an assignee <select> and two links, and
                    a div that swallows clicks around real controls is how a
                    dropdown stops opening on a phone.

                    No aria-label: one REPLACES the button's contents for a
                    screen reader, and the contents here are the client's name
                    and every badge on the row — the most useful announcement
                    on the page. aria-expanded carries the affordance instead. */}
                <button
                  type="button"
                  onClick={() => toggleRow(rowKey)}
                  aria-expanded={isOpen}
                  // Only while the panel exists. aria-controls pointing at an
                  // id that is not in the document is a dangling reference, and
                  // some screen readers announce it as a broken control.
                  aria-controls={isOpen ? panelId : undefined}
                  // And only while it would be true. "Show details" hovering
                  // over details that are already on screen is a small version
                  // of the same lie as a button that doesn't do the thing.
                  title={isOpen ? undefined : t("app.appts.toggleDetails")}
                  className="w-full min-h-[44px] text-left rounded focus:outline-none focus:ring-2 focus:ring-ring"
                >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">
                    {appt.client?.name}
                  </span>
                  {/* Was `String(status).replace("_", " ")` — the raw column
                      value, lowercase and untranslated, on the badge a
                      dispatcher reads first. The default stays "scheduled":
                      an Appointment row cannot have a null status, but a
                      pre-column JobVisit can, and "Scheduled" is what
                      lib/schedule/jobVisits.js already substitutes for it. */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${appointmentStatusClasses(
                      appt.status || "scheduled",
                    )}`}
                  >
                    {appointmentStatusLabel(appt.status || "scheduled", t)}
                  </span>
                  {/* Job visits now appear on this calendar alongside
                      appointments (they used to be invisible here entirely).
                      They are a different thing and are labelled as one —
                      an unlabelled visit would look like an appointment the
                      controls below simply refuse to edit. */}
                  {appt.kind === "visit" && (
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                      {t("app.appts.jobVisit")}
                    </span>
                  )}
                  {/* A booking the client made that never became an
                      appointment. Labelled for the same reason a visit is:
                      unlabelled, it would look like an appointment whose
                      controls have simply stopped working. */}
                  {appt.kind === "booking" && (
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300">
                      {t("app.appts.clientBooking")}
                    </span>
                  )}
                  {appt.requiresSupervisor && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                      <ShieldAlert size={12} />{t("app.appts.supervisorRequired")}</span>
                  )}
                  {/* ── Who arranged this: a person, or the robot ───────────
                      Booking.source is "phone_assistant" when the AI
                      receptionist took the booking on a call, and null for the
                      overwhelming majority a client made themselves — which is
                      why this is a quiet qualifier in the muted colour rather
                      than another coloured pill. Somebody driving to a job is
                      entitled to know that nobody in the company ever spoke to
                      this customer.

                      Read off `appt.booking`, which is the one shape both
                      calendar sources share: an Appointment carries its
                      Booking through a relation, and an unconverted Booking
                      gets the same sub-object from bookingToCalendarEntry.

                      Both feeds carry it: the appointment route selects
                      `source` beside `endTime`, and bookingToCalendarEntry
                      passes it through in the same shape — deliberately the
                      same shape, because a badge that showed on converted
                      bookings and vanished on identical unconverted ones would
                      read as a data problem rather than a rendering one. */}
                  {appt.booking?.source === "phone_assistant" && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Headset size={12} />{t("app.schedule.bookedByAssistant")}</span>
                  )}
                  {/* Ring them, or drive to them. See MODE_BADGES. */}
                  {mode && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0 border border-border text-muted-foreground">
                      <ModeIcon size={11} />{t(mode.key)}</span>
                  )}
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
                {/* A visit's job title, a booking's event type. Both were
                    carried by the feed and rendered by nothing — so a day of
                    job visits read as a list of surnames. */}
                {appt.title && (
                  <div className="text-sm text-muted-foreground mt-0.5 truncate">
                    {appt.title}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-1">
                  {whenText}
                </div>
                </button>

                {/* Outside the toggle: these are links, and a link inside a
                    button is neither one. This is the line the owner asked for
                    — a number that dials and an address that opens maps,
                    without opening anything first. */}
                {(phone || rowAddress) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm">
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="flex items-center gap-1.5 text-foreground underline underline-offset-2"
                      >
                        <Phone size={13} className="shrink-0" />
                        <span className="tabular-nums">{phone}</span>
                      </a>
                    )}
                    {rowAddress && (
                      <a
                        href={mapsHref(rowAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 min-w-0 text-muted-foreground underline underline-offset-2"
                      >
                        <MapPin size={13} className="shrink-0" />
                        <span className="truncate">{rowAddress}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Why this appointment exists, in one line. For an AI-booked
                    callback that is the caller's own words, and it was on
                    screen nowhere at all. */}
                {!isOpen && notePreview && (
                  <p className="text-sm text-muted-foreground mt-1 truncate italic">
                    {notePreview}
                  </p>
                )}
              </div>

              {/* A visit's id is a JobVisit id, and a booking's is a Booking
                  id — PATCHing either against /api/appointments/[id] would
                  404. Rather than render a select that silently fails, both
                  show who is assigned; a visit also links to its job, which is
                  where a visit is actually rescheduled. A booking is
                  rescheduled by the client through their manage link, so there
                  is nothing here to offer and nothing is offered. */}
              {appt.kind === "visit" || appt.kind === "booking" ? (
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserIcon size={14} />
                    {appt.assignedTo?.name || t("app.appts.unassigned")}
                  </span>
                  {appt.jobId && (
                    <Link
                      href={`/app/jobs/${appt.jobId}`}
                      className="inline-flex items-center min-h-[44px] text-sm font-medium underline underline-offset-2 shrink-0"
                    >
                      {t("app.appts.openJob")}
                    </Link>
                  )}
                </div>
              ) : canAssign ? (
              <div className="flex items-center gap-2 shrink-0">
                <UserIcon size={14} className="text-muted-foreground" />
                <select
                  value={appt.assignedToId || ""}
                  onChange={(e) => assign(appt.id, e.target.value || null)}
                  className="border rounded px-2 py-1.5 text-sm bg-card"
                >
                  <option value="">{t("app.appts.unassigned")}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name}
                      {appt.requiresSupervisor &&
                      !["owner", "admin", "supervisor"].includes(m.role)
                        ? " (not a supervisor)"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              ) : (
              /* No appointment:assign. Same shape as the visit branch above,
                 for the same reason: who it is assigned to is a fact worth
                 reading, and the only WRITE the server will accept from here
                 is claiming an unassigned row for yourself.

                 The claim button is withheld on a supervisor-required
                 appointment, and that is not a second guess at the rule — it
                 is the same one. appointment:assign is held by owner, admin
                 and supervisor, so anybody reaching this branch is an
                 employee, and PATCH answers 400 ("requires a supervisor or
                 admin to be assigned") for exactly that assignee. Offering it
                 would be the dead control again, one branch further in. The
                 "Supervisor required" badge on the row already says why. */
              <div className="flex items-center gap-3 shrink-0">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserIcon size={14} />
                  {appt.assignedTo?.name || t("app.appts.unassigned")}
                </span>
                {!appt.assignedToId && !appt.requiresSupervisor && myUserId && (
                  <button
                    type="button"
                    onClick={() => assign(appt.id, myUserId)}
                    className="inline-flex items-center min-h-[44px] text-sm font-medium underline underline-offset-2 shrink-0"
                  >
                    {t("app.appts.assignToMe", "Assign to me")}
                  </button>
                )}
              </div>
              )}
            </div>

            {isOpen && (
              <AppointmentDetails
                appt={appt}
                panelId={panelId}
                canOpenClient={canOpenClient}
                t={t}
              />
            )}
          </div>
          </div>
          );
        })}
      </div>

      {/* List 2, and deliberately BELOW list 1 rather than merged into it.
          Your own day is what you came for; the crew is context. Merging them
          into one colour-coded stream buries your 8am between two other
          people's. */}
      <TeamSchedule team={team} basis={teamBasis} />

      {showForm && (
        <NewAppointmentModal
          members={members}
          onClose={() => setShowForm(false)}
          onCreated={(appt) => {
            setAppointments((prev) => [appt, ...prev]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * One labelled fact, or nothing at all.
 *
 * Renders nothing for a null child rather than a dash. The two absences on this
 * screen are different statements — a callback genuinely has no address, and a
 * member on name_address_only has a phone number they may not read — so the
 * CALLER decides what an absence means and this component never pads one.
 */
function DetailRow({ icon: Icon, label, children }) {
  if (children == null) return null;
  return (
    <div className="flex items-start gap-3 min-w-0">
      <dt className="flex items-center gap-1.5 w-24 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon size={12} className="shrink-0" />}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="flex-1 min-w-0 text-sm text-foreground break-words">
        {children}
      </dd>
    </div>
  );
}

/**
 * Everything the calendar feed carries about one entry.
 *
 * ── What was on screen before ──────────────────────────────────────────────
 *
 * A name, a time and a street. The owner's complaint was that a crew member
 * cannot tell "who to call, where to go or what number" from that — and it is
 * worst on an AI-booked CALLBACK, which has no address by design, so the row
 * was a name and a time and the one thing the person making that call needs
 * was on screen nowhere in the product.
 *
 * ── Three kinds of absence, three different sentences ──────────────────────
 *
 * Restricted, empty, and never-loaded are not the same fact, and the failure
 * mode of collapsing them is real: "Not set" under a phone number sends someone
 * to the client record to fill in a field that is already filled in and simply
 * hidden from them.
 *
 *   * `client.restricted` — redactClient stripped it (lib/permissions/enforce),
 *     so the number exists and this member may not read it.
 *   * loaded and empty — genuinely nothing on file, which is worth saying,
 *     because "Open client" below is how it gets fixed.
 *   * never loaded — see carriesContact(). Only an appointment's client row
 *     reaches this page whole. The panel stays silent rather than guessing.
 *
 * Address is deliberately not in that matrix: name_address_only KEEPS the
 * address (that is the level's whole point — crew have to drive there), so a
 * blank one is always a genuine blank, and on a callback it is the correct
 * answer rather than missing data.
 */
function AppointmentDetails({ appt, panelId, canOpenClient, t }) {
  const client = appt.client || null;
  const loaded = carriesContact(appt);

  // A link to the value, or the sentence that explains its absence, or nothing.
  const contact = (value, href) => {
    if (value) {
      return (
        <a href={href} className="underline underline-offset-2 break-all">
          {value}
        </a>
      );
    }
    if (client?.restricted) {
      return (
        <span className="text-muted-foreground italic">
          {t("app.access.restricted")}
        </span>
      );
    }
    if (loaded) {
      return <span className="text-muted-foreground">{t("app.job.notSet")}</span>;
    }
    return null;
  };

  const address = (value) =>
    value ? (
      <a
        href={mapsHref(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {value}
      </a>
    ) : null;

  // Where the van goes and where the customer lives are allowed to differ — a
  // site address on the appointment, a billing address on the client — and both
  // are shown when they do. Identical strings collapse to one row rather than
  // printing the same street twice under two headings.
  const siteAddress = appt.location || null;
  const clientAddress =
    client?.address && client.address !== siteAddress ? client.address : null;

  const notesText = appt.kind === "booking" ? null : appt.notes || null;

  // A booking's client is synthesised from the booking's own columns — there is
  // no Client row behind it — so offering to open one would 404 on an id that
  // does not exist. bookingToCalendarEntry marks it `synthetic` for exactly
  // this decision.
  const clientHref =
    canOpenClient && client?.id && !client.synthetic
      ? `/app/clients/${client.id}`
      : null;

  return (
    <div
      id={panelId}
      className="mt-3 pt-3 border-t border-border"
    >
      <dl className="space-y-2.5">
        <DetailRow icon={Phone} label={t("app.field.phone")}>
          {contact(client?.phone, `tel:${client?.phone}`)}
        </DetailRow>
        <DetailRow icon={Mail} label={t("app.field.email")}>
          {contact(client?.email, `mailto:${client?.email}`)}
        </DetailRow>
        <DetailRow icon={MapPin} label={t("app.appts.location")}>
          {address(siteAddress)}
        </DetailRow>
        <DetailRow icon={MapPin} label={t("app.field.address")}>
          {address(clientAddress)}
        </DetailRow>
        <DetailRow icon={FileText} label={t("app.field.notes")}>
          {notesText ? (
            // Line breaks preserved: an AI-booked callback's notes are a short
            // list — who rang, on what number, what they asked for — and run
            // together they read as one unpunctuated sentence.
            <p className="whitespace-pre-line">{notesText}</p>
          ) : null}
        </DetailRow>
      </dl>

      {/* Who it is assigned to is NOT repeated here. It is already on every row
          — in the assignee select, or beside it as a name — and that is the
          place it is changed, so a second copy two inches away could only ever
          disagree with the first. */}
      {clientHref && (
        <Link
          href={clientHref}
          className="inline-block mt-3 text-sm font-medium underline underline-offset-2"
        >
          {t("app.appts.openClient")}
        </Link>
      )}
    </div>
  );
}

/**
 * What the people reporting to you are doing, per person.
 *
 * Renders NOTHING — not a heading, not an empty state — when the caller has no
 * team or no permission to see one. `team` is null for "you may not", [] for
 * "you may, and nobody reports to you"; both mean there is nothing truthful to
 * put on screen, and a heading over nothing is a control that appears to work.
 *
 * The server decides which of those it is. This component cannot grant itself
 * a team by rendering one, and the API refuses the data independently — see
 * lib/schedule/teamScope.js.
 */
function TeamSchedule({ team, basis }) {
  const { t, language } = useTranslation();
  if (!Array.isArray(team) || team.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold">{t("app.appts.teamTitle")}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {/* Says which list this actually is. A company that has drawn an org
            chart gets "reporting to you"; one that has not gets "your team",
            because claiming a reporting line that nobody entered would be
            inventing a fact about the company. */}
        {basis === "reporting_line"
          ? t("app.appts.teamReportsSubtitle")
          : t("app.appts.teamCompanySubtitle")}
      </p>

      <div className="space-y-3">
        {team.map((person) => (
          <div key={person.memberId} className="glass-effect rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium truncate">{person.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {person.entries.length === 0
                  ? t("app.appts.teamNothingBooked")
                  : t("app.appts.teamBookedCount", { count: person.entries.length })}
              </span>
            </div>

            {person.entries.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {person.entries.map((e) => (
                  <li
                    key={`${e.kind}-${e.id}`}
                    className="flex items-baseline gap-2 text-sm min-w-0"
                  >
                    {/* An INSTANT, so it formats local — the house rule in
                        lib/format/companyDate.js. Running it through the
                        date-only formatter (which reads UTC getters) would
                        file every evening booking under tomorrow. */}
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {localeFormat(new Date(e.scheduledAt), language, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="truncate">
                      {e.client?.name || e.title || t("app.appts.untitledEntry")}
                    </span>
                    {e.kind === "visit" && (
                      <span className="text-[10px] uppercase tracking-wide text-purple-700 dark:text-purple-300 shrink-0">
                        {t("app.appts.jobVisit")}
                      </span>
                    )}
                    {e.kind === "booking" && (
                      <span className="text-[10px] uppercase tracking-wide text-teal-700 dark:text-teal-300 shrink-0">
                        {t("app.appts.clientBooking")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function NewAppointmentModal({ members, onClose, onCreated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    scheduledAt: "",
    location: "",
    requiresSupervisor: false,
    assignedToId: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      onCreated(await res.json());
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          {/* The only hardcoded English string in 1,217 lines, and it was the
              modal's own heading. `app.appts.new` is the same words the button
              that opens this dialog already carries — one concept, one word. */}
          <h2 className="font-semibold">{t("app.appts.new", "New Appointment")}</h2>
          <button
            onClick={onClose}
            aria-label={t("app.action.close", "Close")}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 text-muted-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">{t("app.appts.clientName")}</label>
            <input
              required
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">{t("app.appts.dateTime")}</label>
            <input
              required
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) =>
                setForm({ ...form, scheduledAt: e.target.value })
              }
              className="w-full border rounded px-3 py-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">{t("app.appts.location")}</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm mt-1"
              placeholder={t("app.appts.siteAddress")}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresSupervisor}
              onChange={(e) =>
                setForm({ ...form, requiresSupervisor: e.target.checked })
              }
            />
            {t("app.appts.supervisorHint")}
          </label>

          <div>
            <label className="text-sm text-muted-foreground">{t("app.appts.assignTo")}</label>
            <select
              value={form.assignedToId}
              onChange={(e) =>
                setForm({ ...form, assignedToId: e.target.value })
              }
              className="w-full border rounded px-3 py-2 text-sm mt-1 bg-card"
            >
              <option value="">{t("app.appts.unassigned")}</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60 w-full mt-2"
          >
            {saving ? "Creating..." : "Create Appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}
