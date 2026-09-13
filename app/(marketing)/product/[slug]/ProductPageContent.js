// app/(marketing)/product/[slug]/ProductPageContent.js
//
// Client half of the product page. Split from page.js because translation
// lives in React context (needs "use client") while generateStaticParams and
// generateMetadata must stay in a server component.
//
// ══ What this page is ══════════════════════════════════════════════════════
//
// Until 2026-09-13 this was a label, a headline, four bullets and two buttons.
// The owner read the four pages beside the real screens and asked for pages
// that look full and complete, from the screenshots and the facts we already
// hold. So it is now, top to bottom:
//
//   hero          label, headline, paragraph, the two buttons, a screenshot
//   sections      five or six capabilities, image and text alternating sides,
//                 each with three bullets, a real capture, and a link to the
//                 help article about it — CapabilitySections, shared with
//                 /features/<slug>
//   everything    every shipped matrix entry under this heading, from
//                 lib/marketing/featureMatrix.js through featureEntry() — the
//                 same cards /features renders, partial ones with their limit
//   faq           three or four honest questions
//   closing       the ClosingCTA the homepage ends on
//
// It is one component driven by app/data/productFeatures.js: adding a section
// is adding an object there and its nine translations to app/i18n/productPages,
// and scripts/check-product-pages.mjs refuses a section whose image, help
// slug or translations are missing.
//
// ══ Layout borrowed, not forked ════════════════════════════════════════════
//
// The hero grid, the figure frame, the check-bullets and the feature cards are
// the classes FeaturePageContent.js uses, so /product/quoting and
// /features/quotes read as one site. The FAQ is the homepage's FAQ component
// with this page's items passed in, and the closing band IS the homepage's.
//
// ══ Three resolvers, and why they are not interchangeable ══════════════════
//
//   productSay()   app/i18n/productPages — the prose, the alts, the chrome.
//                  NOT merged into MESSAGES (that directory's index.js says
//                  why), so t() cannot see it.
//   t()            messages.js — the label (product.<slug>.label, already in
//                  nine languages for the nav), the two buttons, the borrowed
//                  hero alts (hero.tabs.*.alt), "Where this stops", the FAQ
//                  heading, and every feature name in the grid through
//                  featureEntry().
//   language       picks the screenshot: the live captures exist in en/fr/es
//                  and the reader gets theirs, else English. A screenshot is
//                  a picture; nothing is machine-translated.
"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Info } from "lucide-react";
import CapabilitySections from "@/app/components/marketing/CapabilitySections";
import {
  productPageCopy,
  productChromeCopy,
  productImageSrc,
  productHeroSrc,
} from "@/app/data/productFeatures";
import { productSay } from "@/app/i18n/productPages";
import { featureEntry } from "@/lib/marketing/featureLabels";
import { productHelpUrl } from "@/lib/marketing/productHelp";
import { useTranslation } from "@/app/hooks/useTranslation";
import FAQ from "@/app/components/marketing/FAQ";
import ClosingCTA from "@/app/components/marketing/ClosingCTA";

export default function ProductPageContent({ slug }) {
  const { t, language } = useTranslation();

  const say = productSay(language);
  const copy = productPageCopy(slug, say, t);
  if (!copy) return null;
  const chrome = productChromeCopy(say);
  const label = t(`product.${slug}.label`, copy.label);

  // Resolved through the label layer rather than read off the matrix entry —
  // `f.name` sprinkled through JSX is how /pricing came to render Ukrainian
  // headings over English feature names. An unknown key is dropped rather
  // than improvised; the check script fails it by name.
  const everything = copy.everything.map((key) => featureEntry(key, t)).filter(Boolean);

  // Help links go to the reader's language when the help centre is written in
  // it (en, fr, es) and to English otherwise, with a small note saying so.
  const help = (articleSlug) => productHelpUrl(articleSlug, language);

  return (
    <div>
      {/* Hero — the same two-column grid as /features/[slug]. */}
      <div className="bg-muted border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight max-w-3xl">
                {copy.headline}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
                {copy.description}
              </p>

              <ul className="mt-6 space-y-2.5 max-w-xl">
                {copy.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <Check size={18} className="text-emerald-600 shrink-0 mt-1" />
                    <span className="text-foreground">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {/* Both labels are borrowed rather than written, because both
                    already exist in all nine languages and a tenth wording of
                    "Start free trial" is a tenth thing to keep in step.

                    hero.cta is already shared — Hero and ClosingCTA both
                    render it. featurePage.chrome.seePricing is namespaced to
                    /features and used here anyway: it is the same button on
                    the same kind of page. It is a SHARED key now —
                    scripts/check-product-pages.mjs asserts these pages render
                    it in every language, so deleting it with /features fails
                    this build too. */}
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 min-h-[44px] bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold"
                >
                  {t("hero.cta")} <ArrowRight size={16} />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center min-h-[44px] border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-card"
                >
                  {t("featurePage.chrome.seePricing")}
                </Link>
              </div>
              {/* The part of the offer both the homepage and /industries agree
                  on — see the same note in FeaturePageContent.js. */}
              <p className="mt-3 text-sm text-muted-foreground">
                {t("featurePage.chrome.firstMonthFree")}
              </p>
            </div>

            <figure className="rounded-2xl border border-border bg-card overflow-hidden">
              <Image
                src={productHeroSrc(copy.hero)}
                alt={copy.hero.alt}
                width={copy.hero.width}
                height={copy.hero.height}
                sizes="(min-width: 1024px) 36rem, 100vw"
                priority
                className="w-full h-auto"
              />
            </figure>
          </div>
        </div>
      </div>

      {/* The capabilities — the shared rows, so /features/payments and this
          page cannot drift into two layouts of the same idea. */}
      <CapabilitySections
        sections={copy.sections}
        srcFor={(image) => productImageSrc(slug, image, language)}
        helpFor={help}
        readHow={chrome.readHow}
        inEnglish={chrome.inEnglish}
      />

      {/* Everything under this heading — the matrix's own cards. A partial
          entry is never a bare tick: its limit is printed exactly as
          /features prints it. */}
      <div className="bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            {chrome.everythingTitle.replace("{label}", label)}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl">{chrome.everythingBody}</p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {everything.map((f) => (
              <li key={f.key} className="border border-border rounded-xl p-4 bg-background">
                <div className="flex items-start gap-3">
                  <Check size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{f.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.summary}</p>
                    {f.readiness === "partial" && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground">
                        <Info size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                        <span>
                          <span className="font-semibold">
                            {t("featurePage.chrome.whereStops")}{" "}
                          </span>
                          {f.limits}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <FAQ title={chrome.faqTitle} items={copy.faq} />

      <ClosingCTA />
    </div>
  );
}
