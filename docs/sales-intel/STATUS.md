# Sales build — status

The single place that says what is done, what is moving, and what is waiting.
Updated whenever something lands. If this file disagrees with a memory or a
summary, this file wins.

Last updated: 2026-09-01, after Phase 1 shipped and the Phase 2 audit began.

---

## Phase 1 — Sales portal · SHIPPED

Pushed to `main`. `check:all` exit 0 (257 checks, 19,377 assertions), build
exit 0, schema pushed and verified, row counts unchanged.

| Thing | State |
|---|---|
| Demo accounts cannot spend real money (6 paths) | done |
| Demo accounts cannot email real people | done |
| `PlatformAdminRole` can store `admin` | done |
| Solo contractors can finish onboarding | done |
| Subscription refunds and chargebacks are visible | done |
| Dispute evidence assembled from real usage | done |
| Sales rep identity, invite, `/sales` gate | done |
| Attribution capture, locking, touches, audit | done |
| Commission ledger + milestones 1, 2, 3 | done |
| 60-day retention sweep (cron, 09:20 UTC) | done |
| Rep outreach — send from own mailbox, replies filed | done |

### Phase 1 — still open

- **Blocks reps sending mail** (owner action): verify the reps' root mail
  domain in Resend; set `SALES_MAILING_ADDRESS`; set
  `SALES_REPLY_ADDRESSING` to `plus` or `plain` (no default on purpose — a
  wrong choice bounces replies to the prospect).
- **Does not block sending**: `SALES_INBOUND_SECRET` plus the mailbox
  forwarding rule; without it the portal honestly says replies are not being
  filed.
- **SMS has the same demo hole email had.** `lib/sms/twilioClient.js` has no
  demo guard — referral invite will text a real prospect from a demo account
  today. Named, not built.
- Outreach screens are English-only while the rest of the portal is translated.
- Weekly payout batches: the model exists, the closer does not.
- Rep dashboards, leaderboard, CAC, cohorts, fraud review — Phase 5 of the
  original plan, not started.

---

## Phase 2 — Sales intelligence, prospecting, telephony, copilot

Specified 2026-09-01. The spec's own §64 says to audit before writing code, so
that is what is happening.

**Now:** three read-only audits running — telephony reuse, jobs/AI/data model,
and compliance plus external API terms. Nothing is being built.

**Next:** the 18-section plan §64 asks for, then phasing.

### The four things that could stop this, in order

1. **Google Places terms and caching.** §19–20 want 1,000 businesses
   discovered, stored and cached as a prospecting database. Google has
   historically restricted caching of Places content, and prohibited using it
   to build a competing database. If that still holds, the discovery source
   has to change, not the caching strategy. Being researched.
2. **Telemarketing law.** Outbound cold calling into Canada and the US needs
   DNC handling, calling-hour rules and caller identification sorted BEFORE
   the first call, not in a compliance pass at the end. Whether B2B is exempt
   is exactly the question being researched.
3. **Twilio's own policy** on area-code-matched caller ID and on a rep placing
   calls from outside North America.
4. **Cost.** Discovery, crawling and AI analysis per prospect, then telephony
   plus transcription plus AI per call. Needs a real number before it runs at
   1,000-prospect scale.

### Decisions already taken (Phase 2)

- Audit before code, per the spec's own instruction.
- Nothing built until the plan is presented.

### Decisions waiting on the owner (Phase 2)

- Whether live in-call AI copilot is in the first build, or post-call only.
- Phase order — the spec puts telephony sixth; see the plan when it lands.

---

## Decisions taken, Phase 1 (do not re-litigate)

- **Milestone 1 is Stripe Connect activation alone.** Onboarding completeness
  is never part of it: a one-person shop can never complete onboarding, so
  that gate would pay nothing on an entire class of real sale.
- **The referral programme and the sales programme have different fraud
  postures on purpose.** Referrals pay on first payment because throwaway
  addresses are free; sales pays at activation because Stripe verifies a
  government ID and a bank account. Do not harmonise them.
- **Annual subscribers qualify for the 60-day milestone.** They have made no
  second payment, but they are still paying customers. Their larger refund
  exposure is a price to set, not a branch to write.
- **A sales rep is a third identity**, not a Member and not a PlatformAdmin.
  Both credentials refuse the other's token.
- **A second rep's touch is recorded, never refused.** A contractor's signup
  must never depend on our commission bookkeeping.
- **A rep cannot attribute a company to themselves.** Manual attribution is
  superadmin-only today.

## Decisions waiting on the owner (Phase 1)

1. **Can a rep claim a company themselves?** Today every phone-closed deal
   needs a superadmin. Recommendation: rep submits a claim, superadmin
   approves — keeps the property that nobody writes their own ledger.
2. Two reps, one company — split, first touch, or last touch?
3. Flat commission across all four plan tiers?
4. Does a departed rep keep earning the 60-day milestone?
5. How much of a contractor's data may a rep see? (Default today: name,
   signup date, milestone states, subscription status. Nothing else.)
