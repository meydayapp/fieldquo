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
// ══ Read-only, and it says so ═════════════════════════════════════════════
//
// There is no control here that reaches into a rep's day: no forced logout, no
// forced pause, no listening in, no reassigning a claim to a named person.
// Every one of those is a thing contact-centre software does, every one is a
// separate product decision, and none of them has been taken. What is here is
// what the platform console is for — it views everything and edits nothing.

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
import { fetchJson } from "@/lib/fetchJson";
import { describeDuration } from "@/lib/sales/calls/agentState";

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
            declared — nothing here is observed from a phone line.
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
              return (
                <div key={rep.id} className={`rounded-xl border p-4 space-y-2 ${tone}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{rep.name}</p>
                      <p className="text-sm flex items-center gap-1.5">
                        <Icon size={14} className="shrink-0" />
                        {p?.everSeen === false
                          ? "Has never signed in"
                          : `${stateLabels[state] || state}${
                              p?.pauseReason ? ` — ${pauseLabels[p.pauseReason] || p.pauseReason}` : ""
                            }`}
                        {p?.forMs != null && p.everSeen ? ` · ${describeDuration(p.forMs)}` : ""}
                      </p>
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

                    <dt className="opacity-70">Callbacks overdue</dt>
                    <dd className="text-right tabular-nums">{s?.callbacks?.overdue?.length ?? 0}</dd>
                  </dl>
                </div>
              );
            })}
          </section>

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
              <h2 className="text-base font-semibold text-foreground">
                If a contractor rings the number back
              </h2>
              {/* Two paragraphs, never merged. The first is FieldQuo's own
                  advertised line, answered by the Retell agent; the second is
                  the pool of local numbers reps dial from, answered by
                  /api/rep-dial/inbound. They can be in different states and
                  usually are. */}
              {data.inbound ? (
                <p className="text-sm text-muted-foreground break-words">{data.inbound.text}</p>
              ) : null}
              {data.salesVoice ? (
                <p className="text-sm text-muted-foreground break-words">{data.salesVoice.text}</p>
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
                        <th className="py-1 font-medium">Outcome</th>
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
                          <td className="py-1.5 break-words text-muted-foreground">
                            {c.disposition || c.providerStatus || "not logged yet"}
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
