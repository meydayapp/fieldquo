// app/app/settings/availability/page.js
//
// Two different weeks, on purpose, on one screen:
//
//   Working hours   — your shift. Internal: scheduling and timesheets use it.
//   Bookable hours  — when clients may book you. Public: the booking calendar
//                     and the website read it.
//
// They are genuinely different. An estimator works 8–4 but only takes
// consultations 2–4 because mornings are on site. One field can't express that,
// and guessing produces either clients booking over site work or payroll
// thinking someone is part-time. So both are here, side by side, with the
// relationship stated — and the page warns when the bookable window falls
// outside the shift, because that's usually a mistake.
"use client";

import { useCallback, useState, useEffect } from "react";
import { Loader2, Check, AlertTriangle, Clock, CalendarCheck } from "lucide-react";
import { orderedWeekdays } from "@/lib/format/companyDate";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useSession } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const DEFAULTS = { startTime: "08:00", endTime: "16:00" };

// One editable week. Mobile-first: each row stacks under `sm` so the time
// inputs never squeeze off the side of a phone.
function WeekEditor({ rows, setRows, weekStartsOn, accentClass }) {
  const { t } = useTranslation();
  const get = (d) => rows.find((r) => r.dayOfWeek === d);

  function toggle(dayOfWeek) {
    setRows((prev) =>
      prev.some((r) => r.dayOfWeek === dayOfWeek)
        ? prev.filter((r) => r.dayOfWeek !== dayOfWeek)
        : [...prev, { dayOfWeek, ...DEFAULTS, timezone: "America/Toronto" }],
    );
  }
  function update(dayOfWeek, field, value) {
    setRows((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r)),
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {orderedWeekdays(weekStartsOn).map(({ label, index: dayOfWeek }) => {
        const day = get(dayOfWeek);
        const invalid = day && day.endTime <= day.startTime;
        return (
          <div
            key={dayOfWeek}
            className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
          >
            <label className="flex items-center gap-2.5 sm:w-32 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={!!day}
                onChange={() => toggle(dayOfWeek)}
                className={`h-4 w-4 ${accentClass}`}
              />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </label>
            {day ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="time"
                  value={day.startTime}
                  onChange={(e) => update(dayOfWeek, "startTime", e.target.value)}
                  className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                />
                <span className="text-muted-foreground text-sm">{t("app.setAvailability.to", "to")}</span>
                <input
                  type="time"
                  value={day.endTime}
                  onChange={(e) => update(dayOfWeek, "endTime", e.target.value)}
                  className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                />
                {invalid && (
                  <span className="text-xs text-red-600">{t("app.setAvailability.endAfterStart", "End must be after start")}</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{t("app.setAvailability.notScheduled", "Not scheduled")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AvailabilityPage() {
  const { t } = useTranslation();
  const { weekStartsOn } = useCompanyPreferences();
  const { data: session } = useSession();
  const [bookable, setBookable] = useState([]);
  const [working, setWorking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Whose hours ──────────────────────────────────────────────────────────
  //
  // This page only ever edited your own, which meant an owner could not set
  // their crew's hours from anywhere in the product — and someone who never
  // signs in never became bookable. The team list only loads for a manager
  // (the request 403s otherwise), so the picker appears exactly when it works
  // rather than being shown and then failing.
  const [team, setTeam] = useState([]);
  const [meId, setMeId] = useState(null);
  const [targetId, setTargetId] = useState(null);

  // Deep link from the schedule page: ?userId=<id>
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("userId");
    if (q) setTargetId(q);
  }, []);

  useEffect(() => {
    fetch("/api/settings/members")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setTeam(Array.isArray(rows) ? rows.filter((m) => m.active !== false) : []))
      .catch(() => setTeam([]));
  }, []);

  // Who am I — from the Better Auth session store, not a bespoke /api/me. That
  // endpoint doesn't exist, and adding one to answer a question the session
  // already answers is how a codebase grows two sources of identity.
  useEffect(() => {
    if (session?.user?.id) setMeId(session.user.id);
  }, [session]);

  const load = useCallback((userId) => {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    setLoading(true);
    return Promise.all([
      fetch(`/api/availability${q}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/working-hours${q}`).then((r) => (r.ok ? r.json() : { workingHours: [] })),
    ])
      .then(([avail, work]) => {
        setBookable(Array.isArray(avail) ? avail : []);
        setWorking(Array.isArray(work?.workingHours) ? work.workingHours : []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(targetId);
  }, [load, targetId]);

  // Warn where the public booking window sits outside the shift — clients could
  // book someone who isn't working. Not blocked (a company may genuinely want
  // it) but never silent.
  const mismatches = working.length
    ? bookable
        .map((b) => {
          const shift = working.find((w) => w.dayOfWeek === b.dayOfWeek);
          if (!shift) return { dayOfWeek: b.dayOfWeek, reason: t("app.setAvailability.reasonNotScheduled", "you're not scheduled to work") };
          if (b.startTime < shift.startTime || b.endTime > shift.endTime) {
            return {
              dayOfWeek: b.dayOfWeek,
              reason: t("app.setAvailability.reasonOutsideShift", "outside your {start}–{end} shift", { start: shift.startTime, end: shift.endTime }),
            };
          }
          return null;
        })
        .filter(Boolean)
    : [];

  const dayName = (i) =>
    orderedWeekdays(weekStartsOn).find((d) => d.index === i)?.label || `Day ${i}`;

  const anyInvalid = [...bookable, ...working].some((r) => r.endTime <= r.startTime);

  // A manager sees the picker; everyone else doesn't, because for them it would
  // list one name and do nothing. `team.length > 1` rather than a role check:
  // the members endpoint is the thing that actually gates this, so agreeing with
  // it means the control can't appear where the save would 403.
  const canPickPerson = team.length > 1;
  const editingSomeoneElse = Boolean(targetId && targetId !== meId);
  const targetName =
    team.find((m) => m.userId === targetId)?.user?.name ||
    team.find((m) => m.userId === targetId)?.user?.email ||
    t("app.setAvailability.thisPerson", "This person");

  async function handleSave() {
    if (anyInvalid) {
      showError(t("app.setAvailability.fixTimes", "Fix the highlighted times — each day needs a start before its end."));
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        fetchJson("/api/availability", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // Only sent when editing someone else. Omitted for your own hours so
          // the route's "self" path stays the default and needs no permission.
          body: JSON.stringify({ schedules: bookable, ...(targetId ? { userId: targetId } : {}) }),
        }),
        fetchJson("/api/working-hours", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedules: working, ...(targetId ? { userId: targetId } : {}) }),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      showError(err.message || t("app.setAvailability.saveError", "Could not save"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-8 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {editingSomeoneElse ? t("app.setAvailability.personHours", "{name}'s hours", { name: targetName }) : t("app.setAvailability.yourHours", "Your hours")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {editingSomeoneElse ? t("app.setAvailability.their", "Their") : t("app.setAvailability.your", "Your")} {t("app.setAvailability.shiftAnd", "shift and")}{" "}
          {editingSomeoneElse ? t("app.setAvailability.theirLower", "their") : t("app.setAvailability.yourLower", "your")}{" "}
          {t("app.setAvailability.bookableSeparate", "bookable window are separate. They might work 8–4 but only take client bookings 2–4 — set both here.")}
        </p>
      

        {canPickPerson && (
          <label className="block mt-4">
            <span className="text-xs font-semibold text-muted-foreground block mb-1">
              {t("app.setAvailability.whoseHours", "Whose hours")}
            </span>
            <select
              value={targetId || meId || ""}
              onChange={(e) => setTargetId(e.target.value || null)}
              className="w-full sm:w-72 border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              {team.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name || m.user?.email}
                  {m.userId === meId ? t("app.setAvailability.youSuffix", " (you)") : ""}
                </option>
              ))}
            </select>
            {editingSomeoneElse && (
              <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-400">
                {t("app.setAvailability.editingWarning", "You're editing someone else's hours. They'll see the change on their own schedule.")}
              </span>
            )}
          </label>
        )}
</div>

      <section data-tour="avail-working">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-1">
          <Clock size={15} className="text-muted-foreground" /> {t("app.setAvailability.workingHours", "Working hours")}
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          {t("app.setAvailability.workingHint", "Your shift. Used for scheduling and timesheets. Never shown to clients.")}
        </p>
        <WeekEditor
          rows={working}
          setRows={setWorking}
          weekStartsOn={weekStartsOn}
          accentClass="accent-neutral-600"
        />
      </section>

      <section data-tour="avail-bookable">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-1">
          <CalendarCheck size={15} className="text-muted-foreground" /> {t("app.setAvailability.bookableHours", "Bookable hours")}
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          {t("app.setAvailability.bookableHint", "When clients can book you on your public calendar and website. Usually a narrower window than your shift.")}
        </p>
        <WeekEditor
          rows={bookable}
          setRows={setBookable}
          weekStartsOn={weekStartsOn}
          accentClass="accent-blue-600"
        />
        {mismatches.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5">
            <p className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                {t("app.setAvailability.mismatchLead", "Clients could book you when you're not working:")}{" "}
                {mismatches.map((m) => `${dayName(m.dayOfWeek)} (${m.reason})`).join(", ")}
                {t("app.setAvailability.mismatchTail", ". That's allowed — just check it's intentional.")}
              </span>
            </p>
          </div>
        )}
        {bookable.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("app.setAvailability.noBookable", "With no bookable hours you won't appear as an option on your company's booking page.")}
          </p>
        )}
      </section>

      {/* Sticky save — on a phone the button would otherwise sit below two
          full weeks of inputs. */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-64 bg-card border-t border-border px-4 py-3 flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1.5">
            <Check size={15} /> {t("app.action.saved", "Saved")}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t("app.setAvailability.saveHours", "Save hours")}
        </button>
      </div>
    </div>
  );
}
