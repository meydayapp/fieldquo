"use client";

// app/components/sales/RepStatus.js
//
// What the rep is doing — Off, Available, Busy (on a call / writing it up),
// Paused (reason) — held once for the whole portal, the keepalive that keeps
// it true, and the picker that changes the part a rep may change.
//
// ══ 2026-09-21: the state is derived, and this file sends the keepalive ═══
//
// lib/sales/calls/agentState.js's header has the model. What it means here:
//
//   - the provider beats POST /api/sales/presence every HEARTBEAT_SECONDS
//     while any portal tab is open, again when the tab becomes visible, and
//     — from the LAST tab only (presenceBeat.js's registry) — once more with
//     `leaving: true` on pagehide. That last beat is the only thing in this
//     file that can make a rep Off; a component unmounting never does.
//   - `presence` is the SERVER's derivation, refreshed from every beat and
//     every state post. The header prints its `word` and `detail`, never a
//     stale row's state; while writing up it counts `writeUpEndsAt` down
//     each second and offers Next.
//   - when the window runs out the provider re-reads presence and, on the
//     server saying Available, bumps `availablePresses` — the one automatic
//     "press", because the window ending is the platform's clock and the
//     dialler's header says it arms on a press and on nothing else.
//   - the picker offers Available and the named pauses. Off is not on it.
//
// ══ Why this is in the shell and not on a screen ══════════════════════════
//
// The states existed (lib/sales/calls/agentState.js), the write path existed
// (POST /api/sales/calls, action "state"), the inbound router read them
// (inboundDistribution.js's reachable()), the supervisor board printed them —
// and no screen offered a rep a way to set one. A rep could be "available"
// only by never having said anything else, and "paused" only through a
// request nothing rendered. The owner's ask was the ordinary call-centre
// picker: "status: Online, Break, Dinner, Off, Meeting".
//
// A status is not a property of a screen. A rep goes to dinner from the queue,
// from a lead, from the notes. So the presence row is loaded once here, the
// picker renders in the header from lg up and in the drawer below it, and every
// screen — the queue's autodialler most of all — reads the SAME object through
// useRepPresence(). Two screens each fetching their own copy is how the
// countdown runs against a state the header disagrees with.
//
// ══ Three things flow through one context ═════════════════════════════════
//
//   presence          the open activity row, as livePresence() describes it.
//   callLive / ringing what the phone is doing, reported by the two components
//                     that hold a Twilio call — CallPanel (outbound, through
//                     setCallUp) and IncomingCallDock (inbound, through
//                     setInboundLive). Held as TWO flags and derived into one:
//                     `callLive` is true while either is up, and it is the
//                     one every reader asks — the autodialler so it never
//                     starts a call over one, the Off reminder so it never
//                     opens over one, and CallPanel so the outbound Call is
//                     refused while an inbound call is live (QA 2026-09-17:
//                     it was not, and a press placed a second dial). Two
//                     flags rather than one shared boolean because the dock's
//                     hang-up clearing a flag the panel had set would read as
//                     "no call" during the panel's own call. `callUp` is the
//                     older name for the same derived fact and is kept for
//                     the readers that use it. They are facts about THIS
//                     browser, not about the row, which is why they are not
//                     in `presence`.
//   autodial          the persisted switch, read here so the queue does not
//                     have to load the whole call console to know it.
//
// ══ The lifecycle posts through here too ══════════════════════════════════
//
// postState() is what CallPanel calls on hangup (`after_call`) and the dock
// calls on answer (`on_call`). Soft on failure, by design: the call is the
// point and the board is the commentary, the same words the dial route uses.
// A refusal (the graph does not allow the move) is reported back to the
// caller and shown nowhere it would stop a rep working.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  HEARTBEAT_SECONDS,
  PAUSE_REASONS,
  STATE_AFTER_CALL,
  STATE_AVAILABLE,
  STATE_OFFLINE,
  STATE_ON_CALL,
  STATE_PAUSED,
  STATUS_CHOICES,
  countdownText,
  describeDuration,
  presenceHeadline,
  statusChoiceFor,
} from "@/lib/sales/calls/agentState";
import { REGISTRY_PING_MS, leaveTab, newTabId, pingTab, sendBeat } from "./presenceBeat";
import { SESSION_SIGNED_IN_ELSEWHERE, SESSION_SIGNED_OUT_BY_SUPERVISOR } from "@/lib/sales/auth";

