// content/help/en/messages-3.js
//
// Part 3 of the “messages” category in English (see the composer,
// messages.js). Slugs assigned to this part (lib/help/tree.js):
// fetch-older-facebook-and-instagram-history,
// photos-and-videos-from-facebook-and-instagram,
// facebook-leads-checked-against-your-records.
//
// Every sentence below was read off the code on 2026-10-03:
// lib/meta/historyBackfill.js, lib/messaging/ingest.js (`history`),
// lib/meta/leadsFetch.js (pollForm), lib/messaging/mediaFetch.js
// (MESSENGER_MAX_BYTES), lib/messaging/attachments.js
// (mergeAttachmentsOnRedelivery, MEDIA_FETCH_MAX_ATTEMPTS),
// lib/leads/identityMatch.js, lib/leads/identityLinks.js,
// lib/leads/messageReview.js and lib/leads/qualifiers.js (ASKED_BY_SOURCE).
// Labels are the `en` block of app/i18n/appMessages.js.
export const ARTICLES = {
  "fetch-older-facebook-and-instagram-history": {
    title: "Fetch older Facebook and Instagram history",
    summary:
      "Bring in the conversations and lead-form submissions that came before you connected — quietly, without alerts or automatic replies, and without duplicates.",
    updated: "2026-10-03",
    intro: [
      "When you connect your Facebook Page, FieldQuo imports the recent conversations right away. **Older history** goes further: every Messenger and Instagram conversation Facebook still returns, and the last 90 days of lead-form submissions Facebook keeps.",
    ],
    sections: [
      {
        id: "where",
        heading: "Where to find it",
        blocks: [
          {
            bullets: [
              "**Conversations:** Settings › Meta Ads, on the Facebook & Instagram card, under the import line — **Older history**.",
              "**Lead forms:** Settings › Meta Ads, in the lead forms panel, once at least one form is switched on.",
            ],
          },
          { p: "Each line says how many conversations, messages or leads have come in, how far back it has reached, when it last ran, and whether Facebook asked it to pause." },
        ],
      },
      {
        id: "what-happens",
        heading: "What happens when it runs",
        blocks: [
          {
            steps: [
              "It starts on its own after you connect the Page, and when you switch a lead form on. **Fetch older** starts it again from the top whenever you want.",
              "It works through the history in chunks, a few times an hour, and picks up exactly where it stopped. If Facebook asks it to slow down, the line says **Paused** and when it will resume.",
              "Each conversation is stored with all its messages Facebook returns, including the older ones above the most recent fifty.",
              "Each lead-form submission becomes a lead, unless it is somebody already on your board (see [[facebook-leads-checked-against-your-records|Facebook leads checked against your records]]).",
            ],
          },
        ],
      },
      {
        id: "quiet",
        heading: "History wakes nobody",
        blocks: [
          {
            bullets: [
              "Conversations older than your inbox's starting point arrive **marked done**, with no unread badge and no waiting clock. A recent message on the same conversation opens it as usual.",
              "No automatic reply and no AI employee draft is written to history.",
              "Leads older than a day are added without a **new lead** alert, and the lead says **Imported from Facebook history**. A form somebody filled in this morning is not history — it is announced like any other lead.",
            ],
          },
          { note: "Running it twice never duplicates anything: every message and every lead is matched on Facebook's own id." },
        ],
      },
    ],
    faq: [
      {
        q: "Why only 90 days of lead forms?",
        a: "Facebook keeps lead-form submissions for 90 days. Anything older is no longer available to any app.",
      },
      {
        q: "Does reviewing old conversations use my AI credit?",
        a: "Only for conversations where the customer last wrote within the past 90 days, and at most 25 per run. Older conversations are checked against your records without AI, for free.",
      },
    ],
  },

  "photos-and-videos-from-facebook-and-instagram": {
    title: "Photos and videos from Facebook and Instagram",
    summary:
      "Pictures, videos, voice notes and files people send on Messenger and Instagram are copied into FieldQuo so they never expire — and a failure says why.",
    updated: "2026-10-03",
    intro: [
      "The link Facebook gives for an attachment expires after a while. So FieldQuo copies every photo, video, voice note and file into its own storage within a minute or so, and the conversation shows the copy, not Facebook's link.",
    ],
    sections: [
      {
        id: "states",
        heading: "What you see in the conversation",
        blocks: [
          {
            bullets: [
              "**Still arriving:** the copy has not finished yet.",
              "**The photo, video, player or file:** the copy is done and stays.",
              "**Could not be fetched, with the reason and a Retry button:** for example a file over the size limit, or a link Facebook had already expired.",
            ],
          },
        ],
      },
      {
        id: "limits",
        heading: "Size limits",
        blocks: [
          { p: "Messenger and Instagram carry attachments up to 25 MB, and FieldQuo accepts the same. WhatsApp has its own, smaller limits per type." },
          { tip: "An attachment whose link had expired is fetched again automatically the next time the conversation is refreshed from Facebook, because Facebook hands over a fresh link." },
        ],
      },
      {
        id: "history",
        heading: "Older conversations",
        blocks: [
          { p: "Attachments in history fetched with **Older history** are copied the same way. A photo already copied is never downloaded again when the same conversation is fetched a second time." },
        ],
      },
    ],
  },

  "facebook-leads-checked-against-your-records": {
    title: "Facebook leads checked against your records",
    summary:
      "How FieldQuo spots a Facebook lead that is somebody you already have, folds it in instead of making a copy, and lets you undo it.",
    updated: "2026-10-03",
    intro: [
      "The same person often fills in your Facebook form and also messages your Page. FieldQuo checks every Facebook lead against your open leads, your Messenger and Instagram conversations and your clients before adding it.",
    ],
    sections: [
      {
        id: "same-person",
        heading: "When it is the same person",
        blocks: [
          {
            bullets: [
              "**Linked:** the same email, the same phone number (when the names do not disagree), the same Facebook or Instagram id, or the same full name **and** address.",
              "**Only shown, never linked:** a name alone, or a shared family phone where the names differ, or the same name at a different address.",
            ],
          },
          { p: "A form submission that matches an open lead is folded into that lead instead of becoming a second one. The lead only gains what it was missing — an empty phone or email, the campaign — and the drawer shows it under **Same person**, with what the form said." },
        ],
      },
      {
        id: "undo",
        heading: "Not the same person? Undo it",
        blocks: [
          {
            steps: [
              "Open the lead and find **Same person** in the drawer.",
              "Press **Not the same person** on the link that is wrong, then confirm.",
            ],
          },
          { p: "Nothing is deleted. A folded form submission becomes its own lead again, anything the link filled in is put back if nobody has changed it since, and those two are never linked again." },
        ],
      },
      {
        id: "review",
        heading: "The message review",
        blocks: [
          { p: "For a Messenger, Instagram or WhatsApp conversation, the lead drawer and the conversation show a verdict with its evidence:" },
          {
            table: {
              head: ["Verdict", "What it means"],
              rows: [
                ["Genuine lead", "They want work done. A lead is made."],
                ["Not a lead", "Spam, a wrong number, somebody looking for a job, or a supplier selling something. No lead."],
                ["Existing client", "A client on file. A lead is made only if they ask for new work, and it is tied to that client."],
                ["Already converted", "A quote, job or invoice already exists for them. No new lead — the documents are listed."],
              ],
            },
          },
          { p: "Who the person is comes from your records, free. Whether they want work comes from the AI, paid from your AI credit. Without AI credit, the review says so and only the records-based verdicts appear." },
          { tip: "If the review linked a conversation to the wrong client, press **Not this client** on the conversation." },
        ],
      },
      {
        id: "scoring",
        heading: "Scoring is fair to Facebook leads",
        blocks: [
          { p: "A missing budget or timing only counts against a lead when the form actually asked. Facebook forms, conversations and leads typed in by hand are scored on what they can capture, and the reasons say **Budget unknown** or **Timing unknown — not counted**." },
        ],
      },
    ],
  },
};
