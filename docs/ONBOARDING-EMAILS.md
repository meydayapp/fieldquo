# The post-signup email sequence

What a person hears from FieldQuo, by email, from the moment they start the
signup form — in order, with the time each one is sent, who decides, and
where the "sent once" record lives. Every row is a letter FieldQuo writes
about the company's OWN account; none of it is white-labelled, on purpose
(lib/email/billingEmail.js says why).

Two halves, because there are two kinds of person:

- **Before the card** — a `SignupLead` row, or a `Company` with no
  `Subscription`. These letters are *commercial* under CASL (they ask
  somebody to come back and buy) and carry FieldQuo's mailing address and a
  one-click do-not-contact link.
- **After the card** — a `Company` with a `Subscription`. These are
  *transactional* (account admin to a paying customer) and carry no
  unsubscribe: lib/marketing/unsubscribe.js's split.

Nothing below is machine-translated at send time. A letter is built in the
company's `defaultLanguage` (or the lead's `language`) where the builder has
that language, and English otherwise — each builder says which.

---

## Before the card

| When | Letter | Decides | Once-per record | Language | Cron |
|---|---|---|---|---|---|
| **+5 min** after the person's last activity on /signup | "Your free month is waiting" — the way back in and the trade's three selling points (`lib/email/signupEarlyNudgeEmail.js`) | `lib/signup/earlyNudge.js` (`EARLY_NUDGE_DELAY_MINUTES`) | `SignupNudge` row, touch `early`, unique on (address, touch) | en / fr / es, else English | `/api/cron/signup-recovery`, every 5 min |
| **+24 h** after a Company was created with no card | The recovery note (`lib/email/signupRecoveryEmail.js`) | `lib/signup/abandoned.js` (`NUDGE_DELAY_HOURS`, `NUDGE_WINDOW_DAYS` = 30) | `Company.signupNudgeSentAt`, mirrored to `SignupNudge` touch `recovery` | en / fr / es, else English | same cron |
| +30 min of quiet (not an email) | The lead becomes a HOT prospect on the sales floor; a rep may call or text | `lib/signup/salesFloor.js` | `Prospect` unique on the lead | — | `/api/cron/signup-leads`, every 15 min |

A lead a rep holds is skipped by both letters (two senders in five minutes
is the thing to avoid). A demo company never gets either.

## At the card, and after

| When | Letter | Decides | Once-per record | Language | Cron |
|---|---|---|---|---|---|
| **+0** — account created | "Confirm your email address" (`lib/email/authEmails.js`, Better Auth `sendOnSignUp`) | Better Auth | one link per request; verification is not required to use the app | en / fr / es | none (on the request) |
| **+0** — Checkout completed (`Subscription` row appears) | "You're subscribed" — plan, seats, trial end, link to Account & Billing (`lib/billing/notify.js` → `buildBillingEmail({ kind: "started" })`) | `notifySubscriptionState`, from the Stripe webhook AND the on-return reconcile, whichever lands first | `Subscription.welcomeEmailSentAt` (written after a confirmed send) | **English only** today | none (webhook / reconcile) |
| **+2 h** (default; a superadmin can set 1–72 h or switch it off on /platform/companies) — *only if the onboarding checklist is still open* | **The next-steps ("finish setting up") letter** — to a card-free trial (no Subscription, a trial date) or a live card-backed company; the trade in the subject, "Your free month runs until {date}" for a trial, a numbered block of ONLY the open steps in the checklist's order (at most 5), one line per step on what it unlocks for the trade, each a button that opens that step's window on the home page (`/app?step=<key>`; the Stripe row keeps the payments page and says it opens Stripe), a tick list of what is done, then the additional set-up steps still on the card (at most 5 by name, each a link) (`lib/email/onboardingNextStepsEmail.js`) | `lib/signup/nextSteps.js` — due from `Company.createdAt + delay`, no longer due `NEXT_STEPS_WINDOW_HOURS` (72 h) after that; the checklist, set-up steps and do-not-contact list are re-read after the claim | `Company.nextStepsEmailSentAt` (claimed before the send, reverted if it did not go out) and `nextStepsEmailSkipped` (`onboarding_complete` / `no_recipient` / `suppressed` / `test_address` — decided once, never revisited); `Subscription.nextStepsEmailSentAt/Skipped` still read as the record of letters before 2026-09-24 | the eight document languages, else English | `/api/cron/onboarding-next-steps`, every 15 min |
| Day 1 and day 7 (not an email) | Sales check-in DRAFTS for the rep who holds the company — a text goes only when a rep presses send | `lib/sales/checkin/signals.js` (`SCHEDULED_CHECKIN_DAYS`) | `SalesCheckIn` row per company per touchpoint | — | `/api/cron/sales-checkins`, daily 07:00 UTC |
| **7 days before the trial ends** (30 days before a yearly renewal) | The renewal notice — amount, card, the way to cancel (`buildBillingEmail({ kind: "renewal" })`) | `lib/billing/renewalReminder.js` (`TRIAL_NOTICE_DAYS`, `RENEWAL_WINDOW_DAYS`) | `Subscription.renewalRemindedPeriodEnd` + `renewalReminderSentAt`, keyed to the period | English only | `/api/cron/renewal-reminders`, daily 09:00 UTC |
| When a payment fails, and again at ≤ 2 days left of the 7-day grace | The grace notice and the last-chance reminder (`buildBillingEmail({ kind: "grace" })`) | `lib/billing/graceWarning.js` (`GRACE_DAYS` = 7, `REMIND_AT_OR_BELOW_DAYS` = 2) | `Subscription.graceWarnedAt`, `graceFinalWarnedAt` | English only | `/api/cron/grace-warning`, daily 09:00 UTC |
| The 1st of each month | The monthly digest | `/api/cron/monthly-digest` | its own | — | monthly 08:00 UTC |

