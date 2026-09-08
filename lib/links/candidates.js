// lib/links/candidates.js
//
// What a company COULD put on its bio-link page, derived from what it has.
//
// ── The rule this file exists to enforce ────────────────────────────────────
//
// A dead link on the one page a contractor's whole audience taps is the worst
// place in the product for one. So nothing becomes a candidate on the strength
// of a feature existing — each row is derived from the SAME condition the
// public route it points at applies, read from the same rows:
//
//   instant price  an ENABLED InstantQuoteConfig whose trade the estimator
//                  can price — the gate lib/estimate/instantQuoteServer.js
//                  loadCompanyInstantTrades applies before /instant-quote
//                  renders a trade. ./load.js mirrors it (including the
//                  painting-needs-a-scope rule) and passes the count in.
//   quote form     the one thing every company always has: /quote takes free
//                  text and photos and needs no configuration, so it is the
//                  only unconditional row.
//   book a visit   at least one ACTIVE EventType — without one /book renders
//                  a calendar with nothing bookable on it.
//   funnels        Funnel.status === "published" with a slug — exactly the
//                  where-clause app/api/funnels/public/… answers 404 against.
//                  The "60-second quiz" is one of these; its label is the
//                  name the contractor gave it.
//   website        Company.website when set, else the FieldQuo-hosted site
//                  when CompanySite.published — see "Website" below.
//   reviews        Company.reviewUrl, the link Settings → Reviews holds.
//   phone/email    a value that survives the href boundary in ./href.js.
//
// ── Socials are NOT derived here, and why ───────────────────────────────────
//
// The owner asked that the icon row read from wherever the company's
// Instagram / TikTok / Facebook already live, so a change elsewhere flows
// here. Checked on 2026-09-08: nowhere else holds them. Company has no social
// columns (prisma/schema.prisma, model Company — logoUrl, website, reviewUrl
// and an email-sending domain are the only URL-shaped fields), CompanySite's
// blocks carry no social links (app/data/siteBlocks.js), and the Meta
// connection in lib/social/metaConnection.js is `not_built` for every real
// company. So the `social:*` entries in LinkPage.items, typed on the bio-link
// settings screen, are the ONE place in the product a company's handles are
// recorded — not a duplicate of anything. If a Company-level social field
// arrives later, that field becomes the source and this file reads it; the
// stored entries here would then be the override list they already are for
// every other row.
//
// ── Every link we hold is ON by default ─────────────────────────────────────
//
// The owner's rule (2026-09-08): the instant quote, the quiz, book a visit,
// the reviews and the website are things the company already has, so they
// go on the page without anyone having to find a switch. A row the
// contractor turned off stays off — ./config.js keeps the override — but a
// row nobody has touched is on the first time the page is loaded, including
// a funnel published next month. The review link and email address are on
// for the same reason: both are facts the company entered on purpose.
//
// WhatsApp is the one exception, and stays OFF by default: having a phone
// number is not a statement that WhatsApp is on it, and a wa.me link to a
// number that isn't opens a chat with nobody. It appears in Settings ready
// to switch on, which is a different thing from being switched on for
// people who never said so.
//
// ── Groups ──────────────────────────────────────────────────────────────────
//
// Every candidate carries a `group`, and the public page renders a heading
// per group. The heading is derived here, not stored, for the same reason the
// URL is: it is a fact about what the row IS. A funnel is "Get a price"
// because a funnel ends in a quote request; WhatsApp is "Contact" because a
// message is a way of asking a human. A custom row is "More" — the contractor
// wrote it, so it is by definition something the product has no word for.
//
// The page orders SECTIONS by where each group's first row falls in the
// contractor's own order, so grouping never overrides a reorder: put the
// website first and "More" is the first section. See groupLinks in ./config.js.

import { siteCopy } from "@/lib/site/siteCopy";
import { siteUrl } from "@/lib/site/subdomain";
import { linkLabels } from "./labels";
import { safeUrl, telHref, mailtoHref, whatsappHref } from "./href";

/**
 * The ordered list of possible rows.
 *
 * Pure: everything it needs arrives in `input`, so it can be run against
 * hostile shapes without a database. Returns
 * `[{ key, kind, url, label, group, defaultOn }]` in the order they should appear
 * when nobody has reordered them.
 *
 * Order is a sales argument, not an accident: the fastest route to a number
 * first (instant price), then the two ways of asking a human, then everything
 * that is context rather than a next step.
 *
 * @param input.company        slug/bookingSlug/name/phone/email/website/country/
 *                             reviewUrl/defaultLanguage
 * @param input.site           { subdomain, published } or null — CompanySite
 * @param input.activeEventTypes  count of ACTIVE EventType rows
 * @param input.enabledEstimators count of enabled InstantQuoteConfig rows the
 *                             estimator can actually price (./load.js applies
 *                             the same filter as the public loader)
 * @param input.funnels        [{ slug, name, status }] — only "published"
 *                             ones become rows, whatever the caller passed
 */
/** The groups a row can belong to, in the order the page prefers when nobody has reordered. */
export const LINK_GROUPS = ["price", "book", "contact", "follow", "more"];

