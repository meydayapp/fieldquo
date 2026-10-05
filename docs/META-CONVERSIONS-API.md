# Send lead results to Meta — the Conversions API

The owner, 2026-10-05: send "qualified" and "won" back to Facebook
automatically, so Meta's algorithm finds more people like real customers
instead of accidental tappers — and send back the leads Facebook mislabelled,
because "FB is really bad at identifying leads and their status".

Settings → Meta Ads → **Send lead results to Meta**. Per company, opt-in, off
by default, owner/admin only. Code: `lib/meta/capi/`. Check:
`npm run check:meta-capi` (161 assertions, 21 mutants caught).

---

## The three halves

| Half | Meta integration | Token | Works today? |
|---|---|---|---|
| Facebook / Instagram **lead forms** (`LeadRequest.metaLeadId`) | Conversions API for CRM ("Conversion Leads") — `action_source: "system_generated"`, `custom_data: { lead_event_source: "FieldQuo", event_source: "crm" }`, `user_data.lead_id` + hashed `em`/`ph` | A **dataset access token** the company generates in Events Manager (dataset → Settings → Conversions API → "Generate access token") and pastes into the setting. Stored AES-256-GCM (`lib/meta/tokenCrypto.js`). | **Yes.** Meta: "Your app does not need to go through App Review. You do not need to request any permissions" for this token. |
| **Funnels and the instant estimate** (ad-click visits, `attribution.fbc`) | Conversions API, `action_source: "website"`, same `event_id` as the browser pixel | Same dataset token | **Yes**, when the page's pixel IS the chosen dataset and the company does not require visitor consent (below). |
| **Click-to-Messenger / Instagram** conversations (`MessageThread.adReferral` or the classifier's ad marker) | Conversions API for Business Messaging — `action_source: "business_messaging"`, `messaging_channel`, `page_id` + `page_scoped_user_id` (Messenger) / `instagram_business_account_id` + `ig_sid` (Instagram) | The stored **Page token** (`MetaPageConnection`), to the dataset Meta links to the Page (`POST /{page-id}/dataset`, `POST /{ig-user-id}/dataset`) | **No — needs App Review** for `page_events` and `instagram_manage_events`. Built; gated; the setting says "Needs Meta permission page_events". |

## Stages and when each fires

### CRM (lead forms) — `lib/meta/capi/events.js` `crmStagesForLead`

| event_name (fixed English, never translated) | Fires when | event_time |
|---|---|---|
| `Raw Lead` | every lead-form lead | `LeadRequest.createdAt` |
| `Qualified` | `temperature` is warm/hot AND (no conversation, or its tier is `lead`) | first observed (no stored timestamp exists) |
| `Disqualified` | linked conversation tier `tap_only` / `not_relevant`; OR lost with `not_real_inquiry`; OR thread marked not-a-lead; OR **deleted as not a lead** (queued at the delete, `captureDeletedNotALead`) | first observed / the delete |
| `Appointment Booked` | an Appointment for the lead's quote or the quote's client, created after the lead | `Appointment.createdAt` |
| `Quote Sent` | the lead's quote has `sentAt` | `Quote.sentAt` |
| `Converted` | the lead's quote is `accepted` (value = `acceptedTotal ?? total`, currency = `Company.currency`), or its conversation's outcome is `won` (no value) | `acceptedAt` / `outcomeSetAt` |

A disqualified lead reports nothing after Disqualified. Observed stages
(Qualified, Disqualified) are emitted only while the lead is inside Meta's
28-day window. Every time is clamped to be no earlier than the lead. Each
stage is sent once: `event_id = <leadId>:<stage>`, enforced by
`@@unique([companyId, kind, eventId])`.

### Business Messaging — `messagingStagesForThread`

- Only ad-originated Messenger / Instagram threads; never tap_only,
  not_relevant, unclassified, or marked not-a-lead (Business Messaging has no
  "disqualified" event, so those send **nothing**).
- `LeadSubmitted` when the effective tier is `lead` and the thread (or its
  lead) is warm/hot.
- `Purchase` (value + currency) when the thread's quote, its lead's quote, or
  the client's quote accepted after the thread began is accepted.

### Website — `lib/meta/capi/capture.js`

- `Lead` with `event_id = lead.id` — the id FunnelRunner / InstantQuoteFlow
  already pass to `fbq('track','Lead',…,{eventID})`, so Meta de-duplicates.
- `Schedule` with `event_id = booking.id` — InstantQuoteFlow's embedded booking
  now passes the booking id as the pixel's eventID too (BookingFlow hands it to
  `onBooked`). Free bookings only: a paid booking confirms on Stripe's webhook,
  where there is no visitor browser to describe.
