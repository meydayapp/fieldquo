"use client";

// app/components/sales/RecordingMark.js
//
// The Mark button on the live call, and the line under it that says what
// the carrier's answering-machine detection decided.
//
// ══ Mark ══════════════════════════════════════════════════════════════════
//
// One press, an optional word, and a bookmark lands on the recording at
// the second the call is at — stamped by the SERVER as now − answeredAt
// (lib/sales/calls/recordingMarks.js), never by this clock, which started
// at the press and counted the ringing. The marks show as ticks on the
// owner's player and go into the AI review as "moments the rep flagged".
// A press before the line has reported the pickup is refused with the
// server's sentence; the button is not hidden, because a rep who cannot
// find it will not press it two seconds later either.
//
// ══ Machine detected ══════════════════════════════════════════════════════
//
// When `sales.amd.enabled` is on (lib/sales/calls/amd.js), Twilio posts a
// verdict a few seconds into the call. The card polls /api/sales/calls/live
// every three seconds for the first minute — and not at all when the first
// answer says the feature is off — and prints "Machine detected: leave your
// message or hang up" when the verdict is a machine. A human verdict prints
// nothing: telling a rep they are talking to a person is noise.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Loader2, Voicemail } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const POLL_MS = 3000;
const POLL_FOR_MS = 60 * 1000;
const CHIP = "inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium border border-emerald-400 text-emerald-900 dark:text-emerald-100 disabled:opacity-60";

/**
 * What the server knows about the live call: the AMD verdict and the
 * marks already placed. Polls while young; stops on a verdict, on "off",
 * or after a minute.
 */
export function useLiveCallFacts(attemptId) {
  const [facts, setFacts] = useState(null);
  useEffect(() => {
    if (!attemptId) {
      setFacts(null);
      return undefined;
    }
    let alive = true;
    let timer = null;
    const started = Date.now();
    const tick = async () => {
      try {
        const body = await fetchJson(`/api/sales/calls/live?attemptId=${encodeURIComponent(attemptId)}`);
        if (!alive) return;
        setFacts(body);
        const done = !body?.amd?.enabled || Boolean(body?.amd?.result) || Date.now() - started > POLL_FOR_MS;
        if (!done) timer = setTimeout(tick, POLL_MS);
      } catch {
        if (alive && Date.now() - started < POLL_FOR_MS) timer = setTimeout(tick, POLL_MS * 2);
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [attemptId]);
  return facts;
}

export function AmdNotice({ facts }) {
  const { t } = useTranslation();
  const key = facts?.amd?.cardKey;
  if (!key) return null;
  return (
    <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="status" data-live-call-amd={facts.amd.result}>
      <Voicemail size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{t(key)}</span>
    </p>
  );
}

/** The Mark button and its one-line note, on the live call. */
export function LiveMarkButton({ attemptId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [count, setCount] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    setOpen(false);
    setNote("");
    setMessage("");
    setCount(0);
  }, [attemptId]);

  const mark = useCallback(async () => {
    if (!attemptId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fetchJson("/api/sales/calls/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, note }),
      });
      setCount((n) => n + 1);
      setNote("");
      setOpen(false);
      setMessage(t("app.salesCall.mark.saved"));
    } catch (err) {
      setMessage(err?.message || t("app.salesCall.mark.failed"));
    } finally {
      setBusy(false);
    }
  }, [attemptId, busy, note, t]);

  if (!attemptId) return null;
  return (
    <div className="space-y-1.5" data-live-call-mark>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={CHIP}
          onClick={() => {
            setOpen((v) => !v);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          aria-expanded={open}
          data-live-call-mark-button
        >
          <Bookmark size={15} aria-hidden="true" /> {t("app.salesCall.mark.button")}
          {count ? <span className="tabular-nums text-xs">· {count}</span> : null}
        </button>
        {message ? (
          <span className="text-xs text-emerald-900 dark:text-emerald-200 break-words" role="status">
            {message}
          </span>
        ) : null}
      </div>
      {open ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            mark();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("app.salesCall.mark.placeholder")}
            aria-label={t("app.salesCall.mark.placeholder")}
            className="min-h-[40px] flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            data-live-call-mark-note
          />
          <button type="submit" className={`${CHIP} bg-emerald-600 text-white border-emerald-600 dark:text-white`} disabled={busy} data-live-call-mark-save>
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null} {t("app.salesCall.mark.save")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
