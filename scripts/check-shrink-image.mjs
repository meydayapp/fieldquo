// scripts/check-shrink-image.mjs
//
// Photos are shrunk and lose their GPS before upload (lib/media/shrinkImage.js).
// This executes the decisions and the byte surgery against hostile input, and
// MEASURES the saving on sample phone-sized photos.
//
//   npm run check:shrink-image
//
// The measurement uses sharp (already in node_modules, via Next) to stand in
// for the browser's canvas: decode, resize to the plan's dimensions, encode
// JPEG at the plan's quality. A browser's encoder is not mozjpeg, so the exact
// byte counts differ by a few percent — the ratio is the point, and it is
// printed so the report can quote it.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  shrinkPlan,
  stripJpegGps,
  stripPngGps,
  renamedFor,
  shrinkForUpload,
  SHRINK_MAX_SIDE,
  SHRINK_QUALITY,
  NO_RESIZE_PURPOSES,
} from "@/lib/media/shrinkImage";
import { uploadFile } from "@/lib/media/uploadClient";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

let pass = 0;
let fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};
const code = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

// An independent reader for the check — NOT the stripper's own parser, so a
// shared bug cannot make both agree. Returns the number of GPS entries in the
// first EXIF block, or null when there is no EXIF / no GPS pointer.
function gpsEntryCount(bytes) {
  const b = Buffer.from(bytes);
  const at = b.indexOf(Buffer.from("Exif\0\0"));
  if (at < 0) return null;
  const t = at + 6;
  const le = b.toString("latin1", t, t + 2) === "II";
  const r16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const r32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd = r32(t + 4);
  const n = r16(t + ifd);
  for (let i = 0; i < n; i++) {
    const e = t + ifd + 2 + i * 12;
    if (r16(e) === 0x8825) return r16(t + r32(e + 8));
  }
  return null;
}
function pngGpsEntryCount(bytes) {
  const b = Buffer.from(bytes);
  const at = b.indexOf(Buffer.from("eXIf"));
  if (at < 0) return null;
  const fake = Buffer.concat([Buffer.from("Exif\0\0"), b.subarray(at + 4)]);
  return gpsEntryCount(fake);
}
// The seconds of latitude, 1234/100, as they sit in the file — present before,
// gone after, or the stripper merely unlinked the coordinates.
const hasRational = (bytes, num, den, le) => {
  const x = Buffer.alloc(8);
  if (le) { x.writeUInt32LE(num, 0); x.writeUInt32LE(den, 4); } else { x.writeUInt32BE(num, 0); x.writeUInt32BE(den, 4); }
  return Buffer.from(bytes).includes(x);
};
const GPS = { GPSLatitudeRef: "N", GPSLatitude: "45/1 30/1 1234/100", GPSLongitudeRef: "W", GPSLongitude: "73/1 34/1 5678/100" };

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n1. The plan — what is resized, what is only stripped, what is left alone");
const phone = shrinkPlan({ type: "image/jpeg", size: 6_000_000, width: 4032, height: 3024 });
ok("a 4032×3024 phone photo is resized to the cap on its long side", phone.action === "resize" && phone.width === SHRINK_MAX_SIDE && phone.height === 1920, phone);
ok("…as a JPEG at the stated quality", phone.outType === "image/jpeg" && phone.quality === SHRINK_QUALITY);
const portrait = shrinkPlan({ type: "image/jpeg", size: 6_000_000, width: 3024, height: 4032 });
ok("a portrait photo caps its HEIGHT, not its width", portrait.height === SHRINK_MAX_SIDE && portrait.width === 1920, portrait);
ok("never upscales: 1200×900 is not resized", shrinkPlan({ type: "image/jpeg", size: 400_000, width: 1200, height: 900 }).action === "strip");
ok("exactly at the cap is not resized", shrinkPlan({ type: "image/jpeg", size: 900_000, width: SHRINK_MAX_SIDE, height: 1000 }).action === "strip");
ok("a heavy JPEG under the cap is re-encoded (kept only if smaller)", shrinkPlan({ type: "image/jpeg", size: 5_000_000, width: 2000, height: 1500 }).action === "recompress");
ok("a PNG over the cap stays a PNG (a logo keeps its transparency)", (() => { const p = shrinkPlan({ type: "image/png", size: 9_000_000, width: 5000, height: 2000 }); return p.action === "resize" && p.outType === "image/png" && p.quality === undefined; })());
ok("a WebP stays a WebP", shrinkPlan({ type: "image/webp", size: 3_000_000, width: 4000, height: 3000 }).outType === "image/webp");
ok("a decodable HEIC becomes a JPEG even when small", (() => { const p = shrinkPlan({ type: "image/heic", size: 900_000, width: 1000, height: 800 }); return p.action === "recompress" && p.outType === "image/jpeg"; })());
ok("an undecodable HEIC (Chrome) goes up untouched", shrinkPlan({ type: "image/heic", size: 3_000_000 }).action === "skip");
for (const t of ["image/gif", "image/svg+xml", "application/pdf", "video/mp4", "video/quicktime", "", null, 42, "IMAGE/JPEG; x"]) {
  ok(`not a resizable photo → skip: ${JSON.stringify(t)}`, shrinkPlan({ type: t, size: 5_000_000, width: 4000, height: 3000 }).action === "skip");
}
ok("type is matched case-insensitively", shrinkPlan({ type: "IMAGE/JPEG", size: 6_000_000, width: 4032, height: 3024 }).action === "resize");
for (const s of [0, -1, NaN, "x", Infinity, undefined]) {
  ok(`a nonsense size → skip: ${String(s)}`, shrinkPlan({ type: "image/jpeg", size: s, width: 4000, height: 3000 }).action === "skip");
}
for (const [w, h] of [[0, 0], [NaN, 3000], [-5, 10], ["x", "y"], [null, null]]) {
  ok(`undecoded dimensions (${w}×${h}) never resize`, ["strip", "skip"].includes(shrinkPlan({ type: "image/jpeg", size: 6_000_000, width: w, height: h }).action));
}
const pano = shrinkPlan({ type: "image/jpeg", size: 6_000_000, width: 100_000, height: 3 });
ok("a 100000×3 panorama keeps at least one row", pano.width === SHRINK_MAX_SIDE && pano.height >= 1, pano);
ok("the drawing-read purpose is never resized", NO_RESIZE_PURPOSES.includes("plans") && shrinkPlan({ type: "image/jpeg", size: 6_000_000, width: 3000, height: 2000, purpose: "plans" }).action === "strip");
ok("an unknown purpose is resized like any photo", shrinkPlan({ type: "image/jpeg", size: 6_000_000, width: 4032, height: 3024, purpose: "../plans" }).action === "resize");
ok("renamed: IMG_1.HEIC → IMG_1.jpg; a PNG keeps its name", renamedFor("IMG_1.HEIC", "image/jpeg") === "IMG_1.jpg" && renamedFor("logo.png", "image/png") === "logo.png" && renamedFor("a.jpeg", "image/jpeg") === "a.jpeg" && renamedFor("", "image/jpeg") === "photo.jpg");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n2. GPS is removed from a JPEG without touching anything else");
const small = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 90, g: 120, b: 150 } } })
  .jpeg({ quality: 85 })
  .withExif({ IFD0: { Make: "Apple", Model: "iPhone 15" }, IFD3: GPS })
  .withMetadata({ orientation: 6 })
  .toBuffer();
