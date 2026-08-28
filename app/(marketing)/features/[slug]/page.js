// app/(marketing)/features/[slug]/page.js
//
// One marketing page per feature area, rendered from app/data/featurePages.js
// and — for every claim it makes — from lib/marketing/featureMatrix.js.
//
// ══ Why the claims are not written here ════════════════════════════════════
//
// The page's prose is copy. The feature list is not: each bullet prints the
// matrix's own `name` and `summary`, which scripts/check-feature-matrix.mjs has
// already proved against the route or library that implements it. So a feature
// that stops existing takes this page down with it, instead of leaving a
// sentence that reads as verified because it is on a public page.
//
// The same rule produces the honest bits. Where an entry is `partial`, its
// `limits` are rendered ON the page, in the customer's words, right under the
// summary — not in a footnote and not omitted. A general contractor reading
// "this only works when the sub is also on FieldQuo" and switching anyway is a
// customer; one who reads a tick and finds out in month two is a refund.
//
// ══ Server component, no translation context ═══════════════════════════════
//
// Deliberately NOT split into a client half the way /industries/[slug] is. That
// page is split because its copy lives in the t() catalogue and translation is
// React context. This copy is an English data module, following the precedent
// of app/data/productFeatures.js, so there is nothing to put behind a provider.
//
// The debt that creates is real and is written down rather than hidden: the
// rest of the marketing site renders in six languages and these pages do not.
// Moving them would mean ~24 pages × 5 languages of catalogue keys, and the
// honest sequencing is to settle the page set first and translate once, rather
// than translate a structure that is still moving. Same open question as the
// locale-prefixed routing note at the end of docs/ROADMAP.md.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Info, X as XIcon } from "lucide-react";
import {
  FEATURE_PAGES,
  featurePage,
  featuresOnPage,
} from "@/app/data/featurePages";
import { MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import { LANGUAGES } from "@/app/i18n/languages";
import { marketingMetadata } from "@/lib/marketing/metadata";

export function generateStaticParams() {
  return FEATURE_PAGES.map((p) => ({ slug: p.slug }));
}

// Next 16: params is a Promise. /product/[slug] shipped a version of this file
// that read it synchronously and 404'd every page it was meant to serve; the
// comment there records it. Awaited here for the same reason.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = featurePage(slug);
  if (!page) return {};

  return marketingMetadata({
    path: `/features/${slug}`,
    // Each page gets its own headline as the title. Two dozen tabs all reading
    // "FieldQuo" is two dozen pages competing for one query.
    title: `${page.headline} | FieldQuo`,
    description: page.description,
  });
}

function groupLabel(key) {
  return MATRIX_GROUPS.find((g) => g.key === key)?.label || "";
}

export default async function FeaturePage({ params }) {
  const { slug } = await params;
  const page = featurePage(slug);
  if (!page) return notFound();

  const features = featuresOnPage(slug);
  const partials = features.filter((f) => f.readiness === "partial");

  return (
    <div>
      {/* Hero */}
      <div className="bg-muted border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {groupLabel(page.group)}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight max-w-3xl">
            {page.headline}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            {page.oneLine}
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
          {/* Deliberately not "no credit card required". The homepage says
              that and /industries says "your card isn't charged until it
              ends", which are two different promises about the same funnel. A
              feature page is not the place to pick a side, so it says only the
              part both agree on. */}
          <p className="mt-3 text-sm text-muted-foreground">
            Your first month is free.
          </p>
        </div>
      </div>

      {/* Problem → what replaces it. Same two-column shape as the industry
          pages, because a contractor reading both should not have to learn a
          second layout. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
          What this takes off your week
        </h2>

        <div className="mt-10 space-y-4">
          {page.pains.map((p) => (
            <div
              key={p.pain}
              className="grid sm:grid-cols-2 gap-px bg-accent border border-border rounded-xl overflow-hidden"
            >
              <div className="bg-card p-5 flex items-start gap-3">
                <XIcon size={18} className="text-red-400 shrink-0 mt-0.5" />
                <span className="text-foreground">{p.pain}</span>
              </div>
              <div className="bg-muted p-5 flex items-start gap-3">
                <Check size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-foreground">{p.fix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works here — the paragraph that separates this from a feature
          list anybody could write. */}
      <div className="bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            How it works here
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {page.how.map((h, i) => (
              <div key={h.step}>
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-semibold text-foreground">{h.step}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{h.body}</p>
              </div>
            ))}
          </div>

          {/* Only the languages page asks for this, and it asks for it because
              typing the six names into copy is how a list goes stale. Rendered
              from app/i18n/languages.js so the page cannot claim a language the
              product does not carry. */}
          {page.showLanguages && (
            <div className="mt-10 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <span
                  key={l.code}
                  className="text-sm bg-muted border border-border px-4 py-2 rounded-full text-foreground"
                >
                  {l.name}
                  <span className="text-muted-foreground"> · {l.nativeName}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The claims. Every line here is a matrix entry: its name, its own
          one-sentence summary, and — when it is only partly built — exactly
          where it stops. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          What you get
        </h2>
        {/* Derived, not asserted. PLAN_DIFFERENCES records the finding that no
            shipped rung withholds a feature — but the sentence is printed only
            when every entry ON THIS PAGE actually says every_plan, so the day
            one becomes varies_by_plan the claim disappears by itself instead of
            being remembered. */}
        {features.every((f) => f.availability === "every_plan") && (
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Every plan includes all of it. Plans differ by how many people can
            work in the account, not by which features they are allowed to use.
          </p>
        )}

        <ul className="mt-8 space-y-5">
          {features.map((f) => (
            <li
              key={f.key}
              className="border border-border rounded-xl p-5 bg-card"
            >
              <div className="flex items-start gap-3">
                <Check
                  size={20}
                  className="text-emerald-600 shrink-0 mt-0.5"
                />
                <div>
                  <h3 className="font-semibold text-foreground">{f.name}</h3>
                  <p className="mt-1 text-muted-foreground">{f.summary}</p>

                  {f.readiness === "partial" && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted border border-border p-3">
                      <Info
                        size={16}
                        className="text-muted-foreground shrink-0 mt-0.5"
                      />
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">
                          Where this stops:{" "}
                        </span>
                        {f.limits}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {partials.length > 0 && (
          <p className="mt-6 text-sm text-muted-foreground max-w-2xl">
            {partials.length === 1
              ? "One item above is only partly built, and says so."
              : `${partials.length} items above are only partly built, and say so.`}{" "}
            We would rather you read the limit here than find it in month two.
          </p>
        )}
      </div>

      {/* Closing CTA */}
      <div className="bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Try it on your own jobs
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            The first month is free. Bring your own rates, your own logo and
            the client list you already have.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-muted"
            >
              Start your free month <ArrowRight size={16} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border border-white/40 text-white px-6 py-3 rounded-full text-sm font-semibold"
            >
              Talk to a person
            </Link>
          </div>
        </div>
      </div>

      {/* Neighbouring pages */}
      <div className="bg-muted border-t border-border py-12 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Contractors reading this also read
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto px-4">
          {(page.related || []).map((s) => (
            <Link
              key={s}
              href={`/features/${s}`}
              className="text-sm bg-card border border-border px-4 py-2 rounded-full hover:border-border"
            >
              {featurePage(s)?.label || s}
            </Link>
          ))}
          <Link
            href="/features"
            className="text-sm bg-card border border-border px-4 py-2 rounded-full hover:border-border"
          >
            All features
          </Link>
        </div>
      </div>
    </div>
  );
}
