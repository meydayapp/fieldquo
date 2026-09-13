// content/help/en/invoices-and-payments-3.js
//
// Part 3 of the “invoices-and-payments” category in English (see the
// composer, invoices-and-payments.js): payment terms, sales tax on invoices,
// pay-over-time, service plans and their bank-debit mandate, the client
// portal, the accounting export, booking fees, and the money-owed panel.
//
// Every sentence is read from the code it describes — the Company Settings
// page and lib/documents/paymentSchedule.js, lib/tax/*, lib/financing/*,
// lib/servicePlans/*, app/portal/*, lib/export/accountingExport.js,
// lib/booking/* and lib/analytics/receivables.js — and the words on the
// screen are the `en` strings of app/i18n/appMessages.js.
export const ARTICLES = {
  "payment-terms": {
    title: "Payment terms",
    summary:
      "The one line that says when the client pays — where you set it, where it prints, and how the payment schedule takes it over.",
    updated: "2026-09-12",
    intro: [
      "Payment terms are one line of text on Company Settings — “50% deposit, balance on completion”, “Net 30”, “Due on receipt”. FieldQuo prints that line on every quote you send and shows it on the quote and invoice pages your staff read. Nothing invents one for you: leave the field blank and the section simply does not appear.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The terms print on the quote PDF, in the quote email, and on the approval page the client opens — after the total and the process steps, so they are read at the moment the client is deciding. By default they do not print on the invoice PDF or the invoice email: an invoice is a demand for the amount due by the due date, and the schedule has already happened by then. If you want them on invoices too, add the **Payment terms** section to your invoice layout on **Settings → PDF Templates** — see [[settings-pdf-templates|PDF Templates]]. Staff always see them on the invoice page, under **Payment terms**, so whoever is asked about them on a doorstep can answer." },
          { p: "Under the terms, the document lists the payment methods your company accepts (cash, e-transfer and cheque by default). There is no screen to change that list today." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Open **Settings → Company Settings**. The first card is **Scope of work and terms**: a **Default scope of work** box with trade templates to start from, and under it the **Payment terms** field with the placeholder “e.g. 50% deposit, balance on completion — or Net 30”. The helper line under the field says what happens to what you type: a schedule it can read prints as cards, anything else prints as you wrote it, and blank means no section at all." },
          { figure: "live:app-settings-company", caption: "Company Settings — the Scope of work and terms card, with the Payment terms field, then the Payment schedule card below it." },
        ],
      },
      {
        id: "set-them",
        heading: "How to set your payment terms",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings**.",
            "In **Scope of work and terms**, type your terms in **Payment terms** — a sentence, or a set of percentages.",
            "Press **Update Settings**. The next quote you create carries the new terms; quotes already sent keep what they were sent with.",
          ] },
          { tip: "Write percentages if you want cards. “50% deposit, 50% on completion” prints as two large blocks the client reads in a second; “Payment by e-transfer within 14 days of invoice” prints as that sentence, verbatim." },
        ],
      },
      {
        id: "cards-or-sentence",
        heading: "Cards or a sentence: how the text is read",
        blocks: [
          { p: "FieldQuo tries to read a milestone schedule out of your terms and shows cards only when it is sure. The rule is deliberately conservative — a mangled set of cards would be worse than the plain sentence it replaced." },
          { table: {
            head: ["What you typed", "What the client sees"],
            rows: [
              ["50% deposit, 50% on completion", "Two cards: 50% Deposit · 50% Completion — a leading “on”, “at” or “due” is dropped from the label"],
              ["30% deposit, 40% job start, 30% on completion", "Three cards: Deposit · Job start · Completion"],
              ["50%, 40%, 10%", "Cards with stand-in labels — Deposit · Progress payment · On completion — always in English, whatever the document's language"],
              ["Net 30", "The sentence, printed as written"],
              ["10% discount for cash", "The sentence — one percentage is not a schedule, and the parts must add up to about 100%"],
            ],
          } },
        ],
      },
      {
        id: "payment-schedule",
        heading: "When a payment schedule is switched on",
        blocks: [
          { p: "The **Payment schedule** card below the terms is the rule-based version: real invoices raised off the job's own dates — a deposit when the invoice is created, the rest at job start, halfway or completion. As soon as it has stages, the **Payment terms** field locks and is rewritten from the schedule (“30% Deposit, 40% Job start, 30% On completion”, or your own stage names), so the document a client reads always says what will actually be billed. Press **Turn off — go back to free text** to edit the sentence by hand again. See [[deposits-and-payment-schedules|Deposits and payment schedules]]." },
        ],
      },
      {
        id: "who-can-change",
        heading: "Who can change it",
        blocks: [
          { p: "Company Settings is for people who may run the company: the owner, administrators, and anyone on the Manager or Dispatcher level. Estimators and Crew do not see the Company Settings row in the menu; the terms still print on the quotes they write. A read-only support session sees the card but cannot save it." },
        ],
      },
    ],
    faq: [
      { q: "Do the terms change on quotes I have already sent?", a: "No. A quote is read from the terms current when it was created, and a signed PDF keeps saying what it said. Change the terms and the next new quote picks them up." },
      { q: "Can I set different terms per quote?", a: "Not today — the terms are one company-wide line. What you can vary per quote is the scope of work, which is copied onto each quote and editable there." },
      { q: "Why is the Payment terms field greyed out?", a: "A payment schedule is active. The text is generated from the schedule's stages so the two cannot disagree. Turn the schedule off to type freely again." },
    ],
  },

  "sales-tax-on-invoices": {
    title: "Sales tax on invoices",
    summary:
      "How the tax line on an invoice is decided, what Apply tax does, why a send can be refused, and where your registration number prints.",
    updated: "2026-09-12",
    intro: [
      "An invoice carries one tax amount, worked out from the rates you set up once on Company Settings. An invoice raised from a quote copies the quote's tax exactly; a new invoice resolves a rate for the client the moment you pick them, and tells you where that rate came from. FieldQuo never invents a rate, and it refuses to send an invoice that says tax applies but charges none with nothing to explain why.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Three things decide the tax line: the rates on the **Tax Settings** card, the **Automatically apply the local tax rate of the client** setting, and the **Apply tax** checkbox on the document itself. Your registration number, if you enter one, prints at the foot of every quote and invoice so a business client can claim the tax back." },
          { note: "Tax is one amount per invoice. A Quebec company charging GST and QST enters one combined rate (14.975%) and the invoice shows one tax line. There are no tax codes and no per-line tax, so the accounting export cannot produce a sales-tax return — see [[the-accounting-export|The accounting export]]." },
        ],
      },
      {
        id: "tax-settings-card",
        heading: "The Tax Settings card",
        blocks: [
          { p: "On **Settings → Company Settings**, the **Tax Settings** card holds: **Tax ID name** (e.g. GST) and the number field, labelled the way your country labels it; a box for **I don't have one — my business isn't registered for this**; the **Tax Rates** list, each rate with its percentage and a **Default** badge on one of them; **Create tax rate** (a name, a **Rate %**, and a **Default** tick); and the **Automatically apply the local tax rate of the client** checkbox. A company in a VAT country also answers **Are you registered for VAT?**." },
          { figure: "live:app-settings-company", caption: "Company Settings — the Tax Settings card: registration number, the tax rates with their Default badge, and the automatic-rate checkbox." },
          { p: "The full card is described in [[tax-settings|Tax settings]]. This article is about what those settings do to an invoice." },
        ],
      },
      {
        id: "on-a-new-invoice",
        heading: "On a new invoice",
        blocks: [
          { p: "On **Invoices → New Invoice**, the **Apply tax** checkbox shows the rate in its label — **Apply tax (13%)** — and, when ticked, a **Tax rate** field you can overtype. The rate is resolved for the client you picked, in this order: if the automatic setting is off, your default rate; otherwise a rate of yours whose name matches the client's province (“HST Ontario”, “GST + QST (QC)”); otherwise the published Canadian rate for that province; otherwise your default. Nothing outside Canada is ever guessed — a US state figure is a floor, not a rate, and EU VAT applies only once you have said you are registered." },
          { figure: "live:app-invoices-new", caption: "New Invoice — the line items, then Apply tax with the resolved rate and the note saying where it came from." },
          { warning: "If the client has no address on file, the rate is **Assumed** from your own province and the screen says so. A client across a provincial line owes a different rate — Ottawa and Gatineau are 13% and 14.975% — so check it before sending, or add the client's address and the real rate applies." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["Apply tax, ticked", "Tax is computed at the rate shown and added to the total. The document states the rate."],
              ["Apply tax, unticked", "The document says no tax applies — a stated position, not a blank."],
              ["Tax rate, typed by hand", "Your figure wins for this document and is not re-resolved if you change the client."],
              ["Default badge", "The rate used whenever nothing more specific matches."],
              ["Automatically apply the local tax rate", "Matches the client's province against your rate names, then the published Canadian table; off, every document starts from your default."],
              ["Tax ID name and number", "Print at the foot of every quote and invoice. Blank means no line at all, never an empty label."],
            ],
          } },
        ],
      },
      {
        id: "a-refused-send",
        heading: "When a send is refused",
        blocks: [
          { p: "Sending is stopped when an invoice says tax applies, charges $0.00, and nothing can explain why — no client country or province, and no fallback rate. The message reads: “This document says tax applies but charges none, and there is nothing to work the rate out from.” Add the client's country and province, or untick Apply tax if none is owed, then send again. Quotes have the same stop." },
        ],
      },
      {
        id: "invoices-from-quotes-and-plans",
        heading: "Invoices from quotes, and from service plans",
        blocks: [
          { bullets: [
            "An invoice raised from an accepted quote copies the quote's tax amount and its on/off state. It is not re-priced — the client already read that figure.",
            "Deleting or changing a tax rate never touches a document already sent; tax is stored as an amount, not a rate.",
            "A service plan states its own **Tax %** when you sell it. Blank means no tax on that plan, not “work it out later”.",
          ] },
        ],
      },
      {
        id: "who-can-change",
        heading: "Who can change it",
        blocks: [
          { p: "Tax Settings belong to the owner, administrators, Managers and Dispatchers. Raising an invoice and choosing its tax needs the Invoices level **View, create, and edit** and **Show Pricing** — a Dispatcher or Manager by default; an Estimator can read invoices but not raise them." },
        ],
      },
    ],
    faq: [
      { q: "Can I charge two taxes as two lines?", a: "No. Enter the combined rate (Quebec: 14.975%) as one rate; the invoice shows one tax line." },
      { q: "Why does the invoice say “Assumed Ontario”?", a: "The client has no address on file, so FieldQuo fell back to your own province and labelled it as a guess. Add the client's address, or overtype the rate." },
      { q: "Does FieldQuo remit or file anything?", a: "No. It prints what you enter and adds the tax you chose. Filing and remittance are yours." },
    ],
  },

  "pay-over-time-financing": {
    title: "Pay-over-time financing",
    summary:
      "Two separate things: Affirm at checkout, where the lender decides and you are paid in full, and an optional monthly figure on quotes on terms you state yourself.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo does not lend money and does not approve anyone. What it offers is two things you can switch on separately: **Affirm** as a second option beside the card at checkout, so a client can split an invoice into payments while you are paid in full up front; and a monthly figure on the quote approval page, shown only when you have entered your own rate and term. Neither is on by default.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Pay-over-time is offered at checkout through Stripe, where the lender decides. FieldQuo does not lend and does not approve anyone. The monthly figure shown on a quote appears only if you enter your own rate and term — FieldQuo never invents one." },
          { p: "The two controls live on two screens: the **Offer pay-over-time (Affirm)** switch on **Settings → Payments**, and the **Financing** card on **Settings → Instant Quotes**." },
        ],
      },
      {
        id: "affirm-at-checkout",
        heading: "Affirm at checkout",
        blocks: [
          { steps: [
            "Activate Affirm in your own Stripe dashboard first — FieldQuo cannot do that for you and cannot check it.",
            "Open **Settings → Payments**. Once Stripe is active, the card **Offer pay-over-time (Affirm)** appears with a switch.",
            "Turn it on. Invoices between **$50 and $30,000** in USD or CAD then show Affirm beside the card on the pay page; anything outside that range, or a company Affirm has not been activated for, gets a card-only page rather than a broken one.",
          ] },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — the processing-fee card, the connected Stripe account, and the pay-over-time switch below it." },
          { p: "You are still paid in full, up front; Affirm collects the instalments from the client. The fee on an Affirm payment is Affirm's rate, higher than the card rate, and it is passed through on that payment the same way a card fee is — see [[payment-processing-fees-and-payouts|Payment processing fees and payouts]]. A client who pays by card on the same page pays the card fee, nothing more." },
        ],
      },
      {
        id: "a-monthly-figure-on-quotes",
        heading: "A monthly figure on quotes",
        blocks: [
          { steps: [
            "Open **Settings → Instant Quotes** and find the **Financing** card.",
            "Turn it on and write **What to tell the homeowner** in your own words — “We offer financing on approved credit — ask us for details.” Add a **Provider link (optional)** if you use a lender; the client gets a button to them.",
            "Under **Your stated terms (optional)**, fill in both **Annual rate (APR %)** and **Term (months)**, or neither. Press **Save**.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Settings → Instant Quotes — the Financing card at the bottom: the note, the provider link, and the stated rate and term." },
          { p: "With both terms stated, the quote approval page shows an estimated monthly payment under the total, labelled as an estimate on your stated terms. The instant-estimate page shows your note and the provider button, never a monthly figure. Leave either field blank and no monthly figure is shown anywhere — there is no default rate and no default term." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["Offer pay-over-time (Affirm) — on", "Eligible invoices offer Affirm beside the card at checkout. Affirm's fee is passed through on those payments only."],
              ["Offer pay-over-time (Affirm) — off", "Every pay page is card-only, even if Affirm is active in your Stripe dashboard."],
              ["Financing card — on, no terms", "The quote says financing is available, in your words, with a button to your provider if you gave one. No number."],
              ["Financing card — rate and term stated", "The quote adds an estimated monthly payment, computed from your APR and term and labelled as your estimate."],
              ["Financing card — off", "Nothing about financing appears on quotes or estimates."],
            ],
          } },
        ],
      },
      {
        id: "the-limits",
        heading: "The limits",
        blocks: [
          { warning: "Do not promise a rate or a monthly amount you cannot honour. The figure on the quote is computed from the terms you typed and shown to the homeowner as yours. At checkout, Affirm quotes its own terms and its decision is the lender's, not FieldQuo's and not yours." },
          { bullets: [
            "Affirm: invoices from $50 to $30,000, USD or CAD only, and only once Affirm is activated on your Stripe account.",
            "The monthly figure: whole months, an APR between 0% and 100%, both fields or neither.",
            "Bank debit and service plans are not financing — a plan is your own instalments, on your own invoices. See [[service-plans|Service plans]].",
          ] },
        ],
      },
      {
        id: "who-can-change",
        heading: "Who can change it",
        blocks: [
          { p: "Both switches are for the owner and administrators: Settings → Payments is a billing-admin screen, and the Instant Quotes rate card, financing included, refuses anyone else on save." },
        ],
      },
    ],
    faq: [
      { q: "Does FieldQuo check the client's credit?", a: "No. Affirm does, at checkout, and decides alone. FieldQuo never sees the application." },
      { q: "Can I show a monthly figure without stating a rate?", a: "No. No terms, no figure — a number FieldQuo invented would be a term you could be held to." },
      { q: "Is Affirm available in Canada?", a: "Yes, for invoices in CAD as well as USD, within the $50–$30,000 range, once activated in your Stripe dashboard." },
    ],
  },

  "service-plans": {
    title: "Service plans (recurring billing)",
    summary:
      "Sell a repeat — spring and fall, monthly, quarterly — and let each visit raise its own invoice, or charge the client's saved card or bank account automatically.",
    updated: "2026-09-12",
    intro: [
      "A service plan is a standing instruction to bill one client the same amount on a cadence you choose: gutter cleaning twice a year, a monthly lawn visit, a quarterly maintenance call. Every occurrence raises a real invoice in your name. Collection is either an invoice with a pay link, which works for every client, or an automatic charge against a card or Canadian bank account the client authorised in writing.",
      "The money terms — amount, discount, cadence, length — are frozen when you save the plan, because the client authorises those exact figures. To change the deal, cancel the plan and sell a new one.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Service Plans** sits in the Money group of the sidebar, after Invoices, because a plan is a rule that raises invoices. The screen reads “Recurring work sold as a package, billed on a cadence you choose.” Each row shows the plan name, **Active**, the client, the cadence (**Twice a year**, **Quarterly**), the per-visit price, how it is collected (**Invoice sent each visit** or **Charged automatically — Visa ···· 4242**), and either the term total with its package discount or **Runs until cancelled**." },
          { figure: "live:app-plans", caption: "Service plans — one row per plan with its cadence, per-visit price, collection method and term total." },
        ],
      },
      {
        id: "sell-a-plan",
        heading: "How to sell a plan",
        blocks: [
          { steps: [
            "Open **Service Plans** and press **New plan**.",
            "Pick the **Client** and the **Service**, and give the plan a **Plan name** — that is what the client sees on every invoice.",
            "Under **Schedule**, choose **How often** (Weekly, Monthly, Quarterly, Twice a year, Once a year), the **First visit** date, and **How long**: **A number of visits**, **Until a date**, or **Until cancelled**.",
            "Under **Price**, enter the amount **Per visit, before discount**, an optional **Package discount %**, and **Tax %** — blank means no tax on this plan.",
            "Under **How it gets paid**, choose **Invoice each visit** or **Charge automatically**, then press **Create plan**.",
          ] },
          { figure: "create:app-plans-create", caption: "New service plan — client, service, schedule, price and how it gets paid." },
          { note: "The preview under Price says what will actually bill — for $200 a visit at 10% off: “Each visit bills $180.00.” and, for a fixed term, “6 visits, $1,080.00 in total — $120.00 off.” The discount is applied to each visit at the same rate, so every invoice adds up on its own and the term total is the sum of the invoices." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "What each field changes",
        blocks: [
          { table: {
            head: ["Field", "What it does"],
            rows: [
              ["How often", "Weekly steps 7 days; the others step by month from the first-visit date, so a plan anchored on the 31st bills on the 31st (or the last day of a shorter month) and never drifts earlier."],
              ["How long — A number of visits", "1 to 520 visits, then the plan finishes on its own."],
              ["How long — Until a date", "Nothing bills after the Last day. An end date before the first visit is refused."],
              ["How long — Until cancelled", "No end date. The client is told exactly that before agreeing to anything."],
              ["Package discount %", "Taken off each visit, 0–99%. Shown on the invoice."],
              ["Tax %", "Applied to each visit. Blank is a decision — no tax — not a gap."],
              ["Invoice each visit", "Each occurrence raises an invoice and emails the pay link. Nothing stored, nothing charged unless the client pays."],
              ["Charge automatically", "The same invoice, plus an off-session charge against the payment method the client authorised. Until they authorise, the plan invoices as above."],
            ],
          } },
        ],
      },
      {
        id: "what-happens-each-visit",
        heading: "What happens on each visit date",
        blocks: [
          { p: "Once a day FieldQuo looks at every active plan. An occurrence whose date has arrived raises one invoice — a single line, “Plan name — Service”, with the discount and tax the plan states, due on the visit date, in the language the plan was sold in — and emails the client the pay link. At most **one occurrence per plan per day** is generated, so a mistyped start date costs one invoice, not a hundred, and a missed week catches up over a week." },
          { p: "On the plan's page, **Billed so far** lists each occurrence as **Preparing**, **Invoiced**, **Payment in progress**, **Paid** or **Payment failed**, with **View invoice**. A plan sold for six visits flips to **Finished** after the sixth; an open plan runs until you press **Cancel plan**." },
          { warning: "**Cancel plan** stops the money. No further visit is billed, the client's authorisation is withdrawn and their saved payment method is detached at Stripe. Invoices already raised stay exactly as they are — cancel the plan, then deal with an unpaid invoice on its own page." },
        ],
      },
      {
        id: "automatic-collection",
        heading: "Automatic collection, in brief",
        blocks: [
          { p: "Choosing **Charge automatically** does not charge anything yet. After saving, press **Ask the client to authorise payments**: the client receives a link, reads the exact amount, cadence and cancellation terms, ticks a box, and saves a card or bank account on a Stripe page. From then on the plan page reads **Charging Visa ···· 4242 automatically. The client authorised this on 12 Sep 2026.** A declined card or a removed method falls back to the invoice with a pay link, and the page says which. The full flow, the wording and the Canadian bank-debit mandate: [[service-plan-bank-debit-mandates|Service plans paid by bank debit]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see and sell plans",
        blocks: [
          { p: "Seeing the Service Plans screen needs the Invoices level **View only** — Estimators upward. Creating a plan and asking a client to authorise payments need **View, create, and edit** on Invoices plus the **Payments** switch (“Allow payment collection on quotes and invoices” — the access grid is in English on every screen): a Manager, an administrator or the owner. Cancelling a plan needs only **View, create, and edit**, so a Dispatcher can cancel one but not sell one." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Why this is listed under Only in FieldQuo",
        blocks: [
          { p: "FieldQuo's comparison pages decide “only in FieldQuo” one way: the capability is not listed on the other product's pricing page at any tier — never by assertion. Of the five products FieldQuo compares itself with, recurring service plans are listed by one (Housecall Pro, on its top tier) and absent from the other four pricing pages. Canadian pre-authorized bank debit at 1% capped at $5, as the collection method for a plan, is listed by none of them." },
        ],
      },
    ],
    faq: [
      { q: "Can I change the price of a running plan?", a: "No. The amount, discount, cadence and length are frozen at creation because the client authorised those figures. Cancel it and sell a new plan." },
      { q: "Does the plan create a visit on the calendar?", a: "No. A plan raises invoices on its dates; scheduling the crew is done on the job and its visits as usual." },
      { q: "What if the client's card is declined?", a: "The occurrence is marked Payment failed, the client gets the invoice with a pay link, and the plan page tells you. Nothing collects silently." },
      { q: "Can a client on a plan pay by bank debit?", a: "Yes, if your company bills in CAD — the client saves a Canadian bank account when they authorise, and each debit costs 1% + 40¢, capped at $5." },
    ],
  },

  "service-plan-bank-debit-mandates": {
    title: "Service plans paid by bank debit: the mandate",
    summary:
      "What the client agrees to before a plan can charge them, how a Canadian pre-authorized debit is set up and settled, and what stops it.",
    updated: "2026-09-12",
    intro: [
      "A plan set to **Charge automatically** can only take money against a mandate: the client's written agreement to a series of payments of a named amount on a named cadence, plus a card or bank account saved on Stripe. FieldQuo shows the terms on its own page, records the exact wording the client accepted, and only then sends them to Stripe to save the instrument. For a Canadian company billing in CAD, that instrument can be a bank account — pre-authorized debit — which is cheaper than a card and cannot expire.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Asking for automatic collection is a request; holding a live mandate is a capability. The plan page keeps them apart: **Automatic payment asked for, but the client hasn't agreed yet**, **The client agreed but hasn't saved a payment method yet**, **The saved payment method was removed — invoices are being sent instead**, or **Charging … automatically. The client authorised this on …**. Until the last one is true, every visit is invoiced with a pay link." },
          { note: "Bank debit is offered only when your company's currency is CAD, because Stripe requires the debit currency to match the client's Canadian bank account. In USD the client can save a card only. See [[bank-debit-in-canada|Bank debit in Canada]]." },
        ],
      },
      {
        id: "how-the-client-authorises",
        heading: "How the client authorises",
        blocks: [
          { steps: [
            "On the plan's page, press **Ask the client to authorise payments**. The screen confirms: “Sent to jane@example.com. They'll see the amount and the schedule before agreeing to anything.”",
            "The client opens the link — a page in the plan's language, headed “Authorise automatic payments — Spring & Fall gutter clean” — reads the terms, ticks **I have read the above and I authorise these payments**, and presses **Agree and continue**. Nothing is charged that day.",
            "Stripe's secure page collects the card or the bank account. For pre-authorized debit, Stripe shows its own PAD agreement and emails the client a copy.",
            "A bank account may need verifying: the client sees “Your bank details were received but still need to be verified… in a day or two.” Once the bank confirms, the plan page switches to **Charging … automatically**.",
          ] },
          { p: "If the client ticked the box and then abandoned the card form, the plan says **The client agreed but hasn't saved a payment method yet** and keeps invoicing. **Send the authorisation link again** re-sends the same request." },
        ],
      },
      {
        id: "what-the-terms-say",
        heading: "What the terms say",
        blocks: [
          { p: "Stripe requires a merchant charging off-session to state, and keep a record of, four things: that a series of payments will be initiated, their timing and frequency, how the amount is determined, and the cancellation policy. FieldQuo's page states them in plain sentences, built from the plan itself, and the exact text is snapshotted with the client's acceptance — improving the wording later cannot rewrite what an existing client agreed to." },
          { bullets: [
            "You authorise the company to take a series of payments from the payment method you save on the next screen, without being asked again each time.",
            "The first payment is taken on the first-visit date, and then every three months (or the plan's cadence).",
            "Each payment is the plan's amount, tax included where a tax rate is stated. That amount is fixed and cannot be changed while the arrangement runs.",
            "How it ends: a number of payments in total, no payments after a date, or no end date — payments continue until either side ends it.",
            "The client can end it at any time by contacting the company, at the phone and email on file. No payment is taken after cancellation.",
            "Every payment raises an invoice the client can see in their client account.",
          ] },
          { warning: "Automatic collection can be sold only in **English or French** — the two languages FieldQuo holds reviewed authorisation wording for. A client whose language is anything else is not asked to authorise at all; their plan invoices each visit, which works in every language." },
        ],
      },
      {
        id: "the-debit-itself",
        heading: "The debit itself",
        blocks: [
          { p: "On each visit date the plan raises the invoice and charges the saved method under the mandate, without the client present. A card settles at once: the occurrence is **Paid** and the client receives the invoice framed as a receipt, from your company, not a Stripe receipt from a name they do not know. A bank debit takes about **five business days** to clear, so the occurrence sits at **Payment in progress** — the invoice is not marked paid against money that has not moved — and Stripe sends the client the debit notice the mandate requires. When it clears, Paid and the receipt; if it comes back, **Payment failed** and the invoice with a pay link." },
          { table: {
            head: ["Method", "Fee on each occurrence", "Clears"],
            rows: [
              ["Card", "3% + $0.30", "Immediately"],
              ["Pre-authorized debit (Canada, CAD)", "1% + $0.40, capped at $5.00", "About 5 business days"],
            ],
          } },
          { tip: "On a $500 quarterly plan the card costs $15.30 a visit and bank debit $5.00 — the cap. Over a year that is $41.20 saved on one client." },
        ],
      },
      {
        id: "what-stops-it",
        heading: "What stops it",
        blocks: [
          { bullets: [
            "**Remove the saved payment method** on the plan page: the authorisation is withdrawn in FieldQuo first, then the method is detached at Stripe. The plan keeps running and invoices each visit instead.",
            "**Cancel plan**: nothing further is billed, and the method is detached the same way. If Stripe does not confirm the detachment, the screen says so and asks you to check the client's record in Stripe.",
            "The client asking you to stop: the terms tell them to contact you, and you cancel. Nothing at Stripe can bill on its own — no subscription is created there — so a cancelled plan cannot leave a live biller behind.",
            "A declined charge or a bank asking for authentication the absent client cannot give: that occurrence is invoiced with a pay link and the mandate stays for the next one.",
          ] },
        ],
      },
      {
        id: "who-can-do-this",
        heading: "Who can do this",
        blocks: [
          { p: "Sending the authorisation request and removing a saved method both need **View, create, and edit** on Invoices plus the **Payments** switch — a Manager, an administrator or the owner. Someone who could not set a mandate up cannot tear one down either." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Why this is listed under Only in FieldQuo",
        blocks: [
          { p: "On FieldQuo's own comparison pages a capability counts as “only in FieldQuo” when it is not listed on the other product's pricing page at any tier. Collecting a recurring plan by Canadian pre-authorized debit, with the mandate wording recorded against the client's acceptance, is not listed by any of the five products FieldQuo compares itself with; recurring plans themselves appear on one of those pricing pages (Housecall Pro's top tier)." },
        ],
      },
    ],
    faq: [
      { q: "Does the client need a FieldQuo account?", a: "No. The authorisation page opens from the emailed link, and Stripe's page saves the instrument. The client's invoices are in their client portal, also by link." },
      { q: "Can I type the client's card in for them?", a: "No. The client saves it themselves on Stripe's page, after accepting the terms. FieldQuo never sees card or bank numbers." },
      { q: "The debit came back — do I lose the visit?", a: "No. The invoice is real and unpaid; the client gets it with a pay link, and the occurrence shows Payment failed on the plan page." },
    ],
  },

  "the-client-portal": {
    title: "The client portal",
    summary:
      "One link, no login: where a client sees their invoices, what they still owe, their quotes, and the Pay button — in your name, not ours.",
    updated: "2026-09-12",
    intro: [
      "Every client has one portal link, minted the first time you email them an invoice. It opens without a password and shows their balance owing, each issued invoice with a **Pay** button, and each quote you have sent. The page carries your logo and your brand colour and never mentions FieldQuo — the client hired you, not us.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The link is the only thing between a stranger and a client's billing history, so it is 32 bytes of random data, not a number anyone can count up. It stays the same across every email, so an older email still opens. The invoice email's Pay button deep-links to the invoice's own page inside the portal, which is where the payment actually starts — a Stripe checkout session is minted only when the client presses Pay, so a link in an inbox never goes stale." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "What the client sees",
        blocks: [
          { bullets: [
            "Your logo and company name, then **Account for Jane Smith**.",
            "**Balance owing**, first thing on the page, with **Across 2 invoices.** — or **Nothing outstanding. Thank you.**",
            "**Invoices**: number, total, **$1,200 paid**, **due 30 Sep 2026**, and a **Pay $2,260** button next to what is owed — or **Paid**.",
            "**Quotes**: each one with a pill in the client's own words — **Awaiting your reply**, **Approved**, **Declined** — and a **Review** link to the approval page.",
            "**Questions about any of this? Contact Acme Painting at 613-555-0100 · hello@acme.ca** at the foot.",
          ] },
          { p: "An invoice's own page shows the line items, **Due** or **Was due**, any requested stage amounts, and the same Pay button; once settled it reads **Paid in full**. When you are not connected to Stripe, the Pay button is replaced by your offline payment instructions." },
        ],
      },
      {
        id: "how-the-link-reaches-them",
        heading: "How the link reaches the client",
        blocks: [
          { steps: [
            "Send an invoice, or press **Chase payment** on one — the email's Pay button opens the invoice in the portal. See [[send-an-invoice|Send an invoice]].",
            "Automatic overdue reminders from your follow-up rules carry the same link.",
            "A service plan's invoices and receipts link to the portal too, and the plan's authorisation terms tell the client “every payment raises an invoice, which you can see in your client account”.",
          ] },
          { note: "There is no “copy portal link” button in the app today. The link travels in the emails FieldQuo sends; if a client has lost it, chase or resend an invoice." },
        ],
      },
      {
        id: "what-is-not-there",
        heading: "What is deliberately not there",
        blocks: [
          { bullets: [
            "Draft invoices. Only issued invoices are listed — sent, or marked paid in person — so a client is never shown money owed on a bill nobody sent.",
            "Draft quotes and unreviewed instant estimates. A figure nobody at your company has priced does not appear as yours.",
            "Jobs, visits, technicians, notes. The portal shows quotes and invoices, nothing else — the AI review notes on a quote never reach a client-facing surface.",
            "Your Stripe details. Whether Pay works is decided on the server; the client sees a button or your offline instructions, never the account.",
          ] },
        ],
      },
      {
        id: "language-and-branding",
        heading: "Language and branding",
        blocks: [
          { p: "The portal is written in the client's language, falling back to your company's default — the same rule as every email. Each document keeps the language it was created in, so a French quote listed on an English portal still opens in French. Colours come from your one brand colour, with the text on the Pay button measured for contrast rather than assumed." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone holding the link. Nobody in your team opens the portal from the app; staff read the same invoice on **Invoices**. If a link has reached the wrong person, contact support — rotating a client's link is not a button in the app today." },
        ],
      },
    ],
    faq: [
      { q: "Does the client need to create an account?", a: "No. The link is the account. There is no password, no sign-up and no app to install." },
      { q: "Can the client pay part of an invoice?", a: "Only what a payment schedule has requested as a stage. Otherwise the Pay button takes the full balance owing." },
      { q: "Will the client see FieldQuo anywhere?", a: "No. The page carries your name, logo and colour; the card statement shows your company name." },
    ],
  },

  "the-accounting-export": {
    title: "The accounting export (CSV for QuickBooks, Xero or your bookkeeper)",
    summary:
      "One ZIP, four CSV files, one date range: what each file holds, the rules behind the numbers, and what the export refuses to contain.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo does not sync to QuickBooks or Xero. What it does instead is let the numbers leave cleanly: pick a date range on **Expenses**, press **Download the range**, and you get a ZIP with a summary sheet and three data files — invoices, payments, expenses — that any bookkeeper can open and any accounting package can import.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The **Bookkeeping export** card sits at the bottom of **Expenses** (the same screen as Settings → Expense Tracking). It has **From** and **To** dates and one button. Amounts are in your company's billing currency, set on Company Settings; without one the export refuses rather than guess." },
          { figure: "live:app-settings-expense-tracking", caption: "Expense Tracking — the Bookkeeping export card at the bottom: a date range, Download the range, and the list of what the file does not contain." },
        ],
      },
      {
        id: "download-a-range",
        heading: "How to download a range",
        blocks: [
          { steps: [
            "Open **Expenses** and scroll to **Bookkeeping export**.",
            "Set **From** and **To** — a month, a quarter, the year.",
            "Press **Download the range**. The ZIP is named bookkeeping-2026-01-01-to-2026-03-31.zip and holds summary, invoices, payments and expenses as CSV.",
          ] },
          { tip: "Send the whole ZIP, not one file out of it. The summary sheet repeats the list of what the data cannot tell — a sales-tax return, for one — so the caveat travels with the numbers." },
        ],
      },
      {
        id: "the-four-files",
        heading: "The four files",
        blocks: [
          { table: {
            head: ["File", "One row per", "Columns"],
            rows: [
              ["summary", "the range", "Company, range, generated date, billing currency; then per currency: Invoiced, of which tax, Payments received, Processing fees, Stripe account fees, Expenses; then the limitations and any notes on the range."],
              ["invoices", "invoice", "Invoice number, Issued, Date taken from, Due, Client, Status, Version, Currency, Subtotal, Discount, Tax, Tax applied, Total, Paid to date, Received in range, Balance."],
              ["payments", "payment", "Date, Invoice number, Client, Method, Currency, Amount, Processing fee, Net deposited, Fee rate, Stripe account fees, Reference, Notes."],
              ["expenses", "expense", "Date, Category, Currency, Amount, Overhead, Recurring, Frequency, Job, Notes."],
            ],
          } },
        ],
      },
      {
        id: "the-rules-behind-the-numbers",
        heading: "The rules behind the numbers",
        blocks: [
          { bullets: [
            "An invoice edited after sending is a new version under the same number. The export emits **one row per invoice**, at the latest version's money, dated from the original — so an amendment in March never doubles a January invoice.",
            "There is no invoice issue-date field, so each row says which column its date came from: **sentAt (emailed)**, **createdAt (raised)**, or a past job's own dates.",
            "Payments are filtered on the **payment's own date**, not the invoice's: a December invoice paid in January is January's cash. **Amount** is gross; **Processing fee** and **Net deposited** are what Stripe took and what reached the bank, blank — not 0.00 — for manual payments and older online ones.",
            "Days are grouped by UTC calendar day. A range with two currencies is reported per currency and never summed into one total.",
            "Client names, categories and notes are guarded against spreadsheet formulas — a client named =cmd… opens as text.",
          ] },
        ],
      },
      {
        id: "what-it-does-not-contain",
        heading: "What it does not contain",
        blocks: [
          { bullets: [
            "A filing. Nothing here has been remitted to any tax authority.",
            "A sales-tax return. Invoice tax is one amount per invoice, with no tax codes and no per-line tax.",
            "Input tax credits. Expenses carry no tax and no supplier, so recoverable tax on what you bought is not tracked.",
            "Refunds and credit notes. A refund shows on the invoice and in your Stripe dashboard; it is not a row in this file.",
            "A chart of accounts. Nothing is mapped to a GL account — your bookkeeper does that once, on import.",
          ] },
        ],
      },
      {
        id: "importing-it",
        heading: "Importing into QuickBooks or Xero",
        blocks: [
          { p: "Map the payments file's **Amount** to income, **Processing fee** to a merchant-fees expense and **Net deposited** to the bank deposit; the bank feed then matches line for line. Invoices go in at **Total** with **Tax** as the tax amount. The walk-through per package is in [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero and your bookkeeper]]; the fee columns are explained in [[payment-processing-fees-and-payouts|Payment processing fees and payouts]]." },
        ],
      },
      {
        id: "who-can-download-it",
        heading: "Who can download it",
        blocks: [
          { p: "The export names every client and what they paid, so it is gated like the price book: **Show Pricing** plus the Invoices level **View only** or higher. An Estimator can download it; a Crew member cannot. A read-only support session is refused — FieldQuo's console may view your data but never generates your year-end as a file." },
        ],
      },
    ],
    faq: [
      { q: "Is this a QuickBooks integration?", a: "No. It is a CSV export any package imports. A live sync would need Intuit's approval process and a tax-model mapping that does not exist yet, and the product says so rather than pretend." },
      { q: "Why is the fee cell empty on some payments?", a: "That payment was recorded by hand, or online before fees were recorded on the payment. An empty cell means “no fee is known”; a zero would claim “no fee”." },
      { q: "Why is a January payment missing from my December export?", a: "Payments are dated by when they were received. Export January for January's cash; the invoice itself is in December's file with its balance." },
    ],
  },

  "booking-fees-and-visit-deposits": {
    title: "Booking fees and visit deposits",
    summary:
      "Charge a visit fee when a client books online, hold the slot for 30 minutes, decide whether the fee comes back on a cancellation, and credit it against the invoice when the job goes ahead.",
    updated: "2026-09-12",
    intro: [
      "A visit fee is a price on a bookable event type — a $79 measurement visit, a paid design consultation. The client pays it by card on your booking page before the slot is theirs; if the job goes ahead, you credit the fee against the invoice with one button. It is not a quote deposit: those are requested from the quote's payment schedule and are covered in [[deposits-and-payment-schedules|Deposits and payment schedules]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The fee is charged only when your company can actually collect it — Stripe connected and charges enabled. Without that, a paid event type quietly books as free rather than showing a price nobody can be charged. The booking page shows the price, the server decides it, and the browser never computes a fee." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "On **Settings → Booking Page**, each event type card carries a **Visit fee** (or **Free**), a **Promo price** and a **Promo on** switch. Above the cards, **Changes & cancellations** holds **Notice you need to change or cancel**, the switch **Return the visit fee when they cancel in time**, and **Notice needed to get the fee back**, with a preview sentence that states the policy exactly as the client will read it. A card whose fee cannot be collected says **Connect Stripe to collect this fee — set it up in Payments**." },
          { figure: "live:app-settings-booking-page", caption: "Settings → Booking Page — the visit settings, Changes & cancellations, then one card per event type with its fee and promo price." },
        ],
      },
      {
        id: "set-a-fee",
        heading: "How to charge for a visit",
        blocks: [
          { steps: [
            "Connect Stripe on **Settings → Payments** and wait for charges to be enabled — see [[connect-stripe-and-get-verified|Connecting Stripe and getting verified]].",
            "Open **Settings → Booking Page** and, on the event type, enter a **Visit fee**. Leave it blank for a free visit.",
            "To run an offer, enter a **Promo price** and switch **Promo on**. The booking page shows the standard price struck through — $79 → $20 — and charges the promo.",
            "Under **Changes & cancellations**, set the notice and decide whether the fee is returned when a client cancels in time. It saves as you change it.",
          ] },
        ],
      },
      {
        id: "what-happens-when-a-client-books",
        heading: "What happens when a client books",
        blocks: [
          { bullets: [
            "The client picks a slot and is sent to a Stripe card page for the fee. The slot is **held for 30 minutes**; a hold nobody pays for lapses and the slot is free again.",
            "On payment the booking is confirmed, an appointment appears on your calendar, and the confirmation is sent. An hourly check re-reads Stripe for any booking still held, so a paid visit the webhook missed still becomes an appointment.",
            "The dashboard shows a booking still waiting for its fee as **Waiting on $79**, with a button to check the payment.",
            "The fee is a Stripe payment in your name: the card fee (3% + $0.30) comes off it and the net is paid out with everything else.",
          ] },
        ],
      },
      {
        id: "credit-against-the-invoice",
        heading: "Crediting the fee against the invoice",
        blocks: [
          { p: "When the job goes ahead, open the invoice. A **Visit fee credit** card reads “This client already paid a visit fee. Credit it toward this invoice.” Press **Credit to invoice** and the fee is recorded as a payment line, **Visit fee credit**, reducing the balance like any other payment; **Remove credit** takes it back. The fee is matched by the client's email address within your company, and one fee can be credited once, to one invoice." },
          { note: "Crediting is your call, not automatic — sometimes the consultation stands on its own. It needs the **Payments** switch." },
        ],
      },
      {
        id: "cancellations-and-refunds",
        heading: "Cancellations and refunds",
        blocks: [
          { table: {
            head: ["Setting", "What it does"],
            rows: [
              ["Notice you need to change or cancel", "Inside this window the client can no longer move or cancel the visit themselves; the page tells them to call you. Unset, it is 24 hours."],
              ["Return the visit fee when they cancel in time — off", "The cancellation still goes through and the fee stays with you. This is the default."],
              ["Return the visit fee when they cancel in time — on", "A cancellation with enough notice refunds the fee through Stripe, and the client is told so before they confirm."],
              ["Notice needed to get the fee back", "May be longer than the change notice: “move it up to a day before, but the fee only comes back with two days' notice”. Blank uses the change notice."],
            ],
          } },
          { warning: "A refund returns the client's money; Stripe keeps its processing fee on the original charge. See [[refunds|Refunds]]." },
        ],
      },
      {
        id: "who-can-change",
        heading: "Who can change it",
        blocks: [
          { p: "The Booking Page settings are for the owner, administrators, Managers and Dispatchers. Crediting a fee against an invoice needs **Payments** — by default a Manager, an administrator or the owner." },
        ],
      },
    ],
    faq: [
      { q: "Why does my paid visit show as free on the booking page?", a: "Stripe is not connected, or charges are not enabled yet. The fee returns as soon as Stripe reports charges enabled." },
      { q: "Can the fee be paid by bank debit?", a: "No. Booking fees are card only. Bank debit is available for service plans in CAD." },
      { q: "The client paid but I see no appointment.", a: "Wait for the hourly check, or press the check-payment button on the dashboard's waiting card. A payment Stripe confirms always becomes an appointment." },
    ],
  },

  "money-owed-and-receivables-aging": {
    title: "Money owed and receivables aging",
    summary:
      "Who owes you, for how long, and the Chase payment button — how the dashboard counts it and why it agrees with the invoice page and the balance sheet.",
    updated: "2026-09-12",
    intro: [
      "The dashboard answers two questions the invoice list does not: who owes you, and for how long. Overdue invoices are named at the top of the page with a **Chase payment** button; the **Money owed** tile totals what is outstanding; and the **Money owed** card lays the same figure out by age — not yet due, 1–30, 31–60, 61–90, 90+ days — with each invoice and its contact.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Money owed is counted one way everywhere: the latest version of each invoice, drafts and cancelled documents excluded, less every payment recorded against it. That is the balance sheet's rule too, and the invoice page's — flip an invoice's status to Paid without recording the payment and all three keep saying it is owed. Absence is never a zero: a company with no invoices reads **No invoices yet, so nothing is owed to you.**, and one that is fully paid reads **Nothing outstanding — every invoice you have sent has been settled.**" },
          { figure: "live:app", caption: "Home — Waiting on you at the top with the overdue invoice and Chase payment, the four tiles, then The detail with the Money owed card." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Waiting on you**: the most overdue invoice with its client, **12 days past due**, and **Chase payment**; **3 more overdue** when there are more.",
            "The **Money owed** tile, with **$4,120 of that is past due.** under the total.",
            "In **The detail**, the **Money owed** card: the caption **Across 5 unpaid invoices. Counts the latest version of each invoice, less the payments recorded against it.**, then the aging ladder — **Not yet due**, **1–30 days**, **31–60 days**, **61–90 days**, **90+ days**, and **No due date** on its own.",
            "Up to six invoices, oldest first: number, client, **Due 30 Aug 2026** or **27 days past due**, **amended, v2** where it was edited after sending, a **Job** link, **Last chased 5 Sep 2026 · 2×** or **Automatic reminder sent 3 Sep 2026**, and **Chase payment**. Then **4 more not shown here**.",
            "A line about reminders: **An automatic reminder goes out 3 days after an invoice's due date.** with **Change it**, or **No automatic overdue reminder is set up…** with **Set one up**.",
          ] },
        ],
      },
      {
        id: "how-it-is-counted",
        heading: "How it is counted",
        blocks: [
          { table: {
            head: ["Case", "How it is treated"],
            rows: [
              ["Invoice edited after sending", "One entry, at the latest version's total, dated from the original. Marked amended, v2."],
              ["No due date", "Listed under No due date. It is owed, but it is not overdue and never lands in a day bucket."],
              ["Days past due", "Whole calendar days after the due date, the same count the invoice page's banner shows."],
              ["Overpaid invoice", "Not in the total. Named separately: “1 invoice has been overpaid by $180 in total. That is money you hold, not money owed to you.”"],
              ["Invoice with no date at all", "Counted and named — “1 invoice carries no date at all and is not counted above.” — never silently dropped."],
              ["Draft or cancelled", "Not receivable. Not shown."],
            ],
          } },
        ],
      },
      {
        id: "chase-payment",
        heading: "Chase payment",
        blocks: [
          { steps: [
            "Press **Chase payment** on the invoice — at the top of the dashboard or in the Money owed card.",
            "The client is emailed a reminder framed as a reminder, not a fresh invoice, with a Pay button that opens the invoice in their portal. The card confirms: **Payment request emailed to jane@example.com at 9:42 AM**.",
            "The invoice records it: **Last chased 12 Sep 2026 · 1×**, and the count goes up on every chase. The invoice's original sent date is never overwritten.",
          ] },
          { note: "Chasing needs a client email on file; the button says so when there is none. An invoice entered as a past job is never chased — nothing is sent to a client for past jobs." },
        ],
      },
      {
        id: "automatic-reminders",
        heading: "Automatic reminders",
        blocks: [
          { p: "A follow-up rule with the trigger **Invoice overdue** chases on its own, a set delay after the due date, and the dashboard says so in one sentence — or says plainly that nothing chases these on its own. Each automatic send is shown on the invoice's row as **Automatic reminder sent** with the date. Set the rule up on **Settings → Follow-ups**: [[invoice-reminders-and-chasing|Invoice reminders and chasing]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The Money owed tile and card need **Show Pricing** and the Invoices level **View only**; without them the panel is absent — no card, no zero. Pressing **Chase payment** needs **View, create, and edit** on Invoices: a Dispatcher, a Manager, an administrator or the owner. An Estimator sees the figures and cannot chase." },
        ],
      },
    ],
    faq: [
      { q: "Why does the tile not match Outstanding on the Invoices list?", a: "The tile is money owed as of this morning, latest version per invoice less payments; the list's tile totals balances by status. A payment recorded without changing the status shows up here first." },
      { q: "An invoice is marked Paid but still shows as owed.", a: "No payment has been recorded against it. Record the payment on the invoice — see [[record-a-manual-payment|Record a cash, cheque or e-transfer payment]] — and it leaves all three surfaces at once." },
      { q: "How many invoices does the card show?", a: "Six, oldest first, then a count of the rest. The Invoices list has them all." },
    ],
  },
};
