# Meta Ads integration — what got built, 31 August 2026

The owner's instruction, verbatim: *"if there is a way to integrate that
facebook marketing into fieldquo, do it. You got my permission. If we can see
insights and even create ads even better."* `docs/META-ADS-INTEGRATION.md`
(the research pass immediately before this one) recommended deferring the
Meta import in favour of three smaller, Meta-free builds. The owner's
instruction overrides that recommendation — this document is the build that
followed, not a second opinion on whether to do it.

**Read `docs/META-ADS-INTEGRATION.md` first if you haven't.** Everything it
found about App Review timelines, rate limits, the attribution gap, and the
Marketing-API-vs-Conversions-API distinction still stands; this document
covers what was actually built on top of those findings, and does not repeat
the research.

**The one sentence that matters most:** this codebase has **no Meta App ID,
no App Secret, and no test ad account**, anywhere. Every line of code below
was written and pure-function-tested against hand-built, hostile input. Not
one HTTP request has ever been made to `graph.facebook.com`. That is not a
gap in this pass — it is the honest state of a Meta integration built before
the owner has created a Meta app and submitted it for review, which takes
weeks (`docs/META-ADS-INTEGRATION.md` Part 0).

---

## 1. What's live right now, with zero Meta configuration

These needed no Meta API access, no App Review, and no new processor entry.
They ship today, in this commit, working:

- **Manual marketing-spend entry** — `app/app/marketing/spend/page.js`. Every
  `MarketingPlatform` (`facebook`, `google`, `tiktok`, `pamphlet`, `referral`,
  `other`), not just Meta. `/api/marketing-spend` already had full CRUD and no
  screen called it (`docs/TODO.md`, `scripts/check-route-callers.mjs`'s old
  `NO_FRONT_DOOR` entry) — that gap is closed, and the monthly digest stops
  reporting $0 spend forever.
- **Blended cost-per-lead** — `lib/analytics/kpis.js`'s
  `buildBlendedCostPerLead()`. Total marketing spend across every channel,
  divided by real `LeadRequest` rows for the same period (`manual`/`imported`
  sources excluded from the denominator and reported as `excludedCount`, never
  silently dropped). This is Level 1 from
  `docs/META-ADS-INTEGRATION.md` Part 2 — it never claims which channel
  produced which lead, only a real total over a real total. It replaced a
  pre-existing bug: the monthly digest's old `blendedCostPerLead` was
  `spend ÷ MarketingSpend.leads` — the same hand-typed, per-channel figure
  `kpis.js`'s `NOT_TRACKED.costPerLead` already refuses to trust — and once the
  entry screen above shipped, that flawed number would have started printing
  real-looking output for the first time. Fixed alongside it
  (`lib/ai/monthlyDigest.js`, `lib/analytics/marketingRollup.js`).
- **`LeadRequest.lostReason`** — a closed vocabulary
  (`lib/leads/pipeline.js`'s `LOST_REASONS`: `lost_to_competitor`,
  `price_too_high`, `timing_not_right`, `not_real_inquiry`, `no_response`,
  `other`). Moving a lead to Lost — drag board or drawer button, either path —
  now requires picking a real reason; the server refuses the transition
  without one (`canSetLeadStatus`'s new `"lost"` branch,
  `app/api/leads/route.js` and `app/api/leads/[id]/route.js`). This is
  `docs/META-ADS-INTEGRATION.md` Part 2b's recommended design (option 2:
  ground truth a human recorded, reversible), not the heuristic-filtering
  design it explicitly rejects.
- **The false "shipped" marketing claim, fixed regardless of Meta** —
  `lib/marketing/featureMatrix.js`'s `marketing_spend` entry said "against the
  jobs it actually brought in," which was never true (nothing links a
  channel's spend to a specific lead) and would have stayed live indefinitely
  — `scripts/check-feature-matrix.mjs` only proves the proof files exist and
  contain the named string, not that the summary sentence is honest. Reworded
  to the real claim (blended, not per-channel) and marked `readiness:
  "partial"` with a real `limits` note — the file's own rule is that a
  `"shipped"` entry may not carry one.

None of the above touches Meta's API, needs App Review, or adds a processor.

## 2. What's built but INERT until Meta approves the app