- `Purchase` when that lead's quote is accepted — built from the captured Lead
  row's browser facts (Meta requires `client_user_agent` on website events).
- Not sent when: no `fbc` on the visit; the page's pixel is not the chosen
  dataset (`effectivePixels` — a funnel with its own pixel); the company has
  `pixelConsentRequired` (FieldQuo cannot see a visitor's consent answer
  server-side, so it sends nothing rather than events for visitors who said no).
- `_fbp` is not captured anywhere in FieldQuo today; only `fbc` is sent.

## Delivery — `lib/meta/capi/outbox.js`

- `MetaConversionEvent` outbox: company, kind, stage, event_name, event_id,
  payload (already hashed), payloadHash (sha256), status
  (`pending|sent|failed|expired|skipped`), attempts, nextAttemptAt, lastError,
  lastStatusCode, sentAt.
- Sweep (`lib/meta/capi/sweep.js`) every 15 minutes
  (`/api/cron/meta-conversions`) and the daily catch-up
  (`/api/cron/meta-conversions-daily`, 07:10 UTC, up to 5 drain passes).
- Batches of up to 1,000 (`CAPI_MAX_BATCH`). Meta discards a whole batch on one
  bad event, so a 4xx batch is split in halves down to the bad event, which is
  `failed` with Meta's reason; the rest are delivered. 401/190, 429, 5xx and
  network errors retry with backoff 5 min × 2ⁿ (cap 6 h), `failed` after 8.
