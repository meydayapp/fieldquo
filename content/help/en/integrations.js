// content/help/en/integrations.js
//
// Articles of the “integrations” category in en. Keyed by slug; the slugs are
// listed in lib/help/tree.js and scripts/check-help-centre.mjs refuses a
// module that is missing one or carries one the tree does not.
//
// Every sentence here is read off the code that runs the integration — the
// settings page, the API route behind it and the lib/** rule — on 2026-09-12.
// The category's job is to say, per outside service, what it does inside
// FieldQuo, what you have to do, what data leaves the building, and what is
// NOT integrated. "FieldQuo does not do X" is a deliberate sentence, not a
// gap.
export const ARTICLES = {
  "stripe": {
    title: "Stripe",
    summary:
      "How Stripe is used twice — once so your clients can pay you, once so FieldQuo can bill you — what you connect, what Stripe sees, and what Disconnect really does.",
    updated: "2026-09-12",
    intro: [
      "Stripe does two different jobs in FieldQuo, and they are never the same account. **Stripe Connect** is yours: an Express account created in your company's name when you press **Connect with Stripe**, into which every online payment from a client is deposited. **Stripe Billing** is FieldQuo's: the card you gave at signup, charged for your plan, your phone credit and the migration service. This article is about the first one, and says where the second one lives so the two are never confused.",
      "The short version: connect once on **Settings → Payments**, finish what Stripe asks for on Stripe's own page, and from then on every invoice, deposit and instalment carries a Pay button. FieldQuo never holds the money and never sees your bank details.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A client paying online is a Stripe charge created in your company's name — your name is what appears on their card statement — and paid out to your bank by Stripe on its standard schedule, about 2 business days for a Canadian or US account. A processing fee comes off each payment before it reaches you: **3% + $0.30** on a card, **1% + $0.40 capped at $5.00** on a Canadian bank debit, **0.8% capped at $5.00** on a US one. Nothing is billed separately and there is no monthly fee for taking payments. The full arithmetic is in [[payment-processing-fees-and-payouts|Payment processing fees and payouts]]." },
          { p: "Your subscription is the other Stripe. It is charged to the card on **Account & Billing**, and **Manage billing & payment method** there opens Stripe's billing portal for that card — not your payout account. The two never touch: a client's payment can never be applied to your FieldQuo bill, and your FieldQuo bill is never taken from your payouts." },
          { note: "FieldQuo sends Stripe the invoice number and the amount. The client types their card or bank details on Stripe's page, never on a FieldQuo page, and the line at the bottom of Settings → Payments is literally true: FieldQuo never sees or stores your bank account details." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on Settings → Payments",
        blocks: [
          { p: "The page reads, top to bottom: the Stripe connection card, **Processing fees**, **Instant payout**, **Payment methods you accept**, **Your Stripe account** (owner only), and — once the connection is active — **Offer pay-over-time (Affirm)**. The connection card is in one of four states, and each says what to do next." },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — the connection card reading Stripe connected · Active, with Manage in Stripe and Disconnect, then the fee and payout cards." },
          { table: {
            head: ["The card reads", "What it means", "What to press"],
            rows: [
              ["**Not connected yet**", "No Stripe account exists for this company yet.", "**Connect with Stripe** — you leave for Stripe's hosted setup and come back here."],
              ["**Stripe still needs a few things**", "Stripe has not enabled payments; the outstanding items are listed under the heading.", "**Finish Setup** to go back to Stripe, or **I've already done this** to make FieldQuo ask Stripe again."],
              ["**Stripe is reviewing your details**", "Everything is submitted; Stripe is verifying it. Minutes usually, occasionally a day or two.", "**Check again**. Sending the same document twice does not speed it up."],
              ["**Stripe connected · Active**", "Charges are enabled. Every invoice your clients receive now carries a Pay button.", "**Manage in Stripe** opens your Express dashboard in a new tab; **Disconnect** unlinks it."],
            ],
          } },
          { p: "The page asks Stripe directly every time it loads rather than trusting what it last heard, so the badge is Stripe's answer, not a stale column. That matters when you come back from Stripe's page: the account was updated seconds ago and the page checks before it draws." },
        ],
      },
      {
        id: "connect",
        heading: "How to connect",
        blocks: [
          { steps: [
            "Open **Settings → Payments** and press **Connect with Stripe**.",
            "On Stripe's page, enter what it asks for — business details, a director's identity, a bank account. [[what-stripe-asks-for-and-why|What Stripe asks for and why]] walks through it.",
            "You land back on Settings → Payments. If the card reads **Stripe connected · Active**, you are done; if it lists things Stripe still needs, press **Finish Setup**.",
            "Send an invoice. Its email and the client portal now carry **Pay** by card, and — once Stripe has activated bank debit on your account — **Pay … from bank account** beside it.",
          ] },
          { p: "Bank debit is not a setting. FieldQuo requests the capability for your country when you connect, Stripe activates it on its own schedule, and the **Processing fees** card tells you which state you are in: **Clients can pay invoices by card or from a bank account (pre-authorized debit, Canada)** — or ACH for a US company — or that bank payments will be offered once Stripe activates them. Nothing to do on your side. Bank debit is then offered on invoices, deposits and payment-schedule instalments from the client portal, and on service plans with automatic collection; see [[bank-debit-in-canada|Bank debit in Canada]]." },
          { tip: "Under Your Stripe account, two switches are shown separately: **Taking card payments** and **Paying out to your bank**. Cards can keep working while payouts are paused — the money is collected and held by Stripe, not lost. When that happens the connection card says **Stripe is holding your money** or **Stripe is reviewing your account**, and [[payouts-held-or-under-review|Payouts held or under review]] says what each needs." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**Manage in Stripe** — opens a sign-in link to your Stripe Express dashboard in a new tab. Payouts, identity documents, your bank account and Stripe's own support all live there.",
            "**Disconnect** — unlinks the account from FieldQuo. Clients cannot pay online until you reconnect. It does **not** close or delete your Stripe account, and nothing about your payout history changes — but pressing **Connect with Stripe** afterwards creates a **brand-new** Express account from scratch, with Stripe's setup to do again. Disconnect is for leaving, not for fixing a problem.",
            "**Payment methods you accept** — tick **Cash**, **E-transfer** and **Cheque**. What you tick appears as an **Accepted:** line on the invoice email, in the client portal and on the invoice PDF; untick everything and the line is left out. These are recorded by hand and carry no fee.",
            "**Offer pay-over-time (Affirm)** — lets a client split an invoice between $50 and $30,000, in USD or CAD, with Affirm at checkout, alongside paying by card. You are still paid in full, up front. You must first activate Affirm in your Stripe dashboard; Affirm's fee on those payments is passed through the same way as the card fee.",
            "**Instant payout** — sends your available balance to a debit card in about 30 minutes for 1% of the amount; see [[instant-payouts|Instant payouts]].",
            "**Refund** on a payment row of the invoice — the only way to refund a client. Your Express dashboard cannot refund a charge FieldQuo created; the button in FieldQuo does, in full or in part, with a reason, and the processing fee is not returned. See [[refunds|Refunds]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Settings → Payments is for the **owner and administrators**. A Manager or Dispatcher does not see the row, and the routes behind Connect, Disconnect and Manage in Stripe refuse anyone else on the server, so a person who types the address gets a refusal rather than the page. The **Your Stripe account** card — the acct_ id, the sign-in email, what Stripe is waiting for — is shown to the owner only." },
        ],
      },
      {
        id: "not-integrated",
        heading: "What is not integrated",
        blocks: [
          { bullets: [
            "No card reader or in-person terminal. A client paying you in the driveway pays from the invoice email on their phone, or by cash, e-transfer or cheque recorded by hand.",
            "No tipping, and no lending or capital product. A client pays exactly the invoice.",
            "Disputes are answered in your Stripe dashboard with your evidence, not in FieldQuo; FieldQuo records the $15 fee and the held amount on the invoice. See [[disputes-and-chargebacks|Disputes and chargebacks]].",
            "Stripe's own account fees — a small monthly fee in months you take payments, and 0.25% + 25¢ per payout — are passed through at cost as their own line on your next payment, never hidden in the processing fee.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Is the Stripe account mine or FieldQuo's?", a: "Yours. It is an Express account in your company's name, with its own acct_ id shown on Settings → Payments. FieldQuo holds only the id that points at it." },
      { q: "I already have a Stripe account. Can I use it?", a: "No. Connect with Stripe creates a new Express account for FieldQuo to pay into; an existing standard Stripe account cannot be linked. Both can exist side by side." },
      { q: "Does my client need a Stripe account?", a: "No. They press Pay, type a card or bank details on Stripe's page, and are done. They never see the word Stripe in FieldQuo's emails." },
      { q: "Why does Account & Billing open a different Stripe page?", a: "Because that is Stripe Billing — the card FieldQuo charges you on. Your payout account is under Settings → Payments → Manage in Stripe." },
    ],
  },

  "facebook-and-instagram": {
    title: "Facebook and Instagram (Meta)",
    summary:
      "One Meta login can feed four things — ad spend, lead forms, Page and Instagram messages, and publishing — and only the first works for every company today; the screen says which.",
    updated: "2026-09-12",
    intro: [
      "Everything Meta lives on one screen, **Settings → Meta Ads**, because a contractor thinks “I connected my Facebook” and should not have to learn which of several places holds which half. The screen has four panels, each an independent permission from Meta: the ad account (spend and campaign performance), **Facebook lead forms**, **Facebook & Instagram publishing**, and **WhatsApp Business** (its own article, [[whatsapp|WhatsApp Business]]).",
      "The honest state today: the ad-account connection works, and reads spend only. The other three are built end to end and are **waiting on Meta's approval** of the permission behind them; each panel says so in a sentence and offers no button that would fail. Nothing is missing on your side.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The screen's subtitle is the promise: **Connect your own Meta (Facebook/Instagram) ad account to bring spend and campaign performance into your marketing numbers.** FieldQuo asks Meta for read access to your ad account and nothing more — the not-connected card says it plainly: **FieldQuo only reads spend and performance — it never creates or changes an ad.**" },
          { p: "Once connected, **Sync now** reads your campaigns' daily spend and results into **Marketing → Marketing spend**, where they roll into cost per lead on the KPI dashboard. A row synced from Meta is marked as such, never overwrites a figure you typed by hand, and is flagged as a possible duplicate when it looks like one you already entered." },
          { figure: "live:app-settings-meta-ads", caption: "Settings → Meta Ads — the ad-account connection at the top, then the lead forms, publishing and WhatsApp panels, each stating its own state." },
        ],
      },
      {
        id: "connect-the-ad-account",
        heading: "How to connect the ad account",
        blocks: [
          { steps: [
            "Open **Settings → Meta Ads** and press **Connect Meta Ads**. You leave for Facebook's login and consent screen.",
            "If your login manages more than one ad account, the page asks **Which ad account?** — pick one and press **Connect this account**.",
            "The card now shows the account's name, id and currency with a **Connected** badge. Press **Sync now**. The first sync reads the last 30 days; a sync can cover at most 90 days at a time.",
            "Open **See your campaigns →** to find the rows under Marketing spend.",
          ] },
          { note: "Syncing is manual. There is no nightly Meta sync: press **Sync now** when you want fresh numbers. If your ad account bills in a different currency than your company, the rows are imported as reported and converted only when totals are shown, marked ≈ approximate." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it does"],
            rows: [
              ["**Sync now**", "Reads spend and results per campaign per day from Meta and writes or updates the rows it created earlier. Shows how many were created, updated, errored or look like duplicates."],
              ["**Reconnect**", "Appears when the card reads **Needs reconnecting** — Meta says the stored token no longer works. Same login as connecting; nothing already imported is lost."],
              ["**Disconnect**", "Stops syncing. Rows already imported stay in your marketing spend history."],
              ["Lead form **On / Off**", "Which of your Facebook lead forms become leads in FieldQuo. Disabled today, with the reason on the switch: the permission is not approved yet."],
              ["**Find my lead forms**", "Asks Meta for the forms on your Pages. Disabled for the same reason."],
              ["**Connect Facebook & Instagram** (publishing)", "Not offered today; the panel reads **Waiting on Meta's approval**. When it lands, the same Page connection carries both publishing and Page messaging."],
            ],
          } },
          { p: "When a lead form is switched on, a lead from it lands on the Leads board like any other enquiry — scored the same way, notifying the same people, with your follow-up rules applying — and carries the campaign it came from, which is the one case where a dollar of ad spend is linked to a specific lead. Every other channel is still blended: a homeowner who saw the ad and phoned is not attributed. See [[facebook-lead-forms|Facebook lead forms]] and [[marketing-spend|Marketing spend]]." },
        ],
      },
      {
        id: "messages",
        heading: "Page and Instagram messages",
        blocks: [
          { p: "The **Messages** screen is built to answer your Facebook Page and Instagram business conversations — grouped **Needs a reply** and **Waiting on them**, with a private note, a status and a monthly review of which conversations became jobs. Today it reads **FieldQuo is waiting on Meta's approval for Page messaging. The inbox is built and ready — there's nothing for you to do until that approval lands.** The connection will switch on under Settings → Meta Ads when Meta approves it. See [[connect-your-facebook-page-and-instagram|Connect your Facebook Page and Instagram]]." },
          { warning: "Do not buy FieldQuo for the Facebook inbox this month. The ad-spend sync is the part that works for every company today; the inbox, lead forms and publishing depend on a review that is with Meta, not with you or with FieldQuo." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "What Meta sees, and what FieldQuo stores",
        blocks: [
          { bullets: [
            "FieldQuo stores the access token Meta issues for your ad account, encrypted; the token is what Sync now uses. Disconnect deletes the connection.",
            "No client data is sent to Meta by the ad-account connection — it is a read in one direction.",
            "A funnel is the one client-facing page where a Meta pixel can fire. If you paste a pixel id into a funnel's **Ad tracking pixels** panel, the pixel records a page view and a **Lead** event when a visitor sends the contact form, with no personal details attached. FieldQuo adds no cookie-consent banner anywhere; if your visitors are somewhere that requires one, that is yours to provide. See [[funnels|Funnels]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Settings → Meta Ads is for the **owner and administrators**, the same shelf as Payments: connecting a company's ad account is a company-level act, and every route under it refuses anyone else. The imported spend is then visible wherever Marketing spend is." },
        ],
      },
    ],
    faq: [
      { q: "Can FieldQuo create or pause my ads?", a: "No, and it does not ask Meta for the permission to. It reads spend and performance only." },
      { q: "Why are my lead forms listed but greyed out?", a: "Receiving a lead needs one more permission that Meta has not approved for FieldQuo yet. The switches are disabled with that reason on them rather than hidden, so you can see that no lead is arriving and that it is not your fault." },
      { q: "I disconnected — is my spend history gone?", a: "No. Rows already imported stay in Marketing spend; only future syncing stops." },
    ],
  },

  "whatsapp": {
    title: "WhatsApp Business",
    summary:
      "Your own WhatsApp Business number answered in the Messages inbox, the 24-hour rule WhatsApp imposes on replies, and why the Connect button is not offered yet.",
    updated: "2026-09-12",
    intro: [
      "The **WhatsApp Business** panel on **Settings → Meta Ads** connects the WhatsApp Business number your clients write to, so their messages arrive in **Messages** beside your Facebook and Instagram conversations and are answered from there. It is a business number, not anyone's personal WhatsApp.",
      "Today the panel reads **Waiting on Meta's approval**: answering WhatsApp messages needs a permission Meta has to grant FieldQuo before any number can be connected. That review is with Meta. Nothing is missing on your side, and this article says what the feature does the day it switches on — including the one rule that surprises everybody.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "When the connection is offered, **Connect WhatsApp** sends you through Meta's own sign-up, where you choose or create a WhatsApp Business Account and a phone number; FieldQuo subscribes to that number's messages, and a conversation appears in Messages the moment a client writes. Replies go out from your number. The panel then shows the number with its verified name, the templates read from Meta, and a **Disconnect** button." },
          { p: "A second, collapsed door exists for a business that already uses Meta's Cloud API: paste the WhatsApp Business Account id, the phone number id and a permanent token, and FieldQuo proves the token against Meta before storing anything. The token is stored encrypted and is never shown again. For almost every company the sign-up button is the right door." },
          { figure: "live:app-settings-meta-ads", caption: "Settings → Meta Ads — the WhatsApp Business panel sits at the bottom and states whether a number can be connected yet." },
        ],
      },
      {
        id: "the-24-hour-rule",
        heading: "The 24-hour rule",
        blocks: [
          { p: "The panel carries this in a card of its own, because it is the thing a painter who has used WhatsApp personally for ten years has never met: **WhatsApp only carries a typed message for 24 hours after the customer last wrote to you. After that you can still reach them, but only with a template Meta approved in advance.** FieldQuo says which of the two applies on every conversation, and refuses a free-typed message outside the window by name rather than letting WhatsApp reject it silently." },
          { steps: [
            "Create your templates in Meta's WhatsApp Manager — a “your quote is ready” or “confirming tomorrow's visit”, for example — and wait for Meta to approve them.",
            "On the panel, press **Refresh templates**. It reads **{count} templates read from Meta**, or **No templates yet. Create them in Meta's WhatsApp Manager, then refresh.**",
            "In a conversation older than 24 hours, the composer offers those templates instead of a text box.",
          ] },
          { note: "The AI employee follows the same rule: outside the window it does not draft a reply at all, because there is no free text it could send." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { bullets: [
            "**Connect WhatsApp** — starts Meta's sign-up. If you cancel part-way, nothing is connected; if the account has no phone number yet, the panel says so and asks you to add one with Meta.",
            "**Refresh templates** — re-reads your approved templates from Meta. New templates do not appear until you press it.",
            "**Disconnect** — removes the number from FieldQuo and deletes the stored token. Conversations already in Messages stay.",
            "The panel's badge — **Connected via Meta sign-up** or **Connected via API credentials** — records which door was used.",
          ] },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "What leaves the building",
        blocks: [
          { p: "Your client's messages come from Meta to FieldQuo and are stored as conversations; your replies go from FieldQuo to Meta and on to the client. Meta holds the number and the templates, so a template's wording is what Meta approved, not what FieldQuo would like to send. Media a client sends is fetched from Meta and kept with the conversation." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Connecting or disconnecting a number is for the **owner and administrators** — the same rule as the rest of Settings → Meta Ads, enforced by the routes as well as by the sidebar. Answering conversations follows the Messages inbox's own access; see [[the-messages-inbox|The Messages inbox]]." },
        ],
      },
    ],
    faq: [
      { q: "Can I use my personal WhatsApp?", a: "No. The connection is to a WhatsApp Business Account and its number, through Meta. A personal number has no such account." },
      { q: "Why can't I reply to a message from last week?", a: "WhatsApp's rule, not FieldQuo's: more than 24 hours after the client last wrote, only a template Meta approved in advance can be sent. Create templates in WhatsApp Manager and press Refresh templates." },
      { q: "When will the Connect button appear?", a: "When Meta approves the permission for FieldQuo. The panel will change on its own; there is nothing to request from your side." },
    ],
  },

  "phone-and-texts": {
    title: "Phone numbers and texts (Twilio)",
    summary:
      "The three phone things FieldQuo does — texts to clients, the AI receptionist's number, and the crew texting line — which number each uses, what each costs, and what is deliberately not a text.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo touches the phone network in three separate places, and they use three different numbers. **Texts to clients** — the On my way text and appointment reminders — go out from FieldQuo's shared texting number with your company name at the start. The **phone receptionist** answers on a number you rent under **Settings → Phone receptionist**. **Crew texting** uses a third number, set up on the **Crew inbox** page, that your crew text photos to.",
      "Twilio carries the texts and supplies the numbers; Retell runs the receptionist's voice. This article says what each of the three does, what leaves the building, what comes out of your phone credit, and what FieldQuo deliberately does not text.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { table: {
            head: ["What", "From which number", "What it costs you"],
            rows: [
              ["On my way text, appointment reminder", "FieldQuo's shared texting number, with your company name first", "Nothing — client texts are not metered"],
              ["Phone receptionist", "A local or toll-free number you rent, or your own number forwarded to it", "$4/month local, $9/month toll-free, plus 35¢ a minute (40¢ toll-free), from phone credit"],
              ["Crew texting line", "A number of its own, bought for the company, or FieldQuo's shared test line on loan for 7 days", "$4/month for your own line, 2¢ a text and 5¢ a photo, from the same credit"],
            ],
          } },
          { p: "Phone credit is one prepaid balance, shown on **Settings → AI credit** as **Phone credit** and on the receptionist page as **Credit**. Top up in $10, $30, $50 or $100 — or any amount from $5 to $1,000 — with a card, or turn on **Automatic top-up** to charge the card on file when the balance drops below $5, $10 or $20. See [[ai-credit-and-phone-credit|AI credit and phone credit]]." },
        ],
      },
      {
        id: "texts-to-clients",
        heading: "Texts to clients",
        blocks: [
          { p: "Exactly two texts go to clients, and both are yours to word under **Settings → Client messages**: **On my way**, sent when a visit is marked on the way, and **Appointment reminder**, sent 2, 24 or 48 hours before a visit once you choose a lead time under Settings → Notifications. Each is sent in the client's language. The reminder ends with **Reply STOP to opt out**; a client who replies STOP is never texted again by your company, and START lifts it." },
          { warning: "These texts come from FieldQuo's shared number, not from a number of your own — the receptionist's number cannot text, and there is no setting today to give client texts a company number. The message starts with your company name, but the number the client sees is shared. This is the one client-facing surface where FieldQuo's plumbing shows; see [[client-texts-on-my-way-and-reminders|Client texts: On my way and reminders]]." },
          { p: "There is no client texting inbox. A homeowner who replies to a reminder with a question is not read — the text points them to your phone number instead. FieldQuo does not text invoices, quotes, review requests or booking confirmations; those are emails. See [[texting-clients-what-is-and-is-not-automated|Texting clients: what is and is not automated]]." },
        ],
      },
      {
        id: "the-receptionists-number",
        heading: "The receptionist's number",
        blocks: [
          { figure: "live:app-settings-voice", caption: "Settings → Phone receptionist — the number with It's answering — turn off, the Credit card with top-ups, then Your number and the greeting, knowledge and voice cards." },
          { steps: [
            "Open **Settings → Phone receptionist** and find **Your number**. Pick a local number by area code from the ones Twilio has free, or a toll-free one, or keep your own number and forward it — the recommended way, because the number on your van stays the same.",
            "The first month's rental comes out of your credit as soon as you pick one. Your first number also adds **$10.50** of credit — 30 free minutes — to start with.",
            "Press **Start answering calls**. From then on the receptionist answers in the caller's language (English, French or Spanish), takes the details, books a visit against your real availability, and never quotes a price. Each call lands on the **Receptionist** screen with its recording, transcript and summary.",
            "To stop, press **It's answering — turn off**: the number stops answering but stays yours and keeps being rented. To give the number up, use **Release** and type the number to confirm — that is irreversible and the rest of the month is not refunded.",
          ] },
          { note: "Rent is taken every 30 days from credit. If credit runs out, the number keeps working for 7 days while FieldQuo emails you, then is released and lost. Automatic top-up is the safeguard. Porting a number in is a request FieldQuo handles by hand, not a button; nothing is charged until the port is live." },
        ],
      },
      {
        id: "crew-texting",
        heading: "The crew texting line",
        blocks: [
          { p: "Your crew text photos to one number and they are filed to the right job — by the job named in the text, by GPS when the phone sends it, or by the only job that person is on that day; when none of those decide it, the office picks the job under **Needs you — pick the job**. The person is recognised by the mobile on their worker record. Set-up is on the **Crew inbox** page, not under the receptionist: **Buy your crew a number of their own** at $4 a month, or **Use the FieldQuo test line** for 7 days first." },
          { p: "Every text in or out costs **2¢** per 160 characters and a photo **5¢**, from the same phone credit. An incoming photo is always received and charged; if credit is $2 overdrawn the line is disconnected and the page reads **Crew texting is paused because your credit ran out. Top up and it reconnects.** See [[the-crew-inbox|The crew inbox]]." },
          { note: "The shared test line is the same number client texts leave from. While it is on loan to your crew, a client's STOP reply to it lands in the crew inbox and is not read as an opt-out — one more reason to buy the crew their own number." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "What leaves the building",
        blocks: [
          { bullets: [
            "Twilio receives a client's phone number and the text of a reminder or On my way message, and the crew's texted photos before FieldQuo re-hosts them.",
            "Retell receives the live audio, the recording and the transcript of every call the receptionist takes. The recording is played back from the Receptionist screen.",
            "A number you rent for the receptionist is bought on Retell's Twilio account; a crew line is bought on FieldQuo's. Neither is a number you can take with you when you leave, which is why forwarding your own number is the recommended choice.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "**Settings → Phone receptionist** and its number, credit and top-up controls are for the owner, administrators and the Manager and Dispatcher levels. The **Receptionist** call log needs full view of clients in the access grid. The **Crew inbox** row shows for everyone, but a Crew or Estimator login sees only the photos they sent themselves, and setting up, buying or turning off the crew line is for the owner, administrators and a Manager with job costing — it spends the company's credit." },
        ],
      },
    ],
    faq: [
      { q: "Can my clients text me back?", a: "Not into FieldQuo. Replies to the shared number are read only for STOP and START; anything else is acknowledged and dropped, and the On my way text gives the client your phone number to call." },
      { q: "Do reminders cost credit?", a: "No. On my way texts and appointment reminders are free; credit pays for the receptionist's minutes and rental and for crew texting." },
      { q: "Can I get a number for texting clients under my own name?", a: "Not today. Client texts leave from FieldQuo's shared number with your company name at the start; the receptionist's number answers calls but cannot text." },
    ],
  },

  "google-maps-and-solar": {
    title: "Google Maps and Google Solar",
    summary:
      "Where an address is autocompleted, how a roof is measured from the sky, what travel time is based on, and the one thing to know — homeowner addresses are sent to Google to do it.",
    updated: "2026-09-12",
    intro: [
      "Google is behind three ordinary things in FieldQuo: the address that completes itself as you type, the roof area and pitch that appear when you press **Measure from satellite**, and the driving time that shapes booking slots. Each one sends a homeowner's address, or the coordinates behind it, to Google. That is the whole cost — there is no credit metered and no add-on to buy — and it is worth saying plainly.",
      "This article says where each of the three is used, what the roof measurement returns and when it cannot, and what FieldQuo does not use Google for.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { bullets: [
            "**Address autocomplete** — on a new or edited client, in the quote builder's client picker, on Company Settings, when adding an employee, on the public booking page, the self-quote form and the instant-estimate page. A typed address that never picks a suggestion is accepted as is.",
            "**Geocoding** — when a job's site address is set, FieldQuo asks Google for its coordinates once and keeps them. Those coordinates are what the time clock compares a punch against (within 250 m reads as on site) and what the small map on Company Settings and the website's contact block show.",
            "**Google Solar** — the roof model behind **Measure from satellite** on a roofing quote, and behind the roofing instant estimate on your website.",
            "**Driving time** — Google's distance matrix between two addresses, used to keep booking slots and visits apart by real travel. When Google has no answer, FieldQuo estimates from the straight-line distance and labels it an estimate.",
          ] },
        ],
      },
      {
        id: "measure-a-roof",
        heading: "How to measure a roof from an address",
        blocks: [
          { steps: [
            "In the quote builder, on a **roofing** quote type, open the takeoff and press **Measure from satellite** — or **Use the client's address** to measure the address already on the quote.",
            "FieldQuo geocodes the address, asks Google Solar for the nearest building's roof model, and fills in the roof area in square feet and squares, the predominant pitch as rise over 12 with its steepness tier, the number of roof faces, and eave, rake, ridge, hip and valley lengths. A satellite still shows what was measured.",
            "Check the still against the house. When the pin landed on a neighbour, or the imagery is old, the panel says so; the numbers stay editable and you can type the area and pitch by hand.",
          ] },
          { note: "Two refusals are normal and both say what to do: **We couldn't find that address. Enter the roof area by hand.** and **Google has no roof model for this building. Enter the area and pitch by hand.** Coverage is Google's, not FieldQuo's — rural and newly built houses are the usual gaps. On the public instant estimate a homeowner sees a softer sentence and is invited to request a quote instead." },
          { p: "The roof area is Google's sloped surface area, so no pitch multiplier is applied on top — applying one would count the slope twice. Full detail in [[aerial-roof-measurement|Aerial roof measurement]]." },
        ],
      },
      {
        id: "tracing-by-hand",
        heading: "Tracing by hand",
        blocks: [
          { p: "Two surfaces are traced rather than modelled. On a **paving** quote the designer shows a satellite photo of the address and you trace the driveway or patio and set the scale from a line you know the length of. On the **lawn-care** instant estimate a homeowner draws their lawn on a Google map and the server recomputes the area. There is no manual roof trace: when Solar has no model, the roof is typed in." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "What leaves the building",
        blocks: [
          { p: "The address as it is typed, for autocomplete and geocoding; the coordinates of a job, for the roof model, the map image and the driving-time question. That is what FieldQuo's own privacy page lists for Google Maps and Google Solar, and nothing more — no client name, no phone number, no quote. A visitor's browser also talks to Google directly on the booking page and the instant-estimate page, because the autocomplete runs in the browser." },
        ],
      },
      {
        id: "not-integrated",
        heading: "What is not integrated",
        blocks: [
          { bullets: [
            "No turn-by-turn directions and no route optimisation. FieldQuo places visits and checks travel between them; it does not plan a day's route.",
            "No live map of the crew. The time clock takes one location fix when a person taps clock in or out, and nothing in between.",
            "No address suggestions on the job creation form or the website lead form — those take a typed address.",
            "No cost to you and no metering. Roof measuring is included in every plan.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can use it",
        blocks: [
          { p: "Anyone signed in can measure a roof or a driveway — the routes ask only for a session, and the quote builder is where it lives, so in practice it is whoever writes quotes: the owner, administrators, Managers, Dispatchers and Estimators. Homeowners use it without an account on the roofing and lawn instant estimates you publish." },
        ],
      },
    ],
    faq: [
      { q: "Why did the measurement land on the wrong house?", a: "The pin is where Google geocoded the address, and Solar returns the nearest building. The panel says how far the pin was from the building it measured; check the still, and type the area by hand when it is the neighbour." },
      { q: "Does measuring cost credit?", a: "No. Nothing about Google Maps or Solar is metered against your credit." },
      { q: "Does the crew's location go to Google?", a: "No. A clock-in punch is compared with the job's stored coordinates on FieldQuo's side; only the job's address was geocoded, once, when the job was created." },
    ],
  },

  "photos-and-files": {
    title: "Photos and files (Cloudinary)",
    summary:
      "Where every photo and document you upload is stored, the size and type limits, which photos can reach your website and quotes, and the honest answer on deleting.",
    updated: "2026-09-12",
    intro: [
      "Every photo, video and PDF that enters FieldQuo — a job photo, your logo, a homeowner's photos on a quote request, a permit on a job, a receipt — is stored with Cloudinary, in a folder that belongs to your company. Uploads are signed by FieldQuo's server for each file, so there is no public upload token anyone could reuse, and a client uploading to your self-quote form goes through the same door into a **leads** folder of your own.",
      "This article is the limits, the places photos are shown, the fixed stages that decide what can go public, and what FieldQuo does not do with files.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { table: {
            head: ["Kind", "Accepted", "Limit"],
            rows: [
              ["Photo", "JPEG, PNG, WebP, GIF, HEIC and HEIF — an iPhone photo goes up as is", "15 MB"],
              ["Video", "MP4, MOV, WebM, Ogg and 3GP", "100 MB"],
              ["Document", "PDF only", "25 MB"],
              ["Logo", "The photo types plus SVG", "15 MB"],
            ],
          } },
          { p: "A refused file gets a sentence, not a spinner: **Upload a photo (JPEG, PNG, HEIC…), a video (MP4, MOV, WebM) or a PDF.** or **That photo is larger than 15 MB. Try a smaller photo.** A PDF is stored byte for byte with a random name; the filename you uploaded is never part of the address." },
        ],
      },
      {
        id: "where-photos-live",
        heading: "Where photos and files live",
        blocks: [
          { bullets: [
            "**Job photos** — on the job page under **Job photos**, uploaded there or texted in by the crew, filed under one of four fixed stages: **Before / start**, **In progress**, **Finished**, **Issue / snag**. Your own tags from **Settings → Job photo tags** sit on top. See [[job-photos-and-tags|Job photos and tags]].",
            "**Photos from the client** — what a homeowner attached to a self-quote or instant-estimate request, or what you added in the quote builder with **Add photos or a video**. Shown to your staff on the quote, the lead and the invoice; not printed on the quote PDF and not shown on the client's approval page.",
            "**Before & after pairs** on **Settings → Quote Email** — up to 4 pairs that go into every quote email.",
            "**Your website** — the header, about, call-to-action and service images, the gallery, and job photos you star to show on the site.",
            "**Documents** — plans, permits and contracts on a job, insurance and clearance on a subcontractor, registration and insurance on a vehicle, and receipts scanned into an expense (photos only — a PDF receipt is refused).",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Settings → Job photo tags — your own words layered on the four fixed stages, with starter tags and a Retire button." },
        ],
      },
      {
        id: "what-goes-public",
        heading: "What can go public",
        blocks: [
          { p: "The stages are fixed because they are the rule. Only a job photo you have starred as featured reaches your website, and an **Issue / snag** photo can never be featured — the server refuses with **An issue photo can't be featured on your website. Change its stage first.** The Marketing Designer's job-photo tab and the make-a-post-from-a-job flow never see an issue photo either. Everything else stays inside the back office." },
          { steps: [
            "Open the job and its **Job photos**.",
            "Set the stage on each photo — the crew's text is read for words like “before” and “done” to guess it, and you can correct it.",
            "Star the ones to show on your website. They appear in the site's work gallery; unstar to remove them.",
          ] },
        ],
      },
      {
        id: "deleting",
        heading: "Deleting",
        blocks: [
          { warning: "There is no delete button on a job photo, a job document or a client's photos, and FieldQuo does not remove files from storage when a job is deleted or a website photo is taken out of the library. Replacing your logo removes the old one; that is the exception. If a photo must not exist — a homeowner asks, or it was taken in error — change its stage to Issue / snag so it can never go public, then send a deletion request; see [[data-and-privacy|Your data, your clients' data, and deletion]]. Photo location data inside an image (EXIF) is neither read nor stripped." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Anyone signed in can upload. Filing a photo on a job needs only view access to that job, so a Crew login can add photos to the jobs it is on. Setting the stage, starring for the website, captions and tags need edit access to jobs. Job photo tags are managed by the owner, administrators and the Manager and Dispatcher levels. Website photos are the owner's and administrators'; the logo is anyone who can manage people." },
        ],
      },
    ],
    faq: [
      { q: "Can I attach a file to a client?", a: "No. Files attach to a job, a quote, a subcontractor, a vehicle or an expense — not to the client record itself." },
      { q: "Do HEIC photos from an iPhone work?", a: "Yes. HEIC and HEIF are accepted and converted for display; MOV videos too." },
      { q: "Is there a storage limit?", a: "FieldQuo shows no quota and sets no per-company cap; the limits are per file. If storage ever refuses a file, the message says so rather than failing quietly." },
    ],
  },

  "email-delivery": {
    title: "Email delivery (Resend) and your own domain",
    summary:
      "Who your quotes and invoices appear to come from, how to send them from your own domain instead of FieldQuo's shared address, where replies land, and what FieldQuo cannot tell you about a bounce.",
    updated: "2026-09-12",
    intro: [
      "Every quote, invoice, receipt, reminder and review request goes out under **your company's name** as the sender. Until you connect a domain, the address behind that name is FieldQuo's shared sending address; after you verify one on **Settings → Email Domain**, the address is yours — **quotes@send.yourcompany.com**, for example — and no “via fieldquo.com” appears beside your name in the client's inbox.",
      "The delivery itself is done by Resend, an email service the client never sees. This article is the sender, the domain, the replies, and the honest limits: FieldQuo learns nothing about a message after Resend accepts it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The From line is built the same way for every client email: your company name, then an address. With no domain of your own, the address is on FieldQuo's shared sending domain and the name is still yours. With a verified domain, the address is the **Sender address** you chose, at your domain. Replies always go to your company email from Company Settings — or, if that is empty, to the account owner's login email — never to the shared address." },
          { p: "Client emails are also sent in the client's language, and a quote's covering email in the quote's language; see [[a-clients-language|A client's language]]." },
          { figure: "live:app-settings-email-domain", caption: "Settings → Email Domain — the domain with its status, the DNS records to add, the Sender address editor and where replies go." },
        ],
      },
      {
        id: "connect-a-domain",
        heading: "How to send from your own domain",
        blocks: [
          { steps: [
            "Open **Settings → Email Domain**. Under **Connect a domain**, type a subdomain such as **send.yourcompany.com** — a subdomain rather than your root domain, so it cannot interfere with your existing mailbox — and press **Connect**.",
            "The page shows **Add these DNS records**: the type, name and value of each, with **Copy value** beside it. Add them at whoever hosts your domain's DNS, keeping the name exactly as shown.",
            "Save at your host and leave it. Most hosts apply changes within an hour, some take up to 24. The page rechecks every 30 seconds by itself while the status reads **Waiting on DNS**; **Check verification** asks straight away.",
            "When the status reads **Verified**, the card says **Emails will send from quotes@send.yourcompany.com**. Change the part before the @ under **Sender address** and press **Save** — letters, numbers, dots, dashes or underscores. It does not need to be a real mailbox.",
          ] },
          { note: "The records prove you own the domain, which is what lets FieldQuo send as you. Nothing sends from your domain until it is verified; until then the status card reads **Your emails currently send from FieldQuo's shared address, using your company name.** A domain ending in fieldquo.com is refused, and a domain already connected to another company on FieldQuo is refused with a sentence saying so." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it changes"],
            rows: [
              ["**Connect**", "Registers the domain for sending and shows the DNS records. Replaces any domain connected before."],
              ["**Check verification**", "Asks whether the DNS records are in place now. The status becomes Verified, Waiting on DNS or Verification failed."],
              ["**Sender address → Save**", "The part before the @ on every client email once verified. Default: quotes."],
              ["**Disconnect**", "Removes the domain. Emails go back to FieldQuo's shared address, still under your company name. Nothing already sent changes."],
              ["**Replies**", "Not a control — it shows where a reply lands: your company email, or the owner's email when none is set. Change it under Company Settings."],
            ],
          } },
        ],
      },
      {
        id: "which-emails",
        heading: "Which emails use it",
        blocks: [
          { p: "Everything a **client** receives: quotes, invoices and payment requests, deposit and instalment emails, service-plan invoices, follow-ups and reminders, review requests, booking confirmations and changes, self-quote and instant-estimate confirmations, and marketing campaigns. Marketing campaigns, review requests and job-completed follow-ups also carry a one-click unsubscribe link; transactional emails such as a quote or an invoice deliberately do not." },
          { p: "Emails FieldQuo sends to **you** — team invitations, password resets, billing notices, phone-credit warnings, the monthly digest — come from FieldQuo's own addresses whatever domain you connect, because they are from FieldQuo." },
        ],
      },
      {
        id: "limits",
        heading: "What FieldQuo cannot tell you",
        blocks: [
          { bullets: [
            "**Bounces.** Once Resend accepts a message, FieldQuo hears nothing further. There is no bounce report and no “bad address” flag on a client. What it does check is the address itself before sending, and it tells you at once when Resend refuses a send.",
            "**Replies.** A client's reply goes to your mailbox, by the Reply-To address. It does not appear inside FieldQuo.",
            "**Opens and clicks.** Not tracked.",
            "**Sending limits.** FieldQuo sets none of its own; a “rate-limiting” message on a send is Resend's, and clears in a moment.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Settings → Email Domain is for the **owner, administrators and the Manager and Dispatcher levels** — anyone who can manage people. Crew and Estimator logins do not see the row, and the route refuses them. Every plan includes it; there is no add-on for your own domain." },
        ],
      },
    ],
    faq: [
      { q: "Do I need my own domain?", a: "No. Without one, emails go out under your company name from FieldQuo's shared address, and replies still reach your own mailbox. A verified domain removes the “via” hint some inboxes show and improves deliverability." },
      { q: "Which DNS records do I add?", a: "Exactly the ones the page lists for your domain — copy each value with the button. The page does not invent a generic list; the records are read from the sending service for your domain." },
      { q: "Where do my clients' replies go?", a: "To the company email on Company Settings. If it is blank, to the account owner's login email, and the page says so in amber until you set one." },
    ],
  },

  "quickbooks-xero-and-your-bookkeeper": {
    title: "QuickBooks, Xero and your bookkeeper",
    summary:
      "There is no live sync with QuickBooks or Xero. What exists is a bookkeeping export — four CSV files for a date range — and this article says exactly what is in it and what is not.",
    updated: "2026-09-12",
    intro: [
      "“Do you work with QuickBooks?” The honest answer is: your numbers can leave FieldQuo as clean files your accountant imports, and nothing is synced live. The **Bookkeeping export** on **Expenses** produces a ZIP of four CSV files for any date range — a summary sheet, invoices, payments and expenses — and every accountant on earth imports a CSV.",
      "This article is that export: how to run it, what each file carries, how the processing fees and refunds appear, and the seven things it does not contain, which are printed in front of the button and again inside the ZIP so they travel with the numbers.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A two-way sync with QuickBooks Online or Xero is not built. FieldQuo's own comparison pages concede it: the strings quickbooks, zapier and xero appear in no integration code. QuickBooks Desktop is refused outright, because it needs a Windows connector. What is built is the export, and it is the same one the fees article and the receivables pages describe." },
          { p: "The card sits at the bottom of **Expenses** (the same screen as **Settings → Expense Tracking**): **Bookkeeping export — A date range of invoices, payments and expenses as four CSV files in one ZIP — a summary sheet plus one file each — for handing to an accountant or importing into their software.** Amounts are in your company's billing currency from Company Settings; without one the export refuses rather than guessing." },
          { figure: "live:app-settings-expense-tracking", caption: "Expense Tracking — the month's cards and the Bookkeeping export card at the bottom, with From, To and Download the range." },
        ],
      },
      {
        id: "how-to-run-it",
        heading: "How to run it",
        blocks: [
          { steps: [
            "Open **Expenses** and scroll to **Bookkeeping export**. The range defaults to last month.",
            "Set **From** and **To**, then read **What this file does not contain** underneath — that list is the one your bookkeeper needs before they import.",
            "Press **Download the range**. The ZIP is named bookkeeping-… and holds summary, invoices, payments and expenses CSVs.",
            "Hand the ZIP to your bookkeeper, or import each file into QuickBooks Online or Xero with their CSV import, mapping the columns once.",
          ] },
        ],
      },
      {
        id: "what-each-file-carries",
        heading: "What each file carries",
        blocks: [
          { table: {
            head: ["File", "One line per", "Money columns"],
            rows: [
              ["summary", "the export — company, range, then one row per currency", "Invoiced, of which tax, Payments received, Refunds, Processing fees, Stripe account fees, Expenses"],
              ["invoices", "invoice — the latest version of an amended invoice, dated from the original", "Subtotal, Discount, Tax, whether tax was enabled, Total, Paid, Received in range, Due"],
              ["payments", "payment — on the payment's own date, not the invoice's", "Amount (gross), Processing fee, Net deposited, Fee rate, Stripe account fees"],
              ["expenses", "expense", "Amount, with Category, Overhead yes/no, Recurring, Frequency and Job"],
            ],
          } },
          { p: "Post the gross to income and the processing fee to a merchant-fees expense from the same payment line; the bank feed then matches **Net deposited**. A refund issued from FieldQuo is its own negative line in the payments file, with method refund and the reason in Notes, and is totalled under Refunds in the summary. A refund made directly in Stripe shows on the original payment's refunded amount, not as a line." },
          { p: "Every text cell a person typed — a client name, a category, a note — is guarded so it cannot run as a formula when the file is opened in Excel or Sheets." },
        ],
      },
      {
        id: "what-it-does-not-contain",
        heading: "What it does not contain",
        blocks: [
          { bullets: [
            "It is an export, not a filing. Nothing in it has been remitted to any tax authority.",
            "It cannot produce a sales-tax return. Invoice tax is one amount per invoice, with no tax codes and no per-line tax — a Quebec invoice with GST and QST has two rates and one number.",
            "Expenses carry no tax and no supplier, so input tax credits and recoverable VAT are not in it.",
            "Credit notes do not exist. Refunds appear as their own negative lines.",
            "There is no chart of accounts. Nothing is mapped to a GL account — your bookkeeper does that once, on import.",
            "Fee columns are filled only for online payments taken after fees began to be recorded on the payment (September 2026); older card payments and every manual payment leave them blank rather than writing 0.00.",
            "Days are grouped in UTC, and there is no invoice issue-date field — every invoice states which column its date came from.",
          ] },
          { warning: "Tell your bookkeeper it is a clean set of records, not a general ledger and not a QuickBooks sync. A bookkeeper who imports it expecting a ledger and finds it is not one blames the software; the list above is printed in front of the button to stop that." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The Expenses screen itself needs access to **everyone's** expenses in the access grid — the owner, administrators and the Manager level; an Estimator or Dispatcher records their own receipts but does not see the company roll-up. On that screen the card appears only for a person whose access also has **See prices** on and invoices at **view only** or better. The route asks the same questions of the same grid, so a person without them gets no card rather than a card that fails." },
        ],
      },
    ],
    faq: [
      { q: "Will there be a QuickBooks sync?", a: "Not today, and FieldQuo does not list it on its comparison pages. The export is the door that exists; a live sync would be an Intuit-approved app with its own security review, which is why it is not a quick addition." },
      { q: "Can my accountant log in instead?", a: "Yes — invite them from Manage Team. Make administrator if they must see billing; otherwise a Manager level sees invoices, payments and expenses and can run the export." },
      { q: "Why are the fee columns blank on some payments?", a: "A manual payment carries no fee, and an online payment taken before fees were recorded on the payment has no known fee. A blank says “no fee is known”; a 0.00 would say “no fee”, which is a different statement." },
    ],
  },

  "stock-photos-on-your-website": {
    title: "Stock photos on your website (Unsplash)",
    summary:
      "Why a new website starts with stock photos in its decorative slots, which slots never get one, how to replace them, and what a visitor's browser sends to Unsplash.",
    updated: "2026-09-12",
    intro: [
      "A website written from your data on day one has no photos of your work yet, so the builder fills the **decorative** slots — the header background, the about image, the call-to-action background and up to four service images — with stock photos chosen for your trade. It never puts a stock photo in **Our work**, the gallery or a before-and-after pair, because those sections say the photos are jobs you did, and a stock photo there would be a false statement to a homeowner.",
      "The photos are loaded from Unsplash's own servers, not copied. That is the one privacy fact in this article, and the reason to replace them: your own work always sells better than a stock house.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The builder keeps a small set of photos per trade — roofing, exterior, painting, kitchen, flooring, landscaping, concrete, plumbing, electrical, cleaning and a general set — each one looked at by a person before it was pinned. A slot that already holds an image of yours is never overwritten, and a slot gets a placeholder only while it is empty. Nothing in the text of your site is stock: every sentence is written from what you told FieldQuo." },
          { figure: "live:app-settings-website", caption: "Settings → Your website — the builder with its brief, Layout and Style pickers, and the preview where placeholders appear in the decorative slots." },
        ],
      },
      {
        id: "replace-them",
        heading: "How to replace them",
        blocks: [
          { steps: [
            "Open **Settings → Your website** and press **Add my photos** to upload your own; they go into your photo library and the gallery.",
            "In **Fine-tune**, open the header, about or call-to-action section and use **Add photo** on its image — or **Remove image** to leave the slot empty with no stock photo.",
            "Star photos on a finished job to show them on the site; see [[photos-and-files|Photos and files]].",
            "Press **Publish**. If any stock photo is still in place, a dialog says **{count} stock photos still on your site** and explains where they are, with **Add my photos** right there. You can publish anyway and swap them later.",
          ] },
          { note: "Regenerating the site keeps the header and about images, the gallery and the before-and-after pairs you set — that is the fix for an earlier version that destroyed uploaded photos on regenerate. It does not keep a hand-set call-to-action or service image; those two slots are rebuilt, so set them last." },
        ],
      },
      {
        id: "what-a-visitor-sends",
        heading: "What a visitor's browser sends to Unsplash",
        blocks: [
          { p: "FieldQuo sends nothing about anyone to Unsplash. But because a placeholder is a link to images.unsplash.com rather than a copy, a homeowner opening your site fetches that picture from Unsplash directly, and Unsplash's servers see their IP address and browser — the same as any hotlinked image on the web. Once you replace a placeholder with your own photo, that request stops; your photos are served from your own storage. No attribution is printed on the site; the licence does not require one." },
        ],
      },
      {
        id: "elsewhere",
        heading: "Where else stock photos appear",
        blocks: [
          { p: "The **Marketing Designer** has a stock tab that shows Unsplash photos with the photographer's name on hover; when you publish a design, the whole canvas is rendered to one image and stored with your files, so the posted ad is not a hotlink. Stock photos are not used in funnels, on the bio link, in PDFs or in quote emails." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can change it",
        blocks: [
          { p: "The website builder — including uploading and removing photos — is for the **owner and administrators**. Everyone with a link sees the published site." },
        ],
      },
    ],
    faq: [
      { q: "Can I turn placeholders off entirely?", a: "Remove the image from a section and the slot stays empty; a placeholder is only put where a slot is empty at generation. Fill the slots with your own photos and no stock photo remains." },
      { q: "Will my clients know they are stock?", a: "They appear only in the decorative slots, never presented as your work. The publish dialog counts what is left so you decide knowingly." },
    ],
  },

  "data-and-privacy": {
    title: "Your data, your clients' data, and deletion",
    summary:
      "Who controls what, which outside services see which data, what the AI is and is not given, what you can export, and the plain fact that nothing is deleted on a schedule — including your account.",
    updated: "2026-09-12",
    intro: [
      "Two kinds of data live in your FieldQuo account. Your **company's** data — your staff accounts, your plan, your card — is FieldQuo's to look after. Your **clients'** data — their names, addresses, quotes, photos, calls — is yours: you are the data controller and FieldQuo is your processor, which is why a homeowner who wants their data changed or removed is asked to come to you first.",
      "This article is the honest state of that, read from the code and from FieldQuo's own privacy page: which outside services receive what, what the AI is given, what you can take out, and what deletion means today — a request handled by a person, not a button.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { bullets: [
            "**Where it lives.** One Postgres database hosted by Neon, the product hosted on Vercel, photos and documents stored with Cloudinary, in a folder per company. Encryption in transit everywhere, and at rest through those providers. FieldQuo makes no claim about which country data is stored in, because nothing in the product pins one.",
            "**Who at FieldQuo can see it.** Support looks at a customer's account through a read-only, logged, 30-minute session that can view everything and change nothing. The one exception is the paid migration service, which creates new records you asked for and never edits existing ones; see [[the-data-migration-service|The data migration service]].",
            "**Never sold, never shared between companies.** FieldQuo AI answers about your data only, and the anonymised pricing benchmark is opt-in, pooled from other opted-in companies, published only once at least five quotes stand behind a figure, and never shows one company's prices.",
          ] },
        ],
      },
      {
        id: "who-else-sees-it",
        heading: "Which services see which data",
        blocks: [
          { p: "FieldQuo's privacy page lists every outside service the product is wired to, and the build fails if the list stops matching the code. This is that list, in the words that matter to a contractor." },
          { table: {
            head: ["Service", "What it receives"],
            rows: [
              ["Stripe", "A client's card or bank details when they pay you — typed on Stripe's page, never stored by FieldQuo — and, separately, your own card for your subscription. See [[stripe|Stripe]]."],
              ["Resend", "Every email sent on your behalf: the recipient and its full content. See [[email-delivery|Email delivery]]."],
              ["Twilio and Retell", "A client's phone number and the text of a reminder; for the receptionist, the live audio, recording and transcript of each call. See [[phone-and-texts|Phone numbers and texts]]."],
              ["Cloudinary", "Every photo and document uploaded, including a homeowner's photos on a quote request. See [[photos-and-files|Photos and files]]."],
              ["OpenAI", "Property photos for a quote review, call transcripts for a draft or the monthly digest, and — for FieldQuo AI — a client's name only, never their contact details, address or financial history."],
              ["Google Maps and Solar", "An address as typed, and a job's coordinates. See [[google-maps-and-solar|Google Maps and Google Solar]]."],
              ["Meta", "Your ad account's access token, and in return your own spend and campaign figures. No client data goes to Meta. See [[facebook-and-instagram|Facebook and Instagram]]."],
              ["Unsplash", "Nothing from FieldQuo — but a visitor to a site with stock photos fetches them from Unsplash directly. See [[stock-photos-on-your-website|Stock photos on your website]]."],
            ],
          } },
          { note: "The AI never receives your database. It is handed a list of lookups, chooses one, and gets back a small set of numbers already computed by FieldQuo; the company is fixed in code, so no question can reach another company's data, and a person whose access hides prices gets no money lookups at all. See [[fieldquo-ai-ask-about-your-business|FieldQuo AI]]." },
        ],
      },
      {
        id: "what-your-clients-can-do",
        heading: "What your clients can do, and what they cannot",
        blocks: [
          { p: "A client's portal shows their quotes and invoices with you and lets them pay; it is not a data-access tool. A client can unsubscribe from marketing email in one click — the record is kept permanently, on purpose — and reply STOP to a text. Nothing lets a homeowner see, correct, export or delete their own information by themselves; they ask you, and you act in FieldQuo or forward the request to FieldQuo. See [[client-consent-and-unsubscribes|Client consent and unsubscribes]]." },
        ],
      },
      {
        id: "what-you-can-take-out",
        heading: "What you can take out",
        blocks: [
          { bullets: [
            "**Bookkeeping export** — a ZIP of four CSVs (summary, invoices, payments, expenses) for any date range, from Expenses. See [[the-accounting-export|The accounting export]].",
            "**Price book** — Export CSV on Settings → Products & Services, cost prices included.",
            "**Year-end subcontractor list (CSV)** and each **pay run's CSV**.",
            "**PDFs** — every quote, invoice, payslip and job photo report.",
          ] },
          { warning: "There is no export of clients, jobs, leads or photos, and no “download everything”. Before asking for an account deletion, take the exports above and save the PDFs you want; deletion is not reversible and FieldQuo keeps no copy for you afterwards." },
        ],
      },
      {
        id: "deleting",
        heading: "Deleting, in the product and by request",
        blocks: [
          { p: "In the product, a quote, a job, an invoice or an expense can be deleted from its own screen by someone whose access allows it — the Manager level and above. A client record has no delete button today. Disconnecting Meta Ads deletes the stored token at once; imported spend stays. Photos and documents are never removed from storage by any screen; see [[photos-and-files|Photos and files]]." },
          { p: "Nothing expires on a schedule. **Cancelling your plan deletes nothing**: the account is read-only for 30 days and then locked, and starting the plan again brings everything back, exactly as the cancel screen says — **Nothing is deleted. Your quotes, clients, jobs, invoices and photos stay exactly as they are.** See [[cancel-your-subscription|Cancel your subscription]] and [[closing-your-account|Closing your account]]." },
          { steps: [
            "To have data deleted — one client's, or the whole account — send a request from the account owner's email address to FieldQuo's support address, or use the deletion form on FieldQuo's own website. FieldQuo confirms who you are first.",
            "You receive a reference code and a confirmation email. Deletion is done by hand by FieldQuo's owner within **30 business days**; the reference lets you check its status on the same page.",
            "A completion email closes it. Unsubscribe and STOP records, financial and tax records, and the record of the request itself are kept, by design.",
          ] },
          { p: "If a homeowner removes FieldQuo from their Facebook settings, Meta sends FieldQuo a deletion request the same way, with a reference code they can check. See [[how-to-get-help|How to get help]] for the support address." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can act on this",
        blocks: [
          { p: "Cancelling the plan and requesting a migration are for the **owner and administrators**. A deletion request for the whole account must come from the owner's address. The exports follow their own screens' access: the bookkeeping export needs See prices and view access to invoices, the price book export needs See prices, and the subcontractor list needs job costing." },
        ],
      },
    ],
    faq: [
      { q: "Is my clients' data used to train an AI?", a: "FieldQuo's code sends the AI only what the table above lists, and the assistant gets a client's name alone. What the vendor does with a request afterwards is governed by FieldQuo's agreement with it, which the privacy page names; the product itself makes no claim either way." },
      { q: "Can another contractor on FieldQuo see my prices?", a: "No. The How You Compare benchmark is opt-in, published only once at least five quotes stand behind a figure, and never shows one company's prices. FieldQuo AI is bound to your company in code." },
      { q: "If I stop paying, is my data gone?", a: "No. The account goes read-only, then locked; nothing is erased, and paying restores it. Erasing is a separate written request." },
      { q: "Where is the data hosted?", a: "Neon (database), Vercel (the product) and Cloudinary (files). FieldQuo does not claim a particular country, because it has not pinned one." },
    ],
  },

  "no-public-api-or-zapier": {
    title: "No public API or Zapier, yet",
    summary:
      "FieldQuo has no API keys, no Zapier app, no outgoing webhooks and no calendar feed. This article says so plainly and lists the doors that do exist — embeds, public links, CSV in and out, the Meta import and the migration service.",
    updated: "2026-09-12",
    intro: [
      "If you are looking for an API key to paste somewhere, there is none to find. FieldQuo has **no public API**, **no Zapier or Make app**, **no webhooks you can point at your own system**, and **no calendar feed** for Google or Outlook. Every route in the product authenticates a signed-in person, and the webhooks that exist are vendors — Stripe, Meta, Twilio, Retell — calling FieldQuo, not FieldQuo calling you.",
      "That is the whole of the first half. The second half is what does exist, because “how do I get data in and out” has real answers even without an API.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "FieldQuo's own comparison pages concede these to the competition rather than imply them: the words QuickBooks, Zapier and Xero appear in no integration code, only in prose. The recorded plan, in order, is the bookkeeping export (built), then one signed outgoing webhook per event (not built), then a one-way QuickBooks push (deferred); a published Zapier app and a two-way accounting sync are refused for now. Nothing on this page should be read as a date." },
        ],
      },
      {
        id: "doors-out",
        heading: "The doors out",
        blocks: [
          { table: {
            head: ["Door", "What comes out", "Where"],
            rows: [
              ["**Bookkeeping export**", "Four CSVs — summary, invoices, payments, expenses — for a date range, in one ZIP", "Expenses → Download the range. See [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero and your bookkeeper]]."],
              ["**Export CSV**", "Your price book, cost prices included", "Settings → Products & Services"],
              ["**Year-end list (CSV)**", "What each subcontractor was paid in a year", "Subcontractors"],
              ["**Export CSV** on a pay run", "One pay run's lines", "Payroll"],
              ["PDFs", "Every quote, invoice, payslip and job photo report", "Their own screens, and the client's email"],
            ],
          } },
          { p: "There is no export of clients, jobs, leads, appointments or photos. If you leave, take these files and the PDFs; see [[data-and-privacy|Your data, your clients' data, and deletion]]." },
        ],
      },
      {
        id: "doors-in",
        heading: "The doors in",
        blocks: [
          { bullets: [
            "**Import** on Clients — a CSV with name, email, phone, address, city, province. See [[import-clients-from-a-csv|Import clients from a CSV]].",
            "**Past jobs** on Jobs — one row becomes a quote, a job, an invoice and its payment, so your history has numbers behind it. See [[import-past-jobs|Import past jobs]].",
            "**Import** on Leads, and **Import CSV** on Settings → Products & Services.",
            "**Import from bank CSV** on Expenses — column mapping, your date format, duplicate detection. See [[import-expenses-from-a-bank-csv|Import expenses from a bank CSV]].",
            "**Facebook lead forms** — a lead submitted on a Meta ad becomes a lead in FieldQuo, once Meta approves the permission. See [[facebook-lead-forms|Facebook lead forms]].",
            "**The data migration service** — FieldQuo's staff bring your old system's clients and quotes in for a quoted price, creating new records only. See [[the-data-migration-service|The data migration service]].",
          ] },
        ],
      },
      {
        id: "doors-on-your-website",
        heading: "The doors on your own website",
        blocks: [
          { p: "What an API would most often be asked for — “put FieldQuo on my site” — is an embed. **Settings → Share your links** gives each public page a link and a **Copy code** snippet: the booking calendar, the quote request form, the instant estimate, your reviews and each published funnel. Paste the snippet into any website and the form works there, sized to fit. The same snippets sit on Settings → Booking Page and Settings → Instant Quotes. See [[embed-booking-and-quote-forms|Embed booking and quote forms]]." },
          { p: "Every public page also stands alone as a link: the booking page, the quote request, the instant estimate, a funnel, your generated website, the client portal, a quote's approval page and an invoice's pay page. A link is a door a homeowner can use without an account; see [[share-your-links|Share your links]]." },
        ],
      },
      {
        id: "not-integrated",
        heading: "What is not there, in one list",
        blocks: [
          { bullets: [
            "No API keys, tokens or developer settings anywhere in the product.",
            "No Zapier, Make or similar automation app.",
            "No outgoing webhooks — nothing calls your server when a quote is approved or an invoice is paid.",
            "No calendar feed or Google / Outlook calendar sync; the appointments calendar lives in FieldQuo.",
            "No live accounting sync with QuickBooks Online, Xero or QuickBooks Desktop.",
            "No inbound email into FieldQuo; a client's reply lands in your own mailbox.",
          ] },
          { tip: "If you need one of these to choose FieldQuo, say which one to support. The order above is the order they are being weighed in, and a customer asking is the thing that moves an item." },
        ],
      },
    ],
    faq: [
      { q: "Can I connect FieldQuo to my CRM or spreadsheet?", a: "Only by file: the CSV exports out and the CSV imports in. There is no live link." },
      { q: "Can my website send its own form into FieldQuo?", a: "Use the embed snippet or link to the public quote request page — that is the supported way for a form on your site to create a lead. There is no endpoint for a form you built yourself." },
      { q: "Will I be told when an API arrives?", a: "Settings → Product Updates carries every change; nothing is promised here." },
    ],
  },
};
