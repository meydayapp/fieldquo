import { shortLinkRedirects } from "./lib/heycatch/shortLinks.js";

// /vs/<competitor> → the existing comparison page. The site audit (2026-10-15)
// looked for per-competitor "/vs" pages and found none, because they live at
// /compare/fieldquo-vs-<competitor> with dated price readings, the add-on
// stack and "what FieldQuo does not do". A second copy at /vs would be the
// copy that rots (AGENTS.md failure class 4), so /vs is a permanent redirect
// to the one page. Restricted to FieldQuo's own hosts for the reason
// lib/heycatch/shortLinks.js gives: these rules run before middleware.js, and
// a contractor's site at sunset.fieldquo.com/vs/… is theirs.
const VS_PAGES = [
  ["jobber", "fieldquo-vs-jobber"],
  ["housecall-pro", "fieldquo-vs-housecall-pro"],
  ["servicetitan", "fieldquo-vs-servicetitan"],
  ["projul", "fieldquo-vs-projul"],
  ["quoteiq", "fieldquo-vs-quoteiq"],
  ["roofr", "fieldquo-vs-roofr"],
  ["paintscout", "fieldquo-vs-paintscout"],
];

const FIELDQUO_HOSTS = [{ type: "host", value: "(?:(?:www\\.)?fieldquo\\.com|localhost)" }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/vs", has: FIELDQUO_HOSTS, destination: "/compare", permanent: true },
      ...VS_PAGES.map(([short, slug]) => ({
        source: `/vs/${short}`,
        has: FIELDQUO_HOSTS,
        destination: `/compare/${slug}`,
        permanent: true,
      })),
      ...shortLinkRedirects(),
    ];
  },
};

export default nextConfig;
