# Prompt for Claude in Chrome — setting up sales-rep payouts on Upwork

Paste everything below the line into Claude in Chrome. It has no memory of
this project, so the brief is self-contained. It is written to make Claude
stop before anything that costs money or creates a binding contract.

---

I need help setting up and running payouts to my sales reps on Upwork. You
have no prior context, so here is everything you need.

## Who I am and what the reps do

I run FieldQuo, a software company. Its customers are field-service
contractors — painters, plumbers, electricians, roofers, landscapers — who pay
a monthly or annual subscription. My sales reps are contractors hired through
Upwork. Their job is to sign those businesses up. They are not employees, they
do not work fixed hours, and they are paid only for results.

## How the commission works — this is the part that shapes everything

A rep earns **$125 per successful sale, but not at once**. It arrives in three
stages, triggered by things the customer does, spread over about two months:

| Stage | Amount | Triggered when |
|---|---|---|
| Activation | **$20** | the business finishes payment setup |
| First billing cycle | **$40** | their first real subscription payment succeeds |
| Retention | **$65** | they are still subscribed 60 days after signing up |

Three consequences that matter for how we set this up:

1. **I cannot know in advance how much a rep will earn**, or when. It depends
   entirely on how their customers behave.
2. **The retention payment lands about 60 days after the sale**, so one sale
   pays out across two calendar months.
3. **A customer can refund or charge back after I have already paid a rep.**
   Upwork has no way to claw a payment back.

My own system already tracks all of this. It calculates what each rep has
earned and groups it into **weekly batches** — one total per rep per week. So
what I need from Upwork is a way to pay an arbitrary, varying amount to each
rep, once a week.

## What I want you to help me do

**First, help me confirm the right mechanism.** My understanding is:

- **Hourly contracts** are wrong — I am paying for outcomes, not time.
- **Fixed-price milestones** are wrong — Upwork requires each milestone to be
  funded into escrow before the work starts, and I cannot pre-fund $125 per
  hypothetical sale across every rep, nor define a "retention" milestone for a
  customer who does not exist yet.
- **Bonuses on an active contract** look right — I believe they can be sent at
  any time, for any amount, with a note, without escrow.

Please check Upwork's current documentation and confirm whether that is
accurate, and tell me if there is a better mechanism I have missed. **Do not
assume my summary is correct — verify it.**

**Then, once we agree on the approach**, walk me through:

1. Setting up **one contract per rep** in whatever form we settle on, and what
   the contract terms should say about how they get paid, so it matches the
   three-stage reality rather than implying a fixed fee.
2. **Sending a bonus payment**, step by step, including where the note or
   reference goes — I need to record an Upwork payment reference against my
   own weekly batch so the two systems can be reconciled.
3. **Who pays Upwork's fee and how much it is.** I need to know what a rep
   actually receives when I send $125, so I can either gross it up or state it
   plainly in their terms. A rep should never discover the deduction on their
   first payout.
4. Whether Upwork offers **any way to reverse or offset a payment** after it
   has been released, for the refund case above. If it does not, say so
   plainly — I will handle it by netting against the following week.
5. Whether there is a **bulk or scheduled** way to send weekly bonuses to
   several reps at once, or whether it is one at a time.

## How I want you to work

- **Read and report before you act.** Navigate, find the relevant screens, and
  tell me what you see and what the options are.
- **Stop before anything that spends money, creates a contract, or sends an
  offer.** Show me exactly what you are about to do, with the amounts and the
  recipient, and wait for me to say go.
- **Never enter payment details, bank information, or my password.** If a step
  needs those, tell me and I will do that part myself.
- If Upwork's interface differs from what you expected, say so rather than
  guessing at the nearest similar button.
- If something I have described about my own commission structure does not fit
  how Upwork works, tell me. I would rather change the plan than force it.

Start by looking at my Upwork account and telling me what contract types and
payment options I actually have available, and whether the bonus mechanism
works the way I have described.
