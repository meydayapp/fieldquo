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
// fontTools:  python3 -m venv .venv && .venv/bin/pip install fonttools
// Point PYFTSUBSET and PYTHON at it if they are not on PATH. PYTHON is only
// needed for the faces that come from a variable font (Korean) and for the
// KS X 1001 derivation in scripts/cjk-ranges.py.
//
// Pass face family names to regenerate only some of them:
//
//   node scripts/build-pdf-fonts.mjs NotoSansKR

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const OUT_DIR = path.join(process.cwd(), "lib", "documents", "fonts");
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "fq-fonts-"));
const PYFTSUBSET = process.env.PYFTSUBSET || "pyftsubset";
const PYTHON = process.env.PYTHON || "python3";

// Unhinted, not hinted. TrueType hinting instructions are ~30% of the file and
// are advice to a rasteriser about pixel grids; a PDF viewer scales the
// outlines itself and a print pipeline never sees a pixel grid at all.
const BASE = "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts";

// ── Why Korean comes from a different repository ───────────────────────────
//
// notofonts.github.io carries the per-script Noto families and has no CJK: the
// CJK faces are a separate project (Noto Sans CJK, derived from Adobe's Source
// Han Sans) and are published either as region-subset OTFs in notofonts/noto-cjk
// or as variable TTFs in google/fonts. The variable TTF is the one taken,
// because it is glyf-based like every other face here — the OTFs are CFF, which
// would make this the only face in the set whose outline format differs from
// the `data:font/truetype` MIME the modules declare.
//
// The cost is an extra step: a variable font has to be pinned to a weight
// before subsetting, and `--update-name-table` is not optional. Without it the
// instance keeps the name of the variable font's DEFAULT instance, which for
// Noto Sans KR is Thin — so the 700 face would ship announcing itself as
// "NotoSansKR-Thin" while drawing Bold outlines, and
// scripts/check-pdf-fonts.mjs reads that name back out of the PDF to prove
// which face drew what.
const GOOGLE_OFL = "https://raw.githubusercontent.com/google/fonts/main/ofl";

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
  // U+2190-2193 (← ↑ → ↓) are requested and NOT DELIVERED: Noto Sans
  // Latin-Greek-Cyrillic carries no arrows, and pyftsubset drops a requested
  // code point the source lacks without a word. Verified against the shipped
  // subset's own cmap, not assumed — the other four entries on this line are
  // all present, these four are not.
  //
  // Left in place rather than deleted so the next person does not re-request
  // them expecting a different answer. The consequence is real but currently
  // unreached: a "→" on a PDF would fall through to Helvetica. The 56 arrows
  // in lib/i18n/clientDocCopy.js and lib/i18n/emailCopy.js are all web and
  // email CTAs ("View document →"), and the only clientDocCopy keys a PDF
  // draws are the waiver ones, which carry none. check-pdf-fonts.mjs now
  // asserts catalogue coverage per language, so an arrow that ever lands in
  // documentLabels.js fails CI by name instead of reaching a homeowner.
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

// ── Korean, and why 2,350 syllables and not 11,172 ─────────────────────────
//
// Measured, both weights, as base64 (which is what actually lands in the
// lambda):
//
//   all 11,172 precomposed syllables   7,298 KB
//   KS X 1001's 2,350 syllables        2,152 KB
//
// The full block is 26× the entire pre-existing font payload (283 KB) and buys
// coverage of syllables that modern Korean does not use. KS X 1001 was the
// national standard for two decades and covers essentially all running Korean.
//
// What the subset gives up, stated plainly because it lands on a client-facing
// document: a syllable outside the 2,350 renders as a BLANK BOX. The realistic
// case is a rare given name, a loanword transcription or onomatopoeia — not
// ordinary prose, and not any of the ~100 common surnames. It is a tofu box
// rather than a crash or mojibake, which is the failure mode this file's whole
// argument prefers: visible, local to one character, and the PDF still arrives.
// scripts/check-pdf-fonts.mjs renders all 11,172 to prove the out-of-subset
// path degrades instead of throwing.
//
// No Latin, for the same reason Gurmukhi has none: the chain is
// [Sans, Korean] and substitution is per code point, so Noto Sans draws every
// Latin character in a Korean document and Noto Sans KR's own Latin — several
// hundred KB of it, at CJK proportions — could never be reached.
const KOREAN = [
  "U+0020,U+00A0", // space, nbsp: cheap, and a run is measured with them
  "U+1100-11FF", // conjoining Jamo. Korean from a Mac arrives NFD-decomposed,
  // and the face's ljmo/vjmo/tjmo features compose it back.
  "U+3000-303F", // CJK punctuation: ideographic space, 、。「」《》〜
  "U+3130-318F", // compatibility Jamo: a lone ㄱ or ㅎ used as a list marker
  "KSX1001", // replaced with the 2,350 syllables — see scripts/cjk-ranges.py
  "U+FF01-FF60", // fullwidth forms: ！（）：，and fullwidth digits/letters
  "U+FFE0-FFE6", // fullwidth currency, ￦ among them
  "U+200B-200D,U+FEFF", // zero-width space/joiners, BOM
  "U+25CC", // dotted circle: what an orphaned jamo falls back to
].join(",");

