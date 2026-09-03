# FieldQuo — sales rep standard operating procedure

How a rep works a lead from first contact to a paid customer, using only
controls that exist.

Every step below names the screen or the function behind it. Where the product
does **not** do something, this document says so rather than describing a
workflow you cannot perform. If a step here does not match what you see on
screen, the screen is right — tell somebody.

---

## 0. Before you start — the five rules that are not negotiable

1. **You can never write to attribution, commission, payouts or subscriptions.**
   `lib/sales/gate.js` refuses every method except GET, HEAD and OPTIONS, and
   `REP_FORBIDDEN_WRITES` names those tables explicitly. You cannot pay
   yourself, and you cannot correct your own record. This is a feature.
2. **An opt-out binds FieldQuo, not your copy of a row.** Once somebody says
   stop, only a superadmin can lift it, with a written reason. You cannot.
3. **You cannot self-attribute.** If your email matches the company's, or you
   are a member of it, `selfDealReason()` refuses. It is checked *before* the
   already-attributed branch, so there is no ordering trick.
4. **Superadmins can read every note you write.** `lib/sales/notes/visibility.js`
   says so verbatim on the screen: *"FieldQuo superadmins can read every note
   you write here."* There is no private space in the rep portal.
5. **The prospect's rules govern, not yours.** Whichever country the prospect
   is in decides what is legal, regardless of where you are sitting.

---

## 1. Getting set up

### Accepting your invite

Your invite link is `/sales/invite/<token>` and it **expires after 7 days**
(`INVITE_TTL_DAYS`). Only a SHA-256 hash of the token is stored, so a lost link
cannot be recovered — it has to be reissued.

Set a password of **at least 12 characters** (`MIN_PASSWORD_LENGTH`). Accepting
consumes the token: `inviteTokenHash` and `inviteExpiresAt` are nulled, and a
second click gets a 409.

**There is no "forgot password" flow.** None. If you lock yourself out, a
superadmin has to reissue the invite. Write the password down somewhere safe.

Your session lasts **12 hours** (`SESSION_HOURS = 12`).

### Check these four things on day one

| Check | Where | If missing |
|---|---|---|
| Commission plan assigned | ask a superadmin | **You earn nothing at all, silently.** `earnMilestone()` returns `null` with no plan, rather than guessing an amount. |
| `workEmail` assigned | ask a superadmin | You cannot send a single email. Blocker `no_work_mailbox`. |
| Sending domain verified | `/sales/leads` shows it | Blocker `sender_domain_unverified`. |
| Your signup code | `/platform/sales/reps`, or the SMS preview | Without it you have no link to give anyone. |

**Your code is fixed after creation and cannot be changed.** By the time you
have been selling a week it is on a card and in a signature; editing it would
quietly stop some of your signups counting.

### Your signup link

    https://<app-origin>/signup?sales=<your-code>

Built by `signupLinkFor()` in `lib/sales/repStats.js`. The origin comes from the
request, so a preview deployment hands out a preview link — **always copy your
link from the real production app.**

> **The link gives the contractor nothing extra.** No free month beyond the
> normal trial, no credit, no banner. Verified in `app/api/companies/route.js`:
> `salesCode` is resolved independently of the promo and referral waterfall.
> The referral programme *does* give a free month. Yours does not. **Never
> promise a discount for using your link.**

> **Known gap:** `/api/sales/me` computes your `signupLink`, your `code` and
> your signup counts for today, this week and lifetime — and **nothing in the
> rep portal renders any of it.** The shell reads only your name. You cannot
> see your own numbers or your own commission balance on any screen you can
> reach. Ask a superadmin, who has them at `/platform/sales/performance`.

---

## 2. The five screens you have

| Screen | What you can actually do |
|---|---|
| `/sales` | **Read-only.** Your companies, their signup date, subscription status and milestone pills. No button here writes anything. |
| `/sales/queue` | Claim prospects, read the research, call, then mark worked / release / do-not-contact. |
| `/sales/leads` | Add and work leads. Compose and send email. Text your signup link. |
| `/sales/threads` | Read conversations, reply. |
| `/sales/notes` | Your own notes. Autosaves after 1.5 s. Archive only — nothing deletes. |

---

## 3. Working the queue

### Claim before you call

Press **"Claim the next one"** after picking a trade. There are **39 trades**
in the picker (`DISCOVERY_TRADES`).

**You cannot browse the pool.** There is no endpoint that lists unclaimed
prospects — you get a per-trade *count* only. A count is not a list, and this
is deliberate: it stops one rep freezing the board by claiming two hundred and
calling nine.

