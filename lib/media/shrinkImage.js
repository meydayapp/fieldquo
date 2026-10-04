// lib/media/shrinkImage.js
//
// Make a photo the size it needs to be BEFORE it leaves the phone, and take
// the GPS out of it on the way.
//
// ══ Why (owner-approved cost saver, 2026-10-03) ═════════════════════════════
//
// A phone photo arrives at 4032 × 3024 and 3–12 MB. Nothing in FieldQuo shows
// one larger than a quote page or a website hero — about 2,000 px across at
// most, and Cloudinary's delivery URLs already ask for less. So every byte past
// ~2,560 px on the long side was paid for three times and used never:
//
//   - the contractor's data plan and time, in a driveway on one bar;
//   - Cloudinary STORAGE, every month, for as long as the photo exists;
//   - Cloudinary transformation work, every time a delivery size is derived
//     from a 12-megapixel original instead of a 6-megapixel one.
//
// ══ Why in the browser, and not a Cloudinary incoming transformation ══════
//
// An incoming transformation (signed `transformation=c_limit,w_2560…`) would
// shrink what is STORED, but it is billed as a transformation on every upload,
// and the full-size bytes still cross the contractor's connection first —
// which is the slow part the owner's 2026-09-22 upload complaint was about.
// Doing it here costs nothing and saves all three. The server-side rules in
// lib/media/directUpload.js are untouched: it still signs, caps and verifies
// whatever arrives, so a browser that skips this (an old tab, a script) is
// stored exactly as before — this is an optimisation, never a control.
//
// ══ GPS ═════════════════════════════════════════════════════════════════════
//
// A phone writes the exact spot a photo was taken into its EXIF. For a job
// photo that is the homeowner's house, and these photos are served on public
// URLs (quotes, the website, the portal). Nothing in FieldQuo reads a photo's
// GPS — checked 2026-10-03: crew attribution reads an MMS's Latitude/Longitude
// parameters from Twilio (lib/crew/inboundParse.js pointFromInbound), and the
// time-clock "location stamps" come from the browser's geolocation at the tap
// (LocationStamp), never from a photo. So the location goes, everywhere:
//
//   - a resized or re-encoded photo loses ALL its EXIF (a canvas carries none),
//     after the orientation has been applied to the pixels, so it still stands
//     the right way up;
//   - a photo that is already small enough is NOT re-encoded (that would only
//     lose quality) — its GPS block is zeroed in place by stripJpegGps /
//     stripPngGps below, leaving orientation and everything else as it was.
//
// HEIC is handled honestly rather than hopefully: a browser that can decode it
// (Safari) converts it to a JPEG at the same cap; one that cannot (Chrome,
// Firefox) sends the original untouched, exactly as before, and Cloudinary
// converts it on delivery. Its GPS is not stripped on that path — parsing the
// HEIF box format in the browser is a project of its own, and a phone picker
// on iOS already hands a JPEG to the web in the common case.
//
// ══ Never makes anything worse ══════════════════════════════════════════════
//
//   - never upscales (a 1,200 px photo stays 1,200 px);
//   - keeps the result only when it is SMALLER than what was picked;
//   - PNG stays PNG (a logo's transparency survives), WebP stays WebP;
//   - GIF (may be animated), SVG, video, PDF and everything else pass through;
//   - any failure at all — no canvas, a decode error, an encoder that ignores
//     the type asked for — sends the original file, unchanged.
//
// The decisions (shrinkPlan) and the byte surgery (stripJpegGps, stripPngGps)
// are pure and run in Node, so scripts/check-shrink-image.mjs executes them
// against hostile input; only shrinkForUpload touches a canvas.

export const SHRINK_MAX_SIDE = 2560;
export const SHRINK_QUALITY = 0.85;
// Under this, a photo already at or under the cap is left alone except for its
// GPS: re-encoding a modest JPEG at 0.85 mostly trades quality for nothing.
export const RECOMPRESS_MIN_BYTES = 1_500_000;

// Upload purposes whose images must keep their pixels. A drawing sheet is
// rendered at 3,000 px on purpose (app/components/planRead/pdfPages.js — text
// on a 36 × 24 in sheet has to stay legible to the deep read), so the whole
// "plans" purpose is exempt from resizing. Its GPS is still stripped.
export const NO_RESIZE_PURPOSES = Object.freeze(["plans"]);