// ── Mandarin is NOT built here, and that is a size decision ────────────────
//
// It is not a safety one. The Han subset was generated and swept the same way
// Korean was — all 20,992 CJK Unified Ideographs singly and in clusters, both
// weights, plus the hostile strings — and it came back 26,242 renders, zero
// crashes. Unlike Gurmukhi, nothing about Han shaping breaks fontkit.
//
// What stops it is cost, measured both weights as base64:
//
//   GB 2312 level 1      (3,755 Hanzi)   3,163 KB
//   GB 2312 level 1+2    (6,763 Hanzi)   5,806 KB
//   all CJK ideographs  (20,992 Hanzi)  19,456 KB
//
// and, on every PDF render including English-only ones, +16 ms of first-render
// time and +30 MB of heap on top of Korean's +14 ms / +16 MB. The faces are
// loaded when the fallback chain is resolved, not when a Han character is
// finally met, so an English quote pays it too.
//
// Note this is NOT the Gurmukhi arrangement. Gurmukhi is registered and held
// out of the chain, and that costs 60 KB — cheap enough that keeping the faces
// on hand is free. Registering a Han face costs the full 3 MB whether or not
// anything draws with it, because pdfFont.js imports the bytes statically. So
// holding Mandarin back means NOT shipping it, and the honest form of "held
// back" is this recipe rather than a dead import.
//
// To enable it, add the two faces below to FACES and the families to the chain
// in lib/documents/pdfFont.js:
//
//   { family: "NotoSansSC", weight: "Regular", source: "variable", wght: 400,
//     ranges: MANDARIN, out: "notoSansScRegular.js", export: "NOTO_SANS_SC_REGULAR" },
//   { family: "NotoSansSC", weight: "Bold", source: "variable", wght: 700,
//     ranges: MANDARIN, out: "notoSansScBold.js", export: "NOTO_SANS_SC_BOLD" },
//
// with MANDARIN being the KOREAN list minus the Jamo entries and with
// "KSX1001" replaced by "GB2312-1". Then widen the budget assertion in
// scripts/check-pdf-fonts.mjs, which exists to stop exactly this growing
// unnoticed.

const FACES = [
  { family: "NotoSans", weight: "Regular", ranges: LATIN_CYRILLIC, out: "notoSansRegular.js", export: "NOTO_SANS_REGULAR" },
  { family: "NotoSans", weight: "Bold", ranges: LATIN_CYRILLIC, out: "notoSansBold.js", export: "NOTO_SANS_BOLD" },
  { family: "NotoSansGurmukhi", weight: "Regular", ranges: GURMUKHI, out: "notoSansGurmukhiRegular.js", export: "NOTO_SANS_GURMUKHI_REGULAR" },
  { family: "NotoSansGurmukhi", weight: "Bold", ranges: GURMUKHI, out: "notoSansGurmukhiBold.js", export: "NOTO_SANS_GURMUKHI_BOLD" },
  { family: "NotoSansKR", weight: "Regular", source: "variable", wght: 400, ranges: KOREAN, out: "notoSansKrRegular.js", export: "NOTO_SANS_KR_REGULAR" },
  { family: "NotoSansKR", weight: "Bold", source: "variable", wght: 700, ranges: KOREAN, out: "notoSansKrBold.js", export: "NOTO_SANS_KR_BOLD" },
];

// ── Licence, per face and not per project ──────────────────────────────────
//
// Both are OFL 1.1, but the copyright holder and the Reserved Font Name differ,
// and the RFN is the part with teeth. The Latin/Gurmukhi faces are the Noto
// Project's with NO reserved name, so a subset may keep the name. The CJK faces
// are Adobe's, derived from Source Han Sans, and DO carry one: 'Source'. A
// modified version may not be distributed under a reserved name — "Noto Sans
// KR" does not contain 'Source', so this subset is free to keep its name, but
// the notice that declares the RFN has to travel with the bytes, which is why
// there are two licence files rather than one.
// `url` is where the notice is fetched from, so the licence that ships beside
// the bytes is regenerated with them rather than copied by hand once and left
// to drift. OFL 1.1 §2 requires the notice to travel with the font; nothing in
// the licence asks for attribution to the READER, so no "fonts by" line goes
// onto a client's quote.
const LICENCES = {
  NotoSans: {
    file: "OFL.txt",
    rfn: "none declared — this subset may keep the name",
  },
  NotoSansGurmukhi: {
    file: "OFL.txt",
    rfn: "none declared — this subset may keep the name",
  },
  NotoSansKR: {
    file: "OFL-SourceHanSans.txt",
    rfn: "'Source' (Adobe) — not used by this face's name",
    url: `${GOOGLE_OFL}/notosanskr/OFL.txt`,
  },
};

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const sha = (f) =>
  crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

