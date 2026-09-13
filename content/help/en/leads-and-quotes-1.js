// content/help/en/leads-and-quotes-1.js
//
// Part 1 of the “leads-and-quotes” category in English (see the composer,
// leads-and-quotes.js). Slugs assigned to this part (lib/help/tree.js):
// the-leads-board, lead-scoring-hot-warm-cold, where-leads-come-from,
// the-lead-form-on-your-website, facebook-lead-forms, import-leads,
// convert-a-lead-to-a-quote, the-quotes-list, build-a-quote,
// quote-types-and-takeoffs, lines-from-your-price-book,
// group-a-quote-by-room-or-scope, photos-on-a-quote.
//
// Every sentence is read from the code: app/app/leads/page.js and
// lib/leads/* for the board, the scoring and the import; lib/meta/leadsImport.js
// for Facebook lead forms; app/app/quotes/page.js and lib/quotes/listRanking.js
// for the list; app/components/quotes/builder/* for the builder;
// app/app/settings/services and app/app/settings/products for the two
// settings screens; lib/permissions.js for who sees what. The words on the
// screen are the `en` strings of app/i18n/appMessages.js.
export const ARTICLES = {
  "the-leads-board": {
    title: "The Leads board",
    summary:
      "Every enquiry that reaches your company, on one four-column board, scored Hot, Warm or Cold, with the lead panel where you assign it, note it and turn it into a quote.",
    updated: "2026-09-12",
    intro: [
      "**Leads** is the first screen of the pipeline: the place an enquiry lands before it is anyone's client. A stranger fills in your quote form, books a visit, answers an ad, phones the receptionist, or you import a list — and a card appears here. Nothing on this screen is a quote yet; it is the queue of people to call back, ordered so the best one is on top.",
      "The board is a pipeline. A card moves left to right — **New**, **Contacted**, **Won**, **Lost** — and each card opens a panel where the real work happens: read why it scored what it did, assign it to someone, log a note, and convert it into a draft quote that carries everything the person told you.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every lead arrives already scored from what the person said — budget, timeline, urgency, how much effort they put in — so the question “who do I ring first?” has an answer on the card instead of in someone's head. The score is a transparent list of reasons, not a black box, and you can overrule it by editing the lead. See [[lead-scoring-hot-warm-cold|Lead scoring: Hot, Warm, Cold]]." },
          { p: "A lead is a record of an enquiry, not a client. The client record is created — or matched to an existing one by email, then by phone — the moment you press **Convert to quote**. Until then the person is only on this board." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "The heading reads **Leads — Enquiries from your booking page and contact forms.** Top to bottom:" },
          { bullets: [
            "**Import**, top right, opens the CSV importer — see [[import-leads|Import leads]].",
            "A search box, **Search name, email, phone…**, which also searches the message the person wrote.",
            "Four filter chips — **All**, **Hot**, **Warm**, **Cold** — each with the count of leads in that band.",
            "A sort toggle that reads **Hottest** (highest score first, then newest) or **Newest**. The board opens on Hottest.",
            "The four columns — **New**, **Contacted**, **Won**, **Lost** — each with its count. An empty column says **Nothing here**.",
            "On each card: the person's name, the temperature chip with the score (for example **Hot · 86**), the timeline and budget chips as they answered them, the service category, a photo count and a PDF-plan count, the linked quote number once one exists, the assignee's initials and the date it arrived. A **Do not call** flag appears on anyone who has opted out of calls.",
          ] },
          { figure: "harness:requests", caption: "Leads — the four columns, the Hot / Warm / Cold filters with their counts, the Hottest sort and the Import button." },
        ],
      },
      {
        id: "move-a-lead",
        heading: "How to move a lead along",
        blocks: [
          { steps: [
            "Open the lead by tapping its card, or drag it by the grip handle in its top-right corner into another column. On a phone the columns stack, so use the **Status** buttons inside the panel instead of dragging.",
            "Press **Contacted** once you have spoken to the person. Sending a quote does this for you.",
            "Press **Lost** and pick a reason — **Went with someone else**, **Price was too high**, **Timing wasn't right**, **Not a real inquiry**, **Never responded** or **Other** — then **Mark as lost**. The board refuses a move to Lost without a reason.",
            "**Won** cannot be chosen until a quote exists for the lead. Convert it first; once the client accepts the quote the lead moves to Won on its own.",
          ] },
          { note: "The reason you pick for a lost lead is what separates a real enquiry from a wrong number in your numbers later. A lead marked **Not a real inquiry** is one click from being reopened if you change your mind." },
          { warning: "A card slides back the moment the server refuses the move — a lead never sits in a column it is not really in. If you see a red banner such as “This lead has no quote yet”, nothing changed." },
        ],
      },
      {
        id: "the-lead-panel",
        heading: "The lead panel",
        blocks: [
          { p: "Tapping a card opens a panel titled **Lead**. Everything you can change is in it:" },
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["The email and phone lines", "Tap to write or call. A **Do not call** flag next to the number means the person has opted out of calls."],
              ["**Why this score**", "The reasons and the points behind them, for example “Ready to start ASAP +35”. Read-only."],
              ["**Timeline** and **Budget**", "Editable. Changing either re-scores the lead at once. An empty value reads **Not stated** when the form asked and the person skipped it, or **Nobody asked** when that channel never puts the question — the instant quote, the kitchen designer, the portal and the phone."],
              ["**Their message** and **What they told us**", "The free text and the structured answers from the form, plus any attached photos or a drawn kitchen plan."],
              ["**Owner**", "Who is looking after this lead. **Unassigned** by default; the list is your team."],
              ["**Status**", "The same four buttons as the columns. Lost asks for a reason; Won is greyed out until a quote exists."],
              ["**Convert to quote** / **View quote Q-…**", "Creates a draft quote from the lead and opens it in the builder, or opens the quote that already exists. See [[convert-a-lead-to-a-quote|Convert a lead to a quote]]."],
              ["**Notes**", "Internal notes with the author and date. **Add** saves one; they never reach the client."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Leads are the **Requests** area of the access grid. The screen needs at least **View only** on Requests; moving a card, editing the qualifiers, assigning an owner or importing needs **View, create, and edit**. Converting to a quote also needs **View, create, and edit** on Quotes." },
          { bullets: [
            "**Crew** — no access. The row is not in their sidebar and the API refuses them.",
            "**Estimator** and **Dispatcher** — view, create and edit, so they can work the board and convert leads.",
            "**Manager**, **Administrator** and the owner — everything, delete included.",
            "A member whose Clients access is **name and address only** sees the board with the email, phone and budget hidden, and the panel says **Hidden by your access level**.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Why can I not drag a lead straight to Won?", a: "Won means a client said yes to a priced quote, and a lead with no quote has nothing behind it. Convert it first; once a quote exists you can move the card by hand, and when the client accepts online it moves on its own." },
      { q: "Where did the lead's email go?", a: "Your access level on Clients is “name and address only”, so the server removes the email, phone and stated budget before the board is sent to you. Ask an owner or administrator if you need them." },
      { q: "Does marking a lead Contacted send anything?", a: "No. It records that you spoke to the person. Nothing is emailed or texted by any status button on this board — though marking a lead Contacted does stop a **New enquiry, nobody replied** follow-up rule, if you run one. See [[follow-up-rules|Follow-up rules]]." },
      { q: "Can the receptionist's callers appear here?", a: "Yes. A call the phone receptionist takes creates a lead with the caller's details and is scored without a budget, because the receptionist may never discuss money. See [[the-phone-receptionist|The phone receptionist]]." },
    ],
  },

  "lead-scoring-hot-warm-cold": {
    title: "Lead scoring: Hot, Warm, Cold",
    summary:
      "How FieldQuo scores every lead out of 100 from what the person told you, why the reasons are printed on the lead, and what changes the score.",
    updated: "2026-09-12",
    intro: [
      "Every lead on the board carries a score out of 100 and a band — **Hot**, **Warm** or **Cold** — worked out the moment it arrives. The scoring is a transparent set of rules, not a model: each point added has a reason in plain words, and the reasons are printed on the lead under **Why this score** so you can see why one enquiry outranks another and overrule it if you disagree.",
      "The weights encode what predicts a won trade job, in order: when they want it done, how much they expect to spend, whether it is an emergency, whether you can reach them, and how much effort they put into the enquiry.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The score is computed from the lead's own fields — timeline, budget band, emergency flags in the structured answers, phone, email, attached photos or plans, a drawn kitchen layout, and the length of the message. It runs the same way for every source, so a lead from your website, a Facebook ad, the receptionist or a CSV import is measured by one ruler." },
          { p: "It is re-computed whenever you edit the **Timeline** or **Budget** on the lead panel, so a phone conversation that establishes a budget moves the lead at once." },
        ],
      },
      {
        id: "how-points-are-earned",
        heading: "How points are earned",
        blocks: [
          { table: {
            head: ["Signal", "Points", "The reason printed on the lead"],
            rows: [
              ["Timeline: **ASAP** / **Within 2 weeks** / **1–3 months** / **Exploring**", "35 / 25 / 12 / 2", "“Ready to start ASAP”, “Wants to start within 2 weeks”, “Planning within 1–3 months”, “Just exploring for now”"],
              ["Budget: **$15k+** / **$5k–$15k** / **$1k–$5k** / **Under $1k** / **Not sure**", "30 / 22 / 14 / 6 / 0", "“Budget $15k+” … “Budget not stated” (shown at 0 so its absence is visible)"],
              ["An emergency flag in the intake answers (plumbing, HVAC, storm damage)", "20", "“Flagged as an emergency”"],
              ["A phone number", "8", "“Phone number provided”"],
              ["An email address", "4", "“Email provided”"],
              ["Photos or a video attached", "4 each, up to 10", "“2 photos attached”"],
              ["A PDF plan attached, or a kitchen drawn in the designer", "12 for a plan, 8 for a drawn layout", "“Sent a plan (1 PDF)”, “Designed a kitchen layout”"],
              ["A message of 120 characters or more", "5", "“Wrote a detailed description”"],
            ],
          } },
          { p: "The points are summed and capped at 100. A photo is worth something because someone pointed a phone at a wall; a PDF plan is worth more because someone has already been through a kitchen planner and produced a document, which is a decided project, not browsing." },
        ],
      },
      {
        id: "the-three-bands",
        heading: "The three bands",
        blocks: [
          { bullets: [
            "**Hot** — 60 or more. An ASAP job with any real budget, or an emergency, lands here.",
            "**Warm** — 30 to 59. A budgeted but unhurried enquiry, or an ASAP one with nothing else behind it.",
            "**Cold** — under 30. Little stated, little attached. Still a lead; just not the first call.",
          ] },
          { note: "The bands are thresholds on the score and nothing else. Nothing is sent, hidden or deleted because a lead is Cold — the board's **Hottest** sort simply puts it lower." },
        ],
      },
      {
        id: "when-a-question-was-never-asked",
        heading: "When a question was never asked",
        blocks: [
          { p: "Absence of an answer is not an answer. The phone receptionist is forbidden to discuss money, so a phone lead can never have a budget. Rather than lose 30 points it could never earn, the budget comes out of the denominator: a phone lead is scored out of 70 and scaled to 100, and the lead says so with the line **Scored without budget — the phone can't ask**." },
          { p: "The lead panel makes the same distinction on screen. An empty Timeline or Budget reads **Not stated** when the form put the question and the person skipped it — a self-quote visitor who skipped the budget really did decline — and **Nobody asked** when that channel has no such question: the instant quote never asks a timeline, and the kitchen designer, the client portal and the AI employee ask neither." },
          { tip: "A **Nobody asked** lead is usually the one to phone with the question. Pick the answer in the panel and the score updates on the spot." },
        ],
      },
      {
        id: "rescoring",
        heading: "How to re-score a lead",
        blocks: [
          { steps: [
            "Open the lead from the board.",
            "Change **Timeline** or **Budget** to what the person told you.",
            "The score, the band and the **Why this score** list update as soon as the change saves; the card on the board moves with it.",
          ] },
          { p: "Nothing else re-scores a lead. Adding a note, assigning an owner or changing the status leaves the score as it is." },
        ],
      },
    ],
    faq: [
      { q: "Can I change the weights?", a: "No. The points and the thresholds are the same for every company and are not a setting. What you can change is the lead's own answers, which re-scores it." },
      { q: "Why is an imported lead Cold?", a: "A CSV rarely carries a budget or a timeline in a form the importer can recognise, so the lead scores on how reachable it is — a phone number and an email are worth 12 points together. Open it and pick the timeline and budget once you know them." },
      { q: "Does the score decide anything by itself?", a: "No. It orders the board when the sort is on Hottest and it is passed to your notification so a hot lead can be weighted. It never sends, prices or discards anything." },
    ],
  },

  "where-leads-come-from": {
    title: "Where leads come from",
    summary:
      "The ten ways an enquiry reaches your Leads board — your forms, your links, your ads, the receptionist and imports — and what every one of them has in common.",
    updated: "2026-09-12",
    intro: [
      "Every way a stranger can reach your company ends on the same board. Whatever the channel — a form on your website, a Facebook ad, a phone call the receptionist took, a list you bought — the enquiry is created by the same function, scored by the same rules and announced to the same people. This article lists the channels and what each one carries with it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The lead panel shows the source under the person's name, next to the date. Knowing the source tells you what to expect on the card: a self-quote lead has a service, answers and often photos; a phone lead has an address and a description but no budget; a Facebook lead has whatever questions you put on that form." },
        ],
      },
      {
        id: "the-sources",
        heading: "The sources",
        blocks: [
          { table: {
            head: ["Channel", "How it reaches you", "What the lead carries"],
            rows: [
              ["**Request a quote** form", "The link and embed from **Settings → Share your links**. See [[the-lead-form-on-your-website|The lead form on your website]].", "Service, the intake answers for it, budget, timeline, description, photos or a PDF plan, address, contact details, the language they chose."],
              ["Kitchen designer", "The homeowner draws a kitchen on your public designer.", "The drawn layout, an address and notes. No budget or timeline question — the panel reads **Nobody asked**."],
              ["Instant estimate", "Your instant-estimate link; the estimate also lands in **Quote reviews** as a draft to approve.", "Size, material, the range they saw, their budget. No timeline question."],
              ["Lead funnel", "A published funnel from **Funnels**, shared on an ad or embedded.", "The funnel's own questions, what was shown to them, and any media."],
              ["Client portal", "An existing client asks for more work from their portal.", "A category and a message, linked to the client."],
              ["Phone receptionist", "The AI receptionist takes a call you could not.", "Name, address, the job described, urgency mapped to a timeline. Scored without a budget."],
              ["AI employee", "A Facebook, Instagram or WhatsApp conversation the AI employee handled and booked a callback for.", "The conversation's details, linked back to the thread in **Messages**."],
              ["Facebook lead form", "A form attached to one of your Meta ads. See [[facebook-lead-forms|Facebook lead forms]].", "Meta's standard fields plus every custom question, verbatim."],
              ["Plain lead form", "The lighter form built for embedding: name, email or phone, a category and a message.", "Contact details, category and message."],
              ["CSV import", "**Import** on the Leads board. See [[import-leads|Import leads]].", "Whatever the file had: name, email, phone, address, notes, budget and timeline where recognisable."],
            ],
          } },
        ],
      },
      {
        id: "what-happens-next",
        heading: "What every source shares",
        blocks: [
          { bullets: [
            "The lead is scored on arrival by the same rules — see [[lead-scoring-hot-warm-cold|Lead scoring: Hot, Warm, Cold]].",
            "A **lead.created** notification goes to whoever your notification rules name, carrying the person's name and the temperature. See [[notifications-for-you|Notifications for you]].",
            "When the person left a phone number on one of your own forms, their consent to be called is recorded, which is what allows the receptionist to ring them back if you have turned that on. A Facebook lead form does not record consent, because the person never saw FieldQuo's wording.",
            "The email address is checked before it is stored: an address that cannot be delivered to is refused on the form rather than saved, so a quote later does not bounce.",
            "The language the person chose on your form is kept on the lead and becomes the language of the quote you convert it into.",
          ] },
          { note: "A lead is created even if the notification fails. Capturing the enquiry always comes first." },
        ],
      },
      {
        id: "your-links",
        heading: "Where the links live",
        blocks: [
          { p: "**Settings → Share your links** holds the three public links — **Request a quote**, **Book a visit**, **Instant estimate** — and one card per published funnel, each with **Copy link**, **Open** and an embed snippet." },
          { figure: "live:app-settings-lead-form", caption: "Settings → Share your links — the Request a quote, Book a visit and Instant estimate cards, each with its link and embed snippet." },
          { tip: "A booking is not a lead. Someone who books a visit from **Book a visit** gets an appointment on your calendar, not a card on this board, because they have already decided." },
        ],
      },
    ],
    faq: [
      { q: "Do Facebook Page or Instagram messages become leads?", a: "Not on their own. A conversation lives in Messages; it becomes a lead when the AI employee books a callback from it, or when you open the lead the thread is linked to." },
      { q: "Can I add a lead by hand?", a: "There is no New lead button. Import a one-row CSV, or create the client and start the quote directly from Quotes." },
      { q: "Do all channels ask the same questions?", a: "No, and the lead panel is honest about it: an empty Budget or Timeline reads Not stated when the form asked and Nobody asked when that channel has no such question." },
    ],
  },

  "the-lead-form-on-your-website": {
    title: "The lead form on your website",
    summary:
      "The Request a quote form: what it asks a homeowner, where to get the link and the embed code, and what lands on your Leads board when they press Send.",
    updated: "2026-09-12",
    intro: [
      "**Request a quote** is the public form for someone still comparing prices. They pick a service, answer a few questions about the job, say what they expect to spend and when, attach photos, and leave their details. What comes back is a scored lead on your board — not an email in an inbox, and never a price.",
      "You share it as a plain link or paste it into your own website. Both come from **Settings → Share your links**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The form produces a lead, not a quote. It shows no rates and the endpoint behind it returns none: a self-serve figure you have never seen is one you might have to honour, and a published rate card is a gift to every competitor in town. What the form does instead is arrive at the callback with the size of the job already known." },
          { p: "It is a page of your own: your logo and name at the top, your brand colour on the rule, the confirmation laid out like your quote. In the embedded version the logo strip is dropped, because the form already sits under your site's own header." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the settings screen",
        blocks: [
          { p: "**Settings → Share your links** reads **Put these anywhere you already are — your website, Google listing, Facebook page, email signature, or the side of the van.** The **Request a quote** card is the first one:" },
          { bullets: [
            "**They describe the job and leave their details. Lands in your Leads pipeline. Best for people still comparing prices.**",
            "The link itself, with **Copy link** and **Open**.",
            "**Or paste this into your own website** — the embed snippet, with **Copy**.",
            "The footer of the screen says it plainly: **The quote form only offers the services you've enabled under Settings → Services, and never shows your prices.**",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Settings → Share your links — the Request a quote card with its link, Copy link, Open and the embed snippet." },
        ],
      },
      {
        id: "put-it-on-your-site",
        heading: "How to put it on your site",
        blocks: [
          { steps: [
            "Open **Settings → Share your links**.",
            "On the **Request a quote** card, press **Copy link** to share the page on its own — in an ad, on Google, in a text message.",
            "To embed it, press **Copy** under **Or paste this into your own website** and paste the snippet where you want the form to appear.",
            "The snippet includes a small script that lets the form report its height, so it grows with the page instead of scrolling inside a box. If your website builder strips scripts, the form still shows at a fixed 640 pixels.",
            "Press **Open** to try it as a homeowner would.",
          ] },
          { note: "The same screen carries **Book a visit**, **Instant estimate** and every published funnel. Embedding is covered in full in [[embed-booking-and-quote-forms|Embed booking and quote forms on any site]]." },
        ],
      },
      {
        id: "what-the-form-asks",
        heading: "What the form asks",
        blocks: [
          { p: "Three steps, in the order a stranger will tolerate — the service first, the contact details last:" },
          { bullets: [
            "A language picker, offering the languages your company sends in. The lead and later the quote are created in the language the person picks.",
            "**Step 1** — the service, from the quote types you have turned on under **Settings → Services & Pricing**.",
            "**Step 2** — the intake questions for that service (doors, square feet, storeys — whatever the type asks), then the two universal questions: budget band (**Not sure**, **Under $1k**, **$1k–$5k**, **$5k–$15k**, **$15k+**) and timeline (**ASAP**, **Within 2 weeks**, **1–3 months**, **Exploring**), a description, and photos, a short video or a PDF plan.",
            "**Step 3** — name, email, phone and the job address, with address autocomplete that also stores the city, province and country so tax is right when you quote.",
            "An email or a phone is required, not both. An email address that cannot receive mail is refused while the person is still on the form.",
            "The confirmation page and, if they gave an email, a confirmation email carrying your branding. It says what they asked for, never a price.",
          ] },
          { warning: "Turning a quote type off under **Settings → Services & Pricing** removes it from this form immediately. If the form shows a service you no longer offer, that is where to fix it." },
        ],
      },
      {
        id: "what-arrives",
        heading: "What arrives on your side",
        blocks: [
          { p: "The submission becomes a lead with the source **self_quote**:" },
          { bullets: [
            "Scored on arrival — a Hot / Warm / Cold band and the reasons — and notified to whoever your notification rules name.",
            "Every answer kept twice: as readable text under **Their message**, and as structured answers under **What they told us**, which is what the quote builder reads when you convert.",
            "If they left a phone number, their consent to be called is recorded, and the receptionist rings them back if you have quote callbacks turned on. See [[quote-callbacks|Quote callbacks]].",
            "**Convert to quote** creates the client (or matches an existing one by email, then by phone) and a draft quote with the service, the answers, the photos and their language already on it.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Share your links** settings row is shown to members who can manage users — **Dispatcher**, **Manager**, **Administrator** and the owner. An **Estimator** or **Crew** member does not see it in Settings. The public form itself needs no login at all." },
        ],
      },
    ],
    faq: [
      { q: "Can I change the questions?", a: "Per service, yes: a custom quote type carries the fields you pick when you create it under Settings → Services & Pricing, and a built-in type asks its own set. The budget and timeline questions are on every submission and cannot be removed." },
      { q: "Why does the form not show a price?", a: "By design. Public endpoints never return your rates. If you want a homeowner to see a starting figure, that is the Instant estimate, which lands in Quote reviews for you to confirm before anyone can send it." },
      { q: "What does the homeowner receive?", a: "A confirmation page and, with an email address, a confirmation email — both in your branding and in the language they chose. No amount is in either." },
      { q: "Is the plain lead form the same thing?", a: "No. There is also a lighter form — name, email or phone, category, message — built for embedding in your own code. It creates a lead the same way but asks no intake questions." },
    ],
  },

  "facebook-lead-forms": {
    title: "Facebook lead forms",
    summary:
      "Turn the forms attached to your Facebook and Instagram ads into leads on your board, with the campaign each one came from — and what the connection does and does not do.",
    updated: "2026-09-12",
    intro: [
      "You run an ad — “Get a free painting estimate” — and a homeowner taps it. Meta shows its own form, pre-filled with the name and email on their Facebook account, and they press Submit. That person is a lead, and **Settings → Meta Ads** is where you tell FieldQuo which of those forms to turn into one.",
      "A lead from a form you switch on appears in **Leads** like any other enquiry — scored the same way, notified to the same people — and carries the name of the campaign it came from.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "One connection feeds three things: ad spend into your marketing numbers, lead forms into Leads, and Page, Instagram and WhatsApp messages into Messages. Lead forms need the Meta ad account connected first, because the same login is what reads your Pages." },
          { p: "Meta delivers a submission two ways and FieldQuo listens to both: a webhook the moment the form is submitted, and a poll of every switched-on form at twenty past each hour. The two overlap on purpose — a webhook can be dropped — and cannot double-count, because a lead is keyed on Meta's own id." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "The **Facebook lead forms** card sits under the ad-account connection on **Settings → Meta Ads**:" },
          { bullets: [
            "**When someone fills in the form attached to one of your Facebook or Instagram ads, FieldQuo can add them as a lead.**",
            "**Last lead received …** or **No lead has been received from Meta yet.** — the one line that tells you the wiring works.",
            "One row per form found on your Pages, with **Leads: …**, the date of the last one, and an **On** / **Off** switch.",
            "**Which campaigns these leads came from** — the campaigns and how many leads each produced.",
            "**Find my lead forms** — reads your Pages again and lists any new forms.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Settings → Meta Ads — the Facebook lead forms card under the ad-account connection, before any form has been found." },
        ],
      },
      {
        id: "switch-a-form-on",
        heading: "How to switch a form on",
        blocks: [
          { steps: [
            "Open **Settings → Meta Ads** and press **Connect Meta Ads** if the card at the top says **Not connected**. See [[connect-meta-ads|Connect your Meta ad account]].",
            "Press **Find my lead forms**. Every lead form on the Pages that login can read is listed.",
            "Turn the switch on for each form whose submissions should become leads. Leave a form off and its submissions stay in Meta.",
            "Watch **Last lead received** after your next submission.",
            "Open **Leads** — the new card carries the source and the campaign.",
          ] },
          { note: "If the card shows an amber notice — **Facebook lead forms need Meta's approval of one more permission; nothing is being received yet.** — every switch is disabled and nothing is arriving. That is Meta's review of the permission, not your setup; the rest of the connection still works." },
        ],
      },
      {
        id: "how-a-lead-arrives",
        heading: "How a lead arrives",
        blocks: [
          { p: "Nothing is invented. Meta's standard fields map to the lead's columns; every custom question you wrote on the form is kept word for word under **What they told us**." },
          { bullets: [
            "Name, email and phone come from Meta's standard fields. Address, city, province, country and postal code go with them when the form asked.",
            "No budget band, no timeline and no language are set, because Meta's form does not ask them unless you wrote those questions yourself — in which case the answers are on the lead in your words, not squeezed into FieldQuo's bands. The panel reads **Not stated**.",
            "The lead is scored on what it has — a phone and an email are worth 12 points — and notified to whoever your notification rules name.",
            "A submission with no name, email or phone at all is skipped rather than put on your board as an unnameable card.",
          ] },
          { warning: "A Facebook lead form does not record consent to be called, because the person saw Meta's wording and your privacy policy, never FieldQuo's. The receptionist will not dial them automatically; a person can." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["**On** / **Off** per form", "On: the webhook and the hourly poll import that form's submissions. Off: nothing is imported from it; leads already on your board stay."],
              ["**Find my lead forms**", "Reads your Pages and adds newly created forms to the list. It does not import anything by itself."],
              ["**Disconnect** on the ad account", "Ends the connection the forms depend on. Switched-on forms stop receiving until you reconnect."],
            ],
          } },
        ],
      },
      {
        id: "cost-per-lead",
        heading: "Cost per lead",
        blocks: [
          { p: "Because a Meta lead carries its campaign id and the synced ad spend carries the same id, FieldQuo can show cost per lead per campaign for this one path. Per-campaign cost per lead covers leads that arrived through a Meta lead form. Every other channel — and a homeowner who saw the ad and phoned — is still blended across everything, because nothing links that spend to that lead. See [[marketing-spend|Marketing spend]]." },
          { tip: "Give each ad its own form. One form shared by five campaigns still attributes each lead to the campaign that produced it, but a form per ad makes the list on this card readable at a glance." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "**Meta Ads** is an owner-and-administrator screen: it holds a connection to an account that spends your money. A Manager, Dispatcher, Estimator or Crew member does not see the row, and the API refuses them." },
        ],
      },
    ],
    faq: [
      { q: "Why is every switch greyed out?", a: "The card is telling you: Facebook lead forms need Meta's approval of one more permission, and until then nothing is received. Your connection is fine; there is nothing to fix on your side." },
      { q: "A submission arrived twice on Facebook. Will I get two leads?", a: "No. A lead is keyed on Meta's own id, and both delivery paths check it. The second delivery is recorded as a duplicate and creates nothing." },
      { q: "Does the lead notify me like a website lead?", a: "Yes — the same lead.created notification, to the same people, with the same Hot / Warm / Cold weighting." },
      { q: "Can FieldQuo change my ads?", a: "No. The connection only reads spend, performance and lead forms. It never creates or edits an ad." },
    ],
  },

  "import-leads": {
    title: "Import leads",
    summary:
      "Bring a list you bought or exported from another tool onto your Leads board from a CSV, scored the same way as an inbound enquiry.",
    updated: "2026-09-12",
    intro: [
      "**Import**, top right of the Leads board, takes a CSV of leads you bought or exported elsewhere and puts each row on the board as a lead. Common columns are matched by name, budget and timeline are mapped where they can be recognised, and every row goes through the same scorer as an enquiry from your website.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen reads **Import leads — Upload a CSV of leads you bought or exported elsewhere. We'll match common columns (name, email, phone, address, notes, budget, timeline), score each one hot/warm/cold, and drop them into your pipeline.** Nothing is created until you press the import button, and you see a preview first." },
          { figure: "harness:requests", caption: "Leads — the Import button at the top right opens the CSV importer." },
        ],
      },
      {
        id: "the-file",
        heading: "The file",
        blocks: [
          { p: "A CSV with a header row. Column names are matched leniently, in any case:" },
          { table: {
            head: ["What", "Column names recognised"],
            rows: [
              ["Name", "name, Full Name, full_name, contact"],
              ["Email", "email, e-mail"],
              ["Phone", "phone, Phone Number, phone_number, mobile, tel"],
              ["Message", "message, notes, details, description, comments"],
              ["Address", "address, street, street_address, job address, site address, location — the street line only"],
              ["Budget", "budget, budget_band, price — a figure, a range or words such as “under 5k”, “$15,000+”, “not sure”"],
              ["Timeline", "timeline, urgency, when, timeframe — words such as “asap”, “next week”, “this spring”, “just looking”"],
            ],
          } },
          { note: "City and province are deliberately not read from a spreadsheet, because a jurisdiction guessed from a column drives a tax rate on a document. The address goes on as the street line; the client's city and province are set when you convert." },
        ],
      },
      {
        id: "import-the-file",
        heading: "How to import",
        blocks: [
          { steps: [
            "Open **Leads** and press **Import**.",
            "Press **Choose a CSV file** and pick the file. The page reads it in your browser and shows **Found … rows. Preview:** with the first three names and contacts.",
            "Press **Import … leads**.",
            "The result reads **Imported … leads**, and **, skipped … with no name or contact** when rows were dropped.",
            "Press **View leads** to return to the board. The new cards are sorted in with the rest.",
          ] },
          { warning: "A file of more than 2,000 rows is refused — split it. A row with no name and no usable email or phone is skipped, because a lead nobody can reach or name is noise, not a lead." },
        ],
      },
      {
        id: "what-happens-to-each-row",
        heading: "What happens to each row",
        blocks: [
          { bullets: [
            "It becomes a lead with the source **imported** and a name — or **Imported lead** when the row had none.",
            "Budget and timeline are mapped to the same bands the website form uses when the text is recognisable — “$3,000–$5,000” becomes **$1k–$5k**, “$15,000+” becomes **$15k+**, “no rush” becomes **Exploring**. When nothing is recognisable the lead simply has no band; it is not credited a budget it never stated.",
            "It is scored on what it has. A row with a phone and an email but no budget or timeline scores 12 and lands **Cold** until you open it and pick the answers.",
            "The same **lead.created** notification fires as for any enquiry, once per row.",
            "A row that fails is skipped; the rest of the file still imports.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can do it",
        blocks: [
          { p: "Importing is creating requests, so it needs **View, create, and edit** on Requests — **Estimator**, **Dispatcher**, **Manager**, **Administrator** and the owner. A member below that sees the no-access panel, and the server refuses the upload." },
        ],
      },
    ],
    faq: [
      { q: "Will it create duplicates?", a: "The importer does not check for existing leads, so importing the same file twice makes two cards per person. Duplicate clients are only avoided later, when a lead is converted and matched by email or phone." },
      { q: "Can I import clients this way?", a: "No — this makes leads. Clients have their own importer under Clients; see [[import-clients-from-a-csv|Import clients from a CSV]]." },
      { q: "Why did my budget column not map?", a: "The importer reads a figure, a range or a handful of words. A budget written as “mid-range” or “TBC” maps to nothing and the lead shows no band. Open the lead and pick it." },
    ],
  },

  "convert-a-lead-to-a-quote": {
    title: "Convert a lead to a quote",
    summary:
      "What the Convert to quote button does: the client it creates or matches, the draft quote it opens, what carries over, and why the lead is not Won yet.",
    updated: "2026-09-12",
    intro: [
      "**Convert to quote** on the lead panel turns an enquiry into a draft quote with the person's details, the service they asked for, their answers and their photos already on it, and lands you in the builder ready to price. It creates the client record at the same time — or matches one you already have.",
      "It does not make the lead Won. Drafting a quote is not winning the work; the lead follows the quote's real fate from here.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Converting is one press and it is safe to press twice: a lead already linked to a quote shows **View quote Q-…** instead, and pressing it opens that quote rather than making a second one." },
          { p: "The quote is created in **draft** with a total of zero. Nobody has priced it yet, and a number the homeowner could see that you never agreed to is exactly what the lead-versus-quote distinction exists to prevent. Your job in the builder is the price; the rest is already filled in." },
        ],
      },
      {
        id: "how-to",
        heading: "How to convert",
        blocks: [
          { steps: [
            "Open the lead on the **Leads** board.",
            "Read **Why this score**, **Their message** and **What they told us** — the answers will be on the quote's notes, but this is where you decide whether to phone first.",
            "Press **Convert to quote**. The button reads **Converting…** and the builder opens on the new draft.",
            "Add the lines and the price, then **Save as draft** or **Save & send** — see [[build-a-quote|Build a quote]] and [[send-a-quote|Send a quote]].",
          ] },
          { tip: "Convert before you phone if you want the quote number in front of you during the call. The lead card shows the number the moment it exists." },
        ],
      },
      {
        id: "what-carries-over",
        heading: "What carries over",
        blocks: [
          { table: {
            head: ["On the lead", "On the quote"],
            rows: [
              ["Name, email, phone", "The client. Matched to an existing client by email first, then by phone, so a repeat enquirer does not become a second client record."],
              ["Address, city, province, country from the form", "The client's address and tax jurisdiction — which is the difference between a quote that charges the right tax and one that silently charges none."],
              ["The service they picked", "The quote's first scope group, of that type, with no lines yet."],
              ["Budget and timeline", "Two lines at the top of the quote's **Notes**: “Budget: 5,000 – 15,000”, “Timeline: Within 2 weeks”, followed by their message."],
              ["Photos, videos, PDF plans", "The quote's **Photos & videos from the client**. See [[photos-on-a-quote|Photos on a quote]]."],
              ["The language they chose", "The quote's language, fixed at creation. A lead that was never asked falls back to your company language. See [[quote-language|A quote keeps its language]]."],
              ["The lead itself", "Linked to the quote: the card shows the quote number and the panel offers **View quote**."],
            ],
          } },
          { note: "The two lines about budget and timeline go on the quote's notes, which the client can read. Edit the notes in the builder if you would rather they did not see what they told you." },
        ],
      },
      {
        id: "the-lead-follows-the-quote",
        heading: "The lead follows the quote",
        blocks: [
          { p: "Converting leaves the lead's column where it was. From then on the lead moves with the quote:" },
          { bullets: [
            "Quote **sent** → the lead moves to **Contacted**, if it was still in **New**. A re-send never drags a won or lost lead back.",
            "Quote **accepted** → the lead moves to **Won**. This is also the moment a job is created; see [[convert-a-quote-to-a-job|What happens when a quote is approved]].",
            "Quote **declined** → the lead moves to **Lost**.",
          ] },
          { warning: "Until a quote exists, **Won** is refused on the board and in the panel, with the sentence **Won follows the quote's own outcome — convert this lead first.** A false win would sit in your win rate forever." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can do it",
        blocks: [
          { p: "Converting creates a quote, so it needs **View, create, and edit** on Quotes — **Estimator**, **Dispatcher**, **Manager**, **Administrator** and the owner. A member who can see leads but not create quotes gets a refusal from the server, shown in the panel." },
        ],
      },
    ],
    faq: [
      { q: "I converted the wrong lead. Can I undo it?", a: "Delete the draft quote from its page if your access level allows deleting quotes. The lead is unlinked when the quote goes and can be converted again. There is no undo button on the lead itself." },
      { q: "Why did converting not create a new client?", a: "Because you already had one with that email or phone. The quote is attached to the existing client, which is what you want for a repeat customer." },
      { q: "The quote opened in French but my company works in English.", a: "The person chose French on your form, and everything they have been sent since was in French. Switching the document to English at the moment it starts to matter is exactly what the rule prevents. See [[quote-language|A quote keeps its language]]." },
    ],
  },

  "the-quotes-list": {
    title: "The Quotes list",
    summary:
      "Every quote your company has written, with status chips that filter, a search box, and the quotes waiting on a client promoted to the top.",
    updated: "2026-09-12",
    intro: [
      "**Quotes** is the list of every quote — draft, sent, approved or declined — with a chip per status that filters the list, a search box, and one thing no flat list does: the quotes that were sent and never answered are lifted to the top under the heading **Quote sent, no response**, oldest first, with their expiry date beside them.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen reads **Quotes — Manage customer quotes.** The **New Quote** button opens the builder — see [[build-a-quote|Build a quote]]. Every row opens the quote's own page, where sending, editing, the AI review and the client's decision live — and **Duplicate**, which starts a fresh draft from a quote you have already written." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom:" },
          { bullets: [
            "**New Quote**, top right — shown only to members who can create quotes.",
            "Five chips with counts — **All**, **Draft**, **Sent**, **Approved**, **Declined**. Pressing one shows the rows behind the number. The counts are of quotes whose status is that right now, so **Sent** drops by one the moment a client accepts.",
            "**Search quotes...** — matches the quote number and the client's name.",
            "The **Quote sent, no response** group, when the filter is on **All** and at least one quote is waiting: those rows first, oldest send first.",
            "Everything else in the order it was created, newest first — the thing you just typed is the thing you are looking for.",
            "A first-run panel, **No quotes yet.** with **Create your first quote**, when the company has never written one; **No quotes match** when a filter or search narrows the list to nothing.",
          ] },
          { figure: "harness:quotes", caption: "Quotes — the five status chips with counts, the search box, and a sent quote promoted to the top under “Quote sent, no response”." },
        ],
      },
      {
        id: "the-order-of-the-rows",
        heading: "Why the rows are in that order",
        blocks: [
          { p: "A quote sent twelve days ago and one sent thirty-one used to look identical, and the second one expires tomorrow. The list now splits the rows into the ones somebody has to chase and everything else:" },
          { bullets: [
            "**Chase** — status **Sent**. Sorted by send date, oldest first, because the client who has waited longest is the one most likely to have forgotten. A sent quote whose expiry is within **3 days**, or already past, carries an accent bar down its left edge.",
            "**Rest** — everything not sent, newest first.",
            "A quote marked sent by hand — a price agreed on the phone, an imported document — has no send date, so the row shows no age rather than inventing one from the day it was created.",
          ] },
          { note: "The 3-day emphasis is display only. Nothing is sent or decided off it; the automated follow-up email has its own delay under **Settings → Follow-ups** — see [[quotes-sent-with-no-response|Quotes sent with no response]]." },
        ],
      },
      {
        id: "what-each-row-says",
        heading: "What each row says",
        blocks: [
          { table: {
            head: ["On the row", "Meaning"],
            rows: [
              ["**Q-1044** and a status badge", "The number and the current status — **Draft**, **Sent**, **Approved**, **Declined**, or **Expired** on a sent quote past its date."],
              ["**Needs review**", "An instant estimate a homeowner priced themselves, still to be confirmed by a person in **Quote reviews** before it can be sent. See [[estimate-reviews|Estimate Reviews]]."],
              ["**Approved — ready to send**", "An instant estimate a person has confirmed; it is a normal draft now."],
              ["The client's name", "Who it is for."],
              ["**today**, **yesterday**, **4 days ago**", "The age — from the send date on a sent quote, from creation otherwise."],
              ["**Valid until 2026-10-10** or **Expired 2026-09-01**", "The quote's own expiry, on sent quotes. A quote with no expiry shows none. See [[quote-validity-and-expiry|How long a quote stays valid]]."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The list needs at least **View only** on Quotes; **New Quote** needs **View, create, and edit**. **Crew** has no access to quotes and does not see the row. **Estimator** and **Dispatcher** can view, create and edit; **Manager**, **Administrator** and the owner can also delete. A member without the **See prices** switch sees the rows with the amounts withheld." },
        ],
      },
    ],
    faq: [
      { q: "Why does the Sent count differ from “Quotes sent this month” on the dashboard?", a: "This chip counts quotes whose status is Sent right now. The dashboard counts every quote sent in the month, including the ones since accepted or declined." },
      { q: "Where is the follow-up?", a: "The Quote sent, no response group is the queue. The reminder email itself is an automation under Settings → Follow-ups, and each quote's page shows what was sent." },
      { q: "Can I sort by amount or client?", a: "Not on this screen. Use the search box for a client; the order is fixed to what needs chasing first, then newest." },
    ],
  },

  "build-a-quote": {
    title: "Build a quote",
    summary:
      "The quote builder from top to bottom — client, assignee, language, services, lines, cost and margin, notes, photos, totals — and the three ways out of it.",
    updated: "2026-09-12",
    intro: [
      "**New Quote** opens one screen — the builder — that is also the editor of every quote you reopen. You pick the client, tap the services, fill in what each one asks, adjust the lines, and the total works itself out from your own rates. Nothing you type here reaches the client until you send it.",
      "The subtitle says it: **Build a quote from your enabled services.** The tiles you see are the quote types you have turned on under **Settings → Services & Pricing**, and the prices they fill in are yours.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A quote is a client, a language, one or more **scope groups** (one per service, each with its lines and its own subtotal), a discount, tax, an expiry date, notes, photos and a status. The builder keeps a running subtotal on every group so you can see which half of a two-service quote is the expensive one." },
          { p: "Creating and editing differ in two ways only: on a new quote you choose the client and the language; on a saved one both are fixed — the language because a document keeps the language it was created in, the client because the quote is theirs." },
        ],
      },
      {
        id: "before-you-start",
        heading: "Before you start",
        blocks: [
          { bullets: [
            "Turn on the quote types you sell and set their rates — [[quote-types-and-takeoffs|Quote types and takeoffs]]. A type that is off has no tile.",
            "Put your one-off extras in the price book — [[lines-from-your-price-book|Lines from your price book]] — so they are one tap away.",
            "Have the client's address: it drives the tax rate, and a quote with no jurisdiction shows an assumed rate with a caution under it.",
            "Priced something like it before? **Duplicate** on that quote's page opens a fresh draft under the next quote number with the same client, language, services and lines, add-on offers, costing, notes and email sections — and none of its history: no send date, signature, approval, client edits or AI review.",
          ] },
          { tip: "Coming from a lead? **Convert to quote** on the lead panel opens this screen with the client, the service, the answers and the photos already filled in. See [[convert-a-lead-to-a-quote|Convert a lead to a quote]]." },
        ],
      },
      {
        id: "the-builder-top-to-bottom",
        heading: "The builder, top to bottom",
        blocks: [
          { p: "The cards, in the order they appear:" },
          { bullets: [
            "**Client** — **Search clients…** or **Add new client** (a person or a company, with their contact person, language and address). Picking a client with a saved language sets the quote's language.",
            "**Assigned to** — **Me (default)**, or another member. Reassigning to someone else needs the assign permission; the server refuses otherwise.",
            "The language bar — the language this document will be written in, from the languages your company sends in. Chosen once; fixed after the first save. See [[quote-language|A quote keeps its language]].",
            "**Add a service — Tap one to add it to this quote. Your own pricing fills in automatically.** One tile per enabled quote type. Some trades open a list of sections to pick from — see [[group-a-quote-by-room-or-scope|Group a quote by room or scope]].",
            "One card per service you added, numbered **01**, **02** when there is more than one, with the trade's colour, a running subtotal and a remove button. Inside: the trade's form — a takeoff, a unit grid, a menu of tiers or a set of questions — then the line items: **Description**, **Qty**, **Rate**, **Amount**, **Add line item**, **Common for this trade**, and **+ Add from Products & Services…**.",
            "**Cost & margin (internal — never shown to the client)** — crew, hours, materials, overhead and the margin against the price. Shown only to members with job costing. See [[cost-and-margin-on-a-quote|Cost and margin on a quote]].",
            "**Notes** (**Anything the client should know...**) and **Photos & videos from the client** — see [[photos-on-a-quote|Photos on a quote]].",
            "The totals bar — **Valid until** (30 days from today, changeable or clearable), **Discount** as an amount or a percent, **Tax rate (%)** with **Charge tax on this quote**, then **Subtotal**, **Tax**, **Total** — and the buttons **Review**, **Save as draft**, **Save & send**. Under it, **What happens next**: the process steps the client reads at the bottom of the quote.",
          ] },
          { figure: "live:app-quotes-new", caption: "New Quote — Client, Assigned to, Add a service, Cost & margin, Notes, Photos & videos, then the totals bar with Review, Save as draft and Save & send." },
        ],
      },
      {
        id: "how-to",
        heading: "How to build one",
        blocks: [
          { steps: [
            "Press **New Quote** on the Quotes list.",
            "Pick the client, or **Add new client** and fill in name, email, phone, language and address.",
            "Check the language bar. The client's saved language is already selected; change it only if this document should be in another one.",
            "Tap a service tile. Its card appears with the trade's own form.",
            "Fill in the form — doors and drawer fronts, areas and surfaces, a load size, or the trade's questions. The lines and the subtotal appear as you type.",
            "Adjust the lines: edit a rate, add a line by hand, tap one from **Common for this trade** (a description with the price left blank for you), or pick an item from **+ Add from Products & Services…** with its price already on it.",
            "Set **Valid until**, a **Discount** if any, and check the tax line. A yellow **Assumed** note means the rate came from your own province because the client has no address on file — pick a client with an address, enter the rate, or switch tax off.",
            "Press **Save as draft**, **Save & send**, or **Review**.",
          ] },
          { note: "The builder refuses to save until a client is chosen and at least one service is on the quote: the buttons stay disabled and the banner says **Select or create a client first** or **Add at least one service to the quote**." },
        ],
      },
      {
        id: "three-ways-out",
        heading: "The three ways out",
        blocks: [
          { table: {
            head: ["Button", "What happens"],
            rows: [
              ["**Save as draft**", "The quote is saved with status **Draft** and its page opens. Nobody is emailed."],
              ["**Save & send**", "A confirmation asks **Send this quote? They'll get it by email straight away. You can't unsend it.** and names the recipient. **Save & send** saves and emails the quote, with its PDF, in the quote's language. The status becomes **Sent** only once the email is accepted. See [[send-a-quote|Send a quote]]."],
              ["**Review**", "Saves a draft first — the review reads the saved quote — then opens it with the checks already run: completeness, a price comparison against your own history, suggested add-ons and the AI's notes. See [[ai-quote-review|AI quote review]]."],
            ],
          } },
          { warning: "Saving a quote freezes its prices. A saved group's lines are edited as numbers; its takeoff is kept but not reopened, so a quote already in a client's inbox never silently reprices because a rate card moved." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can do it",
        blocks: [
          { p: "Building a quote needs **View, create, and edit** on Quotes and the **See prices** switch — **Estimator**, **Dispatcher**, **Manager**, **Administrator** and the owner. A member with quote access but without See prices is refused the builder rather than shown one priced off numbers that are not the company's. **Crew** has no quote access." },
        ],
      },
    ],
    faq: [
      { q: "Where do the prices come from?", a: "From the trade's rate card under Settings → Services & Pricing for the main scope, and from Products & Services for extras. Both are yours; FieldQuo's defaults apply only until you set your own." },
      { q: "Can I write a quote without a service tile?", a: "No — every quote has at least one scope group. If none of the built-in types fits, create a custom quote type with the fields you want under Settings → Services & Pricing." },
      { q: "Why is the language bar gone on a saved quote?", a: "A quote keeps the language it was created in, so the emailed copy and the PDF say the same thing as what was approved. Create a new quote for another language." },
      { q: "What is Notes for review?", a: "An internal box that appears only when a phone-call draft or the review put something in it. It never appears on the client's copy; clear it once you have dealt with what it says." },
    ],
  },

  "quote-types-and-takeoffs": {
    title: "Quote types and takeoffs",
    summary:
      "Settings → Services & Pricing: the quote types you turn on, the four ways a type prices — takeoff, unit grid, tiers or questions — the rate card behind each, and custom types.",
    updated: "2026-09-12",
    intro: [
      "A **quote type** is what a service tile in the builder stands for: a kind of work, the questions it asks, and the rate card it prices from. **Settings → Services & Pricing** is where you turn types on and off, set the rates, and write what the quote says about each one. The tiles on **New Quote** are exactly the types that are on here.",
      "Some types price from a **takeoff** — a structured form that measures the job and writes the lines for you. Others price per unit, from a menu of tiers, or from a short set of questions and a flat rate.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen reads **Services & Pricing — Turn on the quote types you offer and set your default rate for each. These are what show up when you create a new quote. You can still override pricing on individual quotes.** It lists the types for the industries you picked at signup; **+ Show other trades' services** opens the whole catalogue of about seventy." },
          { p: "Rates never leave this screen. The public quote form offers your enabled services and their questions, never a price; that rule is fixed." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "One card per quote type:" },
          { bullets: [
            "A checkbox — on means the type has a tile in the builder and appears on your public quote form.",
            "**Priced by** — chips naming what the type charges by (**3-tab asphalt shingles (square)**, **Per door**, **Vinyl siding (sqft of wall)**). A type quoted from a supplier's invoice has no per-unit basis and shows none.",
            "**Rate card** — a collapsible grid of your rates for the main scope, with **Reset to defaults**. A **customised** chip shows when any rate is yours rather than the default.",
            "**What the quote says** — the wording the client reads for this trade: **What this service is**, **What's included**, **How the job runs**. Leave a field empty to keep inheriting FieldQuo's default.",
            "**Homeowners can get an instant price for this** or **An instant quote is available for this — set it up** — the trade's instant estimate, linking to **Settings → Instant Quotes**.",
            "For a type with no rate card: a **Rate** box and a **per** unit, plus **Add standard items to Products & Services** where the trade ships a standard set of extras.",
          ] },
          { figure: "live:app-settings-services", caption: "Settings → Services & Pricing — one card per quote type with its checkbox, Priced by chips, Rate card and What the quote says." },
        ],
      },
      {
        id: "the-four-ways-a-type-prices",
        heading: "The four ways a type prices",
        blocks: [
          { table: {
            head: ["How it prices", "Which types", "What you fill in on the quote"],
            rows: [
              ["**Takeoff** — a measured form that writes the lines", "Interior and exterior painting, flooring, stairs, countertops, roofing, siding, gutters, insulation, paving, driveway sealing, garage doors, snow removal, home inspection", "Areas, surfaces, squares, linear feet, the items on the job. Each becomes a line with its measure in the description, priced from the rate card."],
              ["**Unit grid** — per door, per drawer front, with complexity", "Cabinet refinishing, cabinet refacing", "Counts and the door material; the complexity picked on the quote moves the rate."],
              ["**Tiers** — a menu of packages", "Junk removal (**Load Size**), auto detailing, chimney sweep", "One tier; its price is the line."],
              ["**Questions and a rate** — the intake fields and a flat or per-unit rate", "Every other type, and every custom type", "The type's questions, then lines you add by hand or from the price book."],
            ],
          } },
          { p: "Sixteen trades carry a full rate card; the rest have a single **Rate** per unit. Whatever the method, the result is the same kind of line — a description and an amount — and the client-facing page, email and PDF read only those. Production rates, formulas and sell rates stay on your side." },
        ],
      },
      {
        id: "turn-a-type-on",
        heading: "How to turn a type on and set its rates",
        blocks: [
          { steps: [
            "Open **Settings → Services & Pricing**. Use **Search services** or **+ Show other trades' services** to find the type.",
            "Tick its checkbox.",
            "Open **Rate card** and type your rates over the defaults. Every trade ships with FieldQuo's defaults so a new company can quote on day one; a rate you type wins over the default from then on.",
            "Open **What the quote says** if you want your own wording for what the service is, what is included and how the job runs.",
            "Press **Save Settings**. The tile appears on **New Quote** and the service on your public quote form.",
          ] },
          { note: "Changing a rate changes future quotes only. A saved quote keeps the prices it was written with — its lines were frozen at save so a client's copy never reprices under them." },
        ],
      },
      {
        id: "custom-quote-types",
        heading: "Custom quote types",
        blocks: [
          { p: "For work none of the built-in types describes, **+ Add custom quote type** creates your own. It says: **Name it, then pick which fields it should ask for on a quote — chosen from fields already used across FieldQuo's other quote types, so it works the same way in the quote builder right away.**" },
          { steps: [
            "Press **+ Add custom quote type** and type a name, for example **Closet Organization**.",
            "Tick the fields it should ask — search the library with **Search fields...** — or tick none: **No fields selected is fine too — it'll behave like a flat rate item with no extra form.**",
            "Press **Create quote type**. It appears in the list with a **Custom** badge, a **Rate** box and a **per** unit.",
            "Tick it on and **Save Settings**.",
          ] },
          { tip: "A custom type can carry its own **What the quote says** wording and its own price-book items, exactly like a built-in one." },
        ],
      },
      {
        id: "what-the-quote-says",
        heading: "What the quote says",
        blocks: [
          { p: "Under each enabled type, **What the quote says** holds the three paragraphs the client reads about that trade, in the language the quote is written in:" },
          { bullets: [
            "**What this service is** — one paragraph describing the scope.",
            "**What's included** — a list of lines, with **Add line** and **Remove line**.",
            "**How the job runs** — named steps with a timeline and a sentence each, with **Add step** and **Remove step**.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row is shown to members with the **See prices** switch — **Estimator** and above. Saving the settings and creating a custom type are owner-and-administrator actions; anyone else gets **Only owners/admins can change settings** from the server." },
          { warning: "Turning a type off removes it from the builder and from your public quote form at once. Quotes already written with it are untouched." },
        ],
      },
    ],
    faq: [
      { q: "Do I have to fill in the whole rate card?", a: "No. Every field has a default, and only the ones you type over change. The customised chip tells you which cards carry your own numbers." },
      { q: "Can a client see my rates?", a: "Never. The public form returns services and questions only; the takeoff, the formula and the rate card are not sent to any client-facing page." },
      { q: "What is the difference between a rate card and Products & Services?", a: "The rate card prices the main scope of a trade — per door, per square, per foot — and writes the core lines. Products & Services holds one-off extras you drop on any quote. See [[lines-from-your-price-book|Lines from your price book]]." },
      { q: "Why does my trade have no Rate card?", a: "Only sixteen trades ship a full card. The others take one Rate per unit here and price their lines by hand or from the price book." },
    ],
  },

  "lines-from-your-price-book": {
    title: "Lines from your price book",
    summary:
      "Settings → Products & Services: the items you can drop onto any quote with their price already on them, how to add and import them, and how they appear in the builder.",
    updated: "2026-09-12",
    intro: [
      "**Products & Services** is your price book: the extras and one-off items — handles, hinges, a rush fee, a disposal charge — that you drop onto a quote in one tap, with the price you set. A line picked from here is priced by you, so the number the homeowner sees is the one you decided on.",
      "It is separate from the rate card on **Settings → Services & Pricing**, which prices the main scope of a trade. The two answer different questions: a rate says what a unit of work costs; a product says what else went on the job.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen reads **Products & Services — Add and update your products & services to stay organized when creating quotes, quote templates, jobs, and invoices.** A table of **Name**, **Description** and **Type**, with search, **Add Item**, edit and delete on each row, and two cards for CSV import and export." },
          { p: "An item can be limited to certain quote types. In the builder, a service card's **+ Add from Products & Services…** menu lists only the items linked to that type — a flooring group does not offer cabinet hardware — or every item, if the item was left unlinked." },
        ],
      },
      {
        id: "rate-card-vs-price-book",
        heading: "Rate card or price book?",
        blocks: [
          { table: {
            head: ["Question", "Rate card (Services & Pricing)", "Price book (Products & Services)"],
            rows: [
              ["What it prices", "The main scope: per door, per square, per linear foot. Builds the quote's core lines from the takeoff.", "Extras and one-offs, priced individually. Added to a quote by hand."],
              ["Where it appears", "Inside the trade's form on the quote.", "In the **+ Add from Products & Services…** menu under a service's lines."],
            ],
          } },
          { p: "Several trades ship a standard set of extras. **Add standard items to Products & Services** on the type's card under Services & Pricing creates them here in one press, already linked to that type; the same upgrade can be linked to more than one trade." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom:" },
          { bullets: [
            "**Search** and **Add Item**.",
            "The table — **Name**, **Description**, **Type** (**Service** or **Product**) — with **Edit** and **Delete** on each row, paged when the list is long.",
            "**Costs** — **Record what your products and services cost you — set a Cost Price alongside the sale price when you add or edit an item above. It is kept on the item and included in the CSV export; no quote, job-costing or margin figure reads it yet.**",
            "**Import products & services** — **Import CSV** and **Download sample file**. Columns: **name, description, type, unitPrice, costPrice, unit**.",
            "**Export products & services** — **Export CSV** downloads the whole list.",
          ] },
          { figure: "live:app-settings-products", caption: "Settings → Products & Services — the table, the Costs card, and the import and export cards." },
        ],
      },
      {
        id: "add-an-item",
        heading: "How to add an item",
        blocks: [
          { steps: [
            "Open **Settings → Products & Services** and press **Add Item**.",
            "Type the **Name** and, if the client should read more, a **Description**.",
            "Choose **Service** or **Product**, and the unit — **Unit (e.g. sqft)**.",
            "Enter the **Unit price**. **Cost price** is optional and, today, informational only.",
            "Under **Available on these quote types**, tick the types this item belongs to, or tick none: **Leave all unchecked to make this available on every quote type.**",
            "Press **Add Item**. It is ready in the builder at once.",
          ] },
          { figure: "create:app-settings-products-create", caption: "Products & Services — what opens when you press Add Item: name, description, type and unit, unit price and cost price, and the quote types it is available on." },
          { note: "Deleting an item asks first: **Delete …? Its price and description are removed for good — quotes already written keep the numbers they were built with.**" },
        ],
      },
      {
        id: "use-it-on-a-quote",
        heading: "How to use it on a quote",
        blocks: [
          { steps: [
            "In the builder, add the service and open its lines.",
            "Under the lines, open **+ Add from Products & Services…**. Each item shows its name and price.",
            "Pick one. A line appears with the item's name, its description as the detail, quantity 1 and its unit price.",
            "Change the quantity or the rate on that quote if the job needs it. The item in the price book is unchanged.",
          ] },
          { p: "A line from the price book is an ordinary line once it is on the quote: the client sees a description and an amount, the same as a line you typed." },
        ],
      },
      {
        id: "import-and-export",
        heading: "Import and export",
        blocks: [
          { p: "**Import CSV** takes a file exported from Excel, Google Sheets or Numbers with the columns **name, description, type, unitPrice, costPrice, unit**; **Download sample file** gives you the shape. **Export CSV** writes the whole list back out in the same shape, so you can edit in a spreadsheet and re-import." },
          { bullets: [
            "The result reads **Imported … items.** Imported items are unlinked to any quote type — available everywhere — until you edit them.",
            "A row with no name is skipped; a type other than **product** is stored as **Service**. An item added by hand with **Add Item** also gets its description drafted into the other languages your company sends in; an imported item does not.",
            "The importer is simple: a name with a comma in it must be quoted the way the export writes it.",
          ] },
          { warning: "Importing does not replace or de-duplicate. Importing the same file twice gives you every item twice." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row and the list are shown to members with the **See prices** switch — **Estimator** and above; a price book is prices, so **Crew** is refused rather than shown a redacted one. Adding, editing, deleting and importing items are owner-and-administrator actions: anyone else gets **Only an owner or admin can change the price book.**" },
        ],
      },
    ],
    faq: [
      { q: "Does Cost price feed the margin on a quote?", a: "Not yet. The screen says so: it is kept on the item and exported, and no quote, job-costing or margin figure reads it. Cost & margin on a quote works from the materials recipes and labour under Settings → Material Costs." },
      { q: "Why is my item missing from the menu on a quote?", a: "It is linked to other quote types. Edit the item and either tick the type you are quoting or untick everything to make it available on every type." },
      { q: "Can the client see the price book?", a: "No. Only the line you add — its description and amount — reaches the client's page, email and PDF." },
      { q: "What is the difference between a Service and a Product?", a: "A label on the item, shown in the Type column and kept on the export. Both price the same way on a quote." },
    ],
  },

  "group-a-quote-by-room-or-scope": {
    title: "Group a quote by room or scope",
    summary:
      "How a quote is organised into scope groups — one per service or section — and how the painting takeoff breaks a job down by area, so the client reads it the way they think about it.",
    updated: "2026-09-12",
    intro: [
      "A homeowner does not think in line items; they think in rooms and in jobs. A quote in FieldQuo is built the same way: one **scope group** per service or section — **Interior Painting**, **Flooring**, **Drainage** — each with its own lines, its own subtotal and the trade's colour, and, inside a painting group, one area per room with the surfaces under it.",
      "The client's copy — the approval page, the email and the PDF — draws the same groups in the same order, so what you priced is what they read.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every service tile you tap on **New Quote** adds a scope group. A quote for the kitchen and the hallway is two groups if they are two trades, and one painting group with two areas if they are both paint. Which you choose is up to you; the builder keeps a subtotal on each card either way." },
          { p: "There is no free-text “room” field on a group: a group is named by its service or by the section you picked. Room-by-room detail lives inside the painting takeoff, where each area is named by you." },
        ],
      },
      {
        id: "scope-groups",
        heading: "Scope groups",
        blocks: [
          { p: "Each group is a card:" },
          { bullets: [
            "A number — **01**, **02** — shown when the quote has more than one group, and the trade's accent colour down the left edge. The same colour reaches the client's copy, so the builder and the document visibly belong to each other.",
            "The group's name and a running subtotal, shown once it is above zero.",
            "The trade's own form — a takeoff, a unit grid, a menu of tiers or a set of questions — then the line items.",
            "A remove button. A group imported from a subcontractor's quote, and every group on a quote the client has already decided, cannot be removed.",
          ] },
          { tip: "Two of the same trade on one quote is fine — tap the tile twice. A **Roofing** group for the house and another for the garage read as **01 Roofing** and **02 Roofing**, each with its own subtotal." },
        ],
      },
      {
        id: "sections-inside-a-trade",
        heading: "Sections inside a trade",
        blocks: [
          { p: "Some trades have known sub-sections, and their tile opens a list instead of adding a group at once — **Plumbing — pick a section**:" },
          { bullets: [
            "**Plumbing** offers **Groundworks**, **Drainage**, **Garage Drain**, **Waterlines**, **Tubs/Showers**, **Steamer**, **Recirc Lines**, **Gas**, **Finishing**, **Insulating**; **HVAC Installation** offers **Inslab**, **Boiler Systems**, **Quick Track**, **Supply/Return Mains**, **Main Slab Heat**, **Upper Floor Slab Heat**, **Wiring**, **Venting**. Each becomes a group named after the section.",
            "**Something else** adds a plain group named after the trade, for the case the list does not cover.",
          ] },
        ],
      },
      {
        id: "rooms-and-areas-in-painting",
        heading: "Rooms and areas in painting",
        blocks: [
          { p: "The interior and exterior painting takeoffs are organised by **area**. Each area is a room or a face of the house, with the surfaces you are painting listed under it, and each surface becomes a line the client reads as **Living room — Walls (414 sqft)**." },
          { steps: [
            "Add the painting service and press **Add an area**. Name it (the box suggests **Area 1**), pick the **Area type** and whether it is **Interior** or **Exterior**, and enter the room's measurements — length, width and ceiling height — or type a measured area.",
            "Press **Add a surface…** and pick what you are painting in that room — walls, ceiling, trim, doors. Each surface's quantity is read off the room's geometry, with **Type a quantity instead** if you measured it yourself, plus **Coats**, **Product** and any **Prep hours**.",
            "Repeat per room. **Area total**, **Man-hours**, **Labour**, **Materials** and **Paint to buy** update as you go.",
            "Tick **Optional — client can add or drop it** on an area or a surface to take it out of the total and offer it at the bottom of the quote for the client to accept — see [[upsell-add-ons|Upsell add-ons the client can accept]].",
          ] },
          { note: "A **Client note (on the quote)** on an area is printed for the client; a **Crew note (work order only)** never is. The rate formula behind each line is internal and never leaves the builder." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "What the client sees",
        blocks: [
          { p: "Every client-facing surface draws the groups the same way:" },
          { bullets: [
            "A heading per group with its name and subtotal, then its lines with a description and an amount — no rates, no formulas, no takeoff.",
            "A group with one line that only repeats the group's own name and total — a blended subcontractor cost, for example — shows the heading alone rather than saying the same thing twice.",
            "The trade's wording from **What the quote says** — what the service is, what is included, how the job runs — under the group, in the quote's language.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can I rename a group?", a: "Not by typing. A group is named by its service or by the section you picked from the tile. Use areas inside the painting takeoff for room names, or a line's description for a label the client should read." },
      { q: "Can I reorder groups?", a: "No. Groups appear in the order you added them, on your screen and on the client's copy." },
      { q: "Why does the client's copy show fewer lines than the builder?", a: "Only priced, included lines are drawn. Optional areas and surfaces are offered separately at the bottom of the quote, and a single line that merely repeats its group's heading is folded into the heading." },
    ],
  },

  "photos-on-a-quote": {
    title: "Photos on a quote",
    summary:
      "Where the photos, videos and PDF plans on a quote come from, how to add your own from the site visit, the limits, and where they do and do not show up.",
    updated: "2026-09-12",
    intro: [
      "A quote carries a set of media — **Photos & videos from the client** — that comes from two directions: what the homeowner attached to their enquiry, and what you add from the site visit. They stay on the quote, carry over to the invoice, and are read by the AI review. They are for your side of the job: the client's copy of the quote does not print them.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The card in the builder is titled **Photos & videos from the client**, with **Add photos or a video** and the hint **Pictures from the site visit. They stay on the quote and carry over to the invoice.** The same set is shown on the quote's page in the back office, and on the invoice created from the quote." },
        ],
      },
      {
        id: "where-photos-come-from",
        heading: "Where the photos come from",
        blocks: [
          { bullets: [
            "**The enquiry.** Photos, a short video or a PDF plan the homeowner attached on your quote form, the kitchen designer, a funnel or an instant estimate are on the lead, and **Convert to quote** carries them onto the quote.",
            "**A phone-call draft.** A quote drafted from a receptionist call has no media until you add some.",
            "**The site visit.** You add them in the builder, on a new quote or a saved one.",
            "**The invoice.** An invoice created from the quote inherits the set; an invoice written from scratch has its own uploader.",
          ] },
        ],
      },
      {
        id: "add-photos-yourself",
        heading: "How to add photos",
        blocks: [
          { steps: [
            "Open the quote in the builder — **New Quote**, or **Edit** on a saved quote.",
            "Scroll to **Photos & videos from the client** and press **Add photos or a video**.",
            "Pick photos, a video or a PDF from your phone or computer. Each file uploads at once and appears as a tile; a tile's cross removes it.",
            "Save the quote. The media is stored with it.",
          ] },
          { figure: "live:app-quotes-new", caption: "New Quote — the Photos & videos from the client card, with Add photos or a video, sits between Notes and the totals bar." },
          { note: "Uploads go straight from your browser to secure storage; the quote keeps a link to each file, not the file itself. A photo taken on an iPhone in its native format is accepted as it is." },
        ],
      },
      {
        id: "limits",
        heading: "Limits",
        blocks: [
          { table: {
            head: ["Kind", "Largest file", "How many"],
            rows: [
              ["Photo (any image format except SVG)", "15 MB", "Up to 12 items in the builder's uploader; the quote stores up to 20"],
              ["Video", "100 MB", "Counted in the same 12"],
              ["PDF plan", "25 MB", "Counted in the same 12"],
            ],
          } },
        ],
      },
      {
        id: "where-they-show-up",
        heading: "Where they show up",
        blocks: [
          { p: "Media on a quote is read on your side, not the client's:" },
          { bullets: [
            "The quote's page in the back office and the builder, as thumbnails that open full size.",
            "The invoice created from the quote, under the same heading.",
            "The AI review reads the photos with the quote and can tell you what they show that the lines have missed; the paid **deep photo read** goes further. See [[ai-quote-review|AI quote review]] and [[the-ai-deep-photo-read|The AI deep photo read]].",
            "The review's completeness checks note **No photos** on a quote with no picture of the job — optional, but it separates you from whoever quoted over the phone.",
          ] },
          { warning: "The client's approval page, the quote email and the PDF do not print these photos. Before-and-after photos a client should see are a different feature — see [[references-and-photos-in-the-quote-email|References and before-and-after photos in the quote email]]." },
        ],
      },
    ],
    faq: [
      { q: "Does the client see the photos I add?", a: "No. They stay on the quote for your team, the invoice and the AI review. The client's page, email and PDF do not include them." },
      { q: "Can I add photos to a sent quote?", a: "Yes — open it with Edit, add them under Photos & videos from the client and save. Adding media does not reprice or re-send the quote." },
      { q: "Where do job-site photos taken by the crew go?", a: "On the job, not the quote — see [[job-photos-and-tags|Job photos and tags]]. The quote's set is about the estimate; the job's set is about the work." },
    ],
  },
};
