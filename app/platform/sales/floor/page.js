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
// way — "including ringing and voicemail". Talk time appears only where a
// call was bridged and the carrier reported a duration, and only over REAL
// conversations, with the count it was computed from beside it — a mean
// over the four conversations in a day of forty is a real number about four
// calls and a lie about forty.
//
// ══ The calls figures are the performance page's, not this screen's ═══════
//
// Until 2026-09-21 this card carried its own definitions: "Calls from <the
// rep's assigned line> — their line" over a dial count (attribution read as
// by line, when chooseCallerId dials from whichever line is nearest the
// prospect and a rep's calls go out from other reps' lines), "Answered
// (carrier)" (a voicemail greeting counted), "Conversation (transcript) 8 of
// 9" (transcript COVERAGE printed as a rate) and a mean talk time over the
// "answered". The owner read the four side by side with the performance
// page and asked why they disagreed. They disagreed because they were four
// second definitions. Now every calls figure on a card is `stats.table` —
// lib/sales/calls/dialTable.js, attribution by attempt, joined to Twilio by
// the prospect leg's sid, the four buckets and the red carrier-missing rule
// — the same object /platform/sales/performance prints, drawn by the same
// component. The lines a rep's calls went OUT from are printed under the
// count, because a prospect rings back the number they saw.
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
// ══ 2026-09-21: four words, derived — never a stale state ═════════════════
//
// Every card's headline is one of Off since {time} · Available · Busy · on a
// call / writing it up · Paused ({reason}), from lib/sales/calls/agentState.js
// livePresence() — the keepalive, the last call and the write-up window,
// with the rep's own pause underneath. The old board printed the last button
// pressed with a "stale" tone when the browser had gone quiet, and the owner
// read "Writing it up · 76h 26m" and "Off" beside a rep who was dialling.
// Now Off is what two minutes without the portal means, a live call is
// Busy whatever the row said, and the stale sentence is gone because there
// is no stale state to qualify: the last row's word is printed as history
// ("last state: writing it up") under an Off headline. Signing in makes a
// rep Available — no button — and a rep who has never had a keepalive is
// "Never signed in", which is a different fact from Off and stays one.
//
// ══ Three controls reach into a rep's day, and no more (2026-09-21) ═══════
//
// This board was read-only until the owner approved OMniLeads's supervisor
// actions (supervisor_activity.py ejecutar_accion_sobre_agente): Pause
// (reason "supervision"), Make available, Sign out — one row each on the
// rep's activity ledger under the admin's id, audit-logged, superadmin-only
// on the server (app/api/platform/sales/floor/rep-state). Nothing else here
// reaches a rep: no listening in, no reassigning a claim to a named person.
// The floor's own settings (the write-up window, the pause limits) are a
// card below the cards, and they change what every rep's console does.

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CircleHelp,
  Clock,
  Coffee,
  Headphones,
  Loader2,
  PhoneCall,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetchJson";
import { WORD_OFF, countdownText, dayWindowParts, describeDuration, presenceHeadline } from "@/lib/sales/calls/agentState";
import DialBuckets from "@/app/components/sales/DialBuckets";
import { SUPERVISOR_ACTIONS, SUPERVISOR_ACTION_LABELS } from "@/lib/sales/calls/supervisorActions";

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

/**
 * The words for the buckets — the platform performance page's own literals
 * (app/platform/sales/performance/page.js CALL_LABELS), repeated here only
 * because this console is English by convention and has no t(); the agency
 * tab hands DialBuckets the app.salesAgencyPerf keys. scripts/check-sales-
 * costs.mjs asserts the four names match the performance page's.
 */
