# Job photo comments and @mentions

The owner's ask, verbatim: *"Add comment to it and also tag someone else. And
that person should be notified — including crews. And crews should be able to
add pictures to a job."*

Four things were asked for. Two turned out to already half-exist; two didn't
exist at all. This is what was found, what was built, and what was
deliberately left out.

---

## 1. Crew photo upload — already built, silently broken for the one tier it was for

`lib/crew/inbox.js` (SMS) and a web upload control in
`app/components/jobs/JobPhotoCurator.js` both already existed before this
change. The web control was added recently and its own check script
(`scripts/check-job-photos.mjs`) already asserted it worked.

It didn't, for Crew — the one tier this control exists for.

`POST /api/jobs/[id]/photos` required `jobs:view_create_edit`. The Crew preset
(`lib/permissions.js`, `PERMISSION_PRESETS.worker`) has always sat at
`jobs:view_only` — confirmed deliberately in `lib/permissions/enforce.js` and
tested by `scripts/check-crew-access.mjs`. `JobPhotoCurator.js` renders the
upload control unconditionally, with no client-side permission check at all.
So a crew member — logged in, looking at their own assigned job, exactly the
person the panel's own empty-state copy addresses ("Add photos here, or text
them to your crew line") — saw a working-looking upload button that 403'd
every single time. This is precisely the failure class AGENTS.md names: *"a
control that appears to work and doesn't."* `scripts/check-job-photos.mjs`
even had an assertion that had baked the bug in as a requirement (`"at the
same level as editing the job, because filing a photo is an edit to its
record"`), which is why it never caught it.

**Fixed**: `POST /api/jobs/[id]/photos` now requires `jobs:view_only` — the
same level `GET` already used, and the same level Crew has always held. This
isn't a broadened hole: the route still scopes the job through
`assignedJobWhere(full)`, so a Crew member can only file a photo against a job
they're actually on, and a member outside the company still can't reach
another tenant's job at all. It brings the web control in line with what SMS
filing has always allowed: `lib/crew/inbox.js` performs **no** `jobs`
permission check at all — only a phone-number match against the `Worker`
roster. Requiring *more* of the web button than the text line ever required
was the bug, not a deliberate stricter gate.

`PATCH /api/jobs/[id]/photos` — featuring a photo onto the public website, or
re-staging it — stays at `jobs:view_create_edit`. That's a curation decision,
unrelated to being able to add a photo, and `JobPhotoCurator.js` now hides
(not disables) the star button and the stage `<select>` for anyone below that
level, replacing them with a plain read-only stage label. A disabled star
still tells a Crew member a decision exists that isn't theirs to make; hiding
it says the true thing.

`scripts/check-job-photos.mjs` section 3 was corrected to assert the new
(`view_only`) requirement and to assert `view_create_edit` is *not* required;
section 3b asserts PATCH is untouched.

---

## 2 & 3. Comments and @mentions — built new

### What already existed

Nothing. `JobPhoto` (`prisma/schema.prisma`) had no comment relation, no
mention concept, and no reader anywhere in the codebase.

### What was built

**`JobPhotoComment`** — flat (not threaded), company-scoped, one row per
comment: `authorMemberId`, `body`, `createdAt`, cascading off `JobPhoto`.

Flat rather than threaded: a photo's comment thread is short-lived
shop-floor chatter ("who tagged the trim", "what's the touch-up colour"), and
a reply-to-reply tree buys structure nothing here needs. Justified, not
defaulted.

**`JobPhotoMention`** — one row per `@mention` inside a comment, doubling as
the delivery record: `notifiedVia` (`sms` | `email` | `none`), `notifiedAt`,
`skipReason`. See §4 for why this table is also the notification store.

### Who can be @mentioned

`lib/photoComments/mentionable.js` answers "who may see this job" with the
exact predicate the job list itself uses
(`seesOnlyAssignedJobs`/`assignedJobWhere` from `lib/permissions/enforce.js`):
an unscoped member (owner, admin, Dispatcher, Manager, Estimator) is always
offered; a scoped member (Crew) is offered only when they have a `JobVisit`
assigned on *that specific job*. `GET /api/jobs/[id]/mentionable` serves this
to the picker; `POST .../comments` calls the exact same function
(`resolveMentions`) to *validate* the submitted ids, recomputed fresh — not
reusing whatever the picker showed at page-load, in case an assignment or
deactivation happened in between. The picker and the enforcement can never
disagree about who is offerable, because they're the same function.

