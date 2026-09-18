"use client";

// app/components/sales/AvailableReminder.js
//
// The pop-up a rep sees after signing in while shown as Off.
//
// ══ What it says, and the two things it offers ════════════════════════════
//
//   "You're shown as Off. Contractors who ring back can't reach you until
//    you're Available."           [Go available]   [OK]
//
// Go available posts the SAME choice the status picker posts — the
// `available` entry of STATUS_CHOICES through the provider's setStatus(), so
// the autodialler's "a press of Available" counter moves and the board reads
// it the same way. OK dismisses it for this browser session
// (lib/sales/availableReminder.js) and the next sign-in asks again. Nothing
// else: it does not set a state on the rep's behalf, because "reminded" and
// "moved without asking" are different things and the owner asked for the
// first.
//
// ══ When it must not appear ═══════════════════════════════════════════════
//
// shouldRemind() in lib/sales/availableReminder.js is the whole decision and
// this file adds nothing to it: not before presence has loaded (a modal that
// flashed on every page load and vanished would train reps to ignore it),
// not while a call is up or a contractor is ringing (the dock outranks
// everything), not when the tables are absent (Go available would post into
// a 503), and not once OK has been pressed this session.
//
// ══ Accessible, and the only modal in this chrome ═════════════════════════
//
// role="dialog" aria-modal="true", labelled by its own heading; focus moves
// to the primary button on open and is trapped between the two buttons
// (Tab wraps, Shift+Tab wraps); Escape is OK; the backdrop is a button
// that is also OK. Focus returns to whatever had it. z-[65]: above the
// tour's card (z-[60]) — a first-run rep should read this before the
// walkthrough — and below the incoming-call dock (z-[70]), which never
// coincides with it because a ring hides this anyway.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, PhoneOff } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { STATE_AVAILABLE } from "@/lib/sales/calls/agentState";
import { readReminderDismissed, shouldRemind, writeReminderDismissed } from "@/lib/sales/availableReminder";
import { useRepPresence } from "./RepStatus";

const BTN = "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export default function AvailableReminder() {
  const { t } = useTranslation();
  const { mounted, presence, store, choices, loading, callUp, inboundRinging, setStatus } = useRepPresence();
  // Read once on mount, after hydration — sessionStorage is not on the server.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(readReminderDismissed());
  }, []);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const primaryRef = useRef(null);
  const lastRef = useRef(null);
  const returnTo = useRef(null);

  const open = shouldRemind({
    mounted,
    loading,
    storeReady: store?.ready === true,
    state: presence?.state ?? null,
    callUp,
    inboundRinging,
    dismissed,
  });

  const dismiss = useCallback(() => {
    writeReminderDismissed();
    setDismissed(true);
  }, []);

  // Focus in, trap, Escape, focus back.
  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = typeof document !== "undefined" ? document.activeElement : null;
    primaryRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      if (e.key !== "Tab") return;
      const first = primaryRef.current;
      const last = lastRef.current;
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const back = returnTo.current;
      if (back && typeof back.focus === "function") back.focus();
    };
  }, [open, dismiss]);

  async function goAvailable() {
    const choice = (choices || []).find((c) => c.state === STATE_AVAILABLE);
    if (!choice || busy) return;
    setBusy(true);
    setRefused("");
    const result = await setStatus(choice);
    setBusy(false);
    if (result.ok) {
      // The state is now available, so shouldRemind() answers no on the next
      // render; the session flag is written too so a refresh before the
      // heartbeat's re-read cannot show it again.
      dismiss();
      return;
    }
    // A refusal is said, in the server's own sentence, and the modal stays:
    // closing it over a failed press would tell the rep something happened.
    setRefused(result.error || t("app.salesStatus.changeFailed"));
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center sm:justify-center p-4" data-available-reminder>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={t("app.salesStatus.reminder.ok")} onClick={dismiss} tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fq-available-reminder-title"
        aria-describedby="fq-available-reminder-body"
        className="relative w-full sm:max-w-md rounded-2xl bg-card text-foreground shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
            <PhoneOff size={18} />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id="fq-available-reminder-title" className="font-semibold text-base break-words">
              {t("app.salesStatus.reminder.title")}
            </h2>
            <p id="fq-available-reminder-body" className="text-sm text-muted-foreground break-words">
              {t("app.salesStatus.reminder.body")}
            </p>
          </div>
        </div>
        {refused ? (
          <p className="text-xs text-amber-900 dark:text-amber-200 break-words" role="alert">
            {refused}
          </p>
        ) : null}
        {/* Go available is FIRST in the DOM (Tab reaches it first, the trap
            wraps from OK back to it) and drawn on the right from sm up by
            row-reverse, where a primary action sits. */}
        <div className="flex flex-col sm:flex-row-reverse gap-2">
          <button
            ref={primaryRef}
            type="button"
            className={`${BTN} bg-primary text-primary-foreground`}
            onClick={goAvailable}
            disabled={busy}
            data-reminder-go-available
          >
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            {t("app.salesStatus.reminder.goAvailable")}
          </button>
          <button ref={lastRef} type="button" className={`${BTN} border border-border bg-card text-foreground`} onClick={dismiss} data-reminder-ok>
            {t("app.salesStatus.reminder.ok")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
