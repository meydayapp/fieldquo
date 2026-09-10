"use client";

// app/components/sales/TransferControl.js
//
// Handing a live caller to somebody else, from whichever screen the rep is
// holding the call on.
//
// ══ Why it is not part of CallPanel any more ══════════════════════════════
//
// It was, and it only ever appeared there — on the OUTBOUND dialler. A rep who
// answered a contractor's callback in IncomingCallDock had no way to pass them
// to anyone, which is the half of the feature the owner asked about.
//
// Copying the markup into the dock is AGENTS.md failure class 4 pointed at a
// live call: two pickers, one state machine, and the copy that rots is the one
// nobody looks at — the dock, because inbound calls are rarer than outbound
// ones. So the control moved here whole and both screens render this. Nothing
// about the outbound behaviour changed in the move; the classes below compose
// to exactly the strings CallPanel used.
//
// ══ Three states, and only one is ever on screen ══════════════════════════
//
// A transfer in flight, the picker, or the button that opens it. Nothing at
// all renders when the server says this call cannot be transferred — a greyed
// button with a tooltip is still a control that does not work, and the two
// reasons it can be false (the table is absent, or this call has only one of
// its two legs on the row) are both facts the rep can do nothing about.
//
// ══ The target list is a courtesy ═════════════════════════════════════════
//
// The server rebuilds it from presence read in the request that acts on it, so
// a picker left open for ten minutes cannot hand a caller to somebody who has
// gone home. Nothing here decides who is reachable.
import { useCallback, useEffect, useState } from "react";
import { Loader2, PhoneForwarded, X } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

/**
 * The two surfaces this renders on, as four colour roles each.
 *
 * Composed rather than passed as whole class strings, so the CallPanel column
 * below is provably the same markup it was before the extraction: `call` holds
 * the exact emerald values that panel used, because the control sits inside
 * its green "on a call" box and a neutral card in the middle of it would read
 * as a different component. `dock` uses the card tokens, because the dock is a
 * card on top of whatever screen the rep was looking at.
 */
const TONES = {
  call: {
    box: "rounded-lg border border-emerald-400 bg-white/60 dark:bg-black/20 p-3 space-y-2",
    strong: "text-emerald-900 dark:text-emerald-100",
    soft: "text-emerald-900 dark:text-emerald-200",
    faint: "text-emerald-800 dark:text-emerald-300",
    outline: "border border-emerald-400 text-emerald-900 dark:text-emerald-100",
  },
  dock: {
    box: "rounded-lg border border-border bg-muted/40 p-3 space-y-2",
    strong: "text-foreground",
    soft: "text-muted-foreground",
    faint: "text-muted-foreground",
    outline: "border border-border text-foreground",
  },
};

/**
 * @param attemptId  the SalesCallAttempt this call is. Null renders nothing —
 *                   on the dock it is null until /api/sales/calls/answered has
 *                   said which call the rep picked up.
 * @param active     is the rep on the call? Polling and every control stop
 *                   when it goes false, and the last transfer is cleared:
 *                   nothing about the previous call belongs on the screen of
 *                   the next one.
 * @param onError    where a refusal goes. Both hosts already have one place
 *                   they show call errors, and a second one inside this box
 *                   would be a message a rep has to find.
 * @param tone       "call" | "dock".
 */
