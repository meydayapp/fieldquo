# FieldQuo — Support Guide

_Written for a first-line AI support agent answering a contractor's question.
Not a feature tour (see `docs/FEATURE-GUIDE.md` for that) and not an
engineering doc. Every answer here should be something you could say straight
to a painter or a plumber, on a screen they can actually go and click._

**How this document is organised:**

- **Part 1** — the small number of things that have to be true before a
  feature works at all. Most "it's not working" tickets are a missing
  prerequisite, not a bug.
- **Part 2** — how to do the common things, with the exact page.
- **Part 3** — symptom → likely cause → what to check, for the tickets that
  keep coming up.
- **Part 4** — the outside services FieldQuo depends on, and whose problem
  each failure is.
- **Part 5** — what FieldQuo honestly does not do yet. Never promise these.
- **Part 6** — what to escalate immediately rather than answer yourself.

**Two audiences, and it matters which one is asking.** The contractor and
their staff live in `/app` (and `/app/settings/*`). Their client — a
homeowner, often on a phone in a driveway — never has an account and only
ever sees a link: a quote link, a booking page, an invoice link, a portal
link. If a ticket says "my client can't see the quote," you are troubleshooting
a public page with no login, not an `/app` permissions problem.

---

## Part 1 — Prerequisites: what has to be true first

### To send a quote that shows real numbers

- A **client** must exist on the record (create one, or let the quote builder
  create one inline).
- The company must have **services configured** (Settings → Services &
  Pricing) with real rates. A quote can be built with nothing configured, but
  every line will be blank.
- **The internal cost & margin preview will not appear at all** unless
  Settings → Overhead has a **jobs-per-week capacity** filled in, alongside
  the fixed costs (salaries, debt payments). There is **no default** — an
  empty capacity field doesn't produce an invented number, it produces no
  card. If a contractor says "I don't see my margin/minimum price anywhere,"
  this is almost always why. Send them to Settings → Overhead.
- **Tax only fills in if the client's province/country is on file.** If a
  client was created without a resolvable address (a common gap when someone
  types a client in by hand instead of using the address autocomplete), the
  quote either falls back to an assumed rate — labelled as an assumption,
  naming the province it guessed — or, on some paths, comes up with no tax at
  all and needs a person to set it. It is never invented silently.

### To send any client-facing email (quote, invoice, booking confirmation)

A company does **not** need its own verified sending domain to send email —
FieldQuo's own shared sender is a legitimate, permanent fallback, and it uses
the company's name as the display name and routes replies back to them. A
company only needs Settings → Email domain finished (and its DNS records
verified) to send from **their own** address instead of the shared one.

The one case that silently breaks every company on the shared sender at once
is a **platform-level** problem, not a company setting — see Part 3, "an
email never arrived."

### To turn on the AI phone receptionist

All three of these, in order, or nothing answers:

1. **A phone number**, bought, forwarded, or ported in on Settings → Voice.
   A forwarded number keeps the contractor's existing carrier number and
   simply forwards calls; a ported number takes weeks to actually move and
   cannot be tested until it lands.
2. **Enough voice credit.** The receptionist runs on a prepaid balance,
   billed per minute of call time, with a small monthly rental on top of the
   number itself — a number with zero calls still costs something every
   month. A free trial allowance covers the first stretch; after that it
   needs a top-up or automatic top-up switched on.
3. **The receptionist switched on**, on the same settings page. A number and
   credit with the switch off means nothing answers.

Miss any one of the three and the settings page will say exactly which link
in that chain is broken, in plain language, and whose side it's on — that
readout is the fastest way to answer "is my receptionist actually live?"
without guessing.

### To take online card payments

Settings → Payments must have the company's own **Stripe Connect** account
connected and fully onboarded (Stripe has its own list of outstanding
requirements — banking details, identity, etc. — shown right there). Until
that's done: a **Request payment** link will warn the contractor rather than
send a dead link, and paid estimate-visit fees on the booking page simply
can't be turned on — the config screen says "connect Stripe to collect this
fee" instead of offering the field.

### To publish a booking page

At least one **event type** (visit type) must exist under Settings → Booking
page. If the company wants an **estimator picker**, at least one team member
needs to be marked bookable in their own availability settings — otherwise
the picker never appears and every booking goes to whoever is available.

### To use AI features at all (quote review, website copy, digest, copilot)

