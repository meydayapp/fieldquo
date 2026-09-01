# Scheduling, a calendar, a demo mock, and hiding what Meta hasn't approved

Written 31 August 2026, on top of `docs/SOCIAL-PUBLISHING.md` (publishing to
Instagram/Facebook, landed the same night). That doc's own "What was NOT
built" named four gaps: scheduling UI, Instagram's hold-and-post queue, a
Settings connect screen, and Reels/video/carousels. This build closes the
first two, plus three things the owner asked for that weren't in scope
before: a demo mock, and a hide-until-Meta-approves gate. The connect screen
and Reels/video are still out — see "What was not built" below.

Nothing in `docs/SOCIAL-PUBLISHING.md` was rebuilt. `lib/social/metaSpecs.js`,
`metaGraphClient.js` and `publishDesign.js`'s existing functions are extended,
not replaced.

---

## What Meta schedules natively vs what FieldQuo queues — the finding

Re-researched against Meta's live developer docs on 31 August 2026 rather
than trusted from `docs/SOCIAL-PUBLISHING.md`'s own prior research (which
was itself sourced live, the same day — the numbers hadn't moved, but the
brief for this task specifically asked not to assume that):

- **Facebook Page feed/photo posts support native scheduling.**
  `POST /{page-id}/photos` (or `/feed`) with `published=false` and
  `scheduled_publish_time` — Meta's own docs: *"Must be date between 10
  minutes and 75 days from the time of the API request."* Confirmed
  unchanged. Meta holds and publishes it; FieldQuo does nothing further for
  a real company's Facebook schedule once the call succeeds.
- **Instagram's Content Publishing API still has no scheduling parameter at
  all.** Confirmed against the live Content Publishing guide. It does not
  document one, and it explicitly anticipates third parties building their
  own: *"your app should also enforce the publishing rate limit, especially
  if your app allows app users to schedule posts to be published in the
  future."* That sentence is doing real work here — it's exactly why
  `publishToInstagram()` re-checks the live `content_publishing_limit` at
  fire time (inherited unchanged from the immediate-publish path), not at
  schedule time, and exactly the shape of queue-and-cron this build adds.
- **A container expires 24 hours after creation.** Confirmed — Meta's own
  troubleshooting text: *"The container was not published within 24 hours
  and has expired."* Getting this backwards (creating the container when a
  post is scheduled, rather than when it fires) produces a post that fails
  silently, days later, against a container nobody remembers creating.

So the two platforms are handled by construction, not convention:

| | Facebook | Instagram |
|---|---|---|
| **Real company, scheduled** | `publishToFacebook()` called immediately at schedule time, with `scheduledPublishTime` — Meta's own scheduler holds and fires it. Row status becomes `scheduled` right away, `externalPostId` set to the (unpublished) post Meta already created. | **Never calls Meta at schedule time.** Row is created with `status: "scheduled"` and nothing else. The cron creates the container and publishes, together, at the scheduled moment. |
| **Demo (mock) company, scheduled** | Also queued, not called immediately — see "The demo mock" below: there is no real Meta scheduler for a mock connection to hand a post to. | Same queue as above. |
| **Who fires it** | Meta itself, for a real company. FieldQuo's own cron, for a demo company. | Always FieldQuo's own cron. |

---

## The container-timing decision

**An Instagram container is created at FIRE time, never at schedule time.**
`lib/social/publishDesign.js`'s `validateInstagramSchedule()` — the function
that runs when a contractor clicks Schedule — touches no client at all: it
re-runs `validateCaption()`, `validateImageForInstagram()`, and the new
`isValidScheduleTime()`, and returns a plain `{ok, errors}`. Nothing about it
creates a container, uploads to Meta, or holds a token open. The image itself
IS uploaded to Cloudinary at schedule time (unchanged from an immediate
publish) — that's fine, Cloudinary URLs don't expire on Meta's clock, only
Meta's own containers do.

The cron (`app/api/cron/social-scheduled-publish/route.js`) calls
`publishToInstagram()` — the exact same function an immediate publish
uses — at the scheduled moment, which creates the container, polls it, and
publishes it in one call, all well inside the 24-hour window because the
container's whole lifetime happens during that one cron invocation.

---

## Idempotency — the cron cannot double-post

