// app/(marketing)/features/[slug]/page.js
//
// One marketing page per thing FieldQuo does, rendered from
// app/data/featurePages.js and — for every claim it makes — from
// lib/marketing/featureMatrix.js.
//
// ══ Two levels in one namespace, and why there is no third URL ═════════════
//
// /pricing names 29 features. The owner asked for a page for each of them. This
// route already served 25 pages, and 17 of those 25 were ALREADY the page about
// one of the 29 — /features/invoicing is the invoices page, /features/team is
// the team-access page. Minting /features/invoices beside /features/invoicing
// would put two pages about one subject on one site: they compete for the same
// search, they drift apart the first time one is edited, and a visitor who
// finds the thinner one gets the worse answer. That is the marketing form of
// shipping two controls that look like they do the same thing.
//
// So there is one page per subject and one namespace, and a page declares which
// role it is playing in DATA rather than by convention:
//
//   page.feature      set → this is the canonical page for that one of the 29.
//                     The hero says so, in the matrix's own words, and the
//                     page owes the reader `details` — the specifics.
//   page.features     everything the page claims. When it carries keys beyond
//                     its own `feature`, the page is also a HUB, and the "More
//                     in this area" strip links each of those to ITS canonical
//                     page. Derived, so it cannot go stale.
//
// A page with no `feature` (leads, marketing, crew, reporting, languages…) is a
// pure hub: it sells an area and hands off to the pages under it.
//
// ══ The one place a feature name is turned into words ══════════════════════
//
// lib/marketing/featureLabels.js. Every feature name and summary this route
// renders is resolved through featureEntry(), never read off the matrix entry
// directly — because `f.name` sprinkled through JSX is exactly how /pricing
// came to render Ukrainian group headings over English feature names.
//
// This page is a server component with no translation context, so it calls
// featureEntry(key) with no `t` and gets the matrix's proved English, which is
// what it rendered before. That is the documented no-argument path in that
// file, and the point of routing through it anyway is that the day these pages
// gain a language, the change is one argument at three call sites rather than
// a hunt through the markup.
//
// One gap, named rather than hidden: that layer deliberately does NOT translate
// `limits`, and this page renders `limits` under every partial feature. So a
// Ukrainian visitor on /features/financing would read a translated name over an
// English caveat. Translating a hedge is the one place a loose paraphrase does
// real damage, and it waits for a pass a speaker signs off.
//
// ══ Images: four real screenshots, and the pages that do not get one ═══════
//
// public/marketing holds exactly four product images and no more can be made —
// the app is behind a login. `page.image` is therefore rare and each one is
// assigned to the page whose subject the picture actually shows, which is NOT
// always what the filename says: hero-scheduling.webp is the client's booking
// page, not the dispatch calendar, and hero-invoicing.webp is a quote with an
// Approve button, not an invoice. Their own alt text in app/i18n/messages.js
// says as much. Every other page is laid out to work without a picture — the
// `details` list is the device that carries it — rather than borrowing a
// neighbour's screenshot or dropping in a gradient block pretending to be one.
// Same argument as the header of app/components/marketing/Hero.js.
//
// ══ Server component, no translation context ═══════════════════════════════
//
// Deliberately NOT split into a client half the way /industries/[slug] is. That
// page is split because its copy lives in the t() catalogue and translation is
// React context. This copy is an English data module, following the precedent
// of app/data/productFeatures.js, so there is nothing to put behind a provider.
//
// The debt that creates is real and is written down rather than hidden: the
// prose on these pages — headline, one-liner, the pains, the how, the specifics
// — renders in English in all six languages. What does NOT carry that debt is
// the part a visitor reads as a CLAIM: every feature name and summary resolves
// through featureLabels above, and every image alt hangs off a catalogue key
// that is already translated into all six. So the day this page gains a
// language, the claims are already written and only the prose is outstanding.
// Same open question as the locale-prefixed routing note at the end of
// docs/ROADMAP.md.

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Info, X as XIcon } from "lucide-react";
import {
  FEATURE_PAGES,
  featurePage,
  featuresOnPage,
  moreInThisArea,
} from "@/app/data/featurePages";
import { MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import { featureEntry } from "@/lib/marketing/featureLabels";
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

  // Resolved through the label layer rather than read off the matrix entry.
  // No t() here — see the header — so today every one of these is the matrix's
  // own proved English, which is what this page rendered before.
  const features = featuresOnPage(slug).map((f) => featureEntry(f.key));
  const partials = features.filter((f) => f.readiness === "partial");

  // The one of the 29 this page IS, when it is one of them.
  const canonical = page.feature ? featureEntry(page.feature) : null;
  // The other features it carries that have a page of their own.
  const siblings = moreInThisArea(slug).map((s) => ({
    ...s,
    entry: featureEntry(s.key),
  }));
  const image = page.image || null;
  const inline = page.inlineImage || null;

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
                {groupLabel(page.group)}
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
                  ends", which are two different promises about the same funnel.
                  A feature page is not the place to pick a side, so it says only
                  the part both agree on. */}
              <p className="mt-3 text-sm text-muted-foreground">
                Your first month is free.
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
            The specifics
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

        {/* The hub half. Derived from what this page claims, so a page cannot
            list a feature and then fail to point at the page about it. */}
        {siblings.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <h3 className="font-semibold text-foreground">
              More in this area
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Each of these has a page of its own.
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
