"use client";

// app/platform/sales/floor/page.js
//
// The live board. Who is on a call, who is writing one up, who is paused and
// why — and what today's calls actually came to.
//
// ══ Every state on this screen was DECLARED by a rep ══════════════════════
//
// "On a call" begins when a rep presses dial and ends when they say it ended.
// It is time on the prospect, not talk time, and the column is labelled that
// way. Talk time appears only where a call was bridged and the carrier
// reported a duration, and it always prints the number of calls it was
// computed from — a mean over the four bridged calls in a day of forty is a
// real number about four calls and a lie about forty.
//
// ══ A stale row is not a green row ════════════════════════════════════════
//
// A rep whose browser last spoke twenty minutes ago is rendered in the third
// tone — the dashed, muted "unknown" the rep queue already uses for a fact we
// could not establish. A board that paints them the same green as somebody
// actually at their desk is how a supervisor rings a rep who went home, and it
// is the whole reason livePresence returns `stale` beside `state` rather than
// folding one into the other.
//
// ══ "Never signed in" is now a fact, not an inference ═════════════════════
//
// It used to be printed whenever a rep had no SalesRepActivity row. Nothing
// writes one of those when somebody opens the portal — only pressing dial,
// pausing or going available does — so the board said "has never signed in"
// about reps who had worked all morning, and a supervisor reading it concluded
// they had not showed up. SalesRep.lastSeenAt is the observed fact that was
// missing, stamped by lib/sales/gate.js, and the card now prints three
// different things: never seen, signed in but not on the floor, or the state
// they declared. Signing in deliberately does NOT put anybody in the routing
// pool — that would be inventing a declaration.
//
// ══ Read-only, with one exception the owner took on 2026-09-21 ════════════
//
// This header used to say there was no control here that reached into a
// rep's day — no forced logout, no forced pause, no listening in — because
// each is a separate product decision and none had been taken. One has:
// live-call SUPERVISION. A superadmin can listen to a rep's call, whisper
// to the rep, barge in, or take the call, from the live row, through their
// own browser (a Twilio Device on this page, identity `supervisor:<id>`).
// The model is OMniLeads' supervisor board (supervision_app/static/…/
// supervision.js obtenerNodosAcciones, lines 210–235: CHANSPY and
// CHANSPYWISHPER buttons per agent; supervisor_activity.py lines 34–35 for
// the full list); lib/sales/calls/supervision.js says how it is done on
// Twilio and why every call runs in a conference when it is on. It is OFF
// by default — it costs conference minutes — and when it is off the
// buttons are not drawn and this screen says why. Forced logout, forced
// pause and claim reassignment remain untaken decisions.
//
// Nothing here is EDITED on a company's data: these are FieldQuo's own reps
// on FieldQuo's own calls, which is what the platform console is for.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CircleHelp,
  Clock,
  Coffee,
  Ear,
  Headphones,
  Loader2,
  MessageSquare,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetchJson";
import { describeDuration } from "@/lib/sales/calls/agentState";

// Cents → "$0.0412". Four places because a browser leg is $0.004 and two
// places would print a real cost as nothing. Null prints as the word.
const money = (cents) => {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) return "unknown";
  const d = Number(cents) / 100;
  return `$${d.toFixed(d < 1 ? 4 : 2)}`;
};
// A rate() from lib/sales/performance.js: the percentage, or the fraction
// while it is below the floor.
const pct = (r) => (r?.value != null ? `${r.value}%` : `${r?.hit ?? 0} of ${r?.sampleSize ?? 0}`);

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

/**
 * One tone per state, plus a fourth for stale — which is deliberately the
 * `unknown` tone and not a dimmer version of the state's own colour.
 */
const TONE = {
  on_call: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 border-emerald-300 dark:border-emerald-800",
  after_call: "bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 border-sky-300 dark:border-sky-800",
  available: "bg-card text-foreground border-border",
  paused: "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-800",
  offline: "bg-muted text-muted-foreground border-border",
  stale: "bg-muted text-muted-foreground border-border border-dashed",
};

const STATE_ICON = {
  on_call: PhoneCall,
  after_call: Clock,
  available: Headphones,
  paused: Coffee,
  offline: CircleHelp,
};

