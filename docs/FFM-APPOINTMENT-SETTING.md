# FFM's appointment-setting process — the source material

Forward Media Marketing (FMM/FFM) is the marketing agency that sells leads to
TrueFinish Cabinets, FieldQuo's first real customer. Their Modules 4.1 and 4.2
are the process those leads are *supposed* to be worked by. The owner handed
them over on 2026-11-03.

This file exists because the lead-chase features in FieldQuo were designed
before anyone here had read them, and the defaults we shipped do not match the
cadence below. Anybody touching `lib/followUps/`, `lib/sms/followUpText.js` or
the lead board should read this first and know what the customer is being
coached to do.

Transcribed from screenshots of the original Google Docs. **It is a record of
what the agency says, not a FieldQuo decision.** Nothing here is automatically
right for every tenant — see "What we should and should not copy" at the end.

---

## Module 4.1 — Maximize Your Sales With More Appointments

### The metric

**Set rate = (appointments ÷ leads) × 100**, measured monthly.

It is driven by two things:

1. **Lead source / lead intent.** Word-of-mouth converts far better than a
   Facebook lead, which is a cold audience that had never heard of you.
2. **Your follow-up sequence.** Leads that are not contacted, or that get only
   automations, set worse than a company with a dedicated person calling in 60
   seconds or less.

### Their standards

- Company-wide set rate across all channels: **at least 50%**.
- Any single channel: **no less than 40%** — "particularly important if it's a
  paid channel such as Meta Ads".
- Measured over a 30-day or longer interval. Below those numbers, the
  follow-up process is the thing to fix.

### Why it matters (their arithmetic)

| | Scenario A | Scenario B |
|---|---|---|
| Leads / month | 100 | 100 |
| Set rate | 20% | 40% |
| Appointments | 20 | 40 |
| Close rate | 30% | 30% |
| Closes | 6 | 12 |
| Average job | $5,000 | $5,000 |
| **Revenue** | **$30,000** | **$60,000** |

Doubling the set rate doubles revenue with no extra ad spend.

### Old workflow (the drop-off)

- You get a lead.
- You call it and have SMS/email automations — or you don't call and rely on
  automations — or there are no automations and it's manual. You call for 1–2
  days, and with no response you give up and call it a "dead" lead.
- You set 20–30% of leads.
- You show up late, go home to write the proposal, send it and pray. You close
  20–30%. No closing on the spot, no follow-up on pending proposals beyond
  default flows.

### New workflow (FMM's Set & Sell System)

1. You get a lead.
2. An **appointment setter calls all leads 2–3×/day** (+ double dial &
   voicemail) using the S&S script, sends SMS/email attempts, **and** sends
   personalized follow-ups.
3. You set **40–60%** of leads.
4. You send a **pre-quote video** to set expectations about the quote and
   ensure **both homeowners are present**.
5. You quote the job and **give pricing on the spot**.
6. You sell 40–50% of jobs.
7. You **knock on every neighbour's door** around the lead. No answer = door
   hanger. Lower CPL/CPA.
8. You produce the job.
9. You put a **lawn sign** outside the home (start of job, or sooner).
10. You get a **Google review and 3 referrals** from the lead.
11. You get a **photo of the client holding a "100% satisfied" sign** for
    socials.
12. Repeat for every lead, plus **email blasts to the lead list at least once a
    month**, leveraging holidays and special occasions.
13. You **call past clients** to keep relationships, and the jobs that did not
    accept a proposal initially.

---

## Module 4.2 — Appointment Setting Process / Flowchart

### Pro-tips

- Run a **Speed-to-Lead test** to baseline the current process. (FFM sells one
  for $97.)
- **Automate the email and text outreach in your CRM to reduce workload — but
  leverage personalized texts as well, with a dedicated appointment setter.**
- **Use a phone number with a local area code** to increase pickup rates.

### The Double-Dial Method

- If you reach voicemail on the first call, **hang up and call back
  immediately** a second time. Somebody who doesn't recognise a number may not
  answer the first time, but the same number calling straight back gets picked
  up.
- **Leave a voicemail if they don't answer on the second call.**

### FMM's 5 Follow-Up Commandments

1. **Aim to call prospects within 60 seconds.** Speed-to-lead is crucial —
   they cite Harvard as 391% higher odds of booking. Their chart: 1 min = 391%,
   2 min = 160%, 3 min = 98%, 30 min = 62%, 1 hr = 36%.
