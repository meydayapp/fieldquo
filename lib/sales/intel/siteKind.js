// lib/sales/intel/siteKind.js
//
// Is the website on a prospect's record THEIR site — or a directory that
// lists them, or a profile on somebody else's platform?
//
// ══ The prospect that made this a question ═════════════════════════════════
//
// Ring A Ling Upholstery & Carpet Cleaners, Randolph NY. Overture's
// `websites` column said www.ethicalservices.com, and the crawler did its
// job on it: three pages rendered, a mailto: was found, no booking link, no
// form. Every one of those readings was TRUE — of Ethical Services, a
// carpet-cleaner directory whose menu says "Find a Provider", "List Your
// Business", "Register Here" and "Member Login". The rep's card said "Has a
// website of their own", "Publishes an email address" (the directory's, which
// became the lead's email), "No enquiry form", and the "client portal" the
// rep clicked into on /contact.php was the directory's member login.
//
// Nothing in the crawler was wrong about the pages. What was wrong was the
// premise every reader shares: that the URL on the record is the business's
// own site. lib/sales/intel/siteIdentity.js already refuses that premise for
// a DERIVED domain; this file refuses it for a PUBLISHED one, on the site's
// own evidence rather than on where the URL came from.
//
// ══ Three kinds, and what each does downstream ═════════════════════════════
//
//   own               the site is theirs. Every reader proceeds as before.
//   directory         a listing site — a search box for providers, a "list
//                     your business" link, a member login, a brand that is
//                     not the business's. WEBSITE becomes FALSE (a directory
//                     entry is not a website of their own, and the NO_WEBSITE
//                     pitch is the right one), every deep capability becomes
//                     NULL (never false: nobody has looked at THEIR site), a
//                     contact found there is said to be the directory's, and
//                     the site's copy is never read as the business's own
//                     words (tradeDetect, INFER_FROM_SITE).
//   platform_profile  a page on a platform — a Facebook page, a Yelp or Houzz
//                     profile, a Google business site, a linktr.ee. Same
//                     consequences as a directory. Decided from the HOST
//                     alone, because the crawler usually cannot render these
//                     and the host is the whole finding.
//   unknown           nothing loaded and the host is not a known platform.
//                     Every consequence above is withheld: an unknown must
//                     not turn a real site into "no website".
//
// ══ How the decision is made, and why it is a ladder ═══════════════════════
//
// A platform host is decided first and from the host alone. Then a host
// shared by many prospects: Overture attaches one URL to one record, so
// thirty records naming the same host is thirty businesses listed on one
// site — unless it is a franchise, whose pages are the business's own
// presence on the franchisor's domain, which is why a URL with a path of its
// own (`/houston`, `/locations/randolph-ny`) is NOT read as shared below the
// decisive threshold. Then the page signals, each cited as a reason:
//
//   nav_directory         anchor text or path that only a listing site has —
//                         "Find a Provider", "List Your Business", "Claim
//                         your listing", "Member Login", /listing.php,
//                         /directory. Counted as DISTINCT phrases: a menu
//                         repeated on three pages is one observation.
//   provider_search_form  a GET form posting to a listing/search path that
//                         asks for a CITY, STATE, ZIP or COUNTRY. A WordPress
//                         site search (`?s=`) asks for none of those.
//   login_form            a <form> with a password field on a marketing
//                         page. Weak on its own — a contractor can embed a
//                         client login — so it never decides alone.
//   name_mismatch         the site's brand (the title's first segment, or
//                         og:site_name) shares no token with the business
//                         name. Weak on its own: half the sites in the trade
//                         are titled "Home". Its OPPOSITE is strong: a title
//                         that carries every distinctive token of the
//                         business name is the site naming itself, and vetoes
//                         a directory reading unless the host is shared.
//
// The ladder is deterministic and the thresholds are named constants, for
// the reason confidence.js gives about tunable weights: a resemblance must
// not be able to decide, and a reviewer must be able to say WHICH rule fired.
//
// ══ Measured before it shipped ═════════════════════════════════════════════
//
// Run over the stored evidence of 2,000 random crawled prospects (of 219,548
// with a websiteUrl on 179,114 distinct hosts) on 2026-09-14, read-only,
// five times while the rules were adjusted; the check script carries the
// fixtures and the measurement itself was a throwaway. The final run:
//
//   own                1,641   82.1%   1,179 with the name in the title
//   unknown              290   14.5%   196 nothing loaded, 66 refused the crawl
//   directory             35    1.8%   30 by known host, 5 by page signals
//   platform_profile      34    1.7%   25 of them dead business.site pages
//
// Every directory and platform row was hand-checked; the five page-signal
// directories were profilecanada.com, web.buildersinstitute.org, the
// American Subcontractors Association's member directory, and two HVAC
// manufacturers' dealer locators listed as a dealer's website (carrier.com,
// heil-hvac.com). The adjustments the earlier runs forced, each recorded
// beside the rule it changed:
//
//   · a shared host is NOT decisive. The first run called 139 prospects
//     directories, and the shared hosts were franchises — key.me 3,451
//     prospects, minutekey.com 2,161, searshomeservices.com 357, servpro.com
//     322, rotorooter.com 306 — whose pages are the franchisee's own
//     presence. A shared host now only corroborates.
//   · site builders are not platforms. wixsite.com, weebly.com,
//     sites.google.com and godaddysites.com host the business's own site.
//   · a path phrase is the same observation as its link text ("FIND A
//     DEALER" → /find-a-dealer), and only same-host links count: a fence
//     maker's "Find a distributor" and a footer link to trex.com's
//     contractor finder were both read as directory menus.
//   · "Find a dealer/installer/expert" and "Become a member" are strong,
//     not decisive: renostone.com, newtechwood.ca, gardiner.com and a
//     bricklayers' local all say them about themselves. "Member login"
//     is weak: a union, a supplier's dealer portal and a contractor's
//     vendor portal all have one.
//   · a page title is not a brand. "Home", "Contact", "Accueil",
//     "Services" and "Account Suspended" were the commonest mismatches on
//     sites that were plainly the business's own, so a generic title never
//     counts as a mismatch, and a plural or run-together spelling ("KeyMe
//     Locksmiths" / "24/7 Locksmith Services") is not somebody else's name.
//   · the known-directory list exists because 411habitation.com (65
//     prospects, every page titled "411 Habitation", a menu that says none
//     of the phrases) was read as the business's own site seven times out
//     of seven, and Pages Jaunes / Yellow Pages refuse the crawler, so
//     their listings never render a page to read.
//
import { loadedPages, normaliseCrawl } from "./technology";
import { fold, nameTokens } from "./siteIdentity";