function prettyLine(e164) {
  const d = String(e164 || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return e164 || "";
}

/** "0:42" from an ISO instant to now. */
function since(iso, now = Date.now()) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return "0:00";
  const total = Math.max(0, Math.floor((now - t) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const KIND_WORD = { listen: "Listening to", whisper: "Whispering to", barge: "On the call with", take: "Took the call from" };

/**
 * The supervisor's phone: one Twilio Device for this page, minted from
 * /api/platform/sales/supervision/token (superadmin only, dial-out only),
 * and the one call it has up. The MODE is never chosen here — the server
 * wrote it on the attempt when `start` was posted, and the bridge reads it
 * from there; this only connects with the attempt id and keeps the bar
 * honest about what the server says.
 */
function useSupervisorPhone({ enabled, onChange }) {
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [live, setLive] = useState(null); // { attemptId, kind, repName, since, joined, wantTake }
  const liveRef = useRef(null);
  liveRef.current = live;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let device = null;
    let timer = null;
    const mint = async () => {
      const body = await fetchJson("/api/platform/sales/supervision/token", { method: "POST" });
      return { token: body?.token || null, ttl: Number(body?.expiresInSeconds) || 600 };
    };
    (async () => {
      try {
        const { token, ttl } = await mint();
        if (!token || cancelled) return;
        const { Device } = await import("@twilio/voice-sdk");
        device = new Device(token, { logLevel: "error", codecPreferences: ["opus", "pcmu"] });
        deviceRef.current = device;
        device.on("error", (err) => {
          if (!cancelled) setDeviceError(err?.message || "The supervisor line dropped.");
        });
        const refresh = async () => {
          try {
            const { token: fresh } = await mint();
            if (fresh && !cancelled) device.updateToken(fresh);
          } catch {
            /* the next timer tries again */
          }
        };
        device.on("tokenWillExpire", refresh);
        timer = setInterval(refresh, Math.max(60, Math.floor(ttl / 2)) * 1000);
        // Dial-out only: no register(), nothing rings this browser.
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setDeviceError(err?.message || "The supervisor line could not start.");
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        callRef.current?.disconnect?.();
        device?.destroy?.();
      } catch {
        /* already gone */
      }
      deviceRef.current = null;
      setReady(false);
    };
  }, [enabled]);

  const post = useCallback(async (body) => {
    return fetchJson("/api/platform/sales/supervision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }, []);

  const leave = useCallback(async () => {
    const current = liveRef.current;
    try {
      callRef.current?.disconnect?.();
    } catch {
      /* already gone */
    }
    callRef.current = null;
    setLive(null);
    if (current?.attemptId) {
      await post({ action: "leave", attemptId: current.attemptId }).catch(() => {});
    }
    onChange?.();
  }, [post, onChange]);

  /** Listen / whisper / barge / take on a live row. */
  const start = useCallback(
    async ({ attemptId, kind, repName }) => {
      if (!deviceRef.current) {
        setError("The supervisor line is not ready yet.");
        return;
      }
      if (liveRef.current) {
        setError("Leave the call you are on first.");
        return;
      }
      setBusy(attemptId);
      setError("");
      try {
        const body = await post({ action: "start", attemptId, kind });
        const call = await deviceRef.current.connect({ params: { supervise: attemptId } });
        callRef.current = call;
        setLive({ attemptId, kind: body?.state?.kind || kind, repName, since: body?.state?.since || new Date().toISOString(), joined: false, wantTake: kind === "take" });
        call.on("disconnect", () => {
          // The room ended, or the leg was hung up server-side. The row is
          // closed by the conference callback; this only clears the bar.
          callRef.current = null;
          setLive(null);
          onChange?.();
        });
        call.on("error", (err) => setError(err?.message || "The supervisor leg dropped."));
        onChange?.();
      } catch (err) {
        setError(err?.message || "Could not join the call.");
        try {
          callRef.current?.disconnect?.();
        } catch {
          /* nothing up */
        }
        callRef.current = null;
        setLive(null);
      } finally {
        setBusy("");
      }
    },
    [post, onChange],
  );

  const mode = useCallback(
    async (kind) => {
      const current = liveRef.current;
      if (!current) return;
      setBusy(current.attemptId);
      setError("");
      try {
        const body = await post({ action: "mode", attemptId: current.attemptId, kind });
        setLive((l) => (l ? { ...l, kind: body?.state?.kind || kind } : l));
        onChange?.();
      } catch (err) {
        setError(err?.message || "Could not change mode.");
      } finally {
        setBusy("");
      }
    },
    [post, onChange],
  );

  const take = useCallback(async () => {
    const current = liveRef.current;
    if (!current) return;
    setBusy(current.attemptId);
    setError("");
    try {
      const body = await post({ action: "take", attemptId: current.attemptId });
      setLive((l) => (l ? { ...l, kind: body?.state?.kind || "take", wantTake: false } : l));
      onChange?.();
    } catch (err) {
      setError(err?.message || "Could not take the call.");
    } finally {
      setBusy("");
    }
  }, [post, onChange]);

  // While a leg is up: poll the server for `joined` (the bridge recorded
  // the supervisor's CallSid), and finish a pending take once it is.
  useEffect(() => {
    if (!live?.attemptId || live.joined) return undefined;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const body = await fetchJson(`/api/platform/sales/supervision?attemptId=${encodeURIComponent(live.attemptId)}`);
        if (cancelled) return;
        if (body?.state?.ended) {
          leave();
          return;
        }
        if (body?.state?.joined) {
          setLive((l) => (l ? { ...l, joined: true, kind: body.state.kind || l.kind } : l));
          if (live.wantTake) take();
        }
      } catch {
        /* the next tick asks again */
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [live?.attemptId, live?.joined, live?.wantTake, leave, take]);

  return { ready, deviceError, live, busy, error, start, mode, take, leave };
}

export default function SalesFloorPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/floor"));
    } catch (err) {
      setError(err?.message || "Could not load the floor.");
    } finally {
      setLoading(false);
    }
  }, []);

  const supervisionOn = Boolean(data?.supervision?.enabled);
  const phone = useSupervisorPhone({ enabled: supervisionOn, onChange: load });

  useEffect(() => {
    load();
    // Fifteen seconds. Fast enough that "on a call" is current, slow enough
    // that a board left open all day is not a load test. Nothing here streams:
    // a websocket would be a second transport for one screen, and a supervisor
    // reading a fifteen-second-old board is not making a worse decision than
    // one reading a live one.
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const stateLabels = Object.fromEntries((data?.states || []).map((s) => [s.code, s.label]));
  const pauseLabels = Object.fromEntries((data?.pauseReasons || []).map((p) => [p.code, p.label]));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Sales floor</h1>
          <p className="text-sm text-muted-foreground">
            Live, read-only, and refreshed every fifteen seconds. Every state below is one a rep
            declared — nothing here is observed from a phone line. The one exception is “signed
            in”, which is the portal noticing them arrive; it is not a state, and nobody is routed
            a call on it.
          </p>
        </div>
        <button type="button" className={`${BTN} border border-border`} onClick={load}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {/* ── The supervisor's live bar ─────────────────────────────────────
          "Listening to Umar · 0:42 · Whisper · Barge · Take · Leave". Drawn
          only while this browser has a leg up; the mode word is the
          server's, refreshed after every action. */}
      {phone.live ? (
        <div className="sticky top-0 z-30 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-3 flex flex-wrap items-center gap-3" data-supervisor-bar={phone.live.kind}>
          <Ear size={18} className="shrink-0" aria-hidden="true" />
          <p className="font-semibold text-emerald-900 dark:text-emerald-100 min-w-0 break-words">
            {KIND_WORD[phone.live.kind] || "On"} {phone.live.repName || "the rep"} · <span className="tabular-nums">{since(phone.live.since)}</span>
            {!phone.live.joined ? <span className="font-normal text-sm"> · connecting…</span> : null}
          </p>
          <div className="flex flex-wrap gap-2 ml-auto">
            {phone.live.kind !== "take" ? (
              <>
                {phone.live.kind !== "listen" ? (
                  <button type="button" className={`${BTN} border border-border bg-card`} disabled={Boolean(phone.busy) || !phone.live.joined} onClick={() => phone.mode("listen")}>
                    <Ear size={15} aria-hidden="true" /> Listen
                  </button>
                ) : null}
                {phone.live.kind !== "whisper" ? (
                  <button type="button" className={`${BTN} border border-border bg-card`} disabled={Boolean(phone.busy) || !phone.live.joined} onClick={() => phone.mode("whisper")}>
                    <MessageSquare size={15} aria-hidden="true" /> Whisper
                  </button>
                ) : null}
                {phone.live.kind !== "barge" ? (
                  <button type="button" className={`${BTN} border border-border bg-card`} disabled={Boolean(phone.busy) || !phone.live.joined} onClick={() => phone.mode("barge")}>
                    <Users size={15} aria-hidden="true" /> Barge
                  </button>
                ) : null}
                <button type="button" className={`${BTN} border border-red-300 text-red-800 dark:text-red-200 bg-card`} disabled={Boolean(phone.busy) || !phone.live.joined} onClick={phone.take}>
                  <PhoneForwarded size={15} aria-hidden="true" /> Take the call
                </button>
              </>
            ) : null}
            <button type="button" className={`${BTN} bg-red-600 text-white`} onClick={phone.leave}>
              <PhoneOff size={15} aria-hidden="true" /> {phone.live.kind === "take" ? "Hang up" : "Leave"}
            </button>
          </div>
          {phone.error ? <p className="w-full text-sm text-red-700 dark:text-red-300 break-words">{phone.error}</p> : null}
        </div>
      ) : phone.error || phone.deviceError ? (
        <p className="text-sm text-red-700 dark:text-red-300 break-words">{phone.error || phone.deviceError}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Loading the floor…
        </div>
      ) : null}

      {/* ── The tables are not there yet ─────────────────────────────────── */}
      {data && !data.store?.ready ? (
        <div className={CARD}>
          <p className="font-semibold text-foreground">This board has nothing to draw from yet.</p>
          <p className="text-sm text-muted-foreground break-words">
            {data.store.missing.join(" and ")} {data.store.missing.length > 1 ? "are" : "is"} not in
            the database. The definitions are ready in {data.store.pendingSchemaFile}; until they are
            added, dials are not recorded, the Oklahoma and Florida three-per-24-hours cap is not
            being counted, and nobody's state is being kept. A board of zeroes would read as a very
            quiet day, so there is not one.
          </p>
          <div className="pt-2">
            <p className="text-xs font-semibold text-foreground">Reps who would be on it</p>
            <p className="text-sm text-muted-foreground break-words">
              {(data.reps || []).map((r) => r.name).join(", ") || "None active."}
            </p>
          </div>
        </div>
      ) : null}

      {/* ── The board ────────────────────────────────────────────────────── */}
      {data?.store?.ready ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            {(data.reps || []).map((rep) => {
              const p = rep.presence;
              const stale = Boolean(p?.stale);
              const state = p?.state || "offline";
              const Icon = STATE_ICON[state] || CircleHelp;
              const tone = stale ? TONE.stale : TONE[state] || TONE.offline;
              const s = rep.stats;
              // ── Three answers, and the middle one used to be missing ────
              //
              // A rep with no activity row was printed as "has never signed
              // in". Nothing writes an activity row when somebody opens the
              // portal — only dialling, pausing or going available does — so
              // that sentence was said about reps who had been working all
              // morning. `everSignedIn` is the observed fact (see
              // SalesRep.lastSeenAt); `everSeen` remains what it always was,
              // "has declared a state", and the two must not be merged: a rep
              // who has only signed in is not on the floor and is not routable.
              const declared = p?.everSeen !== false;
              const seenNotOnFloor = !declared && p?.everSignedIn === true;
              return (
                <div key={rep.id} className={`rounded-xl border p-4 space-y-2 ${tone}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">
                        {rep.name}
                        {rep.agency ? <span className="text-xs font-normal text-muted-foreground"> · {rep.agency.name}</span> : null}
                      </p>
                      <p className="text-sm flex items-center gap-1.5">
                        <Icon size={14} className="shrink-0" />
                        {declared
                          ? `${stateLabels[state] || state}${
                              p?.pauseReason ? ` — ${pauseLabels[p.pauseReason] || p.pauseReason}` : ""
                            }`
                          : seenNotOnFloor
                            ? "Signed in — not on the floor"
                            : "Never signed in"}
                        {p?.forMs != null && declared ? ` · ${describeDuration(p.forMs)}` : ""}
                      </p>
                      {/* The distinction, said rather than left to a colour.
                          "Not on the floor" is a fact about what they have not
                          declared; it is not a claim that they are idle. */}
                      {seenNotOnFloor ? (
                        <p className="text-xs break-words">
                          Last seen in the portal at{" "}
                          {new Date(p.portalSeenAt).toLocaleTimeString()}. They have not said
                          whether they are available, so nothing is routed to them.
                        </p>
                      ) : null}
                      {!declared && !seenNotOnFloor ? (
                        <p className="text-xs break-words">
                          There is no record of this account opening the portal.
                        </p>
                      ) : null}
                      {/* The line their next dial presents. "None" is the
                          case that used to be silent: the dial borrowed the
                          lowest-sorting line, which was another rep's. */}
                      {rep.callerNumber ? (
                        rep.callerNumber.e164 ? (
                          <p className="text-xs break-words tabular-nums">
                            Calls from {prettyLine(rep.callerNumber.e164)}
                            {rep.callerNumber.rule === "assigned"
                              ? " — their line"
                              : rep.callerNumber.rule === "agency"
                                ? " — the agency's line"
                                : " — a pool line"}
                          </p>
                        ) : (
                          <p className="text-xs break-words font-medium">
                            No number assigned — their browser dials are refused rather than made from another rep's line.
                          </p>
                        )
                      ) : null}
                      {/* ── The live call, and what can be done about it ──
                          From the attempt row, not from presence. Buttons
                          only when the call is in a conference and
                          supervision is on; otherwise the reason. */}
                      {rep.liveCall ? (
                        <div className="mt-1 space-y-1" data-live-call={rep.liveCall.attemptId} data-live-call-kind={rep.liveCall.kind}>
                          <p className="text-xs break-words tabular-nums">
                            {rep.liveCall.kind === "internal"
                              ? `On with a colleague${rep.liveCall.internalTo?.name ? ` (${rep.liveCall.internalTo.name})` : ""}`
                              : rep.liveCall.kind === "off_campaign"
                                ? "Off-queue call"
                                : rep.liveCall.direction === "in"
                                  ? "Inbound call"
                                  : "Prospect call"}
                            {" · "}
                            {since(rep.liveCall.dialledAt)}
                            {rep.liveCall.held ? ` · On hold ${since(rep.liveCall.heldAt)}` : ""}
                            {rep.liveCall.supervision
                              ? ` · ${rep.liveCall.supervision.name || "a supervisor"} ${
                                  { listen: "listening", whisper: "whispering", barge: "on the call", take: "took the call" }[rep.liveCall.supervision.kind] || "on it"
                                }${rep.liveCall.supervision.joined ? "" : " (connecting)"}`
                              : ""}
                          </p>
                          {supervisionOn && rep.liveCall.supervisable && !rep.liveCall.supervision && !phone.live ? (
                            <div className="flex flex-wrap gap-1.5" data-supervise-buttons>
                              {[
                                ["listen", "Listen", Ear],
                                ["whisper", "Whisper", MessageSquare],
                                ["barge", "Barge", Users],
                                ["take", "Take call", PhoneForwarded],
                              ].map(([kind, label, Icon2]) => (
                                <button
                                  key={kind}
                                  type="button"
                                  className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-md border border-border bg-card text-xs font-semibold disabled:opacity-60"
                                  disabled={!phone.ready || phone.busy === rep.liveCall.attemptId}
                                  onClick={() => phone.start({ attemptId: rep.liveCall.attemptId, kind, repName: rep.name })}
                                  data-supervise={kind}
                                >
                                  <Icon2 size={13} aria-hidden="true" /> {label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {!supervisionOn ? (
                            <p className="text-xs opacity-80">
                              Supervision is off — switch it on under{" "}
                              <Link href="/platform/sales/windows" className="underline">
                                Calling rules
                              </Link>{" "}
                              to listen, whisper, barge or take a call.
                            </p>
                          ) : !rep.liveCall.supervisable ? (
                            <p className="text-xs opacity-80">
                              {rep.liveCall.kind === "internal"
                                ? "A colleague call cannot be supervised."
                                : rep.liveCall.direction === "in"
                                  ? "Inbound calls are not in a conference and cannot be supervised yet."
                                  : "This call was placed as a plain bridge (before supervision was switched on), so it cannot be joined."}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {/* Said, not shaded. A dashed box a supervisor has to
                          decode is not as good as a sentence. */}
                      {stale ? (
                        <p className="text-xs break-words">
                          Their browser has not said anything since{" "}
                          {p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleTimeString() : "we last heard"}.
                          This is what they said they were doing, not what they are doing.
                        </p>
                      ) : null}
                    </div>
                    <p className="text-2xl font-semibold tabular-nums shrink-0">{s?.dials ?? 0}</p>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="opacity-70">Reached (reported)</dt>
                    <dd className="text-right tabular-nums">
                      {s?.reportedReachRate?.value != null
                        ? `${s.reportedReachRate.value}%`
                        : `${s?.reportedReachRate?.hit ?? 0} of ${s?.reportedReachRate?.sampleSize ?? 0}`}
                    </dd>

                    {/* The other two rates, beside the self-report. The
                        carrier's counts a voicemail greeting; the transcript's
                        counts only a contractor who spoke. */}
                    <dt className="opacity-70">Answered (carrier)</dt>
                    <dd className="text-right tabular-nums">{s?.connect ? pct(s.connect.answerRate) : "—"}</dd>

                    <dt className="opacity-70">Conversation (transcript)</dt>
                    <dd className="text-right tabular-nums">
                      {s?.connect ? pct(s.connect.conversationRate) : "—"}
                      {s?.connect?.unknown ? <span className="opacity-70"> · {s.connect.unknown} not yet known</span> : null}
                    </dd>

                    <dt className="opacity-70">Autodial / by hand</dt>
                    <dd className="text-right tabular-nums">
                      {s?.dialler ? `${s.dialler.source.autodial} / ${s.dialler.source.manual}` : "—"}
                      {s?.dialler?.source?.unrecorded ? <span className="opacity-70"> · {s.dialler.source.unrecorded} unrecorded</span> : null}
                    </dd>

                    <dt className="opacity-70">Dials per floor hour</dt>
                    <dd className="text-right tabular-nums">{s?.dialler?.perFloorHour ?? "—"}</dd>

                    <dt className="opacity-70">Not written up</dt>
                    <dd className="text-right tabular-nums">{s?.dispositions?.pending ?? 0}</dd>

                    <dt className="opacity-70">Time on calls</dt>
                    <dd className="text-right tabular-nums">{s?.onCallText || "—"}</dd>

                    {/* The one figure the carrier measured, with the count it
                        was measured from. Never printed alone. */}
                    <dt className="opacity-70">Mean talk time</dt>
                    <dd className="text-right tabular-nums">
                      {s?.measured?.meanTalkText
                        ? `${s.measured.meanTalkText} (${s.measured.measuredOf} of ${s.measured.total})`
                        : "not measured"}
                    </dd>

                    <dt className="opacity-70">Paused</dt>
                    <dd className="text-right tabular-nums">{s?.pausedText || "—"}</dd>

                    {/* Hold time and supervised calls, from the attempt rows
                        (holdSeconds, supervisionKind). Zero is a real zero. */}
                    <dt className="opacity-70">On hold (total)</dt>
                    <dd className="text-right tabular-nums">
                      {s?.measured?.holdMs != null ? `${describeDuration(s.measured.holdMs)} (${s.measured.holdOf})` : "—"}
                    </dd>

                    <dt className="opacity-70">Supervised calls</dt>
                    <dd className="text-right tabular-nums">
                      {s?.supervised
                        ? `${s.supervised.calls}${s.supervised.calls ? ` (${["listen", "whisper", "barge", "take"].filter((k) => s.supervised.byKind[k]).map((k) => `${s.supervised.byKind[k]} ${k}`).join(", ")})` : ""}`
                        : "—"}
                    </dd>

                    <dt className="opacity-70">Callbacks overdue</dt>
                    <dd className="text-right tabular-nums">{s?.callbacks?.overdue?.length ?? 0}</dd>
                  </dl>
                </div>
              );
            })}
          </section>

          {/* ── The dialler ─────────────────────────────────────────────── */}
          {data.dialler ? (
            <section className={CARD}>
              <h2 className="text-base font-semibold text-foreground">Today&rsquo;s dialler</h2>
              <p className="text-xs text-muted-foreground break-words">
                The progressive dialler&rsquo;s own numbers, from the store, test lines excluded. It dials one
                prospect at a time, for a rep who is free, after a countdown they can cancel — so
                &ldquo;abandoned&rdquo; here is the rep hanging up before anybody answered, not a machine
                dropping a homeowner.
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Dials placed</dt>
                <dd className="tabular-nums">{data.dialler.placed} <span className="text-xs text-muted-foreground">({data.dialler.browserPlaced} in the browser, {data.dialler.handsetPlaced} by handset)</span></dd>
                <dt className="text-muted-foreground">Autodial / by hand</dt>
                <dd className="tabular-nums">
                  {data.dialler.source.autodial} / {data.dialler.source.manual}
                  {data.dialler.source.unrecorded ? <span className="text-xs text-muted-foreground"> · {data.dialler.source.unrecorded} before the column existed</span> : null}
                </dd>
                <dt className="text-muted-foreground">Answered / rang out</dt>
                <dd className="tabular-nums">{data.dialler.answered} / {data.dialler.rangOut}{data.dialler.open ? <span className="text-xs text-muted-foreground"> · {data.dialler.open} still open</span> : null}</dd>
                <dt className="text-muted-foreground">Abandoned (rep hung up before answer)</dt>
                <dd className="tabular-nums">{data.dialler.abandoned}</dd>
                <dt className="text-muted-foreground">Dials per floor hour</dt>
                <dd className="tabular-nums">
                  {data.dialler.perFloorHour ?? <span className="text-muted-foreground">not enough floor time yet</span>}
                  {data.dialler.floorMs != null ? <span className="text-xs text-muted-foreground"> · {describeDuration(data.dialler.floorMs)} on the floor, pauses excluded</span> : null}
                </dd>
                <dt className="text-muted-foreground">Time between calls (median)</dt>
                <dd className="tabular-nums">
                  {data.dialler.gap.medianText ?? <span className="text-muted-foreground">fewer than two dials</span>}
                  {data.dialler.gap.measuredOf ? <span className="text-xs text-muted-foreground"> · {data.dialler.gap.measuredOf} gaps; breaks over {Math.round(data.dialler.gap.breakMs / 60000)} min left out</span> : null}
                </dd>
              </dl>
            </section>
          ) : null}

          {/* ── The three rates ─────────────────────────────────────────── */}
          {data.connect ? (
            <section className={CARD}>
              <h2 className="text-base font-semibold text-foreground">Did we reach them? Three answers</h2>
              <p className="text-xs text-muted-foreground break-words">
                Each is a different fact and none replaces another. Browser calls only; a handset call
                is measured by nobody.
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground break-words">{data.connect.labels.answerRate}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{pct(data.connect.answerRate)}</dd>
                  <p className="text-xs text-muted-foreground">{data.connect.connected} of {data.connect.measured} bridged calls</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground break-words">{data.connect.labels.conversationRate}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{pct(data.connect.conversationRate)}</dd>
                  <p className="text-xs text-muted-foreground">
                    {data.connect.conversations} of {data.connect.conversations + data.connect.notConversations} transcribed connected calls
                    {data.connect.awaitingTranscript ? ` · ${data.connect.awaitingTranscript} recorded, transcript not yet known` : ""}
                    {data.connect.unrecorded ? ` · ${data.connect.unrecorded} connected but never recorded` : ""}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground break-words">{data.connect.labels.reportedReachRate}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{pct(data.connect.reportedReachRate)}</dd>
                  <p className="text-xs text-muted-foreground">what the reps logged, all channels</p>
                </div>
              </dl>
            </section>
          ) : null}

          {/* ── Cost per conversation ───────────────────────────────────── */}
          {data.cost ? (
            <section className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Cost per conversation, today</h2>
                <Link href="/platform/costs" className="text-sm underline shrink-0">All costs →</Link>
              </div>
              <p className="text-3xl font-semibold tabular-nums">
                {money(data.cost.perConversation.cents)}
                {data.cost.perConversation.isFloor ? <span className="text-sm font-normal text-muted-foreground"> (a floor)</span> : null}
              </p>
              <p className="text-xs text-muted-foreground break-words">{data.cost.perConversation.statement}</p>
              <p className="text-xs text-muted-foreground break-words">{data.cost.definition}</p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                {data.cost.parts.map((p) => (
                  <div key={p.key} className="min-w-0">
                    <dt className="text-muted-foreground capitalize">{p.key === "qa" ? "QA scoring" : p.key}</dt>
                    <dd className="tabular-nums break-words">
                      {money(p.cents)} <span className="text-muted-foreground">({p.of} of {data.cost.browserCalls}{p.unknown ? `, ${p.unknown} unknown` : ""})</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                {data.cost.browserCalls} browser calls · known total {money(data.cost.knownCents)}
                {data.cost.unknownCalls ? ` · ${data.cost.unknownCalls} with a part not yet known` : ""}
              </p>
            </section>
          ) : null}

          {/* ── Outcomes by trade ──────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">Today&rsquo;s outcomes, by trade</h2>
            {(data.campaigns || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No calls today. That is a real answer, not an empty table.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3">Trade</th>
                      <th className="py-1 pr-3 text-right">Dials</th>
                      <th className="py-1 pr-3 text-right">Not written up</th>
                      <th className="py-1 text-right">Reached (reported)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr key={c.key} className="border-t border-border">
                        <td className="py-1.5 pr-3 break-words">{c.label}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{c.dials}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">
                          {c.dispositions.pending}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {c.reportedReachRate?.value != null
                            ? `${c.reportedReachRate.value}%`
                            : `${c.reportedReachRate?.hit ?? 0} of ${c.reportedReachRate?.sampleSize ?? 0}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Inbound ────────────────────────────────────────────────── */}
          {data.inbound || data.salesVoice ? (
            <section className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">
                  If a contractor rings back
                </h2>
                <Link href={data.numberConfigHref || "/platform/crew-lines#sales-number-configuration"} className="text-sm underline shrink-0">
                  Number configuration →
                </Link>
              </div>
              {/* One paragraph, true of the pool of local numbers reps dial
                  from. The per-number webhook table and the paste-this
                  instructions left on 2026-09-17: the owner did not need
                  them on the floor, and the configuration is read live from
                  Twilio on the page the link goes to. */}
              {data.salesVoice ? (
                <p className="text-sm text-muted-foreground break-words">{data.salesVoice.text}</p>
              ) : null}
              {data.salesVoice?.warning ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p className="break-words">{data.salesVoice.warning}</p>
                  </div>
                </div>
              ) : null}
              {/* FieldQuo's advertised line is a different phone system —
                  the Retell agent — and gets one muted line, only when it is
                  switched on. Off, it is /platform/sales-agent's problem. */}
              {data.inbound && data.inbound.answeredBy !== "nobody" ? (
                <p className="text-xs text-muted-foreground break-words">Advertised line: {data.inbound.text}</p>
              ) : null}

              {/* Today's callbacks. Rendered from the row list rather than a
                  count, because the useful thing is WHICH business rang and
                  whether it landed on anybody. `null` is "we could not look"
                  and says so; an empty array is a measured zero. */}
              {data.inboundCalls === null ? (
                <p className="text-xs text-muted-foreground">
                  Couldn&rsquo;t read today&rsquo;s inbound calls. That is not the same as none.
                </p>
              ) : data.inboundCalls.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nobody has rung a sales number back today.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">Rang back</th>
                        <th className="py-1 pr-3 font-medium">Who</th>
                        <th className="py-1 pr-3 font-medium">Filed for</th>
                        <th className="py-1 pr-3 font-medium">Ended</th>
                        <th className="py-1 pr-3 font-medium">Outcome</th>
                        <th className="py-1 font-medium">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inboundCalls.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                            {new Date(c.at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-1.5 pr-3 break-words">
                            {c.businessName || c.fromE164}
                          </td>
                          <td className="py-1.5 pr-3 break-words">
                            {c.repName || (
                              <span className="text-muted-foreground">
                                nobody — this number has not been dialled from that line
                              </span>
                            )}
                          </td>
                          {/* The carrier's account, in one word. "missed" is
                              the one that used to be indistinguishable from
                              "open" — lib/sales/calls/missed.js. */}
                          <td className="py-1.5 pr-3 break-words">
                            {c.outcome === "missed" ? (
                              <span className="text-amber-800 dark:text-amber-200">missed — no message</span>
                            ) : c.outcome === "voicemail" ? (
                              "voicemail"
                            ) : c.outcome === "answered" ? (
                              "answered"
                            ) : (
                              <span className="text-muted-foreground">still open</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 break-words text-muted-foreground">
                            {c.disposition || c.providerStatus || "not logged yet"}
                          </td>
                          {/* Three answers, not two. A message with a URL is
                              playable; a zero-second one is somebody who heard
                              the beep and hung up, which is a real fact and
                              renders as itself; no recording stage at all is a
                              blank. Padding the last two into one another is
                              the failure class this repo keeps finding. */}
                          <td className="py-1.5 break-words">
                            {c.voicemailUrl ? (
                              /* Served through FieldQuo, never the provider's
                                 own URL. `voicemailUrl` holds Twilio's
                                 RecordingUrl, and putting that in an <audio
                                 src> is wrong whichever way their account
                                 setting falls: public media makes it an
                                 unauthenticated recording of a stranger's
                                 voice, and private media means this player
                                 never played. Same reasoning as
                                 lib/voice/recording.js's callRecordingHref. */
                              <audio
                                controls
                                preload="none"
                                src={`/api/platform/sales/voicemail/${encodeURIComponent(c.id)}/audio`}
                                className="h-8 max-w-[220px]"
                              >
                                <a href={`/api/platform/sales/voicemail/${encodeURIComponent(c.id)}/audio`}>
                                  Play the message
                                </a>
                              </audio>
                            ) : c.voicemailSeconds === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                heard the beep, said nothing
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {/* ── What this board does not measure ─────────────────────────────── */}
      {data ? (
        <section className={CARD}>
          <h2 className="text-base font-semibold text-foreground">
            What this board deliberately does not show
          </h2>
          <p className="text-xs text-muted-foreground">
            A zero in place of any of these would read as a measurement.
          </p>
          <ul className="space-y-2">
            {(data.notTracked || []).map((n) => (
              <li key={n.key} className="text-sm">
                <p className="font-medium text-foreground break-words">{n.label}</p>
                <p className="text-muted-foreground break-words">{n.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data?.dialMode?.refused ? (
        <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground">
          <p className="break-words">{data.dialMode.reason}</p>
        </div>
      ) : null}
    </div>
  );
}
