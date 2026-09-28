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

Until this lands, nothing offers the connection (2026-09-28, the owner:
"because we cannot integrate Google reviews yet we should remove it from
the additional set-ups"): the home page's "Connect Google reviews" set-up
row is off the card and out of its "N of M done" count, so it is also absent
from the onboarding next-steps email; Settings › Reviews says *Google review
import is waiting on Google's approval* instead of drawing a Connect button;
and `/api/reviews/google/connect` redirects back with `not_approved`. All
four read one helper, `googleBusinessAvailable()` in
`lib/reviews/googleBusiness/availability.js`.

5. **When Google's approval email arrives, set `GOOGLE_BUSINESS_API_APPROVED=1`
   in Vercel (Production) and redeploy.** Exactly `1`. The row, the button
   and the route come back on their own; nothing else changes. Nothing on
   our side can observe the approval — that is why it is a flag.

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

## The Book button on the listing (Settings › Booking Page)

The owner, 2026-09-28: companies should be able to put a **Book** button
on their Google Business Profile — the one Search and Maps draw beside Call
and Directions, the way Jobber users do — pointing at their FieldQuo
booking page. Settings › Booking Page has a card for it, in two layers.

**By hand — works today, no approval needed.** Once the booking page is
bookable (an active booking type whose person has bookable hours —
`bookingPageLive()` in `lib/reviews/googleBusiness/bookButton.js`; before
that the card says to set up the booking page first, because Google traffic
landing on "hasn't set up online booking yet" is worse than no button), the
card shows the booking link with a Copy button and Google's own steps
([support.google.com/business/answer/6218037](https://support.google.com/business/answer/6218037)):
business.google.com → on Search select "Booking" (on Maps "Edit profile",
then the booking type) → "Add link" → paste → "Save"; "Set preferred link"
when there are several. Google's button names stay in English, in quotes, in
all nine languages — nobody has checked what Google calls them in each.

**Automatically — "Add it for me".** Drawn only when
`googleBusinessAvailable()` is true AND the company has connected its
Business Profile AND picked a listing in Settings › Reviews. Otherwise the
section is absent (not approved) or one line pointing at Settings › Reviews
(approved, not connected). `app/api/reviews/google/book-button`:

- **POST** lists the listing's `APPOINTMENT` links first; if one already
  carries this booking URL it answers "already on Google" and creates
  nothing, otherwise it calls
  [`locations.placeActionLinks.create`](https://developers.google.com/my-business/reference/placeactions/rest/v1/locations.placeActionLinks/create)
  with `{ uri, placeActionType: "APPOINTMENT", isPreferred }` (the
  checkbox). The uri is built on the server from `bookingSlug || slug`; the
  browser sends only `preferred`, and a non-https or localhost address is
  refused before Google is asked.
- **DELETE** ("Remove from Google") re-lists and deletes only the link(s)
  that are ours: type `APPOINTMENT`, uri equal to this booking page, named
  under this location, not `isEditable: false` (an aggregator's). Every
  other link on the profile — another booking tool, a Reserve-with-Google
  partner, one the owner typed — is never touched. The browser never names
  a link.
- **GET** says whether the page is bookable and, only when the button would
  be drawn, whether our link is on the listing now. Nothing is written.

Who: `user:manage` (`refuseUnlessAdmin`), the capability the Booking Page
screen and every other `/api/reviews/google/*` route already require —
owners, admins and supervisors.

**Why `APPOINTMENT` and not `ONLINE_APPOINTMENT`.** Google's enum: APPOINTMENT
is "booking an appointment", ONLINE_APPOINTMENT "booking an online
appointment" — an appointment *held* online, which Google's help page lists
as its own button for "a list of services (such as telemedicine or
virtual)". A contractor's booking page books site visits (and calls); it is
the ordinary "Book an appointment" link.

**Why the link's name is not stored.** Google keys a link on (location, uri,
type) — `create` treats a repeat of that triple as the same link — so the
booking URL identifies ours, and a fresh list cannot go stale the way a
stored name would after the owner edits the profile by hand. (It would also
have needed a new column and a `db push`.) Consequence: if a company later
changes its booking slug, the old link stays on Google until removed there
by hand; "Remove from Google" looks for the current address.

### Owner step at Google (one-time, before the flag goes on)

The Book button uses a **fourth** API, separate from the three the reviews
need: console.cloud.google.com → the FieldQuo project → **APIs & Services →
Library** → enable **My Business Place Actions API**
(`mybusinessplaceactions.googleapis.com`). Same project, same OAuth client,
same `business.manage` scope (already requested by the connect flow), same
Basic API Access approval — no new consent. If it is not enabled, "Add it for
me" answers Google's 403 as *"Google's Place Actions API is not switched on
for FieldQuo yet … add the link by hand"* (`bookButtonMessage()`), with
Google's words beside it.

## What the code does with the answer

| State at Google | What the screen says | What the cron does |
|---|---|---|
| OAuth client vars unset | "Google sign-in isn't set up on this deployment yet. Missing: …" — no button | `skipped: "not_configured"` |
| Not yet approved (`GOOGLE_BUSINESS_API_APPROVED` unset) | "Google review import is waiting on Google's approval." — no button; the home set-up row is hidden. A company already connected keeps its connected view (so it can disconnect) | unchanged — it refreshes only the connections that already exist |
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
| The Book button: which link is ours, list-then-create, remove | `lib/reviews/googleBusiness/bookButton.js`, calls in `client.js`, route `app/api/reviews/google/book-button`, card `app/app/settings/booking-page/GoogleBookButton.js` |
| Its check | `scripts/check-google-book-button.mjs` (`npm run check:google-book-button`) — runs the route against a stubbed Google `fetch`: create, idempotent repeat, other providers' links untouched, remove, refusals, flag off/on, permission |