- Rows older than Meta's 7-day backfill window are `expired`, never sent.
- Every failure → `PlatformErrorLog` (`area: "meta_capi"`) with the company
  named. User actions are never blocked: the hooks run through
  `afterResponse` (Next's `after()`), and every capture function swallows its
  own errors.
- Hashing (`lib/meta/capi/hash.js`): email trimmed + lower-cased; phone digits
  with the country code (the company's country completes a national number;
  unknown country → phone omitted, never guessed); SHA-256 hex. No raw email
  or phone is sent or stored in the outbox.
- `GRAPH_API_VERSION` from `lib/meta/client.js` — the only file that calls Meta.

## Backfill (owner-run, dry by default)

```bash
node --import ./scripts/alias-loader.mjs scripts/meta-capi-backfill.mjs --company=<companyId>          # counts only
node --import ./scripts/alias-loader.mjs scripts/meta-capi-backfill.mjs --company=<companyId> --send   # queue + deliver
```

Needs `DATABASE_URL` (run it the way the other local scripts are run). Prints
counts per stage for the last 90 days split into "sendable" and "too old".
**Meta refuses events more than 7 days old** ("You can backfill your data for
up to 7 days in the past" — Conversion Leads FAQ), so most of a 90-day history
cannot be sent; FieldQuo never re-dates an event to get it in. `--send` stores
the old ones as `expired` (counted on the screen) and delivers the rest.

## How the company sets up the campaign (also in the help article)

1. Ads Manager → a Leads campaign with an Instant Form.
2. Ad set → Performance goal → "Maximize number of conversion leads".
3. Pick the dataset and the CRM stage — usually `Qualified`, `Converted` once
   there are enough sales.
4. Meta's rules: upload at least daily; the chosen stage within 28 days of the
   lead for 1–40 % of leads; ~200 leads/month.

## What the owner must do

### Lead forms and website — nothing at FieldQuo's level

Each company: accept the terms on the setting, enter the dataset id, paste a
dataset token from Events Manager, send a test event, switch on.

### Messenger / Instagram — App Review for `page_events` and `instagram_manage_events`

Meta's requirements (Conversions API for Business Messaging, read 2026-10-05):

- Messenger: **`page_events`**, advanced access.
- Instagram: **`instagram_manage_events`**, advanced access.
- The app-level **Marketing API Access Tier** feature ("Full Access"). Meta's
  Business Messaging page says 1,500 successful Marketing API calls in 15 days
  with < 10 % errors; the Conversions API "Get started" page says the
  threshold was lowered to 500. Check App Dashboard → Features.

Steps:

1. App Dashboard → App Review → Permissions and Features → request
   `page_events` and `instagram_manage_events` (advanced access). Request the
   "Marketing API Access Tier" feature if it is not already granted.
2. App Dashboard → Facebook Login for Business → the Pages configuration
   (`META_PAGES_CONFIG_ID`) → add `page_events` and `instagram_manage_events`.
3. For the review screencast: in Development mode (role-holders work without
   review), connect a test Page on Settings → Meta Ads, set
   `META_PAGE_EVENTS_ENABLED=1` on a preview, send a click-to-Messenger
   message from a test ad referral, mark the conversation a lead, and show the
   event arriving on Events Manager → the Page's dataset → Test events.
4. After approval: set `META_PAGE_EVENTS_ENABLED=1` in Vercel (production);
   each company reconnects its Page once so the grant includes the two
   permissions. The setting's Messenger/Instagram lines change from "Needs
   Meta permission …" to "sending".

Review text — `page_events`:

> FieldQuo is a CRM for small field-service contractors (painters, plumbers,
> cabinet makers). A contractor connects their Facebook Page so customer
> messages from their click-to-Messenger ads arrive in FieldQuo's inbox, where
> the contractor answers them and FieldQuo classifies each conversation as a
> real enquiry or an accidental tap. When the contractor turns on "Send lead
> results to Meta", FieldQuo uses page_events to send Conversions API for
> Business Messaging events to the dataset linked to that Page:
> `LeadSubmitted` when a conversation that started from the contractor's ad
> becomes a qualified lead, and `Purchase` (value and currency) when that
> customer accepts the contractor's quote. Each event carries only the event
> name and time, `action_source: business_messaging`,
> `messaging_channel: messenger`, the page_id and the page-scoped user id —
> no message content. Accidental taps and off-topic conversations are never
> sent. This lets the contractor's own ads optimise toward real customers.
> The feature is off by default and each business turns it on itself after
> accepting Meta's Business Tools Terms.

Review text — `instagram_manage_events`:

> Same feature for Instagram Direct. When a conversation that started from the
> contractor's click-to-Instagram ad becomes a qualified lead, FieldQuo sends
> `LeadSubmitted`, and `Purchase` with value and currency when the customer
> accepts the quote, through the Conversions API for Business Messaging with
> `messaging_channel: instagram`, the instagram_business_account_id and the
> Instagram-scoped user id (IGSID). No message content is sent; accidental
> taps and off-topic conversations are never reported. Off by default; each
> business opts in after accepting Meta's Business Tools Terms.

## Interpretations of Meta's docs (uncertain)

- **Stage names.** Meta calls `event_name` "free form"; the stages here are
  fixed English strings (`Raw Lead`, `Qualified`, `Disqualified`,
  `Appointment Booked`, `Quote Sent`, `Converted`). Meta's own examples use
  "Raw Lead" / "Marketing Qualified Lead" / "Converted"; nothing documents a
  negative stage, so `Disqualified` is sent as just another stage — it tells
  Meta those leads did NOT reach Qualified, which is what Conversion Leads
  learns from. It should never be picked as the optimisation stage.
- **Qualified time.** No stored timestamp exists for "became warm/hot", so the
  first observation is used (Meta defines event_time as when the CRM updated
  the stage). The agency branch adds `LeadRequest.qualifiedAt`; once that lands
  the sweep should use it.
- **lead_id as a number.** Meta's example shows it unquoted; a 16-digit id is
  past JavaScript's safe-integer range, so it is spliced into the JSON as bare
  digits without ever becoming a Number (`serialiseEvents`).
- **Value/currency on Converted.** The CRM payload spec lists only the two
  custom_data keys; `value`/`currency` are standard custom_data and are added
  on Converted only.
- **LeadSubmitted vs QualifiedLead.** Business Messaging lists both; the owner
  asked for LeadSubmitted, which is what is sent when the conversation becomes
  a warm/hot lead.
- **Purchase for a conversation.** Meta: "messaging events should only
  represent customer interactions that occur in the messaging thread". The
  quote is accepted on FieldQuo's quote page, not in the thread — sent anyway
  because the owner asked for it and the sale came from that conversation;
  revisit if Meta flags it.
- **Business Messaging token.** Meta says to "reuse the token generated from
  your Facebook Login for Business"; the stored Page token from that login is
  used.
- **Website event_source_url.** The browser's Referer without its query
  string; the origin when the browser sent none.

## Overlap with the agency-access work (branch `worktree-agent-ad60c8ca7797a9a1b`)

Uncommitted when this was built (only `lib/agency/keys.js` existed; its
`AgencyEvent` outbox and `lib/agency/events.js` sweep were in the schema only,
no event names written). So this feature has its own small outbox rather than
merging unstable work. Differences that justify two tables: `AgencyEvent` fans
out to per-subscription deliveries and builds its row at delivery time under
the sharing switches; `MetaConversionEvent` is a fixed, already-hashed payload
owed to one dataset with Meta's 7-day expiry. Shared idea: both are
idempotent on a dedupe key and fed by a sweep. When the agency branch lands,
`LeadRequest.qualifiedAt` should feed `Qualified`'s event_time here.

## Schema (additive — NOT applied)

```sql
CREATE TABLE "MetaConversionSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "enabledById" TEXT,
    "enabledByName" TEXT,
    "datasetId" TEXT,
    "datasetName" TEXT,
    "datasetTokenEnc" TEXT,
    "datasetTokenHint" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsAcceptedById" TEXT,
    "termsAcceptedByName" TEXT,
    "messengerDatasetId" TEXT,
    "instagramDatasetId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaConversionSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MetaConversionEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channel" TEXT,
    "leadId" TEXT,
    "threadId" TEXT,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "lastStatusCode" INTEGER,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaConversionEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetaConversionSettings_companyId_key" ON "MetaConversionSettings"("companyId");
CREATE INDEX "MetaConversionEvent_status_nextAttemptAt_idx" ON "MetaConversionEvent"("status", "nextAttemptAt");
CREATE INDEX "MetaConversionEvent_companyId_status_idx" ON "MetaConversionEvent"("companyId", "status");
CREATE INDEX "MetaConversionEvent_companyId_createdAt_idx" ON "MetaConversionEvent"("companyId", "createdAt");
CREATE UNIQUE INDEX "MetaConversionEvent_companyId_kind_eventId_key" ON "MetaConversionEvent"("companyId", "kind", "eventId");
ALTER TABLE "MetaConversionSettings" ADD CONSTRAINT "MetaConversionSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaConversionEvent" ADD CONSTRAINT "MetaConversionEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

New env var: `META_PAGE_EVENTS_ENABLED` (docs/VERCEL.md) — leave unset until
the App Review above passes.
