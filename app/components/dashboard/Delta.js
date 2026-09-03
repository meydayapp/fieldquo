"use client";

// app/components/dashboard/Delta.js
//
// The change beside a figure — or nothing at all.
//
// ══ The rule this component exists to enforce ═══════════════════════════════
//
// Never invent a comparison. `delta` is a lib/analytics/trend.js `compare()`
// result, and compare() returns null the moment there is no honest prior: no
// prior period, an unreadable prior, a prior that was never computed. When it
// is null this renders NOTHING — not a zero, not an em dash styled as a
// change, not a grey "—" that reads at a glance as "flat". A dash in the slot
// where a trend goes is a claim; an empty slot is not.
//
// A percentage of a zero prior is also refused, upstream: compare() sets
// `deltaPct` to null when the prior is 0, because "up from nothing" has no
// percentage and ∞% is worse than an absence. This component therefore prints
// the ABSOLUTE change and never the percentage — the absolute is always
// defined when a comparison exists at all, and "$3,110 more than last month"
// is the sentence a contractor can check against their own bank.
//
// ── Why the arrow carries no colour ────────────────────────────────────────
//
// Up is not good. Up on "money owed" is worse, up on "quotes sent" is better,
// and a component that painted one green would be making that judgement for
// every figure it is ever reused on. The arrow states the direction and stops,
// exactly as the trend sentence on the revenue panel states the change and
// refuses to add advice.

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { FigureText } from "./Figure";

const ICON = { up: ArrowUp, down: ArrowDown, flat: Minus };

/**
 * @param delta     compare() result, or null — null renders nothing
 * @param kind      "money" (deltaAbs is currency), "count" (deltaAbs is a
 *                  plain number of things), or "points" (deltaAbs is a
 *                  fraction of 1, rendered as percentage points)
 * @param currency  required for kind="money"
 */
export default function Delta({ delta, kind = "money", currency, t }) {
  if (!delta) return null;

  const Icon = ICON[delta.direction] || Minus;

  if (delta.direction === "flat") {
    return (
      <FigureText
        as="div"
        className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Icon size={12} className="shrink-0" aria-hidden="true" />
        {t("app.dash.delta.flat", "About the same as last month.")}
      </FigureText>
    );
  }

  const up = delta.direction === "up";

  if (kind === "points") {
    // Percentage POINTS, not a percentage of a percentage. A rate that moved
    // from 31% to 36% went up five points; calling that "up 16%" is true of
    // the ratio and read by everybody as five.
    const points = Math.abs(Math.round(delta.deltaAbs * 100));
    return (
      <FigureText
        as="div"
        className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Icon size={12} className="shrink-0" aria-hidden="true" />
        {up
          ? t("app.dash.delta.pointsUp", "{points} points higher than last month.", {
              points,
            })
          : t("app.dash.delta.pointsDown", "{points} points lower than last month.", {
              points,
            })}
      </FigureText>
    );
  }

  if (kind === "count") {
    // A count is not money. This branch exists rather than being left to fall
    // through to the currency one because `quotesSent` already computes a
    // delta in lib/dashboard/rank.js — it is null today, since the overview
    // payload carries no prior count, and the day it carries one this must
    // print "3 more" and not "$3.00 more".
    const count = Math.abs(Math.round(delta.deltaAbs));
    return (
      <FigureText
        as="div"
        className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Icon size={12} className="shrink-0" aria-hidden="true" />
        {up
          ? t("app.dash.delta.countUp", "{count} more than last month.", { count })
          : t("app.dash.delta.countDown", "{count} fewer than last month.", { count })}
      </FigureText>
    );
  }

  // formatMoney is called INSIDE the FigureText rather than into a const above
  // it, so the figure and the class that shapes its digits cannot be separated
  // — see scripts/check-dashboard-rank.mjs section 8, which enforces exactly
  // that on every file that renders money on this page.
  return (
    <FigureText
      as="div"
      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
    >
      <Icon size={12} className="shrink-0" aria-hidden="true" />
      {up
        ? t("app.dash.delta.moneyUp", "{amount} more than last month.", {
            amount: formatMoney(Math.abs(delta.deltaAbs), currency),
          })
        : t("app.dash.delta.moneyDown", "{amount} less than last month.", {
            amount: formatMoney(Math.abs(delta.deltaAbs), currency),
          })}
    </FigureText>
  );
}
