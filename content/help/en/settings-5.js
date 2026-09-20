// content/help/en/settings-5.js
//
// Part 5 of the "settings" category (en): My calendar — the member's own
// Google Calendar connection. Its own part file so the calendar work can
// land without touching the four parts other writers hold.
export const ARTICLES = {
  "settings-my-calendar": {
    title: "My calendar",
    summary:
      "Connect your own Google Calendar: every visit assigned to you appears on it and moves when the office moves it, and your personal events block you from being booked — without anyone at the company ever seeing what they are.",
    updated: "2026-09-20",
    intro: [
      "**Settings → My calendar** is one of the rows every member sees, because nothing on it belongs to the company: it is where **your** visits go, and what **your** other commitments block. The page has one section today, **Connect Google Calendar**, and it runs in both directions at once.",
      "FieldQuo creates and updates its own events only; it never edits yours. That sentence is printed on the screen and it is the whole rule: the events FieldQuo writes carry a private mark, and FieldQuo only ever touches an event that carries it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "What is on the screen",
        blocks: [
          { p: "Before you connect: a **Connect Google Calendar** button. After: **Connected as your@gmail.com since 20 Sep 2026**, two switches — **Write my visits to Google Calendar** and **Use my Google busy time** — a **Disconnect** button, and a **Reconnect** link for the day Google asks you to sign in again. If the last sync failed, the reason is printed under the email in one line." },
          { note: "On a FieldQuo deployment that has no Google sign-in set up yet, the section says so in one sentence and shows no button. A button that cannot work is worse than none." },
        ],
      },
      {
        id: "what-goes-to-google",
        heading: "What FieldQuo writes to your calendar",
        blocks: [
          { bullets: [
            "Every **appointment, job visit and booking assigned to you** — created when it is assigned, moved when the office or the client moves it, removed when it is cancelled or given to somebody else; a completed visit stays as history.",
            "The title says what it is and who it is for: **Site visit — Jane Doe**, **Callback — Jane Doe**, **Video call — Jane Doe**, or the job's title for a crew visit. The location is the site address, so Google Maps navigation works straight from the event. The description carries the FieldQuo link.",
            "A **video call** gets a Google Meet link minted with the event, and the same link is put on the booking so the client's confirmation can carry it.",
            "Nothing else. FieldQuo never reads your event titles and never writes anything that is not one of its own.",
          ] },
          { warning: "Delete a FieldQuo event by hand and it comes back at the next sync, because the visit is still booked. Cancel it in FieldQuo instead." },
        ],
      },
      {
        id: "what-google-tells-fieldquo",
        heading: "What your calendar tells FieldQuo",
        blocks: [
          { p: "With **Use my Google busy time** on, the times your own calendar marks as busy count as busy in FieldQuo — on the public booking page, for the phone receptionist, for the AI employee and for a dispatcher moving a visit onto you. Only the times, never the titles: FieldQuo asks Google the one question *when is this person busy?*, and Google's answer has no words in it. The calendar page draws those blocks grey, labelled **busy (Google)**, and nothing more." },
          { p: "Switch it off and your personal calendar is not read at all. Switch **Write my visits** off and every event FieldQuo created leaves your calendar at once; switch it back on and they return." },
        ],
      },
      {
        id: "disconnect",
        heading: "Disconnecting",
        blocks: [
          { steps: [
            "Press **Disconnect** and confirm.",
            "Every event FieldQuo created is removed from your calendar — each one checked for FieldQuo's mark first, so nothing of yours is touched.",
            "FieldQuo's access is revoked at Google and the stored credential is deleted. Your visits stay in FieldQuo exactly as they were.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can my manager see what is on my personal calendar?", a: "No. FieldQuo receives busy intervals with no titles, and shows them as grey blocks that say only busy (Google)." },
      { q: "Which calendar does it write to?", a: "Your primary Google calendar, under the account you chose on Google's consent screen." },
      { q: "Why does Google warn that the app is unverified?", a: "While FieldQuo's Google verification is pending, only accounts FieldQuo has listed as test users can connect, and Google shows a warning screen first. Ask support to add you if the screen refuses you." },
      { q: "Does this replace the Subscribe feed?", a: "No. A subscribed feed is one-way and read-only; this connection writes to your calendar and reads your busy time. Use whichever suits you, or both." },
    ],
  },
};
