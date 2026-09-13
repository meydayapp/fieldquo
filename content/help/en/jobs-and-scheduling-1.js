// content/help/en/jobs-and-scheduling-1.js
//
// Part 1 of the “jobs-and-scheduling” category in en (see the composer,
// jobs-and-scheduling.js). Slugs assigned to this part (lib/help/tree.js):
// the-jobs-list, create-a-job, the-job-page, visits-and-appointments,
// the-appointments-calendar, book-a-visit-for-a-client,
// arrival-windows-and-travel-buffer, appointment-reminders,
// the-on-my-way-text, clients-rescheduling-and-cancelling.
//
// Every sentence was read off the page modules and the routes they call:
// app/app/jobs/**, app/app/appointments/page.js, app/api/jobs/**,
// app/api/appointments/**, lib/jobs/*, lib/booking/*, lib/sms/*,
// app/api/cron/appointment-reminders and app/visit/[token]. Labels are the
// `en` block of app/i18n/appMessages.js; a handful of screen words that are
// still English literals in the code (the visit form, four card headings) are
// quoted as the screen shows them.
export const ARTICLES = {
  "the-jobs-list": {
    title: "The Jobs list",
    summary:
      "Every job in your company on one screen — filtered by status, searched by title or client, with the archive kept behind its own toggle.",
    updated: "2026-09-12",
    intro: [
      "**Jobs** is the list of work your company has agreed to do: every job, newest first, with its status, its client and how many visits are on it. Most jobs arrive here on their own the moment a client approves a quote; the rest you start by hand with **New Job**.",
      "The list is where the office answers “what still needs a date?” and where a crew member finds the address they are driving to. What each of those people sees depends on their access level — the same list, narrowed.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A job is scheduled work at a client's address. It sits between the quote (what was agreed) and the invoice (what gets billed): approve a quote and a job appears in **Needs a date**; schedule it, do it, mark it **Completed**, and the invoice and the review request follow — see [[when-a-job-is-completed|When a job is completed]]." },
          { p: "The list itself holds no details. Every row opens [[the-job-page|the job page]], which is where visits, materials, photos, notes and costing live." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Jobs — Scheduled and in-progress work.** At the top right, **Past jobs** (history from your old system — see [[import-past-jobs|Import past jobs from your old system]]) and **New Job**.",
            "Status chips: **All**, **Needs a date**, **Scheduled**, **In progress**, **Completed**, **Cancelled**. One is active at a time.",
            "After a divider, the **Archived** toggle. It is not a status: it swaps the list for the jobs you have filed away.",
            "**Search jobs...** — matches the job title or the client's name as you type.",
            "One row per job: the title, a status badge, a **Recurring** badge on a job that repeats, the client's name, and “3 visits” once visits are booked on it.",
            "An empty list says why it is empty. A filter or search with no match reads **No jobs in this view.**; a brand-new company is told that jobs are created automatically when a quote is accepted; a crew member with nothing assigned reads **You're not on any jobs right now.**",
          ] },
          { figure: "live:app-jobs", caption: "Jobs — the status chips, the Archived toggle, search, and a job fresh off an accepted quote sitting in Needs a date." },
        ],
      },
      {
        id: "find-a-job",
        heading: "How to find a job",
        blocks: [
          { steps: [
            "Open **Jobs** in the sidebar, under Work.",
            "Press a status chip to narrow the list. **Needs a date** is the one to clear every morning: a job there has no visit and no work dates yet.",
            "Type part of the title or the client's name into **Search jobs...**; the list filters as you type, inside the chip you picked.",
            "Press the row. The job page opens; **Back to jobs** brings you here again.",
          ] },
          { tip: "A job you cannot find under any chip is probably archived. Press **Archived**: that drawer is separate from the status chips, so a job can be Completed and archived at the same time." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["Status chips", "Filter the loaded list by status. They change nothing on the job itself — the status is changed on the job page."],
              ["Archived", "Loads the archived jobs instead of the live ones. Nothing is shown from both drawers at once. A job is archived or restored from its own page."],
              ["Search jobs...", "Narrows by title or client name. Cleared when you delete the text."],
              ["New Job", "Opens the job form — see [[create-a-job|Create a job]]. Shown only to people whose access allows creating jobs."],
              ["Past jobs", "Opens the past-jobs import. Same access rule as New Job."],
              ["A row", "Opens the job page. Rows are ordered newest job first, whatever the status."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Jobs** row appears for anyone whose Jobs access is at least **View only**; somebody set to **No access** has no row and the page refuses them. The Crew preset sits at View only, scoped: a crew member sees only the jobs that have a visit assigned to them, and a job with no visit yet is nobody's and does not appear. Estimators see every job but cannot create or change one. Dispatchers create and edit; Managers, administrators and the owner can also delete. The presets are described in [[access-levels-overview|Access levels: who sees what]]." },
          { note: "Hiding the button is not the rule — the server checks the same access on every request. A person who reaches the New Job form through an old bookmark without the right level reads **Your access level lets you view jobs, not create them.**" },
        ],
      },
    ],
    faq: [
      { q: "Why is a job missing for my crew member?", a: "A crew member only sees jobs with a visit assigned to them. Book a visit on the job with their name on it and it appears in their list immediately." },
      { q: "Does the Archived toggle mean cancelled?", a: "No. Cancelled is a status; archived is whether you still want to see the job. A finished job you file away stays Completed, and Restore on the job page brings it back to the live list." },
      { q: "Can I sort or export the list?", a: "Not from this screen. The order is fixed, newest first, and there is no export here — past-job history goes the other way, into FieldQuo, through Past jobs." },
    ],
  },

  "create-a-job": {
    title: "Create a job",
    summary:
      "Where jobs come from — an approved quote, an invoice, or the New Job form — and what each field on the form does.",
    updated: "2026-09-12",
    intro: [
      "You rarely need to create a job by hand. The moment a client approves a quote, FieldQuo creates the job for them in **Needs a date**, one job per quote, with the client and the quote already attached. The **New Job** form is for the rest: work agreed on the phone, a warranty return, a client who never had a quote.",
      "This article covers all three doors and every field on the form.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A job needs two things to exist: a client and a title. Everything else — the site address, whether it repeats, whether it is a callback — is optional, and the date is deliberately not on this form. A new job lands in **Needs a date** and gets its date on the job page, either by booking a visit or by setting the work's own start and end. See [[the-job-page|The job page]]." },
          { p: "The three ways a job is created: automatically from an approved quote ([[convert-a-quote-to-a-job|What happens when a quote is approved]]); from an invoice that has no job behind it yet, with **Create the job** in the invoice's **The job** panel; and by hand with **New Job**." },
        ],
      },
      {
        id: "by-hand",
        heading: "How to create a job by hand",
        blocks: [
          { steps: [
            "Open **Jobs** and press **New Job**.",
            "Under **Client**, search and pick the client. If they are not there yet, **Add one** opens the client form; a job cannot be saved without a client.",
            "Type a **Job title** — the placeholder suggests “Kitchen cabinet refinishing”.",
            "Fill **Site address** only if the work happens somewhere other than the client's own address. Blank means the client's address, and the address is used to say how far from the site the crew was when they clocked in.",
            "Tick **This is a recurring job** if the work repeats and pick **Weekly**, **Every 2 weeks** or **Monthly** under **Recurrence**. The tick cannot be saved without a frequency.",
            "Press **Create Job**. The job page opens, in **Needs a date**.",
          ] },
          { figure: "create:app-jobs-create", caption: "New Job — the client picker, the title, the optional site address and the recurring tick." },
          { note: "A job started from a client's page arrives with the client already chosen. A job started with **Log a callback job** from another job arrives titled “Callback: …” and asks **Why are you going back?** before it will save." },
        ],
      },
      {
        id: "the-fields",
        heading: "What each field does",
        blocks: [
          { table: {
            head: ["Field", "What it changes"],
            rows: [
              ["Client", "Required. The job carries the client's name, phone, email and address onto the job page and onto every visit."],
              ["Job title", "Required. It is what the list, the calendar and the job's chat room show."],
              ["Site address", "Optional. When set, FieldQuo places it on a map so clock-ins and the On my way / Mark complete taps can say how far from the site the person was. If the address cannot be placed, the job page says so and asks you to check it."],
              ["This is a recurring job + Recurrence", "Marks the job **Recurring** and, once a first visit exists, keeps exactly one upcoming visit on the calendar at that rhythm — see [[recurring-jobs|Recurring jobs]]."],
              ["Why are you going back?", "Only on a callback job. Required, from a fixed list of reasons; the callback counts toward the rework/callback rate on the KPI dashboard and is linked from the original job."],
            ],
          } },
        ],
      },
      {
        id: "who-can-create",
        heading: "Who can create a job",
        blocks: [
          { p: "Creating a job needs Jobs access of **View, create, and edit** or higher — the Dispatcher and Manager presets, administrators and the owner. Estimators and Crew see the list but not the **New Job** button, and the form itself refuses them with **Your access level lets you view jobs, not create them.** The same level gates **Create the job** on an invoice." },
        ],
      },
    ],
    faq: [
      { q: "Do I have to create a job when a quote is approved?", a: "No. FieldQuo does it for you, once per quote, and it shows in Needs a date. Creating another by hand would give you two jobs for one quote." },
      { q: "Where do I put the date?", a: "On the job page. Either Schedule a visit (a trip to the site with a person on it) or Set dates (the work's own start and end). Either one moves the job from Needs a date to Scheduled." },
      { q: "Can I attach a quote to a job I created by hand?", a: "Not from the form — the quote link is set when the job is created from the quote. Start from the quote if you need the link." },
    ],
  },

  "the-job-page": {
    title: "The job page",
    summary:
      "Everything about one job on one page: status, dates, the client, costing, materials, to-dos, documents, the daily log, visits and the photo record.",
    updated: "2026-09-12",
    intro: [
      "The job page is built for the person standing in the driveway: who, where, when, and what is left. It is also where the office changes the job's status, books visits, and reads what the job has cost. The order of the cards is deliberate — what you need before setting off comes first, the work itself in the middle, the evidence at the end.",
      "Not every card shows for everybody. Several hide themselves when there is nothing in them, and the costing card shows only to people with the Job costing switch.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Open any row in **Jobs** and you land here. The title and a status badge are at the top, with “From quote Q-2026-0003” under them when the job came from a quote, an **Archived** badge when it is filed away, and **Entered as a past job on … — no messages were sent.** on a job imported from your old system." },
        ],
      },
      {
        id: "top-of-the-page",
        heading: "The controls at the top",
        blocks: [
          { bullets: [
            "**Status** dropdown — **Needs a date**, **Scheduled**, **In progress**, **Completed**, **Cancelled**. Moving to Completed stamps the completion time, raises two to-dos (“Ask … for a review” and “Review what … actually cost”) and, if review requests are switched on, starts the clock on the automatic review request — see [[when-a-job-is-completed|When a job is completed]]. Moving back off Completed clears the stamp.",
            "**Edit** — the **Title**, the **Status**, the **Work dates** (**Start date** and **End date**), the **Site address** and **This job repeats** with **How often**.",
            "**Archive** / **Restore** — files the job away without changing its status; the same button undoes it. See [[cancel-or-archive-a-job|Cancel or archive a job]].",
            "**Delete** — removes the job and its visits for good; the quote and any invoice stay. A job that already carries time entries or to-dos cannot be deleted: the page says what is attached and suggests cancelling instead.",
            "The purple banner **This job needs a date — schedule a visit, or set the work's own start and end dates.**, with **Set dates** and **Schedule a visit**, until the job has one or the other.",
          ] },
        ],
      },
      {
        id: "needs-a-date",
        heading: "Giving the job a date",
        blocks: [
          { p: "A job fresh off a quote has no date. There are two honest ways to give it one, and both switch the status to **Scheduled** on their own: a visit, which is a trip to the address with a date and a person; or the work's own **Start date** and **End date**, for a two-week repaint that has no single trip to hang a date on." },
          { steps: [
            "Press **Schedule a visit** to book a trip — see [[book-a-visit-for-a-client|Book a visit for a client]].",
            "Or press **Set dates**, fill **Start date** and, if you know it, **End date**, then **Save changes**. The page then shows **Work scheduled: Sep 14, 2026 – Sep 25, 2026**, or “no end date yet”.",
            "A visit booked outside those dates is flagged **Outside job dates** — a nudge, never a block, because a pre-job look or a warranty return is often meant to be outside them.",
          ] },
        ],
      },
      {
        id: "the-cards",
        heading: "The cards, top to bottom",
        blocks: [
          { table: {
            head: ["Card", "What it holds"],
            rows: [
              ["Callback banners", "**This job is a callback** with the reason and a link to the original; or **Callback jobs for this one**, listing the returns booked against it."],
              ["Payment schedule", "The stages agreed on the quote and what each has collected. Only when your company uses a payment schedule."],
              ["Client", "**Name**, **Phone** (tap to call), **Address** (tap to open maps), **Email**, and **Site address** when it differs. A crew member on name-and-address access reads **Hidden by your access level** where the phone and email would be."],
              ["What this job has cost", "Quoted against actual — labour, materials, expenses, subcontractors. Only for people with the Job costing switch. See [[job-costing|Job costing: quoted against actual]]."],
              ["Subs on this job", "The subcontractors hired for a fixed price on this job, their agreed amounts and their payments."],
              ["Change orders", "Scope changes agreed after the quote was accepted, logged deliberately rather than inferred from an edit."],
              ["Materials to buy", "The buy list and what has been bought — see [[materials-on-a-job|Materials on a job]]."],
              ["Equipment used", "Which of your own equipment came along."],
              ["To-dos on this job", "The tasks linked to the job — see [[tasks|Tasks]]."],
              ["Documents", "Plans, permits, warranties; a new revision never overwrites the old one."],
              ["Daily log", "What actually happened, one row per day — the visit is what was planned, this is what came of it. See [[job-notes|Notes on a job]]."],
              ["Visits", "Every visit with its date, badge, assignee, checklist count and photo count, the status buttons and the checklist — see below."],
              ["Tasks from the notes", "Reads the client, quote and visit notes and suggests to-dos; nothing is added unless you accept it. See [[suggested-tasks|Suggested tasks]]."],
              ["Photo record and Job photos", "Every photo filed and dated by stage, then the subset curated for your website. See [[job-photos-and-tags|Job photos and tags]]."],
            ],
          } },
        ],
      },
      {
        id: "visits-on-the-job",
        heading: "Visits on the job",
        blocks: [
          { p: "The **Visits** card says “2 of 3 complete” and offers **Add visit** and **Log a callback job**. Each visit shows its date and time, a badge (**Scheduled**, **On the way**, **Completed**, **Cancelled**), “Assigned to Dave” or “Unassigned”, the checklist progress, the photo count, and where the phone was at the tap — **Arrived 12 m from the site**." },
          { bullets: [
            "**On my way** — moves the visit to On the way and texts the client; the line under the buttons says which number the text goes to. See [[the-on-my-way-text|The “On my way” text]].",
            "**Mark complete** — marks the visit done. On a recurring job it puts the next visit on the calendar straight away.",
            "**Cancel visit** — cancels this visit only; the job's own status does not change.",
            "**Reopen** on a completed visit, and **Put it back on** on a cancelled one, return it to Scheduled — a mis-tap on a phone should not be permanent.",
            "The checklist under each visit is the crew's own tickable copy — see [[checklists-on-site|Checklists on site]].",
          ] },
          { note: "The status buttons appear only for the person the visit is assigned to, for anyone on an unassigned visit, and for people whose Schedule access is **Edit everyone's schedule**. Everyone else sees the badge and no buttons — the server refuses the change either way." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see what",
        blocks: [
          { p: "Anyone with Jobs access **View only** or above opens the page; Crew open only the jobs they have a visit on. The **Status** dropdown, **Edit** and **Archive** show at **View, create, and edit**; **Delete** at **View, create, edit, and delete**. The costing card needs the **Job costing** switch, which the Manager preset has and Dispatcher does not." },
          { p: "Booking a visit is a schedule question, not a jobs one: a crew member can add a visit to their own job, but putting somebody else's name on it needs an owner, administrator or supervisor." },
        ],
      },
    ],
    faq: [
      { q: "Why can't my crew change the status?", a: "The Crew preset views jobs; it does not edit them. The status dropdown, Edit and Archive are hidden at that level because the server would refuse them. Crew move their visits — On my way, Mark complete — which is what the page is for on site." },
      { q: "The costing card is missing.", a: "It shows only to people with the Job costing switch on, and it hides itself until something has been recorded against the job. Owners, administrators and the Manager preset have the switch." },
      { q: "What happens when I mark the job Completed?", a: "Two to-dos are raised — ask the client for a review, and review what the job actually cost — the cost review opens itself once, and the automatic review request goes out on its schedule if you have turned it on." },
    ],
  },

  "visits-and-appointments": {
    title: "Visits and appointments",
    summary:
      "The three kinds of entry on your calendar — job visits, appointments and client bookings — what each is for, and what you can do with each.",
    updated: "2026-09-12",
    intro: [
      "The calendar merges three different things and labels each: a **Job visit** is a trip to a job's address, an appointment is a stand-alone booking with a client, and a **Client booking** is a slot a client picked on your public booking page that has not yet become an appointment. They look alike on the day; they behave differently, and knowing which is which saves a phone call.",
      "This article is the map. [[the-appointments-calendar|The Appointments calendar]] walks the screen itself, and [[book-a-visit-for-a-client|Book a visit for a client]] the two forms.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "FieldQuo keeps one row per real thing and reads all three at once, so a visit booked on a job shows on the calendar without a second copy that could drift. The controls differ a little per kind: an appointment and a job visit can be reassigned, moved, cancelled and completed from the calendar (a visit also from its job page); a booking that has not yet become an appointment is moved by the client through their own link." },
        ],
      },
      {
        id: "three-kinds",
        heading: "The three kinds",
        blocks: [
          { table: {
            head: ["Kind", "Where it comes from", "What it belongs to"],
            rows: [
              ["Job visit", "**Add visit** or **Schedule a visit** on a job page; the next visit of a recurring job.", "A job. It carries the crew's checklist, photos, notes and the On my way / Mark complete buttons."],
              ["Appointment", "**New Appointment** on the calendar; a confirmed booking from your booking page; a callback or visit booked by the AI receptionist.", "A client, with no job behind it. It gets the reminder text, as a visit does."],
              ["Client booking", "A confirmed booking from the booking page that has not been turned into an appointment yet.", "The event type the client chose. The client can move or cancel it with the link in their confirmation email."],
            ],
          } },
        ],
      },
      {
        id: "what-the-calendar-shows",
        heading: "What the calendar shows",
        blocks: [
          { p: "Every kind lands on its day in the month grid and in the list under it, sorted by time, with its own badge so nothing pretends to be something it is not." },
          { bullets: [
            "A **Job visit** badge, the job's title under the client's name, the assignee's name and **Open job**.",
            "An appointment: the status badge, a **Booked a visit** / **Callback booked** / **Video call booked** badge when it came through the booking page or the receptionist, **Booked by the AI receptionist** when nobody in the company spoke to the client, and the assignee dropdown.",
            "A **Client booking** badge, the event type's name and the assignee.",
            "On any row, the phone number dials and the address opens maps without opening anything first.",
          ] },
          { figure: "live:app-appointments", caption: "Appointments — the status chips with counts, the month grid, and the list of rows for the month or the selected day." },
        ],
      },
      {
        id: "which-one-to-use",
        heading: "Which one to use",
        blocks: [
          { bullets: [
            "Work at a job's address — a measure, an install day, a warranty return — is a visit on that job. It keeps the job's status honest and gives the crew the checklist and the photo record.",
            "A first look before there is any job — an estimate visit, a callback — is an appointment. It can be reminded by text and reassigned from the calendar.",
            "A client who books from your website or through the receptionist is neither — they made a booking, which becomes an appointment on its own (immediately when the visit is free, once the visit fee is paid otherwise).",
          ] },
          { tip: "If a job already exists, book the visit from the job, not from **New Appointment**. An appointment does not link to a job, and a visit is what makes the job appear in the crew member's Jobs list." },
        ],
      },
      {
        id: "what-each-can-and-cannot-do",
        heading: "What each kind can and cannot do",
        blocks: [
          { p: "An appointment on the calendar and a job visit — on the calendar or on its job page — share one set of buttons: **Reschedule**, **Mark complete**, **Cancel visit**, and afterwards **Reopen** or **Put it back on**. Reschedule is held to the same travel-buffer arithmetic as the client's own link and explains a short gap before offering **Move it anyway**; Cancel visit asks for a reason that stays on the row, and is a status, never a delete. Both dialogs offer to email the client, in the client's language, that the office moved or cancelled it. A booking that came through the booking page moves and cancels with its appointment; one that has not become an appointment yet is moved by the client through their own link — see [[clients-rescheduling-and-cancelling|When a client reschedules or cancels]]." },
          { note: "Appointment reminders go out for appointments and job visits alike, once each, at the lead time set under Settings → Notifications. The crew's **On my way** button is the visit's second heads-up, at the moment they leave." },
        ],
      },
    ],
    faq: [
      { q: "Does a job visit get a reminder text?", a: "Yes — the reminder reads job visits as well as appointments: same wording, same lead time, same STOP check, never twice. A visit already completed or cancelled gets none. The crew's On my way tap is a second text, at the moment it matters." },
      { q: "Can I turn an appointment into a job?", a: "Not with a button. Create the job (or let the approved quote create it) and book a visit on it; the appointment stays on the calendar as its own row." },
      { q: "A Client booking row has no Open job link.", a: "Right — a booking belongs to an event type and a client, not to a job. It becomes an appointment on its own; it never becomes a job visit." },
    ],
  },

  "the-appointments-calendar": {
    title: "The Appointments calendar",
    summary:
      "The Calendar screen: status chips with counts, the month grid, every row with its badges, the drive between stops, who is assigned, and your team's next two weeks.",
    updated: "2026-09-12",
    intro: [
      "**Calendar** in the sidebar opens **Appointments — In-person visits and site assignments.** It is the one place to ask “what is happening this week?”: job visits, appointments and client bookings all appear, each on its day, each labelled.",
      "The screen has three parts — the chips, the grid, the list — and a fourth, **Your team**, for people who run a crew.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Nothing is booked from the grid itself. You read it, pick a day to narrow the list, then act on the rows: call, navigate, assign, move, cancel or complete, open the job. Booking happens through **New Appointment** or from a job page — see [[book-a-visit-for-a-client|Book a visit for a client]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**New Appointment** at the top right.",
            "Chips **All**, **Scheduled**, **Supervisor required**, **Completed**, **Cancelled**, each with a count of the rows it would show. The count appears only once the list has loaded — a chip never says 0 over a request that has not answered.",
            "The month header with **Previous**, **Today** and **Next**. The week starts on the day set under **Company Settings → First day of the week** — Sunday unless you changed it.",
            "Seven columns at every width. Today is ringed. Above phone width a day shows up to two chips (time and client) and “+1” for the rest; on a phone it shows dots.",
            "Press a day to show only that day's rows; the date and **Clear** appear above the list. Press the day again to clear it.",
            "The list: one card per entry, expandable, then **Your team** underneath.",
          ] },
          { figure: "live:app-appointments", caption: "Appointments — chips with counts, the month grid ringing today, and under it the rows for the month." },
        ],
      },
      {
        id: "reading-a-row",
        heading: "Reading a row",
        blocks: [
          { p: "Each card leads with the client's name and a status badge — **Scheduled**, **Supervisor required**, **Completed**, **Cancelled**, and for other kinds **Confirmed**, **Awaiting payment**, **On the way**. Then the kind badge, the time (and the end time when a booking carries one), and a phone number and address that work as links. Press the card to open the details." },
          { bullets: [
            "**Job visit** — the job's title, the assignee's name, and **Open job**. Its notes and checklist are edited on the job; moving, cancelling and completing it work from here too.",
            "**Client booking** — the event type and the assignee. Moved by the client through their own link.",
            "**Supervisor required** — this appointment must be assigned to an owner, administrator or supervisor.",
            "**Booked by the AI receptionist** — nobody in the company spoke to this client; the caller's own words are in the notes.",
            "**Booked a visit** / **Callback booked** / **Video call booked** — how the client asked to meet. A callback has no address by design.",
            "Details: **Phone**, **Email**, **Location**, **Address** (when the client's own address differs from the site), **Notes**, and **Open client**. A field hidden by your access level says so rather than reading as empty.",
          ] },
        ],
      },
      {
        id: "drives-between-stops",
        heading: "The drive between stops",
        blocks: [
          { p: "Above a row you may see “about 25 min drive · 40 min gap”, or in amber “about 25 min drive · 20 min gap · 5 min short”. It is the straight-line estimate between one assignee's consecutive stops on the same day, shown only when both stops have coordinates. The verdict — tight or not — is given only when the earlier stop has an end time, which a booking has and a hand-made appointment does not." },
          { note: "It is an estimate, and it says so — a road factor over the crow's flight, not a live route. The real travel check on the slots clients can book uses the same maths with Google's driving time on top; see [[arrival-windows-and-travel-buffer|Arrival windows and travel buffer]]." },
        ],
      },
      {
        id: "assign-someone",
        heading: "How to assign an appointment",
        blocks: [
          { steps: [
            "Find the row. On an appointment, the dropdown at the right reads **Unassigned** or a name.",
            "Pick the person. On a **Supervisor required** appointment, names that are not supervisors are marked “(not a supervisor)” and the server refuses them.",
            "The row updates at once, and a Supervisor required appointment that just got a supervisor becomes **Scheduled**.",
          ] },
          { warning: "Only owners, administrators and supervisors (the Dispatcher and Manager presets) get the dropdown. Everyone else sees the name, plus **Assign to me** on an unassigned appointment that does not need a supervisor — the one assignment they are allowed to make." },
        ],
      },
      {
        id: "move-cancel-or-complete",
        heading: "How to move, cancel or complete an entry",
        blocks: [
          { p: "Under an appointment or a job visit you may act on, the row carries **Reschedule**, **Mark complete** and **Cancel visit** — and on a finished or cancelled one, **Reopen** or **Put it back on**. A **Client booking** that has not become an appointment yet has none of these; the client moves it through their link." },
          { steps: [
            "Press **Reschedule**. Under **New date and time**, pick when. The tick **Email … about the change** is on when the client has an address on file — the dialog says plainly when there is none — and the letter goes in the client's language, saying the office moved it.",
            "Press **Move it**. A time in the past, or one that leaves too little for the drive from the stop before or to the stop after — the same travel-buffer check the booking page applies — is refused with the reason, and **Move it anyway** re-sends it when you know better than the estimate.",
            "Press **Cancel visit** to call it off. **Reason (kept on the visit, not sent to the client)** is optional; written, it shows under the row afterwards and is cleared if you put it back on. The same email tick applies, and the client's letter says the office cancelled.",
            "Press **Mark complete** when it is done, **Reopen** to undo that, or **Put it back on** to reinstate a cancelled one. Cancelling is a status, never a delete — the row stays.",
          ] },
          { note: "The buttons appear on the same terms the routes enforce: an appointment to its assignee or to Schedule at **Edit everyone's schedule**; a visit to its assignee, to anyone when it is unassigned, or to that same level. A booking behind an appointment moves and is cancelled with it, so the slot on your booking page follows." },
        ],
      },
      {
        id: "who-sees-what",
        heading: "Who sees what",
        blocks: [
          { table: {
            head: ["Access", "What the calendar shows"],
            rows: [
              ["Schedule at **Edit everyone's schedule** or above — Dispatcher, Manager, administrator, owner", "Every appointment, every visit and every booking in the company, plus **Your team** underneath."],
              ["Estimator", "Their own and unassigned appointments; their own visits and unassigned visits; bookings on their own event types. No **Your team** section."],
              ["Crew", "Their own and unassigned appointments; their own visits, and unassigned visits on the jobs they are on; bookings on their own event types."],
              ["Everyone", "The **New Appointment** button — creating an appointment for yourself or unassigned is allowed at every level; assigning it to somebody else is not."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "Why does the grid start on Sunday?", a: "The first day of the week is a company setting under Company Settings. Change it there and the grid follows." },
      { q: "Can I move an appointment by dragging it?", a: "Not by dragging. Press **Reschedule** on the row — an appointment or a job visit — and pick the new time; the travel check says if it is too tight. A client booking that has not become an appointment yet is moved by the client through their link." },
      { q: "Where is Your team?", a: "It shows under the list for people who can see the whole team's schedule — Dispatcher, Manager, administrator and owner — and lists what each person has booked over the next two weeks. See [[the-team-schedule|The Team Schedule]]." },
    ],
  },

  "book-a-visit-for-a-client": {
    title: "Book a visit for a client",
    summary:
      "The two forms — Add visit on a job, and New Appointment on the calendar — step by step, with what each field does and who may fill it in.",
    updated: "2026-09-12",
    intro: [
      "There are two ways to put a client on the calendar yourself, and the difference is whether a job exists. If it does, book a **visit** on the job: it carries the crew's checklist and photos, and it is what makes the job appear in the crew member's list. If there is no job yet — a first look, a callback — book an **appointment** from the calendar.",
      "A third way needs nothing from you: the client books a slot on your booking page, and it lands on the calendar on its own.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Both forms ask for the same core — when, and who is going — and differ in what surrounds it. The visit form adds notes for the crew and a checklist; the appointment form adds the site address and the supervisor tick. Neither asks for a price: nothing about money is decided when a visit is booked." },
        ],
      },
      {
        id: "a-visit-on-a-job",
        heading: "How to book a visit on a job",
        blocks: [
          { steps: [
            "Open the job and press **Add visit** in the **Visits** card, or **Schedule a visit** in the purple banner on a job that still needs a date.",
            "Under **When**, pick the date and time. It is required.",
            "Under **Who is going**, pick a team member or leave **Not assigned yet**. An unassigned visit can be claimed and completed by anyone.",
            "Add **Notes for the crew** — “Gate code, where to park, who to ask for”. They show on the visit on the job page.",
            "Tick **This is a return to fix or check something from earlier on this job** if that is what it is; it then asks **Why are you going back?** and counts toward your rework/callback rate unless the reason is “not our fault”.",
            "Under **Checklist**, tick one or more of **Your checklists** or the **Starter lists for your trades** — the crew gets its own tickable copy — then press **Schedule visit**.",
          ] },
          { note: "Booking a visit on a job in **Needs a date** moves the job to **Scheduled** on its own, and puts the assignee in the job's chat room — see [[a-chat-room-for-every-job|A chat room for every job]]." },
        ],
      },
      {
        id: "a-standalone-appointment",
        heading: "How to book an appointment",
        blocks: [
          { steps: [
            "Open **Calendar** and press **New Appointment**.",
            "Type the **Client name**. FieldQuo looks for an existing client with that exact name and uses them; otherwise it creates a new client with that name, which needs client-editing access.",
            "Pick **Date & time**.",
            "Type the **Location** — the site address. A callback has none.",
            "Tick **Requires a senior supervisor on site** when only an owner, administrator or supervisor may take it. Left unassigned, the appointment shows as **Supervisor required** until a supervisor is put on it.",
            "Under **Assign to**, pick a person or leave **Unassigned**, then press **Create Appointment**.",
          ] },
          { figure: "create:app-appointments-create", caption: "New Appointment — client name, date and time, location, the supervisor tick and Assign to." },
          { note: "This form creates an appointment, not a job. It sends the client nothing at the moment of booking; the appointment reminder text, if you have turned it on, goes out before the time — see [[appointment-reminders|Appointment reminders]]." },
        ],
      },
      {
        id: "let-the-client-book",
        heading: "Or let the client book",
        blocks: [
          { p: "Your booking page offers the event types you set up under **Settings → Booking Page**, only at times you can actually reach, and takes a visit fee when the event type has one. A confirmed booking becomes an appointment on the calendar, assigned to the person whose calendar it is; the client gets a confirmation email with a link to move or cancel it themselves." },
          { tip: "Share the booking link or embed the calendar on your own site — see [[embed-booking-and-quote-forms|Embed booking and quote forms on any site]] and [[booking-fees-and-visit-deposits|Booking fees and visit deposits]]." },
        ],
      },
      {
        id: "who-can-book",
        heading: "Who can book what",
        blocks: [
          { bullets: [
            "A visit on a job: anyone who can open the job — including Crew on their own jobs — for themselves or unassigned. Putting somebody else's name on it needs an owner, administrator or supervisor.",
            "An appointment: every level can create one for themselves or unassigned; assigning it to another person needs an owner, administrator or supervisor.",
            "A new client from the appointment form: Estimator and above. Crew read **No client named … is on file, and your access level doesn't allow you to add one.**",
            "A supervisor-required appointment can only be assigned to an owner, administrator or supervisor — see [[supervisor-required-visits|Visits that need a supervisor]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can I book two visits on one job?", a: "Yes — as many as the job needs. The Visits card counts them (“1 of 3 complete”) and each has its own date, person and checklist." },
      { q: "Does booking a visit tell the client?", a: "No. Nothing is sent when a visit is booked. The client hears from you when the crew presses On my way, and either kind can get a reminder text if reminders are on. Moving or cancelling one later does offer to email the client." },
      { q: "Why is there no duration on the visit?", a: "A visit has a start and no end. Only a booking made through the booking page carries an end time, which is why the drive-between-stops verdict on the calendar is only given after a booking." },
    ],
  },

  "arrival-windows-and-travel-buffer": {
    title: "Arrival windows and travel buffer",
    summary:
      "Three settings on the Booking Page that decide which times a client can book and what they are told: the travel check, the buffer between jobs, and the arrival window.",
    updated: "2026-09-12",
    intro: [
      "A booking page that sells 5:00 across town and 5:30 on the other side is the worst failure a contractor can have, because the homeowner standing in a driveway at 5:45 has already decided what kind of outfit you are. Two of the settings in this article stop that: the travel check hides times you cannot reach, and the buffer adds the minutes the drive does not include.",
      "The third changes only what the client is told. An exact time is a promise the road breaks; a window — “between 1:45 and 2:15 PM” — is one you can keep.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "All three live on **Settings → Booking Page**, and all three apply only to visits at the client's place — they are hidden entirely when **Visit their place** is not one of your meeting modes. They act on the public booking page, the client's confirmation and the client's manage-my-visit link. Your own calendar always keeps the exact time." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Under **How long is a visit?** you find **How can clients meet you?** (**Visit their place**, **Phone call**, **Video call**), then **Don't offer times you can't drive to** with its switch, **Extra time between jobs** (**None**, **10 min** to **60 min**), **What do you promise the client?** (**Exact time**, **± 15 min**, **± 30 min**, **± 60 min**) with a one-line preview, and the default visit length." },
          { figure: "live:app-settings-booking-page", caption: "Settings → Booking Page — the meeting modes, the travel switch, the buffer chips and the arrival-window chips with their preview." },
        ],
      },
      {
        id: "travel-check",
        heading: "The travel check",
        blocks: [
          { p: "With **Don't offer times you can't drive to** on, a client who types an address is shown only the slots you could reach from your previous appointment: the earlier appointment's end, plus the drive, plus the buffer, must fit before the slot starts. The drive is Google's driving time when FieldQuo has coordinates for both ends and a key, and a straight-line estimate otherwise." },
          { steps: [
            "Open **Settings → Booking Page** and make sure **Visit their place** is selected.",
            "Turn on **Don't offer times you can't drive to**. It is on unless you switched it off.",
            "Pick a chip under **Extra time between jobs** if the drive alone is never enough.",
          ] },
          { note: "The check refuses to guess. When it does not know the drive — no coordinates on one end, the map service down — it hides nothing rather than inventing a travel time, because a silently missing slot is worse than one that needs a phone call. Switched off, every free slot is offered." },
        ],
      },
      {
        id: "the-buffer",
        heading: "Extra time between jobs",
        blocks: [
          { p: "The buffer is added on top of the drive — parking, unloading, writing up the last job. It starts at **None**, because a number guessed on your behalf removes bookable slots you never agreed to give up. It only exists while the travel check is on; switch that off and the buffer chips disappear with it." },
        ],
      },
      {
        id: "the-arrival-window",
        heading: "The arrival window",
        blocks: [
          { p: "Under **What do you promise the client?**, **Exact time** tells them “2:00 PM”; the ± chips widen it either side. The window is capped at two hours in total, and the preview under the chips shows the exact sentence the client would read." },
          { table: {
            head: ["Chip", "What the client is told for a 2:00 PM slot"],
            rows: [
              ["Exact time", "They'll be told 2:00 PM."],
              ["± 15 min", "between 1:45 and 2:15 PM"],
              ["± 30 min", "between 1:30 and 2:30 PM"],
              ["± 60 min", "between 1:00 and 3:00 PM"],
            ],
          } },
          { warning: "Only the client sees the window. The crew's calendar, the team schedule and the office copy of every email keep the exact time — an estimator told “between 1:45 and 2:15” cannot plan a day. The window is never applied to a phone or video call." },
        ],
      },
      {
        id: "where-it-shows",
        heading: "Where each setting shows up",
        blocks: [
          { bullets: [
            "The travel check and the buffer: the slots offered on your booking page, and the slots offered when a client moves a visit through their own link.",
            "The arrival window: the client's booking confirmation email, the client's manage-my-visit page, and the client's copy of the “your visit has moved” email.",
            "Not in the appointment reminder text, which gives the exact time.",
            "Not on the calendar, the job page or the team schedule.",
          ] },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Who can change it",
        blocks: [
          { p: "The Booking Page screen opens for owners, administrators and supervisors — the Dispatcher and Manager presets. Crew and Estimators do not see it; their own bookable hours are on **Availability**, which stays visible to everyone. See [[working-hours-and-bookable-hours|Working hours and bookable hours]]." },
        ],
      },
    ],
    faq: [
      { q: "Why is a slot I know is free not offered?", a: "Usually the travel check: from the previous appointment's end, the drive plus the buffer does not fit before that slot. Either the earlier job runs late in the calendar, or the buffer is generous. Turning the check off shows every free slot." },
      { q: "Does the window change my calendar?", a: "No. Your calendar keeps the exact time; only the client's confirmation and manage page show the window." },
      { q: "Is the drive time exact?", a: "With coordinates on both ends and Google available, it is Google's driving time. Otherwise it is a straight-line estimate with a road factor, and FieldQuo says “about” when that is all it has." },
    ],
  },

  "appointment-reminders": {
    title: "Appointment reminders",
    summary:
      "A text to the client 2, 24 or 48 hours before an appointment or a job visit: how to turn it on, what it says, which entries get one, and what it costs.",
    updated: "2026-09-12",
    intro: [
      "Fewer locked doors: with reminders on, every client with a mobile number gets one text before their appointment or job visit, in their own language, starting with your company name. It is off until an owner or administrator switches it on; the texts themselves are included in your plan, nothing is billed per message.",
      "Reminders go by text message only. There is no email reminder.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The setting is one choice on **Settings → Notifications**: **Off**, **2 hours before**, **24 hours before** or **48 hours before**. FieldQuo checks every hour, so a reminder goes out within the hour after its lead time is reached — a 24-hour reminder for a Tuesday 2:00 PM appointment goes out between 2:00 and 3:00 PM on Monday." },
          { note: "Appointment reminders are marked partial in FieldQuo's own feature list: text only, no email reminder. The wording is editable on **Settings → Client messages**, alongside the “On my way” text." },
        ],
      },
      {
        id: "turn-them-on",
        heading: "How to turn them on",
        blocks: [
          { steps: [
            "Open **Settings → Notifications**.",
            "Find the **Appointment reminders** card — “Text the client a reminder before their appointment or job visit. Sent from your business name; clients can reply STOP to opt out.”",
            "Press **2 hours before**, **24 hours before** or **48 hours before**. It saves as you press it.",
            "To stop, press **Off**. Reminders already sent are not affected; none are sent from then on.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Settings → Notifications — the Appointment reminders card with Off, 2, 24 and 48 hours before." },
        ],
      },
      {
        id: "when-it-goes",
        heading: "When a reminder goes, and when it does not",
        blocks: [
          { p: "Each appointment and each job visit is considered once, and a text goes only when all of the following are true:" },
          { bullets: [
            "It is an **appointment** in status **Scheduled** — booked with **New Appointment**, made from a booking on your booking page, or booked by the AI receptionist — or a **job visit** on a job that is not archived. A **Supervisor required**, completed or cancelled entry gets none.",
            "It is within the next seven days and the lead time has been reached.",
            "The client has a phone number FieldQuo can text.",
            "The client has not opted out of texts or calls — see [[client-consent-and-unsubscribes|Client consent and unsubscribes]].",
            "No reminder has been sent for this entry before. Never more than one per appointment or visit, even if you change the lead time or the entry moves.",
          ] },
        ],
      },
      {
        id: "what-it-says",
        heading: "What it says",
        blocks: [
          { p: "The built-in wording is “Northside Painting: Reminder — your appointment is Tue, Aug 12 at 2:00 PM at 123 Oak St. Reply STOP to opt out.”, with the time in the client's language and your company's time zone, and the place only when the appointment has a location. It exists in eight languages; a client reads the one their record says, or your company's default." },
          { tip: "Make it sound like you on **Settings → Client messages**, with the fields **{company}**, **{when}** and **{location}**. Your wording goes to clients who read your company's language; everyone else gets the built-in wording in theirs. See [[the-on-my-way-text|The “On my way” text]] for how that editor works." },
        ],
      },
      {
        id: "which-appointments",
        heading: "Which entries get a reminder",
        blocks: [
          { p: "Appointments and job visits. A **Job visit** booked on a job gets the same text at the same lead time, with the job's site address (or the client's) as the place; the crew's **On my way** tap is a second heads-up, at the moment they leave. A **Client booking** that has not yet become an appointment does not either — it becomes one as soon as it is confirmed and, if there is a visit fee, paid." },
          { warning: "Reminders are per company, not per person: the lead time applies to every scheduled appointment and visit in the account, whoever it is assigned to." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Who can change it",
        blocks: [
          { p: "**Notifications** is an owner-and-administrator screen. A Manager or Dispatcher does not see it, and the server refuses the change with **Only owners and admins can change reminder settings.**" },
        ],
      },
    ],
    faq: [
      { q: "What does a reminder cost?", a: "Nothing per message — reminders are included in your plan, and the Notifications card says so. They are off until you choose a lead time, so nothing is sent for a company that never opened the setting." },
      { q: "Can I remind by email instead?", a: "No. Reminders are text messages only today." },
      { q: "The client did not get a reminder.", a: "Check that the entry is Scheduled (not Supervisor required, completed or cancelled), that the client has a phone number, that they have not opted out, and that the appointment was still in the future when the hourly run came round — an appointment already inside its lead time is texted on the next run, one that has passed is not." },
    ],
  },

  "the-on-my-way-text": {
    title: "The “On my way” text",
    summary:
      "The text a client gets when the crew taps On my way on a visit: how it is sent, what it says, how to change the wording, and who can.",
    updated: "2026-09-12",
    intro: [
      "The moment a crew member sets off, the client's phone buzzes: “Northside Painting: Dave is on the way, ETA 20 min. To reschedule, call 555-0100.” It is sent by one tap on the visit, it carries your company's name, and it is the one automated text a job visit sends.",
      "Together with the appointment reminder it is one of the two texts your clients receive from FieldQuo, and both are edited on the same screen.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The text is a side effect of a status change. On the job page, each visit has an **On my way** button; pressing it moves the visit to **On the way**, records where the phone was, and texts the client if they have a mobile number and have not opted out. The status saves whether or not the text can be delivered — a texting outage never blocks the crew." },
        ],
      },
      {
        id: "send-it",
        heading: "How to send it",
        blocks: [
          { steps: [
            "Open the job on your phone and find today's visit in the **Visits** card.",
            "Read the line under the buttons. It says **Texts your “on my way” wording to 514-555-0123**, or that the client's number is hidden by your access level (it still sends), or **No mobile on file for this client, so nothing will be sent — the visit just moves.**",
            "Press **On my way**. Your phone may ask for your location once; refusing it does not stop the tap.",
            "The visit's badge reads **On the way** and the text goes out in the background. Press **Mark complete** when you are done.",
          ] },
          { note: "The button says what it does because a stranger's phone buzzes when you press it. A visit in **On the way** offers **Mark complete** and **Cancel visit**, not a second **On my way** — one text per departure." },
        ],
      },
      {
        id: "the-wording",
        heading: "The wording",
        blocks: [
          { p: "**Settings → Client messages** — “The texts your clients get. Leave one alone to use our wording, or make it sound like you.” — has one editor per text that actually sends: **On my way** and **Appointment reminder**. Nothing else is offered, because no other automated text goes out." },
          { figure: "live:app-settings-messages", caption: "Settings → Client messages — the On my way editor with its field chips, the “Your client sees:” preview, Save and Use default." },
          { steps: [
            "Open **Settings → Client messages** and find **On my way**.",
            "Write your message in the box, or press a field chip to add it at the end. The **Your client sees:** preview fills the fields with sample values as you type.",
            "Press **Save**. A message with a field FieldQuo does not know — “Unknown field: {price}. Only the fields above work.” — cannot be saved.",
            "To go back to the built-in wording, press **Use default**.",
          ] },
          { table: {
            head: ["Field", "What it becomes"],
            rows: [
              ["{company}", "Your business name."],
              ["{worker}", "The assigned crew member's name — “Your technician” when the visit is unassigned."],
              ["{name}", "The client's first name."],
              ["{eta}", "Estimated arrival, worked out from where your phone was at the tap to the job's address, with the same travel estimate the booking page uses. No location, or a job that was never placed on the map, and the field comes out empty with the spaces around it tidied."],
              ["{phone}", "Your business phone from Company Settings — the number the built-in wording tells the client to call, since a reply is never read. Empty, and that sentence is dropped."],
            ],
          } },
        ],
      },
      {
        id: "language",
        heading: "Which language the client gets",
        blocks: [
          { p: "The text follows the client's language, like their quote did: the client's own language, or your company's default. Your custom wording goes to clients who read your company's language; a client whose language is different gets FieldQuo's built-in wording in theirs — the same eight languages as their documents. Nothing is machine-translated." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can send it, who can change it",
        blocks: [
          { bullets: [
            "**On my way** appears for the person the visit is assigned to, for anyone on an unassigned visit, and for people whose Schedule access is **Edit everyone's schedule**. A crew member on someone else's visit sees the badge and no buttons.",
            "The client's number is hidden from Crew on the job page, but the text still goes to it — the line under the button says so.",
            "**Client messages** is edited by owners, administrators and supervisors — the Dispatcher and Manager presets.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can the client reply?", a: "Not usefully: FieldQuo has no client texting inbox, and only STOP is read. That is why the built-in wording says to call your business phone rather than inviting a reply — keep **{phone}** in your own wording too." },
      { q: "Is it sent from my own number?", a: "It goes out from the number FieldQuo texts from and begins with your company name, so the client knows who is coming." },
      { q: "Why did the client get English when we work in French?", a: "The client's record says English, or has no language and your company's default is English. Set the language on the client's record; your French wording applies only to clients who read French." },
    ],
  },

  "clients-rescheduling-and-cancelling": {
    title: "When a client reschedules or cancels",
    summary:
      "The link in the booking confirmation lets a client move or cancel their visit themselves — within the notice you set, with the visit fee returned only if your policy says so — and tells you by email.",
    updated: "2026-09-12",
    intro: [
      "Every booking made through your booking page, or by the AI receptionist, comes with a confirmation email that carries a **Change or cancel this visit** link. On that page the client sees when and where, what they can still do, and exactly what happens to any visit fee they paid — all computed from your settings, never from anything the browser sends.",
      "You set two windows and one switch on **Settings → Booking Page**, under **Changes & cancellations**. This article explains what each does and what you receive when a client uses the link.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Two windows, because they answer two different questions. **Notice you need to change or cancel** is how much warning the crew needs: inside it, the day is planned and the van is loaded, so the link stops offering changes and tells the client to call you. **Notice needed to get the fee back** is how much warning the money needs, and it may be longer — “move it up to a day before, but the fee only comes back with two days' notice”. Refunds are off unless you turn them on." },
        ],
      },
      {
        id: "the-link",
        heading: "The client's link",
        blocks: [
          { p: "The link is minted when the booking is confirmed and lives in the confirmation email and in every “your visit has moved” email after it. The page, in the client's language, shows **Your visit** — when (with your arrival window, if you set one), where, the deposit paid — and, under **Need to change something?**, **Change the time** and **Cancel this visit**. When neither is allowed any more, it says why: “Northside Painting asks for at least 24 hours' notice, so this visit can't be changed here any more. Call Northside Painting on … — they can still move it for you.”" },
          { note: "Only bookings have this link. An appointment you booked by hand with **New Appointment** and a visit booked on a job send the client nothing at booking and have no self-serve link; when the office moves or cancels one, the client can be emailed from that dialog. The emails around a booking — confirmed, moved, cancelled — and the manage page are all in the client's language, and a moved or cancelled letter says whether it was as requested or the office's change." },
        ],
      },
      {
        id: "the-rules",
        heading: "The three settings",
        blocks: [
          { table: {
            head: ["Setting", "Default", "What it changes"],
            rows: [
              ["Notice you need to change or cancel", "24 hours", "Inside this many hours before the visit, the client's link no longer offers Change the time or Cancel this visit. Blank or unreadable reads as 24, never as 0."],
              ["Return the visit fee when they cancel in time", "Off", "On, a visit fee paid through FieldQuo is refunded to the client's card automatically when they cancel with enough notice. Off, the cancellation still goes through and the money stays with you."],
              ["Notice needed to get the fee back", "Same as the notice above", "Shown only when the refund switch is on. Set it longer than the change notice to keep a window where the client can still cancel but the fee stays with you; the page warns you when it is shorter."],
            ],
          } },
          { p: "Under the inputs the page prints your policy as the client will experience it — “Clients can cancel or move a visit up to 24 hours before it starts. Inside that, they have to call you.” and “A visit fee they already paid is not returned automatically — the cancellation still goes through, and the money stays with you.” — and reminds you when none of your event types charges a fee yet." },
        ],
      },
      {
        id: "when-they-cancel",
        heading: "When a client cancels",
        blocks: [
          { bullets: [
            "The booking and the appointment it became are both marked **Cancelled**, and the slot is free again on your booking page and your calendar.",
            "If the refund switch is on and the notice was met, the fee is refunded through Stripe to the card they paid with; the page and the emails say so. If the fee was not taken through FieldQuo, nothing can be refunded automatically and both emails say to sort it out together.",
            "The client gets a “Your visit is cancelled” email. You get “A booking was cancelled” at your company email, with the client's name and email, the time, the place, and whether the fee was refunded.",
            "The client's page then reads **Visit cancelled** — “Northside Painting has been told.” A cancelled visit cannot be moved afterwards; the client books again.",
          ] },
        ],
      },
      {
        id: "when-they-move",
        heading: "When a client moves the visit",
        blocks: [
          { bullets: [
            "**Change the time** shows the same slots your booking page would offer — your availability, the event type's length, and the travel check with its buffer — so the new time is one you can reach. A time inside your change notice is refused: “That time doesn't give us enough notice — please pick a later one.”",
            "The booking and its appointment move to the new time. The old slot is free again.",
            "The client's email says the new time (with your arrival window) and the previous one; yours says the exact new time and the old one, and that nothing was charged or refunded.",
            "The visit fee, if any, carries over to the new time. A reminder text already sent for the old time is not sent again.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "How to set your policy",
        blocks: [
          { steps: [
            "Open **Settings → Booking Page** and scroll to **Changes & cancellations**.",
            "Type the hours under **Notice you need to change or cancel**. It saves when you leave the field.",
            "Turn on **Return the visit fee when they cancel in time** if you want refunds to happen on their own; then fill **Notice needed to get the fee back**, or leave it blank to use the same notice.",
            "Read the two sentences under the card — they are the policy the client's page will apply.",
          ] },
          { figure: "live:app-settings-booking-page", caption: "Settings → Booking Page — the Changes & cancellations card: the notice in hours, the refund switch, and the policy printed as the client will read it." },
        ],
      },
      {
        id: "who-can",
        heading: "Who can change it",
        blocks: [
          { p: "Owners, administrators and supervisors — the Dispatcher and Manager presets — open the Booking Page screen; Crew and Estimators do not. The policy is the company's, not the person's: whoever the visit is assigned to, the same notice and the same refund rule apply." },
        ],
      },
    ],
    faq: [
      { q: "The client says the link does not let them cancel.", a: "They are inside your change notice. The page names the notice and your phone number. Agree the change on the phone, then press **Reschedule** or **Cancel visit** on the appointment's row in the calendar: the booking behind it moves or is cancelled with it, and, with the email tick left on, the client is told the office made the change." },
      { q: "Why was the fee not refunded?", a: "Refunds are off unless you turned on Return the visit fee when they cancel in time, and even then only with the notice you set. The client's page and both emails say which applied." },
      { q: "Does the client get the link if I book the appointment myself?", a: "No. The link exists only for bookings made through the booking page or by the AI receptionist. An appointment you create from the calendar sends the client nothing." },
    ],
  },
};
