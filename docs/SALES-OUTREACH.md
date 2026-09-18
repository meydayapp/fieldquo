# Sales outreach — a rep's own mailbox, and FieldQuo's window onto it

What this covers: a sales rep reading and answering their work email inside
the sales portal (`/sales/threads`), that email going out **from the rep's own
real mailbox**, and every reply landing in that mailbox **and** in FieldQuo,
filed against the lead.

**Since 2026-09-18 the live path is §0 — the mailbox connection.** The owner
bought each rep a Namecheap Private Email inbox and decided the portal should
be a second window onto it: the rep keeps using privateemail.com on their
phone, and what they read or send in either place shows in both. §1–§5b below
describe the earlier design (Resend sending with a Resend-received reply
domain); that code stays in the tree as the fallback for a deployment that
cannot connect a mailbox, and nothing a rep does today goes through it.

Nothing in here sends automatically. There is no cron that sends, no sequence
and no drip. Mail leaves only when a rep presses Send on something they typed.
(The one cron, `sales-mailbox-sync`, READS.)

---

## 0. The mailbox connection — the path that is live

### What the owner does (once per rep)

On `/platform/sales/reps`, on the rep's card, **Work mailbox → Connect** (or
**Change**): the mailbox address and its Namecheap password, in one form. The
Namecheap hosts are pre-filled — `mail.privateemail.com`, IMAP 993 (SSL), SMTP
465 (SSL), username = the address, "Master or Application password" (Namecheap's
own setup page) — and only appear behind *Server settings* if they need
changing. **Test and save** tests IMAP and SMTP with the password, seals it,
and writes `SalesRep.workEmail` and the `SalesMailbox` row together
(`lib/sales/mailbox/store.js`). A failed test still saves, as *Connection
failed*, with the IMAP and SMTP lines in words and a **Retry** — the one
failure Retry cannot fix is a wrong password, and its sentence says so.
**Disconnect** erases the password and stops the sync; nothing in the mailbox
or in FieldQuo is deleted.

The rep does nothing. Their Conversations page either works or says *"Your
mailbox hasn't been connected yet — ask the owner."*

The card prints, per rep: Connected / Connection failed / Not connected, the
IMAP and SMTP results, the last sync (when, how many new), and the last error
— in words, from the row, never assumed.

### What syncs, and how

`app/api/cron/sales-mailbox-sync` runs every minute (`vercel.json`), and for
each connected mailbox `lib/sales/mailbox/sync.js`:

- pulls every message above the last stored UID in **INBOX** and in the
  server's **\Sent** folder (learnt on connect; Namecheap's is `Sent`), at most
  40 per folder per tick, parses it (mailparser), stores it as a `SalesMessage`
  with its Message-ID / In-Reply-To / References, its folder and UID, and
  whether the server held it as \Seen;
- threads by **References first** (any id in the chain we hold), then by the
  same counterpart + normalised subject within 14 days, else a new
  `SalesThread`;
- matches the counterpart address to one of the rep's leads (the lead's own
  address, then the prospect row's; two leads at one address match nobody) and
  fills `SalesThread.leadId` — a lead created later claims its earlier mail on
  the next tick; a thread with no lead shows under **Everything else**;
- re-hosts attachments to Cloudinary (`sales-mailbox/<mailboxId>`), up to
  25 MB each, and stores a "couldn't be stored" entry by name otherwise;
- mirrors read state **both ways**: a message \Seen on the server (read on
  the phone) is read here; a thread opened in the portal marks its messages
  \Seen on the server (`lib/sales/mailbox/readMirror.js`);
- honours an opt-out in a synced reply exactly as the Resend door did, keyed
  on the lead's address, in the same transaction;
- pushes *"New email from …"* to the rep for a new unseen inbound message —
  never during a first sync, which is backfill.

Polling by UID rather than IMAP IDLE: IDLE needs a socket that stays open and
a Vercel function does not keep one. A minute is the honest latency.

### What sending does