export default function TransferControl({ attemptId = null, active = false, onError, tone = "call" }) {
  // The server's whole answer — whether transfers exist in this deployment,
  // whether THIS call has the two legs a transfer needs, who is reachable, and
  // the transfer in flight if there is one. Kept as one object because the
  // screen has to be able to say which of those is missing, and four booleans
  // would let it say none of them.
  const [xfer, setXfer] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [busy, setBusy] = useState("");

  const t = TONES[tone] || TONES.call;
  const say = useCallback(
    (message) => {
      if (typeof onError === "function") onError(message);
    },
    [onError],
  );

  const loadTransfer = useCallback(async () => {
    if (!attemptId) return;
    try {
      setXfer(await fetchJson(`/api/sales/calls/transfer?attemptId=${encodeURIComponent(attemptId)}`));
    } catch {
      /* A failed poll must not remove a live control from under a rep who is
         mid-transfer. Whatever we last knew stays on screen. */
    }
  }, [attemptId]);

  useEffect(() => {
    if (!active || !attemptId) return undefined;
    loadTransfer();
    return undefined;
  }, [active, attemptId, loadTransfer]);

  // Read once when the call connects, then polled only while the picker is
  // open or a transfer is actually running. Polling for the whole call would
  // put a query on the server every three seconds for a control most calls
  // never use.
  const transferLive = Boolean(xfer?.transfer);
  useEffect(() => {
    if (!active || !attemptId) return undefined;
    if (!showTransfer && !transferLive) return undefined;
    const id = setInterval(loadTransfer, 3000);
    return () => clearInterval(id);
  }, [active, attemptId, showTransfer, transferLive, loadTransfer]);

  // The call ended — by a completed transfer or by a hangup.
  useEffect(() => {
    if (active) return;
    setXfer(null);
    setShowTransfer(false);
  }, [active]);

  async function beginTransfer(kind, targetKey) {
    if (!attemptId) return;
    setBusy(`${kind}:${targetKey}`);
    say("");
    try {
      const body = await fetchJson("/api/sales/calls/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", attemptId, kind, targetKey }),
      });
      setXfer((prev) => ({ ...(prev || {}), transfer: body.transfer }));
      setShowTransfer(false);
    } catch (err) {
      say(err?.message || "That transfer could not be started.");
    } finally {
      setBusy("");
    }
  }

  async function endTransfer(action) {
    const id = xfer?.transfer?.id;
    if (!id) return;
    setBusy(action);
    say("");
    try {
      const body = await fetchJson("/api/sales/calls/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, transferId: id }),
      });
      // Said out loud when half of it took effect. A rep who is told nothing
      // assumes the caller can hear them.
      if (body?.warning) say(body.warning);
    } catch (err) {
      say(err?.message || "That did not go through.");
    } finally {
      setBusy("");
      await loadTransfer();
    }
  }

  if (!attemptId || !active) return null;

  if (xfer?.transfer) {
    return (
      <div className={t.box}>
        <p className={`text-sm font-semibold ${t.strong} break-words`}>
          {xfer.transfer.describe || "Transferring…"}
        </p>
        <div className="flex gap-2">
          {/* Only while they are actually talking. Putting the caller through
              to a phone that has not been picked up is the blind hand-off warm
              exists to prevent, and the server refuses it — so the button is
              not there to be pressed. */}
          {xfer.transfer.state === "talking" ? (
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground flex-1`}
              disabled={Boolean(busy)}
              onClick={() => endTransfer("complete")}
            >
              {busy === "complete" ? <Loader2 className="animate-spin" size={16} /> : null}
              Put them through
            </button>
          ) : null}
          {xfer.transfer.state === "ringing" || xfer.transfer.state === "talking" ? (
            <button
              type="button"
              className={`${BTN} ${t.outline} flex-1`}
              disabled={Boolean(busy)}
              onClick={() => endTransfer("cancel")}
            >
              {busy === "cancel" ? <Loader2 className="animate-spin" size={16} /> : null}
              Never mind
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (showTransfer) {
    return (
      <div className={t.box}>
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold ${t.strong}`}>Hand this caller to…</p>
          <button type="button" aria-label="Close" className={t.strong} onClick={() => setShowTransfer(false)}>
            <X size={16} />
          </button>
        </div>
        {(xfer?.targets || []).length === 0 ? (
          /* Said, not hidden. A rep who presses transfer and sees an empty box
             assumes the feature is broken; the truth is that everyone else is
             on a call. */
          <p className={`text-xs ${t.soft}`}>
            Nobody else is free right now. Presence goes stale after a quarter
            of an hour, so a rep who has closed their laptop is not on this list
            even if they never signed out.
          </p>
        ) : (
          <ul className="space-y-2">
            {xfer.targets.map((target) => (
              <li key={target.key} className="space-y-1">
                <p className={`text-sm ${t.strong} break-words`}>
                  {target.name || target.value}{" "}
                  <span className={`text-xs ${t.faint}`}>— {target.why}</span>
                </p>
                <div className="flex gap-2">
                  {/* Two buttons rather than a mode switch, because the two
                      sound completely different to the person on hold and a
                      rep should not have to remember which way a toggle was
                      left. */}
                  <button
                    type="button"
                    className={`${BTN} bg-primary text-primary-foreground flex-1`}
                    disabled={Boolean(busy)}
                    onClick={() => beginTransfer("warm", target.key)}
                  >
                    {busy === `warm:${target.key}` ? <Loader2 className="animate-spin" size={16} /> : null}
                    Speak first
                  </button>
                  <button
                    type="button"
                    className={`${BTN} ${t.outline} flex-1`}
                    disabled={Boolean(busy)}
                    onClick={() => beginTransfer("cold", target.key)}
                  >
                    {busy === `cold:${target.key}` ? <Loader2 className="animate-spin" size={16} /> : null}
                    Straight through
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={`text-xs ${t.faint}`}>
          Either way the caller goes on hold while it rings, and comes back to
          you if nobody picks up.
        </p>
      </div>
    );
  }

  if (xfer?.ready && xfer?.transferable) {
    return (
      <button
        type="button"
        className={`${BTN} ${t.outline} w-full`}
        onClick={() => {
          setShowTransfer(true);
          loadTransfer();
        }}
      >
        <PhoneForwarded size={16} /> Transfer this call
      </button>
    );
  }

  return null;
}