Vercel Cron does not guarantee at-most-once delivery, and a fired post is
irreversible under the contractor's own name — the exact failure class the
owner named as "fixed twice already tonight" for other features. The guard,
copied from `app/api/cron/appointment-reminders/route.js`'s own
claim-before-send pattern rather than reinvented:

```js
const claim = await db.socialPublish.updateMany({
  where: { id: row.id, status: "scheduled", firingClaimedAt: null },
  data: { firingClaimedAt: now, status: "publishing" },
});
if (claim.count === 0) return "claim_lost";
```

An `UPDATE ... WHERE`, never a read-then-write. Two overlapping cron
invocations both listing the same due row race this UPDATE against each
other; Postgres serialises the pair, and whichever lands second matches zero
rows — it returns immediately and touches nothing else about that row.
Mutation-tested (see "Verification" below): removing `firingClaimedAt: null`
from the WHERE clause is caught by an executed structural assertion.

`SocialPublish.firingClaimedAt` (new column) is the claim's own timestamp —
kept even after the row resolves, so a support conversation can see exactly
when a run picked a row up, distinct from `scheduledFor` (intended) and
`publishedAt` (actual — see the schema section below).

---

## The demo mock

**The constraint, verbatim:** convincing in shape, but never allowed to look
identical to the real thing, and a real company must never reach it while a
demo company must never reach the real Graph API.

### How the branch is decided — one function, one signal

`lib/social/metaConnection.js`'s `getMetaConnection(companyId)` — already
"the seam" the whole publish flow goes through (per `docs/SOCIAL-PUBLISHING.md`)
— now reads `Company.isDemo` itself, fresh, every call:

```js
if (company?.isDemo) {
  return {
    connected: true,
    mock: true,
    pageId: "demo_page_000000",
    pageName: `${company.name} (Demo)`,
    pageAccessToken: "demo-token-not-a-real-credential",
    instagramUserId: "demo_ig_000000",
    instagramUsername: "demo_account",
  };
}
// unchanged: connected: false for a real company, until the OAuth layer lands
```

Every caller — the publish route, the scheduling cron — picks its Graph
client from `connection.mock`, never from anything the browser sent or
anything cached:

```js
const client = connection.mock ? mockMetaGraphClient : metaGraphClient;
```

Since `connection.mock` is derived exclusively from a fresh
`Company.isDemo` read, and `isDemo` is not something a request body can set,
**a real company has no code path that reaches `mockMetaGraphClient.js`, and
a demo company has no code path that reaches `metaGraphClient.js`.** The
cron re-derives this at fire time too (not just at schedule time) and
compares it against the row's own `isMock` column, refusing loudly on any
mismatch — see `fireOne()`'s "Case 2."

### What the mock actually does — `lib/social/mockMetaGraphClient.js`

Same five-function export shape as the real `metaGraphClient.js`, so
`publishDesign.js`'s real orchestration — the container state machine, the
poll loop, the live rate-limit check — runs completely unmodified against
it. Nothing about the DECISION logic is mocked; only the data-fetching layer
underneath it is fake.

- **Realistic timing.** A container's status is derived from a timestamp
  embedded in its own fake id (`mock_ig_<base36 ms>_<rand>`), not from any
  server-side memory — stateless, so it survives across separate serverless
  invocations. `getInstagramContainerStatus()` reports `IN_PROGRESS` for
  ~1.8 real seconds, then `FINISHED`. The REAL poll loop's own backoff
  (`POLL_BACKOFF_MS` in `metaSpecs.js`, unchanged) genuinely polls it two or
  three times before publishing — a demo container visibly "processes" for
  a couple of seconds, the same shape a real one has, using entirely real
  code.
- **Plausible ids.** `mock_ig_<ts>_<rand>`, `mock_post_ig_<ts>_<rand>`,
  `mock_fb_post_<ts>_<rand>` — long, opaque, and impossible to mistake for a
  real Meta id on sight, but not `"1"`/`"2"`/`"3"` either.
