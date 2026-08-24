// lib/links/candidates.js
//
// What a company COULD put on its bio-link page, derived from what it has.
//
// ── The rule this file exists to enforce ────────────────────────────────────
//
// A dead link on the one page a contractor's whole audience taps is the worst
// place in the product for one. So nothing becomes a candidate on the strength
// of a feature existing:
//
//   booking      needs at least one ACTIVE event type — otherwise /book renders
//                a calendar with nothing bookable on it
//   instant price needs an ENABLED InstantQuoteConfig — the estimator 404s
//                without one
//   funnels      published only, and only ones with a slug
//   website      a published CompanySite, or a website column that parses
//   phone/email  a value that survives the href boundary in ./href.js
//
// The "request a quote" form is the one thing every company always has: it
// takes free text and photos and needs no configuration, which is why it is
// the only unconditional row.
//
// ── Defaults are conservative in one direction only ─────────────────────────
//
// A candidate can be present and OFF by default. WhatsApp, email and the
// review link are: having a phone number is not a statement that WhatsApp is
// on it, and a review link exists to be sent to a finished customer, not to
// sit above the quote button spending the attention of someone deciding
// whether to call. They appear in Settings ready to switch on, which is a
// different thing from being switched on for people who never asked.

import { siteCopy } from "@/lib/site/siteCopy";
import { siteUrl } from "@/lib/site/subdomain";
import { linkLabels } from "./labels";
import { safeUrl, telHref, mailtoHref, whatsappHref } from "./href";

/**
 * The ordered list of possible rows.
 *
 * Pure: everything it needs arrives in `input`, so it can be run against
 * hostile shapes without a database. Returns
 * `[{ key, kind, url, label, defaultOn }]` in the order they should appear
 * when nobody has reordered them.
 *
 * Order is a sales argument, not an accident: the fastest route to a number
 * first (instant price), then the two ways of asking a human, then everything
 * that is context rather than a next step.
 *
 * @param input.company        slug/bookingSlug/name/phone/email/website/country/
 *                             reviewUrl/defaultLanguage
 * @param input.site           { subdomain, published } or null
 * @param input.activeEventTypes  count of bookable event types
 * @param input.enabledEstimators count of enabled InstantQuoteConfig rows
 * @param input.funnels        [{ slug, name, status }]
 */
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
        defaultOn: true,
      });
    }

    out.push({
      key: "quote",
      kind: "internal",
      url: `/quote/${encodeURIComponent(slug)}`,
      label: t.ctaFreeQuote,
      defaultOn: true,
    });

    if (count(input.activeEventTypes) > 0) {
      out.push({
        key: "book",
        kind: "internal",
        url: `/book/${encodeURIComponent(slug)}`,
        label: t.ctaBook,
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
        defaultOn: true,
      });
    }
  }

  const site = plain(input.site);
  // A published FieldQuo site wins over the `website` column: it is the one we
  // know is up, and it is the one their brand colour is on. The column is the
  // fallback for a company that has a site elsewhere.
  const websiteUrl = site.published && site.subdomain
    ? siteUrl(site.subdomain)
    : safeUrl(company.website);
  if (websiteUrl) {
    out.push({
      key: "site",
      kind: "external",
      url: websiteUrl,
      label: extra.website,
      defaultOn: true,
    });
  }

  const tel = telHref(company.phone);
  if (tel) {
    out.push({ key: "phone", kind: "contact", url: tel, label: t.call, defaultOn: true });
  }

  const wa = whatsappHref(company.phone, company.country);
  if (wa) {
    out.push({ key: "whatsapp", kind: "external", url: wa, label: extra.whatsapp, defaultOn: false });
  }

  const mail = mailtoHref(company.email);
  if (mail) {
    out.push({ key: "email", kind: "contact", url: mail, label: extra.email, defaultOn: false });
  }

  const review = safeUrl(company.reviewUrl);
  if (review) {
    out.push({ key: "review", kind: "external", url: review, label: extra.review, defaultOn: false });
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
