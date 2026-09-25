"use client";

// app/components/jobs/JobPlan.js
//
// The job plan: the approved quote's lines as ordered steps, each with an
// assignee, an estimate from the takeoff, its materials, what it waits on,
// and the hours clocked against it — plus the crew day view underneath. Fed
// by GET /api/jobs/[id]/plan (lib/jobs/planPayload.js); every write goes
// through PATCH /api/tasks/[id], which enforces the dependency gate.
//
// ── What this replaces ─────────────────────────────────────────────────────
//
// A quote that converted to a job left one to-do ("Schedule the job") and a
// task list of whatever somebody typed. The lines the client signed never
// became work with a name on it. Free-form to-dos still live in JobTasks.js
// below this card, untouched: a plan step is a Task with `planStep` set, and
// that flag is what separates the two panels.
//
// ── Waiting on is derived ──────────────────────────────────────────────────
//
// The "Waiting on" pill and the disabled Start are the server's own verdict
// (lib/jobs/plan.js planStatus / dependencyGate), re-read after every write.
// This panel never computes "may this start" itself — a disabled button is
// a courtesy; the refusal, with its reason, comes from the route.
//
// ── Reorder without a library ──────────────────────────────────────────────
//
// Up/down buttons in a reorder mode, saved as one list. A drag library for
// nine rows is a dependency for a gesture that does not work with a glove
// on a phone anyway.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ListOrdered,
  Plus,
  Check,
  Play,
  RotateCcw,
  PauseCircle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Pencil,
  X,
  Hammer,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { crewDayLanes, dayOf } from "@/lib/jobs/plan";

const hours = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : `${Number(v).toFixed(1)} h`);

const PILL = {
  not_started: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900",
  waiting: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  done: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  cancelled: "bg-muted text-muted-foreground border-border line-through",
};

