// app/components/quotes/builder/ServicesTab.js
//
// The document builder's Services tab — the owner (2026-09-24): "a Services
// tab next to Estimate / Presentation / Work order / Notes". One card per
// service on the quote with what was measured, the production rate of each
// service on it, the crew hours that gives, and — for a member allowed to see
// them — labour cost, materials, price and margin.
//
// ── Read-only on purpose ───────────────────────────────────────────────────
//
// Every number here has an editor already, and the tab sends you to it
// rather than growing a second one: "Open measurements" unfolds the group's
// takeoff on the Estimate tab, "Add from a service template" opens that
// group's line library (the one that lists Products & Services with their
// templates), and a rate is set in Settings › Services. Two boxes for one
// quantity would be two values for it.
//
// The figures are lib/quotes/servicesTab.js's, off the SAME estimate object
// the Cost & margin drawer renders, and that file does the redaction: a row
// built for a member without jobCosting carries no cost keys at all, one
// without showPricing no price — this component only draws what it was given.
"use client";

import Link from "next/link";
import { Ruler, Plus, Timer, Settings2 } from "lucide-react";
import { servicesTabModel } from "@/lib/quotes/servicesTab";
import { scopeGroupsLineItemCost } from "@/lib/costing/lineItemCost";
import { formatProductionRate, productionMeasureLabel } from "@/app/components/pricing/ProductionRateField";

const fmtNum = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
};

