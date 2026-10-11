// lib/lifecycle/helpArticles.js
//
// Which REAL help-centre articles (lib/help/tree.js, content/help/) the day-5
// letter links, for this company: one about its trade where the help centre
// has one that is plainly about that trade, then the guides for the features
// it has not set up yet, in the sequence's own order, then the general
// first-day guides. Two or three, never padded with an article that does not
// exist — every slug is checked against the tree, and the check script fails
// if a slug here is ever renamed out from under it.
//
// Pure. The cron resolves titles and summaries in the reader's language with
// lib/help/content.js (bodies exist in en / fr / es; any other language gets
// the English article, which the letter marks "(in English)").

import { articleMeta } from "@/lib/help/tree";

/** The guide for each open feature (lib/lifecycle/plan.js FEATURES). */
export const FEATURE_ARTICLES = Object.freeze({
  payments: "connect-stripe-and-get-verified",
  booking: "working-hours-and-bookable-hours",
  quote: "build-a-quote",
  import: "import-clients-from-a-csv",
});

/**
 * One article per trade, only where the help centre has one that is about
 * that trade's work. A trade with none gets none — a generic article
 * relabelled as "for painters" would be a claim the article does not make.
 */
export const TRADE_ARTICLES = Object.freeze({
  painting: "painting-by-production-rate",
  roofing: "aerial-roof-measurement",
  hvac: "service-plans",
  plumbing: "service-plans",
  electrical: "service-plans",
  general_contracting: "import-a-subcontractor-quote",
  landscaping: "recurring-jobs",
  tree_care: "recurring-jobs",
  pressure_washing: "recurring-jobs",
  house_cleaning: "recurring-jobs",
});

export const GENERAL_ARTICLES = Object.freeze(["your-first-day-setup-checklist", "send-a-quote", "how-to-get-help"]);

export const HELP_ARTICLES_MIN = 2;
export const HELP_ARTICLES_MAX = 3;

/**
 * @param tradeKey  the company's discovery trade, or null
 * @param open      the features not done yet, e.g. ["payments", "import"]
 * @returns [{ slug, category }] — 2 or 3, each a real article
 */
export function pickHelpArticles({ tradeKey = null, open = [] } = {}) {
  const wanted = [
    TRADE_ARTICLES[tradeKey],
    ...(Array.isArray(open) ? open : []).map((f) => FEATURE_ARTICLES[f]),
    ...GENERAL_ARTICLES,
  ];
  const out = [];
  for (const slug of wanted) {
    if (!slug || out.some((a) => a.slug === slug)) continue;
    const meta = articleMeta(slug);
    if (!meta) continue;
    out.push({ slug, category: meta.category });
    if (out.length >= HELP_ARTICLES_MAX) break;
  }
  return out;
}
