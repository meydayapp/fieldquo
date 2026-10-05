# FieldQuo Marketing — Zapier app

One Zapier app for every marketing agency. Which company a connection reads is
decided only by the **agency key** that company created in FieldQuo
(**Settings → Marketing agency access**). The API it calls is documented at
`/developers/marketing-api` (OpenAPI at `/developers/marketing-api/openapi.json`).

| Kind | What |
|---|---|
| Authentication | Custom: one **Agency key** field (`fqa_…`), tested with `GET /api/v1/me`; the connection is labelled “Company — Key name”. The key is sent as `Authorization: Bearer …`, never in a URL. |
| Triggers (REST hooks, with a perform-list sample) | New Lead · Lead Qualified · Lead Stage Changed · Appointment Booked · Estimate Scheduled · Appointment Outcome · Quote Sent · Quote Viewed · Quote Declined · New Client (Quote Accepted) · Job Completed · Invoice Paid · Payment Received |
| Actions (keys with “may add and update leads”) | Create Lead · Move Lead to Stage · Update Appointment Request |
| Searches | Find Lead by Reference · Find Lead by Email or Phone (with Find or Create Lead) |

There is deliberately **no action that texts, emails or messages a client**.

## Publish it (the owner's Zapier account — do these once)

Nothing here has been pushed. Every step needs the FieldQuo Zapier account.

The CLI (zapier-platform-cli 19) needs **Node 22 or newer**, and its command is
`zapier-platform` (older CLIs called it `zapier`: `zapier push`, `zapier users:links` …
are the same commands).

```bash
# 1. The CLI, and a login to FieldQuo's Zapier account
npm install -g zapier-platform-cli
zapier-platform login                      # or: zapier-platform login --sso

# 2. From this folder
cd integrations/zapier
npm install
npm test                          # the app's own shape check
zapier-platform validate                   # Zapier's schema + style checks

# 3. First time only: create the integration on Zapier's side.
#    Answers: title "FieldQuo Marketing", audience Private, category Marketing,
#    role "employee/owner of the company". It writes .zapierapprc — commit it.
zapier-platform register "FieldQuo Marketing"

# 4. Upload this version (1.0.0, from package.json)
zapier-platform push

# 5. Invite agencies while the app is private
zapier-platform users:links                # prints the public invite link — send it to an agency
zapier-platform users:add someone@agency.example 1.0.0   # or invite one address to one version
```

The API base defaults to `https://app.fieldquo.com/api/v1`. To point a version
elsewhere (a staging deployment):

```bash
zapier-platform env:set 1.0.0 FIELDQUO_API_BASE=https://staging.example.com/api/v1
```

### Releasing a change

```bash
# bump "version" in package.json (e.g. 1.0.1), then:
zapier-platform push
zapier-platform promote 1.0.1              # new Zaps use it
zapier-platform migrate 1.0.0 1.0.1        # move existing Zaps
```

### Going public (later, optional)

Zapier reviews public apps. In the developer platform (developer.zapier.com →
FieldQuo Marketing → Publishing) complete the listing, then submit. Until then
the invite link is how agencies get it.

## Before an agency can connect

1. The FieldQuo deployment has the agency schema applied (the `AgencyAccessKey`,
   `AgencyApiCall`, `AgencyHookSubscription`, `AgencyEvent` and
   `AgencyHookDelivery` tables, and the new `Company` / `LeadRequest` columns).
2. The company creates a key in **Settings → Marketing agency access** and sends
   it to the agency. Tick “may add and update leads” only for agencies that
   send leads from their own funnel.
3. The agency adds a FieldQuo Marketing connection in Zapier and pastes the key.

## Keeping it in step with the API

`scripts/check-agency-api.mjs` in the main repo loads `triggers/events.js` and
`lib.js` and fails when this app's event list or lead fields drift from the
API's own (`lib/agency/events.js`, `lib/agency/leadRow.js`).
