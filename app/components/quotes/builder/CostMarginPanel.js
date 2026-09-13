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

import { TrendingUp, AlertTriangle, Plus, Trash2, Undo2 } from "lucide-react";
import { formatAppMoney } from "@/lib/format/money";
import { useTranslation } from "@/app/hooks/useTranslation";

// toFixed does not group, so this panel printed $1113.11 and $2100.00 beside
// a correctly-grouped total in the same sticky bar. Shared formatter now —
// see lib/format/money.js. Bound to the company's currency inside the
// component, because a hardcoded default is how the original bug read.

const SIGNAL_STYLES = {
  green: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  red: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

/**
 * One line of a group's bill of materials, editable where the takeoff behind
 * it is still live.
 *
 * ── Why the quantity and the price are both boxes ──────────────────────────
 *
 * The owner: "the company can change the linear details and sqft but also
 * should be able to modify the price just in case… because if they can't
 * modify the price and they lose money they'll be frustrated". The packaging
 * constants and the August supplier reads behind these numbers are a good
 * default and a bad promise — the roofer holding a real invoice is right.
 *
 * A line with no price used to be a dead end that said "set them on the rate
 * card in Settings › Services" — true, and three screens away from the person
 * who has the number in their hand. The box is here now, and it writes to the
 * takeoff so it survives the save (lib/costing/tradeMaterials.js,
 * applyMaterialOverrides).
 *
 * ── Read-only when there is nothing to write to ────────────────────────────
 *
 * No `onOverride` (the invoice's cost section) or no `materialKey` (a frozen
 * estimate written before keys existed) and the row renders exactly as it did.
 * A box that accepts a number nothing stores is the control this codebase gets
 * swept for.
 */
function MaterialLine({ m, money, t, onOverride }) {
  const editable = Boolean(onOverride && m.materialKey);
  const unit = m.unit ? t(`app.materialUnit.${m.unit}`, m.unit) : "";

  if (!editable) {
    return (
      <div className="flex justify-between">
        <span>
          {m.name} — {m.qty} {unit}
        </span>
        {/* A quantity with no supplier price shows as exactly that. It
            used to be impossible to reach this state, because the only
            trades with materials had every cost seeded; the takeoff-
            derived bills have real quantities and mostly no prices yet,
            and rendering those as $0.00 would put the biggest input in
            a roofing job into the margin as free. */}
        {m.unpriced ? (
          <span className="shrink-0 text-amber-700 dark:text-amber-400">
            {t("app.cost.noPriceSet", "no price set")}
          </span>
        ) : (
          <span className="tabular-nums">{money(m.cost)}</span>
        )}
      </div>
    );
  }

  const overridden = Boolean(m.overriddenQty || m.overriddenUnitCost);
  // "" rather than 0 when nothing is set: a placeholder-zero in a price box
  // reads as "this is free", which is the exact claim `unpriced` exists to
  // avoid making.
  const box =
    "w-16 rounded border border-border bg-background px-1.5 py-0.5 text-right text-xs tabular-nums";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-0.5">
      <span className="min-w-0 flex-1 truncate" title={m.name}>
        {m.name}
      </span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          step="1"
          value={m.qty ?? ""}
          onChange={(e) =>
            onOverride(m.materialKey, {
              qty: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className={box}
          aria-label={t("app.cost.quantityOf", "Quantity — {name}", {
            name: m.name,
          })}
        />
        <span className="w-12 shrink-0 truncate text-[11px]">{unit}</span>
        <input
          type="number"
          min="0"
          step="1"
          value={m.unitCost ?? ""}
          placeholder={t("app.cost.pricePlaceholder", "price")}
          onChange={(e) =>
            onOverride(m.materialKey, {
              unitCost: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className={`${box} ${
            m.unpriced ? "border-amber-500 dark:border-amber-600" : ""
          }`}
          aria-label={t("app.cost.unitPriceOf", "Price per {unit} — {name}", {
            unit,
            name: m.name,
          })}
        />
        <span className="w-16 shrink-0 text-right tabular-nums">
          {m.unpriced ? "—" : money(m.cost)}
        </span>
        {/* Only when something was overridden, and it restores BOTH numbers to
            what the price book derived. An estimator who typed over a figure
            has to be able to get the calculation back — an override with no way
            out is how a calculation gets lost and nobody notices. */}
        <button
          type="button"
          onClick={() => onOverride(m.materialKey, null)}
          disabled={!overridden}
          className={`shrink-0 ${
            overridden
              ? "text-muted-foreground hover:text-foreground"
              : "invisible"
          }`}
          title={t("app.cost.resetToBook", "Back to the price book")}
          aria-label={t("app.cost.resetToBook", "Back to the price book")}
        >
          <Undo2 size={12} />
        </button>
      </span>
    </div>
  );
}

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
  // Undefined means "this is a quote" and the panel names the row itself in
  // the reader's language; the invoice section passes its own wording.
  priceLabel,
  // Rendered under the crew: where the numbers came from, and what is missing
  // from them. Null on a quote, which has no timesheets to seed from.
  crewNotice = null,
  // (tempId, materialKey, patch | null) => void. Absent means the bill is
  // read-only — the invoice's cost section passes nothing, and so does a quote
  // whose scope group is already saved and whose takeoff is deliberately
  // frozen. See MaterialLine.
  onMaterialOverride = null,
  // tempIds whose takeoff still round-trips on save. A group not in here keeps
  // the read-only row even when a callback was passed.
  editableMaterialGroups = [],
}) {
  const { t, language } = useTranslation();
  const money = (n) => formatAppMoney(n, currency, language);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <TrendingUp size={16} /> {t("app.cost.title", "Cost & margin")}
          <span className="text-xs font-normal text-muted-foreground">
            {t("app.cost.internalOnly", "(internal — never shown to the client)")}
          </span>
        </h2>

        {estimate.marginPct != null && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
              SIGNAL_STYLES[estimate.signal] || SIGNAL_STYLES.green
            }`}
          >
            {estimate.signal !== "green" && <AlertTriangle size={12} />}
            {t("app.cost.marginPct", { pct: estimate.marginPct })}
            {estimate.signal === "red" && ` · ${t("app.cost.losingMoney")}`}
            {estimate.signal === "amber" &&
              !estimate.costIncomplete &&
              !estimate.crewUnrated &&
              ` · ${t("app.cost.belowTarget", { pct: marginTarget })}`}
            {estimate.costIncomplete && ` · ${t("app.cost.labourNotCosted")}`}
            {/* Says which, because "labour not costed" over a crew where two
                of three ARE costed reads as a bug in the panel. */}
            {!estimate.costIncomplete &&
              estimate.crewUnrated > 0 &&
              ` · ${t("app.cost.someLabourNotCosted")}`}
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
                ? t("app.cost.crewActual")
                : t("app.cost.crewShared")}
            </label>
            {estimate.blendedRate != null && (
              <span className="text-xs text-muted-foreground">
                {t("app.cost.blended", { rate: money(estimate.blendedRate) })}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-border">
            {crew.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {t("app.cost.noCrew")}
              </p>
            )}
            {/* Hidden on a quote, where blank means "take an even share of the
                pool" and a header would be explaining a column that is often
                empty on purpose. On an invoice every cell is a fact and the
                columns need naming. */}
            {hoursAreActual && crew.length > 0 && (
              <div className="hidden sm:grid grid-cols-12 gap-2 border-b border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="col-span-4">{t("app.cost.colName")}</span>
                <span className="col-span-3">{t("app.cost.colRate")}</span>
                <span className="col-span-3">{t("app.cost.colHours")}</span>
                <span className="col-span-1 text-right">{t("app.cost.colCost")}</span>
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
                    placeholder={t("app.cost.nameOrRole")}
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
                      placeholder={t("app.cost.perHour")}
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
                      placeholder={priced ? `${priced.hours} h` : t("app.cost.hoursPlaceholder")}
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
                    aria-label={t("app.cost.removeMember", {
                      name: m.name || t("app.cost.crewMember"),
                    })}
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
              <Plus size={15} /> {t("app.cost.addCrewMember")}
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
                      name: w.name || t("app.cost.crewMember"),
                      // A worker with no rate on file joins at 0 and is
                      // flagged, rather than being quietly left off the job.
                      rate: Number(w.hourlyRate) || 0,
                      hours: null,
                    },
                  ]);
                }}
                className="rounded border border-border px-2 py-1 text-sm"
              >
                <option value="">{t("app.cost.addFromTeam")}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.hourlyRate != null
                      ? ` — ${t("app.cost.ratePerHour", { rate: money(w.hourlyRate) })}`
                      : ` — ${t("app.cost.noRateSet")}`}
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
              {t("app.cost.crewUnrated", { value: estimate.crewUnrated })}
            </p>
          )}
        </div>

        {/* Only offered when we have nothing better. Once the company's real
            cost per job is known, a percentage box next to it would just be
            two answers to the same question. */}
        {estimate.overheadBasis !== "per_job" && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {t("app.cost.overheadPct")}
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
          {t("app.cost.hoursAtZero", { hours: estimate.labourHours })}
        </p>
      )}

      {/* Only a quote has recipes to be missing. On an invoice the work is
          done and the hours are known, so this paragraph would be explaining
          the absence of a prediction nobody wanted. */}
      {!hoursAreActual && !estimate.hasRecipeEstimate && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("app.cost.noRecipe")}
        </p>
      )}

      {estimate.groups.map((g) => (
        <div key={g.tempId} className="mb-3 border-t border-border pt-3">
          <div className="text-sm font-medium text-foreground mb-1">
            {g.label}{" "}
            <span className="text-xs text-muted-foreground">
              ·{" "}
              {/* The takeoff trades hand back the same summary twice: as
                  English strings (what a stored costing row and the sourcing
                  list carry) and as message keys with their numbers. A screen
                  rendering live for the estimator uses the keys; anything
                  without them — every recipe trade — falls back to the
                  English, which is what shipped before. */}
              {Array.isArray(g.summaryTokens) && g.summaryTokens.length
                ? g.summaryTokens
                    .map((s) => t(s.key, s.values))
                    .join(" · ")
                : g.summaryParts.join(" · ")}
            </span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {g.materials.map((m, i) => (
              <MaterialLine
                key={m.materialKey || `m${i}`}
                m={m}
                money={money}
                t={t}
                onOverride={
                  onMaterialOverride &&
                  editableMaterialGroups.includes(g.tempId)
                    ? (materialKey, patch) =>
                        onMaterialOverride(g.tempId, materialKey, patch)
                    : null
                }
              />
            ))}
            {g.labourBreakdown.map((l, i) => (
              <div key={`l${i}`} className="flex justify-between">
                <span>
                  {l.name} — {t("app.cost.hrs", { hours: l.hours })}
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
              {t("app.cost.extraLabourHours")}
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
              {t("app.cost.extraLabourHint")}
            </p>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">
            {hoursAreActual ? t("app.cost.materialsForJob") : t("app.cost.extraMaterialCost")}
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
              ? t("app.cost.materialsActualHint")
              : t("app.cost.materialsExtraHint")}
          </p>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-1 text-sm">
        {/* An invoice has no recipe, so the consumables/purchased/by-hand split
            has nothing to split: two of the three are always zero and printing
            "Materials $0.00" above the real figure is noise that makes the
            column stop adding up on a read-through. One row, the total. */}
        {hoursAreActual ? (
          <Row label={t("app.cost.materials")} value={money(estimate.materialTotal)} />
        ) : estimate.purchasedMaterial > 0 ? (
          <>
            <Row
              label={t("app.cost.materialsConsumables")}
              value={money(estimate.recipeMaterialTotal)}
            />
            <Row
              label={t("app.cost.materialsPurchased")}
              value={money(estimate.purchasedMaterial)}
            />
          </>
        ) : (
          // recipeMaterialTotal, not materialTotal: the added-by-hand figure
          // gets its own row below, and materialTotal already contains it.
          <Row label={t("app.cost.materials")} value={money(estimate.recipeMaterialTotal)} />
        )}
        {!hoursAreActual && estimate.addedMaterial > 0 && (
          <Row
            label={t("app.cost.materialsByHand")}
            value={money(estimate.addedMaterial)}
          />
        )}
        {/* Said next to the number it undermines, not tucked in a corner. The
            hole is on the COST side, so the real margin is lower than the one
            below — never higher — and that is the direction worth stating. */}
        {estimate.unpricedMaterials > 0 && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            {/* It used to end "set them on the rate card in Settings ›
                Services" — true, and three screens away from the estimator
                holding the supplier's number. The boxes are on the lines
                above now, so the sentence points at them and keeps the rate
                card for the price that should stick. */}
            {onMaterialOverride && editableMaterialGroups.length > 0
              ? t(
                  "app.cost.unpricedFixable",
                  "{count} material lines above have no price set, so this is an understatement and the real margin is lower. Type the price in beside the line for this job, or set it on the rate card in Settings › Services to keep it.",
                  { count: estimate.unpricedMaterials },
                )
              : t(
                  "app.cost.unpricedReadOnly",
                  "{count} material lines have no price set, so this is an understatement and the real margin is lower. Set them on the rate card in Settings › Services.",
                  { count: estimate.unpricedMaterials },
                )}
          </p>
        )}
        <Row
          label={
            estimate.labourHours > 0
              ? `${t("app.cost.labour")} — ${t("app.cost.hrs", { hours: estimate.labourHours })}`
              : t("app.cost.labour")
          }
          value={money(estimate.labourCost)}
        />
        <Row
          label={
            estimate.overheadBasis === "per_job"
              ? t("app.cost.overheadShare")
              : t("app.cost.overheadEstimated", { pct: overheadPct })
          }
          value={money(estimate.overhead)}
        />
        <div className="border-t border-border mt-1 pt-1">
          {/* "Estimated" is a claim about how the figure was arrived at, and on
              an invoice it is a false one — these are hours that were worked
              and materials that were bought. Overhead stays an apportionment
              either way, which is what the note below the table is for. */}
          <Row
            label={hoursAreActual ? t("app.cost.jobCost") : t("app.cost.estimatedCost")}
            value={money(estimate.estimatedCost)}
            bold
          />
        </div>
        <Row label={priceLabel ?? t("app.cost.quotePrice")} value={money(subtotal)} />

        {estimate.marginPct != null && (
          <Row
            label={hoursAreActual ? t("app.cost.profitOnJob") : t("app.cost.estimatedProfit")}
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
          {t("app.cost.overheadSource", {
            monthly: money(overheadSource.monthlyFixedCosts),
            jobs: overheadSource.jobsPerMonth,
          })}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("app.cost.overheadGuess")}
        </p>
      )}

      {/* Said out loud, because a margin figure that silently covers half the
          quote is worse than no margin figure. */}
      {estimate.groups.length < totalGroupCount && (
        <p className="text-xs text-muted-foreground mt-3">
          {t("app.cost.partialCoverage")}
        </p>
      )}
    </div>
  );
}
