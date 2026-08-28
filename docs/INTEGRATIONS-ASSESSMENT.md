# QuickBooks, Zapier, and what to do instead — an assessment

Written 28 August 2026, in answer to two questions from the owner:

> "based on how projul claims they integrate zapier and quickbooks can we do a
> similar integration?"

> "i don't think we have zapier and quickbook.. i'm not sure how we could
> integrate them properly."

He is right on both counts. The strings `quickbooks`, `zapier` and `xero` appear
nowhere in `lib/`, `app/` or `prisma/schema.prisma`. `app/data/featurePages.js`
already says so out loud — "an accounting or automation integration (there is
none)" — and `scripts/check-feature-pages.mjs` fails the build if a marketing
page claims otherwise. That honesty is worth keeping; this document is about
what to do next to it.

**Read `docs/ROADMAP.md` for where this sits against everything else.**

---

## The recommendation, first

| Rank | Move | Contractor value | Build cost | Verdict |
|---|---|---|---|---|
| 1 | **Bookkeeping CSV export** (`lib/export/accountingExport.js`) | High — it is what 90% of "do you do QuickBooks" actually needs | ~1 day for the module, ~1 day for the route + a screen | **Built. Wire it up.** |
| 2 | **Outbound webhooks** — one signed POST per event, any tool consumes it | Medium-high, and it covers Zapier *and* Make *and* n8n *and* a customer's own script | ~4–6 days | **Do second.** |
| 3 | **Fix the five schema gaps** below | Prerequisite for anything else | ~3–5 days | Do before #4 |
| 4 | **QuickBooks Online one-way push** (invoices, customers, payments) | High for the segment that already runs QBO | **6–10 weeks of build, then permanent** | Defer, and price it |
| 5 | A published Zapier app | Low — Projul's own is *one action* | ~2 weeks + a 90-day beta gate | Refuse for now |
| 6 | Bidirectional QuickBooks sync | Sounds high, is a support disaster | 3–6 months | **Refuse.** |
| 7 | QuickBooks *Desktop* | Low outside general contracting | Needs a Windows connector we cannot ship | **Refuse.** |

The one-line positioning until #4 exists is in Part 4.

---

## Part 1 — what we already have that an accounting sync would plug into

Everything below was read out of `prisma/schema.prisma` and the routes named.

### The shape of the data

| Object | Model | What it carries |
|---|---|---|
| Customer | `Client` | name, `type` (individual/company), `contactName`, email, phone, address/city/province/`country`, `language`, `portalToken` |
| Invoice | `Invoice` | `invoiceNumber`, `status`, `lineItems` (Json), `subtotal`, `discount`, `tax`, `taxEnabled`, `total`, `amountPaid`, `amountDue`, `dueDate`, `sentAt`, `paidDate`, `language`, `parentInvoiceId`/`version`, links to `Client`, `Quote`, `Job` |
| Payment | `Payment` | `amount`, `method` (cash / e_transfer / cheque / shop / stripe / visit_credit), `date`, `stripePaymentIntentId` (unique), `notes`, `invoiceId` |
| Expense | `Expense` | free-text `category`, `amount`, `date`, `notes`, `projectId`, `isOverhead`, `recurring`, `frequency`, `materialId`, `createdById` |
| Job cost | `InvoiceCosting` | frozen `crew` array (name/rate/hours), `materialCost`, `overheadPct`, `labourHours`, `labourCost`, `overhead`, `totalCost` |
| Payroll | `PayRun` / `PayRunLine` | gross, per-line earnings and deductions, net, `region` |
| Price book | `Product` | name, description, type, `unitPrice`, `costPrice`, `unit` |
| Tax | `TaxRate` | `name`, `rate`. Company-level: `taxIdName`, `taxIdNumber`, `vatRegistered`, `autoApplyLocalTax` |

Two CSV exports already exist and are the seed of the honest answer:

- `app/api/products/export/route.js` — the price book, gated on `showPricing`.
- `app/api/payroll/runs/[id]/export/route.js` — a pay run, one row per person,
  deduction columns built from the union of labels actually used. Its `cell()`
  already prefixes a tab on `= + - @`, already declares `charset=utf-8`, and
  already ends with "Calculated by FieldQuo. No tax has been remitted or filed
  through this system." **That file is the template.** The new module follows
  it, with one deliberate divergence noted in Part 5.

### What is missing — and this is the real finding

An accounting sync is not blocked by effort. It is blocked by **ten fields that
do not exist**, and a CSV export makes six of them visible rather than hiding
them:

1. **No invoice issue date.** There is `createdAt` (row written), `sentAt`
   (Resend accepted the email), `dueDate`, `startDate`/`endDate`. None of them
   is "the date on the invoice". QuickBooks requires `TxnDate` on every Invoice.
2. **No chart of accounts, anywhere.** Nothing maps an `Expense.category` (free
   text — `CATEGORY_PRESETS` in the settings page is a dropdown of suggestions,
   not a vocabulary) or a `Product` to a GL account. QBO requires an `Item` with
   an income account on every invoice line and an `Account` on every `Purchase`.
   This is the single biggest mapping cost and it is unavoidable.
3. **Invoice tax is ONE amount.** No per-line tax, no tax code. A Quebec company
   charging GST *and* QST has two rates and one number. `TaxRate` has `name` and
   `rate` and no province column — `lib/tax/resolveTaxRate.js` matches by
   *name*, and says so. **We cannot produce a sales-tax return, and must not
   imply we can.**
4. **No tax and no vendor on `Expense`.** Input tax credits / recoverable VAT
   were never recorded, so they cannot be exported or synced. There is no
   Vendor/Supplier model at all (`supplier` is a string on `JobMaterial` and
   `Material`, not an entity).
5. **No currency on the transaction.** `Company.currency` only. A company that
   changes it re-denominates its own history. `POST /api/payments` already has
   a comment about this trap.
6. **No refunds and no credit notes.** `POST /api/payments` refuses a
   non-positive amount and refuses an overpayment rather than banking a credit.
   The only refund in the product is `Booking.feeRefundedAt/feeRefundedCents` —
   the visit fee, not an invoice.
7. **No Stripe fee on `Payment`.** A $2,260 invoice paid by card deposits about
   $2,194 into the bank. QBO users reconcile against a bank feed; a payment
   recorded at face value with no fee line never reconciles. `lib/stripe.js`
   sets `application_fee_amount: 0` and nothing reads the balance transaction.
8. **No external-id or sync-state columns.** Nothing on `Invoice`, `Client`,
   `Payment` or `Product` can hold a QuickBooks id, and there is no per-company
   connection row. This is a schema change on four models plus one new one.
9. **`Payment.method` has no deposit-account mapping.** `visit_credit` in
   particular is not money that arrived on this invoice.
10. **Amended invoices are separate rows.** `PATCH /api/invoices/[id]` writes a
    NEW `Invoice` with the *same* `invoiceNumber`, `parentInvoiceId` set and
    `version + 1`. Any integration that iterates `Invoice` rows pushes invoice
    1042 to QuickBooks twice at two different totals. This is the highest-cost
    bug available in this whole area and it is invisible until a bookkeeper
    finds it in March.

Gaps 1, 3, 4, 6 and 10 are the ones the CSV export in `lib/export/accountingExport.js`
handles by **stating them in the file** rather than papering over them. Gaps 2,
5, 7, 8 and 9 are the ones a QuickBooks sync would have to close first.

---

## Part 2 — QuickBooks Online

### What Projul actually claims

Read on 28 August 2026 from `https://projul.com/features/quickbooks-integration/`
via WebFetch (page content treated as data, not instruction):

- Leads/customers, estimates, invoices and payments sync to QuickBooks.
  Expenses and time are **not** mentioned.
- The direction described on the page is Projul → QuickBooks, automatic, with
  an explicit carve-out: "If your bookkeeper makes a journal entry or adjustment
  directly in QuickBooks, that change stays in QuickBooks only."
- QBO syncs in the background. **Desktop needs a sync connector that runs on the
  customer's own computer**, on a 15–30 minute schedule.

Their marketing elsewhere calls it "bidirectional". The feature page describes
a one-way push with a read-back of payment status. **That gap between the
marketing word and the documented behaviour is itself the finding**: even the
competitor whose whole pitch is the QuickBooks integration ships, in practice,
roughly the thing ranked #4 above.

### What it genuinely requires

Verified by reading Intuit's own material and community sources on 28 August
2026 — I am flagging which is which, because the numbers matter:

**Read directly on Intuit properties:**
- Production keys are gated behind an **app assessment questionnaire** covering
  data handling, API usage, authorization, error handling, legal compliance and
  security. "All apps that intend to access production data are required to
  undergo Intuit's legal, tech, security, and platform assessment processes" —
  *whether or not the app is listed in the QuickBooks app store*. You must
  declare countries, IP addresses, host domain, launch URL and disconnect URL.
