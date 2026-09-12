// docs/sales/guide/content.en.js
//
// The words of the FieldQuo sales reference guide, in English.
//
// ══ Why the copy is separated from the builder ════════════════════════════
//
// Three PDFs are produced from one builder — English, French, Spanish — and a
// translator must be handed sentences, never markup. Anything structural
// (headings, ordering, anchors, the feature table) is computed by
// build-sales-guide.mjs from lib/marketing/featureMatrix.js, which is
// proof-carrying: every entry names the files and exports that must exist, and
// scripts/check-feature-matrix.mjs fails when one does not.
//
// That is the whole reason this guide can be trusted by somebody on a call.
// A rep reading it is not reading marketing copy; they are reading a list the
// build refuses to let drift from the code.
//
// ══ The one rule for whoever edits this ═══════════════════════════════════
//
// Do not describe a feature this file does not take from the matrix. If
// something is missing from the matrix, the fix is to add it there — with its
// proof — not to write a paragraph here. Two features were found missing while
// this was written (the AI vision pass and the Marketing Designer) and they are
// named in the gaps section rather than quietly asserted.
export const GUIDE = {
  lang: "en",
  dir: "ltr",
  title: "FieldQuo — the sales reference",
  subtitle: "What we sell, what it does, and where the edges are.",
  generated: "Generated",
  // The cover's one line of metadata. A template rather than a builder
  // concatenation, because "{features} features" is not a shape every language
  // has — French and Spanish both need the count elsewhere in the sentence.
  coverMeta: "Generated {date} · {features} features",
  intro: {
    heading: "How to use this",
    body: [
      "This is the reference behind the script. The playbook tells you what to say; this tells you what is true, so that when a contractor asks a question you did not expect, you can answer it without guessing.",
      "Every feature listed here is taken from the product's own feature matrix, which names the files that must exist for each one. If a feature is in this document, it is in the product. If something is not here, do not promise it.",
      "Every feature here is described as it works today. Where something is newer than the rest, the deep dive says so. If a contractor asks for something you cannot find in this document, say you will check rather than guessing — a contractor who buys on a promise you could not keep cancels in month two and tells people why.",
      "One rule about who you are handed: Quebec leads go only to reps who have set French under “Languages I can sell in” on the Pay tab. If a Quebec contractor is on your screen, that is why — take the call in French.",
      "The first half of this document is the product — what you are selling. The second half, “Your console”, is the room you sell it from: the dialler, the batch, texts, the team chat and your pay. Read that half on day one; it is what the screen in front of you does.",
    ],
  },
  pitchHeading: "The one thing to lead with",
  pitch: [
    "Every feature in this document is in every plan. All of it. The plans differ by how many people can use it and nothing else.",
    "That is the argument. A contractor comparing us to Jobber or Housecall Pro is used to a grid where the thing they actually need sits two tiers up. Here there is no tier to climb: the cheapest plan is the whole product for one person, and paying more only adds seats.",
    "Card fees, when they ask: 3% + 30¢ on a card payment online — pretty much Housecall Pro's 2.99%, and a tenth of a point above Jobber's 2.9% + 30¢, so do not claim we are cheaper on cards. Business and Amex cards are the same 3%, not a 3.49% surcharge rate. Where we win is bank debit in Canada: 1% + 40¢ capped at $5 per payment — a $5,000 invoice paid by pre-authorized debit costs the contractor $5, where Jobber's bank payments are a flat 1% with no cap. Every fee comes off the payment before it reaches their bank; nothing is billed separately and there is no monthly fee for taking payments.",
  ],
  plansHeading: "The plans, and what actually changes",
  plansIntro: "Four plans. The only differences are seats, crew logins and price.",
  planCols: { plan: "Plan", price: "Per month", seats: "Full seats", crew: "Crew logins" },
  planNote:
    "A full seat is somebody who creates and changes quotes, jobs and invoices. A crew login is somebody who clocks in, reads their schedule and adds photos — they cost nothing and do not count as a seat.",
  deepHeading: "The parts you will be asked about",
  deepIntro:
    "Ordered the way a contractor's day runs, not the way the software is built. Each one names the feature keys behind it so you can look it up in the reference table.",
  consoleHeading: "Your console — the room you sell from",
  consoleIntro: [
    "Everything above is what a contractor buys. This is what you work in. Each section says what the screen shows and what you do on it, and nothing more — every sentence was checked against the running code and the rendered screens in docs/screens on the day this was built. If the screen in front of you disagrees with a sentence here, the screen is newer; tell the team in #sales.",
  ],
  referenceHeading: "Every feature, by part of the business",
  referenceIntro:
    "All of it, grouped by the part of the business it serves. Each row is the feature's own name and one-line description, the same words the public site uses.",
  partialHeading: "Where the edges are — read this before your first call",
  partialIntro:
    "Ten features do less than their name suggests. The wording below is the product's own, not a softened version. Say it out loud on a call and you will never be caught out; say the name alone and you will be.",
  gapsHeading: "Two things we ship and do not claim",
  gapsIntro:
    "Found while writing this guide: both are in the product and neither is in the feature matrix, so neither appears on the public comparison pages. Mention them, but say plainly that they are newer than the rest of this document.",
  glossaryHeading: "Glossary",
  glossaryIntro: "The words a contractor may not know, and the ones we use differently from our competitors.",
  contentsHeading: "Contents",
  backToContents: "Back to contents",
  limitLabel: "What it does not do",
  // Shown beside a limit sentence that has no reviewed translation yet. It is
  // printed rather than hidden: a rep reading a French guide needs to know
  // which sentence they are quoting from a language their customer may not read.
  limitInEnglish: "English original",
  seeAlso: "See",
  partialBadge: "PARTIAL",
  shippedBadge: "LIVE",
  gaps: [
    {
      title: "The AI photo read",
      body:
        "A deep read over the photos attached to a quote, charged per run against the company's AI credit. It is why a contractor can send five photos of a roof and get back something useful about the roof rather than a description of a picture. It is not in the feature matrix, so it does not appear on the public comparison pages.",
    },
    {
      title: "The Marketing Designer",
      body:
        "Ad and social artwork made inside FieldQuo, organised by campaign, using the company's own colours and job photos. A contractor who has been paying somebody to make Facebook posts will care about this one. Also missing from the matrix.",
    },
  ],
  glossary: [
    { term: "Activated · Renewed · Still paying", def: "The three stages of your pay for one customer — CA$20 when their Stripe account can take money, CA$40 when they reach their next billing cycle, CA$65 when they are still subscribed sixty days from the day they signed up." },
    { term: "Add-on", def: "An extra the client can accept on the quote itself, priced by the server rather than the browser. The homeowner ticks it; the total updates.", key: "add_on_upsell" },
    { term: "Batch", def: "The 25 leads the server hands you in one press of Claim the next 25 — only leads whose calling window is open at that minute. Tops itself up when fewer than 5 can still be rung." },
    { term: "Break-even price", def: "The price below which a job loses the contractor money, worked out from their own overhead and labour rather than a rule of thumb.", key: "break_even" },
    { term: "Calling window", def: "The hours a business may legally be rung, in its own time zone, from its state's or province's rule. The console never shows a Call button outside it." },
    { term: "Check-in draft", def: "A text FieldQuo writes for you and puts in the thread — day 1 and day 7 after a company signs up, and near the 60-day mark. You edit it and press Send. Nothing sends it for you." },
    { term: "Crew login", def: "Somebody who clocks in, reads their schedule and adds photos. Free, and does not use a seat.", key: "crew_shifts" },
    { term: "Crew inbox", def: "Texting with crew who have no login and will not install an app. They text a number; it lands in the office filed against them.", key: "crew_inbox" },
    { term: "Disposition", def: "What happened on the call, picked from ten outcomes, with the next step. Saving it is what ends “Writing it up” and, with Auto-dial on, what rings the next lead." },
    { term: "Instant estimate", def: "A price a homeowner produces themselves on the contractor's website, from the contractor's own rates. Never our rates.", key: "instant_quotes" },
    { term: "Job costing", def: "Quoted against actual, after the work — so next year's prices are built on what happened.", key: "job_costing" },
    { term: "Lead", def: "A contractor we want as a customer. The ones the queue hands you and the ones you typed in yourself are both leads; the word “prospect” is not used." },
    { term: "Price book", def: "The contractor's own rates for labour, materials and services. Everything priced in FieldQuo comes from here.", key: "price_book" },
    { term: "Seat", def: "Somebody who creates and changes quotes, jobs and invoices. Seats are the only thing the plans differ by.", key: "team_access" },
    { term: "Status", def: "What you have told the portal you are doing — Available, Break, Dinner, Meeting, Training or Off. Incoming calls ring only reps who are Available; the two states the system sets itself are On a call and Writing it up." },
    { term: "Takeoff", def: "The trade-specific form that turns measurements into a priced quote — squares of roof, linear feet of gutter, doors and drawers.", key: "quotes" },
    { term: "Vision pass", def: "The paid deep photo read. Distinct from the free review, which also looks at photos but does not charge." },
    { term: "White label", def: "Every document a homeowner sees carries the contractor's name and colours, not ours. This is the default, not an upgrade.", key: "white_label" },
    { term: "Zone chips", def: "All · ET · CT · MT · PT above your list. Pick one and the list, Next and Auto-dial stay in that time zone." },
  ],
};


