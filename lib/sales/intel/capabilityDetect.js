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
//   the front page — the crawler visited more than the front page.
//
// Everything else is null. `absenceEligibility()` below is the only place that
// decides it, and `detectCapabilities` cannot produce a false without it.
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
export const CAPABILITY_DETECTOR_VERSION = "1";

/** A body smaller than this is a shell, an error page, or a redirect stub. */
const MIN_RENDERED_HTML = 300;

/** "More than the front page." Two is the weakest honest reading of that, and
 *  it is what separates a crawler that followed the navigation from one that
 *  fetched the root and stopped. */
const MIN_PAGES_FOR_DEEP = 2;

/** Absence never scores higher than this. You cannot prove a negative from a
 *  crawl; the most this says is "we looked hard and did not find it". */
const MAX_ABSENCE_CONFIDENCE = 0.85;

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

/**
 * Technologies that PROVE a capability, because the product is the capability.
 *
 * Deliberately conservative. Birdeye and Podium both sell chat AND reviews on
 * one script host, so a Birdeye script cannot tell you which one this
 * contractor bought. Birdeye is therefore mapped to reviews only (its
 * flagship) and Podium to chat only (likewise), and neither is mapped to both
 * — claiming a capability from a script that might be the vendor's other
 * product is exactly the over-claim the fact layer exists to prevent.
 */
const CAPABILITY_FROM_TECHNOLOGY = Object.freeze({
  ONLINE_BOOKING: [
    "JOBBER",
    "HOUSECALL_PRO",
    "SERVICETITAN",
    "WORKIZ",
    "CALENDLY",
    "ACUITY_SCHEDULING",
  ],
  LEAD_CAPTURE_FORM: ["JOBBER", "MARKATE"],
  LIVE_CHAT: ["TAWK_TO", "INTERCOM", "PODIUM", "FACEBOOK_CHAT_PLUGIN"],
  ONLINE_PAYMENT: ["STRIPE_PAYMENTS", "SQUARE_PAYMENTS"],
  ONLINE_REVIEWS: ["BIRDEYE"],
});

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
  return page.links.length > 0;
}

/**
 * May this crawl support a claim of ABSENCE, and at which scope.
 *
 * The single decision point. Everything about null-versus-false in this file
 * runs through here, so there is exactly one place to read, one place to
 * break in a mutation test, and no second path that could disagree.
 */
export function absenceEligibility(crawl) {
  const normalised = crawl && Array.isArray(crawl.pages) ? crawl : normaliseCrawl(crawl);
  const pages = normalised.pages;
  const ok = loadedPages(normalised);
  const rendered = pages.filter(looksRendered);

  const deny = (reason) => ({ siteWide: false, deep: false, reason, rendered: rendered.length });

  // A transport failure on the crawl as a whole. We never got to look.
  if (normalised.error) return deny("crawl_error");
  // Somebody refused us. The page might say anything.
  if (normalised.blocked) return deny("blocked");
  if (pages.length === 0) return deny("no_pages");
  if (ok.length === 0) return deny("no_page_loaded");
  if (rendered.length === 0) return deny("no_page_rendered");
  // A page that errored inside an otherwise fine crawl still means part of the
  // site was not seen. A 404 is NOT an error here — a crawler that asked for
  // /booking and was told it does not exist has learned something real — so
  // this only catches transport failures and refusals, which normalisePage
  // already separated from status codes.
  if (pages.some((p) => p.error)) return deny("page_error");

  // An explicit statement that the crawl did not finish vetoes the deep claim
  // and only the deep claim: the chrome on the pages we DID render is still
  // fully observed.
  const complete = normalised.complete;
  const deep =
    complete !== false && rendered.length >= MIN_PAGES_FOR_DEEP;

  return {
    siteWide: true,
    deep,
    reason: deep ? null : complete === false ? "crawl_incomplete" : "front_page_only",
    rendered: rendered.length,
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
const SIGNALS = {
  ONLINE_BOOKING: [
    { id: "booking_widget_host", weight: 0.9, strong: true, type: "iframe_host", find: (p) => urlHit(p, [p.iframes], BOOKING_HOSTS) },
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
    { id: "email_in_text", weight: 0.55, strong: true, type: "page_content", find: (p) => textHit(p, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) },
  ],

  PHONE_CONTACT: [
    { id: "tel_link", weight: 0.9, strong: true, type: "link", find: (p) => firstMatching(p.links, /^tel:/i) },
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
export function detectCapabilities({ crawl = null, technologies = [], prospect = null } = {}) {
  const normalised = normaliseCrawl(crawl);
  const pages = loadedPages(normalised).filter(looksRendered);
  const eligibility = absenceEligibility(normalised);
  const techCodes = new Set(
    (Array.isArray(technologies) ? technologies : [])
      .map((t) => t?.technologyCode ?? t?.code)
      .filter(Boolean),
  );

  const capabilities = [];

  for (const code of DETECTED_CAPABILITY_CODES) {
    if (code === "WEBSITE") {
      capabilities.push(websiteCapability({ prospect, normalised, pages }));
      continue;
    }

    const evidence = [];
    const weights = [];
    let strong = false;

    // A technology IS the capability where the mapping says so. Cited as its
    // own evidence line naming the technology, because "they have online
    // booking" and "they have online booking THROUGH JOBBER" are different
    // sentences on a call.
    for (const techCode of CAPABILITY_FROM_TECHNOLOGY[code] || []) {
      if (!techCodes.has(techCode)) continue;
      strong = true;
      weights.push(0.9);
      evidence.push({
        type: "page_content",
        source: "website",
        sourceUrl: pages[0]?.finalUrl ?? null,
        rawValue: `technology:${techCode}`,
        normalizedValue: `${code} via ${techCode}`,
        confidence: 0.9,
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
    const allowed = scope === "deep" ? eligibility.deep : eligibility.siteWide;

    capabilities.push({
      code,
      value: allowed ? false : null,
      confidence: allowed ? absenceConfidence(normalised, eligibility) : 0,
      // A false cites the pages that were searched and came back empty — the
      // loose evidence, if any, plus nothing. `evaluateCondition` reads
      // evidenceIds off a matched `is: false`, so an absence with no evidence
      // at all would produce a recommendation citing nothing.
      evidence: allowed ? [absenceEvidence(code, pages, eligibility)] : [],
      reason: allowed ? null : eligibility.reason || (scope === "deep" ? "front_page_only" : "not_looked"),
    });
  }

  return {
    capabilities,
    eligibility,
    pagesConsidered: pages.length,
    pagesSeen: normalised.pages.length,
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
  return {
    ...base,
    value: null,
    confidence: 0,
    reason: url ? normalised.blocked ? "blocked" : "site_did_not_load" : "not_looked",
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
    if (code !== "WEBSITE" && !(SIGNALS[code] || []).length && !(CAPABILITY_FROM_TECHNOLOGY[code] || []).length) {
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