**A claim lapses after 48 hours** (`CLAIM_HOURS = 48`) if you do not work it.
The prospect returns to the pool for somebody else.

If the queue is empty, the screen tells you which of three reasons applies.
**You cannot trigger discovery** — it runs on cron only. "Nothing is free to
claim in this trade. Discovery has to run again before there is."

### Read the three layers, and keep them separate

`prospectView()` returns three separate arrays and never merges them, because
`§2` of the Phase 2 spec requires fact, inference and recommendation to stay
distinct in the database *and* in the UI.

| Heading on screen | What it is | How to use it on a call |
|---|---|---|
| **What we observed** | Fact. Something a crawler actually saw. | Safe to state directly. |
| **What we infer** | Inference, with a confidence. | Say it as a question, not a claim. |
| **What to pitch** | Recommendation. | A suggestion, not a script. |
| **What we do not know** | Named gaps. | Ask about these. |

An inference with no confidence renders as a **refusal string**, not as a
claim. Do not repair it by guessing.

**Three inversions the detector is deliberately careful about, and you should
be too:**

- A website that will not load is **not** a business without a website.
- A page that returns 200 with no links is **not** proof of nothing on offer —
  it is usually a JavaScript site our crawler cannot execute.
- "We could not look today" never overwrites "we looked last week and there was
  a booking page".

**A capability marked `false` is a real observation; `null` means we don't
know. Never read `null` as "they don't have it."**

### Calling

The dial control is a plain `tel:` link, and it appears **only** when
`contactability()` says the prospect is callable — do-not-contact is checked
first, then a missing phone.

> ### ⚠️ The calling window is written down and NOT enforced. This is on you.
>
> `lib/sales/callingWindow.js` defines the legal window:
>
>     Weekdays  09:00 – 21:30    in the PROSPECT's own time zone
>     Weekends  10:00 – 18:00
>
> `withinSalesCallingHours()` has **no production caller anywhere** — only its
> check script imports it. The `tel:` link on the queue has no window check in
> front of it. **The product will happily let you dial a prospect at 3 a.m.
> their time and break Canada's Unsolicited Telecommunications Rules.**
>
> Until this is wired up, check the clock yourself, every time, in *their*
> zone. This is the single largest compliance exposure in the rep workflow.

On every call you must **identify yourself and give a callback number** — a
requirement of the same rules.

**Canada:** B2B is exempt from the National DNCL *rules*, but registration at
`lnnte-dncl.gc.ca` is free and mandatory anyway. **US:** B2B is almost entirely
exempt from the TSR, but the **TCPA has no B2B exemption** for prerecorded or
autodialled calls to mobiles — and small contractors answer on mobiles. Which
is why the rule is: **a human dials, one call at a time.** Never automate it.

### Closing out a claim

| Button | Effect |
|---|---|
| **"I spoke to them — keep this one"** | `worked`. Clears the expiry so the claim never lapses. |
| **"Put it back in the pool"** | `release`. Somebody else can claim it. |
| **"They asked not to be contacted"** | `do_not_contact`. Requires a written reason. **Permanent.** |

> **A discrepancy to know about.** The route's own comment says a worked
> prospect "leaves the rep's active queue". It does not — `queueWhere` matches
> `claimExpiresAt: null`, which is exactly what `worked` sets, so **worked
> prospects stay in your queue permanently.** The code is what ships. Expect
> your queue to accumulate.

### The gap between the queue and everything else

**There is no control that turns a claimed prospect into a lead.**
`SalesLead.prospectId` exists in the schema and no route ever writes it. If you
want to email or text somebody you found in the queue, **you must retype them
by hand into `/sales/leads`.** Budget for it.

---

## 4. Working a lead

### Creating one

`/sales/leads` → add. Only `businessName` is required.

**Set the time zone as soon as you have it.** `SalesLead.timeZone` is stated by
you and is **never inferred from an area code** — a mobile's area code is not
where its owner lives. Without it you cannot text at all
(`time_zone_unknown`). There are **10 permitted zones**, from
`America/St_Johns` to `Pacific/Honolulu`.

### Statuses

Five, on the lead page. `statusAfterSend()` moves `new` → `contacted` on a
successful send and **nothing ever walks a status backwards**.

### Sending an email

The compose box **does not render at all** when there is a blocker. If you see
`OutreachNotice` instead of a box, read it — it names the blocker.

**Blockers — no box, and a send would 409:**

