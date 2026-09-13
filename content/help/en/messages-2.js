// content/help/en/messages-2.js
//
// Part 2 of the “messages” category in English (see the composer,
// messages.js). Slugs assigned to this part (lib/help/tree.js):
// follow-up-rules, notifications-for-you, send-from-your-own-domain,
// the-phone-receptionist, the-receptionist-call-log, quote-callbacks,
// the-crew-inbox, team-chat, texting-clients-what-is-and-is-not-automated.
//
// Every sentence below was read off the code on 2026-09-12: the page
// modules under app/app/**, the routes they call, and the rules in
// lib/followUps, lib/notify, lib/email, lib/voice, lib/crew, lib/company/chat
// and lib/sms. Prices are the constants those modules export (35¢ a minute,
// $4 and $9 rentals, 2¢ a text, 5¢ a photo, 30 free minutes) — change the
// constant and change the sentence. Labels are the `en` block of
// app/i18n/appMessages.js.
export const ARTICLES = {
  "follow-up-rules": {
    title: "Follow-up rules",
    summary:
      "Chase a quiet quote, an overdue invoice or a finished job by email, automatically, on a delay you choose — and what stops each rule.",
    updated: "2026-09-12",
    intro: [
      "A follow-up rule is one sentence: a set time after a quote, an invoice or a job reaches a certain state, send this email template. FieldQuo checks every active rule once a day and sends the template to the client of anything that has crossed the line — a quote sitting at sent for three days, an invoice five days past due, a job completed two days ago — without anyone remembering to.",
      "This article covers the **Settings → Follow-ups** screen: the three triggers, the delay, which templates a rule can send, what pauses and stops one, and who receives nothing.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every rule sends exactly one thing by one channel: an email template. There is no text-message follow-up and no in-app task — the screen draws a single **Send email** step because that is the only step there is. Two rules can share a trigger (a soft nudge at 3 days and a firmer one at 7), each pointing at a different template, and each quote, invoice or job gets each rule's email once and only once." },
          { p: "The email goes out under your company's name — from your own verified domain if you have one (see [[send-from-your-own-domain|Send email from your own domain]]), otherwise from FieldQuo's shared address — and replies go to your company email, falling back to the account owner's address so a reply is never lost." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "The page is titled **Follow-ups** — “Automatically send a template a set time after a quote, invoice, or job hits a certain state — no manual reminders.” Top to bottom:" },
          { bullets: [
            "**How these run** — a read-only picture drawn from your rules: **Trigger** → **Wait …** → **Send email** → **Stops**. It is generated from the list, not drawn by hand, so it cannot disagree with what the rules do. It appears only once you have at least one rule.",
            "The rule list — one row per rule: its name, then “3 days **after** Quote sent, no response → Quote follow-up (default)”, then the two exit sentences (“Stops as soon as the client accepts or declines the quote.” “Each quote gets this email once.”). A paused rule wears a **Paused** pill.",
            "**Pause** / **Activate** and the bin icon on each row. Pausing keeps the rule and skips it; deleting removes it.",
            "**New Rule** at the top right — greyed out, with an explanation, until you have at least one Follow-up, Marketing or Custom email template to send.",
          ] },
        ],
      },
      {
        id: "create-a-rule",
        heading: "How to create a rule",
        blocks: [
          { steps: [
            "Open **Settings → Follow-ups** and press **New Rule**. If the button is disabled, the yellow line above says why: you need a Follow-up, Marketing or Custom template first under **Email Templates**. Every new company already has a “Follow-up email (default)” template, so this is rare.",
            "Give it a **Rule name (optional)** — left blank, the rule takes the trigger's name.",
            "Pick the **Trigger**: **Quote sent, no response**, **Invoice overdue** or **Job completed**. The sentence under the dropdown says exactly when each one fires.",
            "Set the **Delay** and its **Unit** (hours or days). Choosing a trigger fills in its default — 3 days for a quote, 5 days for an invoice, 2 days for a completed job — and you can change it.",
            "Choose the **Template to send** and press **Create Rule**. The rule is active at once and the picture above the list redraws.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Settings → Follow-ups — the How these run flow drawn from the rules, then the rule list with Pause and delete on each row." },
          { note: "The trigger names in the dropdown — Quote sent, no response; Invoice overdue; Job completed — are shown in English whatever language you work in. The flow picture and the rule list translate them." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "What each setting changes",
        blocks: [
          { table: {
            head: ["Setting", "What it changes"],
            rows: [
              ["**Trigger**", "Which records the rule watches and what counts as crossing the line: a quote still at sent, an unpaid invoice past its due date, or a job marked complete (from the moment it was completed, not the last time it was edited)."],
              ["**Delay** and **Unit**", "How long the record must have been in that state before the email goes. Anything not in hours is treated as days."],
              ["**Template to send**", "The email the client receives. Only Follow-up, Marketing and Custom templates are offered — never the quote, instructions or receipt templates, which are one-off sends. If the template is later deleted, the row reads **(template deleted)** and the rule sends nothing."],
              ["**Pause**", "The rule is kept and skipped. The picture marks the step “Paused — this step is skipped.” **Activate** turns it back on; anything that crossed the line meanwhile is caught on the next run."],
              ["Delete (bin icon)", "Removes the rule. Emails already sent stay sent, but a rule you create afresh is a new rule and does not remember who the deleted one emailed — a quote still sitting at sent would be chased again. Pause instead if you may want it back."],
            ],
          } },
        ],
      },
      {
        id: "how-they-run",
        heading: "When they run, and what stops them",
        blocks: [
          { p: "The check runs once a day, so a rule set to 3 days sends on the first run after the third day rather than at the exact hour. On each run, for each active rule, FieldQuo finds every matching record that has not already had this rule's email, sends it, and writes it down — so a rule can never send twice for the same quote, invoice or job, even if two runs overlap." },
          { bullets: [
            "**Quote sent, no response** stops as soon as the client accepts or declines the quote. Each quote gets the email once.",
            "**Invoice overdue** stops as soon as the invoice is paid. Each invoice gets the email once.",
            "**Job completed** stops if the job is reopened. Each job gets the email once.",
          ] },
          { note: "Clients with no email address on file are skipped. Jobs, quotes and invoices you imported as past history are never followed up — a rule created today does catch up on last month's real quotes, but not on a 2024 job you typed in for the books." },
          { tip: "A **Job completed** follow-up is marketing in the legal sense (a thank-you, a request for a review), so it carries an unsubscribe link and is not sent to anyone who has unsubscribed from your marketing email. Quote and invoice follow-ups are about a transaction the client is already in and carry no unsubscribe link." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators and anyone at the Dispatcher or Manager level can open **Settings → Follow-ups** and create, pause or delete rules. Crew and Estimator logins do not see the row. See [[team-and-access|Team and access]] for how the levels are set." },
        ],
      },
    ],
    faq: [
      { q: "I created a rule an hour ago and nothing was sent. Is it broken?", a: "Probably not — the check runs once a day. A quote that crossed the delay this afternoon is emailed on the next day's run." },
      { q: "Can a rule send a text instead of an email?", a: "No. Every rule sends an email template and nothing else. The two texts your clients can receive are the on-my-way text and the appointment reminder — see [[texting-clients-what-is-and-is-not-automated|Texting clients: what is automated and what is not]]." },
      { q: "Will a client get the same follow-up twice if I pause and re-activate the rule?", a: "No. FieldQuo records every (rule, record) pair it has emailed, and a record already on that list is never emailed by that rule again, however often you pause and re-activate it. Deleting and re-creating the rule is different: the new rule starts with an empty list." },
    ],
  },

  "notifications-for-you": {
    title: "Notifications for you: email and browser",
    summary:
      "The three company-level alerts FieldQuo can email the owner about, the appointment-reminder text setting that lives on the same screen, and browser notifications per person and per browser.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Notifications** is about what FieldQuo tells *you* — as opposed to the quote, receipt and follow-up emails your clients receive, which are set up under Email Templates and Follow-ups. It holds two email alerts for the owner and administrators, the lead time for the reminder text your clients get before an appointment, and a switch for system notifications in your own browser.",
      "Every card on this page is honest about its state: an alert that has never been set up says so, and the browser card says whether notifications can reach you with the tab closed or only while a FieldQuo tab is open.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Two kinds of thing live here. The first three cards are company-wide rules — one setting for everybody, changed by an owner or administrator. The **Browser notifications** card is personal: it decides whether *this* browser on *this* computer or phone rings for you, and every member sets it for themselves." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Large quote created** — “Emails everyone with an owner or admin role when someone on your team writes a quote above this amount.” A **Send this alert** checkbox, an **Alert me above** amount, and **Save**. Until it is saved once it reads “Not set up yet — no alerts are being sent.”",
            "**Invoice paid** — “Emails everyone with an owner or admin role when a client pays an invoice online. On by default.” One checkbox, saved the moment you tick it.",
            "**Appointment reminders** — “Text the client a reminder before their appointment.” Four pills: **Off**, **2 hours before**, **24 hours before**, **48 hours before**. This one is a text to your *client*, not an email to you; it sits here because it is the company's one reminder setting.",
            "**Browser notifications** — “Notify me in this browser”, the browser's permission state, whether push with the tab closed is available, and **Send a test notification**.",
            "**Client-facing emails** — a pointer: what those emails say lives in **Email Templates**, and when they go out lives in **Follow-ups**.",
          ] },
        ],
      },
      {
        id: "email-alerts",
        heading: "How to set up the email alerts",
        blocks: [
          { steps: [
            "Open **Settings → Notifications**.",
            "Under **Large quote created**, tick **Send this alert**, type the amount under **Alert me above** (the box hints 10000) and press **Save**. The amount must be above zero.",
            "Under **Invoice paid**, leave the box ticked to keep the alert, or untick it to stop the emails. It saves on its own.",
            "Under **Appointment reminders**, press the lead time you want. It saves as soon as you press it, and the pill turns solid.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Settings → Notifications — Large quote created with its threshold, Invoice paid, the four Appointment reminder pills, and the browser card." },
          { table: {
            head: ["Alert", "Who receives it", "When"],
            rows: [
              ["Large quote created", "Everyone with an owner or admin role, by email", "Checked on a daily schedule, not the instant a quote is saved — expect the email within a day. A quote below the amount sends nothing."],
              ["Invoice paid", "Everyone with an owner or admin role, by email", "When a client pays an invoice online through the Pay button or the portal. A payment you record by hand (cash, cheque, e-transfer) does not trigger it."],
              ["Appointment reminders", "Your client, by text, from your business name", "Checked every hour; the text goes once the appointment is inside the lead time you chose — once per appointment, never to a client who has opted out, and only to a client with a phone number."],
            ],
          } },
          { note: "The reminder text goes to appointments on your Schedule — a booking from your booking page, one the receptionist took, or one you added with **New Appointment**. A visit scheduled on a job is a different record and is not texted a reminder. The wording of the text is edited under **Settings → Client messages**." },
        ],
      },
      {
        id: "browser-notifications",
        heading: "Browser notifications",
        blocks: [
          { p: "Turn on **Notify me in this browser** and the browser asks for permission once. From then on, while a FieldQuo tab is open in the background, new activity arrives as a system notification at the corner of your screen; with the tab in front it is a small toast instead. Where push is set up on the deployment, the card reads “On. You'll be notified here, and with the tab closed.” — otherwise “On. You'll be notified while a FieldQuo tab is open.” The card tells you which, and never claims more than it can do." },
          { bullets: [
            "The activity feed behind the bell icon — a quote accepted, an invoice paid, a new lead, a payment disputed, a quote that could not be delivered, a leave request.",
            "A new message from a client in the **Messages** inbox (Facebook, Instagram, WhatsApp), for anyone allowed to read that inbox.",
            "In **Chat**: a direct message to you, and any message that @mentions you.",
          ] },
          { note: "On iPhone and iPad, add FieldQuo to the Home Screen first — Safari only delivers notifications to installed web apps. If the browser has blocked notifications for the site, the card says so and nothing is on until you allow them in the browser's own settings." },
          { tip: "Press **Send a test notification** after turning it on. It shows a “FieldQuo test” notification in this browser and, where push is on, sends one to every browser you have enabled it in — the quickest proof that your phone will buzz." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owner and administrators only — the three company rules are theirs to change, and the row is hidden from everyone else. The browser switch is per person, so an owner turning it on does nothing for a colleague's phone; each member turns it on in their own browser." },
        ],
      },
    ],
    faq: [
      { q: "Why did nobody get the large-quote email when I wrote a $40,000 quote this morning?", a: "The check runs on a daily schedule, so the email arrives within a day rather than at once. Also make sure the alert reads a saved amount rather than “Not set up yet”." },
      { q: "Can I be emailed when a new lead comes in, or when a quote is accepted?", a: "Not by email from this screen. Those arrive in the activity feed behind the bell, and as a browser notification if you turn that on." },
      { q: "Does the reminder text cost anything?", a: "The card says each reminder is a text message billed to your account, sent from your business name, never more than once per appointment and never to a client who has opted out." },
    ],
  },

  "send-from-your-own-domain": {
    title: "Send email from your own domain",
    summary:
      "Verify a subdomain once and every quote, invoice, receipt and follow-up goes out from quotes@your-domain instead of FieldQuo's shared address — and where replies land.",
    updated: "2026-09-12",
    intro: [
      "Until you connect a domain, the emails your clients receive are sent from FieldQuo's shared address under your company name. That works, but a client's mail app may show “via fieldquo.com” next to your name. **Settings → Email Domain** lets you prove you own a domain by adding a few DNS records; from then on every client email goes out from an address on it, and nothing on the envelope says FieldQuo.",
      "Nothing here creates a mailbox. The sender address does not need to exist as an inbox — verifying the domain is what grants permission to send as it. Replies are handled separately, by your company email.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is titled **Email Domain** — “Send client emails from your own domain instead of ours. Better deliverability, and no ‘via fieldquo.com’ next to your name.” It registers the domain with FieldQuo's email provider, shows you the DNS records to add at your registrar, and rechecks verification on its own every 30 seconds. Once the status reads **Verified**, every send path in the product — quotes, invoices, receipts, follow-up rules, review requests, marketing campaigns — uses the new address without any further setting." },
          { note: "Use a subdomain such as **send.yourcompany.com** rather than your root domain. It keeps this separate from your normal email so it cannot interfere with the inbox you already have." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The current state: **No domain connected** with “Your emails currently send from FieldQuo's shared address, using your company name.” — or the domain with its status pill (**Verified**, **Waiting on DNS**, **Verification failed**, **Not set up**), **Check verification** and **Disconnect**.",
            "**Connect a domain** — a box for the subdomain and a **Connect** button.",
            "**Add these DNS records** — a table of Type, Name, Value (and Priority and TTL where they apply), each with **Copy value**, plus five numbered instructions on where to put them.",
            "**Sender address** — the local part of the address clients see (the default is quotes), with “Emails will send from quotes@send.yourcompany.com” under it and **Save**.",
            "**Replies** — one sentence saying where a client's reply to a quote or invoice goes.",
          ] },
        ],
      },
      {
        id: "connect-a-domain",
        heading: "How to connect a domain",
        blocks: [
          { steps: [
            "Open **Settings → Email Domain**, type a subdomain such as send.yourcompany.com under **Connect a domain**, and press **Connect**.",
            "Sign in wherever you bought the domain — GoDaddy, Namecheap, Cloudflare, Google Domains. That is your DNS host; if you are not sure, it is usually whoever bills you yearly for the domain name.",
            "Find **DNS**, **DNS records** or **Manage DNS**, and add one new record for each block on the screen, matching Type, Name and Value exactly. Use **Copy value** — the TXT values are long.",
            "Save at the host, then leave it. Most hosts apply changes within an hour; some take up to 24. The page rechecks every 30 seconds on its own, and **Check verification** asks right now.",
            "When the pill reads **Verified**, set the **Sender address** if you want something other than quotes (invoices, hello, office) and press **Save**.",
            "Send yourself a quote and look at the From line: your company name, your address, no “via”.",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Settings → Email Domain — the connected domain with its Verified status and Disconnect, the sender address, and where replies go." },
          { warning: "Watch the **Name** field. Most hosts add your domain automatically: if the Name shown is send._domainkey.example.com you usually enter only send._domainkey. Ending up with send._domainkey.example.com.example.com is the most common mistake, and it shows as **Waiting on DNS** for ever." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each status and control means",
        blocks: [
          { table: {
            head: ["On the screen", "What it means"],
            rows: [
              ["**Verified**", "Your client emails are sent from the sender address on your domain, in your company's name. Nothing else needs turning on."],
              ["**Waiting on DNS** / **Verification failed**", "Nothing sends from your domain yet; emails keep going out from FieldQuo's shared address under your name. Re-check the records — usually the Name field — and wait for the host to apply them."],
              ["**Sender address**", "Only the part before the @. It changes what clients see in the From line and nothing else; it does not have to be a real mailbox."],
              ["**Disconnect**", "Your emails go back to sending from FieldQuo's shared address under your company name. The screen asks you to confirm first."],
            ],
          } },
        ],
      },
      {
        id: "replies",
        heading: "Where replies go",
        blocks: [
          { p: "When a client replies to a quote or an invoice, the reply goes to your **company email** from **Company Settings**. If no company email is set, it goes to your account owner's login email instead — so a client's answer is never lost in a mailbox nobody reads. The **Replies** line on this screen tells you which of the two is in force." },
          { tip: "Set the company email to the inbox your office actually watches. The sender address on your domain is never the reply address — it need not exist — so a reply that reached it would evaporate." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators and anyone at the Dispatcher or Manager level can open **Settings → Email Domain** and connect, verify or disconnect a domain. Crew and Estimator logins do not see the row." },
        ],
      },
    ],
    faq: [
      { q: "Do I need to create quotes@send.mycompany.com as a mailbox?", a: "No. Verifying the domain is what lets FieldQuo send as that address. Replies go to your company email, not to the sender address." },
      { q: "It has said Waiting on DNS for a day. What now?", a: "Open the records at your DNS host and compare Type, Name and Value with the screen character by character. Nine times out of ten the host doubled your domain in the Name field. Fix it, save, and the page picks the change up on its next 30-second check." },
      { q: "Is anything else different once the domain is verified?", a: "Only the From line. The content, the branding, the language and the timing of every email stay exactly as they were." },
    ],
  },

  "the-phone-receptionist": {
    title: "The phone receptionist",
    summary:
      "An AI receptionist on a local number: what it does on a call, how to set it up in seven cards, what each control changes, what a minute costs, and what nobody else's pricing page lists.",
    updated: "2026-09-12",
    intro: [
      "The phone receptionist answers the calls you cannot, takes the caller's details, books a visit against your real availability, and leaves you the recording, the transcript and — where the caller said enough — a draft quote. It speaks your company's language (English, French or Spanish) and switches to the caller's if they speak another. It never gives a price, never promises a time it has not checked, and never claims to be a person.",
      "This article is the **Settings → Phone receptionist** screen: the number, the credit, the words, the switch, and the end-to-end check. What it did with each call is the Receptionist screen in the main sidebar — see [[the-receptionist-call-log|The receptionist's call log]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is titled **Phone receptionist** — “Answers the calls you can't, takes the details, and books visits against your real availability. It never quotes a price.” It is laid out in the order of the decisions: credit, then a number, then what it says, then the switch. A new company sees the cards numbered 1 to 7; once the setup is done the numbers disappear and the same cards remain." },
          { p: "On a call, the receptionist reads your opening hours, your switched-on services and your service areas from your settings, plus the note you write for it. To book, it offers real free slots from your booking availability; if your visits carry a fee, or your line is set to callbacks, it says so and takes preferred times or reads out the booking link instead — it cannot text the link." },
          { note: "Everything the receptionist can spend is priced by the server and printed on this screen before you commit. The browser never sends an amount." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Credit** — the balance, “35¢ a minute, rounded up, one minute minimum”, **Add credit**, the statement of where the credit went, and the **Top up automatically** card with a saved card and a threshold.",
            "**Your number** — three ways to get one: **Keep my number, forward missed calls** (recommended, two minutes), **Get a new number**, or **Move my number over** (two to four weeks, your old carrier's timing). A bought number shows **Forwards to** and a **Release** link.",
            "**What it says** — the **Greeting**, the knowledge note with **Answer these in your own words** and **Draft this from my company profile**, the **Voice** with **Hear …** previews, and **How it sounds** tuning.",
            "**Answer my calls** — the one switch: **Start answering calls** / **It's answering — turn off**. It refuses to turn on without a number and credit for at least one minute.",
            "**Call clients back automatically** — the outbound half: **Turn on quote callbacks**, then **Which quotes get a call**. Covered in [[quote-callbacks|Quote callbacks]].",
            "**Let the crew text in photos and updates** — a link to the crew inbox, which uses a separate texting line. Covered in [[the-crew-inbox|The crew inbox]].",
            "**Check it end to end** — asks the phone service itself about every link between somebody dialling and a lead landing in FieldQuo.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "How to set it up",
        blocks: [
          { steps: [
            "Open **Settings → Phone receptionist**. Under **Credit**, press **Add credit** if the balance is empty — your first number comes with 30 free minutes of credit, and the number's first month of rental is taken out of it.",
            "Under **Your number**, pick **Keep my number, forward missed calls** unless you have a reason not to. FieldQuo rents a line for the receptionist to answer on and shows you the forwarding code to dial from your own phone; your clients keep dialling the number on the van, and calls you do not pick up ring through to the receptionist instead of voicemail.",
            "Under **What it says**, write the **Greeting** (the placeholder is “Thanks for calling, how can I help?”), then press **Draft this from my company profile** — it reads your profile and lists the questions it cannot answer on its own (what you turn down, what counts as urgent, what to say when you are shut). Type over each bracket; a line left in brackets is skipped.",
            "Pick a **Voice** and listen to it with **Hear …**. Leave **How it sounds** on its defaults unless callers keep getting cut off.",
            "Press **Start answering calls**. The status bar at the top shows your number with a green dot, and the switch now reads **It's answering — turn off**.",
            "Press **Check it end to end** and then ring your own number. Every link should read as a pass; a call can be answered perfectly and still never reach FieldQuo, and this is the card that says so.",
          ] },
          { figure: "live:app-settings-voice", caption: "Settings → Phone receptionist — the number with its answering switch, the credit card with top-ups, and the greeting, knowledge, voice and tuning cards." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it changes"],
            rows: [
              ["**Keep my number, forward missed calls**", "Rents a second line the receptionist answers on. Your own number is untouched; you set conditional forwarding on your phone with the code shown, and you can turn it off the same way — dial ##002# — in under a minute."],
              ["**Get a new number** / **Choose the number yourself**", "Buys a separate line in an area code you pick. Good for ads or a second trade; it will not catch calls to the number you already advertise. Picking one buys it straight away and the first month comes out of your credit."],
              ["**Move my number over**", "Starts a port. Nothing is charged to start and your number keeps working with your old carrier until the transfer completes; the receptionist cannot answer on it until then."],
              ["**Greeting** and the knowledge note", "The first thing every caller hears, and the facts the receptionist may use beyond your settings. Opening hours, services and areas are read from your settings on every call and belong there, not in the note."],
              ["**Voice** and **How it sounds**", "Which voice speaks, and four tuning choices: what it does if a caller talks over it, where your callers usually ring from, how quickly it answers, how it comes across."],
              ["**Answer my calls**", "Whether the number is answered at all. Turning it off stops answering at once — if the number is on your van, forward it somewhere first, because a caller may hear a busy tone rather than ringing."],
              ["**Top up automatically**", "Off unless you turn it on. Saves a card and, when the balance drops below the threshold, charges the amount shown and adds the credit — at most a set number of times a day. It switches itself off and tells you if the card is declined."],
              ["**Release …**", "Gives a bought number back for good. It is deleted at the phone company and cannot be recovered; the monthly rental stops and the rest of the paid month is not refunded."],
            ],
          } },
        ],
      },
      {
        id: "what-it-costs",
        heading: "What it costs",
        blocks: [
          { p: "The receptionist runs on prepaid credit, in US dollars, and every charge is on the statement under **Credit**. Calls are metered per minute; numbers are rented per month; both come out of the same balance, and so does the crew texting line." },
          { bullets: [
            "**35¢ a minute**, rounded up, one minute minimum — inbound and outbound alike. A toll-free number adds 5¢ a minute.",
            "**$4 a month** for a local number, **$9 a month** for a toll-free one (800/833/844). The first month is charged when the number is bought.",
            "**30 free minutes** of credit with your first number, so the receptionist can start answering before you top up.",
          ] },
          { note: "When the credit runs low the screen says so, and when it runs out the receptionist stops answering — which is what **Top up automatically** exists to prevent." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What is different here",
        blocks: [
          { p: "Other field-service tools sell an AI receptionist too, so the answering itself is not the difference. On the pricing pages FieldQuo compares itself with — Jobber, Housecall Pro, QuoteIQ, ServiceTitan and Projul — two things the receptionist does here are not listed at any tier:" },
          { bullets: [
            "**A call that comes back as a draft quote.** What the caller described is read off the transcript and, when it is enough for your instant-quote form, priced through your own settings and put in your review queue — never a figure invented on the call.",
            "**The assistant ringing your clients back** — after a quote goes out, the day before a visit, and on a new enquiry — within calling hours and only where the client asked to be contacted.",
          ] },
          { p: "And it is priced by the minute against credit you can see, with the cost of every call printed beside the call, rather than as a flat monthly add-on." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators and anyone at the Dispatcher or Manager level can open **Settings → Phone receptionist** and change it — buying a number and topping up spend the company's money. Crew and Estimator logins do not see the row. The call log has its own rule: see [[the-receptionist-call-log|The receptionist's call log]]." },
        ],
      },
    ],
    faq: [
      { q: "Does it answer in French or Spanish?", a: "It holds the whole call in your company's language — English, French or Spanish — and switches to the caller's language if they speak another. Companies set to any other language get an English-speaking receptionist for now." },
      { q: "Will it quote a price on the phone?", a: "Never. It will read back a booking fee you have published on your booking page, because that is your own figure, but it never prices the work. A draft quote lands in your review queue for a person to approve." },
      { q: "I called my own number and nothing appeared in FieldQuo.", a: "Run **Check it end to end** on the settings screen — it asks the phone service about every link, and names the one that is broken. On the Receptionist screen, **Recover missed calls** pulls back any call of the last week that never reached us." },
    ],
  },

  "the-receptionist-call-log": {
    title: "The receptionist's call log",
    summary:
      "Every call the receptionist took or placed: what was said, what it produced, what it cost — grouped into Needs you, Waiting on you and Archived, with the recording, a draft quote and a callback one press away.",
    updated: "2026-09-12",
    intro: [
      "The **Receptionist** screen in the main sidebar is the log — “Calls it has taken for you, and what came of them.” Each call shows the number, when it rang, how long it lasted, what it cost, a summary, and what it produced: a lead saved, a visit booked, a callback booked. The recording is a press away, and so is a draft quote built from what the caller said.",
      "Calls do not clear themselves. A call the receptionist flagged as urgent sits at the top until a person says they have dealt with it, and a call that has not become a quote stays in the working list until somebody archives it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Above the list, when there is something to say, one line counts what your calls have booked: “You have 3 coming up from your calls — the next is Tuesday at 2:00 PM.” Two buttons sit at the top: **Recover missed calls** and **Receptionist settings**. If the receptionist is set up but switched off, the screen says so and offers **Turn the receptionist on**; if it is on and nobody has rung yet, it points you at **Check it end to end**." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Needs you** — calls the receptionist flagged: somebody said flooding, gas, the ceiling is coming down. Amber, at the top, until you press **I've dealt with it**.",
            "**Waiting on you** — “These calls haven't become a quote yet. Archive one once you've dealt with it.” The working list.",
            "**Archived** — the log underneath, with **Bring back** on each call.",
          ] },
          { p: "On each call: a **We called** badge when the assistant placed the call rather than answered it, a **Recovered** badge when the call was pulled back from the phone provider after the fact, the caller's number or **Unknown number**, the time, the duration and the cost in US dollars, the summary, and what came of it — **Saved as a lead**, **Visit booked — Tuesday …**, **Callback booked — …**, **Video call booked — …**, or **Quote 1042** once a quote exists. Then **Listen**, **Read the whole call**, **Draft a quote from this call** and **Book a callback**." },
        ],
      },
      {
        id: "working-a-call",
        heading: "How to work a call",
        blocks: [
          { steps: [
            "Open **Receptionist**. Start with **Needs you**; press **Listen** to hear the recording, or **Read the whole call** for the transcript with each line marked as the caller's or the receptionist's.",
            "Press **Draft a quote from this call**. The panel **What we heard on this call** lists every service and measurement beside the caller's own words — nothing is asserted that cannot be traced to something said. If the caller gave enough for your instant-quote form, the draft is already priced through your settings and waiting in the review queue (**Open the review queue**); otherwise **Open in the quote builder** starts a quote with what was heard filled in and no prices.",
            "If the caller wants a call back, press **Book a callback**: FieldQuo books the next free 15-minute slot from your availability, within your opening hours, and puts it on your calendar — “Callback booked — Tuesday at 10:15. It's on your calendar.”",
            "When you have acted on an urgent call, press **I've dealt with it**. When an ordinary call is finished with, press **Archive**; **Bring back** undoes it.",
            "If a call you know happened is missing, press **Recover missed calls**. FieldQuo asks the phone provider for the last week, pulls back anything that never reached it, and rebuilds the lead from the recording — marked **Recovered**, with “check the details before you ring back”.",
          ] },
          { figure: "live:app-receptionist", caption: "Receptionist — the count of upcoming bookings, then the calls grouped Needs you, Waiting on you and Archived, each with its cost, summary and outcome." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "What each control does",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["**Listen**", "Plays the recording of the call in the page."],
              ["**Draft a quote from this call**", "Reads the transcript with FieldQuo AI. Priced only when your instant-quote form has everything it needs — then it is a draft in the review queue, never a number on this screen. Uses your AI allowance; if that is spent, or AI is off, the panel says so and the recording and transcript remain."],
              ["**Book a callback**", "Books a 15-minute callback on your calendar from your real availability. Refused with a reason when there is no number to ring, when your line is set to on-site visits only, when your opening hours have never been set, or when the booking type takes a fee up front (that has to go through your booking page)."],
              ["**I've dealt with it**", "Clears an urgent call out of Needs you. Nothing else is changed."],
              ["**Archive** / **Bring back**", "Moves a call out of, or back into, the working list. The call, its recording and its cost stay on the log."],
              ["**Recover missed calls**", "Asks the phone provider for every call of the last week, adds the ones FieldQuo never received, and rebuilds their leads from the recordings. Reports how many were checked, recovered and rebuilt, or that nothing was missing."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The log is client contact data — numbers and recordings — so it follows the **Clients and Properties** dial: anyone who can view full client information sees the row, which is the Estimator, Dispatcher and Manager presets and the owner and administrators. The Crew preset, which sees a client's name and address only, does not. **Book a callback** additionally needs the ability to create requests, which every one of those presets has." },
        ],
      },
    ],
    faq: [
      { q: "Why does a call from Tuesday only appear today, with a Recovered badge?", a: "It never reached FieldQuo while it was happening and was pulled back from the phone provider afterwards. The row is not late — it was lost, and the badge says when it was got back." },
      { q: "Does drafting a quote from a call put a price in front of the client?", a: "No. A priced draft sits in your review queue until a person approves it; an unpriced one opens in the quote builder with no prices. The client sees nothing until you send." },
      { q: "Where do I change what the receptionist says?", a: "**Receptionist settings** at the top of this screen opens Settings → Phone receptionist — see [[the-phone-receptionist|The phone receptionist]]." },
    ],
  },

  "quote-callbacks": {
    title: "Quote callbacks",
    summary:
      "The assistant rings a client after their quote goes out, the day before a visit, and on a new enquiry — which quotes, the eight checks before it dials, the consent it needs, and the card that says why a quote was not called.",
    updated: "2026-09-12",
    intro: [
      "Turn on **Call clients back automatically** and the phone receptionist starts placing calls as well as taking them: after you send a quote, to answer questions and ask whether the client wants to go ahead; the day before a booked visit, to confirm it; and to follow up a new enquiry. Always within calling hours, only to people who asked to be contacted, and anyone who says stop is taken off for good.",
      "This article is the outbound half of **Settings → Phone receptionist**: the switch, the **Which quotes get a call** choice, the rules the assistant checks before it dials, the manual **Call about this quote** button on a quote, and the report on the card that names the quotes it passed over and why.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A call is queued the moment a trigger fires and placed later, by a check that runs every 15 minutes — so a quote approved at nine in the evening is rung the next morning, not at nine. Every rule is re-checked at dial time, not at queue time: a client who withdraws consent, a number that changes, or credit that runs out in between all take effect on a call already waiting." },
          { note: "The assistant may state the quote's total on a quote call, because a person approved that figure and the client already has it in writing. It never changes it, and if the quote's total no longer matches what was queued, the figure is dropped from the call rather than spoken." },
        ],
      },
      {
        id: "which-quotes",
        heading: "Which quotes get a call",
        blocks: [
          { table: {
            head: ["Choice on the card", "What it does"],
            rows: [
              ["**Instant estimates only**", "Only quotes the software priced and someone approved — an instant estimate from your website or the receptionist, after review. This is the default and what the feature has always done."],
              ["**Every quote I send**", "Including quotes you wrote yourself: the assistant rings once after you send, to answer questions and ask if they want to go ahead."],
              ["**No quote callbacks**", "No calls about quotes. Appointment reminders and new-enquiry follow-ups carry on, because the switch above governs all three."],
            ],
          } },
        ],
      },
      {
        id: "before-it-dials",
        heading: "What is checked before it dials",
        blocks: [
          { p: "A quote call is placed only when every one of these holds. The card on the settings screen names the ones that fail, in the same words:" },
          { bullets: [
            "**Automatic calls are switched on** — the master switch on the card.",
            "**The quote is in scope** — an instant estimate, or any quote if you chose “every quote I send”.",
            "**The client did not decline it** — a “no” already given gets no closing call.",
            "**The estimate is approved** — a draft still waiting for someone to approve it is never rung about.",
            "**The quote was emailed** — the call is about a paper the client can read, so it comes after the email, never before. A past job you imported for the books is never called.",
            "**The client has a phone number.**",
            "**Somebody at that number asked to be contacted** — consent is recorded when a client sends your website form, instant estimate, self-quote form or portal request that says you may call, or books a visit; it lasts a year (three months after a completed job), and “don't call me” beats everything and is never deleted.",
            "**It is between 9 a.m. and 8 p.m. where the client is.** Outside that window the call simply waits.",
          ] },
          { p: "One call per quote, ever. Re-sending a quote a week later does not queue a second call. A visit that is rescheduled does get a second reminder call, because the first one was about a different day." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "How to turn it on",
        blocks: [
          { steps: [
            "Open **Settings → Phone receptionist** and scroll to **Call clients back automatically**. The button is disabled until you have a live number and credit for at least one minute; the line under it says which is missing.",
            "Press **Turn on quote callbacks**. The button turns green and reads **It's calling clients — turn off**.",
            "Under **Which quotes get a call**, leave **Instant estimates only** or pick **Every quote I send**.",
            "Read the report under the choice. It lists the quotes sent in the last 30 days that were not called and the most common reason — “Not an instant estimate — somebody typed this quote”, “No phone number on the client”, “Nobody at this number has asked to be contacted” — so an armed feature that will never fire is visible here rather than a silence.",
          ] },
          { figure: "live:app-settings-voice", caption: "Settings → Phone receptionist — the Call clients back automatically card holds the switch, the Which quotes get a call choice and the report." },
        ],
      },
      {
        id: "call-about-this-quote",
        heading: "Calling one client by hand",
        blocks: [
          { p: "On any quote, **Call about this quote** queues the same call for that one client — “Queued — we'll ring Maria within about 15 minutes.” A person pressing it has made the scope decision themselves, so the scope choice does not stop it; what still does is the master switch being off, a draft nobody has approved, a quote the client has not been emailed, and a client with no phone number. Consent and calling hours are checked at dial time exactly as for an automatic call." },
          { tip: "Every call the assistant places appears on the Receptionist screen with a **We called** badge, its recording, its summary and its cost — the same 35¢ a minute as an answered call." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What is different here",
        blocks: [
          { p: "On the pricing pages FieldQuo compares itself with — Jobber, Housecall Pro, QuoteIQ, ServiceTitan and Projul — an assistant that rings your clients to confirm tomorrow's visit or to close a quote you sent is not listed at any tier. What makes it usable rather than dangerous is the part you cannot see: no call ever goes to a number without a recorded request to be contacted, and the report on the card tells you which quotes were passed over and why." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The switch and the scope live on Settings → Phone receptionist, which the owner, administrators and the Dispatcher and Manager levels can open. **Call about this quote** is on the quote itself, for anyone who can open the quote — if outbound calling is off for the company, the button says so and names who can turn it on." },
        ],
      },
    ],
    faq: [
      { q: "I turned it on and wrote three quotes. Why was nobody called?", a: "Read the report on the card. Most often the quotes were typed by hand and the scope is Instant estimates only, or the clients were typed in from a phone call and nobody at their number has asked to be contacted." },
      { q: "Can it ring somebody who is in my client list but never asked for anything?", a: "No. Being in your database is not consent. The assistant only rings a number with a recorded request — a form, a booking, a quote they asked for — and a client who says stop is never rung again." },
      { q: "When exactly does the reminder call go?", a: "About 24 hours before the visit, within calling hours, and only when the visit is more than three hours away when it is booked — a reminder minutes after booking would be a nuisance." },
    ],
  },

  "the-crew-inbox": {
    title: "The crew inbox: photos and updates by text",
    summary:
      "Your crew text photos and notes to one number and they file themselves to the right job — no app, no login. The setup panel, the queue of photos that need a person, what each text costs, and who sees what.",
    updated: "2026-09-12",
    intro: [
      "A crew member on a ladder is not going to install an app. With the crew inbox they text a photo, or a one-line update, to a number, and FieldQuo files it against the job they are on that day. When the day has more than one job it asks which — by text, as a numbered list — rather than guess. A photo filed to the wrong client is the one mistake this feature is built never to make.",
      "The **Crew inbox** screen in the main sidebar is where you set the number up and where the exceptions land: a photo nobody answered the question for, and texts from numbers that are not on your team.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The crew texting line is its own number — a texting line, separate from the one the receptionist answers calls on, because the receptionist's number cannot receive a text. It is rented monthly and its texts are metered against the same credit as the receptionist. Crew are matched by the phone number on their profile under **Team → Workers**; a text from an unknown number is logged but not filed, and — during your first few texts — answered with a note saying which number to add." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Crew texting** — the green setup panel: **Your crew text this number**, the number, whether it is really wired (asked of the phone provider, not assumed), **Credit: $12.40**, the rates line “2¢ per text (each 160 characters), 5¢ a photo — drawn from the same credit as your phone agent”, and **Send me a test text**, **Add credit**, **See every charge**, **Turn off crew texting**.",
            "**Needs you — pick the job (2)** — a photo the system could not file: the picture, who sent it, when, **Where it was taken** when the phone sent coordinates, then **Which job is this for?** with a chip per candidate job and **File it here**.",
            "**From numbers not on your team (1)** — texts from strangers, with “Add this number to a crew member in **Team** and their texts will file automatically.”",
            "**Filed** — everything that landed, each reading **Filed to Nguyen kitchen**. The photo itself lives on the job.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "How to set it up",
        blocks: [
          { steps: [
            "Open **Crew inbox**. If the panel reads “Your crew don't have a number to text yet”, press **Buy your crew a number of their own**, pick an **Area code** (it defaults to the one on your company profile), press **Show me numbers** and choose one. It costs $4 a month from your credit, the first month up front, and the panel confirms “Done — your crew's number is …”.",
            "Or, to try it first, press **Use the FieldQuo test line** — a shared line lent to your company until the date shown.",
            "Add your own mobile to your staff profile under **Team → Workers**, so the inbox recognises your texts, and do the same for every crew member.",
            "Press **Send me a test text**, then reply to it from your phone with a photo. It should land under **Filed** against a job on your schedule for today — or under **Needs you** if you have none, which is also a pass.",
            "Give the crew the number. That is the whole rollout: nothing to install and nobody to invite.",
          ] },
          { figure: "live:app-crew-inbox", caption: "Crew inbox — the Crew texting panel with the number, the credit and the rates, then Needs you — pick the job with the candidate chips, and Filed." },
          { note: "The panel never reports success it has not verified: it asks the phone provider whether the number is switched on and can take photos. If it reads “This number takes texts but not photos”, tell FieldQuo and the number is swapped." },
        ],
      },
      {
        id: "how-a-photo-is-filed",
        heading: "How a photo finds its job",
        blocks: [
          { p: "The candidates are the sender's scheduled visits for that day. Among them, FieldQuo files without asking only when it is sure, in one of three ways; anything else becomes a question." },
          { bullets: [
            "**Named** — the text mentions one job's client, title or street number (“123 Oak done”).",
            "**On site** — the photo's coordinates sit within 250 m of one job and clearly nearer to it than to any other.",
            "**Only one** — the person has exactly one job that day. Filed silently.",
            "**Ask** — anything else. The crew member gets “Which job is this for? 1. Nguyen 2. Patel — Reply with the number.” and the photo waits under Needs you until they, or you, answer.",
          ] },
          { p: "A filed photo lands on the job's visit with the text as its caption and a stage (before, during, after) inferred from the words; the crew member gets a short “Filed to Nguyen. 👍” when there was a choice, and nothing when there was not — a line that chirps at every photo gets muted. If nothing landed, it says “Couldn't file that one — it's waiting in the office inbox.” rather than pretending." },
          { tip: "Teach the crew one habit: put the client's name or the street number in the text. A named photo files itself every time." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "What it costs",
        blocks: [
          { table: {
            head: ["Item", "Cost"],
            rows: [
              ["A text from the crew", "2¢ per 160 characters — a long text is two charges."],
              ["A photo from the crew", "5¢, however much text rides along with it."],
              ["A reply from FieldQuo (the question, the confirmation, an @mention notice)", "The same rates, and only sent when the balance covers it."],
              ["The number", "$4 a month from your credit, the first month up front. The line stays connected up to $2 in the red so a crew mid-job is not cut off; past that it is paused at the provider until you top up."],
            ],
          } },
          { p: "The balance is the receptionist's balance, in US dollars; **See every charge** opens the statement, and the panel warns when about twenty photos' worth is left." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone on the team sees the **Crew inbox** row, but two rules narrow it. Setting up the line — buying, testing, turning it off — is for the owner, administrators and the Manager level, because it spends the company's credit; a Dispatcher is refused with that reason. Reading follows the **Schedule** dial: Crew and Estimator logins see only their own texts; Dispatcher, Manager, owner and administrators see everyone's, including the unknown-number queue." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What is different here",
        blocks: [
          { p: "On the pricing pages FieldQuo compares itself with, the nearest bullets are two-way SMS with customers and in-app calling and texting between people who have the app. None of them names a number your crew text a photo to that files it against the job without an app or a login, asks by text when it cannot tell, and holds the photo for a person rather than guess." },
        ],
      },
    ],
    faq: [
      { q: "Can I just use the receptionist's number?", a: "No — it answers calls and cannot receive a text, and a forwarded number forwards calls, never texts. The crew line is a separate texting number, which is why setup lives on this page and not on the phone screen." },
      { q: "A subcontractor works for two companies. Where do their photos go?", a: "To whichever company's number they texted. The number that was texted decides the company; the sender's number only decides who, within it. Their phone can be on both rosters." },
      { q: "Do the photos get tags?", a: "A texted photo lands with a stage inferred from the words (before, during, after) and no company tags; add tags on the job afterwards. A wrong tag is a person's mistake to make, not the system's." },
    ],
  },

  "team-chat": {
    title: "Team chat",
    summary:
      "The company talking to itself: #general for everyone, a room per active job for the crew booked on it and the office, direct messages, @mentions that reach a phone — and nothing that leaves the company.",
    updated: "2026-09-12",
    intro: [
      "**Chat** is the company's own conversation, inside FieldQuo. Everyone on the roster is in **#general**; every job on the calendar has a room for the crew booked on it and the office; and any two people can message each other directly. Mentions notify the person named, and on a phone Chat is the crew's own tab at the bottom of the screen.",
      "Nothing here reaches a client, and nothing reaches FieldQuo — the support team's read-only session can see the rooms and cannot post in them.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is the same chat kit as **Messages**: the conversation list down the left, the thread in the middle with day dividers and an unread line, the room's **Members** on the right, and the composer at the bottom. Unread rooms rise to the top of the list, because the list exists to answer “who is waiting on me”. Rooms are made and kept in step by FieldQuo from your roster and your schedule — nobody adds or removes anybody by hand, which is why the list can never drift from who is actually on a job." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Unread** — any room with something you have not seen, mentions counted separately.",
            "**Company** — **#general**, “Everyone on the team”.",
            "**Jobs** — one room per scheduled or in-progress job, named after it, “The crew booked on this job, and the office”, with **Open job** in its header.",
            "**Direct messages** — “Just the two of you. Nobody else can read this.”",
            "**Finished jobs** — rooms of completed or cancelled jobs, kept with their history: “This job is finished. The room is kept for the record.”",
          ] },
          { p: "**New message** at the top opens a direct message: search the team by name or email and pick one person. The composer reads **Message #general** or **Message Ana**; typing **@** opens **Mention somebody** with the people in that room — ↑↓ to choose, Tab to insert." },
        ],
      },
      {
        id: "rooms",
        heading: "The three kinds of room",
        blocks: [
          { table: {
            head: ["Room", "Who is in it", "How it is kept"],
            rows: [
              ["**#general**", "Everyone who can sign in to the company.", "Somebody joins the moment their invitation is accepted and leaves when their account is deactivated. Nobody can leave it."],
              ["A job room", "Whoever is booked on one of the job's visits, plus the owner, administrators and managers, who run every job.", "Made for a job once it is scheduled; membership follows the visits — book somebody on a visit and they are in, take them off and they are out. Kept, read-only in practice, under Finished jobs when the job ends."],
              ["A direct message", "Two people.", "Opened from New message by either of them; there is only ever one room for a pair."],
            ],
          } },
          { note: "A room is never made for an unscheduled job — it would hold the office talking to itself about work nobody has been given. Schedule a visit and the room appears." },
        ],
      },
      {
        id: "mentions-and-notifications",
        heading: "Mentions and notifications",
        blocks: [
          { p: "A message can only mention somebody who is in the room. The person named sees the message tinted in the thread, a mention count on the room in the list, and — where they have turned on browser notifications — “Ana mentioned you in #Nguyen kitchen” on their phone or desktop, which opens straight into the room. A direct message notifies the other person the same way. Neither the author nor anyone else is told." },
          { bullets: [
            "Turn notifications on per browser under **Settings → Notifications** — see [[notifications-for-you|Notifications for you: email and browser]].",
            "A message that could not be pushed is still stored and still badged; the push is a courtesy about a message that already exists.",
          ] },
          { note: "A read-only support session sees “You are viewing this account read-only. Support access can see the chat and cannot post in it.” It cannot send, mention or open a direct message." },
        ],
      },
      {
        id: "how-to",
        heading: "How to use it on the job",
        blocks: [
          { steps: [
            "On a phone, tap **Chat** in the tab bar at the bottom; on a desktop, open **Chat** in the sidebar.",
            "Open the job's room under **Jobs** and type. Put **@** before a name to make sure the office sees a question.",
            "To reach one person privately, press **New message**, search their name and send.",
            "When the job is finished its room moves under **Finished jobs** — “what did we agree about the Nguyen kitchen” is still answerable in March.",
          ] },
          { figure: "harness:chat", caption: "Chat — the rooms grouped Unread, Company, Jobs, Direct messages and Finished jobs, a job room's thread, and its Members." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone on the roster, including Crew logins — the chat is the crew's own screen and has no access level of its own. What a person sees is the rooms they are in: #general, the jobs they are booked on, and their direct messages. The owner, administrators and managers are in every job room." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What is different here",
        blocks: [
          { p: "None of the pricing pages FieldQuo compares itself with — Jobber, Housecall Pro, QuoteIQ, ServiceTitan, Projul — lists a team chat at any tier. Here it is on every plan, for every login including the free crew ones, with the job rooms drawn from the schedule rather than kept by hand." },
        ],
      },
    ],
    faq: [
      { q: "Can a client see any of this?", a: "No. Chat is between members of your company only. Client conversations live in Messages, and client-facing texts are the two described in [[texting-clients-what-is-and-is-not-automated|Texting clients: what is automated and what is not]]." },
      { q: "How do I add somebody to a job's room?", a: "Book them on one of the job's visits. Membership is derived from the schedule, so there is no add button — and taking them off the visits takes them out of the room." },
      { q: "Can I delete a message or a room?", a: "No. A finished job's room is kept for the record, and a departed member's messages stay attributed to “Someone who left”." },
    ],
  },

  "texting-clients-what-is-and-is-not-automated": {
    title: "Texting clients: what is automated and what is not",
    summary:
      "Exactly two texts reach your clients — On my way and the appointment reminder — in the client's language, with your wording if you set it. What triggers each, what is not texted, and what happens when a client replies.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo texts your clients in two situations and no others: when a crew member marks a visit **On the way**, and before an appointment, at the lead time you chose. Both go out under your business name, in the client's language, with the wording you set under **Settings → Client messages** or the built-in wording if you left it alone.",
      "Everything else — a quote, an invoice, a booking confirmation, a follow-up — goes by email, and there is no two-way texting with clients. This article draws that line precisely so nobody promises a text the product does not send.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Text messages are the last thing a client reads before the van arrives, so FieldQuo keeps them short, in the client's own language, and few. The two that exist are wired end to end — a real trigger, a real send, an opt-out check before every one. Several others exist as wording only and are deliberately not offered for editing until they send, because an editor for a message that never goes out would be a dead control." },
        ],
      },
      {
        id: "what-is-automated",
        heading: "The two texts that go out",
        blocks: [
          { table: {
            head: ["Text", "When it goes", "Built-in wording (English)"],
            rows: [
              ["**On my way**", "The moment a visit's status is set to **On the way** — usually the crew member tapping it on their phone. Only when the job's client has a phone number.", "“Northside Painting: Dave is on the way, ETA 20 min. Reply if you need to reschedule.”"],
              ["**Appointment reminder**", "Once an appointment on your Schedule is inside the lead time you chose under **Settings → Notifications** — 2, 24 or 48 hours before. Checked every hour; sent once per appointment.", "“Northside Painting: Reminder — your appointment is Tue, Sep 15, 2:00 PM at 123 Oak St. Reply STOP to opt out.”"],
            ],
          } },
          { p: "Appointment reminders are **Off** until an owner or administrator picks a lead time — every reminder is a text the company pays for, so nothing is sent that nobody switched on. They apply to appointments on the Schedule (bookings from your booking page, calls the receptionist booked, appointments you add); a visit on a job is a different record and is not reminded by text." },
          { figure: "live:app-settings-messages", caption: "Settings → Client messages — one editor per text, On my way and Appointment reminder, with the token chips, the “Your client sees:” preview, Save and Use default." },
        ],
      },
      {
        id: "what-is-not",
        heading: "What is not texted",
        blocks: [
          { bullets: [
            "**No two-way texting.** A client's reply to a text is not delivered to any screen in FieldQuo. The Messages inbox is Facebook, Instagram and WhatsApp; it is not SMS.",
            "**No booking confirmation text.** A booking from your booking page is confirmed by email. The wording for a confirmation text exists and is not wired to send, so it is not offered for editing.",
            "**No quote, invoice or job-complete texts.** “Your quote is ready”, “Invoice overdue” and “Your job is complete” go by email only — the follow-up rules send email templates and nothing else.",
            "**The receptionist cannot text.** When it has to send a caller to your booking page it reads the link out and says plainly that it cannot text it.",
            "**No marketing texts.** Campaigns are email; there is no mass-text feature.",
          ] },
          { warning: "The built-in On my way wording ends with “Reply if you need to reschedule”, but a reply is not read by FieldQuo. If you want clients to be able to answer that text, put your own office number in your custom wording — or remove the invitation." },
        ],
      },
      {
        id: "language-and-wording",
        heading: "Language and wording",
        blocks: [
          { p: "The built-in wording exists in English, French, Spanish, Ukrainian, Punjabi, Tagalog, German and Italian, and each client gets theirs — the same rule as their quote and their covering email. The date and time in a reminder are written in the client's format and in your company's time zone, so a 2 PM visit in Toronto is never texted as 6 PM. Your custom wording is written once, in the language you work in, and is used only for clients who read that language; everyone else gets the built-in translation. Nothing is machine-translated at send time." },
          { note: "Full detail on the editor, the tokens and **Use default** is in [[client-texts-on-my-way-and-reminders|The two texts your clients get]]. Past 160 characters a text splits into two." },
        ],
      },
      {
        id: "opting-out",
        heading: "Opting out",
        blocks: [
          { p: "Before every text FieldQuo checks the client's number against the opt-out list for your company: a number that has asked to stop receiving texts, or that has asked not to be called, is skipped — the on-my-way text and the reminder alike. The reminder ends “Reply STOP to opt out” in every language, and STOP is kept in English on purpose because carriers treat it as universal." },
          { p: "There is no marketing consent involved: both texts are about a visit the client booked. Neither carries an unsubscribe link, and neither is sent to a client who has no phone number on file." },
        ],
      },
    ],
    faq: [
      { q: "Can I text a client from FieldQuo?", a: "No. There is no compose box for client texts and no client SMS inbox. Client conversations live in Messages (Facebook, Instagram, WhatsApp); everything else is email." },
      { q: "Does a booking from my booking page trigger a text?", a: "No — the confirmation goes by email. The reminder text goes later, at the lead time you set, if reminders are on." },
      { q: "Why did a client get the English reminder when their quote was in French?", a: "The text follows the language on the client's record, the same way the quote does. Check the client's language; a client with none set gets your company's default." },
    ],
  },
};
