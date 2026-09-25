// lib/analytics/product/events.js
//
// The events FieldQuo measures about itself, and the door they come in by.
//
// ══ Two lists, on purpose ══════════════════════════════════════════════════
//
// BROWSER_EVENTS is what POST /api/track accepts from a page. SERVER_EVENTS
// is what only product code may write, through lib/analytics/product/server.js,
// after the thing actually happened: a quote was sent, a Subscription row was
// written. The split is the whole integrity of the product section on
// /platform/analytics — "used by 3 of 40 companies" is only worth reading if
// a browser cannot post `feature_used` a thousand times, and the signup
// funnel's last bar is only a fact if "trial started" comes from a Company
// row and never from a beacon.
//
// ══ What a browser may say, field by field ═════════════════════════════════
//
//   page_view         p = a route PATTERN (routes.js resolves it; anything
//                     that does not resolve is dropped), plus the referrer's
//                     host and the UTM tags of the landing — both optional,
//                     both bounded — and, on marketing pages only, `ad`:
//                     Meta's ad parameters, cleaned by lib/tracking/adParams.js
//                     into meta.ad.
//   signup_step       p = one of SIGNUP_BROWSER_STEPS. "visited" is the
//                     /signup page view itself; "trial_started" is the
//                     server's (a finished company), never a beacon.
//   help_search       p = the query, lower-cased, at most 80 characters, and
//                     m.results = how many articles matched. A search is
//                     recorded so the help centre can list what people look
//                     for and do not find; there is no name, account or
//                     address in a search box, and the length cap keeps a
//                     pasted paragraph out.
//
// Everything else — anonymous id, language, viewport bucket — rides at the
// batch level once, because none of it changes between two events from the
// same page.
//
// Pure. The route calls sanitiseBatch() and writes what comes back; the
// check script feeds it garbage and reads what it refuses.

import { normalisePath, surfaceOf } from "./routes";
import { decodeAdValue, cleanAdParams, compactAd, hasAdIdentity } from "@/lib/tracking/adParams";

// checkout_started left this list on 2026-09-25: signup has taken no card
// since 2026-09-24 (the owner's decision), the funnel no longer has a
// checkout bar, and a beacon nothing reads is a write for nothing. Rows
// already written stay in the table and are simply not read.
export const BROWSER_EVENTS = Object.freeze(["page_view", "signup_step", "help_search"]);
// card_tap: a visit to a company's digital business card (app/c/[slug])
// with the surface it was scanned or tapped from as the path — one of
// lib/reviews/card.js CARD_SOURCES. Written by the page's own render, never
// by a beacon, so a stranger cannot inflate "taps from the van sticker".
export const SERVER_EVENTS = Object.freeze(["feature_used", "signup_step", "card_tap"]);
export const ALL_EVENTS = Object.freeze([...new Set([...BROWSER_EVENTS, ...SERVER_EVENTS])]);

/**
 * The signup funnel as it is walked since 2026-09-24 — card-free, no plan,
 * no checkout: Account → Team → Goals → Trades → Services → "Start my free
 * trial". Each bar is a step COMPLETED, read from the screen that follows it:
 *
 *   visited            a page view of /signup
 *   account_submitted  the Team screen was shown (the login and company
 *                      details were accepted — nothing else leads there)
 *   team               the Goals screen was shown (Team answered or skipped)
 *   goals              the Trades screen was shown (Goals answered or skipped)
 *   trades             the Services screen was shown (a trade was picked)
 *   services           "Start my free trial" was pressed (a service picked)
 *   trial_started      a company that FINISHED signup (lib/signup/abandoned.js
 *                      completedSignupWhere — a Subscription or the card-free
 *                      trial) is tied to this browser through the SignupLead
 *                      its capture wrote (SignupLead.visitorId →
 *                      completedCompanyId). Server truth, never a beacon.
 *
 * The old keys (account = "account screen shown", plan, checkout_started,
 * completed) are not read any more. "account" was shown to every visitor
 * the moment the page hydrated, which is why it read higher than "visited"
 * whenever a step was counted without a page view.
 */
export const SIGNUP_FUNNEL = Object.freeze([
  "visited", "account_submitted", "team", "goals", "trades", "services", "trial_started",
]);

/** What the page may send as a signup_step, and the funnel bar each one proves. */
export const SIGNUP_STEP_BAR = Object.freeze({
  team: "account_submitted",
  goals: "team",
  trades: "goals",
  services: "trades",
  finish: "services",
});
export const SIGNUP_BROWSER_STEPS = Object.freeze(Object.keys(SIGNUP_STEP_BAR));

