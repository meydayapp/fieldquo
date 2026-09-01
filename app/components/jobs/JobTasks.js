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
// ── No longer read-only — the reasoning that changed, and what stayed ──────
//
// This used to render with no add button and no tick. The add-button call
// still holds: `POST /api/tasks` needs `task:create`, which the field roles
// don't hold, and a compose form that ends in a refusal is the failure
// AGENTS.md is swept for. Creating a to-do (with or without a photo
// requirement) stays on the company-wide Tasks page (app/app/tasks/page.js),
// which already answers that permission question before it shows the form.
//
// The tick was withheld on a claim that no longer holds: "a task's PATCH is
// scoped to yours or claimable, so a tick here would work for some rows and
// 403 on others in the same list." That was true only if this panel's GET
// could return a row the viewer isn't allowed to PATCH. It can't, and hasn't
// been able to since GET /api/tasks was scoped to match PATCH's own rule (see
// that route's "The write side was scoped and the read was not" comment) —
// for anyone without task:assign, GET returns exactly mine + unassigned +
// created-by-me, which is precisely the set PATCH already allows. For anyone
// WITH task:assign (supervisor and up), GET returns the whole job's to-dos and
// PATCH allows all of them too (task:create implies task:assign's tier here).
// Every row this panel can show is a row the viewer can act on. The old
// comment was right when it was written and became stale once the read side
// was fixed — AGENTS.md's own instruction is to fix the comment when that
// happens, not leave the feature disabled under a claim the code no longer
// makes true.
//
// Renders nothing at all when the job has none, rather than an empty card. A
// heading with nothing under it reads as something failing to load.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleDot, CheckCircle2, Camera, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import MediaUploader from "@/app/components/MediaUploader";