Everything under `lib/meta/` and `app/api/meta-ads/*`, plus
`app/app/settings/meta-ads/page.js`. Real, complete code — OAuth flow, token
storage, the insights sync, error classification — that **cannot function in
production today** because two things don't exist yet:

1. A Meta App ID and App Secret (`META_APP_ID`, `META_APP_SECRET`) — nobody
   has created a Meta app for FieldQuo.
2. Even once created, that app can only read a FieldQuo developer's OWN test
   ad account in Meta's **Development** access tier (60 points per ad
   account, 300-second block on exhaust) until `ads_read` clears **App
   Review** — a real, multi-week process (Part 0).

**What a contractor sees today, with none of this configured:** Settings →
Meta Ads shows *"Not set up yet — FieldQuo hasn't been approved by Meta as an
advertiser-facing app on this deployment."* No Connect button renders. This is
the deliberate, honest degrade the brief asked for — see §5.

## 3. The multi-tenant OAuth flow, as built

Per-company, not per-user — `MetaAdConnection` is `companyId`-unique, the same
shape as `Company.stripeAccountId` for Stripe Connect
(`docs/META-ADS-INTEGRATION.md` Part 3), not Better Auth's per-user `Account`
table. One FieldQuo-owned Meta app; each company's owner/admin authorises it
against **their own** ad account.

1. **`POST /api/meta-ads/connect`** (owner/admin only —
   `isBillingAdmin(member.role)`, same gate as Stripe Connect). Refuses with a
   clear message if `metaFullyConfigured()` is false. Otherwise generates a
   CSRF `state`, stores `state:companyId` in an httpOnly cookie
   (`lib/meta/oauthCookies.js`), and returns Meta's OAuth dialog URL,
   requesting **`ads_read` only** — never `ads_management`.
2. **`GET /api/meta-ads/callback`** — Meta's redirect target (no in-app
   caller; declared in `scripts/check-route-callers.mjs`'s
   `EXTERNAL_CALLERS`, same as the Stripe webhooks). Verifies `state` against
   the cookie AND that the current session's `companyId` still matches the one
   that started the flow (catches a company switch mid-flow). Exchanges the
   code for a short-lived token, then a long-lived one (~60 days), lists the
   account's ad accounts:
   - **Zero** → redirects with `metaError=no_ad_accounts`.
   - **One** → saves the connection immediately, redirects with
     `metaConnected=1`.
   - **More than one** → the token goes into a second httpOnly cookie
     (`meta_oauth_pending_token`) — **never into the redirect URL** — and the
     browser lands on the settings page with the account list (id/name/
     currency only) to choose from.
3. **`POST /api/meta-ads/finalize`** — only reached from the picker above.
   Reads the pending-token cookie, confirms the chosen account with Meta, and
   is the one place `saveConnection()` (hence `encryptToken()`) actually
   fires for the multi-account path.
4. **`POST /api/meta-ads/disconnect`** — deletes the `MetaAdConnection` row
   outright (not a status flip). Rows already imported into `MarketingSpend`
   are untouched.

## 4. Token storage — what's encrypted, and how

`MetaAdConnection.accessTokenEnc` is `base64(12-byte IV | 16-byte GCM auth tag
| ciphertext)`, AES-256-GCM, written and read only through
`lib/meta/tokenCrypto.js`. The key comes from a **dedicated**
`META_TOKEN_ENCRYPTION_KEY` env var (32 bytes, hex or base64) — deliberately
**not** `BETTER_AUTH_SECRET`. Reusing the session secret would mean a routine
security response (rotating it after a leaked cookie) silently corrupts every
stored Meta token with no error until the next sync tries to decrypt one; a
dedicated key can rotate independently. `tokenCryptoConfigured()` reports
whether a real key is set, and gates the Connect button the same way
`metaAppConfigured()` does — both must be true before "Connect Meta Ads" does
anything but explain what's missing.

**A raw access token is never in plain text at rest, in a log, or in a URL.**
The multi-account picker's intermediate cookie holds the token in plaintext
for the few seconds between the OAuth callback and the finalize call — that's
an httpOnly, secure cookie scoped to this one round trip (10-minute expiry),
the same trust boundary the CSRF `state` cookie already relies on, not a new
one.

## 5. What happens on expiry, revocation, or a Meta-side error

