// content/help/en/team-and-access-3.js
//
// Part 3 of “team-and-access”: the HR file — employee documents, new-hire
// onboarding, policies, the manager's log book, and the compliance
// overview. Facts from app/api/hr/*, lib/hr/*, lib/onboarding/*.
export const ARTICLES = {
  "employee-documents": {
    title: "Employee documents and expiry reminders",
    summary:
      "Keep each person's certifications, licences, ID, contracts and tax forms on their HR file, mark what you have checked, and get reminded before a ticket lapses.",
    updated: "2026-09-13",
    intro: [
      "Every person on **Manage Team** has an **HR file** — the paperwork the company holds on them. A manager files a contract or a scanned licence there; the person uploads their own WHMIS card or driver's licence from **My documents** on their phone. Nothing on the file is ever deleted: an old certificate is **archived**, so “which licence were we relying on in March” stays answerable.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A document has a **kind** (certification, licence, ID, contract, tax form, policy acknowledgement, other), a title, the file itself, and optionally an issue date, an expiry date and the number printed on it. Managers can add a private note — where the original is, who checked it — which the person never sees." },
          { p: "A document the person uploaded themselves shows **Not yet verified** until a manager presses **Mark verified**. The difference matters on the compliance screen: “she says she has a forklift ticket” and “we have looked at it” are two different facts." },
        ],
      },
      {
        id: "how-to-file",
        heading: "How to file a document",
        blocks: [
          { steps: ["Open **Manage Team** and press **HR file** under the person's name.", "In **Documents**, press **Upload**, pick the file and its kind, and add the expiry date if the paper has one.", "Press **File document**. To mark a person's own upload as checked, press **Mark verified** on the row."] },
          { tip: "The person can do the first upload themselves: **My documents** on their phone accepts a certification, a licence, an ID or another document of their own. Contracts and tax forms come from the company side." },
        ],
      },
      {
        id: "expiry",
        heading: "Expiry reminders",
        blocks: [
          { p: "A certification or licence with an expiry date is watched every morning. The person is told **30 days** and **7 days** before it lapses; their managers are told at 7 days. Each reminder goes out once — a document sitting at twelve days for a week produces one message, not seven." },
          { bullets: ["A document with **no expiry date** is shown as “no expiry recorded”, never as expired. A blank field is a gap in the paperwork, not a lapsed ticket.", "Changing the expiry date on a row starts the countdown again.", "Archiving a document stops its reminders."] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators and managers (anyone who can open **Manage Team**) see every person's file. Each person sees their own documents on **My documents** — including what the company filed about them — but not the manager's private notes, and never another person's file." },
        ],
      },
    ],
    faq: [
      { q: "Can I delete a document filed by mistake?", a: "No. Press **Archive** — it leaves the list and stops its reminders, and the record of what was on file stays." },
      { q: "Where do the reminders arrive?", a: "In the notification bell, and as a push notification on any phone the person turned notifications on for." },
    ],
  },

  "new-hire-onboarding": {
    title: "New-hire onboarding checklists",
    summary:
      "A checklist a new hire works through on their phone — tasks, documents to upload, policies to sign, the tax form — started from the invitation and tracked on Manage Team.",
    updated: "2026-09-13",
    intro: [
      "Tick **Start onboarding checklist** when you invite somebody and, the moment they accept, they get the company's new-hire checklist on their phone: confirm their contact details, upload a piece of ID, fill in the tax form, do the safety walk-through. The roster shows **Onboarding 3/7** beside their name until it is done.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A checklist is a list of items of four kinds. A **task** is ticked by hand — by the person or by a manager on their behalf, with the name on it. A **document to upload**, a **policy to sign** and a **form to fill in** tick themselves the moment the evidence exists on the person's file. Nobody can tick “upload your ID” without an ID." },
          { p: "The first time you open **Manage Team → Onboarding** the default checklist is created for your company. Its tax-form items follow your country: the federal and provincial TD1 in Canada, the W-4 in the United States." },
        ],
      },
      {
        id: "how-to",
        heading: "How to start and follow a checklist",
        blocks: [
          { steps: ["Invite the person from **Manage Team → New user** with **Start onboarding checklist** ticked (it is on by default).", "Or open their **HR file** and press **Start checklist** for somebody already on the roster.", "Follow progress on the roster chip, on the compliance screen, or on their file, where each item says who did it and when."] },
          { note: "Somebody halfway through keeps the list they started with. Editing the checklist on **Manage Team → Onboarding** describes the next hire." },
        ],
      },
      {
        id: "tax-forms",
        heading: "The tax form",
        blocks: [
          { p: "The person answers the TD1 or W-4 questions on their phone and signs with their name. FieldQuo keeps the answers on their file and prints them as a PDF for the payroll admin. **Nothing is sent to any government and no withholding is calculated** — the screen says so. The social insurance or social security number is never typed into FieldQuo; the printed sheet leaves that box to be written by hand." },
        ],
      },
      {
        id: "notifications",
        heading: "Who is told",
        blocks: [
          { bullets: ["The person, when the checklist starts, and once a week while any item is overdue.", "The managers, when every required item is done — the checklist stamps itself complete.", "Optional items never hold a checklist open."] },
        ],
      },
    ],
    faq: [
      { q: "Can I have more than one checklist?", a: "Yes — one per kind of hire, on **Manage Team → Onboarding**. One is the default the invitation uses." },
      { q: "What if a person's licence is archived later?", a: "The “upload your licence” item re-opens, because the file no longer holds what the checklist said it held." },
    ],
  },

  "company-policies": {
    title: "Company policies and acknowledgements",
    summary:
      "Publish the rules your people read and sign — safety, vehicles, hours, phones — see who has signed, remind the rest, and never lose the text somebody signed.",
    updated: "2026-09-13",
    intro: [
      "**Settings → Policies** holds the rules your crew reads and signs on their phone. Four starters are offered — Safety & PPE, Vehicle use, Time & attendance, Phone & social media on site — in English, French and Spanish; you edit the copy before you publish.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A policy has a title, a short text, a version number, and a publish scope: **Everyone**, or **Only these job titles** (the titles you gave people on Manage Team). A policy that must be signed shows **3/8 signed** on the list; open it to see who has and who hasn't." },
          { warning: "A signed version is never rewritten. When you change the text after anybody has signed, FieldQuo publishes version 2, asks everyone again, and keeps every earlier signature on the version it was given for. A typo fixed before anybody signed is corrected in place." },
        ],
      },
      {
        id: "how-to-publish",
        heading: "How to publish a policy",
        blocks: [
          { steps: ["Open **Settings → Policies** and press **New policy**, or **Start from a template**.", "Edit the title and text — ## makes a heading, - makes a bullet.", "Choose whether people must sign it and who it applies to, then press **Publish**."] },
        ],
      },
      {
        id: "signing",
        heading: "How a person signs",
        blocks: [
          { p: "On **Policies** in their own app the person reads the text, types their full name and presses **Acknowledge**. FieldQuo records the name, the time, the address and browser it came from, and a fingerprint of exactly the text on screen — the same audit a client's quote signature carries. A tab left open across a re-publish cannot sign the old text." },
          { bullets: ["**Remind** sends a notification to everyone in scope who has not signed the current version.", "A person without a login cannot be reached in the app; the list says so beside their name."] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators and managers publish and see the signature list. Each person sees only the policies that apply to them, and their own signatures." },
        ],
      },
    ],
    faq: [
      { q: "Can I unpublish a policy?", a: "Archive it. It leaves everyone's list; the signatures already given stay on record." },
      { q: "Does a new hire have to sign every policy?", a: "Only if the checklist asks for it — add a **Policy to sign** item to the onboarding checklist." },
    ],
  },

  "the-manager-log-book": {
    title: "The manager's log book",
    summary:
      "One page for the day as it was — weather, who called in, a client who rang, a machine that broke — company-wide, by day, with tags to find it again.",
    updated: "2026-09-13",
    intro: [
      "**Log book**, under People, is the manager's day book. It is not a job's diary — that lives on the job — it is the company's: “rain stopped the roof job at 11”, “Marc called in sick”, “the compressor is at the shop”. Newest day first, filtered by day or by tag.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "An entry is a day, a few lines, and any of six tags: **Weather**, **Incident**, **Staffing**, **Client**, **Equipment**, **Other**. The composer at the top is prefilled with today. The person who wrote an entry can correct it; nobody can delete one." },
        ],
      },
      {
        id: "how-to",
        heading: "How to write and find entries",
        blocks: [
          { steps: ["Open **Log book** in the sidebar (owners, administrators and managers).", "Type what happened, tap the tags that fit, and press **Save entry**.", "To look back, pick a day or tap a tag — the list narrows to matching entries."] },
        ],
      },
      {
        id: "when-to-use-which",
        heading: "Log book or job daily log?",
        blocks: [
          { table: { head: ["Write it in", "When"], rows: [["**Log book**", "It is about the company or the day: weather, staffing, a call, a breakdown."], ["**The job's daily log**", "It is about that one job: what was done, what is left, what the client said on site."], ["**A safety incident**", "Somebody was hurt or nearly was — the safety screen asks the questions a report needs."]] } },
        ],
      },
    ],
    faq: [
      { q: "Can a crew member read the log book?", a: "No. It is a managers' screen, gated on the same access as Manage Team." },
    ],
  },

  "hr-and-compliance": {
    title: "HR & compliance overview",
    summary:
      "One table, one row per person: documents expiring or expired, onboarding unfinished, policies unsigned, write-ups unacknowledged — with a link into each file to fix it.",
    updated: "2026-09-13",
    intro: [
      "**Manage Team → Compliance** answers “who is missing what” across the roster in one screen. People with something to chase sort to the top; each count links into the person's HR file, where the thing is fixed.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What the columns mean",
        blocks: [
          { table: { head: ["Column", "What it counts"], rows: [["**Documents**", "Certifications and licences expired or expiring within 30 days, and uploads by the person not yet verified."], ["**Onboarding**", "The checklist's progress, and how many items are overdue."], ["**Policies**", "Policies that apply to the person that they have not signed in the current version."], ["**Write-ups**", "Warnings and write-ups waiting for the person's acknowledgement."]] } },
          { p: "On a phone the same rows are cards. **Only people with something to chase** hides the rows that are all clear." },
        ],
      },
      {
        id: "performance-file",
        heading: "The performance file",
        blocks: [
          { p: "Each person's HR file carries a timeline of **notes**, **recognitions**, **warnings** and **write-ups** written by managers, beside the late and no-show flags the time clock recorded against the rota. A note can be private to managers or visible to the person; a warning or write-up can require their acknowledgement, which they give by typing their name on their own screen. Notes are never edited or deleted — a mistake is corrected with a new note that says so." },
        ],
      },
      {
        id: "what-it-is-not",
        heading: "What this screen does not do",
        blocks: [
          { warning: "It shows what your company recorded. It does not check labour law — break rules, overtime thresholds, notice periods — for your province or state, and it does not tell you whether a person is legally allowed on site." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Owners, administrators and managers. A person sees their own pending items — policies to sign, notes to acknowledge, their checklist, their expiring documents — on their own screens, never anybody else's." },
        ],
      },
    ],
    faq: [
      { q: "Why does a person show “—” under Onboarding?", a: "No checklist was ever started for them. Start one from their HR file if you want one." },
    ],
  },
  // ── The sales-portal agency tier (lib/sales/agency.js) ───────────────────
  // Written for the call-centre agencies FieldQuo hires and the reps who work
  // for one — the one public, translated place their portal can point at.
  // Every fact is read from lib/sales/agency.js, lib/sales/payouts.js and
  // app/sales/agency/page.js on the day it was written.

};
