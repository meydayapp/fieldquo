// content/help/en/reports-and-insights-1.js
//
// Part 1 of the “reports-and-insights” category in English (see the
// composer, reports-and-insights.js). Slugs assigned to this part
// (lib/help/tree.js): the-dashboard-in-detail, the-revenue-goal,
// how-you-compare, the-kpi-dashboard, kpi-sales, kpi-money-flow,
// kpi-business-costs, kpi-profit, kpi-execution, kpi-quality, kpi-cash.
//
// Every definition below is read from the builders the screens call —
// lib/dashboard/rank.js, lib/analytics/overview.js, lib/analytics/goal.js,
// lib/analytics/pricingBenchmark.js, lib/analytics/kpis.js,
// lib/analytics/moneyFlow.js, lib/analytics/receivables.js,
// lib/costing/utilisation.js — and the gates from the routes under
// app/api/analytics. The sample floors (10 and 5) are RATE_FLOOR and
// COUNT_FLOOR in lib/analytics/kpis.js; the words on the screen are the `en`
// block of app/i18n/appMessages.js.
export const ARTICLES = {
  "the-dashboard-in-detail": {
    title: "The dashboard in detail",
    summary:
      "Every card on Home, top to bottom: what is waiting on you, the revenue figure and the four tiles, the detail underneath, the Chase payment button, and who sees which panel.",
    updated: "2026-09-12",
    intro: [
      "**Dashboard — Here's what's happening with your business.** Home is the screen your team opens most, so it is ranked rather than tiled: what needs a person today comes first, then the one figure the business runs on, then four supporting figures, and everything else under a line called **The detail**. This article walks it top to bottom and says where every number comes from.",
      "[[the-dashboard|The dashboard: what is waiting on you]] is the short version — the ranking and why. This one is the detail: every card, every state a card can be in, every button, and which access level sees what.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every figure on the page is fetched from a handful of endpoints, and each panel is drawn only when its endpoint answered. A member the server refused for a panel simply does not get that panel — no zero, no apology — because “$0 revenue this month” is a claim about the business, not a blank. A panel that failed for any other reason says so and offers a retry." },
          { p: "Two measures of money sit side by side and are never mixed. **Revenue this month** totals invoices marked paid this month, by the date they were paid. **Money received** counts payments by the month the money landed. An invoice marked paid in August against a deposit recorded in July disagrees by design, and the caption under the chart says which is which." },
        ],
      },
      {
        id: "waiting-on-you",
        heading: "Waiting on you",
        blocks: [
          { p: "**Waiting on you** opens the page and lists the invoices that are actually late — the client, the amount, **12 days past due**, the invoice number — with a **Chase payment** button on each. Up to five rows are named; past that, a **{count} more overdue** link opens the Invoices list. An invoice with no due date is never here: it has no deadline to miss." },
          { bullets: [
            "**2 quotes waiting for you to approve the price.** — instant estimates from your website or from a call, waiting in [[estimate-reviews|Estimate Reviews]] for a person to confirm the price.",
            "**3 calls from your receptionist — nothing done yet.** — calls the AI receptionist took that have neither become a quote nor been archived. The line opens the Receptionist screen.",
            "**You have 1 appointment coming up from your calls — the next is …** — the visits the receptionist booked that are still ahead. The line opens the calendar.",
          ] },
          { figure: "harness:home", caption: "Dashboard — Waiting on you at the top, then Revenue this month beside the Money received sparkline, then the four tiles." },
          { note: "The block removes itself when nothing is late and nothing is waiting. A quiet day has no banner, which is what makes the banner mean something on a busy one." },
        ],
      },
      {
        id: "revenue-and-the-four-tiles",
        heading: "Revenue this month and the four tiles",
        blocks: [
          { p: "**Revenue this month** is the total of invoices marked paid since the 1st, in large type, with the caption “The total of invoices marked paid this month.” Under it, a change against last month — “CA$2,480.50 more than last month.” — appears only when the company existed for the whole of last month; a company in its first month gets the figure and no invented trend. On the right, **Money received** draws the last six months of payments as a line, with one sentence comparing the last two complete months — never the month in progress against a finished one." },
          { table: {
            head: ["Tile", "What it counts", "The change line under it"],
            rows: [
              ["**Quotes sent this month**", "Quotes created this month whose status is sent, accepted or declined.", "“2 more than last month.” — only when last month was a full month of trading."],
              ["**Conversion rate**", "Quotes accepted this month ÷ quotes sent this month, printed with its counts beside it: “38%” then “6 of 16 · % of sent quotes clients accepted”.", "“9 points higher than last month.” — only when both months had at least 10 quotes sent."],
              ["**Money owed**", "What is outstanding across every unpaid invoice — the latest version of each, less the payments recorded against it — and “{amount} of that is past due.”", "None. A balance has no honest last-month figure to compare with."],
              ["**Upcoming visits**", "Every appointment, job visit and held booking still ahead of today.", "None. What is ahead has no prior period."],
            ],
          } },
          { p: "Under 10 quotes sent, the conversion tile shows the counts alone — “1 of 1”, then “Quotes accepted. A rate needs 10 sent in a month before it means anything.” A percentage off two quotes is a number you would act on and should not. Money owed has three states and none of them is $0.00: “No invoices yet, so nothing is owed to you.”, “Nothing outstanding — every invoice you have sent has been settled.”, or the figure." },
        ],
      },
      {
        id: "the-detail",
        heading: "The detail",
        blocks: [
          { p: "Three buttons sit between the tiles and the line: **+ New quote** (drawn only for someone who may create quotes), **View Clients** and **Schedule Appointment**. Under **The detail**, the page keeps everything it used to open with:" },
          { bullets: [
            "**Money received** — the monthly bar chart with **3m / 6m / 12m** buttons. The current month is drawn in grey and captioned as still in progress; a month with nothing in it gets no bar at all.",
            "**Money owed** — the total “Across {count} unpaid invoices”, the amount past due, the aging ladder (**Not yet due**, **1–30 days**, **31–60 days**, **61–90 days**, **90+ days**, plus **No due date**) showing only the rungs with something on them, then up to six invoices with the client's contact details, **amended, v2** when there was a revision, a **Job** link, **Last chased … · 2×** and **Automatic reminder sent …** lines, and the Chase payment button. The footer says whether an automatic overdue reminder exists, with **Set one up** or **Change it**. Full detail: [[money-owed-and-receivables-aging|Money owed and receivables aging]].",
            "**Revenue goal** — the yearly target and your pace against it; see [[the-revenue-goal|The revenue goal]].",
            "Bookings held for a visit fee that has not been paid yet — they are on no calendar, so this is the one place they show. Absent when there are none.",
            "**Recent Quotes** — the five newest, with **View all**. Absent for a member who cannot see quotes.",
            "**Upcoming Appointments** — the next five on the diary, with **View all**. A member who only sees their own schedule sees their own here.",
          ] },
          { p: "Above the money, a new company also sees **Finish setting up FieldQuo** with its progress ring until every step is done, and an owner or administrator sees **Additional set-up steps** — ten rows that each disappear when the database says the step is done, or when you press **Done, hide**." },
        ],
      },
      {
        id: "how-to-chase",
        heading: "How to chase a payment from Home",
        blocks: [
          { steps: [
            "Find the invoice in **Waiting on you** (if it is late) or in **Money owed** (late or not) and press **Chase payment**.",
            "FieldQuo emails the client a payment request with a link to their portal, from your company's name, and stamps the invoice. The row then reads “Payment request emailed to {address} at {time}”.",
            "If the client has no email on file, the row says so instead of showing a button. **Last chased … · 2×** counts your chases; **Automatic reminder sent …** shows what the overdue rule in [[invoice-reminders-and-chasing|Invoice reminders and chasing]] already did on its own.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Home is on everyone's sidebar, but each panel has its own gate, checked by the server. The money — the revenue figure, three of the four tiles, Money received and Money owed — needs the **See prices** switch; Money owed also needs at least **View only** on Invoices. Recent Quotes needs View only on Quotes. The Chase payment button needs **View, create, and edit** on Invoices. The set-up cards are for owners and administrators." },
          { p: "With the four presets: **Crew** sees Upcoming visits and their own Upcoming Appointments and nothing about money; **Estimator**, **Dispatcher** and **Manager** see the whole page; and only a Manager, an owner or an administrator can press Chase payment. The panels a member cannot see are absent, not zeroed. See [[access-levels-overview|Access levels: who sees what]]." },
        ],
      },
    ],
    faq: [
      { q: "Why do Revenue this month and Money received disagree?", a: "They measure different things: invoices marked paid this month, and payments by the month the money arrived. A deposit received in July on an invoice marked paid in August shows in July's bar and in August's figure." },
      { q: "Why is there no change line under Revenue this month?", a: "The comparison needs last month to have been a full month of trading. A company that signed up on the 15th gets the figure and no trend until its first complete month has passed." },
      { q: "A team member sees nothing under Money owed. Is it broken?", a: "No — that member was refused the figure, usually because See prices is off or Invoices is set to No access. A refused panel is left out rather than shown as $0." },
    ],
  },

  "the-revenue-goal": {
    title: "The revenue goal",
    summary:
      "Set a yearly target once and Home shows whether you are ahead of it or behind it today, in dollars — how the pace, the projection and the monthly figure are worked out, and who can change the goal.",
    updated: "2026-09-12",
    intro: [
      "The **Revenue goal** card on Home is a yearly target you set once, and a pace bar that says whether you are ahead of it or behind it today. It leads with pace, in dollars, because “$180,000 of $500,000” means nothing without the date — 36% is triumphant in April and a disaster in November.",
      "Everything on the card is worked out from the one number you type. Nothing else is stored: the monthly and weekly targets, the pace and the projection are all derived, so they can never drift from the annual figure.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The goal belongs to the company, not to a person: one target, set by an owner or administrator, shown to everyone who can see the dashboard's money. Progress is measured on the same figure as **Revenue this month** — invoices marked paid, by the date they were paid — widened to the year, so the goal card and the revenue card can never tell two different stories about the same money." },
          { p: "With no goal set, an owner or administrator sees the card as the prompt to set one — “Set a target for the year and the dashboard will track your pace toward it.” with a **Set a revenue goal** button — and everyone else sees no card at all. There is no dead prompt for someone who cannot act on it." },
        ],
      },
      {
        id: "set-the-goal",
        heading: "How to set, change or clear the goal",
        blocks: [
          { steps: [
            "Open **Home** and scroll to **The detail**. Press **Set a revenue goal**, or the pencil on an existing card (**Change goal**).",
            "Type the year's target in the **$ … / year** box. As you type, the card says what that is per month and per week — “That's about $41,667/month, $9,615/week.”",
            "Press **Save**. The figure is rounded to whole dollars and capped at $100,000,000, so a fat-fingered extra zero is caught rather than stored and quietly making every target impossible.",
            "To remove it, open the editor again and press **Clear goal**. Saving a blank or a zero clears it the same way.",
          ] },
          { note: "Setting or clearing the goal is written to the Activity Log as “Set the revenue goal to …” or “Cleared the revenue goal”, under the name of whoever did it." },
        ],
      },
      {
        id: "what-the-card-shows",
        heading: "What the card shows",
        blocks: [
          { table: {
            head: ["Line", "What it means"],
            rows: [
              ["**Revenue goal · $500,000/yr**", "The annual target you saved."],
              ["**$180,000 this year**", "Invoices marked paid since January 1st, by paid date."],
              ["**On pace** / **$22,000 behind pace** / **$9,000 ahead of pace**", "Revenue to date against what a steady pace would have produced by today. Behind is amber; on pace and ahead are green."],
              ["The bar and the tick", "The fill is progress to the goal; the small tick is where a steady pace would have you by today. A fill short of the tick is behind; past it, ahead."],
              ["**36% of goal**", "Revenue to date as a share of the annual target."],
              ["**$41,667/mo · projecting $480k**", "The annual target over twelve, and where the year ends if today's daily rate holds."],
            ],
          } },
        ],
      },
      {
        id: "how-pace-is-worked-out",
        heading: "How the pace is worked out",
        blocks: [
          { bullets: [
            "**Expected by now** is the annual goal multiplied by the fraction of the year that has elapsed, counted in calendar days on the UTC calendar — 366 in a leap year, so the maths never drifts by a day.",
            "**On pace** means revenue to date is within 2% of that expected figure either way — a tolerance band, so the card does not flicker between ahead and behind on every sale.",
            "**Projecting** holds today's daily rate for the rest of the year. In the first days of January one big job projects to a wild number, which is why the projection sits in small type beside the monthly target rather than as the headline.",
            "The monthly target is the annual over 12, flat; weekly is over 52; daily is over 365. No seasonal curve is invented — a painter's March and December are not the same, and the card does not pretend to know by how much.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone who can see the dashboard's money — the **See prices** switch — sees the card once a goal exists. Only an **owner** or an **administrator** can set, change or clear it: the server refuses everyone else, and the pencil is not drawn for them. A Manager sees the pace but cannot move the target." },
          { note: "The words on this card are not yet in the translation catalogue. It reads in English — “Revenue goal”, “On pace”, “behind pace” — whatever language the rest of the app is in." },
        ],
      },
    ],
    faq: [
      { q: "Can I set a monthly goal instead?", a: "Not directly. You set the year and the card derives the month (the annual over 12) and the week (over 52). A stored monthly figure would drift from the annual one the moment either was edited." },
      { q: "Does the goal count quotes accepted or invoices sent?", a: "Neither. It counts invoices marked paid this year, by the date they were paid — the same measure as Revenue this month." },
      { q: "Why does the projection look wrong in January?", a: "It holds the daily rate so far for the rest of the year, and a few days of data make a poor rate. It settles as the year fills in." },
    ],
  },

  "how-you-compare": {
    title: "How You Compare: your prices against the platform",
    summary:
      "Insights opens on an anonymised pricing comparison: your average per service category against every opted-in company's average — how to opt in, exactly what goes into the average, and what the page never shows.",
    updated: "2026-09-12",
    intro: [
      "**How You Compare — Your average quote pricing vs. the anonymized platform average, by service category.** Insights opens on this page: for each service category you have switched on, what you charge on average against what every other company that opted in charges, and the difference as a percentage.",
      "It is opt-in, it is aggregates only, and it never shows another company's quote. Every other report in FieldQuo answers about your own data alone; this is the one screen where other tenants' numbers appear at all, pooled and anonymised. This article says exactly what goes into the average and what does not.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is one row per category, under a row of links — **Weekly digests**, **Financial statements**, **Won and lost**, **Estimate accuracy**, **KPI dashboard** — because the sidebar has one **Insights** row for the whole group. Until you opt in, the rows are replaced by “Benchmarking is opt-in. Turn it on in Settings to see how your pricing compares — your individual quotes are never shared, only aggregated averages.” with a **Go to Settings** button." },
          { figure: "live:app-analytics-benchmark", caption: "Insights → How You Compare before opting in — the note, the Go to Settings button and the links to the rest of the group." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "How to turn it on",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings** and find the **Industry benchmark** card.",
            "Tick **Share my anonymized figures to unlock benchmarks** and save. The hint under it is the whole deal: “Your numbers are pooled with other companies and never shown individually. You can turn this off any time.”",
            "Return to **Insights**. A row appears for every category you have enabled where the platform sample is big enough.",
            "To leave, untick the box and save. Your figures stop feeding the pool and the page goes back to the opt-in note.",
          ] },
          { note: "Sharing is symmetric: the pool is built only from companies that ticked the box, so you read it only while you contribute to it." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { figure: "harness:insights", caption: "How You Compare — one row per category: your average, the platform average and the difference." },
          { table: {
            head: ["Column", "What it is"],
            rows: [
              ["The category, and “61 quotes in your region this quarter”", "A service category from Settings → Services, and the size of the platform sample the average is drawn from."],
              ["**Your average**", "The average priced amount of that category's scope groups across your own quotes."],
              ["**Platform average**", "The same average across every opted-in company's quotes in that category."],
              ["The arrow and the percentage", "Yours against the platform: green with an up arrow above +3%, amber with a down arrow below −3%, a grey dash in between. A dash with no percentage means there was nothing to compare against."],
            ],
          } },
        ],
      },
      {
        id: "how-the-average-is-built",
        heading: "How the average is built",
        blocks: [
          { bullets: [
            "Both averages are taken over **scope groups** — the sections a quote is grouped into by category — not over whole quotes. A kitchen quote with a cabinets group and a countertop group contributes to two rows.",
            "A row appears only when you have at least one priced group in that category and the platform has at least **5**. Below five, a competitor's price could be recovered from the average, so nothing is published.",
            "Demo companies are excluded from the pool whatever their own settings say — invented prices do not get to tell a real contractor what the market charges.",
            "When every group in a sample has no priced amount, the average shows **—** rather than $0.00, and no percentage is drawn from it.",
            "The arithmetic today has no date window and no region filter: it averages every priced scope group in the category, across all time, for you and for the pool. The wording of the sample line about region and quarter is ahead of the code.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What the other tools do not do",
        blocks: [
          { p: "FieldQuo's comparison pages record what each competitor's own pricing page lists, with the date it was read. None of the five pricing pages tracked — Jobber, Housecall Pro, ServiceTitan, Projul and QuoteIQ — lists a comparison of your prices against other companies on the same platform, so this page appears under “not listed on their pricing page” on every comparison." },
          { p: "That is the whole claim. It does not say the others could not build one; it says they do not sell one on the page a buyer reads." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The page and its endpoint need the **See prices** switch — every number on it is money, including your own rate card. Crew is refused; Estimator, Dispatcher, Manager, owners and administrators can read it. The opt-in box lives on Company Settings, which needs the people-management permission — Dispatcher, Manager, owner or administrator." },
        ],
      },
    ],
    faq: [
      { q: "Can another company see my quotes?", a: "No. Only an average over at least five scope groups from the pool is ever shown, and a category with fewer than five is not shown at all." },
      { q: "Why is a category missing from the list?", a: "Either you have no priced quote in it, or fewer than five platform quotes exist for it yet. The page says “Not enough platform data yet for your region/category” when nothing qualifies." },
      { q: "Does opting in change what my clients see?", a: "No. It changes nothing on quotes, invoices or the booking page — only whether your figures join the pool and whether this page shows rows." },
    ],
  },

  "the-kpi-dashboard": {
    title: "The KPI dashboard",
    summary:
      "One screen for sales, money flow, business costs, profit, execution, quality, cash and customer — the period buttons, what each section holds, how a card reads when it has no data, and who can open it.",
    updated: "2026-09-12",
    intro: [
      "**KPI dashboard — Sales, profit, execution and cash, in one place — most of these numbers have never had a screen before. A card with no data says why, rather than showing a zero.** That subtitle is the design: one period selector, nine sections, and a rule that a card either prints a number it can stand behind or says in words why it cannot.",
      "This article is the map of the screen — the period buttons, the sections and what each holds, how to read a card, and who can open the page. Each section has its own article with every card's exact definition.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page lives under **Insights → KPIs** in the sidebar, with a **How you compare** link back to the Insights hub. Nothing on it is computed a second time: the win rate is the Won and lost report's, accounts receivable is the dashboard's, estimate accuracy is the Estimate accuracy report's — so a figure here can never disagree with the screen it came from." },
          { figure: "live:app-analytics-kpis", caption: "KPI dashboard — the period buttons, then Sales, Money flow, Business costs, Profit and Execution, each card printing a number or the reason it cannot." },
        ],
      },
      {
        id: "the-period",
        heading: "The period",
        blocks: [
          { p: "Five buttons choose the period, and one choice governs every section. The default is **This quarter**. Periods are calendar periods on the UTC calendar — the same calendar every report uses — so two screens never disagree about which month a document belongs to." },
          { bullets: [
            "**This month** — the 1st to the last day of the current month.",
            "**Last month** — the whole previous month.",
            "**This quarter** — the current calendar quarter, to its last day.",
            "**Year to date** — January 1st to today.",
            "**Last year** — January 1st to December 31st of last year.",
          ] },
          { note: "This month and This quarter run to the end of the period, not to today. The cards that compare against a prior period allow for that — see [[kpi-money-flow|KPIs: Money flow]] — so a quarter three days old is not measured against a full one." },
        ],
      },
      {
        id: "the-sections",
        heading: "The sections",
        blocks: [
          { table: {
            head: ["Section", "Cards", "Article"],
            rows: [
              ["**Sales**", "Win rate · Average job value · Lead → quote conversion · Backlog", "[[kpi-sales|KPIs: Sales]]"],
              ["**Money flow**", "Income · Expenses · Remaining · Income vs. expenses, by day · Where the money went", "[[kpi-money-flow|KPIs: Money flow]]"],
              ["**Business costs**", "Payroll this period · Fixed costs · Marketing spend · Committed, not yet invoiced", "[[kpi-business-costs|KPIs: Business costs]]"],
              ["**Profit**", "Gross margin (typical job) · Net margin (typical job) · Labour cost, % of revenue · Revenue per employee", "[[kpi-profit|KPIs: Profit]]"],
              ["**Execution**", "On-time completion · Labour utilisation · Estimate accuracy (median variance) · Recent jobs: scheduled window vs. completion", "[[kpi-execution|KPIs: Execution]]"],
              ["**Quality**", "Rework / callback rate · Change-order rate", "[[kpi-quality|KPIs: Quality]]"],
              ["**Cash**", "Accounts receivable, by age · Money received, last 6 months", "[[kpi-cash|KPIs: Cash]]"],
              ["**Customer**", "Customer satisfaction · Answers by score", "[[kpi-customer|KPIs: Customer]]"],
              ["**Not tracked**", "The metrics the page names and refuses to invent", "[[the-metrics-fieldquo-refuses-to-invent|The metrics FieldQuo refuses to invent]]"],
            ],
          } },
        ],
      },
      {
        id: "how-a-card-reads",
        heading: "How to read a card",
        blocks: [
          { bullets: [
            "A **value** in large type, and under it the sample it was drawn from — “24 jobs/quotes”. A rate without its denominator is a number you have to trust rather than check, so the count is always beside it.",
            "A **—** and a sentence when there is no value: “1 of 10 so far — 9 more and this becomes reliable.”, “No jobs were completed in this period.”, “No leads yet this period.” The sentence is the card's reason, never a placeholder.",
            "A **warning triangle** when the number is real but knowably short — hours with no pay rate, materials bought off the buy-list and never expensed — with “some data missing, see below”. The figure is shown; it is not averaged over the gap.",
            "Two floors. A **percentage** (win rate, conversion, on-time completion, rework, change orders) needs **10** decided outcomes; a **central figure** over jobs (average job value, the margins, labour cost, satisfaction) needs **5**. Below the floor the card counts what it has and says how many more it needs.",
            "An **≈** before a money figure means part of it was converted from another currency at the pinned rate; the hint under the tile names the original amount and how old the rate is.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What the other tools do not do",
        blocks: [
          { p: "This dashboard is not on FieldQuo's public comparison table yet — the feature matrix leaves it off until a features page exists for it, rather than claim a row nobody can read. What the code does that a generic dashboard does not: a card under its sample floor prints no percentage at all, a knowably short figure is flagged instead of smoothed, and a section called **Not tracked** names the metrics it will not fabricate." },
          { p: "Where a piece of it is listed by a competitor, the matrix says so: job costing is on Jobber's Grow tier and QuoteIQ's Pro tier, which is why [[job-costing|Job costing]] is not marked as unique to FieldQuo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The page is all-or-nothing: the server refuses the KPI request unless the member holds **View only** or better on Quotes, Jobs, Invoices and Requests, sees every job rather than only assigned ones, and has both the **See prices** and **Job costing** switches. The sidebar row is hidden on the Job costing switch alone; a bookmarked address is stopped by the same check." },
          { bullets: [
            "With the presets: **Crew**, **Estimator** and **Dispatcher** are refused — none of them holds Job costing. **Manager**, owners and administrators see the page.",
            "**Money flow** has its own gate inside the page — Invoices at View only, Expenses at **View, record, and edit everyone's**, See prices — and refuses inside the section, not the whole page. Manager passes.",
            "**Business costs** is narrower again: Job costing plus **View everyone's payslips** on Payroll plus people management. With the presets that is owners and administrators; a Manager sees the rest of the page and a refusal in that section.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Why does a card say — when I know the number?", a: "Because the page will not print a figure below its floor or with no evidence. The sentence under the dash says what is needed — usually more decided quotes or more completed jobs in the period." },
      { q: "Can I pick my own dates?", a: "No. Five presets, and one selection for the whole page. The Financial statements page uses the same five." },
      { q: "Where is safety?", a: "The KPI page carries no safety card today. Incidents are recorded and listed on the Safety screen; the per-1,000-hours rate the API computes has no card yet." },
    ],
  },

  "kpi-sales": {
    title: "KPIs: Sales",
    summary:
      "The four Sales cards on the KPI dashboard — win rate, average job value, lead-to-quote conversion and backlog in weeks — with the exact definition of each and the sample it needs before it prints.",
    updated: "2026-09-12",
    intro: [
      "**Sales — What went out, what came back, and how far ahead you're booked.** Four cards: **Win rate**, **Average job value**, **Lead → quote conversion** and **Backlog**. The first two are read straight from the Won and lost report, so they can never disagree with it; the other two exist only here.",
      "Every card carries its sample size, and none prints a percentage under 10 decided outcomes or an average under 5 won quotes. Below the floor the card says how many more it needs.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A quote belongs to the period by the date it was **sent**; a quote never stamped sent counts by the date it was accepted or declined. A Good / Better / Best trio is one opportunity, not three: the group is collapsed before anything is counted, so a client choosing one of three options cannot show as one win and two losses." },
          { figure: "harness:kpis", caption: "KPI dashboard → Sales — Win rate, Average job value, Lead → quote conversion and Backlog, each with its sample." },
        ],
      },
      {
        id: "win-rate",
        heading: "Win rate",
        blocks: [
          { p: "**Win rate** is the share of decided quotes that were won: quotes accepted ÷ (accepted + declined). A quote still sent and unanswered is neither — it is not in the denominator." },
          { bullets: [
            "It prints once **10** quotes in the period have been decided. Under that: “1 of 10 so far — 9 more and this becomes reliable.”",
            "Nothing decided yet: “Nothing's been decided yet this period. Once 10 quotes are marked won or lost, your win rate shows here.” No quotes at all: “Send quotes and get 10 of them decided — won or lost — and your win rate shows here.”",
            "The same 10 is the floor in [[won-and-lost|Won and lost]], where the rate is broken down by estimator, by category and by reason for losing.",
          ] },
        ],
      },
      {
        id: "average-job-value",
        heading: "Average job value",
        blocks: [
          { p: "**Average job value** is the average value of a **won** opportunity in the period: the accepted total, or the quoted total when no accepted total was recorded, over the number of won quotes." },
          { bullets: [
            "It needs **5** won quotes. Fewer: “Win 5 quotes and your average job value shows here.”, or the “{n} of 5 so far” count.",
            "A won quote with no readable total is left out and counted — the card shows the warning triangle rather than quietly averaging over a smaller set than the count beside it implies.",
          ] },
        ],
      },
      {
        id: "lead-to-quote-conversion",
        heading: "Lead → quote conversion",
        blocks: [
          { p: "**Lead → quote conversion** is the share of leads created in the period that became a quote. A lead counts as converted when it carries a link to a quote — the real link — not when someone moved its card to a column." },
          { bullets: [
            "It needs **10** leads in the period. Under that: “{n} of 10 so far — {m} more and this becomes reliable.”",
            "No leads: “No leads yet this period. Once 10 leads have come in, this shows what share turn into quotes.”",
          ] },
        ],
      },
      {
        id: "backlog",
        heading: "Backlog",
        blocks: [
          { p: "**Backlog** is how many **weeks** of accepted work are still ahead of you, at this period's pace — deliberately weeks, not months. The hint on the card says why: “Weeks of accepted work still ahead of you, at this period's pace — not months. A residential shop with 2–6 weeks booked is in good shape.”" },
          { bullets: [
            "The numerator is the value of every open job — not yet completed — whose quote is **accepted**, taken from the accepted total or the quoted total. An open job with no quote, or a quote never marked accepted, is counted and left out: its value would be inventing an agreement nobody gave.",
            "The denominator is a weekly pace: the value of the jobs **completed in this period**, divided by the weeks in the period.",
            "Nothing open and accepted is a real **0 weeks**, not a missing figure.",
            "A backlog with nothing completed this period has no pace to divide by: “There's a backlog, but no job with a priced quote was completed this period to measure a weekly pace against. Complete one and this fills in.” The dollar figure still shows on the Business costs section as **Committed, not yet invoiced**.",
          ] },
          { tip: "Change the period and the pace changes with it. Year to date gives the steadiest pace; This month gives the most recent one." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The Sales section is part of the page's single gate — see [[the-kpi-dashboard|The KPI dashboard]]. With the presets, Manager, owners and administrators see it; Crew, Estimator and Dispatcher are refused the whole page. An Estimator who needs their own numbers has the same win rate on Won and lost, which needs only View only on Quotes and See prices." },
        ],
      },
    ],
    faq: [
      { q: "Why is my win rate different from the Quotes list's Approved count?", a: "The rate counts decided quotes in the period by send date and collapses tier groups to one opportunity. The list counts documents. Both are right about what they count." },
      { q: "Does a pending quote lower my win rate?", a: "No. Only accepted and declined quotes are in the denominator; a quote still waiting on the client is neither." },
      { q: "Why does Backlog say 0 weeks when I have jobs scheduled?", a: "Those jobs have no accepted quote behind them — a manual job, a warranty callback — so they carry no agreed value. Only open jobs with an accepted quote are in the backlog." },
    ],
  },

  "kpi-money-flow": {
    title: "KPIs: Money flow",
    summary:
      "Income, Expenses and Remaining for the period with a day-by-day chart and a category breakdown — what each figure reads, how the comparison against last period is made fair, and the materials warning.",
    updated: "2026-09-12",
    intro: [
      "**Money flow — What came in, what went out, and what's left for this period — day by day. Income is actual payments received; expenses are what's been logged or imported, never a guess at what's missing.** Three tiles, a chart and a breakdown, and the plainest arithmetic on the page: two sums and a subtraction.",
      "It is a section of the KPI dashboard rather than a second screen, and it follows the same period buttons. It has its own gate, so a member who can see the rest of the page may see a refusal in this section alone.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Income** is payments recorded in the period — each payment counted once, by its own date, whichever version of the invoice it was taken against. It is deliberately not invoice totals, which an amendment would double-count. **Expenses** is every expense dated in the period, whether typed in on Expense Tracking or imported from a bank statement. **Remaining** is the one minus the other." },
          { p: "A company that has never recorded a payment, or never logged an expense, sees **—** on that tile and a sentence — “No expense has ever been recorded for this company.” with an **Import a bank statement →** link — never a confident $0.00. A company with history and a quiet month gets a real $0." },
        ],
      },
      {
        id: "the-three-tiles",
        heading: "The three tiles",
        blocks: [
          { table: {
            head: ["Tile", "What it sums", "When it is —"],
            rows: [
              ["**Income**", "Payment rows dated in the period, by the date the money was recorded.", "No payment has ever been recorded for the company."],
              ["**Expenses**", "Expense rows dated in the period — logged by hand or imported.", "No expense has ever been recorded for the company."],
              ["**Remaining**", "Income minus expenses.", "Either side is unknown — an unknown minus a real number is still unknown."],
            ],
          } },
          { figure: "harness:kpis", caption: "KPI dashboard → Money flow — Income, Expenses and Remaining with their trend lines, and the start of the daily chart." },
        ],
      },
      {
        id: "the-chart-and-categories",
        heading: "The chart and the breakdown",
        blocks: [
          { bullets: [
            "**Income vs. expenses, by day** draws one line for each, every calendar day of the period. Days that have not happened yet are dropped rather than drawn as a flat $0 line to the right — on the 3rd, a quarter is three days wide.",
            "**Where the money went** lists the three biggest expense categories and folds the rest into **Other**; the rows always add up to the period's expense total. An expense with no category becomes **Uncategorised** and competes for a place like any other, so nothing is dropped without being named.",
            "Category names are the words typed on the expense, shown as recorded — the same names Expense Tracking uses, so the two screens never disagree about what a category is called.",
          ] },
        ],
      },
      {
        id: "the-comparison",
        heading: "The comparison against last period",
        blocks: [
          { p: "Each tile carries “Up 26% on last period”, “Down 12% on last period”, “About the same as last period” or “Up from nothing last period”. The prior period is the same number of days immediately before this one — a 30-day month against the 30 days before it." },
          { bullets: [
            "For a period still in progress, the comparison is clamped to the days that have **happened** against the same number of days before the period started. Three days of September are compared with three days, not with all of August — otherwise every tile read “Down 91%” until the 28th of each month.",
            "The headline totals still cover the whole selected range: “what have I taken this month” means everything logged against it.",
            "“Up from nothing” is stated instead of a percentage when last period was $0 — up 100% from what is not a number anyone can read.",
          ] },
        ],
      },
      {
        id: "materials-warning",
        heading: "The materials warning",
        blocks: [
          { p: "Job costing reads expenses only; it never reads the materials buy-list on a job. A company that ticks purchases off the buy-list and never enters them as expenses has real spending that this section cannot see." },
          { warning: "When at least $200 was ticked off the buy-list in the period and the expenses on those jobs are a tenth of it or less, an amber note appears: “These jobs show {amount} bought off the materials buy-list this period, but only {expense} of that was ever entered as an expense…” The Expenses tile is still shown, with the warning triangle and “Some materials were bought off the buy-list and never logged”. Log them as expenses, or import the bank statement, and the note goes away." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "This section needs Invoices at **View only**, Expenses at **View, record, and edit everyone's**, and the **See prices** switch — company-wide expenses, not “my own”. With the presets, Manager, owners and administrators see it; an Estimator or Dispatcher, whose expenses are their own only, would be refused this section — though they are already refused the page. See [[expense-tracking-and-burn-rate|Expense tracking and your burn rate]] for the expense screen itself." },
        ],
      },
    ],
    faq: [
      { q: "Why is Income different from Revenue this month on Home?", a: "Home's revenue figure totals invoices marked paid; Income here totals payments by their own date. A deposit taken in one month on an invoice marked paid in the next lands in different months on the two screens." },
      { q: "Why does Expenses not include my crew's wages?", a: "Wages are clocked hours, not expense rows. They appear as Payroll this period under Business costs, kept separate so the same money is not counted twice." },
      { q: "Can I import my bank statement from here?", a: "Yes — the Import a bank statement → link opens the CSV import; see Import expenses from a bank CSV." },
    ],
  },

  "kpi-business-costs": {
    title: "KPIs: Business costs",
    summary:
      "Payroll this period, Fixed costs, Marketing spend and Committed, not yet invoiced — four figures built from what FieldQuo already knows, each labelled with what it includes and deliberately never summed into one total.",
    updated: "2026-09-12",
    intro: [
      "**Business costs — Payroll, fixed costs, marketing spend, and work already committed — built from what FieldQuo already knows, no bank statement required.** Four cards, each of which had a screen that computed it — Payroll, Settings → Overhead, the Marketing spend page, the Backlog card — and none of which had a money view together until this section.",
      "They are four different shapes of “true”, and the page never adds them up. This article says what each one reads, what it leaves out, and why there is no total.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Three of the four follow the period buttons; one does not. **Payroll this period** and **Marketing spend** are what happened between the period's first and last day. **Fixed costs** is a monthly figure whatever the period, because prorating rent to “this quarter” would invent a rule nobody asked for. **Committed, not yet invoiced** is a snapshot of today." },
          { figure: "live:app-analytics-kpis", caption: "KPI dashboard → Business costs — Payroll this period, Fixed costs, Marketing spend and Committed, not yet invoiced, on a company with no time or overhead recorded yet." },
        ],
      },
      {
        id: "the-four-cards",
        heading: "The four cards",
        blocks: [
          { table: {
            head: ["Card", "What it reads", "When it is —"],
            rows: [
              ["**Payroll this period**", "Approved clocked hours in the period × each worker's own pay rate, summed across the company.", "No approved time has ever been recorded for the company."],
              ["**Fixed costs**", "The monthly total from Settings → Overhead — rent and fixed costs, overhead salaries, loan and asset costs — unchanged and per month.", "No rent, overhead pay, loans or assets have been recorded yet."],
              ["**Marketing spend**", "Marketing spend rows dated in the period, across every channel, in the company's currency.", "No marketing spend has ever been logged for the company."],
              ["**Committed, not yet invoiced**", "The value of every open job with an accepted quote — the same figure the Backlog card divides into weeks.", "Never — nothing open and accepted is a real $0.00 with “0 accepted, open jobs.”"],
            ],
          } },
        ],
      },
      {
        id: "payroll",
        heading: "Payroll this period",
        blocks: [
          { bullets: [
            "Only **approved** hours are paid, so only approved hours are counted. Hours still pending are counted separately and said out loud: “12h still awaiting approval, not counted yet.” See [[timesheets-and-approving-hours|Timesheets: review and approve hours]].",
            "The rate is the one payroll uses — the worker's hourly rate when set, otherwise the labour cost on their member record. Overhead salaries entered on Settings → Overhead are a business cost, not a person's pay, and are never read here.",
            "Hours with no pay rate on file are not folded in as free labour. The card shows the warning triangle and “{n} hours logged by {m} have no pay rate on file and aren't counted here.”",
          ] },
        ],
      },
      {
        id: "fixed-costs",
        heading: "Fixed costs",
        blocks: [
          { bullets: [
            "The figure is the burn rate's monthly total, reused unchanged from [[overhead-and-your-minimum-price|Overhead and your minimum price]] — the hint says “Per month, regardless of the period above — rent, overhead pay and debt.”",
            "**See the breakdown →** opens Settings → Overhead, where every line of it is entered.",
            "It reads — until at least one register — fixed costs, salaries, debt, assets — has a row. Four empty tables are not a $0.00 rent.",
          ] },
        ],
      },
      {
        id: "marketing-spend",
        heading: "Marketing spend",
        blocks: [
          { bullets: [
            "A row in another currency is converted at the pinned exchange rate and the figure is prefixed **≈**, with a line under it naming the original amount and the age of the rate — “Includes US$840.46 converted at the pinned exchange rate (15 days old).” A row whose rate was refused is left out, and the card says so with the amount.",
            "“May overlap with a cost also logged in Expense Tracking — not combined with Expenses above.” — a Facebook invoice entered on both screens would be counted on both, and nothing links the two tables to catch it.",
            "**See campaigns →** opens the Marketing spend page at its campaign list.",
          ] },
        ],
      },
      {
        id: "committed-not-yet-invoiced",
        heading: "Committed, not yet invoiced",
        blocks: [
          { p: "The dollar figure behind [[kpi-sales|the Backlog card]]: every job not yet completed whose quote is accepted, valued at the accepted total, with “3 accepted, open jobs.” under it. It is fetched once for the Sales section and read again here, so the two cards can never show different money." },
        ],
      },
      {
        id: "why-not-one-total",
        heading: "Why there is no total",
        blocks: [
          { note: "Payroll and Marketing spend are real spending that may also have been typed in by hand as an expense — a payroll transfer entered as a wage line here and as a manual expense, an ad invoice on both screens. Nothing in FieldQuo links those tables, so a combined “total money out” would look precise and sometimes be wrong. Each figure is shown on its own, labelled with what it does and does not include." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "This section is the union of its three sources' gates: the **Job costing** switch and See prices (fixed costs), Job costing plus **View everyone's payslips** on Payroll (payroll), and the people-management permission (marketing spend). With the presets, that is owners and administrators only — a Manager holds their own payslips and is refused this section while seeing the rest of the page. A Custom access with all three passes." },
        ],
      },
    ],
    faq: [
      { q: "Why does Fixed costs not change when I pick Last year?", a: "It is a monthly projection from Settings → Overhead, not a sum of what happened in the period. The hint on the card says so." },
      { q: "Is Payroll this period what I actually paid out?", a: "It is approved hours times pay rates for the period — what the crew earned. What was paid out is on Payroll, per pay run." },
    ],
  },

  "kpi-profit": {
    title: "KPIs: Profit",
    summary:
      "Gross and net margin on a typical completed job, labour cost as a share of revenue, and revenue per employee — how each is worked out from approved hours and logged expenses, and the four reasons a margin refuses to print.",
    updated: "2026-09-12",
    intro: [
      "**Profit — Rolled up across every completed job in the period, off approved hours and logged expenses only.** Four cards: **Gross margin (typical job)**, **Net margin (typical job)**, **Labour cost, % of revenue** and **Revenue per employee**.",
      "The margins are the most fragile numbers on the page, because they rest on what the crew logged and what was entered as an expense — a crew that logs time badly shows a better margin. So the section flags a knowably short figure and refuses to print one it cannot stand behind.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The population is every job **completed** in the period. A job's revenue is the total of the invoices raised for it — the latest version of each, drafts excluded — and its direct cost is the expenses logged against it plus approved hours × pay rate, the same arithmetic as [[job-costing|Job costing: quoted against actual]] on the job page." },
          { figure: "live:app-analytics-kpis", caption: "KPI dashboard → Profit — Gross margin, Net margin, Labour cost and Revenue per employee, with the reason under each card that has no value." },
        ],
      },
      {
        id: "the-four-cards",
        heading: "The four cards",
        blocks: [
          { table: {
            head: ["Card", "What it is", "Floor"],
            rows: [
              ["**Gross margin (typical job)**", "The **median** of (revenue − direct cost) ÷ revenue across completed jobs — a typical job, not a money-weighted average one enormous job could dominate.", "5 completed, priced jobs"],
              ["**Net margin (typical job)**", "The same median with the company's overhead per job added to each job's cost.", "5 jobs, and a weekly job capacity set"],
              ["**Labour cost, % of revenue**", "All labour cost ÷ all revenue across those jobs — one company-wide ratio, because a wage bill is one line the owner reads as one number.", "5 jobs"],
              ["**Revenue per employee**", "Invoices marked paid in the period ÷ the number of active team members today.", "At least one active team member"],
            ],
          } },
        ],
      },
      {
        id: "how-margin-is-worked-out",
        heading: "How the margin is worked out",
        blocks: [
          { bullets: [
            "**Direct cost** is materials and other job expenses logged against the job, plus labour: approved hours on the job × each worker's pay rate. No overhead — that is what makes it gross.",
            "**Overhead per job** comes from Settings → Overhead: the monthly burn divided by the jobs you said you can take on in a week. It is null, not zero, until **Jobs per week** is set, and net margin inherits that refusal exactly rather than quietly falling back to the gross figure.",
            "A completed job with no invoice, or an invoice total of zero, is excluded and counted — never priced at $0.",
            "Revenue per employee uses the same cash measure as Home's **Revenue this month**, so the two can never quietly disagree; the headcount is today's, because a worker count has no history to read.",
            "A job whose hours carry no pay rate, or whose hours are still awaiting approval, is marked incomplete; the card shows the warning triangle and “some data missing” rather than averaging over the gap.",
          ] },
        ],
      },
      {
        id: "when-it-refuses",
        heading: "When a margin refuses to print",
        blocks: [
          { bullets: [
            "“No jobs were completed in this period.” — the population is empty.",
            "“No completed job in this period had both a revenue figure and a cost to compare.” — jobs finished, but none was invoiced.",
            "“{n} of 5 so far — {m} more and this becomes reliable.” — under the floor. At five jobs, all landing the same side of a coin flip is already under one in ten; fewer is noise.",
            "“Set how many jobs a week you can take on in Settings → Overhead, and net margin can be worked out.” — net margin only, with a **Set your weekly job capacity →** link; the field is **Jobs per week** on Settings → Overhead.",
          ] },
          { warning: "The materials trap: when the jobs show at least $200 ticked off the materials buy-list but a tenth of that or less entered as expenses, both margins are suppressed with an amber note — “Job costing only reads expenses, so the margin below would be fiction — it's suppressed until materials purchases are logged as expenses too.” Labour cost % still prints, because it does not depend on materials." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Part of the page's single gate, and the reason the gate includes the **Job costing** switch — see [[the-kpi-dashboard|The KPI dashboard]]. Manager, owners and administrators see it; Crew, Estimator and Dispatcher are refused the page. Overhead per job is read from Settings → Overhead, which an owner, administrator or Manager can edit." },
        ],
      },
    ],
    faq: [
      { q: "Why is net margin blank when gross margin has a value?", a: "Net needs the overhead per job, and that needs Jobs per week on Settings → Overhead. Until it is set, the page refuses to guess it." },
      { q: "Why median and not average?", a: "One $60,000 job among ten $4,000 ones would set the average. The median is the job in the middle — what a typical job of yours makes." },
      { q: "My crew forgets to clock in. Does that make the margin wrong?", a: "It makes it optimistic — missing hours are missing cost. Approve hours from Timesheets; the card flags jobs with unrated or pending hours as incomplete." },
    ],
  },

  "kpi-execution": {
    title: "KPIs: Execution",
    summary:
      "On-time completion, labour utilisation and estimate accuracy — what each measures, what it deliberately does not, and the strip of recent jobs drawn from scheduled window to completion.",
    updated: "2026-09-12",
    intro: [
      "**Execution — How close the estimate was to what happened, and how the schedule held up.** Three cards — **On-time completion**, **Labour utilisation**, **Estimate accuracy (median variance)** — and under them a strip, **Recent jobs: scheduled window vs. completion**, one row per job.",
      "Each card states on its face what it does not measure. On-time completion is not cycle time; utilisation is not a productivity score; estimate accuracy is a median, not a total.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "All three read the jobs completed in the period, and two of them read the crew's approved hours. The utilisation card reads the guaranteed hours on each worker's record; without that, it has nothing to compare hours against and says so." },
          { figure: "live:app-analytics-kpis", caption: "KPI dashboard → Execution — On-time completion, Labour utilisation and Estimate accuracy, each explaining what it needs before it can print." },
        ],
      },
      {
        id: "on-time-completion",
        heading: "On-time completion",
        blocks: [
          { p: "**On-time completion** is the share of completed jobs that finished on or before the date of their **last scheduled visit**. The hint says the rest: “Finished on or before the last scheduled visit date. Not cycle time — jobs carry no start date to measure that against.”" },
          { bullets: [
            "The scheduled date is the visit's current date. A rescheduled visit is overwritten in place, so the date compared is the one actually agreed with the client — a job is not scored late for finishing exactly when it was told to.",
            "A completed job with no visit at all has no schedule to measure against; it is counted and excluded: “No completed job in this period had a visit scheduled to measure against.”",
            "It needs **10** measurable jobs before a percentage prints.",
          ] },
        ],
      },
      {
        id: "labour-utilisation",
        heading: "Labour utilisation",
        blocks: [
          { p: "**Labour utilisation** is the hours that reached a job, over the hours the company guaranteed: approved job hours in the period ÷ (each field worker's guaranteed hours per week × the weeks in the period). The hint: “Hours that reached a job, against the hours a guaranteed week promised. Office staff aren't counted — their time is overhead by design.”" },
          { bullets: [
            "Only workers with a guaranteed week on their record are in the denominator. With none: “No active field worker has a guaranteed week set, so there is nothing to compare hours against.”",
            "Office workers are excluded outright — asking what share of a bookkeeper's Tuesday belongs to a job is the wrong question.",
            "Hours from a worker with no pay rate are counted as hours but not as money; the card is marked incomplete and says how many workers it could not cost.",
            "The unabsorbed hours behind this rate — paid for, never on a job — are shown as money on [[overhead-and-your-minimum-price|Overhead and your minimum price]]. They are reported there and deliberately not yet added to your minimum price.",
          ] },
        ],
      },
      {
        id: "estimate-accuracy",
        heading: "Estimate accuracy (median variance)",
        blocks: [
          { p: "**Estimate accuracy (median variance)** is a small bar chart: for **Labour hours**, **Labour cost** and **Materials and other job costs**, the median of how far actual ran from the estimate, as a percentage — positive means over. A **Full report →** link opens the full [[estimate-accuracy|Estimate accuracy]] report." },
          { bullets: [
            "It draws from completed jobs that carry both a costed quote and actual costs. Under **5** such jobs: “Not enough completed, costed jobs this period to draw a rate from.”",
            "A dimension is drawn only when it is reportable on its own sample; a dimension with too few jobs is left off rather than drawn thin.",
            "Positive bars are coloured as overruns, so a quick glance says which side you are missing on.",
          ] },
        ],
      },
      {
        id: "the-schedule-strip",
        heading: "The schedule strip",
        blocks: [
          { p: "**Recent jobs: scheduled window vs. completion** appears when at least one completed job had a visit: up to twenty rows, most recent first, each drawn from the first scheduled visit to the last, with the completion date marked and the row coloured **Finished on time** or **Finished late**. It is the same data the rate above was computed from, shown one job at a time." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Part of the page's single gate — see [[the-kpi-dashboard|The KPI dashboard]]: Manager, owners and administrators. The guaranteed hours and the pay rate that utilisation reads are set per person on the team screens; the visit dates come from the job's visits." },
        ],
      },
    ],
    faq: [
      { q: "A job finished a day after its visit because the client asked for it. Is it late?", a: "If the visit was rescheduled to the new date, no — the current visit date is what is compared. If the visit date was left as it was, yes." },
      { q: "Why does utilisation say there is nothing to compare?", a: "No active field worker has guaranteed hours per week on their record. Set them on the person and the card fills in for periods after that." },
      { q: "Does utilisation change my minimum price?", a: "Not yet. The unabsorbed hours are reported on the overhead screen and deliberately not folded into the burn rate until the figure has been believed for a while." },
    ],
  },

  "kpi-quality": {
    title: "KPIs: Quality",
    summary:
      "The rework / callback rate and the change-order rate — what counts, what deliberately does not, and how to record a return visit or a scope change so the cards can see it.",
    updated: "2026-09-12",
    intro: [
      "**Quality — Work that had to be revisited, and scope that changed after the client said yes.** Two cards: **Rework / callback rate** and **Change-order rate**. Both used to sit under Not tracked; both left it when the job page gained a way to record the fact honestly instead of inferring it.",
      "Neither is inferred. A return visit counts only when someone said why they went back; a change order counts only when someone logged one. An ordinary edit to a quote or an invoice is never read as either.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Both rates are shares of the jobs **completed** in the period, and both need **10** completed jobs before a percentage prints. Under that the card counts — “4 of 10 so far — 6 more and this becomes reliable.” — and with none: “No jobs were completed in this period.”" },
          { p: "A callback can take two shapes on the job page: a return visit added to the same job, or a new job created as a callback for the original. Both ask **Why are you going back?**, and both feed the rate against the original job." },
        ],
      },
      {
        id: "rework-callback-rate",
        heading: "Rework / callback rate",
        blocks: [
          { p: "The share of completed jobs the company had to go back to for a **redo** or a **warranty** return. The hint on the card: “Completed jobs the company had to go back to for a redo or a warranty return. A client who thought something was missing and wasn't doesn't count against this — see the job page for how to record which is which.”" },
          { bullets: [
            "**Rework — we missed something** and **Warranty — covered work** count against the job.",
            "**Not our fault — client thought something was missing** is recorded but not counted. If everything is filed as rework the rate is wrong and you stop trusting it — so the third choice exists to keep the first two honest.",
            "A job that is itself a callback is not in the denominator: a warranty return is not new work being measured for whether it, in turn, needed a return.",
            "A job with several return visits is one job in the numerator, not several.",
          ] },
        ],
      },
      {
        id: "how-to-record-a-callback",
        heading: "How to record a callback",
        blocks: [
          { steps: [
            "For a short touch-up, open the completed job and add a return visit; when asked **Why are you going back?**, choose Rework, Warranty or Not our fault. The choice is required.",
            "For a bigger return, create a new job as a callback for the original. The banner says what that does: “This job is a callback for {title} — it will show on that job's page, and count toward the rework/callback rate on the KPI dashboard.”",
            "Complete the original job as usual. The rate counts the original in the period it was completed, whichever period the return happens in.",
          ] },
        ],
      },
      {
        id: "change-order-rate",
        heading: "Change-order rate",
        blocks: [
          { p: "The share of completed jobs with at least one **change order** logged — a scope change agreed after the client accepted the quote. The hint: “Completed jobs with at least one scope change logged after the quote was accepted — never inferred from an ordinary quote or invoice edit.”" },
          { bullets: [
            "Every completed job is in the denominator here, callbacks included — whether a job is a return has nothing to do with whether its own scope changed.",
            "A change order logged after the job was completed still counts; the log is read without a date cut-off, because a change agreed in the last week is often written up after the job closes.",
            "The money behind it — the approved change orders' price deltas — is the same figure the job page and the invoice use, summed once in one place. Only approved change orders are money; a rejected one still counts the job as having had a scope change.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Part of the page's single gate — see [[the-kpi-dashboard|The KPI dashboard]]: Manager, owners and administrators. Recording the reason for a return visit or creating a callback job needs **View, create, and edit** on Jobs — Dispatcher and above." },
        ],
      },
    ],
    faq: [
      { q: "We went back because the client changed their mind. Rework?", a: "No — that is a change of scope, not a miss. Log it as a change order on the job; it counts toward the change-order rate, not the callback rate." },
      { q: "Why is the rate blank when we had two callbacks last month?", a: "The card needs 10 completed jobs in the period before it prints a percentage. Widen the period to This quarter or Year to date." },
    ],
  },

  "kpi-cash": {
    title: "KPIs: Cash",
    summary:
      "Accounts receivable by age and money received over the last six months — what the outstanding figure counts, how an invoice is aged, and why an undated invoice is never overdue.",
    updated: "2026-09-12",
    intro: [
      "**Cash — What you're owed, and what's actually come in.** Two cards: **Accounts receivable, by age**, with the aging ladder under it, and **Money received, last 6 months**, a line of payments by month. Both are the dashboard's own figures — the same builder, the same rows — so this section and Home can never disagree about what is owed.",
      "Receivables have no period: what you are owed is owed today, however old the invoice, so this is the one section the period buttons do not touch.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The outstanding figure is built from every invoice the company ever raised — every version — with drafts left out. Each invoice family is valued at its **latest** version, less every payment recorded against any version of it, so an amended invoice is never counted at the figure it was first raised at and a deposit taken on version one still counts against version two." },
          { figure: "harness:kpis-cash", caption: "KPI dashboard → Cash — Accounts receivable by age with the ladder and the Full report link, and the six-month Money received line." },
        ],
      },
      {
        id: "accounts-receivable-by-age",
        heading: "Accounts receivable, by age",
        blocks: [
          { p: "The large figure is the total outstanding, then “{overdue} of that is overdue ({count})” or “Nothing outstanding right now.” Under it, the ladder — the same five rungs Home uses — with the past-due rungs in red, and a **Full report →** link to [[financial-statements|Financial statements]]." },
          { table: {
            head: ["Rung", "What lands on it"],
            rows: [
              ["**Not yet due**", "Outstanding, and the due date has not passed."],
              ["**1–30 days**", "Between one and thirty calendar days past the due date."],
              ["**31–60 days**", "Thirty-one to sixty days past due."],
              ["**61–90 days**", "Sixty-one to ninety days past due."],
              ["**90+ days**", "Ninety-one days or more past due."],
            ],
          } },
        ],
      },
      {
        id: "what-the-figure-counts",
        heading: "What the figure counts, and what it names",
        blocks: [
          { bullets: [
            "Age is counted from the **due date**, in whole calendar days. An invoice with no due date is outstanding but never overdue and never on the ladder — it is a different statement, and Home lists it under **No due date**.",
            "An invoice with no date at all — never sent, no creation date — cannot be placed in time. It is counted and named rather than silently dropped, and the card shows the warning triangle when that happens.",
            "A payment recorded with an unparseable date is likewise counted as not placed and flags the figure.",
            "An overpaid invoice is a credit you hold, not money owed to you; it is kept out of the figure. Home says so with the amount.",
            "Three states, never one $0.00: a real balance, “Nothing outstanding right now.” when everything is settled, and “No invoices have ever been raised.” when there is nothing to be owed.",
          ] },
        ],
      },
      {
        id: "money-received-last-6-months",
        heading: "Money received, last 6 months",
        blocks: [
          { p: "A line of payments by the month they were recorded, over the last six months, with the latest month's value labelled. It is the same series as Home's **Money received** chart on its 6m setting, built from the same payment rows." },
          { bullets: [
            "The current month is drawn as partial — it is not finished, and comparing it to a full month would manufacture a collapse on the 2nd of every month.",
            "A company that has never recorded a payment sees “No payments recorded yet.” rather than a flat line along the axis.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Part of the page's single gate — see [[the-kpi-dashboard|The KPI dashboard]]: Manager, owners and administrators. The same figures, with the client's name and a **Chase payment** button on each invoice, are on Home for anyone with Invoices at View only and See prices — see [[money-owed-and-receivables-aging|Money owed and receivables aging]]." },
        ],
      },
    ],
    faq: [
      { q: "Why does an old invoice with no due date not show as overdue?", a: "Overdue is measured from the due date, and that invoice has none. Add a due date to it and it will age from there." },
      { q: "Why is the receivables figure the same whichever period I pick?", a: "What you are owed has no period — a 2019 invoice nobody paid is owed today. The period buttons govern the other sections." },
      { q: "Why does the total not match the sum of the ladder?", a: "The ladder holds only invoices with a due date. Undated invoices are in the total and named separately; overpaid invoices are in neither." },
    ],
  },
};
