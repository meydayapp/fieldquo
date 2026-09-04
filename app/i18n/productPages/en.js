// app/i18n/productPages/en.js
//
// The English block for /product/<slug>.
//
// ══ Why English is here at all ═════════════════════════════════════════════
//
// The same argument as app/i18n/featurePages/en.js makes, one surface over.
// Every other language module is held to the KEYS OF ENGLISH, so English has
// to exist in the catalogue or nothing is gated: a key present in Ukrainian
// and absent here would be an unchecked key, not a caught one.
//
// So it is a duplicate of app/data/productFeatures.js, and an unpinned
// duplicate is worse than no duplicate — /product/quoting would say one thing
// and the check would be proving another. It is pinned:
// scripts/check-product-pages.mjs asserts every string below is
// character-identical to the data module, and names the ones that are not.
// Editing prose means editing app/data/productFeatures.js first, then this
// file to match. The check tells you exactly which key drifted.
//
// The label is NOT here. `product.<slug>.label` already exists in
// app/i18n/messages.js in all nine languages — the header dropdown, the footer
// and the homepage band render it — and the page resolves it through t().

const en = {

  // /product/quoting
  "productPage.quoting.headline": "Send a professional quote in minutes",
  "productPage.quoting.description":
    "Build quotes using your own pricing for every service you offer, add photos, and let clients approve online — no printing, no back-and-forth phone calls.",
  "productPage.quoting.bullet.1":
    "Your own pricing per service category, not a generic template",
  "productPage.quoting.bullet.2": "Client approves and e-signs online",
  "productPage.quoting.bullet.3": "One click turns an accepted quote into an invoice",
  "productPage.quoting.bullet.4":
    "Every version tracked — never lose track of what was actually agreed to",

  // /product/scheduling
  "productPage.scheduling.headline": "A booking page that works while you're on the job",
  "productPage.scheduling.description":
    "Clients book directly from your website based on your real availability. Assign site visits to the right person on your team, automatically.",
  "productPage.scheduling.bullet.1": "Public booking page, branded with your logo and colors",
  "productPage.scheduling.bullet.2":
    "Buffer times and per-person availability, not a generic calendar",
  "productPage.scheduling.bullet.3": "Assign supervisors to jobs that need one",
  "productPage.scheduling.bullet.4": "Automatic confirmations and reminders by email and text",

  // /product/team
  "productPage.team.headline": "Give your team access without giving up control",
  "productPage.team.description":
    "Role-based access means employees see what they need, supervisors can assign work, and you stay the only one who can change settings or run payouts.",
  "productPage.team.bullet.1": "Owner, admin, supervisor, and employee roles out of the box",
  "productPage.team.bullet.2": "Timesheets tied to real jobs, not guesswork",
  "productPage.team.bullet.3": "Pay contractors directly through the app",
  "productPage.team.bullet.4": "Assign work areas and tasks to the right person",

  // /product/analytics
  "productPage.analytics.headline": "Know your numbers before you're guessing",
  "productPage.analytics.description":
    "See your real overhead, your break-even price per job, and how your pricing compares to other shops in your trade — plus an AI assistant that can answer questions about your own business.",
  "productPage.analytics.bullet.1":
    "Burn rate and minimum price, calculated from your real expenses",
  "productPage.analytics.bullet.2":
    "Marketing spend broken down by channel — Facebook, Google, TikTok, and more",
  "productPage.analytics.bullet.3":
    "See how your pricing compares, anonymously, to others in your trade",
  "productPage.analytics.bullet.4":
    "Ask FieldQuo AI questions like \"is my conversion rate normal?\"",
};

export default en;
