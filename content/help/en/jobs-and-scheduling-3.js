// content/help/en/jobs-and-scheduling-3.js
//
// Part 3 of the “jobs-and-scheduling” category in English (see the composer,
// jobs-and-scheduling.js). Slugs assigned to this part (lib/help/tree.js):
// timesheets-and-approving-hours, time-off-requests, safety-incidents,
// job-costing, materials-on-a-job, cancel-or-archive-a-job,
// when-a-job-is-completed, a-chat-room-for-every-job,
// supervisor-required-visits.
//
// Every sentence is read from the code it describes: the page modules under
// app/app/**, the routes they call, and the rules in lib/** — the 250 m fence
// in lib/geo/distance.js, the approval gates in app/api/time-entries/[id],
// the leave routing in lib/org/leaveRouting.js, the cost rules in
// lib/costing/actualJobCost.js, the room rules in lib/company/chat/rules.js.
// The words on the screen are the `en` strings of app/i18n/appMessages.js;
// where a screen still prints a hardcoded English label, that label is quoted
// as it appears.
export const ARTICLES = {
  "timesheets-and-approving-hours": {
    title: "Timesheets: review and approve hours",
    summary:
      "Where the office reviews every clock-in, sees where the phone was when it happened, approves the hours a pay run may use, and logs a punch somebody forgot.",
    updated: "2026-09-12",
    intro: [
      "The crew clock in and out on **Time clock**; the office reviews the result on **Timesheets**. Nothing reaches a pay run until somebody presses **Approve** on it, and nothing on this screen is hidden from the person who worked the hours — the same entry they see on their phone is the row you see here.",
      "This article covers what each row shows, what the position chips mean and do not mean, how to add a missed punch, and who is allowed to approve, edit or delete an entry.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Timesheets sits in the sidebar under **People**, next to **Time clock** and **Time Off**. The heading reads **Timesheets — Log, review and approve hours.** Below it is one row per punch, newest first, for everyone in the company — not a week view, and not filtered by person." },
          { p: "An entry is **pending** from the moment it is clocked out until somebody approves it; a row still on the clock reads **In progress** instead of a number of hours. Only approved hours are counted by [[payroll-runs|a payroll run]] and by [[job-costing|job costing]]; pending hours are reported beside them as left out, never silently added." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Add entry**, top right — opens the **New time entry** form. It only appears once at least one worker exists; otherwise the page says **Add a worker under Workers first, then log their hours here.**",
            "Each row: the worker's name, the date, and either the hours (**7.5h**) or **In progress**.",
            "Two chips under the name: **In · On site**, **In · 2.1 km away** or **In · —**, and the same for **Out** once the person has clocked out.",
            "On the right: **Clock out** on a row still open, **Approve** on a pending row with hours, the status word on everything else, and a ✕ to delete a row that is not yet approved.",
            "A row approved by the same person who worked it carries **· self-approved** in amber.",
            "The legend at the bottom: **Position is captured only at the moment they tap Clock in or Clock out, with their permission. Nothing is tracked in between. A flag is a question for you, not a verdict.**",
          ] },
          { figure: "harness:timesheets", caption: "Timesheets — one row per punch, the In and Out chips, an Approve button on the rows waiting, and the position legend underneath." },
        ],
      },
      {
        id: "approve-hours",
        heading: "How to approve hours",
        blocks: [
          { steps: [
            "Open **Timesheets** from the sidebar.",
            "Read the row: the date, the hours, and the two chips. An amber chip means the tap landed more than 250 m from the job's address — look, then decide.",
            "Press **Approve**. The row changes to **approved** and the hours become available to the next pay run and to the job's cost.",
            "A row that is still **In progress** cannot be approved. Press **Clock out** on it first (the end time is now), or wait for the person to clock out themselves.",
          ] },
          { note: "Approving your own hours is allowed — a sole trader has nobody else to ask — but it is named: the row says **· self-approved**, the pay run says so, and the [[the-activity-log|Activity Log]] records it as a separate action." },
          { warning: "An approved entry is closed. Only an owner, administrator, Dispatcher or Manager can change or reopen it, because those hours may already be on a payslip. A crew member who corrects their own hours — a forgotten clock-out is the usual case — sends the entry back to **pending** so it gets looked at again." },
        ],
      },
      {
        id: "add-an-entry",
        heading: "How to log a missed punch by hand",
        blocks: [
          { steps: [
            "Press **Add entry**. The **New time entry** form opens.",
            "Choose the **Worker**, the **Date** (today is pre-filled), the **Start** time and, if the shift is over, the **End (optional)** time.",
            "Press **Save**. The hours are worked out on the server in your company's timezone, so a 9:00–17:00 entry is 8 hours wherever the person saving it happens to be.",
          ] },
          { p: "Leave **End (optional)** blank and the entry stays **In progress** until somebody presses **Clock out** on it. A manual entry has no position chips to show — nobody tapped a phone — so both chips read **—**." },
        ],
      },
      {
        id: "the-position-chips",
        heading: "What the position chips mean",
        blocks: [
          { table: {
            head: ["Chip", "What it means"],
            rows: [
              ["**In · On site**", "The phone answered at the moment of the tap and was within 250 m of the job's geocoded address."],
              ["**In · 2.1 km away**", "The phone answered and was further than 250 m from the address. Amber, because it is a question — the person may have parked up the street, or may not have been there."],
              ["**In · —**", "No claim can be made: the phone did not answer, the job has no site address on a map, the entry was typed in by hand, or the reading was too rough to trust (an accuracy circle wider than the fence)."],
            ],
          } },
          { p: "The 250 m fence is fixed; it is not a setting. Position is asked for once per tap and only with the person's permission; FieldQuo never records a route, a trail or a location between punches, and never draws anyone on a map — the timesheet shows the distance to the site and nothing else. The chip never disables **Approve** — the decision stays yours." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The page opens for anyone who can manage people — the owner, administrators, and the **Dispatcher** and **Manager** levels. The sidebar row appears at the **Time Tracking & Timesheets** level **View, record, edit, and delete everyone's**, which those same presets hold. **Crew** and **Estimator** are at **View, record, and edit their own**: they do not see this row, and their own entries live on [[the-time-clock|Time clock]]." },
          { bullets: [
            "**Approve**: owner, administrator, Dispatcher, Manager.",
            "**Clock out** somebody else, or edit their times: the same **everyone's** level.",
            "**✕ Delete**: the **everyone's** level, and never on an approved row — the server refuses that, so the button is not shown. Deleting asks first: **Delete this time entry?**",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Why is there no Approve button on a row?", a: "Either it is still In progress (clock it out first) or it is already approved. A row that reads approved has no button and no ✕." },
      { q: "Does a flagged row stop the person being paid?", a: "No. The chip changes nothing on its own; the hours reach the pay run only when you approve them, flagged or not." },
      { q: "Can I see which job the hours were on?", a: "Not on this list — it shows the worker, the date and the hours. The job is on the person's Time clock entry and in the job's own cost panel once the hours are approved." },
      { q: "Where does the hourly rate come from?", a: "From the worker's record under Settings → Workers. A worker with no rate still has their approved hours counted, but they add no labour cost to the job, and the cost panel says so rather than showing a cheaper job." },
    ],
  },

  "time-off-requests": {
    title: "Time off requests",
    summary:
      "How anyone on the team asks for time off, how the request finds the right manager, what approving it changes on the calendar and the balance, and who can do what.",
    updated: "2026-09-12",
    intro: [
      "**Time Off** is one screen with two audiences. Everybody sees their own balances and requests and can ask for days off; a manager also gets a **Team** tab with the requests waiting on them, who is off next, and everyone's balances.",
      "The balances come from the policies an owner sets up under **Settings → Time Off Policies** — see [[time-off-policies|Time off policies]]. Without a policy there is nothing to request against, and the screen says so.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The heading reads **Time off — Request time off and see what you have left.** For a manager, two buttons on the right switch between **Mine** and **Team**; the **Team** button carries a count of requests still pending." },
          { p: "A request has four states, shown as a pill on its row: **Pending**, **Approved**, **Declined** and **Cancelled**. Approved time off is what the rest of the product reads: the [[the-scheduler-and-crew-shifts|Scheduler]] refuses to put a shift on an approved day off, and the public booking page stops offering that person's slots on those days. A pending request changes neither." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Mine** — one balance card per policy (for example **Vacation**, **Sick**, **Personal**) showing the days left, then **Accrued**, **Taken** and, when something is pending, **Awaiting approval**. A vacation-pay policy shows money accrued instead of days.",
            "**Your requests** with the **Request time off** button, then each request: the policy, the pill, the dates, the number of days, your note, and **Withdraw** on a request you can still take back.",
            "**Team** — **Awaiting approval** with **Approve** and **Decline** on each request, **Who's off next**, **Balances this year** as a table (**Person**, **Policy**, **Accrued**, **Taken**, **Left**), and **Earlier**.",
          ] },
          { figure: "harness:time-off", caption: "Time Off — the balance cards, Your requests, and a pending request with its Withdraw button." },
        ],
      },
      {
        id: "request-time-off",
        heading: "How to request time off",
        blocks: [
          { steps: [
            "Open **Time Off** and press **Request time off**.",
            "Choose the **Type** — the policy. Beside it the form says how many days you have available, or that unpaid leave isn't limited by a balance.",
            "Set **First day** and **Last day**. For a single day, tick **Half day only** to ask for 0.5.",
            "Add a **Note (optional)** — *Anything your manager should know* — and press **Submit request**.",
          ] },
          { p: "Days are counted on your own working days (from [[working-hours-and-bookable-hours|your working hours]]; Monday to Friday if none are set), so a Friday-to-Monday request is two days, not four. The request is refused if it overlaps one you already have pending or approved, or if it needs more days than you have left after what is already pending." },
          { note: "A policy that does not require approval books itself: the form says **This type is approved automatically — submitting books it.** Otherwise the row says who it is waiting on — **Waiting on Marie.**" },
        ],
      },
      {
        id: "where-a-request-goes",
        heading: "Where a request goes",
        blocks: [
          { p: "Each worker has a **Reports to** field under **Settings → Workers**. A request goes to that manager first. If the manager is themselves on approved leave that day, it escalates to their manager, and the row says so — **escalated because Marie is away**. With nobody set, or everyone above on leave, it waits on an owner or administrator." },
          { p: "Everyone who can manage people gets a **Time off requested** notification in their feed. Nobody can approve their own request; the server answers **You can't approve your own time off — it goes to your manager.** A person can approve requests from anyone below them in the reporting line; an owner, administrator, Dispatcher or Manager can approve anyone's." },
        ],
      },
      {
        id: "what-each-action-changes",
        heading: "What each action changes",
        blocks: [
          { table: {
            head: ["Action", "What happens"],
            rows: [
              ["**Approve**", "The balance is checked again at that moment — other requests may have been approved since — then the days are taken from the balance, the pill turns **Approved**, and the days go on the calendar for scheduling and booking."],
              ["**Decline**", "The pill turns **Declined**. Nothing is taken from the balance."],
              ["**Withdraw**", "Available to the requester on a pending or approved request that has not started. An approved request gives its days back to the balance. Once the first day has passed, only a manager can cancel it."],
            ],
          } },
          { p: "Every approval, decline and cancellation is written to the [[the-activity-log|Activity Log]] with the policy and the number of days." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Every access level sees **Time Off** and the **Mine** tab. The **Team** tab appears only when the server allows it — the owner, administrators, **Dispatcher** and **Manager**. A person who can see the team's requests but is not in anyone's reporting line and cannot manage people sees them read-only: **You can see requests but not approve them.**" },
        ],
      },
    ],
    faq: [
      { q: "Why does my request say it is waiting on an owner?", a: "No manager is set on your worker record, or everyone above you is away today. An owner or administrator sets Reports to under Settings → Workers." },
      { q: "Can a manager book time off for somebody else?", a: "No. A request is always made by the person taking the time; a manager approves, declines or cancels it." },
      { q: "Does a pending request block the schedule?", a: "No. Only approved time off is read by the Scheduler and the booking page. A request nobody has answered changes nothing." },
    ],
  },

  "safety-incidents": {
    title: "Safety incidents and near-misses",
    summary:
      "A crew member reports an injury, a near-miss or property damage from the site in under a minute; a manager follows up, sets the status and records what was done.",
    updated: "2026-09-12",
    intro: [
      "**Safety** is the place an incident gets written down while it is still fresh — by the person standing there, from their phone, without asking anyone's permission first. The heading says why: **Injuries and near-misses. A near-miss is worth reporting exactly like an injury — it's how you learn before someone gets hurt.**",
      "Reporting is open to every access level. Reading everyone's reports and following up on them is a separate, higher grant, because a report naming an injured employee is sensitive.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is a **Report** button, the filters **All / Open / Reviewed / Closed**, and one card per incident. Each card shows the kind — **Near-miss**, **Injury**, **Property damage** or **Other** — a red **Work stopped** badge when work stopped, when it happened, the description, where, which job, **Reported by** whom, the reporting note if there is one, up to six photos, and the status on the right. When nothing has been filed the list reads **Nothing reported — That's a good thing.**" },
          { figure: "harness:safety", caption: "Safety — the Report button, the status filters, and two incident cards with their Follow up disclosure." },
        ],
      },
      {
        id: "report-an-incident",
        heading: "How to report an incident",
        blocks: [
          { steps: [
            "Open **Safety** and press **Report**.",
            "Pick **What kind of incident** and **When it happened** (now is pre-filled).",
            "Write **What happened** — *In your own words — short is fine.* This is the only required text.",
            "Add **Where**, and choose the **Job (optional)** it belongs to, or leave it **Not tied to a job**.",
            "Tick **Work stopped because of this** if it did, and add a **Reporting note (optional)** for anything about reporting it to a provincial authority.",
            "Press **File report**. The screen then offers **Add a photo of the scene if you have one — optional**; add up to six and press **Done**.",
          ] },
          { warning: "If your job list could not be loaded, the form says so in amber and the report would be filed against no job. Reload before filing if it belongs to one — nobody goes back to fix that afterwards." },
        ],
      },
      {
        id: "follow-up",
        heading: "How a manager follows up",
        blocks: [
          { p: "Each card has a **Follow up** disclosure for anyone with the follow-up level. Open it, set the status — **Open**, **Reviewed** or **Closed** — write **What was done about it**, and press **Save**. FieldQuo stamps who reviewed it and when. The status filters at the top read the same status." },
          { p: "The reporting note is deliberately a note, not a workflow. FieldQuo does not know your province's reporting rules or deadlines and does not file anything with an authority for you; the field is where you write down what you decided." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "What FieldQuo does not do",
        blocks: [
          { bullets: [
            "It sends nobody a message when a report is filed. The report appears on this screen and in the [[the-activity-log|Activity Log]]; if you want a manager told right away, tell them.",
            "It does not stop the clock, cancel the visit or change the job's status when **Work stopped** is ticked. The badge records the fact; the schedule is yours to change.",
            "It does not name an injured person separately from the reporter. The report says who filed it; who was hurt goes in the description.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Only in FieldQuo",
        blocks: [
          { p: "A safety log a crew member can file from a phone, with a manager's follow-up on the same card, is not listed on the pricing page of Jobber, Housecall Pro, ServiceTitan, QuoteIQ or Projul at any tier — which is the test FieldQuo's comparison pages use. Other tools put this in a separate safety app; here it sits beside the job and the clock the same crew already use." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { table: {
            head: ["Safety Incidents level", "What it allows", "Who has it by default"],
            rows: [
              ["**Report incidents, and view their own**", "File a report; see the reports you filed.", "Crew, Estimator"],
              ["**View everyone's incidents**", "See every report in the company and use the status filters.", "Nobody by default — granted in the Custom access editor"],
              ["**View everyone's incidents and follow up on them**", "Everything above, plus **Follow up**.", "Dispatcher, Manager, administrators, the owner"],
            ],
          } },
          { p: "The sidebar row disappears only for someone set explicitly to **No access**. The server checks the same level on every request, so hiding the row is not what protects a report." },
        ],
      },
    ],
    faq: [
      { q: "Can a crew member see a colleague's report?", a: "Not at the default level. Report incidents, and view their own means the reports they filed, and nothing else — even one about an incident they were involved in but did not file." },
      { q: "Can a report be edited or deleted after filing?", a: "Not deleted, and the description is never rewritten. A manager can change the status, the follow-up notes, the reporting note and the Work stopped mark; what happened stays as the reporter wrote it." },
      { q: "Does an incident show on the job?", a: "The card names the job, and a job can be picked when filing. The job page itself does not list incidents." },
    ],
  },

  "job-costing": {
    title: "Job costing: quoted against actual",
    summary:
      "What a job actually cost — approved hours, receipts, subcontractors, overhead — beside what you quoted for it, and the close-out that asks whether your rates need changing.",
    updated: "2026-09-12",
    intro: [
      "A quote carries an estimated cost: materials, labour hours, a share of overhead, a target margin (see [[cost-and-margin-on-a-quote|Cost and margin on a quote]]). Then the job happens. Job costing is the other half — what it really cost — shown on the job page as **What this job has cost**, and compared line for line against the estimate when the job is done.",
      "Nothing in it is guessed. It is a sum of things that were recorded: hours somebody approved, expenses somebody tagged, a subcontractor's agreed price, the overhead you told FieldQuo about. Where a number is missing, the panel says so rather than showing a cheaper job.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The panel appears on the job page only once something has been recorded against the job and only for someone with the **Job costing** switch on. It shows **Expenses**, **Labour** (with **{hours}h approved on this job**), **Subcontractors**, **Overhead**, and **Total cost**; then **Quoted**, **Approved changes** and **Contract value now** when there are change orders; then **Left after costs** and **Margin**; and **Spend by category** underneath." },
          { p: "The same figures feed the KPI dashboard's profit and estimate-accuracy tiles, which is why that screen also requires the switch." },
        ],
      },
      {
        id: "what-counts-as-cost",
        heading: "What counts as cost",
        blocks: [
          { table: {
            head: ["Line", "Where it comes from", "Rule"],
            rows: [
              ["**Labour**", "Approved time entries on this job × the worker's hourly rate (Settings → Workers).", "Pending hours are shown but not costed. A worker with no rate adds hours and no money, and the panel says how many hours are unrated."],
              ["**Expenses**", "Expenses tagged to this job in [[expense-tracking-and-burn-rate|Expense Tracking]], by category.", "Payments to subcontractors are skipped here so they are not counted twice."],
              ["**Subcontractors**", "The amount agreed with each subcontractor on the job (agreed, done or paid).", "A quoted-but-not-agreed bid is shown as **+{amount} quoted, not agreed** and left out of the total."],
              ["**Overhead**", "Your cost per job from [[overhead-and-your-minimum-price|Settings → Overhead]].", "Absent, not zero, until you fill that screen in — a job cannot be costed against an overhead nobody has stated."],
              ["**Equipment**", "Your own assets logged on the job.", "Reported for information, and added to the total only when no overhead is set — otherwise the overhead share already carries the depreciation."],
            ],
          } },
        ],
      },
      {
        id: "the-comparison",
        heading: "Quoted against actual",
        blocks: [
          { p: "**Quoted** is the quote's total. **Contract value now** adds approved change orders. **Left after costs** is that contract value minus **Total cost**, and **Margin** is the same as a percentage. The variance against the *estimated* cost is worked out separately: if either side is missing — no costed quote, or nothing recorded yet — there is no percentage, because a job with nothing recorded has not come in on budget." },
          { p: "Time entries that were clocked during the job's dates but never tagged to a job are listed as unattributed, with the note **Tag those entries to a job on the timesheet and they'll land here.**" },
          { note: "The prices ticked on the job's **Materials to buy** list are not in **Total cost**. They go into your price history; a receipt that should count against this job is recorded as an expense — the close-out offers **Add a material or receipt to this job** for exactly that." },
        ],
      },
      {
        id: "the-close-out",
        heading: "The close-out when a job is completed",
        blocks: [
          { p: "Marking a job **Completed** opens the review once: **This job is done — is its cost?** with a **Review actual costs** button, and a task **Review what \"…\" actually cost** due in three days. The review walks top to bottom:" },
          { steps: [
            "**Labour: hours estimated vs approved** — the quote's hours against the approved ones, with pending and unrated hours called out and an **Approve hours** link to Timesheets.",
            "**Materials: what the estimate said vs what you used** — every line on the job with a box for what you actually used; **Add a material or receipt to this job** records a receipt that was never entered, as an expense.",
            "The verdict — estimated, actual, the difference, the margin. If the job came in over your threshold, one question: **This job cost {pct}% more than you quoted. Update your costing from what it really cost?** with **Update** and **Leave as is**.",
            "**The cost is complete** signs it off and settles the task. **Not yet** leaves everything open.",
          ] },
          { figure: "live:app-settings-material-costs", caption: "Settings → Material Costs — the threshold at the top decides when the close-out asks about revising your costing." },
          { p: "**Update** opens per-line suggestions, each with a button only where a saved rate exists to move. Nothing is applied without a press, and the answer is recorded once — a job is never asked twice. The threshold is under **Settings → Material Costs**, default **15%**; a job that came in under never asks." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Job costing** switch is on for the owner, administrators and the **Manager** preset, and off for **Dispatcher**, **Estimator** and **Crew**. Without it the panel is not rendered, the costing route refuses, and the cost columns on the materials list are blanked. The switch requires **See prices**, time tracking, expenses and jobs access, and an owner can grant it to any person in the [[the-custom-access-editor|Custom access editor]]." },
        ],
      },
    ],
    faq: [
      { q: "Why is the panel missing on a fresh job?", a: "Nothing has been recorded yet. It appears once an approved hour, an expense, a subcontractor or an equipment log exists on the job." },
      { q: "Why is my margin higher than I expected?", a: "Look for pending hours, unrated workers and an empty Overhead screen. Each is named on the panel; each makes the actual smaller than reality until it is filled in." },
      { q: "Does the client see any of this?", a: "No. Cost, margin and the comparison are internal. The quote and invoice the client receives carry prices only." },
    ],
  },

  "materials-on-a-job": {
    title: "Materials on a job",
    summary:
      "The job's shopping list: what to buy, derived from the quote, ticked off in the yard, with the receipt and the quantity actually used recorded against each line.",
    updated: "2026-09-12",
    intro: [
      "Every job page has a **Materials to buy** panel. For the trades FieldQuo measures — roofing, painting by area, siding, insulation, paving, and the recipe trades such as cabinet refinishing — the lines are derived from the quote: squares into bundles, area and base depth into cubic yards. For anything else, you add lines by hand.",
      "The list is internal. Nothing on it reaches the client; it is the yard's list, not the quote.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The panel heading reads **Materials to buy**, followed by **3 of 10 bought** once there are lines. Each line shows a tick box, the name, the quantity and unit, and on the right either the estimated cost, what it actually cost once bought, **no price set**, or **—** for someone who may not see costs. A bought line is struck through with its supplier under it and, when recorded, how many were actually used." },
          { p: "While anything is still to buy, the to-do list carries one task — **Buy materials — 204 Avro Cir · 3 of 10 bought** — that updates with every tick and closes itself when everything is bought." },
        ],
      },
      {
        id: "rebuild-from-the-quote",
        heading: "How to build the list from the quote",
        blocks: [
          { steps: [
            "Open the job and find **Materials to buy**.",
            "Press **Rebuild from the quote**. FieldQuo reads the quote's takeoff or intake answers with your rates as they stand today and writes one line per material.",
            "Press it again after the quote is revised. Lines already ticked as bought and lines you added by hand are kept; only unbought derived lines are replaced.",
          ] },
          { note: "A job with no quote behind it answers **This job has no quote to derive materials from.** Add lines by hand instead." },
        ],
      },
      {
        id: "tick-a-line",
        heading: "How to tick a line off",
        blocks: [
          { steps: [
            "Tap the box beside the line. It opens **What it cost** (*total on the receipt*), **How many did you actually use?** (pre-filled from the estimate) and **Supplier**.",
            "Fill in what you have — none of it is required — or press **Scan the receipt** to photograph the till receipt and have the total read off it for you to confirm.",
            "Press **Bought**. The line is struck through and the count goes up.",
          ] },
          { p: "A price entered on the tick is not decoration: it is written into your company's own material price history, which is how the unit costs the price books ship unset get filled in with what you actually paid. Unticking a line clears its receipt and supplier from the line, but that price-history entry stays — the purchase did happen." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["**Add a line**", "Adds a hand-entered line (*What else does this job need?*) with a quantity and unit. Hand-added lines survive a rebuild and their quantity stays editable."],
              ["**Rebuild from the quote**", "Replaces unbought derived lines with a fresh derivation. Never removes a bought or hand-added line."],
              ["**Bought**", "Stamps who bought it and when; records cost, supplier and quantity used; writes the price to your history."],
              ["**Remove**", "Deletes the line from this job. Its price-history entry, if any, stays."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone who can open the job can read the list — a crew member at the trade counter needs it, and a **Crew** login sees the jobs it is booked on. Ticking, adding, rebuilding and removing need **Jobs: View, create, and edit** (**Dispatcher**, **Manager**, administrators, the owner); without it the boxes are shown but not pressable. The cost boxes and **Scan the receipt** appear only with the **Job costing** switch; the quantity and supplier are offered to everyone who may tick." },
        ],
      },
    ],
    faq: [
      { q: "Why does a line say no price set?", a: "The price book has no unit cost for it yet. Enter what you paid when you tick it and that becomes the price FieldQuo knows." },
      { q: "Why can I not change the quantity on a derived line?", a: "That quantity is the estimate, and the close-out compares what you used against it. Record the real number in How many did you actually use? instead." },
      { q: "Does ticking a line create an expense?", a: "No. It records the cost on the line and in your price history, and that is all. The job's cost panel adds up expenses, approved hours, subcontractors and overhead — not the prices on this list — so a receipt that should count against the job is added as an expense, which the close-out offers to do for you." },
    ],
  },

  "cancel-or-archive-a-job": {
    title: "Cancel or archive a job",
    summary:
      "Cancelled says the work did not happen; Archived says you are done looking at it. They are different facts, they live on different controls, and one of them is reversible.",
    updated: "2026-09-12",
    intro: [
      "A job has a status — **Needs a date**, **Scheduled**, **In progress**, **Completed**, **Cancelled** — and, separately, it can be **Archived**. A job can be Completed *and* archived; it can be Cancelled and still sitting in the list. This article says what each one changes and which to use.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { table: {
            head: ["What changes", "Cancel", "Archive"],
            rows: [
              ["What it says", "The work did not, or will not, happen.", "Filed away. Says nothing about the work."],
              ["Where", "The status dropdown on the job page.", "The **Archive** button on the job page."],
              ["The Jobs list", "Shown under the **Cancelled** chip.", "Hidden until you press the **Archived** toggle."],
              ["The calendar", "Its visits stay until you cancel each one.", "Its visits leave the calendar and the dashboard counts with it."],
              ["Reversible", "Yes — set the status back.", "Yes — **Restore**."],
            ],
          } },
        ],
      },
      {
        id: "cancel-a-job",
        heading: "How to cancel a job",
        blocks: [
          { steps: [
            "Open the job and choose **Cancelled** in the status dropdown next to the title.",
            "If the job came from a quote, the *schedule this job* task on your to-do list closes itself.",
            "Press **Cancel visit** on each of its visits — on the job page or the calendar. It asks for an optional reason and, unless you untick it, emails the client in their language that the office cancelled. Cancelling the job does not cancel its visits; they stay on the calendar and would still get a reminder text.",
          ] },
          { p: "A cancelled job keeps everything on it — hours, expenses, photos, notes. It never gets a review request, its recurrence stops rolling forward, and its chat room moves under **Finished jobs**." },
        ],
      },
      {
        id: "archive-a-job",
        heading: "How to archive a job",
        blocks: [
          { steps: [
            "Open the job and press **Archive**. The badge **Archived** appears beside the status; the button becomes **Restore**.",
            "On the Jobs list, press the **Archived** toggle at the end of the chip row to see the drawer. It shows archived jobs only — never both at once.",
            "Press **Restore** on the job to bring it back.",
          ] },
          { figure: "live:app-jobs", caption: "Jobs — the status chips, and the Archived toggle after the divider that opens the drawer." },
          { p: "Archiving a job also closes the *schedule this job* task and records **Archived job …** in the [[the-activity-log|Activity Log]]. Its chat room moves under **Finished jobs**." },
        ],
      },
      {
        id: "delete",
        heading: "When to delete instead",
        blocks: [
          { p: "**Delete** exists for a job that was made by mistake and has nothing on it. It asks first — **Delete this job?** *The job and its visits are removed for good. The quote and any invoice stay where they are. If work has already been logged against it, cancel it instead.* A job carrying time entries or tasks is refused: those are records of work, and history gets cancelled, not erased." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can do it",
        blocks: [
          { bullets: [
            "**Cancel** and **Archive / Restore**: **Jobs: View, create, and edit** — Dispatcher, Manager, administrators, the owner.",
            "**Delete**: **Jobs: View, create, edit, and delete** — Manager, administrators, the owner.",
            "**Crew** and **Estimator** see the status badge and the Archived badge, and none of the three controls.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Should I cancel or archive a job that fell through?", a: "Cancel it. Cancelled is the honest status, and the job stays visible under its own chip. Archive it as well if you never want to see it again." },
      { q: "I archived a job and its visits vanished from the calendar. Is that a bug?", a: "No — that is what archiving does. Restore the job and the visits come back." },
      { q: "Can I archive a job that is still in progress?", a: "Yes; archived is not a status. It will not show on the list or the calendar until restored, so do it only when you are done with it." },
    ],
  },

  "when-a-job-is-completed": {
    title: "When a job is completed",
    summary:
      "Marking a job Completed stamps the finish, raises two tasks, starts the clock on the review request and any follow-up rule, and opens the cost review — and does not raise an invoice.",
    updated: "2026-09-12",
    intro: [
      "**Completed** is one option in the status dropdown on the job page, but the moment it is chosen is the one a lot of the product keys off. This article lists exactly what fires, what does not, and what happens if you reopen the job afterwards.",
    ],
    sections: [
      {
        id: "mark-it-completed",
        heading: "How to mark a job completed",
        blocks: [
          { steps: [
            "Open the job and choose **Completed** in the status dropdown.",
            "FieldQuo stamps the completion time — once, on the first flip, and never moves it afterwards.",
            "If job costing is on for you, the cost review opens: **This job is done — is its cost?** — see [[job-costing|Job costing]].",
          ] },
          { p: "Marking every visit complete does not complete the job, and completing the job does not complete its visits. They are separate facts on separate records." },
        ],
      },
      {
        id: "what-happens-next",
        heading: "What happens next",
        blocks: [
          { bullets: [
            "A task **Ask {client} for a review** appears on your to-do list, due in two days.",
            "A task **Review what \"{job}\" actually cost** appears, due in three days.",
            "If the job came from a quote, the *schedule this job* task closes.",
            "The job's chat room is kept with its history and moves under **Finished jobs**.",
            "A recurring job stops generating the next occurrence.",
            "The review-request clock starts, and so does any **Job completed** follow-up rule you have set up under [[follow-up-rules|Follow-up rules]].",
          ] },
          { figure: "live:app-tasks", caption: "To-do — the tasks the product raises for you, each linked to its job and client." },
        ],
      },
      {
        id: "the-review-request",
        heading: "The review request",
        blocks: [
          { p: "With **Ask automatically** on under **Settings → Reviews** and a review link saved, every client with an email address gets one message after their job is marked complete — never more than one. **When to ask** sets the delay, from **2 hours later** to **A week later**; the default is the next day. See [[review-requests|Review requests after a job]]." },
          { figure: "live:app-settings-reviews", caption: "Settings → Reviews — the review link, Ask automatically, and When to ask." },
          { bullets: [
            "The email carries your company's name and branding and links to your review page.",
            "A client who has unsubscribed is skipped. A job completed more than 30 days ago is never asked.",
            "A past job entered under **Past jobs** is never asked — the client was served years ago, and the job page says **no messages were sent**.",
          ] },
        ],
      },
      {
        id: "what-does-not-happen",
        heading: "What does not happen",
        blocks: [
          { bullets: [
            "**No invoice is raised.** You create it from the job or the quote — see [[create-an-invoice|Create an invoice]]. A payment-schedule stage due **On completion** keys off the job's *end date*, not the moment you press Completed.",
            "**The client is not told** the job is complete. The only client-facing message is the review request, on its own delay.",
            "**Hours are not approved** and **materials are not costed** by themselves. The cost review asks you to do both.",
          ] },
        ],
      },
      {
        id: "reopening",
        heading: "Reopening a completed job",
        blocks: [
          { p: "Set the status back to **In progress** or **Scheduled** and the completion stamp is cleared: a job that is not finished has no finish time. A review request that has not been sent yet is not sent; one already sent is not sent again. The two tasks are not raised a second time when you complete it again." },
        ],
      },
    ],
    faq: [
      { q: "Where do I set the review delay?", a: "Settings → Reviews, under When to ask. It applies to every job in the company." },
      { q: "The client never got a review request. Why?", a: "One of: Ask automatically is off, no review link is saved, the client has no email address or has unsubscribed, the delay has not elapsed, or the job was completed more than 30 days ago." },
      { q: "Can I send the review request myself, earlier?", a: "Not from the job page. The request goes out on the company's delay; the Ask for a review task is there so you can make the ask in person if you prefer." },
    ],
  },

  "a-chat-room-for-every-job": {
    title: "A chat room for every job",
    summary:
      "Every scheduled job gets its own room in Chat, with the crew booked on its visits and the office already in it — nobody adds anybody by hand.",
    updated: "2026-09-12",
    intro: [
      "**Chat** is your company talking to itself. **#general** is everyone on the team; a **direct message** is two people; and every job on the calendar has its own room. This article is about the job rooms: who is in one, why, and what happens to it when the job ends. The rest of the screen is in [[team-chat|Team chat]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A job room is named after the job and exists for every job that is **Scheduled** or **In progress** and not archived. Its members are worked out, never chosen: whoever is booked on one of the job's visits, plus the office — the owner, administrators and managers, who are in every job room. Take somebody off the visits and they leave the room; put them back and they are back in it, with their earlier messages still attributed." },
          { p: "The room list groups rooms as **Unread**, **Company**, **Jobs**, **Direct messages** and **Finished jobs**. Unread rooms come first because the list exists to answer who is waiting on you." },
          { figure: "harness:chat", caption: "Chat — the room list grouped by kind on the left, a job room open on the right with its unread divider, a mention, and Open job." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is in a job room",
        blocks: [
          { bullets: [
            "The header: the job's name, **The crew booked on this job, and the office**, an **Open job** button, and **{count} people**, which opens the **Members** bar.",
            "The Members bar explains itself: **Whoever is booked on one of this job's visits, plus the owner, admins and managers. To add somebody, book them on a visit.** There is no add or remove control, because the bar could not honour one.",
            "The thread, with **Today** and **Yesterday** dividers and a red **Unread messages** line where you left off.",
            "The composer — **Message {name}** — with *Enter to send · Shift+Enter for a new line*. Messages are text, up to 4,000 characters; photos go on the job, not in the chat.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "How to get somebody into a job's room",
        blocks: [
          { steps: [
            "Open the job and book them on a visit — see [[book-a-visit-for-a-client|Book a visit for a client]].",
            "Open **Chat**. The room is under **Jobs**, and they are in it; the next time anyone opens the chat, the membership is brought up to date.",
            "Type **@** in the composer to mention someone in the room — *↑↓ to choose · Tab to insert · Esc to close*.",
          ] },
          { note: "A job with no visits has no crew and gets no room. Give it a visit and the room appears." },
        ],
      },
      {
        id: "mentions-and-notifications",
        heading: "Mentions and notifications",
        blocks: [
          { p: "A message in a job room notifies nobody by itself — the room's unread count goes up, and that is all. An **@mention** sends a [[push-notifications|push notification]] to the person named, on every device where they allowed it, and tapping it lands them in the room. A direct message pushes the other person the same way. The message is stored either way; a push that could not be delivered is not a message that was lost." },
        ],
      },
      {
        id: "when-the-job-ends",
        heading: "When the job ends",
        blocks: [
          { p: "A job that is completed, cancelled or archived keeps its room, with every message, under **Finished jobs**, and the header says **This job is finished. The room is kept for the record.** No new room is made for a finished job. That is deliberate: *what did we agree about the Nguyen kitchen* is still answerable in March." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Only in FieldQuo",
        blocks: [
          { p: "A crew chat whose job rooms follow the schedule is not listed on the pricing page of Jobber, Housecall Pro, ServiceTitan, QuoteIQ or Projul at any tier — the test FieldQuo's comparison pages apply. Nothing in it leaves the company: FieldQuo's own staff never see a customer's chat, and a support session viewing your account read-only can read it and cannot post." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Every access level has the **Chat** row and **#general**. A job room is visible to its members only — the crew booked on the job's visits, and the owner, administrators, Dispatchers and Managers. A **Crew** member sees the rooms of the jobs they are on, which is the same rule that decides which jobs they see." },
        ],
      },
    ],
    faq: [
      { q: "Can I add the electrician to a job room?", a: "Only if they are on your team and booked on a visit. There is no guest access, and subcontractors are not members of your company." },
      { q: "Why is there no room for this job?", a: "It is Needs a date, or it has no visits, or it is archived. Rooms exist for scheduled and in-progress jobs with at least one visit." },
      { q: "Can I delete a room or a message?", a: "No. Rooms follow the job, and messages stay as the record." },
    ],
  },

  "supervisor-required-visits": {
    title: "Visits that need a supervisor",
    summary:
      "A tick on an appointment that says a senior person must be on site — and refuses to let it be assigned to anyone else until one is.",
    updated: "2026-09-12",
    intro: [
      "Some visits should not be done by a helper alone: a first assessment of a big job, a final walk-through, a client who asked for the boss. When you book an appointment on the **Calendar**, one checkbox — **Requires a senior supervisor on site** — turns that into a rule the product enforces rather than a note somebody may read.",
      "This is a setting on an appointment booked from the Calendar. A visit booked from a job page carries no such flag.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "An appointment with the flag shows an amber **Supervisor required** badge on its row, whoever it is assigned to. While nobody is assigned, its status is **Supervisor required** rather than **Scheduled**, and the **Supervisor required** chip at the top of the Calendar counts it. Assign a supervisor and the status becomes **Scheduled** on its own." },
        ],
      },
      {
        id: "how-to",
        heading: "How to book one",
        blocks: [
          { steps: [
            "Open **Calendar** and press **New Appointment**.",
            "Fill in the client, the time and the **Location**.",
            "Tick **Requires a senior supervisor on site**.",
            "Under **Assign to**, pick a person. Anyone who is not a supervisor is listed with *(not a supervisor)* after their name, and the server refuses them: **This appointment requires a supervisor or admin to be assigned.** Or leave it **Unassigned** and assign later.",
          ] },
          { figure: "live:app-appointments", caption: "Calendar — the status chips with their counts, the month grid, and the appointment rows with who is assigned." },
        ],
      },
      {
        id: "what-the-flag-changes",
        heading: "What the flag changes",
        blocks: [
          { table: {
            head: ["What changes", "Ordinary appointment", "Supervisor required"],
            rows: [
              ["Who may be assigned", "Anyone on the team.", "Only the owner, an administrator, or someone at the Dispatcher or Manager level."],
              ["Status while unassigned", "**Scheduled**", "**Supervisor required**, in amber, until a supervisor is assigned."],
              ["**Assign to me**", "Shown to a crew member on an unassigned row.", "Not shown — the server would refuse the claim, so the button is not offered."],
              ["Appointment reminders", "Sent on the company's lead time.", "Not sent while the status is still **Supervisor required** — see [[appointment-reminders|Appointment reminders]]."],
              ["Booking-page availability", "Counted as booked time.", "Counted as booked time as well."],
            ],
          } },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can do it",
        blocks: [
          { p: "Anyone who can create an appointment can tick the box. Assigning an appointment to somebody else — flagged or not — needs the owner, an administrator, or the **Dispatcher** or **Manager** level; a crew member can create an unassigned appointment or claim an ordinary one for themselves. The reassign rule and the supervisor rule are both checked again on the server, so the dropdown's *(not a supervisor)* hint is a courtesy, not the boundary." },
        ],
      },
    ],
    faq: [
      { q: "Can I set this on a job visit?", a: "No. The checkbox is on appointments booked from the Calendar. A visit booked from the job page has no supervisor flag; assign the visit to the person you want there." },
      { q: "Why did the client not get a reminder?", a: "Reminders go out only for appointments in Scheduled status. One still waiting on a supervisor is Supervisor required until somebody is assigned." },
      { q: "Can I turn the flag off afterwards?", a: "The checkbox is on the booking form; the row itself does not offer a toggle. Assigning a supervisor is what clears the amber status." },
    ],
  },
};
