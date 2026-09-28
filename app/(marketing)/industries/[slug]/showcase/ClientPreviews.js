// app/(marketing)/industries/[slug]/showcase/ClientPreviews.js
//
// The two pages the HOMEOWNER is sent, as they render for the showcase
// request — each the real component, inside the signup's SampleFrame
// (app/components/auth/samples/SampleFrame.js): an iframe at a phone's width,
// scaled to the column, inert (no pointer, no tab stop, sandboxed without
// scripts) behind a visible "Sample" tag. Nothing inside can be clicked, so
// the call-back form, the waiver boxes and the Approve button cannot post.
//
//   ReportPreview     app/estimate-report/[token]/ReportView.js — where the
//                     form sends a homeowner after they submit, built by
//                     buildEstimateReportModel(), the function the route's
//                     loader calls, from this request's draft.
//   QuotePagePreview  app/q/[token]/QuoteApproval.js in its `sample` mode —
//                     the quote they open once it is sent, with the
//                     company's About, before-and-after, documents, process
//                     and the acknowledgements they sign.
"use client";

import SampleFrame from "@/app/components/auth/samples/SampleFrame";
import ReportView from "@/app/estimate-report/[token]/ReportView";
import QuoteApproval from "@/app/q/[token]/QuoteApproval";
import { buildEstimateReportModel } from "@/lib/estimate/report/model";
import { estimateReportCopy } from "@/lib/i18n/estimateReportCopy";
import { visibilityFor } from "@/lib/estimate/visibility";

/** The public company shape both pages read (the public routes' select). */
function publicCompany(c) {
  return {
    name: c.name,
    logoUrl: c.logoUrl,
    brandColor: c.brandColor,
    email: c.email,
    phone: c.phone,
    website: null,
    address: c.address,
    paymentTerms: null,
    paymentMethods: [],
    currency: c.currency,
    defaultLanguage: c.defaultLanguage,
    province: c.province,
    country: c.country,
    taxIdName: null,
    taxIdNumber: null,
  };
}

/** The report model for this request, exactly as the report route's loader builds it. */
export function showcaseReport(fixture, run) {
  const draft = run.draft;
  const report = buildEstimateReportModel({
    quote: {
      id: draft.id,
      quoteNumber: draft.quoteNumber,
      language: draft.language,
      createdAt: draft.createdAt,
      quoteType: fixture.trade,
      estimateSource: fixture.measurement.source,
      estimateData: draft.estimateData,
      client: run.review.client,
    },
    company: publicCompany(fixture.company),
    options: { ok: true, visibility: visibilityFor(fixture.config), options: run.options.options },
    website: null,
    urls: {},
  });
  // The two images are this page's own files. The model admits only absolute
  // https URLs (safeHttps — right for what a tenant stored, since the report
  // is a public page), which a same-origin demo asset and the drawn roof are
  // not; set here, after the builder, so nothing in it is loosened.
  const t = estimateReportCopy(report.language);
  return {
    ...report,
    header: { ...report.header, logoUrl: fixture.company.logoUrl },
    property: {
      ...report.property,
      map: { title: report.property.map.title, imageUrl: fixture.measurement.satelliteImageUrl, outline: null, caption: t.mapCaptionNoOutline },
    },
  };
}

/** GET /api/public/quotes/[token]'s shape for the draft once it is sent. */
export function showcaseQuotePayload(fixture, run) {
  const d = run.draft;
  return {
    quoteNumber: d.quoteNumber,
    status: "sent",
    language: d.language,
    notes: null,
    processNotes: null,
    validUntil: null,
    sentAt: d.createdAt,
    subtotal: d.subtotal,
    discount: 0,
    tax: d.tax,
    taxKind: "charged",
    taxAssumedRegion: null,
    total: d.total,
    acceptedTotal: null,
    taxRate: d.taxRate / 100,
    addOns: [],
    client: { name: run.review.client.name },
    company: publicCompany(fixture.company),
    financing: null,
    scopeGroups: [
      {
        label: run.lead.category.label,
        subtotal: d.subtotal,
        accent: null,
        description: "",
        included: [],
        mayChange: [],
        lineItems: d.lineItems.map((l) => ({ description: l.description, quantity: l.quantity, amount: l.amount })),
      },
    ],
    glossary: [],
    processSteps: fixture.presentation.processSteps,
    paymentTerms: null,
    paymentSchedule: [],
    proposal: fixture.presentation.proposal,
  };
}

// Both pages run 7,000–9,000px tall at a phone's width — the company's About,
// photos, documents and nine process steps are most of it, and they are the
// part worth seeing. So the whole page is drawn (maxHeight above any real
// height) inside a phone-screen-tall box the visitor scrolls. The frame stays
// inert; the box around it is what scrolls, and it takes keyboard focus so
// the arrow keys scroll it too.
//
// The box scrolls, so it clips — and SampleFrame's "Sample" tag sits 10px
// above the frame, on its top border. The box's top padding (pt-5, 20px) is
// what keeps that tag inside the clip, clear of the rounded corner; at pt-3
// it had 2px to spare. scripts/check-roofing-example-render.mjs holds the
// padding above the tag's offset.
const WHOLE_PAGE = 20000;

function PhoneScroll({ label, children }) {
  return (
    <div
      className="max-h-[44rem] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card pt-5"
      tabIndex={0}
      role="region"
      aria-label={label}
      data-showcase-scroll
    >
      {children}
    </div>
  );
}

export function ReportPreview({ fixture, run, label }) {
  const report = showcaseReport(fixture, run);
  return (
    <PhoneScroll label={label}>
      <SampleFrame width={390} maxHeight={WHOLE_PAGE} label={label} background="#f5f2ec">
        <ReportView report={report} company={publicCompany(fixture.company)} token="sample" presentation={fixture.presentation} />
      </SampleFrame>
    </PhoneScroll>
  );
}

export function QuotePagePreview({ fixture, run, label }) {
  return (
    <PhoneScroll label={label}>
      <SampleFrame width={390} maxHeight={WHOLE_PAGE} label={label}>
        <QuoteApproval token={null} sample={showcaseQuotePayload(fixture, run)} />
      </SampleFrame>
    </PhoneScroll>
  );
}
