// app/components/leads/ConversationReviewDialog.js
//
// "Review leads made from conversations" (lib/leads/conversationReview.js):
// every lead that came from a Facebook / Instagram / WhatsApp conversation,
// re-classified, with what the review suggests — remove (only a tap / not
// relevant) or keep — and why, in the person's own words. Nothing happens
// until a person confirms: the suggested ones start ticked, any can be
// unticked, and only a lead the review itself suggests removing can be ticked
// at all (the server refuses the rest the same way).
//
// Confirm deletes the ticked leads with "don't create a lead from this
// conversation again" — the same delete the board's own uses.
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import AlertDialog from "@/app/components/AlertDialog";
import { reportResponseError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { TierChip } from "@/app/components/leads/QualificationControl";

const WHY_KEYS = {
  tap_only: "app.leads.convReview.why.tapOnly",
  not_relevant: "app.leads.convReview.why.notRelevant",
  lead: "app.leads.convReview.why.lead",
  conversation: "app.leads.convReview.why.conversation",
  quoted: "app.leads.convReview.why.quoted",
  decided: "app.leads.convReview.why.decided",
  no_conversation: "app.leads.convReview.why.noConversation",
};

export default function ConversationReviewDialog({ open, onClose, onDeleted, t }) {
  const [state, setState] = useState({ loading: false, rows: null, summary: null, err: "" });
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setState({ loading: true, rows: null, summary: null, err: "" });
    setPicked(new Set());
    (async () => {
      try {
        const res = await fetch("/api/leads/review-conversations");
        if (!res.ok) {
          await reportResponseError(res, (msg) => live && setState({ loading: false, rows: null, summary: null, err: msg }), t("app.leads.convReview.loadError"));
          return;
        }
        const data = await res.json();
        if (!live) return;
        const rows = Array.isArray(data.rows) ? data.rows : [];
        setState({ loading: false, rows, summary: data.summary || null, err: "" });
        setPicked(new Set(rows.filter((r) => r.action === "remove").map((r) => r.id)));
      } catch {
        if (live) setState({ loading: false, rows: null, summary: null, err: t("app.leads.convReview.loadError") });
      }
    })();
    return () => {
      live = false;
    };
  }, [open, t]);

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function confirm() {
    if (!picked.size || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/leads/review-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...picked] }),
      });
      if (!res.ok) {
        await reportResponseError(res, (msg) => setState((s) => ({ ...s, err: msg })), t("app.leads.convReview.applyError"));
        return;
      }
      const data = await res.json();
      const deleted = Array.isArray(data.deleted) ? data.deleted : [];
      showToast({ tone: "success", message: t("app.leads.convReview.done", { count: deleted.length }) });
      onDeleted?.(deleted);
      onClose?.();
    } catch {
      setState((s) => ({ ...s, err: t("app.leads.convReview.applyError") }));
    } finally {
      setBusy(false);
    }
  }

  const rows = state.rows || [];
  const s = state.summary;

  return (
    <AlertDialog
      open={Boolean(open)}
      role="dialog"
      labelledBy="lead-review-title"
      describedBy="lead-review-body"
      initialFocusRef={cancelRef}
      onEscape={busy ? undefined : onClose}
      onScrim={busy ? undefined : onClose}
      scrimLabel={t("app.action.cancel", "Cancel")}
    >
      <h2 id="lead-review-title" className="text-base font-semibold text-foreground">
        {t("app.leads.convReview.title")}
      </h2>
      <div id="lead-review-body" className="space-y-1 text-sm text-muted-foreground">
        <p>{t("app.leads.convReview.body")}</p>
        {s && <p className="font-medium text-foreground">{t("app.leads.convReview.summary", { total: s.total, remove: s.remove, keep: s.keep })}</p>}
      </div>

      {state.loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> {t("app.leads.convReview.loading")}
        </div>
      )}

      {!state.loading && state.rows && rows.length === 0 && <p className="text-sm text-muted-foreground">{t("app.leads.convReview.empty")}</p>}

      {rows.length > 0 && (
        <ul className="max-h-[50vh] overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {rows.map((r) => {
            const removable = r.action === "remove";
            return (
              <li key={r.id} className="px-3 py-2">
                <label className={`flex items-start gap-2.5 min-h-[44px] ${removable ? "cursor-pointer" : ""}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={picked.has(r.id)}
                    disabled={!removable || busy}
                    onChange={() => toggle(r.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground break-words">{r.name}</span>
                      <TierChip qualification={r.qualification} t={t} />
                      <span className={`text-[11px] font-semibold ${removable ? "text-red-700 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}>
                        {removable ? t("app.leads.convReview.remove") : t("app.leads.convReview.keep")}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground break-words">
                      {WHY_KEYS[r.why] ? t(WHY_KEYS[r.why]) : ""}
                      {r.qualification?.params?.quote ? ` — “${r.qualification.params.quote}”` : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {state.err && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {state.err}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          disabled={busy}
          className="min-h-[44px] px-4 rounded-lg border border-border text-sm font-semibold text-foreground disabled:opacity-50"
        >
          {t("app.action.cancel", "Cancel")}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy || picked.size === 0}
          className="min-h-[44px] px-4 rounded-lg bg-red-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          {t("app.leads.convReview.confirm", { count: picked.size })}
        </button>
      </div>
    </AlertDialog>
  );
}
