# Google Ads spend in FieldQuo

Owner's ask (2026-10-04): *"we have meta ads in fieldquo what if we want to
import the google ads expenditure too for analysis"*.

Two ways in, one set of rules:

| | Report upload | Google Ads API sync |
|---|---|---|
| Works | **Today** | After Google approves FieldQuo's developer token (Basic access) |
| Where | Settings → Google Ads, and Marketing → Spend ("Import Google Ads report") | Settings → Google Ads ("Connect Google Ads", account picker, Sync now) |
| How often | Whenever someone uploads | Daily cron (`/api/cron/google-ads-sync`, 06:25 UTC), last 30 days; first sync after the account pick covers 90 days |
| `MarketingSpend.source` | `google_ads_csv` | `google_ads_api` |
| Cost | Free | Free (the Google Ads API has no per-call charge) |

Both write `MarketingSpend` rows with `platform: "google"` — the same value the
manual "Log spend" form has always called **Google**, so a hand-typed Google
row and an imported one are one channel on the Spend page and the duplicate
check can see both. (The brief said `google_ads`; a new enum value would have
split one channel into two rows and hidden hand-typed Google entries from the
duplicate check. If a separate value is wanted later it is
`ALTER TYPE "MarketingPlatform" ADD VALUE 'google_ads'` plus a data decision
about existing rows — a product call, not made here.)

---

## The rules (lib/googleAds/spendPlan.js — shared by both)

1. **`.leads` is never written.** Google's "Conversions" is Google's count of
   its own tag firing. It goes into `.conversions` (rounded — the column is an
   Int) and the new `.conversionsExact` (Google reports 2.5 under data-driven
   attribution), and the Spend page labels it **Google's conversions**.
2. **FieldQuo's own leads from Google** are LeadRequest rows whose stored
   attribution says `clickNetwork: "google_ads"` — the visitor arrived with a
   `gclid` / `gbraid` / `wbraid` (auto-tagging), captured by
   `lib/tracking/attribution.js`. Cost per lead and cost per won job for
   Google are spend ÷ those counts, never ÷ Google's conversions
   (`lib/analytics/googleAdsRollup.js`).
3. **Per-campaign leads need the campaign id on the click.** Auto-tagging's
   gclid says "Google Ads", not which campaign. Settings → Google Ads shows the
   account-level tracking template to paste into Google Ads
   (`{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}`);
   `lib/tracking/adParams.js` reads an all-digit `utm_campaign` as the
   campaign's id. Google leads with no campaign on them still count in the
   Google totals, on a "campaign not tagged" row.
4. **Currency is kept as reported** (`currency` written only when it differs
   from `Company.currency`) and converted at READ time by
   `lib/analytics/spendCurrency.js`, marked ≈ — exactly the Meta rule.
5. **Re-imports update, never duplicate.** `externalId` is
   `<campaign id, or name:normalised name>:<day>` (a whole-range report:
   `…:<start>..<end>`). Upserts are keyed on `(companyId, source, externalId)`.
6. **Nothing it didn't write is touched.** Updates are scoped to the same
   company AND the same source. Manual, Meta, and the other Google source's
   rows are never updated or deleted.
7. **Possible duplicates are skipped, not summed.** A row for the same
   campaign (by Google id or normalised name) and day as a row from another
   source — a hand-typed Google entry, or the CSV and the API covering the
   same day — or one overlapping an imported whole-range row, is listed and
   skipped. The upload dialog has a box to import them anyway; the API sync
   always skips. To let the API take over days a report already covered,
   delete those report rows on the Spend page.
8. **A disconnect deletes the connection (and its token), never the spend
   rows** it imported.

## What the report upload accepts (lib/googleAds/reportParse.js)

Google Ads → Campaigns → pick the dates → **Segment → Time → Day** → Download
(.csv, "Excel .csv", or .xlsx). Handled:

- title rows and the date-range line above the header (header = first row
  naming a Campaign column and a Cost column, in en/fr/es/de/it/pt);
- totals rows ("Total: Account", "Total : compte", "Gesamt…", "--") skipped;
- UTF-16 tab-separated "Excel CSV", semicolon re-saves, UTF-8 with BOM, .xlsx
  (date cells and number cells);
- locale numbers: `1,020.50`, `1 020,50` (NBSP / narrow NBSP), `1.234,56`,
  `CA$12.34`, `12,34 €`; the decimal separator is decided once per file from
  the Cost column;
- a report segmented by device or network: the lines for one campaign-day are
  added together, and the preview says how many;
- a report with no Day column: one row per campaign for the whole range, dated
  on the range start, flagged in the preview as less precise.

Refused, with a sentence: Week/Month/Quarter segments, `03/04/2026`-style days
no row disambiguates, a report with no Currency code column until the person
says which currency the account bills in (never assumed), files over 5 MB.

The commit re-reads the uploaded FILE; the browser never sends rows or
amounts back.

## What the API sync reads (lib/googleAds/client.js, lib/googleAds/sync.js)

`POST https://googleads.googleapis.com/{version}/customers/{id}/googleAds:searchStream`

```sql
SELECT campaign.id, campaign.name, campaign.advertising_channel_type, segments.date,
       metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
FROM campaign
WHERE segments.date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'
```

Headers: `Authorization: Bearer <access token minted from the stored refresh
token>`, `developer-token: $GOOGLE_ADS_DEVELOPER_TOKEN`, and
`login-customer-id: <manager id>` only when the account was reached through a
manager account. The account picker calls `customers:listAccessibleCustomers`,
reads each account's `customer` row, and lists the enabled level-1 clients of
any manager; the chosen account is re-checked against a fresh list on the
server before it is saved.

