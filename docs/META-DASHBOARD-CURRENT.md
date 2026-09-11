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
- `https://www.fieldquo.com/api/meta/messaging/webhook` — Page + Instagram `messages`
- `https://www.fieldquo.com/api/meta/leads/webhook` — Page `leadgen`
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

The ads and pages flows do **not** use a configuration: the code sends
`scope`, and Facebook Login for Business accepts the classic `scope` dialog
for Business apps. Do not create configurations for them — a `config_id` and
a `scope` are mutually exclusive on the dialog, and the code would have to
change to send one. If, during testing, the ads or pages dialog ever
refuses with a message about a required configuration, that is the moment
to add `config_id` support to `buildAuthorizeUrl`, not before.

**WhatsApp → API Setup**: note the test business number Meta provisions and
add your own mobile under "To" as a verified recipient (it messages a small
fixed list until Advanced access). This is what you message from your phone
in the WhatsApp recording.

**Webhooks** (Products → Webhooks, or under each product's Configuration page)
- Object **Page**: callback `https://www.fieldquo.com/api/meta/messaging/webhook`,
  verify token = `META_WEBHOOK_VERIFY_TOKEN`; subscribe to `messages`,
  `messaging_postbacks`. Object **Page** again (same callback is fine, or the
  leads one): `leadgen` → `https://www.fieldquo.com/api/meta/leads/webhook`.
- Object **Instagram**: `messages` → the messaging webhook.
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
