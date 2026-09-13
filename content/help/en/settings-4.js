// content/help/en/settings-4.js
//
// Part 4 of the “settings” category in English (see the composer,
// settings.js): the Client-facing rows that face a stranger — Share your
// links, Bio link, Phone receptionist, AI employee, Reviews — and the four
// Account rows — Data Migration, Product Updates, Account & Billing, Refer &
// Earn.
//
// Every article is ONE row of the Settings menu, described from its page
// module (app/app/settings/<row>/page.js), the API it calls and the lib rule
// behind each control. Who can open a row is read from
// lib/permissions/settingsAccess.js (SETTINGS_ROW_CAPABILITY): "user:manage"
// is owner, administrator, Dispatcher and Manager; "billing" is owner and
// administrator; "everyone" includes Crew. The two rows that are the same
// page as a main-sidebar row (Account & Billing, Refer & Earn) stay short and
// link the fuller article.
export const ARTICLES = {
  "settings-share-your-links": {
    title: "Share your links",
    summary:
      "The Settings row that lists every public link a stranger can use to become a lead — Request a quote, Book a visit, Instant estimate, each published funnel — with Copy link, Open and an embed snippet on each card.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Client-facing → Share your links** is the one screen that answers “what can I put on my Facebook page, my Google listing, my email signature or the side of the van?”. Its subtitle says exactly that: “Put these anywhere you already are — your website, Google listing, Facebook page, email signature, or the side of the van.”",
      "Every link on it is public — no login, no app, works on a phone in a driveway — and every visitor who uses one lands on your Leads board or your calendar, on a page carrying your logo and your colour. Nothing on this screen is a setting; it is a list of addresses you copy.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The plain link comes first on every card and the embed code second, because most contractors have a Facebook page and a phone rather than a website to paste code into. Each card is the same shape: a title, one sentence saying who the link is for, the address itself, **Copy link**, **Open**, and under it **Or paste this into your own website** with a **Copy** button for the snippet." },
          { p: "The snippet points at a frame of the same page with no FieldQuo chrome; it reports its own height so it sits cleanly in whatever site you paste it into. See [[embed-booking-and-quote-forms|Embed booking and quote forms on any site]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Request a quote** — “They describe the job and leave their details. Lands in your Leads pipeline. Best for people still comparing prices.”",
            "**Book a visit** — “They pick a time from your real availability. Best for people who've already decided and just want you there.”",
            "**Instant estimate** — “They enter their address and get a real starting price in seconds — roof measured from satellite, or an area they trace on a map. Every estimate lands in your review queue before it's binding.” Trades and rates live under **Settings → Instant Quotes**.",
            "**Design your kitchen** — shown only when the **Kitchen Design & New Installs** service is switched on under Services. A homeowner lays out their own kitchen and sends it to you as an enquiry with the drawing attached. This card has a link and no embed, because no embeddable kitchen widget exists.",
            "**One card per published funnel**, named as you named it — “A tap-through lead funnel — share the link on an ad, or put it on your site.” A draft funnel is not listed, because its link would not work yet.",
            "The closing line: the quote form only offers the services you enabled under **Settings → Services**, and never shows your prices.",
          ] },
        ],
      },
      {
        id: "copy-a-link",
        heading: "How to copy a link",
        blocks: [
          { steps: [
            "Open **Settings → Share your links**.",
            "On the card you want, press **Copy link**. The button reads **Copied** for two seconds.",
            "Press **Open** first if you want to see the page exactly as a stranger will.",
            "Paste the link where people already find you. For a website you run, press **Copy** under **Or paste this into your own website** instead and hand the code to whoever edits the site.",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Settings → Share your links — the Request a quote, Book a visit and Instant estimate cards, each with its link, Copy link, Open and the embed snippet." },
          { note: "There is no QR code on this screen. The link does not change, so any QR generator will turn it into a square for the van, and the square keeps working." },
        ],
      },
      {
        id: "where-each-link-goes",
        heading: "Where each link goes",
        blocks: [
          { table: {
            head: ["Link", "What the visitor does", "What you get"],
            rows: [
              ["Request a quote", "Picks a service, describes the job, adds photos, leaves their details", "A scored lead on the Leads board — see [[the-lead-form-on-your-website|The lead form on your website]]"],
              ["Book a visit", "Chooses a visit type and a slot from your real availability, pays a visit fee if you charge one", "An appointment on your calendar and a lead — see [[settings-booking-page|Booking Page]]"],
              ["Instant estimate", "Enters an address or traces an area and sees a starting price", "An estimate in your review queue, confirmed by you before anything is sent — see [[settings-instant-quotes|Instant Quotes]]"],
              ["A funnel", "Taps through a short quiz and leaves their details", "A scored lead tagged with the funnel's channel — see [[funnels|Lead funnels]]"],
            ],
          } },
          { p: "None of the four shows a rate. The instant estimate shows a starting price only for the trades you switched on, and only what you chose under **What the homeowner sees** on the Instant Quotes screen." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators, and anyone at the Dispatcher or Manager level see the row and every card. Crew and Estimator logins do not see it. The funnel cards read from the funnels list, which is owner-and-administrator on the server; a Dispatcher or Manager sees the line **Lead funnels are managed by an owner or admin — ask one of them for the link** in place of the funnel cards, and the three fixed cards as normal." },
        ],
      },
    ],
    faq: [
      { q: "Why is my funnel not listed?", a: "Only published funnels with an address appear. Open Funnels, open the funnel and publish it; a funnel needs a contact step before it can be published." },
      { q: "Do these links show my prices?", a: "No. The quote form collects enough detail to quote accurately without publishing a rate, and the instant estimate shows only what you chose to show for the trades you switched on." },
      { q: "Can I change the address of a link?", a: "The links are built from your company's booking slug, which is set under Settings → Booking Page. Changing it there changes every link on this screen, and anything already printed stops working." },
    ],
  },

  "settings-bio-link": {
    title: "Bio link",
    summary:
      "The Settings row that builds the one page Instagram and TikTok let you link to — your heading, a line under it, your social handles and the buttons that matter — with a live phone preview and a Save button.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Client-facing → Bio link** makes the single link a social profile allows into a page: “One page for the single link Instagram and TikTok allow in your profile. It carries your logo and your colour, with a small “Made by FieldQuo” line at the very bottom.” The address sits at the top of the screen, big, with **Copy link**, because getting that string into a phone's clipboard is the reason anyone opens this row.",
      "Nothing on the page is invented. A button appears because the thing behind it exists — an instant estimator, a bookable visit type, a published funnel, your website, your review link, your phone — and a button you switch off stays off.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is derived from your company record. The quote form is always there, because every company has one; **Book a visit** appears once you have an active visit type; an instant price once an instant estimator is switched on; each published funnel as its own button; your website once it is published or once a domain is entered in Company Settings; **Leave a review** once a link is saved under Reviews; **Call** and **Email us** from the phone and email in Company Settings. Every row you have is on by default, except **Message on WhatsApp**, which stays off until you say the number is on WhatsApp." },
          { p: "The public page follows the visitor's phone between light and dark on its own. The light / dark switch on this screen changes only the preview frame. Button wording comes from your company's language, not the language you are reading the settings in." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Your link** — the address, **Copy link**, **Open**, and the **Page is live** box. Under it: “Paste this into your Instagram or TikTok bio.”",
            "**Heading** — “Leave it empty to use your company name.” — and **One line under it** — “Optional. Empty means nothing is shown — we don't write one for you.”",
            "**Follow us** — Instagram, Facebook, TikTok, YouTube, LinkedIn and X. “Type a handle or paste the profile link; leave one empty to hide it.”",
            "**What's on the page** — every row with a **Show on the page** box, its **Button text**, a grip to drag, **Move up** / **Move down**, and its group: **Get a price**, **Book**, **Contact** or **More**. “The first one is the big button.”",
            "**Add your own link** — up to ten rows you write yourself, each with text, a URL and an **Icon**.",
            "**Not available yet** — the rows you cannot have yet, each with the screen that would create it.",
            "**Preview** — a phone frame updated as you type, with a **Light** / **Dark** toggle, and **Save** at the bottom.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "How to set it up",
        blocks: [
          { steps: [
            "Open **Settings → Bio link**.",
            "Write the **Heading**, or leave it empty to use your company name, and the **One line under it** if you want one.",
            "Under **Follow us**, type your handles. A field that does not look like a handle or a profile link is not saved, and the screen says so before you save.",
            "Under **What's on the page**, tick the rows you want, rename a button whose default wording is not yours, and drag or use the arrows to put the most important one first — it becomes the big button.",
            "Press **Add your own link** for anything else, such as a Google listing or a gallery elsewhere. Your own links need both text and a URL.",
            "Press **Save**, then **Copy link** and paste it into your Instagram or TikTok profile.",
          ] },
          { figure: "live:app-settings-links", caption: "Settings → Bio link — Your link with Copy link and Open, the Heading and Follow us cards, the ordered rows under What's on the page, and the phone preview." },
          { note: "Nothing is saved until you press **Save**. Reorder, rename and switch off is a multi-step edit of one public page, and saving every keystroke would put half-finished states in front of whoever taps the link in between." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**Page is live** — untick it and save, and the address shows a not-found page until you tick it again. The screen then reads “The page is switched off — this link shows a not-found page.” The page is live from the start.",
            "**Show on the page** — hides or shows one row. A hidden row keeps its place and its wording for when you bring it back.",
            "**Button text** — replaces the default wording for that row only. Empty means the default, never a blank button.",
            "**Order** — the first row is the large button. The page groups rows under headings, and the headings are ordered by where each group's first row falls, so putting your website first puts **More** first.",
            "**Light** / **Dark** — the preview frame only. Visitors get whichever their phone asks for.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators, and anyone at the Dispatcher or Manager level can open and save this screen; Crew and Estimator logins do not see the row. The public page needs nothing — no account, no app. For the page itself and what each button opens, see [[the-bio-link|The bio link]]." },
        ],
      },
    ],
    faq: [
      { q: "Why is Book a visit greyed out?", a: "You have no active visit type. The Not available yet list says which screen creates one — Settings → Booking Page." },
      { q: "Why is WhatsApp off when I have a phone number?", a: "Having a number is not a statement that WhatsApp is on it, and a WhatsApp link to a number that is not opens a chat with nobody. Tick Show on the page when it is." },
      { q: "Is there a QR code?", a: "Not on this screen. The address is short enough to say out loud, and any QR generator will turn it into a square for the van." },
    ],
  },

  "settings-phone-receptionist": {
    title: "Phone receptionist",
    summary:
      "The Settings row that sets up the AI receptionist: credit, a number, what it says, the answering switch, callbacks, crew texting and the end-to-end check — what each card changes and who can open it.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Client-facing → Phone receptionist** is titled “Answers the calls you can't, takes the details, and books visits against your real availability. It never quotes a price.” The screen is laid out in the order of the decisions — credit, then a number, then the words, then the switch — and a new company sees the cards numbered 1 to 7. Once the setup is done the numbers disappear and the same cards remain.",
      "This article walks the screen card by card. What the receptionist does on a call, what a minute costs and what nobody else's pricing page lists is in [[the-phone-receptionist|The phone receptionist]]; what it did with each call is the Receptionist screen in the main sidebar, see [[the-receptionist-call-log|The receptionist's call log]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A status bar at the top shows your number and whether it is answering. Everything the receptionist can spend is priced by the server and printed on the screen before you commit: the per-minute rate on the **Credit** card, the monthly rental beside each kind of number, the top-up amounts. The browser never sends an amount." },
          { note: "The receptionist runs on prepaid credit in US dollars. Calls are metered per minute, numbers are rented per month, and both come out of the same balance." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "The seven cards",
        blocks: [
          { bullets: [
            "**Credit** — the **Balance**, the rate (“35¢ a minute, rounded up, one minute minimum. Your number's monthly rental comes out of this same credit.”), **Add credit**, **Where the credit went**, and the **Top up automatically** card.",
            "**Your number** — “What the receptionist answers on.” Three ways to get one: **Keep my number, forward missed calls** (marked **Recommended**), **Get a new number** with **Choose the number yourself**, or **Move my number over**. A live number shows its forwarding codes, its next rental date and a **Release** link.",
            "**What it says** — “It will never give a price, promise a time it hasn't checked, or claim to be a person.” The **Greeting**, **Anything it should know** with **Draft this from my company profile**, **What it asks callers for**, the **Voice** with **Hear …** previews, and **How it sounds**.",
            "**Answer my calls** — the one switch: **Start answering calls** / **It's answering — turn off**.",
            "**Call clients back automatically** — **Turn on quote callbacks** and **Which quotes get a call**. Covered in [[quote-callbacks|Quote callbacks]].",
            "**Let the crew text in photos and updates** — a **Set up crew texting** link. Crew texting uses its own number, separate from the one that answers your calls, and is set up on the crew inbox page: [[the-crew-inbox|The crew inbox: photos and updates by text]].",
            "**Check it end to end** — **Run the check** asks the phone service itself about every link between somebody dialling and a lead landing in FieldQuo. Shown once you have a number.",
          ] },
          { figure: "live:app-settings-voice", caption: "Settings → Phone receptionist — the status bar, the Credit card with its balance and top-ups, Your number, and the greeting, voice and tuning cards below." },
        ],
      },
      {
        id: "set-it-up",
        heading: "How to set it up",
        blocks: [
          { steps: [
            "Under **Credit**, press **Add credit** if the balance is empty — $10, $30, $50, $100, or any amount between $5 and $1,000. Your first number comes with 30 free minutes of credit, and the number's first month of rental is taken out of it.",
            "Under **Your number**, pick **Keep my number, forward missed calls** unless you have a reason not to. FieldQuo rents a line for the receptionist and shows the code to dial from your own phone; your clients keep dialling the number on the van, and only the calls you miss reach the receptionist.",
            "Under **What it says**, write the **Greeting** and press **Draft this from my company profile**. It lists the questions it cannot answer from your settings — what you turn down, what counts as urgent, what to say when you are shut — under **Answer these in your own words**. Type over each bracket; a line left in brackets is skipped.",
            "Pick a **Voice** and listen with **Hear …**. Leave **How it sounds** on its defaults unless callers keep getting cut off.",
            "Press **Start answering calls**, then **Run the check** under **Check it end to end** and ring your own number.",
          ] },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it changes"],
            rows: [
              ["**Keep my number, forward missed calls**", "Rents a $4-a-month local line the receptionist answers on. Your own number is untouched; you set conditional forwarding on your phone with the code shown, and undo it by dialling ##002#."],
              ["**Get a new number** / **Choose the number yourself**", "Buys a separate line — local at $4 a month, toll-free at $9 a month plus 5¢ a minute — in an area code you pick. Picking one buys it straight away and the first month comes out of your credit."],
              ["**Move my number over**", "Starts a port. Nothing is charged to start; your number keeps working with your old carrier for the two to four weeks the transfer takes, and the receptionist cannot answer on it until it lands."],
              ["**Greeting**, **Anything it should know**", "The first thing every caller hears, and the facts it may use beyond your settings. Opening hours, services and areas are read from your settings on every call and belong there, not in the note."],
              ["**Voice**, **How it sounds**", "Which voice speaks, and four tuning choices — what it does when a caller talks over it, where callers usually ring from, how quickly it answers, how it comes across. None of them changes what it is allowed to say."],
              ["**Answer my calls**", "Whether the number is answered at all. It refuses to turn on without a number and credit for at least one minute. Turning it off stops answering at once — “If this number is on your van, forward it somewhere before you switch it off.”"],
              ["**Top up automatically**", "Off unless you turn it on. Saves a card and, when the balance drops below $5, $10 or $20, charges the amount you chose — at most 3 times a day. It switches itself off and tells you if the card is declined."],
              ["**Release …**", "Gives a bought number back for good. It is deleted at the phone company, cannot be recovered, and the rest of the paid month is not refunded."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators, and anyone at the Dispatcher or Manager level see the row and can change everything on it — buying a number and topping up spend the company's money. Crew and Estimator logins do not see it. The call log in the main sidebar has its own rule." },
        ],
      },
    ],
    faq: [
      { q: "The switch will not turn on.", a: "It needs a live number and enough credit for one minute. The line under Answer my calls says which one is missing — “Set up a number above first” or “Add credit first”." },
      { q: "Can it quote a price on the phone?", a: "Never. It can read back a visit fee you published on your booking page, because that is your own figure, but it never prices the work." },
      { q: "I called and nothing appeared in FieldQuo.", a: "Press Run the check under Check it end to end. It asks the phone service about every link and names the one that is broken, and can push your settings to the provider again with one button." },
    ],
  },

  "settings-ai-employee": {
    title: "AI employee",
    summary:
      "The Settings row where you hire an assistant that answers a customer's message — its job, how it writes, what it reads, draft or send — and why, today, every reply is a draft waiting for you.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Client-facing → AI employee** — “An assistant that answers a customer's message for you — using your price book and the material you give it.” You pick the job it does, how it writes, what it may read, how far it may go, and whether it drafts or sends. The row carries a **Preview** badge.",
      "The screen opens with the one thing it cannot do yet: “Replies can't leave the building yet. The AI employee answers your Facebook and Instagram messages, and Meta hasn't approved messaging for FieldQuo. Everything here works — it drafts, and the drafts wait below for you to send.” Everything below is real and runs the real code; the sending waits on Meta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The job is a set of abilities, not a personality: “The job decides what it's allowed to do, not just how it sounds. A receptionist has no way to look up a price — that's the point of picking one.” Every job shares the same rule, printed on the screen: it can never invent a price, a date or a policy, and if the answer is not in your own data or your own material it hands the conversation to a person." },
          { p: "Every reply and every test spends AI credit, metered like the rest of FieldQuo AI. When the allowance is out the screen says so with a **Top up AI credit** link and the employee stops rather than guessing. See [[settings-ai-credit|AI credit]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**What job does it do?** — four cards: **Sales closer**, **Receptionist**, **Tech support**, **Something else**, each with **It can:** and **It cannot:** underneath.",
            "**How it writes** — **What you call it** (for you, never said to customers), **Tone**, **Opening line (optional)**, **Your instructions**, **When it should fetch a person**.",
            "**Draft, or send?** — **Write me a draft (recommended)** or **Send it automatically**.",
            "**Limits** — **Only answer during business hours**, **Most replies in one conversation**, **Switch the AI employee on**, then **Save**.",
            "**What it reads** — **Upload a file** or **Paste text instead**, and the list of what it has read, with a reason on anything it could not.",
            "**Try it** — a test box and **See the answer**; then **Waiting for you**, the drafts with **Send it** / **Not this one**, and **It stopped on these** with **Let it answer again**.",
          ] },
        ],
      },
      {
        id: "hire-it",
        heading: "How to hire it",
        blocks: [
          { steps: [
            "Open **Settings → AI employee** and pick a job. **Sales closer** is the only one allowed near a number: it reads your price book and can put an instant estimate together from your own rates. **Receptionist** takes the details and books a callback. **Tech support** answers from the material you upload and names the document it came from.",
            "Fill in **Your instructions** — areas you cover, what you do not do, how you like things worded — and **When it should fetch a person**.",
            "Leave **Write me a draft (recommended)** selected. Set **Most replies in one conversation**; zero pauses it without losing your setup.",
            "Under **What it reads**, upload your policy, your troubleshooting notes or a manual, or paste the text.",
            "Tick **Switch the AI employee on** and press **Save**. Then type a customer's message under **Try it** and press **See the answer** — it shows what it used and what the test cost.",
          ] },
          { figure: "live:app-settings-ai-employee", caption: "Settings → AI employee — the notice that replies cannot leave yet, the four job cards, and How it writes below." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "What each setting changes",
        blocks: [
          { table: {
            head: ["Setting", "What it does"],
            rows: [
              ["The job", "Fixes the tools it may call. Sales closer: look up service prices, build an instant estimate, book a callback, hand off to a person. The other three: book a callback and hand off only."],
              ["**Tone**", "Professional, warm or brief — how the same facts are worded."],
              ["**Write me a draft**", "The reply waits under **Waiting for you** with **Send it** and **Not this one**. “Sending one sends it in the conversation, exactly as if you'd typed it.”"],
              ["**Send it automatically**", "“The reply goes straight to the customer with nobody reading it first.” It still refuses to quote a price it did not get from your rates and still stops when unsure. Today the channel is blocked, so it drafts either way."],
              ["**Only answer during business hours**", "Uses the opening hours saved under Company Settings; outside them the message waits for you. With no hours saved it does nothing — “it won't guess a Monday-to-Friday for you.”"],
              ["**Most replies in one conversation**", "The cap per thread. When it is reached the thread appears under **It stopped on these** with **Let it answer again**."],
            ],
          } },
          { warning: "“We can read plain text: .txt, .md and .csv, or text you paste in. We cannot read a PDF or a Word file yet — if you upload one it'll show up below marked unread, and the fix is to paste the text or export it as .txt.” Uploaded material is treated as evidence, never as orders — an instruction hidden inside a manual is just text." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators, and anyone at the Dispatcher or Manager level — the same rung as the phone receptionist, because it decides what is said to customers in the company's name and spends the company's AI allowance. Crew and Estimator logins do not see the row. Sending or dismissing a draft needs the same access as the screen. The fuller story, including how the drafts show in Messages, is [[the-ai-employee|The AI employee: drafts you approve]]." },
        ],
      },
    ],
    faq: [
      { q: "Will customers know they are talking to software?", a: "It never claims to be a named person. Asked outright, it says the reply is automatic and a member of the team will follow up. The name you give it is for you." },
      { q: "Can it quote a price?", a: "Only the Sales closer, and only a figure a FieldQuo tool computed from your own rates, which it repeats and attributes. It cannot add, discount or round." },
      { q: "Why is there nothing under Waiting for you?", a: "No message has arrived that it could answer — usually because no Page is connected or Meta has not approved messaging yet — or it is switched off, outside business hours, or over its cap." },
    ],
  },

  "settings-reviews": {
    title: "Reviews",
    summary:
      "The Settings row that asks each client for a review after their job is marked complete — your review link, the Ask automatically switch, the delay, a live queue count — and the testimonials shown on your website.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Client-facing → Reviews** — “Ask customers for a review automatically once their job is finished.” Once a job is marked complete, the client gets one email with your review link, after a delay you choose. The screen does not just say On: it tells you how many customers are in the queue right now and how many were asked in the last 30 days.",
      "The lower half of the same screen, **Reviews on your website**, is where the reviews go once you have them: the testimonials your website shows, and a snippet to show them on a site you already run.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The ask is an email, from your company, with your logo and colour and your name in the From line — never a text. It goes once per job, ever: the job is stamped before the email leaves, so an overlapping run can never ask twice. The client needs an email address and must not have unsubscribed. FieldQuo checks every hour, so a 4-hour delay means about 4 hours, not the next morning." },
          { p: "The footnote on the screen says the rest: “Customers who have unsubscribed are skipped, and anyone who replies saying something went wrong reaches you directly rather than the review page.”" },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Your review link** with **Save** — “Usually your Google review link. On your Google Business Profile, choose “Ask for reviews” and copy the short link.” Once saved: **Open it and check it goes where you expect**.",
            "**Ask automatically** — the switch. Without a link it is disabled and reads “Add your review link above first.”; with one it reads “Every customer with an email address gets one message after their job is marked complete. Never more than one.”",
            "**When to ask** — **2 hours later**, **4 hours later**, **The next day**, **Two days later**, **Three days later**, **A week later**. Shown once the switch is on.",
            "The queue sentence — for example “3 customers are in the queue, and 12 have been asked in the last 30 days.”",
            "**Reviews on your website** — “The ones you switch on appear on your website — the first six, in the order below.” Each review with **Show on the website**, **Edit**, **Remove**, **Move up** / **Move down**; then **Add a review**, **Paste a list** with **Choose a CSV file** and **Import**, and **Your reviews on your own website** with the snippet.",
          ] },
        ],
      },
      {
        id: "switch-it-on",
        heading: "How to switch it on",
        blocks: [
          { steps: [
            "Paste your link under **Your review link** and press **Save**. Any http or https page works — Google, Facebook, HomeStars, your own form. Press **Open it and check it goes where you expect**.",
            "Turn on **Ask automatically**. The server refuses it without a link, the same as the screen.",
            "Pick a delay under **When to ask**. The queue sentence under it updates from the same columns the hourly job reads.",
          ] },
          { figure: "live:app-settings-reviews", caption: "Settings → Reviews — Your review link with Save, the Ask automatically switch, the When to ask chips, and Reviews on your website below." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**Your review link** — where the button in the email sends the client, and the **Leave a review** button on your bio link page. Save an empty field and the switch turns itself off, because there would be nowhere to send anyone.",
            "**Ask automatically** — whether completed jobs are asked at all. Off, nothing is sent and the queue is not shown.",
            "**When to ask** — the delay after the completion time. A job finished more than 30 days ago is never asked, and jobs imported from your old system are skipped, so switching this on today does not email every customer you ever had.",
            "**Show on the website** — puts that review on your FieldQuo website and in the embed; the first six switched-on reviews, in the order you set. Imported reviews start switched off.",
            "The embed snippet — “It shows the reviews you have approved, in your own colours, with no FieldQuo branding. Until you have one it shows nothing at all and shrinks to no height.”",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators, and anyone at the Dispatcher or Manager level can open and change this screen; Crew and Estimator logins do not see the row. The email itself and the rules behind it are in [[ask-for-reviews-automatically|Ask for reviews automatically]]; the testimonials half is in [[testimonials-on-your-website|Testimonials on your website]]." },
        ],
      },
    ],
    faq: [
      { q: "Does it text the client too?", a: "No. The review request is an email only." },
      { q: "Can I ask one client by hand?", a: "Not from this screen — it is automatic and once per job. Send them your review link yourself." },
      { q: "Do I need a FieldQuo website for the testimonials?", a: "No. Switch them on here and paste the snippet under Your reviews on your own website into any site you run; it carries no FieldQuo branding." },
    ],
  },

  "settings-data-migration": {
    title: "Data Migration",
    summary:
      "The Settings row for FieldQuo's paid migration service — request it, book a call, accept or decline the price, pay through FieldQuo billing, upload your exports, and watch the clients and quotes staff create appear.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Account → Data Migration** — “Bring your old clients and quotes into FieldQuo — from QuickBooks, Jobber, a spreadsheet, or a shoebox.” It is a service done by FieldQuo's own staff, not a self-serve importer, and it is the one case where FieldQuo writes inside your account.",
      "The rules are strict: staff may only create new records, never change or delete anything that already exists; only after you have accepted a price and paid it; and every record they create is logged where you can see it. For the whole story see [[the-data-migration-service|The data migration service]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "One request is active at a time. Until you have one, the screen is the **Request a migration** form; once you have one, it is that request's card with its status badge, and the actions the status allows. Payment goes through FieldQuo billing — the same card as your subscription — never through your own Stripe account, which is for your clients paying you." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Request a migration** — “Tell us what you're bringing over and we'll book a call to work out the scope and the price.” **Where's your data now?**, **Anything else worth knowing**, and the **Request a migration** button.",
            "The request card, with one of nine statuses: **Requested**, **Call booked**, **Quote ready**, **Accepted — payment due**, **Paid**, **In progress**, **Completed**, **Declined**, **Cancelled**.",
            "**Book a call with FieldQuo** — open times to pick from, or “No times are open right now — we'll be in touch to schedule one.”",
            "**Accept** / **Decline** on the price, then **Pay and start migration** — “You'll be sent to Stripe to complete payment securely.”",
            "**What's been brought in** — every record FieldQuo created, with its date.",
            "**Documents** — “Upload a QuickBooks or Jobber export, a spreadsheet, or a ZIP of your old records.” **Upload a file** takes CSV, XLS, XLSX, TXT, TSV, PDF, ZIP and the QuickBooks formats, up to 25 MB each.",
            "**Previous requests** — earlier migrations, with their status.",
          ] },
        ],
      },
      {
        id: "how-it-goes",
        heading: "How a migration goes",
        blocks: [
          { steps: [
            "Fill in **Request a migration**. The status reads **Requested**.",
            "Book a call from the open times, or wait for FieldQuo to schedule one. The card then reads **Call booked** with the time.",
            "FieldQuo prices the work. The status becomes **Quote ready** and the card shows the price with **Accept** and **Decline**.",
            "Press **Accept** — “Quote accepted — pay when you're ready to start.” — then **Pay and start migration**. After Stripe, the status is **Paid**.",
            "Staff create the records; the status is **In progress** and each one appears under **What's been brought in** as it is added. **Completed** ends it: “Migration complete.”",
          ] },
          { figure: "live:app-settings-migration", caption: "Settings → Data Migration — the request card with its status badge, the price with Accept and Decline, and Documents with Upload a file below." },
          { note: "**Cancel this request** is shown while the status is Requested, Call booked, Quote ready or Accepted. After payment, cancelling is a conversation with support rather than a button. Documents can be uploaded at every stage except Declined and Cancelled." },
        ],
      },
      {
        id: "what-fieldquo-writes",
        heading: "What FieldQuo writes, and what it never touches",
        blocks: [
          { bullets: [
            "It **creates** client records and quote records. Those are the two record types the service writes today; a migrated quote is a draft, marked as historical, and nothing is sent to anyone.",
            "It **never** updates or deletes a client, quote, invoice or job that existed before. The code has no path that can.",
            "It writes **only** while the request is Paid or In progress, checked fresh at every write. Cancel the migration and the writing stops that instant.",
            "Every write is logged with who, when and what was created, and that log is **What's been brought in**.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only — the same people who see the company's billing, because the price and the payment button are the owner's business. Everyone else is refused on the server whether or not the row was ever drawn. The price and the receipt are explained in [[paying-for-the-migration-service|Paying for the migration service]]." },
        ],
      },
    ],
    faq: [
      { q: "What does it cost?", a: "There is no list price. FieldQuo quotes each migration after the call, and you accept or decline the figure on this screen." },
      { q: "Can FieldQuo fix one of my existing quotes while they are in there?", a: "No. Staff can only create new records. Anything that existed before the migration is out of their reach by design." },
      { q: "Is this the same as a support session looking at my account?", a: "No. A support session is read-only with no exception. The migration is the only door for writes, and only you can open it by paying." },
    ],
  },

  "settings-product-updates": {
    title: "Product Updates",
    summary:
      "The Settings row that lists what changed in FieldQuo — a dated changelog with a summary per entry and, where one exists, a full write-up — with nothing to configure and visible to every member.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Account → Product Updates** — “What's new in FieldQuo.” It is a dated changelog, newest first, written by FieldQuo and identical for every company. Nothing on it is a setting; it is where you see what changed since you last looked.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Each entry is a card with the date, a title and a short summary that stands on its own. Where a longer write-up exists, the card carries **Read the full update**; the full page opens in place with **Back to Product Updates** at the top. An entry without a write-up shows no link rather than one that goes nowhere." },
          { p: "The entries are written in English whatever language you read the app in. The page's own words — the title, **Read the full update**, **Back to Product Updates** — follow your language; the changelog itself does not, because a half-translated changelog is worse than an honest English one." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The title **Product Updates** and the line “What's new in FieldQuo.”",
            "One card per update: the date, formatted for your language; the title; the summary; and **Read the full update** when a full post exists.",
            "The full post: the same date and title, the paragraphs, and **Back to Product Updates**.",
          ] },
          { figure: "live:app-settings-product-updates", caption: "Settings → Product Updates — the dated cards, each with its summary and Read the full update where a write-up exists." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone in the company, including Crew. It is one of the three Settings rows a Crew login keeps — with **Language** and **Your hours** — because nothing on it is company-specific and there is nothing to refuse. There is no API behind it and nothing to save." },
          { tip: "FieldQuo does not email or notify you when an entry is added. If you want to know what changed, this row is the place to look." },
        ],
      },
    ],
    faq: [
      { q: "Can I turn the updates off, or subscribe to them?", a: "Neither. There is no notification and no setting — the page simply lists what shipped." },
      { q: "Why is an entry not in my language?", a: "The changelog is English-only on purpose. The page chrome follows your language; the entries do not." },
    ],
  },

  "settings-account-and-billing": {
    title: "Account & Billing",
    summary:
      "The Settings row that is the same page as Plan in the main sidebar: your plan, its price and next billing date, the billing portal, a shortcut to your Stripe earnings, Cancel plan, and the four plans to choose from.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Account → Account & Billing** — “Your plan, seats, and payment details.” It is the same screen the **Plan** row of the main sidebar opens, reached from the Settings menu. This article is a short map of it; the full story of plans, seats, changes and cancellation is in [[your-plan-and-seats|Your plan and seats]].",
    ],
    sections: [
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The plan card: the plan's name and status, the price with **/month** or **/year** and **1 year commitment** where that applies, the seats line (for example “6 seats · 11 crew included free”), **Days left in trial** on a trial, and **Next billing date**.",
            "A scheduled change, if you booked one — “Switching to … on …” — with **Keep my current plan** to undo it before it happens.",
            "**Check with Stripe** — re-reads your subscription from Stripe when the page does not yet show a payment you made.",
            "**Manage billing & payment method** — opens Stripe's billing portal for your card, your invoices and receipts.",
            "**See what my clients paid me** — a shortcut to **Settings → Payments**, the connected account your clients pay into. A different Stripe account from the subscription above.",
            "**Cancel plan** — the cancel flow.",
            "**Plans** — a **Monthly** / **1 year commitment** switch and one card per plan with its seats and crew logins, **FieldQuo AI included**, and **Choose plan**, **Switch to yearly** or **Current plan**.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Settings → Account & Billing — the plan card with status, price, seats and next billing date, the billing buttons, and the plans below." },
        ],
      },
      {
        id: "what-each-button-does",
        heading: "What each button does",
        blocks: [
          { p: "**Choose plan** on a cheaper plan or a different cadence schedules the change for the end of your current billing period and charges nothing until then — “Done — your plan changes on {date}. Nothing is charged until then.” On a dearer plan it takes effect right away, and the difference for the rest of the period is charged. Either way a confirmation names the plan, the cadence and the date before anything happens. See [[change-your-plan|Change your plan]], [[update-your-payment-method|Update your payment method]] and [[cancel-your-subscription|Cancel your subscription]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. What the company pays FieldQuo is the owner's business, so the row is hidden — not shown read-only — from everyone else, and every control on it is refused on the server for anyone else regardless." },
        ],
      },
    ],
    faq: [
      { q: "I paid but the page still says trial.", a: "Press Check with Stripe. The page re-reads the subscription and says if Stripe has nothing new yet." },
      { q: "Where are my receipts?", a: "Manage billing & payment method opens Stripe's portal, which lists every invoice and receipt for your subscription. See [[invoices-and-receipts-from-fieldquo|Invoices and receipts from FieldQuo]]." },
    ],
  },

  "settings-refer-and-earn": {
    title: "Refer & Earn",
    summary:
      "The Settings row that is the same page as Refer & Earn in the main sidebar: your referral link, WhatsApp and text sharing, an invite by email or text, the months you earned and the businesses you referred.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Account → Refer & Earn** is the same page as the **Refer & Earn** row of the main sidebar — “Refer another business and get another month of FieldQuo free, once they're a paying customer.” One free month for the business you refer, at signup; one free month for you, when they make their first real payment. This is the short version; the full article is [[refer-another-business|Refer another business, earn a free month]].",
    ],
    sections: [
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Your link** with **Copy** — “Short enough to say out loud. Put it on a business card, an invoice footer, or a van.”",
            "**Share the invite** — a WhatsApp button, and **Text it** on a phone, each opening your own app with the message ready.",
            "**Send an invite** — **Email** or **Text**, then **Their email** or **Their mobile number**, **Their name**, and **Send invite**. “We send one message and don't follow up. Up to 20 invites a day.”",
            "The months earned — “1 free month earned” — and “Added to your account automatically when a business you referred makes their first payment.”",
            "**Businesses you've referred**, each marked **Credited** or **Signed up — not yet paying**, and **Invites sent** with **Signed up** or **Failed** on each.",
          ] },
          { figure: "live:app-settings-refer", caption: "Settings → Refer & Earn — Your link with Copy, the share buttons, Send an invite, and the businesses referred below." },
        ],
      },
      {
        id: "how-the-month-works",
        heading: "How the month works",
        blocks: [
          { table: {
            head: ["Who", "What they get", "When"],
            rows: [
              ["The business you referred", "One extra free month of trial", "At signup through your link or invite"],
              ["You", "One free month", "When that business makes its first real payment"],
            ],
          } },
          { p: "Your month is a month of the product: on a trial it pushes the trial end out; on a paid plan it moves the next charge a month later. A second referral adds a second month. How it lands on your subscription is in [[referral-months|Referral months]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners and administrators only. The page lists which companies were referred and what was earned, and sending an invite is owner-and-administrator on the server, so the row is hidden from everyone else rather than shown read-only." },
        ],
      },
    ],
    faq: [
      { q: "They signed up but I have no month yet.", a: "Their badge reads Signed up — not yet paying. Your month arrives on their first real payment; a $0 trial invoice earns nothing." },
      { q: "Is there a cap?", a: "20 invites a day from this screen." },
    ],
  },
};
