// lib/seo/robots.js
//
// What /robots.txt says, decided by the HOST it is asked on. Pure, so
// app/robots.txt/route.js and scripts/check-site-seo.mjs run the same function.
//
// ══ Why one file answers four different sites ══════════════════════════════
//
// middleware.js's matcher skips any path with a file extension, so a request
// for /robots.txt is never rewritten: fieldquo.com, help.fieldquo.com, every
// contractor's sunset.fieldquo.com and every Vercel preview all reach the
// same route. A single static robots.txt would hand FieldQuo's rules — and
// FieldQuo's sitemap URL — to a contractor's own website, which is the
// white-label leak AGENTS.md forbids, delivered to Googlebot instead of a
// homeowner. So the route reads the Host header and answers per site:
//
//   fieldquo.com / www   FieldQuo's marketing site: everything public allowed,
//                        the back office, staff consoles, APIs and every
//                        token page disallowed, and FieldQuo's sitemap.
//   help.fieldquo.com    the help centre: all allowed, its own sitemap.
//   a contractor's host  their website: allowed, except the token pages that
//                        resolve on their host too (middleware's
//                        SUBDOMAIN_PASSTHROUGH). No sitemap line and no
//                        mention of FieldQuo — they have no sitemap from us,
//                        and naming ours would be the leak.
//   *.vercel.app         a preview: disallow everything. A preview indexed
//                        under its hash is duplicate content we did not mean
//                        to publish.
//
// ══ The disallow list ══════════════════════════════════════════════════════
//
// Every route that is noindex today (grep "noindex" app/) or carries a token
// or a client's document: these are links a contractor sent ONE person, and a
// crawler that finds one in a forwarded email has no business fetching it.
// /book/ and /quote/ differ on purpose: the booking pages are noindex today
// (app/book/[companySlug]/page.js); the self-quote form is not, so it stays
// crawlable. Trailing slashes matter: "/book/" blocks /book/<slug> and NOT a
// contractor's own /book page, the distinction SUBDOMAIN_PASSTHROUGH draws.

import { subdomainFromHost } from "../site/subdomain.js";

/** Pages that carry a token, a client's document, or are noindex today. */
export const TOKEN_AND_CLIENT_PATHS = Object.freeze([
  "/q/",
  "/portal/",
  "/book/",
  "/visit/",
  "/embed/",
  "/w/",
  "/design/",
  "/estimate-report/",
  "/co/",
  "/i/",
  "/plan/",
  "/c/",
  "/l/",
  "/f/",
  "/survey/",
  "/price-request/",
  "/no-contact/",
  "/unsubscribe/",
  "/email-preferences/",
  "/form-preview/",
]);

/** FieldQuo's own private surfaces on its own host. */
export const FIELDQUO_PRIVATE_PATHS = Object.freeze([
  "/app",
  "/platform",
  "/sales",
  "/admin",
  "/api/",
  "/site/",
  "/welcome",
  "/demo/",
  "/reset-password",
  "/verify-email",
  "/accept-invitation",
]);

function hostnameOf(host) {
  return String(host || "").split(":")[0].toLowerCase().trim();
}

const FIELDQUO_HOSTNAMES = new Set(["fieldquo.com", "www.fieldquo.com", "localhost"]);
const HELP_HOSTNAMES = new Set(["help.fieldquo.com", "help.localhost"]);

/** Which of the four sites a Host header names. */
export function robotsSiteFor(host) {
  const hostname = hostnameOf(host);
  if (HELP_HOSTNAMES.has(hostname)) return "help";
  if (FIELDQUO_HOSTNAMES.has(hostname)) return "fieldquo";
  if (hostname.endsWith(".vercel.app")) return "preview";
  if (subdomainFromHost(hostname)) return "tenant";
  // An address we do not recognise — a contractor's own domain pointed here,
  // a bare IP. Treated as somebody else's site: the tenant rules, no FieldQuo
  // sitemap, no FieldQuo name.
  return "tenant";
}

/**
 * The robots.txt body for a request.
 *
 * @param host    the request's Host header
 * @param origin  FieldQuo's canonical origin (lib/marketing/metadata.js
 *                siteOrigin) — used ONLY on FieldQuo's own host
 */
export function robotsTxt({ host, origin }) {
  const site = robotsSiteFor(host);
  const lines = ["User-agent: *"];

  if (site === "preview") {
    lines.push("Disallow: /");
    return `${lines.join("\n")}\n`;
  }

  if (site === "help") {
    lines.push("Allow: /");
    lines.push("", `Sitemap: https://${hostnameOf(host)}/sitemap.xml`);
    return `${lines.join("\n")}\n`;
  }

  lines.push("Allow: /");
  if (site === "fieldquo") {
    for (const p of FIELDQUO_PRIVATE_PATHS) lines.push(`Disallow: ${p}`);
  } else {
    lines.push("Disallow: /api/");
  }
  for (const p of TOKEN_AND_CLIENT_PATHS) lines.push(`Disallow: ${p}`);

  if (site === "fieldquo") {
    const base = String(origin || "").replace(/\/+$/, "");
    if (base) lines.push("", `Sitemap: ${base}/sitemap.xml`);
  }
  return `${lines.join("\n")}\n`;
}
