# Meta's current dashboard — where FieldQuo's three OAuth flows are configured

Written 2026-09-11 against the dashboard as it is now, after the owner found
that the older docs in this folder still said "Development mode" and named a
callback that does not exist. This file is the one to follow for dashboard
navigation; META-APP-REVIEW-SUBMISSION.md and META-WHATSAPP-SUBMISSION.md
remain right about what to record and what to write.

## What the code actually does (read before touching the dashboard)

Three independent consent flows, three callbacks. Nothing else.

| Flow | Connect route | Dialog | Sends | Callback (exact) |
|---|---|---|---|---|
| Ads spend import | `app/api/meta-ads/connect` | `facebook.com/v21.0/dialog/oauth` | `client_id`, `redirect_uri`, `state`, `scope`, `response_type=code` — **no `config_id`** | `https://www.fieldquo.com/api/meta-ads/callback` |
| Page + Instagram publishing (and, when the flags are on, messaging + leads) | `app/api/settings/social/connect` | same | same shape, `scope` = `META_PAGES_SCOPE` — **no `config_id`** | `https://www.fieldquo.com/api/settings/social/callback` |
| WhatsApp Embedded Signup (redirect variant) | `app/api/settings/whatsapp/connect` | same | `client_id`, **`config_id`** (`META_WHATSAPP_CONFIG_ID`), `redirect_uri`, `state`, `scope`, `response_type=code`, `override_default_response_type=true` | `https://www.fieldquo.com/api/settings/whatsapp/callback` |

`https://www.fieldquo.com/api/meta/pages/callback` **does not exist** and never
did — it was a mistake in a chat message, not in the code.

Scopes the dialogs ask for (lib/meta/client.js):
- ads flow: `ads_read`; plus `pages_messaging, pages_show_list,
  pages_read_engagement, pages_manage_metadata, instagram_basic,
  instagram_manage_messages` when `META_MESSAGING_APPROVED=true`; plus
  `leads_retrieval, pages_show_list, pages_read_engagement, pages_manage_ads`
  when `META_LEADS_ENABLED=1`.
- pages flow: `pages_show_list, pages_manage_posts, pages_read_engagement,
  instagram_basic, instagram_content_publish`.
- whatsapp flow: `whatsapp_business_management, whatsapp_business_messaging`.

Webhooks the code answers (each verifies `hub.verify_token` against
`META_WEBHOOK_VERIFY_TOKEN` and checks `X-Hub-Signature-256` with the app
secret):
- `https://www.fieldquo.com/api/meta/messaging/webhook` — Page + Instagram `messages`, and Page `leadgen` (handed to the leads import; one URL per object)
- `https://www.fieldquo.com/api/meta/leads/webhook` — Page `leadgen`, for a dashboard that points that field here instead
- `https://www.fieldquo.com/api/meta/whatsapp/webhook` — WhatsApp `messages`
- `https://www.fieldquo.com/api/meta/data-deletion` — the data-deletion callback

The redirect_uri is built from `NEXT_PUBLIC_APP_URL`, so that variable must be
exactly `https://www.fieldquo.com` (no trailing slash, with the `www`) or the
registered URIs will not match byte for byte and Meta refuses the dialog.

## Published vs approved — two different things

A Business-type app in the current dashboard has no Development/Live toggle.
It is **Unpublished** or **Published**, and separately every permission has
an **access level**: *Standard* or *Advanced*.

- **Standard access** is what every permission has the day you add it. It
  lets the app use that permission for **people with a role on the app**
  (Administrator, Developer, Tester) and for assets those people own —
  whether or not the app is Published. This is what makes the recordings
  possible without any approval.
- **Advanced access** is what App Review grants, per permission, and is what
  lets the app use the permission for **anyone else** — a contractor who is
  not on the app's roles. Some also need Business Verification.

So: **do not unpublish.** Publishing changed nothing about which permissions
are approved, and being Published does not stop an admin from exercising a
Standard-access permission. Confirm each one on App Review → Permissions and
Features: the row should read "Standard access" (usable by app roles now);
"Advanced access" is what you request after recording.

