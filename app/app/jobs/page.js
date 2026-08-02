// app/app/jobs/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Briefcase, Plus, Search, ArrowRight, AlertCircle } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
const STATUS_STYLES = {
  // Purple/attention — an unscheduled job (usually auto-created from an
  // accepted quote) is a to-do: it needs a date.
  unscheduled: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  in_progress: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  completed: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

// Human labels for statuses. Raw values like "unscheduled" / "in_progress"
// mean nothing to a contractor — translate through app.status.* (with the
// existing camelCase keys the rest of the app uses for shared statuses).
const STATUS_LABEL_KEYS = {
  unscheduled: ["app.status.unscheduled", "Needs a date"],
  scheduled: ["app.status.scheduled", "Scheduled"],
  in_progress: ["app.status.inProgress", "In progress"],
  completed: ["app.status.completed", "Completed"],
  cancelled: ["app.status.cancelled", "Cancelled"],
};

export default function JobsPage() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) throw new Error("Couldn't load jobs.");
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusLabel = (s) => {
    const k = STATUS_LABEL_KEYS[s];
    return k ? t(k[0], k[1]) : s.replace("_", " ");
  };

  // "No jobs in this view." only makes sense when a filter or search is
  // narrowing things down. With zero jobs and nothing applied, this is a
  // brand-new account that has never had a job — show a real first-run state.
  const hasActiveFilter = filter !== "all" || search.trim() !== "";

  const filtered = jobs.filter((j) => {
    if (filter !== "all" && j.status !== filter) return false;
    const s = search.toLowerCase();
    return (
      j.title?.toLowerCase().includes(s) ||
      j.client?.name?.toLowerCase().includes(s)
    );
  });

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-40 bg-accent rounded" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.jobs.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.jobs.subtitle")}
          </p>
        </div>
        <Link
          href="/app/jobs/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> {t("app.jobs.new")}
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "unscheduled", "scheduled", "in_progress", "completed", "cancelled"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm border ${
                  filter === s
                    ? "bg-inverted text-inverted-foreground border-inverted"
                    : "border-border text-muted-foreground"
                }`}
              >
                {s === "all" ? t("app.jobs.filterAll", "All") : statusLabel(s)}
              </button>
            ),
          )}
        </div>
        <div className="relative max-w-xs w-full sm:w-auto">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("app.jobs.search")}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Briefcase size={40} className="mx-auto text-muted-foreground mb-3" />
          {hasActiveFilter ? (
            <p className="text-sm text-muted-foreground">{t("app.jobs.empty")}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t(
                  "app.jobs.emptyFirstRun",
                  "Jobs are scheduled work for a client — they appear here, and are created automatically when a quote is accepted.",
                )}
              </p>
              <Link
                href="/app/jobs/new"
                className="inline-flex items-center gap-2 mt-4 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
              >
                <Plus size={16} /> {t("app.jobs.new")}
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {filtered.map((job) => (
            <Link
              key={job.id}
              href={`/app/jobs/${job.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-muted"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Briefcase size={18} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {job.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[job.status]}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                    {job.recurring && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shrink-0">
                        {t("app.jobs.recurring")}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {job.client?.name || "Unknown client"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {job.visits?.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {job.visits.length} visit
                    {job.visits.length !== 1 ? "s" : ""}
                  </span>
                )}
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
