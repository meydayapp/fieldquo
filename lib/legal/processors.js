// lib/legal/processors.js
//
// Every third party that receives data because of how FieldQuo is built —
// the actual list, read out of the code rather than assembled from memory or
// from what a "typical SaaS privacy policy" names. The privacy page renders
// this list; scripts/check-legal-pages.mjs walks the real source tree and
// fails the build if any entry's `verify` pattern can no longer be found —
// so a processor can't quietly stay in the policy after the integration
// that justified it is gone, and (short of someone hand-editing this file
// to match a mistake) a processor can't be added to the product without the
// same PR having to touch this file for the check to keep passing.
//
// ── What "verify" proves, and what it doesn't ──────────────────────────────
//
// Each pattern is matched against the real app/lib source tree, excluding
// this directory and the marketing pages that describe the list — so the
// check is against the INTEGRATION, not against its own description of
// itself. That proves the processor is genuinely wired into the product. It
// does NOT prove the `dataShared` description is complete or that the
// integration hasn't changed shape — that is still a human judgement call
// each time one of these files is touched, the same as any other fact in
// this document.
//
// ── No data residency claim, anywhere ───────────────────────────────────────
//
// Not one of these integrations pins a region/country in this codebase — no
// Stripe account country lock, no Cloudinary region, no Neon project region
// checked in, nothing. So the privacy policy doesn't claim one. If that
// changes (a data-residency requirement from a customer, a Neon project
// pinned to a specific region, etc.) it needs to be verified in the
// infrastructure config, written down here, and only THEN stated publicly.