const BUCKET_LABELS = {
  nobodyAnswered: "Nobody answered",
  hungUpFast: "Hung up fast",
  voicemailOrBrief: "Voicemail or brief",
  realConversation: "Real conversation",
  realConversationRate: "Real conversation",
  dialsWithLeg: (n) => `${n} ${n === 1 ? "dial" : "dials"} with a carrier leg`,
  ofDials: (n) => `of ${n}`,
  sourceTwilio: "source: Twilio",
  sourceTranscriptOrTwilio: "source: transcript, else Twilio",
  carrierMissingSince: (date, n) => `carrier data missing since ${date} (${n})`,
};

/**
 * Live reps first, then by the day's dials, then by name — a rep who is
 * Off sorts with the Off ones whatever they dialled this morning, so the
 * top of the board is who can be reached now.
 */
function sortedReps(reps) {
  return [...(reps || [])].sort((a, b) => {
    const offA = (a.presence?.state || "offline") === "offline" ? 1 : 0;
    const offB = (b.presence?.state || "offline") === "offline" ? 1 : 0;
    return offA - offB || (b.stats?.dials ?? 0) - (a.stats?.dials ?? 0) || String(a.name).localeCompare(String(b.name));
  });
}

/** "Today, since 08:00" — or, when the UTC day opened on the viewer's yesterday, says so. */
function windowSentence(from) {
  const w = dayWindowParts(from);
  if (!w) return null;
  return w.sameDay ? `Today, since ${w.time}` : `Since yesterday, ${w.time} (the day is cut at midnight UTC)`;
}

/**
 * A supervisor's three buttons on one rep. Each posts the action, prints
 * the refusal under itself when the graph says no ("Already paused"), and
 * asks the board to reload so the card shows the ledger's answer rather
 * than an optimistic one. Sign out asks first: it ends the rep's session
 * everywhere and tears their phone down.
 */
function SupervisorButtons({ rep, onDone }) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  async function act(action) {
    if (action === "sign_out" && !window.confirm(`Sign ${rep.name} out of the sales portal? Their session ends everywhere and their phone is torn down; they can sign in again.`)) return;
    setBusy(action);
    setNote("");
    try {
      await fetchJson("/api/platform/sales/floor/rep-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repId: rep.id, action }) });
      onDone?.();
    } catch (err) {
      setNote(err?.message || "Refused.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1 pt-1" data-supervisor-actions>
      {SUPERVISOR_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          disabled={Boolean(busy)}
          onClick={() => act(action)}
          data-supervisor-action={action}
          className={`inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-muted disabled:opacity-60 ${action === "sign_out" ? "text-red-700 dark:text-red-300" : ""}`}
        >
          {busy === action ? <Loader2 size={12} className="animate-spin" /> : null}
          {SUPERVISOR_ACTION_LABELS[action]}
        </button>
      ))}
      {note ? <span className="text-xs text-amber-900 dark:text-amber-200 break-words basis-full">{note}</span> : null}
    </div>
  );
}

/**
 * The floor's tunables — the write-up window after every call, whether a
 * missing outcome holds a rep in it, and a maximum per pause reason. lib/sales/calls/
 * floorSettings.js says what each does; PUT /api/platform/sales/
 * floor-settings is superadmin-only and audit-logged. A save that fails
 * says so in words and leaves the form as typed; the board's own poll
 * re-reads the stored values every fifteen seconds.
 */
