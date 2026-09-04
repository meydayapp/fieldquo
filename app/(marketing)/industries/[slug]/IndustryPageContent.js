// app/(marketing)/industries/[slug]/IndustryPageContent.js
//
// Client half of the industry page. Split from page.js because translation
// lives in React context (needs "use client") while generateStaticParams and
// generateMetadata must stay in a server component. The server file resolves
// the slug and hands it down; this file renders in the visitor's language.
"use client";

import Link from "next/link";
import { ArrowRight, Check, PlayCircle, X as XIcon } from "lucide-react";
import { INDUSTRIES } from "@/app/data/industries";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  industryContentFor,
  industryChromeFor,
} from "@/app/i18n/industries";

export default function IndustryPageContent({ slug, videoId }) {
  const { language } = useTranslation();

  const content = industryContentFor(slug, language);
  const chrome = industryChromeFor(language);
  if (!content) return null;

  const trade = content.label.toLowerCase();
  const fill = (template) => String(template || "").replace("{trade}", trade);

  return (
    <div>
      {/* Hero — copy left, video right */}
      <div className="bg-muted border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {content.label}
              </span>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                {content.headline}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">{content.description}</p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-primary"
                >
                  {chrome.startTrial} <ArrowRight size={16} />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-card"
                >
                  {chrome.talkToUs}
                </Link>
              </div>

              <p className="mt-3 text-sm text-muted-foreground">{chrome.noCard}</p>
            </div>

            {/* Real embed once videoId is set; honest placeholder otherwise. */}
            <div className="aspect-video rounded-2xl overflow-hidden border border-border bg-card">
              {videoId ? (
                <iframe
                  className="w-full h-full"
                  // youtube-nocookie: no tracking cookie before the visitor has
                  // consented to anything, which PIPEDA and Quebec's Law 25
                  // both care about.
                  src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                  title={content.headline}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-brand-accent/10 text-center px-6">
                  <PlayCircle size={40} className="text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">
                    {chrome.videoSoon}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {chrome.videoDemoPrefix}{" "}
                    <Link href="/contact" className="underline">
                      {chrome.videoDemoLink}
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Problem → solution */}
      {content.pains.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
            {chrome.soundFamiliar}
          </h2>
          <p className="mt-3 text-muted-foreground text-center max-w-2xl mx-auto">
            {fill(chrome.painIntro)}
          </p>

          <div className="mt-10 space-y-4">
            {content.pains.map((p) => (
              <div
                key={p.pain}
                className="grid sm:grid-cols-2 gap-px bg-accent border border-border rounded-xl overflow-hidden"
              >
                <div className="bg-card p-5 flex items-start gap-3">
                  <XIcon size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-foreground">{p.pain}</span>
                </div>
                <div className="bg-muted p-5 flex items-start gap-3">
                  <Check
                    size={18}
                    className="text-emerald-600 shrink-0 mt-0.5"
                  />
                  <span className="text-foreground">{p.fix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closing CTA */}
      <div className="bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {fill(chrome.ctaTitle)}
          </h2>
          {/* NOT text-muted-foreground. That token is #4d6076, chosen to sit
              on the light --card/--muted washes; on --primary (#06356b) it
              measures 1.88:1, which is grey-on-navy and effectively invisible.
              /features/[slug] already prints its own ctaBody as
              text-primary-foreground/80 — 8.31:1 on the same navy — so this
              matches it rather than inventing a third value. */}
          <p className="mt-3 text-primary-foreground/80">{chrome.ctaBody}</p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-muted"
          >
            {chrome.startTrial} <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Nearby trades */}
      <div className="bg-muted border-t border-border py-12 text-center">
        <p className="text-sm text-muted-foreground mb-3">{chrome.nearby}</p>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto px-4">
          {INDUSTRIES.filter((i) => i.slug !== slug)
            .slice(0, 6)
            .map((i) => (
              <Link
                key={i.slug}
                href={`/industries/${i.slug}`}
                className="text-sm bg-card border border-border px-4 py-2 rounded-full hover:border-border"
              >
                {industryContentFor(i.slug, language)?.label || i.label}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