/**
 * The deep dives, in the order a contractor's day runs.
 *
 * `keys` are featureMatrix keys. The builder resolves each to its real name,
 * summary and limits, so a paragraph here can never claim something the matrix
 * does not carry — and a feature renamed in the matrix renames itself here.
 */
export const DEEP_DIVES = [
  {
    id: "quoting",
    title: "Quoting, and the sixty-second version",
    keys: ["quotes", "quote_pdf", "quote_send", "instant_quotes", "self_quote", "call_to_quote", "aerial_measure"],
    body: [
      "A quote is the product. Everything else exists because a contractor who quotes faster wins more work, and most of them are quoting at nine at night on a laptop after a full day on site.",
      "There are three ways a price gets made. The estimator builds one from the price book on the tablet in the driveway. The homeowner builds one themselves from the instant estimate on the contractor's website. Or the AI receptionist takes the call and drafts one from what was said.",
      "The sixty-second claim is the second of those, and it is worth being precise about what does the work: the trade's takeoff form does the arithmetic, the price book supplies the rates, and for roofing the roof is measured from the sky rather than typed in. The contractor is picking options, not calculating.",
      "Roofing is the one to demonstrate. Type the address, and the surface area, the pitch and the linear details — eaves, rakes, ridge, hips, valleys — come back from satellite measurement. Nobody climbs anything to produce the first number.",
    ],
  },
  {
    id: "getting-paid-to-quote",
    title: "Getting paid to turn up",
    keys: ["booking_page", "booking_deposit"],
    body: [
      "Contractors who charge for an estimate usually do it because they were burned by tyre-kickers. They will ask whether the software can take that money before the visit, and it can.",
      "The booking page takes the appointment and the deposit in the same step, so the slot is only held once the card has gone through. For a company with a call-out or assessment fee, that fee is the deposit.",
      "Worth saying on the call: this is the same booking page a homeowner uses to book any visit, so a contractor who does not charge simply leaves the deposit off. It is one screen with the money switched on or off, not a separate product.",
    ],
  },
  {
    id: "cost-and-margin",
    title: "Cost, labour and the margin the contractor actually keeps",
    keys: ["job_costing", "break_even", "price_book", "material_costs", "benchmark", "expenses"],
    body: [
      "This is the part that separates us from a quoting app, and it is the part most contractors have never had. A quote screen shows the price. This shows what the job costs to do and what is left.",
      "Materials come from recipes, labour from hours at the rate they actually pay, and overhead from what they told us they spend. The margin on screen is theirs, not a percentage somebody guessed.",
      "Break-even is the one that lands emotionally. It answers the question a contractor has never been able to answer: below what price does this job lose me money. A rep who can show that number is not selling software any more.",
      "Job costing then closes the loop after the work — quoted against actual — so next year's price book is built on what happened rather than what was hoped.",
    ],
  },
  {
    id: "ai-review",
    title: "The AI review, and the photo read",
    keys: ["ai_quote_review", "add_on_upsell", "ai_copilot"],
    body: [
      "Before a quote goes out, the AI reads it and says what is missing, what is priced oddly against the contractor's own history, and which add-ons this kind of job usually needs.",
      "Two things to be careful about here, because they are what a sceptical contractor will push on. It compares against THEIR history, never another company's — their numbers never leave their account. And it suggests; it never edits the quote or sends anything.",
      "There is a deeper paid photo read as well, over the photos attached to a quote. It costs AI credit per run, which is why it is a button rather than something that happens automatically to every photo.",
    ],
  },
  {
    id: "approval-to-invoice",
    title: "Approval, signature, and the invoice that makes itself",
    keys: ["online_approval", "invoices", "invoice_send", "invoice_changes", "client_portal"],
    body: [
      "The homeowner opens the quote on their phone, approves it and signs it there. No printing, no scanning, no meeting to collect a signature.",
      "The invoice then mirrors the quote rather than being rebuilt: same lines, same layout, same branding. That mirroring is deliberate and it is worth naming, because the common failure in this category is an invoice that quietly disagrees with the quote the client signed.",
      "A changed invoice keeps its history, so a contractor can show what changed and when. On a disputed job that record is the whole argument.",
    ],
  },
  {
    id: "payments",
    title: "Getting the money",
    keys: ["card_payments", "stripe_connect", "financing", "sales_tax", "service_plans"],
    body: [
      "Card payment runs through Stripe into the contractor's OWN payout account. FieldQuo never holds their money — that is worth saying early, because contractors have been burned by platforms that sit in the middle.",
      "Cash, cheque and e-transfer are recorded against the invoice by hand, so the paid figure matches reality whatever the homeowner did.",
      "Sales tax is worked out from the job's address rather than the company's, which matters to anyone working across a boundary.",
      "Financing is the one to phrase carefully — read its limits in the last section before you offer it on a call.",
    ],
  },
  {
    id: "doing-the-work",
    title: "From invoice to crew: scheduling, dispatch and the day itself",
    keys: ["jobs", "scheduling", "crew_shifts", "time_clock", "timesheets", "job_photos", "crew_inbox", "recurring_jobs"],
    body: [
      "An approved quote becomes a job, the job gets scheduled and dispatched, and the crew see where to be and what to do.",
      "Crew clock in and out, and those hours are what timesheets, job costing and pay are built from — one set of hours, not three.",
      "The crew inbox is texting for people who do not have a login and will not download an app. A crew member texts a number and it lands in the office, filed against the right person. Contractors with subcontractors or seasonal crews find this immediately obvious.",
      "Before and after photos attach to the job, which is where a homeowner dispute usually ends.",
    ],
  },
  {
    id: "the-phone",
    title: "The phone: the AI receptionist",
    keys: ["voice_receptionist", "voice_callbacks", "call_to_quote"],
    body: [
      "A contractor on a roof does not answer the phone, and a missed call is a job that goes to whoever picked up.",
      "The receptionist answers, takes the details and books the visit. It can also ring back to confirm an appointment.",
      "The strongest demonstration is the call turning into a drafted quote — the enquiry arrives already priced enough for the contractor to look at, rather than as a voicemail to return.",
      "Two facts that come up: the contractor can keep the number on their van and forward missed calls to it, or take a new number. And it is billed by the minute from a credit balance, so a quiet month costs almost nothing.",
    ],
  },
  {
    id: "marketing",
    title: "Getting found: the website, funnels and campaigns",
    keys: ["website_builder", "lead_form", "funnels", "email_campaigns", "review_requests", "testimonials", "bio_link", "embeds", "referrals"],
    body: [
      "Most contractors either have no website or one they cannot edit. FieldQuo builds one from what they already told us — their trades, their services, their photos — and it carries their name, not ours.",
      "Lead funnels are the mobile-first version for ads: a few taps, a scored lead in the pipeline, no form to abandon.",
      "Review requests go out after the job, which is when a happy customer will actually write one.",
      "There is a Marketing Designer for ad and social artwork as well: artwork made inside FieldQuo, organised by campaign, in the company's own colours and with their own job photos. A contractor who has been paying somebody to make Facebook posts will care about this one. It is newer than most of this document.",
    ],
  },
  {
    id: "languages",
    title: "Working in more than one language",
    keys: ["languages", "white_label", "quote_email_wording", "contract_terms"],
    body: [
      "Two separate things, and reps mix them up. The first is the language the CONTRACTOR works in — the app itself. The second is the language the HOMEOWNER reads — the quote, the invoice, the emails.",
      "The second is the one that sells. A contractor whose customers are Spanish-speaking can send a quote in Spanish while working in English themselves.",
      "One rule to state plainly, because it sounds like a limitation and is actually the reassuring part: a document keeps the language it was created in. A signed quote will always say what it said when it was signed. Nothing is re-translated behind the client's back.",
      "Eight languages for the client: English, French, Spanish, Ukrainian, Punjabi, Tagalog, German and Italian. The quote PDF, the invoice, the covering email and the client portal all follow the client's language. The contractor picks it once on the client record and every document after that follows.",
    ],
  },
];