const smallMeta = await sharp(small).metadata();
ok("sample: the JPEG really carries GPS (4 entries) and the 1234/100 seconds", gpsEntryCount(small) === 4 && (hasRational(small, 1234, 100, false) || hasRational(small, 1234, 100, true)), gpsEntryCount(small));
const s1 = stripJpegGps(new Uint8Array(small));
ok("stripJpegGps reports a change", s1.changed === true);
ok("…the GPS IFD is empty", gpsEntryCount(s1.bytes) === 0, gpsEntryCount(s1.bytes));
ok("…and the coordinate VALUES are gone from the file, not just unlinked", !hasRational(s1.bytes, 1234, 100, false) && !hasRational(s1.bytes, 1234, 100, true) && !hasRational(s1.bytes, 5678, 100, false) && !hasRational(s1.bytes, 5678, 100, true));
ok("…the length is unchanged (zeroed in place)", s1.bytes.length === small.length);
const meta = await sharp(Buffer.from(s1.bytes)).metadata();
ok("…it still decodes, at the same size", meta.width === 1200 && meta.height === 900, meta);
ok("…and keeps its orientation and camera", smallMeta.orientation === 6 && meta.orientation === 6 && Buffer.from(s1.bytes).includes(Buffer.from("iPhone 15")), meta.orientation);
ok("the input buffer is never modified", gpsEntryCount(small) === 4);
ok("stripping twice is a no-op", stripJpegGps(s1.bytes).changed === false);