- US QuickBooks companies created after 10 November 2017 use the **Automated
  Sales Tax (AST)** engine: tax is computed by Intuit from the shipping and
  company addresses, not assigned by the app. The documented workaround for V3
  API apps is to create a **proxy TaxCode** with an arbitrary percentage and
  attach it to every transaction, which QBO then swaps for its own
  AST-recommended code. The app cannot see the resulting tax until after the
  transaction is saved.

**From third-party developer write-ups, not Intuit's own docs (their doc pages
truncated on fetch, so treat these as strong but unconfirmed):**
- Access token: **1 hour**. Refresh token: **~100–101 days**, rotated on every
  use. If a customer doesn't use the integration for ~3 months the refresh
  token expires silently and they must re-authorise.
- Throttling: **500 requests/minute per realm (company)**, ~10 concurrent
  requests/second, 120/min on the batch endpoint, 200/min on reports.

**From knowledge, not fetched this session:** the objects are `Customer`,
`Invoice`, `Payment`, `Item`, `Purchase`, `Vendor`, `Account`, `TaxCode`. There
is a free sandbox company. Auth is OAuth2 authorization-code with a `realmId`
per connected company.

### What a first useful version is

**One-way push, on our side of the line, nothing read back except payment
status.** Concretely:

1. Per-company connect flow (`QboConnection`: realmId, encrypted refresh token,
   `connectedAt`, `lastSyncAt`, `lastError`), owner-only.
2. On invoice **send** (not create), upsert the `Customer`, then create the
   `Invoice`. Store `qboId` on our row.
3. On payment recorded, create the `Payment` against that QBO invoice.
4. On amendment, **update the existing QBO invoice** — never create a second
   one. This is gap 10 and it is the thing that must be right on day one.
5. A visible sync log per company, and a banner when the refresh token has died.
6. Nothing else. No expenses, no items, no time, no reading QBO back.

Explicitly **not** in v1: two-way sync. The moment QuickBooks can write into
FieldQuo, every conflict becomes a support ticket about somebody's revenue, and
non-negotiable #3's instinct — one system owns the record — is exactly right
here too.

### What it costs

Honest estimate, and I am inferring the multipliers from the shape of the work,
not from having built this integration before:

| | |
|---|---|
| Schema (gaps 1, 2, 5, 7, 8, 9) | 3–5 days |
| OAuth + per-tenant token storage, encrypted, with proactive refresh | 4–6 days |
| Customer/Invoice/Payment mapping + the AST proxy-TaxCode dance | 8–12 days |
| Amendment handling, idempotency, retry, dead-letter | 4–6 days |
| Sync log UI, connect/disconnect, error surfacing | 4–5 days |
| Sandbox testing + Intuit app assessment + the back-and-forth | 5–15 days, mostly waiting |
| **Total** | **6–10 weeks** |

Then the part nobody budgets: **it never stops costing.** Refresh tokens expire
on idle customers. Intuit deprecates minor versions. AST changes behaviour. A
contractor renames an account in QuickBooks and the mapping breaks. Every one
of those arrives as a support ticket about money, which is the most expensive
kind. Budget **1–2 days a month, forever**, plus a support person who
understands double-entry bookkeeping.

---

## Part 3 — Zapier: the published app vs. plain webhooks

These are two completely different products and conflating them is how a month
disappears.

### What Projul's Zapier integration actually is

Read on 28 August 2026 from `https://projul.com/features/zapier-integration/`:

> "Projul currently supports a Create Lead action in Zapier."

**One action.** The "5,000+ apps" on that page is Zapier's ecosystem, not
Projul's surface area. A prospect reading their integrations page believes they
bought an automation platform; what exists is a form-fill endpoint with a
Zapier logo on it.

### Do we have any outbound webhook infrastructure?

**No.** I grepped every `webhook` reference in `lib/` and `app/`. Every one is
either an inbound receiver (`/api/stripe/webhook`, `/api/voice/webhook`,
`/api/crew/inbound`) or provider-side configuration we *send to* Retell/Twilio
(`lib/voice/retell.js`, `lib/crew/line.js`). Nothing in FieldQuo POSTs an event
to a customer-supplied URL. `NotificationRule` has a `channel` column that only
ever holds `"email"`.

### The two options

**A published Zapier app.** Requirements, read from
`docs.zapier.com/integrations/publish/integration-publishing-requirements` and
supplemented by community sources (flagged as such): HTTPS API, English only,
OAuth or API-key auth, every trigger and action tested in live Zaps, production
endpoints, and — critically — **"Your app has been fully launched to the public
and isn't an invite-only or 'beta' app."** Community sources add a **90-day
public beta**, ~10 published Zap templates and **50 active users** before a
full public listing (waivable if the integration is embedded behind our own
login). We would also need to build a REST API with token auth that does not
currently exist.

