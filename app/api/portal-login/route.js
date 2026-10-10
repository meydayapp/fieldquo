// app/api/portal-login/route.js
//
// POST { subdomain, email } from the "Client login" page on a company's own
// website (app/site/[subdomain] → /client), or POST { companySlug, email }
// from the standalone login page (app/portal/login/[companySlug]) for a
// company whose website is not built on FieldQuo. Emails the portal link of
// every client OF THAT COMPANY with that address, and answers the same
// neutral sentence whether or not anyone matched.
//
// ── What this endpoint must never say ──────────────────────────────────────
//
// Whether an email belongs to a client. "No account found" would turn every
// contractor's website into a free lookup of who their customers are — a
// competitor's list, a burglar's list of who is having work done. So:
//
//   * the response body is identical for a match, no match, and a match
//     that was rate-limited per email;
//   * the lookup and the send run in after(), once the response has gone, so
//     the time taken does not say it either (a Resend call is hundreds of ms;
//     a miss is a single indexed query);
//   * the only refusals are ones that are about the REQUEST, not the email:
//     too many tries from this connection, a string that is not an email, or
//     a site that has no client login switched on.
//
// ── Which company ──────────────────────────────────────────────────────────
//
// Resolved from the subdomain the page was served under, and only when that
// site is published AND has CompanySite.clientPortalEnabled on — or from the
// company slug in the standalone page's address (resolveTarget below). The
// browser sends a subdomain or a slug, never a company id;
// lib/portal/loginLink.js scopes the client lookup to the company it names.
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, hit } from "@/lib/rateLimit";
import { normaliseLoginEmail } from "@/lib/portal/view";
import { sendPortalLinks } from "@/lib/portal/loginLink";
import { siteUrl, subdomainFromHost } from "@/lib/site/subdomain";
import { getAppOrigin } from "@/lib/appUrl";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";

// The same body every time, so the page can't be used to learn anything.
const NEUTRAL = { ok: true };

// Per connection: generous enough for a family on one Wi-Fi, tight enough that
// a script walking an address list is stopped quickly.
const IP_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 };
// Per address, per company: three links an hour is plenty for a real client
// who mistyped once; more is somebody filling a stranger's inbox.
const EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };

/**
 * Where the emailed link opens. On the company's own site host when that is
 * where the request came from — /portal passes through the subdomain rewrite,
 * so the client never leaves the contractor's address. The host is compared
 * to the site's REAL name (<subdomain>.fieldquo.com), not trusted: a Host of
 * "sunset.attacker.example" parses to the subdomain "sunset" too, and must not
 * become the domain a client's token is mailed to. Anywhere else (local dev,
 * the /site/<sub> preview path) it is the app's own origin, the same one every
 * other portal email uses.
 */
function linkOrigin(request, subdomain) {
  const host = String(request.headers.get("host") || "").split(":")[0].toLowerCase();
  const real = new URL(siteUrl(subdomain)).hostname;
  if (host === real && subdomainFromHost(host) === subdomain) return siteUrl(subdomain);
  return getAppOrigin(request);
}

export async function POST(request) {
  const limited = rateLimit(request, "portal-login", {
    ...IP_LIMIT,
    message: "Too many tries from this connection. Please wait a few minutes and try again.",
  });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const email = normaliseLoginEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const target = await resolveTarget(request, body);
  // Off, unpublished, unknown or not ready all read the same: there is no
  // login here. About the PAGE, never about the address typed.
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Per address, per company. Counted whether or not the address matches, so
  // hitting the limit is not itself a sign that it did — and answered with
  // the neutral sentence, sending nothing. One bucket per company whichever
  // page the address was typed on: the website's /client and the standalone
  // page are two doors to the same thing, not two allowances.
  const perEmail = hit(`portal-login-email:${target.companyId}:${email}`, EMAIL_LIMIT);
  if (!perEmail.ok) return NextResponse.json(NEUTRAL);

  const { companyId, origin } = target;
  after(async () => {
    try {
      const result = await sendPortalLinks({ companyId, email, origin });
      if (result.failed) {
        console.error(`[portal-login] ${result.failed} of ${result.matched} link(s) not sent for company ${companyId}`);
      }
    } catch (err) {
      console.error("[portal-login] send failed:", err?.message);
    }
  });

  return NextResponse.json(NEUTRAL);
}

/**
 * Which company this login is for, and where its emailed link should open —
 * or null for "there is no login here". Two doors, one answer shape:
 *
 *   { subdomain }    the company's FieldQuo website (/client). Only while the
 *                    site is published AND has Client login switched on.
 *   { companySlug }  the standalone page, /portal/login/<slug>, for a company
 *                    whose website is not built on FieldQuo. Resolved by
 *                    findBookingCompany — bookingSlug first, then slug, the
 *                    same rule as the booking page and every embed, so the
 *                    slug in a company's embed code is the slug that works
 *                    here — and refused for a company not ready to face a
 *                    client (lib/company/profileReadiness.js). The link opens
 *                    on the app's own origin, the one every other portal
 *                    email uses: there is no company host to keep it on.
 *
 * Both, or neither, is not a request either page makes, and is refused.
 * Never a company id from the browser, in either shape.
 */
async function resolveTarget(request, body) {
  const hasSub = body?.subdomain != null && body.subdomain !== "";
  const hasSlug = body?.companySlug != null && body.companySlug !== "";
  if (hasSub === hasSlug) return null;

  if (hasSlug) {
    const slug = String(body.companySlug).trim().toLowerCase().slice(0, 100);
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
    const company = await findBookingCompany(slug, { id: true });
    if (!company?.id) return null;
    return { companyId: company.id, origin: getAppOrigin(request) };
  }

  const subdomain = String(body.subdomain).trim().toLowerCase().slice(0, 63);
  if (!/^[a-z0-9-]{1,63}$/.test(subdomain)) return null;
  const site = await db.companySite.findUnique({
    where: { subdomain },
    select: { companyId: true, published: true, clientPortalEnabled: true, subdomain: true },
  });
  if (!site || !site.published || !site.clientPortalEnabled) return null;
  return { companyId: site.companyId, origin: linkOrigin(request, site.subdomain) };
}
