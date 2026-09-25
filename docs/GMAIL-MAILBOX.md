# Work email: connecting Gmail, Microsoft 365 and any other mailbox

Written for the owner. The code is in `lib/mailbox/`; the screen is
**Settings → Work email**. Nothing connects until the steps below are done,
and each option on the card says "Not set up yet (missing: …)" until its
variables exist.

## What it does

A company (owner/admin: the company mailbox) or any member (their own work
mailbox) connects a mailbox. Every ~10 minutes (`/api/cron/mailbox-sync`) FieldQuo
reads what is new in INBOX and Sent, matches From/To/Cc against the
company's clients and leads, and files **only the matches** into that client's
conversation — the same MessageThread/Message the inbox, the hot/warm/cold
score and the monthly review read. Everything else is skipped by its
headers: the body of a personal email is never downloaded, and only a count
of skipped mail is kept. The first sync backfills 90 days.

Optional, off by default, owner/admin, company mailbox only: **Send client
emails from this mailbox** — quotes, invoices, payment requests, booking
confirmations and inbox replies go out from the real address and land in its
Sent folder. Any failure sends that message the usual way and says so on the
card.

## Google (Gmail / Google Workspace)

Same OAuth client as Google Calendar (`GOOGLE_OAUTH_CLIENT_ID` /
`GOOGLE_OAUTH_CLIENT_SECRET`). In Google Cloud Console, on the FieldQuo project:

1. **APIs & Services → Library → Gmail API → Enable.**
2. **Credentials → the OAuth web client → Authorized redirect URIs → add**
   `https://www.fieldquo.com/api/mailbox/google/callback` (keep the calendar
   and Business Profile URIs).
3. **OAuth consent screen → Scopes → add** `.../auth/gmail.readonly` and
   `.../auth/gmail.send`.
4. **OAuth consent screen → Test users → add** every Google account that
   should be able to connect (yours first).

### The honest limit: these are RESTRICTED scopes

Google classes `gmail.readonly` and `gmail.send` as **restricted**. Until the
app passes Google's OAuth verification **and** an annual third-party
security assessment (CASA — Cloud Application Security Assessment, via a
Google-approved assessor, paid, renewed every 12 months):

- only the accounts listed as **test users** can connect — **100 at most**;
- each of them sees Google's **"Google hasn't verified this app"** screen and
  must click *Advanced → Go to FieldQuo (unsafe)*;
- a test user's refresh token **expires after 7 days** while the consent
  screen's publishing status is "Testing" — the card then shows the refusal
  and the person presses Reconnect. Moving the app to "In production"
  (before verification) keeps the 100-user cap and the warning but not the
  7-day expiry.

The card on Settings → Work email and the /platform overview both say this.
To lift it: submit the consent screen for verification with a demo video of
the Work email flow, the privacy policy's Google user-data section, and then
complete CASA (tier 2) with an assessor from Google's list.

Incremental sync uses `users.history.list` from the history id captured at
the first sync; a history id Google no longer keeps restarts a bounded
re-read from the last good sync (the Message-ID index makes it free).

## Microsoft 365 / Outlook.com (and GoDaddy's Microsoft-hosted email)

1. **portal.azure.com → Microsoft Entra ID → App registrations → New
   registration.** Name: FieldQuo. Supported account types: *Accounts in any
   organizational directory and personal Microsoft accounts*. Redirect URI
   (Web): `https://www.fieldquo.com/api/mailbox/microsoft/callback`.
2. **API permissions → Add → Microsoft Graph → Delegated:** `Mail.Read`,
   `Mail.Send`, `offline_access`, `User.Read`, `openid`, `email`. None needs
   admin consent — but a customer's tenant whose admin has switched off user
   consent will ask for approval; the card explains that case.
3. **Certificates & secrets → New client secret.** Copy the **Value**. Put the
   Application (client) ID in `MICROSOFT_OAUTH_CLIENT_ID` and the Value in
   `MICROSOFT_OAUTH_CLIENT_SECRET`. Leave `MICROSOFT_OAUTH_TENANT` unset
   (means `common`). Diary the secret's expiry.
4. Optional, later: Branding & properties → publisher verification (a
   Microsoft Partner Network id) removes the "unverified" label on consent.

Sync uses Graph **delta queries** per folder (inbox, sentitems); Graph
rotates refresh tokens, and the new one is re-sealed on every refresh.

## Any other host (IMAP + password)

Needs only `MAIL_CREDENTIALS_KEY`. Presets carry each provider's published
host/port/TLS (source URL in `lib/mailbox/presets.js`); typing the address
looks up the domain's MX and picks the preset, or points a Google- or
Microsoft-hosted domain at those options. The login (IMAP LOGIN + read-only
EXAMINE INBOX) is tested before anything is saved and the precise failure is
shown. Namecheap Private Email: `mail.privateemail.com`, 993, SSL/TLS.

## Security, in one place

- Credentials are AES-256-GCM under `MAIL_CREDENTIALS_KEY`, bound to the row
  id (a ciphertext copied to another row will not open); no key → no option,
  never a default key or plain text; never selected into a response, never
  logged (imapflow's logger is off); opened only by the sync and the send.
- IMAP is read-only: EXAMINE, BODY.PEEK, no flag/move/delete/append in the
  reader — asserted on the wire by `scripts/check-mailbox.mjs` against an
  in-process IMAP server.
- Disconnect wipes the credential (and revokes a Google token); filed
  emails stay — they are the company's record.
