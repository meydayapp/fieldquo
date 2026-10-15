// app/sitemap.xml/route.js
//
// fieldquo.com's sitemap: FieldQuo's own marketing pages only
// (lib/seo/sitemap.js). Reached on FieldQuo's host alone — middleware.js
// rewrites /sitemap.xml on help.fieldquo.com to the help centre's own
// sitemap and on a contractor's subdomain into their site, so this list is
// never served as somebody else's.
import { sitemapXml } from "@/lib/seo/sitemap";
import { siteOrigin } from "@/lib/marketing/metadata";

// Per request, cached at the edge for an hour. NOT force-static: a static
// render bakes siteOrigin() in at BUILD time, and a build without
// NEXT_PUBLIC_APP_URL (a local build did exactly this) publishes
// http://localhost:3000 URLs to every crawler until the next deploy. The list
// itself is data files, so a request costs no database read.
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(sitemapXml(siteOrigin()), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600",
    },
  });
}
