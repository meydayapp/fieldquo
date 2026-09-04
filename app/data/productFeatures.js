// app/data/productFeatures.js
export const PRODUCT_FEATURES = {
  quoting: {
    label: "Quotes & Invoicing",
    headline: "Send a professional quote in minutes",
    description:
      "Build quotes using your own pricing for every service you offer, add photos, and let clients approve online — no printing, no back-and-forth phone calls.",
    bullets: [
      "Your own pricing per service category, not a generic template",
      "Client approves and e-signs online",
      "One click turns an accepted quote into an invoice",
      "Every version tracked — never lose track of what was actually agreed to",
    ],
  },
  scheduling: {
    label: "Scheduling & Dispatch",
    headline: "A booking page that works while you're on the job",
    description:
      "Clients book directly from your website based on your real availability. Assign site visits to the right person on your team, automatically.",
    bullets: [
      "Public booking page, branded with your logo and colors",
      "Buffer times and per-person availability, not a generic calendar",
      "Assign supervisors to jobs that need one",
      "Automatic confirmations and reminders by email and text",
    ],
  },
  team: {
    label: "Team & Payroll",
    headline: "Give your team access without giving up control",
    description:
      "Role-based access means employees see what they need, supervisors can assign work, and you stay the only one who can change settings or run payouts.",
    bullets: [
      "Owner, admin, supervisor, and employee roles out of the box",
      "Timesheets tied to real jobs, not guesswork",
      "Pay contractors directly through the app",
      "Assign work areas and tasks to the right person",
    ],
  },
  analytics: {
    label: "Analytics & AI",
    headline: "Know your numbers before you're guessing",
    description:
      "See your real overhead, your break-even price per job, and how your pricing compares to other shops in your trade — plus an AI assistant that can answer questions about your own business.",
    bullets: [
      "Burn rate and minimum price, calculated from your real expenses",
      "Marketing spend broken down by channel — Facebook, Google, TikTok, and more",
      "See how your pricing compares, anonymously, to others in your trade",
      'Ask FieldQuo AI questions like "is my conversion rate normal?"',
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   The catalogue keys these four pages resolve through
   ═══════════════════════════════════════════════════════════════════════════

   Same shape as featurePageKey/featurePageStrings/featurePageCopy in
   app/data/featurePages.js, and for the same reason: the prefix is decided in
   one place, so the renderer, the nine translation modules and the check that
   compares them cannot come to disagree about what a key is called.

   ── What is NOT here: the label ────────────────────────────────────────────

   `label` is deliberately absent from productPageStrings(). It already exists
   as `product.<slug>.label` in app/i18n/messages.js, in all nine languages,
   because the header dropdown, the footer and the homepage feature band all
   render it. Copying it into a second catalogue would be a second wording of
   the same word, and the one nobody looks at is the one that rots. The page
   renders t(`product.${slug}.label`) instead, and
   scripts/check-product-pages.mjs pins the English of that key to
   PRODUCT_FEATURES[slug].label so the two can never drift apart.

   ── What IS here: the description ──────────────────────────────────────────

   `product.<slug>.description` in messages.js is the ONE-LINE nav summary
   ("Build and send professional quotes in minutes"). It is not this page's
   opening paragraph, which is three times longer and says different things.
   Rendering the nav line under the headline would print "Send a professional
   quote in minutes" above "Build and send professional quotes in minutes" —
   so the paragraph gets a key of its own. */

/** The catalogue key for one prose field of one product page. */
export function productPageKey(slug, field) {
  return `productPage.${slug}.${field}`;
}

/**
 * Every translatable string on one product page, as {field, english}.
 *
 * One list, read by the resolver below and by scripts/check-product-pages.mjs,
 * so "every prose field" means the same thing in both places.
 */
export function productPageStrings(feature) {
  return [
    { field: "headline", english: feature.headline },
    { field: "description", english: feature.description },
    ...feature.bullets.map((b, i) => ({ field: `bullet.${i + 1}`, english: b })),
  ];
}

/** Every prose key on every product page, in page order. */
export const PRODUCT_PAGE_TEXT_KEYS = Object.freeze(
  Object.entries(PRODUCT_FEATURES).flatMap(([slug, feature]) =>
    productPageStrings(feature).map(({ field }) => productPageKey(slug, field)),
  ),
);

/**
 * One product page with every sentence said in the reader's language.
 *
 * `say(key, english)` is passed in rather than a language code, matching
 * featurePageCopy(): the caller owns the resolution chain, and the English
 * from THIS file travels along as the last honest step, so a language with a
 * hole prints the proved English sentence rather than
 * `productPage.quoting.headline`.
 *
 * `say` is optional because generateMetadata() has no React context and must
 * not gain one — a crawler indexing a French <title> because the last visitor
 * switched languages is worse than an untranslated one. Same decision as
 * /industries/[slug] and /features/[slug].
 */
export function productPageCopy(slug, say) {
  const feature = PRODUCT_FEATURES[slug];
  if (!feature) return undefined;

  const said = (field, english) =>
    typeof say === "function" ? say(productPageKey(slug, field), english) : english;

  return {
    ...feature,
    headline: said("headline", feature.headline),
    description: said("description", feature.description),
    bullets: feature.bullets.map((b, i) => said(`bullet.${i + 1}`, b)),
  };
}