The FieldQuo env flag `META_APP_MODE=development` is **our** switch (it draws
the Page/Instagram and WhatsApp connect buttons before Advanced access
lands). It is named after the old Meta concept and has nothing to do with
the app being Published; set it regardless.

## The dashboard, step by step

**App settings → Basic**
- Copy **App ID** and **App Secret** → `META_APP_ID`, `META_APP_SECRET`.
- **App Domains**: `fieldquo.com`.
- Scroll to the bottom → **+ Add platform → Website** → Site URL
  `https://www.fieldquo.com`.
- **Privacy Policy URL** `https://www.fieldquo.com/privacy`, **Terms**
  `https://www.fieldquo.com/terms`, **User Data Deletion** → Data deletion
  callback URL `https://www.fieldquo.com/api/meta/data-deletion`.

**App roles → Roles**: your own Facebook account as Administrator. Add the
reviewer test account's Facebook user as a **Tester** if you want them to
exercise Standard-access permissions during review (Meta reviewers use their
own test users, so this is optional).

**Facebook Login for Business → Settings** (this is the page, not
Configuration)
- Client OAuth login: **Yes**. Web OAuth login: **Yes**. Enforce HTTPS: **Yes**.
  Use Strict Mode for redirect URIs: **Yes**.
- **Valid OAuth Redirect URIs** — exactly these three:
  ```
  https://www.fieldquo.com/api/meta-ads/callback
  https://www.fieldquo.com/api/settings/social/callback
  https://www.fieldquo.com/api/settings/whatsapp/callback
  ```
- Login from Devices: No. Leave "Allowed Domains for the JavaScript SDK"
  empty — FieldQuo never loads the JS SDK; every flow is a full-page
  redirect (see the header of app/api/settings/social/connect/route.js for
  why a redirect rather than a popup).

**Facebook Login for Business → Configuration → Create configuration** —
**one** configuration, for WhatsApp only:
- Start from the **Templates** tab → *WhatsApp Embedded Signup* template
  (or Create configuration and pick the WhatsApp Embedded Signup use case).
- Login variation: the template's default (the business-integration
  variant Embedded Signup needs).
- Assets: WhatsApp Business Accounts. Permissions:
  `whatsapp_business_management`, `whatsapp_business_messaging`.
- Save, copy the **Configuration ID** → `META_WHATSAPP_CONFIG_ID`.

**Pages + Instagram → a configuration too (added 2026-09-12).** The pages
flow ran on `scope` and the owner — admin of five Pages — got "That Facebook
login doesn't administer any Page" on every attempt: the dialog completed,
the token verified, `/me/accounts` answered an empty list. Meta's Facebook
Login for Business page says it outright: "config_id has replaced scope
(which should not be used)". So:

