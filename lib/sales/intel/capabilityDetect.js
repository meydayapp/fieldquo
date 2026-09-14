// lib/sales/intel/capabilityDetect.js
//
// What a prospect's website can DO — online booking, a contact form, a way to
// pay, a chat box — read off crawled pages and written as `ProspectCapability`
// rows.
//
// ══ THE ONE THING THIS FILE EXISTS TO GET RIGHT ════════════════════════════
//
// `ProspectCapability.value` is three-valued and `null` IS NOT `false`.
//
//   true   we looked and it is there
//   false  we looked and it is not there
//   null   we did not manage to look
//
// The opportunity engine fires its rules on `value === false` and deliberately
// does not fire on null — `evaluateCondition` in opportunity.js has a comment
// calling that "THE line". This file is the other half of that contract: if a
// crawler that was rate-limited on the way to /booking writes `false`, the
// engine is working perfectly and a rep still opens a cold call by telling a
// contractor they have no booking page, about a business that has one. That
// call ends in thirty seconds and does not get a second one.
//
// So absence is EARNED, never defaulted. The rule, in one sentence:
//
//   A capability is false only when at least one page actually rendered, no
//   page in the crawl was blocked or errored, the crawl did not say of itself
//   that it was incomplete, and — for a capability whose signal lives beyond
//   the front page — the crawler reached more than the front page by
//   FOLLOWING THE SITE'S OWN NAVIGATION rather than by guessing URLs, and,
//   for the enquiry form, actually fetched a contact-like page (or the front
//   page itself carried a form).
//
// Everything else is null. `absenceEligibility()` below is the only place that
// decides it, and `detectCapabilities` cannot produce a false without it.
//
// ══ A guessed crawl is not a look ══════════════════════════════════════════
//
// The clause about navigation was added after a real one. A gutter company's
// home page linked to `/contact_us`; the crawler recognised only `/about`,
// decided the menu had told it nothing, probed `/contact` and `/services`
// blind, got two 404s — and this file counted `/` plus `/about` as "looked
// beyond the front page" and wrote "no enquiry form" about a site with a form
// on it. The crawler now stamps every page with how it was reached
// (`via`: start, nav, probe — lib/sales/crawl/evidence.js), and a crawl whose
// only pages beyond the front door were probes cannot support a deep
// absence, however many of them rendered.
//
// ══ A directory is not their site, and nothing on it is a look at theirs ══
//
// Ring A Ling Upholstery & Carpet Cleaners' record pointed at
// www.ethicalservices.com, a carpet-cleaner directory. Three pages rendered,
// the navigation was followed, a mailto: was found, no form was — and every
// reading was true of the DIRECTORY. This file wrote "has a website", "no
// enquiry form", "no client portal" (the member login on /contact.php was
// the directory's), and the directory's own service@ address became the
// lead's email. lib/sales/intel/siteKind.js now says whose site it is, and
// when the answer is a directory or a platform profile:
//
//   WEBSITE            false — a listing is not a website of their own, and
//                      the NO_WEBSITE pitch is the right one. The evidence
//                      carries `site_kind:<kind>` so the screen can say
//                      "a directory (Ethical Services)" rather than "none".
//   EMAIL / PHONE      kept as observed, if observed: an address on the
//                      listing is a real fact with a real sourceUrl, and the
//                      screen says it is on the directory. Never FALSE — the
//                      directory not printing their phone says nothing.
//   everything else    NULL, whatever the pages carried. A booking widget
//                      on a directory books the directory's leads; a form on
//                      it is the directory's form. Never false: nobody has
//                      looked at THEIR site, because there may not be one.
//
// `unknown` — nothing loaded and the host is not on a list — changes
// nothing here. An unknown kind must not turn a real site into "no website".
//
// ══ A site drawn by JavaScript has not been read, and says so (version 4) ═
//
// A crawler that does not run scripts fetches a Next.js, Nuxt, Wix or
// Webflow site and gets a 200, a body of a few hundred bytes, two links and
// a bundle. looksRendered() already refused to count such a page as
// rendered; what it did not do was SAY so. The owner's concern, verbatim:
// "not properly reading the website and making false claims which then
// create a false interpretation of what they have or might not have". So
// jsShell() names the case — a framework marker beside a body with no
// links or no text — and when a crawl has one, every absence is refused with
// the reason `js_shell`, and every null verdict cites a `crawl_quality`
// evidence row whose text is "site is rendered by JavaScript; we could not
// read it", so the rep's screen can say that instead of "not established".
//
// The one thing that softens it: lib/sales/crawl/structured.js recovers the
// copy from the framework's own payload (`__NEXT_DATA__` and its cousins)
// as `rendered_text`. A shell WITH recovered text is read for PRESENCE —
// hours, a phone, an email, a "book online" in its copy — and never for
// absence: the payload holds the words, not the forms or the widgets.
//
// ══ Every verdict cites what it rests on ══════════════════════════════════
//
// A true cites the signal rows; a false cites the pages searched; and now a
// null cites the reason it is null. `ProspectCapability.evidenceIds` was
// empty for a null, so the screen could only say "we could not look" — the
// same sentence for a blocked host, a front-page-only crawl, a directory and
// a JavaScript shell, which are four different conversations with a rep.
//
// ══ "The crawl said nothing about completeness" is not "the crawl was complete"
//
// `crawl.complete` is three-valued too. An explicit `false` VETOES concluding
// absence. A `null` is not read as true and is not read as false either —
// nothing is inferred from it at all. What earns absence is the OBSERVED page
// outcomes, which is a real reading of real data rather than a default
// standing in for a missing statement (AGENTS.md failure class 5).
//
// ══ A rendered page is not the same as a 200 ══════════════════════════════
//
// A site whose navigation is built by JavaScript hands a non-executing crawler
// a 200, a body, and no links. Reading that as "no booking page" would be the
// same false absence arriving through a different door. So eligibility
// requires a page that looks RENDERED — a body of real size carrying at least
// one link — and a shell does not qualify.
//
// ══ Why the codes are not the ones a brief will ask for ═══════════════════
//
// The vocabulary is `OBSERVABLE_CAPABILITY_CODES` in capabilities.js, and it
// is declared on the READING side on purpose: a rule conditioning on a code no
// detector emits can never fire, and a detector emitting a code no rule reads
// writes rows nobody looks at. Both are AGENTS.md's first failure class from
// opposite ends. So EMAIL_ONLY_CONTACT is not a code here — "only" is composed
// by a rule out of EMAIL_CONTACT true and LEAD_CAPTURE_FORM false, which is
// how EMAIL_ONLY_CONTACT is actually spelled in rules.js — and CONTACT_FORM
// and QUOTE_REQUEST_FORM are one code, LEAD_CAPTURE_FORM, because no rule
// distinguishes them and a detector cannot honestly tell them apart anyway.
import { OBSERVABLE_CAPABILITY_CODES } from "./capabilities";
import { SITE_KIND_EVIDENCE_PREFIX, notTheirOwnSite } from "./siteKind";
import { schemaFacts } from "./schemaFacts";
import { slugKind } from "@/lib/sales/crawl/url";
import {
  combineWeights,
  contentSize,
  hostMatches,
  hostOf,
  loadedPages,
  markupOf,
  normaliseCrawl,
  splitUrlPattern,
} from "./technology";

