"use client";

// app/components/platform/PlanReadTimings.js
//
// "Drawing reads" on /platform/ai-usage: the last reads across companies, how
// long each stage took and what each stage cost. The point is measurement —
// the deep read's 3–5 minute target and its per-read token assumptions
// (lib/planRead/billing.js READ_TOKENS) were set before any real read ran, and
// this is where the first real ones are read off.
//
// Sheets and photos run side by side, so their times overlap and do not add
// up to the total; "idle" is the time a read spent between invocations (a
// lease pause, or a closed tab before the backstop cron came by).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ruler } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatDuration } from "@/lib/planRead/timing";

const UNKNOWN = "—";
const dur = (ms) => formatDuration(ms) ?? UNKNOWN;
const fmt = (n) => (n === null || n === undefined ? UNKNOWN : Number(n).toLocaleString("en-CA"));
// USD: FieldQuo's own vendor cost, as on the rest of this page.
const usd = (micros) => {
  if (micros === null || micros === undefined) return UNKNOWN;
  const d = micros / 1_000_000;
  return d > 0 && d < 0.01 ? "<$0.01" : `$${d.toFixed(2)}`;
};

function StepCell({ ms, usage }) {
  return (
    <td className="py-2 px-2 align-top whitespace-nowrap">
      <span className="tabular-nums">{dur(ms)}</span>
      {usage ? (
        <span className="block text-[11px] text-muted-foreground tabular-nums">
          {`${fmt(usage.calls)} calls · ${fmt(usage.promptTokens)} in (${fmt(usage.cachedTokens)} cached) · ${fmt(usage.completionTokens)} out · ${usd(usage.vendorMicros)}`}
        </span>
      ) : null}
    </td>
  );
}

export default function PlanReadTimings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetchJson("/api/platform/plan-reads")
      .then((d) => live && setData(d))
      .catch((err) => live && setError(err?.message || "Couldn't load the drawing reads."));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Ruler size={16} className="text-muted-foreground" />
          Drawing reads — time and cost per stage
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          The last {data?.limit ?? 40} reads. Sheets and photos run side by side, so they overlap; idle is time spent
          between invocations (a pause, or a closed tab before the backstop). Tokens per stage are across every run of
          that read.
        </p>
        {data?.medians?.reads > 0 && (
          <p className="text-sm text-foreground mt-2 tabular-nums">
            {`Median of ${data.medians.reads} finished: total ${dur(data.medians.totalMs)} · sheets ${dur(data.medians.sheetsMs)} · photos ${dur(data.medians.photosMs)} · synthesis ${dur(data.medians.synthesisMs)} · idle ${dur(data.medians.idleMs)}`}
          </p>
        )}
      </div>
      {error ? (
        <p className="px-5 py-6 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : !data ? (
        <div className="h-24 m-5 rounded-lg bg-accent animate-pulse" />
      ) : !Array.isArray(data.reads) ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">The reads didn&apos;t come back in the expected shape — this is not a report of none.</p>
      ) : data.reads.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">No drawing read has been run yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 px-5 font-medium">Read</th>
                <th className="py-2 px-2 font-medium">Total</th>
                <th className="py-2 px-2 font-medium">Sheets</th>
                <th className="py-2 px-2 font-medium">Photos</th>
                <th className="py-2 px-2 font-medium">Synthesis</th>
                <th className="py-2 px-2 font-medium">Idle · slices</th>
                <th className="py-2 px-2 font-medium">Charged</th>
              </tr>
            </thead>
            <tbody>
              {data.reads.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 px-5 align-top">
                    <Link href={`/platform/companies/${r.companyId}`} className="font-medium text-foreground hover:underline">
                      {r.companyName || r.companyId}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {`${r.title} · ${r.status}${r.stage && r.status === "reading" ? ` (${r.stage})` : ""} · ${fmt(r.sheets)} sheets · ${fmt(r.photos)} photos`}
                    </span>
                    {r.timing ? (
                      <span className="block text-[11px] text-muted-foreground">
                        {`uploads over ${dur(r.timing.uploadSpanMs)} · clicked ${dur(r.timing.waitBeforeReadMs)} after the last · slowest sheet ${dur(r.timing.slowestSheetMs)}${r.timing.retriedSheets ? ` · ${r.timing.retriedSheets} retried` : ""}`}
                      </span>
                    ) : (
                      <span className="block text-[11px] text-muted-foreground">No timings — read before they were recorded.</span>
                    )}
                  </td>
                  <td className="py-2 px-2 align-top tabular-nums">{dur(r.timing?.totalMs)}</td>
                  <StepCell ms={r.timing?.sheetsMs} usage={r.byStep?.sheets} />
                  <StepCell ms={r.timing?.photosMs} usage={r.byStep?.photos} />
                  <StepCell ms={r.timing?.synthesisMs} usage={r.byStep?.synthesis} />
                  <td className="py-2 px-2 align-top tabular-nums whitespace-nowrap">{`${dur(r.timing?.idleMs)} · ${fmt(r.timing?.invocations)}`}</td>
                  <td className="py-2 px-2 align-top tabular-nums whitespace-nowrap">
                    {r.chargedCents === null ? UNKNOWN : `${fmt(r.chargedCents)} cr`}
                    <span className="block text-[11px] text-muted-foreground">{`held up to ${fmt(r.estimateCents)}`}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