The brief's own words: *"a dead integration silently reporting $0 spend is
worse than no integration."* `lib/meta/client.js`'s `classifyMetaError()` is
the single place every Meta error response gets read, and
`app/api/meta-ads/sync/route.js` acts on the classification rather than
treating every failure the same:

| Meta says | `MetaAdConnection.status` becomes | What the settings screen shows |
|---|---|---|
| Token expired/revoked (`code 190`, HTTP 401) | `needs_reauth` | Amber banner, "reconnect to keep syncing," a **Reconnect** button (re-runs the OAuth flow) |
| Rate-limited (`code 4/17/32/613`, HTTP 429) | unchanged (`connected`) | Nothing — a transient block isn't a broken connection, and telling someone to reconnect for a problem reconnecting doesn't fix would be a false lead |
| Ad account not found (`code 803`, HTTP 404) | `error` | Red banner with the real message |
| A locally corrupted/undecryptable token | `error` | "Stored token could not be read — try disconnecting and reconnecting" — **not** `needs_reauth`, because reconnecting through Meta's consent screen doesn't fix a local decryption failure |
| Anything else unrecognised | `error` | The real message, not a swallowed 500 |

`Sync now` is disabled while `status === "needs_reauth"` — clicking it would
just fail the same way again. The monthly digest and the marketing-spend page
never show a Meta-derived `$0` for a broken connection; a broken connection
shows as broken (`lastSyncError` on the row), not as an honest-looking zero.

## 6. The import itself — `lib/meta/insightsImport.js`

Pure transform, no db, no fetch (same discipline as
`lib/expenses/csvImport.js`, which is its explicit precedent):

- `GET /act_<id>/insights`, `level: "campaign"`, `time_increment: 1` (one row
  per campaign per day), fields `campaign_id, campaign_name, spend,
  impressions, clicks, actions`. One page, `limit: 500` — **no pagination
  beyond the first page**, a real gap for an account with more campaign-days
  than that in one sync window (see §8).
