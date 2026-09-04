// app/app/tasks/page.js
//
// The internal to-do list: follow up with a client, order material, chase a
// deposit. Distinct from JobVisit, which is scheduled work at an address.
//
// Sorted by urgency rather than grouped by status, because the question people
// open this page with is "what have I let slip", not "how many things are
// open". Overdue items surface at the top regardless of priority — a low
// priority task that's two weeks late still needs a decision.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Briefcase,
  ListChecks,
  X,
  Camera,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { can } from "@/lib/permissions";
import { usePermissions } from "@/app/providers/PermissionProvider";

const PRIORITY_STYLES = {
  urgent: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  high: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  normal: "bg-muted text-muted-foreground border-border",
  low: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

// ── What a priority is CALLED ─────────────────────────────────────────────
//
// Exhaustive against `enum TaskPriority` in prisma/schema.prisma. The badge
// rendered `{task.priority}` and the dropdown rendered `<option>{p}</option>`,
// so both showed the raw lowercase column — a French crew read "urgent" (which
// happens to survive) beside "high" and "low" (which do not), in the middle of
// an otherwise French screen.
//
// i18n PENDING app.tasks.priority.low / .normal / .high / .urgent — English
// here until the lead lands the keys in one batch; a t() call on a key that
// does not exist yet turns check:translations red for the whole tree. The
// STRUCTURE is the fix: one map, used by both call sites, so they cannot drift.
const PRIORITY_LABELS = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
/** Never returns undefined, and never the raw column with its underscores. */
const priorityLabel = (p) =>
  PRIORITY_LABELS[p] || String(p || "").replace(/_/g, " ");

/** Every TaskPriority, in the order the dropdown should offer them. */
const TASK_PRIORITIES = Object.keys(PRIORITY_LABELS);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function TasksPage() {
  const { t } = useTranslation();
  // ── The compose form that ended in a 403 ─────────────────────────────────
  //
  // POST /api/tasks requires `task:create`, which PERMISSIONS.employee does
  // NOT hold — so Crew got a "+ New task" button, a form, an assignee
  // dropdown and a Save that refused. That is the worst shape of this failure:
  // it costs the person the thing they typed, not just a click.
  //
  // The coarse role is the right question because it is the one the server
  // asks. The grid says nothing about tasks at all, so asking a level here
  // would be asking a different question than the endpoint — which is how a UI
  // ends up offering what the API refuses, one rename later.
  //
  // Unresolved provider falls OPEN, which is PermissionProvider's own rule: a
  // supervisor must not lose their button because a lookup was slow, and the
  // server refuses regardless of what this renders.
  //
  // The LIST is deliberately untouched. GET /api/tasks scopes a crew member to
  // their own to-dos and orphans they may claim, and those are genuinely
  // theirs to read — hiding the page would take away work rather than a
  // temptation.
  const caller = usePermissions();
  const canCreateTask = !caller?.role || can(caller.role, "task:create");
  // null until the server answers — see lib/loadState.js. This page had the
  // worst variant of the bug: `r.ok ? r.json() : []` swallowed a 401 into an
  // empty array before any catch ran, so a refused load rendered "Nothing
  // outstanding" with no error anywhere on the screen.
  const [tasks, setTasks] = useState(null);
  const [members, setMembers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setError("");
    setErrorKey("");
    setLoading(true);
    const [taskResult, memberResult, jobResult] = await Promise.all([
      fetchArray("/api/tasks"),
      // Assignee list. Genuinely non-fatal — the page still works, you just
      // can't hand a task to someone else — so a failure here degrades the
      // assignee dropdown and does NOT blank the task list.
      fetchArray("/api/settings/members"),
      // Same non-fatal shape: without it you just can't link a new to-do to a
      // job (and therefore can't ask it to require photos), the rest of the
      // page still works.
      fetchArray("/api/jobs"),
    ]);
    if (taskResult.aborted) return;
    if (taskResult.ok) setTasks(taskResult.data);
    else setErrorKey(taskResult.errorKey);
    setMembers(memberResult.ok ? memberResult.data : []);
    setJobs(jobResult.ok ? jobResult.data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const today = startOfToday();
    return (tasks ?? [])
      .filter((task) =>
        showDone ? true : !["done", "cancelled"].includes(task.status),
      )
      .map((task) => ({
        ...task,
        overdue:
          task.dueDate &&
          new Date(task.dueDate) < today &&
          !["done", "cancelled"].includes(task.status),
      }))
      .sort((a, b) => {
        // Overdue first, then priority, then soonest due date. Undated tasks
        // sink below dated ones of equal priority — they have no deadline to
        // miss.
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        const p =
          (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
        if (p !== 0) return p;
        if (!a.dueDate) return b.dueDate ? 1 : 0;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
  }, [tasks, showDone]);

  const openCount = (tasks ?? []).filter(
    (task) => !["done", "cancelled"].includes(task.status),
  ).length;

  async function toggle(task) {
    // ── The tick on a CANCELLED task used to complete it ────────────────────
    //
    // `done` below is `["done", "cancelled"].includes(task.status)`, so a
    // cancelled task draws a filled tick — and this read
    // `task.status === "done" ? "open" : "done"`, which sent "done" for it.
    // Pressing the tick on work somebody had called off recorded it as
    // finished: a false statement about the job, made by the control that
    // looked like it would undo the cancellation.
    //
    // Both settled states now reopen, and only a live task completes.
    const settled = task.status === "done" || task.status === "cancelled";
    const status = settled ? "open" : "done";
    setBusyId(task.id);
    setError("");
    const before = tasks;
    setTasks((prev) =>
      prev.map((item) => (item.id === task.id ? { ...item, status } : item)),
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || t("app.tasks.updateError"));
      }
    } catch (err) {
      setTasks(before);
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function create() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description || null,
          dueDate: draft.dueDate || null,
          priority: draft.priority,
          assignedToId: draft.assignedToId || null,
          jobId: draft.jobId || null,
          // "" (the empty input) means no requirement — sent as null rather
          // than 0 so the server's normaliseRequiredPhotoCount() sees the
          // same "not set" shape whether the field was left blank or the
          // request omitted it entirely.
          requiredPhotoCount: draft.requiredPhotoCount
            ? Number(draft.requiredPhotoCount)
            : null,
          requiresComment: Boolean(draft.requiresComment),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || t("app.tasks.createError"));
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.tasks.title")}</h1>
          {/* Plain English, deliberately in English only and not through t():
              the tasks-v1 tour says the same thing in the same words, and the
              two drifting apart is worse than one of them being untranslated.
              The owner read "Jobs" and "Tasks" as the same feature — this line
              is the answer to that, so it sits above the count, not below. */}
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Tasks are internal reminders for you and your team. Jobs are
            scheduled work at a client&apos;s address.
          </p>
          {/* No count at all until the server has answered — "0 outstanding"
              on a refused load is the same lie as "0 clients total". */}
          {tasks && (
            <p className="text-sm text-muted-foreground mt-1">
              {openCount} {t("app.tasks.open")}
            </p>
          )}
        </div>
        {/* Absent, not replaced by an apology. lib/permissions/nav.js takes the
            same line on a row somebody cannot use — and it drops a group that
            loses all its items for the reason that applies here too: a notice
            where a control used to be announces that something was taken away,
            which is a worse thing to read than a page that simply does not
            offer it. */}
        {canCreateTask && (
          <button
            data-tour="tasks-new"
            onClick={() =>
              setDraft({
                title: "",
                description: "",
                dueDate: "",
                priority: "normal",
                assignedToId: "",
                jobId: "",
                requiredPhotoCount: "",
                requiresComment: false,
              })
            }
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-full"
          >
            <Plus size={14} /> {t("app.tasks.new")}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Belt and braces: today `draft` is only ever set by the button above,
          but the form is the thing that costs somebody their typing, so it
          answers the permission question itself rather than trusting that the
          only door to it stays shut. */}
      {canCreateTask && draft && (
        <div className="bg-card border border-inverted rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{t("app.tasks.new")}</h2>
            <button
              onClick={() => setDraft(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("app.action.close")}
            >
              <X size={16} />
            </button>
          </div>

          <input
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={t("app.tasks.titlePlaceholder")}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            placeholder={t("app.tasks.descPlaceholder")}
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.tasks.due")}
              </label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) =>
                  setDraft({ ...draft, dueDate: e.target.value })
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.tasks.priority")}
              </label>
              <select
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value })
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.tasks.assignTo")}
              </label>
              <select
                value={draft.assignedToId}
                onChange={(e) =>
                  setDraft({ ...draft, assignedToId: e.target.value })
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              >
                <option value="">{t("app.tasks.nobody")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.user?.id || m.userId}>
                    {m.user?.name || m.user?.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("app.tasks.linkToJob")}
            </label>
            <select
              value={draft.jobId}
              onChange={(e) => {
                const jobId = e.target.value;
                setDraft({
                  ...draft,
                  jobId,
                  // A requirement with no job to file the photo against is
                  // refused server-side (see POST /api/tasks) — clearing it
                  // here the moment the job link is removed keeps the form
                  // from offering a combination the API will just reject.
                  requiredPhotoCount: jobId ? draft.requiredPhotoCount : "",
                  requiresComment: jobId ? draft.requiresComment : false,
                });
              }}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
            >
              <option value="">{t("app.tasks.noJob")}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>

          {/* Only offered once a job is picked — a photo requirement with
              nowhere for the photo to land is exactly the dead control
              AGENTS.md is swept for, so the form doesn't offer the
              combination rather than letting someone hit Save and read a
              refusal. */}
          {draft.jobId && (
            <div className="grid gap-3 sm:grid-cols-2 bg-muted/50 rounded-lg p-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t("app.tasks.requiredPhotos")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={draft.requiredPhotoCount}
                  onChange={(e) =>
                    setDraft({ ...draft, requiredPhotoCount: e.target.value })
                  }
                  placeholder={t("app.tasks.requiredPhotosPlaceholder")}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground self-end pb-2">
                <input
                  type="checkbox"
                  checked={draft.requiresComment}
                  onChange={(e) =>
                    setDraft({ ...draft, requiresComment: e.target.checked })
                  }
                />
                {t("app.tasks.requiresComment")}
              </label>
            </div>
          )}

          <button
            onClick={create}
            disabled={saving || !draft.title.trim()}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t("app.tasks.add")}
          </button>
        </div>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={visible.length === 0}
        skeleton={<div className="animate-pulse h-96 bg-accent rounded-xl" />}
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <ListChecks size={30} className="text-muted-foreground mx-auto" />
            <p className="mt-3 font-medium text-foreground">
              {showDone ? t("app.tasks.emptyDone") : t("app.tasks.emptyOpen")}
            </p>
          </div>
        }
      >
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {visible.map((task) => {
            const done = ["done", "cancelled"].includes(task.status);
            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 px-5 py-4 ${
                  busyId === task.id ? "opacity-60" : ""
                }`}
              >
                <button
                  onClick={() => toggle(task)}
                  disabled={Boolean(busyId)}
                  className="mt-0.5 shrink-0"
                  aria-label={done ? "Reopen task" : "Mark done"}
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle
                      size={18}
                      className="text-muted-foreground hover:text-foreground"
                    />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium ${
                        done ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </span>
                    {!done && task.priority !== "normal" && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          PRIORITY_STYLES[task.priority]
                        }`}
                      >
                        {priorityLabel(task.priority)}
                      </span>
                    )}
                    {task.overdue && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-600 text-white">
                        {t("app.tasks.overdue")}
                      </span>
                    )}
                    {/* Why the tick might refuse — attaching the photo itself
                        happens on the job page (JobTasks), not here, so this
                        is a status readout rather than a control. */}
                    {!done && Boolean(task.requiredPhotoCount) && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                          (task.photos?.length || 0) >= task.requiredPhotoCount
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900"
                        }`}
                      >
                        <Camera size={11} />
                        {t("app.tasks.photoBadge", {
                          have: task.photos?.length || 0,
                          need: task.requiredPhotoCount,
                        })}
                      </span>
                    )}
                    {!done && task.requiresComment && !task.completionComment && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                        {t("app.tasks.commentBadge")}
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {task.description}
                    </p>
                  )}

                  <div className="text-xs text-muted-foreground mt-1 flex gap-2 flex-wrap">
                    {task.dueDate && (
                      <span>
                        {t("app.tasks.due")}{" "}
                        {new Date(task.dueDate).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    {task.assignedTo?.name && (
                      <span>· {task.assignedTo.name}</span>
                    )}
                    {task.client?.name && <span>· {task.client.name}</span>}
                    {/* The job a lifecycle-generated task came from. A link,
                        not a label: "Ask them for a review" is only actionable
                        if you can get to the job without searching for it —
                        and it's the clearest statement on this page that a
                        task and a job are two different things. */}
                    {task.job?.id && (
                      <Link
                        href={`/app/jobs/${task.job.id}`}
                        className="inline-flex items-center gap-1 underline hover:text-foreground"
                      >
                        <Briefcase size={11} />
                        {task.job.title}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ListState>

      <button
        data-tour="tasks-showdone"
        onClick={() => setShowDone((v) => !v)}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {showDone ? t("app.tasks.hideCompleted") : t("app.tasks.showCompleted")}
      </button>
    </div>
  );
}
