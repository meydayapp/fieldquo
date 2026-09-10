"use client";

// app/components/sales/IncomingCallDock.js
//
// The thing that rings when a contractor calls back.
//
// ══ Why nothing rang before ═══════════════════════════════════════════════
//
// Two halves were missing and each made the other invisible.
//
// The access token granted `incomingAllow: false`, so a rep's identity was not
// permitted to RECEIVE a call. And the Twilio Device was constructed inside
// `place()` in CallPanel — created to make one outbound call and destroyed on
// disconnect — so even with the grant there was no registered client listening
// between calls. inboundDistribution.js was emitting perfectly correct TwiML,
// `<Dial><Client>sales_rep:…</Client></Dial>`, at a client that did not exist.
//
// The owner heard the consequence: he rang +17166383616, it was answered, and
// nobody picked up.
//
// ══ Why this lives in the shell and not on a screen ═══════════════════════
//
// A rep is on the queue, or reading a lead, or writing notes. A call does not
// arrive on a particular page, so a listener that only exists on the dialler
// screen means the phone rings only when you happen to be looking at it. It is
// mounted once, in the portal shell, and every /sales screen inherits it.
//
// ══ Registered is not the same as being rung ══════════════════════════════
//
// Registering only makes this browser REACHABLE. Who is actually rung is
// decided server-side by ringPlan(), from presence read at the instant the call
// lands — a rep who is paused, offline or stale is not a target. Deciding it
// in two places is how a paused rep's laptop starts ringing, so the client
// deliberately keeps no opinion about it.
//
// ══ Tokens expire ═════════════════════════════════════════════════════════
//
// A Voice access token is short-lived. A dock that registered once and never
// refreshed would work for an hour and then go quiet with no error anywhere —
// the worst shape a bug can take, because the screen still says you are signed
// in. `tokenWillExpire` re-fetches and updates in place.
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, AlertTriangle, Headphones } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";

/** Digits → something a person can read. Never throws on a short string. */
function pretty(e164) {
  const s = String(e164 || "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : s || "an unknown number";
}

export default function IncomingCallDock() {
  const [incoming, setIncoming] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [audioWarning, setAudioWarning] = useState("");
  const deviceRef = useRef(null);
  const callRef = useRef(null);

  const fetchToken = useCallback(async () => {
    const body = await fetchJson("/api/sales/calls/token", { method: "POST" });
    return body?.token || null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let device = null;

    (async () => {
      try {
        const token = await fetchToken();
        if (!token || cancelled) return;

        const { Device } = await import("@twilio/voice-sdk");
        device = new Device(token, {
          logLevel: "error",
          // opus first for quality, pcmu kept so a network that mangles opus
          // still carries the call rather than failing to connect at all.
          codecPreferences: ["opus", "pcmu"],
        });
        deviceRef.current = device;

        device.on("registered", () => {
          if (!cancelled) setReady(true);
        });
        device.on("error", (err) => {
          // Shown rather than swallowed: a dock that is silently unregistered
          // looks exactly like a quiet afternoon.
          if (!cancelled) setError(err?.message || "The call connection dropped.");
        });
        device.on("tokenWillExpire", async () => {
          try {
            const fresh = await fetchToken();
            if (fresh) device.updateToken(fresh);
          } catch {
            if (!cancelled) setError("Could not refresh the calling connection. Reload the page.");
          }
        });

        device.on("incoming", (call) => {
          if (cancelled) return;
          setIncoming({
            call,
            from: call?.parameters?.From || null,
            to: call?.parameters?.To || null,
          });
          call.on("cancel", () => {
            // They hung up before anybody answered.
            setIncoming(null);
            setLive(false);
            callRef.current = null;
          });
          call.on("disconnect", () => {
            setIncoming(null);
            setLive(false);
            callRef.current = null;
          });
        });

        await device.register();

        // ── The headset ────────────────────────────────────────────────────
        //
        // Asked for AFTER registering, so a missing microphone delays nothing:
        // the browser can be reachable before it can talk, and a rep with no
        // headset plugged in should still see the call arrive and be told what
        // is wrong, rather than have the dock refuse to start.
        try {
          const inputs = device.audio?.availableInputDevices;
          if (inputs && inputs.size === 0) {
            setAudioWarning("No microphone is available. Plug your headset in — you will not be heard.");
          }
        } catch {
          /* the SDK has no audio helper in this browser; the call still works */
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Could not start the calling connection.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        callRef.current?.disconnect?.();
      } catch {
        /* already gone */
      }
      try {
        device?.destroy?.();
      } catch {
        /* already gone */
      }
      deviceRef.current = null;
    };
  }, [fetchToken]);

  function answer() {
    const call = incoming?.call;
    if (!call) return;
    try {
      // The click IS the user gesture browsers require before audio plays.
      call.accept();
      callRef.current = call;
      setLive(true);
      setError("");
    } catch (err) {
      setError(err?.message || "Could not pick up.");
    }
  }

  function decline() {
    const call = incoming?.call;
    if (!call) return;
    try {
      // reject(), not disconnect(): rejecting hands the call back to Twilio so
      // the ring plan's NEXT target gets it. Disconnecting an unanswered call
      // ends it for the contractor.
      call.reject();
    } catch {
      /* already gone */
    }
    setIncoming(null);
  }

  function hangUp() {
    try {
      callRef.current?.disconnect?.();
    } catch {
      /* already gone */
    }
    callRef.current = null;
    setIncoming(null);
    setLive(false);
  }

  // Nothing to say when nothing is happening. The dock is not a status light —
  // a permanent "ready to receive calls" badge on every screen is noise, and
  // the errors below are the only quiet state worth interrupting for.
  if (!incoming && !error && !audioWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] space-y-2">
      {audioWarning && !incoming ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/60 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
          <Headphones size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{audioWarning}</span>
        </div>
      ) : null}

      {error && !incoming ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/60 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {incoming ? (
        <div
          className="rounded-2xl border border-border bg-card shadow-lg p-4 space-y-3"
          role="alertdialog"
          aria-live="assertive"
          aria-label="Incoming call"
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {live ? "On a call" : "Incoming call"}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {pretty(incoming.from)}
            </div>
            {incoming.to ? (
              <div className="text-xs text-muted-foreground">
                Rang your number {pretty(incoming.to)}
              </div>
            ) : null}
          </div>

          {audioWarning ? (
            <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5">
              <Headphones size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
              {audioWarning}
            </p>
          ) : null}
          {error ? <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p> : null}

          <div className="flex gap-2">
            {live ? (
              <button
                type="button"
                onClick={hangUp}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-destructive text-destructive-foreground px-4 py-2.5 text-sm font-semibold"
              >
                <PhoneOff size={16} aria-hidden="true" /> Hang up
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={answer}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold"
                >
                  <Phone size={16} aria-hidden="true" /> Pick up
                </button>
                <button
                  type="button"
                  onClick={decline}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
                >
                  Decline
                </button>
              </>
            )}
          </div>
          {!live ? (
            <p className="text-xs text-muted-foreground">
              Declining passes them to the next person on the ring plan, not to voicemail.
            </p>
          ) : null}
        </div>
      ) : null}

      <span className="sr-only">{ready ? "Ready to receive calls" : "Connecting"}</span>
    </div>
  );
}