export const SITE_KIND_DETECTOR = "site_kind";
export const SITE_KIND_DETECTOR_VERSION = "1";

/** The `ProspectEvidence.normalizedValue` prefix on the rows this detector
 *  writes, and the value the WEBSITE capability's evidence carries so the
 *  screen can tell "no website" from "a directory". */
export const SITE_KIND_EVIDENCE_PREFIX = "site_kind";

export const SITE_KINDS = Object.freeze(["own", "directory", "platform_profile", "unknown"]);

/**
 * Hosts that are somebody's platform, never a business's own site.
 *
 * Suffix-matched on the host, so `m.facebook.com` and `www.yelp.ca` hit. A
 * contractor whose only web presence is a Facebook page is one of the best
 * prospects in the pipeline (spec §5) and must not be read as "has a website
 * of their own".
 *
 * NOT here, on purpose, after the measurement: the site BUILDERS. A page on
 * wixsite.com, weebly.com, godaddysites.com, wordpress.com or sites.google.com
 * is the business's own site on a free subdomain — Coffrage L.C's
 * coffragelc.wixsite.com is titled "Coffrage L.C" and carries their own
 * form — and reading it as a profile would tell a rep they have no website
 * while they are looking at one. business.site stays: Google generated those
 * from the Business Profile and shut them in 2024, and every one in the
 * sample was dead.
 */
export const PLATFORM_PROFILE_HOSTS = Object.freeze([
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "pinterest.com",
  "yelp.com",
  "yelp.ca",
  "homestars.com",
  "houzz.com",
  "angi.com",
  "angieslist.com",
  "homeadvisor.com",
  "thumbtack.com",
  "networx.com",
  "nextdoor.com",
  "bbb.org",
  "porch.com",
  "buildzoom.com",
  "bark.com",
  "trustedpros.ca",
  "business.site",
  "maps.google.com",
  "play.google.com",
  "goo.gl",
  "g.page",
  "g.co",
  "forms.gle",
  "linktr.ee",
  "linktree.com",
  "alignable.com",
  "foursquare.com",
  "tripadvisor.com",
]);

