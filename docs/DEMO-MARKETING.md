# FieldQuo demo — Marketing & growth, 15 minutes

Same account, same audience as `docs/DEMO-SCRIPT.md`: one person, one van,
about to hire their first employee, Canadian, not technical, cares whether it
works on a phone in a driveway. Read that document's section 0 first if you
haven't — this is a third 15-minute block from the same family, built around
one problem instead of the whole pipeline.

Their real problem isn't "marketing." They don't run marketing — they have a
lawn sign and word of mouth, and work arrives in lumps: three quotes one week,
nothing the next. They are either too busy to answer the phone or worried
about where next month's job comes from, and both of those are true in the
same month. This block is one sentence: **this makes it so somebody can find
you, ask you for a price, and book you, without you stopping what you're
doing.**

**How to use this document.** Part B is written to be read aloud, live, off a
second screen while you click. Anything in a blockquote is a sentence you can
say word for word. Anything in *[italic brackets]* is a stage direction — what
to click, what to point at, when to switch browser windows — never read those
out loud. If you catch yourself about to say a bracket, that's the signal
you've drifted off-script. Bold headers over each block are timings — they set
the pace, glance at the clock once or twice, don't watch it. Parts A, C and D
are reference material for you, not for the call; they are marked as such.

---

## PART A — Setup checklist, in dependency order (NOT read aloud — do this before the call)

The whole demo hinges on one live-in-front-of-them motion: someone lands on
the painter's own site, asks for a price or books a visit, and it shows up in
the product before you've finished talking. Every step below exists to make
that motion actually happen instead of 404ing mid-sentence.

### 1. The account and the trade
Same as `DEMO-SCRIPT.md` checklist item 1: confirm `demo1` is on the painting
preset at `/platform/demo`. Company name **Northside Painting Co.**, brand
colour `#1E5F8C`, services and rates from `lib/demo/industries.js` (interior
painting $3.25/sqft, exterior siding $4.75/sqft, drywall repair $85/hr).

### 2. Business hours — needed for the booking half of the demo
**Where:** `/app/settings/company`. Same field `DEMO-VOICE.md`'s checklist
item 2 depends on (Mon–Fri 8–5, Sat 9–1, seeded in step 1). The public booking
page reads real availability off this — with no hours on file, there is
nothing to book, and the manual fallback fails with `no_times`. Confirm it's
there; don't set it up live.

### 3. Build and publish a website — THE STEP MOST LIKELY TO BE MISSING
**Where:** `/app/settings/website`.
**Why this needs checking, specifically:** unlike quotes, jobs and clients,
**no demo account ships with a published site.** `lib/demo/seedDemo.js` never
creates a `CompanySite` row — the code comment on `listDemos()` says so in
plain words: *"No demo has a site by default."* If nobody has built one on
`demo1` since its last reset, the second-browser-window beat in Part B opens
to a blank subdomain, not a website. **Check this days ahead, not minutes.**
**What to do if it's missing:** open the builder and click through it once.
`siteFromCompany()` (`lib/site/generateSite.js`) builds a fully real page from
the company's own data with zero AI involved — services, rates' presence (not
the rates themselves), photos, testimonials — so even the plain fallback is
honest, not a mockup. Click **Generate** if you want AI-written prose on top
(it merges onto the real blocks field-by-field; service names still come from
the database, never the model), then click **Publish**.
**How to confirm it actually published — don't trust the platform console's
link for this:** the Builder page's own button is the truth — it reads
"Publish" before and **"Update" after**. `/platform/demo`'s "Website" link, by
contrast, is gated on a company field (`Company.sitePublished`) that this pass
of the code could not find any current write path for — the actual publish
action only ever sets `CompanySite.published`, a different field. That link
may simply never appear even on a genuinely published demo site. **Trust the
Builder page's button state, and open `https://demo1.fieldquo.com` directly**
to confirm it's live, rather than relying on the platform console's link.
**Breaks if skipped:** the whole centerpiece of Part B — landing on the site
in a second window — opens to nothing.

