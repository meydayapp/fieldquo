// content/help/en/invoices-and-payments-1.js
//
// Part 1 of the “invoices-and-payments” category in English (see the
// composer, invoices-and-payments.js): the Invoices list, raising an invoice,
// why it looks like the quote, sending it, amending it, recording a payment
// by hand, how a client pays online, and the Stripe connection.
//
// Every sentence is read off app/app/invoices/**, app/api/invoices/**,
// app/api/payments/route.js, lib/invoices/*, lib/email/invoiceEmail.js,
// app/app/settings/payments/page.js, app/api/stripe/connect/** and
// lib/stripe/connectAccount.js. Screen words are the `en` strings of
// app/i18n/appMessages.js.
export const ARTICLES = {
  "the-invoices-list": {
    title: "The Invoices list",
    summary:
      "Every invoice your company has raised, what is still owed, what is past due, and how to find one fast.",
    updated: "2026-09-12",
    intro: [
      "**Invoices** is the money screen: three tiles that say where you stand, then every invoice with its status, its client, its due date and what is still owing on it. It is the page to open when someone asks “have they paid?”.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Open **Invoices** in the sidebar under **Work**. The heading reads **Invoices — Track payments and billing.** and the **New Invoice** button sits top right. The tiles sum the same per-invoice figures the rows print, so a half-paid invoice counts its remaining balance in **Outstanding**, not its face value." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Outstanding** — the total still owed across every invoice. When some of it is late, a red line adds **“… of that is past due.”**",
            "**Paid** — everything received, including partial payments on invoices that are not settled yet.",
            "**Total Billed** — the face value of every invoice, paid or not.",
            "**Search invoices...** — filters the list by invoice number or client name as you type.",
            "One row per invoice: the number (INV-2026-0008), a status chip, the client, **Due …** with the due date, and on the right the balance owing — or **Paid in full** in green with the invoice total underneath.",
          ] },
          { figure: "harness:invoices", caption: "Invoices — the three tiles, the search box, and rows for a sent invoice, a paid one and one 12 days past due." },
          { p: "Lateness is measured from the due date every time the list loads: an invoice due yesterday reads **1 days past due** in red this morning without anyone touching it. A draft is never late — it was never billed to anyone — and an invoice with no due date is not late either; it simply has no due date." },
        ],
      },
      {
        id: "statuses",
        heading: "The status chips",
        blocks: [
          { table: {
            head: ["Chip", "What it means"],
            rows: [
              ["**Draft**", "Saved, never emailed. The client has not seen it. Only drafts can be deleted."],
              ["**Sent**", "Emailed to the client at least once, with a balance still owing. Stays **Sent** through partial payments."],
              ["**Paid**", "Nothing owing and at least one payment received — online or recorded by hand."],
              ["**Overdue**", "Past its due date with a balance owing. The red **days past due** line under the client name is measured from the due date on every load, whatever the chip says."],
              ["**Refunded** / **Partially refunded**", "Money went back to the client through Stripe. Amber, not red — you did this, there is nothing to chase."],
              ["**Disputed**", "A client's bank has opened a chargeback. Red, because the window to send evidence is closing — see [[disputes-and-chargebacks|Disputes and chargebacks]]."],
            ],
          } },
        ],
      },
      {
        id: "find-an-invoice",
        heading: "How to find an invoice",
        blocks: [
          { steps: [
            "Type part of the number or the client's name into **Search invoices...**. The list narrows as you type; **No invoices match your search.** means nothing did.",
            "Press the row. The invoice opens with its banners (unsent, overdue, partly paid), the document as the client sees it, the **Payment History** and the job behind it.",
            "To see only one client's invoices, open the client's record instead — it lists their quotes, jobs and invoices together.",
          ] },
          { tip: "The list shows the current version of an amended invoice, with a balance re-derived from every payment across all its versions. You never have to add up v1 and v2 yourself." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone whose access level includes invoices at **View only** or higher: the **Estimator**, **Dispatcher** and **Manager** presets, administrators and the owner. The **Crew** preset has no invoices at all and gets a “no access” panel instead of an empty list — an empty list would say “you have none”, which is a different and untrue statement." },
          { p: "A person whose access has the **See prices** switch off still sees the rows, but every money figure on this screen is an em dash. FieldQuo does not print “$0.00 outstanding” over a book it was told not to price." },
        ],
      },
    ],
    faq: [
      { q: "Why does a row show less than the invoice total?", a: "The right-hand figure is what is still owed, with **Paid …** underneath when part has been received. The Outstanding tile adds up exactly those figures, so the column and the tile always agree." },
      { q: "Why is there no red line on an invoice I know is late?", a: "It has no due date, or it is still a draft. Set a due date when you create or edit the invoice; a draft is not late because it was never sent." },
      { q: "Can I export this list?", a: "Not from this screen. The bookkeeping export under **Expenses** produces CSV files for a date range — see [[the-accounting-export|The accounting export]]." },
    ],
  },

  "create-an-invoice": {
    title: "Create an invoice",
    summary:
      "Three ways an invoice comes into being — automatically when a quote is approved, by hand from an approved quote, or standalone from New Invoice — and what the New Invoice screen asks for.",
    updated: "2026-09-12",
    intro: [
      "Most invoices in FieldQuo are never typed. When a client approves a quote, the invoice is built from that quote in the same moment, with the same line items, the same tax decision and the same number. **New Invoice** exists for the rest: the callout nobody quoted, the extra visit, the one-off.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "There is one invoice per job. An approved quote produces exactly one invoice, and a second approval (or a second press of the button) returns the one that already exists rather than making a duplicate the client would dispute. Stage payments — a deposit, a balance on installation — are requested in shares against that one invoice, never as several; see [[deposits-and-payment-schedules|Deposits and payment schedules]]." },
          { p: "The number follows the quote: **Q-2026-0008** bills as **INV-2026-0008**, so the pair reads at a glance. An invoice raised on its own has no number to borrow and takes the next in the sequence." },
        ],
      },
      {
        id: "from-an-approved-quote",
        heading: "From an approved quote",
        blocks: [
          { steps: [
            "When the client approves online, nothing to do: the job, the draft invoice and the follow-up task are created for you. Open **Quotes**, then the quote — a blue line reads **Already converted to invoice** with the invoice number as a link.",
            "If the client said yes on the phone instead, open the quote, press **Get approved**, then **They approved it**. The same things are set in motion, invoice included, and the Activity Log records “invoice INV-… drafted”.",
            "An accepted quote that somehow has no invoice — accepted before this existed, or a hiccup on the day — shows **Convert to Invoice** on the quote page. It builds the same invoice; pressing it twice returns the one that exists.",
            "The new invoice lands as a **Draft**. Open it, check it, and send it — see [[send-an-invoice|Send an invoice]].",
          ] },
          { note: "The invoice copies the quote's line items (grouped by room or scope, with any add-ons the client ticked), its subtotal, discount, tax, total, photos and language at the moment of approval. Editing the quote afterwards does not change the invoice — a signed document must keep saying what it said." },
        ],
      },
      {
        id: "a-standalone-invoice",
        heading: "A standalone invoice",
        blocks: [
          { steps: [
            "Press **New Invoice** on the Invoices list, or **Create → Invoice** in the sidebar. The heading reads **New Invoice — Create a standalone invoice.**",
            "Under **Client**, type into **Search clients...** and pick one.",
            "Under **Line Items**, fill **Description**, **Qty** and **Rate**; the **Amount** is computed. **Add line item** adds a row, the × removes one.",
            "Set a **Due Date**. Without one the invoice can never show as overdue and no reminder rule can fire on it.",
            "Add **Notes** and, if useful, **Photos & videos from the client** — carried over automatically when there is a quote.",
            "Check the **Apply tax** box and the **Tax rate**, then press **Save as Draft** or **Save & Send**.",
          ] },
          { figure: "live:app-invoices-new", caption: "New Invoice — Client, Line Items, the internal Cost & margin panel, Due Date, Notes, photos and the tax block, with Save as Draft and Save & Send docked at the bottom." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**Apply tax** on or off is stored as a decision. Off writes “no tax” onto the document; on with a rate charges it. On with nothing worked out prints **Not worked out** in amber, and the send is refused until you fix the client's address or say there is genuinely no tax.",
            "**Tax rate** is seeded from the client's province or state. When the client's record cannot answer, the page assumes your own province and says so in amber — pick a client with an address on file and the real rate applies instead. Typing in the box overrides the guess.",
            "**Cost & margin (internal — never shown to the client)** — crew hours, materials and overhead against this invoice. It only renders for people with the **Job costing** switch, and nothing in it reaches the document. See [[job-costing|Job costing]].",
            "**Save as Draft** creates the invoice and stops. **Save & Send** creates it, then emails it; if the email fails (no address on file, no plan yet) the invoice is still saved as a draft and the page tells you why.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can do it",
        blocks: [
          { p: "Creating an invoice needs invoices at **View, create & edit** and the **See prices** switch: the **Dispatcher** and **Manager** presets, administrators and the owner. **Convert to Invoice** additionally needs the same level on quotes. An **Estimator** sees invoices but cannot raise one; **Crew** never sees them." },
        ],
      },
    ],
    faq: [
      { q: "The quote is approved but there is no invoice. Why?", a: "Open the quote and look for **Convert to Invoice** — it only appears on an accepted quote without one, and it builds the invoice on the spot. A past job entered through the import is the one exception: it arrives already invoiced and paid, and nothing is sent about it." },
      { q: "Can I invoice a job in two halves?", a: "Not as two invoices — FieldQuo raises one per job. Set a payment schedule in **Company Settings** and the deposit and balance are requested in stages against that single invoice." },
      { q: "Where does the invoice number come from?", a: "From the quote it bills, when there is one: Q-2026-0008 becomes INV-2026-0008. A standalone invoice takes the next free number in the year's sequence. A revised invoice keeps its number and gains a version." },
    ],
  },

  "invoices-mirror-quotes": {
    title: "Invoices mirror quotes",
    summary:
      "Why the invoice a client receives looks like the quote they approved — same sections, same brand, same wording — and what an invoice deliberately leaves out.",
    updated: "2026-09-12",
    intro: [
      "A homeowner who approved a quote should recognise the invoice as its twin. In FieldQuo that is not a styling choice made twice; the quote and the invoice are rendered from the same shared sections, with the same colour maths and the same trade wording, so the two cannot drift apart.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every client-facing document — the quote PDF, the invoice PDF, the covering emails and the portal copies — is assembled from one library of sections: header, client details, line items grouped by scope, totals, payment summary, payment terms, how the work runs, notes, signature block and footer. Each section knows how to draw itself as PDF and as email, so an invoice's totals block is the quote's totals block with a different number in it." },
          { p: "The colours come from your one brand colour, measured for contrast rather than guessed — see [[set-up-your-branding|Set up your branding]]. The money comes from the invoice itself; the trade content — what is included, what could change the price, the process — comes from the quote it was built from." },
        ],
      },
      {
        id: "what-carries-over",
        heading: "What carries over from the quote",
        blocks: [
          { bullets: [
            "**The scope, by trade** — one card per service, labelled the way the quote grouped it (“Kitchen: cabinet install”), with any add-ons the client ticked as their own lines.",
            "**What this invoice says** — the “what's included” and “what could change the price” sentences the client already read on the quote, resolved from the same trade content.",
            "**How the work runs** — the process steps with their timelines, and the process notes, marked as either written on the quote or your company default.",
            "**Payment terms** — your company's terms from **Company Settings**, shown as milestones when they parse as a schedule and verbatim when they do not.",
            "**Photos**, the client's **language**, and the tax decision — an invoice from a quote raised without tax is an invoice without tax.",
          ] },
          { note: "The money is copied, not linked. Editing the quote after approval changes nothing on the invoice, and editing the invoice changes nothing on the quote. Each document keeps saying what it said when the client read it." },
        ],
      },
      {
        id: "what-an-invoice-leaves-out",
        heading: "What an invoice deliberately leaves out",
        blocks: [
          { p: "The default invoice PDF is header, client details, line items, totals, **Payment History**, notes and footer. Three sections a quote carries are dropped on purpose: no process steps (the work is done), no signature block (there is nothing left to accept), and no payment schedule (the schedule already happened — what is owed now is the balance)." },
          { p: "In their place the invoice leads with the **balance**, not the total. On an invoice with a deposit already paid, the email and the portal headline what is still owed and list the payments received underneath, because a total the client has partly settled reads like being billed twice." },
        ],
      },
      {
        id: "on-the-invoice-page",
        heading: "What you see on the invoice page",
        blocks: [
          { p: "Open any invoice and the framed article in the middle is the client's document, in your colour: letterhead, **Invoice** and its number (with **v2** once it has been amended), **Prepared for**, the date, the due date, **From quote** with a link, the scope cards, **What this invoice says**, **How the work runs**, **Terms explained**, notes, photos, the totals band and **Payment terms**. Everything outside the frame — the banners, the buttons, the job, the cost panel — is yours and never reaches the client." },
          { tip: "**Settings → PDF Templates** has two cards, **Quote PDF** and **Invoice PDF**, each with its layouts and the sections they carry. Reordering or removing a section there changes what the client receives; the on-screen mirror follows the same data. See [[the-quote-pdf|The quote PDF]]." },
        ],
      },
    ],
    faq: [
      { q: "The client says the invoice does not match the quote. Where do I look?", a: "Open the invoice and compare the scope cards with the quote's. The invoice carries the accepted total — the figure on the page the client pressed Approve on, add-ons included — so a difference is almost always an add-on they ticked or a change made on the quote after approval." },
      { q: "Can the invoice show a signature line?", a: "No. The **Signature block** is a quote-only section — the template editor does not offer it on an Invoice PDF layout, because the approval already happened and there is nothing left to sign." },
    ],
  },

  "send-an-invoice": {
    title: "Send an invoice",
    summary:
      "What happens when you press Send: the email the client gets, the link inside it, the follow-up task, and why a send can be refused.",
    updated: "2026-09-12",
    intro: [
      "**Send** emails the invoice to the client's address on file, from your company name, in the client's language, with a button that opens the invoice in their portal and — once Stripe is connected — lets them pay. The status only becomes **Sent** after the email service accepts the message, so **Emailed** on the invoice is an event, not an intention.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Nothing is attached. The email links to the invoice's own page in the client portal, which shows what is owed and what has been paid, and mints a fresh checkout at the moment the client presses **Pay** — a raw Stripe link would expire overnight and an attached PDF cannot take a payment. The **Download PDF** button on the invoice is there when a client asks for a file." },
        ],
      },
      {
        id: "how-to-send",
        heading: "How to send it",
        blocks: [
          { steps: [
            "Open the invoice. On a draft, the banner reads **This invoice has not been sent to the client yet.** with **Send it** beside it; the **Send** button is also in the command strip.",
            "Press it. A green line confirms **Invoice emailed to** the address, and the trail card below shows **Emailed → address** with the date.",
            "A task **Follow up payment for INV-…** is created for you a week out, so a sent invoice cannot be forgotten. It closes itself when the balance is settled.",
            "Later, while anything is still owed, the same button reads **Send again** — re-sending a copy a client mislaid is routine and does not move a paid or overdue invoice back to Sent.",
          ] },
          { figure: "live:app-invoices-new", caption: "New Invoice — Save & Send at the bottom creates the invoice and sends it in one go; the helper reads “Emails the invoice to the client’s email on file.”" },
        ],
      },
      {
        id: "the-email",
        heading: "The email the client receives",
        blocks: [
          { bullets: [
            "**Subject:** “Invoice INV-2026-0008 from Your Company — $2,260.00 due”. The figure is the balance, not the total: after a deposit the intro says so and thanks them for it.",
            "**From:** your company name. From your own domain once it is verified under **Settings → Email Domain**; otherwise from FieldQuo's sender with your name on it. Replies go to your company email.",
            "**Amount due** and **Due …** — or **Was due …** in red once the date has passed.",
            "**Pay online** when Stripe is connected and enabled; otherwise **View your invoice** and the line “Please get in touch to arrange payment.” — a Pay button that leads to a dead end is worse than none.",
            "The language is the invoice's own, fixed when it was created; a client who received a French quote gets a French invoice.",
          ] },
        ],
      },
      {
        id: "when-a-send-is-refused",
        heading: "When a send is refused",
        blocks: [
          { bullets: [
            "**No email on file** — the banner reads **… has no email address on file, so this invoice cannot be sent or chased.** Add one on the client record and try again.",
            "**This says tax applies, but charges none** — the invoice claims tax and charges $0. The dialog offers **Set … 's location** to work the rate out, or **Or: there's genuinely no tax on this one** to send without tax.",
            "**No plan yet** — sending is the outward act that needs an active trial or plan. Drafting never does; see [[your-plan-and-seats|Your plan and seats]].",
            "**A past job** entered through the import — it was paid before it was typed in, and FieldQuo sends nothing about it.",
          ] },
          { note: "**Request Payment** is the other email. It goes out from the same address with the same link, framed as a reminder (“A reminder that invoice … has a balance of …”), with room for a note of your own. See [[invoice-reminders-and-chasing|Invoice reminders and chasing]]." },
        ],
      },
      {
        id: "who-can-send",
        heading: "Who can send",
        blocks: [
          { p: "Invoices at **View, create & edit** — the **Dispatcher** and **Manager** presets, administrators and the owner. Every send is written to the **Activity Log** as “Sent invoice INV-… to …”." },
        ],
      },
    ],
    faq: [
      { q: "The client says they never got it.", a: "Open the invoice: the trail card shows **Emailed → address** and the date only if the email service accepted it. Check the address on the client record, then **Send again**. If your own domain is set up but unverified, sends fail with a message saying so." },
      { q: "Does the client need an account?", a: "No. The link in the email is their portal, keyed to a private token — no password, no sign-up, works on a phone." },
      { q: "Can I send it by text instead?", a: "Not today. FieldQuo emails invoices; the client texts it sends are the appointment reminder and “On my way”." },
    ],
  },

  "edit-an-invoice-after-sending": {
    title: "Edit an invoice after it was sent",
    summary:
      "A draft is edited in place; a sent invoice becomes a new version with a reason, and the old one is kept — so nobody has to guess what was agreed.",
    updated: "2026-09-12",
    intro: [
      "Once an invoice has left the office, changing it silently would rewrite what a client already read. FieldQuo keeps the sent one on file and writes your changes as **version 2**, with the reason you typed stored beside it. The client sees the version you send them; you see both, and the money already paid follows the invoice, not the snapshot.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Edit** appears on an invoice in **Draft** or **Sent**. A draft edits in place — nothing has been sent, so there is nothing to preserve. A sent invoice opens the same editor with a yellow warning: **This invoice has already been sent, so saving creates version 2 rather than overwriting it. The current version stays on file.**" },
          { p: "Paid, refunded and disputed invoices have no Edit button. What was paid was paid against a document; the record of that document stays as it was." },
        ],
      },
      {
        id: "how-to-amend",
        heading: "How to amend a sent invoice",
        blocks: [
          { steps: [
            "Open the invoice and press **Edit**. The heading reads **Edit INV-2026-0008**, with **· version 2** once it has been amended before.",
            "Change the **Line items**, the **Discount**, **Apply tax** and its **Tax rate (%)**, the **Due date**, the notes or the photos. The totals recompute as you go.",
            "Fill **Reason for this change** — for example “Client added a second bathroom”. It is required on a sent invoice and is stored with the version so anyone reading the history later knows what happened.",
            "Press **Save as new version**. You land on the new invoice, same number, **v2** beside it.",
            "Send the new version — the client has the old one until you do.",
          ] },
          { note: "If money has already been received, the editor says so: **$… has already been paid against this invoice. Lowering the total below that leaves a credit you'll need to settle with the client.** FieldQuo does not refund automatically." },
        ],
      },
      {
        id: "what-the-new-version-carries",
        heading: "What the new version carries",
        blocks: [
          { bullets: [
            "The same **invoice number**, the same client, the same quote link and the same language.",
            "Every **payment** in the family. The balance on v2 is re-derived from all payments against v2's total, so a $200 deposit taken on v1 is still $200 paid on v2 — and the client portal offers only the current version.",
            "The **photos** and the **Cost & margin** panel, copied forward rather than dropped.",
            "The **change log**: who, when, and the reason.",
          ] },
          { p: "The old version gets one banner and nothing else: **This is version 1. Version 2 replaced it — that is the one your client has.** with **Open the current version**. Every action — send, chase, record a payment — is hidden there, because those belong to the invoice that replaced it." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Who can edit",
        blocks: [
          { p: "Editing needs invoices at **View, create & edit** and the **See prices** switch — **Dispatcher**, **Manager**, administrators and the owner. Deleting is a different thing: only a **Draft** can be deleted, and only by someone with **View, create, edit & delete** (the **Manager** preset, administrators, the owner). The trash icon is hidden from everyone else rather than greyed out." },
        ],
      },
    ],
    faq: [
      { q: "Can I just fix a typo without making a version?", a: "On a draft, yes — Save changes edits in place. On a sent invoice, no: even a one-word change is version 2 with a reason. That is the point; the reason can be “Fixed the spelling of the street”." },
      { q: "Which version does the list show?", a: "The current one, with a balance computed across every payment in the family. Opening it shows **v2** in the document header." },
      { q: "Can I delete a sent invoice I raised by mistake?", a: "No — only drafts can be deleted. Amend it to a zero total with the reason, or refund what was paid; either way the record of what was sent stays." },
    ],
  },

  "record-a-manual-payment": {
    title: "Record a cash, cheque or e-transfer payment",
    summary:
      "How to log a payment that did not go through Stripe, what it does to the invoice, and why it carries no fee.",
    updated: "2026-09-12",
    intro: [
      "Not every client pays by card. When the money arrived by e-transfer, cheque or cash, you record it on the invoice yourself so the balance, the tiles, the dashboard and the reminders all know. A recorded payment is a real payment: the invoice goes to **Paid** the moment the balance reaches zero and the follow-up task closes itself.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Record Payment** is the green button on any invoice with a balance owing. It records against the current version of the invoice, checks the amount against what is still owed, and refuses a duplicate typed twice in quick succession. It sends nothing to the client and nobody in your team — you are on the page doing it, so a notification would be noise." },
        ],
      },
      {
        id: "how-to-record",
        heading: "How to record a payment",
        blocks: [
          { steps: [
            "Open the invoice and press **Record Payment**.",
            "Type the amount. The placeholder shows the ceiling: **Amount (up to $2,260.00)**. A figure above the balance is refused with “That's more than the … still owing on this invoice.”",
            "Pick the method: **Cash**, **E-Transfer** or **Cheque**.",
            "Add **Notes (optional)** — the cheque number, the e-transfer reference.",
            "Press **Record**. The totals update, the banner reads **Paid in full — $2,260.00 received.** if that settled it, and the row appears under **Payment History** with today's date and the method.",
          ] },
          { note: "A partial payment is fine. The invoice stays **Sent**, the banner reads **$500.00 of $2,260.00 received. $1,760.00 still owing.** with **Chase payment** beside it, and the list shows the balance with **Paid $500.00** underneath." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "What it changes",
        blocks: [
          { bullets: [
            "**The balance** — recomputed from every payment on the invoice family, netting any refund or dispute already recorded.",
            "**The status** — **Paid** when nothing is owed and something was received; the paid date is stamped then.",
            "**The follow-up task** — “Follow up payment for INV-…” is resolved once the balance is settled.",
            "**The Activity Log** — “Recorded a cash payment of 500 on invoice INV-…”.",
            "**No fee** — a manual payment shows no processing fee and no net deposited; the export leaves those cells blank rather than writing 0.00. See [[payment-processing-fees-and-payouts|Payment processing fees and payouts]].",
          ] },
          { warning: "There is no undo on a recorded payment from this screen. Type the amount from the bank statement, not from memory, and use the notes field for the reference." },
        ],
      },
      {
        id: "who-can-record",
        heading: "Who can record a payment",
        blocks: [
          { p: "Recording a payment needs the **Collect payments** switch, not just the invoices level. In the presets that is the **Manager**, administrators and the owner. A **Dispatcher** can raise and send invoices but the server refuses their payment with a “collect payments” message — the button is on the page, the API is the control." },
        ],
      },
    ],
    faq: [
      { q: "The client paid a visit fee when they booked. Can I credit it?", a: "Yes. When a booking fee has been paid, the invoice shows a **Visit fee credit** card with **Credit to invoice**; it appears in Payment History as a visit fee credit and reduces the balance. See [[booking-fees-and-visit-deposits|Booking fees and visit deposits]]." },
      { q: "Can I record a card payment I took on my own terminal?", a: "Not from this dialog — it offers cash, e-transfer and cheque. Card payments through FieldQuo go through Stripe and record themselves; a card taken elsewhere is a method the past-jobs import uses, not this screen." },
      { q: "Does the client get a receipt?", a: "Not for a manual payment. If they want one, **Send again** emails the invoice with the payment listed and the balance at zero." },
    ],
  },

  "how-clients-pay-online": {
    title: "How clients pay online",
    summary:
      "The path from the Pay button in the email to money in your bank: the portal, Stripe Checkout, what the client can pay with, and what FieldQuo records when the payment lands.",
    updated: "2026-09-12",
    intro: [
      "Once Stripe is connected and enabled, every invoice email carries **Pay online**. The client lands on their portal, sees the balance in your brand colour, presses **Pay $2,260.00** — **Pay $2,260.00 by card** or **Pay $2,260.00 from bank account** when your Stripe account can take bank payments — and pays on Stripe's hosted checkout page. FieldQuo never sees the card, never holds the money, and records the payment the moment Stripe confirms it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The client needs no account and no password. The link in the email is their portal, keyed to a private token, and the invoice page on it shows the same document you see — scope, totals, payments received, terms — with one big figure: **Balance due**, or the stage label when a payment schedule is asking for a share. A settled invoice reads **Paid in full** and offers no button." },
          { p: "The charge is created in your company's name, so your name is on the client's card statement, and the money settles into your Stripe account and then your bank. See [[payment-processing-fees-and-payouts|Payment processing fees and payouts]] for what comes off each payment." },
        ],
      },
      {
        id: "the-clients-steps",
        heading: "What the client does",
        blocks: [
          { steps: [
            "Opens the invoice email and presses **Pay online** (or, in the portal, opens the invoice from the list).",
            "Checks the figure — the balance, or the stage being requested (a deposit, an instalment) — and presses **Pay … by card**, or **Pay … from bank account** when that second button is there.",
            "Pays on Stripe Checkout: card, plus **Affirm** pay-over-time when you have switched it on and the amount is between $50 and $30,000 in CAD or USD. A bank payment is a one-off pre-authorized debit (Canada) or ACH debit (US) on Stripe's page, which verifies the account automatically where the bank supports it.",
            "Returns to the portal. A card payment shows as received at once, with the new balance; a bank payment reads **Bank payment pending** for 3–5 business days and then paid — or **Bank payment failed**, with Stripe's reason, the balance still owing and the card button still offered.",
          ] },
          { note: "**Pay from bank account** appears only once Stripe has activated bank debit on your account — FieldQuo requests it when you connect, and **Settings → Payments** says which is the case (**Clients can pay invoices by card or from a bank account**). Booking fees stay card-only. Service plans keep their standing mandate, signed once — see [[service-plan-bank-debit-mandates|Service plans paid by bank debit]]. The offline methods printed as **Accepted:** on the invoice — cash, e-transfer, cheque — are ticked under **Settings → Payments → Payment methods you accept**." },
        ],
      },
      {
        id: "what-fieldquo-records",
        heading: "What FieldQuo records when the payment lands",
        blocks: [
          { bullets: [
            "**A payment row** with the date, the method (**Card**, or the bank debit), the amount, and underneath it **card processing $68.10 · deposited $2,191.90** — for a $5,000 bank payment, **bank debit processing $5.00 · deposited $4,995.00**.",
            "**The balance and status** — recomputed across every payment; **Paid** when nothing is left, with a paid date and **via Stripe** on the banner.",
            "**A notification** — **Invoice paid** emails everyone with an owner or admin role, on by default under **Settings → Notifications**.",
            "**The follow-up task** closes, and the dashboard's **Money owed** and receivables ladder drop the invoice.",
            "**Idempotence** — Stripe can deliver the same confirmation twice; the second is ignored, so a payment is never recorded twice.",
          ] },
        ],
      },
      {
        id: "when-there-is-no-pay-button",
        heading: "When there is no Pay button",
        blocks: [
          { p: "If Stripe is not connected, or is connected but has not enabled charges yet, the email says **View your invoice** instead, and the portal shows “Please get in touch to arrange payment.” where the button would be. The invoice page warns you too: **Stripe isn't connected yet, so the email asks them to contact you instead of offering a card payment. Finish setup in Settings → Payments.** See [[connect-stripe-and-get-verified|Connecting Stripe and getting verified]]." },
          { p: "A checkout is minted for the amount owed at the moment the client presses Pay, capped at the real balance — so a client who opens an old email after a partial payment is asked for the remainder, never the original figure. An invoice with nothing owing refuses to start a checkout at all." },
        ],
      },
    ],
    faq: [
      { q: "Can the client pay part of the invoice?", a: "Only when a payment schedule is asking for a stage — the Pay button then requests that share. Otherwise the button asks for the full balance. A partial payment you receive another way is recorded by hand." },
      { q: "Does FieldQuo take a cut?", a: "The processing fee is 3% + 30¢ on a card payment and 1% + 40¢ capped at $5 on a Canadian bank debit, deducted before the money reaches your bank and shown on the payment row. Nothing else, and no monthly fee." },
      { q: "The client paid but the invoice still says Sent.", a: "Stripe confirms a card charge to FieldQuo a few seconds after checkout. A bank payment is different: the invoice shows a bank payment pending for 3–5 business days, and that is normal. If a card payment stays unpaid, check the Stripe dashboard via **Manage in Stripe** — a payment that is there but not here is something to tell support, with the invoice number." },
      { q: "Can they pay from the quote instead?", a: "Deposits on a quote are their own flow — see [[deposits-on-quotes|Deposits on quotes]]. The invoice is what the balance is paid against." },
    ],
  },

  "connect-stripe-and-get-verified": {
    title: "Connecting Stripe and getting verified",
    summary:
      "Settings → Payments, step by step: Connect with Stripe, what the page shows while Stripe checks your details, and what Active, Paused and Held mean for your money.",
    updated: "2026-09-12",
    intro: [
      "Online payments run through a Stripe account held in your company's name. **Settings → Payments** creates it, sends you to Stripe's own secure pages to fill it in, and then tells you — in plain words — whether Stripe is taking cards for you yet and whether it is paying out to your bank. FieldQuo never sees or stores your bank details; that information goes directly to Stripe.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page heading reads **Payments — Connect Stripe so your clients can pay invoices online, directly to your bank account.** The first card is the connection itself, in one of four states: not connected, in progress, under review, or **Stripe connected · Active**. Below it sit the **Processing fees** card, the **Instant payout** card, **Your Stripe account** and the **Offer pay-over-time (Affirm)** switch." },
        ],
      },
      {
        id: "how-to-connect",
        heading: "How to connect",
        blocks: [
          { steps: [
            "Open **Settings → Payments**. The card reads **Not connected yet — Stripe handles the actual payment processing — you'll enter your bank details on Stripe's own secure page, not here.**",
            "Press **Connect with Stripe**. FieldQuo creates an Express account for your company and sends you to Stripe's onboarding.",
            "Fill in what Stripe asks for — business details, identity, a bank account for payouts — and accept Stripe's terms. See [[what-stripe-asks-for-and-why|What Stripe asks for, and why]].",
            "You return to **Settings → Payments**, which re-reads the account from Stripe. If you left partway, the card reads **Stripe still needs a few things** and lists them, with **Finish Setup** and **I've already done this**.",
            "Once everything is in, the card reads **Stripe is reviewing your details** with **Check again**. When Stripe switches charges on, it becomes **Stripe connected · Active** and every invoice email gains a **Pay online** button.",
          ] },
          { figure: "harness:settings-payments", caption: "Settings → Payments once verified — Stripe connected · Active, Manage in Stripe, Disconnect, and Your Stripe account with both switches On and nothing outstanding." },
        ],
      },
      {
        id: "the-two-switches",
        heading: "Taking payments and being paid are two switches",
        blocks: [
          { p: "**Your Stripe account** shows **What Stripe has switched on**: **Taking card payments: On/Off** and **Paying out to your bank: On/Paused**. They are separate. Stripe can keep accepting your clients' cards while payouts are paused — the money is collected and held by Stripe, not lost." },
          { figure: "live:app-settings-payments", caption: "Settings → Payments with payouts paused — the amber “Stripe is reviewing your account” notice, payouts Paused, and “What Stripe is still waiting for: Nothing from you.”" },
          { table: {
            head: ["What the page says", "What is happening", "What to do"],
            rows: [
              ["**Stripe is reviewing your account**", "You sent everything; Stripe is checking it. Payouts are paused, usually a day, sometimes two or three. Clients' payments keep going through.", "Nothing. Sending documents again will not make it faster."],
              ["**Stripe is holding your money**", "Charges are on but payouts are off because Stripe still needs something from you. **Stripe's reason:** is printed underneath in plain words.", "Press **Manage in Stripe** and finish what it asks for. See [[payouts-held-or-under-review|Payouts held or under review]]."],
              ["**Stripe still needs a few things**", "Onboarding is unfinished; charges are off, so no Pay button yet.", "**Finish Setup**, or **I've already done this** if you completed it on Stripe's side and FieldQuo has not caught up."],
            ],
          } },
        ],
      },
      {
        id: "the-other-controls",
        heading: "The other controls on the page",
        blocks: [
          { bullets: [
            "**Manage in Stripe** opens your Express dashboard in a new tab: payouts, documents, bank details, support. Stripe emails a sign-in code to the **Sign-in email** shown on the page.",
            "**Copy** beside the **Stripe account ID** (it starts with acct_) — what Stripe uses to find your account when you contact them. Shown to the owner only.",
            "**Disconnect** unlinks Stripe from FieldQuo: clients cannot pay online until you reconnect. It does not delete or close your Stripe account and changes nothing about your past payout history.",
            "**Offer pay-over-time (Affirm)** lets clients split an invoice at checkout while you are paid in full up front. Available on invoices between $50 and $30,000 in USD or CAD, and you must first activate Affirm in your Stripe dashboard — see [[pay-over-time-financing|Pay-over-time financing]].",
            "**Processing fees** and **Instant payout** are explained in [[payment-processing-fees-and-payouts|Payment processing fees and payouts]] and [[instant-payouts|Instant payouts]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "**Settings → Payments** is for the owner and administrators only — the row is hidden from everyone else and the routes behind it refuse them. The account ID and sign-in email are narrower still: the owner only, because they are the pair of values that let someone tell Stripe “this account is mine”." },
        ],
      },
    ],
    faq: [
      { q: "How long does verification take?", a: "Usually minutes, occasionally a day or two. The page says **Stripe is reviewing your details** while it happens; **Check again** re-reads the account." },
      { q: "I already have a Stripe account. Can I use it?", a: "Not today. FieldQuo creates an Express account for the company and links that one; there is no way to attach an existing account." },
      { q: "Clients are paying but nothing reaches my bank.", a: "Look at **Paying out to your bank** on this page. **Paused** with a review notice means wait; **Paused** with **Stripe is holding your money** means open **Manage in Stripe** and finish what it lists." },
    ],
  },

  "what-stripe-asks-for-and-why": {
    title: "What Stripe asks for, and why",
    summary:
      "The documents and details Stripe requires before it will pay out, in the words FieldQuo uses on the Payments page, and what each of Stripe's restriction reasons means.",
    updated: "2026-09-12",
    intro: [
      "Before Stripe moves money to a bank account it has to know whose business it is, who owns it, and where the money is going — the same checks a bank runs when you open an account. Stripe's own names for these are machine keys like “company.verification.document”; **Settings → Payments** translates each one into a sentence, so **What Stripe is still waiting for** is a list you can act on.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The list on the Payments page combines what Stripe says is **currently due** and what is **past due**. Anything Stripe is still verifying is left off on purpose — telling you to “provide more information” while Stripe reviews what you already sent is how people submit the same document four times. When there is a deadline, the page prints **Stripe's deadline: date**; most accounts have none, and FieldQuo never invents one." },
          { figure: "live:app-settings-payments", caption: "Your Stripe account — the account ID, the sign-in email, the two switches, and “What Stripe is still waiting for”." },
        ],
      },
      {
        id: "what-it-asks-for",
        heading: "What it asks for",
        blocks: [
          { table: {
            head: ["What the page says", "Why Stripe wants it"],
            rows: [
              ["A bank account for payouts", "Where the money goes. Without one Stripe can take payments and hold them, but never pay out."],
              ["Accepting Stripe's terms of service", "The account is yours, under Stripe's agreement, not FieldQuo's."],
              ["A photo of your ID / A second piece of ID", "Identity of the person opening the account — the standard know-your-customer check."],
              ["Your business number (BN)", "The tax identity of the business the money is paid to."],
              ["A document verifying the business (incorporation papers, CRA notice, or a registry search result)", "Proof the company exists and matches the name on the account."],
              ["Confirmation that you've listed every director / everyone owning 25% or more / executives", "Regulators require the people behind a business to be named."],
              ["Your industry / A description of what you sell / A business website or product description", "What the charges on your clients' cards are for. A website is optional — a description is enough."],
              ["A customer support phone number", "What appears beside your name on a client's card statement, so a cardholder can ring you instead of disputing the charge."],
            ],
          } },
          { note: "A line beginning **A director or owner:** is a requirement about a specific person Stripe has on file — usually their ID or address — rather than about the company." },
        ],
      },
      {
        id: "stripes-reasons",
        heading: "Stripe's reasons, in plain words",
        blocks: [
          { p: "When Stripe restricts an account it attaches a reason. The Payments page prints it under **Stripe's reason:** or beneath the held-payouts notice, translated from Stripe's key:" },
          { bullets: [
            "**Stripe is waiting on information that is now overdue.** — something on the list passed its deadline. Finish it in **Manage in Stripe**.",
            "**Stripe is still checking what you sent. There is nothing to do.** — verification in progress.",
            "**Stripe is reviewing the account.** / **Stripe is reviewing a possible sanctions-list match.** — a manual review on Stripe's side. Wait, or ask Stripe from inside your dashboard.",
            "**Stripe closed the account …** for suspected fraud, a terms of service violation, or a sanctions-list match — decisions only Stripe can revisit, from inside your dashboard.",
            "**FieldQuo paused this account.** — rare, and support will have contacted you.",
            "**Stripe has restricted the account and hasn't said why.** — Stripe gave no reason; ask them, quoting your account ID.",
          ] },
        ],
      },
      {
        id: "where-to-settle-it",
        heading: "Where to settle it",
        blocks: [
          { steps: [
            "Open **Settings → Payments** and read **What Stripe is still waiting for**.",
            "Press **Manage in Stripe** (or **Finish Setup** while onboarding is unfinished). Stripe's dashboard collects the outstanding items in a banner and takes you to each one.",
            "Come back and press **Check again** or **I've already done this**. FieldQuo re-reads the account and updates the switches.",
            "If the dashboard genuinely cannot settle it, Stripe's support is reached from inside that dashboard once you are signed in. Give them the **Stripe account ID** from the page — it is what identifies your account to them, not your business name and not your email.",
          ] },
          { tip: "FieldQuo support can see the same status page in read-only mode and will ask for the account ID too. It cannot upload a document or accept terms on your behalf — those are yours to do on Stripe's pages." },
        ],
      },
    ],
    faq: [
      { q: "Why does Stripe want my ID when the company is incorporated?", a: "Because a person is opening the account. Stripe verifies the representative as well as the company, and may ask for directors and owners of 25% or more separately." },
      { q: "Will my clients' payments stop while something is outstanding?", a: "Not once charges are on. **Taking card payments** and **Paying out to your bank** are separate switches; the usual effect of an outstanding item is paused payouts, with the money held safely by Stripe until it clears." },
      { q: "I sent a document and the list still shows it.", a: "The page only drops an item once Stripe marks it received. Press **Check again**; if it is now being verified, the label changes to **Nothing from you. Stripe is checking what you already sent; sending it again won't make it faster.**" },
    ],
  },
};
