// app/platform/support/page.js
//
// FieldQuo's escalation queue: the technical problems sales reps report about
// the companies they signed up.
//
// ══ What was here before ═══════════════════════════════════════════════════
//
// Nothing. There was no support channel anywhere in the product — no model, no
// route, no screen. A rep who heard "the invoice email never arrived" from a
// contractor they had signed up either texted the owner or dropped it.
//
// ══ Superadmin only, and the refusal is rendered rather than the controls ══
//
// "support:manage" is in SUPERADMIN_ONLY_PERMISSIONS. A lower role sees the
// PlatformWriteGate block explaining why, not a queue of customer complaints
// with the buttons missing — the four screens that got that wrong are the
// reason that component exists.
//
// ══ Every control here does the thing ══════════════════════════════════════
//
// Status buttons are rendered ONLY for transitions lib/support/escalation.js
// says are legal, so there is no button whose only outcome is a 409. The
// internal-note checkbox writes `internal`, and /api/sales/support filters on
// it — the flag is read, not decorative.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  LifeBuoy,
  Lock,
  MessageSquare,
} from "lucide-react";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";
import { fetchJson } from "@/lib/fetchJson";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUPPORT_STATUSES,
  canTransition,
} from "@/lib/support/escalation";

// Built from the shared list rather than typed out, so a fourth status could
// never exist here and nowhere else.
const FILTERS = [
  ...SUPPORT_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
  { value: "", label: "All" },
];

const PRIORITY_STYLE = {
  urgent: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  high: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
};

const STATUS_STYLE = {
  open: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  in_progress: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  resolved: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300",
};