/**
 * The rep's own tools, in the order a shift runs: the console you sign in
 * to, the batch it hands you, the call that comes back, the text thread, the
 * team behind you, the language rule, the voicemail, and the pay.
 *
 * No `keys` — none of this is in the feature matrix, because none of it is
 * sold. The proof is the rendered screen instead: `shot` names a frame under
 * docs/screens that is the real component drawn against fixtures, and the
 * builder embeds it under the section. Every control named in a paragraph
 * must be visible in a frame in that folder or in the code the frame renders.
 */
export const CONSOLE_SECTIONS = [
  {
    id: "queue-screen",
    title: "The console: the list on the left, the lead in the middle, the phone under your hand",
    shot: "docs/screens/sales-console/desktop-idle.png",
    shotCaption: "The Queue screen: sidebar, status menu, the Dialer on the left, the tabbed card with Script open.",
    body: [
      "Every /sales screen has the same vertical sidebar down the left: Today · Queue · Playbook · My leads · Conversations · Texts · Team · Notes · Calendar · My companies · Demo · Support · Voicemail · Pay. Texts, Team and Voicemail wear a badge when something is waiting. At the foot is “Calls today N / 250” — the dials you have placed since your day started, against the day's ceiling. It collapses to icons if you want the width.",
      "The top bar holds the search box and your status. The status pill says what you are doing and for how long — Available, On a call, Writing it up, Break… — and opens a menu of six: Available · Break · Dinner · Meeting · Training · Off. On a call and Writing it up are not on the menu: pressing Call sets the first and hanging up sets the second, until you save the outcome. Set Off when you leave, because a callback rings only reps who are Available, and a laptop left on Available rings for twenty seconds before the caller moves on.",
      "The Dialer sits on the left of the Queue screen and is laid out like a phone: the number in large type, a 3×4 keypad, and Call under it. The small line above the display is the lead's calling window and whose rule it is — “Window closes 9:00 PM · Oklahoma's rule”, or “FieldQuo's rule” where the state sets none. Under the Call button, where a state caps how often the same business may be rung on the same subject, a second line counts it: “1 of 3 calls in 24 h · Oklahoma”. Outside the window there is no Call button at all, only the reason and the hour it opens; a greyed-out button that does nothing is the one thing this screen refuses to draw.",
      "If the owner gives you another number, type it on the keypad. Call saves it on this lead first, then rings it through the same checks as a stored number — it is never a loose number, and a number on the do-not-contact list is refused with the sentence under the display. During a call the same keys send tones, for a phone menu. Auto-dial is the switch under the button: on, the next lead rings five seconds after you save the outcome, and the card opens on Disposition instead of Script.",
      "On the right is one tall card with eight tabs: Company · Contact · Script · Research · Notes · Disposition · Tasks · Leads. Every number on Company and Contact has Dial beside it. Script is the call as numbered steps, then Key talking points and the Goal — the ask this call exists to make. Research is three layers in the same order every time: facts, then what we think (always with a confidence), then what to recommend. Disposition is the ten outcomes and the next step. Tasks holds callbacks and check-in drafts. Leads is your batch, grouped by calling window. Previous · Next walk the batch; Next in queue jumps to the first lead you can ring now.",
    ],
  },
  {
    id: "batch",
    title: "Your batch: 25 at a time, only leads you can ring this minute",
    shot: "docs/screens/sales-console/desktop-top-up.png",
    shotCaption: "The batch topping itself up: under 5 open, three Pacific leads added, two closed Eastern ones released.",
    body: [
      "Pick a trade and press Claim the next 25. The server picks — you cannot browse the pool, on purpose — and hands you only leads whose calling window is open at this minute, the one closing soonest first, researched ones ahead of unresearched. At eight in the morning Eastern that is Eastern and Atlantic leads; at nine in the evening it is Pacific ones. A short batch says why: “12 open now — more open at 11:00 AM PT”.",
      "You do not press it again. When fewer than 5 of your leads can still be rung, the console adds the next batch on its own, at most once a minute, and says so quietly: “Added 25 leads open now (PT). 3 closed leads released.” At the same moment, leads you never touched whose window has shut for the rest of your shift go back to the pool. A lead you have called, or booked a callback on, is never taken from you. The day's ceiling is 250 claims, and the sidebar counts toward it.",
      "The zone chips above the list — All · ET · CT · MT · PT, and AT · NT when you hold any — filter it, and the chip you pick says the zone's next fact: “open until 9:00 PM PT”, or “closed — opens 8:00 AM”. Next and Auto-dial follow the filter, so pick PT at the end of your day and the walk stays on the West Coast.",
      "If fewer leads arrive than you asked for and the note says “N Quebec leads not offered — add French to your languages on the Pay tab”, that is the language rule two sections down, not a fault.",
    ],
  },
  {
    id: "incoming",
    title: "When a contractor rings you back",
    shot: "docs/screens/sales-console/desktop-ring.png",
    shotCaption: "The incoming-call drawer, down from under the top bar: business, number, whose lead it is, Pick up, Decline.",
    body: [
      "A call to your number rings inside the portal, whichever /sales screen you are on. A drawer slides down from under the top bar with the business name, the number and whose lead it is, and two buttons: Pick up and Decline. Pick up puts the live call in the Dialer's own slot, exactly where an outbound call sits, with Mute, Hang up and Transfer. Decline hands the call back so the next rep in the ring plan gets it — it does not send the caller to voicemail. Only when nobody picks up does the caller hold while the system looks again, and reach voicemail after that.",
      "Who rings: first the rep whose number was dialled; then whoever rang that contractor last; then the reps who are Available and have been heard from recently — at most three, twenty seconds each. Paused, Off and stale laptops are skipped, which is why your status matters. A caller from a Quebec area code, or a lead the matcher places in Quebec, rings only reps with French.",
    ],
  },
  {
    id: "texts",
    title: "Texts: a chat client, and nothing sends itself",
    shot: "docs/screens/sales-messages/desktop-thread-bottom.png",
    shotCaption: "Texts: the four groups, a thread with a draft check-in in it, the composer with the window line, the contact bar.",
    body: [
      "Texts is a chat client, not a list with a compose box. The rooms down the left sit in four groups — Needs a reply · Waiting on them · Drafts due · Done — the conversation is in the middle with day dividers and the red unread line, and the contact is in a bar on the right (Details · Channels · History). Every text goes out from FieldQuo's sales number, and the reply lands in the same thread.",
      "The line over the composer is the lead's texting window in THEIR zone — “Open until 9:00 PM CDT”, or “Closed — opens 8:00 AM”. The zone comes from their province, or from the zone you stated after speaking to them; a state that spans two zones (Florida, Texas, BC) is asked about rather than guessed, and it is never taken from the area code. The server judges the window again at the instant you press Send.",
      "STOP means STOP. A conversation where they replied STOP shows a red STOP tag and no composer — nothing can be sent to that number on any channel, and only a superadmin's written request reopens it. Do not work around it from your own phone.",
      "Check-ins are drafts. Day 1 after a company signs up (did setup go through?) and day 7 (is it working on a real job?), and one more near the 60-day mark when it is due, the draft appears in the thread and under Drafts due with a “Tab to load it” hint. You read it, change it, and press Send. Nothing goes out on its own, ever. Type ! in the composer for the canned wordings — the Check-in and Sales groups, and the signup link.",
      "New message opens a thread with one of your own leads. New text takes a number you type — Canadian and US only; a Caribbean +1 or anything overseas is refused with the reason, and so is a number another rep holds. A number nobody holds becomes a lead with just the number on it, and the first message is the introduction with the signup link, sent by you.",
    ],
  },
  {
    id: "team",
    title: "Team: everybody at FieldQuo, from one screen",
    body: [
      "Team is FieldQuo's own chat — the reps and the people who back them up, in the same rooms, on the same screen a platform admin sees. Three channels everybody is in: #fieldquo, all of FieldQuo and the one nobody can leave; #sales, the reps on the phones and the people behind them; and #support, where you hand a customer's problem to somebody who can fix it. New group makes a private room with the reps and FieldQuo staff you pick; New message opens a direct message with one person; @ in the composer lists the room's members, and a mention can only name somebody who is in the room. A question asked here is read by somebody who can act on it.",
    ],
  },
  {
    id: "sells-in",
    title: "Languages I can sell in — and why Quebec may not reach you",
    body: [
      "On Pay, under the portal language, is Languages I can sell in. Tick every language you can take a sales call in. Left unanswered, it reads as English only. Quebec leads go only to reps with French — on a single claim, in the batch, when a lead is moved to you, and when a Quebec number rings in — and the queue tells you how many were held back: “N Quebec leads not offered — add French to your languages on the Pay tab to receive them.” New Brunswick has no such rule. If you speak French, tick it before your first shift; a superadmin can also set it on your rep record.",
    ],
  },
  {
    id: "voicemail",
    title: "Voicemail",
    body: [
      "A contractor who rings your number when nobody can pick up holds for a moment while the system looks for somebody free, and leaves a message after that. Voicemail is where you hear it: each message with the number, when it was left, how many seconds were spoken, a player, and the lead to open. A zero-second message is shown on purpose — it is somebody who rang back, heard the beep and hung up, and is worth a callback. The badge on the tab counts the messages left since your day started.",
    ],
  },
  {
    id: "pay",
    title: "Your pay: one customer, three stages, CA$125",
    body: [
      "Everything FieldQuo pays a rep is in Canadian dollars. One customer pays CA$125, in three stages that follow the customer proving out: CA$20 when the company is Activated — Stripe has verified them and switched charges on, so they can take money; CA$40 when they are Renewed — they reach their next billing cycle after the free month, whether Stripe collected or a referral credit covered it; CA$65 when they are Still paying — still subscribed sixty days from the day they signed up, trial included. The plan is a row on your rep record, so a rep hired on different terms keeps them; and if you leave, what your companies go on to earn is still yours.",
      "Pay shows it: Earned all time, Paid to you, Closed not paid yet, This week so far; every company you brought in with the stage it has reached; and the weeks, each with a Paid date once the run has gone. Weeks close Monday to Monday and the run pays the week before. Nothing on the screen can be edited — it is the ledger the payout is paid from. Below it is where FieldQuo sends the money (Interac e-Transfer for a Canadian account, Wise for a rep outside Canada, PayPal, or a bank transfer), then the portal language, then Languages I can sell in.",
    ],
  },
];

