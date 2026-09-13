// content/help/en/team-and-access-1.js
//
// Part 1 of the “team-and-access” category in English (see the composer,
// team-and-access.js): Manage Team, inviting, the five access levels, the
// Custom editor, seats, and deactivation.
//
// Every access fact here is read from lib/permissions.js (PERMISSION_PRESETS,
// PERMISSION_CATEGORIES, PERMISSION_TOGGLES), lib/permissions/roleManagement.js
// (who may change whose access), lib/permissions/nav.js and
// lib/permissions/settingsAccess.js (which rows each level sees) and
// lib/pricing/ladder.js (what counts as a seat). The words on the screen come
// from app/i18n/appMessages.js; the preset, area and rung labels are the
// product's own English strings on every language's screen.
export const ARTICLES = {
  "manage-team": {
    title: "Manage Team",
    summary:
      "The roster screen: who is on your team, what each person can see and do, the seat panel, pending invitations, and the Add User, Add crew and Add a seat buttons.",
    updated: "2026-09-12",
    intro: [
      "**Manage Team** is where your company's people live in FieldQuo. It is one screen reached two ways — **Your team** in the main sidebar under People, and **Settings → Manage Team** under Team & scheduling — and it shows everyone with a login, the access level each person holds, and how many of your plan's seats and crew places are in use.",
      "Everything about a person's access is changed from here. Their hours, their pay rate and their leave live on other screens — Timesheets, Workers, Time Off — which this page links to.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page has three parts, top to bottom: the seat panel, a row of tabs, and the roster. The seat panel counts your plan against the people on it. The roster lists every member with their level in the **Role** column, their **Last Login** and an **Active** checkbox. An invitation nobody has accepted yet sits at the bottom of the roster with an **Invited** badge and a **Cancel invite** button." },
          { figure: "live:app-settings-team", caption: "Manage Team on a one-person company — the seat panel (1 / 3 seats used, 0 / 8 crew — included free), the Workers, Timesheets and Payroll tabs, and the roster with the owner's row." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Add User**, top right, opens the New User form — see [[invite-a-team-member|Invite a team member]].",
            "The seat panel: **seats used** out of the seats your plan includes, **crew — included free** out of its crew places, and a breakdown by kind — **Administrators**, **Managers**, **Dispatchers**, **Workers**, **Crew**, **Custom access** — that lists only the kinds you actually have.",
            "**Add crew — free** and **Add a seat**. Both open the same New User form; the first with the Crew level already picked, the second with Dispatcher. When a cap is reached the button greys out with the reason, and the sentence beside it names the next plan that would fit.",
            "**It's just me — no crew right now.** — shown only while you are the only person on the roster. Ticking it takes “Invite your team” off your setup checklist, and the box hides itself the moment somebody else is added.",
            "The tabs **Workers**, **Timesheets** and **Payroll**. Workers and Payroll appear only for an owner or administrator; Timesheets for everyone who can open this page.",
            "The roster columns: **Name / Email**, **Role**, **Last Login** (dropped on narrow screens so the Active checkbox stays reachable) and **Active**.",
            "**On the payroll, no login** — a section that appears when a worker record exists with no login attached: that person can be scheduled and paid but cannot sign in. Manage them under Workers.",
          ] },
        ],
      },
      {
        id: "change-someones-access",
        heading: "How to change someone's access",
        blocks: [
          { steps: [
            "Find the person in the roster. Their level shows in the **Role** column — as a dropdown if you may change it, as a grey badge if you may not.",
            "Pick **Crew**, **Estimator**, **Dispatcher**, **Manager** or **Administrator** from the dropdown. The change applies at once: the person's tier and their whole permission grid are replaced by the level's, and they keep the same login.",
            "Pick **Custom…** instead to open the editor and move individual dials — see [[the-custom-access-editor|The Custom access editor]].",
          ] },
          { figure: "harness:team", caption: "Manage Team on a six-person shop — 4 / 6 seats used, 3 / 11 crew, a level dropdown on every row the owner may change, and one pending invitation with Cancel invite." },
          { note: "Moving somebody from Crew to any other level uses a seat. If your plan has none free, the change is refused with your plan's numbers and the plan that would fit; upgrade first from **Account & Billing**." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["Role dropdown", "Replaces the person's access with the chosen level, immediately. A badge instead of a dropdown means you cannot change this row: it is your own, it is an owner's, or the person is at or above your rank."],
              ["Active checkbox", "Unticked, the person can no longer sign in to your company and stops counting against your plan; their records stay. Owner and administrator only — see [[deactivate-a-team-member|Deactivate a team member]]."],
              ["Cancel invite", "Asks you to confirm, then stops the invitation link working and frees the place it was holding. A worker record already on your books is kept."],
              ["Add crew — free / Add a seat", "Open New User with a level preselected. The level stays editable on the form."],
              ["It's just me — no crew right now.", "Records that you work alone and removes the invite step from the setup checklist. Untick it the day you take somebody on."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, Dispatchers and Managers see the **Your team** row and the roster. Estimators and Crew do not — the row is hidden and the page refuses them. Of those who can open it, only an owner or administrator can change an existing person's level or untick **Active**. A Dispatcher or Manager can add people (Crew or Estimator only) and cancel invitations, and sees everybody's level as a read-only badge." },
          { note: "The account that registered the company is the owner. FieldQuo has no control to transfer ownership or to re-grade an owner, so the owner's row is always a badge — for everyone, other owners included — and the screen says so at the bottom: at least one account always needs a top-level (owner or admin) role." },
        ],
      },
    ],
    faq: [
      { q: "Why is somebody's level a grey badge instead of a dropdown?", a: "Either you are not an owner or administrator, or the person is at or above your own rank. Your own row is always a badge: nobody changes their own access, even an owner." },
      { q: "Why does the Role column say Custom?", a: "The person's grid does not match any preset exactly — somebody moved a dial after picking a level. Open Custom… to see which dials, or pick a preset to replace the whole grid." },
      { q: "Can a Manager add an Administrator?", a: "No. A Manager or Dispatcher can add Crew or Estimator only, with every dial no higher than their own. Only the owner can make an administrator." },
    ],
  },

  "invite-a-team-member": {
    title: "Invite a team member",
    summary:
      "How to add somebody to your company from the New User form, what they receive, how long the invitation lasts, and what a pending invitation counts for.",
    updated: "2026-09-12",
    intro: [
      "Nobody can add themselves to your company. The only way in is an invitation sent from **Manage Team** by somebody already on the team who is allowed to invite. That is deliberate — your client list and your prices are behind that door.",
      "The invitation carries everything you set on the form — level, permissions, phone, address, labour cost — so the person's account is ready the moment they accept. As the form says: everything below is saved now and applied automatically once they accept.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Add User** opens **New User**, a form in three cards: **Personal Information**, **Permissions** and **Communications**. Only **Full name** and **Email address** are required. Pressing **Send Invite** creates the invitation, emails it, and puts the person on the roster as **Invited** until they accept." },
          { bullets: [
            "Check the seat panel first. A Crew login never uses a seat; every other level does, and an invitation counts from the moment it is sent — see [[seats-and-crew-logins|Seats and crew logins]].",
            "An email already on your team, or already holding an invitation, is refused: “Someone with that email is already on your team.” / “That email already has an invitation waiting.”",
          ] },
        ],
      },
      {
        id: "send-the-invite",
        heading: "How to send an invitation",
        blocks: [
          { steps: [
            "Open **Manage Team** and press **Add User** — or **Add crew — free** / **Add a seat**, which open the same form with a level already picked.",
            "Fill **Personal Information**: **Full name** and **Email address** are required; **Mobile phone number**, **Street address**, **City**, **Province**, **Postal code**, **Country** and **Upload image** are optional.",
            "**Labour cost** — their true hourly cost to the business (wage + burden), used for job costing and never shown to clients. Only an owner or administrator sees this field.",
            "Under **Permissions**, pick a level: **Crew**, **Estimator**, **Dispatcher**, **Manager**, or **Custom** to set each dial yourself. An owner can also tick **Make administrator** — see [[administrators|Administrators]].",
            "Under **Communications**, choose the **Invitation language** — English, French, Spanish, Ukrainian, Punjabi, Tagalog, German or Italian. It applies to the invitation email only and cannot be changed once sent.",
            "Press **Send Invite**. You return to Manage Team, where the person shows as **Invited** with their level beside the badge.",
          ] },
          { figure: "create:app-settings-team-create", caption: "New User — Personal Information with the Labour cost field, then Permissions: Make administrator, the four level cards, Custom, and the permission grid." },
          { warning: "If the invitation was created but the email could not leave, the form stays open and says so instead of returning to the roster. Nothing reached the person. Cancel the pending invitation on Manage Team and send it again once email is working." },
        ],
      },
      {
        id: "what-they-receive",
        heading: "What the person receives",
        blocks: [
          { p: "An email from FieldQuo titled “You're invited to join your company on FieldQuo”, in the language you chose, with a link. The link opens **Join your company**, which says which level they were invited as. A newcomer types their name and creates a password; somebody who already has a FieldQuo account at another company signs in with their existing password and is added to yours." },
          { p: "The link is good for **7 days** — the pending row on Manage Team says “Expires in N days”, then “Expired” — and a **Resend** control beside **Cancel** renews the link and sends the email again. After that it opens on “This invitation has expired” with a note to ask you for a new one — cancel the old invitation and send another. A link you cancelled opens on “This invitation can't be used”. There is no resend button; a new invitation is the resend." },
        ],
      },
      {
        id: "pending-invitations",
        heading: "Pending invitations",
        blocks: [
          { bullets: [
            "A pending invitation shows the level you chose next to the **Invited** badge, so an Administrator invitation is never mistaken for a Crew one before it is accepted.",
            "It counts against your plan from the moment it is sent — a seat for any level above Crew, a crew place for Crew.",
            "**Cancel invite** asks “Cancel this invitation?” and then stops the link and frees the place. As the dialog says, they keep any worker record already on your books; remove that from Workers if you need to.",
            "The level on a pending invitation cannot be edited. To change it, cancel and invite again.",
          ] },
        ],
      },
      {
        id: "who-can-invite",
        heading: "Who can invite, and what they can hand out",
        blocks: [
          { p: "Owners, administrators, Dispatchers and Managers can invite. Each can only hand out access below their own: the owner can give any level including Administrator; an administrator any level except Administrator; a Dispatcher or Manager only **Crew** or **Estimator**, with every dial clamped to their own and no switch they do not hold themselves. The form offers only what will be accepted, and the server checks the same rule again when the invitation is created." },
        ],
      },
    ],
    faq: [
      { q: "Can I resend an invitation?", a: "Yes. Press **Resend** beside the pending invitation on Manage Team: a live link is renewed for another 7 days and the email goes out again; an expired one is replaced by a fresh link. An accepted or cancelled invitation cannot be resent." },
      { q: "The person already uses FieldQuo at another company. Can they accept?", a: "Yes. The join page recognises the email, they sign in with their existing password, and they are added to your company with the level you chose." },
      { q: "Why is the Labour cost field missing on my form?", a: "It is shown only to an owner or administrator. A Manager or Dispatcher inviting somebody cannot set a pay rate; the field is hidden rather than silently ignored." },
    ],
  },

  "access-levels-overview": {
    title: "Access levels: who sees what",
    summary:
      "The five access levels — Crew, Estimator, Dispatcher, Manager, Administrator — what each one is made of, what each one sees in the menu, and who is allowed to change them.",
    updated: "2026-09-12",
    intro: [
      "Every person on your team has an access level, chosen when they are invited and changeable afterwards from **Manage Team**. Four of the levels are presets — a filled-in grid of eleven areas and three switches — **Administrator** is everything, and **Custom** is any grid you set yourself.",
      "The rule that makes this safe: hiding a row in the menu is not the security. Every request the app makes is checked again on the server against the same grid, so a person who types the address of a page they were not shown gets a refusal, not the page.",
    ],
    sections: [
      {
        id: "overview",
        heading: "The five levels",
        blocks: [
          { table: {
            head: ["Level", "Who it is for", "Uses a seat"],
            rows: [
              ["[[role-crew|Crew]]", "Installers and helpers: their own schedule, the jobs they are on, their hours. No money, no documents.", "No — free"],
              ["[[role-estimator|Estimator]]", "Writes quotes and manages clients, with prices. Does not run people.", "Yes"],
              ["[[role-dispatcher|Dispatcher]]", "The team lead: everyone's schedule and hours, creates and edits documents, deletes nothing.", "Yes"],
              ["[[role-manager|Manager]]", "Runs the day-to-day, delete included, job costing and payments on. Not payroll, not the company's billing.", "Yes"],
              ["[[administrators|Administrator]]", "Everything the owner has except ownership itself. Only the owner can grant it.", "Yes"],
            ],
          } },
        ],
      },
      {
        id: "levels-and-tiers",
        heading: "Levels and tiers",
        blocks: [
          { p: "Each level card carries a small chip — **Worker tier** on Crew and Estimator, **Manager tier** on Dispatcher and Manager. A tier is the coarser grouping some rules use (who may invite, who may see billing); the level is what the person actually gets. As the screen puts it, two levels can share one tier, so the tier on its own does not tell you which level someone has. The badge on Manage Team names the level; hovering it names the tier." },
        ],
      },
      {
        id: "what-a-level-is-made-of",
        heading: "What a level is made of",
        blocks: [
          { p: "Eleven areas, each a ladder from least to most access — **Schedule**, **Time Tracking & Timesheets**, **Payroll & Payslips**, **Notes**, **Expenses**, **Clients and Properties**, **Requests**, **Quotes**, **Jobs**, **Invoices**, **Safety Incidents** — and three on/off switches: **Show Pricing**, **Job Costing**, **Payments**. A preset is one setting on every dial. Touch any dial and the person becomes **Custom**; see [[the-custom-access-editor|The Custom access editor]] for every rung." },
        ],
      },
      {
        id: "what-each-level-sees",
        heading: "What each level sees in the menu",
        blocks: [
          { table: {
            head: ["Screen", "Crew", "Estimator", "Dispatcher", "Manager"],
            rows: [
              ["Leads, Quotes, Invoices, Service Plans", "No", "Yes", "Yes", "Yes"],
              ["Jobs", "Only their own", "Yes", "Yes", "Yes"],
              ["Clients, Client equipment, Receptionist, Insights", "No", "Yes", "Yes", "Yes"],
              ["Quote reviews, Your team, Team calendar, Timesheets, Subcontractors, Vehicles, Marketing, Designer, Funnels", "No", "No", "Yes", "Yes"],
              ["KPIs, Expenses, Purchasing", "No", "No", "No", "Yes"],
              ["Plan, Refer & Earn, Account & Billing, Payments, Payroll settings, Activity Log, Time Off Policies, Notifications", "No", "No", "No", "No"],
              ["Calendar, To-do, Chat, Time clock, Time Off, Safety, Payroll (their own payslips), Help", "Yes", "Yes", "Yes", "Yes"],
            ],
          } },
          { p: "The last “No” row is owner and administrator only. Administrators and the owner see every row. Settings rows follow the same pattern: **Language**, **Availability** and **Product Updates** for everyone; the price book only with Show Pricing; **Overhead** and **Material Costs** only with Job Costing; **Expense Tracking** only for someone who can see everyone's expenses." },
        ],
      },
      {
        id: "who-can-change-access",
        heading: "Who can change access",
        blocks: [
          { bullets: [
            "Only an owner or administrator changes an existing person's level, makes an administrator, or deactivates somebody. A Dispatcher or Manager can invite and schedule people, but not alter a colleague's standing access.",
            "Everyone hands out only what is below them: the owner any level; an administrator Manager and below; a Dispatcher or Manager Crew or Estimator when inviting, with every dial clamped to their own.",
            "Nobody changes their own access, and nobody re-grades an owner — there is no control for either.",
            "The last owner cannot be demoted or deactivated, and the last active owner or administrator cannot be deactivated. Somebody always has to be able to manage the account.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "What is Custom?", a: "Any grid that does not match a preset exactly. Picking a preset replaces the whole grid; moving one dial afterwards makes the person Custom. Crew is the exception — its dials are fixed and cannot be moved." },
      { q: "If a row is hidden, can the person still reach the data another way?", a: "No. The row is hidden because the page behind it would refuse them; the same grid is checked on the server for every request." },
      { q: "Can I give someone everything except the money?", a: "Manager is that level: quotes, jobs, clients, scheduling and expenses, delete included, but not payroll and not the company's plan, card or subscription." },
    ],
  },

  "role-crew": {
    title: "The Crew level",
    summary:
      "What a Crew login can see and do — their own schedule, the jobs they are assigned to, their hours — what it can never see, and why it is free.",
    updated: "2026-09-12",
    intro: [
      "**Crew** is the level for the people in the van: installers, painters, helpers. It is the only level that is free — a Crew login never uses a seat — and the only level whose dials are fixed, so nothing can be added to it by accident.",
      "The product's own description on the level card: “View their schedule, the jobs they're assigned to, and what to buy for them. Mark work complete and track their time. No prices, quotes, invoices or requests.”",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Crew sits in the **Worker tier**. When you pick it, the editor shows no dials at all and says instead: “Crew access is fixed: their own schedule, the jobs they're assigned to, what to buy for those jobs, and their own hours. No prices, quotes, invoices or requests. Crew don't use a seat — to give someone more than this, pick another level.” That sentence is the whole contract." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "What a Crew member can do",
        blocks: [
          { bullets: [
            "See their own schedule and mark it complete (**Schedule**: View and complete their own schedule).",
            "Clock in and out and correct their own hours (**Time Tracking & Timesheets**: View, record, and edit their own). An entry they edit themselves goes back to pending, so a supervisor re-checks it before it reaches a pay run.",
            "Open the jobs they are assigned to — and only those — read-only: the address, the visit, the checklist and what to buy for it (**Jobs**: View only, scoped to their own).",
            "Log their own expenses (**Expenses**: View, record, and edit their own).",
            "See their own payslips (**Payroll & Payslips**: View their own payslips).",
            "Report a safety incident and see the ones they filed (**Safety Incidents**: Report incidents, and view their own).",
            "Read the client's name and address on their jobs, nothing more (**Clients and Properties**: View client name and address only), and notes on jobs and visits only.",
          ] },
        ],
      },
      {
        id: "what-they-never-see",
        heading: "What they never see",
        blocks: [
          { bullets: [
            "No prices anywhere — **Show Pricing** is off, so money is removed from everything they can read.",
            "No **Leads**, **Quotes**, **Invoices** or **Service Plans**: all four are at No access, and the rows are gone from their menu.",
            "No client book: the **Clients** row is hidden. The address on their job is not a licence to page through your customer list.",
            "No **Job Costing**, no **Payments**, no other person's hours, schedule or expenses, no **Your team**.",
          ] },
        ],
      },
      {
        id: "their-menu",
        heading: "What their menu shows",
        blocks: [
          { p: "**Home**, **Jobs** (theirs), **Calendar**, **To-do**, **Chat**, **Time clock**, **Time Off**, **Safety**, **Payroll** (their own payslips) and **Help**. Under Settings: **Language**, **Availability** and **Product Updates**. On a phone the same screens sit in the crew tab bar — see [[what-a-crew-member-sees|What a crew member sees]] and [[how-fieldquo-works-for-crew|How FieldQuo works for crew]]." },
        ],
      },
      {
        id: "free",
        heading: "Why it is free",
        blocks: [
          { p: "A seat is counted off the grid: somebody who can originate money — create or change quotes, jobs, invoices or leads — is a seat. Crew cannot, so a Crew login is a crew place, included with every plan, and can also sit in an unused seat. The seat panel on Manage Team shows both counts. Detail: [[seats-and-crew-logins|Seats and crew logins]]." },
        ],
      },
    ],
    faq: [
      { q: "Can I give a Crew member one more thing?", a: "Not on Crew — its dials are fixed. Use Custom and move the dial you need, or pick Estimator. Either way the login becomes a seat: any dial above Crew's, or any switch on, is a seat." },
      { q: "Can a Crew member see the client's phone number?", a: "No. Name and address only, and only on the jobs they are assigned to." },
      { q: "A crew member says their Jobs list is empty.", a: "They see only jobs with a visit they are booked on. Assign them to the job's visit and it appears." },
    ],
  },

  "role-estimator": {
    title: "The Estimator level",
    summary:
      "The level for somebody who prices and sends quotes and manages clients, with prices on — but does not run people, payroll or job costing.",
    updated: "2026-09-12",
    intro: [
      "**Estimator** is the salesperson or the second estimator: somebody who should be able to write a quote, add the client, see what it was priced at and send it — without running the shop.",
      "The product's own description on the level card: “Writes quotes and manages clients, with pricing. Doesn't manage people, payroll or job costing.”",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Estimator sits in the **Worker tier**, the same tier as Crew, and it uses a seat. The two dials that make it a seat are **Requests** and **Quotes** at View, create, and edit — a lead becoming a quote is the same act one screen earlier. **Show Pricing** is on, because you cannot write a quote without prices." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "What an Estimator can do",
        blocks: [
          { bullets: [
            "Create and edit leads and quotes, with prices (**Requests** and **Quotes**: View, create, and edit).",
            "Add and edit clients and their properties (**Clients and Properties**: View and edit full client and property info) — you cannot quote somebody you cannot add.",
            "Read every job and every invoice, without editing them (**Jobs** and **Invoices**: View only).",
            "Read all notes (**Notes**: View all notes).",
            "Their own schedule, hours, expenses and payslips only; report a safety incident and see their own.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "What they cannot do",
        blocks: [
          { bullets: [
            "Turn a quote into a job, approve an instant estimate on **Quote reviews**, or assign a quote, job or appointment to somebody else — those are Dispatcher and above.",
            "Delete anything, or edit a job or an invoice once it exists — an estimator who could edit the invoice could quietly move a price after it was agreed.",
            "See cost or margin: **Job Costing** is off, so no KPIs, no Overhead, no Material Costs.",
            "Collect payments (**Payments** is off), run or see anyone else's payroll, invite people, or open **Your team**.",
          ] },
        ],
      },
      {
        id: "their-menu",
        heading: "What their menu shows",
        blocks: [
          { p: "**Leads**, **Quotes**, **Jobs**, **Invoices**, **Service Plans**, **Calendar**, **To-do**, **Clients**, **Client equipment**, **Chat**, **Time clock**, **Time Off**, **Safety**, **Payroll** (their own payslips), **Insights**, **Receptionist** and **Help**. Under Settings, besides Language, Availability and Product Updates: **Products & Services**, **Services & Pricing** and **Instant Quotes**, because Show Pricing is on. Hidden: Quote reviews, Your team, Team calendar, Timesheets, Expenses, Purchasing, Vehicles, Subcontractors, KPIs, Marketing, Plan." },
        ],
      },
    ],
    faq: [
      { q: "Can an Estimator see the rate card?", a: "Yes — Show Pricing is on, and Services & Pricing and Products & Services are in their Settings. That is why this level is a seat and not a free login." },
      { q: "Why can't my estimator approve an instant estimate?", a: "Approving a price a homeowner saw is a supervisor's sign-off in FieldQuo: Dispatcher, Manager, an administrator or the owner. Move them to Dispatcher if that is their job." },
    ],
  },

  "role-dispatcher": {
    title: "The Dispatcher level",
    summary:
      "The team lead's level: everyone's schedule and hours, documents created and edited but never deleted, invitations for crew — without cost, margin or payment collection.",
    updated: "2026-09-12",
    intro: [
      "**Dispatcher** runs the week. Everyone's schedule and everyone's time are editable; quotes, jobs, invoices and leads can be created and edited — but not deleted. It is the level for the team lead who books the crew, moves visits and keeps the week honest, without the power to remove anything.",
      "The product's own description on the level card: “Edit job, team, and client details. Recommended for team leads.”",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Dispatcher sits in the **Manager tier**, shared with Manager — which is why the two look alike in some places and why the badge on Manage Team names the level rather than the tier. The tier is what lets a Dispatcher invite people, approve hours and leave, publish shifts and edit the booking page. It uses a seat." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "What a Dispatcher can do",
        blocks: [
          { bullets: [
            "Edit everyone's schedule (**Schedule**: Edit everyone's schedule) and draft and publish the crew's week on **Assign shifts**.",
            "See, record, edit and delete everyone's hours (**Time Tracking & Timesheets**) and approve them on **Timesheets** before they reach a pay run.",
            "Create and edit leads, quotes, jobs and invoices (all four at View, create, and edit), turn a quote into a job, approve instant estimates on **Quote reviews**, and assign work to people.",
            "Full client records (**Clients and Properties**: View and edit full client and property info); view and edit all notes; see everyone's safety incidents and follow them up.",
            "Invite people — **Crew** or **Estimator** only — approve time off, and open **Your team**, **Team calendar**, **Subcontractors**, **Vehicles**, **Marketing**, **Designer** and **Funnels**.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "What they cannot do",
        blocks: [
          { bullets: [
            "Delete a quote, job, invoice, lead or client — every document dial stops one rung short of delete.",
            "See cost or margin: **Job Costing** is off, so no KPIs, Overhead or Material Costs, and the Vehicles screen shows the van without what it cost.",
            "See anyone else's expenses (**Expenses**: their own), so no Expenses roll-up and no Purchasing.",
            "Collect payments (**Payments** is off), see anyone else's payslips or run payroll, or open the company's billing.",
            "Change an existing person's level, make an administrator, or deactivate anybody — the dropdowns on Manage Team are badges for a Dispatcher.",
          ] },
        ],
      },
      {
        id: "settings-they-see",
        heading: "The Settings rows they see",
        blocks: [
          { p: "Everything gated on running a crew: **Company Settings**, **Branding**, **Manage Team**, **Booking Page**, **Work Areas**, **Custom Fields**, **Email Templates**, **PDF Templates**, **Quote Email**, **Follow-ups**, **Translations**, **Client messages**, **Checklists**, **Job photo tags**, **Email Domain**, **Your website**, **Phone receptionist**, **AI credit**, **AI employee**, **Share your links**, **Bio link**, **Reviews**, plus the price book. Hidden: **Account & Billing**, **Payments**, **Payroll**, **Activity Log**, **Time Off Policies**, **Notifications**, **Meta Ads**, **Refer & Earn**, **Data Migration**, **Overhead**, **Material Costs**, **Expense Tracking**." },
        ],
      },
    ],
    faq: [
      { q: "My dispatcher needs to delete a cancelled job. What do I do?", a: "Delete is what separates Manager from Dispatcher. Either move them to Manager, or open Custom… and raise the Jobs dial alone to View, create, edit, and delete." },
      { q: "Can a Dispatcher make somebody a Manager?", a: "No. A Dispatcher can invite Crew or Estimator only, and cannot change anyone who is already on the roster. Only an owner or administrator re-grades people." },
    ],
  },

  "role-manager": {
    title: "The Manager level",
    summary:
      "The level that runs the day-to-day — quotes, jobs, clients, scheduling and expenses, delete included, with job costing and payments on — but not payroll and not the company's billing.",
    updated: "2026-09-12",
    intro: [
      "**Manager** is the office manager or the partner who runs operations. If the question is “can I give somebody everything except the money?”, this is the answer: everything Dispatcher has, plus delete, plus everyone's expenses, plus job costing and payment collection.",
      "The product's own description on the level card: “Runs the day-to-day — quotes, jobs, clients, scheduling and expenses. Not payroll, and not the company's billing. Recommended for management.”",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Manager sits in the **Manager tier** with Dispatcher, so the two share the same limits on staffing: invite Crew or Estimator only, never re-grade or deactivate anyone. What Manager adds is on the grid — every document dial at its top rung, and all three switches on. It uses a seat." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "What a Manager can do",
        blocks: [
          { bullets: [
            "Create, edit and delete leads, quotes, jobs and invoices, and clients (**Clients and Properties**: View, edit, and delete full client and property info).",
            "Edit and delete everyone's schedule; see, record, edit and delete everyone's hours and approve them; view, edit and delete all notes.",
            "See, record and edit everyone's expenses (**Expenses**: View, record, and edit everyone's) — which opens **Expenses**, **Purchasing** and **Expense Tracking**.",
            "**Job Costing** on: cost per job, margins, **KPIs**, and the cost basis in **Overhead** and **Material Costs**.",
            "**Payments** on: collect payments on quotes and invoices.",
            "Everything a Dispatcher can: invite Crew or Estimator, publish shifts, approve leave and hours, approve instant estimates, and every Settings row gated on running a crew.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "What they cannot do",
        blocks: [
          { bullets: [
            "Payroll: the preset says **View their own payslips**, so a Manager sees their own payslips and nothing about anyone else's pay, and cannot run a pay run. An owner who wants a manager running payroll grants it deliberately, in Custom, with **View everyone's and run payroll**.",
            "The company's billing: **Plan**, **Account & Billing**, **Payments** (the Stripe connection), **Meta Ads**, **Refer & Earn** and **Data Migration** stay with the owner and administrators.",
            "**Activity Log**, **Time Off Policies** and **Notifications** — owner and administrator only.",
            "Change an existing person's level, make an administrator, or deactivate anybody.",
          ] },
        ],
      },
      {
        id: "manager-or-administrator",
        heading: "Manager or Administrator?",
        blocks: [
          { p: "Manager is the level for staff. **Administrator** is a different thing: everything the owner has, billing and everyone's pay included, with no grid to consult — meant for a business partner or a bookkeeper. If somebody needs to see the plan and the card, that is an administrator; if they need to run the shop, that is a Manager. See [[administrators|Administrators]]." },
        ],
      },
    ],
    faq: [
      { q: "Can my Manager run payroll?", a: "Not on the preset. Open Custom… for them and set Payroll & Payslips to View everyone's and run payroll. They stay a Manager in every other respect." },
      { q: "Why can't my Manager see the trial countdown or the plan?", a: "Billing is owner and administrator only. The Plan and Account & Billing rows are hidden from a Manager, and the sidebar's trial countdown is shown to the owner alone." },
    ],
  },

  "administrators": {
    title: "Administrators",
    summary:
      "What Make administrator grants — everything the owner has except ownership — who can grant it, what an administrator still cannot do, and the one-owner rules that protect the account.",
    updated: "2026-09-12",
    intro: [
      "An **Administrator** holds everything the owner holds, with no permission grid to consult: billing, payroll, the Activity Log, every setting, every document, and the power to change anyone else's access. It exists for a business partner or a bookkeeper who must see the plan and the card. It is not a level for staff — that is Manager.",
      "The checkbox on the form says it plainly: “This allows them access to everything within the account — including billing, reports, client list editing, and all user permissions.”",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "On **New User** and in the access editor, **Make administrator** is a checkbox above the level cards. Tick it and the cards and the grid disappear — the tier is the whole answer, so there is nothing to dial. On Manage Team an administrator shows as **Administrator** in the Role column, and the seat panel counts them under **Administrators**. An administrator always uses a seat." },
        ],
      },
      {
        id: "make-an-administrator",
        heading: "How to make an administrator",
        blocks: [
          { steps: [
            "Open **Manage Team**. You must be the owner: **Make administrator** is offered only to somebody who may hand out the Administrator level, and that is the owner alone.",
            "In the person's **Role** dropdown pick **Administrator** — or pick **Custom…**, tick **Make administrator** and press **Save**.",
            "To take it back, pick any other level from the same dropdown. Their grid is replaced by that level's; they keep their login.",
          ] },
          { note: "When inviting, the same checkbox sits under **Permissions** on New User. A pending Administrator invitation shows its level beside the **Invited** badge, so it can be cancelled before it is accepted." },
        ],
      },
      {
        id: "what-they-get",
        heading: "What an administrator gets",
        blocks: [
          { bullets: [
            "Every row in the menu and every Settings row, including **Account & Billing**, **Payments**, **Meta Ads**, **Refer & Earn**, **Data Migration**, **Activity Log**, **Time Off Policies** and **Notifications**.",
            "Billing: change the plan, the card and the subscription. Payroll: run pay runs and edit deductions and payslip components.",
            "Team: invite anyone below them (Crew, Estimator, Dispatcher, Manager), change those people's level, and activate or deactivate them.",
            "The permission grid does not apply to them — every dial reads as its top rung and every switch as on.",
          ] },
        ],
      },
      {
        id: "what-stays-with-the-owner",
        heading: "What stays with the owner",
        blocks: [
          { bullets: [
            "Ownership itself. The owner is the account that registered the company; FieldQuo has no control to transfer it, and no one — administrators included — can re-grade or deactivate an owner from the roster.",
            "Making another administrator. Everyone can only hand out access strictly below their own, so an administrator can grant Manager and below, never Administrator.",
            "Editing another administrator: same rank, no dropdown.",
            "The trial countdown in the sidebar is shown to the owner alone, though an administrator can open Account & Billing and act on it.",
          ] },
          { warning: "The last active owner or administrator cannot be deactivated, and the last owner cannot be demoted. The screen refuses with “That's the last active owner or admin. Someone has to be able to manage the account — promote or reactivate somebody first.”" },
        ],
      },
    ],
    faq: [
      { q: "Should my office manager be an administrator?", a: "Usually not. Manager gives them the whole day-to-day without your billing and everyone's pay. Reserve Administrator for a partner or a bookkeeper." },
      { q: "I am an administrator and I can't make my colleague one. Why?", a: "Only the owner can. An administrator hands out Manager and below." },
      { q: "Can an administrator lock the owner out?", a: "No. The owner's row is read-only for everyone, and the last owner can never be deactivated." },
    ],
  },

  "the-custom-access-editor": {
    title: "The Custom access editor",
    summary:
      "The grid behind every level — eleven areas, three switches — how to open it for a new or an existing person, what each dial does, and what you are allowed to hand out.",
    updated: "2026-09-12",
    intro: [
      "Every level except Administrator is a grid: eleven areas, each a ladder from least to most access, and three on/off switches. The four presets are filled-in grids. **Custom** is the same grid with your own settings on it.",
      "The same editor is used on **New User** and, for someone already on the team, from the **Custom…** entry of their Role dropdown on **Manage Team** — so what you can set at invitation you can also change later.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The editor opens as **Access for …** with one line of instruction: “Pick a starting point, then change anything you like. They keep the same login.” Top to bottom: **Make administrator** (owner only), the four level cards with their tier chips, the **Custom** card, the eleven dropdowns, and the three checkboxes. **Cancel** closes without saving; **Save** applies the grid at once." },
          { figure: "harness:access-editor", caption: "Manage Team — the Custom access editor open on an Estimator: Make administrator, the four level cards with their tier chips, Custom, and the first dials." },
        ],
      },
      {
        id: "open-the-editor",
        heading: "How to open it",
        blocks: [
          { steps: [
            "For somebody on the team: **Manage Team** → their **Role** dropdown → **Custom…**. The panel opens showing the level they have now, or Custom if their grid matches none.",
            "For somebody new: **Add User** → under **Permissions**, press the **Custom** card (“Set each permission below individually.”).",
            "Press a level card to load its grid, then move any dial. The moment you touch a dial the card un-highlights: the person is now Custom.",
            "Press **Save**. A Custom grid that is above Crew on any dial uses a seat, and the save is refused if your plan has none free.",
          ] },
        ],
      },
      {
        id: "the-eleven-areas",
        heading: "The eleven areas",
        blocks: [
          { table: {
            head: ["Area","Rung 1 (lowest)","Rung 2","Rung 3","Rung 4","Rung 5"],
            rows: [
              ["Schedule","View their own schedule","View and complete their own schedule","Edit their own schedule","Edit everyone's schedule","Edit and delete everyone's schedule"],
              ["Time Tracking & Timesheets","View and record their own","View, record, and edit their own","View, record, edit, and delete everyone's","—","—"],
              ["Payroll & Payslips","No access","View their own payslips","View everyone's payslips","View everyone's and run payroll","—"],
              ["Notes","View notes on jobs and visits only","View all notes","View and edit all","View, edit, and delete all","—"],
              ["Expenses","View, record, and edit their own","View, record, and edit everyone's","—","—","—"],
              ["Clients and Properties","View client name and address only","View full client and property info","View and edit full client and property info","View, edit, and delete full client and property info","—"],
              ["Requests","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Quotes","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Jobs","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Invoices","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Safety Incidents","No access","Report incidents, and view their own","View everyone's incidents","View everyone's incidents and follow up on them","—"],
            ],
          } },
          { p: "A dash means the ladder stops there; the last filled cell is the top rung. **Requests** is the Leads screen. **Jobs** at No access withholds the job record, not the work: the schedule, the visit checklist and the clock are their own areas, so a crew member still sees their day. The top rung of Time Tracking is the one that deletes an entry, and the payroll ladder deliberately starts at “their own”: one employee seeing another's pay is an incident, not a setting." },
          { note: "The **Notes** dial gates the internal notes on people — a lead's call-back log and a client's private notes: read them at **View all notes**, write them at **View and edit all notes**, remove a lead note at **View, edit and delete all notes**. Below that a person sees “hidden by your access level” where the notes would be. Notes on a visit itself stay readable at every level, and a quote's or an expense's notes belong to that document, not to this dial." },
        ],
      },
      {
        id: "the-three-switches",
        heading: "The three switches",
        blocks: [
          { bullets: [
            "**Show Pricing** — “See prices on quotes, invoices and jobs, and edit them. Without it, money is removed from what this person can read as well as write.” Off, it also hides the price book, Insights and every priced PDF.",
            "**Job Costing** — “Show job profit by tracking revenue and costs from line items, labor, and expenses.” Needs Show Pricing, time tracking, expenses and jobs access. It also gates the cost basis: Overhead, Material Costs, KPIs.",
            "**Payments** — “Allow payment collection on quotes and invoices.” Needs Show Pricing, edit access to Clients and Properties, and edit access to Quotes and/or Invoices.",
          ] },
          { p: "Two informational lines sit under the grid on New User and are not dials: client communications and reports follow from the other permissions the person holds." },
        ],
      },
      {
        id: "what-you-can-hand-out",
        heading: "What you can hand out",
        blocks: [
          { p: "An owner or administrator sees every rung and every switch. A Dispatcher or Manager sees each ladder only up to their own rung, and only the switches they hold themselves — a level you do not hold is not yours to delegate. The server applies the same clamp when it saves, so a grid that arrived by other means is cut down to the same line. Changing an existing person's grid at all is owner and administrator only; a Dispatcher or Manager meets this editor on New User alone." },
          { note: "**Crew** shows no dials. Picking it locks the grid to the free level; to give somebody more than Crew, start from another card or from Custom — and that makes them a seat." },
        ],
      },
    ],
    faq: [
      { q: "Does a Custom grid use a seat?", a: "Yes, unless every dial is at or below the Crew level and no switch is on. Any single dial above Crew's makes the login a seat, whatever the rest says." },
      { q: "I picked a preset and the badge says Custom.", a: "A dial was moved after the preset was loaded — by you, or by somebody earlier. Pick the preset again from the Role dropdown to replace the whole grid." },
      { q: "The setting I chose came back lower.", a: "You cannot hand out more than you hold. The server clamped the grid to your own rung on that area; ask an owner or administrator to set it." },
    ],
  },

  "seats-and-crew-logins": {
    title: "Seats and crew logins",
    summary:
      "What counts as a seat, why a Crew login is free, how the seat panel on Manage Team counts people against your plan, and what happens when you are full.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo bills by **seats**, and a seat is read off a person's access — not off a job title. Somebody who can originate money is a seat; somebody who cannot is a crew login, and crew logins are included free with every plan.",
      "That is why a twelve-person painting company with two people in the office is a two-seat company. The panel at the top of **Manage Team** shows both numbers side by side.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The seat panel reads, for example, **4 / 6 seats used** and **3 / 11 crew — included free**, with a breakdown underneath (**1 Administrators · 1 Managers · 1 Dispatchers · 1 Workers · 3 Crew**). Seats and crew have separate caps and separate buttons — **Add a seat** and **Add crew — free** — and each closes independently: a full seat cap does not stop you adding crew, and vice versa." },
        ],
      },
      {
        id: "what-counts-as-a-seat",
        heading: "What counts as a seat",
        blocks: [
          { bullets: [
            "The owner and every administrator, always.",
            "Every Estimator, Dispatcher and Manager — each holds at least one document dial at View, create, and edit.",
            "Any Custom grid that goes above the Crew level on any dial, or has any switch on. Free is defined by a ceiling — the Crew preset, dial for dial — not by a short list of areas, so one raised dial is a seat however it arrived.",
            "A pending invitation, from the moment it is sent, at the level it carries.",
          ] },
          { p: "A deactivated person counts in neither column. A Crew login is anyone at or below that ceiling; the seat panel's **Crew** count is exactly those people." },
        ],
      },
      {
        id: "the-plans",
        heading: "Seats and crew places on each plan",
        blocks: [
          { table: {
            head: ["Plan", "Seats", "Crew logins included free", "People in total"],
            rows: [
              ["Solo", "1", "5", "6"],
              ["Crew", "3", "8", "11"],
              ["Shop", "6", "11", "17"],
              ["Scale", "10", "15", "25"],
            ],
          } },
          { p: "A crew member may sit in an unused seat, because a seat holds strictly more access than a crew place: the rule is seats within the seat cap, and everybody within seats plus crew. Twenty technicians and two in the office fit Scale. Prices and the switch between monthly and a year's commitment are on [[the-four-plans|The four plans]]." },
        ],
      },
      {
        id: "when-you-are-full",
        heading: "When you are full",
        blocks: [
          { bullets: [
            "The button for the full kind greys out — “You've used every seat on your plan.” or “You've used every crew place on your plan.” — and the sentence beside it names the next plan that would fit: “You've used all your seats. Shop covers 6 seats and 11 crew.” An owner or administrator also gets an **Upgrade** link to Account & Billing.",
            "Sending an invitation or moving somebody up a level is refused server-side with the same numbers, even if a second tab still showed room.",
            "To free a seat: deactivate somebody who has left, cancel a pending invitation, or move a person down to **Crew**. The panel updates on the next load.",
            "Beyond Scale the sentence changes to “You've outgrown the plans we sell online — talk to us.”",
          ] },
          { tip: "The invite form is the honest guide: **Add crew — free** opens it on Crew, **Add a seat** on Dispatcher, and the level card you land on tells you which kind of place you are about to use. Detail on buying: [[add-a-seat-or-a-crew-login|Add a seat, or a free crew login]] and [[your-plan-and-seats|Your plan and seats]]." },
        ],
      },
    ],
    faq: [
      { q: "Is a Crew login really free?", a: "Yes. Every plan includes a number of crew places at no charge, and a Crew login can also occupy an unused seat. The seat panel says how many of each you have." },
      { q: "Why did adding one dial to a crew member use a seat?", a: "Free is a ceiling, not a category. Any dial above the Crew preset's — or any switch on — is a seat, because that is what lets a person create or change quotes, jobs, invoices or leads." },
      { q: "Does a pending invitation use a seat?", a: "Yes, at the level it carries, from the moment it is sent. Cancel it to get the place back." },
    ],
  },

  "deactivate-a-team-member": {
    title: "Deactivate a team member",
    summary:
      "How to switch off somebody's login with the Active checkbox, what changes and what stays, who may do it, and the rules that stop an account locking itself out.",
    updated: "2026-09-12",
    intro: [
      "When somebody leaves, you deactivate them: untick **Active** on their row in **Manage Team**. Their login stops working for your company, their seat or crew place is freed, and everything they did stays on the books.",
      "Deactivation is not deletion. FieldQuo has no control on this screen that erases a person, because their quotes, their hours and their pay history are your records, not theirs.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every roster row ends in an **Active** checkbox. Ticked means the person can sign in; unticked means they cannot. The checkbox is live only for an owner or administrator and only on rows below their own rank; otherwise it is greyed out and its tooltip says why — “Only an owner or administrator can activate or deactivate a team member” or “You can only deactivate members below your own role”." },
          { figure: "harness:team", caption: "Manage Team — the Active column on the right; the owner's own row is greyed, every row below is live." },
        ],
      },
      {
        id: "how-to",
        heading: "How to deactivate somebody",
        blocks: [
          { steps: [
            "Open **Manage Team** — **Your team** in the sidebar, or **Settings → Manage Team**.",
            "Find the person and untick **Active**. The change saves immediately; there is no confirmation step.",
            "Check the seat panel: their seat or crew place is free again on the next load.",
          ] },
          { note: "To bring somebody back, tick **Active** again. They keep their login, their level and their grid, and they count against your plan again." },
        ],
      },
      {
        id: "what-changes",
        heading: "What changes, and what stays",
        blocks: [
          { bullets: [
            "They can no longer sign in to your company: every screen and every request refuses a deactivated member. If they also belong to another company on FieldQuo, that company is unaffected.",
            "They stop counting against your plan — seat or crew place — at once.",
            "Everything stays: quotes, jobs, invoices, time entries, pay runs, safety reports, and their worker record on **Workers**, which can still be paid what it is owed.",
            "The change is written to the **Activity Log** as “Deactivated …”, with who did it and when; reactivation is logged the same way.",
          ] },
        ],
      },
      {
        id: "the-rules",
        heading: "The rules",
        blocks: [
          { bullets: [
            "Owner and administrator only. A Dispatcher or Manager can invite people and schedule them, but cannot switch anyone's login off — that is the owner's call, not the roster editor's.",
            "Only somebody below your own rank: an administrator cannot deactivate another administrator or the owner.",
            "Never yourself — “You can't deactivate your own account — you'd lock yourself out.”",
            "Never the last owner, and never the last active owner or administrator: somebody always has to be able to manage the account.",
          ] },
        ],
      },
      {
        id: "invitations",
        heading: "Somebody who never accepted",
        blocks: [
          { p: "A person who was invited and never joined has no login to deactivate. Their row shows **Invited**; press **Cancel invite** and confirm. The link stops working and the place is freed. Any Dispatcher, Manager, administrator or owner can cancel an invitation." },
        ],
      },
    ],
    faq: [
      { q: "Does deactivating delete their hours or their payslips?", a: "No. Nothing is deleted. Their time entries, pay runs and documents stay exactly as they were." },
      { q: "Can a Manager deactivate a crew member who left?", a: "No. Only an owner or administrator can untick Active. The Manager sees the checkbox greyed out with the reason." },
      { q: "I deactivated someone by mistake.", a: "Tick Active again. Nothing was lost; they sign in as before with the same level." },
    ],
  },
};
