# Who sees what — the confirmation (3 October 2026, updated 4 October)

You asked: when a quote or a job is shared with a teammate, does each person
see only what fits their access? Crew should get the scope of work and the
address, and never prices, cost or margin.

**Yes, and it is now proven per role.** Every row below was checked by calling
the real server code as a member of that role and reading exactly what came
back. Checking only what the screen draws would not be enough: a hidden column
can still be sent to the phone. The proof is
`npm run check:role-access`, 227 checks, all passing (168 on 3 October;
§9–§11 and the richer §3 were added on 4 October from the live test with
Joe on the Crew preset — see "4 October: the live test" below). Before the
3 October fixes, **40 of those checks failed**. "Leaks found and fixed" at
the bottom says what they were.

**Verified by:** every "§" is a section of `check:role-access`. Where a row is
proven by a different, older check, that check is named on the row instead.
"Logged" means the action is written to the activity log under the person's
own name.

---

## Crew

The default for field staff. They are free seats.

| | Sees | Can do | Logged |
|---|---|---|---|
| **Job** | Only jobs they are booked on — a visit assigned to them, **or a published shift of theirs with that job picked** (from publication until 14 days after the shift ends; a draft, an open shift or somebody else's grants nothing) §9: title, address and site address, dates, visits and the notes on them, change-order *descriptions*, checklist, photos. Not the client preparation guide card (office information, 403) §10 | Mark their visit on-my-way / started / done, write the visit note, fill in the checklist, add photos, write the daily log, log equipment used | Yes: visit status and notes, checklist, photos, daily log, equipment §8 |
| | **Never:** deposit / payment schedule, change-order prices, invoice numbers, cost-review notes §1 | **Cannot:** edit the job, move or cancel a visit, book a new visit, log a change order §8 | |
| **Work order** (the link "Share with team" sends) | Scope per area: what, how many and in what unit ("Cabinet Refinishing × 32"), door and drawer counts, colour / sheen / door style / coats, which product, what's included, the crew note, hours (the quote's labour estimate when the areas have none); the options the client chose (a two-tone finish); the materials list with quantities; the checklist; visit notes; address; PO number §3 | Tick an area done, add photos to it | Yes: area ticks §8 |
| | **Never:** any price, rate, total, deposit, margin, or the client's phone/email §3 | | |
| **Quote** | Nothing. The quote link refuses them (403) and says so §4 | — | — |
| **Client** | Only the households on their jobs: name and address §5 | — | — |
| | **Never:** email, phone, private notes, portal link, the client's other quotes, invoices or jobs §5 | **Cannot:** edit the client §8 | |
| **Invoice** | Nothing (403) §6 | — | — |
| **Files / photos** (permits, drawings) | Plans, permits, warranties and photos on their jobs. Priced documents (quote, contract, invoice PDFs) are hidden. Verified by `check:job-documents-autofile` | Add photos, comment on them §10 | Yes |
| | | **Cannot:** put a photo on the company website, change its stage, manage photo tags (403; the controls and the words about them are not drawn) §10 | |
| **Notes** | Visit notes on their jobs. Not the client's private notes, not lead call logs (`check:notes-dial`) | Write the note on their own visit | Yes §8 |
| **Time** | Their own hours and their own pay rate, nobody else's (`check:rbac-redaction`, `check:timesheet-approval`) | Clock in/out on their own jobs (a job on a published shift today is suggested, `check:time-clock-job`), ask for a correction to their own entry, naming any job they may book time to (`check:time-activities` §11b) | The timesheet is the record |
| **Time off** | Their own balances and requests | Request time off; with **no leave policies set up**, still request **unpaid** time off (dates + reason, pending approval, no balance) §11 | Yes |
| | | **Cannot:** clock hours onto a job they are not on §8 | |
| **Materials / expenses** | The buy list for their jobs, without costs (`check:crew-access`) | File their own receipt on their own job | Yes §8 |
| | | **Cannot:** put cost on a job they are not on, or add a recurring fixed cost (rent etc.) §8 | |
| **Costing / margin** | Nothing | — | — |
| **To-dos** | Their own, plus open steps on their jobs §7 | Start / finish those steps | Yes |
| | **Never:** the office's invoice chases or quote follow-ups §7 | **Cannot:** tick an office to-do off §7 | |
| **Calendar / search** | Their own day. Unassigned appointments show without invoice or quote numbers. Search finds only their clients and jobs, with no emails §7 | | |
| **Activity log** | No (owner and admin only) §8 | | |