Nothing extra — the free, always-on AI features (quote review add-on
suggestions, the AI-drafted website, the monthly digest, the FieldQuo
copilot) run on FieldQuo's own metered usage and need no setup from the
contractor.

**The two PAID AI features are different — they spend a company's own AI
credit balance:** AI image generation (used in the Marketing Designer) and
the paid "deep read" of a quote's photos (a closer, higher-resolution AI
look at the photos already on a quote, on top of the always-free review). A
company with **zero AI credit** gets a clear "not enough balance" message
naming the shortfall, not a silent failure — see Part 3 for the "wrong
wallet" confusion this causes.

### To run the Marketing Designer

The company needs the Marketing Designer feature switched on for their
account (an internal FieldQuo setting, not something they self-serve) and a
**marketing campaign** to attach a design to — the designer's own start page
lets a contractor create one inline, so this isn't a separate setup step,
just something that has to exist first. AI image generation and background
removal inside the designer spend the same AI credit balance as the deep
photo read above; templates and stock photos are free.

### To collect a lead or booking from a website that isn't the FieldQuo site builder

The **embed widgets** (booking, quote request, reviews) are the way in — one
snippet dropped into an existing site. They need no FieldQuo website at all.

---

## Part 2 — Common tasks, with the exact page

### Win the work

| Task | Page |
|---|---|
| Build a quote | `/app/quotes/new` |
| See/search all quotes | `/app/quotes` |
| Open one quote (send, convert, edit, delete) | `/app/quotes/<id>` |
| Manage a quote's public approval link | `/app/quote-approval/<id>` |
| Approve estimates auto-generated from the website before they can send | `/app/estimate-reviews` |

The client's own experience is `/q/<token>` — a link minted per quote, no
login. That is where they see the branded quote, tick optional add-ons, and
sign.

### Get leads in

| Task | Page |
|---|---|
| Work the leads pipeline (score, assign, convert to quote) | `/app/leads` |
| Bulk-import leads from a spreadsheet | `/app/leads/import` |
| Build/edit a tap-through lead funnel | `/app/funnels` and `/app/funnels/<id>` |

Public entry points a contractor shares or embeds:
- **Self-quote request** (`/quote/<company>`) — asks about the job and the
  photos, returns **no price**, creates a lead.
- **Instant estimate** (`/instant-quote/<company>`) — a **different** flow at
  a different address. Measures the property and returns a real price
  **range**, computed from the company's own rates, only for the trades the
  company has switched on in Settings → Instant Quotes and only for the
  trades this feature currently supports (roofing, lawn, epoxy, parging,
  cabinet refacing, countertop, flooring). These two flows share a lot of
  wording ("services", "photos") and get confused constantly in tickets —
  check the URL a client is actually complaining about before assuming which
  one they used.
- **Lead funnel** (`/f/<company>/<funnel>`) — a mobile quiz-style flow built
  in the funnel editor.
- **Bio link page** (`/l/<company>`).

### Do the work

| Task | Page |
|---|---|
| See/search jobs | `/app/jobs` |
| One job's detail (visits, checklist, photos, notes) | `/app/jobs/<id>` |
| Add a visit to a job | `/app/jobs/<id>/visits/new` |
| Company-wide calendar | `/app/appointments` |
| Draft/publish weekly shifts | `/app/scheduler` |
| Manager's read-only view of the whole team's week | `/app/schedule` |

An accepted quote creates a job automatically — there is no manual step. Job
photos can now be added directly on the job page (an upload control on
`/app/jobs/<id>`), not only by a crew member texting a picture to the crew
line — both paths land in the same place.

### Online booking

`/book/<company>` is the public page: pick a service, a time, and (if
configured) a specific person. `/embed/<company>/book` is the same flow
dropped into an existing website as an iframe.

### Get paid

| Task | Page |
|---|---|
| See/search invoices | `/app/invoices` |
| Build a new invoice | `/app/invoices/new` |
| One invoice (send, record payment, download) | `/app/invoices/<id>` |
| Connect/manage the payout account | Settings → Payments |

The client's experience is the **portal** (`/portal/<token>`) — their
balance, and a pay button, reading like a statement from the contractor.
There's also a direct invoice-email pay link.

### Know your numbers

