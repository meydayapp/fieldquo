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

const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"];

export default function EditJobPage() {
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
        if (!res.ok) throw new Error("Couldn't load this job.");
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
      if (!res.ok) throw new Error(data?.error || "Couldn't save.");
      router.push(`/app/jobs/${id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse h-64 bg-gray-200 rounded-xl" />
    );

  if (!job)
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
          {error || "Job not found."}
        </div>
      </div>
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href={`/app/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> Back to job
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit job</h1>
        <p className="text-sm text-gray-500 mt-1">{job.client?.name}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            This job repeats
          </label>

          {recurring && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                How often
              </label>
              <input
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value)}
                placeholder="Every 2 weeks"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              {/* Honest about what this does today. Nothing reads
                  recurrenceRule to generate visits automatically yet, so
                  promising a schedule would be a lie. */}
              <p className="text-xs text-gray-400 mt-1">
                A note for your team — visits still get added by hand from the
                job page.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save changes
        </button>
        <Link
          href={`/app/jobs/${id}`}
          className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-full text-sm font-semibold"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
