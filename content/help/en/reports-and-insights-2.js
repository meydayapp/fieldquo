// content/help/en/reports-and-insights-2.js
//
// Part 2 of the “reports-and-insights” category in English (see the
// composer, reports-and-insights.js). Slugs assigned to this part
// (lib/help/tree.js): kpi-customer, the-metrics-fieldquo-refuses-to-invent,
// weekly-digests, the-monthly-digest-email, financial-statements,
// won-and-lost, estimate-accuracy, expense-tracking-and-burn-rate,
// import-expenses-from-a-bank-csv, overhead-and-your-minimum-price.
//
// Every definition below is read from the builder that computes the figure —
// lib/analytics/kpis.js, lib/analytics/winLoss.js,
// lib/analytics/estimateAccuracy.js, lib/accounting/statements.js,
// lib/analytics/burnRate.js, lib/analytics/minimumPrice.js,
// lib/expenses/csvImport.js and lib/ai/monthlyDigest.js — and the words on
// the screen from the `en` block of app/i18n/appMessages.js.
export const ARTICLES = {
  "kpi-customer": {
    title: "KPIs: Customer",
    summary:
      "The Customer section of the KPI dashboard: one satisfaction score out of 5, where the answers come from, the floor before a number is shown, and who can see it.",
    updated: "2026-09-12",
    intro: [
      "The **Customer** section sits near the bottom of **KPIs**, just above **Not tracked**. It carries one figure — **Customer satisfaction**, an average out of 5 — and a small bar chart of how the answers split by score. Every answer behind it came from a client who tapped a number in the review-request email after a job was finished.",
      "This article says exactly what the card averages, why it can show a dash instead of a number, and how a client's answer gets there in the first place.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "FieldQuo asks a client one question after a completed job — **How did we do?**, on a scale of 1 to 5 — and this card is the average of the answers for jobs completed in the period you picked at the top of the page. It is not a review score, not a Google rating, and not a guess: a client who was sent the survey and never answered is not counted at all." },
          { p: "The section's own subtitle says where the answers come from: “What clients say after the work is done — one question, sent alongside the review-request email.” The survey rides the same email as the review request, so a company that has not set up review requests collects no satisfaction data either." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Customer satisfaction** — the average, printed as **4.6 / 5**, with the number of answers under it (“9 jobs/quotes”). The hint reads: “Average of the one-question survey sent after a job. Only companies with a review link set today collect this — it rides the same email.”",
            "**Answers by score** — five bars, one per score from 1 to 5, with the count of answers beside each. It appears only once the average itself is shown.",
            "**“{count} of these rated 1 or 2 — worth a follow-up call.”** — an amber line under the bars whenever at least one answer was a 1 or a 2. That sentence is all FieldQuo does with a low score: no task, no text, no alert.",
          ] },
          { figure: "harness:kpis-cash", caption: "KPIs — the Cash, Customer and Not tracked sections at the foot of the dashboard; Customer satisfaction at 4.6 / 5 from 9 answers, split by score." },
        ],
      },
      {
        id: "how-an-answer-gets-here",
        heading: "How a client's answer gets here",
        blocks: [
          { steps: [
            "Open **Settings → Reviews**. Paste **Your review link**, switch on **Ask automatically**, and pick a delay under **When to ask** — from **2 hours later** to **A week later**. Without a review link nothing is sent, and so nothing is collected.",
            "Mark the job **completed**. Once the delay has passed, the client with an email address on file gets one review-request email from your company — never more than one per job, and never for a job that finished more than 30 days ago.",
            "The email carries a row of five numbered buttons. Tapping one opens a short page in your company's colours: **How did we do?**, the five scores, an optional comment, and **Send**. The page is in the language the email was sent in.",
            "Pressing **Send** records the score once. The link cannot be used to answer twice, and an email scanner opening it records nothing — only the **Send** press counts.",
          ] },
          { note: "The email and the survey page carry your logo and brand colour, not FieldQuo's. A client who has unsubscribed from your review requests is skipped, and so is never asked the question. Full detail on the email itself: [[review-requests|Review requests after a job]]." },
        ],
      },
      {
        id: "what-the-number-means",
        heading: "What the number means, exactly",
        blocks: [
          { table: {
            head: ["Question", "Answer"],
            rows: [
              ["What is averaged", "Every score from 1 to 5 recorded for a job completed inside the selected period. Rounded to one decimal."],
              ["What counts as a sample", "Answers only. A survey that was sent and never answered is not in the count and does not drag the average down."],
              ["The floor", "5 answers. Below that the card shows a dash and “{n} of 5 so far — {remaining} more and this becomes reliable.”"],
              ["No answers at all", "“No client has answered the satisfaction survey yet. Once 5 have, this shows here.”"],
              ["Low scores", "A 1 or a 2. Counted and named under the bar chart; nothing else is triggered."],
            ],
          } },
          { p: "The five-answer floor is the same one the dashboard uses for average job value and the margin figures: the average is the claim, and an average of three taps is an anecdote. The win-rate cards use a floor of ten because a percentage moves further on one flip; see [[the-kpi-dashboard|The KPI dashboard]] for the two floors." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The whole KPI page is all-or-nothing: it needs the **Job costing** toggle, **See prices**, and view access to quotes, jobs (company-wide), invoices and requests. Of the shipped access levels that means **Manager**, administrators and the owner. Crew, Estimator and Dispatcher do not see the **KPIs** row, and typing the address gives a refusal, not a page with one card missing. The satisfaction card adds no gate of its own." },
        ],
      },
    ],
    faq: [
      { q: "We have dozens of Google reviews. Why is the card empty?", a: "Reviews pasted into Settings → Reviews are testimonials for your website, not survey answers. This card only counts the 1-to-5 taps from the email FieldQuo sends after a job, and it needs five of them before it prints a number." },
      { q: "Can a client change their answer?", a: "Before pressing Send, yes — the page has a Change your answer link. After Send the score is recorded once and the link is spent; opening it again says the answer was already received." },
      { q: "Does a bad score tell anyone?", a: "No. The card prints how many answers were a 1 or a 2 and suggests a call. There is no notification, task or automatic message behind it." },
      { q: "Which period does a score belong to?", a: "The period the job was completed in, not the day the client answered. Switching from This quarter to Last month changes which jobs are in the count." },
    ],
  },

  "the-metrics-fieldquo-refuses-to-invent": {
    title: "The metrics FieldQuo refuses to invent",
    summary:
      "The Not tracked section at the foot of the KPI dashboard: the two figures FieldQuo deliberately does not compute, why, where the honest version of each lives, and the rule behind every dash on the page.",
    updated: "2026-09-12",
    intro: [
      "The last section of **KPIs** is called **Not tracked**, and its subtitle is the whole idea: “Metrics a dashboard like this usually carries, that FieldQuo does not invent numbers for.” Instead of a card with a plausible-looking percentage, you get the name of the metric and one paragraph on why there is no number under it.",
      "Two entries are there today. This article explains both, says where the honest version of each figure actually lives, and covers the wider rule the rest of the page follows: a card with no data shows a dash and a reason, never a zero.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Every figure on the KPI page is arithmetic over rows that exist — quotes, jobs, invoices, approved hours, logged expenses. When the rows a metric needs are typed by hand, carry no link to the thing they would be divided by, or simply are not recorded, the page says so rather than printing a number that looks precise and means nothing. The list has been shrinking as the data has arrived, and that is the point of it." },
          { p: "The two entries are written in the product's own words and, today, in English on every language's screen — they are not translated the way the card labels above them are." },
        ],
      },
      {
        id: "cost-per-lead",
        heading: "Cost per lead",
        blocks: [
          { p: "What the page says: the leads figure on a marketing-spend row is typed in by hand, and outside Meta lead forms no lead in FieldQuo carries a campaign id or a UTM value. A per-channel cost per lead built on a hand-typed denominator, with no way to attribute a lead to a channel, would look precise and mean nothing — so it is refused." },
          { bullets: [
            "**Per campaign, for Meta lead-form leads only** — the one path with an id on both sides, a synced spend row and a lead that came through a Meta form. That figure is real and it is shown on [[marketing-spend|Marketing spend]].",
            "**Blended, across everything** — total marketing spend for the month divided by every real lead from every live intake channel, with leads entered by hand or imported from a file left out of the denominator. That figure is in [[the-monthly-digest-email|The monthly digest email]], and it never claims which channel produced which lead.",
          ] },
        ],
      },
      {
        id: "equipment-utilisation",
        heading: "Equipment utilisation",
        blocks: [
          { p: "What the page says: FieldQuo now records which asset was on which job, so the data exists — but a yard's utilisation is not naturally a rate for one period the way the other cards are, and forcing it into one (“held 62% of days this month”) would invent a claim about how many days the compressor should have been in use, which nothing in the product states." },
          { note: "The entry says the figure lives as its own screen at Settings → Assets. Today no screen in FieldQuo reads that report. The **Assets & depreciation** register on **Settings → Overhead** shows what each item cost and what it is worth on the books, not how often it was used — see [[overhead-and-your-minimum-price|Overhead and your minimum price]]." },
        ],
      },
      {
        id: "what-used-to-be-here",
        heading: "What used to be on this list",
        blocks: [
          { p: "Three metrics left the list once the product had something honest to compute them from, and each is now a real card on the page:" },
          { bullets: [
            "**Rework and callback rate** and **change-order rate** — under **Quality**, once a visit could be marked as a return and a change of scope became its own record. See [[kpi-quality|KPIs: Quality]].",
            "**Customer satisfaction** — under **Customer**, once the one-question survey existed to ask and something existed to average. See [[kpi-customer|KPIs: Customer]].",
            "**Safety incident rate** — once incidents were recorded against approved hours. It prints only past 1,000 approved hours in the period.",
          ] },
        ],
      },
      {
        id: "the-rule-behind-every-dash",
        heading: "The rule behind every dash",
        blocks: [
          { table: {
            head: ["What you see", "What it means"],
            rows: [
              ["—, with “{n} of 10 so far — {remaining} more and this becomes reliable.”", "A rate — win rate, lead-to-quote conversion, on-time completion — with fewer than 10 decided cases. One flip would move it more than ten points."],
              ["—, with “{n} of 5 so far…”", "A central figure — average job value, margin, satisfaction — drawn from fewer than 5 jobs or answers."],
              ["—, with a plain sentence", "The rows the figure needs do not exist yet, and the sentence names which: no quotes decided, no completed jobs, no capacity set on Settings → Overhead, no invoices ever raised."],
              ["A number with an amber triangle", "Real, but knowably short — unrated hours, timesheets awaiting approval, materials ticked off the buy-list but never expensed. The note under the card says what is missing."],
              ["A real 0", "A real zero: nothing overdue, no backlog. Zero and unknown are different sentences and the page keeps them apart."],
            ],
          } },
          { p: "The same discipline runs through the other reports in this group: **Won and lost** prints “Too few to read” under ten decisions, **Estimate accuracy** prints counts but no percentage under five comparable jobs, and **Financial statements** prints “None recorded” or “Unavailable” rather than $0.00." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The same people as the rest of the page — **Manager**, administrators and the owner, because the KPI dashboard needs the **Job costing** toggle and refuses as a whole without it. See [[the-kpi-dashboard|The KPI dashboard]]." },
        ],
      },
    ],
    faq: [
      { q: "Can I turn the Not tracked section off?", a: "No. It is part of the page, and it is the honest answer to the two questions a contractor most often asks a dashboard. There is nothing to configure." },
      { q: "Will cost per lead per channel ever be tracked?", a: "Only if leads start carrying a source that can be tied to spend. Today that exists for Meta lead forms alone, and that per-campaign figure is already on the Marketing spend page." },
      { q: "Why does a card sometimes show a number with a warning triangle?", a: "Because the number is real but incomplete — some hours have no rate, or some timesheets are still awaiting approval. The triangle is FieldQuo refusing to average the gap away." },
    ],
  },

  "weekly-digests": {
    title: "Weekly digests",
    summary:
      "What the Weekly digests link on the Insights page opens — the Monthly Digest page — what each entry contains, and the plain fact that FieldQuo produces no weekly write-up today.",
    updated: "2026-09-12",
    intro: [
      "Under the title of **Insights** (the **How You Compare** page) sits a row of links to the rest of the reporting group. The first of them reads **Weekly digests**. It opens a page titled **Monthly Digest** — “Automated summaries of how your business performed each month.” The link's name is older than the page it opens.",
      "So, to be plain: FieldQuo does not write a weekly digest. Nothing runs weekly, nothing is emailed weekly, and there is no setting that would change that. What the link gives you is the list of monthly write-ups, and this article is about that list. The email each one sends is covered in [[the-monthly-digest-email|The monthly digest email]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Once a month, on the first, FieldQuo writes a short summary for every active company — three or four sentences from FieldQuo AI around a fixed set of numbers, plus any flags the code itself raised — files it under the month it covers, and emails it to the owner and administrators. The **Monthly Digest** page is the archive: every write-up the company has received, newest first, up to two years' worth." },
          { p: "The page shows more than the email does. The email carries the paragraph and the flags; the page adds the grid of numbers the paragraph was written from and, for months generated after the feature landed, the **Calls behind this month's decisions** section." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "One row per month, headed by the month and year in your own language (“August 2026”), with “{n} flags this month” in amber when the month raised any. The newest is open; the others expand on a tap.",
            "The **summary** — the AI-written paragraph. If the company was over its FieldQuo AI allowance that month, the paragraph is replaced by the allowance message and an italic line: “This month's AI summary was skipped — your FieldQuo AI allowance is used up. The numbers above are unaffected.”",
            "The **flags** — amber boxes. Today there is one rule: a quote acceptance rate under 30% for the month, with the change from the month before when there was a full month before.",
            "The **numbers** — a small grid of the figures handed to the model: revenue, expenses, margin, quotes created, quotes accepted, conversion rate, marketing spend, the real lead count and, when there is something to divide by, the blended cost per lead.",
            "**Calls behind this month's decisions** — when the company uses the AI receptionist or outbound calling, what was said on the calls linked to the month's won and lost quotes, or a sentence saying why nothing was read (no linked calls, allowance used up, AI not available on this deployment).",
          ] },
          { p: "Before the first full month there is nothing to show, and the page says so: “No digests yet — your first monthly summary will appear here after your first full month of activity.”" },
        ],
      },
      {
        id: "how-to-open-it",
        heading: "How to open it",
        blocks: [
          { steps: [
            "In the sidebar, under **Insights**, open **Insights**. The page is titled **How You Compare**.",
            "Under the subtitle, press **Weekly digests**. The **Monthly Digest** page opens with the latest month expanded.",
            "Tap any earlier month to expand it. There is nothing to generate by hand; the entries are written on the first of each month.",
          ] },
          { figure: "live:app-analytics-benchmark", caption: "Insights — How You Compare, with the row of links under the title: Weekly digests, Financial statements, Won and lost, Estimate accuracy, KPI dashboard." },
          { note: "The write-up itself is in English today, whatever your company's language: the month heading and the page's own words are translated, the AI paragraph and the flag sentences are not." },
        ],
      },
      {
        id: "what-weekly-means-today",
        heading: "What “weekly” means today",
        blocks: [
          { p: "Nothing. The label on the Insights page says **Weekly digests**; the page it opens, its heading, its empty state and the schedule behind it all say monthly. There is no weekly email, no weekly cadence to switch on, and no digest for a partial month. If you want a number more often than monthly, the **KPIs** page and the dashboard are live for any period you pick — see [[the-kpi-dashboard|The KPI dashboard]] and [[the-dashboard-in-detail|The dashboard in detail]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Insights** row in the sidebar is shown to anyone whose access includes prices (**See prices** on) — Estimator and above. The Monthly Digest page asks for nothing more than a signed-in member of the company. The email goes only to the owner and administrators, whoever can read the page." },
        ],
      },
    ],
    faq: [
      { q: "Can I switch the digest to weekly?", a: "No. There is no weekly digest and no setting for one. The link's label is the only weekly thing about it." },
      { q: "Can I generate this month's digest early?", a: "No. Digests are written on the first of the month for the month just ended. For a live view of the month in progress, use the KPI dashboard." },
      { q: "Why is a digest missing its paragraph?", a: "The company was over its FieldQuo AI allowance when it was generated. The numbers and flags are still there; only the AI-written sentences were skipped, and the page says so under the entry." },
    ],
  },

  "the-monthly-digest-email": {
    title: "The monthly digest email",
    summary:
      "The email FieldQuo sends owners and administrators on the first of each month: when it goes, who receives it, what is in it, which numbers it is written from, and what happens when the AI allowance is used up.",
    updated: "2026-09-12",
    intro: [
      "On the first of every month, at 8:00 UTC, FieldQuo writes a short summary for each active company and emails it to the owner and every administrator with an email address. The subject is **Your August summary** — the month just ended. The same write-up is filed on the **Monthly Digest** page, reached through the **Weekly digests** link on **Insights**.",
      "It is a short read on purpose: three or four sentences written by FieldQuo AI from a fixed set of numbers, then any flags the code raised. The model never calculates anything — every figure is worked out first and handed to it with the instruction to use only those numbers.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The digest is the one report in FieldQuo that comes to you rather than waiting to be opened. It is internal — sent to your team, never to a client — so it arrives from **FieldQuo** at digest@fieldquo.com rather than from your company's sender, and it is the only surface in this group that is signed by FieldQuo. The paragraph and the flags are in English today, whatever your company's language." },
          { p: "It is generated whether or not anyone is watching, for every company whose onboarding is complete. There is no switch to turn it off and no setting to change who receives it." },
        ],
      },
      {
        id: "what-is-in-it",
        heading: "What is in the email",
        blocks: [
          { bullets: [
            "**The paragraph** — “Write a 3–4 sentence monthly business summary… like a knowledgeable colleague giving a quick update, not a formal report.” That is the instruction the model is given, along with the numbers below and the flags.",
            "**The flags**, as a bulleted list, when there are any. Today one rule exists: the month's quote acceptance rate is under 30%. When the company had a full month before, the sentence also says whether that is up or down on it.",
            "Nothing else. The grid of numbers and the **Calls behind this month's decisions** section are on the Monthly Digest page only — see [[weekly-digests|Weekly digests]].",
          ] },
        ],
      },
      {
        id: "the-numbers-it-is-written-from",
        heading: "The numbers it is written from",
        blocks: [
          { table: {
            head: ["Figure", "Where it comes from"],
            rows: [
              ["Revenue, expenses, margin", "The dashboard's overview: paid invoices, logged expenses, and the difference."],
              ["Quotes created, quotes accepted, conversion rate", "The dashboard's overview. The previous month's conversion rate is included only when the company existed for the whole of that month — a half month is never compared against a full one."],
              ["Marketing spend", "Every spend row dated in the month just ended, across all channels. When a row in another currency was converted at a pinned rate, the model is told the figure is approximate."],
              ["Real lead count and blended cost per lead", "Leads that arrived in the month just ended from live intake channels — hand-typed and imported leads are left out — and marketing spend divided by them. Cost per lead is omitted entirely when there are no leads to divide by, never written as $0."],
            ],
          } },
          { warning: "The first four rows are read the way the dashboard reads them — for the calendar month in progress at the moment the digest is generated — and the digest is generated a few hours into the new month. Treat the revenue, expense, margin and quote figures in the email as a snapshot at that moment, not as the previous month's totals. Marketing spend, leads and the calls are the previous month's. For last month's real figures, use **Financial statements** or **KPIs** with **Last month** selected." },
        ],
      },
      {
        id: "when-the-ai-allowance-is-used-up",
        heading: "When the AI allowance is used up",
        blocks: [
          { p: "Every AI feature in FieldQuo checks the company's monthly allowance before it spends. If the digest finds the allowance already used, it still sends: the numbers cost nothing and are always real, so the email goes out with the allowance message in place of the paragraph, and the entry on the Monthly Digest page carries an italic note saying the summary was skipped. Nothing is silently dropped, and support can see which companies hit the cap. See [[ai-credit-and-allowance|AI credit and allowance]] for the allowance itself." },
        ],
      },
      {
        id: "who-receives-it",
        heading: "Who receives it",
        blocks: [
          { p: "The owner and every active administrator who has an email address. Managers, dispatchers, estimators and crew do not receive it, even though a Manager can read the same write-up on the Monthly Digest page. There is no per-person opt-out and no way to add a recipient short of making them an administrator." },
        ],
      },
    ],
    faq: [
      { q: "Can I change the day it is sent?", a: "No. It runs on the first of the month at 8:00 UTC for every company, and there is no setting for it." },
      { q: "Can I send it to my bookkeeper?", a: "Not from FieldQuo. Forward the email, or give them a Manager or administrator login; only administrators and the owner are on the list." },
      { q: "Why is the revenue in the email so low?", a: "Because it is read for the month in progress at the moment of sending, a few hours after the month turned. The Financial statements page with Last month selected has the real total." },
      { q: "Does the email go to clients?", a: "Never. It is an internal summary for your team, and the only thing in this group that is not white-labelled — it comes from FieldQuo, to you." },
    ],
  },

  "financial-statements": {
    title: "Financial statements",
    summary:
      "The profit and loss, cash flow, sales-tax summary and partial balance sheet FieldQuo builds from what it already records: the period and basis controls, what each line contains, why some lines say Unavailable, and who can open the page.",
    updated: "2026-09-12",
    intro: [
      "**Financial statements** arranges the rows FieldQuo already holds — invoices, payments, expenses, approved hours, pay runs, loans — into the four documents an accountant, a lender or a broker asks for. Its subtitle is the promise: “built from what FieldQuo already records. Every figure says what is inside it.” Nothing on the page is a new kind of number; every line can be opened to show what it is made up of, what it includes, and what it leaves out.",
      "It is reached from the **Financial statements** link under the title of **Insights**, and from **See the breakdown →** on the KPI page's Cash section.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page keeps two rules. First, the accounting basis is never implicit: you choose **Cash** or **Accrual** at the top, the choice is repeated as a full sentence above the figures, and the profit and loss names it again. Second, nothing renders as $0.00 unless zero is a fact — a line with nothing behind it reads **None recorded**, and a line FieldQuo cannot answer reads **Unavailable** with the reason, and contributes nothing to any total, which then reports itself **incomplete**." },
          { p: "Amended invoices are counted once, at the latest version's amount, dated from the original. A loan repayment is split the way a bookkeeper splits it: only the interest is a cost on the profit and loss; the principal is cash out and a smaller liability, never an expense." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "Five period buttons — **This month**, **Last month**, **This quarter**, **Year to date**, **Last year** — and a **From** / **To** pair for any other range. Days are counted in UTC.",
            "**Accounting basis** — **Cash** (the default) or **Accrual**. Under it, the basis sentence and “{from} to {to}, in {currency}.”",
            "On the accrual basis, an amber banner: costs on this statement remain cash-recorded, because FieldQuo has no supplier-bill ledger, so revenue is accrual and costs are cash — read the two halves accordingly.",
            "The four statements — **Profit and loss**, **Cash flow**, **Sales tax charged**, **Balance sheet (partial)** — each line with a chevron that opens **Made up of**, **Added up from**, **Includes**, **Does not include** and **Could not be included**.",
            "**Things that affect these figures** at the bottom: hours still awaiting approval, approved hours worked by someone with no rate, a recurring overhead cost that is stored as one row and so appears in one period only, and timesheets that cost more than the pay runs approved.",
          ] },
          { p: "A period with nothing in it at all — no payments, no invoices issued, no expenses, no approved hours, no pay runs — shows one sentence instead of four zeroed statements: that is an absence of records, not a period of zero activity." },
        ],
      },
      {
        id: "the-four-statements",
        heading: "The four statements",
        blocks: [
          { table: {
            head: ["Statement", "What it contains", "What it does not"],
            rows: [
              ["Profit and loss", "Revenue excluding tax; Materials, subcontractors and other job costs; Direct labour on jobs (approved hours at each person's rate); Cost of work done; Gross profit; Overhead (rent, insurance, vehicles, admin); Other operating costs; Wages not charged to a job (pay runs less the labour already on jobs); Loan interest; Net profit.", "Income tax, depreciation on vehicles and tools, owner drawings, loan principal."],
              ["Cash flow", "Money received (by method); Expenses paid; Wages paid (net of pay runs); Net movement from recorded activity; then, apart from it, the loan repayments the terms on file say are due, split into principal and interest.", "Cash at bank, opening and closing — FieldQuo holds no bank balance and no bank feed."],
              ["Sales tax charged", "Tax charged on invoices issued, tax inside the money actually received, and how many invoices charged tax, had it switched off, owed none, or say tax applies but charge none.", "Anything filed or remitted, tax paid on purchases, a GST/QST split, tax on refunds. The page says so in as many words: this is not a tax return."],
              ["Balance sheet (partial)", "Money owed to you (unpaid invoices, per invoice) and loans outstanding from the terms on file.", "Cash, fixed assets, stock, supplier bills, tax owed, equity and every total — shown as Unavailable, so the sheet states on its face that it does not balance."],
            ],
          } },
          { note: "Line labels and the reasons under an Unavailable line — “FieldQuo doesn't record this”, “Your access doesn't include everyone's pay” — are in English on every language's screen today. The headings, buttons and period names are translated." },
        ],
      },
      {
        id: "cash-or-accrual",
        heading: "Cash or accrual",
        blocks: [
          { p: "**Cash** counts revenue as money received in the period and cost as money spent in it; an invoice raised and not yet paid is not revenue. It is the basis most owner-operators file on, and every figure on it is backed by a payment or an expense that actually happened. **Accrual** counts an invoice in the period it was issued, paid or not — but only for revenue. FieldQuo has no supplier-bill record, so the cost side stays cash-recorded, and the page says so above the totals rather than calling a mixed statement accrual." },
          { tip: "Pick the basis your accountant files on and stay on it. A cash and an accrual statement for the same month legitimately show different revenue, and the first question anyone reading a statement asks is which one they are holding." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "A profit and loss is the company's whole cost basis with the revenue beside it, so the gate is the widest in this group: the **Job costing** toggle, **See prices**, company-wide **Expenses** access and the ability to manage users. Of the shipped levels that is **Manager**, administrators and the owner. Crew, Estimator and Dispatcher are refused." },
          { p: "A Manager sees the page without payroll: **Wages not charged to a job** and **Wages paid** read Unavailable — “Your access doesn't include everyone's pay” — and every total containing them says incomplete, rather than quietly showing a profitable month with the wage bill missing." },
        ],
      },
    ],
    faq: [
      { q: "Can I download or print the statements?", a: "Not from this page — there is no PDF or export button. For files to hand an accountant, use the Bookkeeping export on Expense Tracking, which produces CSVs of invoices, payments and expenses for a date range. See [[the-accounting-export|The accounting export]]." },
      { q: "Why does my March statement show no rent?", a: "A recurring overhead cost is stored as one row, dated once, and appears only in the period that row is dated in. FieldQuo does not synthesise twelve rent rows nobody entered. The warning at the foot of the page says how many recurring commitments are on file and how many fall in the period." },
      { q: "Why does the balance sheet not balance?", a: "Because it is partial and says so. FieldQuo does not know your bank balance, your fixed assets or your supplier bills, so total assets, total liabilities and equity are shown as Unavailable rather than as zero." },
      { q: "Why is a loan's interest Unavailable?", a: "The loan has no interest rate recorded on Settings → Overhead. A zero rate cannot be told apart from a rate nobody typed, so the line says which loan is missing one instead of booking $0 of interest." },
    ],
  },

  "won-and-lost": {
    title: "Won and lost",
    summary:
      "The sales report: what you sent, what you won and lost and for how much, how long clients take to answer, the reasons they gave in their own words, and the rules that decide when a percentage is printed.",
    updated: "2026-09-12",
    intro: [
      "**Won and lost** answers the question the win rate alone cannot: not just how often you lose, but why. Its subtitle says it — “What you sent, what came back, and — where anybody said — why it didn't. A win rate tells you that you are losing; the reasons tell you what to change.” FieldQuo has recorded a decline reason on every declined quote since the field existed; this page is where you finally read them.",
      "It is reached from the **Won and lost** link under the title of **Insights**. The win rate on the KPI page is the same calculation, so the two never disagree.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A quote belongs to the period it was **sent** in, not the period it was answered in — so “sent in June” always adds up, however long a client takes to say yes. Outstanding quotes are neither won nor lost: the win rate divides by decided quotes only, because counting every quote still under consideration as a loss would understate a busy month exactly when you are trying to read it." },
          { p: "Reasons are shown verbatim, newest first, and never sorted into categories. A lost quote with no reason is counted as its own number — “nobody said why” — never folded into “other” and never dropped so the remaining reasons can pose as the whole picture. At the volumes a small shop sends, the raw sentences are the report." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "The five period buttons, **From** / **To**, and the cohort note about sent dates.",
            "Four counts — **Sent** (“opportunities that left the building”), **Won**, **Lost**, **Still out** — the last three with the money under them: the accepted total for a win, the lowest price on the table for a loss or a quote still out.",
            "The **win rate**, “of {decided} decided quotes ({won} won, {lost} lost)”, or **None decided yet**, or **Too few to read** with the sentence that says why.",
            "**How long they take to answer** — days from send to decision, the typical (median) beside the average, and how many decisions were dropped for lacking a timestamp.",
            "**Why you lost them** — how many lost quotes have a reason recorded, how many are silent, then each reason with the quote number, client, date and value.",
            "**By whoever wrote the quote** — a table of **Who**, **Decided**, **Won**, **Win rate**, shown only when at least two people each have ten decisions.",
            "Three footnotes when they apply: quotes with no author, quotes placed by their decision date because they were never marked sent, and quotes with no date at all that belong to no period.",
          ] },
        ],
      },
      {
        id: "how-a-quote-is-counted",
        heading: "How a quote is counted",
        blocks: [
          { table: {
            head: ["Situation", "How the report treats it"],
            rows: [
              ["A Good / Better / Best trio", "One opportunity, not three. Won if any option was accepted; lost if one was declined and none accepted; otherwise still out. Its value is the accepted option's total, or the lowest option when nothing was accepted."],
              ["Accepted by hand after a phone call, never marked sent", "Counted, in the period of the decision, and named in a footnote. It is left out of time-to-decision, which needs a real send date."],
              ["No send date and no decision date", "In no period and in no figure — counted in a footnote. Most predate FieldQuo stamping those dates."],
              ["Decided before FieldQuo stamped decision dates", "In the counts; dropped from the time-to-decision average rather than counted as decided the same day."],
              ["Re-sent after the client had already answered", "Its decision lands before its send date, so it is unmeasurable and dropped from the average."],
            ],
          } },
        ],
      },
      {
        id: "recording-a-reason",
        heading: "Recording a reason",
        blocks: [
          { p: "Two doors write the reason. On the public approval page a client who declines can type why, and their words land here unedited. In the back office:" },
          { steps: [
            "Open the quote and its **Get this approved** page.",
            "Press **They declined**. A box opens: **Did they say why? (optional)**.",
            "Type what the client said, in their words, and press **Record as lost**. The quote shows **Reason recorded**.",
          ] },
          { tip: "When most of your losses are silent the page says so: “{n} of {lost} losses are silent. Nothing here can tell you why those went — the next one you lose, ask, and type what they say into the quote.” That sentence is the most useful finding the report can make until the reasons exist." },
        ],
      },
      {
        id: "the-floors",
        heading: "When a percentage is printed",
        blocks: [
          { bullets: [
            "**Ten decided quotes** before a win rate appears. At ten, one quote flipping moves the rate by ten points; below that the page shows the counts and “Too few to read” — “3 of 4” is honest at any size, “75%” is not.",
            "**Two people with ten decisions each** before the by-estimator table appears. One bucket is the company total with a name on it, not a comparison.",
            "**No percentages at all** in an empty period: “No quotes went out between {from} and {to}. That is not a 0% win rate — it is a period with nothing in it.”",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "Lighter than the other reports on purpose: it shows no cost, no margin and no wage, so it needs only view access to quotes and **See prices**. That is **Estimator**, **Dispatcher**, **Manager**, administrators and the owner — the estimator whose own quotes it is about is not locked out. Crew are refused." },
        ],
      },
    ],
    faq: [
      { q: "Why is my win rate different from the number of accepted quotes over the number sent?", a: "Because quotes still out are not losses. The rate is won over decided (won plus lost); the page prints the exact fraction under it." },
      { q: "Can FieldQuo group the reasons into price, timing and so on?", a: "No, deliberately. Three sentences sorted into categories is a pattern the report invented, not one it found. Read the reasons; they are short." },
      { q: "A client accepted the middle option of three. Are the other two counted as lost?", a: "No. The three options are one opportunity, and it is won." },
    ],
  },

  "estimate-accuracy": {
    title: "Estimate accuracy",
    summary:
      "How your finished jobs' cost estimates compare with what they actually cost — labour hours, labour cost and materials kept apart — with the floors, the tolerance band, the segments, and the data problems the page names before it names a percentage.",
    updated: "2026-09-12",
    intro: [
      "Job costing tells you that one kitchen ran long. **Estimate accuracy** tells you that every kitchen does. It takes the same estimate-against-actual comparison and runs it across every job completed in a period, split by direction and by dimension, because labour and materials go wrong for different reasons: labour runs over when the work took longer than the estimator thought, materials when the price book is stale or somebody bought the expensive primer.",
      "It is reached from the **Estimate accuracy** link under the title of **Insights**, and from **Full report →** on the KPI page's Execution card. No AI writes any of it: every sentence under **What the numbers say** is generated from the arithmetic that produced it.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "A job counts when it is **completed**, with a completion date inside the range — a job still running has costs still arriving and would look under budget every time. Archived jobs are included (archiving is filing, not cancelling); cancelled jobs are not. An invoice is not required: this measures cost estimating, not margin." },
          { p: "The headline of each card is the **median** of the per-job percentages, not the mean, so one catastrophic job cannot become the headline. The mean is printed beside it, and when the two sit more than 25 points apart the page names the job doing it. A job within **±5%** of its estimate counts as on target." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "Period buttons — **This quarter**, **Last 6 months**, **Year to date**, **Last 12 months**, **Last year** — and **From** / **To**. Longer presets than the other reports, because five comparable jobs take a while to accumulate.",
            "The scope line: “Jobs marked completed between {from} and {to}: {jobs}. Of those, {comparable} had both a saved cost estimate and enough recorded to compare against.” — and the floor: “A percentage is only shown where at least 5 jobs support it.”",
            "**What the numbers say** — the findings, loudest first: data problems, then the bias on each dimension, then any trade that runs differently from the rest.",
            "Three cards — **Labour hours**, **Labour cost**, **Materials and other job costs** — each with “{n} of {total} jobs comparable”, the median “on the typical job”, “{over} over, {under} under, {onTarget} on target”, **Average across the jobs**, **Total, estimated vs actual**, and the segments **By trade**, **By job size**, **By client** and **By crew member, on jobs they did alone**.",
            "**What is holding this report back** — counts of finished jobs with no saved cost estimate, with no expenses recorded, with timesheets still awaiting approval, hours worked by someone with no rate, and jobs covering more than one trade.",
          ] },
        ],
      },
      {
        id: "the-three-comparisons",
        heading: "The three comparisons",
        blocks: [
          { table: {
            head: ["Card", "Estimated", "Actual", "Why it is separate"],
            rows: [
              ["Labour hours", "The hours on the quote's saved cost estimate", "Approved hours logged against the job", "Estimating skill with the wage bill removed. An unrated worker or a raise cannot distort it."],
              ["Labour cost", "The labour cost on the estimate", "Approved hours at each person's rate", "Rate errors and hours errors both land here, so it is not the one to price from."],
              ["Materials and other job costs", "The estimate's materials", "Every expense tagged to the job — materials, subcontractors, dump runs, hire", "Expense categories are free text, so the actual side cannot be split finer than the job."],
            ],
          } },
          { p: "A job is excluded from a comparison — and the reason listed under the card — when either side is unknown: no saved estimate, no hours logged, timesheets awaiting approval, a worker with no rate (dropped from labour cost, kept in labour hours), or no expenses recorded at all. A finished job with no expense rows is not a job that spent nothing; scoring it as a 100% saving would be the most flattering lie the page could tell." },
        ],
      },
      {
        id: "what-the-findings-say",
        heading: "What the findings say",
        blocks: [
          { bullets: [
            "**Critical** — approved hours worked by someone with no hourly rate on file, named. Those hours cost nothing in FieldQuo and would drag the whole period toward under budget; set the rate under **Your team** and the jobs rejoin the report.",
            "**Warning** — hours awaiting approval, jobs with no saved estimate (“Fill in Cost & margin on a quote before you send it”), jobs with no expenses.",
            "**Insight** — a bias consistent enough to be a pricing habit (seven jobs in ten landing the same side), or one trade running more than ten points away from another: “a single company-wide correction would overprice one and leave the other short.”",
            "**Info** — a thin sample (“5 is the fewest this report will draw a percentage from. 2 more and it will.”), an on-target dimension, or a mean pulled away from the median by one named job.",
          ] },
          { note: "The finding sentences are generated in English on every language's screen today; the headings, labels and period names around them are translated." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Job costing** toggle and company-wide job access — the cost basis itself. **Manager**, administrators and the owner see it; Crew, Estimator and Dispatcher are refused, and a member confined to their own jobs is refused rather than shown a company roll-up built from a third of the evidence." },
          { p: "Two segments are gated on their own and are absent rather than empty for whoever lacks them: **By client** needs the client book, and **By crew member** needs everyone's time — the page prints “your access level doesn't include…” in their place." },
        ],
      },
    ],
    faq: [
      { q: "Why does the KPI page show one estimate-accuracy number and this page three?", a: "The KPI card is the median variance of the labour-cost comparison for the same period. This page keeps hours, cost and materials apart because they are fixed differently." },
      { q: "My jobs all ran over but the page shows no percentage.", a: "Fewer than five were comparable. The counts are still printed — “3 over, 0 under, 0 on target” — because three jobs agreeing is an observation about three jobs, not a rate." },
      { q: "Does a job need an invoice to be counted?", a: "No. Costs are settled whether or not the paperwork went out. It needs a saved cost estimate on the quote and approved hours or expenses on the job." },
    ],
  },

  "expense-tracking-and-burn-rate": {
    title: "Expense tracking and your burn rate",
    summary:
      "The Expense Tracking screen: the month's four cards, what monthly burn rate is built from, why Runway shows a dash, the AI Summary, the breakdowns and the trend, how to add an expense and what each field changes, and who can see the company roll-up.",
    updated: "2026-09-12",
    intro: [
      "**Expense Tracking** is “Where your money goes — by job, overhead, and category — plus your monthly burn rate.” It is the same screen whether you open **Expenses** under Money in the sidebar or **Expense Tracking** under Getting paid in Settings: one month at a time, four cards across the top, then the breakdowns, the six-month trend, the recent receipts and the bookkeeping export.",
      "This article is that screen and the **Add Expense** form. The bank-statement importer has its own article, [[import-expenses-from-a-bank-csv|Import expenses from a bank CSV]], and the export its own, [[the-accounting-export|The accounting export]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "An expense in FieldQuo is one dated amount with a category, optionally tied to a job, flagged as overhead, marked recurring, or attached to a vehicle. Those four choices decide where it shows up: on the job's costing and in estimate accuracy, in the burn rate, on the vehicle's running cost, or simply in the month's total. The screen is a month's worth of those rows, added up in the ways a contractor asks about them." },
          { figure: "live:app-settings-expense-tracking", caption: "Settings → Expense Tracking — the month stepper, the four cards, AI Summary, the two breakdowns, the 6-Month Trend, Recent Expenses and the Bookkeeping export." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Import from bank CSV** and **Add Expense** at the top right, and a month stepper (**Previous month** / **Next month**).",
            "**Tracked expenses this month** — every expense dated in the month, whatever its category or association.",
            "**Monthly burn rate** — “Overhead + salaries + debt”: what the business costs to run for a month, from the registers on **Settings → Overhead**. It does not change with the month you are viewing.",
            "**Runway** — months of cash at that burn rate. It reads **—** with **Add cash on hand to estimate**: today there is nowhere in FieldQuo to enter cash on hand, so the card stays a dash. FieldQuo holds no bank balance and no bank feed.",
            "**Job-related spend** — expenses tied to a job this month, with **Overhead {amount} · General {amount}** under it for the other two kinds.",
            "**AI Summary** — a button, **Generate summary**, that writes a plain-language paragraph about the month's spending in your language. See below.",
            "**Monthly Burn Breakdown** — **Overhead**, **Salaries**, **Debt payments** as bars, and **Manage salaries & debt** to the Overhead page.",
            "**Spend by Category** — this month's categories, largest first, with each one's share.",
            "**6-Month Trend** — a bar per month, this month last.",
            "**Recent Expenses** — the twenty newest rows across all months, each tagged **Overhead** or **Job-linked**, with a delete icon.",
            "**Bookkeeping export** — a date range as CSVs for your accountant.",
          ] },
        ],
      },
      {
        id: "how-to-add-an-expense",
        heading: "How to add an expense",
        blocks: [
          { steps: [
            "Press **Add Expense**.",
            "Pick a **Category** — Materials, Fuel & Vehicle, Tools & Equipment, Insurance, Rent & Utilities, Software & Subscriptions, Marketing, Permits & Licensing, Office Supplies, Meals & Travel, or **Other** with a **Custom category name**. Categories are free text underneath; anything already in your data shows in the breakdown even if it is not on the list.",
            "Enter the **Amount** and the **Date**.",
            "Choose **Associate with**: **General**, **A job** (then **Select a job…**), or **Overhead**.",
            "Tick **Recurring (feeds burn rate below)** if it is a standing cost, and pick **Weekly**, **Monthly** or **Yearly**.",
            "Optionally pick a **Vehicle** and add **Notes**, then press **Add Expense**.",
          ] },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "What each control changes",
        blocks: [
          { table: {
            head: ["Control", "What it changes"],
            rows: [
              ["Associate with → A job", "The amount lands on that job's costing and in Estimate accuracy's materials comparison, and is counted in Job-related spend. Job costing reads expense rows only — a purchase ticked off the job's buy-list and never entered here is invisible to it."],
              ["Associate with → Overhead", "The row is tagged Overhead, counted in the Overhead figure under Job-related spend, and, when also recurring, feeds the burn rate."],
              ["Recurring + frequency", "The row is treated as a standing monthly cost: weekly × 4.33, yearly ÷ 12. It appears in the burn rate, in cost per job on Settings → Overhead, and in the Fixed costs register there — they are the same rows. It is still dated once, so the statements and the month's total count it in one month only."],
              ["Vehicle", "The amount is charged to that vehicle's running cost on Vehicles."],
              ["Delete (the bin icon)", "Removes the row at once, with no confirmation, and every figure built from it changes straight away."],
            ],
          } },
        ],
      },
      {
        id: "the-burn-rate-and-the-ai-summary",
        heading: "The burn rate and the AI Summary",
        blocks: [
          { p: "The burn rate is cash: recurring overhead expenses at their monthly equivalent, plus the **Salaries** rows on Settings → Overhead (an hourly overhead wage needs hours per week or it contributes nothing), plus every active loan's full **Monthly payment**. Depreciation is not in it, because it moves no money. The cost figure the minimum price uses is different — see [[overhead-and-your-minimum-price|Overhead and your minimum price]]." },
          { p: "**Generate summary** sends the month's figures — the total, the category and association breakdowns, the burn rate and its parts, the runway, the six-month trend — to FieldQuo AI with the instruction to use only those numbers, and prints three or four sentences in your language. Under them, flags the code raised on its own: runway under three months (never, while cash on hand cannot be entered), one category at 40% or more of the month, or a month 15% or more above or below the one before. It is written on demand, not stored, and it is cleared when you change month." },
          { note: "The button counts against the company's monthly FieldQuo AI allowance and is refused, with the allowance message, once that is used up. Only owners, administrators and Managers can press it." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The roll-up — the cards, the breakdowns, the trend — needs company-wide **Expenses** access (“everyone's”): **Manager**, administrators and the owner. The **Expenses** row and the Settings row are both hidden from anyone below that. Crew, Estimator and Dispatcher can still record their own expenses on their own screens and see only their own rows; they are not shown this page." },
        ],
      },
    ],
    faq: [
      { q: "How do I fill in Runway?", a: "You cannot today. The card asks for cash on hand and no screen in FieldQuo accepts it, so Runway stays a dash. Monthly burn rate is the number that is real." },
      { q: "I added rent as a normal expense. Why is the burn rate still $0?", a: "Only rows marked Recurring with a frequency, and flagged Overhead, feed the burn rate. Add rent once as Recurring / Monthly / Overhead — or under Fixed costs on Settings → Overhead, which writes the same row." },
      { q: "Why does the burn rate not change when I step to another month?", a: "It is built from the standing registers, not from that month's receipts. Tracked expenses this month and the breakdowns follow the month; the burn rate is what the business costs every month." },
      { q: "Is the AI summary saved anywhere?", a: "No. It is generated when you press the button and shown on the page; the monthly digest is the write-up that is stored and emailed." },
    ],
  },

  "import-expenses-from-a-bank-csv": {
    title: "Import expenses from a bank CSV",
    summary:
      "How to bring a bank-statement export into Expense Tracking: the file FieldQuo accepts, mapping the columns, the sign and date questions it asks, the review step where nothing is saved yet, what the imported rows become, and what stops a duplicate.",
    updated: "2026-09-12",
    intro: [
      "Instead of typing a month of receipts, export a statement from your bank as a CSV and press **Import from bank CSV** on **Expense Tracking**. FieldQuo reads the file, asks you which column is which, shows every row it intends to create, and writes nothing until you press **Import {n} expenses**. There is no bank connection: FieldQuo holds no bank credentials and no bank feed, so the CSV is the whole path.",
      "The importer is built to refuse rather than guess. A date column that could be read day-first or month-first stops and asks; a deposit is skipped as “not an expense” rather than booked as a negative cost; a row that matches something already recorded is excluded as a duplicate.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "The page is titled **Import expenses from a CSV** — “Upload a bank statement export, map its columns, and review every row before anything is saved.” Three steps: upload, map, review. The browser reads the file only to show you the headers and a few sample rows; the server reads it again to build the review list, so what the browser shows is never trusted as the record of what will be created." },
          { p: "A file is a plain .csv of up to **5,000** rows — a few years of a small contractor's statements. Above that the first rows are read and the page says to split the rest into a second file. A spreadsheet renamed to .csv, an empty file, or a file with headers and no rows each gets its own message." },
        ],
      },
      {
        id: "the-three-steps",
        heading: "The three steps",
        blocks: [
          { steps: [
            "**Choose a CSV file** or drag one in.",
            "**Map the columns.** Each column of the file gets a dropdown: **Date**, **Description**, **Amount**, **Debit (money out)**, **Credit (money in)**, **Category** or **Skip**. FieldQuo pre-fills obvious headers, but **Continue (n/3)** enables only once Date, Description and an amount — a single Amount column or a Debit column — are mapped.",
            "Answer the sign question: “In this file, money going out (an expense) shows as:” **Negative numbers, like -45.00** or **Positive numbers, like 45.00**. The pre-selected answer comes from counting the sample values; it is a default, not a decision.",
            "Check **Detected date format**. If the dates could be read either way, pick **Day first — 13/01/2024 is 13 January** or **Month first — 01/13/2024 is January 13**. If the dates are not recognised at all, the page says so and stops.",
            "Set a **Default category** — used for rows with no category column or a blank category cell — and continue.",
            "**Review before importing.** “Nothing is saved yet — uncheck any row you don't want, and assign a job where it applies.” Each row has a checkbox and a **Job** dropdown; the counts read “ready to import”, “excluded as duplicates”, “couldn't be read”, “deposits, not expenses”.",
            "Press **Import {n} expenses**. The page confirms “Imported {n} expenses.” with **Back to Expense Tracking** and **Import another file**.",
          ] },
          { figure: "live:app-settings-expense-tracking", caption: "Expense Tracking — Import from bank CSV sits beside Add Expense at the top; imported rows land in Recent Expenses and the month's figures." },
        ],
      },
      {
        id: "what-the-review-decides",
        heading: "What the review decides about each row",
        blocks: [
          { table: {
            head: ["Row status", "What it means", "What happens"],
            rows: [
              ["Ready to import", "A date, a description and an outflow under the sign convention you confirmed.", "Created when you press Import, unless you untick it."],
              ["Possible duplicate", "Same date, same amount and the same description (ignoring case, accents and spacing) as an expense already recorded for the company from any source — or as an earlier row in the same file.", "Excluded. The badge names it; it is not written."],
              ["Deposits, not expenses", "A credit under the sign convention — an inflow. The normal shape of a bank statement, not a mistake.", "Skipped. **Show the {n} skipped rows** lists them."],
              ["Couldn't be read", "A blank or unparseable date or amount on that one row.", "Skipped. **Show the {n} rows that couldn't be read** lists them with the reason."],
            ],
          } },
          { p: "Amounts are read in the shapes banks export: “$1,234.56”, “(125.50)”, “125.50-”, “1.234,56”. Currency symbols and codes are stripped; the last separator in a value is taken as the decimal point." },
        ],
      },
      {
        id: "what-the-rows-become",
        heading: "What the imported rows become",
        blocks: [
          { bullets: [
            "One expense per row, dated from the statement, with the description as its notes, the file's category or your default category, and the job you picked in the review (or none).",
            "**One-time, never recurring**, and not flagged Overhead. A statement is twelve separate rent payments, not a declaration about every future month; importing them as recurring would count one rent twelve times in the burn rate. The page says so: “To have a recurring bill like rent feed the monthly burn-rate KPI, add it separately under Settings → Overhead.”",
            "Written once. A slow response and a second click cannot double the batch — the review session carries one key, and a repeat says “This file was already imported — nothing new was written.”",
            "Re-checked at the moment of writing: “{n} more matched a transaction recorded since you opened this review and were skipped.”",
            "One Activity Log entry for the whole batch, not one per row.",
          ] },
          { warning: "Rows are matched on date, amount and description. Two genuinely separate $45.00 fuel stops at the same station on the same day will look like one to the importer; untick nothing, and add the second by hand if the badge is wrong." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Who can do it",
        blocks: [
          { p: "Importing needs the same access as recording an expense — the level that lets a person add their own — so anyone with an **Expenses** dial above **none** can run the importer. The button lives on **Expense Tracking**, which is shown only to **Manager**, administrators and the owner (company-wide Expenses access); the page it opens does not ask for more." },
        ],
      },
    ],
    faq: [
      { q: "Can FieldQuo connect to my bank directly?", a: "No. There is no bank feed and FieldQuo never holds bank credentials. Export a CSV from your bank and import it; duplicate detection ignores where a row came from, so re-importing an overlapping statement later creates nothing twice." },
      { q: "The file uses a Debit and a Credit column. Which do I map?", a: "Map both. Debit rows become expenses; Credit rows are skipped as deposits. If the file has a single signed Amount column instead, map that and answer the sign question." },
      { q: "Can I import materials against a job?", a: "Yes — pick the job in the Job dropdown on the review step. The row then counts on that job's costing and in Estimate accuracy." },
      { q: "Why were my dates a month off?", a: "They cannot be, by design: when day and month cannot be told apart from the values, the importer stops and asks. If the file mixes shapes, it refuses the column and says so." },
    ],
  },

  "overhead-and-your-minimum-price": {
    title: "Overhead and your minimum price",
    summary:
      "Settings → Overhead: the jobs-per-week capacity and target margin that turn your fixed costs into a cost per job and a minimum price, the five registers that feed it, the unabsorbed-labour panel, where the number is used, and who can see it.",
    updated: "2026-09-12",
    intro: [
      "**Overhead** is “Fixed monthly costs. These, divided by how many jobs you can take on, are the lowest price a job can go out at and still cover the business.” It is the number a contractor most wants and least often has, and it is deliberately not guessed: until you say how many jobs a week you can take on, the page shows the registers and no price.",
      "The page is under **Services & Pricing** in the Settings menu. This article is the page top to bottom; the pricing rule itself, and why it uses cost rather than cash, is also in [[the-break-even-price|The break-even price]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Overview",
        blocks: [
          { p: "Everything on this page is one sum: what a month of trading costs, divided by the jobs you do in a month, marked up by your target margin. The cost side is read from five registers on the same page — fixed costs, salaries, debt, assets, bills — and from nothing else; there is no industry average and no rule of thumb anywhere in it. Change a register and the price changes straight away." },
          { figure: "live:app-settings-overhead", caption: "Settings → Overhead — Your minimum price with Jobs per week and the four tiles, then Paid hours that never reached a job, and the registers below." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "What is on the screen",
        blocks: [
          { bullets: [
            "**Your minimum price** — “How many jobs can your crew take on in a normal week?” with **Jobs per week**, **Target margin %** (placeholder **20 (default)**) and **Save**. Until capacity is set: “Tell us how many jobs a week you can take on and we'll work out your minimum price. Without it there's nothing to divide your overhead by.”",
            "Four tiles — **Monthly fixed costs**, **Jobs / month**, **Cost per job**, **Minimum price** — and under them the sentences that account for the total: “Includes {fixed} fixed costs + {salaries} salaries + {debt} debt payments”, the depreciation and loan interest it also includes, the actual cash leaving the bank and why it differs, and “At a {pct}% target margin. This covers overhead only — materials and labour for the specific job are on top.”",
            "**Paid hours that never reached a job** — the last 30 days of guaranteed weeks against hours logged on jobs: **Unabsorbed labour**, **Unabsorbed hours**, and a row per worker (**Worker**, **Scheduled**, **On jobs**, **Unabsorbed**, **Cost**).",
            "**Fixed costs** — “Rent, insurance, your phone bill, subscriptions — anything that arrives every month whether or not you win a job.” Name, **Amount**, weekly / monthly / yearly, **Add fixed cost**.",
            "**Salaries** — business overhead only: your own draw, an office wage. **Amount** with weekly / monthly / yearly / hourly (**Hours / week**, **Rate / hr**). Not used to pay anyone — an employee's pay comes from Manage Team and appears in Payroll.",
            "**Debt** — loans and finance agreements: **Principal**, **Monthly payment**, **Interest rate (% a year)**, **Add Debt**.",
            "**Assets & depreciation** — the truck, the trailer, the spray rig: **What it cost**, **Worth at trade-in (optional)**, **How many months will it last?**, **In service from**, **Bought with which loan?**, **Sold or written off today**, **Add asset**.",
            "**Bills due** — **Outstanding**, **Out this month**, **Overdue**, each bill with **Due {date}** and **Mark paid**, **Add bill**.",
          ] },
        ],
      },
      {
        id: "how-the-price-is-worked-out",
        heading: "How the price is worked out",
        blocks: [
          { steps: [
            "**Jobs / month** = **Jobs per week** × 4.33.",
            "**Monthly fixed costs** = recurring fixed costs at their monthly equivalent + salaries + depreciation on assets in service + loan interest on loans linked to an asset + the full payment on loans linked to nothing.",
            "**Cost per job** = Monthly fixed costs ÷ Jobs / month.",
            "**Minimum price** = Cost per job ÷ (1 − target margin). The default margin is 20%; the field accepts 0 to 95.",
          ] },
          { p: "The cost figure is not the cash figure, and the page prints both. Cash counts the whole loan payment and nothing for wear; cost counts the wear (depreciation) and only the interest on a loan that bought an asset, because repaying capital is not an expense. A floor built on cash double-charges the truck while the loan runs and loses it the month the loan ends — which is how a contractor quietly drops below break-even. The **Monthly burn rate** on Expense Tracking is the cash figure; **Monthly fixed costs** here is the cost figure." },
          { warning: "An asset with no loan linked beside a loan with no asset linked triggers the page's own warning: if they are the same truck you are charging it twice. Link them with **Bought with which loan?** and the loan drops to interest only." },
        ],
      },
      {
        id: "what-each-register-feeds",
        heading: "What each register feeds",
        blocks: [
          { table: {
            head: ["Register", "In the minimum price", "In the burn rate", "Elsewhere"],
            rows: [
              ["Fixed costs", "Yes, at the monthly equivalent", "Yes", "The same rows as a Recurring + Overhead expense on Expense Tracking; the statements count each in the month it is dated."],
              ["Salaries", "Yes", "Yes", "Nowhere else — these never pay anyone."],
              ["Debt", "Interest only when linked to an asset; the full payment otherwise", "The full monthly payment", "Loan interest and principal on Financial statements; loans outstanding on the balance sheet."],
              ["Assets & depreciation", "Yes — straight-line depreciation while in service, stopping when fully written down or disposed", "No — depreciation moves no money", "Book value per asset; a vehicle's cost on Vehicles."],
              ["Bills due", "No — “Bills don't change your minimum price — the recurring cost above already covers that. This is cash flow, not cost.”", "No", "Only this page. Marking a bill paid records nothing else; pay it your usual way."],
            ],
          } },
        ],
      },
      {
        id: "unabsorbed-labour",
        heading: "Paid hours that never reached a job",
        blocks: [
          { p: "For everyone with a guaranteed week set under **Your team**, the panel compares the last 30 days of that guarantee with the hours they logged against a job, and prices the gap at their hourly rate. Someone paid hourly with no guaranteed week has no gap to report; someone with no rate on file shows hours and no cost, and the total says it is short rather than counting those hours as free. Office staff are left out — their whole cost is overhead already." },
          { note: "The amber box says it plainly: this is **not** counted in the cost per job or the minimum price. It would move every quote you write on time entries nobody has checked yet, so it is shown first and left out of the price. Add it to your price yourself and you are counting it twice." },
        ],
      },
      {
        id: "where-the-number-goes",
        heading: "Where the number goes",
        blocks: [
          { p: "**Cost per job** is the overhead the quote builder's Cost & margin panel charges against every estimate, so a quote's margin on screen is net of the business, not just of the job. The KPI dashboard's **Net margin** needs it too — without capacity it reads “Set how many jobs a week you can take on in Settings → Overhead, and net margin can be worked out.” The **Fixed costs** card on the KPI page and the burn rate on Expense Tracking read the same registers." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Who can see it",
        blocks: [
          { p: "The **Overhead** row needs the ability to manage users **and** the **Job costing** toggle: every wage in the company and the company's margin are on this page. **Manager**, administrators and the owner see it. A Dispatcher can manage users but holds Job costing off, so the row is hidden and every endpoint behind it refuses. Deleting a register row asks first — “your price floor changes straight away” — and deleting an asset warns that its depreciation history goes with it; mark it sold instead to keep what it already cost you." },
        ],
      },
    ],
    faq: [
      { q: "Why is there no minimum price on my page?", a: "Jobs per week is not set. FieldQuo used to assume three jobs a week for everyone and priced every quote against an invented number; it now refuses to answer until you type your own." },
      { q: "My crew's wages are not in Salaries. Is the price too low?", a: "No. Crew hours are charged to each job as labour, so a job's own cost carries them. Salaries here is for overhead pay only — your draw, an office wage. Putting a crew rate here would count it twice." },
      { q: "The loan is paid off. Does the truck disappear from my costs?", a: "Not if it is in Assets & depreciation. The loan's payment stops, the wear keeps being charged until the asset is fully written down, and you keep saving toward replacing it." },
      { q: "Does the minimum price include materials and labour?", a: "No. It covers overhead only; the materials and labour for the specific job are on top. The quote builder adds them from the estimate." },
    ],
  },
};
