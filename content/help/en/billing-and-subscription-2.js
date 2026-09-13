// content/help/en/billing-and-subscription-2.js
//
// Part 2 of the “billing-and-subscription” category in English (see the
// composer, billing-and-subscription.js). Slugs assigned to this part
// (lib/help/tree.js): failed-payments-and-the-grace-period, renewal-reminders,
// cancel-your-subscription, referral-months, ai-credit-and-phone-credit,
// paying-for-the-migration-service, taxes-and-currency-on-your-subscription,
// closing-your-account.
//
// Every number below is read from the code that enforces it: the 7 and 30
// day windows from lib/billing/access.js, the reminder windows from
// lib/billing/renewalReminder.js, the retention offers from
// lib/billing/retention.js, the referral months from lib/referrals/index.js,
// the credit prices from lib/voice/credits.js and lib/ai/imageEconomics.js,
// the deletion promise from lib/dataDeletion/constants.js. If one of those
// changes, the sentence here is wrong until it is re-read.
export const ARTICLES = {
  "failed-payments-and-the-grace-period": {
    title: "Failed payments and the grace period",
    summary:
      "What happens when FieldQuo cannot charge your card: seven days of read-only access, two emails, a banner, and how to get everything back in about a minute.",
    updated: "2026-09-12",
    intro: [
      "A card fails for dull reasons — it expired, the bank put a fraud hold on it, the limit was reached. When that happens on your FieldQuo subscription, nothing is deleted and nobody is thrown out. The account goes **read-only** for **7 days**: everyone can still open every quote, invoice, client and photo, but nobody can create or send anything new. Update the card and everything comes back the moment the payment goes through.",
      "This article is the whole of that seven-day window: what you see on the screen, which emails FieldQuo sends and when, how to fix the card, and what happens if the seven days run out.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Your subscription is billed by Stripe on your plan's cadence. When a charge fails, Stripe tells FieldQuo, the plan's status becomes **Overdue**, and a clock starts on that day. For 7 days the account is read-only. On the eighth day it locks: the only screen anyone can open is Account & Billing, plus Help. Paying restores full access at once, whichever day it is." },
          { p: "The clock starts on the first failed charge and does not restart if a later attempt fails too. If Stripe eventually gives up and ends the subscription, the account is treated as **cancelled** instead, which has its own, longer window — see [[cancel-your-subscription|Cancel your subscription]]." },
          { note: "Read-only is enforced on the server, not by hiding buttons. Any attempt to save, send or create during the window is refused with a message that says how many days are left and that nothing has been deleted." },
        ],
      },
      {
        id: "what-you-see",
        heading: "What you see during the window",
        blocks: [
          { bullets: [
            "**On Account & Billing** — the plan card's status badge reads **Overdue** in red, next to the plan name.",
            "**A banner across the top of every screen** — amber while there are more than two days left, red when there are two days or fewer, reading that the payment did not go through and how many days remain, with an **Update card** link. Everyone on the team sees it, not just the owner.",
            "**Two emails from FieldQuo** — one the day the window opens, saying the card could not be charged, that the account is read-only and that nothing has been deleted; and one reminder when two days or fewer remain, naming the exact date the account locks. There is no daily nag in between, and both are sent in English.",
            "**After the seventh day** — a full-page notice that the account is locked, with an **Update my card** button. It says, in its own words, that nothing has been deleted.",
          ] },
        ],
      },
      {
        id: "fix-the-card",
        heading: "How to update the card",
        blocks: [
          { steps: [
            "Open **Settings → Account & Billing** (the same screen as **Plan** in the main sidebar). Only an owner or administrator can open it.",
            "Press **Manage billing & payment method**. Stripe's billing portal opens on FieldQuo's behalf; add the new card or fix the old one there.",
            "Come back. FieldQuo asks Stripe what changed the moment you return and updates the plan card. If the badge still reads **Overdue**, press **Check with Stripe** a little later — Stripe collects the outstanding payment on its own schedule once a working card is on file.",
            "When the payment succeeds the status returns to **Active**, the banner disappears, and the seven-day clock is cleared — a later problem gets a fresh seven days, not the leftover of this one.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Account & Billing — the plan card with its status badge, the Manage billing & payment method button, and the Plans grid below." },
          { tip: "Fixing the card takes about a minute and can be done from a phone. If you cannot pay right now, the **Help** link still works in the locked state — write to us rather than waiting for the clock to run out." },
        ],
      },
      {
        id: "the-timeline",
        heading: "The timeline",
        blocks: [
          { table: {
            head: ["When", "What happens"],
            rows: [
              ["The charge fails", "Status becomes Overdue. The account is read-only from that moment. The clock starts."],
              ["The same day, or the next morning", "The first email goes out — the daily check runs once a day, so it can arrive up to a day after the failure."],
              ["Two days or fewer left", "The banner turns red and the one reminder email is sent, naming the lock date."],
              ["Day 8", "The account locks. Reads stop too; Account & Billing and Help stay open."],
              ["Any day the payment succeeds", "Full access returns immediately. Nothing was deleted at any point."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it, and who can fix it",
        blocks: [
          { p: "The banner and the read-only state apply to everyone in the company — an estimator cannot send a quote during the window any more than the owner can. Fixing it is owner-and-administrator only, because the payment method belongs to the company: the **Manage billing & payment method** button and the Account & Billing row are hidden from every other level, and the server refuses them the same way. The emails go to the company email address, or the owner's when there is none." },
        ],
      },
    ],
    faq: [
      { q: "Is my data deleted if the seven days run out?", a: "No. A locked account is inaccessible, not erased. Quotes, invoices, clients, jobs and photos stay exactly where they are, and paying restores them instantly." },
      { q: "Can my clients still pay me during the window?", a: "Yes. Their quote links, portal and invoice pay pages are public pages with no billing gate, and their payments still reach your own Stripe account. What you cannot do is send, edit or chase anything until the card is fixed." },
      { q: "Why did the first email arrive the day after the card failed?", a: "The check that sends it runs once a day. The account went read-only the moment the charge failed; the email caught up on the next run." },
    ],
  },

  "renewal-reminders": {
    title: "Renewal reminders",
    summary:
      "Which subscriptions get an email before the next charge, how far ahead it arrives, what it says, and why a monthly plan does not get one.",
    updated: "2026-09-12",
    intro: [
      "Before FieldQuo charges your card for another period, it can warn you. It does so where a warning is useful: **30 days** before a yearly plan renews, and **7 days** before a free first month turns into the first real charge. A monthly plan gets no reminder — the same amount on the same day every month is not something anyone needs a letter about.",
      "This article says exactly who gets the email, when, what is in it, and what to do if you want to change or cancel before the date it names.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The reminder is decided once a day from your subscription's own next billing date — the one shown as **Next billing date** on Account & Billing. It is sent once per period: a yearly plan gets one email a year, and the same period is never reminded twice. If the send fails, the next day's run tries again, right up to the renewal." },
          { p: "Nothing is charged by the reminder itself. The charge is Stripe's, on the date in the email, to the card on file — and the email says which card, by its last four digits, when Stripe reports one." },
        ],
      },
      {
        id: "when-it-goes-out",
        heading: "When it goes out",
        blocks: [
          { table: {
            head: ["Your subscription", "Reminder"],
            rows: [
              ["Yearly plan (1 year commitment)", "30 days before the renewal date"],
              ["Free first month, about to become paid", "7 days before the first charge (30 days if the plan is yearly)"],
              ["Monthly plan", "None — the amount and the day are the same every month"],
            ],
          } },
          { note: "A subscription that is overdue or cancelled gets no reminder. An overdue account is already inside the seven-day window described in [[failed-payments-and-the-grace-period|Failed payments and the grace period]], and forecasting a charge on a card that just bounced would be the wrong message." },
        ],
      },
      {
        id: "what-the-email-says",
        heading: "What the email says",
        blocks: [
          { bullets: [
            "The plan name and the renewal date, in one sentence.",
            "The amount that will be charged, in your billing currency, and the last four digits of the card when Stripe has them.",
            "That you can change plans or cancel any time before that date from Account & Billing, and that nothing is charged until the renewal date.",
            "A **Manage billing** button that opens Account & Billing.",
          ] },
          { p: "The email comes from FieldQuo, not from your company, and is written in English. It is the only automatic email about an upcoming charge FieldQuo sends; Stripe can send its own generic notice too, and if you receive both on the same day that is Stripe's, not a second one of ours." },
        ],
      },
      {
        id: "change-before-renewal",
        heading: "Changing or cancelling before the date",
        blocks: [
          { steps: [
            "Open **Settings → Account & Billing**.",
            "To move to another plan, choose it in the **Plans** grid. A downgrade or a switch between **Monthly** and **1 year commitment** lands on the renewal date, with nothing charged before it; an upgrade applies now. See [[change-your-plan|Change your plan]].",
            "To stop the renewal altogether, press **Cancel plan** — read [[cancel-your-subscription|Cancel your subscription]] first, because the plan ends the moment you confirm, not on the renewal date.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Account & Billing — the next billing date under the plan card, and the Monthly / 1 year commitment switch above the Plans grid." },
        ],
      },
      {
        id: "who-receives-it",
        heading: "Who receives it",
        blocks: [
          { p: "The company email address, or the owner's address when the company has none. It is not sent to every member: how much the company pays FieldQuo, and when, is commercial information that stays with the owner and the administrators, the same people who can open Account & Billing." },
        ],
      },
    ],
    faq: [
      { q: "I am on a monthly plan and never get a reminder. Is something broken?", a: "No. Monthly plans get none by design. The next billing date is always on Account & Billing." },
      { q: "Does the reminder mean I have been charged?", a: "No. It says a charge is coming, on the date it names. Stripe's receipt after the charge is a separate email." },
      { q: "Can I get the reminder in French or Spanish?", a: "Not today. FieldQuo's own billing emails — renewal, failed payment, cancellation — are sent in English." },
    ],
  },

  "cancel-your-subscription": {
    title: "Cancel your subscription",
    summary:
      "How the Cancel plan button works: the reason step, the offer step, the warnings that apply to your company, and the thirty days of read-only that follow.",
    updated: "2026-09-12",
    intro: [
      "Cancelling is a button on Account & Billing, not an email to support. Before the plan ends, FieldQuo asks why you are leaving, may make one offer that fits the reason, and then tells you — in the plain words below — exactly what stops, what keeps running, and what does not happen. The plan ends the moment you confirm; the account stays open **read-only for 30 days**, and nothing is deleted.",
      "Read this before you press the button, because two of the things that keep running after a cancellation cost money: a rented phone number, and automatic phone-credit top-ups.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Pressing **Cancel plan** opens a short flow: **Before you go** (why you are leaving), sometimes **One thing first** (an offer), then **Cancel your plan** (the consequences and the confirmation). Confirming cancels the subscription at Stripe immediately. Stripe tells FieldQuo, the plan's status becomes **Cancelled**, and a 30-day read-only window starts. After it, the account locks until someone starts a plan again." },
          { warning: "The plan ends the moment you confirm — not at the end of the month or the year. What you have already paid for the rest of the period is not refunded. If you want the remaining weeks, keep the plan until the next billing date and cancel then." },
        ],
      },
      {
        id: "how-to-cancel",
        heading: "How to cancel",
        blocks: [
          { steps: [
            "Open **Settings → Account & Billing** and press **Cancel plan**, under the plan card.",
            "**Before you go** — the screen shows what you have built up (quotes, clients, invoices) and asks what is making you cancel: too expensive, paying for people who do not use it, seasonal work, not using it enough, a missing feature, moving elsewhere, closing the business, or something else. Pick one, or press **Skip this and cancel**.",
            "**One thing first** — if an offer fits, it is shown here (the table below). Take it and the plan stays; or press **No thanks — cancel my account**.",
            "**Cancel your plan** — read the consequences, add a note if you like (it is the only way we find out what to fix), and press **Cancel my plan**. **Keep my plan** closes the flow with nothing changed.",
            "An email confirms the cancellation. The plan card now reads **Cancelled** and the **Cancel plan** button is gone.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Account & Billing — Cancel plan sits under the plan card, next to Manage billing & payment method." },
          { note: "Everything in the flow is decided on the server. The offer you see is the one your account is entitled to, and a cancellation is only ever recorded once Stripe has actually ended the subscription." },
        ],
      },
      {
        id: "the-offers",
        heading: "The offers",
        blocks: [
          { table: {
            head: ["Offer", "When it appears", "What it does"],
            rows: [
              ["Drop to fewer licences", "Only on an older per-licence plan with more licences paid for than people using them", "Reduces the licence count on your Stripe subscription from the next invoice, with the unused part credited"],
              ["Pause until you are busy again", "Any plan, once every 12 months", "Stripe stops issuing invoices while the account is paused — no bill piles up to settle on return"],
              ["25% off for 2 months", "Any plan, once every 12 months", "Your next 2 invoices drop by 25%, then the normal price returns"],
            ],
          } },
          { p: "The pause and the discount share one 12-month cooldown: take either and neither is offered again for a year, and the screen says from what date the next one is available. Reducing licences is not a concession — it corrects an overcharge — so it never starts the cooldown. On the four-rung ladder (Solo, Crew, Shop, Scale) the licence offer never appears, because those plans are not priced per licence." },
        ],
      },
      {
        id: "what-happens-after",
        heading: "What happens after you confirm",
        blocks: [
          { bullets: [
            "**Read-only for 30 days.** Everyone can still open FieldQuo and read everything — download what you need for your accountant — but nobody can change anything. A banner across the top counts the days.",
            "**Then locked.** After the 30 days the account stays shut until the plan is started again. Nothing is deleted at any point; starting again gives all of it back.",
            "**Your clients keep every link.** Quotes, the client portal and invoice pay pages still open, and anything they pay still reaches your own Stripe account.",
            "**No refund of the remaining period.** The screen states the date you have paid to before you confirm.",
            "**Starting again** is **Choose plan** on the same screen, which opens a new Stripe checkout. The free first month is not offered a second time.",
          ] },
        ],
      },
      {
        id: "before-you-cancel",
        heading: "Sort these out first",
        blocks: [
          { p: "The confirmation step lists only the warnings that are true for your company — a painter with no phone number is not told about one. Each is something you can only do while the account is still writable, so do it before confirming." },
          { bullets: [
            "**A rented phone number is not handed back.** Its monthly rent keeps coming out of your phone credit; when the credit cannot cover it you get 7 days' notice and the number is then released for good. Release it yourself first if you would rather choose the moment.",
            "**Phone credit is not refunded.** Whatever balance you bought stays a balance.",
            "**Automatic phone-credit top-ups stay on.** If a card is saved for them, it keeps being charged whenever the balance runs low. Switch them off on the phone settings page first.",
            "**Service plans with a saved payment method keep running.** Invoices keep going out and your clients' cards keep being charged on schedule. Cancel those plans first if that is not what you want.",
            "**Unpaid invoices stay payable** by the client, but once you are read-only you cannot edit, re-send or chase them.",
            "**Your website and booking page stay live.** New booking requests keep arriving, and after the 30 days you will not be able to open the account to see them. A small “Site by FieldQuo” line returns to the footer then. Unpublish the site first if you would rather it went quiet.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can cancel",
        blocks: [
          { p: "The owner and administrators. A Manager, Dispatcher or Estimator does not see Account & Billing at all, and the cancel request is refused on the server for anyone below owner or administrator — the subscription is the company's commercial relationship with FieldQuo, not a scheduling permission." },
        ],
      },
    ],
    faq: [
      { q: "Can I cancel at the end of my billing period instead of today?", a: "Not from the button — it ends the plan immediately. Wait until the day before your next billing date and cancel then; the renewal reminder on a yearly plan gives you 30 days' notice of that date." },
      { q: "I paid for a year. Do I get the rest back?", a: "No. The screen says the date you have paid to and that the rest is not refunded, before you confirm." },
      { q: "Will my data be deleted after the 30 days?", a: "No. Locked is not erased. To have data actually deleted, see [[closing-your-account|Closing your account and your data]]." },
    ],
  },

  "referral-months": {
    title: "Referral months",
    summary:
      "How a referred business and the business that referred it each earn one free month, when each month lands, and the rules that stop the programme being gamed.",
    updated: "2026-09-12",
    intro: [
      "Refer another contractor and you both get the same thing: **one more month of FieldQuo free**. The newcomer's month is added to their free trial the moment they sign up through your link. Yours is added to your account when they make their **first real payment** — not when they sign up, because a month for a signup is a month for a throwaway address.",
      "This article is the mechanics: how the month is earned, where it goes on a monthly, yearly or trial account, and the limits. The page itself — the link, the invite form, the list of businesses — is covered in [[refer-another-business|Refer another business, earn a free month]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every company has a referral code and a link on **Refer & Earn**. A business that signs up through it starts with its normal free first month plus one referral month. You are then listed under **Businesses you've referred** as **Signed up — not yet paying** until their first paid invoice clears, at which point the badge becomes **Credited** and a month is added to your own access, automatically." },
          { p: "The month is the same size whoever you refer. A Solo company referring a Scale company earns a month of Solo; the size of the business you bring in does not change what you get — the screen says so in its own words." },
        ],
      },
      {
        id: "how-a-month-is-earned",
        heading: "How a month is earned",
        blocks: [
          { steps: [
            "Open **Refer & Earn** (in the main sidebar, or under Settings) and share **Your link** — **Copy** it, or use **Send an invite** by email or text. FieldQuo sends one message and does not follow up, and the invite form allows 20 a day.",
            "The other business signs up through the link. Their free trial is extended by one month on the spot, and they appear in your list as **Signed up — not yet paying**.",
            "They pay their first real invoice — the free month is $0, so the first charge after it — having finished onboarding and connected a verified Stripe account for taking payments.",
            "Your month is added the moment that payment lands, and the row reads **Credited**.",
          ] },
          { figure: "live:app-settings-refer", caption: "Refer & Earn — your link, the invite form, and the businesses you have referred with their status." },
          { note: "Two conditions on the referred company have to be true before your month is granted: their onboarding is complete, and their own Stripe account for client payments is verified. A referred company that pays before connecting Stripe earns you the month on their next paid invoice after it is verified — later, not never." },
        ],
      },
      {
        id: "when-it-lands",
        heading: "Where the month goes",
        blocks: [
          { table: {
            head: ["Your account", "What the month does"],
            rows: [
              ["Still on the free first month", "Your trial end date moves one month later. Nothing is charged until then."],
              ["Paying monthly", "Your next charge is deferred by a calendar month. The plan keeps going; you are simply not billed for that month."],
              ["Paying yearly", "Your renewal date moves one month later — a year ending 27 Aug renews 27 Sep. You are not billed another year to receive it."],
            ],
          } },
          { p: "Months stack from the later of the two dates. Refer a second business before the first month has run and the end date moves another month, not back to where it was. A 31st that would land in a shorter month becomes that month's last day." },
        ],
      },
      {
        id: "the-rules",
        heading: "The rules",
        blocks: [
          { bullets: [
            "**One month each**, for the referrer and the referred, however large either business is.",
            "**A company that already exists can refer but never redeem.** The link is for businesses that are new to FieldQuo; an existing customer signing up again through a link gets nothing.",
            "**You cannot refer yourself.** Checked on the code, not the email address.",
            "**At most 50 credited referrals per company per calendar month.** A count cap against abuse, not a limit on what a real referral earns.",
            "**Each referred company earns you the month once.** A retried payment or a renewal never pays the same referral twice.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner and administrators. Refer & Earn is a billing screen — it changes when the company is next charged — so it sits behind the same rule as Account & Billing and is hidden from every other level." },
        ],
      },
    ],
    faq: [
      { q: "The business I referred signed up weeks ago. Why am I still not credited?", a: "Their row still reads Signed up — not yet paying. The month is granted on their first real payment, after their free month, and only once their onboarding is complete and their Stripe account for client payments is verified." },
      { q: "Is it a discount or a free month?", a: "A free month: your next charge moves a month later. It is not a dollar credit against a bigger invoice." },
      { q: "Does the referred business get anything?", a: "Yes — one extra month added to their free trial at signup, before they have paid anything." },
    ],
  },

  "ai-credit-and-phone-credit": {
    title: "AI credit and phone credit",
    summary:
      "The two prepaid balances FieldQuo meters — phone minutes and number rent on one, AI images and the deep photo read on the other — what each costs, how to buy more, and how automatic top-up works.",
    updated: "2026-09-12",
    intro: [
      "Your plan includes FieldQuo AI and the copilot. Two things are metered separately, against credit you buy in advance: the **phone receptionist** (and crew texting), and **AI images** (generation, and the paid deep read of a quote's photos). They draw two different balances, kept apart on purpose, and both are shown on **Settings → AI credit**.",
      "Credit is bought from FieldQuo through Stripe in **US dollars**, whatever currency your plan bills in. It never expires, and it is never refunded — including when you cancel the plan.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "**AI credit** is one screen with three cards: **Phone credit** (balance, a link to buy more, and **Where the credit went**), **AI image credit** (balance, an **Add credit** row of one-off amounts, and its own statement), and **AI credit plan — pay monthly, save per credit** (a recurring allowance on the AI balance). Buying phone credit and setting up automatic top-up live on the **Phone receptionist** settings page, which the first card links to." },
          { note: "The two balances do not mix. Phone credit cannot be spent on images and image credit cannot be spent on calls. The screen says so under its title, so nobody buys the wrong one." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { figure: "live:app-settings-ai-credit", caption: "AI credit — the Phone credit card, the AI image credit card with its Add credit amounts, and the AI credit plan card." },
          { bullets: [
            "**Phone credit** — the balance, a **running low** flag when fewer than ten minutes remain, the note that crew texting draws this same balance, **Add phone credit** (which opens the phone settings page), and the statement.",
            "**AI image credit** — the balance with what it buys in brackets (about N images, or N deep reads), the two things that spend it, **Add credit** with four amounts, and the statement.",
            "**AI credit plan** — the rollover promise in plain words, then either the three plans with **Subscribe**, or the plan you are on, its renewal date, and **Cancel plan**.",
          ] },
        ],
      },
      {
        id: "prices",
        heading: "What each thing costs",
        blocks: [
          { table: {
            head: ["Item", "Cost", "Balance it draws"],
            rows: [
              ["Receptionist call", "35¢ a minute, rounded up, one minute minimum", "Phone credit"],
              ["Local number rent", "$4 a month", "Phone credit"],
              ["Toll-free number rent", "$9 a month, plus 5¢ a minute on calls", "Phone credit"],
              ["Crew texting line", "$4 a month", "Phone credit"],
              ["AI image generation", "12¢ an image", "AI image credit"],
              ["Deep photo read on a quote", "25¢ a read, up to 8 photos", "AI image credit"],
            ],
          } },
          { p: "The first phone number comes with **30 free minutes**, once per company. A number whose rent the credit cannot cover gets 7 days' notice and is then released for good — see [[settings-phone-receptionist|Phone receptionist]]." },
        ],
      },
      {
        id: "buying-credit",
        heading: "Buying credit",
        blocks: [
          { steps: [
            "For **phone credit**, open **Settings → Phone receptionist** and press **Add credit** in the **Credit** card. Pick **$10**, **$30**, **$50** or **$100** — each shows the minutes it buys — or enter any amount from $5 to $1,000. Stripe's checkout opens; the credit lands on your balance when you return, or within a minute or two through Stripe's own confirmation if you closed the tab.",
            "For **AI image credit**, press one of the four **Add credit** amounts on **Settings → AI credit** — the same $10 / $30 / $50 / $100, each labelled with the images it buys — and pay on Stripe's page the same way.",
            "For a **monthly allowance**, press **Subscribe** on one of the three AI credit plans. The first month's credit is on your balance when you return; each later month's is added when that month's invoice is paid.",
          ] },
          { bullets: [
            "**starter** — $30 a month for 4,000 credits (about 333 images).",
            "**busy** — $50 a month for 7,000 credits (about 583 images).",
            "**agency** — $80 a month for 11,500 credits (about 958 images).",
          ] },
          { p: "One credit is one cent of pay-as-you-go value, so a generation is 12 credits and a deep read 25. Unused plan credit rolls over: nothing expires, and cancelling the plan stops next month's charge and next month's credit but never takes back credit already granted. The plans are billed in US dollars on the same Stripe customer as your subscription, so a company whose plan bills in **CAD** cannot start one — the **Subscribe** button is off and says why. One-off top-ups still work on a CAD account." },
        ],
      },
      {
        id: "automatic-top-up",
        heading: "Automatic top-up for phone credit",
        blocks: [
          { p: "Off unless you turn it on. When it is on, FieldQuo buys more phone credit on its own when the balance drops below a threshold you choose, so the receptionist never stops answering mid-week. It is checked every 15 minutes, buys at most **3 times a day**, and waits at least 15 minutes between purchases." },
          { steps: [
            "On **Settings → Phone receptionist**, find **Top up automatically** and press **Set up automatic top-up**.",
            "Choose **Top up when the balance drops below** ($5, $10 or $20) **and buy this much each time** ($10, $30, $50 or $100), read and tick the terms, and press **Continue**. Stripe saves the card with a proper mandate; the terms you agreed to are recorded with the date.",
            "The card reads **Automatic top-up is on**, with the threshold, the card's last four digits, the amount, and the daily maximum. **Turn off automatic top-up** stops it while keeping the card; **Remove the saved card** removes it. Changing the threshold or the amount asks you to agree to the terms again.",
          ] },
          { warning: "If the saved card is declined, FieldQuo switches automatic top-up off and does not retry — retrying a declined card is how a card gets blocked. The card on the settings page says so; sort the card out with your bank, then press **Turn it back on**. Cancelling your FieldQuo plan does not switch automatic top-up off." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner, administrators, and anyone on the Dispatcher or Manager preset — the same people who can manage the team. Buying credit, subscribing to a plan and arming automatic top-up are refused on the server for anyone else. An estimator or a crew login never sees the AI credit or Phone receptionist rows." },
        ],
      },
    ],
    faq: [
      { q: "Why is credit priced in US dollars when my plan is in CAD?", a: "The phone minutes and the AI are bought in US dollars and exchange rates move, so the balances are kept in the currency they cost. Only the monthly AI credit plan is unavailable on a CAD account; one-off top-ups of either balance work." },
      { q: "Does unused credit expire?", a: "No. Neither balance expires, and plan credit rolls over month to month. It is also never refunded, including when you cancel your FieldQuo plan." },
      { q: "Is FieldQuo AI — asking questions about my own quotes and invoices — metered?", a: "No. FieldQuo AI and the copilot are included in every plan. Only phone minutes, number rent, image generation and the deep photo read draw credit." },
      { q: "Where do I see what the credit was spent on?", a: "Under Where the credit went on each card of the AI credit page: every debit and every top-up, dated. The phone page carries the same statement." },
    ],
  },

  "paying-for-the-migration-service": {
    title: "Paying for the migration service",
    summary:
      "How the paid data-migration service is priced, accepted and paid — through FieldQuo's billing, never your Stripe account — and what the price does and does not buy.",
    updated: "2026-09-12",
    intro: [
      "The data-migration service is FieldQuo staff bringing your old clients and quotes into your account by hand, for a price FieldQuo sets after seeing what you have. You request it, FieldQuo prices it, you accept the price, you pay it, and only then does anyone write anything into your account. This article is the money half of that; the service itself is described in [[the-data-migration-service|The data migration service]].",
      "The payment is FieldQuo billing your company — one payment, through Stripe, on the same customer record as your subscription. It never touches the Stripe account your clients pay you through.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Everything happens on **Settings → Data Migration**. The request card shows where your data is coming from, its status, and — once FieldQuo has priced it — the price with a note, and **Accept** / **Decline**. Accepting turns the card into a payment step with **Pay and start migration**; paying turns it into a progress card, and **What's been brought in** fills up below as records are added." },
          { note: "The price and its currency are set by FieldQuo on the request. The browser never sends an amount to Stripe — the checkout is built from the request's own price on the server, the same rule every other payment in FieldQuo follows." },
        ],
      },
      {
        id: "the-steps",
        heading: "From request to paid",
        blocks: [
          { steps: [
            "Press **Request a migration** and say where your data is now (QuickBooks, Jobber, a spreadsheet…) and anything else worth knowing. The card reads **Requested**.",
            "Optionally book a call under **Book a call with FieldQuo** to work out the scope; the card reads **Call booked**. You can upload the exports under **Documents** at any point up to here or later.",
            "FieldQuo prices it. The card reads **Quote ready**, with the price and a note explaining it.",
            "Press **Accept**. The card reads **Accepted — payment due**, with the line “pay when you're ready to start”. Or press **Decline**, which ends the request.",
            "Press **Pay and start migration**. Stripe's checkout opens; pay there. When you return the card reads **Paid** and says FieldQuo will be in touch. If you closed the tab after paying, Stripe's own confirmation still marks it paid.",
            "Once staff begin, the card reads **In progress**; when they finish, **Completed**. Every client and quote they created is listed under **What's been brought in**.",
          ] },
          { figure: "live:app-settings-migration", caption: "Data Migration — the request card with its status and price, and the Documents card for your exports." },
        ],
      },
      {
        id: "the-statuses",
        heading: "The statuses",
        blocks: [
          { table: {
            head: ["Status", "Meaning", "Can you cancel?"],
            rows: [
              ["Requested", "Received; not yet priced", "Yes — Cancel this request"],
              ["Call booked", "A scoping call is scheduled", "Yes"],
              ["Quote ready", "FieldQuo has set a price", "Yes, or Decline"],
              ["Accepted — payment due", "You accepted; nothing is written until you pay", "Yes"],
              ["Paid", "Payment received; staff have not started", "No — it is a support conversation"],
              ["In progress", "Staff are creating records", "No"],
              ["Completed", "Done", "—"],
              ["Declined", "You declined the price", "—"],
              ["Cancelled", "Cancelled by you or by FieldQuo", "—"],
            ],
          } },
        ],
      },
      {
        id: "what-you-are-paying-for",
        heading: "What the price buys, exactly",
        blocks: [
          { bullets: [
            "**New clients and new quotes, created by a FieldQuo superadmin inside your account.** Nothing that already existed is ever updated or deleted.",
            "**Every write is logged** — who, when, which migration, what was created — in the same transaction as the record itself.",
            "**Writes are only possible while the request is Paid or In progress**, and that is re-checked on every single write, never trusted from an earlier moment.",
            "**Not invoices, not jobs, not an automatic import.** There is no “Import from QuickBooks” button; a person reads your export and keys the records in. Invoices and jobs are not part of the service today.",
          ] },
        ],
      },
      {
        id: "refunds-and-cancelling",
        heading: "Refunds and cancelling",
        blocks: [
          { p: "Before you pay, **Cancel this request** ends it and nothing is owed. After you pay, the button is gone: backing out of a paid migration is a support conversation, and FieldQuo can call it off from its side — the moment it does, the write path closes." },
          { warning: "FieldQuo does not issue an automatic refund when a paid migration is cancelled. If one is owed, it is made by hand from the Stripe dashboard. Ask for it in the same conversation." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The owner and administrators — the Data Migration row is a billing screen, gated the same way as Account & Billing, and the request, accept and pay actions are refused on the server for anyone else. What was brought in is ordinary client and quote data afterwards, visible to whoever can see clients and quotes." },
        ],
      },
    ],
    faq: [
      { q: "Is the migration billed through my Stripe account?", a: "No. It is FieldQuo charging your company, through FieldQuo's own billing, the way your subscription is. Your clients' payments and your payouts are untouched." },
      { q: "Does anything get written into my account before I pay?", a: "No. Writes are refused until the request is Paid, and refused again the moment it is cancelled or completed." },
      { q: "Can FieldQuo change a quote I already had?", a: "No. The service creates new records only. Existing quotes, clients and invoices are never updated or deleted by FieldQuo staff." },
    ],
  },

  "taxes-and-currency-on-your-subscription": {
    title: "Taxes and currency on your subscription",
    summary:
      "Why a Canadian company pays in CAD and an American one in USD, how sales tax is added to FieldQuo's charge at checkout, and how none of it touches the tax on your own invoices.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo bills in **your own currency**: Canadian dollars for a company in Canada, US dollars for one in the United States. The plan prices are the same number in each — Solo is 99 in CAD for a Canadian and 99 in USD for an American — so nobody pays a sticker price plus an exchange rate plus a card fee. Sales tax on that charge is worked out by Stripe from your billing address and added at checkout.",
      "This is FieldQuo's charge to you. It has nothing to do with the tax you charge your clients: that is set on **Settings → Company Settings** and applied to your quotes and invoices, and the two never meet.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Your billing currency is decided once, from the country of your business address, and every FieldQuo charge on your subscription is in it: the monthly or yearly plan, an upgrade's prorated difference, a scheduled downgrade. Stripe keeps one currency per customer, so it cannot change later without a new customer record — which is why the plan grid only ever shows you the one row that matches your address." },
        ],
      },
      {
        id: "currency",
        heading: "Which currency you are billed in",
        blocks: [
          { table: {
            head: ["Business address", "Billing currency", "Shown as"],
            rows: [
              ["Canada", "CAD", "CA$"],
              ["United States", "USD", "US$"],
              ["Anywhere else, or no address yet", "Not decided — the Plans grid asks you to add your business address first", "—"],
            ],
          } },
          { p: "The four rungs are 99, 169, 269 and 369 a month, the same figures in either currency, and a **1 year commitment** is ten months for twelve — see [[the-four-plans|The four plans]] and [[monthly-or-a-year-commitment|Monthly, or a one-year commitment]]. If Account & Billing says it needs to know where your business is, press **Add your business address**, save the country, and come back." },
        ],
      },
      {
        id: "sales-tax",
        heading: "Sales tax on the charge",
        blocks: [
          { bullets: [
            "**Stripe Tax works out the rate** from the billing address you enter at checkout, and adds it as its own line — GST/HST/QST for a Canadian address, state sales tax where a US state charges it.",
            "**A billing address is required** at checkout for that reason, and Stripe writes it back to your customer record so that renewals, which do not go through checkout, are taxed the same way.",
            "**You can enter your tax number** at checkout — a Quebec or US business number — and it appears on the invoice Stripe issues.",
            "**A scheduled plan change keeps the tax setting** it started with, so a downgrade booked for the renewal date is taxed exactly as the plan it replaces.",
          ] },
          { note: "None of this changes what your clients pay. The tax on your quotes and invoices comes from your own tax settings — see [[tax-settings|Tax settings]] and [[sales-tax-on-invoices|Sales tax on invoices]] — and is charged in your company's own currency through your own Stripe account. Stripe's automatic tax is deliberately not applied there, because that would tax an already-taxed total a second time." },
        ],
      },
      {
        id: "what-is-not-taxed-here",
        heading: "Other charges from FieldQuo",
        blocks: [
          { p: "Phone credit, AI image credit and the monthly AI credit plan are priced in **US dollars** whatever your plan's currency, because the minutes and the AI are bought in US dollars — see [[ai-credit-and-phone-credit|AI credit and phone credit]]. The monthly AI credit plan cannot be started on a CAD account for that reason; one-off top-ups can. The migration service is priced by FieldQuo on the request itself. Stripe's automatic tax is applied to the subscription checkout and its renewals; those other one-off charges are not run through it today." },
        ],
      },
      {
        id: "where-to-see-it",
        heading: "Where to see the currency and the tax",
        blocks: [
          { steps: [
            "Open **Settings → Account & Billing**. The plan card shows your price in your billing currency, per month or per year.",
            "Press **Manage billing & payment method**. Stripe's portal lists every invoice FieldQuo has issued you, each with the tax line and your tax number if you gave one — see [[invoices-and-receipts-from-fieldquo|Invoices and receipts from FieldQuo]].",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Account & Billing — the plan's price in the company's billing currency, and the button that opens Stripe's portal." },
        ],
      },
    ],
    faq: [
      { q: "I moved my business from Canada to the US. Can my billing switch to USD?", a: "Not by yourself. Stripe holds one currency per customer, so the switch needs a new customer record on FieldQuo's side — write to us." },
      { q: "Is the price on the pricing page before or after tax?", a: "Before. Tax is added at checkout from your billing address, on its own line, and shown on every invoice Stripe issues." },
      { q: "Does FieldQuo's tax setting affect my invoices to clients?", a: "No. Your invoices use your own tax settings. FieldQuo's charge to you and your charge to your clients are two separate sales in two separate Stripe integrations." },
    ],
  },

  "closing-your-account": {
    title: "Closing your account and your data",
    summary:
      "Cancelling stops the bill but keeps every record; deleting is a written request carried out by a person within 30 business days. What each one does, how to ask, and what is kept regardless.",
    updated: "2026-09-12",
    intro: [
      "Two different things are easy to confuse. **Cancelling** the subscription ends the bill and, after 30 days of read-only, locks the account — but nothing is erased, ever, by that. **Deleting** the data is a separate, written request: there is no button in FieldQuo that deletes an account, and deletion is not automatic. A person at FieldQuo carries it out by hand within **30 business days** of receiving your request, and you get an email when it is done.",
      "This article says how to ask, what happens after you ask, what you can delete yourself from inside the product today, and what FieldQuo keeps even when asked — because we would rather you read that here than discover it afterwards.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "FieldQuo has no retention job: records are not aged out after a year, or ever, unless somebody deletes them. A lapsed or cancelled subscription makes the account inaccessible — nobody can sign in once the read-only window ends — but the underlying quotes, invoices, clients and photos are untouched, and starting a plan again brings all of it back. That is the safe direction for a business's records, and it is why deleting is a deliberate, separate act." },
          { warning: "Deletion is irreversible. FieldQuo will ask you to confirm who you are before deleting anything — a request from an address we cannot place is exactly how one person erases another person's records — and a deletion cannot be undone by starting a plan again." },
        ],
      },
      {
        id: "cancel-vs-delete",
        heading: "Cancelling versus deleting",
        blocks: [
          { table: {
            head: ["What", "Cancel the subscription", "Delete the data"],
            rows: [
              ["How", "Cancel plan on Account & Billing — self-serve", "A written request, by email or the public Data Deletion form on the FieldQuo website"],
              ["When", "The plan ends immediately; read-only for 30 days, then locked", "Carried out by hand within 30 business days of the request"],
              ["Your records", "Kept in full; come back by starting a plan", "Erased, except what Section “What is kept” lists"],
            ],
          } },
          { p: "If you are closing the business, do both, in that order: cancel first (see [[cancel-your-subscription|Cancel your subscription]]) so nothing else is charged, then send the deletion request once you have downloaded what your accountant needs." },
        ],
      },
      {
        id: "how-to-request-deletion",
        heading: "How to request deletion",
        blocks: [
          { steps: [
            "Download what you need first — the accounting export and any invoices — while the account is still open. Once deleted, nothing can be recovered.",
            "Write to **hello@fieldquo.com** with the subject **Data deletion request**, from the email address you signed up with, or use the form on the **Data Deletion** page of the FieldQuo website, which records the same request and emails you a reference straight away.",
            "Say which FieldQuo company the request concerns (your contracting business), that you are the account holder, the email the account is under, and whether you want everything deleted or something specific.",
            "Keep the reference you receive — it looks like **FQ-DEL-7K3M9Q**. Typing it into the Data Deletion page shows whether the request is received or completed, with the dates, and nothing else.",
          ] },
          { note: "A client of yours — a homeowner — can ask too, but for their records the company is the controller and FieldQuo is its processor. Their fastest route is to ask you, and you can delete their record from the product yourself if it carries no quotes or invoices. A request they send to FieldQuo about your records is passed on to you." },
        ],
      },
      {
        id: "what-happens-next",
        heading: "What happens next",
        blocks: [
          { bullets: [
            "**You get a confirmation** the moment the form is submitted, with the date received and your reference. If you emailed instead, a person replies with the same confirmation within 30 days.",
            "**A person deletes the data by hand**, against the database, within 30 business days of receiving the request. If your identity needs confirming first, we write to the address the request came from.",
            "**You get a second email when it is done**, with the date and the reference. Where something had to be kept, the email says so rather than quietly skipping it.",
            "**You can check on it any time** with the reference on the Data Deletion page. The status line shows dates and a status only, never who asked.",
          ] },
        ],
      },
      {
        id: "what-is-kept",
        heading: "What is kept, and why",
        blocks: [
          { bullets: [
            "**Unsubscribe and STOP records**, permanently. An opt-out is a standing instruction; deleting it would put the person back on a list.",
            "**Financial and tax records** a business is generally required to retain — invoices, payments and the accounting trail behind them. Where a request would remove one, the reply says so.",
            "**Records that belong to a contractor's business rather than to the person asking.** Where FieldQuo is only the processor, it passes the request on rather than deleting a company's data on a third party's instruction.",
            "**The record of the deletion request itself** — the reference, the address the confirmation went to, and the dates. It is the proof that you asked and that it was done.",
          ] },
        ],
      },
      {
        id: "what-you-can-delete-yourself",
        heading: "What you can delete yourself, today",
        blocks: [
          { bullets: [
            "**A client record** — only if that client has no quotes and no invoices. One with billing history is refused, because deleting it would orphan financial records you may have to keep.",
            "**Individual quotes, invoices, jobs, tasks, appointments, expenses, photos, marketing campaigns and subscriber records**, each from its own screen, subject to your access level.",
            "**A connected Meta ad account** — **Settings → Meta Ads → Disconnect** deletes the stored connection outright, encrypted token included. Imported spend totals stay, because they are your marketing history; say so in a written request if you want those gone too.",
          ] },
          { p: "Anything beyond that — an entire account included — is the written request above, handled by a person." },
        ],
      },
    ],
    faq: [
      { q: "Is there a button to delete my account?", a: "No. Deletion is a written request, carried out by hand within 30 business days, and confirmed by email. Cancelling the plan is self-serve; deleting the data is not." },
      { q: "If I cancel and never come back, is my data deleted eventually?", a: "No. Nothing expires on a schedule. The account becomes inaccessible after the 30-day read-only window, but the records stay until someone asks for them to be deleted." },
      { q: "Can I get a copy of everything before it is deleted?", a: "Download the accounting export and your invoices while the account is open; after the read-only window the account is locked and after deletion nothing can be recovered. Starting the plan again during the window reopens it." },
    ],
  },
};