| Task | Page |
|---|---|
| One dashboard: sales, profit, execution, cash KPIs, and a "money flow" (income vs. expenses) section | `/app/analytics/kpis` |
| Log/categorise expenses | Settings → Expense tracking |
| Import a bank statement CSV of expenses | Settings → Expense tracking → **Import** button in the header |
| Set the price floor | Settings → Overhead |
| Win/loss, statements, estimate accuracy, "how you compare" benchmark | reached via the Insights hub (`/app/analytics/benchmark`), which links out to each — they don't have their own sidebar entries |

None of the KPI screen's numbers are ever padded with an invented figure —
where a company genuinely has no history for a metric, the tile says so
rather than showing a $0 or a 0%, and margin figures specifically hide
themselves rather than show a number known to be wrong (see Part 3, "a KPI
tile says nothing instead of a number").

### Grow

- Referrals: Settings → Refer & Earn. A new company signing up on a referral
  link gets **one free month**; the person who referred them earns account
  credit worth one month of the **referred** company's own plan, once that
  company is verified and actually paying — a big team referred is worth more
  than a small one. (This changed from three months to one on 2026-08-27 —
  if a contractor quotes an old "3 months free" figure, that's stale, not a
  bug.)
- Automated follow-ups on unanswered quotes, and automated review requests:
  both under Settings.

### Your brand & website

- Settings → Website: the AI-assisted builder with a live preview.
- Settings → Branding: logo and brand colour — this one colour drives every
  client-facing surface (quotes, invoices, the website, the portal), with
  contrast measured, not assumed, so even an unusual brand colour (bright
  yellow, near-black) stays legible.
- The public site itself lives at the company's own subdomain.

### AI

- `/app/copilot` — ask FieldQuo AI about the company's own numbers. It will
  not answer questions unrelated to running the business, and it can never
  see another company's data — there is no way to make it do either, by
  design.
- Settings → AI credit — buy AI credit (pay-as-you-go top-up, or a monthly
  bundle) for the two paid image/vision features.
- Settings → Voice — the receptionist, including a **curated** voice picker
  (a small, deliberately short list of voices chosen for clarity on a phone
  call, not every voice the underlying provider offers), greeting, and the
  company's knowledge base for it to draw on.

### Crew & mobile

- `/app/crew-inbox` — triage photos/texts a crew member sent from any phone
  (no app install), see senders that couldn't be matched, and manage the
  crew SMS line.
- `/app/clock` — an hourly worker's own time clock.

### Team & platform

- Settings → Team — invite teammates, set roles.
- `/app/payroll` — computes payslips and lets a manager mark them "recorded
  as paid" once the company has actually paid the person through their own
  bank or payroll provider. **FieldQuo moves no money here.** The place that
  *does* move money is Settings → Team → Payroll payouts, which pays
  1099-type contractors through Stripe Connect — say this distinction
  explicitly if a ticket conflates the two; it's the single most common
  payroll confusion.

---

## Part 3 — Symptom → likely cause → what to check

### "The receptionist answers, but no calls show up in the log"

**Likely cause:** the phone service is answering perfectly, but its call
events are being sent to an address that no longer exists — usually because
the receptionist's setup was last saved from a temporary/preview environment
rather than the live one, which silently repoints where results are
delivered. The call still happens and is still billed correctly on the back
end (a separate hourly reconciliation catches it), but nothing shows up live:
no transcript, no lead, nothing in the call list.

**What to check / do:** this is a superadmin-only platform tool —
`/platform/voice-webhooks` reads where each company's calls are actually
being delivered and can repair a broken one. It deliberately **refuses to
repair** if it's being run from an environment that won't still exist next
month (to avoid breaking every other company's receptionist at once) — if the
repair button is greyed out, that's the reason, not a bug. Escalate to
platform staff; a frontline agent has no fix available directly.

### "A phone number can't be released / can't be given back"

**Likely cause:** the number typed to confirm the release doesn't exactly
match the number on the account, or this is the company's **only** working
line and the "yes, I understand" acknowledgement for losing your sole number
hasn't been given, or the number is mid-port (still moving in from another
carrier) and can't be released through this flow at all.

**What to check:** Settings → Voice → the number's own release control asks
for the exact number as confirmation on purpose — a request built against a
stale screen should fail closed, not release the wrong line. If it's a
company's last number, they need to actively confirm they understand the
consequence. This is genuinely irreversible once it completes — the number
goes back into the carrier's general pool.

### "It says I don't have enough AI credit, but I just topped up"

**Likely cause:** there are **two separate prepaid balances** — a phone/crew
wallet (voice minutes, number rental, crew texts and photos) and a
completely separate AI wallet (image generation, the paid photo "deep read").
Topping up one does nothing for the other. This is the single most common AI
billing confusion.

**What to check:** ask which feature refused the action. If it's a **voice**
or **crew inbox** feature, they need Settings → Voice's top-up. If it's
**image generation** (Marketing Designer) or the **deep read** on a quote,
they need Settings → AI credit specifically. The refusal message always
names the exact shortfall — check it names AI credit, not voice credit.

### "An email never arrived"

**First, work out which of these it is:**

1. **The client's inbox, spam filter, or a typo in the address.** The most
   common cause by far — check the address on the quote/invoice record
   first.
2. **The company set up its own sending domain and it isn't fully verified
   yet.** Sends still go out (on FieldQuo's shared address) while a custom
   domain is pending — this alone should not cause total silence.
3. **A platform-wide failure**, and this is the one worth knowing by name:
   if FieldQuo's own shared sending domain has ever lost its verified status
   with the email vendor, **every** company relying on the shared address
   (i.e. every company that hasn't finished setting up its own domain) has
   its mail silently swallowed by the vendor's own sandbox behaviour — the
   send still reports success on screen, `sentAt` still gets stamped, and
   nothing anywhere logs an error, because nothing technically failed. This
   is invisible from inside any one company's account. If more than one
   unrelated company reports the same "sent but never arrived" symptom in a
   short window, **escalate immediately** — this is a platform health issue,
   not a one-off.

### "The quote is missing tax"

**Likely cause, most common:** the client record has no usable
province/country — often because they were typed in by hand rather than
picked from address autocomplete. Tax cannot be resolved from nothing, and
this codebase deliberately never invents a rate to avoid an under- or
over-charge — a missing jurisdiction either falls back to a clearly-labelled
**assumed** rate (naming which province it assumed) or leaves tax genuinely
unresolved, which blocks sending until a person sets it, rather than quietly
shipping a wrong "$0.00".

**Known limitation, worth saying honestly:** a quote created through the
**instant estimate** flow does not yet go through the same tax handling as a
quote built by hand in the builder — it can currently land with tax left off
entirely rather than resolved or flagged. If the ticket is specifically about
an instant-estimate-sourced quote, this is a known gap, not something you can
walk them through fixing on their side; log it rather than promising a
workaround.

**What to check:** open the client record, confirm province/country are
filled in; check whether the quote's own tax toggle was switched off on
purpose; confirm the company has a tax rate configured at all for that
jurisdiction under company settings.

### "A quote/invoice PDF or attachment won't open, or 500s"

**Likely cause:** file delivery for the storage service can be blocked on a
newly created hosting account until a delivery setting is turned on there —
this affects PDFs specifically (uploaded photos are unaffected). This is a
one-time platform configuration issue, not something a contractor did wrong.

**What to check / escalate:** if PDFs across **multiple** companies are
failing the same way, this is almost certainly the platform-level storage
setting, not a per-company problem — escalate rather than troubleshooting
one company's quote in isolation.

### "A demo account behaves differently from a real one"

This is often **by design**, not a bug — check whether the account is a
sales demo before treating it as a defect:

- A demo's phone number is **simulated** — it looks and behaves like a real
  number in every screen, but it's drawn from a reserved block that can never
  actually be dialed by a real phone. A demo cannot buy a real, dialable
  number at all; that's a deliberate, server-enforced refusal (a demo account
  re-skinned as a different trade every week with a real, ringing phone
  number would be a genuine liability).
- A demo's data (quotes, jobs, clients, invoices, appointments, leads,
  products) can be wiped and reset, or the whole account "re-dressed" as a
  different trade, by platform staff. Its phone number/receptionist
  configuration is deliberately **not** wiped on a reset, since it's already
  simulated and safe to keep.
- A demo gets a small amount of AI credit automatically once, so a sales call
  can show the real balance/spend UI rather than an unlimited free pass.

If a contractor's own **real, paying** account is behaving like a demo (a
simulated number, capped AI credit, data vanishing on its own), that is not
expected and should be escalated — it likely means the account was flagged
as a demo in error.

