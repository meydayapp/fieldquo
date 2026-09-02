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

**Now:** two read-only audits still running — jobs/AI/data model, and
compliance plus external API terms. Nothing is being built.

### Telephony audit — DONE (`AUDIT-telephony.md`)

**Two vendors are wired and neither carries a human's voice.** Retell places
outbound calls but both legs are the provider's — there is no human leg and no
browser token anywhere. Twilio is SMS and a number catalogue only: no Voice
SDK, no `calls.create`, no access tokens, and the only TwiML in the repo is an
empty document. So §23's browser calling is genuinely new, not an extension.

**The best reuse finding:** `PlatformVoiceCall` already exists, and exists
*precisely because FieldQuo must not become a Company row*. That is the
pattern the sales build extends rather than inventing a parallel one.

**The hard constraint:** sales numbers must NOT live in `VoicePhoneNumber`.
Its `companyId` is a required FK and `heldNumber()` enforces one-per-company —
a pool is structurally the thing that code treats as a bug. Putting them there
would make the rent cron bill a non-company, make `derivedSpend` count sales
minutes as tenant burn, and report a false billing leak per number.

**A product risk worth deciding early:** reps would draw on the SHARED Retell
concurrency pool that tenants' receptionists depend on. Slots beyond the
included allowance are a paid fixed cost (`platformEconomics.js`), so rep
calling either starves customer calls or increases that bill. Needs a decision
before reps dial at volume.

### Live bugs found in passing (not Phase 2 — today)

1. `FIELDQUO_SALES_NUMBER` already reports as an unheld billing leak on the
   platform console.
2. `recordSalesCall` bypasses `transcriptFrom()`, so sales transcripts silently
   lose tool calls.
3. `reconcileCalls` maps from `voicePhoneNumber` only, so a dropped webhook on
   a sales call is **lost permanently** — no retry, no recovery path.

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

   **Entity facts, confirmed by the owner 2026-09-01 — these change the
   position and must not be re-guessed:**

   - **The Ukrainian reps are FieldQuo EMPLOYEES.** Not an agency, not
     contractors. So FieldQuo calls on its OWN behalf — first-party. Under
     Canada's Unsolicited Telecommunications Rules the "telemarketer" and the
     "client" are the same entity here, which is a different obligation set
     from an agency dialling for a client.
   - **FieldQuo is a registered entity in BOTH Canada and the USA.**

   What that buys, structurally:

   - **Standing to subscribe to both DNC lists.** A foreign entity with no
     local registration cannot straightforwardly do this. FieldQuo can.
   - **Local numbers are genuinely local.** Carriers commonly require an
     in-country business address to sell local numbers, Canada especially. A
     Canadian-registered FieldQuo holding a 613 number and calling Ottawa
     from it is presenting its own real number in its own country. That was
     always the design — §25 already forbids spoofing — but it is now local
     presence in fact, not a workaround.
   - **One accountable entity.** One registration, one DNC subscription, one
     set of scripts, and employee training that is actually enforceable.

   What it does NOT change: the destination country's rules apply to a call
   placed to a number in that country regardless of where the rep is sitting.
   The rep's location is a carrier-policy and call-quality question, not a
   legal exemption. Being confirmed with sources rather than assumed.

   Adjacent, and NOT a build problem: employing staff in Ukraine through a
   Canadian/US entity raises employer-of-record and permanent-establishment
   questions. Worth an accountant's confirmation; nothing here depends on it.
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
