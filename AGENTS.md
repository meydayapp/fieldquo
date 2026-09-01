<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# FieldQuo

## What this is

Multi-tenant SaaS for **field-service contractors** — painters, cabinet makers,
flooring installers, plumbers, landscapers. Small businesses, usually 1–20
people, often run from a van.

**The end goal: a contractor wins the job, does the job, and gets paid, without
leaving FieldQuo — and every document the homeowner sees looks like it came
from the contractor, not from us.**

That last clause is the product. FieldQuo is white-label by default. The quote,
the invoice, the booking page, the website, the emails — all carry the
company's logo, their brand colour, their name in the From line. A homeowner
comparing three contractors should not be able to tell that two of them use the
same software. Anything that leaks "FieldQuo" into a client-facing surface
needs a deliberate reason (the small "Site by FieldQuo" footer on free websites
is one; there are few others).

### The pipeline the product exists to serve

```
Lead ──▶ Quote ──▶ (client approves) ──▶ Job ──▶ Invoice ──▶ Payment
  ▲         │                              │
  │         └── AI review + upsell add-ons  └── scheduling, visits, materials,
  │                                             expenses, job costing
  └── inbound: self-quote form, booking link, website, referrals, phone
```

Two audiences, two surfaces:

- **`/app`** — the contractor's back office. Staff stare at it all day.
- **Client-facing** — `/quote/*`, `/book/*`, `/q/*`, `/portal/*`, `/site/*`,
  `/embed/*`, PDFs, emails. A stranger with no account, often on a phone, on a
  bad connection, in a driveway.

There is a third: **`/platform`**, FieldQuo's own back office (superadmin only).

---

## Stack

