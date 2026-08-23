// app/api/measure/satellite/route.js
//
// Aerial imagery for the paver measuring tool. Two jobs behind one path:
//
//   GET ?address=...                 → JSON: where it is, and the pixels→feet
//                                      scale, plus a keyless URL for the image
//   GET ?format=png&lat=..&lng=..    → the image bytes themselves, proxied
//
// ── Why the image is proxied instead of linked ──────────────────────────────
//
// The obvious implementation returns a maps.googleapis.com URL and lets the
// <img> load it. That URL has to carry an API key, and an API key in an <img
// src> is a public API key — it is in the DOM, in the network tab, in the
// browser history and in any screenshot of the estimate.
//
// The key this path needs is GOOGLE_MAPS_SERVER_KEY, which is UNRESTRICTED (it
// has to be: server calls carry no HTTP referrer for a referrer restriction to
// match) and also unlocks Geocoding, Distance Matrix and Solar. Leaking it is
// not "someone loads a few free map tiles", it is an open, billable Google
// account. So the bytes come through here instead. The browser only ever sees
// a same-origin path with coordinates in it.
//
// Signing that path was the considered alternative and was rejected: it needs a
// new signing secret, a new env var, and a docs/VERCEL.md entry — and it would
// buy little, because the parameters are already clamped to a satellite still
// of a bounded size by lib/measure/satellite.js, and the route is behind
// getCurrentMember. The worst an authenticated employee can do with it is look
// at a different rooftop, which they can also do on maps.google.com.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import {
  measureFromAddress,
  fetchSatelliteImage,
  imageScale,
  normaliseImageRequest,
} from "@/lib/measure/satellite";

/** Human text per machine reason, so the UI can show something and branch on something. */
const REASONS = {
  no_key: {
    status: 503,
    message:
      "Satellite measuring isn't configured. Set GOOGLE_MAPS_SERVER_KEY (with Geocoding and Static Maps enabled on the project) and redeploy.",
  },
  no_address: { status: 400, message: "Enter an address to measure." },
  geocode_failed: {
    status: 404,
    message: "We couldn't find that address. Check it, or enter the area manually.",
  },
  unmeasurable_location: {
    status: 422,
    message: "That location is outside the area satellite imagery covers.",
  },
  bad_request: { status: 400, message: "That isn't a valid map location." },
  imagery_unavailable: {
    status: 502,
    message: "Satellite imagery is unavailable right now. Try again shortly.",
  },
};

function fail(reason) {
  const { status, message } = REASONS[reason] || {
    status: 500,
    message: "Something went wrong measuring that address.",
  };
  // Both shapes deliberately: `error` is what the rest of this codebase's
  // routes return and what generic error handling reads, `reason` is the stable
  // machine token so a caller can offer manual entry on geocode_failed without
  // string-matching English.
  return NextResponse.json({ ok: false, error: message, reason }, { status });
}

export async function GET(request) {
  // Staff only. The tool measures a client's property from an address, which is
  // not something an anonymous caller should be able to do on our Google bill —
  // and it is not the public self-quote surface, which never sees prices or
  // internals (non-negotiable #4).
  const member = await getCurrentMember(request);
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // ── Image mode: proxy the bytes ───────────────────────────────────────────
  if (searchParams.get("format") === "png") {
    const req = normaliseImageRequest({
      lat: searchParams.get("lat"),
      lng: searchParams.get("lng"),
      zoom: searchParams.get("zoom"),
      scale: searchParams.get("scale"),
      width: searchParams.get("width"),
      height: searchParams.get("height"),
    });
    if (!req) return fail("bad_request");

    const image = await fetchSatelliteImage(req);
    if (!image.ok) return fail(image.reason);

    // The scale travels with the image as headers as well as in the JSON call,
    // so anything that fetches the picture directly (a canvas loader, a PDF
    // renderer) can't end up holding a picture with no idea what it measures.
    const scale = imageScale(req);

    return new NextResponse(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.bytes.byteLength),
        // Private: this is a picture of a named client's home. Aerial imagery
        // is refreshed every year or two, so a day of caching is free accuracy
        // and a real saving on a per-request-billed API — an estimator zooming
        // and re-drawing would otherwise re-bill every redraw.
        "Cache-Control": "private, max-age=86400",
        "X-Measure-Feet-Per-Pixel": String(scale?.feetPerPixel ?? ""),
        "X-Measure-Zoom": String(req.zoom),
      },
    });
  }

  // ── Measurement mode: address → location + scale + image path ─────────────
  const address = searchParams.get("address");
  if (!address) return fail("no_address");

  const result = await measureFromAddress(address, {
    zoom: searchParams.get("zoom") ?? undefined,
    scale: searchParams.get("scale") ?? undefined,
    width: searchParams.get("width") ?? undefined,
    height: searchParams.get("height") ?? undefined,
  });

  if (!result.ok) {
    // unmeasurable_location still carries the resolved address and coordinates;
    // keep them so the UI can at least confirm which place it found before
    // falling back to manual entry.
    if (result.formattedAddress) {
      const known = REASONS[result.reason] || {
        status: 500,
        message: "Something went wrong measuring that address.",
      };
      return NextResponse.json(
        {
          ok: false,
          error: known.message,
          reason: result.reason,
          formattedAddress: result.formattedAddress,
          location: result.location,
        },
        { status: known.status },
      );
    }
    return fail(result.reason);
  }

  return NextResponse.json(result);
}
