// app/sales/queue/CallPanel.js
//
// The call, from the rep's side: press, talk, hang up, say what happened.
//
// ══ Two ways to place it, and the screen never offers a broken one ════════
//
// In-browser is the intended path — the rep talks through their headset and
// the prospect sees a number FieldQuo owns and answers on. It needs Twilio
// credentials, a TwiML application, at least one number, and a microphone the
// browser will actually hand over.
//
// When any of those is missing the panel falls back to the handset link, which
// is what this portal did before, and SAYS which link it is offering and why.
// What it never does is render a Call button that cannot call. A button that
// silently does nothing because a permission prompt was dismissed six weeks
// ago is the exact control AGENTS.md opens by forbidding, and microphone
// permission is the most likely single cause of it here.
//
// ══ Both paths record the attempt, and the server decides ═════════════════
//
// Every dial — browser or handset — POSTs first. The server re-asks the
// calling window with the per-24h cap now actually counted, refuses if it must,
// and writes the attempt row before anything rings. The handset link is only
// followed after that POST comes back. A rep who is offline gets a refusal
// rather than an untracked call, and that is the right way round: the cap has
// a private right of action behind it and an uncounted call is the failure.
//
// ══ The disposition is not optional, and not a modal ══════════════════════
//
// A call with no outcome makes every number computed from it wrong, and the
// rep is the only person who can fix one. So an unlogged call is rendered at
// the top of this panel, in place of the Call button, until it is written up.
// Not a modal — a modal on a phone, over a rep who is still talking, is worse
// than useless — and not a block on the rest of the portal either. The one
// thing it holds back is starting another call, because two unlogged calls is
// how a day's numbers become unrecoverable.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CircleHelp,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  ShieldAlert,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

