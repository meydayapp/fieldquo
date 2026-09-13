// content/help/en/billing-and-subscription-1.js
//
// Part 1 of the “billing-and-subscription” category in English (see the
// composer, billing-and-subscription.js). Slugs assigned to this part
// (lib/help/tree.js): your-plan-and-seats, the-four-plans, free-first-month,
// monthly-or-a-year-commitment, change-your-plan, add-a-seat-or-a-crew-login,
// update-your-payment-method, invoices-and-receipts-from-fieldquo.
//
// Every number here is read from lib/pricing/ladder.js (SEAT_LADDER,
// ANNUAL_FREE_MONTHS), lib/pricing.js (TRIAL_PRICE), lib/billing/access.js
// (GRACE_DAYS, CANCELLED_DAYS), lib/billing/renewalReminder.js
// (TRIAL_NOTICE_DAYS, RENEWAL_WINDOW_DAYS) and lib/referrals
// (REFEREE_BONUS_MONTHS); the behaviour from app/app/settings/account-billing,
// app/api/platform/billing/*, lib/platform/planChange.js and
// lib/platform/stripeBilling.js. Words on the screen are the `en` block of
// app/i18n/appMessages.js.
export const ARTICLES = {
  "your-plan-and-seats": {
    title: "Your plan and seats",
    summary:
      "The Account & Billing screen: which plan you are on, what it costs, how many seats and crew logins it includes, when the next charge lands, and the four buttons under it.",
    updated: "2026-09-12",
    intro: [
      "**Account & Billing** is the one screen about your company's relationship with FieldQuo — the plan, the price, the card, the next charge. Everything else in FieldQuo is about your clients' money; this page is about yours. It is reached from **Plan** at the bottom of the sidebar, or from **Settings → Account & Billing**.",
      "This article walks the screen top to bottom: the plan card and what each line on it means, the four buttons, and the **Plans** grid underneath. Changing plan, adding people and updating the card each have their own article, linked as you go.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Your company is on one of four plans — Solo, Crew, Shop or Scale — and the plan decides two numbers: how many **seats** you have (people who create or change quotes, jobs and invoices) and how many **crew** logins come free with them. Nothing else changes between plans: every feature is in every plan. See [[the-four-plans|The four plans]]." },
          { p: "The subscription is billed by Stripe on FieldQuo's behalf, in your own currency, monthly or on a one-year commitment. It is a separate Stripe relationship from the one your clients pay you through — that one lives on **Settings → Payments**, and the page gives you a shortcut to it so the two are never confused." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Account & Billing — the plan card with its status chip and the four buttons, then the Plans grid with the Monthly / 1 year commitment switch." },
          { p: "Under the heading **Account & Billing — Your plan, seats, and payment details.** the plan card reads, for example, **Crew · Active · $169.00/month · 3 seats · 8 crew included free · Next billing date 2026-09-30**. Each piece of that line is a fact from your subscription, and the table below says where it comes from." },
          { table: {
            head: ["On the card", "What it means"],
            rows: [
              ["The plan name (Solo, Crew, Shop, Scale)", "The tier you are on today. If a change is booked for a later date, this still names the plan you have now."],
              ["The status chip", "**Trial** during your free month, **Active** once you are paying, **Overdue** after a failed payment (a grace clock is running — see [[failed-payments-and-the-grace-period|Failed payments and the grace period]]), **Cancelled** after you leave."],
              ["The price", "Shown on the cadence you are actually billed on — **$169.00/month** on monthly, or the yearly figure with **/year** and **1 year commitment** if you took the year."],
              ["Seats and crew", "**3 seats · 8 crew included free** — the plan's allowance, not how many people you have. Manage Team shows the count you are using."],
              ["Days left in trial", "Only during the free month: **Days left in trial: 12**, counting down to the first charge."],
              ["Next billing date", "The day Stripe charges the card on file for the next period. Not shown during the trial, which shows the countdown instead."],
            ],
          } },
        ],
      },
      {
        id: "the-four-buttons",
        heading: "The four buttons",
        blocks: [
          { bullets: [
            "**Check with Stripe** — asks Stripe for the current truth about your subscription and writes it down. Press it if the page says **No active plan** right after you paid: checkout redirects faster than Stripe's confirmation sometimes arrives, and this button closes the gap. Nothing is charged by pressing it.",
            "**Manage billing & payment method** — opens Stripe's billing portal in the same tab: change the card, and read or download every invoice FieldQuo has issued you. You come back to this page when you close it. See [[update-your-payment-method|Update your payment method]].",
            "**See what my clients paid me** — a shortcut to **Settings → Payments**, the other Stripe: your own connected account, where the money your clients paid you lives. It is on this page because this is where people look for “my money”, but nothing about your subscription is there.",
            "**Cancel plan** — opens the cancellation flow. It asks why before it does anything; see [[cancel-your-subscription|Cancel your subscription]] for what happens to your access and your records.",
          ] },
          { note: "If a plan change is booked for the end of your period, an amber card appears between the plan line and the buttons: **Switching to Solo (billed monthly) on 2026-10-01 — Until then you keep Crew (billed monthly). Nothing is charged before that date.** Its **Keep my current plan** button undoes the booking. Details in [[change-your-plan|Change your plan]]." },
        ],
      },
      {
        id: "the-plans-grid",
        heading: "The Plans grid",
        blocks: [
          { p: "Under **Plans**, a **Monthly** / **1 year commitment** switch and one card per tier, each with its price, its seats and crew line, **FieldQuo AI included**, and a button. The card you are on reads **Current plan** and is greyed out; the others read **Choose plan**. With the switch on the year, your own tier's button reads **Switch to yearly** instead, because taking the commitment is a real change even though the tier is the same." },
          { p: "The switch starts on whatever you are already billed on, and flipping it only re-prices the cards — the plan line above does not move until you actually confirm a change. The grid shows the ladder in your currency only: Canadian dollars for a Canadian address, US dollars for a US one. A company whose address has no country sees a prompt to add it instead of a price list." },
          { tip: "Every card carries the words **1 seat · 5 crew included free**, **3 seats · 8 crew included free**, and so on. Compare that with the **seats used** line on **Manage Team** before you upgrade — the crew you already have may fit the plan you are on." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Only an **owner** or an **administrator** — the person who signed the company up, or anyone made an administrator with the **Make administrator** box on their access. Everyone else has no **Plan** row in the sidebar and no **Account & Billing** row in Settings, and typing the address shows a refusal, not the page. A Manager preset does not include billing, on purpose: running the day-to-day is not authority over the company's card." },
          { p: "The refusal is enforced by the server on every action, not only by hiding the buttons — a supervisor who posts to the billing routes directly gets **Only an owner or admin can change the plan or billing details.**" },
        ],
      },
    ],
    faq: [
      { q: "The page says No active plan but I paid a minute ago.", a: "Press **Check with Stripe**. The page also does this by itself when you arrive back from checkout, but a slow confirmation can beat it. Nothing is charged twice." },
      { q: "Why is there no Next billing date on my card?", a: "You are still in your free month, and the card shows **Days left in trial** instead. The first charge lands the day that count reaches zero." },
      { q: "Where is the money my clients paid me?", a: "Not here. Press **See what my clients paid me**, which opens **Settings → Payments** — your own connected Stripe account, payouts and fees. See [[payment-processing-fees-and-payouts|Payment processing fees and payouts]]." },
      { q: "Can my office manager open this page?", a: "Only if they are an administrator. Tick **Make administrator** on their access in **Manage Team**; that also lets them change the plan and the card, so give it to the person who genuinely pays the bill." },
    ],
  },

  "the-four-plans": {
    title: "The four plans: Solo, Crew, Shop, Scale",
    summary:
      "What each plan costs, how many seats and free crew logins it includes, what a seat actually is, and why nothing else differs between the four.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo sells four plans, and they differ by exactly three things: the monthly price, the number of seats, and the number of crew logins included free. Every feature — quoting, scheduling, invoicing, online payment, the website builder, FieldQuo AI, payroll — is in all four. There is no tier where the thing you need sits two rungs up.",
      "This article is the price list and the definitions behind it: what counts as a seat, what counts as crew, and how to tell which plan fits the people you actually have.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { table: {
            head: ["Plan", "Per month", "Per year (1 year commitment)", "Seats", "Crew logins, free"],
            rows: [
              ["Solo", "$99", "$990", "1", "5"],
              ["Crew", "$169", "$1,690", "3", "8"],
              ["Shop", "$269", "$2,690", "6", "11"],
              ["Scale", "$369", "$3,690", "10", "15"],
            ],
          } },
          { p: "The same number in either currency: a Canadian company pays these figures in Canadian dollars, a US company pays them in US dollars. Which currency you are billed in is decided by your business address, never by a picker — see [[taxes-and-currency-on-your-subscription|Taxes and currency on your subscription]]. The yearly price is ten months for twelve; see [[monthly-or-a-year-commitment|Monthly, or a one-year commitment]]." },
          { figure: "harness:plan", caption: "Account & Billing — the four plan cards, each with its seats and crew line, FieldQuo AI included, and Choose plan or Current plan." },
        ],
      },
      {
        id: "what-a-seat-is",
        heading: "What a seat is",
        blocks: [
          { p: "A **seat** is a person whose access lets them create or change money: quotes, jobs, invoices, or the requests that become quotes. The owner is always a seat. So are administrators, and anyone on the **Estimator**, **Dispatcher** or **Manager** presets, because each of those can write a quote." },
          { p: "A seat is counted from what the person can actually do, not from the name of their access level. If you start someone on Crew and then raise one dial above what Crew gets — say, let them create quotes — they become a seat, and **Manage Team** shows it. That is what keeps the count honest in both directions: a lead hand you promote is a seat, and a painter you never promoted is not." },
        ],
      },
      {
        id: "what-crew-is",
        heading: "What a crew login is",
        blocks: [
          { p: "A **crew** login is everyone else: the people in the van who see their own schedule, clock in and out, mark work complete, add photos and use the crew chat. They see no prices and cannot create quotes, jobs or invoices. Crew logins cost nothing and never use a seat — a Solo plan is one estimator and up to five people in the field for $99." },
          { p: "Free is not unlimited. Each plan includes a fixed number of crew places, and a crew member can also sit in a seat you are not using: Scale is 10 seats plus 15 crew, so a shop with two office staff and twenty technicians fits — two office and eight field people in seats, the remaining twelve in crew places. It only works that way round: a seat holder cannot be squeezed into a crew place." },
          { note: "The Crew preset is fixed on purpose — pick it and there is no grid to move. Anything above it is a seat, whichever way it was reached, so nobody can build a free estimator by hand." },
        ],
      },
      {
        id: "which-plan-fits",
        heading: "Which plan fits",
        blocks: [
          { steps: [
            "Count the people who price work or write invoices, including yourself. That is your seat count.",
            "Count everyone else who needs a login — the field crew. Those are crew logins.",
            "Pick the smallest plan whose seats cover the first number and whose seats plus crew cover the total. One estimator and four painters is Solo; three estimators and eight crew is Crew; a shop with six in the office and eleven in the field is Shop.",
            "More than ten seats, or more than twenty-five people in all, is beyond the plans sold online — the signup page says **Need more than Scale?** and asks you to get in touch.",
          ] },
          { tip: "FieldQuo AI — the copilot that answers questions about your own business — is included in every plan; the cards say **FieldQuo AI included**. Phone minutes for the receptionist and AI images are metered separately against credit you buy; see [[ai-credit-and-phone-credit|AI credit and phone credit]]." },
        ],
      },
      {
        id: "what-does-not-change",
        heading: "What does not change between plans",
        blocks: [
          { bullets: [
            "**Features.** All 76 features in FieldQuo's own feature list are marked available on every plan. There is no feature gate to unlock by upgrading.",
            "**Card and bank-debit fees.** The processing fee on a client's online payment is the same on every plan — see [[payment-processing-fees-and-payouts|Payment processing fees and payouts]].",
            "**White label.** Your quotes, invoices, booking page and emails carry your name and colours on every plan, not as an upgrade.",
            "**Support and the help centre.** The same for a Solo company as for a Scale one.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Can I buy one extra seat instead of moving up a plan?", a: "No. The four plans are the whole price list; when you have used every seat, the next plan up is the way to add one. **Manage Team** tells you which plan that is." },
      { q: "Does a deactivated person still use a seat?", a: "No. Only active members count — a deactivated account cannot write a quote, so it is not billed as one." },
      { q: "I have more seats in use than my plan includes. Am I locked out?", a: "No. The limit stops you adding another seat; it never removes one you already hold. Everyone keeps working, and Manage Team says **At your plan's limit** until you upgrade or demote someone to Crew." },
      { q: "Is anything cheaper in US dollars?", a: "No. The numbers are identical in both currencies, and your address decides which one you pay in." },
    ],
  },

  "free-first-month": {
    title: "Your first month is free",
    summary:
      "How the free month works at signup, why a card is taken anyway, what the screen shows while the trial runs, and exactly what happens on the day it ends.",
    updated: "2026-09-12",
    intro: [
      "Every new company gets its first month of FieldQuo free — the whole product, on whichever plan you chose, with no charge for 30 days. Your card is taken at checkout so that the plan simply continues when the month ends; nothing is charged until then, and the page says so in as many words.",
      "This article says what the trial is, what you see while it runs, when you are reminded, and what happens on day 30 — including if the card does not go through.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The free month is a Stripe trial on a real subscription. You pick a plan and a cadence on the last step of signup, enter a card on Stripe's checkout page, and the subscription starts in **Trial** status with a trial of 30 days. On the day the trial ends, Stripe charges the card for the first period — the monthly price, or the full yearly price if you took the commitment — and the status becomes **Active**." },
          { p: "It is free, not a token dollar: the offer on every screen reads **Free first month**, and no one-time line appears at checkout. A referral from another FieldQuo company adds a further month to the trial before the first charge — see [[referral-months|Referral months]]." },
        ],
      },
      {
        id: "how-it-works-at-signup",
        heading: "How it works at signup",
        blocks: [
          { figure: "harness:signup", caption: "Start your free trial — the four steps, and the card on the right that says the card is taken at checkout and the first charge lands when the free month ends." },
          { steps: [
            "Fill in **Your account and business** — name, email, company, address. The country in your address sets your billing currency.",
            "Choose your trades and services on steps 2 and 3.",
            "On **Choose your plan**, pick a tier and answer **How would you like to be billed?** — **No commitment** or **1 year commitment**. The line under it reads, for example, **Free first month, then $99.00/mo.**",
            "Press **Continue to Payment**. Stripe's page takes your card and billing address and shows the trial; you are not charged. You land in FieldQuo with the plan already live.",
          ] },
          { note: "A card is required to start the trial. That is a deliberate decision: it means the product keeps working on day 31 without a second checkout, and it is why the trial can be a full month of the real thing rather than a demo." },
        ],
      },
      {
        id: "what-you-see-during-the-trial",
        heading: "What you see during the trial",
        blocks: [
          { p: "On **Account & Billing** the plan card carries a **Trial** chip and, under the price, **Days left in trial: 23** counting down. There is no **Next billing date** yet — the countdown is that date. Everything else on the screen works as it will after the trial, including **Choose plan**: an upgrade during the free month takes effect right away and stays free until the month ends, because the trial is kept where it was. See [[change-your-plan|Change your plan]]." },
          { p: "You also receive one confirmation email when the subscription goes live, listing the plan, **Status: Free trial** and **Trial ends** with the date." },
        ],
      },
      {
        id: "when-the-month-ends",
        heading: "When the month ends",
        blocks: [
          { bullets: [
            "**Seven days before** the first charge, FieldQuo emails the owner a reminder naming the plan, the amount, the date, and the last four digits of the card if known. See [[renewal-reminders|Renewal reminders]].",
            "**On the day**, Stripe charges the card. The status chip turns **Active** and the card shows **Next billing date** one month (or one year) on.",
            "**If the charge fails**, the status becomes **Overdue** and a 7-day grace period starts: you can still read everything, but not add to it, until the card is fixed with **Manage billing & payment method**. After the seven days the account is locked to the billing screen until it is paid. Nothing is deleted at any point. See [[failed-payments-and-the-grace-period|Failed payments and the grace period]].",
          ] },
          { warning: "Cancelling during the free month stops the first charge, but it ends your access on the same terms as any cancellation — see [[cancel-your-subscription|Cancel your subscription]] before you press **Cancel plan** on day 29 expecting a free extra day." },
        ],
      },
    ],
    faq: [
      { q: "Is the first month really free, or is it $1?", a: "Free. The price of the first month is zero, the checkout shows no charge for it, and the signup screen reads **Free first month**." },
      { q: "Does the free month apply to the yearly plan too?", a: "Yes. The month comes first, then the year: no charge for 30 days, then the full yearly amount, and the year starts from that charge." },
      { q: "I was referred by another contractor — how long is my trial?", a: "30 days plus one referral month, and the reminder and the first charge move out with it. The confirmation after signup names the company that referred you." },
      { q: "Can I try it without a card?", a: "No. Signup takes a card at checkout before the trial starts. It is not charged until the free month ends, and you can cancel before then." },
    ],
  },

  "monthly-or-a-year-commitment": {
    title: "Monthly, or a one-year commitment",
    summary:
      "The two ways to pay: month to month with no commitment, or a year paid up front for the price of ten months — and what changing between them means.",
    updated: "2026-09-12",
    intro: [
      "Every plan can be paid one of two ways. **Monthly** is no commitment: the plan renews every month and you can leave at any time. **1 year commitment** is one charge for twelve months at the price of ten — two months free — in exchange for committing to the year.",
      "You choose at signup, and you can change your mind later from **Account & Billing**. This article gives the two prices side by side, explains the switch on the screen, and says plainly what the word commitment means once the year has been charged.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { table: {
            head: ["Plan", "Monthly", "1 year commitment", "Works out at", "You save"],
            rows: [
              ["Solo", "$99 a month", "$990 a year", "$82.50 a month", "$198 a year"],
              ["Crew", "$169 a month", "$1,690 a year", "$140.83 a month", "$338 a year"],
              ["Shop", "$269 a month", "$2,690 a year", "$224.17 a month", "$538 a year"],
              ["Scale", "$369 a month", "$3,690 a year", "$307.50 a month", "$738 a year"],
            ],
          } },
          { p: "The saving is stated as months rather than a percentage because that is what you can check in your head: pay for ten, get twelve. The plan cards say it in money — **Save $198 a year** under the Solo card, with **$82.50 a month** beneath the yearly price — and the same figures appear on the signup step as **Save $198 a year — two months free.**" },
        ],
      },
      {
        id: "the-switch-on-the-screen",
        heading: "The switch on the screen",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Account & Billing — the Monthly / 1 year commitment switch above the Plans grid re-prices every card; the plan line above it does not move until you confirm." },
          { p: "Above the **Plans** grid sits a two-position switch, **Monthly** / **1 year commitment**. It starts on the cadence you are already billed on, so a yearly company sees yearly prices first and is never quietly moved back to monthly by an upgrade. Flip it and the four cards re-price: the yearly view shows **$990/yr**, **$82.50 a month** and **Save $198 a year**." },
          { p: "With the switch on the year, the card for your own tier no longer reads **Current plan** — it reads **Switch to yearly**, because a monthly company taking the commitment is a real change. A tier with no yearly price would read **Not sold yearly**; all four plans sold online have one." },
        ],
      },
      {
        id: "how-to-take-the-commitment",
        heading: "How to move from monthly to the year",
        blocks: [
          { steps: [
            "Open **Account & Billing** and flip the switch to **1 year commitment**.",
            "Press **Switch to yearly** on your own tier (or **Choose plan** on another).",
            "Read the dialog. A cadence change at the same or a lower tier is booked for the end of your current month: **Your plan changes to Crew (billed yearly) on 2026-10-01. Until then you keep Crew (billed monthly). Nothing is charged today.** Press **Schedule the change**.",
            "The plan card now shows the amber **Switching to …** panel with **Keep my current plan** under it. On the date, Stripe charges the yearly amount and the year begins.",
          ] },
          { note: "Moving up a tier and to the year at the same time is an upgrade, so it applies today and the difference is prorated — the dialog says **Change plan now** instead. See [[change-your-plan|Change your plan]] for the full rule." },
        ],
      },
      {
        id: "what-commitment-means",
        heading: "What the commitment means",
        blocks: [
          { bullets: [
            "**The year is paid once, up front**, on the renewal date, in your currency, with tax added by Stripe where it applies.",
            "**Going back to monthly, or down a tier, waits for the year to end.** The change is booked for the end of the period and nothing is refunded, credited or charged before then — the same rule as a monthly downgrade, over a longer period.",
            "**Upgrading mid-year does not wait.** A higher tier applies today and the remainder of the year is prorated.",
            "**The free first month comes before the year**, not inside it: no charge for 30 days, then the full yearly amount.",
            "**Reminders arrive 30 days before** a yearly renewal, by email, naming the amount and the card. Monthly renewals get no reminder because a charge that recurs every month is not news — see [[renewal-reminders|Renewal reminders]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Is the yearly price a discount or just billing once?", a: "A discount: two months free. $990 for Solo against $1,188 for twelve monthly payments." },
      { q: "I took the year and want to leave after six months.", a: "The year has been charged and the commitment runs to its end date; switching back to monthly is booked for that date, and nothing is refunded before it. See [[cancel-your-subscription|Cancel your subscription]] for what cancelling does." },
      { q: "Will an upgrade move me back to monthly?", a: "No. The switch starts on your current cadence and an upgrade is bought on whatever the switch shows. Check it reads **1 year commitment** before you press **Choose plan** if that is what you want." },
    ],
  },

  "change-your-plan": {
    title: "Change your plan",
    summary:
      "Upgrades apply today and are prorated; downgrades and monthly-yearly switches are booked for the end of the period with nothing charged until then — and you can undo a booking.",
    updated: "2026-09-12",
    intro: [
      "You change plan from the **Plans** grid on **Account & Billing**. Which card you press and which way the cadence switch points decide one thing: whether the change happens now or at the end of what you have already paid for. The dialog tells you which before you confirm, in a sentence that comes from the same rule the server applies.",
      "The rule in one line: **up is now, down or sideways is later.** A shop that just hired two estimators needs the seats today; a company stepping down keeps the seats it paid for until the period ends, and is never refunded or re-charged in between.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { table: {
            head: ["The change", "When it applies", "What is charged"],
            rows: [
              ["Up a tier (Solo → Crew, Crew → Shop …), on either cadence", "Right away", "The difference for the rest of this billing period, prorated today"],
              ["Down a tier", "At the end of the current period — after the year, on a yearly plan", "Nothing today; the new price on the renewal date"],
              ["Same tier, monthly → yearly or yearly → monthly", "At the end of the current period", "Nothing today; the new amount on the renewal date"],
              ["Same tier, same cadence", "Nothing happens — the button reads **Current plan**", "—"],
            ],
          } },
          { p: "“Up” and “down” are decided by the ladder's order — Solo, Crew, Shop, Scale — not by the names, and a change of tier and cadence at once is judged on the tier: Solo monthly to Crew yearly is an upgrade and applies now." },
        ],
      },
      {
        id: "how-to-upgrade",
        heading: "How to upgrade",
        blocks: [
          { figure: "harness:plan", caption: "Account & Billing — the company is on Shop; Crew and Solo below it are downgrades, Scale is the one upgrade left." },
          { steps: [
            "Open **Account & Billing**. Check the **Monthly** / **1 year commitment** switch reads the cadence you want; it starts on the one you are on.",
            "Press **Choose plan** on the higher tier.",
            "The dialog **Change your plan** reads: **Your plan changes to Shop (billed monthly) right away. The difference for the rest of this billing period is prorated today.** Press **Change plan now**.",
            "The page reloads and reads the new plan off Stripe. The extra seats and crew places are usable immediately on **Manage Team**.",
          ] },
          { note: "During your free month an upgrade also applies right away, and stays free: the trial is kept exactly where it was and the new price starts when it ends." },
        ],
      },
      {
        id: "how-to-downgrade-or-switch-cadence",
        heading: "How to downgrade, or switch between monthly and yearly",
        blocks: [
          { steps: [
            "Press **Choose plan** on the lower tier, or flip the switch and press **Switch to yearly** on your own tier.",
            "The dialog reads: **Your plan changes to Solo (billed monthly) on 2026-10-01. Until then you keep Crew (billed monthly). Nothing is charged today.** Press **Schedule the change**.",
            "The page confirms **Done — your plan changes on 2026-10-01. Nothing is charged until then.** and an amber panel appears on the plan card: **Switching to Solo (billed monthly) on 2026-10-01** with **Keep my current plan** under it.",
            "On that date Stripe makes the switch on its own clock and invoices the new amount. Your plan name on the card changes then, not before, and you get the plan-changed email at that moment.",
          ] },
          { bullets: [
            "**Keep my current plan** releases the booking. The panel disappears and nothing about your subscription has moved.",
            "**Booking a second change** before the first lands replaces it — the later request is the one that stands.",
            "**Upgrading while a downgrade is booked** cancels the booking: the upgrade you chose today supersedes the step-down you had planned.",
          ] },
        ],
      },
      {
        id: "what-happens-to-your-people",
        heading: "What happens to your people on a downgrade",
        blocks: [
          { p: "Nobody is locked out. If the plan you step down to includes fewer seats than you are using, everyone keeps their login and keeps working; **Manage Team** shows **At your plan's limit** and the **Add a seat** button is disabled until you either upgrade again or move someone to Crew. The limit stops you adding a seat — it never takes one away." },
          { tip: "Before stepping down, read the seat and crew counts on **Manage Team** against the target plan's **seats · crew included free** line. See [[add-a-seat-or-a-crew-login|Add a seat, or a free crew login]]." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Who can change it",
        blocks: [
          { p: "Owners and administrators only. The routes behind **Choose plan**, **Schedule the change** and **Keep my current plan** all re-check that, so a Manager or Dispatcher who reaches the page by URL gets **Only an owner or admin can change the plan or billing details.** Every change is written to the Activity Log with who made it and when." },
        ],
      },
    ],
    faq: [
      { q: "I upgraded by mistake. Can I go straight back?", a: "You can book the step back down, and it lands at the end of the period; the prorated difference already charged for the upgrade is not refunded. Read the dialog before pressing **Change plan now**." },
      { q: "Why does my plan still say Crew after I chose Solo?", a: "Because you still have Crew until the date in the amber panel. The card names the plan you have today; the panel names the one that is coming." },
      { q: "Does changing plan create a second subscription?", a: "No. A company with a live subscription is moved in place. Checkout only opens for a company with no active plan — a new one, or one that cancelled and is coming back." },
    ],
  },

  "add-a-seat-or-a-crew-login": {
    title: "Add a seat, or a free crew login",
    summary:
      "The two Add buttons on Manage Team, what each one costs, how invitations work, what happens when the plan is full, and which plan you need next.",
    updated: "2026-09-12",
    intro: [
      "**Manage Team** has two doors for adding a person, because they cost different money: **Add crew — free** for someone who works in the field, and **Add a seat** for someone who prices work or writes invoices. Both land on the same **New User** form with a different starting point selected, and both end in an email invitation the person accepts to set up their own login.",
      "Joining a company is invite-only. There is no way for anyone to add themselves to your company; every member started as an invitation sent from this screen.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { figure: "live:app-settings-team", caption: "Manage Team — the seat panel (1 / 3 seats used, 0 / 8 crew — included free), the two Add buttons, and the roster beneath." },
          { p: "The panel at the top reads, for example, **1 / 3 seats used** and **0 / 8 crew — included free**, with a breakdown underneath (**1 Administrators**, **2 Crew** …). The first number of each pair is what you are using, counting pending invitations; the second is what your plan includes. Below the counts are the two buttons, and below them the roster with each person's access level." },
          { p: "A seat is anyone whose access lets them create or change quotes, jobs, invoices or requests — the owner, every administrator, and the **Estimator**, **Dispatcher** and **Manager** presets. Crew is everyone at or below the **Crew** preset. Full definitions in [[the-four-plans|The four plans]] and [[seats-and-crew-logins|Seats and crew logins]]." },
        ],
      },
      {
        id: "add-a-crew-login",
        heading: "Add a crew login (free)",
        blocks: [
          { steps: [
            "Open **Your team** in the sidebar (or **Settings → Manage Team**) and press **Add crew — free**.",
            "The **New User** form opens with the **Crew** preset already selected. Fill in their name, email and mobile number; the address and labour cost are optional.",
            "Leave the preset on **Crew** — it has no dials to move. Raising any permission above it turns the person into a seat, and the seat count will say so.",
            "Press **Send Invite**. They get an email with a link to set up their own login; until they accept, the roster shows them as **Invited** with **Cancel invite** beside them.",
          ] },
          { note: "Someone on the payroll who will never log in — a helper paid by the hour who does not need the app — does not need an invitation at all. Add them under **Workers** instead; see [[payroll-settings|Payroll settings]]." },
        ],
      },
      {
        id: "add-a-seat",
        heading: "Add a seat",
        blocks: [
          { figure: "create:app-settings-team-create", caption: "New User — personal details, then Permissions: Make administrator, the four presets (Crew, Estimator, Dispatcher, Manager) and Custom, and the grid beneath." },
          { steps: [
            "Press **Add a seat**. The form opens on the **Dispatcher** preset — the cheapest thing that is actually a seat. Pick **Estimator** or **Manager** if that fits better, or move individual dials; any change turns the preset into **Custom**.",
            "Tick **Make administrator** only for someone who should also see billing and everything else in the account. Administrators are seats too.",
            "Press **Send Invite**. The seat is counted from the moment the invitation exists, so a pending invite holds a seat until it is accepted or cancelled.",
          ] },
          { p: "Adding a seat costs nothing extra while your plan has one free: the plan price is flat, and **3 seats** means three people at $169. It costs money only when the plan is full and the next tier is the way to get another — see below." },
        ],
      },
      {
        id: "when-the-plan-is-full",
        heading: "When the plan is full",
        blocks: [
          { p: "The two doors close separately. When every seat is used, **Add a seat** is disabled and reads **You've used every seat on your plan.** on hover, while **Add crew — free** stays live; when every crew place is used it is the other way round. A crew member may also occupy a seat you are not using, so a Solo company with one seat and six crew is still within its allowance if the seat is free." },
          { p: "Next to a disabled button the page names the way out: **You've used all your seats. Crew covers 3 seats and 8 crew.** with an **Upgrade** link to **Account & Billing** for owners and administrators. Beyond Scale it reads **You've outgrown the plans we sell online — talk to us.**" },
          { warning: "The server refuses an invitation that would exceed the plan even if a button looks live — a second tab, a stale count. The refusal says which limit was hit and which plan fits. It never removes a person you already have: the limit gates adding, not holding." },
        ],
      },
      {
        id: "who-can-add-people",
        heading: "Who can add people",
        blocks: [
          { bullets: [
            "**Owners and administrators** can invite anyone at any level, change an existing person's access, and see the **Upgrade** link.",
            "**Managers and Dispatchers** can invite too, but only at the Worker tier — Crew or Estimator — and never with a dial higher than their own. They see **At your plan's limit** but no upgrade link, because the plan is not theirs to change.",
            "**Estimators and Crew** cannot open the form.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Does inviting someone charge my card?", a: "No. The plan price is flat. Adding people within the plan's seats and crew places changes nothing on your bill; going past them means choosing the next plan on **Account & Billing**, and that is the only charge." },
      { q: "I moved a crew member's dials and the seat count went up.", a: "That is the rule working: a seat is counted from what the person can do. Put them back on the **Crew** preset and the seat is freed." },
      { q: "Can I cancel an invitation to free the seat?", a: "Yes — **Cancel invite** on their row. The link stops working and the seat is released at once. Any worker record already on your books is kept." },
      { q: "Can someone sign up and ask to join my company?", a: "No. Joining is invite-only; the only way in is an invitation from this screen." },
    ],
  },

  "update-your-payment-method": {
    title: "Update your payment method",
    summary:
      "Change the card FieldQuo charges through Stripe's billing portal, and what happens the moment you come back — especially if a failed payment had put the account on hold.",
    updated: "2026-09-12",
    intro: [
      "The card on file is held by Stripe, never by FieldQuo, so it is changed on Stripe's own billing portal. One button on **Account & Billing** takes you there and brings you back: **Manage billing & payment method**.",
      "This article is the two-minute version of that trip, plus the one case where it matters most — a card that expired, a payment that failed, and an account counting down its grace period.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Your subscription is a Stripe subscription on a Stripe customer created for your company at your first checkout. The card, the billing address and the invoices all live on that customer. FieldQuo keeps none of the card details — not even the last four digits, which it asks Stripe for when it writes a renewal reminder." },
          { p: "The portal is Stripe's hosted page, opened in the same tab with a return link back to **Account & Billing**. When you come back, the page asks Stripe for the current state of the subscription straight away rather than waiting for a webhook, so a fixed card shows as fixed at once." },
        ],
      },
      {
        id: "how-to-change-the-card",
        heading: "How to change the card",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Account & Billing — Manage billing & payment method, the second button on the plan card, opens Stripe's billing portal." },
          { steps: [
            "Open **Account & Billing** — **Plan** at the bottom of the sidebar, or **Settings → Account & Billing**.",
            "Press **Manage billing & payment method**. The button reads **Opening...** and the tab moves to Stripe's portal, which shows your company's name.",
            "On the portal, add the new card under its payment-method section and make it the default; remove the old one if you want. Update the billing address there too if it changed — Stripe uses it to work out the tax on each charge.",
            "Use the portal's return link. You land back on **Account & Billing**, which reads **Checking with Stripe…** for a second and then shows the current state.",
          ] },
          { note: "The button needs a billing history to open — a company that has never been through checkout sees **No billing history yet — start a plan first**. Choose a plan on the same page and the portal works from then on." },
        ],
      },
      {
        id: "after-a-failed-payment",
        heading: "After a failed payment",
        blocks: [
          { p: "If a renewal charge fails, the plan card reads **Overdue** and the account goes read-only for 7 days: everyone can see their work, nobody can add to it. After seven days it is locked to the billing screen. Nothing is ever deleted — see [[failed-payments-and-the-grace-period|Failed payments and the grace period]]." },
          { p: "Fixing the card is the same trip as above. The difference is what happens when you return: because the lock is enforced when the app loads, the page reloads the whole app after checking with Stripe, so the sidebar comes back the moment the payment goes through rather than whenever a webhook happens to land. If you fix the card and the app still looks locked, press **Check with Stripe** on the billing page." },
          { tip: "The failed charge is an open invoice on the portal. Pay it there by hand with the new card if you do not want to wait for Stripe's next attempt; either way, the **Overdue** chip turns back to **Active** as soon as Stripe reports it paid." },
        ],
      },
      {
        id: "what-else-the-portal-does",
        heading: "What else the portal does",
        blocks: [
          { bullets: [
            "**Invoices and receipts** — every charge FieldQuo has made, downloadable as PDF. See [[invoices-and-receipts-from-fieldquo|Invoices and receipts from FieldQuo]].",
            "**Billing address and tax number** — the address decides the tax Stripe adds; a business number entered here appears on the invoices.",
            "**Not the plan.** Changing tier or cadence is done on **Account & Billing**, where the timing rule and the confirmation dialog live — see [[change-your-plan|Change your plan]]. Cancelling is **Cancel plan** on the same page, which asks why and tells you what happens to your records.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can do it",
        blocks: [
          { p: "Owners and administrators. The portal route refuses everyone else with **Only an owner or admin can change the plan or billing details.** — a supervisor who can invite people still has no business reading the company's payment history." },
        ],
      },
    ],
    faq: [
      { q: "The button says Could not open billing portal.", a: "Nothing about your plan has changed. Try again in a moment; if it keeps failing, the error banner says why, and support can see the same message on their side." },
      { q: "Can I pay by bank transfer or cheque instead of a card?", a: "No. The subscription is charged to a card on file through Stripe." },
      { q: "Does the new card take effect for the charge that already failed?", a: "The failed charge stays as an open invoice on the portal until it is paid — pay it there against the new card. Press **Check with Stripe** if the page has not caught up afterwards." },
    ],
  },

  "invoices-and-receipts-from-fieldquo": {
    title: "Invoices and receipts from FieldQuo",
    summary:
      "Where the invoice for each subscription charge lives, what it shows, which emails FieldQuo itself sends about your billing, and how not to confuse them with the invoices you send clients.",
    updated: "2026-09-12",
    intro: [
      "Every charge FieldQuo makes to your card — the monthly or yearly plan, and any top-up or migration payment — is a Stripe invoice on your company's Stripe customer. They are read and downloaded from Stripe's billing portal, reached from **Account & Billing**; FieldQuo does not keep a second copy in the app.",
      "This article says where to find them, what is printed on one, and which emails you get from FieldQuo about your subscription so you know which is which when the bookkeeper asks.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "FieldQuo bills you through Stripe Billing, in your own currency — Canadian dollars for a Canadian address, US dollars for a US one. Each period Stripe issues an invoice, charges the card on file, and marks the invoice paid; the paid invoice is the receipt. There is no separate FieldQuo-branded receipt email per charge." },
          { p: "These are the opposite direction from the invoices on your **Invoices** screen, which are yours to your clients and go through your own connected Stripe account. The two never mix: your subscription invoice is not in your accounting export, and a client's payment is never on your Stripe customer." },
        ],
      },
      {
        id: "where-to-find-them",
        heading: "Where to find them",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Account & Billing — Manage billing & payment method opens the Stripe portal where every subscription invoice is listed." },
          { steps: [
            "Open **Account & Billing** and press **Manage billing & payment method**.",
            "On Stripe's portal, open the invoice history. Each charge is listed with its date, amount and status.",
            "Open an invoice to view or download it as PDF. Send that to your bookkeeper; it is the document the bank line matches.",
            "Use the portal's return link to come back to FieldQuo.",
          ] },
          { note: "Only an owner or administrator can open the portal. If your bookkeeper is neither, download the PDFs and send them on — or make them an administrator, which also lets them change the plan and the card." },
        ],
      },
      {
        id: "what-an-invoice-shows",
        heading: "What an invoice shows",
        blocks: [
          { table: {
            head: ["Line", "Where it comes from"],
            rows: [
              ["**FieldQuo — Crew** (or Solo, Shop, Scale)", "The plan you were on for that period. After a scheduled change lands, the line names the new plan from that renewal."],
              ["The amount and currency", "The plan's monthly or yearly price in your billing currency — the same number you see on the plan card."],
              ["A prorated line", "Appears only on the invoice after a mid-period upgrade: the difference for the rest of that period."],
              ["Sales tax", "Added automatically by Stripe from the billing address on file; the rate is the jurisdiction's, not something FieldQuo sets. See [[taxes-and-currency-on-your-subscription|Taxes and currency on your subscription]]."],
              ["Your business tax number", "Printed if you entered it at checkout or in the portal; blank otherwise."],
              ["Billing address", "The address entered at checkout or updated in the portal."],
            ],
          } },
          { p: "A top-up of phone or AI credit, or a migration-service payment, appears in the same portal as its own one-off invoice, with its own line — see [[ai-credit-and-phone-credit|AI credit and phone credit]] and [[paying-for-the-migration-service|Paying for the migration service]]." },
        ],
      },
      {
        id: "emails-fieldquo-sends",
        heading: "Emails FieldQuo sends about your billing",
        blocks: [
          { bullets: [
            "**When a plan starts** — one confirmation naming the plan, **Status: Free trial** during the free month, and **Trial ends** or **Next billing date**. Sent once, however many times the page checks with Stripe.",
            "**When a plan change lands** — the same email, naming the previous plan and the new one, on the day the change takes effect.",
            "**Before the first charge** — seven days before a trial converts, with the amount and the card's last four digits if known. Yearly renewals get the same email 30 days ahead; monthly renewals get none. See [[renewal-reminders|Renewal reminders]].",
            "**When a payment fails** — the grace-period warnings, see [[failed-payments-and-the-grace-period|Failed payments and the grace period]].",
            "**When you cancel** — a confirmation with the date your access ends.",
          ] },
          { p: "None of these is an invoice. The invoice itself is in the portal, and any receipt email that arrives from Stripe's own address is Stripe's, not FieldQuo's." },
        ],
      },
    ],
    faq: [
      { q: "Can FieldQuo email me the invoice every month?", a: "Not from the app. The invoice is in the Stripe portal from **Manage billing & payment method**, downloadable as PDF." },
      { q: "Why does the invoice show tax when my own invoices to clients do not?", a: "They are two different sales. Stripe adds the tax that applies to FieldQuo selling to you, from your billing address. The tax on your invoices to clients comes from your own tax settings." },
      { q: "Is my subscription in the bookkeeping export?", a: "No. The export covers your clients' payments and your expenses. Record the FieldQuo invoice as a software expense from the PDF." },
    ],
  },
};
