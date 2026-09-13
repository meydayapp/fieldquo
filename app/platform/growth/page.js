// app/platform/growth/page.js
//
// FieldQuo's own subscriber forecast — read by the owner, English-only like
// the rest of /platform.
//
// What this page must never do is draw a line through a number it does not
// have. Every rate is shown WITH its basis — measured from the pipeline, or
// assumed by the owner until the floor is met — and the milestones say
// "not reachable at these rates" when the churn ceiling sits below them,
// which is the sentence a straight-line forecast can never produce. The
// arithmetic is lib/platform/growthModel.js; this file only lays it out.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import MetricCard, { count, UNKNOWN } from "@/app/components/platform/MetricCard";
import Sparkline from "@/app/components/platform/Sparkline";

// The rate rows, in the order the funnel runs; the funnel first, then the
// additive sources. Keys match lib/platform/growthModel.js RATE_KEYS and
// COUNT_KEYS — `kind` says which shape the value has.
const RATE_ROWS = [
  // attempts is the plan's ratio (assumed 3 until measured); completion is
  // the self-serve step, ×1 until measured or typed — both say so in the chip.
  { key: "attempts", kind: "ratio", field: "attemptsPerProspect" },
  { key: "reach", kind: "rate" },
  { key: "signup", kind: "rate" },
  { key: "completion", kind: "rate", additive: true, blankWord: "Not applied · counted as 100%" },
  { key: "conversion", kind: "rate" },
  { key: "churn", kind: "rate" },
  { key: "referral", kind: "referral", additive: true },
  { key: "organic", kind: "count", additive: true },
  { key: "refill", kind: "count", additive: true },
  { key: "redial", kind: "rate", additive: true },
  { key: "marketing", kind: "count", additive: true },
  { key: "ads", kind: "count", additive: true, field: "adSpend" },
];
const ADDITIVE_KEYS = RATE_ROWS.filter((r) => r.additive).map((r) => r.key);
const SOURCE_LABELS = { dial: "dial", redial: "re-dial", marketing: "marketing", ads: "ads", referral: "referral", organic: "organic" };
const nf = new Intl.NumberFormat("en-CA");
const pct = (v, digits = 1) => (typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : UNKNOWN);
const measuredOf = (data, key) => (key === "organic" || key === "refill" || key === "marketing" || key === "ads" ? data?.measured?.[key] : data?.measured?.rates?.[key]);
const valueText = (key, kind, r) => {
  const v = r?.value;
  if (kind === "ratio") return v === null || v === undefined ? "1 per prospect" : `${(Math.round(v * 100) / 100).toString()} per prospect`;
  if (key === "completion") return v === null || v === undefined ? "100% (not applied)" : pct(v);
  if (kind === "count") return v === null || v === undefined ? "0/month" : `${nf.format(Math.round(v * 10) / 10)}/month`;
  if (kind === "referral") return v === null || v === undefined ? "0 per paying" : `${v.toFixed(2)} per paying`;
  if (key === "redial") return v === null || v === undefined ? "0%" : pct(v, 2);
  return pct(v);
};

/**
 * The intro's one sentence: which rates are measured, blended, assumed, and
 * which count as 0 — in words, from the data, so the owner reads the state
 * of the forecast before any figure.
 */
function basisSentence(data, fieldsByKey) {
  if (!data) return null;
  const by = { measured: [], blended: [], assumed: [], none: [] };
  for (const row of RATE_ROWS) {
    const r = measuredOf(data, row.key);
    const b = r?.basis || "none";
    (by[b] || by.none).push((fieldsByKey[row.field || row.key]?.label || row.key).toLowerCase());
  }
  const parts = [];
  if (by.measured.length) parts.push(`measured: ${by.measured.join(", ")}`);
  if (by.blended.length) parts.push(`blended with the assumption: ${by.blended.join(", ")}`);
  if (by.assumed.length) parts.push(`assumed: ${by.assumed.join(", ")}`);
  if (by.none.length) parts.push(`counted as 0 until measured or typed (completion as 100%): ${by.none.join(", ")}`);
  return parts.length ? `Right now — ${parts.join("; ")}.` : null;
}

/**
 * Which rate limits the ceiling, in words — from `ceilingBy`, never
 * re-derived here. Three cases, one sentence each.
 */
