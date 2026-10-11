# The post-signup email sequence

What a person hears from FieldQuo, by email, from the moment they start the
signup form — in order, with the time each one is sent, who decides, and
where the "sent once" record lives. Every row is a letter FieldQuo writes
about the company's OWN account; none of it is white-labelled, on purpose
(lib/email/billingEmail.js says why).

Nothing below is machine-translated at send time. Each letter is built from
sentences already in a catalogue, in the reader's language where the
catalogue has it, English otherwise — the "Language" column says which.
"Reader → company → English" is ONE rule for every letter FieldQuo writes
to a contractor (`lib/i18n/letterLanguage.js`): the recipient's own
`User.language` (region stripped, "fr-CA" → "fr"), else
`Company.defaultLanguage`, else English, in all nine app catalogue languages
(en fr es uk pa tl de zh it). For a letter to the company's contact address
(billing, trial reminders) the reader is the earliest owner. The trial
reminders read the company's language alone until 2026-10-11, and the trial
sequence sent an unknown code to English rather than to the company's
language; both use the helper now. (The next-steps letter and the two signup
nudges still choose their own way, described in their rows.)

---

## The envelope: one layout for all of them

Since 2026-10-11 the letters FieldQuo writes to a contractor about FieldQuo
share one envelope, `lib/email/platformLayout.js`:

- FieldQuo logo (`public/email/fieldquo-logo.jpg`, white ground baked in so
  a dark-mode inbox cannot turn it navy-on-black) and a small **Help · Your
  account** header (Help only for somebody with no account yet);
- a hidden **preheader** line (the inbox preview);
- an optional **hero image** in a 600px slot from a 1200px source — only
  from FieldQuo's own host (www.fieldquo.com `public/`, or FieldQuo's own
  Cloudinary cloud); anything else is dropped, never hotlinked;
