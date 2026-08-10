// lib/appUrl.js
//
// Builds the absolute URLs that Stripe, Resend and share links need.
//
// Why this exists: every route that needed an absolute URL was doing
//
//     const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
//     returnUrl: `${baseUrl}/app/settings/payments`
//
// When that variable isn't set — which it wasn't in production — template
// interpolation turns `undefined` into the *string* "undefined", so Stripe
// received `"undefined/app/settings/payments"`, rejected it, and the route
// 500'd. The browser then tried res.json() on an HTML error page and reported
// "The string did not match the expected pattern", which points nowhere near
// the actual problem.
//
// Two changes fix that class of bug for good:
//
//   1. Derive the origin from the incoming request when the env var is
//      absent. A server handling a request already knows what host it's on;
//      making that knowledge depend on a build-time variable was the mistake.
//   2. Throw a message naming the variable when there's genuinely nothing to
//      go on, rather than emitting a malformed URL and failing three layers
//      downstream.
//
// Note on NEXT_PUBLIC_: that prefix means the value is inlined at build time.
// Setting it in Vercel does nothing until the next deploy — another reason not
// to depend on it for server-side URL construction.

/**
 * Absolute origin for this deployment, e.g. "https://www.fieldquo.com".
 *
 * @param request  the Request from a route handler. Optional, but pass it
 *                 whenever you have one — it's the most reliable source.
 */
export function getAppOrigin(request) {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  if (request) {
    // Vercel terminates TLS at the edge, so the inbound request to the
    // function is plain http. x-forwarded-* carries what the client saw.
    const headers = request.headers;
    const host = headers.get("x-forwarded-host") || headers.get("host");
    if (host) {
      const proto =
        headers.get("x-forwarded-proto") ||
        (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }

    // Fall back to the request URL itself.
    try {
      return new URL(request.url).origin;
    } catch {
      /* fall through to the throw below */
    }
  }

  // Vercel sets this on every deployment without any configuration.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  const err = new Error(
    "Can't work out this site's address. Set NEXT_PUBLIC_APP_URL " +
      "(e.g. https://www.fieldquo.com) in your environment and redeploy.",
  );
  err.status = 500;
  throw err;
}

/**
 * True only for a `?next=` value that stays on this origin.
 *
 * One helper rather than the four hand-rolled copies this codebase grew, all
 * of which checked `startsWith("/") && !startsWith("//")` and all of which
 * missed the same case: `/\evil.com` starts with a single slash, passes, and
 * is then normalised by the browser into `//evil.com` — a protocol-relative
 * URL to somebody else's site. So the second character is rejected whether
 * it's a slash or a backslash.
 *
 * Client-safe: no imports, no environment reads.
 */
export function isInternalPath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return false;
  return value[1] !== "/" && value[1] !== "\\";
}

/** Absolute URL for a path. `appUrl(req, "/app/settings/payments")`. */
export function appUrl(request, path = "/") {
  const origin = getAppOrigin(request);
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Reads a required secret, failing with a message that says what to do.
 *
 * The alternative — letting `undefined` flow into a crypto call — produces
 * errors like "Invalid key length" that give no clue which variable is
 * missing or where to set it.
 */
export function requireEnv(name, hint = "") {
  const value = process.env[name];
  if (!value) {
    const err = new Error(
      `${name} isn't set.${hint ? ` ${hint}` : ""} Add it to .env locally and to your Vercel project settings, then redeploy.`,
    );
    err.status = 500;
    throw err;
  }
  return value;
}