| Thing | Choice | Notes |
|---|---|---|
| Framework | Next.js 16, App Router | `params` **and** `searchParams` are Promises |
| DB | Neon Postgres + Prisma 7 | `PrismaPg` adapter over a `pg` Pool |
| Migrations | **`prisma db push`** — no migration files | |
| Auth | Better Auth | organisations = companies |
| Payments | Stripe Connect (contractor payouts) + Stripe Billing (FieldQuo's own subs) | two different integrations, don't conflate |
| Email | Resend | sender is *discovered*, not configured — `lib/email/platformSender.js` |
| SMS | Twilio | `lib/sms/twilioClient.js` |
| Images | Cloudinary | signed server-side uploads via `/api/upload` |
| AI | OpenAI | **only** through `lib/ai/provider.js` |
| Maps | Google Maps + Google Solar | homeowner addresses leave the building here — autocomplete, and roof measurement in `lib/measure/roofMeasurement.js` |
| Stock photos | Unsplash | hotlinked, not copied — a visitor to a contractor's site hits Unsplash's CDN directly |
| Hosting | Vercel | |

Roughly 64 Prisma models, 167 API routes, 62 `/app` pages, 12 `/platform` pages.

### Environment gotchas

- **Neon scales to zero.** The first connection after idle can fail with
  `P1001`. Retry once before believing the database is down.
- **`OPENAI_API_KEY` is marked Sensitive in Vercel** — it cannot be read back
  or pulled locally. Local dev has no working AI unless a key is supplied by
  hand. To check the model in production, hit `/api/platform/ai-health`.
- `.env` is gitignored. Setting something there affects **your machine only**,
  never the deployment.

---

## Non-negotiables

These came from the product owner directly. Do not relax them without asking.

1. **Company signup is open; *joining* a company is invite-only.** A new
   company can self-serve a trial from the public `/signup` form (first month
   free — `TRIAL_PRICE` in `lib/pricing.js`). What is invite-only is being
   added to an *existing* company —
   employees are invited against that company's licensed seats — plus the
   referral flow (invitee and referrer each get ONE free month — the owner
   overrode the original three on 2026-08-27) and FieldQuo's
   own platform admins (backend). There is no self-serve way to add yourself to
   a company you weren't invited to, and platform admin is never self-serve.
2. **Impersonation is read-only and superadmin-only.** Enforced in
   `middleware.js` and again in `lib/currentMember.js`, deliberately twice.
   Hiding buttons is not access control.
3. **The platform console can view everything and edit nothing** on a company's
   data. FieldQuo must never modify a customer's quote.

   **One narrow, sanctioned exception: the paid data-migration service.** A
   superadmin may CREATE new records (a `Client`, a `Quote`) inside a
   company's tenant — never update or delete anything that already
   existed — and only when ALL of the following are true at the moment of
   the write, re-checked fresh from the database on every write, never
   trusted from an earlier request:

     - the company itself requested the migration;
     - a superadmin (not "admin", not "support" — see
       `SUPERADMIN_ONLY_PERMISSIONS` in `lib/platform/permissions.js`) has
       priced it;
     - the company has accepted that price and paid it through Stripe
       Billing (never Stripe Connect — this is FieldQuo billing the
       company, the opposite direction from a contractor getting paid);
     - the request's `MigrationRequestStatus` is `paid` or `in_progress` —
       see `lib/migrations/state.js`'s `canWrite()`, which is the ONE
       function every write route calls immediately before writing.

   Every write is attributed and logged to `MigrationWrite` in the same
   transaction as the write itself (who, when, which migration, what was
   created) — see `lib/migrations/writes.js`. This is a DIFFERENT mechanism
   from impersonation (non-negotiable #2 above), on purpose: impersonation
   stays absolutely read-only, with no exception, for a support session
   looking at a live customer account unprompted. This exception exists only
   for a company that asked for it and paid FieldQuo to do it, and only for
   records FieldQuo creates fresh — never a company's existing quote, client
   or invoice. Full write-up: `docs/MIGRATION-SERVICE.md`.
4. **Public endpoints never return prices.** `/api/self-quote/*` returns
   services and intake fields, never rates. Publishing a rate card openly hands
   it to every competitor in the city.
5. **The browser never sends money amounts.** For add-ons, the client posts
   `addOnIds` only; the server reprices from its own rows. Any new
   client-facing pricing surface must work the same way.
6. **A document keeps the language it was created in.** `Quote.language` is
   fixed at creation. Nothing is machine-translated at send time — a signed PDF
   must keep saying what it said. The *covering email* matches the document's
   language (`lib/i18n/clientLanguage.js`), and the client's language drives
   everything else they receive.
7. **Reserved subdomains are a security boundary, not a naming preference.**
   Cookies scope to `.fieldquo.com`; a tenant owning `app.fieldquo.com` is
   account takeover. See `lib/site/subdomain.js`.
8. **FieldQuo AI answers about the company's own data.** It declines general
   assistant requests. It never sees another tenant's data — pricing
   comparisons use the company's own history only.

---

## The rule that matters most

**Never ship a control that appears to work and doesn't.**

This codebase was scaffolded fast and has been swept for this repeatedly. Real
examples found and fixed:

- Three separate "Send" buttons that set a status to `sent` and emailed nobody.
- `sitePublished` and `discoverable` toggles that wrote a column nothing read.
- `dateFormat`, `weekStartsOn`, `autoApplyLocalTax` — saved, never applied.
- A card titled "Business Hours" that actually edited one user's booking calendar.
- Regenerate on the website builder, which silently destroyed uploaded photos.

If you add a field, write it *and* read it. If you add a button, make it do the
thing. If you can't finish it this session, don't render it — a `Coming soon`
panel is honest; a dead button is not.

### Recurring failure classes — check for these

1. Schema fields that are written and never read, or read and never written.
2. `if (res.ok) { ... }` with no `else`. Use `reportResponseError` / `fetchJson`.
3. Synchronous `params` / `searchParams`. They are Promises in Next 16.
4. Copy-paste duplication instead of a shared helper — the copy is the one that
   rots, because it's the one nobody looks at.
5. **Padding absent data with defaults.** Absence of a statement is not a
   statement. A partial opening-hours array must not become an invented Mon–Fri
   that gets published to Google.
6. **Contrast assumed rather than measured.** Contractors pick yellow, white,
   black and mid-grey. `lib/documents/theme.js` measures; use it, and check any
   new text/background pairing at 4.5:1 across hostile brand colours.
7. Destructive operations labelled as cosmetic.
8. Feature flags for features that don't exist.

---

## Architecture you should know before editing

- **`lib/ai/provider.js`** — the only file that talks to a model vendor. Two
  entry points: `complete()` and `runToolLoop()`. Never construct an OpenAI
  client anywhere else. Every call is metered and quota-checked through
  `lib/ai/usage.js` (`checkAiQuota` *before*, `recordAiUsage` *after*).
- **`lib/documents/theme.js`** — every colour on every client-facing surface
  derives from the company's one brand hex. Contrast is computed, not guessed.
  `fillPair`, `neutralPair`, `ruleColor`, `inkMutedOnWash` exist because the
  naive "is it dark? use white" rule fails on mid-tones.
- **`lib/documentSections/`** — shared sections so quotes, invoices, PDFs and
  emails look identical. Invoices *mirror* quotes; they are not a lesser
  version of them.
- **`app/data/siteBlocks.js`** — the website builder's block schema and its
  sanitiser. `sanitiseBlocks` is the boundary between "what a browser sent" and
  "what is served to the public".
- **`lib/site/generateSite.js`** — the model writes *sentences* only. It never
  chooses layout freely, invents a service, or emits a style rule. Block lists,
  service names and testimonials come from the database and are merged back
  after generation. Every path falls back to a factual site built from data
  alone, so AI being down produces plainer copy, never a broken page.
- **`middleware.js`** — order is load-bearing. Subdomain rewrite first (a
  stranger reading a contractor's website has no session and must never be
  asked for one), then the read-only impersonation gate, then the platform
  gates, then the app gate.
- **`lib/company/businessHours.js`** — opening hours (public, company-level).
  Deliberately *not* `AvailabilitySchedule`, which is per-user booking
  availability. The two are allowed to disagree, and conflating them publishes
  an estimator's day off as a company closure.

---

## How to verify

You can run the real build. **Do it** — the previous agent worked in a sandbox
that couldn't, and relied on static checks instead.

```bash
npm run build                    # runs scripts/check-imports.mjs first
node scripts/check-ai-model.mjs  # needs a key; see the Sensitive note above
npx prisma db push               # after any schema change
npx prisma validate
```

Beyond the build, for anything non-trivial:

- **Execute pure functions against hostile input.** Sanitisers, parsers,
  pricing, colour maths. Most of the real bugs in this repo were found that
  way, not by reading.
- **Check contrast numerically** when you touch a client-facing colour.
- **Diff the payload** when refactoring something that builds a request body —
  an md5 of the serialised object before and after is cheap proof you changed
  nothing.
- **Grep for the field you just added** to confirm something reads it.

Throwaway check scripts go in the repo root and get deleted; imports use the
`@/` alias, which bare Node won't resolve, so copy the file or rewrite the
specifier.

---

## Working agreement

- **Read before writing.** Large codebase, strong conventions, a lot of
  load-bearing comments. The comments explain *why*, and are usually right. If
  one is wrong, fix the comment too.
- **Comments explain decisions, not mechanics.** Match that style. Say why the
  obvious alternative was rejected.
- **Include a `git commit -m` message with every change** — the owner asks for
  this every time.
- **When you make a mistake, name it plainly and fix it.** Don't quietly ship a
  smaller version of what was asked for.
- **Ask before scope changes.** If the honest answer is "this needs a product
  decision", say so rather than picking one and building it.

## Where to look next

`docs/ROADMAP.md` — current phase, what's deployed, and what's left, in order.
Read it before starting work, and update it when you finish something.
