// content/help/en/settings-1.js
//
// Part 1 of the “settings” category in English (see the composer,
// settings.js): the Settings menu itself, then the Business and Team &
// scheduling groups — Company Settings and its three sub-articles (opening
// hours, tax, industry and quote types), Branding, Language, the Activity
// Log, Manage Team, Your hours, Time off policies and the Booking Page.
//
// Every control described here was read off its page module
// (app/app/settings/<row>/page.js), the API it calls and the lib/** rule
// that reads the field; who can open each row comes from
// SETTINGS_ROW_CAPABILITY in lib/permissions/settingsAccess.js. Screen words
// are the `en` strings of app/i18n/appMessages.js.
export const ARTICLES = {
  "the-settings-menu": {
    title: "The Settings menu",
    summary:
      "Where every company-level setting lives: the eight groups of the Settings menu, the Search box, and the reasons a row may be missing from yours.",
    updated: "2026-09-12",
    intro: [
      "**Settings** is the last row of the main sidebar. It opens a second, narrower menu on the left — eight groups, each folded closed so the list reads as an index — and lands on **Company Settings**. Everything that configures your company rather than one quote or one job lives here.",
      "This article is the map: what each group holds, how to find a row by typing, and the reasons a row you read about may not be in your own menu.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The groups are ordered by how often a company opens them: identity first (**Account**, **Business**), then the day-to-day (**Team & scheduling**, **Services & pricing**), then what goes out (**Documents & templates**, **Messaging & alerts**), then money (**Getting paid**), then the surfaces a client meets (**Client-facing**). Only the group you are in is open; press a group heading to open or close it, and FieldQuo remembers which you left open." },
          { p: "On a phone the menu becomes a bar across the top that names the screen you are on. Tap it and the full list slides up as a sheet; tap a row and the sheet closes on the page you asked for." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom: the **Settings** heading, the **Search settings** box, then the eight groups. Every row is its own article in this category." },
          { table: {
            head: ["Group", "Rows"],
            rows: [
              ["Account", "Account & Billing · Refer & Earn · Data Migration · Product Updates"],
              ["Business", "Company Settings · Branding · Language · Activity Log"],
              ["Team & scheduling", "Manage Team · Availability · Time Off Policies · Booking Page · Work Areas"],
              ["Services & pricing", "Products & Services · Services & Pricing · Material Costs · Cabinet Pricing · Overhead · Custom Fields"],
              ["Documents & templates", "Quote Email · Email Templates · PDF Templates · Translations · Checklists · Job photo tags"],
              ["Messaging & alerts", "Client messages · Follow-ups · Notifications · Email Domain"],
              ["Getting paid", "Payments · Meta Ads · Expense Tracking · AI credit · Payroll"],
              ["Client-facing", "Your website · Instant Quotes · Share your links · Bio link · Phone receptionist · AI employee · Reviews"],
            ],
          } },
          { figure: "live:app-settings", caption: "Settings — the eight groups on the left with Business open, landing on Company Settings." },
        ],
      },
      {
        id: "find-a-row",
        heading: "How to find a row",
        blocks: [
          { steps: [
            "Press **Settings** at the bottom of the main sidebar.",
            "Type part of a row's name in **Search settings** — “tax”, “logo”, “hours”. Every group opens while you type, so a row is one search away whatever was folded.",
            "Press the row. If nothing matches, the menu says **Nothing matches “…”** with a **Clear** link that empties the box.",
          ] },
          { tip: "Four rows are the same page as a row in the main sidebar, under another name: **Manage Team** is **Your team**, **Account & Billing** is **Plan**, **Expense Tracking** is **Expenses**, and **Refer & Earn** is there under its own name. Both doors open the same screen." },
        ],
      },
      {
        id: "rows-that-may-be-missing",
        heading: "Rows that may be missing from your menu",
        blocks: [
          { p: "Your menu may be shorter than the table above. That is not a fault: a row is removed for one of the reasons below, and the page behind it would refuse you anyway. Hiding the row is tidiness; the refusal on the server is the rule." },
          { bullets: [
            "**Your access level.** Rows only an owner or administrator may open — Account & Billing, Refer & Earn, Data Migration, Payments, Meta Ads, Payroll, Activity Log, Time Off Policies, Notifications, Your website — are not drawn for a Manager, a Dispatcher, an Estimator or Crew.",
            "**A permission toggle.** **Material Costs** and **Overhead** need the **Job costing** switch; **Products & Services**, **Services & Pricing** and **Instant Quotes** need **See prices**; **Expense Tracking** needs the highest expenses level in the access grid.",
            "**Your trade.** **Material Costs** and **Cabinet Pricing** appear only for companies whose enabled quote types price that way — a painter never sees a cabinet rate card.",
            "**A feature in preview or not on your plan.** The row stays and carries a **Preview** or **Locked** badge instead of vanishing, so you know it exists.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone with a login sees the Settings row and the menu. Three rows are drawn for every member, Crew included, because they are the person's own: **Product Updates**, **Language** and **Availability**. Most of the rest need the user-management capability — the owner, administrators, and the Manager and Dispatcher levels. Each article in this category states its own rule." },
          { note: "A read-only support session from FieldQuo sees every row and can change nothing on any of them." },
        ],
      },
    ],
    faq: [
      { q: "Why does Settings open on Company Settings?", a: "The index has no page of its own; landing on the first row of the Business group is the same as pressing it. Company Settings is also the screen a new company should finish first." },
      { q: "Can I reorder or hide rows myself?", a: "No. The groups and their order are fixed. What differs from person to person is decided by access level, permission toggles and trade, never by a preference." },
      { q: "Where is Material Costs? I cannot find it.", a: "It is drawn only when your enabled quote types include a trade that prices by material, and only for people whose Job costing switch is on. Check Services & Pricing first, then the person's access." },
    ],
  },

  "settings-company": {
    title: "Company Settings",
    summary:
      "The first screen after signup: your scope of work and payment terms, payment schedule, industry and quote types, company details, opening hours, booking availability, tax settings, the industry benchmark and your regional preferences.",
    updated: "2026-09-12",
    intro: [
      "**Company Settings** is the row the **Settings** menu lands on and the screen every new company should finish first. It holds the facts that print on every document — your name, address, phone, tax number — and the preferences that shape every screen your team uses: time zone, date format, first day of the week, currency.",
      "This article walks the page card by card. Three of the cards are large enough to have their own articles: [[opening-hours|Opening hours]], [[tax-settings|Tax settings]] and [[industry-and-quote-types|Industry and quote types]]. The scope-of-work and payment-schedule cards are covered under quotes and invoices.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is one long form with one **Update Settings** button at the bottom, plus three cards that save on their own: **Payment schedule** (**Save schedule**), **Opening hours** (**Save opening hours**) and the tax-rate list (**Add**). A change in any other card waits for **Update Settings**; a failed save says so in red rather than pretending." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Under the heading **Company Settings — Your business details, hours, taxes, and regional preferences.**, the cards run top to bottom:" },
          { table: {
            head: ["Card", "What it holds"],
            rows: [
              ["Scope of work and terms", "The process text copied onto every new quote, three trade templates to start from, and the free-text Payment terms line — see [[scope-of-work-and-terms|Scope of work and payment terms]]."],
              ["Payment schedule", "Deposit and balance stages tied to the job's own dates. Off until you add a stage; once on, it writes the Payment terms line for you — see [[deposits-and-payment-schedules|Deposits and payment schedules]]."],
              ["Industry & Quote Types", "The industries you named at signup and the quote types currently enabled, with a Manage link to Services & Pricing."],
              ["Company Details", "Company name, Phone number, Email address, Website URL, your fieldquo.com subdomain, Street address with a map preview, City, Province, Postal code, Country."],
              ["Opening hours", "When the business is open — the public hours, one row per day."],
              ["Booking availability", "A read-only table of your own bookable hours with an Edit button; the fuller editor is Availability."],
              ["Tax Settings", "Tax ID name and number, the I don't have one box, your tax rates, the VAT question for VAT countries, and the automatic local-tax switch."],
              ["Industry benchmark", "One checkbox: share your anonymized figures to unlock the benchmark page."],
              ["Regional Settings", "Country, Billing currency, the serve-clients-abroad box, Time zone, Date format, First day of the week."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Company Settings — Scope of work and terms, Payment schedule, Industry & Quote Types and Company Details, with Opening hours below." },
        ],
      },
      {
        id: "how-to-update",
        heading: "How to update your company details",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings**.",
            "In **Company Details**, start typing in **Street address** and pick the suggestion — City, Province, Postal code, Country and the map fill themselves in. You can still edit each box by hand.",
            "Check **Regional Settings**. Country is filled from the address; Billing currency follows the country unless you tick **I serve clients outside my country (bill in other currencies)**, which turns it into a list you choose from.",
            "Press **Update Settings** at the bottom. The button reads **Saving…**, then a green **Saved** appears beside it.",
          ] },
          { note: "The name, phone, email and address print on every quote, invoice and email your clients receive, and the address is the start point for the booking page's drive-time check. The subdomain shown under the website box is read-only here; the one-page site that lives at it is built under **Settings → Your website**." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "What each regional setting changes",
        blocks: [
          { bullets: [
            "**Country** — decides the currency, which tax-number label you see (**GST/HST number** in Canada, **VAT number** in the UK and the EU, **EIN** in the US) and which time-off starter set is offered first.",
            "**Billing currency** — the currency your quotes, invoices and client payments are shown and charged in. Derived from the country unless you bill abroad; the server enforces the same rule on save, so a Canadian shop is never asked to pick between CAD, USD and EUR.",
            "**Time zone** — the clock every appointment, reminder and receptionist call is read against. Wrong here means a reminder text at the wrong hour.",
            "**Date format** — MM/DD/YYYY, DD/MM/YYYY or YYYY-MM-DD, applied to your own screens: the schedule, the team roster, quote pages, expense imports. Client documents ignore it and follow the client's language.",
            "**First day of the week** — Sunday or Monday. Rotates the calendar, the schedule grid and every weekly editor on this page and on Availability.",
            "**Share my anonymized figures to unlock benchmarks** — turns the **Industry benchmark** page on. Your numbers are pooled with other companies and never shown individually; untick it any time and the page locks again.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row needs the user-management capability: the owner, administrators, and the Manager and Dispatcher levels open the full form. An Estimator or Crew member who reaches the page by its address gets a read-only version — name, phone, email, address, opening hours, booking hours, tax rates, regional settings, industries, quote types and the scope text — with a notice naming who can change it. The tax number, the automatic-tax switch and the benchmark box are not shown to them at all." },
          { note: "Every write goes to one route that checks the same capability again, so hiding the form is a courtesy and the refusal is the rule." },
        ],
      },
    ],
    faq: [
      { q: "I typed my country as USA and the currency stayed CAD. Why?", a: "Country is a list of codes now, not a text box, precisely because a typed value that the list did not recognise fell through to Canada. Pick the country from the list and the currency follows." },
      { q: "Does changing the date format change my quotes?", a: "No. The format applies to the screens your team reads. A quote, invoice or email to a client formats its dates in the client's own language." },
      { q: "Can I hide my subdomain?", a: "Not from this screen — it is shown so you know the address. Nothing is served there until you build and publish a site under Your website." },
    ],
  },

  "opening-hours": {
    title: "Opening hours",
    summary:
      "The hours your business is open — shown on your website, sent to Google as structured data, and respected by the phone receptionist and the AI employee. Not the same thing as anyone's bookable hours.",
    updated: "2026-09-12",
    intro: [
      "**Opening hours** is a card on **Company Settings**: seven rows, one per day, each either **Closed** or a time range. They answer one question — when is the company open — and they are the company's, not any one person's.",
      "They matter more than they look. The same seven rows become the opening-hours block on your website and the structured data that puts “Open · Closes 5 PM” in a Google result, a box read by people who never load the site.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "FieldQuo stores two different weeks and keeps them apart on purpose. Opening hours say when the *company* is open. **Bookable hours** — the card directly below, and the fuller **Availability** screen — say when a *person* can be booked. An estimator taking Friday off must not publish the shop as closed on Fridays, so the two are allowed to disagree." },
          { warning: "A company that has never set opening hours has none — the read-only view says **No opening hours have been set.** and nothing goes to the website or to Google. FieldQuo never invents a Monday-to-Friday week on your behalf; absence of a statement is not a statement." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Under **Opening hours — When your business is open. Shown on your website and used for the opening hours that appear in Google search results.** the editor shows the week starting on your **First day of the week**." },
          { bullets: [
            "**A checkbox per day** — ticked means open; unticked shows **Closed** and hides the times.",
            "**Two time boxes**, open **to** close. A close earlier than its open shows **Closing time must be after opening.** and, if saved anyway, the server stores that day as closed.",
            "**Apply Monday's times to every open day** (the day named is the first day shown) — copies one day's times onto every other *open* day. It never reopens a closed day.",
            "**Reset to typical trade hours** — Monday to Thursday 8:00 to 17:00, Friday 8:00 to 16:00, weekend closed. A starting point, saved only when you press save.",
          ] },
          { figure: "live:app-settings-company", caption: "Company Settings — the Opening hours card at the bottom, one row per day with a checkbox and two times." },
        ],
      },
      {
        id: "how-to-set",
        heading: "How to set your opening hours",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings** and scroll to **Opening hours**.",
            "Tick the days you are open and untick the days you are not.",
            "Set the first open day's times, then press **Apply … times to every open day** to copy them.",
            "Adjust any day that differs — a shorter Friday, a Saturday morning.",
            "Press **Save opening hours**. This card saves on its own; a green **Saved** confirms it, and you do not need **Update Settings** for it.",
          ] },
          { tip: "If every day is ticked closed, a line under the card says so: no hours will appear on your website or in search results. Untick nothing by accident." },
        ],
      },
      {
        id: "where-they-are-used",
        heading: "Where the hours are used",
        blocks: [
          { table: {
            head: ["Where", "What the hours do"],
            rows: [
              ["Your website", "Printed as the opening-hours block, and emitted as structured data so search engines can show them beside your name — see [[the-website-builder|The website builder]]."],
              ["Phone receptionist", "Callbacks and booked slots are offered inside opening hours only; a caller is never promised a call at seven in the morning — see [[the-phone-receptionist|The phone receptionist]]."],
              ["AI employee", "Its **only reply during business hours** option reads these hours; with none set, the option cannot stop anything — see [[the-ai-employee|The AI employee]]."],
              ["Company Settings, read-only view", "A team member without settings access reads the hours as text, so a painter need not phone the office to learn when it shuts."],
            ],
          } },
          { p: "The hours are *not* used to build anyone's schedule, to decide which slots a client can book, or to count time-off days. Those come from each person's working and bookable hours." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Editing needs the user-management capability — the owner, administrators, Managers and Dispatchers. Everyone else who opens Company Settings sees the hours as a read-only list." },
        ],
      },
    ],
    faq: [
      { q: "I set my hours but the booking page still offers Saturday. Why?", a: "The booking page reads bookable hours, per person, not the company's opening hours. Open Availability and untick Saturday under Bookable hours for the people concerned." },
      { q: "Why does the form show Monday to Friday when I never set anything?", a: "The editor offers typical trade hours as a starting point so the form is quick to finish. Nothing is stored until you press Save opening hours; until then the company has no hours." },
      { q: "Do the hours change with daylight saving?", a: "No. They are wall-clock times in your company's time zone — 08:00 stays 08:00 all year." },
    ],
  },

  "tax-settings": {
    title: "Tax settings",
    summary:
      "Your tax registration number as it prints on documents, the tax rates you create, the VAT question for European companies, and the switch that picks the client's local rate for you.",
    updated: "2026-09-12",
    intro: [
      "**Tax Settings** is a card on **Company Settings** with two halves. The top half is about *you*: the registration number that prints at the foot of every quote and invoice. The bottom half is about the *client*: the rates you create, which one is the default, and whether FieldQuo should pick the rate that matches the client's province instead of always using the default.",
      "The rule behind the whole card is conservative on purpose: every rate a document can carry is one you typed and named. FieldQuo does not work out what you owe, does not register you anywhere and files nothing for you — it prints what you enter.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A quote or invoice stores its tax as a money amount at the moment it is created. Nothing on this card reaches a document that already exists — deleting a rate or changing the automatic switch changes the next document, never a sent one. That is what makes the card safe to edit mid-month." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "The controls, top to bottom:" },
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["Tax ID name and the number box", "The label the number carries on documents (**e.g. GST**) and the number itself. The number box is named the way your country names it — **GST/HST number**, **VAT number**, **EIN** — from the country in Regional Settings. No format check, deliberately: a valid number is never refused."],
              ["I don't have one — my business isn't registered for this.", "Shown only while the number box is empty. Ticking it records the fact and clears the tax-registration step on your dashboard; untick it the day you register and the step returns."],
              ["Tax Rates", "The list of rates you created, each as name and percentage, one carrying the **Default** badge, each with a delete icon."],
              ["Create tax rate", "Opens a one-line form: **Name (e.g. GST)**, **Rate %**, a **Default** box, and **Add**. Saves immediately."],
              ["Are you registered for VAT?", "Three choices, shown only when the country is a VAT jurisdiction: **Yes**, **No — I'm below the registration threshold**, **I'd rather not say yet — use my default rate**."],
              ["Automatically apply the local tax rate of the client…", "The switch that lets FieldQuo choose between your rates by the client's province instead of you picking on every document."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Company Settings — the Tax Settings card sits below Booking availability, with the rate list and Create tax rate." },
        ],
      },
      {
        id: "create-a-tax-rate",
        heading: "How to create a tax rate",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings** and scroll to **Tax Settings**.",
            "Press **Create tax rate**.",
            "Type a **Name** that says where it applies — “GST + QST (QC)”, “HST Ontario” — and the **Rate %**. Name it after the province if you want the automatic switch to find it: matching is by the words in the name.",
            "Tick **Default** if this is the rate a document should carry when nothing better applies. Only one rate is default at a time; ticking it here unticks the previous one.",
            "Press **Add**. The rate appears in the list at once; there is nothing else to save.",
          ] },
          { note: "There is no edit-in-place. To change a rate's percentage, delete it with the trash icon and create it again. Documents already sent keep their amounts." },
        ],
      },
      {
        id: "how-a-rate-is-chosen",
        heading: "How the rate on a new quote is chosen",
        blocks: [
          { p: "When a quote is created, FieldQuo picks its rate in this order and stops at the first answer. The quote says which step chose it, so a tax figure never changes without an explanation." },
          { bullets: [
            "**The automatic switch is off** — your **Default** rate, untouched. The feature is opt-in and this is the door.",
            "**One of your rates names the client's province** — that rate wins. A contractor who typed “HST Ontario 13” is never overruled by a table.",
            "**No rate matches and the jurisdiction is knowable** — the published rate for a Canadian province is applied. Never for a US state, where a state figure is a floor, not a rate; for an EU country only if you answered **Yes** to the VAT question.",
            "**Everything else** — your default rate, and the quote says so.",
          ] },
          { tip: "Name your rates after provinces before turning the switch on. A rate called “Tax” can never match anything and the switch will fall through to the default every time." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Creating, deleting and defaulting rates, and changing the number and the switches, need the user-management capability — the owner, administrators, Managers and Dispatchers. A team member without it sees only the rate list, read-only, because those percentages land on the quotes they build; the registration number and the switches are not shown to them." },
        ],
      },
    ],
    faq: [
      { q: "Do I have to enter a tax number?", a: "Only if you are registered. A Canadian sole trader under the registration threshold has no GST number to give — tick I don't have one and the dashboard stops asking." },
      { q: "Where does the number appear?", a: "At the foot of every quote and invoice, next to your contact details, as name and number together. If either half is blank, no line prints at all — never an empty label." },
      { q: "Will turning on the automatic switch change my sent quotes?", a: "No. A quote stores its tax as an amount when it is created. The switch affects the next quote you create." },
      { q: "Why does my quote say the default rate was used?", a: "Because no rate of yours named the client's province and the jurisdiction was not one FieldQuo will fill in — a US address, or an EU one without a VAT answer. Add a rate named for that province, or set the client's province on their record." },
    ],
  },

  "industry-and-quote-types": {
    title: "Industry and quote types",
    summary:
      "The trades you named at signup and the quote types they unlocked — what the card shows, where the quote types are actually changed, and what they decide elsewhere in FieldQuo.",
    updated: "2026-09-12",
    intro: [
      "**Industry & Quote Types** is a small card on **Company Settings** that reflects two lists: the **Industries** you picked when the company signed up, and the **Enabled quote types** currently switched on under **Services & Pricing**. Nothing on the card is edited in place — it is a mirror, with a **Manage** link to the screen that does the editing.",
      "It earns its place because those two lists decide what a new quote can be, which price-book items can be attached to it, and which settings rows your company even sees.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The card reads **What you told us your business does, and which quote types that unlocked.** Industries are one of twelve trades — Cleaning, Construction & Contracting, Electrical, HVAC, Handyman, Landscaping, Lawn Care, Painting, Plumbing, Pressure Washing, Roofing, Tree Care. Quote types are the categories from the trade catalogue you have enabled, plus any custom ones you created." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Two rows of chips:" },
          { bullets: [
            "**Industries** — one chip per trade named at signup, or **None selected.** There is no control here or anywhere else in the app to change them after signup.",
            "**Enabled quote types** — one chip per enabled category, with a **· custom** suffix on the ones you created yourself, and a **Manage** link on the right. With none enabled the card says **None turned on yet — go to Settings → Services.**",
          ] },
          { figure: "live:app-settings-company", caption: "Company Settings — the Industry & Quote Types card: the Roofing industry and three enabled quote types." },
        ],
      },
      {
        id: "change-quote-types",
        heading: "How to change your quote types",
        blocks: [
          { steps: [
            "Open **Settings → Company Settings** and find **Industry & Quote Types**.",
            "Press **Manage** beside **Enabled quote types**. You land on **Services & Pricing** with a bar at the top that takes you back to Company Settings.",
            "Enable or disable categories there, or add a custom one — see [[quote-types-and-takeoffs|Quote types and takeoffs]] and [[settings-services|Services & Pricing]].",
            "Return to Company Settings; the chips reflect the change at once.",
          ] },
          { note: "Services & Pricing shows the catalogue categories that fit your industries by default, with a way to show every trade. A plumber lands on plumbing quote types rather than the whole catalogue, but nothing is out of reach." },
        ],
      },
      {
        id: "what-they-change",
        heading: "What the two lists change",
        blocks: [
          { bullets: [
            "**The quote builder** offers exactly the enabled quote types when someone starts a new quote, and each type carries its own takeoff fields and wording.",
            "**The price book** — an item under **Products & Services** can be linked to a quote type, so a painting line never appears on a roofing quote.",
            "**The Settings menu itself** — **Material Costs** and **Cabinet Pricing** are drawn only when an enabled quote type prices that way. Enable cabinetry and the rate card appears; disable it and the row goes.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The card is on Company Settings, so the owner, administrators, Managers and Dispatchers see it with the **Manage** link; a team member with read-only access sees the same chips without it. Services & Pricing itself is drawn for anyone whose **See prices** switch is on." },
        ],
      },
    ],
    faq: [
      { q: "Can I change my industries?", a: "Not in the app today. They were recorded at signup and no screen edits them. The list that matters day to day — the enabled quote types — is fully yours to change under Services & Pricing." },
      { q: "What does the · custom suffix mean?", a: "That quote type is one your company created rather than one from FieldQuo's trade catalogue." },
      { q: "I disabled a quote type. What happens to quotes that used it?", a: "Nothing — a quote keeps its type. It just stops being offered for new quotes." },
    ],
  },

  "settings-branding": {
    title: "Branding",
    summary:
      "Your logo and the three brand colours — primary, secondary and neutral — that appear on every quote, invoice, PDF, email, booking page and website a client sees, with the contrast worked out for you.",
    updated: "2026-09-12",
    intro: [
      "**Branding** is where the white-label promise is kept. Upload a logo, pick a primary colour, and every document and page a homeowner meets carries your name and your colour — never FieldQuo's. A client comparing three contractors should not be able to tell that two use the same software.",
      "The page is three cards and one button. It is deliberately not a design tool: one colour drives everything, the contrast is measured rather than assumed, and the back office your team works in stays neutral whatever you pick.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The heading reads **Branding — Your logo and brand color appear on every quote, invoice, and email your clients see.** Only the primary colour is required; the secondary and the neutral follow sensible defaults until you set them, and each has a **Reset** link to go back to following the primary." },
          { note: "The brand colour is for what the *client* sees. Your team's screens stay neutral on purpose — a contractor who picks lime green should not get a lime-green back office. The colour is applied per surface: quote, invoice, email, PDF, booking page, portal, website." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom:" },
          { table: {
            head: ["Card", "What it holds"],
            rows: [
              ["Logo", "A preview square and **Upload logo** (or **Replace logo** once one exists). **PNG, JPG, WebP or SVG, up to 8 MB.**"],
              ["Brand Colors", "**Primary** — six preset swatches plus a custom picker. **Secondary** — same controls, **Reset** to follow the primary. **How your documents will look** — a **Light** and a **Dark** preview that update as you pick. **Neutral** — the email header bar, default a near-black."],
              ["Preview", "**Roughly how the top of your emails will look**: the neutral header with your logo, a section title in the secondary, and a **View & approve** button in the primary."],
              ["Save Branding", "One button for the whole page; it reads **Saving…** then **Saved ✓**."],
            ],
          } },
          { figure: "live:app-settings-branding", caption: "Settings → Branding — the Logo card, the Brand Colors card with its swatches and previews." },
        ],
      },
      {
        id: "how-to",
        heading: "How to set your branding",
        blocks: [
          { steps: [
            "Open **Settings → Branding**.",
            "Press **Upload logo** and choose the file. A transparent PNG or an SVG looks best on both the light and the dark header. The old logo is removed when you replace it.",
            "Pick a **Primary** colour — a preset, or the picker for your exact hex.",
            "Leave **Secondary** and **Neutral** on their defaults unless your brand has them; check the **Light** and **Dark** previews.",
            "Press **Save Branding**.",
          ] },
          { tip: "Pick the colour from your van, your business card or your existing website so every surface matches. A colour that changes from one document to the next reads as two companies." },
        ],
      },
      {
        id: "what-each-colour-changes",
        heading: "What each colour changes",
        blocks: [
          { bullets: [
            "**Primary** — buttons, progress bars, links and your name in the email header; the accent on the quote approval page, the invoice pay page, the booking page and the client portal.",
            "**Secondary** — supporting accents such as section titles on itemized lists. Defaults to the primary, so a company that never sets it still looks consistent.",
            "**Neutral** — the header bar of every email and the dark band at the top of documents. Dark tones read as more premium than a saturated brand colour, which is why the default is near-black.",
          ] },
          { warning: "Contractors pick yellow, white and mid-grey, and a naive “dark colour gets white text” rule fails on all three. FieldQuo measures the contrast of every text-and-background pair it draws from your colour and substitutes a legible pair when yours is not — so a yellow brand still prints readable buttons. It cannot make a white logo visible on a white page; check the previews." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row needs the user-management capability: the owner, administrators, Managers and Dispatchers. The save goes to the same route as Company Settings and is refused for anyone else, so a crew member who reaches the address cannot change your brand." },
        ],
      },
    ],
    faq: [
      { q: "Does the logo appear on the PDF?", a: "Yes — on the quote PDF, the invoice PDF and the email carrying them, in the header where your company name is." },
      { q: "Why does my back office not use my colour?", a: "By design. The white-label promise is about the homeowner's view. The screens your staff use all day stay neutral so a bright brand colour never makes them hard to work in." },
      { q: "What happens if I never set a secondary or a neutral?", a: "The secondary follows your primary and the neutral stays near-black. Both are derived at render time, so changing the primary later moves the secondary with it." },
    ],
  },

  "settings-language": {
    title: "Language",
    summary:
      "Two settings that look alike and mean different things: the language you read FieldQuo in, and the company default that teammates and clients inherit when they have chosen none.",
    updated: "2026-09-12",
    intro: [
      "**Language** is one of the three Settings rows every member sees, Crew included, because half of it is personal: **Your language** is what *you* read the app in, and changing it touches nobody else. The other half, **Company default**, is what everyone who has not chosen inherits — and what a client's documents use when the client has no language of their own.",
      "FieldQuo ships eight languages: English, Français, Español, Українська, ਪੰਜਾਬੀ, Tagalog, Deutsch and Italiano. Client documents and emails exist in all eight; the back-office interface is complete in some and partly English in others, and the page says which is which.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The subtitle reads **What language your clients' quotes, invoices and emails go out in.** — a reminder that the company default is the one that reaches clients. A document keeps the language it was created in: changing either setting never rewrites a quote that has already gone out." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Two cards and a status line:" },
          { bullets: [
            "**Your language** — a **Match company default — …** row naming the current default, then one row per language showing its native name and a coverage badge: **Interface 100%**, **Interface 100% · needs review** (complete but not yet checked by a fluent reviewer), **Interface 84%** (the rest falls back to English) or **Interface in English**. A tick marks your choice.",
            "**Company default** — a pill per language for people who may change it; for everyone else, the current default as text with a notice naming who can change it.",
            "**Currently showing:** — the language the app is using right now: your choice, or the company default when you match it.",
          ] },
          { figure: "live:app-settings-language", caption: "Settings → Language — Your language with the coverage badge on each row, and the Company default pills below." },
        ],
      },
      {
        id: "change-your-language",
        heading: "How to change your language",
        blocks: [
          { steps: [
            "Open **Settings → Language**.",
            "Press the language you want under **Your language**, or **Match company default** to inherit.",
            "The app switches immediately — no reload, no separate save. A green **Saved** confirms it.",
          ] },
          { note: "Every button on this card writes only your own preference. Nobody else's screen changes." },
        ],
      },
      {
        id: "what-the-company-default-changes",
        heading: "What the company default changes",
        blocks: [
          { p: "Pressing a pill under **Company default** moves every teammate who has not set their own language, and becomes the fallback for clients. For anything FieldQuo sends a client, the language is chosen in this order, stopping at the first answer:" },
          { bullets: [
            "**The document's own language** — a quote or invoice is fixed at creation and its covering email matches it.",
            "**The client's saved language** — for anything not tied to a document: a booking confirmation, a payment reminder.",
            "**The company default** — this setting.",
            "**English** — when nothing above is set.",
          ] },
          { warning: "**Changing this moves everyone who hasn't set their own language. It does not change quotes already sent — those keep the language they were sent in.** A signed PDF must keep saying what it said." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone sees the row and can change **Your language**. **Company default** needs the user-management capability — the owner, administrators, Managers and Dispatchers; anyone else sees the value as text. The same rule is checked on the server, so a pill that is not drawn cannot be pressed by other means." },
        ],
      },
    ],
    faq: [
      { q: "My language shows Interface 84%. What does the other 16% look like?", a: "Those labels appear in English. Everything a client receives is still fully in that language — the percentage is about your own screens only." },
      { q: "Can a client choose their language?", a: "You set it on the client's record. FieldQuo does not ask the client; it uses the client's saved language, then the company default, then English." },
      { q: "Will changing the company default translate an old quote?", a: "No. A document keeps the language it was created in, and nothing is machine-translated at send time." },
    ],
  },

  "settings-activity-log": {
    title: "Activity Log",
    summary:
      "The company's audit trail: who did what and when — quotes sent, payments recorded, hours approved, access changed — read-only, newest first, for the owner and administrators.",
    updated: "2026-09-12",
    intro: [
      "The **Activity Log** sits in the **Business** group and answers the question “who changed this?”. Every entry is a sentence written at the moment the action happened, with the person's name, their role and how long ago. It is a record to consult when something looks wrong, not a dashboard.",
      "It is read-only by design and owner-and-administrator only, because it shows actions across every user — payments, pay-rate changes, who deactivated whom.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The heading reads **Activity Log — A record of important actions in your account — quotes sent, payments recorded, hours added and approved, expenses, client and team changes, pricing and settings.** That list is a promise the page can keep: each of those families writes an entry. What is *not* on the page is as important — no filter, no search, no export, and no way to edit or delete an entry, because a log that can be retouched is not a log." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "A single list, newest first, of the most recent 100 entries. Each row shows:" },
          { bullets: [
            "**A coloured dot** — red for a deletion or a deactivated member, green for a payment, blue for something sent, amber for a settings change or a self-approved time entry, grey for everything else.",
            "**The sentence** — “Added client Jane Smith”, “Duplicated quote Q-1041 as Q-1058”.",
            "**Who, role and when** — the actor's name (or **Someone** for a system action), their role, and a relative time such as “4 min. ago”, switching to a date after 30 days.",
            "**support session** — an amber marker on any action taken during a FieldQuo support session, so nothing done on your behalf is mistaken for one of your own.",
          ] },
          { figure: "harness:settings-activity", caption: "Settings → Activity Log — the list of entries with a dot, the sentence, and who did it, their role and when." },
        ],
      },
      {
        id: "what-is-recorded",
        heading: "What is recorded",
        blocks: [
          { table: {
            head: ["Family", "Examples"],
            rows: [
              ["Quotes and leads", "Quote created, sent, duplicated, approved by a reviewer; lead converted"],
              ["Invoices and money", "Invoice sent, chased, paid; visit fee credited; accounting export run"],
              ["Jobs and time", "Job completed or deleted; a time entry approved — flagged when someone approved their own"],
              ["People", "Member invited, access changed, deactivated; a leave policy retired"],
              ["Clients", "Client added, updated, deleted"],
              ["Settings and connections", "Pricing updated; WhatsApp or a crew texting line connected; billing cancelled"],
            ],
          } },
        ],
      },
      {
        id: "reading-it",
        heading: "Reading it in your language",
        blocks: [
          { p: "The sentence is stored in English at the moment of the action. Newer entries also carry a catalogue key, and those are shown in your interface language; older ones show exactly what was written at the time. A mixed list is the honest picture of the company's history rather than a retouched one." },
          { note: "The log translates forward, never backward. An entry from March says what it said in March." },
          { tip: "Looking for a specific change? The list is the last 100 entries with no search box, so use your browser's find (Ctrl+F or ⌘F) on the page." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner and administrators only. The row is not drawn for a Manager, Dispatcher, Estimator or Crew member, and the page answers **Only an owner or admin can view the activity log.** to anyone else who reaches its address. A FieldQuo support session can read it, and its own actions are stamped as such." },
        ],
      },
    ],
    faq: [
      { q: "Can I delete an entry?", a: "No. Nothing on the page edits or removes an entry, and there is no route that would. That is what makes it an audit trail." },
      { q: "Why is an old entry in English while the new ones are in French?", a: "Older entries were stored as a plain sentence and are shown verbatim. Entries written since the log learned to carry a translation key render in your language." },
      { q: "How far back does it go?", a: "The page shows the most recent 100 entries. Nothing is pruned behind it, but older entries are not paged on screen today." },
    ],
  },

  "settings-team": {
    title: "Team",
    summary:
      "The Manage Team row in Settings is the same screen as Your team in the main sidebar — the seat panel, the roster with each person's access level, Add User and the pending invitations.",
    updated: "2026-09-12",
    intro: [
      "**Manage Team** under **Team & scheduling** opens the same page as **Your team** in the main sidebar. This short entry says what is on it and where the full guide lives: [[manage-team|Manage Team]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The heading reads **Manage Team — Add or manage team members that need to log into FieldQuo in the office or in the field.** Everything about people and access starts here: inviting, choosing an access level, resending or cancelling an invitation, and deactivating someone. Access levels themselves are explained in [[access-levels-overview|Access levels: who sees what]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Add User** at the top right, and under the seat panel **Add crew — free** and **Add a seat** — the free crew login and the paid seat, each greyed with a reason when the plan's cap is reached.",
            "**The seat panel** — how many **seats used** against the plan, and a count per level: Administrators, Managers, Dispatchers, Workers, Crew, Custom.",
            "**Tabs** — **Workers** and **Payroll** for the owner and administrators, **Timesheets** for anyone who may open the page.",
            "**The roster** — **Name / Email**, **Role** as a dropdown you can change for people you outrank, **Last Login**, and an active switch.",
            "**Pending invitations** — each with **Invited**, how long the link has left, **Resend invite** and **Cancel invite**.",
          ] },
          { figure: "live:app-settings-team", caption: "Settings → Manage Team — the seat panel, the roster with each person's role, and Add User." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row needs the user-management capability: the owner, administrators, Managers and Dispatchers. A Manager or Dispatcher can invite at the Worker tier — Crew or Estimator — with no dial above their own; changing an existing person's access, making an administrator and revoking access are owner-and-administrator only. Full detail: [[invite-a-team-member|Invite a team member]] and [[deactivate-a-team-member|Deactivate a team member]]." },
        ],
      },
    ],
    faq: [
      { q: "Is this a different page from Your team?", a: "No — same page, two doors. The Settings menu lists it beside the other team rows; the main sidebar lists it under People." },
      { q: "Why is Workers missing from my tabs?", a: "It holds pay rates, so it is drawn only for the owner and administrators; a Manager does not see it. See [[payroll-settings|Payroll settings]]." },
    ],
  },

  "settings-your-hours": {
    title: "Your hours",
    summary:
      "Two weeks per person on one screen: Working hours, the shift the schedule and timesheets use, and Bookable hours, the window clients can book on the public page — with a picker to set someone else's.",
    updated: "2026-09-12",
    intro: [
      "The **Availability** row opens a page titled **Your hours**, and it is one of the three Settings rows every member sees, because these hours are the person's own. It holds two different weeks on purpose: **Working hours**, the shift, and **Bookable hours**, the window a client may book. An estimator works 8 to 4 but only takes consultations 2 to 4 because mornings are on site; one week cannot say that.",
      "Someone with team access also gets a **Whose hours** picker at the top and can set a colleague's weeks — which is how a crew member who never signs in becomes bookable.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The subtitle reads **Your shift and your bookable window are separate. They might work 8–4 but only take client bookings 2–4 — set both here.** The page warns when the bookable window falls outside the shift, because that is usually a mistake, but it allows it, because sometimes it is not." },
          { note: "Neither week is the company's opening hours. Those live on **Company Settings** so that one person's day off is never published as the shop being closed — see [[opening-hours|Opening hours]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom:" },
          { bullets: [
            "**Whose hours** — a dropdown of active team members with **(you)** on your own name; shown only to people who may edit others. Choosing someone else retitles the page **…'s hours** and shows the amber line **You're editing someone else's hours. They'll see the change on their own schedule.**",
            "**Working hours — Your shift. Used for scheduling and timesheets. Never shown to clients.** Seven rows, each a checkbox and two times; an unticked day reads **Not scheduled**.",
            "**Bookable hours — When clients can book you on your public calendar and website. Usually a narrower window than your shift.** The same seven rows. Under it, when nothing is ticked: **With no bookable hours you won't appear as an option on your company's booking page.**",
            "**Save hours** — pinned to the bottom of the screen so it is reachable on a phone under two full weeks; both weeks save together.",
          ] },
          { figure: "live:app-settings-availability", caption: "Settings → Availability — Working hours and Bookable hours, each a week of checkboxes and times, with Save hours pinned below." },
        ],
      },
      {
        id: "how-to",
        heading: "How to set your hours",
        blocks: [
          { steps: [
            "Open **Settings → Availability**. If you are setting a colleague's, pick them under **Whose hours**.",
            "Under **Working hours**, tick the days of the shift and set start and end for each.",
            "Under **Bookable hours**, tick the days a client may book and set a window — usually narrower than the shift.",
            "Read the amber line if one appears: **Clients could book you when you're not working:** followed by the days and why. That is allowed; just check it is intentional.",
            "Press **Save hours**. A day whose end is not after its start is refused with **Fix the highlighted times** until corrected.",
          ] },
          { tip: "New hire starting Monday? Set their hours the day you invite them. A person with no bookable hours is not offered on the booking page, and a person with no working hours gives the schedule nothing to compare a shift against." },
        ],
      },
      {
        id: "what-each-week-changes",
        heading: "What each week changes",
        blocks: [
          { table: {
            head: ["Week", "Read by"],
            rows: [
              ["Working hours", "The schedule, which warns — never blocks — when a shift falls outside the usual pattern; the payroll period; and time off, which deducts only the person's own working days, so a Tuesday-to-Saturday crew loses no balance for a Monday."],
              ["Bookable hours", "The public booking page and the booking calendar on your website, which offer this person only inside the window; and the schedule, which refuses a shift outside it unless a manager overrides and records why."],
            ],
          } },
          { warning: "With no bookable hours set for anyone, the booking page has nobody to offer and shows no slots at all. The dashboard's setup steps point here for that reason." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone sees the row and can set their own two weeks. The **Whose hours** picker, and saving for another person, need the user-management capability — the owner, administrators, Managers and Dispatchers. The server resolves the target the same way, so a picker that is not drawn cannot be reached another way." },
        ],
      },
    ],
    faq: [
      { q: "Why do I have a Whose hours picker but my crew does not?", a: "The picker is drawn only for people who may edit others. A crew member sees and edits their own week only." },
      { q: "Do these hours change what my website says about opening times?", a: "No. Opening hours are the company's, on Company Settings. These are yours, and only the booking calendar reads the bookable week." },
      { q: "Can working hours block a manager from scheduling me on a Saturday?", a: "No — working outside the usual pattern is not an error, it is Tuesday. The schedule warns and lets the manager decide. Approved time off is what blocks." },
    ],
  },

  "settings-time-off-policies": {
    title: "Time off policies",
    summary:
      "What kinds of time off exist in your company and how each builds up — fixed days, accrued per pay period, or vacation pay as a percentage — with country starter sets and a year-end carry-over you run yourself.",
    updated: "2026-09-12",
    intro: [
      "**Time Off Policies** defines the *kinds* of leave your team can request — vacation, sick, personal, unpaid — and how entitlement accumulates. Requests, approvals and balances live elsewhere, on each person's **Time off** screen; this page is the rule book behind them.",
      "It is the owner's and administrators' page, because a policy is an employment term: seeding a starter set writes balances against every worker immediately, which is why nothing here happens without a press.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The heading reads **Time off policies — What time off your team can take, and how it builds up. Requests and balances live on Time off.** A note at the foot says what FieldQuo is and is not: **Statutory minimums vary by province, state and length of service … FieldQuo tracks what you configure — it doesn't decide what you owe.**" },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom:" },
          { bullets: [
            "**Start from the Canada set** (or your own country's) — shown only while you have no active policy. The card leads with the set for the country on your company profile, badged **Your country**, and lists the others under **Hiring in another country? These are here too.** Starter sets exist for Canada, the United States and the United Kingdom, each saying what it assumes and the year its figures are from.",
            "**Policies** with **Add policy** — each active policy as a card: name, **Fixed days per year** / **Accrues each pay period** / **Vacation pay (% of gross)**, the entitlement, **carryover** and its cap, an **unpaid** or **auto-approved** badge, **Edit** and a remove icon.",
            "**Retired** — policies removed after being used, listed as **not bookable** with their count of past requests.",
            "**Year end** — shown once a policy exists: **Carry … balances into …** for last year into this one.",
          ] },
          { figure: "live:app-settings-leave", caption: "Settings → Time Off Policies — the Canada starter set first, the other two below, then Policies with Add policy." },
        ],
      },
      {
        id: "add-a-policy",
        heading: "How to add a policy",
        blocks: [
          { steps: [
            "Open **Settings → Time Off Policies**.",
            "To start from a set, press your country's card. FieldQuo adds its policies and tells you how many, skipping any that already exist by name.",
            "To write your own, press **Add policy**. Give it a **Name** and a **Kind** — Vacation, Sick, Personal, Unpaid, Other.",
            "Choose **How it builds up**: **Fixed days per year** (the whole allowance available now), **Accrues each pay period** (earned gradually, so lower in January) or **Vacation pay (% of gross)** (money, not days — the Canadian 4% model). Enter **Days per year** or **Percent of gross**.",
            "Set the **Carryover cap (days)** — **Blank means unlimited. 0 means use it or lose it.** — and tick **Paid** and **Needs a manager's approval** as they apply.",
            "Press **Add policy** (or **Save changes** on an existing one). Balances are accrued for every worker straight away.",
          ] },
          { note: "Removing a policy that has ever been used does not delete it: it is retired, keeps its history, and can no longer be booked. A policy never used is removed entirely. The confirmation dialog says which will happen." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "What each field changes",
        blocks: [
          { table: {
            head: ["Field", "What it does"],
            rows: [
              ["Kind", "How the request is labelled and grouped on Time off. It does not change the maths."],
              ["Fixed days per year", "The full **Days per year** is available from the start of the year."],
              ["Accrues each pay period", "The same **Days per year**, earned a slice at a time on the payroll cadence — a request in January can be refused for insufficient balance."],
              ["Vacation pay (% of gross)", "Accrues money on each payroll run instead of days; time off under it is not limited by a day balance."],
              ["Carryover cap (days)", "How many unused days survive the year-end carry. Blank is unlimited; 0 wipes them."],
              ["Paid", "Unticked, the policy holds no day balance — unpaid leave is always allowed and simply recorded — and the days are not paid through payroll."],
              ["Needs a manager's approval", "Ticked, a request waits as pending for a manager. Unticked, it is approved the moment it is made and the log says **auto-approved**."],
            ],
          } },
        ],
      },
      {
        id: "year-end",
        heading: "Year end",
        blocks: [
          { p: "Balances do not roll over on their own. When you consider last year closed, press **Carry … balances into …**: unused days move into the new year, capped by each policy's carryover limit, and the page reports how many balances it touched — or **Nothing was eligible to carry over.**" },
          { tip: "Run it once, after the last request of the old year is approved. Running it again finds nothing eligible and changes nothing." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner and administrators only. The row is not drawn for anyone else, and the route answers **Only an owner or admin can manage leave policies.** to every other member. A person's own requests and balances are on their **Time off** screen, which is untouched by this rule — see [[time-off-policies|Time off policies]] under Team and access for the request side." },
        ],
      },
    ],
    faq: [
      { q: "Does seeding the Canada set make me compliant?", a: "No. The sets are common starting points with the year their figures are from, not compliance advice. Minimums rise with years of service in several provinces; adjust per person." },
      { q: "What is the difference between Fixed days and Accrues each pay period?", a: "The same annual number, available all at once or earned gradually. With accrual, someone asking for two weeks in January may not have earned them yet." },
      { q: "A policy I removed still shows under Retired. Why?", a: "It had requests against it. FieldQuo keeps the history and stops new bookings rather than deleting a record that past requests point at." },
    ],
  },

  "settings-booking-page": {
    title: "Booking Page",
    summary:
      "Everything behind the public booking calendar: the embed code, how clients can meet you, the drive-time check and buffer, the arrival window, the default visit length, the change-and-cancellation policy, and the event types with their fees.",
    updated: "2026-09-12",
    intro: [
      "**Booking Page** configures what a homeowner sees when they book a visit from your website, your bio link or the booking address itself. The subtitle reads **Event types clients can book directly from your public page.**, and the page runs from the code that puts the calendar on your site down to one card per event type.",
      "Two rules shape it. The times on offer come from each person's bookable hours, not from here; this page decides how those times are filtered, described and charged. And every control saves the moment you change it — there is no page-wide save button.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page loads only when the company record answers; if it cannot, it refuses rather than showing invented defaults, because the last card prints your cancellation terms as a sentence and a wrong sentence about your own policy is worse than none. What clients see on the other side is described in [[the-booking-page|The booking page]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom, with **New Event Type** at the top right:" },
          { table: {
            head: ["Card", "What it holds"],
            rows: [
              ["Put your booking calendar on your website", "The embed snippet and **Copy code**. An ordinary HTML element that works on Wix, Squarespace, WordPress and hand-written pages — see [[embed-booking-and-quote-forms|Embed booking and quote forms]]."],
              ["How long is a visit?", "**How can clients meet you?** (Visit their place · Phone call · Video call), **Don't offer times you can't drive to** with **Extra time between jobs** (None to 60 min), **What do you promise the client?** (Exact time, ± 15, ± 30, ± 60 min) with a preview line, and the default length from 15 to 180 min."],
              ["Changes & cancellations", "**Notice you need to change or cancel** in hours, **Return the visit fee when they cancel in time** (off by default), **Notice needed to get the fee back**, and two sentences stating the policy as a client will read it."],
              ["One card per event type", "Name and location, **Length**, an **Active** box, **Visit fee** (blank is **Free**), and for a fee **Promo price** with **Promo on**. A fee without Stripe connected shows **Connect Stripe to collect this fee — set it up in Payments**."],
              ["New Event Type form", "**Name (e.g. In-home consult)**, **Minutes**, **Buffer before**, **Buffer after**, **Location (optional)**, **Create**."],
            ],
          } },
          { figure: "live:app-settings-booking-page", caption: "Settings → Booking Page — the embed code, the How long is a visit? card with meeting modes, travel check and arrival window, then Changes & cancellations." },
        ],
      },
      {
        id: "add-an-event-type",
        heading: "How to add an event type",
        blocks: [
          { steps: [
            "Open **Settings → Booking Page** and press **New Event Type**.",
            "Type a **Name** the client will understand — “In-home consult”, “Measurement visit” — the length in **Minutes**, any **Buffer before** and **Buffer after** in minutes, and an optional **Location**. Press **Create**.",
            "On the new card, set a **Visit fee** if holding the slot should cost something; leave it blank for **Free**. The amount is in your billing currency and saves when you leave the box.",
            "For a fee, optionally enter a **Promo price** and tick **Promo on** to offer it at the lower price for now.",
            "Keep **Active** ticked. Untick it to take the type off the public page without deleting it.",
          ] },
          { note: "With no event types, the page says **No event types yet — clients can't book anything until you add one.** — and the public calendar has nothing to offer. Visit fees are charged through your own Stripe account; see [[booking-fees-and-visit-deposits|Booking fees and visit deposits]]." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**How can clients meet you?** — pick everything you offer. With one mode the client is not asked; with two or more they choose when they book. Only a visit asks for an address and gets an arrival window.",
            "**Don't offer times you can't drive to** — on, the client's address is geocoded and slots you could not reach on schedule from the previous job are hidden. Off, every bookable slot is offered regardless of distance.",
            "**Extra time between jobs** — minutes added on top of the drive for parking, unloading and writing up. Starts at **None** because guessing on your behalf removes slots you never agreed to give up.",
            "**What do you promise the client?** — **Exact time**, or a window of ± 15, 30 or 60 minutes. Your own schedule keeps the exact time either way; only what the client is told changes, and the preview line shows it (“between 1:30 and 2:30 PM”). See [[arrival-windows-and-travel-buffer|Arrival windows and travel buffer]].",
            "**How long is a visit?** — the length of any consultation FieldQuo creates automatically when someone adds their availability, and the default in the new-type form. Existing bookings keep the length they were made with.",
            "**Notice you need to change or cancel** — inside this many hours the client can no longer move or cancel the visit themselves and must ring you. Blank reads as 24, never 0.",
            "**Return the visit fee when they cancel in time** — off, a paid fee stays with you whatever happens; on, it is returned for a cancellation made with enough notice. **Notice needed to get the fee back** may be longer than the change notice, and blank means the same notice.",
            "**Length**, **Active**, **Visit fee**, **Promo price**, **Promo on** on each event type — change the type from now on; bookings already made keep their length and the price they were made at.",
          ] },
          { warning: "A refund notice shorter than the change notice means every cancellation a client can still make themselves also returns the fee; the page says so in amber. Set the refund notice equal or longer if you want a window where they can cancel but the fee stays." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row needs the user-management capability: the owner, administrators, Managers and Dispatchers. Everyone else gets a no-access panel rather than a form, because nothing here is information a crew member needs — their own bookable hours are on **Availability**, which stays visible to them. Every write is refused on the server for the same people." },
        ],
      },
    ],
    faq: [
      { q: "Where do the times a client can pick come from?", a: "From each team member's Bookable hours on Availability, filtered by this page's drive-time check, buffer and the event type's length. No bookable hours, no slots." },
      { q: "Can I charge a visit fee without Stripe?", a: "No. The fee is collected through your connected Stripe account; until charges are enabled the card shows Connect Stripe to collect this fee and the fee is not taken." },
      { q: "Does the arrival window move my appointment?", a: "No. Your schedule keeps the exact time. The window only changes what the client is told — “between 1:30 and 2:30 PM” instead of 2:00 PM." },
      { q: "What happens to a visit fee when a client cancels?", a: "Nothing, unless you turned on Return the visit fee when they cancel in time — then it is returned when the cancellation meets the refund notice. The cancellation itself goes through either way." },
    ],
  },
};
