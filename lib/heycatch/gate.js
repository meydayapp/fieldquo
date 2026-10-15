// lib/heycatch/gate.js
//
// Where HeyCatch (FieldQuo's own product analytics) may run — and, much more
// importantly, where it may never run. Pure, so instrumentation-client.js,
// lib/heycatch/client.js and scripts/check-heycatch.mjs all execute the same
// function.
//
// ══ Why a gate at all ═════════════════════════════════════════════════════
//
// HeyCatch measures FieldQuo's OWN funnel: who reads fieldquo.com, who signs
// up, what contractors do in /app. It must never see a homeowner. The quote,
// the portal, the booking page, the contractor's website — every surface a
// stranger with no account opens — carries the CONTRACTOR's brand (AGENTS.md,
// white-label by default), and a third-party analytics script on it would be
// FieldQuo watching somebody else's customer: a white-label leak, and under
// Québec's Law 25 a disclosure of the contractor's clients' personal
// information that nobody consented to.
//
// ══ Allow-list, not deny-list ═════════════════════════════════════════════
//
// The gate says where analytics IS allowed — FieldQuo's own hosts, and on
// them FieldQuo's own pages — and refuses everything else. A deny-list of
// client-facing prefixes is the shape that fails open: the next public token
// route somebody adds (there are twenty) would be tracked until someone
// remembered to list it. With an allow-list it is untracked until someone
// decides it should be. CLIENT_FACING_PREFIXES below is kept anyway, as the
// list check:heycatch proves the gate refuses, and the check also fails any
// top-level app/ route that is in neither list, so a new route has to be
// classified on purpose.
//
// ══ Hosts ═════════════════════════════════════════════════════════════════
//
// fieldquo.com and www.fieldquo.com serve both the marketing site and /app
// (NEXT_PUBLIC_APP_URL is https://www.fieldquo.com), plus localhost for
// development. Never a contractor subdomain (sunset.fieldquo.com is rewritten
// into /site/* by middleware.js), never a contractor's custom domain, never a
// Vercel preview (its traffic is ours, testing, and would pollute the funnel),
// never help.fieldquo.com (not in the owner's list; FieldQuo-branded, but
// adding it is a decision, not a default).

export const HEYCATCH_PROJECT_KEY = "hck_pk_W-R45Oqaf9dQ-LzAzfiSPDXf9K2lyGp-";

export const ANALYTICS_HOSTS = Object.freeze(["fieldquo.com", "www.fieldquo.com", "localhost"]);

/**
 * FieldQuo's own pages. Matched as the exact path or the path followed by "/".
 *
 * Deliberately NOT here, although FieldQuo-branded: the auth pages that carry
 * a capability in the URL (/reset-password?token=, /verify-email?token=,
 * /accept-invitation/<id>) and /demo/<repCode>?t=<sealed token>. Autocapture
 * records the page URL, and a reset token in somebody else's dashboard is a
 * password in somebody else's dashboard. /platform and /sales are FieldQuo
 * staff looking at customers' data, not product usage.
 */
export const ANALYTICS_PATH_PREFIXES = Object.freeze([
  // The marketing site — app/(marketing)/*
  "/about",
  "/careers",
  "/compare",
  "/contact",
  "/cost",
  "/data-deletion",
  "/features",
  "/glossary",
  "/industries",
  "/pricing",
  "/privacy",
  "/product",
  "/resources",
  "/savings",
  "/security",
  "/terms",
  "/vs",
  // FieldQuo's own sign-up and sign-in
  "/signup",
  "/login",
  "/forgot-password",
  "/welcome",
  // The contractor's back office
  "/app",
  // FieldQuo's own developer and help pages on the www host
  "/developers",
  "/help",
]);

/**
 * Every top-level route a homeowner, a client or a stranger reaches. The gate
 * never consults this list — anything not allowed above is refused — it is
 * what check:heycatch runs the gate over to prove the refusal, and what the
 * route-classification check reads.
 */
export const CLIENT_FACING_PREFIXES = Object.freeze([
  "/q",
  "/quote",
  "/instant-quote",
  "/portal",
  "/book",
  "/visit",
  "/embed",
  "/site",
  "/w",
  "/design",
  "/refer",
  "/l",
  "/f",
  "/c",
  "/i",
  "/r",
  "/co",
  "/plan",
  "/estimate-report",
  "/price-request",
  "/survey",
  "/no-contact",
  "/unsubscribe",
  "/email-preferences",
  "/form-preview",
  "/pay",
  "/social-card",
]);

/** FieldQuo staff and token-bearing auth pages: FieldQuo's, but not tracked (see above). */
export const UNTRACKED_OWN_PREFIXES = Object.freeze([
  "/platform",
  "/sales",
  "/admin",
  "/reset-password",
  "/verify-email",
  "/accept-invitation",
  "/demo",
  "/api",
]);

function hostnameOf(host) {
  return String(host || "").split(":")[0].toLowerCase().trim();
}

function underPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Is this one of FieldQuo's own hosts? */
export function isAnalyticsHost(host) {
  return ANALYTICS_HOSTS.includes(hostnameOf(host));
}

/** Is this one of FieldQuo's own pages? (Says nothing about the host.) */
export function isAnalyticsPath(pathname) {
  const path = String(pathname || "");
  if (!path.startsWith("/")) return false;
  // Belt and braces: a client-facing prefix is refused even if somebody one
  // day adds an overlapping allow entry.
  if (CLIENT_FACING_PREFIXES.some((p) => underPrefix(path, p))) return false;
  if (path === "/") return true;
  return ANALYTICS_PATH_PREFIXES.some((p) => underPrefix(path, p));
}

/**
 * May HeyCatch run here? Accepts window.location, a URL, or { hostname, pathname }.
 * Both halves must hold: FieldQuo's host AND FieldQuo's page.
 */
export function analyticsAllowed(location) {
  if (!location) return false;
  const host = location.hostname ?? location.host ?? "";
  return isAnalyticsHost(host) && isAnalyticsPath(location.pathname);
}

/**
 * The identity HeyCatch is told about a signed-in person: the internal user
 * id and three facts about their company — never an email, a name or a phone.
 *
 * HeyCatch's guide suggests putting email and name in the person properties
 * so its dashboard can show "Sam Rivers <sam@…>". FieldQuo does not: the id
 * is enough to join a session to an account inside /platform, where the
 * owner already sees who it is; copying contact details into a second
 * vendor adds a processor holding personal information (Québec Law 25,
 * PIPEDA) for a display nicety. Returns null for a support session or a
 * demo sandbox — a superadmin looking at somebody else's account must never
 * be recorded as that account's user.
 */
export function identityPayload(member) {
  if (!member || member.impersonation) return null;
  const userId = typeof member.userId === "string" ? member.userId : "";
  if (!userId) return null;
  return {
    id: userId,
    properties: {
      companyId: member.companyId || null,
      role: member.role || null,
      plan: member.plan || null,
    },
  };
}
