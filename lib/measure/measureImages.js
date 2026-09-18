// lib/measure/measureImages.js
//
// The satellite still a scope group was measured from, kept on the group and
// printed on the document the client receives.
//
// ══ One shape on every measured takeoff ═══════════════════════════════════
//
//   takeoff.measureImage = { url, sourceUrl, capturedAt }
//
//   url         our copy (Cloudinary) — the ONLY thing a document prints
//   sourceUrl   what was asked of Google (a Static Maps link, key included)
//   capturedAt  when the copy was taken
//
// Written by three producers and read by one consumer:
//
//   · the builder's roof / gutter measure panel and the lawn tracer set
//     `sourceUrl` (the lawn tracer sets `takeoff.lawn.vertices` and lets
//     this file build the outline still from them); since 2026-09-18 the
//     roof and paving panels instead store the still's REQUEST on the
//     takeoff as `measureFrame` — the six numbers imageScale.js's
//     stillFrame() vouches for, plus the marker flag — because the estimator
//     can now zoom the still and re-measure from another address, and the
//     browser must never build a keyed Google URL; this file builds it from
//     the frame on save;
//   · the instant-quote draft writes `url` directly, because
//     createEstimateQuote has already captured the still
//     (lib/estimate/instantQuoteCosting.js measureImageFor);
//   · withCapturedMeasureImages() below runs on every quote save and turns a
//     `sourceUrl` into a `url`, so nothing a client opens hotlinks Google —
//     see lib/measure/satelliteCapture.js for the three reasons that matters;
//   · measureCaption() is the sentence the document prints beside it.
//
// The document section (lib/documentSections/ScopeGroupsSection.js, the
// public quote page, the PDF) reads `url` and the caption, and nothing else
// from the takeoff — a countertop takeoff carries supplier cost and markup,
// and this file is the only projection of a takeoff that reaches a client.
//
// Best-effort throughout: a capture that fails leaves the group exactly as it
// arrived, and the save goes through. A quote is not lost over a picture.

