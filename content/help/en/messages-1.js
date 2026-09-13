// content/help/en/messages-1.js
//
// Part 1 of the “messages” category in English (see the composer,
// messages.js). Slugs assigned to this part (lib/help/tree.js):
// the-messages-inbox, connect-your-facebook-page-and-instagram,
// whatsapp-business, conversation-status-and-who-looks-after-it,
// private-notes-and-temperature, the-ai-employee, the-monthly-review,
// client-texts-on-my-way-and-reminders, email-templates.
//
// Every sentence is read off the code: app/app/messages/page.js and
// lib/messaging/* for the inbox, lib/meta/client.js and the two settings
// panels for the Meta connections, lib/messaging/conversationScore.js for the
// temperature numbers, lib/aiEmployee/* for the AI employee,
// lib/messaging/monthlyReview.js and lib/ai/conversationReview.js for the
// review, lib/sms/renderTemplate.js for the two client texts, and
// app/app/settings/email-templates for the templates. Where Meta's App Review
// still gates a channel, the article says what the screen says.
export const ARTICLES = {
  "the-messages-inbox": {
    title: "The Messages inbox",
    summary:
      "Where your Facebook Page, Instagram and WhatsApp Business conversations land, how they are grouped, and what every button on the screen does.",
    updated: "2026-09-12",
    intro: [
      "**Messages** is one inbox for the strangers who write to your business on Facebook, Instagram and WhatsApp. Every conversation is stored in FieldQuo, grouped by whether it is your turn to answer, and carries the two things the rest of the product cares about: whether it became a job, and how long the person waited. That is what makes the month-end review possible — see [[the-monthly-review|The monthly review of your inbox]].",
      "The row sits in the sidebar with a **Preview** badge, and the screen opens under an **Early preview** banner. The inbox itself is finished; what FieldQuo is waiting on is Meta's approval of Page messaging for its app. Until that lands for your company, the screen says so in one sentence and the reply box is switched off with the same reason printed on it. Nothing is invented in the meantime — an empty inbox reads **No conversations yet**, never a sample.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Business accounts only. FieldQuo reads the conversations of the Facebook Page and the Instagram professional account you connect, and of a WhatsApp Business number — never anybody's personal messages, and there is no code path to them. Connecting is done once, under **Settings → Meta Ads**; see [[connect-your-facebook-page-and-instagram|Connecting your Facebook Page and Instagram]] and [[whatsapp-business|WhatsApp Business messages]]." },
          { p: "A conversation is never deleted from the inbox. It is answered, parked, marked done, and judged — **Won**, **Lost**, **No reply** or **Not a job** — so that the review at the end of the month has something true to count." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Messages — Facebook Page and Instagram business messages, answered here.** The **Monthly review** button sits top right.",
            "The left pane: **Search conversations**, then the channel chips **All**, **Facebook**, **Instagram**, **WhatsApp**. Both the search and the chips ask the server, so a search finds words inside messages the list has not loaded.",
            "**Refresh from Facebook** — pulls the conversations your Page already had before you connected (the last 30 days). Drawn only when Meta has granted the permission for it and you can write to the inbox.",
            "Four groups, in this order: **Needs a reply**, **Waiting on them**, **Snoozed**, **Done**. Done starts collapsed.",
            "Each row: the person's name, the channel glyph, the last message (**You: …** when it was yours), the time, an unread count, a **Waiting 3 days** badge while they wait on you, and the temperature chip — **Warm 35**, **Hot 72**, **Cold 0**. A red triangle means your last reply was **Not delivered**.",
            "The open conversation in the middle, with **Conversation 41** (its number), the channel, the outcome chip, and a row of actions: **Open client**, **Open lead**, **Open job**, **Open quote** when one is linked, **Mark done** or **Reopen**, and **Details**.",
            "The right pane, **Details** · **Outcome** · **History**: name, channel, first contact, number, what it is linked to, **What's happening with this?** and **Looking after this**.",
          ] },
        ],
      },
      {
        id: "read-and-reply",
        heading: "How to read and answer a conversation",
        blocks: [
          { steps: [
            "Open **Messages** and pick a row under **Needs a reply**. On a phone the list, the conversation and the details are three screens with a back arrow; on a wide screen they are three panes.",
            "Read the thread. Day dividers and a red unread line show where you had got to; grey system lines record what your team did to it (**Marked won by Dave**, **Reopened**).",
            "Type in **Write a reply** and press **Send**. The **Reply** and **Note** tabs above the box decide where the words go — a note stays inside your company.",
            "Judge it when you know: the outcome chip in the header, or the **Outcome** tab, records **Won**, **Lost**, **No reply** or **Not a job**. The moment you pick one, the conversation moves to **Done**.",
          ] },
          { figure: "live:app-messages", caption: "Messages — the list grouped Needs a reply and Waiting on them, each row with its waiting time and temperature chip, and the channel chips above." },
          { note: "The address bar carries the open conversation (**?conversation=…**), so a link from the review or a reload lands on the thread, not the list." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["**Reply** tab", "Sends through Meta to the person's Facebook, Instagram or WhatsApp. Off, with the reason printed on it, when no Page is connected, the connection needs reconnecting, or FieldQuo is still waiting on Meta's approval."],
              ["**Note** tab", "Saves a private note in the thread. **Only your team sees this. It is never sent.** Never blocked by the connection."],
              ["**Mark done** / **Reopen**", "Sets the status to **Resolved** (the row moves to Done) or back to **Open**."],
              ["Outcome chip", "**Won**, **Lost**, **No reply**, **Not a job**, or back to **Open**, which clears the judgement. The review counts a cleared one as not judged."],
              ["**What's happening with this?**", "**Open**, **Waiting on them**, **Snoozed** (asks for a date), **Resolved** — see [[conversation-status-and-who-looks-after-it|Conversation status and who is looking after it]]."],
              ["**Looking after this**", "Hands the conversation to one person on your team, or **Nobody yet**."],
              ["**Open client** and the other links", "Jump to the client, lead, job or quote the conversation is linked to. A contact card a person sends can be added as a client with **Add as a client**."],
            ],
          } },
        ],
      },
      {
        id: "staying-on-top",
        heading: "Knowing when someone writes back",
        blocks: [
          { p: "While the tab is open the list re-reads itself once a minute. A reply that arrives shows as a toast in the tab you are in, or as a system notification when the inbox is in a background tab — **New message from Maria Lopez** with the first line of what they said. FieldQuo also pushes the same notice to the phones of everyone who can read the inbox, once browser notifications are switched on under **Settings → Notifications**; see [[notifications-for-you|Notifications for you: email and browser]]." },
          { tip: "The **Waiting 3 days** badge is measured from the person's last message and clears when anyone at the company answers — from FieldQuo, from Meta's own inbox, or from a phone. Writing a note does not clear it: a note is not an answer." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What the other tools do not do",
        blocks: [
          { p: "FieldQuo's comparison pages record what each competitor prints on its own pricing page, at every tier. None of the recorded pages names a Facebook Page, Instagram or WhatsApp inbox; Projul's Core+ tier lists “messaging” without saying which channel. What FieldQuo adds on top of an inbox is the outcome on every conversation and the monthly review built from it — which conversations became jobs, and how fast the won ones were answered." },
          { p: "FieldQuo's own comparison pages do not list this feature yet, on purpose: until Meta approves Page messaging for the app, a public page would be selling something a new company cannot switch on. This article says the same thing." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Reading the inbox needs **Requests** at view only or above in the access grid — an inbound message is a request from a stranger. The Estimator, Dispatcher and Manager presets and the owner and administrators all have it; the Crew preset (**Requests: none**) is refused. Replying, writing a note, changing the status, the outcome or who is looking after it needs **Requests** at view, create and edit — Estimator and above. Someone on view only sees **You can read this conversation but not reply — your access to requests is view only.** See [[access-levels-overview|Access levels]]." },
        ],
      },
    ],
    faq: [
      { q: "Why is the reply box greyed out?", a: "Read the sentence on it. It is one of four: no Page is connected yet, the Page needs reconnecting, FieldQuo is waiting on Meta's approval for Page messaging, or this is a sample conversation. The Note tab works in every case." },
      { q: "Can I delete a conversation?", a: "No. Mark it done, or judge it Not a job, and it leaves the working list. Nothing a client wrote is removed." },
      { q: "Does FieldQuo read my personal Messenger or Instagram?", a: "No. Only the Page and the professional account you connected, and only their business conversations." },
      { q: "Where do these conversations go in the rest of FieldQuo?", a: "Nowhere by themselves. Link one to a client, lead, job or quote from the Details tab and the thread carries the link; the monthly review files the conversation under the month it started." },
    ],
  },

  "connect-your-facebook-page-and-instagram": {
    title: "Connecting your Facebook Page and Instagram",
    summary:
      "The one connection under Settings → Meta Ads that lets FieldQuo post to your Page and Instagram and, once Meta approves it, answer their messages in your inbox.",
    updated: "2026-09-12",
    intro: [
      "Your Facebook Page and the Instagram professional account linked to it are connected once, from the **Facebook & Instagram publishing** card on **Settings → Meta Ads**. One consent screen, one stored connection, and it feeds two things: posting a design from the Marketing Designer, and the [[the-messages-inbox|Messages inbox]]. A contractor thinks “I connected my Page”, not “I connected it twice”, so FieldQuo does not ask twice.",
      "The card is honest about what Meta has and has not approved for FieldQuo's app. While a permission is pending it says so and draws no button; a connection that is stored but cannot deliver messages says which permission is missing rather than looking healthy.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**Settings → Meta Ads** holds every Meta connection a company makes: the ad account (spend into your marketing numbers), **Facebook lead forms** (into Leads), **Facebook & Instagram publishing**, and **WhatsApp Business**. They are separate connections with separate permissions — connecting the ad account does not connect the Page. See [[connect-meta-ads|Connect your Meta ad account]] and [[facebook-lead-forms|Facebook lead forms]] for the first two." },
          { p: "The Page connection stores an access token, encrypted, and the Page's id and name. The token is never shown on screen and never leaves the server." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the card",
        blocks: [
          { bullets: [
            "**Waiting on Meta's approval** — publishing or messaging needs permissions Meta has to grant FieldQuo first. No button; **Nothing is missing on your side.**",
            "**No Page connected** with **Connect Facebook & Instagram** — the flow is open and nothing is stored yet.",
            "**Which Page?** — Meta returned more than one Page for your login; pick one and press **Connect this Page**.",
            "Connected: the Page's name, then **@username** of the linked Instagram account, or **No Instagram account linked to this Page — Facebook only.**",
            "A line about messages: **Meta is sending this Page's messages to FieldQuo — set up on …**, or **Messages from this Page aren't reaching FieldQuo** with **Try subscribing again**, or a sentence naming the permissions Meta has not granted yet.",
            "**Your inbox isn't switched on for this Page yet** with **Connect the inbox** — only for a Page connected before the inbox existed.",
            "**Import past conversations** with **Last imported …**, then **Connected by Jon Smith on …**, **Reconnect or switch Page** and **Disconnect**.",
          ] },
        ],
      },
      {
        id: "how-to-connect",
        heading: "How to connect",
        blocks: [
          { steps: [
            "Open **Settings → Meta Ads** (under **Getting paid**) and scroll to **Facebook & Instagram publishing**.",
            "If the card reads **Waiting on Meta's approval**, stop here — there is nothing to do until it changes. Otherwise press **Connect Facebook & Instagram**.",
            "Sign in to Facebook and tick every permission Meta shows. Un-ticking one leaves you a connection that looks fine and fails at the moment you post or receive a message; the card names the missing permission afterwards.",
            "If you administer several Pages, choose the one your business posts from under **Which Page?** and press **Connect this Page**.",
            "Back on the card, check the messages line. When it reads **Meta is sending this Page's messages to FieldQuo**, new conversations arrive in Messages on their own.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Settings → Meta Ads — the ad account card, Facebook lead forms, a connected Page with its Instagram account and the messages line, and the WhatsApp Business card." },
        ],
      },
      {
        id: "after-connecting",
        heading: "After connecting",
        blocks: [
          { bullets: [
            "**Import past conversations** pulls what the Page already had, going back 30 days, and reports **Imported 12 conversations · 3 new**. The same pull is the **Refresh from Facebook** button in the inbox. It can run once every ten minutes; sooner reads **Refreshed a moment ago — try again in a few minutes.**",
            "**Connect the inbox** appears only when Meta has granted messaging for this Page but the inbox was never set up to receive it; one press fixes it.",
            "**Try subscribing again** re-asks Meta to send this Page's messages, without touching the rest of the connection. Posting to the Page keeps working while messages do not.",
            "A connection whose token stops working shows **The connection to your Page stopped working. Reconnect it to keep receiving messages.** at the top of Messages, with a link back to this card.",
          ] },
        ],
      },
      {
        id: "disconnecting",
        heading: "Disconnecting",
        blocks: [
          { p: "**Disconnect** asks **Disconnect Facebook & Instagram?** and then deletes the stored access token straight away. FieldQuo can no longer publish or fire scheduled posts for the Page; posts already published stay on Facebook and Instagram, and conversations already in your inbox stay in FieldQuo." },
          { warning: "If Meta does not confirm it has stopped sending the Page's messages, the card says so: remove FieldQuo under the Page's Business Integrations in Meta's own settings to be certain." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "**Settings → Meta Ads** is on the same shelf as Payments: the owner and administrators only. A Manager or Dispatcher does not see the row, and every route behind it refuses them. Once a Page is connected, anyone with **Requests** at view only reads the inbox — see [[the-messages-inbox|The Messages inbox]]." },
        ],
      },
    ],
    faq: [
      { q: "Do I need a Meta ad account to connect my Page?", a: "No. The ad account and the Page are two separate cards with two separate consent screens." },
      { q: "My Instagram account is missing.", a: "The card reads Facebook only when no Instagram professional account is linked to the Page in Meta's own settings. Link it there, then press Reconnect or switch Page." },
      { q: "Can a Manager connect the Page?", a: "No. Meta Ads is owner and administrator only, like Payments." },
    ],
  },

  "whatsapp-business": {
    title: "WhatsApp Business messages",
    summary:
      "Your own WhatsApp Business number answered in the same inbox as Facebook and Instagram, with the 24-hour rule WhatsApp itself enforces and the approved templates that get you past it.",
    updated: "2026-09-12",
    intro: [
      "A contractor's WhatsApp Business number is connected from the **WhatsApp Business** card on **Settings → Meta Ads**, through Meta's own sign-up, and from then on every message a client sends to that number lands in [[the-messages-inbox|Messages]] under the **WhatsApp** chip, beside Facebook and Instagram. Photos, videos, voice messages, documents, stickers, contact cards and map pins all arrive; photos, videos, documents and your own address can be sent back.",
      "One rule will surprise anybody who has only used WhatsApp on a phone: on a business number, WhatsApp refuses a typed message more than **24 hours** after the client last wrote. FieldQuo says which case you are in on every conversation and offers the way through — a template Meta approved in advance — rather than letting the send fail after you pressed the button.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The connection needs a permission Meta approves per app. While it is pending, the card reads **Waiting on Meta's approval** with no button, and a typed address cannot start the flow either — the server refuses it with the same sentence. When the flow is open, the card reads **No WhatsApp number connected** with **Connect WhatsApp**." },
          { p: "Below the button sits a collapsed **Connect with Cloud API credentials (advanced)** section. It exists for the people who run FieldQuo's own Meta app and is the wrong door for everyone else; the sign-up button is the one Meta wants a business to go through." },
        ],
      },
      {
        id: "connect-your-number",
        heading: "How to connect your number",
        blocks: [
          { steps: [
            "Open **Settings → Meta Ads** and scroll to **WhatsApp Business**.",
            "Press **Connect WhatsApp**. Meta walks you through signing in, choosing or creating a WhatsApp Business Account, and picking the phone number your clients write to.",
            "Back on the card, the number appears with its verified name, **Connected via Meta sign-up**, and the phone number as Meta prints it. Messages start arriving in the inbox straight after.",
            "Press **Refresh templates** to read your message templates from Meta. The card lists each with its language and Meta's own status — **APPROVED**, or whatever Meta says.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Settings → Meta Ads — the WhatsApp Business card at the bottom, with Connect WhatsApp and the collapsed advanced section." },
          { note: "A number that cannot receive is worse than none, so if FieldQuo cannot subscribe to the number's messages nothing is connected and the card says so: **FieldQuo couldn't subscribe to your messages, so nothing was connected.** Try again." },
        ],
      },
      {
        id: "the-24-hour-rule",
        heading: "The 24-hour rule",
        blocks: [
          { p: "The card states it where you connect: **WhatsApp only carries a typed message for 24 hours after the customer last wrote to you. After that you can still reach them, but only with a template Meta approved in advance.** The window restarts every time the client writes again. FieldQuo computes it before you type, so the composer changes shape instead of failing after Send." },
          { table: {
            head: ["What the conversation shows", "What you can send"],
            rows: [
              ["Nothing — the window is open", "Anything: text, a photo, a video, a document, your address"],
              ["**Less than an hour left to reply.**", "Anything, for now — answer before it closes"],
              ["**More than 24 hours have passed since they last wrote, so WhatsApp won't carry a typed message.**", "An **Approved template** from the picker that replaces the typing box, with its fill-in values"],
              ["**They haven't messaged you on WhatsApp yet…**", "Only an approved template can start a conversation"],
            ],
          } },
          { p: "A send that breaks the rule anyway — a clock disagreement, a message FieldQuo never received — is refused by WhatsApp and shows in the thread as a failed reply with the reason, and the row shows **Not delivered**." },
        ],
      },
      {
        id: "templates",
        heading: "Templates",
        blocks: [
          { p: "Templates are written and submitted in Meta's WhatsApp Manager, not in FieldQuo. FieldQuo reads them with **Refresh templates**, offers only the ones Meta marked **APPROVED**, and sends by template id with your fill-in values — never the template's words retyped, so an approved template cannot be used as an envelope for something else. A rejected template stays on the list with its status, because “rejected” is the fact you need." },
          { tip: "With no approved template the picker reads **You have no approved WhatsApp templates yet. Create one in Meta's WhatsApp Manager, then refresh the list in Settings.** Write one before you need it — a client who wrote on Friday and is answered on Monday is outside the window." },
        ],
      },
      {
        id: "photos-files-and-your-address",
        heading: "Photos, files and your address",
        blocks: [
          { bullets: [
            "**Attach a file** — WhatsApp only, on the Reply side. JPEG or PNG photos up to 5 MB (a larger phone photo up to 25 MB is shrunk to fit), MP4 or 3GP video up to 16 MB, and PDF, Word, Excel, PowerPoint or plain-text documents up to 100 MB. The typing box becomes **Add a caption (optional)**.",
            "**Send our address** — your company's own pin, drawn only when your company address was picked from the map and so has coordinates. A location goes on its own; WhatsApp carries no words with it, and the box says so.",
            "**Voice notes, stickers and contact cards arrive here but can't be sent yet.** A contact card a client shares offers **Add as a client**; a map pin offers **Save as Sam's address** on a linked client.",
            "Facebook and Instagram replies carry text only; the paperclip is not drawn there.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What the other tools do not do",
        blocks: [
          { p: "None of the competitor pricing pages FieldQuo's comparison pages record lists WhatsApp at any tier. FieldQuo's own pages do not list it yet either, deliberately, until Meta approves the permission — and whatever copy that becomes will carry the 24-hour sentence above, because a page promising “message your customers on WhatsApp” without it promises something WhatsApp does not allow." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Connecting and disconnecting a number, and refreshing templates, live on **Settings → Meta Ads** — owner and administrators only. Reading and answering the conversations follows the inbox's rule: **Requests** at view only to read, view, create and edit to reply. See [[the-messages-inbox|The Messages inbox]]." },
        ],
      },
    ],
    faq: [
      { q: "Can I use my personal WhatsApp number?", a: "Only as a WhatsApp Business number chosen or created in Meta's sign-up. FieldQuo never reads a personal account." },
      { q: "Why can I only send a template?", a: "More than 24 hours have passed since the client last wrote, or they have never written to you on WhatsApp. WhatsApp refuses typed text in both cases; the template picker is the way through." },
      { q: "Does disconnecting delete the conversations?", a: "No. The number is stamped as disconnected and stops receiving; what is already in the inbox stays." },
    ],
  },

  "conversation-status-and-who-looks-after-it": {
    title: "Conversation status and who is looking after it",
    summary:
      "The four statuses a conversation moves through, what snoozing does and when it comes back, how the outcome differs from the status, and how to hand a thread to one person.",
    updated: "2026-09-12",
    intro: [
      "Every conversation in [[the-messages-inbox|Messages]] answers two questions on its **Details** tab: **What's happening with this?** — its status — and **Looking after this** — the one person on your team it belongs to. The status decides which group the row sits in; the person is who the office asks when a client calls to follow up.",
      "A third question, **Did this become a job?**, is the outcome, and it is deliberately separate: a status is what is happening now, an outcome is what the conversation turned out to be. Both are written to the thread's history with a name and a time.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A new conversation is **Open** and sits under **Needs a reply** as long as the last word was the client's. Once you answer it moves to **Waiting on them**. From there you can park it until a date (**Snoozed**), or close it (**Resolved**, the **Done** group). A client who writes back reopens a resolved, waiting or snoozed conversation on their own — no cron, no button." },
        ],
      },
      {
        id: "the-four-statuses",
        heading: "The four statuses",
        blocks: [
          { table: {
            head: ["Status", "Which group", "What it means"],
            rows: [
              ["**Open**", "Needs a reply, or Waiting on them once you have answered", "Live. The waiting badge counts from the client's last message."],
              ["**Waiting on them**", "Waiting on them", "You have asked something and the ball is with the client. Set by hand when you want it out of Needs a reply without having replied."],
              ["**Snoozed**", "Snoozed", "Parked until a date and time you choose. **Back on 14 Sep** shows on the picker."],
              ["**Resolved**", "Done (collapsed by default)", "Finished. **Mark done** in the header sets it; **Reopen** clears it."],
            ],
          } },
        ],
      },
      {
        id: "snoozing",
        heading: "How to snooze a conversation",
        blocks: [
          { steps: [
            "Open the conversation and press **Details**.",
            "Under **What's happening with this?** pick **Snoozed**. The picker reveals **Bring it back when?** with a date and time — the status is not written until there is one, because “parked until sometime” is how a lead disappears.",
            "Press **Park it**. The thread records **Parked until a date by Dave** and the row moves to **Snoozed**.",
            "It comes back on its own. A cron runs every fifteen minutes; when the time has passed the status returns to **Open**, the row returns to the working list and the history reads **Came back on its date**. **Bring it back now** wakes it early.",
          ] },
          { note: "If the client writes while the conversation is snoozed, it wakes immediately and the deadline is cleared, so it cannot come back a second time." },
        ],
      },
      {
        id: "outcomes",
        heading: "Mark done, and the outcome",
        blocks: [
          { bullets: [
            "**Mark done** sets the status to **Resolved**. It says nothing about whether you won the work.",
            "The outcome chip in the header — and the picker under **Did this become a job?** on the **Outcome** tab — records **Won** (it became a job), **Lost** (they went elsewhere, or said no), **No reply** (nobody at the company answered, or they went quiet after you did) or **Not a job** (a supplier, a job application, spam — left out of the won rate).",
            "Picking any outcome moves the row to **Done**, whatever its status. Picking **Open** clears the outcome; the monthly review then counts the conversation as not judged, never as lost.",
            "Every change is a line in the thread and on the **History** tab: **Marked won by Dave**, **Outcome cleared by Ana**, **Marked resolved**.",
          ] },
        ],
      },
      {
        id: "looking-after-this",
        heading: "Looking after this",
        blocks: [
          { p: "**Looking after this** lists the people on your team who can be assigned a lead — the same list the Leads board uses — with **Nobody yet** as the default. Picking a name writes **Assigned to Marc by Dave** into the history; picking nobody writes **Unassigned by Dave**. It is a label the office reads, not a filter: the conversation stays in the same group, and everyone who can read the inbox still sees it." },
          { tip: "Assigning is the answer to “who spoke to her last?” when the client phones. Write it down here rather than in a note, so it shows on the Details tab and in the history." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Who can change it",
        blocks: [
          { p: "Changing the status, the outcome or the assignee needs **Requests** at view, create and edit — Estimator, Dispatcher, Manager, owner and administrators. Someone with view only sees the current status and outcome as words, with no picker; the server refuses the change too, so hiding the control is not what keeps it safe." },
        ],
      },
    ],
    faq: [
      { q: "What is the difference between Resolved and Won?", a: "Resolved is a status — the conversation is finished for now. Won is an outcome — it became a job. A resolved conversation with no outcome shows as Not judged yet in the review." },
      { q: "Can I snooze without a date?", a: "No. Park it is disabled until you choose a date and time, and the server refuses a snooze with none." },
      { q: "Does assigning someone notify them?", a: "No. It writes their name on the conversation and into its history; nothing is sent." },
    ],
  },

  "private-notes-and-temperature": {
    title: "Private notes and the temperature chip",
    summary:
      "How to leave a note only your team can read, why a note is not an answer, and how the Warm 35 chip on every conversation is scored from what the person actually did.",
    updated: "2026-09-12",
    intro: [
      "Two things ride on a conversation without ever reaching the client. A **Note** is what you write for the next person who opens the thread — “fussy about the trim colour, quoted high, shopping around”. The **temperature chip** — **Warm 35**, **Hot 72**, **Cold 0** — is what FieldQuo reads off the conversation itself, with the reasons listed, so you know before you spend an evening on a quote whether this person is deciding or browsing.",
      "The chip annotates; it never filters. A cold conversation sits in the list exactly where it would without a score.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A note is stored in the thread as its own kind of row, painted in a distinct wash so it can never be mistaken for a message, and it goes through a different route from a reply — one that does not import the send path at all. That is deliberate: a colleague's opinion of a customer should never be one inverted setting away from that customer's inbox." },
        ],
      },
      {
        id: "write-a-note",
        heading: "How to write a note",
        blocks: [
          { steps: [
            "Open the conversation and press the **Note** tab above the box. The box changes colour and the placeholder reads **Fussy about the trim colour. Quoted high — shopping around.**",
            "Write it and press **Save the note**. Under the box it says **Only your team sees this. It is never sent.**",
            "The note appears in the thread at the time you saved it, with your name, for everyone who can read the inbox.",
          ] },
          { note: "The Note tab is never blocked by the connection. Even while FieldQuo is waiting on Meta's approval and the Reply tab is off, a note can be saved." },
        ],
      },
      {
        id: "what-a-note-does-not-do",
        heading: "What a note does and does not do",
        blocks: [
          { bullets: [
            "It does not clear the **Waiting** badge or move the row out of **Needs a reply**. Writing “she's fussy” is not answering her.",
            "It is not counted as a reply in the monthly review's first-reply time.",
            "It carries no attachment: a note never leaves the building, so a picture on one would go nowhere.",
            "It is left out of the temperature score, which reads only what you and the client actually said to each other.",
          ] },
        ],
      },
      {
        id: "the-temperature-chip",
        heading: "The temperature chip",
        blocks: [
          { p: "Every conversation starts at **35**, the bottom of warm — somebody wrote to a contractor, which is more than most people do, so cold has to be earned by something that was said. **Hot** is 60 and above, **Warm** 30 to 59, **Cold** below 30: the same bands as a lead's score on the Leads board, so one person never carries two different words for one idea. What differs is the weighting. A form scores effort — budget, photos, how much they typed. A conversation scores what the person **did**." },
          { table: {
            head: ["What the person did", "Points"],
            rows: [
              ["**They asked how this gets done — paying, starting, or getting in**", "+30, plus 6 for each further time, up to 12 more"],
              ["**They added work nobody asked them to add**", "+20"],
              ["**They moved their own dates to fit yours**", "+18"],
              ["**They argued about a line, not about your prices**", "+12"],
              ["**They said they're getting other quotes**", "−30"],
              ["**They said no in advance, politely**", "−22"],
              ["**Quoted, chased, and nothing back**", "−25"],
              ["**They named a budget** · **They asked about materials and finishes**", "0 — noticed, deliberately worth nothing"],
            ],
          } },
          { p: "Four things end the discussion whatever else was said — **They said they're somewhere you don't work**, **Their budget is below what this job can be done for**, **They want a cheaper grade of work than you sell**, **They said they didn't want this** — and drop the score to cold with the sentence quoted under it: **Worth settling before you spend an evening on a quote. You know the job — if this is wrong, ignore it.**" },
          { p: "Under five messages the verdict is capped at warm and the chip reads **unsure**: **Too little has been said here to be sure. This is a first read, not a verdict.** The panel on the **Outcome** tab lists every reason with the fragment it matched, in the reader's language." },
        ],
      },
      {
        id: "read-it-with-fieldquo-ai",
        heading: "Read it with FieldQuo AI",
        blocks: [
          { p: "The rules cannot see two things the winning conversations share: whether the person wrote like someone deciding (“do it”) or someone hedging (“if the price is right”), and whether they told you something personal that had nothing to do with the job. **Read this conversation** on the Outcome tab sends the thread to FieldQuo AI for exactly those two, with your own recent won and lost conversations as examples. It may move the score one band at most, up or down, and it can never overturn one of the four disqualifiers — that refusal is in code, not in the prompt." },
          { note: "It is paid from your monthly AI allowance and says so first: **Uses about … of your monthly AI allowance. You have … left this month.** It needs at least 4 messages, refuses to re-read a thread nothing has been added to, and stores nothing when the allowance is out — the rule score stands. See [[ai-credit-and-phone-credit|AI credit and phone credit]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone who can read the inbox (**Requests** at view only) reads notes and the chip. Writing a note, and asking FieldQuo AI to read a conversation, need **Requests** at view, create and edit — Estimator and above." },
        ],
      },
    ],
    faq: [
      { q: "Can a client ever see a note?", a: "No. Notes are saved through a route that cannot send, and they are drawn in their own colour so nobody mistakes one for a reply." },
      { q: "Why is a conversation Warm 35 with nothing said?", a: "35 is the starting score. Nothing decisive has been said either way; the chip will move when the person does something the rules recognise." },
      { q: "Why does the AI read not change anything?", a: "It may only adjust by one band and never past a disqualifier; when it finds neither commitment nor a personal disclosure it reads Found nothing to change." },
    ],
  },

  "the-ai-employee": {
    title: "The AI employee: drafts you approve",
    summary:
      "Hire an assistant for one job — closer, receptionist or tech support — that answers a customer's message from your own price book and material, writes a draft, and waits for you to send it.",
    updated: "2026-09-12",
    intro: [
      "**Settings → AI employee** is where you hire an assistant that answers the messages arriving in [[the-messages-inbox|Messages]]. You pick the job it does, how it writes, what it may read, and whether it drafts or sends. By default it drafts: **It writes the reply and waits. Nothing reaches the customer until you press send.**",
      "The row carries a **Preview** badge, and the screen opens with the one thing it cannot do yet: **Replies can't leave the building yet. The AI employee answers your Facebook and Instagram messages, and Meta hasn't approved messaging for FieldQuo. Everything here works — it drafts, and the drafts wait below for you to send.** Configure it, feed it, test it against the real code; the sending waits on Meta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The job is a set of abilities, not a personality. A **Receptionist** has no way to look up a price — not “told not to”, but not given the tool — so a homeowner asking three times cannot talk it into one. Every role shares the same never-rules: it can never invent a price, a date or a policy; if it is not in your own data or your own material, it hands the conversation to a person. It never claims to be a named person and, asked outright, says the reply is automatic and a member of the team will follow up." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**What job does it do?** — four cards: **Sales closer**, **Receptionist**, **Tech support**, **Something else**, each with **It can:** and **It cannot:** underneath.",
            "**How it writes** — **What you call it** (for you, never said to customers), **Tone** (professional, warm or brief), **Opening line (optional)**, **Your instructions**, **When it should fetch a person**.",
            "**Draft, or send?** — **Write me a draft (recommended)** or **Send it automatically**.",
            "**Limits** — **Only answer during business hours**, **Most replies in one conversation**, **Switch the AI employee on**, then **Save**.",
            "**What it reads** — **Upload a file** or **Paste text instead**, and the list of what it has read.",
            "**Try it** — a test box that runs the real reply path, then **Waiting for you** (the drafts) and **It stopped on these**.",
          ] },
        ],
      },
      {
        id: "hire-it",
        heading: "How to hire it",
        blocks: [
          { steps: [
            "Open **Settings → AI employee** and pick a job. **Sales closer** is the only role allowed near a number: it reads your price book and can put an instant estimate together from your own rates. **Receptionist** takes the details and books a callback. **Tech support** answers from the material you upload and names the document.",
            "Fill in **Your instructions** — areas you cover, what you do not do, how you like things worded — and **When it should fetch a person** (“anything about a leak, anyone asking for the owner”).",
            "Leave **Write me a draft (recommended)** selected. Set **Most replies in one conversation** — 3 by default; after that it stops and leaves the thread to you, and 0 pauses it without losing your setup.",
            "Under **What it reads**, upload your policy, your troubleshooting notes or a manual, or paste the text.",
            "Tick **Switch the AI employee on** and press **Save**. Then type a customer's message under **Try it** and press **See the answer** — it names the documents and tools it used, and what the test cost.",
          ] },
          { figure: "live:app-settings-ai-employee", caption: "Settings → AI employee — the four jobs with what each can and cannot do, How it writes, Draft or send, and Limits." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "What each setting changes",
        blocks: [
          { table: {
            head: ["Setting", "What it does"],
            rows: [
              ["The job", "Fixes the tools it may call. Closer: look up service prices, create an instant quote, book a callback, hand off to a person. Receptionist, Tech support and Something else: book a callback and hand off only."],
              ["**Tone**", "Professional (plain, no exclamation marks or emoji), warm (one emoji at most, and only if they used one first), or brief (two sentences)."],
              ["**Write me a draft**", "The reply waits under **Waiting for you** with **Send it** and **Not this one**. Sending one sends it in the conversation exactly as if you had typed it."],
              ["**Send it automatically**", "The reply goes straight to the customer with nobody reading it first. It still refuses to quote a price it did not get from your rates, still stops when unsure, and still stops when your AI credit runs out. Today the channel is blocked, so it drafts either way."],
              ["**Only answer during business hours**", "Uses the opening hours saved under Company Settings; outside them the message waits for you. With no hours saved it does nothing — it will not guess a Monday-to-Friday. See [[opening-hours|Opening hours]]."],
              ["**Most replies in one conversation**", "The cap per thread. When it is reached, the thread appears under **It stopped on these** with **Let it answer again**."],
            ],
          } },
          { p: "A draft written before you changed a setting is marked **written before your last change**, so you know it reflects the old instructions." },
        ],
      },
      {
        id: "what-it-reads",
        heading: "What it reads",
        blocks: [
          { p: "The screen says it before the click: **We can read plain text: .txt, .md and .csv, or text you paste in. We cannot read a PDF or a Word file yet — if you upload one it'll show up below marked unread, and the fix is to paste the text or export it as .txt.** A file that was read shows **read, about 1,400 tokens**. The material is fenced as evidence: an instruction hidden inside a manual is just text, never an order." },
          { note: "Every reply and every test spends AI credit, metered like everything else in FieldQuo AI. When the allowance is out the screen says so with a **Top up AI credit** link, and the employee stops rather than guessing. See [[ai-credit-and-phone-credit|AI credit and phone credit]]." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "What the other tools do not do",
        blocks: [
          { p: "The competitor pricing pages FieldQuo records offer AI phone receptionists and AI credit allowances; none lists an assistant that answers a Facebook, Instagram or WhatsApp message from the company's own price book and uploaded material. FieldQuo's own comparison pages leave this off too, on purpose, until Meta approves the channel — selling “an AI that replies to your Facebook messages” today would be selling the half that is blocked." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "**Settings → AI employee** is for the owner, administrators, and the Manager and Dispatcher presets — the same rung as the phone receptionist, because it decides what is said to customers in the company's name and spends the company's AI allowance. Crew and Estimator do not see the row. Sending or dismissing a draft from this screen needs the same access as the screen itself." },
        ],
      },
    ],
    faq: [
      { q: "Will customers know they are talking to software?", a: "It never says it is software or a named person unless somebody asks directly; then it says plainly the reply is automatic and a person will follow up. The name you give it is for you." },
      { q: "Can it quote a price?", a: "Only the Sales closer, and only a figure a FieldQuo tool computed from your own rates, which it repeats and attributes. It cannot add, discount, round or start from anything." },
      { q: "Why is there nothing under Waiting for you?", a: "No message has arrived that it could answer — usually because no Page is connected or Meta has not approved messaging yet — or it is switched off, outside business hours, or over its cap." },
      { q: "Does it answer WhatsApp?", a: "Inside WhatsApp's 24-hour window, yes, the same way. Outside it, it does not send a template on your behalf." },
    ],
  },

  "the-monthly-review": {
    title: "The monthly review of your inbox",
    summary:
      "Which conversations became jobs, how fast each was answered, and who was never answered at all — one month at a time, with an optional FieldQuo AI read of what the winners did.",
    updated: "2026-09-12",
    intro: [
      "The **Monthly review** button at the top of [[the-messages-inbox|Messages]] opens the reason the conversations are stored at all: once a month, see which ones closed the job and which did not, and how quickly each was answered. A conversation is filed under the month it **started** — the **History** tab on every thread says which — so a July enquiry judged in September still counts in July.",
      "It never prints a zero for something it does not know. A month with nothing judged has no won rate and says so; a conversation nobody replied to reads **Not answered**, not 0 min.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen puts the unanswered conversations first. Won and lost are history; **Someone wrote and no reply ever went back** is the one line still fixable, and it sits in an amber box above the rate. Every name on the page is a link back into the thread." },
        ],
      },
      {
        id: "open-it",
        heading: "How to read a month",
        blocks: [
          { steps: [
            "Open **Messages → Monthly review**. It opens on the current month; the arrows step to **Previous month** and **Next month**.",
            "Read the three tiles: **Conversations started**, **Won** (with **3 of 9 judged** under it), **Typical first reply**.",
            "Work through **Never answered** — each row is a name, the date and **2 from them** — and answer or judge each one.",
            "Check **What they turned out to be** and **First reply time, by outcome**, then judge whatever is still **Not judged yet**.",
          ] },
          { figure: "harness:messages-review", caption: "Monthly review — the three tiles, the Never answered box, What they turned out to be, and First reply time by outcome." },
        ],
      },
      {
        id: "what-the-numbers-mean",
        heading: "What the numbers mean",
        blocks: [
          { table: {
            head: ["Line", "How it is counted"],
            rows: [
              ["**Conversations started**", "Threads whose first message from the client fell in the month."],
              ["**Won**", "Won divided by judged, where judged is Won + Lost + No reply. **Not a job** is left out — a supplier is not a lost sale. With nothing judged: **Nothing has been marked won or lost yet, so there's no rate to show.**"],
              ["**Typical first reply**", "The median time from the client's first message to the first reply from anyone at the company, over the threads that got one. Notes do not count."],
              ["**Never answered (2)**", "Threads with an inbound message and no reply ever."],
              ["**What they turned out to be**", "A count per outcome, plus **Not judged yet**."],
              ["**First reply time, by outcome**", "The median per outcome, with **3 answered** and **1 unanswered** beside each. **These are small numbers. Read them as a comparison, not as a statistic.**"],
              ["**Ranked by what they said**", "Every conversation of the month, cold ones included, ordered by its temperature score with the strongest reason quoted."],
            ],
          } },
        ],
      },
      {
        id: "what-the-winning-conversations-did",
        heading: "What the winning conversations did",
        blocks: [
          { p: "Below the numbers, **Assess this month** asks FieldQuo AI to read the month's conversations that became paid work beside the ones that did not, and name the difference. The result comes back as **What the winning conversations did**, **Three things to change**, **Worth going back to** (with **Open the conversation** on each), and **Who wrote the 6 quotes these conversations produced**. Figures are scrubbed from the transcripts before the model reads them, and a month's assessment is stored so it can be re-read without paying again; **Assess again** runs it fresh." },
          { note: "It needs enough to find a pattern rather than two stories: at least **8** conversations matched to a client and at least **3** of them won, or it says so — **Only 2 of this month's conversations became paid work. It takes 3 before “what the winners did” means anything.** It uses your monthly AI allowance and prints the estimate first. When the evidence is thin the result is labelled a starting point, not a finding." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The same rule as the inbox: **Requests** at view only reads the review — Estimator, Dispatcher, Manager, owner and administrators. Running the AI assessment needs view, create and edit access to requests, because it spends the company's allowance." },
        ],
      },
    ],
    faq: [
      { q: "A conversation from last month was judged this week. Which month does it count in?", a: "The month it started. The History tab on the thread names it: Counts in the August review — the month it started." },
      { q: "Why is the won rate blank?", a: "Nothing in that month has been marked Won, Lost or No reply yet. Judge the conversations and the rate appears." },
      { q: "Does the review email me?", a: "No. It is a screen you open; nothing is sent." },
    ],
  },

  "client-texts-on-my-way-and-reminders": {
    title: "The two texts your clients get",
    summary:
      "The On my way text and the appointment reminder — when each is sent, the fields you can use, how the wording follows the client's language, and what FieldQuo does not text.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo texts a client on exactly two occasions: when a crew member presses **On my way** on a visit, and, if you switch it on, a reminder **2**, **24** or **48 hours before** an appointment or a job visit. **Settings → Client messages** is where you change the wording of both, with a live **Your client sees:** preview so nobody ever texts a customer a raw **{price}**.",
      "There is no third text. The page says so — **Two kinds of text and no more** — and it cannot grow an editor for a message that never goes out, because the list comes from the messages that actually send.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Both texts leave from FieldQuo's shared texting number and begin with your company name — **Northside Painting: Dave is on the way, ETA 20 min.** — so the client knows who it is from. Every reminder ends with **Reply STOP to opt out**, and a client who replies STOP is never texted again by either message — the reply comes back to the shared line, so it opts that phone out of every company holding it on a client record; the same opt-out check runs before the On my way text. Reminders go by text message only: there is no email reminder." },
        ],
      },
      {
        id: "the-two-texts",
        heading: "The two texts",
        blocks: [
          { table: {
            head: ["Text", "When it is sent", "Fields"],
            rows: [
              ["**On my way**", "The moment a visit's status is moved to **On my way** on the job page — by the assigned crew member, anyone on an unassigned visit, or someone who can edit everyone's schedule. The button names the number it will text, or says plainly that the client has no phone on file and nothing will be sent.", "**{company}**, **{worker}**, **{name}**, **{eta}**, **{phone}**"],
              ["**Appointment reminder**", "Once per appointment or job visit, within the hour of the lead time chosen under **Settings → Notifications → Appointment reminders** (**Off**, **2 hours before**, **24 hours before**, **48 hours before**). Off by default; a company that never chose a lead time sends none.", "**{company}**, **{when}**, **{location}**"],
            ],
          } },
          { p: "The default wording, as the client receives it: **Northside Painting: Dave is on the way, ETA 20 min. To reschedule, call 555-0100.** and **Northside Painting: Reminder — your appointment is Tue, Aug 12 at 2:00 PM at 123 Oak St. Reply STOP to opt out.** The ETA is worked out from the crew member's position at the tap; the phone is yours from Company Settings. A field with no value simply disappears — no ETA, no “ETA ,”, and no “call” sentence when there is no phone." },
        ],
      },
      {
        id: "edit-the-wording",
        heading: "How to change the wording",
        blocks: [
          { steps: [
            "Open **Settings → Client messages** (under **Messaging & alerts**).",
            "Type in the **On my way** or **Appointment reminder** box. Tap a chip — **{company}**, **{worker}**, **{name}**, **{eta}**, **{phone}** — to insert a field at the end.",
            "Watch **Your client sees:** fill in with sample values. An unknown field is flagged — **Unknown field: {price}. Only the fields above work.** — and **Save** stays disabled until it is gone. The server checks the same thing.",
            "Press **Save**. The card gains a **Customised** tag and a **Use default** button, which puts the built-in wording back.",
          ] },
          { figure: "live:app-settings-messages", caption: "Settings → Client messages — one editor per text with its field chips, the Your client sees preview, and Save." },
          { tip: "Past 160 characters a text splits into segments and costs more; the reminder's opt-out sentence is part of the count. Keep it to one screen." },
        ],
      },
      {
        id: "languages",
        heading: "Which language the client gets",
        blocks: [
          { p: "The text follows the client the way their quote does. **Your wording goes to clients who read your company's language. A client whose language is different gets our wording in theirs — the same eight languages as their quote.** So a Quebec shop that customises the French text sends it to French-speaking clients, and an English-speaking client gets FieldQuo's English wording — never a machine translation of yours. The appointment time is written in the client's locale and your company's time zone. See [[a-clients-language|A client's language]]." },
        ],
      },
      {
        id: "what-is-not-automated",
        heading: "What FieldQuo does not text",
        blocks: [
          { bullets: [
            "No booking confirmation text. A visit booked from your booking page is confirmed by email, not by SMS.",
            "No “your quote is ready”, “your invoice is overdue” or “job complete” texts. Those go by email.",
            "No two-way texting with clients from the inbox. A client who replies to a reminder is not texting your team; only STOP is listened for.",
            "The reminder's wording is editable here, but the lead time lives on Notifications, and reminders never go by email.",
          ] },
          { p: "The full list, with what each channel does carry, is in [[texting-clients-what-is-and-is-not-automated|Texting clients: what is automated and what is not]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "**Settings → Client messages** is for the owner, administrators, Managers and Dispatchers. The reminder lead time on **Settings → Notifications** is owner and administrator only. Pressing **On my way** on a visit follows the schedule rule: the assigned crew member, anyone on an unassigned visit, or someone who can edit everyone's schedule." },
        ],
      },
    ],
    faq: [
      { q: "Why did the reminder go out in English to a French client?", a: "Your customised wording only goes to clients who read your company's language. A client in another language gets FieldQuo's built-in wording in theirs — check the client's language on their record." },
      { q: "Can I add a link to the quote in a text?", a: "No. Only the fields on the chips work, and the server refuses any other." },
      { q: "The status changed to On the way but no text arrived.", a: "The client has no phone number on file, replied STOP at some point, or the number could not be read as a North American number. The status still saves; the button says beforehand whether a text will go." },
    ],
  },

  "email-templates": {
    title: "Email templates",
    summary:
      "The block editor behind the emails your follow-up rules and email campaigns send, the merge fields it understands, and what the Active badge does and does not decide.",
    updated: "2026-09-12",
    intro: [
      "**Settings → Email Templates** lists every email template your company has, grouped **Automated**, **Marketing** and **Custom**, one row per template with an **Active** badge, and edit, duplicate and delete icons. **Add default templates** seeds a starter set — one per automated type — so a follow-up rule has something to send without any hand-building.",
      "Each template opens in a mobile-first block editor: headings, text, images, buttons, dividers, a quote or invoice summary, an itemized list and a progress tracker, reordered by drag, with **{{mergeField}}** tokens and a phone or desktop preview. Your logo and brand colour come in from Branding unless you override them.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Six types: **Quote email**, **Instructions email**, **Receipt / invoice email** and **Follow-up email** under Automated; **Marketing email**; and **Custom**. A type with no template of its own reads **No templates yet — using the built-in default.** You can build as many drafts and variations of a type as you like; the one marked **Active** is the company's default for that type." },
          { figure: "live:app-settings-email-templates", caption: "Settings → Email Templates — the Automated, Marketing and Custom groups, one row per template with its Active badge, and Add default templates." },
        ],
      },
      {
        id: "where-a-template-is-used",
        heading: "Where a template is actually used",
        blocks: [
          { p: "Read this before spending an evening on one. A template on this screen is sent when a **follow-up rule** or an **email campaign** names it: a rule under **Settings → Follow-ups** picks one of your Follow-up, Marketing or Custom templates and sends it a set time after a quote, invoice or job hits a state; an email campaign under Marketing picks a Marketing or Custom template and sends it to your subscribers. See [[follow-up-rules|Follow-up rules]] and [[email-campaigns-and-subscribers|Email campaigns and subscribers]]." },
          { warning: "The quote email and the invoice and receipt emails a client receives are built by FieldQuo from the document itself — the same sections as the PDF, your branding, and the references and photos you set under **Settings → Quote Email**. Today no send reads the **Quote email**, **Receipt / invoice email** or **Instructions email** templates on this screen, so editing one of those changes nothing a client receives. To change what the quote email carries, see [[settings-quote-email|Quote Email settings]]." },
        ],
      },
      {
        id: "the-editor",
        heading: "How to build a template",
        blocks: [
          { steps: [
            "Press **New Template** on the type you want, name it, and press **Create & edit**.",
            "Set the **Subject line**. **Merge fields work here too. Left blank, the built-in subject for this template type is used.**",
            "Press **Add block** and pick **Heading**, **Text**, **Image**, **Button**, **Divider**, **Spacer**, **Quote/Invoice summary**, **Itemized list** or the progress tracker. Drag the handle to reorder; each block has its own alignment, size, width or colour controls.",
            "Click into a text field and press **Insert a merge field** to drop in a token such as **{{clientName}}**; until a field has focus the button reads **Click into a text field first**.",
            "Check **Look & feel**: **Using your branding** picks up your logo and brand colour; override the header, background, text, accent and button colours and it reads **Customized**, with **Reset to my company branding** to undo. With no logo uploaded the header shows your company name instead.",
            "Use **Mobile preview** and **Desktop preview** (**Preview (sample data)**), type your address under **Send a test**, and press **Save**. **Set active** makes it the type's default.",
          ] },
        ],
      },
      {
        id: "merge-fields",
        heading: "Merge fields",
        blocks: [
          { table: {
            head: ["Field", "Filled with"],
            rows: [
              ["**{{clientName}}**, **{{clientAddress}}**, **{{clientPhone}}**", "The client's name, the client or job address, their phone"],
              ["**{{companyName}}**, **{{companyPhone}}**, **{{companyEmail}}**", "Your company's details, from Company Settings"],
              ["**{{quoteNumber}}**, **{{quoteTotal}}**, **{{quoteUrl}}**", "The quote a follow-up rule fired for, and the link to approve it"],
              ["**{{invoiceNumber}}**, **{{invoiceTotal}}**, **{{invoiceUrl}}**, **{{dueDate}}**, **{{balanceDue}}**, **{{amountPaid}}**", "The invoice, its pay link, when it is due and what is left"],
              ["**{{projectStartDate}}**, **{{projectEndDate}}**, **{{jobTitle}}**", "The job's dates and title"],
            ],
          } },
          { p: "A field the record does not have is left blank at send time; the test email fills them with sample values (**Jane Doe**, **Q-1042**, **$4,250.00**) and your real company details." },
        ],
      },
      {
        id: "deleting",
        heading: "Duplicating and deleting",
        blocks: [
          { p: "The duplicate icon copies a template, sections and all, so you can try a variation without touching the one a rule uses. The trash icon asks first: deleting is permanent, and a follow-up rule that pointed at the deleted template is skipped at send time rather than sending something else. Deleting the **Active** one leaves the type with no default until you mark another." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators, Managers and Dispatchers see **Settings → Email Templates** and can create, edit, activate, duplicate, delete and seed templates. Crew and Estimator do not see the row." },
        ],
      },
    ],
    faq: [
      { q: "I edited the Quote email template and the quote my client got did not change. Why?", a: "The quote email is built from the quote itself and your Quote Email settings, not from this template. Change the references and photos under Settings → Quote Email; the wording of the covering email is FieldQuo's, in the quote's language." },
      { q: "What does Active do, then?", a: "It marks the company's default template for that type. A follow-up rule or campaign still names the exact template it sends." },
      { q: "Can I send a template to a client from here?", a: "Only a test to your own address with Send a test. Client sends go through follow-up rules and email campaigns." },
    ],
  },
};