function ceilingSentence(f) {
  const c = f.ceilingBy;
  const zeros = c.zeroSources.map((k) => SOURCE_LABELS[k] || k);
  const zerosText = zeros.length ? `${zeros.join(", ")} ${zeros.length === 1 ? "is" : "are"} 0` : "every source is above 0";
  if (c.limitedBy === "referral") {
    return `No ceiling — referrals outrun churn (${pct(c.churn)}/month), so the paying stock compounds without a cap; ${zerosText}.`;
  }
  if (c.limitedBy === "list") {
    const peak = c.peak;
    const longRun = c.longRun.paying === null ? "nothing" : nf.format(c.longRun.paying);
    const last = f.series[f.series.length - 1];
    // Where the list ends: a month inside the horizon, or a runway past it.
    const runsOut = f.listExhaustedAt ? `it runs out in ${f.series[f.listExhaustedAt]?.label}` : f.listRunwayMonths !== null ? `it runs out after the horizon (${f.listRunwayMonths} months of fresh dialling)` : "it runs out";
    // A peak on the last month is a curve still rising, not a peak.
    const shape = peak.month === last.month
      ? `the curve is still rising at the horizon (${nf.format(peak.paying)} in ${peak.label}) and settles toward ${longRun} paying once the list is gone`
      : `the curve peaks at ${nf.format(peak.paying)} in ${peak.label} and settles toward ${longRun} paying`;
    return `Ceiling ${nf.format(f.ceiling)} — set by churn ${pct(c.churn)}/month against ${c.addsPerMonth.toFixed(0)} adds/month while the dialling runs at capacity; but the list is the real limit: ${runsOut} and ${zerosText}, so ${shape} (${c.longRun.freshDials > 0 ? `${nf.format(c.longRun.freshDials)} fresh dials` : "no fresh dials"}${c.longRun.redialDials > 0 ? ` and ${nf.format(c.longRun.redialDials)} repeat dials` : ""} a month in the long run).`;
  }
  return `Ceiling ${nf.format(f.ceiling)} — set by churn ${pct(c.churn)}/month against ${c.addsPerMonth.toFixed(0)} adds/month; ${zerosText}.`;
}

function basisChip(r, additive = false, blankWord = null) {
  if (!r) return null;
  const cls =
    r.basis === "measured"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : r.basis === "blended"
        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
        : r.basis === "assumed"
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : additive
            ? "bg-muted text-muted-foreground"
            : "bg-red-500/15 text-red-700 dark:text-red-300";
  const word =
    r.basis === "measured"
      ? "Measured"
      : r.basis === "blended"
        ? `Blended · ${Math.round((r.measuredWeight || 0) * 100)}% measured`
        : r.basis === "assumed"
          ? "Assumed"
          : additive
            ? blankWord || "Not yet · counted as 0"
            : "Missing";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{word}</span>;
}

function soFar(r, field) {
  if (!r) return "";
  const unit = field?.floorOf || "rows";
  const measuredText = r.measured === null ? "nothing measured yet" : field?.kind === "monthlyCount" || field?.kind === "money" ? `${r.measured.toFixed(1)}/month measured` : field?.kind === "ratio" ? `${r.measured.toFixed(2)} per prospect measured` : `${pct(r.measured, field?.key === "redial" ? 2 : 1)} measured`;
  if (r.basis === "measured") return `${measuredText} from ${nf.format(r.sampleSize)} ${unit}${r.assumed !== null && r.assumed !== undefined ? "; the assumption is under a tenth of the answer" : ""}`;
  if (r.basis === "blended") {
    return `${measuredText} from ${nf.format(r.sampleSize)} ${unit}, weighed against the assumption as ${nf.format(r.floor)} ${unit}${r.remaining > 0 ? ` — ${nf.format(r.remaining)} more before the measurement outweighs it` : ""}`;
  }
  return `${measuredText} — every ${unit.replace(/s$/, "")} counted moves the answer toward it`;
}

