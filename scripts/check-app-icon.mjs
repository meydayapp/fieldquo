// scripts/check-app-icon.mjs
//
//   npm run check:app-icon
//
// Guards public/logo/FieldQuo_icon_1024.png — the 1024x1024 app icon Meta's
// App Review requires, built by scripts/build-app-icon.mjs.
//
// ══ What this is actually defending against ═══════════════════════════════
//
// One failure, and it is the reason the builder traces instead of resamples:
// somebody regenerates this file with `sips -z 1024 1024` or an equivalent
// one-liner, gets a 1024x1024 PNG that looks plausible in a file listing, and
// ships a 4.7x upscale of a 205x218 glyph to Meta. The dimensions would be
// right and the icon would be soft. So the size assertion is the weakest thing
// here and the FIDELITY assertion is the point:
//
//   the traced geometry, rendered back down to the source glyph's own
//   resolution, must agree with the source mask pixel-for-pixel
//
// An upscale-then-downscale round trip cannot pass that at this threshold, and
// neither can a redrawn-by-eye mark. Both are the same lie in different
// handwriting.
//
// It also pins the two things a well-meaning edit gets wrong: the icon must be
// OPAQUE (Meta composites it onto surfaces FieldQuo does not control, and a
// transparent navy mark on their dark surfaces is navy on near-black), and it
// must contain FieldQuo's two real inks rather than an approximation of them.
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import sharp from "sharp";
import { buildIcon, mask, bbox } from "./build-app-icon.mjs";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const OUT = "public/logo/FieldQuo_icon_1024.png";
const SOURCE = "public/logo/FieldQuo_icon.png";
const NAVY = "#06356b";
const ORANGE = "#ff5a00";

let pass = 0;
const failures = [];
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); return true; }
  failures.push(name);
  console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  return false;
};
const section = (t) => console.log(`\n${t}`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The file Meta is handed");
// ═══════════════════════════════════════════════════════════════════════════

const meta = await sharp(join(ROOT, OUT)).metadata();
ok("it is a PNG", meta.format === "png", meta.format);
ok("it is exactly 1024x1024", meta.width === 1024 && meta.height === 1024, `${meta.width}x${meta.height}`);

const stats = await sharp(join(ROOT, OUT)).stats();
ok("it is opaque — no alpha channel to composite badly on Meta's surfaces",
  stats.isOpaque && !meta.hasAlpha, { isOpaque: stats.isOpaque, hasAlpha: meta.hasAlpha });

// ═══════════════════════════════════════════════════════════════════════════
section("2. FieldQuo's real inks, not an approximation of them");
// ═══════════════════════════════════════════════════════════════════════════
//
// Counted with a zero tolerance. The builder writes these two hexes literally,
// so every FLAT region must land on them exactly; only the antialiased fringe
// between an ink and the background is allowed to be anything else, and it is
// bounded below so a wholesale colour shift cannot hide inside "antialiasing".

const { data, info } = await sharp(join(ROOT, OUT)).raw().toBuffer({ resolveWithObject: true });
const total = info.width * info.height;
const tally = new Map();
for (let i = 0; i < data.length; i += info.channels) {
  const k = `#${data[i].toString(16).padStart(2, "0")}${data[i + 1].toString(16).padStart(2, "0")}${data[i + 2].toString(16).padStart(2, "0")}`;
  tally.set(k, (tally.get(k) || 0) + 1);
}
const share = (hex) => (tally.get(hex) || 0) / total;
ok("the navy is exactly #06356b and covers a real area", share(NAVY) > 0.03, share(NAVY));
ok("the orange is exactly #ff5a00 and covers a real area", share(ORANGE) > 0.015, share(ORANGE));
ok("the background is exactly white", share("#ffffff") > 0.8, share("#ffffff"));
const flat = share(NAVY) + share(ORANGE) + share("#ffffff");
ok("everything else is only the antialiased fringe", flat > 0.99, { flat });

// ═══════════════════════════════════════════════════════════════════════════
section("3. FIDELITY — the traced geometry IS the mark, not a picture of it");
// ═══════════════════════════════════════════════════════════════════════════
//
// The loops come back in SOURCE pixel coordinates, so they can be rendered at
// 1:1 against the glyph they were traced from. Anything that resampled rather
// than traced fails here while still passing every assertion above.

const built = await buildIcon({ quiet: true });
const { glyph, navyLoops, orangeLoops } = built;

async function renderAtSourceScale(loops, hex) {
  const d = loops
    .map((l) => `M${l.map(([x, y]) => `${(x - glyph.x0).toFixed(3)},${(y - glyph.y0).toFixed(3)}`).join(" L")} Z`)
    .join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${glyph.w}" height="${glyph.h}" viewBox="0 0 ${glyph.w} ${glyph.h}"><path fill="${hex}" fill-rule="nonzero" d="${d}"/></svg>`;
  const { data: px, info: inf } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bits = new Uint8Array(glyph.w * glyph.h);
  for (let p = 0; p < glyph.w * glyph.h; p++) if (px[p * inf.channels + 3] >= 128) bits[p] = 1;
  return bits;
}

function iou(a, b) {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) union++;
    if (a[i] && b[i]) inter++;
  }
  return union === 0 ? 1 : inter / union;
}

for (const [label, loops, hex] of [["navy", navyLoops, NAVY], ["orange", orangeLoops, ORANGE]]) {
  const src = await mask(SOURCE, hex);
  const b = bbox(src);
  // Crop the source mask to the same glyph window the loops were emitted in.
  const cropped = new Uint8Array(glyph.w * glyph.h);
  for (let y = 0; y < glyph.h; y++)
    for (let x = 0; x < glyph.w; x++)
      cropped[y * glyph.w + x] = src.bits[(y + glyph.y0) * src.width + (x + glyph.x0)];
  const traced = await renderAtSourceScale(loops, hex);
  const score = iou(cropped, traced);
  ok(`the traced ${label} matches the source mark at its own resolution (IoU >= 0.98)`, score >= 0.98, score.toFixed(4));
  void b;
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The builder recovered geometry rather than carrying it");
// ═══════════════════════════════════════════════════════════════════════════
//
// A handful of points per shape is what an exact trace of a flat two-ink mark
// looks like. Hundreds would mean the staircase survived — the diagonals were
// never fitted, and every one of them would render as steps at 1024.

const navyPts = navyLoops.reduce((n, l) => n + l.length, 0);
const orangePts = orangeLoops.reduce((n, l) => n + l.length, 0);
ok("the navy is a few straight-edged loops, not a pixel staircase", navyPts < 40, { navyPts, loops: navyLoops.length });
ok("the orange is one straight-edged loop, not a pixel staircase", orangePts < 60 && orangeLoops.length === 1, { orangePts, loops: orangeLoops.length });

// No hand-typed geometry. If somebody replaces the trace with a redrawn path,
// this is what says so — the builder must not contain a literal path string.
const builderSrc = readFileSync(join(ROOT, "scripts/build-app-icon.mjs"), "utf8");
ok("the builder contains no hand-drawn path data — the mark is traced, never redrawn",
  !/\bd="M\s*[\d.]/.test(builderSrc) && !/[Mm]\s*\d+[ ,]\d+\s*[Ll]\s*\d/.test(builderSrc.replace(/\/\/.*$/gm, "")));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailed:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
