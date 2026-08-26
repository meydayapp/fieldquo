# What to set in Vercel

The running list. **`npm run check:env` fails the build if this file falls out
of step with the code** — every `process.env.X` in `app/`, `lib/`, `scripts/`
and `proxy.js` has to appear here, so a new variable can't be added without
landing on this page.

`.env` is gitignored and affects **your machine only**. Setting something there
does nothing to the deployment.

---

## ⬜ Outstanding — set these

| Variable | Why | What happens today without it |
|---|---|---|
| `RETELL_API_KEY` | Phone receptionist | Every voice screen shows "not configured". No agent, no number, no calls. |
| `RETELL_WEBHOOK_SECRET` | **Optional.** Only for an account whose webhook-signing key is a *different* Retell API key from `RETELL_API_KEY`. | Nothing, in the normal case. See below. |
| `STRIPE_BILLING_WEBHOOK_SECRET` | FieldQuo's own subscriptions | Payment failures never reach us. Nobody is ever marked past-due, so the 7-day grace never starts and a dead card bills forever. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Contractor payouts | A homeowner pays and the invoice stays unpaid on screen. |
| `GOOGLE_MAPS_SERVER_KEY` | Geocoding · Distance Matrix · Solar · Static Maps | Roof measurement is dead. Travel-time booking silently falls back to straight-line estimates — it still works and still says "about", but a river with one bridge fools it. |
| `CRON_SECRET` | Guards all four cron routes | Every cron 401s: no follow-ups, no review requests, no outbound calls, no monthly digest, no large-quote check. Vercel reports the cron as *run*, so this looks fine from the dashboard. |
| `PLATFORM_JWT_SECRET` | Superadmin console session | Fails **closed** — jose refuses a zero-length key, so login appears to work and bounces you straight back out with nothing in any log. |
| `IMPERSONATION_JWT_SECRET` | Read-only support tokens | Throws a 500 with instructions. The one that fails honestly. |

Generate the secrets with:

```bash
openssl rand -base64 32
```

### `RETELL_WEBHOOK_SECRET` is not a secret you invent

It used to be listed above as "generate it with `openssl rand`", and that was
wrong in a way that killed the whole feature. **Retell has no webhook secret.**
It signs every callback with an API KEY — specifically the one carrying the
webhook badge in their dashboard — as
`HMAC-SHA256(rawBody + timestamp)`, sent as `X-Retell-Signature: v=<unix-ms>,d=<hex>`.

So `RETELL_API_KEY` verifies webhooks on its own, and this variable exists only
as an escape hatch for an account where the webhook-badged key differs from the
key we make API calls with. If a call is answered and never recorded, check
Settings → Phone receptionist → *Check it end to end*: a signature we turned
away now appears there by name.

