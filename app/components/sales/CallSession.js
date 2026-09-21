"use client";

// app/components/sales/CallSession.js
//
// The phone, held once for the whole portal: one Twilio Device, the call
// that is up on it in either direction, and the write-up of the outbound
// call that just ended.
//
// ══ Why the call left CallPanel ═══════════════════════════════════════════
//
// The owner, 2026-09-18: a customer says "text me" or "email me"; the rep
// presses Text them to confirm it went; the call drops. It dropped because
// the outbound Call object lived in CallPanel, on the queue page, and Text
// them navigates to /sales/messages — the page changed, the panel unmounted,
// and its unmount cleanup ("leaving the screen must not leave a call up")
// disconnected the customer. The same cleanup had already hung up on a live
// call once before, when the calling window shut mid-call and DialRegion
// unmounted the panel (see DialRegion's `liveTarget`); that was patched by
// freezing the target. This is the root fix: the call is owned HERE, under
// SalesShell, which is the one component that survives every navigation
// inside the portal. Pages come and go; the call does not.
//
// Inbound calls already worked this way — IncomingCallDock is mounted in the
// shell — and the two directions used to hold TWO Twilio Devices: the dock's
// registered one, and one CallPanel built per outbound call and destroyed on
// disconnect. There is one now, built and registered here, refreshed here,
// and used for both. The dock subscribes to its `incoming` event through
// onIncoming(); the outbound dial connects on it through connectOutbound().
// The token and identity are still minted by app/api/sales/calls/token; only
// where the Device lives changed.
//
// ══ What a page sees ══════════════════════════════════════════════════════
//
//   live          the call that is up, whichever direction, as one shape the
//                 strip draws: who, since when, the attempt to transfer, the
//                 number to text. Null between calls.
//   hangUp / toggleMute / sendDigits — act on whichever call is up.
//   outbound      the outbound call's own facts (attempt id, caller id).
//   connectOutbound({ attempt, target })  — CallPanel's press, after the
//                 dial POST. The panel decides WHETHER to dial (readiness,
//                 the typed number, the autodialler's guards); this decides
//                 nothing and only holds what was placed.
//   setInbound    the dock's report of an answered callback, so the ONE
//                 strip (LiveCallStrip.js) draws it beside the outbound
//                 controls rather than the dock keeping a strip of its own.
//   pending / draft / saveOutcome / later … — the outbound write-up. It is
//                 here and not in the panel for the same reason the call is:
//                 a call hung up on the Texts screen has to be written up on
//                 the Texts screen. CallPanel renders this state when it is
//                 mounted; LiveCallStrip renders it when no panel is.
//
// ══ A hard reload still drops the call ════════════════════════════════════
//
// Said plainly because it is the obvious follow-up question. The call is a
// WebRTC media session inside this tab; a reload, a closed tab or a crashed
// browser ends it, and nothing in a browser can carry it across. What this
// file guarantees is narrower and is what the owner asked for: navigating
// ANYWHERE inside the portal — Texts, Conversations, Calendar, Leads, Notes,
// Pay, Team, Settings and back — keeps the call up, with the strip's Hang
// up, Mute, Transfer, Text them and Email on every one of those pages. After
// a reload, the ended call is found on the server (GET /api/sales/calls
// pendingAttempt) and asked about at once, on whichever page loads.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { STATE_AFTER_CALL } from "@/lib/sales/calls/agentState";
import {
  AUTO_LOG_GRACE_SECONDS,
  AUTO_LOG_UNDO_SECONDS,
  HUNG_UP_BY_PROSPECT,
  HUNG_UP_BY_REP,
  PROVIDER_ENDED,
} from "@/lib/sales/calls/dispositions";
import { foldChoice } from "@/lib/sales/calls/outcomeChoices";
import { validateSubDispositionPick } from "@/lib/sales/calls/subDispositions";
import { asksIntroEmail } from "@/lib/sales/outreach/introLink";
import { EMPTY_DRAFT, draftStarted } from "./OutcomeForm";
import { openTextThread } from "./TextThem";
import { useRepPresence } from "./RepStatus";

/**
 * Twilio's codes for a token it will not accept — all recoverable by minting
 * a new one. 20101 invalid · 20104 expired · 31204/31205 the same two as the
 * signalling layer reports them. Lived in IncomingCallDock until the Device
 * moved here; the dock re-exports it so nothing that imported it broke.
 */
export const TOKEN_ERROR_CODES = new Set([20101, 20104, 31204, 31205]);

const noop = () => {};

/**
 * What a component gets OUTSIDE the provider — a check script rendering
 * CallPanel on its own. Inert: no call, no device, every action answers
 * "not mounted" rather than throwing inside an event handler.
 */