- **A failure path, chosen by the operator, not by chance.**
  `simulateFailure` (`"rate_limited"` | `"container_error"`) is threaded
  from the PublishModal's own "Simulate a failure (demo)" selector, through
  the publish route (honored ONLY when `connection.mock`), through
  `publishToInstagram`/`publishToFacebook`, to the mock client:
  - `rate_limited` makes `getInstagramPublishingLimit()` report the account
    already at Meta's documented 50/24h cap — `interpretRateLimit()` (real,
    unmodified) refuses it, and no container is even created, exactly the
    real behaviour a maxed-out account has.
  - `container_error` makes `getInstagramContainerStatus()` report `ERROR`
    after one `IN_PROGRESS` poll — `nextContainerAction()` (real, unmodified)
    turns that into the same `container_error` refusal a real Meta rejection
    produces.
  - A rejected-aspect-ratio failure needs no simulation at all: it's the
    SAME client-side `validateImageForInstagram()` check every publish
    already runs, mock or real, before any network call — the demo can show
    it just by picking a 9:16 crop the modal doesn't even offer as a shape,
    or by watching the modal's own inline warning on a borderline image.

### Made undeniable to the operator, not hidden as a detail

`PublishModal.js` renders an amber badge — *"FieldQuo demo mock — no real
post is made"* — the instant `connection.mock` is true, and the
"Simulate a failure" selector only exists in that state. This is FieldQuo's
own back office, so naming FieldQuo plainly is the honest choice (per the
task brief), not a vague "demo mode." The calendar page carries the same
badge on every mock row (`isMock`, a permanent audit column — see below).

---

## What is hidden, and on what signal

**The rule, from the owner:** hidden until the app is approved; anything
that doesn't require Meta stays visible.

**What genuinely needs Meta's approval:** the connection itself
(`pages_manage_posts`/`instagram_content_publish` OAuth scopes,
per `docs/SOCIAL-PUBLISHING.md`), and the publish/schedule CALL — the actual
network request to `graph.facebook.com`.

**What does not:** designing an asset (the canvas editor, unrelated to any
of this), exporting it ("Download all", unchanged and untouched by this
work), and — this is the one worth being explicit about — *deciding* to
schedule something into FieldQuo's own queue is, mechanically, just a
database write. But a schedule with no possible connection behind it is a
promise this codebase cannot keep: for a real company with no Meta app
configured, there is no OAuth layer, so there is no way that queued post
could ever actually reach Instagram or Facebook. Offering "Schedule" there
would be exactly the "control that appears to work and doesn't" AGENTS.md
opens with — a post the contractor believes is queued, silently going
nowhere forever. So the WHOLE surface — Publish, Schedule, and the calendar
that shows what got scheduled — is gated together, on one signal, rather
than splitting "schedule" out as separately visible from "publish now."

**The signal:** `isSocialPublishingVisible({ isDemo, appConfigured })` in
`lib/social/metaSpecs.js` — a pure `isDemo || appConfigured` — where
`appConfigured` is `lib/meta/client.js`'s existing `metaAppConfigured()`
(`Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)`, already
built for the separate Meta Ads/insights import and reused here rather than
duplicated). **Real configuration, never a hand-set flag** someone forgets
to flip — the exact instruction in the brief.

**Enforced in two places, deliberately, per AGENTS.md's "hiding a button is
not access control":**

1. **Client-side:** `CampaignEditor.js` fetches the per-design publish GET
   on mount, reads its new `visible` field, and renders the Publish button,
   the Calendar link, and `<PublishModal>` itself only when it's true. Not a
   disabled button — not there at all.
