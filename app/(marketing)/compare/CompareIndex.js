// app/(marketing)/compare/CompareIndex.js
//
// The index of /compare, rendered.
//
// ══ Why this is the client half ════════════════════════════════════════════
//
// Same split as /pricing and /industries/[slug], and for the same reason: the
// copy comes from the t() catalogue and translation lives in React context,
// while `metadata` has to be exported from a server module. The alternative
// was a second language mechanism for these pages alone — reading a cookie on
// the server, say — and two mechanisms is how a visitor gets a Spanish header
// above an English page, which is the bug this whole change is fixing.
//
// The `asOf` moment is computed HERE rather than passed from the server. It is
// the render moment either way (see ./asOf.js), and taking it in the browser
// means the staleness window keeps advancing on a page Next has cached, rather
// than freezing at the last deploy.
//
// ══ Why the concessions are on the index too ═══════════════════════════════
//
// They are on every individual page, above the comparison. Putting them here
// as well is not duplication for its own sake: this is the page that gets
// linked, and a visitor who reads only the index should still leave knowing
// there is no phone app.
"use client";

import Link from "next/link";
import { ArrowRight, X as XIcon } from "lucide-react";

import { FIELDQUO_LACKS, competitor as findCompetitor } from "@/lib/marketing/competitors";
import { capabilityLabel } from "@/lib/marketing/compareLabels";
import { useTranslation } from "@/app/hooks/useTranslation";

import { renderAsOf } from "./asOf";
import { COMPARE_PAGES, compareChrome } from "./compareCopy";
import { comparisonSummary } from "./summary";

export default function CompareIndex({ asOf = renderAsOf() }) {
  const { t } = useTranslation();
  const chrome = compareChrome(t);

  const cards = COMPARE_PAGES.map((page) => ({
    page,
    competitor: findCompetitor(page.competitorId),
  })).filter((c) => c.competitor);

  return (
    <div>
      <div className="bg-muted border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {chrome.eyebrow}
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            {chrome.indexTitle}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">
            {chrome.indexLede}
          </p>
          <p className="mt-4 text-sm text-muted-foreground" data-as-of={asOf}>
            {t("compare.preparedAsOf", "Prepared as of {date}.", { date: asOf })}
          </p>
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
                {/* The competitor's name is never translated — it is a
                    trademark, and "FieldQuo vs Jobber" is the phrase somebody
                    typed into a search box to get here. Only the "vs" carries
                    a language. */}
                <h2 className="text-xl font-bold text-foreground">
                  {t("compare.vs", "FieldQuo vs {competitor}", {
                    competitor: competitor.name,
                  })}
                </h2>
                <ul className="mt-3 space-y-1">
                  {comparisonSummary(competitor, asOf, t).map((line) => (
                    <li key={line} className="text-sm text-muted-foreground">
                      {line}
                    </li>
                  ))}
                </ul>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                  {t("compare.readComparison", "Read the comparison")}{" "}
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>

          {/* ── The concessions, kept and moved below the comparisons ──────
              This opened the index. The owner read it and said so: the first
              thing on a comparison page should not be what we do not do.

              Including them is still right — a page of only our wins is an
              advertisement, and a contractor who buys on it and then goes
              looking for the phone app is a refund plus a review. Leading with
              them was not. They sit under the comparisons now: a reader who has
              seen the case gets the caveat, rather than a stranger meeting our
              weaknesses first.

              Still driven by FIELDQUO_LACKS, so a gap cannot be quietly dropped
              from the page to make it read better. The label is resolved through
              lib/marketing/compareLabels.js so it speaks the page's language
              without the capability ledger having to hold nine copies of a
              sentence its checks assert against in English. */}
          {/* No max-w/mx-auto/px of its own: this block sits INSIDE the
              max-w-6xl px-4 container that holds the comparison cards, and
              carrying a second copy of that container indented the whole
              section 16px relative to the cards above it — measured at 375px,
              cards at x=16 and this heading at x=32. */}
          <div className="py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              {chrome.concessionTitle}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-3xl">
              {chrome.concessionIntro}
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
                    {capabilityLabel(capability, t)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-border bg-card p-5 max-w-3xl">
            <h2 className="text-sm font-semibold text-foreground">
              {chrome.rulesTitle}
            </h2>
            <ul className="mt-3 space-y-2">
              {chrome.rules.map((rule) => (
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
            {chrome.ctaTitle}
          </h2>
          <p className="mt-3 text-white/90">{chrome.ctaBody}</p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-muted"
          >
            {chrome.ctaButton} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