### "A KPI tile says nothing instead of a number"

**Likely cause, and this is intentional:** several KPI figures refuse to
render at all rather than show a number that could be wrong — most commonly,
margin figures when a company's logged expenses and its "buy list" of
materials disagree by an amount that suggests the company is bookkeeping in
two places that don't add up, or any figure depending on the jobs-per-week
capacity in Settings → Overhead when that field has never been filled in.
This is not a bug to fix on the spot; it's the product refusing to guess.
Point the contractor at whatever the tile itself names as missing (it always
names the specific gap) rather than treating the blank tile as broken.

### "Contractor-to-contractor: a sub says their price leaked to the client, or a GC can't see a sub's bid"

The **markup/cost is never shown to the homeowner** — only the blended or
itemised marked-up line is. If a ticket says a client saw a raw sub price,
that is a real defect worth escalating immediately, not a support answer —
it would be a breach of the isolation this feature is built around. Likewise,
a subcontractor should **never** be able to see the markup a general
contractor applied to their quote, or the GC's client-facing price — if
either of those is reported, escalate rather than explain it away.

### "My client's language / the document's language doesn't match what I expect"

A document (quote or invoice) is written in whatever language it was in **at
the moment it was created**, and that never changes afterward — not even if
the client's or company's language preference changes later, and not by
machine-translating it at send time. This is deliberate: a signed PDF must
keep saying exactly what it said when it was signed. If someone wants a
document in a different language, that has to be a new document.