export default function JobTasks({ jobId }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [tasks, setTasks] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  // Draft comments, keyed by task id — kept here rather than on the task row
  // itself so a re-fetch after attaching a photo doesn't wipe out what someone
  // already typed but hasn't submitted yet.
  const [comments, setComments] = useState({});

  // Guards every setState in load(), including calls made later from an
  // action handler (not just the mount effect) — a slow response arriving
  // after the component unmounted must not update state on a gone component.
  const liveRef = useRef(true);

  const load = useCallback(async () => {
    // A refusal or an outage leaves this null, and null renders NOTHING. The
    // alternative — an empty card — would say this job has no tasks, which is
    // a statement we have no basis for. Absence of an answer is not an answer.
    const res = await fetch(`/api/tasks?jobId=${encodeURIComponent(jobId)}`).catch(() => null);
    if (!liveRef.current) return;
    if (!res || !res.ok) {
      setTasks(null);
      return;
    }
    const rows = await res.json().catch(() => null);
    if (liveRef.current) setTasks(Array.isArray(rows) ? rows : null);
  }, [jobId, liveRef]);

  useEffect(() => {
    liveRef.current = true;
    load();
    return () => {
      liveRef.current = false;
    };
  }, [load, liveRef]);

  async function patchTask(task, body) {
    setBusyId(task.id);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || t("app.job.taskUpdateError"));
        return false;
      }
      await load();
      return true;
    } finally {
      setBusyId("");
    }
  }

  async function addPhotos(task, added) {
    // Only the ones the upload endpoint actually classified as a photo — a
    // required PHOTO is not satisfied by a PDF plan someone attached from the
    // same picker. See lib/media/validate.js's classifyMedia for the kinds.
    const photos = (added || []).filter((m) => m?.url && m.kind === "photo");
    if (!photos.length) return;
    setBusyId(task.id);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: photos.map((m) => ({ url: m.url })) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || t("app.job.taskPhotoError"));
        return;
      }
      await load();
    } finally {
      setBusyId("");
    }
  }

  if (!tasks?.length) return null;

  // Open work first. Somebody opening this on site wants what is left, and a
  // list led by three completed rows reads as a list of nothing to do.
  const open = tasks.filter((task) => task.status !== "done");
  const done = tasks.filter((task) => task.status === "done");

  return (
    <div className="bg-card border border-border rounded-xl p-5" data-tour="job-tasks">
      <h2 className="text-base font-semibold text-foreground">
        {t("app.job.tasksHeading", "To-dos on this job")}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {t("app.job.tasksRemaining", "{count} left", { count: open.length })}
        </span>
      </h2>

      {error && (
        <div className="mt-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="mt-3 divide-y divide-border">
        {[...open, ...done].map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            busy={busyId === task.id}
            comment={comments[task.id] || ""}
            onCommentChange={(v) => setComments((c) => ({ ...c, [task.id]: v }))}
            onToggle={() =>
              patchTask(task, { status: task.status === "done" ? "open" : "done" })
            }
            onMarkDone={() =>
              patchTask(task, {
                status: "done",
                ...(task.requiresComment && {
                  completionComment: comments[task.id] || "",
                }),
              })
            }
            onAddPhotos={(added) => addPhotos(task, added)}
            formatDate={formatDate}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  busy,
  comment,
  onCommentChange,
  onToggle,
  onMarkDone,
  onAddPhotos,
  formatDate,
  t,
}) {
  const isDone = task.status === "done";
  const photoCount = task.photos?.length || 0;
  const needsPhotos = Boolean(task.requiredPhotoCount) && photoCount < task.requiredPhotoCount;
  const effectiveComment = task.completionComment || comment;
  const needsComment = Boolean(task.requiresComment) && !effectiveComment.trim();
  const hasRequirement = Boolean(task.requiredPhotoCount) || task.requiresComment;
  // Local readiness, checked again server-side by completionGate() the moment
  // this is pressed — this is what lets the button be disabled ahead of time
  // rather than clicking through to a refusal, not a replacement for the
  // server check.
  const canMarkDone = !needsPhotos && !needsComment;

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        {/* A plain to-do (no requirement) keeps the one-tap tick it always
            had. One WITH a requirement gets the panel below instead of a tick
            that would just click through to a refusal. */}
        {!hasRequirement || isDone ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className="mt-0.5 shrink-0 disabled:opacity-50"
            aria-label={isDone ? t("app.job.taskReopen") : t("app.job.taskMarkDone")}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            ) : isDone ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CircleDot size={16} className="text-muted-foreground" />
            )}
          </button>
        ) : (
          <CircleDot size={16} className="mt-0.5 shrink-0 text-amber-500" />
        )}

        <div className="min-w-0 flex-1">
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

          {isDone && task.completionComment && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              &ldquo;{task.completionComment}&rdquo;
            </p>
          )}

          {/* ── The short path: open task → photo attached ────────────────
              Everything a crew member needs to finish a photo-required to-do
              without leaving this card: what's already filed, a camera-ready
              upload button, the comment box if one's required, and a Mark
              done button that only lights up once both are satisfied. */}
          {!isDone && hasRequirement && (
            <div className="mt-2 space-y-2 bg-muted/50 rounded-lg p-2.5">
              {Boolean(task.requiredPhotoCount) && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Camera size={12} className={needsPhotos ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"} />
                    <span className={needsPhotos ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
                      {t("app.job.taskPhotoProgress", "{have} of {need} photos", {
                        have: photoCount,
                        need: task.requiredPhotoCount,
                      })}
                    </span>
                  </div>
                  {photoCount > 0 && (
                    <div className="mt-1.5 grid grid-cols-6 gap-1">
                      {task.photos.map((p) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id}
                          src={p.url}
                          alt=""
                          className="w-full aspect-square object-cover rounded"
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-1.5">
                    <MediaUploader
                      uploadUrl="/api/upload"
                      value={[]}
                      max={task.requiredPhotoCount}
                      label={t("app.job.taskAddPhoto")}
                      hint=""
                      onChange={onAddPhotos}
                    />
                  </div>
                </div>
              )}

              {task.requiresComment && (
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    {t("app.job.taskCommentLabel")}
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => onCommentChange(e.target.value)}
                    placeholder={t("app.job.taskCommentPlaceholder")}
                    rows={2}
                    disabled={busy}
                    className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm bg-card"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={onMarkDone}
                disabled={busy || !canMarkDone}
                className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                {t("app.job.taskMarkDone")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