export const PROCESSORS = [
  {
    id: "neon",
    name: "Neon",
    role: "Database hosting",
    dataShared:
      "Every table FieldQuo writes to — companies, staff accounts, clients, quotes, invoices, jobs, call and message logs, everything. This is the single database behind the whole product.",
    verify: {
      // Not something `grep` finds IN the app code — a Postgres connection
      // string doesn't name its host. AGENTS.md's stack table is the
      // checked-in source of truth for which Postgres host this is.
      description: "AGENTS.md documents Neon as the Postgres host",
      pattern: /Neon Postgres/,
      files: ["AGENTS.md"],
    },
  },
  {
    id: "stripe-connect",
    name: "Stripe (Connect)",
    role: "Payment processing — a homeowner paying a contractor",
    dataShared:
      "A homeowner's card details, when they pay an invoice or a booking fee. The charge is created on FieldQuo's platform Stripe account and the funds are transferred to the contracting company's own connected Stripe account — FieldQuo's servers never store the card number itself; Stripe does.",
    verify: {
      description: "lib/stripe.js creates Connect destination charges",
      pattern: /transfer_data/,
      roots: ["lib/stripe.js", "lib/stripe"],
    },
  },
  {
    id: "stripe-billing",
    name: "Stripe (Billing)",
    role: "Payment processing — a contractor paying FieldQuo",
    dataShared:
      "A contracting company's own card details and billing contact, for their FieldQuo subscription. Separate from Stripe Connect above — this is FieldQuo getting paid, not a homeowner.",
    verify: {
      description: "lib/platform/stripeBilling.js runs FieldQuo's own subscription billing",
      pattern: /Stripe/,
      roots: ["lib/platform/stripeBilling.js"],
    },
  },
  {
    id: "stripe-service-plans",
    name: "Stripe (saved payment methods)",
    role: "Payment processing — automatic recurring payments a homeowner authorises",
    dataShared:
      "A homeowner's saved payment method, for a recurring service plan they've agreed to (e.g. a seasonal maintenance contract billed automatically). We also record the IP address and browser user agent present when they authorise it, because Stripe's rules for charging a saved payment method without the cardholder present require us to be able to show that authorisation happened.",
    verify: {
      description: "app/api/plan/[token]/route.js records acceptedIp/acceptedAgent on authorisation",
      pattern: /acceptedIp/,
      roots: ["app/api/plan"],
    },
  },
  {
    id: "resend",
    name: "Resend",
    role: "Outbound email delivery",
    dataShared:
      "Every email FieldQuo sends on a company's behalf passes through Resend to be delivered — the recipient's address and the full content of whatever was sent: a quote, an invoice, a booking confirmation, a marketing message.",
    verify: {
      description: "lib/email/resend.js sends mail through Resend",
      pattern: /resend/i,
      roots: ["lib/email/resend.js"],
    },
  },
  {
    id: "twilio",
    name: "Twilio",
    role: "SMS delivery",
    dataShared:
      "A homeowner's phone number and the content of text messages sent to or received from them — appointment reminders, booking confirmations, and STOP/START opt-out replies.",
    verify: {
      description: "lib/sms/twilioClient.js sends SMS through Twilio",
      pattern: /twilio/i,
      roots: ["lib/sms/twilioClient.js"],
    },
  },
  {
    id: "cloudinary",
    name: "Cloudinary",
    role: "Image storage and delivery",
    dataShared:
      "Photos uploaded into the product — job-site photos, photos a homeowner attaches to a quote request, and images used on a company's generated website.",
    verify: {
      description: "lib/cloudinary.js uploads and serves images through Cloudinary",
      pattern: /cloudinary/i,
      roots: ["lib/cloudinary.js"],
    },
  },
  {
    id: "openai",
    name: "OpenAI",
    role: "AI features",
    dataShared:
      "Property photos (when a quote is reviewed, and on the paid deep photo review), call transcripts (to recover a lead from a missed call, draft a quote from a call, and build the monthly activity digest), and — for the FieldQuo AI assistant built into the product — a client's NAME ONLY, never their contact details, address, or financial history. See \"How we use AI\" below for what each of these is for.",
    verify: {
      description: "lib/ai/provider.js is the sole integration point with OpenAI",
      pattern: /openai/i,
      roots: ["lib/ai/provider.js"],
    },
  },
  {
    id: "retell",
    name: "Retell",
    role: "AI phone answering",
    dataShared:
      "For companies using the AI phone receptionist: the live call audio, the recording, and the transcript of every call it takes.",
    verify: {
      description: "lib/voice/retell.js is the sole integration point with Retell",
      pattern: /retell/i,
      roots: ["lib/voice/retell.js"],
    },
  },
  {
    id: "vercel",
    name: "Vercel",
    role: "Hosting",
    dataShared:
      "FieldQuo runs on Vercel's infrastructure — all traffic to the product passes through it.",
    verify: {
      description: "docs/VERCEL.md documents Vercel as the hosting platform",
      pattern: /Vercel/,
      files: ["docs/VERCEL.md"],
    },
  },
  {
    id: "google-maps",
    name: "Google Maps",
    role: "Address autocomplete and mapping",
    dataShared:
      "An address as a homeowner or contractor types it, for autocomplete, and the address on a job for map display.",
    verify: {
      description: "Google Maps API calls appear in the address/measurement code",
      pattern: /maps\.googleapis\.com/,
      roots: ["lib", "app"],
    },
  },
  {
    id: "unsplash",
    name: "Unsplash",
    role: "Stock photography, loaded from Unsplash's own servers",
    dataShared:
      "No personal information is SENT to Unsplash by us. But a new company website starts with stock photos in its decorative slots, and those are hotlinked rather than copied — so a homeowner visiting a contractor's site makes a request to Unsplash's image servers, which sees their IP address and browser. The same applies to stock photos placed in the Marketing Designer. Uploading real photos replaces them.",
    verify: {
      description: "lib/site/placeholderImages.js hotlinks images.unsplash.com into generated sites",
      pattern: /images\.unsplash\.com/,
      roots: ["lib/site/placeholderImages.js"],
    },
  },
  {
    id: "youtube",
    name: "YouTube (Google)",
    role: "Video embedded on FieldQuo's own marketing pages",
    dataShared:
      "A visitor's IP address and browser, when a FieldQuo marketing page with a video on it loads. We use YouTube's no-cookie embed domain, which does not set a tracking cookie before the visitor presses play — but the request to Google still happens. This is FieldQuo's own website, not a contractor's.",
    verify: {
      description: "the industry marketing pages embed youtube-nocookie.com",
      pattern: /youtube-nocookie\.com/,
      roots: ["app/(marketing)"],
    },
  },
  {
    id: "google-solar",
    name: "Google Solar",
    role: "Roof measurement",
    dataShared:
      "A property's address, sent to estimate roof area and shape for a self-serve roofing quote.",
    verify: {
      description: "lib/measure/roofMeasurement.js calls the Solar API",
      pattern: /solar\.googleapis\.com/,
      roots: ["lib/measure/roofMeasurement.js"],
    },
  },
  {
    id: "meta-content-publishing",
    name: "Meta (Facebook & Instagram)",
    role: "Social media publishing — posting a company's own ad to its own Page/Instagram account",
    dataShared:
      "Only when a company chooses to publish a Marketing Designer ad: the rendered image (fetched by Meta from a public, unlisted Cloudinary URL — see lib/social/metaSpecs.js), the caption text, and the company's own connected Page/Instagram account id and access token. No homeowner data is involved — the asset being published is the company's own advertisement, not a client record. Distinct from a separate ads-insights import, if one exists, which reads spend FROM Meta rather than posting content TO it.",
    verify: {
      description: "lib/social/metaGraphClient.js is the sole caller of the Graph API's publishing endpoints",
      pattern: /graph\.facebook\.com/,
      roots: ["lib/social/metaGraphClient.js"],
    },
  },
];
