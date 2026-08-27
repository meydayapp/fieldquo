// app/components/jobs/JobTasks.js
//
// The to-dos hanging off one job.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The owner's description of what a crew member gets: "the jobs they have been
// assigned … without any prices, just the visits, materials to buy, tasks from
// the notes." Visits, materials and the site address were all on the job page.
// The tasks were not — they existed only in the company-wide To-dos list, which
// a person standing in a driveway is not going to think to open, and which
// until this week showed them every task in the company anyway.
//
// ── Read-only, deliberately ────────────────────────────────────────────────
//
// No add button and no tick. `POST /api/tasks` needs `task:create`, which the
// field roles do not hold, and a compose form that ends in a refusal is the
// failure this codebase is swept for. Ticking is the interesting one: a task's
// PATCH is scoped to "yours or claimable", so a tick here would work for some
// rows and 403 on others in the same list — worse than no tick, because the
// person cannot tell which is which until they try. Whoever owns the to-do
// closes it where they opened it.
//
// Renders nothing at all when the job has none, rather than an empty card. A
// heading with nothing under it reads as something failing to load.
"use client";

import { useEffect, useState } from "react";
import { CircleDot, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

export default function JobTasks({ jobId }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [tasks, setTasks] = useState(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/tasks?jobId=${encodeURIComponent(jobId)}`)
      // A refusal or an outage leaves this null, and null renders NOTHING.
      // The alternative — an empty card — would say this job has no tasks,
      // which is a statement we have no basis for. Absence of an answer is not
      // an answer.
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => live && setTasks(Array.isArray(rows) ? rows : null))
      .catch(() => live && setTasks(null));
    return () => {
      live = false;
    };
  }, [jobId]);

  if (!tasks?.length) return null;

  // Open work first. Somebody opening this on site wants what is left, and a
  // list led by three completed rows reads as a list of nothing to do.
  const open = tasks.filter((task) => task.status !== "done");
  const done = tasks.filter((task) => task.status === "done");

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-base font-semibold text-foreground">
        {t("app.job.tasksHeading", "To-dos on this job")}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {t("app.job.tasksRemaining", "{count} left", { count: open.length })}
        </span>
      </h2>

      <div className="mt-3 divide-y divide-border">
        {[...open, ...done].map((task) => {
          const isDone = task.status === "done";
          return (
            <div key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              {isDone ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CircleDot size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className={`text-sm ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {/* Both facts or neither — a due date with no owner beside it
                      invites the reader to assume it is theirs. */}
                  {task.assignedTo?.name
                    ? t("app.job.taskAssignedTo", "For {name}", { name: task.assignedTo.name })
                    : t("app.job.taskUnassigned", "Nobody assigned yet")}
                  {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