/**
 * Hosts that ARE directories, decided from the host alone.
 *
 * The page signals below find an unknown directory; this list is the known
 * ones, and it exists because a directory's listing page often does not
 * load for the crawler (Pages Jaunes and Yellow Pages refuse it) and a
 * listing that did load may carry the business's own name in its title.
 * 411habitation.com was the measured case: 65 prospects on one host, every
 * page titled "411 Habitation", and the classifier read it as the
 * business's own site seven times out of seven because its menu says none
 * of the phrases above. Kind "directory" rather than "platform_profile" so
 * the rep's sentence is the right one — "a directory (411 Habitation)".
 */
export const KNOWN_DIRECTORY_HOSTS = Object.freeze([
  "yellowpages.com",
  "yellowpages.ca",
  "yp.com",
  "yp.ca",
  "pj.ca",
  "pagesjaunes.ca",
  "canpages.ca",
  "411.ca",
  "411habitation.com",
  "construction411.com",
  "reseau411.ca",
  "cylex.ca",
  "cylex-canada.ca",
  "cylex.us.com",
  "hotfrog.com",
  "hotfrog.ca",
  "brownbook.net",
  "n49.ca",
  "manta.com",
  "mapquest.com",
  "superpages.com",
  "dexknows.com",
  "merchantcircle.com",
  "chamberofcommerce.com",
  "dnb.com",
  "dandb.com",
  "hub.biz",
  "contractors.com",
  "opendi.ca",
  "opendi.us",
  "infobel.com",
  "bizapedia.com",
  "buzzfile.com",
  "zoominfo.com",
  "localsolution.com",
  "ethicalservices.com",
  // California's licence board, listed as the "website" of 161 prospects
  // (scripts/find-directory-hosts.mjs, 2026-09-14): a licence lookup, not a
  // site of theirs.
  "cslb.ca.gov",
]);

/** URL prefixes (host + path) that are a platform even though the bare host
 *  is not: google.com/maps is a Business Profile, sites.google.com is a site
 *  builder, and the two share a registrable domain. */
export const PLATFORM_PROFILE_URL_PREFIXES = Object.freeze(["google.com/maps", "google.com/search", "google.com/url"]);

/** A host attached to this many OTHER prospects, on a URL with a listing
 *  path, corroborates a directory. Never decisive on its own: the measured
 *  sample's shared hosts were franchises — key.me 3,451 prospects,
 *  minutekey.com 2,161, searshomeservices.com 357, servpro.com 322 — whose
 *  pages are the franchisee's own presence, not a listing. */
export const SHARED_HOST_SIGNAL = 3;

/** How many distinct DECISIVE directory phrases decide on their own. Two:
 *  "Add your company" beside "Claim this listing" is a listing site's menu,
 *  and no contractor's site has both — not even one whose title happens to
 *  carry the business's name, which a directory's listing page does. */
export const DIRECTORY_PHRASES_DECISIVE = 2;

/**
 * Anchor text a listing site carries and a contractor's site does not.
 *
 * Each pattern names the PHRASE it is about, so a match can be reported as
 * "claim your listing" rather than as a regex, and carries how much it
 * proves:
 *
 *   decisive  no innocent reading on a business's own site. "Claim this
 *             listing", "Add your company for free", "Search the directory",
 *             "Browse by category". Two of these decide on their own, and
 *             one decides with any corroboration.
 *   strong    a listing site says it, and so does a manufacturer, a
 *             consultancy or a union local about ITSELF: "Find a dealer" on
 *             renostone.com, "Find your expert" over gardiner.com's people
 *             directory, "Become a member" on a bricklayers' local — all in
 *             the sample, none a listing of somebody else. Never decides
 *             against a title that names the business, and never with only
 *             a login form beside it.
 *   weak      "Member login". A union local, a supplier with a dealer portal
 *             and a contractor with a vendor portal all say it (all three
 *             were in the sample). Corroborates, never decides.
 *
 * Deliberately absent: "login", "register", "members", "search", "find a
 * location" on their own — a client-hub login, a newsletter signup and a
 * franchisor's locator would fire them.
 *
 * Only SAME-HOST links are read. A fence maker's "Find a distributor" and a
 * deck builder's footer link to trex.com/find-a-contractor were both in the
 * sample, and both are the business pointing elsewhere, not the site
 * describing itself. A path pattern shares its phrase name with the text
 * pattern it corresponds to, so "FIND A DEALER" → /find-a-dealer is ONE
 * observation and not two.
 */
