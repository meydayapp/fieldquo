// content/help/en/messages-4.js
//
// Part 4 of the “messages” category in English (see the composer,
// messages.js). Slugs assigned to this part (lib/help/tree.js):
// ai-employee-reference-library, ai-employee-error-codes,
// how-ai-employee-troubleshooting-works.
//
// Every sentence below was read off the code on 2026-10-04:
// app/components/aiEmployee/ReferenceLibrary.js, lib/aiEmployee/reference.js,
// referencePages.js, referenceRuns.js, errorCodes.js,
// knowledge/codes/fieldquo.js, clientContext.js, troubleshooting.js,
// tools.js (book_callback), decide.js (the reply cap), app/app/leads/page.js
// (CallbackBadge). Labels are the `en` block of app/i18n/appMessages.js.
export const ARTICLES = {
  "ai-employee-reference-library": {
    title: "The AI employee's reference library: the manuals it reads",
    summary:
      "Upload the manuals for the equipment you install — PDFs, read page by page and kept private — and your AI employee answers from them and names the page.",
    updated: "2026-10-04",
    intro: [
      "**Settings → AI employee → Reference library** is everything your AI employees may answer from: your policy, your troubleshooting notes, and the manufacturers' manuals for what you install. Every employee reads the same library, and an answer names the document — and, for a PDF, the page — it came from.",
    ],
    sections: [
      {
        id: "what-it-reads",
        heading: "What you can upload",
        blocks: [
          { bullets: [
            "**A PDF manual** — stored privately and read page by page. It is never shown to your clients; the assistant paraphrases it and cites the page.",
            "**An .xlsx or .csv code list** — read as text.",
            "**Plain text** (.txt, .md), or text you paste in with **Paste text instead**.",
            "Word files can't be read yet — paste the text or export it as .txt. A password-protected PDF is refused by name: save a copy without the password and upload that.",
          ] },
          { p: "Up to 400 pages of one PDF are read. Past that the row says **Pages after 400 weren't read — split the PDF to add the rest.**" },
        ],
      },
      {
        id: "pages",
        heading: "Read pages, scanned pages",
        blocks: [
          { p: "Each PDF row says how much of it was actually read: **Read 41 of 42 pages**. A page that is only a scanned picture has no text to read, and the row names it: **Couldn't read pages 12–14 (scanned)**. A PDF that is entirely scanned is marked unread — never as ready." },
          { p: "**Read scanned pages with AI — about 28 credits** reads those pages from their images, on FieldQuo's standard AI model, paid from your AI credit. The price is on the button before you press it (about 2 credits for one page, 28 for sixty). The pages are rendered in your browser from your own copy — if you reload the screen, it asks you to **Choose the same PDF again** and checks it is the same file before anything is sent." },
          { note: "Reading text PDFs is free — it happens in code, with no AI. Only the scanned-page reading and the error-code extraction below use AI credit, and only when you press their button." },
        ],
      },
      {
        id: "tags",
        heading: "Tags: the right manual first",
        blocks: [
          { p: "**Tags** on a row take a **Brand**, a **Model (or how it starts)**, the **Equipment, e.g. furnace** and a **Trade**. When a customer's conversation belongs to a client whose equipment is on file, the manual tagged for that brand and model is read first; then your other uploads, the ones the message names first. The amount of material sent with one reply does not grow — tags decide what goes first, not how much." },
        ],
      },
      {
        id: "codes",
        heading: "Error codes from your manuals",
        blocks: [
          { p: "**Extract error codes — about 3 credits** reads the pages of a manual that look like an error-code table and lists each code with its page, under the manual's **Brand** tag (add it first). The codes arrive **not checked yet**: until you press **Looks right**, the assistant only uses one while naming the manual and page out loud. **Edit** fixes a meaning, **Don't use** stops it being used (it is kept, marked **not used**), **Use again** brings it back. See [[ai-employee-error-codes|Error codes]]." },
        ],
      },
    ],
  },

  "ai-employee-error-codes": {
    title: "Error codes: what the AI employee says when a display shows one",
    summary:
      "When a customer says their washer shows UE or their furnace flashes 13, the assistant looks the code up — your manuals first, then FieldQuo's own references — and never guesses.",
    updated: "2026-10-04",
    intro: [
      "Customers often message with a code: “my Samsung washer says UE”. Your **Tech support** and **Receptionist** employees can **look up an error code**: what it means, a few safe things a homeowner can try, when to stop, how urgent it is, and where that comes from.",
    ],
    sections: [
      {
        id: "where-from",
        heading: "Where an answer comes from",
        blocks: [
          { steps: [
            "Codes extracted from **your own manuals** in the [[ai-employee-reference-library|reference library]] — the ones you marked **Looks right** first, then the ones **not checked yet** (said with the manual and page).",
            "**FieldQuo's references**: a table of common codes for Samsung, LG and Whirlpool washers, Bosch dishwashers, Google Nest thermostats, Carrier and Goodman/Amana/Daikin furnaces, Rheem and Bradford White water heaters and Rinnai tankless heaters, each with its source. It is written in FieldQuo's own words from the makers' manuals and support pages.",
          ] },
          { p: "At most three answers come back. If neither has the code, the assistant says it isn't in your references and books a callback — it never says what it thinks a code means." },
        ],
      },
      {
        id: "brand",
        heading: "It knows the brand when you do",
        blocks: [
          { p: "The same letters mean different things on different brands — OE is an overflow on a Samsung washer and a drain problem on an LG. When the conversation belongs to a client with equipment on file (see [[client-equipment-and-warranties|Client equipment and warranties]]), the assistant uses that brand and model and does not ask again; otherwise it asks which brand, and the model number on the label if they can see it. If two pieces on record could be it, it asks which one, by its name." },
        ],
      },
      {
        id: "urgent",
        heading: "Urgent codes",
        blocks: [
          { p: "A code marked urgent — a leak sensor, an overflow, a water-heater over-temperature lockout — is not a walk-through: the assistant books an urgent callback and hands the conversation to a person. Anything that sounds like an emergency gets the emergency line first, exactly as before." },
          { warning: "The steps in FieldQuo's table never go behind a panel, use a meter, or touch gas or wiring. Those are a technician's, and the assistant hands them off." },
        ],
      },
    ],
  },

  "how-ai-employee-troubleshooting-works": {
    title: "How AI troubleshooting works: from a code to a callback",
    summary:
      "The assistant helps with something minor, says it will book a tech call if it persists — and when the customer writes back, the callback is booked without asking them again.",
    updated: "2026-10-04",
    intro: [
      "This is what your **Tech support** employee does with “my washer stopped mid-cycle”, step by step — and what lands in front of your team at the end.",
    ],
    sections: [
      {
        id: "steps",
        heading: "The conversation",
        blocks: [
          { steps: [
            "It reads the client's equipment on file, if the conversation belongs to a known client: make, model, install date and the warranty date on the record. It never sees prices, invoices or balances, and never reads a serial number out.",
            "It asks only for what is missing, then looks the code up and gives at most two or three safe steps from your manual or FieldQuo's references, naming where they come from.",
            "It notes what it suggested, and the reply ends with: **If the problem persists, send us another message and we'll book a call with one of our techs.** — added by FieldQuo, in the client's language, so it is there every time.",
            "If they write back that it's still happening, it books the callback straight away — the note says what the equipment is, the code, and what was already tried. If it now sounds urgent, that comes first.",
          ] },
        ],
      },
      {
        id: "what-the-team-sees",
        heading: "What your team sees",
        blocks: [
          { bullets: [
            "**A known client** gets a ticket on their record — type **Warranty** when the warranty date on file hasn't passed, otherwise **Repair** — linked to the job that installed the equipment, priority **Urgent** when the assistant marked it so. See [[client-tickets|Client tickets]].",
            "**Anyone else** becomes a lead with the **Call back requested through your AI assistant** badge on the [[the-leads-board|Leads board]], with **Urgent** in front when it is.",
          ] },
          { p: "The assistant never promises a time, and never says what is or isn't covered — a warranty date on the record is something it mentions and notes for the team; the team decides." },
        ],
      },
      {
        id: "reply-limit",
        heading: "The reply limit",
        blocks: [
          { p: "**Most replies in one conversation** still applies. The one exception: when the assistant told the customer to write back if the problem persists, their next message is answered once even if the limit was reached — and that reply can only book the callback or hand the conversation to a person. A limit of 0 (paused) is never overridden." },
        ],
      },
    ],
  },
};
