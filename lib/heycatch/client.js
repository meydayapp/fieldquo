// lib/heycatch/client.js
//
// The browser half of HeyCatch, and the ONLY place the SDK is loaded.
//
// ══ Why a gated dynamic import, against HeyCatch's own guide ═══════════════
//
// HeyCatch asks for a static import at module scope in instrumentation-client.
// FieldQuo cannot do that. instrumentation-client runs on EVERY page this
// deployment serves — the contractor's quote at /q/<token>, their website on
// sunset.fieldquo.com, the embed on their own domain — and the SDK acts the
// moment its module evaluates: its bundle ends in a top-level call that
// location.replace()s any single-character path to
// /?utm_source=heycatch&utm_campaign=<c>. A static import would therefore
// load a FieldQuo vendor's script into the homeowner's page and, on a
// contractor's site with a one-letter page, send their visitor to a FieldQuo
// URL. AGENTS.md's white-label rule outranks the guide, as the owner's brief
// (2026-10-15) says it does.
//
// So the import happens only after lib/heycatch/gate.js has said yes for this
// host AND this path. The cost is a few hundred milliseconds before the first
// pageview is captured; the short links do not depend on the SDK because
// next.config.mjs answers them before any page loads.
//
// ══ Navigation into a client-facing page after init ════════════════════════
//
// /app links to the contractor's own client view (/q/…, /portal/…). Most of
// those open a new tab, which never initialises; one that navigates in place
// keeps the already-loaded SDK in memory. beforeSend re-runs the gate on
// every event and drops anything captured while the address bar is on a page
// the gate refuses, so nothing from a client-facing page is sent.
//
// ══ What autocapture is allowed to read ═══════════════════════════════════
//
// maskAllText and maskAllElementAttributes are ON. /app is full of other
// people's personal information — a homeowner's name on a client row, an
// address on a job card — and clicked links carry client-portal tokens in
// their href. Unmasked, a click on "Maria Lopez, 12 Elm St" would put Maria's
// name and address in a third party's dashboard, and a click on "Copy client
// link" would put a working key to her documents there. HeyCatch logs at init
// that masking costs its friction labels; that is the trade, made on purpose.

import { HEYCATCH_PROJECT_KEY, analyticsAllowed } from "./gate";

let loading = null;

function here() {
  return typeof window === "undefined" ? null : window.location;
}

/**
 * Load and initialise the SDK if — and only if — this page is one of
 * FieldQuo's own. Returns a promise of the `analytics` namespace, or of null
 * where analytics may not run. Idempotent: the import happens once per page.
 */
export function startAnalytics(destination = null) {
  if (loading) return loading;
  // `destination`: a client-side navigation that has started but not yet
  // committed its URL (instrumentation-client's onRouterTransitionStart).
  // beforeSend still reads the live address bar, so nothing captured before
  // the URL changes is kept unless the page it was on was allowed too.
  if (!analyticsAllowed(destination || here())) return Promise.resolve(null);
  loading = import("@heycatch/sdk")
    .then(({ analytics }) => {
      analytics.init({
        projectKey: HEYCATCH_PROJECT_KEY,
        install: { framework: "nextjs", frameworkVersion: "16", agent: "claude-code" },
        // Local storage, not a cookie: a cookie on .fieldquo.com would ride
        // along to every contractor subdomain; local storage stays on the
        // origin that wrote it.
        persistence: "localStorage",
        maskAllText: true,
        maskAllElementAttributes: true,
        beforeSend: (event) => (analyticsAllowed(here()) ? event : null),
      });
      return analytics;
    })
    .catch((err) => {
      // Analytics failing must never be visible to a contractor. One line
      // for whoever opens the console, and the page carries on.
      console.warn("[FieldQuo] analytics did not load:", err?.message || err);
      loading = null;
      return null;
    });
  return loading;
}

/**
 * Run `fn(analytics)` if analytics is loaded or loadable here; otherwise do
 * nothing. Never throws.
 */
export function withAnalytics(fn) {
  return startAnalytics()
    .then((analytics) => (analytics ? fn(analytics) : undefined))
    .catch(() => undefined);
}

/**
 * Forget who is signed in — called by signOut() in lib/auth-client.js. Only
 * acts on an SDK that is ALREADY loaded: a sign-out on a page that never
 * loaded analytics has nobody to forget, and must not load it just to say so.
 */
export function resetAnalyticsIdentity() {
  if (!loading) return Promise.resolve();
  return loading.then((analytics) => analytics?.resetIdentity()).catch(() => undefined);
}