const DIRECTORY_LINK_TEXT = Object.freeze([
  ["claim your listing", /\bclaim\s+(?:this|your)\s+(?:listing|profile|page|business)\b/i, "decisive"],
  ["list your business", /\b(?:list|add|register|submit|advertise)\s+(?:your|a|my|this)\s+(?:business|company|listing|practice|firm|service)\b/i, "decisive"],
  ["get listed", /\bget\s+listed\b|\bjoin\s+(?:the|our)\s+(?:directory|list)\b/i, "decisive"],
  ["become a member", /\bbecome\s+a\s+(?:member|provider|listed\s+provider)\b|\bjoin\s+(?:the|our)\s+network\b/i, "strong"],
  ["search the directory", /\b(?:search|browse)\s+(?:the\s+|our\s+)?(?:directory|listings?|providers|members|businesses|categories)\b/i, "decisive"],
  ["browse by category", /\b(?:browse|search)\s+by\s+(?:category|city|state|province|location|zip|trade)\b|\ball\s+categories\b/i, "decisive"],
  ["find a provider", /\bfind\s+(?:a|an|your)?\s*(?:provider|pro|professional|contractor|business|company|installer|dealer|member|cleaner|plumber|electrician|painter|roofer|specialist|expert)s?\b/i, "strong"],
  ["directory", /\b(?:business|service|provider|contractor|trade|member)s?\s+directory\b/i, "strong"],
  ["member login", /\b(?:member|provider|business|dealer|vendor|contractor|pro|agent)s?\s+(?:log-?\s?in|sign-?\s?in|area|portal)\b/i, "weak"],
]);

/** Same-host paths that only a listing site serves, named for the text
 *  phrase each corresponds to. */
const DIRECTORY_PATHS = Object.freeze([
  ["claim your listing", /(?:^|\/)claim[-_](?:listing|business|profile)/i, "decisive"],
  ["list your business", /(?:^|\/)(?:list|add|register|submit)[-_](?:your|a|my)[-_](?:business|company|listing)/i, "decisive"],
  ["search the directory", /(?:^|\/)listings?(?:\.php|\.aspx?|\.html?)?(?:\/|$|\?)/i, "decisive"],
  ["find a provider", /(?:^|\/)find[-_](?:a|an|your)[-_](?:provider|pro|professional|contractor|business|company|installer|dealer|member|cleaner|plumber|electrician|painter|roofer|specialist|expert)s?(?:\/|$|[?#.])/i, "strong"],
  ["directory", /(?:^|\/)directory(?:\/|$|\?|\.)/i, "strong"],
  ["member login", /(?:^|\/)(?:member|provider|dealer|vendor)s?[-_/](?:log-?in|sign-?in|area|section)/i, "weak"],
]);

/** A title that names a PAGE rather than a site. A brand read off one of
 *  these says nothing about whose site it is, so it is never a mismatch:
 *  "Home", "Contact", "Accueil" and "Services" were the commonest brands in
 *  the sample's mismatches, on sites that were plainly the business's own. */
const GENERIC_BRAND = /^(?:home|homepage|accueil|welcome|bienvenue|contact(?:\s*us)?|contactez[-\s]nous|about(?:\s*us)?|a\s*propos|services?|our\s+services|nos\s+services|faq|faqs|gallery|galerie|projects?|portfolio|blog|news|careers|index\s+of\s*\/?|my\s*(?:web)?site|mysite|website|site|untitled|new\s+page|page\s+not\s+found|not\s+found|error|coming\s+soon|under\s+construction|web\s+page\s+under\s+construction|account\s+suspended|domain\s+renewal\s+instructions|maintenance)$/i;

/** The path on the RECORD's URL, when it is a listing: plumbersnearyou.com/
 *  profile/cellino-plumbing-inc-elma-new-york.html, buildersinstitute.org/
 *  Contractor-SubContractor/Arnold-Wile-Associates-77. A franchise page is
 *  /locations/… or /houston and does not match. */
const LISTING_PATH = /(?:^|\/)(?:profiles?|listings?|directory|biz|businesses|companies|company|pros?|members?|vendors?|providers?|[a-z-]*contractors?)\/[^/]+/i;

/** A form field that asks WHERE — the thing a provider search asks and a
 *  site search does not. */
const LOCATION_FIELD = /^(?:city|town|state|province|region|zip|zipcode|zip_code|postal|postalcode|postal_code|postcode|country|location|loc|near|area)$/i;
/** A form action a provider search posts to. */
const SEARCH_ACTION = /(?:listing|directory|find|search|results|providers|members|locator)/i;

/** The registrable-ish host of a URL or bare host: lowercased, no port, no
 *  leading `www.`. No public-suffix list here, for the reason url.js gives —
 *  the platform list is suffix-matched instead. */
export function hostOfUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}

/** The path of a URL, or "/" for a bare host. What tells a franchise page
 *  (`/houston`) from a directory root. */
export function pathOfUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "/";
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return u.pathname || "/";
  } catch {
    return "/";
  }
}

