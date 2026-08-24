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
//
// ── It runs on invoices too ─────────────────────────────────────────────────
//
// Same component, one switch: `hoursAreActual`. On a quote the hours are a
// prediction and the crew shares a pool a recipe worked out; on an invoice
// they are per-person facts off a timesheet and the pool is whatever they add
// up to. That changes three things on screen — the crew label, whether the
// "extra labour hours" box exists at all (on an invoice there is no recipe for
// hours to be extra TO), and the recipe-coverage notes — and nothing about the
// arithmetic. Copying the panel instead would have left two margin badges to
// keep honest, and the copy is always the one that rots.
"use client";

import { TrendingUp, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { formatAppMoney } from "@/lib/format/money";

// toFixed does not group, so this panel printed $1113.11 and $2100.00 beside
// a correctly-grouped total in the same sticky bar. Shared formatter now —
// see lib/format/money.js. Bound to the company's currency inside the
// component, because a hardcoded default is how the original bug read.

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
  currency,
  estimate,
  workers = [],
  crew = [],
  onCrewChange,
  overheadPct,
  onOverheadChange,
  overheadSource,
  manualLabourHours,
  onManualLabourHoursChange,
  manualMaterialCost,
  onManualMaterialCostChange,
  subtotal,
  totalGroupCount = 0,
  marginTarget,
  // Invoice mode. See the header comment — one flag, because the three things
  // it changes are three faces of the same fact and letting a caller set them
  // independently would allow "actual hours" beside an "extra hours" box.
  hoursAreActual = false,
  // What the price row is called. "Quote price" on an invoice would be wrong
  // twice over: wrong document, and the figure is what was billed, not offered.
  priceLabel = "Quote price (pre-tax)",
  // Rendered under the crew: where the numbers came from, and what is missing
  // from them. Null on a quote, which has no timesheets to seed from.
  crewNotice = null,
}) {
  const money = (n) => formatAppMoney(n, currency, "en");

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
            {estimate.signal !== "green" && <AlertTriangle size={12} />}
            {estimate.marginPct}% margin
            {estimate.signal === "red" && " · losing money"}
            {estimate.signal === "amber" &&
              !estimate.costIncomplete &&
              !estimate.crewUnrated &&
              ` · below ${marginTarget}% target`}
            {estimate.costIncomplete && " · labour not costed"}
            {/* Says which, because "labour not costed" over a crew where two
                of three ARE costed reads as a bug in the panel. */}
            {!estimate.costIncomplete &&
              estimate.crewUnrated > 0 &&
              " · some labour not costed"}
          </span>
        )}
      </div>

      {/* Where the labour rate comes from. A worker with an hourly rate on
          their record wins; otherwise the manual box appears. */}
      <div className="flex flex-wrap items-end gap-3 mt-3 mb-4">
        <div className="w-full">
          {/* A crew, not a worker.
              This was one select and one rate, which forced a three-person
              job into a single number — and both ways of doing that are
              wrong: one rate leaves the supervisor free, and multiplying by
              head count triples a total that already counts everyone's hours.
              The hours are a pool the crew shares. See lib/costing/crew.js. */}
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-xs text-muted-foreground">
              {hoursAreActual
                ? "Crew — hours worked, edit any that are wrong"
                : "Crew — hours are shared between them"}
            </label>
            {estimate.blendedRate != null && (
              <span className="text-xs text-muted-foreground">
                blended {money(estimate.blendedRate)}/hr
              </span>
            )}
          </div>

          <div className="rounded-lg border border-border">
            {crew.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Nobody on the crew yet, so labour costs nothing and the margin
                below is higher than the job&apos;s.
              </p>
            )}
            {/* Hidden on a quote, where blank means "take an even share of the
                pool" and a header would be explaining a column that is often
                empty on purpose. On an invoice every cell is a fact and the
                columns need naming. */}
            {hoursAreActual && crew.length > 0 && (
              <div className="hidden sm:grid grid-cols-12 gap-2 border-b border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="col-span-4">Name</span>
                <span className="col-span-3">Cost $/hr</span>
                <span className="col-span-3">Hours worked</span>
                <span className="col-span-1 text-right">Cost</span>
                <span className="col-span-1" />
              </div>
            )}
            {crew.map((m, i) => {
              const priced = estimate.crew?.[i];
              return (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center gap-2 border-b border-border px-3 py-2 last:border-0"
                >
                  <input
                    className="col-span-12 rounded border border-border px-2 py-1 text-sm sm:col-span-4"
                    placeholder="Name or role"
                    value={m.name || ""}
                    onChange={(e) =>
                      onCrewChange(
                        crew.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <div className="col-span-4 sm:col-span-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="$/hr"
                      value={m.rate ?? ""}
                      onChange={(e) =>
                        onCrewChange(
                          crew.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  rate:
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                      className="w-full rounded border border-border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    {/* Blank means "take an even share of what is left".
                        Typing a number here takes those hours out of the pool
                        and the others re-share the remainder — it does not
                        silently change what everyone else worked. */}
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder={priced ? `${priced.hours} h` : "hours"}
                      value={m.hours ?? ""}
                      onChange={(e) =>
                        onCrewChange(
                          crew.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  hours:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                      className="w-full rounded border border-border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="col-span-3 text-right text-sm tabular-nums sm:col-span-1">
                    {priced ? money(priced.cost) : "—"}
                  </div>
                  <button
                    type="button"
                    onClick={() => onCrewChange(crew.filter((_, j) => j !== i))}
                    className="col-span-1 text-muted-foreground hover:text-red-600"
                    aria-label={`Remove ${m.name || "crew member"}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onCrewChange([...crew, { name: "", rate: 0, hours: null }])
              }
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus size={15} /> Add crew member
            </button>
            {workers.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const w = workers.find((x) => x.id === e.target.value);
                  if (!w) return;
                  onCrewChange([
                    ...crew,
                    {
                      id: w.id,
                      name: w.name || "Crew member",
                      // A worker with no rate on file joins at 0 and is
                      // flagged, rather than being quietly left off the job.
                      rate: Number(w.hourlyRate) || 0,
                      hours: null,
                    },
                  ]);
                }}
                className="rounded border border-border px-2 py-1 text-sm"
              >
                <option value="">Add from your team…</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.hourlyRate != null
                      ? ` — $${w.hourlyRate}/hr`
                      : " — no rate set"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {crewNotice && (
            <div className="mt-2 text-xs text-muted-foreground">
              {crewNotice}
            </div>
          )}

          {estimate.crewUnrated > 0 && (
            <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {estimate.crewUnrated} on the crew{" "}
              {estimate.crewUnrated === 1 ? "has" : "have"} no rate, so their
              hours cost nothing here. The margin below is higher than the
              job&apos;s until every rate is filled in.
            </p>
          )}
        </div>

        {/* Only offered when we have nothing better. Once the company's real
            cost per job is known, a percentage box next to it would just be
            two answers to the same question. */}
        {estimate.overheadBasis !== "per_job" && (
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
        )}
      </div>

      {estimate.costIncomplete && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {estimate.labourHours} hours of work are costed at $0 because nobody
          on the crew has a rate. Add someone above — until then this margin is
          higher than the job&apos;s.
        </p>
      )}

      {/* Only a quote has recipes to be missing. On an invoice the work is
          done and the hours are known, so this paragraph would be explaining
          the absence of a prediction nobody wanted. */}
      {!hoursAreActual && !estimate.hasRecipeEstimate && (
        <p className="mt-2 text-sm text-muted-foreground">
          No materials-and-labour recipe covers the trades on this quote — so
          far only cabinet refinishing and exterior painting have one. Enter the
          hours and materials you expect below and the margin works from those.
        </p>
      )}

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
                {/* A quantity with no supplier price shows as exactly that. It
                    used to be impossible to reach this state, because the only
                    trades with materials had every cost seeded; the takeoff-
                    derived bills have real quantities and mostly no prices yet,
                    and rendering those as $0.00 would put the biggest input in
                    a roofing job into the margin as free. */}
                {m.unpriced ? (
                  <span className="shrink-0 text-amber-700 dark:text-amber-400">
                    no price set
                  </span>
                ) : (
                  <span className="tabular-nums">{money(m.cost)}</span>
                )}
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

      {/* What the estimator knows and the recipe doesn't. Additive on top of
          whatever a recipe produced, never a replacement for it — an override
          that silently discards a calculation is how you lose the calculation
          and never notice. */}
      <div className="border-t border-border pt-3 grid gap-3 sm:grid-cols-2">
        {/* No "extra" hours on an invoice: there is no recipe prediction for
            them to be extra to, and a second hours box beside the crew's own
            would double-count the same day's work. The crew rows are the
            hours. */}
        {!hoursAreActual && (
          <div>
            <label className="text-xs text-muted-foreground">
              Extra labour hours
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={manualLabourHours ?? ""}
              onChange={(e) => onManualLabourHoursChange(e.target.value)}
              className="w-full mt-1 border border-border rounded px-2 py-1.5 text-sm"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Hours beyond what the recipe predicts, charged at the rate above.
            </p>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">
            {hoursAreActual ? "Materials for this job" : "Extra material cost"}
          </label>
          <input
            type="number"
            min="0"
            step="10"
            value={manualMaterialCost ?? ""}
            onChange={(e) => onManualMaterialCostChange(e.target.value)}
            className="w-full mt-1 border border-border rounded px-2 py-1.5 text-sm"
            placeholder="0"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {hoursAreActual
              ? "What the job actually consumed — paint, hardware, a slab, a rental."
              : "What you are buying in for this job — a supplier quote, a slab, a rental."}
          </p>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-1 text-sm">
        {/* An invoice has no recipe, so the consumables/purchased/by-hand split
            has nothing to split: two of the three are always zero and printing
            "Materials $0.00" above the real figure is noise that makes the
            column stop adding up on a read-through. One row, the total. */}
        {hoursAreActual ? (
          <Row label="Materials" value={money(estimate.materialTotal)} />
        ) : estimate.purchasedMaterial > 0 ? (
          <>
            <Row
              label="Materials — consumables"
              value={money(estimate.recipeMaterialTotal)}
            />
            <Row
              label="Materials — purchased (doors, slabs)"
              value={money(estimate.purchasedMaterial)}
            />
          </>
        ) : (
          // recipeMaterialTotal, not materialTotal: the added-by-hand figure
          // gets its own row below, and materialTotal already contains it.
          <Row label="Materials" value={money(estimate.recipeMaterialTotal)} />
        )}
        {!hoursAreActual && estimate.addedMaterial > 0 && (
          <Row
            label="Materials — added by hand"
            value={money(estimate.addedMaterial)}
          />
        )}
        {/* Said next to the number it undermines, not tucked in a corner. The
            hole is on the COST side, so the real margin is lower than the one
            below — never higher — and that is the direction worth stating. */}
        {estimate.unpricedMaterials > 0 && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            {estimate.unpricedMaterials} material
            {estimate.unpricedMaterials === 1 ? " has" : "s have"} no price set,
            so this is an understatement and the real margin is lower. Set them
            on the rate card in Settings &rsaquo; Services.
          </p>
        )}
        <Row
          label={
            estimate.labourHours > 0
              ? `Labour — ${estimate.labourHours} hrs`
              : "Labour"
          }
          value={money(estimate.labourCost)}
        />
        <Row
          label={
            estimate.overheadBasis === "per_job"
              ? "Overhead (this job's share)"
              : `Overhead (${overheadPct}% of price — estimated)`
          }
          value={money(estimate.overhead)}
        />
        <div className="border-t border-border mt-1 pt-1">
          {/* "Estimated" is a claim about how the figure was arrived at, and on
              an invoice it is a false one — these are hours that were worked
              and materials that were bought. Overhead stays an apportionment
              either way, which is what the note below the table is for. */}
          <Row
            label={hoursAreActual ? "Job cost" : "Estimated cost"}
            value={money(estimate.estimatedCost)}
            bold
          />
        </div>
        <Row label={priceLabel} value={money(subtotal)} />

        {estimate.marginPct != null && (
          <Row
            label={hoursAreActual ? "Profit on this job" : "Estimated profit"}
            value={`${money(estimate.profit)} (${estimate.marginPct}%)`}
            bold
            tone={estimate.signal === "red" ? "red" : undefined}
          />
        )}
      </div>

      {/* Where the overhead number came from. A share of the price is not a
          cost — quoting the same job higher doesn't raise the rent — so when
          we're guessing, the panel says we're guessing. */}
      {estimate.overheadBasis === "per_job" && overheadSource ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Overhead is {money(overheadSource.monthlyFixedCosts)}/month of fixed
          costs spread across {overheadSource.jobsPerMonth} jobs a month.
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Overhead is a flat percentage of the price because we don&apos;t know
          your capacity yet. Set your monthly costs in Settings → Overhead and
          your jobs-per-week in Forecast, and this becomes your real cost per
          job instead of an assumption.
        </p>
      )}

      {/* Said out loud, because a margin figure that silently covers half the
          quote is worse than no margin figure. */}
      {estimate.groups.length < totalGroupCount && (
        <p className="text-xs text-muted-foreground mt-3">
          Only quote types with a cost recipe are estimated (cabinet refinishing
          and exterior painting so far). The other line items aren&apos;t
          included in this figure yet.
        </p>
      )}
    </div>
  );
}