A send from the portal — new, reply, reply-all, forward — composes the message
once (nodemailer), sends it through the rep's SMTP as `Name <rep@fieldquo.com>`,
appends the same bytes to the mailbox's Sent folder so the phone shows it, and
records the `SalesMessage` with the Message-ID it minted, which is how the next
sync recognises the appended copy as ours. In-Reply-To / References are set
from the answered message so the prospect's client threads it. The CASL footer
and the "Ref:" line stay (`lib/sales/outreach.js`).

Recipients are a **closed set** computed on the server from the lead's record
and the thread (`lib/sales/emailRecipients.js`): the lead's address, the
prospect's, whoever wrote in, whoever they copied, the rep's own mailbox. An
address outside it is refused by name.

### 0c. The intro email — "we tried calling you"

After an outbound call the line logs as `no_answer`, or a `voicemail` the rep
saves, the console asks "Send {business} the intro email?". The email is fixed
wording in EN/FR/ES (`lib/sales/outreach/introEmail.js`): the pitch in eight
points, a quote at phone width, the rep's signup link, and two buttons —
"Ask {rep} to call me back", "Book a 15-minute demo" — plus a one-click
unsubscribe in the footer. It goes through the same `deliverOutreach` as
every other rep send (suppression list, readiness, filed on the lead's
thread, copy in Sent), and one `SalesIntroEmail` row records the send.

The two buttons land on `/i/<token>` — a sealed token (AES-GCM under
`META_TOKEN_ENCRYPTION_KEY`, the same key the mailbox password uses) with a
30-day expiry. The page shows one button; the POST behind it is single-use
per kind. A call-back request writes a `SalesEvent` on the rep's calendar at
the next business hour where the prospect is and pushes the rep; a demo
request is stamped and pushed (there is no per-rep public booking page); an
unsubscribe writes the do-not-contact list for the email channel. The rep's
Today shows the unhandled requests as two counters; the lead page shows each
email and its requests, with "Mark as handled".

Guards: the same address is not sent a second intro inside 14 days, by any
rep; a typed address is saved on the lead first (`SalesContactEmail`) and is
never saved from a test account. `npm run check:sales-intro-email` executes
all of it.

### Never destructive

`lib/sales/mailbox/` never deletes, moves, expunges or flags \Deleted on the
server, and `scripts/check-sales-mailbox.mjs` asserts by scanning the directory
that the words never appear. The portal's two writes to the server are \Seen
on a read message and the append of a portal send to Sent.

### Security notes

- The password is sealed with the platform's at-rest key
  (`META_TOKEN_ENCRYPTION_KEY`, AES-256-GCM — `lib/meta/tokenCrypto.js`, reused
  on purpose: one key to rotate) in the request that receives it; the
  plaintext is not kept, logged or returned. No route selects the column
  (the check script scans every route under `/api`); `MAILBOX_PUBLIC_SELECT`
  is the only shape that leaves `lib/sales/mailbox/store.js`. imapflow and
  nodemailer are constructed with `logger: false` so no LOGIN line reaches a
  Vercel log. Connecting is refused while the key is unset.
- It is opened only by the sync and the send, on the server, for one session.
- Revoking clears the column. There is no "show password".
- Superadmin only for connect / retry / disconnect
  (`app/api/platform/sales/reps/[id]/mailbox`). An admin sees the status.
- Bodies are stored and rendered as text; a prospect's `<script>` is four
  characters on a screen.

### Checks

`npm run check:sales-mailbox` — MIME fixtures (multipart, HTML-only, quoted
reply, attachments, headerless), threading, matching, the credential
round-trip, SMTP mocked, the sync against a fake IMAP and a fake database
(first sync files and announces nothing; a redelivered UID files nothing; our
own appended send is not filed twice; a message read on the phone is read
here; a lead created later claims its thread; a UIDVALIDITY change restarts
without duplicates), the inbox arithmetic, the recipient set, formatting and
quoting, drafts, readiness.

---

## 1. (Earlier design) What had to be configured before it worked

Six settings. Three of them BLOCK sending until they are set, and the portal
says which one is missing instead of rendering a compose box that would fail —
`lib/sales/outreachReadiness.js` is the one place that decides this, and both
the screens and the send route ask it. The last three are the inbound half —
pick ONE of the two doors (§5b is the one that works with the reps' Namecheap
mailboxes; §5 is for a mailbox that can POST to a URL).