**Outbound webhooks.** One new model (`OutboundWebhook`: companyId, url, secret,
event list, active, lastDeliveryAt, failureCount), one HMAC-signed POST per
event, a retry with backoff, a delivery log the contractor can see, and a
disable-after-N-failures rule. Events worth emitting: `lead.created`,
`quote.sent`, `quote.approved`, `job.completed`, `invoice.sent`, `payment.received`,
`booking.created`.

### Which is the better first move

**Webhooks, clearly, and it is not close.**

- A webhook is consumed by Zapier (Webhooks by Zapier), Make, n8n, Pipedream, a
  Google Apps Script, and the customer's own nephew who knows Python. A Zapier
  app is consumed by Zapier.
- A webhook has **no external approval gate**. A Zapier listing has a human
  review, a 90-day beta, and a 50-active-user threshold we cannot meet on day
  one because we do not have the users yet. *We would be blocked on our own
  growth.*
- A webhook has no third-party API to track. A Zapier app is a second codebase
  in someone else's platform version scheme.
- If webhooks land and customers actually use them, a Zapier app becomes a thin
  wrapper over an API that already exists — and by then we will know from the
  delivery log which three events anyone actually wires up.

There is also a positioning win: "FieldQuo sends a signed webhook for every
event, so you can wire it into anything" is a *stronger* sentence than "we have
a Zapier action", and it is true of a smaller amount of work.

---

## Part 4 — the honest positioning while we don't have them

The owner's instinct, which I was asked to test rather than dismiss:

> "maybe right now we dont have quickbook and zapier because they don't need it
> with us."

### Where it holds — and it genuinely does

For a one-to-eight person painting, cabinet or flooring outfit, most of what a
contractor uses QuickBooks *for* is already here and is already better-shaped
for the trade:

- **Invoicing and getting paid.** `Invoice` + Stripe Connect + the client
  portal. QuickBooks' invoicing is generic; ours is branded, translated,
  signable, and attached to the job.
- **Job costing.** `InvoiceCosting` and `QuoteCosting` — real hours from real
  timesheets, real materials, a real overhead basis. QuickBooks Online does
  this badly enough that an entire industry of add-ons exists to fix it. **This
  is a genuine FieldQuo advantage and it should be the headline, not the
  apology.**
- **Expenses and overhead.** `Expense` with `isOverhead`/`recurring`, feeding
  `lib/analytics/burnRate.js`.
- **Payroll.** `PayRun`/`PayRunLine`, and a CSV the payroll provider takes.
- **Price book.** `Product` with `costPrice`, so margin is known before the
  quote goes out.

A solo painter who invoices from FieldQuo, records materials against jobs, and
hands their accountant a year of CSVs at tax time has no *operational* need for
a second system. That is a real argument, honestly made.

### Where it breaks — and it will

Four places, and they are not edge cases:

1. **The accountant, not the contractor.** The buyer of QuickBooks is often the
   bookkeeper, and they are frequently non-negotiable about it. "My accountant
   uses QuickBooks" ends the conversation regardless of what the software does.
   This is habit, but habit that signs the cheque.
2. **Sales tax filing.** We cannot do it and must not claim to (gap 3: one tax
   amount, no codes, `TaxRate` matched by name). A contractor filing quarterly
   GST/HST or state sales tax **needs** a real accounting system. This is the
   hardest break and it is structural, not a missing screen.
3. **Bank reconciliation.** We have no bank feed and no Stripe fee on
   `Payment` (gap 7). Nobody closes a year without reconciling to the bank.
4. **Anything above about ten people, or more than one entity.** Multi-entity,
   depreciation, accruals, loans, equity, an actual balance sheet — none of that
   is here and none of it should be. We are a field-service system that keeps
   good records, not a general ledger.

**So the correct framing is not "you don't need QuickBooks."** It is "you don't
need to do the work twice." A contractor keeps their accountant and their
QuickBooks; what we remove is the re-typing.

### The line to actually use

> **FieldQuo replaces the double entry, not your accountant.**
> Quote it, schedule it, invoice it and get paid here — then export the whole
> period as a clean CSV your bookkeeper can import in a minute. We do the job
> costing QuickBooks was never built for; they do the filing we don't pretend
> to. A QuickBooks Online connector is on the roadmap; the export works today
> and needs nobody's approval.

Two things to be strict about:

- **Never say "you don't need QuickBooks."** Some contractors do, for reasons we
  cannot fix, and a customer who believes us and then discovers they cannot file
  their sales tax is a refund and a bad review.
