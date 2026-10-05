// content/help/en/integrations-3.js
//
// Part 3 of the "integrations" category (en): Marketing agency access — the
// key a company gives its marketing agency (lib/agency/). Read off the
// settings screen (app/app/settings/agency-access), the API it opens
// (app/api/v1/*) and the privacy boundary (lib/agency/leadRow.js) on
// 2026-10-05.
export const ARTICLES = {
  "settings-agency-access": {
    title: "Give your marketing agency access",
    summary:
      "Create a key for the agency that runs your ads, so it sees which leads became appointments, closes and revenue — with clients' contact details kept private unless you choose to share them.",
    updated: "2026-10-05",
    intro: [
      "An agency running your Facebook, Instagram or Google ads can only optimise toward what it can see. Without you, it sees clicks and form fills; it never learns which of those people booked a visit, signed a quote and paid. **Settings → Marketing agency access** gives it that half: every lead it brought, how far that lead got, and what the job was worth.",
      "The agency connects with a **key** you create there. It reads your results through FieldQuo's API — directly, or through Zapier — and the key is the only thing that says which company it is reading. You can create a key per agency, see every call each key makes, and revoke one at any time.",
    ],
    sections: [
      {
        id: "create-a-key",
        heading: "Create a key",
        blocks: [
          { steps: [
            "Open **Settings → Marketing agency access** (owners and admins).",
            "Under **Create a key**, type the agency's name — it is how you will recognise the key later.",
            "Leave **Also let this agency add and update leads** unticked unless the agency runs its own landing pages or forms and needs to send you those leads (see below).",
            "Press **Create key**. The key appears once, in a box: copy it and send it to the agency. FieldQuo keeps only a fingerprint of it, so it cannot be shown again — if it is lost, revoke it and create another.",
          ] },
          { p: "The agency puts the key into its own tools. The API reference it needs is linked from the screen: **What the agency can see (API reference)**, at fieldquo.com/developers/marketing-api." },
        ],
      },
      {
        id: "what-the-agency-sees",
        heading: "What the agency sees",
        blocks: [
          { p: "Each lead reaches the agency as one row. By default the row is built so it identifies nobody:" },
          { bullets: [
            "a **private reference** like **L-7F3A** — random, the same for the life of the lead, and never derived from a phone number or an email;",
            "the **first name** only;",
            "when they first got in touch, and the **channel**: Facebook ad, Instagram ad, Google Ads, the agency's own funnel, your website, a referral or organic;",
            "the **ad** that brought them where it is known — campaign, ad set and ad, the click id (fbclid or gclid) and any UTM tags;",
            "how qualified they are (the conversation tier and the hot / warm / cold temperature), and the time of every stage: qualified, first reply, appointment booked, appointment date and outcome, quote sent, viewed, accepted or declined, invoiced, paid, job completed;",
            "the service asked for and the service sold;",
            "**part of the postal code** — the 5-digit ZIP in the US, the first three characters in Canada. Never the street address;",
            "the **lost reason**, when your team recorded one.",
          ] },
          { p: "Two switches on the same screen change that:" },
          { table: {
            head: ["Switch", "Default", "What it adds"],
            rows: [
              ["**Share contact details with my marketing agency**", "Off", "Full name, phone number, email and the full postal code. The street address is still never shared."],
              ["**Share job values**", "On", "Quote amounts, won amounts and what has been paid — what the agency needs for revenue and return on ad spend. Off, it sees counts only."],
            ],
          } },
          { note: "Every change to either switch is written to your Activity log with who made it. Switching contact details off takes effect on the next thing the agency reads — including events that were waiting to be sent." },
        ],
      },
      {
        id: "zapier-and-events",
        heading: "Zapier and live events",
        blocks: [
          { p: "Besides reading, an agency can subscribe to **events**, so its dashboard updates the moment something happens: a lead arrives, becomes qualified or moves stage; a visit is booked (an on-site estimate) or marked held or cancelled; a quote is sent, viewed, accepted or declined; a job is completed; an invoice is paid; a payment is received. Each event carries the same private row." },
          { p: "Your agency can use FieldQuo's Zapier app, or call the API from any tool that can make a web request. Events leave after the action that caused them has finished, so nothing your team does waits on the agency." },
          { note: "FieldQuo does not record no-shows. An appointment whose date has passed and that nobody marked as done or cancelled is reported as **unmarked**, not as a no-show." },
        ],
      },
      {
        id: "adding-leads",
        heading: "Letting the agency add and update leads",
        blocks: [
          { p: "Ticking **Also let this agency add and update leads** when you create a key lets that key do four more things, and no others:" },
          { bullets: [
            "**Add a lead** from the agency's own funnel. It lands on your Leads board like any other enquiry, marked as coming from your marketing agency's funnel, scored the same way. If the same email or phone already sent you an enquiry in the last six months, no second lead is made.",
            "**Move a lead along your pipeline** — by the same rules as your board: Won only when an accepted quote or work stands behind it, Lost only with a reason.",
            "**Set the window a visit is requested for**, shown on the lead. It never changes a visit that is already booked, its time or who is going.",
            "**Find a lead by email or phone**, answered with the same private row.",
          ] },
          { warning: "No key can ever text, email or message your clients. That is deliberate: an outside party should not be able to speak to your customers in your name." },
          { p: "Everything a key adds or changes is in your Activity log under the agency's name." },
        ],
      },
      {
        id: "revoke",
        heading: "See what a key does, and revoke it",
        blocks: [
          { p: "Each key shows who created it and when, when it was last used, how many calls it made in the last 7 days and which events it is subscribed to. **Recent calls** lists every request with its time and result." },
          { p: "**Revoke** stops the key immediately: every request with it is refused and its Zaps stop receiving events. A revoked key stays listed under **Revoked keys** as the record of who had access and when." },
        ],
      },
    ],
    faq: [
      { q: "Can the agency see another company's data?", a: "No. The key belongs to your company and is the only thing that decides whose data a request reads." },
      { q: "Can FieldQuo support create a key for me?", a: "No. A support session can look at this screen but cannot create or revoke a key, or change what is shared." },
      { q: "Can I check the agency's numbers?", a: "Yes — Marketing → Marketing results shows the same figures, worked out by the same code. See [[marketing-results|Marketing results]]." },
    ],
  },
};
