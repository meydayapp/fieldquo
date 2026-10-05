// app/(marketing)/industries/[slug]/showcase/RoofingShowcase.js
//
// /industries/roofing#instant-quote-example — the whole pipeline a roofer
// gets, walked through on one invented company and one invented house:
//
//   1  the homeowner's instant-quote page      InstantQuoteFlow, sample mode
//   2  the lead it creates, scored             the leads board's card + drawer
//   3  the review before the quote can go      the estimate-review queue
//   4  the draft quote, and how it was priced  QuoteDocument's sections
//
// ══ Real screens, not pictures of them ═════════════════════════════════════
//
// Each section renders the component the product renders, in the `sample`
// mode each one was given for this page (the precedent is QuoteApproval's,
// commit da656e6d). A sample mode takes its data as a prop and refuses every
// request the component would otherwise make; see the comment at each prop.
// What connects the four is ./roofingRun.js: the body the real form builds is
// run through the same pure functions /request runs — the estimator, the
// lead scorer, the draft's lines and totals — so the price in step 1, the
// lead in step 2, the figure approved in step 3 and the total in step 4 are
// one computation, not four hand-kept numbers.
//
// ══ What this page never does ═════════════════════════════════════════════
//
// No request of any kind leaves these four sections: no Google (the roof is
// a drawing, the address is fixed), no lead, no email, no POST. Approving in
// step 3 changes step 4's chip in this tab and nowhere else. The demo button
// at the foot is the marketing site's own booking control and does what it
// does everywhere — fetch slots when opened, book when confirmed.
//
// The one exception is opt-in: step 1's "Use a real address" panel
// (./LiveAddress.js). Until it is pressed the page makes no Google request
// and no /api/ call; pressed, it loads the Places picker and measures the
// picked house through POST /api/showcase/roof-measure — capped, cached and
// same-origin only (./liveMeasure.js) — and the four sections re-render on
// that house, priced here exactly as the sample is. Still no lead, no email,
// no draft, nothing saved but the measurement.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { industryChromeFor, industryShowcaseFor } from "@/app/i18n/industries";
import InstantQuoteFlow from "@/app/instant-quote/[companySlug]/InstantQuoteFlow";
import LeadsRoute from "@/app/app/leads/page";
import EstimateReviewsPage from "@/app/app/estimate-reviews/page";
import DemoBooking from "@/app/components/marketing/DemoBooking";
import MiniQuote from "./MiniQuote";
import { QuotePagePreview, ReportPreview, ViewToggle } from "./ClientPreviews";
import { defaultBody, runRequest } from "./roofingRun";
import LiveAddress from "./LiveAddress";
import { documentLanguageFor, fixtureInLanguage } from "./showcaseLanguage";