**If a crew member needs the client's phone number:** in Team → Edit access,
set **Clients and Properties** to "View full client and property info". Be
aware this also shows them the **whole job board**, not just their own jobs.
That is the current rule: the job list is the client book in another shape.
If you want "phone yes, whole board no", that is a new setting and needs your
decision (see "Owed" below).

## Estimator

Writes quotes and looks after clients, *with* prices. Does not see cost or margin.

| | Sees | Can do |
|---|---|---|
| **Quote** | Everything, priced §4 | Create, edit, send (not delete) |
| | **Never:** margin / cost in the AI price review §4, a subcontractor's cost and the markup on it | **Cannot:** turn a quote into an invoice (the button is gone; the office does it) |
| **Job** | Every job, priced (deposit schedule, change-order prices) §1 | View only. The "New invoice", "Log a callback job", "Set dates" and "Add visit" buttons are hidden |
| | **Never:** cost-review notes §1, job costing | |
| **Client** | Full record, with quotes and invoices §5 | Create and edit |
| **Invoice** | View, priced. No margin §6 | — |
| **Notes** | All notes (read) | — |
| **Time / schedule** | Their own | Complete their own visits; cannot move or book them |

## Dispatcher

Runs the schedule and the crews, *with* prices. Does not see cost or margin.

| | Sees | Can do |
|---|---|---|
| **Quotes, jobs, invoices** | Everything, priced §1 §4 §6 | Create and edit (not delete), convert a quote to an invoice |
| | **Never:** margin, job costing, cost-review notes, subcontractor cost/markup | |
| **Clients** | Full | Create and edit |
| **Schedule / time** | Everyone's | Edit everyone's schedule and timesheets |
| **Notes** | All | Read and write |
| **Pay** | Their own only | — |

## Manager

Runs the day-to-day. Sees and edits everything on quotes, jobs, clients and
invoices, **including job costing and margin** §1 §4. Can delete. Can take
payments. **Not** everyone's payroll, and **not** the company's FieldQuo
billing. Cannot read the activity log §8.

## Owner and Admin

Everything, including the activity log §8.

---

## "Share with team"

From a quote, Send → **Share with staff** posts into your team chat:

- **The quote link** opens for people who can see quotes (Estimator and up).
  Crew get a clear "no access" page, not a fake "not found".
- **The work order link**, once the quote is a job, opens for the crew booked
  on that job. It shows the scope and the address with no prices (§3).
- If you share it directly to one crew member before there is a job, it
  refuses and tells you why. Otherwise you would be sending them a link they
  cannot open.
- **4 October:** shared directly to one person who cannot open quotes, the
  message carries **only the work order** — not the office quote link. Into
  a room, both links go, the crew's line **first**, each labelled ("For the
  crew — work order, no prices" / "For the office — quote …")
  (`check:share-staff`).
- **4 October (phase 3):** the share is now a **card** — a work-order card
  once the quote is a job, a quote card before. Each reader's chat draws it
  with their own access: crew on the job open the work order, people who
  can open quotes also get the quote, everybody else "Office only". The
  text links above are what is posted if the card is refused.

The job page itself has no share button yet. The job's chat room already
includes everyone booked on it — on a visit or, since 4 October, a published
shift (`check:company-chat` §2b).

---

## Team chat: channels and group chats (4 October 2026)

Owner decisions: only the office makes, renames and archives channels;
anybody starts a group chat. Checked by the server on every change
(`lib/company/chat/rules.js`), executed per role by `check:role-access`
("Team chat channels and groups") and `check:company-chat` §15–25.

| Action | Owner / Admin | Manager / Dispatcher | Estimator / Crew |
|---|---|---|---|
| Make a channel | Yes | Yes | **No** (403 `not_allowed`, nothing written) |
| Start a group chat (no size limit) | Yes | Yes | Yes |
| Join a public channel | Yes | Yes | Yes |
| Rename, topic, public/private, office-only posting, include everyone, archive | Any channel they are in | Only channels they manage (made) | **No** |
| Add / remove people in a channel | Any channel they are in | Channels they manage | **No** |
| Rename a group, add people to it | Anybody in the group | Anybody in the group | Anybody in the group |
| Remove people from a group | Yes, when in it | If they started it | If they started it |
| Post in an office-only channel (#announcements) | Yes | Yes | **No** — reads only (403 `office_only`) |
| Post in an archived channel | No | No | No — archived is read-only |
| See a private channel they are not in | **No — 404**, owner included | No — 404 | No — 404 |
| "Seen by" on a message | Room members only | Room members only | Room members only |

- A private channel is invisible to anybody not in it: not listed, not in
  Browse channels, its thread, members, Seen by and bell link all answer
  404 — the same as a room that does not exist.
- "Manage" is re-read from the session's role each time: a supervisor
  demoted to Crew stops managing the channels they made.
- A read-only support session sees every room and changes nothing (403
  `read_only` on every write); it gets no Seen by and no unread digit.
- Crew see: their job rooms, #general, the channels they are in (and public
  ones in Browse), their DMs and groups. Nothing else is listed.
