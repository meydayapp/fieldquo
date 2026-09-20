# Google Calendar: the two-way connection, and what the owner has to do in Google Cloud

Written for the owner. The code is live; nothing works until the steps below
are done on the Google side, and the settings page says so in one sentence
until they are.

## What it is

Every member connects **their own** Google account from **Settings → My
calendar → Connect Google Calendar**. From then on:

- **FieldQuo → Google.** Every appointment, job visit or booking assigned to
  that member becomes an event on their primary Google calendar — created on
  assignment, moved when the office or the client moves it, deleted when it is
  cancelled or given to somebody else (a completed visit stays, as history). Title: `Site visit — Jane
  Doe` (or `Callback — …`, `Video call — …`, or the job title for a crew
  visit), in the member's own interface language. Location: the site address,
  so Google Maps navigation works from the event. Description: the FieldQuo
  link. A **video** booking gets a Google Meet room minted with the event and
  the link is written onto the booking (`Booking.meetUrl`, `Appointment.meetUrl`)
  for the client's letters.
- **Google → FieldQuo.** The member's own events count as busy time in every
  availability answer — the public booking page, the client's reschedule link,
  the phone receptionist, the AI employee's `book_appointment`, and the
  office's own move check (a dispatcher moving a visit onto a member who has a
  personal event there gets a 409 they may force). Only the intervals are read
  (`freebusy.query`), never the titles. The calendar page draws them grey,
  labelled "Busy (Google)".
