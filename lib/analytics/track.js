// lib/analytics/track.js
//
// The browser half of FieldQuo's own page-view measurement. No third party,
// no cookie, no IP — one beacon per page view, to our own /api/track.
//
// ══ Cost is the design constraint ═════════════════════════════════════════
//
// Every beacon is a Vercel function invocation, so the rule is at most ONE
// per page view plus one flush when the tab goes away. Events queue in
// memory; a page view schedules a flush FLUSH_DELAY_MS later so anything the
// page produces right after loading (a help search, a signup step) rides in
// the same body; anything later waits for the next view or for pagehide /
// visibilitychange, which flush immediately through navigator.sendBeacon so
// the request survives the navigation.
//
// ══ What leaves the browser ════════════════════════════════════════════════
//
// The route PATTERN of the page (lib/analytics/product/routes.js, run here
// before anything is queued, so an id or a token never enters the queue),
// the interface language, a viewport bucket, the referrer's HOST on the first
// view of a session, the UTM tags of the landing (and, on FieldQuo's own
// marketing pages only, Meta's ad parameters — campaign / ad set / ad names
// and ids, placement, site_source_name), and — on the public
// surfaces only — a random id kept in localStorage so "unique visitors" can
// be counted. Signed-in surfaces (/app, /sales, /platform) send no id at all:
// the server reads who it is from the session, which is both more accurate
// and less to store.
//
// The id is not a cookie: it is never sent with any other request, it is not
// readable by another site, and it dies with the browser's storage. It
// exists so a person reading five help articles is one reader, not five.
//
// Errors are swallowed everywhere. Measurement must never be visible to the
// person being measured, and a blocked request is not their problem.

import { normalisePath, surfaceOf, tenantHostPath } from "@/lib/analytics/product/routes";
import { subdomainFromHost } from "@/lib/site/subdomain";
import { isHelpHost } from "@/lib/help/host";
import { readAdQuery, AD_QUERY_PARAMS } from "@/lib/tracking/adParams";

/**
 * Meta's ad parameters beyond the three utm tags (utm_content, utm_term,
 * campaign/ad set/ad ids and names, placement, site_source_name) are read
 * on FieldQuo's OWN marketing pages only. A contractor's website, quote page
 * or booking page is a client surface: their campaign names are theirs, and
 * FieldQuo's own analytics has no business collecting them.
 */
const AD_PARAMS_SURFACES = new Set(["marketing"]);
/** Browser-side bound per value, so a pasted paragraph cannot blow the 8KB envelope. */
const AD_BEACON_MAX = 200;

export const ENDPOINT = "/api/track";
export const FLUSH_DELAY_MS = 1500;
const STORAGE_KEY = "fieldquo:aid";
/** Surfaces that carry the anonymous id. Signed-in surfaces never do. */
const ANONYMOUS_SURFACES = new Set(["marketing", "help", "client"]);

let queue = [];
let timer = null;
let listening = false;
let landing = null; // { referrer, utm } captured once per page load

/**
 * The same id, for the one other public-surface caller that may carry it:
 * the signup capture (lib/signup/leadCapture.js), which sends it in a JSON
 * body so a resumed signup from the same browser is the same visitor. Never
 * sent anywhere else, and null wherever storage is blocked.
 */
export function visitorId() {
  return anonymousId();
}

