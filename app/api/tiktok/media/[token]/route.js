// app/api/tiktok/media/[token]/route.js
//
// The URL prefix TikTok is told it may pull from:
// https://www.fieldquo.com/api/tiktok/media/ (verified in TikTok's developer
// portal). Two things live under it, and nothing else:
//
//   1. TikTok's URL-prefix verification file. The portal hands the owner a
//      file name and its content; they go in TIKTOK_VERIFICATION_FILENAME /
//      TIKTOK_VERIFICATION_CONTENT, and this route serves exactly that, as
//      text/plain with a 200, at /api/tiktok/media/<that name>. No redirect —
//      "URLs that return HTTP 3xx are considered invalid"
//      (developers.tiktok.com/doc/content-posting-api-media-transfer-guide).
//
//   2. One rendered design, named by a signed token (lib/tiktok/signing.js):
//      a TikTokPublish row id plus its company, an hour's expiry, HMAC'd with a
//      server-only key. Anything else — a tampered token, an expired one, a
//      token whose company does not own the row, a post that is no longer
//      waiting to be pulled — is a 404, the same 404 as a URL that never
//      existed, so the route says nothing about which rows are real. The
//      decision is lib/tiktok/media.js resolveMediaRequest(), executed against
//      each of those cases by scripts/check-tiktok.mjs.
//
// No session: TikTok's servers fetch this, not a signed-in person, and
// middleware.js has no gate on /api/tiktok (it falls through to next()).
// The bytes are streamed from Cloudinary here rather than redirected to it,
// because TikTok does not follow redirects and only trusts this prefix.
export const runtime = "nodejs";

import { db } from "@/lib/db";
import { tiktokVerificationFile } from "@/lib/tiktok/config";
import { signingRootKey } from "@/lib/tiktok/signing";
import { resolveMediaRequest } from "@/lib/tiktok/media";

const NO_STORE = { "Cache-Control": "no-store" };

function notFound(withBody = true) {
  return new Response(withBody ? "Not found" : null, { status: 404, headers: { "Content-Type": "text/plain", ...NO_STORE } });
}

async function resolve(params) {
  const { token } = await params;
  return resolveMediaRequest({
    segment: token,
    rootKey: signingRootKey(),
    nowSeconds: Date.now() / 1000,
    verificationFile: tiktokVerificationFile(),
    loadRow: (id) =>
      db.tikTokPublish.findUnique({ where: { id }, select: { companyId: true, status: true, imageUrl: true } }),
  });
}

function verificationResponse(file, withBody) {
  return new Response(withBody ? file.content : null, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE },
  });
}

export async function GET(request, { params }) {
  const hit = await resolve(params);
  if (!hit) return notFound();
  if (hit.kind === "verification") return verificationResponse(hit.file, true);

  let upstream;
  try {
    upstream = await fetch(hit.imageUrl, { signal: AbortSignal.timeout(20_000) });
  } catch {
    return new Response("Upstream unavailable", { status: 502, headers: NO_STORE });
  }
  if (!upstream.ok || !upstream.body) return new Response("Upstream unavailable", { status: 502, headers: NO_STORE });

  const type = (upstream.headers.get("content-type") || "").toLowerCase();
  // TikTok photo posts accept JPEG and WebP only.
  if (!type.startsWith("image/jpeg") && !type.startsWith("image/webp")) return notFound();

  const headers = {
    "Content-Type": type.startsWith("image/webp") ? "image/webp" : "image/jpeg",
    "X-Robots-Tag": "noindex",
    ...NO_STORE,
  };
  const length = upstream.headers.get("content-length");
  if (length && /^\d+$/.test(length)) headers["Content-Length"] = length;
  return new Response(upstream.body, { status: 200, headers });
}

export async function HEAD(request, { params }) {
  const hit = await resolve(params);
  if (!hit) return notFound(false);
  if (hit.kind === "verification") return verificationResponse(hit.file, false);
  return new Response(null, { status: 200, headers: { "Content-Type": "image/jpeg", ...NO_STORE } });
}