const DETACHED = Object.freeze({
  mounted: false,
  ready: false,
  deviceError: "",
  audioWarning: "",
  onIncoming: () => noop,
  live: null,
  outbound: null,
  inbound: null,
  muted: false,
  callError: "",
  connectOutbound: async () => {
    throw new Error("not mounted");
  },
  setInbound: noop,
  hangUp: noop,
  toggleMute: noop,
  sendDigits: () => false,
  viewMounted: false,
  registerView: () => noop,
  pending: null,
  setPending: noop,
  adoptPending: noop,
  draft: EMPTY_DRAFT,
  setDraft: noop,
  formError: "",
  setFormError: noop,
  busy: "",
  sheetOpen: false,
  autoLogged: null,
  introPrompt: null,
  closeIntroPrompt: noop,
  saveOutcome: async () => {},
  later: async () => {},
  changeAutoLogged: noop,
  openTextFor: async () => {},
  numberSaveError: "",
  saveTypedNumber: async () => {},
  dismissNumberQuestion: noop,
});

const Ctx = createContext(DETACHED);

export function useCallSession() {
  return useContext(Ctx);
}

/**
 * The panel that DRAWS the outbound call and its write-up announces itself
 * here, so the strip knows to stay out of the way — the queue's Dialer card
 * and the lead page's call section both mount CallPanel. `onWorked` is what
 * the screen wants after an outcome is written (reload the queue, arm the
 * autodialler); `reload` re-reads the panel's own config. Both are read
 * through the ref at the moment they are needed, never captured.
 */
export function useCallSessionView({ onWorked = null, reload = null } = {}) {
  const session = useCallSession();
  const ref = useRef({ onWorked, reload });
  ref.current = { onWorked, reload };
  const { registerView } = session;
  useEffect(() => registerView(ref), [registerView]);
  return session;
}

