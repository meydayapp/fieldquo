// content/help/en/getting-started-2.js
//
// Part 2 of the “getting-started” category in English (see the composer,
// getting-started.js). Slugs assigned to this part by lib/help/tree.js:
// the four “how FieldQuo works for …” role articles, FieldQuo AI, the
// walkthrough, help, troubleshooting, the FAQ, the glossary, and what clients
// get.
//
// The role articles are written from lib/permissions.js (PERMISSION_PRESETS),
// lib/permissions/nav.js and lib/permissions/settingsAccess.js — the same
// code that hides a sidebar row — and the “sees / does not see” tables were
// read off the sales guide's computed roles table, not typed from memory.
// The AI article's list of lookups is lib/ai/copilotTools.js's tool list;
// the allowance behaviour is lib/ai/usage.js and app/app/copilot/page.js.
export const ARTICLES = {
  "how-fieldquo-works-for-owners-and-admins": {
    title: "How FieldQuo works for owners and administrators",
    summary:
      "What the owner's account can do that nobody else's can, how to add people and set what they see, and what “Make administrator” hands over.",
    updated: "2026-09-12",
    intro: [
      "The owner is the person who signed the company up. Their account has no access grid to consult: every screen, every setting, every button. This article is about the handful of things that are yours alone, and about the one screen — **Manage Team** — where you decide what everyone else gets.",
      "If you are a business partner or a bookkeeper who was made an administrator, everything here applies to you too, with one exception: ownership itself cannot be transferred from the app.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Everyone else on your team is on one of four access levels — Crew, Estimator, Dispatcher or Manager — and their sidebar shows only the rows that level allows. Yours shows all of them. The list below is what is hidden from every level below you, including Manager; if a screen is not on it, a Manager can see it too." },
          { p: "Hiding a row is not the security. Every screen and every save is checked again on the server against the same rules, so a person who types an address they were never shown gets a refusal, not the page." },
        ],
      },
      {
        id: "only-you",
        heading: "What only an owner or administrator can open",
        blocks: [
          { table: {
            head: ["Screen", "What it holds"],
            rows: [
              ["**Plan** (also **Settings → Account & Billing**)", "Your plan, its price, the seats and crew logins you have used, the next billing date, **Manage billing & payment method** and **Cancel plan**."],
              ["**Settings → Payments**", "The Stripe connection your clients pay through, with **Manage in Stripe** and **Disconnect**."],
              ["**Settings → Meta Ads**", "Your Facebook and Instagram ad account, lead forms and WhatsApp connection."],
              ["**Settings → Activity Log**", "Who did what and when — quotes sent, invoices chased, members invited, pay rates changed. Read-only."],
              ["**Settings → Payroll**", "Pay frequency, deductions and statutory components. Running a pay run is also yours alone."],
              ["**Settings → Time Off Policies**", "Vacation and sick-day policies, and the year-end carry-over."],
              ["**Settings → Notifications**", "When FieldQuo emails you — a large quote, a paid invoice, appointment reminders."],
              ["**Settings → Data Migration**", "The paid service where FieldQuo brings your old data in — see [[the-data-migration-service|The data migration service]]."],
              ["**Refer & Earn**", "Your referral link, the businesses you referred and the free months earned."],
            ],
          } },
          { p: "Three actions are owner-and-administrator only whatever the screen: changing an existing person's access level, making someone an administrator, and deactivating someone. A Dispatcher or Manager can invite people, but only as Crew or Estimator, and only with settings no higher than their own." },
        ],
      },
      {
        id: "manage-team",
        heading: "How to add someone and choose what they see",
        blocks: [
          { steps: [
            "Open **Your team** in the sidebar (the same screen as **Settings → Manage Team**). The panel at the top shows **seats used** against your plan and **crew — included free**.",
            "Press **Add User** and enter their name and email. Pick an access level: Crew, Estimator, Dispatcher, Manager, or **Make administrator**. Press **Custom…** to open the grid and change any single dial.",
            "The invite goes out by email. Until it is accepted the row reads **Invited**, with **Cancel invite** beside it. Nobody can join your company without one of these invitations.",
            "To change someone later, change the dropdown on their row. Picking a preset sets their tier and every permission in one go; the grid opens if you want to adjust one thing, and the row then reads **Custom**.",
          ] },
          { figure: "live:app-settings-team", caption: "Your team — the seat panel, then one row per person with their access level as a dropdown." },
          { note: "A person at the Crew level costs nothing and does not use a seat. Estimator, Dispatcher, Manager and administrators are full seats. **Add a seat** and **Add crew — free** sit in the same panel." },
          { figure: "harness:access-editor", caption: "The Custom access editor — the eleven areas as dropdowns and the three switches as checkboxes." },
        ],
      },
      {
        id: "make-administrator",
        heading: "What “Make administrator” does",
        blocks: [
          { p: "An administrator gets everything you have except ownership: the plan and the card, Stripe, payroll, the activity log, and the power to change anyone else's access. It exists for a partner or a bookkeeper who genuinely needs the money screens." },
          { warning: "Do not use it for staff who only need to run the day. The Manager level already creates, edits and deletes quotes, jobs, invoices and clients, publishes the schedule, approves hours and collects payments — everything except payroll and the company's billing." },
        ],
      },
      {
        id: "your-week",
        heading: "The screens an owner actually lives on",
        blocks: [
          { bullets: [
            "**Home** — the **Waiting on you** list: the overdue invoice with **Chase payment**, instant estimates waiting for a price to be approved, the next appointment. See [[the-dashboard|The dashboard]].",
            "**Quote reviews** — nothing an algorithm priced reaches a homeowner until you or a manager presses **Approve**.",
            "**Timesheets**, **Time Off** and **Assign shifts** — approve hours, approve leave, publish the week. A Dispatcher or Manager can do all three for you.",
            "**Settings → Activity Log** — the answer to “who changed this?”.",
            "**Plan** — once a month, to check seats before you invite someone.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can I give my office manager everything except the money?", a: "Yes — that is the Manager level. It runs quotes, jobs, invoices, clients, scheduling and expenses, and leaves payroll and the company's billing with you." },
      { q: "Can someone join my company on their own?", a: "No. A new person only gets in through an invitation from Your team. Signing up on the public site creates a separate company, never a seat in yours." },
      { q: "Can I hand ownership to someone else?", a: "Not from the app. Make them an administrator, which gives them everything except ownership, and get in touch if the ownership itself needs to move." },
      { q: "Does a Crew login cost anything?", a: "No. Crew logins are included free with every plan — five on Solo, eight on Crew, eleven on Shop, fifteen on Scale — and never use a seat." },
    ],
  },

  "how-fieldquo-works-for-dispatchers": {
    title: "How FieldQuo works for dispatchers and managers",
    summary:
      "The two levels that run the crew's week — what a Dispatcher can and cannot do, what a Manager adds, and the screens where the week actually happens.",
    updated: "2026-09-12",
    intro: [
      "Dispatcher and Manager are the two access levels for people who run other people. Both can see everyone's schedule and everyone's hours, both can invite crew, and both have every setting a shop needs day to day. The difference is deletion and money: a Manager can delete records, see job costs and collect payments; a Dispatcher can do none of those three.",
      "If your row on **Your team** says Dispatcher or Manager, this article is what your sidebar is showing you and why.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The Dispatcher level is built for the team lead who books the crew, moves visits and keeps the week honest, without the power to remove anything. The Manager level is the office manager or the partner who runs operations — everything except payroll and the company's own billing, which stay with the owner." },
          { p: "Both levels share the same tier, so the same screens appear in the sidebar for both. Where they differ is inside those screens: what a button does when pressed, and whether a delete control is there at all." },
        ],
      },
      {
        id: "dispatcher-vs-manager",
        heading: "Dispatcher against Manager, area by area",
        blocks: [
          { table: {
            head: ["Area", "Dispatcher", "Manager"],
            rows: [
              ["Schedule", "Edit everyone's schedule", "Edit and delete everyone's schedule"],
              ["Time tracking and timesheets", "View, record, edit and delete everyone's", "View, record, edit and delete everyone's"],
              ["Quotes, jobs, invoices, leads", "View, create and edit", "View, create, edit and delete"],
              ["Clients", "View and edit full client info", "View, edit and delete full client info"],
              ["Notes", "View and edit all", "View, edit and delete all"],
              ["Expenses", "Their own only", "Everyone's — and the **Expenses** and **Purchasing** screens"],
              ["Safety incidents", "View everyone's and follow up", "View everyone's and follow up"],
              ["See prices", "Yes", "Yes"],
              ["Job costing", "No", "Yes — quoted against actual, **KPIs**, **Overhead**, **Material Costs**"],
              ["Collect payments", "No", "Yes"],
              ["Payroll", "Their own payslips", "Their own payslips"],
            ],
          } },
          { p: "Every row is a dial the owner can change afterwards. If your row reads **Custom**, one of these was adjusted, and the table is a starting point rather than your exact grid." },
        ],
      },
      {
        id: "the-week",
        heading: "How the week runs from these two levels",
        blocks: [
          { steps: [
            "**Assign shifts** — the crew's week as seven day cards. **Add shift** puts a person on a job with hours and a note. Shifts stay as drafts, invisible to the crew, until you press **Publish week**.",
            "**Timesheets** — one row per punch. A punch taken far from the job is flagged in amber. Press **Approve** on the hours before they reach a pay run; **Add entry** records a missed punch.",
            "**Time Off** — the **Team** tab lists requests awaiting approval with **Approve** and **Decline**, who is off next, and everyone's balances.",
            "**Quote reviews** — instant estimates from your website land here; a Dispatcher or Manager is the lowest level allowed to press **Approve** and let the price go out.",
            "**Your team** — press **Add User** to invite someone. You can only hand out what you hold: Crew or Estimator, with settings no higher than your own.",
          ] },
          { figure: "live:app-scheduler", caption: "Assign shifts — the week as day cards, Add shift, and Publish week." },
          { figure: "live:app-settings-team-timesheets", caption: "Timesheets — each punch with its hours and an Approve button." },
        ],
      },
      {
        id: "what-you-cannot-do",
        heading: "What neither level can do",
        blocks: [
          { bullets: [
            "Open **Plan** or **Settings → Account & Billing**, **Refer & Earn**, **Data Migration**, **Activity Log**, **Time Off Policies**, **Notifications**, **Payments**, **Meta Ads** or **Settings → Payroll**. Those rows are not in your sidebar, and the pages refuse you if you type the address.",
            "Run a pay run or see anyone else's payslip. **Payroll** in the sidebar shows your own payslips only.",
            "Change an existing person's access, make someone an administrator, or deactivate someone.",
            "Invite a Dispatcher or Manager. **Add User** offers Crew and Estimator only.",
          ] },
          { tip: "If you are a Dispatcher and keep hitting a missing delete button or a hidden **Cost & margin** block, the fix is one dropdown: ask the owner to move your row to Manager." },
        ],
      },
      {
        id: "settings-you-can-reach",
        heading: "The settings you can change",
        blocks: [
          { p: "Both levels can open and change **Company Settings**, **Branding**, **Booking Page**, **Work Areas**, **Custom Fields**, **Cabinet Pricing**, the templates (**Quote Email**, **Email Templates**, **PDF Templates**, **Translations**, **Checklists**, **Job photo tags**), **Client messages**, **Follow-ups**, **Email Domain**, **AI credit**, and every client-facing row — **Your website**, **Instant Quotes**, **Share your links**, **Bio link**, **Phone receptionist**, **AI employee**, **Reviews**. A Manager additionally sees **Material Costs** and **Overhead**, because both need job costing. Both levels can read **Products & Services**, **Services & Pricing** and **Instant Quotes**, but changing a rate there is for the owner or an administrator." },
        ],
      },
    ],
    faq: [
      { q: "Why can I edit an invoice but not delete it?", a: "You are a Dispatcher. Deletion of quotes, jobs, invoices, leads and clients is the Manager level. Cancelling or archiving a job is a status change, not a deletion, and is open to you." },
      { q: "Why does the crew not see the shifts I added?", a: "Shifts are drafts until you press Publish week. The crew only ever sees published shifts." },
      { q: "Can I see what a job made?", a: "Only at the Manager level, where job costing is on. A Dispatcher sees the quote and the hours, never the labour cost or the margin." },
      { q: "Can I add a second dispatcher?", a: "Not yourself — Add User offers you Crew and Estimator. Ask the owner or an administrator." },
    ],
  },

  "how-fieldquo-works-for-estimators": {
    title: "How FieldQuo works for estimators and salespeople",
    summary:
      "The Estimator level: write and send quotes with prices, manage clients, read jobs and invoices — and what stays with the office.",
    updated: "2026-09-12",
    intro: [
      "The Estimator level is for the person who prices and sends the work but does not run the shop: a salesperson, a second estimator, the owner's partner who does the site visits. It is the level that turns a lead into a quote and gets it signed.",
      "It is a paid seat, because it can create quotes and see every price. It is deliberately not a management level: no people, no payroll beyond your own payslips, no job costs.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "An Estimator can create and edit leads and quotes, add and edit clients, read every note, and see — not change — jobs and invoices. Prices are on. Cost and margin are off, on purpose: an estimator who can see the floor can discount to it." },
          { p: "Your own schedule, your own time, your own expenses. You can report a safety incident and see the ones you filed." },
        ],
      },
      {
        id: "what-you-can-do",
        heading: "What you can do",
        blocks: [
          { bullets: [
            "**Leads** — the board of enquiries from your website, booking link, receptionist and referrals. Move a card, score it, and turn it into a quote.",
            "**Quotes** — **New Quote** opens the builder. Lines come from the price book, photos attach, the quote keeps the language it was created in, and **Send** emails it in your company's name.",
            "**Clients** and **Client equipment** — full records, and the warranty call list.",
            "**Receptionist** — the calls the phone agent took, with **Draft a quote from this call**.",
            "**Insights** and **Settings → Products & Services**, **Services & Pricing**, **Instant Quotes** — the price book, the quote types and their rates. You can read them; changing a rate is for the owner or an administrator.",
            "**Calendar**, **To-do**, **Chat**, **Time clock**, **Time Off**, **Safety**, and your own payslips under **Payroll**.",
          ] },
        ],
      },
      {
        id: "your-day",
        heading: "From a lead to a signed quote",
        blocks: [
          { steps: [
            "Open **Leads**. A new enquiry sits in **New** with a Hot, Warm or Cold score. Open the card.",
            "Convert it — the client and the address carry across into a new quote.",
            "Build the quote from the price book, group it by room or scope if the job is big, attach photos, and add any optional extras the client can tick.",
            "Press **Send**. The client gets an email in their language, opens the approval page, ticks the extras they want, signs, and pays the deposit if you asked for one.",
            "The quote turns **Approved**. Turning it into a scheduled job is the dispatcher's or manager's next step — see [[convert-a-quote-to-a-job|What happens when a quote is approved]].",
          ] },
          { figure: "live:app-quotes", caption: "Quotes — the status chips, search, and the list with number, status, client, amount and age." },
        ],
      },
      {
        id: "what-is-hidden",
        heading: "What stays with the office",
        blocks: [
          { bullets: [
            "**Jobs** and **Invoices** are view-only. The screen says so when you try: “Your access level lets you view jobs, not create them. Ask an owner or admin if you need to start one.”",
            "You cannot turn a quote into a job, assign a quote to someone else, or approve an instant estimate — **Quote reviews** is not in your sidebar.",
            "No **Cost & margin** block on a quote, no **Expenses**, **Purchasing**, **KPIs**, **Overhead** or **Material Costs**.",
            "No **Your team**, **Team calendar**, **Timesheets**, **Subcontractors**, **Vehicles**, **Marketing**, **Designer** or **Funnels** — those are the Dispatcher tier and up.",
            "No payment collection: recording a payment on an invoice is for a Manager, an administrator or the owner.",
          ] },
          { note: "Everything above is a dial the owner can change. If your row on Your team reads Custom, your grid differs from this article somewhere." },
        ],
      },
      {
        id: "who-sets-it",
        heading: "Who sets this",
        blocks: [
          { p: "The owner or an administrator picks the level on **Your team** — Estimator is one of the five choices in the dropdown — and can open **Custom…** to give you one more thing without promoting you to Dispatcher. A Dispatcher or Manager can invite an Estimator too, but cannot change one afterwards." },
        ],
      },
    ],
    faq: [
      { q: "Can I see what the company charged last year for the same job?", a: "Yes — every past quote is in Quotes with its prices, and FieldQuo AI answers questions like “what's my average quote value this month?” from the same records." },
      { q: "Why is there no margin on my quote?", a: "Job costing is off at the Estimator level by design. The owner can switch it on for you in the Custom access editor." },
      { q: "Can I book the site visit myself?", a: "Yes. Calendar and New Appointment are open to you, and so is your own schedule. Assigning a visit to someone else is a dispatcher's action." },
    ],
  },

  "how-fieldquo-works-for-crew": {
    title: "How FieldQuo works for crew",
    summary:
      "A Crew login is free and shows the person in the van their day — jobs, shifts, the clock, chat, time off — and no prices, quotes or invoices.",
    updated: "2026-09-12",
    intro: [
      "Crew is the access level for installers and helpers: the people who drive to the address, do the work, and clock out. It costs nothing, does not use a seat, and shows only what that day needs. Nothing on it carries a price.",
      "This article is what a Crew login sees, on the phone and on a laptop, and what it will never see however hard it looks.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The product's own description of the level: “View their schedule, the jobs they're assigned to, and what to buy for them. Mark work complete and track their time. No prices, quotes, invoices or requests.” Every part of that is enforced on the server, not only in the menu." },
          { p: "Jobs are view-only and limited to the ones you have a visit on. The client's name and address are there because you have to drive to it; the rest of the client's record is not." },
        ],
      },
      {
        id: "what-you-see",
        heading: "What is in your sidebar, and what you can do there",
        blocks: [
          { table: {
            head: ["Screen", "What you can do"],
            rows: [
              ["**Jobs**", "Open the jobs you are booked on: address, visits, notes, the checklist, the list of what to buy. Mark work complete."],
              ["**Calendar** and **To-do**", "Your visits and the tasks assigned to you, including ones that need photos."],
              ["**Assign shifts**", "Your own published shifts — nothing appears until the office presses Publish week."],
              ["**Time clock**", "**Clock in** on a job, **Clock out**, switch jobs mid-day. Your day's hours total underneath."],
              ["**Time Off**", "Your balances, **Request time off**, and withdraw a pending request."],
              ["**Safety**", "**Report** an injury or near-miss, and see the ones you filed."],
              ["**Chat**", "#general with the whole team, a room for each job you are on, direct messages."],
              ["**Payroll**", "Your own payslips. Nobody else's."],
              ["**FieldQuo AI**", "Questions about your schedule — “what work is coming up this week?” — and nothing with money in it."],
              ["**Settings**", "Three rows: **Language**, **Availability** (your own hours) and **Product Updates**."],
            ],
          } },
        ],
      },
      {
        id: "a-day",
        heading: "A day on a Crew login",
        blocks: [
          { steps: [
            "Open FieldQuo on your phone. The tab bar shows **Jobs**, **Chat** and **More**; the pipeline tabs the office uses are not there for you.",
            "Open **Jobs**, tap today's job, and read the visit notes and the checklist.",
            "Open **Time clock** and press **Clock in**. The pill reads **On the clock** and the timer runs against that job.",
            "Photos: take them from the job page, or text them to the crew number and they file themselves — see [[text-a-photo-to-the-crew-inbox|Text a photo in without an app]].",
            "Press **Clock out**. If you forgot, you can fix your own hours on the entry; a self-edited entry goes back to pending so the office re-checks it.",
          ] },
          { figure: "live:app-clock", caption: "Time clock — the live clock, On the clock, time elapsed, the job, and Clock out." },
        ],
      },
      {
        id: "what-you-never-see",
        heading: "What a Crew login never shows",
        blocks: [
          { bullets: [
            "No **Leads**, **Quotes** or **Invoices** — the rows are absent and the pages refuse.",
            "No **Clients** list. A name and an address on your own job is not the company's customer book.",
            "No prices anywhere: not on a job, not in chat, not from FieldQuo AI.",
            "No **Your team**, **Timesheets** (the office reviews your hours there), **Expenses** beyond your own, **Insights**, **Marketing**.",
            "No settings except your language, your hours and the changelog.",
          ] },
          { note: "The owner can raise any single dial for one person in the Custom access editor without moving them off the free level — until the grid grants something that makes them a seat, such as creating quotes." },
        ],
      },
    ],
    faq: [
      { q: "Do I need to install an app?", a: "No. FieldQuo runs in the phone's browser; add it to your Home Screen and it opens like an app. See [[install-it-like-an-app|Install it like an app]]." },
      { q: "Why can I not see tomorrow's shift?", a: "The office has not published the week yet. Shifts are drafts until Publish week is pressed." },
      { q: "Can I see how much the job was quoted for?", a: "No. A Crew login carries no prices, and a job record has no money on it at this level." },
    ],
  },

  "fieldquo-ai-ask-about-your-business": {
    title: "FieldQuo AI: ask about your own business",
    summary:
      "An assistant that answers questions from your company's own quotes, invoices, clients and schedule, declines everything else, and runs inside a monthly allowance.",
    updated: "2026-09-12",
    intro: [
      "**FieldQuo AI** is the second row of the sidebar. You type a question — “which clients haven't been invoiced yet?” — and it looks the answer up in your company's records rather than guessing. It can also draft a client message with the real figures in it.",
      "It answers only about your business. Asked for a recipe or an essay, it declines in one sentence and says what it can help with instead. It never sees another company's data, and it never sees more of yours than your access level allows.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Under the title the screen says: “Ask about your own quotes, invoices, clients and material costs. It looks up real numbers rather than guessing.” A new conversation shows **Try asking** with four questions you can tap, and a box that reads **Ask about your business…** with a **Send** button." },
          { figure: "live:app-copilot", caption: "FieldQuo AI — an empty conversation with the Try asking prompts and the question box." },
          { p: "Every answer comes from a lookup against your own database — never from what the model remembers about contractors in general. If a lookup returns nothing, it says there is not enough data yet rather than filling the gap." },
        ],
      },
      {
        id: "what-it-can-look-up",
        heading: "What it can look up",
        blocks: [
          { table: {
            head: ["Ask about", "What it reads"],
            rows: [
              ["Conversion", "Quote-to-acceptance rate over a recent period."],
              ["Top clients", "Who paid the most, by paid invoices."],
              ["Cash flow", "Money in against expenses over recent months."],
              ["Revenue by category", "Accepted-quote revenue per service category."],
              ["Repeat customers", "How many clients came back."],
              ["Upcoming work", "The jobs scheduled in the next N days, with visit notes and the linked quote's notes."],
              ["A quote or an invoice", "Found by number or client name: notes, line items, whether photos are attached."],
              ["A job", "Every visit's notes and photo count, hours logged, the quote and invoices — and, with job costing, labour cost so far against the quoted total."],
              ["A draft message", "A quote follow-up, a payment reminder, a job update, written ready to send, with the real invoice number and amount."],
            ],
          } },
          { note: "There is no lookup for material costs today, although the screen's subtitle names them. A question about material costs gets a plain “I can't look that up here”." },
        ],
      },
      {
        id: "what-it-declines",
        heading: "What it declines",
        blocks: [
          { bullets: [
            "General requests — coding, recipes, homework, world knowledge. One sentence, no lecture.",
            "Anything it has no lookup for. It says so and names who can help; it does not estimate the answer from something else.",
            "Any figure your access level hides. The lookups are filtered by your grid before the conversation starts, so a person without **See prices** is never told an invoice total — and is never told that one exists.",
          ] },
        ],
      },
      {
        id: "the-monthly-allowance",
        heading: "The monthly allowance",
        blocks: [
          { p: "FieldQuo AI is included in every plan; there is nothing to buy. Each company has a monthly allowance shared by everything AI does for you — this assistant, the quote review, the website builder's copy, the AI employee's drafts. At 80% the screen shows a warning: “You've used {pct}% of this month's FieldQuo AI allowance.”" },
          { p: "When it runs out the question box is disabled and the screen says **This month's FieldQuo AI allowance is used up.** It resets at the start of next month, and everything else in FieldQuo carries on as normal. Buying AI credit on **Settings → AI credit** does not raise it — that credit is for phone minutes and AI images; get in touch if you need a bigger allowance." },
        ],
      },
      {
        id: "who-can-use-it",
        heading: "Who can use it",
        blocks: [
          { p: "Everyone on the team has the row. What each person can ask follows their access level: a Crew login gets the schedule lookups only, so its **Try asking** prompts are “What work is coming up this week?” and “Which jobs am I assigned to?”. Cash flow needs the everyone's-expenses level; labour cost on a job needs job costing. It answers in the language you use the app in." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Why this is listed under Only in FieldQuo",
        blocks: [
          { p: "Of the five pricing pages FieldQuo checks itself against — Jobber, Housecall Pro, ServiceTitan, Projul and QuoteIQ — four list no assistant that answers from your own numbers at any tier. Housecall Pro lists “AI team members” on every plan, a phrase that also covers its call-answering AI. That is the whole claim: not listed on their pricing page, never “they cannot do it”." },
        ],
      },
    ],
    faq: [
      { q: "Does it see other companies' data?", a: "Never. The company is fixed on the server before any lookup runs, and the model cannot change it however the question is phrased." },
      { q: "Can it change a quote or send an email?", a: "No. Every lookup is read-only. It writes a draft message for you; sending it is your click." },
      { q: "Is it the same thing as the AI employee or the phone receptionist?", a: "No. Those talk to your clients and are set up under Settings. FieldQuo AI talks to you about your own records. They share the same monthly allowance." },
      { q: "Will it invent a number?", a: "It is instructed not to, and it has no way to: it has no figures except what the lookups return. If a number is not there, it says so." },
    ],
  },

  "replay-the-setup-walkthrough": {
    title: "Replay the setup walkthrough",
    summary:
      "The five-step guided tour that greets a new account, what it points at, and how to play it again from the Help screen.",
    updated: "2026-09-12",
    intro: [
      "The first time you land on **Home**, FieldQuo runs a short walkthrough: five cards, each pointing at a row of the sidebar. It shows once per person and never nags again. If you skipped it, or you want to show it to somebody looking over your shoulder, you can replay it from **Help**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The walkthrough is in the language you use the app in, and each card carries **Skip**, a step counter (“2 of 5”), and **Next** — **Done** on the last one. On a phone it opens the sidebar drawer itself to point at the row." },
        ],
      },
      {
        id: "the-five-steps",
        heading: "The five steps",
        blocks: [
          { table: {
            head: ["Step", "Points at", "What it says"],
            rows: [
              ["1", "**Leads**", "Leads land here — every enquiry from your website, booking link or instant estimate. Start of the pipeline."],
              ["2", "**Quotes**", "Turn them into quotes — build a branded quote, send it, get it approved and paid."],
              ["3", "**Quote reviews**", "Instant estimates to approve — a homeowner's instant price lands here for you to confirm before it is binding."],
              ["4", "**FieldQuo AI**", "Ask FieldQuo AI — questions about your own numbers, answered from your data."],
              ["5", "**Settings**", "Set up your business — branding, services, pricing, payments and your instant-quote rates. Worth ten minutes up front."],
            ],
          } },
        ],
      },
      {
        id: "how-to-replay",
        heading: "How to replay it",
        blocks: [
          { steps: [
            "Open **Help** at the bottom of the sidebar.",
            "Press **Replay the setup walkthrough** — the card under the search box that says “The quick guided tour of the app, from the start.”",
            "FieldQuo forgets that you saw the welcome tour and takes you to **Home**, where it starts again from step 1.",
          ] },
          { figure: "live:app-help", caption: "Help — the search box, the Replay the setup walkthrough card, and the articles by topic." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "What replaying changes",
        blocks: [
          { bullets: [
            "It resets the welcome tour for **you only**. A teammate's tour is untouched.",
            "Only the welcome tour is reset. The short tours on other screens — Leads, Quotes, Jobs, Invoices, Scheduling and the rest — each run once on their own the first time you open that page, and stay seen.",
            "Nothing about your company changes. It is a per-person note that says “not seen yet”.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Why did the walkthrough not appear for a new team member?", a: "It runs the first time each person lands on Home. If they went straight to another page from the invite, it waits for their first visit to Home." },
      { q: "Can I turn the tours off for everyone?", a: "No. Each tour shows once per person and records itself as seen; there is no company-wide switch." },
    ],
  },

  "how-to-get-help": {
    title: "How to get help",
    summary:
      "Where the answers are — the Help screen in the app, the public help centre in three languages, and how to reach a person at FieldQuo.",
    updated: "2026-09-12",
    intro: [
      "Most questions are answered by the screen you are on: every sidebar row and every Settings row has an article, in your language, with the real screen in it. When that is not enough, there is one address that reaches a person, and a read-only way for that person to look at your account with you.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Three layers. **Help** in the sidebar is the in-app help centre. The public help centre is the same articles, in English, French and Spanish, reachable without signing in — which is why you can send a link to a teammate on their first day. And FieldQuo's own support is by email; there is no phone line, no live chat, and no ticket form inside the app." },
        ],
      },
      {
        id: "help-in-the-app",
        heading: "The Help screen in the app",
        blocks: [
          { steps: [
            "Open **Help** at the bottom of the sidebar. The title reads **Help Centre**, with a search box under it.",
            "**The guide for every screen** — the panel at the top — lists every row of the sidebar and of Settings you can see. Each name opens that screen's article on the public help centre, in your language, in a new tab. **Open the help centre** takes you to its home page.",
            "Below it, **Replay the setup walkthrough** restarts the welcome tour — see [[replay-the-setup-walkthrough|Replay the setup walkthrough]].",
            "Under that, the in-app articles by topic — Getting started, Quoting & invoicing, Jobs & clients, Troubleshooting and so on. They open in place.",
          ] },
          { figure: "live:app-help", caption: "Help — The guide for every screen, then the walkthrough card and the in-app articles." },
          { note: "The in-app articles are in English only today. The articles behind The guide for every screen — this help centre — are the ones written in French and Spanish." },
        ],
      },
      {
        id: "the-public-help-centre",
        heading: "The public help centre",
        blocks: [
          { p: "This site. Articles in English, French and Spanish, grouped by category, with a search box and a figure of the real screen wherever one exists. If you use the app in another language, you get the English article with a notice at the top saying so." },
          { p: "At the bottom of every article is a **Was this helpful?** vote. It records the article and the answer, and nothing else — no name, no email, no free text — so use it freely." },
        ],
      },
      {
        id: "reach-a-person",
        heading: "How to reach a person at FieldQuo",
        blocks: [
          { bullets: [
            "Email **hello@fieldquo.com**. Put your company name in the subject and, if it is about a number or a domain, the number or the domain — a message that can be placed on the first read is answered on the first read.",
            "The **Contact Us** page on the public site — name, email, message — reaches the same people. It confirms with “Thanks for reaching out — we'll get back to you shortly.”",
            "The **Phone receptionist** settings screen links straight to that address with the subject already filled in when a number is stuck; other screens that say “get in touch” mean the same address.",
          ] },
          { p: "Include what you were doing, what the screen said (the exact sentence), and the quote or invoice number if there is one. A screenshot of a red message saves a round trip." },
        ],
      },
      {
        id: "what-support-can-see",
        heading: "What support can see when they look at your account",
        blocks: [
          { p: "A FieldQuo support person can open a read-only view of your account to look at a problem with you. Read-only is enforced twice on the server: nothing can be created, edited, sent or deleted from that session, and it cannot post in your chat. Every such session is logged, and anything it touches shows in **Settings → Activity Log** flagged **support session**." },
          { p: "Support will talk you through a change or ask you to make it; it will never make it for you. The one sanctioned exception is the paid migration service, where FieldQuo creates new records you asked for — see [[the-data-migration-service|The data migration service]]." },
        ],
      },
    ],
    faq: [
      { q: "Is there a phone number for support?", a: "No. Support is by email at hello@fieldquo.com, or through the Contact Us page." },
      { q: "Can support change something in my account for me?", a: "No. Support access is read-only and stays that way. They will walk you through it." },
      { q: "Where do I see what is new in FieldQuo?", a: "Settings → Product Updates is a dated changelog. Every level of access can open it." },
    ],
  },

  "troubleshooting": {
    title: "Troubleshooting: the five things that go wrong first",
    summary:
      "Emails that never arrive, an invoice with no Pay button, a screen you cannot find, a logo that will not upload, and a website address that will not load — what each means and where to look.",
    updated: "2026-09-12",
    intro: [
      "Five problems account for most first-week questions, and four of them are settings rather than faults. Each section below says what you will see, what it usually means, and the screen that fixes it. If you reach the end of a section and it is still broken, that is the moment to email support with the exact sentence on the screen — see [[how-to-get-help|How to get help]].",
    ],
    sections: [
      {
        id: "emails",
        heading: "A client says the email never arrived",
        blocks: [
          { p: "A quote or invoice email goes out from your company's name. Which address it goes out from depends on **Settings → Email Domain**: your own domain once it is verified, FieldQuo's sending domain until then. Unverified is the usual reason mail lands in spam or shows “via fieldquo.com”." },
          { steps: [
            "Open **Settings → Email Domain**. The status reads **Verified**, **Waiting on DNS**, **Verification failed** or **Not set up**.",
            "**Waiting on DNS** or **Verification failed** — the records the page lists are not yet at your domain registrar, or not exactly as shown. Add them and check again; DNS can take an hour.",
            "**Not set up** — you are sending from FieldQuo's domain, which works but deliverability is yours to lose. See [[send-from-your-own-domain|Send email from your own domain]].",
            "**Verified** and still nothing — ask the client to check spam, and check the email address on the client record for a typo. The quote's own page shows when it was sent.",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Settings → Email Domain — the domain with its status, the sender address, and where replies go." },
        ],
      },
      {
        id: "pay-button",
        heading: "There is no Pay button on the invoice",
        blocks: [
          { p: "The Pay button appears on an invoice only once Stripe has switched charges on for your account. Until then the client's invoice page shows how to pay you another way instead of the button, and never a dead button." },
          { steps: [
            "Open **Settings → Payments**. If Stripe is not connected, press **Connect with Stripe** — see [[connect-stripe-and-get-verified|Connecting Stripe and getting verified]].",
            "If it is connected, the card names what Stripe has switched on and what it is still waiting for — usually a document, a bank account or a director's name. Press **Manage in Stripe** and finish it.",
            "If the page says Stripe is holding your money or reviewing your account, payments still go through; only the payout waits. See [[payouts-held-or-under-review|Payouts held or under review]].",
          ] },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — the Stripe status, what is switched on, and what Stripe is still waiting for." },
        ],
      },
      {
        id: "missing-screen",
        heading: "A screen or a button you expected is not there",
        blocks: [
          { p: "The sidebar hides rows your access level does not allow, and some controls are hidden the same way. A missing row is the product working, not the product broken." },
          { steps: [
            "Check your level: the owner or an administrator can read it on **Your team**. Crew sees no Leads, Quotes, Invoices or Clients; Estimator sees no Your team, Timesheets or Quote reviews; Dispatcher sees no Expenses, KPIs or delete buttons. See [[access-levels-overview|Access levels: who sees what]].",
            "A block that reads **Hidden by your access level** or “Pricing is hidden by your access level” is the same rule inside a screen — ask the owner to raise that one dial in the Custom access editor.",
            "**Cabinet Pricing** and **Material Costs** appear only for the trades that price that way; the industry is set on **Settings → Company Settings**.",
            "On a phone, **More** opens everything the tab bar does not show.",
          ] },
        ],
      },
      {
        id: "logo-upload",
        heading: "The logo will not upload",
        blocks: [
          { p: "**Settings → Branding** takes **PNG, JPG, WebP or SVG, up to 8 MB**. A file outside that is refused; a file inside it that fails shows **Upload failed** or **Could not upload logo**." },
          { steps: [
            "Check the format and size. A photo straight off a phone can be over 8 MB — export it smaller.",
            "Try once more. A single failure on a bad connection is common; the upload is signed by the server and completes or fails, it never half-saves.",
            "If every upload fails with the same message, the fault is on FieldQuo's side (the image service refusing the upload), not your file. Email support with the message.",
          ] },
        ],
      },
      {
        id: "website-address",
        heading: "Your website address will not load",
        blocks: [
          { p: "Your site lives at your subdomain of fieldquo.com, chosen on **Settings → Your website**. “Safari can't find the server” or “this site can't be reached” means the name does not resolve — a name-service problem on FieldQuo's side, not something in your site's content." },
          { steps: [
            "Open **Settings → Your website** and check the badge beside the address reads **Live**. A site that was never published does not answer at all — the button beside the address reads **Publish** until it is, and **Update** afterwards.",
            "Press **Open** on that page rather than typing the address; a typo in the subdomain is the commonest cause.",
            "If it is Live and still does not load from a second device, email support with the address. That is a wildcard name-service fault FieldQuo has to fix.",
          ] },
          { note: "There is no custom-domain option today: the address is always yoursubdomain.fieldquo.com. See [[your-website-address|Your website address]]." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo AI stopped answering.", a: "The month's allowance is used up; the screen says so above the question box. It resets at the start of next month. Everything else keeps working." },
      { q: "The first page after a quiet spell was slow or failed.", a: "Reload once. The database sleeps when nobody has used it for a while and the first connection wakes it." },
      { q: "A client's reminder text did not go out.", a: "Reminders go by text only, and only to a client with a mobile number on their record who has not unsubscribed. See [[appointment-reminders|Appointment reminders]]." },
    ],
  },

  "faq": {
    title: "Frequently asked questions",
    summary:
      "Short answers to the questions every new company asks — plans and seats, the team, your clients, your data, phones and other tools.",
    updated: "2026-09-12",
    intro: [
      "The questions that come up in the first month, answered in a sentence or two with a link to the full article. Every answer here is true of the product today; where FieldQuo does not do something, it says so.",
    ],
    sections: [
      {
        id: "plans-and-billing",
        heading: "Plans and paying for FieldQuo",
        blocks: [
          { bullets: [
            "**Is there a free trial?** The first month is free. A card is taken at signup and nothing is charged until the second month. See [[free-first-month|Your first month is free]].",
            "**What do the plans differ by?** Seats and crew logins, nothing else — every feature is in every plan. Solo is $99 a month for 1 seat and 5 crew logins; Crew $169 for 3 and 8; Shop $269 for 6 and 11; Scale $369 for 10 and 15. See [[the-four-plans|The four plans]].",
            "**What is a seat, and what is a crew login?** A seat is somebody who creates and changes quotes, jobs and invoices. A crew login clocks in, reads their schedule and adds photos, and is free. See [[seats-and-crew-logins|Seats and crew logins]].",
            "**Is a year cheaper?** Yes — a one-year commitment is two months free, billed once a year. See [[monthly-or-a-year-commitment|Monthly, or a one-year commitment]].",
            "**How do I cancel?** **Plan → Cancel plan**. The account goes read-only at once; your clients can still pay their invoices. See [[cancel-your-subscription|Cancel your subscription]].",
            "**Referrals?** Refer another business and you each get one free month once they are paying. See [[refer-another-business|Refer another business]].",
          ] },
        ],
      },
      {
        id: "your-team",
        heading: "Your team",
        blocks: [
          { bullets: [
            "**Can someone join without an invite?** No. Signing up on the public site creates a new company. Joining yours is by invitation from **Your team** only.",
            "**What can each person see?** Five levels: Crew, Estimator, Dispatcher, Manager, administrator. The owner can change any single dial. See [[access-levels-overview|Access levels: who sees what]].",
            "**Does FieldQuo pay my crew?** No. Payroll works out pay from approved hours and your rates and produces payslips; you pay through your own bank or payroll provider. See [[payroll-runs|Payroll runs]].",
            "**Can crew who refuse an app still send photos?** Yes — they text a photo to the crew number and it files itself against the job. See [[the-crew-inbox|The crew inbox]].",
          ] },
        ],
      },
      {
        id: "your-clients",
        heading: "Your clients and your brand",
        blocks: [
          { bullets: [
            "**Will my clients see FieldQuo's name?** Not on a quote, an invoice, an email, the booking page or the client portal — they carry your logo, colour and name. The one exception is a small “Site by FieldQuo” footer on a free website. See [[nothing-says-fieldquo|Nothing says FieldQuo]].",
            "**Can I quote in French and English?** Yes. A quote keeps the language it was created in, and the covering email matches it. See [[quote-language|A quote keeps its language]].",
            "**What does taking a card payment cost?** 3% + 30¢ per card payment; bank debit in Canada is 1% + 40¢ capped at $5. No monthly fee. See [[payment-processing-fees-and-payouts|Payment processing fees and payouts]].",
            "**Does FieldQuo hold my money?** Never. Payments go through your own Stripe account to your bank.",
            "**How does a client see what they owe?** From the link in the invoice email — the client portal shows their balance, invoices and quotes with no login. See [[what-your-clients-get|What your clients get]].",
          ] },
        ],
      },
      {
        id: "your-data",
        heading: "Your data",
        blocks: [
          { bullets: [
            "**Can I bring my old clients and jobs in?** Yes — CSV imports for clients, past jobs and quotes, or the paid migration service where FieldQuo does it. See [[import-clients-from-a-csv|Import clients from a CSV]] and [[the-data-migration-service|The data migration service]].",
            "**Does it sync with QuickBooks or Xero?** No. There is a CSV bookkeeping export built to import into both. See [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero and your bookkeeper]].",
            "**Is there an API, or Zapier?** Not yet. See [[no-public-api-or-zapier|No public API or Zapier, yet]].",
            "**Can I get my data out, or deleted?** Yes. See [[data-and-privacy|Your data, your clients' data, and deletion]].",
          ] },
        ],
      },
      {
        id: "phones-and-other-tools",
        heading: "Phones and other tools",
        blocks: [
          { bullets: [
            "**Is there an app in the app stores?** No. FieldQuo runs in the browser and installs to the Home Screen like an app. See [[install-it-like-an-app|Install it like an app]].",
            "**Does it work offline?** No, deliberately. See [[bad-connections-and-offline|Bad connections, and why there is no offline mode]].",
            "**What languages?** The app runs in eight — English, French, Spanish, Ukrainian, Punjabi, Tagalog, German and Italian; **Settings → Language** shows how complete each one is. This help centre is in English, French and Spanish.",
            "**Can it answer my phone?** Yes, the phone receptionist, on a local number, paid from phone credit. See [[the-phone-receptionist|The phone receptionist]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Where do I ask something that is not here?", a: "Email hello@fieldquo.com, or use the Contact Us page on the public site. See [[how-to-get-help|How to get help]]." },
      { q: "Is anything here a promise about a future feature?", a: "No. Every answer describes the product as it is today. Where the honest answer is “not yet”, the linked article says so." },
    ],
  },

  "glossary": {
    title: "Glossary",
    summary:
      "FieldQuo's own words — seat, crew login, instant estimate, add-on, takeoff, price book, white label, service plan, work area, bank debit and the rest — in the sense the screens use them.",
    updated: "2026-09-12",
    intro: [
      "A short dictionary of the words FieldQuo uses that another tool may use differently, or not at all. Each definition is the sense the screen means; where a word has a settings row, the row is named.",
    ],
    sections: [
      {
        id: "selling-the-work",
        heading: "Selling the work",
        blocks: [
          { table: {
            head: ["Term", "What it means in FieldQuo"],
            rows: [
              ["Lead", "An enquiry — from your website form, booking link, instant estimate, receptionist or a referral — on the **Leads** board, scored Hot, Warm or Cold."],
              ["Quote", "The priced offer you send. It keeps the language it was created in and carries your branding, as a page and a PDF."],
              ["Quote type", "A kind of work you sell, with its intake questions and rates, on **Settings → Services & Pricing**. The trade's built-in types plus your own custom ones."],
              ["Takeoff", "The trade-specific form that turns measurements into priced lines — squares of roof, doors and drawer fronts, linear feet."],
              ["Price book", "**Settings → Products & Services**: your own services and products with their rates. A line on a quote is picked from here."],
              ["Instant estimate", "A price range a homeowner produces themselves on your website, from your rates, never ours. It lands in **Quote reviews** before it can go out."],
              ["Quote review", "The step where a person confirms an instant estimate's price and presses **Approve**. Nothing an algorithm priced reaches a client without it."],
              ["Add-on", "An optional extra at the bottom of a quote that the client can tick on the approval page. The server prices it; the browser never sends an amount."],
              ["Good, better, best", "Three priced options on one quote. The pricing exists behind the scenes, but there is no screen for it yet."],
              ["Break-even price", "The least a job must fetch to cover your overhead, worked out on **Settings → Overhead** from your real fixed costs."],
            ],
          } },
        ],
      },
      {
        id: "doing-the-work",
        heading: "Doing the work",
        blocks: [
          { table: {
            head: ["Term", "What it means in FieldQuo"],
            rows: [
              ["Job", "The work after a quote is approved: visits, crew, materials, photos, checklists. Most jobs are made from an accepted quote."],
              ["Visit", "One scheduled trip to the address, on the **Calendar**. A job can have several."],
              ["Arrival window", "The span you promise the client (“between 8 and 10”) rather than a minute, set on **Settings → Booking Page** with the travel buffer."],
              ["Shift", "A person on a job for a span of hours on **Assign shifts**. A draft until the week is published; the crew sees published shifts only."],
              ["Work area", "A named territory or project on **Settings → Work Areas**, with the team members assigned to it, used to group jobs and tasks."],
              ["Checklist", "Standard steps the crew works through on site, per phase, from **Settings → Checklists**."],
              ["Time clock", "The crew's own punch — **Clock in**, **Clock out** — reviewed by the office on **Timesheets** before a pay run."],
              ["Crew inbox", "The number your crew text photos and updates to; they file themselves against the right job, and the ones that cannot wait under **Needs you**."],
              ["Job costing", "Quoted against actual — labour from logged hours, materials and expenses — so you know what a job made. A switch in a person's access grid."],
              ["Service plan", "Recurring work sold as a package on **Service Plans**: a standing instruction to raise a visit and an invoice on a cadence."],
            ],
          } },
        ],
      },
      {
        id: "getting-paid",
        heading: "Getting paid",
        blocks: [
          { table: {
            head: ["Term", "What it means in FieldQuo"],
            rows: [
              ["Invoice", "The bill, mirroring the quote's sections and branding, emailed with a pay-now link."],
              ["Deposit", "The part of the quote due to book the job, set by the **Payment schedule** card on **Settings → Company Settings** — for example 50% to book and 50% on installation."],
              ["Booking fee", "A charge taken when a visit is booked online, credited back against the invoice when the work goes ahead."],
              ["Processing fee", "What a card or bank-debit payment costs you, taken off the payment before it reaches your bank: 3% + 30¢ on a card."],
              ["Bank debit (Canada)", "Pre-authorized debit for Canadian clients billing in Canadian dollars: 1% + 40¢, capped at $5 a payment."],
              ["Client portal", "The page a client reaches from the invoice email: their balance, invoices with a Pay button, and quotes. No login."],
              ["Payout", "Stripe moving your balance to your bank, on its schedule. An instant payout to a debit card costs 1%."],
              ["Follow-up rule", "An automatic email a set time after a quote, invoice or job hits a state — on **Settings → Follow-ups**."],
            ],
          } },
        ],
      },
      {
        id: "your-team-and-your-plan",
        heading: "Your team and your plan",
        blocks: [
          { table: {
            head: ["Term", "What it means in FieldQuo"],
            rows: [
              ["Seat", "Somebody who creates and changes quotes, jobs and invoices. Seats are the only thing the four plans differ by."],
              ["Crew login", "Somebody who clocks in, reads their schedule and adds photos. Free, and never counted as a seat."],
              ["Access level", "One of five presets on **Your team** — Crew, Estimator, Dispatcher, Manager, administrator — each a filled-in grid of eleven areas and three switches."],
              ["Custom", "What a row reads once the owner has changed a single dial away from its preset."],
              ["Administrator", "Everything the owner has except ownership itself. For a partner or a bookkeeper."],
              ["Pay run", "A period's pay worked out from approved hours and your rates, with payslips. FieldQuo does not move the money."],
              ["AI allowance", "The monthly amount of AI work included with your plan, shared by everything AI does for you."],
              ["AI credit and phone credit", "Credit you buy on **Settings → AI credit** for phone minutes and AI images. Separate from the allowance."],
              ["Referral month", "A free month for you and for the business you referred, once they are paying."],
              ["Support session", "A FieldQuo staff member looking at your account read-only. Logged, and flagged in the Activity Log."],
            ],
          } },
        ],
      },
      {
        id: "your-brand-and-your-clients",
        heading: "Your brand and your clients",
        blocks: [
          { table: {
            head: ["Term", "What it means in FieldQuo"],
            rows: [
              ["White label", "Every document a client sees carries your name, logo and colour, not FieldQuo's. The default, not an upgrade."],
              ["Brand colour", "The one hex on **Settings → Branding** every client-facing surface derives from; the contrast is computed so it stays readable."],
              ["Email domain", "Your own domain on **Settings → Email Domain**, so the From line is yours and nothing says “via fieldquo.com”."],
              ["Booking page", "The public page where a client picks a slot from your real availability."],
              ["Funnel", "A tap-through page for an ad or a flyer that qualifies a visitor and drops a scored lead into **Leads**."],
              ["Bio link", "One branded page for the single link Instagram and TikTok allow."],
              ["“On my way” text", "The one text your client gets when the crew leaves for their address; the wording is yours on **Settings → Client messages**."],
              ["Review request", "The one polite ask for a review a client gets after a job is done and paid, from **Settings → Reviews**."],
            ],
          } },
        ],
      },
    ],
  },

  "what-your-clients-get": {
    title: "What your clients get out of it",
    summary:
      "The homeowner's side of FieldQuo — the quote they sign, the invoice they pay, the portal that shows what they owe, the texts before a visit — all carrying your name.",
    updated: "2026-09-12",
    intro: [
      "Your clients never sign up for anything. They get an email, a text or a link, open it on their phone, and see a page with your logo on it. This article is that side of the product: what each surface shows them, and where you control it. The full walk-through of each page is the [[nothing-says-fieldquo|What your clients see]] category.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every surface a client touches is built from the same brand: your logo and colour from **Settings → Branding**, your name in the From line, your language rules. A homeowner comparing three contractors cannot tell that two of them use FieldQuo. The single exception is the small “Site by FieldQuo” footer on a free website." },
          { p: "None of it needs a login. A quote link, an invoice link and the portal link are each unguessable on their own, which is what stands between a stranger and a client's billing history." },
        ],
      },
      {
        id: "the-documents",
        heading: "The documents",
        blocks: [
          { table: {
            head: ["What they get", "What it shows", "Where you control it"],
            rows: [
              ["The quote email", "Your name and logo, the PDF attached, in the quote's language, with the references and before-and-after photos you chose to include.", "**Settings → Quote Email**, **Settings → Email Domain**"],
              ["The approval page", "The quote as a page: the lines, the scope of work and terms, optional add-ons to tick, a signature box, and the deposit to pay if you asked for one.", "The quote builder; **Settings → Company Settings** for the payment schedule"],
              ["The invoice email", "The same sections and branding as the quote, with a pay-now link.", "**Settings → PDF Templates**, **Settings → Payments**"],
              ["The pay page", "The invoice with a **Pay** button for card — and bank debit for Canadian clients — once Stripe is live. Without Stripe, how to pay you another way instead.", "**Settings → Payments**"],
              ["Pay over time", "A monthly option at checkout, decided by the lender, if you turned it on. FieldQuo does not lend and does not approve anyone.", "**Settings → Payments**"],
            ],
          } },
        ],
      },
      {
        id: "the-portal",
        heading: "The client portal",
        blocks: [
          { p: "The link in an invoice email opens the client's account with you: your logo, **Account for** their name, then **Balance owing** as one big number — or **Nothing outstanding. Thank you.** Under it, **Invoices**, each with its total, what is paid, the due date and a **Pay** button or **Paid**; then **Quotes**, each marked **Awaiting your reply**, **Approved** or **Declined**, with **Review** on one still waiting. The footer names your company, phone and email for questions." },
          { p: "It is in the client's language, and the pay button is the same Stripe charge as the invoice email's — see [[the-client-portal|The client portal]]." },
        ],
      },
      {
        id: "before-and-after-a-visit",
        heading: "Before and after a visit",
        blocks: [
          { bullets: [
            "**The booking page** — a client picks a slot from your real availability, with travel time and arrival windows built in, and pays a booking fee if you set one.",
            "**The appointment reminder** — a text before you arrive. Text only, no email, and the wording is not editable yet.",
            "**The “On my way” text** — sent when the crew leaves, in your own words from **Settings → Client messages**.",
            "**The review request** — after the job is done and paid, one polite ask for a review, with your review link.",
          ] },
          { note: "Those are the only automated texts a client receives. FieldQuo does not text clients about anything else on its own — see [[texting-clients-what-is-and-is-not-automated|Texting clients: what is automated and what is not]]." },
        ],
      },
      {
        id: "before-they-are-a-client",
        heading: "Before they are a client",
        blocks: [
          { p: "A stranger meets you through your website, the instant estimate, the self-quote form, a funnel or the bio link — every one branded yours and every one landing in **Leads**. The instant estimate shows a range from your rates and never shows the rate card; it comes to **Quote reviews** for a person to confirm before it is binding. See [[instant-quotes-on-your-website|Instant quotes on your website]]." },
        ],
      },
    ],
    faq: [
      { q: "Do my clients need an account or a password?", a: "No. Every page they open is reached from a link in an email or a text." },
      { q: "Can a client see another client's quote?", a: "No. Each link opens one client's own documents, and the links are unguessable." },
      { q: "What if a client's language is not mine?", a: "Set it on their client record. The emails and the portal follow the client's language; a quote keeps the language it was created in." },
      { q: "Does a client ever see the word FieldQuo?", a: "Only the “Site by FieldQuo” footer on a free website. Not on a quote, invoice, email, text, booking page or the portal." },
    ],
  },
};
