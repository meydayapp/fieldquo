"use client";

// app/components/team/CorrectionRequests.js
//
// The crew's correction requests, on Timesheets — where a manager already
// approves hours, so approving a correction is part of the same pass
// (owner, 2026-10-03: crew fix their hours only as a request a manager
// approves). Each row says what the entry says now, what they asked for and
// why; Approve applies it to the same entry (PATCH /api/time-entries/
// corrections/[id], which keeps what the entry said before on the request),
// Reject leaves the entry exactly as it is, with an optional note back.
//
// Drawn only for someone the decide route answers — the same rule, read
// from the same grid: an owner/admin/supervisor seat with Time Tracking at
// "everyone's". Anyone else gets no section rather than buttons that 403.
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { hasLevel } from "@/lib/permissions/enforce";
import { activityName, fmtDuration } from "@/app/components/timeclock/activityUi";

const APPROVER_ROLES = ["owner", "admin", "supervisor"];

export function canDecideCorrections(caller) {
  return Boolean(caller) && APPROVER_ROLES.includes(caller.role) && hasLevel(caller, "timeTracking", "view_record_edit_all");
}

function when(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function CorrectionRequests({ caller, activities, t, onApplied }) {
  const [rows, setRows] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const allowed = canDecideCorrections(caller);

  const load = useCallback(async () => {
    const result = await fetchList("/api/time-entries/corrections?status=pending");
    if (result.aborted) return;
    if (!result.ok) {
      setRows(null);
      setErrorKey(result.errorKey);
      return;
    }
    setErrorKey("");
    setRows(result.data?.corrections || []);
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) return null;
  if (errorKey) {
    return (
      <p className="mb-4 rounded-xl border border-border bg-card px-5 py-3 text-sm text-red-700 dark:text-red-300">
        {t("app.timesheets.corrections.loadError")}
      </p>
    );
  }
  if (!rows || rows.length === 0) return null;

  async function decide(row, decision) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/time-entries/corrections/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: notes[row.id] || null }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.timesheets.corrections.decideError"));
        return;
      }
      await load();
      if (decision === "approve") await onApplied?.();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20" data-correction-requests>
      <h2 className="px-5 pt-4 text-sm font-bold text-foreground">
        {t("app.timesheets.corrections.title", { count: rows.length })}
      </h2>
      <p className="px-5 text-xs text-muted-foreground">{t("app.timesheets.corrections.intro")}</p>
      <ul className="mt-2 divide-y divide-border">
        {rows.map((row) => {
          const e = row.timeEntry;
          const wasMs = e?.clockIn && e?.clockOut ? new Date(e.clockOut) - new Date(e.clockIn) : null;
          const askMs = new Date(row.clockOut) - new Date(row.clockIn);
          return (
            <li key={row.id} className="px-5 py-3 text-sm">
              <div className="font-medium text-foreground">{e?.worker?.name || "—"}</div>
              <div className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
                <div className="text-muted-foreground">
                  <span className="font-semibold">{t("app.timesheets.corrections.now")}</span>{" "}
                  {e ? (
                    <>
                      {activityName(e.activity || (e.jobId ? "visit" : "general"), activities, t)} · {when(e.clockIn)} – {e.clockOut ? when(e.clockOut) : t("app.clock.open")}
                      {wasMs != null ? ` (${fmtDuration(wasMs, t)})` : ""}
                      {e.job?.title ? ` · ${e.job.title}` : ""}
                    </>
                  ) : (
                    t("app.timesheets.corrections.entryGone")
                  )}
                </div>
                <div className="text-foreground">
                  <span className="font-semibold">{t("app.timesheets.corrections.asked")}</span>{" "}
                  {activityName(row.activity || "general", activities, t)} · {when(row.clockIn)} – {when(row.clockOut)} ({fmtDuration(askMs, t)})
                  {row.job?.title ? ` · ${row.job.title}` : ""}
                </div>
              </div>
              <p className="mt-1 text-xs text-foreground">
                <span className="font-semibold">{t("app.timesheets.corrections.reason")}</span> {row.reason}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={notes[row.id] || ""}
                  onChange={(ev) => setNotes((n) => ({ ...n, [row.id]: ev.target.value.slice(0, 500) }))}
                  placeholder={t("app.timesheets.corrections.notePlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => decide(row, "approve")}
                  disabled={busyId === row.id || !e}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-inverted px-3 text-xs font-semibold text-inverted-foreground disabled:opacity-50"
                >
                  {busyId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {t("app.timesheets.corrections.approve")}
                </button>
                <button
                  type="button"
                  onClick={() => decide(row, "reject")}
                  disabled={busyId === row.id}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  <X size={13} />
                  {t("app.timesheets.corrections.reject")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
