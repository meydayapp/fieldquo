// content/help/en/team-and-access-2.js
//
// Part 2 of the “team-and-access” category in English (see the composer,
// team-and-access.js): hours, time off, payroll, subcontractors, vehicles,
// purchasing and the activity log.
//
// Keyed by slug; the slugs are listed in lib/help/tree.js and
// scripts/check-help-centre.mjs refuses a module that is missing one or
// carries one the tree does not. Every sentence is read off the page module,
// the route it calls and the lib/** rule behind it — the words on the screen
// are the `en` strings in app/i18n/appMessages.js.
export const ARTICLES = {
  "working-hours-and-bookable-hours": {
    title: "Working hours and bookable hours",
    summary:
      "Two weeks per person on one screen: the shift the office schedules against, and the narrower window a client may book online — and why they are kept apart.",
    updated: "2026-09-12",
    intro: [
      "Every person on your team has two weekly patterns, and FieldQuo keeps them separate on purpose. **Working hours** are the shift: when someone is on the clock, used by scheduling and time off. **Bookable hours** are the window a client can pick from on your public booking page and website. An estimator can work 8–4 and only take consultations 2–4 because mornings are on site — one field cannot say that.",
      "Both live on **Settings → Availability**, and both are per person. Your company's opening hours are a different thing again: they live on Company Settings and are what the public reads as “when the shop is open”. See [[opening-hours|Opening hours]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is titled **Your hours** when you edit your own and **{name}'s hours** when a manager edits someone else's. Under the title, two week editors: **Working hours** (“Your shift. Used for scheduling and timesheets. Never shown to clients.”) and **Bookable hours** (“When clients can book you on your public calendar and website. Usually a narrower window than your shift.”). A sticky **Save hours** bar sits at the bottom, because on a phone the button would otherwise be under fourteen rows of inputs." },
          { p: "A person becomes bookable the moment they save at least one bookable day. With no bookable hours, the page says so: “With no bookable hours you won't appear as an option on your company's booking page.” That is the practical opt-in — setting your hours is how you say “yes, book me”." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Whose hours** — a picker listing every active team member, with “(you)” after your own name. It only appears for someone allowed to manage the team and only when the roster has more than one person. Picking a colleague shows an amber line: “You're editing someone else's hours. They'll see the change on their own schedule.”",
            "**Working hours** — one row per weekday, in your company's week order. Tick the day, then a start time, **to**, an end time. An unticked day reads **Not scheduled**; an end before the start reads **End must be after start**.",
            "**Bookable hours** — the same seven rows for the public window. Under it, an amber warning lists any day where the bookable window falls outside the shift: “Clients could book you when you're not working: … That's allowed — just check it's intentional.”",
            "**Save hours** — saves both weeks together and flashes **Saved**.",
          ] },
        ],
      },
      {
        id: "set-your-hours",
        heading: "How to set someone's hours",
        blocks: [
          { steps: [
            "Open **Settings → Availability**. From the team calendar, **Edit hours** on a person's card lands here with that person already picked.",
            "If you manage the team, choose the person under **Whose hours**; otherwise you are editing your own.",
            "Under **Working hours**, tick each day the person works and set the start and end of the shift.",
            "Under **Bookable hours**, tick the days and times a client may book. Leave every day unticked if this person should not appear on the booking page at all.",
            "Press **Save hours**. Read the amber warning first if one appeared — it is allowed, but it is usually a typo.",
          ] },
          { figure: "harness:settings-availability", caption: "Settings → Availability — the Whose hours picker, then Working hours and Bookable hours, each a checkbox per weekday with a start and an end." },
          { note: "Saving replaces the whole week, not just the rows you touched. If the page could not load someone's existing hours it refuses to show the editor and offers **Retry** instead — an empty week saved over a real one would silently drop that person off the booking page." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it changes"],
            rows: [
              ["A day ticked under Working hours", "Scheduling treats a shift outside these hours as a warning, never a block — overtime is normal. Time off counts working days from these days (Mon–Fri when none are set), and paid leave on a payslip is priced from them."],
              ["A day ticked under Bookable hours", "The booking page and your website offer that window for this person. Slots are computed from it, minus existing bookings and approved time off."],
              ["No bookable days at all", "The person is not listed on the booking page. Nothing else changes — they are still scheduled and paid normally."],
              ["Whose hours", "Switches every row on the screen to that person. It never changes the company's opening hours."],
            ],
          } },
          { warning: "A bookable window on a day with no working hours, or outside the shift, is accepted after the warning. A client can then book that person when the office has nobody down as working. Do it only when you mean it." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone. Availability is one of the settings rows every access level keeps, including Crew, because it is the only place a person sets their own hours. Anyone can read and change their own two weeks." },
          { p: "Editing somebody else's hours needs the team-management permission — an owner, an administrator, a Manager or a Dispatcher. Anyone else never sees the **Whose hours** picker, and the server refuses a change to another person's week regardless of what the browser sends. See [[access-levels-overview|Access levels: who sees what]]." },
        ],
      },
    ],
    faq: [
      { q: "Do working hours change what a client sees?", a: "No. The shift is internal and the hint on the screen says so — “Never shown to clients”. Only the bookable window reaches the booking page and the website." },
      { q: "Can someone have two shifts in one day, or an overnight shift?", a: "Not on this screen. Each day holds one start and one end, and the end must be later than the start. A split day is entered as the outer bounds." },
      { q: "Why is an estimator missing from our booking page?", a: "They have no bookable hours saved, or their account is inactive. Open their hours, tick at least one day under Bookable hours, and save." },
    ],
  },

  "time-off-policies": {
    title: "Time off policies",
    summary:
      "The kinds of time off your team can take and how each balance builds up — fixed days, per pay period, or vacation pay as a percentage — plus the manual year-end carry-over.",
    updated: "2026-09-12",
    intro: [
      "A policy is one kind of time off — Vacation, Sick, Personal, Unpaid, Other — with a rule for how much of it a person earns and whether a manager has to approve a request. Policies live on **Settings → Time Off Policies**; the requests and balances they produce live on the **Time Off** screen, where staff ask and managers approve. See [[time-off-requests|Time off requests]].",
      "FieldQuo tracks what you configure. It does not decide what you owe: the note at the bottom of the screen says statutory minimums vary by province, state and length of service, and the starter sets say plainly what year their figures come from.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is headed **Time off policies** — “What time off your team can take, and how it builds up. Requests and balances live on Time off.” With no policies yet, a starter card is offered first; once you have at least one, the card disappears and the **Year end** section appears instead." },
          { p: "Three accrual methods exist and they are genuinely different. **Fixed days per year** makes the whole allowance available now. **Accrues each pay period** spreads the days over the pay periods elapsed so far, using the frequency on [[payroll-settings|Payroll settings]] — lower in January, full by December. **Vacation pay (% of gross)** accrues money, not days, from the gross on approved pay runs; time off under it is not limited by a day balance." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Start from the Canada set** (or United States, United Kingdom) — one card per starter set with its policy count and “figures as of 2024”. The set matching the country on your company profile is offered first, with a line saying where that country was read from; the others sit under “Hiring in another country? These are here too.” Nothing is seeded until you press.",
            "**Policies** with **Add policy** — one card per active policy: its name, badges for **unpaid** and **auto-approved**, then the method, the entitlement (“15 days/year” or “4% of gross”) and the carryover (“carryover 5 days” or “unlimited”), with **Edit** and a remove button.",
            "**Retired** — policies that were removed after being used. They keep their past requests and are marked **not bookable**.",
            "**Year end** — “Carry unused days from 2025 into 2026, capped by each policy's carryover limit.” One button, pressed by you, never automatic.",
          ] },
        ],
      },
      {
        id: "add-a-policy",
        heading: "How to add a policy",
        blocks: [
          { steps: [
            "Open **Settings → Time Off Policies**.",
            "Either press a starter set to seed its policies in one go, or press **Add policy** for a blank form.",
            "Give it a name and pick the **Kind** — Vacation, Sick, Personal, Unpaid or Other.",
            "Choose **How it builds up**, then fill in **Days per year** (or **Percent of gross** for the money method).",
            "Set the **Carryover cap (days)** — “Blank means unlimited. 0 means use it or lose it.” Tick or untick **Paid** and **Needs a manager's approval**.",
            "Press **Add policy**. Balances for every active worker are recalculated straight away.",
          ] },
          { figure: "harness:settings-leave", caption: "Settings → Time Off Policies — the Policies list with a Vacation and an auto-approved Sick leave policy, and the Year end card." },
          { tip: "The Canada set is four policies: Vacation pay (4%), Vacation days (10 days, carryover 5), Paid sick leave (10 days, auto-approved, use it or lose it) and Unpaid leave. Seed it, then edit the numbers to match your province and your people — a policy already present by name is skipped, never overwritten." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "What each setting changes",
        blocks: [
          { table: {
            head: ["Setting", "What it changes"],
            rows: [
              ["Kind", "A label on the balance card and on requests. It does not change the arithmetic."],
              ["Fixed days per year", "The full **Days per year** is available from the first day. Someone with a hire date this year gets a pro-rated share; with no hire date on record they get the whole amount."],
              ["Accrues each pay period", "**Days per year** divided over the year's pay periods, granted as each period passes."],
              ["Vacation pay (% of gross)", "Accrues an amount equal to the percentage of gross on approved and paid pay runs this year. Requests under it are not checked against a day balance."],
              ["Carryover cap (days)", "How many unused days the **Year end** button may carry into the next year. Blank is unlimited; 0 is none."],
              ["Paid", "Unticked, the policy shows an **unpaid** badge and approved days under it are not added to a payslip. Ticked, approved leave in a pay period becomes an earning line on the payslip."],
              ["Needs a manager's approval", "Ticked, a request waits as pending until a manager approves it. Unticked, the request is approved the moment it is made and the balance is consumed immediately — the card shows **auto-approved**."],
              ["Remove", "Never used: deleted outright. Used at least once: retired instead, so past requests keep their history and nobody can book it again."],
            ],
          } },
        ],
      },
      {
        id: "year-end",
        heading: "Year end",
        blocks: [
          { p: "Balances are per calendar year. Unused days do not roll over on their own — you close the year when you decide it is closed." },
          { steps: [
            "Open **Settings → Time Off Policies** in the new year.",
            "In **Year end**, press **Carry 2025 balances into 2026** (the years on the button follow the calendar).",
            "Read the notice: “Carried unused days into 2026 for 12 balance(s).” or “Nothing was eligible to carry over.” Each balance is capped by its policy's carryover limit.",
          ] },
          { note: "The carry-over is recorded in the [[the-activity-log|Activity Log]] with who pressed it and how many balances moved." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. The row is hidden from every other level and the server answers “Only an owner or admin can manage leave policies.” to anyone else. A Manager approves requests on the Time Off screen but does not set the policies behind them." },
        ],
      },
    ],
    faq: [
      { q: "Does a sick-day policy have to be approved?", a: "Only if you tick **Needs a manager's approval**. The starter sets leave it unticked for sick leave, so a request is approved on the spot and the manager still sees it in the list." },
      { q: "Where do people see their balance?", a: "On the **Time Off** screen — a card per policy with accrued and taken, and a Team tab for managers. Balances are recalculated whenever a policy is added or edited." },
      { q: "Can I edit the numbers a starter set gave me?", a: "Yes. Once seeded they are your policies; press **Edit** on any card. FieldQuo never changes them afterwards." },
    ],
  },

  "payroll-runs": {
    title: "Payroll runs",
    summary:
      "How approved hours and saved rates become a pay run with payslips — Calculate, save as draft, approve, record as paid — and the one thing FieldQuo deliberately does not do: move the money.",
    updated: "2026-09-12",
    intro: [
      "The **Payroll** screen works out what each person should be paid for a period, from the hours a manager approved on Timesheets and the rates saved on their record, and produces a payslip per person. The sentence at the top of the screen is the whole contract: “You pay through your own bank or payroll provider — FieldQuo doesn't move the money.”",
      "The feature matrix marks payroll as partial, and the limit is exactly that: FieldQuo works out gross pay, produces the payslips and exports the run. It does not pay employees or file your payroll taxes — deductions are the ones you or your accountant supply on [[payroll-settings|Payroll settings]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "One screen, two audiences. Someone allowed to run payroll sees **My earnings** for themselves, then **New pay run** and the **Pay runs** list. Everyone else sees only **My earnings** and the line “Only your own payslips are shared with your account.” — see [[payslips|Payslips]]." },
          { p: "A run moves through four states: **Draft** (a working document you can still change or cancel), **Approved** (payslips become visible to the people on it), **paid (recorded)** (a human confirmed the money left through the bank or payroll provider), and **Cancelled**. The wording is “record as paid”, not “pay”, because a button called Pay that paid nobody would be the worst control on the product." },
          { note: "Only in FieldQuo: neither Jobber nor Housecall Pro lists payroll on its pricing page at any tier. ServiceTitan lists “payroll management” from its Essentials tier up, and Projul does not list it. FieldQuo includes it in every plan — as a calculation and a set of payslips, never as a transfer." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**My earnings** — **This period** with its dates and payday, your approved hours × your rate (or “No hourly rate is set on your record, so this can't be worked out yet.”), a progress bar through the period, then **Gross**, **Deductions** and **Net** for the year, then your payslips.",
            "**New pay run** — “Only approved time is included. Approve timesheets first, or those hours won't be paid.” Four fields: **Period start**, **Period end**, **Frequency** (Every week, Every 2 weeks, Twice a month, Once a month) and **Payslip labels** (Canada, United States, United Kingdom), then **Calculate**.",
            "**Pay runs** — one row per run: the period, how many people and the label region (“5 people · CA”), the net total and a status badge. Opening a row shows every line and the **Approve run** / **Record as paid** / **Export CSV** buttons.",
          ] },
        ],
      },
      {
        id: "run-payroll",
        heading: "How to run payroll",
        blocks: [
          { steps: [
            "Approve the period's hours on **Timesheets** first — see [[timesheets-and-approving-hours|Timesheets and approving hours]]. Pending hours are left out and named.",
            "Open **Payroll**. The period is pre-filled with the last period that closed under your pay cycle; the frequency follows it.",
            "Pick the **Payslip labels** region — it only chooses the deduction names on the payslip (CPP/EI, Social Security/Medicare, PAYE/NI). It calculates nothing.",
            "Press **Calculate**. A preview lists each person with hours, gross, deductions and net, the totals, and any notes — unapproved hours left out, self-approved hours included, paid leave included, or “No deductions are set up, so these are gross figures.”",
            "Press **Save as draft run**. The run appears under **Pay runs** as Draft.",
            "Open the run and press **Approve run**. Payslips become visible to the people on it: “Approved and visible to your team as payslips. Pay them through your bank or payroll provider, then record it here.”",
            "Pay everyone outside FieldQuo, then press **Record as paid**. The run and every payslip are stamped with the date.",
          ] },
          { figure: "harness:payroll", caption: "Payroll — the New pay run form pre-filled with the last closed period, and the Pay runs list with an Approved run and two recorded as paid." },
          { warning: "Approval is the last free moment. A draft may overlap a period you already paid — the preview says so — but **Approve run** refuses while an approved or paid run covers the same days. Cancel the wrong one first." },
        ],
      },
      {
        id: "what-the-run-includes",
        heading: "What the run includes",
        blocks: [
          { bullets: [
            "**Approved time only.** Pending time is somebody's unverified claim; paying it would make approval decorative. The preview names whose hours were left out.",
            "**Overtime at 1.5×** above 40 hours in a week, split week by week inside the period. A calendar period (twice a month, once a month) contains partial weeks, and the pay-cycle card says so.",
            "**The rate on the person's record** — their hourly rate, or the labour cost saved on their team record when no hourly rate is set. With neither, the line shows no pay and a warning rather than $0.00.",
            "**A salary** divided over the period when one is saved for the person instead of an hourly rate.",
            "**Approved paid leave** as a named earning line (“Vacation — 5 days”), priced from that person's own working day, so a week off is not a week of zero hours.",
            "**Deductions and allowances** from Payroll settings, applied to everyone. Without any, the run is gross-only and says so.",
          ] },
        ],
      },
      {
        id: "statuses",
        heading: "Statuses",
        blocks: [
          { table: {
            head: ["Status", "What it means"],
            rows: [
              ["Draft", "Saved and invisible to the people on it. To change it, cancel it and calculate the period again. Can be cancelled."],
              ["Approved", "Figures are final. Payslips are visible and downloadable by the people on it. Can still be cancelled — a paid run cannot."],
              ["paid (recorded)", "You confirmed the money left through your bank or payroll provider. The date is stamped on the run and on every payslip. Final."],
              ["Cancelled", "Kept in the list for the record. Its period can be run again."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Payroll** row is in everyone's sidebar, because everyone has payslips. Running payroll — Calculate, Save as draft run, Approve run, Record as paid, Export CSV — needs the **Payroll & Payslips** area set to **View everyone's and run payroll**, which owners and administrators hold automatically. **View everyone's payslips** opens every run read-only." },
          { p: "Every preset — Crew, Estimator, Dispatcher, Manager — starts at **View their own payslips**. The Manager description says “Not payroll” and means it; an owner who wants a manager running payroll grants it deliberately in the [[the-custom-access-editor|Custom access editor]]." },
        ],
      },
    ],
    faq: [
      { q: "Does FieldQuo transfer the wages?", a: "No. It works out the figures and produces payslips and a CSV. You pay through your bank or payroll provider and then press Record as paid so the payslips can say when." },
      { q: "Why is somebody showing at $0 or with no pay?", a: "No hourly rate or labour cost is saved on their record, or their hours for the period are still pending. The preview says which." },
      { q: "Can I correct a run after it is approved?", a: "Cancel it and run the period again, as long as it has not been recorded as paid. A paid run is final; a correction is a second run over the same period, saved as a draft — approval refuses only while an approved or paid run overlaps." },
      { q: "What does Export CSV contain?", a: "One row per person with hours, gross, one column per deduction or earning named in the run, and net — the handoff for the bookkeeper or payroll provider who actually pays it. A cell is left empty, not 0.00, when that person had no such line." },
    ],
  },

  "payroll-settings": {
    title: "Payroll settings",
    summary:
      "When you pay — frequency, the day the period closes, payday — and the deduction and earning components a pay run applies: fixed amounts, percentages of gross, and progressive tax bands you or your accountant supply.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Payroll** is what [[payroll-runs|Payroll runs]] calculate from: the pay cycle, and the components that turn a gross figure into net. Until something is set up here, pay runs are gross-only and say so. The footer states the division of labour: “FieldQuo does the arithmetic with the rates you save here. It does not file or remit anything, and it doesn't update rates when they change — review them each tax year with your accountant.”",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is headed **Payroll settings** — “The deductions and allowances applied when you run payroll. Without these, pay runs show gross pay only.” A **When you pay** card comes first, then **Start from your region** (offered while you have no components), then two lists: **Deductions** and **Allowances & earnings**, with **Add a component** at the bottom." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**When you pay** — **How often**, **The period closes** (a weekday), **Payday** (a weekday), the number of days that leaves to approve hours, then **This period** and **Last one closed** with their dates and paydays. Until it is set, it reads “not set — using the default below” with a **Set it up** button.",
            "**Start from your region** — Canada, United States or United Kingdom, each with “3 components · 2024 figures”. In bold: “These are published figures for the year shown — confirm every one with your accountant.”",
            "**Deductions** — one row per component with its name, a **statutory** badge where it came from a template, an **off** badge when turned off, and how it is worked out: “5.95% of gross”, “5 progressive bands”, or a fixed amount, plus **Turn off** / **Turn on** and a remove button.",
            "**Allowances & earnings** — the same rows for money added rather than taken off, such as a tool allowance.",
          ] },
        ],
      },
      {
        id: "when-you-pay",
        heading: "When you pay",
        blocks: [
          { p: "The period end and the payday are two separate controls because overtime is worked out against a weekly threshold: a period that contains whole weeks pays overtime once; one that splits a week understates it twice. The card says the gap between the two days out loud — “4 days to approve hours” — because “Sunday to Thursday” means nothing until somebody counts it." },
          { table: {
            head: ["Setting", "What it changes"],
            rows: [
              ["How often", "Every week, Every 2 weeks, Twice a month or Once a month. Sets which period New pay run is pre-filled with, how a salary is divided, and how per-period time off accrues."],
              ["The period closes", "The weekday a period ends on. Weekly and every-2-weeks periods then contain whole weeks; the calendar frequencies show a note that weekly overtime is worked out on the partial weeks inside each period."],
              ["Payday", "The weekday people are paid. Only the “paid …” date under This period on the Payroll screen and the review gap read it — FieldQuo does not pay anyone on that day."],
            ],
          } },
          { note: "Everyone can read the pay cycle — a worker needs to know when payday is — but only an owner or administrator can change it: “Only an owner or admin can change when the company pays.” A gap of a day or less between period close and payday shows a warning." },
        ],
      },
      {
        id: "add-a-component",
        heading: "How to add a component",
        blocks: [
          { steps: [
            "Open **Settings → Payroll**. If you have no components yet, press your region under **Start from your region** to seed the statutory set, then check each figure with your accountant.",
            "Press **Add a component** and name it — “Union dues, Tool allowance”.",
            "Choose **Deduction** or **Allowance / earning**.",
            "Choose how it is worked out: **Fixed amount** (same amount every pay period), **Percent of gross** (“e.g. CPP at 5.95%”) or **Progressive bands** (income tax brackets: “Annual thresholds, lowest first. Leave the last ‘up to’ blank for ‘and above’.”).",
            "Press **Add**. From the next Calculate on, it is applied to everyone on the run.",
          ] },
          { figure: "harness:settings-payroll", caption: "Settings → Payroll — the When you pay card, then the Deductions list with statutory rows and the Allowances & earnings list." },
          { tip: "The Canada set is Federal income tax (five 2024 bands), CPP at 5.95% and EI at 1.66% — the employee share only. Provincial tax is not included: add your province's brackets as a separate Progressive bands component. The United States set has no state tax; the United Kingdom set has no NI category letters." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it changes"],
            rows: [
              ["Fixed amount", "The **Amount per pay period** is added or deducted on every run for every person, whatever their hours."],
              ["Percent of gross", "The percentage of that person's gross on the run."],
              ["Progressive bands", "The period's gross is annualised, taxed through the bands, and divided back down to the period — the way every published tax table is written. **Add band** and **Remove band** edit the list; the last band's “up to” is left blank for “and above”."],
              ["Turn off / Turn on", "A component turned off shows the **off** badge and is skipped on the next Calculate. Nothing is deleted; turn it back on any time."],
              ["Remove", "“Past payslips keep what was already deducted.” The component is gone from future runs; every past run keeps its own copy of the lines."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. The **Payroll** settings row is hidden from every other level, and every write answers “Only an owner or admin can change payroll settings.” A Manager who has been granted run payroll still cannot edit the rates here — the two are different questions on purpose." },
        ],
      },
    ],
    faq: [
      { q: "Can a component apply to only one person?", a: "No. Every component applies to everyone on the run. A row from an earlier version marked “assigned individually” reaches no payslip and is flagged in amber; recreate it as a normal component or remove it." },
      { q: "Do the statutory rates update themselves each year?", a: "No. They are published figures for the year shown, seeded once, and then they are your numbers. Review them each tax year with your accountant and edit the bands." },
      { q: "Where does someone's hourly rate live?", a: "On their team record and worker record, not here. This screen holds what is applied to everyone; the rate is per person — see [[manage-team|Manage Team]]." },
    ],
  },

  payslips: {
    title: "Payslips",
    summary:
      "What a team member sees under My earnings — this period so far, the year's gross, deductions and net, and a PDF payslip per approved pay run — and who else can open it.",
    updated: "2026-09-12",
    intro: [
      "A payslip is one person's line on an approved pay run, printed as a branded PDF. The person sees their own under **My earnings** at the top of the **Payroll** screen; someone who runs payroll sees everyone's inside the run. Nothing appears for a draft: a draft is a working document the office may still change, and a payslip that changes between Tuesday and Friday is not a payslip.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**My earnings** answers the question a worker opens this screen to ask — what have I earned this period, and what did I get last period — without waiting for the office to run payroll. **This period** shows approved hours × the hourly rate as a gross figure, the period's dates and payday, and a progress bar. Under it, three tiles for the year: **Gross**, **Deductions**, **Net**." },
          { p: "The list below is one row per approved or paid run: the period, the hours (“80h regular · 6h overtime”), “paid Sep 17, 2026” or “awaiting payment”, the net, the gross minus deductions, and a **PDF** button. Until a run is approved the list reads “No payslips yet. They appear once a pay run is approved.”" },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**This period** — “Aug 31, 2026 → Sep 13, 2026 · paid Sep 17, 2026”, then “80 approved hours × $32.00/hr” or, with no rate on record, “No hourly rate is set on your record, so this can't be worked out yet. Your approved hours are still counted.” Hours still pending are counted separately: “6 more hours logged and waiting on your manager to approve — not counted above.”",
            "**Gross · 2026**, **Deductions · 2026**, **Net · 2026** — the year to date across approved and paid runs.",
            "**The payslip rows** — period, hours, payment state and net, newest first.",
            "**PDF** — downloads that payslip. The link is resolved from your own worker record, never from anything in the address bar.",
          ] },
        ],
      },
      {
        id: "download-a-payslip",
        heading: "How to download a payslip",
        blocks: [
          { steps: [
            "Open **Payroll** from the sidebar (under Money).",
            "Under **My earnings**, find the period and press **PDF**.",
            "If you run payroll and need somebody else's, open the run under **Pay runs** and press **Payslip PDF** on their line.",
          ] },
          { figure: "live:app-payroll", caption: "Payroll — My earnings with This period, the three year-to-date tiles and the payslip list, before any run has been approved." },
        ],
      },
      {
        id: "what-a-payslip-says",
        heading: "What a payslip says",
        blocks: [
          { bullets: [
            "**Your company's name, logo and brand colour** in the header, like every other document the company sends, with the person's name, whether they are an employee or a contractor, and the hourly rate where there is one.",
            "**Hours** — Regular and Overtime — when the line has any; a salaried line prints none.",
            "**Earnings and deductions** in the order they were calculated, then **Gross pay** and **Net pay**. Deduction names follow the region chosen for the run (CPP/EI, Social Security/Medicare, PAYE/NI).",
            "**The pay period**, and one of “Recorded as paid on …”, “Approved, not yet recorded as paid.” or “Draft — not yet approved.”",
            "**A plain statement** that this is a record of what was calculated and paid — not a government form, and no tax has been remitted or filed through this system.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Every access level whose **Payroll & Payslips** area is above **No access** sees their own — the presets all start at **View their own payslips**. **View everyone's payslips** or **View everyone's and run payroll** opens every run and every PDF; owners and administrators hold that automatically. Someone set to **No access** sees no My earnings section at all." },
          { note: "The server resolves “own” from the signed-in person's worker record. A payslip link copied from somebody else's browser opens nothing." },
        ],
      },
    ],
    faq: [
      { q: "Why is my payslip missing for the last two weeks?", a: "The run is still a draft, or it has not been created. Payslips appear once the run is approved; This period shows the gross so far in the meantime." },
      { q: "Is this a T4, W-2 or P60?", a: "No. The PDF says so in its footer. It is a record of what was calculated and paid; year-end forms come from your accountant or payroll provider." },
      { q: "Why does This period show gross and my payslip shows less?", a: "This period is before deductions — “this is what the work is worth — not what lands in your account.” Deductions are applied when the office runs the period." },
    ],
  },

  "subcontractors-and-insurance": {
    title: "Subcontractors and their insurance",
    summary:
      "The companies you hire per job — their trade and contact, whether their certificate of insurance and WSIB/WCB clearance are in date, what you agreed with them on each job, and what you paid them this year.",
    updated: "2026-09-12",
    intro: [
      "**Subcontractors** is the roster of other companies — the electrician, the countertop fabricator, the roofer — with the one fact that has a same-day consequence at the top: whether their paperwork is still valid. A lapsed certificate of insurance is a sub who must not step on site tomorrow, so the **Insurance or clearance expiring** panel comes before everything else.",
      "This is not the roster of people you employ; that is [[manage-team|Manage Team]]. And it is not a way to pay a sub: the feature FieldQuo does ship — paying a contractor from the app — pays a person on your own roster, for hours they clocked, at the rate you set. It cannot pay a fixed bid to another company. Payments to a subcontractor company are recorded here after the money has left.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is headed **Subcontractors** — “The companies you hire per job — the electrician, the roofer. Their insurance and clearance dates, what you've agreed with them on each job, and what you've paid them this year.” Each sub has a record with documents, the jobs they are on and the payments recorded against them; the year total is what becomes the [[the-t5018-year-end-list|T5018 year-end list]]." },
          { note: "What a sub is owed and was paid is job cost. Job costing takes the **agreed amount** as the cost of that sub on the job — a $5,000 sub who has been paid $2,000 has cost the job $5,000 — and the payments are how it gets settled. See [[job-costing|Job costing]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Insurance or clearance expiring** — every sub whose insurance or clearance is **Due soon** (within 30 days) or **Expired**, worst first, each naming which of the two.",
            "**Paid in** with a year picker, and **Year-end list (CSV)** — shown only to someone who may see money.",
            "**One card per sub** — the company name, **Inactive** where it applies, then trade, contact and phone, a badge for the worse of the two expiries, and, for someone who may see money, “$6,840.00 paid in 2026 (3 payments)” with “No tax form” where the sub is excluded from the year-end form.",
            "**Add** — opens the new-subcontractor form.",
          ] },
        ],
      },
      {
        id: "add-a-subcontractor",
        heading: "How to add a subcontractor",
        blocks: [
          { steps: [
            "Open **Subcontractors** (under People) and press **Add**.",
            "Fill in the **Company name** and **Trade** (“electrical, roofing, drywall…”), then the **Contact person**, **Email** and **Phone**.",
            "Enter **Insurance (COI) expires** and **WSIB / WCB clearance expires** if you have the certificates. “Leave a date blank if you don't have the certificate — blank means not recorded, not expired.”",
            "Leave **Goes on the year-end contractor form (T5018 / 1099-NEC)** ticked for a construction sub; untick it for an incorporated materials supplier your accountant says does not get one.",
            "Press **Add subcontractor**.",
            "On the sub's page, upload the certificates under **Documents** — a **Certificate of insurance** or **WSIB / WCB clearance** with its expiry date sets the sub's date at the same time.",
          ] },
          { figure: "create:app-subcontractors-create", caption: "Subcontractors → Add — the new-subcontractor form: company, trade, contact, the two expiry dates and the year-end form checkbox." },
          { tip: "A sub you no longer use gets **Mark inactive** rather than a delete: they drop out of the “add a sub to a job” picker, keep their jobs and payments, and still appear on the year-end list for the years you paid them." },
        ],
      },
      {
        id: "insurance-and-clearance",
        heading: "Insurance and clearance",
        blocks: [
          { p: "Two dated expiries, in the order they matter. **Insurance** first: a lapsed certificate makes you liable for the sub's damage the moment they are on site. **Clearance** second (WSIB in Ontario, CNESST in Quebec, WCB elsewhere): a lapsed clearance makes you liable for their premiums — a bill rather than a lawsuit. The badge on a card is the worse of the two." },
          { table: {
            head: ["Badge", "What it means"],
            rows: [
              ["In date", "The date is recorded and more than 30 days away."],
              ["Due soon", "The date falls within the next 30 days. The sub is listed in the expiring panel."],
              ["Expired", "The date has passed. The sub is listed in the expiring panel, first."],
              ["Not recorded", "No date was entered. This is a gap in the paperwork, not an uninsured sub — it never counts as expired and never appears in the panel."],
            ],
          } },
          { warning: "FieldQuo does not stop you putting a sub with expired paperwork on a job. The job page shows “Insurance or clearance expired” beside them; deciding whether they go on site is yours." },
        ],
      },
      {
        id: "on-a-job",
        heading: "Putting a sub on a job and paying them",
        blocks: [
          { p: "Subs are attached from the job, not from this screen. The job page has a **Subs on this job** section: “Companies hired for a fixed price. The agreed amount is what this job costs, whatever you quoted the client; payments are how it gets settled.” Each line moves through **Quoted**, **Agreed**, **Done** and **Paid**." },
          { steps: [
            "On the job, press **Add a sub**, pick the subcontractor, and optionally the visit and what they are doing.",
            "Enter the **Agreed amount**, or leave it blank until it is agreed — “No amount yet” is quoted, not cost.",
            "When you have paid them, press **Record a payment**: amount, **Paid by** (Cash, E-Transfer, Cheque), **Paid on** and a note. “This writes the payment and an expense against the job in one step. It records money that already left — it doesn't send any.”",
            "The line reads “$2,000.00 paid, $3,000.00 to go”, then **Paid in full**; a further payment shows as overpaid rather than being refused.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Opening the roster, adding a sub, editing one and filing documents need the team-management permission — owners, administrators, Managers and Dispatchers. A sub's name and whether their insurance is in date are operations: the dispatcher putting the electrician on Thursday's visit needs to know their clearance lapsed. Crew and Estimators do not see the row." },
          { p: "The money on the screen — agreed amounts, payments, the year totals, **Paid in** and the CSV — needs the **Job costing** switch as well. A Dispatcher opens the roster, sees the lapsed insurance, and sees no figures; a Manager sees both. See [[the-custom-access-editor|The Custom access editor]]." },
        ],
      },
    ],
    faq: [
      { q: "Can I pay a subcontractor through FieldQuo?", a: "No. Recording a payment writes the payment and an expense against the job; the money moved through your bank, cheque or e-transfer first. The in-app payout feature pays a person on your own roster for clocked hours, not a company for a bid." },
      { q: "What happens if I leave an expiry date blank?", a: "The sub shows **Not recorded** for that item and is never listed as expired. Blank means you have not entered the certificate, not that they are uninsured." },
      { q: "Can I import the sub's own quote?", a: "Yes, onto your quote — see [[import-a-subcontractor-quote|Import a subcontractor quote]]. When the quote becomes a job, that imported price can be adopted as the agreed amount on the job's Subs section." },
    ],
  },

  "the-t5018-year-end-list": {
    title: "The T5018 year-end list",
    summary:
      "One CSV per calendar year listing every subcontractor, whether they go on the contractor form, what you paid them and how many payments — the figure the accountant has been rebuilding from cheque stubs.",
    updated: "2026-09-12",
    intro: [
      "In Canada, a contractor who paid a construction subcontractor more than $500 in a year files a T5018 for them; in the United States it is a 1099-NEC over $600. Both are a list of company and amount. FieldQuo builds that list from the payments you recorded against each sub on each job, so the number on the sub's page, the number in the file and the number in [[job-costing|Job costing]] are the same rows added up once.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The list is the **Year-end list (CSV)** button on the **Subcontractors** screen, next to the **Paid in** year picker. The same figure shows on each sub's own page as “Paid in 2026 — the year-end contractor form figure” with the payment count, and on the roster card as “$6,840.00 paid in 2026 (3 payments)”." },
          { p: "The threshold is deliberately not applied. Every sub is listed, including the ones paid $0 and the ones marked **No tax form**, because the accountant decides who files and FieldQuo does not know which jurisdiction's rule applies. A zero row says “we checked, nothing”; a missing row says nothing." },
        ],
      },
      {
        id: "download-the-list",
        heading: "How to download the list",
        blocks: [
          { steps: [
            "Open **Subcontractors** (under People).",
            "Choose the year under **Paid in** — the picker changes the totals on every card.",
            "Press **Year-end list (CSV)**. The file is named subcontractors-2026.csv.",
            "Hand it to your accountant. The download is recorded in the [[the-activity-log|Activity Log]].",
          ] },
          { figure: "harness:subcontractors", caption: "Subcontractors — the Paid in year picker and the Year-end list (CSV) button above the roster, each card with its paid-in-year total." },
          { note: "The file states its currency from Company Settings and ends with “Recorded in FieldQuo; no form has been filed through this system.” FieldQuo produces the list; it files nothing." },
        ],
      },
      {
        id: "what-is-in-the-file",
        heading: "What is in the file",
        blocks: [
          { table: {
            head: ["Column", "What it holds"],
            rows: [
              ["Subcontractor", "The company name, alphabetically."],
              ["Trade", "The trade on their record, or empty."],
              ["Tax form", "yes or no — the **Goes on the year-end contractor form (T5018 / 1099-NEC)** checkbox on their record."],
              ["Paid in year", "The sum of payments dated inside that calendar year, to the cent."],
              ["Payments", "How many payments made that total."],
              ["Active", "yes or no — an inactive sub you paid earlier in the year is still listed."],
            ],
          } },
        ],
      },
      {
        id: "what-counts",
        heading: "What counts as paid",
        blocks: [
          { bullets: [
            "A payment counts in the year of its **Paid on** date, not the year of the job or the agreed amount.",
            "Only payments recorded with **Record a payment** on a job count. An agreed amount that has not been paid is not in the total.",
            "A **TOTAL** row at the bottom sums every sub and every payment for the year.",
            "**No tax form** on a sub does not remove them from the file — it sets their Tax form column to no, so your accountant sees the decision rather than an absence.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The button, the **Paid in** picker and every money figure need both the team-management permission and the **Job costing** switch — owners, administrators, and a Manager with job costing on. A Dispatcher sees the roster and the insurance badges but no totals and no button. A read-only support session is refused the file outright." },
        ],
      },
    ],
    faq: [
      { q: "Does FieldQuo file the T5018 or the 1099-NEC?", a: "No. It produces the list of company and amount; the form is prepared and filed by you or your accountant." },
      { q: "Why is a sub I paid last December in this year's file?", a: "Because the payment's Paid on date falls in this year. Edit the date on the payment if it was recorded wrong; the total follows the date." },
      { q: "Can I get the list for an earlier year?", a: "Yes — pick the year under Paid in and press the button. Any year with recorded payments works." },
    ],
  },

  "vehicles-and-fleet": {
    title: "Vehicles and fleet",
    summary:
      "The vans: what is due, what is expiring, who has each one — insurance, registration and service by date or by mileage, a maintenance log, documents, and the running cost for those who may see it.",
    updated: "2026-09-12",
    intro: [
      "**Vehicles** answers the three questions a company with three vans actually asks: what is due, what is expiring, and who has the van. It is deliberately not a telematics product — no live GPS, no route history. A browser cannot track a van in the background, so a “where is the van” map would be right only while somebody had the tab open.",
      "Every vehicle here is also an asset in the register on **Settings → Overhead** — that is the row carrying what it cost and how it depreciates, which is what raises your minimum price. This screen adds the fleet facts to that row without touching the accounting. See [[overhead-and-your-minimum-price|Overhead and your minimum price]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is headed **Vehicles** — “What's due, what's expiring, and who has the van. What each one cost lives in the asset register.” A **Due or expiring** panel comes first, because an insurance certificate that lapsed is a van that should not be on the road, then one card per vehicle." },
          { note: "Only in FieldQuo: none of Jobber, Housecall Pro, ServiceTitan or Projul lists vehicle expiries, a maintenance log or a cost per kilometre on its pricing page at any tier. The proof is the screen itself — app/app/fleet — and it is in every plan." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Due or expiring** — every vehicle with something **Due soon** or lapsed, naming which: Insurance, Registration, Service (by date), Service (by mileage).",
            "**One card per van** — “Ford Transit 250 — 2022”, its plate, a badge (**Something's lapsed**, **Something's due**, **Nothing due**, **Nothing recorded**) and “with Léo Bouchard”.",
            "**The expanded card** — the four expiries, **Odometer (km)**, **VIN**, **Cost** and **Book value now** for those who may see them, **Edit**, then **Maintenance**, **Documents**, **Expenses** and **Running costs**.",
            "**Add** — attaches fleet details to a vehicle already in the asset register. With nothing in the register, the screen says so and links **Add a vehicle to the register**.",
          ] },
        ],
      },
      {
        id: "add-a-vehicle",
        heading: "How to add a vehicle",
        blocks: [
          { steps: [
            "Put the van in the asset register first — **Settings → Overhead**, under Assets & depreciation — with what it cost. An owner or administrator does this.",
            "Open **Vehicles** (under Money) and press **Add**.",
            "Under **Which vehicle**, pick the asset.",
            "Fill in **Plate**, **Make and model**, **VIN**, **Year**, and the **Odometer (km)** — “Leave blank if you don't know”.",
            "Pick **Who has it** (or “Nobody in particular”), then the dates: **Insurance expires**, **Registration expires**, **Next service due (date)** and **Next service due (km)**.",
            "Press **Save**. The card appears with its badge worked out from what you entered.",
          ] },
          { figure: "harness:fleet", caption: "Vehicles — the Due or expiring panel naming a van's insurance and service, then a card per van with its badge and who has it." },
          { note: "A service due at a mileage only counts down once the odometer is filled in; with no reading it shows **Not enough recorded** rather than a guess. A blank date is **No date recorded** — never treated as lapsed." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "What each field changes",
        blocks: [
          { table: {
            head: ["Field", "What it changes"],
            rows: [
              ["Odometer (km)", "The reading Service (by mileage) counts down from, and one of the two readings a cost per km needs. Logging maintenance with an odometer moves it: “The van's odometer was updated to match this entry.”"],
              ["Who has it", "The name on the card. A deactivated team member shows as “no longer active” until you change it."],
              ["Insurance expires / Registration expires", "Dated expiries. Within 30 days: **Due soon** and listed in the panel; past: lapsed and listed first. Filing an Insurance policy or Registration document with an expiry date moves the matching date here."],
              ["Next service due (date)", "The same 30-day window, for the garage."],
              ["Next service due (km)", "**Due soon** within 500 km of the odometer reading; lapsed once passed."],
              ["Cost / Book value now", "Read from the asset register — the purchase price and what depreciation has left. Not editable here."],
              ["Remove fleet record", "Removes the plate, dates and log. “The asset itself, and its depreciation, stay exactly as they are.”"],
            ],
          } },
        ],
      },
      {
        id: "maintenance-and-documents",
        heading: "Maintenance, documents and running costs",
        blocks: [
          { bullets: [
            "**Maintenance** — **Log work**: the kind (Service, Repair, Tyres, Inspection, Other), **What was done**, the odometer then, and what it cost — “leave blank if unknown”. Deleting an entry keeps the odometer reading it set: “the van really did do those kilometres.”",
            "**Documents** — **Add a document**: Registration, Insurance policy, Bill of sale, Photo or Other, with an optional expiry. A bill of sale is money and is hidden from anyone who may not see cost: “2 more hidden by your access level”.",
            "**Expenses** — fuel, tolls and repairs recorded on **Settings → Expense Tracking** with this vehicle picked, and the month's total.",
            "**Running costs** — expenses and maintenance over the last 12 months, depreciation, **Total cost of ownership, last 12 months** and **Cost per km**, which needs two odometer readings at least 30 days apart and says so when it cannot be worked out.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The screen needs the team-management permission — owners, administrators, Managers and Dispatchers. A plate, an odometer and an insurance renewal are operations: the dispatcher deciding which van goes where needs to know one is off the road on Thursday. Crew and Estimators do not see the row." },
          { p: "What the van cost — **Cost**, **Book value now**, depreciation, the cost per km and the bill of sale — is the company's cost basis and needs the **Job costing** switch on top, the same gate as the asset register. A Dispatcher sees the expiries and not the truck loan." },
        ],
      },
    ],
    faq: [
      { q: "Does FieldQuo track where the van is?", a: "No. There is no GPS and no route history. The screen records who has it, when its paperwork expires and what it costs to run." },
      { q: "Somebody deleted the asset — is the van gone?", a: "The fleet record stays, marked with a warning that the asset behind it was deleted. Its dates are still real; keep them, or remove the fleet record once the van is gone." },
      { q: "Why is Cost per km blank?", a: "It needs two odometer readings at least 30 days apart — the van's current reading and one logged with a maintenance entry — and the asset record. The card says which is missing." },
    ],
  },

  "purchasing-orders-stock-and-suppliers": {
    title: "Purchasing: orders, stock and suppliers",
    summary:
      "Who you buy from, what you have on order and what is on the shelf — purchase orders taken delivery of line by line, a stock level summed from movements, and a reorder alert for materials with a threshold.",
    updated: "2026-09-12",
    intro: [
      "**Purchasing** is three views of one movement of goods: you raise an order with a supplier, take delivery of it, and the delivery is what changes the shelf. The screen is headed “Who you buy from, what you have on order, and what is on the shelf.” with three tabs — **Orders**, **Stock**, **Suppliers**.",
      "It is built to be used standing at a tailgate. Everything stacks on a phone, and a delivery is recorded as what actually turned up — “12 of 40” — because half an order arriving on Tuesday and the rest on Thursday is the ordinary week at a trade counter.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A purchase order is numbered per company — PO-001, PO-002 — with a supplier, lines of what you are ordering with a quantity and a price each, and an expected total worked out on the server. Its status is derived from what has arrived, never set by hand; the two things you set by hand are that it was sent and that it was cancelled. Stock is a ledger of movements, never a stored count, so a correction after a stocktake is a movement too, and the count that was wrong stays on record." },
          { note: "Only in FieldQuo among the field-service tools: neither Jobber nor Housecall Pro lists purchase orders or stock on its pricing page at any tier. ServiceTitan's top tier is reported to add “advanced inventory”, and Projul's Pro tier lists purchase orders. FieldQuo includes purchasing in every plan." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Orders** — **Purchase orders** with **New order**; one row per order: “PO-014 · Bois Laurentides”, “0 of 2 lines fully in”, a status (Draft, Sent, Part delivered, All in, Cancelled) and the expected total or **unpriced**. An open order offers **Mark as sent**, **Record what turned up** and **Cancel the order**.",
            "**Stock** — **On the shelf**: one row per material with its level and “Reorder at 10” or “No reorder level set”; **Below the reorder level** listing what is low; and **Record a movement**.",
            "**Suppliers** — **Add a supplier** (name, your account number there, who you deal with, phone) and the list, each with **Retire** or **Bring back**.",
          ] },
        ],
      },
      {
        id: "raise-an-order",
        heading: "How to raise an order and take delivery",
        blocks: [
          { steps: [
            "Open **Purchasing** (under Money) and, on **Suppliers**, add the merchant once if they are not there yet.",
            "On **Orders**, press **New order**, pick the supplier, and add a line per item: what you are ordering, **Qty**, the unit, and the price **Each**. Leave a price blank if you do not know it — the order shows as **unpriced** rather than as costing nothing.",
            "Press **Raise the order**. It is numbered and saved as Draft.",
            "When you have placed it with the supplier, press **Mark as sent**. This records the date; FieldQuo does not email the order to the supplier.",
            "When goods arrive, press **Record what turned up** and enter, per line, how many came. The status becomes **Part delivered** or **All in** from the quantities.",
            "If more arrives than was ordered, it is accepted and flagged: “More turned up than was ordered … It has gone into stock — decide whether it gets paid for.”",
          ] },
          { figure: "harness:purchasing", caption: "Purchasing → Orders — two purchase orders, one Sent with none of its lines in yet and one All in, with their expected totals." },
          { warning: "An order line typed on this screen is free text. It is not tied to a material, so recording its delivery updates the order — not the shelf. To change a stock level, record a **Received** movement on the **Stock** tab against the material." },
        ],
      },
      {
        id: "order-statuses",
        heading: "Order statuses",
        blocks: [
          { table: {
            head: ["Status", "What it means"],
            rows: [
              ["Draft", "Raised, not yet placed. Can be marked sent or cancelled."],
              ["Sent", "You pressed Mark as sent; the date is recorded and the Activity Log reads “PO-014: The order has gone to the supplier.” Waiting for delivery."],
              ["Part delivered", "At least one line has something in and at least one is short. Derived from the quantities, never set by hand."],
              ["All in", "Every line has received at least what was ordered."],
              ["Cancelled", "You pressed Cancel the order; the Activity Log reads “The order will not be filled.” A cancelled order cannot be sent or received."],
            ],
          } },
        ],
      },
      {
        id: "stock",
        heading: "Stock",
        blocks: [
          { p: "The **Stock** tab lists the company's materials with a level summed from every movement recorded against them. Materials come into existence when a job's sourcing line is bought — see [[materials-on-a-job|Materials on a job]] — and there is no screen here to create one or to set its reorder level; a material with none reads **No reorder level set**, and the low-stock list says how many it cannot speak about." },
          { bullets: [
            "**Received** — goods in; the level goes up.",
            "**Returned to stock** — brought back from a job; up.",
            "**Used on a job** — down.",
            "**Wastage** — down.",
            "**Correction after a count** — “A correction can be negative — type a minus sign if the count came up short. Nothing is edited or deleted; the correction is added to the ledger.”",
          ] },
          { note: "**Below the reorder level** lists only materials that have a threshold and are under it. A material with no threshold is never called low, because absence of a threshold is not a statement about the shelf." },
        ],
      },
      {
        id: "suppliers",
        heading: "Suppliers",
        blocks: [
          { p: "A supplier is a name, your account number there, who you deal with and a phone. There is no delete — **Retire** takes the merchant out of the order picker and keeps every order and payment against them, and **Bring back** restores them. The list of suppliers is what turns “who did we buy this from” into “what did we spend there this year”." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Purchasing is part of the **Expenses** area of the access grid: the row and every tab need **View, record, and edit everyone's**, because a purchase order or a stock level has no “my own”. Owners, administrators and the Manager preset hold it; Dispatchers, Estimators and Crew start at their own expenses only and see “Purchasing is part of the expenses permission. Ask an owner or admin to give you access to everyone's expenses.”" },
        ],
      },
    ],
    faq: [
      { q: "Does Mark as sent send the order to the supplier?", a: "No. It records that you placed it and stamps the date. Send the order the way you already do — the supplier's counter, phone, or their portal." },
      { q: "Why did my delivery not change the Stock tab?", a: "Order lines raised on this screen are free text with no material behind them, so their delivery updates the order only. Record a Received movement on the Stock tab for the material." },
      { q: "Can I edit a stock level after a count?", a: "Record a **Correction after a count** for the difference, negative if short. The ledger keeps both the wrong count and the correction, which is the only record that anything was ever off." },
    ],
  },

  "the-activity-log": {
    title: "The Activity Log",
    summary:
      "The company's audit trail — who sent, edited, approved, paid or changed what, with their name, their access level and when — read-only, most recent first, owners and administrators only.",
    updated: "2026-09-12",
    intro: [
      "**Activity Log** is the answer to “who changed this?”. Every route that changes something a company would want to trace writes one line here after the change has committed — a quote sent, a payment recorded, hours approved, a member invited or deactivated, a pay rate changed, a leave year rolled — with the name of the person who did it, their access level and the time. It is a record to consult when something looks wrong, not a dashboard.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is headed **Activity Log** — “A record of important actions in your account — quotes sent, payments recorded, hours added and approved, expenses, client and team changes, pricing and settings.” One list, newest first, showing the most recent 100 entries. There is no filter, search or export on this screen today, and nothing on it can be edited or deleted." },
          { p: "A line's sentence was written at the moment the action happened and is stored as written. Older lines stay in the English they were recorded in; lines written since the log learned to carry a translation key read in your language. A log that changed retroactively would not be a log." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**A coloured dot** per line — red for a deletion or a deactivation, amber for a settings change or someone approving their own hours, green for a payment, blue for something sent, grey for everything else.",
            "**The sentence** — “Sent invoice INV-2071 to sophie.dubois@example.com”, “Invited Ana Pereira as Crew”, “Updated cabinet pricing”, “Recorded the pay run for … as paid outside FieldQuo”.",
            "**Who, their level, and when** — “Julie Gagnon · supervisor · 4h ago”, relative for 30 days and then a date. An action taken by FieldQuo support during a read-only session is marked **support session** — which should never happen, and this is where it would surface.",
          ] },
        ],
      },
      {
        id: "read-the-log",
        heading: "How to read the log",
        blocks: [
          { steps: [
            "Open **Settings → Activity Log** (under Business).",
            "Scan the dots for what you are looking for: red for “who removed this”, green for “who recorded that payment”, amber for “who changed that setting”.",
            "Read the line's name and level. The name was stored at the time, so a renamed or departed employee still shows as who they were.",
          ] },
          { figure: "harness:settings-activity", caption: "Settings → Activity Log — one line per action with its dot, the sentence, and who did it, their level and how long ago." },
          { tip: "For a single quote, job or invoice, the record's own page is faster than scanning the whole log; the log is for the question “what has been happening in this account” and for tracing a change nobody owns up to." },
        ],
      },
      {
        id: "what-gets-logged",
        heading: "What gets logged",
        blocks: [
          { bullets: [
            "**Quotes, invoices and jobs** — created, sent, followed up, accepted, marked paid, scheduled.",
            "**Money** — payments recorded, expenses, a subcontractor payment, a pay run saved, approved, recorded as paid or cancelled, a payroll component added or removed, the year-end list downloaded.",
            "**Hours** — time entries added, edited and approved, including a person approving their own.",
            "**Team** — invitations, an access level changed, a member deactivated, working hours or leave policies changed, a leave year rolled.",
            "**Clients** — a client added or their contact details edited.",
            "**Settings** — pricing, branding, the pay cycle, suppliers retired, and the rest of the settings screens.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. The row is hidden from every other level and the server answers “Only an owner or admin can view the activity log.” to anyone else — the log names actions across every user, including payments, pay-rate changes and who deactivated whom, which are not a Manager's to read." },
          { note: "Logging never fails or rolls back the action it describes. If a write to the log itself failed, the action still happened and the line is missing — a deliberate trade, so that a customer's quote is never lost because an audit row could not be written." },
        ],
      },
    ],
    faq: [
      { q: "Can I export the log or search it?", a: "Not on this screen today. It shows the most recent 100 entries, newest first. For a longer history, ask support." },
      { q: "Why is one line in English on my French account?", a: "It was written before the log carried translation keys, and stored sentences are never rewritten. Lines written since read in your language." },
      { q: "Can a line be deleted?", a: "No. Nothing on the log can be edited or removed, by you or by FieldQuo support — that is the point of it." },
    ],
  },
};
