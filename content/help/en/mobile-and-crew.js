// content/help/en/mobile-and-crew.js
//
// Articles of the “mobile-and-crew” category in English. Keyed by slug; the
// slugs are listed in lib/help/tree.js and scripts/check-help-centre.mjs
// refuses a module that is missing one or carries one the tree does not.
//
// Every sentence is read from the code: app/components/layout/MobileTabBar.js,
// app/manifest.js, public/sw.js, lib/notify/*, the Crew preset in
// lib/permissions.js, app/app/clock + lib/timeclock + lib/location,
// app/app/scheduler, the job photo routes, lib/crew, app/app/chat,
// app/app/time-off and app/app/safety. There is no native app and no offline
// mode, and the articles say so rather than implying either.
export const ARTICLES = {
  "using-fieldquo-on-your-phone": {
    title: "Using FieldQuo on your phone",
    summary:
      "FieldQuo runs in your phone's browser — no app to download. What the phone layout looks like, how to sign in, and what works from a driveway.",
    updated: "2026-09-12",
    intro: [
      "There is no FieldQuo app in the App Store or on Google Play. The back office you use at a desk is the same one you open on a phone: the pages rearrange themselves below about 1,024 pixels of width, a tab bar appears along the bottom, and everything a crew member does all day — clocking in, checking the schedule, filing a photo, chatting with the office — is built to work with one thumb.",
      "This article is the tour: what the phone layout looks like, how to sign in, and which screens are worth bookmarking. The articles after it go one screen at a time.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "On a phone the sidebar you know from a computer folds away. What replaces it is a sticky bar at the top — the FieldQuo logo, which takes you **Home**, a menu button, and the notification bell with its unread count — and a tab bar at the bottom with the screens you reach for most. Everything else is one tap away behind **More**." },
          { p: "Every tap goes to the server. That is the whole design: nothing is stored on the phone, so a shared phone in the van shows nothing to the next person who picks it up, and the office sees your punch or your photo the moment it lands. The flip side is that a tap with no signal does not go through — see [[bad-connections-and-offline|Bad connections, and why there is no offline mode]]." },
          { note: "The phone layout is the same product with the same permissions. A screen your access level hides on a computer is hidden on a phone too, and a URL you type by hand is refused by the server, not just by the menu." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom, on any page:" },
          { bullets: [
            "**The top bar** — the menu button on the left opens the full menu as a drawer; the FieldQuo logo in the middle goes to the dashboard; the bell on the right shows how many notifications you have not read.",
            "**The page itself** — the same cards as on a computer, stacked in one column. Buttons are sized for a thumb, and the job picker on the time clock is your phone's own picker, not a custom menu.",
            "**The tab bar** — up to five tabs plus **More**. Which tabs you get depends on your access level; a crew member sees **Jobs**, **Chat** and **More**. See [[the-crew-tab-bar|The crew tab bar]].",
            "**The safe area** — on an iPhone the bar sits above the home indicator rather than under it, so the bottom tab is never half covered.",
          ] },
          { figure: "harness:mobile-job", caption: "A job on a phone — the visit with its On my way and Mark complete buttons, the checklist underneath, and the Jobs · Chat · More tab bar." },
        ],
      },
      {
        id: "sign-in",
        heading: "How to sign in on your phone",
        blocks: [
          { steps: [
            "Open the invitation email on your phone and accept it — that is how you join a company; there is no self-serve way to add yourself to one. Your login costs the company nothing at the Crew level.",
            "Set your password. From then on, the login page asks for **Email** and **Password** and the button is **Log In**.",
            "You land on **Home**. Tap the menu button, or a tab, to get where you are going.",
            "Optional but worth doing: add FieldQuo to your home screen so it opens like an app — [[install-it-like-an-app|Install it like an app]].",
          ] },
          { tip: "Stay signed in. FieldQuo does not sign you out between visits, so the home-screen icon opens straight onto your day; if you ever are signed out, the icon opens the login page instead." },
        ],
      },
      {
        id: "what-works-on-a-phone",
        heading: "What works from a phone",
        blocks: [
          { table: {
            head: ["What you need to do", "Where", "Notes"],
            rows: [
              ["Clock in and out, switch job", "**Time clock**", "Your phone is asked where it is once, at the tap — never in the background."],
              ["See your shifts and visits", "**Assign shifts**, **Calendar**, **Jobs**", "Only what is published, and only what you are on."],
              ["Add photos to a job", "The job page, **Job photos**", "From the camera or the camera roll; or text them in without opening anything."],
              ["Talk to the office", "**Chat**", "A room per job, #general for everyone, direct messages."],
              ["Ask for time off", "**Time Off**", "Balances and your requests on one screen."],
              ["Report an incident or a near-miss", "**Safety**", "A short form; add a photo afterwards."],
              ["Read your payslips", "**Payroll**", "Your own only."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can use it",
        blocks: [
          { p: "Everyone with a login. What the menu shows is decided by the access level the owner gave you — Crew, Estimator, Dispatcher, Manager or a custom grid — and the phone layout changes none of it. The rest of this category is written for the Crew level, which is the one most people in a van are on; see [[what-a-crew-member-sees|What a crew member sees]]." },
        ],
      },
    ],
    faq: [
      { q: "Is there an app in the App Store?", a: "No. FieldQuo runs in the phone's browser. You can add it to your home screen so it opens full-screen with its own icon, which is as close to an app as it gets today." },
      { q: "Does it work on an iPad or a small tablet?", a: "Yes. Below about 1,024 pixels of width you get the phone layout with the tab bar; wider than that you get the sidebar, exactly as on a computer." },
      { q: "Does the office see where my phone is?", a: "Only where it was at the moment you tapped Clock in, Clock out, On my way or Mark complete — and only if you allowed it when the phone asked. Nothing runs between taps." },
    ],
  },

  "install-it-like-an-app": {
    title: "Install it like an app",
    summary:
      "Add FieldQuo to your phone's home screen so it opens full-screen with its own icon — and, on an iPhone, so notifications can reach you at all.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo is a web app, and both iPhone and Android can pin a web app to the home screen. Once you do, it opens without the browser's address bar, in portrait, straight onto your dashboard, with the FieldQuo icon beside your other apps. Nothing is downloaded from a store and there is nothing to update — you always get the current version.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The phone reads a small description FieldQuo publishes about itself: the name **FieldQuo**, the icon, the fact that it should open on the back office, and that it should run full-screen and in portrait. That is what makes the browser offer an install option at all." },
          { p: "Installing changes how FieldQuo is opened, not what it can do. It is the same pages talking to the same server; every tap still needs a connection." },
          { warning: "On an iPhone or iPad, add FieldQuo to the home screen before you try to turn notifications on. Safari only delivers notifications to installed web apps — the switch on the Notifications settings page says exactly this." },
        ],
      },
      {
        id: "iphone",
        heading: "On an iPhone or iPad",
        blocks: [
          { steps: [
            "Open FieldQuo in Safari and sign in.",
            "Tap the Share button (the square with an arrow).",
            "Choose Safari's Add to Home Screen option and confirm the name.",
            "Open FieldQuo from the new icon from now on. It opens full-screen, on your dashboard.",
          ] },
        ],
      },
      {
        id: "android",
        heading: "On an Android phone",
        blocks: [
          { steps: [
            "Open FieldQuo in Chrome and sign in.",
            "Open Chrome's menu and choose its install or add-to-home-screen option; some phones also offer it as a banner.",
            "Confirm. The icon appears on the home screen and in the app drawer.",
          ] },
        ],
      },
      {
        id: "what-changes",
        heading: "What changes once it is installed",
        blocks: [
          { bullets: [
            "**It opens on the back office.** The icon goes to your dashboard, not the marketing site. If you are signed out, it opens the login page — the same thing any app does.",
            "**No address bar.** The page has the whole screen. Links still open inside it.",
            "**Notifications become possible on an iPhone.** With the icon installed and the switch turned on, FieldQuo can notify you — see [[push-notifications|Push notifications]].",
            "**Nothing else.** No offline mode, no background location, no faster loading. Those are not things installing gives a web app.",
          ] },
          { note: "You will not be offered an install option on a contractor's own website or on a quote or booking page. Those pages carry the contractor's brand, and FieldQuo deliberately publishes no install description there — a homeowner must never end up with a FieldQuo icon after visiting a painter's site." },
        ],
      },
    ],
    faq: [
      { q: "Do I have to install it?", a: "No. Everything works in the browser tab. Installing is a convenience — and, on an iPhone, the only way to receive notifications." },
      { q: "How do I update it?", a: "You do not. Each time you open it, it loads the current version from the server." },
      { q: "Can I install it on two phones?", a: "Yes. Sign in on each; there is no limit, and each phone decides its own notification switch." },
    ],
  },

  "the-crew-tab-bar": {
    title: "The crew tab bar",
    summary:
      "The bar along the bottom of the phone layout: which tabs it holds, why a crew member sees three, and where everything else went.",
    updated: "2026-09-12",
    intro: [
      "On a phone, the bar along the bottom of the screen is how you move around. It holds the four screens work flows through — **Leads**, **Quotes**, **Jobs**, **Invoices** — plus **Chat**, and a **More** button that opens the full menu. Tabs you cannot use are not drawn, so the bar a crew member sees is shorter than the owner's.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The bar appears whenever the screen is narrower than about 1,024 pixels — every phone, most tablets held upright. The current screen's tab is highlighted; the others show in a muted colour. Above that width the bar disappears and the sidebar takes over." },
          { figure: "harness:mobile-chat", caption: "A job's chat room on a phone, with Chat highlighted in the tab bar and More on the right." },
        ],
      },
      {
        id: "the-tabs",
        heading: "The tabs, and when each one appears",
        blocks: [
          { table: {
            head: ["Tab", "Opens", "Shown when"],
            rows: [
              ["**Leads**", "The leads board", "Your access to Requests is at least View only"],
              ["**Quotes**", "The quotes list", "Your access to Quotes is at least View only"],
              ["**Jobs**", "The jobs list", "Your access to Jobs is at least View only"],
              ["**Invoices**", "The invoices list", "Your access to Invoices is at least View only"],
              ["**Chat**", "The company chat", "Always — as long as the crew chat feature is on for your company"],
              ["**More**", "The full menu, as a drawer", "Always"],
            ],
          } },
          { p: "The same rules hide the same rows in the full menu, and the pages behind them refuse at the same level, so the bar is a shortcut, not the security." },
        ],
      },
      {
        id: "what-a-crew-member-gets",
        heading: "What a crew member gets",
        blocks: [
          { p: "The Crew level is set to No access on Leads, Quotes and Invoices, and to View only on Jobs — narrowed to the jobs you are booked on. So the bar reads **Jobs · Chat · More**, and the three fill the width evenly." },
          { bullets: [
            "**Jobs** — the jobs you have a visit on, with the address, the visits and the checklist.",
            "**Chat** — #general, the room for each job you are on, and direct messages. It is the one tab every level keeps, because the chat is the crew's own screen.",
            "**More** — the time clock, your shifts, time off, safety, your payslips, settings.",
          ] },
        ],
      },
      {
        id: "the-more-drawer",
        heading: "The More drawer",
        blocks: [
          { p: "**More** does not open a second menu. It opens the same drawer the menu button at the top opens — the full menu, grouped exactly as on a computer — so there is one list of screens, not two that could disagree. **Home** is not a tab: the FieldQuo logo in the top bar already takes you there." },
          { tip: "If the bar shows nothing but More, every one of your document categories is set to No access. That is a valid grid, not a fault — everything you can use is in the drawer." },
        ],
      },
    ],
    faq: [
      { q: "Can I choose which tabs are in the bar?", a: "No. The five are fixed — the four document screens and Chat — and your access level decides which of them are drawn." },
      { q: "Why is there no Time clock tab?", a: "The bar is reserved for the screens work moves through and the chat. The time clock is one tap away under More, and the same for everyone regardless of level." },
    ],
  },

  "what-a-crew-member-sees": {
    title: "What a crew member sees",
    summary:
      "The Crew access level from the inside: which menu rows appear, what a job page shows and hides, and why prices are nowhere.",
    updated: "2026-09-12",
    intro: [
      "**Crew** is the access level for the people in the van — installers, helpers, a second painter. It costs the company nothing and it is deliberately narrow: your own schedule, the jobs you are booked on, the clock, time off, safety, your own payslips. No prices anywhere, no quotes, no invoices, no leads, and no customer list.",
      "This article is what that looks like on the phone. It is written from the product's own permission grid, so it says what the menu actually does; if your owner gave you a custom grid, some rows may differ.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The Crew preset writes one level per area: schedule **View and complete their own schedule**; time tracking **View, record, and edit their own**; payroll **View their own payslips**; notes **View notes on jobs and visits only**; clients **View client name and address only**; jobs **View only** (narrowed to jobs you are booked on); requests, quotes and invoices **No access**; safety **Report incidents, and view their own**; and the three money switches off." },
          { note: "Crew is fixed. Pick it and there is no grid to move — raising any dial above the Crew ceiling turns the person into a paid seat. The owner can instead give you a Custom grid, which is a seat." },
        ],
      },
      {
        id: "the-menu",
        heading: "The menu rows you get",
        blocks: [
          { table: {
            head: ["Row", "What it shows a crew member"],
            rows: [
              ["**Home**", "Your upcoming visits and the appointments list. The quotes card and the setup card are not drawn."],
              ["**Jobs**", "Only the jobs you have a visit on."],
              ["**Calendar**", "Appointments assigned to you, unassigned appointments, and visits on your jobs."],
              ["**To-do**", "Tasks assigned to you, tasks you created, and unassigned ones anyone can claim."],
              ["**Chat**", "#general, a room per job you are on, direct messages."],
              ["**Assign shifts**", "Your own published shifts — the title is the manager's; you see your week, read-only."],
              ["**Time clock**", "Your punch, your job, your hours today."],
              ["**Time Off**", "Your balances and requests."],
              ["**Safety**", "Report an incident; see the ones you filed."],
              ["**Payroll**", "Your own payslips."],
            ],
          } },
          { p: "Below the groups: **Help** and **Settings**. Settings keeps three rows for you — **Language**, **Availability** (your own bookable hours) and **Product Updates**. If your company has turned crew texting on, a **Crew inbox** row also appears, showing only the texts you sent in." },
        ],
      },
      {
        id: "on-a-job",
        heading: "On a job page",
        blocks: [
          { bullets: [
            "The client's **name and address**, and the site address. The phone number and email are withheld by your level — the job page says so beside the On my way button, and the client still gets the text.",
            "**Visits**: date and time, who is assigned, the checklist with its hold points, and — on visits assigned to you — **On my way**, **Mark complete** and **Cancel visit**.",
            "**Materials to buy**, as a list with quantities and no prices.",
            "**Job photos** with an upload button, and the **Daily log** you can write and save — see [[photos-from-the-field|Photos from the field]].",
            "The notes on the visit itself. Private notes on the client and the lead's call-back log are not shown.",
          ] },
        ],
      },
      {
        id: "what-is-hidden",
        heading: "What is hidden, and why",
        blocks: [
          { bullets: [
            "**Leads, Quotes, Invoices, Service Plans, Messages** — No access means the row is gone and the page refuses. A crew member never reads a price the client was charged.",
            "**Clients and Client equipment** — the customer list is the company's most portable asset. You get an address on your own work, not the book.",
            "**Team, Team calendar, Timesheets, Expenses, Insights, KPIs, Marketing, Receptionist, Plan, Refer & Earn** — management and money screens; each one's server route refuses below the level that shows the row.",
            "**What this job has cost** and every costing card — the job costing switch is off.",
            "**Editing your own hours** — the permission exists, but the only screen that edits entries is Timesheets, which the Crew level does not open. A forgotten clock-out is fixed by your manager.",
          ] },
        ],
      },
      {
        id: "who-decides",
        heading: "Who decides",
        blocks: [
          { p: "The owner or an administrator sets your level on **Manage Team**; a Manager or Dispatcher can invite you at the Crew level but cannot change an existing person's access. Hiding a row is cosmetic — every page's own server route re-checks the same grid, which is why a screen you were not shown answers with a refusal rather than the page. Full detail: [[role-crew|The Crew level]] and [[access-levels-overview|Access levels: who sees what]]." },
          { tip: "If you need something you cannot see — a client's phone number, a price for a supplier — ask rather than work around it. The owner can move you to a Custom grid in one dropdown." },
        ],
      },
    ],
    faq: [
      { q: "I can see a job but not the client's phone number. Is that a bug?", a: "No. The Crew level shows a client's name and address only. When you tap On my way, the client still gets the text; the number is hidden from you, not missing." },
      { q: "Why is a job I worked on last month gone from my list?", a: "The list shows jobs you have a visit on. If the visit was moved to somebody else, the job leaves your list. Its chat room stays under Finished jobs if the job is done." },
      { q: "Can I log an expense from my phone?", a: "Not today. The Crew level allows recording your own expenses in the permission grid, but the expense screens are management screens the Crew level does not open. Hand receipts to the office." },
    ],
  },

  "clock-in-and-out-on-your-phone": {
    title: "Clock in and out on your phone",
    summary:
      "The time clock: one big button, the job the hours land on, switching jobs mid-day, and what your phone is asked when you tap.",
    updated: "2026-09-12",
    intro: [
      "**Time clock** is the screen an hourly worker touches every shift. It is deliberately spare: the time, one button, the job you are on, and today's hours. Every tap writes a plain time entry on the server; the office reviews it on Timesheets, and only then does it reach a pay run.",
      "The one thing to know before your first tap: when you press **Clock in** or **Clock out**, your phone is asked where it is — once, with the phone's own permission sheet — and that single position is kept beside the punch so the timesheet can show how far from the site you were. Nothing runs in the background and nothing is tracked between taps.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "You can only be clocked in once: one open entry per worker. Clocking in opens it against the job you picked (or no job), clocking out closes it and the hours are computed. The entry is saved as pending and goes to your manager, which is what the note at the bottom of the screen says: **Your hours go to your manager to review and approve.** See [[the-time-clock|The time clock]] for the office's side and [[timesheets-and-approving-hours|Timesheets: review and approve hours]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**The clock face** — today's date and the live time. Clocked in, it adds an **On the clock** pill, the elapsed time, **Since** your clock-in time, and **On** the job's name (or **Not linked to a job**). Clocked out, it reads **You're clocked out.**",
            "**Which job?** — a picker, shown only while you are clocked out and only when your company has open jobs. **No job — travel, yard, quoting** sits at the top; then **Scheduled for you today** and **Your other open jobs**.",
            "**The location line** — shown only while the phone has not yet answered the permission question, so you read why before the phone asks.",
            "**Clock in** (green) or **Clock out** (red) — the one button.",
            "**Today** — the day's total and each entry with its times and its job, plus the note that your hours go to your manager.",
          ] },
          { figure: "harness:mobile-clock", caption: "Time clock on a phone — On the clock since 7:28 on the Dubois kitchen job, the location note, the Clock out button, and Moved to another job? underneath." },
        ],
      },
      {
        id: "how-to",
        heading: "How to clock in and out",
        blocks: [
          { steps: [
            "Open **More → Time clock** (or bookmark it).",
            "Check the job under **Which job?** If you have exactly one visit today it is filled in for you and the screen says so; with several, it asks you to pick the one you are starting; with none, it says so and leaves it blank.",
            "Tap **Clock in**. If your phone asks whether FieldQuo may use your location, answer once; a refusal changes nothing about the punch.",
            "Work. The elapsed time counts up on the screen; it also keeps counting on the server if you close the tab or the battery dies.",
            "Tap **Clock out**. The entry moves into **Today** with its hours.",
          ] },
          { figure: "live:app-clock", caption: "The same screen on a computer — the clock face, the Today list with each entry and its job, and the review note." },
        ],
      },
      {
        id: "switch-job",
        heading: "Moved to another job?",
        blocks: [
          { p: "Staying clocked in all day puts the whole shift on the first job. The **Moved to another job?** card fixes that: pick the new job and tap **Switch job**. The current entry is closed at that instant and a new one opened on the new job — the hours already worked keep the job they were worked on, and, as the card says, a new entry starts from now." },
          { note: "Switch job is disabled while the picker shows the job you are already on. There is no undo: if you switched to the wrong job, switch again — the minute in between lands on the wrong job and your manager can correct it on Timesheets." },
        ],
      },
      {
        id: "location",
        heading: "Where the phone was, and what the office sees",
        blocks: [
          { p: "The position is stored beside the punch with the distance to the job's site, computed once. On Timesheets each punch carries a chip: **In · On site** when the phone was within **250 m** of the site, **In · 2.1 km away** in amber when it was further, and **—** when nothing honest can be said — no position, a job with no site address, or a location fix so loose (an accuracy circle wider than 250 m) that the phone could have been anywhere." },
          { p: "An away chip is a question for your manager, not a verdict: approval stays a button a person presses. The phone's own clock is not trusted either — a stamp whose time is more than 15 minutes from the server's is refused rather than stored." },
          { note: "There is no way for FieldQuo to detect that you arrived. A browser can only read position while its page is open and in front, so the screen asks at the tap instead of guessing, and stores nothing between taps." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone whose login is linked to a worker record. If the screen reads **You're not set up as a worker yet. Ask an admin to add you under Team.**, an owner or administrator needs to add you on the **Workers** tab of Manage Team — the tab only they see. The Crew level records and views its own time; reviewing, editing and approving everyone's is the Dispatcher level and above." },
        ],
      },
    ],
    faq: [
      { q: "I forgot to clock out yesterday.", a: "The entry is still open on the server. Clock out now and tell your manager — they correct the time on Timesheets, and the entry goes back to pending for review." },
      { q: "Can I clock in from home and drive to the site?", a: "You can, and the punch will say so: the timesheet chip shows how far from the site the phone was when you tapped. Pick No job for the drive, or ask your company what it wants." },
      { q: "The phone never asked for my location.", a: "Either you answered once already (allowed or refused) and the phone remembers, or the browser has no location at all. Either way the punch goes through; only the chip on the timesheet is affected." },
      { q: "Can I fix my own hours?", a: "Not from the phone today. Your manager fixes an entry on Timesheets; a correction returns the entry to pending so somebody re-checks it." },
    ],
  },

  "your-schedule-on-your-phone": {
    title: "Your schedule on your phone",
    summary:
      "Where a crew member's day lives: published shifts under Assign shifts, appointments on the Calendar, visits on the job, and to-dos.",
    updated: "2026-09-12",
    intro: [
      "Your day is in three places on purpose, because they are three different things: a **shift** is the hours your manager published for you, a **visit** is a booked block of work on a job, and a **to-do** is a task with your name on it. All three show only what is yours, and none of them shows a draft the office has not published.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The Crew level's schedule setting is **View and complete their own schedule**: you see your own hours and can mark your own visits done, and you cannot see or move anyone else's. The Team calendar — everyone's availability on one page — is a management screen and is not in your menu." },
        ],
      },
      {
        id: "where-to-look",
        heading: "Where to look",
        blocks: [
          { table: {
            head: ["Row", "What it shows", "What you can do"],
            rows: [
              ["**Assign shifts**", "Your published shifts, a week at a time, Sunday to Saturday, today outlined", "Read them. The line at the bottom says: These are the shifts your manager has published. Check back for changes."],
              ["**Calendar**", "Appointments assigned to you, unassigned ones, and visits on your jobs", "Open the job; on your own visit, On my way and Mark complete."],
              ["**Jobs**", "The jobs you have a visit on, with each visit's date and time", "Tick the checklist, add photos, write the daily log."],
              ["**To-do**", "Tasks assigned to you, ones you created, and unassigned ones", "Claim an unassigned task; complete yours."],
            ],
          } },
        ],
      },
      {
        id: "shifts",
        heading: "Your shifts",
        blocks: [
          { p: "A manager drafts the week on the Scheduling screen and presses **Publish week**; until then a shift is a **Draft** the crew cannot see. Once published, your shift shows its start and end, the job, and any note the manager typed — where to be, what to bring. If a shift was placed outside the hours you said you were available, the shift itself says **Outside stated availability**, with who did it and why, so you learn it here rather than on the morning." },
          { figure: "harness:scheduler", caption: "Scheduling as a manager sees it — the week as day cards, Add shift and Publish week. A crew member sees the same cards with only their own published shifts, and no buttons." },
          { note: "The screen's row is titled **Assign shifts** for everyone because the title is the manager's. You are not assigning anything; you are reading what was assigned to you." },
        ],
      },
      {
        id: "visits",
        heading: "A visit, from arrival to done",
        blocks: [
          { steps: [
            "Open the job from **Jobs** or from the **Calendar**. Your visit shows its time, who is assigned, and the checklist count.",
            "Tap **On my way**. The client is texted your company's on-my-way wording; the line under the button says where it goes — or that nothing will be sent because the client has no mobile on file. Your phone is asked where it is, once.",
            "Work through the checklist. A hold point is a step somebody must confirm before the next; a step marked **Photo expected** is a reminder, not a lock.",
            "Tap **Mark complete**. The visit is done; the office sees it and the job's next steps follow.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Your own shifts and visits: you. Everyone's: the Dispatcher level and above, who also draft and publish. Your bookable hours — the pattern the manager is warned against scheduling outside — are yours to set under **Settings → Availability**; see [[working-hours-and-bookable-hours|Working hours and bookable hours]]. The manager's side is in [[the-scheduler-and-crew-shifts|The Scheduler: draft and publish the crew's week]]." },
        ],
      },
    ],
    faq: [
      { q: "My manager says the shift is there but I cannot see it.", a: "It has not been published. A shift is a draft, invisible to the crew, until the manager presses Publish week." },
      { q: "Can I swap a shift with a colleague?", a: "Not in FieldQuo. Ask your manager to move it; the Crew level cannot edit shifts, its own included." },
      { q: "Why do I see an appointment that is not assigned to anyone?", a: "Unassigned appointments are shown to everyone on purpose — an unclaimed job nobody can see is a job nobody does. Unassigned visits, though, only show on jobs you are already on." },
    ],
  },

  "photos-from-the-field": {
    title: "Photos from the field",
    summary:
      "Two ways a photo gets from your phone onto the job: upload it on the job page, or text it in. What the crew can do with it, and what the office does after.",
    updated: "2026-09-12",
    intro: [
      "A photo filed against the job is the record the contractor reaches for first — before, during, done, and the thing that was already broken when you opened the wall. FieldQuo keeps every photo on the job it belongs to, dated, in the order the work happened, and the office picks the good ones for the quote, the invoice or the website afterwards.",
      "From the phone you have two ways in: the upload button on the job page, or a text message to the company's crew line with no app open at all. This article is the first; the text-in path is [[text-a-photo-to-the-crew-inbox|Text a photo in without an app]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every photo carries a **stage** — Before / start, In progress, Finished, or Issue / snag — and can carry your company's own **tags** (sanding, priming, top coat). Start and finish of the same job become the before-and-after your website shows. An issue photo is an office record: it can never be put on the website, and the screen says so rather than silently doing nothing." },
        ],
      },
      {
        id: "two-ways",
        heading: "Two ways in",
        blocks: [
          { bullets: [
            "**Upload on the job page.** Open the job, scroll to **Job photos**, tap the upload button and pick from the camera or the camera roll. Filed immediately as In progress.",
            "**Text it to the crew line.** Send the photo, with or without a few words, to your company's number. It files itself against the job you are on that day, and the words you typed set the stage.",
          ] },
        ],
      },
      {
        id: "upload",
        heading: "How to upload from the job page",
        blocks: [
          { steps: [
            "Open the job from **Jobs**.",
            "Scroll to the **Job photos** card. It shows every photo filed so far, and how many are on your website.",
            "Tap the upload button under the grid and choose the camera or an existing photo. Up to 12 at a time; a photo can be up to 15 MB, so a raw phone photo is fine.",
            "Wait for the upload to finish — the button reads that it is uploading — and the photos appear in the grid, filed as In progress.",
            "Say something about them in the job's chat room if the office should look now; the photo itself notifies nobody.",
          ] },
          { figure: "harness:mobile-job", caption: "The job page on a phone — the visit, its checklist with a Photo expected step, and the Job photos card further down." },
        ],
      },
      {
        id: "stages-and-tags",
        heading: "Stages, tags and the website",
        blocks: [
          { table: {
            head: ["Stage", "Meaning", "Can go on the website"],
            rows: [
              ["Before / start", "The state you found; day one", "Yes — pairs with a Finished shot"],
              ["In progress", "Mid-job; the default for an upload", "Yes"],
              ["Finished", "Done; the after", "Yes — pairs with a Before shot"],
              ["Issue / snag", "Damage, a leak, something wrong", "Never"],
            ],
          } },
          { p: "Changing a stage, starring a photo onto the website, drawing on it and changing its tags are curation decisions, and they need edit access to jobs — the Estimator and Crew levels see the photos and the stage but not those controls. A photo you upload lands as In progress; a photo you text in gets its stage from your words. Tags are made on **Settings → Job photo tags**; see [[job-photos-and-tags|Job photos and tags]]." },
        ],
      },
      {
        id: "what-you-cannot-do",
        heading: "What the Crew level cannot do",
        blocks: [
          { bullets: [
            "Change a photo's stage, star it for the website, mark it up or tag it — those controls are not drawn for you, because they would refuse.",
            "Delete a photo. Nobody deletes photos from the job page.",
            "Upload to a job you are not booked on. The job is not in your list, and the server answers not found.",
            "Attach a photo to a checklist step. **Photo expected** on a step is a reminder; ticking the step does not ask for one.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone who can open the job sees its photos and the **Photo record** with its tag filter. Uploading needs only View only on jobs — the Crew and Estimator levels included — on the jobs you are on. Curating needs **View, create, and edit** on jobs: the Dispatcher level and above. You can comment on a photo at any level." },
        ],
      },
    ],
    faq: [
      { q: "Does uploading a photo tell the office?", a: "No. It files the photo. If somebody should look now, say so in the job's chat room — a mention notifies the person named." },
      { q: "Can I upload a video?", a: "The upload control accepts a video, but the job's photo card is built around photos and the before-and-after pairing. Use photos for the job record." },
      { q: "I uploaded a photo as the wrong stage.", a: "Ask somebody with edit access to jobs to re-stage it — one tap on the photo's stage. The Crew level cannot." },
    ],
  },

  "text-a-photo-to-the-crew-inbox": {
    title: "Text a photo in without an app",
    summary:
      "Send a photo by text message to your company's crew line and it files itself against the job you are on that day. What to text, what it texts back, and what it costs the company.",
    updated: "2026-09-12",
    intro: [
      "The crew line is one phone number for the whole company. A crew member texts a photo to it — a plain picture message, no app, no login, on any phone — and FieldQuo files the photo against the job that person is scheduled on that day. When it cannot tell which job, it asks by text, and when it still cannot, the photo waits in the office's **Crew inbox** for a person to pick.",
      "It works because the schedule is FieldQuo's own: the candidates are your visits for the day, nobody else's. This article is written for the person texting; the office screen is [[the-crew-inbox|The crew inbox: photos and updates by text]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A text arrives, FieldQuo looks up who sent it by the mobile number on your worker record, re-hosts the photo, and works out the job: if your words name a client, a street number or a job title, that job; if the photo carries a location that sits clearly on one site, that job; if you have exactly one visit that day, that job, silently; otherwise it texts you the list and waits for a number." },
          { figure: "harness:crew-inbox", caption: "Crew inbox as the office sees it — the Crew texting panel with the number and the rates, a photo under Needs you — pick the job, and the Filed list." },
        ],
      },
      {
        id: "before-it-works",
        heading: "Before it works",
        blocks: [
          { steps: [
            "Your company turns crew texting on and gets a number — a shared FieldQuo test line or its own — on the **Crew inbox** screen. That is an owner, administrator or manager decision, because texts are charged to the company's credit.",
            "An owner or administrator adds your mobile to your worker record on the **Workers** tab of Manage Team. Until it is there, your texts arrive from an unknown number and file nowhere.",
            "Save the crew number in your phone's contacts. It is the one on the **Crew texting** panel: **Your crew text this number**.",
          ] },
          { note: "Texts from a number not on the roster get no reply, except during a company's first few messages, when the line answers once to say the number is not on the team yet. Silence afterwards is deliberate — a line that answers strangers is a line spammers keep." },
        ],
      },
      {
        id: "how-it-files",
        heading: "How a photo gets filed",
        blocks: [
          { bullets: [
            "**Only one visit today** — filed straight away, no reply. The photo lands on that visit, and on the job's photos.",
            "**A name in your text** — a client's surname, a street number or a word from the job title picks that job. The reply confirms where it went.",
            "**Several visits, nothing said** — you get a numbered list and the question. Reply with the number, or a distinctive word, within 12 hours. A new photo before you answer abandons the question and starts again.",
            "**No visit today** — the line says it sees no job on your schedule to file this against, and the photo waits in the office inbox under Needs you.",
          ] },
          { p: "Your words also set the stage: something like before or starting files it as Before / start, done or finished as Finished, and issue, leak, damage or broken as Issue / snag. The keywords, the question and the confirmation are in English whatever your language." },
        ],
      },
      {
        id: "what-it-texts-back",
        heading: "What the line texts back",
        blocks: [
          { table: {
            head: ["What happened", "Reply"],
            rows: [
              ["Filed to your only job of the day", "Nothing — it just files"],
              ["Filed after you chose, or after it inferred the job", "A one-line confirmation naming the job"],
              ["Several possible jobs", "A numbered list ending with Reply with the number"],
            ],
          } },
        ],
      },
      {
        id: "costs",
        heading: "What it costs",
        blocks: [
          { p: "Texts and photos are metered against the company's credit — the same balance as the phone agent — at the rates printed on the Crew texting panel: a few cents per text and per photo. When the credit runs out, crew texting pauses and the panel says so; a top-up reconnects it. Nothing is ever charged to you." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Crew inbox** row appears once crew texting is on. The Crew and Estimator levels see only the texts they sent; the Dispatcher level and above see everyone's, and they are the ones who clear the Needs you queue. Setting the line up or turning it off is owner, administrator or manager." },
        ],
      },
    ],
    faq: [
      { q: "Do I need the app open to text a photo in?", a: "No. That is the point — a plain picture message from any phone, and the photo is on the job before you are back in the van." },
      { q: "I texted a photo and got no reply. Did it work?", a: "If you had one visit that day, yes — a silent file is the normal case. If your number is not on the roster, no; ask an owner to add your mobile on the Workers tab." },
      { q: "Can I text the client's number instead?", a: "No. The crew line is one number for the company; it is on the Crew texting panel and worth saving in your contacts." },
    ],
  },

  "chat-on-your-phone": {
    title: "Chat on your phone",
    summary:
      "The company chat from a crew member's phone: #general, a room for every job you are on, direct messages, mentions, and what a message can and cannot carry.",
    updated: "2026-09-12",
    intro: [
      "**Chat** is your company talking to itself. #general is everyone on the team; every job on the calendar has its own room for the crew booked on it and the office; a direct message is between the two of you. Nothing leaves the company, and it is the one tab every access level keeps in the phone's tab bar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The list groups rooms as **Unread**, **Company**, **Jobs**, **Direct messages** and **Finished jobs**. Open one and you get the thread with an **Unread messages** divider where you left off, the **Members** panel, an **Open job** link on a job room, and the composer at the bottom. The list refreshes itself every 15 seconds while the screen is open." },
          { figure: "harness:mobile-chat", caption: "A job room on a phone — the unread divider, a highlighted message that mentions two people, the composer with its character count, and Send." },
        ],
      },
      {
        id: "rooms",
        heading: "The rooms",
        blocks: [
          { table: {
            head: ["Room", "Who is in it", "How you get in"],
            rows: [
              ["**#general**", "Everyone on the team", "The moment your invitation is accepted; you leave when your account is deactivated"],
              ["A job room", "Whoever is booked on one of the job's visits, plus the owner, admins and managers", "Being booked on a visit"],
              ["A direct message", "Just the two of you — nobody else can read it", "**New message**, then a name"],
              ["**Finished jobs**", "The same people, read for the record", "The job is finished; the room is kept"],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "How to send a message",
        blocks: [
          { steps: [
            "Tap **Chat** in the tab bar.",
            "Open the room — or **New message** to start a direct message with somebody on the team.",
            "Type in the composer. Up to 4,000 characters; the count shows under the box.",
            "To point a message at somebody, type @ and pick them from the list. Only people in the room can be mentioned.",
            "Tap **Send**. If it fails, the message reads **Not sent.** with **Put it back in the box** — your words are not lost.",
          ] },
        ],
      },
      {
        id: "mentions-and-alerts",
        heading: "Mentions, and who is told",
        blocks: [
          { p: "A direct message tells the other person; a mention tells the people named. Never the author, never the whole room. The bell counts your unread rooms, and if the person has turned browser notifications on, a direct message or a mention also reaches them as a notification — **New message from …** or **… mentioned you in #general**." },
          { note: "There is no read receipt and no typing indicator. Opening a room marks it read for you; nobody else sees that." },
        ],
      },
      {
        id: "limits",
        heading: "What a message cannot carry",
        blocks: [
          { bullets: [
            "**Photos or files.** The composer is text only. Put a photo on the job — upload it or text it in — and say so in the room.",
            "**Clients.** Nothing here reaches a homeowner; the chat is internal by construction.",
            "**Edits or deletions.** A sent message stays as sent.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone on the roster, at every access level, when the crew chat feature is on for the company. A read-only support session from FieldQuo can see the chat and cannot post in it, and the screen says so. The office's side of a job room is [[a-chat-room-for-every-job|A chat room for every job]]." },
        ],
      },
    ],
    faq: [
      { q: "Why can I not see a room for the job I am on?", a: "You are in a job's room when you are booked on one of its visits. If your name is not on a visit, ask the office to book you on it — that is the only way in." },
      { q: "Can I send a photo in the chat?", a: "No. Upload it on the job page or text it to the crew line, then mention the person who should look." },
      { q: "Will I get a notification for every message?", a: "No. Only a direct message to you, or a message that mentions you — and only if notifications are turned on in your browser." },
    ],
  },

  "time-off-on-your-phone": {
    title: "Ask for time off from your phone",
    summary:
      "Request a day off, see what you have left, withdraw a request, and know who it is waiting on.",
    updated: "2026-09-12",
    intro: [
      "**Time Off** is one screen with two jobs: what you have left, and your requests. A request goes to the person you report to; some types are approved automatically the moment you submit; and until it is taken you can withdraw it yourself.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "At the top, a card per leave type your company set up — Vacation, Sick days, Personal day, whatever the owner named — with **Accrued**, **Taken**, what is awaiting approval, and days **Left**. Under it, **Your requests** with the **Request time off** button, each request with its status pill and, while it is pending, a line saying who it is waiting on. If no leave policies exist yet, the screen says so and names the settings page an owner uses to add them." },
          { figure: "harness:mobile-time-off", caption: "Time off on a phone — the Vacation and Personal day balance cards, Request time off, and a pending request with its Withdraw button." },
        ],
      },
      {
        id: "how-to",
        heading: "How to request time off",
        blocks: [
          { steps: [
            "Open **More → Time Off**.",
            "Tap **Request time off**.",
            "Choose the **Type**. An unpaid type is not limited by a balance; a paid one shows the days you have available.",
            "Set **First day** and **Last day**, or tick **Half day only** for a half day.",
            "Add a **Note (optional)** — anything your manager should know.",
            "Tap **Submit request**. If the type is approved automatically the screen has already told you: submitting books it.",
          ] },
        ],
      },
      {
        id: "what-happens-next",
        heading: "What happens next",
        blocks: [
          { bullets: [
            "The request appears under **Your requests** as **Pending**, with the line saying who it is waiting on — the person you report to, or an owner or administrator if none is set or your manager is away today. The routing is recomputed every time the screen loads, so it follows your manager back from their own holiday.",
            "The people who can act on it get a notification in their bell — and on their phone if they turned notifications on.",
            "They **Approve** or **Decline** on their Team tab. Your request's pill changes, and the balance card moves the days from awaiting approval to Taken.",
            "Changed your mind? Tap **Withdraw** on a pending or approved request you have not taken yet.",
          ] },
          { note: "The days-left figure is information, not authorisation. The server checks your balance when you submit and again when the manager approves, because other requests can be approved in between." },
        ],
      },
      {
        id: "balances",
        heading: "How balances work",
        blocks: [
          { p: "Balances build up on their own from the policy the owner set — a number of days per year, accruing as the year goes — and the card shows this year's figures. A pending request counts against what you have available so that you cannot ask for the same days twice. Vacation pay, where your company accrues it, shows as an amount on the card." },
          { tip: "Sick days are usually on an auto-approving policy: submitting books the day and simply tells your manager. Do it from the phone before the shift starts so the schedule knows." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone sees their own balances and requests and can withdraw their own. Approving and declining, the **Team** tab, everyone's balances and who is off next are for whoever can run a crew — the Dispatcher level and above. The policies themselves are owner and administrator only, under Settings; see [[time-off-policies|Time off policies]] and, for the manager's side, [[time-off-requests|Time off requests]]." },
        ],
      },
    ],
    faq: [
      { q: "Who approves my request?", a: "The person you report to. If nobody is set, or your manager is away today, it goes to an owner or administrator instead, and the line under the request says which." },
      { q: "Can I ask for more days than I have?", a: "Not for a paid type — the server refuses on submit. Unpaid leave has no balance and is not limited." },
      { q: "My request was approved but I no longer need it.", a: "Tap Withdraw on it. That works on pending and approved requests you have not taken yet." },
    ],
  },

  "report-a-safety-incident": {
    title: "Report a safety incident",
    summary:
      "File an injury, a near-miss or property damage from the phone in under a minute: what the form asks, what Work stopped means, and who sees the report.",
    updated: "2026-09-12",
    intro: [
      "**Safety** is where an injury, a near-miss or damage gets written down while it is fresh. Every access level can file one — the person standing on the ladder is the one who has to be able to report what happened on it — and a near-miss is worth reporting exactly like an injury, as the screen itself says.",
      "The report is a record, not an alarm. Filing it writes it to the company's incident list and activity log; it does not text or email anybody. Tell your supervisor as well.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen lists incidents — filtered **All**, **Open**, **Reviewed** or **Closed** — as cards with the kind, a **Work stopped** badge when the work was halted, where, who reported it and its status, and a **Report** button. Managers get a **Follow up** panel on each card to set the status and record what was done; a crew member sees the reports they filed." },
          { figure: "harness:mobile-safety-report", caption: "The report form on a phone — kind, when, what happened, where, the optional job, the Work stopped checkbox and the reporting note." },
        ],
      },
      {
        id: "how-to",
        heading: "How to file a report",
        blocks: [
          { steps: [
            "Open **More → Safety** and tap **Report**.",
            "Pick **What kind of incident**: **Near-miss**, **Injury**, **Property damage** or **Other**.",
            "Set **When it happened** — it defaults to now.",
            "Describe **What happened** in your own words. Short is fine; this is the one field that is required.",
            "Say **Where** and, under **Job (optional)**, pick the job or leave **Not tied to a job**. The list holds the jobs you are on.",
            "Tick **Work stopped because of this** if it did, and add a **Reporting note (optional)** about telling a provincial authority.",
            "Tap **File report**. The confirmation invites you to add a photo of the scene — optional — then **Done**.",
          ] },
        ],
      },
      {
        id: "each-field",
        heading: "What each field is for",
        blocks: [
          { table: {
            head: ["Field", "What it does"],
            rows: [
              ["**What kind of incident**", "Sets the card's label. An injury is recorded in the activity log as an injury; a near-miss as a near-miss."],
              ["**When it happened**", "The incident's time, not the filing time."],
              ["**What happened**", "Required. The only free text the card shows in full."],
              ["**Where**", "A room, a yard, a floor — free text."],
              ["**Job (optional)**", "Links the report to a job so the office can find it from there."],
              ["**Work stopped because of this**", "Shows a red Work stopped badge on the card. It changes nothing else — the schedule is not touched."],
              ["**Reporting note (optional)**", "Your note about regulatory reporting. FieldQuo does not know your province's rules or deadlines and does not decide this for you."],
            ],
          } },
        ],
      },
      {
        id: "after-filing",
        heading: "After you file",
        blocks: [
          { p: "The report is **Open**. A manager reviews it in the **Follow up** panel — status to **Reviewed** or **Closed**, and a note on what was done — and the card updates. Photos you added stay on the report. The reporter is always the person signed in; a report cannot be filed in somebody else's name." },
          { warning: "Nobody is notified automatically. If somebody is hurt, call for help first and tell your supervisor; the report can be filed from the site afterwards, or the next morning with the real time set under When it happened." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The floor of the safety setting is **Report incidents, and view their own** — the Crew and Estimator levels — so you see what you filed, and only that. Seeing everyone's incidents is the next level, and following up is **View everyone's incidents and follow up on them**: the Dispatcher level and above. A report filed about you by somebody else is theirs to show you. The office's side is [[safety-incidents|Safety incidents and near-misses]]." },
        ],
      },
    ],
    faq: [
      { q: "Should I report a near-miss that hurt nobody?", a: "Yes. The screen says it in its own words: a near-miss is how you learn before someone gets hurt." },
      { q: "Does ticking Work stopped tell the office to stop the job?", a: "No. It puts a badge on the report. Stopping the work is a conversation with your supervisor." },
      { q: "Can I edit a report after filing?", a: "Not from the Crew level. A manager adds the follow-up and changes the status; the original stays as you wrote it." },
    ],
  },

  "push-notifications": {
    title: "Push notifications",
    summary:
      "How to be told on your phone about a mention, a direct message, an approved quote or a paid invoice — and why the switch may say push is not set up.",
    updated: "2026-09-12",
    intro: [
      "Browser notifications have two halves. While a FieldQuo tab is open somewhere on the phone, the page itself can raise a system notification for something new. With the tab closed, only **push** can reach you — and push has to be set up on the deployment by FieldQuo, so the switch tells you plainly which of the two you are getting.",
      "Both halves are one switch, per person and per browser, on **Settings → Notifications**, in the **Browser notifications** card.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The card reads: **Be told about new activity as a system notification on this computer or phone — while FieldQuo is in another tab, and with the tab closed where push is set up.** Under it, the switch **Notify me in this browser**, a line about the browser's permission, a line about push, and **Send a test notification**." },
          { p: "Turning the switch on asks the phone's permission, remembers on this phone that you want alerts, and — when push is set up — registers this phone with the server so the same events arrive with the tab closed. Turning it off forgets the flag and drops the registration. The permission itself belongs to the browser: if it is blocked, the card says so and where to change it, and the switch is not offered." },
          { note: "The **Appointment reminders** card on the same page is something else: texts to clients before a visit, from your business name. Those go by text message only — there is no email reminder, and the reminder wording is not editable yet, only the on-my-way message is. They are not notifications to you." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "How to turn it on",
        blocks: [
          { steps: [
            "On an iPhone or iPad, add FieldQuo to the home screen first and open it from the icon — the card's last line says Safari only delivers notifications to installed web apps.",
            "Open **Settings → Notifications** and scroll to **Browser notifications**.",
            "Turn on **Notify me in this browser** and allow notifications when the phone asks.",
            "Read the confirmation: **On. You'll be notified here, and with the tab closed.** means push is working; **On. You'll be notified while a FieldQuo tab is open.** means only the in-tab half is available.",
            "Tap **Send a test notification** and look for it at the corner of the screen.",
          ] },
          { figure: "harness:settings-notifications", caption: "Settings → Notifications — the company's email alerts and appointment reminders; the Browser notifications card with the switch sits further down the same page." },
        ],
      },
      {
        id: "what-you-get",
        heading: "What triggers a notification",
        blocks: [
          { table: {
            head: ["Event", "Who is told"],
            rows: [
              ["A direct message, or a message that mentions you, in Chat", "You"],
              ["A new message from a homeowner in the Messages inbox", "Everyone who can read the inbox"],
              ["A quote approved, an invoice paid, a chargeback, a quote that did not deliver, an estimate waiting for sign-off, a new enquiry, a time-off request", "The people whose access level covers that thing — the same people it appears to in the bell"],
              ["A photo uploaded, a visit completed, a punch", "Nobody — these are records, not alerts"],
            ],
          } },
          { p: "A notification never carries money: a lock screen is a public place, so the push says less than the feed row, never more. For a crew member, whose level covers none of the money events, notifications are in practice the chat — a direct message or a mention." },
        ],
      },
      {
        id: "the-status-line",
        heading: "What the push line means",
        blocks: [
          { table: {
            head: ["The line reads", "Meaning"],
            rows: [
              ["Push with the tab closed is not set up on this deployment", "FieldQuo has not enabled push yet. The switch still works for the in-tab half."],
              ["This browser can't receive push with the tab closed", "The phone's browser lacks push — on an iPhone, usually because FieldQuo is not installed on the home screen."],
              ["Push with the tab closed: available", "Set up and ready; turn the switch on to use it here."],
              ["Push with the tab closed: on in 2 browser(s)", "Working, and this is how many of your devices are registered."],
              ["Browser permission: blocked", "The browser refused. Allow notifications for the site in its settings, then come back."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The switch is personal — each person, each phone — but it lives on **Settings → Notifications**, and the Settings menu shows that row to owners and administrators only. A crew member has no row that leads to the switch today, so the crew chat's mentions reach them in the bell and on the screen, not on the lock screen." },
          { warning: "A notification is a courtesy about something already recorded. If a push service is slow or down, the record is still in the bell and on the screen; nothing waits for the notification." },
        ],
      },
    ],
    faq: [
      { q: "The card says push is not set up. Is something wrong with my phone?", a: "No. That line is about the FieldQuo deployment, not your phone. The switch still gives you notifications while a FieldQuo tab is open." },
      { q: "I turned it on at my desk. Will my phone get them too?", a: "No. The switch is per browser. Turn it on on each device you want notified." },
      { q: "Will clients ever get a push from FieldQuo?", a: "No. Clients get emails and texts from your company; push is for people signed in to FieldQuo." },
    ],
  },

  "bad-connections-and-offline": {
    title: "Bad connections, and why there is no offline mode",
    summary:
      "What happens to a punch, a photo or a message when the signal drops, what to do about it, and what FieldQuo deliberately does not do.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo stores nothing on the phone and queues nothing for later. Every tap is a request to the server, and a request with no signal does not go through — the screen tells you, and you tap again when you have a bar. There is no offline mode, no background sync, and this article says so rather than letting you find out in a basement.",
      "The reason is honesty over convenience. A punch that looks recorded and is not, a photo that looks filed and is sitting in a queue, is exactly the failure this product refuses to ship. What you see on the screen is what the server has.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The only thing FieldQuo installs in your browser is a small worker whose one job is to receive push notifications. It caches no pages, intercepts no requests, and serves nothing while you are offline — so an installed FieldQuo icon with no signal opens to the browser's own no-connection page, not to a stale copy of your day." },
          { p: "What is on the server is safe. A page that fails to load says **This didn't load** and, under it, **This is a loading problem, not missing data — nothing has been deleted.** with a **Try again** button. That sentence is true of every screen." },
        ],
      },
      {
        id: "what-happens",
        heading: "What happens to each action without a signal",
        blocks: [
          { table: {
            head: ["Action", "With no connection", "How you know"],
            rows: [
              ["Open a screen", "Nothing loads", "The panel: This didn't load, with Try again"],
              ["Clock in or out", "Nothing is recorded", "The screen does not change to On the clock (or to clocked out); on a refused request it reads Couldn't record that."],
              ["On my way or Mark complete", "The visit does not change", "A message: Couldn't update the visit. Check your connection."],
              ["Send a chat message", "Not stored", "The message reads Not sent. with Put it back in the box"],
              ["Upload a photo, file a report, submit a request", "Nothing is filed", "An error message; the form keeps what you typed until you leave the page"],
            ],
          } },
        ],
      },
      {
        id: "what-to-do",
        heading: "What to do",
        blocks: [
          { steps: [
            "Look at the screen before you pocket the phone. A punch that went through shows **On the clock**; a message that went through sits in the thread; a photo that went through is in the grid.",
            "If it did not go through, move to where you have signal and tap again. Nothing was half-recorded, so tapping twice cannot double anything — the clock refuses a second clock-in while one is open.",
            "For a photo with a weak data connection, text it to the crew line instead: a picture message goes out on the phone network and files itself when it arrives — [[text-a-photo-to-the-crew-inbox|Text a photo in without an app]].",
            "If the site is a dead zone, tell the office in advance. Your manager can add a punch by hand on Timesheets, and the daily log can be written that evening.",
          ] },
        ],
      },
      {
        id: "the-clock",
        heading: "The clock keeps running on the server",
        blocks: [
          { p: "Once a clock-in is recorded, the open entry lives on the server, not on your phone. Losing signal, closing the browser, a dead battery — none of them stops the clock. Sign in on any phone or computer and **Clock out** closes the same entry. The location the phone was asked for at the tap has an 8-second timeout: no fix in time, and the punch goes without a position rather than waiting." },
          { tip: "If the day ended with no signal and no clock-out, the entry stays open overnight. Clock out first thing and tell your manager the real time; they correct it on Timesheets and the entry goes back to pending for review." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "What FieldQuo does not do",
        blocks: [
          { bullets: [
            "**Queue actions for later.** A tap that fails is not retried in the background. You retry it.",
            "**Track your position.** The phone is asked once, at a tap; nothing runs between taps and nothing works while the screen is locked. That is a browser limit, and the product does not pretend otherwise.",
            "**Ship a native app.** There is none in any store; the back office is a web app that runs in the phone's browser and can be pinned to the home screen — [[install-it-like-an-app|Install it like an app]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "I tapped Clock in with no signal and put the phone away. Am I clocked in?", a: "No. Nothing was recorded. Open the screen: if it does not say On the clock, tap again where you have signal, and tell your manager the real start time." },
      { q: "Will the photos I took offline upload on their own later?", a: "No. Upload them from the job page when you have a connection, or text them to the crew line — a picture message often gets through where a web page does not." },
      { q: "Is offline mode coming?", a: "Not today, and this article will say so when that changes. The current design is that what the screen shows is what the server has." },
    ],
  },
};
