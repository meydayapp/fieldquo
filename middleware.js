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
//
// ── A third staff surface: /sales ──────────────────────────────────────────
//
// FieldQuo's own sales reps sign in at /sales with their OWN cookie
// (`sales-token`), verified against its own scope claim. The gate for it sits
// after the platform gates and before the /app one; the block itself explains
// what each of those neighbours would break if it moved. The two things worth
// knowing from up here: /sales joins the impersonation gate's exclusion list
// for the same reason /platform is on it, and the platform gates now reject a
// token carrying a scope claim, so the two credentials can never be read as
// each other. See lib/sales/auth.js.
//
// ── One gate that deliberately is NOT here ─────────────────────────────────
//
// Feature availability (lib/features/) is enforced in lib/currentMember.js for
// the APIs and in a server layout per route prefix for the pages, NOT here.
// Two reasons, and the first is no longer the technical one it was: Next 16
// runs this file on the Node runtime, so Prisma would work.
//
//   1. Resolving a feature needs the COMPANY, and this file only knows whether
//      a session cookie exists — getting from the cookie to a companyId means
//      re-implementing what getCurrentMember already does, which is the
//      second-copy-that-rots problem.
//   2. This matcher covers all of /api and every page. The gate is cheap
//      precisely because it runs after the company is already resolved and
//      matches the path against a registry first; hoisting it here would put
//      the lookup in front of ~150 routes that no feature gates.
//
// See the header of lib/features/gate.js for the full reasoning and for what
// happens to the voice spend paths when a feature is withdrawn.
//
// ── And a second one that deliberately is NOT here ─────────────────────────
//
// "Signed in but no company yet" — the state someone is left in when they
// abandon signup after creating their account but before POSTing /api/companies
// — is caught in app/app/layout.js, not below. Reason (1) above applies exactly:
// the /app gate here can only see that a session cookie exists, and deciding
// whether that session has a COMPANY means re-deriving getCurrentMember. The
// layout already resolves the member, so the check costs one query there and
// zero here.
import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { jwtVerify } from "jose";
import {
  IMPERSONATION_COOKIE,
  verifyImpersonationToken,
  isReadOnlyMethod,
  allowsWrites,
} from "@/lib/platform/impersonationToken";
import { subdomainFromHost } from "@/lib/site/subdomain";
import { SALES_COOKIE, carriesScope, verifySalesToken } from "@/lib/sales/auth";

const PLATFORM_SECRET = new TextEncoder().encode(
  process.env.PLATFORM_JWT_SECRET,
);

// Company-facing routes that happen to live under /api/platform/ but are
// authenticated a different way (Stripe signature, or better-auth session
// inside the route itself) — not the platform-staff JWT.
// Page routes that must resolve on a TENANT host as well as the apex.
//
// Deliberately short, and deliberately public-only. Everything here is a page
// a stranger is meant to reach: the quote form, the booking calendar, the
// embeds, and the client-facing quote and portal links a contractor sends.
//
// /app and /platform are absent on purpose. Letting the company's own back
// office answer on sunset.fieldquo.com would put an authenticated surface on a
// hostname a customer controls the name of, which is the cookie-scope problem
// the reserved-subdomain list exists to prevent — reintroduced by the back
// door.
const SUBDOMAIN_PASSTHROUGH = [
  "/quote",
  "/instant-quote",
  "/book",
  "/embed",
  "/q",
  "/portal",
  // The client-facing kitchen designer. Same class as /q and /portal: a
  // homeowner reaching it from a link on the contractor's own subdomain must
  // get the drawing, not that tenant's marketing site.
  "/design",
  "/refer",
  // The bio link (/l/<company>). Handed out as an apex URL, so this is not a
  // live break — but a contractor who types their own subdomain in front of it
  // would otherwise land on their marketing site's 404 rather than their own
  // links page, and there is no reason for the two spellings to disagree.
  "/l",
  // Public lead funnels (/f/<company>/<funnel>). A stranger reaching a funnel
  // from an ad linked on the tenant's own subdomain must get the funnel, not
  // that tenant's marketing site.
  "/f",
  // Managing a booked visit (/visit/<token>). Same class as /q and /portal —
  // a homeowner following the link in their confirmation email must reach the
  // visit, not the tenant's marketing site.
  //
  // Today the minted link uses the apex origin, so this is belt-and-braces
  // rather than a live bug. It is listed anyway because the failure it prevents
  // is silent and badly timed: the rewrite would send a 404 to someone trying
  // to cancel, at the exact moment the alternative is not turning up.
  "/visit",
];

