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
  { key: "funnels", label: "Lead funnels" },
  { key: "instant-quotes", label: "Instant quotes" },
  { key: "getting-paid", label: "Getting paid" },
  { key: "email-domains", label: "Email & website" },
  { key: "team-scheduling", label: "Team & scheduling" },
  { key: "reports", label: "Reports & insights" },
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
  {
    slug: "offer-financing",
    category: "getting-paid",
    audience: "company",
    title: "Let clients pay over time (Affirm)",
    summary: "Offer monthly payments on invoices while you're still paid in full, up front.",
    body: [
      { p: "Affirm lets your client split an invoice into monthly payments at checkout. You're paid the full amount right away — Affirm covers the rest and collects from the client. It appears next to the card option on the pay page." },
      { h: "Turn it on" },
      { steps: [
        "First activate Affirm in your Stripe dashboard (Stripe → Settings → Payment methods → Affirm). FieldQuo can't do this step for you.",
        "In FieldQuo, go to Settings → Payments and switch on 'Offer pay-over-time (Affirm)'.",
        "Send an invoice as usual — Affirm shows at checkout for eligible amounts.",
      ] },
      { note: "Available on invoices between $50 and $30,000 in USD or CAD. If Affirm isn't active on your Stripe account yet, the pay link quietly falls back to card only — it never breaks." },
    ],
  },
  {
    slug: "import-subcontractor-quote",
    category: "quoting",
    audience: "company",
    title: "Add a subcontractor's quote to your own",
    summary: "Got a quote from another FieldQuo contractor? Pull it into your quote as a marked-up cost.",
    body: [
      { p: "If another company that uses FieldQuo sends you a quote — say an electrician quoting a job you're bidding as the general contractor — you can add their price to your own quote as a cost, mark it up, and it becomes a line your client sees. You pay the subcontractor their price; your client sees only your marked-up total, never the subcontractor or your markup." },
      { h: "How to add it" },
      { steps: [
        "Open the quote link they emailed you, while signed in to FieldQuo.",
        "In the panel below their quote, choose which of your open quotes to add it to.",
        "Pick a markup (10/20/30% or custom) to cover your profit and overhead, and choose whether it shows as one blended line or itemised.",
        "Click Add to my quote.",
      ] },
      { h: "Changing or swapping it later" },
      { steps: [
        "On your quote's page, the 'Subcontractor costs' section lists everything you imported.",
        "Use the pencil to change the markup any time before the quote is decided — your client price updates automatically.",
        "Use the trash icon to remove one — for example, to drop a losing bid and add the one you're going with instead.",
      ] },
      { note: "The subcontractor's price is fixed (it's the quote they gave you), so it's read-only in the quote editor — but your markup is always yours to change. Once your client approves and the job starts, the subcontractor cost flows into that job's costs automatically." },
    ],
  },
  {
    slug: "quote-used-by-another-company",
    category: "quoting",
    audience: "company",
    title: "When your quote is used in another company's project",
    summary: "What the 'Used in another company's quote' note and its status mean.",
    body: [
      { p: "When another FieldQuo company adds one of your quotes to their own project as a cost, a note appears on that quote's page — 'Used in another company's quote' — with a status showing where it stands." },
      { h: "What each status means" },
      { steps: [
        "Pending their client's approval — they've chosen your quote, but their own client hasn't approved yet. You're the frontrunner, not hired.",
        "Confirmed — their client approved, or the job has started. You're good to go.",
        "Not proceeding — their quote was declined, so this job isn't happening.",
      ] },
      { note: "You never see their markup or what they charge their client — that stays their business. You only see that your quote was used and where it stands." },
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
    summary: "A board that shows the hottest leads first, with everything you need on one card.",
    body: [
      { p: "The Leads board has a column per stage — New, Contacted, Won and Lost — and every lead is scored hot, warm or cold so you know who to call back first." },
      { h: "Steps" },
      { steps: [
        "Open Leads. Use the search box, the Hot/Warm/Cold filter, or the Hottest/Newest toggle to find what matters.",
        "Click any lead to open its detail panel — the score and why, their budget and timeline, photos, and their message.",
        "Assign an owner, and log a call-back note so the next person knows where things stand.",
        "Move the lead along with the status buttons, or hit Convert to quote to turn it into a draft quote in one tap.",
        "If it goes nowhere, mark it Lost so your board stays honest.",
      ] },
      { note: "Convert to quote carries the client, service, photos and their answers straight onto a new draft quote — no re-typing." },
    ],
  },
  {
    slug: "lead-scoring",
    category: "booking-leads",
    audience: "company",
    title: "How leads are scored hot, warm or cold",
    summary: "Every lead is triaged automatically so you call the ready-to-buy ones back first.",
    body: [
      { p: "The moment a lead arrives — from your quote form, funnel, booking page, kitchen designer or phone assistant — FieldQuo scores it and labels it hot, warm or cold." },
      { h: "What drives the score" },
      { steps: [
        "Timeline — someone starting ASAP scores far higher than someone just exploring.",
        "Budget — the range they picked (a bigger job is a bigger, more committed one).",
        "Emergencies — a burst pipe or storm damage counts as hot whatever the budget.",
        "How reachable they are — a phone number is worth more than an email.",
        "Effort — photos, a drawn kitchen or a detailed description all lift the score.",
      ] },
      { note: "Open any lead to see the exact reasons behind its score. You can edit the budget or timeline and it re-scores on the spot — the number is never a black box you have to trust blind." },
    ],
  },
  {
    slug: "paid-visit-fees",
    category: "booking-leads",
    audience: "company",
    title: "Charge for an estimate visit (and credit it back)",
    summary: "Collect a visit fee by card at booking, then credit it onto the job if they hire you.",
    body: [
      { p: "Some trades charge for the site visit — say $79 — and refund it onto the invoice if the client goes ahead. FieldQuo does this end to end." },
      { h: "Steps" },
      { steps: [
        "Connect Stripe first (Settings → Payments) — the fee is charged through your own Stripe account.",
        "In Settings → Booking page, set a visit fee on an event type. You can also set a promo price (e.g. a $20 estimate special) and turn it on or off.",
        "When a client books that visit, they pay by card before the slot is confirmed.",
        "Later, open their invoice and use Credit visit fee to apply what they paid — one tap, and reversible.",
      ] },
      { note: "Without Stripe connected you can't set a fee — FieldQuo never shows a price it can't actually collect." },
    ],
  },

  // ── Lead funnels ──
  {
    slug: "funnels-what",
    category: "funnels",
    audience: "company",
    title: "What a lead funnel is",
    summary: "A quick, tap-through quiz for your ads and link-in-bio that turns a click into a booked lead.",
    body: [
      { p: "A funnel is a full-screen, mobile-first quiz a stranger taps through — one question per screen, like an Instagram Story. It's built for ad traffic: someone taps your TikTok or Instagram ad, answers a few questions, and lands in your Leads pipeline already qualified." },
      { p: "Because the funnel asks their budget and timeline, the lead arrives already scored hot, warm or cold — no chasing tyre-kickers." },
      { note: "The funnel shows no prices and looks like your business, not FieldQuo — your logo, your colour, your name." },
    ],
  },
  {
    slug: "funnels-build",
    category: "funnels",
    audience: "company",
    title: "Build a funnel (template or AI)",
    summary: "Start from a channel template or describe it and let AI write it, then edit and publish.",
    body: [
      { h: "Steps" },
      { steps: [
        "Open Funnels → New funnel.",
        "Pick a template (TikTok, Instagram, YouTube or Web), or type what you want and let AI build it from your services.",
        "In the builder, edit any step — the hook, the questions and answers, the contact form — with a live preview beside you.",
        "Add or reorder steps from the left. Each answer can branch to a different next step.",
        "Hit Publish, then Copy link and drop it on your ad, your bio, or a QR code.",
      ] },
      { note: "You can't publish a funnel that has no contact step — a funnel that collects nothing is never published by accident." },
    ],
  },
  {
    slug: "funnels-track",
    category: "funnels",
    audience: "company",
    title: "Track funnel performance",
    summary: "See where people drop off, and wire up ad pixels so your campaigns optimise for real leads.",
    body: [
      { p: "Open a funnel to see how many people started it, how many became leads, and your conversion rate — plus a per-step breakdown showing exactly where people quit." },
      { h: "Optional: ad pixels" },
      { steps: [
        "In the builder, open Ad tracking pixels.",
        "Paste your Meta, TikTok or GA4 ID.",
        "Now your ad platform can optimise toward booked leads, not just clicks.",
      ] },
      { note: "If lots of people quit at one question, that's your cue to reword or remove it." },
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
  {
    slug: "recurring-jobs",
    category: "jobs-clients",
    audience: "company",
    title: "Set up a repeating job",
    summary: "For maintenance, cleaning, or seasonal work that happens on a schedule.",
    body: [
      { p: "If you service the same client on a regular cadence — weekly lawn care, monthly cleaning, quarterly maintenance — you can mark a job as recurring instead of re-creating it each time." },
      { h: "Steps" },
      { steps: [
        "Go to Jobs → New job (or open a job and Edit).",
        "Turn on Recurring and choose how often it repeats.",
        "Save. The next visit is scheduled automatically on the cadence you set.",
      ] },
      { note: "Each occurrence is its own visit you can reschedule, add notes/photos to, and invoice separately — changing one doesn't rewrite the others." },
    ],
  },
  {
    slug: "track-expenses",
    category: "jobs-clients",
    audience: "company",
    title: "Track expenses and tie them to a job",
    summary: "Record what you spend so your job costs — materials, subcontractors, overhead — are captured.",
    body: [
      { p: "FieldQuo keeps your costs alongside your revenue so you can see where the money goes, not just what came in." },
      { h: "Record an expense" },
      { steps: [
        "Go to Settings → Expense tracking.",
        "Add an expense — amount, category, and the date.",
        "Associate it with a specific job when it belongs to one, or mark it as overhead when it's a general business cost.",
      ] },
      { h: "Where costs come from automatically" },
      { steps: [
        "Subcontractor quotes you import onto a quote become job expenses once that quote turns into a job.",
        "Overhead you set in Settings → Overhead is factored into your pricing.",
        "Materials you configure in Settings → Materials feed cost estimates on quotes.",
      ] },
      { note: "Restricted team members only see the expenses they entered; owners and admins see all of them." },
    ],
  },
  {
    slug: "reports-and-insights",
    category: "reports",
    audience: "company",
    title: "See how your business is doing",
    summary: "Your dashboard, the monthly digest, and how you compare — where to find the numbers.",
    body: [
      { p: "FieldQuo pulls your quotes, jobs and payments together into a few plain-English views so you don't have to build a spreadsheet." },
      { h: "Where to look" },
      { steps: [
        "Dashboard (Home) — your revenue goal, recent quotes, and what's coming up.",
        "Monthly Digest (Analytics → Monthly Digest) — a monthly summary of what happened in your business.",
        "How You Compare (Analytics → How You Compare) — how your numbers stack up as a benchmark.",
        "FieldQuo AI — ask questions about your own quotes, jobs and invoices in plain language.",
      ] },
      { note: "Every number here is your company's own data. FieldQuo AI never sees another company's information, and comparisons use anonymised figures." },
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
