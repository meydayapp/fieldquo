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
import {
  Plus,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  ListChecks,
  X,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const PRIORITY_STYLES = {
  urgent: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  high: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  normal: "bg-muted text-muted-foreground border-border",
  low: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function TasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [taskList, m] = await Promise.all([
        fetch("/api/tasks").then((r) => (r.ok ? r.json() : [])),
        // Assignee list. Non-fatal if it fails — the page still works, you
        // just can't hand a task to someone else.
        fetch("/api/settings/members").then((r) => (r.ok ? r.json() : [])),
      ]);
      setTasks(Array.isArray(taskList) ? taskList : []);
      setMembers(Array.isArray(m) ? m : []);
    } catch {
      setError(t("app.tasks.loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const today = startOfToday();
    return tasks
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

  const openCount = tasks.filter(
    (task) => !["done", "cancelled"].includes(task.status),
  ).length;

  async function toggle(task) {
    const status = task.status === "done" ? "open" : "done";
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

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.tasks.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {openCount} {t("app.tasks.open")}{openCount === 1 ? "" : ""}
          </p>
        </div>
        <button
          data-tour="tasks-new"
          onClick={() =>
            setDraft({
              title: "",
              description: "",
              dueDate: "",
              priority: "normal",
              assignedToId: "",
            })
          }
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-full"
        >
          <Plus size={14} /> {t("app.tasks.new")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {draft && (
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
                {["low", "normal", "high", "urgent"].map((p) => (
                  <option key={p} value={p}>
                    {p}
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

      {visible.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ListChecks size={30} className="text-muted-foreground mx-auto" />
          <p className="mt-3 font-medium text-foreground">
            {showDone ? t("app.tasks.emptyDone") : t("app.tasks.emptyOpen")}
          </p>
        </div>
      ) : (
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
                        {task.priority}
                      </span>
                    )}
                    {task.overdue && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-600 text-white">
                        {t("app.tasks.overdue")}
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
