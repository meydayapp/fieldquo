// lib/reviews/qr.js
//
// A QR code encoder. Byte mode, error-correction level M, versions 1–20,
// ISO/IEC 18004. About three hundred lines and no dependency.
//
// ── Why hand-rolled ───────────────────────────────────────────────────────────
//
// The only thing this product ever encodes is a URL of under two hundred
// characters, printed on a sticker or dropped into an email. Every published
// encoder does far more (kanji mode, ECI, structured append, canvas output)
// and is the size of this whole directory; the part that is actually needed
// is small, fully specified, and — more to the point — EXECUTABLE against a
// reader in scripts/check-reviews-google.mjs, which decodes what this produces
// module by module. A dependency would be trusted; this is checked.
//
// ── Level M, fixed ────────────────────────────────────────────────────────────
//
// M recovers 15% of damaged codewords. A van sticker gets scraped, a fridge
// magnet gets a thumbprint, an email QR gets a phone camera at an angle. L
// would give smaller codes; the codes here are already small enough for a
// business card, and the extra recovery is worth the modules.
//
// ── Output ────────────────────────────────────────────────────────────────────
//
// `qrMatrix(text)`      → { size, get(x, y) } — the truth, for the reader.
// `qrPath(matrix)`      → one SVG path in module units, for <path d> in an
//                         SVG and for @react-pdf's <Path>. Rows are run-length
//                         merged so the PDF stays small.
// `qrSvg(text, opts)`   → a complete SVG document, dark on light, quiet zone
//                         included. Black on white unless asked otherwise —
//                         a QR is not a brand surface, and every phone camera
//                         is tuned for dark modules on a light ground.

// ── Tables ────────────────────────────────────────────────────────────────────
//
// Level M only. Per version: EC codewords per block, then [blocks, dataCodewords]
// for group 1 and (where present) group 2. Checked at load against the
// module-count formula below, so a typo here throws at import rather than
// producing a code no camera can read.
const EC_M = [
  null,
  [10, [1, 16]],
  [16, [1, 28]],
  [26, [1, 44]],
  [18, [2, 32]],
  [24, [2, 43]],
  [16, [4, 27]],
  [18, [4, 31]],
  [22, [2, 38], [2, 39]],
  [22, [3, 36], [2, 37]],
  [26, [4, 43], [1, 44]],
  [30, [1, 50], [4, 51]],
  [22, [6, 36], [2, 37]],
  [22, [8, 37], [1, 38]],
  [24, [4, 40], [5, 41]],
  [24, [5, 41], [5, 42]],
  [28, [7, 45], [3, 46]],
  [28, [10, 46], [1, 47]],
  [26, [9, 43], [4, 44]],
  [26, [3, 44], [11, 45]],
  [26, [3, 41], [13, 42]],
];

export const MAX_VERSION = EC_M.length - 1;

// Alignment pattern centre coordinates per version (both axes).
const ALIGN = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

export function sizeForVersion(version) {
  return 17 + 4 * version;
}

/** Data codewords a version holds at level M. */
export function dataCapacity(version) {
  const [, ...groups] = EC_M[version];
  return groups.reduce((n, [blocks, cw]) => n + blocks * cw, 0);
}

/** The block layout a reader needs to de-interleave: { ecCount, blocks: [dataLen, …] }. */
export function blockStructure(version) {
  const [ecCount, ...groups] = EC_M[version];
  const blocks = [];
  for (const [count, cw] of groups) for (let i = 0; i < count; i++) blocks.push(cw);
  return { ecCount, blocks };
}

function totalCodewords(version) {
  const [ec, ...groups] = EC_M[version];
  return groups.reduce((n, [blocks, cw]) => n + blocks * (cw + ec), 0);
}

// ── GF(256), polynomial 0x11D ─────────────────────────────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial for `n` EC codewords, highest degree first. */
function generator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gfMul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

