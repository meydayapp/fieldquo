// content/help/en/clients.js
//
// Articles of the “clients” category in English. Keyed by slug; the slugs
// are listed in lib/help/tree.js and scripts/check-help-centre.mjs refuses a
// module that is missing one or carries one the tree does not.
//
// Every sentence here was read off app/app/clients/**, app/app/equipment,
// app/app/settings/reviews, the API routes they call and the lib/** rules
// behind them (lib/contacts/matchContact.js, lib/i18n/clientLanguage.js,
// lib/equipment, lib/expiry, lib/reviews, lib/marketing/unsubscribe.js,
// lib/sms/optOut.js, lib/referrals). Where the product does not do something
// — merge duplicates, reward a homeowner for a referral, delete a client from
// the screen — the article says so rather than describing a control that is
// not there.
export const ARTICLES = {
  "the-clients-list": {
    title: "The Clients list",
    summary:
      "Every client your company has on file, as a card with their contact details and a count of their quotes and invoices — and the two buttons that add more.",
    updated: "2026-09-12",
    intro: [
      "**Clients** is the company's customer book. Every homeowner you have quoted and every business that hires you is a card here, and opening a card reaches that client's quotes, jobs, invoices and equipment in one place. It sits in the **People** group of the sidebar, just above **Client equipment**.",
      "The list is deliberately simple: a search box, the cards, and two buttons. There are no filters, no tags and no bulk actions — the work happens on the client record, not on the list.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page opens with the title **Clients** and a count — “3 clients total.” — then the search box and the cards, newest client first. The count is only printed once the server has answered; while the list is loading, or if it could not load, no number is shown rather than a misleading “0”." },
          { p: "Two buttons sit top right for anyone allowed to add clients: **Import** loads a CSV from whatever you used before (see [[import-clients-from-a-csv|Import clients from a CSV]]) and **New Client** opens the form described in [[add-a-client|Add a client]]. If you cannot see them, your access level does not include adding clients — see below." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Search clients...** — filters the cards as you type, matching the name, the email address or the phone number. It searches what is already loaded, so it is instant.",
            "A **card per client**: the name, a **Company** badge when the client is a business, then either the contact person (for a business) or the email address (for a homeowner).",
            "The **phone number** and the **city and province** — or the street address when no city is recorded — each with a small icon.",
            "A footer counting **quotes** and **invoices** for that client, for example “3 quotes · 1 invoice”. Jobs are not counted on the card; they are listed on the record.",
            "An **arrow** on each card: the whole card is a link to the client record.",
            "When nothing matches your search the page says **No clients match your search.**; with no clients at all it says **No clients yet.** and offers **Add your first client**.",
          ] },
        ],
      },
      {
        id: "find-a-client",
        heading: "How to find a client",
        blocks: [
          { steps: [
            "Open **Clients** from the **People** group in the sidebar.",
            "Type part of the name, the email or the phone number into **Search clients...**. The cards narrow down as you type.",
            "Press the card. The client record opens with their details, quotes, jobs, invoices and equipment.",
          ] },
          { figure: "live:app-clients", caption: "Clients — the count, the search box, and one card with its email, phone, city and the quote and invoice counts." },
          { tip: "Searching by phone number is the quickest way to find someone who is calling you back. The search matches the number as it is written on the record, so type it with the same dashes — “238-7263” finds “819-238-7263”." },
        ],
      },
      {
        id: "what-each-card-shows",
        heading: "What each part of a card means",
        blocks: [
          { table: {
            head: ["On the card", "Where it comes from"],
            rows: [
              ["The name", "The client's name, or the company name for a business."],
              ["**Company** badge", "The client was created as **Company / Contractor** rather than **Homeowner**. See [[business-clients-and-contacts|Business clients and their contact person]]."],
              ["Second line", "The contact person for a business; the email address for a homeowner. Blank when neither is on file."],
              ["City, Province", "The city and province on the record, joined with a comma. If the record has an address but no city, the street address is shown instead."],
              ["“N quotes · N invoices”", "Counted live from the quotes and invoices linked to this client. Zero shows as “0 quotes”."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Clients** row appears in the sidebar for anyone whose **Clients and Properties** permission is at least **View full client and property info**. The Estimator, Dispatcher and Manager presets all have it; the Crew preset (**View client name and address only**) does not, so a crew member does not get the customer list, only the name and address of the jobs they are on." },
          { bullets: [
            "**View full client and property info** — sees the list and every card, cannot add or edit.",
            "**View and edit full client and property info** — also sees **Import** and **New Client**. This is the Estimator and Dispatcher level.",
            "**View, edit, and delete full client and property info** — the Manager level. Deleting is not offered on this list or on the record; see the FAQ.",
            "The server checks the same permission on every request, so a bookmark to the new-client form does not get around a missing button.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can I sort or filter the list?", a: "No. The cards are always newest first, and the only narrowing is the search box. Search by name, email or phone." },
      { q: "Why does a card show 0 quotes when I have quoted that person?", a: "The quote is linked to a different client record — usually a duplicate created from a lead or an import. Open both records and see [[duplicate-clients|Duplicate clients]]." },
      { q: "How do I delete a client?", a: "There is no delete button on the list or on the record today. A client who has any quote or invoice can never be deleted, because those documents would be orphaned. If you have a client with nothing attached that you need gone, ask support." },
    ],
  },

  "add-a-client": {
    title: "Add a client",
    summary:
      "The New Client form field by field — client type, contact details, address, country, language and notes — and the other places a client gets created.",
    updated: "2026-09-12",
    intro: [
      "A client record is what a quote, a job and an invoice hang off. You can create one on its own from the Clients list, or on the spot while you are writing a quote. Either way the same fields are saved and the same permission is checked.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**New Client** is a single form. Only the name is required; everything else can be filled in later from the client record. Two choices on the form are worth getting right the first time: the **Client type**, which decides whether the address is where the work happens, and the **Language for their documents**, which decides the language of every quote, invoice and email that client receives." },
        ],
      },
      {
        id: "how-to",
        heading: "How to add a client",
        blocks: [
          { steps: [
            "Open **Clients** and press **New Client** (or press **Create** at the top of the sidebar and choose **Client**).",
            "Choose the **Client type**: **Homeowner** for an individual whose jobs are at their own address, or **Company / Contractor** for a business whose job sites vary. A business gets an extra **Contact person** field.",
            "Type the **Name** (or **Company name**). This is the only required field — the form refuses to save without it.",
            "Add the **Phone** and **Email**. The email is checked when you save: an address that cannot be delivered to is refused with the fault named, because every quote and invoice will go to it.",
            "Start typing in **Address** and pick the suggestion. Picking one fills in **City**, **Province** and **Country** for you; typed by hand, fill those in yourself.",
            "Set the **Language for their documents** and any **Notes**, then press **Create Client**. The new record opens straight away.",
          ] },
          { figure: "create:app-clients-create", caption: "New Client — the Client type choice, the contact fields, the address with its city, province and country, the language picker and the notes box." },
          { note: "The **Country** field starts as **Not set**, and FieldQuo does not guess it from your own company's country. It is what the sales-tax lookup keys on — “ON” could be Ontario or a typo — so a client with no country falls back to your company's default tax rate until somebody sets it. Picking the address from the suggestions sets it automatically." },
        ],
      },
      {
        id: "fields",
        heading: "What each field does",
        blocks: [
          { table: {
            head: ["Field", "What it changes"],
            rows: [
              ["**Client type**", "**Homeowner**: the address is the job site. **Company / Contractor**: the address is their office and each job carries its own **Site address**. Also adds the **Company** badge on the list."],
              ["**Name** / **Company name**", "Required. Printed on every quote, invoice and email."],
              ["**Contact person**", "Business clients only — the person you deal with there. Shown under the company name on the list and on the record."],
              ["**Phone**", "Formatted as you type. Used for appointment reminder and on-my-way texts, and for tap-to-call on the equipment call list."],
              ["**Email**", "Where quotes, invoices, the portal link and review requests are sent. Validated on save; leave it blank for a client who is only a phone number."],
              ["**Address**, **City**, **Province**", "Shown on the card and the record. For a homeowner this is where the crew goes."],
              ["**Country**", "Feeds the sales-tax lookup with the province. See [[sales-tax-on-invoices|Sales tax on invoices]]."],
              ["**Language for their documents**", "The language of every document and email to this client. **Company default** follows your company's setting. See [[a-clients-language|A client's language]]."],
              ["**Notes**", "Free text for your team only — never printed on a document. See [[client-notes|Client notes]]."],
            ],
          } },
        ],
      },
      {
        id: "other-ways",
        heading: "The other places a client gets created",
        blocks: [
          { bullets: [
            "**While writing a quote.** The quote builder's client picker has a new-client form with the same fields, including the language, so you never have to leave a half-written quote. See [[build-a-quote|Build a quote]].",
            "**When a lead becomes a quote.** Converting a lead creates the client from the lead's name, email, phone and address — after first checking whether a client with that email or phone already exists. See [[convert-a-lead-to-a-quote|Convert a lead to a quote]].",
            "**From a CSV.** **Import** on the Clients list creates one client per row with a name. Rows with an undeliverable email are skipped and counted. See [[import-clients-from-a-csv|Import clients from a CSV]].",
          ] },
        ],
      },
      {
        id: "who-can-add",
        heading: "Who can add a client",
        blocks: [
          { p: "Creating a client needs **Clients and Properties** at **View and edit full client and property info** or higher — the Estimator, Dispatcher and Manager presets. Anyone below that does not see the **New Client** button, and the form itself refuses them with a no-access panel if they reach it by bookmark. Every new client is written to the [[the-activity-log|Activity Log]] as “Added client …” with who did it." },
        ],
      },
    ],
    faq: [
      { q: "Does the client get an email when I add them?", a: "No. Creating a record sends nothing. The first thing a client receives from you is the first quote, invoice or booking you send." },
      { q: "I picked the wrong client type. Can I change it?", a: "Yes — press **Edit** on the record and choose the other type. Switching a business back to Homeowner clears the contact person." },
      { q: "Why was the email refused?", a: "The address cannot be delivered to — a missing domain, a typo like a double @, or a space inside it. Fix it or leave it blank; a blank email is allowed." },
    ],
  },

  "the-client-record": {
    title: "The client record",
    summary:
      "One page per client: their contact details and language, quick buttons for a new quote or job, their installed equipment, and every quote, job and invoice they have.",
    updated: "2026-09-12",
    intro: [
      "Press any card on the Clients list and you land on the client record. It is the page to open when a client calls: who they are, how to reach them, what is installed at their property, and what you have quoted, scheduled and billed them, each one a link to the document itself.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The record is read-only until you press **Edit**, which opens the **Edit Client** sheet with the same fields as the new-client form. Everything else on the page is a link out: the quotes open in the quote builder, the jobs on the job page, the invoices on the invoice. Nothing is sent from this page and nothing on it changes a document." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Back to Clients**, then the client's name with a **Homeowner** or **Company / Contractor** badge, and the **Edit** button on the right.",
            "The **contact card**: the contact person (business clients, marked “contact person”), the phone, the email, the address (marked “office” for a business), the client's language — “Company default (English) · documents & emails” when they follow your default — and the notes, separated by a rule.",
            "For a business, the line **Job sites vary for contractors — each quote or job carries its own location.**",
            "**New Quote** and **New Job** — quick actions that open the builder with this client already chosen.",
            "**Equipment & warranties** — what is installed at this property and whether it is still covered. See [[client-equipment-and-warranties|Client equipment and warranties]].",
            "**Quotes (n)**, **Jobs (n)** and **Invoices (n)** — one row per document, newest first: the quote number and total, the job title and its status chip, the invoice number and total. Each row is a link. An empty list says **No quotes yet.**, **No jobs yet.** or **No invoices yet.**",
            "If a line reads **Hidden by your access level**, the server removed the phone, email, contact person and notes before the page loaded — that is a restriction, not missing data.",
          ] },
        ],
      },
      {
        id: "edit",
        heading: "How to edit a client",
        blocks: [
          { steps: [
            "Press **Edit** at the top right of the record.",
            "Change the type, name, contact person, email, phone, address, country, notes or language in the **Edit Client** sheet. The address field offers suggestions, and picking one refills the city, province and country.",
            "Press **Save Changes**. The sheet closes and the record reloads with the new values.",
            "If the email was changed to something undeliverable the save is refused with the fault named; clearing it to blank is allowed.",
          ] },
          { note: "Changing the email or the address changes where every future quote and invoice for this client is delivered. Each such edit is written to the [[the-activity-log|Activity Log]] as “Edited … — changed email, address”, naming the fields but not the old values." },
        ],
      },
      {
        id: "quick-actions",
        heading: "New Quote and New Job",
        blocks: [
          { p: "The two buttons under the contact card are the fastest route from a phone call to a document. Each opens the corresponding builder with this client selected, so the name, address and language are already in place." },
          { bullets: [
            "**New Quote** appears only if your **Quotes** permission allows creating one. The quote adopts the client's saved language. See [[build-a-quote|Build a quote]].",
            "**New Job** appears only if your **Jobs** permission allows creating one. A job for a business client gets its own **Site address** field. See [[create-a-job|Create a job]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see what",
        blocks: [
          { p: "The record is shaped to your **Clients and Properties** level before it leaves the server, and the quotes and invoices on it are stripped of prices for anyone without **See prices**." },
          { table: {
            head: ["Your level", "What you get"],
            rows: [
              ["**View client name and address only** (Crew)", "Name, type and address. Phone, email, contact person, notes and language are removed and the page says so. No equipment panel, no Edit."],
              ["**View full client and property info**", "The whole record and the equipment panel. No Edit button; New Quote and New Job depend on your Quotes and Jobs permissions, not on this one."],
              ["**View and edit full client and property info** (Estimator, Dispatcher)", "Edit, plus adding and editing equipment and logging service visits."],
              ["**View, edit, and delete full client and property info** (Manager)", "The same, plus deleting an equipment record. Deleting the client itself is not offered on the screen."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "Where is the client portal link?", a: "Not on this page. The portal link is sent to the client with their invoice and quote emails; see [[the-client-portal|The client portal]]." },
      { q: "Why does the language line say “Company default”?", a: "Because no language was chosen for this client, so they follow whatever your company default is — and will follow it if you change it. Press **Edit** to pin a language to this client." },
      { q: "Can I add a note from here?", a: "Yes — **Edit**, then the **Notes** box, then **Save Changes**. Notes are internal and never printed. See [[client-notes|Client notes]]." },
    ],
  },

  "business-clients-and-contacts": {
    title: "Business clients and their contact person",
    summary:
      "What the Company / Contractor client type changes: an office address instead of a job site, a named contact person, and a site address on every job.",
    updated: "2026-09-12",
    intro: [
      "A homeowner is the person and the property in one. A general contractor, a property manager or a builder is neither: they hire you across many addresses and you deal with one person there. FieldQuo keeps the two apart with one choice on the client form, **Client type**, and everything below follows from it.",
      "The type is not decoration. It decides whether the address on the record is where your crew drives to, whether the record carries a contact person, and what the list and the record print.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every client is either **Homeowner** — “An individual — jobs are at their address” — or **Company / Contractor** — “A business — job sites vary per job”. The wording is the screen's own. A business client's address is labelled **Business address (optional)** and the form says why: “This is their office. Each job's actual site address is set on the quote or job itself.”" },
          { p: "The person you deal with at that business goes in **Contact person** — “Who you deal with there”. It is shown under the company name on the Clients list and, on the record, next to the label “contact person”. A homeowner has no such field, because the client is the person." },
        ],
      },
      {
        id: "how-to",
        heading: "How to set a client up as a business",
        blocks: [
          { steps: [
            "On **New Client** — or on **Edit** for an existing client — choose **Company / Contractor** under **Client type**.",
            "Type the **Company name** and, in the field that appears beside it, the **Contact person**.",
            "Optionally add the **Business address (optional)** — their office, not a job site — with the phone and email you use to reach them.",
            "Press **Create Client** (or **Save Changes**). The list now shows a **Company** badge on the card and the contact person under the name.",
          ] },
          { figure: "create:app-clients-create", caption: "New Client — the Client type choice at the top; choosing Company / Contractor adds the Contact person field beside the name." },
          { note: "The address on a business client is never used as a job site. When you create a job for them, fill in the job's own **Site address** — “Street, city, postal code” — so the crew, the arrival detection and the equipment history all point at the right property. A job with no site address has no location, rather than a guessed one." },
        ],
      },
      {
        id: "what-changes",
        heading: "What the type changes",
        blocks: [
          { table: {
            head: ["Where", "Homeowner", "Company / Contractor"],
            rows: [
              ["Clients list card", "Email under the name", "**Company** badge and the contact person under the name"],
              ["Client record", "Address shown as the property", "Address marked “office”, contact person marked “contact person”, and the line “Job sites vary for contractors — each quote or job carries its own location.”"],
              ["New job", "The client's address is where the work is", "Each job carries its own **Site address**"],
              ["Switching back", "—", "Changing a business to **Homeowner** clears the contact person"],
            ],
          } },
        ],
      },
      {
        id: "contact-person",
        heading: "The contact person",
        blocks: [
          { p: "One contact person per business — a single name, not a list of contacts with their own phones and emails. The phone and email on the record are the ones you reach the business at, whoever answers. If your contact at a builder changes, edit the record and replace the name; the quotes and invoices stay with the company." },
          { tip: "Put the contact's direct line in **Notes** if it differs from the number on the record. Notes are internal and show on the record for anyone who can see full client info." },
        ],
      },
    ],
    faq: [
      { q: "Can a business have several contacts or several sites on the record?", a: "No. One contact person and one office address per client. Sites live on jobs — each job has its own **Site address** — so one business client can have jobs at as many properties as you like." },
      { q: "Does the contact person's name appear on quotes and invoices?", a: "The company name is the client name on every document. The contact person is shown on the Clients list and the record; it is not a separate line on the PDF." },
      { q: "I created a builder as a Homeowner by mistake.", a: "Press **Edit** on the record, choose **Company / Contractor**, type the contact person and save. Existing quotes and jobs stay linked." },
    ],
  },

  "client-notes": {
    title: "Client notes",
    summary:
      "The free-text notes on a client record: where to write them, where they show up, and who can read them.",
    updated: "2026-09-12",
    intro: [
      "Every client record has a **Notes** box. It is for the things a document cannot carry — the gate code, the dog, “always call before 9”, the fact that the last invoice took three reminders. Notes are internal: they are never printed on a quote, an invoice or an email, and a client never sees them.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Client notes are one text field on the record, not a running log. Whatever is in the box is what shows; there is no history of earlier notes, no timestamps and no author. If you need a dated record of what happened, the job's own notes and the visit notes carry a date — see [[job-notes|Job notes]]." },
        ],
      },
      {
        id: "how-to",
        heading: "How to add or change a note",
        blocks: [
          { steps: [
            "Open the client record and press **Edit**.",
            "Type in the **Notes** box — on the new-client form it is the last field before **Create Client**.",
            "Press **Save Changes**. The note appears at the bottom of the contact card, under a thin rule.",
          ] },
        ],
      },
      {
        id: "where-they-appear",
        heading: "Where the note shows up",
        blocks: [
          { bullets: [
            "**On the client record**, at the bottom of the contact card, for anyone allowed to see full client info.",
            "**In suggested tasks** — when FieldQuo reads a job to propose a checklist, the client's notes are one of its sources, alongside the quote notes, the scope and the visit notes. See [[suggested-tasks|Suggested tasks]].",
            "**Nowhere a client can see.** Not on the quote, the invoice, the PDF, the portal or any email.",
            "**Not on the job page.** A note that the crew needs on site belongs on the job or the visit, not on the client.",
          ] },
        ],
      },
      {
        id: "who-can-see-them",
        heading: "Who can read them",
        blocks: [
          { p: "Notes travel with the rest of the full client info. A member whose **Clients and Properties** level is **View client name and address only** — the Crew preset — never receives them: the server strips notes, phone, email and contact person from the record before it is sent, and the page shows **Hidden by your access level** in their place. Everyone from **View full client and property info** up can read them; editing needs **View and edit full client and property info**." },
          { warning: "Write notes as if the client could ask to see them. FieldQuo keeps them private, but privacy law in Canada gives a person the right to ask what a business holds about them — see [[data-and-privacy|Your data, your clients' data, and deletion]]." },
        ],
      },
    ],
    faq: [
      { q: "Can I see who wrote a note, or when?", a: "No. The Activity Log records that a client was edited and which fields changed, but a change to notes alone is not listed there and the note itself carries no author or date." },
      { q: "Is there a note on the job as well?", a: "Yes — jobs and visits have their own notes, which the crew can read on their phone. Client notes are the office's view of the person; job notes are about the work. See [[job-notes|Job notes]]." },
    ],
  },

  "a-clients-language": {
    title: "A client's language",
    summary:
      "The language on a client record drives every quote, invoice, email, portal page, review request and reminder text they receive — with one rule about documents already written.",
    updated: "2026-09-12",
    intro: [
      "Two languages matter in FieldQuo and they are separate: the one your team works in, chosen in [[choose-your-language|Choose your language]], and the one each client reads. This article is about the second. You pick it once on the client record, and everything you send that client follows it.",
      "Eight languages are available for a client: English, French, Spanish, Ukrainian, Punjabi, Tagalog, German and Italian. The PDF, the covering email, the portal and the texts all have hand-written wording in each — nothing is machine-translated at send time.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The field is **Language for their documents** on the new-client form and the edit sheet, with the hint “Quotes, invoices and emails to this client are written in this language.” The list is in each language's own name — a homeowner who reads Punjabi is offered “ਪੰਜਾਬੀ — Punjabi”. The first option, **Company default (…)**, means the client follows your company's setting, and keeps following it if you change that setting later." },
        ],
      },
      {
        id: "how-to",
        heading: "How to set a client's language",
        blocks: [
          { steps: [
            "Open the client record and press **Edit** (or set it on **New Client** when you add them).",
            "Choose a language under **Language for their documents**, or leave **Company default** to follow your company.",
            "Press **Save Changes**. The contact card now shows the language with the tag “documents & emails”, or “Company default (English)” when unset.",
            "Start the next quote. The quote builder adopts the client's language the moment you select them, and its language bar warns if any of your services is still missing a translation in that language.",
          ] },
          { figure: "create:app-clients-create", caption: "New Client — Language for their documents, opening on Company default (English), with the eight languages beneath it." },
          { note: "The label **Language for their documents** and the option **Company default** are shown in English on every screen, whatever language your app is set to. The rest of the form is translated." },
        ],
      },
      {
        id: "what-follows-it",
        heading: "What follows the client's language",
        blocks: [
          { bullets: [
            "**New quotes and invoices** — the document is written in the client's language at creation. The labels, the wording of each service and the terms all come from the translation tables, never from a machine at send time.",
            "**The covering email** for a quote or an invoice — matched to the document it carries (see the rule below).",
            "**The client portal** and the public quote and invoice pages.",
            "**Review requests** after a job, and the one-question satisfaction survey inside them.",
            "**Appointment reminder** and **on my way** texts, and the emails around a booked visit.",
            "**Payment reminders** and service-plan invoices sent on a schedule.",
          ] },
        ],
      },
      {
        id: "precedence",
        heading: "Which language wins",
        blocks: [
          { p: "Every send answers the same question in the same order, so a client never gets a French quote with an English reminder and a Spanish follow-up:" },
          { table: {
            head: ["Order", "Source", "When it applies"],
            rows: [
              ["1", "The document's own language", "A quote or invoice keeps the language it was created in, for its whole life, even if the client's language is changed afterwards. Its covering email matches it."],
              ["2", "The client's saved language", "Anything not tied to a specific document: reminders, booking emails, review requests, the portal."],
              ["3", "The company default", "Clients set to **Company default**. See [[settings-language|Settings → Language]]."],
              ["4", "English", "When nothing above is set."],
            ],
          } },
          { warning: "Changing a client's language does not translate the quotes they already have. A signed document must keep saying what it said when it was signed. To send the same quote in another language, create a new quote — see [[quote-language|Quote language]]." },
        ],
      },
    ],
    faq: [
      { q: "My crew works in English. Can a client still get a Spanish quote?", a: "Yes. The app language and the client language are independent — set the client to Español and write the quote as usual; the document and its email go out in Spanish." },
      { q: "Why did the quote builder warn about missing translations?", a: "Your services have wording the client reads, and that wording is translated per language under **Settings → Translations**. The bar names what is still missing so you fix it before sending, not after." },
      { q: "Does the language change how the app looks for me?", a: "No. Your own interface language is yours, under **Settings → Language**. The client's language only affects what the client receives." },
    ],
  },

  "client-equipment-and-warranties": {
    title: "Client equipment and warranties",
    summary:
      "Record the furnace, the panel or the cabinets you installed at a client's property with its warranty date and service history — and get a call list of the warranties about to run out.",
    updated: "2026-09-12",
    intro: [
      "A serial number in a database earns nothing. Twelve households whose warranties end in April, with a phone number beside each one, is a morning's calls and a month's work. That is what this feature is for: an **Equipment & warranties** panel on every client record, and a **Client equipment** screen in the sidebar that lists whose cover has ended or is about to.",
      "One rule runs through all of it. A blank warranty date means **nobody recorded one** — it is shown as “Warranty not recorded” and never as out of warranty. A renewal call to a customer whose cover is actually fine is an insult, so FieldQuo refuses to guess.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Each piece of equipment belongs to one client and, optionally, to the job that installed it. It carries a name, make and model, serial number, where it is if not at the main address, the install date, the date the warranty covers until, who is covering it, notes, and a **service history** — each visit with what was done, the date, an optional link to a job, and whether the visit was covered by the warranty." },
          { p: "This is the client's kit, not yours. Your own vans and tools live under **Vehicles** and in job costing; a homeowner's boiler is never treated as an asset of your company." },
        ],
      },
      {
        id: "on-the-record",
        heading: "What is on the client record",
        blocks: [
          { bullets: [
            "The **Equipment & warranties** panel, placed above the quotes, jobs and invoices — on a service call the first question is “what is in this house and is it covered”.",
            "A count of items, an **Add** button, and one row per item: its name, then make, model and serial, then a badge — **In warranty**, **Warranty ending**, **Out of warranty** or **Warranty unknown** — with “Covered until …”, “Cover ended …” or “Warranty not recorded”.",
            "Press a row to open it: the location, the notes, the **Service history** (“3 visits · 2 under warranty”, each visit dated with a **covered** tag where it applied), **Log a service visit**, **Edit** and **Delete**.",
            "An empty panel reads “Nothing recorded here yet. Add the furnace, the panel, the unit — whatever you'd want to know about on the next call.”",
            "**Warranty ending** means the date is within the next 60 days — the window a renewal quote, a conversation and a booking take.",
            "The panel is only drawn for members allowed to see full client info; a crew member on name-and-address-only gets no panel at all rather than an empty one.",
          ] },
        ],
      },
      {
        id: "add-equipment",
        heading: "How to record a piece of equipment",
        blocks: [
          { steps: [
            "Open the client record and press **Add** in the **Equipment & warranties** panel.",
            "Name it — “Furnace, panel, water heater…” — and add the **Manufacturer**, **Model number** and **Serial number**. Use **Where it is (if not the main address)** for a business client's site or a second property.",
            "Set **Installed** and **Warranty covers until**. Leave the warranty date blank if you do not know it: the form says so itself — it will show as “not recorded”, never as out of warranty.",
            "Add **Who's covering it** and, if this client has jobs, pick **Installed on which job** so the equipment traces back to the work.",
            "Press **Save**. The row appears with its badge computed from the date.",
          ] },
          { note: "Edits are sent whole, blanks included, so clearing a mistyped warranty date really clears it. **Delete** asks for confirmation and removes the item and its service history for good." },
        ],
      },
      {
        id: "log-a-visit",
        heading: "How to log a service visit",
        blocks: [
          { steps: [
            "Open the item and press **Log a service visit**.",
            "Type **What was done** and check the date (today is pre-filled). Link it to a job with the picker if there is one.",
            "Tick **This visit was covered by the warranty** when it was. This is asked, not inferred from whether you invoiced — an unbilled visit and a covered one are different things.",
            "Press **Log it**. The service history and its “under warranty” tally update.",
          ] },
        ],
      },
      {
        id: "the-call-list",
        heading: "The call list: Warranties running out",
        blocks: [
          { p: "**Client equipment** in the sidebar's **People** group opens **Warranties running out** — “Equipment you've installed whose cover has ended or is about to. This is a call list.” It reads across every client, so you never have to open records one by one to find the renewals." },
          { figure: "harness:client-equipment", caption: "Client equipment — the window chips, the tally, and one card per item with its badge, its end date, and tap-to-call and Email buttons." },
          { bullets: [
            "**Window chips** — **Next 30 days** up to **Next 365 days**; 60 days is selected when you arrive. Every window also includes cover that has already ended, expired first, then soonest.",
            "**The tally** — “1 out of warranty · 2 ending soon · 1 with no warranty date recorded”. The third number is the honest one: those items are not on the list, and the count tells you there is data entry to do.",
            "**One card per item** — the client's name (a link to their record), the equipment, its address, “Cover ended …” or “Covered until …”, and a **phone button** that dials and an **Email** button that opens a message. Buttons only appear when the detail is on file.",
          ] },
          { warning: "Equipment with no warranty date is never on this list, in any window. If the list looks short, check the third number in the tally before concluding nothing is due." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Why this is listed under “Only in FieldQuo”",
        blocks: [
          { p: "Of the five products FieldQuo compares itself with on its pricing pages — Housecall Pro, ServiceTitan, Projul, Jobber and QuoteIQ — only ServiceTitan lists equipment tracking on its pricing page, on its Essentials tier, and none lists a warranty call list. In FieldQuo the panel, the service history and the call list are on every plan, and the rule that a blank date is unknown rather than expired is written into the code that computes every badge." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { table: {
            head: ["Clients and Properties level", "Equipment"],
            rows: [
              ["**View client name and address only** (Crew)", "Nothing — no panel on the record, no **Client equipment** row in the sidebar."],
              ["**View full client and property info**", "Sees the panel, the histories and the call list. Cannot add, edit or log a visit."],
              ["**View and edit full client and property info** (Estimator, Dispatcher)", "Adds and edits equipment and logs visits. Only a Manager (**View, edit, and delete …**) can delete an item."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "Can I put equipment on a job instead of a client?", a: "Equipment belongs to the client. From the client record you can link it to the job that installed it, and each logged visit can be linked to a job too." },
      { q: "Does FieldQuo email the client when the warranty is ending?", a: "No. The call list is for you to act on — the phone and Email buttons open a call or a message you write. Nothing is sent automatically." },
      { q: "What if I do not know the warranty date?", a: "Leave it blank. The item shows **Warranty unknown** and stays off the call list, and the tally counts it under “no warranty date recorded” so you know to ask." },
    ],
  },

  "client-consent-and-unsubscribes": {
    title: "Client consent and unsubscribes",
    summary:
      "Which emails carry an unsubscribe link, which do not and why, what happens when a client texts STOP, and where an opt-out is recorded and honoured.",
    updated: "2026-09-12",
    intro: [
      "Canadian anti-spam law (CASL) and its US counterpart draw one line: a message that promotes your business needs a working, one-click way out; a message that carries something the client asked for does not. FieldQuo draws the same line in the code. This article says which side each email and text falls on, and what an opt-out changes.",
      "Nothing here is a setting you turn on. It is how every send already behaves, whatever plan you are on.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "An email is either **commercial** — and carries an **Unsubscribe** link in its footer plus the one-click header mail apps use — or **transactional**, and carries no link at all, because inviting someone to switch off the invoice they owe would be its own defect. Texts work on the STOP keyword instead. An opt-out on either channel is stored as a record with the wording the person saw, never deleted, and checked before every later send." },
        ],
      },
      {
        id: "emails",
        heading: "Which emails carry an unsubscribe link",
        blocks: [
          { p: "The footer reads “You're receiving this because you're a customer of …” with an **Unsubscribe** link, and the page it opens says plainly that quotes, invoices and receipts about work they requested will still arrive — only promotional email stops." },
          { bullets: [
            "**Commercial, with the link:** marketing email campaigns; the automatic review request after a job (see [[review-requests|Review requests after a job]]); and a “job completed” follow-up rule, since the work is finished and this is discretionary outreach.",
            "**Transactional, no link:** a sent quote or invoice; the “quote sent, no response” and overdue-invoice follow-ups, which are about a document the client is already in a transaction with; booking and instant-quote confirmations; and account mail such as password resets.",
            "**Recorded on the way out:** a review request is sent to someone who was never on a mailing list, so the send first creates their subscriber row with a token — that is what makes the link in that email work.",
          ] },
        ],
      },
      {
        id: "the-unsubscribe-page",
        heading: "What the client sees when they unsubscribe",
        blocks: [
          { steps: [
            "The link opens a page with no login. Opening it changes nothing — a mail app that pre-fetches links cannot unsubscribe someone by accident.",
            "One button confirms: “Unsubscribe from marketing emails from …”. Pressing it records the opt-out with that exact wording and the time.",
            "If the request fails to land — one bar of signal, a slow server — the button stays on screen and the page says nothing has changed yet, so they can press again.",
          ] },
          { note: "The opt-out is never deleted. The record of the request is the evidence that you honoured it, and FieldQuo keeps it even if the client is later removed from a list." },
        ],
      },
      {
        id: "texts",
        heading: "Texts: STOP and START",
        blocks: [
          { p: "The default appointment reminder text ends with “Reply STOP to opt out”, in the client's language — if you rewrite the wording under **Settings → Client messages**, keep that line, because nothing adds it back. The keyword itself is always STOP — carriers treat it as universal. A reply is an opt-out only when the whole message is the keyword: **STOP**, **STOPALL**, **UNSUBSCRIBE**, **CANCEL**, **END** or **QUIT** (a trailing full stop is fine). “Please stop by at 3” is not an opt-out." },
          { bullets: [
            "**STOP** records an SMS opt-out for that number and your company the moment it arrives. From then on the reminder cron and the on-my-way text both skip that number.",
            "**START** or **UNSTOP** reverses it, on the same channel. Whether the client gets a confirmation text depends on how the number is set up at the carrier, not on a setting in FieldQuo. **YES** is deliberately not an opt-in — it usually means “yes to the appointment”.",
            "A number that opted out of **calls** is refused texts as well, but a START does not restore call consent — that opt-out is one-way.",
          ] },
        ],
      },
      {
        id: "where-you-see-it",
        heading: "Where you see an opt-out",
        blocks: [
          { p: "Email opt-outs show on **Marketing → Subscribers** as **Unsubscribed** next to the address, and the count at the top — “12 subscribed of 15 total — this is who an Email blast campaign sends to” — excludes them. A review request checks the same list before sending, and the reviews settings page says so: “Customers who have unsubscribed are skipped”. See [[email-campaigns-and-subscribers|Email campaigns and subscribers]]." },
          { note: "There is no consent flag on the client record itself, and no screen lists SMS opt-outs. A texted STOP is honoured silently by every automated text; if a client tells you in person that they do not want texts, the only way to be sure is to remove the phone number from their record." },
        ],
      },
    ],
    faq: [
      { q: "A client unsubscribed. Will they still get their invoice?", a: "Yes. Quotes, invoices, receipts, reminders about a specific document and booking confirmations are transactional and always sent. Only campaigns, review requests and job-completed follow-ups stop." },
      { q: "Can I resubscribe someone from the Subscribers page?", a: "The page has a **Resubscribe** button, but use it only with the client's express consent in writing. The original opt-out record stays on file either way." },
      { q: "Do the on-my-way text and the reminder text need consent?", a: "They are about a visit the client booked, so they go out without a separate opt-in — but a STOP reply stops both, immediately, and FieldQuo will not text that number again until it receives START." },
    ],
  },

  "review-requests": {
    title: "Review requests after a job",
    summary:
      "Settings → Reviews: your review link, the Ask automatically switch, the When to ask delay, the live queue count — and the exact rules that decide who is asked, once, and who is not.",
    updated: "2026-09-12",
    intro: [
      "Reviews are the biggest source of inbound work for a small contractor, and asking for one is the step that gets skipped while the van is being loaded. **Settings → Reviews** does the asking: once a job is marked complete, the client gets one short email from your company — your logo, your colours, your name — with a button to your review page. Never more than one per job, never to someone who unsubscribed, never for work older than a month.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen is in the **Client-facing** group of Settings. Its subtitle says the whole thing: “Ask customers for a review automatically once their job is finished.” Two cards do the work — **Your review link** and **Ask automatically** with **When to ask** — and a grey panel under them proves it is working by counting the queue. The lower half of the same screen, **Reviews on your website**, is a separate feature: see [[testimonials-on-your-website|Testimonials on your website]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Your review link** — “Usually your Google review link. On your Google Business Profile, choose ‘Ask for reviews’ and copy the short link.” A box, **Save**, and once saved a link to **Open it and check it goes where you expect**.",
            "**Ask automatically** — the switch. Under it: “Every customer with an email address gets one message after their job is marked complete. Never more than one.” The switch is disabled until a link is saved, and the text then reads “Add your review link above first.”",
            "**When to ask** — appears once the switch is on: **2 hours later**, **4 hours later**, **The next day**, **Two days later**, **Three days later**, **A week later**. The next day is the default.",
            "The queue panel — “**1** customer is in the queue, and **3** have been asked in the last 30 days.” — read from the same columns the sender reads, so a switch that says On while nothing sends cannot happen quietly.",
            "Its footnote: “Customers who have unsubscribed are skipped, and anyone who replies saying something went wrong reaches you directly rather than the review page.”",
          ] },
        ],
      },
      {
        id: "set-up",
        heading: "How to switch it on",
        blocks: [
          { steps: [
            "In your Google Business Profile choose **Ask for reviews** and copy the short link. Any page where a review can be left works — Google, Facebook, HomeStars — as long as it starts with https://.",
            "Open **Settings → Reviews**, paste the link into **Your review link** and press **Save**. A link that is not a web address is refused with the reason.",
            "Press **Open it and check it goes where you expect**. This is the page every client will land on.",
            "Turn on **Ask automatically**. It cannot be turned on without a valid link — the server refuses, not just the button.",
            "Pick a delay under **When to ask**. Each chip saves as you press it; **Saved** confirms.",
          ] },
          { figure: "live:app-settings-reviews", caption: "Settings → Reviews — the review link card, the Ask automatically switch with the When to ask chips, and the queue count beneath." },
        ],
      },
      {
        id: "when-it-sends",
        heading: "Who is asked, and who is not",
        blocks: [
          { p: "A sender runs every hour on the hour and applies these rules to each job, in this order. Every refusal has a reason so a job that was not asked about is explainable:" },
          { table: {
            head: ["Rule", "What it means"],
            rows: [
              ["Once, ever", "A job is asked about exactly once. The job is stamped before the email goes out, so two overlapping runs cannot ask twice."],
              ["Switched on, with a link", "Both are re-checked at send time. Turn the switch off and nothing more goes out."],
              ["Job marked **Completed**", "With a completion time. A job completed by an import of past work is never asked about."],
              ["The client has an email", "No email address, no ask. Texts are not used for review requests."],
              ["Not unsubscribed", "A client who unsubscribed from your marketing email is skipped."],
              ["The delay has passed", "Completion time plus your **When to ask** delay — from 2 hours to a week."],
              ["Completed within the last 30 days", "Anything older is left alone, permanently. Switching this on does not email every customer you have ever had."],
              ["Email is configured", "If no mail provider is set up the job is released to try again next hour rather than marked as asked."],
            ],
          } },
        ],
      },
      {
        id: "what-the-client-gets",
        heading: "What the client receives",
        blocks: [
          { p: "One short email in the client's language: the subject “How did we do? — Your Company”, one sentence of thanks, a **Leave a review** button to your link, five small 1-to-5 rating links, and the line that if something was not right they should reply to this email instead. It is sent from your own domain if you have verified one, and replies go to your company's email address. See [[the-review-request|The review request]] for how it looks to them." },
          { note: "The 1-to-5 links pre-select a score on a one-question page; the client still has to press Send there, so a mail scanner cannot vote for them. Answered scores feed the customer satisfaction figure on the KPI dashboard — see [[kpi-customer|Customer KPIs]]. They do not become testimonials." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Who can change it",
        blocks: [
          { p: "The **Reviews** row in Settings, and every change on it — the link, the switch, the delay — need the **user:manage** permission: the owner, an administrator, or a Manager or Dispatcher. An Estimator or a crew member does not see the row at all. Each change is written to the Activity Log as “Updated review request settings” or “Turned off automatic review requests”." },
        ],
      },
    ],
    faq: [
      { q: "Can I ask a specific client by hand?", a: "No. There is no “ask now” button on a job or a client; the sender works from completed jobs and your delay. To ask someone yourself, send them your review link from your own email." },
      { q: "I turned it on and nothing was sent.", a: "Read the queue panel. A count of 0 in the queue means no completed job with a client email inside the last 30 days is waiting; a job also has to be past your delay. Jobs imported from your old system are never asked about." },
      { q: "Does it text clients?", a: "No — email only. A client with a phone number and no email is skipped." },
      { q: "Can the review go to a page on my own site?", a: "Yes. Any https:// address works, including your own testimonials form. Collected reviews then go into **Reviews on your website** by hand." },
    ],
  },

  "testimonials-on-your-website": {
    title: "Testimonials on your website",
    summary:
      "Reviews on your website, on the Settings → Reviews screen: add reviews one at a time or paste a list, switch on the ones to show, order them, and embed them on a site FieldQuo did not build.",
    updated: "2026-09-12",
    intro: [
      "The reviews you already have — on Google, on Facebook, in a folder of thank-you emails — are worth more on your own website than anywhere else. The lower half of **Settings → Reviews** is where they go. Each review starts switched off; the ones you switch on appear on your FieldQuo website, the first six in the order you set, and in an embed you can paste into any other site.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The card is titled **Reviews on your website** — “The ones you switch on appear on your website — the first six, in the order below.” — and, underneath, “Copy them across from your Google profile, or anywhere else you've collected them. Pasting is the quickest way to get them on your site today.” FieldQuo does not read reviews from Google for you; you copy them in, and you decide what is shown." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "A line saying how many are live: “**2 showing on your website.**” or “None are showing on your website yet — switch on the ones you want.” This counts what the public site will actually show, capped at six, not how many rows you have.",
            "**One row per review** — the customer's name and what they said, a **Show on the website** switch reading “on your website” or “not showing”, **Move up** and **Move down**, **Edit** and **Remove**.",
            "**Add a review** — **Customer's name** and **What they said**, then **Add review**.",
            "**Paste a list** — a box for “One review per block: the name on its own line, what they said underneath, and a blank line between each. A spreadsheet's CSV works too — paste it or choose a file.”, with **Choose a CSV file** and **Import**.",
            "**Your reviews on your own website** — the embed code, for a site you already have.",
          ] },
        ],
      },
      {
        id: "add-or-paste",
        heading: "How to add reviews",
        blocks: [
          { steps: [
            "Open **Settings → Reviews** and scroll to **Reviews on your website**.",
            "For one review: type the **Customer's name** and **What they said** and press **Add review**. For many: paste blocks into **Paste a list** — name, then the text, then a blank line — or press **Choose a CSV file** with name and review columns, then **Import**. The result reads “Added 5, updated 0, skipped 1.”",
            "Imported reviews start switched off. Press **Show on the website** on each one you want live.",
            "Use **Move up** and **Move down** to set the order. The first six switched-on reviews are what the site shows.",
          ] },
          { figure: "harness:settings-reviews", caption: "Settings → Reviews — the Reviews on your website card with its published count, under the review-request settings." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["**Show on the website**", "Publishes the review to your website and the embed. Off, the review stays on file and is invisible to the public. The published count updates immediately."],
              ["**Move up** / **Move down**", "Changes the order on the site. Only the first six switched-on reviews are shown, so order decides which ones make the cut."],
              ["**Edit**", "Changes the name or the text. Trailing quote marks and stray dashes are tidied on save."],
              ["**Remove**", "Deletes the review after a confirmation. It cannot be undone; paste it again if needed."],
              ["**Import**", "Reads pasted blocks or a CSV. A review identical in name and text to one already on file is updated rather than duplicated; empty or too-short lines are skipped and counted."],
            ],
          } },
        ],
      },
      {
        id: "embed",
        heading: "On a website FieldQuo did not build",
        blocks: [
          { p: "The **Your reviews on your own website** block is an iframe plus a small script. Its note says what it does: it shows the reviews you have approved, in your own colours, with no FieldQuo branding — and until you have one it shows nothing and shrinks to no height, so it is safe to paste in before you have any. Keep the script with the iframe; it sizes the box. The same block is offered for the booking calendar and the instant estimate — see [[embed-booking-and-quote-forms|Embed booking and quote forms]]." },
          { tip: "On a FieldQuo-built site, switched-on reviews also feed the “What clients say” section and a Reviews page of their own; regenerating the site rebuilds those from this list. See [[website-pages-and-blocks|Website pages and blocks]]." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Who can change it",
        blocks: [
          { p: "Adding, editing, switching, ordering, removing and importing reviews all need the **user:manage** permission — the owner, an administrator, or a Manager or Dispatcher — and the **Reviews** row in Settings is shown only to them. Reviews are shown as they were typed; FieldQuo never rewrites a customer's words." },
        ],
      },
    ],
    faq: [
      { q: "Does FieldQuo pull my Google reviews in automatically?", a: "No. Copy them from your Google profile and paste them in — the paste box accepts a plain list or a CSV. There is no Google connection for reviews." },
      { q: "Why does the count say 2 when I have 12 reviews?", a: "Only switched-on reviews are counted, and only the first six of those. Ten of yours are either switched off or beyond the sixth position." },
      { q: "Do the ratings from the review-request email become testimonials?", a: "No. The 1-to-5 answers feed the satisfaction KPI and are never published. A testimonial is only what you add here yourself." },
    ],
  },

  "referrals-from-clients": {
    title: "Referrals from clients",
    summary:
      "FieldQuo has no homeowner referral programme — no client referral link and no reward for a client who sends a neighbour. What exists is Refer & Earn, between contractors, and this article says what to do with a client referral in the meantime.",
    updated: "2026-09-12",
    intro: [
      "Word of mouth is how most contractors get their next job, so it is fair to ask whether FieldQuo gives a client a link to share or a credit when their neighbour books. It does not. The referral feature in the product — **Refer & Earn** in the sidebar and the public page it links to — is FieldQuo's own programme, one contractor recommending the software to another. Nothing in it involves a homeowner.",
      "This page says that plainly so you do not go looking for a control that is not there, then covers what the product does offer and how to keep track of a client referral with what exists today.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What FieldQuo does not do",
        blocks: [
          { bullets: [
            "**No referral link for a client.** A client record has no shareable code and no “refer a friend” page. The public page at /refer/… is addressed to another contractor, not to a homeowner.",
            "**No reward to a client.** No discount, no credit, no free visit is issued to a client for a referral, and no such reward is tracked.",
            "**No “referred by” field.** A client record does not carry who referred them, and a lead does not carry a referring client. The lead board's source names the channel — the website form, the booking link, the receptionist, an import — not a person.",
            "**No referral email or text to clients.** Nothing asks a client to refer you. The only automated ask after a job is the review request — see [[review-requests|Review requests after a job]].",
          ] },
        ],
      },
      {
        id: "refer-and-earn",
        heading: "What Refer & Earn actually is",
        blocks: [
          { p: "**Refer & Earn** — in the **Grow** group of the sidebar and again under **Settings → Account** — is for telling another business about FieldQuo. Your company has a referral link; when another contractor signs up through it, they get their first month free, and you get one month added to your own subscription once they actually pay. It is a contractor-to-contractor programme, run by FieldQuo, and the people who see the page are the owner and administrators." },
          { figure: "live:app-settings-refer", caption: "Refer & Earn — your referral link, share by email or text, and the businesses you have referred with whether each is credited yet." },
          { bullets: [
            "The reward is **one month each way**, and yours lands only when the referred company makes its first payment — never on signup.",
            "You cannot refer yourself, and a company that already exists cannot redeem a link.",
            "Full detail: [[refer-another-business|Refer another business]] and [[referral-months|Referral months]]. What the other contractor sees: [[the-referral-page|The referral page]].",
          ] },
        ],
      },
      {
        id: "tracking-a-client-referral",
        heading: "Keeping track of a client referral yourself",
        blocks: [
          { bullets: [
            "**Write it in Notes.** On the new client's record, put “Referred by Marie Tremblay” in **Notes**. Notes are internal and show on the record — see [[client-notes|Client notes]].",
            "**Record what you paid for it.** If you thank a client with a gift card or a discount, log it under **Marketing → Spend** with the platform **referral**, the amount, and the leads and conversions it brought. It then shows in your cost per lead beside Facebook and Google. See [[marketing-spend|Marketing spend]].",
            "**Ask for reviews instead.** A review on Google is the referral that scales, and that one FieldQuo does automate — see [[ask-for-reviews-automatically|Ask for reviews automatically]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Will there be a client referral programme?", a: "Not today, and this page will say so until the product does it. Anything you read elsewhere promising a homeowner referral reward is not describing FieldQuo." },
      { q: "Can a client use my Refer & Earn link?", a: "Only if they run a field-service business and sign up for FieldQuo themselves. It gives them a free month of the software, not anything on their job with you." },
      { q: "Can I see which clients came from referrals?", a: "Only what you wrote in Notes. There is no report of referral sources by client." },
    ],
  },

  "duplicate-clients": {
    title: "Duplicate clients",
    summary:
      "FieldQuo has no merge tool. This is where duplicates come from, what the product already does to avoid them when converting leads and importing past jobs, and how to spot and tidy the ones you have.",
    updated: "2026-09-12",
    intro: [
      "Two records for the same person is the ordinary state of a customer list that has been through a CSV import and a year of leads. FieldQuo does not stop you creating a second “J. Smith”, and it cannot merge two records into one afterwards. What it does is match carefully in the two places records get created without a person typing them — lead conversion and past-job import — and give you a search that finds the duplicates so you can stop using one of them.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A client is only ever created by five things: the **New Client** form, the quote builder's new-client form, the CSV importer, converting a lead, and importing past jobs. The first three create whatever you give them. The last two look for an existing client first, by different rules, because a wrong match is worse than a duplicate — a quote attached to the wrong homeowner is something nobody notices until the invoice goes out." },
        ],
      },
      {
        id: "no-merge",
        heading: "There is no merge",
        blocks: [
          { p: "There is no button to combine two client records, and no delete button on a record. A client who has any quote or invoice can never be deleted, so a duplicate with history stays. The practical answer is to choose one record, keep using it, and leave the other to fall out of use — its documents remain reachable from the Clients list." },
          { warning: "Do not “fix” a duplicate by re-creating documents on the other record. Every quote, job and invoice keeps the client it was written for, and moving them is not possible from the screen." },
        ],
      },
      {
        id: "where-they-come-from",
        heading: "Where duplicates come from",
        blocks: [
          { bullets: [
            "**The CSV import** creates a client for every row that has a name. It does not check whether the name, email or phone already exists, so importing the same file twice doubles the list. Rows without a name, or with an undeliverable email, are skipped and counted.",
            "**Typing a client in the quote builder** while the same person already exists under a slightly different spelling. The picker's search is your defence — search before you add.",
            "**A repeat enquiry with a new email or phone.** Lead conversion matches on email first, then phone; a client who enquires from a new address and a new number with no match becomes a second record.",
            "**Business versus person.** “Beaulieu Renovations” created as a company and “Marc Beaulieu” created as a homeowner are two records by design — one is the business, one is the person.",
          ] },
        ],
      },
      {
        id: "how-fieldquo-avoids-them",
        heading: "What FieldQuo does to avoid them",
        blocks: [
          { table: {
            head: ["Where", "How it matches"],
            rows: [
              ["Converting a lead to a quote", "The lead's email is normalised and looked up first; then the phone. A hit reuses that client. Only with neither does it create a new record. See [[convert-a-lead-to-a-quote|Convert a lead to a quote]]."],
              ["Importing past jobs", "Each row is matched on the client name alone, exactly but ignoring case, and the preview says “existing client” before anything is written. A different email on the row does not stop a name match. Two identical names on file resolve to the older record. See [[import-past-jobs|Import past jobs]]."],
              ["The monthly review in Messages", "A Facebook or Instagram conversation is linked to a client only on an exact email or phone, or a name that also agrees on the address. A name alone is never linked, and a tie is reported rather than picked. See [[the-monthly-review|The monthly review]]."],
              ["Importing clients from a CSV", "No matching. Every named row becomes a client — see above."],
            ],
          } },
        ],
      },
      {
        id: "spot-and-tidy",
        heading: "How to spot and tidy duplicates",
        blocks: [
          { steps: [
            "On **Clients**, search by **phone number** first, then by **email**: those are the two details a person had to give you, and two cards for one number is a duplicate for certain. Search by surname last — two “Tremblay” cards in one city are often two households.",
            "Open both records. The card footers tell you which one has the history — “3 quotes · 1 invoice” against “0 quotes · 0 invoices”.",
            "Keep the record with the history. Copy anything useful from the other — a note, the country, the language — into it with **Edit**.",
            "On the record you are retiring, put “DUPLICATE — use the other record” at the start of **Notes**, and stop selecting it in the quote builder. If it has no documents at all, ask support to remove it.",
          ] },
          { tip: "Before a CSV import, search for a few names from the file. If they are already there, trim the file to the new rows only — the importer will not do it for you." },
        ],
      },
    ],
    faq: [
      { q: "Will FieldQuo warn me when I add a client who already exists?", a: "No. Neither the New Client form nor the quote builder checks for an existing name, email or phone. Search first." },
      { q: "Can support merge two records for me?", a: "There is no merge in the product, for support either. Support can remove a record that has no quotes and no invoices; a record with documents stays." },
      { q: "Does importing a CSV twice create duplicates?", a: "Yes, one full set. The importer creates every named row and does not match against existing clients." },
    ],
  },
};
