// app/app/jobs/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Briefcase, Plus, Search, ArrowRight } from "lucide-react";

const STATUS_STYLES = {
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  in_progress: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  completed: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="p-6 max-w-6xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-40 bg-accent rounded" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled and in-progress work.
          </p>
        </div>
        <Link
          href="/app/jobs/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> New Job
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "scheduled", "in_progress", "completed", "cancelled"].map(
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
                {s.replace("_", " ")}
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
            placeholder="Search jobs..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Briefcase size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No jobs in this view.</p>
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
                      {job.status.replace("_", " ")}
                    </span>
                    {job.recurring && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shrink-0">
                        Recurring
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
