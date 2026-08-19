// lib/data/productUpdates.js
//
// The changelog shown at /app/settings/product-updates. Hardcoded on purpose:
// it is written by us, changes when we deploy, and is identical for every
// tenant — a Prisma model would mean a migration and an admin screen to
// maintain content that already ships with the code.
//
// ── Shape ───────────────────────────────────────────────────────────────────
//
//   date   ISO day. Newest first; the list does not sort, it prints.
//   title  One line, in the list and as the <h1> of the post.
//   body   The summary. Always shown. Must stand alone — most entries never
//          get a longer write-up and must still read as a complete note.
//   slug   Optional. URL segment for the full post.
//   post   Optional. Array of paragraphs, rendered at
//          /app/settings/product-updates/<slug>.
//
// slug and post are a pair. An entry with one and not the other is a dead
// link or an unreachable page, so `hasPost()` requires both and the list only
// renders "Read the full update" when it returns true — the alternative is a
// link that navigates to nothing, which is the failure AGENTS.md is about.
// scripts/check-product-updates.mjs enforces the pairing and slug uniqueness.
//
// This is English-only, like a changelog anywhere. `t()` covers the page's
// chrome; the entries themselves are not in the message catalogue because
// nobody is going to keep six translations of a changelog current, and a
// half-translated one is worse than an honest English one.

export const PRODUCT_UPDATES = [
  {
    date: "2026-07-21",
    slug: "company-settings-manage-team",
    title: "Company Settings, Manage Team, and more",
    body: "Rebuilt Settings with a proper Business Management section: Company Settings (hours, tax, regional), a granular Manage Team permission editor, Products & Services, Custom Fields, and Expense Tracking with an AI summary and burn rate.",
    post: [
      "Settings had grown into one long list where the screen you needed was wherever it happened to have been added. It is now grouped by what a business is actually trying to do, and several of the screens behind those groups were rebuilt rather than moved.",
      "Company Settings is the one place your business details live: opening hours, tax registration and rates, and your regional preferences. These are company-level and public — your opening hours are what a client sees, and they are deliberately separate from any one person's booking availability, which lives under Availability.",
      "Manage Team is now a permission editor rather than a role dropdown. You can decide, per person, what they can see and change — useful when a subcontractor should be able to close out a job but never see what the job was priced at.",
      "Products & Services is where your catalogue lives, and Custom Fields lets you add the questions your trade asks that ours does not. Both feed straight into quoting, so anything you add here is available the next time you build a quote.",
      "Expense Tracking now summarises where the money went and shows your burn rate, so the answer to 'what did we spend last month' is on the screen instead of in a shoebox.",
    ],
  },
  {
    date: "2026-07-18",
    slug: "redesigned-navigation",
    title: "Redesigned navigation",
    body: "The sidebar now has a quick-add shortcut, a collapsible layout, and a proper mobile drawer.",
    post: [
      "The sidebar was built for a desktop and behaved like one on a phone, which is where a lot of this product is actually used — in a driveway, one-handed.",
      "There is now a quick-add shortcut at the top, so starting a quote, a client or a job is one tap from anywhere instead of a trip back to a list screen.",
      "The rail collapses. On a laptop that gives the page back the width it needs for a quote with a lot of line items, and the icons stay, so you do not lose your place.",
      "On a phone the navigation is a drawer that opens over the page and closes when you pick something, rather than a column permanently eating a third of the screen.",
    ],
  },
];

/** The full post exists and is reachable. Both halves, or neither. */
export function hasPost(update) {
  return Boolean(update?.slug && update?.post?.length);
}

/** The entry for a URL segment, or null. Callers render a not-found state. */
export function findProductUpdate(slug) {
  if (!slug) return null;
  return PRODUCT_UPDATES.find((u) => u.slug === slug) || null;
}

/**
 * "July 21, 2026" in the interface language.
 *
 * Shared by the list and the post so the two can't drift — the list used to
 * carry its own copy pinned to en-US, which meant a French interface printed
 * an American date beside every entry. A bad locale falls back rather than
 * throwing a RangeError into the middle of a settings page.
 *
 * `T00:00:00` is not decoration: a bare "2026-07-21" parses as UTC midnight
 * and prints as the 20th anywhere west of Greenwich, which is most of this
 * product's users.
 */
export function formatUpdateDate(date, locale = "en-US") {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  const options = { month: "long", day: "numeric", year: "numeric" };
  try {
    return parsed.toLocaleDateString(locale, options);
  } catch {
    return parsed.toLocaleDateString("en-US", options);
  }
}
