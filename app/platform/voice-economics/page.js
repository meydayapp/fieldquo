// app/platform/voice-economics/page.js
//
// Is the voice product making money, and is it about to stop answering phones.
//
// ── Why this page did not exist ────────────────────────────────────────────
//
// The endpoint behind it did. GET /api/platform/voice-economics computed the
// per-minute margin from Retell's own per-call figure, the number-rental
// spread, the concurrency bill nobody is charged for, and the break-even
// minutes on a slot — and no screen in the console called it. It turned up in
// a sweep for routes with no caller (scripts/check-route-callers.mjs), the
// same sweep that found the visit-status hole.
//
// ── The two questions are not the same question ────────────────────────────
//
// Margin is the one you'd expect. Concurrency is the one that matters more:
// it is a WORKSPACE limit shared by every contractor, with no per-agent cap.
// When the pool fills, an inbound call waits about forty seconds and fails,
// and the homeowner experiences that as a contractor who doesn't answer their
// phone. So it gets its own panel with its own headline, above the money,
// rather than being a line item inside a cost breakdown.
//
// ── Nothing here pads an absence ───────────────────────────────────────────
//
// The endpoint returns null for a margin it cannot compute and null for a
// concurrency limit the provider would not report, and flags `incomplete` when
// a figure is knowably short. All three are rendered as what they are. A
// margin that reads 100% because Retell has not priced this week's calls yet
// is the specific wrong answer this whole file exists to avoid.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, PhoneCall, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const RANGES = [7, 30, 90];