export const CAPABILITY_DETECTOR = "capability";
/** Bumped when a change alters what this detector DECIDES. "2": absence is
 *  refused from a probed crawl and "no enquiry form" needs a contact-like
 *  page — so a "1" false may be unearned, and analyzeCapabilities.js lets a
 *  "2" null supersede it. "3": a directory or a platform profile on the
 *  record makes WEBSITE false and every non-contact capability null, so a
 *  "2" false read off a directory's pages is superseded the same way.
 *  "4": a crawl holding a JavaScript shell refuses every absence
 *  (`js_shell`), a page reached through the sitemap counts as navigation
 *  followed, schema.org facts (telephone, email, ReserveAction, Review)
 *  prove presence, and a null verdict cites a `crawl_quality` row naming
 *  its reason. A "3" false written off a shell's two rendered pages is
 *  superseded by the "4" null. */
export const CAPABILITY_DETECTOR_VERSION = "4";

/** The evidence type on the row a NULL verdict cites. Not a signal —
 *  prospectView's signal table has no entry for it, deliberately, so it can
 *  never raise a confidence — but a row with a sourceUrl and a sentence. */
export const CRAWL_QUALITY_EVIDENCE = "crawl_quality";

/** The sentence a js_shell null carries. Read verbatim by the screen. */
export const JS_SHELL_SENTENCE = "site is rendered by JavaScript; we could not read it";

/** The capabilities a listing page may still answer TRUE for: a contact
 *  printed on the listing is a fact about the business, with the listing as
 *  its sourceUrl. Everything else on a directory is the directory's. */
const KEPT_ON_A_LISTING = new Set(["EMAIL_CONTACT", "PHONE_CONTACT"]);

/** A body smaller than this is a shell, an error page, or a redirect stub. */
const MIN_RENDERED_HTML = 300;

/** "More than the front page." Two is the weakest honest reading of that, and
 *  it is what separates a crawler that followed the navigation from one that
 *  fetched the root and stopped. */
const MIN_PAGES_FOR_DEEP = 2;

/** Absence never scores higher than this. You cannot prove a negative from a
 *  crawl; the most this says is "we looked hard and did not find it". */
const MAX_ABSENCE_CONFIDENCE = 0.85;

/** The navigation kinds (lib/sales/crawl/url.js PRIORITY_PAGES) a page must
 *  have been ranked as for "no enquiry form" to mean anything: a contact page
 *  or a quote-request page. A site whose form lives on `/get-a-quote` and
 *  whose crawl never fetched it has not been searched for a form. */
const CONTACT_LIKE_KINDS = new Set(["contact", "quote"]);

/**
 * Where a capability's signal lives, which is what decides how much crawling
 * has to have happened before its ABSENCE means anything.
 *
 *   site_wide  the signal is in the chrome — a chat script, a tel: link in the
 *              header, hours in the footer. One rendered page has seen it.
 *   deep       the signal is a page or a link into one. A crawler that fetched
 *              only the front page has not looked.
 *   discovery  not a crawl question at all. WEBSITE is decided by whether
 *              discovery found a site, not by what is on it.
 */
export const ABSENCE_SCOPE = Object.freeze({
  WEBSITE: "discovery",
  ONLINE_BOOKING: "deep",
  INSTANT_ESTIMATE: "deep",
  LEAD_CAPTURE_FORM: "deep",
  CLIENT_PORTAL: "deep",
  ONLINE_PAYMENT: "deep",
  ONLINE_REVIEWS: "deep",
  LIVE_CHAT: "site_wide",
  PUBLISHED_HOURS: "site_wide",
  EMAIL_CONTACT: "site_wide",
  PHONE_CONTACT: "site_wide",
});

/** The codes this detector produces. Asserted against the reading side rather
 *  than assumed to agree with it — see the header. */
export const DETECTED_CAPABILITY_CODES = Object.freeze(Object.keys(ABSENCE_SCOPE));

/** What a technology alone says about a capability, when the product IS the
 *  capability. Never 1.0 — the markup could be a stale snippet. */
const TECHNOLOGY_WEIGHT = 0.9;

/**
 * Technologies that PROVE a capability, because the product is the capability.
 *
 * Deliberately conservative. Birdeye and Podium both sell chat AND reviews on
 * one script host, so a Birdeye script cannot tell you which one this
 * contractor bought. Birdeye is therefore mapped to reviews only (its
 * flagship) and Podium to chat only (likewise), and neither is mapped to both
 * — claiming a capability from a script that might be the vendor's other
 * product is exactly the over-claim the fact layer exists to prevent.
 *
 * An entry is a code (at TECHNOLOGY_WEIGHT) or `{ code, weight }`. vcita's
 * LiveSite is the second kind: it IS a client portal, a scheduler and a
 * payments page — a homeowner clicks "My Account", "Schedule Now", "Make a
 * Payment" on the widget — so the same "product is the capability" logic as
 * Jobber applies. One notch lower, because each of those actions is a switch
 * in the vendor's dashboard and a contractor can turn payments off; a Jobber
 * client hub cannot be bought without the hub. Townsquare Interactive's
 * white-label of the same widget is matched INTO the vcita signature
 * (signatureSeed.js), so it proves the same things through the same row; the
 * agency's own credit link is a separate signature and proves nothing.
 */
const CAPABILITY_FROM_TECHNOLOGY = Object.freeze({
  ONLINE_BOOKING: [
    "JOBBER",
    "HOUSECALL_PRO",
    "SERVICETITAN",
    "WORKIZ",
    "CALENDLY",
    "ACUITY_SCHEDULING",
    { code: "VCITA_LIVESITE", weight: 0.7 },
  ],
  LEAD_CAPTURE_FORM: ["JOBBER", "MARKATE", { code: "VCITA_LIVESITE", weight: 0.7 }],
  LIVE_CHAT: ["TAWK_TO", "INTERCOM", "PODIUM", "FACEBOOK_CHAT_PLUGIN"],
  ONLINE_PAYMENT: ["STRIPE_PAYMENTS", "SQUARE_PAYMENTS", { code: "VCITA_LIVESITE", weight: 0.7 }],
  CLIENT_PORTAL: [{ code: "VCITA_LIVESITE", weight: 0.7 }],
  ONLINE_REVIEWS: ["BIRDEYE"],
});

/** One entry of CAPABILITY_FROM_TECHNOLOGY as { code, weight }. */
function technologyProof(entry) {
  if (typeof entry === "string") return { code: entry, weight: TECHNOLOGY_WEIGHT };
  return { code: entry?.code, weight: Number.isFinite(entry?.weight) ? entry.weight : TECHNOLOGY_WEIGHT };
}

/** Every technology code that proves `code`, for callers that only want the
 *  names (the check, and the rep's screen). */