Composing the comment: rather than parsing `@Name` out of free text (fragile
on a phone, ambiguous with duplicate names), the composer offers eligible
people as tappable chips (`app/components/jobs/JobPhotoComments.js`). The
chip selection *is* the `mentionMemberIds` array the server receives — there's
no separate parsing step that could disagree with what was shown, the same
"browser sends ids, server resolves them" shape the add-on picker already
uses for pricing (non-negotiable #5).

### Hostile input, executed

`scripts/check-job-photos.mjs` sections 7–8 execute `memberCanSeeJob`,
`mentionableMembersForJob` and `resolveMentions` against a stub database
covering:

- a mention of someone in another company → dropped (the job lookup itself is
  company-scoped, so nothing beyond it even gets read)
- a deactivated member → dropped (`mentionableMembersForJob` only selects
  `active: true`)
- a mention of someone who can't see the job (scoped Crew member, no visit on
  it) → dropped
- five (and thirty, to prove the cap) mentions at once → all resolve; an
  unbounded fan-out is capped at 20
- a comment on a photo that no longer belongs to the job/company → 404 before
  any mention is even looked at (`loadScopedPhoto`)
- an author whose own id is in the mention list → dropped, unconditionally,
  before a `JobPhotoMention` row is ever created
- an id matching nobody → dropped

"A comment by someone whose access was revoked between load and post" needed
no new code: every route in this codebase re-loads the member fresh per
request through `memberOrRefusal`/`getCurrentMember`, which already requires
`active: true` — the same protection every other write route gets, not a
special case written for this feature.

Every one of these assertions was mutation-tested by hand: broken, confirmed
`FAIL`, restored, confirmed `ALL PASS` again (see the commit history on
`scripts/check-job-photos.mjs`).

---

## 4. Notification — what infrastructure exists, what was built, and why

### What was checked before building anything