2. **Always double-dial.** Call, and on no answer call a second time, leave
   voicemail **and send a text, always**.
3. **If they don't answer the first time, double-dial once more later the same
   day.** Aggressive at the start, then spaced consistency on a longer nurture.
4. **Appointment setting is a revenue-generating position.** Treat it like a
   sales role. Keep going until you get a NO.
5. **Leverage weekends.** Calling only 8am–4pm M–F means calling people when
   they're busiest. Weekend pickup rates are much higher.

### Daily tasks, in order

1. Call the newest leads that came in overnight / early morning **first**.
2. Follow up with leads that haven't picked up.
3. Call back, in the afternoon, the leads that didn't pick up in the morning.
4. Prioritise new leads arriving during the day over older ones.

### Notes on the scripts

- Variables are in `[brackets]`, to be replaced per company.
- The objective of every touch point is **to get the prospect on the phone**.
  Once on the phone, the Qualifying Call Script (next module — not yet
  supplied) takes over.
- **Even if they book through an online booking link, you still call them to
  clarify, qualify and confirm the appointment.**

---

## The 30-Day Customer Journey

### Day 0 — New Lead

**Phone.** Call within 60 seconds of the lead arriving, or first thing in the
morning for overnight leads. No answer → hang up and double-dial back right
away. Call 2–3× during the first day, double-dialling each time. The first day
is the most important.

**Voicemail**

> Hi [First Name], this is [Your Name] with [Company Name]. We just received
> your request for a free quote for your [XYZ Service] Project!
>
> I have [Day/Time] available to stop by and discuss your project, please give
> me a call, or send me a text at [Phone Number] to confirm this appointment.
>
> I'll also follow-up with a link to my calendar if you'd like to find a day
> and time that aligns with your schedule. I look forward to talking to you
> soon!

**Manual SMS #1**

> Hi [First Name]! I just figured it would be easier to give you a call than
> texting back and forth. This is [Your Name] with [Company Name]!
>
> I saw you just requested a free quote with us and I would love to hear more
> about your project and discuss the next steps in order to get everything
> scheduled for you!
>
> Give me a quick call back when you get a chance at [Phone Number], or
> schedule a day/time here: [Insert appointment booking link]
>
> I look forward to talking to you soon! -[Your Name]

**Manual SMS #2 — 1 hour later**

> Hi [First Name]! Does Wednesday work for you?

**Email** — Subject: `Re: Your Quote Request`

> Hi [First Name]!
>
> This is [Your Name] with [Company Name]! I just received your quote request
> and would like to schedule a date & time to discuss your project.
>
> Please take a moment to grab a spot on my calendar here: [Link to Estimate
> Calendar]
>
> Do not hesitate to call/text me at [Phone Number] should you have any
> questions in the meantime.
>
> Talk to you soon,
> [Your Name] / [Company Name - Link to Website] / [Phone Number]

They also recommend having an email signature.

### Day 1 — Friendly Follow-Up

**Phone.** Start of day and afternoon, Double-Dial Method.

**Voicemail**

> Hi [First Name], this is [Your Name] with [Company Name]. I still have [Day
> of the week you provide estimates] available to provide you with your free
> quote. Please call or text [Phone Number] to confirm this appointment. You
> can also grab a spot on my calendar using the link I texted & emailed over to
> you yesterday. Talk soon!

**SMS**

> Hey [First Name]! I still have [Day of the week you provide quotes]
> available. What time works best for you? -[Your Name]

**Email** — Subject: `[Day of the week you provide estimates]?`

> Hi [First Name]!
>
> Are you available on [Day of the week you provide estimates]? I'd love to
> discuss your project and provide you with a free quote! :)
>
> If you'd like to ask some questions before scheduling, please do not hesitate
> to call/text me at [Phone Number].
>
> I look forward to speaking with you soon!
> [Your Name] / [Company Name - Link to Website] / [Phone Number]

### Day 2 — (opening steps not captured)

The screenshots jump from Day 1 to the **end** of Day 2. The Day 2 phone,
voicemail, SMS #1 and email are **missing from this transcription** — ask the
owner for that page rather than inventing them.

**SMS #2 — End of the day.** Text them a video of you or your sales rep
introducing yourself. Putting a face to the name is a personalized approach and
"helps tremendously with conversion rates".

**Personalized video script** (simple selfie-style video):