### 4. Self-quote — confirm, don't rebuild
**Where:** `/quote/demo1` (the public form).
**What:** this needs nothing beyond what `DEMO-SCRIPT.md`'s checklist already
sets up — enabled service categories from step 1. `/api/self-quote/[slug]`
never returns a rate under any configuration; it returns the company's name
and logo, the enabled services, and a couple of intake questions per service.
Open the URL once yourself and confirm the painting services show up.
**Breaks if skipped:** nothing breaks, but you'll be improvising the intake
questions live instead of knowing them.

### 5. Instant-quote — do NOT plan to demo this one live
**Where:** `/instant-quote/demo1`, if you want to check it.
**Why it's cut:** instant-quote is a *different* public flow from self-quote —
a separate, per-trade, owner-controlled setting (`lib/estimate/visibility.js`)
that decides whether a homeowner sees an actual price range before or after
they submit. The default, and the cautious one, is "don't show a price at
all," same as self-quote. Nothing in the demo seed configures this for
`demo1`'s painting trades, so its live state is genuinely unknown without
checking the database — it could show nothing usable, or (if someone
previously flipped it) a live number. **Don't rely on it for this call.** If
you're curious, open the URL yourself first; if it shows a price, that's the
owner's own opt-in choice on their own rates, not a leak — worth one sentence
if asked (Part D), not a beat.

### 6. A bookable service with no fee attached
**Where:** `/app/settings/booking` (event types).
**What:** confirm at least one bookable visit type has **no fee** set. A free
booking creates the appointment immediately, live, which is the moment you
want on screen. A paid one only creates a `pending_payment` row until Stripe
confirms — same trap `DEMO-SCRIPT.md` avoids by not running Stripe Connect
onboarding live. If every event type has a fee, either zero one out for the
demo or plan to narrate the pending state instead of showing a completed
booking.

### 7. AI credit balance — shared with the voice line's vision pass
**Where:** `/app/settings/ai-credit`.
**What:** the Marketing Designer's AI image generation draws from the same
wallet `DEMO-SCRIPT.md` checklist item 7 covers — 1,000 credits, granted once
per company, not per call (`grantDemoAiCredit`/`DEMO_AI_CREDIT_CENTS` in
`lib/voice/credits.js`). One image costs **12 credits** (12 cents —
`IMAGE_GENERATION_CENTS` in `lib/ai/imageEconomics.js`). 1,000 credits is
roughly 83 generations, shared with the receptionist's photo "deep read" if
that block has run on this account too. **Check the balance before you dial
in** — if a prior call on this account burned it down near zero, either use a
different demo account or top it up. Running out mid-demo isn't a hard
error — the Generate button just disables itself with the shortfall written
in-line ("this costs $0.12, your balance is $0.03, top up $0.09") — but a
disabled button is still a stall you didn't plan for.

### 8. A marketing campaign to hang a design on
**Where:** `/app/marketing/designer`.
**What:** a `MarketingDesign` always belongs to a `MarketingCampaign` — there's
no such thing as an ad image floating free of one. Create one campaign ahead
of time (a name is all it needs, e.g. "Spring promo") so Part B's design beat
doesn't spend time on campaign setup. Ten seconds either way; do it ahead so
the live beat is all image, not admin.

### 9. Review requests — leave this OFF, don't turn it on for the call
**Where:** `/app/settings/reviews`, for reference only.
**What:** `demo1` ships with `reviewRequestsEnabled: false` on purpose —
`seedDemo.js`'s own comment: *"A demo firing real review requests at seeded
email addresses is how a sandbox ends up in a spam trap."* Leave it that way.
This also isn't something a live click can demo even if it were on: there is
no "send now" button anywhere in the product — review requests go out from an
hourly cron job, at minimum one hour after a job is marked complete
(`lib/reviews/request.js`). You're going to show the settings screen and
explain the rule, not fire an email.

### 10. Referral invite — don't send one live
**Where:** `/app/settings/refer`, for reference only.
**What:** real and working — it sends an actual email or text through Resend
or Twilio. That's exactly why you don't click Send with a real address typed
in front of a prospect who isn't a contractor you're trying to refer. Show the
screen, explain the mechanism, keep your hands off the button.

**What this checklist does NOT include on purpose:** live campaign sends to
real subscriber addresses, and live Stripe Connect or website-domain
onboarding. See Part C for why.