| Code | Meaning | Who fixes it |
|---|---|---|
| `no_work_mailbox` | No `workEmail` assigned | Superadmin |
| `rep_email_invalid` | `workEmail` is malformed | Superadmin |
| `sender_domain_unverified` | Provider says the domain is not verified | Owner (DNS) |
| `reply_addressing_unset` | `SALES_REPLY_ADDRESSING` is neither `plus` nor `plain` | Owner |
| `mailing_address_unset` | `SALES_MAILING_ADDRESS` empty — CASL requires it | Owner |

**Warnings — the box still renders:**

| Code | Meaning |
|---|---|
| `sender_domain_unknown` | We could not ask the provider. Not a refusal. |
| `inbound_not_configured` | `SALES_INBOUND_SECRET` unset — **replies are not being filed.** Watch your own mailbox. |

**What actually goes out.** From is your work mailbox directly —
`Your Name <you@fieldquo.com>` — with **no fallback to your login address**.
Reply-To is either `you+fqs<token>@…` (`plus` mode) or your plain address with
the token only in the visible footer (`plain` mode).

Every email carries a four-line CASL footer that is **not optional**: your name
and address, FieldQuo's postal address, an unsubscribe instruction, and the
reference token. `buildOutboundEmail` **throws** rather than send a degraded
version.

**The order of checks on send** — suppression is checked *first*, above
readiness, on purpose:

    suppression → readiness → reply address → build → send → THEN write the row

**The thread row is written only after the provider returns an id.** A failed
send leaves you nothing to retry from rather than a message marked sent that
nobody received.

### Texting your signup link

One fixed message. **You cannot compose it:**

    <your name> here, from FieldQuo — here's the link we talked about:
    <link> FieldQuo, <mailing address>. Reply STOP to opt out.

**The texting window is 08:00–21:00, every day, flat, in the prospect's zone**
(`SALES_SMS_WINDOW`). This is *not* the calling window, and the difference is
deliberate: CASL imposes no time-of-day rule on commercial texts, so what binds
a text is the TCPA's flat window. 20:59 is in; 21:00 is out. Unlike the calling
window, **this one is enforced** — `outside_sms_window` blocks the send.

SMS blockers: `twilio_unconfigured`, `no_sales_number`, `mailing_address_unset`,
`rep_name_missing`, `no_signup_link`, `lead_no_phone`, `phone_unusable`,
`phone_outside_nanp` (North America only), `suppression_unreadable`,
`suppressed`, `time_zone_unknown`, `outside_sms_window`, `time_zone_unusable`.

**`time_zone_unknown` is the only one you can clear yourself.**

> **There is one sales number for the entire team**, not one per rep. A STOP
> arriving on it **stops every rep at once**. That is the compliance posture,
> not an oversight. Treat the shared number as a shared asset.

> **A per-rep callback number does not exist.** `NUMBER_CAPABILITIES` marks it
> `available: false` and no picker is rendered. Do not promise a prospect a
> direct line.

### Linking a signup

When a lead signs up, open the lead → **"Link a signup"** → pick from candidate
companies. This sets `convertedCompanyId` and moves the status to `signed`.

**This is bookkeeping, not attribution.** Attribution already happened, at
signup, when the company used your link. Linking does not create or move it.

---

## 5. Opt-outs — read this twice

An opt-out is the one thing in this workflow you cannot undo.

**What counts as an opt-out by email:** `detectOptOut()` reads only the visible
reply text (quoted history stripped, or our own footer would flag every reply)
and only the **first three non-empty lines**, matching whole lines against 20
phrases — `unsubscribe`, `remove me`, `take me off your list`, `opt out`,
`do not contact me`, and so on. A bare "stop" is **not** an email opt-out
phrase.

**By text: STOP.** And **START does not reverse it.** The tenant side does
reverse it because carriers expect that; the sales side deliberately does not,
because `lib/sales/suppression.js` has no self-service removal.

**An unqualified "stop" closes every channel.** `ALL_CHANNELS` — email, phone
and sms. A phone opt-out stops the email too. Over-suppression is the failure
this list is *allowed* to have.

**One domain entry suppresses every mailbox at that company.** Lookup widens —
the exact address, then the address with any `+tag` stripped, then the whole
domain.

**If the list cannot be read, the text is blocked** (`suppression_unreadable`).
That is the deliberate opposite of the email path's handling of an unreachable
provider, and it is the right way round for the channel with the sharper
penalty.

**Retention: three years and fourteen days**, computed on the calendar so a
leap year cannot shorten it. **Nothing prunes these rows and nothing deletes
them.** Removal is a superadmin-only soft flag with a mandatory reason.

An opt-out recorded against a lead applies **across every lead sharing that
address**, not just yours. The rep-scoped version was a bug: two reps holding
the same prospect meant an opt-out silenced only one of them.