Failure kinds and what they do to the connection: `auth_error` →
`needs_reauth` (Reconnect); `developer_token` → `error`, "this is on FieldQuo's
side"; `permission` (often a missing login-customer-id), `customer_not_enabled`,
`api_version` (a sunset version — set `GOOGLE_ADS_API_VERSION`) → `error` with
Google's sentence; `rate_limited` leaves it `connected`.

---

## Owner steps

### What works before any approval

The report upload. Nothing to set up: Settings → Google Ads → **Import a
Google Ads report**, or Marketing → Spend → **Import Google Ads report**.

### For the API connection

1. **Create (or use) a Google Ads manager account for FieldQuo.** A developer
   token can only be issued from a manager (MCC) account:
   ads.google.com/home/tools/manager-accounts → Create a manager account, signed
   in as FieldQuo's Google login. FieldQuo's own Google Ads account, if any, can
   be linked under it — not required.
2. **Apply for a developer token, then for Basic access.** In the manager
   account: Admin (Tools) → **API Center** → fill in the form and accept the
   terms. The token is issued at once with **Test account** access only. Then
   apply for **Basic access** from the same page. Describe the tool truthfully:
   *read-only reporting — each advertiser connects their own Google Ads account
   by OAuth; FieldQuo reads campaign cost, clicks, impressions and conversions
   by day once a day; it never creates or edits campaigns*. Google may ask for a
   design document; the "What the API sync reads" section above is that
   document's substance. Basic access allows 15,000 operations a day; FieldQuo
   uses about one per connected company per day.
3. **Vercel → Environment Variables (Production):**
   `GOOGLE_ADS_DEVELOPER_TOKEN` = the token from step 2. Leave
   `GOOGLE_ADS_API_APPROVED` unset until Google's Basic-access email arrives,
   then set it to exactly `1` and redeploy. (`docs/VERCEL.md` has both rows.)
4. **Google Cloud project "fieldquo" → APIs & Services → Library → enable
   "Google Ads API".**
5. **APIs & Services → Credentials → the FieldQuo Web OAuth client → Authorized
   redirect URIs → add** `https://www.fieldquo.com/api/google-ads/callback`
   (the fourth one, beside the calendar, reviews and mailbox callbacks).
6. **OAuth consent screen → Data access → Add or remove scopes → add**
   `https://www.googleapis.com/auth/adwords`. It is a *sensitive* scope: submit
   the consent screen for verification with a short screen recording of
   Settings → Google Ads → Connect → the account picker → the Spend page. Until
   verification passes, only the consent screen's **test users** (100 max) can
   connect, through Google's "unverified app" screen.
7. **Testing before Basic access** (optional): a test-access token works only
   against Google Ads *test* accounts. Create a test manager account and a test
   client under it, set `GOOGLE_ADS_API_APPROVED=1` on a **Preview** deployment
   only, connect, pick the test client. Test accounts have no real spend; the
   check script covers the parsing against real-shaped responses.

### Costs

- Google Ads API: **free** — no per-call or per-account charge. Quota only.
- Google Cloud: enabling the API costs nothing.
- Verification of the `adwords` scope: free (time only).
- FieldQuo side: one daily cron, one request per connected company.

---

## Files

| File | What |
|---|---|
| `lib/googleAds/reportParse.js` | Pure: bytes → text → matrix → rows, every export shape above |
| `lib/googleAds/spendPlan.js` | Pure: rows + existing spend → creates / updates / skipped duplicates |
| `lib/googleAds/writePlan.js` | The one writer of a plan (upsert / scoped updateMany) |
| `lib/googleAds/sources.js` | Which `source` values are synced (no Edit on the Spend page, PATCH refused) |
| `lib/googleAds/client.js` | The only file that calls the Google Ads API; config, error classes, account picker |
| `lib/googleAds/connection.js` | The only reader/writer of `GoogleAdsConnection`; public shape has no token |
| `lib/googleAds/sync.js` | One company's sync, used by the cron, Sync now and the first sync |
| `lib/googleAds/state.js` | Signed OAuth state, its own cookie name |
| `app/api/marketing-spend/google-ads-import/route.js` | Upload: preview / commit |
| `app/api/google-ads/{status,connect,callback,accounts,sync,disconnect}/route.js` | The connection |
| `app/api/cron/google-ads-sync/route.js` | Daily |
| `app/app/settings/google-ads/page.js` | Settings → Google Ads (mirrors Settings → Meta Ads) |
| `app/components/marketing/GoogleAdsImportDialog.js` | The upload dialog (both screens) |
| `lib/analytics/googleAdsRollup.js` | Google spend × FieldQuo's own gclid leads → cost per lead / won job, per campaign |
| `scripts/check-google-ads.mjs` | `npm run check:google-ads` |

## Schema (additive — apply by hand, never `--accept-data-loss`)

```sql
ALTER TABLE "MarketingSpend" ADD COLUMN "conversionsExact" DECIMAL(12,2);

CREATE TABLE "GoogleAdsConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "email" TEXT,
    "customerId" TEXT,
    "loginCustomerId" TEXT,
    "customerName" TEXT,
    "currencyCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "connectedByMemberId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleAdsConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoogleAdsConnection_companyId_key" ON "GoogleAdsConnection"("companyId");
ALTER TABLE "GoogleAdsConnection" ADD CONSTRAINT "GoogleAdsConnection_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
