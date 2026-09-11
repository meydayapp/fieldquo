"use client";

// app/components/sales/AutodialControl.js
//
// The switch, the countdown, and the reasons — the visible half of the
// progressive dialler. The decision is lib/sales/autodial.js; the dial is
// CallPanel's place("browser"). This file owns the clock between them.
//
// ══ What arms a countdown, and what never does ════════════════════════════
//
// A countdown starts from exactly four things, each of them something the rep
// just did on this screen:
//
//   1. an outcome was logged (CallPanel's onWorked)      — the ordinary case
//   2. the rep pressed Available in the status picker    — coming back
//   3. the rep turned the switch on                      — an explicit start
//   4. the rep pressed Resume / Skip                     — an explicit start
//
// and from one thing the dialler does itself: a SKIP, which moves to the next
// row and counts down again, visibly, with the reason for the skip printed.
// It never starts from the page loading, from presence saying "available",
// from a call ending, or from a pause ending — a rep who comes back from
// Dinner presses Available, and THAT press is what resumes it. The page
// mounting with the switch on shows the switch on and waits.
//
// ══ Waiting for a window is a countdown to the window, not a fifth press ══
//
// When every callable row is done and the next group opens at eleven,
// nextDial() answers `wait` and this shows "Next 31 open at 11:00 (Pacific
// Time)" with a clock running down to it. At zero it does NOT dial: it calls
// arm() again — the same function the four presses call — which re-asks
// nextDial() through every gate at that moment. A rep still Available with
// the switch still on gets the ordinary five-second countdown on the first
// row of that group; a rep who went to lunch gets nothing, because the
// waiting phase was halted the moment their status changed (the same effect
// that cancels a countdown) and a halted dialler resumes only from a press.
// The wait therefore continues a press that already happened; it never
// starts from a pause.
//
// ══ One candidate at a time, selected before it is judged ═════════════════
//
// The queue computes the calling window live for the OPEN prospect only —
// that is what `callingContext` is for — so the dialler selects the candidate
// (puts it in the URL, the same way a tap on the list does) and only when the
// countdown ends asks nextDial() with that prospect's readiness at that
// moment. A window that closed during the five seconds is a skip, not a dial.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, PhoneForwarded, SkipForward, Plus } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { AUTODIAL_COUNTDOWN_SECONDS, AUTODIAL_REASONS, nextCandidate, nextDial } from "@/lib/sales/autodial";
import { STATE_AVAILABLE } from "@/lib/sales/calls/agentState";
import { useRepPresence } from "./RepStatus";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

/** The clock the windows are judged on: the server's, carried by an offset. */
const WAIT_TICK_MS = 1000;

/** Reasons the dialler stopped that a Resume press can clear. */
const RESUMABLE = new Set([
  AUTODIAL_REASONS.call_up,
  AUTODIAL_REASONS.inbound_ringing,
  AUTODIAL_REASONS.not_ready,
  AUTODIAL_REASONS.readiness_unknown,
  "cancelled",
  "not_idle",
  "moved",
]);

/**
 * The dialler's state machine.
 *
 * @param order        `[{ id, dialled, name, opensAt, opensAtLocal, zoneLabel }]`
 *                     in the day's grouped order — lib/sales/queueWindows.js's.
 * @param currentId    the open prospect.
 * @param readiness    `{ decision, reason }` for the open prospect, live.
 * @param select       puts a prospect in the URL (the queue's own select()).
 * @param browserReady whether CallPanel can dial in-browser; null = unknown.
 * @param clockOffsetMs server clock minus the laptop's, from the queue's
 *                     `serverNow` stamp, so a window is judged on the clock
 *                     the server will judge the dial on.
 */
