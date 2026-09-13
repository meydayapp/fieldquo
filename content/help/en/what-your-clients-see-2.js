// content/help/en/what-your-clients-see-2.js
//
// Part 2 of the “what-your-clients-see” category in English (see the
// composer, what-your-clients-see.js). Slugs assigned to this part
// (lib/help/tree.js): the-self-quote-form-as-a-client, the-review-request,
// the-referral-page, your-website-as-a-visitor, the-kitchen-design-link,
// the-bio-link-page, a-funnel-as-a-visitor, the-texts-clients-receive.
//
// Every article describes ONE client-facing surface the way the client sees
// it — the company's name, logo and colour, never FieldQuo's — and then what
// the contractor controls about it. The facts come from the route that
// renders the surface (app/quote, app/refer, app/site, app/design, app/l,
// app/f), the API it calls, and the lib/** rule behind each control.
export const ARTICLES = {
  "the-self-quote-form-as-a-client": {
    title: "The self-quote form",
    summary:
      "What a homeowner sees when they open your Request a quote link: three short steps, no prices, a confirmation on your stationery, and a lead in your pipeline.",
    updated: "2026-09-12",
    intro: [
      "Your **Request a quote** link is a public form a stranger can fill in from your website, a Facebook post or the back of the van. It carries your logo, your name and your brand colour; nothing on it says FieldQuo. It asks for the service, the rough size of the job, and a way to reply — in that order, because someone comparing three contractors will pick a service before they will hand over an email address.",
      "It never shows a price. The form produces a **lead**, not a quote: the homeowner is told a person will price the job, and what they typed lands on your Leads board with the size of the job already known.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The form lives at your company's own link (the **Request a quote** card on **Settings → Share your links** gives it to you, with a snippet to embed it in a website you already have). It is written in your company's language and laid out in the same order as your quote — identity strip at the top, a three-dot progress line, then one step at a time." },
          { figure: "harness:client-self-quote-form", caption: "The self-quote form as a homeowner sees it — the company's logo and name, then step 1, “What can we help with?”, listing only the services the company has switched on." },
          { note: "The list of services is the one you enabled under **Settings → Services & Pricing**. A visitor cannot request work you do not do, and the rate card behind each service never leaves that settings screen — the public endpoint returns services and intake fields, not prices." },
        ],
      },
      {
        id: "the-three-steps",
        heading: "What the homeowner fills in",
        blocks: [
          { steps: [
            "**What can we help with?** — one tap on a service. A cabinet company that has switched on Kitchen Design also shows a line here: “Prefer to draw it? Design your kitchen yourself and send us the layout →”.",
            "**How big is it?** — at most three number or choice fields for that service (doors, square feet, rooms), then two chip rows that are always asked: **When are you hoping to start?** (As soon as possible · Within 2 weeks · In the next 1–3 months · Just exploring for now) and **Rough budget?** (four bands in your currency, plus Not sure yet — optional), and a free-text **Anything else we should know?**.",
            "**Where should we send it?** — a name, and an email or a phone number (“One of email or phone is enough”), an optional address with Google autocomplete, and **Add photos, a video or a PDF plan**. The button reads **Send my request**, under it: “No obligation. [Your company] will get back to you with a price.”",
          ] },
          { p: "An address picked from the autocomplete carries its city, province and country to the lead, so the client you create from it already has a tax jurisdiction. An address typed by hand still submits — the form never depends on Google being reachable." },
        ],
      },
      {
        id: "after-they-press-send",
        heading: "What happens after Send",
        blocks: [
          { bullets: [
            "The screen turns into a **Request received** document in your colours: your logo and phone, the word **Request**, a reference, a “prepared for” panel with what they typed, **What you asked for**, and **What happens next** in three numbered steps — they read it, they price it, you get a quote. A line reads “No price is shown yet — this request hasn't been priced.”",
            "If they gave an email, a copy goes to them **from your company**, in the language the lead was created in, with the same content and no price. The screen says “A copy is on its way to …” only when a copy was actually sent.",
            "If your company can take bookings (at least one active event type and the visit mode on), a **Would you like us to come and see it?** panel appears under the confirmation with a **Book a visit** button, pre-filled with the details they just typed. See [[the-booking-page|The booking page]].",
            "On your side, a lead appears on **Leads** with the source, the answers as structured fields, the photos and the plan, scored **Hot**, **Warm** or **Cold** — and the people who get lead notifications are told. A phone number given here is recorded as consent to be called back.",
          ] },
          { tip: "The lead keeps the language it was written in, and the quote you convert it into is created in that language — see [[quote-language|A quote keeps its language]]." },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { table: {
            head: ["Where", "What it changes on the form"],
            rows: [
              ["Settings → Branding", "The logo, the brand colour and every colour derived from it — contrast is measured, so a yellow or white brand still reads."],
              ["Settings → Services & Pricing", "Which services appear at step 1, and which intake fields step 2 asks (the first three number or choice fields of each service)."],
              ["Settings → Language", "The language the form and the confirmation are written in — your company's default. There is no language picker for the visitor today: FieldQuo does not yet let a company list several send languages."],
              ["Settings → Booking Page", "Whether the Book a visit panel appears after the confirmation (it needs at least one active event type)."],
              ["Settings → Share your links", "The link itself, an Open button, and the embed snippet for your own website."],
            ],
          } },
          { p: "The wording of the steps is FieldQuo's, in eight languages; it cannot be edited. What you cannot do on purpose: show a price, ask for a card, or add fields of your own." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The form itself is public — anyone with the link. The **Share your links** screen that hands out the link needs the Manager level or above (an owner, an administrator, a Manager or a Dispatcher). The leads it creates are visible to anyone whose access includes Requests." },
        ],
      },
    ],
    faq: [
      { q: "Can the homeowner see a price on the form?", a: "No, and this is deliberate. The form creates a lead; a person prices it. If you want a visitor to see a starting figure, that is the instant estimate — see [[the-instant-estimate-page|The instant estimate page]]." },
      { q: "Why does the form show only some of my services?", a: "It lists the services switched on under Settings → Services & Pricing. Switch one on and it appears on the form at once." },
      { q: "Does the visitor have to give an email?", a: "An email or a phone number — one is enough. A misspelt email is refused while they are still looking at the form, rather than bouncing later." },
      { q: "Can I put the form on my existing website?", a: "Yes. Settings → Share your links has an embed snippet; inside your own page the form drops its logo strip because your site already carries your name." },
    ],
  },

  "the-review-request": {
    title: "The review request",
    summary:
      "The one email a client gets after a job is completed: your logo, one sentence of thanks, a 1–5 rating, a Leave a review button to your Google link — and the rules that make sure it is sent once, and never to the wrong person.",
    updated: "2026-09-12",
    intro: [
      "When a job is marked **Completed**, FieldQuo can ask the client for a review on your behalf. The email comes from your company, carries your logo and your button colour, and says nothing about FieldQuo. It is short on purpose: one line of thanks, one button, a way to complain to you instead of in public.",
      "It is sent **once, ever, per job** — never twice, never to someone who unsubscribed, never for a job finished more than 30 days ago.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The request is off until you paste a review link and switch **Ask automatically** on under **Settings → Reviews**. From then on, every job that reaches **Completed** is checked once an hour: when the delay you chose has passed and the client has an email address, the message goes out." },
          { figure: "live:app-settings-reviews", caption: "Settings → Reviews — Your review link, the Ask automatically switch, and the Reviews on your website card underneath." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "What the client receives",
        blocks: [
          { bullets: [
            "Subject: **How did we do? — [Your company]**, sent from your company's sender.",
            "Your logo (or your company name), then “Hi [first name],” and one sentence: thanks for having you out, a quick review would mean a lot.",
            "A **How did we do?** row of five numbered chips, 1 to 5. Tapping one opens a small page on your stationery where the score is pre-selected and the client can add an optional comment and press Send. Nothing is recorded until they press it.",
            "A **Leave a review** button in your brand colour that opens your review link (usually Google), and “Takes about a minute.”",
            "A footer line: if something wasn't right, reply to this email instead and the company will put it straight — replies come to your company's email address.",
            "An unsubscribe link, because asking for a public review is a commercial message under Canadian anti-spam law.",
          ] },
          { note: "The email exists in English and French. A client whose language is anything else receives the English version. The rating page under the chips is written in all eight client languages." },
        ],
      },
      {
        id: "the-rules",
        heading: "When it is sent, and when it is not",
        blocks: [
          { table: {
            head: ["Condition", "What happens"],
            rows: [
              ["The job has already been asked about", "Never asked again — this is checked before anything else, even if two people press things at once."],
              ["No review link, or Ask automatically is off", "Nothing is sent."],
              ["The job is not Completed, or FieldQuo does not know when it finished", "Nothing is sent. A job completed before completion dates were recorded is left alone rather than guessed at."],
              ["The client has no email address", "Nothing is sent — there is no text-message review request."],
              ["The client unsubscribed", "Skipped."],
              ["The delay has not passed yet", "Waits. The delay is the chip you picked: 2 hours later, 4 hours later, The next day, Two days later, Three days later, A week later."],
              ["The job finished more than 30 days ago", "Never asked. Switching the feature on today does not email every customer you had last year."],
            ],
          } },
          { warning: "The claim is written before the email is sent. If the send then fails, that client is never asked again — that is the safer failure. Not asking costs a review; asking twice costs the relationship." },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { steps: [
            "Open **Settings → Reviews** and paste your link into **Your review link** — usually the short “Ask for reviews” link from your Google Business Profile, but any http or https page works. Press **Save**, then use **Open it and check it goes where you expect**.",
            "Switch **Ask automatically** on. Until a valid link is saved the switch is disabled and reads “Add your review link above first.”",
            "Pick a chip under **When to ask**. The default is the next day.",
            "Read the queue line under it — how many customers are in the queue and how many have been asked in the last 30 days — to see it working.",
          ] },
          { p: "The scores from the 1–5 row feed the **Customer satisfaction** tile on **KPIs**. The reviews clients leave on Google stay on Google; to show them on your website, paste them into **Reviews on your website** on the same screen — see [[testimonials-on-your-website|Testimonials on your website]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can change it",
        blocks: [
          { p: "**Settings → Reviews** needs the Manager level or above — an owner, an administrator, a Manager or a Dispatcher. The request itself is sent by FieldQuo on a schedule; there is no Ask now button on a job, and nobody can send it twice." },
        ],
      },
    ],
    faq: [
      { q: "Can I send a review request by text?", a: "No. The request goes by email only, and only to a client with an email address on file." },
      { q: "Can I edit the wording?", a: "Not today. The email is one sentence and one button in your colours; the only things you set are the link and the delay." },
      { q: "A client replied to the email — where did it go?", a: "To your company's email address, the same reply-to as your quotes. Replies never reach FieldQuo." },
      { q: "We switched it on and nothing was sent for last month's jobs.", a: "By design. A job finished more than 30 days ago is never asked about, and only jobs that reach Completed from now on are considered." },
    ],
  },

  "the-referral-page": {
    title: "The referral page",
    summary:
      "The page another business owner lands on when you share your Refer & Earn link — who it is for, what it promises, what it says about you, and the one place FieldQuo's own name is meant to appear.",
    updated: "2026-09-12",
    intro: [
      "Your referral link is not for homeowners. It is for **another business** — the electrician you share jobs with, the painter who asked what software you use. The page it opens says that you use FieldQuo, offers them a free month on top of the trial, and sends them to the signup form with your name attached.",
      "That makes it the exception to the white-label rule, on purpose: a page whose whole point is to say “this contractor uses FieldQuo — you could too” cannot hide the name. Your logo and colour are on it as the referrer, and FieldQuo's are on it as the product.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The link is short — your company name with the spaces and punctuation removed, so it can be read aloud, printed on a business card or painted on a van. It is case-insensitive. Your **Refer & Earn** screen shows it under **Your link** with a **Copy** button." },
          { figure: "live:app-settings-refer", caption: "Refer & Earn — the company's link with Copy, Send an invite by email or text, then the months earned, the businesses referred and the invites sent." },
        ],
      },
      {
        id: "what-the-visitor-sees",
        heading: "What the visitor sees",
        blocks: [
          { bullets: [
            "Your logo — or, without one, your initial on your brand colour — over the line “[Your company] uses FieldQuo”.",
            "The headline **Get your first month free**, a one-paragraph description of FieldQuo, and a **Claim your first month free** button that opens the signup form with your referral code attached.",
            "Under the button: “No card charged during your trial. Cancel any time.” Then three bullets on what the product does.",
            "A footer that says the quiet part: “For businesses new to FieldQuo. Already have an account? Sign in.” — an existing company cannot redeem an offer.",
          ] },
          { p: "The page is server-rendered so it is readable in the first half-second on one bar of signal, and it carries a link preview (title and description) because it gets pasted into WhatsApp and Facebook groups where the preview card is the pitch." },
        ],
      },
      {
        id: "what-it-promises",
        heading: "What it promises, exactly",
        blocks: [
          { table: {
            head: ["Who", "What they get", "When"],
            rows: [
              ["The business you referred", "**1 extra free month** added to their trial", "At signup, the moment they use your link"],
              ["You", "**1 free month** added to your own access", "When the referred company makes its first payment — not at signup"],
            ],
          } },
          { p: "Both sides get the same thing — a month of FieldQuo — whatever the size of the business you refer. Your month lands on their first payment rather than their signup so that twenty throwaway signups cannot earn a free year; the cap is 50 credited referrals per calendar month." },
          { note: "The link does nothing for a company that already has an account, and you cannot refer yourself. The page tells them so before they fill anything in." },
        ],
      },
      {
        id: "sending-it",
        heading: "How to send it",
        blocks: [
          { steps: [
            "Open **Refer & Earn** (in the sidebar, or **Settings → Refer & Earn** — the same screen).",
            "Press **Copy** next to **Your link** and paste it anywhere, or **Text it** on a phone to open your own messaging app with the invite written.",
            "Or use **Send an invite** with **Their email** or **Their mobile number** and an optional name, then **Send invite**. FieldQuo sends one message and never follows up; up to 20 invites a day.",
            "Watch **Businesses you've referred**: each one reads **Signed up — not yet paying** until their first payment, then **Credited**, and your month appears under the count at the top.",
          ] },
          { warning: "An invite sent from this screen is a **FieldQuo** email or text — FieldQuo's header, FieldQuo's sender — saying that your company uses the product. It is the one message in the product that is not on your stationery, because it is about FieldQuo, not about your work." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The landing page is public. **Refer & Earn** is owner and administrator only — it lists which businesses were referred and what was credited, which is billing information. A Manager does not see the row." },
        ],
      },
    ],
    faq: [
      { q: "Is this for my homeowner clients?", a: "No. It is a business-to-business referral to FieldQuo. For what FieldQuo does and does not do about clients referring clients, see [[referrals-from-clients|Referrals from clients]]." },
      { q: "Why does the page say FieldQuo when nothing else does?", a: "Because its purpose is to recommend FieldQuo. Every quote, invoice, page and email your clients see carries your name; this page is addressed to another contractor and is about the software." },
      { q: "When do I get my free month?", a: "When the business you referred makes its first payment. Until then the row reads Signed up — not yet paying. Details: [[referral-months|Referral months]]." },
    ],
  },

  "your-website-as-a-visitor": {
    title: "Your website",
    summary:
      "What a visitor sees on your FieldQuo-hosted site: your pages, your hours, your services read live from Settings, Get a quote and Book buttons that stay on your address, and the one footer line only a free site carries.",
    updated: "2026-09-12",
    intro: [
      "Your website lives at your own subdomain — **yourcompany.fieldquo.com** — and is the one client-facing page in FieldQuo that is meant to be found by Google. Everything on it is yours: the logo, the colour, the wording, the photos your crews took. The only FieldQuo mention anywhere is a small **Site by FieldQuo** line in the footer, and that line is on **free** sites only.",
      "It is rendered on the server in one request and works with JavaScript switched off, because a stranger on a bad connection in a driveway is exactly who it is for.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Nothing is public until you press **Publish** on **Settings → Your website**. An unpublished site is a not-found page for a visitor and a **Draft preview** for a signed-in member of your company — the amber bar at the top says so, and search engines are told not to index it." },
          { figure: "harness:client-website", caption: "A published site as a visitor sees it — the company's name, an Open · closes pill from its opening hours, the page menu, a language switcher, the phone number, and the Get a quote button." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "What is on the page",
        blocks: [
          { bullets: [
            "**The header**: your logo or name, an **Open · closes …** / **Closed · opens …** pill computed from the opening hours in **Company Settings** (absent if you set none), the page menu, a language switcher when the site has more than one language, your phone number, and a **Get a quote** button.",
            "**The pages**: Home, Services, Our Work, About, Book, Get a quote and Contact, each built from sections — header, services, before-and-after, gallery, testimonials, FAQ, process, credentials, service areas, hours, contact, a call to action.",
            "**Services** are read from **Settings → Services & Pricing** on every request: switch a trade on and it appears; switch one off and it disappears. The blurbs are kept, the list is live.",
            "**Gallery** and **before-and-after** sections you left empty fill themselves with recent job photos and two-photo visits from your jobs; anything you curated yourself always wins.",
            "**Testimonials** are the ones you switched on under **Settings → Reviews** — the first six.",
            "**Get a quote** is your self-quote form rendered inside the page, and **Book** is your booking calendar. Both keep the visitor on your address; nothing sends them to fieldquo.com.",
            "**The footer**: your logo, © and your name — and, on a free site only, “Site by FieldQuo”.",
          ] },
          { note: "Search engines also receive a structured “LocalBusiness” record — name, phone, email, address and opening hours — which is what puts “Open ⋅ Closes 5 PM” in a Google result. Hours are included only when you set them; an empty week is never invented." },
        ],
      },
      {
        id: "languages",
        heading: "Languages",
        blocks: [
          { p: "The first language is the primary and lives at the root address; every other language lives at **/fr**, **/es** and so on, with a switcher in the header. Adding a language under **Languages** writes the whole site in it — it is not a machine translation of the page — and each language carries its own title and description for search engines. A language you have not enabled is a not-found page, not a silent fallback to English." },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control, and from where",
        blocks: [
          { table: {
            head: ["Control", "What the visitor sees change"],
            rows: [
              ["Publish / Unpublish (Settings → Your website)", "The site appears or, on Unpublish, shows a not-published page straight away; nothing is deleted and Publish puts the same site back."],
              ["Web address", "The subdomain. Reserved names (app, www, api and the like) cannot be taken — they are a security boundary, not a naming preference."],
              ["Sections and the conversation pane", "The wording of each section. Rebuilding rewrites the words you edited; photos, pairs, logo and colours are kept."],
              ["Settings → Branding", "Logo and colours across the whole site, with contrast measured."],
              ["Company Settings", "Phone, email, address, opening hours and work areas — read live, never retyped into the site."],
              ["Settings → Services & Pricing", "The services list, live."],
              ["Settings → Reviews", "Which testimonials show."],
              ["Your plan", "A company on a free plan, or whose subscription has lapsed, shows the Site by FieldQuo footer line; a paying company — trial included — does not."],
            ],
          } },
          { p: "FieldQuo does not offer a custom domain today: the site is served at your fieldquo.com subdomain. If you own a domain, the bio link and Share your links can point at it, and the reviews embed can sit on a site you already have." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can change it",
        blocks: [
          { p: "The published site is public and indexed. The builder at **Settings → Your website** — publishing, unpublishing, the address, the languages — is owner and administrator only." },
        ],
      },
    ],
    faq: [
      { q: "Does the site say FieldQuo anywhere?", a: "Only the “Site by FieldQuo” footer line, and only on a free site or one whose subscription has lapsed. A paying company's site carries no FieldQuo mention at all." },
      { q: "Can I use my own domain?", a: "Not today. The site lives at yourcompany.fieldquo.com. See [[your-website-address|Your website address]]." },
      { q: "I added a service in Settings — do I need to rebuild the site?", a: "No. The services section reads your enabled services on every visit. The same goes for hours, phone, address and work areas." },
      { q: "Where do the photos come from?", a: "Photos you uploaded in the builder first; otherwise recent job photos from your crews fill an empty gallery automatically. Stock photos are Unsplash images hotlinked, not copied — see [[stock-photos-on-your-website|Stock photos on your website]]." },
    ],
  },

  "the-kitchen-design-link": {
    title: "The kitchen design link",
    summary:
      "The page a client opens to move cabinets and try finishes on the kitchen you quoted — no prices, their version saved beside yours, and an email to you when they save.",
    updated: "2026-09-12",
    intro: [
      "For a cabinet job you drew in the kitchen designer, the client can be handed a link to their own copy of the drawing. They see your name and logo, the quote number and their name, a plan they can drag pieces around on, and a **Colours & finishes** panel. They cannot see a rate, and nothing they do changes a number on its own.",
      "When they press **Save my version**, their layout is stored beside yours — never over it — and the quote's creator plus your owners and administrators get an email saying so. You open the designer, compare, and decide.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The link is the quote's share token — the same credential as the approval page — so it exists once the quote has been sent. On the quote's **Kitchen designer** screen the **Client link** button copies it; before sending, the screen reads “Send the quote to get a client design link”." },
          { figure: "harness:client-kitchen-design", caption: "The client's view — the company's name, the quote number and the client's name, “Your kitchen”, the room tabs and wall dimensions, the piece palette, the plan, and Save my version." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "What the client sees",
        blocks: [
          { bullets: [
            "A header with your logo (or name) on the left and **Quote [number]** with their name on the right. The footer is your company name. Nothing on the page says FieldQuo.",
            "**Your kitchen** — “Move things around and try different finishes. When you save, [Your company] gets your version and will confirm the price.”",
            "The room tabs (Kitchen, Laundry, Closet), each wall's length and height, the views (Plan, Back, Right, Front, Left, Island Layout) and **Colours & finishes**.",
            "The piece palette — base, upper, tall, corner, appliance and opening pieces — and the plan itself: “Tap a piece to select, then drag. Boxes snap flush to walls, corners & each other.”",
            "A **Save my version** button in your colour. After saving: “Saved. [Your company] has been told, and will get back to you with an updated price if anything changed.”",
          ] },
          { note: "The page is always light, like the quote itself, and it is English-only today — a client holding a French quote gets an English designer. It is not indexed by search engines." },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "What they cannot do",
        blocks: [
          { bullets: [
            "**See a price.** The pricing panel you use is hidden, and the data the page loads has every rate and appliance price stripped out — rebuilt field by field, not filtered.",
            "**Change a price.** Whatever comes back is merged over your drawing: the room, appliance pricing and your rate card are re-attached from your copy, and any number the browser sent is discarded.",
            "**Overwrite your drawing.** Their version is stored in its own field, with the date. Your layout is untouched until you choose **Load their version**.",
            "**Edit a closed quote.** Once the quote is accepted or declined the page reads “This is the layout on your quote” and the button is gone.",
          ] },
        ],
      },
      {
        id: "on-your-side",
        heading: "On your side",
        blocks: [
          { steps: [
            "Open the quote and press **Kitchen designer**. Draw the room, then send the quote — the **Client link** button becomes active.",
            "Press **Client link** to copy it and paste it into a message to the client.",
            "When they save, the email **Client design saved — [quote number]** reaches the quote's creator and every owner and administrator, with a link to the designer.",
            "On the designer, the banner **Your client saved their own version of this layout on [date]** offers **Load their version**. Load it, then **Save & reprice quote** — the server reprices from your rates.",
          ] },
          { warning: "A sent quote's design is read-only on your side — the screen says so. Duplicate the quote to change it; a sent quote is a commitment, and repricing one underneath the client leaves you both looking at different numbers." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The client page is public to anyone holding the link. The **Kitchen designer** button appears on a quote when your company has **Kitchen Design & New Installs** switched on under Services, or when the quote already carries a design; opening it needs edit access to quotes. A separate public designer — **Design your kitchen** on Share your links — lets a stranger draw a kitchen and send it as a lead; see [[the-kitchen-designer|The kitchen designer]]." },
        ],
      },
    ],
    faq: [
      { q: "Does the client's save change my quote total?", a: "No. Their layout is stored separately. The total changes only when you load their version and press Save & reprice quote." },
      { q: "Can the client see what each cabinet costs?", a: "No. The page never receives a rate; they already have their total on the quote itself." },
      { q: "The client says the link isn't working.", a: "The link is tied to the sent quote. If the quote was accepted or declined it is read-only; if it was deleted the page says so and asks them to reply to the email their quote came in." },
    ],
  },

  "the-bio-link-page": {
    title: "The bio link page",
    summary:
      "The one page behind the single link Instagram and TikTok allow: your logo, a heading, your handles, and a button for everything you offer — with a small Made by FieldQuo line in the footer.",
    updated: "2026-09-12",
    intro: [
      "Your bio link is a short address — **fieldquo.com/l/yourcompany** — that opens one page listing everywhere you can send a visitor: get a price, book a visit, your website, call, email, leave a review. It is built for a phone screen and it follows the phone's light or dark setting.",
      "Everything above the footer is yours: logo, colour, wording, order. The footer carries a muted **Made by FieldQuo** link beside the copyright line — the owner's decision, because a link menu is not a document the client reads as coming from you, and every menu of this kind carries its maker's name.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is off until you switch **Page is live** on under **Settings → Bio link**; until then the address shows a not-found page. It is deliberately not indexed by search engines — a search result showing fieldquo.com under your name would tell a homeowner which software you use, and the page's traffic comes from a bio, not from a search." },
          { figure: "harness:client-bio-link", caption: "The bio link page — the company's initial on its brand colour, the heading, the website line, the bio, two social icons, then buttons grouped under Book, More and Contact." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "What is on the page",
        blocks: [
          { bullets: [
            "Your logo, or your initial on your brand colour.",
            "The **Heading** — your company name unless you wrote one — and, under it, your own website domain as a caption when you entered one in Company Settings. (Your hosted fieldquo.com site is never printed there: that would be the leak the white-label rule exists to prevent.)",
            "**One line under it** — the bio, only if you wrote one. FieldQuo does not invent one.",
            "**Follow us** — a row of circular icons for the handles you entered: Instagram, Facebook, TikTok, YouTube, LinkedIn, X.",
            "The buttons, in your order, grouped under **Get a price**, **Book**, **More** and **Contact**, each opening in a new tab.",
          ] },
        ],
      },
      {
        id: "the-buttons",
        heading: "Which buttons exist, and why some are missing",
        blocks: [
          { table: {
            head: ["Button", "Appears when"],
            rows: [
              ["Get an instant price", "At least one trade is on under Settings → Instant Quotes."],
              ["Get a free quote", "Always — your self-quote form."],
              ["Design your kitchen", "Kitchen Design & New Installs is on under Services."],
              ["Book a visit", "You have at least one active event type on the Booking Page."],
              ["One button per published funnel", "The funnel's status is Published; the label is the funnel's name."],
              ["Visit our website", "You entered a website in Company Settings, or your FieldQuo site is published — your own domain wins."],
              ["Call · Email us", "A phone number or email is on your company record."],
              ["Message on WhatsApp", "A phone number is on file — off by default; switch it on."],
              ["Leave a review", "A review link is saved under Settings → Reviews."],
              ["Your own links", "Up to 10 rows you add with Add your own link — text, URL and an icon."],
            ],
          } },
          { note: "The settings screen shows the rows that are not available too, greyed, with the screen that would create them — so a missing Book a visit reads as a next step, not a bug. Every internal button uses the same slug as your booking page, so a company with a custom booking address gets one address for everything." },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { steps: [
            "Open **Settings → Bio link**. **Your link** sits at the top with Copy and Open — “Paste this into your Instagram or TikTok bio.”",
            "Write a **Heading** and **One line under it**, and fill in the **Follow us** handles you have.",
            "Under **What's on the page**, switch rows on or off with **Show on the page**, rename their button text, and reorder them by dragging or with Move up / Move down. Add your own with **Add your own link**.",
            "Check the phone-frame **Preview** in light and dark, switch **Page is live** on, and press **Save** — nothing is published until you do.",
          ] },
          { p: "The page is written in your company's language. There is no language switcher on it." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can change it",
        blocks: [
          { p: "The page is public once live. **Settings → Bio link** needs the Manager level or above — an owner, an administrator, a Manager or a Dispatcher." },
        ],
      },
    ],
    faq: [
      { q: "Can I remove Made by FieldQuo from the footer?", a: "No. It is the one line on the page that is not yours, held to the same muted contrast as the copyright line. Everything above it is." },
      { q: "Why is there no Book a visit button?", a: "You have no active event type. Create one on Settings → Booking Page and the row appears, switched on." },
      { q: "Does the page show my fieldquo.com website address?", a: "Only as a Visit our website button, and only when you have not entered your own domain. The caption under the heading never prints a fieldquo.com address." },
    ],
  },

  "a-funnel-as-a-visitor": {
    title: "A funnel",
    summary:
      "What someone who taps your ad or bio link sees: a full-screen, one-question-at-a-time page in your colour, an optional instant range, a short contact form — and, on your side, a scored lead.",
    updated: "2026-09-12",
    intro: [
      "A funnel is a tap-through landing page for an ad, a flyer QR code or your bio link. The visitor sees your brand colour edge to edge, your logo and name, a progress line, and one step at a time — the Instagram-Stories shape mobile ad traffic expects. There is no menu, no footer and nothing that says FieldQuo; the browser tab carries your company name.",
      "At the end they leave a name and an email or phone, and a **Hot**, **Warm** or **Cold** lead lands on your Leads board with every answer attached.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Funnels are built on the **Funnels** screen — from a channel template (Web, Instagram, TikTok, YouTube) or from a sentence you type into the generator — and each one has a status, **Draft** or **Published**. Only a published funnel answers at its address; a draft, or a wrong address, shows “This funnel isn't available.” The link and an embed snippet for each published funnel are on **Settings → Share your links**." },
          { figure: "harness:client-funnel", caption: "A funnel mid-way — the brand colour full screen, the progress line, the company's monogram and name, Back, and a single-choice question card." },
        ],
      },
      {
        id: "the-steps",
        heading: "The steps a visitor can meet",
        blocks: [
          { table: {
            head: ["Step", "What the visitor sees"],
            rows: [
              ["Intro", "A headline, a line of text and a button — Get started unless you named it."],
              ["Single choice", "A question and a list of answers; one tap moves on. An answer can branch to a later step."],
              ["Multiple choice", "Tick several, then Continue."],
              ["Photo upload", "Add photos or a short video of the job, then Continue."],
              ["Instant estimate", "Size bands; tapping one shows a price range the server worked out from your rates — or, if the step is set to details-first, the range is revealed after the form. If your trade is set to show the range only after they submit, it is withheld until then."],
              ["Form", "“Where should we send it?” — name, email, phone. A name and one of email or phone are required."],
              ["Thank you", "Your closing headline and text, or a plain “Thanks!”."],
            ],
          } },
          { note: "The words on every step are yours — written in the builder or drafted by the generator — so the funnel is in whatever language you wrote it in. The built-in bits (the Back link and the form's Your name / Email / Phone placeholders) are English." },
        ],
      },
      {
        id: "what-happens-on-submit",
        heading: "What happens when they submit",
        blocks: [
          { bullets: [
            "A lead is created in the normal pipeline — not a special kind — with the source **funnel**, every answer as a structured field, the photos, and a message line per question.",
            "A question you tagged as **budget** or **timeline** in the builder feeds the scorer directly; the lead reads Hot, Warm or Cold on **Leads** like any other. See [[lead-scoring-hot-warm-cold|Lead scoring]].",
            "The people who get lead notifications are told. A phone number is recorded as consent to be called back.",
            "If you entered a Meta pixel, a TikTok pixel or a GA4 id in the builder, the page fires a page view on load and a lead event only **after** the server accepted the submission — never for a refused one.",
            "A step-view beacon is recorded as each step is reached, which is what the builder's drop-off report counts. It is anonymous — a per-visit id, not a person.",
          ] },
          { p: "FieldQuo does not email the visitor a copy of what they sent, and the funnel shows no price unless it has an instant-estimate step. Nothing here reprices anything: an instant range comes from your rates on the server and is marked as needing review before a quote goes out." },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { steps: [
            "On **Funnels**, press **New funnel** and pick a channel template or describe the funnel and press **Generate**.",
            "In the builder, edit each step's words and answers, tag the budget and timeline questions, set an instant-estimate step to price-first or details-first, and add your pixel ids.",
            "Publish it. Copy its link from the builder or from **Settings → Share your links**; the bio link page gets a button for it automatically.",
            "Come back to the builder for the drop-off report — how many reached each step and where they left.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "A published funnel is public to anyone with the link, and deliberately not indexed. The **Funnels** screen is for owners, administrators, Managers and Dispatchers; on **Share your links**, other people see “Lead funnels are managed by an owner or admin — ask one of them for the link.” The leads are visible to anyone whose access includes Requests." },
        ],
      },
    ],
    faq: [
      { q: "Does the funnel show my prices?", a: "Only if you added an instant-estimate step, and then only a range computed on the server from your rates — never the rate card. Every such estimate is flagged for your review before a quote is sent." },
      { q: "Can I put a funnel on my existing website?", a: "Yes — Share your links has an embed snippet for each published funnel. Inside your own page the logo strip is dropped, since your site already carries your name." },
      { q: "Where do the answers go?", a: "Onto the lead on Leads, as fields you can read and as a note per question, with the photos attached. Convert it to a quote from there." },
    ],
  },

  "the-texts-clients-receive": {
    title: "The texts clients receive",
    summary:
      "The two automated texts a client can get — On my way and an appointment reminder — what they say, in which language, from which number, how STOP works, and everything FieldQuo does not text.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo sends a client exactly two kinds of text message: **On my way**, when a crew member taps that status on a job visit, and an **appointment reminder** before a booked appointment or a scheduled job visit. Both open with your company name, both go out in the client's language, and both respect a STOP reply. That is the whole list — quotes, invoices, booking confirmations and review requests go by email.",
      "Reminders are off until you choose a lead time under **Settings → Notifications**. Nothing is billed per text.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Each text leaves from your company's own texting number if you have one, otherwise from a shared FieldQuo number — which is why every message starts with your company name: on a shared line the name in the body is what tells the client who is texting. Nothing in the message says FieldQuo." },
          { figure: "live:app-settings-messages", caption: "Settings → Client messages — one editor per text type, the token chips it accepts, a “Your client sees:” preview, and Save." },
          { note: "**Appointment reminders** is marked partial in FieldQuo's own feature list: reminders go by text message only — there is no email reminder. The wording of both texts is editable on Settings → Client messages." },
        ],
      },
      {
        id: "the-two-texts",
        heading: "The two texts",
        blocks: [
          { table: {
            head: ["Text", "Built-in wording (English)", "When it is sent"],
            rows: [
              ["On my way", "“[Company]: [Worker] is on the way, ETA 20 min. To reschedule, call [phone].”", "The moment a crew member sets a job visit to On my way. The ETA is worked out from where their phone was when they tapped to the job's address, rounded up to five minutes, and left out when either end is unknown. The phone line is dropped if your company has no phone on file."],
              ["Appointment reminder", "“[Company]: Reminder — your appointment is Tue, Sep 15, 2:00 PM at 123 Oak St. Reply STOP to opt out.”", "Once, inside the lead time you chose (2, 24 or 48 hours before), for a booked appointment or a scheduled job visit that is not cancelled or completed. Checked hourly."],
            ],
          } },
          { p: "The time in a reminder is written in your company's time zone and the client's own date format. “Reply STOP to opt out” stays in English in every language, because STOP is the keyword carriers and the inbound handler recognise." },
          { warning: "Replies to these texts are not read by anyone. The on-my-way text points at your phone number for a reason: a client who texts back “can we do 3 instead?” is talking to nobody. Only STOP and START are acted on." },
        ],
      },
      {
        id: "language",
        heading: "Which language a client gets",
        blocks: [
          { p: "The text follows the client's language the way their quote did — the eight client languages FieldQuo writes documents in (English, French, Spanish, Ukrainian, Punjabi, Tagalog, German, Italian); anything else reads English. If you rewrote a message on **Settings → Client messages**, your wording goes to clients who read your company's language; a client whose language is different gets FieldQuo's built-in wording in theirs. FieldQuo does not machine-translate your sentence." },
        ],
      },
      {
        id: "stop-and-start",
        heading: "STOP, and starting again",
        blocks: [
          { bullets: [
            "A reply of **STOP** (or STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT — a trailing full stop or exclamation mark is ignored) opts that phone number out. Neither text is sent to it again, and a number that opted out of calls is refused texts too.",
            "**START** or **UNSTOP** reverses the text opt-out. It never restores call consent, which is deliberately one-way.",
            "On the shared FieldQuo number, a STOP opts the number out of every company that holds it on a client record — the only honest reading of “stop texting me” sent to a line that texts for many.",
            "The gate is checked at the moment of every send, for both texts, from one place.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "What you control",
        blocks: [
          { steps: [
            "Open **Settings → Notifications → Appointment reminders** and pick **Off**, **2 hours before**, **24 hours before** or **48 hours before**. Off is the default; a company that never chose a lead time sends no reminders.",
            "Open **Settings → Client messages** to reword either text. Only the chips shown work — {company}, {worker}, {name}, {eta}, {phone} for On my way; {company}, {when}, {location} for the reminder. An unknown token is refused at Save, and a message past 320 characters is flagged because it costs three segments.",
            "Read **Your client sees:** under the editor — it is the exact string that will go out — then **Save**, or **Use default** to return to FieldQuo's wording.",
          ] },
          { p: "A crew member sends On my way from the job visit on their phone; nobody has to remember to text. There is no button to send a reminder by hand, and a visit is reminded at most once." },
        ],
      },
      {
        id: "what-is-not-texted",
        heading: "What FieldQuo does not text",
        blocks: [
          { bullets: [
            "A booking confirmation — that goes by email, from your company, when a visit is booked on your booking page.",
            "A quote, an invoice, an overdue-invoice chase or a “your job is complete” message — email only.",
            "A review request — email only, and only to a client with an email address.",
            "A text from the phone receptionist — it reads a booking link out loud; it cannot text it today.",
          ] },
          { p: "Full detail on what is and is not automated: [[texting-clients-what-is-and-is-not-automated|Texting clients: what is automated and what is not]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can change it",
        blocks: [
          { p: "**Settings → Notifications** is owner and administrator only. **Settings → Client messages** needs the Manager level or above — an owner, an administrator, a Manager or a Dispatcher. Any crew member assigned to a visit can trigger On my way from their phone." },
        ],
      },
    ],
    faq: [
      { q: "Does a text cost me anything?", a: "No. Client texts are included in your plan and nothing is billed per message. (The crew texting line and the phone receptionist are separate and metered.)" },
      { q: "Why did a client not get a reminder?", a: "One of: reminders are Off under Settings → Notifications; the client has no phone number; the appointment is cancelled or completed; it was already reminded once; or the number replied STOP." },
      { q: "Can the client reply to reschedule?", a: "Not by text — replies are not read. The on-my-way text gives your phone number for that; a visit booked on your booking page also has its own manage link by email." },
      { q: "Does the text come from my number?", a: "From your own texting number if your company has one; otherwise from a shared FieldQuo number, with your company name at the start of the message." },
    ],
  },
};