const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/**
 * What to do with one picked image. PURE.
 *
 * @param {{ type, size, width, height, purpose }} input
 *   `width`/`height` are the decoded, orientation-applied dimensions, or
 *   null when the browser could not decode the file.
 * @returns {{ action: "skip"|"strip"|"resize"|"recompress", reason, width?, height?, outType?, quality? }}
 */
export function shrinkPlan({ type, size, width = null, height = null, purpose = null } = {}) {
  const t = typeof type === "string" ? type.toLowerCase() : "";
  const bytes = Number(size);
  if (!RESIZABLE.has(t)) return { action: "skip", reason: "not_a_photo" };
  if (!Number.isFinite(bytes) || bytes <= 0) return { action: "skip", reason: "no_size" };

  const strip = t === "image/jpeg" || t === "image/png" ? { action: "strip", reason: "small_enough" } : { action: "skip", reason: "small_enough" };

  const w = Number(width);
  const h = Number(height);
  const decoded = Number.isFinite(w) && Number.isFinite(h) && w >= 1 && h >= 1;
  if (!decoded) {
    // Undecodable here (HEIC on Chrome). The bytes can still lose their GPS
    // when they are a format this file can read.
    return t === "image/heic" || t === "image/heif" ? { action: "skip", reason: "undecodable" } : { ...strip, reason: "undecodable" };
  }

  const noResize = typeof purpose === "string" && NO_RESIZE_PURPOSES.includes(purpose);
  // A HEIC that decoded becomes a JPEG; everything else keeps its own type.
  const outType = t === "image/heic" || t === "image/heif" ? "image/jpeg" : t;
  const quality = outType === "image/png" ? undefined : SHRINK_QUALITY;

  const longest = Math.max(w, h);
  if (!noResize && longest > SHRINK_MAX_SIDE) {
    const scale = SHRINK_MAX_SIDE / longest;
    return {
      action: "resize",
      reason: "over_cap",
      // Never zero: a 10,000 × 3 panorama still keeps one row.
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
      outType,
      quality,
    };
  }
  // A HEIC that decoded is converted even when small — Chrome cannot show one,
  // and the JPEG is what every client-facing surface ends up serving anyway.
  if (outType !== t) return { action: "recompress", reason: "convert_heic", width: w, height: h, outType, quality };
  // An oversized-in-bytes JPEG/WebP at a sensible size (a q100 export).
  if (!noResize && (t === "image/jpeg" || t === "image/webp") && bytes > RECOMPRESS_MIN_BYTES) {
    return { action: "recompress", reason: "heavy", width: w, height: h, outType, quality };
  }
  return strip;
}

// ── TIFF (EXIF) GPS surgery ─────────────────────────────────────────────────

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const GPS_IFD_TAG = 0x8825;

/**
 * Zero the GPS IFD inside one TIFF block, in place. Returns true when GPS data
 * was found and removed. Every offset is bounds-checked against the block: a
 * malformed or hostile EXIF changes nothing rather than throwing or writing
 * outside it.
 */
