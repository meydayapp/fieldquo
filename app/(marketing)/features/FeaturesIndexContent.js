// app/(marketing)/features/FeaturesIndexContent.js
//
// The index of /features/*, grouped the way lib/marketing/featureMatrix.js
// groups everything: win the work, do the job, get paid, run the business.
//
// Not "Quotes / Scheduling / Team / Analytics" — that is a list of our screens,
// and a contractor comparing three products is not shopping for screens. The
// matrix header makes the argument; this page just obeys it, and reads its
// group labels and blurbs from that file — through featureGroup(), so they
// arrive in the visitor's language rather than in English under a translated
// heading.
//
// Every card names how many of the matrix's proved claims sit behind it, which
// is the one number on this page that cannot be written by hand — it is the
// length of the page's own feature list.
//
// ══ Two ways in, because there are two visitors ════════════════════════════
//
// Somebody who has just read /pricing arrives holding a NAME — "sales tax that
// matches the address" — and wants that page, not the area it lives in. The
// directory at the top is that list, in the pricing page's own order, printed
// from the matrix so the two cannot come to disagree about what anything is
// called. Somebody who arrives cold is shopping for an area instead, and the
// group cards below are for them.
//
// Both point into one set of pages. See the header of app/data/featurePages.js
// for why there is no second URL for the same subject.
//
// Client component: the whole page is copy, and copy is t(). page.js keeps the
// metadata export, which cannot cross the boundary.
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import {
  FEATURE_PAGES,
  PRICING_FEATURES,
  featurePageCopy,
  featurePagesForGroup,
  pricingFeatureIndex,
} from "@/app/data/featurePages";
import { featureEntry, featureGroup } from "@/lib/marketing/featureLabels";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function FeaturesIndexContent() {
  const { t } = useTranslation();

  return (
    <div>
      <div className="bg-muted border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            {t("featuresIndex.title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            {t("featuresIndex.intro")}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold"
            >
              {t("featurePage.chrome.startTrial")} <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-card"
            >
              {t("featurePage.chrome.seePricing")}
            </Link>
          </div>
        </div>
      </div>

      {/* The directory: everything the pricing page names, each with the page
          about it. Printed from the matrix, in the pricing page's own order. */}
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-foreground">
            {t("featuresIndex.directoryTitle", { count: PRICING_FEATURES.length })}
          </h2>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            {t("featuresIndex.directoryBody")}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {pricingFeatureIndex().map(({ key, slug }) => {
              // Through the label layer, never off the matrix entry directly.
              const entry = featureEntry(key, t);
              return (
                <Link
                  key={key}
                  href={`/features/${slug}`}
                  className="block border border-border rounded-xl p-4 bg-card hover:border-primary"
                >
                  <span className="font-semibold text-foreground">
                    {entry.name}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {entry.summary}
                  </span>
                  {entry.readiness === "partial" && (
                    <span className="mt-2 inline-block text-xs font-semibold text-foreground border border-border rounded-full px-2 py-0.5">
                      {t("featuresIndex.partlyBuilt")}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t("featuresIndex.byAreaTitle")}
          </h2>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            {t("featuresIndex.byAreaBody")}
          </p>
        </div>

        {MATRIX_GROUPS.map((group) => {
          const pages = featurePagesForGroup(group.key);
          if (!pages.length) return null;
          const said = featureGroup(group.key, t);

          return (
            <section key={group.key}>
              <h2 className="text-2xl font-bold text-foreground">
                {said.label}
              </h2>
              <p className="mt-2 text-muted-foreground max-w-2xl">
                {said.blurb}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {pages.map((page) => {
                  const copy = featurePageCopy(page.slug, t);
                  return (
                    <Link
                      key={page.slug}
                      href={`/features/${page.slug}`}
                      className="block border border-border rounded-xl p-5 bg-card hover:border-primary"
                    >
                      <h3 className="font-semibold text-foreground">
                        {copy.label}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {copy.oneLine}
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {page.features.length === 1
                          ? t("featuresIndex.featureCountOne")
                          : t("featuresIndex.featureCountMany", {
                              count: page.features.length,
                            })}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="bg-card border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <p className="text-muted-foreground">
            {t("featuresIndex.closing", { count: FEATURE_PAGES.length })}
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-muted"
          >
            {t("featuresIndex.askUs")}
          </Link>
        </div>
      </div>
    </div>
  );
}