const money = (cents) =>
  cents === null || cents === undefined
    ? "—"
    : `$${(Number(cents) / 100).toLocaleString("en-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

function Stat({ label, value, hint, tone = "" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${tone || "text-foreground"}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function VoiceEconomicsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [errorText, setErrorText] = useState(null);

  // ── The bug behind "Couldn't read the voice numbers just now" ────────────
  //
  // This read `const res = await fetchJson(...); if (!res.ok) { ... }`.
  // fetchJson RETURNS THE PARSED BODY and THROWS on failure — it has no `.ok`
  // (see lib/fetchJson.js, and every other caller in this codebase). So `res.ok`
  // was undefined on a perfectly successful response, the error branch ran
  // every single time, `res.error` was undefined too, and the fallback string
  // was the only thing this page could ever display. The message was not vague
  // about a real failure; it was unconditional, and there was never a failure.
  //
  // Which is why naming the cause is not a copy exercise: the reason the old
  // sentence could not say why is that there was no why to say.
  const load = useCallback(async () => {
    setState("loading");
    setErrorText(null);
    try {
      setData(await fetchJson(`/api/platform/voice-economics?days=${days}`));
      setState("ready");
    } catch (err) {
      // fetchJson already turns a status into a sentence, and the route sends
      // its own named diagnosis in `error` for the ones it can explain better.
      setErrorText(err.message);
      setState("error");
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const c = data?.concurrency || null;
  // Null limit is "we could not ask", never "no limit". Rendered as the former.
  const slotsFree =
    c && c.limit !== null && c.inUse !== null ? c.limit - c.inUse : null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PhoneCall size={22} /> Voice economics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What the voice product earns, what it costs us, and how close the
            shared call pool is to full.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${
                d === days
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {d} days
            </button>
          ))}
          <button
            type="button"
            onClick={load}
            disabled={state === "loading"}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
          >
            {state === "loading" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            Refresh
          </button>
        </div>
      </div>

      {state === "error" && (
        <p className="text-sm text-red-700 dark:text-red-400">{errorText}</p>
      )}

      {state === "loading" && !data && (
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-accent rounded-xl" />
          <div className="h-32 bg-accent rounded-xl" />
        </div>
      )}

      {data && (
        <>
          {/* Concurrency first, and deliberately above the money. A full pool is
              not a margin problem — it is the product failing to answer the
              phone, and it is invisible until somebody looks at this number. */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground">The shared call pool</h2>
            {!c ? (
              <p className="text-sm text-muted-foreground mt-2">
                {/* The reason, which the route now keeps rather than catching
                    to null. "The provider didn't report a limit" covered an
                    unset key, a refused key, a rate limit and a timeout with
                    one sentence and four different remedies. */}
                {data.concurrencyProblem?.message ||
                  "Retell answered without a concurrency limit in it."}{" "}
                So this is unknown — not zero — and the margin below is missing
                whatever the paid slots cost.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mt-1">
                  One workspace limit shared by every contractor, with no
                  per-agent cap. When it fills, an inbound call waits about
                  forty seconds and then fails — which the caller experiences as
                  a contractor who doesn&rsquo;t answer.
                </p>
                <div className="grid gap-3 sm:grid-cols-3 mt-4">
                  <Stat label="On calls now" value={c.inUse ?? "—"} />
                  <Stat label="Limit" value={c.limit ?? "—"} />
                  <Stat
                    label="Free"
                    value={slotsFree === null ? "—" : slotsFree}
                    tone={
                      slotsFree !== null && slotsFree <= 1
                        ? "text-red-700 dark:text-red-400"
                        : ""
                    }
                    hint={c.burstEnabled ? "Burst is on" : "Burst is off"}
                  />
                </div>
              </>
            )}
            {data.fixed?.paidSlots !== null && data.fixed?.paidSlots > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {data.fixed.paidSlots} slot
                {data.fixed.paidSlots === 1 ? "" : "s"} beyond the included
                allowance, costing {money(data.fixed.concurrencyCents)} a month.
                Nobody is charged for these per call
                {data.slotBreakEvenMinutes !== null && (
                  <>
                    {" "}
                    — one slot pays for itself at {data.slotBreakEvenMinutes}{" "}
                    minutes of talk time
                  </>
                )}
                .
              </p>
            )}
          </div>

          {data.incomplete && (
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                These figures are knowably short, so the margin reads HIGH.
                {data.calls.uncosted > 0 && (
                  <>
                    {" "}
                    {data.calls.uncosted} call
                    {data.calls.uncosted === 1 ? " has" : "s have"} no price from
                    Retell yet, and{" "}
                    {data.calls.uncosted === 1 ? "it is" : "they are"} counted in
                    the revenue but not in the cost.
                  </>
                )}
                {data.fixed?.concurrencyLimit === null &&
                  " The concurrency bill is missing entirely."}
              </span>
            </p>
          )}

          {/* Empty is an answer, and it is not the same answer as a failed
              read. A column of zeros with nothing said about it is the shape
              that has been misread as breakage on this codebase before — see
              scripts/check-empty-vs-error.mjs. */}
          {data.emptyNote && (
            <p className="text-sm text-muted-foreground">
              {data.emptyNote.message} The zeros below are a fact, not a failure —
              and number rentals still cost what they cost.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={`Revenue · ${data.days} days`} value={money(data.revenueCents)} />
            <Stat label="Our cost" value={money(data.costCents)} />
            <Stat
              label="Margin"
              value={money(data.marginCents)}
              tone={data.marginCents < 0 ? "text-red-700 dark:text-red-400" : ""}
            />
            <Stat
              label="Margin %"
              value={data.marginPct === null ? "—" : `${data.marginPct}%`}
              hint={data.marginPct === null ? "No revenue in this window" : undefined}
            />
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-3">
              Where it comes from
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-semibold">Line</th>
                    <th className="py-2 pr-4 font-semibold text-right">Charged</th>
                    <th className="py-2 pr-4 font-semibold text-right">Cost us</th>
                    <th className="py-2 font-semibold text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  <tr>
                    <td className="py-2 pr-4">
                      Calls
                      <span className="text-muted-foreground">
                        {" "}
                        · {data.calls.count} call
                        {data.calls.count === 1 ? "" : "s"}, {data.minutes} min
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">{money(data.calls.revenueCents)}</td>
                    <td className="py-2 pr-4 text-right">{money(data.calls.costCents)}</td>
                    <td className="py-2 text-right">
                      {money(data.calls.revenueCents - data.calls.costCents)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">
                      Number rentals
                      <span className="text-muted-foreground">
                        {" "}
                        · {data.numbers.count} active, per month
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">{money(data.numbers.revenueCents)}</td>
                    <td className="py-2 pr-4 text-right">{money(data.numbers.costCents)}</td>
                    <td className="py-2 text-right">
                      {money(data.numbers.revenueCents - data.numbers.costCents)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">
                      Concurrency slots
                      <span className="text-muted-foreground"> · charged to nobody</span>
                    </td>
                    <td className="py-2 pr-4 text-right">—</td>
                    <td className="py-2 pr-4 text-right">
                      {money(data.fixed?.concurrencyCents)}
                    </td>
                    <td className="py-2 text-right">
                      {data.fixed?.concurrencyCents === null
                        ? "—"
                        : money(-data.fixed.concurrencyCents)}
                    </td>
                  </tr>
                  {data.fixed?.knowledgeBaseCents > 0 && (
                    <tr>
                      <td className="py-2 pr-4">
                        Knowledge bases
                        <span className="text-muted-foreground">
                          {" "}
                          · {data.fixed.knowledgeBases} held
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">—</td>
                      <td className="py-2 pr-4 text-right">
                        {money(data.fixed.knowledgeBaseCents)}
                      </td>
                      <td className="py-2 text-right">
                        {money(-data.fixed.knowledgeBaseCents)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Charged at {data.chargedCentsPerMinute}&cent; a minute.
              {data.marginCentsPerMinute !== null && (
                <>
                  {" "}
                  Margin on talk time works out at {data.marginCentsPerMinute}
                  &cent; a minute.
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
