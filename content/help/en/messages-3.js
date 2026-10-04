// content/help/en/messages-3.js
//
// Part 3 of the “messages” category in English (see the composer,
// messages.js). Slugs assigned to this part (lib/help/tree.js):
// fetch-older-facebook-and-instagram-history,
// photos-and-videos-from-facebook-and-instagram,
// facebook-leads-checked-against-your-records,
// channels-and-group-chats, chat-notifications-and-mute, seen-by-in-team-chat,
// photos-and-files-in-team-chat, reply-pin-edit-and-search-in-team-chat
// (2026-10-04: lib/company/chat/rules.js and store.js, the screen in
// app/components/company/CompanyChat.js and app/components/company/chat/).
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
  // 2026-10-04 — phases 3 and 4 of team chat: lib/company/chat/attachments.js,
  // fileLinks.js, cards.js, outbox.js, store.js (postMessage, editMessage,
  // removeMessage, pinMessage, searchMessages, saveToJob), the screen in
  // app/components/company/CompanyChat.js and chat/MessageParts.js.
  "photos-and-files-in-team-chat": {
    title: "Photos, files and shared jobs in team chat",
    summary: "Send photos from your phone's camera, PDFs and office documents in any conversation. They are private to the conversation, and a photo can be saved to a job's photos.",
    updated: "2026-10-04",
    intro: [
      "In Chat, the buttons under the message box send more than words: the **camera** takes or picks a photo, the **paperclip** attaches photos or documents, and the **briefcase** shares one of your jobs as a card.",
    ],
    sections: [
      {
        id: "what-you-can-send",
        heading: "What you can send",
        blocks: [
          {
            bullets: [
              "Photos (JPEG, PNG, HEIC and the other common phone formats). A photo is made smaller on your phone before it is sent, and its location is removed.",
              "PDFs and Word, Excel, PowerPoint and text documents, up to 25 MB each.",
              "Up to 10 files in one message, with or without words.",
              "Videos cannot be sent in chat.",
            ],
          },
        ],
      },
      {
        id: "who-can-open-them",
        heading: "Who can open them",
        blocks: [
          {
            p: "Only the people in the conversation. Files are stored privately, not at a public web address. Every photo or file on your screen opens through a link that only works for you and stops working after an hour; opening the conversation again gives fresh links. Somebody who leaves the conversation, or is taken out of it, can no longer open its files. A file from a removed message cannot be opened by anybody.",
          },
        ],
      },
      {
        id: "save-to-job-photos",
        heading: "Save a photo to a job",
        blocks: [
          {
            p: "Tap a photo to see it full size, then **Save to job photos**. In a job's room it goes on that job; anywhere else you pick the job from the jobs you can see. The crew can save to the jobs they are on.",
          },
          {
            p: "The photo is copied into the job's photos as a progress photo. It is not put on your website: featuring a photo stays with the people who curate job photos. The copy in chat stays private.",
          },
        ],
      },
      {
        id: "shared-jobs",
        heading: "Shared jobs, work orders and quotes",
        blocks: [
          {
            p: "A shared job, work order or quote shows as a card. Each person sees what their own access allows: somebody on the job can open it and its work order, somebody who can open quotes sees the quote's number and client, and everybody else sees **Office only** or **For the people on this job**. A card never shows a price. **Share with staff** on a quote posts a card the same way.",
          },
        ],
      },
      {
        id: "no-signal",
        heading: "With no signal",
        blocks: [
          {
            p: "Words you send with no signal wait in the conversation as **Sending…** and go by themselves when your phone is back online. They are sent once, even if the connection drops halfway. Photos and files need a connection to send; your words stay in the box.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Can the owner open photos in a private channel they are not in?",
        a: "No. Files follow the conversation: only its members can open them.",
      },
      {
        q: "Why did a photo turn grey?",
        a: "Its link ran out after an hour. The conversation reloads fresh links by itself; if it does not, open the conversation again.",
      },
    ],
  },
  "reply-pin-edit-and-search-in-team-chat": {
    title: "Reply, pin, edit, remove and search in team chat",
    summary: "Reply to one message, pin the ones people need, fix a message for 15 minutes, remove it for everyone, and search every conversation you are in.",
    updated: "2026-10-04",
    intro: [
      "Point at a message on a computer, or tap **⋯** under it on a phone, for what you can do with it.",
    ],
    sections: [
      {
        id: "reply",
        heading: "Reply",
        blocks: [
          {
            p: "**Reply** puts a small quote of the message above yours. Tap the quote to jump to the original. Replies are one level — there are no side threads to miss.",
          },
        ],
      },
      {
        id: "pins",
        heading: "Pin",
        blocks: [
          {
            p: "A pinned message sits in the bar under the conversation's name, with the newest pin first; tap the bar for the list. The office can pin in any conversation they are in, a channel's or group's manager in theirs, and anybody in a direct message or group. A line in the conversation says who pinned.",
          },
        ],
      },
      {
        id: "edit-and-remove",
        heading: "Edit and remove",
        blocks: [
          {
            bullets: [
              "**Edit** your own message for 15 minutes after you send it. It then shows **(edited)**.",
              "**Remove** your own message at any time. Everybody in the conversation sees **Message removed** in its place — nobody can read it any more, the owner included.",
              "The owner and admins, and a channel's manager, can remove somebody else's message in a channel. The activity log records who removed it, not what it said.",
              "In direct messages, groups, #general and job rooms nobody can remove another person's message.",
            ],
          },
        ],
      },
      {
        id: "search",
        heading: "Search",
        blocks: [
          {
            p: "The magnifying glass at the top of the list searches every conversation you are in; the one in a conversation searches that conversation, with a switch to search everywhere. Type at least two letters. Tap a result to open the conversation at that message. Private channels you are not in, and removed messages, are never searched.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Can I edit a message after 15 minutes?",
        a: "No. Remove it and send it again.",
      },
      {
        q: "Does removing a message delete it?",
        a: "It is removed from every screen for everybody. FieldQuo keeps its record, but nobody can open its words.",
      },
    ],
  },

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

  "channels-and-group-chats": {
    title: "Channels and group chats",
    summary: "Channels are places the office makes — #estimating, #crew-north, #announcements; group chats are conversations anybody starts. Who can make, change, join and leave each.",
    updated: "2026-10-04",
    intro: [
      "Besides **#general**, the job rooms and direct messages, Chat has two kinds of room people make by hand. A **channel** is a place: it has a name like **#estimating**, an optional topic, and it outlives the people in it. A **group chat** is a conversation between the people picked — three people sorting out tomorrow's van. #general and the job rooms are still kept by FieldQuo from your roster and your schedule.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          {
            p: "Channels sit under **Channels** in the list, after **#general**; group chats sit with your direct messages. A **public** channel can be found and joined by anyone at the company from **Browse channels**; a **private** channel is hidden from everybody who was not added — the owner included — and opening its link answers as if it did not exist. A channel can be set so that **Only the office can post**: owners, admins and supervisors post, everyone reads. That is how an **#announcements** channel works.",
          },
        ],
      },
      {
        id: "who-can-do-what",
        heading: "Who can do what",
        blocks: [
          {
            table: {
              head: [
                "Action",
                "Owner and admin",
                "Manager and Dispatcher",
                "Estimator and Crew",
              ],
              rows: [
                [
                  "Make a channel",
                  "Yes",
                  "Yes",
                  "No",
                ],
                [
                  "Start a group chat",
                  "Yes",
                  "Yes",
                  "Yes",
                ],
                [
                  "Join a public channel",
                  "Yes",
                  "Yes",
                  "Yes",
                ],
                [
                  "Rename a channel, set its topic, make it private, office-only posting, archive it",
                  "Any channel they are in",
                  "Channels they manage (the ones they made)",
                  "No",
                ],
                [
                  "Add or remove people in a channel",
                  "Any channel they are in",
                  "Channels they manage",
                  "No",
                ],
                [
                  "Rename a group chat or add people to it",
                  "Anybody in the group",
                  "Anybody in the group",
                  "Anybody in the group",
                ],
                [
                  "Remove people from a group chat",
                  "Yes, when they are in it",
                  "If they started it",
                  "If they started it",
                ],
              ],
            },
          },
          {
            note: "These are checked by the server on every change, not just hidden on the screen. A read-only support session can open every room and change none of them.",
          },
        ],
      },
      {
        id: "make-a-channel",
        heading: "Make a channel",
        blocks: [
          {
            steps: [
              "In **Chat**, press **+** beside **Channels** (or **Browse channels**, then **New channel**).",
              "Type a name. It is stored in lowercase with dashes — **It will be #crew-north** shows what you will get.",
              "Add a **Topic** if it helps people know what the channel is for.",
              "Choose **Public** or **Private**. A private channel needs the people you want in it.",
              "Turn on **Only the office can post** for announcements, and **Include everyone** to add the whole team now and every new person when they join.",
              "Press **Create channel**.",
            ],
          },
          {
            note: "Anyone at the company can read a public channel, crew included. Keep client details in the job's room.",
          },
        ],
      },
      {
        id: "start-a-group",
        heading: "Start a group chat",
        blocks: [
          {
            steps: [
              "Press **New message**.",
              "Pick two or more people. Picking one person opens your direct message with them instead.",
              "Give the group a name if you like — otherwise it is called by the people in it.",
              "Press **Start group**.",
            ],
          },
        ],
      },
      {
        id: "archive-and-leave",
        heading: "Archive, leave and remove",
        blocks: [
          {
            bullets: [
              "**Archive channel** keeps every message and makes the channel read-only; it moves under **Archived**. **Unarchive channel** brings it back. Nothing is deleted.",
              "**Leave channel** or **Leave group** takes you out; your messages stay, and someone can add you back.",
              "You cannot leave #general, a job room, a direct message, or a channel set to **Include everyone** — mute it instead.",
              "**Remove** takes somebody out of a channel or group. Their messages stay where they were.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Can the owner read a private channel?",
        a: "Only if they are in it. A private channel is hidden from everybody who was not added, owners and admins included.",
      },
      {
        q: "How big can a group chat be?",
        a: "There is no limit. The people list loads fifty at a time, and typing @ searches everybody in the group.",
      },
      {
        q: "Can crew make a channel?",
        a: "No. Crew and estimators start group chats; channels are made by owners, admins, managers and dispatchers.",
      },
    ],
  },

  "chat-notifications-and-mute": {
    title: "Chat notifications and mute",
    summary: "What each kind of room tells you about by default, how to change it or mute a room for a while, and why a mention also lands in the bell.",
    updated: "2026-10-04",
    intro: [
      "Every room in Chat has your own notification setting. Nobody else sees it, and nobody else's setting changes what you get. Open a room and press the gear (or the people count) to find **Your notifications**.",
    ],
    sections: [
      {
        id: "defaults",
        heading: "What you are told about by default",
        blocks: [
          {
            table: {
              head: [
                "Room",
                "You are told about",
              ],
              rows: [
                [
                  "A direct message",
                  "Every message",
                ],
                [
                  "A group chat",
                  "Every message",
                ],
                [
                  "#general, a channel, a job room",
                  "Only when you are mentioned",
                ],
              ],
            },
          },
          {
            p: "You are never told about your own messages, and you are not pushed a message while you have that room open on your screen.",
          },
        ],
      },
      {
        id: "change-it",
        heading: "Change it for one room",
        blocks: [
          {
            steps: [
              "Open the room and press the gear.",
              "Under **Your notifications**, pick **Every message**, **Only when I'm mentioned**, or **Nothing (mute until I turn it back on)**. **Default** goes back to the table above.",
              "To mute for a while, press **1 hour** or **Until tomorrow 7 AM**. **Unmute** ends it early.",
            ],
          },
        ],
      },
      {
        id: "what-mute-does",
        heading: "What muting does",
        blocks: [
          {
            bullets: [
              "A muted room is drawn grey with a crossed-out bell, and its count is grey. The words are still there; nothing is hidden.",
              "While a room is muted for a while, a mention still reaches you, and only mentions count on the **Chat** tab.",
              "**Nothing** silences the room completely — mentions too — and leaves it out of the **Chat** tab's number.",
              "**Hide from my list** (direct messages and group chats) takes a conversation off your list until somebody writes in it again.",
            ],
          },
        ],
      },
      {
        id: "mentions-in-the-bell",
        heading: "Mentions in the bell",
        blocks: [
          {
            p: "When somebody mentions you with @ in a group chat, a channel, #general or a job room, it also lands in the notification bell — **Ana mentioned you in #estimating** — and tapping it opens the chat at that message. The bell row keeps who and where, not the words of the message. A direct message does not add a bell row (it already notifies you), and a room set to **Nothing** adds none.",
          },
          {
            note: "Only the office's **@everyone** notifies the whole room. Anyone else's @everyone is sent as plain text, and the composer says so before you send.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Why did I not get a notification while I was in the room?",
        a: "Because you were looking at it. FieldQuo does not push a message that is already on your screen.",
      },
      {
        q: "Does muting tell anybody?",
        a: "No. Your notification settings are yours alone.",
      },
    ],
  },

  "seen-by-in-team-chat": {
    title: "Seen by in team chat",
    summary: "Under your last message, Seen by 3 says how many people in the conversation have had it on their screen — tap it for the names. Only the conversation's members see it.",
    updated: "2026-10-04",
    intro: [
      "In Chat, the line under your own last message says who has seen it: **Seen by 3** in a group, a channel or a job room, and **Seen** in a direct message. Tap it for the list of names. On any earlier message of yours, **Seen by** is in the bar that appears when you point at the message.",
    ],
    sections: [
      {
        id: "what-it-means",
        heading: "What it means",
        blocks: [
          {
            bullets: [
              "**Seen** means the message was on that person's screen in this conversation — they opened the room, or it arrived while they had it open.",
              "It does not mean they read it carefully, and there is no typing indicator.",
              "It counts the people in the conversation now. Somebody added later counts once they open it.",
            ],
          },
        ],
      },
      {
        id: "who-sees-it",
        heading: "Who can see it",
        blocks: [
          {
            p: "Only the people in the conversation. The screen offers it on your own messages. Somebody outside a private channel cannot see it, and FieldQuo's read-only support session does not see it either.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Can I turn it off?",
        a: "No. Seen by is part of team chat for everyone in a conversation, the way the unread line is.",
      },
      {
        q: "Does the owner see who has read what?",
        a: "Only in conversations the owner is in, like anybody else.",
      },
    ],
  },
};