This codebase has **no `Notification` model, no inbox, no bell icon backed by
a table.** It has `NotificationRule` — a company-level on/off switch that
gates whether an *already-existing* email fires (see
`lib/notifications/invoicePaymentNotice.js`, the "tell the team a client
paid" feature) — and that's the entire notification surface. There is
nowhere for an @mention to "land in-app."

### The decision: reuse the mention row as the notification record, don't build a bell icon

Two options were real: build a general-purpose `Notification`/inbox model (a
much bigger, cross-cutting feature this task wasn't scoped for and that two
other agents working in parallel on this same job-photo surface — tags,
annotation — might also want to notify through), or deliver mentions purely
through channels that already work and record what happened.

Chosen: **`JobPhotoMention` is the notification record.** It's not a generic
inbox — it only ever describes "was this specific mention delivered, how, and
if not, why" — but it's honest and durable, and if a real in-app notification
centre gets built later, this table is exactly the data it would want to
read; nothing here would need reshaping. No bell icon was built, because
there is nothing yet for a bell icon to open other than this one table, and a
bell that opens a single-feature list is worse than no bell — it would read
as a real notification centre and not be one.

### How a mention actually reaches someone — `lib/photoComments/notify.js`

**Crew, over the company's own crew line.** The exact SMS number a crew
member already texts photos to (`lib/crew/inbox.js`), so a mention lands in a
thread they already recognise, from a number that already means something to
them. Gated on the company having actually set crew texting up
(`CrewInboxNumber.connectedAt` not null) — sending from FieldQuo's shared
system number to a phone that has never had a crew-texting relationship with
this company would be starting a brand-new kind of message nobody opted into,
on a channel this product treats as opt-in everywhere else it appears
(`docs/` — crew line purchase, rent, the whole `lib/crew/messaging.js`
metering model). A company that hasn't turned crew texting on gets **no SMS
mention** — the comment is still saved, and reaches them the next time they
open the job.

The phone used is `Worker.phone`, not `Member.phone` — the same field
`lib/crew/inbox.js`'s `resolveSender()` already matches inbound texts
against, kept as the one source of truth for "the crew's number" rather than
inventing a second one.

**Billed exactly like a crew-line reply** — `lib/crew/messaging.js`'s
`chargeOutboundCrewReply`, the same function, the same ledger
(`crewSpendFor`'s balance check runs first; an insufficient balance means no
send, recorded as `skipReason: "insufficient_balance"`, never a silent debit
past the floor).

**STOP is respected.** `maySms()` (`lib/sms/optOut.js`) runs before every SMS
attempt. Opted-out → never texted; falls back to email if one exists,
otherwise recorded as `skipReason: "opted_out"`. A mention is not a reason to
text someone who opted out.

**Everyone else — and crew when SMS isn't reachable — gets email.** Same
"internal, staff-facing notice" convention `notifyInvoicePayment` already
established: the company's name as the display name, FieldQuo's fixed sending
address (`notifications@fieldquo.com`), and deliberately **not** the
white-label document convention — the audience is the contractor's own team,
not a homeowner, so AGENTS.md's white-label rule doesn't apply here (same
reasoning `notifyInvoicePayment`'s own comment gives).

**Self-mentions never notify.** Not a special case in the notify path — the
author's own id is dropped in `resolveMentions` before any `JobPhotoMention`
row is even created, so there's nothing for `notifyMentions` to reach.

**Detached, always.** `notifyMentions(...)` is called without `await` in the
comments route, `.catch()`-guarded, the same shape
`app/api/jobs/[id]/visits/[visitId]/route.js` uses for its "on my way" text.
The comment (and every `JobPhotoMention` row, pre-attempt) is written and
returned to the browser *before* any SMS/email send is attempted — a Twilio
or Resend outage can never turn an already-saved comment into a failed
request or a retried one.

### Executed against hostile input

`scripts/check-job-photos.mjs` section 9 runs `notifyMentions` end-to-end
against stubbed `sendSms`/`maySms`/`crewSpendFor`/`chargeOutboundCrewReply`/
`resend` — no real Twilio or Resend account touched — covering: crew line
connected (SMS sent), crew line not set up (falls back to email), STOP opted
out (falls back to email), insufficient balance and no channel at all
(recorded, not thrown), and a photo deleted between the comment landing and
the notification running (updates nothing, throws nothing).

---

## Comments stay off every client-facing surface

Checked, not assumed:

- **The public gallery** (`lib/site/jobPhotos.js`) selects `{ url: true }`
  only, off `featured: true, stage: { not: "issue" }` — it never touches
  `JobPhotoComment` and has no path to.
- **The photo-report PDF** (`app/api/jobs/[id]/photo-report/pdf/route.js` →
  `lib/jobs/photoReport.js`) selects an explicit, fixed field list (`id, url,
  stage, caption, createdAt`) — same guarantee, and this is itself an
  *internal* document (gated at `jobs:view_only`, downloaded by a staff
  member; nothing in the codebase emails it to a client).
- **The client portal** never references `JobPhoto` at all today — grepped
  before writing anything, confirmed by `scripts/check-job-photos.mjs`
  section 10's filesystem sweep, which asserts no file under `app/` touches
  `db.jobPhotoComment`/`db.jobPhotoMention` except the one route that owns
  them.
- **The second guard**, matching the pattern `issue`-stage photos already
  use: even if a future developer mistakenly wired a client-facing route to
  these tables, `memberOrRefusal` would refuse before the query ran — a
  homeowner has no `Member` row. Two independent guards, same shape as the
  `issue` exclusion this task asked to match.

---

## What was NOT built

- **No comment editing or deletion.** Not asked for; adding it means deciding
  who may delete another person's comment, which is a product question, not
  a technical one.
- **No in-app notification centre / bell icon.** See §4 — the infrastructure
  for one (a durable per-person delivery record) now exists in
  `JobPhotoMention`, but no UI was built to browse it as a general inbox,
  because there is exactly one feature behind it.
- **No `@` parsed out of free text.** Mentions are chip-selected, not typed —
  see §2/3.
- **No preference to turn mention notifications off.** `NotificationRule`
  exists and could gate this the way it gates `invoice_paid`, but wiring it
  up is a small, separate product decision (default on, like every existing
  `NotificationRule` type, or opt-in?) that wasn't asked for here.
- **No retry for a failed SMS/email send.** `skipReason` records why it
  didn't land; nothing re-attempts it. The comment itself is never lost —
  only the proactive notification is.

## Fields another parallel change might also want

Two other agents were working the same job-photo surface concurrently (one
adding company-defined tags, one adding annotation). Nothing built here reads
or writes any field on `JobPhoto` beyond what already existed
(`stage`, `featured`, `caption`, `url`) — no new `JobPhoto` columns were
added, only two new tables (`JobPhotoComment`, `JobPhotoMention`) related off
it by id. No field name collisions expected.

## Verification

`npx prisma validate` — schema is valid. `npx prisma db push` was
deliberately **not** run, per instructions.

`npm run check:all` and `npm run build` — see the session's own record for
exit codes; both were run in the foreground and their exit codes read
directly, not inferred from output.