/** The two refusal codes that end this browser's session (lib/sales/auth.js). */
const SESSION_ENDED_CODES = new Set([SESSION_SIGNED_IN_ELSEWHERE, SESSION_SIGNED_OUT_BY_SUPERVISOR]);

const noop = () => {};

/**
 * What a component gets when it is rendered OUTSIDE the provider — a check
 * script rendering CallPanel on its own, or a screen that is not under
 * SalesShell. Everything is inert: no presence, no-op setters, and postState
 * answers "not mounted" rather than throwing inside a disconnect handler.
 */
const DETACHED = Object.freeze({
  mounted: false,
  presence: null,
  store: null,
  choices: STATUS_CHOICES,
  autodial: false,
  loading: false,
  error: "",
  callLive: false,
  callUp: false,
  inboundLive: false,
  inboundRinging: false,
  availablePresses: 0,
  floorRules: { afterCallSeconds: null, requireWriteUp: null, offAfterMinutes: null },
  sessionLost: null,
  refresh: async () => null,
  setStatus: async () => ({ ok: false, error: "not mounted" }),
  postState: async () => ({ ok: false, error: "not mounted" }),
  next: async () => ({ ok: false, error: "not mounted" }),
  setAutodial: async () => ({ ok: false, error: "not mounted" }),
  setCallUp: noop,
  setInboundLive: noop,
  setInboundRinging: noop,
});

const Ctx = createContext(DETACHED);

export function useRepPresence() {
  return useContext(Ctx);
}

