// content/help/en/settings-2.js
//
// Part 2 of the “settings” category in en. Slugs assigned to this part
// (lib/help/tree.js): settings-work-areas, settings-products, settings-services, settings-material-costs, settings-cabinet-rates, settings-overhead, settings-custom-fields, settings-quote-email, settings-email-templates, settings-pdf-templates, settings-translations, settings-checklists.
//
// One article per Settings row, written from the row's page module under
// app/app/settings/<row>/page.js, the API it calls, and the access rules in
// lib/permissions/settingsAccess.js. Where a control is saved and read by
// nothing yet (cost price on a product, custom fields) the article says so —
// AGENTS.md forbids describing a control that appears to work and doesn't.
export const ARTICLES = {
  "settings-work-areas": {
    title: "Work Areas",
    summary:
      "Name the zones or projects your company works in, say who is on each one, and know where those names show up: your public website and what your phone receptionist tells callers.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Team & scheduling → Work Areas** is a short list of named zones — Laval, the North Shore, the downtown condo project — with the people assigned to each. It exists so that “whose patch is this” has one answer everybody can look up.",
      "The names carry further than the roster. They are what the **Where we work** block on your website prints, and they are part of what the phone receptionist knows about your company. So a work area is a public statement of where you take jobs, not only an internal label.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page has one input, **New work area name**, with a plus button beside it, and then one card per area. On each card you see the area's name and a chip for every member of your team; a filled chip means that person is assigned to the area, an outlined one means they are not. Tapping a chip flips it, and the change is saved at once — there is no separate save button." },
          { figure: "live:app-settings-work-areas", caption: "Settings → Work Areas — the name box at the top, then one card per zone with a chip per team member." },
          { p: "Anyone who cannot change assignments sees the same page as a plain list: the notice **These are the zones you can be assigned to.**, then each area with the names of the people on it, or **Nobody assigned yet.**" },
        ],
      },
      {
        id: "add-a-work-area",
        heading: "How to add a work area and assign people",
        blocks: [
          { steps: [
            "Open **Settings → Work Areas**.",
            "Type a name in **New work area name** and press the plus button. The card appears below.",
            "Tap the name of each team member who works that zone. A filled chip is an assignment; tap it again to remove them.",
          ] },
          { note: "There is no rename and no delete on this screen. A work area you no longer use stays in the list — and stays on your website's **Where we work** block — so name them carefully and keep the list to the places you actually serve." },
        ],
      },
      {
        id: "where-the-names-go",
        heading: "Where the names are used",
        blocks: [
          { bullets: [
            "**Your website.** If your site has the **Where we work** block, it lists your work areas as pills, alphabetically, up to 40 of them. There is no separate list of towns to type — this is the only source, so it never goes stale. See [[the-website-builder|The website builder]].",
            "**The phone receptionist.** The area names are part of what the receptionist is told about your company, so it can answer a caller who asks whether you come to their town. See [[settings-phone-receptionist|Phone receptionist]].",
            "**Tasks.** A task can carry a work area in the database, but the Tasks screen has no work-area picker today, so grouping tasks by zone is not something you can do from the app yet.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row appears for owners, admins and supervisors — the Dispatcher and Manager access levels — because creating an area and changing who is on it needs the **workarea:assign** permission those roles hold. An employee who reaches the page reads it as the list described above and cannot change anything; the server refuses the change whether or not the button was drawn." },
        ],
      },
    ],
    faq: [
      { q: "Does assigning someone to a work area change their schedule?", a: "No. It records that they work that zone. Scheduling still happens on the calendar and on each job; nothing is auto-assigned from here." },
      { q: "Why does my website list a zone I stopped serving?", a: "Because the website block prints exactly this list and there is no delete on this screen. Until one exists, the list on your site is the list here." },
    ],
  },

  "settings-products": {
    title: "Products & Services (the price book)",
    summary:
      "The catalogue of items you drop onto a quote — name, sale price, cost, unit and the quote types it belongs to — with a CSV import and export.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Services & pricing → Products & Services** is your price book: the one-off items you add to a quote by name rather than pricing from scratch — a rush fee, a set of handles, a coat of primer on trim. The main scope of a trade (per door, per square foot) is priced from the rate card under [[settings-services|Services & Pricing]]; this screen holds everything else.",
      "A line picked from here lands on the quote with the price you set, so the number a homeowner sees is yours. Public pages never read this list — a stranger on your website sees your services, never your rates.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "At the top: a **Search** box and the **Add Item** button. Below it the list, each row showing the name, description, a **Service** or **Product** badge and the quote types it is linked to, with an edit and a delete icon. The list is paged — pick 6, 10, 25 or 50 per page at the bottom — and the search runs against the whole catalogue, not just the page you are on." },
          { figure: "live:app-settings-products", caption: "Settings → Products & Services — the searchable list with Add Item, then the Costs, Import and Export cards." },
          { p: "Under the list sit three cards: **Costs**, **Import products & services** and **Export products & services**." },
        ],
      },
      {
        id: "add-an-item",
        heading: "How to add or edit an item",
        blocks: [
          { steps: [
            "Press **Add Item** (or the pencil on an existing row).",
            "Fill in the name, an optional description, the type — **Service** or **Product** — and a unit such as sqft or door.",
            "Enter the **Unit price** (what the client pays) and, if you know it, the **Cost price** (what it costs you).",
            "Under **Available on these quote types**, tick the quote types this item belongs to. Leave every box unticked and it is offered on every quote type.",
            "Press **Add Item** or **Save Changes**.",
          ] },
          { figure: "create:app-settings-products-create", caption: "Add Item — name, type, unit, unit price, cost price and the quote types the item is available on." },
          { warning: "Delete is permanent. The confirmation says it plainly: the price and description are removed for good. Quotes already written keep the numbers they were built with, so deleting an item never changes a sent quote." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "What each field changes",
        blocks: [
          { table: {
            head: ["Field", "What it does today"],
            rows: [
              ["Unit price", "The rate the line lands with when you add the item to a quote. You can still change it on that quote."],
              ["Cost price", "Kept on the item and included in the CSV export. No quote, job-costing or margin figure reads it yet — the Costs card on the screen says so."],
              ["Unit", "Printed on the quote line (sqft, door, hour). Free text."],
              ["Available on these quote types", "Filters where the item is offered in the quote builder. No ticks means everywhere."],
              ["Type (Service / Product)", "A badge on the list and a column in the export. It does not change pricing."],
            ],
          } },
          { p: "Items from here appear in the quote builder's line-item table for the matching quote type, and the quote takes the item's name and description in the quote's own language when a translation exists — see [[lines-from-your-price-book|Lines from your price book]] and [[settings-translations|Translations]]." },
        ],
      },
      {
        id: "import-and-export",
        heading: "Import and export",
        blocks: [
          { p: "**Import CSV** takes a .csv exported from Excel, Google Sheets or Numbers with the columns name, description, type, unitPrice, costPrice and unit; **Download sample file** gives you a one-line example to start from. Imported items keep the language they were written in — nothing is translated on upload. **Export CSV** downloads the whole list, cost prices included." },
          { tip: "**Add standard items to Products & Services** on the Services & Pricing screen seeds a trade's usual add-ons (hinges, handles, drawer slides for cabinet work) into this list, already linked to that quote type. Edit their prices here afterwards." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "A price book is prices, so the row and the list are shown only to members whose access grid has **showPricing** on — the Estimator, Dispatcher and Manager levels, plus owners and admins. Crew do not see it. Adding, editing, deleting and importing are refused for anyone but an owner or admin." },
        ],
      },
    ],
    faq: [
      { q: "Where do I set the per-door or per-square-foot rate for my trade?", a: "On Services & Pricing, in the trade's rate card. This screen is for the extras you add on top." },
      { q: "Does the cost price feed my margin on a quote?", a: "Not yet. It is stored and exported, and the screen says nothing reads it. The margin on a quote comes from Material Costs and Overhead." },
      { q: "If I delete an item, does an old quote lose the line?", a: "No. The quote keeps the description and price it was built with." },
    ],
  },

  "settings-services": {
    title: "Services & Pricing",
    summary:
      "Switch on the quote types you offer, set what each one charges by, customise the rate card and the wording a client reads for each trade, and add your own quote types.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Services & pricing → Services & Pricing** decides what your company sells and at what rate. Each quote type you switch on here becomes a choice when someone starts a new quote; its rate card builds the quote's core lines; its wording is what the client reads above the prices.",
      "The rates on this screen never leave it. The public self-quote and booking endpoints return your services and their intake questions, never a price — so the list a competitor can see is the list of what you do, not what you charge.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "At the top right, **Add custom quote type**. Then a **Search services** box and, if your industry narrows the list, **+ Show other trades’ services** to see the whole catalogue. Below, one card per quote type with a checkbox to switch it on. A type you created yourself carries a **Custom** badge and lists its intake fields (or **No fields — flat rate only**)." },
          { figure: "live:app-settings-services", caption: "Settings → Services & Pricing — one card per quote type; a switched-on trade shows what it is priced by, its rate card and its wording." },
          { p: "A switched-on trade with a built-in price book shows **Priced by** chips (per door, per drawer front, per sq ft), and, where it applies, **Rates change with the complexity picked on the quote** with the complexity levels. A trade with no price book shows a plain **Rate** box and a **per** unit instead. Some trades also show **An instant quote is available for this — set it up** or **Homeowners can get an instant price for this**, linking to [[settings-instant-quotes|Instant Quotes]], and a button **Add standard items to Products & Services**." },
        ],
      },
      {
        id: "switch-on-and-price",
        heading: "How to switch a trade on and set its rates",
        blocks: [
          { steps: [
            "Tick the checkbox on the trade's card.",
            "For a one-number trade, type the **Rate** and the **per** unit. The grey number already in the box is FieldQuo's default; leaving it blank keeps inheriting that default.",
            "For a trade with a price book, open **Rate card** and change only the fields you price differently. A changed field is highlighted; **Reset to the default** puts it back to inheriting.",
            "Press **Save Settings** at the bottom. Every card on the page is saved together.",
          ] },
          { note: "Fields marked **internal** in a rate card are never printed for the client — a job minimum, an uplift — they only move the numbers. Blank means inherit, never zero: clearing a field returns it to the built-in default, which keeps improving over time; typing the default's value in pins you to today's number." },
        ],
      },
      {
        id: "what-the-quote-says",
        heading: "What the quote says",
        blocks: [
          { p: "Under each switched-on trade, **What the quote says** holds the wording your quotes and PDFs carry for it: **What this service is** (one paragraph printed above the prices), **What’s included** (one line per item, **Add a line**) and **How the job runs** (steps with an optional timeline, **Add a step**). Leave it alone and you inherit FieldQuo's default wording for the trade; clear a field to go back to inheriting." },
          { p: "Anything still in [square brackets] in the default is held back from your quotes until you fill it in — a client never sees a bracket — and the panel names what is being withheld. The same wording is what the quote email prints; see [[settings-quote-email|Quote Email]]." },
        ],
      },
      {
        id: "custom-quote-types",
        heading: "Adding a custom quote type",
        blocks: [
          { steps: [
            "Press **Add custom quote type**.",
            "Name it (**e.g. Closet Organization**) and tick the fields it should ask for on a quote, chosen from the fields FieldQuo's other quote types already use — search them with **Search fields...**.",
            "Press **Create quote type**. It is created straight away, switched on, and behaves like a flat-rate item if you picked no fields.",
          ] },
          { figure: "create:app-settings-services-create", caption: "Add custom quote type — a name and the intake fields the quote will ask for." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row is shown to members with **showPricing** on their access grid — Estimator, Dispatcher, Manager, owner, admin. Anyone else who reaches the page sees the list with the rates withheld and the notice **Pricing is hidden by your access level. Ask an owner or admin if you need to see it.** Saving, creating a custom type and seeding standard items are refused for everyone but an owner or admin." },
        ],
      },
    ],
    faq: [
      { q: "I changed a rate — do my sent quotes change?", a: "No. A quote is priced when it is built. New quotes use the new rate; existing ones keep theirs." },
      { q: "Why is there no flat / hourly / per-unit choice any more?", a: "It was a setting nothing read, so it was removed. A trade with a price book states its own basis; one without is a rate plus a unit, both of which are used when a line is seeded." },
      { q: "Can a homeowner see these rates?", a: "No. The public endpoints return services and intake fields, never prices." },
    ],
  },

  "settings-material-costs": {
    title: "Material Costs",
    summary:
      "Your real per-gallon prices, coverage rates, coat counts and consumables for the trades that price by recipe, and the threshold at which a finished job asks you to revise them.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Services & pricing → Material Costs** holds the numbers behind the internal Cost & Margin estimate on a quote: what a gallon of primer costs you, how far it goes, how many coats you really do, what a roll of tape costs. They are what you pay, kept apart from what you charge, and a client never sees any of them.",
      "The row exists only for trades that price this way. Today that is **Cabinet Refinishing** and **Exterior Painting**: switch one of them on under Services & Pricing and the row appears; otherwise the page says **Nothing to configure here yet.**",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "First a card, **When to ask about revising your costing**, with one number and a **Save** button. Then one recipe card per applicable trade, each with a **Custom** or **Default** badge, a **Reset to defaults** link, its fields, a **Consumables** block, and its own **Save**." },
          { figure: "live:app-settings-material-costs", caption: "Settings → Material Costs — the cost-revision threshold, then one recipe card per trade with coverage, per-gallon cost, coat counts and consumables." },
        ],
      },
      {
        id: "the-recipe",
        heading: "What the recipe fields change",
        blocks: [
          { p: "Every quote counts its own doors and drawers, or its own square footage, and runs them through these rates: gallons needed = area × coats ÷ coverage, so raising primer coats from 2 to 3 costs 50% more material with no other change. There is no small / medium / large setting anywhere — the quantity is always the count typed on that quote." },
          { table: {
            head: ["Trade", "Fields"],
            rows: [
              ["Cabinet Refinishing", "Primer coats (standard species, and oak/ash/hickory/pine/thermofoil), top coats, primer and top-coat coverage (sqft/gal) and cost ($/gal), hardener as a % of top coat and its cost per quart, setup / teardown hours per job, hours per door, base surface-prep hours."],
              ["Exterior Painting", "Wall production rate (sqft/hr), wall paint coverage, default coats, trim paint cost, trim production rate and coverage (linear ft), setup hours — and **Wall paint cost by tier ($/gal)** for Economy, Standard and Premium."],
            ],
          } },
          { p: "**Consumables** — painter's tape, masking film, sandpaper — take a cost per roll (a whole roll, not per door) and how many doors and drawers one roll covers. Under each, the page works the example for a 24-door, 8-drawer kitchen from your own numbers, so you can sanity-check a figure before saving it." },
          { warning: "**Reset to defaults** deletes every number you entered for that trade and puts back FieldQuo's starting figures. It asks first, because there is no undo and nothing else keeps a copy." },
        ],
      },
      {
        id: "revision-threshold",
        heading: "When a finished job asks you to revise",
        blocks: [
          { p: "**Ask to revise costing when a job comes in more than this over its estimate** is a whole number from 0 to 100, **15** by default. When a completed job's real cost comes in at least that far over what you quoted, the close-out shows the comparison and asks whether to update your rates from what it really cost — or leave them. A job that came in under never asks, and each job asks once. Set it to 0 to be asked on any overrun." },
          { tip: "The suggestions the close-out offers write back into these recipe cards and into the rate card on Services & Pricing — which is why the threshold lives on this screen. See [[job-costing|Job costing]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "This is the company's cost basis, so it needs both the **user:manage** permission and the **jobCosting** toggle: owners, admins and the Manager level. A Dispatcher holds the first but not the second and does not see the row. Everything here feeds only the internal estimate — see [[cost-and-margin-on-a-quote|Cost and margin on a quote]]." },
        ],
      },
    ],
    faq: [
      { q: "Where do I set how much material a small, medium or large job uses?", a: "Nowhere — there is no such setting. Every quote uses its own door count or square footage against these rates." },
      { q: "My trade is not listed. Where are its material costs?", a: "Only Cabinet Refinishing and Exterior Painting have a recipe today. Other trades price from their rate card and the price book without a material estimate." },
      { q: "Does a client ever see these numbers?", a: "No. They only shape the internal Cost & Margin panel; the quote shows your prices." },
    ],
  },

  "settings-cabinet-rates": {
    title: "Cabinet pricing",
    summary:
      "What the kitchen designer charges for cabinetry — per linear foot or material cost-plus, tier by tier, with material multipliers, finishing, delivery and tear-out.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Services & pricing → Cabinet Pricing** is the rate card the kitchen designer prices from. Every kitchen a client lays out is priced on the server from these numbers, so changing them changes what new designs cost — and never touches a quote you have already sent.",
      "The screen ships with starting rates that came from a working cabinet shop, and it says so in an amber notice: **These are starting rates, not yours.** They are believable enough to go out unnoticed, which is exactly why you should set your own before sending a kitchen quote.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "Four cards. **How you price a cabinet** picks between **Per linear foot** and **Material cost-plus**, and the second card changes with that choice. Then **Material multipliers** and **Finishing, delivery and tear-out**. At the bottom, **Save pricing**, and — once you have saved your own — **Back to the starting rates**." },
          { figure: "live:app-settings-cabinet-rates", caption: "Settings → Cabinet Pricing — the pricing mode, the per-linear-foot tiers, the material multipliers and the finishing charges." },
        ],
      },
      {
        id: "the-two-modes",
        heading: "Per linear foot or cost-plus",
        blocks: [
          { table: {
            head: ["Mode", "How a cabinet is priced", "Fields"],
            rows: [
              ["Per linear foot", "Its width in feet × the rate for its tier, adjusted by the door and box material. How custom shops quote.", "**Base**, **Wall / upper**, **Tall / pantry**, **Island**, a **Drawer surcharge** per drawer, optional **Closet casework** and **Vanity / laundry sink base** rates (blank bills them at your kitchen rates), and the checkbox **Install is included in the rate**."],
              ["Material cost-plus", "A base cost plus a per-inch figure for the box, marked up, with install billed separately.", "A base cost and a per-inch figure for each of Base, Wall, Tall and Island, a **Markup** (0.18 = 18% on material) and **Install per box**."],
            ],
          } },
          { p: "**Install is included in the rate** matters: switched off, every kitchen quote gains a separate installation line. There is no per-linear-foot install rate on the screen because nothing in the designer bills install that way — a box that saved a number and quoted per box anyway would be a dead control." },
        ],
      },
      {
        id: "multipliers-and-extras",
        heading: "Material multipliers and extras",
        blocks: [
          { bullets: [
            "**Material multipliers** apply to the cabinet price per door material and per box material: 1.0 is your baseline, 1.4 means white oak costs 40% more than it. **Corner premium** adds to corner boxes, which are more work than their width suggests.",
            "**Finishing — per door** and **per drawer front**, **Delivery** (flat) and **Remove old cabinetry** (per box) are charged per piece and switched on or off per design inside the designer.",
          ] },
          { warning: "**Back to the starting rates** deletes your saved rates immediately, with no confirmation, and the amber notice comes back. Save a note of your numbers before pressing it." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row appears only when your company has switched on **Kitchen Design & New Installs** under Services & Pricing, or already saved its own rates. Reading and changing it need **user:manage** — owners, admins and supervisors (the Dispatcher and Manager levels). The designer itself is described in [[the-kitchen-designer|The kitchen designer]]." },
        ],
      },
    ],
    faq: [
      { q: "I changed my rates — does the kitchen quote I sent yesterday change?", a: "No. Designs are priced when they are made; the new rates apply to new designs." },
      { q: "Why is Cabinet Pricing not in my Settings menu?", a: "It only appears for companies with Kitchen Design & New Installs switched on. Turn that quote type on under Services & Pricing." },
    ],
  },

  "settings-overhead": {
    title: "Overhead",
    summary:
      "Everything the business costs to run in a month — fixed costs, salaries, debt, assets — and the minimum price a job must fetch to cover it.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Services & pricing → Overhead** is where you write down what your company costs whether or not you win a job: the rent, the insurance, your own draw, the truck loan, the spray rig you will one day replace. Divided by how many jobs you can take on, that becomes the lowest price a job can go out at and still cover the business.",
      "That number — **Minimum price** — is the one a contractor most wants and least often has. It is also fed into the Cost & Margin panel of every quote as real overhead per job, replacing a guessed percentage.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "Top to bottom: **Your minimum price** (two inputs and four tiles), **Paid hours that never reached a job**, then five registers — **Fixed costs**, **Salaries**, **Debt**, **Assets & depreciation** and **Bills due**." },
          { figure: "live:app-settings-overhead", caption: "Settings → Overhead — Jobs per week and Target margin, the four tiles, then the registers that feed them." },
        ],
      },
      {
        id: "your-minimum-price",
        heading: "Your minimum price",
        blocks: [
          { steps: [
            "Enter **Jobs per week** — how many jobs your crew can take on in a normal week — and, if you want, **Target margin %** (blank means the default of 20).",
            "Press **Save**. The four tiles fill in: **Monthly fixed costs**, **Jobs / month**, **Cost per job** and **Minimum price**.",
            "Read the note under them: it says which registers the total includes, and adds the depreciation on your assets and the interest on your loans.",
          ] },
          { p: "Jobs per month is jobs per week × 4.33; cost per job is the monthly total divided by that; the minimum price is cost per job divided by (1 − margin). The minimum covers overhead only — the materials and labour of the specific job are on top. Bills due do not change it: they are cash flow, not cost." },
        ],
      },
      {
        id: "the-registers",
        heading: "What goes in each register",
        blocks: [
          { table: {
            head: ["Register", "What belongs there", "What it changes"],
            rows: [
              ["Fixed costs", "Rent, insurance, the phone bill, subscriptions — an amount, weekly, monthly or yearly.", "Counted in the monthly total. A one-off is saved but not counted; the row says so."],
              ["Salaries", "Business overhead only: your own draw, an office wage, a bookkeeper by the hour. Not a crew member's rate — their hours are already charged to each job.", "Counted in the total. These are never used to pay anyone; pay comes from Manage Team and Payroll."],
              ["Debt", "Loans and finance agreements: principal, monthly payment, interest rate.", "Counted in the total. Linked to an asset, only the interest counts, so the truck is not charged twice."],
              ["Assets & depreciation", "Things bought once and used for years, with what they cost, trade-in value, useful life and in-service date.", "Their monthly depreciation is added to the total. Sold or retired ones stop charging; use the dispose action rather than delete to keep the history."],
              ["Bills due", "What is owed and not yet paid, with a due date, and **Mark paid**.", "Outstanding, out this month and overdue. Nothing here touches the minimum price."],
            ],
          } },
          { warning: "Deleting a row asks first, because the price floor changes straight away and there is no undo. For an asset the confirmation suggests marking it disposed instead, which keeps what it already cost you." },
        ],
      },
      {
        id: "unabsorbed-labour",
        heading: "Paid hours that never reached a job",
        blocks: [
          { p: "This panel compares the week you guarantee people with the hours they actually logged against a job, over the last 30 days, and costs the gap at their hourly rate. It is deliberately **not** counted in the cost per job or the minimum price — those would move every quote you write on time entries nobody has checked yet. When a rate is missing it says the total is short rather than counting those hours as free." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The whole screen is the company's cost basis, so it needs the **jobCosting** toggle on top of **user:manage**: owners, admins and the Manager level see it; a Dispatcher does not. Salaries additionally need the payroll grid that lets you see everyone's pay, and Bills due needs company-wide expenses access. The floor it produces is explained in [[overhead-and-your-minimum-price|Overhead and your minimum price]] and [[the-break-even-price|The break-even price]]." },
        ],
      },
    ],
    faq: [
      { q: "Why is my minimum price “not set”?", a: "Jobs per week is empty. The floor needs a capacity to divide by; enter one and press Save." },
      { q: "Should I put my painters' wages under Salaries?", a: "No. Their hours are charged to each job as labour. Salaries is for overhead pay only — your draw, the office, a bookkeeper." },
      { q: "Does recording a bill here pay it?", a: "No. Pay it your usual way, then press Mark paid." },
    ],
  },

  "settings-custom-fields": {
    title: "Custom Fields",
    summary:
      "Where extra boxes for clients, properties, quotes, jobs, invoices and team members will be defined — marked Coming soon, because no record shows them yet.",
    updated: "2026-09-12",
    intro: [
      "A custom field is an extra box for something FieldQuo has no box for — a gate code on a property, a PO number on an invoice, a ticket expiry on a team member. **Settings → Services & pricing → Custom Fields** is the screen where those boxes are defined.",
      "Today the screen carries a **Coming soon** panel, and the sentence under the title says why: nothing shows a custom field on a client, property, quote, job, invoice or team record yet, so the answers cannot be filled in. FieldQuo does not render a dead Add button over that gap.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "Six sections — **Client custom fields**, **Property custom fields**, **Quote custom fields**, **Job custom fields**, **Invoice custom fields** and **Team custom fields**. Each lists the fields defined for that record type with a type badge (Text, Number, Date, Checkbox or Dropdown) and **Required** where it was set. A section with none reads, for example, “Keep track of client details by adding a custom field”." },
          { figure: "live:app-settings-custom-fields", caption: "Settings → Custom Fields — the Coming soon panel, then one section per record type." },
        ],
      },
      {
        id: "what-works-today",
        heading: "What works today",
        blocks: [
          { bullets: [
            "Definitions a company created before the Add control was withdrawn are still listed, and an owner, admin or supervisor can still delete one with the trash icon.",
            "**Add Field** is not shown. It comes back the day a record form renders a custom field, in the same change that removes the Coming soon panel.",
            "Nothing here concerns email. The line under the title points you to [[settings-email-templates|Email Templates]] for that.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row needs **user:manage** — owners, admins and supervisors — because defining a field would change every record in the company. When the feature ships, employees will see the list read-only, since knowing what “Gate code” is and whether it is required is useful to the person filling it in." },
        ],
      },
    ],
  },

  "settings-quote-email": {
    title: "Quote Email",
    summary:
      "The two optional sections of the email that carries your quotes — past-client references and before-and-after photo pairs — and the rule that stops an empty one going out.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Documents & templates → Quote Email** is about what the email carrying a quote contains beyond the quote itself. Most of that email is not configurable here and has no switch: the scope, what is included, how the work runs and what could change the price all come from the quote and from the wording you edit per trade under Services & Pricing. If the quote says it, the email says it.",
      "What is optional is your own proof — the people a homeowner can ring, and the photos of jobs you finished. This screen holds both, decides whether they go on every new quote by default, and every change is saved as you make it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "Three cards. **What the email always carries** is a plain list with no controls, and a link to Services & Pricing where that wording is edited. **References** and **Before & after** each have a checkbox **Include on every new quote**, a list, and an add form. There is no Save button; each edit saves at once and the page re-renders from what was actually stored." },
          { figure: "live:app-settings-quote-email", caption: "Settings → Quote Email — what the email always carries, then the References and Before & after cards with their Include on every new quote checkboxes." },
        ],
      },
      {
        id: "references",
        heading: "References",
        blocks: [
          { steps: [
            "In **References**, type a **Name** and a **Phone** and press **Add**. Both are required — a name with no number is not a reference — and they print exactly as you type them.",
            "Tick **Include on every new quote** to put the list on every new quote by default.",
            "Use **Remove** on a row to take someone off.",
          ] },
          { warning: "Only list people who have actually agreed to these calls. Their number goes to every homeowner you quote. The email prints at most 6 references." },
        ],
      },
      {
        id: "before-and-after",
        heading: "Before & after",
        blocks: [
          { steps: [
            "Under **Before & after**, press **New pair — upload the before and the after** and add a photo in each of the **Before** and **After** slots. Both halves are required.",
            "Add a **Caption (optional)** and tick **Include on every new quote** if the pairs should go out by default.",
          ] },
          { p: "The email prints at most 4 pairs — eight images is already slow on a phone in a driveway. The uploads go through the same signed upload as your logo and job photos." },
        ],
      },
      {
        id: "the-empty-section-rule",
        heading: "What a switched-on empty section does",
        blocks: [
          { p: "A section that is switched on with nothing in it must never reach a client. So FieldQuo blocks the send instead: the page says **This is switched on with nothing in it. Until you add something or switch it off, quotes can't be sent.**, and when someone presses Send on a quote they get a modal naming the section with two buttons — **Add content**, which brings them here, and **Leave it out of this quote**." },
          { p: "Each quote can also override the default. The **Email sections** panel on a quote shows **Default (on)** or **Default (off)** for each section and lets you switch it on or off for that quote alone, or give it its own list. See [[references-and-photos-in-the-quote-email|References and before-and-after photos in the quote email]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The row needs **user:manage** — owners, admins and supervisors. Anyone else who reaches the page sees it read-only with the notice **This is what your clients receive with every quote.** The covering email itself goes out in the quote's language, under your company's name." },
        ],
      },
    ],
    faq: [
      { q: "Can I edit the rest of the quote email here?", a: "No. The scope, inclusions and steps come from the quote and the per-trade wording on Services & Pricing; the layout comes from Email Templates only for follow-ups and campaigns. This screen owns the two optional sections." },
      { q: "I ticked Include on every new quote — will old quotes get it?", a: "No. It is the default for new quotes. An existing quote keeps whatever its own Email sections panel says." },
    ],
  },

  "settings-email-templates": {
    title: "Email Templates",
    summary:
      "Block-built email templates grouped Automated, Marketing and Custom — what the editor offers, which sends actually use them today, and what the Active badge does and does not change.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Documents & templates → Email Templates** lists every email template your company has, grouped by what it is for, with one per type marked **Active**. Each template opens in a block editor with a subject line, your branding, merge fields, a live preview and a send-a-test button.",
      "Read the next section before building one. Templates are genuinely sent by **Follow-up rules** and **email campaigns**. The Active badge on the automated quote and receipt types does not change what a quote or invoice email says today — those come from the document itself.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "At the top, **Add default templates**, which seeds a starter template for each automated type you do not have yet. Then three groups — **Automated** (Quote email, Instructions email, Receipt / invoice email, Follow-up email), **Marketing** (Marketing email) and **Custom** — each type with **New Template** and its list of templates. A row shows the name, an **Active** badge on the one in use, a star to make another one active, and edit, duplicate and delete icons. A type with none reads **No templates yet — using the built-in default.**" },
          { figure: "live:app-settings-email-templates", caption: "Settings → Email Templates — Automated, Marketing and Custom, one Active template per type." },
        ],
      },
      {
        id: "which-sends-use-them",
        heading: "Which sends use a template",
        blocks: [
          { table: {
            head: ["Template type", "Used by"],
            rows: [
              ["Follow-up email, Marketing email, Custom", "**Follow-up rules** — a rule picks one of these when you create it, and the follow-up cron renders its blocks. See [[follow-up-rules|Follow-up rules]]."],
              ["Marketing email, Custom", "**Email campaigns** on the Marketing screen — a campaign picks a template and sends it to your subscribers. See [[email-campaigns-and-subscribers|Email campaigns and subscribers]]."],
              ["Quote email, Instructions email, Receipt / invoice email", "Nothing yet. The real quote and invoice emails are built from the document — its scope, inclusions and steps — and the layout under PDF Templates. Marking one of these Active moves the badge and changes no email."],
            ],
          } },
          { note: "The wording of the quote email that IS yours to change lives elsewhere: per trade under [[settings-services|Services & Pricing]], and the two optional sections under [[settings-quote-email|Quote Email]]." },
        ],
      },
      {
        id: "build-a-template",
        heading: "How to build one",
        blocks: [
          { steps: [
            "Press **New Template** under the type you need, give it a name and press **Create & edit**.",
            "Set the **Subject line** (merge fields work there too; blank uses the built-in subject for the type).",
            "Under **Look & feel** the template starts as **Using your branding**; change the accent, header and background only if you want to.",
            "Press **Add block** to add text, images, buttons, dividers or a summary, and drag blocks to reorder. Merge fields insert the client's name, the amount and so on.",
            "Check **Email preview** with sample data, on mobile and desktop, then **Send a test** to your own address.",
            "Press **Save**. Back on the list, press the star to make it the **Active** one for its type.",
          ] },
          { figure: "create:app-settings-templates-create", caption: "New Template — name it, then Create & edit opens the block editor." },
          { warning: "Delete is a hard delete with a confirmation. Deleting the Active template of a type returns that type to the built-in default." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Everyone can read templates, but every control — create, edit, activate, duplicate, delete, seed defaults — needs **user:manage**, so the row is shown only to owners, admins and supervisors rather than drawing buttons that would all be refused." },
        ],
      },
    ],
    faq: [
      { q: "I made a Quote email template Active and my quote email looks the same. Why?", a: "Because the quote email is not rendered from a template today. Its wording comes from the quote and from Services & Pricing; the optional sections from Quote Email." },
      { q: "Do templates keep my logo and colour?", a: "Yes. A new template starts as Using your branding, from Settings → Branding, until you customise its look." },
      { q: "Where do I choose which template a follow-up uses?", a: "On the follow-up rule itself, under Settings → Follow-ups. Only Follow-up, Marketing and Custom templates are offered." },
    ],
  },

  "settings-pdf-templates": {
    title: "PDF Templates",
    summary:
      "The section order of the quote and invoice PDFs your clients receive — one layout in use per document, editable section by section, with a sample preview.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Documents & templates → PDF Templates** is the layout of the two PDFs a client actually gets: the quote attached when you send or download one, and the invoice attached to invoices and payment requests. A company that never opens this screen still gets a complete PDF on the standard layout; this page exists to change the order of its sections or drop one.",
      "It is a sibling of Email Templates, split by medium: a PDF is a page with a fixed section order and no buttons; an email scrolls and has links. The two are edited separately on purpose.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "Two cards, **Quote PDF** and **Invoice PDF**, each with a **New** button and its list of layouts. A layout shows its name, how many sections it has and an **Active** badge on the one in use; the others offer **Use this**, plus edit and delete icons. A card with no layouts reads **Using the standard layout. Your PDFs already work — make one only if you want to change the order or drop a section.** If you have layouts but none is in use, the card warns that PDFs are still coming out on the standard layout." },
          { figure: "live:app-settings-templates", caption: "Settings → PDF Templates — the Quote PDF and Invoice PDF cards, each with its layouts and the one marked Active." },
        ],
      },
      {
        id: "the-standard-layout",
        heading: "The standard layout",
        blocks: [
          { p: "A quote reads, top to bottom: **Header**, **Client details**, **Line items**, **Totals**, **How the work runs**, **Payment terms**, **Notes**, **Signature block**, **Footer**. The steps sit after the total on purpose — the client's eye goes to the price first, and the question right after is whether it is worth it. An invoice is a demand rather than a pitch, so its standard layout is Header, Client details, Line items, Totals, **Payments received**, Notes and Footer: no steps, no signature. Invoices mirror quotes so the client recognises the second document as the first one's twin." },
        ],
      },
      {
        id: "make-a-layout",
        heading: "How to make and use a layout",
        blocks: [
          { steps: [
            "Press **New** on the Quote PDF or Invoice PDF card, name it (the name is for you — clients never see it) and choose **Start from the standard layout** or **Copy the current one**.",
            "In **Edit layout**, the list **Sections, top to bottom** has **Move up**, **Move down** and **Remove section** on each row, and **Add a section** for any you took out. If you remove one that matters, the editor says so: the PDF will still generate, but it will not look like a finished document.",
            "Press **Preview with sample data**, then **Save**.",
            "Back on the list, press **Use this**. From then on every new quote (or invoice) PDF is rendered with it.",
          ] },
          { warning: "Delete is permanent and asks first. Deleting the layout marked **currently in use** reverts every future PDF to the standard layout — a change to what clients receive, from a screen that looks like housekeeping." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Every control here needs **user:manage**, so the row is shown to owners, admins and supervisors. The colours in the PDF come from your brand colour under [[settings-branding|Branding]], never from this screen; what each section prints is described in [[the-quote-pdf|The quote PDF]]." },
        ],
      },
    ],
    faq: [
      { q: "Do I need a layout for my PDFs to work?", a: "No. With no layout, or none in use, PDFs use the standard layout, which is complete." },
      { q: "Can I change the wording inside a section?", a: "Not here. This screen orders and removes sections. The words come from the quote and from the per-trade wording on Services & Pricing." },
    ],
  },

  "settings-translations": {
    title: "Translations",
    summary:
      "Review and correct the translated names and descriptions of your products and services, language by language, with AI drafts you read before they reach a client document.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Documents & templates → Translations** is the wording clients see on quotes and invoices written in another language — the name and description of each item in your price book, in French, Spanish or any other language FieldQuo supports. It is laid out source beside translation, one row per item, because the job is comparison: you cannot judge whether “finition” is right without “finish” next to it.",
      "Nothing is machine-translated at send time. A quote keeps the language it was created in, and an item lands on it with the reviewed wording for that language when one exists — otherwise the source text, so a missing translation makes an unfinished-looking line, never a blank one.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "A language picker (every language FieldQuo supports except your company's own), a counter — **{count} still missing** or **All {count} translated**, plus **{count} drafted, unread** — and the button **Draft the missing ones**. Below, one row per product or service with its source text on the left, the translation boxes on the right, a status (**Not translated**, **Drafted — not read yet**, **Reviewed** with the date) and **Mark reviewed**. Rows that need attention float to the top." },
          { figure: "live:app-settings-translations", caption: "Settings → Translations — the language picker, the missing counter, and source beside translation for each item." },
        ],
      },
      {
        id: "how-to-translate",
        heading: "How to translate your price book",
        blocks: [
          { steps: [
            "Pick the language.",
            "Press **Draft the missing ones**. Drafts land in the empty boxes, labelled **AI draft — read it before saving**; nothing is saved yet. Or type the translation yourself.",
            "Read each row against the source. Fix the trade vocabulary — “finish”, “trim”, “coat” and “run” mean one thing on a job site and another in a dictionary.",
            "Press **Mark reviewed** on each row. That is the only action that writes anything, and from then on that wording goes onto client documents.",
          ] },
          { note: "Drafting spends your AI allowance and stops when it runs out, telling you how many are left to do. If automatic drafting is not switched on for the deployment, the page says so and you can still type the translations in." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "What a reviewed translation changes",
        blocks: [
          { bullets: [
            "When an item from the price book is added to a quote in that language, the quote line takes the translated name and description. A translated name with no translated description falls back to the source description and still counts as missing here.",
            "Sent documents are untouched. Fixing a translation changes new lines, never a quote a client has already received — a signed PDF keeps saying what it said.",
            "Products imported by CSV arrive in the language they were written in and show here as **Not translated** until you draft or type them.",
          ] },
          { p: "The names of the trades themselves (the quote types) are not edited here; they come from FieldQuo's own catalogue in every language. The languages you send documents in and the language of each client are set under [[settings-language|Language]] and on the client — see [[choose-your-language|Choose your language, and your company's]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Saving a translation and drafting need **user:manage**, so the row is shown to owners, admins and supervisors. The list reads from the price book, which is why the page says **No services yet. Add them under Settings → Products & Services** when there is nothing to translate." },
        ],
      },
    ],
    faq: [
      { q: "Is a draft used on quotes before I review it?", a: "A draft made with Draft the missing ones is not saved until you press Mark reviewed, so no. Only saved wording reaches a document." },
      { q: "Will fixing a translation change a quote I already sent?", a: "No. A document keeps the wording it was created with." },
      { q: "Why can I not pick my own language in the picker?", a: "The source language is your company's default; you translate away from it, not into it." },
    ],
  },

  "settings-checklists": {
    title: "Checklists",
    summary:
      "Reusable lists of the steps your crew works through on site, grouped Before the work, On the job and Before you leave, copied onto a visit as a fresh tickable list.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Documents & templates → Checklists** is where you write down, once, the steps your crew repeats on every job — mask the counters, photograph before, photograph after — instead of relying on people remembering them. Attach a list to a job visit and it comes across as a fresh, tickable copy; editing the copy later never changes the original.",
      "Two lists on the page, split on purpose: the top one is what your company wrote; the bottom is FieldQuo's per-trade starter library. Taking a starter copies it into your own list rather than linking to it, because the first thing anyone does with a starter list is change a line.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "**New checklist** at the top right. Then your own checklists, each showing its name, a phase badge (**Before the work**, **On the job** or **Before you leave**), its step count and the service it is for, with **Edit** and a delete icon. Under them, **Starter checklists for your trades** — written for the services you have switched on — each with **Use this**. When you have none yet the page reads **No checklists yet**." },
          { figure: "live:app-settings-checklists", caption: "Settings → Checklists — your own lists with their phase and step count, then the starter checklists for your trades." },
        ],
      },
      {
        id: "write-a-checklist",
        heading: "How to write one",
        blocks: [
          { steps: [
            "Press **New checklist** (or **Use this** on a starter to begin from a copy).",
            "Name it — the placeholder suggests **Kitchen refinish — day one** — and choose **For which service**, or leave **Any service**.",
            "Pick **When in the visit**: **Before the work** for site prep and materials, **On the job** for the work itself, **Before you leave** for cleanup and the client walkthrough. A visit groups its checklist under these headings.",
            "Fill in the **Steps**, one per line, with **Add step** for more, and press **Create** (or **Save changes** when editing). A name and at least one step are required.",
          ] },
          { figure: "create:app-settings-checklists-create", caption: "New checklist — the name, the service, when in the visit it applies, and the steps." },
        ],
      },
      {
        id: "how-it-reaches-a-visit",
        heading: "How a checklist reaches a visit",
        blocks: [
          { bullets: [
            "When someone creates a visit on a job, the **Checklist** field is optional: pick one or more and the crew gets their own tickable copy.",
            "A visit that already exists can have a template applied to it afterwards from the visit's checklist panel.",
            "Nothing is applied on its own. The starter library is a set of suggestions, and a checklist you wrote sits here until someone attaches it. Ticking it off happens on the visit, on the crew's phone — see [[checklists-on-site|Checklists on site]].",
          ] },
          { warning: "Deleting a checklist here removes the template. Copies already attached to visits are separate rows and keep their steps." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Creating, editing and deleting a checklist is for owners, admins and supervisors, so the row is shown to them. Reading the templates is open to everyone on purpose: the new-visit screen and the visit checklist read the same list, and those are exactly the screens a crew member works from." },
        ],
      },
    ],
    faq: [
      { q: "If I change a checklist, do visits that already have it change?", a: "No. Each visit holds its own copy. The edit applies to visits it is attached to from now on." },
      { q: "Can a step be a reading rather than a tick?", a: "A step on this screen is a line of text the crew ticks off. There is no numeric or pass/fail response type on this settings form today." },
      { q: "Why do I see no starter checklists?", a: "They are written for the services you have switched on under Services & Pricing. Switch a trade on and its starters appear." },
    ],
  },
};
