// content/help/en/leads-and-quotes-2.js
//
// Part 2 of the “leads-and-quotes” category in en. Slugs assigned to this part
// (lib/help/tree.js): ai-quote-review, the-ai-deep-photo-read, upsell-add-ons, good-better-best-options, cost-and-margin-on-a-quote, the-break-even-price, send-a-quote, the-quote-pdf, quote-statuses-and-what-they-mean, quote-validity-and-expiry, quote-language, online-approval-and-signature, deposits-on-quotes.
//
// Every figure here is a capture that exists (scripts/help-figure-sources.mjs);
// every number is read from the code it describes — lib/ai/imageEconomics.js
// (the deep read's price and photo cap), lib/ai/quoteReview.js (the five-quote
// minimum for the price check), lib/quotes/validUntil.js (the 30-day default),
// lib/quotes/listRanking.js (the three-day "soon" window), lib/costing/
// quoteCosting.js (the 30% margin target) and lib/analytics/minimumPrice.js
// (the 20% target on the price floor). The review panel, the language bar and
// most of the Cost & margin rows are rendered in English on every language's
// screen today; the French and Spanish articles say so rather than inventing
// a label the catalogue does not carry.
export const ARTICLES = {
  "ai-quote-review": {
    title: "AI quote review",
    summary:
      "Before a quote goes out, FieldQuo checks what is missing, how the price sits against the quotes you have already won, and whether any line needs plainer words — and suggests, never edits.",
    updated: "2026-09-12",
    intro: [
      "A quote that goes unanswered is rarely too expensive. More often it has no expiry date, one line the client cannot judge, or nothing about what happens after they say yes. The AI quote review reads a saved quote and tells you those things before the client does.",
      "It is two halves. The checks, the price comparison and the add-on suggestions are worked out from your own data and cost nothing. The writing — plainer wording for a line, a draft of the what-happens-next section, a note on what a photo shows — is the part a model writes. If the model is unavailable, you still get the first half.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The review lives on the quote's edit page, in the **Review & optional extras** panel. It needs a saved quote — the review reads what is actually stored, not what is half-typed on the screen — which is why the builder's **Save & review** button saves a draft first and then opens it with the review already running." },
          { p: "Nothing the review says is written onto the quote for you. A clearer wording is shown beside the original for you to copy in; a suggested add-on becomes an editable row only when you press **Add**; the what-happens-next draft goes into the notes only when you press **Use this**. The quote the client receives is always the one you wrote." },
          { note: "The price comparison uses your company's own accepted and declined quotes for the same kind of work, and nothing else. It never looks at another company's prices, and yours never leave your account." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What the review shows",
        blocks: [
          { bullets: [
            "**A readiness figure out of 100**, followed by how many things are worth fixing. It is a weighted count of what is missing, not a probability of winning — a quote with nothing missing reads “Nothing obvious missing — this one's ready to send.”",
            "**The checks**, each with a severity: no expiry date, already expired, client has no email address, no line items, the whole job on one line, lines the client will not understand (“Labour — $2,400”), lines with no description under the name, nothing about what happens next, no photos, and a discount over 20%.",
            "**Price check** — in line with what you usually win at, **above your usual** or **below your usual**, against the median of your accepted quotes for the same services. It only speaks once you have at least 5 comparable accepted quotes; before that it says so and waits.",
            "**Clearer wording** — a struck-through original and a plain-language rewrite for any line a homeowner would not understand. Only lines whose name says nothing get one; a line whose scope paragraph already explains the work is left alone.",
            "**What the photos show** — appears only when the quote carries photos. The free review reads up to 4 of them at low resolution and lists things to check on site that the quote does not mention. “Nothing in the 3 photos that the quote doesn't already cover” is a real answer, and it is shown as one.",
            "**Suggested “what happens next”** — a short draft of timing, access, payment schedule and warranty, offered only when the quote has no process notes yet. Anything the model would have to guess is left in [square brackets] for you to fill in.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "How to review a quote",
        blocks: [
          { steps: [
            "Build the quote as usual. The **Nothing obvious missing** / **Worth a look** indicator in the builder runs the same completeness checks live, for free, while you type.",
            "Press **Save & review**. The quote is saved as a draft and reopened with the review running.",
            "On an existing quote, open it, press **Edit**, and press **Review this quote** in the **Review & optional extras** panel. Once a review exists the button reads **Review again**.",
            "Work down the list. Copy any rewrite you agree with into the line item, press **Add** on the extras you want to offer, and **Use this** on the what-happens-next draft if you have not written one.",
          ] },
          { figure: "live:app-quotes-new", caption: "New Quote — the builder, with Review, Save as draft and Save & send in the bar at the bottom." },
          { tip: "Reopening a quote never spends anything: the last review is stored on the quote and shown again with its **Last reviewed** time. Only pressing the button runs a new one." },
        ],
      },
      {
        id: "what-it-does-and-does-not",
        heading: "What the review does, and does not, do",
        blocks: [
          { bullets: [
            "It compares against **your own history only** — the panel says so under the price check — and needs at least 5 accepted quotes of the same kind before it will call a price high or low.",
            "It **never changes a number**. No suggested price, no rewritten total; the model is shown the prices so it can write about clarity, not do arithmetic on them.",
            "It **never states a measurement, a material or a brand from a photo**, and writing inside a photograph is treated as part of the picture, never as an instruction.",
            "Each run counts against your company's monthly FieldQuo AI allowance. If the allowance is used up, the button says so and names the day it resets, rather than returning half a review.",
            "If the model cannot be reached, the checks, the price comparison and the history-based add-ons still come back; only the writing is missing.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can run it",
        blocks: [
          { p: "Anyone whose access lets them create and edit quotes — the **Estimator**, **Dispatcher** and **Manager** levels, administrators and the owner. Someone with view-only quotes can read a stored review but cannot run a new one. Crew never see quotes at all. The review is not offered on a quote the client has already approved or declined." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Only in FieldQuo",
        blocks: [
          { p: "A review of the quote itself — what it lacks, how its price sits against the ones you won, plainer wording — is not listed on the pricing page of Jobber, Housecall Pro, ServiceTitan, Projul or QuoteIQ at any tier. FieldQuo runs it on every plan, and the checks half runs for nothing." },
        ],
      },
    ],
    faq: [
      { q: "Does the review send anything to the client?", a: "No. It reads the quote and writes suggestions for you. Sending is a separate button, and nothing the review produced reaches the client unless you copied it in." },
      { q: "Why does the price check say it has nothing to compare against?", a: "It needs at least 5 accepted quotes for the same services. Two past quotes are a coincidence, not a pattern, and a verdict built on them would be worse than silence. It gets better as you send more." },
      { q: "Where do the suggested add-ons come from?", a: "From services that appeared alongside this quote's services on your own past accepted and sent quotes, priced at the median you actually charged for them. See [[upsell-add-ons|Upsell add-ons the client can accept]]." },
    ],
  },

  "the-ai-deep-photo-read": {
    title: "The AI deep photo read",
    summary:
      "A paid, closer look at the photos on a quote — up to 8 of them at full resolution — that lists what a quick glance misses, for you to check on site.",
    updated: "2026-09-12",
    intro: [
      "Every [[ai-quote-review|AI quote review]] already glances at a quote's photos for free, at the lowest resolution the model offers. That is enough to notice a room, not a hairline crack in an MDF door or water damage at the bottom of a cabinet box. The deep photo read is the other end of that trade: you ask for it, you pay for it, and the model reads the photos at full resolution.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The **Deep photo read** card sits under the review on the quote's edit page. It runs on its own — you do not have to run the free review first — and every past read stays on the quote with its date, how many photos were read and what it cost, because each one is money already spent." },
          { table: {
            head: ["What differs", "Free check (in the review)", "Deep photo read"],
            rows: [
              ["Photos read", "Up to 4", "Up to 8"],
              ["Resolution", "Low — flat-rate", "High — full detail"],
              ["Cost", "Part of the review", "US$0.25 of AI credit per run"],
              ["What it returns", "Short notes to check on site", "Short notes to check on site, from a closer look"],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "How to run it",
        blocks: [
          { steps: [
            "Put AI credit on the account: **Settings → AI credit**, the **AI image credit** card, **Add credit**. The balance shows how many deep reads it covers.",
            "Open the quote, press **Edit**, and find the **Deep photo read** card. The pill beside the title says whether the balance covers one read.",
            "Press **Run deep read**. The read takes a few seconds; the notes appear on a dated card underneath. Press **Run again** for another pass after adding photos.",
            "Walk the notes on site. Each is hedged on purpose — “looks like”, “check” — because the model saw one angle of one moment.",
          ] },
          { figure: "live:app-settings-ai-credit", caption: "Settings → AI credit — the AI image credit card names what a deep read costs and how many the balance covers." },
          { note: "A quote with no photos refuses the read — there is nothing to look at, and nothing is charged. If the read cannot run for any other reason, the credit is refunded and the card says nothing was charged." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "What it costs",
        blocks: [
          { p: "A flat **US$0.25** per run, off the **AI image credit** balance — the same balance AI image generation draws, and deliberately not the phone balance. It is flat rather than per photo so that you are never taught to upload fewer pictures; the whole value is in seeing more of them." },
          { bullets: [
            "If the balance is short, the button opens a top-up dialog that names the price, the balance and the shortfall to the cent. Nothing is charged on the way back — you press the button again when you are ready.",
            "One-time top-ups are US$10, US$30, US$50 and US$100. A monthly plan on the same balance is cheaper per credit, and unused credit rolls over.",
            "The free check in the review is not charged and keeps running whether or not you ever buy credit.",
          ] },
        ],
      },
      {
        id: "what-it-never-does",
        heading: "What it never does",
        blocks: [
          { bullets: [
            "It never writes into the quote — not a line, not a note, not a price. The card says so under every result: “Nothing has been added to the quote.”",
            "It never states a measurement, a material or a brand from a photo. A photo does not carry a tape measure.",
            "It never reaches the client. The notes are for the estimator, and nothing on the client's page or PDF comes from them.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can run it",
        blocks: [
          { p: "Anyone who can create and edit quotes — **Estimator** and up. Buying credit needs someone who can manage the team (Dispatcher, Manager, administrator or owner), which is who the top-up offer is shown to. The card is not shown on a quote the client has already decided on unless a past read is on record." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Only in FieldQuo",
        blocks: [
          { p: "The deep read is priced per use inside the quote builder rather than sold as a plan tier, which is why it does not appear on FieldQuo's comparison tables at all. No pricing page of Jobber, Housecall Pro, ServiceTitan, Projul or QuoteIQ lists a review of a quote's own photos at any tier." },
        ],
      },
    ],
    faq: [
      { q: "Do I need to run the free review before the deep read?", a: "No. They are independent. The deep read reads the quote's services so it does not repeat what the document already says, then reads the photos." },
      { q: "Why is the price the same for two photos and eight?", a: "It is deliberately flat. A per-photo meter would push you to attach fewer pictures, which is the opposite of what the read is for. Eight is the cap the flat price is worked out against." },
      { q: "Where does the money come from?", a: "The AI image credit balance on Settings → AI credit, in US dollars. The phone receptionist's balance is separate and is never touched by a deep read." },
    ],
  },

  "upsell-add-ons": {
    title: "Upsell add-ons the client can accept",
    summary:
      "Optional extras at the bottom of the quote, each with its own price, that the client ticks on the approval page — the total updates, and the server does the pricing.",
    updated: "2026-09-12",
    intro: [
      "The cheapest revenue in the business is an extra the client adds themselves while they are already saying yes. Gutter guards on a roof, soft-close hinges on a cabinet job, the hallway when the bedrooms are being painted. FieldQuo puts those at the bottom of the quote as tick boxes with a price, and the approved total includes whatever was ticked.",
      "The client's browser only ever sends the ids of the boxes they ticked. The amounts stay on the server and are re-added there, so nobody can edit a web page into a cheaper job.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Extras are managed in the **Review & optional extras** panel on the quote's edit page, under **Offered at the bottom of the quote**. Each row is a description, a price, a one-line reason and a **Taxable** checkbox. They are saved with their own **Save extras** button, separately from the quote — the panel shows **Unsaved** until you press it." },
          { note: "On the client's page they appear under **Optional extras** with the hint “Tick anything you'd like added. The total updates as you go — nothing is charged until you approve.” Once the client has decided, the list becomes a record of what was chosen." },
        ],
      },
      {
        id: "where-they-come-from",
        heading: "Where an extra comes from",
        blocks: [
          { bullets: [
            "**Suggested from your history.** After an [[ai-quote-review|AI quote review]], the panel lists **You often sell these alongside this work** — services that appeared next to this quote's services on your own past quotes, with how often and what you usually charged. Press **Add** to turn one into a row. A service with no price history arrives with an empty price rather than an invented one.",
            "**Added by hand.** **Add one** opens a blank row. Type the extra, the price and, ideally, one sentence on why it is worth having — that sentence is what the client reads.",
            "**Marked optional in a takeoff.** In the painting takeoff, an area or substrate can be marked optional; it leaves the priced scope and reappears here as a row priced from your own rate card. Those rows are rebuilt from the takeoff every time the quote is saved, so they are shown read-only — change the room, not the row.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "How to offer extras on a quote",
        blocks: [
          { steps: [
            "Save the quote — extras need a quote that exists. Open it and press **Edit**.",
            "In **Review & optional extras**, press **Review this quote** if you want history-based suggestions, or **Add one** to write your own.",
            "Give every row a description and a price above zero. The save refuses an unpriced extra by name: “Give every optional extra a price before saving”.",
            "Untick **Taxable** only for an extra that is genuinely not taxed; everything else is taxed like the rest of the job.",
            "Press **Save extras**, then send the quote as usual.",
          ] },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "What the client sees, and what you are told",
        blocks: [
          { p: "On the approval page each extra is a tick box with its description, its reason and its price. Ticking one moves the total on the page; approving sends only the ids of the ticked boxes, and the server recomputes subtotal, tax and total from the prices it stored." },
          { bullets: [
            "The approved total, extras included, is what the invoice is raised for and what the payment schedule splits.",
            "The email to the owner and administrators says so in the subject — “… approved Q-2026-0012 — plus $340.00 in extras” — and lists what was added.",
            "Back on the quote, each chosen row carries **The client added this**, and the totals block reads **Approved with extras**.",
          ] },
        ],
      },
      {
        id: "rules",
        heading: "The rules",
        blocks: [
          { bullets: [
            "At most **8** extras on a quote. More than a handful is a second quote, not an upsell, and the cap is applied to takeoff rows too.",
            "Every extra needs a price above zero before it can be saved.",
            "Once the client has approved or declined, the list is locked: “This quote has already been accepted. Create a new quote to change what's on offer.”",
            "Extras are on the approval page and in the approved PDF. They are not lines in the quote's scope, so the AI review's line checks do not run on them.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can edit them",
        blocks: [
          { p: "Anyone who can create and edit quotes — **Estimator**, **Dispatcher**, **Manager**, administrators and the owner. View-only access sees the list and cannot change it." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Only in FieldQuo",
        blocks: [
          { p: "Client-tickable extras priced from your own history are not listed on the pricing page of Housecall Pro, ServiceTitan or QuoteIQ at any tier. Jobber lists “Upsell services with optional line items” and Projul lists “Selections”; what neither lists is the suggestion — which extras this kind of job usually carries, priced at what you actually charged." },
        ],
      },
    ],
    faq: [
      { q: "Can a client change the price of an extra?", a: "No. The page only sends which boxes were ticked. Every amount is re-read from the server's own rows when the approval arrives, so editing the page changes what they see and nothing else." },
      { q: "Why is one row greyed out?", a: "It came from a takeoff — an area marked optional. It is rebuilt from the scope every time the quote is saved, so editing it here would be undone on the next save. Change it in the takeoff." },
      { q: "Are the standard add-ons in my price book the same thing?", a: "No. The price book's add-on products (handles, soft-close hinges and so on) are ordinary lines you add to the quote's scope. Extras are the optional, client-tickable rows at the bottom. See [[lines-from-your-price-book|Lines from your price book]]." },
    ],
  },

  "good-better-best-options": {
    title: "Good, better, best options",
    summary:
      "Three linked quotes at three prices for one job. The pricing and the numbering exist behind the scenes; the screen to build a trio does not yet — so today you build the three yourself.",
    updated: "2026-09-12",
    intro: [
      "Offering one job at three price points — a basic, a recommended and a premium version — is a well-known way to move the conversation from “yes or no” to “which one”. FieldQuo has the groundwork for it, and this page is honest about how much of it you can reach today.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Behind the scenes, FieldQuo can create three linked quotes at once — Good, Better and Best — sharing one group and numbered as a set: **Q-2026-0012-G**, **-B** and **-T**. Each is a full, independent quote with its own lines and total, so editing Better never touches Good or Best." },
          { warning: "The pricing behind it is built and the three quotes can be produced behind the scenes, but there is no screen for it yet — so today you would be building all three yourself. Ask us before you buy on this one." },
        ],
      },
      {
        id: "what-exists-today",
        heading: "What exists today",
        blocks: [
          { bullets: [
            "The three-quote numbering (**-G**, **-B**, **-T** after the quote number) and the link between the three, on the server.",
            "No button in the quote builder or the Quotes list creates a trio, and no screen shows the three side by side. The Quotes list shows each as an ordinary quote.",
            "The client's approval page shows one quote. There is no page where a client picks between three.",
          ] },
        ],
      },
      {
        id: "package-tiers",
        heading: "Not the same thing: package tiers on one quote",
        blocks: [
          { p: "For trades that sell a menu rather than a measurement — junk removal by load size, auto detailing as Bronze, Silver, Gold and Platinum, chimney sweep by inspection level — the builder shows a tier selector inside the service. Picking one creates that service's single line. That is one quote with a package chosen by you, not three quotes the client chooses between." },
        ],
      },
      {
        id: "what-to-do-instead",
        heading: "What to do instead",
        blocks: [
          { steps: [
            "Build the recommended version as the quote, and put the upgrades at the bottom as [[upsell-add-ons|optional extras]] the client can tick — that gives you “better” and “best” on one page, with the server pricing them.",
            "If you need a genuinely cheaper alternative, build a second quote for the same client and say in the notes which is which. Both appear on the client's record.",
            "Do not promise a client a three-way choice page. It does not exist yet.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Will there be a screen for this?", a: "It is on the list, and the numbering and the link between the three are already built so the screen can land on top of them. There is no date. Ask before you buy on this one." },
      { q: "Can I show three prices on one quote today?", a: "The closest is one quote with optional extras: the base price is “good”, and the ticked extras take it to “better” or “best”. See Upsell add-ons the client can accept." },
    ],
  },

  "cost-and-margin-on-a-quote": {
    title: "Cost and margin on a quote",
    summary:
      "What the job costs you — labour, materials, overhead — and what is left, worked out beside the price while you quote. Internal, and never shown to the client.",
    updated: "2026-09-12",
    intro: [
      "A quote screen shows a price. The **Cost & margin** panel shows what that price costs you to deliver and what is left over, and it says in its own heading what it is: “internal — never shown to the client”. It is the difference between quoting a job and knowing whether you want it.",
      "Materials come from recipes — what a litre of primer costs you and how much of it a 24-door kitchen eats — labour from hours at the rate you pay, overhead from what you told FieldQuo you spend each month. The margin badge is the point: green, amber or red before you press Send.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The panel sits in the quote builder under the services, and again on the quote page as **Cost & margin** with **Cost it now** and **Change the costing**. It is measured against a **30%** margin target. What you enter is saved with the quote, so reopening it later shows the margin you actually quoted at rather than a fresh guess." },
          { note: "It only ever appears to people with the **Job costing** switch on their access level. Turn a laptop round to show a client the price and this panel is not on the page they see; it is not on the PDF, the email or the approval page either." },
        ],
      },
      {
        id: "on-the-quote",
        heading: "What is on the panel",
        blocks: [
          { bullets: [
            "**Crew — hours are shared between them.** Add people by name or from your team; each has a cost per hour and, optionally, their own hours. Left blank, the hours a recipe predicts are shared evenly. A worker with no rate on file joins at $0 and the badge says “labour not costed”.",
            "**Overhead** — either **% of price** (the 10% starting figure, labelled “estimated”) or **this job's share**, once [[the-break-even-price|Settings → Overhead]] knows your monthly costs and your jobs per week.",
            "**Extra labour hours** — hours beyond what the recipe predicts, charged at the crew's rate.",
            "**Extra material cost** — what you are buying in for this job: a supplier quote, a slab, a rental.",
            "**Materials**, **Labour**, **Overhead**, **Estimated cost**, **Quote price (pre-tax)** and **Estimated profit** with the margin percentage. Material lines from a recipe show their quantity and unit price, both editable for this job.",
            "A note on where the overhead figure came from, and a note when some of the quote's services have no recipe — then their cost is not in the figure and the panel says so.",
          ] },
        ],
      },
      {
        id: "margin-badge",
        heading: "What the badge means",
        blocks: [
          { table: {
            head: ["Badge", "Meaning"],
            rows: [
              ["Green — “32% margin”", "Profit is at or above the 30% target, with every crew member costed."],
              ["Amber — “below 30% target”, “labour not costed”, “some labour not costed”", "Profit is positive but under target, or a cost is missing — a crew member without a rate, or no crew at all — so the real margin is lower than the number."],
              ["Red — “losing money”", "The estimated cost is above the price."],
            ],
          } },
        ],
      },
      {
        id: "material-costs-settings",
        heading: "Your own material costs",
        blocks: [
          { p: "Recipes start from FieldQuo's numbers and are meant to be replaced with yours. **Settings → Material Costs** holds one card per recipe trade — **Cabinet Refinishing** and **Exterior Painting** today — with coats, coverage, price per gallon, hardener, setup hours and consumables. A card marked **Custom** carries your figures; **Reset to defaults** throws them away, and asks first." },
          { steps: [
            "Open **Settings → Material Costs**. The screen only shows a trade you have switched on in **Settings → Services & Pricing**; otherwise it says so.",
            "Change the numbers you know — your primer price, your top-coat coverage, your setup hours — and leave the rest at the default.",
            "Press **Save**. Every quote costed from then on uses your figures; quotes already costed keep the figures they were saved with.",
            "Set **When to ask about revising your costing** — the percentage over estimate at which a completed job's close-out asks whether to update these rates from what it really cost. A job that came in under never asks.",
          ] },
          { figure: "harness:settings-material-costs", caption: "Settings → Material Costs — the revision threshold, then the Cabinet Refinishing recipe with coats, coverage and price per gallon." },
          { tip: "A material line with no price makes the margin an understatement, and the panel says so. Type the price beside the line for this job, or set it on the rate card in Settings → Services & Pricing to keep it." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The panel, the quote page's cost section, **Settings → Material Costs** and **Settings → Overhead** are all gated on the **Job costing** switch. Among the presets only **Manager**, administrators and the owner have it; an **Estimator** or **Dispatcher** quotes without ever seeing a cost. The owner can grant the switch to anyone in the Custom access editor." },
        ],
      },
    ],
    faq: [
      { q: "Why does the margin look too good?", a: "Usually because a cost is missing. Nobody on the crew means labour costs nothing; a material line with no price is counted at zero; a service with no recipe is left out entirely. The panel names each case in words — read the amber badge and the notes under the table." },
      { q: "Where does the overhead number come from?", a: "Until you fill in Settings → Overhead and your jobs per week, it is a flat 10% of the price and is labelled estimated. After that, it is your real monthly fixed costs divided by your monthly job capacity." },
      { q: "Does the client ever see any of this?", a: "No. Not on the approval page, not on the PDF, not in the email. The heading says so, and the API that builds those documents never reads the costing." },
    ],
  },

  "the-break-even-price": {
    title: "The break-even price",
    summary:
      "The lowest price a job can go out at and still cover the business — your real monthly overhead divided by how many jobs you can take on — and where that figure shows up on a quote.",
    updated: "2026-09-12",
    intro: [
      "Every contractor has a number they have never been able to work out: below what price does a job lose me money before a single hour is worked? FieldQuo works it out from your own fixed costs, salaries, debt and equipment, and shows it on **Settings → Overhead** as **Your minimum price**.",
      "It is not a rule of thumb and it is not an industry average. It is your rent, your truck and your office wage, divided by the jobs you said you can do in a week.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Settings → Overhead** is two things: the registers where your monthly costs live, and the card at the top that turns them into a price floor. The floor refuses to exist until you tell it how many jobs a week you can take on — “Without it there's nothing to divide your overhead by” — because a floor built on an invented capacity is an invented number." },
          { p: "The same cost per job feeds the [[cost-and-margin-on-a-quote|Cost & margin]] panel on every quote, replacing the flat 10% guess with your real overhead share." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Your minimum price** — the **Jobs per week** box, **Save**, then four tiles: **Monthly fixed costs**, **Jobs / month**, **Cost per job** and **Minimum price**, with a line saying what the total includes and the target margin it assumes.",
            "**Paid hours that never reached a job** — the week you guarantee people against the hours they actually logged on jobs, last 30 days. Reported, and deliberately **not** counted in the price above; the box says so.",
            "**Fixed costs** — rent, insurance, phone, subscriptions: anything that arrives whether or not you win a job, monthly or yearly.",
            "**Salaries** — business overhead only: your own draw, an office wage. Not the crew, whose hours are already charged to each job as labour.",
            "**Debt** — loans and finance agreements with a principal, a monthly payment and an interest rate.",
            "**Assets & depreciation** — the truck, the trailer, the spray rig: what it cost, what it is worth at trade-in, how many months it will last, and which loan paid for it.",
            "**Bills due** — outstanding, due this month and overdue, with **Mark paid**.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "How to get your number",
        blocks: [
          { steps: [
            "Open **Settings → Overhead** and fill the registers: fixed costs, salaries, any debt, any asset worth more than a few hundred dollars.",
            "Link an asset to the loan that paid for it. The loan then counts as interest only and the asset's depreciation carries its cost — otherwise the same truck is charged twice, and the screen warns you when it sees that pattern.",
            "Type **Jobs per week** — a normal week for your crew — and press **Save**.",
            "Read **Minimum price**. Anything quoted below it does not cover the shop before materials and labour are even counted.",
          ] },
          { figure: "harness:settings-overhead", caption: "Settings → Overhead — Your minimum price with its four tiles, and the note explaining what the total includes." },
          { note: "The tiles read **Cost per job** as the overhead a job has to carry, and **Minimum price** as that cost at a **20%** target margin. Materials and labour for the specific job are on top — the note under the tiles says so." },
        ],
      },
      {
        id: "the-arithmetic",
        heading: "The arithmetic",
        blocks: [
          { table: {
            head: ["Figure", "How it is worked out"],
            rows: [
              ["Monthly fixed costs", "Fixed costs + salaries + debt, plus depreciation on your assets and interest on their loans. A loan linked to an asset counts as interest only."],
              ["Jobs / month", "Jobs per week × 4.33."],
              ["Cost per job", "Monthly fixed costs ÷ jobs per month."],
              ["Minimum price", "Cost per job ÷ (1 − 20%)."],
            ],
          } },
        ],
      },
      {
        id: "where-it-shows-up",
        heading: "Where it shows up",
        blocks: [
          { bullets: [
            "On every quote's **Cost & margin** panel as **Overhead (this job's share)**, with a note: “Overhead is $15,629.90/month of fixed costs spread across 6.5 jobs a month.”",
            "On **Settings → Expense Tracking**, where **Monthly burn rate** is the cash version of the same registers — cash and cost differ when a loan repays capital, and the Overhead screen says so when they do.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "**Settings → Overhead** needs the **Job costing** switch and the ability to manage the team: **Manager**, administrators and the owner by default. The figures are also refused to anyone without that switch when a quote asks for them, so an Estimator's builder simply keeps the 10% estimate." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Only in FieldQuo",
        blocks: [
          { p: "A price floor worked out from your own overhead is not listed on the pricing page of Jobber, ServiceTitan or QuoteIQ at any tier. Housecall Pro's “Flat-rate pricing” and Projul's “Construction Financials, Job Costing & Budgeting” are counted as covering it, generously; neither describes a per-job overhead floor." },
        ],
      },
    ],
    faq: [
      { q: "Why is the minimum price blank?", a: "Jobs per week is not set. The screen refuses to divide your overhead by a number it invented. Type a normal week's capacity and press Save." },
      { q: "Should my crew's wages go under Salaries?", a: "No. Crew hours are charged to each job as labour in the Cost & margin panel; putting them here as well counts them twice. Salaries is for fixed overhead pay — your own draw, an office wage, a bookkeeper's hours." },
      { q: "Is the 20% margin adjustable?", a: "Not on the screen today. The minimum price is shown at a 20% target margin and says so under the tiles. The Cost & margin panel on a quote measures against a separate 30% target." },
    ],
  },

  "send-a-quote": {
    title: "Send a quote",
    summary:
      "One button emails the quote from your company's name, in the client's language, with the PDF attached and an approval link — and records that it went.",
    updated: "2026-09-12",
    intro: [
      "Sending is one button, and it does exactly one thing: it emails the client. The status changes to **Sent** only after the email service has accepted the message, so **Emailed 3 July** on a quote is a fact, not an intention.",
      "The email carries the substance of the quote — the total, the approve button, what is included, how the work runs — because a homeowner reads three quotes side by side in the same inbox, and a bare link loses to a letter.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A quote can be sent from two places: **Save & send** at the bottom of the builder, which saves and sends in one go, and **Send** on the quote's own page, which becomes **Send again** once it has gone out. Both ask **Send this quote?** first — “They'll get it by email straight away. You can't unsend it.” Both use the same route, so they cannot drift apart." },
        ],
      },
      {
        id: "how-to",
        heading: "How to send",
        blocks: [
          { steps: [
            "Make sure the client has an email address on their record. Without one the send refuses and says whose address is missing.",
            "Open the quote and press **Send** — or, in the builder, **Save & send**.",
            "Confirm in the **Send this quote?** dialog. The recipient is named on it.",
            "Read the green banner: **Sent to** and the address. The **Emailed** row underneath keeps the date and address from then on.",
            "If the client says they never got it, press **Send again**. To nudge them later, press **Follow up** — a shorter email with the same link, counted separately.",
          ] },
          { figure: "live:app-quotes-new", caption: "New Quote — Save & send in the bar at the bottom saves the draft and emails it in one step." },
          { note: "Sending needs a plan on the account. During the free trial you can build and price quotes freely; the outward act of emailing one is what asks you to finish signing up, and the message says so." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "What the client receives",
        blocks: [
          { bullets: [
            "An email from your company's name — from your own domain once it is verified under **Settings → Email Domain**, otherwise from FieldQuo's sender carrying your name — with replies going to your company email.",
            "Subject **“Your quote from Easy Roofers Inc. — Q-2026-0012”**, the total, an approve button directly under it, then what is included, how the work runs and the expiry date. The approve button repeats at the bottom. See [[the-quote-email|The quote email]].",
            "The quote PDF attached, in your colours — see [[the-quote-pdf|The quote PDF]].",
            "A link to the approval page, where they read, tick any extras, sign and approve — see [[the-quote-approval-page|The quote approval page]] and [[online-approval-and-signature|Online approval and signature]].",
          ] },
        ],
      },
      {
        id: "before-it-will-send",
        heading: "Why a send is refused",
        blocks: [
          { bullets: [
            "**The client has no email address.** Add one on their record, then send.",
            "**An instant estimate has not been approved.** Confirm the price in Estimate Reviews first — nothing an algorithm priced reaches a homeowner without a person pressing Approve.",
            "**The quote was entered as a past job.** Nothing is ever sent for imported history, and the Send button is not shown on those.",
            "**A section of the email is switched on with nothing in it** — references or before-and-after photos under **Settings → Quote Email**. Add the content or take the section off this quote.",
            "**The tax line is unresolved.** A quote that charges tax but cannot say which tax is held until you pick a rate, set the client's province, or switch tax off for this quote.",
            "**The account has no plan yet.** Finish signing up; the prompt takes you there.",
          ] },
        ],
      },
      {
        id: "after-sending",
        heading: "What changes after a send",
        blocks: [
          { bullets: [
            "A draft becomes **Sent**. A quote already sent keeps its status and gains a new **Emailed** date.",
            "The linked lead, if there is one, moves from **New** to **Contacted** on the Leads board.",
            "**Get approved**, beside Send, now shows a working client link — a draft's link stays closed — with its status and a place to record an answer given by phone.",
            "The Activity Log records who sent what to which address, and the quote starts counting in the **Quote sent, no response** group of the Quotes list until the client answers.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can send",
        blocks: [
          { p: "Anyone whose access lets them create and edit quotes — **Estimator**, **Dispatcher**, **Manager**, administrators and the owner. View-only access cannot send." },
        ],
      },
    ],
    faq: [
      { q: "Can I unsend a quote?", a: "No — the dialog says so before you confirm. You can replace the client link from Get approved, which kills the old one; any email already sent will then stop opening the quote." },
      { q: "The status says Sent but the client never got it.", a: "Press Send again on the quote page. If the send fails, FieldQuo says why — a missing address, an unverified domain — and does not mark the quote as sent." },
      { q: "Which language is the email in?", a: "The quote's own language, fixed when it was created; the client's saved language is used for anything not tied to a document. See [[quote-language|A quote keeps its language]]." },
    ],
  },

  "the-quote-pdf": {
    title: "The quote PDF",
    summary:
      "The PDF attached to every quote email carries your logo, your brand colour and your name — nothing on it says FieldQuo — and its sections can be reordered or dropped under Settings → PDF Templates.",
    updated: "2026-09-12",
    intro: [
      "Every quote goes out twice: as a web page the client approves on, and as a PDF they can save, print and hand to a spouse. The two are built from the same sections and the same measured colours, so the PDF looks like the page and both look like they came from you.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The PDF is rendered from your brand colour, worked into a measured palette so that a white, yellow or mid-grey brand still produces readable headings and a visible totals band. It uses the quote's own language for every label and date format, and the standard layout below unless you have marked a layout of your own as in use." },
          { p: "Invoices mirror quotes on purpose: the invoice PDF has the same sections in the same order, minus the signature block, so the homeowner recognises the second document as the first one's twin." },
        ],
      },
      {
        id: "sections",
        heading: "The sections, top to bottom",
        blocks: [
          { table: {
            head: ["Section", "What it prints"],
            rows: [
              ["Header", "Your logo and company name across the top."],
              ["Client details", "Who the document is for, and the job address."],
              ["Line items", "The work itself, grouped by service, with each service's scope paragraph and what is included."],
              ["Totals", "Subtotal, discount, tax and the amount owing."],
              ["How the work runs", "Numbered steps explaining what happens after they approve, written per trade."],
              ["Payment terms", "Your payment terms as percentage cards; hidden entirely if you have set none."],
              ["Notes", "Whatever was typed into the quote's notes."],
              ["Signature block", "Ruled lines for a printed signature, for clients who would rather sign than click. Quotes only."],
              ["Footer", "Contact details and terms along the bottom."],
            ],
          } },
        ],
      },
      {
        id: "how-to-change-the-layout",
        heading: "How to change the layout",
        blocks: [
          { steps: [
            "Open **Settings → PDF Templates**. Two cards: **Quote PDF** and **Invoice PDF**. An empty card means the standard layout is in use — your PDFs already work.",
            "Press **New** on the Quote PDF card, name the layout (for your reference only — clients never see the name) and choose **Start from the standard layout** or **Copy the current one**.",
            "In **Edit layout**, reorder with **Move up** and **Move down**, **Remove section**, or **Add a section**. **Preview with sample data** renders it before you commit.",
            "Save, then press **Use this** on the layout. The **Active** badge marks the one every PDF uses from now on.",
            "If none of your layouts is marked active, the screen warns that PDFs are still coming out on the standard layout.",
          ] },
          { figure: "live:app-settings-templates", caption: "Settings → PDF Templates — the Quote PDF and Invoice PDF cards, each on the standard layout." },
          { note: "Removing Header, Line items or Totals is allowed, and the editor tells you the PDF “won't look like a finished document”. A layout with no sections at all produces a blank page, and the editor says that too." },
        ],
      },
      {
        id: "where-the-pdf-goes",
        heading: "Where the PDF goes",
        blocks: [
          { bullets: [
            "Attached to the quote email as **Quote-Q-2026-0012.pdf** every time you press Send or Send again. If the PDF fails to render, the email still goes and the failure is logged for support — the client is never left waiting on a build error.",
            "Re-rendered after the client approves, with their signature, and emailed to them and to the owners as the signed copy.",
            "Not downloadable from the back office today — the quote page has no PDF button. Your copy is the attachment on the approval email; before approval, the client's copy is the one on the quote email.",
            "Never sent for a quote entered as a past job.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can change it",
        blocks: [
          { p: "**Settings → PDF Templates** is open to anyone who can manage the team: **Dispatcher**, **Manager**, administrators and the owner. An **Estimator** can send the quote and so put the PDF in a client's inbox, but cannot change its layout." },
        ],
      },
    ],
    faq: [
      { q: "Does the PDF say FieldQuo anywhere?", a: "No. Header, footer and every section are your company's. The only FieldQuo mark on any client-facing surface is the small footer on a free website, and the PDF is not one." },
      { q: "Can I change the wording of a section?", a: "Not in the PDF editor — it orders and drops sections. The scope paragraphs come from Settings → Services & Pricing (“What the quote says”), the process steps and terms from Settings → Company Settings, and the labels from the quote's language." },
      { q: "Why is the payment terms section missing from my PDF?", a: "You have not set payment terms under Settings → Company Settings. The section does not appear at all rather than inventing a schedule for you. See [[deposits-on-quotes|Deposits on quotes]]." },
    ],
  },

  "quote-statuses-and-what-they-mean": {
    title: "Quote statuses, and what each one means",
    summary:
      "Draft, Sent, Approved and Declined — what puts a quote in each, what each unlocks, and the badges that sit beside the status on the Quotes list.",
    updated: "2026-09-12",
    intro: [
      "A quote has exactly four statuses, and the chips across the top of the Quotes list count them. The badge beside a quote is a promise about what happened to it — **Sent** means an email was accepted, **Approved** means the client signed or you recorded their yes — so nothing here changes on its own.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The Quotes list opens with **All**, **Draft**, **Sent**, **Approved** and **Declined**, each with its count, then a search box and the list: number, status, client, amount and age. Quotes that were sent and never answered are promoted to the top under **Quote sent, no response**, oldest first, so the one that has waited longest is the one you see first." },
          { figure: "live:app-quotes", caption: "Quotes — the status chips with counts, then each quote with its status badge, client, age and amount." },
        ],
      },
      {
        id: "the-four-statuses",
        heading: "The four statuses",
        blocks: [
          { table: {
            head: ["Status", "What it means", "How a quote gets there"],
            rows: [
              ["Draft", "Being written. The client link is closed — a client cannot open a quote you are still working on.", "Every new quote. An instant estimate stays a draft while it waits in Estimate Reviews and after it is approved there, until you send it."],
              ["Sent", "Emailed to the client and waiting for an answer. The approval page is open.", "Pressing Send, once the email service accepts the message. Also recorded by hand when a quote went out some other way."],
              ["Approved", "The client agreed, at the approved total including any extras. A job and a draft invoice exist.", "The client signs on the approval page, or you press They approved it under Get approved."],
              ["Declined", "The client said no, with their reason if they gave one.", "The client presses Decline on the approval page, or you press They declined and record why."],
            ],
          } },
        ],
      },
      {
        id: "badges-beside-the-status",
        heading: "Badges that sit beside the status",
        blocks: [
          { bullets: [
            "**Needs review** — an instant estimate a homeowner priced on your website, waiting in Estimate Reviews. It cannot be sent until someone confirms the price.",
            "**Approved — ready to send** — that estimate after the price was confirmed. Still a draft; approval there is your company confirming the price, not the client accepting.",
            "**Quote sent, no response** — the group heading over sent quotes with no answer, with each one's age and its **Valid until** date.",
            "**Expired** in red, or **Valid until** in amber within 3 days of the date — only on sent quotes, because an expiry on an approved quote is history.",
          ] },
        ],
      },
      {
        id: "changing-a-status-by-hand",
        heading: "Recording an answer by hand",
        blocks: [
          { p: "Most quotes in the trade are approved on the phone or in a kitchen, not by a click. If the only path to Approved ran through the client's page, your pipeline numbers would be wrong." },
          { steps: [
            "Open the quote and press **Get approved**.",
            "Under **Record their answer**, press **They approved it** or **They declined** — the latter asks “Did they say why? (optional)” and records the reason for your win/loss reporting.",
            "A hand-recorded approval does everything a signed one does — job, draft invoice, payment schedule, lead marked won — except store a signature.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can change a status",
        blocks: [
          { p: "Sending and recording an answer need create-and-edit access to quotes: **Estimator** and up. Deleting a quote needs the delete level — **Manager**, administrators and the owner — and a quote that has become an invoice cannot be deleted at all; void the invoice or mark the quote declined instead." },
        ],
      },
    ],
    faq: [
      { q: "Why is there no Expired status?", a: "Expiry is a date on the quote, not a status. A sent quote past its date shows Expired in red on the list and refuses approval on the client's page, but it stays Sent so you can push the date out and it opens again. See [[quote-validity-and-expiry|How long a quote stays valid]]." },
      { q: "Can I edit a quote that is Approved?", a: "Its lines cannot be changed — that would rewrite what was signed. Create a new quote, or see [[edit-a-sent-quote|Edit a quote that was already sent]] for a quote that is only Sent." },
      { q: "Why does my quote say Sent with no date?", a: "It was marked sent by hand, or imported. The date under a Sent badge is written only when an email is actually accepted, so a phone acceptance carries no send date rather than a made-up one." },
    ],
  },

  "quote-validity-and-expiry": {
    title: "How long a quote stays valid",
    summary:
      "Every new quote starts with a Valid until date 30 days out; you can move or clear it. After the date the client can no longer approve online, the list flags it in red, and nothing else changes on its own.",
    updated: "2026-09-12",
    intro: [
      "A quote that never expires is a quote with no reason to answer today. It also leaves you holding a price when material costs move. So the builder opens with an expiry date already filled in — 30 days from today — and the review complains if you clear it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Valid until** sits at the top of the money card in the builder. The date is a suggestion you can see and change before anything is saved, not a value written on your behalf: the line under it reads “Starts at 30 days from today. Change it, or clear it if this quote should never expire.” Clearing it is honoured — the quote saves with no expiry — and the line changes to say the client has no reason to answer today." },
        ],
      },
      {
        id: "setting-the-date",
        heading: "Setting the date",
        blocks: [
          { steps: [
            "In the builder, find **Valid until** above **Discount** and **Tax rate**. Change the date, or clear the box for no expiry.",
            "On an existing quote, press **Edit** — the box shows “The date already on this quote” — and move it.",
            "Save. The date prints on the client's page and in the email as the expiry, and on the Quotes list as **Valid until** beside the quote's age.",
          ] },
          { figure: "live:app-quotes-new", caption: "New Quote — Valid until, pre-filled 30 days out, above Discount and Tax rate." },
          { note: "The date is stored as a calendar day. A quote written at 8pm in Toronto gets the day you see on the screen, not the day it already is in London." },
        ],
      },
      {
        id: "what-happens-when-it-passes",
        heading: "What happens when the date passes",
        blocks: [
          { bullets: [
            "The client's approval page shows **This quote has expired** and “Contact Easy Roofers Inc. for an updated price.” Approve and Decline are gone. If they press Approve in the same minute the date passes, the server refuses too.",
            "On the Quotes list the quote shows **Expired** and the date in red, with a red bar on the row. The bar also appears in the 3 days before, when **Valid until** shows in amber.",
            "The AI review reports **Already expired** as a high-severity check: “push the date out before sending.”",
            "The status stays **Sent**. Move the date forward and the approval page opens again with nothing else to redo.",
            "The email and the PDF keep printing the date they were sent with; a new send prints the new one.",
          ] },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "What FieldQuo does not do",
        blocks: [
          { bullets: [
            "It does not change the status to Expired or Declined. Expiry is a date, not a decision.",
            "It does not email the client or you when a quote expires. Automatic follow-ups run on time since sending, not on the expiry date — see [[quotes-sent-with-no-response|Quotes sent with no response]].",
            "It does not re-price anything. The price on an expired quote is the price you wrote; moving the date is your decision to stand by it.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can I change the 30-day default?", a: "Not as a company setting today. The builder pre-fills 30 days on every new quote; change the date on the quote itself." },
      { q: "A client wants to approve a quote that expired yesterday.", a: "Open the quote, press Edit, move Valid until forward, and save. The same link opens again and they can sign. Nothing else about the quote changes." },
    ],
  },

  "quote-language": {
    title: "A quote keeps its language",
    summary:
      "You pick the language a quote is written in when you create it, and it stays in that language for life — the PDF, the approval page and the covering email all follow it, and nothing is machine-translated at send time.",
    updated: "2026-09-12",
    intro: [
      "Two languages are in play and they are separate. The first is the one you work in — the app itself, set on **Settings → Language**. The second is the one the client reads: the quote, the invoice, the emails. A Gatineau shop can work in English and quote in French; a Spanish-speaking crew can send an English quote to an English-speaking client.",
      "One rule is worth stating plainly because it sounds like a limitation and is actually the reassuring part: a quote keeps the language it was created in. A signed document will always say what it said when it was signed. Nothing is re-translated behind the client's back.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Eight languages are available for a client: English, French, Spanish, Ukrainian, Punjabi, Tagalog, German and Italian. Each has a hand-written set of document labels, a covering-email text and a PDF font that can set it. The language is chosen once per quote, in the builder, and the edit page then reads: “Written in Français. A quote keeps the language it was created in — the signed copy has to keep saying what it said.”" },
          { note: "Your own service wording is yours to translate. **Settings → Translations** shows each service's scope text per language, a count of what is still missing, and **Draft the missing ones**, which writes AI drafts for a person to review — nothing is machine-translated at the moment a quote is sent." },
        ],
      },
      {
        id: "choosing-the-language",
        heading: "Choosing the language on a quote",
        blocks: [
          { steps: [
            "In the builder, pick the client. The **Write this quote in** bar appears with their saved language pre-selected — or the company default if they have none.",
            "Change it if this quote should differ. The client's preference is a suggestion, not a lock — you may be quoting a Punjabi-speaking homeowner's English-speaking son — but the bar shows the mismatch and offers **Use that instead**.",
            "Read any warning: “3 of your 12 services don't have Français wording yet — those line items will come out in English.” Fix it under **Settings → Translations** before sending, or accept it.",
            "Save. From here on the language is fixed; the edit page states it and offers no way to change it.",
          ] },
          { figure: "live:app-settings-translations", caption: "Settings → Translations — the language picker, the missing count and the per-service columns with Mark reviewed." },
          { tip: "Set each client's language once on their record and every quote for them starts in it. See [[a-clients-language|A client's language]]." },
        ],
      },
      {
        id: "what-follows-the-language",
        heading: "What follows the quote's language",
        blocks: [
          { bullets: [
            "**The approval page** — every label, the date and money formats (“9,9 %” in French), the approve and decline buttons, the signature consent line.",
            "**The PDF** — labels, dates, currency formatting and the per-trade scope text in that language where you have written it.",
            "**The covering email** and every follow-up for that quote — subject, greeting and body. A French quote never arrives wrapped in an English note, because that would imply a translation that does not exist.",
            "**The invoice that mirrors it** and its own emails, which inherit the quote's language.",
            "**The line items derived at save time** — a cabinet upgrade added by the takeoff is written in the quote's language, not the estimator's.",
          ] },
        ],
      },
      {
        id: "the-order-of-precedence",
        heading: "Which language wins",
        blocks: [
          { table: {
            head: ["Priority", "Source", "Used for"],
            rows: [
              ["1", "The document's own language, fixed at creation", "The quote, its PDF, its approval page, its covering email and follow-ups"],
              ["2", "The client's saved language", "Anything not tied to a document — a booking confirmation, a payment reminder"],
              ["3", "The company default under Settings → Language", "A client with no saved language"],
              ["4", "English", "When nothing above is set"],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can set it",
        blocks: [
          { p: "Anyone who can create a quote picks its language. **Settings → Translations** and the company default under **Settings → Language** need someone who can manage the team: **Dispatcher**, **Manager**, administrators and the owner." },
        ],
      },
    ],
    faq: [
      { q: "The client changed their mind — can I switch a quote to French?", a: "Not the same quote: its language is fixed so the signed copy cannot drift. Create a new quote for them in French. Their client record's language can be changed at any time and will apply to the next quote." },
      { q: "What if a service has no French wording?", a: "The bar warns you before you save. The line comes out in your company's default language until you add the French under Settings → Translations. Nothing is machine-translated at send time." },
      { q: "Does the app switch language too?", a: "No. The quote's language is for the client. Your own screen follows Settings → Language for you, and each team member can have their own." },
    ],
  },

  "online-approval-and-signature": {
    title: "Online approval and signature",
    summary:
      "The client opens the link on their phone, reads, ticks any extras, types their name, draws a signature and approves — and FieldQuo stores the signature with a fingerprint of exactly what they agreed to.",
    updated: "2026-09-12",
    intro: [
      "No printing, no scanning, no drive across town to collect a signature. The quote email carries a link; the client reads the quote on their phone and says yes there. The approval is a two-step confirm with a signature, not a bare button — an accidental tap in bright sun should not create a contract.",
      "The signature is not decoration. It is stored with the client's name, the time, their address on the network, the browser they used and a fingerprint of the priced content they signed, so “they signed” and “we edited it afterwards” can never be confused.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The approval page is public — anyone with the link can see the quote and approve it, which is why the **Get approved** screen says to send it only to the client. It opens only once the quote is **Sent**; a draft's link stays closed. It is rendered in the quote's own language and in your brand's measured colours, so it is the same document as the PDF." },
          { p: "The link itself is minted when you first send the quote and shown under **Get approved** as **Client link**, with **Copy**, **Preview what they see** and **Replace link**. Replacing kills the old link — use it if the wrong person got a copy, knowing any email already sent will stop working." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "What the client sees",
        blocks: [
          { bullets: [
            "Your logo and name, the quote number, the **Valid until** date, and the client's name.",
            "Each service with its scope paragraph, **What's included**, the line items and the subtotal, then **What could change this price**.",
            "**Optional extras** as tick boxes, if you offered any — the total updates as they tick. See [[upsell-add-ons|Upsell add-ons the client can accept]].",
            "**How the work runs**, your notes, and **Payment terms** as percentage cards when you have set a schedule.",
            "A financing panel, if your company has financing switched on.",
            "**Approve this quote** in green and **Decline** — then, on Approve, **Your full name**, a **Signature** box to draw in, the consent line “I agree that signing here is my electronic signature and approves this quote for $12,450.00”, and **Yes, approve**.",
          ] },
        ],
      },
      {
        id: "how-approval-works",
        heading: "How an approval goes through",
        blocks: [
          { steps: [
            "The client presses **Approve this quote**. The page asks **Approve this quote for $12,450.00?** and, if extras are ticked, says how much of that is extras.",
            "They type their name, draw in the signature box and tick the consent line. **Yes, approve** stays disabled until all three are there.",
            "The server checks the quote is still Sent and not expired, re-prices the ticked extras from its own rows, and refuses an approval with no name, no mark or no consent — an empty signature can never stand in for one.",
            "The signature record is stored on the quote and the status becomes **Approved**, with the approved subtotal, tax and total frozen on it.",
            "The client sees **Approved — thank you** and receives the signed PDF by email; you receive the email described below.",
          ] },
        ],
      },
      {
        id: "what-happens-after",
        heading: "What happens after",
        blocks: [
          { bullets: [
            "A **job** is created, ready to schedule, and a **draft invoice** for the approved total. If a payment schedule is on, the deposit is requested at once — see [[deposits-on-quotes|Deposits on quotes]] and [[convert-a-quote-to-a-job|What happens when a quote is approved]].",
            "The owner and administrators get an email: “Jane Doe approved Q-2026-0012” — “plus $340.00 in extras” if any were ticked — with the signed PDF attached and a link to the quote.",
            "The client gets the signed PDF with a short note in the quote's language: “Thank you for approving your quote with Easy Roofers Inc. A copy is attached for your records.”",
            "The linked lead moves to **Won**, the Activity Log records “accepted by the client — job created, ready to schedule”, and a notification fires.",
            "A **Decline** records the moment and the reason if they typed one, moves the lead to **Lost**, and emails the owner and administrators. The client's page says you have been notified and to call if it was a mistake.",
          ] },
        ],
      },
      {
        id: "the-signature-record",
        heading: "What the signature record holds",
        blocks: [
          { p: "The same evidence a paid e-signature vendor sells, without the vendor: a hash of the exact priced content at the moment of signing, plus who, when and from where." },
          { bullets: [
            "The typed name, the drawn signature as an image, and the consent tick.",
            "The time of signing, the client's network address and browser — supplied by the server, never by the page.",
            "A fingerprint of the quote number, the lines, the scope groups, the chosen extras and the totals. Any later change to those makes the fingerprint stop matching, which is how tampering is detectable.",
            "The signed PDF, re-rendered with the signature and emailed to both sides, is the copy for the file.",
          ] },
        ],
      },
      {
        id: "recording-an-answer-by-hand",
        heading: "When they approved on the phone",
        blocks: [
          { p: "A yes given in a kitchen is still a yes. **Get approved** has **Record their answer** — “If they told you over the phone or in person, log it here so the pipeline stays accurate.”" },
          { steps: [
            "Open the quote and press **Get approved**.",
            "Press **They approved it**, or **They declined** and note why.",
            "Everything a signed approval sets in motion happens — job, draft invoice, schedule, lead — but no signature is stored, and the quote shows no signature record.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Is an online signature legally binding?", a: "FieldQuo stores what a signature needs to stand up — the name, the mark, the consent line the client ticked, the time, the network address and a fingerprint of what they signed. Whether that satisfies a given contract in a given province is a question for your lawyer, not for a help page." },
      { q: "Can the client approve without signing?", a: "No. Yes, approve stays disabled until the name, the drawn mark and the consent tick are all there, and the server refuses an approval that arrives without them." },
      { q: "What if the quote changed after they signed?", a: "It cannot be edited — an approved quote's lines are locked. If it were altered in the database, the stored fingerprint would no longer match, which is the point of storing one." },
    ],
  },

  "deposits-on-quotes": {
    title: "Deposits on quotes",
    summary:
      "A deposit is a line in your payment terms that prints on every quote as a percentage card — and, with a payment schedule switched on, an invoice request that goes out by itself the moment the client approves.",
    updated: "2026-09-12",
    intro: [
      "A homeowner who has just approved a job expects to be asked for a deposit; a contractor who has to remember to ask for one often does not. FieldQuo prints your deposit on the quote so the client agrees to it when they sign, and — if you switch the payment schedule on — requests it automatically on approval.",
      "Two settings do this, and they live one above the other on **Settings → Company Settings**. The first only prints. The second prints and bills.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Under **Scope of work and terms**, the **Payment terms** box is free text read straight onto the document: “50% deposit, balance on completion — or Net 30”. Text FieldQuo can read as a schedule — two or more percentages adding up to about 100 — prints as cards on the approval page and the PDF; anything else prints as you wrote it; left blank, the section does not appear at all rather than inventing a schedule for you." },
          { note: "A deposit on a quote is not the visit fee a client pays when booking an appointment. That fee is taken on the booking page and credited against the invoice later — see [[booking-fees-and-visit-deposits|Booking fees and visit deposits]]." },
        ],
      },
      {
        id: "two-ways",
        heading: "The two ways to set it",
        blocks: [
          { table: {
            head: ["Setting", "What the client sees", "What happens on approval"],
            rows: [
              ["Payment terms (free text)", "Your words, or percentage cards if the text reads as a schedule, on the approval page and the PDF.", "A job and one draft invoice for the full approved total. Nothing is requested until you send the invoice."],
              ["Payment schedule (stages)", "The same percentage cards, generated from the stages so the document always matches what bills.", "The Deposit stage is emailed to the client at once as a request for exactly its share, with a pay link capped to that amount. Later stages fire on the job's dates."],
            ],
          } },
        ],
      },
      {
        id: "how-to-set-up",
        heading: "How to set up a deposit that bills itself",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings** and find **Payment schedule** — “Off by default; turn it on by adding a stage below.”",
            "Press **Add a stage**. Set **When** to **Deposit — when the invoice is created and sent**, name it, and give it its **Percent**.",
            "Add the rest — **Job start**, **Halfway through the job**, **Job end (completion)** — until **Total** reads 100%. The save refuses anything else: “Stages must add up to exactly 100% before they can be saved.”",
            "Press **Save schedule**. The **Payment terms** text above is rewritten from the stages and locks, so the document and the billing can never disagree.",
            "To go back to free text, press **Turn off — go back to free text**. Jobs already running keep the stages they were given.",
          ] },
          { figure: "live:app-settings-company", caption: "Settings → Company Settings — Scope of work and terms with the Payment terms box, then the Payment schedule card with Add a stage." },
          { warning: "A stage's share is worked out from the approved total, extras included, and the deposit email carries a pay link only when Stripe is connected with charges enabled. Without Stripe the request still goes out; the client pays by whatever method you record by hand." },
        ],
      },
      {
        id: "on-approval",
        heading: "What happens on approval",
        blocks: [
          { bullets: [
            "The job is created and a single draft invoice is raised for the approved total — one invoice per job, requested in stages, never one invoice per stage.",
            "Each stage becomes a row on the job with its percentage, its amount and its trigger. The deposit needs no date, so it fires immediately: an email to the client, in the quote's language, asking for that stage's amount and linking to their portal.",
            "The invoice is marked **Sent** by that first request. Stages tied to job start, halfway and completion wait for the job's dates and are recomputed when those dates move.",
            "A stage at 0% is waived rather than emailed — a $0 request is worse than none.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can set it",
        blocks: [
          { p: "**Settings → Company Settings**, including payment terms and the schedule, needs someone who can manage the team: **Dispatcher**, **Manager**, administrators and the owner. The stage rows on a job are visible to anyone who can see that job's invoice." },
        ],
      },
    ],
    faq: [
      { q: "Can I ask for a deposit before the client approves?", a: "Not from the quote. The deposit request is triggered by approval, because that is when the client has agreed to the amount. To hold a visit slot with money up front, use the booking page's visit fee instead." },
      { q: "Why does my quote show no payment section?", a: "Payment terms is blank. FieldQuo prints nothing rather than inventing a schedule. Type your terms — or add a stage — under Settings → Company Settings." },
      { q: "The client approved and no deposit email went out.", a: "Check three things: the schedule is on with a Deposit stage; the client has an email address; and the invoice was raised (a quote entered as a past job raises none). The stage row on the job says whether it is pending or requested, and a pending deposit is retried." },
    ],
  },
};