/** Reed–Solomon remainder of `data` against the generator for `n`. */
export function reedSolomon(data, n) {
  const g = generator(n);
  const rem = new Array(n).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    if (factor === 0) continue;
    for (let j = 0; j < n; j++) rem[j] ^= gfMul(g[j + 1], factor);
  }
  return rem;
}

// ── Bits ──────────────────────────────────────────────────────────────────────
class BitBuffer {
  constructor() {
    this.bits = [];
  }
  put(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length() {
    return this.bits.length;
  }
}

/** Smallest version whose level-M capacity holds `byteLength` bytes of byte-mode data. */
export function versionFor(byteLength) {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const countBits = v < 10 ? 8 : 16;
    const needed = 4 + countBits + byteLength * 8;
    if (needed <= dataCapacity(v) * 8) return v;
  }
  return null;
}

function encodeData(bytes, version) {
  const buf = new BitBuffer();
  buf.put(0b0100, 4); // byte mode
  buf.put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) buf.put(b, 8);
  const capacityBits = dataCapacity(version) * 8;
  // Terminator: up to four zero bits, fewer if there is no room.
  buf.put(0, Math.min(4, capacityBits - buf.length));
  while (buf.length % 8) buf.put(0, 1);
  const out = [];
  for (let i = 0; i < buf.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buf.bits[i + j];
    out.push(byte);
  }
  // Pad codewords alternate 0xEC, 0x11 — the spec's two, in that order.
  const pads = [0xec, 0x11];
  for (let i = 0; out.length < dataCapacity(version); i++) out.push(pads[i % 2]);
  return out;
}

/** Split into blocks, compute EC for each, interleave data then EC. */
export function interleave(dataCodewords, version) {
  const [ecCount, ...groups] = EC_M[version];
  const blocks = [];
  let offset = 0;
  for (const [count, cw] of groups) {
    for (let i = 0; i < count; i++) {
      const data = dataCodewords.slice(offset, offset + cw);
      offset += cw;
      blocks.push({ data, ec: reedSolomon(data, ecCount) });
    }
  }
  const out = [];
  const longest = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < longest; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const b of blocks) out.push(b.ec[i]);
  }
  return out;
}

// ── The matrix ────────────────────────────────────────────────────────────────
//
// Two grids: `modules` (0/1) and `reserved` (function pattern or not), because
// masking applies only to data modules and the reader needs the same map to
// know where the data lives.

function makeGrid(size) {
  return { size, modules: new Uint8Array(size * size), reserved: new Uint8Array(size * size) };
}

function set(grid, x, y, dark, reserve = true) {
  const i = y * grid.size + x;
  grid.modules[i] = dark ? 1 : 0;
  if (reserve) grid.reserved[i] = 1;
}

function drawFinder(grid, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      // 3×3 dark centre, ring of light, ring of dark, then the light separator.
      set(grid, x, y, d <= 1 || d === 3);
    }
  }
}

function drawAlignment(grid, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(grid, cx + dx, cy + dy, d !== 1);
    }
  }
}

/** Every function pattern for a version, and the reserved format/version areas. */
export function functionPatterns(version) {
  const size = sizeForVersion(version);
  const grid = makeGrid(size);
  drawFinder(grid, 3, 3);
  drawFinder(grid, size - 4, 3);
  drawFinder(grid, 3, size - 4);

  for (let i = 8; i < size - 8; i++) {
    set(grid, i, 6, i % 2 === 0);
    set(grid, 6, i, i % 2 === 0);
  }

  const centres = ALIGN[version];
  const last = centres[centres.length - 1];
  for (const cx of centres) {
    for (const cy of centres) {
      // The three that would sit on a finder are left out. Checked by
      // coordinate rather than by "is anything reserved here" — the timing
      // pattern runs straight through the row-6 and column-6 centres, and
      // those alignment patterns are real.
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === last) || (cx === last && cy === 6)) continue;
      drawAlignment(grid, cx, cy);
    }
  }

  // Format info areas: reserved now, written after masking.
  for (let i = 0; i < 8; i++) {
    set(grid, i === 6 ? 7 : i, 8, 0);
    set(grid, 8, i === 6 ? 7 : i, 0);
    set(grid, size - 1 - i, 8, 0);
    set(grid, 8, size - 1 - i, 0);
  }
  set(grid, 8, 8, 0);
  // The dark module.
  set(grid, 8, size - 8, 1);

  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        set(grid, i, size - 11 + j, 0);
        set(grid, size - 11 + j, i, 0);
      }
    }
  }
  return grid;
}

