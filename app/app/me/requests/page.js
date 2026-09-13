"use client";

// app/app/me/requests/page.js
//
// The Requests hub — Homebase's four rows: Time off · Trade · Cover ·
// Availability — plus, for a manager, a "Needs your approval" tab with the
// same Approve / Decline the scheduler's Requests panel offers. One list
// component for every kind of row: a request is always "who, which shift,
// what state, what you can do about it".
//
// Everything a button does here is a POST to /api/shift-requests/[id]; the
// state machine on the server decides what is allowed, and the refusal
// sentence it returns is shown where the button was.
import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, CalendarClock, Calendar, Loader2, Users } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatDayMonth, formatTimeOfDay } from "@/lib/format/localeDate";
import { reportResponseError } from "@/lib/clientErrors";
import MeShell from "@/app/components/me/MeShell";
import { BigRow, EmptyNote, MeLoad, RowList, useMeData } from "@/app/components/me/bits";
import ShiftRequestDialog from "@/app/components/me/ShiftRequestDialog";

const STATUS_TONE = {
  pending_peer: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  pending_manager: "bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
  approved: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  declined: "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

export default function MeRequestsPage() {
  const { t, language } = useTranslation();
  const { data, errorKey, loading, reload } = useMeData("/api/shift-requests");
  const [tab, setTab] = useState("mine");
  const [dialog, setDialog] = useState(null); // { shift, mode }
  const [picker, setPicker] = useState(null); // "trade" | "cover" — choosing which of my shifts
  const [busyId, setBusyId] = useState(null);

  async function act(id, action) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/shift-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!res.ok) return reportResponseError(res, t("app.me.requests.actError"));
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  const showTabs = Boolean(data?.manager);
  const list = tab === "approvals" ? data?.approvals || [] : tab === "open" ? data?.open || [] : data?.mine || [];

  return (
    <MeShell title={t("app.me.more.requests")}>
      <MeLoad loading={loading} errorKey={errorKey} reload={reload}>
        {data ? (
          <div className="space-y-4">
            <RowList>
              <BigRow icon={CalendarClock} title={t("app.me.requests.timeOff")} subtitle={t("app.me.requests.timeOffNote")} href="/app/time-off" />
              <BigRow icon={ArrowRightLeft} title={t("app.me.requests.trade")} subtitle={t("app.me.requests.tradeNote")} onClick={() => setPicker("trade")} />
              <BigRow icon={Users} title={t("app.me.requests.cover")} subtitle={t("app.me.requests.coverNote")} onClick={() => setPicker("cover")} />
              <BigRow icon={Calendar} title={t("app.me.requests.availability")} subtitle={t("app.me.requests.availabilityNote")} href="/app/me/availability" />
            </RowList>

            <div role="tablist" className="flex gap-1 rounded-xl border border-border p-1">
              {[
                ["mine", t("app.me.requests.tabMine"), data.mine.length],
                ["open", t("app.me.requests.tabOpen"), data.open.length],
                ...(showTabs ? [["approvals", t("app.me.requests.tabApprovals"), data.approvals.length]] : []),
              ].map(([key, label, n]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-[44px] flex-1 rounded-lg px-2 text-sm font-semibold ${tab === key ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                  {label} {n ? <span className="tabular-nums opacity-80">({n})</span> : null}
                </button>
              ))}
            </div>

            {list.length === 0 ? (
              <EmptyNote>{tab === "approvals" ? t("app.me.requests.noneToApprove") : tab === "open" ? t("app.me.requests.noneOpen") : t("app.me.requests.noneMine")}</EmptyNote>
            ) : (
              <ul className="space-y-2">
                {list.map((r) => (
                  <RequestCard key={r.id} r={r} me={data.me} manager={data.manager} tab={tab} t={t} language={language} busy={busyId === r.id} onAct={(a) => act(r.id, a)} />
                ))}
              </ul>
            )}

            {!data.needsApproval ? <p className="text-xs text-muted-foreground">{t("app.me.requests.noApprovalCompany")}</p> : null}
            {picker ? <MyShiftPicker mode={picker} t={t} language={language} onClose={() => setPicker(null)} onPick={(shift) => { setPicker(null); setDialog({ shift, mode: picker }); }} /> : null}
            {dialog ? <ShiftRequestDialog shift={dialog.shift} mode={dialog.mode} partners={data.partners} needsApproval={data.needsApproval} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await reload(); }} /> : null}
          </div>
        ) : null}
      </MeLoad>
    </MeShell>
  );
}

