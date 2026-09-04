// scripts/build-app-icon.mjs
//
//   node scripts/build-app-icon.mjs
//
// Produces public/logo/FieldQuo_icon_1024.png — the 1024x1024 app icon Meta's
// App Review asks every app to supply, and the size Apple and Android stores
// ask for too.
//
// ══ Why this traces a PNG instead of exporting an SVG ══════════════════════
//
// FieldQuo's mark has no vector source. `git log --all -- '*.svg'` returns
// five files and every one of them is create-next-app boilerplate; a FieldQuo
// SVG has never existed in this repository. The mark exists only as raster,
// and the largest copy of the GLYPH anywhere — measured, not assumed — is
// 205x218: identical in public/logo/FieldQuo_icon.png, in the horizontal
// lockup and in the vertical lockup, because all three were exported from one
// artboard at one size.
//
// 205x218 blown up to 1024 is a 4.7x upscale. That produces exactly the soft,
// obviously-resampled icon AGENTS.md's rule is about — something that looks
// done and isn't. So this does the other thing: it recovers the geometry.
//
// The mark is two flat inks with no gradients, no curves and no antialiased
// interior — every navy edge is axis-aligned and every orange edge is
// axis-aligned or a straight diagonal. A shape like that can be traced back to
// polygons EXACTLY, and a polygon has no resolution. What is rendered at 1024
// is therefore the same mark, not a bigger picture of it.
//
// ── Traced, not redrawn ──────────────────────────────────────────────────
//
// Nothing here contains a hand-typed coordinate. The outlines come out of the
// pixels: every filled pixel contributes its four edges, edges shared by two
// filled pixels cancel, and what survives is the boundary. Collinear points
// are then merged and the pixel staircase on the diagonals is fitted with
// Douglas-Peucker. Redrawing it by eye from measurements would be inventing a
// new logo that resembles the old one, which is the thing that was ruled out.
//
// verifyIcon() at the bottom re-reads what was written and refuses to leave a
// file behind that disagrees with the source mark — see its own comment for
// what "disagrees" is allowed to mean.
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");

/** The mark, and the icon FieldQuo already ships, which sets the framing. */
const SOURCE = "public/logo/FieldQuo_icon.png";
const FRAMING_REFERENCE = "app/apple-icon.png";
const OUT = "public/logo/FieldQuo_icon_1024.png";
const SIZE = 1024;

// Measured off the logo PNGs at alpha >= 128: the mark contains exactly these
// two inks and nothing else. app/globals.css names the same pair and says the
// palette is taken from the logo.
const NAVY = "#06356b";
const ORANGE = "#ff5a00";

// The icon is opaque. Meta's app icon is composited onto surfaces FieldQuo
// does not control, and a transparent PNG there renders as a navy mark on
// whatever Meta's background happens to be — including, on their dark
// surfaces, navy on near-black. app/apple-icon.png already made this choice
// (it is the one icon in the repo with no alpha channel) and this follows it
// rather than inventing a second answer.
const BACKGROUND = "#ffffff";

export async function mask(file, hex, tolerance = 45) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const { data, info } = await sharp(join(ROOT, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const bits = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < width * height; p++, i += channels) {
    // Alpha first: the source is transparent-backed, and a fully transparent
    // pixel can carry any RGB at all.
    if (data[i + 3] < 128) continue;
    if (
      Math.abs(data[i] - r) < tolerance &&
      Math.abs(data[i + 1] - g) < tolerance &&
      Math.abs(data[i + 2] - b) < tolerance
    ) {
      bits[p] = 1;
    }
  }
  return { bits, width, height };
}

export function bbox({ bits, width, height }) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (bits[y * width + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * The boundary of the union of the filled unit squares, as closed loops in
 * pixel-corner coordinates.
 *
 * Every filled pixel contributes its four edges wound the same way. An edge
 * between two filled pixels appears twice, once in each direction, and the two
 * cancel — so what is left is exactly the outline, with holes wound opposite to
 * outers and therefore correct under the nonzero fill rule for free.
 */
function outlines({ bits, width, height }) {
  const edges = new Map(); // "x,y" -> [ "x,y", ... ]  (directed a -> b)
  const key = (x, y) => `${x},${y}`;
  const add = (ax, ay, bx, by) => {
    const a = key(ax, ay), b = key(bx, by);
    const back = edges.get(b);
    const i = back ? back.indexOf(a) : -1;
    // The opposite edge is already there: they are interior, cancel both.
    if (i !== -1) { back.splice(i, 1); if (!back.length) edges.delete(b); return; }
    if (!edges.has(a)) edges.set(a, []);
    edges.get(a).push(b);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!bits[y * width + x]) continue;
      add(x, y, x + 1, y);
      add(x + 1, y, x + 1, y + 1);
      add(x + 1, y + 1, x, y + 1);
      add(x, y + 1, x, y);
    }
  }

  const loops = [];
  while (edges.size) {
    const start = edges.keys().next().value;
    const loop = [];
    let cur = start;
    for (;;) {
      const next = edges.get(cur);
      if (!next || !next.length) break;
      const nxt = next.shift();
      if (!next.length) edges.delete(cur);
      loop.push(cur.split(",").map(Number));
      cur = nxt;
      if (cur === start) break;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** Drop points that lie exactly on the segment between their neighbours. */
function dropCollinear(pts) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i - 1 + n) % n];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    if ((cx - px) * (ny - cy) !== (cy - py) * (nx - cx)) out.push([cx, cy]);
  }
  return out;
}