- Anyone at the company can read a public channel, crew included — the
  create dialog says so. Free text cannot be policed; client details belong
  in the job's room.

### Photos, files, cards, edit, remove, pins, search (4 October 2026, phases 3–4)

Executed per role through the shipped routes by `check:role-access` ("Team
chat phases 3–4") and against the store by `check:company-chat` §26–36.

| Action | Owner / Admin | Manager / Dispatcher | Estimator / Crew | Support session (read-only) |
|---|---|---|---|---|
| Send photos / documents in a room they can post in | Yes | Yes | Yes | No |
| Open a chat photo or file | Rooms they are in | Rooms they are in | Rooms they are in | Every room (read) |
| …in a private channel they are not in | **No — 404**, owner included | No — 404 | No — 404 | Yes (read) |
| …with somebody else's link, or an expired one | No (404 / 410) | No | No | No |
| Save a chat photo to job photos | Any company job | Jobs they see | **Crew: only jobs they are on** | No |
| …and feature it on the website | No — saved unfeatured | No | No | No |
| Share a job / work order card | Jobs they see | Jobs they see | Their jobs | No |
| Share a quote card | Yes | Yes (quotes view) | Estimator yes; **Crew no** (`bad_card`) | No |
| See a quote card's number and client | Yes | Yes | Estimator yes; **Crew: "Office only"** | Yes |
| See any price on any card | **No — no card carries money** | No | No | No |
| Reply | Where they can post | Where they can post | Where they can post | No |
| Edit a message | Own, ≤ 15 min (server clock) | Own, ≤ 15 min | Own, ≤ 15 min | No |
| Remove a message | Own any time; others' in channels they are in | Own; others' in channels they manage | Own only | No |
| Read a removed message | **No — nobody**, owner included | No | No | **No** |
| Pin / unpin | Any room they are in | Any room they are in | DMs and groups (and groups/channels they manage) | No |
| Search | Rooms they are in | Rooms they are in | Rooms they are in — never a private channel they are not in | Every room (read) |

- A file link is bound to the reader and expires after an hour; the
  Cloudinary link it redirects to expires after five minutes. The stored
  Cloudinary URL is never sent to a browser.
- Removing somebody else's message is in the activity log ("removed
  somebody's message in #…") — who and where, never the words.

---

## Leaks found and fixed

Each row is one or more failing checks in `check:role-access` before today, and
passing after. Severity is how bad it would be if a crew member, or a rival who
got a crew login, saw it.

| Severity | What leaked | To whom | Where | Before → After |
|---|---|---|---|---|
| **High** | The deposit / payment schedule, in dollars | Crew | Job page (`GET /api/jobs/[id]`) | "Deposit 50% $4,500" sent and shown → not sent |
| **High** | Change-order prices ("+$450"), the "agreed changes" total, the invoice number | Crew | Job page, change-order list | Sent and shown → scope only, no price, no invoice |
| **High** | Every quote and invoice a household ever had (titles, lines, status), every job for that client, and the AI review's price and margin | Crew | Client page (`GET /api/clients/[id]`) | Open for any client in the company → only their own clients, no quotes or invoices |
| **High** | The office's to-dos, e.g. "Follow up payment on INV-0007", which crew could also tick off as done | Crew | To-do list (`/api/tasks`) | Visible and closable → hidden and refused |
| **High** | Add-on and change-order amounts for *any* job | Anyone signed in | Daily sheets (`/api/daily-sheets/upsells`) | Any job → only jobs you are on |
| Medium | Every client's name and address in the company | Crew | Client list, search | Whole book → their own clients |
| Medium | A client's email as the search subtitle; searching by phone number found the household | Crew | Search, client list | Shown / matched → not shown, not searchable |
| Medium | Margin and cost from the stored AI price review | Estimator, Dispatcher | Quote, quote list, client page, invoice's quote | Sent → removed without job costing |
| Medium | Subcontractor's cost and your markup on it | Estimator, Dispatcher | Quote "Imported costs" | Shown and editable → client price only |
| Medium | Cost-review note ("came in $400 over on labour") | Crew, Estimator, Dispatcher | Job page and job list | Sent → removed without job costing |
| Medium | Moving or cancelling a visit (which texts and emails the client), booking new visits | Crew | Visit routes | Allowed → refused; they can still complete their own |
| Medium | Deleting or un-requiring checklist items to get past "required" | Crew | Job checklist | Allowed → filling only; adding a template still works |
| Medium | Hours or receipts booked onto any job; adding a recurring fixed cost (rent), which feeds the minimum-price floor | Crew | Time entries, expenses | Allowed → only their jobs; fixed costs need Manager |
| Low | Invoice and quote numbers on calendar appointments and the "what is this about" search | Crew | Calendar, appointments | Shown → hidden below quote/invoice access |
| Low | The quote's number, status and terms paragraph in the AI assistant's "upcoming work" | Crew | Copilot | Sent → removed without quote access |
| Low (custom access only) | Money that the redactors' field lists had missed: offline discount, tax breakdown, refunds, the amended invoice's other versions, add-on amounts, the kitchen rate card | Anyone given documents but **not** prices | Quotes, invoices, add-ons, kitchen | Sent → removed |

**Activity log:** crew work is now written under the person's name: visit
status, notes and photos; checklist; daily log; equipment; work-order ticks;
to-do steps; receipts edited or deleted; visits booked. Before, most of it was
not logged.

**Screens now match the server.** No "$NaN" or "$0" columns appear for crew,
and these buttons no longer answer "not allowed":
- New invoice, Log a callback job, Set dates, Add/Schedule a visit
- The "From quote" link
- Suggested tasks
- A colleague's checklist, and a colleague's plan-step buttons
- Reschedule and Cancel on a visit
- Convert to invoice (for Estimators)

## 4 October: the live test

Owner as Owner, Joe on the Crew preset, TrueFinish Cabinets Inc.:

| Found | Now | Proof |
|---|---|---|
| A published shift with "Job (optional)" put Joe on My schedule, but the job page said "Not found", the clock did not list it, and he was not in the job's chat | A published shift on a job grants the job like a visit — job page and every job route, work order, chat room, clock picker, receipts, photo mentions — from publication to 14 days after the shift ends. Drafts grant nothing. My schedule links the job and its work order | role-access §9, time-clock-job, company-chat §2b, crew-access |
| My schedule showed shifts only; a visit on My day was missing | My schedule shows the person's visits too, from the same read as My day | employee-home |
| A DM to crew carried the quote link they cannot open | Work order only to a crew DM; rooms put the crew line first | share-staff |
| Work order: "0 h across 1 areas · Cabinet Refinishing · 0 h" | Quantities, counts, finish, included, chosen options, materials, checklist, visit notes, hours — still no money | work-order §8, role-access §3 |
| Crew job page: homeowner upload copy, "Tap the star…", "Manage tags", the prep guide card | Job wording; website/tag/stage controls and words for curators only (server already refused); prep guide hidden and refused | role-access §10 |
| Jennifer's launcher covered Send on the chat | Hidden on chat screens | dock §6 |
| Crew More: "Assign shifts" | "My shifts" (or "Team shifts" for a view-only supervisor) | nav-audit §6 |
| Add visit: the return-reason error outlived the unticked box | Errors clear when their field changes | job-controls §3 |
| No leave policies → crew could not ask for anything | Unpaid time off can still be requested; the owner's note stays | role-access §11, leave-templates |
| Correction form had no job | Job picker always offered, scoped to their jobs | time-activities §11b |
| /app/timesheets was a 404 | Alias to Timesheets (or the person's own Time log) | nav-audit §7 |

## Owed: your decisions

1. **Client phone for crew without opening the whole board.** Today, giving a
   crew member the phone also opens every job. A separate "phone on my jobs"
   setting is possible; say if you want it.
2. **Crew ticking materials as bought.** This is currently office-only (it
   needs job editing). Crew see the buy list but cannot tick it.
3. **Crew upsell credit on daily sheets.** Crew see the amount of an upsell
   they sold on their own job, because their bonus is calculated on it. If you
   would rather they saw "sold" with no amount, that is a small change.
4. **Activity log for Managers.** It is owner and admin only today.
5. **How long a shift keeps its job open.** Chosen: from publication until
   14 days after the shift ends (so a fortnightly pay period's corrections,
   late receipts and photos still find the job). A visit has no end date.
   Say if you want shifts to behave exactly like visits (no end), or a
   shorter window.
6. **Unpaid time off with no policies.** Chosen: unpaid only, approval
   required, filed under one "Unpaid time off" policy FieldQuo creates on
   the first request (hidden from your policy list). Say if you would rather
   it were offered only once you have set up policies.