> Hi [First Name], my name is [Your Name] with [Company Name], I just wanted to
> send a quick video to you to introduce myself and see if [insert day of the
> week] works for you to set up your 100% free quote so we can help you with
> that [insert project] project! Have a great day & I look forward to meeting
> you!

The point is to elicit *some* response — either "not interested" or a booking.

### Day 3 — Social Proof

**Phone.** Start of day and afternoon, Double-Dial.

**Voicemail**

> [First Name]! This is [Your Name] with [Company Name]. I'll be sending over
> some before/after project photos for you to review today. If you'd like to
> talk today, I'm free until [Time]. You can reach me directly at this number,
> [Phone Number]. I look forward to hearing from you soon!

**SMS**

> [First Name]! Just sending over a few unsolicited [Social proof: before/after
> photos, Google reviews, testimonial videos, etc.] from some of our other
> awesome clients in [XYZ city]!
>
> [Insert link to social proof]
>
> Let me know if you're still interested in completing your [Project Type, i.e.
> interior painting] project! -[Your Name]

**Email** — Subject: `Re: [Social proof: before/after photos, Google reviews, client testimonial videos, etc.]`

> Hi [First Name]!
>
> I meant to send these over earlier – Here are a few [social proof] of similar
> projects we completed for other [XYZ city/town] homeowners from around your
> area.
>
> Are you still interested in discussing your [Project Type] project?
>
> [Insert link to social proof]
>
> Looking forward to working with you!
> [Your Name] / [Company Name - Link to Website] / [Phone Number]

### Day 4 — Special Offer

**Phone.** Start of day and afternoon, Double-Dial.

**Voicemail**

> Hey [First Name]! This is [Your Name] with [Company Name]. I wanted to
> mention that we just started a promo, and it's running this month only, where
> we're now offering [Offer Details — i.e. 10% off at time of booking, free
> paint upgrade, etc.] for clients that schedule their painting project with us
> before [end of week/month]. So if you're still interested and want to take me
> up on this limited time offer, please give me a call back at [Phone Number].
> I'll be available until [Time] today. Talk soon!

**SMS**

> Following up to my last voicemail. I wanted to mention that we just started a
> promo, and it's running this month only, where we're now offering [Offer
> Details] for clients that schedule their painting project with us before [end
> of week/month]. Please let me know if you're still interested in that free
> quote and I'd be happy to tell you more about it during our quote!
> -[Your Name]

**Email** — Subject: `I forgot to mention…`

> Hi [First Name]!
>
> We have a promo running through the end of this month for [Evergreen Offer
> Details]! I would be happy to apply this to your quote 👀
>
> Here's a link to my calendar: [Link to Estimate Calendar]
>
> If you'd like to discuss this project before scheduling, please do not
> hesitate to call/text me at [Phone Number].
>
> I look forward to hearing from you soon!
>
> PS: If you're no longer interested, just let me know and you will not hear
> from me again!
>
> [Your Name] / [Company Name - Link to Website] / [Phone Number]

### Day 5 — Pablo Meme

**Phone.** Start of day and afternoon, Double-Dial.

**Voicemail**

> Hey [First Name]! This is [Your Name] with [Company Name]. Please give me a
> call if there are any questions I can answer regarding the quote request you
> submitted the other day. I'm free until [Time] today. Talk soon!

**SMS.** Send the Pablo Escobar "waiting" meme with just:

> [First Name]?

Their note: "This is more of a comedic approach and you'll be surprised by the
positive response it elicits. It's so simple but it's unique and it'll elicit a
positive response without being too pushy. We had everyone at PaintCon use it,
and I promise you that it works."

### Day 6 — Urgency

**Phone.** Once today; no answer → hang up and Double-Dial.

**Voicemail**

> Hi [First Name]! This is [Your Name] with [Company Name]. Our schedule is
> beginning to fill up, but I did reserve some time to speak with you directly.
> If you'd like to give me a call back at [Phone Number], I'll be available
> until [Time] today. I look forward to hearing from you soon!

**SMS**

> [First Name]! Our schedule is filling up, and I only have a few spots left
> this week.
>
> Is there a good time today or tomorrow to jump on a quick call to discuss
> your [Project type] project?
>
> -[Your Name] from [Company Name]

**Email** — Subject: `[First Name] - I saved time for YOU!`

