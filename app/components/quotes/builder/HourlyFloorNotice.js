// app/components/quotes/builder/HourlyFloorNotice.js
//
// The hourly-floor WARNING (owner, 2026-10-03; lib/analytics/hourlyFloor.js).
//
// Mirrors how the per-job floor reaches a quote: the Cost & margin panel turns
// red ("losing money") and says where its overhead came from. This says the
// same for work billed by the hour — what the quote's hourly lines average, the
// floor, and every input behind the floor, naming the one that is FieldQuo's
// default. It never blocks the save and never touches a price: the estimator
// may have a reason (a loss-leader, a regular client), and the screen's job is
// that they price below cost knowingly.
//
// Three states, and nothing at all for a quote with no hourly line:
//   below    amber — the average, the floor, what it is short by, the inputs
//   at/above one quiet line — the floor, so the estimator sees it was checked
//   no hours a muted hint pointing at Settings → Overhead (no floor is invented)
"use client";

import { AlertTriangle } from "lucide-react";

export default function HourlyFloorNotice({ check, floor, needsHours, hasHourly, money, t }) {
  if (!hasHourly) return null;

  if (!floor) {
    if (!needsHours) return null;
    return (
      <p className="text-xs text-muted-foreground" data-hourly-floor="needs-hours">
        {t(
          "app.hourlyFloor.needsHours",
          "This quote bills by the hour. Set your billable hours a month on Settings → Overhead and FieldQuo will check these lines against your hourly floor.",
        )}{" "}
        <a href="/app/settings/overhead#capacity" className="underline">
          {t("app.hourlyFloor.setHours", "Set billable hours")}
        </a>
      </p>
    );
  }

  if (!check) return null;

  const inputs = t(
    "app.hourlyFloor.inputs",
    "Floor = {monthly} monthly costs (Settings → Overhead) ÷ {hours} billable hours a month (Settings → Overhead). No profit is included — FieldQuo's default, so this is break-even. Materials, and wages not on your Salaries list, are on top.",
    {
      monthly: money(floor.monthlyFixedCosts),
      hours: floor.billableHoursPerMonth,
    },
  );

  if (!check.below) {
    return (
      <p className="text-xs text-muted-foreground" data-hourly-floor="ok">
        {t("app.hourlyFloor.ok", "Hourly lines average {rate} an hour — at or above your hourly floor of {floor}.", {
          rate: money(check.rate),
          floor: money(check.floor),
        })}
      </p>
    );
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      data-hourly-floor="below"
    >
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        {t(
          "app.hourlyFloor.below",
          "Below your hourly floor: the {hours} h billed by the hour average {rate} an hour, under your floor of {floor} — {gap} short on this quote.",
          {
            hours: check.hours,
            rate: money(check.rate),
            floor: money(check.floor),
            gap: money(check.gapTotal),
          },
        )}
      </p>
      <p className="mt-1 text-xs">{inputs}</p>
      <p className="mt-1 text-xs">
        {t("app.hourlyFloor.notBlocked", "This is a warning only — the quote saves and sends at the price you set.")}
      </p>
    </div>
  );
}