function RequestCard({ r, me, manager, tab, t, language, busy, onAct }) {
  const isFrom = me && r.fromWorkerId === me.id;
  const isTo = me && r.toWorkerId === me.id;
  const claim = !r.fromWorkerId;
  const pending = r.status === "pending_peer" || r.status === "pending_manager";
  const canCancel = pending && ((isFrom && !claim) || (claim && isTo));
  const canAccept = r.status === "pending_peer" && !isFrom && (isTo || (!r.toWorkerId && tab === "open"));
  const canApprove = r.status === "pending_manager" && manager && tab === "approvals";
  const canManagerDecline = pending && manager && tab === "approvals";
  const shift = r.shift;
  const who = claim
    ? t("app.me.requests.claimLine", { name: r.toWorker?.name || "" })
    : t("app.me.requests.line", { kind: t(`app.me.kindRequest.${r.kind}`), from: r.fromWorker?.name || "", to: r.toWorker?.name || t("app.me.requests.anyone") });
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{who}</div>
          {shift ? (
            <div className="text-sm text-muted-foreground">
              {formatDayMonth(shift.start, language)} · {formatTimeOfDay(shift.start, language)} – {formatTimeOfDay(shift.end, language)}
              {shift.job?.client?.name ? ` · ${shift.job.client.name}` : ""}
            </div>
          ) : null}
          {r.kind === "trade" && r.offeredShift ? (
            <div className="text-xs text-muted-foreground">
              {t("app.me.requests.inReturnLine", { when: `${formatDayMonth(r.offeredShift.start, language)} ${formatTimeOfDay(r.offeredShift.start, language)}–${formatTimeOfDay(r.offeredShift.end, language)}` })}
            </div>
          ) : null}
          {r.note ? <div className="mt-1 text-xs text-muted-foreground">“{r.note}”</div> : null}
          {r.decisionNote ? <div className="mt-1 text-xs text-red-700 dark:text-red-300">{r.decisionNote}</div> : null}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[r.status] || STATUS_TONE.cancelled}`}>{t(`app.me.requests.status.${r.status}`)}</span>
      </div>
      {canAccept || canApprove || canManagerDecline || canCancel ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canAccept ? (
            <>
              <button type="button" disabled={busy} onClick={() => onAct("accept")} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? <Loader2 size={16} className="animate-spin" /> : t("app.me.requests.accept")}
              </button>
              <button type="button" disabled={busy} onClick={() => onAct("decline")} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold text-foreground disabled:opacity-60">
                {t("app.me.action.decline")}
              </button>
            </>
          ) : null}
          {canApprove ? (
            <button type="button" disabled={busy} onClick={() => onAct("approve")} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : t("app.me.action.approve")}
            </button>
          ) : null}
          {canManagerDecline && !canAccept ? (
            <button type="button" disabled={busy} onClick={() => onAct("decline")} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold text-foreground disabled:opacity-60">
              {t("app.me.action.decline")}
            </button>
          ) : null}
          {canCancel ? (
            <button type="button" disabled={busy} onClick={() => onAct("cancel")} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground disabled:opacity-60">
              {t("app.me.requests.withdraw")}
            </button>
          ) : null}
        </div>
      ) : null}
      {r.status === "pending_peer" && isFrom && !r.toWorkerId ? <p className="mt-2 text-xs text-muted-foreground">{t("app.me.requests.waitingAnyone")}</p> : null}
    </li>
  );
}

/**
 * "Which shift?" — the caller's own published, upcoming shifts, from the
 * same GET /api/shifts the schedule reads. A shift with a request already
 * in flight is listed and disabled, with the state, rather than hidden.
 */
function MyShiftPicker({ mode, t, language, onClose, onPick }) {
  const from = new Date();
  const to = new Date(from.getTime() + 28 * 86_400_000);
  const { data, errorKey, loading, reload } = useMeData(`/api/shifts?from=${from.toISOString()}&to=${to.toISOString()}`);
  const shifts = (data?.shifts || []).filter((s) => new Date(s.start) > from);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-2xl sm:rounded-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">{mode === "trade" ? t("app.me.requests.tradeWhich") : t("app.me.requests.coverWhich")}</h2>
        <div className="mt-3">
          <MeLoad loading={loading} errorKey={errorKey} reload={reload}>
            {shifts.length === 0 ? (
              <EmptyNote>{t("app.me.noShiftsYet")}</EmptyNote>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {shifts.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => onPick(s)} className="flex min-h-[56px] w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/60">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">
                          {formatDayMonth(s.start, language)} · {formatTimeOfDay(s.start, language)} – {formatTimeOfDay(s.end, language)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{s.job?.client?.name || s.job?.title || t("app.me.noJob")}</span>
                      </span>
                      <ArrowRightLeft size={16} className="shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </MeLoad>
        </div>
        <button type="button" onClick={onClose} className="mt-3 min-h-[44px] w-full rounded-xl border border-border text-sm font-semibold text-foreground">
          {t("app.action.cancel")}
        </button>
      </div>
    </div>
  );
}
