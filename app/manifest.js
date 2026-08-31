// app/manifest.js
//
// Makes FieldQuo installable as a standalone app. Next serves this at the
// single origin-wide URL /manifest.webmanifest — there is no per-route
// manifest, and that collides head-on with AGENTS.md non-negotiable #1:
// FieldQuo is white-label by default, and a homeowner must never be able to
// tell the contractor uses it.
//
// middleware.js rewrites a tenant host (sunset.fieldquo.com) to /site/sunset
// for page routes, but its matcher explicitly excludes anything ending in a
// file extension (see the `.*\.[a-zA-Z0-9]+$` negative lookahead in that
// file's `config.matcher`). /manifest.webmanifest ends in one, so that
// rewrite never runs for it — this file answers directly, on whatever Host
// header the request actually carried, FieldQuo branding included, unless it
// checks the host itself.
//
// Left static, a homeowner on a contractor's own subdomain who taps
// "Install" would get a FieldQuo-named, FieldQuo-iconed app icon — the exact
// leak AGENTS.md's white-label section warns about. So this reads the
// incoming Host header and refuses to hand out FieldQuo's identity to
// anything that isn't a FieldQuo host.
//
// `headers()` is a Request-time API (see node_modules/next/dist/docs/01-app/
// 04-glossary.md, "Request-time APIs"), and Next's own manifest.md doc notes
// manifest.js "is cached by default unless it uses a Request-time API" —
// this is exactly that documented escape hatch. It only opts THIS route out
// of static caching: a metadata route is its own standalone handler, not
// part of the page render tree, so unlike doing the equivalent in
// app/layout.js (see the appleWebApp comment there) this costs nothing on
// any other route.
import { headers } from "next/headers";
import { subdomainFromHost } from "@/lib/site/subdomain";

export default async function manifest() {
  const headersList = await headers();
  const subdomain = subdomainFromHost(headersList.get("host"));

  if (subdomain) {
    // A tenant's own site, quote link, or booking page — not FieldQuo's to
    // brand. `null` isn't a valid Web App Manifest object, so browsers treat
    // it as absent rather than offering an install prompt with anyone's name
    // or icon on it.
    return null;
  }

  return {
    name: "FieldQuo",
    short_name: "FieldQuo",
    description: "The all-in-one system for contractors and service pros",
    // A contractor tapping their home-screen icon wants the back office, not
    // the marketing site. /app redirects to /login when there's no session
    // (middleware.js), which is the same behaviour any native app has when
    // you're signed out — acceptable, not a dead end.
    start_url: "/app",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#06356b",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
