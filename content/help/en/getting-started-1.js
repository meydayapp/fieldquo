// content/help/en/getting-started-1.js
//
// Part 1 of the “getting-started” category in English (see the composer,
// getting-started.js): what FieldQuo is, the free trial, the first day, the
// sidebar, the dashboard, the three Business settings screens, and the four
// ways old data comes in. Every sentence is read off the page module, the
// route it calls and the lib/** rule behind it; the words on the screen are
// the `en` block of app/i18n/appMessages.js.
export const ARTICLES = {
  "what-fieldquo-is": {
    title: "What FieldQuo is, and the pipeline it runs",
    summary:
      "FieldQuo runs one pipeline — lead, quote, job, invoice, payment — and every document your client sees carries your name, not ours.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo is the back office for a field-service contractor: a painter, a cabinet maker, a flooring installer, a plumber, a landscaper. It exists so that you can win a job, do the job and get paid without leaving one place — and so that a homeowner comparing three contractors cannot tell which of them use the same software.",
      "This article is the map. It names the pipeline, the two surfaces the product has, the promise about your name, and where to start.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Everything in FieldQuo is a step on one line: a **lead** becomes a **quote**, an approved quote becomes a **job**, a finished job is billed on an **invoice**, and the invoice is paid online through your own Stripe account. Around that line sit the things a shop needs to run it — scheduling, crew time, materials, expenses, job costing, your website, your booking page, your reviews." },
          { p: "The sidebar follows the same order. Under **Work** you will find **Leads**, **Quotes**, **Jobs** and **Invoices**, in that sequence, because that is the sequence money moves in." },
        ],
      },
      {
        id: "the-pipeline",
        heading: "The pipeline, step by step",
        blocks: [
          { bullets: [
            "**Lead** — an enquiry from your website form, your booking link, an instant estimate, the phone receptionist or a referral. It lands on the Leads board scored Hot, Warm or Cold.",
            "**Quote** — built from your price book, in the language it was created in, reviewed by AI if you ask, and sent as a page and a PDF with your logo on it. The client approves and signs online.",
            "**Job** — created when the quote is approved. Visits go on the calendar, the crew clocks in, photos and checklists come back from the site.",
            "**Invoice** — mirrors the quote: same sections, same branding. A deposit can be raised first if your payment schedule says so.",
            "**Payment** — the client pays by card or, in Canada, bank debit, straight into your bank. FieldQuo never holds the money.",
          ] },
          { p: "Each step has its own category in this help centre: [[the-leads-board|Leads]], [[build-a-quote|Quotes]], [[the-jobs-list|Jobs]], [[create-an-invoice|Invoices]] and [[how-clients-pay-online|Payments]]." },
        ],
      },
      {
        id: "two-surfaces",
        heading: "Two surfaces: your back office, and what your clients see",
        blocks: [
          { p: "Your team works in the **back office** — the screens behind the sidebar, where staff spend the day. Your clients never sign in there. They see a second set of pages: the quote approval page, the invoice and its Pay button, the booking page, the client portal, your website, the emails and texts. Those are built for a stranger on a phone, on a bad connection, in a driveway." },
          { figure: "live:app", caption: "Home — the dashboard, with the sidebar's five groups down the left." },
          { p: "The category [[nothing-says-fieldquo|What your clients see]] walks every client-facing page exactly as the client gets it." },
        ],
      },
      {
        id: "your-name-not-ours",
        heading: "Everything carries your name",
        blocks: [
          { p: "Your logo, your brand colour and your company name go on every quote, invoice, PDF, email, booking page and website page. With your own domain verified, the From line in your client's inbox is your address, not ours. This is set up once, on [[set-up-your-branding|Branding]] and [[send-from-your-own-domain|Email Domain]]." },
          { note: "There is one deliberate exception: a small **Site by FieldQuo** line in the footer of a website whose company is not on a paid plan. A paying company's website carries no mention of FieldQuo at all." },
        ],
      },
      {
        id: "what-it-does-not-do",
        heading: "What FieldQuo does not do",
        blocks: [
          { bullets: [
            "It does not hold your money. Client payments are Stripe charges in your company's name, paid to your bank — see [[payment-processing-fees-and-payouts|fees and payouts]].",
            "It has no public API and no Zapier connector — see [[no-public-api-or-zapier|Integrations]].",
            "FieldQuo AI answers questions about your own quotes, invoices, clients and costs. It declines general requests, and it never sees another company's data.",
          ] },
        ],
      },
      {
        id: "where-to-start",
        heading: "Where to start",
        blocks: [
          { bullets: [
            "[[start-your-free-trial|Start your free trial]] — the four signup steps and what the card is for.",
            "[[your-first-day-setup-checklist|Your first day]] — the checklist the dashboard shows until it is done.",
            "[[the-sidebar-and-where-everything-is|The sidebar]] — where every screen lives.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Is FieldQuo for one person or for a team?", a: "Both. The Solo plan is one seat with five free crew logins; Scale is ten seats and fifteen crew. Crew logins cost nothing." },
      { q: "Do my clients need an account?", a: "No. A quote, an invoice, a booking and the portal all open from a link. Nobody on the client's side signs up for anything." },
      { q: "Will my clients see the FieldQuo name anywhere?", a: "Not on a quote, invoice, email or booking page. The only place it appears is the footer of a website whose company is not on a paid plan." },
    ],
  },

  "start-your-free-trial": {
    title: "Start your free trial",
    summary:
      "Four steps on the public signup form, a card at checkout, and nothing charged for the first month.",
    updated: "2026-09-12",
    intro: [
      "Signing up a company is self-serve: anyone can open the signup page, set up a business, pick a plan and start. The first month is free, and a card is taken at checkout so the second month can be billed without a second conversation.",
      "Joining a company that already exists is different — that is invite-only. If a colleague already uses FieldQuo, ask them to invite you from Manage Team; see [[invite-a-team-member|Invite a team member]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The form says **Start your free month** at the top and walks four steps: Account, Trades, Services, Plan. One login owns one business; if you are already signed in with a company, the page tells you so and offers to take you to your dashboard or to invite someone instead." },
        ],
      },
      {
        id: "the-four-steps",
        heading: "The four steps",
        blocks: [
          { steps: [
            "**Account** — your first and last name, email and a password of 8 to 128 characters, plus the company name, phone and address. The address matters: it decides the country, and the country decides whether you are priced in Canadian or US dollars.",
            "**Trades** — “What trades does your company work in?” Pick every trade that applies; this narrows the quote types you will see.",
            "**Services** — “Which services do you offer?” The usual quote types for your trades are preselected. Turn on the ones you offer; you can change this any time under Settings → Services & Pricing.",
            "**Plan** — “Choose your plan”: the four plans in your currency, then how you want to be billed. Press **Continue to Payment** to go to checkout.",
          ] },
          { note: "The signup form itself is in English. The app, once you are in, follows the language you choose — see [[choose-your-language|Choose your language]]." },
        ],
      },
      {
        id: "choosing-a-plan",
        heading: "Choosing a plan",
        blocks: [
          { table: {
            head: ["Plan", "A month", "Seats", "Crew logins"],
            rows: [
              ["Solo", "99", "1", "5, free"],
              ["Crew", "169", "3", "8, free"],
              ["Shop", "269", "6", "11, free"],
              ["Scale", "369", "10", "15, free"],
            ],
          } },
          { p: "The number is the same in both currencies: a Canadian company pays 99 Canadian dollars, an American one 99 US dollars. A **seat** is somebody who can create or change a quote, job or invoice; a **crew login** is someone who sees their schedule, clocks in and sends photos, and costs nothing. Full detail: [[your-plan-and-seats|Your plan and seats]]." },
          { p: "Under the plan cards, **No commitment** bills monthly and can be cancelled any time; **1 year commitment** bills once a year for the price of ten months — two months free. A team bigger than Scale is priced by hand: the **Need more than Scale?** card leads to the contact page." },
        ],
      },
      {
        id: "the-card-and-the-free-month",
        heading: "The card, and the free month",
        blocks: [
          { p: "**Continue to Payment** creates the company and opens Stripe Checkout. Stripe takes the card; FieldQuo never sees the number. The line above the button says it plainly: **Free first month**, then the plan price. Nothing is charged today — the free month is 30 days from the moment the company is created, and the first charge lands when it ends. See [[free-first-month|The free first month]]." },
          { warning: "If you close the checkout tab, the company exists but has no card, and every screen under the app is closed until it does. Signing in again lands you on **One step left** — “{company} is set up — it just needs a card before you can use it” — with the plan step ready to finish." },
          { tip: "Arrived through another contractor's referral link? The banner on the form says so, and one extra free month is added to your trial. The person who referred you earns a month once you are a paying customer. See [[referral-months|Referral months]]." },
        ],
      },
      {
        id: "after-checkout",
        heading: "After checkout",
        blocks: [
          { p: "Stripe sends you back to the dashboard. A short walkthrough points at the sidebar the first time; you can replay it later from Help — see [[replay-the-setup-walkthrough|Replay the setup walkthrough]]. The card **Finish setting up FieldQuo** lists what is still missing, and, for owners and administrators, the sidebar shows **Trial started · N days left** until the first payment." },
          { bullets: [
            "[[your-first-day-setup-checklist|Your first day: the setup checklist]] — what to do in what order.",
            "[[company-settings-basics|Company settings basics]] — the address, taxes and hours the signup form did not ask for.",
            "[[connect-stripe-and-get-verified|Connect Stripe]] — so the first invoice can be paid online.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Do I have to give a card to try it?", a: "Yes — at checkout, through Stripe. Nothing is charged during the free month, and you can cancel before it ends from Account & Billing." },
      { q: "Can I pick the currency?", a: "No. It is read from the address you gave. The two price lists carry the same numbers, so there is nothing to choose between." },
      { q: "I already use FieldQuo at work. Can I sign up my own business too?", a: "One login owns one business. Sign up your own company with a different email address." },
      { q: "Can I change plan later?", a: "Yes, from Account & Billing — see [[change-your-plan|Change your plan]]. Moving up takes effect straight away." },
    ],
  },

  "your-first-day-setup-checklist": {
    title: "Your first day: the setup checklist",
    summary:
      "The two cards on your dashboard that list what is still missing, what each item unlocks, and a sensible order to do them in.",
    updated: "2026-09-12",
    intro: [
      "After signup the dashboard carries two cards that exist only until the work is done: **Finish setting up FieldQuo**, the short list of things a company needs before its first quote can go out, and **Additional set-up steps**, the longer list of things worth doing in the first week. Neither is decorative — each row is measured against the database and disappears the moment it is true.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The first card is about being able to send a quote and get paid. The second is about the quote being good — the right terms, the right costs, your own emails. Do the first card today; spread the second over the week." },
        ],
      },
      {
        id: "finish-setting-up",
        heading: "The “Finish setting up FieldQuo” card",
        blocks: [
          { p: "Each row is a link to the screen that completes it, ticked automatically once it is done. The card says **A few steps left before you're fully up and running** until every row is ticked, then it goes away for good." },
          { bullets: [
            "**Add your logo and brand color** → Settings → Branding. Done once a logo is uploaded. See [[set-up-your-branding|Set up your branding]].",
            "**Complete your business address and phone** → Company Settings. Done when phone, address, city and province are all filled in.",
            "**Choose the services you offer** → Services & Pricing. Done when at least one quote type is turned on.",
            "**Set your pricing for at least one service** → Services & Pricing. Done when one turned-on quote type has a rate.",
            "**Connect Stripe to accept client payments** → Payments. Done when Stripe reports charges enabled. See [[connect-stripe-and-get-verified|Connect Stripe and get verified]].",
            "**Invite your team** → Manage Team. Done when somebody other than you has been brought in. This row is left out entirely if you have told Manage Team you work alone.",
            "**Add your tax registration number** → Company Settings. Done when the number is entered, or when you have said your business is not registered for it.",
          ] },
          { note: "The rows are only ever removed, never dismissed. If you cannot finish one — a solo shop with the team row — say so on the screen the row points at, and the row stops applying." },
        ],
      },
      {
        id: "additional-set-up-steps",
        heading: "The “Additional set-up steps” card",
        blocks: [
          { p: "Ten more rows, shown to owners, administrators, dispatchers and managers, each with a **Done, hide** button. A row also vanishes on its own once the database says it is done. The card opens by itself while three or more rows remain, and folds once fewer are left." },
          { bullets: [
            "**Enter your overhead** — fixed costs, salaries, debt and assets, so a job's break-even price can be worked out. [[overhead-and-your-minimum-price|Overhead]].",
            "**Set up your payment schedule** — a deposit and progress stages on Company Settings. [[deposits-and-payment-schedules|Payment schedules]].",
            "**Review the job process on your quotes** — the wording under each quote type on Services & Pricing.",
            "**Add AI credits** — for the phone receptionist and AI images; FieldQuo AI itself is included. [[ai-credit-and-phone-credit|AI credit]].",
            "**Enable instant quotes** — homeowners get a starting estimate from your website. [[instant-quotes-on-your-website|Instant quotes]].",
            "**Check your availability for bookings** — the bookable hours on your booking page. [[working-hours-and-bookable-hours|Your hours]].",
            "**Review cost and material recipes** — what a job costs you in materials. [[cost-and-margin-on-a-quote|Cost and margin]].",
            "**Review your add-ons** — the upsell items a client can accept on a quote. [[upsell-add-ons|Add-ons]].",
            "**Review your emails** — your own domain, an edited template, or the references section on the quote email. [[email-templates|Email templates]].",
            "**Import older jobs** — work done and paid before FieldQuo, so the year's numbers are whole. [[import-past-jobs|Import past jobs]].",
          ] },
        ],
      },
      {
        id: "a-sensible-order",
        heading: "A sensible order for the first day",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings** and finish the address, phone, opening hours and tax settings. [[company-settings-basics|Company settings basics]].",
            "Open **Branding** and upload the logo and pick the brand colour. Every document from now on carries it.",
            "Open **Services & Pricing**, turn on what you sell and put a rate on at least one.",
            "Open **Payments** and connect Stripe, then finish whatever Stripe asks for.",
            "Import your clients from a CSV, so the first quote goes to a client who already exists. [[import-clients-from-a-csv|Import clients]].",
            "Send yourself a test quote. What arrives is exactly what a client gets.",
          ] },
        ],
      },
      {
        id: "who-sees-the-cards",
        heading: "Who sees the cards",
        blocks: [
          { p: "The **Finish setting up FieldQuo** card appears on everybody's dashboard while it is incomplete, because its rows are facts about the company. The **Additional set-up steps** card is shown only to people who can manage the company — owners, administrators, dispatchers and managers — because every row on it opens a settings screen a crew member or estimator cannot change." },
        ],
      },
    ],
    faq: [
      { q: "Can I hide the first card?", a: "No. Its rows are removed when they are done, or when you tell the screen they point at that the item does not apply — for example, that you work alone." },
      { q: "I hid a step by mistake.", a: "Hiding is per company and there is no undo button. The screen the step pointed at is still in the Settings menu; the work is the same." },
      { q: "Why is there no “invite your team” row for me?", a: "Because you told Manage Team you work alone. The row comes back, already ticked, the day somebody is invited." },
    ],
  },

  "the-sidebar-and-where-everything-is": {
    title: "The sidebar, and where everything is",
    summary:
      "Home, five groups, FieldQuo AI, Help, Plan and Settings — every row of the main menu and the Settings menu, and why some rows are missing for some people.",
    updated: "2026-09-12",
    intro: [
      "The back office is one sidebar. Learn its shape once and you know where everything is: Home at the top, five groups in the order work moves, and the tools — FieldQuo AI, Help, Plan, Settings — under a rule at the bottom.",
      "On a phone the same menu is a drawer behind the menu button, and the four pipeline screens plus Chat sit in a bar along the bottom.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Above the menu is a **Create** button — a quick way to start a Client, Lead, Quote, Job or Invoice — and a **Search menu** box that finds any row by typing its name, including the rows at the bottom. Then **Home**, the dashboard. Every group heading except **Work** folds and unfolds — Work stays open because it is the pipeline; all five are open the first time you sign in, and FieldQuo remembers what you fold." },
        ],
      },
      {
        id: "the-five-groups",
        heading: "The five groups, top to bottom",
        blocks: [
          { table: {
            head: ["Group", "Rows"],
            rows: [
              ["**Work**", "Leads · Quotes · Quote reviews · Jobs · Invoices · Service Plans · Calendar · To-do"],
              ["**People**", "Clients · Client equipment · Chat · Your team · Subcontractors · Assign shifts · Team calendar · Time clock · Timesheets · Time Off · Safety"],
              ["**Money**", "Payroll · Expenses · Purchasing · Vehicles"],
              ["**Insights**", "Insights · KPIs"],
              ["**Grow**", "Marketing · Designer · Funnels · Receptionist · Crew inbox · Messages · Refer & Earn"],
            ],
          } },
          { figure: "live:app", caption: "Home — the sidebar with Create, Search menu, Home and the five groups, the dashboard beside it." },
          { p: "Under the rule: **FieldQuo AI**, then **Help**, **Plan** and **Settings**, and an **Appearance** switch for light, dark or system. The footer holds your name — which opens Account & Billing if you are an owner or administrator — the **Trial started · N days left** badge during the free month, **Log Out**, and the button that collapses the rail to icons." },
        ],
      },
      {
        id: "the-settings-menu",
        heading: "The Settings menu",
        blocks: [
          { p: "**Settings** opens a second menu and lands on Company Settings. It has eight groups, closed by default so it reads as an index, with the group you are in opened, and a **Search settings** box at the top." },
          { bullets: [
            "**Account** — Account & Billing · Refer & Earn · Data Migration · Product Updates",
            "**Business** — Company Settings · Branding · Language · Activity Log",
            "**Team & scheduling** — Manage Team · Availability · Time Off Policies · Booking Page · Work Areas",
            "**Services & pricing** — Products & Services · Services & Pricing · Material Costs · Cabinet Pricing · Overhead · Custom Fields",
            "**Documents & templates** — Quote Email · Email Templates · PDF Templates · Translations · Checklists · Job photo tags",
            "**Messaging & alerts** — Client messages · Follow-ups · Notifications · Email Domain",
            "**Getting paid** — Payments · Meta Ads · Expense Tracking · AI credit · Payroll",
            "**Client-facing** — Your website · Instant Quotes · Share your links · Bio link · Phone receptionist · AI employee · Reviews",
          ] },
          { figure: "live:app-settings", caption: "Settings — the eight groups down the left, Company Settings open." },
        ],
      },
      {
        id: "on-a-phone",
        heading: "On a phone",
        blocks: [
          { p: "Below the width of a laptop the rail becomes a drawer: the menu button at the top opens it, the logo at the top goes Home. A bar along the bottom holds **Leads**, **Quotes**, **Jobs**, **Invoices** and **Chat**, and a **More** tab that opens the same drawer — not a second menu. See [[using-fieldquo-on-your-phone|Using FieldQuo on your phone]]." },
        ],
      },
      {
        id: "rows-you-may-not-see",
        heading: "Rows you may not see",
        blocks: [
          { p: "A missing row is not a fault. The sidebar hides what the signed-in person's access level does not allow, and the page behind a hidden row refuses them too — hiding is a courtesy, the refusal is the security." },
          { bullets: [
            "**Quotes, Jobs, Invoices, Leads** need at least view access to that area. Crew can only view jobs, so a crew member's Work group is Jobs, Calendar and To-do.",
            "**Clients, Client equipment, Receptionist** need full view of client records. **Insights** needs the see-prices switch; **KPIs** needs job costing.",
            "**Your team, Team calendar, Quote reviews, Subcontractors, Vehicles, Marketing, Designer, Funnels** are owner, administrator, dispatcher and manager. **Plan** and **Refer & Earn** are owner and administrator only.",
            "**Cabinet Pricing** and **Material Costs** appear only for trades that price that way. Every rule is in [[access-levels-overview|Access levels]] and [[the-settings-menu|The Settings menu]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Where are my clients' texts and Facebook messages?", a: "Under Grow → Messages. Crew inbox, beside it, is where your own crew's texted photos land." },
      { q: "Why is there a row I cannot find in this list?", a: "Type it into Search menu. If nothing matches, it is hidden for your access level — ask an owner or administrator." },
      { q: "Where do I change my plan?", a: "Plan, at the bottom of the sidebar — the same screen as Settings → Account & Billing. Owners and administrators only." },
    ],
  },

  "the-dashboard": {
    title: "The dashboard: what is waiting on you",
    summary:
      "Home opens with what needs a person today, then this month's revenue, four tiles, and the detail underneath — each figure shown only when it is known.",
    updated: "2026-09-12",
    intro: [
      "**Dashboard — Here's what's happening with your business.** The page answers one question first — what is waiting on you today — then shows the money figure, four supporting tiles, and everything else below a line called **The detail**.",
      "A figure that is not known is not shown. A member without the see-prices switch gets no revenue tile rather than a tile reading zero, because “$0 this month” is a statement about the business, not a blank.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every number on the page comes from the same sources as the Invoices and Quotes lists — nothing is computed twice. The three buttons under the tiles are **+ New quote**, **View Clients** and **Schedule Appointment**; the first one appears only for someone who may create quotes." },
        ],
      },
      {
        id: "waiting-on-you",
        heading: "Waiting on you",
        blocks: [
          { p: "The first block, above everything, holds the only content on the page that is waiting on the reader. It renders itself away when there is nothing, so a quiet company is not accused of a backlog." },
          { bullets: [
            "**Overdue invoices**, by client and amount, up to five, each with **N days past due** and a **Chase payment** button that emails the client a payment request there and then. More than five shows **N more overdue**, linking to Invoices.",
            "**N waiting for you to approve the price** — instant estimates that need a person before they can be sent. Opens Quote reviews.",
            "**N from your receptionist — nothing done yet** — calls the phone receptionist took that nobody has acted on. Opens Receptionist.",
            "The next appointment the receptionist booked, if there is one. Opens Calendar.",
          ] },
          { note: "An invoice with no due date is not overdue and never appears here. The block says what is late, not what is owed." },
        ],
      },
      {
        id: "the-figures",
        heading: "Revenue this month, and the four tiles",
        blocks: [
          { figure: "live:app", caption: "Home — Waiting on you, then Revenue this month with its sparkline, then the four tiles." },
          { p: "**Revenue this month** is **the total of invoices marked paid this month**; the sparkline beside it draws the money that actually landed, month by month, and the **Trend** link opens that chart. A sentence under it compares the last two complete months — never a part-month against a whole one." },
          { table: {
            head: ["Tile", "What it counts"],
            rows: [
              ["**Quotes sent this month**", "Quotes created this month that have gone out — sent, and since accepted or declined — with how many more or fewer than last month."],
              ["**Conversion rate**", "% of sent quotes clients accepted, shown as “accepted of sent”."],
              ["**Money owed**", "Every unpaid invoice's balance, and how much of that is past due."],
              ["**Upcoming visits**", "Visits ahead on the calendar."],
            ],
          } },
          { note: "A conversion rate needs **10 quotes sent in the month** before it is printed. Below that the tile shows the counts only — 50% off two quotes is a number you would act on and should not." },
        ],
      },
      {
        id: "the-detail",
        heading: "The detail",
        blocks: [
          { bullets: [
            "**Money received** — a bar chart of payments by the month they were received, switchable between 3, 6 and 12 months. The caption says it is a different measure from the revenue tile.",
            "**Money owed** — the receivables ladder: not yet due, 1–30, 31–60, 61–90 and 90+ days, then each owed invoice with its contact, its last chase, and a Chase payment button. A line says whether an automatic overdue reminder is set up, with **Set one up** or **Change it**.",
            "**Revenue goal** — a yearly target and whether you are ahead of or behind pace. Owners and administrators set it. [[the-revenue-goal|The revenue goal]].",
            "Bookings held for a visit fee that has not landed, and a **Data migration** notice when FieldQuo has quoted a migration for you.",
            "**Recent Quotes** and **Upcoming Appointments**, each with **View all**.",
          ] },
          { p: "The two set-up cards — **Finish setting up FieldQuo** and **Additional set-up steps** — sit between the first block and the revenue figure until they are done. See [[your-first-day-setup-checklist|Your first day]]." },
        ],
      },
      {
        id: "who-sees-what",
        heading: "Who sees what",
        blocks: [
          { p: "Revenue, quotes sent, conversion and money owed need the **See prices** switch; a crew member sees Upcoming visits and their own appointments. Chase payment needs edit access to invoices. The revenue goal can be set by owners and administrators; everyone else with prices sees it. Everything else on the page follows the same rules as the list it links to. See [[the-dashboard-in-detail|The dashboard in detail]]." },
        ],
      },
    ],
    faq: [
      { q: "Why does Revenue this month not match Money received?", a: "They answer different questions. The tile totals invoices marked paid this month; the chart counts payments by the month they arrived. A December invoice paid in January is in January's bar." },
      { q: "Why is there no percentage on my conversion tile?", a: "Fewer than 10 quotes were sent this month. The counts are shown instead; the percentage appears once the sample is big enough to mean something." },
      { q: "Why is a tile missing altogether?", a: "The figure is not known — either your access level does not include prices, or the request failed and a Retry is offered above the tiles. Nothing is ever shown as zero in its place." },
    ],
  },

  "company-settings-basics": {
    title: "Company settings basics",
    summary:
      "The first screen after signup: your details, opening hours, taxes, payment terms and regional preferences, and what each one changes on your documents.",
    updated: "2026-09-12",
    intro: [
      "**Company Settings — Your business details, hours, taxes, and regional preferences.** It is where the Settings row lands, and it holds everything the signup form did not ask: the address as it prints on a quote, the tax number at its foot, the hours your website shows, and the terms every new quote starts with.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is a column of cards. Most of them save together with the **Update Settings** button at the bottom; three — the payment schedule, the opening hours and the booking availability — have their own save, because each writes a different thing." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { table: {
            head: ["Card", "What it holds"],
            rows: [
              ["**Scope of work and terms**", "The **Default scope of work** copied onto every new quote, with trade templates to start from, and the **Payment terms** line."],
              ["**Payment schedule**", "Stages tied to the job — a deposit when the invoice goes out, a share at job start, halfway, or completion. Off until you add a stage."],
              ["**Industry & Quote Types**", "The trades you said you work in and the quote types that unlocked, with **Manage** to change them on Services & Pricing."],
              ["**Company Details**", "Company name, phone number, email address, website URL, your subdomain, street address, postal code and country."],
              ["**Opening hours**", "When the business is open — shown on your website and used for the hours in Google search results."],
              ["**Booking availability**", "Which times can be booked online, per day. Separate from opening hours on purpose."],
              ["**Tax Settings**", "Tax ID name and number, **Tax Rates** with a default, and whether to apply the client's local rate automatically."],
              ["**Industry benchmark**", "A switch to share your anonymised figures and unlock the comparison on Insights."],
              ["**Regional Settings**", "Billing currency, time zone, date format and first day of the week."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Company Settings — the cards top to bottom, Update Settings at the end." },
        ],
      },
      {
        id: "how-to-save",
        heading: "How to fill it in",
        blocks: [
          { steps: [
            "Type the details, terms, taxes and regional preferences, then press **Update Settings** at the bottom. **Saved** appears beside the button.",
            "In **Opening hours**, set each day or mark it **Closed**, use **Apply {day}'s times to every open day** to copy one day, and press **Save opening hours** — this card saves on its own.",
            "In **Booking availability**, press **Edit** to set the bookable hours; the card shows each day's window or **Closed**.",
            "In **Payment schedule**, press **Add a stage**, name it, pick when it falls due and its percent; the stages must total exactly 100% before **Save schedule** works.",
          ] },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "What each setting changes",
        blocks: [
          { bullets: [
            "**Country** is filled in automatically from the address, and it sets the **Billing currency** and the tax jurisdiction a quote falls back to. Tick **I serve clients outside my country** to bill in other currencies.",
            "**Tax ID name and number** print at the foot of every quote and invoice. FieldQuo prints what you enter; it does not register you or file anything.",
            "**Automatically apply the local tax rate of the client** matches the client's province against your rates; with no match, your default rate is used and the quote says so.",
            "**Date format** applies to your own screens only — client documents follow the client's language. **First day of the week** changes how calendars and hour grids start.",
            "A saved **Payment schedule** generates the payment terms text, so the document always matches what actually bills; **Turn off — go back to free text** clears every stage.",
            "**Opening hours** are a company-level fact; **Booking availability** is per person. The office can be open on a day nobody is free to visit.",
            "The **Industry benchmark** switch pools your numbers with other companies, never shown individually, and can be turned off any time.",
          ] },
          { warning: "**Every day is marked closed** means no hours appear on your website or in search results. A partial week is published as a partial week — FieldQuo never invents a Monday-to-Friday for you." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Who can edit it",
        blocks: [
          { p: "Owners, administrators, dispatchers and managers can change every card. Estimators and crew open the same page read-only, headed **These are your company's details as clients see them**. See [[settings-company|Company Settings]] for the full reference, and [[opening-hours|Opening hours]] and [[tax-settings|Tax settings]] for the two cards with the most consequences." },
        ],
      },
    ],
    faq: [
      { q: "I changed the address. Why did the currency not change?", a: "The currency follows the country, and the country is read from the address. If the country changed, the currency changed with it; if only the street did, nothing about money moves." },
      { q: "Where do I set my own working hours?", a: "Under Settings → Availability, per person. Company Settings holds the opening hours the public sees." },
      { q: "Why does the payment terms box refuse to let me type?", a: "A payment schedule is on, and the terms are generated from it. Turn the schedule off to write free text again." },
    ],
  },

  "set-up-your-branding": {
    title: "Set up your branding",
    summary:
      "Upload the logo, pick a primary colour, and every quote, invoice, email, booking page and website page carries it — measured for contrast, never inside the app.",
    updated: "2026-09-12",
    intro: [
      "**Branding — Your logo and brand color appear on every quote, invoice, and email your clients see.** One screen, one save, and from then on a homeowner reading your quote sees your company, not a software product.",
      "The colour is not applied naively. Every text-on-background pairing on a client-facing surface is computed from your one brand hex and measured for contrast, so a yellow, a white or a mid-grey still prints legibly.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Three cards and a preview. Only the primary colour is required; the others follow sensible defaults from it. Nothing here changes your team's screens — the back office stays neutral so a bright brand colour never makes it hard to work in." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Logo** — the current logo or **No logo**, and **Upload logo** / **Replace logo**. PNG, JPG, WebP or SVG, up to 8 MB.",
            "**Brand Colors** — **Primary** and **Secondary**, each with six preset swatches, a custom colour picker and a **Reset** link once set.",
            "**How your documents will look** — a quote header previewed in **Light** and **Dark**.",
            "**Neutral** — the email header bar colour, and a **Preview** of roughly how the top of your emails will look with your logo and company name.",
          ] },
          { figure: "live:app-settings-branding", caption: "Branding — the Logo card, Brand Colors, the light and dark document preview." },
        ],
      },
      {
        id: "how-to",
        heading: "How to set it up",
        blocks: [
          { steps: [
            "Open **Settings → Branding**.",
            "Press **Upload logo** and choose the file. It is uploaded straight away and shown in the card; nothing is saved to your documents yet.",
            "Pick a **Primary** colour — a preset, or the picker for your exact hex.",
            "Optionally pick a **Secondary** and a **Neutral**. Leave them unset to inherit from the primary and the default dark header.",
            "Press **Save Branding**. **Saved ✓** confirms it, and the next quote you open already carries it.",
          ] },
          { warning: "If the page cannot load your current branding it refuses to show the form at all, with a **Retry** button — so a failed load can never save default colours over your real ones." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "What each setting changes",
        blocks: [
          { table: {
            head: ["Setting", "Where it shows"],
            rows: [
              ["**Logo**", "The header of every quote, invoice and PDF; the email header; the booking page; your website; the client portal."],
              ["**Primary**", "Buttons, progress bars and your name in the email header; the accent on every client-facing page."],
              ["**Secondary**", "Supporting accents, like section titles on itemised lists. Defaults to the primary."],
              ["**Neutral**", "The email header bar. Defaults to a dark tone, which reads as more premium than a saturated colour."],
            ],
          } },
          { note: "The colours never appear inside the app. Your team's screens stay the same whatever you pick." },
        ],
      },
      {
        id: "contrast",
        heading: "Why a yellow logo still prints legibly",
        blocks: [
          { p: "Contractors pick yellow, white, black and mid-grey, and the naive rule — “dark colour, white text” — fails on all of them. FieldQuo does not guess: it measures every text and background pairing derived from your hex and picks ink and wash colours that pass a 4.5:1 contrast ratio. The Light and Dark previews on this page are the same maths, so what you see is what the client gets. Full detail: [[settings-branding|Branding]] and [[nothing-says-fieldquo|Nothing says FieldQuo]]." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Who can edit it",
        blocks: [
          { p: "Owners, administrators, dispatchers and managers. The save is refused on the server for anyone else, whatever the screen shows." },
        ],
      },
    ],
    faq: [
      { q: "My logo upload fails.", a: "Check the format — PNG, JPG, WebP or SVG — and the size, 8 MB at most. A larger file is rejected before it is stored." },
      { q: "Does the brand colour change the emails' From line?", a: "No. The From line is your company name, and your own address once a domain is verified — see [[send-from-your-own-domain|Send from your own domain]]." },
      { q: "Can I preview a real quote with the new colours?", a: "Yes — save, then open any quote's client page. The preview on this screen is the same theme maths, but a real document is the honest test." },
    ],
  },

  "choose-your-language": {
    title: "Choose your language, and your company's",
    summary:
      "Your language is what you read the app in; the company default is what teammates and clients inherit. Documents keep the language they were created in.",
    updated: "2026-09-12",
    intro: [
      "There are two settings on the **Language** screen, and they mean different things. **Your language** is personal — what you read the back office in. **Company default** is what everyone who has not chosen inherits, and the language a quote or invoice goes out in when the client has none of their own.",
      "Neither touches a document that already exists. A quote keeps the language it was created in, forever — a signed PDF must keep saying what it said.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Eight languages are offered: English, French, Spanish, Ukrainian, Punjabi, Tagalog, German and Italian. Each row shows how much of the interface is translated; the rest falls back to English. A document, a PDF or an email to a client is translated per document, so every one of the eight is complete there." },
        ],
      },
      {
        id: "your-language",
        heading: "Your language",
        blocks: [
          { steps: [
            "Open **Settings → Language**.",
            "Under **Your language**, press a language — or **Match company default** to follow whatever the company uses.",
            "It saves the moment you press it; the interface switches, and **Currently showing:** names the language in force.",
          ] },
          { figure: "live:app-settings-language", caption: "Language — Your language with the coverage on each row, and the Company default card below." },
        ],
      },
      {
        id: "company-default",
        heading: "Company default",
        blocks: [
          { p: "The second card, **Company default**, is **used for team members who haven't picked a language, and for quotes and invoices to clients who don't have one set**. Owners, administrators, dispatchers and managers can press a language here; everyone else sees it as a fact, headed **This is the language new team members and clients without one of their own receive**." },
          { note: "**Changing this moves everyone who hasn't set their own language. It does not change quotes already sent — those keep the language they were sent in.**" },
        ],
      },
      {
        id: "what-the-labels-mean",
        heading: "What the coverage labels mean",
        blocks: [
          { table: {
            head: ["Label", "Meaning"],
            rows: [
              ["**Interface 100%**", "Every screen is translated and a fluent speaker has reviewed it. English and French today."],
              ["**Interface 100% · needs review**", "Every string is translated but no native speaker has checked it yet. Spanish, German and Italian today."],
              ["**Interface N%**", "Part of the interface is translated; the rest shows in English. Ukrainian, Punjabi and Tagalog today."],
            ],
          } },
        ],
      },
      {
        id: "your-clients",
        heading: "What your clients get",
        blocks: [
          { p: "A client's language lives on the client record and drives everything they receive: the quote, the invoice, the PDF, the covering email, the texts. When a client has none, the company default applies. Set it once on the client — see [[a-clients-language|A client's language]] — and read [[quote-language|A quote keeps its language]] for what happens to a document after it is sent. The wording of your own services in another language is drafted and reviewed on [[settings-translations|Translations]]." },
        ],
      },
    ],
    faq: [
      { q: "I switched to Spanish and some screens are still in English.", a: "Spanish is fully translated but marked needs review; a string that is missing falls back to English rather than showing a blank. The label on the row is the honest coverage." },
      { q: "If I change the company default, will old quotes change?", a: "No. A document keeps the language it was created in. Only new documents, and teammates who never chose, follow the new default." },
      { q: "Can a crew member change their own language?", a: "Yes. Your language is personal and open to every member; only the company default is restricted." },
    ],
  },

  "import-clients-from-a-csv": {
    title: "Import clients from a CSV",
    summary:
      "Load the client list from your old system in one go — the columns FieldQuo reads, what it skips, and what it never de-duplicates.",
    updated: "2026-09-12",
    intro: [
      "**Import Clients — Upload a CSV exported from another system.** The file is read in your browser, the first three rows are shown back to you, and one press writes them all. Every row becomes a client card exactly as if you had typed it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The importer takes names and contact details only — no jobs, no invoices, no history. For work already done and paid, use [[import-past-jobs|Import past jobs]]; for a whole archive, [[the-data-migration-service|The data migration service]]." },
        ],
      },
      {
        id: "prepare-the-file",
        heading: "Prepare the file",
        blocks: [
          { p: "Export a CSV from wherever the list lives now. FieldQuo matches column names without caring about case, and accepts the common variants." },
          { table: {
            head: ["Column", "Headers accepted", "Required"],
            rows: [
              ["Name", "name, Name, Full Name", "Yes — a row without one is skipped"],
              ["Email", "email, Email", "No, but a row with an undeliverable address is skipped"],
              ["Phone", "phone, Phone, Phone Number", "No"],
              ["Address", "address, Address", "No"],
              ["City", "city, City", "No"],
              ["Province", "province, Province, State", "No"],
              ["Country", "country, Country", "No — normalised to a code, or left blank"],
            ],
          } },
          { tip: "A business client with a contact person: put the company in **name** and add the person on the card afterwards — see [[business-clients-and-contacts|Business clients and contacts]]." },
        ],
      },
      {
        id: "how-to",
        heading: "How to import",
        blocks: [
          { steps: [
            "Open **Clients** and press **Import**, beside **New Client**.",
            "Press **Click to choose a CSV file** and pick the file.",
            "Read **Found N rows. Preview of the first 3:** — each line shows the name and the email or phone, or **no contact info**.",
            "Press **Import N clients**.",
            "The result reads **Imported N clients**, with **(N skipped — missing a name)** and **(N skipped — the email address can't be delivered to)** when they apply. **View Clients** opens the list.",
          ] },
          { figure: "live:app-clients", caption: "Clients — every client as a card, with Import and New Client at the top." },
        ],
      },
      {
        id: "what-happens-to-each-row",
        heading: "What happens to each row",
        blocks: [
          { bullets: [
            "A row with no name has nothing to import and is counted as skipped.",
            "A row whose email cannot be delivered to is left out and counted separately, rather than imported with the address quietly dropped — a client who looks contactable and is not is how a quote gets sent to nowhere. An empty email is fine.",
            "A country written as a word (“Canada”, “CAN”) is normalised to its code, or left blank when it cannot be read. It is never stored as free text.",
            "**Nothing is de-duplicated.** Importing the same file twice creates every client twice. See [[duplicate-clients|Duplicate clients]] for cleaning up.",
          ] },
        ],
      },
      {
        id: "who-can-import",
        heading: "Who can import",
        blocks: [
          { p: "Anyone whose access lets them add clients — **View and edit full client and property info** or above: estimators, dispatchers, managers, administrators and the owner. The Import button is offered only to them, and the page refuses everyone else before a file is chosen." },
        ],
      },
    ],
    faq: [
      { q: "Can I import a spreadsheet directly?", a: "Save it as CSV first. Excel and Google Sheets both export one; keep the header row." },
      { q: "Does it import notes, jobs or invoices?", a: "No — name, email, phone and address only. Past jobs have their own importer, and a full history is the migration service." },
      { q: "Half my rows were skipped for bad emails. What now?", a: "Fix or clear the email cells for those rows, delete the others from the file, and import the corrected rows again. The rows that already imported are not affected." },
    ],
  },

  "import-past-jobs": {
    title: "Import past jobs from your old system",
    summary:
      "Record work that was won, done and paid before FieldQuo — one job at a time or a year in one CSV — so the year's numbers are whole, and nothing is sent to the client.",
    updated: "2026-09-12",
    intro: [
      "**Past jobs — Record jobs you did and were paid for before using FieldQuo, so the year's numbers are whole.** The page says the important thing in its own words: **This is data entry: nothing is emailed, texted or called to the client, now or later.**",
      "Each past job becomes a quote, a completed job and a paid invoice, dated as you type them, so revenue, estimate accuracy and the client's history all read correctly from the day you switched.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Two ways in: **Enter one past job**, a form, or **Or upload a year at once**, a CSV reviewed row by row before anything is written. Both reach the page from **Past jobs** on the Jobs list, and from the **Import older jobs** row on the dashboard's set-up card." },
        ],
      },
      {
        id: "what-is-created",
        heading: "What is created",
        blocks: [
          { p: "For each past job: the client, if new; a quote marked accepted; a job marked completed; an invoice marked paid, with a payment on the date you gave, by cash, cheque, e-transfer or a card taken elsewhere; and, if you gave labour or materials costs, an expense for each. Every record carries the note **Entered as a past job**, and every cron and send button skips them." },
        ],
      },
      {
        id: "one-at-a-time",
        heading: "Enter one past job",
        blocks: [
          { steps: [
            "Open **Jobs → Past jobs**.",
            "Under **Client**, **Pick an existing client** or choose **New client** and type the name, email, phone and address.",
            "Fill the service, description, job start and end dates, the amount before tax, whether **Tax was charged on this job** (worked out from your rate on the job date), the paid date and **Paid by**. Labour cost, materials cost, quote and invoice numbers are optional.",
            "Press **Enter this past job**.",
            "The confirmation reads **Entered {title} — {total} paid {date}**, with **Open the job** and, if one was created, **New client added: {name}**.",
          ] },
          { figure: "live:app-jobs", caption: "Jobs — the list with its status chips; Past jobs sits beside New Job at the top." },
        ],
      },
      {
        id: "a-year-at-once",
        heading: "Upload a year at once",
        blocks: [
          { p: "**Download the template** gives you the exact headers. One row per job, up to **500** rows per file; the page explains each column under **What each column means**." },
          { table: {
            head: ["Required column", "What goes in it"],
            rows: [
              ["client_name", "The client, matched to an existing card by contact details or created."],
              ["description", "What the job was."],
              ["job_start", "A date written YYYY-MM-DD."],
              ["amount_before_tax", "The price, more than zero."],
              ["paid_date", "When you were paid — never in the future, never before the job started."],
              ["payment_method", "cash, cheque, e_transfer or card_elsewhere."],
            ],
          } },
          { p: "Optional: client_email, client_phone, client_address, service, job_end, tax_applied (yes/no), labour_cost, materials_cost, quote_number, invoice_number." },
          { steps: [
            "Press **Choose a CSV file**. Every row is checked on the server and shown back with a **Status**: **Ready**, **Already on file**, or the fields to fix.",
            "Read the summary — **ready to enter**, **already on file**, **need fixing**, **new clients** — and fix anything flagged in the file.",
            "Press **Enter N past jobs**. The result reads **Entered N past jobs.** and, when it applies, **N were already on file and were left alone.**",
          ] },
        ],
      },
      {
        id: "duplicates-and-errors",
        heading: "Duplicates and errors",
        blocks: [
          { bullets: [
            "A job is **Already on file** when the client name, job start, amount and paid date all match one entered before. It is never entered twice — a file uploaded twice, or two tabs, cannot double your revenue.",
            "**Rows that need fixing are left out.** Fix them in the file and upload again; the rows that were ready go in without them.",
            "A file longer than 500 rows is cut: **Only the first 500 rows were read. Put the rest in a second file.**",
            "A quote or invoice number you supply must not already exist, and must not look like a live FieldQuo number.",
          ] },
        ],
      },
      {
        id: "who-can-enter",
        heading: "Who can enter past jobs",
        blocks: [
          { p: "Someone who may create quotes, jobs and invoices and can see prices: dispatchers, managers, administrators and the owner. Rows that create a new client also need the level that adds clients. An estimator can write quotes but not jobs or invoices, so this screen refuses them." },
        ],
      },
    ],
    faq: [
      { q: "Will the client get an email?", a: "No. Not on entry, not from a follow-up rule, not from a review request. The page says so and the server keeps it." },
      { q: "Do past jobs count in my dashboard and reports?", a: "Yes — that is the point. Revenue, money received, win rate and the client's history all include them, dated when they happened." },
      { q: "I entered one with the wrong amount.", a: "Open the job and its invoice from **Open the job** and correct them like any other record. The natural key uses the amount, so re-entering the corrected row would create a second job — edit, do not re-import." },
    ],
  },

  "import-a-quote-from-another-system": {
    title: "Import a quote from another system",
    summary:
      "FieldQuo does not read a quote file from other software. Here are the four honest ways a quote made elsewhere ends up in your account, and which one fits.",
    updated: "2026-09-12",
    intro: [
      "There is no button that takes a Jobber, Housecall Pro or QuickBooks quote and turns it into a FieldQuo quote. That is deliberate rather than missing: a quote in FieldQuo is priced from your own price book on the server, and a file from elsewhere carries none of that.",
      "What you can do depends on what the quote is: a job already done and paid, a live quote you still need to send, a whole archive, or a quote another FieldQuo company sent you.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { table: {
            head: ["What you have", "What to do"],
            rows: [
              ["A quote for a job that was done and paid before FieldQuo", "Enter it as a past job — one form, or a CSV for the whole year. [[import-past-jobs|Import past jobs]]."],
              ["A live quote you still need to send", "Rebuild it in the quote builder from your price book. Ten minutes, and it is a real FieldQuo quote the client can approve online."],
              ["A whole history — years of quotes, invoices and clients", "The paid data migration service: FieldQuo's staff bring it in. [[the-data-migration-service|The data migration service]]."],
              ["A quote another FieldQuo company sent you, as a subcontractor", "Pull it into your own quote as a marked-up cost line from the quote page you received. [[import-a-subcontractor-quote|Import a subcontractor quote]]."],
            ],
          } },
        ],
      },
      {
        id: "rebuild-a-live-quote",
        heading: "Rebuild a live quote",
        blocks: [
          { steps: [
            "Import the client first if they are not on file — [[import-clients-from-a-csv|Import clients from a CSV]] — so the quote is addressed to an existing card.",
            "Open **Quotes → New Quote**, choose the client and the quote type.",
            "Add the lines from your price book, or type them; group by room or scope if the old quote did.",
            "Check the language before saving — a quote keeps the language it is created in — then send it. The client gets a page and a PDF with your branding and can approve online.",
          ] },
          { figure: "live:app-quotes", caption: "Quotes — the list with its status chips and New Quote." },
          { tip: "If the old quote was already approved and the job is under way, create the quote and mark it approved, then the job is made from it — see [[convert-a-quote-to-a-job|What happens when a quote is approved]]." },
        ],
      },
      {
        id: "a-quote-from-another-fieldquo-company",
        heading: "A quote from another FieldQuo company",
        blocks: [
          { p: "When a subcontractor who uses FieldQuo sends you their quote, the page you receive carries a card headed **Add this to one of your quotes** — shown only to a signed-in contractor of a different company, never to a homeowner. You pick which of your open quotes to add it to, a markup of 0, 10, 20 or 30 percent or a custom one, and whether your client sees **One line** or **Itemised**. Your client never sees the subcontractor or your markup. On your quote it appears under **Subcontractor costs**, where you can edit the markup or remove it while the quote is open." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "What FieldQuo does not do",
        blocks: [
          { bullets: [
            "It does not parse a PDF, a Word file or another product's export into a quote.",
            "It does not accept prices from the browser — every line on a quote is priced on the server from your own rows, which is why an outside file cannot become a quote directly.",
            "It does not import a quote through a public API; there is none. [[no-public-api-or-zapier|Integrations]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can FieldQuo staff enter my open quotes for me?", a: "Yes, as part of the paid migration service. The quotes they create are drafts you finish and send yourself; they never edit a quote that already exists." },
      { q: "I have a spreadsheet of quotes. Is there a CSV import?", a: "Not for quotes. For clients there is; for jobs already done and paid there is. A live quote is rebuilt in the builder." },
      { q: "Will an imported past job's quote show as sent to the client?", a: "It is marked accepted and dated as you typed it, and nothing is ever sent to the client about it." },
    ],
  },

  "the-data-migration-service": {
    title: "The data migration service",
    summary:
      "Ask FieldQuo to bring your old records in: a request, a call, a price you accept or decline, a payment through FieldQuo billing, and a log of every record created.",
    updated: "2026-09-12",
    intro: [
      "**Data Migration — Bring your old quotes, invoices and jobs into FieldQuo — from QuickBooks, Jobber, a spreadsheet, or a shoebox.** It is a paid service done by FieldQuo's own staff, not a self-serve importer, and it is the one sanctioned case where FieldQuo writes inside your account.",
      "The rules are strict and worth knowing before you ask: staff may only create new records, never change or delete anything that already exists, only after you have accepted a price and paid it, and every record they create is logged where you can see it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "You describe what you are bringing, book a call, get a price, accept it and pay. Then FieldQuo creates the clients and quotes in your account and you watch them appear under **What's been brought in**. Payment goes through FieldQuo billing — the same card as your subscription — never through your own Stripe account, which is for your clients paying you." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Request a migration** — **Where's your data now?** and **Anything else worth knowing** (how many years, roughly how many records), then **Request a migration**.",
            "The request card, with its status: **Requested**, **Call booked**, **Quote ready**, **Accepted — payment due**, **Paid**, **In progress**, **Completed**, **Declined** or **Cancelled**.",
            "**Book a call with FieldQuo** — open times to pick from, or **No times are open right now — we'll be in touch to schedule one.**",
            "**Documents** — **Upload a file**: a QuickBooks or Jobber export, a spreadsheet, or a ZIP of your old records. CSV, XLS, XLSX, TXT, PDF, ZIP and the QuickBooks formats are accepted.",
            "**What's been brought in** — every record FieldQuo created for you — and **Previous requests**.",
          ] },
          { figure: "live:app-settings-migration", caption: "Data Migration — the request card with its status and price, Documents below." },
        ],
      },
      {
        id: "how-it-goes",
        heading: "How it goes, step by step",
        blocks: [
          { steps: [
            "Fill in **Request a migration**. The status reads **Requested**.",
            "Book a call from the open times, or wait for FieldQuo to schedule one. You can pick a different time until a price exists.",
            "FieldQuo prices the work. The status becomes **Quote ready**, the dashboard says **FieldQuo quoted your data migration at {amount}. Review and respond.**, and the card shows **Accept** and **Decline**.",
            "Press **Accept**. The card reads **Quote accepted — pay when you're ready to start.**",
            "Press **Pay and start migration**. You are sent to Stripe to pay; the status becomes **Paid** and the card reads **Payment received — thank you. FieldQuo will be in touch to start the migration.**",
            "While staff work, the status is **In progress** and records appear under **What's been brought in** as they are added.",
            "**Completed** — **Migration complete.**",
          ] },
          { note: "Uploading documents is possible at every stage until the request is declined or cancelled — an export is useful before a price exists, too." },
        ],
      },
      {
        id: "what-fieldquo-writes",
        heading: "What FieldQuo writes, and what it never touches",
        blocks: [
          { bullets: [
            "It **creates** client records and quote records inside your account. Today those are the two record types the service writes; a migrated quote is a draft, marked as historical, with no tax applied.",
            "It **never** updates or deletes a client, quote, invoice or job that existed before — the code has no path that can.",
            "It writes **only** while the request is Paid or In progress, checked fresh at every single write. Cancel the migration and the writing stops that instant.",
            "Every write is logged with what was created and when, and you read that log under **What's been brought in**.",
          ] },
          { p: "This is a different mechanism from a support session. When FieldQuo support looks at your account to help you, that session is read-only, with no exception; the migration is the only door for writes, and only you can open it by paying." },
        ],
      },
      {
        id: "cancelling-and-who-can-see-it",
        heading: "Cancelling, and who can see it",
        blocks: [
          { p: "**Cancel this request** is available until you have paid. After payment, cancelling is a conversation with support rather than a button. The screen is under Settings → Account, for owners and administrators only — the same people who see the company's billing. The price and receipt are explained in [[paying-for-the-migration-service|Paying for the migration service]]." },
        ],
      },
    ],
    faq: [
      { q: "What does it cost?", a: "There is no list price. FieldQuo quotes each migration after the call, based on what you are bringing, and you accept or decline the figure on this screen." },
      { q: "Can FieldQuo fix a quote of mine while they are in there?", a: "No. Staff can only create new records. Anything that existed before the migration is out of their reach by design." },
      { q: "Do the migrated quotes go to my clients?", a: "No. They are drafts marked as historical. Nothing is sent to anyone." },
    ],
  },
};
