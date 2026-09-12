"use client";

// app/components/sales/RepStatus.js
//
// What the rep says they are doing — Available, Break, Dinner, Meeting,
// Training, Off — held once for the whole portal, and the picker that changes
// it.
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
//   callUp / ringing  what the phone is doing, reported by the two components
//                     that hold a Twilio call — CallPanel (outbound) and
//                     IncomingCallDock (inbound). The autodialler reads them
//                     so it can never start a call over one, or over one that
//                     is arriving. They are facts about THIS browser, not
//                     about the row, which is why they are not in `presence`.
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
  REP_STATES,
  STATE_AVAILABLE,
  STATE_OFFLINE,
  STATUS_CHOICES,
  describeDuration,
  statusChoiceFor,
} from "@/lib/sales/calls/agentState";

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
  callUp: false,
  inboundRinging: false,
  availablePresses: 0,
  refresh: async () => null,
  setStatus: async () => ({ ok: false, error: "not mounted" }),
  postState: async () => ({ ok: false, error: "not mounted" }),
  setAutodial: async () => ({ ok: false, error: "not mounted" }),
  setCallUp: noop,
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
  const [callUp, setCallUp] = useState(false);
  const [inboundRinging, setInboundRinging] = useState(false);
  // Counts the rep's own presses of Available. The queue's autodialler resumes
  // on THIS number changing and on nothing else — a presence row that says
  // "available" because the rep has been available all morning must not start
  // a countdown just because the page loaded.
  const [availablePresses, setAvailablePresses] = useState(0);
  const presenceRef = useRef(null);
  presenceRef.current = presence;

  const refresh = useCallback(async () => {
    try {
      const body = await fetchJson("/api/sales/calls/state");
      setPresence(body?.presence || null);
      setStore(body?.store || null);
      if (Array.isArray(body?.statusChoices) && body.statusChoices.length) {
        setChoices(body.statusChoices);
      }
      setAutodialState(body?.autodial === true);
      setError("");
      return body;
    } catch (err) {
      // The chrome is not worth a banner — the screen below says its own
      // truth — but the picker reads this and renders no control it cannot
      // honour.
      setError(err?.message || "");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── The heartbeat ──────────────────────────────────────────────────────
  //
  // Beats while the rep is anything but offline, on the interval agentState
  // declares, and re-reads presence on each beat so a state changed from
  // another tab shows here within a minute. This is the "portal shell beats
  // every sixty seconds" agentState's PRESENCE_STALE_MINUTES comment assumes;
  // until this file the beat lived in CallPanel and ran only on the screens
  // that rendered it, so a rep reading notes went stale in fifteen minutes.
  useEffect(() => {
    if (!store?.ready) return undefined;
    const beat = async () => {
      const state = presenceRef.current?.state;
      if (state && state !== STATE_OFFLINE) {
        await fetch("/api/sales/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "heartbeat" }),
        }).catch(noop);
      }
      refresh();
    };
    const id = setInterval(beat, HEARTBEAT_SECONDS * 1000);
    return () => clearInterval(id);
  }, [store?.ready, refresh]);

  /**
   * One transition, through the one write path.
   *
   * Returns `{ ok, error, presence }`. The graph's refusal comes back as the
   * server's sentence — "A rep who is on a call cannot go straight to paused"
   * — so the picker prints the reason rather than a generic failure.
   */
  const postState = useCallback(async ({ state, pauseReason = null, callAttemptId = null }) => {
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
      return { ok: false, error: err?.message || "", presence: null };
    }
  }, []);

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

  const value = useMemo(
    () => ({
      mounted: true,
      presence,
      store,
      choices,
      autodial,
      loading,
      error,
      callUp,
      inboundRinging,
      availablePresses,
      refresh,
      setStatus,
      postState,
      setAutodial,
      setCallUp,
      setInboundRinging,
    }),
    [
      presence,
      store,
      choices,
      autodial,
      loading,
      error,
      callUp,
      inboundRinging,
      availablePresses,
      refresh,
      setStatus,
      postState,
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
 * filled. `layout="list"` is the drawer below lg — the same six as
 * full-width rows, one tap each. `layout="menu"` is the top bar from lg up:
 * one button reading the current state ("Available · for 12m") that opens
 * the same six as a menu underneath — the "Ready to Call" dropdown of the
 * dialler the owner sent, over the same state machine. All three render the
 * current state and how long it has been that, and all three are the same
 * control: none is a summary of another.
 *
 * States the picker does not offer — on a call, writing it up, paused for a
 * reason that is not on the list — are printed as what they are, with no
 * pill highlighted, rather than rounded to the nearest choice.
 */
export function RepStatusPicker({ layout = "row" }) {
  const { t } = useTranslation();
  const { mounted, presence, store, choices, loading, setStatus } = useRepPresence();
  const [busy, setBusy] = useState("");
  const [refused, setRefused] = useState("");
  // Re-render once a minute so "for 12m" keeps counting without a fetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) return null;
  // No control while the tables are absent: a picker that posts into a 503 is
  // the dead control AGENTS.md opens by forbidding. The console says why.
  if (store && !store.ready) return null;

  const state = presence?.state || STATE_OFFLINE;
  const current = statusChoiceFor(presence);
  const stateLabel = current
    ? t(current.labelKey, current.label)
    : t(`app.salesStatus.state.${state}`, REP_STATES[state]?.label || state);
  const forText = presence?.forMs != null ? describeDuration(presence.forMs) : null;

  async function pick(choice) {
    if (busy || choice.code === current?.code) return;
    setBusy(choice.code);
    setRefused("");
    const result = await setStatus(choice);
    if (!result.ok) setRefused(result.error || t("app.salesStatus.changeFailed"));
    setBusy("");
  }

  const row = layout === "row";

  if (layout === "menu") {
    return (
      <StatusMenu
        t={t}
        state={state}
        stateLabel={stateLabel}
        forText={forText}
        stale={Boolean(presence?.stale)}
        loading={loading}
        choices={choices}
        current={current}
        busy={busy}
        refused={refused}
        onPick={pick}
      />
    );
  }

  return (
    <div
      data-tour="sales-status"
      className={row ? "flex items-center gap-2 min-w-0 flex-wrap" : "space-y-2"}
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
        {presence?.stale ? (
          <span className="opacity-80">{t("app.salesStatus.stale")}</span>
        ) : null}
      </span>

      <div className={row ? "flex items-center gap-1 flex-wrap" : "grid grid-cols-2 gap-1.5"}>
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
        <p className={`text-xs text-amber-900 dark:text-amber-200 break-words ${row ? "basis-full" : ""}`}>
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
 */
function StatusMenu({ t, state, stateLabel, forText, stale, loading, choices, current, busy, refused, onPick }) {
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
        className={`inline-flex items-center gap-2 min-h-[44px] rounded-lg border px-3 text-sm font-medium ${TONE[state] || TONE[STATE_OFFLINE]}`}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DOT[state] || DOT[STATE_OFFLINE]}`} />
        )}
        <span className="break-words">
          {forText ? t("app.salesStatus.currentFor", { state: stateLabel, duration: forText }) : stateLabel}
        </span>
        {stale ? <span className="opacity-80">{t("app.salesStatus.stale")}</span> : null}
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg"
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
                  await onPick(choice);
                  setOpen(false);
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