/** Which of `list` the URL's host is on, by dot-anchored suffix, or null. */
function hostInList(hostOrUrl, list) {
  const h = hostOfUrl(hostOrUrl);
  if (!h) return null;
  return list.find((p) => h === p || h.endsWith(`.${p}`)) || null;
}

/** Which platform `hostOrUrl` is on, by host suffix or by a host+path
 *  prefix — or null. Takes the URL when the caller has it, because
 *  google.com/maps is a profile and sites.google.com is a site. */
export function platformProfileHost(hostOrUrl) {
  const byHost = hostInList(hostOrUrl, PLATFORM_PROFILE_HOSTS);
  if (byHost) return byHost;
  const h = hostOfUrl(hostOrUrl);
  if (!h) return null;
  const path = pathOfUrl(hostOrUrl).toLowerCase();
  const byPrefix = PLATFORM_PROFILE_URL_PREFIXES.find((p) => {
    const slash = p.indexOf("/");
    const pHost = p.slice(0, slash);
    const pPath = p.slice(slash);
    return (h === pHost || h.endsWith(`.${pHost}`)) && path.startsWith(pPath);
  });
  return byPrefix || null;
}

/** Which known directory `hostOrUrl` is on, or null. */
export function knownDirectoryHost(hostOrUrl) {
  return hostInList(hostOrUrl, KNOWN_DIRECTORY_HOSTS);
}

/** Is the record's URL a listing page — a profile slug on somebody's site? */
export function listingPath(url) {
  const path = pathOfUrl(url);
  return LISTING_PATH.test(path) ? path : null;
}

/** Does this href stay on the page's own host? A relative href does; an
 *  href with no parseable host is read as relative rather than as foreign. */
function sameHostLink(href, pageUrl) {
  const linkHost = hostOfUrl(href);
  if (!linkHost) return true;
  if (/^(?:mailto|tel|sms|javascript):/i.test(String(href))) return false;
  const pageHost = hostOfUrl(pageUrl);
  return !pageHost || linkHost === pageHost || linkHost.endsWith(`.${pageHost}`) || pageHost.endsWith(`.${linkHost}`);
}

/**
 * The name a site gives ITSELF: og:site_name when present, else the first
 * segment of the title — "Ethical Services | Carpet Cleaners | …" names
 * Ethical Services. Both are the site's own claim rather than a keyword.
 */
export function siteBrand(page) {
  const meta = page?.meta || {};
  const siteName = String(meta["og:site_name"] || "").trim();
  if (siteName) return siteName;
  const title = String(meta.title || "").trim();
  if (!title) return null;
  const first = title.split(/\s*[|–—:]\s*|\s+-\s+/)[0].trim();
  return first || title;
}

/**
 * The best brand across the loaded pages: the one the most pages agree on.
 * A site whose every title starts with the same words is naming itself; a
 * page whose title starts with "Contact" is not.
 */
export function dominantBrand(pages) {
  const counts = new Map();
  for (const page of pages) {
    const brand = siteBrand(page);
    if (!brand) continue;
    const key = fold(brand);
    if (!key) continue;
    const entry = counts.get(key) || { brand, n: 0 };
    entry.n += 1;
    counts.set(key, entry);
  }
  let best = null;
  for (const entry of counts.values()) {
    if (!best || entry.n > best.n) best = entry;
  }
  return best ? best.brand : null;
}

function tokensOfPath(url) {
  try {
    return new URL(String(url), "https://x.invalid").pathname;
  } catch {
    return String(url || "");
  }
}

/**
 * The directory signals on one crawl, each with the string that fired it.
 * Pure and exported so the check can execute it against a hostile page.
 *
 * @returns { phrases: [{ phrase, strength, value, sourceUrl }], searchForm,
 *            loginForm } — `phrases` are DISTINCT by phrase, so a menu on
 *            three pages is one observation each.
 */
