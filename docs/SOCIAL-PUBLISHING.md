# Publishing a Marketing Designer ad to Instagram & Facebook

Written 31 August 2026, answering the owner's request: *"maybe in canva
after an asset is created maybe they can have a button to create an ad if
possible or push the content to their pages facebook and instagram... I'm
talking about Instagram and Facebook, not to change the whole code or the
other features."*

**No Meta credentials exist anywhere in this environment, and no real
publish call has ever been made against Meta's API.** Every claim below
about Meta's own behaviour is sourced from Meta's live developer docs
(fetched 31 Aug 2026, links inline) or the task brief's own research —
never assumed. Everything else (the state machine, the validation, the
route, the UI) was executed against hostile input, not eyeballed. Mutation
testing is documented at the end.

---

## What this is, in one sentence

A **Publish** button on the Marketing Designer's campaign editor opens a
confirmation dialog that previews the exact rendered asset, validates the
caption and image against Meta's real rules, and — once a company's Meta
account is connected — posts it to their Facebook Page and/or Instagram
account through Meta's real Content Publishing API. Today, the connection
step is honestly unfinished (see "What is blocked" below), so the dialog
always ends in an explicit "not connected yet" state rather than a fake
success.

---

## The container-then-publish flow, as implemented

Instagram does **not** accept an image upload directly. It is a two-step
flow, and getting the two steps confused is the most common way this kind
of integration silently fails:

