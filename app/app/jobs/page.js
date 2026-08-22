// app/app/jobs/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { JOB_STATUS_LABEL_KEYS } from "@/lib/jobs/statusLabels";
import Link from "next/link";
import { Briefcase, Plus, Search, ArrowRight } from "lucide-react";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";

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

// Moved to lib/jobs/statusLabels.js so the job DETAIL page reads the same map.
// It had its own `replace(/_/g, " ")`, so the list said "Needs a date" and the
// badge on the job itself said "unscheduled".
const STATUS_LABEL_KEYS = JOB_STATUS_LABEL_KEYS;

export default function JobsPage() {
  const { t } = useTranslation();
  // null until the server answers — see lib/loadState.js.
  const [jobs, setJobs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  // Which drawer we are looking in. Not a status filter — see the chip row.
  const [showArchived, setShowArchived] = useState(false);
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchArray(
      showArchived ? "/api/jobs?archived=1" : "/api/jobs",
    );
    if (result.aborted) return;
    if (result.ok) setJobs(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, [showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = (s) => {
    const k = STATUS_LABEL_KEYS[s];
    return k ? t(k[0], k[1]) : s.replace("_", " ");
  };

  // "No jobs in this view." only makes sense when a filter or search is
  // narrowing things down. With zero jobs and nothing applied, this is a
  // brand-new account that has never had a job — show a real first-run state.
  const hasActiveFilter = filter !== "all" || search.trim() !== "";

  const filtered = (jobs ?? []).filter((j) => {
    if (filter !== "all" && j.status !== filter) return false;
    const s = search.toLowerCase();
    return (
      j.title?.toLowerCase().includes(s) ||
      j.client?.name?.toLowerCase().includes(s)
    );
  });

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
          data-tour="jobs-new"
          href="/app/jobs/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> {t("app.jobs.new")}
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div data-tour="jobs-filters" className="flex gap-2 overflow-x-auto pb-1">
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
          {/* ── The archive ────────────────────────────────────────────────
              Separate from the status chips, and deliberately at the end with
              a divider: archived is not a status, it is whether you still want
              to see the thing. Mixing it into the same row would suggest a job
              is EITHER completed OR archived, when it is routinely both.
              Without this control an archived job would simply vanish, which
              is how "archive" turns into "delete with extra steps". */}
          <span className="shrink-0 w-px bg-border mx-1 self-stretch" aria-hidden />
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm border ${
              showArchived
                ? "bg-inverted text-inverted-foreground border-inverted"
                : "border-border text-muted-foreground"
            }`}
          >
            {t("app.jobs.archived", "Archived")}
          </button>
        </div>
        <div data-tour="jobs-search" className="relative max-w-xs w-full sm:w-auto">
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

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={filtered.length === 0}
        skeleton={
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-accent rounded-xl" />
            ))}
          </div>
        }
        empty={
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
        }
      >
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
      </ListState>
    </div>
  );
}
