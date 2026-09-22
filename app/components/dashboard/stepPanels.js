// app/components/dashboard/stepPanels.js
//
// Which component each set-up step opens in its dialog on the home page —
// the onboarding checklist's five (lib/onboarding.js) and the "Additional
// set-up steps" card's fourteen (lib/setupSteps.js; the fifteenth, "Invite your
// team", has had its own popup since 2026-09-18 and keeps it).
//
// ══ The rule ═══════════════════════════════════════════════════════════════
//
// Every panel here is the SAME component the settings page renders, not a
// copy of its form. app/components/settings/BrandingForm.js IS Settings >
// Branding; ServicesEditor.js IS Settings > Services; and so on down the
// list. The page and the dialog differ by a `compact` prop that drops the
// page's own heading and the sections the step is not about — never by a
// second form that could drift from the first (AGENTS.md, failure class 4).
// Where the settings page held the fields inline (company details, the tax
// registration, the fixed costs, the Stripe card) they were lifted into a
// component both now render, and the page's own check scripts were pointed
// at the new file rather than loosened.
//
// ══ Two kinds of finish ════════════════════════════════════════════════════
//
// A panel calls ONE of two callbacks:
//
//   onSaved    — the form saved as a whole. The dialog closes, the checklist
//                re-reads itself, and the next unfinished step is offered.
//                Branding, business details, services, pricing, wording,
//                tax registration, availability.
//
//   onChanged  — a row was added, edited or removed in a list that has no
//                single Save. The checklist re-reads itself and the dialog
//                STAYS open, because the reader may have more rows to add;
//                the dialog's Done button is the way out, and offers the
//                next step when pressed. Fixed costs, payment schedule,
//                recipes, add-ons, emails, past jobs, instant quotes.
//
// `leaves` marks the two panels whose one real action hands the browser to
// Stripe (Connect onboarding; Checkout for AI credit). Those dialogs say so
// in a sentence above the button — AGENTS.md: never a dead button, and never
// a button that pretends to stay when it goes.
//
// ══ Loaded on demand ═══════════════════════════════════════════════════════
//
// Every panel is a next/dynamic import. The dashboard is the screen staff
// open most; shipping the services editor, the products catalogue and the
// instant-quote rate cards in its bundle for a dialog most sessions never
// open would slow every one of those opens. The chunk loads when the row is
// tapped, behind the same skeleton the pages show.
"use client";

import dynamic from "next/dynamic";

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="h-6 w-40 bg-accent rounded" />
      <div className="h-40 bg-accent rounded-xl" />
    </div>
  );
}

const lazy = (loader) => dynamic(loader, { ssr: false, loading: Skeleton });

// ── Onboarding (lib/onboarding.js) ───────────────────────────────────────

const BrandingForm = lazy(() => import("@/app/components/settings/BrandingForm"));
const BusinessInfoPanel = lazy(() => import("@/app/components/dashboard/panels/BusinessInfoPanel"));
const ServicesEditor = lazy(() => import("@/app/app/settings/services/ServicesEditor"));
const StripeConnectPanel = lazy(() => import("@/app/components/dashboard/panels/StripeConnectPanel"));
const TaxRegistrationPanel = lazy(() => import("@/app/components/dashboard/panels/TaxRegistrationPanel"));

// ── Additional set-up steps (lib/setupSteps.js) ──────────────────────────

const FixedCostsEditor = lazy(() => import("@/app/app/settings/overhead/FixedCostsEditor"));
const PaymentScheduleEditor = lazy(() => import("@/app/app/settings/company/PaymentScheduleEditor"));
const AiCreditPanel = lazy(() => import("@/app/components/dashboard/panels/AiCreditPanel"));
const InstantQuotesPanel = lazy(() => import("@/app/components/dashboard/panels/InstantQuotesPanel"));
const AvailabilityEditor = lazy(() => import("@/app/app/settings/availability/AvailabilityEditor"));
const MaterialCostsEditor = lazy(() => import("@/app/app/settings/material-costs/MaterialCostsEditor"));
const ProductCatalogue = lazy(() => import("@/app/app/settings/products/ProductCatalogue"));
const EmailTemplatesManager = lazy(() => import("@/app/app/settings/email-templates/EmailTemplatesManager"));
const PastJobsEntry = lazy(() => import("@/app/app/jobs/import/PastJobsEntry"));
// The client proposal's four (2026-09-21). Story / gallery / documents are
// the editors Settings › Presentation renders; reviews is the Google
// Business Profile card from Settings › Reviews.
const StoryEditor = lazy(() => import("@/app/components/settings/StoryEditor"));
const GalleryEditor = lazy(() => import("@/app/components/settings/GalleryEditor"));
const CompanyDocumentsEditor = lazy(() => import("@/app/components/settings/CompanyDocumentsEditor"));
const GoogleReviewsPanel = lazy(() => import("@/app/components/dashboard/panels/GoogleReviewsPanel"));

