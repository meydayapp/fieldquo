// app/(marketing)/industries/[slug]/showcase/ClientPreviews.js
//
// The two pages the HOMEOWNER is sent, as they render for the showcase
// request — each the real component, inside the signup's SampleFrame
// (app/components/auth/samples/SampleFrame.js): an iframe at a phone's or a
// laptop's width (the Phone / Desktop toggle above each), scaled to the
// column, sandboxed without scripts, behind a visible "Sample" tag. The
// page's own contents move the preview; nothing else inside does anything —
// the guard below stops it before the component sees it, so the call-back
// form, the waiver boxes and the Approve button cannot post.
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

import { useMemo, useRef, useState } from "react";
import SampleFrame from "@/app/components/auth/samples/SampleFrame";
import { PROPOSAL_SECTION_IDS, proposalSectionLabel } from "@/app/components/public/proposal/ProposalSections";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
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
// height) inside a phone-screen-tall box the visitor scrolls. The box takes
// keyboard focus so the arrow keys scroll it too.
//
// The box scrolls, so it clips — and SampleFrame's "Sample" tag sits 10px
// above the frame, on its top border. The box's top padding (pt-5, 20px) is
// what keeps that tag inside the clip, clear of the rounded corner; at pt-3
// it had 2px to spare. scripts/check-roofing-example-render.mjs holds the
// padding above the tag's offset.
const WHOLE_PAGE = 20000;

/** The two widths a preview is drawn at: a phone's, and a laptop's. */
export const PREVIEW_WIDTHS = Object.freeze({ phone: 390, desktop: 1280 });

// ══ Navigable, and nothing more ════════════════════════════════════════════
//
// The owner tapped "About us" in the report preview and nothing happened: the
// frame was inert. Each page's contents ARE its navigation — the report's are
// `<a href="#id">` chips, the quote page's are buttons that scrollIntoView
// the section — and neither can move a frame whose document never scrolls
// (it is exactly as tall as its content; the box around it scrolls). So the
// frame is made navigable (SampleFrame's opt-in `navigable`) and this guard
// sits in the capture phase on the frame's document, ahead of every React
// handler inside it:
//
//   a contents link / button    → the box scrolls to that section
//   any other control           → nothing happens, and "Sample — …" says so:
//                                 no call-back POST, no Approve, no signature,
//                                 no waiver tick, no link out
//
// A contents button is recognised by its label, which both pages print from
// proposalSectionLabel() for the page's own `sections` — the same list and
// the same function used here — so the guard knows every tab the page draws
// and nothing else.
const CONTROL = "a, button, input, textarea, select, label, summary, canvas, [role='button'], [role='checkbox'], [role='tab'], [contenteditable]";

function navigationGuard({ navByLabel, scrollRef, onBlocked }) {
  return (doc, frame) => {
    const sectionFor = (el) => {
      if (!el) return null;
      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        if (!href.startsWith("#") || href.length < 2) return null;
        const id = decodeURIComponent(href.slice(1));
        return doc.getElementById(id) ? id : null;
      }
      if (el.tagName === "BUTTON") {
        const id = navByLabel[String(el.textContent || "").trim()];
        return id && doc.getElementById(id) ? id : null;
      }
      return null;
    };
    const go = (id) => {
      const box = scrollRef.current;
      const target = doc.getElementById(id);
      if (!box || !target) return;
      const frameRect = frame.getBoundingClientRect();
      // The frame is CSS-scaled; offsetHeight is its unscaled height.
      const scale = frame.offsetHeight ? frameRect.height / frame.offsetHeight : 1;
      const y = target.getBoundingClientRect().top * scale;
      const top = box.scrollTop + (frameRect.top - box.getBoundingClientRect().top) + y - 8;
      box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };
    const control = (e) => (typeof e.target?.closest === "function" ? e.target.closest(CONTROL) : null);
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    // A press on a control that is not a contents link never starts: no
    // focus, no stroke on the signature pad, no checkbox half-ticked.
    const press = (e) => {
      const el = control(e);
      if (el && !sectionFor(el)) stop(e);
    };
    const click = (e) => {
      const el = control(e);
      stop(e);
      const id = sectionFor(el);
      if (id) go(id);
      else if (el) onBlocked();
    };
    const submit = (e) => {
      stop(e);
      onBlocked();
    };
    const types = [
      ["pointerdown", press],
      ["mousedown", press],
      ["touchstart", press],
      ["click", click],
      ["dblclick", stop],
      ["submit", submit],
    ];
    for (const [type, fn] of types) doc.addEventListener(type, fn, { capture: true, passive: false });
    return () => {
      for (const [type, fn] of types) doc.removeEventListener(type, fn, { capture: true });
    };
  };
}