/** Data module coordinates in placement order — shared with the reader. */
export function placementOrder(grid) {
  const { size, reserved } = grid;
  const order = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is skipped whole
    for (let k = 0; k < size; k++) {
      const y = upward ? size - 1 - k : k;
      for (const x of [right, right - 1]) {
        if (!reserved[y * size + x]) order.push([x, y]);
      }
    }
    upward = !upward;
  }
  return order;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Is module (x, y) inverted under mask pattern `mask`? Exported for the reader. */
export function maskBit(mask, x, y) {
  return MASKS[mask](x, y) ? 1 : 0;
}

/** BCH(15,5) format information for level M and a mask, already XORed with 0x5412. */
export function formatBits(mask) {
  const data = (0b00 << 3) | mask; // level M = 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) & 1 ? 0x537 : 0);
  return ((data << 10) | rem) ^ 0x5412;
}

/** BCH(18,6) version information, versions 7 and up. */
export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) & 1 ? 0x1f25 : 0);
  return (version << 12) | rem;
}

function writeFormat(grid, mask) {
  const bits = formatBits(mask);
  const { size } = grid;
  const bit = (i) => (bits >>> i) & 1;
  // Around the top-left finder.
  for (let i = 0; i < 6; i++) set(grid, 8, i, bit(i));
  set(grid, 8, 7, bit(6));
  set(grid, 8, 8, bit(7));
  set(grid, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(grid, 14 - i, 8, bit(i));
  // The second copy: bottom-left column and top-right row.
  for (let i = 0; i < 8; i++) set(grid, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(grid, 8, size - 15 + i, bit(i));
}

function writeVersion(grid, version) {
  if (version < 7) return;
  const bits = versionBits(version);
  const { size } = grid;
  for (let i = 0; i < 18; i++) {
    const b = (bits >>> i) & 1;
    const a = Math.floor(i / 3);
    const c = (i % 3) + size - 11;
    set(grid, a, c, b);
    set(grid, c, a, b);
  }
}

/** The four penalty rules, summed. Lower is better. */
export function penalty(grid) {
  const { size, modules } = grid;
  const at = (x, y) => modules[y * size + x];
  let score = 0;

  // Rule 1: runs of five or more in a row or column.
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      let run = 0;
      let last = -1;
      for (let b = 0; b < size; b++) {
        const v = pass === 0 ? at(b, a) : at(a, b);
        if (v === last) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          last = v;
          run = 1;
        }
      }
    }
  }
  // Rule 2: 2×2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = at(x, y);
      if (v === at(x + 1, y) && v === at(x, y + 1) && v === at(x + 1, y + 1)) score += 3;
    }
  }
  // Rule 3: the finder-like 1011101 pattern with four light modules either side.
  const pattern = [1, 0, 1, 1, 1, 0, 1];
  const matches = (get, n) => {
    for (let i = 0; i < 7; i++) if (get(n + i) !== pattern[i]) return false;
    return true;
  };
  for (let a = 0; a < size; a++) {
    const row = (i) => (i < 0 || i >= size ? 0 : at(i, a));
    const col = (i) => (i < 0 || i >= size ? 0 : at(a, i));
    for (const get of [row, col]) {
      for (let n = 0; n <= size - 7; n++) {
        if (!matches(get, n)) continue;
        const before = [1, 2, 3, 4].every((k) => get(n - k) === 0);
        const after = [1, 2, 3, 4].every((k) => get(n + 6 + k) === 0);
        if (before || after) score += 40;
      }
    }
  }
  // Rule 4: dark proportion away from 50%.
  let dark = 0;
  for (let i = 0; i < modules.length; i++) dark += modules[i];
  const pct = (dark * 100) / modules.length;
  const prev = Math.floor(pct / 5) * 5;
  score += Math.min(Math.abs(prev - 50) / 5, Math.abs(prev + 5 - 50) / 5) * 10;
  return score;
}

