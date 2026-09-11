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
// ══ Answering is the only moment anything knows WHO answered ══════════════
//
// An inbound SalesCallAttempt's `salesRepId` is written by the inbound webhook
// before the phone has rung once, from whoever last rang that contractor, and
// ringPlan then offers the call to up to three browsers at the same time. So
// the rep who actually picked up was never recorded as having picked up: the
// floor board and their own call history credited the call to somebody else,
// or to nobody. Only this component knows, and only at the instant of the
// click — so the click posts to /api/sales/calls/answered.
//
// What it posts is one CallSid, and a CallSid is a CLAIM, not proof. The route
// reads the leg back from Twilio and refuses it unless the carrier says it was
// rung at this rep's own client identity. Nothing here is trusted; the reply
// is what the transfer control is rendered from.
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
import { useTranslation } from "@/app/hooks/useTranslation";
import { STATE_AFTER_CALL, STATE_ON_CALL } from "@/lib/sales/calls/agentState";
import TransferControl from "./TransferControl";
import { useRepPresence } from "./RepStatus";

/**
 * Digits → something a person can read. Never throws on a short string.
 *
 * `t` is passed in rather than read from a hook because this runs at module
 * scope, and the only translated thing here is what it says when there are no
 * digits at all.
 */
function pretty(e164, t) {
  const s = String(e164 || "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : s || t("app.salesDial.anUnknownNumber");
}

export default function IncomingCallDock() {
  const { t } = useTranslation();
  const [incoming, setIncoming] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [audioWarning, setAudioWarning] = useState("");
  // Which logged call this is, once the server has confirmed it. Null until
  // then, and the transfer control renders nothing on a null — a rep must
  // never be shown a Transfer button over a call the server could not
  // identify, because pressing it would refuse.
  const [answered, setAnswered] = useState(null);
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  // The registration effect below must NOT re-run when the rep switches
  // language — tearing down a registered Device would drop a call in progress
  // and unregister the browser — so the translator is read through a ref
  // instead of being added to that effect's dependencies.
  const sayRef = useRef(t);
  sayRef.current = t;
  // ── What the rest of the portal is told ──────────────────────────────
  //
  // The queue's autodialler must never start a call over one that is ringing
  // or up, so the dock reports both into the shared presence context, and
  // posts the ledger's two automatic transitions for an inbound call: on_call
  // when the rep answers, after_call when it ends. Read through a ref for the
  // same reason `t` is — the registration effect must not re-run when the
  // context object changes, because tearing down the Device drops the call.
  const presence = useRepPresence();
  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  // Whether the call the SDK is about to report `disconnect` on was ever
  // answered here. A ref rather than `live` state because the handler is
  // bound at ring time and would read a stale closure; and read in the
  // handler rather than in hangUp(), because the SDK fires `disconnect` for
  // both sides' hang-ups and this must be written once from one place.
  const liveRef = useRef(false);

  // The token AND how long it lasts. The lifetime is read from the server's
  // own answer rather than imported: lib/sales/calls/browserDial.js exports
  // TOKEN_TTL_SECONDS, but it also imports lib/voice/numberSearch, which drags
  // `pg` and `dns` into whatever bundles it — a client component importing it
  // broke the build once already. The route has always sent `expiresInSeconds`
  // for exactly this, and reading it there keeps the refresh correct if the
  // TTL is ever changed server-side.
  const fetchToken = useCallback(async () => {
    const body = await fetchJson("/api/sales/calls/token", { method: "POST" });
    return { token: body?.token || null, ttl: Number(body?.expiresInSeconds) || 0 };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let device = null;
    let refreshTimer = null;

    /** Re-mint and re-register. Used when Twilio has already refused a token. */
    const refreshAndRegister = async () => {
      if (cancelled || !device) return false;
      try {
        const { token: fresh } = await fetchToken();
        if (!fresh || cancelled) return false;
        device.updateToken(fresh);
        await device.register();
        setError("");
        return true;
      } catch {
        return false;
      }
    };

    (async () => {
      try {
        const { token, ttl } = await fetchToken();
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
        device.on("error", async (err) => {
          // 20101 is Twilio refusing an expired or invalid token. It is
          // RECOVERABLE, and treating it as fatal is what leaves a rep with a
          // dock that cannot ring and no idea why — so a fresh token is
          // fetched and the device re-registered before anything is said.
          if (err?.code === 20101 || err?.code === 31205) {
            const ok = await refreshAndRegister();
            if (ok) return;
          }
          // Shown rather than swallowed: a dock that is silently unregistered
          // looks exactly like a quiet afternoon.
          if (!cancelled) setError(err?.message || sayRef.current("app.salesDial.connectionDropped"));
        });
        // ── Keeping the token alive, three ways ──────────────────────────
        //
        // A sales access token lives TEN MINUTES (TOKEN_TTL_SECONDS). That
        // length was chosen for an outbound call — long enough to cover one
        // already in progress — and it is fine for CallPanel, which mints a
        // token, places a call and throws the Device away.
        //
        // This dock is different: it registers when the portal opens and sits
        // there all day. So the token has to be replaced roughly every ten
        // minutes, for hours, and any single missed refresh ends with Twilio
        // rejecting it — error 20101, "unable to validate your Access Token",
        // which is what the owner hit. One event listener is not enough to
        // hang that on:
        //
        //   1. `tokenWillExpire` — the SDK's own warning, ~3 minutes out. The
        //      normal path.
        //   2. A timer at half the TTL. A backgrounded tab throttles timers
        //      and can swallow the SDK's own, so this is the belt to that
        //      brace. Refreshing early is free; the token is replaced, not
        //      accumulated.
        //   3. The error itself. If a token does expire anyway, 20101 is
        //      recoverable — fetch a new one and register again, rather than
        //      leaving a dead dock on screen that looks like a quiet afternoon.
        const refresh = async (why) => {
          try {
            const { token: fresh } = await fetchToken();
            if (!fresh || cancelled) return false;
            device.updateToken(fresh);
            setError("");
            return true;
          } catch {
            if (!cancelled) {
              setError(
                why === "expired"
                  ? sayRef.current("app.salesDial.connectionExpiredReload")
                  : sayRef.current("app.salesDial.connectionRefreshFailed"),
              );
            }
            return false;
          }
        };

        device.on("tokenWillExpire", () => refresh("warning"));
        // Half the lifetime the SERVER reported, floored at a minute so a
        // misconfigured TTL cannot turn this into a request loop.
        const everyMs = Math.max(60, Math.floor((ttl || 600) / 2)) * 1000;
        refreshTimer = setInterval(() => refresh("timer"), everyMs);

        device.on("incoming", (call) => {
          if (cancelled) return;
          setIncoming({
            call,
            from: call?.parameters?.From || null,
            to: call?.parameters?.To || null,
          });
          // Ringing. The autodialler's countdown is cancelled by this — a
          // contractor ringing back outranks the next cold row.
          presenceRef.current.setInboundRinging(true);
          call.on("cancel", () => {
            // They hung up before anybody answered.
            setIncoming(null);
            setLive(false);
            setAnswered(null);
            callRef.current = null;
            presenceRef.current.setInboundRinging(false);
          });
          call.on("disconnect", () => {
            const wasLive = liveRef.current;
            liveRef.current = false;
            setIncoming(null);
            setLive(false);
            // Nothing about the last call belongs on the screen of the next
            // one — least of all an attempt id a transfer would act on.
            setAnswered(null);
            callRef.current = null;
            presenceRef.current.setInboundRinging(false);
            presenceRef.current.setCallUp(false);
            // The call ended: the rep is writing it up, on the ledger, until
            // they press Available. Soft — the row is commentary on a call
            // that has already happened.
            if (wasLive) presenceRef.current.postState({ state: STATE_AFTER_CALL });
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
            setAudioWarning(sayRef.current("app.salesDial.noMicrophone"));
          }
        } catch {
          /* the SDK has no audio helper in this browser; the call still works */
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || sayRef.current("app.salesDial.connectionStartFailed"));
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
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

  /**
   * Which CallSid the SDK is holding for this incoming call.
   *
   * `call.parameters.CallSid` for an INCOMING call is the leg Twilio placed to
   * `client:sales_rep:<id>` out of `<Dial><Client>` — a call resource of its
   * own, whose parent is the contractor's inbound call. It is NOT the SID on
   * the SalesCallAttempt row, and the server knows that: it looks the leg up
   * with the carrier and matches on the parent. `customParameters` is read
   * first only because a `<Parameter>` would be exact if one is ever added,
   * and reading a Map that is usually empty costs nothing.
   */
  function sidOf(call) {
    const custom = call?.customParameters?.get?.("CallSid");
    const sid = custom || call?.parameters?.CallSid || null;
    return typeof sid === "string" && sid ? sid : null;
  }

  async function answer() {
    const call = incoming?.call;
    if (!call) return;
    try {
      // The click IS the user gesture browsers require before audio plays, so
      // it happens FIRST and nothing is awaited before it. Telling the server
      // who answered matters; making the rep wait on a round trip to hear the
      // contractor does not.
      call.accept();
      callRef.current = call;
      liveRef.current = true;
      setLive(true);
      setError("");
      presenceRef.current.setInboundRinging(false);
      presenceRef.current.setCallUp(true);
    } catch (err) {
      setError(err?.message || t("app.salesDial.couldNotPickUp"));
      return;
    }

    const callSid = sidOf(call);
    if (!callSid) {
      // No SID means nothing can be filed and nothing can be transferred. Said
      // where the rep will see it rather than swallowed: the call itself is
      // fine, and what they need to know is that it will not be logged to
      // them.
      setAnswered({ attemptId: null, note: t("app.salesDial.callNotMatched") });
      // Still on a call, for the ledger — just not one it can point at.
      presenceRef.current.postState({ state: STATE_ON_CALL });
      return;
    }

    try {
      const body = await fetchJson("/api/sales/calls/answered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSid }),
      });
      setAnswered({
        // Only when the server says both legs are on the row. `transferable`
        // false renders no control at all rather than a button that refuses.
        attemptId: body?.transferable ? body.attemptId || null : null,
        note: body?.transferable ? "" : t("app.salesDial.callLegNotRecorded"),
      });
      // The automatic transition an answered callback makes. The attempt id
      // is the one the server just matched, so the ledger row points at the
      // call rather than at nothing.
      presenceRef.current.postState({
        state: STATE_ON_CALL,
        callAttemptId: body?.attemptId || null,
      });
    } catch (err) {
      setAnswered({
        attemptId: null,
        note: err?.message || t("app.salesDial.callNotMatched"),
      });
      presenceRef.current.postState({ state: STATE_ON_CALL });
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
    presenceRef.current.setInboundRinging(false);
  }

  function hangUp() {
    // disconnect() fires the call's own `disconnect` handler above, which is
    // where the ledger and the shared flags are updated — once, from one
    // place, whichever side hung up.
    try {
      callRef.current?.disconnect?.();
    } catch {
      /* already gone */
    }
    callRef.current = null;
    setIncoming(null);
    setLive(false);
    setAnswered(null);
    presenceRef.current.setCallUp(false);
  }

  // Nothing to say when nothing is happening. The dock is not a status light —
  // a permanent "ready to receive calls" badge on every screen is noise, and
  // the errors below are the only quiet state worth interrupting for.
  if (!incoming && !error && !audioWarning) return null;

  return (
    // bottom: above SalesMobileTabBar below lg — the bar's row plus the
    // safe-area inset, through the variable app/globals.css declares, which is
    // 0 from lg up. At bottom-4 a ringing call sat behind the tab bar on a
    // phone, which is the one screen size a rep in a van is holding.
    //
    // z-[70]: above the tour's card (z-[60]) and the drawer (z-50). A
    // contractor ringing back outranks a walkthrough and a menu — see
    // SalesTour.js's header for the ordering.
    <div className="fixed bottom-[calc(var(--fq-tab-bar-height)+1rem)] right-4 z-[70] w-[22rem] max-w-[calc(100vw-2rem)] space-y-2">
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
          aria-label={t("app.salesDial.incomingCall")}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {live ? t("app.salesDial.onACall") : t("app.salesDial.incomingCall")}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {pretty(incoming.from, t)}
            </div>
            {incoming.to ? (
              <div className="text-xs text-muted-foreground">
                {t("app.salesDial.rangYourNumber", { number: pretty(incoming.to, t) })}
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
                <PhoneOff size={16} aria-hidden="true" /> {t("app.salesDial.hangUp")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={answer}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold"
                >
                  <Phone size={16} aria-hidden="true" /> {t("app.salesDial.pickUp")}
                </button>
                <button
                  type="button"
                  onClick={decline}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
                >
                  {t("app.salesDial.decline")}
                </button>
              </>
            )}
          </div>
          {/* ── Handing them to somebody else ─────────────────────────────
              The SAME control the outbound dialler renders, imported rather
              than copied: two pickers over one state machine is AGENTS.md
              failure class 4 aimed at a live call, and the copy that rots
              would be this one, because inbound calls are rarer.

              `attemptId` is null until /api/sales/calls/answered has said
              which logged call this is, and it stays null when the server
              says the call has no rep leg to hand back from — so the control
              renders nothing at all rather than a button that would refuse.
              The reason is said below instead. */}
          {live ? (
            <>
              <TransferControl
                attemptId={answered?.attemptId || null}
                active={live}
                onError={setError}
                tone="dock"
              />
              {answered?.note ? (
                <p className="text-xs text-muted-foreground">{answered.note}</p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("app.salesDial.decliningNotice")}
            </p>
          )}
        </div>
      ) : null}

      <span className="sr-only">
        {ready ? t("app.salesDial.readyToReceiveCalls") : t("app.salesDial.connecting")}
      </span>
    </div>
  );
}
