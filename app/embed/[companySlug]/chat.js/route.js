// app/embed/[companySlug]/chat.js/route.js
//
// The chat loader script — the thing the one-line snippet on Settings → AI
// employee points at. The source, and why it exists, is lib/embed/chatLoader.js.
//
// A static segment named "chat.js" beside the dynamic [widget] page: the
// static one wins, so /embed/<slug>/chat stays the widget page (and the old
// iframe snippet keeps working) while /embed/<slug>/chat.js is this script.
// The middleware matcher skips paths with a file extension, so this answers
// on a tenant subdomain exactly as on the apex, with no rewrite in between.
//
// ── Caching ─────────────────────────────────────────────────────────────────
//
// The script depends on two things only — our origin and the slug — and on
// nothing a company edits: whether chat is on, the colour, the face and the
// name all live in the frame, which is never cached. So an hour in the
// browser and a day at the CDN cost nothing in freshness, and every page view
// on a contractor's site does not become a function invocation here. A deploy
// purges the CDN, so a fix to the loader reaches everyone within the hour.
// The ETag is the hash of the exact bytes, so a revalidation after that hour
// is a 304 with no body.
//
// The company lookup is there so a mistyped slug answers 404 in the host's
// network tab — an honest, findable failure — rather than a script that mounts
// a frame which then 404s silently.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { getAppOrigin } from "@/lib/appUrl";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { chatLoaderScript, isLoaderSlug } from "@/lib/embed/chatLoader";

const JS = "application/javascript; charset=utf-8";

function notFound() {
  return new Response("/* not found */\n", {
    status: 404,
    headers: { "Content-Type": JS, "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(request, { params }) {
  const { companySlug } = await params;
  if (!isLoaderSlug(companySlug)) return notFound();

  let company;
  try {
    company = await findBookingCompany(companySlug, { id: true });
  } catch {
    // Neon waking from idle (P1001). Not a 404 — and never cached as one.
    return new Response("/* try again */\n", {
      status: 503,
      headers: { "Content-Type": JS, "Cache-Control": "no-store", "Retry-After": "5" },
    });
  }
  if (!company) return notFound();

  const body = chatLoaderScript({ origin: getAppOrigin(request), slug: companySlug });
  if (!body) return notFound();

  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers = {
    "Content-Type": JS,
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    // A host page that sets Cross-Origin-Embedder-Policy would otherwise
    // refuse to run a script from another origin without this.
    "Cross-Origin-Resource-Policy": "cross-origin",
  };

  const inm = request.headers.get("if-none-match") || "";
  if (inm.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: 200, headers });
}