function Step({ n, title, body, children, headingRef = null, id }) {
  return (
    <section className="mt-14" aria-labelledby={id}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-inverted text-inverted-foreground text-sm font-bold" aria-hidden="true">
          {n}
        </span>
        <div className="min-w-0">
          <h3 id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-xl sm:text-2xl font-bold text-foreground outline-none">
            {title}
          </h3>
          <p className="mt-1 text-muted-foreground max-w-2xl">{body}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * A labelled surface around a real screen — the "Sample" tag is the honest part.
 *
 * The tag is IN the surface's flow, on its own row above the screen, not
 * pinned half over the top border. It used to be `absolute -top-3`, and step
 * 1's surface is `overflow-hidden` (the homeowner's page has full-bleed
 * edges that must follow the rounded corners): the clip cut the tag in half,
 * leaving the bottom of its letters under the caption above (owner's
 * screenshot, 2026-09-28). A tag that sits on the border only works on a
 * surface that never clips, and whether a surface clips is decided by what it
 * holds — so the tag no longer depends on it. scripts/check-roofing-example*
 * assert both halves: no negative offset in the markup, and in Chrome every
 * tag wholly inside the box that clips it.
 */
function Surface({ label, sampleTag, children, className = "", bodyClassName = "" }) {
  return (
    <div className={`rounded-2xl border border-border bg-background ${className}`} data-showcase-surface>
      <div className="px-4 pt-3">
        <span className="inline-block max-w-full rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground" data-showcase-pill>
          {sampleTag} · {label}
        </span>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/**
 * A preview beside its words at phone width; under them, the column's full
 * width, at desktop width — a 1280px page in a 24rem column is a third of
 * its size and unreadable.
 */
function previewGrid(view) {
  return view === "desktop" ? "" : "md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]";
}

export default function RoofingShowcase({ fixture, anchor }) {
  const { language } = useTranslation();
  const copy = industryShowcaseFor(language);
  const chrome = industryChromeFor(language);
  // The homeowner's page speaks the three languages the walk-through shows
  // (./showcaseLanguage.js SHOWCASE_DOCUMENT_LANGUAGES); any other site
  // language reads it in English and says so.
  const flowLang = documentLanguageFor(language);

  // The house on show: the sample's until the visitor measures a real address
  // or types a roof size (./LiveAddress.js), which hands back the same
  // fixture on their house (./houseFixture.js). Everything below reads
  // `shown`; the sample itself is never mutated, so "Back to the sample
  // house" is just null.
  const [house, setHouse] = useState(null);
  // …read in the visitor's language: the company writing in the document
  // language, its tagline in the site's (./showcaseLanguage.js says which is
  // which, and why the homeowner's pages stop at English, French, Spanish).
  const shown = useMemo(() => fixtureInLanguage(house || fixture, language), [house, fixture, language]);

  // The request on show: the fixture homeowner's until the visitor sends
  // their own. Derived for the default so a language switch re-words it.
  const defaultRun = useMemo(() => runRequest(shown, defaultBody(shown, flowLang)), [shown, flowLang]);
  const [mine, setMine] = useState(null);
  const run = mine || defaultRun;
  const [approved, setApproved] = useState(false);
  // Remount keys: a new request re-seeds the app screens (their sample props
  // seed state once, like a page load), and Start over re-seeds the form.
  const [round, setRound] = useState(0);
  const [formRound, setFormRound] = useState(0);

  const flowSample = useMemo(
    () => ({
      payload: shown.payloads[flowLang],
      prefill: { address: shown.address, contact: { ...shown.homeowner } },
      submit(body) {
        const next = runRequest(shown, body, { now: new Date() });
        setMine(next);
        setApproved(false);
        setRound((r) => r + 1);
        return next.reply;
      },
    }),
    [shown, flowLang],
  );

  const leadsSample = useMemo(() => ({ leads: [run.lead], assignees: [shown.reviewer] }), [run, shown]);
  const reviewSample = useMemo(
    () => ({
      quotes: [run.review],
      canApprove: true,
      currentUserId: shown.reviewer.id,
      tradeNames: {},
      me: shown.reviewer.name,
      onApprove: () => setApproved(true),
    }),
    [run, shown],
  );

  // A new house is a new page load for every screen: the form re-seeds with
  // its address and currency, and steps 2–4 show that house's default request.
  function showHouse(next) {
    setHouse(next);
    setMine(null);
    setApproved(false);
    setRound((r) => r + 1);
    setFormRound((r) => r + 1);
  }

  // Phone or Desktop, per preview. Phone until mounted (the server render
  // and the first client render agree), then Desktop where the column is
  // wide enough for a laptop page to be readable scaled down.
  const [reportView, setReportView] = useState("phone");
  const [quoteView, setQuoteView] = useState("phone");
  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1024px)").matches) {
      setReportView("desktop");
      setQuoteView("desktop");
    }
  }, []);

  // What the roof picture in step 1 is, said plainly: the drawing, or
  // Google's still of the address they entered.
  const pictureNote = shown.live?.satelliteImageUrl && shown.measurement?.satelliteImageUrl === shown.live.satelliteImageUrl ? copy.liveImageNote : copy.roofIllustration;

  function startOver() {
    setMine(null);
    setApproved(false);
    setRound((r) => r + 1);
    setFormRound((r) => r + 1);
  }

  // "See it in action" in the hero, or an ad landing on the anchor: put the
  // keyboard at step 1, so the next Tab is the form itself.
  const startRef = useRef(null);
  useEffect(() => {
    const go = () => {
      if (window.location.hash === `#${anchor}`) startRef.current?.focus();
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [anchor]);

  const status = mine ? copy.showingYours : copy.showingDefault;

  return (
    <div id={anchor} className="scroll-mt-24 border-t border-border bg-muted" data-showcase="instant_quote">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{copy.eyebrow}</span>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">{copy.title}</h2>
        <p className="mt-3 text-lg text-muted-foreground max-w-3xl">{copy.lede}</p>

        {/* The notice comes before anything priced, and is not dismissible.
            The company it names is shown beside it, labelled fictional. */}
        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] max-w-5xl items-start">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5" role="note" data-showcase-notice>
            <p className="text-sm font-semibold text-foreground">{copy.noticeTitle}</p>
            <p className="mt-1 text-sm text-foreground">{copy.notice}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3" data-showcase-company>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fixture.company.logoUrl} alt="" className="h-12 w-auto shrink-0" width={115} height={48} />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{fixture.company.name}</p>
              <p className="text-sm text-muted-foreground">{shown.company.tagline}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{copy.exampleCompany}</p>
            </div>
          </div>
        </div>

        <h3 className="mt-12 text-lg font-semibold text-foreground">{copy.howTitle}</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.how.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-border bg-card p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{i + 1}</span>
              <p className="mt-2 font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>

        <Step n={1} id={`${anchor}-step-1`} title={copy.step1Title} body={copy.step1Body} headingRef={startRef}>
          <LiveAddress base={fixture} active={shown} onUse={showHouse} copy={copy} />
          <p className="mb-4 text-sm text-muted-foreground">
            {pictureNote}
            {flowLang !== language ? ` ${copy.formLanguageNote}` : ""}
          </p>
          <Surface label={copy.homeownerSees} sampleTag={copy.sampleTag} className="overflow-hidden" bodyClassName="pt-2">
            <InstantQuoteFlow key={`${flowLang}-${formRound}`} companySlug={shown.company.slug} sample={flowSample} />
          </Surface>

          <div className={`mt-10 grid gap-6 items-start ${previewGrid(reportView)}`} data-showcase-report>
            <div>
              <h4 className="text-lg font-semibold text-foreground">{copy.reportTitle}</h4>
              <p className="mt-1 text-muted-foreground">{copy.reportBody}</p>
              <a
                href={fixture.presentation.proposal.documents[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center min-h-[44px] text-sm font-semibold text-foreground underline underline-offset-4"
              >
                {copy.insuranceLink}
              </a>
            </div>
            <div className="min-w-0">
              <ViewToggle view={reportView} onView={setReportView} copy={copy} name="report" />
              <ReportPreview fixture={shown} run={run} label={copy.reportLabel} view={reportView} copy={copy} />
            </div>
          </div>
        </Step>

        <p className="mt-10 text-sm font-semibold text-foreground" aria-live="polite" data-showcase-run={mine ? "yours" : "default"}>
          {status}
          {mine && (
            <button
              type="button"
              onClick={startOver}
              className="ml-3 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full border border-border bg-card text-sm font-semibold text-foreground hover:border-foreground/40"
            >
              <RotateCcw size={14} aria-hidden="true" /> {copy.startOver}
            </button>
          )}
        </p>

        <Step n={2} id={`${anchor}-step-2`} title={copy.step2Title} body={copy.step2Body}>
          <Surface label={copy.contractorSees} sampleTag={copy.sampleTag} className="max-w-md" bodyClassName="p-4 pt-3">
            <LeadsRoute key={`leads-${round}`} sample={leadsSample} />
          </Surface>
        </Step>

        <Step n={3} id={`${anchor}-step-3`} title={copy.step3Title} body={copy.step3Body}>
          <Surface label={copy.contractorSees} sampleTag={copy.sampleTag} bodyClassName="pt-2">
            <EstimateReviewsPage key={`review-${round}`} sample={reviewSample} />
          </Surface>
        </Step>

        <Step n={4} id={`${anchor}-step-4`} title={copy.step4Title} body={copy.step4Body}>
          <MiniQuote fixture={shown} run={run} approved={approved} copy={copy} />

          <div className={`mt-10 grid gap-6 items-start ${previewGrid(quoteView)}`} data-showcase-quote-page>
            <div>
              <h4 className="text-lg font-semibold text-foreground">{copy.quotePageTitle}</h4>
              <p className="mt-1 text-muted-foreground">{copy.quotePageBody}</p>
            </div>
            <div className="min-w-0">
              <ViewToggle view={quoteView} onView={setQuoteView} copy={copy} name="quote" />
              <QuotePagePreview fixture={shown} run={run} label={copy.quotePageLabel} view={quoteView} copy={copy} />
            </div>
          </div>
        </Step>

        <div className="mt-16 rounded-2xl border border-border bg-card p-6 sm:p-8 text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground">{copy.ctaTitle}</h3>
          <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">{copy.ctaBody}</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-primary text-primary-foreground px-7 py-3.5 rounded-full text-base font-semibold transition hover:brightness-110"
            >
              {chrome.startTrial} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4">
            <DemoBooking variant="secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}
