// content/help/en/invoices-and-payments-2.js
//
// Part 2 of the “invoices-and-payments” category in English (see the
// composer, invoices-and-payments.js).
//
// Articles of the “invoices-and-payments” category in English. Keyed by
// slug; the slugs are listed in lib/help/tree.js and
// scripts/check-help-centre.mjs refuses a module that is missing one or
// carries one the tree does not.
//
// Every number in the fees article is read from lib/stripe/processingFee.js,
// lib/stripe/disputeRecovery.js, lib/stripe/connectFees.js and
// lib/export/accountingExport.js — the same constants the charges use — and
// scripts/check-help-centre.mjs executes those constants against the
// sentences below, so the article cannot quietly drift from what is
// deducted.
export const ARTICLES = {
  "payment-processing-fees-and-payouts": {
    title: "Payment processing fees and payouts",
    summary:
      "What a card or bank-debit payment costs you, how the fee shows on each payment, when the money reaches your bank, and how it all appears in your accounting export.",
    updated: "2026-09-12",
    intro: [
      "When a client pays an invoice online, the payment goes through the company's own Stripe account and lands in the company's bank. A processing fee is taken off each payment before it gets there — never billed separately, and with no monthly fee for taking payments. This article is the whole story of that fee: the rates, where you see them, what happens on a refund or a dispute, and how your bookkeeper reconciles it.",
      "The short version: **3% + 30¢** on a card, **1% + 40¢ capped at $5** on a Canadian bank debit, an optional **1%** to be paid out instantly, and **$15** if a client disputes a charge. Everything else on this page explains those four numbers.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every online payment a client makes is a Stripe charge created in your company's name and paid out to your bank account. FieldQuo never holds the money. The processing fee is deducted from the payment itself — the client pays the invoice total, the fee comes off, and the **net** is what Stripe deposits." },
          { p: "You will see three amounts for every online payment: the **amount** (what the client paid and what the invoice was reduced by), the **processing fee**, and the **net deposited**. They appear on the invoice, on the payment record, and as three columns in the accounting export." },
          { note: "There is no tipping and no capital or lending product in FieldQuo. If you are used to Jobber's help pages, those two sections have no counterpart here — a client pays exactly the invoice, and the only money that moves is the invoice's." },
        ],
      },
      {
        id: "settings",
        heading: "Settings",
        blocks: [
          { p: "The rates are printed on **Settings → Payments** before you connect Stripe, so nothing about the fee is a surprise after the first payout. The card shows every method Stripe prices in your currency, a worked example on a $2,260 card payment ($68.10 fee, $2,191.90 deposited), and the two surcharges that apply only to some cards." },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — the processing-fee card, the connected Stripe account and its status." },
          { steps: [
            "Open **Settings → Payments**.",
            "Read the **Processing fees** card. Card payments show 3% + $0.30; Canadian companies also see Bank debit (Canada) at 1% + $0.40, max $5.00.",
            "Connect Stripe (see [[connect-stripe-and-get-verified|Connecting Stripe and getting verified]]). Once Stripe reports charges enabled, a Pay button appears on every invoice your clients receive.",
          ] },
          { p: "There is nothing to configure about the fee itself. It is the same for every company, it cannot be turned off, and it cannot be passed on to the client as a separate surcharge line — the invoice total is what the client pays." },
        ],
      },
      {
        id: "payouts",
        heading: "How to tell a payment has reached your bank",
        blocks: [
          { p: "Stripe pays your balance out to your bank on its standard schedule — free, and in about **2 business days** for a Canadian or US account. FieldQuo shows the payment as **Paid** the moment Stripe confirms the charge; the payout to your bank follows on Stripe's clock." },
          { steps: [
            "On the invoice, the payment row shows the date, the method, the amount, and under it the fee and the net deposited.",
            "To see the payout itself — the transfer to your bank — open **Settings → Payments → Manage in Stripe**. Stripe's Express dashboard lists every payout with its arrival date and the payments it contains.",
            "Your bank statement line will match the **net deposited** figure, never the gross amount.",
          ] },
          { tip: "If a payment is Paid in FieldQuo but nothing has arrived after a few business days, the account is usually being held or reviewed by Stripe — see [[payouts-held-or-under-review|Payouts held or under review]]. The Payments settings page says so in plain words when that is the case." },
        ],
      },
      {
        id: "payments",
        heading: "Payments",
        blocks: [
          { p: "A client pays from the invoice email's Pay button or from the client portal. The methods on offer depend on your currency: cards everywhere, and pre-authorized bank debit for Canadian companies billing in Canadian dollars." },
          { p: "On each payment, FieldQuo records the fee at the published rate, and the invoice's payment row reads, for example, **“card processing $68.10 · deposited $2,191.90”**. A payment you record by hand — cash, cheque, e-transfer — carries no fee and shows none." },
          { figure: "live:app-invoices", caption: "Invoices — Outstanding, Paid and Total Billed, then every invoice with its status and balance." },
          { p: "Pay-over-time financing (Affirm), if you turn it on, is priced by Affirm rather than at the card rate; that fee is passed through on those payments the same way." },
        ],
      },
      {
        id: "instant-payouts",
        heading: "Instant payouts",
        blocks: [
          { p: "Instead of waiting for the standard schedule, you can move your available Stripe balance to a **debit card** in about 30 minutes, any day, any time. It costs **1%** of the amount (minimum 50¢) — Stripe's own charge, passed through at cost. FieldQuo keeps none of it." },
          { steps: [
            "Open **Settings → Payments** and find the **Instant payout** card.",
            "It shows what is available now, the fee, and what you will receive. Press **Pay out … now** and confirm.",
            "The money reaches the debit card Stripe has on file, usually within 30 minutes; your bank can delay it.",
          ] },
          { note: "Instant payouts need a Stripe account at least **30 days old** with payouts enabled and a debit card on file. A bank account only takes standard payouts — add a debit card in your Stripe dashboard to use instant ones. Full detail: [[instant-payouts|Instant payouts]]." },
        ],
      },
      {
        id: "fees",
        heading: "Fees",
        blocks: [
          { table: {
            head: ["Payment method", "Fee", "Currency"],
            rows: [
              ["Card (Visa, Mastercard, Amex, business cards alike)", "3% + $0.30", "CAD and USD"],
              ["Bank debit — pre-authorized debit (Canada)", "1% + $0.40, capped at $5.00 per payment", "CAD"],
              ["Instant payout (optional)", "1% of the payout, minimum $0.50", "CAD and USD"],
              ["Dispute (chargeback)", "$15 per dispute, not returned if you win", "CAD and USD"],
            ],
          } },
          { p: "The card rate is one number whatever the card: a business or Amex card costs the same 3% + 30¢ as a consumer Visa. It is 2.9% + 30¢ to Stripe plus a 0.1% FieldQuo margin, and you see the single combined rate everywhere — on the settings page, the payment record and the export." },
          { p: "Two surcharges apply only when they apply, because the card is unknown until it is charged: **+0.8%** on a card issued outside Canada, and **+2%** when the payment needs a currency conversion. They are passed through at Stripe's cost on that payment only. Bank debit carries no surcharge." },
          { p: "A **$5,000 invoice paid by bank debit costs $5** — the cap — where the same invoice by card costs $150.30. For large invoices from Canadian clients, offering bank debit is the single biggest saving on this page." },
          { p: "Stripe also bills a small account fee: a **monthly active-account fee** in months you take payments and **0.25% + 25¢ per payout** to your bank. These are passed through at cost and appear as their own line on your next payment — “Stripe account fees $2.25 (2026-09)” — never folded into the processing fee." },
        ],
      },
      {
        id: "refunds",
        heading: "Refunds",
        blocks: [
          { p: "A refund returns the client's money through Stripe. The processing fee is **not returned**: Stripe keeps its fee on a refunded charge, and so the fee already deducted stays deducted. The payment record keeps showing the original fee, and the refund appears in your Stripe dashboard against the same charge." },
          { warning: "Refund the invoice amount, not the net. A client who paid $2,260 expects $2,260 back; the $68.10 fee is your cost of having taken the payment." },
        ],
      },
      {
        id: "disputes",
        heading: "Disputes",
        blocks: [
          { p: "When a cardholder disputes a charge, Stripe takes the disputed amount and a **$15 dispute fee** while the dispute is open. FieldQuo moves both out of your balance — the amount as a hold, the fee as a fee — and the invoice shows a line such as **“Dispute — $2,260.00 held, $15.00 fee”**. You respond to the dispute in your Stripe dashboard with your evidence: the signed quote, photos, the completion checklist." },
          { bullets: [
            "**If you win**, the held amount comes back to you. Stripe does not refund the $15 dispute fee, and the invoice says so: “Dispute won — $2,260.00 returned. Stripe does not refund the $15.00 dispute fee.”",
            "**If you lose**, the held amount is gone and the fee stays: “Dispute lost — $2,260.00 taken back, $15.00 fee.”",
          ] },
          { note: "A dispute can only take back what the payment transferred to you. If the disputed amount plus the fee exceed the net you received, the difference is recorded rather than silently absorbed — you will see it, and so will support." },
        ],
      },
      {
        id: "negative-balances",
        heading: "Negative balances",
        blocks: [
          { p: "Your Stripe balance can go negative after a dispute or a refund larger than what is available. Stripe recovers a negative balance from your **next payments** before paying anything out, and, for the Connect account fees above, FieldQuo adds what is outstanding to your next charge as its own line — capped so the fee never exceeds the payment, with any remainder carried forward to the payment after." },
          { p: "A company that stops taking payments keeps its outstanding balance on the books; nothing is written off silently." },
        ],
      },
      {
        id: "errors",
        heading: "Errors",
        blocks: [
          { bullets: [
            "**“Stripe is holding your money”** on Settings → Payments — Stripe still needs something from you (a document, a bank account, a director's name). Open **Manage in Stripe** and finish what it asks for; clients' payments keep going through in the meantime.",
            "**“Stripe is reviewing your account”** — you have sent everything and Stripe is checking it, usually a day, sometimes two or three. Nothing to do.",
            "**A payment with no fee shown** — it is a manual payment, or an online payment recorded before fees began to be recorded on the payment. The export leaves those fee cells blank rather than writing 0.00, because “no fee is known” and “no fee” are different statements.",
            "**The Pay button is missing from an invoice** — Stripe has not enabled charges yet. Settings → Payments shows what it is waiting for.",
          ] },
        ],
      },
      {
        id: "accounting-export",
        heading: "How it appears in your accounting export",
        blocks: [
          { p: "The bookkeeping export (**Expenses → Bookkeeping export**) produces CSV files for a date range, and the payments file carries one line per payment with three money columns: **Amount** (gross — what the client paid and what the invoice was reduced by), **Processing fee**, and **Net deposited**, plus a **Fee rate** column naming the method the fee was taken at (“card”, “acss_debit”)." },
          { figure: "live:app-settings-expense-tracking", caption: "Expense Tracking — the Bookkeeping export card at the bottom downloads the date range as CSVs." },
          { p: "Post the gross to income and the fee to a merchant-fees expense from the same line; the bank feed then matches **Net deposited**. The totals file sums processing fees per tax code separately from income, so the fee is an expense in your books, not a smaller sale." },
          { p: "Payments are filtered on the **payment's own date**, not the invoice's — a December invoice paid in January is January's cash. Fee columns are blank for manual payments and for online payments taken before fees were recorded on the payment." },
          { tip: "Importing into QuickBooks Online or Xero: map Amount → income, Processing fee → merchant fees, Net deposited → the bank deposit. See [[the-accounting-export|The accounting export]] and [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero and your bookkeeper]]." },
        ],
      },
    ],
    faq: [
      { q: "Can I pass the fee on to the client?", a: "Not as a separate surcharge — the invoice total is what the client pays and the fee comes off your side. Price the job with the fee in mind, or offer bank debit to Canadian clients, which is capped at $5." },
      { q: "Is there a monthly fee for taking payments?", a: "No. Stripe bills a small active-account fee only in months you take payments, and it is shown as its own line on your next payment." },
      { q: "Why does my bank statement not match the invoice amount?", a: "The bank receives the net deposited — the amount minus the processing fee. The invoice and the export show both figures." },
      { q: "Does FieldQuo hold my money?", a: "Never. The charge is created in your company's name and Stripe pays your bank directly." },
    ],
  },
  "bank-debit-in-canada": {
    title: "Bank debit in Canada: 1% capped at $5",
    summary:
      "Where pre-authorized bank debit is offered, what it costs, how long a debit takes to clear, and why the $5 cap is the cheapest way to collect a large recurring bill.",
    updated: "2026-09-12",
    intro: [
      "A Canadian client on a service plan can pay by pre-authorized debit straight from their bank account instead of a card. The fee is **1% + $0.40, capped at $5.00** per payment — so a $5,000 debit costs you $5, where the same amount by card costs $150.30. Bank debit is passed through at Stripe's cost; FieldQuo adds nothing to it.",
      "This article says exactly where bank debit is offered (service plans billed in Canadian dollars, not the Pay button on a one-off invoice), what the client agrees to, how long a debit takes to clear, and how the fee shows on the invoice and in your accounting export.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Bank debit in FieldQuo is Canadian pre-authorized debit (PAD) through Stripe. The client saves their bank account once, on a Stripe-hosted page, and agrees in writing to a series of payments of a fixed amount on a fixed cadence. From then on each occurrence of the plan is debited without the client doing anything, and every debit raises an invoice the client can see in their portal." },
          { p: "It is offered only when the company bills in **CAD**. Stripe requires the debit currency to match the client's Canadian bank account, so a company billing in US dollars sees card as the only automatic method." },
          { note: "Bank debit is not offered on the Pay button of an ordinary invoice. That checkout takes cards (and Affirm, if you turned pay-over-time on). Bank debit lives on service plans with automatic collection — see [[service-plans|Service plans]]." },
        ],
      },
      {
        id: "where-it-is-offered",
        heading: "Where bank debit is offered",
        blocks: [
          { p: "The choice is made by the client, not by you: when you ask a client to authorise a plan, Stripe's page offers a card or, for a CAD company, a bank account, and the client picks. Here is the path from your side." },
          { steps: [
            "Open **Service Plans** and create the plan, choosing **Charge automatically** under **How it gets paid**.",
            "Save it. The plan reads **Automatic payment asked for, but the client hasn't agreed yet** until the client acts. Press **Ask the client to authorise payments** to email them the link.",
            "The client reads the authorisation terms on their own page, ticks the box, and lands on Stripe's page, which offers **card** or **bank account**. For a bank account Stripe shows its own pre-authorized debit agreement and emails the client a copy.",
            "Once the account is saved the plan reads **Charged automatically — bank debit**, with the date the client authorised it. Until then it invoices each visit, exactly as a plan without a mandate does.",
          ] },
          { figure: "live:app-plans", caption: "Service Plans — every plan with its cadence, how it gets paid, and what happens next." },
          { note: "The authorisation wording exists in English and French only. A client whose language is neither is not offered automatic charging at all — their plan sends an invoice with a pay link on each visit instead. Full detail: [[service-plan-bank-debit-mandates|Service plans paid by bank debit: the mandate]]." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "What it costs",
        blocks: [
          { table: {
            head: ["Amount debited", "Bank debit fee", "The same amount by card"],
            rows: [
              ["$200", "$2.40", "$6.30"],
              ["$460", "$5.00 (the cap)", "$14.10"],
              ["$5,000", "$5.00 (the cap)", "$150.30"],
            ],
          } },
          { p: "The fee is deducted from the debit before the money reaches your bank, the same way a card fee is. The invoice's payment row reads, for example, **“bank debit processing $5.00 · deposited $4,995.00”**, and the accounting export writes the method as “acss_debit” in its **Fee rate** column. There is no international or currency-conversion surcharge on bank debit." },
          { tip: "The cap is reached at $460. Above that, every extra dollar a client pays by bank debit is free of fees — which is why a quarterly or annual maintenance plan is the place to offer it." },
        ],
      },
      {
        id: "how-a-debit-settles",
        heading: "How a debit settles",
        blocks: [
          { p: "A card charge is answered in seconds. A bank debit is accepted immediately but the money moves through the banking system afterwards, and takes about **5 business days** to settle." },
          { bullets: [
            "While it is in transit, the plan's occurrence shows as charging and the invoice is **not** marked paid — FieldQuo does not show a settled bill against money that has not arrived. Stripe sends the client the debit notification the mandate requires.",
            "When it clears, the invoice becomes **Paid** and the client is emailed a receipt from your company.",
            "If the bank returns it (insufficient funds, a closed account), the occurrence is marked failed and the client is emailed the invoice with a pay link, so the visit is still billed and can still be paid by card.",
          ] },
          { warning: "A bank account that still needs micro-deposit verification is not a mandate yet. FieldQuo does not record the authorisation until Stripe reports the setup complete, so a plan can read “the client agreed but hasn't saved a payment method yet” for a day or two while the client confirms the deposits." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What the other tools do not do",
        blocks: [
          { p: "FieldQuo's comparison pages record what each competitor's own pricing page lists, with the date it was read. Jobber's page, read on 2026-09-12, prices bank payments at 1% of the amount with no cap, and cards at 2.9% + 30¢. FieldQuo's card rate is a tenth of a point higher — 3% + 30¢ — and its bank debit stops at $5.00 per payment." },
          { p: "So the advantage is the cap, not the card rate. On a $5,000 invoice paid from a bank account the difference is $45; on a $200 one there is none. Say it that way, because that is what both pricing pages say." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can set it up",
        blocks: [
          { p: "Service plans sit under Invoices in the access grid: anyone who can see invoices can see plans. Creating a plan and sending the authorisation link needs edit access to invoices **and** the **payments** toggle — the Manager level and above, and any Custom access with both. The fee itself is not a setting; nobody can change it." },
        ],
      },
    ],
    faq: [
      { q: "Can a client pay a one-off invoice by bank debit?", a: "No. The Pay button on an invoice takes cards, plus Affirm if you offer financing. Bank debit is available through a service plan the client has authorised." },
      { q: "Is the $5 cap per payment or per month?", a: "Per payment. Two $5,000 debits in one month cost $5 each." },
      { q: "Why is the invoice still unpaid two days after the debit?", a: "A bank debit takes about five business days to settle. The invoice is marked paid when the money actually arrives, not when the debit is requested." },
    ],
  },

  "instant-payouts": {
    title: "Instant payouts",
    summary:
      "Move your available Stripe balance to a debit card in about 30 minutes for a 1% fee, instead of waiting two business days for the standard payout.",
    updated: "2026-09-12",
    intro: [
      "Stripe pays your balance to your bank on its standard schedule — free, in about 2 business days. When you need the money today, the **Instant payout** card on **Settings → Payments** sends what is available to a debit card in about 30 minutes, any day, any time, for **1%** of the amount (minimum 50¢). That is Stripe's own charge, passed through at cost; FieldQuo keeps none of it.",
      "This article is the card itself: what it shows, what pressing the button does, the conditions Stripe puts on it, and every reason it can say no.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "An instant payout is a Stripe payout with the method set to instant, sent to the debit card on your Stripe account. It is not a loan and not an advance: it moves money that is already yours — payments that have settled into your Stripe balance — earlier than the standard schedule would." },
          { p: "The amount is always the whole net figure Stripe reports as available right now. There is no amount field, on purpose: FieldQuo never lets a browser send a money amount, and a partial instant payout would be a second product. One press pays out everything that can go." },
        ],
      },
      {
        id: "what-is-on-the-card",
        heading: "What is on the card",
        blocks: [
          { p: "The card sits on **Settings → Payments** once Stripe is connected. Top to bottom it shows:" },
          { bullets: [
            "**Instant payout** and a sentence stating the fee before any button — Stripe's rules require the fee to be conspicuous, so it is a sentence, not a tooltip.",
            "**Available now** — the gross balance Stripe can pay out instantly, in your currency.",
            "**Fee** — what Stripe will take, with the percentage it works out to (for example “$12.40 (1%)”).",
            "**You'll receive** — the net that will reach the card, and **To your debit card ending in ····**.",
            "**Pay out … now** — the button, with the net amount in its label.",
            "**Recent instant payouts** — the last payouts sent from here, with their dates and amounts.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "How to send one",
        blocks: [
          { steps: [
            "Open **Settings → Payments** and find the **Instant payout** card.",
            "Check **Available now**, **Fee** and **You'll receive**. Every number comes from Stripe at that moment.",
            "Press **Pay out … now**. A confirmation line repeats the three figures — “Pay out $1,240.00 now · fee $12.40 · you receive $1,227.60”.",
            "Press **Confirm payout**. The card reads **Sent. Stripe expects it to reach your card within about 30 minutes.**",
          ] },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — the connected Stripe account; the Instant payout card appears below it once the account qualifies." },
          { note: "The money reaches the debit card Stripe has on file, usually within 30 minutes; your bank can delay it. A second press while the first is still being sent is refused with “A payout is already being sent.”" },
        ],
      },
      {
        id: "what-it-costs",
        heading: "What it costs",
        blocks: [
          { table: {
            head: ["Payout", "Fee", "Arrives"],
            rows: [
              ["Standard payout to your bank", "Free", "About 2 business days"],
              ["Instant payout to a debit card", "1% of the amount, minimum $0.50", "About 30 minutes"],
            ],
          } },
          { p: "The card prints the fee Stripe actually reported for this payout beside the published 1%, so if Stripe's figure ever differs from the rate you were told to expect, you see Stripe's figure — and that is what you get." },
        ],
      },
      {
        id: "when-it-is-refused",
        heading: "When the card says no",
        blocks: [
          { p: "Eligibility is decided from Stripe's own answers, not from anything FieldQuo stores. Each refusal is printed on the card in plain words:" },
          { bullets: [
            "**Connect Stripe first.** — no Stripe account yet.",
            "**Available once your Stripe account can take payments.** — Stripe has not enabled charges.",
            "**Stripe hasn't enabled payouts on this account yet.** — payouts are off; see [[payouts-held-or-under-review|Payouts held or under review]].",
            "**Available once your Stripe account is 30 days old. Yours is 12 days old.** — a new account cannot pay out instantly. Thirty days is Stripe's own new-account window for payout risk, and FieldQuo, as the platform, carries the liability for a negative balance on a young account.",
            "**Instant payouts go to a debit card. A bank account only takes regular payouts — add a debit card in your Stripe dashboard.** — in Canada especially, a bank account is standard-payout only. The card offers **Add a debit card in Stripe**.",
            "**Nothing is available to pay out instantly right now.** — the balance is zero, or still pending.",
          ] },
        ],
      },
      {
        id: "who-can-use-it",
        heading: "Who can use it",
        blocks: [
          { p: "Owners and administrators — the same people who can open **Settings → Payments** at all. A read-only support session can see the card but cannot press the button. Each payout is recorded with who sent it." },
        ],
      },
    ],
    faq: [
      { q: "Can I pay out part of the balance?", a: "No. The button pays out the whole net amount Stripe reports as available. If you want to keep some in the balance, wait for the standard payout instead." },
      { q: "Does an instant payout cost FieldQuo anything, or earn it anything?", a: "Neither. Stripe charges 1% and FieldQuo passes it through at cost." },
      { q: "My bank account is on file. Why can't I pay out instantly?", a: "Instant payouts go to a debit card, not a bank account. Add a debit card in your Stripe dashboard — the card on the settings page links straight to it." },
    ],
  },

  "payouts-held-or-under-review": {
    title: "Payouts held or under review",
    summary:
      "Why clients' payments can keep going through while nothing reaches your bank, how Settings → Payments tells you which of the two it is, and what to do about each.",
    updated: "2026-09-12",
    intro: [
      "Taking payments and being paid out are two different switches on a Stripe account. Stripe can keep accepting your clients' cards while holding the money, and from inside the app everything looks like it is working — invoices go to **Paid**, the balance builds up, and nothing arrives. **Settings → Payments** now says so in an amber banner the moment Stripe reports payouts off, and tells you whether the wait is on you or on Stripe.",
      "This article is that banner, the account card under it, and the reasons Stripe gives.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every time you open **Settings → Payments**, FieldQuo asks Stripe for the live state of your account: whether charges are enabled, whether payouts are enabled, what is still outstanding, what is being verified, and Stripe's own reason if the account is restricted. Nothing here is cached from an earlier day." },
          { p: "Payouts stop for two reasons that call for opposite actions: Stripe is **waiting on you** (a document, a bank account, a director's name), or Stripe is **checking what you already sent**. Telling those apart is the whole point of the banner — prompting someone to “provide more information” while Stripe reviews it is how the same document gets uploaded four times." },
        ],
      },
      {
        id: "the-two-banners",
        heading: "The two banners",
        blocks: [
          { bullets: [
            "**Stripe is holding your money** — “Your clients' payments are going through, but Stripe won't pay out to your bank until it has what it still needs from you. Open Manage in Stripe below and finish what it asks for.” Under it, Stripe's own reason when it gave one.",
            "**Stripe is reviewing your account** — “You've sent them everything they asked for. Payouts to your bank are paused until they finish — usually a day, sometimes two or three. Your clients' payments keep going through in the meantime, and there is nothing for you to do.”",
          ] },
          { p: "The banner appears only on an active account — one where charges are on. While charges are still off there is no money to hold, and the onboarding block above it already says what is unfinished." },
        ],
      },
      {
        id: "your-stripe-account",
        heading: "The “Your Stripe account” card",
        blocks: [
          { p: "Below the connection, owners see a card titled **Your Stripe account**. It exists because someone whose payouts are held could not previously identify their own account to the company holding their money. It shows:" },
          { bullets: [
            "**Stripe account ID** with a copy button, and the **Sign-in email** Stripe sends the Express sign-in code to.",
            "**What Stripe has switched on** — **Taking card payments: On / Off** and **Paying out to your bank: On / Paused**.",
            "**What Stripe is still waiting for** — each outstanding item in plain words (“A photo of your ID”, “A bank account for payouts”, “Your business number (BN)”), with **Stripe's deadline** when there is one; or “Nothing from you. Stripe is checking what you already sent; sending it again won't make it faster.”",
          ] },
          { note: "This card is owner-only: the account ID and sign-in email are the credential half of the company's banking relationship. Administrators see the banner and the connection but not this card. The full list of what Stripe asks for, and why, is in [[what-stripe-asks-for-and-why|What Stripe asks for, and why]]." },
        ],
      },
      {
        id: "how-to-clear-a-hold",
        heading: "How to clear a hold",
        blocks: [
          { steps: [
            "Open **Settings → Payments** and read the banner. If it says **reviewing**, stop here — there is nothing to send.",
            "If it says **holding**, read **What Stripe is still waiting for** on the account card, so you know what to have ready.",
            "Press **Manage in Stripe**. Stripe's Express dashboard opens with a notification banner that collects exactly those items and the settings that satisfy them.",
            "Provide what is asked. Come back to **Settings → Payments**; the page re-reads Stripe on every load, so the banner changes to **reviewing** as soon as Stripe has your submission, and disappears when payouts are back on.",
          ] },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — the connected account, its switches, and what Stripe is still waiting for." },
          { tip: "If Stripe's dashboard genuinely cannot settle it, Stripe's support is reached from inside that dashboard once you are signed in. Give them the account ID from the card — it is what identifies your account to them. FieldQuo cannot lift a hold; the account is yours, held in your name." },
        ],
      },
      {
        id: "stripes-reasons",
        heading: "The reasons Stripe gives",
        blocks: [
          { p: "When Stripe restricts an account it sends a machine code. FieldQuo prints the sentence for it rather than the code:" },
          { table: {
            head: ["What the page says", "What it means"],
            rows: [
              ["Stripe is waiting on information that is now overdue.", "Something on the list passed its deadline. Provide it and payouts resume after review."],
              ["Stripe is still checking what you sent. There is nothing to do.", "Verification in progress — the reviewing case."],
              ["Stripe is reviewing the account.", "A manual review, no item outstanding. Usually a day or three."],
              ["Stripe is reviewing a possible sanctions-list match.", "A name matched a watch list. Stripe resolves it; it may ask for ID."],
              ["Stripe closed the account for suspected fraud / for a terms of service violation / after a sanctions-list match.", "The account is closed. Only Stripe can reopen it — contact them from the dashboard."],
              ["FieldQuo paused this account.", "A platform pause. Contact FieldQuo support."],
            ],
          } },
        ],
      },
      {
        id: "what-keeps-working",
        heading: "What keeps working while payouts are paused",
        blocks: [
          { p: "Everything on the client's side. Pay buttons still work, charges still succeed, invoices still go to **Paid**, and the processing fee is still taken at the published rate. The money sits in your Stripe balance and is paid out, on the standard schedule, once payouts are enabled again — nothing is lost and nothing needs re-sending. Instant payouts are refused while payouts are off." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "**Settings → Payments** is for owners and administrators. The **Your Stripe account** card, with the ID and sign-in email, is owner-only. A read-only support session sees everything on the page, including that card, because “why is this company's money held” is the most common reason a support session is opened — and can change nothing." },
        ],
      },
    ],
    faq: [
      { q: "My clients paid a week ago and my bank shows nothing. Is the money gone?", a: "No. Open Settings → Payments: if the amber banner is there, Stripe is holding the balance until it has what it needs, or while it reviews. It pays out once payouts are enabled again." },
      { q: "Can FieldQuo release the money?", a: "No. The Stripe account is yours, in your name; FieldQuo never holds the money and cannot lift a hold. Stripe's dashboard, and Stripe's support from inside it, are the only levers." },
      { q: "Should I upload the document again to speed things up?", a: "Not if the page says reviewing. Sending it again will not make it faster and often restarts the queue." },
    ],
  },

  "refunds": {
    title: "Refunds",
    summary:
      "How to return an online payment to a client through Stripe, what FieldQuo records when you do, and why the processing fee stays deducted.",
    updated: "2026-09-12",
    intro: [
      "A refund returns some or all of an online payment to the client's card or bank account. You issue it in your Stripe dashboard — there is no refund button in FieldQuo — and FieldQuo records it the moment Stripe reports it: the payment row, the invoice's balance and status, and a notification to the people who handle payments.",
      "The processing fee is not returned. Stripe keeps its fee on a refunded charge, so the fee already deducted stays deducted. Refund the amount the client paid, not the net you received.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every online payment is a Stripe charge in your company's name. Refunding it is a Stripe action, done from the Express dashboard behind **Manage in Stripe**, for the full amount or a part of it, once or several times. FieldQuo listens for Stripe's confirmation and updates the invoice — it never issues an invoice refund on its own, and it never moves money out of your balance without Stripe telling it the refund happened." },
          { note: "There is one refund FieldQuo does issue itself: a booking visit fee returned when a client cancels a visit inside the notice window you set. That is a separate rule — see [[booking-fees-and-visit-deposits|Booking fees and visit deposits]]." },
        ],
      },
      {
        id: "how-to-refund",
        heading: "How to refund an online payment",
        blocks: [
          { steps: [
            "Open the invoice and note the payment's date and amount from its payment row.",
            "Open **Settings → Payments** and press **Manage in Stripe**.",
            "In Stripe's dashboard, open the payment and refund it — the whole amount or a partial one.",
            "Back in FieldQuo, the invoice updates on its own once Stripe confirms the refund. Nothing to press.",
          ] },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — Manage in Stripe opens the dashboard where refunds are issued." },
          { warning: "Refund the invoice amount, not the net. A client who paid $2,260 expects $2,260 back; the $68.10 fee is your cost of having taken the payment, and Stripe does not return it." },
        ],
      },
      {
        id: "what-fieldquo-records",
        heading: "What FieldQuo records",
        blocks: [
          { bullets: [
            "The payment row keeps its original amount and fee, and gains the refunded amount and date. A second partial refund on the same charge updates the same row to the new total refunded — never a second row.",
            "The invoice's paid figure drops by the refund and its balance rises by it. A fully refunded invoice reads **Refunded**; a partly refunded one reads **Partially refunded**, with a banner such as “Partly refunded — $500.00 was returned to the client.”",
            "Owners and administrators get a notification: “Money taken back on invoice INV-1042 — Jane Tremblay”, marked **Refunded**. The Manager level does not — see [[disputes-and-chargebacks|Disputes and chargebacks]] for who is told.",
            "In the accounting export the payment keeps its gross, fee and net; the refund appears in your Stripe dashboard against the same charge.",
          ] },
          { p: "A refund on an older version of an amended invoice is applied to the latest version, because the family of versions shares one running balance." },
        ],
      },
      {
        id: "the-fee",
        heading: "The fee on a refunded payment",
        blocks: [
          { p: "Stripe keeps its processing fee on a refunded charge. A refund issued from your dashboard leaves the fee where it is, and the one refund FieldQuo issues itself — the visit fee — is created with the fee deliberately **not** returned: returning it would leave FieldQuo paying Stripe for a payment nobody kept. So the fee you saw on the payment row is the fee you paid, refund or no refund." },
          { p: "If your balance cannot cover a refund, Stripe recovers the difference from your next payments before paying anything out — see the negative-balance section of [[payment-processing-fees-and-payouts|Payment processing fees and payouts]]." },
        ],
      },
      {
        id: "manual-payments",
        heading: "Refunding a cash, cheque or e-transfer payment",
        blocks: [
          { p: "FieldQuo does not record refunds of manual payments. The **Record Payment** form refuses a negative amount, so a cash refund you hand back cannot be entered as a payment. Return the money outside the app and, if the invoice should show a smaller total, amend the invoice instead — see [[edit-an-invoice-after-sending|Edit an invoice after it was sent]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can refund",
        blocks: [
          { p: "Whoever can open **Manage in Stripe** — owners and administrators. Seeing the refund on the invoice needs the **payments** toggle, which the Manager level holds and Crew, Estimator and Dispatcher do not." },
        ],
      },
    ],
    faq: [
      { q: "Is there a refund button on the invoice?", a: "No. Refunds are issued in your Stripe dashboard via Manage in Stripe; FieldQuo records the result automatically." },
      { q: "Does the client get their processing fee back?", a: "The client never paid a fee — they paid the invoice total. Refund that total. The fee was deducted from your side and stays deducted." },
      { q: "Will the overdue reminder chase a refunded invoice?", a: "No. The automatic overdue reminder only chases invoices still in the sent or overdue state; a refunded or partially refunded invoice is neither." },
    ],
  },

  "disputes-and-chargebacks": {
    title: "Disputes and chargebacks",
    summary:
      "What happens when a client's bank disputes a card payment: who is told, what the invoice shows, where the money goes while it is open, and what winning or losing costs.",
    updated: "2026-09-12",
    intro: [
      "A dispute — a chargeback — is a cardholder asking their bank to take a payment back. Stripe takes the disputed amount and a **$15** dispute fee out of the balance while it is open, starts an evidence clock, and waits for you to respond. FieldQuo tells you the moment it happens, marks the invoice **Disputed**, and moves the amounts so that it is your balance, not FieldQuo's, that carries them.",
      "Before FieldQuo's notification feed existed, a chargeback told nobody: the contractor found out whenever they next opened the Stripe dashboard, often after the deadline. That is the reason the feed was built.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every homeowner payment is a Stripe charge created on FieldQuo's platform and transferred to your account. When the cardholder disputes it, Stripe debits the platform for the disputed amount and the $15 fee. FieldQuo reverses both out of the transfer it made to you — in two separate movements, so they stay separately readable on the payment row — and the invoice shows **“Dispute — $2,260.00 held, $15.00 fee”**." },
          { p: "You respond in your Stripe dashboard with evidence. The signed quote, photos of the finished work, the completion checklist and the email trail are the things that win disputes; FieldQuo has all of them on the job and the quote." },
        ],
      },
      {
        id: "what-you-see",
        heading: "What you see in FieldQuo",
        blocks: [
          { bullets: [
            "A notification, marked critical, to owners and administrators (see who is told, below): “Money taken back on invoice INV-1042 — Jane Tremblay”, tagged **Chargeback — Stripe has a deadline**.",
            "The invoice's status becomes **Disputed** — it outranks Paid, because a bank mid-decision is a different fact from either.",
            "A banner on the invoice: “A client's bank has disputed a payment on this invoice — the money is on hold until it's resolved.”",
            "The payment row: **Dispute — $2,260.00 held, $15.00 fee** while it is open; then either **Dispute won — $2,260.00 returned. Stripe does not refund the $15.00 dispute fee.** or **Dispute lost — $2,260.00 taken back, $15.00 fee**.",
          ] },
          { figure: "live:app-invoices", caption: "Invoices — a disputed invoice shows its status in the list like any other." },
        ],
      },
      {
        id: "what-happens-to-the-money",
        heading: "What happens to the money",
        blocks: [
          { table: {
            head: ["Stage", "The disputed amount", "The $15 fee"],
            rows: [
              ["Open", "Reversed out of your transfer and held", "Reversed out of your transfer"],
              ["Won", "Transferred back to you", "Not returned — Stripe keeps it"],
              ["Lost", "Gone; folded into the invoice's refunded total", "Not returned"],
            ],
          } },
          { p: "A reversal can only take back what the transfer gave you. The transfer on a $2,260 card payment was $2,191.90 — the net after the processing fee — so a full-amount dispute plus the fee exceeds it by $83.10. The hold is taken first, the fee from what remains, and any shortfall is recorded as such rather than silently absorbed. In practice a dispute is usually smaller than the transfer and the shortfall is at most the fee." },
          { note: "Stripe does not issue a refund when a dispute is lost — the charge simply stays reversed. FieldQuo folds a lost dispute into the invoice's refunded total once, so the invoice reads Refunded or Partially refunded afterwards instead of Disputed forever." },
        ],
      },
      {
        id: "how-to-respond",
        heading: "How to respond",
        blocks: [
          { steps: [
            "Open the notification, or the invoice — the payment row shows the held amount and the fee.",
            "Gather the evidence from FieldQuo: the accepted quote with the client's approval, the job's photos and completion checklist, the invoice email trail.",
            "Open **Settings → Payments → Manage in Stripe**, find the dispute, and submit the evidence before Stripe's deadline.",
            "Wait for the card network's decision. The invoice updates on its own when Stripe reports it closed.",
          ] },
          { warning: "The deadline is Stripe's, not FieldQuo's, and it is short — typically days, not weeks. A dispute with no response is lost by default. Treat the notification as urgent." },
        ],
      },
      {
        id: "the-fee",
        heading: "The dispute fee",
        blocks: [
          { p: "Stripe charges **$15** per dispute, in CAD or USD, and does not return it when you win. FieldQuo passes it through at cost, and the invoice says so in as many words when a dispute is won. There is no FieldQuo fee on top." },
        ],
      },
      {
        id: "who-is-told",
        heading: "Who is told",
        blocks: [
          { p: "The notification goes to owners and administrators, and to any member on a Custom access whose grid carries the **payments** toggle — someone an owner has deliberately handed payment collection to. The Manager level holds the toggle but is deliberately left out, along with Dispatcher, so that the company's revenue is not pushed at people the owner thinks of as running crews; Crew and Estimator hold the toggle off and never see it. No email is sent: the feed row is the record, plus a push notification on any phone or browser where the person turned those on." },
        ],
      },
    ],
    faq: [
      { q: "Can I refund the client instead of fighting the dispute?", a: "Not once it is open — Stripe has already taken the amount. Accept the dispute in your Stripe dashboard if you do not want to contest it; the outcome is the same as losing, including the $15 fee." },
      { q: "Does a dispute stop the client's other invoices?", a: "No. Only the disputed invoice changes status. The client's other invoices and their portal are unaffected." },
      { q: "Where does the $15 come from if my balance is empty?", a: "Stripe recovers a negative balance from your next payments before paying anything out. Nothing is written off silently." },
    ],
  },

  "deposits-and-payment-schedules": {
    title: "Deposits and payment schedules",
    summary:
      "Split what a job is owed into a deposit and later stages tied to the job's own dates, from the Payment schedule card on Settings → Company Settings.",
    updated: "2026-09-12",
    intro: [
      "Most trades take a deposit and the balance later. The **Payment schedule** card on **Settings → Company Settings** turns that into rules: a percentage when the invoice is created, a percentage at job start, halfway, or on completion. Every accepted quote from then on gets one invoice, requested in those stages, each with its own pay link for its own share.",
      "It is off by default — with no stages, every quote gets one full invoice on acceptance, exactly as it always has. This article is the card; how each stage is actually requested is in [[progress-payments-by-stage|Progress payments: how each stage is requested]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A schedule is a list of stages. Each has a name, a trigger and a percentage, and the percentages must add up to exactly 100. The amounts are worked out from the accepted quote's total the moment the client approves it, and frozen on the job — a stage that has already been requested never changes because a date moved afterwards." },
          { p: "The card also writes your **Payment terms** text for you: with a schedule saved, the terms on every quote, invoice and PDF read “30% Deposit, 40% Job start, 15% Halfway, 15% On completion” — generated from the stages, so the document the client sees always matches what actually bills. The free-text terms field is locked while a schedule is on." },
        ],
      },
      {
        id: "what-is-on-the-card",
        heading: "What is on the card",
        blocks: [
          { p: "“Split what's owed across stages tied to the job itself — a deposit when the invoice goes out, the rest at job start, halfway, or completion. Off by default; turn it on by adding a stage below.” Each stage row has **Stage name**, **When** and **Percent**; the **When** list offers four triggers:" },
          { bullets: [
            "**Deposit — when the invoice is created and sent** — fires the moment the quote is accepted, before any date is known.",
            "**Job start** — the job's start date.",
            "**Halfway through the job** — the middle day of the job, counted from its start and end dates.",
            "**Job end (completion)** — the job's end date as scheduled, not the day the crew actually finished.",
          ] },
          { p: "Under the rows: **Total** with the running sum, **Add a stage**, **Remove this stage** on each row, **Save schedule**, and **Turn off — go back to free text**." },
        ],
      },
      {
        id: "how-to-set-up",
        heading: "How to set one up",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings** and find the **Payment schedule** card.",
            "Press **Add a stage**. The first row defaults to **Deposit**; type the percentage.",
            "Add the rest — for example **Job start** 40, **Halfway** 15, **On completion** 15 — renaming any stage in your own words.",
            "Watch **Total**: “Stages must add up to exactly 100% before they can be saved.” Press **Save schedule** when it reads 100.",
          ] },
          { figure: "live:app-settings-company", caption: "Settings → Company Settings — the Payment schedule card, with Scope of work and terms above it." },
          { note: "Up to 12 stages, each name up to 80 characters. A 0% stage is allowed and is simply waived when its turn comes — no $0 email goes to the client." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it changes"],
            rows: [
              ["Stage name", "The label on the client's email and on the job's schedule. Editable; never re-derived once saved."],
              ["When", "Which job date releases the request. A stage with no usable date waits, visibly, and is never skipped."],
              ["Percent", "The stage's share of the accepted total. The last stage absorbs rounding so the stages sum to the cent."],
              ["Save schedule", "Writes the stages and regenerates the Payment terms sentence. Applies to quotes accepted from now on; jobs already in progress keep their frozen stages."],
              ["Turn off — go back to free text", "Deletes every stage. New quotes get one full invoice again and the Payment terms field becomes editable."],
            ],
          } },
        ],
      },
      {
        id: "the-halfway-math",
        heading: "How halfway is counted",
        blocks: [
          { p: "Days are counted inclusively: a job from September 1 to September 6 is a 6-day job. Halfway is day 3, so the request goes out on September 3. An odd length rounds **up** — a 5-day job asks on day 3, once more than half the work is genuinely done, never on day 2. The dates are the job's scheduled start and end; a job with only one of them set shows “Can't schedule yet” for the stages that need the other." },
        ],
      },
      {
        id: "turning-it-off",
        heading: "Turning it off",
        blocks: [
          { warning: "“This clears every stage. Jobs already using this schedule keep what was already billed; new quotes will use the free-text terms below instead.” Turning off does not un-request anything already sent, and does not refund anything." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Who can change it",
        blocks: [
          { p: "Saving or clearing the schedule needs the **user:manage** capability — owners, administrators, and the Dispatcher and Manager levels. **Settings → Company Settings** is hidden from the Crew and Estimator levels. The booking-page visit deposit is a different thing, set on **Settings → Booking page** — see [[booking-fees-and-visit-deposits|Booking fees and visit deposits]]." },
        ],
      },
    ],
    faq: [
      { q: "Does a schedule create several invoices?", a: "No. One invoice per job, requested in stages. Each stage emails a pay link capped to its own share of that one invoice; the invoice's balance is the running total across every stage paid." },
      { q: "Can I set a different schedule per quote?", a: "Not today. The schedule is company-wide and applies to every quote accepted while it is on. Turn it off for a one-off job that should bill in full." },
      { q: "What about work added after acceptance?", a: "Stages are percentages of the accepted quote. Agreed changes are collected on the invoice's balance, not by a stage, and the job page says how much that is." },
    ],
  },

  "progress-payments-by-stage": {
    title: "Progress payments: how each stage is requested",
    summary:
      "What fires each stage of a payment schedule, what the client receives, how the job page shows Waiting, Requested and Waived, and what happens when the job's dates move.",
    updated: "2026-09-12",
    intro: [
      "Once a payment schedule is on, accepting a quote creates the job, the one invoice for it, and a frozen copy of the schedule on that job: each stage with its share in dollars and, where a date is known, its due date. The deposit fires at once. The rest fire on a daily pass as the job's dates arrive.",
      "This article follows one stage from “Waiting” to the client's inbox. Setting the schedule up is in [[deposits-and-payment-schedules|Deposits and payment schedules]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A stage is requested exactly once. Requesting it emails the client an invoice email that headlines the stage's own amount — “Invoice INV-1042 — $1,200.00” — with the stage's name as the note and a **Pay** button that charges that amount, not the whole balance. The first stage requested is what sends the invoice: it stamps the invoice sent, to that address, and moves it from draft to **Sent**." },
          { p: "Whether a stage has been paid is not tracked on the stage. The invoice's balance already answers it across however many stage payments have landed, and a second paid flag would be two places that can disagree." },
        ],
      },
      {
        id: "when-each-stage-fires",
        heading: "When each stage fires",
        blocks: [
          { table: {
            head: ["Trigger", "Fires when", "Needs"],
            rows: [
              ["Deposit — when the invoice is created and sent", "The moment the quote is accepted, before any date exists", "A client email address"],
              ["Job start", "The day of the job's start date, on the daily pass", "A start date on the job"],
              ["Halfway through the job", "The middle day between start and end, counted inclusively and rounded up", "Both dates, end not before start"],
              ["Job end (completion)", "The day of the job's scheduled end date", "An end date on the job"],
            ],
          } },
          { p: "The daily pass runs once a day, early in the morning, over every job with a stage still waiting. A stage whose date has arrived is requested; a stage the client cannot be emailed (no address on the client record) stays waiting and is tried again the next day." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "What the client receives",
        blocks: [
          { p: "Each request is the same invoice email the Send button uses, in the client's language, from your company's sender, with three differences:" },
          { bullets: [
            "The subject and headline carry the stage's amount — its share — rather than the invoice's full balance.",
            "The stage's name (“Deposit”, “Job start”) appears as a line in the email.",
            "The **Pay** link opens the invoice in the client portal pointed at this stage, so the pay button asks for exactly this share. The amount is re-derived from the stage on the server; nothing in the link can change it.",
          ] },
          { note: "If Stripe is not connected the email still goes out, with **View invoice** instead of **Pay**, and the client pays by whatever methods your invoice lists. A stage request never asks for more than the invoice's real remaining balance, even if the stages were computed before a change." },
        ],
      },
      {
        id: "on-the-job-page",
        heading: "On the job page",
        blocks: [
          { p: "The job's own **Payment schedule** card lists every stage with its share and one of three states:" },
          { bullets: [
            "**Waiting** — not yet requested. Shows **Due {date}** once the date is known, or why it cannot be scheduled yet.",
            "**Requested** — the client has been emailed for it. Its date is now frozen.",
            "**Waived (0%)** — a 0% stage, recorded as fired with no email.",
          ] },
          { p: "The three blocked messages are: “Can't schedule yet — set a start date for this job”, “Can't schedule yet — set an end date for this job”, and “The end date is before the start date — fix the job's dates”. A blocked stage is a visible state, never a silently skipped one." },
        ],
      },
      {
        id: "when-dates-move",
        heading: "When the job's dates move",
        blocks: [
          { p: "Every waiting stage's due date is recomputed from the job's current dates on every daily pass — it is not trusted from the day the schedule was created. A job that slips a week drags its waiting stages with it. A stage already requested keeps the date it was requested on: a client who has been asked for money on a date must not see a different one because the job was rescheduled afterwards." },
          { note: "A job entered after the fact as a past job never gets stages, and never emails a deposit request for work already paid for." },
        ],
      },
      {
        id: "change-orders",
        heading: "Changes agreed after acceptance",
        blocks: [
          { p: "Stage amounts are percentages of the accepted quote and are frozen for three reasons: the client approved those numbers, a requested stage has already been asked for, and recomputing would move real money. The job page says so when it applies: “These stages are percentages of the accepted quote and don't include $640.00 of agreed changes. That's collected on the invoice balance, not by a stage.”" },
        ],
      },
    ],
    faq: [
      { q: "Can I request a stage early by hand?", a: "Not from the schedule. You can chase the invoice itself at any time — see [[invoice-reminders-and-chasing|Invoice reminders and chasing]] — which asks for the full remaining balance." },
      { q: "The client paid the deposit by e-transfer. Does the stage know?", a: "Record it on the invoice as a manual payment. The invoice's balance drops, and the next stage's pay link is capped to what is still owed." },
      { q: "Why did the halfway request go out on day 3 of a 5-day job?", a: "Odd lengths round up so the request lands once more than half the work is done, never before the midpoint." },
    ],
  },

  "invoice-reminders-and-chasing": {
    title: "Invoice reminders and chasing",
    summary:
      "The automatic overdue reminder on Settings → Follow-ups, the Chase payment button on the dashboard and the invoice, and the trail each one leaves.",
    updated: "2026-09-12",
    intro: [
      "Two things chase an unpaid invoice. An **automatic reminder**, set up once on **Settings → Follow-ups**, emails a template a set time after the due date, once per invoice, and stops the moment the invoice is paid. And **Chase payment**, on the dashboard's “Waiting on you” and on the invoice itself, sends a payment request by hand, with a note in your words, as often as you like.",
      "Both are emails from your company's sender, in the client's language, linking to the client portal. Both leave a trail on the invoice.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "An invoice is overdue when its due date has passed and it is still **Sent** or **Overdue**. The dashboard's **Money owed** panel and aging ladder show what is past due and by how many days, and say in one line whether an automatic reminder exists: “An automatic reminder goes out 5 days after an invoice's due date.” or “No automatic overdue reminder is set up, so nothing chases these on its own.” — with **Set one up** or **Change it** beside it." },
          { p: "Text-message reminders do not exist. Every follow-up rule sends exactly one email; a diagram that drew an SMS branch would be describing a feature that is not there." },
        ],
      },
      {
        id: "the-automatic-reminder",
        heading: "The automatic overdue reminder",
        blocks: [
          { p: "A follow-up rule is a trigger, a delay and an email template. For invoices the trigger is **Invoice overdue** — “Fires once an unpaid invoice is past its due date by the delay period.” — and the default delay is 5 days." },
          { steps: [
            "Open **Settings → Email Templates** and make sure you have a Follow-up, Marketing or Custom template to send. Without one the page says so and the **New Rule** button is disabled.",
            "Open **Settings → Follow-ups** and press **New Rule**.",
            "Set **Trigger** to **Invoice overdue**, the **Delay** and **Unit** (hours or days), and pick the **Template to send**. Give it a **Rule name** if you like.",
            "Press **Create Rule**. The **How these run** diagram redraws: Trigger → Wait → Send email → “Stops as soon as the invoice is paid.” and “Each invoice gets this email once.”",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Settings → Follow-ups — the How these run diagram, drawn from the rules below it." },
          { note: "The rules are checked once a day. A rule can be paused with **Pause** and resumed with **Activate**; a paused rule sends nothing. Two rules on the same trigger with different delays both fire, in delay order — a 3-day nudge and a 14-day firmer one is a normal setup. The template can use the invoice number, total, amount paid, balance due, due date and a link straight to the invoice in the portal." },
        ],
      },
      {
        id: "chase-by-hand",
        heading: "Chasing by hand",
        blocks: [
          { steps: [
            "On the dashboard, under **Waiting on you** or **Money owed**, press **Chase payment** on the invoice; or open the invoice and press **Chase payment** in its banner.",
            "In **Chase this payment** — “Emails Jane a link to pay the $1,240.00 still owing, in their language, from your address.” — add a note if you want one: “we agreed you would settle after the final visit.”",
            "Press **Send the reminder**. The row confirms: “Payment request emailed to jane@… at 2:41 PM”.",
          ] },
          { p: "The email asks for the invoice's full remaining balance, with a **Pay** button when Stripe is connected. The button is missing when the client has no email address — the invoice says “Jane has no email address on file, so this invoice cannot be sent or chased.”" },
        ],
      },
      {
        id: "what-the-invoice-records",
        heading: "The trail on the invoice",
        blocks: [
          { bullets: [
            "**Emailed → jane@…** with the date of the first send.",
            "**Last chased · 3×** with the date of the latest manual chase — every accepted send counts.",
            "**Automatic reminder sent** with a date for each reminder the rule delivered.",
          ] },
          { p: "The dashboard rows carry the same facts — “Last chased 4 Sep · 2×”, “Automatic reminder sent 9 Sep” — so you can see at a glance which overdue invoices have already been nudged. The Activity Log records each send as well." },
        ],
      },
      {
        id: "the-chase-task",
        heading: "The follow-up task",
        blocks: [
          { p: "Sending an invoice also creates a task, due in a week: “Follow up payment for INV-1042 — Sent to Jane Tremblay. Check it's been paid before chasing — the client portal shows the current balance.” One task per invoice, however many copies you send; it is closed when the balance is settled. Seven days is a reminder to look, not your payment term — the term is on the invoice." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can do what",
        blocks: [
          { p: "Creating, pausing or deleting a follow-up rule needs **user:manage** — owners, administrators, Dispatcher and Manager; the **Settings → Follow-ups** row is hidden from everyone else. Pressing **Chase payment** needs edit access to invoices (Manager and above by default). The automatic reminder needs nobody: it runs on its own." },
        ],
      },
    ],
    faq: [
      { q: "Will the reminder keep emailing every day?", a: "No. Each rule emails each invoice once. For a second nudge, add a second rule with a longer delay." },
      { q: "Can the client unsubscribe from overdue reminders?", a: "No. A reminder about a bill they owe is transactional, so it carries no unsubscribe link. Only the job-completed follow-up, which is marketing, does." },
      { q: "The invoice has no due date. Will it be chased?", a: "Not automatically — the rule keys off the due date, and the dashboard says “No due date on this invoice — it is not overdue”. You can still chase it by hand." },
    ],
  },
};
