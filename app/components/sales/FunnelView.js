// app/components/sales/FunnelView.js
//
// One rep's funnel, drawn: nine stages with the conversion from the stage
// before and the reference beside it, and the two quota bars.
//
// ══ Shared by the console and the rep's own card, so they cannot disagree ═
//
// /platform/sales/funnel (English, every rep) and the "My funnel" card on
// /sales (the rep's language, one rep) both render THIS. Every word is handed
// in through `copy`, already resolved — the console passes English, the card
// passes t() results — so the component holds no literal and the two screens
// draw the same bar from the same object. The reference label beside a
// conversion is `conversion.reference.label` from lib/sales/funnelStages.js,
// printed verbatim: the module decides whether a figure is a benchmark or
// FieldQuo's own, and this file is not allowed a second opinion.
//
// ══ What a missing number looks like ══════════════════════════════════════
//
// A conversion whose denominator is 0 has no percentage and prints
// `copy.noRate` rather than "0%": a rep with no dials has not converted 0%
// of them. A stage with no reference prints nothing in the reference cell —
// a dash would read as "zero", and the header of funnelStages.js says which
// stages have no published figure and why.
"use client";

const nf = new Intl.NumberFormat("en-CA");
const pct = (v, digits = 1) => (typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : null);

/**
 * The bar for one quota: the three bands as ticks, the count as the fill,
 * and the ramp said in words.
 */
export function QuotaBar({ quota, label, copy }) {
  if (!quota) return null;
  const { bands, count, reached } = quota;
  const max = bands.strong;
  const width = max > 0 ? Math.min(100, (count / max) * 100) : 0;
  const tick = (n) => (max > 0 ? Math.min(100, (n / max) * 100) : 0);
  const tone =
    reached === "strong"
      ? "bg-emerald-500"
      : reached === "target"
        ? "bg-emerald-500/80"
        : reached === "minimum"
          ? "bg-amber-500"
          : "bg-primary/70";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm tabular-nums text-foreground">
          {nf.format(count)} <span className="text-muted-foreground">/ {nf.format(bands.target)}</span>
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-hidden" role="img" aria-label={`${label}: ${count} of ${bands.target}`}>
        <div className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${width}%` }} />
        {["minimum", "target", "strong"].map((k) => (
          <div key={k} className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${tick(bands[k])}%` }} title={`${copy.bands[k]} ${bands[k]}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        <span>{copy.bands.minimum} {nf.format(bands.minimum)}</span>
        <span>{copy.bands.target} {nf.format(bands.target)}</span>
        <span>{copy.bands.strong} {nf.format(bands.strong)}</span>
        {quota.factor < 1 ? <span>{copy.rampNote(quota.factor)}</span> : null}
      </div>
    </div>
  );
}

/**
 * The stage table.
 *
 * @param funnel   a buildRepFunnel() result
 * @param copy     { stageLabel(stage), unit(unit), conversionFrom, reference, noRate,
 *                   benchmarkUntil(n), abandoned(n), bands: { minimum, target, strong },
 *                   rampNote(factor), quotaSignups, quotaAgreed }
 * @param compact  the rep's card: fewer columns, labels stacked
 */
export default function FunnelView({ funnel, copy, compact = false }) {
  if (!funnel) return null;
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <QuotaBar quota={funnel.quotas.signupCompleted} label={copy.quotaSignups} copy={copy} />
        <QuotaBar quota={funnel.quotas.agreed} label={copy.quotaAgreed} copy={copy} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-2 py-1.5 font-medium">{copy.stage}</th>
              <th className="px-2 py-1.5 font-medium text-right">{copy.count}</th>
              <th className="px-2 py-1.5 font-medium text-right">{copy.conversionFrom}</th>
              {!compact ? <th className="px-2 py-1.5 font-medium">{copy.reference}</th> : null}
            </tr>
          </thead>
          <tbody>
            {funnel.stages.map((s) => {
              const c = s.conversion;
              const ref = c?.reference || null;
              const shown = c ? pct(c.value) : null;
              return (
                <tr key={s.key} className="border-b border-border last:border-0 align-top">
                  <td className="px-2 py-1.5">
                    <span className="text-foreground">{copy.stageLabel(s)}</span>
                    <span className="block text-[11px] text-muted-foreground">{copy.unit(s.unit)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium text-foreground">{nf.format(s.count)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {c ? (
                      shown !== null ? (
                        <span className="text-foreground">{shown}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{copy.noRate}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {compact && ref ? (
                      <span className="block text-[11px] text-muted-foreground">
                        {pct(ref.value)} · {ref.label}
                      </span>
                    ) : null}
                  </td>
                  {!compact ? (
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {ref ? (
                        <>
                          <span className="tabular-nums text-foreground">{pct(ref.value)}</span>{" "}
                          <span className={ref.kind === "benchmark" ? "italic" : ""}>{ref.label}</span>
                          {ref.source ? <span className="block">{ref.source}</span> : null}
                        </>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        {!funnel.benchmark.usingOwn ? <p>{copy.benchmarkUntil(funnel.benchmark.minDials, funnel.stages[0]?.count || 0)}</p> : null}
        {funnel.abandonedSignups > 0 ? <p>{copy.abandoned(funnel.abandonedSignups)}</p> : null}
      </div>
    </div>
  );
}
