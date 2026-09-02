# Sales outreach — a rep's own mailbox, and FieldQuo's copy of the thread

What this covers: a sales rep composing an email to a prospect inside the sales
portal, that email going out **from the rep's own real mailbox**, and the
prospect's reply coming back to that mailbox **and** being filed against the
prospect inside FieldQuo.

The owner asked for both halves — "it should be both" — so neither is the
source of truth for the other. The rep keeps a normal mailbox they can search,
forward and reply from on their phone; FieldQuo keeps the conversation attached
to the lead, next to the pipeline and the attribution.

Nothing in here sends automatically. There is no cron, no sequence and no drip.
Mail leaves only when a rep presses Send on something they typed.

---

## 1. What has to be configured before it works

Four settings. Three of them BLOCK sending until they are set, and the portal
says which one is missing instead of rendering a compose box that would fail —
`lib/sales/outreachReadiness.js` is the one place that decides this, and both
the screens and the send route ask it.

| Setting | Where | Blocks sending? | What it is |
|---|---|---|---|
| The rep's domain, verified in Resend | Resend dashboard | **Yes** | Resend only sends from a domain verified on the account |
| `SALES_REPLY_ADDRESSING` | Vercel env | **Yes** | `plus` or `plain` — see §3 |
| `SALES_MAILING_ADDRESS` | Vercel env | **Yes** | FieldQuo's business mailing address; CASL requires it in the message |
| `SALES_INBOUND_SECRET` | Vercel env | No — but replies are not filed without it | The shared secret on the inbound endpoint |

---

## 2. The From address, and the constraint that is easy to miss

**Resend will only send from a domain that is verified on the Resend account.**

That is not a FieldQuo rule, it is the vendor's, and `lib/email/resend.js`'s own
header states it. It has a specific consequence here that is worth reading
twice:

> The platform's verified sending domain is probably **not** the domain the
> reps' mailboxes are on.

`lib/email/platformSender.js` discovers FieldQuo's sender by asking Resend which
domains are verified, and it deliberately **prefers a `send.` / `mail.`
subdomain** when one exists — reputation isolation for transactional mail. So a
completely healthy deployment can be sending every quote from
`quotes@send.fieldquo.com` while `emilio@fieldquo.com` is an address Resend
refuses outright.

So, to send as `name@fieldquo.com`:

1. Add **`fieldquo.com`** (the root domain the mailboxes are on) as a sending
   domain in the Resend dashboard, alongside whatever is already there.
2. Add the DKIM/SPF records Resend gives you at your DNS host.
   - The mailboxes already live on this domain, so it already has an SPF record
     from the mail provider. **Merge**, do not replace: one TXT record with both
     `include:` mechanisms. Two SPF records is worse than none.
3. Wait for Resend to report `verified`.

Until that is true, the sales portal shows *"Resend can't send as fieldquo.com"*
with the fix, and no compose box. FieldQuo never quietly falls back to the
platform sender for a rep's email: a sales email that arrived from
`quotes@send.fieldquo.com` would show "sent" to the rep while the reply went
somewhere they never look.

`lib/sales/outreachSender.js` is where that check lives. It also excludes any
domain a tenant has claimed (`Company.emailDomainId`), the same rule
`platformSender` uses — FieldQuo must never send its own sales mail from a
customer's domain.

---

## 3. `SALES_REPLY_ADDRESSING` — pick one, after testing

The Reply-To carries the thread's token so the answer can be filed. There are
two ways to carry it and **no default**, because guessing wrong loses mail.

### `plus` — sub-addressing (better, if your provider supports it)

Reply-To becomes `emilio+fqs<token>@fieldquo.com`. The prospect's reply is
addressed to that, so the token is in the reply's own `To:` header — the most
reliable thing to match on — and it still lands in the rep's ordinary inbox.

**Only set this after confirming your mail provider delivers sub-addressed
mail.** If it does not, every reply bounces and the prospect's answer is lost,
and you will not see it from inside FieldQuo because the bounce goes to them.

Two-minute test: send yourself an email addressed to
`youraddress+test123@fieldquo.com` from any outside account. If it arrives in
your normal inbox, use `plus`.

### `plain` — the safe one

Reply-To is the rep's plain address, which cannot bounce because it is their
real mailbox. The token then travels only in the visible `Ref: fqs…` line at the
bottom of every message we send, which an ordinary reply quotes back. Weaker: a
reply that quotes nothing (someone who deletes the quoted text) files nowhere,
and shows up in the platform error log as `no_token`.

---

## 4. `SALES_MAILING_ADDRESS` — required by law, not by taste

CASL s.6 requires a commercial electronic message to identify the sender —
**name and mailing address**, plus a contact — and to carry an unsubscribe
mechanism. That applies to one-to-one B2B cold email in Canada, not only to
blasts.

Every message this feature sends carries a footer with:

```
<Rep name> · FieldQuo · <rep email>
<SALES_MAILING_ADDRESS>
Don't want to hear from me again? Reply with "unsubscribe" and I'll stop.
Ref: fqs…
```

The unsubscribe mechanism is a reply address, which CASL permits, and it is a
**real** one: the Reply-To is the rep's human-read mailbox, and the inbound side
reads opt-outs too (§6). There is no invented machinery behind that sentence.

There is no default and no placeholder. `lib/legal/privacyOfficer.js` set the
precedent for a legally-required detail FieldQuo had not supplied — ship the gap
visibly rather than a plausible fiction — and an email is worse than a web page
for a placeholder, because it has already been delivered to a stranger by the
time anyone notices.

### What this does NOT do, and you should know it