function anonymousId() {
  try {
    const cur = localStorage.getItem(STORAGE_KEY);
    if (cur && /^[A-Za-z0-9_-]{16,40}$/.test(cur)) return cur;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const id = Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"[b & 63]).join("");
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

function viewportBucket() {
  try {
    const w = window.innerWidth || 0;
    return w < 640 ? "phone" : w < 1024 ? "tablet" : "desktop";
  } catch {
    return null;
  }
}

function language() {
  try {
    return (document.documentElement.lang || navigator.language || "").slice(0, 2).toLowerCase();
  } catch {
    return "";
  }
}

/** The referrer host and UTM tags, read once per page load and attached to the first view only. */
function landingContext() {
  if (landing) return landing;
  let referrer = null;
  let utm = {};
  try {
    if (document.referrer) referrer = new URL(document.referrer).hostname;
  } catch {
    referrer = null;
  }
  try {
    const q = new URLSearchParams(window.location.search);
    utm = { us: q.get("utm_source"), um: q.get("utm_medium"), uc: q.get("utm_campaign") };
    // Facebook's and Instagram's in-app browsers usually send NO referrer, so
    // a visitor from a post or an ad looked "direct". The click id the network
    // appends to the link is the honest signal; only its presence travels,
    // never the id itself.
    const c = q.has("fbclid") ? "facebook" : q.has("igshid") || q.has("igsh") ? "instagram" : q.has("gclid") || q.has("gbraid") || q.has("wbraid") ? "google_ads" : q.has("ttclid") ? "tiktok" : q.has("msclkid") ? "bing_ads" : q.has("li_fat_id") ? "linkedin" : null;
    if (c) utm.c = c;
  } catch {
    utm = {};
  }
  // The rest of Meta's parameters, raw and bounded — the server cleans them
  // (lib/analytics/product/events.js → lib/tracking/adParams.js). The three
  // utm tags above stay as they were, so an older server reads a newer
  // beacon exactly as before. fbclid's presence is already `c`.
  let ad = null;
  try {
    const raw = readAdQuery(window.location.search);
    const picked = {};
    for (const k of AD_QUERY_PARAMS) {
      if (k === "utm_source" || k === "utm_medium" || k === "utm_campaign") continue;
      if (typeof raw[k] === "string") picked[k] = raw[k].slice(0, AD_BEACON_MAX);
    }
    // utm_campaign again, UNLOWERED and unfiltered: `uc` goes through the
    // daily table's strict pattern, which drops "Roofs & Gutters" entirely.
    if (typeof raw.utm_campaign === "string") picked.utm_campaign = raw.utm_campaign.slice(0, AD_BEACON_MAX);
    if (Object.keys(picked).length) ad = picked;
  } catch {
    ad = null;
  }
  landing = { referrer, utm, ad };
  return landing;
}

/**
 * The route pattern for what the browser is showing, or null when it is not
 * one of ours. Folds a tenant host (sunset.fieldquo.com/about) into the
 * /site/[subdomain]/… pattern and help.fieldquo.com into /help/….
 */
export function currentPattern(pathname, host) {
  if (isHelpHost(host)) {
    const p = pathname === "/" ? "/help" : `/help${pathname}`;
    return normalisePath(p);
  }
  return normalisePath(tenantHostPath(pathname, subdomainFromHost(host)));
}

/**
 * A developer's laptop runs against the same Neon database as production
 * (.env is a copy of the deployment's), so a local `npm run dev` session
 * would count its own clicks as visitors. Skipped unless the developer
 * opts in with `localStorage["fieldquo:track-local"] = "1"` to test the
 * pipeline end to end.
 */
function isLocalDev(host) {
  try {
    const h = String(host || "").split(":")[0];
    if (h !== "localhost" && h !== "127.0.0.1" && !h.endsWith(".localhost")) return false;
    return localStorage.getItem("fieldquo:track-local") !== "1";
  } catch {
    return true;
  }
}

function send(body) {
  try {
    const json = JSON.stringify(body);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // A string body goes as text/plain, which needs no preflight and is
      // what the route parses. A Blob typed application/json would be
      // refused by some browsers' sendBeacon as a non-simple request.
      if (navigator.sendBeacon(ENDPOINT, json)) return;
    }
    fetch(ENDPOINT, { method: "POST", body: json, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch {
    // Nothing to do; see the header.
  }
}

/** Send everything queued, now. One request; the queue empties whether or not it lands. */
export function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue;
  queue = [];
  const surface = events[0].surface;
  send({
    v: 1,
    s: surface,
    a: ANONYMOUS_SURFACES.has(surface) ? anonymousId() : null,
    l: language(),
    vp: viewportBucket(),
    ev: events.map(({ surface: _s, ...e }) => e),
  });
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(flush, FLUSH_DELAY_MS);
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
}

/**
 * Queue one event. `surface` decides whether the batch carries an anonymous
 * id; a batch holds one surface, so a queued event from another surface
 * flushes what came before it first.
 */
export function track(event, fields = {}, surface = "marketing") {
  try {
    // The laptop rule applies to EVERY event, not only page views. It used to
    // sit in trackPageView alone, so a developer (or the screenshot harness)
    // walking /signup on localhost — against the production database — wrote
    // signup steps with no page view behind them: /platform/analytics read
    // "Account & company 581" above "Visited /signup 565", and "Services"
    // above "Trades" where the harness jumped straight to a step.
    if (typeof window !== "undefined" && isLocalDev(window.location.host)) return;
    listen();
    if (queue.length && queue[0].surface !== surface) flush();
    queue.push({ e: event, ...fields, surface });
    // Only a page view starts the clock. Anything else waits for the next
    // view or for the tab to hide — that is the "one beacon per page view"
    // budget, and a search typed after the view flushed is not worth a
    // second invocation on its own.
    if (event === "page_view") scheduleFlush();
  } catch {
    // Never the visitor's problem.
  }
}

/**
 * A page view for the current location. Returns the pattern recorded, or
 * null when the page is not one of ours (nothing queued).
 */
export function trackPageView(pathname, host) {
  if (isLocalDev(host)) return null;
  const pattern = currentPattern(pathname, host);
  if (!pattern) return null;
  const surface = surfaceOf(pattern);
  const first = !landing;
  const ctx = landingContext();
  const ad = first && ctx.ad && AD_PARAMS_SURFACES.has(surface) ? { ad: ctx.ad } : {};
  track(
    "page_view",
    first ? { p: pattern, r: ctx.referrer, ...ctx.utm, ...ad } : { p: pattern },
    surface,
  );
  return pattern;
}

/**
 * A step of the signup funnel was shown (team, goals, trades, services) or
 * the last button was pressed ("finish" — Start my free trial). Flushed at
 * once for "finish": the page navigates to /app next, and a queued event
 * would ride only on pagehide, which an in-app browser may never fire.
 */
export function trackSignupStep(step) {
  track("signup_step", { p: step }, "marketing");
  if (step === "finish") flush();
}

/** A help-centre search settled on a query and a result count. */
export function trackHelpSearch(query, results) {
  track("help_search", { p: query, m: { results } }, "help");
}

/** For the check script: what is waiting, without sending it. */
export function _pending() {
  return queue.slice();
}
export function _reset() {
  queue = [];
  landing = null;
  if (timer) clearTimeout(timer);
  timer = null;
}