- **Never let the marketing pages claim an integration.**
  `app/data/featurePages.js` and `scripts/check-feature-pages.mjs` already
  enforce this. Do not relax them.

### The segment where this will not survive contact

**A ten-to-twenty person general contractor with a part-time bookkeeper, in the
US, filing sales tax quarterly, whose accountant has an established QuickBooks
workflow.** They will not take a CSV, they will not change accountants for us,
and the export is a downgrade from what a competitor offers them. That customer
is a lost sale until item #4 exists. **Price accordingly and don't chase them.**
Our winnable segment is the one-to-eight person owner-operator whose books are
currently a shoebox and a spreadsheet — for whom a clean CSV is not a compromise
but a first.

---

## Part 5 — the recommendation

### Build first: the bookkeeping export — **done in this session**

`lib/export/accountingExport.js`, pure functions, no route and no UI. Given a
date range, it produces four CSVs: `summary`, `invoices`, `payments`,
`expenses`.

What it guarantees, each of them mutation-tested by
`scripts/check-accounting-export.mjs` (96 assertions, 10 mutants, non-zero exit):

- **An amended invoice is one document.** Rows are grouped by
  `parentInvoiceId || id`; one line per family, at the *latest* version's money,
  dated from the *root*. A v2 whose original fell outside the range is flagged,
  not guessed. Payments recorded against a superseded row are rolled up so they
  do not vanish.
- **Formula injection is neutralised.** `= + - @` tab, CR are tab-prefixed
  *and* quoted. **One deliberate divergence from the payroll route:** there,
  money goes through the same string guard, so a negative figure comes out as
  `\t-5.00` and imports as text. Here money goes through `money()` and is
  exempt, because we generated it — a number cannot be a formula. *The payroll
  route has this latent bug; it has never bitten because payroll deductions are
  stored positive.*
- **Nothing is invented.** Each invoice states which column its date came from.
  `taxEnabled: false` with `tax: 0` renders differently from `taxEnabled: true`
  with `tax: 0`. The expenses file has no Tax column and no Vendor column,
  because an always-blank column reads as a statement nobody made.
- **Currency is never assumed and never summed across.** Omitting it throws
  rather than defaulting to CAD; mixed currencies get separate buckets and a
  sentence saying they were deliberately not combined.
- **Empty is empty, not broken.** Headers present, zero rows, no invented
  warnings. A backwards or unparseable range throws.
- **The summary states what the file cannot contain** — not a filing, no tax
  codes, no input tax credits, no refunds or credit notes, no issue-date field,
  UTC day grouping.

**Left to wire (deliberately not built — the surface should settle first):**
`GET /api/export/accounting?from=&to=`, gated on `showPricing` + an invoices
level the way `products/export` is gated, a ZIP or four downloads, a
`recordActivity` call, and a card under Settings. **`package.json` was not
touched** (another agent is in it) — add:

```json
"check:accounting-export": "node --import ./scripts/alias-loader.mjs scripts/check-accounting-export.mjs"
```

and append `&& npm run check:accounting-export` to `check:all`.

### Build second: outbound webhooks (~4–6 days)

Covers Zapier, Make, n8n and DIY at once. No external approval. Tells us which
events anyone actually wants before we build a Zapier app for them.

### Build third: the schema gaps

Invoice issue date, transaction currency, Stripe fee on `Payment`, expense tax
and vendor, external-id columns. Each is small, each is independently useful,
and all of them are prerequisites for #4.

### Then, and only then: QuickBooks Online, one-way

6–10 weeks, plus 1–2 days a month forever. Worth doing when the lost-sale
column says so — and not before, because a half-built accounting sync is the
purest form of the thing AGENTS.md forbids: a control that appears to work and
doesn't, attached to somebody's tax return.

### Refuse

- **Bidirectional sync.** One system owns the record.
- **QuickBooks Desktop.** It needs a connector running on the customer's own
  Windows machine. We are a web app; we cannot ship that and should not pretend.
- **A published Zapier app before webhooks.** We would be gated on a 50-active-
  user threshold we do not yet meet, for a surface Projul fills with one action.
- **Any marketing claim before the code exists.** The checks already stop it.
  Leave them alone.

### And the option of doing nothing, said well

Doing nothing is defensible for the next quarter *if* the export ships. Without
it, "we don't integrate with QuickBooks" is a gap. With it, the sentence becomes
"we export a clean period your bookkeeper imports in a minute, and the
connector is next" — which is a roadmap answer rather than a hole, and which is
true. What is **not** defensible is doing nothing and saying nothing: the
question is asked on every sales call in this category, and the worst outcome is
an answer improvised differently each time.
