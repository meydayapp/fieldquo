"use client";

// app/components/dashboard/HeroRevenue.js
//
// The one figure the page is built around, and the series beside it.
//
// ══ Two measures, side by side, each wearing its own name ═══════════════════
//
// This card holds TWO numbers about money, and the whole design of it is that
// they are never mixed:
//
//   left    REVENUE THIS MONTH — the total of invoices whose status is `paid`
//           this month. /api/analytics/overview's own measure, unchanged from
//           the tile it replaces.
//
//   right   MONEY RECEIVED — Payment rows, by the month the money landed.
//           /api/analytics/receivables' own measure, and the only monthly
//           revenue series that exists in this codebase.
//
// They are different questions and they will disagree — an invoice marked paid
// in August against a payment recorded in July disagrees by design. The
// existing panel further down has said so in its caption since it was built.
// Putting them in one card labelled separately is the opposite of conflating
// them: it is the arrangement where a reader can see both names at once.
//
// ══ Why the big figure carries no delta ═════════════════════════════════════
//
// Because there is no prior for it. lib/analytics/overview.js computes last
// month's ACCEPTED and SENT quote counts, for the conversion comparison, and
// no prior revenue at all — so nothing on the wire can support "▲ $3,110 on
// August" for this figure. `Delta` renders nothing for a null and that is what
// happens here: the number stands on its own rather than next to an invented
// trend, a zero, or a dash that reads as flat.
//
// The comparison that IS real — last complete month against the one before it,
// on the received-money measure — is stated in words on the right, by the
// sentence app/app/page.js builds. Two complete months, never a part-month
// against a whole one, which would manufacture a collapse on the 2nd of every
// month. See lib/analytics/receivables.js's buildRevenueTrend.

import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { Figure, FigureText } from "./Figure";
import Delta from "./Delta";
import { CARD } from "./surface";

/**
 * The received-money series as one line.
 *
 * Renders nothing when every month is zero: a flat line along the axis is a
 * drawing of a fact nobody stated, and the panel below already has the
 * sentence for that case. Same rule the bar chart keeps — a month with nothing
 * in it gets no bar.
 *
 * `preserveAspectRatio="none"` stretches the box to the card's width, which is
 * what makes this readable on a phone; `vector-effect` keeps the stroke one
 * real pixel through that stretch instead of a smeared wedge.
 */
function Sparkline({ series, label }) {
  const points = (series || []).filter((s) => Number.isFinite(Number(s?.amount)));
  if (points.length < 2) return null;
  const max = Math.max(...points.map((s) => Number(s.amount)));
  if (!(max > 0)) return null;

  const W = 100;
  const H = 30;
  const step = W / (points.length - 1);
  const path = points
    .map((s, i) => {
      const x = i * step;
      // 1px of headroom top and bottom so the peak and the axis are not
      // clipped by the viewBox edge.
      const y = H - 1 - (Number(s.amount) / max) * (H - 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="mt-2 w-full h-10 text-primary"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * @param hero           lib/dashboard/rank.js's `hero`
 * @param trendSentence  the month-on-month sentence as a rendered element,
 *                       built in app/app/page.js — the key and its English
 *                       fallback live there because that is the file the
 *                       panel's own guard (scripts/check-dashboard.mjs
 *                       section 6) reads. Null when there is no honest
 *                       comparison, and null renders nothing.
 * @param monthLabels    [firstMonth, lastMonth] as short labels, for the axis
 */
export default function HeroRevenue({ hero, trendSentence, monthLabels, t }) {
  if (!hero?.known) return null;

  const received = hero.received;

  return (
    <div className={`${CARD} p-5 sm:p-6`}>
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingUp size={16} className="shrink-0" aria-hidden="true" />
            {t("app.dash.revenueThisMonth", "Revenue this month")}
          </div>
          {/* `hero.currency` comes from the receivables payload. A member with
              showPricing who is nonetheless refused the invoice list has no
              currency on the wire, and formatMoney falls back to the company
              default rather than throwing — the same fallback the tile this
              replaces made implicitly by hard-coding a "$". */}
          <Figure className="block text-3xl sm:text-5xl font-bold text-foreground mt-2 leading-none break-words">
            {formatMoney(hero.amount, hero.currency)}
          </Figure>
          <Delta delta={hero.delta} kind="money" currency={hero.currency} t={t} />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("app.dash.hero.caption", "The total of invoices marked paid this month.")}
          </p>
        </div>

        {received && (
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("app.dash.revenue.title", "Money received")}
              </h2>
              <Link
                href="#money-received"
                className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"
              >
                {t("app.dash.hero.trendLink", "Trend")}
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
            <Sparkline
              series={received.series}
              label={t("app.dash.revenue.title", "Money received")}
            />
            {monthLabels && (
              <FigureText
                as="div"
                className="flex justify-between text-[10px] text-muted-foreground"
              >
                <span>{monthLabels[0]}</span>
                <span>{monthLabels[1]}</span>
              </FigureText>
            )}
            {/* Already an element, already wrapped in <FigureText> by the page
                that builds it — see the note on `trendSentence` there. */}
            {trendSentence}
          </div>
        )}
      </div>
    </div>
  );
}
