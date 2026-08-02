// app/app/jobs/[id]/edit/page.js
//
// Edit a job's own fields — title, status, recurrence.
//
// Small on purpose. A Job is a container; the substance (scheduling,
// assignment, checklists, photos) lives on its JobVisits, which are edited
// from the job detail page. Anything that looks like it belongs here but
// isn't is a sign it should be a visit-level control instead.
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"];

export default function EditJobPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const router = useRouter();

  const [job, setJob] = useState(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");

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

  async function save() {
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
          disabled={saving || !title.trim()}
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
