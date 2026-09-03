// scripts/build-pdf-fonts.mjs
//
//   node scripts/build-pdf-fonts.mjs
//
// Regenerates lib/documents/fonts/*.js — the Unicode faces every PDF draws
// with. It runs approximately never: only to pick up a new upstream Noto
// release, or to widen the code-point ranges when a new document language is
// added to app/i18n/languages.js.
//
// ── Why the fonts ship as base64 inside a JS module ─────────────────────────
//
// @react-pdf's Font.register() takes a filesystem path, a URL, or a base64
// data URL. A path is the obvious choice and the one that cannot be verified
// from a laptop: on Vercel the font file only reaches the lambda if next's
// file tracing puts it there, and `path.join(process.cwd(), …)` is opaque to
// the tracer, so it needs an outputFileTracingIncludes entry per route glob.
// Miss a route and the failure is not cosmetic — fontkit.open() rejects,
// renderToBuffer() rejects, and the Send button on a quote throws in
// production while every local test stays green.
//
// A data URL removes the whole class. The bytes are a JS string, so the
// bundler carries them wherever the module is imported and nowhere else —
// which is also TIGHTER scoping than a '/*' tracing include, since the ~200 KB
// lands only in the lambdas that actually render a PDF.
//
// The cost is 4/3 inflation from base64 and four generated files in git. That
// is the trade taken deliberately: measured, bounded, and verifiable locally,
// against a mechanism that could only be verified by deploying.
//
// ── Prerequisites ──────────────────────────────────────────────────────────
//
// pyftsubset, from fontTools:  python3 -m venv .venv && .venv/bin/pip install fonttools
// Point PYFTSUBSET at it if it is not on PATH.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const OUT_DIR = path.join(process.cwd(), "lib", "documents", "fonts");
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "fq-fonts-"));
const PYFTSUBSET = process.env.PYFTSUBSET || "pyftsubset";

// Unhinted, not hinted. TrueType hinting instructions are ~30% of the file and
// are advice to a rasteriser about pixel grids; a PDF viewer scales the
// outlines itself and a print pipeline never sees a pixel grid at all.
const BASE = "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts";

// ── The ranges, and why each one is here ───────────────────────────────────
//
// These are SCRIPT ranges, not the code points the label catalogue happens to
// use, and that is the important decision. A quote PDF is mostly free text the
// contractor typed — the client's name, the address, scope notes. Subsetting
// to lib/i18n/documentLabels.js would render every fixed label perfectly and
// drop the "я" out of a homeowner's surname. The catalogue is the FLOOR that
// check-pdf-fonts.mjs asserts on, never the ceiling.
const LATIN_CYRILLIC = [
  "U+0000-00FF", // Basic Latin + Latin-1 Supplement: en/fr/es/tl and most of de/it
  "U+0100-017F", // Latin Extended-A: Polish, Czech, Turkish… surnames on a client list
  "U+018F,U+0192,U+01A0-01A1,U+01AF-01B0,U+0218-021B", // Vietnamese/Romanian strays
  "U+02BB-02BC,U+02C6,U+02DA,U+02DC", // spacing modifiers used as apostrophes
  "U+0300-0304,U+0308-0309,U+030A,U+030C,U+0323,U+0329", // combining marks
  "U+0400-045F,U+0490-0491,U+04B0-04B1", // Cyrillic + the Ukrainian ґ/Ґ pair
  "U+2000-206F", // spaces, dashes, quotes, the ellipsis in signatureDocumentRef
  "U+2070,U+2074,U+20A0-20BF", // superscripts and every currency sign
  "U+2113,U+2116,U+2122,U+2126,U+212E,U+2190-2193",
  "U+2202,U+2206,U+220F,U+2211-2212,U+2215,U+221A,U+221E,U+222B",
  "U+2248,U+2260,U+2264-2265,U+25CA",
  "U+FB00-FB04,U+FEFF,U+FFFD", // ligatures, BOM, and the replacement char
].join(",");

// No Latin here on purpose. The font stack is [Sans, Gurmukhi] and react-pdf
// substitutes per code point, so every Latin character in a Punjabi document
// is drawn by Noto Sans and Gurmukhi's own Latin would never be reached — 7 KB
// of glyphs that can only ever be dead weight.
const GURMUKHI = [
  "U+0020,U+00A0", // space, nbsp: cheap, and a run is measured with them
  "U+0964-0965", // danda, double danda
  "U+0A00-0A7F", // Gurmukhi
  "U+200C-200D", // ZWNJ/ZWJ — Indic shaping control
  "U+25CC", // dotted circle: what a lone matra falls back to
  "U+FEFF",
].join(",");

const FACES = [
  { family: "NotoSans", weight: "Regular", ranges: LATIN_CYRILLIC, out: "notoSansRegular.js", export: "NOTO_SANS_REGULAR" },
  { family: "NotoSans", weight: "Bold", ranges: LATIN_CYRILLIC, out: "notoSansBold.js", export: "NOTO_SANS_BOLD" },
  { family: "NotoSansGurmukhi", weight: "Regular", ranges: GURMUKHI, out: "notoSansGurmukhiRegular.js", export: "NOTO_SANS_GURMUKHI_REGULAR" },
  { family: "NotoSansGurmukhi", weight: "Bold", ranges: GURMUKHI, out: "notoSansGurmukhiBold.js", export: "NOTO_SANS_GURMUKHI_BOLD" },
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const sha = (f) =>
  crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

let total = 0;
for (const face of FACES) {
  const name = `${face.family}-${face.weight}.ttf`;
  const url = `${BASE}/${face.family}/unhinted/ttf/${name}`;
  const src = path.join(TMP, name);
  const sub = path.join(TMP, `subset-${name}`);

  await download(url, src);
  execFileSync(PYFTSUBSET, [
    src,
    `--unicodes=${face.ranges}`,
    // Everything. Gurmukhi needs its Indic reordering features (pref, blwf,
    // abvs, psts…) or matras land in logical order, which is wrong order.
    // Latin/Cyrillic needs kern and mark, and the rest is a few hundred bytes.
    "--layout-features=*",
    `--output-file=${sub}`,
  ]);

  const bytes = fs.readFileSync(sub);
  total += bytes.length;
  const b64 = bytes.toString("base64");

  const header = `// lib/documents/fonts/${face.out}
//
// GENERATED by scripts/build-pdf-fonts.mjs — do not hand-edit.
//
//   face      ${name}
//   source    ${url}
//   sha256    ${sha(src)} (upstream, before subsetting)
//   subset    ${bytes.length} bytes from ${fs.statSync(src).size}
//   ranges    ${face.ranges}
//   licence   SIL Open Font License 1.1 — see ./OFL.txt
//
// No Reserved Font Name is declared for Noto, so this subset may keep the
// name. See lib/documents/pdfFont.js for why the bytes are inline.
`;

  fs.writeFileSync(
    path.join(OUT_DIR, face.out),
    `${header}\nexport const ${face.export} =\n  "data:font/truetype;base64,${b64}";\n`,
  );
  console.log(`${face.out}  ${(bytes.length / 1024).toFixed(1)} KB → ${(b64.length / 1024).toFixed(1)} KB base64`);
}

console.log(`\ntotal font bytes ${(total / 1024).toFixed(1)} KB (${((total * 4) / 3 / 1024).toFixed(1)} KB as base64)`);
fs.rmSync(TMP, { recursive: true, force: true });