- Two switches on the page, honoured server-side: *Write my visits to Google
  Calendar* and *Use my Google busy time*. Disconnect removes every event
  FieldQuo created (each checked for FieldQuo's private mark first), revokes
  the token at Google, and deletes the row.

The one promise, printed on the page: **FieldQuo creates and updates its own
events only; it never edits yours.** Every event FieldQuo writes carries
`extendedProperties.private.fieldquoId`; nothing without that mark is ever
touched.

Every hour (`/api/cron/google-calendar-reconcile`, `25 * * * *`) a reconcile
pass creates what is missing, updates what drifted and deletes orphans
FieldQuo created. It is also the floor under the two write paths the sync
does not hook directly (the public booking confirm route and the fee
settlement — owned by the booking-modes work), so a web-booked visit reaches
the member's phone within the hour at the latest. Failures are stamped on the
member's row (shown under their email on the settings page) and filed on
`/platform/errors` under area `google_calendar`.

No `googleapis` package: `lib/calendar/googleClient.js` is plain `fetch`
against the REST endpoints (0 bytes added; `@googleapis/calendar` 20.0.0 alone
is 847 KB unpacked plus its auth stack, the `googleapis` monolith is 214 MB).

## Files

| What | Where |
|---|---|
| The only file that talks to Google | `lib/calendar/googleClient.js` |
| Signed OAuth state | `lib/calendar/googleState.js` |
| The connection row (token encrypted at rest) | `lib/calendar/googleConnection.js`, model `MemberGoogleCalendar` |
| Entry → event, the private mark, the payload hash | `lib/calendar/googleEvent.js` |
| The ONE sync function, disconnect, reconcile | `lib/calendar/googleSync.js` (`syncEntity`, `scheduleSync`, `removeMemberMirrors`, `reconcileMember`) |
| Busy time, cached 5 min per member | `lib/calendar/googleBusy.js` → merged in `lib/booking/computeAvailability.js` and `lib/schedule/entryNeighbours.js` |
| Routes | `app/api/calendar/google/{connect,callback,disconnect,busy}`, `app/api/calendar/google` (GET status / PATCH switches) |
| Cron | `app/api/cron/google-calendar-reconcile` |
| Settings section | `app/components/calendar/GoogleConnect.js` on `app/app/settings/my-calendar` |
| Check | `scripts/check-google-calendar.mjs` (`npm run check:google-calendar`) |

## Cloud Console: the exact steps

All on the **existing FieldQuo project** in Google Cloud Console — the one that
already holds the Maps and Solar keys. Do not create a second project; the
verification below is per project and you want one review, not two.

### 1. Enable the API

APIs & Services → Library → search **Google Calendar API** → **Enable**.

### 2. OAuth consent screen

APIs & Services → OAuth consent screen (Google now calls this **Google Auth
Platform → Branding / Audience / Data access**; the fields are the same).

- **User type:** External. (Internal is only for Workspace organisations
  connecting their own staff; FieldQuo's members are strangers' Gmail accounts.)
- **App name:** `FieldQuo`
- **User support email:** the support address (support@fieldquo.com or your
  own — it is shown to every member on the consent screen).
- **App logo:** the FieldQuo mark. Note: uploading a logo is one of the things
  that triggers the brand-verification step; it is worth it, but expect the
  review to ask for it to match the domain.
- **App domain → Application home page:** `https://www.fieldquo.com`
- **Application privacy policy link:** `https://www.fieldquo.com/privacy` —
  this page exists and now lists Google Calendar as a processor with the
  exact read/write description Google's reviewer looks for (the "Limited
  Use" disclosure). Terms: `https://www.fieldquo.com/terms`.
- **Authorised domains:** `fieldquo.com` (you must be a verified owner in
  Search Console; you already are for the site).
- **Developer contact information:** your email.

### 3. Scopes (Data access)

Add exactly these four:

| Scope | Why | Sensitivity |
|---|---|---|
| `https://www.googleapis.com/auth/calendar.events` | create / update / delete FieldQuo's own events on the member's primary calendar | **Sensitive** |
| `https://www.googleapis.com/auth/calendar.readonly` | `freebusy.query` for the member's busy intervals | **Sensitive** |
| `openid` | the id_token | non-sensitive |
| `email` | the address shown as "Connected as …" | non-sensitive |

The two calendar scopes are **sensitive** (not restricted), which means:
Google requires app verification before more than 100 users can consent, and
shows an "unverified app" warning screen until it is granted. Sensitive scopes
do NOT require the CASA security assessment that *restricted* scopes (Gmail,
Drive) do. The broad `auth/calendar` scope is sensitive too, but it also
grants calendar-list, sharing and ACL changes FieldQuo has no use for, and the
reviewer asks you to justify the narrowest scope that does the job — so the
code asks for `events` + `readonly` only. Do not add scopes the code does not
ask for; the review compares the form to what the consent screen requests.

### 4. Credentials: the OAuth web client

APIs & Services → Credentials → **Create credentials → OAuth client ID**:

- **Application type:** Web application
- **Name:** `FieldQuo web`
- **Authorised JavaScript origins:** `https://www.fieldquo.com`
- **Authorised redirect URIs:**
  `https://www.fieldquo.com/api/calendar/google/callback`
  (add `https://fieldquo.com/api/calendar/google/callback` too if the apex
  ever serves the app; add a `http://localhost:3000/api/calendar/google/callback`
  entry only on a separate *local* client, never this one).

Copy the **Client ID** and **Client secret** into Vercel as
`GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` (Production; Preview
too if you want to test on a preview URL — then that preview host's callback
must also be a redirect URI, which is why testing on production with a test
user is simpler). `META_TOKEN_ENCRYPTION_KEY` must already be set — it
encrypts the refresh token at rest. Redeploy.

### 5. Test users, while unverified

OAuth consent screen → **Audience → Test users → Add users**. Up to **100**
Google accounts. Until verification is granted, **only these accounts can
complete the connect flow**; anyone else gets Google's "Access blocked: this
app has not been verified" page and lands back on the settings page with
"Google didn't accept the sign-in".

Publishing status: leave it **In production** (not Testing). In Testing mode
refresh tokens expire after 7 days and every member would have to reconnect
weekly; in production-but-unverified they do not expire, and the 100-user cap
still applies until the review passes.

### 6. Verification (the form)

OAuth consent screen → **Prepare for verification / Submit for verification**.
What they ask, and what to write:

- **Scopes justification** (one paragraph per sensitive scope):
  - `calendar.events`: *"FieldQuo is scheduling software for field-service
    contractors. When a staff member connects their own Google Calendar,
    FieldQuo creates an event on that member's primary calendar for each job
    visit assigned to them, updates the event when the visit is moved, and
    deletes it when the visit is cancelled. Every event FieldQuo creates
    carries a private extended property; FieldQuo modifies or deletes only
    events carrying that property and never touches the user's own events."*
  - `calendar.readonly`: *"FieldQuo calls freebusy.query on the member's
    primary calendar so that the member's personal commitments block their
    availability in FieldQuo's booking tools. Only busy intervals are read;
    event titles, descriptions and attendees are never retrieved, stored or
    shown. The member can switch this off at any time."*
- **Demo video** (they require a YouTube link, unlisted is fine): record, in
  English, in one take: sign in to FieldQuo → Settings → My calendar → Connect
  Google Calendar → the Google consent screen **showing the app name and the
  two calendar scopes being granted** → back on the settings page showing
  "Connected as …" → open Google Calendar and show a FieldQuo event appearing →
  create a personal event in Google Calendar → show the public booking page
  refusing that slot → Disconnect and show the FieldQuo event gone. Narrate what
  each scope is doing. 3–5 minutes. The reviewer is checking that the scopes
  are used for what the justification says and nothing more.
- **Privacy policy URL:** `https://www.fieldquo.com/privacy` — the Google
  Calendar row in Section 4 is the disclosure they read.
- **Limited Use:** tick that the app complies. It does: no ads, no selling, no
  human reading of calendar data, only the busy-time and events described.

**Typical timeline:** 2–6 weeks for sensitive scopes, usually one or two
rounds of "please clarify" email — most often about the demo video not
showing the consent screen clearly, or the privacy policy wording. Reply to
the same thread each time. Brand verification (the logo and app name) may
run as a separate thread on the same submission.

### 7. Before and after verification, plainly

| | Before (unverified, in production) | After |
|---|---|---|
| Who can connect | only the ≤100 test-user accounts you listed | anyone with a Google account |
| Consent screen | "Google hasn't verified this app" warning; test users click *Continue* | the normal screen |
| Refresh tokens | do not expire (because status is *In production*, not *Testing*) | same |
| Everything else — writes, busy time, Meet links, disconnect, the hourly reconcile | works exactly as after | works |

So the owner and the first few contractors can be on it from day one as test
users; verification is what removes the cap and the warning.

## Env vars

| Var | Where from |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | the web client, step 4 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | the web client, step 4 — also signs the OAuth `state` |
| `META_TOKEN_ENCRYPTION_KEY` | already set; encrypts the refresh token at rest |

With any of the three absent, Settings → My calendar says "Google Calendar
isn't set up on this FieldQuo deployment yet." and shows no button; the connect
route redirects back with `not_configured`; the cron skips; nothing 500s.

## What is deliberately not done

- No shared/service-account calendar. The reference sample the owner pointed at
  (`gmeet-nextjs-main`) authenticates a service account against one calendar;
  FieldQuo writes to each member's own calendar with that member's consent, so a
  member leaving takes their calendar with them and nobody else's events are
  ever in one credential's reach.
- Nothing is read from the member's events beyond busy intervals — by API
  choice (`freebusy.query`), not by policy.
- The public booking confirm route and the booking-fee settlement are not
  hooked directly (another agent's files); the hourly reconcile covers them.
  Hooking them is one `scheduleSync("appointment", appointment.id)` line each
  once that work lands.