export function directorySignals(pages) {
  const phrases = new Map(); // phrase → { strength, value, sourceUrl }
  const notePhrase = (phrase, strength, value, sourceUrl) => {
    if (!phrases.has(phrase)) phrases.set(phrase, { strength, value, sourceUrl });
  };
  let searchForm = null;
  let loginForm = null;

  for (const page of pages) {
    const url = page.finalUrl || page.url || null;

    for (const link of page.linkTexts || []) {
      if (!sameHostLink(link.href, url)) continue;
      for (const [phrase, re, strength] of DIRECTORY_LINK_TEXT) {
        if (re.test(link.text)) notePhrase(phrase, strength, link.text, url);
      }
    }
    for (const label of page.buttons || []) {
      for (const [phrase, re, strength] of DIRECTORY_LINK_TEXT) {
        if (re.test(label)) notePhrase(phrase, strength, label, url);
      }
    }
    for (const href of page.links || []) {
      if (!sameHostLink(href, url)) continue;
      const path = tokensOfPath(href);
      for (const [phrase, re, strength] of DIRECTORY_PATHS) {
        if (re.test(path)) notePhrase(phrase, strength, href, url);
      }
    }

    for (const form of page.forms || []) {
      const fields = form.fields || [];
      if (!loginForm && fields.some((f) => f.type === "password")) {
        loginForm = { value: form.action || form.id || "password field", sourceUrl: url };
      }
      if (!searchForm && form.method === "get") {
        const asksWhere = fields.some((f) => LOCATION_FIELD.test(f.name || ""));
        const postsToSearch = SEARCH_ACTION.test(tokensOfPath(form.action || ""));
        if (asksWhere && postsToSearch) {
          searchForm = {
            value: `${form.action || ""} ${fields.map((f) => f.name).filter(Boolean).join(",")}`.trim(),
            sourceUrl: url,
          };
        }
      }
    }
  }

  return {
    phrases: [...phrases.entries()].map(([phrase, hit]) => ({ phrase, ...hit })),
    searchForm,
    loginForm,
  };
}

/**
 * Does the site's brand carry the business's name?
 *
 *   "match"     every distinctive token of the name is in the brand or the
 *               title — the site names itself as this business.
 *   "mismatch"  the brand shares no token with the name at all.
 *   null        nothing to compare: no title, or a name with no usable token
 *               (a numbered company — see siteIdentity.js nameTokens).
 */
export function brandAgreement({ pages, businessName, alsoKnownAs = [] }) {
  const names = [businessName, ...(Array.isArray(alsoKnownAs) ? alsoKnownAs : [])].filter(Boolean);
  const tokenSets = names.map(nameTokens).filter((t) => t.length);
  if (!tokenSets.length) return { agreement: null, brand: dominantBrand(pages) };

  const brand = dominantBrand(pages);
  const titles = pages.map((p) => ` ${fold(p.meta?.title)} `).filter((t) => t.trim());
  if (!brand && !titles.length) return { agreement: null, brand: null };

  const brandFolded = ` ${fold(brand)} `;
  const generic = !brand || GENERIC_BRAND.test(String(brand).trim());
  for (const tokens of tokenSets) {
    const inTitle = titles.some((t) => tokens.every((tok) => t.includes(` ${tok} `) || t.includes(` ${tok}`)));
    if (inTitle) return { agreement: "match", brand };
  }
  // Prefix-tolerant, both ways: "KeyMe Locksmiths" shares a word with "24/7
  // Locksmith Services", and "minuteKEY" with "Minute Key". A mismatch is a
  // claim that the brand is SOMEBODY ELSE'S, and a plural or a run-together
  // spelling is not somebody else.
  const brandWords = fold(brand).split(" ").filter((w) => w.length >= 4);
  const anyShared = tokenSets.some((tokens) =>
    tokens.some((tok) => brandWords.some((w) => w.startsWith(tok) || tok.startsWith(w))),
  );
  if (brand && !generic && !anyShared) return { agreement: "mismatch", brand };
  return { agreement: null, brand };
}

/**
 * Classify the site on a prospect's record.
 *
 * @param pages            anything normaliseCrawl understands
 * @param businessName     the prospect's name
 * @param alsoKnownAs      trading names, when the source has them
 * @param host             the host of the URL on the record (or the URL)
 * @param websiteUrl       the URL itself, read only for its path
 * @param sharedHostCount  how many OTHER prospects list the same host. Passed
 *                         in — this file has no database — and null when the
 *                         caller did not count, which is never read as zero.
 *
 * @returns {{ kind, confidence, reasons: string[], brand: string|null,
 *             signals: object, evidence: object[] }}
 */