| Setting | Where | Blocks sending? | What it is |
|---|---|---|---|
| The rep's domain, verified in Resend | Resend dashboard | **Yes** | Resend only sends from a domain verified on the account |
| `SALES_REPLY_ADDRESSING` | Vercel env | **Yes** | `plus` or `plain` — see §3 |
| `SALES_MAILING_ADDRESS` | Vercel env | **Yes** | FieldQuo's business mailing address; CASL requires it in the message |
| `SALES_REPLY_DOMAIN` | Vercel env + Resend + DNS | **Yes, once set** — blocked until Resend receives for it | The subdomain replies are routed through — §5b |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Vercel env, from Resend | **Yes, when `SALES_REPLY_DOMAIN` is set** | The signing secret of the `email.received` webhook — §5b |
| `SALES_INBOUND_SECRET` | Vercel env | No — but replies are not filed without it (or §5b) | The shared secret on the generic inbound endpoint — §5 |

(Superseded by §0. With the mailbox connected none of the Resend variables
above are consulted for a rep's mail; `lib/sales/outreachReadiness.js` asks
only whether the rep's work mailbox is connected and whether
`SALES_MAILING_ADDRESS` is set.)

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

### With `SALES_REPLY_DOMAIN` set, choose `plus`

When replies are routed through Resend (§5b) the sub-addressing question goes
away: Resend receives for **every** address at the reply domain, so
`emilio+fqs…@reply.fieldquo.com` cannot bounce, and the token rides in the
reply's own `To:` header. `plain` still works there (`emilio@reply.fieldquo.com`,
token in the `Ref:` line) but has no advantage. The readiness blocker says the
same when the mode is unset and the domain is set.

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
**real** one: the Reply-To reaches the rep's human-read mailbox (directly, or
forwarded through the §5b door), and the inbound side reads opt-outs too (§6).
There is no invented machinery behind that sentence.

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

## 5. Inbound — the forwarding rule you have to set up (generic door)

> **On this deployment, read §5b instead.** The reps' mailboxes are on
> Namecheap Private Email (MX `mx1`/`mx2.privateemail.com`), which can forward
> mail to another *address* but cannot POST to a URL. Nothing has ever called
> this endpoint, which is why no reply has ever appeared on a rep's
> conversation page. This section stays as the alternative for a mailbox
> provider that can drive a webhook, and as the contract the Resend door maps
> onto.

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

## 5b. Inbound via Resend Receiving — the door that works with Namecheap

The idea: stop expecting the mailbox to talk to us, and make the reply come to
a domain **we** receive for. The rep's outreach still goes out **From**
`name@fieldquo.com`. Only the **Reply-To** moves, to
`name+fqs<token>@reply.fieldquo.com`. Resend receives the prospect's reply,
posts an `email.received` event to `/api/webhooks/resend-inbound`, and FieldQuo:

