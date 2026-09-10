// lib/measure/satelliteCapture.js
//
// Keep the satellite still that a homeowner was shown.
//
// ══ What was being "saved" before ═════════════════════════════════════════
//
// A URL. satelliteImageUrl came out of roofMeasurement.js as a Static Maps
// link with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY baked into the query string, and
// that string is what landed in Quote.estimateData.measurement and what the
// estimate-review screen renders months later.
//
// Three things are wrong with storing a link and calling it saved:
//
//  1. IT IS NOT A RECORD. The homeowner was shown a photograph of their roof
//     at a moment in time, and the quote was priced off it. Re-fetching that
//     URL next year returns whatever Google's imagery says THEN. A quote's
//     evidence has to be the picture that was actually used, the same reason
//     Quote.language is fixed at creation.
//  2. IT BREAKS ON A KEY ROTATION. That key is public and referrer-restricted
//     on purpose. Tighten the referrer list, rotate the key, or move the
//     screen to a new host, and every historical quote's image 404s at once —
//     silently, as a broken image, on the screen an estimator uses to justify
//     a price to a customer.
//  3. IT IS BILLED PER RENDER. Every open of every old review is another
//     Static Maps request.
//
// So the bytes are fetched once, on the server, and put in Cloudinary beside
// every other image this product keeps.
//
// ══ Never at the cost of the quote ════════════════════════════════════════
//
// This runs inside quote creation. If Cloudinary is down, or the fetch times
// out, or the key is missing in a local dev environment, the quote is still
// created and the measurement keeps the Google URL it already had. A saved
// image is worth having; it is not worth losing a lead over.
import { uploadBuffer } from "@/lib/cloudinary";

/** Static Maps images are small. Anything larger is not one, and is refused. */
const MAX_BYTES = 4 * 1024 * 1024;

/** Long enough for a slow image, short enough not to hold up a lead. */
const TIMEOUT_MS = 8000;

/** Already ours? Then it has been captured before and must not be re-uploaded. */
export function alreadyCaptured(url) {
  return typeof url === "string" && /^https:\/\/res\.cloudinary\.com\//.test(url);
}

/**
 * Fetch one Static Maps still and put it in Cloudinary.
 *
 * @returns { url, publicId, bytes } or null on any failure. Never throws.
 */
export async function captureSatelliteImage(sourceUrl, { companyId, tag } = {}) {
  if (!sourceUrl || typeof sourceUrl !== "string") return null;
  if (!sourceUrl.startsWith("https://")) return null;
  if (alreadyCaptured(sourceUrl)) return { url: sourceUrl, publicId: null, bytes: 0 };
  if (!process.env.CLOUDINARY_API_KEY) return null;

  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    // Static Maps answers a bad key with a PNG that says "this page can't load
    // Google Maps correctly", not with an error status — so the content type
    // alone cannot tell us it worked. What it CAN do is stop us storing an
    // HTML error body as though it were a photograph.
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_BYTES) return null;

    const uploaded = await uploadBuffer(buffer, {
      // Foldered by company so a company's assets can be found — and, when a
      // company is deleted, found together.
      folder: `fieldquo/satellite/${companyId || "unknown"}`,
      resourceType: "image",
    });
    if (!uploaded?.secure_url) return null;
    return { url: uploaded.secure_url, publicId: uploaded.public_id || null, bytes: buffer.length, tag };
  } catch {
    return null;
  }
}

/**
 * The measurement snapshot, with its satellite still made permanent.
 *
 * Returns a NEW object; the caller's is untouched. The Google URL is kept
 * under `satelliteSourceUrl` rather than discarded — when an image looks wrong
 * a year from now, the question is always "what did we ask Google for", and
 * that question has no answer if the request is thrown away.
 */
export async function withCapturedSatellite(measurement, { companyId } = {}) {
  if (!measurement || typeof measurement !== "object") return measurement;
  const source = measurement.satelliteImageUrl;
  if (!source || alreadyCaptured(source)) return measurement;

  const captured = await captureSatelliteImage(source, { companyId });
  if (!captured?.url) return measurement;

  return {
    ...measurement,
    satelliteImageUrl: captured.url,
    satelliteSourceUrl: source,
    satelliteCapturedAt: new Date().toISOString(),
    ...(captured.publicId ? { satellitePublicId: captured.publicId } : {}),
  };
}