function zeroTiffGps(buf, start, end) {
  if (end - start < 8) return false;
  const order = String.fromCharCode(buf[start], buf[start + 1]);
  const little = order === "II";
  if (!little && order !== "MM") return false;
  const u16 = (o) => (little ? buf[o] | (buf[o + 1] << 8) : (buf[o] << 8) | buf[o + 1]);
  const u32 = (o) =>
    (little
      ? buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)
      : (buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0;
  const len = end - start;
  if (u16(start + 2) !== 42) return false;
  const ifd0 = u32(start + 4);
  if (ifd0 < 8 || ifd0 + 2 > len) return false;
  const count0 = u16(start + ifd0);
  if (ifd0 + 2 + count0 * 12 > len) return false;

  let gps = null;
  for (let i = 0; i < count0; i++) {
    const e = start + ifd0 + 2 + i * 12;
    if (u16(e) === GPS_IFD_TAG) {
      gps = u32(e + 8);
      break;
    }
  }
  if (gps === null || gps < 8 || gps + 2 > len) return false;
  const n = u16(start + gps);
  // Already empty (stripped before): nothing to do, and saying "changed"
  // would re-wrap a file that is already what it should be.
  if (n === 0) return false;
  if (gps + 2 + n * 12 + 4 > len) return false;
  for (let i = 0; i < n; i++) {
    const e = start + gps + 2 + i * 12;
    const type = u16(e + 2);
    const count = u32(e + 4);
    const size = (TYPE_SIZE[type] || 0) * count;
    // Values over four bytes live elsewhere in the block — zero them there too,
    // or the coordinates are still in the file, merely unreferenced.
    if (size > 4) {
      const off = u32(e + 8);
      if (off >= 8 && off + size <= len) buf.fill(0, start + off, start + off + size);
    }
    buf.fill(0, e, e + 12);
  }
  // An empty GPS IFD: still a valid TIFF, so readers that follow the pointer
  // find nothing rather than garbage.
  buf[start + gps] = 0;
  buf[start + gps + 1] = 0;
  return true;
}

const XMP_GPS = /exif:GPS(Latitude|Longitude|Altitude)|GPSLatitude|GPSLongitude/;

function asciiAt(buf, at, text) {
  if (at + text.length > buf.length) return false;
  for (let i = 0; i < text.length; i++) if (buf[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

/**
 * A JPEG with its GPS removed. PURE — takes and returns a Uint8Array (a copy;
 * the input is never modified). `changed` is false, and the bytes identical,
 * for anything that is not a well-formed JPEG or carries no GPS.
 *
 * EXIF (APP1 "Exif\0\0"): the GPS IFD is zeroed in place, so orientation,
 * camera and date survive. XMP (APP1 with Adobe's namespace) that mentions a
 * GPS coordinate is dropped whole — it is description, never pixels.
 */
export function stripJpegGps(input) {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) return { bytes: src, changed: false };
  const buf = new Uint8Array(src);
  const drop = [];
  let changed = false;
  let p = 2;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) break; // not a marker where one must be — stop, change nothing more
    const marker = buf[p + 1];
    if (marker === 0xff) { p += 1; continue; } // fill byte
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end of image
    if (marker >= 0xd0 && marker <= 0xd7) { p += 2; continue; }
    const segLen = (buf[p + 2] << 8) | buf[p + 3];
    const end = p + 2 + segLen;
    if (segLen < 2 || end > buf.length) break;
    if (marker === 0xe1) {
      const body = p + 4;
      if (asciiAt(buf, body, "Exif\0\0")) {
        if (zeroTiffGps(buf, body + 6, end)) changed = true;
      } else if (asciiAt(buf, body, "http://ns.adobe.com/xap/1.0/")) {
        const text = new TextDecoder("latin1").decode(buf.subarray(body, end));
        if (XMP_GPS.test(text)) drop.push([p, end]);
      }
    }
    p = end;
  }
  if (drop.length) {
    const kept = [];
    let at = 0;
    for (const [s, e] of drop) {
      kept.push(buf.subarray(at, s));
      at = e;
    }
    kept.push(buf.subarray(at));
    const out = new Uint8Array(kept.reduce((n, k) => n + k.length, 0));
    let o = 0;
    for (const k of kept) { out.set(k, o); o += k.length; }
    return { bytes: out, changed: true };
  }
  return { bytes: changed ? buf : src, changed };
}

// CRC-32 (PNG's), for the one chunk whose bytes change.
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * A PNG with the GPS in its eXIf chunk zeroed (and that chunk's CRC redone).
 * PURE, same contract as stripJpegGps. The chunk keeps its length, so nothing
 * else in the file moves.
 */
export function stripPngGps(input) {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (src.length < 8 || PNG_SIGNATURE.some((b, i) => src[i] !== b)) return { bytes: src, changed: false };
  const buf = new Uint8Array(src);
  let changed = false;
  let p = 8;
  while (p + 12 <= buf.length) {
    const len = ((buf[p] << 24) | (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]) >>> 0;
    const dataStart = p + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > buf.length) break;
    if (asciiAt(buf, p + 4, "eXIf") && zeroTiffGps(buf, dataStart, dataEnd)) {
      const crc = crc32(buf.subarray(p + 4, dataEnd));
      buf[dataEnd] = crc >>> 24;
      buf[dataEnd + 1] = (crc >>> 16) & 0xff;
      buf[dataEnd + 2] = (crc >>> 8) & 0xff;
      buf[dataEnd + 3] = crc & 0xff;
      changed = true;
    }
    if (asciiAt(buf, p + 4, "IEND")) break;
    p = dataEnd + 4;
  }
  return { bytes: changed ? buf : src, changed };
}

/** The extension a converted file is renamed to, so the name matches the bytes. */
export function renamedFor(name, outType) {
  const raw = String(name || "photo");
  if (outType !== "image/jpeg") return raw;
  const base = raw.replace(/\.(heic|heif)$/i, "");
  return /\.jpe?g$/i.test(base) ? base : `${base}.jpg`;
}

async function decode(file) {
  if (typeof globalThis.createImageBitmap !== "function") return null;
  try {
    // "from-image": the EXIF orientation is applied to the pixels, so a
    // re-encoded photo (which carries no EXIF) still stands the right way up.
    return await globalThis.createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

async function encode(bitmap, { width, height, outType, quality }) {
  let canvas;
  if (typeof globalThis.OffscreenCanvas === "function") {
    canvas = new globalThis.OffscreenCanvas(width, height);
  } else if (typeof document !== "undefined") {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
  } else {
    return null;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (outType === "image/jpeg") {
    // A transparent pixel would otherwise encode black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob =
    typeof canvas.convertToBlob === "function"
      ? await canvas.convertToBlob({ type: outType, quality })
      : await new Promise((resolve) => canvas.toBlob(resolve, outType, quality));
  // A browser that cannot encode WebP hands back a PNG instead of refusing —
  // usually much larger, and the wrong type for the name. Not ours to keep.
  if (!blob || blob.type !== outType) return null;
  return blob;
}

function asFile(blob, name, type) {
  if (typeof File === "function") {
    try {
      return new File([blob], name, { type, lastModified: Date.now() });
    } catch {
      /* Safari < 14 has no File constructor — a Blob uploads the same */
    }
  }
  return blob instanceof Blob && blob.type === type ? blob : new Blob([blob], { type });
}

/**
 * The file to upload in place of `file`. Never throws, never rejects: on any
 * failure the original comes back with `action: "skip"`.
 *
 * @returns {Promise<{ file, name, type, before, after, action, reason }>}
 */
export async function shrinkForUpload(file, { name = "", type = "", purpose = null } = {}) {
  const before = Number(file?.size) || 0;
  const original = { file, name, type, before, after: before, action: "skip", reason: "unchanged" };
  try {
    if (!file || typeof file.arrayBuffer !== "function") return original;
    const first = shrinkPlan({ type, size: before, purpose });
    if (first.reason === "not_a_photo" || first.reason === "no_size") return { ...original, reason: first.reason };

    const bitmap = await decode(file);
    const plan = shrinkPlan({ type, size: before, width: bitmap?.width ?? null, height: bitmap?.height ?? null, purpose });

    if (plan.action === "resize" || plan.action === "recompress") {
      const blob = await encode(bitmap, plan).catch(() => null);
      bitmap?.close?.();
      if (blob && (blob.size < before || plan.reason === "convert_heic")) {
        const outName = renamedFor(name, plan.outType);
        return { file: asFile(blob, outName, plan.outType), name: outName, type: plan.outType, before, after: blob.size, action: plan.action, reason: plan.reason };
      }
      // Bigger, or not encodable here: fall through to the GPS-only path.
    } else {
      bitmap?.close?.();
    }

    const t = String(type).toLowerCase();
    if (t !== "image/jpeg" && t !== "image/png") return { ...original, reason: plan.reason };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stripped = t === "image/jpeg" ? stripJpegGps(bytes) : stripPngGps(bytes);
    if (!stripped.changed) return { ...original, reason: "no_gps" };
    return { file: asFile(new Blob([stripped.bytes], { type: t }), name, t), name, type: t, before, after: stripped.bytes.length, action: "strip", reason: "gps_removed" };
  } catch {
    return original;
  }
}