1. fetches the message from Resend (the event carries metadata only, never the
   body — Resend's design, for large attachments);
2. files it on the thread through the **same** function as §5 —
   `lib/sales/inboundEmail.js` — so every rule there (token never read from the
   sender, echoes discarded, duplicates refused, opt-outs honoured) applies
   unchanged;
3. re-hosts any attachments to Cloudinary and stores them on the message, in
   the same shape as the messaging inbox, so the thread shows them;
4. **forwards a copy to the rep's real mailbox** — `From` the platform sender,
   `Reply-To` the prospect, same subject, the prospect's own text and HTML,
   attachments included up to 20 MB — with one line at the top:
   *"Filed on Dana · Acme Painting in FieldQuo — reply from FieldQuo to keep the
   thread there (a reply sent from this mailbox reaches them but is not
   filed)."* or *"Not filed in FieldQuo: <reason>."* This forward is not a
   nicety: with this door the reply went to Resend, not to the rep, and the
   forward is the only way a human sees it. It happens for `no_token` and
   `unknown_token` too, addressed to the rep whose local part is on the reply
   address. The forward's Resend id is recorded on the message row
   (`SalesMessage.forwardProviderId`) and on the receipt.
5. records a `SalesInboundReceipt` keyed on Resend's email id — the
   idempotency: a redelivered event is answered `duplicate` and forwards
   nothing a second time.

### What "both halves" means now

The rep's mailbox still has every reply (the forwarded copy), searchable and
answerable from a phone. FieldQuo has it filed against the prospect. **A reply
typed in the mailbox is not captured** — it goes straight to the prospect — so
the copy's first line says to reply from FieldQuo. That is the honest version
of "both"; the previous one never delivered either half.

### Setup — DNS (Namecheap, `fieldquo.com`)

Resend's own guidance, quoted: *"If you already have existing MX records for
your domain (because you're already using it for a real inbox, for example),
we recommend that you create a subdomain (e.g. `subdomain.example.com`) and add
the MX record there."* `fieldquo.com` already has Namecheap's MX records for
the reps' mailboxes, so the reply domain is a **subdomain**. Never add Resend's
MX to the root: *"you will not receive emails at Resend if the required MX
record is not the lowest priority value for the domain"* — and making it the
lowest would divert the reps' real mail to Resend.

**Copy the exact record from the Resend dashboard** (it is shown when
Receiving is enabled, below). For the `us-east-1` region it is:

| Type | Host | Value | Priority | TTL |
|---|---|---|---|---|
| `MX` | `reply` (i.e. `reply.fieldquo.com`) | `inbound-smtp.us-east-1.amazonaws.com` | `10` | Automatic |

(The region in the value follows the domain's region on the Resend account —
the dashboard's copy is authoritative; this table is what to expect.)

Nothing else. Sending is not enabled on the reply subdomain and needs no
SPF/DKIM there; the rep's `From` is `fieldquo.com`, which §2 already verified.

### Setup — Resend dashboard

1. **Domains → Add domain** → `reply.fieldquo.com` (same region as
   `fieldquo.com`). Verify it. (Resend: *"If you have not already done so, add
   and verify your domain."*)
2. On that domain's page, **switch on Receiving** — Resend: *"you can enable
   receiving by using the toggle in the receiving section of the domain details
   page. After enabling receiving, you'll see a modal showing the MX record
   that you need to add to your DNS provider."* Add the record at Namecheap
   (Advanced DNS → Mail Settings for the subdomain, or a Custom MX record with
   host `reply`), click **I've added the record**, and wait for the receiving
   record to show **verified**. The API then reports
   `capabilities.receiving: "enabled"`, which is what readiness checks.
3. **Webhooks → Add webhook**: endpoint
   `https://<your-app-host>/api/webhooks/resend-inbound`, event
   **`email.received`** only. Open the webhook's page and copy its **signing
   secret** (`whsec_…`).

### Setup — Vercel

| Variable | Value |
|---|---|
| `SALES_REPLY_DOMAIN` | `reply.fieldquo.com` |
| `RESEND_INBOUND_WEBHOOK_SECRET` | the `whsec_…` from step 3 |
| `SALES_REPLY_ADDRESSING` | `plus` (§3) |

Redeploy. Until every one of these is true, sending is **blocked** with the
specific missing piece named (`reply_domain_not_receiving`,
`reply_domain_without_webhook`, `reply_domain_invalid`) — a Reply-To at a
domain that bounces, or that Resend receives into a hole with no webhook, would
lose every reply invisibly, which is the one outcome §3's "no default" rule
exists to prevent. `RESEND_API_KEY` must be set too: the door fetches the
message and sends the forward with it.

### The webhook's own rules

- **Signature.** Resend signs through Svix: `svix-id`, `svix-timestamp`,
  `svix-signature` headers over the raw body, HMAC-SHA256 with the
  base64-decoded secret. Verified by hand in `lib/sales/resendInbound.js`
  (timing-safe, five-minute timestamp tolerance, rotation-aware), against
  Svix's published reference vector in `scripts/check-resend-inbound.mjs`.
  **An unset secret denies everything**, the same as every other secret here.
  A failed check is a `401` — so a wrong secret shows as failing in Resend's
  webhook log rather than as working.
- **Everything after that is a `200` with a reason** (§5's table, plus
  `forwarded`, `forwardedTo`, `forwardError`), except our own failure — a
  `500`, which Resend retries; the receipt is marked `error` so the retry is
  let through.
- **Idempotent on Resend's email id.** `SalesInboundReceipt.resendEmailId` is
  unique; a second delivery is `duplicate` before anything is fetched or sent.
- **The token is read from `to` first, never from `from`** — the mapper in
  `lib/sales/resendInbound.js` puts the sender in `from` and nowhere else,
  and the check script asserts that a token in the From files nowhere.
- **Attachments** come from `GET /emails/receiving/:id/attachments`, whose
  `download_url` is signed and expires in an hour — so the bytes are fetched
  in the webhook and put on Cloudinary (`sales-inbound/<threadId>`); the
  stored entry never carries Resend's URL. A file that could not be fetched is
  stored **by name** with the reason, and the thread says
  *"kitchen-plan.pdf couldn't be stored"* rather than showing nothing.
  Per-file cap 25 MB; the forwarded copy carries up to 20 MB in total and names
  what it left out.
- **Where the copy goes when nothing filed.** The local part of the reply
  address (`emilio+fqs…@reply.fieldquo.com` → `emilio`) is matched against
  `SalesRep.workEmail` — our own rows, never the sender. No match: nothing is
  forwarded, and the platform error log records `forward_failed` with the
  Resend email id so the message can be found under **Emails → Receiving** in
  the Resend dashboard.

### Test procedure

1. Readiness first: open a rep's compose screen (or their card in
   `/platform/sales/reps`). No blocker, no *"Replies are not being filed"*
   warning.
2. Send yourself an email from the portal. In the received message, check the
   headers: `From: <rep>@fieldquo.com`, `Reply-To: <rep>+fqs…@reply.fieldquo.com`.
3. Reply from that address. Within a moment:
   - the reply is on the thread in `/sales/threads/<id>`, with *"A copy is in
     your mailbox"* under it;
   - the rep's real mailbox has the copy, first line *"Filed on … in FieldQuo"*,
     `Reply-To` your address.
4. Reply again with a PDF attached. The thread shows the file as a link; the
   copy carries it.
5. In Resend → Webhooks → the endpoint → **Logs**, resend the same event. The
   response is `{"filed":false,"reason":"duplicate"}` and no second copy
   arrives.
6. Reply with the single word `unsubscribe` and confirm the compose box
   disappears.

If step 3 shows nothing: Resend → Emails → **Receiving** tab. If the reply is
not there, the MX record is wrong (check `dig MX reply.fieldquo.com`). If it
is there, the webhook is: check its Logs for the status code — a `401` is the
secret, a `500` is in the platform error log under `sales_inbound`.

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
| `lib/sales/inboundEmail.js` | Parse → file → log, shared by both inbound doors |
| `lib/sales/resendInbound.js` | Pure: the Svix signature check, the event→contract mapper, the forwarded copy's words |
| `lib/sales/resendInboundDoor.js` | The Resend door end to end: claim, fetch, file, re-host, forward, record — every dependency injected |
| `lib/sales/inboundAttachments.js` | Re-hosting a reply's attachments to Cloudinary |
| `lib/email/resendReceiving.js` | `GET /emails/receiving/:id` and its `/attachments` |
| `lib/sales/outreachGate.js` | The narrow write gate — the exception to `lib/sales/gate.js` |
| `app/api/sales/leads/**`, `app/api/sales/threads/**` | The rep's API |
| `app/api/webhooks/inbound-sales-email/` | The generic inbound endpoint (§5) |
| `app/api/webhooks/resend-inbound/` | The Resend Receiving endpoint (§5b) |
| `app/sales/leads/**`, `app/sales/threads/**` | The screens |
| `scripts/check-sales-outreach.mjs` | `npm run check:sales-outreach` |
| `scripts/check-resend-inbound.mjs` | `npm run check:resend-inbound` — the signature against Svix's vector and a tampered copy, unset secret denies, event→contract, duplicate event forwards nothing, token never from From |

---

## 8. Verifying it end to end (generic door — for §5b see its own test procedure)

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
