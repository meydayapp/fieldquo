"use client";

// app/app/scheduler/RequestsPanel.js
//
// The "Requests" section on the scheduler: trades, covers and claims waiting
// on a manager, and availability changes waiting on one — with Approve /
// Decline in place. The same rows the phone shows under /app/me/requests'
// "Needs your approval" tab and the manager's Home; one route each
// (/api/shift-requests/[id], /api/availability-requests/[id]), so the three
// screens cannot disagree about what is waiting.
//
// Collapsed to a badge count until opened: the board is the screen, and a
// panel of zero requests would be a panel for nothing.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Inbox, Loader2, X } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { formatCalendarDay, formatDayMonth, formatTimeOfDay } from "@/lib/format/localeDate";

export default function RequestsPanel({ t, language, onChanged }) {
  const [swaps, setSwaps] = useState([]);
  const [avail, setAvail] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(false);
  // The two approval switches (owner/admin only — the route refuses others).
  const [rules, setRules] = useState(null);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([fetchList("/api/shift-requests"), fetchList("/api/availability-requests"), fetchList("/api/settings/scheduling")]);
    if (a.aborted || b.aborted) return;
    if (!a.ok || !b.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setSwaps(a.data?.approvals || []);
    setAvail(b.data?.approvals || []);
    if (c.ok) setRules(c.data);
  }, []);

  async function setRule(key, value) {
    const res = await fetch("/api/settings/scheduling", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
    if (!res.ok) return reportResponseError(res, t("app.scheduler.rulesSaveError"));
    setRules(await res.json());
  }
  useEffect(() => {
    load();
  }, [load]);

  async function decide(kind, id, action) {
    setBusy(id);
    try {
      const res = await fetch(kind === "swap" ? `/api/shift-requests/${id}` : `/api/availability-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return reportResponseError(res, t("app.me.manager.decideError"));
      await load();
      await onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  const count = swaps.length + avail.length;
  if (failed) return null;

  return (
    <div className="mb-3 rounded-xl border border-border bg-card print:hidden" data-requests-panel>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2 text-left">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
          <Inbox size={16} /> {t("app.scheduler.requestsTitle")}
          <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${count ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}>{count}</span>
        </span>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {count === 0 ? <p className="text-sm text-muted-foreground">{t("app.me.requests.noneToApprove")}</p> : null}
          {swaps.map((r) => (
            <Row
              key={r.id}
              title={
                r.fromWorkerId
                  ? t("app.me.requests.line", { kind: t(`app.me.kindRequest.${r.kind}`), from: r.fromWorker?.name || "", to: r.toWorker?.name || t("app.me.requests.anyone") })
                  : t("app.me.requests.claimLine", { name: r.toWorker?.name || "" })
              }
              subtitle={`${formatDayMonth(r.shift?.start, language)} ${formatTimeOfDay(r.shift?.start, language)}–${formatTimeOfDay(r.shift?.end, language)}${r.shift?.job?.client?.name ? ` · ${r.shift.job.client.name}` : ""}${r.note ? ` · “${r.note}”` : ""}`}
              busy={busy === r.id}
              onApprove={() => decide("swap", r.id, "approve")}
              onDecline={() => decide("swap", r.id, "decline")}
              t={t}
            />
          ))}
          {avail.map((r) => (
            <Row
              key={r.id}
              title={`${r.worker?.name || ""} · ${t("app.me.requests.availability")}`}
              subtitle={`${t("app.me.availability.effective", { date: formatCalendarDay(r.effectiveFrom, language) })} · ${t("app.me.availability.hoursPerWeek", { n: (r.hours || 0).toFixed(1) })}${r.note ? ` · “${r.note}”` : ""}`}
              busy={busy === r.id}
              onApprove={() => decide("avail", r.id, "approve")}
              onDecline={() => decide("avail", r.id, "decline")}
              detailHref="/app/me/availability"
              t={t}
            />
          ))}
          {rules?.canEdit ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground" data-rules>
              <label className="inline-flex min-h-[36px] items-center gap-2">
                <input type="checkbox" checked={rules.shiftSwapsNeedApproval} onChange={(e) => setRule("shiftSwapsNeedApproval", e.target.checked)} />
                {t("app.scheduler.ruleSwapsApproval")}
              </label>
              <label className="inline-flex min-h-[36px] items-center gap-2">
                <input type="checkbox" checked={rules.availabilityNeedsApproval} onChange={(e) => setRule("availabilityNeedsApproval", e.target.checked)} />
                {t("app.scheduler.ruleAvailabilityApproval")}
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({ title, subtitle, busy, onApprove, onDecline, detailHref = null, t }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      {detailHref ? (
        <Link href={detailHref} className="min-h-[36px] rounded-lg border border-border px-2 text-xs font-semibold leading-[36px] text-foreground">
          {t("app.me.manager.seeDiff")}
        </Link>
      ) : null}
      <button type="button" disabled={busy} onClick={onApprove} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-60">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t("app.me.action.approve")}
      </button>
      <button type="button" disabled={busy} onClick={onDecline} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-60">
        <X size={12} /> {t("app.me.action.decline")}
      </button>
    </div>
  );
}