function FloorSettingsCard({ settings, pauseReasons, onSaved }) {
  const [seconds, setSeconds] = useState(settings?.afterCallSeconds ?? 60);
  const [require, setRequire] = useState(settings?.requireWriteUp ?? true);
  const [limits, setLimits] = useState(settings?.pauseLimits || {});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const storedLimits = JSON.stringify(settings?.pauseLimits || {});
  const dirty = seconds !== (settings?.afterCallSeconds ?? 60) || require !== (settings?.requireWriteUp ?? true) || JSON.stringify(limits) !== storedLimits;
  useEffect(() => {
    // The stored values, when they arrive or change under us — unless the
    // owner is mid-edit, in which case their typing wins until they save.
    if (!dirty) {
      setSeconds(settings?.afterCallSeconds ?? 60);
      setRequire(settings?.requireWriteUp ?? true);
      setLimits(settings?.pauseLimits || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.afterCallSeconds, settings?.requireWriteUp, storedLimits]);
  async function save() {
    setSaving(true);
    setNote("");
    try {
      const pauseLimits = Object.fromEntries(Object.entries(limits).map(([code, m]) => [code, m === "" || m === null ? null : Number(m)]));
      const body = await fetchJson("/api/platform/sales/floor-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afterCallSeconds: Number(seconds), requireWriteUp: Boolean(require), pauseLimits }),
      });
      setNote(`Saved: ${body.settings.afterCallSeconds}s window, outcome ${body.settings.requireWriteUp ? "required" : "not required"}, pause limits updated.`);
      onSaved?.(body.settings);
    } catch (err) {
      setNote(err?.message || "Could not save the floor settings.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className={CARD} data-floor-settings>
      <h2 className="text-base font-semibold text-foreground">Floor settings</h2>
      <p className="text-xs text-muted-foreground break-words">
        After every call a rep is &ldquo;Busy &middot; writing it up&rdquo; for this many seconds: the autodialler
        places nothing and a caller is not rung to them. At zero they are Available on their own; sooner if they
        press Next. With the outcome required, a call with no outcome keeps them in the window until they log
        one or choose &ldquo;write it up later&rdquo;. Off is not a setting: a rep is Off after{" "}
        {settings?.offAfterMinutes ?? 2} minutes without the portal, and Available the moment a tab is open.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground">Write-up window (seconds)</span>
          <input
            type="number"
            min={0}
            max={600}
            step={1}
            value={seconds}
            onChange={(e) => setSeconds(e.target.value === "" ? "" : Number(e.target.value))}
            className="mt-1 w-28 rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
            data-floor-after-call-seconds
          />
        </label>
        <label className="flex items-center gap-2 text-sm min-h-[44px]">
          <input type="checkbox" checked={require} onChange={(e) => setRequire(e.target.checked)} data-floor-require-write-up />
          Outcome required before the window ends
        </label>
      </div>
      <div data-floor-pause-limits>
        <p className="text-xs font-semibold text-foreground">Pause limits</p>
        <p className="text-xs text-muted-foreground break-words">
          Minutes a pause may last before the rep&rsquo;s console and this board say &ldquo;Over by N min&rdquo; in red.
          Blank means no limit. Break, lunch and dinner are recreational time; the rest is productive — the reports
          split paused time that way so a three-hour lunch is visible.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 pt-1">
          {(pauseReasons || []).map((r) => (
            <label key={r.code} className="text-xs">
              <span className="block text-muted-foreground">
                {r.label} <span className="opacity-70">· {r.type}</span>
              </span>
              <input
                type="number"
                min={1}
                max={480}
                step={1}
                value={limits[r.code] ?? ""}
                placeholder="no limit"
                onChange={(e) => setLimits((l) => ({ ...l, [r.code]: e.target.value === "" ? null : Number(e.target.value) }))}
                className="mt-0.5 w-24 rounded-lg border border-border bg-background px-2 py-1.5 tabular-nums"
                data-pause-limit={r.code}
              />
            </label>
          ))}
        </div>
      </div>
      <div>
        <button type="button" className={`${BTN} bg-primary text-primary-foreground`} disabled={saving || !dirty} onClick={save}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null} Save
        </button>
      </div>
      {note ? <p className="text-xs text-muted-foreground break-words">{note}</p> : null}
    </section>
  );
}

export default function SalesFloorPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          {data?.period?.from ? (
            <p className="text-sm text-foreground" data-floor-window>
              {windowSentence(data.period.from)} — the calls figures on every card are the day’s, by
              attempt, the same four buckets as the performance page.
            </p>
          ) : null}
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
            {sortedReps(data.reps).map((rep) => {
              const p = rep.presence;
              const state = p?.state || "offline";
              const Icon = STATE_ICON[state] || CircleHelp;
              const tone = TONE[state] || TONE.offline;
              const s = rep.stats;
              const head = presenceHeadline(p, { labels: { pauseReasons: pauseLabels } });
              const countdown = head.countdownSeconds === null ? null : countdownText(head.countdownSeconds);
              // "for 12m" only where a start is known — a call, a pause. Off
              // carries its time in the word; Available has no counter.
              const forText = p?.forMs != null && (state === "on_call" || state === "paused") ? describeDuration(p.forMs) : null;
              const never = head.key === "app.salesPresence.never";
              const noCalls = !s?.dials;
              return (
                <div key={rep.id} className={`rounded-xl border p-4 space-y-2 ${tone}`} data-floor-rep={rep.id} data-presence-word={head.word}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">
                        {rep.name}
                        {rep.agency ? <span className="text-xs font-normal text-muted-foreground"> · {rep.agency.name}</span> : null}
                      </p>
                      <p className="text-sm flex items-center gap-1.5" data-presence-headline>
                        <Icon size={14} className="shrink-0" />
                        {head.english}
                        {countdown ? <span className="tabular-nums">{countdown}</span> : null}
                        {head.sub ? (
                          <span className={head.sub.alert ? "font-semibold text-red-700 dark:text-red-300" : "opacity-80"} data-pause-over={head.sub.alert ? "true" : undefined}>
                            — {head.sub.english}
                          </span>
                        ) : null}
                        {forText ? ` · ${forText}` : ""}
                        {p?.setByAdmin && state !== "offline" ? <span className="opacity-70 text-xs">· set by a supervisor</span> : null}
                      </p>
                      {/* History under an Off headline: what the ledger row
                          said last. The row itself is untouched; the board
                          just stopped believing it. */}
                      {head.word === WORD_OFF && p?.lastState && p.lastState !== "offline" ? (
                        <p className="text-xs break-words opacity-80">
                          last state: {(stateLabels[p.lastState] || p.lastState).toLowerCase()}
                          {p.lastPauseReason ? ` — ${(pauseLabels[p.lastPauseReason] || p.lastPauseReason).toLowerCase()}` : ""}
                        </p>
                      ) : null}
                      {never ? (
                        <p className="text-xs break-words">
                          There is no record of this account opening the portal.
                        </p>
                      ) : null}
                      {/* "No number assigned" is the case that used to be
                          silent: the dial borrowed the lowest-sorting line,
                          which was another rep's. The line their NEXT dial
                          would present is no longer printed here — it read
                          as "these calls were from this line", and they were
                          not: chooseCallerId dials from the line nearest
                          the prospect. The lines the day's calls actually
                          went out from are under the count, from the
                          attempts themselves. */}
                      {rep.callerNumber && !rep.callerNumber.e164 ? (
                        <p className="text-xs break-words font-medium">
                          No number assigned — their browser dials are refused rather than made from another rep's line.
                        </p>
                      ) : null}
                    </div>
                    {/* Calls today, BY ATTEMPT — the rows that carry this
                        rep's id — with the lines they went out from under
                        it. Never a count of what a line did. */}
                    <div className="text-right shrink-0" data-calls-today>
                      <p className="text-2xl font-semibold tabular-nums leading-none">{s?.dials ?? 0}</p>
                      <p className="text-[11px] opacity-70">Calls today</p>
                      {s?.table?.lines ? (
                        <p className="text-[11px] opacity-70 tabular-nums break-words max-w-[12rem]" data-lines-used>
                          {s.table.lines.count === 0
                            ? s.table.lines.noLine
                              ? `from ${s.table.lines.noLine} handset ${s.table.lines.noLine === 1 ? "dial" : "dials"}, no line`
                              : "no calls yet"
                            : `from ${s.table.lines.count} ${s.table.lines.count === 1 ? "line" : "lines"}: ${s.table.lines.rows.map((l) => `${prettyLine(l.e164)} (${l.calls})`).join(", ")}${
                                s.table.lines.noLine ? ` · ${s.table.lines.noLine} by handset` : ""
                              }`}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* A day with no dials is one line, not nine zero tiles. */}
                  {noCalls ? <p className="text-xs opacity-80" data-no-calls>No calls today</p> : null}

                  {/* The four buckets — the performance page's, from the same
                      object (stats.table), drawn by the same component. */}
                  {!noCalls && s?.table ? <DialBuckets table={s.table} labels={BUCKET_LABELS} compact /> : null}

                  <dl className={`grid grid-cols-2 gap-x-3 gap-y-1 text-xs ${noCalls ? "hidden" : ""}`}>
                    <dt className="opacity-70">Reached (rep's word)</dt>
                    <dd className="text-right tabular-nums">
                      {s?.table ? pct(s.table.reached) : "—"}
                      {s?.table && s.table.dials > 0 && s.table.logged < s.table.dials ? <span className="opacity-70"> · {s.table.dials - s.table.logged} not yet marked</span> : null}
                    </dd>

                    {/* The transcript's OWN verdicts, and how many calls it
                        judged. A count beside a count — never "8 of 9",
                        which was transcript coverage printed as a rate. */}
                    <dt className="opacity-70">Real conversation (transcript)</dt>
                    <dd className="text-right tabular-nums" data-transcript-conversations>
                      {s?.table ? s.table.realConversationFromTranscript : "—"}
                      {s?.table ? <span className="opacity-70"> · {s.table.conversationFromTranscript} transcribed</span> : null}
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

                    <dt className="opacity-70">
                      Time on calls
                      <span className="block text-[11px] opacity-70">line open, including ringing and voicemail</span>
                    </dt>
                    <dd className="text-right tabular-nums">{s?.onCallText || "—"}</dd>

                    {/* The carrier's seconds on the prospect leg, over REAL
                        conversations only, with the count it was measured
                        from. A mean over "answered" averaged in every
                        voicemail greeting. Never printed alone. */}
                    <dt className="opacity-70">
                      Mean talk time
                      <span className="block text-[11px] opacity-70">real conversations only</span>
                    </dt>
                    <dd className="text-right tabular-nums" data-mean-talk>
                      {s?.table?.meanConversationSeconds != null
                        ? `${describeDuration(s.table.meanConversationSeconds * 1000)} (over ${s.table.buckets.realConversation})`
                        : "no real conversation yet"}
                    </dd>

                    <dt className="opacity-70">
                      Paused
                      <span className="block text-[11px] opacity-70">recreational / productive</span>
                    </dt>
                    <dd className="text-right tabular-nums" data-paused-by-type>
                      {s?.pausedText || "—"}
                      {s?.pauses?.byType ? <span className="opacity-70"> · {s.pauses.byType.recreational.text} / {s.pauses.byType.productive.text}</span> : null}
                    </dd>

                    <dt className="opacity-70">Callbacks overdue</dt>
                    <dd className="text-right tabular-nums">{s?.callbacks?.overdue?.length ?? 0}</dd>
                  </dl>

                  <SupervisorButtons rep={rep} onDone={load} />
                </div>
              );
            })}
          </section>

          {/* ── The floor's tunables ────────────────────────────────────── */}
          {data.settings ? (
            <FloorSettingsCard
              settings={data.settings}
              pauseReasons={data.pauseReasons}
              onSaved={(settings) => setData((d) => (d ? { ...d, settings: { ...d.settings, ...settings } } : d))}
            />
          ) : null}

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

          {/* ── The day's calls, everyone ───────────────────────────────── */}
          {data.table ? (
            <section className={CARD} data-floor-table>
              <h2 className="text-base font-semibold text-foreground">Did we reach them? The day, everyone</h2>
              <p className="text-xs text-muted-foreground break-words">
                The same four buckets as the performance page, over every call placed on the floor today — one
                denominator, dials that reached the carrier as a call to the prospect&rsquo;s number, joined to
                the rep&rsquo;s attempt by the prospect leg&rsquo;s call id and never by the line it went out on.
                Voicemail sits in &ldquo;Voicemail or brief&rdquo;. &ldquo;Real conversation&rdquo; is the
                transcript&rsquo;s verdict where one exists and a minute on the clock where none does yet. A
                handset dial has no carrier leg and is in no bucket.
              </p>
              <DialBuckets table={data.table} labels={BUCKET_LABELS} />
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Reached (rep&rsquo;s word)</dt>
                <dd className="tabular-nums">
                  {pct(data.table.reached)}
                  {data.table.dials > 0 && data.table.logged < data.table.dials ? <span className="text-xs text-muted-foreground"> · {data.table.dials - data.table.logged} not yet marked</span> : null}
                  <span className="block text-xs text-muted-foreground">source: rep&rsquo;s write-up</span>
                </dd>
                <dt className="text-muted-foreground">Real conversation (transcript)</dt>
                <dd className="tabular-nums">
                  {data.table.realConversationFromTranscript} <span className="text-xs text-muted-foreground">· {data.table.conversationFromTranscript} transcribed</span>
                  <span className="block text-xs text-muted-foreground">source: transcript</span>
                </dd>
                <dt className="text-muted-foreground">Mean talk time, real conversations</dt>
                <dd className="tabular-nums">
                  {data.table.meanConversationSeconds != null ? `${describeDuration(data.table.meanConversationSeconds * 1000)} (over ${data.table.buckets.realConversation})` : "no real conversation yet"}
                  <span className="block text-xs text-muted-foreground">source: Twilio, the prospect&rsquo;s leg</span>
                </dd>
                <dt className="text-muted-foreground">Unverified</dt>
                <dd className="tabular-nums">
                  {data.table.unverified.total}
                  {data.table.unverified.handset ? <span className="text-xs text-muted-foreground"> · {data.table.unverified.handset} from a handset</span> : null}
                  <span className="block text-xs text-muted-foreground">no carrier leg — in no bucket</span>
                </dd>
              </dl>
              <p className="text-xs text-muted-foreground">
                Twilio&rsquo;s own count of the day&rsquo;s prospect legs is on the performance page&rsquo;s
                reconciliation line; this board polls every fifteen seconds and does not ask the carrier each
                time.
              </p>
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
          {/* Callbacks past their hour by more than a day, by rep
              (lib/sales/calls/callbackAgenda.js). Drawn only when there is
              one — a "0 overdue" line every fifteen seconds is noise. Null
              counts mean the read failed, and say so. */}
          {data.overdueCallbacks && (data.overdueCallbacks.flagged === null || data.overdueCallbacks.flagged > 0) ? (
            <div className={`${CARD} border-red-400 dark:border-red-800`} data-overdue-callbacks={data.overdueCallbacks.flagged ?? "unknown"}>
              <p className="text-sm font-semibold text-foreground">
                {data.overdueCallbacks.flagged === null
                  ? `Overdue callbacks could not be read${data.overdueCallbacks.error ? `: ${data.overdueCallbacks.error}` : "."}`
                  : `${data.overdueCallbacks.flagged} callback${data.overdueCallbacks.flagged === 1 ? "" : "s"} more than ${data.overdueCallbacks.flagAfterHours} h overdue`}
              </p>
              {data.overdueCallbacks.byRep?.length ? (
                <p className="text-sm text-muted-foreground break-words">
                  {data.overdueCallbacks.byRep.map((r) => `${r.name || "unassigned"}: ${r.flagged}`).join(" · ")} —{" "}
                  <Link href="/platform/sales/outcomes" className="underline">the agenda</Link>
                </p>
              ) : null}
            </div>
          ) : null}

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