export function RepPresenceProvider({ children }) {
  const [presence, setPresence] = useState(null);
  const [store, setStore] = useState(null);
  const [choices, setChoices] = useState(STATUS_CHOICES);
  const [autodial, setAutodialState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The outbound call CallPanel holds, and the inbound call the dock holds.
  // See the header: two sources, one derived `callLive`.
  const [outboundUp, setCallUp] = useState(false);
  const [inboundLive, setInboundLive] = useState(false);
  const callLive = outboundUp || inboundLive;
  const [inboundRinging, setInboundRinging] = useState(false);
  // Counts the rep's own presses of Available. The queue's autodialler resumes
  // on THIS number changing and on nothing else — a presence row that says
  // "available" because the rep has been available all morning must not start
  // a countdown just because the page loaded.
  const [availablePresses, setAvailablePresses] = useState(0);
  const presenceRef = useRef(null);
  presenceRef.current = presence;
  // The write-up window and the outcome rule, as the platform set them —
  // printed under the countdown so a rep knows where the clock came from.
  const [floorRules, setFloorRules] = useState({ afterCallSeconds: null, requireWriteUp: null, offAfterMinutes: null });
  // ── One active session ──────────────────────────────────────────────
  //
  // Set when the server refuses this browser's token because a newer
  // sign-in replaced it or a supervisor ended it. Once set: no more beats,
  // no more state posts, the Device is torn down (CallSession reads it),
  // and the shell prints why with a way back to the sign-in page. Never
  // cleared here — a new sign-in is a new page.
  const [sessionLost, setSessionLost] = useState(null);
  const sessionLostRef = useRef(null);
  sessionLostRef.current = sessionLost;
  const noteSessionLoss = useCallback((code) => {
    if (code && SESSION_ENDED_CODES.has(code)) {
      setSessionLost((cur) => cur || code);
      return true;
    }
    return false;
  }, []);

  const refresh = useCallback(async () => {
    if (sessionLostRef.current) return null;
    try {
      const body = await fetchJson("/api/sales/calls/state");
      setPresence(body?.presence || null);
      setStore(body?.store || null);
      if (Array.isArray(body?.statusChoices) && body.statusChoices.length) {
        setChoices(body.statusChoices);
      }
      setAutodialState(body?.autodial === true);
      setFloorRules({
        afterCallSeconds: Number.isFinite(body?.afterCallSeconds) ? body.afterCallSeconds : null,
        requireWriteUp: typeof body?.requireWriteUp === "boolean" ? body.requireWriteUp : null,
        offAfterMinutes: Number.isFinite(body?.offAfterMinutes) ? body.offAfterMinutes : null,
      });
      setError("");
      return body;
    } catch (err) {
      // The chrome is not worth a banner — the screen below says its own
      // truth — but the picker reads this and renders no control it cannot
      // honour. A session refusal IS worth one, and ends the beats.
      noteSessionLoss(err?.code);
      setError(err?.message || "");
      return null;
    } finally {
      setLoading(false);
    }
  }, [noteSessionLoss]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── The keepalive ──────────────────────────────────────────────────────
  //
  // Beats POST /api/sales/presence on the interval agentState declares —
  // whatever the state, because the beat is what MAKES the state: a rep
  // whose tab is open is present, and Off is the absence of this. Also on
  // the tab becoming visible (a phone unlocked, a laptop lid opened — the
  // interval may have been throttled to nothing meanwhile). The answer
  // carries the derived presence, so no second read.
  //
  // On pagehide, the LAST tab says goodbye with `leaving: true` and the
  // server writes the Off row at once; any other tab just leaves the
  // registry. A component unmounting, a route change, a refresh: none of
  // those is a leave — the registry sees the same tab id come straight
  // back, and the two-minute expiry covers a crash.
  const tabIdRef = useRef(null);
  useEffect(() => {
    if (!store?.ready) return undefined;
    if (!tabIdRef.current) tabIdRef.current = newTabId();
    const myId = tabIdRef.current;
    let stopped = false;
    const beat = async () => {
      if (stopped || sessionLostRef.current) return;
      pingTab(myId);
      const body = await sendBeat();
      if (stopped) return;
      if (body?.refused) {
        // The session ended elsewhere: say so, and beat no more. Any other
        // refusal (a blip, a 5xx) is retried on the next interval.
        noteSessionLoss(body.code);
        return;
      }
      if (body?.presence) setPresence(body.presence);
      else refresh();
    };
    // One beat now — the mount IS the tab being present, and the answer
    // is the first true reading of the header — then the interval.
    beat();
    const id = setInterval(beat, HEARTBEAT_SECONDS * 1000);
    const ping = setInterval(() => pingTab(myId), REGISTRY_PING_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    const onHide = () => {
      const othersAlive = leaveTab(myId);
      // A browser whose session ended has nothing to say goodbye from.
      if (!othersAlive && !sessionLostRef.current) sendBeat({ leaving: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    return () => {
      stopped = true;
      clearInterval(id);
      clearInterval(ping);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHide);
      // Unmount is not a leave: the tab is still open (a route change
      // remounts the shell). The registry entry stays; the next mount
      // re-pings the same id.
    };
  }, [store?.ready, refresh, noteSessionLoss]);

  // ── The write-up window's end ──────────────────────────────────────────
  //
  // The server holds the rep in `after_call` until writeUpEndsAt; at that
  // instant this re-reads presence and, on Available, counts one automatic
  // press so the autodialler arms — OMniLeads's auto-unpause.
  const writeUpEndsAt = presence?.state === STATE_AFTER_CALL && presence?.writeUpEndsAt ? new Date(presence.writeUpEndsAt).getTime() : null;
  useEffect(() => {
    if (!writeUpEndsAt) return undefined;
    const delay = Math.max(0, writeUpEndsAt - Date.now()) + 250;
    const id = setTimeout(async () => {
      const body = await refresh();
      if (body?.presence?.state === STATE_AVAILABLE) setAvailablePresses((n) => n + 1);
    }, delay);
    return () => clearTimeout(id);
  }, [writeUpEndsAt, refresh]);

  /**
   * One transition, through the one write path.
   *
   * Returns `{ ok, error, presence }`. The graph's refusal comes back as the
   * server's sentence — "A rep who is on a call cannot go straight to paused"
   * — so the picker prints the reason rather than a generic failure.
   */
  const postState = useCallback(async ({ state, pauseReason = null, callAttemptId = null }) => {
    if (sessionLostRef.current) return { ok: false, error: "", presence: null };
    try {
      const body = await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "state",
          state,
          ...(pauseReason ? { pauseReason } : {}),
          ...(callAttemptId ? { callAttemptId } : {}),
        }),
      });
      if (body?.presence) setPresence(body.presence);
      return { ok: true, error: "", presence: body?.presence || null };
    } catch (err) {
      noteSessionLoss(err?.code);
      return { ok: false, error: err?.message || "", presence: null };
    }
  }, [noteSessionLoss]);

  /** The picker's press: a STATUS_CHOICES entry, never a state typed here. */
  const setStatus = useCallback(
    async (choice) => {
      if (!choice || typeof choice !== "object") return { ok: false, error: "" };
      const result = await postState({ state: choice.state, pauseReason: choice.pauseReason });
      if (result.ok && choice.state === STATE_AVAILABLE) setAvailablePresses((n) => n + 1);
      return result;
    },
    [postState],
  );

  const setAutodial = useCallback(async (on) => {
    try {
      const body = await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autodial", on: Boolean(on) }),
      });
      setAutodialState(body?.autodial === true);
      return { ok: true, error: "", autodial: body?.autodial === true };
    } catch (err) {
      return { ok: false, error: err?.message || "", autodial };
    }
  }, [autodial]);

  /** Next: end the write-up window now. The same transition the picker's Available makes. */
  const next = useCallback(async () => {
    const result = await postState({ state: STATE_AVAILABLE });
    if (result.ok) setAvailablePresses((n) => n + 1);
    return result;
  }, [postState]);

  const value = useMemo(
    () => ({
      mounted: true,
      presence,
      store,
      choices,
      autodial,
      loading,
      error,
      callLive,
      callUp: callLive,
      inboundLive,
      inboundRinging,
      availablePresses,
      floorRules,
      sessionLost,
      refresh,
      setStatus,
      postState,
      next,
      setAutodial,
      setCallUp,
      setInboundLive,
      setInboundRinging,
    }),
    [
      presence,
      store,
      choices,
      autodial,
      loading,
      error,
      callLive,
      inboundLive,
      inboundRinging,
      availablePresses,
      floorRules,
      sessionLost,
      refresh,
      setStatus,
      postState,
      next,
      setAutodial,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** One tone per state, on --card. The same three-tone discipline the floor board uses. */
const TONE = {
  [STATE_AVAILABLE]:
    "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100",
  on_call:
    "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100",
  after_call:
    "border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100",
  paused:
    "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200",
  [STATE_OFFLINE]: "border-border bg-muted text-muted-foreground",
};

/** A dot in the state's colour, for the closed menu. Decorative — the words beside it carry the state. */
const DOT = {
  [STATE_AVAILABLE]: "bg-emerald-500",
  on_call: "bg-emerald-500",
  after_call: "bg-sky-500",
  paused: "bg-amber-500",
  [STATE_OFFLINE]: "bg-muted-foreground",
};

/**
 * The picker.
 *
 * `layout="row"` is the six choices as pills in one row, the current one
 * filled. `layout="menu"` is the top bar from lg up: one button reading the
 * current state ("Available · for 12m") that opens the same six as a menu
 * underneath — the "Ready to Call" dropdown of the dialler the owner sent,
 * over the same state machine. `layout="list"` is the drawer below lg: the
 * SAME button, full width, and the same six — but opened in the drawer's own
 * flow rather than floating over it, one to a row. All three render the
 * current state and how long it has been that, and all three are the same
 * control: none is a summary of another.
 *
 * Why the drawer's copy folds. Until 2026-09-17 it was the pill plus a
 * two-column grid of six 44px buttons, always open — 200px of chrome at the
 * top of a 320px-wide panel before the first row of the nav. On a phone in
 * Safari the viewport is ~660px once the toolbars are counted, so Texts,
 * Team and Notes were the only rows above the fold and the rest sat under
 * "Signed in as". The owner: "clogs all the statuses in a grid ... not
 * allowing me to see and click on Queue etc." A rep changes status a few
 * times a day and opens the drawer to go somewhere far more often, so the
 * six live behind one tap, and the tap is the same 44px button the header
 * carries from lg up.
 *
 * States the picker does not offer — on a call, writing it up, paused for a
 * reason that is not on the list — are printed as what they are, with no
 * pill highlighted, rather than rounded to the nearest choice.
 */
export function RepStatusPicker({ layout = "row" }) {
  const { t } = useTranslation();
  const { mounted, presence, store, choices, loading, setStatus, next, floorRules } = useRepPresence();
  const [busy, setBusy] = useState("");
  const [refused, setRefused] = useState("");
  // Re-render every second while writing up (the countdown), every thirty
  // seconds otherwise ("for 12m" keeps counting without a fetch).
  const [, setTick] = useState(0);
  const countingDown = presence?.state === STATE_AFTER_CALL && Boolean(presence?.writeUpEndsAt);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), countingDown ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [countingDown]);

  if (!mounted) return null;
  // No control while the tables are absent: a picker that posts into a 503 is
  // the dead control AGENTS.md opens by forbidding. The console says why.
  if (store && !store.ready) return null;

  const state = presence?.state || STATE_OFFLINE;
  const current = statusChoiceFor(presence);
  // The four words, spelt once (agentState.js presenceHeadline) for this
  // header, the agency floor and the platform floor.
  // The reasons' words are the agency floor's keys — one catalogue entry
  // per reason, not a second set for the header.
  const pauseLabels = Object.fromEntries(Object.keys(PAUSE_REASONS).map((code) => [code, t(`app.salesAgency.pause.${code}`, PAUSE_REASONS[code].label)]));
  const head = presenceHeadline(presence, { labels: { pauseReasons: pauseLabels } });
  const countdown = head.countdownSeconds === null ? null : countdownText(head.countdownSeconds);
  const stateLabel = `${t(head.key, head.params)}${countdown ? ` ${countdown}` : ""}${head.sub ? ` — ${t(head.sub.key, head.sub.params)}` : ""}`;
  const overLimit = Boolean(head.sub?.alert);
  // Past a pause's limit: one tap back to Available, beside the picker —
  // the same choice the menu carries, surfaced because the menu is closed.
  const availableChoice = choices.find((c) => c.state === STATE_AVAILABLE) || null;
  const backButton = overLimit && availableChoice ? (
    <button
      type="button"
      disabled={Boolean(busy)}
      data-status-back-available
      onClick={() => pick(availableChoice)}
      className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-lg text-sm font-semibold border border-red-700 bg-red-700 text-white disabled:opacity-60"
    >
      {busy === availableChoice.code ? <Loader2 size={12} className="animate-spin" /> : null}
      {t(availableChoice.labelKey, availableChoice.label)}
    </button>
  ) : null;
  // "for 12m" only where a start is known: a call, a pause. Available has
  // no counter (it began when the tab opened) and Off carries its time in
  // the word.
  const forText = presence?.forMs != null && (state === STATE_ON_CALL || state === STATE_PAUSED) ? describeDuration(presence.forMs) : null;
  const writingUp = state === STATE_AFTER_CALL;
  const nextButton = writingUp ? (
    <button
      type="button"
      disabled={busy === "next"}
      data-status-next
      title={floorRules?.afterCallSeconds != null ? t("app.salesPresence.windowRule", { seconds: floorRules.afterCallSeconds }) : undefined}
      onClick={async () => {
        setBusy("next");
        setRefused("");
        const result = await next();
        if (!result.ok) setRefused(result.error || t("app.salesStatus.changeFailed"));
        setBusy("");
      }}
      className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-lg text-sm font-semibold border border-primary bg-primary text-primary-foreground disabled:opacity-60"
    >
      {busy === "next" ? <Loader2 size={12} className="animate-spin" /> : null}
      {t("app.salesPresence.next")}
    </button>
  ) : null;

  /** Returns whether the change took, so the menu knows whether to close. */
  async function pick(choice) {
    if (busy || choice.code === current?.code) return true;
    setBusy(choice.code);
    setRefused("");
    const result = await setStatus(choice);
    if (!result.ok) setRefused(result.error || t("app.salesStatus.changeFailed"));
    setBusy("");
    return result.ok;
  }

  if (layout === "menu" || layout === "list") {
    return (
      <div className={layout === "list" ? "space-y-1" : "flex items-center gap-2"}>
        <StatusMenu
          inline={layout === "list"}
          t={t}
          state={state}
          stateLabel={stateLabel}
          forText={forText}
          stale={false}
          alert={overLimit}
          loading={loading}
          choices={choices}
          current={current}
          busy={busy}
          refused={refused}
          onPick={pick}
        />
        {nextButton}
        {backButton}
      </div>
    );
  }

  return (
    <div
      data-tour="sales-status"
      className="flex items-center gap-2 min-w-0 flex-wrap"
      aria-label={t("app.salesStatus.pickerAria")}
    >
      {/* What they are now, and for how long. Printed even when a pill is
          highlighted, because the duration is the half a rep coming back from
          a break wants to see. */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TONE[state] || TONE[STATE_OFFLINE]}`}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : null}
        <span className="break-words">
          {forText
            ? t("app.salesStatus.currentFor", { state: stateLabel, duration: forText })
            : stateLabel}
        </span>
      </span>

      <div className="flex items-center gap-1 flex-wrap">
        {nextButton}
        {backButton}
        {choices.map((choice) => {
          const active = current?.code === choice.code;
          return (
            <button
              key={choice.code}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => pick(choice)}
              aria-pressed={active}
              data-status-choice={choice.code}
              className={`inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-lg text-sm font-medium border disabled:opacity-60 ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {busy === choice.code ? <Loader2 size={12} className="animate-spin" /> : null}
              {t(choice.labelKey, choice.label)}
            </button>
          );
        })}
      </div>

      {refused ? (
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words basis-full">
          {refused}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The menu form of the picker. Module-level, not declared inside the
 * picker's render — a component declared inside another's body is remounted
 * on every render, which drops the open state on each thirty-second tick.
 *
 * `inline` is the drawer's form: the button spans the panel and the six
 * open BELOW it in normal flow, pushing the nav down, instead of as a
 * floating panel. A floating w-56 menu at the top of a 320px drawer would
 * cover the first four rows of the nav and be clipped by the drawer's own
 * scroll box; in flow it is one more thing the drawer scrolls.
 */
function StatusMenu({ inline = false, t, state, stateLabel, forText, stale, alert = false, loading, choices, current, busy, refused, onPick }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  // Closed by a click anywhere else or by Escape. Registered only while
  // open, so a closed menu costs no listener.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative" data-tour="sales-status" aria-label={t("app.salesStatus.pickerAria")}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-status-toggle
        className={`inline-flex items-center gap-2 min-h-[44px] rounded-lg border px-3 text-sm font-medium ${
          inline ? "w-full" : ""
        } ${alert ? "border-red-700 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100" : TONE[state] || TONE[STATE_OFFLINE]}`}
        data-status-alert={alert ? "true" : undefined}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DOT[state] || DOT[STATE_OFFLINE]}`} />
        )}
        <span className={`break-words ${inline ? "min-w-0 flex-1 text-left" : ""}`}>
          {forText ? t("app.salesStatus.currentFor", { state: stateLabel, duration: forText }) : stateLabel}
        </span>
        {stale ? <span className="opacity-80">{t("app.salesStatus.stale")}</span> : null}
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="menu"
          className={
            inline
              ? "mt-1 w-full rounded-lg border border-border bg-card p-1"
              : "absolute right-0 z-40 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg"
          }
        >
          {choices.map((choice) => {
            const active = current?.code === choice.code;
            return (
              <button
                key={choice.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={Boolean(busy)}
                data-status-choice={choice.code}
                onClick={async () => {
                  // The refusal sentence lives inside this menu, so a
                  // refused pick keeps it open: closing regardless left the
                  // rep with a menu that shut, a pill that did not change,
                  // and no word why (QA, 2026-09-17).
                  const ok = await onPick(choice);
                  if (ok !== false) setOpen(false);
                }}
                className={`w-full flex items-center gap-2 min-h-[44px] px-3 rounded-md text-left text-sm font-medium disabled:opacity-60 ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                {busy === choice.code ? <Loader2 size={12} className="animate-spin" /> : null}
                {t(choice.labelKey, choice.label)}
              </button>
            );
          })}
          {refused ? (
            <p className="px-3 py-2 text-xs text-amber-900 dark:text-amber-200 break-words">{refused}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * "You signed in somewhere else" / "A supervisor signed you out" — printed
 * once the provider has stopped beating on a session refusal, with the way
 * back. Mounted by SalesShell under the provider. Nothing else on the
 * screen is hidden: the page below may still show what it loaded, and the
 * next request it makes will be refused the same way.
 */
export function SessionEndedBanner() {
  const { t } = useTranslation();
  const { sessionLost } = useRepPresence();
  if (!sessionLost) return null;
  const key = sessionLost === SESSION_SIGNED_OUT_BY_SUPERVISOR ? "app.salesAuth.session.supervisor" : "app.salesAuth.session.elsewhere";
  return (
    <div role="alert" data-session-ended={sessionLost} className="mx-3 mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-semibold break-words">{t(key)}</p>
      <a href="/sales/login" className="mt-2 inline-flex min-h-[44px] items-center rounded-lg border border-amber-700 px-3 font-semibold">
        {t("app.salesAuth.session.signInAgain")}
      </a>
    </div>
  );
}
