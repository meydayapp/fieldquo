// app/components/sales/UnloggedCalls.js
//
// The calls a rep has not written up, and the two minutes to do it.
//
// ══ Why a list exists at all ══════════════════════════════════════════════
//
// "Write it up later" (CallPanel, OutcomeForm) frees the dialler without an
// outcome. That is the right trade on the floor — the next call matters
// more than the form — and it is only honest if "later" is a place the rep
// actually returns to. This is that place: the Today card counts it, the
// Queue badge wears the number, signing out and "Release the rest" show it
// first, and the day-end cron logs whatever is still here as the line's own
// verdict (or no answer), marked autoLogged, so no count ever carries an
// empty outcome past the rep's day.
//
// ══ One list, one form, one write path ════════════════════════════════════
//
// The rows come from GET /api/sales/calls/unlogged — the same WHERE the
// badge counts. Each row opens the same OutcomeForm the pop-up uses, with
// its own draft, and saves through POST /api/sales/calls `disposition`
// exactly as the panel does. Nothing here names a code.
"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardCheck, Loader2, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { endOfCall } from "@/lib/sales/calls/dispositions";
import { foldChoice } from "@/lib/sales/calls/outcomeChoices";
import OutcomeForm, { EMPTY_DRAFT } from "./OutcomeForm";

const BTN = "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

/** "They hung up · 4 s" in the rep's language, or "" when the line knows nothing. */
export function endedSentence(t, row) {
  const e = endOfCall(row);
  if (!e) return "";
  const ended = t(e.key);
  return typeof e.talkSeconds === "number" ? t("app.salesCall.ended.withTalk", { ended, seconds: e.talkSeconds }) : ended;
}

function whenLabel(iso, language) {
  try {
    return new Intl.DateTimeFormat(language || undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return String(iso || "");
  }
}

/**
 * The list itself. `onCountChange(n)` fires after every load so a host can
 * close when it reaches zero.
 */
export function UnloggedCallsList({ onCountChange = null, compact = false }) {
  const { t, language } = useTranslation();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const body = await fetchJson("/api/sales/calls/unlogged");
      const items = Array.isArray(body?.items) ? body.items : [];
      setRows(items);
      setError("");
      onCountChange?.(items.length);
    } catch (err) {
      setError(err?.message || t("app.salesCall.unlogged.loadFailed"));
    }
    // onCountChange is a host callback; re-arming on its identity would
    // reload on every host render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(row) {
    const fold = foldChoice({
      key: draft.choice,
      note: draft.note,
      whenKind: draft.whenKind,
      whenAt: draft.whenAt ? new Date(draft.whenAt) : null,
      notOwner: draft.notOwner,
      interested: draft.interested,
      which: draft.which,
      now: new Date(),
    });
    if (!fold.ok) {
      setFormError(t(fold.reasonKey));
      return;
    }
    setBusy("disposition");
    setFormError("");
    try {
      await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disposition",
          attemptId: row.id,
          disposition: fold.code,
          note: fold.note,
          callbackAt: fold.callbackAt ? fold.callbackAt.toISOString() : null,
        }),
      });
      setOpen(null);
      setDraft(EMPTY_DRAFT);
      await load();
    } catch (err) {
      setFormError(err?.message || t("app.salesCall.outcomeSaveFailed"));
    } finally {
      setBusy("");
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-2" role="alert">
        <p className="break-words">{error}</p>
        <button type="button" className={`${BTN} border border-amber-400`} onClick={load}>
          {t("app.salesCall.unlogged.tryAgain")}
        </button>
      </div>
    );
  }
  if (rows === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> {t("app.salesCall.unlogged.loading")}
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground break-words" data-unlogged-none>{t("app.salesCall.unlogged.none")}</p>;
  }

  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border" data-unlogged-list={rows.length}>
      {rows.map((row) => {
        const isOpen = open === row.id;
        const ended = endedSentence(t, row);
        return (
          <li key={row.id} className="px-3 py-2 space-y-2" data-unlogged-row={row.id}>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{row.businessName || row.toE164}</span>
                <span className="block text-xs text-muted-foreground break-words" data-unlogged-direction={row.direction === "in" ? "in" : "out"}>
                  {/* By direction. An inbound row is one THEY placed: "They
                      called you back from … at …", never "You rang" — the
                      2026-09-17 mistake, in the panel, that this list now
                      carries instead. */}
                  {row.direction === "in"
                    ? t("app.salesCall.calledYouBack", { number: row.toE164, time: whenLabel(row.dialledAt, language) })
                    : `${whenLabel(row.dialledAt, language)}${row.businessName ? ` · ${row.toE164}` : ""}`}
                  {ended ? ` · ${ended}` : ""}
                </span>
              </span>
              <button
                type="button"
                className={`${BTN} ${compact ? "min-h-[36px] px-3" : ""} ${isOpen ? "border border-border bg-card" : "bg-primary text-primary-foreground"}`}
                onClick={() => {
                  setOpen(isOpen ? null : row.id);
                  setDraft(EMPTY_DRAFT);
                  setFormError("");
                }}
                data-unlogged-write-up
              >
                {isOpen ? t("app.salesCall.unlogged.close") : t("app.salesCall.unlogged.writeUp")}
              </button>
            </div>
            {isOpen ? (
              <OutcomeForm t={t} draft={draft} setDraft={setDraft} busy={busy} onSave={() => save(row)} error={formError} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The gate: "You have N calls to write up — do it now (2 minutes) or they
 * are logged as 'not reached' at day end." with the list, and the one
 * button that goes through anyway. Rendered by the shell before sign-out
 * and by the queue before "Release the rest". Closes itself when the list
 * reaches zero (onAllDone).
 */
export function UnloggedCallsGate({ open, count = null, onClose, onProceed, proceedLabel, onAllDone = null }) {
  const { t } = useTranslation();
  const [n, setN] = useState(count);
  useEffect(() => {
    setN(count);
  }, [count, open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" data-unlogged-gate>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={t("app.salesCall.unlogged.close")} onClick={onClose} />
      <div role="dialog" aria-modal="false" aria-label={t("app.salesCall.unlogged.title")} className="relative w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card text-foreground shadow-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2">
            <ClipboardCheck size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold">{t("app.salesCall.unlogged.title")}</p>
              <p className="text-xs text-muted-foreground break-words">
                {Number.isFinite(n) && n > 0 ? t("app.salesCall.unlogged.gateBody", { count: t("app.salesCall.unlogged.count", { value: n }) }) : t("app.salesCall.unlogged.gateBodyNoCount")}
              </p>
            </div>
          </div>
          <button type="button" className="shrink-0 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg hover:bg-muted" onClick={onClose} aria-label={t("app.salesCall.unlogged.close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <UnloggedCallsList
          compact
          onCountChange={(c) => {
            setN(c);
            if (c === 0) onAllDone?.();
          }}
        />
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" className={`${BTN} border border-border bg-card text-foreground`} onClick={onClose}>
            {t("app.salesCall.unlogged.stay")}
          </button>
          {onProceed ? (
            <button type="button" className={`${BTN} bg-muted text-foreground`} onClick={onProceed} data-unlogged-proceed>
              {proceedLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