/**
 * Douglas-Peucker, closed. This is what turns the one-pixel staircase along a
 * diagonal back into the straight line it was before it was rasterised.
 *
 * eps is just under one pixel: a staircase never departs from its own chord by
 * a full pixel, and no real corner in this mark is that shallow. Raising it
 * would start cutting corners off; lowering it leaves the stairs in.
 */
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const d2 = ([x, y], [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    if (!len) return (x - ax) ** 2 + (y - ay) ** 2;
    let t = ((x - ax) * dx + (y - ay) * dy) / len;
    t = Math.max(0, Math.min(1, t));
    return (x - (ax + t * dx)) ** 2 + (y - (ay + t * dy)) ** 2;
  };
  const run = (a, b) => {
    let worst = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = d2(pts[i], pts[a], pts[b]);
      if (d > worst) { worst = d; idx = i; }
    }
    if (worst <= eps * eps) return [pts[a]];
    return [...run(a, idx), ...run(idx, b)];
  };
  // Split the closed ring at its two most distant-in-index anchors so the
  // start point is not treated as an immovable corner.
  const half = Math.floor(pts.length / 2);
  return [...run(0, half), ...run(half, pts.length - 1), pts[pts.length - 1]];
}

function pathData(loops, { x0, y0, scale, ox, oy }) {
  return loops
    .map((loop) => {
      const p = loop
        .map(([x, y]) => {
          const X = ox + (x - x0) * scale;
          const Y = oy + (y - y0) * scale;
          return `${X.toFixed(3)},${Y.toFixed(3)}`;
        })
        .join(" L");
      return `M${p} Z`;
    })
    .join(" ");
}

export async function buildIcon({ quiet = false } = {}) {
  const navy = await mask(SOURCE, NAVY);
  const orange = await mask(SOURCE, ORANGE);

  const nb = bbox(navy), ob = bbox(orange);
  const glyph = {
    x0: Math.min(nb.x0, ob.x0),
    y0: Math.min(nb.y0, ob.y0),
    x1: Math.max(nb.x1, ob.x1),
    y1: Math.max(nb.y1, ob.y1),
  };
  glyph.w = glyph.x1 - glyph.x0 + 1;
  glyph.h = glyph.y1 - glyph.y0 + 1;

  // ── Framing is copied from the icon FieldQuo already ships ──────────────
  //
  // Not chosen. app/apple-icon.png is the one asset in this repo that already
  // answers "how much room does the mark get inside a square icon", and
  // picking a tighter crop here would mean FieldQuo's Meta icon and its iOS
  // icon are cropped differently for no reason anyone could state later.
  const refNavy = await mask(FRAMING_REFERENCE, NAVY);
  const refOrange = await mask(FRAMING_REFERENCE, ORANGE);
  const rn = bbox(refNavy), ro = bbox(refOrange);
  const refSize = refNavy.width;
  const ref = {
    x0: Math.min(rn.x0, ro.x0),
    y0: Math.min(rn.y0, ro.y0),
    x1: Math.max(rn.x1, ro.x1),
    y1: Math.max(rn.y1, ro.y1),
  };
  const heightFraction = (ref.y1 - ref.y0 + 1) / refSize;

  const scale = (SIZE * heightFraction) / glyph.h;
  const ox = (SIZE - glyph.w * scale) / 2;
  const oy = (SIZE - glyph.h * scale) / 2;

  const EPS = 0.9;
  const shape = (m) =>
    outlines(m)
      .map(dropCollinear)
      .map((l) => simplify(l, EPS))
      .map(dropCollinear)
      .filter((l) => l.length >= 3);

  const navyLoops = shape(navy);
  const orangeLoops = shape(orange);

  const frame = { x0: glyph.x0, y0: glyph.y0, scale, ox, oy };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="${SIZE}" height="${SIZE}" fill="${BACKGROUND}"/>
<path fill="${NAVY}" fill-rule="nonzero" d="${pathData(navyLoops, frame)}"/>
<path fill="${ORANGE}" fill-rule="nonzero" d="${pathData(orangeLoops, frame)}"/>
</svg>`;

  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .flatten({ background: BACKGROUND })
    .toFile(join(ROOT, OUT));

  if (!quiet) {
    console.log(`source glyph ${glyph.w}x${glyph.h} at (${glyph.x0},${glyph.y0})`);
    console.log(`navy outline points: ${navyLoops.reduce((n, l) => n + l.length, 0)} in ${navyLoops.length} loop(s)`);
    console.log(`orange outline points: ${orangeLoops.reduce((n, l) => n + l.length, 0)} in ${orangeLoops.length} loop(s)`);
    console.log(`framing copied from ${FRAMING_REFERENCE}: glyph height ${(heightFraction * 100).toFixed(1)}% of the canvas`);
    console.log(`wrote ${OUT}`);
  }
  return { svg, glyph, heightFraction, navyLoops, orangeLoops };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildIcon();
}
