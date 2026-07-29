// app/data/helpArticles.js
//
// The knowledge base content. Articles are structured BLOCKS, not raw
// markdown/HTML on purpose: no parser dependency, and nothing user- or
// model-authored is ever rendered as HTML, so there's no XSS surface. Each
// block is one of: { h }, { p }, { steps: [] }, { note }.
//
// `audience` decides where an article shows:
//   "company"  — the in-app help centre at /app/help (contractors)
//   "platform" — the support runbook at /platform/help (FieldQuo staff)
//   "both"     — appears in both
//
// This is a starter set drawn from how the product actually works and the real
// failure modes support will field. Add the owner's own top FAQs the same way.

export const HELP_CATEGORIES = [
  { key: "getting-started", label: "Getting started" },
  { key: "quoting", label: "Quoting & invoicing" },
  { key: "instant-quotes", label: "Instant quotes" },
  { key: "getting-paid", label: "Getting paid" },
  { key: "email-domains", label: "Email & website" },
  { key: "troubleshooting", label: "Troubleshooting" },
];

export const HELP_ARTICLES = [
  // ── Getting started (company) ──
  {
    slug: "set-up-branding",
    category: "getting-started",
    audience: "company",
    title: "Set up your branding",
    summary: "Your logo and brand colour go on every quote, invoice, email and website.",
    body: [
      { p: "Everything a homeowner sees carries your name, not FieldQuo's. Set your branding once and it flows everywhere." },
      { h: "Steps" },
      { steps: [
        "Go to Settings → Branding.",
        "Upload your logo (PNG, JPG, WebP or SVG, up to 8 MB).",
        "Pick your brand colour — the preview shows how quotes and emails will look.",
        "Save. New documents use it immediately.",
      ] },
      { note: "Contrast is checked automatically, so text stays readable even on a yellow or light-grey brand colour." },
    ],
  },
  {
    slug: "first-quote",
    category: "quoting",
    audience: "company",
    title: "Create and send your first quote",
    summary: "Build a branded quote, send it, and get it approved and paid.",
    body: [
      { h: "Steps" },
      { steps: [
        "Click New → Quote, or open a Request and convert it.",
        "Pick or add the client.",
        "Add services and line items — pricing pulls from your saved rates.",
        "Review the total, then Send. The client gets a branded email with a link to approve and pay.",
      ] },
      { note: "‘Send’ actually emails the client. If a client has no email on file, add one on their record first." },
    ],
  },

  // ── Instant quotes ──
  {
    slug: "turn-on-instant-quotes",
    category: "instant-quotes",
    audience: "company",
    title: "Turn on instant quotes",
    summary: "Let homeowners get a real starting price from your website in seconds.",
    body: [
      { p: "Instant quotes measure a roof from an address (or a lawn the homeowner traces on a map) and price it from YOUR rates. Every one lands in your review queue before it's binding." },
      { h: "Steps" },
      { steps: [
        "Go to Settings → Instant Quotes.",
        "For each trade you offer (roofing, lawn, epoxy, parging, cabinet refacing), edit the materials and sell rates to match your market — the shown figures are typical starting points, not your prices.",
        "Toggle the trade on and Save. It won't go live until you do.",
        "Share your instant-quote link from Settings → Share your links, or add it to your website.",
      ] },
      { note: "Prices are always recomputed on our server from your saved rates — the homeowner's browser never sets a price, and your rate card is never exposed publicly." },
    ],
  },
  {
    slug: "review-instant-estimates",
    category: "instant-quotes",
    audience: "company",
    title: "Review and approve instant estimates",
    summary: "Nothing an estimator generated is binding until someone approves it.",
    body: [
      { p: "When a homeowner gets an instant price, a draft quote is created and flagged for review." },
      { h: "Steps" },
      { steps: [
        "Open Estimate Reviews from the sidebar.",
        "Each card shows what the homeowner saw — the satellite image, measurements and range.",
        "Confirm the price (adjust it if the property needs it), then Approve.",
        "Only then can the quote be sent or shared.",
      ] },
      { note: "Approving requires a supervisor, admin or owner role." },
    ],
  },

  // ── Getting paid ──
  {
    slug: "connect-stripe",
    category: "getting-paid",
    audience: "company",
    title: "Get paid — connect Stripe",
    summary: "Accept card payments on quotes and invoices; payouts go to your bank.",
    body: [
      { h: "Steps" },
      { steps: [
        "Go to Settings → Payments.",
        "Click Connect with Stripe and complete Stripe's onboarding (business details + bank account).",
        "Once Stripe shows charges enabled, a Pay button appears on the documents your clients receive.",
      ] },
      { note: "This is separate from your FieldQuo subscription. Stripe pays you directly; FieldQuo never holds your money." },
    ],
  },

  // ── Email & website ──
  {
    slug: "send-from-your-domain",
    category: "email-domains",
    audience: "company",
    title: "Send from your own email domain",
    summary: "Make quote emails come from you@yourbusiness.com instead of a shared address.",
    body: [
      { h: "Steps" },
      { steps: [
        "Go to Settings → Email Domain and enter your domain.",
        "Add the DNS records shown to your domain host (DKIM, SPF, and a sending subdomain).",
        "Click Verify. Once verified, your quotes send from your own address.",
      ] },
      { note: "Until it's verified, emails still send — just from FieldQuo's shared address, matched to the client's language." },
    ],
  },

  // ── Troubleshooting (company + platform) ──
  {
    slug: "emails-not-arriving",
    category: "troubleshooting",
    audience: "both",
    title: "Client emails aren't arriving",
    summary: "Usually the sending domain isn't verified, so mail is capped to the account owner.",
    body: [
      { p: "If sending shows ‘the sending domain isn't verified’, mail is going out on the shared sandbox address, which only delivers to the platform account owner." },
      { h: "For the company" },
      { steps: [
        "This is a platform-side setup issue, not your account — contact support.",
        "If it's YOUR own domain that's unverified, finish the DNS records under Settings → Email Domain.",
      ] },
      { h: "For platform staff" },
      { steps: [
        "Check /platform — the email-health banner flags an unverified sending domain across all tenants.",
        "Confirm the RESEND_API_KEY in the deployment is current and the sending domain shows ‘verified’ in Resend.",
        "Fastest fix: set EMAIL_FROM to the verified sender in the deployment env, then redeploy — it bypasses domain auto-discovery entirely.",
      ] },
    ],
  },
  {
    slug: "subdomain-not-resolving",
    category: "troubleshooting",
    audience: "platform",
    title: "A tenant's website subdomain won't resolve",
    summary: "‘Can't find the server’ is DNS: the wildcard for *.fieldquo.com must exist.",
    body: [
      { h: "Diagnosis" },
      { steps: [
        "‘Safari can't find the server’ = the hostname doesn't resolve (DNS), not an app error.",
        "Check that *.fieldquo.com resolves to Vercel (a wildcard CNAME → cname.vercel-dns.com, plus the domain added in the Vercel project).",
        "For the SSL certificate, the wildcard needs either Vercel nameservers OR an _acme-challenge NS delegation to Vercel.",
      ] },
      { note: "A 200 with x-matched-path /site/[subdomain] means routing works. A Vercel DEPLOYMENT_NOT_FOUND means the domain isn't attached to the project yet." },
    ],
  },
  {
    slug: "logo-upload-fails",
    category: "troubleshooting",
    audience: "platform",
    title: "Logo / image upload fails with a 403",
    summary: "Cloudinary is rejecting the upload — almost always credentials or key role.",
    body: [
      { h: "Diagnosis" },
      { steps: [
        "A 403 from the upload means Cloudinary refused it (not a bad file).",
        "‘cloud_name mismatch’ = CLOUDINARY_CLOUD_NAME is set to the API-key label instead of the real environment id.",
        "A bare 403 while read calls succeed = the API key's role lacks upload permission — set it to Master admin in Cloudinary.",
        "Confirm all three CLOUDINARY_* vars in the deployment come from the same environment, then redeploy.",
      ] },
    ],
  },
  {
    slug: "read-only-support",
    category: "troubleshooting",
    audience: "platform",
    title: "How read-only support access works",
    summary: "‘Sign in as’ lets staff SEE a company's account but never change it.",
    body: [
      { p: "Impersonation is read-only and superadmin-only, enforced in middleware and again server-side. Every mutating request under a support session is refused." },
      { h: "What this means for support" },
      { steps: [
        "You can view the company's screens to diagnose, but you cannot edit, send, or delete anything.",
        "Talk the customer through the change, or ask them to make it.",
        "Every impersonation session is logged, and any action taken shows in the company's activity log flagged as a support session.",
      ] },
    ],
  },
];

export function articlesFor(audience) {
  return HELP_ARTICLES.filter(
    (a) => a.audience === audience || a.audience === "both",
  );
}

export function findArticle(slug) {
  return HELP_ARTICLES.find((a) => a.slug === slug) || null;
}