---

## 6. What happens after they sign up

You stop being involved, and the milestones run on their own.

| Stage | Trigger | Timing |
|---|---|---|
| Signup | Company uses your link | Attribution locks immediately |
| **Activated** | Stripe Connect enables charges | Webhook, minutes |
| **First payment** | First real invoice paid, `> $0` | ~day 30, when the free month ends |
| **Still paying** | Still active 60 days after **subscription start** | Nightly sweep, 09:20 UTC |

Amounts, the exact qualification rules and worked examples are in
`docs/sales/ONBOARDING-AND-COMP.md`.

**What a given rate of production actually pays, week by week, is in
`docs/sales/VOLUME-SCENARIOS.md`** — seven scenarios from 1 to 7 signups a
weekday, each with the ramp to steady state, the prospect throughput the
pipeline has to supply, and what gives way first at that rate. Read it before
agreeing to a number. The short version: **steady state is roughly
`signups per weekday × $300 a week`**, it is not reached until week 9–13,
and **the first twelve weeks pay 57–60% of twelve steady weeks** at every rate.
Six and seven a day are above what the enrichment pipeline can currently feed at
a 1% conversion rate; the arithmetic is in that file's §3.

**Two things worth knowing on a call:**

- A contractor who cancels during the free month never produces a first
  payment, so two of your three milestones never fire. **Qualify hard.**
- Retention money from a March cohort lands in May. Your first two months look
  worse than your steady state. That is arithmetic, not performance.

**Payouts** close weekly — Mondays 10:07 UTC, for the *previous* Monday-to-
Monday UTC week — into a batch marked `ready`. **A person pays it.** Nothing
transfers money to a rep automatically.

---

## 7. What is not built — do not wait for it

Each of these is something a rep would reasonably expect. None exists.

1. **The playbook is real and you cannot see it.** `lib/sales/playbook/` holds
   nine call stages and eight written objection responses
   (`ALREADY_USE_COMPETITOR`, `TOO_EXPENSIVE`, `NO_TIME_TO_SWITCH`,
   `DONT_NEED_A_WEBSITE`, `BOOKING_NOT_FOR_US`, `EMAIL_WORKS_FINE`,
   `SEND_ME_INFO`, `NOT_INTERESTED`), each with the cues a prospect actually
   says. **Every consumer is a superadmin screen.** No file under `app/sales/`
   imports any of it. Until that changes, ask a superadmin to export the
   objection responses and keep them beside you on paper.
2. **No outbound dialler.** Twilio Voice does not exist in this repo. Every
   call is you, on your own phone, one at a time.
3. **No automated or drip outreach.** Every email and every text needs a human
   pressing send. There is no cron behind either.
4. **No queue → lead bridge.** Retype by hand.
5. **No rep-facing dashboard.** Your signups, your link and your commission
   balance are computed and rendered nowhere you can reach.
6. **No password reset.**
7. **No manager tier.** `SalesRep` carries no reporting line
   (`HAS_REPORTING_LINE = false`). Notes are visible to you and to superadmins,
   nobody in between.
8. **Lead score does not order your queue.** Claims come out oldest-first
   (`createdAt: "asc"`), explicitly *not* by score, because nothing in this
   build writes a `ProspectScore` yet.

---

## 8. Quick reference

```
Signup link      https://<production-origin>/signup?sales=<your-code>
Session          12 hours
Password         12 characters minimum
Invite expires   7 days
Claim expires    48 hours, unless worked

Texting window   08:00–21:00 daily, prospect's zone     ENFORCED
Calling window   09:00–21:30 weekdays                   NOT ENFORCED — yours to obey
                 10:00–18:00 weekends

Opt-out          Permanent. Superadmin-only removal, written reason.
                 Retained 3 years + 14 days. STOP is not reversed by START.

Milestones       Activated $20 · First payment $40 · Still paying $65 = $125
Retention clock  60 days from SUBSCRIPTION START, trial included
                 (day 61 if the subscription started after 09:20 UTC)
Payouts          Mondays 10:07 UTC, previous UTC week, paid by a human

Steady state     signups per weekday × $300/week, reached week 9-13
First payouts    activation week 1 · first payment week 5 · retention week 9
                 Full tables: docs/sales/VOLUME-SCENARIOS.md
```

**The one sentence to carry into every call:** never promise a control that
does not exist. There is no mobile app, no self-serve demo, no warm transfer,
and no discount for using your link. Everything else on the feature list is
real, and the nine partial features say exactly where they stop.
