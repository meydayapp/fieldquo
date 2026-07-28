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

const PRIORITY_STYLES = {
  urgent: "bg-red-50 text-red-700 border-red-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  normal: "bg-gray-50 text-gray-600 border-gray-200",
  low: "bg-gray-50 text-gray-400 border-gray-200",
};

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function TasksPage() {
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
      const [t, m] = await Promise.all([
        fetch("/api/tasks").then((r) => (r.ok ? r.json() : [])),
        // Assignee list. Non-fatal if it fails — the page still works, you
        // just can't hand a task to someone else.
        fetch("/api/settings/members").then((r) => (r.ok ? r.json() : [])),
      ]);
      setTasks(Array.isArray(t) ? t : []);
      setMembers(Array.isArray(m) ? m : []);
    } catch {
      setError("Couldn't load tasks.");
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
      .filter((t) =>
        showDone ? true : !["done", "cancelled"].includes(t.status),
      )
      .map((t) => ({
        ...t,
        overdue:
          t.dueDate &&
          new Date(t.dueDate) < today &&
          !["done", "cancelled"].includes(t.status),
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
    (t) => !["done", "cancelled"].includes(t.status),
  ).length;

  async function toggle(task) {
    const status = task.status === "done" ? "open" : "done";
    setBusyId(task.id);
    setError("");
    const before = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status } : t)),
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't update that task.");
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
      if (!res.ok) throw new Error(d?.error || "Couldn't create that task.");
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
      <div className="p-6 max-w-3xl mx-auto animate-pulse h-96 bg-gray-200 rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            {openCount} open{openCount === 1 ? "" : ""}
          </p>
        </div>
        <button
          onClick={() =>
            setDraft({
              title: "",
              description: "",
              dueDate: "",
              priority: "normal",
              assignedToId: "",
            })
          }
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-full"
        >
          <Plus size={14} /> New task
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {draft && (
        <div className="bg-white border border-gray-900 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">New task</h2>
            <button
              onClick={() => setDraft(null)}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <input
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="What needs doing?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            placeholder="Any detail worth keeping (optional)"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Due
              </label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) =>
                  setDraft({ ...draft, dueDate: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Priority
              </label>
              <select
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {["low", "normal", "high", "urgent"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Assign to
              </label>
              <select
                value={draft.assignedToId}
                onChange={(e) =>
                  setDraft({ ...draft, assignedToId: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Nobody</option>
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
            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Add task
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <ListChecks size={30} className="text-gray-300 mx-auto" />
          <p className="mt-3 font-medium text-gray-900">
            {showDone ? "Nothing here" : "Nothing outstanding"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
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
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <Circle
                      size={18}
                      className="text-gray-300 hover:text-gray-500"
                    />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium ${
                        done ? "text-gray-400 line-through" : "text-gray-900"
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
                        overdue
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">
                      {task.description}
                    </p>
                  )}

                  <div className="text-xs text-gray-400 mt-1 flex gap-2 flex-wrap">
                    {task.dueDate && (
                      <span>
                        Due{" "}
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
        onClick={() => setShowDone((v) => !v)}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        {showDone ? "Hide completed" : "Show completed"}
      </button>
    </div>
  );
}