export function CallSessionProvider({ children }) {
  const { t } = useTranslation();
  // Read through a ref inside SDK handlers, which are bound once per call.
  const tRef = useRef(t);
  tRef.current = t;
  const router = useRouter();
  const presence = useRepPresence();
  const presenceRef = useRef(presence);
  presenceRef.current = presence;

  // ── The one Device ───────────────────────────────────────────────────
  const deviceRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [audioWarning, setAudioWarning] = useState("");
  const incomingHandlers = useRef(new Set());
  const onIncoming = useCallback((fn) => {
    incomingHandlers.current.add(fn);
    return () => incomingHandlers.current.delete(fn);
  }, []);
  // A Call pressed the instant the portal opens must wait for the token
  // rather than fail: connectOutbound awaits this until the Device exists.
  const deviceWaitRef = useRef(null);
  if (!deviceWaitRef.current) {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // A rejected wait must not be an unhandled rejection when nobody dials.
    promise.catch(noop);
    deviceWaitRef.current = { promise, resolve, reject };
  }

  // The token AND how long it lasts. The lifetime is read from the server's
  // own answer rather than imported: lib/sales/calls/browserDial.js exports
  // TOKEN_TTL_SECONDS, but it also imports lib/voice/numberSearch, which drags
  // `pg` and `dns` into whatever bundles it — a client component importing it
  // broke the build once already.
  const fetchToken = useCallback(async () => {
    const body = await fetchJson("/api/sales/calls/token", { method: "POST" });
    return { token: body?.token || null, ttl: Number(body?.expiresInSeconds) || 0 };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let device = null;
    let refreshTimer = null;
    let onVisible = null;

    /** Re-mint and re-register. Used when Twilio has already refused a token. */
    const refreshAndRegister = async () => {
      if (cancelled || !device) return false;
      try {
        const { token: fresh } = await fetchToken();
        if (!fresh || cancelled) return false;
        device.updateToken(fresh);
        await device.register();
        setDeviceError("");
        return true;
      } catch {
        return false;
      }
    };

    (async () => {
      try {
        const { token, ttl } = await fetchToken();
        if (!token || cancelled) {
          deviceWaitRef.current.reject(new Error(tRef.current("app.salesDial.connectionStartFailed")));
          return;
        }

        const { Device } = await import("@twilio/voice-sdk");
        device = new Device(token, {
          logLevel: "error",
          // opus first for quality, pcmu kept so a network that mangles opus
          // still carries the call rather than failing to connect at all.
          codecPreferences: ["opus", "pcmu"],
        });
        deviceRef.current = device;
        deviceWaitRef.current.resolve(device);

        device.on("registered", () => {
          if (!cancelled) setReady(true);
        });
        device.on("error", async (err) => {
          // A refused token is RECOVERABLE, and treating it as fatal is what
          // leaves a rep with a dock that cannot ring and no idea why — so a
          // fresh token is fetched and the device re-registered before
          // anything is said. Twilio has four spellings of "bad token" and
          // the owner met the one this list lacked: 20104 AccessTokenExpired,
          // shown on the queue page after a tab sat in the background long
          // enough for both refresh timers to be throttled.
          if (TOKEN_ERROR_CODES.has(err?.code)) {
            const ok = await refreshAndRegister();
            if (ok) return;
          }
          // Shown rather than swallowed: a dock that is silently unregistered
          // looks exactly like a quiet afternoon.
          if (!cancelled) setDeviceError(err?.message || tRef.current("app.salesDial.connectionDropped"));
        });
        // ── Keeping the token alive, four ways ───────────────────────────
        //
        // A sales access token lives TEN MINUTES (TOKEN_TTL_SECONDS) and this
        // Device sits registered all day, so the token is replaced roughly
        // every ten minutes, for hours, and any single missed refresh ends
        // with Twilio rejecting it (20101). One listener is not enough:
        //
        //   1. `tokenWillExpire` — the SDK's own warning, ~3 minutes out.
        //   2. A timer at half the TTL. A backgrounded tab throttles timers
        //      and can swallow the SDK's own.
        //   3. The error itself, above: 20101/20104 fetch a new one.
        //   4. Coming back to the tab: both of the above are throttled in a
        //      background tab, so visibility refreshes at once.
        const refresh = async (why) => {
          try {
            const { token: fresh } = await fetchToken();
            if (!fresh || cancelled) return false;
            device.updateToken(fresh);
            setDeviceError("");
            return true;
          } catch {
            if (!cancelled) {
              setDeviceError(
                why === "expired"
                  ? tRef.current("app.salesDial.connectionExpiredReload")
                  : tRef.current("app.salesDial.connectionRefreshFailed"),
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
        onVisible = () => {
          if (document.visibilityState === "visible") refresh("visible");
        };
        document.addEventListener("visibilitychange", onVisible);

        // The ring is the dock's to draw (IncomingCallDock.js); this only
        // hands the Call object on. Every subscriber is told, in the order
        // they subscribed — there is one today.
        device.on("incoming", (call) => {
          if (cancelled) return;
          for (const fn of incomingHandlers.current) {
            try {
              fn(call);
            } catch {
              /* one subscriber's error must not stop the ring reaching another */
            }
          }
        });

        await device.register();

        // ── The headset ──────────────────────────────────────────────────
        //
        // Asked for AFTER registering, so a missing microphone delays
        // nothing: the browser can be reachable before it can talk, and a
        // rep with no headset plugged in should still see the call arrive
        // and be told what is wrong.
        try {
          const inputs = device.audio?.availableInputDevices;
          if (inputs && inputs.size === 0) {
            setAudioWarning(tRef.current("app.salesDial.noMicrophone"));
          }
        } catch {
          /* the SDK has no audio helper in this browser; the call still works */
        }
      } catch (err) {
        deviceWaitRef.current.reject(err instanceof Error ? err : new Error(String(err)));
        if (!cancelled) setDeviceError(err?.message || tRef.current("app.salesDial.connectionStartFailed"));
      }
    })();

    // The provider unmounts only with the shell — the rep signed out, or
    // left /sales altogether. THAT is the one moment a live call may be torn
    // down with the Device; a page inside the portal changing is not it,
    // which is the whole reason this effect is here and not in a page.
    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
      try {
        device?.destroy?.();
      } catch {
        /* already gone */
      }
      deviceRef.current = null;
    };
  }, [fetchToken]);

  // ── The call that is up ──────────────────────────────────────────────
  //
  // `outbound` is what this provider placed; `inbound` is what the dock
  // answered and reported. At most one is set — the dialler refuses a
  // second call while either is up (CallPanel reads presence.callLive), and
  // the ring plan never offers an inbound call to a rep who is on one.
  const [outbound, setOutbound] = useState(null);
  const outboundCallRef = useRef(null);
  // Who ended the outbound call: "rep" is set by hangUp() before it
  // disconnects; anything else at `disconnect` is the far end.
  const hungUpByRef = useRef(null);
  const [inbound, setInboundState] = useState(null);
  const inboundRef = useRef(null);
  const setInbound = useCallback((descriptor) => {
    inboundRef.current = descriptor || null;
    setInboundState(descriptor || null);
  }, []);
  const [muted, setMuted] = useState(false);
  const [callError, setCallError] = useState("");

  // ── The write-up of the outbound call that ended ─────────────────────
  //
  // Written up, or waiting to be. `draft` is what the rep has pressed and
  // typed in the outcome form — OutcomeForm.js's shape, shared by every copy
  // of the form (Dialer column, Disposition tab, pop-up, the strip).
  const [pending, setPending] = useState(null);
  const pendingRef = useRef(null);
  pendingRef.current = pending;
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // The sub-reason lists the outcome form draws under an outcome — the
  // platform's, from GET /api/sales/calls (lib/sales/calls/subDispositions.js).
  // Null until read; the form then draws the code defaults, and the server
  // validates against the same lists either way.
  const [subLists, setSubLists] = useState(null);
  const subListsRef = useRef(null);
  subListsRef.current = subLists;
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");
  // The pop-up. Opened only by the auto-log reply saying "answered, ask the
  // rep"; closed by a save, by "later", or by the pending call going away.
  const [sheetOpen, setSheetOpen] = useState(false);
  // What the line logged by itself, while the "change" strip is up:
  // `{ attemptId, code, toE164, dialledAt, until }`.
  const [autoLogged, setAutoLogged] = useState(null);
  // "Send {business} the intro email?" — `{ leadId, prospectId, attemptId,
  // businessName, then }` while the pop-up is open, null otherwise. `then`
  // is the onWorked the queue is waiting on: held until the pop-up closes,
  // because the autodialler arms on onWorked and a next dial ringing under
  // a dialog about the previous business is the wrong order of events.
  const [introPrompt, setIntroPrompt] = useState(null);

  // ── The view that draws all this, when there is one ──────────────────
  const viewRef = useRef(null);
  const [viewCount, setViewCount] = useState(0);
  const registerView = useCallback((ref) => {
    viewRef.current = ref;
    setViewCount((n) => n + 1);
    return () => {
      if (viewRef.current === ref) viewRef.current = null;
      setViewCount((n) => Math.max(0, n - 1));
    };
  }, []);
  const viewMounted = viewCount > 0;
  const onWorked = useCallback(() => viewRef.current?.current?.onWorked?.(), []);
  const reloadView = useCallback(async () => {
    try {
      await viewRef.current?.current?.reload?.();
    } catch {
      /* the panel prints its own load error */
    }
  }, []);

  /**
   * The server's word on an unlogged outbound call, from GET /api/sales/calls.
   *
   * A call that ended while nobody was looking (a reload, a closed laptop)
   * is asked about at once rather than after the grace: the grace exists so
   * a rep who is reaching for the picker is not raced, and nobody reaches
   * for a picker on a page that just mounted. Only a browser dial the
   * carrier has finished with can be answered by the line.
   *
   * Never CLEARS a write-up this provider set itself: the `ended` post from
   * the disconnect handler and a page's GET can cross, and a GET that ran
   * before the row was marked ended says "nothing pending" about a call the
   * rep hung up a second ago. A row adopted from the server is the server's
   * to withdraw.
   */
  const adoptPending = useCallback((row) => {
    setPending((current) => {
      if (!row) return current?.fromServer ? null : current;
      if (current && current.id === row.id) return current;
      if (current && !current.fromServer) return current;
      return {
        ...row,
        fromServer: true,
        autoAsk: row.dialChannel === "browser" && (Boolean(row.endedAt) || PROVIDER_ENDED.includes(row.providerStatus)),
        graceMs: 0,
      };
    });
  }, []);

  // On the shell's mount: the ended call a reload left behind, asked about
  // on whichever page loaded. CallPanel's own GET hands its answer here too.
  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/sales/calls")
      .then((body) => {
        if (cancelled) return;
        if (body?.subDispositions) setSubLists(body.subDispositions);
        if (body?.store?.ready) adoptPending(body.pendingAttempt || null);
      })
      .catch(noop);
    return () => {
      cancelled = true;
    };
  }, [adoptPending]);

  /**
   * Place the browser leg of an outbound call whose attempt row the server
   * has already written. `attempt` is the dial route's answer; `target` is
   * what the panel was pointed at — the prospect or lead the write-up
   * belongs to, the name the strip prints, the number to text.
   */
  const connectOutbound = useCallback(async ({ attempt, target }) => {
    if (!attempt?.attemptId) throw new Error("no attempt");
    const device = deviceRef.current || (await deviceWaitRef.current.promise);
    // The destination is NOT sent. The bridge reads it off the attempt row
    // the server just wrote, after the gate cleared — see the bridge route's
    // header. All the browser gets to say is which attempt this is.
    const call = await device.connect({ params: { attemptId: attempt.attemptId } });
    outboundCallRef.current = call;
    hungUpByRef.current = null;
    setMuted(false);
    setCallError("");
    const placed = {
      attemptId: attempt.attemptId,
      // "prospect" (the default), "internal" (a colleague's browser) or
      // "off_campaign" (a typed number with no record). An internal call has
      // no write-up and no transfer; the strip reads this to draw neither.
      kind: attempt.kind === "internal" || attempt.kind === "off_campaign" ? attempt.kind : "prospect",
      internal: attempt.internal || null,
      to: attempt.to || target?.phoneE164 || null,
      callerId: attempt.callerId || null,
      serverNow: attempt.serverNow || new Date().toISOString(),
      startedAt: Date.now(),
      // A typed number the record does not carry, and the server's word on
      // whether to ask afterwards whether it was theirs (never for a test
      // line or a test account — those are never saved).
      typedNotSaved: attempt.typedNotSaved === true,
      askToSave: attempt.askToSave === true,
      target: {
        prospectId: target?.prospectId || null,
        leadId: target?.leadId || null,
        businessName: target?.businessName || null,
        callLabel: target?.callLabel || null,
        phoneE164: target?.phoneE164 || attempt.to || null,
      },
    };
    setOutbound(placed);
    presenceRef.current.setCallUp(true);

    call.on("disconnect", () => {
      outboundCallRef.current = null;
      // Who dropped. The Hang up button set "rep" before disconnecting; a
      // disconnect nobody here asked for is the far end. Posted, not
      // awaited — the write-up must not wait on it, and a lost report
      // reads as "ask the rep", never as a hang-up.
      const hungUpBy = hungUpByRef.current === HUNG_UP_BY_REP ? HUNG_UP_BY_REP : HUNG_UP_BY_PROSPECT;
      hungUpByRef.current = null;
      fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ended", attemptId: placed.attemptId, hungUpBy }),
      }).catch(noop);
      if (placed.kind === "internal") {
        // A colleague call has no outcome to log — nobody was reached who
        // could sign up — so there is no write-up. The SERVER moves both
        // reps back to available on the `ended` post above (and again on
        // the carrier's completed event); this only re-reads it. The
        // client keeps no opinion about anybody's state here.
        setOutbound(null);
        setMuted(false);
        presenceRef.current.setCallUp(false);
        setTimeout(() => presenceRef.current.refresh?.(), 1200);
        return;
      }
      setOutbound(null);
      setMuted(false);
      setDraft(EMPTY_DRAFT);
      setFormError("");
      setPending({
        id: placed.attemptId,
        toE164: placed.to,
        dialledAt: placed.serverNow,
        dialChannel: "browser",
        direction: "out",
        hungUpBy,
        prospectId: placed.target.prospectId,
        leadId: placed.target.leadId,
        businessName: placed.target.businessName,
        // "Was +1 … {business}'s number?" — asked once, after the call, for a
        // typed number the record does not carry and that is not a test dial.
        // `saved` flips when the rep presses "Save it on this lead" so the
        // question is not asked twice; `answered` when either button is
        // pressed. Null when there is nothing to ask.
        numberQuestion: placed.askToSave ? { e164: placed.to, businessName: placed.target.businessName, answered: false, saved: false } : null,
        // The line may log this one — after the grace, and only if the rep
        // has not started. The rep's own hang-up is never auto-logged (the
        // server refuses it too); asking would be a wasted round trip.
        autoAsk: hungUpBy !== HUNG_UP_BY_REP,
        graceMs: AUTO_LOG_GRACE_SECONDS * 1000,
      });
      presenceRef.current.setCallUp(false);
      // The one automatic transition only this handler can make: the call
      // has ended and the outcome has not been logged. On the ledger this is
      // what separates time on the phone from time writing it up. Soft — the
      // disposition moves the rep on regardless.
      presenceRef.current.postState({ state: STATE_AFTER_CALL, callAttemptId: placed.attemptId });
    });
    call.on("error", (err) => {
      setCallError(err?.message || tRef.current("app.salesCall.callDropped"));
    });
    return call;
  }, []);

  // ── One active session ──────────────────────────────────────────────
  //
  // A newer sign-in elsewhere, or a supervisor's Sign out, ends this
  // browser's session (RepStatus.js sessionLost). The Device is torn down
  // at once — OMniLeads's force_logout unregisters the phone — so no call
  // can ring a screen whose owner is gone, and the effect above will not
  // rebuild it: its token fetch is refused the same way.
  useEffect(() => {
    if (!presence.sessionLost) return;
    try {
      deviceRef.current?.destroy?.();
    } catch {
      /* already gone */
    }
    deviceRef.current = null;
  }, [presence.sessionLost]);

  /** The Call object that is up, whichever direction. */
  const liveCall = useCallback(() => outboundCallRef.current || inboundRef.current?.call || null, []);

  const hangUp = useCallback(() => {
    if (outboundCallRef.current) {
      // Before the disconnect, so the handler it fires reads "rep". The far
      // end dropping and the rep pressing the button in the same instant is
      // filed as the rep's — they pressed it.
      hungUpByRef.current = HUNG_UP_BY_REP;
      try {
        outboundCallRef.current.disconnect?.();
      } catch {
        /* the disconnect handler does the rest */
      }
      return;
    }
    // The dock's own hang-up: it clears the dock's state, and the Call's
    // `disconnect` handler (bound in the dock at ring time) posts the ledger.
    inboundRef.current?.hangUp?.();
  }, []);


  const toggleMute = useCallback(() => {
    const call = liveCall();
    if (!call || typeof call.mute !== "function") return;
    setMuted((m) => {
      const next = !m;
      try {
        call.mute(next);
      } catch {
        return m;
      }
      return next;
    });
  }, [liveCall]);

  /** DTMF, on whichever call is up. False when there is no call to send to. */
  const sendDigits = useCallback((digits) => {
    const call = liveCall();
    if (!call || typeof call.sendDigits !== "function") return false;
    try {
      call.sendDigits(String(digits));
      return true;
    } catch {
      return false;
    }
  }, [liveCall]);

  // Muted is a fact about the call; a new call starts unmuted.
  useEffect(() => {
    if (!inbound) return;
    setMuted(false);
  }, [inbound?.answeredAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── The line logs what it knows, after the grace ─────────────────────
  //
  // One timer per pending attempt. It asks the server once the grace has
  // passed, and only if the rep has not started typing — a code or a note in
  // the form means the rep is answering and the line stays out of it.
  // "not_reported" (the carrier's completed event is still in flight) is
  // asked again a few times; every other refusal leaves the form up.
  const autoAskSeen = useRef(null);
  useEffect(() => {
    if (!pending?.autoAsk || !pending.id) return undefined;
    if (autoAskSeen.current === pending.id) return undefined;
    autoAskSeen.current = pending.id;
    const attemptId = pending.id;
    const toE164 = pending.toE164;
    const dialledAt = pending.dialledAt;
    let cancelled = false;
    let timer = null;
    let tries = 0;
    const ask = async () => {
      if (cancelled) return;
      if (draftStarted(draftRef.current)) return;
      tries += 1;
      let body = null;
      try {
        body = await fetchJson("/api/sales/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "auto_log", attemptId }),
        });
      } catch {
        return; // the form is still there; the rep can log it
      }
      if (cancelled) return;
      if (body?.ok && body.code) {
        const row = pendingRef.current;
        setPending((p) => (p?.id === attemptId ? null : p));
        setAutoLogged({ attemptId, code: body.code, toE164, dialledAt, until: Date.now() + AUTO_LOG_UNDO_SECONDS * 1000 });
        // The server moved the rep to available; the same order the typed
        // path keeps, for the same reason (see saveOutcome).
        await presenceRef.current.refresh();
        await reloadView();
        // A call that rang out is the moment for the written version. The
        // pop-up holds onWorked until it closes — see introPrompt.
        if (asksIntroEmail(body.code)) {
          setIntroPrompt({
            leadId: row?.leadId || null,
            prospectId: row?.leadId ? null : row?.prospectId || null,
            attemptId,
            businessName: row?.businessName || null,
            then: () => onWorked(),
          });
          return;
        }
        onWorked();
        return;
      }
      if (body?.reason === "not_reported" && tries < 5) {
        timer = setTimeout(ask, 3000);
        return;
      }
      // The server's word that the call was ANSWERED and the rep has to say
      // what happened: a conversation ("talked"), or the rep's own hang-up on
      // a connected call (talkSeconds is a number only when it connected).
      // This — and nothing else — opens the pop-up. A call nobody answered
      // never reaches here with a code of null and a number of seconds.
      if ((body?.reason === "talked" || body?.reason === "rep_hung_up") && typeof body?.talkSeconds === "number") {
        setSheetOpen(true);
      }
    };
    timer = setTimeout(ask, Math.max(0, Number(pending.graceMs) || 0));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `reloadView` and `onWorked` are stable; keying on the whole row would
    // re-arm the timer on every edit to it (the number question's answer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id, pending?.autoAsk]);

  // The strip goes away by itself. A rep who wants to change it after
  // fifteen seconds still can — the row is in today's list.
  useEffect(() => {
    if (!autoLogged) return undefined;
    const ms = autoLogged.until - Date.now();
    if (ms <= 0) {
      setAutoLogged(null);
      return undefined;
    }
    const id = setTimeout(() => setAutoLogged(null), ms);
    return () => clearTimeout(id);
  }, [autoLogged]);

  /** "Change": the line's outcome comes back up as the rep's to overwrite. */
  const changeAutoLogged = useCallback(() => {
    const row = autoLogged;
    if (!row) return;
    setPending({ id: row.attemptId, toE164: row.toE164, dialledAt: row.dialledAt, override: row.code, autoAsk: false });
    setAutoLogged(null);
    setDraft(EMPTY_DRAFT);
    setFormError("");
  }, [autoLogged]);

  // ── "Was +1 … {business}'s number?" ──────────────────────────────────
  //
  // Yes saves it on the record the call was filed against, through the SAME
  // door a typed dial used to take on the press (POST /api/sales/calls/
  // numbers → lib/sales/contact/record.js): the do-not-contact refusal, the
  // test-line guard and the dedupe are all there. No saves nothing. Either
  // way the question is marked answered so it is asked once. A refusal is
  // printed on the question, not swallowed — a save that silently did
  // nothing is the dead control AGENTS.md opens with.
  const [numberSaveError, setNumberSaveError] = useState("");
  const saveTypedNumber = useCallback(async () => {
    const row = pendingRef.current;
    const q = row?.numberQuestion;
    if (!q || q.answered || !q.e164 || (!row.prospectId && !row.leadId)) return;
    setNumberSaveError("");
    try {
      await fetchJson("/api/sales/calls/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(row.prospectId ? { prospectId: row.prospectId } : { leadId: row.leadId }),
          e164: q.e164,
          kind: "unknown",
          label: tRef.current("app.salesQueue.typedNumberLabel"),
          canCall: true,
        }),
      });
      setPending((p) => (p?.id === row.id ? { ...p, numberQuestion: { ...q, answered: true, saved: true } } : p));
      reloadView();
    } catch (err) {
      setNumberSaveError(err?.message || tRef.current("app.salesQueue.typedNumberNotSaved"));
    }
  }, [reloadView]);
  const dismissNumberQuestion = useCallback(() => {
    const row = pendingRef.current;
    const q = row?.numberQuestion;
    if (!q) return;
    setNumberSaveError("");
    setPending((p) => (p?.id === row.id ? { ...p, numberQuestion: { ...q, answered: true } } : p));
  }, []);

  const closeIntroPrompt = useCallback(() => {
    setIntroPrompt((p) => {
      p?.then?.();
      return null;
    });
  }, []);

  /**
   * The Text them door, from the write-up: the thread on the number that
   * was rung, the lead behind it, the blank box focused. Throws the server's
   * sentence.
   */
  const openTextFor = useCallback(
    async (row) => {
      const { href } = await openTextThread({
        e164: row?.toE164 || null,
        leadId: row?.leadId || null,
        prospectId: row?.leadId ? null : row?.prospectId || null,
      });
      router.push(href);
    },
    [router],
  );

  const saveOutcome = useCallback(async () => {
    const row = pendingRef.current;
    const d = draftRef.current;
    if (!row || !d.choice) return;
    // The fold is pure (outcomeChoices.js): the six buttons become one of the
    // table's codes, or a refusal with the sentence to print. Nothing here
    // names a code.
    const fold = foldChoice({
      key: d.choice,
      note: d.note,
      whenKind: d.whenKind,
      whenAt: d.whenAt ? new Date(d.whenAt) : null,
      notOwner: d.notOwner,
      interested: d.interested,
      which: d.which,
      now: new Date(),
    });
    if (!fold.ok) {
      setFormError(tRef.current(fold.reasonKey));
      return;
    }
    // The sub-reason, judged here with the same pure rule the server runs
    // (subDispositions.js) so the refusal prints before the round trip —
    // and judged again on the server, which is the one that counts.
    const sub = validateSubDispositionPick({ code: fold.code, subDisposition: d.sub, detail: d.subDetail, lists: subListsRef.current });
    if (!sub.ok) {
      setFormError(tRef.current(sub.reasonKey));
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
          subDisposition: sub.subDisposition,
          subDispositionDetail: sub.detail,
        }),
      });
      setPending(null);
      setDraft(EMPTY_DRAFT);
      setSheetOpen(false);
      // ── "They asked to be texted instead" opens the composer ──────────
      //
      // The outcome's retry rule schedules no re-dial (lib/sales/retryRules.js
      // text_instead); the next touch is a text, and it is the rep's to
      // write NOW, while the call is fresh. Same door as the Text them
      // button (TextThem.js openTextThread). A refusal here — the number is
      // on the do-not-contact list, or another rep's — is printed as the
      // form's error; the outcome is already saved.
      if (fold.code === "text_instead") {
        try {
          const { href } = await openTextThread({
            e164: row.toE164,
            leadId: row.leadId || null,
            prospectId: row.leadId ? null : row.prospectId || null,
          });
          await presenceRef.current.refresh();
          await reloadView();
          onWorked();
          router.push(href);
          return;
        } catch (err) {
          setFormError(err?.message || tRef.current("app.salesText.newOpenFailed"));
        }
      }
      // The server moved the rep back to available. Awaited BEFORE onWorked,
      // because the queue's autodialler arms on onWorked and reads the state
      // through the same context — armed against a row still saying on_call
      // it would stop with "not available" and wait for a press that is not
      // coming.
      await presenceRef.current.refresh();
      await reloadView();
      // A voicemail left is the moment for the written version. The pop-up
      // holds onWorked until it closes — see introPrompt.
      if (asksIntroEmail(fold.code)) {
        setIntroPrompt({
          leadId: row.leadId || null,
          prospectId: row.leadId ? null : row.prospectId || null,
          attemptId: row.id,
          businessName: row.businessName || null,
          then: () => onWorked(),
        });
        return;
      }
      onWorked();
    } catch (err) {
      setFormError(err?.message || tRef.current("app.salesCall.outcomeSaveFailed"));
    } finally {
      setBusy("");
    }
  }, [onWorked, reloadView, router]);

  // ── "Write it up later" ─────────────────────────────────────────────
  //
  // The call goes to the rep's unlogged list (UnloggedCalls.js) and the
  // dialler is freed — the server's `defer` stops holding it in
  // pendingAttempt and gives the retry pool a provisional schedule. Not a
  // dismiss: a pop-up closed with Esc IS this, so the rep is never left with
  // a form they have to find.
  const later = useCallback(async () => {
    setSheetOpen(false);
    const row = pendingRef.current;
    if (!row?.id || row.override) return;
    setBusy("defer");
    try {
      await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "defer", attemptId: row.id }),
      });
      setPending((p) => (p?.id === row.id ? null : p));
      setDraft(EMPTY_DRAFT);
      setFormError("");
      await presenceRef.current.refresh();
      await reloadView();
      onWorked();
    } catch (err) {
      // The form is still on screen; the sentence says why.
      setFormError(err?.message || tRef.current("app.salesCall.deferFailed"));
    } finally {
      setBusy("");
    }
  }, [onWorked, reloadView]);

  // ── One shape for the strip, whichever direction ─────────────────────
  const live = useMemo(() => {
    if (outbound) {
      return {
        direction: "out",
        kind: outbound.kind || "prospect",
        internal: outbound.internal || null,
        attemptId: outbound.attemptId,
        transferNote: "",
        startedAt: outbound.startedAt,
        e164: outbound.to,
        businessName: outbound.target.businessName,
        label: outbound.target.callLabel || outbound.target.businessName || outbound.to,
        callerId: outbound.callerId,
        leadId: outbound.target.leadId,
        prospectId: outbound.target.prospectId,
        links: null,
        // "Back to the call screen": the console on the business, or the lead.
        backHref: outbound.target.prospectId
          ? `/sales/queue?prospectId=${encodeURIComponent(outbound.target.prospectId)}`
          : outbound.target.leadId
            ? `/sales/leads/${encodeURIComponent(outbound.target.leadId)}`
            : "/sales/queue",
      };
    }
    if (inbound) {
      return {
        direction: "in",
        kind: inbound.internal ? "internal" : "prospect",
        internal: inbound.internal || null,
        attemptId: inbound.attemptId || null,
        transferNote: inbound.note || "",
        startedAt: inbound.answeredAt,
        e164: inbound.from,
        businessName: inbound.businessName || null,
        label: inbound.businessName || null,
        callerId: null,
        leadId: inbound.text?.leadId || null,
        prospectId: inbound.text?.prospectId || null,
        links: inbound.links || null,
        backHref: inbound.links?.open?.href || null,
      };
    }
    return null;
  }, [outbound, inbound]);

  const value = useMemo(
    () => ({
      mounted: true,
      ready,
      deviceError,
      audioWarning,
      onIncoming,
      live,
      outbound,
      inbound,
      muted,
      callError,
      connectOutbound,
      setInbound,
      hangUp,
      toggleMute,
      sendDigits,
      viewMounted,
      registerView,
      pending,
      setPending,
      adoptPending,
      draft,
      setDraft,
      subLists,
      formError,
      setFormError,
      busy,
      sheetOpen,
      autoLogged,
      introPrompt,
      closeIntroPrompt,
      saveOutcome,
      later,
      changeAutoLogged,
      openTextFor,
      numberSaveError,
      saveTypedNumber,
      dismissNumberQuestion,
    }),
    [
      ready,
      deviceError,
      audioWarning,
      onIncoming,
      live,
      outbound,
      inbound,
      muted,
      callError,
      connectOutbound,
      setInbound,
      hangUp,
      toggleMute,
      sendDigits,
      viewMounted,
      registerView,
      pending,
      adoptPending,
      draft,
      subLists,
      formError,
      busy,
      sheetOpen,
      autoLogged,
      introPrompt,
      closeIntroPrompt,
      saveOutcome,
      later,
      changeAutoLogged,
      openTextFor,
      numberSaveError,
      saveTypedNumber,
      dismissNumberQuestion,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