/**
 * The explicit product actions counted as feature_used, and the writer each
 * comes from. A key here with no writer is a bar that will read zero for
 * ever; check:product-analytics asserts every one is called somewhere.
 */
export const FEATURES = Object.freeze({
  quote_sent: "app/api/quotes/[id]/send/route.js",
  invoice_sent: "app/api/invoices/[id]/send/route.js",
  payment_collected: "app/api/payments/route.js + lib/invoices/recordStripePayment.js",
  booking_created: "lib/booking/finalizeBooking.js",
  job_created: "app/api/jobs/route.js",
  message_sent: "app/api/messaging/threads/[id]/reply/route.js",
  ai_review_run: "app/api/quotes/[id]/review/route.js",
});
export const FEATURE_KEYS = Object.freeze(Object.keys(FEATURES));

export const VIEWPORTS = Object.freeze(["phone", "tablet", "desktop"]);
export const MAX_EVENTS_PER_BATCH = 25;
export const MAX_BATCH_BYTES = 8 * 1024;
export const HELP_QUERY_MAX = 80;

const VISITOR_RE = /^[A-Za-z0-9_-]{16,40}$/;
const LANG_RE = /^[a-z]{2}(-[a-z0-9]{2,8})?$/i;
const HOST_RE = /^[a-z0-9.-]{1,100}$/;
const UTM_RE = /^[\w .\-+%:/|]{1,64}$/;

/** Our own hosts never count as a referrer: an in-site click is not a source. */
const OWN_HOST_RE = /(^|\.)fieldquo\.com$|^localhost$|\.vercel\.app$/;

export function cleanLanguage(value) {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  return LANG_RE.test(v) ? v.slice(0, 2) : "";
}

export function cleanVisitorId(value) {
  return typeof value === "string" && VISITOR_RE.test(value) ? value : null;
}

export function cleanViewport(value) {
  return VIEWPORTS.includes(value) ? value : null;
}

/** A referrer as a bare host, or null when absent, malformed, or one of ours. */
export function cleanReferrerHost(value) {
  if (typeof value !== "string" || !value) return null;
  let host = value.trim().toLowerCase();
  if (host.includes("/")) {
    try {
      host = new URL(host.includes("://") ? host : `https://${host}`).hostname;
    } catch {
      return null;
    }
  }
  host = host.replace(/^www\./, "");
  if (!HOST_RE.test(host) || !host.includes(".")) return null;
  if (OWN_HOST_RE.test(host)) return null;
  return foldReferrerHost(host);
}

/**
 * One row per network, not one per redirector. Facebook sends l.facebook.com,
 * lm.facebook.com or m.facebook.com depending on the surface; Instagram
 * l.instagram.com; Google a country domain. Split across those the owner
 * read "google.com 1" and could not tell whether anyone came from Facebook.
 */