function fmt(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function PlatformSupportPage() {
  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("open");
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    setFailed(false);
    setData(null);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      const query = params.toString();
      setData(await fetchJson(`/api/platform/support${query ? `?${query}` : ""}`));
    } catch (err) {
      // Never an empty list on a failed fetch: "no tickets" and "we could not
      // ask" are different facts and the queue is the wrong place to confuse
      // them.
      setFailed(true);
      setError(err.message || "Couldn't load the queue.");
    }
  }, [filter]);

  useEffect(() => {
    if (isSuperadmin) load();
  }, [isSuperadmin, load]);

  const loadDetail = useCallback(async (id) => {
    setDetail(null);
    setDetailFailed(false);
    setError("");
    try {
      const res = await fetchJson(`/api/platform/support/${encodeURIComponent(id)}`);
      setDetail(res.ticket);
    } catch (err) {
      setDetailFailed(true);
      setError(err.message || "Couldn't open that ticket.");
    }
  }, []);

  useEffect(() => {
    if (openId) loadDetail(openId);
    else setDetail(null);
  }, [openId, loadDetail]);

  async function patch(payload, successMessage) {
    if (!openId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetchJson(`/api/platform/support/${encodeURIComponent(openId)}`, {
        method: "PATCH",
        body: payload,
      });
      setDetail(res.ticket);
      setNote("");
      setInternal(false);
      setNotice(successMessage);
      // The list carries the status and the ordering, so it is re-read rather
      // than patched in place — a row edited locally is a row that disagrees
      // with the server the moment somebody else touches it.
      await load();
    } catch (err) {
      setError(err.message || "That didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  // Only the moves the state machine actually allows get a button.
  const moves = useMemo(
    () =>
      detail ? SUPPORT_STATUSES.filter((s) => canTransition(detail.status, s)) : [],
    [detail],
  );

  const waiting = (data?.counts?.open || 0) + (data?.counts?.in_progress || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support escalations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Technical problems sales reps have reported about the companies they signed up.
          {waiting > 0 && (
            <>
              {" "}
              <span className="font-medium text-foreground">{waiting} still open.</span>
            </>
          )}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-2.5 text-sm text-muted-foreground">
        <LifeBuoy size={16} className="shrink-0 mt-0.5 text-foreground" />
        <p>
          A rep can only raise a ticket about a company <strong className="text-foreground">attributed to them</strong>,
          and every new ticket is assigned to the first active superadmin — the owner account. Nothing on this
          page touches a contractor&apos;s own records; a ticket is FieldQuo&apos;s note about a problem, not an
          edit to their data.
        </p>
      </div>

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Reading and working the support queue"
        who="superadmin"
      >
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              onClick={() => {
                setFilter(f.value);
                setOpenId(null);
              }}
              className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium border ${
                filter === f.value
                  ? "bg-inverted text-inverted-foreground border-inverted"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
              {f.value && data?.counts?.[f.value] > 0 && (
                <span className="opacity-70"> {data.counts[f.value]}</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {notice && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {notice}
          </div>
        )}

        {failed ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <AlertCircle size={28} className="text-muted-foreground mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">
              The queue could not be read. This is a failed request, not an empty queue.
            </p>
            <button
              onClick={load}
              className="mt-3 min-h-[44px] px-4 text-sm font-semibold text-foreground underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : !data.tickets?.length ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <LifeBuoy size={28} className="text-muted-foreground mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">
              No {filter ? STATUS_LABELS[filter].toLowerCase() : ""} escalations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.tickets.map((t) => {
              const isOpen = openId === t.id;
              return (
                <div key={t.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenId(isOpen ? null : t.id)}
                    className="w-full text-left p-5 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] || "bg-muted text-muted-foreground"}`}
                        >
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                        <span
                          className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${PRIORITY_STYLE[t.priority] || "bg-muted text-muted-foreground"}`}
                        >
                          {PRIORITY_LABELS[t.priority] || t.priority}
                        </span>
                        {!t.assignedAdminId && (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                            Unassigned
                          </span>
                        )}
                        {t.noteCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare size={11} /> {t.noteCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground break-words">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.company?.name || "—"} · raised by {t.salesRep?.name || t.salesRep?.email || "—"} ·{" "}
                        {fmt(t.createdAt)}
                        {t.assignedAdmin?.email ? ` · assigned to ${t.assignedAdmin.email}` : ""}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className={`shrink-0 mt-1 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-border p-5 space-y-4">
                      {detailFailed ? (
                        <div className="text-sm text-muted-foreground">
                          This ticket could not be opened.{" "}
                          <button
                            onClick={() => loadDetail(t.id)}
                            className="font-semibold text-foreground underline underline-offset-2"
                          >
                            Try again
                          </button>
                        </div>
                      ) : !detail || detail.id !== t.id ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 size={14} className="animate-spin" /> Opening…
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {detail.body}
                          </p>

                          {detail.notes?.length > 0 && (
                            <div className="space-y-2">
                              {detail.notes.map((n) => (
                                <div
                                  key={n.id}
                                  className={`rounded-lg p-3 text-sm ${
                                    n.internal
                                      ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900"
                                      : "bg-muted"
                                  }`}
                                >
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {n.authorKind === "admin"
                                      ? n.authorAdmin?.email || "FieldQuo"
                                      : n.authorRep?.name || n.authorRep?.email || "The rep"}
                                    {" · "}
                                    {fmt(n.createdAt)}
                                    {n.kind === "status_change" ? " · status" : ""}
                                    {n.internal ? " · internal, the rep cannot see this" : ""}
                                  </p>
                                  <p className="text-foreground whitespace-pre-wrap break-words">{n.body}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-2">
                            <textarea
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              rows={3}
                              placeholder="Reply to the rep, or record what you found…"
                              className="w-full rounded-lg border border-border bg-card p-3 text-sm text-foreground"
                            />
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={internal}
                                onChange={(e) => setInternal(e.target.checked)}
                                className="h-4 w-4"
                              />
                              <Lock size={12} />
                              Internal — keep this out of the rep&apos;s thread
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => patch({ note, internal }, "Note added.")}
                                disabled={busy || !note.trim()}
                                className="min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-2"
                              >
                                {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                                Add note
                              </button>
                              {/* Only legal transitions get a button, so no
                                  control here can exist whose only possible
                                  outcome is a 409. */}
                              {moves.map((s) => (
                                <button
                                  key={s}
                                  onClick={() =>
                                    patch(
                                      { status: s, ...(note.trim() ? { note, internal } : {}) },
                                      `Moved to ${STATUS_LABELS[s].toLowerCase()}.`,
                                    )
                                  }
                                  disabled={busy}
                                  className="min-h-[44px] px-4 rounded-lg text-sm font-semibold border border-border text-foreground disabled:opacity-60"
                                >
                                  Move to {STATUS_LABELS[s].toLowerCase()}
                                </button>
                              ))}
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Raised {fmt(detail.createdAt)}
                            {detail.resolvedAt ? ` · resolved ${fmt(detail.resolvedAt)}` : ""}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PlatformWriteGate>
    </div>
  );
}