- Facebook Login for Business → **Configurations → Create configuration**.
- Login variation: **User access token** (NOT the business-integration
  system user — that token is for a client business portfolio and does not
  list the person's own Pages).
- Assets: **Pages** and **Instagram accounts**.
- Permissions: `pages_show_list`, `pages_manage_posts`,
  `pages_read_engagement`, `pages_manage_metadata`, `instagram_basic`,
  `instagram_content_publish`; add `pages_messaging`,
  `instagram_manage_messages`, `pages_manage_ads` when their review lands.
- Save, copy the **Configuration ID** → `META_PAGES_CONFIG_ID` in Vercel,
  redeploy.

With the id set, `buildAuthorizeUrl` sends `config_id` (and
`override_default_response_type=true`) and NOT `scope` — the two are
mutually exclusive on the dialog. The dialog then shows the **Page picker**;
tick every Page the business posts from. If the list is still empty
afterwards, the settings screen now says which of three things it was
(`debug_token`): no Page ticked → remove FieldQuo under Facebook → Settings →
Business integrations and connect again; `pages_show_list` not on the token
→ the configuration lacks the Page permissions; granted and ticked but none
listed → the account has no role on those Pages.

The ads flow still runs on `scope` (`ads_read` alone, and it has connected
fine that way); give it its own configuration only if it ever refuses.

**WhatsApp → API Setup**: note the test business number Meta provisions and
add your own mobile under "To" as a verified recipient (it messages a small
fixed list until Advanced access). This is what you message from your phone
in the WhatsApp recording.

### WhatsApp before Access Verification: API Setup + system user token

Embedded Signup (the "Connect WhatsApp" button) refuses the business until
Meta's Access Verification of the app lands (submitted 2026-09-11). Meta's
own get-started guide (developers.facebook.com/docs/whatsapp/cloud-api/
get-started) says what an app admin can do meanwhile, and FieldQuo has a
second door for exactly it: Settings → Meta Ads → WhatsApp card → **Connect
with Cloud API credentials (advanced)**, which posts to
`app/api/settings/whatsapp/manual`. The dashboard clicks, in order:

1. **App Dashboard → WhatsApp → API Setup.** Under *Send and receive
   messages*, the *From* dropdown lists the test number Meta provisioned and
   any business number you have added. To use your own number: *Add phone
   number* → the business portfolio → the display name and category → the
   number itself → verify it by SMS or voice. (The number must not be
   registered on the WhatsApp or WhatsApp Business app on a phone; delete
   the account there first or it cannot be added.)
2. On the same page copy two values shown beside the *From* number:
   **Phone number ID** and **WhatsApp Business Account ID**. Both are long
   decimal strings — not the phone number, and not the app id.
3. Do **not** use the *Temporary access token* on that page: it dies in 24
   hours. Instead: **Business Settings (business.facebook.com/settings) →
   Users → System users → Add.** Name it (e.g. `fieldquo-whatsapp`), role
   **Admin**.
4. Select the new system user → **Add assets → Apps** → tick the FieldQuo
   Meta app → *Manage app* → Save. Then **Add assets → WhatsApp accounts**
   → tick the WhatsApp Business Account → *Manage WhatsApp business
   account* → Save.
5. Still on the system user → **Generate new token** → choose the FieldQuo
   Meta app → token expiration **Never** → tick
   `whatsapp_business_messaging`, `whatsapp_business_management` and
   `business_management` → Generate token. Copy it once; Meta never shows it
   again.
6. In FieldQuo, open the WhatsApp card → *Connect with Cloud API credentials
   (advanced)* → paste the three values → **Verify and connect**.

What FieldQuo does with them before storing anything (all with the pasted
token, none of it trusted from the form):

- `GET /debug_token` — the token must belong to **this** app
  (`META_APP_ID`) and carry both WhatsApp scopes. A token generated under a
  different Meta app would read the number perfectly and route every inbound
  webhook to that other app's callback URL, which is a number that sends and
  never receives; the route refuses it as `wrong_app`.
- `GET /<phone-number-id>?fields=id,display_phone_number,verified_name,
  quality_rating,code_verification_status` and `GET /<waba-id>?fields=id,name`
  — the token reaches both objects.
- `POST /<waba-id>/subscribed_apps` — subscribes this app to the WABA so
  `/api/meta/whatsapp/webhook` receives messages; a failure here fails the
  connect (`no_webhook`).
- `GET /<waba-id>/phone_numbers` — the pasted number must be on that
  account (`number_not_on_waba` otherwise); its display number and verified
  name are what the card then shows.

The row it writes is the same `MessagingChannel` Embedded Signup writes
(`externalId` = the phone number id, `wabaId`, token encrypted), stamped
`connectedVia: "manual"`; the send path and the webhook do not know which
door a number came through. The connection is written to the company's
activity log without the token. Disconnect is the same button as before.

The **Webhooks → WhatsApp Business Account → `messages`** subscription on
the app (below) still has to exist and be verified — `subscribed_apps` says
*which WABAs* deliver to the app, the product webhook says *where*.

No new environment variable: the route needs `META_APP_ID`,
`META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY` and the same
`META_WHATSAPP_ENABLED=1` / `META_APP_MODE=development` switch as the
sign-up button. `META_WHATSAPP_CONFIG_ID` is *not* required for this door.

**Webhooks** (Products → Webhooks, or under each product's Configuration page)

> **Checked 2026-09-12, 17:40 UTC — NOT configured.** Both the Page and the
> Instagram objects had an empty Callback URL, an empty Verify token and
> every field "Unsubscribed". That is why a message sent to Truefinish
> Cabinets on Facebook or Instagram never reached FieldQuo: the per-Page
> `subscribed_apps` call FieldQuo makes at connect time (it succeeded —
> `webhookSubscribedAt` is set) says *which Pages* deliver to the app; only
> this dashboard form says *where*. Without it Meta has no URL to POST to.
> The 84 Facebook conversations now in /app/messages came from the
> 15-minute import cron reading the inbox, not from webhooks.

An object holds ONE callback URL, so the Page object cannot point `messages`
at one route and `leadgen` at another. Point everything at the messaging
webhook — it hands `leadgen` changes to the same import the leads route runs
(`lib/meta/leadsWebhookIngest.js`).

- Object **Page**: Callback URL `https://www.fieldquo.com/api/meta/messaging/webhook`
  (with the `www` — the bare domain answers 308 and Meta does not follow
  redirects), Verify token = the value of `META_WEBHOOK_VERIFY_TOKEN` in
  Vercel, press **Verify and save**. Then press **Subscribe** on:
  `messages`, `message_echoes`, `message_deliveries`, `message_reads`,
  `messaging_postbacks`, and `leadgen`.
- Object **Instagram**: same Callback URL and Verify token, **Verify and
  save**, then Subscribe on `messages`, `messaging_postbacks`,
  `messaging_seen`, `message_reactions`.
- The red banner on both objects reads: *"Apps will only be able to receive
  test webhooks sent from the dashboard while the app is unpublished. No
  production data, including from app admins, developers or testers, will be
  delivered unless the app has been published."* So after saving, switch
  **App Mode** to **Live** (top of the dashboard; needs the Privacy Policy
  URL and Data-deletion callback already set under App settings → Basic —
  both are). Live mode with Standard access still delivers only for people
  with a role on the app until App Review grants Advanced access — that is
  Meta's rule, not ours.
- The `Test` button beside a field sends a sample to the URL; a 200 in the
  dashboard proves the signature and routing. Then send a real message to
  the Page from an account that has a role on the app.
- Object **WhatsApp Business Account**: `messages` →
  `https://www.fieldquo.com/api/meta/whatsapp/webhook`.
- Meta GETs the URL with `hub.challenge` when you press Verify and save —
  this only succeeds **after** the Vercel redeploy with the token set.
  Per-Page subscription (`POST /{page-id}/subscribed_apps`) is done by
  FieldQuo itself when a contractor presses "Connect the inbox", which is
  why `pages_manage_metadata` is in the messaging scope.

**App Review → Permissions and Features**
- Confirm "Standard access" on every permission in the three scope lists
  above (plus `public_profile`). Anything showing "no access" cannot be
  exercised even by an admin — add it here first.
- Remove what nothing calls: `pages_manage_ads` is requested ONLY inside the
  leads scope because Meta's leadgen read wants it; keep it. Remove
  `publish_video`, `catalog_management`, `threads_basic`, `ads_management`,
  `ads_mcp_management` if present.
- **Request advanced access** per permission only after the recording for
  its round exists; the request form is where the §6 answers and the
  screencast go.

**Business Verification**: App settings → Basic → *Verification* row, or
Business Manager → Security Center. Required for Advanced access to
`ads_read` and every messaging permission. Start it first; it is the long
pole.

## Vercel, for completeness

Production environment variables (values are yours; names are these):
`META_APP_ID`, `META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY`
(`openssl rand -base64 32`), `META_WEBHOOK_VERIFY_TOKEN`
(`openssl rand -hex 24`), `META_WHATSAPP_CONFIG_ID`, `META_APP_MODE=development`,
`META_MESSAGING_APPROVED=true`, `META_LEADS_ENABLED=1`, and confirm
`NEXT_PUBLIC_APP_URL=https://www.fieldquo.com`. Redeploy. Then verify the
webhooks in Meta (they ping the live URL).