**Where to find it in the Retell dashboard.** The API-keys list marks the
signing key with a badge — Retell's own words are *"Only the API key that has a
webhook badge next to it can be used to verify the webhook"*
([docs](https://docs.retellai.com/features/secure-webhook)). Copy that key into
`RETELL_API_KEY` if you can; if the badged key is not the one you want making
API calls, put the badged one in `RETELL_WEBHOOK_SECRET` and the other in
`RETELL_API_KEY`. The readiness panel names which of the two actually matched,
so a divergence is visible rather than a blanket 401.

**You do not register the webhook URL by hand.** FieldQuo sets `webhook_url` on
each agent when it provisions one, and Retell documents agent-level webhooks as
*overriding* the account-level one: "If set, account level webhooks will not be
triggered for that agent"
([docs](https://docs.retellai.com/features/register-webhook)). So a URL typed
into Settings → Webhooks will be **silently ignored** for every FieldQuo agent
— which looks exactly like a webhook that is configured and working. If
deliveries stop, check the agent, not the account tab.

### Not an environment variable

- **Point Twilio's inbound Messaging webhook at `/api/crew/inbound`** (POST) for
  the crew photo/update inbox. The number crew text must be an SMS-capable
  company number on file (`VoicePhoneNumber`); the endpoint verifies Twilio's
  signature with `TWILIO_AUTH_TOKEN` and is a silent no-op for any number whose
  company hasn't switched the inbox on.


- **Seed the demo accounts** once, after the next deploy — ten sales-demo
  companies, then invite each agent from Settings → Team on their company:
  ```
  npm run seed:demos
  ```
  Switch a demo's trade any time at `/platform/demo`.

- **Wildcard domain `*.fieldquo.com`** in Vercel → Domains. Until it exists **no
  tenant website resolves at all**. The code is ready; the DNS isn't. Locally
  `sunset.localhost:3000` works with no setup, which is why this is easy to miss.
- **Register the two Stripe webhooks** in the Stripe dashboard before the
  secrets above mean anything. Billing and Connect are separate integrations
  with separate endpoints — don't point both at one URL.
- **Rotate three secrets** — they were pasted into a chat transcript:
  Cloudinary API secret, the Neon database password, `BETTER_AUTH_SECRET`.
- **Resend DNS for `fieldquo.com`**: TXT at `resend._domainkey` with Resend's
  key; delete the stale record under `privateemail._domainkey`; root SPF must be
  `v=spf1 include:spf.privateemail.com ~all`. One SPF record per host — a second
  one breaks both.
- **Check the AI model after deploying**: open `/platform`, or hit
  `/api/platform/ai-health`. An amber banner means the configured model is
  retired. Symptom if ignored: every AI feature returns nothing, silently, with
  no error in any log, because `provider.js` catches and degrades.

---

## ✅ Already set (verify after any rotation)

| Variable | Area |
|---|---|
| `DATABASE_URL` | Neon. Scales to zero — first connection after idle can fail with `P1001`. Retry once. |
| `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` | Auth |
| `NEXT_PUBLIC_APP_URL` | Absolute links in emails and PDFs |
| `STRIPE_SECRET_KEY` | Both Stripe integrations |
| `RESEND_API_KEY` | All outbound email |
| `CLOUDINARY_CLOUD_NAME` · `CLOUDINARY_API_KEY` · `CLOUDINARY_API_SECRET` | Signed uploads |
| `OPENAI_API_KEY` | Marked **Sensitive** — can't be read back or pulled locally, so local dev has no AI unless you supply a key by hand |
| `TWILIO_ACCOUNT_SID` · `TWILIO_AUTH_TOKEN` · `TWILIO_API_KEY_SID` · `TWILIO_API_KEY_SECRET` · `TWILIO_PHONE_NUMBER` | SMS |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser maps. Referrer-restricted, so it **cannot** stand in for the server key above — a referrer-restricted key rejects server calls, which have no referrer. |

---

## Optional — sensible defaults in code

Set only to override. The default is in brackets.

| Variable | Default | Effect |
|---|---|---|
| `OPENAI_MODEL` | `gpt-5-mini` | Prefer changing the **code** default — a model name isn't a secret |
| `OPENAI_WRITING_MODEL` | `OPENAI_MODEL` | Separate model for long-form copy |
| `VOICE_CENTS_PER_MINUTE` | `35` | What we charge per voice minute |
| `VOICE_FREE_MINUTES` | `30` | Trial voice allowance |
| `RETELL_COST_CENTS_PER_MINUTE` | `16` | What a minute costs **FieldQuo** at Retell (not what we charge). Only used to estimate how fast the shared pool is draining, on /platform |
| `RETELL_CREDIT_PURCHASED_CENTS` | — | Credit bought at Retell, in cents, typed in by hand after topping up. Retell exposes **no** balance API, so without this /platform shows the burn rate and says the balance is unknown — it never invents one. Update it every time you buy credit, or it silently reports runway an empty account doesn't have |
| `CREW_SMS_CENTS` | `2` | What we charge per crew text (per segment) |
| `CREW_MMS_CENTS` | `5` | What we charge per crew photo — an MMS costs us more than a text |
| `CREW_OVERDRAFT_CENTS` | `200` | How far a company may go into the red before the crew line is disconnected at Twilio |
| `RETELL_TEST_NUMBER` | — | Comma-separated shared test numbers |
| `FIELDQUO_SALES_NUMBER` | — | **FieldQuo's own** sales line, comma-separated. The webhook recognises it as FieldQuo's rather than dropping the call as an unknown number, and the calls land on `/platform/sales-agent`. Buy the number on the Retell account first. Must NOT be a tenant's number or `RETELL_TEST_NUMBER` — both are detected and reported |
| `FIELDQUO_SALES_TRANSFER_TO` | — | Where **FieldQuo's own** sales agent puts a caller through. Unset, it has no tools and sends people to /contact. Never set this to `RETELL_TEST_NUMBER` — see `/platform/sales-agent` |
| `EMAIL_FROM` · `EMAIL_FROM_LOCAL` · `EMAIL_REPLY_TO` | `quotes@…` | Fallback sender when a company has no verified domain |
| `SALES_NOTIFICATION_EMAIL` | `emilio@fieldquo.com` | Where new-signup alerts go |
| `LARGE_QUOTE_LOOKBACK_MINUTES` | — | Large-quote cron window |
| `PAYROLL_PROVIDER_API_BASE` · `PAYROLL_PROVIDER_API_KEY` | — | Payroll export. Absent = the export is unavailable, not silently wrong. |

`NODE_ENV` and `VERCEL_URL` are set by the platform. Don't set them by hand.

---

## After changing anything here

Vercel does **not** apply new environment variables to a running deployment.
Redeploy, or the variable exists in the dashboard and nowhere else — which
looks identical to having set it correctly.
