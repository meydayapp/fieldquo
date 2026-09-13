// content/help/en/marketing-and-website-2.js
//
// Part 2 of the “marketing-and-website” category in English (see the
// composer, marketing-and-website.js). Slugs assigned to this part
// (lib/help/tree.js): pamphlet-routes, email-campaigns-and-subscribers,
// marketing-spend, the-marketing-designer, make-a-post-from-a-job,
// social-posting-and-scheduling, connect-meta-ads,
// ask-for-reviews-automatically, refer-another-business,
// instant-estimates-as-marketing.
//
// Every sentence is read from the page modules under app/app/marketing,
// app/app/settings/{meta-ads,reviews,refer,instant-quotes}, the routes they
// call, and lib/marketing, lib/social, lib/meta, lib/reviews, lib/referrals.
// The Meta state (publishing, lead forms, WhatsApp waiting on App Review) is
// what lib/meta/client.js's gates say on 2026-09-12; the words on the screens
// are the `en` block of app/i18n/appMessages.js.
export const ARTICLES = {
  "pamphlet-routes": {
    title: "Pamphlet and door-hanger routes",
    summary:
      "Plan a door-to-door distribution as a list of addresses, let FieldQuo order them into a route, and tick off each doorstep from a phone — with a doorstep conversation turning straight into a client and a visit.",
    updated: "2026-09-12",
    intro: [
      "A pamphlet campaign is a marketing campaign of the type **Pamphlet distribution**. You add the addresses you intend to hit, FieldQuo orders them into an efficient walking or driving route starting from your company address, and whoever is doing the distribution marks each stop as they go — **Delivered**, **Not home**, or **Spoke to owner**. The last one is the point: a conversation on a doorstep becomes a client record, optionally a booked visit, and a quote you can start on the spot.",
      "FieldQuo plans and tracks the route. It does not print the door hangers or arrange delivery — you supply the printed material and the people. Nothing in the comparison data FieldQuo keeps on Jobber, Housecall Pro and Projul lists a door-hanger route at any tier, which is why this article sits under Only in FieldQuo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Campaigns live under **Marketing** in the sidebar. The screen's own words: “Run and track your campaigns — paid ads, email blasts, and door-to-door pamphlet distribution, with routes, assignments, and doorstep follow-ups in one place.” Each campaign is a card with its status chip, its kind (**Pamphlet distribution**, **Meta / paid ads**, **Email blast**, **Other**) and, for a pamphlet campaign, its progress — **26/40 stops** and **9 spoke to** — plus who it is assigned to." },
          { figure: "live:app-marketing", caption: "Marketing — one card per campaign, with Subscribers, Marketing spend and New Campaign across the top." },
          { p: "Open a pamphlet campaign and you get the route: a map with numbered markers in route order, a box to add addresses, and the ordered list of stops with a status chip on each. That page is what the person walking the route keeps open on their phone." },
        ],
      },
      {
        id: "create-a-route",
        heading: "How to create a route",
        blocks: [
          { steps: [
            "Open **Marketing** and press **New Campaign**.",
            "Give it a name, keep the type on **Pamphlet distribution**, and pick who it is assigned to under **Assign to** (or leave it **Unassigned**). Press **Create Campaign**.",
            "Open the campaign. Under **Add an address to the route**, start typing a street address, pick it from the suggestions and press **Add**. Repeat for every street you plan to cover.",
            "Each address you add is placed into the route automatically — the map and the numbered list re-order themselves after every addition.",
          ] },
          { figure: "create:app-marketing-create", caption: "New Campaign — the name, the type, who it is assigned to, and the optional budget and link." },
          { note: "The order is a nearest-neighbour route: it starts at your company's address (from Company Settings) and always goes to the closest stop not yet placed. An address that could not be located on the map is listed at the end, in the order you added it, so it never distorts the ones that could." },
        ],
      },
      {
        id: "working-the-route",
        heading: "Working the route from the doorstep",
        blocks: [
          { p: "Every stop starts as **Pending** and has three buttons. What each one does:" },
          { table: {
            head: ["Button", "What it changes"],
            rows: [
              ["**Delivered**", "The stop is marked Delivered and counts as visited. Nothing else happens."],
              ["**Not home**", "The stop is marked Not home (amber). It counts as visited — it is the one worth going back to."],
              ["**Spoke to owner**", "Opens a small form: **Homeowner name**, **Phone (optional)** and **Schedule a visit (optional)**. On save, FieldQuo creates a client with that name and the stop's address (reusing one already linked to the stop), marks the stop Spoke to owner, and — if you set a date and time — books an appointment at that address."],
              ["The bin icon (**Remove stop**)", "Deletes the stop from the route. There is no undo."],
            ],
          } },
          { p: "Once a stop has a client on it, a **Create quote** link appears under it. It opens the quote builder already scoped to that client, so the estimate starts before you have left the street. The campaign header counts **visited** as every stop that is no longer Pending." },
          { warning: "Booking the visit from the doorstep needs appointment permissions. If the person walking the route does not have them, the form says so — leave the date blank and just save the client; someone at the office can book it from the client record." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Marketing** row, the campaign list and **New Campaign** are for owners, administrators, managers and dispatchers — the same rule as every other marketing screen. Creating a campaign and adding addresses need that level too." },
          { p: "Marking a stop is deliberately open to any active member of the company: distribution is fieldwork, and the person on the street is often a crew member. They will not see the Marketing row, but the campaign page itself opens for them from a link — send the assigned person the campaign's link and the Delivered / Not home / Spoke to owner buttons work on their phone. A budget on the campaign is hidden from them." },
        ],
      },
    ],
    faq: [
      { q: "Does FieldQuo print the flyers or door hangers?", a: "No. It plans and tracks the route only; you print the material and hand it out yourself. Log what the print run cost under Marketing spend, channel Pamphlets, so it shows in your cost per lead." },
      { q: "Why does the card still say Draft?", a: "The status chip on a pamphlet campaign is not changed by anything on the screen — watch the stops count and the spoke-to count instead; those are what the route updates." },
      { q: "Can I paste a whole list of addresses at once?", a: "The screen adds one address at a time, from the map's suggestions. Each one is placed into the route as soon as it is added." },
    ],
  },

  "email-campaigns-and-subscribers": {
    title: "Email campaigns and subscribers",
    summary:
      "Send one email to every subscribed client from your own sending address, using a template you wrote, with a working unsubscribe link in every copy and a list you control.",
    updated: "2026-09-12",
    intro: [
      "An **Email blast** campaign sends one of your email templates to everyone on your **Subscribers** list who has not unsubscribed. It goes out under your company's name and sender, with your logo and brand colour in the header, and every copy carries a one-click unsubscribe link — the same link your review requests carry, because both are marketing under Canadian and US law.",
      "The list is yours: import it from your clients in one click, add people who are not clients yet, and unsubscribe or resubscribe anyone by hand.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Three screens are involved. **Settings → Email Templates** is where the words live — a campaign can only send a template of the Marketing or Custom kind, never the automated quote or invoice ones. **Marketing → Subscribers** is who it goes to. **Marketing → New Campaign** with the type **Email blast** ties the two together, and the campaign's own page has the **Send Campaign** button." },
          { figure: "live:app-marketing", caption: "Marketing — Subscribers sits next to New Campaign; an email campaign's card shows its template and Sent to N or Not sent yet." },
        ],
      },
      {
        id: "subscribers",
        heading: "The Subscribers list",
        blocks: [
          { p: "The Subscribers screen says at the top exactly what it is for: “{subscribed} subscribed of {total} total — this is who an Email blast campaign sends to.” Two ways to fill it:" },
          { bullets: [
            "**Import from Clients** pulls in every client with an email address on file. It is safe to press again later: a client already on the list keeps their state — someone who unsubscribed is never quietly put back — and only new rows come in subscribed. The result reads “Imported 34 of 41 clients with an email on file.” Imported rows are tagged **From clients**.",
            "**Add Subscriber** takes an **Email**, a **Name (optional)** and a **Phone (optional)**, for a prospect who is not a client.",
          ] },
          { p: "Each row has **Unsubscribe** or **Resubscribe**, and a remove button. Unsubscribing keeps the row and its history — only the subscribed flag moves — so a re-import cannot undo it." },
        ],
      },
      {
        id: "send-a-campaign",
        heading: "How to send a campaign",
        blocks: [
          { steps: [
            "In **Settings → Email Templates**, write the email as a Marketing template. Its subject line is what recipients see; the campaign name is only your internal label.",
            "Open **Marketing → Subscribers** and press **Import from Clients**, then add anyone else by hand.",
            "Back on **Marketing**, press **New Campaign**, set the type to **Email blast**, choose the template under **Template to send**, and press **Create Campaign**.",
            "Open the campaign. It shows the template, the count of subscribed recipients and a **Send Campaign** button. Press it, read the confirmation — “Send … to all N subscribed recipients right now? This can't be undone.” — and press **Yes, send now**.",
          ] },
          { p: "The send fills the template's fields from each subscriber — client name, address and phone, your company name, phone and email — and mails them one by one. Each recipient is claimed before their copy goes out, so pressing Send twice, or a send interrupted halfway, never emails anyone twice. A finished send marks the campaign **completed** and the card reads **Sent to N**; an interrupted one reads **Partially sent** with a **Resume send** button that mails only whoever is left." },
          { note: "A completed campaign cannot be sent again from the same page. To mail the list again, create a new campaign. Sending also needs a company that has finished checkout — a company still on the setup gate is prompted to complete it instead of sending." },
        ],
      },
      {
        id: "unsubscribes",
        heading: "What the unsubscribe link does",
        blocks: [
          { p: "Every campaign email carries an unsubscribe link and the mail headers that let Gmail and Apple Mail show their own Unsubscribe button. The link opens a page that names your company and says, in the words stored against the row, that it stops promotional email only — quotes, invoices and receipts still arrive. One click sets the person to unsubscribed; nothing is deleted, and the moment and the wording they saw are kept." },
          { p: "The same list is checked before a review request goes out, so an unsubscribe stops both. Full detail: [[client-consent-and-unsubscribes|Client consent and unsubscribes]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, managers and dispatchers see Marketing, the subscriber list and the Send button. Estimators and crew do not. The sender address is the one FieldQuo has verified for your company — see [[send-from-your-own-domain|Send email from your own domain]]." },
        ],
      },
    ],
    faq: [
      { q: "Can I see who opened or clicked?", a: "No. FieldQuo records who was sent the campaign and when; it does not track opens or clicks." },
      { q: "Can I send to a segment — only roofing clients, say?", a: "Not from this screen. A campaign goes to every subscribed row. Unsubscribe the rows you want to leave out first, or keep a separate list by adding subscribers by hand." },
      { q: "Where do the email's colours and logo come from?", a: "From Settings → Branding, the same way as your quotes and invoices. Nothing in the email says FieldQuo." },
    ],
  },

  "marketing-spend": {
    title: "Marketing spend",
    summary:
      "Log what you spend to bring in work — by channel, by hand or synced from Meta — and read a blended cost per lead worked out from your real lead count.",
    updated: "2026-09-12",
    intro: [
      "**Marketing → Marketing spend** is the ledger of what you pay to get leads: Facebook and Instagram, Google, TikTok, pamphlets, referral incentives, anything else. You type the amounts in, or connect your Meta ad account and let **Sync now** import them. Above the ledger, FieldQuo divides the total by the number of real leads that arrived and prints a **Blended cost per lead**.",
      "Blended is the honest word. Per-campaign cost per lead is only worked out for leads that arrived through a Meta lead form; every other channel — and a homeowner who saw the ad and phoned — is still blended across everything, because nothing links that spend to that lead.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen's subtitle is its scope: “What you spend to bring in work, by channel — and what it costs you per lead, blended across everything.” Top to bottom: the **Blended cost per lead** card, a **Spend by channel** table, a **Campaigns** table for anything synced from Meta, and the list of entries with **Edit** and **Delete** on each." },
          { figure: "live:app-marketing", caption: "Marketing — the Marketing spend button, top right, opens the ledger." },
        ],
      },
      {
        id: "log-spend",
        heading: "How to log spend",
        blocks: [
          { steps: [
            "Open **Marketing**, then **Marketing spend**, and press **Log spend**.",
            "Pick the **Channel** — Facebook / Instagram, Google, TikTok, Pamphlets, Referral incentive or Other — the **Date** and the **Amount**.",
            "Optionally name the **Campaign**, and enter **Leads it brought** and **Conversions** if you know them. These are your own estimate; the screen shows them as “as entered” and never mixes them into your real lead count.",
            "Press **Save**. The entry appears in the list with its source **Manual**; rows that came from Meta read **From Meta**.",
          ] },
          { tip: "Running ads on Meta? The screen says so itself: connect your ad account and the spend imports without typing — see [[connect-meta-ads|Connect your Meta ad account]]." },
        ],
      },
      {
        id: "the-numbers",
        heading: "What each number means",
        blocks: [
          { table: {
            head: ["Figure", "How it is worked out"],
            rows: [
              ["**Blended cost per lead**", "Everything logged, divided by the leads on your Leads board in the same period. Leads entered by hand or imported from a file are left out and counted separately — “+ 4 leads entered manually or imported, not counted” — because this period's spend did not cause them."],
              ["**Spend by channel**", "The logged amounts per channel, with the leads and cost per lead you typed in, marked “(as entered)”."],
              ["**Campaigns**", "One row per Meta campaign FieldQuo has synced: what it cost, what Meta reported (impressions, reach, clicks, CTR, CPC, conversations, video views, engagements) and what became of its lead-form leads — leads, quotes, jobs, invoiced."],
              ["**≈ approximate**", "A Meta account that reports in a different currency than your company's is converted at a pinned exchange rate and marked ≈. If that rate is more than 45 days old, or FieldQuo holds no rate for the pair, the rows are left out and the screen names the amount and the reason."],
            ],
          } },
          { p: "The campaign table's Leads column counts only Meta lead-form submissions received for that campaign. Its own footnote says it: a homeowner who saw the ad and phoned is not counted, so cost per lead there is the most a lead-form lead cost you — the blended figure above is the whole picture." },
          { warning: "Deleting an entry changes the cost-per-lead figures; the confirmation says so. The same rows feed the business-costs card on the KPI dashboard and the monthly digest email." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, managers and dispatchers — the Marketing row's rule. Connecting the Meta account that feeds it is owner and administrator only." },
        ],
      },
    ],
    faq: [
      { q: "Can FieldQuo tell me which channel is working?", a: "Only for Meta lead-form leads, per campaign. Everything else is blended, and the screen says so under the figure rather than guessing." },
      { q: "Does the Meta sync run on its own?", a: "No. Press Sync now on Settings → Meta Ads; each press imports the last 30 days." },
      { q: "Why does my figure say “Not enough data yet”?", a: "No spend has been logged, or no lead arrived in the period. Both are shown rather than a zero." },
    ],
  },

  "the-marketing-designer": {
    title: "The Marketing Designer",
    summary:
      "Design one ad on a canvas and get it in every size Instagram, TikTok, Facebook and YouTube ask for — templates, your own photos, stock photos, text and shapes free; AI images on credit; approval before anything goes out.",
    updated: "2026-09-12",
    intro: [
      "The **Designer** row in the sidebar opens the Marketing Designer. Its own description: “Design one ad and export it in every size a social network asks for — Instagram, TikTok, Facebook and YouTube — without redoing the layout by hand.” One design carries five formats at once, each with its own saved adjustments, and **Download all formats** hands you a PNG of each.",
      "No comparison data FieldQuo keeps on Jobber, Housecall Pro or Projul lists an ad-design canvas at any tier, which is why this sits under Only in FieldQuo. What it is not: a tool that posts for you today — see [[social-posting-and-scheduling|Post to Facebook and Instagram, now or later]] for where that stands.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every design belongs to an ad campaign, and the campaigns are the same rows as on the Marketing screen — one created here shows up there and vice versa. The Designer's index lists each campaign with its designs: a badge reading **Approved**, **Not approved** or **Re-approve**, chips for the five formats, and **2/5 formats ready**. Under each campaign: **Make a post from a job** and a **Design name** box with **New design**." },
          { figure: "live:app-marketing-designer", caption: "Marketing Designer — New ad campaign at the top, then each campaign's designs with their approval badge and formats ready." },
        ],
      },
      {
        id: "the-editor",
        heading: "What is in the editor",
        blocks: [
          { p: "Open a design and the canvas has a tab per format across the top: **Instagram post** (1080 × 1080), **Instagram story** (1080 × 1920), **TikTok** (1080 × 1920), **Facebook feed** (1200 × 630) and **YouTube thumbnail** (1280 × 720). Lay the ad out once; switching tabs reflows it into the other frame, and whatever you nudge on a tab is saved for that format only. A warning appears when artwork hangs over the edge of a format." },
          { bullets: [
            "**Design** — templates to start from.",
            "**Image** — **Upload image**, stock photos, and a **Job photos** tab that lists a job's photos so a real before-and-after lands on the canvas. Photos tagged Issue / snag are never offered.",
            "**Text**, **Shapes**, **Draw** — the ordinary tools, all free.",
            "**AI** — **AI image** generation from a prompt, optionally starting from one of your photos, and background removal. These are the one paid piece: they spend AI image credit from **Settings → AI credit**, the panel shows the price before you press, and it offers **Add AI credit** if the balance is short. The panel also says what it does not know: your prices or your service area.",
            "**Settings** — canvas size and background.",
          ] },
          { p: "Changes save as you go — the header reads **All changes saved**, **Saving…** or **Couldn't save — check your connection**. **Download all formats** rasterises every tab to a PNG named after the campaign and the format." },
        ],
      },
      {
        id: "approve",
        heading: "Review and approve",
        blocks: [
          { steps: [
            "Press **Review & approve** in the editor header.",
            "Write or paste the caption and hashtags. If they are unsaved, approving saves them first.",
            "Press **Approve this post**. The badge turns **Approved**, with who approved it and when.",
          ] },
          { p: "Approval is a fingerprint of the artwork and the words. Change either afterwards and the badge reads **Re-approve** — “This changed after it was approved. Have another look, then approve it again.” Renaming the design does not withdraw it; **Withdraw approval** does, on purpose. Nothing can be scheduled or posted until a design is approved." },
          { p: "Under **What next**, the approval screen offers **Download every size** and **Copy the caption**. For a paid ad it says so plainly: upload the downloaded file in Meta Ads Manager — FieldQuo cannot create the ad for you, because that needs a Meta permission it has not been granted." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, managers and dispatchers see the Designer row and can create, edit, approve and delete designs. Deleting a design asks first and cannot be undone." },
        ],
      },
    ],
    faq: [
      { q: "Is the Designer extra?", a: "No. Templates, uploads, stock photos, job photos, text, shapes and every export are included. Only AI image generation and background removal draw on AI credit." },
      { q: "Where do the job photos come from?", a: "From the photos your crew filed on jobs, with their stage tags — see [[job-photos-and-tags|Job photos and tags]]. An Issue / snag photo never reaches a design." },
      { q: "Can I post straight from here?", a: "The Publish button and the Social calendar are built, but posting waits on Meta's approval of the app. Until then download every size and post from your own account — the approval screen says exactly that." },
    ],
  },

  "make-a-post-from-a-job": {
    title: "Make a post from a job",
    summary:
      "Turn a finished job's before-and-after photos into a ready-to-approve social post — the crew's real photos side by side, a headline written from that job's scope of work, and your trade and town along the bottom.",
    updated: "2026-09-12",
    intro: [
      "The best ad a contractor has is the kitchen they just finished. **Make a post from a job** on the Marketing Designer builds that post out of what already exists: the earliest **Before / start** photo and the latest **Finished** photo from a job, labelled BEFORE and AFTER, a headline drawn from the job's scope of work, and a footer naming your trade and your town. Nothing is invented — the screen's own hint says so — and a photo tagged **Issue / snag** is never used.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "This is a composition, not a generated picture. The pixels are your photographs; what FieldQuo decides is where they sit, how big the words are, and which colours are safe against your brand colour. The model is asked for sentences only — a headline and, later, a caption — and if it is unavailable the post gets a plainer, factual headline built from the scope of work rather than a broken one." },
          { figure: "live:app-marketing-designer", caption: "Marketing Designer — Make a post from a job sits under each campaign, beside New design." },
        ],
      },
      {
        id: "steps",
        heading: "How to make one",
        blocks: [
          { steps: [
            "Open **Designer** and find the campaign the post belongs to. Press **Make a post from a job**.",
            "FieldQuo looks through your jobs — “Looking through your jobs…” — and lists the ones with a publishable photo. Each says **Before and after** when it has both a start and a finish shot, or **One photo — no before/after on this job** when it has only one.",
            "Press **Make it** on the job. The design opens in the editor with the photos placed, the labels on, the headline written and the footer filled in.",
            "Adjust anything you like on each format tab, then **Review & approve**. Under the caption, **Generate with AI** writes a caption from that job's actual scope of work and says so — “Written from this job's actual scope of work” — or warns you when it could find no job details and the copy is generic.",
          ] },
          { note: "If no job has a photo FieldQuo can publish, the list says: “No job has a photo we can publish yet. Tag a start and a finish shot on a job and it will show up here.” Tagging is done on the job — see [[job-photos-and-tags|Job photos and tags]]." },
        ],
      },
      {
        id: "what-goes-in",
        heading: "What goes in, and what never does",
        blocks: [
          { table: {
            head: ["Element", "Where it comes from"],
            rows: [
              ["The BEFORE photo", "The earliest photo on the job tagged **Before / start**."],
              ["The AFTER photo", "The latest photo tagged **Finished**. With no pair, the most recent finished shot on its own, with no AFTER label."],
              ["The headline", "Written from the job's scope of work; the factual fallback names the work if the model is unavailable."],
              ["The footer", "Your enabled trade and your city and province from Company Settings."],
              ["The colours", "Your brand colour, measured for contrast — never chosen by the model."],
            ],
          } },
          { p: "A photo tagged **Issue / snag** — water damage behind a cabinet, a problem the crew flagged — is filtered out twice: before anything reaches the model, and before anything reaches the canvas. Photos from two different jobs are never mixed into one caption." },
          { p: "The headline and caption are AI calls and spend AI credit like the rest of FieldQuo AI; the photos themselves are not generated and cost nothing." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The same people as the Designer: owners, administrators, managers and dispatchers." },
        ],
      },
    ],
    faq: [
      { q: "Can I pick which photos it uses?", a: "Not in the picker — it takes the earliest start and the latest finish. Once the design is open, swap either photo from the Image sidebar's Job photos tab." },
      { q: "Will it put the client's name or address on the post?", a: "No. The footer carries your trade and your town, and the headline is written from the scope of work, not the client record." },
    ],
  },

  "social-posting-and-scheduling": {
    title: "Post to Facebook and Instagram, now or later",
    summary:
      "What the Publish dialog and the Social calendar do — post now or schedule an approved design to your Facebook Page and Instagram — and the honest state of it today: the connection is waiting on Meta's approval.",
    updated: "2026-09-12",
    intro: [
      "An approved design in the Marketing Designer has a **Publish** button. It opens **Publish to Instagram & Facebook**: choose the platforms, the shape, check the caption, and either **Publish now** or **Schedule for later**. Scheduled posts appear on the **Social calendar**, where a post can be cancelled before it goes out.",
      "Read this first: posting needs permissions Meta has to grant FieldQuo's app, and that review has not come back yet. **Settings → Meta Ads → Facebook & Instagram publishing** reads **Waiting on Meta's approval**, and the Publish dialog says **Not connected yet**. The workaround is one step — download the post and put it up from your own account — and the approval screen tells you so.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The whole path is built end to end: the Page connection, the dialog, the scheduler, the calendar and the retry rules. What is missing is Meta's approval of two permissions — posting to a Page and publishing to Instagram — so no real company can connect a Page yet. Nothing is missing on your side, and there is nothing to set up in advance." },
          { figure: "live:app-settings-meta-ads", caption: "Settings → Meta Ads — the Facebook & Instagram publishing card sits under the ad-account connection and states what it is waiting on." },
        ],
      },
      {
        id: "the-publish-dialog",
        heading: "What the Publish dialog does",
        blocks: [
          { bullets: [
            "**Post to** — **Facebook Page** and **Instagram**. Instagram is only offered when an Instagram professional account is linked to the connected Page.",
            "**Shape** — **Square (1:1)** or **Landscape (1.91:1)**, the two crops Instagram accepts. If a crop does not fit Instagram's rules the dialog says so and asks for the other.",
            "**Caption** — the approved words, read-only here. Instagram's limits are enforced for both platforms: 2,200 characters, 30 hashtags, 20 mentions.",
            "**Publish now** posts at once. **Schedule for later** shows the windows: “Facebook: 10 minutes to 75 days out. Instagram: at least 5 minutes out — FieldQuo holds it and posts it for you at the right moment.” FieldQuo will hold a post up to 180 days.",
          ] },
          { p: "A Facebook post scheduled inside Facebook's own window is handed to Facebook's scheduler at once. Every Instagram post — Instagram has no scheduler — is held by FieldQuo and sent by a job that runs every five minutes. Only image posts can be scheduled; Reels and video are not supported, and the calendar says so." },
        ],
      },
      {
        id: "the-calendar",
        heading: "The Social calendar",
        blocks: [
          { p: "**Calendar** in the editor header opens a month grid of every post that is **Scheduled**, **Publishing**, **Published**, **Failed**, **Limit reached** or **Canceled**, filed under the time it was meant to go out. Pick a day to see the posts, and **Cancel** a scheduled one that has not gone out. A post Meta refused shows the reason; **Limit reached** means the platform hit Meta's posting limit for the next 24 hours." },
        ],
      },
      {
        id: "rules",
        heading: "What has to be true before a post goes out",
        blocks: [
          { table: {
            head: ["Rule", "Why"],
            rows: [
              ["The design is **Approved**, and unchanged since", "A post carries your name; the server recomputes the approval on every publish and refuses a stale one."],
              ["The caption is the design's", "A caption changed in the dialog is refused rather than quietly posted — save it on the design and approve again."],
              ["Your company has finished checkout", "Publishing under the company's name is an outward act, gated like sending a quote."],
              ["A Page is connected", "Today, waiting on Meta — see above."],
            ],
          } },
          { tip: "Until the approval lands: **Review & approve**, then **Download every size** and **Copy the caption**, and post from Facebook or Instagram yourself. It takes a minute and nothing is lost." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, managers and dispatchers can approve, publish, schedule and cancel. Connecting the Page, when it becomes possible, is done on Settings → Meta Ads by an owner or administrator, and the one connection also feeds the Messages inbox — see [[connect-your-facebook-page-and-instagram|Connecting your Facebook Page and Instagram]]." },
        ],
      },
    ],
    faq: [
      { q: "Is there anything I can do to speed up Meta's approval?", a: "No. The review is of FieldQuo's app, not your account. The settings card says “Nothing is missing on your side.”" },
      { q: "Can FieldQuo create the paid ad for me?", a: "No. Running an ad needs a further Meta permission FieldQuo does not hold. Download every size and upload it in Meta Ads Manager; the ad's spend then syncs back into Marketing spend." },
      { q: "Can I schedule a Reel or a video?", a: "Not yet — image posts only." },
    ],
  },

  "connect-meta-ads": {
    title: "Connect your Meta ad account",
    summary:
      "Link your own Facebook and Instagram ad account so its spend and campaign results flow into Marketing spend — read-only, synced when you press Sync now — and see what else the same screen is waiting on Meta for.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Getting paid → Meta Ads** connects your company's own Meta ad account. In the screen's words: “Connect your own Meta (Facebook/Instagram) ad account to bring spend and campaign performance into your marketing numbers.” FieldQuo only reads spend and performance — it never creates or changes an ad.",
      "The same screen holds three more Meta cards: **Facebook lead forms**, **Facebook & Instagram publishing** and **WhatsApp Business**. Each states its own preconditions, and today each is waiting on a permission Meta has not yet granted to FieldQuo's app.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen has four honest states and never shows a button that cannot work. **Not set up yet** — the deployment has no Meta app credentials. **Can't store a token safely yet** — a deployment setting is missing. **Not connected** — a real **Connect Meta Ads** button. **Connected** — the account card with **Sync now**, **Disconnect** and, once something has synced, **See your campaigns →**." },
          { figure: "live:app-settings-meta-ads", caption: "Settings → Meta Ads — the ad-account connection, then the lead forms, publishing and WhatsApp cards." },
        ],
      },
      {
        id: "connect",
        heading: "How to connect",
        blocks: [
          { steps: [
            "Open **Settings → Meta Ads** and press **Connect Meta Ads**. You are sent to Meta to log in and consent.",
            "If Meta returns more than one ad account for your login, the screen asks **Which ad account?** — pick one and press **Connect this account**.",
            "Back on the screen, the card shows the account's name, id and currency with the chip **Connected**, and “Never synced yet.” Press **Sync now**.",
            "The result reads “12 new rows, 3 updated.” Open **Marketing → Marketing spend** to see them, source **From Meta**.",
          ] },
          { note: "Each **Sync now** imports the last 30 days of campaign results — spend per campaign per day, and what Meta reported alongside it. There is no automatic sync: press it when you want the numbers refreshed. The sync also warns when rows look like spend you already logged by hand, so you do not count both." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "What each control does",
        blocks: [
          { table: {
            head: ["Control", "What it changes"],
            rows: [
              ["**Sync now**", "Imports the last 30 days into Marketing spend and updates the campaign table. Rows in another currency are converted at a pinned rate and marked ≈."],
              ["**Reconnect**", "Appears when the chip reads **Needs reconnecting** — Meta says the stored token is no longer valid. Syncing is paused until you do."],
              ["**Disconnect**", "Stops syncing. Rows already imported stay in your marketing spend history."],
              ["**Facebook lead forms** switches", "Shown per form with their lead counts, but disabled: “Facebook lead forms need Meta's approval of one more permission; nothing is being received yet.” See [[facebook-lead-forms|Facebook lead forms]]."],
              ["**Facebook & Instagram publishing**", "Reads **Waiting on Meta's approval**. Posting from the Designer waits on it — see [[social-posting-and-scheduling|Post to Facebook and Instagram, now or later]]."],
              ["**WhatsApp Business**", "Reads **Waiting on Meta's approval**. See [[whatsapp-business|WhatsApp Business messages]]."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only — the same shelf as Payments. A manager sees a no-access panel here, and every route behind the screen refuses them too. The numbers the sync produces are visible to anyone who can open Marketing spend." },
        ],
      },
    ],
    faq: [
      { q: "Will FieldQuo change my ads or my budget?", a: "No. The permission it asks Meta for is read-only; the screen says it never creates or changes an ad." },
      { q: "My ad account bills in USD and my company is in CAD — what happens?", a: "The rows are converted at a pinned exchange rate and every figure they touch is marked ≈ approximate, with the rate's age beside it. A rate older than 45 days is refused and the amount is named as excluded." },
      { q: "Where do the leads from my ads go?", a: "Once Meta approves the lead-forms permission, a lead from a form you switch on lands in Leads like any other enquiry. Until then the switches are disabled and the card says nothing is being received." },
    ],
  },

  "ask-for-reviews-automatically": {
    title: "Ask for reviews automatically",
    summary:
      "One short email, from you, to each client after their job is marked complete — never twice, never to someone who unsubscribed — with the delay you choose and a live count of who is in the queue.",
    updated: "2026-09-12",
    intro: [
      "Reviews are the biggest driver of inbound work a small contractor has, and asking is the step that gets skipped. **Settings → Client-facing → Reviews** asks for you: once a job is marked complete, the client gets one message with your review link, after a delay you set. The screen does not just say On — it tells you how many customers are in the queue right now and how many were asked in the last 30 days.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Top to bottom: **Your review link** with **Save**; the **Ask automatically** switch; **When to ask** delay chips; a sentence like “3 customers are in the queue, and 12 have been asked in the last 30 days.”; and a footnote: “Customers who have unsubscribed are skipped, and anyone who replies saying something went wrong reaches you directly rather than the review page.” Below that, **Reviews on your website** — the testimonials half of the screen, covered in [[testimonials-on-your-website|Testimonials on your website]]." },
          { figure: "live:app-settings-reviews", caption: "Settings → Reviews — the review link, the Ask automatically switch, and the reviews shown on your website." },
        ],
      },
      {
        id: "switch-it-on",
        heading: "How to switch it on",
        blocks: [
          { steps: [
            "Paste your review link under **Your review link** and press **Save**. The help under it says where to get it: on your Google Business Profile, choose “Ask for reviews” and copy the short link. Any http or https page works — Google, Facebook, HomeStars, your own form. Use **Open it and check it goes where you expect**.",
            "Turn on **Ask automatically**. It cannot be turned on without a link — the switch says “Add your review link above first.” — and the server refuses it too.",
            "Pick **When to ask**: **2 hours later**, **4 hours later**, **The next day**, **Two days later**, **Three days later** or **A week later**. The sentence under it updates to show the queue.",
          ] },
        ],
      },
      {
        id: "rules",
        heading: "The rules the ask obeys",
        blocks: [
          { bullets: [
            "**Once, ever.** A job is asked about at most once. The job is stamped before the email leaves, so an overlapping run or a double-click can never ask twice.",
            "**Complete means complete.** Only a job with the status completed and a completion time. Cancelled or reopened jobs are not asked.",
            "**The client needs an email address**, and must not have unsubscribed — the same list your email campaigns use.",
            "**On time.** FieldQuo checks every hour, so a 4-hour delay means about 4 hours, not the next morning.",
            "**Not the distant past.** A job finished more than 30 days ago is never asked, and jobs imported from your old system are skipped — switching this on today does not email every customer you ever had.",
          ] },
          { p: "The email itself is short on purpose: one sentence of thanks, one button, your logo and colour, your name in the From line, replies to your inbox. Under the button sit five small rating links, 1 to 5 — the client's score lands in FieldQuo, and an unhappy reply reaches you, not the review page. Every copy carries an unsubscribe link." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, managers and dispatchers can open and change this screen. What happens when a job is marked complete, including this ask, is in [[when-a-job-is-completed|When a job is completed]]." },
        ],
      },
    ],
    faq: [
      { q: "Does it text the client too?", a: "No. The review request is an email only." },
      { q: "Can I ask a specific client by hand?", a: "Not from this screen — it is automatic, and once per job. Send them your review link yourself from the client record." },
      { q: "What counts as “in the queue”?", a: "Completed jobs whose delay has not yet run out and that have not been asked, read from the same columns the hourly job reads." },
    ],
  },

  "refer-another-business": {
    title: "Refer another business, earn a free month",
    summary:
      "Send another contractor your link or an invite; they get a free month when they sign up, and you get one added to your account once they are a paying customer.",
    updated: "2026-09-12",
    intro: [
      "**Refer & Earn** — a row in the sidebar and again under **Settings → Account** — is FieldQuo's own referral programme, one contractor telling another. Both sides get the same thing: a month of FieldQuo. The newcomer's month lands the day they sign up; yours lands the day they make their first real payment. The screen keeps the two apart deliberately, so “I referred three people, where are my months?” has a visible answer: **Signed up — not yet paying**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page opens with “Refer another business and get another month of FieldQuo free, once they're a paying customer.” Then **Your link** with **Copy** — “Short enough to say out loud. Put it on a business card, an invoice footer, or a van.” — a **WhatsApp** button, **Text it** on a phone, and **Send an invite** by **Email** or **Text**. Below: how many free months you have earned, **Businesses you've referred** with a **Credited** or **Signed up — not yet paying** badge on each, and **Invites sent**." },
          { figure: "live:app-settings-refer", caption: "Refer & Earn — your link, the share buttons, the invite form, and the businesses referred so far." },
        ],
      },
      {
        id: "send-an-invite",
        heading: "How to send an invite",
        blocks: [
          { steps: [
            "Open **Refer & Earn**.",
            "To share it yourself, press **Copy** and paste the link anywhere, or **WhatsApp** / **Text it** to open your own messaging app with the message ready and you choosing who it goes to.",
            "To have FieldQuo send it, choose **Email** or **Text** under **Send an invite**, enter **Their email** or **Their mobile number**, optionally **Their name**, and press **Send invite**.",
            "The invite appears under **Invites sent** with its channel and date; it changes to **Signed up** when they do, or **Failed** if it could not be delivered.",
          ] },
          { note: "FieldQuo sends one message and does not follow up. Up to 20 invites a day. A person who has asked FieldQuo not to contact them is not sent one, and the screen tells you so." },
        ],
      },
      {
        id: "how-the-months-work",
        heading: "How the free months work",
        blocks: [
          { table: {
            head: ["Who", "What they get", "When"],
            rows: [
              ["The business you referred", "One extra free month of trial", "At signup through your link or invite"],
              ["You", "One free month", "When that business makes its first real payment, has finished setup and has verified payments — “Added to your account automatically when a business you referred makes their first payment.”"],
            ],
          } },
          { p: "Your month is a month of the product, not a dollar figure: if you are still on trial it pushes your trial end out; if you are paying it moves your next charge a month later, on monthly and annual plans alike. Nothing is ever shortened, and a second referral adds a second month. The reward is the same whatever size the business you refer is." },
          { p: "The limits, all anti-abuse: you cannot refer yourself, a company that already exists cannot redeem a link, and a referrer is credited for at most 50 qualifying referrals in a calendar month." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. The page lists which companies were referred and what was earned, and sending an invite is owner-and-administrator on the server, so the row is hidden from everyone else rather than shown read-only. Client referrals — a homeowner sending you a neighbour — are a different thing: [[referrals-from-clients|Referrals from clients]]." },
        ],
      },
    ],
    faq: [
      { q: "They signed up but I have no month yet — why?", a: "Their badge reads Signed up — not yet paying. Your month arrives on their first real payment, once their setup is complete and their payments are verified; a $0 trial invoice earns nothing." },
      { q: "Where does the invite come from?", a: "From FieldQuo — it is FieldQuo inviting a business on your behalf, not a message to one of your clients. Your name is in it." },
      { q: "Is there a cap?", a: "20 invites a day, and credit for up to 50 qualifying referrals a month." },
    ],
  },

  "instant-estimates-as-marketing": {
    title: "The instant estimate as a lead magnet",
    summary:
      "Put a real price range on your website, your bio link and your share links, and every homeowner who uses it becomes a client, a draft quote in your review queue and a scored lead — without your rate card ever going public.",
    updated: "2026-09-12",
    intro: [
      "A homeowner comparing three contractors answers the one who gives a number. **Settings → Client-facing → Instant Quotes** lets them get one from you in seconds — roof measured from their address, or an area they trace on a map — and every estimate is a range they can request that lands in your **Quote reviews** before anything is binding. This article is about using it as marketing: where to put it, what each request gives you, and what you control.",
      "The rate card behind it is never published. A visitor sees a range, or nothing until they submit — your choice — and the per-unit rates stay on this screen. How the pricing itself is set up is in [[instant-quotes-on-your-website|Instant quotes on your website]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen tells you what is live: “2 live on your instant-estimate link.” with **See what homeowners see**, or “Nothing is live on your instant-estimate link yet — switch a service on below.” Once something is live, a **Put the instant estimate on your website** card offers the embed with **Copy code**. Then one card per trade: an **On** / **Off** switch, **What the homeowner sees**, the rates, **Minimum charge**, **Range width (±)**, **Budget bands** and an optional **Financing** note." },
          { figure: "live:app-settings-instant-quotes", caption: "Settings → Instant Quotes — the live count, the embed code, then a card per trade with its switch and rates." },
        ],
      },
      {
        id: "where-to-put-it",
        heading: "Where to put it",
        blocks: [
          { bullets: [
            "**Its own page** — every company has an instant-estimate link of its own, the one **See what homeowners see** opens. Your FieldQuo website's Get a quote page carries the self-quote form, which is a different thing; the instant estimate is shared by its link or embedded.",
            "**Any other website** — paste the code from **Copy code** where you want it. The note under it says why it is safe: an ordinary HTML element that works on Wix, Squarespace, WordPress and hand-written HTML; the small script only resizes the box, and without it the box works at a fixed height.",
            "**Your bio link** — when a trade is on, the instant estimate is the first link offered, ahead of book a visit and request a quote.",
            "**Share your links** — the **Instant estimate** card there has the link, **Copy link** and **Open**, for a text, an email signature or a flyer. See [[share-your-links|Share your links]].",
          ] },
        ],
      },
      {
        id: "what-a-request-gives-you",
        heading: "What each request gives you",
        blocks: [
          { steps: [
            "A **client** record with the name, contact details and address the homeowner entered.",
            "A **draft quote**, priced from your rates, marked **Needs review** on the Quotes list and waiting in **Quote reviews** — nothing can be sent until someone confirms the price. See [[estimate-reviews|Estimate Reviews: approve instant estimates]].",
            "A **lead** on the Leads board, source instant estimate, scored like any other — with the budget band the homeowner picked and any photos they attached. See [[lead-scoring-hot-warm-cold|Lead scoring: Hot, Warm, Cold]].",
            "An email to the homeowner confirming their estimate, in your branding.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { table: {
            head: ["Setting", "What it changes"],
            rows: [
              ["**On** / **Off**", "Whether the trade is offered at all. Saving with **Save & enable** is what makes it live; nothing is live off numbers nobody chose."],
              ["**What the homeowner sees**", "**Don't show a price** — they submit and are told a quote is on the way. **Show the range straight away** — the number appears before they leave any details; expect people to read it and go. **Show the range after they submit** — they fill in the form to unlock their range; you get their details either way — the usual pick."],
              ["**Range width (±)** and **Minimum charge**", "How wide the range is around the priced figure, and the floor it never goes under."],
              ["**Budget bands**", "The four options shown when the homeowner is asked their budget; the band they pick scores the lead."],
              ["**Financing**", "Optional, in your own words. FieldQuo does not provide financing; if you state your own rate and term the estimate also shows a monthly figure on those terms."],
            ],
          } },
          { warning: "The screen also flags a mismatch — a trade you quote instantly that is not on your Services screen, or a service with no instant price — and changes nothing on its own. Read it before you share the link." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone whose access includes seeing prices — owners, administrators, managers, dispatchers and estimators. Crew do not see this screen, because it is a rate card." },
        ],
      },
    ],
    faq: [
      { q: "Will a competitor see my rates?", a: "No. The public page never returns a rate; it returns a range for one specific job, or nothing until the homeowner submits, depending on What the homeowner sees." },
      { q: "Can the homeowner accept the estimate straight away?", a: "No. It is a draft that waits in Quote reviews; you confirm the price, adjusting it if the property needs it, and then send the quote." },
      { q: "Does the instant estimate count as a lead in my marketing numbers?", a: "Yes — it creates a lead on the board, and that lead counts in the blended cost per lead on Marketing spend." },
    ],
  },
};
