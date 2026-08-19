// app/app/jobs/[id]/JobDetail.js
//
// Job detail: the page a crew opens on site. Structured around what someone
// standing in a driveway needs — who, where, when, what's left — rather than
// around the shape of the database record.
//
// Visits are the substance here. A Job is mostly a container; JobVisit is
// where scheduling, assignment, checklists and photos actually live, so the
// visit list is the main body rather than a footnote.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import JobPhotoCurator from "@/app/components/jobs/JobPhotoCurator";
import SuggestedTasks from "@/app/components/jobs/SuggestedTasks";
import VisitChecklist from "@/app/components/jobs/VisitChecklist";
import {
  ArrowLeft,
  Pencil,
  AlertCircle,
  Calendar,
  User,
  MapPin,
  Phone,
  Plus,
  FileText,
} from "lucide-react";

const STATUS_STYLES = {
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  in_progress: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  completed: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  cancelled: "bg-muted text-muted-foreground border-border",
};

// `unscheduled` included — it's where every auto-created job from an accepted
// quote lands, so omitting it made the <select> show "scheduled" for a job the
// badge above correctly called "unscheduled", and interacting silently flipped it.
const JOB_STATUSES = ["unscheduled", "scheduled", "in_progress", "completed", "cancelled"];

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function JobDetail({ jobId }) {
  const { t } = useTranslation();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(
          d?.error || (res.status === 404 ? "Job not found." : "Couldn't load."),
        );
      }
      setJob(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(status) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        // Surfaces the granular permission message rather than a generic
        // failure — "your access level doesn't allow you to edit jobs" tells
        // someone what to ask their manager for.
        throw new Error(d?.error || "Couldn't update status.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold">
            <AlertCircle size={18} /> {error || "Job not found."}
          </div>
          <Link
            href="/app/jobs"
            className="mt-3 inline-block text-sm text-red-700 dark:text-red-300 underline"
          >
            {t("app.job.backToJobs")}
          </Link>
        </div>
      </div>
    );
  }

  const completedVisits = job.visits?.filter(
    (v) => v.status === "completed",
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <Link
        href="/app/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} />{t("app.jobs.title")}</Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                STATUS_STYLES[job.status] ||
                "bg-muted text-muted-foreground border-border"
              }`}
            >
              {job.status?.replace(/_/g, " ")}
            </span>
          </div>
          {job.quote && (
            <p className="text-sm text-muted-foreground mt-1">
              From quote{" "}
              <Link
                href={`/app/quotes/${job.quote.id}`}
                className="underline hover:text-foreground"
              >
                {job.quote.quoteNumber}
              </Link>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            data-tour="job-status"
            value={job.status}
            disabled={busy}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-60"
          >
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Link
            href={`/app/jobs/${jobId}/edit`}
            className="inline-flex items-center gap-1.5 border border-border text-foreground px-3 py-2 rounded-lg text-sm font-semibold"
          >
            <Pencil size={13} />{t("app.action.edit")}</Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Needs a date — the clear call to action the badge only hinted at. A job
          fresh off an accepted quote lands here unscheduled; scheduling a visit
          (below) flips it to "scheduled" automatically. */}
      {job.status === "unscheduled" && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-purple-800 dark:text-purple-200">
            <Calendar size={16} className="shrink-0" />
            This job needs a date. Schedule its first visit to get it on the calendar.
          </div>
          <Link
            href={`/app/jobs/${jobId}/visits/new`}
            className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shrink-0"
          >
            <Plus size={14} /> Schedule a visit
          </Link>
        </div>
      )}

      {/* Client — the details someone needs before they set off */}
      <div data-tour="job-client" className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">{t("app.job.client")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={User} label="Name" value={job.client?.name} />
          <Field
            icon={Phone}
            label="Phone"
            value={
              job.client?.phone ? (
                <a
                  href={`tel:${job.client.phone}`}
                  className="text-foreground underline"
                >
                  {job.client.phone}
                </a>
              ) : (
                "Not set"
              )
            }
          />
          <Field
            icon={MapPin}
            label="Address"
            value={
              job.client?.address ? (
                // Opens the device's default maps app — the single most-used
                // action on this page for anyone in a vehicle.
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(
                    [job.client.address, job.client.city, job.client.province]
                      .filter(Boolean)
                      .join(", "),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline"
                >
                  {[job.client.address, job.client.city]
                    .filter(Boolean)
                    .join(", ")}
                </a>
              ) : (
                "Not set"
              )
            }
          />
          <Field
            icon={FileText}
            label="Email"
            value={job.client?.email || "Not set"}
          />
        </div>
      </div>

      {/* Visits */}
      <div data-tour="job-visits" className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-foreground">{t("app.job.visits")}</h2>
            {job.visits?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedVisits} of {job.visits.length} complete
              </p>
            )}
          </div>
          <Link
            href={`/app/jobs/${jobId}/visits/new`}
            className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <Plus size={13} />{t("app.job.addVisit")}</Link>
        </div>

        {!job.visits?.length ? (
          <p className="text-sm text-muted-foreground">
            {t("app.job.noVisits")}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {job.visits.map((v) => {
              const items = Array.isArray(v.checklistItems)
                ? v.checklistItems
                : [];
              const done = items.filter((i) => i?.done).length;

              return (
                <div key={v.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar size={14} className="text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {formatDateTime(v.scheduledAt)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            STATUS_STYLES[v.status] ||
                            "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {v.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {v.assignedTo?.name
                          ? `Assigned to ${v.assignedTo.name}`
                          : "Unassigned"}
                        {items.length > 0 &&
                          ` · ${done}/${items.length} checklist items`}
                        {v.photos?.length > 0 &&
                          ` · ${v.photos.length} photo${v.photos.length === 1 ? "" : "s"}`}
                      </p>
                      {v.notes && (
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                          {v.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <VisitChecklist jobId={jobId} visit={v} onChanged={load} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Turn what a human wrote about this job into office to-dos */}
      <SuggestedTasks jobId={jobId} onCreated={load} />

      {/* Curate the crew's photos → website gallery */}
      <JobPhotoCurator jobId={jobId} />
    </div>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon size={12} />}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}