**Consent basis is not recorded per lead.** CASL needs express or implied
consent before a commercial message; the usual basis for B2B cold outreach is
implied consent from a conspicuously published business address relevant to the
recipient's role (s.10(9)(b)). Recording *which* basis applies to *which*
prospect needs a column on `SalesLead`, and this change was not allowed to alter
the schema. So it is a real, named gap, not an oversight: reps must only add
leads they have a lawful basis to contact. If you want it enforced in the
product, that is a schema change and a product decision.

---

## 5. Inbound — the forwarding rule you have to set up

FieldQuo cannot read the rep's mailbox. Their mailbox has to send us a copy.

**Endpoint**

```
POST https://<your-app-host>/api/webhooks/inbound-sales-email
Authorization: Bearer <SALES_INBOUND_SECRET>
Content-Type: application/json
```

**Body** — every field optional except that *something* must carry the token:

```json
{
  "from":       "prospect@acme.com",
  "to":         "emilio+fqsa1b2…@fieldquo.com",
  "replyTo":    "prospect@acme.com",
  "subject":    "Re: quick question about your quotes",
  "text":       "Yes, send it over.\n\nOn Mon… wrote:\n> Ref: fqsa1b2…",
  "html":       "<p>…</p>",
  "inReplyTo":  "<message-id-we-sent>",
  "references": "<…>",
  "messageId":  "<their-message-id>",
  "date":       "2026-09-01T14:05:00Z",
  "replyToken": "fqsa1b2…"
}
```

Form-encoded bodies are accepted too. Common alternative field names are read
without a mapping layer: `sender`, `recipient`, `body-plain`, `body-html`,
`message-id`, `in-reply-to`, `Date`.

**This endpoint implements no vendor's webhook format on purpose.** We do not
know which provider the mailboxes are with, and inventing one's payload shape
would be inventing a capability. Anything that can POST JSON can drive it: a
mail rule with a script, a forwarding/parsing service, a small cron over IMAP.

**Where the token is looked for**, in order: `replyToken`, `to`, `replyTo`,
`references`, `inReplyTo`, `subject`, then the body (which catches the quoted
`Ref:` line). **Never the sender's address** — `app/api/crew/inbound/route.js`
wrote down why for SMS and it holds here: `From` is forgeable and is not
reliably the person you think it is, since prospects reply from phones, aliases
and assistants' accounts.

**Responses.** Authentication failure is a `401`. Everything after that is a
`200` with a reason, because a `4xx` to a mail forwarder means retries or a
bounce back to the prospect:

| `reason` | Meaning |
|---|---|
| filed: true | Stored against the thread |
| `no_token` | Nothing in the payload carried a token — check the forwarding rule. Logged. |
| `unknown_token` | A token no thread has (an old thread deleted, or a mangled value). Logged. |
| `own_outbound` | The `From` is the rep's own address: this is our sent copy coming back. Discarded, not filed. |
| `duplicate` | Same `messageId` already filed on this thread |

`SALES_INBOUND_SECRET` unset **denies every request**, and says so in the server
log. It never falls through to comparing against `Bearer undefined` — the fixed,
publicly-knowable password that `lib/security/cronAuth.js`'s header records
paying for.

Generate one with `openssl rand -base64 32`.

### Forward everything, or only replies?

Either works. If the rule forwards sent items too, those arrive carrying the
same token and are discarded as `own_outbound` — which is deliberate, because
filing them would double every message and, worse, read our own footer's
"unsubscribe" as the prospect asking to stop.

---

## 6. Opt-outs

An inbound reply whose first few typed lines are an unsubscribe request —
`unsubscribe`, `remove me`, `stop emailing me`, `opt out`, and a handful of
neighbours — switches that lead off:

- the compose box does not render for that lead or that thread;
- the send routes refuse with a `409`, re-checked from the database in the same
  request as the send, so an opt-out arriving mid-compose still wins.

Quoted text is stripped before this is read. Without that, every reply would
quote our own footer's "unsubscribe" back at us and mark itself an opt-out.
`"please stop by at 3"` is not an opt-out, and there is a check asserting it.

The verdict is **derived from the messages**, not stored on a flag: the messages
are append-only evidence, so what the screen shows and what the server enforces
cannot drift apart, and no schema change was needed for it.

---

## 7. Where things live

| | |
|---|---|
| `lib/sales/outreach.js` | Pure: tokens, addresses, sanitising, the email text, opt-out detection, the secret check, the scoping fragments |
| `lib/sales/outreachPipeline.js` | The five lead statuses, importable by client components |
| `lib/sales/outreachReadiness.js` | Can this rep send, and if not, exactly what to fix |
| `lib/sales/outreachSender.js` | The Resend domain constraint, and send-then-record |
| `lib/sales/outreachInbound.js` | Filing an inbound message against its thread |
| `lib/sales/outreachGate.js` | The narrow write gate — the exception to `lib/sales/gate.js` |
| `app/api/sales/leads/**`, `app/api/sales/threads/**` | The rep's API |
| `app/api/webhooks/inbound-sales-email/` | The inbound endpoint |
| `app/sales/leads/**`, `app/sales/threads/**` | The screens |
| `scripts/check-sales-outreach.mjs` | `npm run check:sales-outreach` |

---

## 8. Verifying it end to end

1. `SALES_INBOUND_SECRET` set, `SALES_MAILING_ADDRESS` set,
   `SALES_REPLY_ADDRESSING` chosen, the rep's domain verified in Resend.
2. Add a lead with your own personal address on it and send yourself an email
   from the portal. Check the footer has the mailing address and a `Ref:` line.
3. Reply from that address. If the forwarding rule is live, the reply appears in
   the thread within a moment.
4. If it does not: `POST` the JSON above by hand with the token from the `Ref:`
   line. A `200 {"filed":true}` means the endpoint and the secret are right and
   the forwarding rule is what is wrong.
5. Reply with the single word `unsubscribe` and confirm the compose box
   disappears.