export function useAutodial({ order, currentId, readiness, select, browserReady = null, clockOffsetMs = 0 }) {
  const presence = useRepPresence();
  const { autodial: switchOn, callUp, inboundRinging, availablePresses } = presence;
  const state = presence.presence?.state || null;

  const [phase, setPhase] = useState("idle"); // idle | countdown | waiting | dialling | stopped
  const [target, setTarget] = useState(null);
  const [endsAt, setEndsAt] = useState(null);
  const [remaining, setRemaining] = useState(AUTODIAL_COUNTDOWN_SECONDS);
  const [stop, setStop] = useState(null); // { reason, state }
  const [lastSkip, setLastSkip] = useState(null); // { id, name, reason }
  const [skipped, setSkipped] = useState([]);
  const [token, setToken] = useState(null); // { token, prospectId }
  // The row that was open when the countdown was armed. The dialler selects
  // the target itself, so "the rep opened a different row" has to mean a row
  // that is neither the one they were on nor the one being counted down.
  const [fromId, setFromId] = useState(null);
  // The window being waited for: `{ id, opensAt, count, cursor }` — the first
  // row of the group, the instant, how many open with it, and the cursor the
  // wait was armed from so the re-ask at zero resumes from the same place.
  const [waiting, setWaiting] = useState(null);

  const firedRef = useRef(null);
  // Everything the timer reads, as of the latest render. `select` is in here
  // too: the queue declares it as a plain function, and holding it through
  // this ref rather than in arm()'s dependencies is what keeps arm — and the
  // interval that depends on it — stable across renders.
  const latest = useRef({});
  latest.current = { order, currentId, readiness, state, switchOn, callUp, inboundRinging, browserReady, skipped, select, clockOffsetMs };
  const nowMs = useCallback(() => Date.now() + (Number(latest.current.clockOffsetMs) || 0), []);

  const nameOf = useCallback(
    (id) => (Array.isArray(order) ? order.find((r) => r.id === id)?.name : null) || null,
    [order],
  );

  const halt = useCallback((reason, extra = {}) => {
    setPhase("stopped");
    setStop({ reason, ...extra });
    setEndsAt(null);
    setToken(null);
    setWaiting(null);
  }, []);

  /**
   * Start a countdown on the next candidate after `cursor` (or on `cursor`
   * itself when it is still undialled). The four arming presses and the
   * dialler's own skip all come through here.
   */
  const arm = useCallback(
    (cursor, moreSkipped = []) => {
      const l = latest.current;
      const skip = [...l.skipped, ...moreSkipped];
      // The gates first, so a press while paused says "press Available"
      // rather than starting a clock that the next render would cancel.
      const gate = nextDial({
        order: l.order,
        cursor,
        skipped: skip,
        now: nowMs(),
        readiness: { decision: "allowed" },
        state: l.state,
        switchOn: l.switchOn,
        callUp: l.callUp,
        inboundRinging: l.inboundRinging,
        browserReady: l.browserReady !== false,
      });
      if (gate.stop) {
        halt(gate.reason, { state: gate.state || null });
        return;
      }
      if (gate.wait) {
        // The next group is not open yet. A countdown to the window, not to a
        // dial — the header's "waiting" section. The selection is left where
        // the rep has it; the row is selected when the window opens.
        setStop(null);
        setTarget(gate.wait);
        setFromId(l.currentId || null);
        setWaiting({ id: gate.wait, opensAt: gate.opensAt, count: gate.count, cursor: cursor || null });
        setPhase("waiting");
        setEndsAt(gate.opensAt);
        setRemaining(Math.max(0, Math.ceil((gate.opensAt - nowMs()) / 1000)));
        firedRef.current = null;
        return;
      }
      const id = nextCandidate({ order: l.order, cursor, skipped: skip, now: nowMs() });
      if (!id) {
        halt(AUTODIAL_REASONS.exhausted);
        return;
      }
      setStop(null);
      setWaiting(null);
      setTarget(id);
      setFromId(l.currentId || null);
      setPhase("countdown");
      setEndsAt(Date.now() + AUTODIAL_COUNTDOWN_SECONDS * 1000);
      setRemaining(AUTODIAL_COUNTDOWN_SECONDS);
      firedRef.current = null;
      if (id !== l.currentId) l.select?.(id);
    },
    [halt, nowMs],
  );

  // ── The wait ───────────────────────────────────────────────────────────
  //
  // Ticks once a second against the server-corrected clock. At zero it does
  // not dial and does not count down: it calls arm() with the cursor the wait
  // was armed from, and arm() asks nextDial() again through every gate. If
  // the group is open, a five-second countdown starts on its first row; if
  // the clock says it is still shut (a laptop that ran fast), arm() answers
  // `wait` again and the clock keeps running. Nothing here reads the switch
  // or the status directly — those are the gates' job, and the "cancelled by
  // the world" effect below has already halted this phase if either moved.
  useEffect(() => {
    if (phase !== "waiting" || !endsAt) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - nowMs()) / 1000));
      setRemaining(left);
      if (left > 0 || firedRef.current === endsAt) return;
      firedRef.current = endsAt;
      arm(waiting?.cursor || null);
    };
    tick();
    const id = setInterval(tick, WAIT_TICK_MS);
    return () => clearInterval(id);
  }, [phase, endsAt, waiting, arm, nowMs]);

  // ── The clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "countdown" || !endsAt) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0 || firedRef.current === endsAt) return;

      // Zero. Ask for real, with THIS prospect's readiness at THIS moment.
      //
      // The target was put in the URL when the countdown started, and the
      // page loads it; on a slow connection it can still be loading at zero.
      // Waiting is right — the countdown has shown 0 and nothing rings until
      // the decision is made against the row itself. Fifteen seconds of that
      // and the row is skipped with "no decision", visibly, rather than dialled
      // on a decision nobody made.
      const l = latest.current;
      const loaded = l.currentId === target;
      if (!loaded && Date.now() - endsAt < 15_000) return;
      firedRef.current = endsAt;
      const ready = loaded ? l.readiness : null;
      const decision = nextDial({
        order: l.order,
        cursor: target,
        skipped: l.skipped,
        now: nowMs(),
        readiness: ready,
        state: l.state,
        switchOn: l.switchOn,
        callUp: l.callUp,
        inboundRinging: l.inboundRinging,
        browserReady: l.browserReady !== false,
      });
      if (decision.stop) {
        halt(decision.reason, { state: decision.state || null });
        return;
      }
      if (decision.skip) {
        setLastSkip({ id: decision.skip, name: nameOf(decision.skip), reason: decision.reason });
        setSkipped((s) => [...s, decision.skip]);
        arm(decision.skip, [decision.skip]);
        return;
      }
      if (decision.wait) {
        // The order regrouped under the countdown and the target now opens
        // later — the reload after an outcome can do that at a window's edge.
        // Re-arm from the target: arm() turns the same answer into a wait.
        arm(target);
        return;
      }
      setPhase("dialling");
      setEndsAt(null);
      setToken({ token: `${decision.dial}:${Date.now()}`, prospectId: decision.dial });
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phase, endsAt, target, arm, halt, nameOf, nowMs]);

  // ── Cancelled by the world ─────────────────────────────────────────────
  //
  // A ringing inbound call, a call going up, the switch going off, the rep
  // changing status, or the rep opening a different row: any of these during
  // a countdown stops it. Evaluated through nextDial so the reason printed is
  // the same vocabulary the check executes.
  //
  // A WAIT is cancelled by the same things, bar one: opening a different row
  // while waiting for eleven o'clock is reading, not leaving, so it does not
  // halt. And a reload that regroups the list during a wait is re-read here —
  // a fresh batch with callable rows in it, or the window arriving on the
  // server's side of a reload, turns the wait into the ordinary countdown by
  // the same arm() the timer would have called; a wait that is now for a
  // different instant is re-timed.
  useEffect(() => {
    if (phase !== "countdown" && phase !== "waiting") return;
    const gate = nextDial({
      order,
      cursor: phase === "waiting" ? waiting?.cursor || null : target,
      skipped,
      now: nowMs(),
      readiness: { decision: "allowed" },
      state,
      switchOn,
      callUp,
      inboundRinging,
      browserReady: browserReady !== false,
    });
    if (gate.stop) {
      halt(gate.reason, { state: gate.state || null });
      return;
    }
    if (phase === "waiting") {
      if (!gate.wait) {
        arm(waiting?.cursor || null);
      } else if (gate.wait !== waiting?.id || gate.opensAt !== waiting?.opensAt || gate.count !== waiting?.count) {
        setTarget(gate.wait);
        setWaiting((w) => ({ id: gate.wait, opensAt: gate.opensAt, count: gate.count, cursor: w?.cursor || null }));
        setEndsAt(gate.opensAt);
        firedRef.current = null;
      }
      return;
    }
    if (currentId && target && currentId !== target && currentId !== fromId) halt("moved");
  }, [phase, target, fromId, waiting, order, skipped, state, switchOn, callUp, inboundRinging, browserReady, currentId, halt, arm, nowMs]);

  // The switch going off ends everything, whatever phase. Going ON is not
  // handled here on purpose: the persisted switch arrives true from the
  // server on page load, and an effect on it would start a countdown from
  // the page loading — the one thing this dialler must never do. The
  // control's own flip() arms after a successful press instead.
  useEffect(() => {
    if (switchOn) return;
    setPhase("idle");
    setStop(null);
    setEndsAt(null);
    setToken(null);
    setWaiting(null);
  }, [switchOn]);

  // The rep pressed Available. Only the press — never the state — arms.
  const prevPresses = useRef(availablePresses);
  useEffect(() => {
    if (prevPresses.current === availablePresses) return;
    prevPresses.current = availablePresses;
    if (!switchOn || phase === "countdown" || phase === "waiting" || phase === "dialling") return;
    arm(latest.current.currentId);
  }, [availablePresses, switchOn, phase, arm]);

  /** CallPanel's answer to the press. */
  const onResult = useCallback(
    (result) => {
      if (!result || !token || result.token !== token.token) return;
      setToken(null);
      if (result.ok) {
        // Ringing. Nothing more to do until the call ends and the outcome is
        // logged — onWorked() arms the next one.
        setPhase("idle");
        return;
      }
      if (result.reason === "no_browser_calling") {
        halt(AUTODIAL_REASONS.no_browser_calling);
        return;
      }
      if (result.reason === "not_idle") {
        halt("not_idle");
        return;
      }
      // The server refused the dial — window, suppression, our own number,
      // the cap. Printed as a skip and the dialler moves on.
      setLastSkip({ id: token.prospectId, name: nameOf(token.prospectId), reason: "refused_by_server" });
      setSkipped((s) => [...s, token.prospectId]);
      arm(token.prospectId, [token.prospectId]);
    },
    [token, halt, arm, nameOf],
  );

  /**
   * An outcome was logged: the ordinary arming press.
   *
   * Deferred until the queue has RELOADED. The order this hook reads marks a
   * row dialled from its call attempt, and the queue's copy of the list is
   * the one loaded before the call — arming against it would count down on
   * the row that was just written up. So the press sets a flag, the queue
   * reloads, and the effect below arms against the fresh order.
   */
  const pendingArm = useRef(false);
  const onWorked = useCallback(() => {
    if (!latest.current.switchOn) return;
    pendingArm.current = true;
  }, []);
  useEffect(() => {
    if (!pendingArm.current) return;
    pendingArm.current = false;
    arm(latest.current.currentId);
  }, [order, arm]);

  const skip = useCallback(() => {
    if (phase !== "countdown" || !target) return;
    setLastSkip({ id: target, name: nameOf(target), reason: "skipped_by_rep" });
    setSkipped((s) => [...s, target]);
    arm(target, [target]);
  }, [phase, target, arm, nameOf]);

  const pause = useCallback(() => {
    if (phase !== "countdown" && phase !== "waiting") return;
    halt("cancelled");
  }, [phase, halt]);

  const resume = useCallback(() => {
    arm(latest.current.currentId);
  }, [arm]);

  // What the wait is for, in words the row already carries from the server:
  // the group's opening instant on the rep's clock and its zone's name.
  const waitRow = waiting ? (Array.isArray(order) ? order.find((r) => r.id === waiting.id) : null) || null : null;

  return useMemo(
    () => ({
      switchOn,
      phase,
      target,
      targetName: nameOf(target),
      remaining,
      stop,
      lastSkip,
      token,
      state,
      waiting: waiting
        ? { ...waiting, opensAtLocal: waitRow?.opensAtLocal || null, zoneLabel: waitRow?.zoneLabel || null }
        : null,
      onResult,
      onWorked,
      skip,
      pause,
      resume,
      setSwitch: presence.setAutodial,
      resumable: Boolean(stop && RESUMABLE.has(stop.reason) && state === STATE_AVAILABLE && !callUp),
    }),
    [switchOn, phase, target, nameOf, remaining, stop, lastSkip, token, state, waiting, waitRow, onResult, onWorked, skip, pause, resume, presence.setAutodial, callUp],
  );
}

