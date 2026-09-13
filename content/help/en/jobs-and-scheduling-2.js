// content/help/en/jobs-and-scheduling-2.js
//
// Part 2 of the “jobs-and-scheduling” category in English (see the
// composer, jobs-and-scheduling.js). Slugs assigned to this part
// (lib/help/tree.js): recurring-jobs, tasks, suggested-tasks,
// checklists-on-site, job-photos-and-tags, job-notes, work-areas,
// the-scheduler-and-crew-shifts, the-team-schedule, the-time-clock.
//
// Every sentence below was checked against the page module, the API it calls
// and the lib/** rule on 2026-09-12: lib/jobs/recurrence.js and the
// recurring-jobs cron, app/app/tasks + lib/tasks/{completion,autoCreate,
// suggestFromJob}.js, app/app/settings/checklists + lib/jobs/checklistItems.js,
// app/app/settings/job-photo-tags + lib/gallery/{stages,tags}.js,
// lib/jobs/dailyLog.js, app/api/work-areas, app/app/scheduler +
// lib/scheduling/shiftFit.js, app/api/team/schedules, app/app/clock +
// lib/timeclock + lib/geo/distance.js. Screen words come from the `en` block
// of app/i18n/appMessages.js. Access levels come from lib/permissions.js,
// lib/permissions/nav.js and lib/permissions/settingsAccess.js.
export const ARTICLES = {
  "recurring-jobs": {
    title: "Recurring jobs",
    summary:
      "Mark a job as recurring, pick weekly, every two weeks or monthly, and FieldQuo puts the next visit on the calendar by itself — one upcoming visit at a time, until the job is completed or cancelled.",
    updated: "2026-09-12",
    intro: [
      "A biweekly clean, a monthly lawn cut, a seasonal filter change: the same job at the same address, over and over. A recurring job is an ordinary job with one tick and a frequency. Once its first visit is on the calendar, FieldQuo schedules every following visit for you, carrying the same person and the same checklist forward.",
      "The rule is small on purpose: three frequencies, one upcoming visit at a time, and nothing invented. The first visit is always yours to book — FieldQuo continues a series, it never guesses when one should start.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A job carries two things for recurrence: the tick **This is a recurring job** and a **Recurrence** of **Weekly**, **Every 2 weeks** or **Monthly**. Both are on the New Job form and on the job's Edit screen. The Jobs list shows a **Recurring** badge on every job that has the tick." },
          { p: "Recurrence creates visits, nothing else. It does not raise invoices, send anything to the client, or change the job's price. If you want a client billed on a schedule, that is a service plan — see [[service-plans|Service plans (recurring billing)]]." },
        ],
      },
      {
        id: "set-up-a-recurring-job",
        heading: "How to set up a recurring job",
        blocks: [
          { steps: [
            "Open **Jobs → New Job** (or **Edit** on an existing job).",
            "Tick **This is a recurring job**. A **Recurrence** picker appears — choose **Weekly**, **Every 2 weeks** or **Monthly**. The form refuses to save the tick without a frequency, so a job can never read as repeating while nothing is scheduled.",
            "Press **Create Job**, then book the first visit with **Add visit** on the job page. That first date is the anchor every later visit is counted from.",
          ] },
          { figure: "create:app-jobs-create", caption: "Jobs → New Job — the client, the title, the site address and the “This is a recurring job” tick." },
          { note: "Until the first visit exists, nothing is scheduled. FieldQuo continues a series from its last visit; it does not choose a start date for you." },
        ],
      },
      {
        id: "when-the-next-visit-appears",
        heading: "When the next visit appears",
        blocks: [
          { p: "A recurring job always has exactly one upcoming visit. The next one is created at two moments:" },
          { bullets: [
            "**The moment a visit is marked Completed.** The crew closing today's visit sees next week's already on the calendar.",
            "**Once a night**, as a backstop, for any recurring job whose last visit went by without being marked completed.",
          ] },
          { p: "The next date is counted from the most recent visit and is always in the future. A job left idle for months gets its next future slot, not a pile of backdated visits nobody will drive to. Monthly stays on the same day of the month; a visit on the 31st lands on the last day of a shorter month rather than skipping it." },
          { p: "The new visit copies the person assigned to the last one and its checklist, so next week's clean is the same clean, by the same person, off the same list — until somebody changes it." },
        ],
      },
      {
        id: "stopping-a-series",
        heading: "Stopping a series",
        blocks: [
          { bullets: [
            "Set the job's status to **Completed** or **Cancelled** — a finished or cancelled job never rolls forward.",
            "Or open **Edit** and untick **This is a recurring job**. Visits already on the calendar stay; no new ones are created.",
          ] },
          { tip: "To skip one visit, press **Cancel visit** on it and leave the job active. A cancelled visit still holds its place — nothing new is created until its date has passed — and the nightly check then counts the next date from it, so the series carries on without the skipped one." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can set it",
        blocks: [
          { p: "Creating a job and editing its recurrence needs the Jobs area at **View, create, and edit** — the Dispatcher and Manager presets, owners and administrators. Estimators and Crew see the job and its **Recurring** badge but cannot change it. Visits created by the series obey the same rules as any other visit." },
        ],
      },
    ],
    faq: [
      { q: "Can I set a recurring job to every three weeks, or twice a week?", a: "No. The three frequencies are Weekly, Every 2 weeks and Monthly. For anything else, book the visits by hand." },
      { q: "Does the client get anything when a new visit is created?", a: "Not from the recurrence itself. Each new visit is an ordinary visit — the On my way text, the checklist and the location stamps work on it exactly as on one you booked by hand." },
      { q: "Why is there no next visit on my recurring job?", a: "Either it has no visit at all yet (book the first one), a future visit already exists (there is only ever one), or the job is Completed or Cancelled." },
    ],
  },

  tasks: {
    title: "Tasks",
    summary:
      "The internal to-do list — chase a deposit, order material, call a client back — sorted by what will hurt most if you leave it, with tasks FieldQuo raises for you at the moments something is owed.",
    updated: "2026-09-12",
    intro: [
      "Tasks are internal reminders for you and your team. A job is scheduled work at a client's address; a task is the office admin around it — the follow-up call, the order to place, the review to ask for. The **To-do** row in the sidebar opens the list.",
      "The list is sorted by urgency rather than grouped by status, because the question people open it with is “what have I let slip”. Overdue tasks sit at the top whatever their priority; a low-priority task two weeks late still needs a decision.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "The heading **Tasks**, a line saying what tasks are, and a count of open tasks. Then one row per task: a tick, the title, a priority chip (**High**, **Urgent** or **Low** — **Normal** shows no chip), a red **overdue** badge when the due date has passed, the description, the **Due** date, who it is assigned to, the client, and a link to the job it belongs to. A task that must have photos shows **0/3 photos**; one that must have a comment shows **Needs a comment**." },
          { figure: "live:app-tasks", caption: "Tasks — the open count, a task FieldQuo raised when a quote was approved, and “Show completed” underneath." },
          { p: "**Show completed** at the bottom reveals finished and cancelled tasks; **Hide completed** puts them away again. Ticking a finished task reopens it." },
        ],
      },
      {
        id: "add-a-task",
        heading: "How to add a task",
        blocks: [
          { steps: [
            "Press **New task**.",
            "Type **What needs doing?** and, if it helps, **Any detail worth keeping (optional)**.",
            "Set **Due**, **Priority** (**Low**, **Normal**, **High**, **Urgent**) and **Assign to** — **Nobody** leaves it for anyone to pick up.",
            "**Link to a job (optional)**. Once a job is picked, two more controls appear: **Requires photos** (a count, up to 20) and **Requires a comment**.",
            "Press **Add task**.",
          ] },
          { figure: "create:app-tasks-create", caption: "Tasks → New task — title, detail, Due, Priority, Assign to and the optional job link." },
          { note: "A photo requirement is only offered once a job is linked, because the photos are filed against that job. The tick on such a task refuses until the photos and the comment exist; you add them from the **To-dos on this job** panel on the job page (**Add a photo**, **Comment**, **Mark done**), not from this list." },
        ],
      },
      {
        id: "tasks-fieldquo-creates",
        heading: "Tasks FieldQuo creates for you",
        blocks: [
          { p: "Four moments in the pipeline leave somebody owing an action, and FieldQuo writes the task itself — once per event, never twice:" },
          { table: {
            head: ["When", "The task", "Priority and due date"],
            rows: [
              ["A client approves a quote", "Schedule the job for {client}", "High, no due date"],
              ["An invoice is sent", "Follow up payment for {invoice number}", "Due in 7 days; resolved by itself when the invoice is paid"],
              ["A job has materials to buy", "Buy materials — {job} · 3 of 10 bought", "High; the count updates as you tick items off, and it closes when everything is bought"],
              ["A job is marked Completed", "Ask {client} for a review, and Review what “{job}” actually cost", "Due in 2 days and 3 days"],
            ],
          } },
          { p: "Each of these links to its job and client. A job entered as a past job raises neither of the two completion tasks." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see what",
        blocks: [
          { bullets: [
            "**New task** appears for owners, administrators and the Dispatcher and Manager presets. Assigning a task to somebody else needs the same level.",
            "Crew and Estimators see the tasks assigned to them, the ones they created and the unassigned ones — and can tick those. They cannot create a task from this screen.",
            "There is no delete control on this screen. A task is ticked done or left open.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Where do tasks show on the job?", a: "Under **To-dos on this job** on the job page, with a Mark done button, the photo upload and the comment box where the task requires them." },
      { q: "Can the job's notes suggest tasks?", a: "Yes — the **Tasks from the notes** panel on the job page reads the client, quote and visit notes and proposes tasks you pick from. See [[suggested-tasks|Suggested tasks]]." },
      { q: "Why is a task I ticked still open?", a: "It requires photos or a comment that are not there yet. The badge on the row says which; add them on the job page." },
    ],
  },

  "suggested-tasks": {
    title: "Suggested tasks",
    summary:
      "The job page reads the client, quote and visit notes and proposes the office to-dos they imply — each one quoting the sentence it came from, and nothing added until you pick it.",
    updated: "2026-09-12",
    intro: [
      "“Back gate is locked, call Mrs. Alvarez the day before.” Somebody wrote that in the notes, and somebody will forget it. The **Tasks from the notes** panel on the job page turns sentences like that into tasks — and shows you the sentence, so you can see why each one was proposed without hunting through the client record and the quote.",
      "It is a button, not an automation. It spends nothing until you press it and writes nothing until you tick a suggestion, because a to-do list that gains five machine-written rows on every job is a to-do list you stop reading.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What it reads, and what it will not invent",
        blocks: [
          { p: "The panel reads three things a person wrote: the client's notes, the quote's notes, and the **Notes for the crew** on the job's visits. The quote's line items are given as context only — a service name on the quote is never turned into a task." },
          { p: "Every suggestion must quote a phrase that is actually in those notes. A suggestion whose quote is not there is dropped before you see it. The AI is told not to add trade knowledge — the trade steps live in [[checklists-on-site|checklists]] — and not to propose “schedule the work” or “order materials” unless the notes raise it. An empty result is a normal result." },
        ],
      },
      {
        id: "use-it",
        heading: "How to use it",
        blocks: [
          { steps: [
            "Open the job. The **Tasks from the notes** panel sits under the visits.",
            "Press **Read the notes**. Up to five suggestions appear, each with a title, the quoted phrase, a priority chip and, when the notes imply timing, **due in N days**.",
            "Tick the ones you want. Nothing is pre-ticked.",
            "Press **Add … to tasks**. Each becomes an ordinary task linked to this job and client, with the source sentence kept in its description. **Dismiss** clears the rest; **Read again** runs it once more.",
          ] },
          { note: "The panel's words are in English on every language's screen today." },
        ],
      },
      {
        id: "what-the-messages-mean",
        heading: "What the messages mean",
        blocks: [
          { table: {
            head: ["Message", "What it means"],
            rows: [
              ["Nothing to read yet — this job has no client notes, quote notes or visit notes.", "Write a note on the client, the quote or a visit first."],
              ["Read the notes on this job. Nothing in them needs a task.", "The notes were read; they imply no action. A finding, not a failure."],
              ["Nothing reliable to suggest from these notes. Nothing was added.", "Every suggestion failed the quote check and was dropped."],
              ["FieldQuo AI isn't switched on for this deployment.", "AI is not configured; the rest of the job page works as normal."],
            ],
          } },
          { p: "Each press uses the company's AI allowance. When it is used up the button says so and nothing is read — see [[ai-credit-and-phone-credit|AI credit and phone credit]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can use it",
        blocks: [
          { p: "Suggesting tasks needs the same level as creating one: owners, administrators, Dispatchers and Managers. It also needs the job itself to be visible to you. A Crew member on the job sees the panel but the button refuses." },
        ],
      },
    ],
    faq: [
      { q: "Does it read the whole client file?", a: "No. Only the client's notes field, the quote's notes and the visits' crew notes on this one job — never another job's, never another company's." },
      { q: "Can I edit a suggestion before adding it?", a: "Not in the panel. Add it, then change the title, due date or assignee on the Tasks screen like any other task." },
    ],
  },

  "checklists-on-site": {
    title: "Checklists on site",
    summary:
      "Write the steps your crew repeats once under Settings → Checklists, put a copy on a visit, and the crew ticks it off on the job page — grouped into Before the work, On the job and Before you leave.",
    updated: "2026-09-12",
    intro: [
      "Mask the counters, photograph before, photograph after, walk the client through it. A checklist is that list written once and stamped onto a visit as a fresh, tickable copy, so nobody relies on remembering. The crew ticks on their phone; the office sees **3/8 checklist items** on the visit.",
      "Nothing is applied to a job on its own. You choose a list when you schedule the visit or add one afterwards, and FieldQuo's starter lists for your trades are offered as suggestions, never stamped on a work order under your name.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "**Settings → Checklists** opens with the line “Standard steps your crew works through on site. Attach one to a job visit and it comes across as a fresh, tickable copy.” and a **New checklist** button. Your own lists follow, each with its phase badge (**Before the work**, **On the job** or **Before you leave**), its step count and its service, with **Edit** and **Delete checklist**." },
          { figure: "live:app-settings-checklists", caption: "Settings → Checklists — “No checklists yet” above the starter checklists written for the trades you have switched on." },
          { p: "Under **Starter checklists for your trades**, FieldQuo lists ready-made lists for the services you have switched on. **Use this** copies one into your own list — a copy, so the first line you change is yours and nothing shared is rewritten." },
        ],
      },
      {
        id: "write-a-checklist",
        heading: "How to write a checklist",
        blocks: [
          { steps: [
            "Press **New checklist**.",
            "Give it a **Name** (the placeholder suggests “Kitchen refinish — day one”) and pick **For which service**, or leave **Any service**.",
            "Choose **When in the visit**: **Before the work** (site prep and materials), **On the job** (the work itself) or **Before you leave** (cleanup and the client walkthrough). A visit groups its checklist under these three headings.",
            "Type the **Steps**, one per line, with **Add step** for more. Press **Create**.",
          ] },
          { figure: "create:app-settings-checklists-create", caption: "Settings → Checklists → New checklist — Name, For which service, When in the visit and the Steps." },
        ],
      },
      {
        id: "put-it-on-a-visit",
        heading: "How it gets onto a visit",
        blocks: [
          { bullets: [
            "**When scheduling.** The **Add visit** form has a **Checklist** section: pick one or more of your lists or starter lists, and the visit gets its own tickable copy.",
            "**Afterwards.** On the job page, under the visit, **Add a checklist** opens the same picker — **Your checklists**, then **Starter lists for your trades**, with a search of the whole library. A list added this way is appended to what is already there, and a step with the same wording is not added twice.",
            "**On a recurring job**, the next visit carries the previous visit's list forward.",
          ] },
          { p: "The crew ticks items on the job page, grouped by phase; each tick saves on its own and the visit's **3/8 checklist items** count moves with it." },
          { note: "The checklist picker on the job page and on the Add visit form is in English on every language's screen today." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What editing and deleting change",
        blocks: [
          { bullets: [
            "**Edit** changes the template only. Visits already carrying a copy keep the copy they have.",
            "**Delete checklist** removes the template and never strips work off a scheduled visit.",
            "**Use this** on a starter list adds it to your own lists; the starter stays available.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Writing, editing and deleting templates is for owners, administrators and the Dispatcher and Manager presets; the **Checklists** row is hidden from everyone else. Ticking on a visit is for the person assigned to it — or anyone with the Schedule area at **Edit everyone's schedule** — and an unassigned visit can be ticked by anyone who can see the job." },
        ],
      },
    ],
    faq: [
      { q: "Why does a new visit have no checklist?", a: "Because none was picked. Applying a list is a choice, not a default — add one from the Add visit form or with Add a checklist on the job page." },
      { q: "Where do the starter lists come from?", a: "FieldQuo writes them per trade and shows only those for the services you have switched on. Take a copy and cut what does not suit you." },
      { q: "Can a checklist item need a photo or a measurement?", a: "A step is a tick. The inspection-style lists in the library show the acceptance criterion, the standard referenced and “Photo expected” beside a step, but there is no box for a reading today — the photo goes on the visit." },
    ],
  },

  "job-photos-and-tags": {
    title: "Job photos and tags",
    summary:
      "Every photo on a job is filed by stage — before, in progress, finished, issue — with your own tags on top; a star puts one on your website, and issue photos never go public.",
    updated: "2026-09-12",
    intro: [
      "A wall of undated photos is a shoebox. Grouped by stage, the same photos become the record of a job — what it looked like when the crew arrived, the work under way, the finished result — and the before and after of one job is what wins a painter the next one.",
      "Two things describe a photo. Its **stage** is fixed product logic: **Before / start**, **In progress**, **Finished** and **Issue / snag** drive the before/after pairing on your website and keep an issue shot off it. **Tags** are your own words — sanding, priming, top coat, demo — layered on top and touching none of that.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Where photos come from",
        blocks: [
          { bullets: [
            "**Uploaded on the job page.** The **Job photos** panel takes up to 12 at a time. They are filed as **In progress** — change the stage on any photo after it lands.",
            "**Texted to your crew line.** A photo sent by text lands on the job with its stage guessed from the words in the message: “all done” files it as finished, “before we start” as start, “leak” or “damage” as issue, anything unclear as in progress. It is a hint you can change, and a texted photo arrives with no tags. See [[the-crew-inbox|The crew inbox]].",
          ] },
          { p: "Anyone who can see the job can add photos, Crew included." },
        ],
      },
      {
        id: "on-the-job-page",
        heading: "What you can do on the job page",
        blocks: [
          { bullets: [
            "**Star** a photo to show it on your website; the panel counts how many are **on your website**. A **Before / start** and a **Finished** photo of the same job become a before/after. An **Issue / snag** photo cannot be starred — the button says so rather than silently doing nothing.",
            "**Change the stage** with the dropdown under the photo.",
            "**Tick tags** under the photo. A retired tag still shows, already ticked, on a photo that had it — it is only no longer offered on new ones.",
            "**Comments** and **Add markup** (drawing on the photo) live on each photo too.",
            "**Photo record** lists every photo dated and grouped by stage, issue photos included, with **Filter by tag** and **Download photo report** — a PDF for a client, an insurer or a dispute.",
          ] },
          { note: "Starring, re-staging, tagging and markup need the Jobs area at **View, create, and edit**. Uploading and commenting work at **View only**, so a Crew member files photos and leaves comments but does not curate." },
        ],
      },
      {
        id: "manage-tags",
        heading: "How to set up tags",
        blocks: [
          { steps: [
            "Open **Settings → Job photo tags** (or **Manage tags** from the job page).",
            "Under **Add a tag**, type a **Tag name**, pick a **Colour** and press **Add tag**.",
            "Or press **Add starter tags** to take the generic set — Demo, Prep, Sanding, Priming, Installing, Top coat, Punch list, Touch-up. Nothing is added until you press it.",
            "Order the list with **Move up** and **Move down**; that is the order the job page offers them in.",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Settings → Job photo tags — the Add a tag form with its colour swatches, and the starter tags underneath." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Retiring a tag",
        blocks: [
          { p: "There is no delete on this screen, on purpose. **Retire** hides a tag from the picker on new photos; every photo that already carries it keeps it, unchanged. **Bring back** puts it in the picker again. A tag named “Issue” behaves exactly like one named “Sanding” — the privacy rule belongs to the stage, and a tag has no way to reach it." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Job photo tags** settings row is for owners, administrators and the Dispatcher and Manager presets. Photos on a job follow the job: a Crew member sees the photos on the jobs they are assigned to." },
        ],
      },
    ],
    faq: [
      { q: "Can a photo leak onto my website by accident?", a: "Only a starred photo appears there, and an Issue / snag photo cannot be starred. The website checks the stage again when it builds the gallery." },
      { q: "Does a tag change what the website shows?", a: "No. Tags are for filtering and for you; the website reads stage and the star only." },
      { q: "Can I delete a photo?", a: "There is no delete control for a job photo today. Re-stage it as Issue / snag to keep it off the website." },
    ],
  },

  "job-notes": {
    title: "Notes on a job",
    summary:
      "Three places words live on a job — the notes for the crew on each visit, the daily log for each day on site, and the client's and quote's notes the job reads — and who can write each.",
    updated: "2026-09-12",
    intro: [
      "The job record itself has no free-text notes box. What a job carries instead is written where it belongs: a brief on the visit for whoever is going, a log for each day the crew was on site, and the notes already on the client and the quote, which the job reads when it suggests tasks.",
      "This article says where each one is, who can write it, and what reads it later.",
    ],
    sections: [
      {
        id: "overview",
        heading: "The three kinds",
        blocks: [
          { table: {
            head: ["Where", "What it is for", "What reads it"],
            rows: [
              ["Notes for the crew, on a visit", "The brief before the trip: gate code, where to park, who to ask for", "Shown under the visit on the job page; read by Tasks from the notes"],
              ["Daily log, one per day on the job", "What happened, who was there, how long, the weather, the delays", "The job page's Recent days; searchable by the office"],
              ["The client's notes and the quote's notes", "What the office knows about the client and the sale", "Read by Tasks from the notes"],
            ],
          } },
        ],
      },
      {
        id: "notes-for-the-crew",
        heading: "Notes for the crew on a visit",
        blocks: [
          { p: "The **Add visit** form has a **Notes for the crew** box — the placeholder reads “Gate code, where to park, who to ask for”. The note appears under the visit's date and status on the job page, where the person going reads it before setting off." },
          { p: "After the visit is created, the note can be changed by the person the visit is assigned to, or by anyone with the Schedule area at **Edit everyone's schedule**. An unassigned visit can be edited by anyone who can see the job." },
        ],
      },
      {
        id: "the-daily-log",
        heading: "The daily log",
        blocks: [
          { p: "The **Daily log** panel on the job page holds one entry per day: **What happened today**, then the optional **Crew on site**, **Hours on site**, **Weather** and **Delays or blockers**. It saves on its own as you type, and **Recent days** lists earlier entries." },
          { steps: [
            "On the job page, open **Daily log**. **Today** is selected; pick **Yesterday** or **Pick a day** to write up a day after the fact — filling yesterday's log at six in the morning is normal and does not create a second Tuesday.",
            "The box starts with what FieldQuo already knows about the day — the photos filed and the to-dos finished — so you add to it rather than retype it.",
            "Type. **Saved** appears when it has landed; **Not saved yet** while it has not.",
          ] },
          { warning: "If two people have the same day open, the second save is refused rather than overwriting the first. The words stay on screen, unsaved, and the person decides. Nothing is merged or lost silently." },
          { p: "Anyone who can see the job can write its daily log, Crew included — they are the ones on site." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can read them",
        blocks: [
          { p: "Reading follows the Jobs area: a Crew member reads the visit notes and daily logs on the jobs they are assigned to and nothing else. The client's own notes are on the client record, which a Crew member does not open. The **Notes** dial in the access grid does not restrict any of these today — who reads a job's notes is decided by the Jobs level." },
        ],
      },
    ],
    faq: [
      { q: "Where do I write a note about the job as a whole?", a: "On the visit if it is for the crew, in the daily log if it is about a day, on the client record if it is about the client. The job record has no notes field of its own." },
      { q: "Can the client see any of this?", a: "No. Visit notes, daily logs and client notes are internal; nothing on this page reaches a quote, an invoice or the portal." },
    ],
  },

  "work-areas": {
    title: "Work areas",
    summary:
      "Named zones — Laval, Montréal island, the North Shore — with a chip per team member; the names also tell your website and your AI receptionist where you work.",
    updated: "2026-09-12",
    intro: [
      "A work area is a named territory or project with the people assigned to it. It answers “whose patch is this”, and its name is reused where the outside world asks where you work: the **Areas we serve** block on your website and what the phone receptionist tells callers.",
      "This article says what a work area does today and, just as plainly, what it does not.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "**Settings → Work Areas** opens with “Group tasks by project or zone. The names you use here also say where you work on your public website and in what your AI receptionist tells callers.”, a **New work area name** box with a plus button, and then one card per area with a chip for every team member. A filled chip means that person is assigned." },
          { figure: "live:app-settings-work-areas", caption: "Settings → Work Areas — the New work area name box, before any area exists." },
        ],
      },
      {
        id: "add-a-work-area",
        heading: "How to add one and assign people",
        blocks: [
          { steps: [
            "Type a name in **New work area name** and press the plus.",
            "On the area's card, tap a person's chip to assign them; tap again to remove them. Each tap saves.",
          ] },
        ],
      },
      {
        id: "what-it-changes",
        heading: "What a work area changes",
        blocks: [
          { bullets: [
            "**Your website.** The **Areas we serve** block lists your work area names, in alphabetical order, never a typed list of towns that goes stale. See [[website-pages-and-blocks|Website pages and blocks]].",
            "**The phone receptionist.** The names are part of what it knows, so it can tell a caller whether you cover their town. See [[the-phone-receptionist|The phone receptionist]].",
            "**The assignment chips** are a record of who is on which zone. Today no other screen reads them — nothing filters jobs, tasks or the calendar by work area, and a job does not carry one.",
          ] },
          { note: "An area cannot be renamed or removed from this screen today. Choose the name as you want it published." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Creating an area and changing who is assigned is for owners, administrators and the Dispatcher and Manager presets, and the settings row shows only for them. Anyone else who opens the page sees a read-only list — “These are the zones you can be assigned to.” — with names instead of buttons." },
        ],
      },
    ],
    faq: [
      { q: "Does a work area change who gets booked?", a: "No. Booking follows each person's bookable hours and the booking page, not their work areas." },
      { q: "Do I have to add work areas for the website to show where I work?", a: "Yes — the Areas we serve block is built only from these names. With none, the block has nothing to show." },
    ],
  },

  "the-scheduler-and-crew-shifts": {
    title: "The Scheduler: draft and publish the crew's week",
    summary:
      "Assign shifts puts a person on a day with a start, an end and a note; shifts stay Draft and invisible to the crew until you press Publish week, and FieldQuo warns when a shift lands outside someone's hours or on approved time off.",
    updated: "2026-09-12",
    intro: [
      "**Assign shifts** in the sidebar opens **Scheduling**: the crew's week as seven day cards, Sunday to Saturday. You draft shifts, move between weeks, and publish once. Until you publish, the crew sees nothing — a half-built week never lands on somebody's phone.",
      "A shift is a person's hours, not a trip to an address. Visits live on the job and the calendar; shifts say who is working when.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "The heading **Scheduling** and the line “Add shifts for the week, then Publish so your team can see them — shifts stay hidden until you publish.” Then **Previous week**, **This week**, **Next week** and the date range; **Add shift**; **Publish week** once a draft exists; and seven day cards, each with a plus, **Today** on the current day and **No shifts scheduled.** when empty. A shift row shows the person, the hours, the note, a **Draft** badge until it is published, and an ✕ for those allowed to delete." },
          { figure: "live:app-scheduler", caption: "Scheduling — the week's seven cards, Add shift, and the amber notice that a team member has no working hours set." },
          { p: "An amber banner names anyone with no working hours: “No working hours set for … Until they have some, nothing flags a shift at an odd hour for them and payroll has nothing to check their logged time against.” **Set their hours** goes straight to their Availability." },
        ],
      },
      {
        id: "add-and-publish",
        heading: "How to draft and publish a week",
        blocks: [
          { steps: [
            "Press **Add shift** (or the plus on a day card).",
            "In **New shift**, pick the **Worker**, the **Date**, **Start** and **End**, and a **Note (optional)** — the placeholder suggests “e.g. site address, what to bring”. There is no job picker on a shift; put the site in the note.",
            "Press **Add to draft**. The shift appears on its day with a **Draft** badge.",
            "Repeat for the week, then press **Publish week**. Every draft shift in the week becomes visible to the people on it.",
          ] },
          { note: "Publishing shows the shifts on each person's own Assign shifts screen — “These are the shifts your manager has published. Check back for changes.” It does not send an email or a text." },
        ],
      },
      {
        id: "what-fieldquo-checks",
        heading: "What FieldQuo checks when you add a shift",
        blocks: [
          { table: {
            head: ["The shift falls…", "What happens"],
            rows: [
              ["Outside the hours the person said they are available", "The form stops: “Check with them before you go ahead — they won't have agreed to this yet.” You can add a reason under **Why?** and press **Schedule anyway**; the shift is then marked **Outside stated availability**, and the person sees that when it is published."],
              ["On approved time off", "Blocked. “Change the date, or amend their time off first.” Approved leave is a decision already made, and there is no override."],
              ["Outside their normal working hours", "Saved, with a warning after **Shift added.** Overtime is not an error."],
              ["On someone with no hours set at all", "Saved. Silence is not a refusal — the banner nudges you to set their hours."],
            ],
          } },
          { p: "Availability, working hours and time off are three different things — see [[working-hours-and-bookable-hours|Working hours and bookable hours]] and [[time-off-requests|Time off requests]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can do what",
        blocks: [
          { bullets: [
            "**Add shift** and **Publish week** need the Schedule area at **Edit everyone's schedule** — Dispatchers, Managers, owners and administrators.",
            "**Deleting a shift** (the ✕) needs **Edit and delete everyone's schedule** — Managers, owners and administrators. A Dispatcher drafts and publishes but does not delete.",
            "**Crew and Estimators** open the same row and see only their own published shifts, with the note that their manager publishes them.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can I unpublish a week?", a: "Not from the screen. Delete the shift that is wrong and add the right one; the new one is Draft until you publish again." },
      { q: "Does a shift put anything on the client's calendar?", a: "No. Shifts are internal. The client is told about visits, never shifts." },
      { q: "Why can I add a shift on a Sunday?", a: "Working hours only warn; they do not block. Only approved time off blocks." },
    ],
  },

  "the-team-schedule": {
    title: "The Team Schedule",
    summary:
      "One page for the whole team: a card per person with their bookable hours Monday to Sunday and what is booked on them in the next two weeks, with an Edit hours button for managers.",
    updated: "2026-09-12",
    intro: [
      "**Team calendar** in the sidebar opens **Team Schedule** — the owner's answer to “who is bookable when”. Everyone is on one page, so a manager fixes anyone's hours from here instead of asking each person to.",
      "It is a read-only overview. Hours are edited on each person's Availability; visits, appointments and shifts are made elsewhere.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "The heading **Team Schedule** and the line “Everyone's weekly availability and what's booked in the next two weeks. People can set their own hours under Settings → Availability, and you can set anyone's from here.” Then a card per person: initials, name and tier (Owner, Administrator, Manager or Worker — in English on every screen), a seven-day strip showing hours such as **08:00–17:00** and **—** on days off, **No availability set** where nothing has been entered, and **Edit hours** or **Set hours**. Under the strip, **Next 2 weeks** lists what they are booked on, by date, time and client." },
          { figure: "harness:team-schedule", caption: "Team Schedule — a card per person, the Mon–Sun strip of bookable hours, Edit hours, and the next two weeks of bookings." },
          { p: "People with hours set come first, then the rest by name. The week starts on the day set in your company preferences." },
        ],
      },
      {
        id: "what-the-strip-shows",
        heading: "What the strip and the list actually show",
        blocks: [
          { bullets: [
            "**The strip is bookable hours** — the window in which clients may book that person, from **Settings → Availability → Bookable hours**. It is not their working hours, and not their shifts.",
            "**Next 2 weeks** lists appointments assigned to that person and bookings made through the booking page, for the next 14 days. Job visits and published shifts are not in this list.",
          ] },
          { note: "An estimator who works 8–4 but takes consultations 2–4 shows **14:00–16:00** here. That is correct: the page answers when clients can book them. See [[working-hours-and-bookable-hours|Working hours and bookable hours]]." },
        ],
      },
      {
        id: "edit-someones-hours",
        heading: "How to set someone's hours from here",
        blocks: [
          { steps: [
            "Press **Edit hours** (or **Set hours**) on their card.",
            "Their Availability page opens with that person selected. Change **Working hours** and **Bookable hours** and save.",
            "Come back: the strip reflects the new bookable hours.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Team calendar** row shows for owners, administrators and the Dispatcher and Manager presets — the people who may see the whole roster. **Edit hours** appears for the same people. Crew and Estimators do not have the row; they set their own hours under **Settings → Availability**." },
        ],
      },
    ],
    faq: [
      { q: "Why is a visit I scheduled not under Next 2 weeks?", a: "The list shows appointments and booking-page bookings. Job visits are on the job and on the Calendar." },
      { q: "Someone shows No availability set — can clients book them?", a: "No. Bookable hours are what the booking page offers; with none, that person is not offered. Press Set hours." },
    ],
  },

  "the-time-clock": {
    title: "The time clock",
    summary:
      "The crew's own punch: clock in against the job they are on, switch jobs mid-day, clock out, and see today's hours — with one position captured at the tap so the timesheet can show how far from the site it was.",
    updated: "2026-09-12",
    intro: [
      "**Time clock** is the one screen an hourly worker touches every shift, so it is kept spare: the date, a live clock, one big button, today's total. Every tap writes a plain time entry that goes to the manager to review on Timesheets — no pay maths happens here.",
      "Each entry can name the job it was worked on, which is what lets job costing know what a job's labour really cost. An hour with no job — travel, the yard, a morning of quoting — is a real hour and is recorded as exactly that.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "The day and the live clock. Under it either **You're clocked out.** with a **Which job?** picker and a green **Clock in**, or an **On the clock** pill with **Since {time}**, the elapsed time, **On {job}**, and a red **Clock out**. While clocked in, **Moved to another job?** offers a second picker and **Switch job**. Below, **Today** totals the day's hours and lists each entry, the running one marked **Open**, with the line “Your hours go to your manager to review and approve.”" },
          { figure: "live:app-clock", caption: "Time clock — clocked out, the Which job? picker on “No job — travel, yard, quoting”, and the Clock in button." },
        ],
      },
      {
        id: "clock-in-and-out",
        heading: "How to clock in, switch and clock out",
        blocks: [
          { steps: [
            "Pick the job under **Which job?**. If you have one visit scheduled today it is already selected (“You're scheduled here today — change it if you're somewhere else.”); with several, pick the one you are starting; with none, choose a job under **Your other open jobs** or leave **No job — travel, yard, quoting**.",
            "Press **Clock in**. If the browser asks where your phone is, that is the one-time position beside this punch — say yes or no; the punch records either way.",
            "Moved sites? Under **Moved to another job?** pick the new job and press **Switch job**. The hours so far stay on the first job and a new entry starts from now.",
            "Press **Clock out** at the end. The entry closes and appears under **Today**.",
          ] },
          { note: "One open entry at a time. Clocking in while already in is refused with “You're already clocked in — clock out first.” A forgotten clock-out is fixed on Timesheets — see [[timesheets-and-approving-hours|Timesheets: review and approve hours]]." },
        ],
      },
      {
        id: "location",
        heading: "What the location stamp is, and is not",
        blocks: [
          { p: "When you tap **Clock in** or **Clock out**, the phone is asked where it is — once, with your permission through the phone's own prompt — and that one position is kept beside the punch. Nothing runs in the background and nothing is tracked between taps; a browser cannot do that, and FieldQuo does not pretend to." },
          { bullets: [
            "On Timesheets the punch shows **On site** when it was within about 250 m of the job's site address, or **2.1 km away** when it was not — a question for the manager, not a verdict.",
            "No position is shown when the phone did not answer, the job has no site address, or the reading was too rough to trust.",
            "Refusing the permission changes nothing about the punch. The answer is remembered for the session; you are not asked again on the next tap.",
          ] },
        ],
      },
      {
        id: "what-happens-to-the-hours",
        heading: "Where the hours go",
        blocks: [
          { bullets: [
            "Every entry is **pending** until a manager approves it on **Timesheets**; approved hours feed payroll.",
            "Hours on a job feed that job's costing as labour. Hours with no job are counted and named as unattributed on the costing panel rather than dropped. See [[job-costing|Job costing: quoted against actual]].",
            "Correcting your own entry sends it back to pending so it is reviewed again.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can use it",
        blocks: [
          { p: "Anyone with a worker record, at every access level — the clock is scoped to the signed-in person and nobody can punch for somebody else. Without a worker record the screen says “You're not set up as a worker yet. Ask an admin to add you under Team.”" },
        ],
      },
    ],
    faq: [
      { q: "Do I need the app?", a: "No. The time clock is a web page that works on whatever phone you have. See [[clock-in-and-out-on-your-phone|Clock in and out on your phone]]." },
      { q: "Does FieldQuo track where I am during the day?", a: "No. It asks for one position at the moment you tap, if you allow it, and nothing in between." },
      { q: "I forgot to clock out yesterday.", a: "The entry is still open. Clock out now, then tell your manager — the hours are corrected on Timesheets before they are approved." },
    ],
  },
};