/**
 * Section headings in the company's language, keyed by group.
 *
 * "Book" and "Contact" are siteCopy's nav words, reviewed in every language
 * the site speaks; the other three are in ./labels.js. Same rule as every
 * other label on this page: reuse a reviewed string before adding one.
 */
export function linkGroupLabels(language) {
  const t = siteCopy(language);
  const extra = linkLabels(language);
  return {
    price: extra.groupPrice,
    book: t.navBook,
    contact: t.navContact,
    follow: extra.groupFollow,
    more: extra.groupMore,
  };
}

export function linkCandidates(input = {}) {
  const company = plain(input.company);
  const language = company.defaultLanguage;
  const t = siteCopy(language);
  const extra = linkLabels(language);

  // The same fallback /book, /quote and /instant-quote resolve through — see
  // lib/booking/findBookingCompany.js. A company that set a custom booking
  // slug must get links that use it, or every row here 404s.
  const slug = String(company.bookingSlug || company.slug || "").trim();
  const out = [];

  if (slug) {
    if (count(input.enabledEstimators) > 0) {
      out.push({
        key: "instant",
        kind: "internal",
        url: `/instant-quote/${encodeURIComponent(slug)}`,
        label: extra.instantEstimate,
        group: "price",
        defaultOn: true,
      });
    }

    out.push({
      key: "quote",
      kind: "internal",
      url: `/quote/${encodeURIComponent(slug)}`,
      label: t.ctaFreeQuote,
      group: "price",
      defaultOn: true,
    });

    if (count(input.activeEventTypes) > 0) {
      out.push({
        key: "book",
        kind: "internal",
        url: `/book/${encodeURIComponent(slug)}`,
        label: t.ctaBook,
        group: "book",
        defaultOn: true,
      });
    }

    for (const funnel of asArray(input.funnels)) {
      const f = plain(funnel);
      const fSlug = String(f.slug || "").trim();
      if (!fSlug || f.status !== "published") continue;
      out.push({
        // Keyed by slug, not by database id: the id means nothing on the
        // settings screen and a funnel renamed keeps its position.
        key: `funnel:${fSlug}`,
        kind: "internal",
        url: `/f/${encodeURIComponent(slug)}/${encodeURIComponent(fSlug)}`,
        // The funnel's own name. FieldQuo has no better word for "TikTok —
        // 60-second quiz" than the one the contractor typed.
        label: String(f.name || "").trim() || fSlug,
        group: "price",
        defaultOn: true,
      });
    }
  }

  // ── Website ───────────────────────────────────────────────────────────────
  //
  // The domain the company entered wins (Company.website, Company Settings).
  // It used to be the other way round — a published FieldQuo site beat the
  // column — and the owner reversed it on 2026-09-08: "if they have not
  // entered a website domain then we use the one we create for clients in
  // the settings". A contractor who typed their own domain means it; the
  // hosted site is the fallback for a company that has no other.
  //
  // The hosted URL is used ONLY when CompanySite.published is true. That flag
  // is what middleware.js's subdomain rewrite serves — an unpublished site
  // rewrites to /site/<subdomain> and 404s there — so an unpublished site
  // here would be a dead link on the one page that must not have one.
  // siteUrl() is the same helper the website settings screen's copy button
  // uses, so this row and that button never name two different hosts.
  //
  // Neither set → no row at all. Not the company's Google listing, not a
  // search — absence is not padded.
  //
  // The line under the name (lib/links/handle.js) reads the SAME two fields
  // and deliberately refuses the hosted host: this row is a control that
  // takes a visitor somewhere, and the browser will show `*.fieldquo.com`
  // once they tap it; the handle is a caption above the fold that everyone
  // reads and nobody taps, and printing our domain there is the white-label
  // leak. Same inputs, opposite answers, both on purpose.
  const site = plain(input.site);
  const websiteUrl =
    safeUrl(company.website) ||
    (site.published === true && site.subdomain ? siteUrl(site.subdomain) : null);
  if (websiteUrl) {
    out.push({
      key: "site",
      kind: "external",
      url: websiteUrl,
      label: extra.website,
      group: "more",
      defaultOn: true,
    });
  }

  const tel = telHref(company.phone);
  if (tel) {
    out.push({ key: "phone", kind: "contact", url: tel, label: t.call, group: "contact", defaultOn: true });
  }

  const wa = whatsappHref(company.phone, company.country);
  if (wa) {
    out.push({
      key: "whatsapp",
      kind: "external",
      url: wa,
      label: extra.whatsapp,
      group: "contact",
      defaultOn: false,
    });
  }

  const mail = mailtoHref(company.email);
  if (mail) {
    out.push({ key: "email", kind: "contact", url: mail, label: extra.email, group: "contact", defaultOn: true });
  }

  // Company.reviewUrl — the Google (or other) review link Settings → Reviews
  // holds and the review-request emails send. The reviews EMBED
  // (/embed/<slug>/reviews) is deliberately not a row: it is an iframe widget
  // for a site the company already has, and it renders nothing when there
  // are no approved testimonials, which would be a button onto a blank page.
  const review = safeUrl(company.reviewUrl);
  if (review) {
    out.push({ key: "review", kind: "external", url: review, label: extra.review, group: "more", defaultOn: true });
  }

  return out;
}

function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function count(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