2. **Server-side:** the publish route's `POST` handler refuses with `403
   not_available` before any body parsing, upload, or Meta work, when
   `!visible` — so a hand-crafted request straight to the API gets the exact
   same refusal a hidden button would have produced if it existed.

**A demo company is always visible**, regardless of `appConfigured` — it
never needs Meta at all (see "The demo mock" above).

**Once Meta approves the app** (the day `META_APP_ID`/`META_APP_SECRET`
exist in this deployment's environment), the feature reappears for every
real company automatically — no code change, no flag to flip. It still
shows `PublishModal.js`'s honest "not connected yet" panel until that
company's own owner/admin connects their Facebook Page (the per-tenant OAuth
step `docs/SOCIAL-PUBLISHING.md` still leaves to the sibling worktree) — that
state is a real, working control asking someone to do something, not a dead
one.

---

## The calendar

`app/app/marketing/designer/calendar/page.js` — every `SocialPublish` row
company-wide (not scoped to one design, unlike the existing per-design
publish-history panel), in a month grid, reached from the campaign editor's
own new Calendar button (rendered only when `socialVisible`, same gate as
Publish).

**Reuse, per the brief's own instruction to check first:**
`app/app/appointments/page.js` already had a month-grid calendar. Its pure
date math — `dayKey`, `monthGrid`, `localeFormat`, `localeDateTime` — is
extracted into `lib/calendar/monthGrid.js` and now imported by BOTH pages;
appointments' own copies were deleted, not left to drift. The grid's JSX
(cell rendering, click behaviour) was deliberately NOT extracted alongside
it: appointments' month view is filtered by crew member and travel legs
(`legsByAppointment`), the social calendar's by platform and a caption/
thumbnail preview — genuinely different screens sharing only the underlying
"what are the 42 cells of this month" math.

**Honest about "posts, reels, videos":** the owner named all three by name.
Only image posts can be scheduled today (`INSTAGRAM_IMAGE_SPEC` — no
video/carousel container shape exists in this codebase; see
`docs/SOCIAL-PUBLISHING.md`'s own "what was NOT built"). The calendar has no
Reels or Video filter tabs — a tab that always shows nothing is the exact
empty affordance AGENTS.md's "padding absent data with defaults" rule warns
against, applied to a feature list instead of a data field. A banner states
this in plain language instead: *"FieldQuo can schedule image posts today.
Reels and video aren't supported yet, so they never appear here."*

**What it shows per row:** platform (Instagram/Facebook), status
(scheduled/publishing/published/failed/rate_limited/canceled, each a
distinct colour), the time — `scheduledFor` when still waiting,
`publishedAt` once it has one — the caption, a thumbnail, the demo-mock
badge when `isMock`, and the error message on a failed/rate-limited/canceled
row. A `scheduled` row can be canceled from here
(`DELETE /api/marketing/designer/social-schedule/[id]`), guarded by the
identical atomic `status='scheduled'` claim shape the cron itself uses, so
canceling a post the cron just claimed can never race it.

---

## Prisma schema — additive, nullable, not pushed

`SocialPublish` gains:

- `scheduledFor DateTime?` — the INTENDED time, set once at schedule
  request and never rewritten.
- `firingClaimedAt DateTime?` — the cron's own claim timestamp (see
  "Idempotency" above).
- `isMock Boolean @default(false)` — permanent audit marker, set once from
  `connection.mock` at write time.
- `width Int?` / `height Int?` — the rendered asset's real pixel dimensions,
  captured so a scheduled row's cron fire can re-validate
  `validateImageForInstagram()` against the real image without needing the
  design to still exist.
- `SocialPublishStatus` gains `scheduled` and `canceled`.
- `designId` changes from a required `onDelete: Cascade` relation to a
  nullable `onDelete: SetNull` one — see "A scheduled post whose design was
  deleted," below, for why this was necessary rather than cosmetic.

`publishedAt` (existing column) is now genuinely distinct from
`scheduledFor` in practice, not just in the schema comment — "we meant to
post at 9am" (`scheduledFor`) and "we posted at 9:03am, because the cron's
own interval isn't instant" (`publishedAt`) are two different facts the
calendar and any support conversation can now tell apart.

`npx prisma validate` passes against a dummy `DATABASE_URL`. **Not pushed —
`npx prisma db push` was explicitly out of scope for this task.**

---

## What you need to add to vercel.json

This worktree was told not to edit `vercel.json`'s schedule. The entry
needed:

```json
{
  "path": "/api/cron/social-scheduled-publish",
  "schedule": "*/5 * * * *"
}
```

**Every 5 minutes** — frequent enough that a post scheduled for a specific
minute fires within a few minutes of it (matching the UX the picker already
promises: "at least 5 minutes out"), infrequent enough not to compete for
attention with the `*/15` voice crons. `BATCH_LIMIT = 25` per run bounds a
single invocation; anything left over is picked up by the next tick.

Declared in `scripts/check-route-callers.mjs`'s `NO_FRONT_DOOR` list in the
meantime, so `check:all` stays green while this gap stays *visible* rather
than silently passing — remove that entry once the cron entry above exists.

---

## Verification — hostile input, real outputs

All of the below were EXECUTED, not reasoned about — see
`scripts/check-designer-reach.mjs`'s new "8. Scheduling" section (35 new
assertions; 155 total in that file, up from 120; `npm run check:designer-reach`
exits 0). `NOW` is pinned to a fixed instant (`2026-08-31T12:00:00Z`) so
none of this races the real clock.

| Hostile input | Real output |
|---|---|
| A time in the **past** (`NOW - 60s`) | `isValidScheduleTime` → `false`. `validateInstagramSchedule` → `{ok: false, errors: ["invalid_schedule"]}`. |
| A time **under Facebook's 10-minute floor** (5 min out) | `isValidFacebookScheduleTime` → `false` (pre-existing, re-verified). `publishToFacebook` throws `PublishRefusal("invalid_schedule", "Choose a time between 10 minutes and 75 days from now.")` — before any client call. |
| A time **under FieldQuo's own 5-minute floor** (4 min out) | `isValidScheduleTime` → `false`. At exactly 5 minutes: `true` — the floor is inclusive. |
| A time **beyond Facebook's 75-day window** (76 days) | `isValidFacebookScheduleTime` → `false` (pre-existing, re-verified). At exactly 75 days: `true`. |
| A time **beyond FieldQuo's own 180-day window** (181 days) | `isValidScheduleTime` → `false`. At exactly 180 days: `true`. |
| A **DST boundary** — scheduling 3 real hours across the 2027-03-14 US/Canada spring-forward transition | `isValidScheduleTime` accepts it as 3 real hours, not 2 or 4 — both functions compare raw epoch milliseconds, never wall-clock field arithmetic, so a transition sitting between "now" and the target changes nothing. The 5-minute floor was also re-checked immediately across the same transition and stayed exactly 5 real minutes. |
| A **cron firing twice on the same scheduled post** | The claim's `updateMany({ where: { status: "scheduled", firingClaimedAt: null }, ... })`, exercised directly against a tiny in-memory table with real Prisma `updateMany` semantics: first claim → `count: 1`; a second claim on the same row → `count: 0`, row left exactly as the first claim set it. |
| A **scheduled post whose design was deleted** | The design DELETE route, executed for real against the in-memory store: the still-`scheduled` `SocialPublish` row is explicitly set to `status: "canceled"` with an `errorMessage` explaining why, in the SAME transaction as the design delete — never left silently `scheduled` for a design that no longer exists. An already-`published` row on the same design is left completely alone (a real outcome, not a pending one). |
| A **scheduled post whose connection was revoked** between scheduling and firing | `fireOne()`'s Case 1: `getMetaConnection()` re-fetched fresh at claim time (never trusted from the row); `!connection.connected` → row marked `failed` with an explicit message, never silently dropped or retried forever. |
| **Non-existent hostile case worth naming:** a demo company's `isDemo` somehow flipping between scheduling and firing | `fireOne()`'s Case 2: `connection.mock` (re-derived from `Company.isDemo`, fresh) compared against `row.isMock` (fixed at schedule time) — a mismatch is logged via `recordError()` and the row fails loudly rather than guessing which side is authoritative. |
| An **all-three-wrong** Instagram schedule request (empty caption, a 9:16 crop, a past time) | `validateInstagramSchedule` → `ok: false`, `errors` containing all three of `"empty"`, `"aspect_ratio"`, and `"invalid_schedule"` — not just the first one hit, so a form can show every problem at once. |

**Mutation testing — 4 new mutations this session (8 total across
`docs/SOCIAL-PUBLISHING.md`'s original 4 and these), all caught, each
reverted from a `cp` backup, never `git checkout`:**

| # | Mutation | Caught by |
|---|---|---|
| 5 | `isValidScheduleTime`: `t >= minMs` → `t > minMs` | "exactly 5 minutes out is accepted — the floor is inclusive" failed correctly |
| 6 | `isSocialPublishingVisible`: `Boolean(isDemo) \|\| Boolean(appConfigured)` → `&&` | Both the "demo without appConfigured" and "appConfigured without demo" assertions failed |
| 7 | `validateInstagramSchedule`: dropped the image-error push entirely | The non-compliant-crop assertion failed, AND the "reports EVERY problem" assertion failed on the errors array's actual content, not just a boolean |
| 8 | The cron's claim query: removed `firingClaimedAt: null` from the `WHERE` | The structural "claim's WHERE clause re-checks status and firingClaimedAt" assertion failed |

`npm run build` — exits 0 (`DATABASE_URL` set to a dummy value locally; a
real deploy has a real one). `npx prisma validate` — passes. `npm run
check:all` — exits 0, every existing check plus the new assertions above.

Three pre-existing checks had to be told about this change rather than
silently failing or being worked around: `check-route-callers.mjs` (the new
cron's missing vercel.json entry, see above), `check-tenant-scope.mjs` (the
cron's `db.socialPublish.update` calls are a cron-over-every-tenant shape,
declared the same way `appointment-reminders`' own updates already are), and
`check-nav-audit.mjs` (the calendar page is a drill-in from the campaign
editor's own button, declared like every other "opened from another page"
route). `check-designer-reach.mjs`'s in-memory Prisma stand-in also needed a
minimal `socialPublish`/`$transaction` shape added so the design DELETE
route's new step could keep executing against it rather than crashing the
check outright.

---

## What was not built

- **The Meta OAuth connect flow itself, and its Settings screen.** Unchanged
  from `docs/SOCIAL-PUBLISHING.md` — still explicitly a sibling worktree's
  job.
- **The vercel.json cron entry.** See "What you need to add to vercel.json"
  above — this worktree was told not to edit that file.
- **Confirmation that a Facebook post Meta's native scheduler holds actually
  went live.** FieldQuo hands the scheduling call to Meta and trusts Meta's
  own infrastructure to fire it — there is no polling or webhook here that
  confirms it happened, so `publishedAt` stays `null` on a natively-scheduled
  Facebook row even after its `scheduledFor` time passes. `scheduledFor`
  plus the row's `externalPostId` are what a support conversation has to
  work with for that case. A real confirmation loop (polling
  `GET /{post-id}?fields=is_published`, or a Meta webhook) is a genuinely
  separate, smaller follow-up if this gap matters in practice.
- **Reels, video, carousels, Stories.** Still out of scope, same reasoning
  as `docs/SOCIAL-PUBLISHING.md` — the calendar's own banner says this
  plainly rather than offering a tab that does nothing.
- **A "reschedule" control.** The calendar can cancel a scheduled post; it
  cannot edit one in place. Canceling and creating a new scheduled post from
  the design does the same job in two clicks instead of one — a smaller gap
  than the others above, and not named in the brief.

---

## Files

New:

- `lib/calendar/monthGrid.js` — the shared date-grid math (see "The
  calendar" above).
- `lib/social/mockMetaGraphClient.js` — the demo mock's Graph client (see
  "The demo mock" above).
- `app/api/cron/social-scheduled-publish/route.js` — fires due Instagram/
  demo rows, idempotently.
- `app/api/marketing/designer/social-schedule/route.js` (GET, company-wide,
  windowed) and `.../social-schedule/[id]/route.js` (DELETE, cancel).
- `app/app/marketing/designer/calendar/page.js` — the calendar page.

Changed:

- `prisma/schema.prisma` — see "Prisma schema" above.
- `lib/social/metaSpecs.js` — `FIELDQUO_SCHEDULE_MIN_MINUTES`/`MAX_DAYS`,
  `isValidScheduleTime()`, `isSocialPublishingVisible()`.
- `lib/social/metaConnection.js` — the demo branch (see "The demo mock").
- `lib/social/publishDesign.js` — `validateInstagramSchedule()`;
  `simulateFailure` threaded through `publishToInstagram`/`publishToFacebook`.
- `app/api/marketing/designer/designs/[id]/publish/route.js` — the
  visibility gate, scheduling branches per platform, mock/real client
  selection; also fixed a latent bug where a scheduled Facebook result's
  status was unconditionally overwritten to `"published"`.
- `app/api/marketing/designer/designs/[id]/route.js` — cancels still-
  `scheduled` rows before deleting their design.
- `app/components/designer/PublishModal.js` — the schedule picker, the
  demo-mock badge, the failure simulator.
- `app/components/designer/CampaignEditor.js` — the visibility gate, the
  Calendar link.
- `app/app/appointments/page.js` — now imports the extracted calendar
  helpers instead of defining its own copies.
- `app/i18n/appMessages.js` — new keys, English and French only, following
  `docs/SOCIAL-PUBLISHING.md`'s own precedent and reasoning for that scope.
- `scripts/check-designer-reach.mjs`, `scripts/check-route-callers.mjs`,
  `scripts/check-tenant-scope.mjs`, `scripts/check-nav-audit.mjs` — see
  "Verification" above.
- `docs/ROADMAP.md` — updated in place.
