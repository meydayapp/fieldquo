// content/help/en/marketing-and-website-3.js
//
// Part 3 of the “marketing-and-website” category in English (see the
// composer, marketing-and-website.js). Slugs assigned to this part
// (lib/help/tree.js): get-facebook-and-instagram-lead-ads-into-fieldquo,
// answer-facebook-and-instagram-messages-from-fieldquo, whatsapp-coming-soon,
// send-lead-results-to-meta.
//
// Written 2026-09-28, after lead forms moved onto the Facebook Page
// connection (lib/meta/leadsFetch.js's resolveLeadsCredential). Every sentence
// is read from app/app/settings/meta-ads/MetaLeadFormsPanel.js and its routes
// (app/api/meta/leads/*, app/api/cron/meta-leads), lib/meta/leadsWebhookIngest.js,
// app/components/settings/SocialPublishingPanel.js, app/app/messages/*,
// lib/messaging/{serviceWindow,platforms,threadControl,instagramSendErrors,
// pageImport}.js, app/components/settings/WhatsAppPanel.js and
// lib/meta/whatsappPanelState.js. The words on the screens are the `en` block
// of app/i18n/appMessages.js. Meta's own screens are named with Meta's own
// labels, in quotation marks, because that is what the reader will see there.
export const ARTICLES = {
  "get-facebook-and-instagram-lead-ads-into-fieldquo": {
    title: "Get your Facebook and Instagram lead ads into FieldQuo",
    summary:
      "Connect your Facebook Page, find your lead forms, switch on the ones that matter and send a test lead — the checklist on Settings → Meta Ads ticks each step as it happens.",
    updated: "2026-09-28",
    intro: [
      "A lead ad on Facebook or Instagram carries a form Meta shows inside its own app. When a homeowner fills one in, FieldQuo can turn the submission into a card on your **Leads** board — scored, notified and followed up like any other enquiry. All of it is set up on one screen: **Settings → Meta Ads**, in the **Facebook lead forms** card.",
      "Lead forms and leads are read through your **Facebook Page** connection — the **Facebook & Instagram publishing** card further down the same screen — not through the Meta ad account at the top. The ad account brings in what you spend; the Page brings in the leads.",
    ],
    sections: [
      {
        id: "before-you-start",
        heading: "Before you start",
        blocks: [
          {
            bullets: [
              "A Facebook login that manages the Page your ads run from.",
              "At least one lead form on an ad for that Page. FieldQuo finds and reads your forms; it does not build them — you create the form in Meta when you create the ad.",
              "An owner or administrator account in FieldQuo. **Meta Ads** sits under **Getting paid** in Settings, like **Payments**, and other roles neither see it nor can use it.",
            ],
          },
          {
            note: "If the card shows **Facebook lead forms need Meta's approval of one more permission; nothing is being received yet.**, every switch and **Find my lead forms** are disabled and the checklist below is not drawn. That is Meta's review of FieldQuo, not your setup, and there is nothing to do until the sentence goes away.",
          },
        ],
      },
      {
        id: "the-checklist",
        heading: "The checklist at the top of the card",
        blocks: [
          {
            p: "The card opens with **Getting your lead ads into FieldQuo**, a short list that ticks itself from what FieldQuo can already see — nothing to mark by hand. Each unticked line says what to do and names the button on this screen that does it. **Step-by-step guide** opens this article.",
          },
          {
            bullets: [
              "**Facebook Page connected, with the lead permissions** — a Page is connected and Meta granted it every permission lead forms need.",
              "**Lead forms found** — **Find my lead forms** has listed at least one form.",
              "**At least one form switched on** — a form's switch reads **On**.",
              "**First lead received** — a lead from Meta has arrived in FieldQuo.",
            ],
          },
          {
            figure: "live:app-settings-meta-ads",
            caption: "Settings → Meta Ads — the Facebook lead forms card with Find my lead forms, and a connected Page under Facebook & Instagram publishing below it.",
          },
        ],
      },
      {
        id: "connect-your-page",
        heading: "Step 1: connect your Facebook Page",
        blocks: [
          {
            steps: [
              "Open **Settings → Meta Ads** and scroll to **Facebook & Instagram publishing**.",
              "Press **Connect Facebook & Instagram** and sign in to Facebook.",
              "Allow every permission Meta shows. Un-ticking one leaves a connection that looks fine and cannot read your leads.",
              "If your login manages several Pages, choose the one your ads run from under **Which Page?** and press **Connect this Page**.",
              "Back on the lead forms card, check the line **Lead forms and leads are read through your Facebook Page connection: …** — it names the Page FieldQuo will read.",
            ],
          },
          {
            tip: "FieldQuo reads the forms and leads of one Page: the one connected. If your ads run from another Page, press **Reconnect or switch Page** and choose that one. If Meta held back a permission, an amber line names it and says to press the same button and allow it.",
          },
        ],
      },
      {
        id: "find-and-switch-on",
        heading: "Steps 2 and 3: find your forms and switch them on",
        blocks: [
          {
            steps: [
              "Press **Find my lead forms**. FieldQuo asks Meta for the forms on the connected Page and lists each one with its Page, **Leads: 0** and a switch.",
              "Turn the switch to **On** for each form whose submissions should become leads.",
              "Leave any other form **Off** — a newsletter sign-up, for example. Nothing from a form that is off is imported.",
            ],
          },
          {
            p: "A form you have just found always starts **Off**: finding a form is not agreeing to import it, and pressing **Find my lead forms** again never switches back on a form you turned off. A form you delete in Meta stays on the list, because the leads it already produced still point to it.",
          },
        ],
      },
      {
        id: "what-the-messages-mean",
        heading: "What the card's messages mean",
        blocks: [
          {
            table: {
              head: ["The card says", "What it means, and what to do"],
              rows: [
                ["**Looked at the Page …: 3 lead forms found.**", "It worked. The number is how many forms Meta returned for that Page."],
                ["**Looked at the Page …: Meta returned no lead forms for it.**", "The Page was read and has no lead form. Create the form on your ad in Meta — or connect the Page the ad actually runs from — then press **Find my lead forms** again."],
                ["**Connect your Facebook Page in Facebook & Instagram publishing below first …**", "No Page is connected yet. Do step 1."],
                ["**Meta did not grant the Page connection for … these permissions: …**", "Press **Reconnect or switch Page** and allow every permission Meta asks for."],
                ["**Meta no longer accepts FieldQuo's access to …**", "The stored access expired or was removed in Meta. Press **Reconnect or switch Page**."],
                ["**Meta refused to give FieldQuo the leads of …: this business uses Leads Access Manager.**", "Your business restricts who may read its leads. See the next section."],
                ["**No lead has been received from Meta yet.** or **Last lead received …**", "Whether any lead has arrived. The second one is the proof that the whole chain works."],
              ],
            },
          },
        ],
      },
      {
        id: "leads-access",
        heading: "Leads access, only if Meta asks for it",
        blocks: [
          {
            p: "Most businesses never touch Meta's Leads Access Manager, and for them the Page connection is enough. If yours restricted it, Meta refuses FieldQuo the leads, **Find my lead forms** comes back with the Leads Access Manager message above, and the checklist gains a step: **FieldQuo assigned in Meta's Leads access**, with an **Open Leads access in Meta** link. Only then:",
          },
          {
            steps: [
              "Open Meta Business Settings, then “Integrations” → “Leads access”. The address **business.facebook.com/settings/leads-accesses** goes straight there.",
              "Choose your Page.",
              "Open the “CRMs” tab and press “Assign CRMs”.",
              "Choose FieldQuo and confirm.",
              "Back in FieldQuo, press **Find my lead forms** again. When Meta no longer refuses, the step leaves the checklist.",
            ],
          },
          {
            note: "These are Meta's screens and Meta's labels, and FieldQuo cannot assign itself: somebody who manages your business in Meta has to do it.",
          },
        ],
      },
      {
        id: "test-it",
        heading: "Step 4: send a test lead",
        blocks: [
          {
            steps: [
              "Open Meta's Lead Ads Testing Tool at **developers.facebook.com/tools/lead-ads-testing** — the checklist's **Open Meta's Lead Ads Testing Tool** link opens it — signed in with a Facebook login that manages the Page.",
              "Choose your Page and a form you switched **On**, and submit a test lead.",
              "Reload **Settings → Meta Ads**: **Last lead received …** appears, the form's **Leads** count goes up and **First lead received** is ticked.",
              "Open **Leads**. The test submission is a card like any other — remember it is a test when you see it.",
            ],
          },
          {
            p: "FieldQuo hears about a submission two ways: Meta's instant notice, and its own re-read of every switched-on form once an hour. If the instant notice is missed, the lead still arrives on the next hourly pass — and the same lead never arrives twice, because each one is recorded under Meta's own id.",
          },
        ],
      },
    ],
    faq: [
      { q: "Do I need the Meta ad account connected too?", a: "Not for the leads — they are read through the Page connection. Connecting the ad account adds what you spend on ads to your marketing numbers." },
      { q: "Why does my checklist not show the Leads access step?", a: "Because Meta has not refused FieldQuo. The step appears only after Find my lead forms comes back with Meta's Leads Access Manager refusal, since most businesses never restrict leads access." },
      { q: "Will a lead from a form notify me?", a: "Yes. It is created like any other enquiry: scored Hot, Warm or Cold, and announced to the same people as a lead from your website." },
    ],
  },

  "answer-facebook-and-instagram-messages-from-fieldquo": {
    title: "Answer Facebook and Instagram messages from FieldQuo",
    summary:
      "Connect your Facebook Page once and its messages — and your linked Instagram account's — arrive in Messages, where you answer them within Meta's 24-hour reply window.",
    updated: "2026-09-28",
    intro: [
      "When a homeowner writes to your Facebook Page, or to the Instagram professional account linked to it, the conversation lands in **Messages** in FieldQuo and you answer it there. The reply goes out from your Page or your Instagram account — the homeowner never sees FieldQuo.",
      "Two rules come from Meta, not from FieldQuo, and most of this article is about them: a business may only reply within 24 hours of the customer's last message, and only one app at a time may answer a given conversation. While **Messages** shows **Early preview.** at the top, it works and parts of it may still change.",
    ],
    sections: [
      {
        id: "connect",
        heading: "Connect your Page",
        blocks: [
          {
            steps: [
              "Open **Settings → Meta Ads** (owner and administrators only) and scroll to **Facebook & Instagram publishing**.",
              "Press **Connect Facebook & Instagram**, sign in to Facebook and allow every permission Meta shows.",
              "If your login manages several Pages, choose one under **Which Page?** and press **Connect this Page**.",
              "Check the line under the Page's name. **Meta is sending this Page's messages to FieldQuo — set up on …** means new messages will arrive on their own.",
            ],
          },
          {
            figure: "live:app-settings-meta-ads",
            caption: "Settings → Meta Ads — a connected Page with its Instagram account, the line saying Meta is sending the Page's messages to FieldQuo, and Import past conversations.",
          },
          {
            note: "Other lines tell you what is wrong: **Messages from this Page aren't reaching FieldQuo** comes with **Try subscribing again**; **Your inbox isn't switched on for this Page yet** comes with **Connect the inbox**; a line naming permissions Meta has not granted means Meta has not yet approved them for FieldQuo. Instagram needs an Instagram professional account linked to the Page — otherwise the card reads **No Instagram account linked to this Page — Facebook only.**",
          },
        ],
      },
      {
        id: "what-arrives",
        heading: "What arrives, and who sees it",
        blocks: [
          {
            bullets: [
              "Every new conversation appears in **Messages**, marked Facebook or Instagram. The **Facebook** and **Instagram** chips filter the list, and conversations are grouped under **Needs a reply**, **Waiting on them**, **Snoozed** and **Done**.",
              "What the person sends comes with it: text, photos and other attachments, and a map pin when they share a location on Messenger.",
              "Conversations from before you connected are not delivered by Meta on their own. **Import past conversations** on the settings card, or **Refresh from Facebook** in Messages, pulls up to the last 30 days; it can run once every ten minutes.",
              "Your replies from FieldQuo are text only on Facebook and Instagram — the paperclip for photos and files is shown on WhatsApp conversations only.",
              "Anyone whose access includes **Requests** at **View only** or more can read the inbox and gets a push notification for a new message if they turned notifications on; replying needs **View, create, and edit**.",
            ],
          },
          {
            figure: "live:app-messages",
            caption: "Messages — the Facebook and Instagram chips, Refresh from Facebook, and conversations grouped under Needs a reply and Waiting on them.",
          },
        ],
      },
      {
        id: "the-24-hour-window",
        heading: "The 24-hour reply window",
        blocks: [
          {
            p: "Facebook and Instagram only let a business reply within 24 hours of the customer's last message. The window restarts every time they write again. FieldQuo works it out before you type, so the conversation tells you where you stand instead of letting Meta bounce a reply you already wrote.",
          },
          {
            table: {
              head: ["The conversation shows", "What you can do"],
              rows: [
                ["Nothing — the window is open", "Reply as normal."],
                ["**Less than an hour left to reply.**", "Reply now; after that, replying from FieldQuo stops until they write again."],
                ["**Reply window closed.** — it has been longer than 24 hours", "Nothing can be sent from FieldQuo. The conversation reopens as soon as they write again; until then call or email them — **Open …'s client record to call or email** takes you there when the conversation is linked to a client."],
                ["**Reply window closed.** — this person has not messaged your Page or account", "Only somebody who wrote to you can be answered here. Reach them another way."],
              ],
            },
          },
          {
            note: "Meta has an exception for replies by a human agent up to seven days later, but it is a permission FieldQuo does not hold, so there is no way around the 24 hours from FieldQuo on Facebook or Instagram.",
          },
        ],
      },
      {
        id: "another-app",
        heading: "“Another app is in control of this conversation”",
        blocks: [
          {
            p: "Meta lets only one app at a time answer a conversation. If Meta's own automated replies or Business AI already took it, your reply fails with **Not sent — another app is in control of this conversation at Meta. Your message is still in the box.** and the conversation shows what to change:",
          },
          {
            bullets: [
              "In Meta Business Suite, open “Inbox” → “Automations” and turn off the automated replies and Business AI for the Page or Instagram account.",
              "Facebook: in your Page's settings, open the “Conversation Routing” tab and set FieldQuo as the default app. Instagram: in Meta's conversation routing settings for the account, set FieldQuo as the app that answers messages.",
              "Then press **Send** again — your message is still in the box. A conversation Meta's automation already holds may stay with it until it is handed back; new conversations come to FieldQuo.",
              "On Facebook only, **Ask to take over this conversation** asks Meta to hand this one over. The app holding it decides and FieldQuo is not told its answer, so press **Send** to find out.",
            ],
          },
        ],
      },
      {
        id: "instagram-allow-access",
        heading: "Instagram: “Allow Access to Messages”",
        blocks: [
          {
            p: "If an Instagram reply fails with **Not sent — Meta refused this Instagram reply because Instagram messaging isn't enabled for this connection.**, the conversation explains why and what to change. On your side there are two things:",
          },
          {
            steps: [
              "In the Instagram app, turn on the setting Meta requires: Instagram Settings > Messages and story replies > Message controls > Connected Tools > Allow Access to Messages.",
              "If the notice names a permission your connection is missing, press **Reconnect in settings** and allow everything Meta asks. The person reconnecting needs at least “Moderate” task access on the Facebook Page.",
              "Press **Send** again. If it still fails, contact FieldQuo support.",
            ],
          },
        ],
      },
    ],
    faq: [
      { q: "Can I message someone who has never written to my Page?", a: "No. Facebook and Instagram only let a business answer somebody who wrote to it in the last 24 hours. Call or email them instead." },
      { q: "Does disconnecting the Page delete the conversations?", a: "No. The access is deleted and new messages stop arriving, but the conversations already in Messages stay, and reconnecting picks them up again." },
      { q: "Why did a reply fail although I answered within the hour?", a: "Most often another app holds the conversation — see “Another app is in control of this conversation” above. The failed reply says which case it is." },
    ],
  },

  "whatsapp-coming-soon": {
    title: "WhatsApp (coming soon)",
    summary:
      "WhatsApp Business messages in FieldQuo are built and waiting on Meta's App Review of FieldQuo's two WhatsApp permissions; here is what the card says today and what it will do once Meta says yes.",
    updated: "2026-09-28",
    intro: [
      "You can't connect a WhatsApp number to FieldQuo yet. The inbox side is built. What is missing is one decision by Meta: its App Review has to grant FieldQuo advanced access to the two WhatsApp permissions, and until it does no business can connect its own number. FieldQuo does not know when that will be.",
      "Rather than a Connect button that would lead to a Meta page refusing you, the **WhatsApp Business** card on **Settings → Meta Ads** says so in one sentence.",
    ],
    sections: [
      {
        id: "what-the-card-says",
        heading: "What the card says today",
        blocks: [
          {
            p: "The card reads **WhatsApp is coming soon. It's built, and waiting on Meta's App Review to grant FieldQuo's two WhatsApp permissions — the Connect WhatsApp button appears here the day Meta does.** If your Facebook Page or Instagram account is already connected, it adds, for example, **Your Facebook and Instagram messages already come in here.**",
          },
          {
            p: "There is no button and nothing to fill in. Like the rest of **Settings → Meta Ads**, the card is for the owner and administrators.",
          },
        ],
      },
      {
        id: "what-is-missing",
        heading: "What FieldQuo is waiting for",
        blocks: [
          {
            p: "FieldQuo is already registered and verified with Meta to connect other businesses' WhatsApp numbers. What is still pending is Meta's App Review of two permissions: **whatsapp_business_messaging**, which sends and receives the messages, and **whatsapp_business_management**, which reads your number and your templates. Today FieldQuo has standard access to both, which works only for FieldQuo's own business; your business needs advanced access, and only the review grants it. Until then Meta's sign-up refuses every business except FieldQuo's own, so a Connect button would only ever end on Meta's refusal. That is why none is shown.",
          },
        ],
      },
      {
        id: "what-it-will-do",
        heading: "What it will do once Meta approves",
        blocks: [
          {
            bullets: [
              "**Connect WhatsApp** will take you through Meta's own sign-up, where you choose or create a WhatsApp Business account and the number your clients write to.",
              "Messages to that number will land in **Messages** under a **WhatsApp** chip, beside your Facebook and Instagram conversations.",
              "WhatsApp's own 24-hour rule will apply: typed replies within 24 hours of the client's last message, and after that only a template Meta approved in advance. FieldQuo will read your templates from Meta with **Refresh templates**.",
              "From a WhatsApp conversation you will be able to send photos, videos and documents, and your company's address as a map pin when that address was chosen from the map suggestions.",
            ],
          },
        ],
      },
      {
        id: "until-then",
        heading: "Until then",
        blocks: [
          {
            bullets: [
              "Answer your Facebook and Instagram messages in FieldQuo — see [[answer-facebook-and-instagram-messages-from-fieldquo|Answer Facebook and Instagram messages from FieldQuo]].",
              "Keep answering WhatsApp from your phone as you do today. There is nothing to request from FieldQuo; the card changes when Meta grants advanced access.",
              "If you already have a WhatsApp Business account with Meta, you can write your message templates in Meta's WhatsApp Manager ahead of time; FieldQuo reads the approved ones once your number is connected.",
            ],
          },
        ],
      },
    ],
    faq: [
      { q: "Can I get early access?", a: "No. Until Meta's App Review grants advanced access to the two WhatsApp permissions, Meta's sign-up refuses every business but FieldQuo's own, so there is no door to open early." },
      { q: "When will it be ready?", a: "When Meta's App Review grants advanced access — Meta sets the timing, not FieldQuo. FieldQuo switches the card on the day it lands." },
    ],
  },
  // Written 2026-10-05 from app/app/settings/meta-ads/MetaConversionsPanel.js,
  // app/api/settings/meta-conversions/*, lib/meta/capi/* and
  // docs/META-CONVERSIONS-API.md. The words on the screen are the `en` block of
  // app/i18n/appMessages.js (app.setMetaCapi.*); Meta's own screens are named
  // with Meta's labels, in quotation marks.
  "send-lead-results-to-meta": {
    title: "Send lead results to Meta",
    summary:
      "Tell Facebook and Instagram which of their leads were real, which were not, and which booked, got a quote and bought — so Meta finds more people like your customers.",
    updated: "2026-10-05",
    intro: [
      "Meta counts every tap on a lead form as a lead and every opened chat as a conversation, whether the person meant it or not. Your ads then learn to find more people who tap. **Send lead results to Meta** sends back what FieldQuo knows and Meta does not: which leads were real, which were not, and which ones booked, got a quote and bought.",
      "It is one switch on **Settings → Meta Ads**, off until an owner or administrator turns it on. It covers your Facebook and Instagram lead forms, your funnels and instant estimate when the visitor came from an ad, and — once Meta approves FieldQuo's app for it — your Messenger and Instagram ad conversations.",
    ],
    sections: [
      {
        id: "what-is-sent",
        heading: "What FieldQuo tells Meta",
        blocks: [
          {
            p: "For a lead from a Facebook or Instagram lead form, FieldQuo sends each stage the lead reaches, once, under Meta's own lead id:",
          },
          {
            table: {
              head: ["Stage", "When it is sent"],
              rows: [
                ["**Raw Lead**", "When the lead arrives in FieldQuo."],
                ["**Qualified**", "When the lead is warm or hot — and, if it came through a conversation, that conversation was judged a real lead."],
                ["**Disqualified**", "When the conversation was only a tap or was not about your work, when someone marks the lead lost as not a real inquiry, or deletes it as not a lead."],
                ["**Appointment Booked**", "When an appointment is booked for the lead's client or quote."],
                ["**Quote Sent**", "When the lead's quote is sent."],
                ["**Converted**", "When the quote is accepted, or the conversation is marked won — with the amount and your currency."],
              ],
            },
          },
          {
            bullets: [
              "**Messenger and Instagram ad conversations**: **LeadSubmitted** when the conversation becomes a warm or hot lead, and **Purchase** with the amount when that client accepts a quote. A conversation that was only a tap, or was not about your work, sends nothing.",
              "**Your funnels and instant estimate**: when the visitor came from a Meta ad, the same **Lead** your page's pixel already fires is also sent from FieldQuo's server with the same event id, so Meta counts it once. A booking sends **Schedule**, and an accepted quote sends **Purchase**.",
            ],
          },
        ],
      },
      {
        id: "turn-it-on",
        heading: "How to turn it on",
        blocks: [
          {
            steps: [
              "Open **Settings → Meta Ads** and find **Send lead results to Meta**.",
              "Under **1. Meta's Business Tools Terms**, tick the box and press **Accept**. The screen records who accepted and when.",
              "Under **2. Your Meta dataset (pixel)**, enter your dataset ID — or press **Pick from my ad account** if your Meta ad account is connected. If you set an ad tracking pixel for your instant estimate, it is already filled in.",
              "In Meta's Events Manager, open that dataset, then \"Settings\", \"Conversions API\", \"Generate access token\". Paste the token into **Conversions API access token** and press **Save**.",
              "Under **3. Send a test event**, copy the test code from the dataset's \"Test events\" tab in Events Manager, paste it and press **Send test event**. The event appears on Meta's \"Test events\" tab only.",
              "Turn the switch at the top of the card on.",
            ],
          },
          {
            figure: "live:app-settings-meta-ads",
            caption: "Settings → Meta Ads — Send lead results to Meta sits under the Facebook lead forms card.",
          },
          {
            note: "The switch cannot be turned on before the terms are accepted, and **Send test event** stays greyed out until a dataset ID, a token and the terms are in place — hold the pointer over it to see what is missing.",
          },
        ],
      },
      {
        id: "what-is-being-sent",
        heading: "Reading “What is being sent”",
        blocks: [
          {
            p: "The card lists four lines — lead forms, your funnels and instant estimate, Messenger and Instagram — and says for each one whether it is **sending**, or what it is waiting for.",
          },
          {
            bullets: [
              "**Needs Meta permission page_events** (or **instagram_manage_events**) — Messenger and Instagram events need a permission Meta has to approve for FieldQuo's app. Nothing is sent until then, and there is nothing for you to do.",
              "**off while you ask visitors before loading ad tracking** — if you switched on asking visitors before loading ad pixels, FieldQuo cannot see their answer on the server, so your pages send nothing server-side.",
              "Under the list, the card shows the last sync and, for the last 30 days, how many events were sent, failed, are waiting, or were too old for Meta.",
            ],
          },
        ],
      },
      {
        id: "conversion-leads",
        heading: "Set up your campaign to use the results",
        blocks: [
          {
            steps: [
              "In Ads Manager, create or edit a Leads campaign that uses an Instant Form.",
              "In the ad set, under \"Performance goal\", choose \"Maximize number of conversion leads\".",
              "Pick the same dataset, then the stage to optimise for — usually **Qualified**, or **Converted** once you have enough sales.",
              "Leave the campaign running. Meta needs a few weeks of results before it learns.",
            ],
          },
          {
            warning: "Meta's rules for this goal: results must be uploaded at least once a day (FieldQuo sends every 15 minutes, with a daily catch-up), and the stage you optimise for should happen within 28 days of the lead, for 1% to 40% of your leads. Meta also asks for about 200 leads a month.",
          },
        ],
      },
      {
        id: "privacy",
        heading: "Privacy and what never leaves",
        blocks: [
          {
            bullets: [
              "Emails and phone numbers are hashed (SHA-256) before they leave FieldQuo. Meta never receives them in plain text, and they are not stored in plain text in the queue either.",
              "Nothing is sent while the switch is off. Turning it off stops everything; events already waiting are not sent.",
              "Meta refuses events more than 7 days old, so FieldQuo never sends an older one.",
              "Your access token is stored encrypted, is only ever sent to Meta, and is never shown again — the card shows its last four characters.",
            ],
          },
        ],
      },
    ],
    faq: [
      { q: "Will my older leads be sent?", a: "Only the last 7 days of stages, because Meta refuses anything older. FieldQuo support can run a one-off history send for your company; it shows the counts per stage first." },
      { q: "Does it change my ads?", a: "No. FieldQuo never creates or edits an ad. It only tells Meta what happened to the leads; your campaign uses that once you choose \"Maximize number of conversion leads\"." },
      { q: "Why does Messenger say it needs a Meta permission?", a: "Meta requires FieldQuo's app to be approved for page_events and instagram_manage_events before it can send conversation results. Lead forms and your own pages work without it." },
    ],
  },
};