---

## Part 4 — Third parties: who owns what

FieldQuo integrates with several outside vendors. Knowing which side of a
failure is FieldQuo's and which is the vendor's is most of what makes a
ticket answerable quickly.

| Vendor | What it does for FieldQuo | What a failure looks like to a contractor | Whose side |
|---|---|---|---|
| **Stripe — two separate integrations, do not conflate them** | | | |
| ...**Connect** | Pays contractors directly — card payments on invoices and paid booking fees go straight to the contractor's own bank, and FieldQuo never touches the money. | A client pays and the invoice stays "unpaid" on screen; payouts to the contractor's bank are late or missing. | **Stripe's** side once the account is genuinely connected and the charge succeeded (payout timing, banking verification, account restrictions are all Stripe's). If the invoice link itself won't load, throws an error, or a webhook never marks it paid on FieldQuo's side, that's **ours**. |
| ...**Billing** | FieldQuo's **own** subscription from the contractor — the plan they pay FieldQuo for. Entirely separate account/flow from Connect. | A payment fails and the account isn't marked past-due; a card update doesn't take; cancellation behaves oddly. | Mostly **ours** to investigate first (the billing UI, the plan record); genuine card decline/fraud holds are Stripe's. |
| **Retell** | The vendor behind the AI phone receptionist — the actual voice, phone number, and call handling. FieldQuo holds one account and provisions a private agent + number per company; a contractor never has their own Retell account. | Calls not answering, wrong voice, calls not appearing in the log, a number that won't provision. | Mostly **ours** to diagnose first — see the receptionist section above and Part 3's webhook symptom — because FieldQuo owns the one account and does all the provisioning. Genuine outages at Retell itself are theirs; the settings page distinguishes "we couldn't reach the phone service" from a fault on our side. |
| **Twilio** | SMS — the "on my way" text, appointment reminders, and the crew photo/text inbox line. | A crew photo never files onto a job; a text never sends. | **Ours** to check first (is the crew line switched on for that company, is the number on file correct); a genuine account-wide outage is Twilio's. |
| **Resend** | All outbound client and internal email. | See Part 3, "an email never arrived." | **Ours** first, almost always — the shared-sender/sandbox trap above is the platform-level failure mode to know by name. |
| **Cloudinary** | Photo and PDF storage — quote/invoice PDFs, uploaded job photos, website images. | Uploads that silently fail, or a PDF link that 500s. | **Ours** — this is a platform configuration issue (see Part 3), not something a contractor can fix from their own account. |
| **OpenAI** | Every AI feature — quote review, website copy, the digest, the copilot, image generation, the deep photo read. Routed through one internal metering layer so nothing bypasses quota. | AI features quietly produce nothing, with no visible error. | **Ours** to check first — usually a company-level quota/credit issue (see the AI-credit symptom above) or a platform-wide AI outage, which has its own health indicator for platform staff. |
| **Neon** (database) | Hosts the database. It scales down to nothing when idle, so the very first request after a quiet period can briefly fail before succeeding on a retry. | A one-off error on the first action of the day, that then works fine. | Usually **nothing to escalate** — a single transient failure right after a quiet period is expected behaviour, not an outage. Repeated or sustained failures are worth escalating. |
| **Google Maps / Google Solar** | Roof measurement and address lookup behind the instant-estimate flow, and address autocomplete generally. | Instant estimates for roofing don't work; address autocomplete falls back to a plain text box; travel-time booking estimates get less precise (it still works, just less exactly). | **Ours** to check first (is this platform-level service turned on) before assuming it's a Google outage. |
| **Vercel** | Hosting. | The site is down entirely, or a scheduled job (follow-up emails, review requests, the monthly digest, outbound calls) silently stops firing. | **Ours** — a scheduled-job failure here is invisible from the dashboard (it can report "ran" even when it did nothing useful), so repeated missed automations across multiple companies is worth escalating rather than treated as one company's bad luck. |

