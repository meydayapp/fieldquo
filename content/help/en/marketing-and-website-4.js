// content/help/en/marketing-and-website-4.js
//
// Part 4 of the "marketing-and-website" category (en): Marketing results —
// app/app/marketing/results, computed by lib/agency/metrics.js (the same
// code the marketing-agency API answers from). Read off both on 2026-10-05.
export const ARTICLES = {
  "marketing-results": {
    title: "Marketing results",
    summary:
      "What your ads produced, laid out the way a marketing agency's dashboard is — spend, leads, appointments, closes, revenue and return on ad spend, each against the period before.",
    updated: "2026-10-05",
    intro: [
      "**Marketing → Marketing results** answers one question: what did the money spent on ads bring in? It follows every lead that arrived in a period through to the appointment, the quote, the close and the payment, and sets the ad spend against it.",
      "It shows exactly the figures your marketing agency sees through [[settings-agency-access|Marketing agency access]], worked out by the same code — so when the agency reports a cost per close, you can open this page and check it.",
    ],
    sections: [
      {
        id: "how-it-counts",
        heading: "How it counts",
        blocks: [
          { p: "The period picks **leads** — the ones that first arrived in it — and every later figure is what became of those leads, whenever it happened. A lead from March that closes in May counts as a March close. That is what keeps the numbers consistent: a stage can never be bigger than the one before it, and an appointment is counted once per lead." },
          { p: "Each figure is compared with the **previous period of the same length**: this month so far (say 5 days) against the 5 days before it; last month against the 30 or 31 days before that." },
          { p: "Every figure has an **i** button with its exact definition. A figure with nothing to work it out from shows **—** and says why, never a 0 that isn't one." },
        ],
      },
      {
        id: "the-figures",
        heading: "The figures",
        blocks: [
          { table: {
            head: ["Figure", "What it is"],
            rows: [
              ["Ad spend", "What your connected Meta and Google ad accounts spent in the period. Shows **—** when neither is connected."],
              ["Leads · Cost per lead", "Every lead that arrived, cold ones included · spend ÷ leads."],
              ["Appointments · Appointment set rate · Cost per appointment", "Leads that booked an in-person visit, once each · ÷ leads · spend ÷ appointments."],
              ["Closes · Close rate · Cost per close", "Leads whose quote was accepted · closes after a visit ÷ appointments · spend ÷ closes."],
              ["Revenue · Collected", "The accepted value of the closes · what has actually been paid on them so far."],
              ["Return on ad spend · Average job size", "Revenue ÷ spend · revenue ÷ closes."],
              ["Upcoming appointments · Adjusted close rate", "Visits whose date hasn't come · closes after a visit ÷ visits that have happened (upcoming and cancelled left out)."],
              ["Conversion timing", "Median days from lead to appointment, appointment to quote, quote to close, and lead to close."],
            ],
          } },
          { note: "A job won with no in-person visit still counts as a close, and is shown on its own as **Closed without a visit**." },
        ],
      },
      {
        id: "the-funnel",
        heading: "From first message to closed job",
        blocks: [
          { p: "The funnel starts with **messages from ads** — every Facebook, Instagram and WhatsApp conversation that began on an ad, taps included — then the **real conversations** among them, then leads, qualified leads (warm or hot, or proven by booking a visit), appointments, quotes sent after the visit, and closes. **Speed to lead** is the median time from a person's first message to your first reply." },
          { p: "Below it, **By source** splits the leads by where they came from, and **By campaign** lines each campaign's spend up with the leads and closes that name it." },
          { p: "Use **Source** and **Campaign** at the top to look at one channel or one campaign. A source with no ad spend behind it (your website, a referral) shows no cost figures rather than borrowing the ads' money." },
        ],
      },
    ],
    faq: [
      { q: "Why does this differ from Meta's own numbers?", a: "Meta counts its own events — a tap on a chat button is a \"conversation\" to Meta. This page counts people: how many typed real words, became leads, booked, and paid. See [[marketing-spend|Marketing spend]] for Meta's figures side by side." },
      { q: "Who can open it?", a: "Owners, admins and managers — the same people who see Marketing spend." },
    ],
  },
};
