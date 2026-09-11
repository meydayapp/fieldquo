"use client";

// app/components/fleet/VehicleCost.js
//
// What one van costs to run, and the expenses behind the figure.
//
// ══ Only ever rendered from a payload that carried the numbers ═════════════
//
// lib/fleet/load.js attaches `cost` and `expenses` to a row only for a member
// who passed the cost-basis gate, and strips both otherwise. So this component
// is not hiding money from a dispatcher — the money was never sent — and the
// card mounts it only when `canSeeCost` is true and the block exists.
//
// ══ Null is printed as its reason, never as a number ═══════════════════════
//
// The cost per km is null in four distinct situations (lib/fleet/cost.js), and
// each gets its own sentence. "Needs two odometer readings" tells the person
// what to do next; a "—" tells them nothing, and "$0.00/km" tells them a lie.
// The same rule holds for the total: a van whose asset row was deleted has no
// depreciation to add, so its total is null and says so.

import { Fuel } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { COST_PER_KM_MIN_DAYS } from "@/lib/fleet/cost";

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale || undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function VehicleCost({ cost, expenses }) {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();

  if (!cost) return null;

  const perKmLine = (() => {
    if (cost.costPerKm) {
      return {
        value: `${money(cost.costPerKm.perKm)} / km`,
        detail: t("app.fleet.costPerKmDetail", "{km} km over {days} days", {
          km: cost.costPerKm.km.toLocaleString(),
          days: cost.costPerKm.days,
        }),
      };
    }
    const reason = {
      needs_two_readings: t("app.fleet.costPerKmNeedsReadings", "Needs two odometer readings"),
      readings_too_close: t(
        "app.fleet.costPerKmTooClose",
        "Needs two odometer readings at least {days} days apart",
        { days: COST_PER_KM_MIN_DAYS },
      ),
      no_distance: t("app.fleet.costPerKmNoDistance", "The readings show no distance driven"),
      asset_missing: t("app.fleet.costPerKmNoAsset", "Needs the asset record behind this vehicle"),
    }[cost.costPerKmReason];
    return { value: null, detail: reason || t("app.fleet.costPerKmNeedsReadings", "Needs two odometer readings") };
  })();

  const rows = [
    [t("app.fleet.expensesThisMonth", "Expenses this month"), money(cost.expensesThisMonth)],
    [t("app.fleet.expensesYear", "Expenses, last 12 months"), money(cost.expensesLast12Months)],
    [t("app.fleet.maintenanceYear", "Maintenance, last 12 months"), money(cost.maintenanceLast12Months)],
    [
      t("app.fleet.depreciationYear", "Depreciation, last 12 months"),
      cost.depreciationLast12Months === null
        ? t("app.fleet.notRecorded", "Not recorded")
        : money(cost.depreciationLast12Months),
    ],
    [
      t("app.fleet.totalYear", "Total cost of ownership, last 12 months"),
      cost.totalLast12Months === null
        ? t("app.fleet.notRecorded", "Not recorded")
        : money(cost.totalLast12Months),
      true,
    ],
  ];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground">
          {t("app.fleet.costTitle", "Running costs")}
        </p>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-xs">
          {rows.map(([label, value, bold]) => (
            <div key={label} className="contents">
              <dt className={bold ? "text-foreground font-semibold" : "text-muted-foreground"}>
                {label}
              </dt>
              <dd className={`text-right ${bold ? "text-foreground font-semibold" : "text-foreground"}`}>
                {value}
              </dd>
            </div>
          ))}
          <dt className="text-muted-foreground">{t("app.fleet.costPerKm", "Cost per km")}</dt>
          <dd className="text-right text-foreground">
            {perKmLine.value ?? (
              <span className="text-muted-foreground">{perKmLine.detail}</span>
            )}
            {perKmLine.value && (
              <span className="block text-[11px] text-muted-foreground">{perKmLine.detail}</span>
            )}
          </dd>
        </dl>
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Fuel size={13} /> {t("app.fleet.expenses", "Expenses")}
          <span className="font-normal text-muted-foreground">
            {" · "}
            {t("app.fleet.expensesMonthTotal", "{amount} this month", {
              amount: money(cost.expensesThisMonth),
            })}
          </span>
        </p>
        {(expenses || []).length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "app.fleet.noExpenses",
              "No expenses tagged to this vehicle in the last 12 months.",
            )}{" "}
            {t(
              "app.fleet.expensesHint",
              "Pick the vehicle when recording fuel, tolls or repairs under Settings → Expense tracking.",
            )}
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-2 text-xs">
                <span className="min-w-0">
                  <span className="text-foreground">{formatDate(e.date, language)}</span>{" "}
                  <span className="text-muted-foreground">
                    {e.category}
                    {e.vendorName ? ` — ${e.vendorName}` : ""}
                    {e.notes ? ` · ${e.notes}` : ""}
                  </span>
                </span>
                <span className="text-foreground shrink-0">{money(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
