// app/robots.txt/route.js
//
// /robots.txt for every host this deployment answers — FieldQuo's site, the
// help centre, each contractor's website and Vercel previews. A route handler
// rather than Next's app/robots.js convention because the answer depends on
// the Host header; lib/seo/robots.js has the rules and the reasons.
import { robotsTxt } from "@/lib/seo/robots";
import { siteOrigin } from "@/lib/marketing/metadata";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const body = robotsTxt({ host: request.headers.get("host"), origin: siteOrigin() });
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // An hour at the edge, varied by host: one cached answer must never be
      // served to a different site's crawler.
      "cache-control": "public, max-age=0, s-maxage=3600",
      vary: "host",
    },
  });
}
