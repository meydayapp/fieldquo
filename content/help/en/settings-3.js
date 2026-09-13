// content/help/en/settings-3.js
//
// Part 3 of the “settings” category in en. Slugs assigned to this part
// (lib/help/tree.js): settings-job-photo-tags, settings-client-messages,
// settings-follow-ups, settings-notifications, settings-email-domain,
// settings-payments, settings-meta-ads, settings-expense-tracking,
// settings-ai-credit, settings-payroll, settings-website,
// settings-instant-quotes.
//
// One article per Settings row. Every control described here was read off
// the page module under app/app/settings/<row>/page.js and the route it
// calls; the words on the screen are the `en` block of app/i18n/appMessages.js.
// Access levels come from lib/permissions/settingsAccess.js.
export const ARTICLES = {
  "settings-job-photo-tags": {
    title: "Job photo tags",
    summary:
      "Your own words for what is happening in a job photo — sanding, priming, top coat — and how they sit on top of the four fixed stages.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Job photo tags** is where you write the vocabulary your office uses to describe a photo from the field. A tag is a coloured label — “Sanding”, “Demo”, “Punch list” — that anyone curating a job's photos can put on a shot, and that the job's photo timeline can filter by. Tags are layered on top of the four built-in stages (before, in progress, finished, issue), which stay fixed because they drive the before/after gallery on your website and keep an issue photo off it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is one card: the ordered list of your tags with a colour swatch each, a small form to add one, and a block of starter tags you can adopt in one press. A tag has a name (up to 60 characters), a colour from eight swatches or none, and a position in the list — the order is the order the picker offers them on a photo." },
          { p: "A tag is never deleted. It is **retired**: photos that already carry it keep it, and it simply stops being offered on new ones. That is the same rule FieldQuo applies to a person who leaves the company, and for the same reason — two hundred photos labelled “Priming” must not lose their label because you stopped using the word." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Job photo tags** — the heading, with the sentence explaining that tags sit on top of before / in progress / finished / issue.",
            "The tag list — each active tag with its swatch, **Move up**, **Move down** and **Retire**. Retired tags follow at the bottom, greyed, with the word **retired** and a **Bring back** button.",
            "**Add a tag** — a **Tag name** box, the **Colour** row of swatches, and **Add tag**.",
            "**Starter tags** — a generic set shown as chips (Demo, Prep, Sanding, Priming, Installing, Top coat, Punch list, Touch-up) and one button, **Add starter tags**. Nothing is added until you press it.",
            "**No tags yet** when the company has none, and **You already have every starter tag** once the starter set is fully adopted.",
          ] },
        ],
      },
      {
        id: "add-and-arrange",
        heading: "How to add and arrange tags",
        blocks: [
          { steps: [
            "Open **Settings → Job photo tags**.",
            "Type a name under **Add a tag**, pick a colour (or leave it blank), and press **Add tag**. A name you already use is refused — one tag per word.",
            "Press a tag's name to rename it or change its colour, then **Save**. Use **Move up** and **Move down** to set the order the crew sees.",
            "To stop offering a tag, press **Retire** and confirm. To offer it again later, press **Bring back**.",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Settings → Job photo tags — the ordered list with swatches, the Add a tag form and the starter set." },
          { note: "**Add starter tags** only creates the starter names you do not already have — by name, ignoring case — so a tag you renamed or retired is not re-created behind your back." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["**Add tag**", "Creates the tag at the end of the list. It is offered on new photos immediately."],
              ["**Move up** / **Move down**", "Changes the order of the whole list; the picker on a photo follows it."],
              ["**Retire**", "Hides the tag from the picker on new photos. Every photo already tagged keeps it, and the job's filter still lists it while a photo wears it."],
              ["**Bring back**", "Puts a retired tag back in the picker, in its old position."],
              ["**Add starter tags**", "Adds whichever of the eight starter names you are missing, after your own tags."],
            ],
          } },
        ],
      },
      {
        id: "where-tags-are-used",
        heading: "Where tags are used",
        blocks: [
          { p: "Tags are applied on the job page, in the photo curation panel, by anyone whose access lets them edit jobs. The job's photo timeline above it has a **Filter by tag** dropdown built from the tags actually worn by that job's photos, and a **Manage tags** link back to this screen. Tagging a photo never changes its stage, never features it on the website, and cannot make an issue photo public — see [[job-photos-and-tags|Job photos and tags]]." },
          { tip: "Pick tags that name a step, not a judgement. “Top coat” tells the office where a job is; “Nice” tells nobody anything." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row appears for owners, administrators, and the Dispatcher and Manager levels — anyone who can manage the team. Everyone else can still read the tag list where it matters, on the job's photos, because the picker needs it; they just cannot create, rename or retire one." },
        ],
      },
    ],
    faq: [
      { q: "Can I delete a tag outright?", a: "No. Retire it. Photos that carry it keep it, and it disappears from the picker on new photos. There is no delete button on purpose." },
      { q: "Can a tag replace the “issue” stage?", a: "No. Stages and tags live in different places. A tag literally named “Issue” is decoration; only the stage keeps a photo off your public gallery." },
      { q: "Do crew members choose a tag when they text a photo in?", a: "No. Photos arrive with a stage guessed from the text; tags are added afterwards on the job page by someone who can edit jobs." },
    ],
  },

  "settings-client-messages": {
    title: "Client messages",
    summary:
      "The two texts your clients receive — On my way and the appointment reminder — with the fields you can use, the live preview, and how language is decided.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Client messages** holds the wording of the text messages FieldQuo sends to your clients in your company's name. Only messages that actually send are listed, so today the screen has exactly two editors: **On my way** and **Appointment reminder**. Leave one alone and the client gets FieldQuo's built-in wording; edit it and they get yours, with a preview under the box showing exactly what will arrive.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Each editor is one card: the message name, a three-line box, the field chips you may use, a **Your client sees:** preview filled with sample values (your company name and phone stand in for the samples), **Save**, and **Use default** once you have customised it. A message with a field that does not exist cannot be saved — the screen refuses it, and the server refuses it again — so nobody ever texts a client a raw “{price}”." },
          { note: "Appointment reminders go by text message only; there is no email reminder. Whether reminders send at all, and how long before the visit, is set under [[settings-notifications|Settings → Notifications]] — this screen only decides the words." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Client messages — The texts your clients get.** The subtitle also states the language rule described below.",
            "**On my way** — the text sent when a crew member presses On my way on a visit. Fields: {company}, {worker}, {name}, {eta}, {phone}. A **Customised** label appears once you have saved your own wording.",
            "**Appointment reminder** — the text the reminder schedule sends before an appointment or job visit. Fields: {company}, {when}, {location}.",
            "Under each box: **Your client sees:** with the preview, then **Save** and, on a customised message, **Use default**.",
          ] },
        ],
      },
      {
        id: "edit-a-text",
        heading: "How to change a text",
        blocks: [
          { steps: [
            "Open **Settings → Client messages**.",
            "Write the message in the box of the text you want to change. Tap a field chip to insert it where the cursor is.",
            "Read **Your client sees:** — that is the message with sample values in place of the fields.",
            "Press **Save**. The button stays disabled while the box contains an unknown field or matches what is already saved.",
            "To go back to FieldQuo's wording, press **Use default**. The saved wording is removed, not blanked.",
          ] },
          { figure: "live:app-settings-messages", caption: "Settings → Client messages — the On my way editor with its field chips and the Your client sees preview." },
          { tip: "A field with no value collapses cleanly. Write “ETA {eta}” and a visit with no known arrival time sends “ETA” without a stray blank — you do not need two versions." },
        ],
      },
      {
        id: "fields-you-can-use",
        heading: "The fields you can use",
        blocks: [
          { table: {
            head: ["Field", "What it becomes", "Message"],
            rows: [
              ["{company}", "your business name", "both"],
              ["{worker}", "the assigned crew member", "On my way"],
              ["{name}", "the client's first name", "On my way"],
              ["{eta}", "estimated arrival, if known — worked out from the crew member's position when they press the button", "On my way"],
              ["{phone}", "your business phone", "On my way"],
              ["{when}", "the appointment time, in the client's language and your company's time zone", "Appointment reminder"],
              ["{location}", "where the visit is", "Appointment reminder"],
            ],
          } },
        ],
      },
      {
        id: "languages",
        heading: "Which language the client gets",
        blocks: [
          { p: "Your wording goes to clients who read your company's default language. A client whose language is different gets FieldQuo's built-in wording in theirs — the same eight languages as their quote. Nothing you type is machine-translated at send time." },
          { warning: "Replies to the On my way text are not read by anyone. The built-in wording points the client at your business phone for that reason; if you write your own, keep {phone} in it." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, and the Dispatcher and Manager levels. Saving a message needs the same access; the row is hidden from everyone else rather than shown with buttons that would be refused." },
        ],
      },
    ],
    faq: [
      { q: "Can I edit the booking confirmation text?", a: "Not from here. It exists and sends, but it is not editable yet, so the screen does not show an editor for it." },
      { q: "Does changing the wording change who gets the reminder?", a: "No. This screen is words only. Turn reminders on or off, and pick 2, 24 or 48 hours, under Settings → Notifications." },
      { q: "Why did my client get the default text although I customised it?", a: "Their language is not your company's default language. Custom wording is sent only to clients who read the language it was written in; everyone else receives the built-in text in their own language." },
    ],
  },

  "settings-follow-ups": {
    title: "Follow-ups",
    summary:
      "Rules that email a template a set time after an enquiry, quote, invoice or job reaches a state — the four triggers, the delay, and when a rule stops.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Follow-ups** is where you set the automatic chasing: “three days after a quote is sent with no answer, send this email”; “five days after an invoice is overdue, send that one”. Each rule is a trigger, a delay and an email template. FieldQuo checks the rules once a day, sends to whoever qualifies, and stops the moment the client acts.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is a list of rules under a read-only diagram called **How these run**, drawn from the rules themselves: Trigger → Wait → Send email → Stops. Several rules can share a trigger — a soft nudge at three days and a firmer one at seven — and the diagram stacks them in the order they fire." },
          { p: "A rule needs an email template of the right kind. Only templates of type **Follow-up email**, **Marketing email** or **Custom** are offered, never a quote, instructions or receipt template. With none of those, the screen says so and points you to [[settings-email-templates|Email Templates]]; the **New Rule** button stays disabled until one exists." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Follow-ups — Automatically send a template a set time after a quote, invoice, or job hits a certain state — no manual reminders.** and the **New Rule** button.",
            "**How these run** — the flow diagram, one column per trigger, showing each rule's wait, its template, and the stop conditions. A paused rule is drawn as skipped.",
            "The rule list — each rule's name, **Paused** when it is off, a line such as “3 days after Quote sent, no response → Quote follow-up”, the two stop sentences, then **Pause** or **Activate** and a delete button.",
            "**No follow-up rules yet** for a new company.",
          ] },
        ],
      },
      {
        id: "create-a-rule",
        heading: "How to create a rule",
        blocks: [
          { steps: [
            "Open **Settings → Follow-ups** and press **New Rule**.",
            "Give it a **Rule name (optional)** — left blank, it takes the trigger's name.",
            "Choose the **Trigger**. The sentence under the dropdown says exactly when it fires.",
            "Set the **Delay** and its **Unit** (hours or days). Each trigger proposes a sensible default.",
            "Pick the **Template to send** from your eligible templates.",
            "Press **Create Rule**. It is active immediately and will be considered on the next daily run.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Settings → Follow-ups — the How these run diagram above the rule list, each rule with Pause and delete." },
          { note: "Choosing **New enquiry, nobody replied** shows an extra line: an enquiry has no quote yet, so a template's quote fields ({{quoteUrl}}, {{quoteTotal}}, {{quoteNumber}}) come out blank. It can still fill the client's name, phone and address, your company details, and the service they asked about." },
        ],
      },
      {
        id: "triggers",
        heading: "The four triggers",
        blocks: [
          { table: {
            head: ["Trigger", "Fires when", "Default delay", "Stops"],
            rows: [
              ["**New enquiry, nobody replied**", "an enquiry has sat at ‘new’ for the delay with no quote and nobody marking it contacted", "2 days", "once the enquiry is marked contacted, quoted, won or lost"],
              ["**Quote sent, no response**", "the quote has been sitting at ‘sent’ for the delay with no accept or decline", "3 days", "as soon as the client accepts or declines the quote"],
              ["**Invoice overdue**", "an unpaid invoice is past its due date by the delay", "5 days", "as soon as the invoice is paid"],
              ["**Job completed**", "a job has been marked complete for the delay — a thank-you or a review request", "2 days", "if the job is reopened"],
            ],
          } },
        ],
      },
      {
        id: "how-rules-run",
        heading: "How rules run",
        blocks: [
          { bullets: [
            "Rules are checked **once a day**, not the instant the delay passes. An email lands on the first run after the delay is up.",
            "Each quote, invoice, job or enquiry gets a given rule's email **once**. Two rules on one trigger are two emails; one rule never repeats.",
            "Clients with no email address on file are skipped.",
            "The email goes out from your own domain when you have verified one, otherwise from FieldQuo's shared address under your company name — see [[settings-email-domain|Email Domain]]. Replies go to your company email.",
            "**Job completed** is a marketing send: a client who has unsubscribed from your marketing mail is skipped, and the email carries an unsubscribe link. The other three are transactional and always go.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, and the Dispatcher and Manager levels. Creating, pausing and deleting a rule need that access, so the row is hidden from everyone else. Rules are company-wide: there is no per-person follow-up." },
        ],
      },
    ],
    faq: [
      { q: "Does pausing a rule cancel emails already sent?", a: "No. It stops future sends. Anything already delivered stays delivered, and the rule remembers who it has emailed, so activating it again does not resend." },
      { q: "What happens if I delete the template a rule uses?", a: "The rule shows (template deleted) and sends nothing. Delete the rule or create a new one against another template." },
      { q: "Can a rule send a text instead of an email?", a: "No. Follow-up rules are email only. The texts FieldQuo sends are the two under Client messages." },
      { q: "Why did the email arrive a day later than my delay?", a: "Rules run on a daily schedule. A 3-day delay means the email goes on the first daily run after the third day, not at the exact hour." },
    ],
  },

  "settings-notifications": {
    title: "Notifications",
    summary:
      "When FieldQuo emails the owners about a large quote or a paid invoice, how far ahead clients are texted a reminder, and browser notifications for you.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Notifications** is four cards. Two decide when FieldQuo emails everyone with an owner or administrator role — a large quote created, an invoice paid online. One decides whether clients are texted a reminder before a visit and how far ahead. The last is personal: whether this browser, on this device, shows you a system notification when something happens in your account.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Only alerts that actually fire are listed. There is one threshold to type (the large-quote amount), one switch that is on by default (invoice paid), one choice of lead time (reminders), and one per-browser switch. A footer card, **Client-facing emails**, reminds you that quote, receipt and follow-up emails are configured elsewhere: what they say lives in [[settings-email-templates|Email Templates]], when they go out in [[settings-follow-ups|Follow-ups]]." },
        ],
      },
      {
        id: "large-quote",
        heading: "Large quote created",
        blocks: [
          { p: "**Emails everyone with an owner or admin role when someone on your team writes a quote above this amount.** Until you set an amount the card says **Not set up yet — no alerts are being sent.**" },
          { steps: [
            "Tick **Send this alert**.",
            "Type the threshold under **Alert me above** — in your currency, whole quotes above it qualify.",
            "Press **Save**. Untick the box and save to switch it off; the amount is kept.",
            "Expect the email within a day: the check runs on a daily schedule, not the instant a quote is saved.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Settings → Notifications — the large-quote threshold, the invoice-paid switch, the reminder lead times and the browser card." },
        ],
      },
      {
        id: "invoice-paid",
        heading: "Invoice paid",
        blocks: [
          { p: "**Emails everyone with an owner or admin role when a client pays an invoice online. On by default.** The single **Send this alert** box saves as soon as you tick or untick it. A company that has never touched it is on; only an explicit untick turns it off. Manual payments you record yourself do not trigger it." },
        ],
      },
      {
        id: "appointment-reminders",
        heading: "Appointment reminders",
        blocks: [
          { p: "**Text the client a reminder before their appointment or job visit. Sent from your business name; clients can reply STOP to opt out.** Four pills, one of which is selected: **Off**, **2 hours before**, **24 hours before**, **48 hours before**. Pressing one saves it." },
          { bullets: [
            "Reminders reach both appointments and job visits, once each — never twice for the same visit.",
            "A client who has opted out is never texted, and a visit with no client phone number simply sends nothing.",
            "The check runs every hour, so a 24-hour reminder lands within the hour before the 24-hour mark.",
            "Reminders are included in your plan; nothing is billed per text. The wording is yours to change under [[settings-client-messages|Client messages]].",
          ] },
          { note: "Reminders go by text message only. There is no email reminder. Full detail: [[appointment-reminders|Appointment reminders]]." },
        ],
      },
      {
        id: "browser-notifications",
        heading: "Browser notifications",
        blocks: [
          { p: "**Notify me in this browser** is a per-person, per-device switch. Turning it on asks the browser for permission; from then on new activity — the same events as the bell in the top bar, and new messages in your inbox — shows as a system notification while FieldQuo is in another tab. Where push is set up on the deployment, the same events arrive with the tab closed." },
          { bullets: [
            "The card states the browser permission plainly: **allowed**, **blocked** (with where to change it), or **not asked yet**.",
            "**Send a test notification** shows one now, so you can see the thing itself rather than trust a toast.",
            "On iPhone and iPad, add FieldQuo to the Home Screen first — Safari only delivers notifications to installed web apps.",
          ] },
          { tip: "A blocked permission cannot be undone from a page. Allow notifications for the site in the browser's own settings, then turn the switch on again." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. The company-wide cards write rules the routes refuse to anyone else, and the browser card is shown on this screen for the same people; the row is hidden from every other level." },
        ],
      },
    ],
    faq: [
      { q: "Who receives the large-quote and invoice-paid emails?", a: "Every member with an owner or administrator role who has an email address. There is no per-person opt-out on this screen." },
      { q: "I wrote a $15,000 quote and nothing arrived. Why?", a: "The large-quote check runs once a day. If the threshold is set and the box ticked, the email arrives on the next run." },
      { q: "Can I get a text instead of an email for these alerts?", a: "No. Alerts to you are email and, if you turn it on, a browser notification. Texts are for clients." },
    ],
  },

  "settings-email-domain": {
    title: "Email Domain",
    summary:
      "Send quotes, invoices and every other client email from your own domain instead of FieldQuo's shared address — the DNS records, the statuses, the sender address and where replies go.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Email Domain** is the white-label promise made literal for email. Until you set it up, client emails go out from FieldQuo's shared address under your company name. Once your domain is verified, the From line reads quotes@send.yourcompany.com — your name, your domain, no “via fieldquo.com” beside it — and deliverability improves because the mail is signed as yours.",
      "Nothing here creates a mailbox. Verifying the domain is what grants permission to send as it; the address never needs to exist as an inbox. Replies are handled separately, by the company email set under Company Settings.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "You connect a **subdomain** — send.yourcompany.com rather than yourcompany.com — so that this sending stays separate from your everyday email and cannot interfere with your existing inbox. FieldQuo registers it with its email provider, shows you the DNS records to add, and rechecks on its own every 30 seconds while the status is pending." },
          { p: "Every email FieldQuo sends on your behalf uses the verified domain: quotes, invoices and receipts, follow-up rules, review requests, service-plan invoices, marketing campaigns. Disconnecting sends everything back to the shared address; nothing already sent changes." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The status card — your domain (or **No domain connected**), the sentence **Emails will send from …** or **Your emails currently send from FieldQuo's shared address, using your company name.**, and a status badge. Once connected: **Check verification** (until verified) and **Disconnect**.",
            "**Connect a domain** — shown only before you connect: one box and the **Connect** button.",
            "**Add these DNS records** — shown while verification is pending or failed: the five-step walk-through and each record with its Type, Name, Value, Priority and TTL, each value with a copy button.",
            "**Sender address** — shown once connected: the part before the @ (default **quotes**) and **Save**.",
            "**Replies** — where a client's reply to a quote or invoice goes: your company email, or **your account owner's email, because no company email is set**.",
          ] },
        ],
      },
      {
        id: "connect-your-domain",
        heading: "How to connect your domain",
        blocks: [
          { steps: [
            "Open **Settings → Email Domain**.",
            "Under **Connect a domain**, type a subdomain such as **send.yourcompany.com** and press **Connect**. The status becomes **Waiting on DNS** and the records appear.",
            "Sign in wherever you bought the domain — GoDaddy, Namecheap, Cloudflare, Google Domains. That is your DNS host. Find **DNS**, **DNS records** or **Manage DNS**.",
            "Add a new record for each block on the screen, matching Type, Name and Value exactly. Watch the Name field: most hosts add your domain automatically, so for send._domainkey.example.com you usually enter only send._domainkey. Paste values with no quotes and no line breaks.",
            "Save at your host and leave it. Most hosts apply changes within an hour, some take up to 24. This page rechecks every 30 seconds on its own; **Check verification** asks right now.",
            "When the badge reads **Verified**, set the **Sender address** if you want something other than quotes@, and press **Save**.",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Settings → Email Domain — the domain with its status badge, the Sender address card and where replies go." },
          { warning: "Ending up with send._domainkey.example.com.example.com in the Name field is the most common mistake. If your host shows the full name after saving, you did it right." },
        ],
      },
      {
        id: "statuses",
        heading: "The four statuses",
        blocks: [
          { table: {
            head: ["Badge", "Meaning", "What sends from your domain"],
            rows: [
              ["**Not set up**", "No domain connected.", "Nothing — the shared address is used."],
              ["**Waiting on DNS**", "The domain is registered; the records have not been seen yet.", "Nothing yet. The page keeps checking."],
              ["**Verification failed**", "The provider looked and the records were wrong or missing.", "Nothing. Fix the records and press Check verification."],
              ["**Verified**", "The records are in place.", "Every client email, from now on."],
            ],
          } },
        ],
      },
      {
        id: "sender-and-replies",
        heading: "Sender address and replies",
        blocks: [
          { p: "**Sender address** is the address clients see. It does not need to be a real mailbox — quotes@, hello@, office@ all work — because verifying the domain is what lets FieldQuo send as it. Change it and every email from then on carries the new one." },
          { p: "**Replies** are a different thing. When a client replies to a quote or invoice, the reply goes to your company email; with none set it falls back to the account owner's email so a reply is never silently lost. Change it under [[settings-company|Company Settings]] — this screen only shows it, and prompts you for one on arrival if it is missing." },
          { note: "FieldQuo's own domain and its subdomains are refused here. A tenant cannot verify send.fieldquo.com and send as FieldQuo; use your company's domain." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, and the Dispatcher and Manager levels — the same people who can manage the team. Connecting, changing the sender and disconnecting all need that access; the read is also allowed to a read-only support session, because “our quotes aren't arriving” usually ends here." },
        ],
      },
    ],
    faq: [
      { q: "Do I need to create quotes@send.mycompany.com as a mailbox?", a: "No. The address only has to exist as a sender, and verifying the domain is what allows that. Replies go to your company email regardless." },
      { q: "Can I use my root domain instead of a subdomain?", a: "The screen asks for a subdomain, and for a reason: it keeps FieldQuo's sending records separate from the ones your normal email relies on." },
      { q: "What happens to my emails if I disconnect?", a: "They go back to FieldQuo's shared address under your company name immediately. Nothing already sent is affected, and you can connect again later." },
    ],
  },

  "settings-payments": {
    title: "Payments",
    summary:
      "Connect Stripe so clients pay online into your own bank account — the connection states, the fees card, instant payouts, bank debit, financing, the offline methods printed on invoices, and your Stripe account details.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Payments** is where a company connects Stripe. The Stripe account is opened in your company's name; a client's card or bank payment is a charge on that account, and Stripe pays your bank directly. FieldQuo never sees or stores your bank details and never holds the money.",
      "The screen shows what Stripe itself says about your account, not what FieldQuo last heard, so a badge is never stale. Around the connection sit the cards that matter once money moves: the processing fees, instant payouts, the payment methods you accept, financing, and the identifiers Stripe uses for your account.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Connecting takes you to Stripe's own hosted page to enter your bank details and identity; you come back here when it is done. From then on every invoice your clients receive carries a Pay button, and the payment is recorded against the invoice the moment Stripe confirms it. Fees, payouts, refunds and disputes are the same for every company and are explained in [[payment-processing-fees-and-payouts|Payment processing fees and payouts]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The connection card — one of four states (below), with **Connect with Stripe**, **Finish Setup**, **I've already done this**, **Check again**, **Manage in Stripe** or **Disconnect** depending on the state.",
            "**Processing fees** — the published rates for every method Stripe prices in your currency, the two surcharges that apply only to some cards, and a worked example on a $2,260 card payment.",
            "**Instant payout** — what is available now, the fee, what you will receive, and **Pay out … now**; or the one reason it cannot run yet.",
            "**Payment methods you accept** — **Cash**, **E-transfer**, **Cheque**, and **Save**.",
            "**Your Stripe account** — owner only: the account ID with **Copy**, the sign-in email, what Stripe has switched on, and what it is still waiting for.",
            "**Offer pay-over-time (Affirm)** — a switch, shown once the connection is active — and the closing line that FieldQuo never sees your bank account details.",
          ] },
        ],
      },
      {
        id: "connect-stripe",
        heading: "How to connect Stripe",
        blocks: [
          { steps: [
            "Open **Settings → Payments** and press **Connect with Stripe**. Stripe's page asks for your business details, your identity and the bank account to pay into.",
            "Come back to FieldQuo. If Stripe still needs something, the card lists exactly what under **Stripe still needs a few things**; press **Finish Setup** to return to Stripe's page.",
            "If you completed everything on Stripe's side and the page has not caught up, press **I've already done this** — it asks Stripe directly.",
            "When the card reads **Stripe connected · Active**, clients can pay. Nothing else needs turning on.",
          ] },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — the connected account, the Processing fees card and the payment methods you accept." },
          { note: "**Disconnect** only unlinks Stripe from FieldQuo. It does not delete or close your Stripe account, and nothing about past payouts changes — but clients cannot pay online until you reconnect. Full walk-through: [[connect-stripe-and-get-verified|Connecting Stripe and getting verified]]." },
        ],
      },
      {
        id: "connection-states",
        heading: "The four connection states",
        blocks: [
          { table: {
            head: ["The card says", "What it means", "What to do"],
            rows: [
              ["**Not connected yet**", "No Stripe account exists for your company.", "Press Connect with Stripe."],
              ["**Stripe still needs a few things**", "The account exists but charges are off; the outstanding items are listed, with Stripe's own reason when it gives one.", "Finish Setup, or I've already done this if you did."],
              ["**Stripe is reviewing your details**", "Everything was submitted and Stripe is verifying it — minutes, occasionally a day or two.", "Nothing. Check again later."],
              ["**Stripe connected · Active**", "Charges are on. If payouts are paused the card says so — Stripe is holding your money, or reviewing your account — with the reason.", "Manage in Stripe if Stripe is waiting on something."],
            ],
          } },
        ],
      },
      {
        id: "how-clients-pay",
        heading: "How clients can pay, and what you accept",
        blocks: [
          { p: "Cards work everywhere, at **3% + $0.30**. Bank debit appears as a second button on the client portal — on an invoice, on a deposit request and on each instalment of a payment schedule — once Stripe has activated that capability on your account: pre-authorized debit for a company billing in Canadian dollars (**1% + $0.40, capped at $5.00**), ACH for one billing in US dollars. The **Processing fees** card says which applies right now: **Clients can pay invoices by card or from a bank account (…)**, or that bank payments will be offered once Stripe activates the capability — nothing to do on your side." },
          { bullets: [
            "A bank debit takes **3 to 5 business days** to clear. The invoice shows **Bank payment pending** with the date it was submitted and is marked paid only when the money arrives; if the bank returns it, the balance is still owing and the client can pay again by card.",
            "**Payment methods you accept** is for money that never touches Stripe: tick **Cash**, **E-transfer** and **Cheque** as you take them, press **Save**, and they print as an “Accepted:” line on the invoice email, in the client portal and on the invoice PDF. Untick everything and the line is left out.",
            "**Offer pay-over-time (Affirm)** lets a client split an invoice between $50 and $30,000, in USD or CAD, at checkout; you are still paid in full up front. Activate Affirm in your Stripe dashboard first — the switch saves immediately, and rolls back if it cannot.",
          ] },
          { note: "The card and bank-debit fees are not settings — nobody can change them, and they cannot be passed to the client as a surcharge line. Bank debit in Canada in full: [[bank-debit-in-canada|Bank debit in Canada]]." },
        ],
      },
      {
        id: "your-stripe-account",
        heading: "Instant payouts and your Stripe account",
        blocks: [
          { p: "**Instant payout** moves your available balance to a debit card in about 30 minutes for **1%** of the amount — Stripe's charge, passed through at cost. It needs an active account at least **30 days** old with payouts enabled and a debit card on file; the card explains whichever of those is missing and offers **Add a debit card in Stripe**. Standard payouts stay free and arrive in about 2 business days. See [[instant-payouts|Instant payouts]]." },
          { p: "**Your Stripe account** shows the owner the four things Stripe uses to identify the account: the **Stripe account ID** (it starts with acct_ — not your business name, not your email), the **Sign-in email** Stripe sends its sign-in code to, the two switches **Taking card payments** and **Paying out to your bank** (cards can keep working while payouts are paused — that money is held by Stripe, not lost), and **What Stripe is still waiting for**, with Stripe's deadline when it gave one. Almost everything is settled in your own Stripe dashboard via **Manage in Stripe**; if it genuinely cannot be, Stripe's support is reached from inside that dashboard, and the account ID is what identifies you to them." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only — this is the company's payment processing, with live Manage in Stripe and Disconnect buttons, so it is hidden from every other level rather than shown read-only. The **Your Stripe account** card goes one step further and is shown to the owner alone." },
        ],
      },
    ],
    faq: [
      { q: "Does FieldQuo hold my money?", a: "Never. The charge is created on your own Stripe account and Stripe pays your bank directly. FieldQuo never sees or stores your bank details." },
      { q: "Clients can pay by card — why not by bank account?", a: "Stripe activates bank debit on its own schedule and may ask for more information. The Processing fees card says the moment it is on; until then only the card button shows, and there is nothing to configure on your side." },
      { q: "Payments say Paid but nothing has reached my bank.", a: "The connection card, and the Your Stripe account card, say whether payouts are paused and why. Usually Stripe still needs a document or is reviewing one — see Payouts held or under review." },
      { q: "Where do I turn on cheques so the invoice says we accept them?", a: "Under Payment methods you accept, on this screen. Tick Cheque and press Save; the invoice email, portal and PDF print it as an Accepted: line." },
    ],
  },

  "settings-meta-ads": {
    title: "Meta Ads",
    summary:
      "Connect your own Meta ad account so ad spend flows into your marketing numbers, plus the Facebook lead forms, Facebook & Instagram publishing and WhatsApp Business connections that live on the same screen.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Meta Ads** is where a company connects its own Meta (Facebook/Instagram) ad account. FieldQuo only reads spend and campaign performance — it never creates or changes an ad — and the rows it imports become marketing spend, so your cost per lead includes what you paid Meta. Three more Meta connections sit on the same screen because they are all “a Meta account this company connects”: Facebook lead forms, Facebook & Instagram publishing, and WhatsApp Business.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The connection card has four honest states. If the deployment has no Meta app credentials, or cannot store a token safely, the card says so in words and offers no button — that is a deploy setting, not something in your account. Otherwise you see **Connect Meta Ads**, and once connected: when it last synced, **Sync now**, **See your campaigns →**, **Reconnect** if Meta says the token expired, and **Disconnect**." },
          { note: "Per-campaign cost per lead covers leads that arrived through a Meta lead form. Every other channel — and a homeowner who saw the ad and phoned — is still blended across everything, because nothing links that spend to that lead. See [[marketing-spend|Marketing spend]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Meta Ads — Connect your own Meta (Facebook/Instagram) ad account to bring spend and campaign performance into your marketing numbers.**",
            "The connection card — **Not connected** with **Connect Meta Ads**, or the connected account with **Last synced …**, **Sync now**, **See your campaigns →** and **Disconnect**. After a sync: **… new rows, … updated**, plus any errors, possible duplicates or a currency mismatch.",
            "**Facebook lead forms** — the forms found on your Pages, each with an **On** / **Off** switch, its lead count and last lead, **Find my lead forms**, and **Which campaigns these leads came from**.",
            "**Facebook & Instagram publishing** and **WhatsApp Business** — their own connect cards, each of which says plainly when its permission is not yet approved and offers no button in that case.",
          ] },
        ],
      },
      {
        id: "connect",
        heading: "How to connect your ad account",
        blocks: [
          { steps: [
            "Open **Settings → Meta Ads** and press **Connect Meta Ads**. You are sent to Meta to sign in and approve read access.",
            "If your login has more than one ad account, the card asks **Which ad account?** — pick one and press **Connect this account**.",
            "Back on the screen, press **Sync now**. The first sync imports the last 30 days of daily spend per campaign.",
            "Press **See your campaigns →** to read the rows in Marketing → Spend, where they are marked as imported from Meta.",
            "If the card ever says the token is no longer valid, press **Reconnect** — nothing else changes.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Settings → Meta Ads — the connected ad account with Sync now, the Facebook lead forms panel, and the publishing and WhatsApp cards." },
          { note: "**Disconnect** stops future syncs. Rows already imported stay in your marketing spend history; nothing is deleted." },
        ],
      },
      {
        id: "sync",
        heading: "What a sync does",
        blocks: [
          { p: "A sync asks Meta for each campaign's spend per day over the window (30 days by default, at most 90 at a time) and writes one marketing-spend row per campaign per day, updating rows it already wrote rather than duplicating them. The summary after a sync tells you how many rows were new and how many updated. Syncs are manual — there is no nightly import — so press **Sync now** when you want current numbers." },
          { bullets: [
            "Rows in a currency other than your company's are converted at a pinned exchange rate and marked ≈ approximate.",
            "A possible duplicate — a hand-entered spend row on the same day and channel — is counted and shown, never silently merged.",
            "Errors from Meta are shown on the card with Meta's own message.",
          ] },
        ],
      },
      {
        id: "the-other-three",
        heading: "Lead forms, publishing and WhatsApp",
        blocks: [
          { p: "**Facebook lead forms** turns a form attached to one of your ads into a lead in Leads — scored like any other enquiry, notifying the same people, with your follow-up rules applied. It uses the same Meta login as the ad account. Until Meta approves one more permission for FieldQuo, the panel says **Facebook lead forms need Meta's approval of one more permission; nothing is being received yet.** and every switch is disabled with that reason — shown, not hidden, so you know leads are not arriving and it is not your fault. See [[facebook-lead-forms|Facebook lead forms]]." },
          { p: "**Facebook & Instagram publishing** posts a design from the Marketing Designer straight to your own Page and Instagram account. **WhatsApp Business** answers your own WhatsApp number in Messages beside Facebook and Instagram conversations, with the 24-hour rule explained on the card. Both render a Connect button only when their permission is approved. See [[connect-your-facebook-page-and-instagram|Connecting your Facebook Page and Instagram]] and [[whatsapp-business|WhatsApp Business]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. It is on the same shelf as Payments — a company's own external account with live Disconnect controls — and every route behind it refuses anyone else, so the row is hidden from the other levels." },
        ],
      },
    ],
    faq: [
      { q: "Can FieldQuo create or edit my ads?", a: "No. The connection is read-only: spend and performance come in, nothing goes out." },
      { q: "Does spend import on its own?", a: "No. Press Sync now. Each sync covers the last 30 days by default and updates rows it already wrote." },
      { q: "I connected, so why are lead forms still off?", a: "The lead-form permission is not approved for FieldQuo's Meta app yet. The panel says so and keeps the switches disabled until it is." },
    ],
  },

  "settings-expense-tracking": {
    title: "Expense Tracking",
    summary:
      "The same Expense Tracking screen as Expenses in the main sidebar — the month's cards, the burn breakdown, the trend, recent receipts and the bookkeeping export — reached from Settings.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Expense Tracking** opens the very same page as **Expenses** in the main sidebar. It is listed under Settings because the burn-rate numbers on it — salaries, overhead, debt — are company settings as much as they are a report. Everything about the page itself is in [[expense-tracking-and-burn-rate|Expense tracking and your burn rate]]; this article only says what is on it and who sees it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Expense Tracking — Where your money goes — by job, overhead, and category — plus your monthly burn rate.** The page is one month at a time, with **Add Expense** and **Import from bank CSV** at the top, four cards, an AI summary of the month, the breakdown and trend, the recent receipts, and the **Bookkeeping export** at the bottom." },
          { figure: "live:app-settings-expense-tracking", caption: "Expense Tracking — the month's four cards, the Monthly Burn Breakdown and, at the bottom, the Bookkeeping export." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "Four cards: **Tracked expenses this month**, **Monthly burn rate** (overhead + salaries + debt), **Runway**, and **Job-related spend** split into overhead and general.",
            "**AI Summary** — a written read of the month you generate on demand.",
            "**Monthly Burn Breakdown** with **Manage salaries & debt**, **Spend by Category**, and the **6-Month Trend**.",
            "**Recent Expenses** — each receipt with its date, category, amount, the job it is linked to, and delete.",
            "**Bookkeeping export** — a date range and a download of CSV files for your accountant. See [[the-accounting-export|The accounting export]] and [[import-expenses-from-a-bank-csv|Import expenses from a bank CSV]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row appears for anyone whose access grid gives **expenses** the level that covers everyone's expenses — the Manager level and above, and any Custom access set that way. A person who can only record their own receipts does not see this row; recording their own expense still works from the expense screens the main sidebar shows them." },
          { tip: "Salaries and debt feed the burn rate but are edited on their own screens — press **Manage salaries & debt** rather than looking for them here." },
        ],
      },
    ],
    faq: [
      { q: "Is this different from Expenses in the main sidebar?", a: "No. Same page, two doors. Both menus apply the same access rule, so if you see one you see the other." },
      { q: "Why do I see an expense form but not this row?", a: "Recording your own receipt needs only your own expenses. This row rolls up the whole company's spending, which needs the higher expenses level." },
    ],
  },

  "settings-ai-credit": {
    title: "AI credit",
    summary:
      "The two prepaid balances that meter the phone receptionist, crew texting, AI image generation and the deep photo read — what each costs, how to top up, and the monthly AI credit plan.",
    updated: "2026-09-12",
    intro: [
      "**Settings → AI credit** shows everything that spends credit, in one place. Two balances, kept separate on purpose: **Phone credit**, drawn by the phone receptionist and crew texting, and **AI image credit**, drawn by image generation and the paid deep photo read on a quote. Asking FieldQuo AI about your own business is included in every plan and spends neither.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Each balance is a card with the amount, a **Where the credit went** statement you can expand, and how to add more. The phone card links out to the phone settings page, where buying, automatic top-up and the full statement already live; the AI card sells top-ups directly and, below it, a monthly **AI credit plan** at a lower price per credit." },
          { p: "Credit is bought in US dollars whatever your plan's currency, because that is what the AI is bought in. A one-time top-up works for every company; the monthly plan is only offered to a company whose FieldQuo subscription bills in USD, and the screen says why when it is not." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Phone credit** — **Balance:** with **running low** when it is, the per-minute rate of the receptionist in the card's hint, the note that crew texting draws the same balance, **Add phone credit**, and **Where the credit went**.",
            "**AI image credit** — **Balance:** with **(about … images, or … deep reads)**, the **Add credit** row of top-up amounts, each with the number of images it buys, and **Where the credit went**.",
            "**AI credit plan — pay monthly, save per credit** — three plans with **… credits — about … images** and **Subscribe**; or, once on one, **On the … plan — … credits for …/month**, **Renews …** and **Cancel plan**.",
          ] },
        ],
      },
      {
        id: "add-credit",
        heading: "How to add credit",
        blocks: [
          { steps: [
            "Open **Settings → AI credit**.",
            "For images and deep reads, press one of the amounts under **Add credit** — $10, $30, $50 or $100. You pay on Stripe's checkout page and come back; the card says **Payment received — … of AI credit added.**",
            "For phone minutes and crew texting, press **Add phone credit**; it opens the phone settings page, where top-ups and automatic top-up live. See [[settings-phone-receptionist|Phone receptionist]].",
            "To pay monthly instead, choose a plan and press **Subscribe**. The first month's credit lands on the balance straight away.",
          ] },
          { figure: "live:app-settings-ai-credit", caption: "Settings → AI credit — the Phone credit and AI image credit balances with their top-ups, and the monthly plan card." },
          { note: "If the card says **We couldn't confirm that payment just yet**, the money went through and the credit lands on its own within a minute or two. Nothing is charged twice — refresh to check." },
        ],
      },
      {
        id: "what-things-cost",
        heading: "What each thing costs",
        blocks: [
          { table: {
            head: ["Action", "Balance", "Cost"],
            rows: [
              ["One generated marketing image", "AI image credit", "12¢ each"],
              ["One deep photo read on a quote", "AI image credit", "25¢ per read, up to 8 photos"],
              ["A minute on the phone receptionist", "Phone credit", "the per-minute rate printed on the card"],
              ["Crew texting", "Phone credit", "the same balance as calls"],
            ],
          } },
        ],
      },
      {
        id: "the-monthly-plan",
        heading: "The monthly plan",
        blocks: [
          { p: "The plan is a recurring allowance on the same AI image balance, at a lower price per credit than buying as you go. One credit is one cent of pay-as-you-go value: an image is 12 credits, a deep read 25. Three sizes are offered: **starter** ($30 for 4,000 credits), **busy** ($50 for 7,000) and **agency** ($80 for 11,500)." },
          { bullets: [
            "Credit rolls over. Whatever you do not use this month is still there next month — nothing expires.",
            "**Cancel plan** stops next month's charge and next month's credit. Credit already on your balance stays; it is never taken back.",
            "The plan renews on the date shown under **Renews**, and the credit is added when the payment succeeds.",
          ] },
          { warning: "Plans are billed in US dollars. A company whose FieldQuo subscription bills in another currency cannot add one — Stripe cannot run both on one account — and the Subscribe button is disabled with that reason. One-time top-ups still work." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, and the Dispatcher and Manager levels — the same gate as the phone credit row, because this is the company's money. Top-ups and plans need that access too. See also [[ai-credit-and-phone-credit|AI credit and phone credit]] under Billing." },
        ],
      },
    ],
    faq: [
      { q: "Does asking FieldQuo AI a question cost credit?", a: "No. FieldQuo AI and the quote copilot are included in every plan. Credit meters phone minutes, crew texting, image generation and the deep photo read only." },
      { q: "Why are there two balances?", a: "The phone provider bills a monthly floor and the AI provider bills only on use, so the two are metered separately and never merged. Buying one does not fund the other." },
      { q: "Does credit expire?", a: "No. Top-ups and plan credit both stay on the balance until spent, and cancelling a plan never removes credit already granted." },
    ],
  },

  "settings-payroll": {
    title: "Payroll settings",
    summary:
      "When you pay — frequency, closing day, payday — and the deductions and allowances that turn gross pay into net: regional starting points, your own components, tax bands.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Payroll** is what a pay run calculates from. The top card, **When you pay**, sets the cadence: how often, the day the period closes, payday. Below it are the components — deductions such as income tax, CPP or EI, and allowances or earnings such as a tool allowance — each a fixed amount, a percent of gross, or progressive bands. Until something is set up here, pay runs show gross pay only, and say so.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "FieldQuo does the arithmetic with the rates you save here. It does not file or remit anything, and it does not update rates when they change — the regional templates are published figures for the year shown, offered as a starting point, and they become your numbers the moment you seed them. Review them each tax year with your accountant." },
          { note: "FieldQuo works out gross pay, produces the payslips and exports the run. It does not pay employees or file your payroll taxes — deductions are the ones you or your accountant supply. Running payroll itself is in [[payroll-runs|Payroll runs]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**When you pay** — **How often** (Every week, Every 2 weeks, Twice a month, Once a month), **The period closes**, **Payday**, the days to approve hours, then **This period** and **Last one closed** with their dates. **Set by an owner or admin.**",
            "**Start from your region** — Canada, United States or United Kingdom, each with **… components · … figures** for the year, and the sentence that these are published figures to confirm with your accountant.",
            "**Deductions** and **Allowances & earnings** — each component with **statutory** where it applies, its rule (**… % of gross**, **… progressive bands**, or an amount), **everyone** or **assigned individually**, and **Turn off** / **Turn on** and remove.",
            "**Add a component** — the form for a new one: name, Deduction or Allowance / earning, Fixed amount / Percent of gross / Progressive bands, and **Apply to everyone automatically**.",
          ] },
        ],
      },
      {
        id: "set-up",
        heading: "How to set it up",
        blocks: [
          { steps: [
            "Open **Settings → Payroll** and fill in **When you pay**. Every-week or every-2-weeks aligns to whole weeks; twice-a-month and monthly are calendar periods, and the card warns that weekly overtime is then worked out on the partial weeks inside each period.",
            "Press your region under **Start from your region** to seed the usual statutory deductions — federal bands, CPP/EI or their equivalents. Components you already have are left alone.",
            "Open each seeded component, read the figures against your accountant's, and correct them. They are yours now; FieldQuo will not change them later.",
            "Press **Add a component** for anything else — union dues, a tool allowance — choosing how it is calculated and whether it applies to everyone automatically.",
            "**Turn off** a component to keep it without applying it; remove it only if you never want it back. Past payslips keep what was already deducted either way.",
          ] },
          { figure: "live:app-settings-payroll", caption: "Settings → Payroll — When you pay, the regional starting points, and the deduction and earning components." },
          { warning: "Provincial and state income tax, employer-side contributions and the finer rules (CPP2, exemptions, allowance tapering) are deliberately not in the templates. A half-populated set looks complete and under-withholds. Have your accountant add what your region needs." },
        ],
      },
      {
        id: "component-types",
        heading: "The three ways a component is calculated",
        blocks: [
          { table: {
            head: ["Calculation", "What you enter", "Typical use"],
            rows: [
              ["**Fixed amount**", "an amount per pay period", "union dues, a tool allowance"],
              ["**Percent of gross**", "a percentage", "CPP at 5.95%, EI"],
              ["**Progressive bands**", "annual thresholds, lowest first — leave the last “up to” blank for “and above” — and a percent for each", "income tax brackets"],
            ],
          } },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**When you pay** decides which hours fall into which run and the payday printed on every payslip. Changing it changes the next period, never one already closed.",
            "**Apply to everyone automatically** puts the component on every person's payslip; off, it is assigned per person from their pay settings.",
            "**Turn off** keeps the component and its figures but skips it on the next run; **Turn on** brings it back.",
            "Remove deletes the component from future runs only — past payslips keep what was already deducted.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. The route answers a refusal to everyone else — a Manager runs the day-to-day but never sees deduction rates or tax bands — so the row is hidden from every other level." },
        ],
      },
    ],
    faq: [
      { q: "Will FieldQuo update the tax rates next year?", a: "No. Seeded figures become your own the moment you seed them and are never changed afterwards. Review them each tax year with your accountant." },
      { q: "Can I pay one person differently?", a: "Yes. Untick Apply to everyone automatically on the component and assign it per person from their pay settings." },
      { q: "What happens to old payslips if I remove a deduction?", a: "Nothing. Past payslips keep what was already deducted; only future runs stop applying it." },
    ],
  },

  "settings-website": {
    title: "Your website",
    summary:
      "The website builder — a brief in your words, a conversation to refine it, five layouts and a set of styles, Fine-tune for the address, languages and photos, and Publish.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Your website** builds and edits the public website FieldQuo hosts for your company at yourname.fieldquo.com. You describe how it should look and feel; FieldQuo writes the sentences. The layout, the services, the testimonials, your logo, colours, hours and contact details all come from what the company record already holds, so the site is never invented and never asks you to type those again.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The first run is one large box — **What should your website say?** — with example chips and **Build my site**. After that the screen is a conversation on the left and the live site on the right: type “Make it bolder”, “lead with reviews”, “shorter page” and the page is rebuilt. Nothing is public until you publish it." },
          { p: "The model writes words only. It never chooses a layout freely, invents a service, or emits a style rule; block lists, service names and testimonials come from the database and are merged back after generation. If the writing assistant cannot be reached, the site is built from your saved details alone and the thread says the words are plainer than usual — never a broken page." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The header — your site address with a **Live** badge once published, **Open**, **Save**, and **Publish** or **Update**; **Unpublish** once live.",
            "The conversation pane — what you asked, what was built (**Rebuilt your site: …**), and what it still needs, as messages with one-tap actions such as **Add my photos** and **Pair them up**.",
            "**Layout** and **Style** — two rows of chips under the conversation. Applying one is instant, keeps your photos and wording, and spends no AI.",
            "The prompt box — **Make it bolder · lead with reviews · shorter page…** — and **Fine-tune**, which opens **Web address**, **Languages**, **Before & after pairs** and the reviews embed.",
            "The right pane — **Preview** (desktop or mobile, the real page in a frame) or **Sections**, where you reword any heading or paragraph by hand.",
          ] },
        ],
      },
      {
        id: "build",
        heading: "How to build and edit your site",
        blocks: [
          { steps: [
            "Open **Settings → Your website**, describe the look you want in the box — or tap an example chip — and press **Build my site**.",
            "Read the thread. When it asks for what is missing — photos, a before/after pair, a review, hours — use the action it offers or answer in the box.",
            "Type a change and press send. Each message rebuilds the page; the preview refreshes on its own.",
            "Try a **Layout** or a **Style** chip. Your photos and wording carry over; edit anything, then **Save**.",
            "Press **Publish**. The site goes live at your address; from then on the button reads **Update**.",
          ] },
          { figure: "live:app-settings-website", caption: "Settings → Your website — the conversation and the Layout / Style chips on the left, the live preview on the right." },
          { note: "Rebuilding after you have edited text by hand asks first: **This will rewrite the words you edited.** Photos, before-and-after pairs, logo and colours are kept; headings and paragraphs you typed are replaced. Choose **Keep what I wrote** or **Rebuild anyway**." },
        ],
      },
      {
        id: "layouts-and-styles",
        heading: "Layouts and styles",
        blocks: [
          { p: "A layout is the order and choice of sections; a style is the typography, colour treatment and spacing. Five layouts times the styles on offer (Modern, Bold, Minimal, Classic, Warm, Editorial and more) are the real “templates” — a menu, not one generated page. Your brand colour and logo apply to every one of them." },
          { table: {
            head: ["Layout", "What leads"],
            rows: [
              ["**Show the work first**", "your job photos and before/after pairs"],
              ["**Lead with services**", "the list of what you sell"],
              ["**Lead with reputation**", "reviews and testimonials"],
              ["**Lead with booking**", "the booking form"],
              ["**Short one-pager**", "one page, the basics and a way to reach you"],
            ],
          } },
        ],
      },
      {
        id: "fine-tune",
        heading: "Fine-tune",
        blocks: [
          { bullets: [
            "**Web address** — the part before .fieldquo.com. Reserved names such as app or www are refused because they are a security boundary, not a naming preference. See [[your-website-address|Your website address]].",
            "**Languages** — your main language is marked. Adding one writes the whole site in that language and gives visitors a switcher in the header; it does not machine-translate the page. Removing one takes it off the site.",
            "**Before & after pairs** — pair a before photo with its after; the pairs drive the slider on the site. Only photos staged before and finished are offered, never an issue photo.",
            "**Sections** — reword anything by hand, hide a section, add or remove a photo. Your logo, colours, services, hours and contact details are not editable here; change them under Company Settings and the site updates.",
          ] },
        ],
      },
      {
        id: "publish-and-unpublish",
        heading: "Publish and unpublish",
        blocks: [
          { p: "**Publish** makes the site public; **Update** pushes later saves live. Publishing with stock photos still on the page is allowed — a company with no photos yet is not blocked from launching — but it is never silent: the screen counts them and offers **Add my photos** or **Publish anyway**. Stock photography is only ever in the header background and similar spots, never in “Our work”. On a free account the footer carries a small “Site by FieldQuo” line; a paid plan removes it. See [[the-site-by-fieldquo-footer|The Site by FieldQuo footer]]." },
          { warning: "**Unpublish** takes the site offline at once — visitors see a “not published” page, and Google drops it over the following days. Every section, photo and language is kept, and **Publish** puts the same site back whenever you like." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. Saving, publishing, adding a language and uploading photos all refuse anyone else, so the row is hidden from every other level. The full guide is [[the-website-builder|The website builder]]." },
        ],
      },
    ],
    faq: [
      { q: "Will the AI invent services I don't offer?", a: "No. Services, testimonials and photos come from your own data and are merged back after the words are written. The model chooses sentences, not facts." },
      { q: "Can I use my own domain?", a: "The site lives at yourname.fieldquo.com; the Web address field sets the first part. FieldQuo does not connect a custom domain to the site today." },
      { q: "Does adding a language translate my site?", a: "No. It writes the whole site again in that language from your data and gives visitors a switcher. Nothing is machine-translated." },
    ],
  },

  "settings-instant-quotes": {
    title: "Instant Quotes",
    summary:
      "The rate card behind your instant-estimate link — switch a trade on, set the rates and surcharges, choose what the homeowner sees, and put the estimator on your own website.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Instant Quotes** is the rate card a stranger is quoted from. A homeowner opens your instant-estimate link, enters an address or traces an area on a map, answers a few questions, and gets a real starting range in seconds — priced from the numbers you save here and from nothing else. Every estimate lands in [[estimate-reviews|Estimate Reviews]] before it can be sent, and the public page never shows the rate card itself.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is one card per trade FieldQuo can price — roofing, epoxy floors, parging, lawn mowing, cabinet refinishing and refacing, flooring, painting, stairs, countertops, junk removal — with an **On** / **Off** switch, the way that trade measures, editable material sell rates, the surcharges the estimate applies, a minimum charge and a range width. Saving a trade is what makes it live; until then it is off, so there is never a live button pricing off numbers nobody chose." },
          { p: "The cards start from your **Services & Pricing** rates where you have them (**Started from your Services & Pricing rates**), or from typical starting figures where you do not (**These are typical starting figures, not your prices**). Either way nothing is offered to homeowners until you edit and save. If your services rates change later, the card says so — **Your Services & Pricing rates changed since this was saved** — and offers **Use my services pricing**; it never changes your live rates on its own." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The live line — **… live on your instant-estimate link.** with **See what homeowners see**, or **Nothing is live on your instant-estimate link yet — switch a service on below.**",
            "**Put the instant estimate on your website** — an embed snippet with **Copy code**, shown only once something is live.",
            "**These are ready to go live as soon as you price them** — services you sell that have no rate of yours yet, each with **Price …**; and a banner if a live instant quote is not one of your services.",
            "One card per trade you sell: the switch, **What the homeowner sees**, **Materials & sell rates**, the surcharges, **Minimum charge**, **Range width (±)**, **Budget bands**, and **Save & enable**. **+ Show … other trades FieldQuo can price** lists the rest.",
            "**Financing** — optional, company-wide: your own wording and, if you state them, an annual rate and term.",
          ] },
        ],
      },
      {
        id: "switch-a-trade-on",
        heading: "How to switch a trade on",
        blocks: [
          { steps: [
            "Open **Settings → Instant Quotes**. If the trade is not one of your services, add it under [[settings-services|Services & Pricing]] first — that is the list your quotes, your website and your receptionist all read.",
            "On the trade's card, read how it measures — for example **Roof measured automatically from the address (Google satellite)** or **Homeowner enters the area and picks options**.",
            "Set each material's sell rate under **Materials & sell rates** (per square, per sqft, per door, per tread… as the trade prices), and add or remove materials.",
            "Set the surcharges that trade applies, the **Minimum charge** and the **Range width (±)**.",
            "Choose **What the homeowner sees** (below), then press **Save & enable**. The live line at the top counts it.",
            "Press **See what homeowners see** to open your public link, or **Copy code** to embed it on your own site.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Settings → Instant Quotes — the live count and embed snippet, then a trade card with its switch, materials, surcharges and Save & enable." },
          { note: "For painting, homeowners are only asked interior or exterior when both Interior Painting and Exterior Painting are on under Services; with one on, every estimate is priced as that scope, and with neither, painting is not offered at all whatever is saved here." },
        ],
      },
      {
        id: "what-the-homeowner-sees",
        heading: "What the homeowner sees",
        blocks: [
          { table: {
            head: ["Choice", "What happens", "Trade-off"],
            rows: [
              ["**Don't show a price**", "They submit and the page says a quote is on the way.", "You get the details; they see no number until you review."],
              ["**Show the range straight away**", "The range appears before they leave any details.", "Expect people to read it and go."],
              ["**Show the range after they submit**", "They fill in the form to unlock their range.", "You get their details either way — the usual pick."],
            ],
          } },
        ],
      },
      {
        id: "rates-and-controls",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**On** / **Off** — whether the trade is offered on your link at all. Off keeps every rate saved.",
            "**Materials & sell rates** — the base price per unit for each material the homeowner can pick. The unit follows the trade: per square for roofing, per sqft for flooring and epoxy, per door and drawer for cabinets, per tread for stairs, per visit by lot size for lawn mowing.",
            "Surcharges — added on top of the base only when the homeowner's answers call for them: steep pitch and tear-off per layer for roofs, surface prep, access and condition elsewhere, the scope uplift for painting.",
            "**Minimum charge** — the floor of any estimate for that trade.",
            "**Range width (±)** — how wide the range shown is around the computed figure.",
            "**Budget bands** — the three cut-off points behind the four budget options the homeowner is asked; they must increase, or the standard bands are shown instead.",
          ] },
        ],
      },
      {
        id: "financing",
        heading: "Financing",
        blocks: [
          { p: "FieldQuo does not provide financing. The **Financing** card lets you tell homeowners it is available in your own words, or hand them to your provider. If you also fill in **Annual rate (APR %)** and **Term (months)** under **Your stated terms (optional)**, the estimate shows a monthly payment labelled as an estimate on your stated terms. Leave either blank and no monthly figure is ever shown — FieldQuo has no default rate and no default term." },
          { warning: "Do not promise a rate or a monthly amount you cannot honour. The wording and the figures are yours, and they are what the homeowner reads." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row appears for anyone whose access includes **See prices** — the Estimator, Dispatcher and Manager levels, owners and administrators — because the rate card is prices. Editing and saving a trade is owner and administrator only; everyone else sees the cards read-only. The public estimator, by contrast, never shows a rate to anyone. See [[instant-quotes-on-your-website|Instant quotes on your website]]." },
        ],
      },
    ],
    faq: [
      { q: "Can a homeowner see my rates?", a: "No. The public page shows a range, never the rate card. Publishing a rate card openly would hand it to every competitor in town." },
      { q: "Is an instant estimate binding?", a: "No. It is a range the homeowner can request. It lands in Estimate Reviews, and nothing is sent to them as a quote until someone approves it." },
      { q: "I switched a trade on but the link says nothing is available.", a: "A trade is live only when it is on and priceable — saved with rates. The line at the top counts exactly those; the card of a trade that needs a price says so." },
    ],
  },
};