export default function JobPlan({ jobId, onChanged }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [plan, setPlan] = useState(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [holdId, setHoldId] = useState(null);
  const [day, setDay] = useState(null);
  const liveRef = useRef(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/plan`).catch(() => null);
    if (!liveRef.current) return;
    if (!res || !res.ok) {
      // 403 for a member who may not see jobs, or an outage: the card says
      // so rather than pretending the job has no plan.
      setPlan(null);
      setFailed(true);
      return;
    }
    const d = await res.json().catch(() => null);
    if (!liveRef.current) return;
    setPlan(d);
    setFailed(false);
  }, [jobId]);

  useEffect(() => {
    liveRef.current = true;
    load();
    return () => {
      liveRef.current = false;
    };
  }, [load]);

  const steps = plan?.steps || [];
  const timezone = plan?.job?.timezone || undefined;

  // The day view opens on today, or on the plan's first scheduled day when
  // today has nothing on it.
  useEffect(() => {
    if (day || !plan) return;
    const today = dayOf(new Date(), timezone);
    const days = steps.map((s) => dayOf(s.scheduledStart || s.dueDate, timezone)).filter(Boolean).sort();
    setDay(days.includes(today) || !days.length ? today : days[0]);
  }, [plan, day, steps, timezone]);

  const lanes = useMemo(() => (day ? crewDayLanes(steps, { day, timezone }) : []), [steps, day, timezone]);

  async function patch(step, body, key = step.id) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.jobPlan.updateFailed", "Couldn't update that step."));
        setError(message || t("app.jobPlan.updateFailed", "Couldn't update that step."));
        return false;
      }
      await load();
      onChanged?.();
      return true;
    } finally {
      setBusy("");
    }
  }

  async function act(action, body) {
    setBusy(action);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.jobPlan.updateFailed", "Couldn't update that step."));
        setError(message || t("app.jobPlan.updateFailed", "Couldn't update that step."));
        return false;
      }
      const d = await res.json().catch(() => null);
      if (d?.plan) setPlan(d.plan);
      else await load();
      onChanged?.();
      return true;
    } finally {
      setBusy("");
    }
  }

  function startReorder() {
    setOrder(steps.map((s) => s.id));
    setReordering(true);
  }
  function move(id, dir) {
    setOrder((o) => {
      const i = o.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  async function saveOrder() {
    if (await act("reorder", { action: "reorder", ids: order })) setReordering(false);
  }

  if (failed) {
    return (
      <div className="bg-card border border-border rounded-xl p-5" data-tour="job-plan">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <ListOrdered size={15} className="text-muted-foreground" />
          {t("app.jobPlan.title", "Job plan")}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">{t("app.jobPlan.loadFailed", "The plan couldn't be loaded.")}</p>
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="bg-card border border-border rounded-xl p-5" data-tour="job-plan">
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const { summary, members, canEdit, canCreate, canAssign, job } = plan;
  const shown = reordering ? order.map((id) => steps.find((s) => s.id === id)).filter(Boolean) : steps;
  const fromQuote = steps.filter((s) => s.quoteLineKey && !s.quoteLineKey.startsWith("addon:")).length;
  const options = steps.filter((s) => s.quoteLineKey?.startsWith("addon:")).length;

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5" data-tour="job-plan">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
            <ListOrdered size={15} className="text-muted-foreground" />
            {t("app.jobPlan.title", "Job plan")}
            {steps.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                {t("app.jobPlan.summary", "{count} steps · {done} done · {estimated} estimated · {clocked} clocked", {
                  count: summary.count,
                  done: summary.done,
                  estimated: hours(summary.estimatedHours),
                  clocked: hours(summary.clockedHours),
                })}
              </span>
            )}
          </h2>
          {canEdit && (
            <div className="flex gap-2 flex-wrap">
              {steps.length > 1 && !reordering && (
                <button type="button" onClick={startReorder} className="border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted">
                  {t("app.jobPlan.reorder", "Reorder")}
                </button>
              )}
              {reordering && (
                <>
                  <button type="button" disabled={busy === "reorder"} onClick={saveOrder} className="bg-inverted text-inverted-foreground text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60">
                    {t("app.jobPlan.saveOrder", "Save order")}
                  </button>
                  <button type="button" onClick={() => setReordering(false)} className="border border-border text-sm font-semibold px-3 py-1.5 rounded-lg">
                    {t("app.action.cancel")}
                  </button>
                </>
              )}
              {canCreate && !adding && !reordering && (
                <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-3 py-1.5 rounded-lg">
                  <Plus size={13} />
                  {t("app.jobPlan.addStep", "Add a step")}
                </button>
              )}
            </div>
          )}
        </div>

        {steps.length > 0 && job.quoteNumber && (
          <p className="text-xs text-muted-foreground mt-1">
            {t("app.jobPlan.builtFrom", "Built from the {lines} approved lines and {options} ticked options on {quote}{when}. Edit anything; a step you add by hand survives a rebuild.", {
              lines: fromQuote,
              options,
              quote: job.quoteNumber,
              when: job.acceptedAt && job.clientName ? ` ${t("app.jobPlan.whenApproved", "when {client} approved it on {date}", { client: job.clientName, date: formatDate(job.acceptedAt) })}` : "",
            })}
          </p>
        )}

        {error && (
          <div className="mt-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {steps.length === 0 && (
          <div className="mt-3 text-sm text-muted-foreground">
            <p>{t("app.jobPlan.empty", "No plan yet.")}</p>
            {canEdit && job.quoteNumber && (
              <button type="button" disabled={busy === "rebuild"} onClick={() => act("rebuild", { action: "rebuild" })} className="mt-2 inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted text-foreground disabled:opacity-60">
                {busy === "rebuild" ? <Loader2 size={13} className="animate-spin" /> : <Hammer size={13} />}
                {t("app.jobPlan.buildFromQuote", "Build from {quote}", { quote: job.quoteNumber })}
              </button>
            )}
          </div>
        )}

        {adding && (
          <StepForm
            t={t}
            members={members}
            steps={steps}
            canAssign={canAssign}
            busy={busy === "add"}
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              setBusy("add");
              setError("");
              try {
                const res = await fetch("/api/tasks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...values, jobId, planStep: true }),
                });
                if (!res.ok) {
                  const message = await reportResponseError(res, t("app.jobPlan.updateFailed", "Couldn't update that step."));
                  setError(message || t("app.jobPlan.updateFailed", "Couldn't update that step."));
                  return;
                }
                setAdding(false);
                await load();
                onChanged?.();
              } finally {
                setBusy("");
              }
            }}
          />
        )}

        {shown.length > 0 && (
          <ol className="mt-3 divide-y divide-border">
            {shown.map((s, i) => (
              <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                {editingId === s.id ? (
                  <StepForm
                    t={t}
                    step={s}
                    members={members}
                    steps={steps}
                    canAssign={canAssign}
                    busy={busy === s.id}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (values) => {
                      if (await patch(s, values)) setEditingId(null);
                    }}
                  />
                ) : (
                  <StepRow
                    t={t}
                    step={s}
                    index={i}
                    formatDate={formatDate}
                    reordering={reordering}
                    busy={busy === s.id}
                    canEdit={canEdit}
                    onMove={(dir) => move(s.id, dir)}
                    onStart={() => patch(s, { status: "in_progress" })}
                    onDone={() => patch(s, { status: "done" })}
                    onReopen={() => patch(s, { status: "open" })}
                    onEdit={() => setEditingId(s.id)}
                    holding={holdId === s.id}
                    onHold={() => setHoldId(s.id)}
                    onHoldCancel={() => setHoldId(null)}
                    onHoldSave={async (reason) => {
                      if (await patch(s, { waitingReason: reason })) setHoldId(null);
                    }}
                    onHoldClear={() => patch(s, { waitingReason: null })}
                  />
                )}
              </li>
            ))}
          </ol>
        )}

        {steps.length > 0 && canEdit && job.quoteNumber && (
          <button type="button" disabled={busy === "rebuild"} onClick={() => act("rebuild", { action: "rebuild" })} className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60">
            {t("app.jobPlan.rebuild", "Add any lines from {quote} that aren't here yet", { quote: job.quoteNumber })}
          </button>
        )}
      </div>

      {steps.length > 0 && day && (
        <div className="bg-card border border-border rounded-xl p-5" data-tour="job-plan-day">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-foreground">
              {t("app.jobPlan.dayView", "Crew day view")}{" "}
              <span className="text-xs font-normal text-muted-foreground">{formatDate(`${day}T12:00:00`)}</span>
            </h2>
            <div className="flex items-center gap-1">
              <button type="button" aria-label={t("app.jobPlan.prevDay", "Previous day")} onClick={() => setDay(shiftDay(day, -1))} className="border border-border rounded-lg p-1.5 hover:bg-muted">
                <ChevronLeft size={14} />
              </button>
              <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="border border-border rounded-lg px-2 py-1 text-sm bg-card" />
              <button type="button" aria-label={t("app.jobPlan.nextDay", "Next day")} onClick={() => setDay(shiftDay(day, 1))} className="border border-border rounded-lg p-1.5 hover:bg-muted">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          {lanes.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">{t("app.jobPlan.dayEmpty", "Nothing planned for this day. Give a step a date to see it here.")}</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {lanes.map((lane) => (
                <div key={lane.id} className="border border-border rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-baseline justify-between gap-2">
                    <span>{lane.name || t("app.jobPlan.unassignedLane", "Unassigned")}</span>
                    {lane.plannedHours > 0 && <span className="text-xs font-normal text-muted-foreground">{t("app.jobPlan.planned", "{hours} planned", { hours: hours(lane.plannedHours) })}</span>}
                  </h4>
                  <div className="mt-2 space-y-1.5">
                    {lane.blocks.map((b) => (
                      <div key={b.id} className={`rounded-md border px-2.5 py-1.5 text-sm ${b.planStatus === "done" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30" : b.planStatus === "waiting" ? "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30" : "border-border bg-muted/40"}`}>
                        {b.scheduledStart && b.scheduledEnd && (
                          <div className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                            {timeOf(b.scheduledStart)} – {timeOf(b.scheduledEnd)}
                          </div>
                        )}
                        <div className="text-foreground">{b.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("app.jobPlan.stepN", "Step {n}", { n: steps.indexOf(b) + 1 })}
                          {hours(b.estimatedHours) ? ` · ${t("app.jobPlan.estShort", "{hours} est", { hours: hours(b.estimatedHours) })}` : ""}
                          {b.planStatus === "done" ? ` · ${t("app.jobPlan.status.done", "Done")}` : ""}
                          {b.planStatus === "waiting" && b.waitingOn?.[0] ? ` · ${t("app.jobPlan.waitingOn", "Waiting on {what}", { what: b.waitingOn[0].label })}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function timeOf(v) {
  try {
    return new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function StepRow({ t, step: s, index, formatDate, reordering, busy, canEdit, onMove, onStart, onDone, onReopen, onEdit, holding, onHold, onHoldCancel, onHoldSave, onHoldClear }) {
  const [reason, setReason] = useState(s.waitingReason || "");
  const status = s.planStatus;
  const statusLabel = {
    not_started: t("app.jobPlan.status.notStarted", "Not started"),
    in_progress: t("app.jobPlan.status.inProgress", "In progress"),
    waiting: t("app.jobPlan.status.waiting", "Waiting on"),
    done: t("app.jobPlan.status.done", "Done"),
    cancelled: t("app.jobPlan.status.cancelled", "Cancelled"),
  }[status];
  const blockedByDeps = (s.waitingOn || []).some((w) => w.kind !== "external");
  const origin = s.quoteLineNo
    ? t("app.jobPlan.lineN", "Line {n}", { n: s.quoteLineNo })
    : s.quoteLineKey?.startsWith("addon:")
      ? t("app.jobPlan.optionTicked", "Option ticked by the client")
      : s.fromChangeOrder
        ? null
        : s.quoteLineKey || s.sourceKey
          ? t("app.jobPlan.fromQuote", "From the quote")
          : t("app.jobPlan.addedByHand", "Added by hand");
  const when = s.scheduledStart ? formatDate(s.scheduledStart) : s.dueDate ? formatDate(s.dueDate) : null;
  const meta = [origin, s.assignedTo?.name || null, when].filter(Boolean).join(" · ");
  const bought = s.materials.filter((m) => m.purchased).length;

  return (
    <div className="flex items-start gap-3">
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${status === "done" ? "bg-emerald-600 text-white" : "bg-muted text-foreground"}`}>
        {status === "done" ? <Check size={14} /> : index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${status === "done" ? "text-muted-foreground" : "text-foreground"}`}>{s.title}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${PILL[status] || PILL.not_started}`}>{statusLabel}</span>
          {status === "waiting" && s.waitingOn?.[0] && (
            <span className="text-xs text-amber-800 dark:text-amber-200">
              {s.waitingOn[0].kind === "change_order"
                ? t("app.jobPlan.waitingOnClient", "client approval of {label}", { label: s.waitingOn[0].label })
                : s.waitingOn[0].label}
            </span>
          )}
          {s.fromChangeOrder && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${PILL.in_progress}`}>
              {t("app.jobPlan.fromChangeOrder", "From change order {label}", { label: s.fromChangeOrder.label })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {meta || t("app.job.taskUnassigned", "Nobody assigned yet")}
          {s.fromChangeOrder && !s.assignedTo && ` · ${t("app.jobPlan.unassignedAssign", "Unassigned")}`}
          {s.materials.length > 0 && (
            <>
              {" · "}
              {t("app.jobPlan.materials", "Materials: {list}", {
                list: s.materials.map((m) => `${m.name} — ${m.qty} ${m.unit}`).join(", "),
              })}
              {" · "}
              {bought === s.materials.length
                ? t("app.jobPlan.materialsOnHand", "on hand")
                : t("app.jobPlan.materialsToBuy", "{bought} on hand, {left} on the shopping list", { bought, left: s.materials.length - bought })}
            </>
          )}
        </p>
        {s.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{s.description}</p>}
        {s.dependsOn.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {s.dependsOn.map((d) => (
              <span key={d.id} className={`text-[11px] px-2 py-0.5 rounded-full border ${d.status === "done" || d.status === "cancelled" ? "border-border text-muted-foreground" : "border-amber-200 text-amber-800 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900"}`}>
                {t("app.jobPlan.waitsOn", "waits on {title}", { title: d.title })}
              </span>
            ))}
          </div>
        )}

        {!reordering && (
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            {status !== "done" && status !== "cancelled" && status !== "in_progress" && (
              <button type="button" disabled={busy || blockedByDeps} title={blockedByDeps ? t("app.jobPlan.blockedHint", "Waiting on another step") : undefined} onClick={onStart} className="inline-flex min-h-[44px] lg:min-h-0 items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-50">
                <Play size={12} /> {t("app.jobPlan.start", "Start")}
              </button>
            )}
            {status !== "done" && status !== "cancelled" && (
              <button type="button" disabled={busy || blockedByDeps} onClick={onDone} className="inline-flex min-h-[44px] lg:min-h-0 items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-50">
                <Check size={12} /> {t("app.job.taskMarkDone")}
              </button>
            )}
            {status === "done" && (
              <button type="button" disabled={busy} onClick={onReopen} className="inline-flex min-h-[44px] lg:min-h-0 items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-50">
                <RotateCcw size={12} /> {t("app.job.taskReopen")}
              </button>
            )}
            {status !== "done" && status !== "cancelled" && !holding && !s.waitingReason && (
              <button type="button" disabled={busy} onClick={onHold} className="inline-flex min-h-[44px] lg:min-h-0 items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-50">
                <PauseCircle size={12} /> {t("app.jobPlan.hold", "Put on hold")}
              </button>
            )}
            {s.waitingReason && status !== "done" && (
              <button type="button" disabled={busy} onClick={onHoldClear} className="inline-flex min-h-[44px] lg:min-h-0 items-center gap-1 border border-border text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted disabled:opacity-50">
                <X size={12} /> {t("app.jobPlan.holdClear", "Clear hold")}
              </button>
            )}
            {canEdit && (
              <button type="button" disabled={busy} onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50">
                <Pencil size={12} /> {t("app.action.edit", "Edit")}
              </button>
            )}
            {busy && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
          </div>
        )}
        {holding && (
          <form
            className="mt-2 flex gap-2 items-center flex-wrap"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim()) onHoldSave(reason.trim());
            }}
          >
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("app.jobPlan.holdPlaceholder", "Waiting on… e.g. paint delivery, due Tue a.m.")} className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-card min-w-[16rem] flex-1" />
            <button type="submit" disabled={busy || !reason.trim()} className="bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60">
              {t("app.action.save", "Save")}
            </button>
            <button type="button" onClick={onHoldCancel} className="text-xs font-semibold px-2 py-1.5 text-muted-foreground">
              {t("app.action.cancel")}
            </button>
          </form>
        )}
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        {hours(s.estimatedHours) && (
          <div>
            <b className="text-foreground text-sm">{hours(s.estimatedHours)}</b> {t("app.jobPlan.est", "est")}
          </div>
        )}
        {s.clockedHours > 0 && <div>{t("app.jobPlan.clocked", "{hours} clocked", { hours: hours(s.clockedHours) })}</div>}
        {reordering && (
          <div className="flex gap-1 mt-1 justify-end">
            <button type="button" aria-label={t("app.jobPlan.moveUp", "Move up")} onClick={() => onMove(-1)} className="border border-border rounded p-1 hover:bg-muted">
              <ChevronUp size={12} />
            </button>
            <button type="button" aria-label={t("app.jobPlan.moveDown", "Move down")} onClick={() => onMove(1)} className="border border-border rounded p-1 hover:bg-muted">
              <ChevronDown size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const toLocalInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function StepForm({ t, step, members, steps, canAssign, busy, onCancel, onSubmit }) {
  const [title, setTitle] = useState(step?.title || "");
  const [description, setDescription] = useState(step?.description || "");
  const [assignedToId, setAssignedToId] = useState(step?.assignedToId || "");
  const [estimatedHours, setEstimatedHours] = useState(step?.estimatedHours ?? "");
  const [dueDate, setDueDate] = useState(step?.dueDate ? String(step.dueDate).slice(0, 10) : "");
  const [scheduledStart, setScheduledStart] = useState(toLocalInput(step?.scheduledStart));
  const [scheduledEnd, setScheduledEnd] = useState(toLocalInput(step?.scheduledEnd));
  const [dependsOn, setDependsOn] = useState((step?.dependsOn || []).map((d) => d.id));
  const [clientVisible, setClientVisible] = useState(step ? step.clientVisible : true);
  const others = steps.filter((s) => s.id !== step?.id);

  return (
    <form
      className="mt-3 border border-border rounded-lg p-3 space-y-3 bg-muted/30"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({
          title: title.trim(),
          description: description.trim() || null,
          assignedToId: assignedToId || null,
          estimatedHours: estimatedHours === "" ? null : Number(estimatedHours),
          dueDate: dueDate || null,
          scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null,
          scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
          dependsOn,
          clientVisible,
        });
      }}
    >
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">{t("app.jobPlan.form.title", "Step")}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card" placeholder={t("app.jobPlan.form.titlePlaceholder", "Trim & doors, 2 coats semi-gloss")} />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">{t("app.jobPlan.form.scope", "Scope (what the crew needs to know)")}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("app.jobPlan.form.assignee", "Assignee")}</label>
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} disabled={!canAssign} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-60">
            <option value="">{t("app.jobPlan.form.unassigned", "Unassigned")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("app.jobPlan.form.hours", "Estimated hours")}</label>
          <input type="number" step="0.5" min="0" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("app.jobPlan.form.day", "Day")}</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("app.jobPlan.form.blockStart", "Block starts")}</label>
          <input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("app.jobPlan.form.blockEnd", "Block ends")}</label>
          <input type="datetime-local" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card" />
        </div>
      </div>
      {others.length > 0 && (
        <fieldset>
          <legend className="block text-xs font-medium text-foreground mb-1">{t("app.jobPlan.form.dependsOn", "Waits on")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {others.map((o) => {
              const on = dependsOn.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setDependsOn((d) => (on ? d.filter((x) => x !== o.id) : [...d, o.id]))}
                  className={`text-xs px-2 py-1 rounded-full border ${on ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-foreground hover:bg-muted"}`}
                >
                  {o.title}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} />
        {t("app.jobPlan.form.clientVisible", "Show this step on the client's portal")}
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !title.trim()} className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
          {busy ? <Loader2 size={13} className="animate-spin" /> : t("app.action.save", "Save")}
        </button>
        <button type="button" onClick={onCancel} className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg">
          {t("app.action.cancel")}
        </button>
      </div>
    </form>
  );
}
