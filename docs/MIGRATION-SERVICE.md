# The paid data-migration service

A narrow, sanctioned exception to non-negotiable #3 ("the platform console
can view everything and edit nothing on a company's data"). The owner asked
for it directly: FieldQuo should be able to write a company's old records —
quotes, invoices, jobs from QuickBooks, Jobber, a spreadsheet, a shoebox —
into their FieldQuo account, charge a surcharge for the work, and let the
company decide whether to buy it.

**Not to be confused with** `AGENTS.md`'s "Migrations: `prisma db push` — no
migration files" — that's a schema-migration convention. This document is
about a product feature that happens to share the word.

---

## The state machine

`lib/migrations/state.js` is the one place that decides which transition is
legal. Every route imports its answer rather than re-deriving it.

```
requested   -> scheduled | quoted | cancelled
scheduled   -> quoted | cancelled
quoted      -> accepted | declined | cancelled
accepted    -> paid | cancelled
paid        -> in_progress | completed | cancelled
in_progress -> completed | cancelled
```

Terminal states: `declined`, `completed`, `cancelled`.

A few decisions worth stating explicitly:

- **Scheduling a consultation is optional, not a gate.** A superadmin who
  already knows the scope from a phone call outside the app can quote
  straight from `requested`. The owner's brief describes booking-then-quoting
  as the normal path; the code doesn't force it.
- **`canSchedule()` allows a self-loop** (`scheduled -> scheduled`) that the
  generic transition graph doesn't have, so a company can pick a different
  time right up until a price exists. It's a separate predicate from
  `canTransition`, not a special case bolted onto the graph.
- **`paid -> cancelled` and `in_progress -> cancelled` are real edges.** This
  is the answer to "a migration for a company that has since cancelled" —
  a superadmin can call off a migration that was already paid for (a refund
  handled outside the product — see "What was not built" below), and the
  write path has to notice the instant that happens, not on the next
  deployment. `canWrite()` is checked fresh, inside the write's own
  transaction, on every single write — never trusted from a status the
  caller read a request ago.
- **The company's own cancel button is narrower than the superadmin's.**
  `canCompanyCancel()` excludes `paid` and `in_progress` — once money has
  moved, backing out is a support conversation, not a self-serve button.
  `canCancel()` (superadmin) has no such restriction.
- **Documents can be uploaded almost any time** (`canUploadDocument()`) —
  right up until `declined` or `cancelled` — because a QuickBooks export is
  useful at every stage of the conversation, including before a price
  exists.

---

## What a superadmin may write, and what they still may not

**May:**

