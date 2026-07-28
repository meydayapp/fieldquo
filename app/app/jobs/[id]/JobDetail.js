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
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  MapPin,
  Phone,
  Plus,
  FileText,
  CheckCircle2,
  Circle,
} from "lucide-react";

const STATUS_STYLES = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

const JOB_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"];

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
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <AlertCircle size={18} /> {error || "Job not found."}
          </div>
          <Link
            href="/app/jobs"
            className="mt-3 inline-block text-sm text-red-700 underline"
          >
            Back to jobs
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
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> Jobs
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                STATUS_STYLES[job.status] ||
                "bg-gray-50 text-gray-600 border-gray-200"
              }`}
            >
              {job.status?.replace(/_/g, " ")}
            </span>
          </div>
          {job.quote && (
            <p className="text-sm text-gray-500 mt-1">
              From quote{" "}
              <Link
                href={`/app/quotes/${job.quote.id}`}
                className="underline hover:text-gray-700"
              >
                {job.quote.quoteNumber}
              </Link>
            </p>
          )}
        </div>

        <select
          value={job.status}
          disabled={busy}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-60"
        >
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Client — the details someone needs before they set off */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Client</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={User} label="Name" value={job.client?.name} />
          <Field
            icon={Phone}
            label="Phone"
            value={
              job.client?.phone ? (
                <a
                  href={`tel:${job.client.phone}`}
                  className="text-gray-900 underline"
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
                  className="text-gray-900 underline"
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
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900">Visits</h2>
            {job.visits?.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {completedVisits} of {job.visits.length} complete
              </p>
            )}
          </div>
          <Link
            href={`/app/jobs/${jobId}/visits/new`}
            className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            <Plus size={13} /> Add visit
          </Link>
        </div>

        {!job.visits?.length ? (
          <p className="text-sm text-gray-500">
            No visits scheduled yet. Add one to put this job on the calendar.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
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
                        <Calendar size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {formatDateTime(v.scheduledAt)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            STATUS_STYLES[v.status] ||
                            "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {v.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {v.assignedTo?.name
                          ? `Assigned to ${v.assignedTo.name}`
                          : "Unassigned"}
                        {items.length > 0 &&
                          ` · ${done}/${items.length} checklist items`}
                        {v.photos?.length > 0 &&
                          ` · ${v.photos.length} photo${v.photos.length === 1 ? "" : "s"}`}
                      </p>
                      {v.notes && (
                        <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                          {v.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {items.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {items.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          {item?.done ? (
                            <CheckCircle2
                              size={14}
                              className="text-emerald-600 shrink-0"
                            />
                          ) : (
                            <Circle size={14} className="text-gray-300 shrink-0" />
                          )}
                          <span
                            className={item?.done ? "text-gray-400 line-through" : ""}
                          >
                            {item?.label || item?.text || "Untitled item"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
        {Icon && <Icon size={12} />}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}