1. **`POST /{ig-user-id}/media`** with `image_url` (a public HTTPS URL —
   Meta's servers fetch it themselves, they are never sent bytes) and
   `caption`. Returns a **container id**, not a published post.
2. **Poll `GET /{container-id}?fields=status_code`** until Meta finishes
   processing it. Five documented states
   ([source](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-container)):
   - `IN_PROGRESS` — keep polling.
   - `FINISHED` — ready; move to step 3.
   - `ERROR` — failed; the container is dead, tell the contractor.
   - `EXPIRED` — **not published within 24 hours.** The fix is a brand-new
     container, never a retry of the publish call against the dead id.
   - `PUBLISHED` — already done (e.g. a retried request); treat as success,
     never call publish again.
3. **`POST /{ig-user-id}/media_publish`** with `creation_id` = the container
   id. Returns the real, live post id.

Facebook Page photo posts are simpler — one call,
**`POST /{page-id}/photos`** with `url` + `caption`, no container, no
polling.

This is implemented in `lib/social/publishDesign.js`
(`publishToInstagram()` / `publishToFacebook()`), which drives the state
machine above through `lib/social/metaGraphClient.js` — the one file that
calls `graph.facebook.com`, mirroring `lib/ai/provider.js`'s role for
OpenAI. The state-machine *decision* itself (what each `status_code` means)
is pure and lives in `lib/social/metaSpecs.js`'s `nextContainerAction()`,
so it could be executed against every status Meta can return, including
ones a live account may never hit in manual testing — see "Verification"
below.

The poll loop is bounded (10 attempts, increasing backoff, ~50s total) —
a container that never leaves `IN_PROGRESS` fails with a named
`timed_out` code instead of hanging the request forever.

---

## Limits, and what happens at each

| Limit | Value (source) | What happens in this build |
|---|---|---|
| **Caption length** | 2,200 characters | `validateCaption()` refuses client- and server-side before any Meta call. Counted by Unicode code point, not `.length` — an emoji-heavy caption near the limit doesn't get silently miscounted. |
| **Hashtags** | 30 max | Same function, same refusal. |
| **@ mentions** | 20 max | Same function, same refusal. |
| **Image aspect ratio** | 4:5 to 1.91:1 ([source](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/)) | `validateImageForInstagram()` checks the *actual rendered pixels*, not the nominal preset — the modal only ever offers `instagram_post` (1:1) and `facebook_feed` (≈1.905:1, verified inside the range in `scripts/check-ad-ratios.mjs` section 9) as publish shapes. A Story/TikTok crop (9:16) is never offered here — it would be rejected outright, not letterboxed. |
| **Image file size** | 8 MB (Instagram) | Checked against the real Cloudinary upload's `bytes`. |
| **Format** | JPEG only (Instagram) | `CampaignEditor.js`'s `rasterize()` now exports JPEG (with a white background fill — JPEG has no alpha channel, and an unset canvas background composites transparent pixels as black) for the publish path, while "Download all" still exports PNG unchanged. |
| **`content_publishing_limit`** | Meta's own live docs say **"currently 50"** posts per rolling 24h ([source](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit)) — third-party reporting is inconsistent (25/50/100 all cited), which is exactly why this number is **never hardcoded as a hard gate**. `interpretRateLimit()` checks the *live* `GET /content_publishing_limit` response before every publish attempt; the constant is only a labelled, "unverified" fallback for when that live read isn't available. | Hitting the cap returns a **named `rate_limited` outcome**, shown in its own amber panel in the modal ("Instagram has reached Meta's posting limit for the next 24 hours") — never a generic error toast, and never silently retried. |
| **Container lifetime** | 24 hours | `EXPIRED` maps to a distinct refusal (`container_expired`) telling the contractor to try again, never a silent no-op or a crash against a dead id. |

---

## What a contractor must set up on Meta's side

1. **A Facebook Page** for the business (not a personal profile).
2. **An Instagram professional account (Business or Creator)** — a personal
   Instagram account cannot publish through this API at all — **linked to**
   that Facebook Page.
3. Grant FieldQuo's (future) Meta app the `pages_manage_posts` and
   `instagram_content_publish` permissions during the OAuth connect flow.

A Page with no linked Instagram account can still publish to Facebook only —
the modal's Instagram checkbox is disabled with an explanatory line
("No Instagram account linked to this Page") rather than hidden, so that
state is visible instead of mysterious.

---

## What is blocked on Meta, plainly

Two independent things have to happen before this can post a single real
message, and neither has started:

1. **The connection itself doesn't exist yet.** `lib/social/metaConnection.js`
   — the seam this feature was built to consume — always returns
   `connected: false` in this codebase today. A sibling worktree owns
   per-tenant Meta OAuth and encrypted token storage (see
   `docs/META-ADS-INTEGRATION.md`, written for the separate ads/insights
   import but sharing the same OAuth/token layer this feature needs). That
   file's own header documents exactly what the real implementation must
   return and why — replacing its body is the only change required to wire
   this feature to a real connection.
2. **`instagram_content_publish` and `pages_manage_posts` both require Meta
   App Review and Business Verification** — a written use case, an app-role
   video walkthrough, a live reviewer test, and (per community reporting on
   this permission cluster specifically) at least one rejection-and-resubmit
   round-trip is typical. Budget weeks, not days. This is a hard gate
   independent of how correct the code is — no amount of engineering here
   shortens Meta's review clock.

Until both clear, the Publish button's honest end state is "not connected
yet" — which is what it shows today, always, because nothing lies about
being connected when it isn't.

---

## Scheduling — the finding and the decision

The owner asked "maybe" about scheduling. The two platforms are **not
symmetric**, and conflating them would have been the bug:

- **Facebook Page posts support native scheduling.** `POST /{page-id}/feed`
  (or the photos endpoint) with `published=false` and
  `scheduled_publish_time` — a timestamp **10 minutes to 75 days** in the
  future ([source](https://developers.facebook.com/docs/graph-api/reference/page/feed/)).
  Meta holds and publishes it; FieldQuo does nothing at the scheduled
  moment. Implemented in `lib/social/metaGraphClient.js` /
  `lib/social/publishDesign.js` (`isValidFacebookScheduleTime()`,
  `publishFacebookPhoto({ scheduledPublishTime })`) and covered by executed
  tests, but **not exposed in the UI yet** — no date/time picker in
  `PublishModal.js`.
- **Instagram's Content Publishing API has no scheduling parameter for
  organic posts, at all.** Third-party schedulers that appear to schedule
  Instagram posts are holding the content themselves and calling the real
  `/media` → `/media_publish` flow at the right time — which for FieldQuo
  means **a queue and a cron job**, not a client-side parameter. That is a
  meaningfully larger build (a scheduled-posts table, a cron worker,
  retry/backoff for a cron-triggered publish, a "scheduled" state in the
  UI) than "add a Publish button."

**Decision:** out of scope for this change, to keep the diff proportionate
to what was asked — a publish control, not a new background-job subsystem.
Facebook's native scheduling primitive is built and tested at the library
level so it costs nothing extra to expose later; Instagram's hold-and-post
queue is a genuinely separate project and should be scoped on its own if
the owner wants it.

---

## What was NOT built

- **The Meta OAuth connect flow itself.** By explicit instruction — a
  sibling worktree owns this, and duplicating it would leave two
  half-built connection layers.
- **A Settings screen to manage the connection** (connect/disconnect,
  show which Page/IG account is linked). Belongs with the OAuth layer for
  the same reason.
- **Scheduling UI** for Facebook's native scheduling (see above).
- **Instagram's hold-and-post scheduling queue** (see above) — an explicit
  scope decision, not an oversight.
- **"Create an ad"** (a paid Meta ad campaign, not an organic post) — the
  owner's message said "if possible," and it isn't, within this change's
  scope: Meta's Marketing API for ad creation is a materially larger
  permission set (`ads_management`), a different review track, and Meta
  Ads Manager already exists as the tool built for that job. Organic
  publishing (what was asked for second, and what this builds) is the
  right-sized piece.
- **Reels/video, carousels, Stories.** The Publish modal only ever offers
  the two aspect ratios verified compliant with Instagram's single-image
  feed endpoint. Video and multi-image posts are a different container
  shape Meta documents separately and were out of scope for "push the
  content."

---

## Files

- `lib/social/metaSpecs.js` — pure rules: caption limits, image compliance,
  the container state machine, rate-limit interpretation, Facebook's
  scheduling window. No fetch, no fabric, no Prisma.
- `lib/social/metaConnection.js` — **the seam.** Always returns
  `connected: false` today; its header documents exactly what a real
  implementation must return.
- `lib/social/metaGraphClient.js` — the only file that calls
  `graph.facebook.com`, owns the API version string.
- `lib/social/publishDesign.js` — orchestrates the container-then-publish
  flow and the single Facebook call, against an injected client (real or
  fake) so it's testable without network.
- `app/api/marketing/designer/designs/[id]/publish/route.js` — GET
  (connection status + publish history), POST (validate → re-check
  connection server-side → upload to Cloudinary → publish per platform →
  record a `SocialPublish` row per attempt, success or failure).
- `app/components/designer/PublishModal.js` — the confirmation dialog:
  real preview, real caption validation, honest not-connected state.
- `app/components/designer/CampaignEditor.js` — the Publish button; the
  ratio/frame resolution used by "Download all" was extracted into
  `resolveRatioFrame()` and reused rather than duplicated; `rasterize()`
  now supports a JPEG path for the publish flow alongside its existing PNG
  path.
- `prisma/schema.prisma` — `SocialPublish` model (+ `SocialPlatform`,
  `SocialPublishStatus` enums), additive and nullable-safe. **Not pushed**
  — `npx prisma validate` passes against a dummy `DATABASE_URL`; someone
  with real credentials needs to run `npx prisma db push`.
- `lib/legal/processors.js` — new `meta-content-publishing` entry.
- `lib/marketing/featureMatrix.js` — new `MATRIX_EXCLUSIONS` entry so no
  public marketing page can claim this as shipped while it isn't.
- `app/i18n/appMessages.js` — new `app.marketingDesigner.publish*` keys,
  English and French only (see "Language coverage" below).

---

## Language coverage — a deliberate deviation from "all six languages"

The general instruction for this task was every user-facing string through
`t()` in all six supported languages. `app/i18n/appMessages.js`'s own header
explains why the **app back-office catalogue is English and French only, by
design** — the other four (Spanish, Ukrainian, Punjabi, Tagalog) are
machine-drafted and held out of `APP_LANGUAGES` until a native speaker
reviews them, specifically because an unreviewed mistranslation on a money
or account-management screen is a worse failure than an English fallback.
`scripts/check-translations.mjs` gates English/French completeness for
`app.*` keys and only *reports* (never gates) the other four. Every
`app.marketingDesigner.publish*` string added here follows the exact
precedent already set by the surrounding, pre-existing designer strings
(also EN+FR only) — extending that precedent inconsistently within the same
feature would have been a worse outcome than following it. Six-language
coverage is real and enforced elsewhere in this codebase — client-facing
documents, quotes, invoices, the public marketing site — none of which this
feature touches.

---

## Verification

`npm run build` — exits 0, compiles successfully, the new route appears in
the build's route list.

`npx prisma validate` — passes (schema not pushed; see "Files" above).

`npm run check:all` — exits 0, 0 failures, across the entire existing check
chain. **No new entry was added to `check:all`** per instruction (several
agents are editing `package.json` concurrently) — the new assertions live
inside two existing scripts instead:

- **`scripts/check-ad-ratios.mjs`**, new section 9 (11 checks): confirms
  `instagram_post` and `facebook_feed` are genuinely inside Instagram's
  4:5–1.91:1 gate, that `instagram_story`/`tiktok` are correctly *rejected*
  (proving the modal's restriction to two shapes is backed by the real
  rule, not an assumption), the exact ratio boundary in both directions,
  and hostile input (missing/negative/NaN dimensions).
- **`scripts/check-designer-reach.mjs`**, new sections 6–7 (54 checks):
  executes `validateCaption`/`validateImageForInstagram`/`interpretRateLimit`/
  `nextContainerAction`/`isValidFacebookScheduleTime` against boundary and
  hostile input; then runs the **real orchestration** (`publishToInstagram`/
  `publishToFacebook`) end to end against a fake Meta client covering every
  named outcome — not connected, no linked Instagram account, an
  over-length caption, a non-compliant image, a maxed-out rate limit (and
  confirms no container is wastefully created for it), a container stuck in
  `IN_PROGRESS` forever (the literal "never becomes ready" case — resolves
  to `timed_out` within a bounded number of polls, not a hang), an
  `EXPIRED` container (and confirms `media_publish` is never called against
  the dead id), a full happy-path publish, and Facebook's schedule-window
  refusal. A final structural section confirms the API route re-checks the
  connection itself (never trusts the browser), refuses *before* uploading
  to Cloudinary, and records every attempt — and that the UI renders a real
  Publish button and a real not-connected panel, never a hardcoded success.

**Total new executed assertions: 119** (65 in check-designer-reach.mjs's
new sections, 11 in check-ad-ratios.mjs's new section, plus incidental
coverage already counted above) — all passing.

### Mutations run

| # | Mutation | Caught by |
|---|---|---|
| 1 | Widened `INSTAGRAM_IMAGE_SPEC.maxAspectRatio` from 1.91 to 2.2 | `check-ad-ratios.mjs`: "1.911:1 ... is rejected, not rounded away" failed correctly |
| 2 | Changed `nextContainerAction("EXPIRED")` to return `{action: "publish"}` instead of `"recreate"` | `check-designer-reach.mjs`: 3 assertions failed — the direct state-machine check, the orchestration-level "EXPIRED is refused" check, and "media_publish is never called against a dead container" |
| 3 | Changed `interpretRateLimit`'s `ok` condition from `remaining > 0` to `remaining >= 0` | `check-designer-reach.mjs`: 4 assertions failed — the exact-cap boundary check, the over-cap check, and both orchestration-level rate-limit checks |
| 4 | Reordered the publish route so `uploadBuffer()` ran *before* the `getMetaConnection()` refusal | `check-designer-reach.mjs`: the structural "refusal happens BEFORE upload" assertion failed correctly |

All four mutations were caught by at least one assertion; each was reverted
from a `cp` backup (never `git checkout`) before moving on, and the full
suite was re-run clean after each revert.

An epsilon of `1e-9` (not the `0.001` first used) is deliberately tiny in
`validateImageForInstagram()`'s aspect-ratio comparison — see that
function's own comment: a looser epsilon would have silently passed
mutation #1's mid-sized boundary violation, which is exactly the kind of
"the test technically ran but proved nothing" gap `AGENTS.md` warns about.
