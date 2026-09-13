// content/help/en/leads-and-quotes-3.js
//
// Part 3 of the “leads-and-quotes” category in English (see the composer,
// leads-and-quotes.js). Slugs assigned to this part by lib/help/tree.js:
// edit-a-sent-quote, convert-a-quote-to-a-job, quotes-sent-with-no-response,
// estimate-reviews, instant-quotes-on-your-website, the-self-quote-form,
// aerial-roof-measurement, the-kitchen-designer, call-to-quote,
// import-a-subcontractor-quote, references-and-photos-in-the-quote-email,
// scope-of-work-and-terms, the-large-quote-alert.
//
// Every sentence is read off the code: lib/quotes/quoteLifecycle.js and
// PATCH /api/quotes/[id] (editing and acceptance), lib/quotes/listRanking.js
// and app/api/cron/follow-ups (unanswered quotes), lib/estimate/* and
// app/api/quotes/[id]/approve-estimate (instant estimates and their review),
// lib/measure/roofMeasurement.js (Google Solar), lib/kitchen/* (the designer),
// lib/ai/callQuoteDraft.js + lib/estimate/callEstimate.js (calls),
// lib/quotes/importQuote.js (subcontractor imports), lib/quotes/emailSections.js
// (references and photos), lib/documents/contractTerms.js (scope and terms)
// and app/api/cron/large-quote-check (the alert). The words on the screens
// are the `en` strings of app/i18n/appMessages.js. “Only in FieldQuo” claims
// are what lib/marketing/parity.js's neverListed() returns for each
// competitor's own pricing page — never an assertion.
export const ARTICLES = {
  "edit-a-sent-quote": {
    title: "Edit a quote that was already sent",
    summary:
      "A sent quote can still be edited in place — the link the client holds shows the new version, and Send again emails a fresh copy — until the client accepts or declines.",
    updated: "2026-09-12",
    intro: [
      "A quote is not frozen the moment it leaves. Until the client answers it, a sent quote is edited exactly like a draft: same builder, same lines, same Save changes button. What changes is what the client sees — the link in their inbox opens the live quote, so an edit is visible to them the moment you save it, whether or not you email again.",
      "Once the client has accepted or declined, the line items lock. This article covers both states, and what Send again does.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Open the quote and press **Edit**. It opens the same builder you used to write it, in edit mode, with the stored lines already in place. Stored lines are edited as lines — they are not re-derived from your rate card, so a quote you sent last month keeps last month's prices even if you raised a rate since." },
          { p: "The quote's status stays **Sent** after an edit. FieldQuo does not create a second version of a quote: an edit replaces what was there, and the approval link the client already has shows the replacement. (Invoices are different — an edited invoice keeps a copy of what was sent. See [[edit-an-invoice-after-sending|Edit an invoice after sending]].)" },
        ],
      },
      {
        id: "how-to",
        heading: "How to edit a sent quote",
        blocks: [
          { steps: [
            "Open the quote from **Quotes** and press **Edit**.",
            "Change the lines, the discount, the tax, the **Valid until** date, the notes or the **What happens next** text.",
            "Press **Save changes**. The quote keeps its **Sent** status and its client link.",
            "If the client should know, go back to the quote and press **Send again** — the email carries a freshly rendered PDF of the current lines.",
          ] },
          { figure: "live:app-quotes-new", caption: "The quote builder — Edit opens this same screen with the quote's lines already filled in." },
          { note: "**Send again** restarts the clock. It stamps a new sent date, so the age shown in the Quotes list and the delay before any **Quote sent, no response** follow-up rule both start over from that moment." },
        ],
      },
      {
        id: "what-locks",
        heading: "What locks, and when",
        blocks: [
          { table: {
            head: ["Quote status", "Lines", "Notes, expiry, what happens next"],
            rows: [
              ["Draft or Sent", "Editable", "Editable"],
              ["Approved", "Locked — the builder shows the lines read-only and a warning that the client agreed to different numbers", "Editable"],
              ["Declined", "Locked", "Editable"],
            ],
          } },
          { p: "On a decided quote the builder says so in plain words: the client has already decided on this quote, so its line items can't be changed; the notes, the expiry and the what-happens-next text still save. The server refuses a line change on a decided quote even if a stale screen tries to send one." },
          { warning: "Editing an **Approved** quote's amounts does not undo the approval. The builder warns you: changing the price now means the client agreed to different numbers than the ones on record. If something material changes after acceptance, the honest path is a new quote or an amended invoice, not a silent edit." },
        ],
      },
      {
        id: "two-people",
        heading: "When two people edit the same quote",
        blocks: [
          { p: "The builder remembers which version it opened. If a colleague saved the quote while your screen was open, your save is held and a banner tells you so — nothing you typed is lost, and nothing is overwritten behind anyone's back. You can open the newer version, or save yours over it deliberately." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can edit",
        blocks: [
          { p: "Anyone whose access grid has Quotes at **View, create, and edit** or higher: the Estimator, Dispatcher and Manager presets, and every owner and administrator. Crew has no access to quotes at all. Reassigning a quote to somebody else is a separate permission held by Dispatcher, Manager, owner and administrator." },
        ],
      },
    ],
    faq: [
      { q: "Does the client see my edit if I do not press Send again?", a: "Yes, if they open their link — it shows the live quote. Send again is for putting a fresh PDF and a fresh email in front of them." },
      { q: "Can I get the old version back?", a: "No. A quote is edited in place and FieldQuo keeps no earlier copy. If you need a record of what was sent, download the PDF before you edit." },
      { q: "Why is the Send button missing on this quote?", a: "It only shows while the quote is Draft or Sent. On an Approved quote the next step is the invoice; on a quote entered as a past job nothing is ever sent." },
    ],
  },

  "convert-a-quote-to-a-job": {
    title: "What happens when a quote is approved",
    summary:
      "An approved quote becomes a job waiting for a date, a draft invoice, a to-do to schedule it and a Won lead — the same whether the client clicked the link or you recorded it by hand.",
    updated: "2026-09-12",
    intro: [
      "There is no Convert to job button, because you never need to press one. The moment a quote is approved — by the client on their link, or by you on the **Get this approved** screen — FieldQuo creates everything the next stage needs, once, and never twice.",
      "This article lists exactly what gets created, where it lands, and the one case where nothing happens on purpose.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Approval used to mean different things depending on the door it came through: a client clicking the link created a job and an invoice, a staff member recording a phone approval created nothing. That was a bug, and it is fixed at the root — both doors run the same code, so a yes on the phone and a yes on the link leave the company in the same state." },
          { p: "Everything below is best-effort and idempotent: a double-click, a retried webhook or a second approval after the first already ran will not produce a second job or a second invoice." },
        ],
      },
      {
        id: "what-is-created",
        heading: "What is created",
        blocks: [
          { table: {
            head: ["Created", "Where it lands", "Details"],
            rows: [
              ["A job", "**Jobs**, status **Needs a date**", "Titled with the quote type, the client's name and the quote number, linked to the quote. One job per quote."],
              ["A draft invoice", "**Invoices**", "The quote's lines and photos copied across — an invoice mirrors the quote it came from. One primary invoice per quote."],
              ["A to-do", "**To-do**, high priority", "Reminds someone to schedule the job. No due date is invented, because FieldQuo does not know your turnaround."],
              ["The lead's status", "**Leads**, marked **Won**", "Only if the quote was converted from a lead. A quote typed from scratch has no lead to move."],
              ["Payment-schedule stages", "The invoice", "Only if your company has a payment schedule under Settings → Company. The deposit stage is requested straight away; later stages wait for the job's dates."],
              ["The decision date", "The quote", "Stamped once, the first time the quote is approved, so it never moves on a later edit."],
            ],
          } },
          { figure: "live:app-jobs", caption: "Jobs — an approved quote arrives here under Needs a date, ready to be scheduled." },
        ],
      },
      {
        id: "two-doors",
        heading: "The two ways a quote gets approved",
        blocks: [
          { bullets: [
            "**The client, on their link.** They approve on the page the quote email points to, with a signature if you ask for one. The owners and administrators are emailed, the client receives the signed PDF, and the steps above run. See [[online-approval-and-signature|Online approval and signature]].",
            "**You, on Get this approved.** Open the quote, press **Get approved**, and under **Record their answer** press **They approved it**. No email goes to the client — you have already spoken to them — but the job, the invoice and the to-do are created exactly the same way. **They declined** records a decline and, optionally, the reason.",
          ] },
          { tip: "The activity log names what each approval produced — for example “Quote Q-2026-0031 marked accepted — job created, ready to schedule, invoice INV-0042 drafted”." },
        ],
      },
      {
        id: "convert-to-invoice",
        heading: "The Convert to Invoice button",
        blocks: [
          { p: "On an approved quote that has no invoice yet, the quote page shows **Convert to Invoice**. It exists as a fallback for the rare case where the automatic invoice could not be created. Pressing it when the invoice already exists returns that invoice rather than making another." },
        ],
      },
      {
        id: "nothing-happens",
        heading: "When nothing happens on purpose",
        blocks: [
          { p: "A quote entered as a **past job** — from the Jobs screen's import of history — already carries its job and its paid invoice with the real dates. Flipping its status does not raise stages, does not email a deposit request and does not ask anyone to schedule work done in 2024." },
          { p: "A declined quote creates nothing. It records when, and why if anyone said — the reason is the half that changes what you do next." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can record an approval",
        blocks: [
          { p: "Recording a decision on the Get this approved screen is a quote edit, so it needs Quotes at **View, create, and edit** or higher — Estimator, Dispatcher, Manager, owner or administrator. The client needs nothing but their link." },
        ],
      },
    ],
    faq: [
      { q: "The job has no date. Is that a problem?", a: "No — that is the point of Needs a date. Open it from Jobs or from the to-do and book the first visit. See [[the-job-page|The job page]]." },
      { q: "Can I approve a quote without creating an invoice?", a: "Not on the approved path. The draft invoice is created alongside the job; you can leave it as a draft and edit it before sending." },
      { q: "The client approved twice by mistake. Do I have two jobs?", a: "No. The job, the invoice and the to-do are each created once per quote, whichever door the approval came through and however many times." },
    ],
  },

  "quotes-sent-with-no-response": {
    title: "Quotes sent with no response",
    summary:
      "How the Quotes list surfaces the quotes nobody has answered, what Follow up sends, and how a follow-up rule chases them for you.",
    updated: "2026-09-12",
    intro: [
      "A quote that has been sitting at **Sent** is the follow-up queue, and FieldQuo puts it at the top of the list rather than letting it sink under newer drafts. This article is about the three things you can do with it: read it, chase it by hand, and let a rule chase it for you.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "On **Quotes**, with the **All** chip selected, every quote whose status is Sent is grouped at the top under the heading **Quote sent, no response**, oldest sent first — the quote that has waited longest is the one the client has most likely forgotten. Everything else follows in the order it was created." },
          { p: "Each row shows how long ago it was sent and its expiry. A quote whose **Valid until** date is within three days, or already past, is marked so it stands out; the sentence beside it always names the actual date, so the emphasis is never the only thing you have to go on." },
          { figure: "live:app-quotes", caption: "Quotes — the status chips, then the sent-and-unanswered group above the rest." },
          { note: "A quote is aged from the date it was actually emailed. A quote whose status was set to Sent without an email — a price agreed on the phone, an imported document — shows no age at all rather than an invented one." },
        ],
      },
      {
        id: "follow-up-by-hand",
        heading: "Follow up by hand",
        blocks: [
          { steps: [
            "Open the quote. While it is Sent and has been emailed, the action bar shows **Follow up**.",
            "Press it and confirm the recipient. The follow-up email uses the same layout as the quote email with a different opening, and links to the same approval page.",
            "The quote records the follow-up date and count; the activity log says a follow-up was sent.",
          ] },
          { p: "**Send again** is different: it re-sends the full quote with a fresh PDF and resets the sent date, so the quote's age — and the timer on any follow-up rule — starts over." },
        ],
      },
      {
        id: "follow-up-rule",
        heading: "Let a rule do it",
        blocks: [
          { p: "**Settings → Follow-ups** runs a template a set time after a quote, invoice or job reaches a state. The trigger for this queue is **Quote sent, no response**: it fires once the quote has sat at Sent for the delay with no accept or decline. The suggested delay is 3 days." },
          { steps: [
            "Open **Settings → Follow-ups** and press **New Rule**.",
            "Choose the trigger **Quote sent, no response**, a delay in hours or days, and the email template to send (from **Settings → Email Templates**).",
            "Press **Create Rule**. **Pause** stops it without deleting it.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Settings → Follow-ups — the read-only flow drawn from your rules, then the rules themselves." },
          { bullets: [
            "Each quote gets a given rule's email **once**.",
            "The rule stops as soon as the client accepts or declines.",
            "Clients with no email address on file are skipped.",
            "Quotes entered as past jobs are never followed up.",
            "The check runs daily; nothing is sent by text message from a follow-up rule.",
          ] },
        ],
      },
      {
        id: "who-can",
        heading: "Who sees this",
        blocks: [
          { p: "The Quotes list is visible to anyone with Quotes at **View only** or higher. Follow-up rules are created and paused under Settings, by owners, administrators, Managers and Dispatchers." },
        ],
      },
    ],
    faq: [
      { q: "Why does the group not appear?", a: "It only shows on the All chip, and only when there is at least one Sent quote and at least one other quote. On the Sent chip you are already looking at the queue." },
      { q: "Can the phone assistant call about an unanswered quote?", a: "Yes, if you turn on quote callbacks — a different feature from follow-up emails. See [[quote-callbacks|Quote callbacks]]." },
      { q: "Does a follow-up change the lead?", a: "No. A follow-up email leaves the lead behind the quote where it is; only the first send moves a new lead to Contacted." },
    ],
  },

  "estimate-reviews": {
    title: "Estimate Reviews: approve instant estimates",
    summary:
      "Every price FieldQuo computed for a homeowner waits here until a person confirms it — you approve at a figure, adjust it, or open the quote — and nothing can be sent before that.",
    updated: "2026-09-12",
    intro: [
      "An instant estimate is a range a homeowner saw on your website or was measured from a phone call. It is not a quote until somebody accountable has looked at the property, the numbers and the client, and pressed **Approve**. **Estimate Reviews** is where that happens, and the Send button on a quote refuses to work until it has.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen opens with its own sentence: instant estimates from your website land here first — confirm the price, adjusting it if the property needs it, before the quote can be sent. Below it is one card per estimate waiting for review. When nothing is waiting it says so." },
          { p: "This is the gate the whole instant-quote feature hangs on. The draft lands with a review flag that only this screen clears; a quote that still carries it cannot be emailed, and the error says why: confirm the price in Estimate Reviews, then send." },
          { note: "**Only in FieldQuo.** A homeowner-facing instant price with a mandatory human review before it becomes a quote is not listed on the pricing pages of Jobber, Housecall Pro, Projul or ServiceTitan at any tier." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on each card",
        blocks: [
          { bullets: [
            "The client's name (or **Website enquiry** when none was given), the quote number and where it came from: **Measured from satellite**, **Lawn traced on map**, **Homeowner-entered**, or **Taken from a phone call** with a **Listen** button for the recording.",
            "Who it is assigned to — **Assigned to you**, **Assigned to** a colleague, or **Unassigned — assign to me**, which claims it in one click.",
            "The property: a satellite still where one was captured, the roof area and pitch, the squares and tear-off layers, or the area and material typed in.",
            "**Homeowner saw:** the range they were shown, and **Their budget:** if they gave one — flagged **over budget** when the range exceeds it.",
            "The line breakdown the estimate was built from, and any note from a phone call that says the caller asked for something that is not in the figure.",
            "**Approve at** with the company's currency and the total in a box, the **Approve** button, and **Open quote**.",
          ] },
          { figure: "live:app-estimate-reviews", caption: "Estimate Reviews — one card per instant estimate, with the property, the range the homeowner saw and the Approve at box." },
        ],
      },
      {
        id: "how-to",
        heading: "How to approve an estimate",
        blocks: [
          { steps: [
            "Open **Estimate Reviews** from the sidebar (the row is labelled **Quote reviews**).",
            "Read the card. If the caller or the form asked for something the price does not cover, it is written on the card.",
            "Leave the total as it is, or type the figure the job is really worth in **Approve at**.",
            "Press **Approve**. The card leaves the queue, the quote's total and subtotal become the figure you approved, and the quote can now be sent.",
            "Press **Open quote** instead if you want to rework the lines in the builder first — approving does not edit lines, only the total.",
          ] },
          { p: "Approving keeps a record of what the homeowner was shown, separately from what you approved, so “what they saw” and “what we quoted” never blur into one number. The activity log records who approved it and at what figure." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can approve",
        blocks: [
          { p: "The sidebar row and the Approve button are for owners, administrators, Managers and Dispatchers — the card says so to anyone else: only a manager, administrator or owner can approve. Approving also needs Quotes at **View, create, and edit**, because it can set the total. An Estimator can build quotes but does not approve estimates." },
          { p: "Someone without **See prices** sees the card without the money on it and cannot approve." },
        ],
      },
    ],
    faq: [
      { q: "Where do these estimates come from?", a: "From the instant-estimate page on your website ([[instant-quotes-on-your-website|Instant quotes on your website]]) and from phone calls the receptionist took, when the call carried enough to price ([[call-to-quote|From a phone call to a draft quote]])." },
      { q: "Can I change the price after approving?", a: "Yes — the quote is an ordinary draft after approval. Edit it in the builder like any other before you send it." },
      { q: "Does the homeowner get told when I approve?", a: "Not by approving alone. Send the quote when you are ready; if quote callbacks are on, the assistant can ring about it once the client has the quote in writing." },
    ],
  },

  "instant-quotes-on-your-website": {
    title: "Instant quotes on your website",
    summary:
      "Turn a trade on, set your rates and choose whether the homeowner sees a range — every estimate lands in Estimate Reviews, and your rate card never leaves the building.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Instant Quotes** lets a homeowner get a real starting estimate from your website in seconds: a roof measured from their address, a lawn they trace on a map, or a few numbers they type in. The price is computed on the server from rates you set, shown as a range, and lands as a draft in your review queue before anything is binding.",
      "This article is the settings side. What the homeowner sees is in [[the-instant-estimate-page|The instant estimate page]], and the review is in [[estimate-reviews|Estimate Reviews]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen opens with a live count — **{count} live on your instant-estimate link**, or a note that nothing is live yet — and a link to **See what homeowners see**. Once at least one trade is live, an embed snippet appears under **Put the instant estimate on your website**; it is an ordinary HTML element that works on Wix, Squarespace, WordPress and hand-written pages." },
          { p: "Below that is one card per trade FieldQuo can price instantly, an **On** / **Off** switch on each, and a **Financing** card at the end. Only trades that are also switched on under **Settings → Services** are offered; the rest sit under **Show other trades FieldQuo can price**." },
          { note: "**Only in FieldQuo.** An instant, server-priced estimate from your own rate card with a mandatory review before it becomes a quote is not listed on the pricing pages of Jobber, Housecall Pro, Projul or ServiceTitan at any tier." },
        ],
      },
      {
        id: "trades",
        heading: "The trades, and how each one measures",
        blocks: [
          { table: {
            head: ["Trade", "How the homeowner is measured"],
            rows: [
              ["Roofing", "Roof measured automatically from the address (Google satellite): sloped area, pitch, squares."],
              ["Lawn mowing", "The homeowner traces the lawn on a satellite map; the area comes from the outline."],
              ["Epoxy floors, parging, flooring, painting, countertops", "The homeowner enters the area and picks options."],
              ["Cabinet refinishing and refacing", "The homeowner enters counts — doors and drawer fronts."],
              ["Stairs", "The homeowner enters the number of steps and picks the build; priced per tread."],
              ["Junk removal", "The homeowner picks the items to remove; priced by volume with a built-in load discount."],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "How to put a trade live",
        blocks: [
          { steps: [
            "Open **Settings → Instant Quotes** and find the trade's card.",
            "Edit the rate fields to your market. The starting figures are typical numbers, not your prices, and nothing is offered to homeowners until you save.",
            "Choose **What the homeowner sees** (below).",
            "Set **Minimum charge** and **Range width (±)** — the range is the computed price plus and minus this percentage.",
            "Press **Save & enable**. The live count at the top goes up by one.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Settings → Instant Quotes — the live count, the embed snippet, then a card per trade with its switch, visibility choice and rates." },
          { tip: "A card can be On and still not live: if a rate the pricer needs is missing, the card says homeowners can't get a price for this yet. That sentence is shown only to you — a homeowner is never told why a rate card is incomplete." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "What each setting changes",
        blocks: [
          { bullets: [
            "**Don't show a price** — the homeowner submits and is told a quote is on the way. No number is shown on the page or in their confirmation email. This is the default.",
            "**Show the range after they submit** — the range is unlocked by filling in the form, so you get their details either way. The usual pick.",
            "**Show the range straight away** — the number appears before they leave any details. Expect people to read it and go.",
            "**Budget bands** — the four options shown when the form asks their budget; set the three cut-off points in increasing order, or the standard bands are used.",
            "**Use my services pricing** — appears when your Services & Pricing rates have changed since the card was saved; it adopts them here.",
            "**Financing** — optional, and FieldQuo does not provide financing. Your own wording, or a provider link. If you state both an annual rate and a term, the estimate also shows an estimated monthly payment on those terms; leave either blank and no monthly figure is ever shown.",
          ] },
          { warning: "Whatever the visibility, the public page never shows the rate card — only a finished range, and only when you chose to show it. The public endpoint returns services and fields, never rates. That is a rule of the product, not a setting." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can see and change it",
        blocks: [
          { p: "The screen is a rate card, so it is shown to anyone with **See prices** on their access — an Estimator included; Crew does not see it. Saving rates, visibility or financing is for owners and administrators only; everyone else sees the page read-only with the note that only an owner or admin can edit pricing." },
        ],
      },
    ],
    faq: [
      { q: "Where does an estimate go?", a: "A client record is matched or created, a draft quote is written with the review flag on, and it appears in Estimate Reviews. The homeowner gets a confirmation email in your name, with the range only if you chose to show it." },
      { q: "Can the homeowner book a visit from the estimate?", a: "Yes, when your booking page is set up — the confirmation offers a visit against your real availability." },
      { q: "Does the instant estimate share a link with the self-quote form?", a: "No. They are two cards on Settings → Share your links: Instant estimate prices; Request a quote does not. See [[the-self-quote-form|The self-quote form]]." },
    ],
  },

  "the-self-quote-form": {
    title: "The self-quote form",
    summary:
      "A public three-step form where the homeowner picks a service, gives rough numbers, photos or a PDF plan, and their contact details — it arrives as a scored lead, with no price shown to anyone.",
    updated: "2026-09-12",
    intro: [
      "The self-quote form is the **Request a quote** link on **Settings → Share your links**. It shows only the services you have switched on, asks the few numbers that tell you the size of the job, and never shows a price. What comes out is a lead on your Leads board with everything the homeowner typed, ready to be converted into a quote you price yourself.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The form is three steps, in the order a stranger on a phone will tolerate: **What can we help with?** (one of your enabled services), a details step with at most the first three number or select questions of that service plus **When are you hoping to start?** and **Rough budget?**, and **Where should we send it?** — name, one of email or phone, the job address, and **Add photos, a video or a PDF plan**." },
          { p: "It runs in the homeowner's language, carries your logo and brand colour, and says nothing about FieldQuo. A company that has enabled more than one send language shows a language picker; the language they choose is the language the lead — and the quote it becomes — is created in." },
          { note: "**Only in FieldQuo.** A public form that lets a client describe and photograph their own job, offering only the services you sell and never a price, is not listed on the pricing pages of Jobber, Housecall Pro, Projul, QuoteIQ or ServiceTitan at any tier." },
        ],
      },
      {
        id: "share",
        heading: "How to share it",
        blocks: [
          { steps: [
            "Open **Settings → Share your links**.",
            "On the **Request a quote** card, press **Copy** for the link, **Open** to try it, or **Or paste this into your own website** for the embed code.",
            "Put the link anywhere you already are — your website, Google listing, Facebook page, email signature, or the side of the van.",
          ] },
          { figure: "live:app-settings-links", caption: "Settings → Share your links — the Request a quote card with its link and embed code." },
          { p: "The form only offers the services you have enabled under **Settings → Services**. Switch a service off there and it disappears from the form; there is nothing to configure on the form itself." },
        ],
      },
      {
        id: "what-arrives",
        heading: "What arrives on your side",
        blocks: [
          { bullets: [
            "A lead on **Leads** with the source **self_quote**, scored Hot, Warm or Cold from the budget, timeline and details given — see [[lead-scoring-hot-warm-cold|Lead scoring]].",
            "The homeowner's answers, kept as typed, plus a readable summary; the photos, video or PDF plan attached to the lead.",
            "A confirmation email to the homeowner, in your name and their language, restating what they asked for and offering a visit if your booking page is set up. No figure is in it.",
            "Their phone number, if given, recorded with consent so the receptionist may call it back.",
          ] },
          { figure: "live:app-leads", caption: "Leads — where a self-quote request lands, with its score and the homeowner's own words." },
          { p: "Press **Convert to quote** on the lead and a draft opens with the client, the service, the photos and the answers already in place and a zero total — nobody has priced it yet, and a number the homeowner could see that you never agreed to is exactly what this form exists to avoid. See [[convert-a-lead-to-a-quote|Convert a lead to a quote]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Who sees the leads",
        blocks: [
          { p: "Anyone with Requests at **View only** or higher sees the Leads board; converting a lead needs Quotes at **View, create, and edit**. Share your links is a settings screen for owners, administrators, Managers and Dispatchers." },
        ],
      },
    ],
    faq: [
      { q: "Does the homeowner ever see a price on this form?", a: "No — not on the form, not in the confirmation. The instant estimate is the surface that shows a range; this one deliberately does not." },
      { q: "Can I add my own questions?", a: "The questions are the first three number or select intake fields of the service, as defined under Settings → Services. Custom quote types bring their own intake fields." },
      { q: "What does the homeowner see after submitting?", a: "A confirmation page in their language with a reference, the next steps, and a Book a visit button when booking is available. See [[the-self-quote-form-as-a-client|The self-quote form, as a client sees it]]." },
    ],
  },

  "aerial-roof-measurement": {
    title: "Roof measurement from the air",
    summary:
      "Type an address and FieldQuo measures the roof from Google's building model — sloped area, pitch, squares and the linear details — and fills the roofing takeoff, with an Undo and a refusal when the pin is on the wrong building.",
    updated: "2026-09-12",
    intro: [
      "A roofing quote needs the roof's surface, its pitch and the lengths of eave, ridge, hip and valley. FieldQuo gets them from Google Solar's model of the building — the same geometry the solar industry sizes panels from — so a roof can be priced without a truck rolling to the site. The same measurement drives the roofing instant estimate on your website.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "In the quote builder, a roofing scope group shows a panel headed **Measure the roof from an address** above the takeoff. It offers **Use the client's address** when the client has one, or a box to type another — the roof being re-roofed is often not the address the invoice goes to. **Measure from satellite** does the rest." },
          { p: "What comes back is the actual sloped surface, not the footprint — Google's model already accounts for the pitch, so no multiplier is applied on top. The panel says so: **The sloped surface, not the footprint**. Pitch drives the steep-pitch surcharge and is shown as rise per 12." },
          { note: "**Only in FieldQuo.** Roof measurement from an address, inside the quote builder, is not listed on the pricing pages of Jobber, Housecall Pro, Projul or ServiceTitan at any tier. QuoteIQ lists a measuring product on its pricing page." },
        ],
      },
      {
        id: "how-to",
        heading: "How to measure a roof",
        blocks: [
          { steps: [
            "Open a quote and add a roofing scope group.",
            "In **Measure the roof from an address**, keep the client's address or type the site's, then press **Measure from satellite**.",
            "Read the result beside the satellite image: the squares, the pitch, and what the linear details are worth at your rates.",
            "The panel says **Filled in {count} fields** and lists each one with its old value beside the new. Type over anything you disagree with, or press **Undo** to put the takeoff back exactly as it was.",
          ] },
          { p: "Six of the seven linear details are derived from the facet geometry — ice and water, drip edge, starter, valleys, ridge and hip cap, ridge vent. **Step flashing** is roof meeting wall, and no roof model has walls in it, so it stays blank and the panel lists it under **Still needs you — none of this is visible from above**, with the existing layers, sheathing and penetrations." },
        ],
      },
      {
        id: "refusals",
        heading: "When it refuses, and why",
        blocks: [
          { bullets: [
            "**This does not look like the right building, so nothing was filled in** — the measurement came back implausible (a shed beside the pin, imagery too old). The numbers stay out of the form; look at the image and press **Use it anyway** only if it really is the roof.",
            "The address could not be found, or Google has no roof model for the building — enter the area and pitch by hand. Coverage is wide but not universal.",
            "**Roof measuring is unavailable** — the server key is not configured. Manual entry still works.",
          ] },
          { p: "Nothing is applied silently and nothing is applied twice. The measurement is a starting point the estimator owns; the panel never fights back and never re-applies." },
        ],
      },
      {
        id: "elsewhere",
        heading: "Where else the sky is used",
        blocks: [
          { bullets: [
            "**The instant estimate** — a homeowner's roofing estimate is measured from their address the same way, and the card in Estimate Reviews shows the satellite still, the area and the pitch, marked **Measured from satellite**.",
            "**Lawn mowing** — the homeowner traces the lawn on a satellite map; the area is computed from the outline.",
            "**Paving** — for a paving scope group the builder fetches an aerial still of the client's address and you trace the patio, walkway or driveway on it after drawing a reference line for scale. Without a scale, it shows no measurement at all rather than a pixel count that could be mistaken for feet.",
          ] },
          { p: "The Google key never reaches the browser: images are proxied through FieldQuo and the measuring call runs on the server. See [[google-maps-and-solar|Google Maps and Solar]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can use it",
        blocks: [
          { p: "Anyone who can build a quote — Quotes at **View, create, and edit** or higher. The measurement is free to run and is not metered against your AI credit." },
        ],
      },
    ],
    faq: [
      { q: "Is the area the footprint or the roof surface?", a: "The roof surface, sloped — what you buy material for. A 12/12 roof reports much more area than its footprint, and that is correct." },
      { q: "Can I measure a roof for a walk-in with no client address?", a: "Yes. Type any address into the box; the client record does not need one." },
      { q: "Does it work outside Canada and the US?", a: "Where Google has a building model. Where it does not, the panel says so and you enter the area by hand." },
    ],
  },

  "the-kitchen-designer": {
    title: "The kitchen designer",
    summary:
      "Draw the run, pick the finish, and the cabinetry prices itself from Cabinet Pricing into the quote; the client gets a link to move cabinets on their own version, and the drawing prints on the quote and the invoice.",
    updated: "2026-09-12",
    intro: [
      "A cabinet quote is a page of line items that mean little on their own. The kitchen designer is the drawing behind them: cabinets on walls, an island, finishes, appliances, priced on the server from your **Cabinet Pricing** rates, written into the quote as its cabinetry scope group and printed on the PDF the client signs.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The **Kitchen designer** button appears on a quote when your company has **Kitchen Design & New Installs** switched on under **Settings → Services**, or when that quote already carries a design. Saving in the designer stores the drawing and reprices the quote in one step — there is deliberately no separate “save design” and “update quote”, because two buttons is how a quote goes out at a price that does not match the drawing stapled to it." },
          { note: "**Only in FieldQuo.** A kitchen and cabinet designer whose prices and floor plan go straight into the quote is not listed on the pricing pages of Jobber, Housecall Pro, Projul, QuoteIQ or ServiceTitan at any tier." },
        ],
      },
      {
        id: "rates",
        heading: "Cabinet Pricing: where the numbers come from",
        blocks: [
          { p: "**Settings → Cabinet Pricing** is what the designer charges for cabinetry. Every quote is priced from these on the server, so changing them changes what new designs cost and does not touch quotes already sent. The screen appears only for companies with Kitchen Design switched on, or that have already saved their own rates." },
          { figure: "live:app-settings-cabinet-rates", caption: "Settings → Cabinet Pricing — how you price a cabinet, the rates per linear foot, then material multipliers and finishing." },
          { bullets: [
            "**How you price a cabinet** — **Per linear foot** (width × the tier rate, finishing and install bundled) or **Material cost-plus** (box cost from an intercept plus a per-inch figure, marked up, install billed separately).",
            "**Rates per linear foot** — Base, Wall / upper, Tall / pantry, Island, a drawer surcharge, and whether **Install is included in the rate**; off adds a separate installation line to the quote. Closet casework and vanity rates are optional and fall back to your kitchen rates.",
            "**Material multipliers** — applied to the cabinet price; 1.0 is your baseline, 1.4 means that material costs 40% more. A corner premium sits beside them.",
            "**Finishing, delivery and tear-out** — per door, per drawer front, a flat delivery charge and removal per box, each switched on or off per design.",
          ] },
          { warning: "The starting rates are one real cabinet shop's prices, and the screen says so: these are starting rates, not yours. They are believable enough to go out unnoticed — set your own before you send a kitchen quote. **Back to the starting rates** restores them." },
        ],
      },
      {
        id: "how-to",
        heading: "How to design and price a kitchen",
        blocks: [
          { steps: [
            "Open the quote and press **Kitchen designer**.",
            "Draw the room and place cabinets, an island, appliances; pick the finish and the accessories.",
            "Press **Save & reprice quote**. The drawing is stored and the quote's cabinetry group is rewritten from it — other scope groups on the quote (a bathroom, a floor) are left alone.",
            "Send the quote. The drawing prints on the quote PDF and later on the invoice, from the same shapes the screen drew.",
          ] },
          { p: "A quote that has already been sent is a commitment, so its design opens read-only and the screen says so. To change the layout after sending, start a new quote — FieldQuo has no duplicate-quote control today." },
        ],
      },
      {
        id: "client-link",
        heading: "The client's own version",
        blocks: [
          { p: "Once the quote is sent, the designer shows a **Client link**. The homeowner opens their kitchen with your logo and name, moves cabinets and changes the finish, and saves. They see no prices and cannot send any — the design comes back with your pricing re-attached and anything money-shaped discarded." },
          { p: "Whoever created the quote, plus the owners and administrators, are emailed when they save, and the designer shows **Your client saved their own version of this layout** with the date and a **Load their version** button. Nothing is repriced until you load it and save. The client page is English-only today. See [[the-kitchen-design-link|The kitchen design link]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can use it",
        blocks: [
          { p: "Designing and repricing a quote needs Quotes at **View, create, and edit**. Cabinet Pricing is a settings screen for owners, administrators, Managers and Dispatchers. The client needs nothing but their link." },
        ],
      },
    ],
    faq: [
      { q: "I sell cabinet refinishing. Do I need Cabinet Pricing?", a: "No. Refinishing and refacing price from their own rate cards under Services and Instant Quotes; Cabinet Pricing feeds the kitchen designer only, and the screen stays hidden until Kitchen Design is on." },
      { q: "Can a homeowner design a kitchen before I have quoted?", a: "Not from any link FieldQuo hands out today. The client link exists only once a quote has been sent, and it edits that quote's design." },
      { q: "Does the client's edit change my quote?", a: "Never on its own. It is a second version you can load; the quote only moves when you press Save & reprice quote." },
    ],
  },

  "call-to-quote": {
    title: "From a phone call to a draft quote",
    summary:
      "The receptionist takes the call and never quotes a price; afterwards, one button reads the recording into the instant-quote form, prices it from your own settings and lands a draft in Estimate Reviews — or hands you the builder with what was heard already filled in.",
    updated: "2026-09-12",
    intro: [
      "The phone receptionist may not say a number — not a price, not a range, not “usually around”. What it can do is take the details. After the call, on the **Receptionist** screen, **Draft a quote from this call** reads the recording as if the caller had typed the instant-quote form, and the rest is the machinery you already have: your rates, your review queue, your builder.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The **Receptionist** screen lists the calls it has taken for you, and what came of them, grouped **Needs you**, waiting on you and archived. Each call shows the number, the time, the duration and the cost, the summary, a **Listen** button, and what it produced — **Saved as a lead**, a visit booked, **Book a callback**. On a call with a transcript, **Draft a quote from this call** is the button this article is about." },
          { figure: "live:app-receptionist", caption: "Receptionist — the call log, with what each call produced and the buttons that act on it." },
          { note: "**Only in FieldQuo.** A quote drafted from what the caller described, with every value traced back to the caller's own words, is not listed on the pricing pages of Jobber, Housecall Pro, Projul, QuoteIQ or ServiceTitan at any tier." },
        ],
      },
      {
        id: "how-to",
        heading: "How to draft a quote from a call",
        blocks: [
          { steps: [
            "Open **Receptionist** and find the call. Press **Listen** if you want to hear it first.",
            "Press **Draft a quote from this call**. This spends AI credit, which is why it is a button rather than something that runs when the screen opens.",
            "Read **What we heard on this call**: every service and measurement shown beside the caller's own words, taken verbatim from the recording, with whether the caller said it or confirmed it when the assistant repeated it back.",
            "Follow the outcome — one of the two below.",
          ] },
          { p: "The model may only pick services from your enabled list, materials from the labels you configured, upgrades from your own price book, and measurements it can quote the caller giving. It may not invent a service, write client-facing text, or produce a price — there is no price field in what it is given, and anything money-shaped it invents is stripped." },
        ],
      },
      {
        id: "outcomes",
        heading: "The two outcomes",
        blocks: [
          { table: {
            head: ["Outcome", "What the panel says", "What happened"],
            rows: [
              ["Priced", "**Priced through your instant-quote settings and waiting for approval — draft {number}**, with **Open the review queue**", "The call carried everything that trade's instant-quote form needs. It went through the same path a homeowner's web form does and landed a draft in Estimate Reviews, marked **Taken from a phone call** with a Listen button. The figure is shown there, next to Approve, not here."],
              ["Not priced", "**Not enough to price it automatically — nobody asked about: {fields}**, with **Open in the quote builder**", "Something the trade prices on went unmentioned. Nothing was computed and nothing was created; the builder opens with what was heard already filled in, and you price it by hand."],
            ],
          } },
          { p: "A caller who never said how many doors they have produces a form with no door count — not zero, not a plausible average. A guess multiplied by a rate is a price somebody sends, so the missing questions are listed instead: they are what you ring back about." },
          { bullets: [
            "**Added** — an upgrade off your own price book, ticked on the draft and priced by the builder.",
            "**They also asked about … That looks like … — check whether it belongs on this quote** — something that resembles what you sell but could not be placed automatically.",
            "**Nothing in your services, price book or products matched it** — even this is not thrown away; it goes onto the quote's review notes, which the client never sees.",
          ] },
          { p: "The caller is matched to an existing client by phone or email, or added to your clients, and the panel says which. Their phone number is recorded with consent so the assistant may call back." },
        ],
      },
      {
        id: "after",
        heading: "After the draft",
        blocks: [
          { p: "A priced draft is approved in [[estimate-reviews|Estimate Reviews]] and then sent like any quote. If quote callbacks are on, the assistant can ring the client to confirm and schedule once they have the quote in writing — it reads a figure back off a document they were emailed, and never announces one. See [[quote-callbacks|Quote callbacks]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can do this",
        blocks: [
          { p: "The Receptionist screen is shown to anyone with Clients and Properties at **View full client and property info** or higher. Drafting scope is the first half of writing a quote, so the button needs Quotes at **View, create, and edit**. The deployment must have FieldQuo AI configured and the company must have AI credit; the panel says so when either is missing." },
        ],
      },
    ],
    faq: [
      { q: "Can the receptionist quote on the phone?", a: "No, and there is no tool it could use to. It takes details and books visits; pricing happens afterwards, behind a button a person pressed, and is reviewed before it is sent." },
      { q: "What does a draft cost?", a: "One AI read of the call, charged against your AI credit. Opening the screen or re-reading an existing draft is free; Read the call again spends credit again. See [[ai-credit-and-phone-credit|AI credit and phone credit]]." },
      { q: "Where is the recording kept?", a: "Behind a FieldQuo link that checks your session and your company. Nothing client-facing carries the recording, and the raw provider link is never shown." },
    ],
  },

  "import-a-subcontractor-quote": {
    title: "Import a subcontractor's quote",
    summary:
      "When another FieldQuo company sends you a quote, pull it into one of your own quotes as a marked-up cost line — your client sees one price, the sub never sees your markup, and the cost lands in job costing when the job is won.",
    updated: "2026-09-12",
    intro: [
      "A general contractor collects a subcontractor's quote and quotes the homeowner a marked-up price. When the sub also runs on FieldQuo, that is one step: open the quote they sent you, pick your quote and your markup, and the cost line is written for you — server-side, from the sub's stored figures. The browser never sends a money amount.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The sub sends you their quote the way they send any client a quote. When you open the link signed in to FieldQuo as a different company, a contractor-only panel appears under the document — the homeowner never sees it, and the quote above stays fully white-label. The panel is in English on every language's screen." },
          { p: "From it you add the quote to one of your own open quotes as a **Subcontractors** scope group priced at the sub's figure plus your markup. Later, when your client approves and the job is created, the sub's cost becomes a job expense so it lands in job costing and margin." },
        ],
      },
      {
        id: "how-to",
        heading: "How to import",
        blocks: [
          { steps: [
            "Open the quote link the subcontractor sent you while signed in to your company. What matters is that you are signed in to a company other than the sender's — the panel never appears on your own quotes.",
            "In the panel under the document, pick the target quote from your open (draft or sent) quotes. If you have none, create a quote first.",
            "Pick a markup — 0, 10, 20 or 30 percent, or a custom figure. Markup marks the cost up; 0 passes it straight through.",
            "Choose how it shows to the client: **One line** (the trade at the client price, nothing about who did it) or **Itemised** (the sub's line descriptions, each scaled so the group totals the client price — the sub's raw prices are never shown).",
            "Give it a label if you like (“Electrical”), and press **Add to my quote**.",
          ] },
          { p: "The panel previews your client price live, for your benefit; what is stored is computed on the server from the sub's accepted or quoted total. Markup is clamped between 0 and 1000 percent." },
        ],
      },
      {
        id: "on-your-quote",
        heading: "On your quote afterwards",
        blocks: [
          { bullets: [
            "The quote page shows a **Subcontractor costs** panel: quotes you pulled in from other companies, your cost, your markup and the client price. **Edit markup** changes the client price; **Remove this cost** takes the group off.",
            "In the builder, the imported group is read-only — the cost is fixed and the markup is edited on the quote page — but it counts in the total and survives a save.",
            "Line items on a decided quote are locked, so an import cannot be edited or removed once your client has accepted or declined.",
          ] },
        ],
      },
      {
        id: "what-the-sub-sees",
        heading: "What the subcontractor sees",
        blocks: [
          { p: "On their side, the quote shows **Used in another company's quote** — a contractor added this quote to their own project as a cost — with a status derived from your quote and never stored: **Pending their client's approval** while your quote is open, **Confirmed** once your quote is accepted or your job or invoice exists, **Not proceeding** if your quote is declined. They never see your markup or what you charge the homeowner." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can import",
        blocks: [
          { p: "A signed-in member of a different company from the sender, with Quotes at **View, create, and edit** — it writes a cost line onto one of your quotes, which is a quote edit. A read-only support session cannot import." },
          { p: "Keeping subcontractors on file, putting one on a job at an agreed price and tracking their insurance is the Subcontractors screen — see [[subcontractors-and-insurance|Subcontractors and insurance]]. Importing a quote from a system that is not FieldQuo is [[import-a-quote-from-another-system|Import a quote from another system]]." },
        ],
      },
    ],
    faq: [
      { q: "Which figure is imported — what they quoted or what I negotiated?", a: "What you accepted on their quote, if you accepted it; otherwise the total they quoted. A renegotiated price is the one that comes across." },
      { q: "Can the homeowner tell a subcontractor is involved?", a: "Not from the document. One line shows the trade and a price; Itemised shows work descriptions at scaled amounts. Neither names the sub or shows their prices." },
      { q: "Does the sub have to be on FieldQuo?", a: "For this panel, yes — it reads their stored quote. A PDF from a sub on paper is priced by hand in the builder." },
    ],
  },

  "references-and-photos-in-the-quote-email": {
    title: "References and before-and-after photos in the quote email",
    summary:
      "Two optional sections of the email that carries a quote — past clients who agreed to take a call, and photo pairs from finished jobs — set once under Settings → Quote Email and switched on or off per quote.",
    updated: "2026-09-12",
    intro: [
      "The quote email always carries the scope, what is included, how the work runs and what could change the price — those come from the quote itself and have no switch. **Settings → Quote Email** adds two optional sections you own: **References** and **Before & after**. This article is what each one does, how it is switched on, and the one rule that stops an empty section reaching a homeowner.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen opens with **What the email always carries** — the scope service by service with the priced lines, what's included in each service, how the work runs step by step, and what could change the price for the trades that declare one — and points you to Services for that wording. Then the two sections below, each with an **Include on every new quote** switch." },
          { figure: "live:app-settings-quote-email", caption: "Settings → Quote Email — what the email always carries, then References and the before-and-after pairs." },
        ],
      },
      {
        id: "references",
        heading: "References",
        blocks: [
          { p: "Past clients who have agreed to take a call from a prospect: a **Name** and a **Phone**, printed exactly as you type them. Press **Add** for each; **Remove** takes one off." },
          { warning: "The screen says it and it bears repeating: only list people who have actually agreed to these calls. Their number goes to every homeowner you quote." },
        ],
      },
      {
        id: "before-and-after",
        heading: "Before & after",
        blocks: [
          { p: "Photo pairs from finished jobs. **New pair — upload the before and the after** opens two upload boxes, **Before** and **After**, with an optional caption. Both halves are required — half a before-and-after is the same picture twice." },
        ],
      },
      {
        id: "per-quote",
        heading: "Per quote: the Email sections panel",
        blocks: [
          { p: "On each quote, an **Email sections** panel shows the two optional parts with their state — **Default (on)** or **Default (off)** from the company setting, or **On** / **Off** if you overrode it for this quote — and how many items would go, from **this quote** or **your company list**. A quote can carry its own references and pairs as well as the company's." },
          { steps: [
            "Open **Settings → Quote Email** and add at least one reference or one pair.",
            "Switch **Include on every new quote** on. New quotes from now on default to including it; existing quotes keep what they had.",
            "On a quote where it should not go, open **Email sections** and turn it **Off** for that quote.",
          ] },
        ],
      },
      {
        id: "empty-rule",
        heading: "The empty-section rule",
        blocks: [
          { p: "A section that is switched on with nothing in it must never reach a homeowner — and must not be dropped silently either, because you ticked the box and would believe it went. So the send is blocked. The quote page says **This is switched on with nothing to show, so the quote can't be sent yet**, and the send itself stops with **A section you've included is empty** and two ways out: **Add content** (which takes you to the settings) or **Leave it out of this quote**, then **Send now**." },
          { note: "The rule is enforced twice — before the email is built and inside the builder of the email itself — so no future send path can post a heading over a blank space. Follow-up emails from **Settings → Follow-ups** carry neither section and are unaffected." },
        ],
      },
      {
        id: "language",
        heading: "Language, and who can change it",
        blocks: [
          { p: "The email is sent in the quote's language, from your company's own name — references and captions print as you typed them, untranslated. The settings screen is for owners, administrators, Managers and Dispatchers; the per-quote switch is part of editing the quote (Quotes at **View, create, and edit**)." },
        ],
      },
    ],
    faq: [
      { q: "Do these sections print on the PDF?", a: "No. They are sections of the covering email. The PDF is the document itself — see [[the-quote-pdf|The quote PDF]]." },
      { q: "Can I add a reference to one quote only?", a: "Yes — the Email sections panel on the quote counts items from this quote as well as from your company list." },
      { q: "I turned the switch on and now nothing sends. Why?", a: "The section is on with nothing in it. Add a reference or a pair under Settings → Quote Email, or leave it out of that quote, and send again." },
    ],
  },

  "scope-of-work-and-terms": {
    title: "Scope of work and payment terms on every quote",
    summary:
      "Two boxes under Settings → Company: a default scope of work copied onto every new quote and editable there, and payment terms printed on every quote and invoice — with trade templates to start from and bracketed blanks you must fill.",
    updated: "2026-09-12",
    intro: [
      "A quote that says what will happen — how deep the excavation goes, who hauls the old surface away, what a change costs — reads like somebody who has done the job before. The **Scope of work and terms** card on **Settings → Company** is where you write that once. Every new quote starts from it, and the payment terms attach themselves to every document you send.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The card has two fields. **Default scope of work** is copied onto every new quote as its **What happens next** text — editable on the quote itself, printed on the document after the steps of the work. **Payment terms** is free text such as “50% deposit, balance on completion” or “Net 30”, printed as a payment section on quotes and invoices; when the text describes a schedule, the document renders it as cards with the percentages large, and otherwise prints your sentence as written." },
          { figure: "live:app-settings-company", caption: "Settings → Company — the Scope of work and terms card at the top, then the payment schedule and the company details." },
        ],
      },
      {
        id: "how-to",
        heading: "How to set them",
        blocks: [
          { steps: [
            "Open **Settings → Company** and find **Scope of work and terms**.",
            "Under **Start from a trade template:** press **Add the … terms** for your trade — interlock and paving, driveway sealing or snow removal — or write your own in **Default scope of work**. The template is inserted as text you then edit; pressing the button again removes it.",
            "Replace every value in [square brackets]. The card counts what is still to decide and warns that they will print on the quote exactly as they appear.",
            "Type your **Payment terms**, then press **Update Settings**.",
          ] },
          { warning: "An unedited template is visibly unfinished on purpose. The warranty term, the deposit split, the lead time and the change-order fee are yours to own; a default warranty is a contract term, not a nice touch, so FieldQuo leaves them blank rather than asserting one for you." },
        ],
      },
      {
        id: "what-each-changes",
        heading: "What each field changes",
        blocks: [
          { table: {
            head: ["Field", "Where it goes", "If empty"],
            rows: [
              ["Default scope of work", "The What happens next box of every new quote, then the quote page and PDF", "Quotes carry no default scope of work; the box on each quote starts blank"],
              ["Payment terms", "The payment section of every quote and invoice, as cards when a schedule can be read from it", "The payment section does not appear on documents"],
            ],
          } },
          { p: "Changing the default does not rewrite quotes that already exist — each quote keeps its own text, which you can edit in the builder under **What happens next**." },
          { note: "If your company uses the structured **Payment schedule** on the same screen, the payment terms text is generated from that schedule so the document always matches what actually bills, and the box becomes read-only. Turn the schedule off to write the terms by hand again. See [[deposits-and-payment-schedules|Deposits and payment schedules]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can see and change it",
        blocks: [
          { p: "Settings → Company is for owners, administrators, Managers and Dispatchers. The same card also has a read-only rendering for someone who may open the page but not change it — an estimator asked about the terms on a doorstep can read what their own documents say, and is told to ask an owner or admin to finish any unfilled brackets." },
        ],
      },
    ],
    faq: [
      { q: "Is the scope of work translated?", a: "No. It prints in the language you typed it in, on documents of every language. A company quoting in two languages keeps two versions by editing the box on each quote." },
      { q: "Which templates exist?", a: "Interlock and paving, driveway sealing and snow removal. Other trades write their own — the what's-included wording per service lives under Settings → Services." },
      { q: "Can the client see the brackets?", a: "Yes, if you leave them — they print exactly as they appear. That is why the card counts them." },
    ],
  },

  "the-large-quote-alert": {
    title: "The large-quote alert",
    summary:
      "An email to every owner and administrator when someone on the team creates a quote above an amount you set — checked once a day, from Settings → Notifications.",
    updated: "2026-09-12",
    intro: [
      "An owner who is not writing every quote wants to know when a big one goes out. The **Large quote created** card on **Settings → Notifications** is that: a threshold, a switch, and an email to the owners and administrators for each quote created above it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Settings → Notifications** is where FieldQuo should email you about something happening in your account: **Large quote created** with its threshold, **Invoice paid**, appointment reminders and browser notifications. This article is the first card." },
          { figure: "live:app-settings-notifications", caption: "Settings → Notifications — Large quote created with its switch and threshold, then Invoice paid and the reminders." },
        ],
      },
      {
        id: "how-to",
        heading: "How to set it up",
        blocks: [
          { steps: [
            "Open **Settings → Notifications**.",
            "On **Large quote created**, tick **Send this alert** and type the amount in **Alert me above**.",
            "Press **Save**. Until a threshold is saved the card says not set up yet — no alerts are being sent.",
          ] },
          { note: "The card says it plainly: this runs on a daily schedule rather than the instant a quote is saved, so expect the email within a day." },
        ],
      },
      {
        id: "what-it-does",
        heading: "What it does",
        blocks: [
          { bullets: [
            "Once a day, FieldQuo looks for quotes created in the last day whose total is at or above your threshold.",
            "For each one, every active member with an owner or administrator role receives an email in the company's name: “Large quote created: $12,500”, naming the client, the amount and your threshold. Managers and Dispatchers are not emailed.",
            "Quotes entered as past jobs are skipped — a job typed in today with a 2024 total is bookkeeping, not a large quote that just came in.",
            "Unticking **Send this alert** keeps the threshold and stops the emails; nothing else changes.",
          ] },
          { p: "There is no per-quote record of having alerted: the daily window is what prevents repeats, and a quote is reported once, in the run after it was created." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can see it",
        blocks: [
          { p: "Settings → Notifications is for owners and administrators only — they are also the only people the alert emails. The email is written in English." },
        ],
      },
    ],
    faq: [
      { q: "Does it fire on an edit that pushes a quote over the threshold?", a: "No. It looks at when the quote was created, not when it was last changed." },
      { q: "Can I send it to an estimator or a manager?", a: "Not today. The recipients are fixed to the owner and administrator roles." },
      { q: "Is the amount before or after tax?", a: "It compares the quote's total — the figure at the bottom of the quote, tax included when tax applies." },
    ],
  },
};