const noGps = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#888" } }).jpeg().withExif({ IFD0: { Make: "Canon" } }).toBuffer();
const s2 = stripJpegGps(new Uint8Array(noGps));
ok("a JPEG with EXIF but no GPS is returned byte-identical", s2.changed === false && Buffer.compare(Buffer.from(s2.bytes), noGps) === 0);

// XMP with a coordinate in it is dropped whole.
const xmp = Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description exif:GPSLatitude="45,30.2N"/></x:xmpmeta>', "latin1");
const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(xmp.length + 2) >> 8, (xmp.length + 2) & 0xff]), xmp]);
const withXmp = Buffer.concat([noGps.subarray(0, 2), app1, noGps.subarray(2)]);
const s3 = stripJpegGps(new Uint8Array(withXmp));
ok("an XMP block naming a GPS coordinate is removed", s3.changed && !Buffer.from(s3.bytes).includes(Buffer.from("GPSLatitude")));
ok("…and the rest of the JPEG is exactly what it was", Buffer.compare(Buffer.from(s3.bytes), noGps) === 0);
const harmlessXmp = Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description dc:title="Kitchen"/></x:xmpmeta>', "latin1");
const app1b = Buffer.concat([Buffer.from([0xff, 0xe1, (harmlessXmp.length + 2) >> 8, (harmlessXmp.length + 2) & 0xff]), harmlessXmp]);
ok("an XMP block with no location is kept", stripJpegGps(new Uint8Array(Buffer.concat([noGps.subarray(0, 2), app1b, noGps.subarray(2)]))).changed === false);

