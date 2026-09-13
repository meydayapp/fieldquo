"use client";

// app/app/scheduler/ShiftModal.js
//
// One modal for a shift, new or existing, used by the week list and the day
// board. It was AddShiftModal inside page.js; it moved out when the day board
// needed an EDIT form with lunch and breaks, because a second copy of the
// availability-refusal handling below is the copy that would forget approved
// leave is not overridable.
//
// Breaks are edited as HH:MM on the shift's date and sent as instants. The
// server is the judge (lib/shifts/coverage.js validateBreaks, run by both
// routes); the same function runs here first so the manager sees "two breaks
// overlap" beside the rows rather than as a refused save.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Trash2, X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { midpointLunch, validateBreaks } from "@/lib/shifts/coverage";
import { orderedWeekdayNames } from "@/lib/format/localeDate";
import { weekDatesAround } from "@/lib/shifts/weekDates";

const pad = (n) => String(n).padStart(2, "0");
const hhmmOf = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const ymdOf = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const localIso = (date, hhmm) => new Date(`${date}T${hhmm}`).toISOString();

/**
 * "Dubois · 12 rue Principale, Laval · Kitchen repaint" for the picker and
 * the block. The SITE address only: a job whose site was never asked for
 * shows client and title and no street, rather than the billing address
 * the schema warns against sending a crew to.
 */
export function jobLabel(job) {
  if (!job) return "";
  const where = [job.siteAddress, job.siteCity].filter(Boolean).join(", ");
  return [job.client?.name, where, job.title].filter(Boolean).join(" · ");
}

/**
 * @param shift     existing shift (with `breaks` as ISO rows) to edit, or null
 * @param initial   for a new shift: { workerId, dateStr, start, end } (HH:MM)
 * @param workers   the manager's dropdown; fixed when editing
 * @param jobs      open jobs for the picker
 * @param canDelete edit_delete_all — the ✕ the week list already gates on it
 */