- short copy and **one pill button**, plus a **plain-text part**;
- a footer enforced by `kind`:
  - **transactional** — a label saying it is account mail, FieldQuo's
    mailing address when `SALES_MAILING_ADDRESS` is set, and *no*
    unsubscribe or preferences link (the layout throws if given one);
  - **commercial** (tips / updates / offers, and the signup nudges) — the
    mailing address and an unsubscribe link are REQUIRED (the layout throws
    without them), "Manage email preferences" for anyone with an account,
    and the RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post` headers.
- The content card stays white in dark mode; only the page, header links and
  footer darken (measured: every pair ≥ 4.5:1 in both schemes).

The four letters that existed before moved onto it with their wording
untouched: `npm run check:platform-email-layout` compares the md5 of every
one's text part (the trial reminder had none, so its subject, heading,
paragraphs and button) with the record taken before the move — 144
comparisons, 0 differ.

Since 2026-10-11 the billing family is on it too, as **transactional**
letters: subscribed, plan changed, renewal, grace (both), cancelled (both),
the referral-month letters, AI credit low, and every `buildPlatformNotice`
user (phone-number rent, auto top-up, crew-line rent, client tickets).
They had no text part; their words — subject, heading, company line, the
body's own HTML, the button — are md5-identical to the old navy-band shell's
for all 108 letter/language combinations and both notice shapes
(`check:billing-lifecycle-emails`, record in
`scripts/fixtures/billingLetterPartsBaseline.json`), and each now has a
plain-text part, sent by every caller.

## Email preferences (contractor users)

Per USER, `EmailPreference` (lib/email/preferences.js, preferencesStore.js):

| Category | Default when never chosen | Sent by |
|---|---|---|
| Product tips & setup help (`tips`) | on (they started the trial the tips are about) | the trial sequence below |
| Product updates & newsletter (`updates`) | on only if they ticked "Send me product news and offers" at signup (`User.marketingConsentAt`) | the monthly product-updates letter |
| Offers (`offers`) | same as updates | the win-back letter |
| Billing, security, trial notices | always sent — not a switch anywhere | billing, auth, trial reminders, trial ended |

- No-login page: `/email-preferences/<token>` (the footer link; `?c=tips`
  puts a one-button "Unsubscribe from product tips" on top). GET never
  changes anything (mail scanners pre-fetch links).
- One-click: `POST /api/email-preferences/<token>/unsubscribe?c=tips` — the
  `List-Unsubscribe` target; without `?c` it switches every optional
  category off. A GET there redirects to the page.
- In the app: **Settings › Notifications → Emails from FieldQuo**, the same
  panel, for the signed-in person only (support sessions are refused).
- FieldQuo's own do-not-contact list (`SalesSuppression`) still wins over
  any "on"; the page says so when the address is on it.

---

## Before the card

| When | Letter | Decides | Once-per record | Language | Cron |
|---|---|---|---|---|---|
| **+5 min** after the person's last activity on /signup | "Your 14 free days are waiting" — the way back in and the trade's three selling points (`lib/email/signupEarlyNudgeEmail.js`). Commercial: address, `/no-contact` opt-out, List-Unsubscribe → `POST /api/no-contact/<token>` | `lib/signup/earlyNudge.js` | `SignupNudge` row, touch `early` | en / fr / es, else English (the trade table's languages) | `/api/cron/signup-recovery`, every 5 min |
| **+24 h** after a Company was created with no card and no trial | The recovery note (`lib/email/signupRecoveryEmail.js`). Commercial, as above | `lib/signup/abandoned.js` | `Company.signupNudgeSentAt`, mirrored to `SignupNudge` touch `recovery` | the nine app catalogues, per-key English fallback | same cron |
| +30 min of quiet (not an email) | The lead becomes a HOT prospect on the sales floor | `lib/signup/salesFloor.js` | `Prospect` | — | `/api/cron/signup-leads` |

## The trial: the combined day-by-day calendar

Day 0 is the local date the company signed up (`Company.timezone`, Toronto
when unset). This is the calendar for a company that **does nothing** —
executed hour by hour by `npm run check:lifecycle-emails` for a 14:20
Toronto signup, which fails if the plan ever produces anything else:

| Day | Local time | Email | Kind | Skipped when |
|---|---|---|---|---|
| 0 | +2 h after signup | **Next-steps letter** ("finish setting up") | transactional | every checklist step is already done |
| 1 | ~09:40 | **Nudge: take card payments** (Stripe Connect) | tips | Stripe already connected → the next open feature goes instead |
| 3 | ~09:40 | **Personal note** from a named FieldQuo person (plain text, Reply-To them) | tips | no sender name + reply-to set on /platform/companies — then it is never sent |
| 4 | ~09:40 | **Nudge: turn on online booking** | tips | bookable hours already set (booking page live) |
| 5 | ~09:40 | **Help articles** — 2–3 real articles for the trade and the open features, plus customer stories if the platform lists any | tips | — |
| 6 | ~09:40 | **Nudge: send your first quote** | tips | a quote has been sent |
| 7–8 | 09:00 UTC | **Trial reminder: 7 days left** | transactional | a plan was chosen |
| 9 | ~09:40 | **Nudge: import your clients** | tips | clients were imported (bulk-insert fingerprint) |
| 11–12 | 09:00 UTC | **Trial reminder: 3 days left** | transactional | a plan was chosen |
| 13–14 | 09:00 UTC | **Trial reminder: 1 day left** | transactional | a plan was chosen |
| 14–15 | first free slot after the trial ends | **Your free trial has ended** — read-only until {lock date}, nothing deleted, choose a plan | transactional | a plan was chosen |

The reminder days are "the first 09:00 UTC run with ≤ 7 / 3 / 1 days left",
so they fall on day 7 or 8, 11 or 12, 13 or 14 depending on the signup hour.

**Milestones** slot into the same calendar, the day AFTER they happen, once
each, ahead of the day's planned email (which then moves to the next free
day):

| Milestone | Letter | Skipped when |
|---|---|---|
| Booking page goes live | "Your booking page is live — here's where to share it": the company's real booking link, website embed, Google Business Profile "Book" link, Facebook/Instagram bio, email signature | — |
| Stripe connected | "Card payments are on — let clients pay over time next": turn on financing (Klarna / Affirm where Stripe activated them), the pay-over-time help article | financing already on (`offerFinancing`) |
| First quote sent | "Your first quote is out": follow-ups and the client portal | — |

### The rules that make the calendar

- **Never two lifecycle emails on one local day.** A day that already carried
  the next-steps letter, a trial reminder or a sequence email gets nothing
  more; a day on which the trial-reminder cron WILL send at 09:00 UTC
  (predicted with the reminder's own pure decision) gets nothing from the
  sequence first. The reminders are transactional; the sequence yields. This
  is why the trial-ended letter lands the day after the end when the 1-day
  reminder went out that morning.
- **09:00–18:00 local** for the sequence (hourly cron at :40).
- **Feature nudges**: days 1–10, at least 2 days apart, in the order
  payments → booking → quote → import, each skipped (recorded
  `already_done`) when done — checked when planned AND again after the claim.
- **Personal note**: days 3–6; **help articles**: days 5–9; **milestones**:
  within 7 days of the milestone; **trial ended**: within 48 h of the end.
  Past its window a letter is recorded `too_late` (or
  `sender_not_configured`), never sent late.
- **Who**: the company's first active owner, in their own language
  (`lib/i18n/letterLanguage.js`: `User.language`, else
  `Company.defaultLanguage`, else English; nine languages). Never a demo, a company FieldQuo ended, a reserved test domain,
  an address on the do-not-contact list (a failed read fails closed), or —
  for tips letters — someone who switched tips off.
- **Backlog guard**: only companies created on/after
  `LIFECYCLE_SEQUENCE_STARTS_AT` (2026-10-12) get the sequence; the
  trial-ended letter only within 48 h of an end.
- **Once**: `LifecycleEmail` — one row per (company, kind), unique; claimed
  before the send, released on a refusal (retried after 6 h), stamped with
  the address, language and subject that went.

### Where each letter lives

| Letter | Builder | Decides | Record | Cron |
|---|---|---|---|---|
| Next-steps letter | `lib/email/onboardingNextStepsEmail.js` | `lib/signup/nextSteps.js` | `Company.nextStepsEmailSentAt` / `nextStepsEmailSkipped` | `/api/cron/onboarding-next-steps`, every 15 min |
| Trial reminders 7/3/1 | `lib/email/trialReminderEmail.js` | `lib/billing/trialReminder.js` | `Company.trialReminder7At` / `3At` / `1At` | `/api/cron/trial-reminders`, daily 09:00 UTC |
| Nudges, milestones, personal note, help articles, trial ended | `lib/lifecycle/emails.js` (copy: `lib/i18n/lifecycleEmailCopy.js`) | `lib/lifecycle/plan.js`, carried out by `lib/lifecycle/run.js` | `LifecycleEmail` rows | `/api/cron/lifecycle-emails`, hourly at :40 |
| Win-back, product updates | `lib/lifecycle/winBack.js`, `lib/lifecycle/productNewsletter.js` (copy: `lib/i18n/accountNoticeCopy.js`) | `planMarketing` in `lib/lifecycle/marketing.js`, through the same day gate (`sendDayGate`) | `LifecycleEmail` rows `win_back:<Stripe sub id>`, `newsletter:<YYYY-MM>` | the same cron, after the trial sequence |

Languages: next-steps letter — the eight document languages (zh → English);
trial reminders — the nine app catalogues; the sequence — all nine.

### What the "done" signals are

| Feature | Done when | Source |
|---|---|---|
| Card payments | `Company.stripeChargesEnabled` | the onboarding checklist's own "payments" step |
| Online booking | bookable hours (`AvailabilitySchedule`) for an active member, a business profile the public page serves, and a slug | the "availability" set-up step's measurement + `findBookingCompany` |
| First quote | the earliest `Quote.sentAt` | derived from data (not a checklist step) |
| Import clients | two or more of the company's clients created in the same second | derived from data: the CSV import is the only bulk insert on `Client` |

### Platform console

- `/platform/companies` — **Trial sequence emails**: who the personal note is
  from (name, title, reply-to, phone, booking link; superadmin-only, audit
  log `lifecycle_email_settings_updated`) — and, until a name and reply-to
  are set, the words "Not being sent"; the customer stories (title, trade,
  link, optional FieldQuo-hosted image; none → no block); sent counts per
  letter.
- `/platform/companies/<id>` — **Lifecycle emails**, read-only: every letter
  above with when it went, to whom, in which language, or why it did not
  (from `LifecycleEmail` and the older Company stamps), and the owner's
  email preferences.

---

## After the card

| When | Letter | Decides | Once-per record | Language | Cron |
|---|---|---|---|---|---|
| **+0** — account created | "Confirm your email address" (`lib/email/authEmails.js`) | Better Auth | one link per request | en / fr / es | none |
| **+0** — Checkout completed | "You're subscribed" — plan, seats, trial end (`lib/billing/notify.js` → `buildBillingEmail({ kind: "started" })`) | `notifySubscriptionState`, from the webhook AND the on-return reconcile, whichever lands first | `Subscription.welcomeEmailSentAt` | owner → company → English | none (webhook / reconcile) |
| On a plan switch | "Your plan changed" (`kind: "changed"`) | `notifySubscriptionState` | `Subscription.notifiedPlanId` | owner → company → English | none |
| 7 days before a card-backed trial ends (30 before a yearly renewal) | Renewal notice — amount, card, the way to cancel (`kind: "renewal"`) | `lib/billing/renewalReminder.js` | `Subscription.renewalRemindedPeriodEnd` + `renewalReminderSentAt` | owner → company → English | `/api/cron/renewal-reminders`, daily 09:00 UTC |
| Payment failed, and at ≤ 2 days of grace left | Grace notice and reminder (`kind: "grace"`) | `lib/billing/graceWarning.js` | `Subscription.graceWarnedAt`, `graceFinalWarnedAt` | owner → company → English | `/api/cron/grace-warning`, daily 09:00 UTC |
| A cancellation: at the press for a paid plan booked to end; when it ENDS (a trial cancelled on the spot, the booked date, a portal cancel, dunning) | "Your plan ends on {date}" / "Your plan has been cancelled" (`kind: "cancelled"`). Not sent to a company FieldQuo ended or locked — its Resume is refused | `notifyCancellation`, from the cancel route AND the `customer.subscription.deleted` webhook | the "ended" letter: `Subscription.cancellationNotifiedFor` = the ended Stripe subscription id, claimed before the send and restored on failure — one per cancellation (until 2026-10-11 the route and the webhook both sent it); cancel → resubscribe → cancel still gets two | owner → company → English | none |
| When a referral month LANDS — the referrer at the referred business's first paid invoice, the newcomer when it chooses a plan | "You earned a free month" / "Your free month is applied", with the new charge date (`lib/referrals/rewardEmail.js`) | `claimAndExtend` in `lib/referrals/index.js`, only when the extension worked | `ReferralCredit.notifiedAt` (claimed, restored on failure) | owner → company → English | none (webhook / plan selection) |
| When an AI charge leaves the AI credit under $5 (`AI_CREDIT_LOW_CENTS`) | "Your AI credit is running low" to every active owner and admin, with the balance and a top-up link (`lib/ai/creditLow.js`) | the ledger's two writers (`lib/voice/credits.js` debit / add) | `Company.aiCreditLowNotifiedAt` — set on the crossing, cleared by a top-up back to $5+; a plan's month-end expiry is not a crossing | each recipient's own language → company → English | none (on the charge) |
| The 1st of each month | The monthly summary (`lib/ai/monthlyDigest.js`) to active owners and admins. Audience by the access rules (`lib/ai/digestAudience.js`): a live plan, past_due inside its grace, a card-free trial still running, or a hand-made company with onboardingStatus active — never a demo or an ended / locked / cancelled company (card-free trials were all missed until 2026-10-11: the filter was `onboardingStatus "active"`, written only by Checkout). A TRIAL whose month recorded nothing gets no summary | `/api/cron/monthly-digest` | `AiDigest` row per company per month | reader → company | monthly 08:00 UTC |
| **Win-back** — from 14 days after a cancellation TOOK EFFECT (`Subscription.canceledAt`: the end date for a plan booked to end) until the account locks on day 30; the first hour with a free local day, 09:00–18:00 local | "Your FieldQuo account is still here" — nothing deleted, read-only until {date}, the changelog entries shipped since, Choose a plan (`lib/lifecycle/winBack.js`). **Offers** letter: address, Unsubscribe, Manage preferences, List-Unsubscribe | `planMarketing` (`lib/lifecycle/marketing.js`) — never a demo, anything FieldQuo ended/locked, a company that came back, the do-not-contact list (a failed read fails closed), a test address, or an owner whose `offers` is off | `LifecycleEmail` `win_back:<Stripe sub id>` — once per cancellation | reader → company → English | `/api/cron/lifecycle-emails`, hourly at :40 |
| **Product updates** — the first 7 local days of each month, the first hour with a free local day, 09:00–18:00 local, ONLY when last month has entries in `lib/data/productUpdates.js` | "What's new in FieldQuo — {month}": each entry's title, summary and full-post link (`lib/lifecycle/productNewsletter.js`). **Updates** letter: same footer and headers | the same — to a customer now (a live plan, past_due in grace, or a card-free trial running), the owner's `updates` on | `LifecycleEmail` `newsletter:<YYYY-MM>` — once per issue; a week the gate blocks throughout is not sent late | each entry in the reader's language when wholly translated, else English whole | the same cron |

These billing, referral and AI-credit letters are on `platformLayout.js` as
transactional mail (see "The envelope" above). No preference or
do-not-contact list silences them, the same as "we couldn't charge your
card".

**The one-a-day rule includes the marketing letters.** A win-back or a
newsletter is a `LifecycleEmail` row like the trial sequence's, so it counts
for the trial sequence's gate the same day, and both ask the same
`sendDayGate` (`lib/lifecycle/plan.js`): never a second lifecycle email on a
local day, never outside 09:00–18:00 local, and never on a day the 7/3/1
trial reminder will still go out.

Day 1 and day 7 also carry sales check-in DRAFTS for the rep who holds the
company (`lib/sales/checkin/signals.js`) — a text only when a rep presses
send, not an email.

---

## The next-steps letter, in more detail

**Who.** A non-demo company whose `getOnboardingStatus()` says
`complete: false` at the moment of sending, AND either no `Subscription` row
with a `trialEndsAt` (the card-free trial) or a `Subscription` in `active`
or `trialing`. One letter per COMPANY: the claim lives on `Company`.

**What each row says.** The step's own catalogue label, then one line:
logo, address, services — a catalogue sentence; pricing and Stripe — the
trade's own sentence from `lib/sales/tradeSellingPoints.js` (en / fr / es;
the catalogue's plain sentence in the other five); tax registration — the
country's own `whyKey`. Then the additional set-up steps still on the card
(at most five by name).

**Social proof** prints only from ≥ 10 real companies of the trade.

**What it does not carry.** No unsubscribe (transactional). No "rather one
email a week?" — no weekly digest exists to switch to.

**Check.** `npm run check:onboarding-next-steps`.
