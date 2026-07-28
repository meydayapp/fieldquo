// middleware.js
//
// One change: /api/platform/billing/* is carved out of the platform-token
// (JWT) gate. Those four routes — webhook, checkout, portal, cancel — are
// NOT platform-staff routes even though they live under the /api/platform
// prefix; they're hit by Stripe itself (webhook, which has no cookies at
// all — its own stripe.webhooks.constructEvent signature check IS its auth)
// or by a logged-in company user via their better-auth session cookie
// (checkout/portal/cancel — not a platform-token). Every one of those was
// getting a blanket 401 from this middleware before the route handler, or
// Stripe's signature check, ever ran. That's why webhook events never
// created a Subscription row, and why "Manage billing" 401'd in the browser.
//
// Everything else in this file — the /platform page gate, the /app
// better-auth gate — is unchanged.
import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { jwtVerify } from "jose";
import {
  IMPERSONATION_COOKIE,
  verifyImpersonationToken,
  isReadOnlyMethod,
} from "@/lib/platform/impersonationToken";
import { subdomainFromHost } from "@/lib/site/subdomain";

const PLATFORM_SECRET = new TextEncoder().encode(
  process.env.PLATFORM_JWT_SECRET,
);

// Company-facing routes that happen to live under /api/platform/ but are
// authenticated a different way (Stripe signature, or better-auth session
// inside the route itself) — not the platform-staff JWT.
const PLATFORM_BILLING_PASSTHROUGH = [
  "/api/platform/billing/webhook",
  "/api/platform/billing/checkout",
  "/api/platform/billing/portal",
  "/api/platform/billing/cancel",
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Tenant websites on subdomains ──────────────────────────────────────
  //
  // sunset.fieldquo.com serves that company's public site. Runs FIRST and
  // returns immediately, ahead of every auth gate below, because a stranger
  // reading a contractor's website has no session and must never be asked
  // for one.
  //
  // A REWRITE, not a redirect: the visitor's address bar keeps saying
  // sunset.fieldquo.com while Next renders /site/sunset. A redirect would
  // bounce every visitor to a fieldquo.com URL, which defeats the entire
  // point of giving them their own address.
  //
  // subdomainFromHost returns null for the apex, www, every reserved name,
  // Vercel preview hosts and bare IPs — see lib/site/subdomain.js, where the
  // reserved list is a security boundary rather than a naming preference.
  const subdomain = subdomainFromHost(request.headers.get("host"));
  if (subdomain) {
    // /api and /_next still have to work on a subdomain: the rendered page
    // loads its own assets from the host it was served on. Only page routes
    // get rewritten.
    if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = `/site/${subdomain}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── Read-only support session ("Sign in as") ────────────────────────────
  //
  // A platform superadmin viewing a customer's account carries only the
  // impersonation cookie — no Better Auth session — so both gates below would
  // otherwise turn them away. This runs first and does two jobs:
  //
  //   1. lets them through to /app and the company APIs;
  //   2. rejects anything that could write, before it reaches a handler.
  //
  // Enforcing it here rather than per-route is the whole point. There are
  // ~135 API routes; a check each one has to remember is a check that will be
  // forgotten the next time someone adds a route.
  //
  // Scoped to the COMPANY surface only. /api/platform and /platform are
  // excluded deliberately: without that exclusion, holding an impersonation
  // cookie would satisfy this block and return next() before the
  // platform-token check below ever ran — turning a support token into read
  // access to the platform console's own APIs. Only superadmins can obtain
  // one today, so it isn't currently exploitable, but "not exploitable yet"
  // is not the same as correct.
  const isPlatformSurface =
    pathname.startsWith("/platform") || pathname.startsWith("/api/platform");

  const impersonationToken = request.cookies.get(IMPERSONATION_COOKIE)?.value;
  if (impersonationToken && !isPlatformSurface) {
    const claims = await verifyImpersonationToken(impersonationToken);

    if (claims && (pathname.startsWith("/app") || pathname.startsWith("/api"))) {
      if (!isReadOnlyMethod(request.method)) {
        return NextResponse.json(
          {
            error:
              "You're viewing this account read-only. Support access can't change a customer's data — talk them through the change, or ask them to make it.",
            readOnly: true,
          },
          { status: 403 },
        );
      }

      // Let route handlers know without re-verifying the JWT.
      const headers = new Headers(request.headers);
      headers.set("x-impersonating-company", claims.companyId);
      headers.set("x-impersonating-admin", claims.platformAdminId);
      return NextResponse.next({ request: { headers } });
    }

    if (!claims && pathname.startsWith("/app")) {
      // Expired mid-session. Clear it so they aren't stuck in a half-state.
      const response = NextResponse.redirect(
        new URL("/platform/companies", request.url),
      );
      response.cookies.set(IMPERSONATION_COOKIE, "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  // ── Platform API routes (JSON 401, not a redirect — these are fetch() calls) ──
  if (pathname.startsWith("/api/platform")) {
    if (pathname.startsWith("/api/platform/auth")) {
      return NextResponse.next();
    }

    if (PLATFORM_BILLING_PASSTHROUGH.includes(pathname)) {
      return NextResponse.next();
    }

    const platformToken = request.cookies.get("platform-token")?.value;

    if (!platformToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await jwtVerify(platformToken, PLATFORM_SECRET);
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Platform pages (FieldQuo's own back office) ─────────────────────────
  if (pathname.startsWith("/platform")) {
    if (pathname === "/platform/login") {
      return NextResponse.next();
    }

    const platformToken = request.cookies.get("platform-token")?.value;

    if (!platformToken) {
      return NextResponse.redirect(new URL("/platform/login", request.url));
    }

    try {
      await jwtVerify(platformToken, PLATFORM_SECRET);
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(
        new URL("/platform/login", request.url),
      );
      response.cookies.set("platform-token", "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  // ── Company app (Better Auth) ───────────────────────────────────────────
  if (pathname.startsWith("/app")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app",
    "/app/:path*",
    "/platform",
    "/platform/:path*",
    // Widened from /api/platform/* to all of /api. The read-only support gate
    // above has to sit in front of every company API route, not just the
    // platform ones — otherwise a support session could POST to /api/quotes.
    //
    // Cost is one cookie lookup per API request: without an impersonation
    // cookie the block exits immediately, and no JWT is verified. Public
    // routes (/api/public/*, /api/portal/*, webhooks) are unaffected — they
    // carry no impersonation cookie and fall straight through.
    "/api/:path*",
    // The subdomain check above needs to see the root path, and every path
    // on a tenant host. This matcher excludes Next's own internals and
    // anything with a file extension, so static assets never pay for a
    // middleware invocation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
