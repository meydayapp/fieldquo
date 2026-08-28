// app/(marketing)/compare/asOf.js
//
// What day the /compare pages speak as of.
//
// ══ Why this file exists at all ════════════════════════════════════════════
//
// figureAgeDays, isStale, livePromo, withholdReason and comparableTier in
// lib/marketing/competitors.js all REQUIRE an explicit `asOf` and throw
// without one. That is not defensive coding, it is the module refusing to let
// a caller who does not know what day it is decide whether a competitor's
// price is still fresh. A statically rendered page has to answer that question
// somewhere, and answering it in four places is how two of them end up
// disagreeing. So it is answered here, once, and the answer has to defend
// itself.
//
// ══ Why the render moment, and not a date typed into the copy ══════════════
//
// The tempting alternative is a constant — AS_OF = "2026-08-28", the day
// somebody last read the four pricing pages — and it is wrong in a way that
// takes a year to show up. STALE_AFTER_DAYS exists so a figure stops
// publishing itself 90 days after it was last checked, and withholdReason is
// described in competitors.js as "what actually keeps it off the page". Pin
// the date and that clock never advances: the page would still be printing
// Housecall Pro's $59 in 2029, under a line correctly stating it was read in
// 2026. Pinning is not a rendering preference, it is switching off the
// module's only automatic defence and leaving the label on.
//
// So asOf is the moment the page is RENDERED. These pages read no database and
// no request data, so Next prerenders them and in production that moment is
// the build — which is the pairing we want: the figures baked into the HTML
// and the date the HTML claims for them come out of one instant and cannot
// disagree with each other.
//
// The consequence is deliberate and is the whole point. A deploy 91 days after
// the last read renders every Housecall Pro row as "last checked 91 days ago"
// with no number beside it, instead of as a price. The page degrades into an
// admission rather than into a stale claim about somebody else's business.
// That is loud — a marketing page that has emptied itself gets noticed and
// re-checked, which a quietly rotting number never does.
//
// ══ Why it is printed on the page ══════════════════════════════════════════
//
// A static page cannot say "today", so it says which day it was speaking as
// of, beside each figure's own checked date. A reader who wants to know
// whether anything has moved since has both dates and the competitor's own
// URL, and needs nothing from us to find out.

/**
 * The date the /compare pages speak as of — ISO yyyy-mm-dd, UTC.
 *
 * UTC rather than the builder's local zone so two machines building the same
 * commit an hour apart produce the same HTML. A day either way is nothing
 * against a 90-day window, but a render that differs by machine is a render
 * nobody can check.
 *
 * `now` is a parameter so the check script can render these pages at a date
 * of its choosing and watch the staleness path actually fire, rather than
 * asserting that it would.
 */
export function renderAsOf(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