// The sales portal's own unauthenticated doors, and the complete list of them.
//
// Same shape as /api/platform/auth: a sign-in route that cannot require a
// session, plus the invite route, which is reached by somebody who by
// definition has no account yet. Everything else under /api/sales needs the
// cookie.
//
// A prefix rather than exact paths, matching how /api/platform/auth is
// handled — but the prefix is one segment deeper (`/api/sales/auth/`) so that
// adding a route under /api/sales cannot accidentally land inside the hole.
const SALES_AUTH_PREFIX = "/api/sales/auth";

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

    // The public pages the site LINKS to must resolve on the tenant host too.
    //
    // Without this, "Get a free quote" on sunset.fieldquo.com pointed at
    // /quote/sunset, which this rewrite turned into /site/sunset/quote/sunset
    // — a 404 on the single most important button on the page. The block
    // renderer emits those hrefs as same-origin paths on purpose: sending a
    // visitor from the contractor's own domain to fieldquo.com mid-enquiry is
    // exactly the handoff a white-labelled site exists to avoid.
    if (
      SUBDOMAIN_PASSTHROUGH.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      )
    ) {
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
  //
  // /sales and /api/sales join that exclusion for the identical reason, and
  // the exclusion is written down EXPLICITLY rather than left to the fact that
  // "/sales" doesn't start with "/app". It nearly does not matter today — the
  // block's inner condition also tests `pathname.startsWith("/api")`, which
  // /api/sales satisfies — and that is precisely the point: without this name
  // on this list, an impersonation cookie would carry a support session into
  // the rep API before the sales-token gate below ever ran. Same bug the
  // paragraph above records for /platform, one staff surface later.
  const isStaffSurface =
    pathname.startsWith("/platform") ||
    pathname.startsWith("/api/platform") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/api/sales");

  const impersonationToken = request.cookies.get(IMPERSONATION_COOKIE)?.value;
  if (impersonationToken && !isStaffSurface) {
    const claims = await verifyImpersonationToken(impersonationToken);

    if (
      claims &&
      (pathname.startsWith("/app") || pathname.startsWith("/api"))
    ) {
      // A demo sandbox may write. The mode was decided from Company.isDemo
      // when the token was minted and is signed into it — a forged or
      // hand-edited cookie fails jwtVerify before it reaches here, and a token
      // for a real company can never carry this mode.
      if (!allowsWrites(claims.mode) && !isReadOnlyMethod(request.method)) {
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
      // Carried so lib/currentMember.js — the second, deliberate enforcement
      // point — reaches the same verdict without re-verifying the JWT.
      headers.set("x-impersonation-mode", claims.mode);
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
      const { payload } = await jwtVerify(platformToken, PLATFORM_SECRET);
      // A sales rep's token is signed with this same secret — see
      // lib/sales/auth.js for why one secret beats a second env var that can
      // be unset — so the signature alone does not say WHICH staff identity
      // minted it. The scope claim does, and it is refused here as well as in
      // getCurrentPlatformAdmin. Two independent checks, deliberately, for the
      // same reason assertReadOnly duplicates the impersonation gate: the
      // second one must not agree with the first by copying it.
      if (carriesScope(payload)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
      const { payload } = await jwtVerify(platformToken, PLATFORM_SECRET);
      // Same mutual rejection as the API gate above. A rep who somehow had
      // their token planted in the platform cookie gets the login screen, not
      // the console.
      if (carriesScope(payload)) {
        const response = NextResponse.redirect(
          new URL("/platform/login", request.url),
        );
        response.cookies.set("platform-token", "", { maxAge: 0, path: "/" });
        return response;
      }
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(
        new URL("/platform/login", request.url),
      );
      response.cookies.set("platform-token", "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  // ── Sales portal (FieldQuo's own reps) ──────────────────────────────────
  //
  // ── Why HERE, and not one line earlier or later ───────────────────────
  //
  // This file's order is load-bearing, and this block was placed by working
  // out what each neighbour would break if it moved.
  //
  //   · AFTER the subdomain rewrite, which must stay first. A stranger
  //     reading sunset.fieldquo.com has no session and must never be asked
  //     for one; that rewrite returns before any gate runs. /sales is not a
  //     subdomain-reachable surface, so this block is a pure pass-through on
  //     a tenant host — but only because the rewrite already returned.
  //
  //   · AFTER the impersonation gate, and named in its exclusion list above.
  //     If a support session's cookie could satisfy this gate, a read-only
  //     customer-support token would become a rep session. That is the exact
  //     bug the /platform exclusion was written for.
  //
  //   · AFTER both platform gates, and this is the ordering that actually
  //     matters. Those two run on their own path prefixes and this one runs
  //     on its own, so nothing here can weaken them — which is the whole
  //     point of putting it after rather than folding a `|| /sales` into
  //     them. One gate answering for two identities is how a rep's
  //     credential ends up satisfying "is there an admin?".
  //
  //   · BEFORE the /app gate. That gate asks only "does a Better Auth
  //     session cookie exist" — not for whom. A signed-in contractor's
  //     employee must never fall through into the rep portal because they
  //     happen to be signed in to something.
  if (pathname.startsWith("/api/sales")) {
    // Sign-in and invite acceptance. Whoever is clicking an invite link has no
    // account yet by definition, so requiring one would close the only door in.
    if (
      pathname === SALES_AUTH_PREFIX ||
      pathname.startsWith(`${SALES_AUTH_PREFIX}/`)
    ) {
      return NextResponse.next();
    }

    const salesToken = request.cookies.get(SALES_COOKIE)?.value;
    // verifySalesToken REQUIRES scope: "sales" — a platform admin's token
    // presented here is rejected, exactly as a rep's is rejected above. The
    // rejection is mutual or it is nothing.
    if (!(await verifySalesToken(salesToken))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/sales")) {
    if (pathname === "/sales/login" || pathname.startsWith("/sales/invite")) {
      return NextResponse.next();
    }

    const salesToken = request.cookies.get(SALES_COOKIE)?.value;
    if (!(await verifySalesToken(salesToken))) {
      const response = NextResponse.redirect(
        new URL("/sales/login", request.url),
      );
      // Clear an expired one so the rep isn't stuck in a half-state — the same
      // treatment the platform page gate gives its own stale cookie.
      response.cookies.set(SALES_COOKIE, "", { maxAge: 0, path: "/" });
      return response;
    }
    return NextResponse.next();
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
    // The catch-all at the bottom already covers these; they are named anyway,
    // beside /app and /platform, so the file lists every gated surface in one
    // place rather than leaving one of the three to be inferred from a regex.
    "/sales",
    "/sales/:path*",
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
