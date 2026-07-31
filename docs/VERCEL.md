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
| `RETELL_WEBHOOK_SECRET` | Verifies Retell's callbacks | Call results are **rejected unverified** — calls happen, nothing is recorded, no lead, no charge. |
| `STRIPE_BILLING_WEBHOOK_SECRET` | FieldQuo's own subscriptions | Payment failures never reach us. Nobody is ever marked past-due, so the 7-day grace never starts and a dead card bills forever. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Contractor payouts | A homeowner pays and the invoice stays unpaid on screen. |
| `GOOGLE_MAPS_SERVER_KEY` | Geocoding · Distance Matrix · Solar · Static Maps | Roof measurement is dead. Travel-time booking silently falls back to straight-line estimates — it still works and still says "about", but a river with one bridge fools it. |
| `CRON_SECRET` | Guards all four cron routes | Every cron 401s: no follow-ups, no review requests, no monthly digest, no large-quote check. Vercel reports the cron as *run*, so this looks fine from the dashboard. |
| `PLATFORM_JWT_SECRET` | Superadmin console session | Fails **closed** — jose refuses a zero-length key, so login appears to work and bounces you straight back out with nothing in any log. |
| `IMPERSONATION_JWT_SECRET` | Read-only support tokens | Throws a 500 with instructions. The one that fails honestly. |

Generate the secrets with:

```bash
openssl rand -base64 32
```

### Not an environment variable

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
| `RETELL_TEST_NUMBER` | — | Comma-separated shared test numbers |
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
