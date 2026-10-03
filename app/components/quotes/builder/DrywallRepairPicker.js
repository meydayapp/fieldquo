// app/components/quotes/builder/DrywallRepairPicker.js
//
// The drywall group's Repairs panel: fixed-price repair items — small,
// medium and large patch, sheet replacement, texture match, and the rest of
// the repair book — each added as ONE ordinary line at the company's own
// price. lib/quotes/drywallRepairs.js holds every rule; this file draws it.
//
// No geometry, on purpose (owner, 2026-10-03: "drywall repairs are not the
// room calculator"). The tier select only decides which column of the rate
// card the NEXT pick prices from; a line already added keeps the rate it was
// written with, and is edited in the table like any other line.
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  drywallRepairItems,
  drywallRepairLine,
  drywallCallOutMinimum,
  drywallRepairShortfall,
  drywallMinimumLine,
  repairItemText,
} from "@/lib/quotes/drywallRepairs";
import { DRYWALL_TIERS } from "@/app/data/drywallFinishLevels";

export default function DrywallRepairPicker({ book, lineItems = [], language = "en", money, t, onAdd }) {
  const [tier, setTier] = useState("standard");
  const items = drywallRepairItems(book, tier);
  if (!items.length) return null;
  const { total, minimum, shortfall } = drywallRepairShortfall(lineItems, drywallCallOutMinimum(book, tier));
  const tierWord = {
    standard: t("app.drywallRepair.tier.standard", "Standard"),
    moderate: t("app.drywallRepair.tier.moderate", "Moderate"),
    high: t("app.drywallRepair.tier.high", "High"),
  };

  return (
    <div className="rounded-lg border border-border p-3" data-drywall-repairs>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.drywallRepair.title", "Repairs — fixed prices")}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("app.drywallRepair.priceAt", "Price at")}
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="border border-border rounded px-1.5 py-0.5 text-xs bg-background"
          >
            {DRYWALL_TIERS.map((k) => (
              <option key={k} value={k}>
                {tierWord[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {t(
          "app.drywallRepair.hint",
          "Each repair is added as one line at your price from Settings › Services. Change the quantity or the price in the table below.",
        )}
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-drywall-repair={item.id}
            onClick={() => {
              const line = drywallRepairLine(item, { language });
              if (line) onAdd(line);
            }}
            className="flex items-start justify-between gap-2 rounded border border-border px-2.5 py-1.5 text-left text-sm hover:bg-accent"
          >
            <span className="min-w-0">
              <Plus size={12} className="inline mr-1 align-[-1px] text-muted-foreground" />
              {repairItemText(item.id, language) || item.label}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {money(item.rate)}
              {item.unit && item.unit !== "flat" && item.unit !== "each" ? ` / ${item.unit}` : ""}
            </span>
          </button>
        ))}
      </div>
      {shortfall > 0 && (
        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground" data-drywall-minimum>
          <span>
            {t(
              "app.drywallRepair.belowMinimum",
              "These repairs come to {total}, under your {minimum} call-out minimum.",
              { total: money(total), minimum: money(minimum) },
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              const line = drywallMinimumLine(shortfall, { language });
              if (line) onAdd(line);
            }}
            className="underline hover:text-foreground"
          >
            {t("app.drywallRepair.addMinimum", "Add the difference ({amount})", { amount: money(shortfall) })}
          </button>
        </div>
      )}
    </div>
  );
}