import { captureSatelliteImage, alreadyCaptured } from "@/lib/measure/satelliteCapture";
import { lawnOutlineImageUrl } from "@/lib/measure/lawnEstimate";
import { sphericalPolygonAreaSqft } from "@/lib/measure/lotArea";
import { satelliteImageUrl } from "@/lib/measure/roofMeasurement";
import { stillFrame } from "@/lib/measure/imageScale";
import { measureDocCopy } from "@/lib/i18n/measureDocCopy";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The address a measurement was taken at, off the takeoff, or "". PURE.
 *
 * Two spellings are read. `measureAddress` is what the builder's shared
 * address field (MeasureAddressField) writes for roof, paving and the
 * landscaping trades. `measuredAddress` is the older name the gutter
 * measurement and the instant-quote draft (lib/estimate/instantQuoteCosting.js,
 * out of this change's reach) still write; nothing printed it until now, so
 * it is read here rather than migrated. One reader, so the two can never
 * print differently. Third and fourth: the address the OUTLINE was traced
 * at (`traced.address` for paving, `lawn.address` for the lot trades),
 * which the instant-quote draft writes with the outline and no other
 * address beside it — without this the driveway printed "Paving area
 * measured" with no "measured at" under it.
 */
export function takeoffMeasureAddress(takeoff) {
  const a = takeoff?.measureAddress ?? takeoff?.measuredAddress ?? takeoff?.traced?.address ?? takeoff?.lawn?.address;
  return typeof a === "string" ? a.trim() : "";
}

/**
 * Whether a stored frame should become the document's still. PURE.
 *
 * Every measuring panel stores `measureFrame` the moment a still is on
 * screen, because a reopened quote needs it to put the drawing back on the
 * same picture — that is a fact about the BUILDER. Whether the still prints
 * for the CLIENT is a different question: a paving takeoff whose three boxes
 * were typed, with nothing traced, has a frame and no measurement, and a
 * satellite photo of the house under "Measured at 12 Main St" with nothing
 * measured would be a claim about nothing. So:
 *
 *   paving           only with a traced total (measuredAreaSqft, which the
 *                    designer writes from the drawing and nothing else);
 *   roofing_service  only once the takeoff carries a satellite measurement;
 *   the lot trades   never from the frame — their still is the OUTLINE
 *                    still drawn from `lawn.vertices` above, and a bare
 *                    frame with no outline is a photo of nothing measured;
 *   anything else    never (gutters keep writing `sourceUrl`).
 */
function frameWorthPrinting(takeoff, categoryKey) {
  if (!stillFrame(takeoff?.measureFrame)) return false;
  if (categoryKey === "paving") return num(takeoff.measuredAreaSqft) > 0;
  if (categoryKey === "roofing_service") return takeoff.measuredFrom === "satellite";
  return false;
}

/**
 * The `measureImage` a takeoff should carry after a save, or null when it
 * has nothing to picture. PURE apart from the outline URL's key: decides the
 * source, never fetches.
 *
 * Order matters: an already-captured copy wins, then an explicit source, then
 * the lawn outline drawn from vertices, then the stored frame. The frame is
 * last because a lawn tracer's still is the OUTLINE still (the traced shape
 * drawn on it), which a bare frame of the same address would replace with a
 * plain photo.
 */
export function measureImageSource(takeoff, categoryKey = null) {
  const img = takeoff?.measureImage;
  if (img && typeof img === "object") {
    if (typeof img.url === "string" && alreadyCaptured(img.url)) return { ...img };
    if (typeof img.sourceUrl === "string" && img.sourceUrl.startsWith("https://")) return { sourceUrl: img.sourceUrl };
  }
  const vertices = takeoff?.lawn?.vertices;
  if (Array.isArray(vertices) && vertices.length >= 3) {
    const sourceUrl = lawnOutlineImageUrl(vertices);
    return sourceUrl ? { sourceUrl } : null;
  }
  // A paving takeoff whose outline is on record prints the OUTLINE still,
  // the way a lawn does — the shape the estimator drew, on the picture —
  // and only falls back to the bare frame when the outline could not be
  // projected (a drawing over a manual reference line has no coordinates).
  // `traced.vertices`, never `lawn`: a driveway is not filed under lawn
  // (lib/documentSections/traceOutline.js).
  const traced = takeoff?.traced?.vertices;
  if (categoryKey === "paving" && Array.isArray(traced) && traced.length >= 3 && num(takeoff.measuredAreaSqft) > 0) {
    const sourceUrl = lawnOutlineImageUrl(traced);
    if (sourceUrl) return { sourceUrl };
  }
  if (frameWorthPrinting(takeoff, categoryKey)) {
    const f = stillFrame(takeoff.measureFrame);
    // The public key, server-side, the same URL shape the roof measurement
    // has always captured — never the unrestricted server key, which must not
    // end up in a stored `sourceUrl` (see satellite.js staticSatelliteUrl).
    const sourceUrl = satelliteImageUrl(f.lat, f.lng, {
      zoom: f.zoom,
      size: `${f.width}x${f.height}`,
      scale: f.scale,
      marker: f.marker,
    });
    return sourceUrl ? { sourceUrl } : null;
  }
  return null;
}

/**
 * Every group's still captured, and every traced lawn's area re-derived from
 * its vertices as a cross-check. Returns a NEW array; the caller's is
 * untouched. Groups without a takeoff pass through by reference.
 *
 * The lawn area is NOT overwritten: the group was priced on the figure the
 * estimator saw, and the document must print that figure. The spherical
 * recompute is stored beside it (`sphericalSqft`) so a review can see a
 * canvas that disagrees with its own outline — scripts/check-lawn-care.mjs
 * asserts the two agree to 1% on a known rectangle.
 */
export async function withCapturedMeasureImages(scopeGroups, { companyId } = {}) {
  if (!Array.isArray(scopeGroups)) return scopeGroups;
  const out = [];
  for (const g of scopeGroups) {
    const takeoff = g && typeof g === "object" && g.takeoff && typeof g.takeoff === "object" ? g.takeoff : null;
    if (!takeoff) {
      out.push(g);
      continue;
    }
    let next = takeoff;

    const vertices = takeoff.lawn?.vertices;
    if (Array.isArray(vertices) && vertices.length >= 3) {
      const sphericalSqft = sphericalPolygonAreaSqft(vertices);
      if (sphericalSqft > 0 && takeoff.lawn.sphericalSqft !== sphericalSqft) {
        next = { ...next, lawn: { ...takeoff.lawn, sphericalSqft } };
      }
    }

    // A paving outline is cross-checked the way a lawn's is.
    const traced = takeoff.traced?.vertices;
    if (Array.isArray(traced) && traced.length >= 3) {
      const sphericalSqft = sphericalPolygonAreaSqft(traced);
      if (sphericalSqft > 0 && takeoff.traced.sphericalSqft !== sphericalSqft) {
        next = { ...next, traced: { ...takeoff.traced, sphericalSqft } };
      }
    }

    const source = measureImageSource(next, g.categoryKey ?? g.category?.key ?? null);
    if (source && !source.url && source.sourceUrl) {
      const captured = await captureSatelliteImage(source.sourceUrl, { companyId });
      if (captured?.url) {
        next = {
          ...next,
          measureImage: {
            url: captured.url,
            sourceUrl: source.sourceUrl,
            capturedAt: new Date().toISOString(),
            ...(captured.publicId ? { publicId: captured.publicId } : {}),
          },
        };
      } else if (!next.measureImage || next.measureImage.sourceUrl !== source.sourceUrl) {
        // Not captured this time; keep the request so the next save retries.
        next = { ...next, measureImage: { ...(next.measureImage || {}), sourceUrl: source.sourceUrl } };
      }
    }

    out.push(next === takeoff ? g : { ...g, takeoff: next });
  }
  return out;
}

/**
 * What the document prints beside the still — the measured fact in the
 * document's language — or null when the takeoff carries nothing a client
 * should read. PURE.
 *
 * Reads a fixed handful of fields by name and nothing else, for the reason
 * in the header: this is the one projection of a takeoff that reaches a
 * client.
 */
export function measureCaption(takeoff, categoryKey, language = "en") {
  if (!takeoff || typeof takeoff !== "object") return null;
  const t = measureDocCopy(language);

  const lawn = takeoff.lawn;
  if (lawn && typeof lawn === "object" && num(lawn.areaSqft) > 0) {
    if (lawn.basis === "minimum" || lawn.source === "minimum") return t.lawnMinimum(lawn.areaSqft);
    if (lawn.basis === "traced" || lawn.source === "traced" || lawn.source === "traced_builder" || lawn.estimated === false) {
      return t.lawnMeasured(lawn.areaSqft);
    }
    return t.lawnEstimated(lawn.areaSqft);
  }

  if (categoryKey === "roofing_service" && takeoff.measuredFrom === "satellite" && num(takeoff.areaSqft) > 0) {
    return t.roof(takeoff.areaSqft, num(takeoff.pitchRise));
  }
  if (categoryKey === "gutter_services" && takeoff.measuredFrom === "satellite" && num(takeoff.gutterFt) > 0) {
    const ds = num(takeoff.downspoutsInstalled) ?? num(takeoff.downspoutsFlushed);
    return t.gutters(takeoff.gutterFt, ds);
  }
  if (categoryKey === "paving" && num(takeoff.measuredAreaSqft) > 0) {
    return t.paving(takeoff.measuredAreaSqft);
  }
  return null;
}

/**
 * The client-facing projection of one group's measurement: the captured
 * still, its caption, and the address it was measured at, or null. This —
 * and only this — is what the public quote route and the document sections
 * read off a takeoff.
 *
 * `measuredAt` is the sentence under the caption — "Measured at 12 Main St"
 * — in the document's language, from clientDocCopy rather than
 * measureDocCopy because that table carries every language the product has
 * document copy for (eight) and this one carries three; a German document
 * would otherwise print an English address line beside a German caption.
 * Null when the takeoff carries no address or there is no still and no
 * caption to sit under: an address alone is not evidence of anything.
 */
export function measureEvidence(takeoff, categoryKey, language = "en") {
  const url = takeoff?.measureImage?.url;
  const caption = measureCaption(takeoff, categoryKey, language);
  if (!caption && !(typeof url === "string" && alreadyCaptured(url))) return null;
  const address = takeoffMeasureAddress(takeoff);
  return {
    imageUrl: typeof url === "string" && alreadyCaptured(url) ? url : null,
    caption,
    measuredAt: address ? clientDocCopy(language).measuredAt(address) : null,
  };
}
