# Google Business Profile: the review import, and what the owner has to do at Google

Written for the owner. Sibling of `docs/GOOGLE-CALENDAR.md`: the same Cloud
project, the same OAuth client, one more scope — and, unlike the calendar,
an API that answers **nothing** until Google has approved an application
FieldQuo has not yet made. The screen says so, in Google's own words, the
moment a company connects.

## What it is

Settings → Reviews has three things for a company's Google reviews:

1. **Find your Google listing.** The company types its own name into the
   Places box the address fields already use, picks itself, and the review
   link (`https://search.google.com/local/writereview?placeid=…`) is
   derived from the place_id. Nothing to copy, no Google API beyond the
   one the product already calls client-side. This is what most companies
   need and it works today.

2. **Paste reviews.** The paste box takes a copy of the Business Profile's
   Reviews page (name, stars, date, words — stars and dates are kept,
   relative dates like "3 weeks ago" are not invented into dates), marks
   the rows `google_import`, dedupes on author + date + the first forty
   characters, and lands them **unapproved**. Works today.

3. **Connect Google Business Profile.** OAuth with `business.manage`, pick
   the listing, and the reviews are read from Google into a **cache** —
   `GoogleReview`, never `Testimonial` — refreshed nightly, purged at
   thirty days or when Google stops returning a review, never edited, and
   shown with "Google" beside the name. Per review, one switch: show it on
   my site. **This one is blocked at Google until the steps below are done**,
   and the screen prints the refusal verbatim with the paste box offered
   underneath.

Why a cache and not testimonials: the Business Profile API policies allow
Content to be stored for at most 30 days, unaltered and attributed
(`docs/ROADMAP.md`'s research entry has the quotes). A `Testimonial` row is
permanent and editable. `lib/reviews/googleBusiness/sync.js` is where every
rule from the policy became a line of code.

## The two approvals, in the order they bite

### 1. Basic API Access — the quota is 0 until Google says otherwise

Every new Cloud project has a Business Profile API quota of **zero**.
Google's own words, from [Quota limits](https://developers.google.com/my-business/content/limits):
"If your quota limit for the Google Business Profile API is 0, you have not
yet been granted access." The very first call — listing the accounts —
comes back `429 RESOURCE_EXHAUSTED`, worded as if FieldQuo were over a
limit. `quotaMessage()` in `lib/reviews/googleBusiness/sync.js` recognises
that and the screen says: *Google has not yet given this project access to
the Business Profile API — new projects start with a quota of 0, and that is
what this refusal is. Until it is approved, paste your reviews in below.
Google said: "…"*.

To apply:

1. console.cloud.google.com → the FieldQuo project → **APIs & Services →
   Library** → enable all of: **My Business Account Management API**,
   **My Business Business Information API**, **Google My Business API**
   (the legacy v4 — reviews are served only by it; the v1 splits do not
   carry them). Note the **project number** (not the id) from the project
   dashboard.
2. Open the [GBP API contact form](https://support.google.com/business/contact/api_default)
   → **Application for Basic API Access**.
3. Fill it from an email that is an **owner or manager of a Google Business
   Profile that has been verified and active for 60+ days** (FieldQuo's
   own profile, or the owner's). Website, project number, and a plain
   sentence of use: *"FieldQuo is field-service software for contractors.
   A contractor connects their own Business Profile and FieldQuo displays
   their reviews, unaltered and attributed, on their own website, refreshed
   nightly and cached no longer than 30 days per the API policies. One
   Cloud project; each contractor authorises via OAuth."*
4. Reported turnaround: days to several weeks. There is no sandbox and no
   partial access. Approved projects get **300 QPM** shared across the
   whole project — every contractor; the nightly cron reads one company at
   a time and a company's reviews are a page or two, so that is plenty.

Until this lands, "Connect" works (the OAuth half is real), "Pick your
listing" prints the refusal, and nothing else changes.

### 2. Sensitive-scope verification — who may consent

`https://www.googleapis.com/auth/business.manage` is a **sensitive** scope.
Until the OAuth consent screen passes Google's
[sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification),
only accounts listed as **test users** on the consent screen (100 max) can
consent at all; everyone else sees "app not verified" and stops.

The calendar's two scopes already need this verification
(`docs/GOOGLE-CALENDAR.md` has the form walk-through). Add
`business.manage` to the **same** submission:

1. console.cloud.google.com → **APIs & Services → OAuth consent screen** →
   **Edit app** → **Scopes** → add
   `https://www.googleapis.com/auth/business.manage`.
2. **Credentials** → the existing OAuth web client → **Authorised redirect
   URIs** → add `https://www.fieldquo.com/api/reviews/google/callback`
   (keep the calendar one). No second client: one project, one client id,
   one verification queue, two redirect URIs.
3. Justification for the scope, in the form: *"Read the connected
   business's own reviews to display them on that business's website.
   Read-only in effect — FieldQuo never posts a reply."* Demo video: the
   connect flow, the listing pick, the reviews appearing on the settings
   screen, the show-on-site switch.
4. Add the owner's account under **Test users** now, so the flow can be
   exercised end to end before verification.

## What the code does with the answer

| State at Google | What the screen says | What the cron does |
|---|---|---|
| OAuth client vars unset | "Google sign-in isn't set up on this deployment yet. Missing: …" — no button | `skipped: "not_configured"` |
| Connected, quota 0 | the quota sentence above, with Google's words, on Pick your listing / Refresh; stamped on the row as `lastError` | records the same sentence; nothing else |
| Connected, wrong account (403) | "The connected account must be an owner or manager of the listing …" | same |
| Token expired (401 / invalid_grant) | "The connection to Google has expired. Disconnect and connect again." | same |
| Working | "Connected as … · Listing · last refreshed …", the reviews, the switches | 04:40 UTC nightly: refresh, purge >30 days, purge what Google no longer returns |

Disconnect revokes the token at Google (best effort), deletes the row and
**deletes every cached review** — the cache exists only under the
connection's authority.

## Files

| What | Where |
|---|---|
| The only file that talks to the Business Profile endpoints | `lib/reviews/googleBusiness/client.js` (OAuth borrowed whole from `lib/calendar/googleClient.js`) |
| The connection row | `lib/reviews/googleBusiness/connection.js`, model `CompanyGoogleBusiness` |
| The cache, the purge, the honest sentence | `lib/reviews/googleBusiness/sync.js`, model `GoogleReview` |
| Signed OAuth state (own cookie, same signer) | `lib/reviews/googleBusiness/state.js` |
| Routes | `app/api/reviews/google/{connect,callback,disconnect,locations,refresh}`, `app/api/settings/google-reviews[/[id]]`, `app/api/cron/google-reviews` |
| Listing → review link | `lib/reviews/googlePlace.js` |
| Paste import with stars and dates | `lib/reviews/testimonials.js`, `app/api/settings/testimonials/import/route.js` |
| The check | `scripts/check-reviews-google.mjs` — executes the refresh against a fake Google that answers 429, and reads the sentence back |