// ══ Every screen ══════════════════════════════════════════════════════════
//
// One entry per row of the two sidebars, keyed by the slug in
// docs/screens/app-guide/harness/screens.js. The TITLE of each entry is not
// here: the builder prints the sidebar label from app/i18n/appMessages.js in
// the language being built, so the heading in the guide is the word on the
// screen. The figure is a capture of the real screen (the owner's live
// session when one exists, else the harness render of the real component
// against the fixture company). Two or three sentences each: what the screen
// shows, what a contractor does on it. Nothing described here that the
// figure does not show.
export const SCREENS_CHAPTER = {
  heading: "Every screen, in the order the menu shows them",
  intro: [
    "The back office is one sidebar. This chapter walks it top to bottom — Home, FieldQuo AI, then the five groups Work, People, Money, Insights and Grow, then Help, Plan and Settings — and then walks the Settings menu the same way. Each entry is the real screen, captured from a signed-in owner's account on the day this guide was built — and, where the screen has a New or Add button, a second figure shows what opens when it is pressed.",
    "Use it two ways. On a demo, it is the route: open the screens in this order and you have shown the whole product in twenty minutes. On a call, it is the answer to “where do I do X?” — find the row, read the sentence, say the words on the screen.",
    "A screen may be missing from a customer's menu. That is not a fault: the sidebar hides rows the signed-in person's access level does not allow (see “Roles and access”), and Cabinet Rates and Material Costs appear only for the trades that price that way.",
  ],
  railHeading: "The main sidebar",
  settingsHeading: "The Settings menu",
  createCaption: "{title} — what opens when you press “{button}”",
  items: {
    // ── Home, AI ──────────────────────────────────────────────────────────
    home: { body: [
      "“Dashboard — Here's what's happening with your business.” It opens with “Waiting on you”: the overdue invoice with a “Chase payment” button, the quotes waiting for a price to be approved, and the next appointment the receptionist booked. Then “Revenue this month” with a sparkline of money received, and four tiles — “Quotes sent this month”, “Conversion rate”, “Money owed”, “Upcoming visits”.",
      "“The detail” below: the monthly bar chart (3m / 6m / 12m), the receivables aging ladder with each owed invoice and its contact, the “Revenue goal” pace bar, “Recent Quotes” and “Upcoming Appointments”. “+ New quote”, “View Clients” and “Schedule Appointment” are the three buttons.",
    ] },
    ai: { body: [
      "“FieldQuo AI — Ask about your own quotes, invoices, clients and material costs. It looks up real numbers rather than guessing.” An empty conversation with “Try asking” prompts (“Which clients haven't been invoiced yet?”, “What's my average quote value this month?”) and an “Ask about your business…” box.",
      "It answers only about this company's own data and declines general requests — that is the honest pitch, and the reason it can be trusted with a contractor's numbers.",
    ] },
    // ── Work ──────────────────────────────────────────────────────────────
    requests: { body: [
      "“Leads — Enquiries from your booking page and contact forms.” A four-column board — “New”, “Contacted”, “Won”, “Lost” — that cards drag across. Each card carries a Hot / Warm / Cold score, timeline and budget chips, the category, a photo count, the linked quote number and the assignee.",
      "Filters “All / Hot / Warm / Cold”, a “Hottest” sort, search, and an “Import” button. This is where the website form, the booking link, the receptionist and a referral all land.",
    ] },
    quotes: { body: [
      "“Quotes — Manage customer quotes.” Status chips with counts (“All”, “Draft”, “Sent”, “Approved”, “Declined”), a search box, and the list: number, status, client, amount, age. A quote that was sent and never answered is promoted to the top (“Quote sent, no response”, with its valid-until date); an instant estimate carries “Needs review”.",
      "“New Quote” opens the builder. The quote keeps the language it was created in; the client sees it as a page and a PDF with the company's own branding.",
    ] },
    "estimate-reviews": { body: [
      "“Estimate Reviews — Instant estimates from your website land here first. Confirm the price — adjusting it if the property needs it — before the quote can be sent.” Each card names the client and the source (“Homeowner-entered” or “Taken from a phone call”, with a “Listen” button), who it is assigned to, the size and material, the range the homeowner saw and their stated budget, and the line breakdown.",
      "“Approve at CAD …” with “Approve” and “Open quote”. Nothing an algorithm priced reaches a homeowner without a person pressing this.",
    ] },
    jobs: { body: [
      "“Jobs — Scheduled and in-progress work.” Chips “All / Needs a date / Scheduled / In progress / Completed / Cancelled”, an “Archived” toggle, search, and the list with title, status badge, client and visit count.",
      "“New Job” starts one by hand; most jobs are made from an accepted quote. “Past jobs” imports history from a previous system.",
    ] },
    invoices: { body: [
      "“Invoices — Track payments and billing.” Three tiles — “Outstanding” (with how much of it is past due), “Paid”, “Total Billed” — then the list: number, status (“Sent”, “Paid”, “Overdue”), client, due date, “12 days past due” in red, and the balance or “Paid in full”.",
      "“New Invoice” raises one; a deposit invoice is usually raised from the quote's payment schedule. Invoices mirror quotes — same sections, same branding — and are paid online through the company's own Stripe account.",
    ] },
    plans: { body: [
      "“Service plans — Recurring work sold as a package, billed on a cadence you choose.” Each plan: name, “Active”, client, cadence (“Once a year”, “Quarterly”), per-visit price, how it is collected (“Invoice sent each visit”), and either the term total with its package discount or “Runs until cancelled”.",
      "“New plan” sells one. A plan is a standing instruction to raise a visit and an invoice — that is why the row sits after Invoices.",
    ] },
    calendar: { body: [
      "“Appointments — In-person visits and site assignments.” Chips “All / Scheduled / Supervisor required / Completed / Cancelled” with counts, a month grid (Monday start, today ringed, entries on their day, prev / next / “Today”), and under it the rows: client, status, a “Job visit” badge, time, phone and address, who is assigned, “Open job”.",
      "“New Appointment” books one. Visits made from a job, bookings from the public booking page and callbacks the receptionist booked all appear here.",
    ] },
    tasks: { body: [
      "“Tasks — Tasks are internal reminders for you and your team. Jobs are scheduled work at a client's address.” A count of open tasks; overdue first, then by priority; each row with a tick, a priority chip, due date, assignee, client and a link to its job; a task that needs photos shows “0/3 photos”.",
      "“New task” adds one; “Show completed” reveals the done ones.",
    ] },
    chat: { body: [
      "“Chat” — the company talking to itself, on the same chat kit as Messages. #general is everyone on the team; each job on the calendar has its own room for the crew booked on it and the office; a direct message is between two people. Rooms group as “Unread”, “Company”, “Jobs”, “Direct messages” and “Finished jobs”.",
      "In a room: the thread with an unread divider, @-mentions that notify the person named, the members list, and the composer. “New message” opens a direct message with anyone on the team.",
    ] },
    // ── People ────────────────────────────────────────────────────────────
    clients: { body: [
      "Every customer, as a card: name, email, phone, city, and a footer counting their quotes and invoices. A business shows its contact person under the company name.",
      "“New Client” adds one; “Import” loads a CSV from whatever the contractor used before. Opening a card reaches that client's quotes, jobs, invoices and equipment in one place.",
    ] },
    "client-equipment": { body: [
      "“Warranties running out” — the furnaces, panels and cabinets the company installed whose cover has ended or is about to. It is a call list, and the page says so.",
      "A window picker (“Next 30 days” up to “Next 365 days”) and a tally — out of warranty, ending soon, no date recorded — then one card per piece with a tap-to-call number and an “Email” button, so a renewal visit gets booked from the card.",
    ] },
    team: { body: [
      "“Manage Team”: the seat panel first — “4 / 6 seats used”, “3 / 11 crew — included free”, with “Add crew — free” and “Add a seat” — then the roster with each person's access level as a dropdown: Manager, Estimator, Dispatcher, Crew, or “Custom…”.",
      "Changing the dropdown re-grades that person's tier and permissions in one step; “Add User” invites someone; a pending invite shows as “Invited” with “Cancel invite”. This is the screen the Roles chapter is about.",
    ] },
    subcontractors: { body: [
      "The companies hired per job — the electrician, the countertop fabricator — with trade, contact, and whether their insurance or clearance is “In date”, “Due soon” or “Expired”; the expiring ones are pulled into a panel at the top so nobody steps on site uncovered.",
      "A “Paid in” year picker totals what each sub was paid, and “Year-end list (CSV)” exports the T5018 list.",
    ] },
    scheduler: { body: [
      "“Scheduling” — the crew's week as seven day cards. “Add shift” puts a person on a job with hours and a note (“Load the van, deliver cabinets”); shifts stay “Draft” and invisible to the crew until “Publish week”.",
      "The dispatcher's screen: draft the week, move things, publish once.",
    ] },
    "team-schedule": { body: [
      "“Team Schedule” — everyone on one page: a card per person with their tier, a Mon–Sun strip of availability (“08:00–17:00”, “—” on days off), an “Edit hours” button, and “Next 2 weeks” of what they are booked on, by client.",
      "The owner sees at a glance who is bookable when, and fixes anyone's hours from here.",
    ] },
    clock: { body: [
      "“Time clock” — the signed-in person's own punch: the live clock, an “On the clock” pill, time elapsed since they clocked in, which job they are on, and a red “Clock out” button. “Moved to another job?” switches the running entry to a different job.",
      "Below, “Today” totals the day's hours and lists each entry. This is what the crew opens on their phone; the office reviews the result on Timesheets.",
    ] },
    timesheets: { body: [
      "“Timesheets — Log, review and approve hours.” One row per punch: today's crew “In progress” with an “In · On site” chip, last week's rows with hours and an “Approve” button, older ones “Approved”. A punch taken far from the job is flagged in amber (“In · 2.1 km away”).",
      "A manager approves hours here before they reach a pay run; “Add entry” records a missed punch by hand.",
    ] },
    "time-off": { body: [
      "“Time off — Request time off and see what you have left.” Balance cards (Vacation, Sick days, Personal day) with accrued and taken, “Your requests” with “Request time off”, and “Withdraw” on a pending one.",
      "The “Team” tab, for a manager, lists requests “Awaiting approval” with “Approve” and “Decline”, “Who's off next”, and everyone's balances.",
    ] },
    safety: { body: [
      "“Safety — Injuries and near-misses.” A “Report” button, filters “All / Open / Reviewed / Closed”, and a card per incident with its kind (“Near-miss”, “Property damage”), whether “Work stopped”, where, who reported it and its status.",
      "Each card has a “Follow up” disclosure where a manager sets the status and records what was done. Crew can report; only managers follow up.",
    ] },
    // ── Grow ──────────────────────────────────────────────────────────────
    marketing: { body: [
      "“Marketing” — one card per campaign with its status (“Active”, “Draft”), its kind (“Pamphlet distribution”, “Meta / paid ads”, “Email blast”), its progress (a flyer route shows “26/40 stops” and “9 spoke to”; an ad shows “Budget $600.00”) and who it is assigned to.",
      "“New Campaign” starts one; “Subscribers” and “Marketing spend” sit beside it. A pamphlet campaign is worked stop by stop from the phone.",
    ] },
    "marketing-designer": { body: [
      "“Marketing Designer — Design one ad and export it in every size a social network asks for — Instagram, TikTok, Facebook and YouTube — without redoing the layout by hand.”",
      "Designs are listed under their campaign with “Approved” / “Not approved”, chips for the five formats (Instagram post, Instagram story, TikTok, Facebook feed, YouTube thumbnail) and “2/5 formats ready”. “Make a post from a job” turns a job's before-and-after photos into a post; “New design” opens a blank canvas.",
    ] },
    funnels: { body: [
      "“Funnels — Mobile-first, tap-through lead funnels for your ads and link-in-bio. Each one qualifies visitors and drops a scored lead straight into your pipeline.” Each row: name, “Published” or “Draft”, its channel (Web, Instagram, TikTok, YouTube), and how many leads it produced.",
      "“New funnel” opens the AI generator (“Describe your funnel…”, “Generate”) and the channel templates; a row opens the builder and its drop-off report.",
    ] },
    receptionist: { body: [
      "“Receptionist — Calls it has taken for you, and what came of them.” The AI phone agent's log, grouped “Needs you”, “Waiting on you” and “Archived”, each call with the number, time, duration and cost, the summary, and what it produced: “Saved as a lead”, “Visit booked”, a “Listen” button, “Draft a quote from this call”, “Book a callback”.",
      "A line at the top counts the appointments the calls booked. “Recover missed calls” and “Receptionist settings” are the two buttons.",
    ] },
    "crew-inbox": { body: [
      "“Crew inbox — Photos and updates your crew texted in. Filed ones are on their jobs.” The green “Crew texting” panel shows the number the crew text, the credit balance and the rates (2¢ a text, 5¢ a photo).",
      "“Needs you — pick the job” holds a photo the system could not file, with “Which job is this for?” and a chip per candidate job; “Filed” lists the rest with the job they landed on.",
    ] },
    messages: { body: [
      "“Messages — Facebook Page and Instagram business messages, answered here.” Conversations on the left, grouped “Needs a reply” and “Waiting on them”, each with the channel glyph, how long they have waited and a temperature chip (“Warm 35”); channel chips filter All / Facebook / Instagram / WhatsApp.",
      "The open conversation sits in the middle with “Reply” and a private “Note”; the right pane holds the person's details, the status (“Open”, “Waiting on them”, “Snoozed”, “Resolved”), who is “Looking after this”, and “Open lead”. “Monthly review” is the top-right button.",
    ] },
    refer: { body: [
      "“Refer another business and get another month of FieldQuo free, once they're a paying customer.” The company's link with “Copy” (“Short enough to say out loud. Put it on a business card, an invoice footer, or a van.”), a “WhatsApp” share button, and “Send an invite” by Email or Text.",
      "Under it, the months earned, the businesses referred (“Credited” or “Not yet paying”) and the invites sent.",
    ] },
    help: { body: [
      "“Help Centre — Step-by-step guides for everything in FieldQuo — quotes, jobs, invoices, getting paid, booking, your website, your team, and using it on your phone.” A search box, “Replay the setup walkthrough”, and articles grouped by topic (“Getting started”, “Quoting & invoicing”, “Jobs & clients”…).",
      "Articles open in place. Point a contractor here before they call support.",
    ] },
    plan: { body: [
      "“Account & Billing — Your plan, seats, and payment details.” The plan card reads, for example, “Shop · Active · $269.00/month · 6 seats · 11 crew included free · Next billing date 2026-09-30”, with “Manage billing & payment method”, “See what my clients paid me” and “Cancel plan”.",
      "Under “Plans”, a “Monthly” / “1 year commitment” switch and the four rungs — Solo, Crew, Shop, Scale — each with its seats and crew logins and “Choose plan”; the current one says “Current plan”. Owner and administrators only.",
    ] },
    // ── Money ─────────────────────────────────────────────────────────────
    payroll: { body: [
      "“Payroll — FieldQuo works out what each person should be paid from their approved hours and your saved rates, and produces payslips. You pay through your own bank or payroll provider — FieldQuo doesn't move the money.” Say that last sentence on every call: it is the question they ask.",
      "“New pay run” is pre-filled with the last closed period of the company's pay cycle (“Every 2 weeks”); “Calculate” previews gross, deductions and net per person, then “Save as draft run”. “Pay runs” lists each period with its dates, headcount, net total and status — “Approved”, “paid (recorded)”.",
    ] },
    expenses: { body: [
      "“Expense Tracking — Where your money goes — by job, overhead, and category — plus your monthly burn rate.” A month stepper over four cards: “Tracked expenses this month”, “Monthly burn rate” (overhead + salaries + debt), “Runway” and “Job-related spend”.",
      "Below: an “AI Summary” card, “Monthly Burn Breakdown” and “Spend by Category” bars, the “6-Month Trend”, and “Recent Expenses” with each receipt tagged “Overhead” or “Job-linked”. “Add Expense”, “Import from bank CSV”, and a “Bookkeeping export” card that downloads a date range as CSVs for the accountant.",
    ] },
    purchasing: { body: [
      "“Purchasing — Who you buy from, what you have on order, and what is on the shelf.” Three tabs: “Orders”, “Stock”, “Suppliers”. Orders lists each purchase order with its supplier, how many lines are in (“0 of 2 lines fully in”, “All in”), status and total; “New order” raises one.",
      "Opening an order records a delivery line by line (“Record delivery”); received stock lands on the Stock tab, which shows what is “On the shelf” and flags anything below its reorder level.",
    ] },
    fleet: { body: [
      "“Vehicles — What's due, what's expiring, and who has the van. What each one cost lives in the asset register.” A “Due or expiring” panel first — insurance, registration, service by date or by mileage with a “Due soon” badge — then a card per van with its plate, model, year and who has it (“with Léo Bouchard”).",
      "A card expands to the four expiries, odometer, VIN, cost and book value, an “Edit” button, the “Maintenance” log and “Documents”.",
    ] },
    // ── Insights ──────────────────────────────────────────────────────────
    insights: { body: [
      "“How You Compare — Your average quote pricing vs. the anonymized platform average, by service category.” One row per category with the number of quotes in the region this quarter, “Your average”, “Platform average” and the difference as a percentage. Opt-in, aggregates only — a competitor never sees a company's prices.",
      "This page is also the hub for the rest of the group: “Weekly digests”, “Financial statements”, “Won and lost”, “Estimate accuracy” and “KPI dashboard” are the links under the title.",
    ] },
    kpis: { body: [
      "“KPI dashboard — Sales, profit, execution and cash, in one place.” Period buttons (“This month”, “Last month”, “This quarter”, “Year to date”, “Last year”), then the sections: Sales (win rate, average job value, lead-to-quote conversion, backlog in weeks), Money flow (income, expenses, remaining, by day), Business costs, Profit (gross and net margin, labour cost), Execution (on-time completion, labour utilisation, estimate accuracy), Quality, Cash (receivables by age, overdue) and Customer.",
      "A card with no data says why rather than showing a zero, and a final “Not tracked” section names the two metrics FieldQuo refuses to invent. Requires job costing to be on for the person looking.",
    ] },
    settings: { body: [
      "“Settings” opens the Settings menu and lands on Company Settings. The menu is eight groups — Account, Business, Team & scheduling, Services & pricing, Documents & templates, Messaging & alerts, Getting paid, Client-facing — closed by default so it reads as an index, with the group you are in opened.",
      "Every row is walked below. A “Search” box at the top of the menu finds a row by typing its name.",
    ] },
    // ── Settings: Account ─────────────────────────────────────────────────
    "settings-account-billing": { body: [
      "The same screen as “Plan” in the main sidebar, reached from the Settings menu: the plan card with status, price, seats, crew logins and next billing date; “Manage billing & payment method”, “See what my clients paid me”, “Cancel plan”; and the four plans with “Choose plan”.",
      "Owner and administrators only — a Manager does not see this row.",
    ] },
    "settings-refer": { body: [
      "The same “Refer & Earn” page as in the main sidebar: the company's referral link, share and invite, the months earned and the businesses referred.",
      "One free month each, for the referrer and the referred, once the referred company is paying.",
    ] },
    "settings-migration": { body: [
      "“Data Migration” — the paid service where FieldQuo brings a company's old data in. The request card shows what they said they are bringing (QuickBooks, Jobber…), its status (“Quote ready”), FieldQuo's price with its note, and “Accept” / “Decline”; below, “Documents” with “Upload a file” for the exports.",
      "FieldQuo staff create new clients and quotes inside the account, never touch anything that already exists, and every write is logged. The price is paid through FieldQuo billing, not through the contractor's Stripe.",
    ] },
    "settings-product-updates": { body: [
      "“Product Updates — What's new in FieldQuo.” A dated changelog, each entry with “Read the full update”. Nothing to configure; it is where a contractor sees what changed since last month.",
    ] },
    // ── Settings: Business ────────────────────────────────────────────────
    "settings-company": { body: [
      "“Company Settings — Your business details, hours, taxes, and regional preferences.” Cards top to bottom: “Scope of work and terms” (the default process text every new quote starts with, and “Payment terms”), “Payment schedule” (50% “Deposit to book”, 50% “Balance on installation”, “Save schedule”), “Industry & Quote Types”, “Company Details” with the address, “Opening hours”, “Booking availability” and “Tax Settings” (GST, QST, GST + QST, “Create tax rate”).",
      "This is the first screen after signup, and the one the sidebar's Settings row lands on.",
    ] },
    "settings-branding": { body: [
      "“Branding — Your logo and brand color appear on every quote, invoice, and email your clients see.” A “Logo” card with “Upload logo”, “Brand Colors” with “Primary” and “Secondary”, and “How your documents will look”, previewing a quote in Light and Dark.",
      "One colour drives every client-facing surface; the contrast is computed, so a yellow or a mid-grey still prints legibly.",
    ] },
    "settings-language": { body: [
      "“Language” — “Your language”, one row per language with its interface coverage (“Interface 100%”), under a “Match company default” option; and a “Company default” card below.",
      "The owner picks what they read the app in; the company default covers teammates and clients who never chose. A document keeps the language it was created in.",
    ] },
    "settings-activity": { body: [
      "“Activity Log” — the company's audit trail: quote created, sent, followed up, accepted; invoice sent and chased; job scheduled; member invited; pricing updated; client added — each with who did it, their role and when.",
      "Read-only, owner and administrators only. It is the answer to “who changed this?”.",
    ] },
    // ── Settings: Team & scheduling ───────────────────────────────────────
    "settings-team": { body: [
      "The same “Manage Team” screen as “Your team” in the main sidebar: the seat panel, the roster with each person's access level, “Add User”, and the pending invites.",
      "See “Roles and access” for what each level in the dropdown means.",
    ] },
    "settings-availability": { body: [
      "“Your hours” — a “Whose hours” picker, then “Working hours” (the shift, for scheduling and timesheets) and “Bookable hours” (the window the public booking page offers), with a sticky “Save hours”.",
      "The two are deliberately separate, and both are per person: a company's opening hours live on Company Settings, so an estimator's day off never publishes as the shop being closed.",
    ] },
    "settings-leave": { body: [
      "“Time off policies” — “Policies” with “Add policy”: for example “Vacation — Fixed days per year · 15 days/year · carryover 5 days” and an auto-approved “Sick leave”, each with “Edit”; and a “Year end” card that carries last year's balances into this one.",
      "Owner and administrators only; the balances show on each person's Time off screen.",
    ] },
    "settings-booking-page": { body: [
      "“Booking Page” — the embed snippet (“Put your booking calendar on your website”, “Copy code”), “How long is a visit?” with the meeting modes (“Visit their place”, “Phone call”), travel buffer, arrival window and default length, “Changes & cancellations” (notice hours, fee refund), then one card per event type — “Kitchen design consultation” 60 min free, “Measurement visit” 45 min with a fee and a promo price.",
      "“New Event Type” adds a kind of appointment a homeowner can self-book.",
    ] },
    "settings-work-areas": { body: [
      "“Work Areas” — named zones or projects (Laval, Montréal island, Montréal North Shore), each with a chip per team member; a filled chip means that person is assigned. “New work area name” adds one.",
      "Used to group jobs and tasks by territory; assignment is owner, admin or supervisor only.",
    ] },
    // ── Settings: Services & pricing ──────────────────────────────────────
    "settings-products": { body: [
      "“Products & Services” — the price book: a table of name, description and type (“Service” / “Product”), each item tagged with the quote types it can appear on, with edit and delete, search, “Add Item” and a CSV import.",
      "A line on a quote is picked from here, so the price a homeowner sees is the one the owner set.",
    ] },
    "settings-services": { body: [
      "“Services & Pricing” — one card per quote type with an on/off checkbox: the company's own (“Custom”) types with their intake fields and rate-per-unit boxes, and the trade's built-in ones (“Cabinet Refinishing”, priced “Per door” / “Per drawer front”, with “Homeowners can get an instant price for this” and a collapsible “Rate card”). “What the quote says” under each is the wording the client reads.",
      "“Add custom quote type” and “Show other trades' services” are the two buttons. Rates never leave this screen — the public endpoints return services and intake fields, not prices.",
    ] },
    "settings-material-costs": { body: [
      "“Material Costs” — “When to ask about revising your costing” (a threshold, “Save”), then a recipe per service (“Cabinet Refinishing”, marked “Custom” with “Reset to defaults”): primer and top coats, coverage, price per gallon, hardener, setup hours and consumables.",
      "These feed the internal Cost & Margin estimate on a quote; they are never shown to a client. Shown only for trades that price this way.",
    ] },
    "settings-cabinet-rates": { body: [
      "“Cabinet pricing” — “How you price a cabinet” (“Per linear foot” or “Material cost-plus”), “Rates per linear foot” (base, wall/upper, tall/pantry, island, drawer surcharge, closet casework, vanity, and whether install is included), then “Material multipliers”.",
      "The kitchen designer prices from these on the server. Shown only for cabinet trades.",
    ] },
    "settings-overhead": { body: [
      "“Overhead” — “Your minimum price”: jobs per week, and tiles for monthly fixed costs, jobs per month, cost per job and the minimum price a job must fetch to cover the shop; “Paid hours that never reached a job” (unabsorbed labour per worker); then the registers — Fixed costs, Salaries, Debt, “Assets & depreciation”, and “Bills due” with outstanding, out this month and overdue.",
      "The number a contractor most wants and least often has. Requires job costing.",
    ] },
    "settings-custom-fields": { body: [
      "“Custom Fields” — fields defined per record type (quote fields such as door style, finish, hardware finish, with type and required flag).",
      "The page itself says “Coming soon” for showing them on records: the fields are defined here but do not yet appear on a quote. Do not promise that they do.",
    ] },
    // ── Settings: Documents & templates ───────────────────────────────────
    "settings-quote-email": { body: [
      "“Quote Email — What the email carrying your quotes contains, beyond the quote itself.” A card lists what the email always carries, then “References” — past clients who agreed to take a call, with “Include on every new quote” — and a before-and-after photo section.",
      "The contractor adds names and numbers, uploads pairs of photos and toggles what goes out. The email itself is sent in the quote's language, from the company's own name.",
    ] },
    "settings-email-templates": { body: [
      "“Email Templates — Customize the emails your clients get.” Grouped Automated / Marketing / Custom, one row per template with an “Active” badge, a button to make it the active one, edit, duplicate and delete; “+ New Template” and “Add default templates” to seed a starter set.",
    ] },
    "settings-pdf-templates": { body: [
      "“PDF Templates — The layout of the quote and invoice PDFs your clients receive.” Two cards, Quote PDF and Invoice PDF, each listing its layouts with a section count and an Active badge; “+ New” creates another layout to edit.",
      "Invoices mirror quotes on purpose: the same sections, in the same order, so the homeowner recognises the second document as the first one's twin.",
    ] },
    "settings-translations": { body: [
      "“Translations — The wording clients see on quotes and invoices written in another language.” A language picker, a counter of what is still missing, and per-service English / Français columns with “Mark reviewed”; “Draft the missing ones” fills the gaps with AI drafts for a person to review.",
      "This is how a Quebec shop quotes in French and English from one price book. Nothing is machine-translated at send time.",
    ] },
    "settings-checklists": { body: [
      "“Checklists — Standard steps your crew works through on site.” The company's own lists with their phase badge (On the job / Before you leave), step count and service, with Edit; “Starter checklists for your trades” offers templates with “Use this”.",
    ] },
    "settings-job-photo-tags": { body: [
      "“Job photo tags — Your own words for what's happening in a photo.” An ordered list of tags with colour swatches, up / down and “Retire”, an “Add a tag” form with a colour picker, and a block of starter tags.",
      "The crew picks a tag when they text a photo in; the tag is what the office filters by later.",
    ] },
    // ── Settings: Messaging & alerts ──────────────────────────────────────
    "settings-messages": { body: [
      "“Client messages — The texts your clients get.” One editor per SMS type — On my way, Appointment reminder — with token chips, a “Your client sees:” preview, “Save” and “Use default”.",
      "Two kinds of text and no more; do not promise other automated texts from this screen.",
    ] },
    "settings-follow-ups": { body: [
      "“Follow-ups — Automatically send a template a set time after a quote, invoice, or job hits a certain state.” A read-only “How these run” flow (Trigger → Wait → Send email → Stops) drawn from the rules below, where each rule has “Pause” and delete; “+ New Rule” opens the trigger / delay / template form.",
      "A quote unanswered for three days, an invoice seven days overdue: the two rules every shop should have on.",
    ] },
    "settings-notifications": { body: [
      "“Notifications — When FieldQuo should email you about something happening in your account.” Cards for a large quote created (with the threshold), an invoice paid, appointment reminders (off, or 2 / 24 / 48 hours before) and browser notifications.",
      "Owner and administrators only.",
    ] },
    "settings-email-domain": { body: [
      "“Email Domain — Send client emails from your own domain instead of ours.” The domain with its “Verified” status and “Disconnect”, the “Sender address” editor (quotes@…), and where replies go.",
      "This is the white-label promise made literal: the homeowner's inbox shows the contractor's domain in the From line, not FieldQuo's.",
    ] },
    // ── Settings: Getting paid ────────────────────────────────────────────
    "settings-payments": { body: [
      "“Payments — Connect Stripe so your clients can pay invoices online, directly to your bank account.” “Stripe connected · Active” with “Manage in Stripe” and “Disconnect”, then the account: its id with Copy, the sign-in email, what Stripe has switched on (charges, payouts) and what it is still waiting for.",
      "Stripe Connect, in the contractor's name: the money goes to their bank, and FieldQuo never holds it. Owner and administrators only.",
    ] },
    "settings-meta-ads": { body: [
      "“Meta Ads” — the connected ad account with “Sync now”, “Disconnect” and a link to the campaigns; “Facebook lead forms” with a switch per form, lead counts and campaigns; “Facebook & Instagram publishing” and the WhatsApp Business card with its number and templates.",
      "One connection feeds three things: ad spend into KPIs, lead forms into Leads, and Page / Instagram / WhatsApp messages into Messages.",
    ] },
    "settings-expense-tracking": { body: [
      "The same “Expense Tracking” screen as “Expenses” in the main sidebar: the month's cards, the burn breakdown, the trend, the recent receipts and the bookkeeping export.",
    ] },
    "settings-ai-credit": { body: [
      "“AI credit — Everything that spends AI credit, in one place.” The phone credit balance with “Add phone credit” and “Where the credit went”; the AI image credit balance with top-ups; and the monthly “AI credit plan” card.",
      "Phone minutes and AI images are metered against credit the company buys; FieldQuo AI and the copilot are included in every plan.",
    ] },
    "settings-payroll": { body: [
      "“Payroll settings” — “When you pay” (frequency, the day the period closes, payday, the current and last period), then the deduction and earning components: statutory tax bands, percentages and fixed allowances, each with “Turn off” and delete, plus regional statutory templates to seed from.",
      "Owner and administrators only; this is what Payroll calculates from.",
    ] },
    // ── Settings: Client-facing ───────────────────────────────────────────
    "settings-website": { body: [
      "“Your website” — the builder: the site address with a “Live” badge, “Open”, “Save” and “Update”; a conversation pane where the contractor types a brief (“Make it bolder”, “lead with reviews”, “shorter page”), Layout and Style pickers, “Fine-tune”, and a Preview / Sections pane with desktop and mobile toggles.",
      "The model writes sentences only; the layout, the services and the testimonials come from the company's own data, so a site is never invented. Free sites carry a small “Site by FieldQuo” footer.",
    ] },
    "settings-instant-quotes": { body: [
      "“Instant Quotes — Let homeowners get a real starting estimate from your website in seconds.” A live count (“2 live on your instant-estimate link”, “See what homeowners see”), an embed snippet with “Copy code”, then a card per trade with an On switch, a “What the homeowner sees” visibility choice, and the rate fields.",
      "Every instant estimate lands in Estimate Reviews before it can be sent; the public page never shows the rate card.",
    ] },
    "settings-lead-form": { body: [
      "“Share your links — Put these anywhere you already are.” Cards for Request a quote, Book a visit, the instant estimate and each published funnel, each with the link, “Copy link”, “Open” and an embed snippet.",
    ] },
    "settings-bio-link": { body: [
      "“Bio link — One page for the single link Instagram and TikTok allow.” “Your link” with Copy / Open and “Page is live”, a heading and one line under it, “Follow us” handles, the ordered link switches, and a phone-frame “Preview” with a light / dark toggle and “Save”.",
    ] },
    "settings-voice": { body: [
      "“Phone receptionist — Answers the calls you can't, takes the details, and books visits against your real availability.” The number with “It's answering — turn off”; Credit (balance, minutes, top-ups, “Automatic top-up is on”); “Your number”; the greeting, knowledge, voice and tuning cards; quote callbacks; the crew inbox switch; and “Check it end to end”.",
      "A local number in the contractor's area, answering in the caller's language, booking against the calendar the office sees. The call log is the Receptionist screen in the main sidebar.",
    ] },
    "settings-ai-employee": { body: [
      "“AI employee — An assistant that answers a customer's message for you.” “What job does it do?” (Sales closer, Receptionist, Tech support, or something else, with what it can and cannot do), “How it writes” (name, tone, opening line, instructions), the material it reads, and the drafts waiting for review.",
      "It drafts; a person sends. The drafts appear in Messages.",
    ] },
    "settings-reviews": { body: [
      "“Reviews — Ask customers for a review automatically once their job is finished.” “Your review link” with Save, an “Ask automatically” toggle, “When to ask” delay chips, a queue summary, and “Reviews on your website” listing testimonials with show / hide switches and a paste import.",
    ] },
  },
};

