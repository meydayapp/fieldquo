// content/help/en/what-your-clients-see-1.js
//
// Part 1 of the “what-your-clients-see” category in English (see the
// composer, what-your-clients-see.js). Slugs assigned to this part
// (lib/help/tree.js): nothing-says-fieldquo, the-quote-email,
// the-quote-approval-page, the-invoice-email-and-pay-page,
// the-client-portal-as-a-client, the-booking-page, managing-a-booked-visit,
// the-instant-estimate-page.
//
// Every article describes ONE client-facing surface the way the client sees
// it — the company's name, logo and colour, never FieldQuo's — and then what
// the contractor controls about it. The facts come from the route that
// renders the surface (lib/email/quoteEmail.js, app/q, lib/email/invoiceEmail.js,
// app/portal, app/book, app/visit, app/instant-quote), the API it calls, and
// the lib/** rule behind each control. The words the client reads are quoted
// from lib/i18n/clientDocCopy.js, lib/i18n/emailCopy.js and
// lib/i18n/documentLabels.js; the words on the settings screens from
// app/i18n/appMessages.js.
export const ARTICLES = {
  "nothing-says-fieldquo": {
    title: "Nothing says FieldQuo",
    summary:
      "Every quote, invoice, page and email a homeowner sees carries your logo, your colour and your name — where that comes from, how one colour becomes a readable document, and the short list of places FieldQuo's own name can appear.",
    updated: "2026-09-12",
    intro: [
      "A homeowner comparing three contractors should not be able to tell that two of them use the same software. That is the rule every client-facing surface in FieldQuo is built to: the quote email arrives from your company, the approval page is on your letterhead, the invoice page and the portal are in your colour, the booking page carries your logo, and the texts open with your name. There is no FieldQuo logo, no “powered by” line and no account a client is asked to create.",
      "This article is the white-label rule in one place — what carries your name, how one brand colour becomes a whole palette that still reads on a phone in a driveway, and the exceptions, so you know exactly where the name FieldQuo can show up.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Everything starts from two things you set once under **Settings → Branding**: a logo and a **Primary** colour. The documents and pages a client opens read those two fields and nothing else — there is no per-document theme to keep in step, so a quote cannot look like FieldQuo's while an invoice looks like yours. The name on the brand band, in the email's From line, in the footer and in the “Questions?” line is your company's name from **Settings → Company Settings**." },
          { p: "The pages a client opens sit outside the app entirely: no navigation, no sign-in, nothing suggesting they have an account somewhere. A quote link opens a document; a portal link opens an account statement; a booking link opens a calendar. Each is written in the client's language, and each ends with your phone number, not ours." },
        ],
      },
      {
        id: "what-carries-your-name",
        heading: "What carries your name",
        blocks: [
          { table: {
            head: ["Surface", "What is yours on it"],
            rows: [
              ["The quote email and the invoice email", "The From line in your company's name, your logo on a brand band in your colour, your colour on the button, your phone, email, website and tax number in the footer."],
              ["The quote approval page and the quote PDF", "The brand rule across the top, your logo and name, your colour on every heading, section and the total band."],
              ["The invoice page and the client portal", "Your logo, “Account for [client]”, your invoices and quotes, the Pay buttons in your colour, and a “Questions?” line with your phone and email."],
              ["The booking page and the visit page", "Your logo and name at the top, your colour on the chosen day and the buttons; your name in the subject and body of the confirmation email."],
              ["The instant estimate, the self-quote form and funnels", "Your logo, your colour, your services only — and never a rate card."],
              ["Your website and bio link page", "Your subdomain, your pages, your photos, your hours; the one footer line is described below."],
              ["Texts (reminders, On my way)", "Your company's name at the start of the message, and your phone number to call back on the On my way text. Replies to these texts are not read by anyone — only STOP is acted on."],
            ],
          } },
          { note: "The wording of the fixed parts — “View & approve your quote”, “Approve this quote”, “Balance owing”, “Change the time” — is FieldQuo's, translated into every language a document can be written in. You cannot edit those sentences, and none of them names the software." },
        ],
      },
      {
        id: "the-from-line",
        heading: "The From line, and where replies go",
        blocks: [
          { p: "Every email a client receives is sent as **Your Company Name** in the From line. The address behind the name depends on one thing: whether you have verified your own domain under **Settings → Email Domain**. With a verified domain the address is yours — **quotes@yourdomain.com** unless you chose another word before the @. Without one, the address is FieldQuo's shared sending address, still under your company's name." },
          { p: "Replies always come to you. The reply-to is your company's email address from **Settings → Company Settings**; if that field is blank, it falls back to the account owner's login email, so a client's reply can never vanish into a mailbox nobody reads." },
          { tip: "Verify your domain if you can. It is the one visible difference between “your name on FieldQuo's address” and “your name on your address”, and it helps the email land in the inbox rather than in promotions. See [[send-from-your-own-domain|Send from your own domain]]." },
        ],
      },
      {
        id: "how-the-colour-works",
        heading: "How one colour becomes a document",
        blocks: [
          { p: "You pick one hex. From it FieldQuo derives every colour on the page — the rule across the top, the section headings, the wash behind a summary card, the total band and the button — and measures each pairing of text and background for contrast before using it. That matters because contractors pick yellow, white, black and mid-grey, and the naive rule “dark colour, white text” fails on exactly those. A white brand still gets a visible total band; a pale yellow still gets readable headings; a logo always sits on a white plate inside the brand band, so a navy wordmark never vanishes into a navy bar." },
          { steps: [
            "Open **Settings → Branding**.",
            "Under **Logo**, press **Upload logo** (PNG, JPG, WebP or SVG, up to 8 MB).",
            "Under **Brand Colors**, set **Primary** — buttons, progress bars and your name in the email header. **Secondary** and **Neutral** are optional and follow sensible defaults.",
            "Check **How your documents will look**, in **Light** and **Dark**. That preview is the same maths the quote, the invoice and the emails use.",
          ] },
          { figure: "live:app-settings-branding", caption: "Settings → Branding — the Logo card, the Brand Colors card with Primary, Secondary and Neutral, and the document preview." },
          { note: "The brand colour is used on everything your clients see and **not inside the app**: your team's screens stay neutral so a bright brand never makes the back office hard to work in. A company that has set no colour gets FieldQuo's default navy on its documents — the only case where the colour is ours. The booking confirmation email is the one letter with a fixed dark header rather than your colour; your name is still in its subject and its first line." },
        ],
      },
      {
        id: "where-fieldquo-does-appear",
        heading: "Where FieldQuo's name does appear",
        blocks: [
          { p: "The exceptions are short and each has a reason:" },
          { bullets: [
            "**The footer of a free website.** A site on a company that is not on a paid plan carries a small **Site by FieldQuo** line under the copyright. Paid plans do not. See [[the-site-by-fieldquo-footer|The Site by FieldQuo footer]].",
            "**The referral page.** Your Refer & Earn link opens a page addressed to another business owner that says you use FieldQuo — its whole purpose is to recommend the software. See [[the-referral-page|The referral page]].",
            "**Web addresses.** Quote, portal, booking and visit links open on FieldQuo's domain, and your website lives at yourcompany.fieldquo.com. The page itself is yours; the address bar is not.",
            "**The sending address** when you have not verified your own domain, as above. The name is yours; the part after the @ is not.",
            "**Stripe's payment page.** A client paying by card or bank account is taken to Stripe's hosted page for your connected account, in your company's name — that page is Stripe's, and says so.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Why this is listed under Only in FieldQuo",
        blocks: [
          { p: "Of the five pricing pages FieldQuo checks itself against — Jobber, Housecall Pro, ServiceTitan, Projul and QuoteIQ — none lists, at any tier, that the documents and pages a client receives carry the contractor's brand rather than the software's. Jobber's page lists “Customize quotes with rich visuals and reviews”, which FieldQuo reads as document layouts, not as white-labelling. That is the whole claim: not listed on their pricing page, never “they cannot do it”." },
        ],
      },
    ],
    faq: [
      { q: "Does the client ever have to create an account?", a: "No. Every link is a token in the address — the quote, the portal, the visit page. There is no password, no sign-up and no FieldQuo account for a homeowner." },
      { q: "Can I turn off the Site by FieldQuo line?", a: "It is shown only on a company that is not on a paid plan. On a paid plan it is not rendered; there is no separate switch." },
      { q: "My brand colour is white. What happens?", a: "Every foreground is measured against it, and where the pairing fails the page substitutes a neutral chip or darkens the accent for text. The document stays readable; it simply carries less colour. Check the Branding preview." },
      { q: "Does the language of the page depend on the client or on me?", a: "On the client. A quote keeps the language it was created in, and everything else a client receives follows their own language on their record, then your company default. See [[a-clients-language|A client's language]]." },
    ],
  },

  "the-quote-email": {
    title: "The quote email",
    summary:
      "What lands in the client's inbox when you press Send on a quote: the From line, the subject, the total and the approve button, the scope and the steps, the optional references and before-and-after photos, and the PDF attached.",
    updated: "2026-09-12",
    intro: [
      "Pressing **Send** on a quote emails one message to the client's address, from your company, in the quote's language, with the quote PDF attached. It is not a bare link. The email carries the substance of the quote — what it costs, what is included, how the work runs — because a homeowner reads three quotes side by side, and the one that is only a link reads as the company that could not be bothered.",
      "The approve button sits directly under the total, above every word of detail, and again at the very bottom. There is exactly one call to action and it appears twice.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The email is built when you press **Send** (or **Send again**, or **Follow up**) on the quote page, and only after the message has actually been accepted for delivery is the quote marked **Sent**. A send that fails leaves the quote a draft, keeps the Send button, and puts a line in your notifications — the quote never quietly claims to have gone out." },
          { p: "The link in the email opens the quote approval page. If the quote had no client link yet, one is created at send time, so an email can never carry a dead link. See [[the-quote-approval-page|The quote approval page]] for what the client does there." },
          { figure: "live:app-settings-quote-email", caption: "Settings → Quote Email — what the email always carries, the References list with its Include on every new quote switch, and the before-and-after pairs." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "What the client receives, top to bottom",
        blocks: [
          { bullets: [
            "**From:** your company's name. **Subject:** “Your quote from [Your company] — Q-1042”. A follow-up reads “Following up: quote Q-1042 from [Your company]”.",
            "**The brand band** in your colour: your logo on a white plate on the left, the word **QUOTE** and the number on the right.",
            "“Hi [first name],” then one opening line: “Thanks for the opportunity to quote on your project. Everything we discussed is set out at the link below.”",
            "**TOTAL** with the amount, and “Valid until [date]” when the quote has an expiry.",
            "The button **View & approve your quote**, with “Or paste this into your browser:” and the link under it for a mail app that eats buttons.",
            "The scope, service by service, with the priced lines; **What's included** in each service; **What could change this price** for the trades that declare one; and **How the work runs**, step by step, with any published timelines.",
            "**Speak to past clients** — the references you listed, name and phone number exactly as typed — when that section is on for this quote.",
            "**Before & after** — up to four photo pairs with their captions — when that section is on.",
            "The button again, then the footer: “Questions? Reply to this email or call [phone].”, your company's name, and your email, phone, website and tax registration number, whichever you have filled in.",
          ] },
          { p: "The quote PDF is attached as **Quote-Q-1042.pdf**, rendered by the same engine as Download PDF and in the same language, so the attachment and the page say the same thing. If the PDF cannot be rendered the email still goes — a quote without an attachment beats one that never arrives — and support is told." },
          { note: "No financing block is in the email. Pay-over-time terms, when you have entered them, appear on the approval page under the total, not in the message." },
        ],
      },
      {
        id: "the-language",
        heading: "Which language it is written in",
        blocks: [
          { p: "The email is in the **quote's** language — the one it was created in — so the covering note matches the document it carries. A French quote gets a French email and a French PDF whichever language you work in. Where a quote has no language of its own, the client's language on their record is used, then your company default. The currency is always yours: language changes the formatting, never the money. See [[quote-language|A quote keeps its language]]." },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { p: "**Settings → Quote Email** shows what the email always carries — “These come from the quote itself, so there is no switch for them — if the quote says it, the email says it.” The scope, what's included, the steps and what could change the price are edited per trade under **Settings → Services & Pricing**. The two optional sections are yours to fill and switch:" },
          { table: {
            head: ["Section", "What it is", "The switch"],
            rows: [
              ["**References**", "Past clients who have agreed to take a call, with **Name** and **Phone**, printed exactly as you type them. At most six are sent.", "**Include on every new quote** sets the default; each quote's **Email sections** panel can set it **On** or **Off** for that quote alone."],
              ["**Before & after**", "Photo pairs from finished jobs, both halves required, with an optional **Caption**. At most four pairs are sent.", "Same: a company default, and a per-quote override on the quote page."],
            ],
          } },
          { warning: "A section switched **On** with nothing in it blocks the send. The quote page says “This is switched on with nothing to show, so the quote can't be sent yet.” and offers **Add content** or **Leave it out of this quote**, then **Send now**. An empty section is never dropped silently and never sent as a heading over blank space." },
          { p: "The consent line on the settings page is a rule, not decoration: “Only list people who have actually agreed to these calls. Their number goes to every homeowner you quote.”" },
        ],
      },
      {
        id: "when-it-cannot-be-sent",
        heading: "When a quote cannot be sent",
        blocks: [
          { bullets: [
            "The client has no email address on their record — add one, then send.",
            "The quote is an instant estimate still marked **Needs review** — confirm the price in **Estimate Reviews** first.",
            "The quote says tax applies but no rate could be resolved for the client's address — the send stops rather than promise a total that is missing the tax. Fix the address in the dialog and retry.",
            "An optional email section is on and empty, as above.",
            "The company has not finished checkout — a trial that never added a card can build quotes but not send them.",
          ] },
        ],
      },
      {
        id: "who-can-send-it",
        heading: "Who can send it",
        blocks: [
          { p: "Sending needs the same access as editing a quote: **Quotes** at **view, create & edit** or above — an owner, an administrator, a Manager, an Estimator, or a Custom access with that level. **Settings → Quote Email** itself needs the Manager level or above (an owner, an administrator, a Manager or a Dispatcher)." },
        ],
      },
    ],
    faq: [
      { q: "Can I change the wording of the email?", a: "The fixed sentences — the greeting, the opening line, the button — are FieldQuo's and cannot be edited. What you control is the content: the scope wording per trade, the references and the photos. Automated follow-ups use your own email templates instead." },
      { q: "Does the client get a copy of the PDF?", a: "Yes, attached to the email as Quote-[number].pdf, in the same language as the email and the page." },
      { q: "The client says they never received it.", a: "Open the quote: if it still reads Draft and the Send button is there, the send failed and your notifications say why. If it reads Sent, ask them to check promotions and spam, or open Get approved and copy the client link to them directly." },
      { q: "Why is the email in French when I work in English?", a: "Because the quote was created in French. The email follows the document, not your screen. See [[quote-language|A quote keeps its language]]." },
    ],
  },

  "the-quote-approval-page": {
    title: "The quote approval page",
    summary:
      "The page a client opens from the quote email: the document on your letterhead, the optional extras they can tick, the signature they give to approve, what Decline does, and what happens on your side the moment they answer.",
    updated: "2026-09-12",
    intro: [
      "The link in the quote email opens one page: the quote, laid out as a document on your letterhead, with two buttons at the bottom — **Approve this quote** and **Decline**. It sits outside the app on purpose. No navigation, no sign-in, no FieldQuo branding competing with yours; it should read as a document from the company they hired.",
      "Approval is a real signature. The client types their name, signs in a box, ticks an agreement that names the total, and confirms. A tap on a phone in bright sun cannot create a contract by accident.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is public to anyone holding the link — a long random token, and the page is kept out of search engines. It shows the quote only once it has been sent; a draft's link answers “This quote isn't ready yet.” The language is the quote's, so the page, the PDF they were sent and the covering email all say the same thing in the same words." },
          { figure: "harness:client-quote-approval", caption: "The approval page as the client sees it — the brand rule, the company's logo and phone, QUOTE Q-1042, Prepared for, the scope groups with what's included, the terms explained, Optional extras, How the work runs, Payment terms, the TOTAL band, then Approve this quote and Decline." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "What is on the page, top to bottom",
        blocks: [
          { bullets: [
            "The brand rule, your logo (or your initial on your colour), your name and phone; **QUOTE** and the number on the right.",
            "**Prepared for** the client's name, and **Valid until** the date when the quote has one.",
            "One numbered card per scope group — the group name and subtotal, a description, the priced lines with quantities, **What's included**, and **What could change this price** where the trade declares one.",
            "**The terms on this quote, explained** — a short glossary of the trade words used above (“Shaker”, “Rift sawn”).",
            "**Optional extras** — “Tick anything you'd like added. The total updates as you go — nothing is charged until you approve.” Each extra has a description and a price; a taxable one adds its tax as it is ticked.",
            "**How the work runs** — the numbered steps with their week or day, and your process notes.",
            "**Payment terms** — your payment schedule as tiles (“50% Deposit to book”, “50% Balance on installation”) or your terms text; then **Notes**.",
            "**Subtotal**, **Discount**, **Tax** (or the reason there is none), “Includes optional extras” when any are ticked, and the **TOTAL** band.",
            "**Pay monthly** — “About $410 a month”, the term and APR, and “An estimate only, on the terms [Your company] has stated…” — only when you have entered a rate and a term under financing; otherwise a plain **Financing** panel with your note and a **See financing options** link, or nothing.",
            "**Approve this quote** and **Decline**; under them, “Questions? Reply to the email, or call [Your company] at [phone].”",
          ] },
        ],
      },
      {
        id: "approving",
        heading: "How the client approves",
        blocks: [
          { steps: [
            "They tick any **Optional extras** they want. The total on the page moves as they tick; the browser only ever sends the ids of the extras — the server reprices from its own rows, so nothing on the page can change what is charged.",
            "They press **Approve this quote**. The page asks “Approve this quote for $21,212.89?” — “Including $640.00 of optional extras. This tells them to go ahead.” when extras are ticked.",
            "They type **Your full name**, sign in the **Signature** box, and tick “I agree that signing here is my electronic signature and approves this quote for $21,212.89.” The **Yes, approve** button stays off until all three are done.",
            "The page turns to **Approved — thank you**: “[Your company] has been notified and will be in touch about next steps.”",
          ] },
          { p: "The signature is stored with the quote as a record — the name, the drawn signature, the time, the client's IP address and browser, and a fingerprint of exactly what they approved (lines, extras, totals). The quote PDF then carries an **Approval** block with the signature, the name, the date and “Electronically signed”." },
          { note: "A quote past its **Valid until** date cannot be approved: the page reads **This quote has expired** — “Contact [Your company] for an updated price.” The same happens if it expires between the client opening the page and pressing the button." },
        ],
      },
      {
        id: "declining",
        heading: "Declining",
        blocks: [
          { p: "**Decline** asks “Decline this quote?” — “You can always ask for a revised quote.” — then **Yes, decline**. The page turns to **Quote declined**: “[Your company] has been notified. If this was a mistake, give them a call.” No signature is needed to decline, and a declined quote can be edited and sent again." },
        ],
      },
      {
        id: "what-happens-on-your-side",
        heading: "What happens on your side",
        blocks: [
          { bullets: [
            "The quote becomes **Approved** (or **Declined**) with the accepted total, extras included. Owners and administrators get an email — “Sophie Dubois approved Q-1042 — plus $640.00 in extras” — with the signed PDF attached and a link to the quote; a notification appears in the app.",
            "The client is emailed a signed copy: subject “Approved — thank you — Q-1042”, “Thank you for approving your quote with [Your company]. A copy is attached for your records.”, from your company.",
            "A **job** is created from the quote, ready to schedule, and a draft **invoice** that mirrors the quote is raised.",
            "If your company has a payment schedule with a **Deposit to book** stage, that stage fires at once: the client is emailed a request for exactly the deposit, with a link to pay it from their portal. See [[deposits-and-payment-schedules|Deposits and payment schedules]].",
            "The lead the quote came from is marked **Won** or **Lost**, and a follow-up task is created for an approved quote.",
          ] },
          { tip: "If the client answered by phone instead, open **Get approved** on the quote and use **Record their answer** — **They approved it** or **They declined** — so the pipeline stays right. The same screen has **Client link** with **Copy**, **Preview what they see**, and **Replace link**, which kills the old link if the wrong person got it (any email already sent stops working)." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The page itself is open to anyone with the link, which is why the link is sent only to the client. On your side, the quote, its signature record and the Get approved screen follow your **Quotes** access; recording a phone answer needs the same level as editing the quote." },
        ],
      },
    ],
    faq: [
      { q: "Can the client change the price or the lines?", a: "No. They can tick or untick the optional extras you offered and nothing else. The total is recomputed on the server from your stored prices whatever the page claims." },
      { q: "Is the signature legally a signature?", a: "It is an electronic signature with an audit record: name, drawn signature, time, IP address, browser and a fingerprint of the approved document, printed on the PDF's Approval block. Whether that satisfies a given contract is a question for your lawyer, not for the software." },
      { q: "The client approved, then changed their mind.", a: "A quote can only be answered once from the page. Edit the quote and send it again, or record the change from the quote page." },
      { q: "Does the client pay on this page?", a: "No. Approval and payment are separate. If you have a deposit stage, the deposit request is emailed right after approval with its own pay link; otherwise the invoice follows when you send it. See [[the-invoice-email-and-pay-page|The invoice email and pay page]]." },
    ],
  },

  "the-invoice-email-and-pay-page": {
    title: "The invoice email and pay page",
    summary:
      "What the client receives when you send an invoice — a short email with the amount, the due date and a Pay online button — and the page it opens, where they pay by card or from a bank account and see the invoice marked paid.",
    updated: "2026-09-12",
    intro: [
      "Pressing **Send** on an invoice emails the client one short message from your company, in the invoice's language: the amount due, the due date, and one button. The button opens the invoice in the client's portal, where the whole invoice is laid out in your colours and the money is taken on Stripe's page — in your company's name, into your own bank account.",
      "The email is deliberately brief. Unlike the quote email, it carries no line items and no attachment: the invoice page is the document, and the email's one job is to get the client to it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Sending needs a client with an email address, and it refuses two things rather than guess: an invoice entered as a past job (nothing is sent for those), and an invoice that says tax applies but has no rate for the client's address. The invoice is marked **Sent** only after the message is accepted for delivery, and a chase task is created for you a week out." },
          { p: "The link opens **the invoice page** in the client's portal — a page that needs no sign-in, tied to the client by a long random token, kept out of search engines. See [[the-client-portal-as-a-client|The client portal]] for the account page behind it." },
          { figure: "harness:client-portal", caption: "The client's portal — the invoice row with its Pay button, as the client sees it after opening the link in the email and going back to their account." },
        ],
      },
      {
        id: "what-the-email-says",
        heading: "What the email says",
        blocks: [
          { bullets: [
            "**From:** your company's name. **Subject:** “Invoice INV-2071 from [Your company] — $10,606.44 due”.",
            "The brand band in your colour with your logo, the word **INVOICE** and the number.",
            "“Hi [first name],” then “Here's invoice INV-2071 for the work completed.” — or, when something has already been paid, “Here's the balance on invoice INV-2071, after the $5,000.00 already received. Thank you for that.”",
            "A note when there is one: the message you typed on a payment request, or the stage name (“Deposit”) on a payment-schedule request.",
            "**AMOUNT DUE** (or **BALANCE DUE**) with the figure, then “Due [date]” — or “Was due [date]” in red once it is late.",
            "The button **Pay online** when your Stripe account can take payments; otherwise **View your invoice**, followed by “Please get in touch to arrange payment.”",
            "“Accepted: Cash, E Transfer, Cheque.” — only the methods you ticked under **Settings → Payments**, and only if you ticked any.",
            "“Or paste this into your browser:” with the link, then the footer: “Questions? Reply to this email or call [phone].”, your company's name, and your email, phone, website and tax number.",
          ] },
          { note: "No PDF is attached, and the client cannot download one from the portal. The invoice PDF is yours to download from the invoice page and send by hand if a client asks for a file." },
        ],
      },
      {
        id: "the-invoice-page",
        heading: "The invoice page",
        blocks: [
          { bullets: [
            "**Back to your account**, then a white card with the brand rule, your logo, name, phone and tax number; **INVOICE**, the number, **Date** and **Due** (or **Was due** in red).",
            "The lines: description, quantity and amount, one per row — or “No itemised breakdown on this invoice.” Then **Notes** when the invoice has them.",
            "**Subtotal**, **Discount**, **Tax** (a figure, or **To be confirmed**, or **None**), **Total**, and **Paid** as a negative row when a payment has been recorded.",
            "A band in your colour with the one figure that matters: **BALANCE DUE** and the amount — or the stage name and the stage's share when the link came from a payment-schedule request — or **Paid in full** with the total.",
            "The action strip: the pay buttons described below, or “Please get in touch to arrange payment.” and the accepted methods when you cannot take cards, or a green **Paid in full — thank you**.",
          ] },
          { note: "The portal page lists the invoice's lines flat. The scope groups, what's included and the process steps that make the invoice the quote's twin are on the PDF and on your own invoice screen — see [[invoices-mirror-quotes|Invoices mirror quotes]]." },
        ],
      },
      {
        id: "paying",
        heading: "How the client pays",
        blocks: [
          { steps: [
            "They press **Pay $10,606.44** — or, once Stripe has activated bank payments on your account, **Pay $10,606.44 by card** or **Pay $10,606.44 from bank account**, with the note “Bank payments take 3–5 business days to clear. Until then the invoice shows as pending.”",
            "Stripe's hosted page opens in your company's name. The amount is worked out on the server from the invoice's real balance (or the requested stage's share) — the browser never sends an amount.",
            "By card, they come back to their account with a green “Payment received — thank you. It can take a minute to show below.”, the row reads **Paid**, and the invoice page reads **Paid in full — thank you**.",
            "From a bank account, they come back to an amber “Bank payment received — it takes 3–5 business days to clear. The invoice will show as paid once it has.” The row reads **Bank payment pending** until the money arrives; if the bank returns it, the page reads “Bank payment failed — [reason]. You can try again or pay by card.” and the buttons come back.",
          ] },
          { table: {
            head: ["Method", "When it is offered"],
            rows: [
              ["Card", "Whenever your Stripe account can take payments (Settings → Payments reads Stripe connected · Active)."],
              ["Bank account — pre-authorized debit in Canada, ACH in the US", "Once Stripe has activated the capability on your account and your billing currency matches (CAD for Canada, USD for the US). Settings → Payments says which it is."],
              ["Pay over time (Affirm)", "On Stripe's page only, beside the card, when you have switched on Offer pay-over-time (Affirm), the invoice is between $50 and $30,000, and the currency is USD or CAD."],
            ],
          } },
          { p: "The client never sees a processing fee. The fee comes off your side of the payment; the invoice total is what they pay. See [[payment-processing-fees-and-payouts|Payment processing fees and payouts]]." },
          { warning: "FieldQuo does not email the client a receipt after an ordinary invoice payment — the confirmation is the page itself. You are notified, the payment is recorded on the invoice, and Stripe may send its own receipt depending on your Stripe dashboard settings." },
        ],
      },
      {
        id: "reminders-and-requests",
        heading: "Reminders and payment requests",
        blocks: [
          { bullets: [
            "**Request payment** on the invoice sends the same email as a reminder: subject “$10,606.44 due — invoice INV-2071”, “A reminder that invoice INV-2071 has a balance of $10,606.44.”, with your optional note and the same button.",
            "A **payment-schedule stage** (a deposit, a halfway payment) sends the same email with the stage name as its note and the stage's share as the amount; the page then headlines that share rather than the whole balance. See [[progress-payments-by-stage|Progress payments by stage]].",
            "An **automatic overdue reminder** is sent only if you created a follow-up rule for overdue invoices, using one of your own email templates — nothing is sent otherwise. See [[invoice-reminders-and-chasing|Invoice reminders and chasing]].",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { table: {
            head: ["Where", "What it changes for the client"],
            rows: [
              ["Settings → Payments — Stripe", "Whether the button reads Pay online or View your invoice, and whether the page offers card, bank account and Affirm."],
              ["Settings → Payments — Payment methods you accept", "The “Accepted:” line — Cash, E-transfer, Cheque — on the email, the page and the PDF."],
              ["Settings → Branding", "The logo, the brand band, the button colour and the balance band."],
              ["Settings → Company Settings — Payment schedule", "The stage names the client sees as the headline on a deposit or instalment request."],
              ["The client's language", "The email follows the invoice's language; the page follows the client's language on their record, then your company default."],
            ],
          } },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — the connected Stripe account, whether bank payments are active, and the payment methods you accept." },
        ],
      },
      {
        id: "who-can-send-it",
        heading: "Who can send it",
        blocks: [
          { p: "Sending an invoice or a payment request needs **Invoices** at **view, create & edit** or above. **Settings → Payments** is for owners and administrators only." },
        ],
      },
    ],
    faq: [
      { q: "Why does the email say View your invoice instead of Pay online?", a: "Stripe has not enabled charges on your account yet. The page then shows “Please get in touch to arrange payment.” and your accepted methods. Settings → Payments says what Stripe is waiting for." },
      { q: "Why is the invoice still unpaid days after the client paid?", a: "They paid from a bank account. A bank debit takes 3–5 business days to clear; the invoice reads Bank payment pending until the money arrives and is marked paid only then." },
      { q: "Can the client pay part of the balance?", a: "Only what you ask for. A payment-schedule request asks for exactly that stage's share; otherwise the button asks for the whole balance." },
      { q: "Does the client get a receipt?", a: "Not from FieldQuo. They see the page marked Paid in full — thank you, and the row in their account reads Paid. A receipt file is yours to send by hand." },
    ],
  },

  "the-client-portal-as-a-client": {
    title: "The client portal",
    summary:
      "The one page where a client sees their invoices, what they still owe and their quotes — how they get there, what is on it, what they can and cannot do, and the fact that there is nothing to set up.",
    updated: "2026-09-12",
    intro: [
      "The client portal is a single page, on your letterhead, headed **Account for [client]**: a balance, the invoices behind it with their Pay buttons, and the quotes with where each one stands. No sign-in, no password, no app — the link is the key, and it never expires.",
      "There is nothing to switch on. Every invoice email already carries a link into it, so a client who has ever been sent an invoice has a portal.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is written in the client's language (their record, then your company default), formats money in your currency, and derives every colour from your brand colour with contrast measured. It is kept out of search engines and shows only what the client is owed and owes — no jobs, no visits, no photos." },
          { figure: "harness:client-portal", caption: "The portal as the client sees it — the company's logo, Account for Sophie Dubois, Balance owing across 1 invoice, the Invoices card with Pay $10,606.44, and the Quotes card with Approved and Declined pills." },
        ],
      },
      {
        id: "how-the-client-gets-there",
        heading: "How the client gets there",
        blocks: [
          { bullets: [
            "The **Pay online** / **View your invoice** button in every invoice email, payment request, deposit or instalment request and service-plan invoice opens the invoice page; **Back to your account** at the top of it opens the portal.",
            "After paying on Stripe's page, the client is returned to the portal with a “Payment received” banner.",
            "An automatic overdue reminder built from your own template can carry the same invoice link.",
          ] },
          { note: "There is no button in the app to copy or send a portal link, and quote emails do not carry one — the portal is reached through invoices. The link is minted once per client and reused; FieldQuo does not offer a way to expire or replace it from the app." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "What is on the page",
        blocks: [
          { bullets: [
            "Your logo (or your initial on your colour), your company's name, and **Account for [client]**.",
            "**Balance owing** — the sum across every issued invoice — then “Across 2 invoices.” or “Nothing outstanding. Thank you.”",
            "**Invoices** — one row per invoice: the number, the total, “$5,000.00 paid” when part has been paid, “due [date]”, and on the right the same action as the invoice page: **Pay $10,606.44** (or **Pay … by card** and **Pay … from bank account**), **Bank payment pending**, a **Paid** tick, or the arrange-payment line. Only the latest version of an amended invoice is listed.",
            "**Quotes** — one row per sent quote: the number, the total, the date, and a pill — **Awaiting your reply**, **Approved** or **Declined** — with a **Review** link that opens the approval page while the quote is still waiting.",
            "The footer: “Questions about any of this? Contact [Your company] at [phone] · [email].”",
          ] },
        ],
      },
      {
        id: "what-the-client-can-do",
        heading: "What the client can do, and cannot",
        blocks: [
          { p: "From the portal a client can open an invoice, pay it (by card, from a bank account, or with Affirm on Stripe's page), and open a waiting quote to approve or decline it. That is the whole list." },
          { bullets: [
            "They cannot change their name, address or email — those live on their client record, which you edit.",
            "They cannot download a PDF of an invoice or a quote from the portal.",
            "They cannot see jobs, visits, appointments, photos or a payment history — the portal shows invoices and quotes only.",
            "They cannot message you from the page; the footer gives them your phone and email.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { table: {
            head: ["Where", "What it changes on the portal"],
            rows: [
              ["Settings → Branding and Settings → Company Settings", "The logo, the colour, the name, the phone and email in the footer, the tax number on the invoice page."],
              ["Settings → Payments", "Whether the Pay buttons appear, whether a bank-account button is offered, and the accepted offline methods."],
              ["The client's language and your company default", "The language of every label on the page."],
              ["Sending", "What is listed: a draft invoice or a draft quote is never shown; only sent ones are."],
            ],
          } },
          { p: "There is no portal settings screen. FieldQuo does not let you hide the quotes card, add a message, or turn the portal off." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone with the link — which is why it is only ever sent to the client's own email address. On your side there is nothing to open: what the portal lists is exactly the invoices and quotes you already see under **Invoices** and **Quotes**." },
        ],
      },
    ],
    faq: [
      { q: "How do I send a client their portal link?", a: "Send them an invoice, or press Request payment on one they already have. Both emails carry the link. There is no separate send-portal button." },
      { q: "Does the link expire?", a: "No. It is created once per client and reused on every email, and FieldQuo does not offer a way to replace it from the app." },
      { q: "Can the client see their upcoming visit in the portal?", a: "No. Visits are managed from the link in the booking confirmation email — see [[managing-a-booked-visit|Managing a booked visit]]. The portal shows invoices and quotes only." },
    ],
  },

  "the-booking-page": {
    title: "The booking page",
    summary:
      "What a homeowner sees when they open your booking link: who or what to book, how to meet, a calendar of real availability, their details, a visit fee when you charge one, and the confirmation that follows.",
    updated: "2026-09-12",
    intro: [
      "Your booking link opens a page with your logo and name and the line **Book an appointment**. The homeowner picks what they want, picks a time from a calendar that only offers slots your team can actually keep, leaves their details, pays a visit fee if you charge one, and is told **You're booked**. The slot lands on your Appointments calendar with a **Client booking** badge.",
      "The calendar is not a wish list. Each slot is computed from the bookable hours the person set under Settings → Availability, minus their existing bookings, appointments and approved leave, and — if you switch it on — minus the times they could not drive to from the previous job.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The same page serves three doors: the link itself, the **Book** button on your website, and the embed snippet from **Settings → Booking Page** for a site you already have (inside your own page it drops the logo strip). The Stripe step for a fee always opens in the full window, never inside a frame." },
          { figure: "harness:client-booking-page", caption: "The booking page as a homeowner sees it — the company's logo and Book an appointment, Change service, Kitchen design consultation · 60 min, How would you like to meet?, Where should we come?, and the calendar with a day's Morning and Afternoon times." },
          { note: "The booking page is written in English, whatever your company's language: only the “What kind of work is it?” chips and the notes field are translated, from the visitor's browser language. The confirmation email and the visit page that follow are in the client's language." },
        ],
      },
      {
        id: "the-steps",
        heading: "What the homeowner does",
        blocks: [
          { steps: [
            "**Choose.** If your team members have set bookable hours, the page asks **Choose who you'd like to meet** and lists them with their next free time; otherwise it asks **What can we help with?** and lists your event types with their length and any fee. A company with a single event type skips this step.",
            "**Pick a time.** **How would you like to meet?** — **Visit my place**, **Phone call** or **Video call** — appears only when you offer more than one. For a visit, **Where should we come?** takes an address (“Optional — it lets us hide times we couldn't get to you on time.”). Then the month grid and a day's times under **Morning**, **Afternoon** and **Evening**.",
            "**Their details.** **Your name**, **Email** (“We'll send your confirmation here.”), **Phone** (optional), **What kind of work is it?** when you have services switched on, and **Anything we should know?**.",
            "**Confirm.** The button reads **Confirm booking** — or **Pay $49.00 & book** when the event type has a fee, after a **Visit fee** card: “Paid now to hold your spot. If you go ahead with the work, [Your company] can credit it back on your invoice.”",
            "**You're booked.** “A confirmation is on its way to [email]. [Your company] will be in touch if anything changes.” A paid booking first shows **One more step** and **Continue to secure payment** — “Payment is handled by Stripe. Your time is held for 30 minutes.”",
          ] },
          { p: "If two people go for the same slot, the second sees “That slot was just booked by someone else. Please pick another time.” and a refreshed calendar. A company with no active event type shows “[Your company] hasn't set up online booking yet.” with your phone number." },
        ],
      },
      {
        id: "what-decides-the-times",
        heading: "What decides the times on the calendar",
        blocks: [
          { bullets: [
            "**Bookable hours** of the person the event type belongs to, set under **Settings → Availability**. A person with no bookable hours offers no slots at all.",
            "**What is already on their calendar** — confirmed bookings, scheduled appointments, and approved time off, which blocks the whole day.",
            "**Travel**, when **Don't offer times you can't drive to** is on and the homeowner gave an address: a slot is hidden if they could not get there from the previous job (plus your **Extra time between jobs**), or from there to the next one. An address that cannot be placed shows every time and says so.",
            "Slots start every 15 minutes and must finish inside the bookable window; a new booking can be made for any future time, with no minimum notice and no limit on how far ahead.",
            "Times are shown in the visitor's own time zone. The arrival window you promise appears in the confirmation email and on the visit page, not on the calendar.",
          ] },
        ],
      },
      {
        id: "the-visit-fee",
        heading: "The visit fee",
        blocks: [
          { p: "An event type can carry a **Visit fee** and, optionally, a **Promo price** shown with the standard price struck through while **Promo on** is ticked. The fee is charged by card only, on Stripe's page, into your connected account; while the client is paying, the slot is held for 30 minutes and the appointment is created only when the payment settles. A hold that lapses is released, and shows on your dashboard as awaiting payment until then." },
          { p: "A fee is charged only when Stripe can take payments on your account; without Stripe the same event type is simply free. What happens to the fee if the client cancels is your **Changes & cancellations** policy — see [[managing-a-booked-visit|Managing a booked visit]] and [[booking-fees-and-visit-deposits|Booking fees and visit deposits]]." },
        ],
      },
      {
        id: "after-they-book",
        heading: "After they book",
        blocks: [
          { bullets: [
            "The client gets an email from your company, in their language: subject “Confirmed: Kitchen design consultation with [Your company]”, **You're booked in**, **When** (with your arrival window, if you promise one) and **Where**, and the button **Change or cancel this visit**. FieldQuo sends no confirmation text; a reminder text goes out only if you have set one up.",
            "On your side, the client is matched by email or created, and the visit appears under **Appointments** with a **Client booking** badge, assigned to the person whose calendar it is, with the address and notes the client typed.",
            "FieldQuo does not email or notify you about a new booking — the calendar is the record. You are emailed when a client later moves or cancels it.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { table: {
            head: ["Setting on Settings → Booking Page", "What it changes on the page"],
            rows: [
              ["**How long is a visit?**", "The length of the consultation FieldQuo creates for each team member who sets bookable hours."],
              ["**How can clients meet you?** — Visit their place · Phone call · Video call", "Which meeting modes the page offers; with more than one, the client chooses."],
              ["**Don't offer times you can't drive to** and **Extra time between jobs**", "Whether an address hides unreachable slots, and how much slack is added to the drive."],
              ["**What do you promise the client?** — Exact time or ± 15 / 30 / 60 min", "What the confirmation email and the visit page say under When."],
              ["Each event type — **Length**, **Active**, **Visit fee**, **Promo price**, **Promo on**", "What is listed, for how long, and at what price; an inactive type disappears from the page."],
              ["**New Event Type**", "Adds a kind of appointment a homeowner can self-book."],
            ],
          } },
          { figure: "live:app-settings-booking-page", caption: "Settings → Booking Page — the embed snippet, How long is a visit?, the meeting modes, travel and arrival window, Changes & cancellations, and one card per event type." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The page is public. **Settings → Booking Page** needs the Manager level or above — an owner, an administrator, a Manager or a Dispatcher. Every team member sets their own bookable hours under **Settings → Availability**, which is what puts them on the page." },
        ],
      },
    ],
    faq: [
      { q: "Why does the page show a person picker instead of my event types?", a: "Because at least one team member has set bookable hours; the page then lists people, each with their own consultation. Event types are listed when nobody has." },
      { q: "Can a client book for tomorrow morning at midnight tonight?", a: "Yes, if the slot is free — the page applies no minimum notice to a new booking. The notice you set under Changes & cancellations applies to moving or cancelling one, not to making it." },
      { q: "Where does the visit fee go?", a: "Into your connected Stripe account, like an invoice payment. The confirmation email does not mention it; the visit page shows it as a deposit paid." },
      { q: "Can I put the calendar on my own website?", a: "Yes — Settings → Booking Page has the embed snippet. See [[embed-booking-and-quote-forms|Embed booking and quote forms on any site]]." },
    ],
  },

  "managing-a-booked-visit": {
    title: "Managing a booked visit",
    summary:
      "The page behind Change or cancel this visit in the confirmation email: what the client sees, how they move or cancel a visit within your notice, what happens to a visit fee, and what you are told.",
    updated: "2026-09-12",
    intro: [
      "Every booking confirmation email carries one button, **Change or cancel this visit**. It opens a page on your letterhead with the visit's details and two choices — **Change the time** and **Cancel this visit** — for as long as your notice period allows. Inside that window the page says so, in words that name your policy, and gives them your phone number instead.",
      "Money follows your rules, not the client's. A fee they paid carries over when they move the visit, and on a cancellation it is returned only if you switched that on and they cancelled in time.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The link is a long random token minted when the booking was confirmed; it is in the confirmation email and in the email sent after a move, and in no text message. The page is written in the language of the quote the visit is about, else your company default." },
          { figure: "harness:client-visit-manage", caption: "The visit page as the client sees it — Your visit, Kitchen design consultation, About your estimate Q-1042, When with the arrival window, Where with We're coming to you, $49.00 deposit paid, then Change the time and Cancel this visit." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "What is on the page",
        blocks: [
          { bullets: [
            "Your logo and name, **Your visit**, the event type, and **About your estimate Q-1042** when the visit is tied to a quote.",
            "**When** — the arrival window you promise (“between 8:30 AM and 10:30 AM”) or the exact time, in your company's time zone.",
            "**Where** — the address with “We're coming to you”, or “Phone call — we'll ring you”, or “Video call — we'll email a link”.",
            "**$49.00 deposit paid** when a visit fee was taken.",
            "**Need to change something?** with **Change the time** and **Cancel this visit** — or, when the visit can no longer be changed here, the reason and “Call [Your company] on [phone] — they can still move it for you.”",
            "“Questions? Call [Your company] on [phone].”",
          ] },
        ],
      },
      {
        id: "changing-the-time",
        heading: "Changing the time",
        blocks: [
          { steps: [
            "They press **Change the time**. **Pick a new time** shows the same calendar as the booking page, offering only slots that are free and at least your notice period away.",
            "They pick a day and a time and press **Move my visit here** (or **Keep my current time** to back out).",
            "The page reads **Your visit has been moved** — “[Your company] has been told, and a new confirmation is on its way to you.” A fee already paid carries over; nothing is charged or refunded.",
          ] },
          { p: "If the slot went to someone else in the meantime: “That time has just been taken. Pick another one.” If it is too close: “That time doesn't give them enough notice. Pick a later one.”" },
        ],
      },
      {
        id: "cancelling",
        heading: "Cancelling, and what happens to the fee",
        blocks: [
          { p: "**Cancel this visit** asks “Cancel this visit?” — “[Your company] will be told straight away, and your time goes back on their calendar.” — with **Keep my visit** and **Yes, cancel it**. Under the question, when a fee was paid, one of three sentences states what your policy will do with it:" },
          { table: {
            head: ["What the page says", "When"],
            rows: [
              ["“Your $49.00 deposit will be returned to the card you paid with.”", "**Return the visit fee when they cancel in time** is on, and they are cancelling with at least the refund notice."],
              ["“Your $49.00 deposit is not automatically returned — get in touch with them about it.”", "The refund switch is off (the default), or they are inside the refund notice."],
              ["“Your $49.00 deposit has already been returned.”", "You refunded it by hand before they cancelled."],
            ],
          } },
          { p: "After **Yes, cancel it** the page reads **Visit cancelled** — “[Your company] has been told. If this was a mistake, get in touch and they'll find you another time.” — and, when a refund applies, “Your $49.00 deposit is on its way back. It can take a few days to show on your statement.” The refund is the amount actually paid, returned to the same card; the card processing fee is not returned to you. If Stripe cannot make the refund, nothing is cancelled and the page says so." },
        ],
      },
      {
        id: "when-it-cannot-be-changed",
        heading: "When the page refuses",
        blocks: [
          { bullets: [
            "“[Your company] asks for at least 24 hours' notice, so this visit can't be changed here any more.” — inside your notice period. The number is yours.",
            "“This visit has already taken place.” / “This visit has already been cancelled.”",
            "“This visit isn't confirmed yet — the payment hasn't come through.” — a fee still being paid.",
            "An unknown or replaced link is a plain “This link isn't valid” page.",
          ] },
        ],
      },
      {
        id: "what-you-see",
        heading: "What you see on your side",
        blocks: [
          { bullets: [
            "The appointment moves or is marked cancelled on **Appointments**; the old slot is bookable again at once.",
            "Your company email address gets a letter: “A booking moved” — “[Client] moved their Kitchen design consultation using the link in their confirmation email.” — or “A booking was cancelled”, with “The $49.00 visit fee was refunded automatically, per your cancellation policy.” or “The $49.00 visit fee was NOT refunded.”",
            "The client gets the mirror: **Your visit has moved** with the new time, or **Your visit is cancelled** with the fee sentence.",
          ] },
          { note: "The office letter goes to the company email address under Settings → Company Settings. There is no in-app notification for a client's move or cancellation." },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { table: {
            head: ["Setting under Settings → Booking Page → Changes & cancellations", "What it does"],
            rows: [
              ["**Notice you need to change or cancel** (hours)", "How close to the visit the page still offers Change the time and Cancel this visit; 24 hours if you never set it. A new time must also be at least this far away."],
              ["**Return the visit fee when they cancel in time**", "Off unless you turn it on. Off, a cancellation goes through and the fee stays with you."],
              ["**Notice needed to get the fee back** (hours)", "Only with the switch on. Blank means the same notice as above; longer means a window where they can still cancel but the fee stays."],
              ["**What do you promise the client?**", "Whether When shows an exact time or an arrival window."],
            ],
          } },
          { p: "The preview lines under the fields say the policy back to you in the client's words — “Clients can cancel or move a visit up to 24 hours before it starts. Inside that, they have to call you.” — so the sentence on the client's page and your setting cannot disagree." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Who can change it",
        blocks: [
          { p: "The client's page is open to whoever holds the link. The policy under **Settings → Booking Page** needs the Manager level or above — an owner, an administrator, a Manager or a Dispatcher." },
        ],
      },
    ],
    faq: [
      { q: "Can the client move a visit to tomorrow at 8 tonight?", a: "Only if your notice allows it. With 24 hours' notice, both the visit they are moving and the new time must be at least a day away; otherwise the page tells them to ring you." },
      { q: "The client cancelled and the fee was not refunded. Why?", a: "The refund switch is off by default — a visit fee is your money the moment it is taken. Turn on Return the visit fee when they cancel in time, or refund it by hand from the payment." },
      { q: "Does moving a visit charge anything?", a: "No. A fee already paid carries over to the new time; the client's page and both emails say so." },
    ],
  },

  "the-instant-estimate-page": {
    title: "The instant estimate page",
    summary:
      "What a homeowner sees on your instant-estimate link: the questions per trade, the photos it requires, the range it shows — or deliberately does not — the email they get, and the review your team does before any of it becomes a quote.",
    updated: "2026-09-12",
    intro: [
      "Your instant-estimate link opens a page headed **Get an instant estimate**: a form on the left, a **Your estimate** panel on the right. The homeowner picks a trade, describes the job, adds photos and their details, and — depending on what you chose for that trade — sees an estimated range as they type, after they submit, or not at all. Every submission lands on your **Estimate Reviews** screen and cannot be sent as a quote until a person confirms the price.",
      "Two things are never on this page: a rate card, and a single figure. The public endpoint returns your services and their questions, never your rates; what the homeowner sees is a range priced on the server from your own numbers.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page carries your logo, your name and your colour, and — unlike a quote or portal link — is not hidden from search engines. Through the embed snippet on **Settings → Instant Quotes** it also sits inside any website you already have. A trade appears on it only when its card is **On** and FieldQuo can actually produce a number from the rates you saved." },
          { figure: "harness:client-instant-estimate", caption: "The instant estimate as a homeowner sees it — the company's logo and Instant estimate, Get an instant estimate, What do you need?, Tell us about the property, Your budget, Where's the job?, Your details, and the Your estimate panel waiting on the right." },
          { note: "The page and its email exist in English and French only, chosen by your company's default language — and in French, the form's questions stay in English while the estimate panel, the messages and the email are translated. A company whose default is Spanish gets the English page." },
        ],
      },
      {
        id: "what-the-homeowner-fills-in",
        heading: "What the homeowner fills in",
        blocks: [
          { bullets: [
            "**What do you need?** — your live trades as chips (Roofing, Cabinet Refinishing, Painting, Junk Removal and so on).",
            "**Tell us about the property** — the questions for that trade: a property address for roofing (the roof is measured from satellite imagery), a lawn traced on a map for mowing, an area in square feet with a condition or access choice, door and drawer counts for cabinets, a number of steps, or the items to remove.",
            "**Which option?** — the materials you priced, by name only, when there is more than one.",
            "**Your budget** — four bands in your currency (“Under $1,000”, “$1,000 – $5,000” …). The browser sends which band, never an amount.",
            "**Where's the job?** — an address with autocomplete (roofing already has one).",
            "**Your details** — a name and an email or a phone number.",
            "**Photos** — at least one photo, video or plan is required.",
            "The button: **Get my estimate**, or **Reveal my estimate** when the range is shown after submitting. While something is missing it lists what: “Still needed: … at least one photo”.",
          ] },
          { p: "The form does not ask when they want the work done — that is a conversation for the quote." },
        ],
      },
      {
        id: "what-they-see",
        heading: "What they see, by your choice per trade",
        blocks: [
          { table: {
            head: ["What the homeowner sees (Settings → Instant Quotes)", "On the page", "After submitting, and in the email"],
            rows: [
              ["**Don't show a price**", "“We don't show prices online for this service. Leave your details and we'll confirm your price shortly.”", "“No price is shown here — we review every job and send your quote ourselves.” The email says the quote is being put together, with no figure."],
              ["**Show the range after they submit**", "A blurred “$X,XXX – $X,XXX” with a lock: **Submit to reveal your estimate**. The figure is never sent to the page before they submit.", "The range appears in the panel, and the email carries it."],
              ["**Show the range straight away**", "The range updates as they describe the job, before any contact details.", "The same range, on the page and in the email."],
            ],
          } },
          { p: "A range reads **Estimated range** “$4,200 – $5,500” in your currency, then what it was measured from and the sentence “This is an estimate from the counts you gave us, not a final quote. [Your company] will confirm it before anything is binding.” If the job falls under your minimum charge the panel says so. After submitting, **You're all set** — “[Your company] has your details and will confirm your quote shortly.” — with a **Reference Q-2026-0042**, and a **Book a visit** panel when your booking page is set up." },
          { p: "Financing, when you have switched it on, is a sentence in your own words and an optional **See financing options** button. No monthly figure is shown on this page; that appears on the quote approval page only when you have entered a rate and a term." },
        ],
      },
      {
        id: "after-they-submit",
        heading: "After they submit",
        blocks: [
          { bullets: [
            "If they gave an email, they receive “Your estimate from [Your company]” from your company — the range in a box marked “before tax” when it was shown on the page, the same disclaimer, a **Book a visit** button when you take bookings, and the reference.",
            "On your side, a draft quote is created marked **Needs review**, with the range the homeowner saw, their stated budget, the measurement, their photos and a lead scored from the budget band. Everyone who can approve estimates is told: “Estimate Q-2026-0042 for [client] is waiting for sign-off”.",
            "The quote sits on **Estimate Reviews** with “Homeowner saw: $4,200–$5,500” and “Their budget: $1,000 – $5,000”, and an **Approve at** figure you can change before pressing **Approve**. Until then, **Send** on the quote refuses: “This instant estimate hasn't been approved yet. Confirm the price in Estimate Reviews, then send.” The share link refuses the same way.",
            "Once approved, the quote reads **Approved — ready to send** and goes out like any other. See [[estimate-reviews|Estimate Reviews]].",
          ] },
        ],
      },
      {
        id: "what-is-never-shown",
        heading: "What is never shown",
        blocks: [
          { p: "The public page receives your trades, their questions, your material names and your budget bands — never a rate, a surcharge or a minimum. Every figure is computed on the server from the rows you saved, and the browser only ever sends counts, an address or an outline, and a budget band. Publishing a rate card openly would hand it to every competitor in the city; the page is built so that it cannot." },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { table: {
            head: ["On Settings → Instant Quotes", "What it changes"],
            rows: [
              ["**On** / **Off** on each trade card, and **Save & enable**", "Whether the trade is offered. A card whose rates cannot produce a number reads “Homeowners can't get a price for this yet.” and cannot be switched on."],
              ["**What the homeowner sees**", "The three modes in the table above, per trade. The default is Don't show a price."],
              ["**Budget bands**", "The three cut-offs behind the four chips the homeowner picks from."],
              ["**Materials & sell rates**, the surcharges, **Range width (±)** and **Minimum charge**", "The numbers the range is computed from, and how wide it is."],
              ["**Financing**", "The sentence, the provider link, and — for the approval page — your stated rate and term."],
              ["**See what homeowners see** and the embed snippet", "Opens the public page; the snippet puts it on your own site."],
            ],
          } },
          { figure: "live:app-settings-instant-quotes", caption: "Settings → Instant Quotes — the live count, See what homeowners see, the embed snippet, and a card per trade with its On switch, What the homeowner sees, and the rates." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The page is public. Opening **Settings → Instant Quotes** needs the pricing toggle in your access — an Estimator can read it, Crew cannot — and editing the rates or switching a trade on is for owners and administrators only. Approving an estimate on Estimate Reviews needs the Manager level or above." },
        ],
      },
    ],
    faq: [
      { q: "Can a homeowner see my rates?", a: "No. The page receives services, questions, material names and budget bands; every figure is worked out on the server from rates that never leave it." },
      { q: "Why does one trade not appear on the page?", a: "Its card is Off, or its rates cannot produce a number yet — the card says what is missing — or, for painting, neither Interior nor Exterior Painting is on under Services & Pricing." },
      { q: "Is the range a quote?", a: "No. It is a draft marked Needs review; a person confirms the price on Estimate Reviews before it can be sent, and the page and the email both say so to the homeowner." },
      { q: "Why is the page in English for my French-speaking company?", a: "It follows your company's default language, and exists in English and French. Set the default to French under Settings → Language and the estimate panel, the messages and the email switch; the form's questions stay in English." },
    ],
  },
};