// Little-endian TIFF too (sharp writes big-endian; many phones write "II").
function toLittleEndianGpsJpeg() {
  // Hand-built: SOI, APP1 Exif with an II TIFF holding IFD0{GPS ptr} and a GPS
  // IFD with one RATIONAL[3] latitude stored out-of-line, then EOI.
  const tiff = Buffer.alloc(8 + 2 + 12 + 4 + 2 + 12 + 4 + 24);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8825, 10); tiff.writeUInt16LE(4, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt32LE(26, 18);
  tiff.writeUInt32LE(0, 22);
  tiff.writeUInt16LE(1, 26);
  tiff.writeUInt16LE(2, 28); tiff.writeUInt16LE(5, 30); tiff.writeUInt32LE(3, 32); tiff.writeUInt32LE(44, 36);
  tiff.writeUInt32LE(0, 40);
  [[45, 1], [30, 1], [1234, 100]].forEach(([n, d], i) => { tiff.writeUInt32LE(n, 44 + i * 8); tiff.writeUInt32LE(d, 48 + i * 8); });
  const body = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body, Buffer.from([0xff, 0xd9])]);
}
const le = toLittleEndianGpsJpeg();
ok("sample: little-endian EXIF has its GPS", gpsEntryCount(le) === 1 && hasRational(le, 1234, 100, true));
const s4 = stripJpegGps(new Uint8Array(le));
ok("little-endian ('II') EXIF: GPS removed, value bytes zeroed", s4.changed && gpsEntryCount(s4.bytes) === 0 && !hasRational(s4.bytes, 1234, 100, true));

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n3. Hostile bytes change nothing and never throw");
const hostile = [
  ["empty", new Uint8Array(0)],
  ["null", null],
  ["random", Uint8Array.from({ length: 4096 }, (_, i) => (i * 2654435761) & 0xff)],
  ["SOI only", Uint8Array.from([0xff, 0xd8])],
  ["truncated mid-segment", new Uint8Array(small.subarray(0, 30))],
  ["segment length past the end", Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x45, 0x78])],
  ["segment length 0", Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00, 0x00, 0x00])],
];
// EXIF whose IFD0 offset, entry count and GPS pointer point outside the block.
const bad = Buffer.from(le);
const ifdAt = bad.indexOf(Buffer.from("Exif\0\0")) + 6;
const badIfd = Buffer.from(bad); badIfd.writeUInt32LE(0xfffffff0, ifdAt + 4); hostile.push(["IFD0 offset past the block", new Uint8Array(badIfd)]);
const badCount = Buffer.from(bad); badCount.writeUInt16LE(0xffff, ifdAt + 8); hostile.push(["IFD0 entry count of 65535", new Uint8Array(badCount)]);
const badPtr = Buffer.from(bad); badPtr.writeUInt32LE(0x7fffffff, ifdAt + 18); hostile.push(["GPS pointer past the block", new Uint8Array(badPtr)]);
const badVal = Buffer.from(bad); badVal.writeUInt32LE(0x7ffffff0, ifdAt + 36); hostile.push(["GPS value offset past the block", new Uint8Array(badVal)]);
const badOrder = Buffer.from(bad); badOrder.write("XX", ifdAt, "latin1"); hostile.push(["byte order 'XX'", new Uint8Array(badOrder)]);
for (const [label, bytes] of hostile) {
  let res;
  let threw = false;
  try { res = stripJpegGps(bytes); } catch { threw = true; }
  const unchanged = res && !res.changed && res.bytes.length === (bytes?.length || 0);
  // The one hostile case that is still a valid GPS block to strip in part:
  // a value offset out of range zeroes the entry but cannot reach the value.
  const partial = label === "GPS value offset past the block" && res?.changed && res.bytes.length === bytes.length;
  ok(`${label}: no throw, ${partial ? "entry removed, nothing written out of bounds" : "nothing changed"}`, !threw && (unchanged || partial), res && { changed: res.changed, len: res.bytes.length });
}
ok("a PNG is not a JPEG to stripJpegGps", stripJpegGps(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).changed === false);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n4. PNG eXIf");
const png = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().withExif({ IFD3: GPS }).toBuffer();
ok("sample: the PNG carries an eXIf chunk with GPS", pngGpsEntryCount(png) === 4, pngGpsEntryCount(png));
const p1 = stripPngGps(new Uint8Array(png));
ok("stripPngGps empties its GPS IFD", p1.changed && pngGpsEntryCount(p1.bytes) === 0);
const pm = await sharp(Buffer.from(p1.bytes)).metadata();
ok("…and the PNG still decodes (the chunk CRC was redone), alpha intact", pm.width === 50 && pm.hasAlpha === true, pm);
ok("a PNG without eXIf is byte-identical", (() => { const plain = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]); const r = stripPngGps(new Uint8Array(plain)); return !r.changed && r.bytes.length === plain.length; })());
ok("a truncated PNG changes nothing", stripPngGps(new Uint8Array(png.subarray(0, 40))).changed === false);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n5. Measured: bytes before and after, on phone-sized samples");
async function measure(label, input) {
  const m0 = await sharp(input).metadata();
  const plan = shrinkPlan({ type: "image/jpeg", size: input.length, width: m0.width, height: m0.height });
  const out = await sharp(input).resize(plan.width, plan.height).jpeg({ quality: Math.round(plan.quality * 100) }).toBuffer();
  const pct = Math.round((1 - out.length / input.length) * 100);
  console.log(`      ${label}: ${m0.width}×${m0.height} ${(input.length / 1e6).toFixed(2)} MB → ${plan.width}×${plan.height} ${(out.length / 1e6).toFixed(2)} MB  (−${pct}%)`);
  return { before: input.length, after: out.length, pct, out };
}
const detailed = await sharp({ create: { width: 4032, height: 3024, channels: 3, background: { r: 120, g: 140, b: 160 }, noise: { type: "gaussian", mean: 128, sigma: 30 } } })
  .blur(1.2).jpeg({ quality: 92 }).withExif({ IFD3: GPS }).toBuffer();
