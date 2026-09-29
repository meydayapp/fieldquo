// lib/quotes/quoteViews.js
//
// "The client opened it" — Quote.viewedAt / Quote.viewCount — decided in one
// place, pure, so scripts/check-quote-approval.mjs runs every branch.
//
// ══ Who counts ═════════════════════════════════════════════════════════════
//
// The client, and only the client. Not:
//
//   · the company's own staff checking the link they sent (a member of the
//     owning company — the same test the draft preview uses,
//     lib/quotes/previewAccess.js memberMayPreview);
//   · a read-only support session (impersonation) — FieldQuo looking is not
//     the customer's client looking (non-negotiable #2);
//   · a draft — nobody outside the office can open one;
//   · a bot, a link unfurler or a mail scanner — the stamp is sent by the
//     page's own script after it renders (app/q/[token]/QuoteApproval.js),
//     which most of them never run, and the ones that do announce
//     themselves in the user agent;
//   · a prefetch — a browser or router warming the page is not a person
//     reading it.
//
// A signed-in member of ANOTHER company does count: that is a general
// contractor opening a subcontractor's quote, which is the client opening it.
//
// ══ What reads it ══════════════════════════════════════════════════════════
//
// quoteViewState() for any screen that says "opened 3×, first on …", and
// isViewedNoAnswer() for the dashboard's "viewed, no answer" badge rule.

// The user agents that fetch links without a person behind them. Matched as
// words, case-insensitive. Deliberately broad: a false "not counted" costs a
// badge; a false "counted" tells a contractor a client read a quote they
// never opened, which is the kind of quietly-wrong record this codebase is
// swept for.
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|preview|unfurl|whatsapp|telegram|discord|skype|headless|lighthouse|pagespeed|curl\/|wget\/|python-requests|python-urllib|go-http-client|node-fetch|axios\/|okhttp|java\/|libwww|httpclient|scanner|safelinks|proofpoint|mimecast|barracuda|validator|monitor|pingdom|uptime/i;

export function isLikelyBot(userAgent) {
  const ua = typeof userAgent === "string" ? userAgent.trim() : "";
  // No user agent at all is not a phone in a driveway.
  if (!ua) return true;
  return BOT_UA.test(ua);
}

/**
 * Is this request a prefetch rather than a read? Takes a `get(name)` headers
 * object (a Request's, or a plain stand-in).
 */
export function isPrefetchRequest(headers) {
  const get = (n) => {
    try {
      return String(headers?.get?.(n) || "").toLowerCase();
    } catch {
      return "";
    }
  };
  return (
    get("purpose").includes("prefetch") ||
    get("sec-purpose").includes("prefetch") ||
    get("x-purpose").includes("preview") ||
    get("x-moz").includes("prefetch") ||
    get("next-router-prefetch") !== "" ||
    get("x-middleware-prefetch") !== ""
  );
}

/**
 * Should this open be recorded?
 *
 * @returns {{ record: boolean, reason: string }}
 */
export function viewVerdict({ status, userAgent, prefetch = false, staffOfCompany = false, impersonating = false } = {}) {
  if (!status || status === "draft") return { record: false, reason: "draft" };
  if (impersonating) return { record: false, reason: "impersonation" };
  if (staffOfCompany) return { record: false, reason: "staff" };
  if (prefetch) return { record: false, reason: "prefetch" };
  if (isLikelyBot(userAgent)) return { record: false, reason: "bot" };
  return { record: true, reason: "client" };
}

/** What a screen may say about a quote's views. */
export function quoteViewState(quote) {
  const at = quote?.viewedAt ? new Date(quote.viewedAt) : null;
  const firstViewedAt = at && !Number.isNaN(at.getTime()) ? at : null;
  const count = Math.max(0, Math.trunc(Number(quote?.viewCount) || 0));
  return { viewed: Boolean(firstViewedAt), firstViewedAt, count: firstViewedAt ? Math.max(1, count) : count };
}

/**
 * The dashboard rule "viewed, no answer": sent, opened by the client, and
 * neither accepted nor declined. A quote with no recorded view is NOT in this
 * set — "not recorded" is not "opened".
 */
export function isViewedNoAnswer(quote) {
  if (!quote || quote.status !== "sent") return false;
  if (quote.acceptedAt || quote.declinedAt) return false;
  return quoteViewState(quote).viewed;
}
