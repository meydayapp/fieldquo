// app/components/dashboard/trendSentence.js
//
// The one comparison on the dashboard that is genuinely computable — last
// complete month's received money against the month before — and the month
// label the sparkline and the received-money chart print. Moved here from
// app/app/page.js (2026-09-25), unchanged, so the /signup side panel's
// dashboard sample renders the hero with the same sentence the dashboard
// renders instead of a copy of it.
//
// ── The change, stated and nothing more ────────────────────────────────────
//
// Key and English fallback together, so the sentence reads correctly before the
// catalogue entry lands rather than rendering "app.dash.revenue.down" at a
// contractor. Every one of these says WHAT MOVED and stops there — the
// competitor's "focus on new sales opportunities" is advice derived from one
// number, and a panel that dispenses it is trusted less on the figures too.
"use client";

import { FigureText } from "@/app/components/dashboard/Figure";
import { formatMoney } from "@/lib/currency";

export const TREND_SENTENCE = {
  up: [
    "app.dash.revenue.up",
    "{month}: {amount} — up {pct}% on {priorMonth}.",
  ],
  down: [
    "app.dash.revenue.down",
    "{month}: {amount} — down {pct}% on {priorMonth}.",
  ],
  flat: [
    "app.dash.revenue.flat",
    "{month}: {amount} — about the same as {priorMonth}.",
  ],
};

/** "2026-08" → "Aug 26", read on the UTC calendar the series was built on. */
export function monthLabel(key) {
  const [y, m] = String(key).split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * The hero's trend sentence for a receivables body, or null.
 *
 * buildRevenueTrend compares the last two COMPLETE months, so this is never
 * a part-month measured against a whole one — that would manufacture a
 * collapse on the 2nd of every month. `headline` is null when the window
 * holds fewer than two complete months, and this renders nothing for a null:
 * a first-month company gets the figure and no trend, never an invented one.
 *
 * Built as an ELEMENT rather than a string, so the money inside it is
 * wrapped by the same <FigureText> every other figure on the dashboard goes
 * through. A sentence assembled into a bare string and rendered somewhere
 * else is the one path by which a figure escapes the tabular digits —
 * scripts/check-dashboard-rank.mjs section 8 closes it.
 */
export function trendSentenceFor(money, t) {
  const h = money?.revenue?.headline;
  if (!h) return null;
  if (h.deltaPct === null) {
    return (
      <FigureText className="mt-2 text-xs text-foreground">
        {t(
          "app.dash.revenue.fromNothing",
          "{month}: {amount}. Nothing was received in {priorMonth}.",
          {
            month: monthLabel(h.month),
            amount: formatMoney(h.amount, money.currency),
            priorMonth: monthLabel(h.priorMonth),
          },
        )}
      </FigureText>
    );
  }
  return (
    <FigureText className="mt-2 text-xs text-foreground">
      {t(...(TREND_SENTENCE[h.direction] || TREND_SENTENCE.flat), {
        month: monthLabel(h.month),
        amount: formatMoney(h.amount, money.currency),
        pct: h.deltaPct,
        priorMonth: monthLabel(h.priorMonth),
      })}
    </FigureText>
  );
}

/** The sparkline's first and last month labels, or null for under two points. */
export function sparklineMonthsFor(received) {
  const series = received?.series;
  if (!Array.isArray(series) || series.length < 2) return null;
  return [monthLabel(series[0].month), monthLabel(series[series.length - 1].month)];
}