/** "2h 04m 09s" / "4m 09s" / "9s" — a wait's remaining time, digits only. */
function describeWait(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/**
 * The control: switch, countdown, and the honest sentence when it is not
 * dialling.
 *
 * @param auto        what useAutodial returned.
 * @param claimLabel  the "Claim the next N" label the claim card prints, so
 *                    the exhausted state offers the same words.
 * @param onClaim     the claim card's own press, or null when no trade is
 *                    picked — then the sentence says to pick one.
 */
export default function AutodialControl({ auto, claimLabel = null, onClaim = null, busy = false }) {
  const { t } = useTranslation();
  const [flipping, setFlipping] = useState(false);
  const [flipError, setFlipError] = useState("");

  async function flip() {
    setFlipping(true);
    setFlipError("");
    const turningOn = !auto.switchOn;
    const r = await auto.setSwitch(turningOn);
    if (!r?.ok) setFlipError(r?.error || t("app.salesAutodial.switchFailed"));
    // Turning it on IS the press that arms it — the rep did that, just now.
    // The hook never arms from the switch's stored value, so this is the
    // only path from "on" to a countdown that did not follow an outcome.
    else if (turningOn) auto.resume();
    setFlipping(false);
  }

  const stopText = (stop) => {
    if (!stop) return "";
    switch (stop.reason) {
      case AUTODIAL_REASONS.not_available:
        return t("app.salesAutodial.stop.notAvailable", {
          state: t(`app.salesStatus.state.${stop.state || "offline"}`),
        });
      case AUTODIAL_REASONS.call_up:
        return t("app.salesAutodial.stop.callUp");
      case AUTODIAL_REASONS.inbound_ringing:
        return t("app.salesAutodial.stop.inboundRinging");
      case AUTODIAL_REASONS.exhausted:
        return t("app.salesAutodial.stop.exhausted");
      case AUTODIAL_REASONS.no_browser_calling:
        return t("app.salesAutodial.stop.noBrowserCalling");
      case "not_idle":
        return t("app.salesAutodial.stop.notIdle");
      case "moved":
        return t("app.salesAutodial.stop.moved");
      case "cancelled":
        return t("app.salesAutodial.stop.cancelled");
      default:
        return t("app.salesAutodial.stop.generic");
    }
  };

  const skipText = (skip) => {
    if (!skip) return "";
    const name = skip.name || t("app.salesAutodial.thatRow");
    const known = {
      skipped_by_rep: "app.salesAutodial.skip.byRep",
      refused_by_server: "app.salesAutodial.skip.refusedByServer",
      do_not_contact: "app.salesAutodial.skip.doNotContact",
      opted_out: "app.salesAutodial.skip.optedOut",
      our_own_number: "app.salesAutodial.skip.ourOwnNumber",
      no_number: "app.salesAutodial.skip.noNumber",
      refused: "app.salesAutodial.skip.windowClosed",
      unconfirmed: "app.salesAutodial.skip.unconfirmed",
      no_decision: "app.salesAutodial.skip.noDecision",
      unknown: "app.salesAutodial.skip.noDecision",
      [AUTODIAL_REASONS.readiness_unknown]: "app.salesAutodial.skip.noDecision",
      [AUTODIAL_REASONS.not_ready]: "app.salesAutodial.skip.notReady",
    };
    return t(known[skip.reason] || "app.salesAutodial.skip.notReady", { name });
  };

  return (
    <div className="space-y-2" data-tour="sales-queue-autodial">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("app.salesAutodial.title")}</p>
          <p className="text-xs text-muted-foreground break-words">{t("app.salesAutodial.intro")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={auto.switchOn}
          disabled={flipping || busy}
          onClick={flip}
          className={`${BTN} shrink-0 border ${
            auto.switchOn
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-foreground"
          }`}
        >
          {flipping ? <Loader2 className="animate-spin" size={16} /> : <PhoneForwarded size={16} />}
          {auto.switchOn ? t("app.salesAutodial.on") : t("app.salesAutodial.off")}
        </button>
      </div>
      {flipError ? (
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words">{flipError}</p>
      ) : null}

      {auto.switchOn && auto.phase === "countdown" ? (
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 break-words">
              {t("app.salesAutodial.callingIn", {
                name: auto.targetName || t("app.salesAutodial.nextRow"),
                seconds: auto.remaining,
              })}
            </p>
            <p className="text-2xl font-mono tabular-nums text-emerald-900 dark:text-emerald-100" aria-live="polite">
              {auto.remaining}
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-emerald-200 dark:bg-emerald-900 overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-400 transition-[width] duration-200"
              style={{ width: `${(auto.remaining / AUTODIAL_COUNTDOWN_SECONDS) * 100}%` }}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className={`${BTN} border border-emerald-400 text-emerald-900 dark:text-emerald-100 flex-1`} onClick={auto.skip}>
              <SkipForward size={16} /> {t("app.salesAutodial.skip")}
            </button>
            <button type="button" className={`${BTN} border border-emerald-400 text-emerald-900 dark:text-emerald-100 flex-1`} onClick={auto.pause}>
              <Pause size={16} /> {t("app.salesAutodial.pause")}
            </button>
          </div>
        </div>
      ) : null}

      {auto.switchOn && auto.phase === "waiting" && auto.waiting ? (
        <div className="rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-sky-900 dark:text-sky-100 break-words">
              {auto.waiting.zoneLabel
                ? t("app.salesAutodial.waitingForWindow", {
                    count: auto.waiting.count,
                    time: auto.waiting.opensAtLocal || "",
                    zone: auto.waiting.zoneLabel,
                  })
                : t("app.salesAutodial.waitingForWindowNoZone", {
                    count: auto.waiting.count,
                    time: auto.waiting.opensAtLocal || "",
                  })}
            </p>
            <p className="text-lg font-mono tabular-nums text-sky-900 dark:text-sky-100 whitespace-nowrap" aria-live="polite">
              {describeWait(auto.remaining)}
            </p>
          </div>
          <p className="text-xs text-sky-900/80 dark:text-sky-100/80 break-words">{t("app.salesAutodial.waitingForWindowNote")}</p>
          <button type="button" className={`${BTN} border border-sky-400 text-sky-900 dark:text-sky-100 w-full`} onClick={auto.pause}>
            <Pause size={16} /> {t("app.salesAutodial.pause")}
          </button>
        </div>
      ) : null}

      {auto.switchOn && auto.phase === "dialling" ? (
        <p className="text-sm text-foreground flex items-center gap-2">
          <Loader2 className="animate-spin" size={14} />
          {t("app.salesAutodial.dialling", { name: auto.targetName || t("app.salesAutodial.nextRow") })}
        </p>
      ) : null}

      {auto.switchOn && auto.lastSkip ? (
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words">{skipText(auto.lastSkip)}</p>
      ) : null}

      {auto.switchOn && auto.phase === "stopped" && auto.stop ? (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground space-y-2">
          <p className="break-words">{stopText(auto.stop)}</p>
          {auto.stop.reason === AUTODIAL_REASONS.exhausted ? (
            onClaim ? (
              <button type="button" className={`${BTN} bg-primary text-primary-foreground w-full`} disabled={busy} onClick={onClaim}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                {claimLabel || t("app.salesAutodial.claimMore")}
              </button>
            ) : (
              <a href="#q-trade" className="text-sm font-medium underline text-foreground">
                {t("app.salesAutodial.pickTradeToClaim")}
              </a>
            )
          ) : null}
          {auto.resumable ? (
            <button type="button" className={`${BTN} border border-border text-foreground w-full`} onClick={auto.resume}>
              <Play size={16} /> {t("app.salesAutodial.resume")}
            </button>
          ) : null}
        </div>
      ) : null}

      {auto.switchOn && auto.phase === "idle" && !auto.stop ? (
        <p className="text-xs text-muted-foreground break-words">{t("app.salesAutodial.waiting")}</p>
      ) : null}
    </div>
  );
}