// ══ Roles and access ══════════════════════════════════════════════════════
//
// The five people a contractor can create, and what each one sees. The two
// tables in this chapter are NOT written here — the builder executes
// lib/permissions/nav.js and lib/permissions/settingsAccess.js against each
// preset's real grid (lib/permissions.js PERMISSION_PRESETS), the same code
// that hides a sidebar row from that person, so a cell changes when the
// product does. The prose here explains what the tables mean.
export const ROLES_CHAPTER = {
  heading: "Roles and access — who sees what",
  intro: [
    "A contractor adds a person from Manage Team, and picks one of five access levels: Crew, Estimator, Dispatcher, Manager, or the owner's own level. The first four are presets — a filled-in grid of eleven permission areas and three switches — and the owner can change any dial afterwards, which turns the preset into “Custom”. The tables below are computed from the product's own permission code on the day this guide was built, so they say what the sidebar actually does.",
    "Two things to get right on a call. First, a Crew login is not a seat: a person whose access is at or below the Crew level costs nothing and does not count against the plan's full seats — that is what the “Crew logins” column of the plans table means. Estimator, Dispatcher, Manager and the owner are full seats. Second, hiding a row is not the security: every API the product exposes checks the same grid again on the server, so a person who types a URL they were not shown gets a refusal, not the page.",
    "There is a sixth choice in the dropdown, “Make administrator”, which grants everything the owner has except ownership itself. It exists for a business partner or a bookkeeper who must see billing. Do not suggest it for staff.",
  ],
  tierNote: "{tier} tier",
  productSays: "The product's own description:",
  roles: [
    {
      key: "worker",
      body: [
        "The person in the van. They see their own schedule and mark it complete, clock in and out, log their own expenses and time, report a safety incident, and read the notes on the jobs they are assigned to — client name and address, nothing more. No prices anywhere, no quotes, no invoices, no requests. Jobs are view-only and only the ones they are on.",
        "This is the level to put installers and helpers on. It is free, and it is the reason the crew can use the same product as the office without the office worrying about what the crew can see.",
      ],
    },
    {
      key: "estimator",
      body: [
        "Writes quotes and manages clients, with prices. They can create and edit requests and quotes, see and edit full client records, read all notes, and see (not edit) jobs and invoices. Their own schedule, time and expenses only. No people management, no payroll beyond their own payslips, no job costing.",
        "For a salesperson or a second estimator who should be able to price and send, but not run the shop.",
      ],
    },
    {
      key: "dispatcher",
      body: [
        "Runs the schedule. Everyone's schedule is editable, everyone's time is editable, and jobs, quotes, invoices and requests can be created and edited — but not deleted. Full client records, all notes, everyone's safety incidents. Still their own expenses only, still no job costing and no payment collection.",
        "The team lead who books the crew, moves visits and keeps the week honest, without the power to remove anything.",
      ],
    },
    {
      key: "manager",
      body: [
        "Runs the day-to-day, delete included: quotes, jobs, invoices, requests and clients can all be created, edited and deleted; everyone's schedule, time and expenses; job costing on; payment collection on. What a Manager does not get is payroll (their own payslips only) and the company's billing — the plan, the card, the subscription — which stay with the owner.",
        "This is the office manager or the partner who runs operations. If a contractor asks “can I give someone everything except the money?”, this is the answer.",
      ],
    },
    {
      key: "owner",
      body: [
        "Everything, with no grid to consult: the person who signed the company up. Only an owner or administrator can open Account & Billing, Data Migration, Refer & Earn, Activity Log, Notifications, Time Off Policies, Payments and Meta Ads, run payroll, change an existing person's access, or deactivate someone. (A Manager or Dispatcher can invite people, but only at the Worker tier — Crew or Estimator — and only with dials no higher than their own.) The owner is always a full seat.",
      ],
    },
  ],
  seesHeading: "What each level sees in the menu",
  seesIntro: [
    "A green Yes means the row is in that person's sidebar; a red No means it is hidden and the page behind it refuses them. Computed by running each preset through the sidebar's own filter. Settings rows are gated twice — once by the main sidebar's rule where the row also sits there, once by the Settings menu's own — and both must pass.",
  ],
  screenCol: "Screen",
  gridHeading: "The permission grid behind each preset",
  gridIntro: [
    "The eleven areas and three switches an owner sees in the Custom access editor, with the level each preset writes. The words are the product's own, in English on every language's screen.",
  ],
  areaCol: "Area",
  toggleNames: {
    showPricing: "See prices (showPricing)",
    jobCosting: "Job costing",
    payments: "Collect payments",
  },
  yes: "Yes",
  no: "No",
  editorHeading: "The Custom access editor",
  editorBody: [
    "On Manage Team, every person has a dropdown with the same five choices as the invite screen — Crew, Estimator, Dispatcher, Manager, Administrator — plus “Custom”, which opens the grid. Picking a preset applies its tier and its permissions in one go. Custom shows the eleven areas as dropdowns and the three switches as checkboxes, starting from whatever the person has now, and a “Worker tier” / “Manager tier” chip on each preset says which tier it produces (Dispatcher and Manager share the Manager tier; Crew and Estimator share the Worker tier).",
    "A person can only hand out what they hold: when a Manager invites someone, the server clamps every dial to the Manager's own level and drops any switch the Manager does not have. Changing an existing person's access, making an administrator, and revoking access are owner-and-administrator only.",
  ],
  editorCaption: "Manage Team — the Custom access editor open on an Estimator.",
};
