// lib/estimate/report/website.js
//
// Where the instant-estimate report sends a homeowner who taps "Website" or
// "Back to the website".
//
// ── Why this is a rule and not `company.website || siteUrl(...)` ────────────
//
// lib/site/generateSite.js builds a site for every company the moment one
// is asked for, and fills its hero, about and feature slots with the eleven
// Unsplash scene photos in lib/site/placeholderImages.js. A company can
// publish that page untouched. Sending a homeowner who just read a branded
// estimate to a page whose photographs are of somebody else's roof is worse
// than sending them nowhere: the report said "this is us" and the site says
// "this is a template". So the hosted site is only offered when there is
// evidence a person shaped it — a hand edit of the copy, or at least one
// photograph that is theirs (an upload replaces a placeholder; galleries and
// before/after pairs are never stock, see placeholderImages.js).
//
// The company can override the automatic answer from Settings › Instant
// Quotes (Company.instantReportWebsite): "own", "fieldquo" or "none". An
// override that cannot be honoured — "own" with no website on record,
// "fieldquo" with an unpublished site — resolves to no link rather than to a
// guess, and the settings screen says so beside the control.
//
// Pure. Hand it the company row and its CompanySite; it answers.

import { isPlaceholder } from "@/lib/site/placeholderImages";
import { siteUrl } from "@/lib/site/subdomain";

/** The three explicit choices. Anything else stored is read as "automatic". */
export const REPORT_WEBSITE_CHOICES = Object.freeze(["own", "fieldquo", "none"]);

/** A stored value, or null for anything that is not one of the three. */
export function reportWebsiteChoice(value) {
  return REPORT_WEBSITE_CHOICES.includes(value) ? value : null;
}

// Only http(s). A homeowner's report must never carry a `javascript:` or a
// bare host somebody typed into the settings box.
function httpUrl(value) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** The company's own website as a URL, or null when there is none on record. */
export function ownWebsiteUrl(company) {
  return httpUrl(company?.website);
}

// Every image URL a block can carry, across the single-page `blocks` and the
// multi-page `pages[*].blocks`. countPlaceholders() in placeholderImages.js
// only walks the Home page and only counts stock; the question here is the
// opposite one — is there ANY image that is theirs — so it is asked directly.
function* blockImages(site) {
  const lists = [];
  if (Array.isArray(site?.blocks)) lists.push(site.blocks);
  if (Array.isArray(site?.pages)) {
    for (const p of site.pages) if (Array.isArray(p?.blocks)) lists.push(p.blocks);
  }
  for (const blocks of lists) {
    for (const b of blocks) {
      const c = b?.content;
      if (!c || typeof c !== "object") continue;
      if (typeof c.backgroundImage === "string") yield c.backgroundImage;
      if (typeof c.image === "string") yield c.image;
      for (const url of Array.isArray(c.featureImages) ? c.featureImages : []) {
        if (typeof url === "string") yield url;
      }
      for (const url of Array.isArray(c.images) ? c.images : []) {
        if (typeof url === "string") yield url;
        else if (url && typeof url.url === "string") yield url.url;
      }
      for (const pair of Array.isArray(c.pairs) ? c.pairs : []) {
        if (typeof pair?.before === "string") yield pair.before;
        if (typeof pair?.after === "string") yield pair.after;
      }
    }
  }
}

/**
 * Has a person shaped this site, or is it the generated placeholder?
 *
 * True when the site is published AND at least one of:
 *   • the copy was hand-edited (CompanySite.handEditedAt — cleared on
 *     regeneration, so it can only be set by a person after the last build);
 *   • an image on any page is not one of the stock placeholders;
 *   • the site's photo library holds an upload.
 *
 * An unpublished site is never tailored for this purpose: the public route
 * 404s it whatever its content.
 */
export function siteIsTailored(site) {
  if (!site || site.published !== true || !site.subdomain) return false;
  if (site.handEditedAt) return true;
  if (Array.isArray(site.photoLibrary) && site.photoLibrary.some((p) => typeof p?.url === "string" && p.url)) {
    return true;
  }
  for (const url of blockImages(site)) {
    if (url && !isPlaceholder(url)) return true;
  }
  return false;
}

/** The hosted site's public URL, only when it is live. */
export function hostedSiteUrl(site) {
  return site?.published === true && site.subdomain ? siteUrl(site.subdomain) : null;
}

/**
 * The report's website target.
 *
 * @param company  { website, instantReportWebsite }
 * @param site     the CompanySite row (published, subdomain, blocks, pages,
 *                 handEditedAt, photoLibrary) or null
 * @returns {{ kind: "own"|"fieldquo"|"none", url: string|null, automatic: boolean }}
 */
export function resolveReportWebsite({ company = {}, site = null } = {}) {
  const own = ownWebsiteUrl(company);
  const hosted = hostedSiteUrl(site);
  const choice = reportWebsiteChoice(company?.instantReportWebsite);

  if (choice === "own") return { kind: own ? "own" : "none", url: own, automatic: false };
  if (choice === "fieldquo") return { kind: hosted ? "fieldquo" : "none", url: hosted, automatic: false };
  if (choice === "none") return { kind: "none", url: null, automatic: false };

  if (own) return { kind: "own", url: own, automatic: true };
  if (hosted && siteIsTailored(site)) return { kind: "fieldquo", url: hosted, automatic: true };
  return { kind: "none", url: null, automatic: true };
}
