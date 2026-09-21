// lib/stripe/connectReturn.js
//
// Where Stripe's hosted Connect onboarding sends the browser back to.
//
// Two callers start that flow: Settings > Payments, which wants the reader
// back on itself, and the home page's "Connect Stripe" dialog
// (app/components/dashboard/stepPanels.js), which wants them back on the
// dashboard they left so the checklist can re-read itself. The browser says
// which by NAME — `returnTo: "home"` — never by URL: an address supplied by a
// browser and handed to Stripe as a redirect target is an open redirect, and
// the two paths here are the only two anybody has a reason to land on.
//
// Both routes that mint a link (POST /api/stripe/connect and the refresh
// bounce) resolve the name here, so an expired link resumed mid-flow comes
// back to the same place the first one would have.

export const CONNECT_RETURN_PATHS = {
  payments: "/app/settings/payments",
  home: "/app",
};

/** The path for a return-to name; anything unrecognised is the payments page. */
export function connectReturnPath(name) {
  return CONNECT_RETURN_PATHS[name] || CONNECT_RETURN_PATHS.payments;
}

/** The name, only if it is one of ours — so it can travel on a query string. */
export function connectReturnName(name) {
  return Object.prototype.hasOwnProperty.call(CONNECT_RETURN_PATHS, name) ? name : "payments";
}

/** The full return URL, with the `?connected=true` flag both pages read. */
export function connectReturnUrl(baseUrl, name) {
  return `${baseUrl}${connectReturnPath(name)}?connected=true`;
}