- Writes into the **existing** `MarketingSpend` model — three new nullable
  columns, no new spend table:
  - `source: "manual" | "meta_api"` — the sync never touches a row it didn't
    write; `app/api/marketing-spend/[id]/route.js`'s `PATCH` explicitly
    refuses to edit a `meta_api` row (409, "wouldn't stick past the next
    sync") rather than silently letting an edit get overwritten next sync.
  - `externalId: "<campaignId>:<date>"` — lets a re-run of the sync **update**
    the same row instead of inserting a duplicate. Unique together with
    `(companyId, source)`; Postgres treats NULL as distinct per row in a
    unique index, so manual rows (externalId always null) are never
    deduplicated against each other by this constraint. New `meta_api` rows
    are written with `upsert` on that same compound key, not `create` — two
    overlapping syncs (a double-click on "Sync now," two open tabs) can race,
    and the loser hitting a bare `create()` on a row the winner just inserted
    would 500 the whole request instead of quietly re-applying the same
    figures the winner already wrote.
  - `currency` — set **only** when the ad account's own reporting currency
    (from Meta) differs from `Company.currency`. Null means "the company's own
    currency" for both manual and synced rows. A mismatched row is still
    imported (hiding a contractor's own spend would be worse) but is excluded
    from every blended/channel total (`lib/analytics/marketingRollup.js`) and
    shown separately, never converted — there is no FX rate anywhere in this
    codebase to convert with, and inventing one would be a fourth kind of
    fabricated number in a file that exists to refuse those.
- **Meta's own reported leads never touch `MarketingSpend.leads`** — that
  column is the hand-typed, contractor-entered figure `kpis.js` already
  distrusts. Meta's lead-shaped `actions` (action_type `lead`,
  `onsite_conversion.lead_grouped`, `offsite_conversion.fb_pixel_lead`) are
  summed into `.conversions` instead — a column that already means "the
  platform's own count of an outcome," labelled as Meta's own number in the
  UI, never merged with FieldQuo's real `LeadRequest` count.
  `docs/META-ADS-INTEGRATION.md` Part 2's rule — "refuse to compute or
  display cost-per-*FieldQuo*-lead... exactly as `NOT_TRACKED` already
  refuses `costPerLead`" — is why there is no per-Meta-campaign cost-per-lead
  anywhere in this build, only the blended, channel-agnostic figure from §1.
- **Duplicate detection is source-blind**, matching
  `lib/expenses/csvImport.js`'s `naturalKey()` exactly in spirit:
  `naturalKey({ platform, date, campaignName })` never includes `source` or
  `externalId`. A manual entry logged for "Facebook, Aug 15, Spring Sale"
  before the company ever connected Meta, and a later synced row for the same
  day and campaign, produce the same key — surfaced to the sync's caller as a
  `possibleDuplicates` entry, **never auto-merged or silently dropped**. The
  settings screen's sync summary says how many; nobody has to go hunting.

## 7. What Meta's own consent screen shows — the white-label question

`docs/META-ADS-INTEGRATION.md` Part 3 already answered this and it's worth
restating because it's the one genuinely good news item in an otherwise heavy
set of constraints: **connecting a Meta ad account is entirely a `/app`
action.** The person who clicks "Connect Meta Ads" is the same person who
already sees "FieldQuo" throughout the back office every day. Facebook's own
OAuth dialog does say "FieldQuo wants to access your ad account," but the
person reading that screen is the contractor's own owner/admin, not their
client — there is no homeowner anywhere in this flow, and nothing built here
touches `/quote/*`, `/book/*`, `/portal/*`, or `/site/*`. Non-negotiable #1
never comes into tension with this feature. The one thing actively guarded
against: no Meta-sourced number or name is rendered anywhere a client could
see it — there's no plan to build that, and this is written down as a
boundary for whoever gets the next request to "show the client their ad
performance too."

## 8. What was NOT built, and why

- **Pagination past the first 500-row page of `/insights`.** A small
  contractor's campaign count fits in one page for any reasonable sync
  window; a genuinely large account would silently miss rows past it. Not
  built because nobody has a real ad account to test pagination against yet
  — building it blind, with no way to verify the `paging.next` cursor
  actually works, would be exactly the "control that appears to work"
  AGENTS.md is written against. Flagged, not built.
- **An automatic scheduled sync (cron).** The sync is a manual "Sync now"
  button only. `vercel.json` was not touched — adding a cron entry against an
  integration that has never made a real API call means the first real test
  of the whole pipeline would be unattended, at 3am, against production
  credentials nobody has watched work once. Once a real Meta app exists and a
  developer has run "Sync now" successfully against it by hand, a daily cron
  is a small follow-up (see the multi-tenant fan-out pattern
  `app/api/cron/voice-outbound/route.js` already uses).
- **Level 3 attribution — UTM capture, tagged links, call tracking for the
  phone channel.** Explicitly out of scope per
  `docs/META-ADS-INTEGRATION.md` Part 2: a separate, larger project (new
  schema, new capture points on every public form, a matching layer, a
  call-tracking build for `phone_agent` leads) that the research recommends
  deciding on its own, not as a Meta-import side effect.
- **The Conversions API.** Explicitly excluded by the brief's own
  non-negotiable. It sends hashed homeowner PII (email, phone) to Meta for ad
  optimisation — a materially different privacy decision from reading a
  company's own spend, and one homeowners never agreed to. Nothing in this
  build sends anything to Meta; every Meta call in `lib/meta/client.js` is a
  `GET`.
- **Ad creation (`ads_management`).** The owner asked for this too — *"even
  create ads even better"* — and it was the fourth, explicitly last-priority
  item in the brief's own ordering ("only if steps 1–3 are solid... if you
  run out of room, say so rather than half-building it"). It wasn't reached.
  Building it properly needs, at minimum: a heavier App Review submission
  (`ads_management` is scrutinised harder than `ads_read` —
  `docs/META-ADS-INTEGRATION.md` Part 0), a creative-upload flow (image/video
  to Meta, not just numbers back), a campaign/ad-set/ad hierarchy UI, budget
  controls with a real confirmation step (this spends a contractor's own
  money), and its own error/retry design distinct from the read-only sync
  built here. None of that exists. **Saying so here, rather than shipping a
  half-built "Create ad" button, is the deliberate choice** — AGENTS.md's
  rule is explicit that a `Coming soon` panel is honest and a dead button is
  not, and the same reasoning applies to a feature area, not just a control.

## 9. The exact App Review submission the owner needs to make

From `docs/META-ADS-INTEGRATION.md` Part 0/4, made concrete:

1. **Create a Meta app** at [developers.facebook.com](https://developers.facebook.com/),
   type "Business." Add the **Marketing API** product.
2. **Business Verification** — required before Advanced Access to any
   permission that reads another business's data (this integration, by
   definition — a contractor's ad account, not FieldQuo's own). Submit
   FieldQuo's real legal business documents through Meta Business Manager.
   The name submitted must exactly match what's registered elsewhere in
   Meta's systems, or it stalls.
3. **Request `ads_read` Advanced Access** (not `ads_management` — this build
   never asks for it). Meta's App Review for this permission asks for:
   - A **screen-recorded walkthrough** of the exact flow this codebase
     implements: click "Connect Meta Ads" in Settings, land on Meta's OAuth
     dialog, approve, land back on the settings screen showing spend.
   - A **written use case**: "FieldQuo is software field-service contractors
     (painters, cabinet makers, flooring installers, etc.) use to run their
     business. A contractor who advertises on Meta connects their own ad
     account so their spend and campaign performance appear alongside their
     other business numbers inside FieldQuo. FieldQuo only reads
     — `ads_read` — and never creates, edits, or pauses a campaign."
   - Meta may run a **live test** of the flow against a real (or sandboxed)
     ad account — this is the point at which `META_APP_ID`/`META_APP_SECRET`
     need to exist and this code needs to have been run at least once by a
     developer, successfully, end to end.
4. **Set `META_APP_ID`, `META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY`** in
   Vercel (`docs/VERCEL.md` — added to the "Outstanding" table by this pass).
   Generate the encryption key with `openssl rand -base64 32`.
5. **Budget weeks, not days**, and expect at least one rejection-and-resubmission
   round trip — `docs/META-ADS-INTEGRATION.md` Part 0 cites 2025–2026
   community reporting describing this specific permission cluster as
   unusually friction-heavy, with a rebuilt one-appeal-per-rejection flow.
6. Once approved: every company that had already connected in Development
   tier keeps working (their token doesn't change); every company connecting
   for the first time now goes through the same flow at Meta's production
   rate limits (9,000 points/60s, up from 60/300s) rather than Development's.

## 10. Legal / compliance

`lib/legal/processors.js` gained a `meta-marketing-api` entry — `ads_read`
token + which ad account id is connected flow to Meta; a company's own spend,
campaign names, and performance figures flow back. Explicitly states no
homeowner data is involved and no Conversions API is used.
`scripts/check-legal-pages.mjs` verifies the entry's pattern
(`graph.facebook.com`) is genuinely present in `lib/meta/client.js` — it
can't be added to the privacy page without the integration existing to prove
it, which it now does. The privacy page renders it automatically
(`PROCESSORS.map`); no manual edit to the page itself was needed.

## 11. Mutation testing — what was actually run

Every pure function this build added was executed against hostile input, and
then mutated on disk to confirm the assertions are load-bearing (not just
present) — the same `execFileSync` re-run-as-subprocess technique
`scripts/check-kpis.mjs` and `scripts/check-statements.mjs` already use.

- **`lib/meta/insightsImport.js` and `lib/meta/client.js`** —
  `scripts/check-meta-insights.mjs` (new). 31 assertions against hostile
  input (missing/garbage Meta fields, `date_start`/`date_stop` disagreement,
  a non-array `rawRows`, a currency mismatch, a re-sync of an already-synced
  day, a manual/Meta near-duplicate, every one of Meta's error-code families,
  a completely empty error body). 6 mutations, all caught: source-blind
  duplicate detection disabled, the day-mismatch guard removed, re-sync
  duplicating instead of updating, a same-currency row wrongly tagged, an
  expired-token error misclassified, and the OAuth scope silently widened
  past `ads_read`. **Not wired into `npm run check:all`** — run by hand:
  `node --import ./scripts/alias-loader.mjs scripts/check-meta-insights.mjs`.
  Left out of the chain deliberately: the brief for this pass said other work
  was mid-flight on `package.json` and not to add an entry there. Whoever
  picks that up next should add `"check:meta-insights"` to both `package.json`
  and the `check:all` chain — the script is ready for it.
- **`lib/analytics/kpis.js`'s `buildBlendedCostPerLead`** — added directly
  into `scripts/check-kpis.mjs`'s existing, already-wired-into-`check:all`
  mutation harness. 4 new fixture assertions (no leads at all, only
  manual/imported leads, real mixed-source leads, zero spend with real
  leads — the "honest $0" case) plus 2 new mutations (manual/imported leads
  counted toward the denominator; a zero-lead period printing a number
  instead of refusing), both caught. `npm run check:kpis`.
- **`lib/leads/pipeline.js`'s `canSetLeadStatus` "lost" branch** — added to
  the existing `scripts/check-leads-drag.mjs` (already in `check:all`).
  Pure-function assertions for the new gate (no reason at all, an invalid
  reason code, a valid new reason, an existing reason surviving a re-drag)
  plus two full route-level assertions per PATCH route (bulk `/api/leads` and
  single `/api/leads/[id]`): an owner with every grid permission still can't
  drop a lead onto Lost with no reason (409, nothing written), and an invalid
  reason code is refused as 400 — the same distinction the file already
  draws for an invalid status value. `npm run check:leads-drag`.
- **`lib/meta/tokenCrypto.js`** — exercised by hand (not in a check script):
  round-trip encrypt/decrypt, a missing key, a malformed key length, a
  truncated/corrupted blob (too short to contain an IV+tag), and a
  wrong-key decrypt (GCM auth failure). All fail the way the header
  documents — loud, distinguishable from an "expired token" failure — none
  silently returns garbage.

**Four findings from running the full check suite, fixed along the way — all
four are exactly what running `check:all` before calling this done is for:**

1. `scripts/check-tenant-scope.mjs` — the sync route's `MarketingSpend` update
   (the re-sync path, `plan.toUpdate`) used
   `db.marketingSpend.update({ where: { id: upd.id } })`, an id sourced from a
   companyId-scoped query but not provably so from a static scan of the route
   file alone. Changed to `updateMany({ where: { id, companyId } })` —
   behaviourally identical when the id genuinely belongs to that company
   (always true here), and a silent no-op rather than a cross-tenant write if
   that were ever not the case. (The new-row path, `plan.toCreate`, uses
   `upsert` on the `companyId_source_externalId` compound key — already
   companyId-scoped by construction, so it never tripped this.) `npm run
   check:tenant-scope` — 0 failures after the fix.
2. `scripts/check-refusal-shape.mjs` — every route is supposed to resolve its
   member through `memberOrRefusal` (`lib/apiMember.js`), which turns a
   failed session into a JSON error. `app/api/meta-ads/callback/route.js`
   can't use it: Meta's browser redirect lands there with no way to show it a
   JSON body, and a failed resolution has to become a 302 back to the
   settings screen with an error banner, not a 401. Declared in
   `RESOLVES_ITS_OWN` with the reason, the same pattern the file already uses
   for the two existing routes that legitimately can't use the shared
   shaper — every other `app/api/meta-ads/*` route is a normal POST reached
   via `fetch()` and uses `memberOrRefusal` like everything else in the
   codebase. `npm run check:refusal-shape` — 0 failures after the fix.
3. `scripts/check-feature-labels.mjs` — Ukrainian and Punjabi are checked
   script-by-script (every string must contain real Cyrillic/Gurmukhi), with
   a small allow-list of Latin brand names that are correctly kept
   untranslated (`FieldQuo`, `Instagram`). "Meta Ads" in the new
   `feature.marketing_spend.summary` tripped it — added `Meta` and `Ads` to
   the allow-list, the same treatment `Instagram` already gets, rather than
   inventing a transliteration nobody searches for. `npm run
   check:feature-labels` — 0 failures after the fix.
4. `scripts/check-nav-audit.mjs` — every `/app` page must be either a direct
   nav/sidebar link or a named, reasoned `DRILL_INS` entry.
   `/app/marketing/spend` is neither a top-level nav item nor a settings
   row — it's opened from a button on the Marketing hub page, the same shape
   as `/app/marketing/subscribers` right next to it in the same list. Added
   with that reason. (`/app/settings/meta-ads` needed no entry — it's a real
   sidebar row, picked up automatically.) `npm run check:nav-audit` — 0
   failures after the fix.

`npm run check:all`, `npm run check:legal-pages`, and `npm run build` all
exit 0 as of this commit.