- Create a `Client` row inside the requesting company's tenant
  (`lib/migrations/writes.js`'s `writeMigratedClient`).
- Create a `Quote` row inside that same tenant, attached to a client that
  belongs to it (`writeMigratedQuote`) — deliberately minimal: no scope
  groups, no costing, `status: "draft"`, and `taxEnabled: false` because
  it's a record of historical work, not a re-priced live document.
- Only while the request's status is `paid` or `in_progress`
  (`canWrite()`).
- Only as a superadmin — `migration:write` is in
  `SUPERADMIN_ONLY_PERMISSIONS` (`lib/platform/permissions.js`) and is not
  granted to `admin` or `support`.
- Only CREATE. Every write function does a straight `db.<model>.create(...)`
  against fields the caller supplied — never an `update`/`upsert` against an
  id the caller names. There is no route anywhere in this feature that can
  modify a row that already existed before the migration touched it.

**May not, and this codebase enforces it structurally rather than by habit:**

- Touch an existing Client, Quote, Invoice or Job. The write functions only
  ever call `.create()`.
- Write anything at all before `paid`. Every write route calls
  `assertWritable`/`canWrite` on a freshly-read row inside its own
  transaction (`loadWritableMigration` in `lib/migrations/writes.js`).
- Write as `admin` or `support`. `requirePlatformPermission(role,
  "migration:write")` throws for both.
- Route this through impersonation. It's a completely separate mechanism —
  see `lib/currentMember.js`'s comment on `assertReadOnly` and `AGENTS.md`
  non-negotiable #3. Impersonation stays absolutely read-only, with no
  exception, for a support session looking at a live account unprompted.
  This exception exists only for a company that asked for it and paid for
  it, through its own dedicated routes under `/api/platform/migrations/`.
- Create an Invoice or a Job. See "What was not built" below.

**Every write is attributed and logged.** `MigrationWrite` is a new table:
one row per write, created in the *same transaction* as the write it
describes, carrying `platformAdminId` (who), `createdAt` (when),
`migrationRequestId` (which migration), and `entityType`/`entityId`/
`snapshot` (what — a frozen copy, so a company editing the migrated record
afterwards can't rewrite the log's account of what FieldQuo actually wrote).
The company reads a redacted view of the same table (entity type + snapshot,
never which superadmin did it — that's FieldQuo-internal) on their own
`/app/settings/migration` page, under "What's been brought in".

---

## The `AGENTS.md` change

Non-negotiable #3 now states the exception precisely rather than staying
silently untrue. It lists the four conditions that must ALL hold at the
moment of a write (company requested it, a superadmin priced it, the company
accepted and paid, and the request's live status is `paid`/`in_progress`),
names `lib/migrations/state.js`'s `canWrite()` as the single enforcement
point, and says explicitly that this is a different mechanism from
impersonation, which stays absolutely read-only.

`lib/currentMember.js` got a comment on `assertReadOnly()` — no behavior
change — pointing at this document so a future reader doesn't go looking for
the migration write-gate in the impersonation code path and conclude (wrongly)
that impersonation itself grew a carve-out.

`middleware.js` needed no change: it never asserted the old absolute rule
anywhere a grep could find, so there was nothing there to become false.

---

## Booking a consultation — reuse, not a second calendar

The brief asked specifically to check `app/api/booking/` and the existing
availability system before building a new one.

- **`app/api/booking/`** (the company's own client-booking calendar) doesn't
  fit: it's a *tenant's* calendar for *their* clients to book visits with
  *their* staff. A migration consultation is the opposite direction — a
  company booking time with FieldQuo's own staff — and has no tenant to hang
  off.
- **`DemoHostAvailability` + `lib/demo/slots.js`** (FieldQuo's sales-demo
  calendar) fits almost exactly: same people (`PlatformAdmin`s), same
  instinct ("when am I free for a call"), same 30-minute grid math. Reused
  directly — `lib/migrations/hosts.js` imports `demoRange`, `hostGrid`,
  `hostsFreeAt`, `pickHost` and `assembleHosts` from `lib/demo/slots.js`
  rather than re-implementing any of them.
- **`DemoBooking` the model** does *not* fit and was not reused: it's shaped
  for an anonymous, pre-signup prospect (free-text name/email, no
  `companyId`, no auth, "a light internal sales record" by its own comment).
  A migration consultation belongs to an authenticated company via a real
  `MigrationRequest`, so scheduling fields (`hostAdminId`, `scheduledAt`)
  live on that model instead, and `lib/migrations/hosts.js` is the query
  layer for it — the sibling of `lib/demo/hosts.js`, not a copy.

The one thing that had to be shared rather than duplicated: **busy time**. A
superadmin who's mid-demo can't also take a migration call. So
`loadMigrationHosts()` folds bookings from *both* `DemoBooking` and
`MigrationRequest` into the same `assembleHosts()` call `lib/demo/hosts.js`
uses — the pure assembler already accepts a flat list of
`{ hostAdminId, scheduledAt }` rows from anywhere, so no fork of the actual
scheduling logic was needed, only a wider query.

`MigrationRequest` also carries its own `@@unique([hostAdminId,
scheduledAt])` (mirroring `DemoBooking`'s), so two companies racing for the
same superadmin's slot is caught at the database level. What that constraint
can't catch — a demo booking and a migration consultation landing on the
exact same host+instant at the exact same moment — is closed by re-running
the availability check immediately before every write rather than by a
cross-table constraint; see the comment on that index in
`prisma/schema.prisma` for why a true cross-table constraint wasn't built.

---

## Billing — Stripe Billing, never Connect

`AGENTS.md` warns specifically about conflating Stripe Connect (contractor
payouts) with Stripe Billing (FieldQuo's own subscriptions). A migration
surcharge is FieldQuo billing the *company*, so it's Stripe Billing, `mode:
"payment"`, one-time — modelled on the voice/AI credit top-ups
(`app/api/settings/voice/topup/route.js`), which are the closest existing
precedent for "FieldQuo charges a company once for a specific thing", rather
than on the invoice/booking flows, which are the *reverse* direction (a
client paying a contractor).

`lib/migrations/payment.js`:

- `createMigrationCheckoutSession()` — builds the Checkout session from the
  request's own `priceCents`/`currency`, which only a superadmin can have
  set (non-negotiable #5, upheld: the browser never sends the amount that
  gets charged).
- `settleMigrationPayment()` — the single function that ever writes
  `status: "paid"`. Called from **two doors**: the webhook (a new branch in
  `lib/stripe/settleCheckoutSession.js`, keyed on `migrationRequestId` in
  the session metadata, the same convention `invoiceId`/`bookingId` use) and
  the return-trip `GET` on `/api/migrations/[id]/checkout`. Both call the
  same idempotent `db.migrationRequest.updateMany({ where: { status:
  "accepted" }, ... })`, so a closed tab after paying is still picked up by
  the webhook, and neither door can double-credit.

---

## Documents — a wider, authenticated-only upload boundary

`lib/media/validate.js`'s `classifyMedia()` is deliberately narrow
(photo/video/one PDF) *because* it also guards public, unauthenticated
endpoints (the self-quote form). Widening it to accept QuickBooks/Jobber
exports would put new attack surface on a stranger-facing route for a need
that route doesn't have.

So this feature adds a **separate** classifier,
`classifyMigrationDocument()`, in the same file (same boundary, own rules):
CSV/XLS/XLSX/TXT/ZIP/PDF and the QuickBooks family
(.qbo/.qbb/.qbx/.qbw/.iif), trusting the file *extension* first because
browsers commonly report `application/octet-stream` (or nothing) for those
formats — the opposite of `classifyMedia`'s MIME-only rule, and a deliberate
loosening scoped to a route only an authenticated billing admin with an
active migration can reach.

Uploads go through `lib/cloudinary.js`'s signed server-side `uploadBuffer`,
foldered per migration
(`fieldquo/companies/<companyId>/migrations/<migrationRequestId>/`), and are
recorded as `MigrationDocument` rows. Read access: the company that uploaded
it, and any platform admin viewing `/platform/migrations/[id]` (view
everything — non-negotiable #3's normal read side, untouched). Document URLs
follow the same Cloudinary-URL security model as every other upload in this
product (unlisted, not itself authenticated) — not a new gap this feature
introduces, the existing one every `pdfUrl` in the schema already has.

---

## The dashboard surface

Found by grepping for "Needs You": `app/components/dashboard/NeedsYou.js`
and its sibling `AwaitingPayment.js`. The brief specifically asked for
something "similar to an invoice they'd need to pay" — `AwaitingPayment` is
exactly that shape already (an unpaid money item, its own fetch, renders
itself away when there's nothing to show), so `MigrationNotice.js` is its
new sibling rather than a bolt-on to `NeedsYou` (which is scoped to things
the *automation* did, not something FieldQuo staff explicitly priced).

It renders a summary line + link, never inline Accept/Decline/Pay buttons —
same reasoning `NeedsYou`'s own header gives for itself: the full screen
(`/app/settings/migration`) already owns those actions, and duplicating them
on the dashboard would give one decision two places to be made from.

---

## Verification

```
npx prisma validate
node --import ./scripts/alias-loader.mjs scripts/check-nav-audit.mjs
node --import ./scripts/alias-loader.mjs scripts/check-settings-access.mjs
node --import ./scripts/alias-loader.mjs scripts/check-migration-service.mjs
npm run build
```

`scripts/check-migration-service.mjs` executes `lib/migrations/state.js` and
`lib/platform/permissions.js` against every hostile case named in the brief:
accepting twice, paying twice, declining after paying, a write before
payment, a write by a non-superadmin, and a write attempted after a *paid*
migration is cancelled. 70 assertions, mutation-tested by hand — canWrite()
widened to include `accepted`, `admin` granted `migration:write`,
`canRespond()` widened to include `paid`, and `cancelled` given a fake
outgoing edge were each introduced, confirmed to fail the corresponding
assertion(s), and reverted.

**Not wired into `npm run check:all`** — the brief instructed not to edit
`package.json`'s script chain and to say so instead. It needs a
`"check:migration-service": "node --import ./scripts/alias-loader.mjs
scripts/check-migration-service.mjs"` entry added to `package.json`, and
that entry added to the `check:all` chain, by whoever owns that file.

---

## What was not built

Said plainly, per `AGENTS.md`'s rule against a control that looks finished
and isn't:

- **No QuickBooks/Jobber/CSV parser.** The write path is a real, working
  mechanism — a superadmin reads the uploaded export by eye and keys the
  records in through `AddClientForm`/`AddQuoteForm` on
  `/platform/migrations/[id]`. There is no "Import from QuickBooks" button
  anywhere, because one doesn't exist yet. Building the actual parsers
  (QuickBooks' IIF/QBO formats, Jobber's CSV export shape) is the natural
  next slice, and the write functions in `lib/migrations/writes.js` are
  already the right shape for a parser to call in a loop instead of a human
  clicking a form.
- **No Invoice or Job writes.** Named in the owner's brief alongside quotes.
  Left out because both carry real dependencies a hand-entered legacy record
  can't honestly have yet: `AGENTS.md` says invoices *mirror* quotes rather
  than existing independently, and a `Job` carries scheduling, materials and
  costing that this feature has no source of truth for. Building a
  half-populated Invoice/Job would be exactly the "control that appears to
  work and doesn't" failure class this codebase keeps getting swept for.
- **No automatic Stripe refund.** A superadmin can cancel a *paid* migration
  (`paid -> cancelled` is a real transition, specifically so the write path
  closes immediately), but nothing in this codebase talks to Stripe's
  refund API when that happens. The refund, if one is owed, is a manual
  step in the Stripe dashboard today. This is the same category of decision
  as "no automatic Stripe refund on subscription cancellation" elsewhere in
  this codebase — a product/finance call, not a code gap that was
  overlooked.
- **No consultation-notes editor of its own.** `MigrationRequest.
  consultationNotes` is written from the quote form (folded in rather than
  given a separate "save notes" button nobody would reliably use) and
  displayed on both the platform detail page and, redacted of admin
  identity, is intentionally *not* shown to the company (it's an internal
  field, same convention as `Quote.reviewNotes`).
- **`check:migration-service` is not in the `check:all` chain** — see
  "Verification" above.