---

## PART B — The script (READ THIS ALOUD)

Shape: small talk, then one continuous motion — open a second browser window
as if you're the homeowner, land on the painter's own site, ask for a price,
watch it land back on the main screen as a real lead before you've finished
the sentence. Everything after that — the design tool, the campaigns, the
review and referral machinery — is real, but gets a fast, honest tour rather
than its own long beat, because the "somebody just found me" moment is the one
this audience actually needed to see.

Total: 15:00. Land on `/app` before you start talking. Have a second browser
tab or a second device ready but not yet open.

### 0:00–1:00 — Open

> Quick question. Right now, how does someone find you — a job that isn't a
> referral from someone you already did work for?

*[Let them answer. Most of the time it's "word of mouth" or "a sign in the
yard." Don't argue with it.]*

> That's normal, and it's also the whole problem. Work shows up in lumps —
> three quotes one week, nothing the next — because there's no second door for
> it to come through. This next part is that second door. Somebody finds you,
> asks you for a price or books you straight into your calendar, and it
> shows up in your account before you've even picked up the phone.

---

### 1:00–2:30 — The site: already built, already yours

*[Open `/app/settings/website`.]*

> This is your website. Not a template with your logo pasted on — it's built
> straight from what you already put into the product. Your services, your
> rates behind the scenes, your photos if you've uploaded any.

*[Point at a couple of blocks in the builder — services, testimonials,
hours.]*

> You didn't type any of this twice. It's the same information that's already
> sitting in your account, laid out as a page.

*[Open the published site in a NEW browser tab or window —
`https://demo1.fieldquo.com` — and bring it forward so it's visible next to
the builder.]*

> And here's the important part. This is what a stranger sees. Your logo,
> your colour, your business name. Not ours. There's nothing on this page
> that says FieldQuo, because the whole point is your customer can't tell
> what software you run — they just see your business.

**[If they ask "so where's the catch":]**
> One honest exception, and I'll say it straight because it's a fair
> question: if you're on the free tier, there's a small "Site by FieldQuo"
> line in the footer, right down here — that's it, one line, down at the
> bottom. The second you're a paying customer, that line comes off. We don't
> put our name on a page you're paying us not to.

---

### 2:30–6:30 — Somebody asks for a price, and it lands as a lead

*[Stay on the second tab — the published site, as the stranger. Find the
"Get a quote" or contact form on the site and open it.]*

> Now I'm going to be your customer for a second. Say I'm someone who just
> found this site — maybe from that lawn sign, maybe from a Google search —
> and I want a price on painting my house.

*[Fill in the form live: a real-sounding name, address, pick exterior
painting, answer whatever intake questions the form asks — square footage,
number of storeys, timeline.]*

> Watch what this form does NOT ask me for — it never asks how much I'm
> willing to spend, and it's never going to tell me a number either. This form
> physically cannot quote a price. It only collects what the job is.

*[Keep talking while typing — this is dead air otherwise:]*

> And that's not a missing feature, that's on purpose. The second a price
> shows up on a public page, every competitor in town can look at it too.
> Your rate card stays yours. This just asks what the job is and gets your
> customer's name and number in front of you.

*[Submit the form.]*

> There — submitted. Nothing more happens on that screen except a "thanks,
> we'll be in touch."

*[Flip back to the FIRST tab — the back office. Open `/app/leads`.]*

> Now watch this side. I didn't refresh anything, I didn't click anything
> over here.

*[Point at the new lead at (or near) the top of the list.]*

> That's the person I just was, thirty seconds ago, showing up right here.
> Scored — see that badge — hot, warm or cold, based on what they actually
> told you. Click into it —

*[Click into the lead.]*

> — and it tells you WHY it scored that way. Not a black box. If it says hot,
> you'll know it's because of something they actually said, not a guess.

**If they interrupt here — "does this actually go to email, or is this just
this screen":**
Say: "The lead sits here the second it lands — that's not delayed. You'd
also want a way to hear about it faster than checking this screen, which is
what the 'Needs You' panel on your dashboard and your phone are for — same
idea as the receptionist, different door." Then continue.

---

### 6:30–8:00 — Or they just book you, straight onto your calendar

*[Back on the second tab — the published site or `demo1.fieldquo.com/book`.
Open the booking page.]*

> Same site, different door. Some people don't want to describe a job, they
> just want a time. This is that.

*[Pick a service, pick a real available time slot, fill in name/email/phone,
submit.]*

> This is checking your actual calendar, by the way — not a fake slot picker.
> If you were busy that hour, it wouldn't have offered it.

*[Flip back to the back office — `/app/appointments` or the dashboard.]*

> And notice this one didn't land in your leads list — it went straight onto
> your schedule, because there's nothing left to qualify. They picked a time,
> you have a time. Different kind of "showed up," same idea: you didn't have
> to be the one who typed it in.

---

### 8:00–9:00 — The leads board itself, for a beat

*[Stay on `/app/leads`, zoom out to the full list.]*

> This is the board those leads land on, and it's not just the two ways I
> just showed you. Phone calls the receptionist takes end up here too, if
> that's a block you've seen. A missed call, a form, a booking that fell
> through — one board, sorted hottest first, so you're not digging through an
> inbox to find the one that actually matters today.

*[Point at the sort toggle if visible — hottest vs. newest.]*

> That's real triage. You didn't have that on a spreadsheet.

---

### 9:00–11:30 — One ad, five sizes, and what it actually costs

*[Open `/app/marketing/designer`.]*

> This part's different — this isn't about someone finding you on their own,
> this is for when you want to go find them. Say you want to run an ad.

*[Open the campaign set up ahead of time, or create one live — a name is
enough. Open its design.]*

> This is a real design tool — drag things around, drop in your logo, your
> colour's already there because it knows your brand.

*[Point at the ratio switcher — the five sizes.]*

> And the same design comes out in five different shapes — square for
> Instagram, tall for Instagram and TikTok stories, wide for Facebook, a
> YouTube thumbnail size. You build it once, it exports for wherever you're
> actually going to post it.

*[Open the AI image panel. Type a short, plain prompt — e.g. "a freshly
painted living room, bright, welcoming."]*

> And if you don't have a photo you love yet, you can generate one. Type
> roughly what you want —

*[Click generate. Keep talking while it processes — this is dead air
otherwise:]*

> — and this isn't free, and I want to be straight with you about that
> rather than pretend it is. Every image like this costs about twelve cents
> of AI credit. You get a real balance in your account, you can see exactly
> what's left and top it up, and if you're ever out, the button just tells
> you that plainly and disables itself — it won't quietly bill you or fail
> halfway through.

*[Once it generates, drop it onto the canvas.]*

> There it is — dropped straight onto the design, all five sizes update with
> it.

**If they interrupt here — "is this the website builder again":**
Say: "No — different tool, different job. That's your one page people land
on. This is one-off ad art for when you want to go put yourself in front of
someone." Then continue.

---

### 11:30–13:30 — Campaigns, reviews and referrals — real, on purpose not live

*[Open `/app/marketing`, the campaigns list.]*

> This is where you'd send something to a list — past clients, people who
> asked for a quote and went quiet, whoever you've built up. I'm not going to
> actually hit send on one right now, because that would email real people,
> but this is a real send, not a button that just changes a status — an
> actual email goes out through here.

*[Open `/app/settings/reviews`.]*

> This one's simpler than it looks. Once a job's marked done, and you've
> turned this on, it waits a day — you pick how long — and asks that
> customer for a Google review, or wherever you send people. It's not
> instant on purpose. "Please review us" thirty seconds after the van pulls
> away reads as a robot. A day later reads like you actually meant it.

*[Open `/app/settings/refer`.]*

> And this last one isn't about your customers at all — it's about you
> talking to another contractor. You send them a link, they sign up, you
> both get a free month. That's it — not your client referring their
> neighbour, you referring another business owner you know.

---

### 13:30–14:30 — Say it plainly

> So here's the actual shape of this whole block. Somebody finds your site —
> your name on it, not ours, paying customers don't even get the one small
> footer line. They ask you for a price and it never sees your rate card,
> just what the job is. It lands as a lead, scored, with a reason, sitting
> right there whether you're on a ladder or asleep. Or they just book a time
> straight onto your calendar. And when you want to go looking for work
> instead of waiting for it, there's a real design tool and a real campaign
> sender sitting in the same account — not a separate piece of software you
> have to log into.

---

### 14:30–15:00 — Close

> That's the second door. You don't have to build it, chase it, or remember
> to check it — it's just there, doing the waiting for you.

> What part of that would actually get you a job you wouldn't have gotten
> otherwise?

*[Stop talking after asking. Let them answer.]*

---

**Recovery, if something breaks mid-demo:** Same rule as `DEMO-SCRIPT.md` —
don't troubleshoot live. Say "that's a display hiccup on the demo account, not
your business," move to the next beat, come back only if time allows. If the
second-tab site 404s because it was never published, don't improvise — say
"let me pull that up properly for you after the call" and go straight to the
self-quote form's own URL (`/quote/demo1`) instead, which needs no published
site at all.

**Total: 1:00 + 1:30 + 4:00 + 1:30 + 1:00 + 2:30 + 2:00 + 1:00 + 0:30 = 15:00.**

---

## PART C — What cannot be demoed live, and why (reference — NOT read aloud)

### No demo account has a published website by default
Covered in Part A item 3, but worth having the mechanism in your own words if
pushed: `lib/demo/seedDemo.js` builds quotes, jobs, clients and invoices on
every reset, but never touches `CompanySite`. Someone has to build and publish
one by hand, once, and it survives resets (a reset re-dresses services and
sample data; it does not delete the site). Check it days ahead, not minutes.

### The platform console's "Website" link may be unreliable even when a site is genuinely live
`/platform/demo` decides whether to show a "Website" link based on
`Company.sitePublished`. This pass of the codebase could not find any current
write path that sets that field to `true` — the real publish action
(`app/app/settings/website/Builder.js`) only ever writes `CompanySite.published`,
a different field that actually gates the public page. This looks like it may
be a live instance of the exact "wrote a column nothing read" bug class
AGENTS.md warns about, just inverted (a column read, that nothing current
writes) — **not confirmed against a running database**, only against static
code, so don't state it as fact to a prospect. Practically: don't trust that
link's presence or absence. Check the Builder page's own button state
("Publish" vs. "Update"), and open the subdomain URL directly.

### Instant-quote's live state on this account is unknown
Covered in Part A item 5. Whether `demo1`'s painting trades have
`InstantQuoteConfig` rows at all, and if so what `estimateVisibility` they're
set to, is a live-database fact this pass could not check. It is a genuinely
different, opt-in feature from self-quote (`lib/estimate/visibility.js`) —
don't conflate the two if asked, and don't demo it without checking first.

### Campaign sends, review requests and referral invites are real, and that's exactly why they're not clicked live
All three genuinely send through Resend or Twilio to whatever address is on
the row — a `MarketingCampaign` send (`app/api/marketing/campaigns/[id]/send/route.js`)
hits every subscribed `MarketingSubscriber`, a referral invite
(`app/api/settings/referral/invite/route.js`) emails or texts whatever contact
you type in, and even if review requests were switched on, they'd fire against
the seeded fixture clients' addresses — which is precisely why `demo1` ships
with `reviewRequestsEnabled: false`. None of these are staged or fake; that's
the reason none of them get a live click in front of a prospect.

### The Marketing Designer's AI credit is shared, and it is not the voice line's dollars
One pool backs image generation here and the receptionist's photo "deep read"
(`lib/ai/imageEconomics.js`) — the same shared-wallet design `DEMO-SCRIPT.md`
and `DEMO-VOICE.md` describe. It is not refilled automatically between calls
on the same demo account. Check the balance ahead of time (Part A item 7); if
another block's demo burned it down, either top it up or use a different demo
account for this block.

### Funnels exist and are cut from this 15 minutes on purpose
A quiz-style, tap-through public flow (`/f/[companySlug]/[funnelSlug]`) that
also produces a scored lead, same pipeline as self-quote. It's a real, working
third door — genuinely worth building for a contractor running paid ads to a
landing page — but this audience doesn't have an ad budget yet, and three
different "ask for a price" demos in fifteen minutes would repeat the same
beat. Mention it exists, in one sentence, only if asked.

---

## PART D — "If they ask about X" (reference — NOT read aloud)

**"Does my website really have nothing of yours on it?"**
Yes, with one stated exception: a free-plan site carries a small "Site by
FieldQuo" line in the footer (`app/site/[subdomain]/SiteBlocks.js`), gated on
`isPaidSubscription()` in `lib/billing/access.js`. It disappears the moment
the plan is a real paid one — including during the free first month, which
counts as "paid" for this specific purpose on purpose, so the promise of a
white-label site isn't broken during the very month you're trying to win
someone over.

**"Does the email actually come from my email address, or yours?"**
The name on it is always yours — `senderFor()` in `lib/email/resend.js` puts
the company's own name on the From line every time. The underlying send
address is your own verified domain if you've set one up, or a shared
FieldQuo-owned sending address if you haven't (e.g. `quotes@send.fieldquo.com`)
— your customer sees your business name either way, but a technically-minded
prospect who checks the raw headers will see the difference. Verifying your
own domain closes that gap; it's a DNS record, not a code limitation.

**"Can my customer's neighbour refer themselves and get me a discount?"**
No, and don't imply it can — that's a deliberately different, unbuilt feature.
What exists is a contractor-to-contractor referral: you send another business
owner a link, they sign up, and you both get one free month
(`lib/referrals/index.js` — `REFEREE_BONUS_MONTHS` and `REFERRER_BONUS_MONTHS`,
both `1`, overridden down from an original three by the product owner on
2026-08-27). There's a model for a homeowner-refers-a-neighbour feature sitting
unused in the schema (`ReferralLink`) — it was deliberately never wired up,
because its landing page said "FieldQuo" to a homeowner, which is exactly the
kind of leak this product exists to prevent.

**"What happens when the AI credit runs out mid-design?"**
Nothing breaks. The Generate button in the Marketing Designer disables itself
and prints the exact shortfall in plain language — "this costs $0.12, your
balance is $0.03, top up $0.09" — rather than failing partway through or
silently overcharging. Every design, once made, is still yours to keep editing
and exporting with no AI involved at all; only new AI generations need credit.

**"How is this different from just paying for Facebook or Google ads myself?"**
Two separate things this answers together, but they're layered, not the same
tool: the Marketing Designer makes the ad creative — the actual image, in the
right size for wherever you're posting it — inside the same account as your
quotes and photos, using your brand automatically. It does not itself buy or
run the ad; you'd still post it or run it through your own ad account.

---

## What's genuinely half-built or unverifiable from this pass

- **Whether `demo1` currently has a published website** is a live-database
  fact this pass could not check — `lib/demo/seedDemo.js` confirms no demo
  gets one by default, but whether a prior sales call already built and
  published one on this specific account was not something static code could
  answer. Confirm before every call (Part A, item 3).
- **Whether `Company.sitePublished` has any live write path at all**, and
  whether the `/platform/demo` console's "Website" link is currently reliable
  as a result, could not be confirmed from static code — flagged plainly in
  Part C rather than stated as settled. Don't rely on that link; check the
  Builder page and the live subdomain directly.
- **Whether `demo1`'s painting trades have any `InstantQuoteConfig` rows, and
  what `estimateVisibility` they're set to**, is a live-database fact not
  checked in this pass. This is why the script routes the "ask for a price"
  beat through self-quote, which has no such ambiguity — it structurally never
  returns a price, in every configuration.
- **Whether the demo booking page has a bookable event type with no fee
  attached** was not checked against a live database (Part A, item 6) — if
  every event type on `demo1` carries a fee, the booking beat needs to either
  narrate the pending-payment state (same pattern `DEMO-SCRIPT.md` uses for
  Stripe Connect) or have a fee removed ahead of time.
- **The exact on-screen copy for the Marketing Designer's insufficient-credit
  message, the campaign-creation flow, and the booking form's field labels**
  were read from source (`app/components/designer/hooks/useAiImageStatus.js`
  and equivalents) but not verified against the live rendered UI at the moment
  of any specific demo — glance at the actual screen before reading a quoted
  line aloud, same caveat `DEMO-VOICE.md` ends on.
