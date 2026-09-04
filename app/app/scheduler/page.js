"use client";

// app/app/scheduler/page.js
//
// Shift scheduling. Managers draft shifts for the week and publish them; workers
// see only their own published shifts. Day-grouped rather than a worker×day grid
// so it stays readable on a phone. Pure scheduling — no pay, no money.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  CalendarDays,
  Send,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // Sunday
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SchedulerPage() {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // { dateStr } when adding
  const [shiftNotice, setShiftNotice] = useState(null); // warnings from the last save

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // ── A week that failed to load is not a week with no shifts ────────────
  //
  // This returned early on a non-ok response and left `data` untouched, which
  // produced two different wrong screens depending on when it failed:
  //
  //   * On the first load, `data` stayed null and all seven day cards rendered
  //     "No shifts scheduled." A rota that could not be fetched read as a rota
  //     nobody had written.
  //   * On week navigation, `weekStart` and the date headings advanced while
  //     `data` kept the PREVIOUS week's shifts — so last Tuesday's crew was
  //     drawn under next Tuesday's date. Silently wrong data is worse than an
  //     empty state, because nothing about it looks wrong.
  //
  // `setData(null)` closes the second and the error key closes the first.
  const load = useCallback(async () => {
    const result = await fetchList(
      `/api/shifts?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`,
    );
    if (result.aborted) return;
    if (!result.ok) {
      setData(null);
      setErrorKey(result.errorKey);
      return;
    }
    setErrorKey("");
    setData(result.data);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // `manager` comes from the API and means user:view — "may see the whole
  // rota". It is the right gate for READING everyone's week: the subtitle and
  // the missing-hours reminder below both stay on it.
  const isManager = data?.manager;
  const caller = usePermissions();
  // ── Reading the rota and writing it are different questions ──────────────
  //
  // Add shift and Publish week were both gated on `isManager` — user:view —
  // while POST /api/shifts and POST /api/shifts/publish each require
  // schedule at edit_all. A supervisor whose schedule dial is set to view_own
  // or edit_own still holds user:view, so they got the Add button, the modal,
  // the whole-company worker dropdown, typed a shift, and lost it to
  // "You can only change your own schedule."
  //
  // The file already asked this question properly for DELETE (below) and never
  // carried it across to the two controls that create. Same grid, same level
  // the routes ask, asked here too.
  const canEditSchedule = hasLevel(caller, "schedule", "edit_all");
  // DELETE /api/shifts/[id] asks a narrower question again: edit_delete_all,
  // the level above the one the Dispatcher preset grants. So a Dispatcher
  // drafted and published a week and was also shown a ✕ that could only 403.
  const canDeleteShift = hasLevel(caller, "schedule", "edit_delete_all");
  const shiftsByDay = useMemo(() => {
    const map = {};
    for (const s of data?.shifts || []) {
      const k = ymd(new Date(s.start));
      (map[k] ||= []).push(s);
    }
    return map;
  }, [data]);

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch("/api/shifts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: weekStart.toISOString(),
          to: weekEnd.toISOString(),
        }),
      });
      if (!res.ok)
        return reportResponseError(
          res,
          t("app.scheduler.publishError", "Couldn't publish."),
        );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeShift(id) {
    const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    if (!res.ok) return reportResponseError(res);
    await load();
  }

  const weekLabel = `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString([], { month: "short", day: "numeric" })}`;
  const anyDraft = (data?.shifts || []).some((s) => !s.published);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">
            {t("app.scheduler.title")}
          </h1>
        </div>
        {isManager && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "app.scheduler.managerSubtitle",
              "Add shifts for the week, then Publish so your team can see them — shifts stay hidden until you publish.",
            )}
          </p>
        )}
      </div>

      {/* Week nav */}
      <div
        data-tour="scheduler-week"
        className="flex items-center justify-between gap-2 mb-4"
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-2 rounded-lg border border-border hover:bg-muted"
            aria-label={t("app.scheduler.prevWeek", "Previous week")}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            {t("app.scheduler.thisWeek")}
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-2 rounded-lg border border-border hover:bg-muted"
            aria-label={t("app.scheduler.nextWeek", "Next week")}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-sm font-semibold text-foreground">
          {weekLabel}
        </span>
      </div>

      {/* Gated on canEditSchedule, not isManager — POST /api/shifts and
          POST /api/shifts/publish both require schedule at edit_all, and
          isManager only means user:view. See the comment above the two
          constants. */}
      {canEditSchedule && (
        <div className="flex items-center gap-2 mb-4">
          <button
            data-tour="scheduler-add"
            onClick={() =>
              setModal({
                dateStr: ymd(
                  new Date() >= weekStart && new Date() < weekEnd
                    ? new Date()
                    : weekStart,
                ),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2"
          >
            <Plus size={15} /> {t("app.scheduler.addShift")}
          </button>
          {anyDraft && (
            <button
              onClick={publish}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {t("app.scheduler.publishWeek")}
            </button>
          )}
        </div>
      )}

      {/* ── Who has no usual hours set ──────────────────────────────────────
          A worker with no WorkingHours has no pattern, so nothing warns when
          they are scheduled at an odd time and payroll has no baseline to
          sanity-check their logged time against. The rota is where somebody
          notices, so the reminder lives here rather than on a settings screen
          nobody opens.

          Named, not counted. "3 people are missing hours" sends someone
          hunting; the names send them straight there. */}
      {isManager && data?.missingHours?.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-amber-900 dark:text-amber-200">
            No working hours set for{" "}
            <strong>{data.missingHours.map((w) => w.name).join(", ")}</strong>.
            Until they have some, nothing flags a shift at an odd hour for them
            and payroll has nothing to check their logged time against.
          </p>
          <Link
            href="/app/settings/availability"
            className="mt-1 inline-block text-xs font-medium text-amber-900 underline dark:text-amber-200"
          >
            Set their hours
          </Link>
        </div>
      )}

      {/* Created, and worth a word: the shift is outside this person's usual
          pattern. Not an error — that is what an extra day or an early start
          IS — but a mistyped hour looks exactly the same, and only the manager
          can tell the two apart. */}
      {shiftNotice && (
        <div className="mb-3 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          Shift added. {shiftNotice.join(" ")}
        </div>
      )}

      {errorKey ? (
        /* The week could not be read. Seven cards saying "No shifts
           scheduled." would be seven claims nobody made — and on a week that
           was navigated to, the cards would carry the PREVIOUS week's shifts
           under the new dates. One panel, one sentence, one retry. */
        <ListState loading={false} isEmpty={false} errorKey={errorKey} onRetry={load}>
          {null}
        </ListState>
      ) : loading ? (
        <div className="min-h-[30vh] grid place-items-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day) => {
            const key = ymd(day);
            const list = (shiftsByDay[key] || []).sort(
              (a, b) => new Date(a.start) - new Date(b.start),
            );
            const isToday = ymd(new Date()) === key;
            return (
              <div
                key={key}
                className={`rounded-xl border bg-card p-4 ${isToday ? "border-foreground/40" : "border-border"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-foreground">
                    {day.toLocaleDateString([], {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                    {isToday && (
                      <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {t("app.scheduler.today")}
                      </span>
                    )}
                  </h3>
                  {/* Same route, same level. This one is also a 44px target
                      now: it was a bare 16px icon with no padding, and it is
                      the fastest way to add a shift to a given day. */}
                  {canEditSchedule && (
                    <button
                      type="button"
                      onClick={() => setModal({ dateStr: key })}
                      className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={t("app.scheduler.addShift")}
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
                {!list.length ? (
                  <p className="text-sm text-muted-foreground">
                    {t("app.scheduler.noShifts")}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {list.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {fmtTime(s.start)} – {fmtTime(s.end)}
                            {isManager && s.worker?.name
                              ? ` · ${s.worker.name}`
                              : ""}
                          </div>
                          {(s.job?.title || s.note) && (
                            <div className="text-xs text-muted-foreground truncate">
                              {[s.job?.title, s.note]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                          {/* The worker sees this on their OWN shift. That is
                              the point of recording it rather than confirming
                              it in a dialog: they were scheduled outside what
                              they said they were available for, and they should
                              learn it here, not on the morning. */}
                          {s.availabilityOverrideAt && (
                            <div className="text-xs text-amber-700 dark:text-amber-400">
                              Outside stated availability
                              {s.availabilityOverrideBy?.name
                                ? ` · ${s.availabilityOverrideBy.name}`
                                : ""}
                              {s.availabilityOverrideNote
                                ? ` — ${s.availabilityOverrideNote}`
                                : ""}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!s.published && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                              {t("app.scheduler.draft")}
                            </span>
                          )}
                          {isManager && canDeleteShift && (
                            <button
                              onClick={() => removeShift(s.id)}
                              className="text-muted-foreground hover:text-red-600"
                              aria-label={t("app.action.delete")}
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isManager && !loading && (
        <p className="mt-4 text-xs text-muted-foreground">
          {t("app.scheduler.workerNote")}
        </p>
      )}

      {modal && isManager && (
        <AddShiftModal
          dateStr={modal.dateStr}
          workers={data.workers}
          onClose={() => setModal(null)}
          onSaved={async (warnings) => {
            setModal(null);
            setShiftNotice(warnings?.length ? warnings : null);
            await load();
          }}
          t={t}
        />
      )}
    </div>
  );
}

function AddShiftModal({ dateStr, workers, onClose, onSaved, t }) {
  const [workerId, setWorkerId] = useState(workers?.[0]?.id || "");
  const [date, setDate] = useState(dateStr);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  // A refusal belongs INSIDE the modal, beside the time fields that caused it.
  // Sent to the global toast instead, it would vanish while the manager was
  // still looking at the wrong times with no idea which number to change.
  const [refusal, setRefusal] = useState(null);
  // A reason for going ahead anyway. Optional — an emergency should not be
  // gated on typing — but offered, because the record is worth reading later.
  const [overrideNote, setOverrideNote] = useState("");

  // ── `override === true`, not `Boolean(override)` ─────────────────────────
  //
  // "Add to draft" wired this as `onClick={save}`, so React passed the CLICK
  // EVENT as `override` — a default parameter only fires for `undefined`, and
  // an event is not undefined. The event was truthy, so `override || undefined`
  // put a React synthetic event in the request body and JSON.stringify threw
  // "Converting circular structure to JSON" (Safari: "cannot serialize cyclic
  // structures"). No fetch was ever made: the primary Add-to-draft button on
  // the scheduler could not create a shift at all.
  //
  // Same defect, same shape, as the quote page's Send button. The call site is
  // fixed too; this guard stays because the next person to wire a handler
  // straight to onClick will make the same mistake and the failure it produces
  // names nothing about where it came from.
  async function save(overrideArg = false) {
    const override = overrideArg === true;
    if (!workerId || end <= start) return;
    setSaving(true);
    if (!override) setRefusal(null);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          start: new Date(`${date}T${start}`).toISOString(),
          end: new Date(`${date}T${end}`).toISOString(),
          note: note.trim() || undefined,
          override: override || undefined,
          overrideNote:
            override && overrideNote.trim() ? overrideNote.trim() : undefined,
        }),
      });
      if (!res.ok) {
        // 409 is the fit check: this person is not available, or is on
        // approved leave. It has reasons worth reading, unlike a 500.
        const body = await res.json().catch(() => null);
        if (res.status === 409 && body?.blocks?.length) {
          // canOverride false is approved leave — a decision the company
          // already made and honoured. There is no "anyway" button for it, and
          // offering one would be offering to break a promise.
          setRefusal({
            reasons: body.blocks,
            canOverride: Boolean(body.canOverride),
          });
          return;
        }
        return reportResponseError(
          res,
          t("app.scheduler.saveError", "Couldn't save the shift."),
        );
      }
      // Warnings are not refusals — the shift was created. Passed up so the
      // manager is told it is outside this person's usual pattern, which is
      // how a mistyped hour reads as a mistyped hour.
      const body = await res.json().catch(() => null);
      await onSaved(body?.warnings || []);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">
            {t("app.scheduler.newShift")}
          </h2>
          <button onClick={onClose} aria-label={t("app.action.close")}>
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          {refusal && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                refusal.canOverride
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              }`}
            >
              {refusal.reasons.map((r) => (
                <p key={r}>{r}</p>
              ))}

              {refusal.canOverride ? (
                <>
                  <p className="mt-1.5 font-medium">
                    Check with them before you go ahead — they won&apos;t have
                    agreed to this yet.
                  </p>
                  <input
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    placeholder="Why? (optional — goes on the shift)"
                    className="mt-1.5 w-full rounded border border-amber-300 bg-background px-2 py-1 text-xs dark:border-amber-800"
                  />
                  <button
                    type="button"
                    onClick={() => save(true)}
                    disabled={saving}
                    className="mt-1.5 rounded bg-amber-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    Schedule anyway
                  </button>
                  <p className="mt-1 opacity-80">
                    It will be marked on the shift, and they&apos;ll see that
                    when it&apos;s published.
                  </p>
                </>
              ) : (
                // Approved leave. No override, and the way out is named rather
                // than left for someone to hunt for.
                <p className="mt-1.5 opacity-90">
                  Change the date, or amend their time off first.
                </p>
              )}
            </div>
          )}
          <label className="block">
            <span className="text-xs text-muted-foreground">
              {t("app.scheduler.worker")}
            </span>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {(workers || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">
              {t("app.scheduler.date")}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="text-xs text-muted-foreground">
                {t("app.scheduler.start")}
              </span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block flex-1">
              <span className="text-xs text-muted-foreground">
                {t("app.scheduler.end")}
              </span>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground">
              {t("app.scheduler.noteOptional")}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("app.scheduler.notePlaceholder")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          {end <= start && (
            <p className="text-xs text-red-600">
              {t("app.scheduler.endAfterStart")}
            </p>
          )}
          <button
            // Wrapped, not passed. `onClick={save}` handed save the click event
            // as its `override` argument — see the note on save().
            onClick={() => save()}
            disabled={saving || !workerId || end <= start}
            className="w-full rounded-lg bg-inverted text-inverted-foreground py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? t("app.action.saving") : t("app.scheduler.addToDraft")}
          </button>
        </div>
      </div>
    </div>
  );
}