Also on request rather than on a timer: team invitations
(`lib/email/teamInvite.js`) to people an owner invites against their seats,
and the referral invitation (`lib/referrals`), each with their own once-per
record.

---

## The next-steps letter, in more detail

**Who.** A non-demo company whose `getOnboardingStatus()` says
`complete: false` at the moment of sending, AND either no `Subscription` row
with a `trialEndsAt` (the card-free trial — every signup since 2026-09-24) or
a `Subscription` in `active` or `trialing`. Companies the platform console
creates by hand have neither and are outside it. There is no "invited
company" path — invitations add *people* to an existing company. One letter
per COMPANY: the claim lives on `Company`, so a trial that then chooses a
plan is not written to again through its new Subscription row.

**Why not the welcome email's slot.** The confirmation goes at +0 and says
"you're subscribed". Two hours later the person has either finished setting
up (nothing is sent, and the decision is recorded so a tick that drops off
later does not resurrect it) or has not, and then the useful letter is the
one that says exactly which steps are open and opens each one.

**What each row says.** The step's own catalogue label (the same key the
checklist card renders), then one line:

- logo, address, services — a product sentence from the catalogue
  (`app.nextSteps.unlock.*`), in the eight languages;
- pricing — the trade's own quote sentence from `lib/sales/tradeSellingPoints.js`
  (`quotes` / `price_book` / `instant_quotes`, whichever the trade lists first;
  the generic `quotes` line when the trade is unknown);
- Stripe — the trade's `card_payments` sentence where its list carries one,
  the generic one otherwise, plus "this one opens Stripe";
- tax registration — the country's own `whyKey`, the sentence the card prints.

Never a second copy of any of those sentences. In de / it / uk / pa / tl the
trade table does not exist, so pricing and Stripe use the catalogue's
`app.nextSteps.unlock.pricing` / `.payments`, the subject carries no trade and
no social-proof sentence is printed — never an English trade sentence inside
another language.

**The additional set-up steps.** After the checklist, the rows the dashboard's
"Additional set-up steps" card still shows (`remainingSteps(stepsFor(snapshot))`
— not done, not hidden, applicable), at most five by name and "…and N more on
your home page", each a link to its own page with `?from=setup`. A row whose
feature has a selling point in the one table prints it (en / fr / es only).

**Social proof.** "The N painting businesses on FieldQuo sent their first
quote a median of X after signing up" prints ONLY when
`firstQuoteMinutesForTrade()` finds at least `NEXT_STEPS_PROOF_MIN_COMPANIES`
(10) real, subscribed, non-demo companies of that trade with a quote. On
2026-09-21 there are three real subscribed companies in total, so nothing
prints; the letter carries no number rather than an anecdote.

**What it does not carry.** No unsubscribe (transactional, see above). No
"rather one email a week?" — there is no weekly digest to switch to, and a
link that promised one would be a dead control.

**Where to see it.** `/platform/companies/<id>` prints "Next-steps email:
Sent {when}" or the recorded reason it was not; `/platform/companies` holds
the switch and the delay, superadmin-only on write, audit-logged as
`onboarding_next_steps_email_updated`.

**Check.** `npm run check:onboarding-next-steps` executes the rule, the
settings normaliser, the link mapping, the proof gate and the builder (en /
fr / es and the other five, all-done, no trade, hostile name, junk proof, the
trial line, the set-up rows) and the card-free-trial fixtures (due, already
sent, then subscribed, demo, suppressed, `subscription` undefined throws), and
reads the wiring.