export default function ServicesTab({ b, t, money, onOpenTakeoff, onAddTemplate, isLocked }) {
  const mayCost = Boolean(b.mayCost);
  const showPricing = b.showPricing !== false;
  const { rows, totals } = servicesTabModel({
    groups: b.scopeGroups,
    productionByGroup: b.productionByGroup,
    estimate: b.estimate,
    tradeHoursOf: (g) => (b.tradeHoursFor ? b.tradeHoursFor(g) : 0),
    priceOf: (g) => b.groupTotal(g),
    lineCostOf: (g) => scopeGroupsLineItemCost([g]),
    showPricing,
    mayCost,
  });
  const canSetRates = ["owner", "admin"].includes(b.caller?.role);
  const unitWord = (unit) => (unit ? t(`app.quoteReview.unit_${unit}`, unit) : "");
  const hoursText = (h) => t("app.servicesTab.hours", "{hours} h", { hours: fmtNum(h) });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground" data-tab-panel="services">
        {t("app.servicesTab.empty", "No services on this quote yet. Add one on the Estimate tab.")}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-tab-panel="services">
      <p className="text-xs text-muted-foreground">
        {t("app.servicesTab.intro", "What each service measures, how fast your crew does it and what that costs. Staff only — none of this is on the client's document.")}
      </p>

      {rows.map((row) => {
        const locked = isLocked ? isLocked(row.tempId) : false;
        return (
          <section key={row.tempId} className="rounded-xl border border-border bg-card p-4 space-y-3" data-services-row={row.categoryKey || ""}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{row.label || t("app.servicesTab.untitled", "Service")}</h3>
              {!locked && (
                <div className="flex flex-wrap items-center gap-3">
                  {row.hasCalculator && (
                    <button type="button" onClick={() => onOpenTakeoff(row.tempId)} className="text-xs font-medium text-foreground inline-flex items-center gap-1" data-services-open-takeoff>
                      <Ruler size={12} /> {t("app.servicesTab.openTakeoff", "Open measurements")}
                    </button>
                  )}
                  <button type="button" onClick={() => onAddTemplate(row.tempId)} className="text-xs font-medium text-foreground inline-flex items-center gap-1" data-services-add-template>
                    <Plus size={12} /> {t("app.servicesTab.addTemplate", "Add from a service template")}
                  </button>
                </div>
              )}
            </div>

            {/* Measured */}
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("app.servicesTab.measured", "Measured")}</h4>
              {row.measurements.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("app.servicesTab.nothingMeasured", "Nothing measured on this service yet.")}</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1.5" data-services-measurements>
                  {row.measurements.map((m) => (
                    <span key={m.key} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground tabular-nums">
                      {productionMeasureLabel(m.key, t)}: {fmtNum(m.value)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Production */}
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("app.servicesTab.production", "Production")}</h4>
              {row.services.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("app.servicesTab.noTemplates", "No service template on this group — its hours are the trade's own.")}</p>
              ) : (
                <div className="mt-1 divide-y divide-border" data-services-production>
                  {row.services.map((s) => (
                    <div key={s.runId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1 text-sm">
                      <span className="min-w-0 text-foreground">{s.name}</span>
                      {s.production ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {productionMeasureLabel(s.production.key, t)} — {formatProductionRate(s.production, t)}
                          {" · "}
                          {s.quantity === null
                            ? t("app.servicesTab.noQuantity", "no measurement yet")
                            : `${fmtNum(s.quantity)} ${unitWord(s.unit)}`}
                          {s.hours !== null && <span className="ml-1 font-medium text-foreground">= {hoursText(s.hours)}</span>}
                        </span>
                      ) : canSetRates ? (
                        <Link href="/app/settings/services" className="text-xs text-muted-foreground underline underline-offset-2 inline-flex items-center gap-1">
                          <Settings2 size={11} /> {t("app.servicesTab.setRate", "Set a production rate")}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("app.servicesTab.noRate", "No production rate set")}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Figures */}
            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs" data-services-figures>
              <div>
                <dt className="text-muted-foreground inline-flex items-center gap-1"><Timer size={11} /> {t("app.servicesTab.crewHours", "Crew hours")}</dt>
                <dd className="font-semibold text-foreground tabular-nums">{row.hours > 0 ? hoursText(row.hours) : "—"}</dd>
                <dd className="text-[11px] text-muted-foreground">
                  {row.hoursSource === "services"
                    ? row.replacedBookHours !== null
                      ? t("app.servicesTab.fromRatesReplacing", "from production rates (the trade's rates said {hours} h)", { hours: fmtNum(row.replacedBookHours) })
                      : t("app.servicesTab.fromRates", "from production rates")
                    : row.hoursSource === "trade"
                      ? t("app.servicesTab.fromTrade", "from the trade's rates")
                      : t("app.servicesTab.noHours", "no hours yet")}
                </dd>
              </div>
              {"labourCost" in row && (
                <div>
                  <dt className="text-muted-foreground">{t("app.servicesTab.labourCost", "Labour cost")}</dt>
                  <dd className="font-semibold text-foreground tabular-nums">{money(row.labourCost)}</dd>
                </div>
              )}
              {"materials" in row && (
                <div>
                  <dt className="text-muted-foreground">{t("app.servicesTab.materials", "Materials & line costs")}</dt>
                  <dd className="font-semibold text-foreground tabular-nums">{money(row.materials)}</dd>
                </div>
              )}
              {"price" in row && (
                <div>
                  <dt className="text-muted-foreground">{t("app.servicesTab.price", "Price")}</dt>
                  <dd className="font-semibold text-foreground tabular-nums">{money(row.price)}</dd>
                </div>
              )}
              {"margin" in row && (
                <div>
                  <dt className="text-muted-foreground">{t("app.servicesTab.margin", "Margin before overhead")}</dt>
                  <dd className={`font-semibold tabular-nums ${row.margin !== null && row.margin < 0 ? "text-red-700 dark:text-red-400" : "text-foreground"}`}>
                    {row.margin === null ? "—" : `${fmtNum(row.margin)}%`}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        );
      })}

      {/* The quote as a whole */}
      <section className="rounded-xl border border-border bg-muted/40 p-4" data-services-totals>
        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">{t("app.servicesTab.totalHours", "All services — crew hours")}</dt>
            <dd className="font-semibold text-foreground tabular-nums">{hoursText(totals.hours)}</dd>
          </div>
          {"labourCost" in totals && (
            <div>
              <dt className="text-muted-foreground">{t("app.servicesTab.labourCost", "Labour cost")}</dt>
              <dd className="font-semibold text-foreground tabular-nums">{money(totals.labourCost)}</dd>
            </div>
          )}
          {"materials" in totals && (
            <div>
              <dt className="text-muted-foreground">{t("app.servicesTab.materials", "Materials & line costs")}</dt>
              <dd className="font-semibold text-foreground tabular-nums">{money(totals.materials)}</dd>
            </div>
          )}
          {"price" in totals && (
            <div>
              <dt className="text-muted-foreground">{t("app.servicesTab.price", "Price")}</dt>
              <dd className="font-semibold text-foreground tabular-nums">{money(totals.price)}</dd>
            </div>
          )}
          {"margin" in totals && (
            <div>
              <dt className="text-muted-foreground">{t("app.servicesTab.margin", "Margin before overhead")}</dt>
              <dd className="font-semibold text-foreground tabular-nums">{totals.margin === null ? "—" : `${fmtNum(totals.margin)}%`}</dd>
            </div>
          )}
        </dl>
        {mayCost && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("app.servicesTab.overheadNote", "Overhead, hours added by hand and the crew split are the job's as a whole — Cost & margin on the Estimate tab has the full picture.")}
          </p>
        )}
      </section>
    </div>
  );
}
