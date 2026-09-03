"use client";

// app/components/dashboard/Figure.js
//
// Every number on the dashboard, wearing tabular figures.
//
// ══ Why this is a component and not a class somebody remembers to type ══════
//
// Proportional digits have different widths — a 1 is narrower than a 0 in
// almost every UI face, Geist included. In a column of money that means the
// decimal point wanders from row to row, and a contractor comparing six
// outstanding invoices down a list has to read each figure instead of seeing
// the shape of the column. `font-variant-numeric: tabular-nums` fixes it for
// the cost of one CSS declaration, and it was on 67 files elsewhere in this
// app and on exactly none of the dashboard.
//
// A shared component rather than a remembered class because the class is the
// thing that gets forgotten on the next figure added. `Figure` and `FigureText`
// are the only two places tabular-nums is written on this surface, and
// scripts/check-dashboard-rank.mjs asserts that every formatMoney() and
// toLocaleString() call on the dashboard sits inside one of them — so a figure
// added later cannot quietly arrive with proportional digits.
//
// ── Two of them, because a figure is not always alone ──────────────────────
//
// `Figure` is a standalone number: a tile's value, an amount at the end of a
// row. `FigureText` is a SENTENCE with a number interpolated into it — "{amount}
// of that is past due", "{days} days past due" — where the number cannot be
// given an element of its own without breaking the translation. Same
// declaration, different element, and the second is why the rule can be
// "inside one of these two" rather than "wrapped in a span".

/**
 * A standalone figure.
 *
 * Renders a <span>, so it can sit inside a heading, a cell or a paragraph
 * without changing the layout around it.
 */
export function Figure({ className = "", children, title }) {
  return (
    <span className={`tabular-nums ${className}`} title={title}>
      {children}
    </span>
  );
}

/**
 * A line of text that contains a figure.
 *
 * `as` defaults to <p> because most of these are captions; pass "div" or "span"
 * where a paragraph would be wrong.
 */
export function FigureText({ as: Tag = "p", className = "", children }) {
  return <Tag className={`tabular-nums ${className}`}>{children}</Tag>;
}