> Hey [First Name], our schedule is really starting to fill up, but I did
> reserve some time on the schedule to speak with you directly.
>
> Is there a good time today or tomorrow for a quick call to discuss your
> project?
>
> If you'd rather find a time that works for you, here's a link to my calendar
> [Link to Estimate Calendar]
>
> Talk soon,
> [Your Name] / [Company Name - Link to Website] / [Phone Number]

### Day 7 — Interested?

**Phone.** Once today; no answer → hang up and Double-Dial.

**Voicemail**

> Hi [First Name]! This is [Your Name] with [Company Name]. If you're still
> interested in discussing your [Project Type] project, I'm free until [Time]
> today. You can reach me directly at [Phone Number]. I look forward to hearing
> from you soon!

**SMS**

> Are you still interested? Just wondering since I haven't heard back from you.
> -[Your Name]

**Email** — Subject: `Still interested?`

> Hi [First Name], are you still interested? Just wondering since I haven't
> heard back from you
>
> [Your Name] / [Company Name - Link to Website] / [Phone Number]

### Days 8–30 — Consistent Daily Outreach

Spaced consistency — a bigger gap between each touch point. Their example:

| Day | Touches |
|---|---|
| 8 | 1 text, 1 call + double dial, 1 email |
| 10 | 1 text, 1 call + double dial, 1 email |
| 14 | 1 text, 1 call + double dial, 1 email |
| 20 | 1 text, 1 call + double dial, 1 email |
| 25 | 1 text, 1 call + double dial, 1 email |
| 30 | 1 text, 1 call + double dial, 1 email |

General script guidance:

- Keep outreach general, but consistent.
- Have a one-sided conversation by asking questions or providing
  value/information.
- Use your CRM to handle all of the long-term SMS + email outreach.
- You are targeting a scheduled quote, or the phrase "I'm not interested
  anymore." **Repeat this process until you get one.**

### Day 31+ — Cold Outreach

Time-block **one day a month** to call all leads acquired over the last **90
days**, oldest to newest. Expect a **10–20% set rate** from the existing
database.

Their anecdote: a client's office admin had written leads off as dead after two
weeks; calling 20 leads that were six months old set 3 appointments (15%).

---

## What we should and should not copy

Read this next to `AGENTS.md`. The agency's advice is aimed at one painting
contractor in one country; FieldQuo is multi-tenant and ships to eight SMS
languages and several jurisdictions.

**Directly useful, and already partly built:**

- Speed to the *contractor* — a new lead has to reach a human's phone within
  seconds, not sit in a bell. (`lead.created` → staff text.)
- Logging *which* attempt was made — call, double-dial, voicemail, text, email.
  `LeadContactAttempt` exists for exactly this.
- The 2–3×/day reminder on the dashboard.
- A booking link in every touch, which is what the self-booking page is for.
- The pre-quote video (`Company.preQuoteVideoUrl`).

**Two different videos — do not conflate them.** Module 4.1's pre-quote video
goes out *after* the appointment is set, to manage expectations and get both
homeowners present; it is a company-level asset. Module 4.2's Day 2 video is a
*per-rep selfie intro* sent *before* anything is booked, to get a reply. One
company URL cannot be both.

**Needs a product decision before copying:**

- **The cadence itself.** We seed three lead chases at day 1, 3 and 7, all
  email, all OFF by default (`lib/followUps/defaults.js`). FFM wants a touch
  every day for a week, then 8/10/14/20/25/30, then monthly. The gap is
  deliberate on our side — see the comment in that file about emailing a
  stranger under the contractor's own From address — but it is a gap, and a
  company that wants FFM's cadence currently has to build it by hand.
- **Daily texting to a stranger is regulated**, and differently per country.
  Whatever we seed has to be defensible in every market we sell in, not just
  Ontario.
- **The Pablo meme.** Funny, effective, and not something FieldQuo ships as a
  built-in default under a contractor's brand.
- **Evergreen "promo running this month only"** language is a standing
  discount dressed as urgency. Fine for a company to write themselves;
  not something we put in anyone's mouth by default.

**Not built at all:** neighbour door-knocking and door hangers, lawn signs, the
"100% satisfied" photo to socials, the monthly email blast to the whole lead
list, and the structured call-back of past clients and declined proposals.

## Still missing from this transcription

- Module 4.2's **Day 2 opening** (phone, voicemail, SMS #1, email).
- The **Qualifying Call Script**, which Module 4.2 says is in the next module.
- The **S&S script** referenced in Module 4.1.