/** "4:12". A call timer, so seconds are never dropped. */
function clock(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * What the browser will say about the microphone, before we ask for it.
 *
 * Three answers, and `null` is one of them: some browsers do not implement the
 * permissions query for microphone at all, and treating "cannot ask" as
 * "denied" would take the good path away from Firefox users for no reason.
 * Null means unknown, the call button stays live, and the real prompt happens
 * on the first press — which is where a permission prompt belongs anyway,
 * attached to an action the rep just took.
 */
async function micState() {
  try {
    if (!navigator?.permissions?.query) return null;
    const status = await navigator.permissions.query({ name: "microphone" });
    return status?.state ?? null;
  } catch {
    return null;
  }
}

export default function CallPanel({ prospectId, phoneE164, businessName, fallbackHref, onWorked }) {
  const [config, setConfig] = useState(null);
  const [mic, setMic] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  // The live call: the attempt row it belongs to, when it started, and the
  // Twilio connection object when there is one.
  const [attempt, setAttempt] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [muted, setMuted] = useState(false);
  const [tick, setTick] = useState(0);

  // Written up, or waiting to be.
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");

  const deviceRef = useRef(null);
  const callRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const body = await fetchJson("/api/sales/calls");
      setConfig(body);
      setPending(body?.pendingAttempt || null);
    } catch (err) {
      setError(err?.message || "Could not load your calling setup.");
    }
  }, []);

  useEffect(() => {
    load();
    micState().then(setMic);
  }, [load]);

  // The call timer. A counter rather than a clock — the elapsed time is
  // computed from startedAt on every render so a paused tab does not lose
  // seconds the way an incrementing counter would.
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Say we are still here, so the supervisor board can tell "available" from
  // "said they were available before the lid closed". Fire-and-forget: a
  // missed beat ages the row, which is exactly what it is for.
  useEffect(() => {
    if (!config?.store?.ready) return undefined;
    const beat = () =>
      fetch("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat" }),
      }).catch(() => {});
    const id = setInterval(beat, 60_000);
    return () => clearInterval(id);
  }, [config?.store?.ready]);

  useEffect(
    () => () => {
      // Leaving the screen must not leave a call up. The rep would still be
      // connected with nothing on screen to hang up with.
      try {
        callRef.current?.disconnect?.();
        deviceRef.current?.destroy?.();
      } catch {
        /* the SDK throws on a device already torn down; nothing to do */
      }
    },
    [],
  );

  const browserReady = Boolean(
    config?.store?.ready && config?.dial?.ready !== false && mic !== "denied",
  );
  const blocked = config?.dial?.blockedBy || null;

  const elapsed = startedAt ? Date.now() - startedAt : 0;
  // `tick` is read so the timer re-renders; the value itself is not used.
  void tick;

  const dispositions = useMemo(() => config?.dispositions || [], [config]);
  const chosen = dispositions.find((d) => d.code === code) || null;

  async function place(channel) {
    setBusy("dial");
    setError("");
    try {
      const body = await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dial", prospectId, channel }),
      });
      setAttempt(body);

      if (channel !== "browser") {
        // The attempt is recorded; now hand off to the handset. The href comes
        // from dialHref() — this file has no dial string of its own, and
        // scripts/check-sales-calling-window.mjs asserts none appears under
        // app/sales.
        if (fallbackHref) window.location.href = fallbackHref;
        setPending({ id: body.attemptId, toE164: body.to, dialledAt: body.serverNow });
        setAttempt(null);
        return;
      }

      const { Device } = await import("@twilio/voice-sdk");
      const tokenBody = await fetchJson("/api/sales/calls/token", { method: "POST" });

      const device = new Device(tokenBody.token, { logLevel: "error" });
      deviceRef.current = device;
      await device.register();

      // The destination is NOT sent. The bridge reads it off the attempt row
      // the server just wrote, after the gate cleared — see the bridge route's
      // header. All the browser gets to say is which attempt this is.
      const call = await device.connect({ params: { attemptId: body.attemptId } });
      callRef.current = call;
      setStartedAt(Date.now());
      setMuted(false);

      call.on("disconnect", () => {
        callRef.current = null;
        setStartedAt(null);
        setPending({ id: body.attemptId, toE164: body.to, dialledAt: body.serverNow });
        setAttempt(null);
        try {
          device.destroy();
        } catch {
          /* already gone */
        }
        deviceRef.current = null;
      });
      call.on("error", (err) => {
        setError(err?.message || "The call dropped.");
      });
    } catch (err) {
      // A refusal from the gate arrives with the whole decision attached, so
      // the reason shown is the same sentence the card above would print.
      const blockers = err?.data?.compliance?.blockers;
      setError(
        Array.isArray(blockers) && blockers.length
          ? blockers.map((b) => b.title).join(" ")
          : err?.message || "That call could not be placed.",
      );
    } finally {
      setBusy("");
    }
  }

  function hangUp() {
    try {
      callRef.current?.disconnect?.();
    } catch {
      /* the disconnect handler does the rest */
    }
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    const next = !muted;
    call.mute(next);
    setMuted(next);
  }

  async function saveOutcome() {
    if (!pending || !code) return;
    setBusy("disposition");
    setError("");
    try {
      await fetchJson("/api/sales/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disposition",
          attemptId: pending.id,
          disposition: code,
          note,
          callbackAt: callbackAt ? new Date(callbackAt).toISOString() : null,
        }),
      });
      setPending(null);
      setCode("");
      setNote("");
      setCallbackAt("");
      await load();
      onWorked?.();
    } catch (err) {
      setError(err?.message || "That outcome could not be saved.");
    } finally {
      setBusy("");
    }
  }

  // ── While the tables are absent ──────────────────────────────────────────
  //
  // Reads the store's own answer rather than a constant, so this disappears on
  // its own the day the models land. Until then the handset link still works
  // and nothing pretends a call is being recorded.
  if (config && !config.store?.ready) {
    return (
      <div className="space-y-2">
        {fallbackHref ? (
          <a href={fallbackHref} className={`${BTN} bg-primary text-primary-foreground w-full`}>
            <Phone size={16} /> Call {phoneE164}
          </a>
        ) : null}
        <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Calls are not being recorded yet.</p>
          <p className="break-words">
            {config.store.missing.join(" and ")} {config.store.missing.length > 1 ? "are" : "is"} not in
            the database, so nothing counts your dials and the three-per-24-hours cap in Oklahoma and
            Florida is not being kept for you. Keep track yourself until it is.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {/* ── On a call ───────────────────────────────────────────────────── */}
      {startedAt ? (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100 break-words">
              On a call with {businessName || phoneE164}
            </p>
            <p className="text-xl font-mono tabular-nums text-emerald-900 dark:text-emerald-100">
              {clock(elapsed)}
            </p>
          </div>
          {attempt?.callerId ? (
            <p className="text-xs text-emerald-900 dark:text-emerald-200 break-words">
              They can see {attempt.callerId}. Say it out loud — a callback number is part of
              identifying yourself in Canada, and it is the number that reaches us.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={`${BTN} border border-emerald-400 text-emerald-900 dark:text-emerald-100 flex-1`}
              onClick={toggleMute}
            >
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              className={`${BTN} bg-red-600 text-white flex-1`}
              onClick={hangUp}
            >
              <PhoneOff size={16} /> Hang up
            </button>
          </div>
        </div>
      ) : null}

      {/* ── An unlogged call, which outranks starting another ───────────── */}
      {!startedAt && pending ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3">
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              What happened on that call?
            </p>
            <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
              You rang {pending.toE164}. Nothing else can tell us how it went, and every number on your
              own screen is computed from these answers.
            </p>
          </div>

          <select
            className={FIELD}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Call outcome"
          >
            <option value="">Pick an outcome…</option>
            {dispositions.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
          {chosen ? (
            <p className="text-xs text-amber-900 dark:text-amber-200 break-words">{chosen.hint}</p>
          ) : null}

          {chosen?.requiresCallback ? (
            <label className="block text-sm">
              <span className="text-amber-900 dark:text-amber-100">When did they say to ring back?</span>
              <input
                type="datetime-local"
                className={FIELD}
                value={callbackAt}
                onChange={(e) => setCallbackAt(e.target.value)}
              />
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="text-amber-900 dark:text-amber-100">
              {chosen?.requiresNote ? "What did they say? (required)" : "Anything worth remembering"}
            </span>
            <textarea
              className={FIELD}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                chosen?.requiresNote
                  ? "As close to their words as you can get."
                  : "Optional."
              }
            />
          </label>

          <button
            type="button"
            className={`${BTN} bg-primary text-primary-foreground w-full`}
            disabled={!code || Boolean(busy)}
            onClick={saveOutcome}
          >
            {busy === "disposition" ? <Loader2 className="animate-spin" size={16} /> : null}
            Save the outcome
          </button>
        </div>
      ) : null}

      {/* ── The call button ─────────────────────────────────────────────── */}
      {!startedAt && !pending ? (
        <div className="space-y-2">
          {browserReady ? (
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground w-full`}
              disabled={Boolean(busy)}
              onClick={() => place("browser")}
            >
              {busy === "dial" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Phone size={16} />
              )}
              Call {businessName || phoneE164}
            </button>
          ) : null}

          {!browserReady && fallbackHref ? (
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground w-full`}
              disabled={Boolean(busy)}
              onClick={() => place("handset")}
            >
              {busy === "dial" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Phone size={16} />
              )}
              Call {phoneE164} from your phone
            </button>
          ) : null}

          {/* Why the good path is not on offer. Never silent: a rep who does
              not know the browser refused the microphone will assume the
              product is broken, and they will be half right. */}
          {!browserReady && config ? (
            <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                {mic === "denied" ? (
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <CircleHelp size={16} className="mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground break-words">
                    {mic === "denied"
                      ? "This browser has refused the microphone."
                      : blocked?.title
                        ? `Calling through FieldQuo needs: ${blocked.title}`
                        : "Calling through FieldQuo is not set up on this deployment."}
                  </p>
                  <p className="break-words">
                    {mic === "denied"
                      ? "Nothing can be spoken into, so the in-app call button is switched off rather than left looking live. Re-allow the microphone in this site's settings and reload."
                      : blocked?.fix ||
                        "Your call is still recorded — it goes out from your own phone instead, and the prospect sees your number rather than ours."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