/**
 * Encode `text` (UTF-8) and return the matrix.
 *
 * @returns {{ size:number, version:number, mask:number, get:(x,y)=>0|1, modules:Uint8Array, reserved:Uint8Array }}
 * @throws on empty input or input past version 20's capacity (666 bytes)
 */
export function qrMatrix(text) {
  const bytes = Array.from(Buffer.from(String(text ?? ""), "utf8"));
  if (!bytes.length) throw new Error("qrMatrix: nothing to encode.");
  const version = versionFor(bytes.length);
  if (!version) throw new Error(`qrMatrix: ${bytes.length} bytes is too long for a version-${MAX_VERSION} code.`);

  const codewords = interleave(encodeData(bytes, version), version);
  const base = functionPatterns(version);
  const order = placementOrder(base);

  // Bits, most significant first, then zero remainder bits.
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  while (bits.length < order.length) bits.push(0);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const grid = { size: base.size, modules: Uint8Array.from(base.modules), reserved: base.reserved };
    order.forEach(([x, y], i) => {
      const dark = bits[i] ^ (MASKS[mask](x, y) ? 1 : 0);
      grid.modules[y * grid.size + x] = dark;
    });
    writeFormat(grid, mask);
    writeVersion(grid, version);
    const score = penalty(grid);
    if (!best || score < best.score) best = { grid, mask, score };
  }

  const { grid, mask } = best;
  return {
    size: grid.size,
    version,
    mask,
    modules: grid.modules,
    reserved: grid.reserved,
    get: (x, y) => grid.modules[y * grid.size + x],
  };
}

/** One SVG path, module units, rows run-length merged. */
export function qrPath(matrix, { margin = 0 } = {}) {
  const parts = [];
  for (let y = 0; y < matrix.size; y++) {
    let x = 0;
    while (x < matrix.size) {
      if (!matrix.get(x, y)) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < matrix.size && matrix.get(x + run, y)) run++;
      parts.push(`M${x + margin} ${y + margin}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return parts.join("");
}

/**
 * A complete SVG. `size` is the rendered edge in CSS px; `margin` is the quiet
 * zone in modules (the spec asks for four).
 */
export function qrSvg(text, { size = 256, margin = 4, dark = "#000000", light = "#ffffff", title = "" } = {}) {
  const m = qrMatrix(text);
  const edge = m.size + margin * 2;
  const safeTitle = String(title || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${edge} ${edge}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img"${safeTitle ? ` aria-label="${safeTitle}"` : ""}>` +
    (safeTitle ? `<title>${safeTitle}</title>` : "") +
    `<rect width="${edge}" height="${edge}" fill="${light}"/>` +
    `<path d="${qrPath(m, { margin })}" fill="${dark}"/>` +
    `</svg>`
  );
}

// ── Table self-check, once, at import ────────────────────────────────────────
//
// The number of codewords a version holds is fixed by geometry: every module
// that is not a function pattern, divided by eight. If EC_M disagrees with that
// for any version, the table has a typo and every code of that version would
// be unreadable — better to throw here than to print a sticker nobody can scan.
for (let v = 1; v <= MAX_VERSION; v++) {
  const modules = placementOrder(functionPatterns(v)).length;
  if (Math.floor(modules / 8) !== totalCodewords(v)) {
    throw new Error(`lib/reviews/qr.js: EC table for version ${v} disagrees with the matrix (${Math.floor(modules / 8)} vs ${totalCodewords(v)}).`);
  }
}
