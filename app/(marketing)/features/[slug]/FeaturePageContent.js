// app/(marketing)/features/[slug]/FeaturePageContent.js
//
// Everything a visitor reads on /features/<slug>. Client half — split from
// page.js because translation lives in React context while generateStaticParams
// and generateMetadata have to stay on the server. Same split as
// /industries/[slug] and /pricing, made for the same reason.
//
// ══ The one place a feature name is turned into words ══════════════════════
//
// lib/marketing/featureLabels.js. Every feature name, summary and limit this
// route renders is resolved through featureEntry(), never read off the matrix
// entry directly — because `f.name` sprinkled through JSX is exactly how
// /pricing came to render Ukrainian group headings over English feature names.
// Group headings go through featureGroup() in the same file, for the same
// reason one level up.
//
// ══ And the one place the PROSE is ═════════════════════════════════════════
//
// featurePageCopy() in app/data/featurePages.js. The English still lives in
// that data module — it is what 1043 assertions in
// scripts/check-feature-pages.mjs read, and what proves this page cannot claim
// a phone application, an accounting integration or change orders — and it is
// passed to t() as the fallback, so a language with a hole prints the proved
// English sentence rather than `featurePage.quotes.headline`.
//
// The page's own furniture — "What this takes off your week", "Where this
// stops:", the two calls to action — is not prose ABOUT a feature, so it lives
// in the catalogue directly under `featurePage.chrome.*` with no English
// fallback here. That is deliberate: a fallback typed into JSX is a second copy
// of the English, and the copy is the one that rots because it is the one
// nobody looks at. t() already falls back to the English catalogue.
"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Info, X as XIcon } from "lucide-react";
import {
  featurePageCopy,
  featurePageLabel,
  featuresOnPage,
  moreInThisArea,
} from "@/app/data/featurePages";
import { featureEntry, featureGroup } from "@/lib/marketing/featureLabels";
import { LANGUAGES } from "@/app/i18n/languages";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function FeaturePageContent({ slug }) {
  const { t } = useTranslation();

  const page = featurePageCopy(slug, t);
  if (!page) return null;

  // Resolved through the label layer rather than read off the matrix entry.
  const features = featuresOnPage(slug).map((f) => featureEntry(f.key, t));
  const partials = features.filter((f) => f.readiness === "partial");

  // The one of the 29 this page IS, when it is one of them.
  const canonical = page.feature ? featureEntry(page.feature, t) : null;
  // The other features it carries that have a page of their own.
  const siblings = moreInThisArea(slug).map((s) => ({
    ...s,
    entry: featureEntry(s.key, t),
  }));
  const image = page.image || null;
  const inline = page.inlineImage || null;
  const groupHeading = featureGroup(page.group, t)?.label || "";

  return (
    <div>
      {/* Hero. Two columns when there is a real screenshot of THIS subject,
          one when there is not — rather than a half-empty grid with a
          placeholder in it. */}
      <div className="bg-muted border-b border-border">
        <div
          className={`${image ? "max-w-6xl" : "max-w-5xl"} mx-auto px-4 sm:px-6 lg:px-8 py-16`}
        >
          <div
            className={
              image ? "grid lg:grid-cols-2 gap-12 items-center" : undefined
            }
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {groupHeading}
                {canonical ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    {canonical.name}
                  </>
                ) : null}
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
                  {t("featurePage.chrome.startTrial")} <ArrowRight size={16} />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-card"
                >
                  {t("featurePage.chrome.seePricing")}
                </Link>
              </div>
              {/* Deliberately not "no credit card required". The homepage says
                  that and /industries says "your card isn't charged until it
                  ends", which are two different promises about the same funnel.
                  A feature page is not the place to pick a side, so it says only
                  the part both agree on. */}
              <p className="mt-3 text-sm text-muted-foreground">
                {t("featurePage.chrome.firstMonthFree")}
              </p>
            </div>

            {image && (
              <figure className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Intrinsic size per image, following Hero.js: declaring the
                    wrong aspect makes the browser reserve a box the wrong
                    shape, which is the layout shift width/height exist to
                    prevent. */}
                <Image
                  src={image.src}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  sizes="(min-width: 1024px) 32rem, 100vw"
                  className="w-full h-auto"
                />
                <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  {image.caption}
                </figcaption>
              </figure>
            )}
          </div>
        </div>
      </div>

      {/* Problem → what replaces it. Same two-column shape as the industry
          pages, because a contractor reading both should not have to learn a
          second layout. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
          {t("featurePage.chrome.painsTitle")}
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
            {t("featurePage.chrome.howTitle")}
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

          {inline && (
            <figure className="mt-10 grid sm:grid-cols-[minmax(0,20rem)_1fr] gap-6 items-center">
              <div className="rounded-2xl border border-border bg-muted overflow-hidden">
                <Image
                  src={inline.src}
                  alt={inline.alt}
                  width={inline.width}
                  height={inline.height}
                  sizes="(min-width: 640px) 20rem, 100vw"
                  className="w-full h-auto"
                />
              </div>
              <figcaption className="text-sm text-muted-foreground">
                {inline.caption}
              </figcaption>
            </figure>
          )}

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

      {/* The specifics.
          ─────────────────────────────────────────────────────────────────────
          Only on a page that is the canonical page for one of the 29, and every
          line of it was read out of the files that entry names in `proof`. This
          is also the layout device that lets a page with no screenshot carry
          its own weight: a labelled list of things that are actually true reads
          better than a decorative picture of nothing. */}
      {canonical && page.details?.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("featurePage.chrome.specificsTitle")}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            {canonical.summary}
          </p>

          <dl className="mt-8 divide-y divide-border border-y border-border">
            {page.details.map((d) => (
              <div
                key={d.label}
                className="grid sm:grid-cols-[14rem_1fr] gap-2 sm:gap-8 py-5"
              >
                <dt className="text-sm font-semibold text-foreground">
                  {d.label}
                </dt>
                <dd className="text-muted-foreground">{d.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* The claims. Every line here is a matrix entry: its name, its own
          one-sentence summary, and — when it is only partly built — exactly
          where it stops. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          {t("featurePage.chrome.getTitle")}
        </h2>
        {/* Derived, not asserted. PLAN_DIFFERENCES records the finding that no
            shipped rung withholds a feature — but the sentence is printed only
            when every entry ON THIS PAGE actually says every_plan, so the day
            one becomes varies_by_plan the claim disappears by itself instead of
            being remembered. */}
        {features.every((f) => f.availability === "every_plan") && (
          <p className="mt-3 text-muted-foreground max-w-2xl">
            {t("featurePage.chrome.everyPlan")}
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
                          {t("featurePage.chrome.whereStops")}{" "}
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
              ? t("featurePage.chrome.partialOne")
              : t("featurePage.chrome.partialMany", { count: partials.length })}{" "}
            {t("featurePage.chrome.partialTail")}
          </p>
        )}

        {/* The hub half. Derived from what this page claims, so a page cannot
            list a feature and then fail to point at the page about it. */}
        {siblings.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <h3 className="font-semibold text-foreground">
              {t("featurePage.chrome.moreTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              {t("featurePage.chrome.moreBody")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {siblings.map((s) => (
                <Link
                  key={s.key}
                  href={`/features/${s.slug}`}
                  className="block border border-border rounded-xl p-4 bg-card hover:border-primary"
                >
                  <span className="font-semibold text-foreground">
                    {s.entry.name}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {s.entry.summary}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Closing CTA */}
      <div className="bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {t("featurePage.chrome.ctaTitle")}
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            {t("featurePage.chrome.ctaBody")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-muted"
            >
              {t("featurePage.chrome.startTrial")} <ArrowRight size={16} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border border-white/40 text-white px-6 py-3 rounded-full text-sm font-semibold"
            >
              {t("featurePage.chrome.talkToPerson")}
            </Link>
          </div>
        </div>
      </div>

      {/* Neighbouring pages */}
      <div className="bg-muted border-t border-border py-12 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          {t("featurePage.chrome.alsoRead")}
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto px-4">
          {(page.related || []).map((s) => (
            <Link
              key={s}
              href={`/features/${s}`}
              className="text-sm bg-card border border-border px-4 py-2 rounded-full transition-colors hover:border-foreground/40"
            >
              {featurePageLabel(s, t) || s}
            </Link>
          ))}
          <Link
            href="/features"
            className="text-sm bg-card border border-border px-4 py-2 rounded-full transition-colors hover:border-foreground/40"
          >
            {/* An existing key, already translated into all six — the nav says
                the same words about the same page. */}
            {t("nav.allFeatures")}
          </Link>
        </div>
      </div>
    </div>
  );
}
