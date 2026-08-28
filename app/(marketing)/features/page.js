// app/(marketing)/features/page.js
//
// The index of /features/*, grouped the way lib/marketing/featureMatrix.js
// groups everything: win the work, do the job, get paid, run the business.
//
// Not "Quotes / Scheduling / Team / Analytics" — that is a list of our screens,
// and a contractor comparing three products is not shopping for screens. The
// matrix header makes the argument; this page just obeys it, and reads its
// group labels and blurbs from that file so the two can never disagree.
//
// Every card names how many of the matrix's proved claims sit behind it, which
// is the one number on this page that cannot be written by hand — it is the
// length of the page's own feature list.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import { FEATURE_PAGES, featurePagesForGroup } from "@/app/data/featurePages";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  path: "/features",
  title: "Everything FieldQuo does — FieldQuo",
  description:
    "Quoting, booking, scheduling, job costing, invoicing, payments and payroll for field-service contractors. Every feature listed, with the limits stated where there are any.",
});

export default function FeaturesIndexPage() {
  return (
    <div>
      <div className="bg-muted border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            Everything FieldQuo does
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Grouped the way the work happens: win it, do it, get paid for it,
            and run the business that does all three. Where something is only
            partly built, its page says so rather than showing you a tick.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold"
            >
              Start your free month <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-card"
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        {MATRIX_GROUPS.map((group) => {
          const pages = featurePagesForGroup(group.key);
          if (!pages.length) return null;

          return (
            <section key={group.key}>
              <h2 className="text-2xl font-bold text-foreground">
                {group.label}
              </h2>
              <p className="mt-2 text-muted-foreground max-w-2xl">
                {group.blurb}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {pages.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/features/${page.slug}`}
                    className="block border border-border rounded-xl p-5 bg-card hover:border-primary"
                  >
                    <h3 className="font-semibold text-foreground">
                      {page.label}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {page.oneLine}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {page.features.length === 1
                        ? "1 feature"
                        : `${page.features.length} features`}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="bg-card border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <p className="text-muted-foreground">
            {FEATURE_PAGES.length} pages, and every claim on them points at code
            that exists — a build check fails if one stops being true.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-muted"
          >
            Ask us about something you do not see
          </Link>
        </div>
      </div>
    </div>
  );
}