export default function PlatformGrowthPage() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [errorText, setErrorText] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    setErrorText(null);
    try {
      const d = await fetchJson("/api/platform/growth");
      setData(d);
      setForm(formFrom(d.assumptions));
      setState("ready");
    } catch (err) {
      setErrorText(err.message);
      setState("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const d = await fetchJson("/api/platform/growth", { method: "PUT", body: JSON.stringify(payloadFrom(form)), headers: { "Content-Type": "application/json" } });
      setData(d);
      setForm(formFrom(d.assumptions));
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldsByKey = useMemo(() => Object.fromEntries((data?.fields || []).map((f) => [f.key, f])), [data]);
  const f = data?.forecast;
  const series = f?.series || [];
  const points = series.map((s) => s.paying);

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp size={22} /> Growth
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paying subscribers by month, from what the closers can dial, what the list is fed, what a second pass over it yields, what marketing brings, and what the pipeline measures. Every rate says whether it was measured or assumed.
          </p>
          {data && basisSentence(data, fieldsByKey) && <p className="text-xs text-muted-foreground mt-1">{basisSentence(data, fieldsByKey)}</p>}
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted" disabled={state === "loading"}>
          {state === "loading" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      {state === "error" && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {errorText || "Couldn't load the forecast."}
        </div>
      )}

      {data && data.needs?.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>No forecast yet.</strong> The pipeline has not measured these rates and no assumption is saved, so nothing is drawn:{" "}
            {data.needs.map((k) => fieldsByKey[k]?.label || k).join(", ")}. Type them below — they are replaced by measurements as the floors are met.
          </div>
        </div>
      )}

      {/* ── Now, and the monthly engine ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Paying now" value={data ? count(data.measured.starting.paying) : UNKNOWN} note={data ? `${count(data.measured.starting.trialing)} in trial` : undefined} />
        <MetricCard label="Dials a day, last 30 days" value={data ? count(data.measured.actuals.dialsPerDayLast30) : UNKNOWN} note={data ? `${count(data.measured.repsActive)} active closers; plan assumes ${count(data.assumptions.reps)} × ${count(data.assumptions.dialsPerRepPerDay)}` : undefined} />
        {/* When the forecast is withheld these two are NOT "didn't load" — that
            is MetricCard's sentence for a failed fetch, and it would be a lie
            here: the fetch worked and the model declined. "Waiting" with the
            reason is the true state. UNKNOWN stays for a real load failure. */}
        <MetricCard label="Paying adds a month" value={f ? f.monthly.payingAdds.toFixed(0) : data ? "Waiting" : UNKNOWN} note={f ? `${nf.format(f.monthly.dials)} dials${f.monthly.attempts > 1 ? ` (${nf.format(f.monthly.prospectsWorked)} prospects × ${f.monthly.attempts} attempts)` : ""} → ${nf.format(f.monthly.reached)} reached → ${f.monthly.signups.dial.toFixed(0)} signups${f.monthly.completionApplied ? ` (after ${pct(f.monthly.completion, 0)} complete the card step)` : ""}${f.monthly.signups.marketing > 0 ? ` + ${f.monthly.signups.marketing.toFixed(0)} marketing` : ""}${f.monthly.signups.ads > 0 ? ` + ${f.monthly.signups.ads.toFixed(0)} ads` : ""}${f.monthly.signups.organic > 0 ? ` + ${f.monthly.signups.organic.toFixed(0)} organic` : ""}` : data ? "until the rates below are measured or typed" : undefined} />
        <MetricCard
          label="Ceiling"
          value={f ? (f.viral ? "None" : f.ceiling === null ? "None" : count(f.ceiling)) : data ? "Waiting" : UNKNOWN}
          tone={f && !f.viral && f.ceiling !== null && f.ceiling < 10_000 ? "warning" : "default"}
          note={f ? (f.viral ? "Referrals outrun churn — growth compounds without a cap" : f.ceiling === null ? "No churn assumed, so no cap" : f.ceilingBy.limitedBy === "list" ? `adds ÷ (churn − referral × conversion), but the list runs out first — peak ${nf.format(f.ceilingBy.peak.paying)}` : "Paying subscribers converge here and never pass it: adds ÷ (churn − referral × conversion)") : data ? "needs churn, conversion and referral" : undefined}
        />
      </div>

      {/* ── Milestones ──────────────────────────────────────────────────── */}
      {f && (
        <section className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Milestones</h2>
            <p className="text-xs text-muted-foreground">When each target is crossed at the current rates. Horizon {f.inputs.horizonMonths} months.</p>
            {/* WHICH rate limits the ceiling, said before the list of dates —
                the owner read "ceiling 3,215" under a curve that went down
                and asked what the number meant. */}
            <p className="text-xs text-foreground mt-1">{ceilingSentence(f)}</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {f.milestones.map((m) => (
                <tr key={m.target} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium tabular-nums">{nf.format(m.target)} paying</td>
                  <td className="px-4 py-2">
                    {m.month !== null ? (
                      <>{m.label} <span className="text-muted-foreground">(month {m.month})</span></>
                    ) : m.reachable ? (
                      <span className="text-muted-foreground">Beyond the {f.inputs.horizonMonths}-month horizon, but reachable</span>
                    ) : (
                      <span className="text-red-700 dark:text-red-300">Not reachable at these rates — {f.ceilingBy.limitedBy === "list" ? `the list runs out — ${f.ceilingBy.peak.month === f.series.length - 1 ? "still rising at the horizon to" : "peaking at"} ${nf.format(f.ceilingBy.peak.paying)}, settling toward ${f.ceilingBy.longRun.paying === null ? "nothing" : nf.format(f.ceilingBy.longRun.paying)}` : `the ceiling is ${nf.format(f.ceiling)}`}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {f.inputs.listSize !== null && (
            <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              {nf.format(f.inputs.listSize)} prospects loaded
              {f.monthly.refill > 0 ? `, ${nf.format(Math.round(f.monthly.refill))} added a month (${f.refill?.basis === "assumed" ? "assumed" : f.refill?.basis === "none" ? "counted as 0" : f.refill?.basis})` : ", nothing added a month (refill counts as 0)"}
              {f.listRunwayMonths !== null
                ? `: ${f.listRunwayMonths} months of fresh dialling at this pace${f.listExhaustedAt ? `, running out in ${series[f.listExhaustedAt]?.label}` : ""}. After that the fresh dials fall to the refill rate${f.monthly.redialYield > 0 ? ` and the spare capacity re-dials the pool at ${pct(f.monthly.redialYield, 2)} a dial (a row leaves the pool after at most ${f.ceilingBy.maxAttempts} attempts and is assumed back ${f.ceilingBy.returnMonths} months later)` : "; nobody is rung twice while re-dial is 0"}.`
                : ": refill keeps pace with the dialling, so the fresh list never runs out."}
            </p>
          )}
        </section>
      )}

      {/* ── The curve ───────────────────────────────────────────────────── */}
      {f && (
        <section className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Forecast — paying subscribers by month</h2>
            <span className="text-xs text-muted-foreground">{series[0]?.label} → {series[series.length - 1]?.label}</span>
          </div>
          {/* Said out loud, because the owner read "866 paying" against a
              month that had not arrived and asked what it was. Nothing on
              this card has happened; every figure is the model run forward
              from the rates below, and the flat signup count past the list's
              end is the model refusing to invent dials, not a plateau. */}
          <p className="text-xs text-muted-foreground">
            Projected, not recorded — every month here is the model run forward from the rates below.
          </p>
          <Sparkline points={points} height={96} />
          {/* The legend distinguishes the two ways a curve can flatten or
              fall: the list ran out and nothing replaces it, or a refill is
              assumed and the fresh dials continue. Same shape on the chart,
              opposite meaning for the business. */}
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {f.listExhaustedAt !== null && f.monthly.refill === 0 && (
              <li><span className="inline-block w-2 h-2 rounded-sm bg-red-500/70 mr-1.5 align-middle" />List runs out in {series[f.listExhaustedAt]?.label}: fresh dials stop, no refill{f.monthly.redialYield > 0 ? "; the pool is re-dialled at the repeat yield" : ", no re-dial"} — the fall after the peak is churn with nothing replacing it.</li>
            )}
            {f.listExhaustedAt !== null && f.monthly.refill > 0 && (
              <li><span className="inline-block w-2 h-2 rounded-sm bg-amber-500/70 mr-1.5 align-middle" />Refill {f.refill?.basis === "assumed" ? "assumed" : f.refill?.basis === "none" ? "counted as 0" : f.refill?.basis}: the loaded list runs out in {series[f.listExhaustedAt]?.label}, then {nf.format(Math.round(f.monthly.refill))} fresh prospects a month keep the dialling going{f.monthly.redialYield > 0 ? ", with the spare capacity on the re-dial pool" : ""}.</li>
            )}
            {f.listExhaustedAt === null && f.inputs.listSize !== null && f.listRunwayMonths === null && (
              <li><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/70 mr-1.5 align-middle" />Refill keeps pace with the dialling: the list never runs out.</li>
            )}
            {f.listExhaustedAt === null && f.inputs.listSize !== null && f.listRunwayMonths !== null && (
              <li><span className="inline-block w-2 h-2 rounded-sm bg-amber-500/70 mr-1.5 align-middle" />Refill {f.refill?.basis === "assumed" ? "assumed" : f.refill?.basis === "none" ? "counted as 0" : f.refill?.basis}: {nf.format(Math.round(f.monthly.refill))} added a month stretches the list to {f.listRunwayMonths} months of fresh dialling — past the horizon, so no fall is drawn here; the long run after that is on the milestones card.</li>
            )}
            {f.inputs.listSize === null && (
              <li><span className="inline-block w-2 h-2 rounded-sm bg-muted-foreground/50 mr-1.5 align-middle" />No prospect list is loaded, so the dialling is drawn at capacity every month — an unknown list is not an infinite one.</li>
            )}
            <li><span className="inline-block w-2 h-2 rounded-sm bg-primary/70 mr-1.5 align-middle" />Paying subscribers. Signups by source per month are on the cards below.</li>
          </ul>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {[6, 12, 24, 36, 60].filter((m) => series[m]).map((m) => (
              <div key={m} className="rounded border border-border px-2 py-1.5">
                <div className="text-muted-foreground">{series[m].label} · projected</div>
                <div className="font-semibold tabular-nums">{nf.format(series[m].paying)} paying</div>
                <div className="text-muted-foreground tabular-nums">{nf.format(series[m].cumulativeSignups)} signups by then</div>
                {/* This month's signups, by source, in the owner's own order:
                    dial · re-dial · marketing · referral · organic. A source at
                    0 is printed as 0, not dropped — the zeros are the point. */}
                <div className="text-muted-foreground tabular-nums mt-1">
                  signups this month: {series[m].signups.total.toFixed(0)} — {["dial", "redial", "marketing", "ads", "referral", "organic"].map((k) => `${SOURCE_LABELS[k]} ${(series[m].signups[k] ?? 0).toFixed(0)}`).join(" · ")}
                </div>
                <div className="text-muted-foreground tabular-nums">{nf.format(series[m].signups.freshDials)} fresh dials{series[m].signups.redialDials > 0 ? ` · ${nf.format(series[m].signups.redialDials)} repeat` : ""}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The rates and where they stand ─────────────────────────────── */}
      {data && (
        <section className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">The rates</h2>
            <p className="text-xs text-muted-foreground">Each rate is the measurement blended with the saved assumption: the assumption counts as the floor's worth of rows, the pipeline counts as the rows it has, so the answer starts at the assumption and moves toward the real number with every row. Nothing jumps the day a floor is met. A missing funnel rate with too few rows stops the forecast rather than being guessed; referral, organic, refill, re-dial and marketing are additive and count as 0 until measured or typed.</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {RATE_ROWS.map(({ key: k, kind, additive, field, blankWord }) => {
                const r = measuredOf(data, k);
                const fld = fieldsByKey[field || k];
                return (
                  <tr key={k} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2 w-1/3">
                      {fld?.label || k}
                      {k === "attempts" && f ? <AttemptsNote f={f} /> : null}
                      {k === "reach" && f && f.monthly.attempts > 1 ? <span className="block text-xs text-muted-foreground">per dial {pct(f.monthly.reachPerDial)} · reach per prospect after {f.monthly.attempts} attempts {pct(f.monthly.reachPerProspect)}</span> : null}
                      {k === "redial" && f ? <span className="block text-xs text-muted-foreground">a first dial yields {pct(f.monthly.freshYield, 2)} (reach per prospect ÷ attempts × signup × completion)</span> : null}
                      {k === "marketing" ? <span className="block text-xs text-muted-foreground">counts influencer-code redemptions; paid ads are the row below</span> : null}
                      {k === "ads" ? <span className="block text-xs text-muted-foreground">card trials from paid ads: spend ÷ cost per trial when typed; measured from signups whose link carried a paid utm tag{data.measured.actuals.adsImpliedCostPerTrial ? ` — the typed spend implies $${nf.format(Math.round(data.measured.actuals.adsImpliedCostPerTrial))} per measured trial` : ""}</span> : null}
                      {k === "completion" ? <span className="block text-xs text-muted-foreground">the self-serve step — agreed on the call → card entered; measured {data.measured.actuals.attributedWithCard} of {data.measured.actuals.agreedCount} agreed so far</span> : null}
                    </td>
                    <td className="px-4 py-2 tabular-nums font-medium">{valueText(k, kind, r)}</td>
                    <td className="px-4 py-2">{basisChip(r, Boolean(additive), blankWord)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{soFar(r, fld)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>
      )}

      {/* ── What actually happened, by month ────────────────────────────── */}
      {data && (
        <section className="rounded-lg border border-border bg-card overflow-x-auto">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Actuals</h2>
            <p className="text-xs text-muted-foreground">
              Finished months are what the rates are measured from; the table starts the month FieldQuo's first customer arrived. {data.measured.actuals.currentMonth?.label} is shown so far because that is where the dialling is — it joins the rates when it is over. Demo companies excluded.
            </p>
          </div>
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">Month</th>
                <th className="px-4 py-2 font-medium">Dials</th>
                <th className="px-4 py-2 font-medium">Reached</th>
                <th className="px-4 py-2 font-medium">Signups via rep</th>
                <th className="px-4 py-2 font-medium">By referral</th>
                <th className="px-4 py-2 font-medium">Ads</th>
                <th className="px-4 py-2 font-medium">Marketing</th>
                <th className="px-4 py-2 font-medium">Organic</th>
                <th className="px-4 py-2 font-medium">Prospects added</th>
                <th className="px-4 py-2 font-medium">Paying at start</th>
                <th className="px-4 py-2 font-medium">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {[
                // Months before the first customer are not printed: they are
                // before FieldQuo existed, not zero observations.
                ...data.measured.actuals.byMonth
                  .filter((m) => data.measured.actuals.launchMonth && m.label >= data.measured.actuals.launchMonth)
                  .map((m) =>
                    data.measured.actuals.firstObservedMonth && m.label < data.measured.actuals.firstObservedMonth
                      ? { ...m, note: "first customers arrived · not in the rates" }
                      : m,
                  ),
                ...(data.measured.actuals.currentMonth ? [data.measured.actuals.currentMonth] : []),
              ].map((m) => (
                <tr key={m.label} className={`border-b border-border last:border-0 tabular-nums${m.partial ? " text-muted-foreground" : ""}`}>
                  <td className="px-4 py-1.5">
                    {m.label}
                    {m.partial ? <span className="ml-2 text-xs">so far · day {m.dayOfMonth} · not in the rates</span> : null}
                    {m.note ? <span className="ml-2 text-xs text-muted-foreground">{m.note}</span> : null}
                  </td>
                  <td className="px-4 py-1.5">{nf.format(m.dials)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.reached)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.signups.rep)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.signups.referral)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.signups.ads ?? 0)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.signups.marketing)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.signups.organic)}</td>
                  <td className="px-4 py-1.5">
                    {nf.format(m.prospectsAdded)}
                    {m.label === data.measured.actuals.listLoadMonth ? <span className="ml-1 text-xs text-muted-foreground">list load</span> : null}
                  </td>
                  <td className="px-4 py-1.5">{nf.format(m.payingAtStart)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.churned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Assumptions ─────────────────────────────────────────────────── */}
      {form && (
        <form onSubmit={save} className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Assumptions</h2>
            <p className="text-xs text-muted-foreground">
              The plan, and the rates to use until the pipeline has measured them. Rates are percentages; referral is signups per paying subscriber per month; organic, refill and marketing are counts a month; spend and cost per signup are dollars. Leave a funnel rate blank to say you don't know — the forecast then waits rather than guessing. The additive ones count as 0 when blank; the typical ranges in the hints are words, not saved values.
            </p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(data.fields || []).map((fld) => (
              <label key={fld.key} className="text-sm space-y-1">
                <span className="block text-xs text-muted-foreground">{fld.label}{fld.kind === "rate" && fld.max ? "" : fld.kind === "rate" ? " (%)" : fld.kind === "money" ? " ($)" : ""}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={fld.kind === "count" ? 1 : "any"}
                  min={fld.kind === "ratio" ? 1 : 0}
                  max={fld.kind === "count" ? 100000 : fld.kind === "rate" && !fld.max ? 100 : fld.kind === "ratio" ? 20 : undefined}
                  value={form[fld.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [fld.key]: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 tabular-nums"
                  required={fld.kind === "count"}
                />
                {/* The typical range, in words. Never a value in the box. */}
                {fld.hint ? <span className="block text-xs text-muted-foreground">{fld.hint}</span> : null}
                {/* A blank FUNNEL rate withholds the whole forecast; a blank
                    additive one counts as 0. When the pipeline has already
                    seen something, offer that number as the starting
                    assumption — the owner can type over it. */}
                {(() => {
                  if (fld.kind === "count" || fld.kind === "money" || (form[fld.key] ?? "") !== "") return null;
                  const r = measuredOf(data, fld.key === "attemptsPerProspect" ? "attempts" : fld.key);
                  if (!r || r.measured === null || r.measured === undefined || !Number.isFinite(r.measured)) return null;
                  const asForm = fld.kind === "rate" && !fld.max ? String(Math.round(r.measured * 1000) / 10) : String(Math.round(r.measured * 100) / 100);
                  const shown = fld.kind === "rate" && !fld.max ? `${asForm}%` : fld.kind === "monthlyCount" ? `${asForm}/month` : asForm;
                  const blankMeans = fld.key === "completion" ? "Blank is not applied (100%)." : fld.key === "attemptsPerProspect" ? `Blank assumes ${data.fields.find((x) => x.key === "attemptsPerProspect")?.default ?? 3}.` : ADDITIVE_KEYS.includes(fld.key) ? "Blank counts as 0." : "Blank withholds the forecast.";
                  return (
                    <button type="button" onClick={() => setForm({ ...form, [fld.key]: asForm })} className="text-xs text-primary underline underline-offset-2">
                      {blankMeans} Measured so far: {shown} — use it
                    </button>
                  );
                })()}
              </label>
            ))}
          </div>
          <div className="px-4 pb-4 flex items-center gap-3">
            <button type="submit" disabled={saving} className="min-h-[44px] lg:min-h-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {saving ? "Saving…" : "Save assumptions"}
            </button>
            {saveError && <span className="text-sm text-red-700 dark:text-red-300">{saveError}</span>}
            {!data.assumptions.saved && <span className="text-xs text-muted-foreground">Nothing saved yet — the counts shown are defaults.</span>}
          </div>
        </form>
      )}

      <section className="text-xs text-muted-foreground space-y-1">
        <p><strong>How this works.</strong> Dials × reach × signup gives signups from the closers, drawn on the loaded list plus the refill each month; when the fresh list runs out, the spare capacity re-dials prospects that did not sign up — a row leaves the pool after its retry rule's attempts (at most {data?.forecast?.ceilingBy?.maxAttempts ?? 6}) and is assumed recycled {data?.forecast?.ceilingBy?.returnMonths ?? 3} months later — at the repeat yield; organic and marketing add flat monthly counts; referral adds a share of every paying subscriber each month. Signups pay after a one-month trial at the conversion rate, and the paying stock loses the churn rate each month. Months are calendar months, UTC.</p>
        <p><strong>Attempts, the card step and ads.</strong> Each prospect is rung up to the attempts figure, so reach is per prospect (1 − (1 − reach)^attempts) and a month works dials ÷ attempts businesses; the list depletes that many times slower. Of the conversations that agree, the completion share enter a card on the self-serve signup — the rep does not take one — and only those become trials; blank means the step is not applied. Ads add spend ÷ cost per trial card trials a month, converted at the trial rate like every other trial.</p>
        <p><strong>Not tracked.</strong> Seasonality, price changes, rep ramp-up time, the recycle actually happening on the assumed cadence, ad signups whose link carried no utm tag (unknown, not organic), and the cost of any of it — this is a subscriber count, not a P&amp;L.</p>
      </section>
    </div>
  );
}

/** Form values are strings; rates are edited as percentages (except referral and organic). */
function formFrom(a) {
  const pctOf = (v) => (v === null || v === undefined ? "" : String(Math.round(v * 10000) / 100));
  return {
    reps: String(a.reps ?? ""),
    dialsPerRepPerDay: String(a.dialsPerRepPerDay ?? ""),
    workingDaysPerMonth: String(a.workingDaysPerMonth ?? ""),
    reach: pctOf(a.reach),
    signup: pctOf(a.signup),
    conversion: pctOf(a.conversion),
    churn: pctOf(a.churn),
    referral: a.referral === null || a.referral === undefined ? "" : String(a.referral),
    organic: a.organic === null || a.organic === undefined ? "" : String(a.organic),
    refill: a.refill === null || a.refill === undefined ? "" : String(a.refill),
    redial: pctOf(a.redial),
    marketing: a.marketing === null || a.marketing === undefined ? "" : String(a.marketing),
    marketingSpend: a.marketingSpend === null || a.marketingSpend === undefined ? "" : String(a.marketingSpend),
    marketingCostPerSignup: a.marketingCostPerSignup === null || a.marketingCostPerSignup === undefined ? "" : String(a.marketingCostPerSignup),
    attemptsPerProspect: a.attemptsPerProspect === null || a.attemptsPerProspect === undefined ? "" : String(a.attemptsPerProspect),
    completion: pctOf(a.completion),
    adSpend: a.adSpend === null || a.adSpend === undefined ? "" : String(a.adSpend),
    costPerTrial: a.costPerTrial === null || a.costPerTrial === undefined ? "" : String(a.costPerTrial),
  };
}

function payloadFrom(form) {
  const int = (s) => (s === "" ? null : Math.round(Number(s)));
  const rateOf = (s) => (s === "" ? null : Number(s) / 100);
  const num = (s) => (s === "" ? null : Number(s));
  return {
    reps: int(form.reps),
    dialsPerRepPerDay: int(form.dialsPerRepPerDay),
    workingDaysPerMonth: int(form.workingDaysPerMonth),
    reach: rateOf(form.reach),
    signup: rateOf(form.signup),
    conversion: rateOf(form.conversion),
    churn: rateOf(form.churn),
    referral: num(form.referral),
    organic: num(form.organic),
    refill: num(form.refill),
    redial: rateOf(form.redial),
    marketing: num(form.marketing),
    marketingSpend: num(form.marketingSpend),
    marketingCostPerSignup: num(form.marketingCostPerSignup),
    attemptsPerProspect: num(form.attemptsPerProspect),
    completion: rateOf(form.completion),
    adSpend: num(form.adSpend),
    costPerTrial: num(form.costPerTrial),
  };
}

/**
 * Which won — the reach or the runway. From `attemptsComparison`, never
 * re-derived here: the model ran the same plan at one attempt and this only
 * puts the two side by side in a sentence.
 */
function AttemptsNote({ f }) {
  const c = f.attemptsComparison;
  if (!c) return <span className="block text-xs text-muted-foreground">one dial per prospect — reach per prospect is reach per dial</span>;
  const w = c.withAttempts;
  const o = c.oneAttempt;
  const runway = (x) => (x.listRunwayMonths === null ? "never runs out" : `${x.listRunwayMonths} months of list`);
  const verdict =
    c.wins === "reach"
      ? "the reach wins: more signups over the horizon"
      : c.wins === "runway"
        ? "the runway wins on nothing but time: fewer signups over the horizon"
        : "it is a wash over the horizon";
  return (
    <span className="block text-xs text-muted-foreground">
      per dial {pct(o.reachPerProspect)} → per prospect after {w.attempts} attempts {pct(w.reachPerProspect)}. A month works {nf.format(w.prospectsWorked)} prospects instead of {nf.format(o.prospectsWorked)}:
      signups {o.signupsPerMonth.toFixed(0)} → {w.signupsPerMonth.toFixed(0)} a month, {runway(o)} → {runway(w)}, {nf.format(o.cumulativeSignups)} → {nf.format(w.cumulativeSignups)} signups by the horizon — {verdict}.
    </span>
  );
}
