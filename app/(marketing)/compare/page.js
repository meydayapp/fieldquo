// app/(marketing)/compare/page.js
//
// The index of /compare.
//
// ══ Why the summary on each card is computed, not written ══════════════════
//
// The obvious version of this page is four cards with a sentence typed under
// each: "Jobber — three prices compared". It would be wrong within a quarter.
// Whether a competitor's figure publishes is decided by withholdReason against
// a date, and that answer moves on its own: an unresolved question settled in
// competitors.js adds rows, and ninety days without a re-check removes them.
// A hand-written count is AGENTS.md failure class 4 — the copy nobody looks at
// when the data changes — attached to a claim about somebody else's prices.
//
// So each card counts what its own page will actually be able to show, at the
// same asOf the page itself renders at. If Jobber's annual rows ever publish,
// the number here goes up without anybody editing this file; if Housecall
// Pro's read goes stale, it drops to zero and the card says so.
//
// ══ Why the concessions are on the index too ═══════════════════════════════
//
// They are on every individual page, above the comparison. Putting them here
// as well is not duplication for its own sake: this is the page that gets
// linked, and a visitor who reads only the index should still leave knowing
// there is no phone app.

import Link from "next/link";
import { ArrowRight, X as XIcon } from "lucide-react";

import { marketingMetadata } from "@/lib/marketing/metadata";
import {
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  PRICE_AMOUNT,
  PRICE_ON_REQUEST,
  competitor as findCompetitor,
  withholdReason,
} from "@/lib/marketing/competitors";

import { renderAsOf } from "./asOf";
import { COMPARE_CHROME, COMPARE_PAGES } from "./compareCopy";

export const metadata = marketingMetadata({
  path: "/compare",
  title: `${COMPARE_CHROME.indexMetaTitle} | FieldQuo`,
  description: COMPARE_CHROME.indexMetaDescription,
});

/**
 * What one card can honestly promise, derived from the data at `asOf`.
 *
 * Returns sentences rather than counts so the caller cannot assemble a
 * different claim out of the same numbers. Every branch is reachable with the
 * data as it stands today: Housecall Pro has amounts, ServiceTitan has only
 * request-a-price tiers, Projul has neither, and Jobber has both amounts and a
 * large withheld pile.
 */
export function comparisonSummary(competitor, asOf) {
  const published = competitor.figures.filter((f) => withholdReason(f, asOf) === null);
  const amounts = published.filter((f) => f.price?.kind === PRICE_AMOUNT);
  const onRequest = published.filter((f) => f.price?.kind === PRICE_ON_REQUEST);
  const withheldCount = competitor.figures.length - published.length;

  const lines = [];
  if (amounts.length > 0) {
    lines.push(
      `${amounts.length} of their published ${amounts.length === 1 ? "price" : "prices"} can be set beside ours, in the currency they print it in.`,
    );
  }
  if (onRequest.length > 0) {
    lines.push(
      `${onRequest.length} of their tiers publish no amount at all and ask you to request one.`,
    );
  }
  if (amounts.length === 0 && onRequest.length === 0) {
    lines.push("Nothing they publish can be compared with a FieldQuo price.");
  }
  if (withheldCount > 0) {
    lines.push(
      `${withheldCount} further ${withheldCount === 1 ? "figure is" : "figures are"} held back, each shown with the reason.`,
    );
  }
  return lines;
}

export default function CompareIndexPage() {
  // One asOf for the whole index, so four cards cannot disagree about what day
  // it is. See ./asOf.js for why it is the render moment.
  const asOf = renderAsOf();

  const cards = COMPARE_PAGES.map((page) => ({
    page,
    competitor: findCompetitor(page.competitorId),
  })).filter((c) => c.competitor);

  return (
    <div>
      <div className="bg-muted border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {COMPARE_CHROME.eyebrow}
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            {COMPARE_CHROME.indexTitle}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">
            {COMPARE_CHROME.indexLede}
          </p>
          <p className="mt-4 text-sm text-muted-foreground" data-as-of={asOf}>
            Prepared as of {asOf}.
          </p>
        </div>
      </div>

      {/* The concessions, before the comparisons rather than under them. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          {COMPARE_CHROME.concessionTitle}
        </h2>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          {COMPARE_CHROME.concessionIntro}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {FIELDQUO_LACKS.map((capability) => (
            <div
              key={capability}
              data-lacks={capability}
              className="bg-card border border-border rounded-xl p-5 flex items-start gap-2"
            >
              <XIcon size={18} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-semibold text-foreground">
                {FIELDQUO_CAPABILITIES[capability].label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-muted border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map(({ page, competitor }) => (
              <Link
                key={page.slug}
                href={`/compare/${page.slug}`}
                data-compare-slug={page.slug}
                className="block bg-card border border-border rounded-xl p-6 hover:border-foreground/20"
              >
                <h2 className="text-xl font-bold text-foreground">
                  FieldQuo vs {competitor.name}
                </h2>
                <ul className="mt-3 space-y-1">
                  {comparisonSummary(competitor, asOf).map((line) => (
                    <li key={line} className="text-sm text-muted-foreground">
                      {line}
                    </li>
                  ))}
                </ul>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                  Read the comparison <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-border bg-card p-5 max-w-3xl">
            <h2 className="text-sm font-semibold text-foreground">
              {COMPARE_CHROME.rulesTitle}
            </h2>
            <ul className="mt-3 space-y-2">
              {COMPARE_CHROME.rules.map((rule) => (
                <li key={rule} className="text-sm text-muted-foreground">
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {COMPARE_CHROME.ctaTitle}
          </h2>
          <p className="mt-3 text-white/90">{COMPARE_CHROME.ctaBody}</p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-muted"
          >
            {COMPARE_CHROME.ctaButton} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
