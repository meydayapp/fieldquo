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
  { key: "jobs-clients", label: "Jobs & clients" },
  { key: "booking-leads", label: "Booking & leads" },
  { key: "instant-quotes", label: "Instant quotes" },
  { key: "getting-paid", label: "Getting paid" },
  { key: "email-domains", label: "Email & website" },
  { key: "team-scheduling", label: "Team & scheduling" },
  { key: "on-the-go", label: "On the go (mobile)" },
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

  // ── Website ──
  {
    slug: "create-your-website",
    category: "email-domains",
    audience: "company",
    title: "How to build your website",
    summary: "Generate a branded one-page site from your business details in a couple of minutes.",
    body: [
      { p: "FieldQuo builds you a real one-page website from what it already knows about your business — your services, brand colour, logo and photos. No page-building from scratch." },
      { h: "Steps" },
      { steps: [
        "Go to Settings → Website.",
        "Answer the short interview (what your business does, the tone you want). This guides the copy.",
        "Click Generate. FieldQuo writes the sections — hero, services, work, booking, FAQ and contact — and shows a live preview.",
        "Edit any section inline: change text, add or remove FAQ and testimonial items, and upload your own photos.",
        "Publish. Your site goes live on your subdomain (see Settings → Website for the address).",
      ] },
      { note: "Regenerating rewrites the wording only — your uploaded photos, services and testimonials are kept. Add your own photos any time; the AI never invents a service you don't offer." },
    ],
  },

  // ── Team & scheduling ──
  {
    slug: "change-availability",
    category: "team-scheduling",
    audience: "company",
    title: "How to change your availability",
    summary: "Set the hours you can be booked online — separate from your opening hours.",
    body: [
      { p: "Availability is when clients can book you online. It's deliberately separate from your business's opening hours — the office can be open on a day nobody is free to visit a site." },
      { h: "Steps" },
      { steps: [
        "Go to Settings → Availability.",
        "For each day, set the time ranges you're open to bookings (or mark the day off).",
        "Save. Your booking page and any 'pick a time' flow immediately reflect it.",
      ] },
      { note: "Each team member has their own availability. To see everyone's at once, use Scheduling → Team schedule." },
    ],
  },
  {
    slug: "schedule-shifts",
    category: "team-scheduling",
    audience: "company",
    title: "How to schedule your team's shifts",
    summary: "Draft shifts for the week, then publish them so your crew can see their schedule.",
    body: [
      { p: "Shift scheduling lets a manager plan who works when, then publish it. Workers only see shifts once they're published, so a half-built week never lands on someone's phone." },
      { h: "Steps" },
      { steps: [
        "Open Scheduling from the sidebar (People group).",
        "Use the arrows to land on the week you want.",
        "Click Add shift, pick the worker, day, start and end time, and an optional note (site address, what to bring).",
        "Repeat for the week. Draft shifts show a 'Draft' badge — only you can see them.",
        "Click Publish week. Now each worker sees their own shifts.",
      ] },
      { note: "Editing or deleting a published shift updates what the worker sees. Scheduling is planning only — it doesn't pay anyone; hours come from the time clock." },
    ],
  },
  {
    slug: "time-clock",
    category: "team-scheduling",
    audience: "company",
    title: "How the time clock works",
    summary: "Workers clock in and out from their phone; hours flow to timesheets for approval.",
    body: [
      { p: "The time clock is where an hourly worker punches in and out. It records real hours worked (different from the shifts you scheduled)." },
      { h: "For the worker" },
      { steps: [
        "Open Time clock from the sidebar.",
        "Tap the big green Clock in button when you start. A live timer runs while you're on the clock.",
        "Tap the red Clock out button when you finish. Today's total updates.",
      ] },
      { h: "For the manager" },
      { steps: [
        "A worker only appears on the clock once they're added under Team → Workers and linked to a login.",
        "Clocked hours land in Timesheets for you to review and approve.",
      ] },
      { note: "The clock only records time — it never moves money. Approved hours are what payroll reads." },
    ],
  },
  {
    slug: "timesheets",
    category: "team-scheduling",
    audience: "company",
    title: "How to do timesheets",
    summary: "Review, add, edit and approve the hours your team worked.",
    body: [
      { p: "Timesheets are the manager's view of everyone's hours — from the time clock, or added by hand. Approving is what makes hours count toward pay." },
      { h: "Steps" },
      { steps: [
        "Go to Team → Timesheets.",
        "To log hours manually, click Add entry, pick the worker, the date and start/end times.",
        "For someone still on the clock, you can Clock out their open entry.",
        "Check each entry, then Approve. Only approved hours flow to payroll.",
        "A wrong entry can be deleted while it's still unapproved.",
      ] },
      { note: "The system computes the hours from the times — you never type a total, so the number can't drift from the timestamps." },
    ],
  },
  {
    slug: "invite-team",
    category: "team-scheduling",
    audience: "company",
    title: "How to add a team member",
    summary: "Invite staff and set what they can see and do.",
    body: [
      { h: "Steps" },
      { steps: [
        "Go to Settings → Team, then New user.",
        "Enter their name, email and role (admin, supervisor or employee).",
        "Set their access and, if hourly, their pay rate.",
        "Save. They get an email invite to set up their own login; your settings apply automatically once they accept.",
      ] },
      { note: "Roles gate what someone can do — an employee can't see the whole team's schedule or payroll. You can fine-tune access per person." },
    ],
  },
  {
    slug: "time-off",
    category: "team-scheduling",
    audience: "company",
    title: "How to handle time off",
    summary: "Set leave policies and approve requests.",
    body: [
      { h: "Steps" },
      { steps: [
        "Set your policies under Settings → Leave (types, how much accrues).",
        "Team members request time off from the Time off screen.",
        "Approve or decline from the same screen — approved time off shows on the team schedule.",
      ] },
    ],
  },

  // ── Jobs & clients ──
  {
    slug: "add-clients",
    category: "jobs-clients",
    audience: "company",
    title: "Add and manage your clients",
    summary: "Your client list is the address book every quote, job and invoice pulls from.",
    body: [
      { p: "A client only has to be added once — after that they're a click away on any quote, job or invoice." },
      { h: "Steps" },
      { steps: [
        "Go to Clients → New client.",
        "Enter their name and at least one way to reach them (email or phone). Email lets you send quotes and invoices; phone lets you send texts.",
        "Add their address if you want it on documents and to plan travel time.",
        "Save. They'll now appear when you start a quote, job or invoice.",
      ] },
      { note: "Have a spreadsheet of clients? Use Clients → Import to bring them all in at once." },
    ],
  },
  {
    slug: "manage-jobs",
    category: "jobs-clients",
    audience: "company",
    title: "Turn an accepted quote into a scheduled job",
    summary: "When a client accepts a quote, a job is created — put it on the calendar and track the work.",
    body: [
      { p: "A job is the actual work: scheduled visits, notes, photos and, when it's done, the invoice." },
      { h: "Steps" },
      { steps: [
        "When a client accepts a quote, a job is created automatically — find it under Jobs (new ones show as “Needs a date”).",
        "Open the job and add a visit: pick the date and, if you have a team, who's going.",
        "On the day, the crew can add notes and photos to the visit.",
        "When the work is finished, mark the job complete — then create the invoice from it.",
      ] },
      { note: "You can also create a job directly with Jobs → New job if there was no quote." },
    ],
  },

  // ── Quoting & invoicing ──
  {
    slug: "create-invoice",
    category: "quoting",
    audience: "company",
    title: "Create and send an invoice",
    summary: "Bill a client for completed work — and let them pay online.",
    body: [
      { h: "Steps" },
      { steps: [
        "Click New → Invoice (or open a completed job and invoice it — the line items carry over).",
        "Pick the client, check the line items and total, and set a due date.",
        "Save & Send — this emails the invoice to the client's email on file, with a link to pay.",
      ] },
      { note: "No email goes out if the client has no email on their record. Add one first, or send them the invoice link yourself." },
    ],
  },

  // ── Getting paid ──
  {
    slug: "record-payment",
    category: "getting-paid",
    audience: "company",
    title: "Record a payment",
    summary: "Mark an invoice paid — automatically when they pay online, or by hand for cash and cheques.",
    body: [
      { p: "Online card payments (once Stripe is connected) mark themselves paid. For cash, cheque or e-transfer, record it yourself so your numbers stay right." },
      { h: "Steps" },
      { steps: [
        "Open the invoice.",
        "Choose Record payment, enter the amount and how they paid.",
        "The invoice updates to paid (or part-paid), and it counts toward your revenue and cash-flow figures.",
      ] },
    ],
  },

  // ── Booking & leads ──
  {
    slug: "online-booking",
    category: "booking-leads",
    audience: "company",
    title: "Let clients book you online",
    summary: "Share one link and let homeowners pick a time from your real availability.",
    body: [
      { p: "The booking page shows only the times you're actually free, so you never get double-booked." },
      { h: "Steps" },
      { steps: [
        "Set when you're available under Settings → Availability.",
        "Open Settings → Booking page to see your booking link and adjust visit length and buffer.",
        "Share the link — on your website, in texts, in your email signature.",
        "Bookings land on your schedule automatically, and the client gets a confirmation.",
      ] },
    ],
  },
  {
    slug: "lead-form",
    category: "booking-leads",
    audience: "company",
    title: "Capture leads with your quote-request form",
    summary: "A form homeowners fill in to ask for a quote — it becomes a lead you can follow up.",
    body: [
      { h: "Steps" },
      { steps: [
        "Set up what you ask for under Settings → Lead form.",
        "Add the form to your FieldQuo website, or share its link.",
        "Every submission shows up under Leads, with the details and any photos the homeowner attached.",
        "Turn a promising one into a quote with a click.",
      ] },
      { note: "The public form never shows your prices — it collects what you need to quote, nothing more." },
    ],
  },
  {
    slug: "work-leads",
    category: "booking-leads",
    audience: "company",
    title: "Work your leads pipeline",
    summary: "Move each lead from New to Won so nothing falls through the cracks.",
    body: [
      { p: "The Leads board has a column per stage: New, Contacted, Converted (Won) and Lost." },
      { h: "Steps" },
      { steps: [
        "Open Leads. New requests land in the first column.",
        "Once you've reached out, use Mark contacted to move it along.",
        "When they accept, Mark won — or send them a quote, which does it for you.",
        "If it goes nowhere, mark it Lost so your board stays honest.",
      ] },
    ],
  },

  // ── FieldQuo AI ──
  {
    slug: "fieldquo-ai",
    category: "getting-started",
    audience: "company",
    title: "Ask FieldQuo AI about your business",
    summary: "A built-in assistant that answers questions about your own numbers, quotes and jobs.",
    body: [
      { p: "FieldQuo AI reads your own data — never anyone else's — and answers in plain language. It can also draft client messages for you." },
      { h: "Try asking" },
      { steps: [
        "“What's my quote-to-job conversion this month?”",
        "“Are there any notes on next week's jobs?”",
        "“How's the Smith job going — are we over the hours we quoted?”",
        "“Draft a friendly reminder for invoice #1042.”",
      ] },
      { note: "It only answers about your business. It won't write essays or answer trivia — that keeps it fast and focused." },
    ],
  },

  // ── On the go (mobile) ──
  {
    slug: "mobile-basics",
    category: "on-the-go",
    audience: "company",
    title: "Using FieldQuo on your phone",
    summary: "Everything works in your phone's browser — no app to install.",
    body: [
      { p: "Open FieldQuo in your phone's browser and sign in. It's built for a phone in a driveway on a slow connection." },
      { h: "Getting around" },
      { steps: [
        "Tap the menu icon (top-left) to open the navigation, then tap where you want to go.",
        "Use the “+” Create button for a fast new quote, job or invoice.",
        "Add it to your home screen (your browser's Share → Add to Home Screen) so it opens like an app.",
      ] },
    ],
  },
  {
    slug: "mobile-clock",
    category: "on-the-go",
    audience: "company",
    title: "Clock in and check your schedule on the go",
    summary: "For crews in the field: see today's work and track your hours from your phone.",
    body: [
      { h: "Steps" },
      { steps: [
        "Open the menu and go to Clock to clock in when you start and out when you finish — your hours are recorded for timesheets.",
        "Check Schedule to see the visits assigned to you.",
        "On a job's visit, add notes and photos while you're on site.",
      ] },
      { note: "You only see your own published shifts and the jobs assigned to you — not the whole company's." },
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