export function technologiesProving(code) {
  return (CAPABILITY_FROM_TECHNOLOGY[code] || []).map((e) => technologyProof(e).code);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Crawl quality — the gate everything else depends on
   ═══════════════════════════════════════════════════════════════════ */

/** A page that looks like a real rendered document rather than a shell. */
export function looksRendered(page) {
  if (!page || page.ok !== true) return false;
  // Measured on whatever the extractor kept — raw markup or extracted text.
  // See technology.js's contentSize: the crawler in this repo stores the
  // second, and a check against `html.length` alone would call every real page
  // a shell.
  if (contentSize(page) < MIN_RENDERED_HTML) return false;
  // No links at all is the fingerprint of a JavaScript-rendered site handed to
  // a crawler that does not execute JavaScript. The body is there and the site
  // is not, and reading that as "nothing on offer" is a false absence.
  //
  // Asked of the CRAWLER'S count when the crawler recorded one, and of the rows
  // only when it did not. lib/sales/crawl/evidence.js stores each distinct link
  // once per crawl rather than once per page, so page four of a site whose
  // every link is the shared navigation contributes no link rows of its own —
  // and counting rows here would call that page a shell, withdraw it from the
  // rendered set, and take a real site's absence claims down with it. The count
  // is an observation about the page; the rows are a storage decision.
  return linkCountOf(page) > 0;
}

/** How many links the page carried, as the crawler counted them — falling back
 *  to the rows we kept for a snapshot that carries no count, which is every
 *  inline payload and every evidence row written before the count existed. */
export function linkCountOf(page) {
  return Number.isInteger(page?.linkCount) ? page.linkCount : (page?.links || []).length;
}

/** A page with this many links or fewer, beside a framework marker, is a
 *  shell: the menu lives in the bundle. Two, not zero — a shell commonly
 *  carries a "skip to content" anchor and a logo link. */
const SHELL_MAX_LINKS = 2;

/** The script URLs and data-* attributes a client-rendering framework leaves
 *  in the document it hands a non-executing reader. Each is a marker, never
 *  a verdict: a server-rendered Next.js site carries `/_next/static/` beside
 *  forty links and a full body, and is not a shell. */
export const SPA_MARKERS = Object.freeze([
  { name: "next", script: /\/_next\/static\//i },
  { name: "nuxt", script: /\/_nuxt\//i },
  { name: "wix", script: /static\.parastorage\.com|static\.wixstatic\.com/i },
  { name: "webflow", script: /webflow\.js|\.website-files\.com\/.*webflow/i },
  { name: "squarespace", script: /static1\.squarespace\.com|sqs-cdn|squarespace\.com\/universal/i },
  { name: "angular", script: /\/(?:main|polyfills|runtime)(?:[.-][0-9a-z]{6,})?\.js$/i },
  { name: "react", script: /\/(?:react|react-dom)(?:[.-][\w.]+)?\.(?:production\.)?min\.js|\/static\/js\/main\.[0-9a-f]{8}\.js/i },
  { name: "vue", script: /\/vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js$/i },
  { name: "react", attr: /^data-react(?:root|id)=/i },
  { name: "vue", attr: /^data-(?:v-app|server-rendered)=/i },
  { name: "nuxt", attr: /^data-n-head=/i },
  { name: "webflow", attr: /^data-wf-(?:page|site)=/i },
  { name: "wix", attr: /^data-mesh-id=/i },
]);

/**
 * Is this loaded page a JavaScript shell — a document whose content a
 * browser would draw and this crawler cannot?
 *
 * Two conditions, both required: the page is EMPTY to a non-executing
 * reader (no links to speak of, or no body to speak of), AND a framework
 * left its marker — a bundle path, a hydration attribute, or a payload the
 * extractor already recovered text from. A page that is merely thin, with
 * no marker, is a thin page and not a shell; a page with a marker and a
 * full body is server-rendered and is read normally.
 *
 * @returns { marker } or null
 */
export function jsShell(page) {
  // `ok` is false for a 200 with NO document at all (technology.js
  // normalisePage) — which is exactly what a shell with an empty <body>
  // is. So the question is "did the server answer 2xx without error",
  // not "did a document load".
  if (!page || page.error || !Number.isInteger(page.status) || page.status < 200 || page.status >= 300) return null;
  const links = linkCountOf(page);
  const thin = links <= SHELL_MAX_LINKS || contentSize(page) < MIN_RENDERED_HTML;
  if (!thin) return null;
  for (const m of SPA_MARKERS) {
    if (m.script) {
      for (const url of page.scripts || []) if (m.script.test(String(url))) return { marker: m.name };
    }
    if (m.attr) {
      for (const attr of page.domAttrs || []) if (m.attr.test(String(attr))) return { marker: m.name };
    }
  }
  if (typeof page.renderedText === "string" && page.renderedText) return { marker: "payload" };
  return null;
}

/** A shell whose copy structured.js recovered, readable for PRESENCE only:
 *  the recovered strings are appended to `text` so the text signals see
 *  them, and `recovered: true` marks the page so no absence rule counts it. */
function recoveredShell(page) {
  const shell = jsShell(page);
  if (!shell || !page.renderedText) return null;
  return { ...page, text: [page.text, page.renderedText].filter(Boolean).join("\n"), recovered: true, shellMarker: shell.marker };
}

/** The pages presence may be read from: every rendered page, plus every
 *  shell with recovered copy. Absence is decided elsewhere and never from
 *  the second group. */
export function readablePages(crawl) {
  const out = [];
  for (const page of loadedPages(crawl)) {
    if (looksRendered(page)) out.push(page);
    else {
      const recovered = recoveredShell(page);
      if (recovered) out.push(recovered);
    }
  }
  return out;
}

/**
 * How a page was reached, read off the crawler's stamp with a fallback for
 * rows written before the stamp existed: a page whose path the ranking would
 * have recognised is treated as that kind. The fallback never invents "nav"
 * — a `/contact` fetched by an old crawl may have been a probe, and only the
 * crawler knew.
 */
function provenanceOf(page) {
  const via = page?.via || null;
  let navMatch = page?.navMatch || null;
  if (!navMatch) {
    let path = null;
    try {
      path = new URL(page?.finalUrl || page?.url || "").pathname;
    } catch {
      path = null;
    }
    if (path !== null) navMatch = slugKind(path).kind || null;
  }
  return { via, navMatch };
}

/**
 * May this crawl support a claim of ABSENCE, and at which scope.
 *
 * The single decision point. Everything about null-versus-false in this file
 * runs through here, so there is exactly one place to read, one place to
 * break in a mutation test, and no second path that could disagree.
 *
 * Returns, besides `siteWide` and `deep`:
 *   navigation   "followed" — a page beyond the front door rendered and was
 *                reached by a link the site published;
 *                "probed"   — the crawler guessed, and nothing it reached by
 *                a real link rendered;
 *                "unknown"  — no page carries a `via` (rows older than the
 *                stamp). Judged by the older rule, not promoted to either.
 *   contactPage  a rendered page was ranked contact-like, or a rendered page
 *                carried a <form> at all (a page with a search box on it HAS
 *                been searched for a form, and found only a search box).
 *                Required for LEAD_CAPTURE_FORM.
 */
export function absenceEligibility(crawl) {
  const normalised = crawl && Array.isArray(crawl.pages) ? crawl : normaliseCrawl(crawl);
  const pages = normalised.pages;
  const ok = loadedPages(normalised);
  const rendered = pages.filter(looksRendered);

  // Over every page, not only the `ok` ones: a shell with an empty body is
  // a 2xx that normalisePage marks not-ok for having no document.
  const shells = pages.filter((p) => jsShell(p));

  const deny = (reason) => ({
    siteWide: false,
    deep: false,
    reason,
    rendered: rendered.length,
    shells: shells.length,
    navigation: "unknown",
    contactPage: false,
  });

  // A transport failure on the crawl as a whole. We never got to look.
  if (normalised.error) return deny("crawl_error");
  // Somebody refused us. The page might say anything.
  if (normalised.blocked) return deny("blocked");
  if (pages.length === 0) return deny("no_pages");
  // A JavaScript shell anywhere in the crawl. The site's content is in a
  // bundle this crawler does not run, so nothing about the site is absent
  // — site-wide signals included: a shell has no header for a tel: link to
  // be missing from. Checked before "no page loaded" and "no page
  // rendered", because an empty-bodied shell IS both of those and the
  // reason must name the cause rather than the symptom.
  if (shells.length > 0) return deny("js_shell");
  if (ok.length === 0) return deny("no_page_loaded");
  if (rendered.length === 0) return deny("no_page_rendered");
  // A page that errored inside an otherwise fine crawl still means part of the
  // site was not seen. A 404 is NOT an error here — a crawler that asked for
  // /booking and was told it does not exist has learned something real — so
  // this only catches transport failures and refusals, which normalisePage
  // already separated from status codes.
  if (pages.some((p) => p.error)) return deny("page_error");

  // ── Did the crawler follow the site, or guess at it? ──────────────────
  //
  // Read off every page, rendered or not: the probe that 404'd is the one
  // that says a guess was made. "followed" needs a RENDERED page reached by
  // navigation — a nav link that 404'd is not a look either.
  const stamped = pages.some((p) => p.via);
  // A URL the site's own sitemap published is the site's word as much as a
  // link is (lib/sales/crawl/sitemap.js), and a page reached through it was
  // not guessed at.
  const followed = rendered.some((p) => p.via === "nav" || p.via === "sitemap");
  const guessed = pages.some((p) => p.via === "probe");
  const navigation = !stamped ? "unknown" : followed ? "followed" : guessed ? "probed" : "unknown";

  // ── Was a page a form would live on actually searched for one? ────────
  const contactPage = rendered.some((p) => {
    if ((p.forms || []).length > 0) return true;
    const { navMatch } = provenanceOf(p);
    return Boolean(navMatch && CONTACT_LIKE_KINDS.has(navMatch));
  });

  // An explicit statement that the crawl did not finish vetoes the deep claim
  // and only the deep claim: the chrome on the pages we DID render is still
  // fully observed. So does a crawl that reached its second page by guessing.
  const complete = normalised.complete;
  const deep = complete !== false && rendered.length >= MIN_PAGES_FOR_DEEP && navigation !== "probed";

  return {
    siteWide: true,
    deep,
    reason: deep
      ? null
      : complete === false
        ? "crawl_incomplete"
        : navigation === "probed"
          ? "probe_fallback"
          : "front_page_only",
    rendered: rendered.length,
    shells: shells.length,
    navigation,
    contactPage,
  };
}

/**
 * How sure an absence is.
 *
 * A ladder rather than a formula, because there is no measurement here to do
 * arithmetic on — it is a judgement about how much looking happened, and a
 * spurious decimal would dress it up as one. Ceilinged at 0.85 forever.
 */
export function absenceConfidence(crawl, eligibility) {
  const normalised = crawl && Array.isArray(crawl.pages) ? crawl : normaliseCrawl(crawl);
  let value = 0.6;
  if ((eligibility?.rendered || 0) >= 3) value += 0.1;
  if (normalised.complete === true) value += 0.15;
  return Math.round(Math.min(value, MAX_ABSENCE_CONFIDENCE) * 100) / 100;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Signal helpers — every one returns the STRING THAT MATCHED
   ═══════════════════════════════════════════════════════════════════ */

function evidenceRow(page, { type, value, normalized, weight }) {
  return {
    type,
    source: "website",
    sourceUrl: page?.finalUrl ?? null,
    rawValue: clip(value),
    normalizedValue: normalized,
    confidence: Math.min(Math.max(weight, 0), 1),
    detector: CAPABILITY_DETECTOR,
    detectorVersion: CAPABILITY_DETECTOR_VERSION,
  };
}

function clip(value) {
  const s = String(value ?? "");
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}

/** Any URL in `lists` whose host matches one of `hosts` (suffix, dot-anchored)
 *  and whose path contains the pattern's path fragment when it has one. */
function urlHit(page, lists, patterns) {
  for (const list of lists) {
    for (const value of list) {
      for (const pattern of patterns) {
        const { host, path } = splitUrlPattern(pattern);
        if (host && !hostMatches(hostOf(value), host)) continue;
        if (!host && !path) continue;
        if (path && !tail(value).includes(path)) continue;
        if (!host && path && !tail(value).includes(path)) continue;
        return { value, pattern };
      }
    }
  }
  return null;
}

function tail(value) {
  const raw = String(value || "").toLowerCase();
  const cut = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const slash = cut.indexOf("/");
  return (slash === -1 ? "" : cut.slice(slash + 1)).replace(/^\/+/, "");
}

/** A link on this page whose PATH matches a regex — an internal route, not a
 *  third-party host. */
function pathHit(page, re) {
  for (const href of page.links) {
    const path = `/${tail(href)}`;
    if (re.test(path)) return { value: href };
  }
  return null;
}

function htmlHit(page, re) {
  const m = markupOf(page).match(re);
  return m ? { value: m[0] } : null;
}

/**
 * A link or button whose LABEL says what it does, pointing somewhere internal.
 *
 * The crawler keeps anchor text for exactly this: a route called /contact-us-2
 * with a button that says "Book Online" is a booking affordance, and the URL
 * alone cannot tell you. A label is structural here — it is an element's own
 * text, not a sentence in a paragraph — which is why it may set a capability
 * true where a prose phrase may not.
 */
function labelHit(page, re) {
  for (const link of page.linkTexts || []) {
    if (re.test(link.text)) return { value: `${link.text} → ${link.href || ""}`.trim() };
  }
  for (const label of page.buttons || []) {
    if (re.test(label)) return { value: label };
  }
  return null;
}

function textHit(page, re) {
  const m = typeof page.text === "string" ? page.text.match(re) : null;
  return m ? { value: m[0] } : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Is this form a lead capture form, or the search box?
   ═══════════════════════════════════════════════════════════════════ */

const FORM_DISQUALIFIERS = /search|newsletter|subscribe|mailchimp|login|log-in|sign-?in|password|cart|checkout|coupon/i;

/**
 * A form that a homeowner could send an enquiry through.
 *
 * The bar is two DIFFERENT contact categories, or one plus a free-text box.
 * A single email input is a newsletter signup; an email input beside a message
 * textarea is somebody asking for a quote. Getting this wrong in the generous
 * direction turns every mailing-list widget in the trade into "they have a
 * lead capture form", which silences the one rule most likely to be true.
 */
export function isLeadCaptureForm(form) {
  if (!form) return false;
  const label = [form.id, form.className, form.action].filter(Boolean).join(" ");
  if (FORM_DISQUALIFIERS.test(label)) return false;

  const categories = new Set();
  let freeText = false;
  for (const field of form.fields || []) {
    const key = `${field.name} ${field.placeholder}`.toLowerCase();
    const type = field.type;
    if (type === "password") return false;
    if (type === "email" || /\bemail\b|e-?mail/.test(key)) categories.add("email");
    else if (type === "tel" || /phone|tel\b|mobile/.test(key)) categories.add("phone");
    else if (/name/.test(key)) categories.add("name");
    else if (/zip|postal|address|street|suburb/.test(key)) categories.add("address");
    else if (/service|job|project|trade|reason|subject/.test(key)) categories.add("job");
    // `tag` OR `type`: the crawler's stored form row keeps only { name, type,
    // required }, and a <textarea> lands there with type "textarea". Reading
    // one spelling would have made every stored form look like it had no
    // message box.
    if (field.tag === "textarea" || type === "textarea" || /message|comment|detail|describe|note|enquir|inquir/.test(key)) {
      freeText = true;
      categories.add("message");
    }
  }

  if (categories.size >= 2) return true;
  return categories.size === 1 && freeText;
}

/* ═══════════════════════════════════════════════════════════════════════════
   The signals
   ═══════════════════════════════════════════════════════════════════ */

const BOOKING_HOSTS = [
  "calendly.com",
  "acuityscheduling.com",
  "book.housecallpro.com",
  "online-booking.housecallpro.com",
  "online-booking.workiz.com",
  "go.servicetitan.com/webscheduler",
  "squareup.com/appointments",
  "book.squareup.com",
  "setmore.com",
  "simplybook.me",
  "housecallpro.com/book",
];

const PAYMENT_HOSTS = [
  "checkout.stripe.com",
  "buy.stripe.com",
  "billing.stripe.com",
  "invoice.stripe.com",
  "squareup.com",
  "square.site",
  "paypal.com/paypalme",
  "paypal.me",
  "clover.com",
];

const PORTAL_HOSTS = ["clienthub.getjobber.com", "portal.housecallpro.com"];

const REVIEW_HOSTS = [
  "trustpilot.com/trustbox",
  "widget.trustpilot.com",
  "elfsight.com",
  "sociablekit.com",
  "reviewsonmywebsite.com",
  "shopperapproved.com",
];

/**
 * Every signal, per capability.
 *
 * `strong: true` means the signal is STRUCTURAL — a URL, a form, a detected
 * technology, a schema.org block. `strong: false` means it is a phrase in the
 * page's own prose. A capability is only set TRUE when at least one strong
 * signal fired; prose can raise the confidence of a real finding and can never
 * manufacture one. Same discipline, and the same reason, as technology.js's
 * LOOSE_CEILING: "we can help you book online" appears on the site of a
 * contractor who wants you to telephone.
 */
/** A fact the page's own JSON-LD states — see schemaFacts.js. The value is
 *  the fact as stated, so the evidence row is reviewable. */
function schemaHit(page, pick) {
  const facts = schemaFacts(page);
  if (!facts.parsed) return null;
  const value = pick(facts);
  return value ? { value: String(value).slice(0, 200) } : null;
}

const SIGNALS = {
  ONLINE_BOOKING: [
    { id: "booking_widget_host", weight: 0.9, strong: true, type: "iframe_host", find: (p) => urlHit(p, [p.iframes], BOOKING_HOSTS) },
    // schema.org potentialAction of ReserveAction / ScheduleAction: the
    // site telling search engines it takes bookings. Structural, one notch
    // under a widget host because a copied template can carry it.
    { id: "schema_booking_action", weight: 0.7, strong: true, type: "schema_org", find: (p) => schemaHit(p, (f) => f.bookingAction && `potentialAction: ${f.bookingAction}`) },
    { id: "schema_accepts_reservations", weight: 0.25, strong: false, type: "schema_org", find: (p) => schemaHit(p, (f) => f.acceptsReservations && "acceptsReservations: true") },
    { id: "booking_link_host", weight: 0.8, strong: true, type: "link", find: (p) => urlHit(p, [p.links], BOOKING_HOSTS) },
    { id: "booking_script_host", weight: 0.8, strong: true, type: "script_src", find: (p) => urlHit(p, [p.scripts], BOOKING_HOSTS) },
    {
      id: "booking_path",
      weight: 0.65,
      strong: true,
      type: "link",
      find: (p) => pathHit(p, /(^|\/)(book|book-now|book-online|booking|schedule|scheduling|appointments?|request-(?:an-)?appointment)(\/|$|[?#])/i),
    },
    { id: "booking_label", weight: 0.6, strong: true, type: "button", find: (p) => labelHit(p, /^\s*(book (?:online|now|an appointment|a visit)|schedule (?:online|now|an appointment)|request an appointment)\b/i) },
    { id: "booking_phrase", weight: 0.3, strong: false, type: "page_content", find: (p) => textHit(p, /\b(book (?:online|now|an appointment)|schedule (?:online|an appointment)|request an appointment)\b/i) },
  ],

  INSTANT_ESTIMATE: [
    {
      id: "instant_estimate_path",
      weight: 0.75,
      strong: true,
      type: "link",
      find: (p) => pathHit(p, /(^|\/)(instant|online|self)[-_](quote|estimate|price|pricing)|price[-_]calculator|(^|\/)(get|build)[-_]?(a[-_])?(quote|estimate)[-_]?(online|now|instantly)/i),
    },
    { id: "instant_estimate_phrase", weight: 0.3, strong: false, type: "page_content", find: (p) => textHit(p, /\b(instant (?:quote|estimate|price)|price your (?:job|project) online|quote in (?:60 )?seconds)\b/i) },
  ],

  LEAD_CAPTURE_FORM: [
    {
      id: "lead_form",
      weight: 0.85,
      strong: true,
      type: "form",
      find: (p) => {
        const form = (p.forms || []).find(isLeadCaptureForm);
        return form ? { value: JSON.stringify({ action: form.action, id: form.id, fields: form.fields.map((f) => f.name || f.type) }) } : null;
      },
    },
    {
      id: "form_provider_iframe",
      weight: 0.7,
      strong: true,
      type: "iframe_host",
      find: (p) => urlHit(p, [p.iframes], ["jotform.com", "typeform.com", "docs.google.com/forms", "wufoo.com", "formstack.com", "gravityforms.com", "hsforms.net", "hsforms.com"]),
    },
    { id: "contact_path", weight: 0.4, strong: false, type: "link", find: (p) => pathHit(p, /(^|\/)(contact|contact-us|get-a-quote|free-estimate|request-a-quote)(\/|$|[?#])/i) },
  ],

  CLIENT_PORTAL: [
    { id: "portal_host", weight: 0.85, strong: true, type: "link", find: (p) => urlHit(p, [p.links, p.iframes], PORTAL_HOSTS) },
    {
      id: "portal_path",
      weight: 0.6,
      strong: true,
      type: "link",
      find: (p) => pathHit(p, /(^|\/)((client|customer|my)[-_]?(portal|hub|login|account)|portal|my-account)(\/|$|[?#])/i),
    },
    { id: "portal_phrase", weight: 0.3, strong: false, type: "page_content", find: (p) => textHit(p, /\b(client (?:portal|login|hub)|customer portal|my account login)\b/i) },
  ],

  ONLINE_PAYMENT: [
    { id: "payment_script", weight: 0.85, strong: true, type: "script_src", find: (p) => urlHit(p, [p.scripts], ["js.stripe.com", "web.squarecdn.com", "js.squareup.com", "paypal.com/sdk"]) },
    // "paymentAccepted: Cash, Credit Card" is how they get paid, not whether
    // they get paid ONLINE. Weak, and named so a reviewer sees why.
    { id: "schema_payment_accepted", weight: 0.2, strong: false, type: "schema_org", find: (p) => schemaHit(p, (f) => f.paymentAccepted && /online|card|stripe|paypal|square/i.test(f.paymentAccepted) && `paymentAccepted: ${f.paymentAccepted}`) },
    { id: "payment_link", weight: 0.8, strong: true, type: "link", find: (p) => urlHit(p, [p.links, p.iframes], PAYMENT_HOSTS) },
    { id: "payment_path", weight: 0.5, strong: true, type: "link", find: (p) => pathHit(p, /(^|\/)(pay|pay-online|pay-invoice|make-a-payment|payments?)(\/|$|[?#])/i) },
    { id: "payment_phrase", weight: 0.25, strong: false, type: "page_content", find: (p) => textHit(p, /\b(pay (?:your )?(?:bill|invoice) online|pay online)\b/i) },
  ],

  ONLINE_REVIEWS: [
    { id: "review_widget_host", weight: 0.8, strong: true, type: "script_src", find: (p) => urlHit(p, [p.scripts, p.iframes], REVIEW_HOSTS) },
    {
      id: "aggregate_rating",
      weight: 0.75,
      strong: true,
      type: "schema_org",
      // schema.org AggregateRating, in JSON-LD or in microdata. Both spellings
      // exist and both are a machine-readable claim by the site about itself.
      find: (p) => htmlHit(p, /"@type"\s*:\s*"AggregateRating"|itemtype=["'][^"']*schema\.org\/AggregateRating/i),
    },
    { id: "reviews_path", weight: 0.45, strong: true, type: "link", find: (p) => pathHit(p, /(^|\/)(reviews?|testimonials?)(\/|$|[?#])/i) },
    // Review nodes in the site's own JSON-LD: reviews published on the site.
    { id: "schema_review", weight: 0.6, strong: true, type: "schema_org", find: (p) => schemaHit(p, (f) => f.reviews > 0 && `${f.reviews} Review node(s) in JSON-LD`) },
  ],

  LIVE_CHAT: [
    // Chat is technology-detected almost entirely — a chat box IS a vendor's
    // script. The DOM fallback catches self-hosted widgets that no signature
    // covers, weighted below anything a signature would give.
    { id: "chat_container", weight: 0.5, strong: true, type: "page_content", find: (p) => htmlHit(p, /id=["'](?:chat-widget|live-?chat|tidio-chat|crisp-client|drift-widget)["']|class=["'][^"']*\b(?:live-?chat|chat-widget)\b/i) },
  ],

  PUBLISHED_HOURS: [
    {
      id: "schema_hours",
      weight: 0.85,
      strong: true,
      type: "schema_org",
      find: (p) => htmlHit(p, /"openingHours(?:Specification)?"\s*:|itemprop=["']openingHours["']/i),
    },
    {
      id: "hours_text",
      weight: 0.6,
      strong: true,
      type: "page_content",
      // A weekday adjacent to a time RANGE. Shaped, not a phrase: "Monday" on
      // its own is a blog post date; "Mon–Fri 8:00 – 5:00" is a statement of
      // hours. Note what this deliberately does NOT do: it records only THAT
      // hours are published, never what they are. Reading a partial hours
      // block into an assumed Mon–Fri is the exact failure
      // lib/company/businessHours.js exists to prevent.
      find: (p) =>
        textHit(
          p,
          /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?\s*(?:[-–—]|to|through|\s)\s*[a-z.]*\s*:?\s*\d{1,2}\s*(?::\d{2})?\s*(?:am|pm)?\s*[-–—]\s*\d{1,2}\s*(?::\d{2})?\s*(?:am|pm)/i,
        ),
    },
  ],

  EMAIL_CONTACT: [
    { id: "mailto", weight: 0.9, strong: true, type: "link", find: (p) => firstMatching(p.links, /^mailto:/i) },
    { id: "schema_email", weight: 0.7, strong: true, type: "schema_org", find: (p) => schemaHit(p, (f) => f.email[0] && `email: ${f.email[0]}`) },
    { id: "email_in_text", weight: 0.55, strong: true, type: "page_content", find: (p) => textHit(p, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) },
  ],

  PHONE_CONTACT: [
    { id: "tel_link", weight: 0.9, strong: true, type: "link", find: (p) => firstMatching(p.links, /^tel:/i) },
    { id: "schema_telephone", weight: 0.7, strong: true, type: "schema_org", find: (p) => schemaHit(p, (f) => f.telephone[0] && `telephone: ${f.telephone[0]}`) },
    {
      id: "phone_in_text",
      weight: 0.6,
      strong: true,
      type: "page_content",
      // North American shape, which is the market. A bare run of ten digits is
      // deliberately NOT matched: that is a postcode, an order number or a
      // licence number as often as it is a telephone.
      find: (p) => textHit(p, /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/),
    },
  ],
};

function firstMatching(list, re) {
  const hit = (list || []).find((v) => re.test(v));
  return hit ? { value: hit } : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   The detector
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Turn a crawl into capability rows.
 *
 * @param crawl         anything normaliseCrawl understands.
 * @param technologies  what detectTechnologies() found, so a Calendly script
 *                      counts as online booking without this file re-matching
 *                      the same host under a different name.
 * @param prospect      only `hasWebsite` and `websiteUrl` are read, and only
 *                      for WEBSITE. Everything else comes from the pages.
 *
 * Returns rows in the shape ProspectCapability wants, plus the eligibility
 * decision, so a caller (and the check) can see WHY a row is null.
 */
export function detectCapabilities({ crawl = null, technologies = [], prospect = null, siteKind = null } = {}) {
  const normalised = normaliseCrawl(crawl);
  // Rendered pages, plus shells whose copy was recovered — the second for
  // presence only; absenceEligibility never counts them.
  const pages = readablePages(normalised);
  const rendered = pages.filter((p) => !p.recovered);
  const eligibility = absenceEligibility(normalised);
  const firstUrl = normalised.pages[0]?.finalUrl || normalised.pages[0]?.url || null;
  // Whose site this is. Read off the classifier's answer and nothing else:
  // null (not classified) and "unknown" both leave every rule below as it
  // was, because neither is a finding about the site.
  const listing = siteKind && notTheirOwnSite(siteKind.kind) ? siteKind : null;
  const techCodes = new Set(
    (Array.isArray(technologies) ? technologies : [])
      .map((t) => t?.technologyCode ?? t?.code)
      .filter(Boolean),
  );

  const capabilities = [];

  for (const code of DETECTED_CAPABILITY_CODES) {
    if (code === "WEBSITE") {
      // Rendered pages only: a recovered shell is answered by the js_shell
      // branch inside, which says what it is.
      capabilities.push(listing ? listingWebsiteCapability(listing, pages) : websiteCapability({ prospect, normalised, pages: rendered }));
      continue;
    }

    // A listing answers nothing about what THEY can do. Decided before any
    // signal is read, so a directory's booking widget cannot become theirs.
    if (listing && !KEPT_ON_A_LISTING.has(code)) {
      capabilities.push({ code, value: null, confidence: 0, evidence: [withheldEvidence(code, "not_their_own_site", pages, eligibility, firstUrl)], reason: "not_their_own_site" });
      continue;
    }

    const evidence = [];
    const weights = [];
    let strong = false;

    // A technology IS the capability where the mapping says so. Cited as its
    // own evidence line naming the technology, because "they have online
    // booking" and "they have online booking THROUGH JOBBER" are different
    // sentences on a call.
    for (const entry of CAPABILITY_FROM_TECHNOLOGY[code] || []) {
      const { code: techCode, weight } = technologyProof(entry);
      if (!techCodes.has(techCode)) continue;
      strong = true;
      weights.push(weight);
      evidence.push({
        type: "page_content",
        source: "website",
        sourceUrl: pages[0]?.finalUrl ?? null,
        rawValue: `technology:${techCode}`,
        normalizedValue: `${code} via ${techCode}`,
        confidence: weight,
        detector: CAPABILITY_DETECTOR,
        detectorVersion: CAPABILITY_DETECTOR_VERSION,
      });
    }

    for (const signal of SIGNALS[code] || []) {
      for (const page of pages) {
        const hit = signal.find(page);
        if (!hit) continue;
        if (signal.strong) strong = true;
        weights.push(signal.weight);
        evidence.push(
          evidenceRow(page, {
            type: signal.type,
            value: hit.value,
            normalized: `${code}:${signal.id}`,
            weight: signal.weight,
          }),
        );
        // One page per signal, for the reason matchSignature gives: a nav link
        // repeated on nine pages is one observation.
        break;
      }
    }

    if (strong) {
      capabilities.push({
        code,
        value: true,
        confidence: combineWeights(weights),
        evidence,
        reason: null,
      });
      continue;
    }

    // Nothing strong fired. Now — and ONLY now — the null-versus-false
    // question. Everything above this line is about presence; everything
    // below is about whether we are entitled to call it an absence.
    const scope = ABSENCE_SCOPE[code];
    // "No enquiry form" is only sayable when a page a form would live on was
    // actually fetched and rendered. Deep eligibility alone is not enough: a
    // crawl of `/`, `/about` and `/reviews` has looked hard and has not
    // looked for a form.
    const needsContactPage = code === "LEAD_CAPTURE_FORM";
    const allowed =
      !listing &&
      (scope === "deep" ? eligibility.deep && (!needsContactPage || eligibility.contactPage) : eligibility.siteWide);

    const reason = allowed
      ? null
      : listing
        ? "not_their_own_site"
        : eligibility.reason ||
        (needsContactPage && !eligibility.contactPage
          ? "no_contact_page_fetched"
          : scope === "deep"
            ? "front_page_only"
            : "not_looked");

    capabilities.push({
      code,
      value: allowed ? false : null,
      confidence: allowed ? absenceConfidence(normalised, eligibility) : 0,
      // A false cites the pages that were searched and came back empty — the
      // loose evidence, if any, plus nothing. `evaluateCondition` reads
      // evidenceIds off a matched `is: false`, so an absence with no evidence
      // at all would produce a recommendation citing nothing. A null cites
      // the REASON it is null, as a crawl_quality row: "site is rendered by
      // JavaScript; we could not read it" is a sentence a rep can use, and
      // "not established" is not.
      evidence: allowed ? [absenceEvidence(code, rendered, eligibility)] : [withheldEvidence(code, reason, pages, eligibility, firstUrl)],
      reason,
    });
  }

  return {
    capabilities,
    eligibility,
    pagesConsidered: pages.length,
    pagesRecovered: pages.length - rendered.length,
    pagesSeen: normalised.pages.length,
    // "js_shell" when the crawl holds a shell — the site is drawn by
    // JavaScript — else "html". Carried out for the task note and the check.
    rendered: eligibility.shells > 0 ? "js_shell" : "html",
    siteKind: siteKind?.kind ?? null,
  };
}

/** The sentences behind each reason a verdict is withheld. English, and
 *  short: prospectView.js keys the rep-facing translation on the reason
 *  token in normalizedValue, and this text is what a superadmin reads on the
 *  evidence row itself. */
export const WITHHELD_SENTENCES = Object.freeze({
  js_shell: JS_SHELL_SENTENCE,
  blocked: "the host refused the crawler; nothing was read",
  crawl_error: "the site did not load; nothing was read",
  no_pages: "no page was fetched",
  no_page_loaded: "no page loaded",
  no_page_rendered: "no fetched page rendered as a document",
  page_error: "a page in the crawl failed to load, so part of the site was not seen",
  crawl_incomplete: "the crawl did not finish, so part of the site was not seen",
  probe_fallback: "the site's menu could not be read and guessed pages were not found",
  front_page_only: "only the front page was read",
  no_contact_page_fetched: "no contact or quote page was read, so no form was looked for",
  not_their_own_site: "the listed URL is a directory or a profile, not their own site",
  not_looked: "not looked for",
});

/**
 * The evidence row behind a NULL: why nothing is claimed either way. A real
 * row with a sourceUrl (the first page that loaded, when one did) so the
 * screen can say "seen on …" about the withholding too. Type crawl_quality
 * — never a signal, so it can never raise a confidence.
 */
function withheldEvidence(code, reason, pages, eligibility, fallbackUrl = null) {
  const key = reason || "not_looked";
  const sentence = WITHHELD_SENTENCES[key] || `withheld: ${key}`;
  return {
    type: CRAWL_QUALITY_EVIDENCE,
    source: "website",
    // The first readable page, else the first page fetched at all — a shell
    // with an empty body is not readable and is still the page the reason
    // is about.
    sourceUrl: pages[0]?.finalUrl ?? fallbackUrl ?? null,
    rawValue: `${sentence} (${eligibility?.rendered ?? 0} rendered page(s), ${eligibility?.shells ?? 0} JavaScript shell(s))`,
    normalizedValue: `${code}:withheld:${key}`,
    confidence: 0,
    detector: CAPABILITY_DETECTOR,
    detectorVersion: CAPABILITY_DETECTOR_VERSION,
  };
}

/**
 * WEBSITE when the record's URL is a directory or a platform profile.
 *
 * False, and a FINDING: the source's URL was looked at and it is somebody
 * else's site. The first evidence row is the one the screen reads —
 * `site_kind:<kind>` with the site's own name in rawValue, so the sentence
 * can say "a directory (Ethical Services)" — and the classifier's own rows
 * follow it, so a rep can see which menu item decided it.
 */
function listingWebsiteCapability(listing, pages) {
  const brand = listing.brand || listing.host || null;
  const head = {
    type: "site_kind",
    source: "website",
    sourceUrl: pages[0]?.finalUrl ?? listing.evidence?.[0]?.sourceUrl ?? null,
    rawValue: `brand=${brand || ""}`,
    normalizedValue: `${SITE_KIND_EVIDENCE_PREFIX}:${listing.kind}${listing.host ? `:${listing.host}` : ""}`,
    confidence: listing.confidence,
    detector: CAPABILITY_DETECTOR,
    detectorVersion: CAPABILITY_DETECTOR_VERSION,
  };
  const rows = (listing.evidence || []).map((row) => ({
    ...row,
    detector: CAPABILITY_DETECTOR,
    detectorVersion: CAPABILITY_DETECTOR_VERSION,
  }));
  return {
    code: "WEBSITE",
    value: false,
    confidence: listing.confidence,
    evidence: [head, ...rows],
    reason: "not_their_own_site",
  };
}

/**
 * The evidence row behind a "we looked and it is not there".
 *
 * A real observation with a real sourceUrl: these pages rendered, they were
 * searched for these signals, and none fired. Without it, a NO_ONLINE_PAYMENT
 * recommendation would cite an empty array, which is the generic sales filler
 * ProspectOpportunity's schema comment exists to make visible.
 */
function absenceEvidence(code, pages, eligibility) {
  const urls = pages.map((p) => p.finalUrl).filter(Boolean).slice(0, 10);
  return {
    type: "page_content",
    source: "website",
    sourceUrl: urls[0] ?? null,
    rawValue: `no ${code} signal on ${eligibility.rendered} rendered page(s): ${urls.join(", ")}`,
    normalizedValue: `${code}:absent`,
    confidence: absenceConfidence({ pages, complete: null }, eligibility),
    detector: CAPABILITY_DETECTOR,
    detectorVersion: CAPABILITY_DETECTOR_VERSION,
  };
}

/**
 * WEBSITE, which is a discovery finding and not a crawl finding.
 *
 * The three cases are genuinely different and the schema comment on
 * `Prospect.hasWebsite` already says so: false is a FINDING (spec §5 — no
 * website is a signal and among the best prospects there are), not a blank.
 *
 *   true   discovery found a URL and something rendered at it
 *   false  discovery looked and there is no website
 *   null   there is a URL and we could not load it — which is a broken crawl,
 *          not a business without a website, and the difference is a rep
 *          opening with "I see you haven't got a site" to somebody who has.
 */
function websiteCapability({ prospect, normalised, pages }) {
  const base = {
    code: "WEBSITE",
    evidence: [],
    reason: null,
  };

  if (pages.length > 0) {
    return {
      ...base,
      value: true,
      confidence: 0.95,
      evidence: [
        {
          type: "page_content",
          source: "website",
          sourceUrl: pages[0].finalUrl,
          rawValue: `${pages.length} page(s) rendered`,
          normalizedValue: "WEBSITE:rendered",
          confidence: 0.95,
          detector: CAPABILITY_DETECTOR,
          detectorVersion: CAPABILITY_DETECTOR_VERSION,
        },
      ],
    };
  }

  // A JavaScript shell answered: there IS a website — a 200, a bundle, a
  // framework — and it could not be read. True, one notch down, citing the
  // shell, because the alternative is a rep opening with "I see you haven't
  // got a site" to a business whose site is simply modern.
  const shell = normalised.pages.map((p) => ({ page: p, shell: jsShell(p) })).find((x) => x.shell);
  if (shell) {
    return {
      ...base,
      value: true,
      confidence: 0.8,
      evidence: [
        {
          type: CRAWL_QUALITY_EVIDENCE,
          source: "website",
          sourceUrl: shell.page.finalUrl,
          rawValue: `${JS_SHELL_SENTENCE} (${shell.shell.marker})`,
          normalizedValue: "WEBSITE:js_shell",
          confidence: 0.8,
          detector: CAPABILITY_DETECTOR,
          detectorVersion: CAPABILITY_DETECTOR_VERSION,
        },
      ],
    };
  }

  const url = typeof prospect?.websiteUrl === "string" ? prospect.websiteUrl.trim() : "";
  if (prospect?.hasWebsite === false && !url) {
    return {
      ...base,
      value: false,
      confidence: 0.8,
      evidence: [
        {
          type: "google_field",
          source: "google",
          sourceUrl: null,
          rawValue: "discovery recorded no website for this business",
          normalizedValue: "WEBSITE:absent",
          confidence: 0.8,
          detector: CAPABILITY_DETECTOR,
          detectorVersion: CAPABILITY_DETECTOR_VERSION,
        },
      ],
    };
  }

  // A URL exists and nothing rendered, or discovery has not said either way.
  // Both are unknown. Note that a website that will not load is emphatically
  // NOT a business without a website — that inversion is the single most
  // damaging one this file can make, because the NO_WEBSITE rule is the
  // highest-priority non-competitor rule there is.
  const reason = url ? (normalised.blocked ? "blocked" : "site_did_not_load") : "not_looked";
  return {
    ...base,
    value: null,
    confidence: 0,
    evidence: [
      {
        type: CRAWL_QUALITY_EVIDENCE,
        source: "website",
        sourceUrl: url || null,
        rawValue: reason === "blocked" ? WITHHELD_SENTENCES.blocked : reason === "site_did_not_load" ? "the listed site did not load; it may still exist" : "no website is on the record and discovery did not say either way",
        normalizedValue: `WEBSITE:withheld:${reason}`,
        confidence: 0,
        detector: CAPABILITY_DETECTOR,
        detectorVersion: CAPABILITY_DETECTOR_VERSION,
      },
    ],
    reason,
  };
}

/**
 * The contract check: does this detector emit codes the rules can read?
 *
 * Exported so the check script can execute it rather than eyeballing two
 * arrays. A code here that is not in OBSERVABLE_CAPABILITY_CODES is a row
 * nothing will ever join to.
 */
export function vocabularyProblems() {
  const problems = [];
  for (const code of DETECTED_CAPABILITY_CODES) {
    if (!OBSERVABLE_CAPABILITY_CODES.includes(code)) {
      problems.push(`${code} is not in OBSERVABLE_CAPABILITY_CODES — no rule can read it`);
    }
    if (!ABSENCE_SCOPE[code]) problems.push(`${code} has no absence scope`);
    if (code !== "WEBSITE" && !(SIGNALS[code] || []).length && !technologiesProving(code).length) {
      problems.push(`${code} has no signals — it could only ever be false or null`);
    }
  }
  return problems;
}

/** Which observable codes NOTHING here produces. Reported rather than hidden:
 *  a rule conditioning on one of these can never fire. */
export function unproducedObservableCodes() {
  return OBSERVABLE_CAPABILITY_CODES.filter((c) => !DETECTED_CAPABILITY_CODES.includes(c));
}
