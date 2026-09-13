// app/platform/sales/funnel/page.js
//
// Per-rep funnel by month: dials → answered → owner reached → real
// conversation → agreed on the call → signup completed with card →
// activated → first payment → retained at 60 days. English-only like the
// rest of /platform; superadmin and platform admin.
//
// The arithmetic, the bands and the benchmark rule are
// lib/sales/funnelStages.js; the rows are lib/sales/funnelData.js; the
// drawing is app/components/sales/FunnelView.js, shared with the rep's own
// card so the two cannot disagree. This file lays it out: a month switcher,
// a rep switcher, the CSV export, and one funnel per rep.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import FunnelView from "@/app/components/sales/FunnelView";

const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";

const UNITS = { attempts: "call attempts", businesses: "businesses", companies: "companies" };

/** English, resolved once. The card on /sales builds the same object from t(). */
const COPY = {
  stage: "Stage",
  count: "This month",
  conversionFrom: "Of the stage before",
  reference: "Reference",
  noRate: "nothing to divide yet",
  stageLabel: (s) => s.label,
  unit: (u) => UNITS[u] || u,
  benchmarkUntil: (n, dials) =>
    `References are the published B2B cold-calling benchmark until this rep has ${n} dials in the month (${dials} so far); from there they are FieldQuo's own measured figure with the sample printed.`,
  abandoned: (n) => `${n} ${n === 1 ? "signup was" : "signups were"} started on this rep's link this month and never reached the card step — counted nowhere above.`,
  bands: { minimum: "minimum", target: "target", strong: "strong" },
  rampNote: (f) => `ramp ×${f} applied`,
  quotaSignups: "Card trials this month",
  quotaAgreed: "Agreed on the call this month",
};

function rampSentence(f) {
  const r = f.ramp;
  if (!r) return "";
  if (r.tenureMonth === null) return "No start date on the rep — bands shown at full (ramped).";
  if (r.ramped) return `Month ${r.tenureMonth} since they started — ramped, bands at full.`;
  return `Month ${r.tenureMonth} since they started — ramp ×${r.factor}: bands are ${Math.round(r.factor * 100)}% of the ramped figure (Bridge Group's 3-month SDR ramp).`;
}

export default function PlatformSalesFunnelPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [repId, setRepId] = useState("");

  const load = useCallback(async (m, r) => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (m) q.set("month", m);
      if (r) q.set("rep", r);
      const d = await fetchJson(`/api/platform/sales/funnel${q.toString() ? `?${q}` : ""}`);
      setData(d);
      if (!m) setMonth(d.monthKey);
    } catch (err) {
      setError(err.message || "Couldn't load the funnel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month, repId);
  }, [load, month, repId]);

  const csvHref = `/api/platform/sales/funnel?format=csv${month ? `&month=${encodeURIComponent(month)}` : ""}${repId ? `&rep=${encodeURIComponent(repId)}` : ""}`;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Sales funnel</h1>
        <p className="text-sm text-muted-foreground">
          One funnel per rep per month, from what the pipeline already records: call attempts and their outcomes, signup-link texts,
          attributions, subscriptions. The rep&apos;s controllable output ends at &ldquo;agreed on the call&rdquo; — the company enters
          its own card on the self-serve signup — so that stage and &ldquo;signup completed with card&rdquo; are shown apart. Read-only.
        </p>
        <p className="text-xs text-muted-foreground">
          Bands per ramped rep: card trials {data?.bands?.signupCompleted?.minimum ?? 10} minimum / {data?.bands?.signupCompleted?.target ?? 15} target /{" "}
          {data?.bands?.signupCompleted?.strong ?? 20} strong; agreed on the call {data?.bands?.agreed?.minimum ?? 12} / {data?.bands?.agreed?.target ?? 18} /{" "}
          {data?.bands?.agreed?.strong ?? 24}. Ramp ×{(data?.rampFactors || [0.5, 0.75, 1]).join(", ×")} by month since the rep started. Months are UTC.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label htmlFor="month" className="block text-sm font-medium text-foreground mb-1">Month</label>
          <select id="month" value={month} onChange={(e) => setMonth(e.target.value)} className={FIELD} disabled={!data}>
            {(data?.months || (month ? [month] : [])).map((m) => (
              <option key={m} value={m}>{m}{m === data?.currentMonth ? " (this month, so far)" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rep" className="block text-sm font-medium text-foreground mb-1">Rep</label>
          <select id="rep" value={repId} onChange={(e) => setRepId(e.target.value)} className={FIELD} disabled={!data}>
            <option value="">Every rep</option>
            {(data?.reps || []).map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.active ? "" : " (left)"}</option>
            ))}
          </select>
        </div>
        <a href={csvHref} className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold border border-border text-foreground hover:bg-muted">
          <Download size={16} /> Export CSV
        </a>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </div>
      ) : null}

      {data && !loading && data.funnels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reps to show.</p>
      ) : null}

      {data && !loading
        ? data.funnels.map((f) => (
            <section key={f.rep.id} className={CARD}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {f.rep.name} {f.rep.code ? <span className="text-xs font-normal text-muted-foreground">· {f.rep.code}</span> : null}
                  {!f.rep.active ? <span className="ml-2 text-xs font-normal text-muted-foreground">left</span> : null}
                </h2>
                <span className="text-xs text-muted-foreground">{f.monthKey}{f.monthKey === data.currentMonth ? " · so far" : ""}</span>
              </div>
              <p className="text-xs text-muted-foreground">{rampSentence(f)}</p>
              <FunnelView funnel={f} copy={COPY} />
            </section>
          ))
        : null}

      <section className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Where each stage comes from.</strong> Dials are outbound call attempts (a press of the button, not a connection). Answered is any outcome whose
          reached flag is set; owner reached leaves out &ldquo;someone answered, but not the owner&rdquo;; a real conversation is a callback, interested, agreed or
          not interested. Agreed is distinct businesses with the &ldquo;agreed — link sent&rdquo; outcome or a signup-link text from the rep. Signup completed is an
          attribution whose company holds a Subscription row (the checkout finished with a card); activated is Stripe charges enabled; first payment is the
          subscription&apos;s billing start; retained is the same predicate the retention commission uses, evaluated today.
        </p>
        <p>
          <strong>References.</strong> Belkins (175k dials: 9.9% connect per dial, 58% of connects become conversations, 4.6% of conversations book a next step),
          First Page Sage (card-required trials → 48.8% make a first payment). Read 2026-09-13. A benchmark is always labelled as one; it is replaced by
          FieldQuo&apos;s own figure once the rep has {data?.benchmark?.minDials ?? 200} dials in the month.
        </p>
      </section>
    </div>
  );
}