const HOST_FAMILIES = [
  [/(^|\.)(facebook\.com|facebook\.net|fb\.com|fb\.me|messenger\.com)$/, "facebook.com"],
  [/(^|\.)(instagram\.com|ig\.me)$/, "instagram.com"],
  [/(^|\.)google\.[a-z.]+$|(^|\.)googleadservices\.com$|(^|\.)googlesyndication\.com$/, "google.com"],
  [/(^|\.)bing\.com$/, "bing.com"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin.com"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, "x.com"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube.com"],
  [/(^|\.)tiktok\.com$/, "tiktok.com"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest.com"],
  [/(^|\.)reddit\.com$/, "reddit.com"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo.com"],
  [/(^|\.)yahoo\.com$/, "yahoo.com"],
  // AI assistants send a referrer when a person clicks a cited link (and
  // ChatGPT also tags the link `utm_source=chatgpt.com`). The crawlers they
  // run to READ a page never execute the beacon, so these rows are people.
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, "chatgpt.com"],
  [/(^|\.)(claude\.ai|anthropic\.com)$/, "claude.ai"],
  [/(^|\.)(grok\.com|x\.ai)$/, "grok.com"],
  [/(^|\.)perplexity\.ai$/, "perplexity.ai"],
  [/^gemini\.google\.com$|(^|\.)bard\.google\.com$/, "gemini.google.com"],
  [/(^|\.)copilot\.microsoft\.com$/, "copilot.microsoft.com"],
];

export function foldReferrerHost(host) {
  // Longest-match first so gemini.google.com is an assistant, not "google.com".
  for (const [re, family] of [...HOST_FAMILIES].sort((a, b) => b[1].length - a[1].length)) if (re.test(host)) return family;
  return host;
}

/** The click-id networks the beacon may name — a closed list, never free text. */
export const CLICK_NETWORKS = Object.freeze(["facebook", "instagram", "google_ads", "tiktok", "bing_ads", "linkedin"]);

export function cleanClickNetwork(value) {
  return CLICK_NETWORKS.includes(value) ? value : null;
}

/**
 * Where a landing came from, as one word — the question "are we able to see
 * if people come from Facebook?" needs one answer, not three columns.
 *
 * Precedence: a click id (the network stamped the link itself) beats
 * utm_source (whoever built the link said so) beats the referrer (the
 * browser said so, when it said anything). "direct" only when all three are
 * silent — which is also what the Facebook app looks like without an fbclid,
 * so the number is a floor, and the screen says so.
 */
const SOURCE_BY_HOST = {
  "facebook.com": "facebook", "instagram.com": "instagram", "google.com": "google", "bing.com": "bing",
  "linkedin.com": "linkedin", "x.com": "x", "youtube.com": "youtube", "tiktok.com": "tiktok",
  "pinterest.com": "pinterest", "reddit.com": "reddit", "duckduckgo.com": "duckduckgo", "yahoo.com": "yahoo",
  "chatgpt.com": "chatgpt", "claude.ai": "claude", "grok.com": "grok", "perplexity.ai": "perplexity",
  "gemini.google.com": "gemini", "copilot.microsoft.com": "copilot",
};
const SOURCE_BY_UTM = {
  facebook: "facebook", fb: "facebook", meta: "facebook", instagram: "instagram", ig: "instagram",
  google: "google", adwords: "google_ads", "google ads": "google_ads", bing: "bing", linkedin: "linkedin",
  twitter: "x", x: "x", youtube: "youtube", tiktok: "tiktok", newsletter: "email", email: "email",
  "chatgpt.com": "chatgpt", chatgpt: "chatgpt", openai: "chatgpt", claude: "claude", "claude.ai": "claude",
  grok: "grok", perplexity: "perplexity", gemini: "gemini", copilot: "copilot",
};

/** The sources that are AI assistants, for the "From AI assistants" line. */
export const AI_ASSISTANT_SOURCES = Object.freeze(["chatgpt", "claude", "grok", "perplexity", "gemini", "copilot"]);

export function trafficSource({ referrerHost = null, utmSource = null, utmMedium = null, clickNetwork = null, network = null } = {}) {
  // Meta's own statement of where the ad ran (site_source_name, the
  // placement, or a utm_source of "ig") beats its click id: Meta appends
  // fbclid to Instagram clicks too, so "click id first" filed 540 Instagram
  // landings as facebook on 2026-09-25. lib/tracking/adParams.js metaNetwork.
  if (network && (clickNetwork === "facebook" || clickNetwork === "instagram" || !clickNetwork)) return network;
  if (clickNetwork) return clickNetwork;
  if (utmSource) {
    const u = String(utmSource).toLowerCase();
    if (SOURCE_BY_UTM[u]) {
      const paid = /cpc|paid|ads?$/.test(String(utmMedium || "").toLowerCase());
      return paid && SOURCE_BY_UTM[u] === "google" ? "google_ads" : SOURCE_BY_UTM[u];
    }
    return u.replace(/[^a-z0-9_.-]+/g, "_").slice(0, 32);
  }
  if (referrerHost) return SOURCE_BY_HOST[referrerHost] || referrerHost;
  return "direct";
}

/**
 * A utm value for the daily table: decoded first ("new+traffic+campaign",
 * "new%20traffic%20campaign" and "New Traffic Campaign" are one campaign —
 * the console showed them as two), then lower-cased and held to UTM_RE.
 * Anything the pattern refuses is still kept, display-cased, in the
 * landing's meta.ad by sanitiseEvent.
 */
export function cleanUtm(value) {
  const decoded = decodeAdValue(value);
  if (!decoded) return null;
  const v = decoded.toLowerCase();
  return UTM_RE.test(v) ? v : null;
}

/** A help query: trimmed, lower-cased, whitespace collapsed, bounded. */
export function cleanHelpQuery(value) {
  if (typeof value !== "string") return null;
  const q = value.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  if (q.length < 2) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>]/.test(q)) return null;
  return q.slice(0, HELP_QUERY_MAX);
}

