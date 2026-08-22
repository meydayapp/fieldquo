// app/(app)/appointments/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchJson } from "@/lib/fetchJson";
import { travelLegs, describeTravel } from "@/lib/booking/travel";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

import { useTranslation } from "@/app/hooks/useTranslation";
const STATUS_STYLES = {
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  needs_supervisor: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  completed: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

/**
 * A LOCAL calendar day key.
 *
 * Deliberately not isoDateOnly() from lib/format/companyDate: that reads its
 * getters in UTC because it exists for date-only values (a leave date, a pay
 * period). An appointment is an instant, and 8pm Monday in Toronto is Tuesday
 * in UTC — grouping by the UTC day would file the last visit of most evenings
 * under tomorrow. Two kinds of value, two functions, on purpose.
 */
function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The cells of a month grid, including the leading and trailing days that fill
 * out the first and last weeks.
 *
 * Built from the (year, month, day) constructor rather than by adding
 * milliseconds, so the days it produces are local midnights and a DST weekend
 * doesn't shunt half the month by an hour.
 *
 * @param weekStartsOn 0 = Sunday, 1 = Monday — the company's setting.
 */
function monthGrid(anchor, weekStartsOn) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const lead = (new Date(y, m, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => new Date(y, m, 1 - lead + i));
}

/**
 * Intl with the app's interface language, falling back to the browser's.
 *
 * Every language code the app offers is a well-formed tag, so this can't throw
 * in practice — but a formatter that throws would take out the whole calendar,
 * and an unstyled crash is a much worse outcome than a weekday name in the
 * wrong language.
 */
function localeFormat(date, language, opts) {
  try {
    return date.toLocaleDateString(language || undefined, opts);
  } catch {
    return date.toLocaleDateString(undefined, opts);
  }
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
  const [appointments, setAppointments] = useState([]);
  const [members, setMembers] = useState([]);
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

  useEffect(() => {
    // Was a bare Promise.all(...).then(): if either request 500'd, r.json()
    // threw, the .then never ran, and setLoading(false) never fired — the page
    // sat on its skeleton forever with nothing to report.
    (async () => {
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
    })();
  }, []);

  // Status-filtered, and the source for BOTH surfaces. A calendar showing
  // cancelled visits the list below has hidden would have the two disagreeing
  // about what's booked, on the same screen.
  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) => a.status === filter);

  const legs = useMemo(() => legsByAppointment(appointments), [appointments]);

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
        {["all", "scheduled", "needs_supervisor", "completed", "cancelled"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm border ${
                filter === s
                  ? "bg-inverted text-inverted-foreground border-inverted"
                  : "border-border"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ),
        )}
      </div>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">{error}</p>
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
              className="p-1.5 rounded-lg border border-border hover:bg-muted"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setMonthAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
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
              className="p-1.5 rounded-lg border border-border hover:bg-muted"
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
                          className={`block truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                            STATUS_STYLES[a.status] || "bg-muted"
                          }`}
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
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
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

      {!loading && shown.length === 0 && (
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
          return (
          <div key={appt.id}>
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
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">
                    {appt.client?.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      STATUS_STYLES[appt.status] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {String(appt.status || "scheduled").replace("_", " ")}
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
                  {appt.requiresSupervisor && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                      <ShieldAlert size={12} />{t("app.appts.supervisorRequired")}</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {new Date(appt.scheduledAt).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                {appt.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate">{appt.location}</span>
                  </div>
                )}
              </div>

              {/* A visit's id is a JobVisit id — PATCHing it against
                  /api/appointments/[id] would 404. Rather than render a select
                  that silently fails, visits show who is assigned and link to
                  the job, which is where a visit is actually rescheduled. */}
              {appt.kind === "visit" ? (
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserIcon size={14} />
                    {appt.assignedTo?.name || t("app.appts.unassigned")}
                  </span>
                  {appt.jobId && (
                    <Link
                      href={`/app/jobs/${appt.jobId}`}
                      className="text-sm font-medium underline underline-offset-2 shrink-0"
                    >
                      {t("app.appts.openJob")}
                    </Link>
                  )}
                </div>
              ) : (
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
              )}
            </div>
          </div>
          </div>
          );
        })}
      </div>

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
          <h2 className="font-semibold">New Appointment</h2>
          <button onClick={onClose} className="text-muted-foreground">
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