export function classifySiteKind({
  pages = null,
  businessName = "",
  alsoKnownAs = [],
  host = null,
  websiteUrl = null,
  sharedHostCount = null,
} = {}) {
  const reasons = [];
  const evidence = [];
  // Always normalised, never trusted to be: normaliseCrawl is idempotent
  // (technology.js, linkTexts) and a caller's "already normalised" object
  // can still carry a null page.
  const normalised = normaliseCrawl(pages);
  const loaded = loadedPages(normalised);
  const theHost = hostOfUrl(host || websiteUrl);
  const shared = Number.isInteger(sharedHostCount) ? sharedHostCount : null;

  // Evidence rows use the crawler's own TYPES where the observation honestly
  // is one — a menu item is a `link`, a search box is a `form`, a title is
  // `meta` — so lib/sales/prospectView.js's SIGNAL_BY_EVIDENCE_TYPE scores
  // them as it scores every other link, form and title. The host, the URL's
  // path and the shared-host count are observations about the RECORD rather
  // than the page and carry their own types, which contribute no confidence
  // signal; the `site_kind` row capabilityDetect.js writes above these is
  // what carries the verdict and its signal (detection.site_kind).
  const cite = (type, rawValue, normalizedValue, sourceUrl, confidence) => {
    evidence.push({
      type,
      source: "website",
      sourceUrl: sourceUrl || null,
      rawValue: String(rawValue ?? "").slice(0, 400),
      normalizedValue: String(normalizedValue ?? "").slice(0, 2000),
      confidence,
      detector: SITE_KIND_DETECTOR,
      detectorVersion: SITE_KIND_DETECTOR_VERSION,
    });
  };

  // ── 1. A platform host is a profile, whatever loaded ────────────────────
  const platform = platformProfileHost(websiteUrl || host);
  if (platform) {
    reasons.push(`host ${theHost} is ${platform}, a platform that hosts profiles, not a business's own site`);
    cite("site_kind_host", theHost, `${SITE_KIND_EVIDENCE_PREFIX}:platform_profile:${platform}`, websiteUrl || null, 0.95);
    return finish("platform_profile", 0.95);
  }

  // ── 1b. A known directory host is a directory, whatever loaded ──────────
  const knownDirectory = knownDirectoryHost(websiteUrl || host);
  if (knownDirectory) {
    reasons.push(`host ${theHost} is ${knownDirectory}, a business directory, not a business's own site`);
    cite("site_kind_host", theHost, `${SITE_KIND_EVIDENCE_PREFIX}:directory:${knownDirectory}`, websiteUrl || null, 0.95);
    return finish("directory", 0.95);
  }

  // ── 2. The URL on the record, before any page ───────────────────────────
  const listing = listingPath(websiteUrl);
  const sharedSignal = shared !== null && shared >= SHARED_HOST_SIGNAL;
  if (listing) {
    reasons.push(`the URL on the record is a listing page (${listing})`);
    cite("site_kind_url", listing, `${SITE_KIND_EVIDENCE_PREFIX}:listing_path`, websiteUrl || null, 0.5);
  }
  if (sharedSignal) {
    reasons.push(`${shared} other prospects list the same host (${theHost})`);
    cite("site_kind_shared_host", `${shared} other prospects list ${theHost}`, `${SITE_KIND_EVIDENCE_PREFIX}:shared_host:${shared}`, websiteUrl || null, 0.5);
  }

  // ── 3. Nothing loaded: only the URL can speak, and only when it is plain ─
  if (loaded.length === 0) {
    if (listing && sharedSignal) return finish("directory", 0.7);
    reasons.push(normalised.blocked ? "the site refused the crawl" : "no page loaded");
    return finish("unknown", 0);
  }

  // ── 4. The page signals ─────────────────────────────────────────────────
  const signals = directorySignals(loaded);
  const { agreement, brand } = brandAgreement({ pages: loaded, businessName, alsoKnownAs });
  for (const hit of signals.phrases) {
    reasons.push(`the site's own menu says "${hit.value}" (${hit.phrase})`);
    cite("link", hit.value, `${SITE_KIND_EVIDENCE_PREFIX}:nav:${hit.phrase}`, hit.sourceUrl, hit.strength === "decisive" ? 0.7 : hit.strength === "strong" ? 0.5 : 0.3);
  }
  if (signals.searchForm) {
    reasons.push(`a provider search form asks for a location (${signals.searchForm.value})`);
    cite("form", signals.searchForm.value, `${SITE_KIND_EVIDENCE_PREFIX}:provider_search_form`, signals.searchForm.sourceUrl, 0.6);
  }
  if (signals.loginForm) {
    reasons.push(`a login form with a password field sits on a marketing page (${signals.loginForm.value})`);
    cite("form", signals.loginForm.value, `${SITE_KIND_EVIDENCE_PREFIX}:login_form`, signals.loginForm.sourceUrl, 0.3);
  }
  if (agreement === "mismatch") {
    reasons.push(`the site calls itself "${brand}", which shares no word with "${businessName}"`);
    cite("meta", brand, `${SITE_KIND_EVIDENCE_PREFIX}:brand_mismatch`, loaded[0]?.finalUrl || null, 0.3);
  } else if (agreement === "match") {
    reasons.push(`the site's title carries the business's own name ("${brand || businessName}")`);
  }

  // ── 5. The ladder ───────────────────────────────────────────────────────
  //
  // Each rung names what decided it. A title carrying the business's name
  // is decisive for "own" against every signal except two decisive phrases
  // — because a directory titles the listing page after the business it
  // lists, and hub.biz gives every listing its own subdomain and its own
  // title — and a tally of weak signals never reaches "directory" alone.
  const decisive = signals.phrases.filter((p) => p.strength === "decisive");
  const strong = signals.phrases.filter((p) => p.strength === "strong");
  const weak = signals.phrases.filter((p) => p.strength === "weak");
  const corroborations =
    strong.length + weak.length +
    (signals.searchForm ? 1 : 0) + (signals.loginForm ? 1 : 0) +
    (sharedSignal ? 1 : 0) + (listing ? 1 : 0) + (agreement === "mismatch" ? 1 : 0);

  if (decisive.length >= DIRECTORY_PHRASES_DECISIVE) return finish("directory", 0.9);
  if (decisive.length === 1 && corroborations >= 1 && agreement !== "match") return finish("directory", 0.85);
  if (listing && (strong.length || sharedSignal || agreement === "mismatch") && agreement !== "match") {
    return finish("directory", 0.85);
  }
  if (agreement !== "match" && strong.length >= 1 && (signals.searchForm || sharedSignal || agreement === "mismatch" || strong.length >= 2)) {
    return finish("directory", strong.length >= 2 ? 0.8 : 0.7);
  }

  reasons.push(
    decisive.length || strong.length || weak.length || signals.searchForm || signals.loginForm || listing || sharedSignal
      ? "a listing-site signal on its own, not enough to say this is not their site"
      : "no listing-site signal on any rendered page",
  );
  return finish("own", agreement === "match" ? 0.9 : 0.6);

  function finish(kind, confidence) {
    return {
      kind,
      confidence,
      reasons,
      brand: loaded.length ? dominantBrand(loaded) : null,
      host: theHost,
      signals: { pagesConsidered: loaded.length, sharedHostCount: shared },
      // Evidence only for a kind that is a FINDING. "own" and "unknown" cite
      // nothing: the first is the premise every other detector already
      // holds, the second is an absence of a look.
      evidence: kind === "directory" || kind === "platform_profile" ? evidence : [],
    };
  }
}