/**
 * Expand the set placeholders in a range list.
 *
 * Kept as a placeholder rather than interpolated at module load so that a
 * missing Python only breaks the faces that actually need it — regenerating
 * the Latin faces must not depend on a derivation they don't use.
 */
const derived = new Map();
function expandRanges(ranges) {
  return ranges.replace(/KSX1001|GB2312-1|GB2312-12/g, (set) => {
    const key = set.toLowerCase();
    if (!derived.has(key)) {
      derived.set(
        key,
        execFileSync(PYTHON, ["-I", path.join("scripts", "cjk-ranges.py"), key], {
          encoding: "utf8",
        }).trim(),
      );
    }
    return derived.get(key);
  });
}

const only = process.argv.slice(2);
const selected = only.length ? FACES.filter((f) => only.includes(f.family)) : FACES;
if (!selected.length) throw new Error(`no face matches ${only.join(", ")}`);

let total = 0;
for (const face of selected) {
  const name = `${face.family}-${face.weight}.ttf`;
  const variable = face.source === "variable";
  // google/fonts names a variable font after its axes, and the brackets are
  // percent-encoded in a raw URL.
  const url = variable
    ? `${GOOGLE_OFL}/${face.family.toLowerCase()}/${face.family}%5Bwght%5D.ttf`
    : `${BASE}/${face.family}/unhinted/ttf/${name}`;
  const src = path.join(TMP, variable ? `${face.family}-VF.ttf` : name);
  const pinned = path.join(TMP, `pinned-${name}`);
  const sub = path.join(TMP, `subset-${name}`);

  if (!fs.existsSync(src)) await download(url, src);
  const upstreamSha = sha(src);
  const upstreamSize = fs.statSync(src).size;

  if (variable) {
    execFileSync(PYTHON, [
      "-I",
      "-m",
      "fontTools.varLib.instancer",
      src,
      `wght=${face.wght}`,
      // Not optional. See the note by GOOGLE_OFL: without it the instance
      // keeps the variable font's default-instance name and the Bold face
      // ships calling itself Thin.
      "--update-name-table",
      "-o",
      pinned,
    ]);
  }

  execFileSync(PYFTSUBSET, [
    variable ? pinned : src,
    `--unicodes=${expandRanges(face.ranges)}`,
    // Everything. Gurmukhi needs its Indic reordering features (pref, blwf,
    // abvs, psts…) or matras land in logical order, which is wrong order.
    // Korean needs ljmo/vjmo/tjmo to compose decomposed jamo into syllables.
    // Latin/Cyrillic needs kern and mark, and the rest is a few hundred bytes.
    "--layout-features=*",
    `--output-file=${sub}`,
  ]);

  const bytes = fs.readFileSync(sub);
  total += bytes.length;
  const b64 = bytes.toString("base64");
  const licence = LICENCES[face.family];
  if (licence.url && !fs.existsSync(path.join(OUT_DIR, licence.file))) {
    await download(licence.url, path.join(OUT_DIR, licence.file));
    console.log(`${licence.file}  fetched from ${licence.url}`);
  }

  const header = `// lib/documents/fonts/${face.out}
//
// GENERATED by scripts/build-pdf-fonts.mjs — do not hand-edit.
//
//   face      ${name}${variable ? ` (pinned from the variable font at wght=${face.wght})` : ""}
//   source    ${url}
//   sha256    ${upstreamSha} (upstream, before ${variable ? "instancing and " : ""}subsetting)
//   subset    ${bytes.length} bytes from ${upstreamSize}
//   licence   SIL Open Font License 1.1 — see ./${licence.file}
//   reserved  ${licence.rfn}
//   ranges    ${face.ranges}
//
// See lib/documents/pdfFont.js for why the bytes are inline.
`;

  fs.writeFileSync(
    path.join(OUT_DIR, face.out),
    `${header}\nexport const ${face.export} =\n  "data:font/truetype;base64,${b64}";\n`,
  );
  console.log(`${face.out}  ${(bytes.length / 1024).toFixed(1)} KB → ${(b64.length / 1024).toFixed(1)} KB base64`);
}

console.log(`\ntotal font bytes ${(total / 1024).toFixed(1)} KB (${((total * 4) / 3 / 1024).toFixed(1)} KB as base64)`);
fs.rmSync(TMP, { recursive: true, force: true });
