// app/components/quotes/builder/CostMarginPanel.js
//
// What the job costs the company, and what's left over.
//
// ── Never client-facing, and it says so twice ───────────────────────────────
//
// This panel sits inside the quote builder showing labour rates, material
// costs and margin. None of it goes near a client — but it's on the same
// screen as things that do, so the boundary is stated in the heading and again
// in the panel's own styling. A contractor turning a laptop round to show a
// client the price must not be exposing their cost base.
//
// ── The margin badge is the whole point ─────────────────────────────────────
//
// Everything else here is reference. The badge answers "am I about to quote
// this too cheap", which is the question you can't answer by looking at a
// price, and the one people get wrong when quoting quickly on site.
"use client";

import { TrendingUp, AlertTriangle } from "lucide-react";

const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;

const SIGNAL_STYLES = {
  green: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  red: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

function Row({ label, value, bold, tone }) {
  return (
    <div
      className={`flex justify-between ${
        bold
          ? `font-semibold pt-1 ${
              tone === "red"
                ? "text-red-600 dark:text-red-400"
                : "text-foreground"
            }`
          : "text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default function CostMarginPanel({
  estimate,
  workers = [],
  costWorkerId,
  onWorkerChange,
  selectedWorker,
  fallbackRate,
  onFallbackRateChange,
  overheadPct,
  onOverheadChange,
  subtotal,
  totalGroupCount,
  marginTarget,
}) {
  if (!estimate?.hasEstimable) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <TrendingUp size={16} /> Cost &amp; margin
          <span className="text-xs font-normal text-muted-foreground">
            (internal — never shown to the client)
          </span>
        </h2>

        {estimate.marginPct != null && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
              SIGNAL_STYLES[estimate.signal] || SIGNAL_STYLES.green
            }`}
          >
            {estimate.signal === "red" && <AlertTriangle size={12} />}
            {estimate.marginPct}% margin
            {estimate.signal !== "green" && ` · below ${marginTarget}% target`}
          </span>
        )}
      </div>

      {/* Where the labour rate comes from. A worker with an hourly rate on
          their record wins; otherwise the manual box appears. */}
      <div className="flex flex-wrap items-end gap-3 mt-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Assigned worker
          </label>
          <select
            value={costWorkerId}
            onChange={(e) => onWorkerChange(e.target.value)}
            className="border border-border rounded px-2 py-1.5 text-sm bg-card"
          >
            <option value="">Use manual rate</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.hourlyRate != null
                  ? ` — $${Number(w.hourlyRate)}/hr`
                  : " — no rate set"}
              </option>
            ))}
          </select>
        </div>

        {(!selectedWorker || selectedWorker.hourlyRate == null) && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Labour rate $/hr
            </label>
            <input
              type="number"
              value={fallbackRate}
              onChange={(e) => onFallbackRateChange(e.target.value)}
              className="border border-border rounded px-2 py-1.5 text-sm w-24"
            />
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Overhead % of price
          </label>
          <input
            type="number"
            value={overheadPct}
            onChange={(e) => onOverheadChange(e.target.value)}
            className="border border-border rounded px-2 py-1.5 text-sm w-20"
          />
        </div>
      </div>

      {estimate.groups.map((g) => (
        <div key={g.tempId} className="mb-3 border-t border-border pt-3">
          <div className="text-sm font-medium text-foreground mb-1">
            {g.label}{" "}
            <span className="text-xs text-muted-foreground">
              · {g.summaryParts.join(" · ")}
            </span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {g.materials.map((m, i) => (
              <div key={`m${i}`} className="flex justify-between">
                <span>
                  {m.name} — {m.qty} {m.unit}
                </span>
                <span className="tabular-nums">{money(m.cost)}</span>
              </div>
            ))}
            {g.labourBreakdown.map((l, i) => (
              <div key={`l${i}`} className="flex justify-between">
                <span>
                  {l.name} — {l.hours} hrs
                </span>
                <span className="tabular-nums">{money(l.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="border-t border-border pt-3 space-y-1 text-sm">
        <Row label="Materials" value={money(estimate.materialTotal)} />
        <Row label="Labour" value={money(estimate.labourCost)} />
        <Row label={`Overhead (${overheadPct}%)`} value={money(estimate.overhead)} />
        <div className="border-t border-border mt-1 pt-1">
          <Row label="Estimated cost" value={money(estimate.estimatedCost)} bold />
        </div>
        <Row label="Quote price (pre-tax)" value={money(subtotal)} />

        {estimate.marginPct != null && (
          <Row
            label="Estimated profit"
            value={`${money(subtotal - estimate.estimatedCost)} (${estimate.marginPct}%)`}
            bold
            tone={estimate.signal === "red" ? "red" : undefined}
          />
        )}
      </div>

      {/* Said out loud, because a margin figure that silently covers half the
          quote is worse than no margin figure. */}
      {estimate.groups.length < totalGroupCount && (
        <p className="text-xs text-muted-foreground mt-3">
          Only quote types with a cost recipe are estimated (cabinet refinishing
          so far). The other line items aren&apos;t included in this figure yet.
        </p>
      )}
    </div>
  );
}