---

## Part 5 — What FieldQuo does not (yet) do — do not promise these

Saying a screen does something it doesn't produces the exact ticket this
guide exists to prevent. If a contractor asks about any of the following,
say plainly that it isn't there yet rather than describing a workaround that
doesn't exist:

- **Custom email templates are not what actually gets sent.** A contractor
  can build and mark a custom quote/invoice/receipt email template "Active"
  on the email templates screen, and a test send will even render it — but
  real quote and invoice sends today use FieldQuo's own standard branded
  email regardless. (Marketing campaigns and automated follow-ups genuinely
  do use a chosen template — it's specifically the core quote/invoice send
  that doesn't yet.) Don't tell a contractor their custom wording is what
  their client received.
- **Custom fields are never collected or shown anywhere.** A contractor can
  define a custom field (e.g. "Gate code," "PO number") on the custom fields
  settings screen — even mark it required — and it will never appear on any
  form, and nothing anywhere collects or displays a value for it. Don't
  promise this data will show up on a job or a document.
- **The granular per-category permission grid is only enforced on a few
  sensitive areas** (notably payroll). Elsewhere, the simpler four-role
  system (owner/admin/supervisor/employee) is the real gate, even where the
  grid UI implies finer control. Don't promise a specific per-category
  restriction will actually be enforced unless it's payroll.
- **Good/Better/Best tiered quotes exist only as a concept**, not as
  something a contractor can actually build and send from the quote builder
  today.
- **Employee payroll payout through an embedded provider is not built.**
  Only paying 1099-type contractors through Stripe Connect actually moves
  money; regular payroll on `/app/payroll` computes and records pay, and the
  company still pays through their own bank or provider.
- **There is no mobile app.** `/app` works in a phone's browser and is
  designed for that, but there is nothing to download from an app store.
- **There is no unified inbox** pulling in leads from other listing sites —
  only FieldQuo's own lead sources (the lead form, self-quote, instant
  estimate, voice calls, bookings) feed the leads pipeline.
- **There is no per-job profit-and-loss screen.** Job costs are recorded and
  feed the company-wide KPI dashboard, but there's no single "this job's
  margin" report yet.

---

## Part 6 — Escalate immediately, don't try to answer

Some tickets are not tier-1's to resolve, even with a clear answer available.
Route these straight to a human, with what's known so far:

- **Anything about money actually moving** — a payout that didn't land, a
  charge a client disputes, a refund, a subscription billed wrong. Confirm
  which Stripe integration is involved (Part 4) and hand off; don't attempt
  to explain away a real discrepancy.
- **Any request to delete data**, a company, or an account. There is
  currently no self-serve or even admin-driven company-deletion flow in the
  product — if someone asks to be fully deleted, that has to go to a human
  who can work out what's actually possible today, not be told it's done.
- **Any legal or privacy request** — access to, correction of, or export of
  someone's personal data (including a homeowner who was never a FieldQuo
  user themselves, e.g. someone whose call was recorded or whose address was
  measured for an estimate), a request under a specific privacy law, or
  anything about consent to be called, texted, or recorded. Every phone call
  through the receptionist is recorded and transcribed, and the caller is
  told this once, early in the call — but consent rules vary by
  region and this document is not the place to give a legal answer about
  them.
- **A cross-tenant data leak of any kind** — one company's data appearing in
  another's account, a subcontractor seeing a general contractor's markup (or
  vice versa), impersonation writing something instead of only viewing it.
  These are the specific things the product is built hardest to prevent;
  treat a credible report of one as urgent.
- **A platform-wide pattern** — the same failure reported by more than one
  unrelated company at once (email, AI, a scheduled job not firing). One
  company's problem is usually theirs to fix from settings; the same problem
  across several companies is almost always ours.
