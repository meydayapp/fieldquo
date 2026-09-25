// app/app/jobs/JobListRow.js
//
// One row of the jobs list, in its own file so the row can be drawn outside
// the list — the /signup side panel renders this exact component against
// fixture jobs rather than a hand-drawn lookalike. Presentational: no fetch,
// no router, no permission hook.
"use client";

import Link from "next/link";
import { Briefcase, ArrowRight } from "lucide-react";
import { jobStatusClasses, jobStatusLabel } from "@/lib/jobs/statusLabels";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param job          a GET /api/jobs row: id, title, status, recurring,
 *                     client { name }, visits [] (only its length is read)
 * @param statusLabel  (status) => text. The list passes the one its filter
 *                     chips use, so a chip and a badge can never word a status
 *                     differently; without it the shared jobStatusLabel is used.
 */
export default function JobListRow({ job, statusLabel }) {
  const { t } = useTranslation();
  const label = statusLabel || ((s) => jobStatusLabel(s, t));
  return (
    <Link
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
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${jobStatusClasses(job.status)}`}
            >
              {label(job.status)}
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
  );
}