const smooth = await sharp({ create: { width: 4032, height: 3024, channels: 3, background: { r: 120, g: 140, b: 160 }, noise: { type: "gaussian", mean: 128, sigma: 12 } } })
  .blur(3).jpeg({ quality: 92 }).withExif({ IFD3: GPS }).toBuffer();
const m1 = await measure("detailed 12 MP photo (q92)", detailed);
const m2 = await measure("smooth 12 MP photo (q92)", smooth);
ok("a detailed 12 MP photo shrinks by more than half", m1.pct > 50, m1.pct);
ok("a smooth 12 MP photo shrinks by more than half", m2.pct > 50, m2.pct);
ok("…and the resized output carries no EXIF at all (so no GPS)", gpsEntryCount(m1.out) === null && gpsEntryCount(m2.out) === null);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n6. Wired into the one upload helper — and the declared size is the sent size");
function fakeServer() {
  const seen = { sign: null, sent: null };
  const fetchImpl = async (url, init) => {
    if (String(url).endsWith("/sign")) {
      seen.sign = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ uploadUrl: "https://api.cloudinary.com/v1_1/x/image/upload", fields: { a: "1" } }) };
    }
    if (String(url).startsWith("https://api.cloudinary.com")) {
      const f = init.body.get("file");
      seen.sent = new Uint8Array(await f.arrayBuffer());
      return { ok: true, status: 200, json: async () => ({ public_id: "p", version: 1, signature: "s", resource_type: "image", format: "jpg" }) };
    }
    return { ok: true, status: 200, json: async () => ({ url: "https://res.cloudinary.com/x/p.jpg", publicId: "p", kind: "photo", bytes: seen.sent?.length }) };
  };
  return { seen, fetchImpl };
}
{
  const { seen, fetchImpl } = fakeServer();
  await uploadFile(new Blob([small], { type: "image/jpeg" }), { purpose: "jobs", filename: "site.jpg", fetchImpl });
  ok("a JPEG with GPS goes up without it (Node has no canvas, so this is the strip path)", seen.sent && gpsEntryCount(seen.sent) === 0, seen.sent && gpsEntryCount(seen.sent));
  ok("…and the size declared at sign is the size sent", seen.sign?.size === seen.sent?.length && seen.sign?.type === "image/jpeg");
}
{
  const { seen, fetchImpl } = fakeServer();
  await uploadFile(new Blob([small], { type: "image/jpeg" }), { purpose: "plans", filename: "sheet.jpg", fetchImpl, shrink: false });
  ok("shrink: false sends the picked bytes untouched", seen.sent && Buffer.compare(Buffer.from(seen.sent), small) === 0 && seen.sign.size === small.length);
}
{
  const { seen, fetchImpl } = fakeServer();
  const pdf = new Blob([new TextEncoder().encode("%PDF-1.4 fake")], { type: "application/pdf" });
  await uploadFile(pdf, { purpose: "documents", filename: "plan.pdf", fetchImpl });
  ok("a PDF goes up byte-for-byte", seen.sent && new TextDecoder().decode(seen.sent) === "%PDF-1.4 fake" && seen.sign.type === "application/pdf");
}
{
  const r = await shrinkForUpload({ size: 10, type: "image/jpeg", arrayBuffer: async () => { throw new Error("disk gone"); } }, { name: "x.jpg", type: "image/jpeg" });
  ok("shrinkForUpload never rejects: a read failure returns the original", r.action === "skip" && r.after === 10);
}
ok("the upload helper calls shrinkForUpload BEFORE signing", (() => { const c = code("lib/media/uploadClient.js"); const i = c.indexOf("shrinkForUpload("); return i > 0 && i < c.indexOf("postJson(doFetch, route.sign"); })());
ok("the drawing-sheet renderer opts out (it is sized for the deep read on purpose)", /purpose: "plans", shrink: false/.test(code("app/components/planRead/pdfPages.js")));
ok("the server-side caps are untouched: directUpload.js does not import the shrinker", !/shrinkImage/.test(code("lib/media/directUpload.js")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
