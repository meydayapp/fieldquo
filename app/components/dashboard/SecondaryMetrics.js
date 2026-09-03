"use client";

// app/components/dashboard/SecondaryMetrics.js
//
// The four figures that sit under the hero: quotes sent, conversion, money
// owed, booked ahead. A 2×2 on every width, including a phone — four tiles in
// a row on a 375px screen is four figures nobody can read, and one column of
// four is a scroll to reach the fourth.
//
// ══ Each tile can be ABSENT, and absence is the point ═══════════════════════
//
// `known: false` means the endpoint behind that figure refused this member or
// has not answered. It renders as nothing — no tile, no zero. "$0 owed" to a
// crew member who was refused the receivables endpoint is not a missing
// figure, it is a false statement about the business, and it is the exact bug
// the comment at the top of app/app/page.js was written about.
//
// So the grid is built from the tiles that HAVE a figure. A member with
// showPricing off sees one tile (booked ahead) rather than four, three of them
// reading zero.
//
// ══ Every figure goes through <Figure> ══════════════════════════════════════
//
// Which is where `tabular-nums` lives. See Figure.js for why that matters in a
// column of money, and scripts/check-dashboard-rank.mjs for the assertion that
// keeps it true of figures added later.

import Link from "next/link";
import { CalendarClock, FileText, Percent, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { Figure, FigureText } from "./Figure";
import Delta from "./Delta";
import { CARD } from "./surface";

const ICONS = {
  quotesSent: FileText,
  conversion: Percent,
  owed: Wallet,
  booked: CalendarClock,
};

const LABELS = {
  quotesSent: ["app.dash.quotesSent", "Quotes sent this month"],
  conversion: ["app.dash.conversionRate", "Conversion rate"],
  owed: ["app.dash.owed.title", "Money owed"],
  booked: ["app.dash.upcomingVisits", "Upcoming visits"],
};

const HREFS = {
  quotesSent: "/app/quotes",
  conversion: "/app/quotes",
  owed: "/app/invoices",
  booked: "/app/appointments",
};

function Tile({ id, t, children }) {
  const Icon = ICONS[id];
  return (
    <Link
      href={HREFS[id]}
      className={`${CARD} p-4 sm:p-5 block hover:bg-muted transition-colors`}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
        <Icon size={15} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{t(...LABELS[id])}</span>
      </div>
      {children}
    </Link>
  );
}

const VALUE = "block text-lg sm:text-2xl font-bold text-foreground mt-2 leading-tight";
const CAPTION = "mt-1 text-xs text-muted-foreground";
// Two of the three "money owed" states are a SENTENCE, not a figure. They get
// sentence type rather than a 24px number, because "No invoices yet" set as a
// headline reads as a value.
const SENTENCE = "mt-2 text-sm text-muted-foreground";

/**
 * The conversion tile, which is the one with a rule attached.
 *
 * Above the floor: the percentage AND the counts it came from, together. A
 * rate with no denominator beside it is a number a reader has to trust rather
 * than check.
 *
 * Below the floor: the counts and NO percentage. Not a greyed percentage, not
 * one with a footnote — none. The floor is lib/analytics/winLoss.js's
 * SAMPLE_FLOOR, imported through lib/dashboard/rank.js rather than typed here,
 * and its argument is that under ten decided quotes one of them flipping moves
 * the rate by more than ten points, which is a bigger swing than anybody would
 * act on.
 */
function Conversion({ metric, t }) {
  if (metric.belowFloor || metric.percent == null) {
    return (
      <>
        <Figure className={VALUE}>
          {t("app.dash.conversion.sample", "{accepted} of {sent}", {
            accepted: metric.accepted,
            sent: metric.sent,
          })}
        </Figure>
        <FigureText className={CAPTION}>
          {t(
            "app.dash.conversion.needsMore",
            "Quotes accepted. A rate needs {floor} sent in a month before it means anything.",
            { floor: metric.floor },
          )}
        </FigureText>
      </>
    );
  }

  return (
    <>
      <Figure className={VALUE}>{metric.percent}%</Figure>
      <FigureText className={CAPTION}>
        {t("app.dash.conversion.sample", "{accepted} of {sent}", {
          accepted: metric.accepted,
          sent: metric.sent,
        })}
        {" · "}
        {t("app.dash.conversionRateCaption", "% of sent quotes clients accepted")}
      </FigureText>
      <Delta delta={metric.delta} kind="points" t={t} />
    </>
  );
}

/**
 * Money owed. Three states, and none of them is "$0.00" — receivables.js
 * already separates "never billed anybody" from "everything is settled" from
 * "a real balance", and flattening that here would undo it.
 */
function Owed({ metric, t }) {
  if (metric.noInvoices) {
    return (
      <p className={SENTENCE}>
        {t("app.dash.owed.noInvoices", "No invoices yet, so nothing is owed to you.")}
      </p>
    );
  }
  if (metric.nothingOutstanding) {
    return (
      <p className={SENTENCE}>
        {t(
          "app.dash.owed.nothing",
          "Nothing outstanding — every invoice you have sent has been settled.",
        )}
      </p>
    );
  }
  return (
    <>
      <Figure className={VALUE}>{formatMoney(metric.amount, metric.currency)}</Figure>
      {metric.overdueCount > 0 && (
        <FigureText className="mt-1 text-xs text-destructive">
          {t("app.dash.owed.pastDue", "{amount} of that is past due.", {
            amount: formatMoney(metric.overdueAmount, metric.currency),
          })}
        </FigureText>
      )}
    </>
  );
}

export default function SecondaryMetrics({ metrics = [], t }) {
  const shown = metrics.filter((m) => m.known);
  if (shown.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {shown.map((m) => (
        <Tile key={m.id} id={m.id} t={t}>
          {m.id === "conversion" ? (
            <Conversion metric={m} t={t} />
          ) : m.id === "owed" ? (
            <Owed metric={m} t={t} />
          ) : (
            <>
              <Figure className={VALUE}>{m.value}</Figure>
              {/* No delta line here today: /api/analytics/overview sends no
                  prior-month count for quotes sent, and "booked ahead" has no
                  prior period at all. Delta renders nothing for a null, so
                  this is the honest absence rather than a special case — and
                  `kind="count"` is set now rather than later, so a prior that
                  arrives is printed as a number of quotes and not as money. */}
              <Delta delta={m.delta} kind="count" t={t} />
            </>
          )}
        </Tile>
      ))}
    </div>
  );
}