/** True when the kind means "not a site of their own". The one predicate
 *  every consumer gates on, so no consumer spells the pair itself. */
export function notTheirOwnSite(kind) {
  return kind === "directory" || kind === "platform_profile";
}

/**
 * The kind, read back off stored WEBSITE-capability evidence rows.
 *
 * The verdict row capabilityDetect.js writes is `site_kind:<kind>:<host>`
 * with `brand=<the site's own title>` as its rawValue; the classifier's own
 * rows beneath it spell `site_kind:<kind>:<list entry>` and carry no brand.
 * The verdict row wins when both are present, and either alone still names
 * the kind. Null when no row says. Browser-safe — prospectView.js calls it.
 *
 * @returns {{ kind, brand: string|null, host: string|null }|null}
 */
export function siteKindFromEvidence(rows = []) {
  let fallback = null;
  for (const row of Array.isArray(rows) ? rows : []) {
    const value = String(row?.normalizedValue || "");
    const m = new RegExp(`^${SITE_KIND_EVIDENCE_PREFIX}:(directory|platform_profile)(?::(.*))?$`).exec(value);
    if (!m) continue;
    const raw = String(row?.rawValue || "");
    const b = /^brand=(.*)$/s.exec(raw);
    const found = { kind: m[1], brand: b ? b[1].trim() || null : null, host: m[2] ? m[2].trim() || null : null };
    if (b) return found;
    if (!fallback) fallback = { ...found, host: null };
  }
  return fallback;
}
