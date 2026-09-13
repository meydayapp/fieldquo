// content/help/en/marketing-and-website-1.js
//
// Part 1 of the “marketing-and-website” category in English (see the
// composer, marketing-and-website.js). Slugs assigned to this part
// (lib/help/tree.js): the-website-builder, website-pages-and-blocks,
// your-website-address, the-site-by-fieldquo-footer, share-your-links,
// embed-booking-and-quote-forms, the-bio-link, funnels, build-a-funnel,
// marketing-campaigns.
//
// Every sentence is read from the code it describes: app/app/settings/website
// (Builder.js, SectionEditor.js) and app/api/settings/website, lib/site/*
// (pages, composition, siteStyles, subdomain), app/data/siteBlocks.js,
// lib/billing/access.js (the footer credit), app/app/settings/lead-form,
// lib/embed/snippet.js and app/embed, app/app/settings/links and lib/links,
// app/app/funnels and lib/funnels, app/app/marketing and
// app/api/marketing. The words on the screen are the `en` block of
// app/i18n/appMessages.js. Access levels come from lib/permissions.js,
// lib/permissions/nav.js and lib/permissions/settingsAccess.js.
export const ARTICLES = {
  "the-website-builder": {
    title: "The website builder",
    summary:
      "Describe how your site should feel, and FieldQuo writes it from the details you already entered — then Save, Publish, and change it by typing again.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Your website** builds a real website for your company on its own address. You do not fill in a form: you type one sentence about how the site should look and feel, and the builder writes the pages from what FieldQuo already knows — your name, logo, brand colour, services, opening hours, contact details, job photos and approved reviews. Nothing is public until you press **Publish**.",
      "This article is the whole screen: the first-run prompt, the conversation, the Layout and Style chips, Fine-tune, the Preview and Sections panes, and what Save, Publish and Update each do.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The builder is a conversation. On the left you tell it what to change (“Make it bolder”, “lead with reviews”, “shorter page”); on the right you see the live site exactly as a visitor will, because the preview is the real page, not a picture of it. The writing assistant writes sentences only. The list of sections, the service names and the testimonials come from your own data and are merged back after every rebuild, so the site can never describe a trade you do not offer or quote a review nobody left." },
          { p: "If the writing assistant is unreachable, the builder still produces a page — written plainly from your saved details — and says so in the thread. You get plainer words, never a broken site." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**First run** — a single box under **What should your website say?**, four example chips you can tap to fill it, a **Build my site** arrow, and the line **Nothing is public until you publish it.**",
            "**The bar** — your address (**yourname.fieldquo.com**), a **Live** badge once published, **Open**, **Save**, and **Publish** (which reads **Update** once the site is live).",
            "**The thread** — what you asked for and what was built. When something is missing, the assistant says so with a one-tap action: **Add photos**, **Pair them up**, **Add a logo**, **Add a review**, **Set hours**, **Choose services**.",
            "**Layout** and **Style** chips, the prompt box (**Make it bolder · lead with reviews · shorter page…**), and the **Fine-tune** disclosure with **Web address**, **Languages**, **Before & after pairs** and the reviews embed.",
            "**Preview | Sections** — the live site with a desktop / mobile toggle and a refresh button, or the Home page's sections as text fields you can reword by hand.",
          ] },
        ],
      },
      {
        id: "build-your-first-site",
        heading: "How to build your first site",
        blocks: [
          { steps: [
            "Open **Settings → Your website**. Under the Client-facing group of the settings menu.",
            "Describe the feel in one or two sentences — tone, what to lead with, whether people should book online — or tap an example chip. You do not need to type your name, phone or services.",
            "Press the arrow (**Build my site**). The thread reports what was built (“Rebuilt your site: … sections”) and the preview loads the saved draft.",
            "Answer what the assistant asks for: add job photos, pair before-and-after shots, add a logo under Branding, approve a review under Reviews. Each one makes a section possible that was left out before.",
            "Press **Publish**. The site goes live at your address; the bar shows **Live**.",
          ] },
          { figure: "live:app-settings-website", caption: "Settings → Your website on first run — one prompt, four example chips, and “Nothing is public until you publish it.”" },
          { note: "A prompt-driven build costs AI allowance from your plan's monthly quota; if the quota is used up the button says so instead of building. Picking a **Layout** or **Style** chip calls no model and is never blocked." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What happens"],
            rows: [
              ["Typing in the prompt box and pressing send", "Rewrites every heading and paragraph on every page to match what you asked. Photos, before-and-after pairs, logo and colours are kept. The result is saved at once, so the preview always shows it."],
              ["A **Layout** chip (Show the work first, Lead with services, Lead with reputation, Lead with booking, Short one-pager)", "Rearranges the same site into that shape. Your wording and photos carry over; no AI is used."],
              ["A **Style** chip (Modern, Bold, Minimal, Classic, Warm, Editorial, and more)", "Changes type, spacing and the way your brand colour is applied. Wording and photos carry over."],
              ["**Sections** pane", "Reword any heading or paragraph on the Home page by hand, choose a section's layout variant, add or remove a photo, **Hide** or **Show** a section. Your logo, colours, services, hours and contact details are not editable here — change them in company settings and the site updates."],
              ["**Save**", "Saves the draft. Once the site is live there is no separate draft: a saved change is what visitors see."],
              ["**Publish** / **Update**", "Makes the site public at your address, or re-confirms it. Needs a company that has finished signing up for a plan."],
              ["**Languages** (under Fine-tune)", "Adding a language writes the whole site in it — it is not machine-translated — and gives visitors a switcher in the header. Your main language is marked and cannot be removed."],
            ],
          } },
          { figure: "harness:settings-website", caption: "The builder with a live site — the address bar with Live, Open, Save and Update; the thread; Layout and Style chips; the prompt; Preview and Sections on the right." },
          { warning: "If you reworded sections by hand and then type a new prompt, the builder stops and asks: **This will rewrite the words you edited**. Choose **Keep what I wrote** or **Rebuild anyway**. Photos and pairs survive either way; typed headings and paragraphs do not." },
        ],
      },
      {
        id: "publishing",
        heading: "Publishing, stock photos and taking the site down",
        blocks: [
          { p: "When you have no photos yet the builder uses stock photography so the page is not empty — only as a background in the header and similar spots, never in **Our work**, because that section says the photos are jobs you did. Publishing with stock photos still on the page is allowed but never silent: a dialog counts them and offers **Add my photos** or **Publish anyway**." },
          { p: "There is no Unpublish button on this screen today. Once a site is live it stays live; you can hide sections or rewrite them, and the address keeps answering. FieldQuo does not take a published site down from the builder." },
        ],
      },
      {
        id: "what-is-different",
        heading: "What this builder does that a website template does not",
        blocks: [
          { bullets: [
            "It is written from what you already told FieldQuo — services, hours, reviews, job photos — and stays in step with them: change your phone number in **Company Settings** and the site changes.",
            "The booking calendar, the quote request form and the instant estimate are sections of the site, not links out to another product. A visitor books a real slot from your availability and the request lands on your **Leads** board.",
            "The layouts are a closed set that was designed and checked on a phone. The assistant picks from them; it never emits a style rule, so a rebuild cannot produce a page that is broken on mobile or unreadable against your brand colour.",
            "It is included on every plan, and a paid company's site carries no FieldQuo name anywhere — see [[the-site-by-fieldquo-footer|The “Site by FieldQuo” footer]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The screen and its saves are open to owners, administrators, Dispatchers and Managers. Estimators and Crew do not see the row and the page refuses them. Adding or removing a site language is owner-and-administrator only. Publishing also needs a company that has finished checkout — a trial that never added a card can build the site but not put it in front of the public." },
        ],
      },
    ],
    faq: [
      { q: "Will a rebuild delete my photos?", a: "No. A rebuild rewrites words only; job photos, before-and-after pairs, your logo and colours are carried across every time. Only text you typed by hand in the Sections pane is replaced, and the builder asks first." },
      { q: "Can I edit the site without the AI?", a: "Yes. The Layout and Style chips and the Sections pane use no model at all, and they work even when the writing assistant is unavailable or your monthly allowance is spent." },
      { q: "Does the preview show what visitors see?", a: "Exactly that — the preview is the real page rendered with a preview flag that only a signed-in member of your company can use. A stranger who guesses the address of an unpublished site gets a not-found page." },
      { q: "Is the site translated automatically?", a: "No. Adding a language under Fine-tune writes a full version of the site in that language and adds a switcher; nothing is machine-translated at view time. Eight languages are available: English, French, Spanish, Ukrainian, Punjabi, Tagalog, German and Italian." },
    ],
  },

  "website-pages-and-blocks": {
    title: "Website pages and blocks",
    summary:
      "The pages a FieldQuo site can have, the fifteen kinds of section that go on them, which ones you can reword by hand, and which are drawn from your company record.",
    updated: "2026-09-12",
    intro: [
      "A FieldQuo site is a list of pages, and each page is a list of sections (blocks). The builder decides which pages and sections your site gets from your data; you can reword the Home page's sections by hand, hide the ones you do not want, and pick a different layout for any of them. This article names every page and every block so you know what is possible before you ask for it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every site built by the current builder is multi-page: a **Home** page plus the pages the catalogue allows, each with its own sections and a place in the header menu. A section is either **written** (a heading and a paragraph the assistant wrote and you can edit) or **derived** (rendered from your company record — the booking calendar, the quote form, opening hours, areas served — and not editable as text). A section the site has no data for is left out rather than padded: a gallery heading with no photos, or a testimonials strip with no approved review, is never published." },
        ],
      },
      {
        id: "the-pages",
        heading: "The pages",
        blocks: [
          { table: {
            head: ["Page", "In the menu as", "Default sections"],
            rows: [
              ["Home", "Home", "Header, What we do, Before & after, Call to action band, Get in touch"],
              ["Services", "Services", "Header, What we do, How it works, FAQ, Call to action band"],
              ["Work", "Our Work", "Header, Our work, Before & after, What clients say, Call to action band"],
              ["About", "About", "Header, About us, Credentials & numbers, Areas we serve, Call to action band"],
              ["Book", "Book", "Header, Book a visit (calendar), Opening hours"],
              ["Quote", "Get a quote", "Header, Request a quote (form)"],
              ["Contact", "Contact", "Header, Get in touch, Opening hours, Areas we serve"],
            ],
          } },
          { p: "Home is always first and always in the menu. A page whose sections have nothing to show — a FAQ with no items, a gallery with no photos — drops out of the menu on its own. The preview pane shows a tab per page so you can check each one before publishing." },
        ],
      },
      {
        id: "the-sections",
        heading: "The fifteen kinds of section",
        blocks: [
          { table: {
            head: ["Section", "What you can edit", "Where the rest comes from"],
            rows: [
              ["Header", "Headline, subhead, button label; seven layout variants", "Always first; cannot be hidden"],
              ["What we do", "Heading, intro", "Your enabled services"],
              ["About us", "Heading, body", "—"],
              ["Our work", "Heading, intro; add or remove photos", "Recent job photos"],
              ["What clients say", "Heading", "Approved testimonials under Settings → Reviews"],
              ["FAQ", "Heading; the questions and answers", "—"],
              ["Request a quote (form)", "Heading, intro", "The self-quote form for your enabled services"],
              ["Book a visit (calendar)", "Heading, intro", "Your booking page and real availability"],
              ["Opening hours", "Heading, note", "Company opening hours"],
              ["Get in touch", "Heading, intro", "Phone, email and address from Company Settings"],
              ["Before & after", "Heading, intro; the pairs", "Pairs you confirmed under Fine-tune"],
              ["How it works", "Heading, intro; the steps", "—"],
              ["Areas we serve", "Heading, intro", "Your work areas"],
              ["Credentials & numbers", "Heading, intro; the items", "—"],
              ["Call to action band", "Heading, sub, button label", "—"],
            ],
          } },
        ],
      },
      {
        id: "edit-a-section",
        heading: "How to reword or hide a section",
        blocks: [
          { steps: [
            "Open **Settings → Your website** and switch the right-hand pane from **Preview** to **Sections**.",
            "Find the section by its name (the names above) and type in its fields. Headings, paragraphs and list items are plain text; the layout chips under the name switch the variant.",
            "Press **Hide** on a section you do not want; **Show** brings it back. The Header cannot be hidden.",
            "Press **Save**. The preview reloads with your words.",
          ] },
          { figure: "harness:settings-website", caption: "The builder — the Preview | Sections toggle at the top of the right-hand pane opens the section editor." },
          { note: "The Sections pane edits the **Home** page. The other pages are rewritten by the assistant when you type a prompt, and re-laid-out when you pick a Layout chip." },
        ],
      },
      {
        id: "layouts-and-styles",
        heading: "Layouts, styles and variants",
        blocks: [
          { p: "Three things decide how a page looks, and all three are closed sets that were designed and checked on a phone — the assistant chooses among them and never writes a style rule of its own." },
          { bullets: [
            "**Layout** — the order and choice of sections: Show the work first, Lead with services, Lead with reputation, Lead with booking, Short one-pager. A layout that needs data you do not have (a review, a photo) is offered once you have it.",
            "**Style** — type, spacing and colour treatment: Modern, Bold, Minimal, Classic, Warm, Editorial, Technical, Couture, Gallery, Playful, Noir, Future, Monument. Every text-and-background pairing is measured against your brand colour, not assumed.",
            "**Variant** — the arrangement of one section. The header alone has seven (centered, split, banner, overlay, side by side, minimal, editorial); a variant that needs a photo is only used when there is one.",
          ] },
          { p: "Chip and variant labels are shown in English on every language's screen." },
        ],
      },
      {
        id: "photos",
        heading: "Photos",
        blocks: [
          { p: "Job photos reach the site from two places: the photos your crew attach to jobs, and the photos you upload from the builder's **Add photos** action. Under **Fine-tune → Before & after pairs** you pair a before shot with its after shot; only confirmed pairs appear in the Before & after section. Stock photography is used only as a background in the header and similar spots while you have no photos, never in Our work." },
          { tip: "One strong before-and-after pair on the Home page does more than a gallery of twelve. Ask the assistant to “lead with our before-and-after photos” once the pair is confirmed." },
        ],
      },
    ],
    faq: [
      { q: "Can I add a page the catalogue does not have?", a: "Not today. The seven pages above are the whole catalogue; a page a contractor cannot fill is worse than no page. You can hide sections and rename headings freely within them." },
      { q: "Why is a section missing after a rebuild?", a: "Because there was nothing to put in it. The thread says so (“Left out … — reason”). Add the data — a review, a photo, an opening-hours entry — and rebuild, or pick a Layout that does not need it." },
      { q: "Can I change the services or hours shown on the site?", a: "Not in the builder — they are read live from Settings → Services & Pricing and Company Settings. Change them there and the site follows." },
    ],
  },

  "your-website-address": {
    title: "Your website address: subdomain and custom domain",
    summary:
      "How the address of your FieldQuo site is chosen, the rules a name has to follow, which names are reserved, and why a custom domain is not supported yet.",
    updated: "2026-09-12",
    intro: [
      "Your site lives at a subdomain of fieldquo.com — **yourname.fieldquo.com** — shown in the bar at the top of the builder and editable under **Fine-tune → Web address**. FieldQuo suggests one from your company name on the first save; you can change it any time. Custom domains (your own .com pointing at the site) are not supported today; this article says so plainly so you do not go looking for the setting.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The address is one word: lowercase letters, digits and dashes. It is what a visitor types, and what the bio link points to once the site is published. Changing it is immediate: the new address answers as soon as you save, and the old one stops — nothing redirects an old address to a new one." },
        ],
      },
      {
        id: "choose-or-change",
        heading: "How to choose or change it",
        blocks: [
          { steps: [
            "Open **Settings → Your website** and press **Fine-tune** under the prompt box.",
            "Type the word you want under **Web address**. The suffix is always fieldquo.com.",
            "Press **Save**. If the name is taken, reserved or malformed, the save is refused with a sentence that names the problem — fix the word and save again.",
          ] },
          { figure: "harness:settings-website", caption: "The address in the builder's top bar; the field that changes it is under Fine-tune, beneath the prompt box." },
        ],
      },
      {
        id: "the-rules",
        heading: "The rules a name must follow",
        blocks: [
          { bullets: [
            "At least **3** characters and at most **63** — the hard limit of a single web-address label, not a product choice.",
            "Lowercase letters, numbers and single dashes only. No spaces, no accents, no dots.",
            "It cannot start or end with a dash, and cannot contain two dashes in a row.",
            "It must not already belong to another company — the save says **… is already taken. Try another.**",
            "It must not be on the reserved list below.",
          ] },
        ],
      },
      {
        id: "reserved-names",
        heading: "Reserved names",
        blocks: [
          { p: "Some names are refused however free they look: **www**, **app**, **api**, **admin**, **platform**, **sales**, **help**, **book**, **quote**, **portal**, **refer**, **site**, **mail**, **support**, **docs**, **status**, **blog**, **shop**, **pay**, **billing**, **login**, **signup**, **account**, **dashboard**, **demo**, **fieldquo**, **official**, **security** and a few dozen more of the same kind." },
          { note: "This is a security boundary, not a naming preference. Login cookies are shared across every fieldquo.com subdomain, so a company owning **app.fieldquo.com** could read other companies' sessions. The list errs on the side of refusing; a refusal costs you ten seconds and a different word." },
        ],
      },
      {
        id: "custom-domains",
        heading: "Custom domains",
        blocks: [
          { p: "FieldQuo does not support pointing your own domain at your FieldQuo site, and there is no field for one. Subdomains only is a deliberate scope decision, not an oversight. If you already own a domain with a website on it, keep that site and put FieldQuo's booking, quote and review widgets on it — see [[embed-booking-and-quote-forms|Embed booking and quote forms on any site]] — or put your FieldQuo address on the bio link and your Google listing." },
        ],
      },
    ],
    faq: [
      { q: "Can I have two addresses for one site?", a: "No. A company has one subdomain; changing it replaces the old one." },
      { q: "Will Google find my site?", a: "A published site is indexable and carries the title and description the assistant wrote. An unpublished site, the embed pages and funnels are marked not to be indexed on purpose." },
      { q: "My company name gives a reserved or invalid word — what now?", a: "FieldQuo already fell back to a usable suggestion (often your name with a suffix such as -site). Type any word that passes the rules; it does not have to match your legal name." },
    ],
  },

  "the-site-by-fieldquo-footer": {
    title: "The “Site by FieldQuo” footer",
    summary:
      "The one place FieldQuo's name is allowed on a client-facing page: a small credit in the website footer while a company is not paying, and how it disappears.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo is white-label by default. Quotes, invoices, emails, the booking page, funnels and the client portal carry your name, your logo and your colour, and never ours. The website has one sanctioned exception: while your company is not on a paid plan, the footer of your site carries a small line — **Site by FieldQuo** — under your copyright. This article is exactly when it shows and when it does not.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The credit is the price of a free website. It is one muted line in the footer, next to **© year Your company**, linking to fieldquo.com. Nothing else on the page mentions FieldQuo — not the title, not the forms, not the booking calendar. A paying contractor gets a footer with their own name and copyright and no trace of ours, so a homeowner comparing three quotes cannot tell which contractors share software." },
        ],
      },
      {
        id: "when-it-shows",
        heading: "When it shows",
        blocks: [
          { table: {
            head: ["Your situation", "Footer credit"],
            rows: [
              ["Paid plan, in good standing", "No credit"],
              ["Free first month on a paid plan, card on file", "No credit — the month we told you was free is free"],
              ["A payment failed, inside the grace window", "No credit — those days are for fixing the card, not for rebranding your site"],
              ["Grace window expired, or subscription cancelled and ended", "Credit shows"],
              ["No subscription at all, or a plan priced at zero", "Credit shows"],
            ],
          } },
          { p: "The decision is made fresh on every page view from your subscription, so it changes the moment your standing does: pay, and the line is gone on the next load; lapse, and it comes back." },
        ],
      },
      {
        id: "where-else",
        heading: "Where else FieldQuo's name appears",
        blocks: [
          { p: "The bio link page carries a small **Made by FieldQuo** line beside its copyright on every plan — the owner's decision, because a link-in-bio page is a menu rather than a document, and every menu of this kind carries its maker's name. Everything above that footer is yours alone. No quote, invoice, email, booking page, instant estimate, funnel or client portal carries FieldQuo's name; a tab title on an embedded widget shows your company name." },
        ],
      },
      {
        id: "how-to-remove-it",
        heading: "How to remove it",
        blocks: [
          { steps: [
            "Open **Account & Billing** (owners and administrators) and pick a plan — see [[your-plan-and-seats|Your plan and seats]].",
            "Finish checkout with a card. From that moment the site renders without the credit, including during the free first month.",
            "Keep the card working. If a payment fails you have the grace window before the credit returns — see [[failed-payments-and-the-grace-period|Failed payments and the grace period]].",
          ] },
          { note: "Cancelling shows the same rule in reverse: the cancel flow tells you the site and booking page stay live, and that the small line comes back to the footer once the account closes." },
        ],
      },
    ],
    faq: [
      { q: "Can I pay to remove the credit but keep everything else free?", a: "There is no separate charge for it. Any paid plan removes the credit; there is no free plan with a paid “no footer” add-on." },
      { q: "Does the credit appear on my quotes or invoices?", a: "Never. It exists only in the website footer, and only while the company is not paying." },
    ],
  },

  "share-your-links": {
    title: "Share your links",
    summary:
      "One screen with every public link your company has — Request a quote, Book a visit, Instant estimate and each published funnel — each with Copy link, Open and an embed snippet.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Share your links** answers one question: what can I put on my Facebook page, my Google listing, my email signature or the side of the van? It lists the links a stranger can use to become a lead, each with a **Copy link** button, an **Open** button to try it yourself, and the code to paste into a website you already have.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Most contractors do not have a website to paste code into — they have a Facebook page, a Google listing and a phone. So the plain link comes first on every card and the embed second. Every link is public: no login, no app, works on a phone in a driveway. Everything that arrives through them lands on your **Leads** board or your calendar with your branding on the page the client saw." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Request a quote** — “They describe the job and leave their details. Lands in your Leads pipeline. Best for people still comparing prices.”",
            "**Book a visit** — “They pick a time from your real availability. Best for people who've already decided and just want you there.”",
            "**Instant estimate** — the address-in, price-out page; every estimate lands in your review queue before it is binding. Trades and rates live under **Settings → Instant Quotes**.",
            "**One card per published funnel**, named as you named it — “A tap-through lead funnel — share the link on an ad, or put it on your site.” Draft funnels are not listed, because their link would not work yet.",
            "A closing line: the quote form only offers the services you enabled under Settings → Services, and never shows your prices.",
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
            "Paste it where people already find you. Press **Open** first if you want to see what they will see.",
            "For a website you already run, press **Copy** under **Or paste this into your own website** instead, and hand the code to whoever edits the site — see [[embed-booking-and-quote-forms|Embed booking and quote forms on any site]].",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Settings → Share your links — the Request a quote, Book a visit and Instant estimate cards, each with the link, Copy link, Open and its embed code." },
        ],
      },
      {
        id: "where-each-link-goes",
        heading: "Where each link goes",
        blocks: [
          { table: {
            head: ["Link", "What the client does", "Where it lands"],
            rows: [
              ["Request a quote", "Picks a service, describes the job, adds photos, leaves their details", "A scored lead on the Leads board — see [[the-self-quote-form|The self-quote form]]"],
              ["Book a visit", "Chooses an event type and a slot from your real availability, pays a visit fee if you charge one", "An appointment on your calendar and a lead — see [[the-booking-page|The booking page]]"],
              ["Instant estimate", "Enters an address or traces an area, sees a starting price", "Estimate Reviews, where you confirm the price before anything is sent — see [[estimate-reviews|Estimate Reviews]]"],
              ["A funnel", "Taps through a short quiz and leaves their details", "A scored lead tagged with the funnel's channel — see [[funnels|Lead funnels]]"],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, Dispatchers and Managers see the row and every card. The funnel cards read from the funnels list, which the same levels can open; someone below that would see the line **Lead funnels are managed by an owner or admin — ask one of them for the link** in place of the funnel cards, but they do not see this settings row at all." },
        ],
      },
    ],
    faq: [
      { q: "Why is my funnel not listed?", a: "Only published funnels with an address appear. Open Funnels, open the funnel, and press Publish; it needs a contact step first." },
      { q: "Do these links show my prices?", a: "No. The quote form collects enough detail to quote accurately without publishing a rate. The instant estimate shows a starting price only for trades you switched on, and only what you chose under “What the homeowner sees”." },
      { q: "Is there a QR code?", a: "Not on this screen today. Copy the link and use any QR generator; the link does not change." },
    ],
  },

  "embed-booking-and-quote-forms": {
    title: "Embed booking and quote forms on any site",
    summary:
      "Paste one snippet into the website you already have to show your booking calendar, quote form, instant estimate, reviews or a funnel — no FieldQuo branding, and the box sizes itself.",
    updated: "2026-09-12",
    intro: [
      "An established contractor is not going to throw away a website that ranks. What they will do is paste a box into it so that “book a visit” and “request a quote” stop being a phone number and start being a row in the pipeline. FieldQuo hands out that box as a snippet you copy from **Settings → Share your links** (and, for reviews, from **Settings → Reviews** and the website builder's Fine-tune panel).",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Each snippet is an iframe pointing at an embed page plus a few lines of script. The embed page runs the same flow as the public page — the same booking calendar, the same quote form — with no FieldQuo chrome and your company name in the tab. The script is the half that makes it usable: the box reports its own height, so a visitor who completes a booking sees the confirmation instead of a clipped frame. Keep the script with the iframe; without it the box still works but scrolls inside a fixed height." },
        ],
      },
      {
        id: "the-widgets",
        heading: "The five widgets",
        blocks: [
          { table: {
            head: ["Widget", "Where the snippet is", "Starting height"],
            rows: [
              ["Book a visit", "Settings → Share your links", "640 px"],
              ["Request a quote", "Settings → Share your links", "640 px"],
              ["Instant estimate", "Settings → Share your links", "560 px"],
              ["Client reviews", "Settings → Reviews, and Settings → Your website → Fine-tune", "220 px — and it renders nothing at all until you have an approved review"],
              ["A funnel", "Settings → Share your links (one per published funnel), and the funnel's own page", "520 px"],
            ],
          } },
          { p: "The starting height is what the box measures before the script has resized it, and what a site whose editor strips scripts is left with — which is why none of them is zero." },
        ],
      },
      {
        id: "paste-the-snippet",
        heading: "How to paste a snippet",
        blocks: [
          { steps: [
            "Open **Settings → Share your links** and find the card you want.",
            "Under **Or paste this into your own website**, press **Copy**.",
            "In your site's editor, add an HTML or “custom code” block where the form should appear, and paste. Both the iframe and the script must land on the page.",
            "Publish your site and open the page on a phone. Complete a test booking or request; it appears on your Leads board or calendar like any other.",
          ] },
          { figure: "harness:settings-lead-form", caption: "Settings → Share your links — each card's embed code sits under “Or paste this into your own website” with its own Copy button." },
        ],
      },
      {
        id: "how-it-behaves",
        heading: "How the embedded box behaves",
        blocks: [
          { bullets: [
            "**Your brand, not ours.** The page inside the box carries your logo and colour; its tab title is your company name; nothing says FieldQuo.",
            "**Not indexed.** Embed pages are marked not to be indexed, so your own page keeps the search traffic rather than competing with a chrome-less copy of itself.",
            "**Paying inside a frame.** A booking that takes a visit fee sends the visitor to Stripe Checkout, which refuses to load inside another site's frame. FieldQuo moves the whole tab to the checkout and also shows a link the visitor can tap if the browser blocked the automatic move.",
            "**Two boxes on one page** is fine — two funnels, or reviews beside a quote form. Each snippet resizes only its own box.",
            "**Reviews shrink to nothing** when there is nothing approved, so the reviews snippet is safe to put in place before your first review arrives.",
          ] },
          { note: "The snippet carries the FieldQuo address it was copied from and your company's short name. Copy it fresh from the screen rather than retyping it; a snippet with a typo in the address shows an empty box with no error." },
        ],
      },
    ],
    faq: [
      { q: "Does it work on Wix, Squarespace, WordPress and the rest?", a: "Anywhere that lets you paste an HTML block. Some hosted builders strip the script; the box then keeps its starting height and scrolls inside, which still works." },
      { q: "Can I embed the whole FieldQuo site?", a: "No, and you do not need to — the site is a page of its own at your address. The embeds are for the parts that do a job: booking, quoting, estimating, reviews, funnels." },
      { q: "Will an embedded booking respect my availability and fees?", a: "Yes. It is the same booking flow as your booking page, reading the same event types, buffer, arrival windows and visit fees." },
    ],
  },

  "the-bio-link": {
    title: "The bio link",
    summary:
      "One branded page for the single link Instagram and TikTok allow — built from what your company already has, ordered and switched on or off by you, with a live phone preview.",
    updated: "2026-09-12",
    intro: [
      "Instagram and TikTok give you one link in a profile. **Settings → Bio link** makes that link a page with your logo, your colour, a heading, one line under it, a row of social icons and the buttons that matter: get a price, book a visit, call, message, visit the website, leave a review. Only things you actually have appear on it, and nothing is a dead link.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is derived from your company record, not typed from scratch. A row appears because the thing behind it exists: the quote form is always there; **Book a visit** appears once you have an active event type; **Get an instant price** once an instant estimator is switched on; each published funnel as its own button; your website once it is published or once you entered a domain in Company Settings; the review link once it is set under Reviews; your phone and email from Company Settings. A row you turn off stays off; a row nobody touched is on the first time the page loads — including a funnel you publish next month." },
          { p: "The page follows the visitor's phone between light and dark on its own; the light / dark switch on this screen only changes the preview frame. It carries a small **Made by FieldQuo** line at the very bottom on every plan — see [[the-site-by-fieldquo-footer|The “Site by FieldQuo” footer]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Your link** — the address, **Copy link**, **Open**, and the **Page is live** box. “Paste this into your Instagram or TikTok bio.”",
            "**Heading** (“Leave it empty to use your company name.”) and **One line under it** (“Optional. Empty means nothing is shown — we don't write one for you.”).",
            "**Follow us** — Instagram, Facebook, TikTok, YouTube, LinkedIn and X; type a handle or paste the profile link, leave one empty to hide it.",
            "**What's on the page** — every row with a **Show on the page** box, its **Button text**, a grip to drag, **Move up** / **Move down**, and its group (Get a price, Book, Contact, More). “The first one is the big button.”",
            "**Add your own link** — up to ten rows you write yourself, each with text, a URL and an icon.",
            "**Not available yet** — the rows you cannot have yet, and the screen that would create each one.",
            "**Preview** in a phone frame, updated as you type, with a light / dark toggle, and **Save** at the bottom.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "How to set it up",
        blocks: [
          { steps: [
            "Open **Settings → Bio link**.",
            "Write the **Heading** or leave it as your company name, and the **One line under it** if you want one — nothing is invented for you.",
            "Under **Follow us**, type your handles. A field that does not look like a handle or a profile link is not saved, and the screen says so.",
            "Under **What's on the page**, tick the rows you want, rename a button if the default wording is not yours, and drag or use the arrows to put the most important one first — it becomes the big button.",
            "Press **Add your own link** for anything else (a Google listing, a gallery elsewhere). Your own links need both text and a URL.",
            "Press **Save**, then **Copy link** and paste it into your Instagram or TikTok profile.",
          ] },
          { figure: "live:app-settings-links", caption: "Settings → Bio link — Your link, the heading and line, Follow us, What's on the page with its switches and arrows, and the phone preview on the right." },
          { note: "Nothing here is saved until you press **Save**. Reorder, rename and switch off is a multi-step edit of one public page, and saving each keystroke would put half-finished states in front of whoever taps the link in between." },
        ],
      },
      {
        id: "what-goes-on-the-page",
        heading: "What can go on the page",
        blocks: [
          { table: {
            head: ["Row", "Appears when", "On by default"],
            rows: [
              ["Get an instant price", "An instant estimator is switched on under Settings → Instant Quotes", "Yes"],
              ["Get a free quote (the quote form)", "Always — every company has it", "Yes"],
              ["Book a visit", "At least one active event type under Settings → Booking Page", "Yes"],
              ["Each published funnel, by its name", "The funnel is published", "Yes"],
              ["Visit our website", "A domain in Company Settings, or a published FieldQuo site", "Yes"],
              ["Call", "A phone number in Company Settings", "Yes"],
              ["Message on WhatsApp", "A phone number in Company Settings", "No — having a number is not a statement that WhatsApp is on it"],
              ["Email us", "An email in Company Settings", "Yes"],
              ["Leave a review", "A review link under Settings → Reviews", "Yes"],
              ["Your own links", "You added them", "Yes"],
            ],
          } },
          { p: "Button wording comes from your company's language, not the language you are reading the settings in — a French company's page says **Devis gratuit** and **Appeler**." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**Page is live** — untick it and save, and the address shows a not-found page until you tick it again. The page is on from the start.",
            "**Show on the page** — hides or shows one row. A hidden row keeps its place and wording for when you bring it back.",
            "**Button text** — replaces the default wording for that row only. Empty means the default, never a blank button.",
            "**Order** — the first row is the large button; sections are ordered by where each group's first row falls, so putting your website first puts **More** first.",
            "**Light / dark** — the preview frame only. Visitors get whichever their phone asks for.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, Dispatchers and Managers can open and save this screen. The public page itself needs nothing — no account, no app." },
        ],
      },
    ],
    faq: [
      { q: "Why is “Book a visit” greyed out?", a: "You have no active event type. The Not available yet list says which screen creates it — Settings → Booking Page." },
      { q: "Can a link point to a phone number or WhatsApp?", a: "Call and Message on WhatsApp are built in and read your company phone number. WhatsApp is off until you switch it on, because a wa.me link to a number that is not on WhatsApp opens a chat with nobody." },
      { q: "Is there a QR code for the link?", a: "Not on this screen today. The address is short enough to say out loud; any QR generator will turn it into a square for the van." },
    ],
  },

  funnels: {
    title: "Lead funnels",
    summary:
      "Mobile-first, tap-through quizzes for your ads and link-in-bio that qualify a visitor and drop a scored lead on your Leads board — with a drop-off report per step.",
    updated: "2026-09-12",
    intro: [
      "A funnel is a short landing page for an ad or a flyer: one question per screen, a tap per answer, and at the end a contact form — or a price before the contact form. **Funnels** lists yours with their status, channel and lead count; **New funnel** starts one from a channel template or from a sentence you type to the AI. Every completed run becomes a lead on your **Leads** board, scored Hot, Warm or Cold from the answers, so the person who tapped “this month” and “over $15,000” is at the top of the list when you open the app.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A static form asks eight questions at once and loses the visitor at the second. A funnel asks one at a time, with the visitor's thumb doing the work, and records how far each visitor got — so “60% quit at the budget question” is a number you can read rather than a guess. The public page carries your logo and brand colour and nothing of FieldQuo's, and is marked not to be indexed, because it is an ad landing page rather than your website." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The heading **Funnels** — “Mobile-first, tap-through lead funnels for your ads and link-in-bio. Each one qualifies visitors and drops a scored lead straight into your pipeline.” — and **New funnel**.",
            "One row per funnel: its name, **Published** or **Draft**, its channel (Web, Instagram, TikTok, YouTube), how many leads it produced, when it was last updated, and a bin.",
            "With no funnels yet: **No funnels yet — Build one from a template or describe it to AI — then share the link on your ads.**",
          ] },
          { figure: "harness:funnels", caption: "Funnels — one published Web funnel with 14 leads and one Instagram draft, each with its channel and last update." },
        ],
      },
      {
        id: "create-a-funnel",
        heading: "How to create a funnel",
        blocks: [
          { steps: [
            "Open **Funnels** under Grow in the sidebar and press **New funnel**.",
            "Either type a sentence under **Describe it and let AI build it** (“A TikTok funnel for exterior house painting that qualifies budget and books an estimate”) and press **Generate**, or pick a template: **Website — get a quote**, **TikTok — 60-second quiz**, **Instagram — free estimate**, **YouTube — book your visit**, each “quiz → qualify → capture”. **or start from a blank funnel** is the third door.",
            "The builder opens with the steps on the left, the selected step in the middle and a branded phone preview on the right — see [[build-a-funnel|Build a funnel and read its drop-off]].",
            "Press **Publish**. The public link and the embed code appear on the funnel's page, and the funnel is listed on **Settings → Share your links** and, switched on, on your bio link.",
          ] },
          { figure: "create:app-funnels-create", caption: "New funnel — the AI box (“Describe it and let AI build it”), the four channel templates, and “or start from a blank funnel”." },
          { note: "The AI writes the funnel's sentences only — the hook, the questions, the button text — from your real services and the channel you named. It never invents a service or a price, and the scoring questions keep their fixed answer values so a generated funnel scores leads exactly like a hand-built one. If the AI is unreachable you get the channel template with plainer copy, never a broken funnel. Generating spends your plan's monthly AI allowance." },
        ],
      },
      {
        id: "the-lead-it-produces",
        heading: "The lead it produces",
        blocks: [
          { p: "When a visitor finishes, FieldQuo creates a lead named from their contact step, with their email or phone (one of the two is required), the budget band and timeline from the questions you tagged to feed them, every other answer as a line in the lead's message (“Which rooms?: Kitchen, Two bathrooms”), any photos they uploaded, and a source of **funnel** plus the channel. It is scored the same way as every other lead — see [[lead-scoring-hot-warm-cold|Lead scoring: Hot, Warm, Cold]] — and sits on [[the-leads-board|the Leads board]] with the rest." },
        ],
      },
      {
        id: "what-is-different",
        heading: "What other tools do not list",
        blocks: [
          { bullets: [
            "None of the five competitors whose pricing pages FieldQuo tracks — Jobber, Housecall Pro, QuoteIQ, ServiceTitan and Projul — lists lead funnels at any tier. They list a website contact form; a funnel is a different thing, with a step-by-step drop-off report.",
            "A funnel can price the job before the contact step, from your instant-estimate rates, so the visitor gives their details already knowing the range — see the instant estimate step in [[build-a-funnel|Build a funnel and read its drop-off]].",
            "It is included on every plan.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators, Dispatchers and Managers see **Funnels** and can create, edit, publish and delete. Estimators and Crew do not see the row, and the list refuses them. The public funnel page needs nothing from the visitor but a thumb." },
        ],
      },
    ],
    faq: [
      { q: "What happens to the leads if I delete a funnel?", a: "Leads already on your board stay where they are. What goes with the funnel is every recorded run and the whole drop-off report behind it — the delete dialog says how many runs." },
      { q: "Can I use the same funnel on TikTok and on my website?", a: "Yes — the channel is a label that travels on the lead's source; the link works anywhere. Make two if you want to compare the two audiences' drop-off separately." },
      { q: "Does a funnel need my FieldQuo website?", a: "No. It is its own page at its own address, and it can be embedded on any site you already run." },
    ],
  },

  "build-a-funnel": {
    title: "Build a funnel and read its drop-off",
    summary:
      "The funnel builder step by step: the seven kinds of step, the scoring tags, the instant estimate step, ad pixels, what Publish requires, and how to read Starts, Leads, Conversion and the per-step drop-off.",
    updated: "2026-09-12",
    intro: [
      "Open a funnel from **Funnels** and you are in the builder: the step list on the left, the selected step's editor in the middle, and a live preview of that step in your colours on the right. This article is what each step kind does, which questions feed the lead score, how a price gets into the middle of a funnel, and how to read the report once people have gone through it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The top bar holds the funnel's name (type to rename), its **Draft** or **Published** badge, **Save**, and **Publish** / **Unpublish**. When the funnel is published, its public link appears with **Copy link** and **Open**, and its embed code with **Copy code**; while it is a draft neither is offered, because the link would not work yet. Below, once anyone has started it, sits **Performance**. The bar's words are in English on every language's screen; the editor's labels follow your language." },
        ],
      },
      {
        id: "the-steps",
        heading: "The seven kinds of step",
        blocks: [
          { table: {
            head: ["Step", "What the visitor sees", "What you set"],
            rows: [
              ["Intro", "The hook and a button", "Headline, a supporting line, button text"],
              ["Single choice", "One question, tap one answer", "The question, help text, the answers (label and stored value), and the scoring tag"],
              ["Multiple choice", "One question, tap several", "The question, help text, the answers"],
              ["Instant estimate", "A size question and, from your rates, a price range", "The service to price, the size options, one assumption for every visitor, and whether the price comes before or after the contact step"],
              ["Photo upload", "“Tap to add photos”", "The question and help text; photos land on the lead"],
              ["Contact form", "Name, email, phone", "Which fields to collect — name is always asked, and at least one of email or phone"],
              ["Thank you", "The closing screen", "Its heading and text"],
            ],
          } },
          { p: "Add steps with **Add step**, reorder them with the arrows, and remove one with the bin. The visitor sees them in the order of the list. The copy you type is the visitor's language, whatever language your app is in — it is your text on a public page, and FieldQuo does not translate it." },
        ],
      },
      {
        id: "scoring",
        heading: "Which answers score the lead",
        blocks: [
          { p: "A single-choice question carries a **Lead scoring** tag: **No scoring**, **Feeds timeline** or **Feeds budget**. A tagged question's answers must use the fixed stored values the scorer understands — the editor prints them under the tag (“Answer values must be: …”) — and the labels the visitor taps can say anything you like. The lead's timeline and budget then drive its Hot / Warm / Cold score exactly as they do for a lead from the quote form." },
          { note: "The channel templates arrive with a timeline question and a budget question already tagged and valued. Rename the labels freely; leave the stored values alone or the answer stops feeding the score." },
        ],
      },
      {
        id: "the-instant-estimate-step",
        heading: "The instant estimate step",
        blocks: [
          { p: "This step puts a real starting price in the middle of the funnel, worked out on FieldQuo's side from the rates you set under **Settings → Instant Quotes**. The visitor taps a size option (“One room, about 200 sq ft”); their phone sends only which option they tapped, never a measurement, and the range comes back from your saved rates." },
          { bullets: [
            "**Service to price** — only a trade that is switched on under Instant Quotes and can be priced from a tapped option. Roofing, lawn mowing and junk removal are priced from a satellite measurement, a drawn map or an item list, so they stay on your instant-estimate page rather than in a funnel; the editor says so.",
            "**Order** — **Price first, then their details** (fewer contacts, each much warmer — what the step is for) or **Their details first, then the price** (more contacts, colder). A service set to reveal its range only after submission shows the price after the contact step whichever you pick.",
            "**Assume for every visitor** — what a funnel cannot ask, stated once: an exterior job left unset is priced as interior.",
            "A service set to “don't show a price” shows your callback message instead of a number.",
          ] },
        ],
      },
      {
        id: "publish-and-share",
        heading: "How to publish and share it",
        blocks: [
          { steps: [
            "Press **Save** whenever the button is dark; it reads **Saved** when nothing is pending.",
            "Under **Ad tracking pixels** (optional) you can store a **Meta Pixel ID**, a **TikTok Pixel ID** or a **GA4 Measurement ID**. FieldQuo saves them, but the public funnel page does not load the pixel scripts today, so the ad platform is not yet told about visits to the funnel — treat the three fields as a record until that changes.",
            "Press **Publish**. The badge turns **Published** and the public link and embed code appear.",
            "Press **Copy link** for an ad or a post, or **Copy code** to put the funnel on a site you already have; it is also listed on **Settings → Share your links** and on your bio link.",
          ] },
          { warning: "**Publish** is refused without a contact step — “Add a contact step before publishing — a funnel with no form captures nothing.” An instant estimate step with no priceable service blocks it too; the reasons are listed under **This funnel can't go live yet** rather than hidden on a greyed button." },
        ],
      },
      {
        id: "read-the-drop-off",
        heading: "How to read the drop-off report",
        blocks: [
          { p: "**Performance** appears once at least one visitor has started the funnel. It shows **Starts** (distinct visitors who saw the first step), **Leads** (completed runs) and **Conversion** (leads as a share of starts), then one bar per step in your order with the number of distinct visitors who reached it and that number as a percentage of starts." },
          { bullets: [
            "A step where the percentage drops sharply is the step to change: fewer answers, a friendlier question, or the price moved after the contact step.",
            "The report is built from the runs behind this funnel; deleting the funnel deletes the report, and unpublishing keeps it.",
            "Nothing here is a lead's identity — the identities are on the Leads board.",
          ] },
          { tip: "Compare **Price first** and **Details first** honestly: run one for a week, note Starts and Conversion, switch the order, run another week. The report is per funnel, so a copy of the funnel with the other order is the cleaner test." },
        ],
      },
    ],
    faq: [
      { q: "Why does the size question price everything as interior?", a: "Because nothing told it otherwise. Set “Assume for every visitor” on the estimate step to exterior, or add a single-choice question — the assumption is the one fact the step cannot ask." },
      { q: "Can a visitor go back a step?", a: "Yes — every step after the first shows a Back link until the form is submitted. The report counts a visitor once per step however many times they return to it." },
      { q: "Does the funnel work inside an Instagram or TikTok in-app browser?", a: "Yes — it is a plain page with no app to install, and the height is one question per screen so it fits the in-app frame." },
    ],
  },

  "marketing-campaigns": {
    title: "Marketing campaigns",
    summary:
      "The Marketing screen: one card per campaign — pamphlet distribution, Meta / paid ads, email blast or other — with its kind, status, progress and owner, plus Subscribers and Marketing spend beside it.",
    updated: "2026-09-12",
    intro: [
      "**Marketing** is the shelf your campaigns sit on. A pamphlet drop is worked stop by stop from a phone and shows **26/40 stops · 9 spoke to**; an email blast shows its template and **Sent to …** with the count; a paid-ads record shows its budget and a link to the ad manager. This article is the screen, the **New Campaign** form and the four kinds; the pamphlet route, the email send and the spend report each have their own article.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Under the title — “Run and track your campaigns — paid ads, email blasts, and door-to-door pamphlet distribution, with routes, assignments, and doorstep follow-ups in one place.” — sit **Subscribers**, **Marketing spend** and **New Campaign**. Each campaign is a card. A pamphlet or email card opens its own page; a paid-ads or other card is a record and opens nothing, because the work happens in the ad platform." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The card's name and a status chip: **Draft**, **Active**, **Completed** or **Partial**.",
            "Its kind: **Pamphlet distribution**, **Meta / paid ads**, **Email blast** or **Other**.",
            "Its progress — a pamphlet route shows **visited/total stops** with a bar and **… spoke to**; an email shows the template name and **Sent to …** or **Not sent yet**; an ad shows **Budget …** and **linked** when a link was entered.",
            "Who it is assigned to.",
            "With nothing yet: **No campaigns yet. Create one to start tracking your marketing.**",
          ] },
          { figure: "live:app-marketing", caption: "Marketing — the title, Subscribers, Marketing spend and New Campaign, and one card per campaign with its kind and status." },
        ],
      },
      {
        id: "create-a-campaign",
        heading: "How to create a campaign",
        blocks: [
          { steps: [
            "Open **Marketing** under Grow and press **New Campaign**.",
            "Type the **Campaign name** and pick the kind.",
            "**Assign to** a person, or leave **Unassigned**. For a pamphlet drop this is who walks the route.",
            "For **Email blast**, choose the **Template to send** — only marketing and custom templates are offered; if you have none, create one under **Email Templates** first, the form says so. For **Meta / paid ads** and **Other**, enter a **Budget (optional)** and a **Link (Meta Ads Manager, etc.)**.",
            "Press **Create Campaign**. The card appears; a pamphlet or email card opens on tap.",
          ] },
          { figure: "create:app-marketing-create", caption: "New Campaign — the name, the kind, Assign to and Create Campaign; the extra fields appear when the kind is Email blast, Meta / paid ads or Other." },
        ],
      },
      {
        id: "the-four-kinds",
        heading: "The four kinds",
        blocks: [
          { table: {
            head: ["Kind", "What the campaign holds", "Read next"],
            rows: [
              ["Pamphlet distribution", "A route of addresses, ordered into an efficient walk, each stop marked Delivered, Spoke to owner, Not home or Skipped from the phone, and a spoke-to homeowner turned into a client on the spot", "[[pamphlet-routes|Pamphlet and door-hanger routes]]"],
              ["Email blast", "One template sent once to everyone currently subscribed, from your own sender, with a count of who it reached", "[[email-campaigns-and-subscribers|Email campaigns and subscribers]]"],
              ["Meta / paid ads", "A budget and a link to the ad manager, as a record", "[[marketing-spend|Marketing spend]] and [[connect-meta-ads|Connect your Meta ad account]]"],
              ["Other", "A budget and a link, for anything else — a radio spot, a sponsorship", "[[marketing-spend|Marketing spend]]"],
            ],
          } },
          { note: "The **Budget** on a paid-ads or other card is a note on the card. What you actually spent is recorded under **Marketing spend**, which is what the cost-per-lead figures read; a budget typed here does not feed them." },
        ],
      },
      {
        id: "statuses",
        heading: "Statuses",
        blocks: [
          { bullets: [
            "**Draft** — every new campaign. A pamphlet or paid-ads campaign keeps this chip; FieldQuo does not change it on its own and there is no control on the screen to set it, so read a pamphlet campaign's progress from its stops, not its chip.",
            "**Completed** — an email campaign once every subscriber has been sent it.",
            "**Partial** — an email send that stopped partway; the campaign page offers **Resume send**, which mails only the people not yet reached.",
            "**Active** exists as a value and shows on a card that carries it, but nothing on the screen sets it today.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Marketing** row, the list, the subscribers and the spend report are for owners, administrators, Dispatchers and Managers. Marking a stop on a pamphlet route is fieldwork and is open to any active member, and a campaign's own page hides its budget and notes from anyone below that level — but Crew and Estimators have no row to reach the list from, so hand them the campaign's link directly." },
        ],
      },
    ],
    faq: [
      { q: "Can I delete a campaign?", a: "Not from the screen today — neither the list nor a campaign's page has a delete control, so a finished campaign stays on the shelf with its chip. Stops on a pamphlet route can be removed one by one." },
      { q: "Does a Meta campaign here connect to my Meta ad account?", a: "Not from this card — it holds a budget and a link. The ad-account sync, lead forms and spend import live under Settings → Meta Ads." },
      { q: "Where do the email addresses for a blast come from?", a: "From Subscribers — the people who are currently subscribed. Anyone who unsubscribed is left out automatically." },
    ],
  },
};
