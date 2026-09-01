// app/app/jobs/[id]/edit/page.js
//
// Edit a job's own fields — title, status, recurrence, and the work's own
// start/end dates.
//
// Small on purpose. A Job is a container; most of the substance — assignment,
// checklists, photos — lives on its JobVisits, which are edited from the job
// detail page. Anything that looks like it belongs here but isn't is a sign it
// should be a visit-level control instead. Dates are the one exception: a
// visit is a trip to the address, and a lot of real jobs — a two-week repaint
// with no site visit of its own — have a start and end but no trip to date.
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { validateJobDates } from "@/lib/jobs/validateJobDates";

// Includes `unscheduled` — the state auto-created jobs start in — so the
// dropdown can represent (and not silently overwrite) it.
const STATUSES = ["unscheduled", "scheduled", "in_progress", "completed", "cancelled"];

export default function EditJobPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const router = useRouter();

  const [job, setJob] = useState(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) throw new Error(t("app.jobEdit.loadError"));
        const data = await res.json();
        if (cancelled) return;
        setJob(data);
        setTitle(data.title || "");
        setStatus(data.status || "scheduled");
        setRecurring(Boolean(data.recurring));
        setRecurrenceRule(data.recurrenceRule || "");
        // yyyy-mm-dd, what a <input type="date"> reads and writes — the same
        // slice used everywhere else in this codebase a calendar-date column
        // feeds a plain date input (e.g. the invoice edit page's dueDate).
        setStartDate(
          data.startDate ? new Date(data.startDate).toISOString().slice(0, 10) : "",
        );
        setEndDate(
          data.endDate ? new Date(data.endDate).toISOString().slice(0, 10) : "",
        );
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Same rule the API enforces (lib/jobs/validateJobDates.js) — checked here
  // too so a bad combination reads as a message next to the fields instead of
  // a round trip to find out. The server is still the one that actually
  // decides: this is a courtesy, not the guard.
  const dateCheck = validateJobDates({
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
  });

  async function save() {
    if (!dateCheck.ok) {
      setError(dateCheck.error);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status,
          recurring,
          // Clearing the checkbox clears the rule too. Leaving a stale rule
          // behind means re-ticking the box silently resurrects a schedule
          // nobody remembers setting.
          recurrenceRule: recurring ? recurrenceRule.trim() || null : null,
          // "" clears the field server-side (lib/jobs/validateJobDates.js
          // parseDateOrNull) — sent as-is rather than coerced to null/undefined
          // here, so clearing a date is indistinguishable from never touching
          // this screen only when the value truly didn't change.
          startDate,
          endDate,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.jobEdit.saveError"));
      router.push(`/app/jobs/${id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  if (!job)
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5 text-sm text-red-700 dark:text-red-300">
          {error || t("app.jobEdit.notFound")}
        </div>
      </div>
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href={`/app/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> {t("app.jobEdit.backToJob")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.jobEdit.editJob")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{job.client?.name}</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("app.jobEdit.title")}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("app.jobEdit.dates", "Work dates")}
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            {t(
              "app.jobEdit.datesHint",
              "Optional — the start and end of the work itself, separate from any site visits.",
            )}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card"
              aria-label={t("app.jobEdit.startDate", "Start date")}
            />
            <span className="text-muted-foreground text-sm">
              {t("app.jobEdit.dateRangeTo", "to")}
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              // An end date makes no sense without a start — matches the API
              // (lib/jobs/validateJobDates.js) rather than only hinting at it.
              disabled={!startDate}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-50"
              aria-label={t("app.jobEdit.endDate", "End date")}
            />
          </div>
          {!dateCheck.ok && (startDate || endDate) && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
              {dateCheck.error}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t("app.jobEdit.status")}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            {t("app.jobEdit.repeats")}
          </label>

          {recurring && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("app.jobEdit.howOften")}
              </label>
              {/* A constrained select, matching jobs/new — the recurring-visit
                  cron only understands weekly/biweekly/monthly, so free text
                  ("every 2 weeks") would save fine and then silently generate no
                  next visit. Reuses the jobNew option keys. */}
              <select
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">{t("app.jobNew.selectFrequency")}</option>
                <option value="weekly">{t("app.jobNew.weekly")}</option>
                <option value="biweekly">{t("app.jobNew.biweekly")}</option>
                <option value="monthly">{t("app.jobNew.monthly")}</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving || !title.trim() || !dateCheck.ok}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t("app.jobEdit.saveChanges")}
        </button>
        <Link
          href={`/app/jobs/${id}`}
          className="border border-border text-foreground px-5 py-2.5 rounded-full text-sm font-semibold"
        >
          {t("app.action.cancel")}
        </Link>
      </div>
    </div>
  );
}