/** Phone / Desktop, above a preview. */
export function ViewToggle({ view, onView, copy, name }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label={copy.viewLabel} data-view-toggle={name}>
      <span className="text-xs font-semibold text-muted-foreground">{copy.viewLabel}</span>
      {["phone", "desktop"].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onView(v)}
          aria-pressed={view === v}
          data-view={v}
          className={`min-h-[36px] px-3 rounded-full border text-xs font-semibold ${view === v ? "border-foreground bg-inverted text-inverted-foreground" : "border-border bg-card text-foreground hover:border-foreground/40"}`}
        >
          {v === "phone" ? copy.viewPhone : copy.viewDesktop}
        </button>
      ))}
    </div>
  );
}

function Preview({ label, view, background, navByLabel, blockedCopy, children }) {
  const scrollRef = useRef(null);
  const [blocked, setBlocked] = useState(0);
  const guard = useMemo(() => navigationGuard({ navByLabel, scrollRef, onBlocked: () => setBlocked((n) => n + 1) }), [navByLabel]);
  const width = PREVIEW_WIDTHS[view] || PREVIEW_WIDTHS.phone;
  return (
    <div>
      <div
        ref={scrollRef}
        className="max-h-[44rem] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card pt-5"
        tabIndex={0}
        role="region"
        aria-label={label}
        data-showcase-scroll
        data-preview-view={view}
      >
        <SampleFrame key={view} width={width} maxHeight={WHOLE_PAGE} label={label} background={background} navigable={guard}>
          {children}
        </SampleFrame>
      </div>
      <p className="mt-2 min-h-5 text-xs text-muted-foreground" aria-live="polite" data-preview-blocked={blocked || undefined}>
        {blocked ? blockedCopy : ""}
      </p>
    </div>
  );
}

/** label → section id, for the tabs a page draws from its own `sections`. */
function tabsFor(keys, copy) {
  const out = {};
  for (const k of keys) {
    const label = proposalSectionLabel(k, copy);
    if (label && PROPOSAL_SECTION_IDS[k]) out[String(label).trim()] = PROPOSAL_SECTION_IDS[k];
  }
  return out;
}

export function ReportPreview({ fixture, run, label, view = "phone", copy }) {
  const report = showcaseReport(fixture, run);
  // The report's contents are anchors; the map is only for a button-drawn tab.
  const navByLabel = useMemo(() => ({}), []);
  return (
    <Preview label={label} view={view} background="#f5f2ec" navByLabel={navByLabel} blockedCopy={copy.previewBlocked}>
      <ReportView report={report} company={publicCompany(fixture.company)} token="sample" presentation={fixture.presentation} />
    </Preview>
  );
}

export function QuotePagePreview({ fixture, run, label, view = "phone", copy }) {
  const payload = showcaseQuotePayload(fixture, run);
  // QuoteApproval's own contents list: "project", then the sections the
  // proposal switched on — labelled by proposalSectionLabel in the quote's
  // language, exactly as its tocLink does.
  const sections = payload.proposal?.sections;
  const docLanguage = payload.language;
  const navByLabel = useMemo(
    () => tabsFor(["project", ...(sections || []).filter((k) => PROPOSAL_SECTION_IDS[k])], clientDocCopy(docLanguage)),
    [sections, docLanguage],
  );
  return (
    <Preview label={label} view={view} navByLabel={navByLabel} blockedCopy={copy.previewBlocked}>
      <QuoteApproval token={null} sample={payload} />
    </Preview>
  );
}