/**
 * @typedef {object} StepPanel
 * @property {(props: { onSaved: () => void, onChanged: () => void }) => JSX.Element} render
 * @property {"save"|"list"} finish — which callback the panel calls (see the header)
 * @property {boolean} [leaves] — the one action hands the browser to Stripe
 * @property {string} [introKey] — a sentence under the dialog's title
 * @property {string} [introFallback]
 */

/** @type {Record<string, StepPanel>} */
export const STEP_PANELS = {
  logo: {
    finish: "save",
    render: ({ onSaved }) => <BrandingForm compact onSaved={onSaved} />,
  },
  business_info: {
    finish: "save",
    render: ({ onSaved }) => <BusinessInfoPanel onSaved={onSaved} />,
  },
  services: {
    finish: "save",
    introKey: "app.stepDialog.servicesIntro",
    introFallback: "Tick what you offer. A trade with a rate card is priced already; the rest take one rate.",
    render: ({ onSaved }) => <ServicesEditor compact focus="services" onSaved={onSaved} />,
  },
  pricing: {
    finish: "save",
    introKey: "app.stepDialog.pricingIntro",
    introFallback: "One priced service is enough to start quoting. You can refine the rest later.",
    render: ({ onSaved }) => <ServicesEditor compact focus="pricing" onSaved={onSaved} />,
  },
  payments: {
    finish: "list",
    leaves: true,
    render: ({ onChanged }) => <StripeConnectPanel onChanged={onChanged} />,
  },
  tax_registration: {
    finish: "save",
    render: ({ onSaved }) => <TaxRegistrationPanel onSaved={onSaved} />,
  },

  overhead: {
    finish: "list",
    introKey: "app.stepDialog.overheadIntro",
    introFallback: "Rent, insurance, software, the van — what the business costs whether or not there is a job on.",
    render: ({ onChanged }) => <FixedCostsEditor titleTag="h3" onChanged={onChanged} />,
  },
  payment_schedule: {
    finish: "list",
    introKey: "app.paymentSchedule.desc",
    introFallback:
      "Split what's owed across stages tied to the job itself — a deposit when the invoice goes out, the rest at job start, halfway, or completion. Off by default; turn it on by adding a stage below.",
    render: ({ onChanged }) => (
      <PaymentScheduleEditor canEdit onSaved={onChanged} onCleared={onChanged} />
    ),
  },
  story: {
    finish: "save",
    introKey: "app.presentation.story.cardHint",
    introFallback: "The “About us” section on every quote — in your own words.",
    render: ({ onSaved }) => <StoryEditor compact onSaved={onSaved} />,
  },
  gallery: {
    finish: "list",
    introKey: "app.presentation.gallery.cardHint",
    introFallback: "One gallery, shared with your website and quote emails.",
    render: ({ onChanged }) => <GalleryEditor compact onChanged={onChanged} />,
  },
  documents: {
    finish: "list",
    introKey: "app.presentation.documents.cardHint",
    introFallback: "Shown under “Important documents” on every quote; expiry dates are yours, never the client's.",
    render: ({ onChanged }) => <CompanyDocumentsEditor compact onChanged={onChanged} />,
  },
  google_reviews: {
    finish: "list",
    render: ({ onChanged }) => <GoogleReviewsPanel onChanged={onChanged} />,
  },
  quote_process: {
    finish: "save",
    introKey: "app.stepDialog.wordingIntro",
    introFallback: "What a client reads under each service on a quote. The defaults are sound; make them yours.",
    render: ({ onSaved }) => <ServicesEditor compact focus="wording" onSaved={onSaved} />,
  },
  ai_credits: {
    finish: "list",
    leaves: true,
    render: () => <AiCreditPanel />,
  },
  instant_quotes: {
    finish: "list",
    render: ({ onChanged }) => <InstantQuotesPanel onChanged={onChanged} />,
  },
  availability: {
    finish: "save",
    introKey: "app.setAvailability.bookableHint",
    introFallback:
      "When clients can book you on your public calendar and website. Usually a narrower window than your shift.",
    render: ({ onSaved }) => <AvailabilityEditor compact onSaved={onSaved} />,
  },
  materials: {
    finish: "list",
    introKey: "app.setMaterialCosts.subtitle",
    render: ({ onChanged }) => <MaterialCostsEditor compact onChanged={onChanged} />,
  },
  add_ons: {
    finish: "list",
    introKey: "app.setProducts.subtitle",
    render: ({ onChanged }) => <ProductCatalogue compact onChanged={onChanged} />,
  },
  emails: {
    finish: "list",
    introKey: "app.stepDialog.emailsIntro",
    introFallback: "Editing a template's wording opens the full-page editor; everything else happens here.",
    render: ({ onChanged }) => <EmailTemplatesManager compact onChanged={onChanged} />,
  },
  import_jobs: {
    finish: "list",
    render: ({ onChanged }) => <PastJobsEntry compact onChanged={onChanged} />,
  },
};

/** True when the step opens in place; false means the row stays a link. */
export function hasStepPanel(key) {
  return Object.prototype.hasOwnProperty.call(STEP_PANELS, key);
}
