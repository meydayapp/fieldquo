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
};
