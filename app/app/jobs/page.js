// app/app/jobs/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Briefcase, Plus, Search, ArrowRight } from "lucide-react";

const STATUS_STYLES = {
  scheduled: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
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
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scheduled and in-progress work.
          </p>
        </div>
        <Link
          href="/app/jobs/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-full text-sm font-semibold"
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
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-200 text-gray-600"
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No jobs in this view.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {filtered.map((job) => (
            <Link
              key={job.id}
              href={`/app/jobs/${job.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Briefcase size={18} className="text-gray-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {job.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[job.status]}`}
                    >
                      {job.status.replace("_", " ")}
                    </span>
                    {job.recurring && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 shrink-0">
                        Recurring
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {job.client?.name || "Unknown client"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {job.visits?.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {job.visits.length} visit
                    {job.visits.length !== 1 ? "s" : ""}
                  </span>
                )}
                <ArrowRight size={16} className="text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