/**
 * One browser event → one row-shaped object, or null when it must be refused.
 * `p` is the only field whose meaning depends on the event.
 */
export function sanitiseEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const event = raw.e;
  if (!BROWSER_EVENTS.includes(event)) return null;

  if (event === "page_view") {
    const path = normalisePath(raw.p);
    if (!path) return null;
    const surface = surfaceOf(path);
    const utmSource = cleanUtm(raw.us);
    const utmMedium = cleanUtm(raw.um);
    // Meta's ad parameters, on FieldQuo's own marketing pages only (the
    // beacon sends them nowhere else; a client surface carrying them is
    // ignored rather than stored — a contractor's campaigns are not ours to
    // collect). The three utm tags ride beside them so an Instagram
    // placement is read from site_source_name even when utm_source says
    // "facebook".
    let ad = null;
    if (surface === "marketing" && raw.ad && typeof raw.ad === "object" && !Array.isArray(raw.ad)) {
      const cleaned = cleanAdParams({
        ...raw.ad,
        utm_source: typeof raw.us === "string" ? raw.us : undefined,
        utm_medium: typeof raw.um === "string" ? raw.um : undefined,
        utm_campaign: typeof raw.ad.utm_campaign === "string" ? raw.ad.utm_campaign : typeof raw.uc === "string" ? raw.uc : undefined,
        fbclid: raw.c === "facebook",
      });
      if (hasAdIdentity(cleaned) || cleaned.placement || cleaned.siteSource) ad = cleaned;
    } else if (surface === "marketing" && (typeof raw.us === "string" || typeof raw.uc === "string")) {
      // An older beacon (only us/um/uc): the network can still be read from
      // utm_source=ig, which Meta's automatic parameters use.
      ad = cleanAdParams({ utm_source: raw.us, utm_medium: raw.um, utm_campaign: raw.uc, fbclid: raw.c === "facebook" });
      if (!ad.network && !hasAdIdentity(ad)) ad = null;
    }
    const isLanding = raw.r !== undefined || raw.us !== undefined || raw.c !== undefined || raw.ad !== undefined;
    let meta = null;
    if (isLanding) {
      meta = {
        src: trafficSource({
          referrerHost: cleanReferrerHost(raw.r),
          utmSource,
          utmMedium,
          clickNetwork: cleanClickNetwork(raw.c),
          network: ad?.network || null,
        }),
      };
      const compact = ad && raw.ad ? compactAd(ad) : null;
      if (compact) meta.ad = compact;
    }
    return {
      event,
      surface,
      path,
      referrerHost: cleanReferrerHost(raw.r),
      utmSource,
      utmMedium,
      utmCampaign: cleanUtm(raw.uc),
      // Only a LANDING carries source fields (the beacon sends them on the
      // first view of a load); a later view has none and gets no source, so
      // "direct" never counts an in-site click.
      meta,
    };
  }
  if (event === "signup_step") {
    if (!SIGNUP_BROWSER_STEPS.includes(raw.p)) return null;
    return { event, surface: "marketing", path: raw.p, referrerHost: null, utmSource: null, utmMedium: null, utmCampaign: null, meta: null };
  }
  if (event === "help_search") {
    const q = cleanHelpQuery(raw.p);
    if (!q) return null;
    const results = Number.isInteger(raw.m?.results) && raw.m.results >= 0 ? Math.min(raw.m.results, 9999) : 0;
    return { event, surface: "help", path: q, referrerHost: null, utmSource: null, utmMedium: null, utmCampaign: null, meta: { results } };
  }
  return null;
}

/**
 * A whole beacon → { language, visitorId, viewport, events[] }, or null when
 * the envelope itself is wrong. Bad events inside a good envelope are dropped
 * one by one, so a page that mixed a real view with a malformed search still
 * records the view. Over MAX_EVENTS_PER_BATCH, the tail is dropped rather
 * than the batch refused — a stuck queue that finally flushes should not lose
 * the page view at its head.
 */
export function sanitiseBatch(body) {
  if (!body || typeof body !== "object" || body.v !== 1 || !Array.isArray(body.ev)) return null;
  const events = [];
  for (const raw of body.ev.slice(0, MAX_EVENTS_PER_BATCH)) {
    const row = sanitiseEvent(raw);
    if (row) events.push(row);
  }
  return {
    language: cleanLanguage(body.l),
    visitorId: cleanVisitorId(body.a),
    viewport: cleanViewport(body.vp),
    events,
  };
}
