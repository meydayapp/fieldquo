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

const RATE_KEYS = ["reach", "signup", "conversion", "churn", "referral"];
const nf = new Intl.NumberFormat("en-CA");
const pct = (v, digits = 1) => (typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : UNKNOWN);

function basisChip(r) {
  if (!r) return null;
  const cls =
    r.basis === "measured"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : r.basis === "assumed"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-red-500/15 text-red-700 dark:text-red-300";
  const word = r.basis === "measured" ? "Measured" : r.basis === "assumed" ? "Assumed" : "Missing";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{word}</span>;
}

function soFar(r, field) {
  if (!r) return "";
  const unit = field?.floorOf || "rows";
  if (r.basis === "measured") return `from ${nf.format(r.sampleSize)} ${unit}`;
  const measuredText = r.measured === null ? "nothing measured yet" : field?.kind === "monthlyCount" ? `${r.measured.toFixed(1)}/month so far` : `${pct(r.measured)} so far`;
  return `${measuredText} — ${nf.format(r.remaining)} more ${unit} before the measurement takes over`;
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
            Paying subscribers by month, from what the closers can dial and what the pipeline measures. Every rate says whether it was measured or assumed.
          </p>
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
        <MetricCard label="Paying adds a month" value={f ? f.monthly.payingAdds.toFixed(0) : UNKNOWN} note={f ? `${nf.format(f.monthly.dials)} dials → ${nf.format(f.monthly.reached)} reached → ${f.monthly.signups.total.toFixed(0)} signups` : "needs the rates"} />
        <MetricCard
          label="Ceiling"
          value={f ? (f.viral ? "None" : f.ceiling === null ? "None" : count(f.ceiling)) : UNKNOWN}
          tone={f && !f.viral && f.ceiling !== null && f.ceiling < 10_000 ? "warning" : "default"}
          note={f ? (f.viral ? "Referrals outrun churn — growth compounds without a cap" : f.ceiling === null ? "No churn assumed, so no cap" : "Paying subscribers converge here and never pass it: adds ÷ (churn − referral × conversion)") : undefined}
        />
      </div>

      {/* ── Milestones ──────────────────────────────────────────────────── */}
      {f && (
        <section className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Milestones</h2>
            <p className="text-xs text-muted-foreground">When each target is crossed at the current rates. Horizon {f.inputs.horizonMonths} months.</p>
          </div>
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
                      <span className="text-red-700 dark:text-red-300">Not reachable at these rates — the ceiling is {nf.format(f.ceiling)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {f.listRunwayMonths !== null && (
            <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              {nf.format(f.inputs.listSize)} prospects loaded: {f.listRunwayMonths} months of dialling at this pace{f.listExhaustedAt ? `, running out in ${series[f.listExhaustedAt]?.label}` : ""}. After that the model stops inventing dials, so the curve turns down unless more prospects are loaded.
            </p>
          )}
        </section>
      )}

      {/* ── The curve ───────────────────────────────────────────────────── */}
      {f && (
        <section className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Paying subscribers, by month</h2>
            <span className="text-xs text-muted-foreground">{series[0]?.label} → {series[series.length - 1]?.label}</span>
          </div>
          <Sparkline points={points} height={96} />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {[6, 12, 24, 36, 60].filter((m) => series[m]).map((m) => (
              <div key={m} className="rounded border border-border px-2 py-1.5">
                <div className="text-muted-foreground">{series[m].label}</div>
                <div className="font-semibold tabular-nums">{nf.format(series[m].paying)} paying</div>
                <div className="text-muted-foreground tabular-nums">{nf.format(series[m].cumulativeSignups)} signups so far · {nf.format(series[m].signupsBySource.referral)} by referral</div>
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
            <p className="text-xs text-muted-foreground">Measured from the pipeline once the floor is met; the saved assumption until then. A missing one stops the forecast rather than being guessed.</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {[...RATE_KEYS.map((k) => [k, data.measured.rates[k]]), ["organic", data.measured.organic]].map(([k, r]) => (
                <tr key={k} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-2 w-1/3">{fieldsByKey[k]?.label || k}</td>
                  <td className="px-4 py-2 tabular-nums font-medium">
                    {k === "organic" ? (r?.value === null || r?.value === undefined ? UNKNOWN : `${r.value.toFixed(1)}/month`) : k === "referral" ? (r?.value === null || r?.value === undefined ? UNKNOWN : `${r.value.toFixed(2)} per paying`) : pct(r?.value)}
                  </td>
                  <td className="px-4 py-2">{basisChip(r)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{soFar(r, fieldsByKey[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── What actually happened, by month ────────────────────────────── */}
      {data && (
        <section className="rounded-lg border border-border bg-card overflow-x-auto">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Actuals, last six full months</h2>
            <p className="text-xs text-muted-foreground">The rows the rates are measured from. Demo companies excluded. The current month is not shown because it is not over.</p>
          </div>
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">Month</th>
                <th className="px-4 py-2 font-medium">Dials</th>
                <th className="px-4 py-2 font-medium">Reached</th>
                <th className="px-4 py-2 font-medium">Signups via rep</th>
                <th className="px-4 py-2 font-medium">By referral</th>
                <th className="px-4 py-2 font-medium">Organic</th>
                <th className="px-4 py-2 font-medium">Paying at start</th>
                <th className="px-4 py-2 font-medium">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {data.measured.actuals.byMonth.map((m) => (
                <tr key={m.label} className="border-b border-border last:border-0 tabular-nums">
                  <td className="px-4 py-1.5">{m.label}</td>
                  <td className="px-4 py-1.5">{nf.format(m.dials)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.reached)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.signups.rep)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.signups.referral)}</td>
                  <td className="px-4 py-1.5">{nf.format(m.signups.organic)}</td>
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
              The plan, and the rates to use until the pipeline has measured them. Rates are percentages; referral is signups per paying subscriber per month; organic is signups a month. Leave a rate blank to say you don't know — the forecast then waits rather than guessing.
            </p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(data.fields || []).map((fld) => (
              <label key={fld.key} className="text-sm space-y-1">
                <span className="block text-xs text-muted-foreground">{fld.label}{fld.kind === "rate" && fld.max ? "" : fld.kind === "rate" ? " (%)" : ""}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={fld.kind === "count" ? 1 : "any"}
                  min={0}
                  max={fld.kind === "count" ? 100000 : fld.kind === "rate" && !fld.max ? 100 : undefined}
                  value={form[fld.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [fld.key]: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 tabular-nums"
                  required={fld.kind === "count"}
                />
              </label>
            ))}
          </div>
          <div className="px-4 pb-4 flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {saving ? "Saving…" : "Save assumptions"}
            </button>
            {saveError && <span className="text-sm text-red-700 dark:text-red-300">{saveError}</span>}
            {!data.assumptions.saved && <span className="text-xs text-muted-foreground">Nothing saved yet — the counts shown are defaults.</span>}
          </div>
        </form>
      )}

      <section className="text-xs text-muted-foreground space-y-1">
        <p><strong>How this works.</strong> Dials × reach × signup gives signups from the closers; organic adds a flat monthly count; referral adds a share of every paying subscriber each month. Signups pay after a one-month trial at the conversion rate, and the paying stock loses the churn rate each month. Months are calendar months, UTC.</p>
        <p><strong>Not tracked.</strong> Seasonality, price changes, rep ramp-up time and the cost of any of it — this is a subscriber count, not a P&amp;L.</p>
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
  };
}