export default function ShiftModal({
  shift = null,
  initial = {},
  workers,
  jobs = [],
  canDelete = false,
  onClose,
  onSaved,
  onDeleted,
  t,
  language = "en",
  weekStartsOn = 0,
}) {
  const editing = Boolean(shift?.id);
  // "" is nobody chosen yet; OPEN is an open shift (workerId null on the
  // wire — see Shift.workerId in the schema). Editing keeps whatever the
  // shift has, open included.
  const OPEN = "__open__";
  const [workerId, setWorkerId] = useState(
    shift ? (shift.workerId || OPEN) : initial.workerId === null ? OPEN : initial.workerId || workers?.[0]?.id || "",
  );
  const [label, setLabel] = useState(shift?.label || "");
  // "Apply to": the other weekdays of this week to create the same shift on.
  // The shift's own day is always included and cannot be toggled off. Only
  // when creating — an edit is one shift.
  const [applyTo, setApplyTo] = useState([]);
  const [date, setDate] = useState(
    shift ? ymdOf(shift.start) : initial.dateStr || "",
  );
  const [start, setStart] = useState(shift ? hhmmOf(shift.start) : initial.start || "09:00");
  const [end, setEnd] = useState(shift ? hhmmOf(shift.end) : initial.end || "17:00");
  const [jobId, setJobId] = useState(shift?.job?.id || "");
  const [note, setNote] = useState(shift?.note || "");
  const [breaks, setBreaks] = useState(() =>
    (shift?.breaks || []).map((b) => ({
      kind: b.kind === "lunch" ? "lunch" : "break",
      start: hhmmOf(b.start),
      end: hhmmOf(b.end),
      paid: b.paid === true,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // A refusal belongs INSIDE the modal, beside the time fields that caused it.
  // Sent to the global toast instead, it would vanish while the manager was
  // still looking at the wrong times with no idea which number to change.
  const [refusal, setRefusal] = useState(null);
  // A reason for going ahead anyway. Optional — an emergency should not be
  // gated on typing — but offered, because the record is worth reading later.
  const [overrideNote, setOverrideNote] = useState("");

  const timesOk = Boolean(date) && end > start;

  // The same check the server runs, on the same shape, so the sentence the
  // manager reads under the rows is the one the route would have sent back.
  const breaksVerdict = useMemo(() => {
    if (!timesOk) return { ok: true, breaks: [] };
    return validateBreaks(
      localIso(date, start),
      localIso(date, end),
      breaks.map((b) => ({
        start: localIso(date, b.start),
        end: localIso(date, b.end),
        kind: b.kind,
        paid: b.paid,
      })),
    );
  }, [breaks, date, start, end, timesOk]);

  function addBreak(kind) {
    setBreaks((list) => [...list, { kind, start, end: start, paid: kind !== "lunch" }]);
  }
  function addMidpointLunch() {
    if (!timesOk) return;
    const lunch = midpointLunch(localIso(date, start), localIso(date, end));
    if (!lunch) return;
    setBreaks((list) => [
      ...list,
      { kind: "lunch", start: hhmmOf(lunch.start), end: hhmmOf(lunch.end), paid: false },
    ]);
  }
  function updateBreak(i, patch) {
    setBreaks((list) => list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }
  function removeBreak(i) {
    setBreaks((list) => list.filter((_, j) => j !== i));
  }
  const canAddLunch =
    timesOk && Boolean(midpointLunch(localIso(date, start), localIso(date, end)));

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
    if (!workerId || !timesOk || !breaksVerdict.ok) return;
    setSaving(true);
    if (!override) setRefusal(null);
    try {
      const payload = {
        start: localIso(date, start),
        end: localIso(date, end),
        jobId: jobId || null,
        note: note.trim() || (editing ? "" : undefined),
        label: label.trim() || (editing ? "" : undefined),
        breaks: breaksVerdict.breaks,
        override: override || undefined,
        overrideNote:
          override && overrideNote.trim() ? overrideNote.trim() : undefined,
        ...(editing ? {} : { applyDays: applyTo.filter((d) => d !== date) }),
      };
      const res = await fetch(editing ? `/api/shifts/${shift.id}` : "/api/shifts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? payload : { workerId: workerId === OPEN ? null : workerId, ...payload }),
      });
      if (!res.ok) {
        // 409 is the fit check: this person is not available, or is on
        // approved leave. It has reasons worth reading, unlike a 500.
        const body = await res.json().catch(() => null);
        if (res.status === 409 && body?.blocks?.length) {
          // canOverride false is approved leave — a decision the company
          // already made and honoured. There is no "anyway" button for it, and
          // offering one would be offering to break a promise. With "Apply to"
          // the refusal names each day, so Friday's leave reads as Friday's.
          const perDay = Array.isArray(body.refused) && body.refused.length > 1
            ? body.refused.map((r) => `${r.date}: ${r.blocks.join(" ")}`)
            : body.blocks;
          setRefusal({
            reasons: perDay,
            canOverride: Boolean(body.canOverride),
          });
          return;
        }
        return reportResponseError(
          res,
          t("app.scheduler.saveError", "Couldn't save the shift."),
        );
      }
      // Warnings are not refusals — the shift was saved. Passed up so the
      // manager is told it is outside this person's usual pattern, which is
      // how a mistyped hour reads as a mistyped hour.
      const body = await res.json().catch(() => null);
      // Days that did not fit ride back as warnings, per day, so "Apply to
      // Mon–Fri" that wrote four days says which one it did not.
      const refusedLines = (body?.refused || []).map((r) => `${r.date}: ${r.blocks.join(" ")}`);
      await onSaved([...(body?.warnings || []), ...refusedLines]);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing || !canDelete) return;
    if (!window.confirm(t("app.scheduler.deleteConfirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" });
      if (!res.ok) return reportResponseError(res);
      await onDeleted?.();
    } finally {
      setDeleting(false);
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">
            {editing ? t("app.scheduler.editShift") : t("app.scheduler.newShift")}
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
                    {t("app.scheduler.checkFirst")}
                  </p>
                  <input
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    placeholder={t("app.scheduler.overrideWhy")}
                    className="mt-1.5 w-full rounded border border-amber-300 bg-background px-2 py-1 text-xs dark:border-amber-800"
                  />
                  <button
                    type="button"
                    onClick={() => save(true)}
                    disabled={saving}
                    className="mt-1.5 rounded bg-amber-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    {t("app.scheduler.scheduleAnyway")}
                  </button>
                  <p className="mt-1 opacity-80">
                    {t("app.scheduler.overrideMarked")}
                  </p>
                </>
              ) : (
                // Approved leave. No override, and the way out is named rather
                // than left for someone to hunt for.
                <p className="mt-1.5 opacity-90">
                  {t("app.scheduler.changeDateInstead")}
                </p>
              )}
            </div>
          )}
          <label className="block">
            <span className="text-xs text-muted-foreground">
              {t("app.scheduler.worker")}
            </span>
            {/* PATCH does not move a shift between people — the fit check,
                the override record and the published flag all belong to the
                person it was drafted for. Delete and re-add is the honest
                path, and the field says so by being fixed. */}
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              disabled={editing}
              className={`${field} disabled:opacity-70`}
            >
              {/* An OPEN shift: nobody yet. Claimed from the employee home
                  through the cover flow, assigned by a manager's approval. */}
              <option value={OPEN}>{t("app.scheduler.openShiftOption")}</option>
              {(workers || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
              {editing && workerId !== OPEN && !(workers || []).some((w) => w.id === workerId) && (
                <option value={workerId}>{shift?.worker?.name || "—"}</option>
              )}
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
              className={field}
            />
          </label>
          {/* ── Apply to ─────────────────────────────────────────────
              The same shift on other days of this week, one save. The
              server creates the days that fit in one transaction and names
              the ones that do not; see POST /api/shifts. */}
          {!editing && date ? (
            <div>
              <span className="text-xs text-muted-foreground">{t("app.scheduler.applyTo")}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {weekDatesAround(date, weekStartsOn).map((d) => {
                  const own = d.ymd === date;
                  const on = own || applyTo.includes(d.ymd);
                  const name = orderedWeekdayNames(weekStartsOn, language).find((n) => n.index === d.dow)?.label || "";
                  return (
                    <button
                      key={d.ymd}
                      type="button"
                      disabled={own}
                      aria-pressed={on}
                      onClick={() => setApplyTo((list) => (list.includes(d.ymd) ? list.filter((x) => x !== d.ymd) : [...list, d.ymd]))}
                      className={`min-h-[36px] rounded-lg border px-2 text-xs font-semibold ${on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"} disabled:opacity-100`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="text-xs text-muted-foreground">
                {t("app.scheduler.start")}
              </span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={field}
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
                className={field}
              />
            </label>
          </div>
          {end <= start && (
            <p className="text-xs text-red-600">
              {t("app.scheduler.endAfterStart")}
            </p>
          )}
          <label className="block">
            <span className="flex items-center justify-between text-xs text-muted-foreground">
              {t("app.scheduler.jobOptional")}
              {jobId && (
                <Link
                  href={`/app/jobs/${jobId}`}
                  className="inline-flex items-center gap-1 font-medium text-foreground underline"
                >
                  {t("app.scheduler.openJob")} <ExternalLink size={11} />
                </Link>
              )}
            </span>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className={field}
            >
              <option value="">{t("app.scheduler.noJob")}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {jobLabel(j)}
                </option>
              ))}
              {jobId && !jobs.some((j) => j.id === jobId) && (
                <option value={jobId}>{jobLabel(shift?.job)}</option>
              )}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">
              {t("app.scheduler.noteOptional")}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("app.scheduler.notePlaceholder")}
              className={field}
            />
          </label>
          {/* The role caption on the week grid's block — "Lead", "Helper".
              Free text; null shows the job's client instead. */}
          <label className="block">
            <span className="text-xs text-muted-foreground">
              {t("app.scheduler.labelOptional")}
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 40))}
              placeholder={t("app.scheduler.labelPlaceholder")}
              className={field}
            />
          </label>

          {/* ── Lunch and breaks ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                {t("app.scheduler.breaksHeading")}
              </span>
              <div className="flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  onClick={addMidpointLunch}
                  disabled={!canAddLunch}
                  title={!canAddLunch && timesOk ? t("app.scheduler.tooShortForLunch") : undefined}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  {t("app.scheduler.addMidLunch")}
                </button>
                <button
                  type="button"
                  onClick={() => addBreak("break")}
                  disabled={!timesOk}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  {t("app.scheduler.addBreak")}
                </button>
              </div>
            </div>
            {breaks.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("app.scheduler.noBreaks")}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {breaks.map((b, i) => (
                  <li key={i} className="flex flex-nowrap items-center gap-1.5">
                    <select
                      value={b.kind}
                      onChange={(e) => updateBreak(i, { kind: e.target.value })}
                      aria-label={t("app.scheduler.breakKind")}
                      className="w-[4.6rem] shrink-0 rounded-md border border-border bg-background px-1 py-1 text-xs"
                    >
                      <option value="lunch">{t("app.scheduler.lunch")}</option>
                      <option value="break">{t("app.scheduler.break")}</option>
                    </select>
                    <input
                      type="time"
                      value={b.start}
                      onChange={(e) => updateBreak(i, { start: e.target.value })}
                      aria-label={t("app.scheduler.start")}
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-1 py-1 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <input
                      type="time"
                      value={b.end}
                      onChange={(e) => updateBreak(i, { end: e.target.value })}
                      aria-label={t("app.scheduler.end")}
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-1 py-1 text-xs"
                    />
                    <label className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={b.paid}
                        onChange={(e) => updateBreak(i, { paid: e.target.checked })}
                      />
                      {t("app.scheduler.paidBreak")}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeBreak(i)}
                      aria-label={t("app.scheduler.removeBreak")}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!breaksVerdict.ok && (
              <p className="mt-2 text-xs text-red-600">
                {t("app.scheduler.breaksInvalid")}
              </p>
            )}
          </div>

          <button
            // Wrapped, not passed. `onClick={save}` handed save the click event
            // as its `override` argument — see the note on save().
            onClick={() => save()}
            disabled={saving || !workerId || !timesOk || !breaksVerdict.ok}
            className="w-full rounded-lg bg-inverted text-inverted-foreground py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving
              ? t("app.action.saving")
              : editing
                ? t("app.scheduler.saveShift")
                : t("app.scheduler.addToDraft")}
          </button>
          {editing && canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-300 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <Trash2 size={14} /> {t("app.scheduler.deleteShift")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
